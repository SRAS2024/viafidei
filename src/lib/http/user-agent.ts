const DEFAULT_UA =
  "ViaFideiBot/1.0 (+https://viafidei.com/bot; ingestion@viafidei.com)";

export function getIngestionUserAgent(): string {
  return process.env.INGESTION_USER_AGENT?.trim() || DEFAULT_UA;
}
