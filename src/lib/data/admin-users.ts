import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { isSupportedLocale } from "../i18n/locales";

export type AdminUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  language: string;
  createdAt: Date;
  emailVerified: boolean;
  role: string;
};

export type ListAdminUsersInput = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ListAdminUsersResult = {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function listAdminUsers(input: ListAdminUsersInput): Promise<ListAdminUsersResult> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  const search = (input.search ?? "").trim();

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    // Explicit projection — never selects passwordHash, encrypted columns,
    // tokens, or sessions.
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        language: true,
        emailVerifiedAt: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const safeRows: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    language: isSupportedLocale(u.language) ? u.language : "en",
    createdAt: u.createdAt,
    emailVerified: u.emailVerifiedAt != null,
    role: u.role,
  }));

  return {
    rows: safeRows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
