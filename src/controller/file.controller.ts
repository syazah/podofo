import type { Request, Response, NextFunction } from "express";
import { UploadService } from "../service/upload.service.js";
import { enqueueClassificationJobs } from "../queue/producer/classification.producer.js";
import { enqueueBatchSubmit } from "../queue/producer/batch.producer.js";
import { projectConstants } from "../config/constants.js";
import { AppLogger } from "../config/logger.js";
import { HttpError } from "../config/HttpError.js";
import httpStatus from "http-status";
import { LotDB } from "../data/lot.data.js";
import { DocumentDB } from "../data/document.data.js";

const infoLogger = AppLogger.getInfoLogger();
const uploadService = UploadService.getInstance();
const lotDB = LotDB.getInstance();
const docDB = DocumentDB.getInstance();
export const handleUploadFilesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No PDF files provided" });
      return;
    }

    const result = await uploadService.processUpload(files);

    if (result.lot.status === "failed") {
      res.status(500).json({
        lot_id: result.lot.id,
        status: result.lot.status,
        errors: result.failed,
      });
      return;
    }

    const useBatchApi = result.documents.length > projectConstants.BATCH_API_THRESHOLD;

    if (useBatchApi) {
      await enqueueBatchSubmit({ lotId: result.lot.id, stage: "classification" });
      infoLogger.info(
        `[Upload] Lot ${result.lot.id}: ${result.documents.length} docs → Batch API path (for cost savings)`
      );
    } else {
      const { jobCount, batchSize } = await enqueueClassificationJobs(
        result.lot.id,
        result.documents
      );
      infoLogger.info(
        `[Upload] Lot ${result.lot.id}: ${result.documents.length} docs → Standard API, enqueued ${jobCount} jobs (batch size ${batchSize})`
      );
    }
    await lotDB.updateLotStatusOnly(result.lot.id, "classifying");

    res.status(201).json({
      lot_id: result.lot.id,
      status: "classifying",
      total: result.lot.total_files,
      uploaded: result.documents.length,
      failed: result.failed.length,
      documents: result.documents.map((doc) => ({
        id: doc.id,
        source_pdf_id: doc.source_pdf_id,
        page_number: doc.page_number,
        storage_path: doc.storage_path,
        file_size: doc.file_size,
      })),
      errors: result.failed,
    });
  } catch (error) {
    throw error instanceof Error ? new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR) : new HttpError("Unknown error", httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export const handleGetLotStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      res.status(400).json({ error: "Lot ID is required" });
      return;
    }

    let lot;
    try {
      lot = await lotDB.getLotById(id);
    } catch {
      res.status(404).json({ error: `Lot ${id} not found` });
      return;
    }

    const counts = await docDB.getDocumentCountsByStatus(id);
    const documents = await docDB.getDocumentsByLotId(id);

    res.status(200).json({
      lotId: lot.id,
      status: lot.status,
      progress: {
        total: counts.total,
        classified: counts.classified,
        extracted: counts.extracted,
        failed: counts.failed,
      },
      documents: documents.map((doc) => ({
        id: doc.id,
        status: doc.status,
        page_number: doc.page_number,
        classification: doc.classification,
        confidence: doc.confidence,
        assigned_model: doc.assigned_model,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetLots = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const lots = await lotDB.getAllLots();
    res.status(200).json(
      lots.map((lot) => ({
        id: lot.id,
        total_files: lot.total_files,
        status: lot.status,
        created_at: lot.created_at,
      }))
    );
  } catch (error) {
    next(error);
  }
};

export const handleGetLotDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));

    if (!id) {
      res.status(400).json({ error: "Lot ID is required" });
      return;
    }

    try {
      await lotDB.getLotById(id);
    } catch {
      res.status(404).json({ error: `Lot ${id} not found` });
      return;
    }

    const { documents, total } = await docDB.getDocumentsByLotIdPaginated(id, page, limit);

    res.status(200).json({
      documents: documents.map((doc) => ({
        id: doc.id,
        lot_id: doc.lot_id,
        source_pdf_id: doc.source_pdf_id,
        page_number: doc.page_number,
        status: doc.status,
        classification: doc.classification,
        assigned_model: doc.assigned_model,
        extracted_data: doc.extracted_data,
        confidence: doc.confidence,
        field_confidences: doc.field_confidences,
        error_message: doc.error_message,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

export const handleExportLotDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;
    const format = req.params.format as string;

    if (!id) {
      res.status(400).json({ error: "Lot ID is required" });
      return;
    }

    if (format !== "csv" && format !== "json") {
      res.status(400).json({ error: "Format must be 'csv' or 'json'" });
      return;
    }

    try {
      await lotDB.getLotById(id);
    } catch {
      res.status(404).json({ error: `Lot ${id} not found` });
      return;
    }

    const documents = await docDB.getDocumentsByLotId(id);

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename=lot-${id}.json`);
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(
        documents.map((doc) => ({
          id: doc.id,
          page_number: doc.page_number,
          classification: doc.classification,
          status: doc.status,
          confidence: doc.confidence,
          extracted_data: doc.extracted_data,
          field_confidences: doc.field_confidences,
        }))
      );
      return;
    }

    // CSV export
    const rows = documents.map((doc) => {
      const extractedFields = doc.extracted_data
        ? Object.entries(doc.extracted_data)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")
        : "";
      const fieldConfs = doc.field_confidences
        ? Object.entries(doc.field_confidences)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")
        : "";
      return [
        doc.id,
        doc.page_number,
        doc.classification ?? "",
        doc.status,
        doc.confidence ?? "",
        `"${extractedFields.replace(/"/g, '""')}"`,
        `"${fieldConfs.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const header = "id,page_number,classification,status,confidence,extracted_data,field_confidences";
    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Disposition", `attachment; filename=lot-${id}.csv`);
    res.setHeader("Content-Type", "text/csv");
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
