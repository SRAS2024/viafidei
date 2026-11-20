-- @idempotent-recoverable
--
-- The pray-along speed a member chose.
--
-- WHY: while a prayer is prayed aloud, a speed button beside Stop steps through 1x,
-- 1.25x and 1.5x. The browser remembers the last speed; a signed-in member's is also
-- kept here, so it is the same on every browser they sign in on. NULL is the normal
-- speed (1x).
--
-- Deploy safety: one nullable column with no default on "Profile" (no rewrite), added
-- only if missing so a retried deploy cannot fail; lock_timeout bounds the brief lock.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "audioRate" DOUBLE PRECISION;
