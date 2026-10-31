/**
 * The local host keeps a persistent, rotating, redacted runtime log.
 *
 * Measured gap: host and worker output reached only an 800-line in-memory
 * ring and the Mac app's stderr, which is /dev/null for the installed app, so
 * crash traces and restart reasons were gone by the time anyone looked.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  HOST_LOG_KEEP,
  HOST_LOG_MAX_BYTES,
  hostLogPath,
  redactSecrets,
  RotatingLogFile,
  secretsFromEnv,
  teeStderrTo,
} from "@/lib/admin-worker/host-log-file";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "host-log-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("hostLogPath", () => {
  it("defaults to ~/Library/Logs/ViaFidei/worker-host.log, where Console.app looks", () => {
    expect(hostLogPath({}, "/Users/op")).toBe("/Users/op/Library/Logs/ViaFidei/worker-host.log");
  });

  it("can be moved or switched off", () => {
    expect(hostLogPath({ VIAFIDEI_HOST_LOG_FILE: "/tmp/x/host.log" }, "/Users/op")).toBe(
      "/tmp/x/host.log",
    );
    for (const off of ["off", "OFF", "none", "0", "false"]) {
      expect(hostLogPath({ VIAFIDEI_HOST_LOG_FILE: off }, "/Users/op")).toBeNull();
    }
    expect(hostLogPath({ VIAFIDEI_HOST_LOG_FILE: "  " }, "/Users/op")).toContain("Library/Logs");
  });
});

describe("redaction — secrets never reach the disk", () => {
  it("strips the password from any connection string", () => {
    expect(
      redactSecrets(
        "db at postgresql://postgres:s3cr3tPass@roundhouse.proxy.rlwy.net:12345/railway",
      ),
    ).toBe("db at postgresql://postgres:[redacted]@roundhouse.proxy.rlwy.net:12345/railway");
    expect(redactSecrets("proxied http://user:pw-123456@proxy.local:8080")).toBe(
      "proxied http://user:[redacted]@proxy.local:8080",
    );
  });

  it("strips bearer tokens and token-like query parameters", () => {
    expect(redactSecrets("Authorization: Bearer abcdef0123456789")).toBe(
      "Authorization: Bearer [redacted]",
    );
    expect(redactSecrets("GET /dashboard?token=deadbeefcafe&x=1")).toBe(
      "GET /dashboard?token=[redacted]&x=1",
    );
    expect(redactSecrets("https://h/p?api_key=K123456789")).toBe("https://h/p?api_key=[redacted]");
  });

  it("strips the literal value of every known secret, wherever it appears", () => {
    const token = "a".repeat(64);
    expect(redactSecrets(`{"viafideiLocalHost":{"token":"${token}"}}`, [token])).toBe(
      '{"viafideiLocalHost":{"token":"[redacted]"}}',
    );
  });

  it("collects secret-looking environment values, and leaves ordinary ones alone", () => {
    const secrets = secretsFromEnv({
      DATABASE_URL: "postgresql://u:p@host:5432/db",
      DATABASE_PUBLIC_URL: "postgresql://u:p@proxy:1/db",
      SESSION_SECRET: "long-enough-session-secret",
      RESEND_API_KEY: "re_1234567890",
      ADMIN_PASSWORD: "hunter2hunter2",
      PUBLIC_BASE_URL: "https://etviafidei.com",
      SHORT_TOKEN: "abc",
      HOME: "/Users/op",
    });
    expect(secrets).toEqual(
      expect.arrayContaining([
        "postgresql://u:p@host:5432/db",
        "postgresql://u:p@proxy:1/db",
        "long-enough-session-secret",
        "re_1234567890",
        "hunter2hunter2",
      ]),
    );
    expect(secrets).not.toContain("https://etviafidei.com");
    expect(secrets).not.toContain("abc");
    expect(secrets).not.toContain("/Users/op");
  });
});

describe("RotatingLogFile", () => {
  it("appends timestamped, tagged, redacted lines", () => {
    const file = path.join(dir, "nested", "worker-host.log");
    const log = new RotatingLogFile(file, { secrets: ["topsecretvalue"] });
    log.write("host", "starting with topsecretvalue", new Date("2026-10-31T12:00:00.000Z"));
    log.write("worker", "pass 1 done", new Date("2026-10-31T12:00:01.000Z"));
    log.close();
    expect(readFileSync(file, "utf8")).toBe(
      "2026-10-31T12:00:00.000Z [host] starting with [redacted]\n" +
        "2026-10-31T12:00:01.000Z [worker] pass 1 done\n",
    );
  });

  it("rotates at the size limit and keeps only the newest older files", () => {
    const file = path.join(dir, "worker-host.log");
    const log = new RotatingLogFile(file, { maxBytes: 2048, keep: 3 });
    for (let i = 0; i < 200; i += 1) log.write("worker", `line ${i} ${"x".repeat(80)}`);
    log.close();
    expect(existsSync(file)).toBe(true);
    for (const n of [1, 2, 3]) expect(existsSync(`${file}.${n}`)).toBe(true);
    expect(existsSync(`${file}.4`)).toBe(false);
    for (const f of [file, `${file}.1`, `${file}.2`, `${file}.3`]) {
      expect(readFileSync(f).length).toBeLessThanOrEqual(2048);
    }
    // The newest line is in the live file; the oldest survivors are in .3.
    expect(readFileSync(file, "utf8")).toContain("line 199 ");
    expect(readFileSync(`${file}.1`, "utf8")).not.toContain("line 199 ");
  });

  it("defaults to 10 MB and three older files (~40 MB at most)", () => {
    expect(HOST_LOG_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(HOST_LOG_KEEP).toBe(3);
  });

  it("never throws: an unwritable path switches the file off and says why", () => {
    const blocker = path.join(dir, "not-a-dir");
    writeFileSync(blocker, "x");
    const log = new RotatingLogFile(path.join(blocker, "worker-host.log"));
    expect(() => log.write("host", "hello")).not.toThrow();
    expect(log.failure).toBeTruthy();
    expect(() => log.write("host", "again")).not.toThrow();
  });
});

describe("teeStderrTo", () => {
  it("copies whole stderr lines into the log and can be undone", () => {
    const file = path.join(dir, "worker-host.log");
    const log = new RotatingLogFile(file);
    // Keep the test run's own stderr quiet: tee a silent stand-in.
    const realWrite = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      const undo = teeStderrTo(log);
      try {
        process.stderr.write("host-log-test: prisma:error first\nhost-log-test: sec");
        process.stderr.write("ond\n");
      } finally {
        undo();
      }
      process.stderr.write("host-log-test: after undo\n");
    } finally {
      process.stderr.write = realWrite;
    }
    log.close();
    const text = readFileSync(file, "utf8");
    expect(text).toContain("[stderr] host-log-test: prisma:error first");
    expect(text).toContain("[stderr] host-log-test: second");
    expect(text).not.toContain("after undo");
  });
});

describe("scripts/local-worker-host.ts writes it", () => {
  const src = readFileSync(path.join(process.cwd(), "scripts/local-worker-host.ts"), "utf8");

  it("logs every pushed line straight to the file, not through the console", () => {
    const push = src.slice(src.indexOf("function pushLog("), src.indexOf("function broadcast("));
    expect(push).toContain("hostLog?.write(stream, entry.line);");
  });

  it("redacts the control token and the environment's secrets, and tees stderr", () => {
    expect(src).toContain("secrets: [CONTROL_TOKEN, ...secretsFromEnv()]");
    expect(src).toContain("if (hostLog) teeStderrTo(hostLog);");
  });

  it("points operators at it from the status payload and the degraded message", () => {
    expect(src).toContain("logFile: hostLog && !hostLog.failure ? hostLog.path : null,");
    expect(src).toContain("logHint: HOST_LOG_HINT,");
  });
});
