import { vi } from "vitest";
import type {
  AdapterContext,
  AdapterResult,
  IngestedItem,
  IngestedKind,
  SourceAdapter,
} from "@/lib/ingestion/types";

// Build a SourceAdapter that returns a canned set of items. Tests use this
// in place of a real network-fetching adapter so they never touch the
// internet (and never depend on Vatican.va being up).
export function makeMockAdapter(options: {
  key?: string;
  description?: string;
  entityKinds?: readonly IngestedKind[];
  items?: IngestedItem[];
  notModified?: boolean;
  throwError?: Error;
}): SourceAdapter & { fetch: ReturnType<typeof vi.fn> } {
  const items = options.items ?? [];
  const fetchFn = vi.fn(async (_ctx: AdapterContext): Promise<AdapterResult> => {
    if (options.throwError) throw options.throwError;
    if (options.notModified) return { items: [], notModified: true };
    return { items };
  });
  return {
    key: options.key ?? "mock-adapter",
    description: options.description ?? "Mock adapter for tests",
    entityKinds:
      options.entityKinds ?? (Array.from(new Set(items.map((i) => i.kind))) as IngestedKind[]),
    fetch: fetchFn,
  };
}

// Build a mock HTTP fetch that returns scripted responses keyed by URL.
// Useful when an adapter calls the global fetch() — drop this on
// globalThis.fetch in beforeEach and assert call counts after.
export function makeMockFetch(routes: Record<string, { status?: number; body: string }>) {
  return vi.fn(async (input: string | URL | Request): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) {
      return new Response("not found", { status: 404 });
    }
    return new Response(route.body, { status: route.status ?? 200 });
  });
}
