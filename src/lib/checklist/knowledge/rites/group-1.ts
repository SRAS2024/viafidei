import type { CuratedEntry } from "../index";

const ORIENTALIUM_ECCLESIARUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19641121_orientalium-ecclesiarum_en.html";
const SACROSANCTUM_CONCILIUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html";
const ORIENTALE_LUMEN =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1995/documents/hf_jp-ii_apl_19950502_orientale-lumen.html";
const EASTERN_CHURCHES = "https://www.vatican.va/roman_curia/congregations/orientchurch/index.htm";
const DIVINE_WORSHIP = "https://www.vatican.va/roman_curia/congregations/ccdds/index.htm";
const ANGLICANORUM_COETIBUS =
  "https://www.vatican.va/content/benedict-xvi/en/apost_constitutions/documents/hf_ben-xvi_apc_20091104_anglicanorum-coetibus.html";
const CATECHISM = "https://www.vatican.va/archive/ENG0015/_INDEX.HTM";

type Family = "latin" | "byzantine" | "alexandrian" | "west_syriac" | "east_syriac" | "armenian";
type EntryKind = "liturgical_rite" | "church_sui_iuris" | "latin_use";

function riteEntry(input: {
  slug: string;
  title: string;
  riteKey?: string;
  family: Family;
  entryKind: EntryKind;
  region: string;
  faithfulEstimate?: string;
  history: string;
  background: string;
  summary: string;
  citations: string[];
}): CuratedEntry {
  const {
    slug,
    title,
    riteKey,
    family,
    entryKind,
    region,
    faithfulEstimate,
    history,
    background,
    summary,
    citations,
  } = input;
  return {
    contentType: "RITE",
    slug,
    authorityLevel: "VATICAN",
    citations,
    payload: {
      slug,
      title,
      ...(riteKey ? { riteKey } : {}),
      family,
      entryKind,
      region,
      ...(faithfulEstimate ? { faithfulEstimate } : {}),
      history,
      background,
      summary,
      citations,
    },
  };
}

/**
 * Group 1 of the curated rite catalogue.
 *
 * Three strands, all of them within the one Catholic Church:
 *
 *  1. The liturgical families (`entryKind: "liturgical_rite"`) that were not
 *     yet described in knowledge/rites.ts — Alexandrian, West Syriac and East
 *     Syriac. The Latin, Byzantine and Armenian families are already carried
 *     there by `rite-roman`, `rite-byzantine` and `rite-armenian`.
 *  2. The Churches sui iuris (`entryKind: "church_sui_iuris"`) still missing
 *     from the registry. A Church sui iuris is defined by the Code of Canons
 *     of the Eastern Churches (c. 27) as a community of the faithful united
 *     under a hierarchy and recognised as self-governing by the supreme
 *     authority of the Church; its rite (c. 28) is the liturgical,
 *     theological, spiritual and disciplinary patrimony it lives by.
 *  3. Uses of the Roman Rite (`entryKind: "latin_use"`) — venerable Western
 *     usages the Church has chosen to preserve, as the Second Vatican Council
 *     directed when it declared that the Church holds all lawfully recognised
 *     rites to be of equal right and dignity.
 *
 * Numbers of faithful are approximate: they are drawn from the orders of
 * magnitude reported in Church statistics and are given as estimates, never
 * as exact counts.
 */
export const riteGroupOne: CuratedEntry[] = [
  // ── Liturgical families ────────────────────────────────────────────────
  riteEntry({
    slug: "rite-alexandrian",
    title: "Alexandrian Rite",
    riteKey: "alexandrian",
    family: "alexandrian",
    entryKind: "liturgical_rite",
    region: "Egypt, Ethiopia and Eritrea, with communities throughout the diaspora",
    faithfulEstimate:
      "Roughly four hundred thousand Catholics in the Coptic, Ethiopian and Eritrean Catholic Churches",
    history:
      "The Alexandrian tradition grew from the Church of Alexandria, whose foundation Christian antiquity attributes to the preaching of Saint Mark. Egypt gave the Church her first monks, her great catechetical school, and the theology of Saint Athanasius and Saint Cyril, and the liturgy of Alexandria carried that inheritance south into the Ethiopian highlands, where it took root in the Ge'ez language. The Catholic Churches of this family — Coptic, Ethiopian and Eritrean — hold the tradition in full communion with the Bishop of Rome.",
    background:
      "The Alexandrian family celebrates the Divine Liturgy chiefly according to the anaphoras of Saint Basil, Saint Gregory and Saint Mark (called of Saint Cyril), in Coptic, Arabic and Ge'ez. Its worship is marked by long litanies, the singing of the people, the rhythm of cymbals and drums in the Ethiopic usage, and a monastic austerity of fasting inherited from the deserts of Egypt.",
    summary:
      "The liturgical family of Egypt and the Horn of Africa, celebrated by the Coptic, Ethiopian and Eritrean Catholic Churches.",
    citations: [ORIENTALIUM_ECCLESIARUM, ORIENTALE_LUMEN, CATECHISM],
  }),
  riteEntry({
    slug: "rite-west-syriac",
    title: "West Syriac (Antiochene) Rite",
    riteKey: "westSyriac",
    family: "west_syriac",
    entryKind: "liturgical_rite",
    region: "Lebanon, Syria, Iraq, the Holy Land and Kerala in India, with a wide diaspora",
    faithfulEstimate:
      "More than four million Catholics in the Maronite, Syriac and Syro-Malankara Catholic Churches",
    history:
      "The West Syriac tradition is the liturgy of Antioch, the city where the disciples were first called Christians. Shaped in the Syriac-speaking world of Syria and Mesopotamia, it was carried by monks and poets — above all Saint Ephrem, whose hymns still furnish its chants — and it reached India in the modern period through the Syro-Malankara Church. Three Catholic Churches sui iuris live this patrimony today: the Maronite, the Syriac and the Syro-Malankara.",
    background:
      "The Divine Liturgy of this family is the Qurbono, ordinarily celebrated in the Anaphora of Saint James with a wide treasury of other anaphoras. Syriac, a dialect of the Aramaic that Our Lord spoke, remains its liturgical language alongside Arabic, Malayalam and the vernaculars of the diaspora, and its prayer is dense with poetic imagery, incense and the sung dialogue of priest and people.",
    summary:
      "The Antiochene liturgical family, whose Syriac Qurbono is celebrated by the Maronite, Syriac and Syro-Malankara Catholic Churches.",
    citations: [ORIENTALIUM_ECCLESIARUM, ORIENTALE_LUMEN, CATECHISM],
  }),
  riteEntry({
    slug: "rite-east-syriac",
    title: "East Syriac (Chaldean) Rite",
    riteKey: "eastSyriac",
    family: "east_syriac",
    entryKind: "liturgical_rite",
    region: "Iraq, Iran and Kerala in India, with communities across the diaspora",
    faithfulEstimate:
      "Some five million Catholics, the great majority of them in the Syro-Malabar Church",
    history:
      "The East Syriac tradition arose in Mesopotamia, beyond the frontiers of the Roman Empire, among Christians who prayed in Syriac and produced a missionary Church of extraordinary reach: its monks and merchants carried the Gospel along the trade routes to Central Asia, China and India. Two Catholic Churches sui iuris hold this patrimony — the Chaldean Catholic Church of Iraq and the Syro-Malabar Church of Kerala, whose Saint Thomas Christians trace their origin to the Apostle himself.",
    background:
      "Its Divine Liturgy is the Holy Qurbana, celebrated principally in the Anaphora of the Apostles Addai and Mari, one of the most ancient eucharistic prayers in continuous use. The rite is sober and biblical, with a strong place given to the psalms, to processions between the sanctuary and the bema, and to the Syriac and Malayalam chant of its two great Churches.",
    summary:
      "The Mesopotamian liturgical family of the Holy Qurbana of Addai and Mari, celebrated by the Chaldean and Syro-Malabar Catholic Churches.",
    citations: [ORIENTALIUM_ECCLESIARUM, ORIENTALE_LUMEN, CATECHISM],
  }),

  // ── Churches sui iuris ────────────────────────────────────────────────
  riteEntry({
    slug: "church-albanian-greek-catholic",
    title: "Albanian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Southern Albania, with its centre at Vlorë",
    faithfulEstimate: "Around four thousand faithful",
    history:
      "Byzantine-rite Christians in southern Albania sought communion with Rome in the modern era, and before the Second World War the Holy See erected an apostolic administration to care for them. Under the militantly atheist regime that outlawed all public worship in 1967, the community was driven underground and its clergy imprisoned; it re-emerged with the return of religious freedom in 1991 and remains one of the smallest of the Eastern Catholic Churches.",
    background:
      "The faithful are served by the Apostolic Administration of Southern Albania, governed by an apostolic administrator appointed by the Holy See rather than by a hierarch of its own. The Divine Liturgy is celebrated in the Byzantine tradition in Albanian.",
    summary:
      "A very small Byzantine-rite Church sui iuris in southern Albania, served by an apostolic administration with its centre at Vlorë.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-belarusian-greek-catholic",
    title: "Belarusian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Belarus and the Belarusian diaspora",
    faithfulEstimate: "A few thousand faithful",
    history:
      "Belarusian Greek Catholics descend from the Union of Brest (1596), by which the Ruthenian metropolitanate of Kyiv entered into full communion with Rome. In 1839 the union was suppressed within the Russian Empire and the faithful were absorbed into the Orthodox Church; small groups persisted and the tradition was deliberately revived in the twentieth century, chiefly among Belarusians in exile, before returning openly to Belarus after 1991.",
    background:
      "The Church has no eparchy of its own: its parishes and communities are cared for by an apostolic visitor appointed by the Holy See. The Divine Liturgy is celebrated in the Byzantine tradition in Church Slavonic and Belarusian.",
    summary:
      "A small Byzantine-rite Church sui iuris in Belarus, heir to the Union of Brest, served today by an apostolic visitor.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-bulgarian-greek-catholic",
    title: "Bulgarian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Bulgaria, with its see at Sofia",
    faithfulEstimate: "Roughly ten thousand faithful",
    history:
      "A movement of Bulgarian Christians toward communion with Rome came to a head in 1861, when Pope Pius IX himself ordained the archimandrite Joseph Sokolski a bishop for them in Rome. The community survived war, population exchanges and forty years of communist rule; an apostolic exarchate governed it from Sofia through the twentieth century, and in 2019 Pope Francis raised that exarchate to the Eparchy of Saint John XXIII of Sofia.",
    background:
      "The Church is governed by an eparchial bishop in Sofia and celebrates the Divine Liturgy in the Byzantine tradition in Church Slavonic and Bulgarian. Its history is closely bound to the Congregation of the Assumption and to the schools that served Bulgarian Catholics in the nineteenth and twentieth centuries.",
    summary:
      "A Byzantine-rite Church sui iuris in Bulgaria, dating from the union of 1861 and governed since 2019 by the Eparchy of Saint John XXIII of Sofia.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-greek-byzantine-catholic",
    title: "Greek Byzantine Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Greece and Türkiye, with apostolic exarchates at Athens and Istanbul",
    faithfulEstimate: "A very small community, numbered in the thousands",
    history:
      "Greek Catholics of the Byzantine tradition gathered in the late nineteenth century around priests who wished to serve Greeks in communion with Rome while keeping their own liturgy entirely intact. An exarchate was established for them in the Ottoman capital early in the twentieth century, and a second in Greece itself, which continues today with its centre in Athens. The community was scattered by the population exchanges that followed the First World War and has remained very small ever since.",
    background:
      "Two apostolic exarchates — one in Greece, one in Istanbul — make up the Church, each led by an apostolic exarch. The Divine Liturgy is celebrated in Greek, and the community is known especially for its charitable and hospital work in Athens.",
    summary:
      "A tiny Byzantine-rite Church sui iuris of Greek Catholics, organised in apostolic exarchates at Athens and Istanbul.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-hungarian-greek-catholic",
    title: "Hungarian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Hungary, with its metropolitan see of Hajdúdorog",
    faithfulEstimate: "Around a quarter of a million faithful",
    history:
      "Byzantine-rite communities in the Kingdom of Hungary entered into full communion with Rome in the seventeenth century, their union consolidated at Uzhhorod in 1646. Because they had come to pray in Hungarian, Pope Saint Pius X erected the Eparchy of Hajdúdorog for them in 1912. The Church endured the communist decades and in 2015 Pope Francis raised it to a metropolitan Church sui iuris, with the Archeparchy of Hajdúdorog and the Eparchies of Miskolc and Nyíregyháza.",
    background:
      "The Church is headed by a metropolitan archbishop and celebrates the Divine Liturgy of Saint John Chrysostom in Hungarian, with a rich tradition of congregational chant. It maintains its own seminary and a notable presence in Hungarian education and catechesis.",
    summary:
      "A Byzantine-rite metropolitan Church sui iuris in Hungary, centred on Hajdúdorog and raised to metropolitan status in 2015.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-italo-albanian-catholic",
    title: "Italo-Albanian Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Calabria and Sicily in southern Italy, with the abbey of Grottaferrata near Rome",
    faithfulEstimate: "Roughly sixty thousand faithful",
    history:
      "This Church has never been separated from Rome. It gathers the ancient Greek-rite communities of southern Italy together with the Arbëresh — Albanians who fled the Ottoman conquest from the fifteenth century onward and settled in Calabria and Sicily, bringing their Byzantine liturgy with them. The monastery of Santa Maria di Grottaferrata, founded in 1004 by Saint Nilus of Rossano, has kept Greek monastic life alive in Italy without interruption ever since.",
    background:
      "Three jurisdictions make up the Church: the Eparchy of Lungro in Calabria (erected in 1919), the Eparchy of Piana degli Albanesi in Sicily (erected in 1937) and the Territorial Abbey of Santa Maria di Grottaferrata. The Divine Liturgy is celebrated in Greek, Albanian and Italian.",
    summary:
      "A Byzantine-rite Church sui iuris in southern Italy, never separated from Rome, comprising the eparchies of Lungro and Piana degli Albanesi and the abbey of Grottaferrata.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-macedonian-greek-catholic",
    title: "Macedonian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "North Macedonia, with its see at Strumica and Skopje",
    faithfulEstimate: "Some fifteen thousand faithful",
    history:
      "Byzantine-rite Catholics in Macedonia trace their communion with Rome to unions among the Slavic Christians of the region in the nineteenth century. Their communities were long attached to the eparchy of Križevci; in 2001 the Holy See erected an apostolic exarchate for them, and in 2018 Pope Francis raised it to the Eparchy of the Blessed Virgin Mary Assumed in Strumica–Skopje, making them a Church sui iuris of their own.",
    background:
      "The Church is governed by its eparchial bishop and celebrates the Divine Liturgy in the Byzantine tradition in Macedonian and Church Slavonic. Skopje, where the eparchial see is, is also the birthplace of Saint Teresa of Calcutta, though her family belonged to the city's Latin-rite Albanian Catholic community and she was baptised in the Latin parish of the Sacred Heart, not among the Byzantine-rite faithful of this Church.",
    summary:
      "A small Byzantine-rite Church sui iuris in North Macedonia, given its own eparchy of Strumica–Skopje in 2018.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-romanian-greek-catholic",
    title: "Romanian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Transylvania and the rest of Romania, with its see at Blaj",
    faithfulEstimate:
      "Church statistics report several hundred thousand faithful; the national census of 2011 counted about a hundred and fifty thousand",
    history:
      "The Romanians of Transylvania entered into full communion with Rome through synods held at Alba Iulia in 1697 and 1700 under Bishop Athanasius Anghel. Blaj became the Church's heart and a cradle of Romanian letters and national awakening. In 1948 the communist government suppressed the Church outright: its bishops were arrested and died in prison or under house arrest, and seven of them have since been beatified as martyrs. The Church returned to public life with the revolution of 1989, and in 2005 Pope Benedict XVI raised it to a Major Archiepiscopal Church.",
    background:
      "It is headed by the Major Archbishop of Făgăraș and Alba Iulia, whose see is at Blaj, with eparchies across Romania and for the diaspora. The Divine Liturgy is celebrated in Romanian in the Byzantine tradition.",
    summary:
      "A Byzantine-rite Major Archiepiscopal Church sui iuris in Romania, united with Rome since 1700, suppressed under communism and restored in 1989.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-russian-greek-catholic",
    title: "Russian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Russia and the Russian diaspora",
    faithfulEstimate: "A very small, scattered community of a few thousand faithful",
    history:
      "Small numbers of Russians sought communion with Rome while keeping the Byzantine liturgy of their homeland untouched. In 1917 an apostolic exarchate was erected for them, with Blessed Leonid Feodorov as exarch; he was imprisoned by the Soviet authorities and died in 1935. A second exarchate was established at Harbin in Manchuria in 1928 for Russians in exile. Both remain vacant, and the faithful today are few and widely dispersed.",
    background:
      "Without a hierarch of its own, the Church's parishes are ordinarily entrusted to the care of the local Latin bishops. The Divine Liturgy is celebrated in Church Slavonic according to the Russian recension of the Byzantine tradition.",
    summary:
      "A very small Byzantine-rite Church sui iuris of Russian Catholics, whose two apostolic exarchates have long remained vacant.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-slovak-greek-catholic",
    title: "Slovak Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Slovakia, with its metropolitan see at Prešov",
    faithfulEstimate: "Around two hundred thousand faithful",
    history:
      "Slovak Greek Catholics descend from the Union of Uzhhorod (1646). Pope Pius VII erected the Eparchy of Prešov for them in 1818. In 1950 the communist regime abolished the Church by decree, imprisoned Blessed Bishop Pavel Peter Gojdič — who died in prison in 1960 — and forced its parishes into the Orthodox Church; it was legalised again in 1968. In 2008 Pope Benedict XVI raised it to a metropolitan Church sui iuris, with the Archeparchy of Prešov and the Eparchies of Košice and Bratislava.",
    background:
      "The Church is headed by the metropolitan archbishop of Prešov and celebrates the Divine Liturgy in Church Slavonic and Slovak. It maintains a theological faculty at Prešov and a strong parish life in eastern Slovakia and among Slovaks abroad.",
    summary:
      "A Byzantine-rite metropolitan Church sui iuris in Slovakia, centred on Prešov, suppressed under communism and raised to metropolitan status in 2008.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-croatian-and-serbian-greek-catholic",
    title: "Croatian and Serbian Greek Catholic Church",
    riteKey: "byzantine",
    family: "byzantine",
    entryKind: "church_sui_iuris",
    region: "Croatia, Serbia, Bosnia and Herzegovina, Slovenia and Montenegro",
    faithfulEstimate: "About forty thousand faithful",
    history:
      "The Church grew from unions among Byzantine-rite Christians who settled in the Croatian and Hungarian military frontier from the early seventeenth century, and from Rusyn colonists who came to the Bačka region in the eighteenth. Pope Pius VI erected the Eparchy of Križevci for them in 1777. In 2018 Pope Francis erected the Eparchy of Saint Nicholas of Ruski Krstur in Serbia, and the two eparchies together now form this Church sui iuris.",
    background:
      "Its two eparchies — Križevci in Croatia and Ruski Krstur in Serbia — serve Croats, Rusyns, Ukrainians and others of the Byzantine tradition. The Divine Liturgy is celebrated in Church Slavonic, Croatian and Rusyn.",
    summary:
      "A Byzantine-rite Church sui iuris in the western Balkans, comprising the Eparchy of Križevci (1777) and the Eparchy of Ruski Krstur (2018).",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-syriac-catholic",
    title: "Syriac Catholic Church",
    riteKey: "westSyriac",
    family: "west_syriac",
    entryKind: "church_sui_iuris",
    region: "Lebanon, Syria, Iraq and the Holy Land, with a large diaspora; patriarchate at Beirut",
    faithfulEstimate: "Roughly two hundred thousand faithful",
    history:
      "Syriac Christians of the Antiochene tradition sought reunion with Rome repeatedly from the later Middle Ages, and a stable Catholic patriarchal line was secured with Ignatius Michael III Jarweh, elected in 1782 and confirmed by the Holy See. The Church suffered terribly in the massacres of Syriac Christians during the First World War, and again in our own time through the wars in Iraq and Syria, which drove many of its faithful from the plain of Nineveh and from Aleppo into exile.",
    background:
      "It is headed by the Patriarch of Antioch of the Syriacs, whose residence is in Beirut, with eparchies in the Middle East and for the diaspora in Europe, the Americas and Australia. The Qurbono is celebrated in Syriac and Arabic according to the West Syriac tradition.",
    summary:
      "A West Syriac Church sui iuris under the Patriarch of Antioch of the Syriacs, in communion with Rome through the patriarchal line established in 1782.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),
  riteEntry({
    slug: "church-eritrean-catholic",
    title: "Eritrean Catholic Church",
    riteKey: "ethiopic",
    family: "alexandrian",
    entryKind: "church_sui_iuris",
    region: "Eritrea, with its metropolitan see at Asmara",
    faithfulEstimate: "Around a hundred and fifty thousand faithful",
    history:
      "Catholics of the Ge'ez tradition in Eritrea long formed part of the Ethiopian Catholic metropolitan Church. After Eritrea's independence, and in recognition of the distinct situation of its eparchies, Pope Francis in January 2015 erected the Eritrean Catholic Church as a metropolitan Church sui iuris, with the Metropolitan Archeparchy of Asmara and the eparchies of Barentu, Keren and Segheneiti.",
    background:
      "The Church celebrates the Divine Liturgy in the Alexandrian tradition in Ge'ez, the ancient liturgical language of the region. Though small in number, it carries a large share of the country's schools, clinics and works of charity, and its bishops have spoken publicly for the dignity and freedom of the Eritrean people.",
    summary:
      "An Alexandrian (Ge'ez) metropolitan Church sui iuris erected in 2015, centred on the Archeparchy of Asmara in Eritrea.",
    citations: [ORIENTALIUM_ECCLESIARUM, EASTERN_CHURCHES],
  }),

  // ── Uses of the Roman Rite ────────────────────────────────────────────
  riteEntry({
    slug: "rite-bragan",
    title: "Bragan Rite (Rite of Braga)",
    riteKey: "bragan",
    family: "latin",
    entryKind: "latin_use",
    region: "The Archdiocese of Braga in northern Portugal",
    faithfulEstimate: "Celebrated occasionally within one archdiocese",
    history:
      "Braga, the primatial see of Portugal, shaped its own Latin liturgical books in the Middle Ages out of the older Hispanic and Roman materials that met in the north-west of the peninsula. When the Council of Trent allowed the retention of uses already two centuries old, Braga kept its missal and breviary, printing them for its clergy and revising them in the twentieth century. Since the liturgical reform the archdiocese has ordinarily used the Roman books, and the Bragan use is celebrated on particular occasions as a treasured part of its heritage.",
    background:
      "The use is a Latin usage of the Roman Rite rather than a separate rite. Its distinctive features include its own prayers at the preparation of the gifts, proper chants and calendar observances, and ceremonial details that preserve medieval Iberian custom.",
    summary:
      "The ancient Latin use of the Archdiocese of Braga in Portugal, retained after the Council of Trent and still celebrated on special occasions.",
    citations: [SACROSANCTUM_CONCILIUM, DIVINE_WORSHIP],
  }),
  riteEntry({
    slug: "rite-carthusian",
    title: "Carthusian Rite",
    riteKey: "carthusian",
    family: "latin",
    entryKind: "latin_use",
    region: "The charterhouses of the Carthusian Order",
    faithfulEstimate: "Celebrated in the charterhouses of the order",
    history:
      "Saint Bruno withdrew with six companions into the mountains above Grenoble in 1084 and founded the Grande Chartreuse. The customs written down for the order in the following generation fixed a liturgy drawn from the usages of Lyon and Grenoble, deliberately stripped of elaboration to suit a life of solitude. Retained after the Council of Trent as an immemorial use, it was revised after the Second Vatican Council and continues in the charterhouses today.",
    background:
      "The Carthusian use is the plainest of the Western usages: no elaborate ceremonial, a spare chant sung slowly, the celebrant assisted by a single deacon, and the night office sung at length in choir while the rest of the day is spent in the cell. It expresses in liturgy the hidden, contemplative vocation of the order.",
    summary:
      "The austere Latin use of the Carthusian Order, born in the solitude of the Grande Chartreuse and still celebrated in its charterhouses.",
    citations: [SACROSANCTUM_CONCILIUM, DIVINE_WORSHIP],
  }),
  riteEntry({
    slug: "rite-dominican",
    title: "Dominican Rite",
    riteKey: "dominican",
    family: "latin",
    entryKind: "latin_use",
    region: "The Order of Preachers, worldwide",
    faithfulEstimate: "Celebrated by Dominican communities with the permission of their superiors",
    history:
      "The Order of Preachers, confirmed in 1216, needed one liturgy for friars who moved constantly between provinces. Under Blessed Humbert of Romans the order's books were unified in the mid-thirteenth century, drawing on the usages of northern France, and this Dominican use was kept after the Council of Trent as older than two hundred years. Since the liturgical reform the friars ordinarily celebrate the Roman Rite, while the Dominican use continues to be celebrated with the permission of the order's superiors.",
    background:
      "The use is a Latin usage of the Roman Rite marked by brevity and clarity: a simplified preparation of the gifts made before Mass begins, its own chant tradition, distinctive gestures at the elevation, and a calendar rich in Dominican saints such as Saint Dominic, Saint Thomas Aquinas and Saint Catherine of Siena.",
    summary:
      "The Latin use of the Order of Preachers, codified in the thirteenth century and still celebrated with the permission of Dominican superiors.",
    citations: [SACROSANCTUM_CONCILIUM, DIVINE_WORSHIP],
  }),
  riteEntry({
    slug: "rite-anglican-use-divine-worship",
    title: "Anglican Use (Divine Worship)",
    riteKey: "anglicanUse",
    family: "latin",
    entryKind: "latin_use",
    region:
      "The personal ordinariates in the United States and Canada, Great Britain, and Australia and Oceania",
    faithfulEstimate: "Several thousand faithful in three personal ordinariates",
    history:
      "Provision was first made in 1980 for groups of former Anglicans received into the Catholic Church in the United States to keep elements of their liturgical patrimony. On 4 November 2009 Pope Benedict XVI issued the apostolic constitution Anglicanorum coetibus, which erected personal ordinariates for such groups: Our Lady of Walsingham in Great Britain (2011), the Chair of Saint Peter in the United States and Canada (2012), and Our Lady of the Southern Cross in Australia (2012). The liturgical books Divine Worship: The Missal, approved by the Holy See, came into use on the First Sunday of Advent 2015.",
    background:
      "Divine Worship is a use of the Roman Rite, not a separate rite: the same Mass, celebrated with texts and ceremonies that preserve what is Catholic in the Anglican tradition — sacral English in the register of Cranmer's prose, the Prayer of Humble Access, the choral tradition of evensong — within full communion and full Catholic doctrine.",
    summary:
      "A use of the Roman Rite for the personal ordinariates established by Anglicanorum coetibus, celebrated according to Divine Worship: The Missal.",
    citations: [ANGLICANORUM_COETIBUS, SACROSANCTUM_CONCILIUM],
  }),
  riteEntry({
    slug: "rite-zaire-use",
    title: "Zairean Use of the Roman Rite",
    riteKey: "zaire",
    family: "latin",
    entryKind: "latin_use",
    region: "The Democratic Republic of the Congo, and Congolese communities abroad",
    faithfulEstimate: "Celebrated widely in a country with tens of millions of Catholics",
    history:
      "After the Second Vatican Council called for the liturgy to be adapted to the genius of peoples, the bishops of what was then Zaire worked for two decades on an African expression of the Roman Mass. The Roman Missal for the Dioceses of Zaire was approved by the Holy See in 1988 and remains the one inculturated use of the Roman Rite approved for a whole region since the Council. Pope Francis celebrated it in Saint Peter's Basilica in 2019 with the Congolese community of Rome, and again during his visit to Kinshasa in 2023.",
    background:
      "The use keeps the structure and the whole substance of the Roman Mass while giving it a Congolese voice: an announcer who guides the assembly, an invocation of the saints and of ancestors of upright heart, sung and danced processions, and the penitential rite placed after the homily and the creed, before the offertory, so that the assembly asks pardon in the light of the Word it has just heard.",
    summary:
      "The inculturated Congolese use of the Roman Rite, approved in 1988 as the Roman Missal for the Dioceses of Zaire.",
    citations: [SACROSANCTUM_CONCILIUM, DIVINE_WORSHIP],
  }),
];
