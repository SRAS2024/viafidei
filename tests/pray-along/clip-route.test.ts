/**
 * /api/pray-along/clip/<key>: a made clip's audio, with the byte ranges Safari needs.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const AUDIO = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
const KEY = "a".repeat(40);

vi.mock("@/lib/pray-along/store", () => ({
  readClipAudio: vi.fn(async (key: string) =>
    key === KEY ? { audio: AUDIO, mime: "audio/mp4" } : null,
  ),
}));

import { GET, HEAD } from "@/app/api/pray-along/clip/[key]/route";

const ask = (key: string, headers: Record<string, string> = {}) =>
  GET(new NextRequest(new Request(`http://localhost/api/pray-along/clip/${key}`, { headers })), {
    params: Promise.resolve({ key }),
  });

describe("/api/pray-along/clip/<key>", () => {
  it("serves a made clip whole, for good", async () => {
    const res = await ask(KEY);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mp4");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("content-length")).toBe("1000");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO);
  });

  it("answers Safari's first range request with 206 and the exact bytes", async () => {
    const res = await ask(KEY, { range: "bytes=0-1" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-1/1000");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([0, 1]);
    const tail = await ask(KEY, { range: "bytes=-10" });
    expect(tail.headers.get("content-range")).toBe("bytes 990-999/1000");
    const open = await ask(KEY, { range: "bytes=900-" });
    expect(open.headers.get("content-length")).toBe("100");
  });

  it("refuses a range outside the clip", async () => {
    const res = await ask(KEY, { range: "bytes=5000-6000" });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */1000");
  });

  it("says a clip not made yet is pending, and refuses a malformed key", async () => {
    const pending = await ask("b".repeat(40));
    expect(pending.status).toBe(404);
    expect(await pending.json()).toEqual({ status: "pending" });
    expect((await ask("../../etc/passwd")).status).toBe(404);
  });

  it("answers a revalidation with 304 and a HEAD with no body", async () => {
    expect((await ask(KEY, { "if-none-match": `"${KEY}"` })).status).toBe(304);
    const head = await HEAD(
      new NextRequest(new Request(`http://localhost/api/pray-along/clip/${KEY}`)),
      {
        params: Promise.resolve({ key: KEY }),
      },
    );
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("1000");
    expect((await head.arrayBuffer()).byteLength).toBe(0);
  });
});
