import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: any; // Replace 'any' with your User type if available
    }
  }
} 