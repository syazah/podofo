import crypto from "crypto";
import { Document, PDFDocument, Matrix, ColorSpace } from "mupdf";
import { PreprocessService } from "./preprocess.service.js";
import { projectConstants } from "../config/constants.js";
import { S3Storage } from "../data/storage.data.js";
import { DocumentDB } from "../data/document.data.js";
import { LotDB } from "../data/lot.data.js";
import { SourcePDFDB } from "../data/source_pdf.data.js";

const docDB = DocumentDB.getInstance();
const lotDB = LotDB.getInstance();
const sourcePdfDB = SourcePDFDB.getInstance();
export class UploadService {
  private s3Storage: S3Storage = S3Storage.getInstance();
  private preprocessService: PreprocessService = PreprocessService.getInstance();
  private static instance: UploadService;

  private constructor() { }

  public static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  private computeHash = (buffer: Uint8Array): string => {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  };

  private renderPagesAsImages = (pdfBuffer: Buffer): Uint8Array[] => {
    const srcDoc = Document.openDocument(pdfBuffer, "application/pdf") as PDFDocument;
    const pageCount = srcDoc.countPages();
    const images: Uint8Array[] = [];
    const targetDPI = projectConstants.TARGET_DPI
    const pdfDefaultApi = projectConstants.PDF_DEFAULT_DPI

    const scale = targetDPI / pdfDefaultApi;
    const matrix = Matrix.scale(scale, scale);

    for (let i = 0; i < pageCount; i++) {
      const page = srcDoc.loadPage(i);
      const pixmap = page.toPixmap(matrix, ColorSpace.DeviceRGB, false);
      pixmap.setResolution(targetDPI, targetDPI);
      images.push(pixmap.asPNG());
    }

    return images;
  };

  async processUpload(
    files: Express.Multer.File[]
  ): Promise<{
    lot: Awaited<ReturnType<typeof lotDB.createLot>>;
    documents: Awaited<ReturnType<typeof docDB.createDocument>>[];
    failed: { filename: string; page: number; error: string }[];
  }> {
    const fileImagesMap: { file: Express.Multer.File; images: Uint8Array[] }[] = [];
    let totalPages = 0;

    for (const file of files) {
      const images = this.renderPagesAsImages(file.buffer);
      fileImagesMap.push({ file, images });
      totalPages += images.length;
    }

    const lot = await lotDB.createLot(totalPages);

    const processedIds: string[] = [];
    const failedIds: string[] = [];
    const documents: Awaited<ReturnType<typeof docDB.createDocument>>[] = [];
    const failed: { filename: string; page: number; error: string }[] = [];

    for (const { file, images } of fileImagesMap) {
      const fileHash = this.computeHash(file.buffer);
      const originalStoragePath = `originals/${lot.id}/${fileHash}.pdf`;

      await this.s3Storage.uploadToStorage(originalStoragePath, file.buffer, "application/pdf");

      const sourcePdf = await sourcePdfDB.createSourcePdf({
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
          const enhancedImage = await this.preprocessService.preprocessImage(rawImage);
          const imageHash = this.computeHash(enhancedImage);
          const storagePath = `processed/${lot.id}/${fileHash}_pageNum${pageNumber}.jpg`;

          await this.s3Storage.uploadToStorage(storagePath, enhancedImage, "image/jpeg");

          const doc = await docDB.createDocument({
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
        ? "uploaded"
        : processedIds.length === 0
          ? "failed"
          : "uploaded";

    const updatedLot = await lotDB.updateLotStatus(
      lot.id,
      lotStatus,
      processedIds,
      failedIds.filter((id) => id !== "")
    );

    return { lot: updatedLot, documents, failed };
  };
}
