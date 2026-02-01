import type { LotSummary } from "../types/index.ts";

interface Props {
  lots: LotSummary[];
  selectedId: string | null;
  onChange: (id: string) => void;
  isLoading: boolean;
}

export default function LotSelector({
  lots,
  selectedId,
  onChange,
  isLoading,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="lot-select" className="text-sm font-medium text-gray-700">
        Lot:
      </label>
      <select
        id="lot-select"
        value={selectedId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
      >
        <option value="" disabled>
          {isLoading ? "Loading..." : "Select a lot"}
        </option>
        {lots.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.id.slice(0, 8)}... — {lot.total_files} files — {lot.status}
          </option>
        ))}
      </select>
    </div>
  );
}
