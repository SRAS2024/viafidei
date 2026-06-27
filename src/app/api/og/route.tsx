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
 * Deterministic + dependency-free: the crucifix is the in-repo `favicon.svg`
 * inlined as a data URI (no filesystem or network read at request time), and
 * the text uses `next/og`'s built-in font, so the image renders the same in
 * every environment. On any unexpected error it falls back to the static
 * crucifix asset so a share link never unfurls broken.
 */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// The crucifix favicon, inlined so the image needs no runtime file/network read
// (most robust under the standalone build). Kept byte-for-byte in sync with
// public/favicon.svg.
const CRUCIFIX_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80">
  <rect width="64" height="80" fill="#fbf8f1"/>
  <g fill="none" stroke="#111111" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28.4 4.6 Q27.8 6.6 27.8 9 L27.6 30.5 Q27.5 31.4 27.4 32 L27.4 73.4 Q27.5 75.4 28.5 76.8" stroke-width="1.5"/>
    <path d="M35.6 4.8 Q36.4 6.8 36.4 9 L36.6 30.5 Q36.6 31.4 36.7 32 L36.7 73.5 Q36.6 75.5 35.6 76.9" stroke-width="1.5"/>
    <path d="M28.4 4.7 Q32 3.5 35.6 4.8" stroke-width="1.5"/>
    <path d="M28.5 76.9 Q32 78.2 35.6 76.9" stroke-width="1.5"/>
    <path d="M5 24.4 Q7.2 23.6 9.6 23.6 L54.4 23.4 Q57 23.4 59 24.2" stroke-width="1.5"/>
    <path d="M5 32.4 Q7.2 33.4 9.6 33.4 L54.4 33.6 Q57 33.6 59 32.6" stroke-width="1.5"/>
    <path d="M5 24.5 Q3.6 28.4 5 32.4" stroke-width="1.5"/>
    <path d="M59 24.3 Q60.4 28.4 59 32.5" stroke-width="1.5"/>
    <path d="M9 28.5 Q22 29 36 28.7 Q48 28.4 56 28.9" stroke-width="0.6" opacity="0.5"/>
    <path d="M32 12 Q32.6 24 32 35" stroke-width="0.6" opacity="0.5"/>
    <path d="M32.6 40 Q33 54 32.4 68" stroke-width="0.6" opacity="0.5"/>
  </g>
</svg>`;

const CRUCIFIX_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(CRUCIFIX_SVG).toString("base64")}`;

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
        <img src={CRUCIFIX_DATA_URI} width={150} height={188} alt="" />
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
