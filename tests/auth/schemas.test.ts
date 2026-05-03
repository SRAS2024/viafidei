import { describe, expect, it } from "vitest";
import { adminLoginSchema, loginSchema, registerSchema } from "@/lib/auth/schemas";

describe("registerSchema", () => {
  const valid = {
    firstName: "Pio",
    lastName: "Pietrelcina",
    email: "padre@example.com",
    password: "stigmata-1918!",
    passwordConfirm: "stigmata-1918!",
  };

  it("accepts a well-formed registration payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({ ...valid, passwordConfirm: "different-1234!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("passwordConfirm"))).toBe(true);
    }
  });

  it("rejects passwords shorter than 12 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "short",
      passwordConfirm: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty first or last name", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, lastName: "" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("adminLoginSchema", () => {
  it("accepts a non-empty username + password", () => {
    expect(adminLoginSchema.safeParse({ username: "admin", password: "x" }).success).toBe(true);
  });

  it("rejects empty fields", () => {
    expect(adminLoginSchema.safeParse({ username: "", password: "x" }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ username: "a", password: "" }).success).toBe(false);
  });
});
