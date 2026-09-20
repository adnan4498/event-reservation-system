import { Router } from "express";
import { forgotPasswordController, loginAuthController, registerAuthController, resetPasswordController, sendVerificationController, verifyEmailController } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../validators/auth.validator.js";
import { authLimiter } from "../middleware/rate-limiter.js";
import { refreshController } from "../controllers/refresh.controller.js";
import { logoutController } from "../controllers/logout.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import sessionRouter from "./session.routes.js";

const authRouter = Router()

authRouter.post("/register",validate({body : registerSchema}), registerAuthController);
authRouter.post("/login", authLimiter, validate({body : loginSchema}), loginAuthController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);

authRouter.post("/send-verification", authenticate, sendVerificationController);
authRouter.get("/verify-email", verifyEmailController);

authRouter.post("/forgot-password",  validate({body: forgotPasswordSchema}), forgotPasswordController);
authRouter.post("/reset-password", validate({body : resetPasswordSchema}), resetPasswordController);

// session routes
authRouter.use("/sessions", sessionRouter);

export default authRouter