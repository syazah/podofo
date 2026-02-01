import { supabaseAdmin } from "../config/supabase/client.js";
import type { ClassificationResult } from "../types/classification.js";
import type { ExtractionResult } from "../types/extraction.js";
import type { DocumentRow } from "../types/index.js";

// All columns except image_base64 — used for queries that don't need the image data
const DOC_COLUMNS = "id, lot_id, source_pdf_id, storage_path, file_size, file_hash, page_number, status, classification, assigned_model, extracted_data, confidence, field_confidences, cost_data, error_message, processing_time_ms, created_at, updated_at";

export const createDocument = async (doc: {
  lot_id: string;
  source_pdf_id: string;
  storage_path: string | null;
  file_size: number;
  file_hash: string;
  page_number: number;
  image_base64: string;
}) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert(doc)
    .select(DOC_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to create document: ${error.message}`);
  return data as DocumentRow;
};

export const getDocumentsByLotId = async (lotId: string) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(DOC_COLUMNS)
    .eq("lot_id", lotId);

  if (error) throw new Error(`Failed to fetch documents for lot ${lotId}: ${error.message}`);
  return data as DocumentRow[];
};

export const getDocumentsWithImageByLotId = async (lotId: string) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select()
    .eq("lot_id", lotId);

  if (error) throw new Error(`Failed to fetch documents with images for lot ${lotId}: ${error.message}`);
  return data as DocumentRow[];
};

export const getDocumentImagesByIds = async (
  ids: string[]
): Promise<Map<string, string>> => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, image_base64")
    .in("id", ids);

  if (error) throw new Error(`Failed to fetch document images: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data as { id: string; image_base64: string | null }[]) {
    if (row.image_base64) {
      map.set(row.id, row.image_base64);
    }
  }
  return map;
};

export const getDocumentsByLotIdPaginated = async (
  lotId: string,
  page: number,
  limit: number
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("documents")
    .select(DOC_COLUMNS, { count: "exact" })
    .eq("lot_id", lotId)
    .order("page_number", { ascending: true })
    .range(from, to);

  if (error)
    throw new Error(`Failed to fetch documents for lot ${lotId}: ${error.message}`);
  return { documents: data as DocumentRow[], total: count ?? 0 };
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
    .select(DOC_COLUMNS)
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
    .select(DOC_COLUMNS)
    .single();

  if (error)
    throw new Error(`Failed to update extraction for document ${documentId}: ${error.message}`);
  return data as DocumentRow;
};
