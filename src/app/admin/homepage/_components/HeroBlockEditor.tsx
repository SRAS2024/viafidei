"use client";

import type { HomepageBlock } from "./types";

type Props = {
  block: HomepageBlock;
  onChange: (path: string, value: string) => void;
};

export function HeroBlockEditor({ block, onChange }: Props) {
  const cfg = block.configJson;
  return (
    <div className="vf-card rounded-sm p-6">
      <h3 className="font-display text-2xl">Hero</h3>
      <label className="vf-label mt-4">Eyebrow</label>
      <input
        className="vf-input"
        value={String(cfg.eyebrow ?? "")}
        onChange={(e) => onChange("eyebrow", e.target.value)}
      />
      <label className="vf-label mt-4">Title</label>
      <input
        className="vf-input"
        value={String(cfg.title ?? "")}
        onChange={(e) => onChange("title", e.target.value)}
      />
      <label className="vf-label mt-4">Lede</label>
      <textarea
        rows={4}
        className="vf-input"
        value={String(cfg.lede ?? "")}
        onChange={(e) => onChange("lede", e.target.value)}
      />
    </div>
  );
}
