import type { ConnectionOptions } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const redisConnection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
};
