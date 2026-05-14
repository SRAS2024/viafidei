"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialAutoCleanupEnabled: boolean;
  initialHardDeleteAfterDays: number;
};

/**
 * Admin-facing toggle for the Ingestion & Data Management cleanup pass.
 *
 *   • `autoCleanupEnabled` — master switch. When off, the cron job
 *     skips the catalog-wide archive sweep AND the hard-delete pass
 *     so the admin can take manual control of curation. The per-row
 *     ingestion validator continues to run, so off-allowlist sources
 *     and structurally-invalid items are still rejected at the door.
 *   • `hardDeleteAfterDays` — how long a row may sit in ARCHIVED
 *     before the system permanently removes it. Default 30. Set to
 *     0 to disable hard deletes entirely.
 */
export function DataManagementSettings({
  initialAutoCleanupEnabled,
  initialHardDeleteAfterDays,
}: Props) {
  const router = useRouter();
  const [autoEnabled, setAutoEnabled] = useState(initialAutoCleanupEnabled);
  const [days, setDays] = useState(initialHardDeleteAfterDays);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save(next: { autoCleanupEnabled: boolean; hardDeleteAfterDays: number }) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/data-management", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        setError("Could not save Data Management settings.");
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    });
  }

  return (
    <section className="mb-8 vf-card rounded-sm p-5 sm:p-6">
      <h2 className="font-display text-2xl">Data Management</h2>
      <p className="mt-1 font-serif text-sm text-ink-soft">
        Automatic content curation: the cron job archives miscategorised rows and permanently
        deletes long-archived rows. Turn it off if you want to take manual control of the catalog.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-wrap items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-liturgical-gold"
            checked={autoEnabled}
            onChange={(e) => {
              const next = e.target.checked;
              setAutoEnabled(next);
              save({ autoCleanupEnabled: next, hardDeleteAfterDays: days });
            }}
            disabled={pending}
          />
          <span className="font-serif text-ink">Automatic cleanup enabled</span>
          {autoEnabled ? (
            <span className="vf-eyebrow text-emerald-700">On</span>
          ) : (
            <span className="vf-eyebrow text-ink-faint">Off — manual control</span>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="font-serif text-sm text-ink-soft" htmlFor="hard-delete-days">
            Hard-delete archived content after
          </label>
          <input
            id="hard-delete-days"
            type="number"
            min={0}
            max={3650}
            className="vf-input w-24 py-1 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 0)}
            onBlur={() => save({ autoCleanupEnabled: autoEnabled, hardDeleteAfterDays: days })}
            disabled={pending || !autoEnabled}
          />
          <span className="font-serif text-sm text-ink-soft">days (0 disables)</span>
        </div>

        {error ? (
          <p className="font-serif text-sm text-liturgical-red">{error}</p>
        ) : savedAt ? (
          <p className="font-serif text-xs text-ink-faint">Saved {savedAt.toLocaleTimeString()}.</p>
        ) : null}
      </div>
    </section>
  );
}
