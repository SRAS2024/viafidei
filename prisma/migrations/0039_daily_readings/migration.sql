-- Daily liturgical readings stored as internal app content. One row per
-- (date, calendar, locale). Bodies are only filled from a trusted source;
-- uncertain days stay in REVIEW until a human verifies.

-- CreateTable
CREATE TABLE "DailyReading" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "calendar" TEXT NOT NULL DEFAULT 'roman-ordinary',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "seasonLabel" TEXT,
    "sundayCycle" TEXT,
    "weekdayCycle" TEXT,
    "color" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "sourceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REVIEW',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReading_date_calendar_locale_key" ON "DailyReading"("date", "calendar", "locale");

-- CreateIndex
CREATE INDEX "DailyReading_status_idx" ON "DailyReading"("status");

-- CreateIndex
CREATE INDEX "DailyReading_date_idx" ON "DailyReading"("date");
