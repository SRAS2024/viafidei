import type { Dict } from "./types";
import { en } from "./en";

export const tl: Dict = {
  ...en,
  "brand.tagline": "Ang Landas ng Pananampalataya",
  "nav.home": "Tahanan",
  "nav.prayers": "Mga Panalangin",
  "nav.saints": "Mga Santo at Ina ng Diyos",
  "nav.login": "Mag-sign in",
  "parishes.distanceAway": "{distance} ang layo",
  // Phones and computers show these menus in English for Filipino readers,
  // so the setting names stay in English inside the Filipino sentences.
  "parishes.locate.button": "Gamitin ang aking lokasyon",
  "parishes.locate.locating": "Hinahanap ang mga parokya malapit sa iyo…",
  "parishes.locate.tryAgain": "Subukang muli",
  "parishes.locate.howTo": "Paano i-on ang lokasyon",
  "parishes.locate.blocked":
    "Hinaharangan ng iyong browser ang lokasyon para sa site na ito, kaya hindi ka nito natanong. Payagan ito, pagkatapos ay subukang muli.",
  "parishes.locate.notShared":
    "Hindi ibinahagi ng iyong device ang lokasyon nito. Kung hindi ka tinanong, malamang na naka-off ang lokasyon para sa iyong browser.",
  "parishes.locate.timeout":
    "Masyadong natagalan ang iyong device sa paghahanap ng iyong lokasyon. Tiyaking naka-on ang Location Services, pagkatapos ay subukang muli.",
  "parishes.locate.unavailable":
    "Hindi matukoy ng iyong device kung nasaan ka ngayon. Tiyaking naka-on ang Location Services, pagkatapos ay subukang muli.",
  "parishes.locate.unsupported":
    "Hindi maibabahagi ng browser na ito ang iyong lokasyon. Maaari mo pa ring tingnan ang direktoryo sa ibaba.",
  "parishes.locate.insecure":
    "Gumagana lang ang lokasyon sa secure na koneksyon. Buksan ang pahinang ito gamit ang https at subukang muli.",
  "parishes.locate.lookupFailed":
    "Hindi namin ma-load ang mga parokya malapit sa iyo. Gumagana pa rin ang direktoryo sa ibaba.",
  "parishes.locate.steps.iosSafariSettings":
    "Buksan ang Settings › Privacy & Security › Location Services, tiyaking naka-on ito, i-tap ang Safari Websites at piliin ang While Using the App.",
  "parishes.locate.steps.iosSafariSite":
    "Sa Safari, i-tap ang aA sa address bar › Website Settings › Location, at piliin ang Ask o Allow.",
  "parishes.locate.steps.iosOtherSettings":
    "Buksan ang Settings › Privacy & Security › Location Services, tiyaking naka-on ito, i-tap ang browser o app na ginagamit mo at piliin ang While Using the App.",
  "parishes.locate.steps.androidSite":
    "I-tap ang icon sa kaliwa ng web address › Permissions › Location, at piliin ang Allow.",
  "parishes.locate.steps.androidDevice":
    "Tiyaking naka-on ang Location sa quick settings ng iyong telepono.",
  "parishes.locate.steps.desktopSite":
    "I-click ang icon ng lokasyon o ng kandado sa address bar at payagan ang lokasyon para sa site na ito.",
  "parishes.locate.steps.desktopDevice":
    "Kung naka-off ang lokasyon sa iyong computer, i-on ito sa privacy settings nito (sa Mac: System Settings › Privacy & Security › Location Services).",
  "admin.loading.greeting": "Maligayang pagdating!",
  "admin.login.title": "Pag-sign in ng administrador",
  "admin.login.submit": "Pumasok",
  "admin.dashboard.title": "Dashboard ng administrador",
  "admin.signOut": "Mag-sign out",
  "admin.welcomeLine": "Naka-sign in ka bilang administrador.",
  "common.loading": "Naglo-load",
};
