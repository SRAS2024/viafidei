"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface MakeoverResult {
  taskId: string;
  draftId: string | null;
  status: string | null;
  finalScore: number;
  sectionsChanged: string[];
  reasonSummary: string;
}

/** A draft the admin can still preview / publish / discard. */
export interface ReviewableDraft {
  id: string;
  status: string;
  reasonSummary: string;
  sectionsChanged: string[];
  finalScore?: number;
  confidence?: number;
}

const REVIEWABLE = new Set(["PROPOSED", "AWAITING_REVIEW"]);

/**
 * Operator-triggered "Request Homepage Makeover" (spec §22).
 *
 * Running a makeover files an AWAITING_REVIEW draft. While a reviewable
 * draft exists, three actions appear below the completion message —
 * Preview (grey), Discard (red), Publish (green). Preview opens the
 * editable preview screen; Discard/Publish act directly. After either
 * action the completion message and the three buttons disappear.
 *
 * The reviewable draft is sourced from the latest draft on page load
 * (so returning from the preview still shows the actions) or from the
 * result of the just-run makeover.
 */
export function RequestHomepageMakeoverButton({
  initialDraft = null,
}: {
  initialDraft?: ReviewableDraft | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewableDraft | null>(initialDraft);
  const [busy, setBusy] = useState<null | "publish" | "discard">(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/admin-worker/request-homepage", { method: "POST" });
        if (!res.ok) throw new Error(`${res.status}: ${(await res.text()) || "failed"}`);
        const result = (await res.json()) as MakeoverResult;
        if (result.draftId && result.status && REVIEWABLE.has(result.status)) {
          setDraft({
            id: result.draftId,
            status: result.status,
            reasonSummary: result.reasonSummary,
            sectionsChanged: result.sectionsChanged,
            finalScore: result.finalScore,
          });
        } else {
          setDraft(null);
          setNotice(result.reasonSummary || "No changes proposed.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const act = async (action: "publish" | "discard") => {
    if (!draft) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/admin-worker/homepage-draft/${draft.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()) || "failed"}`);
      setDraft(null);
      setNotice(action === "publish" ? "Homepage published." : "Draft discarded.");
      router.refresh();
      window.setTimeout(() => setNotice(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const score = draft?.finalScore ?? draft?.confidence;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={isPending || busy !== null}
        className="rounded bg-violet-600 px-3 py-1 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isPending ? "Running makeover…" : "Request Homepage Makeover"}
      </button>

      {error && (
        <p className="text-xs text-rose-700" title={error}>
          ⚠ {error}
        </p>
      )}
      {notice && !draft && <p className="text-xs text-emerald-700">{notice}</p>}

      {draft && (
        <div className="space-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-xs">
          {/* Completion message */}
          <div>
            <p className="text-sm font-medium text-ink">Makeover ready for review</p>
            <p className="mt-0.5 italic text-ink-soft">{draft.reasonSummary}</p>
            <p className="mt-0.5 font-mono text-ink-soft">
              {typeof score === "number" ? `score=${score.toFixed(2)}` : ""}
              {draft.sectionsChanged.length > 0
                ? ` · changed: ${draft.sectionsChanged.join(", ")}`
                : " · no section changes"}
            </p>
          </div>

          {/* Preview (grey) · Discard (red) · Publish (green) */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => router.push(`/admin/homepage/preview/${draft.id}`)}
              className="rounded bg-slate-500 px-3 py-1 font-medium text-white hover:bg-slate-600 disabled:opacity-50"
            >
              Preview
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => act("discard")}
              className="rounded bg-rose-600 px-3 py-1 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {busy === "discard" ? "Discarding…" : "Discard"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => act("publish")}
              className="rounded bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
