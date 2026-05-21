import { describe, expect, it } from "vitest";
import { ReportBuilder, type ReportMasthead } from "@/lib/pdf/report";

const MASTHEAD: ReportMasthead = {
  reportTitle: "Developer Audit",
  period: "Last 24 Hours",
  generatedAt: "2026-05-21 10:00:00 UTC",
  environment: "production",
  appName: "Via Fidei",
  dashboardSection: "Admin · Diagnostics",
  reportVersion: "1.0",
};

/** A PDF content stream stores show-text as ASCII inside `( ) Tj`. */
function pdfText(buffer: Buffer): string {
  return buffer.toString("latin1");
}

function sampleReport(): ReportBuilder {
  const report = new ReportBuilder(MASTHEAD);
  report.section("Summary", "Section 1");
  report.paragraph("Headline status for the selected period.");
  report.statusLine("Overall status", "warn");
  report.keyValue([
    { label: "Failing diagnostics", value: "2" },
    { label: "Warnings", value: "1" },
  ]);
  report.section("Diagnostics Results", "Section 2");
  report.statusLine("Queue health", "pass");
  report.statusLine("Worker health", "fail");
  report.section("System Logs", "Section 3");
  report.subsection("Queue job logs");
  report.note("No logs found for this period");
  report.subsection("Security event logs");
  report.table(
    [
      { header: "Timestamp", weight: 2 },
      { header: "Severity", weight: 1 },
      { header: "Event", weight: 3 },
    ],
    [["2026-05-21 09:00:00 UTC", { badge: "error" }, "admin_login_failed"]],
  );
  return report;
}

describe("ReportBuilder — Developer Audit PDF engine", () => {
  it("produces a structurally valid PDF document", () => {
    const buffer = sampleReport().build();
    expect(buffer.length).toBeGreaterThan(500);
    const text = pdfText(buffer);
    expect(text.startsWith("%PDF-1.")).toBe(true);
    expect(text).toContain("%%EOF");
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("xref");
  });

  it("places a table of contents on the first page", () => {
    const text = pdfText(sampleReport().build());
    expect(text).toContain("Table of Contents");
  });

  it("renders the report masthead header fields", () => {
    const text = pdfText(sampleReport().build());
    expect(text).toContain("Developer Audit");
    expect(text).toContain("Last 24 Hours");
    expect(text).toContain("production");
    expect(text).toContain("1.0");
  });

  it("renders every section title", () => {
    const text = pdfText(sampleReport().build());
    expect(text).toContain("Summary");
    expect(text).toContain("Diagnostics Results");
    expect(text).toContain("System Logs");
  });

  it("renders status badges colour-matched to the admin UI", () => {
    const text = pdfText(sampleReport().build());
    expect(text).toContain("PASS");
    expect(text).toContain("WARN");
    expect(text).toContain("FAIL");
    expect(text).toContain("ERROR");
  });

  it("marks empty subsections with the no-logs note", () => {
    const text = pdfText(sampleReport().build());
    expect(text).toContain("No logs found for this period");
  });

  it("numbers pages and flows long content across many pages", () => {
    const report = new ReportBuilder(MASTHEAD);
    report.section("Long Section");
    for (let i = 0; i < 250; i++) {
      report.paragraph(`Entry ${i}: a deliberately long paragraph of audit detail. `.repeat(4));
    }
    const text = pdfText(report.build());
    const pageObjects = text.match(/\/Type \/Page /g) ?? [];
    expect(pageObjects.length).toBeGreaterThan(1);
    expect(text).toContain("Page 1 of ");
  });

  it("repeats the header row when a table spans pages", () => {
    const report = new ReportBuilder(MASTHEAD);
    report.section("Big Table");
    const rows = Array.from({ length: 120 }, (_, i) => [
      `2026-05-21 ${String(i).padStart(2, "0")}:00:00 UTC`,
      "log entry summary text",
    ]);
    report.table(
      [
        { header: "When", weight: 1 },
        { header: "Detail", weight: 2 },
      ],
      rows,
    );
    const text = pdfText(report.build());
    // The uppercased table header appears once per page it spans.
    expect((text.match(/\(WHEN\) Tj/g) ?? []).length).toBeGreaterThan(1);
  });

  it("exposes the table-of-contents entry count", () => {
    const report = sampleReport();
    // 3 sections + 2 subsections.
    expect(report.sectionCount).toBe(5);
  });
});
