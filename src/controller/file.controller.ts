import type { Request, Response, NextFunction } from "express";
import { UploadService } from "../service/upload.service.js";
import { getDocumentsByLotId, getDocumentCountsByStatus } from "../data/document.data.js";
import { getLotById, updateLotStatusOnly } from "../data/lot.data.js";
import { enqueueClassificationJobs } from "../queue/producer/classifier.js";
import { enqueueBatchSubmit } from "../queue/producer/batch.producer.js";
import { projectConstants } from "../config/constants.js";
import { AppLogger } from "../config/logger.js";

const infoLogger = AppLogger.getInfoLogger();
const uploadService = UploadService.getInstance();
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

    const documents = await getDocumentsByLotId(result.lot.id);
    const useBatchApi = documents.length > projectConstants.BATCH_API_THRESHOLD;

    if (useBatchApi) {
      await enqueueBatchSubmit({ lotId: result.lot.id, stage: "classification" });
      infoLogger.info(
        `[Upload] Lot ${result.lot.id}: ${documents.length} docs → Batch API path (50% cost savings)`
      );
    } else {
      const { jobCount, batchSize } = await enqueueClassificationJobs(
        result.lot.id,
        documents
      );
      infoLogger.info(
        `[Upload] Lot ${result.lot.id}: ${documents.length} docs → Standard API, enqueued ${jobCount} jobs (batch size ${batchSize})`
      );
    }
    await updateLotStatusOnly(result.lot.id, "classifying");

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
    next(error);
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
      lot = await getLotById(id);
    } catch {
      res.status(404).json({ error: `Lot ${id} not found` });
      return;
    }

    const counts = await getDocumentCountsByStatus(id);
    const documents = await getDocumentsByLotId(id);

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
