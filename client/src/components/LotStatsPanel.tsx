import { useMemo } from "react";
import type { DocumentWithExtraction, LotSummary } from "../types/index.ts";

interface Props {
  lot: LotSummary;
  documents: DocumentWithExtraction[];
  total: number;
}

export default function LotStatsPanel({ lot, documents, total }: Props) {
  const stats = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    const classificationCounts: Record<string, number> = {};
    const docTypeCounts: Record<string, number> = {};
    let totalConfidence = 0;
    let confCount = 0;
    let lowConfCount = 0;

    for (const doc of documents) {
      // Status counts
      statusCounts[doc.status] = (statusCounts[doc.status] ?? 0) + 1;

      // Classification counts
      if (doc.classification) {
        classificationCounts[doc.classification] = (classificationCounts[doc.classification] ?? 0) + 1;
      }

      // Document type from metadata
      const docType = doc.extracted_data ? JSON.parse(doc.extracted_data)?.document_type : null;
      if (docType && typeof docType === "string") {
        docTypeCounts[docType] = (docTypeCounts[docType] ?? 0) + 1;
      }

      // Confidence
      if (doc.confidence !== null) {
        totalConfidence += doc.confidence;
        confCount++;
        if (doc.confidence < 0.5) lowConfCount++;
      }
    }

    return {
      statusCounts,
      classificationCounts,
      docTypeCounts,
      avgConfidence: confCount > 0 ? totalConfidence / confCount : null,
      lowConfCount,
    };
  }, [documents]);

  const statusColors: Record<string, string> = {
    extracted: "bg-green-100 text-green-700",
    classified: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Lot Overview</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {lot.id.slice(0, 12)}... &middot; {total} documents &middot; Created {new Date(lot.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Average Confidence */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Avg Confidence</div>
          <div className={`text-xl font-bold ${
            stats.avgConfidence === null
              ? "text-gray-400"
              : stats.avgConfidence >= 0.8
                ? "text-green-600"
                : stats.avgConfidence >= 0.5
                  ? "text-yellow-600"
                  : "text-red-600"
          }`}>
            {stats.avgConfidence !== null ? `${Math.round(stats.avgConfidence * 100)}%` : "-"}
          </div>
        </div>

        {/* Low Confidence */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Low Confidence</div>
          <div className={`text-xl font-bold ${stats.lowConfCount > 0 ? "text-red-600" : "text-gray-400"}`}>
            {stats.lowConfCount}
          </div>
        </div>

        {/* Total Pages */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Total Pages</div>
          <div className="text-xl font-bold text-gray-800">{total}</div>
        </div>

        {/* Success Rate */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Success Rate</div>
          <div className={`text-xl font-bold ${
            (statusCounts(stats, "failed") === 0) ? "text-green-600" : "text-yellow-600"
          }`}>
            {total > 0
              ? `${Math.round(((statusCounts(stats, "extracted")) / total) * 100)}%`
              : "-"
            }
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Breakdown */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">By Status</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <span
                key={status}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Classification Breakdown */}
        {Object.keys(stats.classificationCounts).length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">By Classification</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.classificationCounts).map(([cls, count]) => (
                <span
                  key={cls}
                  className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700"
                >
                  {cls}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Doc Type Breakdown */}
        {Object.keys(stats.docTypeCounts).length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">By Document Type</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.docTypeCounts).map(([type, count]) => (
                <span
                  key={type}
                  className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700"
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function statusCounts(stats: { statusCounts: Record<string, number> }, key: string): number {
  return stats.statusCounts[key] ?? 0;
}
