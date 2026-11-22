/**
 * /api/pray-along: the playlist a press of the megaphone plays, built from the
 * published record in the listener's voice — never from words the request supplies.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const script = {
  lang: "en",
  items: [
    {
      kind: "say",
      text: "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
      lang: "en",
    },
    { kind: "pause", ms: 1100 },
    { kind: "say", text: "Hail Mary, full of grace.", lang: "en" },
  ],
};

const builders = vi.hoisted(() => ({
  scriptForPrayer: vi.fn(),
  scriptForNovenaDay: vi.fn(),
  scriptForRosary: vi.fn(),
  scriptForGuide: vi.fn(),
}));
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
const profile = vi.hoisted(() => ({ getProfileForUser: vi.fn() }));
const store = vi.hoisted(() => ({ buildManifest: vi.fn() }));

vi.mock("@/lib/pray-along/server", () => builders);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/data/profile", () => profile);
vi.mock("@/lib/pray-along/store", () => store);
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "es") }));
vi.mock("@/lib/security/rate-limit", () => ({
  RATE_POLICIES: { prayAlong: { windowMs: 60_000, max: 90 } },
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 })),
}));

import { GET } from "@/app/api/pray-along/route";

const ask = (query: string) =>
  GET(new NextRequest(new Request(`http://localhost/api/pray-along?${query}`)));

beforeEach(() => {
  vi.clearAllMocks();
  builders.scriptForPrayer.mockResolvedValue({ title: "Hail Mary", script });
  builders.scriptForNovenaDay.mockResolvedValue({ title: "Day 3", script });
  builders.scriptForRosary.mockResolvedValue({ title: "The Holy Rosary", script });
  builders.scriptForGuide.mockResolvedValue({ title: "A guide", script });
  auth.requireUser.mockResolvedValue(null);
  store.buildManifest.mockImplementation(async (_s: unknown, voice: string) => ({
    lang: "en",
    voice,
    total: 2,
    ready: 1,
    missing: 0,
    items: [
      { type: "clip", key: "c".repeat(40), ready: true, version: "mwq7iszf" },
      { type: "pause", ms: 1100 },
      { type: "clip", key: "d".repeat(40), ready: false, version: null },
    ],
  }));
});

/** The clip URLs of a playlist, in order. */
const clipUrls = async (query: string) =>
  ((await (await ask(query)).json()).items as { type: string; url?: string }[])
    .filter((item) => item.type === "clip")
    .map((item) => item.url);

describe("/api/pray-along", () => {
  it("refuses requests it cannot build from a published record", async () => {
    for (const q of [
      "",
      "kind=poem",
      "kind=prayer",
      "kind=prayer&slug=../x",
      "kind=novena&slug=x&day=0",
      "kind=novena&slug=x&day=abc",
    ]) {
      expect((await ask(q)).status, q).toBe(400);
    }
  });

  it("gives the clips and pauses, with the clip URLs and readiness, never cached", async () => {
    const res = await ask("kind=prayer&slug=hail-mary&chosen=la");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.title).toBe("Hail Mary");
    expect(body.items).toEqual([
      { type: "clip", url: `/api/pray-along/clip/${"c".repeat(40)}?v=mwq7iszf`, ready: true },
      { type: "pause", ms: 1100 },
      { type: "clip", url: `/api/pray-along/clip/${"d".repeat(40)}`, ready: false },
    ]);
    // The reader's language and their Latin choice reach the builder.
    expect(builders.scriptForPrayer).toHaveBeenCalledWith("hail-mary", "la", "es");
  });

  it("names a made clip's version in its URL, so only a clip made again gets a new one", async () => {
    /** Two clips, each with its version, or null while it is not made. */
    const playlist = (c: string | null, d: string | null) => ({
      lang: "en",
      voice: "female",
      total: 2,
      ready: [c, d].filter((v) => v !== null).length,
      items: [
        { type: "clip", key: "c".repeat(40), ready: c !== null, version: c },
        { type: "pause", ms: 1100 },
        { type: "clip", key: "d".repeat(40), ready: d !== null, version: d },
      ],
    });
    const C = `/api/pray-along/clip/${"c".repeat(40)}`;
    const D = `/api/pray-along/clip/${"d".repeat(40)}`;
    const urls = () => clipUrls("kind=prayer&slug=hail-mary");
    // Only a made clip has a version: one not made yet keeps the bare URL until it is.
    store.buildManifest.mockResolvedValueOnce(playlist("mwq7iszf", null));
    expect(await urls()).toEqual([`${C}?v=mwq7iszf`, D]);
    // The second made since: its URL names its version, and the first keeps its URL, so
    // browsers keep playing it from their caches.
    store.buildManifest.mockResolvedValueOnce(playlist("mwq7iszf", "mwqi0k3a"));
    expect(await urls()).toEqual([`${C}?v=mwq7iszf`, `${D}?v=mwqi0k3a`]);
    // The first made again: a new URL, so browsers that kept its old audio fetch the new.
    store.buildManifest.mockResolvedValueOnce(playlist("mwqhdc0f", "mwqi0k3a"));
    const remade = await urls();
    expect(remade).toEqual([`${C}?v=mwqhdc0f`, `${D}?v=mwqi0k3a`]);
    // The browser tests (e2e/) find the clips by this part of the URL.
    for (const url of remade) expect(url).toContain("/api/pray-along/clip/");
  });

  it("marks a line no voice can say as missing, and nothing of why leaves the server", async () => {
    store.buildManifest.mockResolvedValueOnce({
      lang: "la",
      voice: "female",
      total: 2,
      ready: 1,
      missing: 1,
      items: [
        { type: "clip", key: "c".repeat(40), ready: true, version: "mwq7iszf" },
        { type: "pause", ms: 1100 },
        { type: "clip", key: "d".repeat(40), ready: false, version: null, missing: true },
      ],
    });
    const body = await (await ask("kind=prayer&slug=memorare&chosen=la")).json();
    // Only the missing line says so; the player needs no more to tell the reader at once.
    expect(body.items).toEqual([
      { type: "clip", url: `/api/pray-along/clip/${"c".repeat(40)}?v=mwq7iszf`, ready: true },
      { type: "pause", ms: 1100 },
      { type: "clip", url: `/api/pray-along/clip/${"d".repeat(40)}`, ready: false, missing: true },
    ]);
    expect(body).toMatchObject({ total: 2, ready: 1, missing: 1 });
    // No error text, attempt count or claim: the playlist's fields are these and no more.
    expect(Object.keys(body).sort()).toEqual([
      "items",
      "lang",
      "member",
      "missing",
      "rate",
      "ready",
      "title",
      "total",
      "voice",
    ]);
  });

  it("uses the female voice for a signed-out visitor and a member's own choice otherwise", async () => {
    expect((await (await ask("kind=prayer&slug=hail-mary")).json()).voice).toBe("female");
    auth.requireUser.mockResolvedValue({ id: "u1" });
    profile.getProfileForUser.mockResolvedValue({ audioVoice: "male" });
    expect((await (await ask("kind=prayer&slug=hail-mary")).json()).voice).toBe("male");
    profile.getProfileForUser.mockResolvedValue({ audioVoice: null });
    expect((await (await ask("kind=prayer&slug=hail-mary")).json()).voice).toBe("female");
  });

  it("tells the player whether the listener is a member and the speed their account keeps", async () => {
    let body = await (await ask("kind=prayer&slug=hail-mary")).json();
    expect(body).toMatchObject({ member: false, rate: null });
    auth.requireUser.mockResolvedValue({ id: "u1" });
    profile.getProfileForUser.mockResolvedValue({ audioVoice: null, audioRate: 1.25 });
    body = await (await ask("kind=prayer&slug=hail-mary")).json();
    expect(body).toMatchObject({ member: true, rate: 1.25 });
    profile.getProfileForUser.mockResolvedValue({ audioVoice: null, audioRate: null });
    expect(await (await ask("kind=prayer&slug=hail-mary")).json()).toMatchObject({
      member: true,
      rate: null,
    });
    // A stored value that is not one of the speeds is never passed on.
    profile.getProfileForUser.mockResolvedValue({ audioVoice: null, audioRate: 3 });
    expect((await (await ask("kind=prayer&slug=hail-mary")).json()).rate).toBeNull();
  });

  it("asks for a novena's day by its number and the Rosary by its set", async () => {
    await ask("kind=novena&slug=divine-mercy-novena&day=3");
    expect(builders.scriptForNovenaDay).toHaveBeenCalledWith("divine-mercy-novena", 2, null, "es");
    await ask("kind=guide&slug=how-to-pray-the-rosary&set=sorrowful");
    expect(builders.scriptForGuide).toHaveBeenCalledWith(
      "how-to-pray-the-rosary",
      null,
      "es",
      "sorrowful",
    );
    await ask("kind=rosary&set=nonsense");
    expect(builders.scriptForRosary).toHaveBeenCalledWith("joyful", null, "es");
  });

  it("says not found when there is nothing to pray", async () => {
    builders.scriptForPrayer.mockResolvedValue(null);
    expect((await ask("kind=prayer&slug=missing")).status).toBe(404);
  });
});
