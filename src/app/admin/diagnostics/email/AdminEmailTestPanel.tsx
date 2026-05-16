"use client";

import { useState } from "react";

const SUCCESS_COLOR = "#185c2a";
const ERROR_COLOR = "#8b1a1a";
const FAINT_COLOR = "#4a4a4a";

type Flow =
  | "biweekly_report"
  | "monthly_archive_cleanup"
  | "monthly_error_report"
  | "milestone_25"
  | "milestone_50"
  | "milestone_75"
  | "milestone_final"
  | "critical_failure"
  | "security_breach";

const FLOW_OPTIONS: Array<{ value: Flow; label: string; description: string }> = [
  {
    value: "biweekly_report",
    label: "Biweekly Admin Report",
    description:
      "Subject: 'Biweekly Admin Report'. Body contains the Content Management Report table (Content / Added / Edited / Deleted / Archived).",
  },
  {
    value: "monthly_archive_cleanup",
    label: "Monthly Archive Cleaning Up",
    description:
      "Subject: 'Monthly Archive Cleaning Up'. Sent on the last day of each month after the hard-delete pass; this preview uses sample numbers.",
  },
  {
    value: "monthly_error_report",
    label: "Monthly Error Report (PDF)",
    description:
      "Subject: 'Error Report'. Sent on the last day of each month with a PDF attachment summarising every error captured in the ErrorLog table.",
  },
  {
    value: "milestone_25",
    label: "Threshold milestone — 25%",
    description:
      "Example milestone alert. Subject: '<Content> 25% Threshold Reached'. Fired once per (bucket, threshold) crossing.",
  },
  {
    value: "milestone_50",
    label: "Threshold milestone — 50%",
    description: "Example: 'Saints 50% Threshold Reached'.",
  },
  {
    value: "milestone_75",
    label: "Threshold milestone — 75%",
    description: "Example: 'Church Documents 75% Threshold Reached'.",
  },
  {
    value: "milestone_final",
    label: "Threshold milestone — 100% (Final)",
    description:
      "Example: 'Sacraments Final Threshold Reached'. Fires when a bucket first hits 100% of its target.",
  },
  {
    value: "critical_failure",
    label: "Critical Failure",
    description:
      "Subject: 'Critical Failure'. Reserved for site-crash-class events (uncaught exception, React global error boundary, unhandled promise rejection).",
  },
  {
    value: "security_breach",
    label: "Security Breach",
    description:
      "Subject: 'Security Breach'. Fired on devtools/inspector tampering, admin login rate-limit blowouts, CSP violations, and other suspicious activity.",
  },
];

type Outcome =
  | { kind: "idle" }
  | { kind: "loading"; flow: Flow }
  | { kind: "sent"; flow: Flow; adminEmail: string }
  | { kind: "skipped"; flow: Flow; reason: string }
  | { kind: "failed"; flow: Flow; reason: string }
  | { kind: "error"; message: string };

type Props = {
  /** Resolved ADMIN_EMAIL from the server. null when unset. */
  adminEmail: string | null;
  /** True when RESEND_API_KEY is set. */
  resendConfigured: boolean;
};

const PANEL_STYLE: React.CSSProperties = {
  border: "1px solid rgba(17,17,17,0.18)",
  background: "#fbf8f1",
  padding: "1.5rem",
  margin: "1.5rem 0",
};

const HEADING_STYLE: React.CSSProperties = {
  margin: "0 0 0.5rem",
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: "1.25rem",
  fontWeight: 500,
};

const BUTTON_STYLE: React.CSSProperties = {
  marginTop: "0.75rem",
  padding: "0.5rem 1rem",
  background: "#1f3a8a",
  color: "#ffffff",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: "0.9rem",
  letterSpacing: "0.04em",
};

function describe(outcome: Outcome): React.ReactNode {
  switch (outcome.kind) {
    case "idle":
      return null;
    case "loading":
      return <p style={{ color: FAINT_COLOR }}>Sending {labelFor(outcome.flow)}…</p>;
    case "sent":
      return (
        <p style={{ color: SUCCESS_COLOR }}>
          {labelFor(outcome.flow)} delivered to <code>{outcome.adminEmail}</code>. Check the mailbox
          to verify the subject, formatting, and (where applicable) attachment.
        </p>
      );
    case "skipped":
      return (
        <p style={{ color: ERROR_COLOR }}>
          Skipped at the transport layer: <code>{outcome.reason}</code>. Set{" "}
          <code>ADMIN_EMAIL</code> + <code>RESEND_API_KEY</code> in the hosting dashboard and
          redeploy.
        </p>
      );
    case "failed":
      return (
        <p style={{ color: ERROR_COLOR }}>
          Delivery failed for {labelFor(outcome.flow)}: <code>{outcome.reason}</code>
        </p>
      );
    case "error":
      return <p style={{ color: ERROR_COLOR }}>Error: {outcome.message}</p>;
  }
}

function labelFor(flow: Flow): string {
  return FLOW_OPTIONS.find((opt) => opt.value === flow)?.label ?? flow;
}

export function AdminEmailTestPanel({ adminEmail, resendConfigured }: Props) {
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const disabled = !adminEmail || !resendConfigured;
  const blocker = !adminEmail
    ? "ADMIN_EMAIL is not set on this deployment."
    : !resendConfigured
      ? "RESEND_API_KEY is not set on this deployment."
      : null;

  async function trigger(flow: Flow) {
    setOutcome({ kind: "loading", flow });
    try {
      const res = await fetch("/api/admin/email/admin-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        delivery?: "sent" | "skipped";
        reason?: string;
        flow?: Flow;
        adminEmail?: string;
      };
      if (!res.ok || body.ok === false) {
        setOutcome({
          kind: "failed",
          flow,
          reason: body.reason ?? `HTTP ${res.status}`,
        });
        return;
      }
      if (body.delivery === "skipped") {
        setOutcome({ kind: "skipped", flow, reason: body.reason ?? "skipped" });
        return;
      }
      setOutcome({
        kind: "sent",
        flow,
        adminEmail: body.adminEmail ?? adminEmail ?? "(unknown)",
      });
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <section style={PANEL_STYLE}>
      <h2 style={HEADING_STYLE}>Admin email diagnostics</h2>
      <p style={{ margin: "0 0 1rem", color: FAINT_COLOR, fontSize: "0.95rem" }}>
        Send a labeled example of each admin notification flow to{" "}
        <code>{adminEmail ?? "(ADMIN_EMAIL not set)"}</code> so the entire pipeline (template →
        Resend → mailbox) can be verified end-to-end. Every send uses obvious sample data so the
        recipient knows it is a diagnostic.
      </p>
      {blocker ? <p style={{ color: ERROR_COLOR }}>{blocker}</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem" }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "0.5rem",
                borderBottom: "1px solid rgba(17,17,17,0.18)",
                fontFamily: "'Inter', Arial, sans-serif",
                fontSize: "0.75rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: FAINT_COLOR,
              }}
            >
              Flow
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "0.5rem",
                borderBottom: "1px solid rgba(17,17,17,0.18)",
                fontFamily: "'Inter', Arial, sans-serif",
                fontSize: "0.75rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: FAINT_COLOR,
              }}
            >
              Description
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "0.5rem",
                borderBottom: "1px solid rgba(17,17,17,0.18)",
              }}
            />
          </tr>
        </thead>
        <tbody>
          {FLOW_OPTIONS.map((opt) => (
            <tr key={opt.value}>
              <td
                style={{
                  padding: "0.6rem 0.5rem",
                  borderBottom: "1px solid rgba(17,17,17,0.08)",
                  verticalAlign: "top",
                  fontWeight: 500,
                }}
              >
                {opt.label}
              </td>
              <td
                style={{
                  padding: "0.6rem 0.5rem",
                  borderBottom: "1px solid rgba(17,17,17,0.08)",
                  color: FAINT_COLOR,
                  fontSize: "0.9rem",
                }}
              >
                {opt.description}
              </td>
              <td
                style={{
                  padding: "0.6rem 0.5rem",
                  borderBottom: "1px solid rgba(17,17,17,0.08)",
                  textAlign: "right",
                }}
              >
                <button
                  type="button"
                  style={{
                    ...BUTTON_STYLE,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                  disabled={disabled || outcome.kind === "loading"}
                  onClick={() => void trigger(opt.value)}
                >
                  Send
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: "1rem" }}>{describe(outcome)}</div>
    </section>
  );
}
