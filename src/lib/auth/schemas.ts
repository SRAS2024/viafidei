import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 5;
export const PASSWORD_MAX_LENGTH = 256;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: "weak" })
  .max(PASSWORD_MAX_LENGTH, { message: "weak" })
  .regex(/[0-9]/, { message: "weak" })
  .regex(/[A-Z]/, { message: "weak" });

export const registerSchema = z
  .object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email().max(200),
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    language: z.string().min(2).max(20).optional(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "mismatch",
  });

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const adminLoginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(256),
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "mismatch",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
