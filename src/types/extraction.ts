export interface ExtractionResult {
    documentId: string;
    extractedData: Record<string, unknown>;
    confidence: number;
    fieldConfidences: Record<string, number>;
}

export interface ExtractionJobData {
    lotId: string;
    documentIds: string[];
}
