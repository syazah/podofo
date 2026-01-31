import { createPartFromBase64 } from "@google/genai";
import { GeminiClient } from "../config/gemini/client.js";
import { supabaseAdmin } from "../config/supabase/client.js";
import { updateDocumentClassification } from "../data/document.data.js";
import { getImageClassificationPrompt } from "../prompts/classificationPrompts.js";
import type { AssignedModel, ClassificationResult, DocumentClassification } from "../types/classification.js";
import type { DocumentRow } from "../types/index.js";

const VALID_CLASSIFICATIONS = ["handwritten", "typed", "mixed"] as const;
const GEMINI_BATCH_SIZE = 10;

function getAssignedModel(classification: DocumentClassification): AssignedModel {
  return classification === "handwritten" ? "gemini-2.5-pro" : "gemini-2.5-flash";
}

export async function downloadImage(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage
    .from("pdfs")
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download image at ${storagePath}: ${error?.message ?? "no data"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function parseClassifications(
  text: string,
  expectedCount: number
): { classification: string; confidence: number }[] {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as { classification: string; confidence: number }[];

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini response is not an array");
  }

  if (parsed.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} classifications, got ${parsed.length}`
    );
  }

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]!;
    if (!VALID_CLASSIFICATIONS.includes(item.classification as DocumentClassification)) {
      throw new Error(`Invalid classification at index ${i}: ${item.classification}`);
    }
  }

  return parsed;
}

export async function classifyDocumentBatch(documents: DocumentRow[]) {
  const results: { documentId: string; success: boolean; error?: string }[] = [];
  const classifiable: { doc: DocumentRow; index: number }[] = [];
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!;
    if (!doc.storage_path) {
      results.push({ documentId: doc.id, success: false, error: "No storage path" });
    } else {
      classifiable.push({ doc, index: i });
    }
  }

  if (classifiable.length === 0) return results;

  const downloaded: { doc: DocumentRow; buffer: Buffer }[] = [];
  for (const { doc } of classifiable) {
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

  // Process in sub-batches to stay within Gemini rate limits
  for (let i = 0; i < downloaded.length; i += GEMINI_BATCH_SIZE) {
    const chunk = downloaded.slice(i, i + GEMINI_BATCH_SIZE);
    const chunkResults = await classifyChunk(chunk);
    results.push(...chunkResults);
  }

  return results;
}

async function classifyChunk(
  chunk: { doc: DocumentRow; buffer: Buffer }[]
): Promise<{ documentId: string; success: boolean; error?: string }[]> {
  const results: { documentId: string; success: boolean; error?: string }[] = [];
  const ai = GeminiClient.getGeminiClient();

  const imageParts = chunk.map(({ buffer }) =>
    createPartFromBase64(buffer.toString("base64"), "image/png")
  );
  const prompt = getImageClassificationPrompt(chunk.length);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [...imageParts, prompt],
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    const classifications = parseClassifications(text, chunk.length);

    for (let i = 0; i < chunk.length; i++) {
      const { doc } = chunk[i]!;
      const parsed = classifications[i]!;
      const classification = parsed.classification as DocumentClassification;

      const result: ClassificationResult = {
        classification,
        confidence: parsed.confidence,
        assigned_model: getAssignedModel(classification),
      };

      try {
        await updateDocumentClassification(doc.id, result);
        results.push({ documentId: doc.id, success: true });
        console.log(
          `Classified document ${doc.id}: ${classification} (confidence: ${parsed.confidence})`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ documentId: doc.id, success: false, error: message });
        console.error(`Failed to update classification for document ${doc.id}: ${message}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Gemini batch classification failed: ${message}`);
    for (const { doc } of chunk) {
      results.push({ documentId: doc.id, success: false, error: message });
    }
  }

  return results;
}
