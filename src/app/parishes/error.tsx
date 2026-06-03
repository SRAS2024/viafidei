"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function ParishesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Parishes unavailable" />;
}
