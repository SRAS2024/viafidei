"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function LitaniesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Litanies unavailable" />;
}
