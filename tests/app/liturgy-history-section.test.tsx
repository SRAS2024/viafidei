/**
 * @vitest-environment jsdom
 */
/**
 * /liturgy-history holds liturgical entries, whose list is under the Liturgy tab, and
 * Church documents, whose list is under History. Its address cannot say which a page
 * is, so the page tells the header, and a tab stays lit on all of them.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const rows = vi.hoisted(() => ({ LITURGICAL: null as unknown, CHURCH_DOCUMENT: null as unknown }));

vi.mock("@/lib/data/published", () => ({
  getPublishedBySlug: async (type: "LITURGICAL" | "CHURCH_DOCUMENT") => rows[type],
  getAnyPublishedBySlug: async () => null,
  buildPublishedMetadata: () => ({}),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/translation/localize", () => ({
  localizeItem: async <T,>(item: T) => item,
}));
vi.mock("@/components/ui", () => ({
  PublishedDetail: ({ item }: { item: { title: string } }) => <h1>{item.title}</h1>,
  resolveRelatedLinks: async () => [],
}));

import { useNavSection } from "@/components/layout/NavSection";
import LiturgyHistoryDetailPage from "@/app/liturgy-history/[slug]/page";

function Tab() {
  return <output aria-label="section">{useNavSection() ?? "none"}</output>;
}

const params = { params: Promise.resolve({ slug: "any" }) };
const row = { title: "A page", subtitle: null, payload: {} };

describe("/liturgy-history/[slug]", () => {
  it("claims the Liturgy tab for a liturgical entry", async () => {
    rows.LITURGICAL = row;
    rows.CHURCH_DOCUMENT = null;
    render(
      <>
        <Tab />
        {await LiturgyHistoryDetailPage(params)}
      </>,
    );
    expect(screen.getByRole("status", { name: "section" })).toHaveTextContent("/liturgy");
  });

  it("claims the History tab's Church Documents for a document", async () => {
    rows.LITURGICAL = null;
    rows.CHURCH_DOCUMENT = row;
    render(
      <>
        <Tab />
        {await LiturgyHistoryDetailPage(params)}
      </>,
    );
    expect(screen.getByRole("status", { name: "section" })).toHaveTextContent("/church-documents");
  });
});
