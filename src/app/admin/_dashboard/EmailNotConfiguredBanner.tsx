import Link from "next/link";
import { readResendApiKey } from "@/lib/email/resend";

/**
 * Prominent red banner shown on /admin when transactional email is not
 * configured. Without a Resend API key every welcome / password-reset /
 * verification send is skipped at the transport layer and the calling
 * routes return `email_not_configured` — surfacing this at the top of
 * the admin dashboard is the most reliable way to alert the operator
 * before they discover it through a user complaint.
 *
 * Resolves the API key through the same helper the runtime sender uses
 * (`readResendApiKey`), which reads `RESEND_API_KEY` from process.env.
 * Diagnostic and live sender MUST agree, otherwise the banner state
 * would lie about what the actual send pipeline sees.
 */
export function EmailNotConfiguredBanner() {
  if (readResendApiKey() !== null) return null;

  return (
    <div
      role="alert"
      className="mx-auto mb-8 max-w-3xl rounded-sm border p-4 font-serif text-sm"
      style={{ borderColor: "#8b1a1a", color: "#8b1a1a", backgroundColor: "#fdf6f6" }}
    >
      <p className="font-bold">Transactional email is disabled</p>
      <p className="mt-1">
        <code>RESEND_API_KEY</code> is not set on this deployment, so welcome, password-reset, and
        email-verification messages are skipped — the user-visible flow surfaces{" "}
        <code>email_not_configured</code> so the user knows delivery did not happen. Set{" "}
        <code>RESEND_API_KEY</code> in your hosting dashboard, redeploy, then{" "}
        <Link href="/admin/email" className="underline">
          run a test send
        </Link>{" "}
        to confirm.
      </p>
    </div>
  );
}
