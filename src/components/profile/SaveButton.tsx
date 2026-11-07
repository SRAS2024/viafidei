"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoginRequiredPopup } from "@/components/ui/LoginRequiredPopup";

// One segment per /api/saved/* route. Each must have a matching
// src/app/api/saved/<kind>/route.ts; see SAVEABLE_CONTENT.
export type SaveKind = "prayers" | "saints" | "apparitions" | "devotions" | "parishes" | "novenas";

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
    cancel?: string;
    confirmRemove?: string;
    loginRequired?: string;
    loginCta?: string;
    registerCta?: string;
    close?: string;
    failed?: string;
    removeFailed?: string;
  };
  className?: string;
};

const DEFAULT_LABELS = {
  save: "Favorite",
  saved: "Favorited",
  remove: "Remove",
  cancel: "Cancel",
  confirmRemove: "Remove this from your favorites?",
  loginRequired: "You must have an account for this action.",
  loginCta: "Log In",
  registerCta: "Create Account",
  close: "Close",
  failed: "Could not save. Please try again.",
  removeFailed: "Could not remove. Please try again.",
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
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/saved/${kind}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entityId }),
        });
        if (!res.ok) throw new Error("save failed");
        setSaved(true);
      } catch {
        setError(merged.failed);
      }
    });
  }

  function remove() {
    setConfirmingRemoval(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/saved/${kind}?id=${encodeURIComponent(entityId)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("remove failed");
        setSaved(false);
      } catch {
        setError(merged.removeFailed);
      }
    });
  }

  function toggle() {
    if (pending) return;
    if (!isAuthed) {
      setShowLoginPrompt(true);
      return;
    }
    if (saved) setConfirmingRemoval(true);
    else save();
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-disabled={pending}
        aria-busy={pending}
        aria-pressed={saved}
        className="vf-btn vf-btn-sm vf-btn-ghost"
      >
        {saved ? merged.saved : merged.save}
      </button>
      {error ? (
        <p role="alert" className="vf-field-error">
          {error}
        </p>
      ) : null}
      <LoginRequiredPopup
        open={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        message={merged.loginRequired}
        loginLabel={merged.loginCta}
        registerLabel={merged.registerCta}
        closeLabel={merged.close}
      />
      <ConfirmDialog
        open={confirmingRemoval}
        title={merged.confirmRemove}
        body=""
        cancelLabel={merged.cancel}
        confirmLabel={merged.remove}
        destructive
        onCancel={() => setConfirmingRemoval(false)}
        onConfirm={remove}
      />
    </div>
  );
}
