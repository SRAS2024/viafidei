import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "./db";
import { encryptAtRest } from "./crypto";
import { getSession } from "./session";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

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

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export async function createUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: normalizedEmail,
      passwordHash,
      emailEncrypted: encryptAtRest(normalizedEmail),
      nameEncrypted: encryptAtRest(`${input.firstName} ${input.lastName}`),
      profile: { create: {} },
    },
  });
  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) return null;
  if (user.role !== "USER") return null; // /login is strictly for users
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return null;
  return user;
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user;
}
