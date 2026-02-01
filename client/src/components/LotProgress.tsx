import { useState } from "react";
import { Link } from "react-router-dom";
import { useLotPolling } from "../hooks/useLotPolling.ts";

interface Props {
  lotId: string;
}

const STATUS_LABELS: Record<string, string> = {
  uploading: "Uploading",
  classifying: "Classifying Documents",
  extracting: "Extracting Data",
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

const DOC_STATUS_ICON: Record<string, string> = {
  pending: "text-gray-400",
  classified: "text-blue-500",
  extracted: "text-green-500",
  failed: "text-red-500",
};

const STAGES = ["classifying", "extracting", "completed"];

export default function LotProgress({ lotId }: Props) {
  const { status, isPolling, error, refresh, lastUpdated } = useLotPolling(lotId);
  const [showDocs, setShowDocs] = useState(false);

  if (error) {
    return (
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <div className="flex items-center justify-between">
          <span>Error: {error}</span>
          <button
            onClick={refresh}
            className="px-3 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 rounded transition-colors"
          >
            Retry
          </button>
        </div>
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
  const isTerminal = ["completed", "failed", "partial_failure"].includes(status.status);

  // Classification progress
  const classifiedCount = progress.classified + progress.extracted;
  const classifyPct = progress.total > 0
    ? Math.round((classifiedCount / progress.total) * 100)
    : 0;

  // Extraction progress
  const extractPct = progress.total > 0
    ? Math.round((progress.extracted / progress.total) * 100)
    : 0;

  // Overall progress
  const overallPct = progress.total > 0
    ? Math.round(((progress.extracted + progress.failed) / progress.total) * 100)
    : 0;

  // Current stage index
  const stageIndex = STAGES.indexOf(status.status);

  return (
    <div className="mt-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">
            Lot {lotId.slice(0, 8)}...
          </span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              STATUS_COLORS[status.status] ?? "bg-gray-100 text-gray-800"
            }`}
          >
            {STATUS_LABELS[status.status] ?? status.status}
          </span>
          {isPolling && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {isTerminal && (
            <Link
              to={`/data/${lotId}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              View Results
            </Link>
          )}
        </div>
      </div>

      {/* Stage Pipeline */}
      <div className="flex items-center gap-1 mb-5">
        {["Classify", "Extract", "Done"].map((label, idx) => {
          const isActive = idx === stageIndex;
          const isDone = idx < stageIndex || isTerminal;
          return (
            <div key={label} className="flex items-center flex-1">
              <div
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  isDone
                    ? "bg-green-400"
                    : isActive
                      ? "bg-blue-400 animate-pulse"
                      : "bg-gray-200"
                }`}
              />
              <span
                className={`ml-2 text-xs font-medium ${
                  isDone
                    ? "text-green-600"
                    : isActive
                      ? "text-blue-600"
                      : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Bars */}
      <div className="space-y-3 mb-4">
        {/* Classification */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 font-medium">Classification</span>
            <span className="text-gray-500">{classifiedCount}/{progress.total} ({classifyPct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-blue-400 transition-all duration-500"
              style={{ width: `${classifyPct}%` }}
            />
          </div>
        </div>

        {/* Extraction */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 font-medium">Extraction</span>
            <span className="text-gray-500">{progress.extracted}/{progress.total} ({extractPct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-purple-400 transition-all duration-500"
              style={{ width: `${extractPct}%` }}
            />
          </div>
        </div>

        {/* Overall */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 font-medium">Overall</span>
            <span className="text-gray-500">{overallPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                isTerminal
                  ? status.status === "completed"
                    ? "bg-green-500"
                    : "bg-red-500"
                  : "bg-gray-700"
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-md p-2.5 text-center">
          <div className="text-lg font-semibold text-gray-800">{progress.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-blue-50 rounded-md p-2.5 text-center">
          <div className="text-lg font-semibold text-blue-700">{progress.classified}</div>
          <div className="text-xs text-blue-600">Classified</div>
        </div>
        <div className="bg-green-50 rounded-md p-2.5 text-center">
          <div className="text-lg font-semibold text-green-700">{progress.extracted}</div>
          <div className="text-xs text-green-600">Extracted</div>
        </div>
        <div className="bg-red-50 rounded-md p-2.5 text-center">
          <div className="text-lg font-semibold text-red-700">{progress.failed}</div>
          <div className="text-xs text-red-600">Failed</div>
        </div>
      </div>

      {/* Per-Document Details Toggle */}
      {status.documents && status.documents.length > 0 && (
        <div>
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showDocs ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showDocs ? "Hide" : "Show"} document details ({status.documents.length})
          </button>

          {showDocs && (
            <div className="mt-3 max-h-64 overflow-auto border border-gray-200 rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Page</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Classification</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Model</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {status.documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-700 font-medium">
                        #{doc.page_number}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1 ${DOC_STATUS_ICON[doc.status] ?? "text-gray-400"}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {doc.classification ?? "-"}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {doc.assigned_model
                          ? doc.assigned_model.includes("pro") ? "Pro" : "Flash"
                          : "-"
                        }
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {doc.confidence !== null
                          ? <span className={doc.confidence >= 0.8 ? "text-green-600" : doc.confidence >= 0.5 ? "text-yellow-600" : "text-red-600"}>
                              {Math.round(doc.confidence * 100)}%
                            </span>
                          : <span className="text-gray-400">-</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
