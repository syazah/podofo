import express, { type Request, type Response, type NextFunction } from "express";
import dotenv from "dotenv";
import routes from "./routes.js";
import { supabaseAdmin } from "./config/supabase/client.js";
dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: 200, message:"Server is OK" });
});

app.use("/api/v1", routes)

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
});

const port = process.env.PORT || 4444;

const server = app.listen(port, () => {
    console.log(`PODOFO is listening on port ${port}, supabaseAdmin: ${supabaseAdmin}`);
});

function shutdown() {
    console.log("Shutting down gracefully...");
    server.close(() => {
        console.log("Server closed.");
        process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
