"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function LiturgyError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Liturgy unavailable" />;
}
