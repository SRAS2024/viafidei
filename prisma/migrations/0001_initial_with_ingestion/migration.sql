-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MilestoneTier" AS ENUM ('SACRAMENT', 'SPIRITUAL', 'PERSONAL');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'OVERDUE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'ICON', 'PAINTING', 'ILLUSTRATION', 'STATUE', 'BOOK_COVER', 'FAVICON', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'AUTO_APPROVED', 'HUMAN_REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('MACHINE', 'HUMAN_REVIEWED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('GENERAL', 'LITURGICAL', 'PATRONAGE', 'DEVOTIONAL', 'SEASONAL', 'THEOLOGICAL', 'REGION');

-- CreateEnum
CREATE TYPE "CategoryScope" AS ENUM ('PRAYER', 'SAINT', 'APPARITION', 'DEVOTION', 'PARISH', 'LITURGY');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "emailEncrypted" TEXT,
    "nameEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avatarMediaId" TEXT,
    "languageOverride" TEXT,
    "theme" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prayer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultTitle" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryId" TEXT,
    "contentChecksum" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerTranslation" (
    "id" TEXT NOT NULL,
    "prayerId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'MACHINE',
    "translationEngine" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrayerTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Saint" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "feastDay" TEXT,
    "patronages" TEXT[],
    "biography" TEXT NOT NULL,
    "officialPrayer" TEXT,
    "externalSourceKey" TEXT,
    "contentChecksum" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Saint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaintTranslation" (
    "id" TEXT NOT NULL,
    "saintId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "biography" TEXT NOT NULL,
    "officialPrayer" TEXT,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'MACHINE',
    "translationEngine" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaintTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarianApparition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "country" TEXT,
    "approvedStatus" TEXT,
    "summary" TEXT NOT NULL,
    "officialPrayer" TEXT,
    "externalSourceKey" TEXT,
    "contentChecksum" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarianApparition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarianApparitionTranslation" (
    "id" TEXT NOT NULL,
    "apparitionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "officialPrayer" TEXT,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'MACHINE',
    "translationEngine" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarianApparitionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parish" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "websiteUrl" TEXT,
    "diocese" TEXT,
    "ociaUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "externalSourceKey" TEXT,
    "sourceHost" TEXT,
    "contentChecksum" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalChecklistItem" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "tier" "MilestoneTier" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contentChecksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSavedPrayer" (
    "userId" TEXT NOT NULL,
    "prayerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSavedPrayer_pkey" PRIMARY KEY ("userId","prayerId")
);

-- CreateTable
CREATE TABLE "UserSavedSaint" (
    "userId" TEXT NOT NULL,
    "saintId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSavedSaint_pkey" PRIMARY KEY ("userId","saintId")
);

-- CreateTable
CREATE TABLE "UserSavedApparition" (
    "userId" TEXT NOT NULL,
    "apparitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSavedApparition_pkey" PRIMARY KEY ("userId","apparitionId")
);

-- CreateTable
CREATE TABLE "UserSavedParish" (
    "userId" TEXT NOT NULL,
    "parishId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSavedParish_pkey" PRIMARY KEY ("userId","parishId")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "kind" "MediaKind" NOT NULL DEFAULT 'OTHER',
    "sourceUrl" TEXT,
    "sourceHost" TEXT,
    "licenseInfo" TEXT,
    "attribution" TEXT,
    "checksum" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityMediaLink" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityMediaLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'homepage',
    "title" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitPerMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "schedule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJobRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsSeen" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityTag" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scope" "CategoryScope" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devotion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "practiceText" TEXT,
    "durationMinutes" INTEGER,
    "externalSourceKey" TEXT,
    "contentChecksum" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevotionTranslation" (
    "id" TEXT NOT NULL,
    "devotionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "practiceText" TEXT,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'MACHINE',
    "translationEngine" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevotionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSavedDevotion" (
    "userId" TEXT NOT NULL,
    "devotionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSavedDevotion_pkey" PRIMARY KEY ("userId","devotionId")
);

-- CreateTable
CREATE TABLE "ContentReview" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "reviewerUsername" TEXT,
    "decision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_updatedAt_idx" ON "JournalEntry"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prayer_slug_key" ON "Prayer"("slug");

-- CreateIndex
CREATE INDEX "Prayer_categoryId_idx" ON "Prayer"("categoryId");

-- CreateIndex
CREATE INDEX "Prayer_status_idx" ON "Prayer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerTranslation_prayerId_locale_key" ON "PrayerTranslation"("prayerId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "Saint_slug_key" ON "Saint"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Saint_externalSourceKey_key" ON "Saint"("externalSourceKey");

-- CreateIndex
CREATE INDEX "Saint_status_idx" ON "Saint"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SaintTranslation_saintId_locale_key" ON "SaintTranslation"("saintId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "MarianApparition_slug_key" ON "MarianApparition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MarianApparition_externalSourceKey_key" ON "MarianApparition"("externalSourceKey");

-- CreateIndex
CREATE INDEX "MarianApparition_status_idx" ON "MarianApparition"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarianApparitionTranslation_apparitionId_locale_key" ON "MarianApparitionTranslation"("apparitionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "Parish_slug_key" ON "Parish"("slug");

-- CreateIndex
CREATE INDEX "Parish_status_idx" ON "Parish"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Parish_name_city_country_key" ON "Parish"("name", "city", "country");

-- CreateIndex
CREATE INDEX "Goal_userId_status_idx" ON "Goal"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GoalChecklistItem_goalId_sortOrder_key" ON "GoalChecklistItem"("goalId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_goalId_key" ON "Milestone"("goalId");

-- CreateIndex
CREATE INDEX "Milestone_userId_tier_idx" ON "Milestone"("userId", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_userId_slug_key" ON "Milestone"("userId", "slug");

-- CreateIndex
CREATE INDEX "EntityMediaLink_entityType_entityId_idx" ON "EntityMediaLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityMediaLink_entityType_entityId_mediaAssetId_key" ON "EntityMediaLink"("entityType", "entityId", "mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "HomePage_slug_key" ON "HomePage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HomePageBlock_pageId_blockKey_key" ON "HomePageBlock"("pageId", "blockKey");

-- CreateIndex
CREATE UNIQUE INDEX "HomePageBlock_pageId_sortOrder_key" ON "HomePageBlock"("pageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionSource_host_key" ON "IngestionSource"("host");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionJob_sourceId_jobName_key" ON "IngestionJob"("sourceId", "jobName");

-- CreateIndex
CREATE INDEX "IngestionJobRun_jobId_startedAt_idx" ON "IngestionJobRun"("jobId", "startedAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_createdAt_idx" ON "AdminAuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_kind_idx" ON "Tag"("kind");

-- CreateIndex
CREATE INDEX "EntityTag_entityType_entityId_idx" ON "EntityTag"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EntityTag_tagId_idx" ON "EntityTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityTag_entityType_entityId_tagId_key" ON "EntityTag"("entityType", "entityId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_scope_sortOrder_idx" ON "Category"("scope", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Devotion_slug_key" ON "Devotion"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Devotion_externalSourceKey_key" ON "Devotion"("externalSourceKey");

-- CreateIndex
CREATE INDEX "Devotion_status_idx" ON "Devotion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DevotionTranslation_devotionId_locale_key" ON "DevotionTranslation"("devotionId", "locale");

-- CreateIndex
CREATE INDEX "ContentReview_entityType_entityId_createdAt_idx" ON "ContentReview"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReview_decision_createdAt_idx" ON "ContentReview"("decision", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prayer" ADD CONSTRAINT "Prayer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerTranslation" ADD CONSTRAINT "PrayerTranslation_prayerId_fkey" FOREIGN KEY ("prayerId") REFERENCES "Prayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaintTranslation" ADD CONSTRAINT "SaintTranslation_saintId_fkey" FOREIGN KEY ("saintId") REFERENCES "Saint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarianApparitionTranslation" ADD CONSTRAINT "MarianApparitionTranslation_apparitionId_fkey" FOREIGN KEY ("apparitionId") REFERENCES "MarianApparition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalChecklistItem" ADD CONSTRAINT "GoalChecklistItem_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedPrayer" ADD CONSTRAINT "UserSavedPrayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedPrayer" ADD CONSTRAINT "UserSavedPrayer_prayerId_fkey" FOREIGN KEY ("prayerId") REFERENCES "Prayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedSaint" ADD CONSTRAINT "UserSavedSaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedSaint" ADD CONSTRAINT "UserSavedSaint_saintId_fkey" FOREIGN KEY ("saintId") REFERENCES "Saint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedApparition" ADD CONSTRAINT "UserSavedApparition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedApparition" ADD CONSTRAINT "UserSavedApparition_apparitionId_fkey" FOREIGN KEY ("apparitionId") REFERENCES "MarianApparition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedParish" ADD CONSTRAINT "UserSavedParish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedParish" ADD CONSTRAINT "UserSavedParish_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMediaLink" ADD CONSTRAINT "EntityMediaLink_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageBlock" ADD CONSTRAINT "HomePageBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "HomePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IngestionSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJobRun" ADD CONSTRAINT "IngestionJobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionTranslation" ADD CONSTRAINT "DevotionTranslation_devotionId_fkey" FOREIGN KEY ("devotionId") REFERENCES "Devotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedDevotion" ADD CONSTRAINT "UserSavedDevotion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedDevotion" ADD CONSTRAINT "UserSavedDevotion_devotionId_fkey" FOREIGN KEY ("devotionId") REFERENCES "Devotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

