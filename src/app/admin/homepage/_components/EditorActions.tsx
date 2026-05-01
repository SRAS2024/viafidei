"use client";

type Props = {
  saving: boolean;
  message: string | null;
  onSave: () => void;
};

export function EditorActions({ saving, message, onSave }: Props) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="vf-btn vf-btn-cancel"
        >
          Cancel
        </button>
        <button onClick={onSave} disabled={saving} className="vf-btn vf-btn-primary">
          {saving ? "Saving…" : "Save page"}
        </button>
      </div>
      {message ? <p className="text-right text-sm text-ink-faint">{message}</p> : null}
    </>
  );
}
