/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfficialSourceLink } from "@/components/ui/OfficialSourceLink";

describe("OfficialSourceLink", () => {
  it("renders nothing when url is null", () => {
    const { container } = render(<OfficialSourceLink url={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when url is undefined", () => {
    const { container } = render(<OfficialSourceLink url={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for unsafe protocols like javascript:, data:, file:, ftp:", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
      "ftp://www.vatican.va/x",
      "mailto:nobody@example.com",
    ]) {
      const { container } = render(<OfficialSourceLink url={url} />);
      expect(container.firstChild).toBeNull();
    }
  });

  it("renders an external link with rel=noopener noreferrer and target=_blank for https URLs", () => {
    render(<OfficialSourceLink url="https://www.vatican.va/news" />);
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute("href", "https://www.vatican.va/news");
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("derives a friendly host label from the URL (strips www. prefix)", () => {
    render(<OfficialSourceLink url="https://www.vatican.va/" />);
    expect(screen.getByRole("link").textContent).toContain("vatican.va");
    expect(screen.getByRole("link").textContent).not.toContain("www.vatican.va");
  });

  it("uses the explicit label override when provided", () => {
    render(<OfficialSourceLink url="https://example.org/x" label="Read at the source" />);
    expect(screen.getByRole("link").textContent).toContain("Read at the source");
  });

  it("renders a section heading announcing the official source", () => {
    render(<OfficialSourceLink url="https://www.vatican.va/x" />);
    expect(screen.getByText(/Official source/i)).toBeInTheDocument();
  });

  it("accepts plain http:// urls (the source attribution allows either scheme)", () => {
    render(<OfficialSourceLink url="http://example.org/legacy" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "http://example.org/legacy");
  });
});
