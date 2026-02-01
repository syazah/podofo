import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LotSelector from "../components/LotSelector.tsx";
import DataTable from "../components/DataTable.tsx";
import ExportBar from "../components/ExportBar.tsx";
import EmptyState from "../components/EmptyState.tsx";
import LotStatsPanel from "../components/LotStatsPanel.tsx";
import { useLots } from "../hooks/useLots.ts";
import { useDocuments } from "../hooks/useDocuments.ts";

export default function DataPage() {
  const { lotId: paramLotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { lots, isLoading: lotsLoading, refetch: refetchLots } = useLots();

  const [selectedLotId, setSelectedLotId] = useState<string | null>(
    paramLotId ?? null
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    if (paramLotId) setSelectedLotId(paramLotId);
  }, [paramLotId]);

  const { documents, total, isLoading: docsLoading, refetch: refetchDocs } = useDocuments(
    selectedLotId,
    page,
    limit
  );

  const handleLotChange = (id: string) => {
    setSelectedLotId(id);
    setPage(1);
    navigate(`/data/${id}`, { replace: true });
  };

  const handleRefresh = () => {
    refetchLots();
    refetchDocs();
  };

  const selectedLot = lots.find((l) => l.id === selectedLotId);

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <LotSelector
            lots={lots}
            selectedId={selectedLotId}
            onChange={handleLotChange}
            isLoading={lotsLoading}
          />
          {selectedLot && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedLot.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : selectedLot.status === "failed"
                    ? "bg-red-100 text-red-800"
                    : selectedLot.status === "partial_failure"
                      ? "bg-orange-100 text-orange-800"
                      : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {selectedLot.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedLotId && (
            <button
              onClick={handleRefresh}
              disabled={docsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-4 h-4 ${docsLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
          {selectedLotId && <ExportBar lotId={selectedLotId} />}
        </div>
      </div>

      {!selectedLotId ? (
        <EmptyState
          message="No lot selected"
          sub="Choose a lot from the dropdown to view extracted data."
        />
      ) : documents.length === 0 && !docsLoading ? (
        <EmptyState
          message="No documents found"
          sub="This lot has no processed documents yet."
        />
      ) : (
        <>
          {/* Stats Panel */}
          {selectedLot && documents.length > 0 && (
            <LotStatsPanel
              lot={selectedLot}
              documents={documents}
              total={total}
            />
          )}

          {/* Data Table */}
          <DataTable
            data={documents}
            total={total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
            isLoading={docsLoading}
          />
        </>
      )}
    </div>
  );
}
