interface Props {
  message: string;
  sub?: string;
}

export default function EmptyState({ message, sub }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-gray-300 text-5xl mb-4">&#128203;</div>
      <p className="text-gray-500 font-medium">{message}</p>
      {sub && <p className="text-gray-400 text-sm mt-1">{sub}</p>}
    </div>
  );
}
