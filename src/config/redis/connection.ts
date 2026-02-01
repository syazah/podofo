import type { ConnectionOptions } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT) || 6379,
  ...(process.env.REDIS_USERNAME && {
    username: process.env.REDIS_USERNAME,
  }),
  ...(process.env.REDIS_PASSWORD && {
    password: process.env.REDIS_PASSWORD,
  }),
  ...(process.env.REDIS_TLS === "true" && {
    tls: {},
  }),
};
