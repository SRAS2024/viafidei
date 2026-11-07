"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";

import { useModalDialog } from "./useModalDialog";

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
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // A destructive dialog opens on Cancel, so a stray Enter or a double tap cannot
  // destroy anything.
  const dialogRef = useModalDialog({
    open,
    onClose: onCancel,
    initialFocusRef: destructive ? cancelRef : confirmRef,
  });

  if (!open || typeof document === "undefined") return null;

  const interpolated = entityName ? body.replaceAll("{name}", entityName) : body;

  // Portalled to <body>: the page's <main> is its own stacking context, so from
  // inside it even a high z-index would leave the sticky header painted on top.
  return createPortal(
    // Backdrop dismiss-on-click. The keyboard equivalent is the Escape listener
    // in useModalDialog, which fires however focus is placed.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="vf-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={interpolated ? bodyId : undefined}
        tabIndex={-1}
        className="vf-modal"
      >
        <h2 id={titleId} className="vf-modal-title">
          {title}
        </h2>
        {interpolated ? (
          <p id={bodyId} className="vf-modal-body">
            {interpolated}
          </p>
        ) : null}
        <div className="vf-modal-actions">
          <button ref={cancelRef} type="button" className="vf-btn vf-btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`vf-btn ${destructive ? "vf-btn-danger" : "vf-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
