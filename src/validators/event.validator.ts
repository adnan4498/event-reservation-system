import { string, z } from "zod";

const checkDescLen = (str: String) => {
  return str.trim().split(/\s+/).filter(Boolean).length >= 2;
};

export const idSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createEventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    location: z.string().min(1, "Location is required"),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    totalTickets: z.coerce
      .number()
      .int()
      .positive("Total tickets must be positive"),
    price: z.coerce.number().nonnegative("Price must be >= 0"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateEventSchema = z.object({
  title: z.string().min(1, "Title is Required").optional(),
  description: z
    .string()
    .min(1, "Description is Required")
    .refine(
      (text) => checkDescLen(text),
      "Description must be more than 2 words",
    )
    .optional(),
  createdById: z.coerce.number().int().positive().optional(),
  location: z.string().min(1, "location required").optional(),
  availableTickets: z.coerce.number().int().positive().optional(),
  totalTickets: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().int().positive().optional(),
  startTime: z.iso.datetime().optional(),
  endTime: z.iso.datetime().optional(),
});

export const eventIdParamSchema = z.object({
  id: z.coerce.number().int().positive("ID must be a positive integer"),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type IdParams = z.infer<typeof idSchema>;
