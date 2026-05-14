import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/observability/logger";

// The logger emits to console.log / console.error depending on level; spy
// on both so we can assert the shape of each line regardless of which
// stream it landed on.
type Spies = { log: ReturnType<typeof vi.spyOn>; err: ReturnType<typeof vi.spyOn> };

function spyOnConsole(): Spies {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    err: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}

function lastLine(spies: Spies): string {
  const calls = [...spies.log.mock.calls, ...spies.err.mock.calls];
  const last = calls[calls.length - 1];
  expect(last).toBeTruthy();
  return String(last?.[0] ?? "");
}

describe("logger", () => {
  let spies: Spies;

  beforeEach(() => {
    spies = spyOnConsole();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits valid JSON with level, time, and msg fields for info()", () => {
    logger.info("hello", { foo: "bar" });
    const entry = JSON.parse(lastLine(spies));
    expect(entry.level).toBe("info");
    expect(entry.msg).toBe("hello");
    expect(entry.foo).toBe("bar");
    expect(typeof entry.time).toBe("string");
    expect(new Date(entry.time).toString()).not.toBe("Invalid Date");
  });

  it("routes warn() and error() through console.error", () => {
    logger.warn("wat");
    logger.error("oops");
    expect(spies.err.mock.calls.length).toBeGreaterThanOrEqual(2);
    const warnEntry = JSON.parse(String(spies.err.mock.calls[0][0]));
    const errEntry = JSON.parse(String(spies.err.mock.calls[1][0]));
    expect(warnEntry.level).toBe("warn");
    expect(errEntry.level).toBe("error");
  });

  it("serializes Error instances into { name, message, stack }", () => {
    const err = new Error("boom");
    logger.error("explosion", { error: err });
    const entry = JSON.parse(lastLine(spies));
    expect(entry.error).toMatchObject({
      name: "Error",
      message: "boom",
    });
    expect(typeof entry.error.stack).toBe("string");
  });

  it("preserves non-Error values via the { value } shape", () => {
    logger.error("hmm", { error: "raw string" });
    const entry = JSON.parse(lastLine(spies));
    expect(entry.error).toEqual({ value: "raw string" });
  });

  it("child() bindings are merged into every line and overridden by per-call fields", () => {
    const child = logger.child({ requestId: "req-1", route: "/x" });
    child.info("first", { route: "/y" });
    const entry = JSON.parse(lastLine(spies));
    expect(entry.requestId).toBe("req-1");
    expect(entry.route).toBe("/y"); // per-call override beats binding
    expect(entry.msg).toBe("first");
  });

  it("never throws when passed odd field types", () => {
    expect(() =>
      logger.info("complex", {
        nested: { a: { b: { c: 1 } } },
        list: [1, 2, 3],
        bool: true,
        nullish: null,
      }),
    ).not.toThrow();
    const entry = JSON.parse(lastLine(spies));
    expect(entry.nested.a.b.c).toBe(1);
    expect(entry.list).toEqual([1, 2, 3]);
  });
});
