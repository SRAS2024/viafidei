"use client";

import { useEffect, useState } from "react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Props = {
  /** Month rendered server-side (1-indexed) — used until the client hydrates. */
  serverMonth: number;
  /** Day rendered server-side — used until the client hydrates. */
  serverDay: number;
};

/**
 * Renders the date label above the feast-day list. The label uses the
 * user's local device timezone so the page reads correctly regardless
 * of where the user is. On first render the server's UTC month/day are
 * shown (avoiding a hydration mismatch) and the effect then upgrades
 * to the local date if it differs.
 */
export function TodayDateLabel({ serverMonth, serverDay }: Props) {
  const [label, setLabel] = useState<string>(`${MONTH_NAMES[serverMonth - 1] ?? "—"} ${serverDay}`);

  useEffect(() => {
    const now = new Date();
    setLabel(`${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`);
  }, []);

  return (
    <p className="mb-8 text-center font-display text-lg text-ink-faint" suppressHydrationWarning>
      {label}
    </p>
  );
}
