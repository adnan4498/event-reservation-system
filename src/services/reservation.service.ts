import { AppError } from "../errors/app-error.js";
import prisma from "../lib/prisma.js";
import type { CreateReservationInput } from "../validators/reservation.validator.js";
import type { Event } from "@prisma/client";
import { getUserById } from "./user.service.js";
import { reservationQueue } from "../lib/queue.js";

export const createReservation = async (
  userId: number,
  data: CreateReservationInput,
) => {
  const eventId = data.eventId;

  const newReservation = await prisma.$transaction(async (tx) => {
    const [event]: Event[] = await tx.$queryRaw`
        SELECT * FROM "Event" WHERE id = ${eventId} FOR UPDATE
        `;

    if (!event) throw new AppError("Event not found", 404);

    const bookings = await tx.reservation.count({
      where: { eventId },
    });

    if (bookings >= event?.availableTickets) {
      throw new AppError("Event full", 422);
    }

    await tx.event.update({
      where : {id : eventId},
      data : {
        availableTickets : {
          decrement : 1
        }
      }
    })

    return await tx.reservation.create({
      data: {
        eventId: eventId,
        userId: userId,
      },
    });
  });

  await reservationQueue.add(
    "send-reservation-confirmation",
    { reservationId: newReservation.id, userId, eventId },
    { attempts: 5, backoff: { type: "exponential", delay: 1000 } },
  );

  return newReservation;
};

export const getReservationById = async (id: number) => {
  return prisma.reservation.findUnique({
    where: { id },
  });
};

export const getReservationByUserId = async (id: number) => {
  return prisma.reservation.findFirst({
    where: {
      userId: id,
    },
    include: {
      event: true,
    },
  });
};

export const deleteReservation = async (
  reservationId: number,
  userId: number,
) => {
  const reservation = await getReservationById(reservationId);
  // const reservation = await getReservationByUserId(userId);

  if (!reservation) throw new AppError("Reservation not found", 404);

  const user = await getUserById(userId);

  if (user?.reservations[0]?.id != reservation.id)
    throw new AppError("Reservation not owned by user", 404);

  return prisma.reservation.deleteMany({
    where: {
      id: reservationId,
      userId: userId,
    },
  });
};
