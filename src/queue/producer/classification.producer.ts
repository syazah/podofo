import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import type { ClassificationJobData } from "../../types/classification.js";
import type { DocumentRow } from "../../types/index.js";

const QUEUE_NAME = "document-classification";
const BATCH_SIZE = 25;

export const classificationQueue = new Queue<ClassificationJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 60_000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const enqueueClassificationJobs = async (
  lotId: string,
  documents: DocumentRow[]
) => {
  const batches: typeof documents[] = [];
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    batches.push(documents.slice(i, i + BATCH_SIZE));
  }

  const jobs = batches.map((batch, index) => ({
    name: `classify-lot-${lotId}-batch-${index}`,
    data: { lotId, documents: batch },
  }));

  await classificationQueue.addBulk(jobs);

  return { jobCount: jobs.length, batchSize: BATCH_SIZE };
};
