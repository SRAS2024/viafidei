import { vi } from "vitest";

// A minimal hand-rolled Prisma mock. We only mock the surface area the auth
// and rate-limit modules actually call. Tests reach in and re-program the
// individual `mockResolvedValue` / `mockImplementation` per case.

type Mock = ReturnType<typeof vi.fn>;

type Crud = {
  create: Mock;
  findFirst: Mock;
  findUnique: Mock;
  findMany: Mock;
  update: Mock;
  upsert: Mock;
  delete: Mock;
  deleteMany: Mock;
  count: Mock;
};

function createCrud(): Crud {
  return {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

export type PrismaMock = {
  user: {
    create: Mock;
    findUnique: Mock;
    update: Mock;
  };
  passwordResetToken: {
    create: Mock;
    findUnique: Mock;
    update: Mock;
    updateMany: Mock;
    deleteMany: Mock;
  };
  emailVerificationToken: {
    create: Mock;
    findUnique: Mock;
    update: Mock;
    deleteMany: Mock;
  };
  session: {
    deleteMany: Mock;
  };
  rateLimitBucket: {
    deleteMany: Mock;
  };
  // Content-side models the ingestion / data layers use. These are all
  // generic CRUD shapes — tests reach in and program the methods they
  // care about per case.
  prayer: Crud;
  saint: Crud;
  marianApparition: Crud;
  parish: Crud;
  devotion: Crud;
  liturgyEntry: Crud;
  spiritualLifeGuide: Crud;
  ingestionJob: Crud;
  ingestionJobRun: Crud;
  ingestionSource: Crud;
  tag: Crud;
  entityTag: Crud;
  $transaction: Mock;
  $queryRaw: Mock;
};

export function createPrismaMock(): PrismaMock {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    rateLimitBucket: {
      deleteMany: vi.fn(),
    },
    prayer: createCrud(),
    saint: createCrud(),
    marianApparition: createCrud(),
    parish: createCrud(),
    devotion: createCrud(),
    liturgyEntry: createCrud(),
    spiritualLifeGuide: createCrud(),
    ingestionJob: createCrud(),
    ingestionJobRun: createCrud(),
    ingestionSource: createCrud(),
    tag: createCrud(),
    entityTag: createCrud(),
    // Default $transaction implementation just resolves the array of
    // promises so tests that don't override it still get sane behavior.
    $transaction: vi.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === "function") return (ops as (tx: unknown) => unknown)({});
      return ops;
    }),
    $queryRaw: vi.fn(),
  };
}

// Singleton — both `@/lib/db` and `../db/client` resolve to the same mock so
// modules that import from either path see the same behavior in tests.
export const prismaMock: PrismaMock = createPrismaMock();

export function resetPrismaMock(): void {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === "function") {
      (model as Mock).mockReset();
      continue;
    }
    if (model && typeof model === "object") {
      for (const fn of Object.values(model)) {
        if (typeof fn === "function") (fn as Mock).mockReset();
      }
    }
  }
  // Re-install the default $transaction behavior after reset.
  prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === "function") return (ops as (tx: unknown) => unknown)({});
    return ops;
  });
}
