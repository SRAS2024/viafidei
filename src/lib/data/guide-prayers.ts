import type { Locale } from "../i18n/locales";
import { getPublishedPrayersBySlugs } from "./prayers";

/**
 * Mapping of guide slug → ordered list of prayer slugs that the guide
 * references in its narrative. The detail page renders each as an
 * expandable section, looking the body up via getPublishedPrayersBySlugs
 * and falling back to FALLBACK_PRAYERS when the prayer is not yet in the
 * database (a fresh deployment, or a content reset).
 *
 * Add new entries here when a guide is updated; the runtime will simply
 * skip slugs that have no body anywhere.
 */
export const GUIDE_PRAYER_REFERENCES: Record<string, readonly string[]> = {
  "how-to-pray-the-rosary": [
    "sign-of-the-cross",
    "apostles-creed",
    "pater-noster",
    "ave-maria",
    "gloria-patri",
    "fatima-decade-prayer",
    "salve-regina",
    "memorare",
    "hail-holy-queen",
  ],
  "guide-to-confession": ["act-of-contrition", "anima-christi", "prayer-before-confession"],
  "eucharistic-adoration": ["anima-christi", "tantum-ergo", "o-salutaris-hostia", "divine-praises"],
  "consecration-to-jesus-through-mary": ["sub-tuum", "memorare", "salve-regina", "ave-maria"],
  "discerning-a-vocation": ["litany-of-humility", "suscipe", "prayer-for-vocations"],
  "praying-the-divine-mercy-chaplet": [
    "pater-noster",
    "ave-maria",
    "apostles-creed",
    "divine-mercy-eternal-father",
    "divine-mercy-holy-god",
  ],
  "praying-the-liturgy-of-the-hours": ["pater-noster", "gloria-patri", "te-deum"],
  "praying-with-scripture-lectio-divina": ["pater-noster", "veni-creator-spiritus"],
  "novena-to-the-sacred-heart": ["sacred-heart-litany", "anima-christi", "pater-noster"],
  "stations-of-the-cross": ["pater-noster", "ave-maria", "gloria-patri"],
  "examination-of-conscience": ["act-of-contrition", "anima-christi"],
  "preparing-for-mass": ["pater-noster", "ave-maria", "anima-christi"],
};

/**
 * Built-in fallbacks for prayers that may not yet be in the database. Used
 * only when the prayer's slug has no body in the catalog. Translations come
 * from the live database; these are the canonical English forms.
 */
const FALLBACK_PRAYERS: Record<string, { defaultTitle: string; body: string }> = {
  "sign-of-the-cross": {
    defaultTitle: "The Sign of the Cross",
    body: "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
  },
  "apostles-creed": {
    defaultTitle: "The Apostles' Creed",
    body: "I believe in God, the Father almighty, Creator of heaven and earth, and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; he descended into hell; on the third day he rose again from the dead; he ascended into heaven, and is seated at the right hand of God the Father almighty; from there he will come to judge the living and the dead.\n\nI believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.",
  },
  "pater-noster": {
    defaultTitle: "The Our Father",
    body: "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
  },
  "ave-maria": {
    defaultTitle: "The Hail Mary",
    body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
  },
  "gloria-patri": {
    defaultTitle: "The Glory Be",
    body: "Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.",
  },
  "fatima-decade-prayer": {
    defaultTitle: "The Fatima Prayer",
    body: "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of thy mercy. Amen.",
  },
  "salve-regina": {
    defaultTitle: "Salve Regina (Hail, Holy Queen)",
    body: "Hail, Holy Queen, Mother of mercy, our life, our sweetness and our hope! To thee do we cry, poor banished children of Eve. To thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy towards us, and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary.\n\nPray for us, O holy Mother of God, that we may be made worthy of the promises of Christ. Amen.",
  },
  "hail-holy-queen": {
    defaultTitle: "Hail, Holy Queen",
    body: "Hail, Holy Queen, Mother of mercy, our life, our sweetness and our hope! To thee do we cry, poor banished children of Eve. To thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy towards us, and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary. Amen.",
  },
  memorare: {
    defaultTitle: "The Memorare",
    body: "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession, was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee I come; before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
  },
  "sub-tuum": {
    defaultTitle: "Sub Tuum Praesidium",
    body: "We fly to thy patronage, O holy Mother of God. Despise not our petitions in our necessities, but deliver us always from all dangers, O glorious and blessed Virgin. Amen.",
  },
  "act-of-contrition": {
    defaultTitle: "Act of Contrition",
    body: "O my God, I am heartily sorry for having offended Thee, and I detest all my sins because of Thy just punishments, but most of all because they offend Thee, my God, who art all-good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasions of sin. Amen.",
  },
  "prayer-before-confession": {
    defaultTitle: "Prayer Before Confession",
    body: "O Lord, grant me light to see myself as Thou dost see me, and the grace to repent truly and sincerely of my sins. Mary, Mother of mercy, pray for me. Amen.",
  },
  "anima-christi": {
    defaultTitle: "Anima Christi",
    body: "Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Within thy wounds hide me. Suffer me not to be separated from thee. From the malignant enemy defend me. In the hour of my death call me, and bid me come unto thee, that with thy saints I may praise thee for ever and ever. Amen.",
  },
  "tantum-ergo": {
    defaultTitle: "Tantum Ergo",
    body: "Down in adoration falling, lo! the sacred Host we hail; lo! o'er ancient forms departing, newer rites of grace prevail; faith for all defects supplying, where the feeble senses fail.\n\nTo the everlasting Father, and the Son who reigns on high, with the Holy Spirit proceeding forth from each eternally, be salvation, honour, blessing, might and endless majesty. Amen.",
  },
  "o-salutaris-hostia": {
    defaultTitle: "O Salutaris Hostia",
    body: "O saving Victim, opening wide the gate of heaven to man below; our foes press on from every side; thine aid supply, thy strength bestow.\n\nTo thy great name be endless praise, immortal Godhead, One in Three. O grant us endless length of days in our true native land, with thee. Amen.",
  },
  "divine-praises": {
    defaultTitle: "The Divine Praises",
    body: "Blessed be God.\nBlessed be his holy Name.\nBlessed be Jesus Christ, true God and true Man.\nBlessed be the name of Jesus.\nBlessed be his most Sacred Heart.\nBlessed be his most Precious Blood.\nBlessed be Jesus in the most holy Sacrament of the altar.\nBlessed be the Holy Spirit, the Paraclete.\nBlessed be the great Mother of God, Mary most holy.\nBlessed be her holy and Immaculate Conception.\nBlessed be her glorious Assumption.\nBlessed be the name of Mary, Virgin and Mother.\nBlessed be Saint Joseph, her most chaste spouse.\nBlessed be God in his angels and in his saints.",
  },
  "litany-of-humility": {
    defaultTitle: "Litany of Humility",
    body: "O Jesus, meek and humble of heart, hear me.\n\nFrom the desire of being esteemed, deliver me, Jesus.\nFrom the desire of being loved, deliver me, Jesus.\nFrom the desire of being extolled, deliver me, Jesus.\nFrom the desire of being honored, deliver me, Jesus.\nFrom the desire of being praised, deliver me, Jesus.\nFrom the desire of being preferred to others, deliver me, Jesus.\nFrom the desire of being consulted, deliver me, Jesus.\nFrom the desire of being approved, deliver me, Jesus.\n\nFrom the fear of being humiliated, deliver me, Jesus.\nFrom the fear of being despised, deliver me, Jesus.\nFrom the fear of suffering rebukes, deliver me, Jesus.\nFrom the fear of being calumniated, deliver me, Jesus.\nFrom the fear of being forgotten, deliver me, Jesus.\nFrom the fear of being ridiculed, deliver me, Jesus.\nFrom the fear of being wronged, deliver me, Jesus.\nFrom the fear of being suspected, deliver me, Jesus.\n\nThat others may be loved more than I, Jesus, grant me the grace to desire it.\nThat others may be esteemed more than I, Jesus, grant me the grace to desire it.\nThat in the opinion of the world, others may increase, and I may decrease, Jesus, grant me the grace to desire it.\nThat others may be chosen and I set aside, Jesus, grant me the grace to desire it.\nThat others may be praised and I unnoticed, Jesus, grant me the grace to desire it.\nThat others may be preferred to me in everything, Jesus, grant me the grace to desire it.\nThat others may become holier than I, provided that I become as holy as I should, Jesus, grant me the grace to desire it.",
  },
  suscipe: {
    defaultTitle: "Suscipe (Saint Ignatius)",
    body: "Take, Lord, and receive all my liberty, my memory, my understanding, and my entire will. All I have and call my own. Whatever I have or hold, you have given me. I return it all to you and surrender it wholly to be governed by your will. Give me only your love and your grace, and I am rich enough and ask for nothing more. Amen.",
  },
  "prayer-for-vocations": {
    defaultTitle: "Prayer for Vocations",
    body: "Lord Jesus, who called those whom you wished, call many of us to work for you and with you. Lord, who has enlightened all with your word, enlighten in us the gift of vocation. Lord, who has loved us with your example, grant us the courage to follow you. Mary, Mother of all Christians, pray for us. Amen.",
  },
  "divine-mercy-eternal-father": {
    defaultTitle: "Eternal Father (Divine Mercy)",
    body: "Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.",
  },
  "divine-mercy-holy-god": {
    defaultTitle: "Holy God (Divine Mercy)",
    body: "Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.",
  },
  "te-deum": {
    defaultTitle: "Te Deum",
    body: "We praise you, O God: we acclaim you as the Lord. Everlasting Father, all the world bows down before you. All the angels sing your praise, the hosts of heaven and all the angelic powers, all the cherubim and seraphim call out to you in unending song: Holy, Holy, Holy, is the Lord God of angel hosts! The heavens and the earth are filled with your majesty and glory.\n\nThe glorious band of apostles, the noble company of prophets, the white-robed army who shed their blood for Christ, all sing your praise. And to the ends of the earth your holy Church proclaims her faith in you: Father, whose majesty is boundless; your true and only Son, who is to be adored; the Holy Spirit, sent to be our Advocate. Amen.",
  },
  "veni-creator-spiritus": {
    defaultTitle: "Veni Creator Spiritus",
    body: "Come, Holy Spirit, Creator blest, and in our souls take up thy rest; come with thy grace and heavenly aid to fill the hearts which thou hast made.\n\nO Comforter, to thee we cry, thou heavenly gift of God most high, thou Fount of life, and Fire of love, and sweet anointing from above.\n\nO finger of the hand divine, the sevenfold gifts of grace are thine; true promise of the Father thou, who dost the tongue with power endow.\n\nKindle our senses from above, and make our hearts o'erflow with love; with patience firm and virtue high the weakness of our flesh supply.\n\nFar from us drive the foe we dread, and grant us thy true peace instead; so shall we not, with thee for guide, turn from the path of life aside.\n\nO may thy grace on us bestow the Father and the Son to know, and thee through endless times confessed of both the eternal Spirit blest. Amen.",
  },
  "sacred-heart-litany": {
    defaultTitle: "Litany of the Sacred Heart (excerpt)",
    body: "Lord, have mercy. Christ, have mercy. Lord, have mercy.\nChrist, hear us. Christ, graciously hear us.\nGod, the Father of heaven, have mercy on us.\nGod, the Son, Redeemer of the world, have mercy on us.\nGod, the Holy Spirit, have mercy on us.\nHoly Trinity, one God, have mercy on us.\n\nHeart of Jesus, Son of the Eternal Father, have mercy on us.\nHeart of Jesus, formed by the Holy Spirit in the womb of the Virgin Mother, have mercy on us.\nHeart of Jesus, substantially united to the Word of God, have mercy on us.\nHeart of Jesus, of infinite majesty, have mercy on us.\nHeart of Jesus, holy temple of God, have mercy on us.\nHeart of Jesus, tabernacle of the Most High, have mercy on us.\nHeart of Jesus, house of God and gate of heaven, have mercy on us.\nHeart of Jesus, burning furnace of charity, have mercy on us.\nHeart of Jesus, abode of justice and love, have mercy on us.\nHeart of Jesus, full of goodness and love, have mercy on us.",
  },
};

export type GuidePrayerEntry = { slug: string; title: string; body: string };

/**
 * Resolve every prayer the guide references, in order, returning the title
 * and body for each. Pulls live data from the database first (so admins can
 * edit prayer text), and falls back to the in-app FALLBACK_PRAYERS for
 * slugs that haven't been ingested yet.
 *
 * Returns an empty list when the guide has no associated prayers.
 */
export async function resolveGuidePrayers(
  guideSlug: string,
  locale: Locale,
): Promise<GuidePrayerEntry[]> {
  const slugs = GUIDE_PRAYER_REFERENCES[guideSlug];
  if (!slugs || slugs.length === 0) return [];
  const fromDb = await getPublishedPrayersBySlugs(slugs, locale);
  const out: GuidePrayerEntry[] = [];
  for (const slug of slugs) {
    const dbHit = fromDb.get(slug);
    if (dbHit) {
      out.push({ slug, title: dbHit.defaultTitle, body: dbHit.body });
      continue;
    }
    const fallback = FALLBACK_PRAYERS[slug];
    if (fallback) {
      out.push({ slug, title: fallback.defaultTitle, body: fallback.body });
    }
  }
  return out;
}
