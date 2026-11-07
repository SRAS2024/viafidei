"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** The button's words; `shareItem` carries a {title}. */
export type ShareLabels = {
  share: string;
  shareItem: string;
  copied: string;
  failed: string;
};

const ShareLabelsContext = createContext<ShareLabels>({
  share: "Share",
  shareItem: "Share {title}",
  copied: "Link copied",
  failed: "Could not copy the link",
});

/**
 * The button's words in the reader's language, given once by the root layout. The
 * button stands on many kinds of page, several of which have no translator of their
 * own to hand down.
 */
export function ShareLabelsProvider({
  labels,
  children,
}: {
  labels: ShareLabels;
  children: ReactNode;
}) {
  return <ShareLabelsContext.Provider value={labels}>{children}</ShareLabelsContext.Provider>;
}

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
 * to the clipboard and confirms. A signed-in account is not required.
 *
 * The button never takes `disabled`, even while the sheet is up: a disabled button
 * drops focus to the top of the page, and VoiceOver with it. The outcome is said in a
 * status region, because the button's own label names what it shares and hides the
 * words it shows.
 */
export function ShareButton({ title, text, url, className }: Props) {
  const labels = useContext(ShareLabelsContext);
  const [outcome, setOutcome] = useState<"copied" | "failed" | null>(null);
  const sharing = useRef(false);
  const clearOutcome = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(clearOutcome.current), []);

  function report(result: "copied" | "failed") {
    setOutcome(result);
    window.clearTimeout(clearOutcome.current);
    clearOutcome.current = window.setTimeout(() => setOutcome(null), 4000);
  }

  async function onShare() {
    if (typeof window === "undefined" || sharing.current) return;
    sharing.current = true;
    // Cleared first, so copying a second time is announced a second time.
    setOutcome(null);
    const shareUrl = url ?? window.location.href;
    // Share ONLY the URL (plus a title for the share-sheet / mail subject).
    // Deliberately DO NOT pass `text`: iOS Messages puts `text` into the message
    // body as a SEPARATE bubble on top of the rich link preview, whereas the URL
    // alone renders as just the beautifully-designed Open Graph card. `title` is
    // used by the OS share sheet (and Mail as a subject) but is not added to the
    // Messages body, so the recipient sees only the link card. (`text` is kept as
    // a prop for API compatibility but is intentionally not sent.)
    void text;
    const data: ShareData = {
      title,
      url: shareUrl,
    };
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
      try {
        // No clipboard at all and a refused copy come to the same thing for the reader.
        await navigator.clipboard.writeText(shareUrl);
        report("copied");
      } catch {
        report("failed");
      }
    } finally {
      sharing.current = false;
    }
  }

  const message = outcome === "copied" ? labels.copied : outcome === "failed" ? labels.failed : "";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onShare}
        aria-label={labels.shareItem.replace("{title}", () => title)}
        className="vf-btn vf-btn-sm vf-btn-ghost"
      >
        <ShareGlyph />
        <span>{message || labels.share}</span>
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </div>
  );
}
