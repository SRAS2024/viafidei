import { type NextRequest } from "next/server";

import { readClipAudio } from "@/lib/pray-along/store";

export const dynamic = "force-dynamic";

const KEY = /^[0-9a-f]{40}$/;

/**
 * Recently served clips, kept in memory: a Rosary plays the same Hail Mary fifty times
 * and every listener's Sign of the Cross is one clip, so most requests never reach the
 * database. Bounded by size, oldest out first.
 */
type Clip = { audio: Uint8Array<ArrayBuffer>; mime: string };
const CACHE = new Map<string, Clip>();
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
let cacheBytes = 0;

function remember(key: string, clip: Clip) {
  if (clip.audio.byteLength > CACHE_MAX_BYTES / 8) return;
  CACHE.set(key, clip);
  cacheBytes += clip.audio.byteLength;
  for (const [k, v] of CACHE) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    CACHE.delete(k);
    cacheBytes -= v.audio.byteLength;
  }
}

async function clipFor(key: string) {
  const cached = CACHE.get(key);
  if (cached) {
    // Refresh its place as most recently used.
    CACHE.delete(key);
    CACHE.set(key, cached);
    return cached;
  }
  const clip = await readClipAudio(key);
  if (clip) remember(key, clip);
  return clip;
}

/** "bytes=0-1" style ranges (one range); null when absent or unusable. */
function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  let start: number;
  let end: number;
  if (m[1] === "" && m[2] !== "") {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * One made clip's audio. A clip is named by the hash of what it says, so its bytes
 * never change and browsers may keep it for good. Byte ranges are honoured because
 * Safari will not play a media file from a server that ignores them.
 */
async function serve(req: NextRequest, key: string, head: boolean) {
  if (!KEY.test(key)) return new Response(null, { status: 404 });
  const clip = await clipFor(key);
  if (!clip) {
    return Response.json(
      { status: "pending" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
  const size = clip.audio.byteLength;
  const etag = `"${key}"`;
  const common = {
    "content-type": clip.mime,
    "accept-ranges": "bytes",
    "cache-control": IMMUTABLE,
    etag,
  };
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: common });
  }
  const rangeHeader = req.headers.get("range");
  const range = parseRange(rangeHeader, size);
  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { ...common, "content-range": `bytes */${size}` },
    });
  }
  if (range) {
    const body = clip.audio.subarray(range.start, range.end + 1);
    return new Response(head ? null : body, {
      status: 206,
      headers: {
        ...common,
        "content-length": String(body.byteLength),
        "content-range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }
  return new Response(head ? null : clip.audio, {
    status: 200,
    headers: { ...common, "content-length": String(size) },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return serve(req, key, false);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return serve(req, key, true);
}
