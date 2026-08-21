/**
 * Local resource intelligence (spec §20).
 *
 * The Admin Worker now runs on the operator's MacBook, so the command center
 * must show what the machine is actually doing: how much memory and CPU the
 * worker is using, how many retrieval jobs are in flight, whether Chromium is
 * rendering, whether the Python brain is up, and how long the worker has been
 * on. Everything here is read from the local process and the OS — no new
 * dependency, no new environment variable, and nothing that reaches the server.
 *
 * The worker is allowed to use the machine aggressively, but responsibly:
 * `recommendedConcurrency()` derives a sane parallelism ceiling from the real
 * core count and free memory rather than reserving RAM just because it exists.
 */

import { cpus, freemem, loadavg, totalmem } from "node:os";

export interface LocalResourceSample {
  /** Wall-clock ms since the local runtime started. */
  uptimeMs: number;
  /** Resident set size of the supervising process (bytes). */
  processRssBytes: number;
  /** Heap actually in use by the supervising process (bytes). */
  processHeapUsedBytes: number;
  /** Resident set size of the supervised worker child, when known (bytes). */
  workerRssBytes: number | null;
  /** Rough CPU percentage used by this process since the previous sample. */
  processCpuPercent: number;
  /** 1-minute system load average normalised to a percentage of all cores. */
  systemLoadPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  cpuCount: number;
  /** Concurrency ceiling the worker should respect on this machine. */
  recommendedConcurrency: number;
}

let lastCpuUsage = process.cpuUsage();
let lastCpuSampleAt = Date.now();
const startedAt = Date.now();

/**
 * Concurrency ceiling for local retrieval work. Uses at most half the cores
 * (leaving the machine responsive for its human owner), never fewer than 2,
 * and backs off when free memory is tight.
 */
export function recommendedConcurrency(): number {
  const cores = Math.max(1, cpus().length);
  const byCores = Math.max(2, Math.floor(cores / 2));
  const freeGb = freemem() / 1_073_741_824;
  const byMemory = freeGb < 1 ? 1 : freeGb < 2 ? 2 : freeGb < 4 ? 4 : byCores;
  return Math.min(byCores, byMemory);
}

/** Sample the local machine + this process. Cheap enough to poll once a second. */
export function sampleLocalResources(workerRssBytes: number | null = null): LocalResourceSample {
  const now = Date.now();
  const usage = process.cpuUsage(lastCpuUsage);
  const elapsedMs = Math.max(1, now - lastCpuSampleAt);
  lastCpuUsage = process.cpuUsage();
  lastCpuSampleAt = now;

  const cpuMs = (usage.user + usage.system) / 1000;
  const processCpuPercent = Math.min(100 * Math.max(1, cpus().length), (cpuMs / elapsedMs) * 100);

  const mem = process.memoryUsage();
  const cores = Math.max(1, cpus().length);
  const load1 = loadavg()[0] ?? 0;

  return {
    uptimeMs: now - startedAt,
    processRssBytes: mem.rss,
    processHeapUsedBytes: mem.heapUsed,
    workerRssBytes,
    processCpuPercent: Number(processCpuPercent.toFixed(1)),
    systemLoadPercent: Number(Math.min(100, (load1 / cores) * 100).toFixed(1)),
    totalMemoryBytes: totalmem(),
    freeMemoryBytes: freemem(),
    cpuCount: cores,
    recommendedConcurrency: recommendedConcurrency(),
  };
}

/** Non-sensitive host label recorded with the execution lease (spec §23). */
export function localHostLabel(): string {
  const model = cpus()[0]?.model ?? "";
  const chip = /Apple\s+(M\d[^ ]*)/i.exec(model)?.[1];
  return `${process.platform === "darwin" ? "Mac" : process.platform} · ${chip ?? process.arch} · ${Math.max(1, cpus().length)} cores`;
}
