import type { Request, Response } from "express";
import {
  listUserSessions,
  revokeSession,
  revokeAllOtherSessions,
} from "../services/session.service.js";
import { AppError } from "../errors/app-error.js";

export const listSessionsController = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);

  const sessions = await listUserSessions({
    userId: req.user.id,
    currentRawToken: req.cookies?.refreshToken,
  });

  res.status(200).json({ success: true, data: sessions });
};

export const revokeSessionController = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);

  const sessionId = Number(req.params.sessionId);
  await revokeSession(sessionId, req.user.id);

  res.status(204).send();
};

export const revokeAllOtherSessionsController = async (
  req: Request,
  res: Response,
) => {

  if (!req.user) throw new AppError("Authentication required", 401);

  const { revokedCount } = await revokeAllOtherSessions(
    req.user.id,
    req.cookies?.refreshToken,
  );

  res.status(200).json({
    success: true,
    message: `${revokedCount} other session(s) revoked`,
  });
};
