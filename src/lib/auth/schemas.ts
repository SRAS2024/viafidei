import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email().max(200),
    password: z.string().min(12).max(256),
    passwordConfirm: z.string().min(12).max(256),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "mismatch",
  });

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(256),
});

export const adminLoginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(256),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
