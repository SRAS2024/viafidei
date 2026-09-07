"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Today" self-correction.
 *
 * The server renders the UTC civil date when the visitor arrives without a
 * ?date (Railway runs in UTC), so a visitor in the Americas on a Saturday
 * evening would otherwise be shown Sunday's Mass. Once mounted we know the
 * device's own calendar date; if it differs from what was rendered we replace
 * the URL with it, which re-renders the correct day and leaves a shareable,
 * unambiguous link behind.
 *
 * Only active when the visitor asked for "today" (no ?date) — an explicit date
 * from the calendar or a shared link is never rewritten.
 */
export function TodayDateSync({
  renderedDate,
  enabled,
}: {
  renderedDate: string;
  enabled: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    if (local !== renderedDate) router.replace(`/liturgy/readings?date=${local}`);
  }, [enabled, renderedDate, router]);
  return null;
}
