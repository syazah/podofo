import { supabaseAdmin } from "../config/supabase/client.js";
import type { ClassificationResult } from "../types/classification.js";
import type { ExtractionResult } from "../types/extraction.js";
import type { DocumentRow } from "../types/index.js";

export const createDocument = async (doc: {
  lot_id: string;
  source_pdf_id: string;
  storage_path: string;
  file_size: number;
  file_hash: string;
  page_number: number;
}) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert(doc)
    .select()
    .single();

  if (error) throw new Error(`Failed to create document: ${error.message}`);
  return data as DocumentRow;
};

export const getDocumentsByLotId = async (lotId: string) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select()
    .eq("lot_id", lotId);

  if (error) throw new Error(`Failed to fetch documents for lot ${lotId}: ${error.message}`);
  return data as DocumentRow[];
};

export const updateDocumentClassification = async (
  documentId: string,
  result: ClassificationResult
) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({
      classification: result.classification,
      assigned_model: result.assigned_model,
      confidence: result.confidence,
      status: "classified",
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error)
    throw new Error(`Failed to update classification for document ${documentId}: ${error.message}`);
  return data as DocumentRow;
};

export const getDocumentCountsByStatus = async (lotId: string) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("status")
    .eq("lot_id", lotId);

  if (error)
    throw new Error(`Failed to fetch document counts for lot ${lotId}: ${error.message}`);

  const docs = data as { status: string }[];
  return {
    total: docs.length,
    classified: docs.filter((d) => d.status === "classified").length,
    extracted: docs.filter((d) => d.status === "extracted").length,
    failed: docs.filter((d) => d.status === "failed").length,
    pending: docs.filter((d) => d.status === "pending").length,
  };
};

export const updateDocumentExtraction = async (
  documentId: string,
  result: ExtractionResult
) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({
      extracted_data: result.extractedData,
      confidence: result.confidence,
      field_confidences: result.fieldConfidences,
      status: "extracted",
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error)
    throw new Error(`Failed to update extraction for document ${documentId}: ${error.message}`);
  return data as DocumentRow;
};
