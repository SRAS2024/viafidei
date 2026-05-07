"use client";

import { useState } from "react";

const ERROR_COLOR = "#8b1a1a";
const SUCCESS_COLOR = "#185c2a";

type Outcome =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "sent"; to: string; from: string }
  | { kind: "skipped"; from: string }
  | {
      kind: "failed";
      from: string;
      errorName?: string;
      errorMessage?: string;
      statusCode?: number;
    }
  | { kind: "rate_limited" }
  | { kind: "error"; message: string };

type Props = {
  configured: boolean;
  fromAddress: string;
};

export function EmailDiagnosticForm({ configured, fromAddress }: Props) {
  const [to, setTo] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outcome.kind === "loading") return;
    setOutcome({ kind: "loading" });
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        delivery?: "sent" | "skipped";
        error?: string;
        message?: string;
        details?: {
          reason?: string;
          errorName?: string;
          errorMessage?: string;
          statusCode?: number;
          fromAddress?: string;
        };
      };
      if (res.status === 429) {
        setOutcome({ kind: "rate_limited" });
        return;
      }
      if (data.ok) {
        if (data.delivery === "sent") {
          setOutcome({ kind: "sent", to, from: fromAddress });
        } else {
          // delivery === "skipped" — RESEND_API_KEY isn't configured.
          setOutcome({ kind: "skipped", from: fromAddress });
        }
        return;
      }
      if (data.error === "server_error" && data.details) {
        setOutcome({
          kind: "failed",
          from: data.details.fromAddress ?? fromAddress,
          errorName: data.details.errorName,
          errorMessage: data.details.errorMessage,
          statusCode: data.details.statusCode,
        });
        return;
      }
      setOutcome({ kind: "error", message: data.error ?? "unknown_error" });
    } catch (err) {
      setOutcome({
        kind: "error",
        message: err instanceof Error ? err.message : "unknown_error",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="to" className="vf-label">
          Recipient address
        </label>
        <input
          id="to"
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          className="vf-input"
          autoComplete="off"
          disabled={!configured || outcome.kind === "loading"}
        />
      </div>
      <button
        type="submit"
        className="vf-btn vf-btn-primary"
        disabled={!configured || outcome.kind === "loading"}
        aria-busy={outcome.kind === "loading"}
      >
        {outcome.kind === "loading" ? "Sending…" : "Send test email"}
      </button>

      {outcome.kind === "sent" ? (
        <p
          role="status"
          className="rounded-sm border border-ink/15 bg-ink/5 p-3 font-serif text-sm"
          style={{ color: SUCCESS_COLOR }}
        >
          Sent. Resend accepted a message from <code>{outcome.from}</code> to{" "}
          <code>{outcome.to}</code>. Check the inbox (and spam folder) within a minute.
        </p>
      ) : null}

      {outcome.kind === "skipped" ? (
        <p
          role="status"
          className="rounded-sm border border-ink/15 bg-ink/5 p-3 font-serif text-sm"
          style={{ color: ERROR_COLOR }}
        >
          Skipped. The send was a no-op because <code>RESEND_API_KEY</code> is not set on this
          deployment. Set it in your hosting dashboard and redeploy.
        </p>
      ) : null}

      {outcome.kind === "failed" ? (
        <div
          role="alert"
          className="rounded-sm border border-ink/15 bg-ink/5 p-3 font-serif text-sm"
          style={{ color: ERROR_COLOR }}
        >
          <p>
            Resend rejected the send from <code>{outcome.from}</code>.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {outcome.errorName ? (
              <li>
                <span className="opacity-70">name:</span> {outcome.errorName}
              </li>
            ) : null}
            {outcome.errorMessage ? (
              <li>
                <span className="opacity-70">message:</span> {outcome.errorMessage}
              </li>
            ) : null}
            {outcome.statusCode ? (
              <li>
                <span className="opacity-70">status:</span> {outcome.statusCode}
              </li>
            ) : null}
          </ul>
          <p className="mt-2">
            The most common cause is that the sender domain has not been verified in the Resend
            dashboard. Add the domain there and confirm the DKIM/SPF records before retrying.
          </p>
        </div>
      ) : null}

      {outcome.kind === "rate_limited" ? (
        <p role="alert" className="text-sm" style={{ color: ERROR_COLOR }}>
          Too many requests. Wait a moment and try again.
        </p>
      ) : null}

      {outcome.kind === "error" ? (
        <p role="alert" className="text-sm" style={{ color: ERROR_COLOR }}>
          Unexpected error: <code>{outcome.message}</code>
        </p>
      ) : null}
    </form>
  );
}
