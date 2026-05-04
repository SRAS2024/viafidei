-- Add language preference to User table.
-- Saved during account creation and synchronized when a signed-in user
-- changes their language in profile settings. Used as the canonical
-- locale for transactional emails.
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
