import prisma from '../../lib/prisma.js';

export const resetDb = async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "RefreshToken", "EmailVerificationToken", "PasswordResetToken", "Reservation", "Event", "User" RESTART IDENTITY CASCADE;`
  );
};
