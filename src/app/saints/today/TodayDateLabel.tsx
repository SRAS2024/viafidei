"use client";

import { useRouter } from "next/navigation";
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
  /** Month the list was read for (1-indexed) — shown until the client hydrates. */
  serverMonth: number;
  /** Day the list was read for — shown until the client hydrates. */
  serverDay: number;
  /** The URL names the date, so the list is that date's whatever today is. */
  dateFromUrl?: boolean;
};

/**
 * Renders the date under the page's title: always the date the list below is
 * for. On first render that is the month and day the server used (avoiding a
 * hydration mismatch). The effect then adds the year when that date is today on
 * the reader's device. A plain visit to the page reads the server's clock, whose
 * day can differ from the reader's by the evening, so it asks for the reader's
 * own day instead of labelling one day's saints with another's date.
 */
export function TodayDateLabel({ serverMonth, serverDay, dateFromUrl = false }: Props) {
  const router = useRouter();
  const [label, setLabel] = useState<string>(`${MONTH_NAMES[serverMonth - 1] ?? "—"} ${serverDay}`);

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    if (month === serverMonth && day === serverDay) {
      setLabel(`${MONTH_NAMES[month - 1]} ${day}, ${now.getFullYear()}`);
    } else if (!dateFromUrl) {
      router.replace(`/saints/today?month=${month}&day=${day}`);
    }
  }, [serverMonth, serverDay, dateFromUrl, router]);

  return <p className="vf-page-hero-lede">{label}</p>;
}
