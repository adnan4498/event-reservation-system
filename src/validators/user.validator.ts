import z from "zod";

export const registerUserSchema = z.object({
  name : z.string().min(1, "Name is Required"),
  email : z.email("Invalid Email"),
  password : z.string().min(2, "Password must be at least 2 characters"),
  role : z.enum(["USER", 'ADMIN']).optional()
})

export type CreateUserInput = z.infer<typeof registerUserSchema>
