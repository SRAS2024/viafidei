import type { Translator } from "@/lib/i18n/translator";

/**
 * Every sentence the "Use my location" control can say, already in the
 * reader's language. The locator is a client component, so /parishes looks the
 * words up on the server and hands them down as plain strings.
 */
export interface LocatorLabels {
  button: string;
  locating: string;
  tryAgain: string;
  /** Heading over the platform's steps. */
  howTo: string;
  /** The browser has location blocked for this site (Permissions API: "denied"). */
  blocked: string;
  /** The device said no without the site being blocked: Don't Allow, or Location Services off. */
  notShared: string;
  timeout: string;
  unavailable: string;
  unsupported: string;
  insecure: string;
  /** The device answered but /api/parishes/near did not. */
  lookupFailed: string;
  steps: {
    iosSafariSettings: string;
    iosSafariSite: string;
    iosOtherSettings: string;
    androidSite: string;
    androidDevice: string;
    desktopSite: string;
    desktopDevice: string;
  };
}

export function parishLocatorLabels(t: Translator): LocatorLabels {
  return {
    button: t("parishes.locate.button"),
    locating: t("parishes.locate.locating"),
    tryAgain: t("parishes.locate.tryAgain"),
    howTo: t("parishes.locate.howTo"),
    blocked: t("parishes.locate.blocked"),
    notShared: t("parishes.locate.notShared"),
    timeout: t("parishes.locate.timeout"),
    unavailable: t("parishes.locate.unavailable"),
    unsupported: t("parishes.locate.unsupported"),
    insecure: t("parishes.locate.insecure"),
    lookupFailed: t("parishes.locate.lookupFailed"),
    steps: {
      iosSafariSettings: t("parishes.locate.steps.iosSafariSettings"),
      iosSafariSite: t("parishes.locate.steps.iosSafariSite"),
      iosOtherSettings: t("parishes.locate.steps.iosOtherSettings"),
      androidSite: t("parishes.locate.steps.androidSite"),
      androidDevice: t("parishes.locate.steps.androidDevice"),
      desktopSite: t("parishes.locate.steps.desktopSite"),
      desktopDevice: t("parishes.locate.steps.desktopDevice"),
    },
  };
}
