"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function ProfileError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Profile unavailable" />;
}
