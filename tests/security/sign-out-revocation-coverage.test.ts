/**
 * Sign-out must invalidate SERVER-side state (security spec item 12).
 *
 * Destroying the cookie is not sign-out. The encrypted cookie is a bearer
 * token: any copy taken before the user clicked "Sign out" — a proxy log, a
 * shared machine, an extension — keeps authorising until the `AdminSession`
 * row expires on its own, which is up to thirty idle minutes. Only revoking
 * the row ends the session, and the revoke has to happen BEFORE the cookie is
 * cleared, because a failed cookie write must not leave a live row behind.
 *
 * tests/security/admin-session-logout.test.ts proves that ONE handler
 * (/api/auth/logout) does this. This file is the coverage check: it finds
 * every sign-out entry point in the app and asserts each one either revokes,
 * or is on an explicit, shrinking list of known debt.
 *
 * The debt check is ONE-DIRECTIONAL on purpose, exactly like
 * KNOWN_UNGATED_ROUTES in tests/security/admin-gate-coverage.test.ts: adding a
 * new sign-out path that only clears the cookie fails CI immediately, while
 * fixing one of the listed handlers keeps the suite green (and the entry
 * should then be deleted from the list).
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC = join(REPO_ROOT, "src");

const REVOKE_CALL = /\brevokeCurrentAdminSession\s*\(/;
const DESTROY_CALL = /\bsession\.destroy\s*\(\s*\)/;

/**
 * Sign-out handlers that still only clear the cookie.
 *
 * KNOWN DEBT — this list may only ever shrink. Each entry leaves an admin
 * session live server-side after the administrator signs out; the fix is one
 * `await revokeCurrentAdminSession("logout");` immediately before
 * `session.destroy()`.
 *
 * The list is now EMPTY. Integration applied the sec-session hand-off to the
 * two remaining handlers: /api/admin/logout (what the admin console's Sign
 * Out button posts to) and both sign-out Server Actions in
 * src/app/_actions/auth.ts. Every sign-out path in the app now revokes.
 */
const KNOWN_COOKIE_ONLY_SIGN_OUTS: readonly string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

type SignOut = { file: string; source: string; revokes: boolean };

/** Every file in the app that ends a session by destroying the cookie. */
const signOuts: SignOut[] = walk(SRC)
  .map((file) => ({ file, source: readFileSync(file, "utf8") }))
  .filter(({ source }) => DESTROY_CALL.test(source))
  .map(({ file, source }) => ({
    file: relative(REPO_ROOT, file),
    source,
    revokes: REVOKE_CALL.test(source),
  }));

describe("the sign-out scan itself works", () => {
  it("finds the sign-out handlers (guards against an empty scan)", () => {
    expect(signOuts.length).toBeGreaterThanOrEqual(3);
    expect(signOuts.map((s) => s.file)).toContain("src/app/api/auth/logout/route.ts");
  });

  it("would notice a handler that stopped revoking", () => {
    // Negative control: the detector is a real check, not a tautology.
    expect(REVOKE_CALL.test("session.destroy();")).toBe(false);
    expect(REVOKE_CALL.test('await revokeCurrentAdminSession("logout");')).toBe(true);
  });
});

describe("every sign-out entry point invalidates server-side state", () => {
  it("the user sign-out route revokes the admin session row", () => {
    const route = signOuts.find((s) => s.file === "src/app/api/auth/logout/route.ts");
    expect(route?.revokes).toBe(true);
  });

  it("no NEW cookie-only sign-out has been introduced", () => {
    const cookieOnly = signOuts.filter((s) => !s.revokes).map((s) => s.file);
    const unexpected = cookieOnly.filter((f) => !KNOWN_COOKIE_ONLY_SIGN_OUTS.includes(f));
    expect(unexpected).toEqual([]);
  });

  it("the known-debt list names only handlers that really are still cookie-only", () => {
    // Keeps the list honest in the other direction: a stale entry would hide
    // a regression if that file later stopped revoking again.
    const cookieOnly = new Set(signOuts.filter((s) => !s.revokes).map((s) => s.file));
    for (const entry of KNOWN_COOKIE_ONLY_SIGN_OUTS) {
      const known = signOuts.find((s) => s.file === entry);
      // Either the file is gone / renamed, or it is genuinely still cookie-only.
      if (known) expect(cookieOnly.has(entry)).toBe(true);
    }
  });

  it("every handler that DOES revoke does so before clearing the cookie", () => {
    // Order is the property: revoking after destroy() would leave the row
    // live whenever the cookie write throws.
    for (const s of signOuts.filter((x) => x.revokes)) {
      const revokeAt = s.source.search(REVOKE_CALL);
      const destroyAt = s.source.search(DESTROY_CALL);
      expect(revokeAt).toBeGreaterThan(-1);
      expect(destroyAt).toBeGreaterThan(-1);
      expect(revokeAt).toBeLessThan(destroyAt);
    }
  });
});

describe("a revoked session really is dead, not merely logged out", () => {
  it("the resolver treats a revoked row as a denial before it checks anything else", () => {
    // Read the decision order out of the store: revocation is checked before
    // expiry and before the stage, so a revoked row can never be resurrected
    // by, say, refreshing its idle window.
    const source = readFileSync(join(SRC, "lib", "auth", "admin-session.ts"), "utf8");
    const revoked = source.indexOf('reason: "revoked"');
    const idle = source.indexOf('reason: "expired_idle"');
    const pending = source.indexOf('reason: "pending_two_factor"');
    expect(revoked).toBeGreaterThan(-1);
    expect(revoked).toBeLessThan(idle);
    expect(revoked).toBeLessThan(pending);
  });

  it("revocation is also what promotion uses to retire the pending session", () => {
    const source = readFileSync(join(SRC, "lib", "auth", "admin-session.ts"), "utf8");
    expect(source).toContain("rotated_after_two_factor");
  });
});
