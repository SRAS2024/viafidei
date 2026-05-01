import { prisma } from "../db/client";

export const FAVICON_KEY = "favicon";

export type FaviconValue = { url?: string; altText?: string };

export async function getFaviconSetting() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: FAVICON_KEY } });
  return {
    setting,
    value: (setting?.valueJson as FaviconValue | null) ?? null,
  };
}

export function upsertFaviconSetting(value: FaviconValue) {
  return prisma.siteSetting.upsert({
    where: { key: FAVICON_KEY },
    create: { key: FAVICON_KEY, valueJson: value },
    update: { valueJson: value },
  });
}
