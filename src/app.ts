import express from "express";
import { generalLimiter } from "./middleware/rate-limiter.js";
import cookieParser from "cookie-parser";
import eventRouter from "./routes/event.routes.js";
import userRouter from "./routes/user.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import reservationRouter from "./routes/reservation.routes.js";
import authRouter from "./routes/auth.routes.js";

const app = express();
app.set("trust proxy", 1);
app.use(generalLimiter);

app.use(express.json());
app.use(cookieParser());

app.use("/api/event", eventRouter);
app.use("/api/user", userRouter);
app.use("/api/reservation", reservationRouter);
app.use("/api/auth", authRouter);

app.use(errorMiddleware);

export default app;
