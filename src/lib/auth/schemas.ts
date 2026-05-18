import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

/**
 * Special-character class for password strength. Matches anything
 * that is NOT a letter, digit, or whitespace — broad enough to cover
 * different keyboard layouts while narrow enough that a stray space
 * cannot count as a special character.
 */
export const PASSWORD_SPECIAL_REGEX = /[^A-Za-z0-9\s]/;

export const PASSWORD_RULE_MESSAGE =
  "Password must be at least 12 characters and include one uppercase letter, one lowercase letter, one number, and one special character.";

/**
 * Check a password against the strength rules. Returns `null` when
 * every requirement is met, or the user-facing rule message when any
 * requirement is missing. Shared between server (zod) and client
 * (immediate-feedback form components) so the rule cannot drift.
 */
export function checkPasswordStrength(password: string): string | null {
  if (typeof password !== "string") return PASSWORD_RULE_MESSAGE;
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (password.length > PASSWORD_MAX_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!PASSWORD_SPECIAL_REGEX.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: "weak" })
  .max(PASSWORD_MAX_LENGTH, { message: "weak" })
  .regex(/[A-Z]/, { message: "weak" })
  .regex(/[a-z]/, { message: "weak" })
  .regex(/[0-9]/, { message: "weak" })
  .regex(PASSWORD_SPECIAL_REGEX, { message: "weak" });

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
