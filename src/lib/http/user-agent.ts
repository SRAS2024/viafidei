import { appConfig } from "@/lib/config";

export function getIngestionUserAgent(): string {
  return appConfig.ingestion.userAgent;
}
