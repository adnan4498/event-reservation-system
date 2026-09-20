import { Router } from "express";
import {
  createEventController,
  deleteEventController,
  getEventByIdController,
  updateEventController,
} from "../controllers/event.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createEventSchema,
  idSchema,
  updateEventSchema,
} from "../validators/event.validator.js";
import { authenticate, requiredRole } from "../middleware/auth.middleware.js";

const eventRouter = Router();

eventRouter.get("/:id", validate({ params: idSchema }), getEventByIdController);

eventRouter.post(
  "/create",
  authenticate,
  validate({ body: createEventSchema }),
  requiredRole("ADMIN"),
  createEventController,
);

eventRouter.put(
  "/update/:id",
  authenticate,
  validate({ params: idSchema, body: updateEventSchema }),
  requiredRole("ADMIN"),
  updateEventController,
);

eventRouter.delete(
  "/:id",
  authenticate,
  requiredRole("ADMIN"),
  validate({ params: idSchema }),
  deleteEventController,
);

export default eventRouter;