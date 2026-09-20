import type { Request, Response } from "express";
import { revokedRefreshTokenFamily } from "../services/token.service.js";
import { AppError } from "../errors/app-error.js";

export const logoutController = async (req: Request, res: Response) => {
  const rawToken = req.cookies?.refreshToken;

  if (!rawToken) throw new AppError("You are not logged in.", 401);

  if (rawToken) {
    await revokedRefreshTokenFamily(rawToken);
  }

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/api/auth",
  });

  res.status(200).json({
    success: true,
    message: "Logout successfull",
  });
};
