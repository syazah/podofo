import { createPartFromBase64 } from "@google/genai";
import { GeminiClient } from "../config/gemini/client.js";
import { updateDocumentClassification } from "../data/document.data.js";
import { getImageClassificationPrompt } from "../prompts/classificationPrompts.js";
import type { AssignedModel, ClassificationResult, DocumentClassification } from "../types/classification.js";
import type { DocumentRow } from "../types/index.js";
import { modelConstants, projectConstants } from "../config/constants.js";
import { S3Storage } from "../data/storage.data.js";
import { AppLogger } from "../config/logger.js";
import { AI } from "./ai.service.js";

const GEMINI_BATCH_SIZE = 25;

export class ClassificationService {
  private assignedModel: string;
  private s3Storage = S3Storage.getInstance();
  private errorLogger = AppLogger.getErrorLogger();
  private infoLogger = AppLogger.getInfoLogger();
  private ai = new AI(GeminiClient.getGeminiClient());

  constructor(assignedModel?: string) {
    this.assignedModel = assignedModel ?? modelConstants.GEMINI_FLASH;
  }

  private parseClassifications(
    text: string,
    expectedCount: number
  ): { documentId: string; classification: string; confidence: number }[] {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { documentId: string; classification: string; confidence: number }[];

    if (!Array.isArray(parsed)) {
      throw new Error("Gemini response is not an array");
    }

    if (parsed.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} classifications, got ${parsed.length}`);
    }

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i]!;
      if (!projectConstants.VALID_CLASSIFICATIONS.includes(item.classification as DocumentClassification)) {
        throw new Error(`Invalid classification at index ${i}: ${item.classification}`);
      }
    }

    return parsed;
  }

  async classifyDocumentBatch(documents: DocumentRow[]) {
    const results: { documentId: string; success: boolean; error?: string }[] = [];
    const downloaded: { doc: DocumentRow; buffer: Buffer }[] = [];

    for (const doc of documents) {
      if (!doc.storage_path) {
        results.push({ documentId: doc.id, success: false, error: "No storage path" });
        continue;
      }
      try {
        const buffer = await this.s3Storage.downloadImage(doc.storage_path);
        downloaded.push({ doc, buffer });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ documentId: doc.id, success: false, error: message });
        this.errorLogger.error(`Failed to download image for document ${doc.id}: ${message}`);
      }
    }

    if (downloaded.length === 0) return results;

    // Process in sub-batches to stay within Gemini rate limits
    for (let i = 0; i < downloaded.length; i += GEMINI_BATCH_SIZE) {
      const chunk = downloaded.slice(i, i + GEMINI_BATCH_SIZE);
      const chunkResults = await this.classify(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  private async classify(
    chunk: { doc: DocumentRow; buffer: Buffer }[]
  ): Promise<{ documentId: string; success: boolean; error?: string, documentPart?: ReturnType<typeof createPartFromBase64> }[]> {
    const results: { documentId: string; success: boolean; error?: string, documentPart?: ReturnType<typeof createPartFromBase64>, doc: DocumentRow }[] = [];

    // Build contents: interleave docId labels with image parts, then the prompt
    const contentParts: (string | ReturnType<typeof createPartFromBase64>)[] = [];
    const documentPart: { documentId: string; part: ReturnType<typeof createPartFromBase64> }[] = [];
    for (const { doc, buffer } of chunk) {
      contentParts.push(`Document ID: ${doc.id}`);
      const part = createPartFromBase64(buffer.toString("base64"), "image/png");
      contentParts.push(part);
      documentPart.push({ documentId: doc.id, part });
    }
    contentParts.push(getImageClassificationPrompt(chunk.length));

    try {
      const response = await this.ai.sendMessage({
        model: this.assignedModel,
        contents: contentParts,
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini returned empty response");
      }

      const classifications = this.parseClassifications(text, chunk.length);

      // Build a map from documentId → classification for matching by docId
      const classificationMap = new Map(
        classifications.map((c) => [c.documentId, c])
      );

      for (const { doc } of chunk) {
        const parsed = classificationMap.get(doc.id);
        if (!parsed) {
          results.push({ documentId: doc.id, success: false, error: "No classification returned for this document", doc });
          continue;
        }

        const classification = parsed.classification as DocumentClassification;
        const result: ClassificationResult = {
          classification,
          confidence: parsed.confidence,
          assigned_model: (classification === "handwritten"
            ? modelConstants.GEMINI_PRO
            : modelConstants.GEMINI_FLASH) as AssignedModel,
        };

        try {
          await updateDocumentClassification(doc.id, result);
          const imagePart = documentPart.find(dp => dp.documentId === doc.id)?.part;
          if (!imagePart) {
            results.push({ documentId: doc.id, success: false, error: "Image part not found", doc });
            continue;
          }
          results.push({ documentId: doc.id, success: true, documentPart: imagePart, doc });
          this.infoLogger.info(
            `Classified document ${doc.id}: ${classification} (confidence: ${parsed.confidence})`
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ documentId: doc.id, success: false, error: message, doc });
          this.errorLogger.error(`Failed to update classification for document ${doc.id}: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.errorLogger.error(`Gemini batch classification failed: ${message}`);
      for (const { doc } of chunk) {
        results.push({ documentId: doc.id, success: false, error: message, doc });
      }
    }

    return results;
  }
}
