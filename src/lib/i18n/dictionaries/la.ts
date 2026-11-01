import type { Dict } from "./types";
import { en } from "./en";

export const la: Dict = {
  ...en,
  "brand.tagline": "Via Fidei",
  "nav.home": "Domus",
  "nav.prayers": "Orationes",
  "nav.spiritualLife": "Vita Spiritualis",
  "nav.saints": "Sancti et Beata Virgo",
  "nav.login": "Ingredi",
  "parishes.distanceAway": "{distance} abest",
  // iOS, Android and macOS have no Latin interface, so the names of their
  // menus are given as the English the device most likely shows.
  "parishes.locate.button": "Loco meo utere",
  "parishes.locate.locating": "Paroeciae prope te quaeruntur…",
  "parishes.locate.tryAgain": "Iterum conare",
  "parishes.locate.howTo": "Quomodo locus tuus communicetur",
  "parishes.locate.blocked":
    "Navigatrum tuum locum huic paginae negat, itaque te rogare non potest. Id permitte, deinde iterum conare.",
  "parishes.locate.notShared":
    "Instrumentum tuum locum suum non communicavit. Si rogatus non es, officia loci navigatro tuo fortasse exstincta sunt.",
  "parishes.locate.timeout":
    "Instrumentum tuum diutius locum tuum quaesivit. Officia loci accensa esse confirma, deinde iterum conare.",
  "parishes.locate.unavailable":
    "Instrumentum tuum nunc invenire non potuit ubi sis. Officia loci accensa esse confirma, deinde iterum conare.",
  "parishes.locate.unsupported":
    "Hoc navigatrum locum tuum communicare non potest. Indicem infra tamen perlustrare potes.",
  "parishes.locate.insecure":
    "Locus nonnisi per conexionem tutam praebetur. Hanc paginam per https aperi et iterum conare.",
  "parishes.locate.lookupFailed":
    "Paroecias prope te onerare non potuimus. Index infra adhuc operatur.",
  "parishes.locate.steps.iosSafariSettings":
    "Aperi Settings › Privacy & Security › Location Services, ea accensa esse confirma, deinde tange Safari Websites et elige While Using the App.",
  "parishes.locate.steps.iosSafariSite":
    "In Safari tange aA in linea inscriptionis › Website Settings › Location, et elige Ask vel Allow.",
  "parishes.locate.steps.iosOtherSettings":
    "Aperi Settings › Privacy & Security › Location Services, ea accensa esse confirma, deinde tange navigatrum vel applicationem qua uteris et elige While Using the App.",
  "parishes.locate.steps.androidSite":
    "Tange iconem ad sinistram inscriptionis › Permissions › Location, et elige Allow.",
  "parishes.locate.steps.androidDevice":
    "Confirma Location in celeribus telephoni optionibus accensum esse.",
  "parishes.locate.steps.macSafariSite":
    "In Safari aperi Safari › Settings › Websites › Location, et huic paginae elige Ask vel Allow.",
  "parishes.locate.steps.desktopSite":
    "Preme iconem loci vel serae in linea inscriptionis et huic paginae locum permitte.",
  "parishes.locate.steps.desktopDevice":
    "Si locus in computatro tuo exstinctus est, eum in optionibus secreti accende (in Mac: System Settings › Privacy & Security › Location Services).",
  "listSearch.submit": "Quaere",
  "listSearch.clear": "Quaestionem dele",
  "listSearch.results.one": "{count} inventum pro «{query}»",
  "listSearch.results.other": "{count} inventa pro «{query}»",
  "listSearch.none": "Nihil hic cum «{query}» congruit.",
  "listSearch.noneHint": "Pauciora verba vel aliam scripturam tempta.",
  "listSearch.prayers": "Orationes quaere",
  "listSearch.litanies": "Litanias quaere",
  "listSearch.saints": "Sanctos quaere",
  "listSearch.ourLady": "Titulos et apparitiones quaere",
  "listSearch.doctors": "Doctores Ecclesiae quaere",
  "listSearch.popes": "Summos Pontifices quaere",
  "listSearch.parishes": "Nomine, urbe vel codice postali quaere",
  "listSearch.parishesPlaceholder": "Nomen, urbs vel codex postalis",
  "listSearch.spiritualLife": "Exercitia spiritualia quaere",
  "listSearch.guides": "Duces quaere",
  "listSearch.liturgy": "In liturgia quaere",
  "listSearch.rites": "Ritus quaere",
  "listSearch.churchDocuments": "Documenta Ecclesiae quaere",
  "listSearch.devotions": "Devotiones quaere",
  "listSearch.novenas": "Novendialia quaere",
  "admin.loading.greeting": "Salve!",
  "admin.login.title": "Introitus administratoris",
  "admin.login.submit": "Intra",
  "admin.dashboard.title": "Tabula administrationis",
  "admin.signOut": "Exire",
  "admin.welcomeLine": "Administrator intrasti.",
  "common.loading": "Oneratio",
};
