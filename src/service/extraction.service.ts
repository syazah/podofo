import { createPartFromBase64 } from "@google/genai";
import { S3Storage } from "../data/storage.data.js";
import { getExtractionPrompt } from "../prompts/extractionPrompt.js";
import { AppLogger } from "../config/logger.js";
import { AI } from "./ai.service.js";
import { GeminiClient } from "../config/gemini/client.js";
import { modelConstants } from "../config/constants.js";
import type { ExtractionResult } from "../types/extraction.js";
import type { DocumentRow } from "../types/index.js";
import { DocumentDB } from "../data/document.data.js";

const GEMINI_BATCH_SIZE = 5;
const DEFAULT_MODEL = modelConstants.GEMINI_FLASH;
const docDB = DocumentDB.getInstance();
interface ParsedExtraction {
  documentId: string;
  fields: Record<string, unknown>;
  metadata: Record<string, unknown>;
  confidence: number;
  field_confidences: Record<string, number>;
}

function parseExtractions(text: string, expectedCount: number): ParsedExtraction[] {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as ParsedExtraction[];

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini response is not an array");
  }

  if (parsed.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} extractions, got ${parsed.length}`);
  }

  return parsed;
}

const s3Storage = S3Storage.getInstance();
const infoLogger = AppLogger.getInfoLogger();
const errorLogger = AppLogger.getErrorLogger();
const ai = new AI(GeminiClient.getGeminiClient());

export async function extractDocumentBatch(documents: { docId: string; documentPart: ReturnType<typeof createPartFromBase64>, doc: DocumentRow }[]) {
  const results: { documentId: string; success: boolean; error?: string }[] = [];

  const extractable: { docId: string; documentPart: ReturnType<typeof createPartFromBase64>, doc: DocumentRow }[] = documents;

  const downloaded: { doc: DocumentRow; imagePart: ReturnType<typeof createPartFromBase64> }[] = [];
  for (const doc of extractable) {
    try {
      const imagePart = doc.documentPart;
      downloaded.push({ doc: doc.doc, imagePart });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ documentId: doc.doc.id, success: false, error: message });
      errorLogger.error(`Failed to download image for document ${doc.doc.id}: ${message}`);
    }
  }

  if (downloaded.length === 0) return results;

  const byModel = new Map<string, { doc: DocumentRow; imagePart: ReturnType<typeof createPartFromBase64> }[]>();
  for (const item of downloaded) {
    const model = item.doc.assigned_model ?? DEFAULT_MODEL;
    const group = byModel.get(model);
    if (group) {
      group.push(item);
    } else {
      byModel.set(model, [item]);
    }
  }


  for (const [model, items] of byModel) {
    for (let i = 0; i < items.length; i += GEMINI_BATCH_SIZE) {
      const chunk = items.slice(i, i + GEMINI_BATCH_SIZE);
      const chunkResults = await extractChunk(chunk, model);
      results.push(...chunkResults);
    }
  }

  return results;
}

async function extractChunk(
  chunk: { doc: DocumentRow; imagePart: ReturnType<typeof createPartFromBase64> }[],
  model: string
): Promise<{ documentId: string; success: boolean; error?: string }[]> {
  const results: { documentId: string; success: boolean; error?: string }[] = [];

  // Interleave docId labels with image parts, then the prompt
  const contentParts: (string | ReturnType<typeof createPartFromBase64>)[] = [];
  for (const { doc, imagePart } of chunk) {
    contentParts.push(`Document ID: ${doc.id}`);
    contentParts.push(imagePart);
  }
  contentParts.push(getExtractionPrompt(chunk.length));

  try {
    const response = await ai.sendMessage({
      model,
      contents: contentParts,
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    const extractions = parseExtractions(text, chunk.length);

    // Match by documentId from Gemini response
    const extractionMap = new Map(
      extractions.map((e) => [e.documentId, e])
    );

    for (const { doc } of chunk) {
      const parsed = extractionMap.get(doc.id);
      if (!parsed) {
        results.push({ documentId: doc.id, success: false, error: "No extraction returned for this document" });
        continue;
      }

      // Flatten the data structure: spread fields at top level, add metadata with prefix
      const extractionResult: ExtractionResult = {
        documentId: doc.id,
        extractedData: {
          ...parsed.fields,
          _metadata_document_type: parsed.metadata?.document_type ?? null,
          _metadata_document_subtype: parsed.metadata?.document_subtype ?? null,
          _metadata_date: parsed.metadata?.date ?? null,
          _metadata_has_handwriting: parsed.metadata?.has_handwriting ?? false,
          _metadata_quality_notes: parsed.metadata?.quality_notes ?? null,
        },
        confidence: parsed.confidence,
        fieldConfidences: parsed.field_confidences ?? {},
      };

      try {
        await docDB.updateDocumentExtraction(doc.id, extractionResult);
        results.push({ documentId: doc.id, success: true });
        infoLogger.info(
          `Extracted document ${doc.id} via ${model} (confidence: ${parsed.confidence})`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ documentId: doc.id, success: false, error: message });
        errorLogger.error(`Failed to update extraction for document ${doc.id}: ${message}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorLogger.error(`Gemini extraction failed (${model}): ${message}`);
    for (const { doc } of chunk) {
      results.push({ documentId: doc.id, success: false, error: message });
    }
  }

  return results;
}
