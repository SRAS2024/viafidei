"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function SearchError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Search unavailable" />;
}
