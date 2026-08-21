/**
 * Operator file extraction (spec §13).
 *
 * Pins: type detection from magic bytes and extension, text extraction for
 * every supported format, and the safety ceilings — oversized files, empty
 * files, malformed documents, and macro-bearing office documents are handled
 * as DATA, never executed.
 */
import { deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  detectFileKind,
  extractFile,
  parseDelimited,
  MAX_FILE_BYTES,
} from "@/lib/admin-worker/file-extractors";

/** Build a minimal ZIP (stored or deflated) the bounded reader understands. */
function makeZip(
  entries: Array<{ name: string; content: string; deflate?: boolean; streamed?: boolean }>,
): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const raw = Buffer.from(entry.content, "utf8");
    const data = entry.deflate ? deflateRawSync(raw) : raw;
    const name = Buffer.from(entry.name, "utf8");
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version
    // Bit 3 = sizes deferred to a trailing data descriptor, which is how many
    // real-world writers emit .docx/.xlsx.
    header.writeUInt16LE(entry.streamed ? 0x8 : 0, 6);
    header.writeUInt16LE(entry.deflate ? 8 : 0, 8); // method
    header.writeUInt32LE(0, 14); // crc (unchecked by the reader)
    header.writeUInt32LE(entry.streamed ? 0 : data.length, 18);
    header.writeUInt32LE(entry.streamed ? 0 : raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    parts.push(header, name, data);
    if (entry.streamed) {
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0); // descriptor signature
      descriptor.writeUInt32LE(0, 4); // crc
      descriptor.writeUInt32LE(data.length, 8);
      descriptor.writeUInt32LE(raw.length, 12);
      parts.push(descriptor);
    }
  }
  return Buffer.concat(parts);
}

describe("detectFileKind", () => {
  it("prefers magic bytes over the extension", () => {
    expect(detectFileKind("notes.txt", Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    expect(detectFileKind("data.txt", Buffer.from('{"a":1}'))).toBe("json");
    expect(detectFileKind("page.txt", Buffer.from("<!doctype html><html></html>"))).toBe("html");
  });

  it("falls back to the extension for plain formats", () => {
    expect(detectFileKind("notes.md", Buffer.from("# Title"))).toBe("markdown");
    expect(detectFileKind("rows.csv", Buffer.from("a,b\n1,2"))).toBe("csv");
  });
});

describe("extractFile", () => {
  const prose =
    "The Angelus is a Catholic devotion commemorating the Incarnation. " +
    "It is prayed three times each day, at morning, noon and evening, in many dioceses.";

  it("reads plain text and markdown, keeping headings", () => {
    const md = extractFile("angelus.md", Buffer.from(`# The Angelus\n\n${prose}\n\n## History\n`));
    expect(md.ok).toBe(true);
    expect(md.kind).toBe("markdown");
    expect(md.title).toBe("The Angelus");
    expect(md.headings).toContain("History");
  });

  it("strips scripts from HTML and records that it did", () => {
    const html = `<html><head><title>The Angelus</title></head><body>
      <h1>The Angelus</h1><script>fetch("https://evil.example")</script><p>${prose}</p></body></html>`;
    const out = extractFile("angelus.html", Buffer.from(html));
    expect(out.ok).toBe(true);
    expect(out.title).toBe("The Angelus");
    expect(out.text).not.toContain("evil.example");
    expect(out.safetyNotes.join(" ")).toMatch(/never executed/i);
  });

  it("flattens JSON into readable lines and keeps the parsed object", () => {
    const out = extractFile(
      "prayer.json",
      Buffer.from(JSON.stringify({ title: "The Angelus", body: prose, tags: ["marian"] })),
    );
    expect(out.ok).toBe(true);
    expect(out.title).toBe("The Angelus");
    expect(out.text).toContain("body: ");
    expect((out.data as { tags: string[] }).tags).toEqual(["marian"]);
  });

  it("ingests malformed JSON as plain text rather than failing", () => {
    const out = extractFile("broken.json", Buffer.from(`{"title": "The Angelus", ${prose}`));
    expect(out.kind).toBe("json");
    expect(out.note ?? "").toMatch(/malformed JSON/i);
    expect(out.text).toContain("Angelus");
  });

  it("parses CSV with quoted fields", () => {
    const rows = parseDelimited('name,note\n"Angelus, the","three times, daily"\n', ",");
    expect(rows[1]).toEqual(["Angelus, the", "three times, daily"]);
  });

  it("reads a DOCX-shaped ZIP and reports macros without running them", () => {
    const zip = makeZip([
      { name: "word/vbaProject.bin", content: "not executed", deflate: false },
      {
        name: "word/document.xml",
        content: `<?xml version="1.0"?><w:document><w:p>${prose}</w:p></w:document>`,
        deflate: true,
      },
    ]);
    const out = extractFile("letter.docx", zip);
    expect(out.kind).toBe("docx");
    expect(out.ok).toBe(true);
    expect(out.text).toContain("Angelus");
    expect(out.safetyNotes.join(" ")).toMatch(/macros/i);
  });

  it("reads an office document whose ZIP defers its sizes to a data descriptor", () => {
    // The regression this pins: streamed members were skipped outright, so a
    // perfectly valid .docx from a streaming writer extracted to zero text and
    // was reported unreadable.
    const zip = makeZip([
      {
        name: "word/document.xml",
        content: `<?xml version="1.0"?><w:document><w:p>${prose}</w:p></w:document>`,
        deflate: true,
        streamed: true,
      },
    ]);
    const out = extractFile("streamed.docx", zip);
    expect(out.kind).toBe("docx");
    expect(out.ok).toBe(true);
    expect(out.text).toContain("Angelus");
  });

  it("refuses empty and oversized files", () => {
    expect(extractFile("empty.txt", Buffer.alloc(0)).ok).toBe(false);
    const huge = { length: MAX_FILE_BYTES + 1 } as unknown as Buffer;
    const out = extractFile("huge.txt", huge);
    expect(out.ok).toBe(false);
    expect(out.note ?? "").toMatch(/ingestion limit/i);
  });

  it("reports an unsupported binary rather than emitting noise", () => {
    const out = extractFile("thing.bin", Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]));
    expect(out.ok).toBe(false);
    expect(out.kind).toBe("unsupported");
  });
});
