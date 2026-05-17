import { describe, expect, it } from "vitest";
import { scanForThreats } from "@/lib/security/payload-scanner";

describe("payload scanner — flags obvious threats", () => {
  it("flags an inline <script> tag", () => {
    const t = scanForThreats({ body: "Hello <script>alert(1)</script> world" });
    expect(t?.kind).toBe("script_tag");
  });

  it("flags javascript: URLs", () => {
    const t = scanForThreats({
      defaultTitle: "Click here",
      body: "Visit javascript:alert(document.cookie) for more",
    });
    expect(t?.kind).toBe("javascript_url");
  });

  it("flags inline event handlers (onclick, onerror, ...)", () => {
    const t = scanForThreats({ body: "<img src=x onerror=\"alert(1)\">" });
    expect(t?.kind).toBe("event_handler");
  });

  it("flags an SQL injection chain (UNION SELECT)", () => {
    const t = scanForThreats({ body: "x' UNION SELECT password FROM users--" });
    expect(t?.kind).toBe("sql_keyword_chain");
  });

  it("flags a DROP TABLE chain", () => {
    const t = scanForThreats({ body: "x'; DROP TABLE users; --" });
    expect(t?.kind).toBe("sql_keyword_chain");
  });

  it("flags a shell redirect chain", () => {
    const t = scanForThreats({ body: "innocuous text; rm -rf / and onward" });
    expect(t?.kind).toBe("shell_redirect");
  });

  it("descends into nested objects + arrays", () => {
    const t = scanForThreats({
      package: {
        payload: {
          sections: [{ body: "Look at me <script>steal()</script>" }],
        },
      },
    });
    expect(t?.kind).toBe("script_tag");
  });

  it("returns null for legitimate religious content", () => {
    expect(
      scanForThreats({
        defaultTitle: "St. Thomas Aquinas",
        body:
          "St. Thomas Aquinas was a Doctor of the Church. He explained that God is the ground of all being. " +
          "He died in 1274 at the abbey of Fossanova. Feast day: January 28.",
        category: "Saints",
      }),
    ).toBeNull();
  });

  it("returns null for content that merely mentions JavaScript by name (no payload)", () => {
    expect(
      scanForThreats({
        body: "The parish website uses JavaScript to render the bulletin.",
      }),
    ).toBeNull();
  });

  it("returns null for content that uses 'DROP' as an English word", () => {
    expect(
      scanForThreats({
        body: "A drop of water symbolizes Baptism. Do not drop the host.",
      }),
    ).toBeNull();
  });

  it("returns null for null / undefined / numbers", () => {
    expect(scanForThreats(null)).toBeNull();
    expect(scanForThreats(undefined)).toBeNull();
    expect(scanForThreats(42)).toBeNull();
    expect(scanForThreats({})).toBeNull();
    expect(scanForThreats([])).toBeNull();
  });
});
