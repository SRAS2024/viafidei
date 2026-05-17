import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listBannedDevices } from "@/lib/security/security-event-store";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Read-only banned-devices admin page. By design there is NO unban
 * button or admin action of any kind that removes a row from the
 * BannedDevice table — bans are permanent. Re-instating a banned
 * device would require a direct database INSERT, which the admin
 * app does not expose.
 */
export default async function BannedDevicesPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const rows = await listBannedDevices(200).catch(() => []);
  return (
    <AdminSection
      titleKey="admin.bannedDevices.title"
      subtitle="Devices banned by signed ban links from Security Breach emails. There is no admin UI to unban — bans are permanent by design."
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-ink/10 bg-paper p-6">
        {rows.length === 0 ? (
          <p className="font-serif text-ink-soft" data-testid="banned-devices-empty">
            No banned devices.
          </p>
        ) : (
          <table
            className="w-full border-collapse font-serif text-sm"
            data-testid="banned-devices-table"
          >
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink-faint">
                <th className="py-2 pr-3">Device credential ID</th>
                <th className="py-2 pr-3">Ban reason</th>
                <th className="py-2 pr-3">First seen</th>
                <th className="py-2 pr-3">Last seen</th>
                <th className="py-2 pr-3">Security event</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-ink/5">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.deviceCredentialHash.slice(0, 12)}…
                  </td>
                  <td className="py-2 pr-3">{row.banReason}</td>
                  <td className="py-2 pr-3 text-ink-soft">{row.firstSeenAt.toISOString()}</td>
                  <td className="py-2 pr-3 text-ink-soft">{row.lastSeenAt.toISOString()}</td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.securityEventId ? row.securityEventId.slice(0, 12) + "…" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p
          className="mt-6 font-serif text-xs text-ink-faint"
          data-testid="banned-devices-permanent-notice"
        >
          Bans are permanent. There is no unban button. To re-enable access for a device the only
          path is a manual database operation by a systems-level administrator.
        </p>
      </div>
    </AdminSection>
  );
}
