import type { CuratedEntry } from "./index";

/**
 * The twenty-one ecumenical councils of the Catholic Church — the backbone of
 * the Church-history timeline (`/history`), which places published
 * CHURCH_DOCUMENT items by their issue year. The modern encyclicals and the
 * Vatican II constitutions already ship in `church-documents.ts`; this file
 * adds the councils themselves so the timeline is filled across the whole of
 * Church history, from Nicaea (325) to the Second Vatican Council (1962–65),
 * not only the modern era.
 *
 * These are fixed historical facts (the councils, their years, and what they
 * defined), curated rather than fetched — exactly what the curated knowledge
 * base is for. Each council is a `council_document` record sorted on its
 * opening year; the day component is a sortable `-01-01` placeholder (never a
 * fabricated exact date), matching the convention of the Wikidata council
 * ingestor so curated and structured councils sit on the timeline identically.
 */

function council(
  slug: string,
  title: string,
  year: number,
  wikipediaTitle: string,
  summary: string,
  keyThemes: string[],
): CuratedEntry {
  const canonicalUrl = `https://en.wikipedia.org/wiki/${wikipediaTitle}`;
  const issuedDate = `${String(year).padStart(4, "0")}-01-01`;
  const citations = [canonicalUrl];
  return {
    contentType: "CHURCH_DOCUMENT",
    slug,
    authorityLevel: "TRUSTED_PUBLISHER",
    citations,
    payload: {
      slug,
      title,
      documentType: "council_document",
      issuingAuthority: "Catholic Church",
      issuedDate,
      summary,
      keyThemes,
      canonicalUrl,
      relatedDocuments: [],
      citations,
    },
  };
}

export const churchHistoryKnowledge: CuratedEntry[] = [
  council(
    "first-council-of-nicaea",
    "First Council of Nicaea",
    325,
    "First_Council_of_Nicaea",
    "The first ecumenical council, convened by Emperor Constantine in 325. It condemned Arianism and defined that the Son is consubstantial (homoousios) with the Father — true God from true God — promulgating the original form of the Nicene Creed. It also fixed a common method for calculating the date of Easter.",
    ["Arianism condemned", "Divinity of Christ", "Nicene Creed", "Date of Easter"],
  ),
  council(
    "first-council-of-constantinople",
    "First Council of Constantinople",
    381,
    "First_Council_of_Constantinople",
    "The second ecumenical council (381) affirmed the divinity of the Holy Spirit against the Macedonians (Pneumatomachi) and completed the Nicene Creed into the form professed at Mass today (the Niceno-Constantinopolitan Creed), confessing the Holy Spirit as 'the Lord, the giver of life.'",
    ["Divinity of the Holy Spirit", "Niceno-Constantinopolitan Creed", "Macedonianism condemned"],
  ),
  council(
    "council-of-ephesus",
    "Council of Ephesus",
    431,
    "Council_of_Ephesus",
    "The third ecumenical council (431) condemned Nestorianism and affirmed that the one person of Christ is both God and man, so that Mary is rightly called Theotokos — Mother of God — because the one she bore is the eternal Son made flesh.",
    ["Theotokos (Mother of God)", "Nestorianism condemned", "One person of Christ"],
  ),
  council(
    "council-of-chalcedon",
    "Council of Chalcedon",
    451,
    "Council_of_Chalcedon",
    "The fourth ecumenical council (451) promulgated the Chalcedonian Definition: Christ is one person in two natures, divine and human, 'without confusion, change, division, or separation.' It condemned Monophysitism (Eutychianism).",
    ["Two natures of Christ", "Hypostatic union", "Monophysitism condemned"],
  ),
  council(
    "second-council-of-constantinople",
    "Second Council of Constantinople",
    553,
    "Second_Council_of_Constantinople",
    "The fifth ecumenical council (553) condemned the 'Three Chapters' and reaffirmed the teaching of Chalcedon on the one person of Christ in two natures, clarifying it against lingering Nestorian and Monophysite readings.",
    ["Three Chapters condemned", "Christology", "Chalcedon reaffirmed"],
  ),
  council(
    "third-council-of-constantinople",
    "Third Council of Constantinople",
    681,
    "Third_Council_of_Constantinople",
    "The sixth ecumenical council (680–681) condemned Monothelitism and defined that Christ has two wills and two natural operations, divine and human, in harmony — the human will perfectly subject to the divine will.",
    ["Two wills of Christ", "Monothelitism condemned", "Dyothelitism"],
  ),
  council(
    "second-council-of-nicaea",
    "Second Council of Nicaea",
    787,
    "Second_Council_of_Nicaea",
    "The seventh ecumenical council (787) ended the first iconoclast crisis, affirming the veneration (not adoration) of sacred images of Christ, the Virgin Mary, the angels, and the saints, because the honour given to the image passes to its prototype.",
    ["Veneration of sacred images", "Iconoclasm condemned"],
  ),
  council(
    "fourth-council-of-constantinople",
    "Fourth Council of Constantinople",
    869,
    "Fourth_Council_of_Constantinople",
    "The eighth ecumenical council (869–870) deposed Photius and addressed the Photian schism, upholding the authority of the Roman See and ecclesiastical order in the Eastern Church.",
    ["Photian schism", "Roman primacy", "Church order"],
  ),
  council(
    "first-council-of-the-lateran",
    "First Council of the Lateran",
    1123,
    "First_Council_of_the_Lateran",
    "The ninth ecumenical council (1123), the first held in the West, confirmed the Concordat of Worms that ended the Investiture Controversy and enacted reforms on simony and clerical discipline.",
    ["Investiture Controversy", "Concordat of Worms", "Church reform"],
  ),
  council(
    "second-council-of-the-lateran",
    "Second Council of the Lateran",
    1139,
    "Second_Council_of_the_Lateran",
    "The tenth ecumenical council (1139) ended the schism of the antipope Anacletus II and enacted disciplinary canons, including on clerical celibacy and the marriages of those in major orders.",
    ["End of schism", "Clerical discipline", "Celibacy"],
  ),
  council(
    "third-council-of-the-lateran",
    "Third Council of the Lateran",
    1179,
    "Third_Council_of_the_Lateran",
    "The eleventh ecumenical council (1179) decreed that the election of a pope requires a two-thirds majority of the cardinals — a rule still in force — and legislated against simony and abuses.",
    ["Papal election (two-thirds majority)", "Church reform"],
  ),
  council(
    "fourth-council-of-the-lateran",
    "Fourth Council of the Lateran",
    1215,
    "Fourth_Council_of_the_Lateran",
    "The twelfth ecumenical council (1215), convened by Innocent III, is among the most important of the Middle Ages. It used the term 'transubstantiation' of the Eucharist and required the faithful to confess and receive Communion at least once a year (the Easter duty).",
    ["Transubstantiation", "Easter duty (annual confession and Communion)", "Church reform"],
  ),
  council(
    "first-council-of-lyon",
    "First Council of Lyon",
    1245,
    "First_Council_of_Lyon",
    "The thirteenth ecumenical council (1245) deposed Emperor Frederick II and took up the defence of the Holy Land and the reform of the Church.",
    ["Deposition of Frederick II", "Crusade", "Church reform"],
  ),
  council(
    "second-council-of-lyon",
    "Second Council of Lyon",
    1274,
    "Second_Council_of_Lyon",
    "The fourteenth ecumenical council (1274) sought a (short-lived) reunion with the Eastern Church and established rules for the papal conclave to prevent long vacancies of the Holy See.",
    ["Attempted reunion with the East", "Conclave rules"],
  ),
  council(
    "council-of-vienne",
    "Council of Vienne",
    1311,
    "Council_of_Vienne",
    "The fifteenth ecumenical council (1311–1312) suppressed the Order of the Knights Templar and addressed disputes over Franciscan poverty and Church reform.",
    ["Suppression of the Templars", "Church reform"],
  ),
  council(
    "council-of-constance",
    "Council of Constance",
    1414,
    "Council_of_Constance",
    "The sixteenth ecumenical council (1414–1418) ended the Western Schism — when rival claimants disputed the papacy — by securing the election of Pope Martin V. It also condemned the errors of John Wycliffe and Jan Hus.",
    ["End of the Western Schism", "Election of Martin V", "Wycliffe and Hus condemned"],
  ),
  council(
    "council-of-florence",
    "Council of Florence",
    1431,
    "Council_of_Florence",
    "The seventeenth ecumenical council (Basel–Ferrara–Florence, 1431–1445) worked for reunion with the Eastern churches, producing decrees of union with the Greeks, Armenians, and Copts, and articulated Catholic teaching on the procession of the Holy Spirit and papal primacy.",
    ["Attempted reunion with the East", "Papal primacy", "Procession of the Holy Spirit"],
  ),
  council(
    "fifth-council-of-the-lateran",
    "Fifth Council of the Lateran",
    1512,
    "Fifth_Council_of_the_Lateran",
    "The eighteenth ecumenical council (1512–1517) enacted reform decrees on the eve of the Reformation and affirmed the immortality of the individual human soul against contemporary errors.",
    ["Church reform", "Immortality of the soul"],
  ),
  council(
    "council-of-trent",
    "Council of Trent",
    1545,
    "Council_of_Trent",
    "The nineteenth ecumenical council (1545–1563) was the engine of the Catholic Reformation in response to Protestantism. It defined justification, the seven sacraments, the relationship of Scripture and Tradition, the canon of Scripture, the sacrificial nature of the Mass, and decreed sweeping reform of clergy and seminaries.",
    ["Justification", "Seven sacraments", "Scripture and Tradition", "Catholic Reformation"],
  ),
  council(
    "first-vatican-council",
    "First Vatican Council",
    1869,
    "First_Vatican_Council",
    "The twentieth ecumenical council (1869–1870) defined, in Pastor Aeternus, the primacy and infallible teaching authority of the Roman Pontiff when he defines doctrine on faith or morals ex cathedra, and in Dei Filius the harmony of faith and reason.",
    ["Papal infallibility", "Papal primacy", "Faith and reason"],
  ),
  council(
    "second-vatican-council",
    "Second Vatican Council",
    1962,
    "Second_Vatican_Council",
    "The twenty-first and most recent ecumenical council (1962–1965) was a pastoral council that renewed the Church's self-understanding and mission. Its sixteen documents — among them Lumen Gentium, Dei Verbum, Sacrosanctum Concilium, and Gaudium et Spes — addressed the Church, divine revelation, the liturgy, and the Church in the modern world.",
    [
      "Church (Lumen Gentium)",
      "Divine revelation",
      "Liturgical renewal",
      "Church in the modern world",
    ],
  ),
];
