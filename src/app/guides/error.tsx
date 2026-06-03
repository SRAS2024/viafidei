"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function GuidesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Guides unavailable" />;
}
