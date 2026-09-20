import type { Request, Response } from "express";
import { registerUser, getUserById } from "../services/user.service.js";

export const registerUserController = async (req: Request, res: Response) => {
  const userCreated = await registerUser(req.body);

  res.status(200).json({
    messag: "User Created",
    data: userCreated,
  });
};

export const getUserByIdController = async (req: Request, res: Response) => {
  let user = await getUserById(Number(req.params.id))

  res.status(200).json({
    data : user
  })
}
