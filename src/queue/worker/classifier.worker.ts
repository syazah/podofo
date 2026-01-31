import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import { ClassificationService } from "../../service/classifier.service.js";
import { AppLogger } from "../../config/logger.js";
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

    return { succeeded, failed, results };
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

classificationWorker.on("completed", (job) => {
  infoLogger.info(`[Worker] Job ${job.id} completed successfully`);
});

classificationWorker.on("failed", (job, err) => {
  errorLogger.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

classificationWorker.on("error", (err) => {
  errorLogger.error(`[Worker] Error: ${err.message}`);
});
