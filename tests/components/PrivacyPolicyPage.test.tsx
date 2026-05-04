/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub the i18n server side translator so this component renders without
// next/headers.
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({
    t: (key: string) => key,
    locale: "en",
    dict: {},
  }),
}));

import PrivacyPolicyPage from "@/app/privacy/page";

describe("Privacy policy page", () => {
  it("renders publicly with the Via Fidei layout", async () => {
    const ui = await PrivacyPolicyPage();
    render(ui);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    // The page renders the Via Fidei brand and the privacy headings.
    expect(screen.getByText("Via Fidei")).toBeInTheDocument();
    expect(screen.getByText("privacy.title")).toBeInTheDocument();
  });

  it("includes the cross logo", async () => {
    const ui = await PrivacyPolicyPage();
    const { container } = render(ui);
    expect(container.querySelector('svg[aria-label="Via Fidei"]')).toBeInTheDocument();
  });
});
