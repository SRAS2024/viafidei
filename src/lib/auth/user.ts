import { prisma } from "../db/client";
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "../i18n/locales";
import { encryptAtRest } from "../security/crypto";
import { hashPassword, verifyPassword } from "./password";
import { getSession } from "./session";

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  language?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveCreationLocale(input: string | null | undefined): Locale {
  if (input && isSupportedLocale(input)) return input;
  return DEFAULT_LOCALE;
}

export async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = normalizeEmail(input.email);
  const language = resolveCreationLocale(input.language);
  return prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: normalizedEmail,
      passwordHash,
      language,
      emailEncrypted: encryptAtRest(normalizedEmail),
      nameEncrypted: encryptAtRest(`${input.firstName} ${input.lastName}`),
      profile: { create: { languageOverride: language } },
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
}

export async function authenticate(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (user.role !== "USER") return null;
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return null;
  return user;
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}
