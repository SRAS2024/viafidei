import Link from "next/link";
import { loadIngestionLiveSnapshot } from "@/lib/diagnostics";

/**
 * Compact banner shown on /admin that surfaces the current ingestion
 * status — active, disabled, blocked, stale, failing, or maintenance
 * mode — so the admin sees a real signal the moment they open the
 * dashboard. Falls back to a minimal "idle" line if the snapshot
 * cannot be loaded (e.g. a brand-new database).
 *
 * The banner never blocks page render: any failure inside
 * `loadIngestionLiveSnapshot` is swallowed so the dashboard stays
 * usable.
 */
export async function IngestionStatusBanner() {
  let snapshot: Awaited<ReturnType<typeof loadIngestionLiveSnapshot>> | null = null;
  try {
    snapshot = await loadIngestionLiveSnapshot();
  } catch {
    return null;
  }

  const { status, detail } = snapshot;
  const cfg = (() => {
    switch (status) {
      case "running":
      case "active":
      case "maintenance":
        return {
          color: "#185c2a",
          bg: "#f0f7f1",
          label: status === "maintenance" ? "Maintenance" : "Active",
        };
      case "stale":
      case "disabled":
        return {
          color: "#9b6b00",
          bg: "#fdf7e6",
          label: status === "stale" ? "Stale" : "Disabled",
        };
      case "blocked":
      case "failing":
        return {
          color: "#8b1a1a",
          bg: "#fdf6f6",
          label: status === "blocked" ? "Blocked" : "Failing",
        };
      default:
        return { color: "#3b3f4a", bg: "#f4f3f0", label: "Idle" };
    }
  })();

  return (
    <div
      role="status"
      className="mx-auto mb-4 max-w-3xl rounded-sm border p-3 font-serif text-sm"
      style={{ borderColor: cfg.color, backgroundColor: cfg.bg, color: cfg.color }}
      data-status={status}
    >
      <p>
        <span className="font-bold">Ingestion · {cfg.label}.</span> {detail}{" "}
        <Link href="/admin/diagnostics/ingestion" className="underline">
          View diagnostics
        </Link>
        {" · "}
        <Link href="/admin/ingestion" className="underline">
          Run now / settings
        </Link>
      </p>
    </div>
  );
}
