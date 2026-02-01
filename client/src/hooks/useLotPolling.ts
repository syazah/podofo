import { useState, useEffect, useRef, useCallback } from "react";
import { getLotStatus } from "../api/client.ts";
import type { LotStatus } from "../types/index.ts";

const TERMINAL_STATUSES = ["completed", "failed", "partial_failure"];
const POLL_INTERVAL = 1500;

export function useLotPolling(lotId: string | null) {
  const [status, setStatus] = useState<LotStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const fetchStatus = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!lotId) return;
      try {
        const data = await getLotStatus(lotId);
        if (signal?.cancelled) return;
        setStatus(data);
        setError(null);
        setLastUpdated(new Date());
        if (TERMINAL_STATUSES.includes(data.status)) {
          stopPolling();
        }
      } catch (err) {
        if (signal?.cancelled) return;
        setError(err instanceof Error ? err.message : "Polling failed");
      }
    },
    [lotId, stopPolling]
  );

  // Manual refresh
  const refresh = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!lotId) {
      stopPolling();
      setStatus(null);
      setError(null);
      setLastUpdated(null);
      return;
    }

    const signal = { cancelled: false };

    setIsPolling(true);
    fetchStatus(signal);
    intervalRef.current = setInterval(() => fetchStatus(signal), POLL_INTERVAL);

    return () => {
      signal.cancelled = true;
      stopPolling();
    };
  }, [lotId, stopPolling, fetchStatus]);

  return { status, isPolling, error, refresh, lastUpdated };
}
