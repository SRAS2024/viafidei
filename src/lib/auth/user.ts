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

/**
 * Create a User row plus its associated Profile in a single Prisma create.
 * The nested `profile: { create: ... }` runs both inserts in the same
 * implicit transaction, so a Profile that fails to write rolls back the
 * User insert too — there is no half-created user state to clean up later.
 *
 * Caller (the /api/auth/register route) is responsible for translating
 * Prisma errors (missing table, missing column, unique violation, etc.)
 * into the appropriate HTTP response and structured log lines.
 */
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
    include: { profile: true },
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

/**
 * Does a session cookie still speak for this account? A password reset gives the account
 * a new credential version, which no cookie issued earlier carries, so every earlier
 * sign-in ends there. NULL means the account's password has not been reset since the
 * column arrived: such an account accepts any cookie, so that adding the column signed
 * nobody out.
 */
function credentialsMatch(
  session: { credentialVersion?: string },
  account: { credentialVersion?: string | null },
): boolean {
  return (
    account.credentialVersion == null || session.credentialVersion === account.credentialVersion
  );
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId || session.role !== "USER") return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !credentialsMatch(session, user)) return null;
  return user;
}

/**
 * The same question for code that has a session in hand and needs nothing else of the
 * account: the header, deciding whether to say "signed in" on every page.
 */
export async function sessionCredentialsCurrent(session: {
  userId?: string;
  credentialVersion?: string;
}): Promise<boolean> {
  if (!session.userId) return false;
  const account = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { credentialVersion: true },
  });
  return account != null && credentialsMatch(session, account);
}
