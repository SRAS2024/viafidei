import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendTransactionalEmailMock = vi.fn();
const isEmailConfiguredMock = vi.fn();

vi.mock("@/lib/email/postmark", () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendTransactionalEmailMock(...args),
  isEmailConfigured: (...args: unknown[]) => isEmailConfiguredMock(...args),
}));

import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
} from "@/lib/email/send";

beforeEach(() => {
  sendTransactionalEmailMock.mockReset();
  isEmailConfiguredMock.mockReset();
  isEmailConfiguredMock.mockReturnValue(true);
  sendTransactionalEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });
});

afterEach(() => {
  vi.useRealTimers();
});

const baseUser = {
  id: "u1",
  email: "user@example.com",
  firstName: "Maria",
  lastName: "Goretti",
  language: "en",
};

describe("sendWelcomeEmail", () => {
  it("renders both html and text bodies and dispatches via Postmark", async () => {
    const result = await sendWelcomeEmail(baseUser);
    expect(result.ok).toBe(true);
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    const call = sendTransactionalEmailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      htmlBody: string;
      textBody: string;
    };
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toBe("Welcome!");
    expect(call.htmlBody).toContain("Welcome, Maria Goretti. Account creation successful.");
    expect(call.textBody).toContain("Welcome, Maria Goretti. Account creation successful.");
  });

  it("uses the saved language for delivery", async () => {
    await sendWelcomeEmail({ ...baseUser, language: "fr" });
    const call = sendTransactionalEmailMock.mock.calls[0][0] as { htmlBody: string };
    expect(call.htmlBody).toContain("Bienvenue sur Via Fidei");
  });

  it("falls back to English for missing language", async () => {
    await sendWelcomeEmail({ ...baseUser, language: null });
    const call = sendTransactionalEmailMock.mock.calls[0][0] as { htmlBody: string };
    expect(call.htmlBody).toContain("Welcome to Via Fidei");
  });
});

describe("sendPasswordResetEmail (helper)", () => {
  it("uses the localized subject and includes the reset link", async () => {
    await sendPasswordResetEmail({
      user: baseUser,
      token: "raw-token",
      expiresAt: new Date("2099-01-01T00:00:00Z"),
    });
    const call = sendTransactionalEmailMock.mock.calls[0][0] as {
      subject: string;
      htmlBody: string;
      textBody: string;
    };
    expect(call.subject).toBe("Password Reset");
    expect(call.htmlBody).toContain("token=raw-token");
    expect(call.textBody).toContain("token=raw-token");
    expect(call.htmlBody).toContain("Reset password for Maria Goretti");
  });
});

describe("sendEmailVerificationEmail (helper)", () => {
  it("uses the localized subject and includes the verify link", async () => {
    await sendEmailVerificationEmail({
      user: { ...baseUser, language: "es" },
      token: "raw-verify",
      expiresAt: new Date("2099-01-01T00:00:00Z"),
    });
    const call = sendTransactionalEmailMock.mock.calls[0][0] as {
      htmlBody: string;
      textBody: string;
    };
    expect(call.htmlBody).toContain("token=raw-verify");
    expect(call.textBody).toContain("token=raw-verify");
    // Spanish locale should yield Spanish heading.
    expect(call.htmlBody).toMatch(/Verifica tu correo/);
  });
});
