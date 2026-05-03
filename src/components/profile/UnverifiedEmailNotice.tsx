"use client";

import { useState } from "react";

type Labels = {
  notice: string;
  resend: string;
  sent: string;
  rateLimited: string;
  error: string;
};

type Status = "idle" | "loading" | "sent" | "rate_limited" | "error";

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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      setStatus(data.ok ? "sent" : "error");
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
        ) : status === "error" ? (
          <span style={{ color: "#8b1a1a" }}>{labels.error}</span>
        ) : null}
      </div>
    </aside>
  );
}
