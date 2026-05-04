"use client";

import { useState, useTransition } from "react";
import { LoginRequiredPopup } from "@/components/ui/LoginRequiredPopup";

export type SaveKind = "prayers" | "saints" | "apparitions" | "parishes" | "devotions";

type Props = {
  kind: SaveKind;
  entityId: string;
  initiallySaved: boolean;
  /** When false, clicking the button opens the login-required popup instead. */
  isAuthed?: boolean;
  labels?: {
    save?: string;
    saved?: string;
    remove?: string;
    confirmRemove?: string;
    loginRequired?: string;
    loginCta?: string;
    registerCta?: string;
  };
  className?: string;
};

const DEFAULT_LABELS = {
  save: "Save",
  saved: "Saved",
  remove: "Remove",
  confirmRemove: "Remove this from your saved items?",
  loginRequired: "An account is required to use this feature.",
  loginCta: "Sign in",
  registerCta: "Create account",
};

export function SaveButton({
  kind,
  entityId,
  initiallySaved,
  isAuthed = true,
  labels,
  className,
}: Props) {
  const merged = { ...DEFAULT_LABELS, ...labels };
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  function toggle() {
    if (!isAuthed) {
      setShowLoginPrompt(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (saved) {
          if (typeof window !== "undefined" && !window.confirm(merged.confirmRemove)) return;
          const res = await fetch(`/api/saved/${kind}?id=${encodeURIComponent(entityId)}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error(await res.text());
          setSaved(false);
        } else {
          const res = await fetch(`/api/saved/${kind}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: entityId }),
          });
          if (!res.ok) throw new Error(await res.text());
          setSaved(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
      }
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-liturgical transition ${
          saved
            ? "border-liturgical-gold bg-liturgical-gold/10 text-ink"
            : "border-ink/20 hover:bg-ink/5"
        } disabled:opacity-50`}
      >
        {pending ? "…" : saved ? merged.saved : merged.save}
      </button>
      {error ? <span className="ml-2 text-xs text-liturgical-red">{error}</span> : null}
      <LoginRequiredPopup
        open={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        message={merged.loginRequired}
        loginLabel={merged.loginCta}
        registerLabel={merged.registerCta}
      />
    </div>
  );
}
