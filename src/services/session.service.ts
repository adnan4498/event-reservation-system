import prisma from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import { generateHashToken } from "./token.service.js";

interface SessionListOptions {
  userId: number;
  currentRawToken?: string;
}

export const listUserSessions = async ({
  userId,
  currentRawToken,
}: SessionListOptions) => {
  const currentHash = currentRawToken
    ? generateHashToken(currentRawToken)
    : null;

  const sessions = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
      tokenHash: true,
    },
    orderBy: { lastUsedAt: "desc" },
  });

  return sessions.map(({ tokenHash, ...rest }) => ({
    ...rest,
    isCurrent: tokenHash === currentHash,
  }));
};

export const revokeSession = async (sessionId: number, userId: number) => {
  const result = await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError("Session not found", 404);
  }
};

export const revokeAllOtherSessions = async (
  userId: number,
  currentRawToken?: string,
) => {
  if (!currentRawToken) throw new AppError( "Refresh token cookie is required to identify current session", 400);

  const currentHash = generateHashToken(currentRawToken);

  const current = await prisma.refreshToken.findUnique({
    where: { tokenHash: currentHash },
  });

  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(current ? { id: { not: current.id } } : {}),
    },
    data: { revokedAt: new Date() },
  });

  return { revokedCount: result.count };
};
