import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import { extractDocumentBatch } from "../../service/extraction.service.js";
import type { ExtractionJobData } from "../../types/extraction.js";

const QUEUE_NAME = "document-extraction";

export const extractionWorker = new Worker<ExtractionJobData>(
  QUEUE_NAME,
  async (job) => {
    const { lotId, documents } = job.data;
    console.log(
      `[Extraction Worker] Processing job ${job.id}: lot=${lotId}, documents=${documents.length}`
    );

    const results = await extractDocumentBatch(documents);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(
      `[Extraction Worker] Job ${job.id} complete: ${succeeded} succeeded, ${failed} failed`
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

extractionWorker.on("completed", (job) => {
  console.log(`[Extraction Worker] Job ${job.id} completed successfully`);
});

extractionWorker.on("failed", (job, err) => {
  console.error(`[Extraction Worker] Job ${job?.id} failed: ${err.message}`);
});

extractionWorker.on("error", (err) => {
  console.error(`[Extraction Worker] Error: ${err.message}`);
});
