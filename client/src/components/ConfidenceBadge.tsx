interface Props {
  value: number | null;
}

export default function ConfidenceBadge({ value }: Props) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const pct = Math.round(value * 100);
  let colorClass: string;

  if (value >= 0.8) {
    colorClass = "bg-green-100 text-green-800";
  } else if (value >= 0.5) {
    colorClass = "bg-yellow-100 text-yellow-800";
  } else {
    colorClass = "bg-red-100 text-red-800";
  }

  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}
    >
      {pct}%
    </span>
  );
}
