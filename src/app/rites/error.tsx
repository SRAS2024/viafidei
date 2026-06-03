"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function RitesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Rites unavailable" />;
}
