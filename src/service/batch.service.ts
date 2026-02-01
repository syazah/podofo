import { JobState } from "@google/genai";
import { GeminiClient } from "../config/gemini/client.js";
import { S3Storage } from "../data/storage.data.js";
import { AppLogger } from "../config/logger.js";
import { modelConstants } from "../config/constants.js";
import { getImageClassificationPrompt } from "../prompts/classificationPrompts.js";
import { getExtractionPrompt } from "../prompts/extractionPrompt.js";
import type { DocumentRow } from "../types/index.js";
import type { ClassificationResult, AssignedModel, DocumentClassification } from "../types/classification.js";
import type { ExtractionResult } from "../types/extraction.js";
import { LotDB } from "../data/lot.data.js";
import { DocumentDB } from "../data/document.data.js";

const client = GeminiClient.getGeminiClient();
const s3Storage = S3Storage.getInstance();
const infoLogger = AppLogger.getInfoLogger();
const errorLogger = AppLogger.getErrorLogger();

const TERMINAL_STATES = new Set([
  JobState.JOB_STATE_SUCCEEDED,
  JobState.JOB_STATE_FAILED,
  JobState.JOB_STATE_CANCELLED,
]);
const lotDB = LotDB.getInstance();
const docDB = DocumentDB.getInstance();
export class BatchService {
  static async submitClassificationBatch(
    documents: DocumentRow[],
    model: string = modelConstants.GEMINI_FLASH
  ): Promise<{ geminiJobName: string; documentIds: string[] }> {
    const inlinedRequests: Record<string, unknown>[] = [];
    const validDocIds: string[] = [];

    for (const doc of documents) {
      if (!doc.storage_path) continue;
      try {
        const buffer = await s3Storage.downloadImage(doc.storage_path);
        const base64 = buffer.toString("base64");

        inlinedRequests.push({
          contents: [
            {
              role: "user",
              parts: [
                { text: `Document ID: ${doc.id}` },
                { inlineData: { mimeType: "image/jpeg", data: base64 } },
                { text: getImageClassificationPrompt(1) },
              ],
            },
          ],
          metadata: { documentId: doc.id },
        });
        validDocIds.push(doc.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errorLogger.error(`[BatchService] Failed to download image for doc ${doc.id}: ${msg}`);
      }
    }

    if (inlinedRequests.length === 0) {
      throw new Error("No valid documents for classification batch");
    }

    const batchJob = await client.batches.create({
      model,
      src: inlinedRequests as any,
      config: { displayName: `cls-${Date.now()}` },
    });

    infoLogger.info(
      `[BatchService] Created classification batch ${batchJob.name} (${validDocIds.length} docs, model=${model})`
    );
    return { geminiJobName: batchJob.name!, documentIds: validDocIds };
  }

  /**
   * Submit an extraction batch job for a chunk of documents (all same model).
   */
  static async submitExtractionBatch(
    documents: DocumentRow[],
    model: string
  ): Promise<{ geminiJobName: string; documentIds: string[] }> {
    const inlinedRequests: Record<string, unknown>[] = [];
    const validDocIds: string[] = [];

    for (const doc of documents) {
      if (!doc.storage_path || !doc.assigned_model) continue;
      try {
        const buffer = await s3Storage.downloadImage(doc.storage_path);
        const base64 = buffer.toString("base64");

        inlinedRequests.push({
          contents: [
            {
              role: "user",
              parts: [
                { text: `Document ID: ${doc.id}` },
                { inlineData: { mimeType: "image/jpeg", data: base64 } },
                { text: getExtractionPrompt(1) },
              ],
            },
          ],
          metadata: { documentId: doc.id },
        });
        validDocIds.push(doc.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errorLogger.error(`[BatchService] Failed to download image for doc ${doc.id}: ${msg}`);
      }
    }

    if (inlinedRequests.length === 0) {
      throw new Error("No valid documents for extraction batch");
    }

    const batchJob = await client.batches.create({
      model,
      src: inlinedRequests as any,
      config: { displayName: `ext-${model}-${Date.now()}` },
    });

    infoLogger.info(
      `[BatchService] Created extraction batch ${batchJob.name} (${validDocIds.length} docs, model=${model})`
    );
    return { geminiJobName: batchJob.name!, documentIds: validDocIds };
  }


  static async checkStatus(jobName: string) {
    return await client.batches.get({ name: jobName });
  }

  static isTerminal(state: string): boolean {
    return TERMINAL_STATES.has(state as JobState);
  }


  static async processClassificationResults(
    geminiJobName: string,
    documentIds: string[]
  ): Promise<{ documentId: string; success: boolean; error?: string }[]> {
    const job = await client.batches.get({ name: geminiJobName });

    if (job.state !== JobState.JOB_STATE_SUCCEEDED) {
      throw new Error(`Batch job ${geminiJobName} not succeeded: ${job.state}`);
    }

    const results: { documentId: string; success: boolean; error?: string }[] = [];
    const responses = job.dest?.inlinedResponses ?? [];

    const responseByDocId = new Map<string, (typeof responses)[number]>();
    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i]!;
      const docId = (resp as any).metadata?.documentId ?? documentIds[i];
      if (docId) responseByDocId.set(docId, resp);
    }

    for (const docId of documentIds) {
      const resp = responseByDocId.get(docId);
      if (!resp) {
        await docDB.updateDocumentStatus(docId, "failed", "No response in batch results");
        results.push({ documentId: docId, success: false, error: "No response in batch results" });
        continue;
      }

      if ((resp as any).error) {
        const errorMsg = (resp as any).error.message ?? "Batch request failed";
        await docDB.updateDocumentStatus(docId, "failed", errorMsg);
        results.push({
          documentId: docId,
          success: false,
          error: errorMsg,
        });
        continue;
      }

      try {
        const text = resp.response?.text;
        if (!text) throw new Error("Empty response text");

        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const item = Array.isArray(parsed) ? parsed[0] : parsed;

        const classification = item.classification as DocumentClassification;
        const classResult: ClassificationResult = {
          classification,
          confidence: item.confidence,
          assigned_model: (
            classification === "handwritten" || classification === "mixed"
              ? modelConstants.GEMINI_PRO
              : modelConstants.GEMINI_FLASH
          ) as AssignedModel,
        };

        await docDB.updateDocumentClassification(docId, classResult);
        results.push({ documentId: docId, success: true });
        infoLogger.info(
          `[BatchService] Classified doc ${docId}: ${classification} (confidence: ${item.confidence})`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await docDB.updateDocumentStatus(docId, "failed", msg);
        results.push({ documentId: docId, success: false, error: msg });
        errorLogger.error(`[BatchService] Failed to process classification for doc ${docId}: ${msg}`);
      }
    }

    return results;
  }

  static async processExtractionResults(
    geminiJobName: string,
    documentIds: string[]
  ): Promise<{ documentId: string; success: boolean; error?: string }[]> {
    const job = await client.batches.get({ name: geminiJobName });

    if (job.state !== JobState.JOB_STATE_SUCCEEDED) {
      throw new Error(`Batch job ${geminiJobName} not succeeded: ${job.state}`);
    }

    const results: { documentId: string; success: boolean; error?: string }[] = [];
    const responses = job.dest?.inlinedResponses ?? [];

    const responseByDocId = new Map<string, (typeof responses)[number]>();
    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i]!;
      const docId = (resp as any).metadata?.documentId ?? documentIds[i];
      if (docId) responseByDocId.set(docId, resp);
    }

    for (const docId of documentIds) {
      const resp = responseByDocId.get(docId);
      if (!resp) {
        await docDB.updateDocumentStatus(docId, "failed", "No response in batch results");
        results.push({ documentId: docId, success: false, error: "No response in batch results" });
        continue;
      }

      if ((resp as any).error) {
        const errorMsg = (resp as any).error.message ?? "Batch request failed";
        await docDB.updateDocumentStatus(docId, "failed", errorMsg);
        results.push({
          documentId: docId,
          success: false,
          error: errorMsg,
        });
        continue;
      }

      try {
        const text = resp.response?.text;
        if (!text) throw new Error("Empty response text");

        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const extraction = Array.isArray(parsed) ? parsed[0] : parsed;

        // Flatten the data structure: spread fields at top level, add metadata with prefix
        const extractionResult: ExtractionResult = {
          documentId: docId,
          extractedData: {
            ...extraction.fields,
            _metadata_document_type: extraction.metadata?.document_type ?? null,
            _metadata_document_subtype: extraction.metadata?.document_subtype ?? null,
            _metadata_date: extraction.metadata?.date ?? null,
            _metadata_has_handwriting: extraction.metadata?.has_handwriting ?? false,
            _metadata_quality_notes: extraction.metadata?.quality_notes ?? null,
          },
          confidence: extraction.confidence ?? 0,
          fieldConfidences: extraction.field_confidences ?? {},
        };

        await docDB.updateDocumentExtraction(docId, extractionResult);
        results.push({ documentId: docId, success: true });
        infoLogger.info(
          `[BatchService] Extracted doc ${docId} (confidence: ${extractionResult.confidence})`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await docDB.updateDocumentStatus(docId, "failed", msg);
        results.push({ documentId: docId, success: false, error: msg });
        errorLogger.error(`[BatchService] Failed to process extraction for doc ${docId}: ${msg}`);
      }
    }

    return results;
  }
}
