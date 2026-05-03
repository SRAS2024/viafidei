// Reusable test data builders. Each factory accepts a `Partial<T>` overlay so
// individual tests can pin only the fields they actually care about.
//
// These builders return plain objects shaped like Prisma rows (with
// reasonable cuid-like ids and Date defaults). They are intentionally
// runtime-only — no Prisma client involvement — so they work in unit
// tests with the prismaMock and in integration tests as `data` payloads
// to `prisma.<model>.create`.

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function now(): Date {
  return new Date();
}

export type UserFixture = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: "USER" | "ADMIN";
  emailEncrypted: string | null;
  nameEncrypted: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function makeUser(overrides: Partial<UserFixture> = {}): UserFixture {
  return {
    id: id("user"),
    email: `user-${counter}@example.com`,
    // Looks like an argon2 hash; tests that need a real verifying hash
    // should call hashPassword and override this field.
    passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$placeholder$placeholder",
    firstName: "Test",
    lastName: "User",
    role: "USER",
    emailEncrypted: null,
    nameEncrypted: null,
    emailVerifiedAt: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function makeAdmin(overrides: Partial<UserFixture> = {}): UserFixture {
  return makeUser({ role: "ADMIN", email: `admin-${counter + 1}@example.com`, ...overrides });
}

export type PrayerFixture = {
  id: string;
  slug: string;
  defaultTitle: string;
  body: string;
  category: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  externalSourceKey: string | null;
  sourceHost: string | null;
  contentChecksum: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function makePrayer(overrides: Partial<PrayerFixture> = {}): PrayerFixture {
  const n = counter + 1;
  return {
    id: id("prayer"),
    slug: `prayer-${n}`,
    defaultTitle: `Prayer ${n}`,
    body: "Lorem ipsum prayer body text.",
    category: "general",
    status: "PUBLISHED",
    externalSourceKey: null,
    sourceHost: null,
    contentChecksum: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type SaintFixture = {
  id: string;
  slug: string;
  canonicalName: string;
  feastDay: string | null;
  patronages: string[];
  biography: string;
  officialPrayer: string | null;
  externalSourceKey: string | null;
  contentChecksum: string | null;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

export function makeSaint(overrides: Partial<SaintFixture> = {}): SaintFixture {
  const n = counter + 1;
  return {
    id: id("saint"),
    slug: `saint-${n}`,
    canonicalName: `Saint ${n}`,
    feastDay: null,
    patronages: [],
    biography: "Biographical detail about the saint.",
    officialPrayer: null,
    externalSourceKey: null,
    contentChecksum: null,
    status: "PUBLISHED",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type ApparitionFixture = {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  country: string | null;
  approvedStatus: string | null;
  summary: string;
  officialPrayer: string | null;
  externalSourceKey: string | null;
  contentChecksum: string | null;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

export function makeApparition(overrides: Partial<ApparitionFixture> = {}): ApparitionFixture {
  const n = counter + 1;
  return {
    id: id("apparition"),
    slug: `apparition-${n}`,
    title: `Apparition ${n}`,
    location: null,
    country: null,
    approvedStatus: null,
    summary: "Apparition summary text.",
    officialPrayer: null,
    externalSourceKey: null,
    contentChecksum: null,
    status: "PUBLISHED",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type ParishFixture = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  diocese: string | null;
  ociaUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  externalSourceKey: string | null;
  sourceHost: string | null;
  contentChecksum: string | null;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

export function makeParish(overrides: Partial<ParishFixture> = {}): ParishFixture {
  const n = counter + 1;
  return {
    id: id("parish"),
    slug: `parish-${n}`,
    name: `St. Test Parish ${n}`,
    address: null,
    city: null,
    region: null,
    country: null,
    phone: null,
    email: null,
    websiteUrl: null,
    diocese: null,
    ociaUrl: null,
    latitude: null,
    longitude: null,
    externalSourceKey: null,
    sourceHost: null,
    contentChecksum: null,
    status: "PUBLISHED",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type DevotionFixture = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  practiceText: string | null;
  durationMinutes: number | null;
  externalSourceKey: string | null;
  contentChecksum: string | null;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

export function makeDevotion(overrides: Partial<DevotionFixture> = {}): DevotionFixture {
  const n = counter + 1;
  return {
    id: id("devotion"),
    slug: `devotion-${n}`,
    title: `Devotion ${n}`,
    summary: "Devotion summary.",
    practiceText: null,
    durationMinutes: null,
    externalSourceKey: null,
    contentChecksum: null,
    status: "PUBLISHED",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type GoalFixture = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  templateSlug: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  status: "ACTIVE" | "COMPLETED" | "OVERDUE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

export function makeGoal(overrides: Partial<GoalFixture> = {}): GoalFixture {
  const n = counter + 1;
  return {
    id: id("goal"),
    userId: id("user"),
    title: `Goal ${n}`,
    description: null,
    templateSlug: null,
    dueDate: null,
    completedAt: null,
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type MilestoneFixture = {
  id: string;
  userId: string;
  goalId: string | null;
  tier: "SACRAMENT" | "SPIRITUAL" | "PERSONAL";
  slug: string;
  title: string;
  description: string | null;
  contentChecksum: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function makeMilestone(overrides: Partial<MilestoneFixture> = {}): MilestoneFixture {
  const n = counter + 1;
  return {
    id: id("milestone"),
    userId: id("user"),
    goalId: null,
    tier: "PERSONAL",
    slug: `milestone-${n}`,
    title: `Milestone ${n}`,
    description: null,
    contentChecksum: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type JournalFixture = {
  id: string;
  userId: string;
  title: string;
  body: string;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function makeJournal(overrides: Partial<JournalFixture> = {}): JournalFixture {
  const n = counter + 1;
  return {
    id: id("journal"),
    userId: id("user"),
    title: `Journal Entry ${n}`,
    body: "A short journal reflection.",
    isFavorite: false,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type MediaAssetFixture = {
  id: string;
  url: string;
  altText: string | null;
  kind:
    | "PHOTO"
    | "ICON"
    | "PAINTING"
    | "ILLUSTRATION"
    | "STATUE"
    | "BOOK_COVER"
    | "FAVICON"
    | "OTHER";
  sourceUrl: string | null;
  sourceHost: string | null;
  licenseInfo: string | null;
  attribution: string | null;
  checksum: string | null;
  reviewStatus: "PENDING" | "AUTO_APPROVED" | "HUMAN_REVIEWED" | "REJECTED";
  confidenceScore: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export function makeMediaAsset(overrides: Partial<MediaAssetFixture> = {}): MediaAssetFixture {
  const n = counter + 1;
  return {
    id: id("media"),
    url: `https://cdn.example.test/img-${n}.jpg`,
    altText: null,
    kind: "PHOTO",
    sourceUrl: null,
    sourceHost: null,
    licenseInfo: null,
    attribution: null,
    checksum: null,
    reviewStatus: "PENDING",
    confidenceScore: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export type IngestionSourceFixture = {
  id: string;
  name: string;
  host: string;
  baseUrl: string;
  sourceType: string;
  isOfficial: boolean;
  isActive: boolean;
  rateLimitPerMin: number | null;
  reliabilityScore: number | null;
  lastSuccessfulSync: Date | null;
  lastFailedSync: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function makeIngestionSource(
  overrides: Partial<IngestionSourceFixture> = {},
): IngestionSourceFixture {
  const n = counter + 1;
  return {
    id: id("source"),
    name: `Test Source ${n}`,
    host: `source-${n}.example.test`,
    baseUrl: `https://source-${n}.example.test/`,
    sourceType: "WEB",
    isOfficial: false,
    isActive: true,
    rateLimitPerMin: null,
    reliabilityScore: null,
    lastSuccessfulSync: null,
    lastFailedSync: null,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export const factories = {
  user: makeUser,
  admin: makeAdmin,
  prayer: makePrayer,
  saint: makeSaint,
  apparition: makeApparition,
  parish: makeParish,
  devotion: makeDevotion,
  goal: makeGoal,
  milestone: makeMilestone,
  journal: makeJournal,
  media: makeMediaAsset,
  ingestionSource: makeIngestionSource,
} as const;
