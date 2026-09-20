import type { Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { verifyAndRotateRefresh } from "../services/token.service.js";
import { signAccessToken } from "../lib/jwt.js";
import prisma from "../lib/prisma.js";

export const refreshController = async (req: Request, res: Response) => {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) throw new AppError("Token not found", 404);

  const { newRawToken, role, userId } = await verifyAndRotateRefresh(rawToken);

  const accessToken = signAccessToken({ id: userId, role: role });

  res.cookie("refreshToken", newRawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    accessToken,
  });
};
