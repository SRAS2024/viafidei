-- @idempotent-recoverable
--
-- A credential version on each account, so that a password reset really ends the
-- account's other sign-ins.
--
-- WHY: readers sign in with a sealed cookie, not a Session row, so the reset's deleting
-- Session rows ended nothing: a browser signed in before the reset, perhaps the very
-- person the reader was locking out, stayed signed in. A reset now writes a new value
-- here, each sign-in copies the account's value into its cookie, and requireUser refuses
-- a cookie whose value differs.
--
-- Deploy safety: one nullable column with no default, so no table rewrite, and
-- lock_timeout bounds the wait for its brief lock. NULL means "accept any cookie": every
-- existing row starts NULL, so nobody is signed out by this deploy, and an account only
-- takes a value at its next reset. Safe to run again.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credentialVersion" TEXT;
