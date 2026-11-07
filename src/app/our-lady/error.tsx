"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function OurLadyError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Our Lady unavailable" />;
}
