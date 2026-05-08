"use client";

import { useState } from "react";

type Labels = {
  notice: string;
  resend: string;
  sent: string;
  rateLimited: string;
  /** Shown when Resend is not configured / sender domain is rejected. */
  deliveryFailed: string;
  error: string;
};

type Status = "idle" | "loading" | "sent" | "rate_limited" | "delivery_failed" | "error";

export function UnverifiedEmailNotice({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<Status>("idle");

  async function resend() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/verify-email", { method: "PUT" });
      if (res.status === 429) {
        setStatus("rate_limited");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (data.ok) {
        setStatus("sent");
        return;
      }
      // Token was issued but no email left the server (RESEND_API_KEY
      // missing, sender domain unverified, …). Surface that explicitly so
      // the user knows to contact the operator instead of waiting for an
      // email that's never going to arrive.
      if (
        data.error === "server_error" &&
        (data.message === "delivery_failed" || data.message === "email_not_configured")
      ) {
        setStatus("delivery_failed");
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <aside
      className="rounded-sm border border-ink/20 bg-ink/5 p-4 text-sm"
      role="status"
      aria-live="polite"
    >
      <p className="font-serif text-ink">{labels.notice}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={resend}
          disabled={status === "loading"}
          aria-busy={status === "loading"}
          className="vf-btn vf-btn-ghost"
        >
          {labels.resend}
        </button>
        {status === "sent" ? (
          <span className="text-ink-soft">{labels.sent}</span>
        ) : status === "rate_limited" ? (
          <span style={{ color: "#8b1a1a" }}>{labels.rateLimited}</span>
        ) : status === "delivery_failed" ? (
          <span style={{ color: "#8b1a1a" }}>{labels.deliveryFailed}</span>
        ) : status === "error" ? (
          <span style={{ color: "#8b1a1a" }}>{labels.error}</span>
        ) : null}
      </div>
    </aside>
  );
}
