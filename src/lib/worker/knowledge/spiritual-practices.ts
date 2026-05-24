import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const USCCB = "https://www.usccb.org/";

function practice(
  slug: string,
  title: string,
  kind:
    | "contemplative_prayer"
    | "lectio_divina"
    | "examen"
    | "fasting"
    | "almsgiving"
    | "pilgrimage"
    | "stations_of_the_cross"
    | "spiritual_direction"
    | "discernment"
    | "vocation"
    | "mortification"
    | "other",
  summary: string,
  instructions: string,
  tradition?: string,
): CuratedEntry {
  return {
    contentType: "SPIRITUAL_PRACTICE",
    slug,
    authorityLevel: "CATECHISM",
    citations: [VATICAN, USCCB],
    payload: {
      slug,
      title,
      summary,
      practiceKind: kind,
      instructions,
      ...(tradition ? { tradition } : {}),
      relatedPrayers: [],
      relatedSaints: [],
      citations: [VATICAN, USCCB],
    },
  };
}

export const spiritualPracticeKnowledge: CuratedEntry[] = [
  practice(
    "ignatian-examen",
    "Ignatian Examen",
    "examen",
    "A daily five-step prayer of review, given by St. Ignatius of Loyola in the Spiritual Exercises.",
    "1. Become aware of God's presence. 2. Review the day with gratitude. 3. Pay attention to your emotions and recall the moments God was present. 4. Choose one feature of the day and pray over it. 5. Look toward tomorrow. The Examen is typically prayed at midday or before sleep, takes about 15 minutes, and is the one prayer St. Ignatius said his Jesuits must never omit.",
    "Ignatian",
  ),
  practice(
    "lectio-divina",
    "Lectio Divina",
    "lectio_divina",
    "An ancient monastic practice of slow, prayerful reading of Sacred Scripture in four movements.",
    "1. Lectio (reading): read a brief passage of Scripture slowly, twice. 2. Meditatio (meditation): reflect on a word or phrase that resonates. 3. Oratio (prayer): respond to God from the heart. 4. Contemplatio (contemplation): rest silently in God's presence. Pope Benedict XVI urged the rediscovery of Lectio Divina in Verbum Domini (2010).",
    "Benedictine",
  ),
  practice(
    "contemplative-prayer",
    "Contemplative Prayer",
    "contemplative_prayer",
    "Wordless prayer of loving attention to God, a gift the Holy Spirit may grant to those who persevere in mental prayer.",
    "St. Teresa of Avila described contemplative prayer as 'taking time frequently to be alone with him who we know loves us.' Begin with vocal prayer, then meditation on a scene from the Gospels or a teaching of the Catechism, allowing the soul to rest in God when it is drawn to silence. The Catechism (CCC 2709-2719) gives a brief introduction.",
    "Carmelite",
  ),
  practice(
    "fasting",
    "Fasting",
    "fasting",
    "Voluntary abstinence from food or other goods as a penitential and spiritual discipline.",
    "Catholics are bound to fast on Ash Wednesday and Good Friday (one full meal and two smaller meals; nothing between meals) and to abstain from meat on Fridays during Lent. Voluntary fasting at other times can take many forms and should be undertaken with prudence and spiritual direction.",
  ),
  practice(
    "almsgiving",
    "Almsgiving",
    "almsgiving",
    "The corporal and spiritual works of mercy: giving to the poor in justice and love as a sign of conversion and a remedy for sin.",
    "The Lord himself said: 'Give alms, and behold, everything will be clean for you' (Luke 11:41). Lent in particular calls for renewed almsgiving alongside prayer and fasting. The Catechism (CCC 2447) names the corporal works: feed the hungry, give drink to the thirsty, clothe the naked, shelter the homeless, visit the sick, visit the imprisoned, bury the dead.",
  ),
  practice(
    "pilgrimage",
    "Pilgrimage",
    "pilgrimage",
    "A journey to a holy place undertaken as an act of devotion, penance, or thanksgiving.",
    "Christians have made pilgrimages since the earliest centuries: to the Holy Land, to Rome (the tombs of Peter and Paul), to Santiago de Compostela, to the great Marian shrines. The Jubilee Year is a pilgrimage of indulgences. A pilgrimage is undertaken in a spirit of prayer, with sacramental confession and Eucharistic communion at the destination.",
  ),
  practice(
    "spiritual-direction",
    "Spiritual Direction",
    "spiritual_direction",
    "The accompaniment of a soul on the path of the spiritual life by a wise and prudent guide.",
    "St. Francis de Sales counseled: 'Have you found a director? Then thank God a thousand times.' A spiritual director is ideally a priest or other formed person who can listen, discern, and counsel. Meet regularly (monthly is common), be honest, and remain faithful to the direction given.",
  ),
  practice(
    "discernment-of-spirits",
    "Discernment of Spirits",
    "discernment",
    "The art of distinguishing the movement of the Holy Spirit from other movements (one's own spirit, the evil spirit).",
    "St. Ignatius of Loyola gave the classical Rules for the Discernment of Spirits in the Spiritual Exercises. Pay attention to consolation (movements toward God, peace, joy) and desolation (movements away from God, restlessness, despair). When in desolation, do not change decisions made in consolation. Seek the counsel of a spiritual director.",
    "Ignatian",
  ),
];
