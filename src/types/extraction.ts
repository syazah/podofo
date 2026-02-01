import type { createPartFromBase64 } from "@google/genai";
import type { DocumentRow } from "./index.js";

export interface ExtractionResult {
    documentId: string;
    extractedData: Record<string, unknown>;
    confidence: number;
    fieldConfidences: Record<string, number>;
}

export interface ExtractionJobData {
    lotId: string;
    documents: { docId: string; documentPart: ReturnType<typeof createPartFromBase64>, doc: DocumentRow }[];
}
