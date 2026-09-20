import { z } from "zod";

export const sessionIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive("Session ID must be a positive integer"),
});