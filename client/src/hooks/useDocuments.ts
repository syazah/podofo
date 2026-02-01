import { useState, useEffect } from "react";
import { getLotDocuments } from "../api/client.ts";
import type { DocumentWithExtraction } from "../types/index.ts";

export function useDocuments(lotId: string | null, page: number, limit: number) {
  const [documents, setDocuments] = useState<DocumentWithExtraction[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!lotId) {
      setDocuments([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getLotDocuments(lotId, page, limit)
      .then((data) => {
        if (cancelled) return;
        setDocuments(data.documents);
        setTotal(data.total);
      })
      .catch(() => {
        if (cancelled) return;
        setDocuments([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lotId, page, limit]);

  return { documents, total, isLoading };
}
