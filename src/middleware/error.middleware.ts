import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error.js";
import { Prisma } from "@prisma/client";

export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // 1. Custom AppError (validation, business logic)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }

  // 2. Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2025":
        return res.status(404).json({
          success: false,
          message: "Record not found",
        });
      case "P2002": {
        const msg =
          (err.meta?.driverAdapterError as any)?.cause?.originalMessage || "";
        const fields = msg.match(/User_(.+)_key/)?.[1] || "field";
        return res.status(409).json({
          success: false,
          message: `Duplicate value for unique field: ${fields}`,
        });
      }
      case "P2003":
        return res.status(400).json({
          success: false,
          message: "Foreign key constraint failed",
        });
      case "P2000":
        return res.status(400).json({
          success: false,
          message: "Input value too long",
        });
      default:
        return res.status(500).json({
          success: false,
          message: "Database operation failed",
          ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
        });
    }
  }

  // 3. Prisma validation error
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: "Invalid data provided to database",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }

  // 4. Unknown error
  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(process.env.NODE_ENV !== "production" && {
      stack: (err as Error).stack,
    }),
  });
};
