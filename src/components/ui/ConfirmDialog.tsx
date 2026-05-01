"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  entityName?: string;
  cancelLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

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

  const interpolated = entityName ? body.replaceAll("{name}", entityName) : body;

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
