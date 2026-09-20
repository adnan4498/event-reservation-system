import type { Request, Response } from "express";
import {
  createReservation,
  deleteReservation,
  getReservationById,
  getReservationByUserId,
} from "../services/reservation.service.js";
import { AppError } from "../errors/app-error.js";

export const createReservationController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User ID missing" });
  }
  if (!req.user) throw new AppError("Authentication required", 401);

  let reservation = await createReservation(userId, req.body);

  res.status(200).json({
    message: "Reservation Created",
    data: reservation,
  });
};

export const deleteReservationController = async (
  req: Request,
  res: Response,
) => {
  if (!req.user) throw new AppError("Authentication required", 401);

  let reservationId = Number(req.params.id);
  const reservationDeleted = await deleteReservation(reservationId, req.user.id);

  res.status(200).json({
    message: "Reservation Deleted",
    data: reservationDeleted,
  });
};

export const getReservationByIdController = async (
  req: Request,
  res: Response,
) => {
  if (!req.user) throw new AppError("Authentication required", 401);

  let id = req.user.id;
  const reservation = await getReservationByUserId(id);

  if (!reservation) throw new AppError("No Reservation Found", 404);

  res.status(200).json({
    data: reservation,
  });
};
