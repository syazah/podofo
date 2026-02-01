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

  // No need to extract field names anymore - we display as paragraph

  const columns = useMemo<ColumnDef<DocumentWithExtraction>[]>(() => {
    return [
      {
        accessorKey: "page_number",
        header: "Page #",
        size: 80,
      },
      {
        accessorKey: "source_pdf_id",
        header: "Source PDF",
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val.slice(0, 8) + "..." : "-";
        },
        size: 120,
      },
      {
        accessorKey: "classification",
        header: "Classification",
        cell: ({ getValue }) => getValue<string | null>() ?? "-",
        size: 130,
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
        size: 100,
      },
      {
        accessorKey: "extracted_data",
        header: "Extracted Data",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return <ExpandableCell value={val} maxLength={100} />;
        },
        size: 400,
      },
      {
        accessorKey: "confidence",
        header: "Confidence",
        cell: ({ getValue }) => <ConfidenceBadge value={getValue<number | null>()} />,
        size: 100,
      },
    ];
  }, []);

  const table = useReactTable({
    data,
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
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
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
                  Loading...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center text-gray-400"
                >
                  No documents found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const hasLowConfidence = Object.values(
                  row.original.field_confidences ?? {}
                ).some((v) => v < 0.5);
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${hasLowConfidence ? "border-l-2 border-l-red-400" : ""
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
          Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
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
                  className={`px-2.5 py-1 text-sm rounded-md ${pageNum === page
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
