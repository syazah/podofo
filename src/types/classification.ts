export type DocumentClassification = "handwritten" | "typed" | "mixed";

export type AssignedModel = "gemini-2.5-pro" | "gemini-2.5-flash";

export interface ClassificationResult {
    classification: DocumentClassification;
    confidence: number;
    assigned_model: AssignedModel;
}

export interface ClassificationJobData {
    lotId: string;
    documents: import("./index.js").DocumentRow[];
}
