import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashPassword / verifyPassword", () => {
  it("produces an argon2id hash that verifies against the original password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("returns false instead of throwing on a malformed hash", async () => {
    expect(await verifyPassword("not-an-argon2-hash", "anything")).toBe(false);
  });

  it("produces unique hashes for the same password (salted)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "same-password")).toBe(true);
    expect(await verifyPassword(b, "same-password")).toBe(true);
  });
});
