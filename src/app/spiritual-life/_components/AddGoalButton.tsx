"use client";

import { useState } from "react";
import { LoginRequiredPopup } from "@/components/ui";

type Props = {
  isAuthed: boolean;
  title: string;
  summary?: string | null;
  templateSlug?: string | null;
  steps?: Array<{ title: string; body?: string }>;
  className?: string;
  children: React.ReactNode;
};

export function AddGoalButton({
  isAuthed,
  title,
  summary,
  templateSlug,
  steps,
  className,
  children,
}: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!isAuthed) {
      setShowPrompt(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const checklist = (steps ?? [])
        .map((s) => s.title)
        .filter((label) => typeof label === "string" && label.trim().length > 0)
        .slice(0, 50)
        .map((label) => ({ label }));
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: summary ?? null,
          templateSlug: templateSlug ?? null,
          checklist: checklist.length > 0 ? checklist : undefined,
        }),
      });
      if (!res.ok) {
        setError("Could not create the goal. Please try again.");
        setBusy(false);
        return;
      }
      window.location.assign("/profile/goals");
    } catch {
      setError("Could not create the goal. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={className}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Adding…" : children}
      </button>
      {error ? (
        <p className="mt-3 text-center font-serif text-sm text-ink-faint">{error}</p>
      ) : null}
      <LoginRequiredPopup open={showPrompt} onClose={() => setShowPrompt(false)} />
    </>
  );
}
