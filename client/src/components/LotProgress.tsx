import { Link } from "react-router-dom";
import { useLotPolling } from "../hooks/useLotPolling.ts";

interface Props {
  lotId: string;
}

const STATUS_LABELS: Record<string, string> = {
  uploading: "Uploading",
  classifying: "Classifying",
  extracting: "Extracting",
  completed: "Completed",
  failed: "Failed",
  partial_failure: "Partial Failure",
};

const STATUS_COLORS: Record<string, string> = {
  uploading: "bg-blue-100 text-blue-800",
  classifying: "bg-yellow-100 text-yellow-800",
  extracting: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  partial_failure: "bg-orange-100 text-orange-800",
};

export default function LotProgress({ lotId }: Props) {
  const { status, isPolling, error } = useLotPolling(lotId);

  if (error) {
    return (
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        Error: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="animate-pulse flex items-center gap-2 text-sm text-gray-500">
          <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />
          Loading status...
        </div>
      </div>
    );
  }

  const { progress } = status;
  const processed = progress.extracted + progress.failed;
  const pct = progress.total > 0 ? Math.round((processed / progress.total) * 100) : 0;
  const isTerminal = ["completed", "failed", "partial_failure"].includes(status.status);

  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Lot {lotId.slice(0, 8)}...
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              STATUS_COLORS[status.status] ?? "bg-gray-100 text-gray-800"
            }`}
          >
            {STATUS_LABELS[status.status] ?? status.status}
          </span>
          {isPolling && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
        {isTerminal && (
          <Link
            to={`/data/${lotId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            View Results &rarr;
          </Link>
        )}
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            isTerminal
              ? status.status === "completed"
                ? "bg-green-500"
                : "bg-red-500"
              : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {processed}/{progress.total} processed ({pct}%)
        </span>
        <span>
          {progress.classified} classified &middot; {progress.extracted} extracted
          {progress.failed > 0 && (
            <span className="text-red-500"> &middot; {progress.failed} failed</span>
          )}
        </span>
      </div>
    </div>
  );
}
