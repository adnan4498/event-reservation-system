import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import type { RegisterInputSchema } from "../validators/auth.validator.js";

export const registerUser = async (data: RegisterInputSchema) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  return await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role || "USER",
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getUserById = async (id: number) => {
  return await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      failedLoginAttempts: true,
      lockoutUntil: true,
      organizedEvents: true,
      reservations: true,
    },
  });
};

export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      failedLoginAttempts: true,
      lockoutUntil: true,
      organizedEvents: true,
      reservations: true,
    },
  });
};

export const getUserByEmailWithPassword = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true, // needed for login comparison
      name: true,
      role: true,
      failedLoginAttempts: true,
      lockoutUntil: true,
      organizedEvents: true,
      reservations: true,
    },
  });
};
