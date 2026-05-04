"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, HamburgerIcon } from "../icons/HamburgerIcon";

export type MobileMenuItem = { href: string; label: string };
export type MobileMenuAction =
  | { type: "link"; href: string; label: string }
  | { type: "form-button"; action: string; label: string };

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
        <div
          id="vf-mobile-menu"
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-sm border border-ink/10 bg-paper-bright shadow-paper"
        >
          <ul className="flex flex-col py-2">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    role="menuitem"
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
            })}

            {showSettings && settingsLabel ? (
              <li>
                <Link
                  href="/profile/settings"
                  role="menuitem"
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
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="vf-mobile-menu-link block px-4 py-3"
                      >
                        {action.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={action.action}>
                      <form action={action.action} method="post" className="m-0">
                        <button
                          type="submit"
                          role="menuitem"
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
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="vf-mobile-menu-link block px-4 py-3"
                  >
                    {signInItem.label}
                  </Link>
                </li>
              </>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
