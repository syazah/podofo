import type { Request, Response, NextFunction } from "express";
import { processUpload } from "../service/upload.service.js";
import { getDocumentsByLotId } from "../data/document.data.js";
import { enqueueClassificationJobs } from "../queue/producer/classifier.js";
import { enqueueExtractionJob } from "../queue/producer/extraction.producer.js";

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

    const result = await processUpload(files);

    res.status(201).json({
      lot_id: result.lot.id,
      status: result.lot.status,
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

export const handleClassifyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { lotId } = req.body as { lotId?: string };

    if (!lotId) {
      res.status(400).json({ error: "lotId is required" });
      return;
    }

    const documents = await getDocumentsByLotId(lotId);

    if (documents.length === 0) {
      res.status(404).json({ error: `No documents found for lot ${lotId}` });
      return;
    }

    const { jobCount, batchSize } = await enqueueClassificationJobs(lotId, documents);

    res.status(202).json({
      lotId,
      totalDocuments: documents.length,
      jobCount,
      batchSize,
    });
  } catch (error) {
    next(error);
  }
};

export const handleExtraction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { lotId } = req.body as { lotId?: string };

    if (!lotId) {
      res.status(400).json({ error: "lotId is required" });
      return;
    }

    const documents = await getDocumentsByLotId(lotId);

    if (documents.length === 0) {
      res.status(404).json({ error: `No documents found for lot ${lotId}` });
      return;
    }

    // Only extract documents that have been classified
    const classified = documents.filter((doc) => doc.status === "classified");

    if (classified.length === 0) {
      res.status(400).json({
        error: "No classified documents found. Run classification first.",
        totalDocuments: documents.length,
      });
      return;
    }

    const { jobCount, batchSize } = await enqueueExtractionJob(lotId, classified);

    res.status(202).json({
      lotId,
      totalDocuments: documents.length,
      classifiedDocuments: classified.length,
      jobCount,
      batchSize,
    });
  } catch (error) {
    next(error);
  }
};