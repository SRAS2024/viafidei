/**
 * Spec §1: the pre-Admin-Worker build/publish engine is hard-disabled.
 * The only active content path is the Admin Worker artifact pipeline
 * (brain → dispatcher → … → runPublishOrchestrator). The legacy admin
 * API routes that triggered the old engine now return 410 Gone.
 */

import { NextResponse } from "next/server";

export const LEGACY_PATH_DISABLED =
  "This legacy build/publish path is disabled. The Admin Worker artifact " +
  "pipeline is the only system that creates public content. Use the Admin " +
  "Worker command center at /admin/admin-worker.";

export function legacyDisabledResponse(): NextResponse {
  return NextResponse.json(
    { error: "legacy_path_disabled", message: LEGACY_PATH_DISABLED },
    { status: 410 },
  );
}
