"use client";

import { useId } from "react";
import type { HomepageBlock } from "./types";

type Props = {
  block: HomepageBlock;
  onChange: (path: string, value: string) => void;
};

export function HeroBlockEditor({ block, onChange }: Props) {
  const cfg = block.configJson;
  const eyebrowId = useId();
  const titleId = useId();
  const ledeId = useId();
  return (
    <div className="vf-card rounded-sm p-6">
      <h3 className="font-display text-2xl">Hero</h3>
      <label className="vf-label mt-4" htmlFor={eyebrowId}>
        Eyebrow
      </label>
      <input
        id={eyebrowId}
        className="vf-input"
        value={String(cfg.eyebrow ?? "")}
        onChange={(e) => onChange("eyebrow", e.target.value)}
      />
      <label className="vf-label mt-4" htmlFor={titleId}>
        Title
      </label>
      <input
        id={titleId}
        className="vf-input"
        value={String(cfg.title ?? "")}
        onChange={(e) => onChange("title", e.target.value)}
      />
      <label className="vf-label mt-4" htmlFor={ledeId}>
        Lede
      </label>
      <textarea
        id={ledeId}
        rows={4}
        className="vf-input"
        value={String(cfg.lede ?? "")}
        onChange={(e) => onChange("lede", e.target.value)}
      />
    </div>
  );
}
