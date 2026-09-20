import type { Request, Response, RequestHandler, NextFunction } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";
import type { IncomingHttpHeaders } from "node:http";

type ValidationSchemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export const validate = (schemas: ValidationSchemas): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    let errors: { field: string; message: string }[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);

      if (!result.success) {
        errors.push(
          ...result?.error?.issues.map((issue) => ({
            field: `body.${issue.path.join(".")}`,
            message: issue.message,
          })),
        );
      } else {
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `params.${issue.path.join(".")}`,
            message: issue.message,
          })),
        );
      } else {
        (req as any).params = result.data; // TypeScript workaround
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `query.${issue.path.join(".")}`,
            message: issue.message,
          })),
        );
      } else {
        Object.keys(req.query).forEach(key => delete req.query[key])
        Object.assign(req.query, result.data)
      }
    }

    if (errors.length > 0) {
      return next(new AppError("Validation failed", 400, errors));
    }

    next();
  };
};
