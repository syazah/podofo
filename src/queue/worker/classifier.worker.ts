import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import { classifyDocumentBatch } from "../../service/classifier.service.js";
import type { ClassificationJobData } from "../../types/classification.js";

const QUEUE_NAME = "document-classification";

export const classificationWorker = new Worker<ClassificationJobData>(
  QUEUE_NAME,
  async (job) => {
    const { lotId, documents } = job.data;
    console.log(
      `[Worker] Processing job ${job.id}: lot=${lotId}, documents=${documents.length}`
    );

    const results = await classifyDocumentBatch(documents);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(
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
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

classificationWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

classificationWorker.on("error", (err) => {
  console.error(`[Worker] Error: ${err.message}`);
});
