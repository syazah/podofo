import { supabaseAdmin } from "../config/supabase/client.js";
import type { SourcePdfRow } from "../types/index.js";

export class SourcePDFDB {
  private static instance: SourcePDFDB
  private constructor() { }

  public static getInstance() {
    if (!SourcePDFDB.instance) {
      SourcePDFDB.instance = new SourcePDFDB()
    }
    return SourcePDFDB.instance
  }

  createSourcePdf = async (doc: {
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

  getSourcePdfsByLotId = async (lotId: string) => {
    const { data, error } = await supabaseAdmin
      .from("source_pdfs")
      .select()
      .eq("lot_id", lotId);

    if (error) throw new Error(`Failed to fetch source_pdfs for lot ${lotId}: ${error.message}`);
    return data as SourcePdfRow[];
  }
}

