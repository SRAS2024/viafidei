"use client";

import { useState } from "react";

type Block = {
  id: string;
  blockKey: string;
  blockType: string;
  sortOrder: number;
  configJson: Record<string, unknown>;
};

export function HomepageMirrorEditor({
  pageId,
  initialBlocks,
}: {
  pageId: string;
  initialBlocks: Block[];
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateBlockField(blockKey: string, path: string, value: string) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.blockKey !== blockKey) return b;
        const next = { ...b, configJson: { ...b.configJson } as Record<string, unknown> };
        const parts = path.split(".");
        let cursor: Record<string, unknown> = next.configJson;
        for (let i = 0; i < parts.length - 1; i++) {
          const k = parts[i];
          const v = cursor[k];
          const nested = typeof v === "object" && v !== null ? { ...(v as Record<string, unknown>) } : {};
          cursor[k] = nested;
          cursor = nested;
        }
        cursor[parts[parts.length - 1]] = value;
        return next;
      }),
    );
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, blocks }),
      });
      if (!res.ok) throw new Error("save failed");
      setMessage("Saved · live preview updated");
    } catch {
      setMessage("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const hero = blocks.find((b) => b.blockKey === "hero");
  const mission = blocks.find((b) => b.blockKey === "mission");

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <p className="vf-eyebrow">Editor</p>
        {hero ? (
          <div className="vf-card rounded-sm p-6">
            <h3 className="font-display text-2xl">Hero</h3>
            <label className="vf-label mt-4">Eyebrow</label>
            <input
              className="vf-input"
              value={String(hero.configJson.eyebrow ?? "")}
              onChange={(e) => updateBlockField("hero", "eyebrow", e.target.value)}
            />
            <label className="vf-label mt-4">Title</label>
            <input
              className="vf-input"
              value={String(hero.configJson.title ?? "")}
              onChange={(e) => updateBlockField("hero", "title", e.target.value)}
            />
            <label className="vf-label mt-4">Lede</label>
            <textarea
              rows={4}
              className="vf-input"
              value={String(hero.configJson.lede ?? "")}
              onChange={(e) => updateBlockField("hero", "lede", e.target.value)}
            />
          </div>
        ) : null}

        {mission ? (
          <div className="vf-card rounded-sm p-6">
            <h3 className="font-display text-2xl">Mission / Overview</h3>
            <label className="vf-label mt-4">Left title</label>
            <input
              className="vf-input"
              value={String((mission.configJson.left as Record<string, unknown>)?.title ?? "")}
              onChange={(e) => updateBlockField("mission", "left.title", e.target.value)}
            />
            <label className="vf-label mt-4">Left body</label>
            <textarea
              rows={3}
              className="vf-input"
              value={String((mission.configJson.left as Record<string, unknown>)?.body ?? "")}
              onChange={(e) => updateBlockField("mission", "left.body", e.target.value)}
            />
            <label className="vf-label mt-4">Right title</label>
            <input
              className="vf-input"
              value={String((mission.configJson.right as Record<string, unknown>)?.title ?? "")}
              onChange={(e) => updateBlockField("mission", "right.title", e.target.value)}
            />
            <label className="vf-label mt-4">Right body</label>
            <textarea
              rows={3}
              className="vf-input"
              value={String((mission.configJson.right as Record<string, unknown>)?.body ?? "")}
              onChange={(e) => updateBlockField("mission", "right.body", e.target.value)}
            />
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={saving} className="vf-btn vf-btn-primary">
            {saving ? "Saving…" : "Save page"}
          </button>
          {message ? <span className="text-sm text-ink-faint">{message}</span> : null}
        </div>
      </div>

      <div>
        <p className="vf-eyebrow">Live preview</p>
        <div className="vf-card mt-3 rounded-sm p-8">
          {hero ? (
            <div className="text-center">
              <p className="vf-eyebrow">{String(hero.configJson.eyebrow ?? "")}</p>
              <div className="vf-rule mx-auto my-5" />
              <h1 className="font-display text-4xl">{String(hero.configJson.title ?? "")}</h1>
              <p className="mt-4 font-serif text-ink-soft">{String(hero.configJson.lede ?? "")}</p>
            </div>
          ) : null}
          {mission ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <article>
                <h2 className="font-display text-2xl">
                  {String((mission.configJson.left as Record<string, unknown>)?.title ?? "")}
                </h2>
                <p className="mt-3 font-serif text-ink-soft">
                  {String((mission.configJson.left as Record<string, unknown>)?.body ?? "")}
                </p>
              </article>
              <article>
                <h2 className="font-display text-2xl">
                  {String((mission.configJson.right as Record<string, unknown>)?.title ?? "")}
                </h2>
                <p className="mt-3 font-serif text-ink-soft">
                  {String((mission.configJson.right as Record<string, unknown>)?.body ?? "")}
                </p>
              </article>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
