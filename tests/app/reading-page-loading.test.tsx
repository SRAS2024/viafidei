/**
 * @vitest-environment jsdom
 */
/**
 * A guide, practice, devotion or novena loads in the reading column it will be
 * read in, not in the grid of cards its list page loads in.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import DevotionLoading from "@/app/devotions/[slug]/loading";
import GuideLoading from "@/app/guides/[slug]/loading";
import NovenaLoading from "@/app/novenas/[slug]/loading";
import SpiritualPracticeLoading from "@/app/spiritual-life/[slug]/loading";

afterEach(() => cleanup());

describe("reading pages while they load", () => {
  it.each([
    ["guide", GuideLoading],
    ["practice", SpiritualPracticeLoading],
    ["devotion", DevotionLoading],
    ["novena", NovenaLoading],
  ])("a %s reserves the reading column and says it is busy", (_name, Loading) => {
    render(<Loading />);
    const skeleton = screen.getByTestId("detail-loading");
    expect(skeleton).toHaveClass("vf-detail");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("tab-loading-cards")).not.toBeInTheDocument();
  });
});
