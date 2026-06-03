"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { UserSilhouetteIcon } from "../icons/UserSilhouetteIcon";

type AuthedLabels = {
  profile: string;
  settings: string;
  logout: string;
};

type AnonLabels = {
  login: string;
};

type Props =
  | {
      isAuthed: true;
      labels: AuthedLabels;
      avatarSrc?: string | null;
      /** Server action that signs the user out and revalidates the header. */
      logoutAction: () => Promise<void> | void;
    }
  | { isAuthed: false; labels: AnonLabels };

/**
 * Header account control. Signed out, it's a single "Log in" link. Signed in,
 * the avatar opens a dropdown with Profile, Settings, and — just below — Log
 * out, matching the mobile menu's account actions.
 */
export function HeaderUserMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!props.isAuthed) {
    return (
      <div className="flex items-center gap-5">
        <Link href="/login" className="vf-nav-link">
          {props.labels.login}
        </Link>
      </div>
    );
  }

  const { labels, avatarSrc } = props;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.profile}
        onClick={() => setOpen((v) => !v)}
        className="vf-header-avatar flex items-center justify-center rounded-full"
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <UserSilhouetteIcon size={32} className="block" />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={labels.profile}
          className="absolute right-0 top-full z-50 mt-2 w-44 rounded-sm border border-ink/10 bg-paper-bright p-1 shadow-paper"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="vf-mobile-menu-link block rounded-sm px-3 py-2 text-sm"
          >
            {labels.profile}
          </Link>
          <Link
            href="/profile/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="vf-mobile-menu-link block rounded-sm px-3 py-2 text-sm"
          >
            {labels.settings}
          </Link>
          <form action={props.logoutAction} className="m-0">
            <button
              type="submit"
              role="menuitem"
              className="vf-mobile-menu-link block w-full rounded-sm px-3 py-2 text-left text-sm"
            >
              {labels.logout}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
