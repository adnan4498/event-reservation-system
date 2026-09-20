import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { getUserByEmailWithPassword } from "./user.service.js";
import { AppError } from "../errors/app-error.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const attemptLogin = async (email: string, password: string) => {
  const user = await getUserByEmailWithPassword(email);

  if (!user) throw new AppError("Invalid credentials", 401);

  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const remainingMs = user.lockoutUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new AppError(
      `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
      423,
    );
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    await recordFailedLogin(user.id, user.failedLoginAttempts);
    throw new AppError("Invalid credentials", 401);
  }

  if (user.failedLoginAttempts !== 0 || user.lockoutUntil !== null) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockoutUntil: null },
    });
  }

  return user;
};

const recordFailedLogin = async (userId: number, currentAttempts: number) => {
  const next = currentAttempts + 1;

  if (next >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: next },
    });
  }
};
