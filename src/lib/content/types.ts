import type { ContentStatus, ReviewDecision } from "@prisma/client";

export type ReviewableEntityType = "Prayer" | "Saint" | "MarianApparition" | "Parish" | "Devotion";

export type ReviewActor = {
  userId?: string | null;
  username?: string | null;
};

export type ReviewableSummary = {
  id: string;
  entityType: ReviewableEntityType;
  slug: string;
  title: string;
  status: ContentStatus;
  updatedAt: Date;
};

export type ReviewActionResult = {
  ok: true;
  status: ContentStatus;
  decision: ReviewDecision;
};

export type ReviewActionFailure = {
  ok: false;
  reason: string;
};

export type ReviewActionOutcome = ReviewActionResult | ReviewActionFailure;
