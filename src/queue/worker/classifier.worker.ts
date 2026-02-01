import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import { ClassificationService } from "../../service/classifier.service.js";
import { AppLogger } from "../../config/logger.js";
import { getDocumentCountsByStatus, getDocumentsByLotId } from "../../data/document.data.js";
import { updateLotStatusOnly } from "../../data/lot.data.js";
import { enqueueExtractionJob } from "../producer/extraction.producer.js";
import type { ClassificationJobData } from "../../types/classification.js";

const QUEUE_NAME = "document-classification";
const infoLogger = AppLogger.getInfoLogger();
const errorLogger = AppLogger.getErrorLogger();
const classificationService = new ClassificationService();

export const classificationWorker = new Worker<ClassificationJobData>(
  QUEUE_NAME,
  async (job) => {
    const { lotId, documents } = job.data;
    infoLogger.info(
      `[Worker] Processing job ${job.id}: lot=${lotId}, documents=${documents.length}`
    );

    const results = await classificationService.classifyDocumentBatch(documents);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    infoLogger.info(
      `[Worker] Job ${job.id} complete: ${succeeded} succeeded, ${failed} failed`
    );

    return { lotId, succeeded, failed, results };
  },
  {
    connection: redisConnection,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60_000,
    },
  }
);

classificationWorker.on("completed", async (job) => {
  infoLogger.info(`[Worker] Job ${job.id} completed successfully`);

  try {
    const { lotId } = job.data;
    const counts = await getDocumentCountsByStatus(lotId);

    // Check if all documents are done with classification (classified or failed)
    if (counts.classified + counts.failed === counts.total) {
      infoLogger.info(
        `[Worker] All documents in lot ${lotId} classified (${counts.classified} ok, ${counts.failed} failed). Enqueueing extraction.`
      );

      const documents = await getDocumentsByLotId(lotId);
      const classified = documents.filter((doc) => doc.status === "classified");

      if (classified.length > 0) {
        const { jobCount, batchSize } = await enqueueExtractionJob(lotId, classified);
        await updateLotStatusOnly(lotId, "extracting");
        infoLogger.info(
          `[Worker] Lot ${lotId}: enqueued ${jobCount} extraction jobs (batch size ${batchSize})`
        );
      } else {
        // All documents failed classification
        await updateLotStatusOnly(lotId, "failed");
        errorLogger.error(`[Worker] Lot ${lotId}: all documents failed classification`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorLogger.error(`[Worker] Error in classification auto-chain for job ${job.id}: ${message}`);
  }
});

classificationWorker.on("failed", (job, err) => {
  errorLogger.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

classificationWorker.on("error", (err) => {
  errorLogger.error(`[Worker] Error: ${err.message}`);
});
