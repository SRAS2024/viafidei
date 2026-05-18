/**
 * Builder version registry — proves every content type has a complete
 * registry entry, including required source permissions, required
 * sections, and required output fields.
 *
 * Adding a new builder MUST come with a registry entry; this test
 * fails the moment that contract is violated.
 */

import { describe, expect, it } from "vitest";
import {
  BUILDER_REGISTRY,
  BUILDER_VERSION_REGISTRY,
  getBuilderRegistryEntry,
  listBuilderRegistry,
} from "@/lib/content-factory";

describe("BUILDER_VERSION_REGISTRY", () => {
  it("includes one entry per content type in BUILDER_REGISTRY", () => {
    const builderKeys = Object.keys(BUILDER_REGISTRY).sort();
    const registryKeys = Object.keys(BUILDER_VERSION_REGISTRY).sort();
    expect(registryKeys).toEqual(builderKeys);
  });

  it("each entry declares a non-empty builderName, builderVersion, and required source permission", () => {
    for (const entry of listBuilderRegistry()) {
      expect(entry.builderName).toMatch(/Builder$/);
      expect(entry.builderVersion).toMatch(/\d+\.\d+\.\d+/);
      expect(entry.requiredSourcePurpose).toMatch(/^canIngest|^canProvide/);
    }
  });

  it("each entry declares at least one required source section and output field", () => {
    for (const entry of listBuilderRegistry()) {
      expect(entry.requiredSourceSections.length).toBeGreaterThan(0);
      expect(entry.requiredOutputFields.length).toBeGreaterThan(0);
    }
  });

  it("the registry version matches BUILDER_REGISTRY.<type>.builderVersion", () => {
    for (const entry of listBuilderRegistry()) {
      expect(entry.builderVersion).toBe(BUILDER_REGISTRY[entry.contentType].builderVersion);
      expect(entry.builderName).toBe(BUILDER_REGISTRY[entry.contentType].builderName);
    }
  });

  it("getBuilderRegistryEntry throws for an unknown content type", () => {
    expect(() => getBuilderRegistryEntry("Unknown" as never)).toThrow();
  });
});
