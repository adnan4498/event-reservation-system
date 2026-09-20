import type { Request, Response } from "express";
import {
  getUserByEmail,
  getUserById,
  getUserByEmailWithPassword,
  registerUser,
} from "../services/user.service.js";
import { AppError } from "../errors/app-error.js";
import bcrypt from "bcryptjs";
import { signAccessToken, verifyToken } from "../lib/jwt.js";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  createRefreshToken,
  verifyEmailToken,
  verifyPasswordResetToken,
} from "../services/token.service.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../lib/mailer.js";
import prisma from "../lib/prisma.js";
import { attemptLogin } from "../services/auth.service.js";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const registerAuthController = async (req: Request, res: Response) => {
  const user = await registerUser(req.body);

  res.status(201).json({
    success: true,
    message: "New User Registered",
    data: user,
  });
};

export const loginAuthController = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await attemptLogin(email, password);

  const payload = {
    id: user.id,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);

  const { rawToken } = await createRefreshToken(user.id, {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.cookie("refreshToken", rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Login Successfully",
    accessToken,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
};

// verification email sending controllers

export const sendVerificationController = async (
  req: Request,
  res: Response,
) => {
  const startTime = Date.now();
  const TARGET_TIME = 500;

  const id = req.user?.id;
  if (!id) throw new AppError("Authentication required", 401);

  const dbUser = await prisma.user.findUnique({ where: { id } });
  if (!dbUser?.email) throw new AppError("User not found", 404);

  if (dbUser.isVerified) {
    return res
      .status(200)
      .json({ success: true, message: "Email already verified" });
  }

  const { rawToken, tokenId } = await createEmailVerificationToken(id);

  let emailFailed = false;
  try {
    await sendVerificationEmail(dbUser.email, rawToken);
  } catch (err) {
    emailFailed = true;
    await prisma.emailVerificationToken.delete({ where: { id: tokenId } });
    console.error("Verification email failed:", err);
  }

  // Pad the response time so attackers can't distinguish "user exists, email sent"
  // from "user doesn't exist" via latency.
  const elapsed = Date.now() - startTime;
  const delayNeeded = Math.max(0, TARGET_TIME - elapsed);
  if (delayNeeded > 0) await sleep(delayNeeded);

  if (emailFailed) throw new AppError("Failed to send verification email", 500);

  res.status(200).json({ success: true, message: "Verification email sent" });
};

export const verifyEmailController = async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) throw new AppError("Token is required", 400);

  await verifyEmailToken(token);

  res.status(200).json({
    success: true,
    message: "Email verified",
  });
};

// Password Controllers

export const forgotPasswordController = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const TARGET_TIME = 500;

  const { email } = req.body;
  const user = await getUserByEmail(email);

  const genericResponse = {
    success: true,
    message: "If that email is registered, a reset link has been sent.",
  };

  if (!user) {
    const elapsed = Date.now() - startTime;
    const delayNeeded = Math.max(0, TARGET_TIME - elapsed);
    if (delayNeeded > 0) await sleep(delayNeeded);
    return res.status(200).json(genericResponse);
  }

  const { rawToken, tokenId } = await createPasswordResetToken(user.id);

  let emailFailed = false;
  try {
    await sendPasswordResetEmail(user.email, rawToken);
  } catch (err) {
    emailFailed = true;
    await prisma.passwordResetToken.delete({ where: { id: tokenId } });
    console.error("Password reset email failed:", err);
  }

  const elapsed = Date.now() - startTime;
  const delayNeeded = Math.max(0, TARGET_TIME - elapsed);
  if (delayNeeded > 0) await sleep(delayNeeded);

  // Even if email failed, return generic message — no enumeration
  if (emailFailed) return res.status(200).json(genericResponse);

  res.status(200).json(genericResponse);
};

export const resetPasswordController = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  const stored = await verifyPasswordResetToken(token);
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.user.id },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: stored.user.id } }),
    prisma.refreshToken.updateMany({
      where: { userId: stored.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.status(200).json({
    success: true,
    message: "Password reset successfully. Please log in again.",
  });
};
