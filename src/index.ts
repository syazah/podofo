import express, { type Request, type Response, type NextFunction } from "express";
import dotenv from "dotenv";
import routes from "./routes.js";
import { supabaseAdmin } from "./config/supabase/client.js";
import { classificationWorker } from "./queue/worker/classifier.worker.js";
import { extractionWorker } from "./queue/worker/extraction.worker.js";
import { HttpError } from "./config/HttpError.js";
import httpStatus from "http-status";
import { AppLogger } from "./config/logger.js";
dotenv.config();

const app = express();

const infoLogger = AppLogger.getInfoLogger();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: 200, message: "Server is OK" });
});

app.use("/api/v1", routes)

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status =
        err instanceof HttpError ? err.status : httpStatus.INTERNAL_SERVER_ERROR;
    const message =
        err instanceof HttpError ? err.message : "Internal Server Error";
    res.status(status).json({
        error: message,
    });
});

const port = process.env.PORT || 4444;
const server = app.listen(port, () => {
    infoLogger.info(`PODOFO is listening on port ${port}, supabaseAdmin: ${supabaseAdmin}`);
    infoLogger.info(`Classification worker started: ${classificationWorker.name}`);
    infoLogger.info(`Extraction worker started: ${extractionWorker.name}`);
});

async function shutdown() {
    infoLogger.info("Shutting down gracefully...");
    await Promise.all([
        classificationWorker.close(),
        extractionWorker.close(),
    ]);
    infoLogger.info("Workers closed.");
    server.close(() => {
        infoLogger.info("Server closed.");
        process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
