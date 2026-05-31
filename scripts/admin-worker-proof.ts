#!/usr/bin/env tsx
/**
 * `npm run admin-worker:proof`
 *
 * The full local proof gate for the Admin Worker. Runs, in order:
 *   1. Prisma validation
 *   2. Type check
 *   3. Lint
 *   4. Unit + integration + full-pipeline tests
 *   5. No legacy publish path test
 *   6. No placeholder production code test
 *   7. Local worker dry run (offline brain reasoning)
 *   8. Local content growth proof (one item + every content type)
 *
 * Each step runs to completion; the summary at the end lists every
 * step's status and the process exits non-zero if any step failed, so
 * the developer sees the whole picture in one run.
 */

import { spawnSync } from "node:child_process";

interface Step {
  label: string;
  cmd: string;
  args: string[];
}

const steps: Step[] = [
  { label: "Prisma validation", cmd: "npx", args: ["prisma", "validate"] },
  { label: "Type check", cmd: "npm", args: ["run", "typecheck"] },
  { label: "Lint", cmd: "npm", args: ["run", "lint"] },
  {
    label: "Unit + integration + full-pipeline tests",
    cmd: "npx",
    args: ["vitest", "run"],
  },
  {
    label: "No legacy publish path test",
    cmd: "npx",
    args: [
      "vitest",
      "run",
      "tests/admin-worker/legacy-publish-removed.test.ts",
      "tests/admin-worker/legacy-system-disabled.test.ts",
    ],
  },
  {
    label: "No placeholder production code test",
    cmd: "npx",
    args: [
      "vitest",
      "run",
      "tests/admin-worker/no-placeholder-phrases.test.ts",
      "tests/admin-worker/dispatcher-no-placeholder-stages.test.ts",
    ],
  },
  { label: "Local worker dry run", cmd: "npx", args: ["tsx", "scripts/admin-worker-dry-run.ts"] },
  {
    label: "Local content growth proof",
    cmd: "npx",
    args: [
      "vitest",
      "run",
      "tests/admin-worker/proof/content-pipeline.proof.test.ts",
      "tests/admin-worker/proof/all-content-types.proof.test.ts",
    ],
  },
];

function run(step: Step): boolean {
  console.log(`\n[36m▶ ${step.label}[0m  (${step.cmd} ${step.args.join(" ")})`);
  const res = spawnSync(step.cmd, step.args, { stdio: "inherit", env: process.env });
  return res.status === 0;
}

function main(): void {
  const results: Array<{ label: string; ok: boolean }> = [];
  for (const step of steps) {
    results.push({ label: step.label, ok: run(step) });
  }

  console.log("\n[1m── admin-worker:proof summary ─────────────────────────[0m");
  for (const r of results) {
    console.log(`  ${r.ok ? "[32m✓ PASS[0m" : "[31m✗ FAIL[0m"}  ${r.label}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log("\n[32mAll proof steps passed.[0m");
    process.exit(0);
  }
  console.error(`\n[31m${failed.length} proof step(s) failed.[0m`);
  process.exit(1);
}

main();
