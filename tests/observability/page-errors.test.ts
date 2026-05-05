import { describe, expect, it } from "vitest";
import { classifyPageError } from "@/lib/observability/page-errors";

describe("classifyPageError", () => {
  it("recognises a missing-table error", () => {
    expect(classifyPageError(new Error('relation "Prayer" does not exist'))).toBe("missing_table");
    expect(classifyPageError(new Error("table public.foo does not exist"))).toBe("missing_table");
  });

  it("recognises connection / pool errors", () => {
    expect(classifyPageError(new Error("ECONNREFUSED 127.0.0.1:5432"))).toBe("db_connection");
    expect(classifyPageError(new Error("ETIMEDOUT"))).toBe("db_connection");
    expect(classifyPageError(new Error("too many clients already"))).toBe("db_connection");
  });

  it("falls back to route_error for an unrecognised cause", () => {
    expect(classifyPageError(new Error("something else"))).toBe("route_error");
    expect(classifyPageError(undefined)).toBe("route_error");
  });
});
