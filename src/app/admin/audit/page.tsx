import { permanentRedirect } from "next/navigation";

/**
 * The standalone audit page moved under the new Logs hub at
 * /admin/logs. The most-similar destination for inbound bookmarks is
 * the Account audit log; from there an admin can jump to Admin
 * actions or Data Management via the in-page nav.
 */
export default function AdminAuditLegacyRedirect() {
  permanentRedirect("/admin/logs/accounts");
}
