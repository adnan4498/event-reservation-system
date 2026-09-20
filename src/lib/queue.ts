import { Queue } from "bullmq";
import { queueRedisConnection } from "./redis.js";

export const reservationQueue = new Queue("reservation-queue", {
  connection: queueRedisConnection,
});

export const cleanupTokenQueue = new Queue("cleanup-token-queue", {
  connection: queueRedisConnection,
});

export async function scheduleHourlyJob() {
  await cleanupTokenQueue.upsertJobScheduler(
    "hourly-work-scheduler",
    {
      every: 3600000,
    },
    {
      name: "run-hourly-work",
      data: { timestamp: Date.now() },
      opts: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    },
  );
}
