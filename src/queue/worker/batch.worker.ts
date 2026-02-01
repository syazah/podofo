import { Worker } from "bullmq";
import { JobState } from "@google/genai";
import { redisConnection } from "../../config/redis/connection.js";
import { BatchService } from "../../service/batch.service.js";
import { getDocumentsByLotId, getDocumentCountsByStatus } from "../../data/document.data.js";
import { updateLotStatusOnly } from "../../data/lot.data.js";
import { enqueueBatchPoll, enqueueBatchSubmit } from "../producer/batch.producer.js";
import { modelConstants, projectConstants } from "../../config/constants.js";
import { AppLogger } from "../../config/logger.js";
import type { BatchSubmitJobData, BatchPollJobData } from "../../types/batch.js";

const QUEUE_NAME = "batch-processing";
const infoLogger = AppLogger.getInfoLogger();
const errorLogger = AppLogger.getErrorLogger();

export const batchWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name.startsWith("submit-")) {
      return await handleSubmit(job.data as BatchSubmitJobData);
    } else if (job.name === "poll") {
      return await handlePoll(job.data as BatchPollJobData);
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

async function handleSubmit(data: BatchSubmitJobData) {
  const { lotId, stage } = data;
  const documents = await getDocumentsByLotId(lotId);

  if (stage === "classification") {
    const pendingDocs = documents.filter(
      (d) => d.status === "pending" && d.storage_path
    );

    for (let i = 0; i < pendingDocs.length; i += projectConstants.BATCH_CHUNK_SIZE) {
      const chunk = pendingDocs.slice(i, i + projectConstants.BATCH_CHUNK_SIZE);
      const { geminiJobName, documentIds } = await BatchService.submitClassificationBatch(
        chunk,
        modelConstants.GEMINI_FLASH
      );
      await enqueueBatchPoll({
        geminiJobName,
        lotId,
        stage: "classification",
        documentIds,
      });
    }

    const batchCount = Math.ceil(pendingDocs.length / projectConstants.BATCH_CHUNK_SIZE);
    infoLogger.info(
      `[BatchWorker] Submitted ${batchCount} classification batches for lot ${lotId} (${pendingDocs.length} docs, ~50% cost savings via Batch API)`
    );
  } else if (stage === "extraction") {
    const classifiedDocs = documents.filter(
      (d) => d.status === "classified" && d.storage_path && d.assigned_model
    );

    // Group by assigned model for smart routing
    const byModel = new Map<string, typeof classifiedDocs>();
    for (const doc of classifiedDocs) {
      const model = doc.assigned_model!;
      const group = byModel.get(model) ?? [];
      group.push(doc);
      byModel.set(model, group);
    }

    for (const [model, modelDocs] of byModel) {
      for (let i = 0; i < modelDocs.length; i += projectConstants.BATCH_CHUNK_SIZE) {
        const chunk = modelDocs.slice(i, i + projectConstants.BATCH_CHUNK_SIZE);
        const { geminiJobName, documentIds } = await BatchService.submitExtractionBatch(
          chunk,
          model
        );
        await enqueueBatchPoll({
          geminiJobName,
          lotId,
          stage: "extraction",
          documentIds,
        });
      }
    }

    infoLogger.info(
      `[BatchWorker] Submitted extraction batches for lot ${lotId} (${classifiedDocs.length} docs across ${byModel.size} model(s))`
    );
  }
}

async function handlePoll(data: BatchPollJobData) {
  const { geminiJobName, lotId, stage, documentIds } = data;

  const batchJob = await BatchService.checkStatus(geminiJobName);
  const state = batchJob.state;

  if (!state || !BatchService.isTerminal(state)) {
    infoLogger.info(
      `[BatchWorker] Batch ${geminiJobName} still ${state ?? "unknown"}, re-polling in ${projectConstants.BATCH_POLL_DELAY_MS / 1000}s`
    );
    await enqueueBatchPoll(data);
    return;
  }

  if (state === JobState.JOB_STATE_SUCCEEDED) {
    if (stage === "classification") {
      const results = await BatchService.processClassificationResults(geminiJobName, documentIds);
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      infoLogger.info(
        `[BatchWorker] Classification batch ${geminiJobName} processed: ${succeeded} ok, ${failed} failed`
      );

      // Check if all documents in the lot are classified
      const counts = await getDocumentCountsByStatus(lotId);
      infoLogger.info(
        `[BatchWorker] Lot ${lotId} status check: total=${counts.total}, classified=${counts.classified}, failed=${counts.failed}, pending=${counts.pending}, extracted=${counts.extracted}`
      );
      if (counts.pending === 0 && counts.classified + counts.failed === counts.total) {
        infoLogger.info(
          `[BatchWorker] All docs in lot ${lotId} classified (${counts.classified} ok, ${counts.failed} failed). Starting extraction.`
        );

        const allDocs = await getDocumentsByLotId(lotId);
        const classified = allDocs.filter((d) => d.status === "classified");

        if (classified.length > 0) {
          await enqueueBatchSubmit({ lotId, stage: "extraction" });
          await updateLotStatusOnly(lotId, "extracting");
        } else {
          await updateLotStatusOnly(lotId, "failed");
          errorLogger.error(`[BatchWorker] Lot ${lotId}: all documents failed classification`);
        }
      }
    } else if (stage === "extraction") {
      const results = await BatchService.processExtractionResults(geminiJobName, documentIds);
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      infoLogger.info(
        `[BatchWorker] Extraction batch ${geminiJobName} processed: ${succeeded} ok, ${failed} failed`
      );

      // Check if all documents in the lot are done
      const counts = await getDocumentCountsByStatus(lotId);
      infoLogger.info(
        `[BatchWorker] Lot ${lotId} extraction check: total=${counts.total}, extracted=${counts.extracted}, classified=${counts.classified}, failed=${counts.failed}, pending=${counts.pending}`
      );
      if (counts.extracted + counts.failed === counts.total) {
        const finalStatus = counts.failed > 0 ? "partial_failure" : "completed";
        await updateLotStatusOnly(lotId, finalStatus);
        infoLogger.info(
          `[BatchWorker] Lot ${lotId} complete: ${finalStatus} (${counts.extracted} extracted, ${counts.failed} failed)`
        );
      }
    }
  } else {
    // Failed or cancelled - mark documents as failed
    errorLogger.error(
      `[BatchWorker] Batch ${geminiJobName} ended with state ${state}. Stats: ${JSON.stringify(batchJob.completionStats)}`
    );

    // Update all documents in this batch to failed status
    const { updateDocumentStatus } = await import("../../data/document.data.js");
    for (const docId of documentIds) {
      try {
        await updateDocumentStatus(docId, "failed", `Batch job failed: ${state}`);
      } catch (err) {
        errorLogger.error(`[BatchWorker] Failed to mark doc ${docId} as failed: ${err}`);
      }
    }

    // Check if lot should be marked as failed
    const counts = await getDocumentCountsByStatus(lotId);
    if (counts.pending === 0) {
      const finalStatus = counts.extracted > 0 || counts.classified > 0 ? "partial_failure" : "failed";
      await updateLotStatusOnly(lotId, finalStatus);
      infoLogger.info(`[BatchWorker] Lot ${lotId} marked as ${finalStatus} after batch failure`);
    }
  }
}

batchWorker.on("failed", (job, err) => {
  errorLogger.error(`[BatchWorker] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
});

batchWorker.on("error", (err) => {
  errorLogger.error(`[BatchWorker] Error: ${err.message}`);
});
