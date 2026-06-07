import type { CuratedEntry } from "./index";

const GCATHOLIC = "https://gcatholic.org/";
const VATICAN = "https://www.vatican.va/";
const USCCB = "https://www.usccb.org/";

type Designation = "parish" | "shrine" | "cathedral" | "major-basilica" | "minor-basilica";

function parish(
  slug: string,
  title: string,
  designation: Designation,
  address: string,
  city: string,
  opts: {
    state?: string;
    country?: string;
    diocese?: string;
    latitude?: number;
    longitude?: number;
    background: string;
    citations: string[];
  },
): CuratedEntry {
  const payload: Record<string, unknown> = {
    slug,
    title,
    designation,
    address,
    city,
    background: opts.background,
    summary: opts.background.split(". ")[0] + ".",
    citations: opts.citations,
  };
  if (opts.state) payload.state = opts.state;
  if (opts.country) payload.country = opts.country;
  if (opts.diocese) payload.diocese = opts.diocese;
  if (typeof opts.latitude === "number") payload.latitude = opts.latitude;
  if (typeof opts.longitude === "number") payload.longitude = opts.longitude;
  return {
    contentType: "PARISH",
    slug,
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: opts.citations,
    payload,
  };
}

/**
 * Notable, unambiguously real basilicas, cathedrals, and shrines that anchor
 * the parish directory. Locations and designations are drawn from official
 * directory sources (gCatholic, the Holy See, the USCCB). The Admin Worker
 * expands the directory from approved sources well beyond this seed — these
 * are ground-truth records the worker can publish without a live fetch.
 */
export const parishKnowledge: CuratedEntry[] = [
  parish(
    "basilica-saint-peter-vatican",
    "Papal Basilica of Saint Peter in the Vatican",
    "major-basilica",
    "Piazza San Pietro",
    "Vatican City",
    {
      country: "Vatican City State",
      diocese: "Diocese of Rome",
      latitude: 41.9022,
      longitude: 12.4539,
      background:
        "Saint Peter's Basilica, built over the tomb of the Apostle Peter, is the most renowned church of Christendom and the principal papal basilica. The present Renaissance basilica, consecrated in 1626, was designed by Bramante, Michelangelo, Maderno, and Bernini. It is the site of papal liturgies and a destination for pilgrims from around the world.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "archbasilica-saint-john-lateran",
    "Papal Archbasilica of Saint John Lateran",
    "major-basilica",
    "Piazza di San Giovanni in Laterano 4",
    "Rome",
    {
      country: "Italy",
      diocese: "Diocese of Rome",
      latitude: 41.8859,
      longitude: 12.5057,
      background:
        "The Archbasilica of Saint John Lateran is the cathedral of the Diocese of Rome and the official seat of the Pope as Bishop of Rome. Known as 'the mother and head of all churches in Rome and in the world,' it was dedicated in the fourth century under Constantine.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "basilica-saint-mary-major",
    "Papal Basilica of Saint Mary Major",
    "major-basilica",
    "Piazza di Santa Maria Maggiore",
    "Rome",
    {
      country: "Italy",
      diocese: "Diocese of Rome",
      latitude: 41.8976,
      longitude: 12.4983,
      background:
        "The Basilica of Saint Mary Major is the largest church in Rome dedicated to the Blessed Virgin Mary and one of the four papal basilicas. Founded in the fifth century after the Council of Ephesus proclaimed Mary the Mother of God, it preserves ancient mosaics and a relic of the Holy Crib.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "basilica-saint-paul-outside-the-walls",
    "Papal Basilica of Saint Paul Outside the Walls",
    "major-basilica",
    "Piazzale San Paolo 1",
    "Rome",
    {
      country: "Italy",
      diocese: "Diocese of Rome",
      latitude: 41.8587,
      longitude: 12.4769,
      background:
        "The Basilica of Saint Paul Outside the Walls is built over the burial place of the Apostle Paul and is one of the four papal basilicas of Rome. Rebuilt after a fire in 1823, it is famous for its mosaic portraits of every pope.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "basilica-national-shrine-immaculate-conception",
    "Basilica of the National Shrine of the Immaculate Conception",
    "minor-basilica",
    "400 Michigan Avenue NE",
    "Washington",
    {
      state: "DC",
      country: "United States",
      diocese: "Archdiocese of Washington",
      latitude: 38.9331,
      longitude: -76.9967,
      background:
        "The Basilica of the National Shrine of the Immaculate Conception is the largest Roman Catholic church in North America and the patronal church of the United States, dedicated to the Blessed Virgin Mary under her title of the Immaculate Conception, patroness of the nation.",
      citations: [USCCB, GCATHOLIC],
    },
  ),
  parish(
    "cathedral-saint-patrick-new-york",
    "Cathedral of Saint Patrick (New York)",
    "cathedral",
    "5th Avenue",
    "New York",
    {
      state: "NY",
      country: "United States",
      diocese: "Archdiocese of New York",
      latitude: 40.7585,
      longitude: -73.9759,
      background:
        "Saint Patrick's Cathedral is the seat of the Archbishop of New York and a Neo-Gothic landmark on Fifth Avenue in Manhattan. Dedicated in 1879, it is one of the most visited churches in the United States.",
      citations: [USCCB, GCATHOLIC],
    },
  ),
  parish(
    "basilica-saint-mary-minneapolis",
    "Basilica of Saint Mary (Minneapolis)",
    "minor-basilica",
    "1600 Hennepin Avenue",
    "Minneapolis",
    {
      state: "MN",
      country: "United States",
      diocese: "Archdiocese of Saint Paul and Minneapolis",
      latitude: 44.9706,
      longitude: -93.2873,
      background:
        "The Basilica of Saint Mary in Minneapolis was the first basilica established in the United States, designated by Pope Pius XI in 1926. It is a Beaux-Arts landmark and a co-cathedral of its archdiocese.",
      citations: [USCCB, GCATHOLIC],
    },
  ),
  parish(
    "cathedral-basilica-saint-louis",
    "Cathedral Basilica of Saint Louis",
    "minor-basilica",
    "4431 Lindell Boulevard",
    "Saint Louis",
    {
      state: "MO",
      country: "United States",
      diocese: "Archdiocese of Saint Louis",
      latitude: 38.6429,
      longitude: -90.2612,
      background:
        "The Cathedral Basilica of Saint Louis is the seat of the Archbishop of Saint Louis and is renowned for containing one of the largest collections of mosaics in the world. It was designated a basilica by Pope John Paul II in 1997.",
      citations: [USCCB, GCATHOLIC],
    },
  ),
  parish(
    "national-shrine-our-lady-of-guadalupe-la-crosse",
    "National Shrine of Our Lady of Guadalupe (La Crosse)",
    "shrine",
    "5250 Justin Road",
    "La Crosse",
    {
      state: "WI",
      country: "United States",
      diocese: "Diocese of La Crosse",
      latitude: 43.769,
      longitude: -91.203,
      background:
        "The Shrine of Our Lady of Guadalupe in La Crosse, Wisconsin, is a pilgrimage center dedicated to the patroness of the Americas. Established in the early twenty-first century, it includes a devotional church, pilgrim center, and devotional gardens.",
      citations: [USCCB, GCATHOLIC],
    },
  ),
  parish(
    "basilica-our-lady-of-guadalupe-mexico-city",
    "Basilica of Our Lady of Guadalupe",
    "minor-basilica",
    "Plaza de las Américas 1, Villa de Guadalupe",
    "Mexico City",
    {
      country: "Mexico",
      diocese: "Primatial Archdiocese of Mexico",
      latitude: 19.4847,
      longitude: -99.1177,
      background:
        "The Basilica of Our Lady of Guadalupe houses the miraculous tilma of Saint Juan Diego bearing the image of the Blessed Virgin from the 1531 apparitions at Tepeyac. It is the most visited Catholic shrine in the world and the spiritual heart of the Americas.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "sanctuary-our-lady-of-lourdes",
    "Sanctuary of Our Lady of Lourdes",
    "shrine",
    "1 Avenue Monseigneur Théas",
    "Lourdes",
    {
      country: "France",
      diocese: "Diocese of Tarbes and Lourdes",
      latitude: 43.0975,
      longitude: -0.0589,
      background:
        "The Sanctuary of Our Lady of Lourdes marks the 1858 apparitions of the Immaculate Conception to Saint Bernadette Soubirous at the grotto of Massabielle. Millions of pilgrims, many seeking healing, come each year to its spring and basilicas.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "sanctuary-of-fatima",
    "Sanctuary of Our Lady of Fátima",
    "shrine",
    "Santuário de Fátima",
    "Fátima",
    {
      country: "Portugal",
      diocese: "Diocese of Leiria-Fátima",
      latitude: 39.6317,
      longitude: -8.6722,
      background:
        "The Sanctuary of Fátima commemorates the 1917 apparitions of the Blessed Virgin Mary to three shepherd children, Saints Francisco and Jacinta Marto and Lúcia dos Santos. One of the world's great Marian pilgrimage sites.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "basilica-of-saint-francis-of-assisi",
    "Papal Basilica of Saint Francis of Assisi",
    "minor-basilica",
    "Piazza San Francesco 2",
    "Assisi",
    {
      country: "Italy",
      diocese: "Diocese of Assisi-Nocera Umbra-Gualdo Tadino",
      latitude: 43.0749,
      longitude: 12.6055,
      background:
        "The Papal Basilica of Saint Francis of Assisi, begun in 1228, is the burial place of Saint Francis and a treasury of the frescoes of Giotto and the Italian masters. A papal basilica and UNESCO World Heritage Site.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "basilica-sacred-heart-montmartre",
    "Basilica of the Sacred Heart of Paris (Sacré-Cœur)",
    "minor-basilica",
    "35 Rue du Chevalier de la Barre",
    "Paris",
    {
      country: "France",
      diocese: "Archdiocese of Paris",
      latitude: 48.8867,
      longitude: 2.3431,
      background:
        "The Basilica of the Sacred Heart, crowning the hill of Montmartre, was built as a national act of devotion and consecration to the Sacred Heart of Jesus. Perpetual Eucharistic adoration has continued there since 1885.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish(
    "cathedral-notre-dame-de-paris",
    "Cathedral of Notre-Dame de Paris",
    "cathedral",
    "6 Parvis Notre-Dame - Place Jean-Paul II",
    "Paris",
    {
      country: "France",
      diocese: "Archdiocese of Paris",
      latitude: 48.853,
      longitude: 2.3499,
      background:
        "Notre-Dame de Paris, a masterpiece of French Gothic architecture begun in 1163, is the cathedral of the Archdiocese of Paris. Damaged by fire in 2019, it was restored and reopened for worship in 2024.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
  parish("cologne-cathedral", "Cologne Cathedral", "cathedral", "Domkloster 4", "Cologne", {
    country: "Germany",
    diocese: "Archdiocese of Cologne",
    latitude: 50.9413,
    longitude: 6.9583,
    background:
      "Cologne Cathedral, a High Gothic landmark and UNESCO World Heritage Site, is the seat of the Archbishop of Cologne and the reputed shrine of the relics of the Three Magi. Its construction spanned from 1248 to 1880.",
    citations: [VATICAN, GCATHOLIC],
  }),
  parish(
    "westminster-cathedral",
    "Westminster Cathedral",
    "cathedral",
    "42 Francis Street",
    "London",
    {
      country: "United Kingdom",
      diocese: "Archdiocese of Westminster",
      latitude: 51.4963,
      longitude: -0.1397,
      background:
        "Westminster Cathedral is the mother church of the Catholic Church in England and Wales and the seat of the Archbishop of Westminster. Built in a Neo-Byzantine style and opened in 1903, it is famed for its mosaics and music.",
      citations: [VATICAN, GCATHOLIC],
    },
  ),
];
