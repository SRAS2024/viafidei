import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const queryRawMock = vi.fn();
const executeRawMock = vi.fn();
const executeRawUnsafeMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
    $executeRaw: (...args: unknown[]) => executeRawMock(...args),
    $executeRawUnsafe: (...args: unknown[]) => executeRawUnsafeMock(...args),
  },
}));

import { checkAuthTokenStorage, resetAuthStorageProbeCache } from "@/lib/security/auth-storage";

const REPO_ROOT = path.resolve(__dirname, "../..");
const AUTH_ROUTES_DIR = path.join(REPO_ROOT, "src/app/api/auth");

// Statements that change schema. A request handler on an unauthenticated
// path must never issue any of them: doing so needs a runtime database role
// that holds CREATE/ALTER rights, takes schema locks under attacker-driven
// concurrency, and hides a broken deploy instead of surfacing it.
const DDL_PATTERNS: ReadonlyArray<RegExp> = [
  /\bCREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|SCHEMA|VIEW|TYPE)\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bDROP\s+(?:TABLE|INDEX|COLUMN)\b/i,
];

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectRouteFiles(full));
    else if (entry.isFile() && entry.name === "route.ts") out.push(full);
  }
  return out;
}

describe("authentication routes run no DDL while handling a request", () => {
  const routeFiles = collectRouteFiles(AUTH_ROUTES_DIR);

  it("finds the auth routes (guards against the scan silently matching nothing)", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(5);
  });

  it.each(routeFiles.map((file) => [path.relative(REPO_ROOT, file), file]))(
    "%s contains no schema-changing SQL",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      for (const pattern of DDL_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    },
  );

  it.each(routeFiles.map((file) => [path.relative(REPO_ROOT, file), file]))(
    "%s issues no raw SQL execution and does not import the schema-creation helper",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("$executeRaw");
      expect(source).not.toContain("$queryRawUnsafe");
      // ensureAccountEmailTables() is the CREATE TABLE / ALTER TABLE helper.
      // It belongs to startup and migrations, never to a request handler.
      expect(source).not.toContain("ensureAccountEmailTables");
      expect(source).not.toContain("startup/ensure-email-tables");
    },
  );

  it("the storage probe itself is read-only", () => {
    const source = readFileSync(path.join(REPO_ROOT, "src/lib/security/auth-storage.ts"), "utf8");
    for (const pattern of DDL_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
    expect(source).not.toContain("$executeRaw");
  });
});

describe("checkAuthTokenStorage — verifies, never repairs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStorageProbeCache();
  });

  it("reports ok when both token tables are present, and executes no write", async () => {
    queryRawMock.mockResolvedValue([
      { tablename: "PasswordResetToken" },
      { tablename: "EmailVerificationToken" },
    ]);
    await expect(checkAuthTokenStorage()).resolves.toEqual({ ok: true });
    expect(executeRawMock).not.toHaveBeenCalled();
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it("names the missing tables instead of creating them", async () => {
    queryRawMock.mockResolvedValue([{ tablename: "EmailVerificationToken" }]);
    await expect(checkAuthTokenStorage()).resolves.toEqual({
      ok: false,
      reason: "missing_tables",
      missing: ["PasswordResetToken"],
    });
    expect(executeRawMock).not.toHaveBeenCalled();
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it("caches a healthy result but never caches a failure", async () => {
    queryRawMock.mockResolvedValue([]);
    await checkAuthTokenStorage();
    await checkAuthTokenStorage();
    // Both calls hit the database: a broken schema that later gets migrated
    // must recover without restarting the process.
    expect(queryRawMock).toHaveBeenCalledTimes(2);

    queryRawMock.mockResolvedValue([
      { tablename: "PasswordResetToken" },
      { tablename: "EmailVerificationToken" },
    ]);
    await checkAuthTokenStorage();
    await checkAuthTokenStorage();
    expect(queryRawMock).toHaveBeenCalledTimes(3);
  });

  it("reports an unreachable database without leaking the connection password", async () => {
    queryRawMock.mockRejectedValue(
      new Error("Can't reach database server at postgresql://viafidei:hunter2@db.internal:5432/x"),
    );
    const result = await checkAuthTokenStorage();
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "unreachable") {
      expect(result.detail).not.toContain("hunter2");
      expect(result.detail).toContain("[redacted]@");
    } else {
      throw new Error("expected an unreachable result");
    }
  });
});
