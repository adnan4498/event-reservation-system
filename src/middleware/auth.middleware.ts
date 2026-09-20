import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { verifyToken } from "../lib/jwt.js";

export interface AuthUser {
  id: number;
  role: "USER" | "ADMIN";
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return next(new AppError("Authentication required", 401));
  }
  const token = authHeader.split(" ")[1];

  try {
    if (!token) throw new AppError("Bearer Token not found", 404);

    let payload = verifyToken(token);

    req.user = {
      id: payload.id,
      role: payload.role,
    };

    next();
  } catch (error) {
    return next(new AppError("Invalid or expired token", 401));
  }
};

export const requiredRole = (...roles: AuthUser["role"][]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError("Authentication required", 401);
    if (!roles.includes(req.user.role)) {
      throw new AppError("Forbidden: Only Organizer can create event", 403);
    }
    next();
  };
};
