import { useState, useEffect, useRef, useCallback } from "react";
import { getLotStatus } from "../api/client.ts";
import type { LotStatus } from "../types/index.ts";

const TERMINAL_STATUSES = ["completed", "failed", "partial_failure"];
const POLL_INTERVAL = 3000;

export function useLotPolling(lotId: string | null) {
  const [status, setStatus] = useState<LotStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!lotId) {
      stopPolling();
      setStatus(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getLotStatus(lotId);
        if (cancelled) return;
        setStatus(data);
        setError(null);
        if (TERMINAL_STATUSES.includes(data.status)) {
          stopPolling();
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Polling failed");
      }
    };

    setIsPolling(true);
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [lotId, stopPolling]);

  return { status, isPolling, error };
}
