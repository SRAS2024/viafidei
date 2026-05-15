import { describe, expect, it } from "vitest";
import {
  CONTENT_TYPE_ROWS,
  formatAdded,
  formatDeleted,
  formatPlain,
  renderAdminEmail,
} from "@/lib/email/admin-templates";

describe("formatAdded / formatDeleted / formatPlain", () => {
  it("renders zero as just '0'", () => {
    expect(formatAdded(0)).toBe("0");
    expect(formatDeleted(0)).toBe("0");
    expect(formatPlain(0)).toBe("0");
  });

  it("renders positive added counts with a leading +", () => {
    expect(formatAdded(1)).toBe("+1");
    expect(formatAdded(42)).toBe("+42");
  });

  it("renders positive deleted counts with a leading -", () => {
    expect(formatDeleted(1)).toBe("-1");
    expect(formatDeleted(42)).toBe("-42");
  });

  it("renders positive plain counts as bare numbers", () => {
    expect(formatPlain(7)).toBe("7");
  });

  it("treats negative or NaN inputs as zero", () => {
    expect(formatAdded(-3)).toBe("0");
    expect(formatDeleted(-3)).toBe("0");
    expect(formatPlain(Number.NaN)).toBe("0");
  });
});

describe("renderAdminEmail", () => {
  it("greets the recipient as 'Admin' (not by name)", () => {
    const result = renderAdminEmail({
      subject: "Biweekly Admin Report",
      heading: "Biweekly Admin Report",
      intro: "Two weeks of activity.",
    });
    expect(result.subject).toBe("Biweekly Admin Report");
    expect(result.htmlBody).toContain("Admin,");
    expect(result.textBody).toContain("Admin,");
    // Should never embed user-style placeholders.
    expect(result.htmlBody).not.toContain("{name}");
    expect(result.textBody).not.toContain("{name}");
  });

  it("renders a structured table inside the body", () => {
    const result = renderAdminEmail({
      subject: "Test Report",
      heading: "Test Report",
      intro: "intro",
      sections: [
        {
          title: "Content Management Report",
          table: {
            columns: [
              { key: "content", label: "Content" },
              { key: "added", label: "Added", align: "right" },
            ],
            rows: [
              { content: "Prayer", added: "+5" },
              { content: "Saint", added: "0" },
            ],
          },
        },
      ],
    });
    expect(result.htmlBody).toContain("Content Management Report");
    expect(result.htmlBody).toContain("Prayer");
    expect(result.htmlBody).toContain("+5");
    expect(result.htmlBody).toContain("Saint");
    expect(result.textBody).toContain("Prayer");
    expect(result.textBody).toContain("+5");
  });

  it("escapes HTML so user-supplied strings cannot inject markup", () => {
    const result = renderAdminEmail({
      subject: "Critical Failure",
      heading: "Critical Failure",
      intro: "<script>alert(1)</script>",
    });
    expect(result.htmlBody).not.toContain("<script>alert(1)</script>");
    expect(result.htmlBody).toContain("&lt;script&gt;");
  });
});

describe("CONTENT_TYPE_ROWS", () => {
  it("includes every tracked content type", () => {
    const keys = CONTENT_TYPE_ROWS.map((r) => r.key);
    expect(keys).toEqual([
      "Prayer",
      "Saint",
      "MarianApparition",
      "Devotion",
      "LiturgyEntry",
      "SpiritualLifeGuide",
      "Parish",
    ]);
  });
});
