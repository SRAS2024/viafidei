#!/usr/bin/env node
/**
 * Print the PUBLIC connection string of the linked Railway project's Postgres
 * service — and nothing else — to stdout.
 *
 * WHY. Inside Railway, every service reaches Postgres over the private network
 * (`postgres.railway.internal`). That hostname does not resolve anywhere else,
 * so a worker running on the operator's Mac that inherits the web service's
 * DATABASE_URL would connect to nothing. Railway's Postgres service also
 * exposes DATABASE_PUBLIC_URL (a `*.proxy.rlwy.net` TCP proxy) for exactly this
 * case. The launcher (launch-worker-host.sh) runs this helper, keeps the value
 * in the process environment for the worker's lifetime, and never writes it to
 * disk — Railway stays the single source of truth.
 *
 * Resolution order:
 *   1. every service in the linked project/environment is asked for its
 *      variables (`railway variable list --service <name> --json`); the first
 *      one carrying DATABASE_PUBLIC_URL wins (that is the Postgres service);
 *   2. if none does, nothing is printed and the exit code is 2 — the launcher
 *      then reports the problem in the app instead of connecting to localhost.
 *
 * Exit codes: 0 found, 2 not found, 3 railway CLI unavailable / not linked.
 * Diagnostics go to stderr only; stdout is reserved for the URL.
 */
import { execFileSync } from "node:child_process";

function railway(args) {
  return execFileSync("railway", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    env: { ...process.env, NO_COLOR: "1" },
  });
}

/** Collect every plausible service name from `railway status --json`, whatever its exact shape. */
function serviceNames(status) {
  const names = new Set();
  const walk = (node, underServices) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, underServices);
      return;
    }
    if (underServices && typeof node.name === "string") names.add(node.name);
    for (const [key, value] of Object.entries(node)) {
      walk(value, underServices || key === "services" || key === "serviceInstances");
    }
  };
  walk(status, false);
  return [...names];
}

let status;
try {
  status = JSON.parse(railway(["status", "--json"]));
} catch (err) {
  process.stderr.write(
    `[railway-public-db-url] railway status failed: ${String(err?.message ?? err).split("\n")[0]}\n`,
  );
  process.exit(3);
}

const names = serviceNames(status);
if (names.length === 0) {
  process.stderr.write("[railway-public-db-url] no services found in the linked project\n");
  process.exit(2);
}

// Ask the likely database services first (fewer round-trips), then the rest.
const ordered = [
  ...names.filter((n) => /postgres|pg|database|db/i.test(n)),
  ...names.filter((n) => !/postgres|pg|database|db/i.test(n)),
];

for (const name of ordered) {
  let vars;
  try {
    vars = JSON.parse(railway(["variable", "list", "--service", name, "--json"]));
  } catch {
    continue;
  }
  const url = vars && typeof vars === "object" ? vars.DATABASE_PUBLIC_URL : undefined;
  if (typeof url === "string" && /^postgres(ql)?:\/\//.test(url)) {
    process.stderr.write(
      `[railway-public-db-url] using DATABASE_PUBLIC_URL from service "${name}"\n`,
    );
    process.stdout.write(url);
    process.exit(0);
  }
}

process.stderr.write(
  `[railway-public-db-url] no service exposes DATABASE_PUBLIC_URL (checked: ${ordered.join(", ")})\n`,
);
process.exit(2);
