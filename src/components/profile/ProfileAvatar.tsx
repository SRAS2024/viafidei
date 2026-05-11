"use client";

import { useEffect, useRef, useState } from "react";
import { optimizeProfileImage } from "@/lib/media/image-optimizer";

type Props = {
  initials: string;
  src?: string | null;
  editable?: boolean;
  tooltip?: string;
  /**
   * Called after the optimized photo has been persisted by the server.
   * Lets the surrounding page refresh state if it cares (the component
   * itself already shows the optimized preview immediately).
   */
  onSaved?: (avatarUrl: string | null) => void;
  labels?: {
    saving?: string;
    saved?: string;
    error?: string;
    unsupported?: string;
    tooLarge?: string;
  };
};

const DEFAULT_LABELS = {
  saving: "Saving photo…",
  saved: "Photo saved",
  error: "Could not save photo",
  unsupported: "Choose a JPG, PNG, or WEBP image",
  tooLarge: "Image is too large",
};

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function ProfileAvatar({
  initials,
  src,
  editable = false,
  tooltip = "Change photo",
  onSaved,
  labels,
}: Props) {
  const merged = { ...DEFAULT_LABELS, ...labels };
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(src ?? null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Keep the preview in sync if the parent server-rendered a fresh src
  // (e.g. after navigation between profile pages).
  useEffect(() => {
    setPreviewSrc(src ?? null);
  }, [src]);

  // Auto-clear the "saved" toast after a moment so it doesn't linger.
  useEffect(() => {
    if (status.kind !== "saved") return;
    const timer = setTimeout(() => setStatus({ kind: "idle" }), 2200);
    return () => clearTimeout(timer);
  }, [status]);

  const handleClick = () => inputRef.current?.click();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file still triggers change.
    e.target.value = "";
    if (!file) return;

    const optimized = await optimizeProfileImage(file);
    if (!optimized) {
      setStatus({ kind: "error", message: merged.unsupported });
      return;
    }

    // Show the optimized preview immediately so the user sees the new
    // photo before the network call finishes.
    setPreviewSrc(optimized.dataUrl);
    setStatus({ kind: "saving" });

    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: optimized.dataUrl }),
      });
      if (!res.ok) {
        if (res.status === 413) {
          setStatus({ kind: "error", message: merged.tooLarge });
        } else {
          setStatus({ kind: "error", message: merged.error });
        }
        return;
      }
      const json = (await res.json()) as {
        ok?: boolean;
        profile?: { avatarMedia?: { url?: string | null } | null };
      };
      const persistedUrl = json?.profile?.avatarMedia?.url ?? optimized.dataUrl;
      setPreviewSrc(persistedUrl);
      setStatus({ kind: "saved" });
      onSaved?.(persistedUrl);
    } catch {
      setStatus({ kind: "error", message: merged.error });
    }
  }

  const initialsLabel = initials.slice(0, 2).toUpperCase();
  const statusMessage =
    status.kind === "saving"
      ? merged.saving
      : status.kind === "saved"
        ? merged.saved
        : status.kind === "error"
          ? status.message
          : null;
  const statusTone = status.kind === "error" ? "vf-avatar-status-error" : "vf-avatar-status-info";

  return (
    <div className="vf-avatar-wrapper">
      <div className="vf-avatar" aria-label="Profile photo">
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="" className="vf-avatar-img" />
        ) : (
          <span aria-hidden="true">{initialsLabel}</span>
        )}

        {editable ? (
          <>
            <button
              type="button"
              onClick={handleClick}
              aria-label={tooltip}
              data-tooltip={tooltip}
              className="vf-avatar-edit vf-tooltip"
              disabled={status.kind === "saving"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFile}
              aria-hidden="true"
              tabIndex={-1}
            />
          </>
        ) : null}
      </div>

      {editable && statusMessage ? (
        <p className={`vf-avatar-status ${statusTone}`} role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
