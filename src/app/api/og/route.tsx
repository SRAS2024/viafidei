/**
 * Dynamic Open Graph share image.
 *
 * When a reader shares a content card (the Share button), the link should
 * unfurl as a branded card — the Via Fidei crucifix mark with the content
 * item's own title rendered in it (e.g. "Litany of Humility"), and a small
 * "VIA FIDEI · <type>" label — rather than the browser's generic page icon.
 * Every public detail page points its `og:image` / `twitter:image` here via
 * `buildPublishedMetadata` (`?title=…&type=…`).
 *
 * The mark is the site's crucifix logo (`public/crucifix-logo.png`, the same
 * image used for the favicon everywhere), read once at module load and inlined
 * as a data URI so the card needs no per-request filesystem/network read and
 * renders identically in every environment. `next/og`'s built-in font renders
 * the text. On any unexpected error — including the logo not being readable in a
 * standalone build — it falls back to the static crucifix asset so a share link
 * never unfurls broken.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// The crucifix logo, inlined as a data URI at module load. Read failures leave
// this empty; GET then falls back to redirecting to the static asset.
let CRUCIFIX_DATA_URI = "";
try {
  const png = readFileSync(join(process.cwd(), "public", "crucifix-logo.png"));
  CRUCIFIX_DATA_URI = `data:image/png;base64,${png.toString("base64")}`;
} catch {
  /* GET redirects to /crucifix-logo.png when the inline logo is unavailable */
}

// Crucifix aspect ratio (360 x 491 → ~0.733) so it never squishes on the card.
const CRUCIFIX_W = 158;
const CRUCIFIX_H = 215;

const CREAM = "#fbf8f1";
const INK = "#111111";

/** Scale the title down as it gets longer so it always fits the card. */
function titleFontSize(title: string): number {
  const n = title.length;
  if (n <= 22) return 84;
  if (n <= 34) return 66;
  if (n <= 50) return 52;
  if (n <= 72) return 42;
  return 34;
}

export function GET(req: Request): Response {
  try {
    // No inline logo (e.g. standalone build without a readable public/): fall
    // back to the static crucifix so the share still unfurls with the brand.
    if (!CRUCIFIX_DATA_URI) {
      return Response.redirect(new URL("/crucifix-logo.png", req.url), 307);
    }
    const params = new URL(req.url).searchParams;
    const title = (params.get("title") ?? "Via Fidei").trim().slice(0, 120) || "Via Fidei";
    const type = (params.get("type") ?? "").trim().slice(0, 40);
    const label = type ? `VIA FIDEI · ${type}` : "VIA FIDEI";

    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          padding: "80px 96px",
          background: CREAM,
          color: INK,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CRUCIFIX_DATA_URI} width={CRUCIFIX_W} height={CRUCIFIX_H} alt="" />
        <div
          style={{
            maxWidth: 1000,
            textAlign: "center",
            fontSize: titleFontSize(title),
            fontWeight: 600,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 30,
            letterSpacing: 4,
            opacity: 0.6,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    // Never unfurl broken: fall back to the static crucifix asset.
    return Response.redirect(new URL("/crucifix-logo.png", req.url), 307);
  }
}
