import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { AppError } from "../errors/app-error.js";
import type { Prisma } from "@prisma/client";

type PasswordResetWithUser = Prisma.PasswordResetTokenGetPayload<{
  include: { user: true };
}>;

interface CreateRefreshTokenOptions {
  familyId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

let REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;
let EMAIL_VERIFICATION_TTL = 24 * 60 * 60 * 1000;
let PASSWORD_RESET_TTL = 24 * 60 * 1000;

export const generateHashToken = (rawToken: string): string => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

export const generateRawtoken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

export const createRefreshToken = async (
  userId: number,
  options: CreateRefreshTokenOptions = {},
) => {
  const rawToken = generateRawtoken();
  const tokenHash = generateHashToken(rawToken);
  const family = options.familyId ?? crypto.randomUUID();

  const now = new Date();

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      familyId: family,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      lastUsedAt: now,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
    },
  });

  return { rawToken, familyId: family };
};

export const verifyAndRotateRefresh = async (rawtoken: string) => {
  const tokenHash = generateHashToken(rawtoken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: true,
    },
  });

  if (!stored) throw new AppError("Refresh token not found", 404);

  if (stored?.expiresAt < new Date())
    throw new AppError("Unauthorized : token expired", 401);

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: {
        revokedAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
      },
    });

    throw new AppError(
      "Refresh token reuse detected. All sessions revoked.",
      401,
    );
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const { rawToken: newRawToken } = await createRefreshToken(stored.userId, {
    familyId: stored.familyId ?? undefined,
    ipAddress: stored.ipAddress ?? undefined,
    userAgent: stored.userAgent ?? undefined,
  });

  return {
    userId: stored.userId,
    role: stored.user.role,
    newRawToken,
  };
};

export const revokedRefreshTokenFamily = async (token: string) => {
  const tokenHash = generateHashToken(token);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) return;

  return await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: {
      familyId: stored.familyId,
      revokedAt: new Date(Date.now()),
    },
  });
};

export const createEmailVerificationToken = async (userId: number) => {
  // delete all other email verification tokens first
  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  const rawToken = generateRawtoken();
  const tokenHash = generateHashToken(rawToken);

  const emailRecord = await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL),
    },
  });

  return { rawToken, tokenId: emailRecord.id };
};

export const verifyEmailToken = async (token: string) => {
  const tokenHash = generateHashToken(token);

  const stored = await prisma.emailVerificationToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!stored) throw new AppError("Invalid verification token", 400);
  if (stored.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { id: stored.id } });
    throw new AppError("Verification token expired", 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.user.id },
      data: { isVerified: true },
    }),

    prisma.emailVerificationToken.delete({
      where: { id: stored.id },
    }),
  ]);

  return stored.user;
};

export const createPasswordResetToken = async (userId: number) => {
  const rawToken = generateRawtoken();
  const tokenHash = generateHashToken(rawToken);

  const passwordRecord = await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL),
    },
  });

  return { rawToken, tokenId: passwordRecord.id };
};

export const verifyPasswordResetToken = async (
  token: string,
): Promise<PasswordResetWithUser> => {
  const tokenHash = generateHashToken(token);

  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw new AppError("Invalid or expired reset token", 400); // 400, not 404

  if (stored?.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: stored.id } });
    throw new AppError("Verification token expired", 400);
  }

  return stored;
};

export const cleanupExpiredTokens = async () => {
  const date = new Date();

  const [emailVerificationResult, passwordResetResult] = await Promise.all([
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: date } } }),
    prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: date } },
    }),
  ]);

  console.log("done");

  return {
    emailVerificationDelete: emailVerificationResult.count,
    passwordResetDelete: passwordResetResult.count,
  };
};
