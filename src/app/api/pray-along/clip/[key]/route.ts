import { type NextRequest } from "next/server";

import { readClipAudio, readClipVersion } from "@/lib/pray-along/store";

export const dynamic = "force-dynamic";

const KEY = /^[0-9a-f]{40}$/;

/**
 * Recently served clips, kept in memory with the version of their audio: a Rosary plays
 * the same Hail Mary fifty times and every listener's Sign of the Cross is one clip, so
 * most requests never reach the database. Bounded by size, oldest out first.
 */
type Clip = { audio: Uint8Array<ArrayBuffer>; mime: string; version: string };
const CACHE = new Map<string, Clip>();
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
let cacheBytes = 0;

function remember(key: string, clip: Clip) {
  // A clip made again replaces the copy held from before (two requests may also have
  // read the same clip at once), so the old copy's bytes stop counting.
  const old = CACHE.get(key);
  if (old) {
    CACHE.delete(key);
    cacheBytes -= old.audio.byteLength;
  }
  if (clip.audio.byteLength > CACHE_MAX_BYTES / 8) return;
  CACHE.set(key, clip);
  cacheBytes += clip.audio.byteLength;
  for (const [k, v] of CACHE) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    CACHE.delete(k);
    cacheBytes -= v.audio.byteLength;
  }
}

/**
 * The audio for a request naming version `asked` (null: none). A clip made again keeps
 * its key, so a copy in memory may be old audio: it answers a request for its own
 * version with no database read (every clip of a playlist built since it was made), and
 * any other request only once a small read of the version, without the audio, says it
 * is still current (a URL with no version, or with one the clip was made over since).
 * Otherwise the clip is read whole from the database and kept in place of the old copy.
 */
async function clipFor(key: string, asked: string | null): Promise<Clip | null> {
  const held = CACHE.get(key);
  if (held && (held.version === asked || held.version === (await readClipVersion(key)))) {
    // Refresh its place as most recently used, unless a newer read replaced it meanwhile.
    if (CACHE.get(key) === held) {
      CACHE.delete(key);
      CACHE.set(key, held);
    }
    return held;
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
const REVALIDATE = "no-cache";

/**
 * One made clip's audio. A clip is named by the hash of what it says, but the voice
 * engine makes it again under the same key when the engine is fixed, so the playlist's
 * URL also names the version of its audio (?v=). Served at a URL that names its
 * version, the audio may be kept for good: that URL means those bytes. Served at any
 * other (no version: a playlist from before versions, a link; or a version the clip was
 * made over since: a playlist built before the remake), it is the current audio, and
 * the browser checks it again each time it plays it (a 304 while it is unchanged),
 * because that URL gives other audio once the clip is made again. Byte ranges are
 * honoured because Safari will not play a media file from a server that ignores them.
 */
async function serve(req: NextRequest, key: string, head: boolean) {
  if (!KEY.test(key)) return new Response(null, { status: 404 });
  const asked = req.nextUrl.searchParams.get("v");
  const clip = await clipFor(key, asked);
  if (!clip) {
    return Response.json(
      { status: "pending" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
  const size = clip.audio.byteLength;
  const etag = `"${key}-${clip.version}"`;
  const common = {
    "content-type": clip.mime,
    "accept-ranges": "bytes",
    "cache-control": asked === clip.version ? IMMUTABLE : REVALIDATE,
    etag,
  };
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: common });
  }
  // A range resumed from another version (If-Range naming another ETag, or a date) gets the
  // whole current clip, as HTTP requires: the tail of new audio must never be spliced onto
  // the start of the old.
  const ifRange = req.headers.get("if-range");
  const rangeHeader = ifRange !== null && ifRange !== etag ? null : req.headers.get("range");
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
