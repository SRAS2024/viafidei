"use client";

import { useState } from "react";

const SUCCESS_COLOR = "#185c2a";
const ERROR_COLOR = "#8b1a1a";

const STEP_LABELS: Record<string, string> = {
  create_user: "Create throwaway test user",
  issue_verification_token: "Issue EmailVerificationToken (DB write)",
  issue_password_reset_token: "Issue PasswordResetToken (DB write)",
  send_welcome: "Send welcome email via Resend",
  send_password_reset: "Send password-reset email via Resend",
  send_verify: "Send verify-email via Resend",
  cleanup: "Delete throwaway test user",
};

type Step = { step: string; ok: boolean; message: string };

type Outcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; passed: boolean; steps: Step[] }
  | { kind: "error"; message: string };

export function EmailSelfTestPanel() {
  const [to, setTo] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outcome.kind === "running") return;
    setOutcome({ kind: "running" });
    try {
      const params = new URLSearchParams({ to });
      const res = await fetch(`/api/admin/email/self-test?${params.toString()}`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        passed?: boolean;
        steps?: Step[];
        error?: string;
        message?: string;
      };
      if (!data.ok) {
        setOutcome({
          kind: "error",
          message:
            data.error === "invalid" ? "Enter a valid recipient email." : "Self-test failed.",
        });
        return;
      }
      setOutcome({
        kind: "done",
        passed: !!data.passed,
        steps: data.steps ?? [],
      });
    } catch (err) {
      setOutcome({
        kind: "error",
        message: err instanceof Error ? err.message : "network_error",
      });
    }
  }

  return (
    <form onSubmit={run} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="self-test-to" className="vf-label">
          Recipient (where the three test emails will be sent)
        </label>
        <input
          id="self-test-to"
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          className="vf-input"
          autoComplete="off"
          disabled={outcome.kind === "running"}
        />
      </div>
      <button
        type="submit"
        className="vf-btn vf-btn-primary"
        disabled={outcome.kind === "running"}
        aria-busy={outcome.kind === "running"}
      >
        {outcome.kind === "running" ? "Running self-test…" : "Run end-to-end self-test"}
      </button>

      {outcome.kind === "done" ? (
        <div
          role="status"
          className="rounded-sm border p-4 font-serif text-sm"
          style={{
            borderColor: outcome.passed ? SUCCESS_COLOR : ERROR_COLOR,
            backgroundColor: outcome.passed ? "#f3faf5" : "#fdf6f6",
            color: outcome.passed ? SUCCESS_COLOR : ERROR_COLOR,
          }}
        >
          <p className="font-bold">
            {outcome.passed
              ? "All steps passed — the user-side flows can complete."
              : "Self-test failed. The first ✗ step is the cause."}
          </p>
          <ol className="mt-3 space-y-2 text-ink">
            {outcome.steps.map((s, i) => (
              <li
                key={`${s.step}-${i}`}
                className="flex items-start gap-3 rounded-sm border border-ink/10 bg-paper p-3"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs"
                  style={{
                    backgroundColor: s.ok ? SUCCESS_COLOR : ERROR_COLOR,
                    color: "#ffffff",
                  }}
                >
                  {s.ok ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-medium">{STEP_LABELS[s.step] ?? s.step}</span>
                  <span className="block font-mono text-xs text-ink-faint">{s.message}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {outcome.kind === "error" ? (
        <p role="alert" className="text-sm" style={{ color: ERROR_COLOR }}>
          {outcome.message}
        </p>
      ) : null}
    </form>
  );
}
