import type { Request, Response } from "express";
import {
  createEvent,
  deleteEvent,
  eventById,
  updateEvent,
} from "../services/event.service.js";
import type { CreateEventInput } from "../validators/event.validator.js";
import { AppError } from "../errors/app-error.js";

export const createEventController = async (
  req: Request<{}, {}, CreateEventInput>,
  res: Response,
) => {
  if (!req.user) throw new AppError("Unauthorized", 401);

  const event = await createEvent(req.body, req.user.id);

  res.status(201).json({ success: true, data: event });
};

export const getEventByIdController = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const event = await eventById(id);

  if (!event) throw new AppError("Event not found", 404);

  res.status(200).json({ success: true, data: event });
};

export const updateEventController = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const updatedEvent = await updateEvent(id, req.body);

  res.status(200).json({ success: true, data: updatedEvent });
};

export const deleteEventController = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deleteEvent(id);

  res.status(204).send();
};