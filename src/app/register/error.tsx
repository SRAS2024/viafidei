"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function RegisterError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Registration unavailable" />;
}
