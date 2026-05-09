"use client";

import { useState } from "react";

const ERROR_COLOR = "#8b1a1a";
const SUCCESS_COLOR = "#185c2a";

type TemplateKind = "plain" | "welcome" | "password_reset" | "verify_email";

const TEMPLATE_OPTIONS: Array<{ value: TemplateKind; label: string; description: string }> = [
  {
    value: "plain",
    label: "Plain test",
    description: "Minimal text-only message. Confirms the API key + verified domain are wired up.",
  },
  {
    value: "welcome",
    label: "Welcome (combined verify)",
    description: "Exact welcome+verify email a new user receives at registration.",
  },
  {
    value: "password_reset",
    label: "Password reset",
    description: "Exact reset email sent when an existing user requests a new password.",
  },
  {
    value: "verify_email",
    label: "Verify email (resend)",
    description: "Exact email sent by the resend-verification button on /profile.",
  },
];

type Outcome =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "sent"; to: string; from: string; template: TemplateKind }
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
  const [template, setTemplate] = useState<TemplateKind>("plain");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outcome.kind === "loading") return;
    setOutcome({ kind: "loading" });
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, template }),
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
          setOutcome({ kind: "sent", to, from: fromAddress, template });
        } else {
          // delivery === "skipped" — Resend API key isn't configured.
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
      <fieldset className="rounded-sm border border-ink/15 p-3">
        <legend className="px-2 vf-eyebrow">Template</legend>
        <div className="flex flex-col gap-2">
          {TEMPLATE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 font-serif text-sm">
              <input
                type="radio"
                name="template"
                value={opt.value}
                checked={template === opt.value}
                onChange={() => setTemplate(opt.value)}
                disabled={!configured || outcome.kind === "loading"}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{opt.label}</span>
                <span className="block text-xs text-ink-faint">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
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
          Sent. Resend accepted the <code>{outcome.template}</code> email from{" "}
          <code>{outcome.from}</code> to <code>{outcome.to}</code>. Check the inbox AND the spam
          folder within a minute. If the plain test arrives but the welcome / reset / verify
          template lands in spam, the issue is your inbox provider&apos;s spam filter, not the app —
          mark the welcome email as &ldquo;Not Spam&rdquo; once and subsequent ones should reach the
          inbox.
        </p>
      ) : null}

      {outcome.kind === "skipped" ? (
        <p
          role="status"
          className="rounded-sm border border-ink/15 bg-ink/5 p-3 font-serif text-sm"
          style={{ color: ERROR_COLOR }}
        >
          Skipped. The send was a no-op because no Resend API key is set on this deployment. Set
          either <code>RESEND_API_KEY</code> or <code>RESEND</code> in your hosting dashboard and
          redeploy.
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
