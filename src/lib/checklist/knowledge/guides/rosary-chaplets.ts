import type { CuratedEntry } from "../index";

/**
 * Guides — sections A (Rosary) and B (Chaplets).
 *
 * Every step body is written to be read aloud from the page: prayer names
 * are spelled out (PrayerLinkedText makes them expandable), versicles and
 * responses are given in full, and nothing is presented as a norm that the
 * Church does not actually ask for. Private-revelation "promises" are
 * deliberately omitted throughout.
 */

// USCCB pages (the section pages sit behind a JS connection check for
// non-browser clients, but all three render normally in a browser).
const U_ROSARY = "https://www.usccb.org/how-to-pray-the-rosary";
const U_ROSARIES = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/rosaries";
const U_DEV = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions";

// Vatican documents.
const V_RVM =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";
const V_DPP =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const V_DV =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html";
const V_FC =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_19811122_familiaris-consortio.html";
const V_FAUST =
  "https://www.vatican.va/content/john-paul-ii/en/homilies/2000/documents/hf_jp-ii_hom_20000430_faustina.html";
const V_DMD =
  "https://www.vatican.va/roman_curia/tribunals/apost_penit/documents/rc_trib_appen_doc_20020629_decree-ii_en.html";
const V_DIM =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_30111980_dives-in-misericordia.html";

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  kind: "rosary" | "chaplet";
  authorityLevel: "USCCB" | "VATICAN";
  citations: string[];
  intro: string;
  whatYouNeed: string[];
  whenToPray: string;
  tips: string[];
  steps: Step[];
  durationMinutes: number;
  relatedPrayers: string[];
  relatedDevotions?: string[];
  relatedPractices?: string[];
  relatedSaints?: string[];
}

function guide(g: GuideInput): CuratedEntry {
  return {
    contentType: "GUIDE",
    slug: g.slug,
    authorityLevel: g.authorityLevel,
    citations: g.citations,
    payload: {
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      kind: g.kind,
      intro: g.intro,
      whatYouNeed: g.whatYouNeed,
      whenToPray: g.whenToPray,
      tips: g.tips,
      steps: g.steps,
      durationMinutes: g.durationMinutes,
      relatedPrayers: g.relatedPrayers,
      relatedDevotions: g.relatedDevotions ?? [],
      relatedPractices: g.relatedPractices ?? [],
      relatedSaints: g.relatedSaints ?? [],
      citations: g.citations,
    },
  };
}

/** Shared step text: how a decade is prayed. */
const DECADE_HOW =
  'Pray the Our Father on the large bead, then ten Hail Marys on the small beads while holding the mystery in mind, then the Glory Be and the Fatima Prayer: "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of Thy mercy."';

const ROSARY_OPENING_STEP: Step = {
  order: 1,
  title: "Open the Rosary",
  body: "Make the Sign of the Cross. Holding the crucifix, pray the Apostles' Creed. On the first large bead pray the Our Father; on the next three small beads pray one Hail Mary each, traditionally for an increase of faith, hope and charity; then pray the Glory Be. You are now ready to announce the first mystery.",
};

const ROSARY_CLOSING_STEP = (order: number): Step => ({
  order,
  title: "Close the Rosary",
  body: "After the fifth decade pray the Hail, Holy Queen (Salve Regina), then: V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ. Let us pray: O God, whose only begotten Son, by his life, death and resurrection, has purchased for us the rewards of eternal life; grant, we beseech thee, that by meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen. Many add the Prayer to Saint Michael. End with the Sign of the Cross.",
});

const ROSARY_PRAYERS = [
  "sign-of-the-cross",
  "apostles-creed",
  "our-father",
  "hail-mary",
  "glory-be",
  "fatima-prayer",
  "salve-regina",
  "prayer-to-saint-michael",
];

export const rosaryAndChapletGuides: CuratedEntry[] = [
  // ───────────────────────────── A. ROSARY ─────────────────────────────
  guide({
    slug: "how-to-pray-the-rosary",
    title: "How to Pray the Holy Rosary",
    summary:
      "Step by step through the Rosary on an ordinary five-decade rosary: the opening prayers, the five mysteries with their decades, and the closing prayers.",
    kind: "rosary",
    authorityLevel: "USCCB",
    citations: [U_ROSARY, V_RVM],
    intro:
      "The Rosary is a Scripture-based prayer of the Latin Church. Though clearly Marian in character, it is at heart a Christocentric prayer: while the lips repeat the Our Father, the Hail Mary and the Glory Be, the mind rests on twenty mysteries of the life, death and glory of Jesus, seen through the eyes of his Mother. The gentle repetition is not the point; it is the quiet that lets the mystery sink in. It can be prayed alone or with others, in twenty minutes or a single decade.",
    whatYouNeed: [
      "A rosary (a crucifix, an opening set of five beads, and five decades of ten beads)",
      "Today's set of mysteries — see the Mysteries section below this guide",
      "About twenty unhurried minutes",
      "Optionally a Bible, to read a short passage before each mystery",
    ],
    whenToPray:
      "Any time of day; many Catholics pray it daily. The mysteries traditionally follow the day of the week: Joyful on Monday and Saturday, Sorrowful on Tuesday and Friday, Glorious on Wednesday and Sunday, Luminous on Thursday. In Advent the Joyful and in Lent the Sorrowful Mysteries may replace the Glorious on Sundays.",
    tips: [
      "Short on time? Pray a single decade well rather than five in a rush. The Church has never required all five at one sitting.",
      "Use the Mysteries section below to choose today's set and to read the Scripture and 'fruit' for each mystery before you announce it.",
      "Distractions are normal. When you notice one, simply return to the mystery; do not start the decade over.",
      "A brief pause after announcing each mystery, and a phrase of Scripture, turns repetition into contemplation, as Saint John Paul II recommends in Rosarium Virginis Mariae.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Make the Sign of the Cross and pray the Apostles' Creed",
        body: "Take the rosary in your hand and make the Sign of the Cross. Holding the crucifix, pray the Apostles' Creed, which sums up the mysteries of faith you are about to contemplate.",
      },
      {
        order: 2,
        title: "Pray the opening prayers on the first beads",
        body: "On the first large bead pray the Our Father. On each of the next three small beads pray a Hail Mary; these are traditionally offered for an increase of faith, hope and charity. On the chain or space before the medal, pray the Glory Be.",
      },
      {
        order: 3,
        title: "Announce the first mystery and pray the Our Father",
        body: 'Choose today\'s set of mysteries (Joyful, Sorrowful, Glorious or Luminous) and announce the first one aloud or in your heart, for example: "The first Joyful Mystery: the Annunciation." You may read a short Scripture passage. Then pray the Our Father on the large bead.',
      },
      {
        order: 4,
        title: "Pray ten Hail Marys while meditating on the mystery",
        body: "On each of the ten small beads pray one Hail Mary. Keep the mystery before your mind as you pray: picture the scene, listen to its words, and let it speak to your own life. The words of the prayer carry you; the mystery is what you are looking at.",
      },
      {
        order: 5,
        title: "Close the decade with the Glory Be and the Fatima Prayer",
        body: 'After the tenth Hail Mary pray the Glory Be. Many then add the prayer Our Lady asked for at Fatima, commonly called the Fatima Prayer: "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of Thy mercy."',
      },
      {
        order: 6,
        title: "Repeat for the remaining four mysteries",
        body: "Announce the second mystery on the next large bead and pray the Our Father, ten Hail Marys, the Glory Be and the Fatima Prayer as before. Continue in the same way through the third, fourth and fifth mysteries until you return to the medal.",
      },
      {
        order: 7,
        title: "Pray the Hail, Holy Queen and the closing prayer",
        body: "Pray the Hail, Holy Queen (Salve Regina). Then: V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ. Let us pray: O God, whose only begotten Son, by his life, death and resurrection, has purchased for us the rewards of eternal life; grant, we beseech thee, that by meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.",
      },
      {
        order: 8,
        title: "Conclude with the Sign of the Cross",
        body: "Many add the Prayer to Saint Michael, and a prayer to Saint Joseph may also follow, as the USCCB notes. Conclude the Rosary with the Sign of the Cross, and carry the mystery you prayed into the rest of your day.",
      },
    ],
    relatedPrayers: ROSARY_PRAYERS,
    relatedDevotions: ["holy-rosary"],
    relatedSaints: ["saint-dominic", "saint-louis-de-montfort", "saint-john-paul-ii"],
  }),

  guide({
    slug: "joyful-mysteries-of-the-rosary",
    title: "Praying the Joyful Mysteries",
    summary:
      "Meditations, Scripture and the traditional fruits for the five Joyful Mysteries, prayed on Mondays and Saturdays and on the Sundays of Advent.",
    kind: "rosary",
    authorityLevel: "VATICAN",
    citations: [V_RVM, U_ROSARY],
    intro:
      "The Joyful Mysteries walk through the Incarnation as Saint Luke tells it: the angel's message, Mary's visit to Elizabeth, the birth at Bethlehem, the presentation of the child in the Temple, and the finding of the twelve-year-old Jesus among the teachers. Saint John Paul II calls them mysteries 'marked by the joy radiating from the event of the Incarnation'. Praying them, we learn to receive Christ as Mary did: with humility, haste to serve, poverty, obedience and the joy of finding him again.",
    whatYouNeed: [
      "A rosary",
      "A Bible or the passages listed in each step",
      "About twenty quiet minutes",
    ],
    whenToPray:
      "Mondays and Saturdays, and on the Sundays of Advent; also whenever you want to contemplate the Incarnation, for example in the Christmas season.",
    tips: [
      "Read the Gospel passage before announcing the mystery and keep one phrase from it in mind through the ten Hail Marys.",
      "The 'fruit' of each mystery is a traditional grace to ask for; make it your intention for that decade.",
      "If you have only a few minutes, pray one decade and its mystery well.",
    ],
    durationMinutes: 20,
    steps: [
      ROSARY_OPENING_STEP,
      {
        order: 2,
        title: "The First Joyful Mystery: the Annunciation",
        body: `Scripture: Luke 1:26-38. The angel Gabriel is sent to a virgin of Nazareth, and Mary answers: "Behold, I am the handmaid of the Lord; let it be done to me according to your word." Fruit of the mystery: humility. ${DECADE_HOW}`,
      },
      {
        order: 3,
        title: "The Second Joyful Mystery: the Visitation",
        body: `Scripture: Luke 1:39-56. Mary sets out in haste to the hill country to help her kinswoman Elizabeth; the child leaps in Elizabeth's womb and Mary sings the Magnificat. Fruit of the mystery: love of neighbour. ${DECADE_HOW}`,
      },
      {
        order: 4,
        title: "The Third Joyful Mystery: the Nativity",
        body: `Scripture: Luke 2:1-20. In Bethlehem Mary gives birth to her firstborn son, wraps him in swaddling clothes and lays him in a manger, and the shepherds come to find him. Fruit of the mystery: poverty of spirit. ${DECADE_HOW}`,
      },
      {
        order: 5,
        title: "The Fourth Joyful Mystery: the Presentation in the Temple",
        body: `Scripture: Luke 2:22-38. Mary and Joseph bring the child to Jerusalem to present him to the Lord according to the Law; Simeon takes him in his arms and Anna gives thanks. Fruit of the mystery: obedience, and purity of heart. ${DECADE_HOW}`,
      },
      {
        order: 6,
        title: "The Fifth Joyful Mystery: the Finding in the Temple",
        body: `Scripture: Luke 2:41-52. After three days of searching, Mary and Joseph find the twelve-year-old Jesus in the Temple among the teachers: "Did you not know that I must be in my Father's house?" Fruit of the mystery: joy in finding Jesus, and devotion to him. ${DECADE_HOW}`,
      },
      ROSARY_CLOSING_STEP(7),
    ],
    relatedPrayers: ROSARY_PRAYERS,
    relatedDevotions: ["holy-rosary"],
    relatedSaints: ["saint-joseph", "saint-luke-the-evangelist"],
  }),

  guide({
    slug: "sorrowful-mysteries-of-the-rosary",
    title: "Praying the Sorrowful Mysteries",
    summary:
      "The five Sorrowful Mysteries of the Passion, prayed on Tuesdays and Fridays and on the Sundays of Lent: the Agony, the Scourging, the Crowning with Thorns, the Carrying of the Cross and the Crucifixion.",
    kind: "rosary",
    authorityLevel: "VATICAN",
    citations: [V_RVM, U_ROSARY],
    intro:
      "The Sorrowful Mysteries follow Jesus from Gethsemane to Calvary. The Gospels give them great prominence, and the Rosary has always singled out five moments of the Passion for the faithful to contemplate. Praying them is not morbid; it is the way, as Saint John Paul II writes, to 'relive the death of Jesus' and to discover there the cause of our salvation and the depth of God's love for us.",
    whatYouNeed: [
      "A rosary",
      "A Bible or the passages listed in each step",
      "About twenty quiet minutes",
    ],
    whenToPray:
      "Tuesdays and Fridays, and on the Sundays of Lent; also fitting on Good Friday, in times of suffering, and when praying for the dying.",
    tips: [
      "Pray these mysteries slowly. The Passion narratives reward a single line held in the heart through the whole decade.",
      "Offer each decade for someone who is suffering now.",
      "Combine them on Fridays of Lent with the Stations of the Cross for a fuller contemplation of the Passion.",
    ],
    durationMinutes: 20,
    steps: [
      ROSARY_OPENING_STEP,
      {
        order: 2,
        title: "The First Sorrowful Mystery: the Agony in the Garden",
        body: `Scripture: Luke 22:39-46 (also Matthew 26:36-46). In Gethsemane Jesus prays, "Father, if you are willing, take this cup from me; yet not my will but yours be done," and his sweat falls like drops of blood. Fruit of the mystery: sorrow for sin. ${DECADE_HOW}`,
      },
      {
        order: 3,
        title: "The Second Sorrowful Mystery: the Scourging at the Pillar",
        body: `Scripture: John 19:1 (also Mark 15:15). Pilate has Jesus scourged. The innocent one is beaten for the sins of the world. Fruit of the mystery: purity, and mortification of the senses. ${DECADE_HOW}`,
      },
      {
        order: 4,
        title: "The Third Sorrowful Mystery: the Crowning with Thorns",
        body: `Scripture: Matthew 27:27-31. The soldiers weave a crown of thorns, put a reed in his hand and mock him: "Hail, King of the Jews!" Fruit of the mystery: moral courage. ${DECADE_HOW}`,
      },
      {
        order: 5,
        title: "The Fourth Sorrowful Mystery: the Carrying of the Cross",
        body: `Scripture: Luke 23:26-32 (also John 19:17). Jesus carries his cross to Golgotha; Simon of Cyrene is made to help him, and the women of Jerusalem weep for him. Fruit of the mystery: patience in bearing our own crosses. ${DECADE_HOW}`,
      },
      {
        order: 6,
        title: "The Fifth Sorrowful Mystery: the Crucifixion and Death of Our Lord",
        body: `Scripture: Luke 23:33-46 (also John 19:18-30). Jesus is nailed to the cross between two criminals, forgives his executioners, entrusts his Mother to the beloved disciple, and gives up his spirit. Fruit of the mystery: perseverance, and the grace of a holy death. ${DECADE_HOW}`,
      },
      ROSARY_CLOSING_STEP(7),
    ],
    relatedPrayers: ROSARY_PRAYERS,
    relatedDevotions: ["holy-rosary", "stations-of-the-cross"],
    relatedSaints: ["saint-mary-magdalene", "saint-john-paul-ii"],
  }),

  guide({
    slug: "glorious-mysteries-of-the-rosary",
    title: "Praying the Glorious Mysteries",
    summary:
      "The five Glorious Mysteries, prayed on Wednesdays and Sundays: the Resurrection, the Ascension, the Descent of the Holy Spirit, the Assumption and the Coronation of Mary.",
    kind: "rosary",
    authorityLevel: "VATICAN",
    citations: [V_RVM, U_ROSARIES],
    intro:
      "The Glorious Mysteries contemplate the goal of the whole Gospel: Christ risen and ascended, the Spirit poured out on the Church, and Mary, the first of the redeemed, taken body and soul into glory and crowned. Saint John Paul II notes that these mysteries nourish the hope of Christians and reveal the destiny prepared for all who follow Christ. They are the Church's Sunday prayer.",
    whatYouNeed: [
      "A rosary",
      "A Bible or the passages listed in each step",
      "About twenty quiet minutes",
    ],
    whenToPray:
      "Wednesdays and Sundays (outside Advent and Lent); fitting throughout the Easter season, on the Ascension, at Pentecost and on 15 August, the Solemnity of the Assumption.",
    tips: [
      "Let these decades be prayers of hope: bring to them the people and situations that seem beyond repair.",
      "In the Easter season, pray the Regina Caeli instead of the Angelus, and consider ending the Rosary with it.",
      "The fourth and fifth mysteries are drawn from the Church's faith rather than a single Gospel scene; Revelation 12:1 is the traditional passage to read.",
    ],
    durationMinutes: 20,
    steps: [
      ROSARY_OPENING_STEP,
      {
        order: 2,
        title: "The First Glorious Mystery: the Resurrection",
        body: `Scripture: Matthew 28:1-10 (also John 20:1-18). On the first day of the week the tomb is found empty and the risen Jesus greets the women: "Do not be afraid." Fruit of the mystery: faith. ${DECADE_HOW}`,
      },
      {
        order: 3,
        title: "The Second Glorious Mystery: the Ascension",
        body: `Scripture: Acts 1:6-11 (also Luke 24:50-53). Forty days after Easter, Jesus blesses his disciples and is taken up into heaven, promising the Holy Spirit and his own return. Fruit of the mystery: hope, and desire for heaven. ${DECADE_HOW}`,
      },
      {
        order: 4,
        title: "The Third Glorious Mystery: the Descent of the Holy Spirit",
        body: `Scripture: Acts 2:1-13. At Pentecost, with Mary among the disciples, the Holy Spirit comes as wind and fire and the Church is sent out to preach. Fruit of the mystery: love of God, and the gifts of the Holy Spirit. ${DECADE_HOW}`,
      },
      {
        order: 5,
        title: "The Fourth Glorious Mystery: the Assumption of Mary",
        body: `The Church holds that Mary, having completed the course of her earthly life, was assumed body and soul into heavenly glory, a truth defined by Pope Pius XII in 1950. Revelation 12:1 is the traditional reading: "a woman clothed with the sun, with the moon under her feet." Fruit of the mystery: devotion to Mary, and the grace of a happy death. ${DECADE_HOW}`,
      },
      {
        order: 6,
        title: "The Fifth Glorious Mystery: the Coronation of Mary as Queen of Heaven and Earth",
        body: `Scripture: Revelation 12:1, "on her head a crown of twelve stars." Mary, exalted by her Son as Queen of all things, intercedes for the Church still on pilgrimage. Fruit of the mystery: trust in Mary's intercession, and eternal happiness. ${DECADE_HOW}`,
      },
      ROSARY_CLOSING_STEP(7),
    ],
    relatedPrayers: [...ROSARY_PRAYERS, "regina-caeli"],
    relatedDevotions: ["holy-rosary"],
    relatedSaints: ["saint-mary-magdalene", "saint-peter"],
  }),

  guide({
    slug: "luminous-mysteries-of-the-rosary",
    title: "Praying the Luminous Mysteries",
    summary:
      "The five Mysteries of Light, prayed on Thursdays, which Saint John Paul II added to the Rosary in 2002: the Baptism of Jesus, the Wedding at Cana, the Proclamation of the Kingdom, the Transfiguration and the Institution of the Eucharist.",
    kind: "rosary",
    authorityLevel: "VATICAN",
    citations: [V_RVM, U_ROSARIES],
    intro:
      "In the apostolic letter Rosarium Virginis Mariae (16 October 2002), Saint John Paul II proposed five 'Mysteries of Light' drawn from the public ministry of Jesus, so that the Rosary would be more fully 'a compendium of the Gospel'. Between the hidden life and the Passion, they show Christ revealing the Kingdom in his own person: at the Jordan, at Cana, in his preaching, on Tabor and at the Last Supper. Mary appears explicitly at Cana, and her words there are the key to all five: 'Do whatever he tells you.'",
    whatYouNeed: [
      "A rosary",
      "A Bible or the passages listed in each step",
      "About twenty quiet minutes",
    ],
    whenToPray:
      "Thursdays; also fitting on the feast of the Baptism of the Lord, the Transfiguration (6 August), Holy Thursday and Corpus Christi.",
    tips: [
      "The Luminous Mysteries are an addition the Pope proposed, not imposed: the traditional fifteen remain complete in themselves.",
      "Pray the fifth mystery before or after Mass or a holy hour and let it lead you to the Eucharist.",
      "Take Mary's words at Cana, 'Do whatever he tells you', as the intention for the whole Rosary.",
    ],
    durationMinutes: 20,
    steps: [
      ROSARY_OPENING_STEP,
      {
        order: 2,
        title: "The First Luminous Mystery: the Baptism of Jesus in the Jordan",
        body: `Scripture: Matthew 3:13-17. Jesus, sinless, goes down into the water with sinners; the heavens open, the Spirit descends and the Father's voice says, "This is my beloved Son." Fruit of the mystery: openness to the Holy Spirit. ${DECADE_HOW}`,
      },
      {
        order: 3,
        title: "The Second Luminous Mystery: the Wedding Feast at Cana",
        body: `Scripture: John 2:1-12. At Mary's word, "Do whatever he tells you," Jesus changes water into wine, the first of his signs, and his disciples believe in him. Fruit of the mystery: to Jesus through Mary. ${DECADE_HOW}`,
      },
      {
        order: 4,
        title: "The Third Luminous Mystery: the Proclamation of the Kingdom of God",
        body: `Scripture: Mark 1:14-15. "The kingdom of God is at hand; repent and believe in the gospel." Jesus preaches, heals and forgives, calling all to conversion. Fruit of the mystery: repentance and trust in God. ${DECADE_HOW}`,
      },
      {
        order: 5,
        title: "The Fourth Luminous Mystery: the Transfiguration",
        body: `Scripture: Matthew 17:1-8 (also Luke 9:28-36). On the mountain Jesus' face shines like the sun, Moses and Elijah appear, and the Father commands: "Listen to him." Fruit of the mystery: desire for holiness. ${DECADE_HOW}`,
      },
      {
        order: 6,
        title: "The Fifth Luminous Mystery: the Institution of the Eucharist",
        body: `Scripture: Matthew 26:26-29 (also Luke 22:14-20 and John 13:1). At the Last Supper Jesus gives his Body and Blood under the signs of bread and wine, loving his own "to the end." Fruit of the mystery: adoration, and love of the Eucharist. ${DECADE_HOW}`,
      },
      ROSARY_CLOSING_STEP(7),
    ],
    relatedPrayers: ROSARY_PRAYERS,
    relatedDevotions: ["holy-rosary", "eucharistic-adoration"],
    relatedSaints: ["saint-john-paul-ii", "saint-john-the-baptist"],
  }),

  guide({
    slug: "how-to-pray-a-scriptural-rosary",
    title: "How to Pray a Scriptural Rosary",
    summary:
      "Praying the Rosary with a short verse of Scripture before each Hail Mary, the method Saint John Paul II recommends in Rosarium Virginis Mariae for turning repetition into meditation.",
    kind: "rosary",
    authorityLevel: "VATICAN",
    citations: [V_RVM, V_DV],
    intro:
      "A Scriptural Rosary is the ordinary Rosary with one addition: before each Hail Mary a short verse is read that moves the story of the mystery forward, so that by the end of the decade you have walked through the Gospel scene line by line. In Rosarium Virginis Mariae Saint John Paul II asks that the announcement of each mystery be followed by the proclamation of a related biblical passage and a moment of silence, because 'in order to supply a biblical foundation and greater depth to our meditation, it is helpful to follow the announcement of the mystery with the proclamation of a related Biblical passage'. The Scriptural Rosary simply extends that practice to every bead.",
    whatYouNeed: [
      "A rosary",
      "A Bible, or a Scriptural Rosary booklet with ten verses for each mystery",
      "About thirty minutes, since the readings add time",
    ],
    whenToPray:
      "Whenever you pray the Rosary; it is especially fruitful when praying alone, in a group that can share the reading, or when a set of mysteries has become too familiar.",
    tips: [
      "Prepare the ten verses for each mystery beforehand rather than hunting through the Bible mid-decade; the USCCB publishes ready-made scriptural rosaries.",
      "Keep the verses short: one sentence is enough. The point is to give the imagination something to hold, not to read a chapter.",
      "In a group, let one reader proclaim the verse and everyone pray the Hail Mary that follows it.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Understand why Scripture belongs with the beads",
        body: "The Rosary was called 'the psalter of the poor' because its 150 Hail Marys echoed the 150 psalms. Reading Scripture at each bead restores that link: the Word of God, as Dei Verbum teaches, is the soul of all Christian prayer, and the Rosary is meant to be a contemplation of the Gospel, not a recitation apart from it.",
      },
      {
        order: 2,
        title: "Choose today's mysteries and gather the verses",
        body: "Choose the set for the day (Joyful on Monday and Saturday, Sorrowful on Tuesday and Friday, Glorious on Wednesday and Sunday, Luminous on Thursday). For each mystery select ten short verses that tell the scene in order, for example for the Annunciation ten lines from Luke 1:26-38. Mark them so you can find them without pausing.",
      },
      {
        order: 3,
        title: "Open as usual and announce the first mystery",
        body: "Make the Sign of the Cross and pray the Apostles' Creed on the crucifix, then the Our Father, three Hail Marys and the Glory Be on the opening beads. Announce the first mystery and read its first verse; then pray the Our Father on the large bead.",
      },
      {
        order: 4,
        title: "Pause in silence",
        body: "After the announcement and the reading, keep a moment of silence before beginning the Hail Marys. Rosarium Virginis Mariae asks for exactly this pause, so that the mind can settle on the mystery before the words begin.",
      },
      {
        order: 5,
        title: "Read a verse, then pray each Hail Mary",
        body: "On each of the ten small beads read the next verse of the passage, then pray the Hail Mary. Read, pray; read, pray. The verse gives the Hail Mary its picture, and the Hail Mary gives the verse time to sink in. Do not hurry the reading to get to the prayer.",
      },
      {
        order: 6,
        title: "Close the decade with the Glory Be and the Fatima Prayer",
        body: 'After the tenth Hail Mary pray the Glory Be, and, if you wish, the Fatima Prayer: "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of Thy mercy." A short concluding prayer proper to the mystery may follow, as the apostolic letter suggests.',
      },
      {
        order: 7,
        title: "Repeat for the remaining four mysteries",
        body: "Announce the next mystery, read its opening verse, keep the silence, pray the Our Father, and continue through its ten verses and Hail Marys. Do the same for the third, fourth and fifth mysteries.",
      },
      {
        order: 8,
        title: "Close the Rosary",
        body: "Pray the Hail, Holy Queen (Salve Regina), then: V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ. Let us pray: O God, whose only begotten Son, by his life, death and resurrection, has purchased for us the rewards of eternal life; grant, we beseech thee, that by meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen. End with the Sign of the Cross.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "apostles-creed",
      "our-father",
      "hail-mary",
      "glory-be",
      "fatima-prayer",
      "salve-regina",
    ],
    relatedDevotions: ["holy-rosary"],
    relatedPractices: ["lectio-divina"],
    relatedSaints: ["saint-john-paul-ii"],
  }),

  guide({
    slug: "how-to-pray-the-rosary-as-a-family",
    title: "How to Pray the Rosary as a Family",
    summary:
      "The family Rosary: leader and response, a place for every child, and how to keep it short, faithful and kind enough to last.",
    kind: "rosary",
    authorityLevel: "VATICAN",
    citations: [V_RVM, V_FC],
    intro:
      "Saint John Paul II ends Rosarium Virginis Mariae with an appeal to families: the family that prays together stays together, and the Rosary, 'by its very nature', is a prayer of the family. Familiaris Consortio likewise names the Rosary among the forms of prayer the Church warmly commends to the home. A family Rosary does not need to be perfect or complete; it needs to be regular, gentle and shared. This guide gives the practical shape most families settle into.",
    whatYouNeed: [
      "A rosary for each person who wants one (children love their own)",
      "A fixed time and a corner of the home, ideally before an image of Our Lady or a crucifix",
      "Today's mysteries, chosen in advance",
      "About twenty-five minutes, or ten for a single decade",
    ],
    whenToPray:
      "Daily if you can, often after the evening meal or before bedtime; a decade a night is a real family Rosary. Many families keep the full five decades on Sundays, in October and in May.",
    tips: [
      "Start small and be faithful: one decade every evening will outlast five decades attempted twice.",
      "Give every child a job: leading a decade, announcing a mystery, holding the candle, naming an intention.",
      "Expect wriggling, yawning and wandering. Keep going without scolding; the habit matters more than the posture.",
      "Let teenagers lead. Being asked to lead a decade is very different from being told to attend one.",
    ],
    durationMinutes: 25,
    steps: [
      {
        order: 1,
        title: "Choose a time and place",
        body: "Pick a time you can keep most days and a place where the family naturally gathers. Light a candle or set out an image of Our Lady so the moment is visibly different from the rest of the evening. Phones are put away before the Sign of the Cross.",
      },
      {
        order: 2,
        title: "Assign the leader and the decades",
        body: "One person leads the whole Rosary, or, better, the decades are shared out: a parent takes the first, and each child who can pray the Hail Mary takes one. Younger children can announce a mystery or lead the Glory Be. Decide this before you begin so there is no negotiating mid-prayer.",
      },
      {
        order: 3,
        title: "Open together",
        body: "The leader begins the Sign of the Cross and everyone joins. Pray the Apostles' Creed together, then the Our Father, three Hail Marys and the Glory Be on the opening beads. In the leader-and-response pattern the leader prays the first half of each prayer and the family answers with the second half.",
      },
      {
        order: 4,
        title: "Let children announce the mysteries",
        body: 'Before each decade a child announces the mystery, for example: "The first Joyful Mystery: the Annunciation." A parent may add one sentence about the scene, or read two or three verses from the Gospel. Keep it to a sentence or two; children lose the thread in long meditations.',
      },
      {
        order: 5,
        title: "The leader prays the first half, the family answers",
        body: 'For the Our Father the leader prays as far as "Thy will be done, on earth as it is in heaven" and all answer "Give us this day our daily bread..." For each Hail Mary the leader prays "Hail Mary, full of grace... blessed is the fruit of thy womb, Jesus," and all answer "Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen." Close each decade with the Glory Be and the Fatima Prayer.',
      },
      {
        order: 6,
        title: "Add intentions before each decade",
        body: "Before the Our Father of each decade, invite one person to name an intention aloud: a sick grandparent, a friend, a test, the souls in purgatory, peace. This teaches children that the Rosary is prayed for someone, and it gives each decade a face.",
      },
      {
        order: 7,
        title: "Close with the Hail, Holy Queen",
        body: "After the last decade pray the Hail, Holy Queen (Salve Regina) together, then: V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ. Add the closing prayer of the Rosary if the family knows it. Many families end with the Guardian Angel Prayer for the children and the Sign of the Cross.",
      },
      {
        order: 8,
        title: "Keep it going when it gets hard",
        body: "There will be evenings of tiredness and resistance. Shorten rather than skip: one decade prayed together is still the family Rosary. Return to five decades on Sundays and feasts, and do not measure success by how reverent the children looked. Saint John Paul II's word for the family Rosary is perseverance.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "apostles-creed",
      "our-father",
      "hail-mary",
      "glory-be",
      "fatima-prayer",
      "salve-regina",
      "guardian-angel-prayer",
    ],
    relatedDevotions: ["holy-rosary"],
    relatedSaints: ["saint-john-paul-ii", "saint-joseph"],
  }),

  guide({
    slug: "how-to-lead-a-group-rosary",
    title: "How to Lead a Rosary in a Group or Parish",
    summary:
      "Leading the Rosary publicly: the leader's parts and the people's responses, pacing, intentions, and how to close.",
    kind: "rosary",
    authorityLevel: "VATICAN",
    citations: [V_RVM, V_DPP],
    intro:
      "A Rosary prayed before Mass, at a wake, in a prayer group or at a shrine follows the same shape as a private Rosary, but the leader carries the pace and the people carry the responses. The Directory on Popular Piety and the Liturgy reminds us that the Rosary is a contemplative prayer whose recitation should be calm and unhurried, and Saint John Paul II asks that it never become a mechanical formula. A good leader makes both of those possible for everyone else.",
    whatYouNeed: [
      "Today's set of mysteries and a one-line meditation for each, prepared in advance",
      "The intentions the group has asked for",
      "A voice that can be heard by the back row, or a microphone",
      "Rosaries or prayer cards for those who arrive without one",
    ],
    whenToPray:
      "Before or after Mass, at wakes and vigils, on First Saturdays, in October and May, and at any gathering of the faithful; the leader keeps the day's mysteries unless the occasion suggests another set (for example the Sorrowful Mysteries at a wake).",
    tips: [
      "Set the pace at the first decade and hold it: not so fast that the words blur, not so slow that people drift.",
      "Say the mystery and its meditation clearly, then leave two or three seconds of silence before the Our Father.",
      "Tell the group beforehand which optional prayers you will use (Fatima Prayer, Saint Michael, a hymn) so nobody is caught out.",
      "At a wake, add the prayer Eternal rest grant unto them, O Lord after the closing prayer.",
    ],
    durationMinutes: 25,
    steps: [
      {
        order: 1,
        title: "Prepare the intentions and today's mysteries",
        body: 'Before you begin, decide the set of mysteries (Joyful on Monday and Saturday, Sorrowful on Tuesday and Friday, Glorious on Wednesday and Sunday, Luminous on Thursday) and write one sentence for each. Gather the intentions and announce them at the start: "We offer this Rosary for..." Keep the list short and say it once.',
      },
      {
        order: 2,
        title: "Open with the Sign of the Cross and the Apostles' Creed",
        body: 'Begin clearly: "In the name of the Father, and of the Son, and of the Holy Spirit." Then lead the Apostles\' Creed with everyone praying it together. On the opening beads lead the Our Father, three Hail Marys and the Glory Be in the leader-and-response pattern described in the next step.',
      },
      {
        order: 3,
        title: "Learn the leader-and-response split",
        body: 'The leader prays the first half of each prayer and the people answer with the second. Our Father: leader to "on earth as it is in heaven," people from "Give us this day our daily bread." Hail Mary: leader to "blessed is the fruit of thy womb, Jesus," people from "Holy Mary, Mother of God." Glory Be: leader "Glory be to the Father, and to the Son, and to the Holy Spirit," people "as it was in the beginning, is now, and ever shall be, world without end. Amen."',
      },
      {
        order: 4,
        title: "Announce each mystery with a short meditation",
        body: 'Before each decade say the mystery and your one sentence: "The third Sorrowful Mystery, the Crowning with Thorns. Let us ask for courage to bear ridicule for the sake of Christ." Pause. Then begin the Our Father. If a reader is available, a short Scripture passage may be proclaimed instead of the sentence.',
      },
      {
        order: 5,
        title: "Keep a steady, prayerful pace",
        body: "The leader sets the tempo. Speak every word; do not slur the Hail Marys into a hum. Listen for the people's response and begin the next prayer only when it has finished. If the group is large, count the beads on your own rosary so you do not lose the decade.",
      },
      {
        order: 6,
        title: "Close each decade with the Glory Be and the Fatima Prayer",
        body: 'After the tenth Hail Mary lead the Glory Be. Then, if it is the custom of the group, the Fatima Prayer, said by all together: "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of Thy mercy." Announce the next mystery without delay.',
      },
      {
        order: 7,
        title: "Close with the Hail, Holy Queen and the closing prayer",
        body: "Lead the Hail, Holy Queen (Salve Regina) with everyone. Then: V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ. Let us pray: O God, whose only begotten Son, by his life, death and resurrection, has purchased for us the rewards of eternal life; grant, we beseech thee, that by meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.",
      },
      {
        order: 8,
        title: "Add a hymn or the Litany of Loreto, and finish",
        body: "Where there is time, the Litany of the Blessed Virgin Mary (the Litany of Loreto) or a Marian hymn such as the Salve Regina sung follows naturally. Many groups add the Prayer to Saint Michael. End with the Sign of the Cross, and thank the group briefly; do not add announcements between the last prayer and the blessing.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "apostles-creed",
      "our-father",
      "hail-mary",
      "glory-be",
      "fatima-prayer",
      "salve-regina",
      "litany-of-the-blessed-virgin-mary",
      "prayer-to-saint-michael",
      "eternal-rest",
    ],
    relatedDevotions: ["holy-rosary"],
    relatedSaints: ["saint-dominic"],
  }),

  // ──────────────────────────── B. CHAPLETS ────────────────────────────
  guide({
    slug: "how-to-pray-the-divine-mercy-chaplet",
    title: "How to Pray the Divine Mercy Chaplet",
    summary:
      "The Chaplet of Divine Mercy, prayed on ordinary rosary beads in about ten minutes: the opening prayers, the Eternal Father and For the sake of His sorrowful Passion, the Holy God, and the full closing prayer.",
    kind: "chaplet",
    authorityLevel: "VATICAN",
    citations: [V_FAUST, V_DMD, V_DIM],
    intro:
      "The Chaplet of Divine Mercy comes from the Diary of Saint Faustina Kowalska, the Polish religious sister whom Saint John Paul II canonized on 30 April 2000 while declaring the Second Sunday of Easter 'Divine Mercy Sunday' for the whole Church. It is an offering of the Passion of Jesus to the Father for the sins of the world, prayed on ordinary rosary beads, and it is short enough to pray in ten minutes: at three in the afternoon, the hour of Christ's death, at a sickbed, or on the way to work.",
    whatYouNeed: [
      "An ordinary five-decade rosary",
      "About ten minutes",
      "An intention: the chaplet is traditionally prayed for the dying and for sinners",
    ],
    whenToPray:
      "Any time, and especially at three o'clock in the afternoon, the Hour of Mercy, when Saint Faustina's Diary records Jesus asking her to recall his Passion. It is also prayed as a novena from Good Friday to Divine Mercy Sunday, and at the bedside of the dying.",
    tips: [
      "Divine Mercy Sunday is the Second Sunday of Easter. In 2002 the Apostolic Penitentiary granted a plenary indulgence, under the usual conditions (sacramental confession, Holy Communion and prayer for the Pope's intentions), to the faithful who on that day take part in devotions in honour of Divine Mercy, or who before the Blessed Sacrament pray the Our Father and the Creed and add a devout prayer to the merciful Jesus, such as 'Merciful Jesus, I trust in you'.",
      "If you cannot pray the whole chaplet at three o'clock, stop for a moment at that hour and say: 'Jesus, I trust in you.'",
      "Pray it for someone who is dying; that is the intention Saint Faustina most often records for it.",
      "It can be sung; many parishes chant it before or after Mass on the Sundays of Easter.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Make the Sign of the Cross and, if you wish, the opening prayers",
        body: 'Make the Sign of the Cross. You may pray the optional opening from the Diary: "You expired, Jesus, but the source of life gushed forth for souls, and the ocean of mercy opened up for the whole world. O Fount of Life, unfathomable Divine Mercy, envelop the whole world and empty Yourself out upon us." Then three times: "O Blood and Water, which gushed forth from the Heart of Jesus as a fount of mercy for us, I trust in You!"',
      },
      {
        order: 2,
        title: "Pray the Our Father, the Hail Mary and the Apostles' Creed",
        body: "On the opening beads of the rosary pray one Our Father, one Hail Mary and the Apostles' Creed. These three prayers place the chaplet within the faith of the whole Church before its own petitions begin.",
      },
      {
        order: 3,
        title: "On the large bead pray the Eternal Father",
        body: 'On the large bead before each decade pray: "Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world."',
      },
      {
        order: 4,
        title: "On the ten small beads pray For the sake of His sorrowful Passion",
        body: 'On each of the ten small beads pray: "For the sake of His sorrowful Passion, have mercy on us and on the whole world." Keep the Passion before your eyes as you repeat it, in the same way the Rosary keeps a mystery before the mind.',
      },
      {
        order: 5,
        title: "Repeat for all five decades",
        body: "Pray the Eternal Father on each large bead and the ten petitions on the small beads of each decade, five times in all, until you return to the medal. The five decades are sometimes offered for the five wounds of Christ, though no particular intention is prescribed.",
      },
      {
        order: 6,
        title: "Pray the Holy God three times",
        body: 'After the fifth decade pray three times: "Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world." This is the ancient Trisagion of the Eastern liturgies, which the Diary places at the close of the chaplet.',
      },
      {
        order: 7,
        title: "Pray the closing prayer and make the Sign of the Cross",
        body: 'Conclude with the closing prayer: "Eternal God, in whom mercy is endless and the treasury of compassion inexhaustible, look kindly upon us and increase Your mercy in us, that in difficult moments we might not despair nor become despondent, but with great confidence submit ourselves to Your holy will, which is Love and Mercy itself. Amen." Make the Sign of the Cross. Many add, three times, "Jesus, I trust in You."',
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "our-father",
      "hail-mary",
      "apostles-creed",
      "divine-mercy-chaplet-prayers",
    ],
    relatedDevotions: ["divine-mercy-chaplet"],
    relatedSaints: ["saint-faustina-kowalska", "saint-john-paul-ii"],
  }),

  guide({
    slug: "how-to-pray-the-chaplet-of-saint-michael",
    title: "How to Pray the Chaplet of Saint Michael",
    summary:
      "The Chaplet of Saint Michael the Archangel: nine salutations to the nine choirs of angels, each with an Our Father and three Hail Marys, four Our Fathers for the archangels and the guardian angel, and the closing prayer.",
    kind: "chaplet",
    authorityLevel: "USCCB",
    citations: [U_DEV, V_DPP],
    intro:
      "The Chaplet of Saint Michael honours the Archangel together with the nine choirs of angels named in Scripture and the tradition: Seraphim, Cherubim, Thrones, Dominations, Powers, Virtues, Principalities, Archangels and Angels. It grew out of the devotion of a Portuguese Carmelite in the eighteenth century and was approved by Pope Pius IX in 1851. The Directory on Popular Piety and the Liturgy commends devotion to the holy angels as protectors and companions on the way, while warning against anything superstitious; the chaplet is simply a series of petitions that the Lord, through Saint Michael and each choir, grant a particular grace.",
    whatYouNeed: [
      "A Saint Michael chaplet (a medal, nine groups of one large and three small beads, and four final beads), or an ordinary rosary counted accordingly",
      "About fifteen minutes",
    ],
    whenToPray:
      "Any time; especially on 29 September, the feast of Saints Michael, Gabriel and Raphael, on 2 October, the feast of the Guardian Angels, and whenever you seek protection in temptation or spiritual struggle.",
    tips: [
      "Each salutation asks for a specific grace; make it your intention for the Our Father and Hail Marys that follow rather than rushing to the next choir.",
      "On a plain rosary, use the large bead for the salutation and Our Father and the next three small beads for the Hail Marys, then move to the next large bead.",
      "The Prayer to Saint Michael ('Saint Michael the Archangel, defend us in battle') is a different, shorter prayer and can be added at the end.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Begin on the medal",
        body: "Make the Sign of the Cross. On the medal pray: V. O God, come to my assistance. R. O Lord, make haste to help me. Then pray the Glory Be.",
      },
      {
        order: 2,
        title: "Learn the pattern of each salutation",
        body: 'The chaplet has nine salutations, one for each choir of angels. For each: say the salutation on the large bead, then pray one Our Father on the same bead and three Hail Marys on the three small beads that follow. Every salutation begins "By the intercession of Saint Michael and the celestial choir of..." and ends "Amen."',
      },
      {
        order: 3,
        title: "The first three choirs: Seraphim, Cherubim, Thrones",
        body: 'First: "By the intercession of Saint Michael and the celestial choir of Seraphim, may the Lord make us worthy to burn with the fire of perfect charity. Amen." Our Father, three Hail Marys. Second: "...and the celestial choir of Cherubim, may the Lord grant us the grace to leave the ways of sin and run in the paths of Christian perfection. Amen." Our Father, three Hail Marys. Third: "...and the celestial choir of Thrones, may the Lord infuse into our hearts a true and sincere spirit of humility. Amen." Our Father, three Hail Marys.',
      },
      {
        order: 4,
        title: "The middle three choirs: Dominations, Powers, Virtues",
        body: 'Fourth: "By the intercession of Saint Michael and the celestial choir of Dominations, may the Lord give us grace to govern our senses and overcome any unruly passions. Amen." Our Father, three Hail Marys. Fifth: "...and the celestial choir of Powers, may the Lord protect our souls against the snares and temptations of the devil. Amen." Our Father, three Hail Marys. Sixth: "...and the celestial choir of Virtues, may the Lord preserve us from evil and keep us from falling into temptation. Amen." Our Father, three Hail Marys.',
      },
      {
        order: 5,
        title: "The last three choirs: Principalities, Archangels, Angels",
        body: 'Seventh: "By the intercession of Saint Michael and the celestial choir of Principalities, may God fill our souls with a true spirit of obedience. Amen." Our Father, three Hail Marys. Eighth: "...and the celestial choir of Archangels, may the Lord give us perseverance in faith and in all good works, in order that we may attain the glory of heaven. Amen." Our Father, three Hail Marys. Ninth: "...and the celestial choir of Angels, may the Lord grant us to be guarded by them in this mortal life and conducted hereafter to eternal glory. Amen." Our Father, three Hail Marys.',
      },
      {
        order: 6,
        title: "Pray four Our Fathers on the final beads",
        body: 'On the four remaining beads pray one Our Father each in honour of Saint Michael, Saint Gabriel, Saint Raphael and your Guardian Angel. You may add the Guardian Angel Prayer ("Angel of God, my guardian dear") after the fourth.',
      },
      {
        order: 7,
        title: "Pray the closing prayer to Saint Michael",
        body: '"O glorious Prince Saint Michael, chief and commander of the heavenly hosts, guardian of souls, vanquisher of rebel spirits, servant in the house of the Divine King and our admirable guide, you who shine with excellence and superhuman virtue: deliver us from all evil, who turn to you with confidence, and enable us by your gracious protection to serve God more and more faithfully every day. V. Pray for us, O glorious Saint Michael, Prince of the Church of Jesus Christ. R. That we may be made worthy of his promises."',
      },
      {
        order: 8,
        title: "Conclude",
        body: '"Almighty and everlasting God, who by a wonder of your goodness and mercy, for the salvation of all, have appointed the most glorious Archangel Saint Michael Prince of your Church: make us worthy, we beseech you, to be delivered from all our enemies, that none of them may harass us at the hour of death, but that we may be led by him into your presence. Through Jesus Christ our Lord. Amen." Make the Sign of the Cross.',
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "glory-be",
      "our-father",
      "hail-mary",
      "guardian-angel-prayer",
      "prayer-to-saint-michael",
    ],
    relatedDevotions: ["chaplet-of-saint-michael"],
  }),

  guide({
    slug: "how-to-pray-the-chaplet-of-the-seven-sorrows",
    title: "How to Pray the Chaplet of the Seven Sorrows",
    summary:
      "The Servite Rosary of the Seven Sorrows of Our Lady: an Our Father and seven Hail Marys for each sorrow, three Hail Marys in honour of her tears, and the closing prayer.",
    kind: "chaplet",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_DEV],
    intro:
      "The Chaplet (or Rosary) of the Seven Sorrows was spread by the Servite Order, founded in Florence in the thirteenth century with devotion to the sorrowing Mother as its special charism. Its seven sorrows are drawn from the Gospels and the tradition of the Passion, from Simeon's prophecy to the burial of Jesus. The Directory on Popular Piety and the Liturgy places devotion to Our Lady of Sorrows within the Church's contemplation of the Passion: standing with Mary at the foot of the cross, we learn compassion for Christ and for all who suffer. Her memorial is kept on 15 September.",
    whatYouNeed: [
      "A Seven Sorrows chaplet (seven groups of seven beads, each preceded by a larger bead, with three small beads at the end), or an ordinary rosary counted in sevens",
      "A Bible or the passages listed in each step",
      "About twenty minutes",
    ],
    whenToPray:
      "Fridays, throughout Lent and Holy Week, and on 15 September, the memorial of Our Lady of Sorrows; also fitting in times of grief and when praying for those who mourn.",
    tips: [
      "Pray it slowly; seven Hail Marys is time enough to stay in the scene with Mary rather than watch it from outside.",
      "The Stabat Mater, the medieval hymn of Mary at the cross, is a fitting opening or closing.",
      "Offer each sorrow for someone who is carrying that kind of sorrow now: a worried parent, a refugee family, a bereaved mother.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Open with the Sign of the Cross and an Act of Contrition",
        body: "Make the Sign of the Cross. Pray an Act of Contrition, asking pardon for the sins that caused the sorrows you are about to contemplate. You may add a short prayer for the grace to share Mary's compassion for her Son.",
      },
      {
        order: 2,
        title: "The First Sorrow: the Prophecy of Simeon",
        body: 'Scripture: Luke 2:34-35. Simeon tells Mary, "and you yourself a sword will pierce." Reflect for a moment on the sorrow she carried in silence from that day. Then pray one Our Father and seven Hail Marys.',
      },
      {
        order: 3,
        title: "The Second Sorrow: the Flight into Egypt",
        body: "Scripture: Matthew 2:13-15. Warned in a dream, Joseph takes the child and his mother by night into Egypt to escape Herod. Consider Mary's fear and trust as an exile with a hunted child. Pray one Our Father and seven Hail Marys.",
      },
      {
        order: 4,
        title: "The Third Sorrow: the Loss of the Child Jesus in the Temple",
        body: 'Scripture: Luke 2:41-50. For three days Mary and Joseph search for the twelve-year-old Jesus: "Son, why have you done this to us?" Consider her anguish and her pondering of his answer. Pray one Our Father and seven Hail Marys.',
      },
      {
        order: 5,
        title: "The Fourth Sorrow: Mary meets Jesus on the Way to Calvary",
        body: "Scripture: Luke 23:27-31, and the fourth Station of the Cross. Tradition holds that Mary met her Son carrying the cross through the streets of Jerusalem. Consider the meeting of their eyes. Pray one Our Father and seven Hail Marys.",
      },
      {
        order: 6,
        title: "The Fifth Sorrow: Mary stands at the foot of the Cross",
        body: 'Scripture: John 19:25-27. "Standing by the cross of Jesus was his mother." Jesus gives her to the beloved disciple, and to the Church, as Mother. Consider her standing through the three hours. Pray one Our Father and seven Hail Marys.',
      },
      {
        order: 7,
        title: "The Sixth Sorrow: the Body of Jesus is taken down from the Cross",
        body: "Scripture: John 19:38-40 (also Mark 15:42-46). Joseph of Arimathea and Nicodemus take down the body, and tradition places it in Mary's arms, the scene of the Pietà. Consider her holding him. Pray one Our Father and seven Hail Marys.",
      },
      {
        order: 8,
        title: "The Seventh Sorrow: the Burial of Jesus",
        body: "Scripture: John 19:41-42 (also Luke 23:50-56). The body is laid in a new tomb and the stone is rolled across; Mary goes home to wait in faith for the third day. Pray one Our Father and seven Hail Marys.",
      },
      {
        order: 9,
        title: "Pray three Hail Marys in honour of Mary's tears",
        body: "On the three final beads pray three Hail Marys in honour of the tears Our Lady shed in her sorrows, asking for true sorrow for our sins and compassion for the suffering of Christ.",
      },
      {
        order: 10,
        title: "Close with the versicle and prayer",
        body: "V. Pray for us, O most sorrowful Virgin. R. That we may be made worthy of the promises of Christ. Let us pray: Lord Jesus, we now implore, both for the present and for the hour of our death, the intercession of the most Blessed Virgin Mary, your Mother, whose holy soul was pierced at the time of your Passion by a sword of grief. Grant us this favour, O Saviour of the world, who live and reign with the Father and the Holy Spirit, for ever and ever. Amen. Make the Sign of the Cross.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "act-of-contrition",
      "our-father",
      "hail-mary",
      "stabat-mater",
    ],
    relatedDevotions: ["seven-sorrows-of-mary"],
    relatedSaints: ["saint-joseph"],
  }),

  guide({
    slug: "how-to-pray-the-chaplet-of-the-precious-blood",
    title: "How to Pray the Chaplet of the Precious Blood",
    summary:
      "The Chaplet of the Precious Blood: seven mysteries of the Blood of Christ, from the Circumcision to the piercing of his side, with thirty-three Our Fathers for the years of his earthly life.",
    kind: "chaplet",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_DEV],
    intro:
      "Devotion to the Precious Blood of Jesus, 'the price of our redemption', is among the devotions the Directory on Popular Piety and the Liturgy explicitly commends, rooted as it is in Scripture (1 Peter 1:18-19; Hebrews 9) and in the Eucharist. The chaplet in its usual form was spread in the early nineteenth century by Saint Gaspar del Bufalo, founder of the Missionaries of the Precious Blood. It contemplates seven occasions on which Christ shed his blood, and its thirty-three Our Fathers recall the thirty-three years of his earthly life.",
    whatYouNeed: [
      "A Precious Blood chaplet (seven groups of beads: five, five, five, five, five, five and three), or an ordinary rosary counted accordingly",
      "About fifteen minutes",
    ],
    whenToPray:
      "Fridays, throughout Lent, and during July, the month traditionally dedicated to the Precious Blood; also before or after Mass, where the Blood of Christ is offered and received.",
    tips: [
      "Each mystery ends with the same versicle and response; say it slowly, as a real plea, not a refrain.",
      "The Anima Christi ('Blood of Christ, inebriate me') is a fitting closing prayer after the chaplet.",
      "Join the chaplet to your next Holy Communion by offering it in thanksgiving for the Blood you receive there.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Open the chaplet",
        body: "Make the Sign of the Cross. Then: V. O God, come to my assistance. R. O Lord, make haste to help me. Glory be to the Father, and to the Son, and to the Holy Spirit, as it was in the beginning, is now, and ever shall be, world without end. Amen.",
      },
      {
        order: 2,
        title: "The First Mystery: the Circumcision",
        body: "Scripture: Luke 2:21. On the eighth day the child is circumcised and named Jesus, and sheds the first drops of his blood under the Law. Pray five Our Fathers and the Glory Be. Then: V. We beseech you, therefore, help your servants. R. Whom you have redeemed by your Precious Blood.",
      },
      {
        order: 3,
        title: "The Second Mystery: the Agony in the Garden",
        body: "Scripture: Luke 22:44. In Gethsemane his sweat becomes like drops of blood falling to the ground. Pray five Our Fathers and the Glory Be. V. We beseech you, therefore, help your servants. R. Whom you have redeemed by your Precious Blood.",
      },
      {
        order: 4,
        title: "The Third Mystery: the Scourging",
        body: "Scripture: John 19:1. Pilate has Jesus scourged, and his blood flows under the whips at the pillar. Pray five Our Fathers and the Glory Be. V. We beseech you, therefore, help your servants. R. Whom you have redeemed by your Precious Blood.",
      },
      {
        order: 5,
        title: "The Fourth Mystery: the Crowning with Thorns",
        body: "Scripture: Matthew 27:29. The soldiers press a crown of thorns onto his head and his blood runs down his face. Pray five Our Fathers and the Glory Be. V. We beseech you, therefore, help your servants. R. Whom you have redeemed by your Precious Blood.",
      },
      {
        order: 6,
        title: "The Fifth Mystery: the Way of the Cross",
        body: "Scripture: John 19:17. Carrying the cross to Golgotha, Jesus leaves his blood on the stones of the road and on the wood he carries. Pray five Our Fathers and the Glory Be. V. We beseech you, therefore, help your servants. R. Whom you have redeemed by your Precious Blood.",
      },
      {
        order: 7,
        title: "The Sixth Mystery: the Crucifixion",
        body: "Scripture: Luke 23:33. His hands and feet are nailed to the cross, and he sheds his blood for three hours until he dies. Pray five Our Fathers and the Glory Be. V. We beseech you, therefore, help your servants. R. Whom you have redeemed by your Precious Blood.",
      },
      {
        order: 8,
        title: "The Seventh Mystery: the Piercing of his Side",
        body: 'Scripture: John 19:34. After his death a soldier pierces his side with a lance, "and immediately blood and water flowed out." Pray three Our Fathers (bringing the total to thirty-three) and the Glory Be. V. We beseech you, therefore, help your servants. R. Whom you have redeemed by your Precious Blood.',
      },
      {
        order: 9,
        title: "Close with the prayer of the Precious Blood",
        body: "Let us pray: Almighty and eternal God, you appointed your only begotten Son to be the Redeemer of the world and willed to be appeased by his Blood; grant, we beseech you, that we may so venerate the price of our salvation, and by its power be so defended against the evils of this present life, that we may enjoy its fruit for ever in heaven. Through the same Christ our Lord. Amen. Make the Sign of the Cross.",
      },
    ],
    relatedPrayers: ["sign-of-the-cross", "glory-be", "our-father", "anima-christi"],
    relatedDevotions: ["chaplet-of-the-precious-blood"],
  }),

  guide({
    slug: "how-to-pray-the-franciscan-crown",
    title: "How to Pray the Franciscan Crown (Rosary of the Seven Joys)",
    summary:
      "The seven-decade Franciscan Crown of the Seven Joys of Our Lady, from the Annunciation to her Assumption and Coronation, with the two extra Hail Marys that complete the seventy-two.",
    kind: "chaplet",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_ROSARIES],
    intro:
      "The Franciscan Crown, or Seraphic Rosary, is the Franciscan Order's own form of the Rosary, in use since the fifteenth century. Instead of five decades on a set of mysteries, it has seven decades on the Seven Joys of the Blessed Virgin: the Annunciation, the Visitation, the Nativity, the Adoration of the Magi, the Finding in the Temple, the appearance of the risen Christ to his Mother, and her Assumption and Coronation. The Directory on Popular Piety and the Liturgy recognises such 'crowns' and chaplets as legitimate variants of the Rosary that have grown up within religious families.",
    whatYouNeed: [
      "A Franciscan Crown (seven decades) or an ordinary rosary, going round it a second time for the last two decades",
      "About twenty-five minutes",
    ],
    whenToPray:
      "Any day; especially on Marian feasts, in May and October, and on 4 October, the feast of Saint Francis of Assisi.",
    tips: [
      "The Crown has no opening beads or Creed: it begins straight away with the first joy.",
      "Announce each joy and pause for a moment before the Our Father, as you would in the Dominican Rosary.",
      "Franciscans traditionally end with an Our Father and a Hail Mary for the intentions of the Holy Father.",
    ],
    durationMinutes: 25,
    steps: [
      {
        order: 1,
        title: "Make the Sign of the Cross and announce the first joy",
        body: 'Make the Sign of the Cross. The Crown has no introductory prayers; go directly to the first decade. Announce the joy: "The first joy of Our Lady: the Annunciation."',
      },
      {
        order: 2,
        title: "The First Joy: the Annunciation",
        body: 'Scripture: Luke 1:26-38. The angel greets Mary, "Rejoice, full of grace," and she consents to become the Mother of God. Pray one Our Father, ten Hail Marys and the Glory Be.',
      },
      {
        order: 3,
        title: "The Second Joy: the Visitation",
        body: 'Scripture: Luke 1:39-56. Elizabeth cries out, "Blessed are you among women," and Mary sings the Magnificat: "My spirit rejoices in God my Saviour." Pray one Our Father, ten Hail Marys and the Glory Be.',
      },
      {
        order: 4,
        title: "The Third Joy: the Nativity",
        body: "Scripture: Luke 2:1-20. Mary gives birth to Jesus at Bethlehem and the angels proclaim tidings of great joy to the shepherds. Pray one Our Father, ten Hail Marys and the Glory Be.",
      },
      {
        order: 5,
        title: "The Fourth Joy: the Adoration of the Magi",
        body: "Scripture: Matthew 2:1-12. The Magi find the child with Mary his mother, fall down in worship and offer gold, frankincense and myrrh. Pray one Our Father, ten Hail Marys and the Glory Be.",
      },
      {
        order: 6,
        title: "The Fifth Joy: the Finding in the Temple",
        body: "Scripture: Luke 2:41-52. After three days Mary and Joseph find Jesus in the Temple, and he returns with them to Nazareth and is obedient to them. Pray one Our Father, ten Hail Marys and the Glory Be.",
      },
      {
        order: 7,
        title: "The Sixth Joy: the Resurrection and the risen Christ's appearance to his Mother",
        body: "Scripture: Matthew 28:1-10. Christ rises on the third day; Franciscan tradition contemplates his first appearance to his Mother, though the Gospels do not record it. Pray one Our Father, ten Hail Marys and the Glory Be.",
      },
      {
        order: 8,
        title: "The Seventh Joy: the Assumption and Coronation of Mary",
        body: "Scripture: Revelation 12:1. Mary is taken body and soul into heaven and crowned Queen of heaven and earth by her Son. Pray one Our Father, ten Hail Marys and the Glory Be.",
      },
      {
        order: 9,
        title: "Pray two more Hail Marys to complete seventy-two",
        body: "After the seventh decade pray two additional Hail Marys, bringing the total to seventy-two, in honour of the years Mary is traditionally said to have lived on earth.",
      },
      {
        order: 10,
        title: "Close with an Our Father and Hail Mary for the Pope",
        body: "Pray one Our Father and one Hail Mary for the intentions of the Holy Father. You may add the Hail, Holy Queen (Salve Regina). Make the Sign of the Cross.",
      },
    ],
    relatedPrayers: ["sign-of-the-cross", "our-father", "hail-mary", "glory-be", "salve-regina"],
    relatedDevotions: ["holy-rosary"],
    relatedSaints: ["saint-francis-of-assisi", "saint-clare-of-assisi"],
  }),

  guide({
    slug: "how-to-pray-the-chaplet-of-the-holy-face",
    title: "How to Pray the Chaplet of the Holy Face",
    summary:
      "The Chaplet of the Holy Face of Jesus: thirty-three invocations of 'Arise, O Lord' on the small beads, grouped for the five senses of Christ in his Passion, with the Glory Be on the large beads, prayed in reparation.",
    kind: "chaplet",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_DEV],
    intro:
      "The Chaplet of the Holy Face is a prayer of reparation: it asks pardon for the blasphemies and profanations that offend God, and it does so by honouring the face of Christ disfigured in his Passion, the face Isaiah foretold 'without beauty, without majesty'. The devotion took its modern form in the Carmel of Tours in the 1840s through Sister Mary of Saint Peter, and an Archconfraternity of the Holy Face was later established there; Saint Thérèse of Lisieux, 'of the Child Jesus and the Holy Face', made it her own. The Directory on Popular Piety and the Liturgy places such devotions within the Church's contemplation of the Passion of Christ.",
    whatYouNeed: [
      "A Holy Face chaplet: a medal, thirty-three small beads and six large beads; an ordinary rosary can be used by counting thirty-three small beads",
      "About fifteen minutes",
    ],
    whenToPray:
      "Tuesdays, the day traditionally associated with the Holy Face, and especially on Shrove Tuesday, when the Holy Face is honoured in reparation before Lent; also during Lent and Holy Week, and whenever you hear God's name profaned.",
    tips: [
      "The invocation is Psalm 68:1. Say it as a plea for the triumph of Christ's face over the sin of the world, never as a curse on any person.",
      "Let each group of six beads be a real meditation on that sense of Christ: picture it before you begin the invocations.",
      "Praying the Anima Christi at the end joins the devotion to the Passion to the Eucharist from which it flows.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Begin on the medal",
        body: "Make the Sign of the Cross. On the medal pray: V. O God, come to my assistance. R. O Lord, make haste to help me. Then pray the Glory Be.",
      },
      {
        order: 2,
        title: "Learn how the beads are counted",
        body: 'The thirty-three small beads recall the thirty-three years of the earthly life of Jesus. The first thirty are divided into five groups of six for the five senses through which Christ suffered in his Passion: touch, hearing, sight, smell and taste. The last three honour the wounds of his Holy Face. On every small bead pray: "Arise, O Lord, and let your enemies be scattered, and let those who hate you flee before your face." On every large bead pray the Glory Be.',
      },
      {
        order: 3,
        title: "The first group: the sense of touch",
        body: 'Announce: "In honour of the sense of touch of Jesus, wounded in his Passion." Recall the blows of the soldiers, the scourges and the nails. On each of the six small beads pray: "Arise, O Lord, and let your enemies be scattered, and let those who hate you flee before your face." On the large bead pray the Glory Be.',
      },
      {
        order: 4,
        title: "The second group: the sense of hearing",
        body: 'Announce: "In honour of the sense of hearing of Jesus." Recall the insults, the false accusations and the cry "Crucify him." On each of the six small beads pray: "Arise, O Lord, and let your enemies be scattered, and let those who hate you flee before your face." On the large bead pray the Glory Be.',
      },
      {
        order: 5,
        title: "The third group: the sense of sight",
        body: 'Announce: "In honour of the sense of sight of Jesus." Recall the tears, the blood running into his eyes from the crown of thorns, and the sight of his Mother at the cross. On each of the six small beads pray: "Arise, O Lord, and let your enemies be scattered, and let those who hate you flee before your face." On the large bead pray the Glory Be.',
      },
      {
        order: 6,
        title: "The fourth group: the sense of smell",
        body: 'Announce: "In honour of the sense of smell of Jesus." Recall the filth of the guardroom and of Calvary. On each of the six small beads pray: "Arise, O Lord, and let your enemies be scattered, and let those who hate you flee before your face." On the large bead pray the Glory Be.',
      },
      {
        order: 7,
        title: "The fifth group: the sense of taste",
        body: 'Announce: "In honour of the sense of taste of Jesus." Recall the gall and vinegar offered to him on the cross. On each of the six small beads pray: "Arise, O Lord, and let your enemies be scattered, and let those who hate you flee before your face." On the large bead pray the Glory Be.',
      },
      {
        order: 8,
        title: "The last three beads: the wounds of the Holy Face",
        body: 'On the three remaining small beads pray three times, in honour of the wounds of the Holy Face: "Arise, O Lord, and let your enemies be scattered, and let those who hate you flee before your face." On the final large bead pray the Glory Be.',
      },
      {
        order: 9,
        title: "Close on the medal",
        body: 'On the medal pray: "O God, our protector, look upon us, and cast your eyes upon the face of your Christ" (Psalm 84:9). Then, in reparation: "O Lord, show us your face, and we shall be saved." Make the Sign of the Cross.',
      },
    ],
    relatedPrayers: ["sign-of-the-cross", "glory-be", "anima-christi"],
    relatedDevotions: ["holy-face-of-jesus"],
    relatedSaints: ["saint-therese-of-lisieux"],
  }),
];
