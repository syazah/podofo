import type { Request, Response, NextFunction } from "express";
import { processUpload } from "../service/upload.service.js";

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
        filename: doc.original_filename,
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
