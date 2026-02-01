import { useState, useEffect, useCallback } from "react";
import { getLotDocuments } from "../api/client.ts";
import type { DocumentWithExtraction } from "../types/index.ts";

export function useDocuments(lotId: string | null, page: number, limit: number) {
  const [documents, setDocuments] = useState<DocumentWithExtraction[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!lotId) {
      setDocuments([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    try {
      const data = await getLotDocuments(lotId, page, limit);
      setDocuments(data.documents);
      setTotal(data.total);
    } catch {
      setDocuments([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [lotId, page, limit]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  return { documents, total, isLoading, refetch: fetchDocs };
}
