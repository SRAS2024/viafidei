import { describe, expect, it } from "vitest";
import {
  adminLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  passwordSchema,
  checkPasswordStrength,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE_MESSAGE,
} from "@/lib/auth/schemas";

describe("passwordSchema — 12 chars + upper + lower + digit + special", () => {
  it("accepts a strong password meeting every rule", () => {
    expect(passwordSchema.safeParse("Stigm4tica!Pad").success).toBe(true);
  });

  it("rejects a password shorter than 12 characters", () => {
    expect(passwordSchema.safeParse("Aa1!short").success).toBe(false);
  });

  it("rejects a password missing a number", () => {
    expect(passwordSchema.safeParse("PadreAlbino!ee").success).toBe(false);
  });

  it("rejects a password missing an uppercase letter", () => {
    expect(passwordSchema.safeParse("padrealb1no!!!").success).toBe(false);
  });

  it("rejects a password missing a lowercase letter", () => {
    expect(passwordSchema.safeParse("PADREALB1NO!!!").success).toBe(false);
  });

  it("rejects a password missing a special character", () => {
    expect(passwordSchema.safeParse("PadreAlb1noXYZ").success).toBe(false);
  });

  it("PASSWORD_MIN_LENGTH is 12", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });
});

describe("checkPasswordStrength", () => {
  it("returns null for a strong password", () => {
    expect(checkPasswordStrength("Stigm4tica!Pad")).toBeNull();
  });

  it("returns the rule message when too short", () => {
    expect(checkPasswordStrength("Aa1!short")).toBe(PASSWORD_RULE_MESSAGE);
  });

  it("returns the rule message when missing a special character", () => {
    expect(checkPasswordStrength("PadreAlb1noXYZ")).toBe(PASSWORD_RULE_MESSAGE);
  });

  it("returns the rule message when missing an uppercase letter", () => {
    expect(checkPasswordStrength("padrealb1no!!!")).toBe(PASSWORD_RULE_MESSAGE);
  });

  it("returns the rule message when missing a lowercase letter", () => {
    expect(checkPasswordStrength("PADREALB1NO!!!")).toBe(PASSWORD_RULE_MESSAGE);
  });

  it("returns the rule message when missing a number", () => {
    expect(checkPasswordStrength("PadreAlbino!ee")).toBe(PASSWORD_RULE_MESSAGE);
  });

  it("rule message contains every advertised constraint", () => {
    expect(PASSWORD_RULE_MESSAGE).toMatch(/12 characters/);
    expect(PASSWORD_RULE_MESSAGE).toMatch(/uppercase letter/);
    expect(PASSWORD_RULE_MESSAGE).toMatch(/lowercase letter/);
    expect(PASSWORD_RULE_MESSAGE).toMatch(/number/);
    expect(PASSWORD_RULE_MESSAGE).toMatch(/special character/);
  });
});

describe("registerSchema", () => {
  const valid = {
    firstName: "Pio",
    lastName: "Pietrelcina",
    email: "padre@example.com",
    password: "Stigm4tica!Pad",
    passwordConfirm: "Stigm4tica!Pad",
  };

  it("accepts a well-formed registration payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({ ...valid, passwordConfirm: "Different1!Pad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("passwordConfirm"))).toBe(true);
    }
  });

  it("rejects passwords shorter than 12 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "Aa1!short",
      passwordConfirm: "Aa1!short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a number", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "PadreAlbino!ee",
      passwordConfirm: "PadreAlbino!ee",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without an uppercase letter", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "padrealb1no!!!",
      passwordConfirm: "padrealb1no!!!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a lowercase letter", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "PADREALB1NO!!!",
      passwordConfirm: "PADREALB1NO!!!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a special character", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "PadreAlb1noXYZ",
      passwordConfirm: "PadreAlb1noXYZ",
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
      password: "Newp4ss!word!",
      passwordConfirm: "Newp4ss!word!",
    });
    expect(r.success).toBe(true);
  });
  it("rejects mismatched confirm", () => {
    const r = resetPasswordSchema.safeParse({
      token: validToken,
      password: "Newp4ss!word!",
      passwordConfirm: "Newp4XX!word!",
    });
    expect(r.success).toBe(false);
  });
  it("rejects weak password (no special character)", () => {
    const r = resetPasswordSchema.safeParse({
      token: validToken,
      password: "Newp4ssword12",
      passwordConfirm: "Newp4ssword12",
    });
    expect(r.success).toBe(false);
  });
  it("rejects weak password (too short)", () => {
    const r = resetPasswordSchema.safeParse({
      token: validToken,
      password: "Aa1!short",
      passwordConfirm: "Aa1!short",
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
