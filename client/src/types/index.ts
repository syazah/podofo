export interface UploadResponse {
  lot_id: string;
  status: string;
  total: number;
  uploaded: number;
  failed: number;
  documents: { id: string; source_pdf_id: string; page_number: number }[];
  errors: { filename: string; error: string }[];
}

export interface LotStatus {
  lotId: string;
  status: string;
  progress: {
    total: number;
    classified: number;
    extracted: number;
    failed: number;
  };
  documents: {
    id: string;
    status: string;
    page_number: number;
    classification: string | null;
    confidence: number | null;
    assigned_model: string | null;
  }[];
}

export interface LotSummary {
  id: string;
  total_files: number;
  status: string;
  created_at: string;
}

export interface DocumentWithExtraction {
  id: string;
  lot_id: string;
  source_pdf_id: string;
  page_number: number;
  status: string;
  classification: string | null;
  assigned_model: string | null;
  extracted_data: Record<string, unknown> | null;
  confidence: number | null;
  field_confidences: Record<string, number> | null;
  error_message: string | null;
}

export interface PaginatedDocuments {
  documents: DocumentWithExtraction[];
  total: number;
  page: number;
  limit: number;
}
