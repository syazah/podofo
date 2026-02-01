import { createPartFromBase64 } from "@google/genai";
import { GeminiClient } from "../config/gemini/client.js";
import { updateDocumentClassification, getDocumentImagesByIds } from "../data/document.data.js";
import { getImageClassificationPrompt } from "../prompts/classificationPrompts.js";
import type { AssignedModel, ClassificationResult, DocumentClassification } from "../types/classification.js";
import type { DocumentRow } from "../types/index.js";
import { modelConstants, projectConstants } from "../config/constants.js";
import { AppLogger } from "../config/logger.js";
import { AI } from "./ai.service.js";

const GEMINI_BATCH_SIZE = 25;

export class ClassificationService {
  private assignedModel: string;
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

    // Fetch base64 image data from DB in one batch query
    const docIds = documents.map((d) => d.id);
    const imageMap = await getDocumentImagesByIds(docIds);

    const ready: { doc: DocumentRow; base64: string }[] = [];

    for (const doc of documents) {
      const base64 = imageMap.get(doc.id);
      if (!base64) {
        results.push({ documentId: doc.id, success: false, error: "No image data found" });
        continue;
      }
      ready.push({ doc, base64 });
    }

    if (ready.length === 0) return results;

    // Process in sub-batches to stay within Gemini rate limits
    for (let i = 0; i < ready.length; i += GEMINI_BATCH_SIZE) {
      const chunk = ready.slice(i, i + GEMINI_BATCH_SIZE);
      const chunkResults = await this.classify(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  private async classify(
    chunk: { doc: DocumentRow; base64: string }[]
  ): Promise<{ documentId: string; success: boolean; error?: string }[]> {
    const results: { documentId: string; success: boolean; error?: string }[] = [];

    // Build contents: interleave docId labels with image parts, then the prompt
    const contentParts: (string | ReturnType<typeof createPartFromBase64>)[] = [];
    for (const { doc, base64 } of chunk) {
      contentParts.push(`Document ID: ${doc.id}`);
      const part = createPartFromBase64(base64, "image/png");
      contentParts.push(part);
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
          results.push({ documentId: doc.id, success: false, error: "No classification returned for this document" });
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
          results.push({ documentId: doc.id, success: true });
          this.infoLogger.info(
            `Classified document ${doc.id}: ${classification} (confidence: ${parsed.confidence})`
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ documentId: doc.id, success: false, error: message });
          this.errorLogger.error(`Failed to update classification for document ${doc.id}: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.errorLogger.error(`Gemini batch classification failed: ${message}`);
      for (const { doc } of chunk) {
        results.push({ documentId: doc.id, success: false, error: message });
      }
    }

    return results;
  }
}
