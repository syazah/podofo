import { createContext, useContext, useState, type ReactNode } from "react";

interface UploadContextType {
  activeLotId: string | null;
  setActiveLotId: (lotId: string | null) => void;
  clearActiveLot: () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [activeLotId, setActiveLotId] = useState<string | null>(null);

  const clearActiveLot = () => setActiveLotId(null);

  return (
    <UploadContext.Provider value={{ activeLotId, setActiveLotId, clearActiveLot }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploadContext() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUploadContext must be used within an UploadProvider");
  }
  return context;
}
