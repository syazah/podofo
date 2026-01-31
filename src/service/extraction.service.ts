import { createPartFromBase64 } from "@google/genai";
import { GeminiClient } from "../config/gemini/client.js";
import { downloadImage } from "./classifier.service.js";
import { updateDocumentExtraction } from "../data/document.data.js";
import { getExtractionPrompt } from "../prompts/extractionPrompt.js";
import type { ExtractionResult } from "../types/extraction.js";
import type { DocumentRow } from "../types/index.js";

const GEMINI_BATCH_SIZE = 5;
const DEFAULT_MODEL = "gemini-2.5-flash";

interface ParsedExtraction {
  documentId: string;
  fields: Record<string, unknown>;
  tables: unknown[];
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

export async function extractDocumentBatch(documents: DocumentRow[]) {
  const results: { documentId: string; success: boolean; error?: string }[] = [];

  // Filter documents that have storage paths and are classified
  const extractable: DocumentRow[] = [];
  for (const doc of documents) {
    if (!doc.storage_path) {
      results.push({ documentId: doc.id, success: false, error: "No storage path" });
    } else if (!doc.assigned_model) {
      results.push({ documentId: doc.id, success: false, error: "Not classified yet — no assigned model" });
    } else {
      extractable.push(doc);
    }
  }

  if (extractable.length === 0) return results;

  // Download all images
  const downloaded: { doc: DocumentRow; buffer: Buffer }[] = [];
  for (const doc of extractable) {
    try {
      const buffer = await downloadImage(doc.storage_path!);
      downloaded.push({ doc, buffer });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ documentId: doc.id, success: false, error: message });
      console.error(`Failed to download image for document ${doc.id}: ${message}`);
    }
  }

  if (downloaded.length === 0) return results;

  // Group by assigned model for smart routing
  const byModel = new Map<string, { doc: DocumentRow; buffer: Buffer }[]>();
  for (const item of downloaded) {
    const model = item.doc.assigned_model ?? DEFAULT_MODEL;
    const group = byModel.get(model);
    if (group) {
      group.push(item);
    } else {
      byModel.set(model, [item]);
    }
  }

  // Process each model group in sub-batches
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
  chunk: { doc: DocumentRow; buffer: Buffer }[],
  model: string
): Promise<{ documentId: string; success: boolean; error?: string }[]> {
  const results: { documentId: string; success: boolean; error?: string }[] = [];
  const ai = GeminiClient.getGeminiClient();

  const imageParts = chunk.map(({ buffer }) =>
    createPartFromBase64(buffer.toString("base64"), "image/png")
  );
  const prompt = getExtractionPrompt(chunk.length);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [...imageParts, prompt],
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    const extractions = parseExtractions(text, chunk.length);

    for (let i = 0; i < chunk.length; i++) {
      const { doc } = chunk[i]!;
      const parsed = extractions[i]!;

      const extractionResult: ExtractionResult = {
        documentId: doc.id,
        extractedData: {
          fields: parsed.fields,
          tables: parsed.tables,
          metadata: parsed.metadata,
        },
        confidence: parsed.confidence,
        fieldConfidences: parsed.field_confidences ?? {},
      };

      try {
        await updateDocumentExtraction(doc.id, extractionResult);
        results.push({ documentId: doc.id, success: true });
        console.log(
          `Extracted document ${doc.id} via ${model} (confidence: ${parsed.confidence})`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ documentId: doc.id, success: false, error: message });
        console.error(`Failed to update extraction for document ${doc.id}: ${message}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Gemini extraction failed (${model}): ${message}`);
    for (const { doc } of chunk) {
      results.push({ documentId: doc.id, success: false, error: message });
    }
  }

  return results;
}
