"use client";

import { useEffect, useState } from "react";

import { subscribePendingNavigation } from "@/lib/navigation/pending-navigation";

/**
 * The one status that says a page is on its way when nothing else does (see
 * pending-navigation.ts for when that is). It is in the layout from the first byte,
 * empty, because VoiceOver announces a live region whose words change, and says
 * nothing of one that arrives already holding them. Its words come from the server,
 * in the reader's language.
 */
export function NavigationPendingStatus({ label }: { label: string }) {
  const [pending, setPending] = useState(false);
  useEffect(() => subscribePendingNavigation(setPending), []);
  return (
    <p role="status" className="sr-only" data-testid="navigation-pending">
      {pending ? label : ""}
    </p>
  );
}
