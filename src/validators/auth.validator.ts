import z from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is Required"),
  email: z.email("Invalid Email"),
  password: z.string().min(2, "Password must be at least 2 characters"),
  role: z.enum(["USER", "ADMIN"]),
});

export const loginSchema = z.object({
  email: z.email().min(1, "Email Required"),
  password: z.string().min(1, "Password is Required"),
});

export const forgotPasswordSchema = z.object({
  email : z.email("Invalid Email")
})

export const resetPasswordSchema = z.object({
  token : z.string().min(1, "Token is Required"),
  newPassword : z.string().min(3, "Password must be atleast 3 letters")
})

export type RegisterInputSchema = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
