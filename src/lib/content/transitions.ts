import type { ContentStatus } from "@prisma/client";

const PUBLISHABLE_FROM: ReadonlySet<ContentStatus> = new Set(["DRAFT", "REVIEW"]);
const REJECTABLE_FROM: ReadonlySet<ContentStatus> = new Set(["DRAFT", "REVIEW", "PUBLISHED"]);
const REVISION_FROM: ReadonlySet<ContentStatus> = new Set(["DRAFT", "REVIEW"]);

export function canPublish(from: ContentStatus): boolean {
  return PUBLISHABLE_FROM.has(from);
}

export function canReject(from: ContentStatus): boolean {
  return REJECTABLE_FROM.has(from);
}

export function canRequestRevision(from: ContentStatus): boolean {
  return REVISION_FROM.has(from);
}
