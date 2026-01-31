import { Router } from "express";
import { upload } from "./config/multer/config.js";
import { handleUploadFilesController } from "./controller/file.controller.js";

const routes = Router();

routes.post("/upload/pdfs", upload.array("pdfs"), handleUploadFilesController);

export default routes;
