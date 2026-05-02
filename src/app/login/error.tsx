"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function LoginError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Sign in unavailable" />;
}
