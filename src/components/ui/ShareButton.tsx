"use client";

import { useState } from "react";

type Props = {
  /** The content card's title — used as the share sheet title + copied text. */
  title: string;
  /** Optional short description shared alongside the link. */
  text?: string;
  /**
   * Optional explicit URL to share. When omitted (the usual case) the current
   * page URL is shared, so the button always shares "whatever the applicable
   * content card is" without each page having to compute its own route.
   */
  url?: string;
  className?: string;
};

/**
 * Hand-drawn "share" glyph — a box with an upward arrow rising out of its open
 * top (the familiar share mark), stroked in the same sketched, round-capped
 * style as the site's crucifix favicon so it sits naturally beside the Save
 * control. Rendered to the LEFT of the word "Share".
 */
function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* the box, open at the top where the arrow passes through */}
      <path d="M8 10 H6.5 Q5 10 5 11.5 V18.5 Q5 20 6.5 20 H17.5 Q19 20 19 18.5 V11.5 Q19 10 17.5 10 H16" />
      {/* the upward arrow rising out of the box */}
      <path d="M12 14.5 L12 4" />
      <path d="M8.4 7 L12 3.6 L15.6 7" />
    </svg>
  );
}

/**
 * Shares the current content card. On devices with the Web Share API
 * (`navigator.share`, i.e. most phones) this opens the native share sheet, so
 * the user can send the page — with its title and, via the page's Open Graph /
 * favicon metadata, its preview — to anyone. Everywhere else it copies the link
 * to the clipboard and briefly confirms. A signed-in account is not required.
 */
export function ShareButton({ title, text, url, className }: Props) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function onShare() {
    if (typeof window === "undefined") return;
    const shareUrl = url ?? window.location.href;
    const data: ShareData = {
      title,
      text: text ?? title,
      url: shareUrl,
    };
    setPending(true);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share(data);
          return;
        } catch (err) {
          // AbortError = the user dismissed the sheet; treat as a no-op.
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Fall through to the clipboard fallback on any other failure.
        }
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onShare}
        disabled={pending}
        aria-label={`Share ${title}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-4 py-1.5 text-xs uppercase tracking-liturgical transition hover:bg-ink/5 disabled:opacity-50"
      >
        <ShareGlyph />
        <span>{copied ? "Link copied" : "Share"}</span>
      </button>
    </div>
  );
}
