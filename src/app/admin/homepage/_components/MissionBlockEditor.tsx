"use client";

import type { HomepageBlock } from "./types";

type Props = {
  block: HomepageBlock;
  onChange: (path: string, value: string) => void;
};

function readSide(block: HomepageBlock, side: "left" | "right") {
  const value = block.configJson[side];
  return (value && typeof value === "object" ? (value as Record<string, unknown>) : {}) ?? {};
}

export function MissionBlockEditor({ block, onChange }: Props) {
  const left = readSide(block, "left");
  const right = readSide(block, "right");
  return (
    <div className="vf-card rounded-sm p-6">
      <h3 className="font-display text-2xl">Mission / Overview</h3>
      <label className="vf-label mt-4">Left title</label>
      <input
        className="vf-input"
        value={String(left.title ?? "")}
        onChange={(e) => onChange("left.title", e.target.value)}
      />
      <label className="vf-label mt-4">Left body</label>
      <textarea
        rows={3}
        className="vf-input"
        value={String(left.body ?? "")}
        onChange={(e) => onChange("left.body", e.target.value)}
      />
      <label className="vf-label mt-4">Right title</label>
      <input
        className="vf-input"
        value={String(right.title ?? "")}
        onChange={(e) => onChange("right.title", e.target.value)}
      />
      <label className="vf-label mt-4">Right body</label>
      <textarea
        rows={3}
        className="vf-input"
        value={String(right.body ?? "")}
        onChange={(e) => onChange("right.body", e.target.value)}
      />
    </div>
  );
}
