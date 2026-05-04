import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\.(ts|tsx|js|jsx|md|mdx|json|html|xml)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("admin route surface", () => {
  it("contains no /adamant references anywhere in source, tests, or docs", () => {
    const files = walk(ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      // Skip the test file itself — it contains the literal string we're searching for.
      if (file.endsWith("admin-routes.test.ts")) continue;
      // Skip lock files — they can have unrelated string matches.
      if (file.endsWith("package-lock.json")) continue;
      const content = fs.readFileSync(file, "utf8");
      if (/\/adamant\b/.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("admin login route source redirects successful logins to /admin?welcome=1", () => {
    const file = path.join(ROOT, "src", "app", "api", "admin", "login", "route.ts");
    const src = fs.readFileSync(file, "utf8");
    expect(src).toContain("/admin?welcome=1");
  });

  it("admin login route source redirects failures to /admin/login", () => {
    const file = path.join(ROOT, "src", "app", "api", "admin", "login", "route.ts");
    const src = fs.readFileSync(file, "utf8");
    expect(src).toMatch(/\/admin\/login/);
  });

  it("admin logout route source redirects to /admin/login", () => {
    const file = path.join(ROOT, "src", "app", "api", "admin", "logout", "route.ts");
    const src = fs.readFileSync(file, "utf8");
    expect(src).toContain("/admin/login");
  });

  it("admin layout marks admin pages as noindex,nofollow", () => {
    const file = path.join(ROOT, "src", "app", "admin", "layout.tsx");
    const src = fs.readFileSync(file, "utf8");
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });
});
