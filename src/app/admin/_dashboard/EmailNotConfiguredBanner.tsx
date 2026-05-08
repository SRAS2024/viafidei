import Link from "next/link";

/**
 * Prominent red banner shown on /admin when transactional email is not
 * configured. Without RESEND_API_KEY every welcome / password-reset /
 * verification send is silently skipped — surfacing this at the top of
 * the admin dashboard is the most reliable way to alert the operator.
 *
 * Reads `process.env.RESEND_API_KEY` directly to match the runtime sender
 * in `src/lib/email/resend.ts`; the two MUST agree, otherwise the banner
 * state would lie about what the actual send pipeline sees.
 */
export function EmailNotConfiguredBanner() {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  if (apiKey.length > 0) return null;

  return (
    <div
      role="alert"
      className="mx-auto mb-8 max-w-3xl rounded-sm border p-4 font-serif text-sm"
      style={{ borderColor: "#8b1a1a", color: "#8b1a1a", backgroundColor: "#fdf6f6" }}
    >
      <p className="font-bold">Transactional email is disabled</p>
      <p className="mt-1">
        <code>RESEND_API_KEY</code> is not set on this deployment, so welcome, password-reset, and
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
