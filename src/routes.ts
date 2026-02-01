import { Router } from "express";
import { upload } from "./config/multer/config.js";
import { handleUploadFilesController, handleGetLotStatus } from "./controller/file.controller.js";

const routes = Router();

routes.post("/upload/pdfs", upload.array("pdfs"), handleUploadFilesController);
routes.get("/lot/:id/status", handleGetLotStatus);

export default routes;
