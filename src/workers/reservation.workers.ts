import { Worker, Job } from "bullmq";
import { queueRedisConnection } from "../lib/redis.js";

const worker = new Worker(
  "reservation-queue",
  async (job: Job) => {
    // processor logic
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
