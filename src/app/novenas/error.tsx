"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function NovenasError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Novenas unavailable" />;
}
