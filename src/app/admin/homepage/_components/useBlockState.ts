"use client";

import { useCallback, useState } from "react";
import type { HomepageBlock } from "./types";

function setNestedValue(target: Record<string, unknown>, path: string[], value: string) {
  let cursor = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const existing = cursor[key];
    const nested =
      typeof existing === "object" && existing !== null
        ? { ...(existing as Record<string, unknown>) }
        : {};
    cursor[key] = nested;
    cursor = nested;
  }
  cursor[path[path.length - 1]] = value;
}

export function useBlockState(initial: HomepageBlock[]) {
  const [blocks, setBlocks] = useState<HomepageBlock[]>(initial);

  const updateField = useCallback((blockKey: string, path: string, value: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.blockKey !== blockKey) return b;
        const next: HomepageBlock = { ...b, configJson: { ...b.configJson } };
        setNestedValue(next.configJson, path.split("."), value);
        return next;
      }),
    );
  }, []);

  return { blocks, updateField };
}
