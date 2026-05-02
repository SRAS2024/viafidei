import type { SourceAdapter } from "./types";

const adapters = new Map<string, SourceAdapter>();

export function registerAdapter(adapter: SourceAdapter): void {
  if (adapters.has(adapter.key)) {
    throw new Error(`SourceAdapter '${adapter.key}' is already registered`);
  }
  adapters.set(adapter.key, adapter);
}

export function unregisterAdapter(key: string): void {
  adapters.delete(key);
}

export function getAdapter(key: string): SourceAdapter | undefined {
  return adapters.get(key);
}

export function listAdapters(): SourceAdapter[] {
  return Array.from(adapters.values());
}

export function listAdapterKeys(): string[] {
  return Array.from(adapters.keys());
}

export function clearRegistry(): void {
  adapters.clear();
}
