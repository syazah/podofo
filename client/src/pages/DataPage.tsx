import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LotSelector from "../components/LotSelector.tsx";
import DataTable from "../components/DataTable.tsx";
import ExportBar from "../components/ExportBar.tsx";
import EmptyState from "../components/EmptyState.tsx";
import { useLots } from "../hooks/useLots.ts";
import { useDocuments } from "../hooks/useDocuments.ts";

export default function DataPage() {
  const { lotId: paramLotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { lots, isLoading: lotsLoading } = useLots();

  const [selectedLotId, setSelectedLotId] = useState<string | null>(
    paramLotId ?? null
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    if (paramLotId) setSelectedLotId(paramLotId);
  }, [paramLotId]);

  const { documents, total, isLoading: docsLoading } = useDocuments(
    selectedLotId,
    page,
    limit
  );

  const handleLotChange = (id: string) => {
    setSelectedLotId(id);
    setPage(1);
    navigate(`/data/${id}`, { replace: true });
  };

  const selectedLot = lots.find((l) => l.id === selectedLotId);

  return (
    <div>
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
                    : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {selectedLot.status}
            </span>
          )}
        </div>
        {selectedLotId && <ExportBar lotId={selectedLotId} />}
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
        <DataTable
          data={documents}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          isLoading={docsLoading}
        />
      )}
    </div>
  );
}
