/**
 * /api/pray-along/clip/<key>: a made clip's audio, with the byte ranges Safari needs.
 * The voice engine makes a clip again under the same key when it is fixed, so the
 * playlist's URL names the version of its audio: that URL is kept for good, any other
 * is checked each time it plays, and a copy held in memory never stands in for newer
 * audio.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** The table as the route reads it: each made clip's audio and version. */
const store = vi.hoisted(() => {
  const made = new Map<string, { audio: Uint8Array<ArrayBuffer>; mime: string; version: string }>();
  return {
    made,
    readClipAudio: vi.fn(async (key: string) => made.get(key) ?? null),
    readClipVersion: vi.fn(async (key: string) => made.get(key)?.version ?? null),
  };
});

vi.mock("@/lib/pray-along/store", () => ({
  readClipAudio: store.readClipAudio,
  readClipVersion: store.readClipVersion,
}));

import { GET, HEAD } from "@/app/api/pray-along/clip/[key]/route";

const AUDIO = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
/** The same clip made again: other audio, of another length. */
const REMADE = Uint8Array.from({ length: 1200 }, (_, i) => (i * 7) % 256);
const V1 = "mwq7iszf";
const V2 = "mwqhdc0f";
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * A made clip of the test's own: the route keeps what it served in memory for as long
 * as the module lives, so a key an earlier test used would start this one cached.
 */
let clipsMade = 0;
function makeClip(audio = AUDIO, version = V1): string {
  const key = (++clipsMade).toString(16).padStart(40, "0");
  store.made.set(key, { audio, mime: "audio/mp4", version });
  return key;
}

/** The engine makes the clip again: new audio, a new version, the same key. */
function remake(key: string) {
  store.made.set(key, { audio: REMADE, mime: "audio/mp4", version: V2 });
}

const request = (key: string, v: string | null, headers: Record<string, string> = {}) =>
  new NextRequest(
    new Request(`http://localhost/api/pray-along/clip/${key}${v === null ? "" : `?v=${v}`}`, {
      headers,
    }),
  );

const ask = (key: string, v: string | null, headers?: Record<string, string>) =>
  GET(request(key, v, headers), { params: Promise.resolve({ key }) });

const bytes = async (res: Response) => new Uint8Array(await res.arrayBuffer());

beforeEach(() => {
  store.readClipAudio.mockClear();
  store.readClipVersion.mockClear();
});

describe("/api/pray-along/clip/<key>", () => {
  it("serves a made clip whole at the URL that names its version, for good", async () => {
    const key = makeClip();
    const res = await ask(key, V1);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mp4");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(res.headers.get("etag")).toBe(`"${key}-${V1}"`);
    expect(res.headers.get("content-length")).toBe("1000");
    expect(await bytes(res)).toEqual(AUDIO);
  });

  it("answers its version again from memory, without the database", async () => {
    const key = makeClip();
    await ask(key, V1);
    // A Rosary asks for the same Hail Mary over and over: one read of the row in all.
    for (let i = 0; i < 5; i++) expect(await bytes(await ask(key, V1))).toEqual(AUDIO);
    expect(store.readClipAudio).toHaveBeenCalledTimes(1);
    expect(store.readClipVersion).not.toHaveBeenCalled();
  });

  it("never serves the copy in memory for a clip's new version once it is made again", async () => {
    const key = makeClip();
    await ask(key, V1);
    remake(key);
    // A playlist built before the remake names the old version, and the copy in memory
    // is exactly that audio: it is what that URL means.
    expect(await bytes(await ask(key, V1))).toEqual(AUDIO);
    // A playlist built since names the new one: the new audio, from the database.
    const res = await ask(key, V2);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(res.headers.get("etag")).toBe(`"${key}-${V2}"`);
    expect(res.headers.get("content-length")).toBe("1200");
    expect(await bytes(res)).toEqual(REMADE);
    // The new audio has taken the old one's place in memory.
    store.readClipAudio.mockClear();
    store.readClipVersion.mockClear();
    expect(await bytes(await ask(key, V2))).toEqual(REMADE);
    expect(store.readClipAudio).not.toHaveBeenCalled();
    expect(store.readClipVersion).not.toHaveBeenCalled();
  });

  it("gives a URL without a version the current audio, checked each time, never an old copy", async () => {
    const key = makeClip();
    const first = await ask(key, null);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-cache");
    expect(first.headers.get("etag")).toBe(`"${key}-${V1}"`);
    expect(await bytes(first)).toEqual(AUDIO);
    // Held in memory now: the next request reads only the version, to see it is current.
    expect(await bytes(await ask(key, null))).toEqual(AUDIO);
    expect(store.readClipAudio).toHaveBeenCalledTimes(1);
    expect(store.readClipVersion).toHaveBeenCalledTimes(1);
    // Made again: the copy in memory is old audio and is not served.
    remake(key);
    const after = await ask(key, null);
    expect(after.headers.get("cache-control")).toBe("no-cache");
    expect(after.headers.get("etag")).toBe(`"${key}-${V2}"`);
    expect(await bytes(after)).toEqual(REMADE);
  });

  it("gives a version the clip was made over since the current audio, checked each time", async () => {
    // A playlist built before the remake, on a server that never held the old audio.
    const key = makeClip(REMADE, V2);
    const res = await ask(key, V1);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("etag")).toBe(`"${key}-${V2}"`);
    expect(await bytes(res)).toEqual(REMADE);
    // Now it holds the new audio: served from memory, once the version is checked.
    store.readClipAudio.mockClear();
    const again = await ask(key, V1);
    expect(again.headers.get("cache-control")).toBe("no-cache");
    expect(await bytes(again)).toEqual(REMADE);
    expect(store.readClipAudio).not.toHaveBeenCalled();
    expect(store.readClipVersion).toHaveBeenCalledTimes(1);
    // A version that never was is no different.
    const never = await ask(key, "nonsense");
    expect(never.headers.get("cache-control")).toBe("no-cache");
    expect(never.headers.get("etag")).toBe(`"${key}-${V2}"`);
  });

  it("gives a URL that does not name the held version nothing for a clip reset to be made again", async () => {
    const key = makeClip();
    await ask(key, V1);
    // Reset by hand: 'pending' until the engine makes it again.
    store.made.delete(key);
    const res = await ask(key, null);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "pending" });
    // The held version's own URL still means those bytes (a playlist from before the reset
    // names it); new playlists mark the clip not ready, so nothing new asks for it.
    const held = await ask(key, V1);
    expect(held.status).toBe(200);
    expect(held.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(await bytes(held)).toEqual(AUDIO);
  });

  it("keeps its byte count right when a copy is replaced, so memory keeps working", async () => {
    // Nine versions of one 8 MB clip: each replaces the last in memory. Were the old copies'
    // bytes left counted, the 64 MB limit would be passed and every new copy dropped at once.
    const big = new Uint8Array(8 * 1024 * 1024);
    const key = makeClip(big, "v0");
    for (let i = 1; i <= 9; i++) {
      store.made.set(key, { audio: big, mime: "audio/mp4", version: `v${i}` });
      expect((await ask(key, `v${i}`)).status).toBe(200);
    }
    const small = makeClip();
    store.readClipAudio.mockClear();
    await ask(small, V1);
    await ask(small, V1);
    expect(store.readClipAudio).toHaveBeenCalledTimes(1);
  });

  it("sends the whole current clip for a range resumed from another version", async () => {
    const key = makeClip();
    await ask(key, null);
    remake(key);
    const resumed = await ask(key, null, { range: "bytes=100-199", "if-range": `"${key}-${V1}"` });
    expect(resumed.status).toBe(200);
    expect(await bytes(resumed)).toEqual(REMADE);
    const same = await ask(key, null, { range: "bytes=100-199", "if-range": `"${key}-${V2}"` });
    expect(same.status).toBe(206);
    expect(same.headers.get("content-range")).toBe(`bytes 100-199/${REMADE.byteLength}`);
  });

  it("answers a revalidation with 304 only for the version it would serve", async () => {
    const key = makeClip();
    const kept = await ask(key, V1, { "if-none-match": `"${key}-${V1}"` });
    expect(kept.status).toBe(304);
    expect(kept.headers.get("cache-control")).toBe(IMMUTABLE);
    const checked = await ask(key, null, { "if-none-match": `"${key}-${V1}"` });
    expect(checked.status).toBe(304);
    expect(checked.headers.get("cache-control")).toBe("no-cache");
    expect(checked.headers.get("etag")).toBe(`"${key}-${V1}"`);
    // An ETag from before versions ("<key>") gets the audio again.
    expect((await ask(key, null, { "if-none-match": `"${key}"` })).status).toBe(200);
    // Made again: the old version's ETag gets the new audio, the new one's a 304.
    remake(key);
    const changed = await ask(key, null, { "if-none-match": `"${key}-${V1}"` });
    expect(changed.status).toBe(200);
    expect(changed.headers.get("etag")).toBe(`"${key}-${V2}"`);
    expect(await bytes(changed)).toEqual(REMADE);
    expect((await ask(key, null, { "if-none-match": `"${key}-${V2}"` })).status).toBe(304);
    expect((await ask(key, V2, { "if-none-match": `"${key}-${V2}"` })).status).toBe(304);
  });

  it("answers Safari's range requests with 206 and the exact bytes, at any URL", async () => {
    const key = makeClip();
    const res = await ask(key, V1, { range: "bytes=0-1" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-1/1000");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(Array.from(await bytes(res))).toEqual([0, 1]);
    const tail = await ask(key, V1, { range: "bytes=-10" });
    expect(tail.headers.get("content-range")).toBe("bytes 990-999/1000");
    const open = await ask(key, V1, { range: "bytes=900-" });
    expect(open.headers.get("content-length")).toBe("100");
    expect((await ask(key, null, { range: "bytes=0-1" })).status).toBe(206);
    // Made again: the ranges are the new audio's, past the old one's end.
    remake(key);
    for (const v of [V2, null]) {
      const r = await ask(key, v, { range: "bytes=1100-" });
      expect(r.status).toBe(206);
      expect(r.headers.get("content-range")).toBe("bytes 1100-1199/1200");
      expect(Array.from(await bytes(r))).toEqual(Array.from(REMADE.subarray(1100)));
    }
  });

  it("refuses a range outside the clip", async () => {
    const key = makeClip();
    const res = await ask(key, V1, { range: "bytes=5000-6000" });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */1000");
  });

  it("says a clip not made yet is pending, and refuses a malformed key", async () => {
    for (const v of [null, V1]) {
      const pending = await ask("b".repeat(40), v);
      expect(pending.status).toBe(404);
      expect(pending.headers.get("cache-control")).toBe("no-store");
      expect(await pending.json()).toEqual({ status: "pending" });
    }
    expect((await ask("../../etc/passwd", null)).status).toBe(404);
  });

  it("answers a HEAD with the headers and no body", async () => {
    const key = makeClip();
    const head = await HEAD(request(key, V1), { params: Promise.resolve({ key }) });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("1000");
    expect(head.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(head.headers.get("etag")).toBe(`"${key}-${V1}"`);
    expect((await head.arrayBuffer()).byteLength).toBe(0);
  });
});
