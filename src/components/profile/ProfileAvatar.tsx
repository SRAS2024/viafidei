"use client";

import { useRef, useState } from "react";

type Props = {
  initials: string;
  src?: string | null;
  editable?: boolean;
  tooltip?: string;
  onChange?: (file: File) => void;
};

export function ProfileAvatar({
  initials,
  src,
  editable = false,
  tooltip = "Change photo",
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(src ?? null);

  const handleClick = () => inputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPreviewSrc(reader.result);
    };
    reader.readAsDataURL(file);
    onChange?.(file);
  };

  const initialsLabel = initials.slice(0, 2).toUpperCase();

  return (
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
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            aria-hidden="true"
            tabIndex={-1}
          />
        </>
      ) : null}
    </div>
  );
}
