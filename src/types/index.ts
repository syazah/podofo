export interface LotRow {
  id: string;
  total_files: number;
  status: string;
  processed_files: string[];
  failed_files: string[];
  created_at: string;
  updated_at: string;
}

export interface SourcePdfRow {
  id: string;
  lot_id: string;
  original_filename: string;
  storage_path: string;
  file_size: number;
  file_hash: string;
  page_count: number;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  lot_id: string;
  source_pdf_id: string;
  storage_path: string | null;
  file_size: number;
  file_hash: string | null;
  page_number: number;
  status: string;
  classification: string | null;
  assigned_model: string | null;
  extracted_data: Record<string, unknown> | null;
  confidence: number | null;
  field_confidences: Record<string, number> | null;
  cost_data: Record<string, unknown> | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  updated_at: string;
}
