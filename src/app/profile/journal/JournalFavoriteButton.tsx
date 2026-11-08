"use client";

import { useState, useTransition } from "react";

type Props = {
  entryId: string;
  /** Names the entry to a screen reader, among a page of identical buttons. */
  entryTitle?: string;
  isFavorite: boolean;
  favoriteLabel: string;
  /** What the alert says when the change could not be saved, in the page's language. */
  failedLabel?: string;
};

export function JournalFavoriteButton({
  entryId,
  entryTitle,
  isFavorite,
  favoriteLabel,
  failedLabel = "Could not save. Please try again.",
}: Props) {
  const [fav, setFav] = useState(isFavorite);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setFailed(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/journal/${entryId}/favorite`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isFavorite: !fav }),
        });
        if (!res.ok) throw new Error("save failed");
        setFav((v) => !v);
      } catch {
        setFailed(true);
      }
    });
  }

  // One name and a pressed state: VoiceOver says "selected" as it changes, where a
  // label that swaps under the cursor goes unannounced. The blue fill says it to the eye.
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={fav}
        aria-disabled={pending}
        aria-busy={pending}
        aria-label={entryTitle ? `${favoriteLabel}: ${entryTitle}` : favoriteLabel}
        className="vf-btn vf-btn-sm vf-btn-ghost"
      >
        <span aria-hidden="true">{fav ? "★" : "☆"}</span>
        <span>{favoriteLabel}</span>
      </button>
      {failed ? (
        <p role="alert" className="vf-field-error w-full">
          {failedLabel}
        </p>
      ) : null}
    </>
  );
}
