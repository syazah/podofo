import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis/connection.js";
import { extractDocumentBatch } from "../../service/extraction.service.js";
import { AppLogger } from "../../config/logger.js";
import { getDocumentCountsByStatus } from "../../data/document.data.js";
import { updateLotStatusOnly } from "../../data/lot.data.js";
import type { ExtractionJobData } from "../../types/extraction.js";
import { supabaseAdmin } from "../../config/supabase/client.js";
import type { DocumentRow } from "../../types/index.js";

const QUEUE_NAME = "document-extraction";
const infoLogger = AppLogger.getInfoLogger();
const errorLogger = AppLogger.getErrorLogger();

export const extractionWorker = new Worker<ExtractionJobData>(
  QUEUE_NAME,
  async (job) => {
    const { lotId, documentIds } = job.data;
    infoLogger.info(
      `[Extraction Worker] Processing job ${job.id}: lot=${lotId}, documents=${documentIds.length}`
    );

    // Fetch document metadata (without image) for processing
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, lot_id, source_pdf_id, storage_path, file_size, file_hash, page_number, status, classification, assigned_model, extracted_data, confidence, field_confidences, cost_data, error_message, processing_time_ms, created_at, updated_at")
      .in("id", documentIds);

    if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
    const documents = data as DocumentRow[];

    const results = await extractDocumentBatch(documents);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    infoLogger.info(
      `[Extraction Worker] Job ${job.id} complete: ${succeeded} succeeded, ${failed} failed`
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

extractionWorker.on("completed", async (job) => {
  infoLogger.info(`[Extraction Worker] Job ${job.id} completed successfully`);

  try {
    const { lotId } = job.data;
    const counts = await getDocumentCountsByStatus(lotId);

    // Check if all documents are done with extraction (extracted or failed)
    if (counts.extracted + counts.failed === counts.total) {
      const finalStatus = counts.failed > 0 ? "partial_failure" : "completed";
      await updateLotStatusOnly(lotId, finalStatus);
      infoLogger.info(
        `[Extraction Worker] Lot ${lotId} finished: status=${finalStatus} (${counts.extracted} extracted, ${counts.failed} failed)`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorLogger.error(`[Extraction Worker] Error in extraction auto-chain for job ${job.id}: ${message}`);
  }
});

extractionWorker.on("failed", (job, err) => {
  errorLogger.error(`[Extraction Worker] Job ${job?.id} failed: ${err.message}`);
});

extractionWorker.on("error", (err) => {
  errorLogger.error(`[Extraction Worker] Error: ${err.message}`);
});
