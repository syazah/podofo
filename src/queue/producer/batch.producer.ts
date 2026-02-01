import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import type { BatchSubmitJobData, BatchPollJobData } from "../../types/batch.js";
import { projectConstants } from "../../config/constants.js";

const QUEUE_NAME = "batch-processing";

export const batchQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60_000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function enqueueBatchSubmit(data: BatchSubmitJobData) {
  await batchQueue.add(`submit-${data.stage}`, data);
}

export async function enqueueBatchPoll(
  data: BatchPollJobData,
  delayMs: number = projectConstants.BATCH_POLL_DELAY_MS
) {
  await batchQueue.add("poll", data, { delay: delayMs });
}
