import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  updatePrayer,
  updateSaint,
  updateApparition,
  updateParish,
  updateDevotion,
  updateLiturgy,
  updateSpiritualLifeGuide,
} from "@/lib/data/admin-catalog";

beforeEach(() => {
  resetPrismaMock();
});

/**
 * Rule under test:
 *   - Auto-ingested rows already land as PUBLISHED (no admin approval needed).
 *   - When an admin manually edits content fields, the row drops back to
 *     DRAFT so the admin must explicitly republish.
 *   - When the admin passes an explicit status (status-only flip OR
 *     content-edit + explicit publish), that status is honored.
 */

const EXISTING_PUBLISHED = { id: "row-1", slug: "existing", status: "PUBLISHED" } as const;

describe("admin manual edit → DRAFT (Prayer)", () => {
  it("a PUBLISHED prayer drops to DRAFT when only the body is edited", async () => {
    prismaMock.prayer.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.prayer.update.mockResolvedValue({});

    await updatePrayer("row-1", { body: "Edited body" });

    const args = prismaMock.prayer.update.mock.calls[0][0];
    expect(args.data.status).toBe("DRAFT");
    expect(args.data.body).toBe("Edited body");
  });

  it("an explicit status flip with no content change keeps the chosen status", async () => {
    prismaMock.prayer.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.prayer.update.mockResolvedValue({});

    await updatePrayer("row-1", { status: "ARCHIVED" });

    const args = prismaMock.prayer.update.mock.calls[0][0];
    expect(args.data.status).toBe("ARCHIVED");
  });

  it("a content edit + explicit PUBLISHED honors the admin's explicit publish", async () => {
    prismaMock.prayer.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.prayer.update.mockResolvedValue({});

    await updatePrayer("row-1", { body: "Edited body", status: "PUBLISHED" });

    const args = prismaMock.prayer.update.mock.calls[0][0];
    expect(args.data.status).toBe("PUBLISHED");
  });
});

describe("admin manual edit → DRAFT (Saint)", () => {
  it("drops to DRAFT when biography is edited", async () => {
    prismaMock.saint.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.saint.update.mockResolvedValue({});

    await updateSaint("row-1", { biography: "Revised hagiography." });

    const args = prismaMock.saint.update.mock.calls[0][0];
    expect(args.data.status).toBe("DRAFT");
  });
});

describe("admin manual edit → DRAFT (Apparition)", () => {
  it("drops to DRAFT when summary is edited", async () => {
    prismaMock.marianApparition.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.marianApparition.update.mockResolvedValue({});

    await updateApparition("row-1", { summary: "Updated apparition summary." });

    const args = prismaMock.marianApparition.update.mock.calls[0][0];
    expect(args.data.status).toBe("DRAFT");
  });
});

describe("admin manual edit → DRAFT (Parish)", () => {
  it("drops to DRAFT when an address is edited", async () => {
    prismaMock.parish.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.parish.update.mockResolvedValue({});

    await updateParish("row-1", { address: "123 New Street" });

    const args = prismaMock.parish.update.mock.calls[0][0];
    expect(args.data.status).toBe("DRAFT");
  });
});

describe("admin manual edit → DRAFT (Devotion)", () => {
  it("drops to DRAFT when summary is edited", async () => {
    prismaMock.devotion.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.devotion.update.mockResolvedValue({});

    await updateDevotion("row-1", { summary: "Edited devotion summary." });

    const args = prismaMock.devotion.update.mock.calls[0][0];
    expect(args.data.status).toBe("DRAFT");
  });
});

describe("admin manual edit → DRAFT (Liturgy)", () => {
  it("drops to DRAFT when body is edited", async () => {
    prismaMock.liturgyEntry.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.liturgyEntry.update.mockResolvedValue({});

    await updateLiturgy("row-1", { body: "Updated catechism passage." });

    const args = prismaMock.liturgyEntry.update.mock.calls[0][0];
    expect(args.data.status).toBe("DRAFT");
  });
});

describe("admin manual edit → DRAFT (Spiritual Life Guide)", () => {
  it("drops to DRAFT when bodyText is edited", async () => {
    prismaMock.spiritualLifeGuide.findUnique.mockResolvedValue(EXISTING_PUBLISHED);
    prismaMock.spiritualLifeGuide.update.mockResolvedValue({});

    await updateSpiritualLifeGuide("row-1", { bodyText: "Step 1: Sign of the Cross." });

    const args = prismaMock.spiritualLifeGuide.update.mock.calls[0][0];
    expect(args.data.status).toBe("DRAFT");
  });
});
