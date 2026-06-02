"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function LiturgicalCalendarError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Liturgical calendar unavailable" />;
}
