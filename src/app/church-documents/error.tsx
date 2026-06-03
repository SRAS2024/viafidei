"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function ChurchDocumentsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Church documents unavailable" />;
}
