"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function SaintsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Saints unavailable" />;
}
