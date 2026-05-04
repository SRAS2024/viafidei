import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listAdminUsers } from "@/lib/data/admin-users";

beforeEach(() => {
  resetPrismaMock();
  // findMany / count aren't on the default prisma mock surface; bolt on
  // ad-hoc mocks for this module's queries.
  // @ts-expect-error - extending the mock for this test
  prismaMock.user.findMany = vi.fn();
  // @ts-expect-error - extending the mock for this test
  prismaMock.user.count = vi.fn();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("listAdminUsers", () => {
  it("only selects safe fields (no passwordHash, no tokens, no encrypted blobs)", async () => {
    // @ts-expect-error
    prismaMock.user.findMany.mockResolvedValue([]);
    // @ts-expect-error
    prismaMock.user.count.mockResolvedValue(0);

    await listAdminUsers({ search: "", page: 1, pageSize: 10 });

    // @ts-expect-error
    const args = prismaMock.user.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(args.select.passwordHash).toBeUndefined();
    expect(args.select.emailEncrypted).toBeUndefined();
    expect(args.select.nameEncrypted).toBeUndefined();
    // Required visible fields:
    expect(args.select.id).toBe(true);
    expect(args.select.firstName).toBe(true);
    expect(args.select.lastName).toBe(true);
    expect(args.select.email).toBe(true);
    expect(args.select.language).toBe(true);
    expect(args.select.createdAt).toBe(true);
  });

  it("returns rows mapped to safe shape with language fallback", async () => {
    // @ts-expect-error
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "u1",
        firstName: "Maria",
        lastName: "Goretti",
        email: "m@example.com",
        language: "klingon",
        emailVerifiedAt: null,
        role: "USER",
        createdAt: new Date("2024-01-01"),
      },
    ]);
    // @ts-expect-error
    prismaMock.user.count.mockResolvedValue(1);

    const result = await listAdminUsers({ search: "", page: 1, pageSize: 10 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].language).toBe("en");
    expect(result.rows[0]).not.toHaveProperty("passwordHash");
    expect(result.rows[0]).not.toHaveProperty("emailEncrypted");
  });

  it("supports search across firstName, lastName, and email", async () => {
    // @ts-expect-error
    prismaMock.user.findMany.mockResolvedValue([]);
    // @ts-expect-error
    prismaMock.user.count.mockResolvedValue(0);

    await listAdminUsers({ search: "maria", page: 1, pageSize: 10 });
    // @ts-expect-error
    const args = prismaMock.user.findMany.mock.calls[0][0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    expect(args.where.OR.length).toBe(3);
  });

  it("paginates correctly", async () => {
    // @ts-expect-error
    prismaMock.user.findMany.mockResolvedValue([]);
    // @ts-expect-error
    prismaMock.user.count.mockResolvedValue(45);

    const result = await listAdminUsers({ page: 3, pageSize: 10 });
    expect(result.pageCount).toBe(5);
    expect(result.page).toBe(3);
    // @ts-expect-error
    const args = prismaMock.user.findMany.mock.calls[0][0] as { skip: number; take: number };
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });
});
