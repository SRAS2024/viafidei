#!/usr/bin/env node
/**
 * Resolve, from the linked Railway project, everything the local Admin Worker
 * launcher needs to run under `railway run` — and print it as ONE JSON object
 * on stdout:
 *
 *   {"environment": "production", "webService": "web", "postgresService": "Postgres",
 *    "publicDbUrl": "postgresql://…@….proxy.rlwy.net:…/railway", "dryRun": {"ok": true, "error": null}}
 *
 * WHY. `railway run` without `--service` fails with "No service linked" after
 * the launcher has already exec'd, so the host never starts and the app shows
 * a misleading Node error. And inside Railway every service reaches Postgres
 * over the private network (`postgres.railway.internal`), a hostname that
 * resolves nowhere else; the Postgres service also exposes DATABASE_PUBLIC_URL
 * (a `*.proxy.rlwy.net` TCP proxy) for exactly this case. So the launcher asks
 * this helper to name the WEB service (the one whose variables carry the
 * app's SESSION_SECRET / ADMIN_USERNAME — overridable with
 * VIAFIDEI_RAILWAY_SERVICE), the POSTGRES service (the one exposing
 * DATABASE_PUBLIC_URL) and the linked ENVIRONMENT (overridable with
 * VIAFIDEI_RAILWAY_ENVIRONMENT), all scoped to that one environment so a
 * staging Postgres can never be paired with production credentials.
 *
 * It then dry-runs `railway run --service <web> --environment <env> -- /usr/bin/true`
 * so a broken link is reported here, as JSON, instead of after exec.
 *
 * The public URL is kept only in the launcher's process environment; it is
 * never written to disk. Every CLI call is bounded to 15 s so a slow Railway
 * API cannot outlast the app's handshake watchdog. Diagnostics go to stderr.
 *
 * Exit codes: 0 resolved (webService known), 2 linked but no web service found,
 * 3 railway CLI unavailable / not logged in / not linked.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CLI_TIMEOUT_MS = 15_000;

function log(message) {
  process.stderr.write(`[railway-resolve] ${message}\n`);
}

function firstLine(text) {
  return (
    String(text ?? "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ""
  );
}

function railway(args) {
  return execFileSync("railway", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: CLI_TIMEOUT_MS,
    env: { ...process.env, NO_COLOR: "1" },
  });
}

/** stderr (or the message) of a failed execFileSync, first line only. */
function describeFailure(err) {
  const stderr = firstLine(err?.stderr);
  return stderr || firstLine(err?.message) || "unknown error";
}

function emit(result, code) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(code);
}

/* ------------------------------------------------------------------ */
/* linked project (railway status + the CLI's own link file)          */
/* ------------------------------------------------------------------ */

/**
 * Walk any shape of `railway status --json` and collect
 * `{ name, id, environmentIds }` per service. The CLI has changed this
 * structure between versions (edges/nodes vs flat arrays), so the walk keys
 * off field names rather than a fixed path.
 */
function collectServices(status) {
  const services = new Map();
  const walk = (node, underServices) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, underServices);
      return;
    }
    if (underServices && typeof node.name === "string") {
      const entry = services.get(node.name) ?? {
        name: node.name,
        id: typeof node.id === "string" ? node.id : null,
        environmentIds: new Set(),
      };
      const collectEnvIds = (inst) => {
        if (!inst || typeof inst !== "object") return;
        if (Array.isArray(inst)) {
          inst.forEach(collectEnvIds);
          return;
        }
        if (typeof inst.environmentId === "string") entry.environmentIds.add(inst.environmentId);
        for (const value of Object.values(inst)) collectEnvIds(value);
      };
      collectEnvIds(node.serviceInstances);
      services.set(node.name, entry);
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, underServices || key === "services" || key === "serviceInstances");
    }
  };
  walk(status, false);
  return [...services.values()];
}

/** `{ id, name }` for every environment named in `railway status --json`. */
function collectEnvironments(status) {
  const envs = new Map();
  const walk = (node, underEnvs) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, underEnvs);
      return;
    }
    if (underEnvs && typeof node.name === "string" && typeof node.id === "string") {
      envs.set(node.id, node.name);
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, underEnvs || key === "environments");
    }
  };
  walk(status, false);
  return envs;
}

/**
 * The CLI records the link in ~/.railway/config.json keyed by checkout path:
 * `{ projects: { "/path": { project, environment, environmentName, service } } }`.
 * Reading it is the only offline way to learn WHICH environment `railway link`
 * chose; `railway status --json` lists all of them.
 */
function readLinkFile() {
  const file = process.env.RAILWAY_CONFIG_FILE || path.join(homedir(), ".railway", "config.json");
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const projects = parsed?.projects && typeof parsed.projects === "object" ? parsed.projects : {};
    const cwd = process.cwd();
    const entry =
      projects[cwd] ??
      Object.entries(projects).find(([key]) => path.resolve(key) === cwd)?.[1] ??
      null;
    return entry && typeof entry === "object" ? entry : null;
  } catch {
    return null;
  }
}

function resolveEnvironment(status, link) {
  const override = process.env.VIAFIDEI_RAILWAY_ENVIRONMENT?.trim();
  if (override) return { name: override, id: null };
  const envs = collectEnvironments(status);
  if (link) {
    if (typeof link.environmentName === "string" && link.environmentName) {
      return { name: link.environmentName, id: link.environment ?? null };
    }
    if (typeof link.environment === "string" && envs.has(link.environment)) {
      return { name: envs.get(link.environment), id: link.environment };
    }
  }
  for (const key of ["environmentName", "environment", "linkedEnvironment"]) {
    const value = status?.[key];
    if (typeof value === "string" && value) return { name: value, id: null };
    if (value && typeof value === "object" && typeof value.name === "string") {
      return { name: value.name, id: typeof value.id === "string" ? value.id : null };
    }
  }
  const names = [...envs.entries()];
  if (names.length === 1) return { name: names[0][1], id: names[0][0] };
  const production = names.find(([, name]) => /^production$/i.test(name));
  if (production) return { name: production[1], id: production[0] };
  return { name: null, id: null };
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

let status;
try {
  status = JSON.parse(railway(["status", "--json"]));
} catch (err) {
  const error = describeFailure(err);
  log(`railway status failed: ${error}`);
  emit({ environment: null, webService: null, postgresService: null, publicDbUrl: null, error }, 3);
}

const link = readLinkFile();
const environment = resolveEnvironment(status, link);
if (!environment.name) {
  log("could not determine the linked Railway environment");
  emit(
    {
      environment: null,
      webService: null,
      postgresService: null,
      publicDbUrl: null,
      error:
        "could not determine the linked Railway environment — run `railway link` and choose the production environment",
    },
    2,
  );
}

let services = collectServices(status);
// Restrict to services deployed in the linked environment when the status
// output tells us which those are; otherwise every service is a candidate.
if (environment.id) {
  const scoped = services.filter(
    (s) => s.environmentIds.size === 0 || s.environmentIds.has(environment.id),
  );
  if (scoped.length > 0) services = scoped;
}
if (services.length === 0) {
  log("no services found in the linked project");
  emit(
    {
      environment: environment.name,
      webService: null,
      postgresService: null,
      publicDbUrl: null,
      error: "no services found in the linked Railway project",
    },
    2,
  );
}

const variableCache = new Map();
function variablesOf(serviceName) {
  if (variableCache.has(serviceName)) return variableCache.get(serviceName);
  let vars = null;
  try {
    const parsed = JSON.parse(
      railway([
        "variable",
        "list",
        "--service",
        serviceName,
        "--environment",
        environment.name,
        "--json",
      ]),
    );
    vars = parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    log(`variable list failed for "${serviceName}": ${describeFailure(err)}`);
  }
  variableCache.set(serviceName, vars);
  return vars;
}

const isDbName = (n) => /postgres|pg|database|\bdb\b/i.test(n);
const isWebName = (n) => /web|app|site|viafidei|next/i.test(n);
const names = services.map((s) => s.name);

// --- Postgres service: the one exposing DATABASE_PUBLIC_URL (db-ish names first).
let postgresService = null;
let publicDbUrl = null;
for (const name of [...names.filter(isDbName), ...names.filter((n) => !isDbName(n))]) {
  const vars = variablesOf(name);
  const url = vars?.DATABASE_PUBLIC_URL;
  if (typeof url === "string" && /^postgres(ql)?:\/\//.test(url)) {
    postgresService = name;
    publicDbUrl = url;
    break;
  }
}

// --- Web service: an explicit override, else the linked service, else the
// service whose variables carry the app's own secrets.
const hasAppSecrets = (vars) =>
  !!vars && (typeof vars.SESSION_SECRET === "string" || typeof vars.ADMIN_USERNAME === "string");
let webService = null;
const override = process.env.VIAFIDEI_RAILWAY_SERVICE?.trim();
if (override) {
  webService = override;
} else {
  const linkedServiceName =
    link && typeof link.service === "string"
      ? (services.find((s) => s.id === link.service)?.name ?? null)
      : null;
  const candidates = [
    ...(linkedServiceName ? [linkedServiceName] : []),
    ...names.filter((n) => isWebName(n) && !isDbName(n)),
    ...names.filter((n) => !isWebName(n) && !isDbName(n) && n !== postgresService),
  ].filter((n, i, arr) => arr.indexOf(n) === i);
  for (const name of candidates) {
    if (hasAppSecrets(variablesOf(name))) {
      webService = name;
      break;
    }
  }
}

if (!webService) {
  log(`no service carries SESSION_SECRET/ADMIN_USERNAME (checked: ${names.join(", ")})`);
  emit(
    {
      environment: environment.name,
      webService: null,
      postgresService,
      publicDbUrl,
      error:
        `no Railway service in "${environment.name}" carries SESSION_SECRET/ADMIN_USERNAME ` +
        `(checked: ${names.join(", ")}) — set VIAFIDEI_RAILWAY_SERVICE to name the web service`,
    },
    2,
  );
}

// --- Dry run: prove `railway run` will actually inject this service's
// variables BEFORE the launcher exec's into it and loses the ability to report.
let dryRun = { ok: true, error: null };
try {
  railway([
    "run",
    "--service",
    webService,
    "--environment",
    environment.name,
    "--",
    "/usr/bin/true",
  ]);
} catch (err) {
  dryRun = { ok: false, error: describeFailure(err) };
  log(`dry run of railway run failed: ${dryRun.error}`);
}

log(
  `environment "${environment.name}", web service "${webService}", ` +
    `postgres ${postgresService ? `"${postgresService}" (DATABASE_PUBLIC_URL found)` : "not found"}`,
);
emit(
  { environment: environment.name, webService, postgresService, publicDbUrl, dryRun, error: null },
  0,
);
