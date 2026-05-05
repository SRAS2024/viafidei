import { appConfig } from "@/lib/config";

export function getDefaultTimeoutMs(): number {
  return appConfig.ingestion.httpTimeoutMs;
}

export function withAbortTimeout(timeoutMs: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}
