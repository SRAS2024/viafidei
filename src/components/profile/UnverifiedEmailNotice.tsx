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
      // Server-side failure: either the token write failed (missing
      // table / migration), Resend is not configured, or Resend
      // rejected the send (sender domain unverified, restricted key,
      // …). Surface that explicitly so the user knows to contact the
      // operator instead of waiting for an email that's never going to
      // arrive.
      if (
        data.error === "server_error" &&
        (data.message === "delivery_failed" ||
          data.message === "email_not_configured" ||
          data.message === "token_creation_failed")
      ) {
        setStatus("delivery_failed");
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  const failure =
    status === "rate_limited"
      ? labels.rateLimited
      : status === "delivery_failed"
        ? labels.deliveryFailed
        : status === "error"
          ? labels.error
          : null;

  return (
    <div className="vf-notice">
      <p>{labels.notice}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={resend}
          aria-disabled={status === "loading"}
          aria-busy={status === "loading"}
          className="vf-btn vf-btn-sm vf-btn-ghost"
        >
          {labels.resend}
        </button>
        {/* Kept on the page empty, so its text is announced when it arrives. */}
        <span role="status" aria-live="polite">
          {status === "sent" ? labels.sent : ""}
        </span>
        {failure ? (
          <span role="alert" className="vf-field-error !mt-0">
            {failure}
          </span>
        ) : null}
      </div>
    </div>
  );
}
