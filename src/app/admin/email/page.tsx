import { permanentRedirect } from "next/navigation";

/**
 * Email diagnostics were renamed to the broader Diagnostics hub under
 * /admin/diagnostics/email. Any bookmark or inbound link to /admin/email
 * lands here and is forwarded — `permanentRedirect` returns 308 so
 * search engines and clients update the cached URL.
 */
export default function AdminEmailLegacyRedirect() {
  permanentRedirect("/admin/diagnostics/email");
}
