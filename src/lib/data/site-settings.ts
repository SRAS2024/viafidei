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

/**
 * Master kill switch for the Ingestion & Data Management automatic
 * cleanup pass. When `enabled` is false, the cron job skips
 * `cleanupMiscategorisedContent()` and `archiveDuplicatePrayers()` so
 * an admin can take manual control of curation. Ingestion itself
 * (the per-row validator + skip-existing semantics) still runs.
 *
 * Default behaviour when the setting is missing is `enabled: true`,
 * preserving the existing automatic cleanup.
 */
export const DATA_MANAGEMENT_KEY = "data_management";

export type DataManagementValue = {
  /** Run the cleanup sweep on every cron tick. */
  autoCleanupEnabled?: boolean;
  /**
   * Permanently delete (rather than archive) rows that have been in
   * ARCHIVED status for at least this many days. Defaults to 30. Set
   * to 0 or a negative number to disable hard deletes.
   */
  hardDeleteAfterDays?: number;
};

const DEFAULTS: Required<DataManagementValue> = {
  autoCleanupEnabled: true,
  hardDeleteAfterDays: 30,
};

export async function getDataManagementSettings(): Promise<Required<DataManagementValue>> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: DATA_MANAGEMENT_KEY },
  });
  const raw = (setting?.valueJson as DataManagementValue | null) ?? {};
  return {
    autoCleanupEnabled: raw.autoCleanupEnabled ?? DEFAULTS.autoCleanupEnabled,
    hardDeleteAfterDays: raw.hardDeleteAfterDays ?? DEFAULTS.hardDeleteAfterDays,
  };
}

export function upsertDataManagementSettings(value: DataManagementValue) {
  return prisma.siteSetting.upsert({
    where: { key: DATA_MANAGEMENT_KEY },
    create: { key: DATA_MANAGEMENT_KEY, valueJson: value },
    update: { valueJson: value },
  });
}
