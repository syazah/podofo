import { getExportUrl } from "../api/client.ts";

interface Props {
  lotId: string;
}

export default function ExportBar({ lotId }: Props) {
  return (
    <div className="flex gap-2">
      <a
        href={getExportUrl(lotId, "csv")}
        download
        className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Export CSV
      </a>
      <a
        href={getExportUrl(lotId, "json")}
        download
        className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Export JSON
      </a>
    </div>
  );
}
