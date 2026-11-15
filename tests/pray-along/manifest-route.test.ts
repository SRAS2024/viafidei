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
    items: [
      { type: "clip", key: "c".repeat(40), ready: true },
      { type: "pause", ms: 1100 },
      { type: "clip", key: "d".repeat(40), ready: false },
    ],
  }));
});

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
      { type: "clip", url: `/api/pray-along/clip/${"c".repeat(40)}`, ready: true },
      { type: "pause", ms: 1100 },
      { type: "clip", url: `/api/pray-along/clip/${"d".repeat(40)}`, ready: false },
    ]);
    // The reader's language and their Latin choice reach the builder.
    expect(builders.scriptForPrayer).toHaveBeenCalledWith("hail-mary", "la", "es");
  });

  it("uses the female voice for a signed-out visitor and a member's own choice otherwise", async () => {
    expect((await (await ask("kind=prayer&slug=hail-mary")).json()).voice).toBe("female");
    auth.requireUser.mockResolvedValue({ id: "u1" });
    profile.getProfileForUser.mockResolvedValue({ audioVoice: "male" });
    expect((await (await ask("kind=prayer&slug=hail-mary")).json()).voice).toBe("male");
    profile.getProfileForUser.mockResolvedValue({ audioVoice: null });
    expect((await (await ask("kind=prayer&slug=hail-mary")).json()).voice).toBe("female");
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
