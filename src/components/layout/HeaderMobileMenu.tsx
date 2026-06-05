"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, HamburgerIcon } from "../icons/HamburgerIcon";

export type MobileMenuItem = { href: string; label: string; items?: MobileMenuItem[] };
export type MobileMenuAction =
  | { type: "link"; href: string; label: string }
  | {
      type: "form-button";
      // Either a path (legacy POST → route handler) or a Server Action that
      // does its own redirect + cache revalidation. The latter is the
      // correct path for sign-out so the Header refreshes without a manual
      // page reload.
      action: string | (() => Promise<void> | void);
      label: string;
    };

type Props = {
  navItems: MobileMenuItem[];
  signInItem: MobileMenuItem | null;
  authedActions?: MobileMenuAction[];
  openLabel: string;
  closeLabel: string;
  showSettings?: boolean;
  settingsLabel?: string;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupActive(pathname: string, item: MobileMenuItem): boolean {
  return (
    isActive(pathname, item.href) || (item.items ?? []).some((sub) => isActive(pathname, sub.href))
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
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

export function HeaderMobileMenu({
  navItems,
  signInItem,
  authedActions,
  openLabel,
  closeLabel,
  showSettings,
  settingsLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Groups whose submenu is expanded. Seed with the group that contains the
  // current route so the menu opens already showing where you are.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const seed = new Set<string>();
    for (const item of navItems) {
      if (item.items && item.items.length > 0 && groupActive(pathname, item)) seed.add(item.href);
    }
    return seed;
  });
  const toggleExpanded = (href: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });

  useEffect(() => {
    function onPointer(event: PointerEvent | MouseEvent | TouchEvent) {
      if (!wrapperRef.current) return;
      const target = event.target as Node | null;
      if (target && wrapperRef.current.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    // pointerdown fires before click on iOS/Android, so the menu closes
    // reliably even when a tap lands on an SVG child or the document body.
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative sm:hidden">
      <button
        type="button"
        aria-label={open ? closeLabel : openLabel}
        aria-expanded={open}
        aria-controls="vf-mobile-menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="vf-mobile-menu-toggle relative -mr-2 flex h-12 w-12 items-center justify-center rounded-sm text-ink"
      >
        {/* Visually centered icon, but a 48x48 hit target that doesn't move
            its visual position. The pointer-events catch on the button itself,
            never the SVG children, so taps register accurately at any spot. */}
        <span aria-hidden="true" className="pointer-events-none flex items-center justify-center">
          {open ? <CloseIcon size={24} /> : <HamburgerIcon size={24} />}
        </span>
      </button>

      {open ? (
        <nav
          id="vf-mobile-menu"
          aria-label="Mobile navigation"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-sm border border-ink/10 bg-paper-bright shadow-paper"
        >
          <ul className="flex flex-col py-2">
            {navItems.map((item) => {
              const hasChildren = !!item.items && item.items.length > 0;
              const active = isActive(pathname, item.href);

              if (!hasChildren) {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`vf-mobile-menu-link block px-4 py-3 ${
                        active ? "vf-mobile-menu-link-active" : ""
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }

              // Grouped tab: the label navigates to the section page; the
              // chevron expands its sub-tabs inline (mirrors the desktop menu).
              const isExpanded = expanded.has(item.href);
              const parentActive = groupActive(pathname, item);
              return (
                <li key={item.href}>
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`vf-mobile-menu-link block flex-1 px-4 py-3 ${
                        parentActive ? "vf-mobile-menu-link-active" : ""
                      }`}
                    >
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${item.label} submenu`}
                      onClick={() => toggleExpanded(item.href)}
                      className="vf-mobile-menu-link flex h-12 w-12 items-center justify-center text-ink-soft"
                    >
                      <Chevron open={isExpanded} />
                    </button>
                  </div>
                  {isExpanded ? (
                    <ul className="flex flex-col">
                      {item.items!.map((sub) => {
                        const subActive = isActive(pathname, sub.href);
                        return (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              onClick={() => setOpen(false)}
                              aria-current={subActive ? "page" : undefined}
                              className={`vf-mobile-menu-link block py-2.5 pl-8 pr-4 text-sm ${
                                subActive ? "vf-mobile-menu-link-active" : ""
                              }`}
                            >
                              {sub.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}

            {showSettings && settingsLabel ? (
              <li>
                <Link
                  href="/profile/settings"
                  onClick={() => setOpen(false)}
                  className="vf-mobile-menu-link block px-4 py-3"
                >
                  {settingsLabel}
                </Link>
              </li>
            ) : null}

            {authedActions && authedActions.length > 0 ? (
              <>
                <li className="my-2 border-t border-ink/10" aria-hidden="true" />
                {authedActions.map((action) =>
                  action.type === "link" ? (
                    <li key={action.href}>
                      <Link
                        href={action.href}
                        onClick={() => setOpen(false)}
                        className="vf-mobile-menu-link block px-4 py-3"
                      >
                        {action.label}
                      </Link>
                    </li>
                  ) : typeof action.action === "string" ? (
                    <li key={action.action}>
                      <form action={action.action} method="post" className="m-0">
                        <button
                          type="submit"
                          className="vf-mobile-menu-link block w-full px-4 py-3 text-left"
                        >
                          {action.label}
                        </button>
                      </form>
                    </li>
                  ) : (
                    <li key={action.label}>
                      <form action={action.action} className="m-0">
                        <button
                          type="submit"
                          className="vf-mobile-menu-link block w-full px-4 py-3 text-left"
                        >
                          {action.label}
                        </button>
                      </form>
                    </li>
                  ),
                )}
              </>
            ) : null}

            {signInItem ? (
              <>
                <li className="my-2 border-t border-ink/10" aria-hidden="true" />
                <li>
                  <Link
                    href={signInItem.href}
                    onClick={() => setOpen(false)}
                    className="vf-mobile-menu-link block px-4 py-3"
                  >
                    {signInItem.label}
                  </Link>
                </li>
              </>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
