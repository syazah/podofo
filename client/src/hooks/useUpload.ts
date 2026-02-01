import { useState, useCallback } from "react";
import { uploadPdfs } from "../api/client.ts";
import type { UploadResponse } from "../types/index.ts";

export function useUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const pdfs = newFiles.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setFiles((prev) => [...prev, ...pdfs]);
    setError(null);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const upload = useCallback(async (): Promise<UploadResponse | null> => {
    if (files.length === 0) return null;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadPdfs(files);
      setFiles([]);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [files]);

  return { files, addFiles, removeFile, clearFiles, upload, isUploading, error };
}
