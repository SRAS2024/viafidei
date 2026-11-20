/**
 * The Railway worker service must stay DEPLOYABLE while consuming essentially
 * no compute (spec §6, acceptance §30.4 and §30.39).
 *
 * These are offline invariants on the deploy configuration itself, which lives
 * in .railway/railway.ts (Railway's Infrastructure as Code; it replaced
 * railway.json and railway.worker.json). They exist because a plausible-looking
 * value can silently break a deploy: Railway's schema requires
 * `deploy.numReplicas >= 1`, so the obvious way to express "run nothing" —
 * numReplicas: 0 — is rejected, and the service would not deploy at all. The
 * parked start command is what actually guarantees the near-zero footprint.
 *
 * The file is read as text. It is plain object literals, so matching braces is
 * enough, and the test needs no copy of Railway's SDK (that lives in
 * .railway/node_modules, which the app's own install never creates).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const IAC = readFileSync(path.join(ROOT, ".railway", "railway.ts"), "utf8");
/** The file without its whole-line comments, so prose is never read as config. */
const CODE = IAC.replace(/^\s*\/\/.*$/gm, "");

/** The `{ ... }` passed to `service("<name>", ...)`. */
function serviceBlock(name: string): string {
  const start = CODE.indexOf(`service(${JSON.stringify(name)},`);
  if (start < 0) throw new Error(`.railway/railway.ts declares no service ${name}`);
  const open = CODE.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CODE.length; i++) {
    if (CODE[i] === "{") depth++;
    if (CODE[i] === "}" && --depth === 0) return CODE.slice(open, i + 1);
  }
  throw new Error(`service ${name} in .railway/railway.ts has unbalanced braces`);
}

/** The literal (string, number or boolean) written after `key:` in a block. */
function setting(block: string, key: string): string | number | boolean | undefined {
  const match = block.match(new RegExp(`\\b${key}:\\s*("(?:[^"\\\\]|\\\\.)*"|-?\\d+|true|false)`));
  return match ? (JSON.parse(match[1]) as string | number | boolean) : undefined;
}

const worker = serviceBlock("joyful-upliftment");
const web = serviceBlock("viafidei");

/** Mirrors Railway's DeployConfig restartPolicyType. */
const RESTART_POLICIES = new Set(["ON_FAILURE", "ALWAYS", "NEVER"]);

describe("Railway worker service — retained but parked", () => {
  it("is still a buildable Dockerfile service", () => {
    expect(setting(worker, "builder")).toBe("DOCKERFILE");
    const dockerfile = String(setting(worker, "dockerfilePath") ?? "");
    expect(dockerfile).toBe("Dockerfile.worker");
    expect(existsSync(path.join(ROOT, dockerfile))).toBe(true);
  });

  it("starts the parked entrypoint, not the worker", () => {
    const start = String(setting(worker, "startCommand") ?? "");
    expect(start).toContain("scripts/worker-service-parked.sh");
    expect(start).not.toMatch(/run-worker|npm run worker/);
    expect(existsSync(path.join(ROOT, "scripts/worker-service-parked.sh"))).toBe(true);
  });

  it("uses only values Railway's schema accepts", () => {
    // numReplicas: 0 is INVALID (schema minimum is 1) — expressing "run nothing"
    // that way would break the deploy, so it must be absent entirely. The SDK's
    // `replicas` shorthand sets the same number.
    for (const key of ["numReplicas", "replicas"]) {
      const replicas = setting(worker, key);
      expect(replicas === undefined || (typeof replicas === "number" && replicas >= 1)).toBe(true);
    }

    const policy = setting(worker, "restartPolicyType");
    if (policy !== undefined) expect(RESTART_POLICIES.has(String(policy))).toBe(true);

    const sleep = setting(worker, "sleepApplication");
    if (sleep !== undefined) expect(typeof sleep).toBe("boolean");
  });

  it("asks Railway to sleep the idle service", () => {
    expect(setting(worker, "sleepApplication")).toBe(true);
  });

  it("stays recoverable: a crashed un-parked worker would restart", () => {
    // NEVER would leave a future, deliberately un-parked cloud worker dead on
    // its first crash; ON_FAILURE preserves the original service semantics.
    // ON_FAILURE is Railway's default, which Railway does not store, so the
    // file leaves the policy out (written out, it would show in every plan).
    expect([undefined, "ON_FAILURE"]).toContain(setting(worker, "restartPolicyType"));
  });

  it("parks without a Node, Python, Prisma or Chromium process", () => {
    const parked = readFileSync(path.join(ROOT, "scripts/worker-service-parked.sh"), "utf8");
    // Only executable lines matter — the script's comments and echoed banner
    // legitimately mention what it deliberately does NOT run.
    const commands = parked
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("echo "))
      .join("\n");
    expect(commands).not.toMatch(
      /(^|[;&|]\s*)(node|npm|npx|tsx|python3?|prisma|chromium|playwright)\b/im,
    );
    // It must not exit, or the deployment would read as stopped/crashed.
    expect(commands).toMatch(/while true|sleep infinity/);
  });

  it("leaves database migrations owned by the web service", () => {
    const parked = readFileSync(path.join(ROOT, "scripts/worker-service-parked.sh"), "utf8");
    expect(parked).not.toMatch(/migrate-deploy|prisma migrate/);
    const start = readFileSync(path.join(ROOT, "scripts/start.sh"), "utf8");
    expect(start).toMatch(/migrate-deploy\.sh/);
    expect(String(setting(web, "startCommand") ?? "")).toContain("scripts/start.sh");
  });
});

describe("Railway config file — safe to apply", () => {
  it("manages only the services it declares", () => {
    // Without a named partial the file would manage the whole project, and
    // `railway config apply` would delete every service or database it does
    // not list: the Postgres database among them.
    expect(CODE).toMatch(/^export const partial = "viafidei";$/m);
  });

  it("keeps each service deploying from GitHub main", () => {
    // Inside a declared service, an omitted source means "no source": an apply
    // would disconnect the repository and pushes to main would stop deploying.
    for (const block of [web, worker]) {
      expect(block).toContain('source: github("SRAS2024/viafidei", { branch: "main" })');
    }
  });
});
