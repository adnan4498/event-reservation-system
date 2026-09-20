import dotenv from "dotenv";
dotenv.config(); // Ensure variables are loaded first!

import app from "./app.js";
import "./workers/reservation.workers.js";
import "./workers/token-cleanup.workers.js";
import { scheduleHourlyJob } from "./lib/queue.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log("Server listening on Port", PORT);
});

scheduleHourlyJob()