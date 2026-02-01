interface Props {
  files: File[];
  onRemove: (index: number) => void;
}

export default function UploadQueue({ files, onRemove }: Props) {
  if (files.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Selected Files ({files.length})
      </h3>
      <ul className="space-y-1">
        {files.map((file, i) => (
          <li
            key={`${file.name}-${i}`}
            className="flex items-center justify-between px-3 py-2 bg-white rounded border border-gray-200 text-sm"
          >
            <span className="text-gray-700 truncate mr-2">{file.name}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-gray-400 text-xs">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={() => onRemove(i)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
