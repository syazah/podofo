import crypto from "crypto";
import { Document, PDFDocument } from "mupdf";
import { supabaseAdmin } from "../config/supabase/client.js";
import { createLot, updateLotStatus } from "../data/lot.data.js";
import { createSourcePdf } from "../data/source_pdf.data.js";
import { createDocument } from "../data/document.data.js";

const BUCKET = "pdfs";

const computeHash = (buffer: Uint8Array): string => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const uploadToStorage = async (
  filePath: string,
  buffer: Uint8Array
): Promise<string> => {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return filePath;
};

const splitPdfIntoPages = (pdfBuffer: Buffer): Uint8Array[] => {
  const srcDoc = Document.openDocument(pdfBuffer, "application/pdf") as PDFDocument;
  const pageCount = srcDoc.countPages();
  const pages: Uint8Array[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = new PDFDocument();
    newDoc.graftPage(0, srcDoc, i);
    const buf = newDoc.saveToBuffer("compress");
    pages.push(buf.asUint8Array());
  }

  return pages;
};

export const processUpload = async (
  files: Express.Multer.File[]
): Promise<{
  lot: Awaited<ReturnType<typeof createLot>>;
  documents: Awaited<ReturnType<typeof createDocument>>[];
  failed: { filename: string; page: number; error: string }[];
}> => {
  const filePagesMap: { file: Express.Multer.File; pages: Uint8Array[] }[] = [];
  let totalPages = 0;

  for (const file of files) {
    const pages = splitPdfIntoPages(file.buffer);
    filePagesMap.push({ file, pages });
    totalPages += pages.length;
  }

  const lot = await createLot(totalPages);

  const processedIds: string[] = [];
  const failedIds: string[] = [];
  const documents: Awaited<ReturnType<typeof createDocument>>[] = [];
  const failed: { filename: string; page: number; error: string }[] = [];

  for (const { file, pages } of filePagesMap) {
    const fileHash = computeHash(file.buffer);
    const originalStoragePath = `originals/${lot.id}/${fileHash}.pdf`;

    await uploadToStorage(originalStoragePath, file.buffer);

    const sourcePdf = await createSourcePdf({
      lot_id: lot.id,
      original_filename: file.originalname,
      storage_path: originalStoragePath,
      file_size: file.size,
      file_hash: fileHash,
      page_count: pages.length,
    });

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const pageBuffer = pages[pageIndex]!;
      const pageNumber = pageIndex + 1;

      try {
        const pageHash = computeHash(pageBuffer);
        const storagePath = `originals/${lot.id}/${fileHash}_pageNum${pageNumber}.pdf`;

        await uploadToStorage(storagePath, pageBuffer);

        const doc = await createDocument({
          lot_id: lot.id,
          source_pdf_id: sourcePdf.id,
          storage_path: storagePath,
          file_size: pageBuffer.byteLength,
          file_hash: pageHash,
          page_number: pageNumber,
        });

        processedIds.push(doc.id);
        documents.push(doc);
      } catch (err) {
        failedIds.push("");
        failed.push({
          filename: file.originalname,
          page: pageNumber,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  const lotStatus =
    failedIds.length === 0
      ? "completed"
      : processedIds.length === 0
        ? "failed"
        : "partial_failure";

  const updatedLot = await updateLotStatus(
    lot.id,
    lotStatus,
    processedIds,
    failedIds.filter((id) => id !== "")
  );

  return { lot: updatedLot, documents, failed };
};
