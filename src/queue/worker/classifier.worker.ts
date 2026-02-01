import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import { ClassificationService } from "../../service/classifier.service.js";
import { AppLogger } from "../../config/logger.js";
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
    lockDuration: 120_000,
    lockRenewTime: 30_000,
  }
);

classificationWorker.on("completed", async (job, returnValue) => {
  infoLogger.info(`[Worker] Job ${job.id} completed successfully`);

  try {
    const { lotId } = job.data;
    const { succeeded, failed, results } = returnValue;

    const totalInBatch = results.length;
    const processedInBatch = succeeded + failed;

    if (processedInBatch === totalInBatch) {
      infoLogger.info(
        `[Worker] Batch for lot ${lotId} complete (${succeeded} ok, ${failed} failed).`
      );

      if (succeeded > 0) {
        const successfulDocIds = results
          .filter((r: { success: boolean }) => r.success)
          .map((r: { documentId: string }) => r.documentId);
        const { jobCount, batchSize } = await enqueueExtractionJob(lotId, successfulDocIds);
        await updateLotStatusOnly(lotId, "extracting");
        infoLogger.info(
          `[Worker] Lot ${lotId}: enqueued ${jobCount} extraction jobs (batch size ${batchSize})`
        );
      } else {
        await updateLotStatusOnly(lotId, "failed");
        errorLogger.error(`[Worker] Lot ${lotId}: all documents in batch failed classification`);
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
