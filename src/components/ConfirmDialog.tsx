"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  /** Body may contain `{name}` which is substituted with `entityName`. */
  body: string;
  entityName?: string;
  cancelLabel: string;
  confirmLabel: string;
  /** Whether the confirm action is destructive (delete/remove). */
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Centered confirmation dialog. Cancel sits on the left as a neutral
 * gray action. Confirm sits on the right — red when destructive,
 * blue otherwise.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  entityName,
  cancelLabel,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  if (!open) return null;

  const interpolated = entityName
    ? body.replaceAll("{name}", entityName)
    : body;

  return (
    <div
      className="vf-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vf-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="vf-modal">
        <h2 id="vf-confirm-title" className="vf-modal-title">
          {title}
        </h2>
        <p className="vf-modal-body">{interpolated}</p>
        <div className="vf-modal-actions">
          <button type="button" className="vf-btn vf-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`vf-btn ${destructive ? "vf-btn-danger" : "vf-btn-primary"}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
