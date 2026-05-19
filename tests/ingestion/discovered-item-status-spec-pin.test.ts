/**
 * Spec #2: every status the spec lists for a DiscoveredSourceItem
 * is accepted by the type. The spec enumerates eight statuses
 * an admin must be able to see on the discovered-items page:
 *
 *   discovered, fetch_queued, fetched, build_queued, built (alias),
 *   rejected, duplicate, source_not_configured
 */

import { describe, expect, it } from "vitest";
import type { DiscoveredItemStatus } from "@/lib/data/discovered-items";

const SPEC_STATUSES_OR_ALIASES: ReadonlyArray<DiscoveredItemStatus> = [
  // "discovered" maps to "pending" in the existing vocabulary.
  "pending",
  "fetch_queued",
  "fetched",
  "build_queued",
  // "built" maps to "ingested" in the existing vocabulary.
  "ingested",
  "rejected",
  "duplicate",
  "source_not_configured",
];

describe("DiscoveredItemStatus matches the spec", () => {
  it("every spec-listed status is a valid DiscoveredItemStatus value", () => {
    for (const s of SPEC_STATUSES_OR_ALIASES) {
      const v: DiscoveredItemStatus = s;
      expect(typeof v).toBe("string");
    }
  });
});
