import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import {
  listSessionsController,
  revokeSessionController,
  revokeAllOtherSessionsController,
} from "../controllers/session.controller.js";
import { sessionIdParamSchema } from "../validators/session.validator.js";

const sessionRouter = Router();

sessionRouter.use(authenticate);

sessionRouter.get("/", listSessionsController);
sessionRouter.delete("/", revokeAllOtherSessionsController);
sessionRouter.delete("/:sessionId", validate({ params: sessionIdParamSchema }), revokeSessionController);

export default sessionRouter;