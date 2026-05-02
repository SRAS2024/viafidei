"use client";

import { useState, useTransition } from "react";

type Props = {
  entryId: string;
  isFavorite: boolean;
  favoriteLabel: string;
  unfavoriteLabel: string;
};

export function JournalFavoriteButton({ entryId, isFavorite, favoriteLabel, unfavoriteLabel }: Props) {
  const [fav, setFav] = useState(isFavorite);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await fetch(`/api/journal/${entryId}/favorite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isFavorite: !fav }),
      });
      setFav((v) => !v);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`text-sm transition ${fav ? "text-liturgical-gold" : "text-ink-faint hover:text-ink"}`}
    >
      {fav ? `★ ${unfavoriteLabel}` : `☆ ${favoriteLabel}`}
    </button>
  );
}
