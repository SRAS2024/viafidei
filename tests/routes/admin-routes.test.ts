import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

// None of these is the repo. .claude holds a whole checkout for every old worktree on
// a machine that has them: tens of thousands of files, enough to time the walk out.
const NOT_THE_REPO = new Set(["node_modules", ".next", ".git", ".claude"]);
const TEXT_FILE = /\.(ts|tsx|js|jsx|md|mdx|json|html|xml)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (NOT_THE_REPO.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && TEXT_FILE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every text file git tracks and the checkout has, or null where git cannot say. */
function trackedTextFiles(): string[] | null {
  try {
    return execFileSync("git", ["ls-files", "-z"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter((file) => TEXT_FILE.test(file))
      .map((file) => path.join(ROOT, file))
      .filter((file) => fs.lstatSync(file, { throwIfNoEntry: false })?.isFile());
  } catch {
    return null;
  }
}

describe("the walk behind the /adamant check", () => {
  it("goes round .claude, and only that, wherever it is run from", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "admin-routes-walk-"));
    try {
      const write = (...parts: string[]) => {
        const file = path.join(root, ...parts);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "");
        return file;
      };
      const worktreeFile = write(".claude", "worktrees", "old", "src", "page.tsx");
      write(".claude", "launch.json");
      const inRepo = [write("README.md"), write("src", "page.tsx"), write(".github", "notes.md")];

      expect(walk(root).sort()).toEqual(inRepo.sort());
      // Tests run from inside a worktree must still see that worktree's own files.
      expect(walk(path.join(root, ".claude", "worktrees", "old"))).toEqual([worktreeFile]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("still reaches every text file the repo tracks", (context) => {
    const tracked = trackedTextFiles();
    if (!tracked) return context.skip();
    expect(tracked.length).toBeGreaterThan(0);
    const walked = new Set(walk(ROOT));
    expect(tracked.filter((file) => !walked.has(file))).toEqual([]);
  });
});

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
