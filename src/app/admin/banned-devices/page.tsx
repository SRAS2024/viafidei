import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listBannedDevicesWithDetail } from "@/lib/security/security-event-store";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Read-only banned-devices admin page. By design there is NO unban
 * button or admin action of any kind that removes a row from the
 * BannedDevice table — bans are permanent. Re-instating a banned
 * device would require a direct database INSERT, which the admin
 * app does not expose.
 *
 * The page enriches each row with city / region / country / user
 * agent from the originating SecurityEvent so the admin can read
 * the ban context without leaving the page.
 */
export default async function BannedDevicesPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const rows = await listBannedDevicesWithDetail(200).catch(() => []);

  function userAgentSummary(ua: string | null): string {
    if (!ua) return "—";
    return ua.length > 60 ? `${ua.slice(0, 60)}…` : ua;
  }

  return (
    <AdminSection
      titleKey="admin.bannedDevices.title"
      subtitle="Devices banned by signed ban links from Security Breach emails. There is no admin UI to unban — bans are permanent by design."
    >
      <div className="mx-auto max-w-6xl rounded-2xl border border-ink/10 bg-paper p-6">
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
                <th className="py-2 pr-3">City</th>
                <th className="py-2 pr-3">Region</th>
                <th className="py-2 pr-3">Country</th>
                <th className="py-2 pr-3">User agent</th>
                <th className="py-2 pr-3">Security event</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ink/5"
                  data-testid={`banned-device-row-${row.id}`}
                >
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.deviceCredentialHash.slice(0, 12)}…
                  </td>
                  <td className="py-2 pr-3">{row.banReason}</td>
                  <td className="py-2 pr-3 text-ink-soft">{row.firstSeenAt.toISOString()}</td>
                  <td className="py-2 pr-3 text-ink-soft">{row.lastSeenAt.toISOString()}</td>
                  <td className="py-2 pr-3 text-ink-soft" data-testid="banned-device-city">
                    {row.originatingCity ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-ink-soft" data-testid="banned-device-region">
                    {row.originatingRegion ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-ink-soft" data-testid="banned-device-country">
                    {row.originatingCountry ?? "—"}
                  </td>
                  <td
                    className="py-2 pr-3 text-ink-soft"
                    data-testid="banned-device-user-agent"
                    title={row.originatingUserAgent ?? undefined}
                  >
                    {userAgentSummary(row.originatingUserAgent)}
                  </td>
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
