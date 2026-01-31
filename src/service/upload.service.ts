import crypto from "crypto";
import { Document, PDFDocument, Matrix, ColorSpace } from "mupdf";
import { supabaseAdmin } from "../config/supabase/client.js";
import { createLot, updateLotStatus } from "../data/lot.data.js";
import { createSourcePdf } from "../data/source_pdf.data.js";
import { createDocument } from "../data/document.data.js";
import { preprocessPage } from "./preprocess.service.js";

const BUCKET = "pdfs";
const TARGET_DPI = 300;
const PDF_DEFAULT_DPI = 72;

const computeHash = (buffer: Uint8Array): string => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const uploadToStorage = async (
  filePath: string,
  buffer: Uint8Array,
  contentType: string
): Promise<string> => {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return filePath;
};

const renderPagesAsImages = (pdfBuffer: Buffer): Uint8Array[] => {
  const srcDoc = Document.openDocument(pdfBuffer, "application/pdf") as PDFDocument;
  const pageCount = srcDoc.countPages();
  const images: Uint8Array[] = [];

  const scale = TARGET_DPI / PDF_DEFAULT_DPI;
  const matrix = Matrix.scale(scale, scale);

  for (let i = 0; i < pageCount; i++) {
    const page = srcDoc.loadPage(i);
    const pixmap = page.toPixmap(matrix, ColorSpace.DeviceRGB, false);
    pixmap.setResolution(TARGET_DPI, TARGET_DPI);
    images.push(pixmap.asPNG());
  }

  return images;
};

export const processUpload = async (
  files: Express.Multer.File[]
): Promise<{
  lot: Awaited<ReturnType<typeof createLot>>;
  documents: Awaited<ReturnType<typeof createDocument>>[];
  failed: { filename: string; page: number; error: string }[];
}> => {
  const fileImagesMap: { file: Express.Multer.File; images: Uint8Array[] }[] = [];
  let totalPages = 0;

  for (const file of files) {
    const images = renderPagesAsImages(file.buffer);
    fileImagesMap.push({ file, images });
    totalPages += images.length;
  }

  const lot = await createLot(totalPages);

  const processedIds: string[] = [];
  const failedIds: string[] = [];
  const documents: Awaited<ReturnType<typeof createDocument>>[] = [];
  const failed: { filename: string; page: number; error: string }[] = [];

  for (const { file, images } of fileImagesMap) {
    const fileHash = computeHash(file.buffer);
    const originalStoragePath = `originals/${lot.id}/${fileHash}.pdf`;

    await uploadToStorage(originalStoragePath, file.buffer, "application/pdf");

    const sourcePdf = await createSourcePdf({
      lot_id: lot.id,
      original_filename: file.originalname,
      storage_path: originalStoragePath,
      file_size: file.size,
      file_hash: fileHash,
      page_count: images.length,
    });

    for (let pageIndex = 0; pageIndex < images.length; pageIndex++) {
      const rawImage = images[pageIndex]!;
      const pageNumber = pageIndex + 1;

      try {
        const enhancedImage = await preprocessPage(rawImage);
        const imageHash = computeHash(enhancedImage);
        const storagePath = `processed/${lot.id}/${fileHash}_pageNum${pageNumber}.png`;

        await uploadToStorage(storagePath, enhancedImage, "image/png");

        const doc = await createDocument({
          lot_id: lot.id,
          source_pdf_id: sourcePdf.id,
          storage_path: storagePath,
          file_size: enhancedImage.byteLength,
          file_hash: imageHash,
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
