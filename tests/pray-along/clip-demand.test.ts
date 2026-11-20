/**
 * A listener's request files the clips they are waiting for, and gives a clip that
 * failed its quality check another try (with new seeds, up to the engine's limit), so
 * one bad take never leaves a prayer unplayable for good.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ prisma: { $executeRaw: vi.fn(), prayerAudioClip: {} } }));
vi.mock("@/lib/db/client", () => db);

import { fileClipDemand, RETRY_FAILED_BELOW_ATTEMPTS } from "@/lib/pray-along/store";

const clip = {
  key: "a".repeat(40),
  lang: "en",
  voice: "female",
  voiceId: "qwen3-tts-1.7b-base:lock:en-female-v1",
  text: "Saint Peter, pray for us.",
};

beforeEach(() => {
  db.prisma.$executeRaw.mockReset();
  db.prisma.$executeRaw.mockResolvedValue(1);
});

describe("fileClipDemand", () => {
  it("requeues only a quality failure, only below the engine's attempt limit, never a made clip", async () => {
    await fileClipDemand([clip]);
    expect(db.prisma.$executeRaw).toHaveBeenCalledTimes(1);
    // Called as a tagged template: the SQL's fixed parts, then the values between them.
    const [strings, ...values] = db.prisma.$executeRaw.mock.calls[0]! as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const text = strings.join("$").replace(/\s+/g, " ");
    expect(text).toContain(`WHEN "PrayerAudioClip"."status" = 'failed'`);
    expect(text).toContain(`AND "PrayerAudioClip"."lastError" LIKE 'qa:%'`);
    expect(text).toContain(`AND "PrayerAudioClip"."attempts" < $ THEN 'pending'`);
    expect(text).toContain(`WHERE "PrayerAudioClip"."status" <> 'done'`);
    expect(values).toContain(RETRY_FAILED_BELOW_ATTEMPTS);
    expect(RETRY_FAILED_BELOW_ATTEMPTS).toBe(5);
  });

  it("never throws when the database fails", async () => {
    db.prisma.$executeRaw.mockRejectedValue(new Error("down"));
    await expect(fileClipDemand([clip])).resolves.toBeUndefined();
  });
});
