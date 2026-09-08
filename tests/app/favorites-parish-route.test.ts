/**
 * /api/saved/parishes — the route behind the parish Favorite button.
 *
 * Two things are pinned here:
 *
 * 1. Long parish slugs. The worker slugifies parish names up to 80 characters
 *    and 29 of the 1,030 locally published parishes already exceed 64, so the
 *    old 64-char cap on `id` rejected them with 400 "invalid": the Favorite
 *    button showed a raw error and the parish could never be saved, while the
 *    same button worked on every prayer and saint (max slug 35 and 75).
 * 2. Signed-out requests are refused. The button must never rely on the API to
 *    tell a signed-out visitor to log in — it opens the popup client-side (see
 *    tests/components/SaveContentButton.test.tsx) — but the route still has to
 *    hold the line.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  rateLimitOk: true,
  saveOk: true,
}));

const saveItem = vi.hoisted(() => vi.fn());
const unsaveItem = vi.hoisted(() => vi.fn());
const listSavedParishes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: async () => state.user }));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: async () => ({ ok: state.rateLimitOk }),
  RATE_POLICIES: { savedItem: { windowMs: 60_000, max: 60 } },
}));
vi.mock("@/lib/data/saved", () => ({ saveItem, unsaveItem, listSavedParishes }));

import { NextRequest } from "next/server";

import { DELETE, GET, POST } from "@/app/api/saved/parishes/route";

/** A real 80-character parish slug — the worker's slugify cap. */
const LONG_SLUG =
  "katedra-polowa-wojska-polskiego-najswietszej-maryi-panny-krolowej-polski-warszaw";

function postReq(id: string): NextRequest {
  return new NextRequest("http://localhost/api/saved/parishes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

function deleteReq(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/saved/parishes?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

beforeEach(() => {
  state.user = { id: "user-1" };
  state.rateLimitOk = true;
  state.saveOk = true;
  saveItem
    .mockReset()
    .mockImplementation(async () =>
      state.saveOk ? { ok: true, created: true } : { ok: false, reason: "not_found" },
    );
  unsaveItem.mockReset().mockResolvedValue({ ok: true, removed: true });
  listSavedParishes.mockReset().mockResolvedValue([]);
});

describe("POST /api/saved/parishes", () => {
  it("saves a parish whose slug is longer than 64 characters", async () => {
    expect(LONG_SLUG.length).toBe(80);
    const res = await POST(postReq(LONG_SLUG));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, saved: true });
    expect(saveItem).toHaveBeenCalledWith("parish", "user-1", LONG_SLUG);
  });

  it("saves an ordinary short parish slug too", async () => {
    const res = await POST(postReq("st-marys-cathedral"));
    expect(res.status).toBe(200);
    expect(saveItem).toHaveBeenCalledWith("parish", "user-1", "st-marys-cathedral");
  });

  it("refuses a signed-out request", async () => {
    state.user = null;
    const res = await POST(postReq(LONG_SLUG));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "unauthorized" });
    expect(saveItem).not.toHaveBeenCalled();
  });

  it("reports not_found for a slug that is not a published parish", async () => {
    state.saveOk = false;
    const res = await POST(postReq("never-published"));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "not_found" });
  });

  it("still rejects an absurdly long id", async () => {
    const res = await POST(postReq("x".repeat(201)));
    expect(res.status).toBe(400);
    expect(saveItem).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/saved/parishes", () => {
  it("unfavourites a parish with a long slug", async () => {
    const res = await DELETE(deleteReq(LONG_SLUG));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, removed: true });
    expect(unsaveItem).toHaveBeenCalledWith("parish", "user-1", LONG_SLUG);
  });

  it("refuses a signed-out request", async () => {
    state.user = null;
    const res = await DELETE(deleteReq(LONG_SLUG));
    expect(res.status).toBe(401);
    expect(unsaveItem).not.toHaveBeenCalled();
  });
});

describe("GET /api/saved/parishes", () => {
  it("returns the signed-in user's saved parishes", async () => {
    listSavedParishes.mockResolvedValue([{ id: "s1", slug: LONG_SLUG, title: "Katedra" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      items: [{ slug: LONG_SLUG }],
    });
  });

  it("refuses a signed-out request", async () => {
    state.user = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
