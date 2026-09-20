import { Worker, Job } from "bullmq";
import { queueRedisConnection } from "../lib/redis.js";
import { cleanupExpiredTokens } from "../services/token.service.js";

const worker = new Worker(
  "cleanup-token-queue",
  async (job: Job) => {
    await cleanupExpiredTokens()
  },
  { connection: queueRedisConnection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});

export default worker;
