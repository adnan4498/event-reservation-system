import { Redis as IORedis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || "redis",
      port: Number(process.env.REDIS_PORT) || 6379,
    };

export const redisClient =
  typeof redisConfig === "string"
    ? new IORedis(redisConfig, { maxRetriesPerRequest: 3 })
    : new IORedis({ ...redisConfig, maxRetriesPerRequest: 3 });

export const queueRedisConnection =
  typeof redisConfig === "string"
    ? new IORedis(redisConfig, { maxRetriesPerRequest: null })
    : new IORedis({ ...redisConfig, maxRetriesPerRequest: null });
