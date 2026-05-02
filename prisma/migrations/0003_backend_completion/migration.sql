-- AlterEnum
ALTER TYPE "CategoryScope" ADD VALUE 'SPIRITUAL_LIFE';

-- CreateEnum
CREATE TYPE "LiturgyKind" AS ENUM ('MASS_STRUCTURE', 'LITURGICAL_YEAR', 'SYMBOLISM', 'MARRIAGE_RITE', 'FUNERAL_RITE', 'ORDINATION_RITE', 'COUNCIL_TIMELINE', 'GLOSSARY', 'GENERAL');

-- CreateEnum
CREATE TYPE "SpiritualLifeKind" AS ENUM ('ROSARY', 'CONFESSION', 'ADORATION', 'DEVOTION', 'CONSECRATION', 'VOCATION', 'GENERAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "templateSlug" TEXT;
ALTER TABLE "Goal" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Goal_userId_dueDate_idx" ON "Goal"("userId", "dueDate");

-- AlterTable
ALTER TABLE "IngestionSource" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "IngestionSource" ADD COLUMN "reliabilityScore" DOUBLE PRECISION;
ALTER TABLE "IngestionSource" ADD COLUMN "lastSuccessfulSync" TIMESTAMP(3);
ALTER TABLE "IngestionSource" ADD COLUMN "lastFailedSync" TIMESTAMP(3);
ALTER TABLE "IngestionSource" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "LiturgyEntry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "LiturgyKind" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "externalSourceKey" TEXT,
    "contentChecksum" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiturgyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiturgyEntry_slug_key" ON "LiturgyEntry"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LiturgyEntry_externalSourceKey_key" ON "LiturgyEntry"("externalSourceKey");

-- CreateIndex
CREATE INDEX "LiturgyEntry_status_idx" ON "LiturgyEntry"("status");

-- CreateIndex
CREATE INDEX "LiturgyEntry_kind_status_idx" ON "LiturgyEntry"("kind", "status");

-- CreateTable
CREATE TABLE "LiturgyEntryTranslation" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'MACHINE',
    "translationEngine" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiturgyEntryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiturgyEntryTranslation_entryId_locale_key" ON "LiturgyEntryTranslation"("entryId", "locale");

-- AddForeignKey
ALTER TABLE "LiturgyEntryTranslation" ADD CONSTRAINT "LiturgyEntryTranslation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LiturgyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SpiritualLifeGuide" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "SpiritualLifeKind" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bodyText" TEXT,
    "steps" JSONB,
    "durationDays" INTEGER,
    "goalTemplateSlug" TEXT,
    "externalSourceKey" TEXT,
    "contentChecksum" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritualLifeGuide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpiritualLifeGuide_slug_key" ON "SpiritualLifeGuide"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SpiritualLifeGuide_externalSourceKey_key" ON "SpiritualLifeGuide"("externalSourceKey");

-- CreateIndex
CREATE INDEX "SpiritualLifeGuide_status_idx" ON "SpiritualLifeGuide"("status");

-- CreateIndex
CREATE INDEX "SpiritualLifeGuide_kind_status_idx" ON "SpiritualLifeGuide"("kind", "status");

-- CreateTable
CREATE TABLE "SpiritualLifeGuideTranslation" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bodyText" TEXT,
    "steps" JSONB,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'MACHINE',
    "translationEngine" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritualLifeGuideTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpiritualLifeGuideTranslation_guideId_locale_key" ON "SpiritualLifeGuideTranslation"("guideId", "locale");

-- AddForeignKey
ALTER TABLE "SpiritualLifeGuideTranslation" ADD CONSTRAINT "SpiritualLifeGuideTranslation_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "SpiritualLifeGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "DailyLiturgy" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "season" TEXT,
    "rank" TEXT,
    "feastTitle" TEXT,
    "readingsJson" JSONB,
    "saintsJson" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLiturgy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLiturgy_date_key" ON "DailyLiturgy"("date");

-- CreateIndex
CREATE INDEX "DailyLiturgy_date_status_idx" ON "DailyLiturgy"("date", "status");
