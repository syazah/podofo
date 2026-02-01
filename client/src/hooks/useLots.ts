import { useState, useEffect, useCallback } from "react";
import { getLots } from "../api/client.ts";
import type { LotSummary } from "../types/index.ts";

export function useLots() {
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getLots();
      setLots(data);
    } catch {
      // Silently fail — lots will be empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { lots, isLoading, refetch: fetch_ };
}
