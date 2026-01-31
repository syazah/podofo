import { supabaseAdmin } from "../config/supabase/client.js";
import type { SourcePdfRow } from "../types/index.js";

export const createSourcePdf = async (doc: {
  lot_id: string;
  original_filename: string;
  storage_path: string;
  file_size: number;
  file_hash: string;
  page_count: number;
}) => {
  const { data, error } = await supabaseAdmin
    .from("source_pdfs")
    .insert(doc)
    .select()
    .single();

  if (error) throw new Error(`Failed to create source_pdf: ${error.message}`);
  return data as SourcePdfRow;
};
