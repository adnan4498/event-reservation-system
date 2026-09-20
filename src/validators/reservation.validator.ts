import z from "zod";

export const createReservationSchema = z.object({
  eventId: z.coerce.number().int().positive("Event ID must be a positive integer"),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>
