import prisma from "../lib/prisma.js";
import type {
  CreateEventInput,
  UpdateEventInput,
} from "../validators/event.validator.js";
import type { Prisma } from "@prisma/client";
import { AppError } from "../errors/app-error.js";

export const eventById = async (id: number) => {
  const findEvent = await prisma.event.findUnique({ where: { id } });

  return findEvent;
};

export const createEvent = async (
  body: Omit<CreateEventInput, "createdById">,
  createdById: number,
) => {
  return await prisma.event.create({
    data: {
      title: body.title,
      description: body.description,
      createdById,
      availableTickets: body.totalTickets, // always equal to totalTickets at creation
      location: body.location,
      totalTickets: body.totalTickets,
      price: body.price,
      startTime: body.startTime,
      endTime: body.endTime,
    },
  });
};

export const updateEvent = async (id: number, data: UpdateEventInput) => {
  const event = await prisma.event.findUnique({
    where: { id: id },
  });

  if (!event) throw new AppError("Event Dates not found", 400);

  const eventUpdated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
    SELECT "totalTickets" FROM "Event" WHERE id = ${id} FOR UPDATE
    `;

    const finalStartTime = data.startTime
      ? new Date(data.startTime)
      : new Date(event.startTime);
    const finalEndTime = data.endTime
      ? new Date(data.endTime)
      : new Date(event.endTime);

    if (finalEndTime < finalStartTime) {
      throw new AppError("Event cannot end before it starts", 400);
    }

    const totalReservations = await tx.reservation.count({
      where: { eventId: id },
    });

    let newAvailableTickets;

    if (data.totalTickets) {
      if (data.totalTickets < totalReservations) {
        throw new AppError(
          "total tickets cannot be lower than total sales",
          400,
        );
      }
      newAvailableTickets = data.totalTickets - totalReservations;
    }

    return await tx.event.updateMany({
      where: { id },
      data: {
        ...(data as Prisma.EventUpdateManyMutationInput),
        ...(newAvailableTickets !== undefined
          ? { availableTickets: newAvailableTickets }
          : {}),
      },
    });
  });

  return eventUpdated;
};

export const deleteEvent = async (id: number) => {
  const reservations = await prisma.reservation.count({
    where: { eventId: id },
  });

  if (reservations != 0)
    throw new AppError(
      "Seats are booked for this event, either refund or inform",
      400,
    );

  return await prisma.event.delete({
    where: { id },
  });
};
