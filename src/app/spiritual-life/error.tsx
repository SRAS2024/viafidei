"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function SpiritualLifeError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Spiritual life unavailable" />;
}
