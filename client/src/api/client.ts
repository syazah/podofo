import type { UploadResponse, LotStatus, LotSummary, PaginatedDocuments } from "../types/index.ts";

const BASE = "/api/v1";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function uploadPdfs(files: File[]): Promise<UploadResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("pdfs", file);
  }
  return request<UploadResponse>("/upload/pdfs", { method: "POST", body: form });
}

export function getLotStatus(lotId: string): Promise<LotStatus> {
  return request<LotStatus>(`/lot/${lotId}/status`);
}

export function getLots(): Promise<LotSummary[]> {
  return request<LotSummary[]>("/lots");
}

export function getLotDocuments(
  lotId: string,
  page: number,
  limit: number
): Promise<PaginatedDocuments> {
  return request<PaginatedDocuments>(
    `/lot/${lotId}/documents?page=${page}&limit=${limit}`
  );
}

export function getExportUrl(lotId: string, format: "csv" | "json"): string {
  return `${BASE}/lot/${lotId}/export/${format}`;
}
