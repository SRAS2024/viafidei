/**
 * Render-gate trigger helper. Public detail pages call
 * `notifyRenderGateFailure` when a slug page rejects a row for
 * failing render-readiness. The helper:
 *
 *   1. Logs the failure to the observability stream so the operator
 *      can see public render gates blocking real users.
 *   2. Enqueues a content_revalidate job scoped to that content type
 *      so the cleanup loop runs against the bad row within seconds.
 *
 * The page itself never deletes the row inline — that would block
 * the request while a DB write happens. The queue worker handles
 * deletion asynchronously on the next leased job.
 */

import { logger } from "../observability/logger";

export async function notifyRenderGateFailure(args: {
  contentType: string;
  slug: string;
  missingFields?: ReadonlyArray<string>;
  /**
   * When true, the helper enqueues a content_revalidate job. Tests
   * and certain admin previews skip this so they don't pollute the
   * queue.
   */
  enqueueCleanup?: boolean;
}): Promise<void> {
  logger.warn("public.render_gate.blocked", {
    contentType: args.contentType,
    slug: args.slug,
    missing: args.missingFields ?? [],
  });
  if (args.enqueueCleanup === false) return;
  try {
    const { autoEnqueueRenderGateCleanup } = await import("../ingestion/queue/auto-cleanup");
    await autoEnqueueRenderGateCleanup({
      contentType: args.contentType,
      slug: args.slug,
    });
  } catch (err) {
    // Never throw out of a public render handler — fall back to the
    // scheduled cleanup loop if the inline enqueue fails.
    logger.warn("public.render_gate.cleanup_enqueue_failed", {
      contentType: args.contentType,
      slug: args.slug,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
