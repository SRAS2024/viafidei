"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type ClientNavLeaf = { href: string; label: string };
export type ClientNavEntry =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; href: string; key: string; label: string; items: ClientNavLeaf[] };

type Props = {
  entries: ClientNavEntry[];
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeaderNavClient({ entries }: Props) {
  const pathname = usePathname() ?? "/";
  const [openKey, setOpenKey] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Close any open dropdown after navigation.
  useEffect(() => setOpenKey(null), [pathname]);

  // Close on outside pointer / Escape.
  useEffect(() => {
    if (!openKey) return;
    function onPointer(event: PointerEvent | MouseEvent) {
      const target = event.target as Node | null;
      if (navRef.current && target && !navRef.current.contains(target)) setOpenKey(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenKey(null);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openKey]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-7"
    >
      {entries.map((entry) => {
        if (entry.kind === "link") {
          const active = isActive(pathname, entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={`vf-nav-link ${active ? "vf-nav-link-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {entry.label}
            </Link>
          );
        }

        const groupActive =
          isActive(pathname, entry.href) || entry.items.some((i) => isActive(pathname, i.href));
        const open = openKey === entry.key;
        // The dropdown lists the section's own page first, then its sub-tabs —
        // so "Saints" expands to Saints · Our Lady · Doctors · Popes.
        const menuItems: ClientNavLeaf[] = [
          { href: entry.href, label: entry.label },
          ...entry.items,
        ];
        return (
          // The container's hover/focus only reveals the submenu as an
          // enhancement; the real controls (the section link + the chevron
          // button) are focusable and fully keyboard-operable, so the wrapper
          // needs no interactive role of its own.
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            key={entry.key}
            className="relative inline-flex items-center"
            // Desktop: hover opens the menu (standard mega-menu behavior);
            // keyboard focus opens it too, and blurring away closes it.
            onMouseEnter={() => setOpenKey(entry.key)}
            onMouseLeave={() => setOpenKey((k) => (k === entry.key ? null : k))}
            onFocus={() => setOpenKey(entry.key)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setOpenKey((k) => (k === entry.key ? null : k));
              }
            }}
          >
            {/* Parent label navigates to its own page; the chevron also toggles
                the submenu for touch / click users who don't hover. */}
            <Link
              href={entry.href}
              className={`vf-nav-link ${groupActive ? "vf-nav-link-active" : ""}`}
              aria-current={isActive(pathname, entry.href) ? "page" : undefined}
            >
              {entry.label}
            </Link>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={`${entry.label} submenu`}
              onClick={() => setOpenKey(open ? null : entry.key)}
              className="vf-nav-link !px-1"
            >
              <Chevron open={open} />
            </button>
            {open ? (
              // `pt-2` (not `mt-2`) keeps the hoverable area contiguous with the
              // tab so the menu doesn't close while the pointer crosses the gap.
              <div
                role="menu"
                aria-label={entry.label}
                className="absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-2"
              >
                <div className="rounded-sm border border-ink/10 bg-paper-bright p-1 shadow-paper">
                  {menuItems.map((leaf) => {
                    const active = isActive(pathname, leaf.href);
                    return (
                      <Link
                        key={leaf.href}
                        href={leaf.href}
                        role="menuitem"
                        onClick={() => setOpenKey(null)}
                        aria-current={active ? "page" : undefined}
                        className={`vf-mobile-menu-link block rounded-sm px-3 py-2 text-sm ${
                          active ? "vf-mobile-menu-link-active" : ""
                        }`}
                      >
                        {leaf.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
