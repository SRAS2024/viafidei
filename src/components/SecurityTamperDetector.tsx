"use client";

import { useEffect } from "react";

/**
 * Client-side tamper detector. Sits in the admin chrome and watches
 * for browser-inspector / devtools abuse and other unauthorised
 * client-side state mutation. Each detected event is reported to
 * `/api/internal/security-event`, which writes a row to ErrorLog
 * and (subject to a 5-minute dedup) sends a Security Breach email
 * to ADMIN_EMAIL.
 *
 * What we look for:
 *   1. **Devtools open on an admin surface.** We measure the difference
 *      between window outerHeight/outerWidth and innerHeight/innerWidth.
 *      A persistent gap larger than the expected browser chrome means
 *      a docked devtools panel is open. Triggers `client_devtools_open`.
 *   2. **DOM mutation of the admin chrome.** The MutationObserver hook
 *      flags scripted alteration of the admin shell — the kind of edit
 *      a tampering session would attempt before submitting a forged
 *      request.
 *   3. **CSP violation.** The browser fires `securitypolicyviolation`
 *      whenever the CSP blocks a resource. Often benign (a third-party
 *      extension), but on the admin surface it's still worth surfacing.
 *
 * Dedup happens server-side; the client reports freely.
 */
export function SecurityTamperDetector() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastDevtoolsReport = 0;
    let lastDomReport = 0;
    let cancelled = false;

    function postEvent(payload: {
      kind: string;
      summary: string;
      detail?: Record<string, string>;
    }) {
      try {
        void fetch("/api/internal/security-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: payload.kind,
            summary: payload.summary,
            route: window.location.pathname,
            detail: payload.detail,
          }),
          keepalive: true,
        });
      } catch {
        // Best-effort.
      }
    }

    const checkDevtools = () => {
      if (cancelled) return;
      const now = Date.now();
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;
      // Heuristic: docked devtools usually take ≥160px of viewport on
      // one axis. Pure browser chrome (toolbar / tab strip) is normally
      // < 120px on the height axis and ≈ 0 on the width axis.
      const opened = widthDelta > 160 || heightDelta > 200;
      if (opened && now - lastDevtoolsReport > 60_000) {
        lastDevtoolsReport = now;
        postEvent({
          kind: "client_devtools_open",
          summary: "Browser developer tools were detected as open on the admin surface.",
          detail: {
            outerWidth: String(window.outerWidth),
            innerWidth: String(window.innerWidth),
            outerHeight: String(window.outerHeight),
            innerHeight: String(window.innerHeight),
          },
        });
      }
    };

    const intervalHandle = window.setInterval(checkDevtools, 2000);

    let observer: MutationObserver | null = null;
    const adminRoot = document.querySelector("[data-admin-surface]");
    if (adminRoot && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver((mutations) => {
        const now = Date.now();
        if (now - lastDomReport < 60_000) return;
        const suspicious = mutations.some(
          (m) =>
            m.type === "attributes" &&
            (m.attributeName === "data-admin-surface" || m.attributeName === "lang"),
        );
        if (suspicious) {
          lastDomReport = now;
          postEvent({
            kind: "client_dom_tamper",
            summary: "Unexpected mutation of the admin chrome was detected.",
          });
        }
      });
      observer.observe(adminRoot, {
        attributes: true,
        attributeFilter: ["data-admin-surface", "lang"],
      });
    }

    const onCspViolation = (ev: SecurityPolicyViolationEvent) => {
      postEvent({
        kind: "client_csp_violation",
        summary: `Content Security Policy violation on ${ev.documentURI}.`,
        detail: {
          violatedDirective: ev.violatedDirective,
          blockedURI: ev.blockedURI,
        },
      });
    };
    document.addEventListener("securitypolicyviolation", onCspViolation);

    return () => {
      cancelled = true;
      window.clearInterval(intervalHandle);
      if (observer) observer.disconnect();
      document.removeEventListener("securitypolicyviolation", onCspViolation);
    };
  }, []);

  return null;
}
