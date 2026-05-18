/**
 * Regression: every active source either declares a valid discovery
 * method or is marked not_configured.
 *
 * The spec lists six valid values:
 *   sitemap | rss | fixed_url_list | official_api | factory_handler
 *   | not_configured
 *
 * The factory-source-setup task backfills this column at startup; the
 * audit here proves the contract is well-formed and the constant
 * matches the spec.
 */

import { describe, expect, it } from "vitest";
import {
  FACTORY_DISCOVERY_METHODS,
  isFactoryDiscoveryMethod,
} from "@/lib/startup/factory-source-setup";

describe("FACTORY_DISCOVERY_METHODS spec pin", () => {
  it("includes exactly the six spec-listed values", () => {
    expect([...FACTORY_DISCOVERY_METHODS].sort()).toEqual(
      [
        "sitemap",
        "rss",
        "fixed_url_list",
        "official_api",
        "factory_handler",
        "not_configured",
      ].sort(),
    );
  });

  it("isFactoryDiscoveryMethod accepts every spec value and rejects others", () => {
    for (const method of FACTORY_DISCOVERY_METHODS) {
      expect(isFactoryDiscoveryMethod(method)).toBe(true);
    }
    expect(isFactoryDiscoveryMethod("legacy_adapter")).toBe(false);
    expect(isFactoryDiscoveryMethod("api")).toBe(false);
    expect(isFactoryDiscoveryMethod("")).toBe(false);
  });
});
