import type { LotSummary } from "../types/index.ts";

interface Props {
  lots: LotSummary[];
  selectedId: string | null;
  onChange: (id: string) => void;
  isLoading: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
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
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 min-w-[280px]"
      >
        <option value="" disabled>
          {isLoading ? "Loading..." : `Select a lot (${lots.length} available)`}
        </option>
        {lots.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.id.slice(0, 8)}... | {lot.total_files} pages | {lot.status} | {formatDate(lot.created_at)}
          </option>
        ))}
      </select>
    </div>
  );
}
