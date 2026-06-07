import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const NEWADVENT = "https://www.newadvent.org/cathen/";

function rite(
  slug: string,
  riteKey: string,
  title: string,
  history: string,
  background: string,
): CuratedEntry {
  return {
    contentType: "RITE",
    slug,
    authorityLevel: "VATICAN",
    citations: [VATICAN, NEWADVENT],
    payload: {
      slug,
      title,
      riteKey,
      history,
      background,
      summary: `${title}, one of the liturgical traditions of the Catholic Church.`,
      citations: [VATICAN, NEWADVENT],
    },
  };
}

/**
 * The recognized rites and liturgical traditions of the Catholic Church — the
 * Latin (Roman) Rite of the West and the great Eastern Catholic traditions,
 * all in full communion with the Bishop of Rome. Slugs and rite keys match the
 * canonical list in content-shared/rites.ts. Ground-truth content the worker
 * can publish without a live fetch.
 */
export const riteKnowledge: CuratedEntry[] = [
  rite(
    "rite-roman",
    "roman",
    "Roman (Latin) Rite",
    "The Roman Rite developed in the city of Rome and became the predominant liturgical tradition of the Western Church. Codified after the Council of Trent (1570) and revised after the Second Vatican Council (1969-70), it is the rite of the vast majority of Latin Catholics worldwide.",
    "The Roman Rite is the most widely used liturgical tradition in the Catholic Church. It includes the Mass, the Liturgy of the Hours, and the celebration of the sacraments according to the books promulgated for the Latin Church.",
  ),
  rite(
    "rite-byzantine",
    "byzantine",
    "Byzantine Rite",
    "The Byzantine Rite took shape in Constantinople, drawing on the liturgical heritage of Antioch and the city's great churches. It is followed by the largest family of Eastern Catholic Churches, who use the Divine Liturgies of Saint John Chrysostom and Saint Basil the Great.",
    "The Byzantine Rite is shared by many Eastern Catholic Churches sui iuris, including the Melkite, Ukrainian, Ruthenian, Romanian, and others, all in full communion with the Pope.",
  ),
  rite(
    "rite-maronite",
    "maronite",
    "Maronite Rite",
    "The Maronite Church traces its origin to Saint Maron, a fourth-century Syrian hermit, and his disciples. Centered in Lebanon, it has remained in unbroken communion with Rome and preserves the West Syriac (Antiochene) liturgical tradition with its own distinctive usages.",
    "The Maronite Rite belongs to the West Syriac liturgical family. Its Qurbono (Divine Liturgy) preserves ancient Syriac prayers, including words traditionally held to come from the language of Christ.",
  ),
  rite(
    "rite-chaldean",
    "chaldean",
    "Chaldean Rite",
    "The Chaldean Catholic Church descends from the ancient Church of the East in Mesopotamia and entered into full communion with Rome in the sixteenth century. It follows the East Syriac liturgical tradition centered on the Holy Qurbana of the Apostles Addai and Mari.",
    "The Chaldean Rite is part of the East Syriac liturgical family, historically centered in Iraq and the surrounding region.",
  ),
  rite(
    "rite-coptic",
    "coptic",
    "Coptic Rite",
    "The Coptic Catholic Church arises from the ancient Christian tradition of Egypt, attributed to the preaching of Saint Mark. It follows the Alexandrian liturgical tradition and entered into full communion with Rome in the nineteenth century.",
    "The Coptic Rite belongs to the Alexandrian liturgical family and uses the Divine Liturgy of Saint Basil and other ancient Egyptian anaphoras.",
  ),
  rite(
    "rite-syro-malabar",
    "syroMalabar",
    "Syro-Malabar Rite",
    "The Syro-Malabar Church of Kerala, India, traces its origins to the evangelization attributed to Saint Thomas the Apostle. It follows the East Syriac tradition and is one of the largest Eastern Catholic Churches.",
    "The Syro-Malabar Rite belongs to the East Syriac liturgical family and celebrates the Holy Qurbana in the tradition of the Saint Thomas Christians of India.",
  ),
  rite(
    "rite-syro-malankara",
    "syroMalankara",
    "Syro-Malankara Rite",
    "The Syro-Malankara Catholic Church of India entered into full communion with Rome in 1930 under the leadership of Mar Ivanios. It preserves the West Syriac (Antiochene) liturgical tradition.",
    "The Syro-Malankara Rite belongs to the West Syriac liturgical family and uses the Holy Qurbono according to the tradition of Antioch.",
  ),
  rite(
    "rite-armenian",
    "armenian",
    "Armenian Rite",
    "The Armenian Catholic Church preserves the distinctive liturgical tradition of Armenia, the first nation to embrace Christianity as its state religion (AD 301). The Armenian Catholics entered into full communion with Rome and are governed by their own Patriarch of Cilicia.",
    "The Armenian Rite is a liturgical tradition of its own family, with elements drawn from the Byzantine and Syriac traditions, celebrated in classical Armenian.",
  ),
  rite(
    "rite-ethiopic",
    "ethiopic",
    "Ethiopic (Ge'ez) Rite",
    "The Ethiopic Catholic tradition arises from the ancient Christianity of Ethiopia and Eritrea and follows the Alexandrian liturgical family in the Ge'ez language. The Ethiopian and Eritrean Catholic Churches preserve this venerable heritage in communion with Rome.",
    "The Ethiopic Rite belongs to the Alexandrian liturgical family and is celebrated in Ge'ez, the classical liturgical language of Ethiopia.",
  ),
  rite(
    "rite-melkite",
    "melkite",
    "Melkite Greek Rite",
    "The Melkite Greek Catholic Church, centered in the Middle East, follows the Byzantine liturgical tradition in Arabic and Greek. It entered into full communion with Rome in the eighteenth century and is led by the Patriarch of Antioch.",
    "The Melkite Rite is a usage of the Byzantine liturgical tradition, prominent in Syria, Lebanon, and the wider Antiochene region.",
  ),
  rite(
    "rite-ukrainian",
    "ukrainian",
    "Ukrainian Greek Catholic Rite",
    "The Ukrainian Greek Catholic Church, the largest Eastern Catholic Church, follows the Byzantine tradition received from Constantinople. Its communion with Rome was renewed at the Union of Brest (1596). It endured severe persecution under Soviet rule.",
    "The Ukrainian Greek Catholic Rite is a usage of the Byzantine liturgical tradition, celebrated chiefly in Church Slavonic and Ukrainian.",
  ),
  rite(
    "rite-ruthenian",
    "ruthenian",
    "Ruthenian Rite",
    "The Ruthenian (Byzantine Catholic) Church traces its communion with Rome to the Union of Uzhhorod (1646). It follows the Byzantine liturgical tradition and is established in Central Europe and the United States.",
    "The Ruthenian Rite is a usage of the Byzantine liturgical tradition, served in Church Slavonic and English.",
  ),
];
