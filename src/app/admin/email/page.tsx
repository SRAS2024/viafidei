import { redirect } from "next/navigation";
import { appConfig } from "@/lib/config";
import { requireAdmin } from "@/lib/auth";
import { readResendApiKey } from "@/lib/email/resend";
import { checkAccountEmailDb, type EmailFlowDbCheck } from "@/lib/email/db-health";
import { logger } from "@/lib/observability";
import { AdminSection } from "../_sections/AdminSection";
import { EmailDiagnosticForm } from "./EmailDiagnosticForm";
import { EmailSelfTestPanel } from "./EmailSelfTestPanel";
import { EnsureTablesButton } from "./EnsureTablesButton";

export const dynamic = "force-dynamic";

const SUCCESS_COLOR = "#185c2a";
const ERROR_COLOR = "#8b1a1a";

export default async function AdminEmailPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  // Resolve the API key through the same helper the sender uses, so this
  // page never reports "configured" while the sender sees it as missing
  // (or vice versa). The helper reads `RESEND_API_KEY` from process.env.
  const apiKey = readResendApiKey();
  const configured = apiKey !== null;
  const apiKeyPreview = apiKey ? `${apiKey.slice(0, 4)}…(${apiKey.length} chars)` : null;

  // Run the database-side check inline so the operator sees the same
  // diagnosis the production routes would emit if a token write failed.
  // Falling back to a manufactured "unknown" result if the query itself
  // throws keeps the page renderable — the row marked `present:false`
  // is the actionable item.
  let dbCheck: EmailFlowDbCheck;
  try {
    dbCheck = await checkAccountEmailDb();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    logger.error("admin.email.db_health_check_failed", { message });
    dbCheck = {
      ok: false,
      pieces: [
        {
          kind: "table",
          name: "(metadata query)",
          present: false,
          message: `Could not query schema metadata: ${message}`,
        },
      ],
    };
  }

  return (
    <AdminSection
      titleKey="admin.email.title"
      subtitle="Verify Resend configuration and send a test message to confirm the sender domain is working."
    >
      <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-6">
        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">Configuration</h2>
          <dl className="mt-4 space-y-3 font-serif text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-faint">Provider</dt>
              <dd className="font-medium text-ink">{appConfig.email.providerName}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-faint">From address</dt>
              <dd className="font-mono text-xs text-ink">{appConfig.email.fromAddress}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-faint">API key</dt>
              <dd className={configured ? "font-medium text-ink" : "font-medium"}>
                {configured ? (
                  <span className="font-mono text-xs">{apiKeyPreview}</span>
                ) : (
                  <span style={{ color: ERROR_COLOR }}>not set</span>
                )}
              </dd>
            </div>
          </dl>
          {!configured ? (
            <p className="mt-5 rounded-sm border border-ink/15 bg-ink/5 p-4 font-serif text-sm text-ink-soft">
              No <code>RESEND_API_KEY</code> is set on this deployment. Until it is, every welcome /
              password-reset / verification send is skipped at the transport layer — the calling
              route surfaces this as <code>email_not_configured</code> so the user knows delivery
              did not happen. Set <code>RESEND_API_KEY</code> in your hosting dashboard, redeploy,
              then come back here to send a test.
            </p>
          ) : null}
        </section>

        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">Database (account email contract)</h2>
          <p className="mt-2 font-serif text-sm text-ink-soft">
            Every real flow (welcome, resend verification, forgot password) writes a token row to
            the database <em>before</em> calling Resend. A green Resend test does NOT prove the
            flows work — if these tables / columns are missing, the route throws before email is
            sent, and the user sees a generic &ldquo;could not send&rdquo; message.
          </p>
          <ul className="mt-5 space-y-2 font-serif text-sm">
            {dbCheck.pieces.map((piece) => (
              <li
                key={`${piece.kind}-${piece.name}`}
                className="flex items-start gap-3 rounded-sm border border-ink/10 p-3"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs"
                  style={{
                    backgroundColor: piece.present ? SUCCESS_COLOR : ERROR_COLOR,
                    color: "#ffffff",
                  }}
                >
                  {piece.present ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-mono text-xs text-ink">{piece.name}</span>
                  <span className="block text-xs text-ink-faint">{piece.message}</span>
                </span>
              </li>
            ))}
          </ul>
          {!dbCheck.ok ? (
            <p
              role="alert"
              className="mt-5 rounded-sm border p-4 font-serif text-sm"
              style={{ borderColor: ERROR_COLOR, color: ERROR_COLOR, backgroundColor: "#fdf6f6" }}
            >
              <span className="font-bold">This is why the real flows fail.</span> Click the button
              below to create any missing tables in-process (idempotent), or run{" "}
              <code>npx prisma migrate deploy</code> against the production database. Either fixes
              the contract; the button is faster.
            </p>
          ) : null}
          <EnsureTablesButton />
        </section>

        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">End-to-end self-test</h2>
          <p className="mt-2 font-serif text-sm text-ink-soft">
            Runs the <em>exact</em> code path the registration / forgot-password / resend-
            verification routes run, against a throwaway test user this endpoint creates and cleans
            up. Use this when the templates above send fine but the real user-side flows do not —
            the first failing step is the answer.
          </p>
          <div className="mt-5">
            <EmailSelfTestPanel />
          </div>
        </section>

        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">Send a test email</h2>
          <p className="mt-2 font-serif text-sm text-ink-soft">
            Sends a one-off message through the live Resend account using the configured sender. If
            Resend rejects the request (unverified sender domain, bad API key, etc.), the exact
            error name and message will appear below — copy it into the Resend dashboard to fix.
            <br />
            Use the <strong>Full flow</strong> options to exercise the same database-then-send path
            the real welcome / reset / verify routes use against an existing account.
          </p>
          <div className="mt-5">
            <EmailDiagnosticForm
              configured={configured}
              fromAddress={appConfig.email.fromAddress}
            />
          </div>
        </section>
      </div>
    </AdminSection>
  );
}
