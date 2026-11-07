"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { focusLeftMenu } from "@/components/ui/menuFocus";

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

const MENU_ID = "vf-user-menu";

/**
 * Header account control. Signed out, it's a single "Log in" link. Signed in,
 * the avatar opens a dropdown with Profile, Settings, and — just below — Log
 * out, matching the mobile menu's account actions.
 *
 * A plain disclosure, as the header's other menus are: a button that says whether it
 * is open, then a list of a link, a link and a button, reached by Tab or a screen
 * reader's next item. Called a menu, it would promise the arrow keys a menu has.
 */
export function HeaderUserMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // The item holding focus is about to go, and focus with it.
      if (ref.current?.contains(document.activeElement)) toggleRef.current?.focus();
      setOpen(false);
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
    // Not a control: it only hears focus leaving the menu as a whole.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (focusLeftMenu(e.relatedTarget, e.currentTarget)) setOpen(false);
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={MENU_ID}
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
        <ul
          id={MENU_ID}
          role="list"
          aria-label={labels.profile}
          className="vf-menu absolute right-0 top-full z-50 mt-2 w-48"
        >
          <li>
            <Link href="/profile" onClick={() => setOpen(false)} className="vf-menu-item">
              {labels.profile}
            </Link>
          </li>
          <li>
            <Link href="/profile/settings" onClick={() => setOpen(false)} className="vf-menu-item">
              {labels.settings}
            </Link>
          </li>
          <li>
            <form action={props.logoutAction} className="m-0">
              <button type="submit" className="vf-menu-item">
                {labels.logout}
              </button>
            </form>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
