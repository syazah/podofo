import { supabaseAdmin } from "../config/supabase/client.js";
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
