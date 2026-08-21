/**
 * The Railway worker service must stay DEPLOYABLE while consuming essentially
 * no compute (spec §6, acceptance §30.4 and §30.39).
 *
 * These are offline invariants on the deploy configuration itself. They exist
 * because a plausible-looking value can silently break a deploy: Railway's
 * schema requires `deploy.numReplicas >= 1`, so the obvious way to express
 * "run nothing" — numReplicas: 0 — is rejected, and the service would not
 * deploy at all. The parked start command is what actually guarantees the
 * near-zero footprint.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const workerConfig = JSON.parse(readFileSync(path.join(ROOT, "railway.worker.json"), "utf8")) as {
  build?: { builder?: string; dockerfilePath?: string };
  deploy?: Record<string, unknown>;
};
const webConfig = JSON.parse(readFileSync(path.join(ROOT, "railway.json"), "utf8")) as {
  deploy?: Record<string, unknown>;
};

/** Mirrors https://backboard.railway.app/railway.schema.json (deploy section). */
const RESTART_POLICIES = new Set(["ON_FAILURE", "ALWAYS", "NEVER"]);

describe("Railway worker service — retained but parked", () => {
  it("is still a buildable Dockerfile service", () => {
    expect(workerConfig.build?.builder).toBe("DOCKERFILE");
    const dockerfile = workerConfig.build?.dockerfilePath ?? "";
    expect(dockerfile).toBe("Dockerfile.worker");
    expect(existsSync(path.join(ROOT, dockerfile))).toBe(true);
  });

  it("starts the parked entrypoint, not the worker", () => {
    const start = String(workerConfig.deploy?.startCommand ?? "");
    expect(start).toContain("scripts/worker-service-parked.sh");
    expect(start).not.toMatch(/run-worker|npm run worker/);
    expect(existsSync(path.join(ROOT, "scripts/worker-service-parked.sh"))).toBe(true);
  });

  it("uses only values Railway's schema accepts", () => {
    // numReplicas: 0 is INVALID (schema minimum is 1) — expressing "run nothing"
    // that way would break the deploy, so it must be absent entirely.
    const replicas = workerConfig.deploy?.numReplicas;
    expect(replicas === undefined || (typeof replicas === "number" && replicas >= 1)).toBe(true);

    const policy = workerConfig.deploy?.restartPolicyType;
    if (policy !== undefined) expect(RESTART_POLICIES.has(String(policy))).toBe(true);

    const sleep = workerConfig.deploy?.sleepApplication;
    if (sleep !== undefined) expect(typeof sleep).toBe("boolean");
  });

  it("asks Railway to sleep the idle service", () => {
    expect(workerConfig.deploy?.sleepApplication).toBe(true);
  });

  it("stays recoverable: a crashed un-parked worker would restart", () => {
    // NEVER would leave a future, deliberately un-parked cloud worker dead on
    // its first crash; ON_FAILURE preserves the original service semantics.
    expect(workerConfig.deploy?.restartPolicyType).toBe("ON_FAILURE");
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
    expect(String(webConfig.deploy?.startCommand ?? "")).toContain("scripts/start.sh");
  });
});
