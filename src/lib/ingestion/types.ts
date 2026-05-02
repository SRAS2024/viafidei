export type IngestedKind = "prayer" | "saint" | "apparition" | "parish" | "devotion";

export type IngestedPrayer = {
  kind: "prayer";
  slug: string;
  defaultTitle: string;
  category: string;
  body: string;
  externalSourceKey?: string;
  tagSlugs?: string[];
};

export type IngestedSaint = {
  kind: "saint";
  slug: string;
  canonicalName: string;
  feastDay?: string;
  patronages: string[];
  biography: string;
  officialPrayer?: string;
  externalSourceKey?: string;
  tagSlugs?: string[];
};

export type IngestedApparition = {
  kind: "apparition";
  slug: string;
  title: string;
  location?: string;
  country?: string;
  approvedStatus: string;
  summary: string;
  officialPrayer?: string;
  externalSourceKey?: string;
  tagSlugs?: string[];
};

export type IngestedParish = {
  kind: "parish";
  slug: string;
  name: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  diocese?: string;
  ociaUrl?: string;
  latitude?: number;
  longitude?: number;
  externalSourceKey?: string;
  tagSlugs?: string[];
};

export type IngestedDevotion = {
  kind: "devotion";
  slug: string;
  title: string;
  summary: string;
  practiceText?: string;
  durationMinutes?: number;
  externalSourceKey?: string;
  tagSlugs?: string[];
};

export type IngestedItem =
  | IngestedPrayer
  | IngestedSaint
  | IngestedApparition
  | IngestedParish
  | IngestedDevotion;

export type ConditionalState = {
  etag?: string | null;
  lastModified?: string | null;
};

export type AdapterContext = {
  sourceHost: string;
  jobName: string;
  /**
   * Optional cache state from a prior successful run, so adapters can issue
   * conditional requests (If-None-Match / If-Modified-Since) and short-circuit
   * when upstream returns 304 Not Modified.
   */
  conditionalState?: ConditionalState;
};

export type AdapterResult = {
  items: IngestedItem[];
  conditionalState?: ConditionalState;
  /** Upstream returned 304 Not Modified — runner should mark run as no-op. */
  notModified?: boolean;
};

export interface SourceAdapter {
  readonly key: string;
  readonly description: string;
  readonly entityKinds: readonly IngestedKind[];
  fetch(ctx: AdapterContext): Promise<AdapterResult>;
}

export type IngestionRunSummary = {
  recordsSeen: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  recordsReviewRequired: number;
  errorMessage?: string | null;
};
