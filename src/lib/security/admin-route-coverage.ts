/**
 * Static coverage scanner for the centralized admin gate (spec item 10).
 *
 * The rule: every admin API route must go through `gateAdminApiCall`, which
 * is the one place that enforces CSRF, banned-device blocking and a
 * completed-2FA admin session together. A route that calls `requireAdmin()`
 * on its own gets the session check but skips CSRF and the banned-device
 * block — for a mutation that is a real hole, which is exactly the class of
 * bypass this scanner finds.
 *
 * This is a source scanner, not a runtime check: it reads the route files
 * from disk so CI can fail the moment a new admin endpoint is added outside
 * the gate. It is imported by tests (and available to diagnostics tooling);
 * nothing on the request path imports it, so `node:fs` never reaches a
 * bundled server route.
 *
 * The runtime counterpart — counting unauthenticated probes of admin paths —
 * lives next door in `admin-route-scanner.ts`.
 */

import fs from "node:fs";
import path from "node:path";

export type AdminRouteGuardKind =
  /** Calls the centralized gate. */
  | "gate"
  /** Calls requireAdmin()/requireAdminWithDefender() directly — session check only. */
  | "require-admin"
  /** Built from the shared admin catalog factory. */
  | "catalog-factory"
  /** Re-verifies admin credentials inline. */
  | "verify-credentials"
  /** No admin guard at all. */
  | "none";

export type AdminRouteGateReport = {
  /** Repo-relative POSIX path, e.g. "src/app/api/admin/users/route.ts". */
  route: string;
  /** Exported HTTP handlers found in the file. */
  handlers: string[];
  /** The subset of `handlers` that mutate (POST/PUT/PATCH/DELETE). */
  mutations: string[];
  /**
   * The strongest guard found anywhere in the file. Kept for reporting, but
   * do NOT use it to decide whether a route is safe — see `handlerGuards`.
   */
  guard: AdminRouteGuardKind;
  /**
   * The guard protecting each exported handler, detected inside that
   * handler's own body.
   *
   * This exists because a file-level answer lies. Four admin routes pair a
   * gated mutation with a bare `requireAdmin()` read — `media`, `media/[id]`,
   * `email` and `email/admin-test` all had a gated POST/DELETE and an
   * unguarded GET. A scanner that returned "gate" as soon as the string
   * appeared anywhere in the file reported every one of them as covered, so
   * an empty allow-list proved nothing about the GETs.
   */
  handlerGuards: Record<string, AdminRouteGuardKind>;
  /** True only when EVERY exported handler passes through `gateAdminApiCall`. */
  gated: boolean;
  /** Handlers that do not reach the gate. Empty when `gated` is true. */
  ungatedHandlers: string[];
};

/**
 * Routes that legitimately do not call the gate.
 *
 * `login` is the unauthenticated entry point by definition — it is where a
 * principal is created, so it cannot require one. `logout` must stay
 * reachable by a session that is already half-broken (expired, revoked,
 * pending 2FA); refusing to let such a session sign out would strand it.
 * Both do their own CSRF-equivalent handling as form POSTs with SameSite
 * cookies, and both are covered by the admin-login rate limit.
 */
export const ADMIN_GATE_EXEMPT_ROUTES: ReadonlySet<string> = new Set([
  "src/app/api/admin/login/route.ts",
  "src/app/api/admin/logout/route.ts",
]);

const HTTP_HANDLERS = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"] as const;
const MUTATION_HANDLERS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name === "route.ts") out.push(full);
  }
  return out;
}

/** Strip line and block comments so a mention in prose is never a "call". */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function detectHandlers(code: string): string[] {
  return HTTP_HANDLERS.filter((name) =>
    new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${name}\\b|export\\s+(?:const|\\{[^}]*\\b)${name}\\b`,
    ).test(code),
  );
}

function detectGuard(code: string): AdminRouteGuardKind {
  if (/\bgateAdminApiCall\s*\(/.test(code)) return "gate";
  if (/\bmakeAdminCatalog(?:Index|Item)\s*\(/.test(code)) return "catalog-factory";
  if (/\brequireAdmin(?:WithDefender)?\s*\(/.test(code)) return "require-admin";
  if (/\bverifyAdminCredentials\s*\(/.test(code)) return "verify-credentials";
  return "none";
}

/**
 * Slice the file into per-handler bodies so each export can be judged on its
 * own code rather than on whatever the file happens to mention.
 *
 * A handler's body runs from its `export function NAME` to the next exported
 * handler (or end of file). Module-level code above the first handler is
 * prepended to every body, because a route that builds its guard once at the
 * top and awaits it inside each handler is still guarded — the goal is to
 * avoid false ALARMS while refusing to grant false ASSURANCE.
 */
function sliceHandlerBodies(code: string): Record<string, string> {
  const starts: Array<{ name: string; index: number }> = [];
  for (const name of HTTP_HANDLERS) {
    const re = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${name}\\b|export\\s+(?:const|\\{[^}]*\\b)${name}\\b`,
    );
    const m = re.exec(code);
    if (m) starts.push({ name, index: m.index });
  }
  starts.sort((a, b) => a.index - b.index);
  const preamble = starts.length > 0 ? code.slice(0, starts[0]!.index) : "";
  const bodies: Record<string, string> = {};
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i]!.index;
    const to = i + 1 < starts.length ? starts[i + 1]!.index : code.length;
    bodies[starts[i]!.name] = preamble + code.slice(from, to);
  }
  return bodies;
}

/**
 * Scan every `route.ts` under the admin API tree and report how each one is
 * guarded. `rootDir` defaults to the process working directory (the repo
 * root when run from vitest).
 */
export function scanAdminRouteGateCoverage(
  options: { rootDir?: string } = {},
): AdminRouteGateReport[] {
  const root = options.rootDir ?? process.cwd();
  const adminApiDir = path.join(root, "src", "app", "api", "admin");
  return walk(adminApiDir)
    .sort()
    .map((file) => {
      const code = codeOnly(fs.readFileSync(file, "utf8"));
      const handlers = detectHandlers(code);
      const guard = detectGuard(code);
      const bodies = sliceHandlerBodies(code);
      const handlerGuards: Record<string, AdminRouteGuardKind> = {};
      for (const h of handlers) handlerGuards[h] = detectGuard(bodies[h] ?? code);
      const ungatedHandlers = handlers.filter((h) => handlerGuards[h] !== "gate");
      return {
        route: path.relative(root, file).split(path.sep).join("/"),
        handlers,
        mutations: handlers.filter((h) => MUTATION_HANDLERS.has(h)),
        guard,
        handlerGuards,
        // Every handler must reach the gate. One gated POST does not make an
        // unguarded GET in the same file safe.
        gated: handlers.length > 0 && ungatedHandlers.length === 0,
        ungatedHandlers,
      };
    });
}

/**
 * Admin routes that do not pass through the centralized gate, excluding the
 * documented exemptions. A non-empty result is gate debt: those endpoints
 * still authenticate, but they skip CSRF and the banned-device block.
 */
export function adminRoutesBypassingCentralGate(
  reports: AdminRouteGateReport[] = scanAdminRouteGateCoverage(),
): AdminRouteGateReport[] {
  return reports.filter((r) => !r.gated && !ADMIN_GATE_EXEMPT_ROUTES.has(r.route));
}

/**
 * The highest-severity subset: routes with a MUTATING handler that skip the
 * gate. These accept state-changing requests without a CSRF check and
 * without banned-device enforcement.
 */
export function adminMutationRoutesBypassingCentralGate(
  reports: AdminRouteGateReport[] = scanAdminRouteGateCoverage(),
): AdminRouteGateReport[] {
  return adminRoutesBypassingCentralGate(reports).filter((r) => r.mutations.length > 0);
}
