"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function DoctorsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Doctors of the Church unavailable" />;
}
