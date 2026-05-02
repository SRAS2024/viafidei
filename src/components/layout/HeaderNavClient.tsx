"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export type NavItem = { href: string; key: string; label: string };

type Props = {
  items: NavItem[];
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNavClient({ items }: Props) {
  const pathname = usePathname() ?? "/";
  const itemsWithState = useMemo(
    () => items.map((item) => ({ ...item, active: isActive(pathname, item.href) })),
    [items, pathname],
  );
  return (
    <nav
      aria-label="Primary"
      className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-7"
    >
      {itemsWithState.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`vf-nav-link ${item.active ? "vf-nav-link-active" : ""}`}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
