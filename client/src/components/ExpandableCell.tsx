import { useState } from "react";

interface Props {
  value: unknown;
  maxLength?: number;
}

export default function ExpandableCell({ value, maxLength = 50 }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (value === null || value === undefined) {
    return <span className="text-gray-400">-</span>;
  }

  // Handle arrays (e.g., line_items)
  if (Array.isArray(value)) {
    const itemCount = value.length;

    if (itemCount === 0) {
      return <span className="text-gray-400">Empty array</span>;
    }

    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
        >
          <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isExpanded && (
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  {value[0] && typeof value[0] === "object" &&
                    Object.keys(value[0] as Record<string, unknown>).map((key) => (
                      <th key={key} className="px-2 py-1 text-left font-medium text-gray-600">
                        {key}
                      </th>
                    ))
                  }
                </tr>
              </thead>
              <tbody>
                {value.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                    {typeof item === "object" && item !== null ? (
                      Object.values(item as Record<string, unknown>).map((val, vidx) => (
                        <td key={vidx} className="px-2 py-1 text-gray-700">
                          {String(val ?? "-")}
                        </td>
                      ))
                    ) : (
                      <td className="px-2 py-1 text-gray-700">{String(item)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Handle objects
  if (typeof value === "object") {
    const jsonStr = JSON.stringify(value, null, 2);
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
        >
          <span>Object</span>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isExpanded && (
          <pre className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs max-h-64 overflow-auto whitespace-pre-wrap">
            {jsonStr}
          </pre>
        )}
      </div>
    );
  }

  // Handle strings/primitives
  const strValue = String(value);

  if (strValue.length <= maxLength) {
    return <span>{strValue}</span>;
  }

  return (
    <div>
      {isExpanded ? (
        <div>
          <span className="whitespace-pre-wrap break-words">{strValue}</span>
          <button
            onClick={() => setIsExpanded(false)}
            className="ml-2 text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            Show less
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="truncate">{strValue.slice(0, maxLength)}...</span>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap"
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
