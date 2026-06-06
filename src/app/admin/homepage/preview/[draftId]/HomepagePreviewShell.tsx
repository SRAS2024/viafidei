"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export type PreviewItem = { slug: string; title: string };
export type PreviewBlock = {
  blockKey: string;
  blockType: string;
  heading: string;
  items: PreviewItem[];
};

function railEyebrow(blockType: string): string {
  const label = blockType.replace(/^featured-/, "").replace(/-/g, " ");
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Full-screen, editable preview of a Homepage Makeover draft.
 *
 * Renders as a fixed overlay so it reads like the real homepage rather
 * than an admin form. The static homepage sections are passed in as
 * `topSlot` / `bottomSlot` (server-rendered); the worker's proposed
 * featured rails render in between and are editable inline (heading +
 * item titles, with per-item removal). A sticky Back control returns to
 * the admin worker page (saving edits first); a fixed bottom-right pair
 * lets the admin Discard (red) or Publish (green) directly from here.
 */
export function HomepagePreviewShell({
  draftId,
  initialBlocks,
  topSlot,
  bottomSlot,
}: {
  draftId: string;
  initialBlocks: PreviewBlock[];
  topSlot: React.ReactNode;
  bottomSlot: React.ReactNode;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<PreviewBlock[]>(initialBlocks);
  const [busy, setBusy] = useState<null | "save" | "publish" | "discard">(null);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useMemo(
    () =>
      blocks.map((b, i) => ({
        blockKey: b.blockKey,
        blockType: b.blockType,
        sortOrder: i,
        configJson: {
          heading: b.heading,
          items: b.items.map((it) => ({ slug: it.slug, title: it.title })),
          refreshedAt: new Date().toISOString(),
        },
      })),
    [blocks],
  );

  const updateHeading = useCallback((blockKey: string, heading: string) => {
    setBlocks((prev) => prev.map((b) => (b.blockKey === blockKey ? { ...b, heading } : b)));
  }, []);

  const updateItemTitle = useCallback((blockKey: string, slug: string, title: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.blockKey === blockKey
          ? { ...b, items: b.items.map((it) => (it.slug === slug ? { ...it, title } : it)) }
          : b,
      ),
    );
  }, []);

  const removeItem = useCallback((blockKey: string, slug: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.blockKey === blockKey ? { ...b, items: b.items.filter((it) => it.slug !== slug) } : b,
      ),
    );
  }, []);

  const saveEdits = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`/api/admin/admin-worker/homepage-draft/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposedSnapshot: snapshot }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()) || "save failed"}`);
    return true;
  }, [draftId, snapshot]);

  const goBack = useCallback(async () => {
    setBusy("save");
    setError(null);
    try {
      await saveEdits();
      router.push("/admin/admin-worker");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }, [router, saveEdits]);

  const publish = useCallback(async () => {
    setBusy("publish");
    setError(null);
    try {
      await saveEdits();
      const res = await fetch(`/api/admin/admin-worker/homepage-draft/${draftId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()) || "publish failed"}`);
      router.push("/admin/admin-worker");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }, [draftId, router, saveEdits]);

  const discard = useCallback(async () => {
    setBusy("discard");
    setError(null);
    try {
      const res = await fetch(`/api/admin/admin-worker/homepage-draft/${draftId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "discard" }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()) || "discard failed"}`);
      router.push("/admin/admin-worker");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }, [draftId, router]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/10 bg-[var(--paper)]/90 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={goBack}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded border border-ink/15 bg-paper-bright px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:border-ink/30 disabled:opacity-50"
        >
          <span aria-hidden>←</span>
          {busy === "save" ? "Saving…" : "Back to Admin Worker"}
        </button>
        <span className="text-[11px] uppercase tracking-wide text-ink-soft">
          Homepage Makeover · Preview (editable)
        </span>
        <span className="w-[150px]" aria-hidden />
      </div>

      {/* Faithful homepage frame */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-36 sm:px-6 sm:pt-12">
        <div className="flex flex-col gap-24">
          {topSlot}

          {blocks.length === 0 ? (
            <section className="vf-card rounded-sm p-10 text-center">
              <p className="vf-eyebrow">Featured</p>
              <h2 className="mt-3 font-display text-3xl text-ink">No featured rails proposed</h2>
              <p className="mx-auto mt-4 max-w-reading font-serif text-ink-soft">
                This makeover did not add any featured content rails — there may be no published
                content to feature yet. You can still publish (the homepage keeps its static
                sections) or discard this draft.
              </p>
            </section>
          ) : (
            <div className="flex flex-col gap-24">
              {blocks.map((block) => (
                <section key={block.blockKey}>
                  <div className="mb-10 text-center">
                    <p className="vf-eyebrow">{railEyebrow(block.blockType)}</p>
                    <input
                      value={block.heading}
                      onChange={(e) => updateHeading(block.blockKey, e.target.value)}
                      aria-label={`${railEyebrow(block.blockType)} heading`}
                      className="mx-auto mt-3 block w-full max-w-2xl border-b border-dashed border-ink/20 bg-transparent text-center font-display text-4xl text-ink focus:border-ink/50 focus:outline-none"
                    />
                  </div>
                  {block.items.length === 0 ? (
                    <p className="text-center font-serif text-sm text-ink-faint">
                      All items removed from this rail.
                    </p>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-3">
                      {block.items.map((item) => (
                        <div
                          key={`${block.blockKey}:${item.slug}`}
                          className="vf-card relative block rounded-sm p-8"
                        >
                          <button
                            type="button"
                            onClick={() => removeItem(block.blockKey, item.slug)}
                            aria-label={`Remove ${item.title}`}
                            title="Remove from rail"
                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700 transition hover:bg-rose-200"
                          >
                            ✕
                          </button>
                          <input
                            value={item.title}
                            onChange={(e) =>
                              updateItemTitle(block.blockKey, item.slug, e.target.value)
                            }
                            aria-label={`Title for ${item.slug}`}
                            className="block w-full border-b border-dashed border-ink/15 bg-transparent pr-7 font-display text-2xl text-ink focus:border-ink/50 focus:outline-none"
                          />
                          <p className="mt-4 font-serif text-sm text-ink-faint">Open →</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {bottomSlot}
        </div>
      </div>

      {/* Fixed bottom-right Discard / Publish */}
      <div className="fixed bottom-6 right-6 z-20 flex items-center gap-3">
        {error && (
          <span
            className="max-w-xs rounded bg-rose-600 px-3 py-1.5 text-xs text-white shadow-lg"
            title={error}
          >
            ⚠ {error}
          </span>
        )}
        <button
          type="button"
          onClick={discard}
          disabled={busy !== null}
          className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-rose-700 disabled:opacity-50"
        >
          {busy === "discard" ? "Discarding…" : "Discard"}
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={busy !== null}
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "publish" ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>
  );
}
