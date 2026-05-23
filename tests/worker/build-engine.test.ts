/**
 * Tests for the build engine — extraction, reconciliation, and accuracy
 * guard pass. Uses an in-memory mock Prisma client to keep tests fast.
 */

import { describe, it, expect, vi } from "vitest";

import { extractFields } from "@/lib/worker/build/extractors";
import { reconcileFields } from "@/lib/worker/build/cross-source";
import type { ChecklistItem } from "@prisma/client";
import type { FetchedSource } from "@/lib/worker/types";

function fakeItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "ci-1",
    contentType: "PRAYER",
    canonicalName: "Our Father",
    canonicalSlug: "our-father",
    aliases: ["Lord's Prayer"],
    summary: null,
    approvalStatus: "APPROVED_FOR_BUILD",
    priority: 10,
    needsHumanReview: false,
    humanReviewReason: null,
    authorityLevelHint: "VATICAN",
    duplicateOfId: null,
    notes: null,
    metadata: null,
    discoveredAt: new Date(),
    sourceVerifiedAt: new Date(),
    approvedForBuildAt: new Date(),
    builtAt: null,
    qaPendingAt: null,
    approvedAt: null,
    rejectedAt: null,
    publishedAt: null,
    rejectedReason: null,
    publishedContentRef: null,
    approvedByUsername: null,
    rejectedByUsername: null,
    publishedByUsername: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ChecklistItem;
}

function fakeSource(
  html: string,
  host = "vatican.va",
  level: FetchedSource["authorityLevel"] = "VATICAN",
): FetchedSource {
  return {
    citationId: `c-${Math.random()}`,
    url: `https://${host}/test`,
    host,
    authorityLevel: level,
    status: 200,
    body: html,
    checksum: "abc",
    title: "Sample",
    fetchedAt: new Date(),
  };
}

describe("extractFields", () => {
  it("extracts body for a PRAYER from the longest paragraph", () => {
    const html = `
      <html><body>
        <p>Short intro.</p>
        <p>Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread.</p>
      </body></html>
    `;
    const fields = extractFields("PRAYER", fakeItem(), [fakeSource(html)]);
    expect(fields.body?.[0]?.value).toContain("Our Father");
  });

  it("extracts the feast day for a SAINT", () => {
    const html = `
      <html><body>
        <p>Saint Joseph is the foster father of Jesus.</p>
        <p>Feast Day: March 19</p>
        <p>He is patron of workers.</p>
      </body></html>
    `;
    const fields = extractFields(
      "SAINT",
      fakeItem({
        contentType: "SAINT",
        canonicalName: "Saint Joseph",
        canonicalSlug: "saint-joseph",
      }),
      [fakeSource(html)],
    );
    expect(fields.feastDay?.[0]?.value).toBe("03-19");
    expect(fields.feastMonth?.[0]?.value).toBe(3);
    expect(fields.feastDayOfMonth?.[0]?.value).toBe(19);
  });

  it("produces no candidate when no source matches the field", () => {
    const html = "<html><body></body></html>";
    const fields = extractFields("SAINT", fakeItem({ contentType: "SAINT" }), [fakeSource(html)]);
    expect(fields.feastDay).toBeUndefined();
  });
});

describe("worker accuracy guards via reconcileFields", () => {
  it("never invents an answer when there are no candidates", () => {
    const reconciled = reconcileFields({
      feastDay: [],
    });
    expect(reconciled.values.feastDay).toBeUndefined();
  });

  it("prefers the Vatican feastDay over a community-claimed one", () => {
    const reconciled = reconcileFields({
      feastDay: [
        {
          value: "01-01",
          authorityLevel: "COMMUNITY",
          sourceUrl: "https://x.example",
          sourceHost: "x.example",
        },
        {
          value: "03-19",
          authorityLevel: "VATICAN",
          sourceUrl: "https://www.vatican.va/",
          sourceHost: "vatican.va",
        },
      ],
    });
    expect(reconciled.values.feastDay).toBe("03-19");
  });
});
