"use client";

import { useEffect } from "react";

/**
 * Keeps `--header-h` the height the header really has. The stylesheet's value is
 * right for the first paint and needs no script, but only this can know the height
 * when a long translation wraps the tabs, or when text was enlarged by a route a
 * media query cannot see, where the header's container query has already changed
 * layout. Sticky rows, in-page jumps and tall menus all measure from it.
 */
export function HeaderHeight() {
  useEffect(() => {
    const header = document.querySelector("header.vf-header");
    if (!header || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--header-h", `${header.getBoundingClientRect().height}px`);
    });
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--header-h");
    };
  }, []);
  return null;
}
