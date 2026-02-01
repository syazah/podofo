import { Router } from "express";
import { upload } from "./config/multer/config.js";
import {
  handleUploadFilesController,
  handleGetLotStatus,
  handleGetLots,
  handleGetLotDocuments,
  handleExportLotDocuments,
} from "./controller/file.controller.js";

const routes = Router();

routes.post("/upload/pdfs", upload.array("pdfs"), handleUploadFilesController);
routes.get("/lot/:id/status", handleGetLotStatus);
routes.get("/lots", handleGetLots);
routes.get("/lot/:id/documents", handleGetLotDocuments);
routes.get("/lot/:id/export/:format", handleExportLotDocuments);

export default routes;
