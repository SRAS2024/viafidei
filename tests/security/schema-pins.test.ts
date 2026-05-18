/**
 * SecurityEvent + BannedDevice schema pins.
 *
 * The spec lists exact field sets. These tests parse the Prisma
 * schema and assert every spec-required field is declared on the
 * model so a future migration cannot silently drop a column.
 *
 * SourceDocument is checked elsewhere (factory-bypass-audit) — this
 * file pins the security-table fields.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

function modelBlock(name: string): string {
  const re = new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const match = re.exec(SCHEMA);
  if (!match) throw new Error(`model ${name} not found in schema`);
  return match[1]!;
}

const SECURITY_EVENT_REQUIRED = [
  "eventType",
  "severity",
  "classification",
  "ipAddressHash",
  "deviceCredentialHash",
  "userAgent",
  "city",
  "region",
  "country",
  "targetRoute",
  "httpMethod",
  "attemptedAction",
  "accountId",
  "adminAccount",
  "requestId",
  "createdAt",
  "automaticActionTaken",
  "emailSent",
  "banTokenIssued",
];

const BANNED_DEVICE_REQUIRED = [
  "deviceCredentialHash",
  "ipAddressHash",
  "userAgentHash",
  "firstSeenAt",
  "lastSeenAt",
  "banReason",
  "securityEventId",
  "createdAt",
  "createdBy",
  "active",
];

describe("SecurityEvent — every spec field is declared", () => {
  const body = modelBlock("SecurityEvent");

  for (const field of SECURITY_EVENT_REQUIRED) {
    it(`declares ${field}`, () => {
      // Match the field at the start of a line (possibly with leading whitespace).
      const re = new RegExp(`^\\s+${field}\\b`, "m");
      expect(re.test(body)).toBe(true);
    });
  }

  it("classification is constrained to 'Suspicious' or 'Breach' via the data-layer type", async () => {
    const { isClassification } = await import("@/lib/security/security-event-store");
    expect(isClassification("Suspicious")).toBe(true);
    expect(isClassification("Breach")).toBe(true);
    expect(isClassification("Other")).toBe(false);
  });
});

describe("BannedDevice — every spec field is declared", () => {
  const body = modelBlock("BannedDevice");

  for (const field of BANNED_DEVICE_REQUIRED) {
    it(`declares ${field}`, () => {
      const re = new RegExp(`^\\s+${field}\\b`, "m");
      expect(re.test(body)).toBe(true);
    });
  }

  it("deviceCredentialHash is the unique key (prevents duplicate ban rows)", () => {
    expect(body).toMatch(/@@unique\(\[deviceCredentialHash\]\)/);
  });

  it("active flag is indexed (banned-device middleware queries on it)", () => {
    expect(body).toMatch(/@@index\(\[active\]\)/);
  });
});

describe("Session.deviceCredentialHash supports ban-link session revocation", () => {
  const body = modelBlock("Session");

  it("Session declares deviceCredentialHash", () => {
    expect(/^\s+deviceCredentialHash\b/m.test(body)).toBe(true);
  });

  it("Session.deviceCredentialHash is indexed (used in DELETE WHERE on ban)", () => {
    expect(body).toMatch(/@@index\(\[deviceCredentialHash\]\)/);
  });
});

describe("SourceDocument — every spec-required field is declared", () => {
  const body = modelBlock("SourceDocument");

  const SOURCE_DOCUMENT_REQUIRED = [
    // The spec lists these by readable label; map to the schema-camelCase column.
    "sourceUrl",
    "sourceHost",
    "sourceTitle",
    "rawBody",
    "cleanedBody",
    "headingsJson",
    "paragraphsJson",
    "listsJson",
    "tablesJson",
    "linksJson",
    "metadataJson",
    "sourceTier",
    "sourcePurposesJson",
    "fetchStatus",
    "httpStatus",
    "etag",
    "lastModifiedHeader",
    // Schema uses contentChecksum for the raw body checksum + a
    // separate cleanedChecksum. Both spec fields are covered.
    "contentChecksum",
    "cleanedChecksum",
    "workerJobId",
    "ingestionBatchId",
  ];

  for (const field of SOURCE_DOCUMENT_REQUIRED) {
    it(`declares ${field}`, () => {
      const re = new RegExp(`^\\s+${field}\\b`, "m");
      expect(re.test(body)).toBe(true);
    });
  }
});

describe("ContentPackageBuildLog — every spec-required field is declared", () => {
  const body = modelBlock("ContentPackageBuildLog");

  const BUILD_LOG_REQUIRED = [
    "sourceDocumentId",
    "sourceUrl",
    "sourceHost",
    "contentType",
    "builderName",
    "builderVersion",
    "buildStatus",
    "extractedFieldsJson",
    "missingFieldsJson",
    "failureReason",
    "candidateSlug",
    "workerJobId",
    "ingestionBatchId",
    "createdAt",
  ];

  for (const field of BUILD_LOG_REQUIRED) {
    it(`declares ${field}`, () => {
      const re = new RegExp(`^\\s+${field}\\b`, "m");
      expect(re.test(body)).toBe(true);
    });
  }
});
