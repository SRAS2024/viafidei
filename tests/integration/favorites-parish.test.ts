// Integration: a favorited PARISH really persists, and comes back out of the
// same list the /profile/favorites page reads.
//
// Everything above this (button → route → data layer) is unit-tested with the
// data layer mocked; this proves the last hop against a real Postgres, using a
// parish slug at the worker's 80-character cap — the shape that was silently
// unsaveable through the HTTP route.
//
// Excluded from the default `npm test` run; runs under VITEST_INTEGRATION=1
// against an isolated test database (see tests/setup.integration.ts).

import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { isSaved, listSavedParishes, saveItem, unsaveItem } from "@/lib/data/saved";

const LONG_SLUG =
  "katedra-polowa-wojska-polskiego-najswietszej-maryi-panny-krolowej-polski-warszaw";
const UNPUBLISHED_SLUG = "integration-test-unpublished-parish";
const CHECKLIST_PREFIX = "integration-favorites-parish";

async function seedUser() {
  return prisma.user.create({
    data: {
      email: `favorites-parish-${Date.now()}@integration.test`,
      passwordHash: "not-a-real-hash",
      firstName: "Fav",
      lastName: "Test",
    },
  });
}

async function seedParish(slug: string, isPublished: boolean) {
  return prisma.publishedContent.create({
    data: {
      checklistItemId: `${CHECKLIST_PREFIX}-${slug}`,
      contentType: "PARISH",
      slug,
      title: "Katedra Polowa Wojska Polskiego",
      payload: { address: "Dluga 13/15", city: "Warszawa", country: "Poland" },
      authorityLevel: "DIOCESAN",
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
  });
}

afterEach(async () => {
  await prisma.userSavedContent.deleteMany({
    where: { contentSlug: { in: [LONG_SLUG, UNPUBLISHED_SLUG] } },
  });
  await prisma.publishedContent.deleteMany({
    where: { checklistItemId: { startsWith: CHECKLIST_PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { contains: "@integration.test" } } });
});

describe("favoriting a parish (real DB)", () => {
  it("persists the save and returns it from the favorites list, then removes it", async () => {
    const user = await seedUser();
    await seedParish(LONG_SLUG, true);

    expect(await isSaved("parish", user.id, LONG_SLUG)).toBe(false);

    const saved = await saveItem("parish", user.id, LONG_SLUG);
    expect(saved).toEqual({ ok: true, created: true });
    expect(await isSaved("parish", user.id, LONG_SLUG)).toBe(true);

    // The exact call /profile/favorites makes for the Parishes filter.
    const listed = await listSavedParishes(user.id);
    expect(listed.map((r) => r.slug)).toEqual([LONG_SLUG]);
    expect(listed[0]?.title).toBe("Katedra Polowa Wojska Polskiego");
    expect(listed[0]?.contentType).toBe("PARISH");

    // Favoriting twice is idempotent, not a duplicate row.
    expect(await saveItem("parish", user.id, LONG_SLUG)).toEqual({ ok: true, created: false });
    expect(await listSavedParishes(user.id)).toHaveLength(1);

    const removed = await unsaveItem("parish", user.id, LONG_SLUG);
    expect(removed).toEqual({ ok: true, removed: true });
    expect(await isSaved("parish", user.id, LONG_SLUG)).toBe(false);
    expect(await listSavedParishes(user.id)).toHaveLength(0);
  });

  it("refuses to save a parish that is not published", async () => {
    const user = await seedUser();
    await seedParish(UNPUBLISHED_SLUG, false);

    expect(await saveItem("parish", user.id, UNPUBLISHED_SLUG)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await listSavedParishes(user.id)).toHaveLength(0);
  });
});
