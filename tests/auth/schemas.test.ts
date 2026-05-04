import { describe, expect, it } from "vitest";
import {
  adminLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  passwordSchema,
} from "@/lib/auth/schemas";

describe("passwordSchema", () => {
  it("accepts a 5+ char password with a number and a capital", () => {
    expect(passwordSchema.safeParse("Pio12").success).toBe(true);
  });

  it("rejects a password shorter than 5 characters", () => {
    expect(passwordSchema.safeParse("A1b").success).toBe(false);
  });

  it("rejects a password missing a number", () => {
    expect(passwordSchema.safeParse("Padre").success).toBe(false);
  });

  it("rejects a password missing a capital letter", () => {
    expect(passwordSchema.safeParse("padre1").success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    firstName: "Pio",
    lastName: "Pietrelcina",
    email: "padre@example.com",
    password: "Stigm1ata",
    passwordConfirm: "Stigm1ata",
  };

  it("accepts a well-formed registration payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({ ...valid, passwordConfirm: "Different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("passwordConfirm"))).toBe(true);
    }
  });

  it("rejects passwords shorter than 5 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "Aa1",
      passwordConfirm: "Aa1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a number", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "Padre",
      passwordConfirm: "Padre",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a capital letter", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "padre1",
      passwordConfirm: "padre1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty first or last name", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, lastName: "" }).success).toBe(false);
  });

  it("optionally accepts a language code", () => {
    const result = registerSchema.safeParse({ ...valid, language: "es" });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  const validToken = "a".repeat(40);
  it("accepts strong password with matching confirm", () => {
    const r = resetPasswordSchema.safeParse({
      token: validToken,
      password: "Newp4ss",
      passwordConfirm: "Newp4ss",
    });
    expect(r.success).toBe(true);
  });
  it("rejects mismatched confirm", () => {
    const r = resetPasswordSchema.safeParse({
      token: validToken,
      password: "Newp4ss",
      passwordConfirm: "Newp4XX",
    });
    expect(r.success).toBe(false);
  });
  it("rejects weak password", () => {
    const r = resetPasswordSchema.safeParse({
      token: validToken,
      password: "weak",
      passwordConfirm: "weak",
    });
    expect(r.success).toBe(false);
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
