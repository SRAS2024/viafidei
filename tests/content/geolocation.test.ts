/**
 * The device side of "Use my location" (src/lib/content-shared/geolocation.ts):
 * which platform's settings a refusal should point at, what the Permissions
 * API has on record (read only to choose the words), and the options of the
 * first ask and of its single automatic retry.
 */
import { describe, expect, it, vi } from "vitest";

import {
  COARSE_FIX,
  PRECISE_FIX,
  detectLocationPlatform,
  isRetryableGeoError,
  readGeolocationPermission,
} from "@/lib/content-shared/geolocation";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipadAsMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15",
  // The Via Fidei iPhone app's own web view carries no "Safari/" token.
  iphoneWebView:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  macEdge:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0",
};

describe("detectLocationPlatform", () => {
  it.each([
    ["iPhone Safari", { userAgent: UA.iphoneSafari }, "ios-safari"],
    // iPadOS asks for the desktop site and says "Macintosh"; the touch screen gives it away.
    ["iPad Safari", { userAgent: UA.ipadAsMac, maxTouchPoints: 5 }, "ios-safari"],
    ["iPhone Chrome", { userAgent: UA.iphoneChrome }, "ios-other"],
    ["iPhone Firefox", { userAgent: UA.iphoneFirefox }, "ios-other"],
    ["the iPhone app's web view", { userAgent: UA.iphoneWebView }, "ios-other"],
    ["Android Chrome", { userAgent: UA.android }, "android"],
    // Safari on a Mac keeps a site's location switch in its own Settings
    // window; Chrome, Edge and Firefox there have an address-bar icon for it.
    ["Safari on a Mac", { userAgent: UA.ipadAsMac, maxTouchPoints: 0 }, "mac-safari"],
    ["Chrome on a Mac", { userAgent: UA.macChrome, maxTouchPoints: 0 }, "desktop"],
    ["Edge on a Mac", { userAgent: UA.macEdge, maxTouchPoints: 0 }, "desktop"],
    ["Firefox on a Mac", { userAgent: UA.macFirefox, maxTouchPoints: 0 }, "desktop"],
    ["Windows", { userAgent: UA.windows }, "desktop"],
    ["no navigator", undefined, "desktop"],
  ] as const)("reads %s as %s", (_name, nav, expected) => {
    expect(detectLocationPlatform(nav)).toBe(expected);
  });
});

describe("readGeolocationPermission", () => {
  it("asks the Permissions API for geolocation, on the permissions object itself", async () => {
    const permissions = {
      query: vi.fn(function (this: unknown) {
        // Calling it detached throws "Illegal invocation" in a real browser.
        if (this !== permissions) throw new TypeError("Illegal invocation");
        return Promise.resolve({ state: "denied" });
      }),
    };
    await expect(readGeolocationPermission({ permissions })).resolves.toBe("denied");
    expect(permissions.query).toHaveBeenCalledWith({ name: "geolocation" });
  });

  it.each(["granted", "prompt", "denied"] as const)("passes %s through", async (state) => {
    const permissions = { query: async () => ({ state }) };
    await expect(readGeolocationPermission({ permissions })).resolves.toBe(state);
  });

  it("answers null, never throws, when it cannot tell", async () => {
    await expect(readGeolocationPermission(undefined)).resolves.toBeNull();
    await expect(readGeolocationPermission({})).resolves.toBeNull();
    await expect(
      readGeolocationPermission({
        permissions: {
          query: async () => {
            throw new TypeError("'geolocation' is not a valid permission name");
          },
        },
      }),
    ).resolves.toBeNull();
    await expect(
      readGeolocationPermission({ permissions: { query: async () => ({ state: "weird" }) } }),
    ).resolves.toBeNull();
  });
});

describe("the two asks", () => {
  it("asks first for a precise, fresh fix", () => {
    expect(PRECISE_FIX).toEqual({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 });
  });

  it("retries coarser and more patiently", () => {
    expect(COARSE_FIX.enableHighAccuracy).toBe(false);
    expect(COARSE_FIX.timeout!).toBeGreaterThan(PRECISE_FIX.timeout!);
  });

  it("retries a timeout or an unavailable position, never a refusal", () => {
    expect(isRetryableGeoError(3)).toBe(true);
    expect(isRetryableGeoError(2)).toBe(true);
    expect(isRetryableGeoError(1)).toBe(false);
    expect(isRetryableGeoError(undefined)).toBe(false);
  });
});

describe("the locator's words", () => {
  const keys = Object.keys(DICTIONARIES.en).filter((k) => k.startsWith("parishes.locate."));

  it("has every sentence the control can say", () => {
    expect(keys.length).toBe(19);
  });

  it("is written out in every site language, not inherited from English", () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      for (const key of keys) {
        const text = DICTIONARIES[locale][key];
        expect(typeof text, `${locale} ${key}`).toBe("string");
        expect(text, `${locale} ${key}`).not.toBe(DICTIONARIES.en[key]);
        expect(text!.trim(), `${locale} ${key}`).not.toBe("");
      }
    }
  });

  it("names the iPhone switches the owner's support steps call for", () => {
    const en = DICTIONARIES.en;
    expect(en["parishes.locate.steps.iosSafariSettings"]).toContain(
      "Settings › Privacy & Security › Location Services",
    );
    expect(en["parishes.locate.steps.iosSafariSettings"]).toContain("Safari Websites");
    expect(en["parishes.locate.steps.iosSafariSettings"]).toContain("While Using the App");
    expect(en["parishes.locate.steps.iosSafariSite"]).toContain(
      "aA in the address bar › Website Settings › Location",
    );
    expect(en["parishes.locate.steps.androidSite"]).toContain("Permissions › Location");
    expect(en["parishes.locate.steps.macSafariSite"]).toContain(
      "Safari › Settings › Websites › Location",
    );
  });

  it("never says the browser could not ask when the visitor may just have said no", () => {
    // Chrome, Edge and Firefox record a "Block" chosen in their own prompt, so
    // the Permissions API reads "denied" straight after the visitor WAS asked.
    // The message says the browser can't ask now, which is true either way.
    expect(DICTIONARIES.en["parishes.locate.blocked"]).toContain("so it can't ask you");
    expect(DICTIONARIES.en["parishes.locate.blocked"]).not.toMatch(/couldn't ask/);
  });
});
