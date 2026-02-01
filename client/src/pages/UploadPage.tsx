import { useState } from "react";
import DropZone from "../components/DropZone.tsx";
import UploadQueue from "../components/UploadQueue.tsx";
import LotProgress from "../components/LotProgress.tsx";
import { useUpload } from "../hooks/useUpload.ts";

export default function UploadPage() {
  const { files, addFiles, removeFile, upload, isUploading, error } = useUpload();
  const [activeLotId, setActiveLotId] = useState<string | null>(null);

  const handleUpload = async () => {
    const result = await upload();
    if (result) {
      setActiveLotId(result.lot_id);
    }
  };

  return (
    <div>
      <DropZone onFilesSelected={addFiles} disabled={isUploading} />
      <UploadQueue files={files} onRemove={removeFile} />

      {files.length > 0 && (
        <div className="mt-4">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? "Uploading..." : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {activeLotId && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Processing
          </h2>
          <LotProgress lotId={activeLotId} />
        </div>
      )}
    </div>
  );
}
