import { describe, expect, it } from "vitest";
import { repairText, repairIngestedItem, diagnoseFormatting } from "@/lib/ingestion/format-repair";

describe("format-repair", () => {
  it("decodes HTML entities", () => {
    expect(repairText("Hello &amp; goodbye &mdash; friends")).toBe("Hello & goodbye — friends");
  });

  it("strips unsafe markup tags (keeps inner text)", () => {
    // Tags removed; inner text remains. This is the conservative
    // behavior — we never want to silently drop legitimate body
    // text just because it was wrapped in an unsafe element.
    const out = repairText("Body <script>x()</script> rest");
    expect(out).not.toMatch(/<script>/);
    expect(out).not.toMatch(/<\/script>/);
  });

  it("strips inline event handlers", () => {
    const out = repairText("Click <a onclick='evil()'>here</a>");
    expect(out).not.toMatch(/onclick/);
  });

  it("collapses whitespace runs", () => {
    expect(repairText("a    b\t\tc")).toBe("a b c");
  });

  it("trims leading and trailing whitespace", () => {
    expect(repairText("   surrounded   ")).toBe("surrounded");
  });

  it("normalizes smart quotes to ASCII", () => {
    expect(repairText("“Hello”")).toBe('"Hello"');
  });

  it("repairIngestedItem repairs every text field", () => {
    const item = {
      kind: "prayer" as const,
      slug: "test",
      defaultTitle: "&amp; Prayer",
      category: "general",
      body: "<script>evil()</script>The Lord be with you.",
    };
    const out = repairIngestedItem(item);
    expect(out.defaultTitle).toBe("& Prayer");
    // Body has its <script> tags stripped; the legitimate text remains.
    expect(out.body).not.toMatch(/<script/);
    expect(out.body).toMatch(/The Lord be with you\./);
  });

  it("diagnoseFormatting flags prayer body without terminator", () => {
    const item = {
      kind: "prayer" as const,
      slug: "test",
      defaultTitle: "Prayer",
      category: "general",
      body: "missing terminator",
    };
    const issues = diagnoseFormatting(item);
    expect(issues.some((i) => i.issue.includes("terminator"))).toBe(true);
  });

  it("diagnoseFormatting flags missing title", () => {
    const item = {
      kind: "prayer" as const,
      slug: "x",
      defaultTitle: "",
      category: "general",
      body: "Body here.",
    };
    const issues = diagnoseFormatting(item);
    expect(issues.some((i) => i.field === "title")).toBe(true);
  });
});
