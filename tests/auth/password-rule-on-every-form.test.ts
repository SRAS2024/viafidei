/**
 * Regression: the password rule is enforced on every password form.
 *
 * The spec lists three forms that MUST display + enforce the rule:
 *   1. Account creation (register form).
 *   2. Password reset.
 *   3. Password change (admin-set or self-service).
 *
 * Each form must import `PASSWORD_MIN_LENGTH` (or use the
 * centralized `checkPasswordStrength` helper) — the rule must not be
 * inlined locally. This audit fails the moment a new form skips the
 * centralized rule.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REGISTER_FORM = join(process.cwd(), "src", "app", "register", "RegisterForm.tsx");
const RESET_FORM = join(process.cwd(), "src", "app", "reset-password", "ResetPasswordForm.tsx");

describe("password rule is enforced on every password form", () => {
  it("RegisterForm imports the centralized password rule", () => {
    const src = readFileSync(REGISTER_FORM, "utf8");
    expect(src).toMatch(/from\s+["']@\/lib\/auth\/schemas["']/);
    expect(src).toMatch(/PASSWORD_MIN_LENGTH|checkPasswordStrength/);
  });

  it("ResetPasswordForm imports the centralized password rule", () => {
    const src = readFileSync(RESET_FORM, "utf8");
    expect(src).toMatch(/from\s+["']@\/lib\/auth\/schemas["']/);
    expect(src).toMatch(/PASSWORD_MIN_LENGTH|checkPasswordStrength/);
  });

  it("no form inlines the password rule (no hardcoded `>= 12` checks)", () => {
    // We allow the schema module to declare PASSWORD_MIN_LENGTH = 12.
    // Other forms must use the imported constant rather than a magic
    // number.
    const files = [REGISTER_FORM, RESET_FORM];
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      const inlineCheck = /\blength\s*[<>]=?\s*12\b/.test(src);
      if (inlineCheck) {
        throw new Error(
          `${path.replace(process.cwd(), "")}: password length is hardcoded — use PASSWORD_MIN_LENGTH instead`,
        );
      }
    }
  });
});
