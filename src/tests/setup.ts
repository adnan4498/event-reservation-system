import { config } from "dotenv";
config({ path: ".env.test", override: true });

import { afterAll, vi } from "vitest";
import prisma from "../lib/prisma.js";

vi.mock("../middleware/rate-limiter.js", () => ({
  generalLimiter: (_req: any, _res: any, next: any) => next(),
  authLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/redis.js", () => ({
  redisClient: { call: vi.fn() },
  queueRedisConnection: {},
}));

vi.mock("../lib/queue.js", () => ({
  reservationQueue: { add: vi.fn().mockResolvedValue(undefined) },
  cleanupTokenQueue: {
    add: vi.fn(),
    upsertJobScheduler: vi.fn(),
    getJobSchedulers: vi.fn().mockResolvedValue([]),
  },
  scheduleHourlyJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../workers/reservation.worker.js", () => ({ default: {} }));
vi.mock("../workers/token-cleanup.worker.js", () => ({ default: {} }));

afterAll(async () => {
  await prisma.$disconnect();
});