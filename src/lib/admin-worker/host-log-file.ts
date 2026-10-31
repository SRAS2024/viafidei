/**
 * The local host's persistent runtime log.
 *
 * Everything the host and its worker child print used to reach exactly two
 * places: an 800-line in-memory ring (lost on every restart) and the Mac app's
 * stderr, which is /dev/null for the installed app. Crash stack traces,
 * restart and give-up reasons, and the evidence for incidents like the 8-day
 * orphaned host were gone by the time anyone looked; post-mortems had only
 * AdminWorkerLog rows.
 *
 * This writes the same lines — host lines, the worker child's stdout/stderr,
 * and the host's own stderr (Prisma and library errors) — to a file:
 * ~/Library/Logs/ViaFidei/worker-host.log by default (where Console.app looks),
 * VIAFIDEI_HOST_LOG_FILE to move it, "off" to disable. It rotates at 10 MB and
 * keeps three older files (.1 newest … .3 oldest), so it never exceeds ~40 MB.
 *
 * Secrets never reach the disk: every line is redacted for credentials in
 * URLs, bearer tokens, token/password query parameters, and the literal value
 * of every secret-looking environment variable. Writes are synchronous (a
 * crash loses nothing already logged) and can never throw: after a failure
 * (disk full, permissions) the file is switched off and says why once.
 */

import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

export const HOST_LOG_MAX_BYTES = 10 * 1024 * 1024;
export const HOST_LOG_KEEP = 3;

/** Where the log goes, or null when VIAFIDEI_HOST_LOG_FILE switches it off. */
export function hostLogPath(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string | null {
  const raw = (env.VIAFIDEI_HOST_LOG_FILE ?? "").trim();
  if (["off", "none", "0", "false"].includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  return path.join(home, "Library", "Logs", "ViaFidei", "worker-host.log");
}

/** Variable names whose values are secrets wherever they appear in a line. */
const SECRET_ENV_NAME = /(SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE_KEY|_DSN)$|DATABASE.*URL/i;

/** The literal secret values in this environment (long enough to be unambiguous). */
export function secretsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (value && value.length >= 8 && SECRET_ENV_NAME.test(name)) out.push(value);
  }
  return out;
}

/** One line with every credential it carries replaced by "[redacted]". */
export function redactSecrets(line: string, secrets: readonly string[] = []): string {
  let out = line;
  for (const secret of secrets) {
    if (secret.length >= 8 && out.includes(secret)) out = out.split(secret).join("[redacted]");
  }
  return (
    out
      // scheme://user:password@host
      .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi, "$1[redacted]@")
      // Authorization: Bearer <token>
      .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/g, "$1[redacted]")
      // ?token=… &password=… and friends
      .replace(
        /([?&](?:token|access_token|password|secret|api_?key|key)=)[^&\s"']+/gi,
        "$1[redacted]",
      )
  );
}

export class RotatingLogFile {
  readonly path: string;
  private readonly maxBytes: number;
  private readonly keep: number;
  private readonly secrets: readonly string[];
  private fd: number | null = null;
  private size = 0;
  private disabledReason: string | null = null;

  constructor(
    filePath: string,
    opts: { maxBytes?: number; keep?: number; secrets?: readonly string[] } = {},
  ) {
    this.path = filePath;
    this.maxBytes = Math.max(1024, opts.maxBytes ?? HOST_LOG_MAX_BYTES);
    this.keep = Math.max(1, opts.keep ?? HOST_LOG_KEEP);
    this.secrets = opts.secrets ?? [];
  }

  /** Why the file stopped being written, or null while it is healthy. */
  get failure(): string | null {
    return this.disabledReason;
  }

  /** Append one timestamped, redacted line. Never throws. */
  write(stream: string, line: string, at: Date = new Date()): void {
    if (this.disabledReason) return;
    const text = `${at.toISOString()} [${stream}] ${redactSecrets(line, this.secrets)}\n`;
    try {
      this.ensureOpen();
      const bytes = Buffer.byteLength(text);
      if (this.size > 0 && this.size + bytes > this.maxBytes) this.rotate();
      writeSync(this.fd as number, text);
      this.size += bytes;
    } catch (err) {
      this.disable(err);
    }
  }

  close(): void {
    if (this.fd === null) return;
    try {
      closeSync(this.fd);
    } catch {
      /* already closed */
    }
    this.fd = null;
  }

  private ensureOpen(): void {
    if (this.fd !== null) return;
    mkdirSync(path.dirname(this.path), { recursive: true, mode: 0o700 });
    this.fd = openSync(this.path, "a", 0o600);
    this.size = fstatSync(this.fd).size;
  }

  /** worker-host.log → .1 → .2 → … → .keep (dropped). */
  private rotate(): void {
    this.close();
    const oldest = `${this.path}.${this.keep}`;
    if (existsSync(oldest)) rmSync(oldest, { force: true });
    for (let i = this.keep - 1; i >= 1; i -= 1) {
      const from = `${this.path}.${i}`;
      if (existsSync(from)) renameSync(from, `${this.path}.${i + 1}`);
    }
    if (existsSync(this.path)) renameSync(this.path, `${this.path}.1`);
    this.ensureOpen();
  }

  private disable(err: unknown): void {
    this.disabledReason = err instanceof Error ? err.message : String(err);
    this.close();
  }
}

/**
 * Copy everything the process writes to stderr into the log as well (Prisma's
 * own error lines, console.warn/error from library code), split into lines.
 * The original write still happens. Returns a function that undoes the tee.
 */
export function teeStderrTo(log: RotatingLogFile, stream = "stderr"): () => void {
  const original = process.stderr.write;
  let partial = "";
  const tee = function (this: unknown, chunk: unknown, ...rest: unknown[]): boolean {
    try {
      const text =
        partial +
        (typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
      const lines = text.split("\n");
      partial = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) log.write(stream, line.trimEnd());
    } catch {
      /* the log must never break the write it copies */
    }
    return (original as (...args: unknown[]) => boolean).call(process.stderr, chunk, ...rest);
  } as typeof process.stderr.write;
  process.stderr.write = tee;
  return () => {
    if (process.stderr.write === tee) process.stderr.write = original;
  };
}
