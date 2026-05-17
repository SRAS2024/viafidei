import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const ADMIN_PAGES_DIR = path.join(ROOT, "src", "app", "admin");
const ADMIN_API_DIR = path.join(ROOT, "src", "app", "api", "admin");

function walkPagesAndRoutes(dir: string, filename: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkPagesAndRoutes(full, filename));
    } else if (entry.isFile() && entry.name === filename) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Pages whose entire body is `permanentRedirect("…")` because their old URL
 * was moved. They legitimately don't need a `requireAdmin` call — the
 * redirect lands on a page that does its own gate.
 */
const REDIRECT_STUB_PAGES = new Set(
  [
    path.join(ADMIN_PAGES_DIR, "audit", "page.tsx"),
    path.join(ADMIN_PAGES_DIR, "email", "page.tsx"),
  ].map((p) => path.normalize(p)),
);

describe("admin route protection — static analysis", () => {
  it("every admin page.tsx either redirects or calls requireAdmin / verifyAdmin", () => {
    const pages = walkPagesAndRoutes(ADMIN_PAGES_DIR, "page.tsx");
    expect(pages.length).toBeGreaterThan(5);
    const offenders: string[] = [];
    for (const file of pages) {
      const norm = path.normalize(file);
      if (REDIRECT_STUB_PAGES.has(norm)) continue;
      const src = fs.readFileSync(file, "utf8");
      if (!/requireAdmin\s*\(|verifyAdmin/.test(src)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every admin API route.ts file relies on requireAdmin, the catalog factory, or is the login/logout pair", () => {
    const routes = walkPagesAndRoutes(ADMIN_API_DIR, "route.ts");
    expect(routes.length).toBeGreaterThan(5);
    const offenders: string[] = [];
    for (const file of routes) {
      const src = fs.readFileSync(file, "utf8");
      const rel = path.relative(ROOT, file);
      const isLoginLogout = /\/admin\/(login|logout)\//.test(rel);
      if (isLoginLogout) continue; // login is intentionally unprotected; logout clears the session.
      const usesGuard =
        /requireAdmin\s*\(/.test(src) ||
        /makeAdminCatalog(Index|Item)\s*\(/.test(src) ||
        /verifyAdmin/.test(src) ||
        /gateAdminApiCall\s*\(/.test(src);
      if (!usesGuard) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("admin layout suppresses indexing (robots: index:false, follow:false)", () => {
    const layout = fs.readFileSync(path.join(ADMIN_PAGES_DIR, "layout.tsx"), "utf8");
    expect(layout).toMatch(/index:\s*false/);
    expect(layout).toMatch(/follow:\s*false/);
  });

  it("admin pages live under /admin and there are no parallel admin route trees", () => {
    // The "single admin tree" rule: there must not be another folder named
    // `admin` anywhere outside /src/app/admin / /src/app/api/admin that
    // also ships routable page.tsx / route.ts files.
    function walk(dir: string, out: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === ".git" ||
          entry.name === "tests"
        ) {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.isFile() && (entry.name === "page.tsx" || entry.name === "route.ts")) {
          out.push(full);
        }
      }
      return out;
    }
    const allRoutes = walk(path.join(ROOT, "src"));
    const stray = allRoutes
      .filter((f) => /\/admin\//.test(f))
      .filter(
        (f) => !f.startsWith(ADMIN_PAGES_DIR + path.sep) && !f.startsWith(ADMIN_API_DIR + path.sep),
      );
    expect(stray).toEqual([]);
  });
});
