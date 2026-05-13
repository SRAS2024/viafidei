import type { LiturgyEntrySeed } from "./liturgyEntries";

/**
 * One LiturgyEntry per Catholic rite, anchored at the rite's recognised
 * inception/establishment date. Each row uses slug prefix
 * `church-history-rite-` so it surfaces on the timeline alongside the
 * other historical events, with the rite name visible in the title.
 *
 * Dates here are the historically attested origin of the rite's
 * liturgical and canonical identity (not its modern juridical status,
 * which Pope Leo XIII recognised in Orientalium Dignitas in 1894).
 * Each rite remains in full communion with the Bishop of Rome.
 */
export const RITE_HISTORY_ENTRIES: LiturgyEntrySeed[] = [
  {
    slug: "church-history-rite-roman",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Roman (Latin) Rite",
    summary: "The liturgical and canonical tradition of the Church of Rome.",
    body: `The Roman Rite — the historic liturgical and canonical tradition of the Church of Rome — traces its lineage to the Apostolic age and the See established by Saint Peter (c. 33–67 AD). The liturgy took shape in the Roman city through the patristic period and was standardised in successive editions of the Roman Missal, most recently in the 1969 reform under Pope Saint Paul VI (Novus Ordo) and in the 2002 third typical edition under Pope Saint John Paul II.

The Roman Rite is the largest of the Catholic rites and is the default liturgical form for the Latin Church.`,
  },
  {
    slug: "church-history-rite-byzantine",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Byzantine Rite (4th century)",
    summary: "The liturgical tradition of Constantinople, shared by many Eastern Catholic Churches.",
    body: `The Byzantine Rite developed in the 4th century in the city of Constantinople (founded as the new imperial capital in 330 AD by Constantine the Great). Its principal liturgies — the Divine Liturgies of Saint John Chrysostom (c. 397–407) and Saint Basil the Great (c. 370) — became the dominant liturgical form throughout the Eastern Roman Empire.

Several Catholic Churches in full communion with Rome use the Byzantine Rite, including the Ukrainian Greek Catholic Church, the Melkite Greek Catholic Church, the Ruthenian Catholic Church, and others.`,
  },
  {
    slug: "church-history-rite-maronite",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Maronite Rite (5th century)",
    summary: "The West Syriac liturgical tradition of the Maronite Catholic Church.",
    body: `The Maronite Catholic Church traces its origin to the disciples of Saint Maron (c. 350–410), a Syriac Christian hermit and ascetic, and to the founding of the Monastery of Saint Maron in the 5th century in what is now Syria. The Maronite community is recognised as having maintained continuous communion with the Bishop of Rome throughout the divisions of Christian history.

The Maronite Rite is a West Syriac liturgy whose anaphora is attributed to Saint James the Lesser. Its Patriarch of Antioch and All the East presides from Bkerké, Lebanon.`,
  },
  {
    slug: "church-history-rite-chaldean",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Chaldean Rite (lineage of the Church of the East)",
    summary: "The East Syriac liturgical tradition; the Chaldean Catholic Church entered communion with Rome in 1552.",
    body: `The Chaldean Catholic Church uses the East Syriac liturgical tradition, which descends from the Church of the East with apostolic roots attributed to Saints Thomas, Addai, and Mari. The Chaldean Patriarchate entered into full communion with the Bishop of Rome in 1552, when Patriarch Yohannan Sulaqa was confirmed in Rome by Pope Julius III.

The principal anaphora is the Holy Qurbana of Addai and Mari, one of the most ancient eucharistic prayers in continuous use. The Chaldean Patriarch of Babylon presides from Baghdad, Iraq.`,
  },
  {
    slug: "church-history-rite-coptic",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Coptic Rite (apostolic age in Egypt)",
    summary: "The Alexandrian liturgical tradition; the Coptic Catholic Church entered communion with Rome in 1741.",
    body: `The Coptic Catholic Church uses the Alexandrian (Coptic) Rite, which descends from the Church of Alexandria founded by Saint Mark the Evangelist (c. 42 AD). The Coptic Catholic Patriarchate entered into full communion with the Bishop of Rome in 1741 under Pope Benedict XIV.

The principal anaphoras are those of Saint Mark (also called Saint Cyril), Saint Basil, and Saint Gregory Nazianzen. The Coptic Catholic Patriarch of Alexandria presides from Cairo, Egypt.`,
  },
  {
    slug: "church-history-rite-syro-malabar",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Syro-Malabar Rite (apostolic age in India)",
    summary: "The East Syriac tradition among the Thomas Christians of Kerala, India.",
    body: `The Syro-Malabar Catholic Church traces its origin to the mission of the Apostle Saint Thomas in India (traditionally 52 AD). Throughout the patristic and medieval periods the Thomas Christians of Kerala were ecclesiastically linked to the Church of the East.

The Syro-Malabar Church has been in continuous full communion with the Bishop of Rome since the Synod of Diamper in 1599. The Major Archbishop of Ernakulam-Angamaly heads the Church from Kerala, India.`,
  },
  {
    slug: "church-history-rite-syro-malankara",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Syro-Malankara Rite (1930)",
    summary: "The West Syriac liturgical tradition; entered communion with Rome in 1930.",
    body: `The Syro-Malankara Catholic Church entered into full communion with the Bishop of Rome on 20 September 1930 under Mar Ivanios, formerly a metropolitan of the Malankara Orthodox Syrian Church. The Church uses the West Syriac liturgical tradition.

The Major Archbishop-Catholicos of Trivandrum presides over the Church from Kerala, India.`,
  },
  {
    slug: "church-history-rite-armenian",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Armenian Rite (4th century)",
    summary: "The liturgical tradition of the Armenian Catholic Church; entered communion with Rome in 1742.",
    body: `The Armenian liturgical tradition descends from the evangelisation of Armenia by Saint Gregory the Illuminator in 301 AD, making Armenia the first nation to embrace Christianity as a state religion. The Armenian Catholic Church entered into full communion with the Bishop of Rome in 1742 under Pope Benedict XIV.

The principal liturgy is the Holy Patarag attributed to Saint Athanasius. The Catholicos-Patriarch of Cilicia of the Armenians presides from Bzoummar, Lebanon.`,
  },
  {
    slug: "church-history-rite-ethiopic",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Ethiopic (Ge'ez) Rite (4th century)",
    summary: "The Alexandrian liturgical tradition in the Ethiopian and Eritrean Catholic Churches.",
    body: `The Ethiopic Rite developed from the evangelisation of the Kingdom of Aksum in the 4th century by Saints Frumentius and Aedesius. The Ethiopian Catholic Church and the Eritrean Catholic Church use this liturgy in the classical Ge'ez language.

The Ethiopian Catholic Metropolitan Archeparchy was established by Pope Pius XII in 1961; the Eritrean Catholic Church was established as a sui iuris Metropolitan Church by Pope Francis in 2015.`,
  },
  {
    slug: "church-history-rite-melkite",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Melkite Greek Catholic Church (1724)",
    summary: "Byzantine-Rite faithful of Antioch in communion with Rome since 1724.",
    body: `The Melkite Greek Catholic Church formally entered into full communion with the Bishop of Rome in 1724, when Cyril VI Tanas was elected Patriarch of Antioch by the Catholic-leaning faction at Damascus and confirmed by Pope Benedict XIII in 1729. The Melkites use the Byzantine Rite in Arabic and Greek.

The Patriarch of Antioch and All the East, of Alexandria and of Jerusalem of the Melkite Greek Catholic Church presides from Damascus, Syria.`,
  },
  {
    slug: "church-history-rite-ukrainian",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Ukrainian Greek Catholic Church (Union of Brest, 1596)",
    summary: "Byzantine-Rite Catholic Church of Kyiv and Rus' in communion with Rome since 1596.",
    body: `The Ukrainian Greek Catholic Church traces its full communion with the Bishop of Rome to the Union of Brest in 1595–1596, when most of the bishops of the Metropolitanate of Kyiv accepted the universal primacy of the Pope while retaining the Byzantine liturgical and canonical tradition.

The Major Archbishop of Kyiv-Halych presides from Kyiv, Ukraine. The Church endured Soviet suppression from 1946 to 1989 and was legally restored at the collapse of the Soviet Union.`,
  },
  {
    slug: "church-history-rite-ruthenian",
    kind: "COUNCIL_TIMELINE",
    title: "Establishment of the Ruthenian Catholic Church (Union of Uzhhorod, 1646)",
    summary: "Byzantine-Rite Catholic Church centred in the Carpathian region, in communion with Rome since 1646.",
    body: `The Ruthenian Catholic Church traces its communion with the Bishop of Rome to the Union of Uzhhorod on 24 April 1646, when 63 Eastern Orthodox priests of the Eparchy of Mukachevo entered into communion with the Catholic Church under terms similar to the earlier Union of Brest.

The Ruthenian Metropolitan See of Pittsburgh (United States) was raised to a Metropolia by Pope Saint John Paul II in 1969. A second Metropolia centred in the Eparchy of Mukachevo (Ukraine) also exists.`,
  },
];
