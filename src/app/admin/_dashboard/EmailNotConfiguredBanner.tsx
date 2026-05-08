import Link from "next/link";
import { readResendApiKey } from "@/lib/email/resend";

/**
 * Prominent red banner shown on /admin when transactional email is not
 * configured. Without a Resend API key every welcome / password-reset /
 * verification send is silently skipped — surfacing this at the top of
 * the admin dashboard is the most reliable way to alert the operator.
 *
 * Resolves the API key through the same helper the runtime sender uses
 * (`readResendApiKey`), which accepts either `RESEND_API_KEY` or
 * `RESEND`. The two MUST agree, otherwise the banner state would lie
 * about what the actual send pipeline sees.
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
        No Resend API key is set on this deployment (the app reads either{" "}
        <code>RESEND_API_KEY</code> or <code>RESEND</code>), so welcome, password-reset, and
        email-verification messages are silently skipped — accounts can be created but no email
        reaches the recipient. Set the variable in your hosting dashboard, redeploy, then{" "}
        <Link href="/admin/email" className="underline">
          run a test send
        </Link>{" "}
        to confirm.
      </p>
    </div>
  );
}
