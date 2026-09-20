import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { createReservationSchema } from "../validators/reservation.validator.js";
import { createReservationController, deleteReservationController, getReservationByIdController } from "../controllers/reservation.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { idSchema } from "../validators/event.validator.js";

const reservationRouter = Router();

reservationRouter.post(
  "/create",
  authenticate,
  validate({ body: createReservationSchema }),
  createReservationController
);

// reservationRouter.get("/my-reservation", authenticate, validate({params: idSchema}), getReservationByIdController)
reservationRouter.get("/my-reservation", authenticate, getReservationByIdController)

reservationRouter.delete("/:id", authenticate, validate({params: idSchema}), deleteReservationController)

export default reservationRouter;
