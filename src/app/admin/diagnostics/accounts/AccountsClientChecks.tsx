"use client";

import { useEffect, useState } from "react";

type ClientCheck = {
  name: string;
  status: "ok" | "warn" | "fail" | "info";
  detail: string;
};

function statusColor(status: ClientCheck["status"]) {
  return status === "ok"
    ? "#185c2a"
    : status === "warn"
      ? "#9b6b00"
      : status === "fail"
        ? "#8b1a1a"
        : "#3b3f4a";
}
function statusGlyph(status: ClientCheck["status"]) {
  return status === "ok" ? "✓" : status === "warn" ? "!" : status === "fail" ? "✗" : "·";
}

/**
 * Browser-side checks that complement the server-side panel on the
 * Accounts Diagnostics page. We test:
 *   • Device date + timezone (used by Today's Feast Day Saints and
 *     any date-dependent UI).
 *   • Language preference resolved from the cookie / document HTML
 *     attribute.
 *   • Geolocation permission state (read-only — no popup is shown).
 *
 * All checks are read-only — nothing mutates state or makes calls.
 */
export function AccountsClientChecks() {
  const [checks, setChecks] = useState<ClientCheck[]>([]);

  useEffect(() => {
    const out: ClientCheck[] = [];

    // Device date + timezone.
    try {
      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "(unknown)";
      out.push({
        name: "Device date & timezone",
        status: "ok",
        detail: `${now.toString()} · timezone resolved as ${tz}. Today's Feast Day Saints uses this date in this timezone.`,
      });
    } catch (err) {
      out.push({
        name: "Device date & timezone",
        status: "fail",
        detail: `Intl.DateTimeFormat threw: ${(err as Error).message}`,
      });
    }

    // Language preference.
    try {
      const documentLang = document.documentElement.lang || "(unset)";
      const navLang = navigator.language || "(unset)";
      out.push({
        name: "Language preference",
        status: "ok",
        detail: `Document <html lang="${documentLang}"> · browser ${navLang}. The user-selected language is persisted in User.language and applied via the i18n cookie.`,
      });
    } catch (err) {
      out.push({
        name: "Language preference",
        status: "fail",
        detail: `Could not read navigator / document: ${(err as Error).message}`,
      });
    }

    // Translation override behavior. The app's translation strategy is
    // "manual locale override wins, otherwise device language". This
    // check reads the vf_locale cookie and reports whether an override
    // is currently in effect, so the operator can confirm the manual-
    // override flow without having to leave the diagnostics page.
    try {
      const cookieMatch = document.cookie.match(/(?:^|;\s*)vf_locale=([^;]+)/);
      const override = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
      const docLang = document.documentElement.lang || "(unset)";
      const matches = override && override === docLang;
      out.push({
        name: "Translation override",
        status: override ? (matches ? "ok" : "warn") : "info",
        detail: override
          ? matches
            ? `Manual override "${override}" is in effect and the document is rendering in that locale.`
            : `Manual override "${override}" is set in the cookie but the document is rendering as "${docLang}". A refresh should reconcile them.`
          : `No manual override set — the app is using automatic locale negotiation (Accept-Language → device default). Setting a locale in /profile/settings persists it to the vf_locale cookie and to User.language.`,
      });
    } catch (err) {
      out.push({
        name: "Translation override",
        status: "fail",
        detail: `Could not read translation cookie: ${(err as Error).message}`,
      });
    }

    // Geolocation permission (read-only).
    if (!("geolocation" in navigator)) {
      out.push({
        name: "Geolocation",
        status: "warn",
        detail: "navigator.geolocation is not available in this browser.",
      });
      setChecks(out);
      return;
    }
    if (
      typeof navigator !== "undefined" &&
      "permissions" in navigator &&
      typeof navigator.permissions?.query === "function"
    ) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          out.push({
            name: "Geolocation permission",
            status: p.state === "granted" ? "ok" : "info",
            detail: `Permission state: ${p.state}. Granting unlocks the "parishes near me" lookup. Manual search by name / city / state / country / diocese always works regardless.`,
          });
          setChecks([...out]);
        })
        .catch(() => {
          out.push({
            name: "Geolocation permission",
            status: "info",
            detail:
              "Permission state could not be queried (older browser). The parish-near-me lookup still works if the user grants permission when asked.",
          });
          setChecks([...out]);
        });
    } else {
      out.push({
        name: "Geolocation permission",
        status: "info",
        detail:
          "navigator.permissions is unavailable in this browser. Parish-near-me lookup still works if the user grants permission.",
      });
      setChecks(out);
    }
  }, []);

  if (checks.length === 0) {
    return <p className="mt-4 font-serif text-sm text-ink-faint">Running device-side checks…</p>;
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {checks.map((c, idx) => (
        <li key={idx} className="vf-card rounded-sm p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
              style={{ backgroundColor: statusColor(c.status) }}
            >
              {statusGlyph(c.status)}
            </span>
            <div className="min-w-0">
              <p className="break-words font-display text-base text-ink">{c.name}</p>
              <p className="mt-1 break-words font-serif text-sm text-ink-soft">{c.detail}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
