/**
 * Saving a journal entry. A rejected save used to answer with a plain redirect to the
 * journal: the form closed, the words were gone and nothing was said. The form now saves
 * by fetch and these answers are what it reads, so each failure has to be told apart and
 * nothing may turn an entry within its limits away.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireUserMock = vi.fn();
const rateLimitMock = vi.fn();
const createJournalEntryMock = vi.fn();
const updateJournalEntryMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: () => requireUserMock(),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  RATE_POLICIES: { userWrite: { windowMs: 60_000, max: 30 } },
}));
vi.mock("@/lib/data/journal", () => ({
  countJournalEntries: vi.fn(),
  listJournalEntries: vi.fn(),
  createJournalEntry: (...args: unknown[]) => createJournalEntryMock(...args),
  getJournalEntry: vi.fn(),
  updateJournalEntry: (...args: unknown[]) => updateJournalEntryMock(...args),
}));

import { POST } from "@/app/api/journal/route";
import { PATCH } from "@/app/api/journal/[id]/route";
import { JOURNAL_BODY_MAX, JOURNAL_TITLE_MAX } from "@/app/profile/journal/limits";

function jsonRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/journal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function formRequest(fields: Record<string, string>): NextRequest {
  return new Request("http://localhost/api/journal", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  }) as unknown as NextRequest;
}

function patchRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/journal/e1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const params = { params: Promise.resolve({ id: "e1" }) };

beforeEach(() => {
  requireUserMock.mockReset().mockResolvedValue({ id: "u1" });
  rateLimitMock.mockReset().mockResolvedValue({ ok: true });
  createJournalEntryMock.mockReset().mockResolvedValue({ id: "e1" });
  updateJournalEntryMock.mockReset().mockResolvedValue({ ok: true, entry: { id: "e1" } });
});

describe("POST /api/journal, as the form sends it", () => {
  it("saves an entry", async () => {
    const res = await POST(jsonRequest({ title: "T", body: "B" }));
    expect(res.status).toBe(200);
    expect(createJournalEntryMock).toHaveBeenCalledWith({ userId: "u1", title: "T", body: "B" });
  });

  it("tells a signed-out reader apart", async () => {
    requireUserMock.mockResolvedValue(null);
    expect((await POST(jsonRequest({ title: "T", body: "B" }))).status).toBe(401);
    expect(createJournalEntryMock).not.toHaveBeenCalled();
  });

  it("tells a rate limit apart", async () => {
    rateLimitMock.mockResolvedValue({ ok: false });
    expect((await POST(jsonRequest({ title: "T", body: "B" }))).status).toBe(429);
    expect(createJournalEntryMock).not.toHaveBeenCalled();
  });

  it("refuses an over-long field rather than cutting it", async () => {
    const longBody = await POST(
      jsonRequest({ title: "T", body: "x".repeat(JOURNAL_BODY_MAX + 1) }),
    );
    expect(longBody.status).toBe(400);
    const longTitle = await POST(
      jsonRequest({ title: "t".repeat(JOURNAL_TITLE_MAX + 1), body: "B" }),
    );
    expect(longTitle.status).toBe(400);
    expect(createJournalEntryMock).not.toHaveBeenCalled();
  });

  it("answers a failed write with an error the form can read", async () => {
    createJournalEntryMock.mockRejectedValue(new Error("connection lost"));
    const res = await POST(jsonRequest({ title: "T", body: "B" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "server_error" });
  });

  // The database refuses a NUL, and half of an emoji. Pasted in where no reader can see the
  // trouble, either would turn away every save of the entry, however often they tried again.
  it("saves an entry with a NUL in it, without the NUL", async () => {
    const res = await POST(jsonRequest({ title: "A\0 title", body: "Some\0 words" }));
    expect(res.status).toBe(200);
    expect(createJournalEntryMock).toHaveBeenCalledWith({
      userId: "u1",
      title: "A title",
      body: "Some words",
    });
  });

  it("saves an entry with half of an emoji in it, marking where it was", async () => {
    const res = await POST(jsonRequest({ title: "A\ud83d title", body: "Some\ude00 😀 words" }));
    expect(res.status).toBe(200);
    expect(createJournalEntryMock).toHaveBeenCalledWith({
      userId: "u1",
      title: "A\ufffd title",
      body: "Some\ufffd 😀 words",
    });
  });

  // JSON writes a newline as two bytes, a CJK character as three and a control character
  // as six. None of that may turn away an entry within its limits.
  it.each([
    ["all newlines", "\n".repeat(JOURNAL_BODY_MAX)],
    ["all three-byte characters", "祈".repeat(JOURNAL_BODY_MAX)],
    ["all control characters", "\u0001".repeat(JOURNAL_BODY_MAX)],
  ])("takes an entry of exactly the limit made of %s", async (_label, body) => {
    const res = await POST(jsonRequest({ title: "祈".repeat(JOURNAL_TITLE_MAX), body }));
    expect(res.status).toBe(200);
    expect(createJournalEntryMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/journal, as a plain form post", () => {
  it("stores plain newlines, so the entry is the length the reader counted", async () => {
    const body = `${"x".repeat(JOURNAL_BODY_MAX - 2)}\r\n\r\n`;
    const res = await POST(formRequest({ title: "T", body }));
    expect(res.headers.get("location")).toMatch(/\/profile\/journal$/);
    const saved = createJournalEntryMock.mock.calls[0]![0] as { body: string };
    expect(saved.body).not.toContain("\r");
    expect(saved.body).toHaveLength(JOURNAL_BODY_MAX);
  });

  it.each([
    ["an over-long body", { title: "T", body: "x".repeat(JOURNAL_BODY_MAX + 1) }],
    ["an over-long title", { title: "t".repeat(JOURNAL_TITLE_MAX + 1), body: "B" }],
    ["an empty body", { title: "T", body: "" }],
  ])("says so when it refuses %s", async (_label, fields) => {
    const res = await POST(formRequest(fields));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/profile/journal?error=not_saved");
    expect(createJournalEntryMock).not.toHaveBeenCalled();
  });

  it("says so when it is rate limited", async () => {
    rateLimitMock.mockResolvedValue({ ok: false });
    const res = await POST(formRequest({ title: "T", body: "B" }));
    expect(res.headers.get("location")).toContain("/profile/journal?error=not_saved");
  });

  it("says so when the write fails", async () => {
    createJournalEntryMock.mockRejectedValue(new Error("connection lost"));
    const res = await POST(formRequest({ title: "T", body: "B" }));
    expect(res.headers.get("location")).toContain("/profile/journal?error=not_saved");
  });

  it("sends a signed-out reader to log in and back", async () => {
    requireUserMock.mockResolvedValue(null);
    const res = await POST(formRequest({ title: "T", body: "B" }));
    expect(res.headers.get("location")).toContain("/login?next=/profile/journal");
  });
});

describe("PATCH /api/journal/[id]", () => {
  it("saves an edit with a NUL or half of an emoji in it", async () => {
    const res = await PATCH(patchRequest({ title: "A\0 title", body: "Some\ud83d words" }), params);
    expect(res.status).toBe(200);
    expect(updateJournalEntryMock).toHaveBeenCalledWith("e1", "u1", {
      title: "A title",
      body: "Some\ufffd words",
    });
  });

  it("saves plain newlines", async () => {
    const res = await PATCH(patchRequest({ title: "T", body: "one\r\ntwo" }), params);
    expect(res.status).toBe(200);
    expect(updateJournalEntryMock).toHaveBeenCalledWith("e1", "u1", {
      title: "T",
      body: "one\ntwo",
    });
  });

  it("takes an entry of exactly the limit", async () => {
    const res = await PATCH(patchRequest({ body: "祈".repeat(JOURNAL_BODY_MAX) }), params);
    expect(res.status).toBe(200);
  });

  it("refuses an over-long field rather than cutting it", async () => {
    const res = await PATCH(patchRequest({ body: "x".repeat(JOURNAL_BODY_MAX + 1) }), params);
    expect(res.status).toBe(400);
    expect(updateJournalEntryMock).not.toHaveBeenCalled();
  });

  it("answers a failed write with an error the form can read", async () => {
    updateJournalEntryMock.mockRejectedValue(new Error("connection lost"));
    const res = await PATCH(patchRequest({ body: "B" }), params);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "server_error" });
  });
});
