"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { focusLeftMenu } from "@/components/ui/menuFocus";
import { CloseIcon, HamburgerIcon } from "../icons/HamburgerIcon";
import { useNavSection } from "./NavSection";

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

function groupActive(pathname: string, item: MobileMenuItem, section: string | null): boolean {
  return (
    isActive(pathname, item.href) ||
    item.href === section ||
    (item.items ?? []).some((sub) => isActive(pathname, sub.href) || sub.href === section)
  );
}

/** "page" only for the page itself; an entry under it is in the section, not on it. */
function currentState(pathname: string, href: string, section: string | null) {
  if (pathname === href) return "page" as const;
  return isActive(pathname, href) || href === section ? ("true" as const) : undefined;
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
  const section = useNavSection();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  // Groups whose submenu is expanded. Seed with the group that contains the
  // current route so the menu opens already showing where you are.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const seed = new Set<string>();
    for (const item of navItems) {
      if (item.items && item.items.length > 0 && groupActive(pathname, item, null)) {
        seed.add(item.href);
      }
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

  // The header outlives the page. A move by any route but the menu's own links, Back
  // or a redirect after logging out, must not leave the menu open over the new page.
  useEffect(() => setOpen(false), [pathname]);

  // And the next opening still shows where the reader is now.
  useEffect(() => {
    setExpanded((prev) => {
      const here = navItems.filter(
        (item) => item.items?.length && groupActive(pathname, item, section),
      );
      if (here.every((item) => prev.has(item.href))) return prev;
      return new Set([...prev, ...here.map((item) => item.href)]);
    });
  }, [pathname, section, navItems]);

  // Logging out takes the button away with the menu, so focus waits on the toggle.
  const closeToToggle = () => {
    toggleRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    function onPointer(event: PointerEvent | MouseEvent | TouchEvent) {
      if (!wrapperRef.current) return;
      const target = event.target as Node | null;
      if (target && wrapperRef.current.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // A link in the menu is about to leave the page, and focus with it.
      if (wrapperRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
      setOpen(false);
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
    // Not a control: it only hears focus leaving the menu as a whole, so that a
    // keyboard never moves on to something the open menu is covering.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(e) => {
        if (focusLeftMenu(e.relatedTarget, e.currentTarget)) setOpen(false);
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-label={open ? closeLabel : openLabel}
        aria-expanded={open}
        aria-controls="vf-mobile-menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="vf-mobile-menu-toggle relative -mr-[6px] flex h-[44px] w-[44px] items-center justify-center rounded-sm text-ink"
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
          className="vf-menu absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-var(--header-h)-1rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto !p-0"
        >
          <ul className="flex flex-col py-2">
            {navItems.map((item) => {
              const hasChildren = !!item.items && item.items.length > 0;

              if (!hasChildren) {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={currentState(pathname, item.href, section)}
                      className="vf-mobile-menu-link block px-4 py-3"
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }

              // Grouped tab: on mobile there is no hover, so tapping the whole
              // row expands its sub-tabs inline (the section's own page is the
              // first item inside). This is the standard mobile accordion — a
              // tap reveals the options instead of navigating away.
              const isExpanded = expanded.has(item.href);
              const parentActive = groupActive(pathname, item, section);
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(item.href)}
                    className={`vf-mobile-menu-link flex w-full items-center justify-between px-4 py-3 text-left ${
                      parentActive ? "vf-mobile-menu-link-active" : ""
                    }`}
                  >
                    <span>{item.label}</span>
                    <Chevron open={isExpanded} />
                  </button>
                  {isExpanded ? (
                    <ul className="flex flex-col">
                      {/* The section's own page first, then its sub-tabs —
                          "Saints" expands to Saints · Our Lady · Doctors · Popes,
                          matching the desktop dropdown. */}
                      {[{ href: item.href, label: item.label }, ...item.items!].map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            onClick={() => setOpen(false)}
                            aria-current={currentState(pathname, sub.href, section)}
                            className="vf-mobile-menu-link block py-2.5 pl-8 pr-4 text-sm"
                          >
                            {sub.label}
                          </Link>
                        </li>
                      ))}
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
                      <form
                        action={action.action}
                        method="post"
                        onSubmit={closeToToggle}
                        className="m-0"
                      >
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
                      <form action={action.action} onSubmit={closeToToggle} className="m-0">
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
