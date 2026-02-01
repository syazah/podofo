import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { DocumentWithExtraction } from "../types/index.ts";
import ConfidenceBadge from "./ConfidenceBadge.tsx";
import ExpandableCell from "./ExpandableCell.tsx";

interface Props {
  data: DocumentWithExtraction[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  isLoading: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

type StatusFilter = "all" | "extracted" | "classified" | "failed" | "pending";
type ConfidenceFilter = "all" | "high" | "medium" | "low";

export default function DataTable({
  data,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  isLoading,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confFilter, setConfFilter] = useState<ConfidenceFilter>("all");

  // Apply local filters
  const filteredData = useMemo(() => {
    let result = data;
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (confFilter !== "all") {
      result = result.filter((d) => {
        if (d.confidence === null) return confFilter === "low";
        if (confFilter === "high") return d.confidence >= 0.8;
        if (confFilter === "medium") return d.confidence >= 0.5 && d.confidence < 0.8;
        if (confFilter === "low") return d.confidence < 0.5;
        return true;
      });
    }
    return result;
  }, [data, statusFilter, confFilter]);

  // Count by status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of data) {
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  const columns = useMemo<ColumnDef<DocumentWithExtraction>[]>(() => {
    return [
      {
        accessorKey: "page_number",
        header: "Page #",
        size: 70,
      },
      {
        accessorKey: "source_pdf_id",
        header: "Source PDF",
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return (
            <span className="font-mono text-xs" title={val}>
              {val ? val.slice(0, 8) + "..." : "-"}
            </span>
          );
        },
        size: 110,
      },
      {
        accessorKey: "classification",
        header: "Classification",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          if (!val) return <span className="text-gray-400">-</span>;
          const colors: Record<string, string> = {
            typed: "bg-blue-50 text-blue-700",
            handwritten: "bg-amber-50 text-amber-700",
            mixed: "bg-indigo-50 text-indigo-700",
          };
          return (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[val] ?? "bg-gray-50 text-gray-700"}`}>
              {val}
            </span>
          );
        },
        size: 120,
      },
      {
        accessorKey: "assigned_model",
        header: "Model",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          if (!val) return <span className="text-gray-400">-</span>;
          const isProModel = val.includes("pro");
          return (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              isProModel ? "bg-purple-50 text-purple-700" : "bg-gray-50 text-gray-600"
            }`}>
              {isProModel ? "Pro" : "Flash"}
            </span>
          );
        },
        size: 80,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<string>();
          const colors: Record<string, string> = {
            extracted: "text-green-700 bg-green-50",
            classified: "text-blue-700 bg-blue-50",
            failed: "text-red-700 bg-red-50",
            pending: "text-gray-700 bg-gray-50",
          };
          return (
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${colors[s] ?? "text-gray-700 bg-gray-50"}`}
            >
              {s}
            </span>
          );
        },
        size: 95,
      },
      {
        accessorKey: "extracted_data",
        header: "Extracted Data",
        cell: ({ getValue }) => {
          const val = getValue<Record<string, unknown> | null>();
          return <ExpandableCell value={val} maxLength={100} />;
        },
        size: 400,
      },
      {
        accessorKey: "confidence",
        header: "Confidence",
        cell: ({ getValue }) => <ConfidenceBadge value={getValue<number | null>()} />,
        size: 95,
      },
      {
        accessorKey: "error_message",
        header: "Error",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          if (!val) return <span className="text-gray-400">-</span>;
          return (
            <span className="text-xs text-red-600 truncate block max-w-[200px]" title={val}>
              {val}
            </span>
          );
        },
        size: 150,
      },
    ];
  }, []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Filters Row */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Status:</span>
          {(["all", "extracted", "classified", "failed", "pending"] as StatusFilter[]).map((s) => {
            const count = s === "all" ? data.length : (statusCounts[s] ?? 0);
            if (s !== "all" && count === 0) return null;
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : s} ({count})
              </button>
            );
          })}
        </div>

        {/* Confidence Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Confidence:</span>
          {(["all", "high", "medium", "low"] as ConfidenceFilter[]).map((c) => {
            const isActive = confFilter === c;
            const colors: Record<string, string> = {
              all: isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600",
              high: isActive ? "bg-green-600 text-white" : "bg-green-50 text-green-700",
              medium: isActive ? "bg-yellow-500 text-white" : "bg-yellow-50 text-yellow-700",
              low: isActive ? "bg-red-600 text-white" : "bg-red-50 text-red-700",
            };
            return (
              <button
                key={c}
                onClick={() => setConfFilter(c)}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${colors[c]} hover:opacity-80`}
              >
                {c === "all" ? "All" : c === "high" ? "80%+" : c === "medium" ? "50-79%" : "<50%"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " \u2191", desc: " \u2193" }[
                        header.column.getIsSorted() as string
                      ] ?? ""}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center text-gray-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading documents...
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center text-gray-400"
                >
                  {statusFilter !== "all" || confFilter !== "all"
                    ? "No documents match the current filters"
                    : "No documents found"}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const doc = row.original;
                const isFailed = doc.status === "failed";
                const hasLowConfidence = doc.confidence !== null && doc.confidence < 0.5;
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${
                      isFailed
                        ? "bg-red-50/50 border-l-2 border-l-red-400"
                        : hasLowConfidence
                          ? "border-l-2 border-l-yellow-400"
                          : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 text-gray-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-gray-500">
          Showing {Math.min((page - 1) * limit + 1, total)}-{Math.min(page * limit, total)} of {total}
          {(statusFilter !== "all" || confFilter !== "all") && (
            <span className="text-gray-400"> ({filteredData.length} visible)</span>
          )}
        </span>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt;
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-2.5 py-1 text-sm rounded-md ${
                    pageNum === page
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
