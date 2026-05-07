import { redirect } from "next/navigation";
import { appConfig } from "@/lib/config";
import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth";
import { AdminSection } from "../_sections/AdminSection";
import { EmailDiagnosticForm } from "./EmailDiagnosticForm";

export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const env = getEnv();
  const apiKey = env.RESEND_API_KEY ?? "";
  const configured = apiKey.length > 0;
  const apiKeyPreview = configured ? `${apiKey.slice(0, 4)}…(${apiKey.length} chars)` : null;

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
              <dt className="text-ink-faint">RESEND_API_KEY</dt>
              <dd className={configured ? "font-medium text-ink" : "font-medium"}>
                {configured ? (
                  <span className="font-mono text-xs">{apiKeyPreview}</span>
                ) : (
                  <span style={{ color: "#8b1a1a" }}>not set</span>
                )}
              </dd>
            </div>
          </dl>
          {!configured ? (
            <p className="mt-5 rounded-sm border border-ink/15 bg-ink/5 p-4 font-serif text-sm text-ink-soft">
              The <code>RESEND_API_KEY</code> environment variable is not set on this deployment.
              Until it is, every welcome / password-reset / verification send is silently skipped —
              the user-visible flow still succeeds, but no email actually leaves the server. Set the
              variable in your hosting dashboard, redeploy, then come back here to send a test.
            </p>
          ) : null}
        </section>

        <section className="vf-card rounded-sm p-6">
          <h2 className="font-display text-2xl">Send a test email</h2>
          <p className="mt-2 font-serif text-sm text-ink-soft">
            Sends a one-off message through the live Resend account using the configured sender. If
            Resend rejects the request (unverified sender domain, bad API key, etc.), the exact
            error name and message will appear below — copy it into the Resend dashboard to fix.
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
