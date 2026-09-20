import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { registerUserController, getUserByIdController } from "../controllers/user.controller.js";
import { registerUserSchema } from "../validators/user.validator.js";
import { idSchema } from "../validators/event.validator.js";

const userRouter = Router();

// userRouter.post("/register", validate({body : registerUserSchema}), registerUserController)
userRouter.get("/:id", validate({params : idSchema}), getUserByIdController)

export default userRouter;