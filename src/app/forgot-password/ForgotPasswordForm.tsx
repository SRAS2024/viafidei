"use client";

import { useState } from "react";

type Labels = {
  email: string;
  submit: string;
  /** Success template — must contain `{email}` which is replaced with the typed address. */
  success: string;
  notFound: string;
  rateLimited: string;
  /** Generic transport / unknown error. */
  error: string;
  /** Shown when the email pipeline is not configured server-side
      (RESEND_API_KEY missing, or sender domain rejected). */
  deliveryFailed: string;
};

const ERROR_COLOR = "#8b1a1a";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; email: string }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "delivery_failed" }
  | { kind: "error" };

export function ForgotPasswordForm({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [email, setEmail] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "loading") return;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setStatus({ kind: "rate_limited" });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        sent?: boolean;
        email?: string;
      };
      if (data.ok && data.sent) {
        setStatus({ kind: "ok", email: data.email ?? email });
        return;
      }
      if (data.error === "not_found") {
        setStatus({ kind: "not_found" });
        return;
      }
      // The account exists but the email never reached the recipient
      // (RESEND_API_KEY missing, sender domain unverified, …). Surface
      // it so the user knows to contact support instead of refreshing
      // their inbox forever.
      if (
        data.error === "server_error" &&
        (data.message === "delivery_failed" || data.message === "email_not_configured")
      ) {
        setStatus({ kind: "delivery_failed" });
        return;
      }
      setStatus({ kind: "error" });
    } catch {
      setStatus({ kind: "error" });
    }
  }

  if (status.kind === "ok") {
    return (
      <p role="status" className="text-center font-serif text-sm text-ink-soft">
        {labels.success.replace("{email}", status.email)}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="email" className="vf-label">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="vf-input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            // Clear the "no account" message as soon as the user edits the
            // address — they're likely correcting a typo.
            if (status.kind === "not_found" || status.kind === "error") {
              setStatus({ kind: "idle" });
            }
          }}
          aria-invalid={status.kind === "not_found"}
          aria-describedby={status.kind === "not_found" ? "forgot-email-error" : undefined}
        />
        {status.kind === "not_found" ? (
          <p
            id="forgot-email-error"
            role="alert"
            className="mt-1 font-serif text-xs"
            style={{ color: ERROR_COLOR }}
          >
            {labels.notFound}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        className="vf-btn vf-btn-primary mt-2"
        disabled={status.kind === "loading"}
        aria-busy={status.kind === "loading"}
      >
        {labels.submit}
      </button>
      {status.kind === "rate_limited" ? (
        <p role="alert" className="text-center text-sm" style={{ color: ERROR_COLOR }}>
          {labels.rateLimited}
        </p>
      ) : null}
      {status.kind === "delivery_failed" ? (
        <p role="alert" className="text-center text-sm" style={{ color: ERROR_COLOR }}>
          {labels.deliveryFailed}
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p role="alert" className="text-center text-sm" style={{ color: ERROR_COLOR }}>
          {labels.error}
        </p>
      ) : null}
    </form>
  );
}
