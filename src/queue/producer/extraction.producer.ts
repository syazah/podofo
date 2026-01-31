import { Queue } from "bullmq";
import type { ExtractionJobData } from "../../types/extraction.js";
import { redisConnection } from "../../config/redis/connection.js";
import type { DocumentRow } from "../../types/index.js";

const QUEUE_NAME = "document-extraction";
const BATCH_SIZE = 25;

export const extractionQueue = new Queue<ExtractionJobData>(QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 60_000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    }
});

export async function enqueueExtractionJob(
    lotId: string,
    documents: DocumentRow[]
) {
    const batches: typeof documents[] = [];
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        batches.push(documents.slice(i, i + BATCH_SIZE));
    }

    const jobs = batches.map((batch, index) => ({
        name: `extract-lot-${lotId}-batch-${index}`,
        data: { lotId, documents: batch },
    }));

    await extractionQueue.addBulk(jobs);

    return { jobCount: jobs.length, batchSize: BATCH_SIZE };
}
