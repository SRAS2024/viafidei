import type { CuratedEntry } from "../index";

/**
 * The archive.org scan of Preces Gertrudianae: Prayers of St. Gertrude and St.
 * Mechtilde of the Order of St. Benedict (London: Burns and Lambert, 1861),
 * addressed by leaf: printed page P of the prayers is leaf n(P + 12).
 */
const PRECES = "https://archive.org/details/PrecesGertrudianae/page/n";

/**
 * The archive.org scan of Revelations of St. Bridget, on the Life and Passion
 * of Our Lord, and the Life of His Blessed Mother (New York: D. & J. Sadlier,
 * 1862), addressed by leaf: printed page P is leaf n(P + 53).
 */
const REVELATIONS = "https://archive.org/details/revelationsofstb0000revw/page/n";

/** The prayerType values of the PRAYER schema that this batch uses. */
type PrayerType =
  | "morning"
  | "evening"
  | "meal"
  | "general"
  | "intercession"
  | "act"
  | "marian"
  | "consecration"
  | "chaplet";

interface SourcedPrayer {
  slug: string;
  title: string;
  /** Leaves of the scan the prayer runs over, first leaf first. */
  leaves: number[];
  /** Paragraphs as printed. */
  body: string[];
  prayerType: PrayerType;
  category: string;
  occasions: string[];
  relatedSaints?: string[];
  summary: string;
}

/**
 * Batch 13 of the curated prayer catalogue: the prayers of the medieval women
 * mystics Saint Gertrude the Great and Saint Mechtilde of Helfta, in the
 * English of the Preces Gertrudianae of 1861, and the prayers of Saint Bridget
 * of Sweden, in the English of the Revelations of St. Bridget of 1862.
 *
 * The Preces Gertrudianae is a Latin manual compiled in the seventeenth
 * century from the revelations of the two Benedictine nuns of Helfta. Its
 * English translation, "the only one from the Latin" in the words of its own
 * preface, was published in London by Burns and Lambert in 1861 with the
 * approval of Cardinal Wiseman, dated at Westminster in May 1861 and printed
 * at the back of the book, before the index (leaf n286 of the scan); the
 * archive.org record credits the translation to Thomas Alder Pope
 * (1819-1904). The Revelations of St. Bridget, a selection from her
 * revelations with an essay by William H. Neligan, was published in New York
 * by D. & J. Sadlier, entered for copyright in 1862; its last two chapters
 * are Saint Bridget's prayers. Both books are in the public domain.
 * Every citation is the archive.org scan of the book (for the Preces a Google
 * scan, for the Revelations the Graduate Theological Union's copy), opened at
 * the leaf where the prayer begins, followed by any leaf it runs on to.
 *
 * Every body is transcribed from those page images and checked word by word
 * against two independent OCRs of them: the text layer archive.org publishes
 * with the scan and a second recognition of the same images, read column by
 * column where the page has two. Every place where the two disagree, or where
 * either looks wrong, was settled by reading the page image itself, and
 * paragraph breaks follow the indents of the printed page. Nothing is
 * paraphrased, shortened, modernised, composed or merged across versions. The
 * changes are typographical only:
 *   - the capitals of the opening words and the drop initials ("O MOST loving
 *     Je-sus", "HAIL, my God", "O JESUS CHRIST") are given in ordinary case;
 *   - line-end hyphens are closed up, while the compounds the book hyphenates
 *     elsewhere keep their hyphen (Life-giving, sweet-smelling, ever-peaceful,
 *     only-begotten, well-beloved); words the book prints solid elsewhere are
 *     given solid when a line end breaks them ("fivefold", as it prints
 *     "twofold" and "thousandfold"; "cooperation");
 *   - the space the period set before ; : ! and ? is closed, a space the
 *     printer dropped between two words is restored ("tremendous Mysteries",
 *     "me, for salvation", "it may be therein cleansed"), and apostrophes and
 *     quotation marks are given as plain ASCII characters;
 *   - specks of ink in the scan that are not letters are ignored, and worn
 *     type is read as the letter it is: the broken final "e" of "thee" in the
 *     Morning Aspiration to Jesus;
 *   - two plain printer's slips are corrected: the Golden Salutation of the
 *     Blessed Virgin ends "Amen," in the Preces, given here as "Amen."; and
 *     the Revelations repeat "the" across a line end in Saint Bridget's prayer
 *     to Mary as the temple of Solomon ("of him who is the / the father of
 *     David"), given once.
 * Italic type is not reproduced, but the ligature of the Latin word "Væ"
 * (woe) in the Golden Ave Maria is kept as printed. The Preces' alternative in
 * square brackets ("[or, this prayer]") and its "N." for a name are kept, and
 * so are the rubrics the Revelations print between the Fifteen Prayers ("Our
 * Father. Hail Mary.", "After five Our Fathers say the following prayer:"),
 * in plain type, together with the numbers that head each prayer. The
 * Revelations' references to the book and chapter of the Revelations
 * ("Lib. iii., c. 29") are not part of the prayers and are left out.
 *
 * The Preces sets an italic note before many prayers, reporting what Our Lord
 * said to Saint Gertrude or Saint Mechtilde about it. Those notes are not part
 * of the prayers and are not copied; a summary may say that the book connects
 * a prayer with one of the saints, but it repeats no promise. A title credits
 * the saint the book itself names for the prayer, Saint Gertrude by default,
 * as the book's running head ("Prayers of St. Gertrude") does; the greeting
 * for a burial-ground, which the book gives without naming any author, is
 * credited to no one.
 *
 * relatedSaints follows the same credit and adds the saint a prayer is
 * addressed to or about, but it names only saints that have a curated SAINT
 * entry, since tests/checklist/knowledge.test.ts resolves every reference
 * (and a curated entry for a saint already published would replace the live
 * page through the worker's curated sync). Saint Mechtilde and Saint Michael
 * have none: the prayers the book credits to Saint Mechtilde name no saint
 * but Saint Mary Magdalen in the thanksgiving for her tears, the Spiritual
 * Communion credited to both saints names Saint Gertrude, and the salutation
 * of Saint Michael names Saint Gertrude only.
 *
 * Left out on purpose: the prayer after the Elevation, a word of which is
 * illegible in the scan; the Preces' "Ten Prayers on the Passion", a shorter
 * form of the Fifteen Prayers of Saint Bridget given here from the
 * Revelations; its first hymn of praise, which is the Benedicite (Daniel
 * 3:52-57); its prayer to the Holy Name, the Raccolta's "O good Jesu" already
 * in the catalogue; its prayers before and after sacramental penance, which
 * batch 12 gives from the Manual of Prayers; its Three Ave Marias for a good
 * death, built on the Hail Mary; its litanies, which Cardinal Wiseman's
 * approval excludes from public worship; and the one-line ejaculations.
 */
function preces(input: SourcedPrayer): CuratedEntry {
  const citations = input.leaves.map((leaf) => `${PRECES}${leaf}/mode/1up`);
  return {
    contentType: "PRAYER",
    slug: input.slug,
    authorityLevel: "TRUSTED_PUBLISHER",
    citations,
    payload: {
      slug: input.slug,
      title: input.title,
      body: input.body.join("\n\n"),
      prayerType: input.prayerType,
      category: input.category,
      language: "en",
      summary: input.summary,
      occasions: input.occasions,
      relatedSaints: input.relatedSaints ?? ["saint-gertrude-the-great"],
      citations,
    },
  };
}

/** An entry from the Revelations of St. Bridget (Sadlier, 1862). */
function revelations(input: SourcedPrayer): CuratedEntry {
  const citations = input.leaves.map((leaf) => `${REVELATIONS}${leaf}/mode/1up`);
  return {
    contentType: "PRAYER",
    slug: input.slug,
    authorityLevel: "TRUSTED_PUBLISHER",
    citations,
    payload: {
      slug: input.slug,
      title: input.title,
      body: input.body.join("\n\n"),
      prayerType: input.prayerType,
      category: input.category,
      language: "en",
      summary: input.summary,
      occasions: input.occasions,
      relatedSaints: input.relatedSaints ?? ["saint-bridget-of-sweden"],
      citations,
    },
  };
}

const REVELATIONS_NOTE =
  "From the Revelations of St. Bridget, an English selection from the revelations of Saint Bridget of Sweden (1303-1373) published in New York by D. & J. Sadlier in 1862.";

const PRECES_NOTE =
  "From the Preces Gertrudianae, the seventeenth-century manual of prayers drawn from the revelations of Saint Gertrude and Saint Mechtilde of Helfta, in its English translation of 1861.";

export const prayerBatch13: CuratedEntry[] = [
  // ── Preces Gertrudianae, Part I: prayers for daily use ─────────────────────
  preces({
    slug: "mechtilde-morning-salutation-of-the-sacred-heart",
    title: "Morning Salutation of the Sacred Heart (Saint Mechtilde)",
    leaves: [13, 14],
    body: [
      "I adore, praise, and salute thee, O most sweet Heart of Jesus Christ, fresh and gladdening as the breath of spring, from which, as from a fountain of graces, sweeter than the honeycomb, floweth evermore all good and all delight. I thank thee with all the powers of my heart for having preserved me throughout this night, and for having rendered to God the Father praises and thanksgivings on my behalf. And now, O my sweet Love, I offer thee my wretched and worthless heart as a morning sacrifice; I place it in thy most tender Heart, and intrust it to thy keeping; beseeching thee that thou wouldst deign to pour into it thy divine inspirations, and to enkindle it with thy holy love. Amen.",
    ],
    prayerType: "morning",
    category: "devotional",
    occasions: ["morning", "sacred-heart", "daily"],
    relatedSaints: [],
    summary: `The first of the book's morning prayers: a greeting of the Sacred Heart of Jesus on waking, thanks for the night, and the offering of one's own heart as a morning sacrifice, to be kindled with his love. The book introduces it with Our Lord's words to Saint Mechtilde, bidding her salute his Heart as her first act of the day. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-recommendation-to-jesus-against-sin",
    title: "Recommendation to Jesus against Sin (Saint Gertrude)",
    leaves: [14, 15],
    body: [
      "O Jesus, full of compassion, I commend to thee my spirit and my soul, in union with that love wherewith thou didst commend thine own to the Father on the cross; and I place them in the most sacred wound of thy tender Heart, that they may be therein protected from all the snares of the enemy. Thou knowest, O good Jesus, and I know by my own sad experience, how weak and frail I am, so that I could not of myself persevere in good, or resist temptation even for one single hour. Wherefore I pray thee, by the reverence due to that union wherein thy manhood is united to the adorable Trinity in order to our glorification, that thou wouldst deign to unite my will to thine, and so to strengthen and secure it, that it may be unable to rebel against thee. In union with thy most sinless limbs, I commend to thee all the members of my body, with all their movements, that they may throughout this day move for thy glory alone, for thy praise and thy love. Amen.",
    ],
    prayerType: "morning",
    category: "devotional",
    occasions: ["morning", "temptation", "daily"],
    summary: `A morning commendation of soul and body to Christ, made in union with his own commendation of his spirit to the Father on the cross: the soul is placed in the wound of his Heart, out of reach of the enemy, and the will is asked to be united with his so that it cannot rebel. The book links it with a revelation to Saint Gertrude about those who commend themselves to God to be kept from sin. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "mechtilde-morning-aspiration-to-jesus",
    title: "Morning Aspiration to Jesus (Saint Mechtilde)",
    leaves: [15],
    body: [
      "O most loving Jesus, I breathe towards thee this sigh, drawn from the depth of my heart, beseeching thee, with all my might, that thou wouldst deign thyself to work in me all my works, whether of body or of soul, to cleanse them all in thy sweetest Heart, and to offer them, in union with thine own most perfect works, to God the Father as an eternal thanksgiving. Amen.",
    ],
    prayerType: "morning",
    category: "devotional",
    occasions: ["morning", "offering", "daily"],
    relatedSaints: [],
    summary: `A short morning aspiration asking Jesus to work all the day's works in the one who prays, to cleanse them in his Heart and to offer them with his own works to the Father. The book prefaces it with words of Our Lord to Saint Mechtilde about the sigh of longing breathed towards him on waking. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-intention-to-be-formed-in-the-morning",
    title: "Intention to Be Formed in the Morning (Saint Gertrude)",
    leaves: [16],
    body: [
      "O Lord, my God, for thy sake I resolve to perform all my actions, whether outward or inward, purely for thy glory, and for the salvation of the whole world; with such intention and in such manner as thou dost desire and enjoin; and in union with that love whereby thy Son came down from heaven, and wrought out the whole work of our salvation, especially during his Passion. Wherefore I entirely disclaim all merit, all reward and grace which I might otherwise hope to obtain by these actions, that I may offer to thee, my God, a pure sacrifice of praise, and give thee a proof of my love.",
    ],
    prayerType: "morning",
    category: "devotional",
    occasions: ["morning", "offering", "daily"],
    summary: `A morning resolution to do every action of the day purely for God's glory and the salvation of the world, in union with the love of Christ's Passion, renouncing any thought of one's own merit so as to offer God a pure sacrifice of praise. The book places it under a revelation to Saint Gertrude about works done purely for God. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-covenant-with-god",
    title: "Covenant with God (Saint Gertrude)",
    leaves: [16, 17],
    body: [
      "O Almighty God, I sanctify, dedicate, and consecrate to thee every beating of my heart, and every pulsation of my blood; and I desire to make this compact with Thee, that their every beating shall say to thee: Holy, holy, holy, Lord God of Sabaoth; and I beseech thee to impute this meaning to them, so that they may be before thy Divine Majesty as the unceasing echo of that heavenly canticle, which seraphims sing without ceasing unto thee. Amen. Amen.",
    ],
    prayerType: "consecration",
    category: "devotional",
    occasions: ["morning", "praise", "daily"],
    summary: `A consecration of every heartbeat and pulse to God, with the request that each be taken as the seraphim's "Holy, holy, holy, Lord God of Sabaoth", so that the body's own rhythm becomes an unceasing echo of the heavenly Sanctus. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-weekly-covenant-with-god",
    title: "A More Extended Covenant, to Be Renewed Every Week (Saint Gertrude)",
    leaves: [17, 18],
    body: [
      "O Lord God, my Creator, all my desire is before thee, and my groaning is not hidden from thee; but inasmuch as the necessities of this life prevent the constant application of my mind to thy praises, I make with thee this covenant, earnestly desiring that it may remain in force throughout this week.",
      "Whenever I look up towards heaven, I desire and intend to rejoice with thee in thine infinite perfections; that thou art what thou art, supremely, strong and wise and loving and just.",
      "As often as I open or close my eyes, I desire and intend to approve and concur in all the holy actions which thine only-begotten Son, and all the saints in heaven and just on earth, have ever done, or shall ever hereafter do, to thy glory, and desire to be held a partaker in them all.",
      "As often as I draw my breath, I offer to thee the Life and Passion and Blood of our Lord Jesus Christ, and the merits and sufferings of all the saints, to thine eternal glory, for the welfare and peace of all the whole world, and in satisfaction for the sins of all men.",
      "Whenever I sigh, I intend to detest and abhor every sin, as well my own sins as those which have ever been committed from the beginning of the world against the honour of thy Name. Would that the slight and worthless offering of my blood might be accepted in satisfaction for them!",
      "Lastly, as often as I move my hand or my foot, so often do I cast myself with entire resignation upon thy most holy will, desiring that thou wouldst dispose of me in time and in eternity, according to thine adorable good pleasure.",
      "And, lest this fivefold covenant should be in any way made void, I seal it with the seals of thy five most Sacred Wounds, earnestly desiring that it may have its full force with thee, even though in any one of these actions it be not actually present to my mind.",
    ],
    prayerType: "consecration",
    category: "devotional",
    occasions: ["morning", "offering"],
    summary: `A covenant made with God for a week at a time, since the cares of life keep the mind from praising him constantly: looking up to heaven, opening or closing the eyes, breathing, sighing and moving hand or foot are each given a standing intention of praise, of union with the holy works of Christ and the saints, of offering his Passion, of sorrow for sin and of surrender to God's will, and the whole is sealed with the Five Wounds. It opens with words of Psalm 37 (38). ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-before-the-divine-office",
    title: "Prayer before the Divine Office or Other Prayer (Saint Gertrude)",
    leaves: [19, 20],
    body: [
      "O Almighty, everlasting God, I, thy most unworthy creature, appear here before the throne of thy grace, desiring to pour out my heart before thee, and to worship thee, my God, as well and as perfectly as I can. Wherefore I begin and will faithfully continue this divine office [or, this prayer] in union with the love wherewith thy Son worshipped thee, and wrought all the whole work of our redemption; beseeching thee that I may be enabled to pay thee a tribute of honour and praise like that which the most precious Humanity of Jesus and the most holy Virgin Mary rendered thee unceasingly. And to this end I offer these my prayers to thee, in the virtue and merit of the Sacred Heart of Jesus, in his Name and in that of all thy holy angels and saints, to thy eternal praise and glory. I humbly implore thee to preserve me from all distraction and dryness of spirit, and to enable me duly to bring thee this my appointed tribute of prayer. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["office", "daily"],
    summary: `A prayer for the beginning of the Divine Office, or of any other prayer, offering it in union with the worship Christ gave the Father and in the merit of his Sacred Heart, and asking to be kept from distraction and dryness of spirit. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-after-the-divine-office",
    title: "Prayer after the Office or Any Other Prayer (Saint Gertrude)",
    leaves: [21],
    body: [
      "O Lord Jesus, I commend this my lukewarm and distracted service to thy Divine Heart, that it may be therein cleansed and perfected; I offer it to thee in union with the love with which thou didst endure death, and set forth thy death, together with all the fruit of thy holy Incarnation, before God the Father on the day of thine ascension.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["office", "daily"],
    summary: `A short prayer said when the Office or any other prayer is finished, entrusting its lukewarmness and distractions to the Heart of Jesus to be cleansed and perfected there. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-on-leaving-church",
    title: "Prayer on Leaving Church (Saint Gertrude)",
    leaves: [22, 23],
    body: [
      "O most pitiful Jesus, I give thee thanks for every good gift which thou hast bestowed on me in this church. And now that I am about to leave it, I offer thee, in union with thy own most perfect prayers, all the prayers and other devotions which I have performed therein; beseeching thee that thou wouldst deign to ennoble and perfect them in thy Divine Heart, to unite them with every holy intention and every feeling of devotion which thou hast ever elicited from any heart of man, and to offer them to God the Father, for all my negligences and omissions, as a grateful satisfaction and a most acceptable sacrifice; and I implore thee to grant me that most holy blessing which thou gavest to thine apostles when thou didst ascend into heaven, so that by its force and efficacy I may be enabled to persevere in thy grace, and to serve thee faithfully evermore. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["visit-to-the-blessed-sacrament", "after-mass", "daily"],
    summary: `A prayer said on leaving a church: thanks for the graces received there, the offering of one's prayers to be perfected in the Heart of Jesus, and a request for the blessing he gave the apostles at his Ascension, so as to persevere in his grace. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-when-the-clock-strikes",
    title: "Prayer When the Clock Strikes (Saint Gertrude)",
    leaves: [24],
    body: [
      "O most sweet Jesus, I commend to thy Divine Heart all that I have done in the hour that is gone, to be cleansed and purified, and offered to God the Father for his eternal praise. And whatsoever I shall do in the hour that is beginning, I resolve to do simply and purely for the glory of God and for the salvation of all mankind, in union with thy Passion. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["daily", "offering", "work"],
    summary: `A brief prayer for the striking of the hour, commending the hour just past to the Heart of Jesus to be purified and offered to the Father, and resolving to spend the coming hour purely for God's glory and the salvation of all. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-before-eating",
    title: "Prayer before Eating (Saint Gertrude)",
    leaves: [25],
    body: [
      "O Lord Jesus, I take this food in that same love wherewith thou hast sanctified it, when in thy most holy Humanity thou didst deign to eat and to drink to the glory of God the Father, and for the salvation of the whole human race; beseeching thee that, in union with thy divine love, it may tend to the increase of glory, and salvation of all thine elect in heaven, on earth, or in purgatory.",
    ],
    prayerType: "meal",
    category: "meal",
    occasions: ["meal", "daily"],
    summary: `A grace before meals that unites one's eating with Christ's own, who in his sacred Humanity ate and drank for the glory of the Father and the salvation of the world. The book places it under words of Our Lord to Saint Gertrude. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-thanksgiving-of-wonderful-efficacy",
    title: "A Thanksgiving of Wonderful Efficacy (Saint Gertrude)",
    leaves: [26, 27],
    body: [
      "Hail, my God, Light and Salvation of my soul, may all that is in the round world, and within the circle of the heavens, and in the depths of the abyss, give thee thanks for all the benefits and tender mercies which thou hast bestowed on me in body and in soul. And as the number of them is so great that I cannot answer thee for one of a thousand, I make over this duty to that eternal, infinite, unfailing gratitude whereby every debt to thee is acquitted by thyself, and through thyself, and in thyself, O thou bright and ever-peaceful Trinity! and obtruding myself on thy notice as a grain of dust, I offer thee, through him who stands at thy right hand, in the truth of my substance, such praise and thanksgiving as thou hast enabled us by thy Spirit to render to thee. Amen.",
    ],
    prayerType: "evening",
    category: "trinitarian",
    occasions: ["evening", "thanksgiving", "trinity-sunday"],
    summary: `The thanksgiving that opens the book's evening prayers: all creation is called on to thank God for his benefits, and since they are past counting, the debt of gratitude is handed over to the eternal gratitude of the Blessed Trinity itself and offered through Christ at the Father's right hand. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-evening-act-of-contrition",
    title: "Evening Act of Contrition (Saint Gertrude)",
    leaves: [27],
    body: [
      "O most loving Father, in the bitterness of the Passion of Jesus Christ thy Son I pour forth now my complaint, indignantly accusing myself that I have served thee so unfaithfully this day, and have offended thee, my most kind and loving Father, by so many and so great negligences. I grieve for them from my inmost heart, and smite my breast in the spirit of contrition, and say unto thee: God be merciful to me a sinner! And for all the negligences whereby I have quenched thy good and gentle Spirit within me, I offer thee the sorrows and the tears of thy beloved Son. I beseech thee, in union with his most availing prayers, to grant me the pardon of my sins, and the supply of all my defects. Deign to hear this my prayer through that love which held back thine arm from taking vengeance when thy only and most beloved Son, the object of thine eternal and ineffable complacency, was numbered with transgressors. Amen.",
    ],
    prayerType: "evening",
    category: "penitential",
    occasions: ["evening", "examination-of-conscience", "penance"],
    summary: `The act of contrition the book sets after the evening examination of conscience: the day's unfaithfulness is confessed to the Father with the publican's prayer, and the sorrows and tears of his Son are offered in reparation, through the love that spared sinners when Christ was numbered with transgressors. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-night-recommendation-to-the-sacred-heart",
    title: "Night Recommendation to the Sacred Heart of Jesus (Saint Gertrude)",
    leaves: [28],
    body: [
      "O sweetest Heart of Jesus, to thee I commend my body and my soul this night, that they may calmly rest in thee. And as I cannot praise my God while I sleep, do thou deign to supply my lack of service, and for every beating of my heart give praise to the most Holy Trinity on my behalf; receive into thyself every breath I draw, and offer them all to God as glowing sparks of divine love. Amen.",
    ],
    prayerType: "evening",
    category: "devotional",
    occasions: ["evening", "night-prayer", "sacred-heart"],
    summary: `A night prayer entrusting body and soul to the Heart of Jesus for the hours of sleep, and asking that Heart to praise the Holy Trinity for every heartbeat and to offer every breath to God, since the sleeper cannot praise him. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-night-prayer-to-the-blessed-virgin-and-guardian-angel",
    title:
      "Night Prayer to the Blessed Virgin, the Guardian Angel and the Patron Saints (Saint Gertrude)",
    leaves: [28],
    body: [
      "To thy maternal faithfulness and to thy special care, O most blessed Virgin Mary, I commend myself this night, beseeching thee to protect me from all the snares of the enemy. O my beloved angel guardian, and you, holy saints, my patrons, defend me and keep me in safety through this night. Praise my God for me without ceasing while I sleep, and deign to bestow on me your blessing in answer to my humble prayer. Amen.",
    ],
    prayerType: "evening",
    category: "marian",
    occasions: ["evening", "night-prayer", "guardian-angels"],
    summary: `A night prayer commending oneself to the motherly care of the Blessed Virgin, and asking one's guardian angel and patron saints to keep watch through the night and to praise God on one's behalf during sleep. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-intention-before-sleep",
    title: "Intention before Sleep (Saint Gertrude)",
    leaves: [28, 29],
    body: [
      "O Lord Jesus, I accept this sleep in the love with which thou didst sanctify it when thou didst deign to sleep in thy most sacred Humanity, to the glory of God the Father, and for the salvation of all the whole human race; beseeching thee that, in union with thy divine Son, it may tend to the increase in grace and glory of all thine elect, in heaven, on earth, and in purgatory. Amen.",
    ],
    prayerType: "evening",
    category: "devotional",
    occasions: ["evening", "night-prayer", "offering"],
    summary: `An intention for going to sleep, accepting the night's rest in union with Christ's own sleep in his sacred Humanity and offering it for the good of the whole Church in heaven, on earth and in purgatory. The book gives it as taught to Saint Gertrude by Our Lord. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-for-needful-sleep",
    title: "Prayer for Needful Sleep (Saint Gertrude)",
    leaves: [29],
    body: [
      "By thine own eternal and unruffled repose in the bosom of God the Father, by thy most peaceful rest in the womb of the Blessed Virgin, by the most ecstatic rapture with which thou didst ever take thy delight in the hearts of those who love thee, I beseech thee, O most loving Lord, deign to grant me needful sleep, not for my pleasure or advantage, but that the weary members of my body may be refreshed to labour for thy eternal praise and glory. Amen.",
    ],
    prayerType: "evening",
    category: "devotional",
    occasions: ["evening", "night-prayer"],
    summary: `A prayer for sleep, made by Christ's eternal repose in the bosom of the Father, his rest in the womb of the Virgin and his delight in the hearts that love him, and asking rest only so that the body may be refreshed to labour for God's glory. The book says Saint Gertrude learned it from Christ on a night when she could not sleep. ${PRECES_NOTE}`,
  }),

  // ── Preces Gertrudianae, Part II: the Holy Sacrifice of the Mass ───────────
  preces({
    slug: "gertrude-prayer-before-mass",
    title: "Prayer before Mass (Saint Gertrude)",
    leaves: [30, 31, 32],
    body: [
      "O Almighty, everlasting God, seeing that it is the true faith of thy Church that the holy sacrifice of the Mass instituted by thy Son is infinitely pleasing to thy divine Majesty, and renders thee an infinite worship and praise, and since by it alone thou canst be worthily and adequately worshiped and praised; impelled by an ardent desire of thy honour and glory, I purpose to assist at this present sacrifice with the utmost devotion of which I am capable, and to offer this most Holy Oblation to thee in union with thy priest. I offer thee not only this sacrifice, but all those which shall be this day offered from every part of the world; and I protest before thee that if it depended on me whether they should be offered or omitted, I would put forth all my powers to procure and further their being offered. And were I able now to raise up to thee, of the stones which are scattered over the earth, most devoted priests, who should day by day and with glowing fervour offer to thee this sacrifice of praise, I would most gladly do it. But, being what I am, I implore thee, O most holy Father, through Jesus Christ thy Son, to pour into the hearts of all thy priests, and especially those who might perchance otherwise offer thee this acceptable sacrifice coldly and without due recollectedness, the spirit of grace and of fervour, that they may be enabled to celebrate thy tremendous Mystery with becoming awe and devotion. Grant to me, and to all those who are here present with me, that we may join in this most sacred action with reverence and devotion, so that we may have our portion in its fruit and effect. I confess to thee, O almighty God, and to the Blessed Mary ever Virgin, and to all the Saints, my own sins and those of all the world; and I lay them on thy sacred Altar, that they may be entirely blotted out by the virtue of this sacrifice. Do thou deign to grant us this grace, by that love which held back thy hand from smiting when thy most beloved Son, thy only Son, was immolated by the hands of ungodly men. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["before-mass", "mass", "for-priests"],
    summary: `A preparation for hearing Mass: the intention to offer the Holy Sacrifice with the priest, and with it every Mass offered that day throughout the world; a prayer that all priests may celebrate with awe and fervour; and the laying of one's own sins and those of the world on the altar to be blotted out by the Sacrifice. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-offering-at-the-offertory",
    title: "Offering at the Offertory of the Mass (Saint Gertrude)",
    leaves: [32, 33],
    body: [
      "O most merciful Father, in union with that unimaginable love wherewith thy only Son offered to thee the whole influx of the Godhead into his Humanity, and thus with ineffable gratitude referred it back to its immeasurable, unfathomable source, I offer thee whatever gifts and graces thou hast ever bestowed on me of thy sovereign and unutterable goodness; and I lay them on thine altar, together with the merits and graces of the same thy Son, as a sacrifice of everlasting praise, and a pledge and expression of my boundless gratitude to thee. More especially, I offer thee my heart, all too defiled and loathsome as it is; and I plunge it into this Chalice, to the end and with the desire that all the prayers and benedictions which shall be spoken over this Chalice may be spoken also over my heart, and that by the virtue of the ineffable consecration whereby thou changest this wine into the Blood of thy Son, it may be wholly turned to the perfect and constraining love of thee.",
      "And that I may obtain these my petitions, I unite myself to all the love and the gratitude with which thy Son endured all his sorrows; and I offer to thee whatever sorrow or affliction thy fatherly love has ever laid on me or any son of man in order to our salvation, beseeching thee that they may come up before thee in union with this sacrifice as a sweet-smelling odour, and may avail for our salvation.",
      "Finally, in union with the resignation of thy only Son I offer and resign myself to thy most holy will, beseeching thee with my whole heart that thy adorable good pleasure may always in all things be done in me and by me and in all that concerns me. To this end I lay at thy feet, O thou King of kings and my Lord, all my substance and being, my body and my soul, to serve thee henceforth and evermore to the glory of thy most worshipful Majesty. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "offering"],
    summary: `An offering for the Offertory of the Mass, in three parts: every gift and grace received is laid on the altar with the merits of Christ, the heart is plunged into the chalice to be changed into perfect love by the consecration, every sorrow is offered with the Sacrifice, and finally the whole self is resigned to God's will. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-at-the-secret-of-the-mass",
    title: "Prayer at the Secret of the Mass (Saint Gertrude)",
    leaves: [34],
    body: [
      "Look down, O tender Father, from the throne of thy Majesty and from the lofty dwelling-place of thy heavens, upon this oblation which our holy Mother the Church, thy Bride, offers to thee by the hands of thy priest; and through its force and merit be appeased for our manifold transgressions. Accept, I beseech thee, the sacrifice which I, thy most worthless servant, offer to thee my living and true God in my own name and in that of all the whole world; in union with all the merits of thy most beloved Son, with all the treasure of thy holy Church, for my innumerable sins, offences, and negligences, and for all the faithful, living and departed, that to them and to me it may avail for salvation unto eternal life. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "all-souls"],
    summary: `The book's prayer for the Secret, the silent prayer over the offerings in the old Roman Mass: God is asked to look down on the oblation the Church offers by the priest's hands, and to accept it for one's sins and for all the faithful living and departed. It echoes the Suscipe, sancte Pater of the old Offertory. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-at-the-canon-of-the-mass",
    title: "Prayer at the Canon of the Mass (Saint Gertrude)",
    leaves: [36, 37],
    body: [
      "O ineffable God, we are now drawing near to those tremendous Mysteries which neither Cherubim nor Seraphim nor all the virtues of heaven suffice to comprehend, for thou alone knowest with what energy of love thou dost daily offer thyself to God the Father upon the altar as a victim of praise and propitiation. And therefore all choirs and orders of Angels adore this thy most sacred and impenetrable secret with lowliest prostration, and behold with awe their King and their Lord, who once came down from heaven in unutterable love to redeem man, now again mysteriously present upon the altar, hidden beneath the mean and lowly species of bread and wine for the salvation of men.",
      "O good Jesus, this work which thou art now about to work is so transcendently adorable that I dare not even look up to thee from the depth of my nothingness. Wherefore I bury myself in the lowest, deepest valley of humiliation I can find, and there await the portion of thy substance that falleth to me, for salvation goeth forth from thee upon all thine elect. Would, O loving Jesus, that my weak arm might aid thee in thy divine work, and obtain for this most holy oblation its full effect according to its ineffable dignity and worth; to effect this the most weary and painful toil would be sweet and light to me. Wherefore I pray thee, grant to this thy priest that he may with due reverence handle thee and offer thee, so that this oblation may have its fullest force and efficacy on all the living and departed. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "adoration", "for-priests"],
    summary: `A prayer for the beginning of the Canon of the Mass, adoring with the angels the mystery of Christ's daily self-offering on the altar under the lowly species of bread and wine, waiting in humility for one's share of its grace, and praying that the priest may handle and offer him with due reverence. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-to-the-father-at-the-elevation",
    title: "Prayer to God the Father at the Elevation (Saint Gertrude)",
    leaves: [37, 38],
    body: [
      "O most loving Father, in union with that love wherewith thy Son offered himself once upon the cross, and now offers himself to thee upon the altar, I offer him to thee for the welfare and salvation of all thy whole Church. Look upon his virgin Flesh, so cruelly torn by the scourges, bruised with blows and buffetings, defiled with spittings, besmeared with Blood, pierced with the thorns, swollen and livid with stripes, torn by the nails, rent with the lance. May that pity which drew him down from heaven and sweetly constrained him to immolate himself on the cross, and constrains him now to offer himself daily to thee upon the altar; may that same pity move thee now, O Father, to have mercy on us. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "passion", "for-the-church"],
    summary: `A prayer to the Father at the elevation of the Host, offering Christ, who once offered himself on the cross and now on the altar, for the whole Church, and asking the Father to look on the wounds of his Son's flesh and have mercy on us. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-and-mechtilde-spiritual-communion",
    title: "Spiritual Communion at Mass (Saint Gertrude and Saint Mechtilde)",
    leaves: [41, 42],
    body: [
      "O thou Stream from the Life-giving Fountain, thou fragrance and sweetness of divine delight, I prostrate myself in my indigence and my misery in presence of thine overflowing fulness. I set before thee my sorrow and my tears, that, by reason of my exceeding unworthiness, my soul must go away fasting from thine uncloying banquet. And now, O thou who hast formed my substance and reformed it when fallen and decayed, I beseech thee so to prepare me by thine all-powerful wisdom, and by the tender compassionate love of thy Heart, that I may worthily receive thee into my soul, and that thou mayest work and perfect in me without impediment all that thou hast from eternity decreed concerning me, according to the good pleasure of thy divine will. Amen.",
    ],
    prayerType: "act",
    category: "eucharistic",
    occasions: ["mass", "spiritual-communion"],
    summary: `The act of spiritual communion the book sets for those who hear Mass without receiving the Sacrament, "saying with St Gertrude and with St. Mechtilde": it grieves that the soul must go away fasting from the heavenly banquet, and asks Christ to prepare it to receive him and to work in it all he has decreed. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-at-the-postcommunion",
    title: "Prayer at the Postcommunion (Saint Gertrude)",
    leaves: [42, 43],
    body: [
      "Behold, O Heavenly Father, our holy Mother the Church has sent up before thee from thine altar that Victim of transcendent worth whom thou didst send to be immolated for us. Vouchsafe, therefore, to accept it with that ineffable love with which thou didst receive thy Son when he came back from this our far country into thy kingdom, and set forth before thee all the fruit of his sacred Humanity and the glorious wounds of his Flesh. O most compassionate Father, let not his scars depart from before thine eyes for ever, that thou mayest be perpetually reminded what great and superabounding satisfaction he hath made thee for our sins. Wherefore I beseech thee, in the virtue and efficacy of this unbloody oblation, have mercy on me, and on all sinners, and on all the faithful living and departed; grant unto them grace and mercy, remission of sins and everlasting life. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "after-communion", "all-souls"],
    summary: `A prayer for the Postcommunion, asking the Father to receive the Victim offered by the Church as he received his Son returning from "this our far country" at the Ascension, never to let the scars of his wounds pass from his sight, and to have mercy on all sinners and on the faithful living and departed. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-act-of-adoration-of-the-blessed-sacrament",
    title: "Act of Adoration of the Most Holy Sacrament (Saint Gertrude)",
    leaves: [44, 45, 46],
    body: [
      "Hail, most glorious Body and most precious Blood of my Lord Jesus Christ, here truly present beneath these sacramental species; I adore thee with all that devotion and awe wherewith the nine choirs of angels worship and adore thee. I prostrate myself before thee in the spirit of humility, believing and professing that thou, my Lord and my God, are herein most truly contained.",
      "Hail, most glorious Body of Jesus Christ my Saviour, true Victim immolated upon the cross, I adore thee in union with that adoration with which thy Humanity adored thy Godhead, and I give thee thanks with all the love of all thy creatures, that thou dost deign to remain hidden in this tabernacle for our salvation.",
      "Hail, compassionate Jesus, Word of the Father, Brightness of his glory, Ocean of pity, Salvation of the world, most august and sacred Victim. Hail, Jesus Christ, Splendour of the Father, Prince of Peace, Gate of Heaven, True Bread, Son of the Virgin, Shrine of the Godhead.",
      "I most firmly believe that thou, my God, art here present, and that thou art looking out upon me from behind the veil of the sacrament, and dost behold all the most secret recesses of my heart. I believe that under this species of bread are contained not only thy Flesh and thy Blood, but also thy Divinity and thy Humanity. And although this mystery surpasses my understanding, I nevertheless believe it so firmly that I am ready to give my life and my blood in defence of its truth.",
      "I fall down before thee with most profound reverence, O most Holy Sacrament, and with Angels and Archangels, with Thrones and Dominations, with Cherubim and Seraphim, and with all the glorious array of the heavenly host, I sing to thy glory, saying: Blessed a thousand, yea, ten thousand fold, be the most Holy Sacrament of the Altar!",
      "O thou most intimate and tender Love of the Father's Heart, I give thee thanks, in union with the ineffable mutual thanksgiving and gratitude of the three adorable Persons of the glorious and most worshipful Trinity, that thou hast condescended to institute this priceless Sacrament, by which heaven and earth are made one, and both are unceasingly filled with the infinite treasures of thy grace.",
      "I glorify and magnify thy wise and tender almightiness; I praise and adore thy almighty and gentle wisdom; I bless and praise thine almighty and most wise and gentle love, O Christ Jesus, for that thou hast condescended to devise and hast been strong to institute this ineffably magnificent Sacrament to be the strength and the succour of our salvation.",
      "O Christ Jesus, thou faithful and only Trust of my soul, I praise thee, I love thee, I worship and adore thee; and I humbly implore thee, that as thou didst offer thyself once upon the cross for the sin of the whole world, so thou wouldest now deign to offer thyself to God the Father for my exceeding sins.",
      "O Christ Jesus, my sweetest and only Love, look with the eyes of thy compassionate mercy on me, a most miserable sinner, here prostrate before thee and imploring with my whole heart the forgiveness of my sins.",
      "O thou princely Flower from the Root of Jesse, by the unutterable love of thy most sweet heart have mercy on me, and receive me into thy favour, for the glory of thy Name.",
      "O most loving Father, I offer to thee this thy beloved Son as a holocaust of unceasing praise, and as a perpetual sacrifice of propitiation for all our sins. Look, I beseech thee, on the face of thy Christ, and remember that most abundant satisfaction which he made to thee for our sins on the cross, and have mercy on us. Amen.",
    ],
    prayerType: "act",
    category: "eucharistic",
    occasions: ["adoration", "visit-to-the-blessed-sacrament", "benediction", "corpus-christi"],
    summary: `A long act of adoration before the Blessed Sacrament, which closes the book's devotions for Mass: greetings of Christ's Body and Blood truly present under the sacramental species, a profession of faith in the Real Presence, thanks to the Trinity for the institution of the Sacrament, prayers for mercy, and the offering of the Son to the Father as a perpetual sacrifice of propitiation. ${PRECES_NOTE}`,
  }),

  // ── Preces Gertrudianae, Part III: praise of the Most Holy Trinity ─────────
  preces({
    slug: "gertrude-hymn-of-praise-to-god",
    title: "Hymn of Praise to God (Saint Gertrude)",
    leaves: [55, 56, 57],
    body: [
      "O height inaccessible of wondrous power! O unfathomable depth of hidden wisdom! O boundless breadth of much-desired love! None but thyself can worthily praise thee, for thou alone knowest thine infinite magnificence, and thou knowest how thou oughtest to be praised. Wherefore, O Lord my God, may thine eternal Godhead, thy uncircumscribed Majesty, and thine infinite goodness, praise thee for me. O Lord my God, may thy loftiest wisdom, thy widest and most ample mercy, and thy most profound justice, praise thee for me. May thy greatness without limits, thy exquisite and penetrating sweetness, and thy most compassionate kindness, praise thee for me.",
      "May all the names, all the titles, all the emblems, which can be said of thee or conceived of thee, bless thee, exult in thee, and magnify thee for me, and give thee thanks for all good things which thou hast ever bestowed, or shalt hereafter bestow, on me or on any one of thy creatures.",
      "May the most adorable Humanity of Jesus Christ praise thee and exult in thee for me, O Lord my God. May his most holy life and conversation on earth, his most divine virtue and graces, his most precious Blood and tears, his cruel wounds and bruises, his most bitter passion and death, supply all the defects of my service, and worthily glorify thee.",
      "May the most serene Queen of heaven, the most chaste Virgin Mary, magnify and extol thee, O God my Creator; and together with her the ten thousand times ten thousand companies of blessed spirits, and the countless host of thy saints; may they sing praises to thee for me for ever.",
      "May our most holy Mother the Church sing to thee and exult in thee for me; may the seven most hallowed Sacraments praise thee; may all the reverent ceremonies and rites of thy Church honour thee; may all her psalms and prayers praise thee, all her virtues and her holiness, all her sorrow and her love, all her longing and her desire wherewith she sighs unto thee in this valley of tears.",
      "May all the gratuitous gifts of grace which thou hast ever conferred on me give thee thanks and praise; may all my powers of body and soul, my nerves and veins, my bones and my flesh, all my desire and all my groaning, my understanding, my memory and my will, my inmost heart with its wondrous beatings and throbs; may all unite to shout for joy to thee. I offer and resign to thee all these, beseeching thee that thou wouldest make me show forth thy praise and glory in time and in eternity. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["praise", "thanksgiving", "daily"],
    summary: `A hymn of praise in prose: since none but God can praise him worthily, his own attributes, then the Humanity of Christ, the Blessed Virgin, the angels and saints, the Church with her sacraments and rites, and at last every power of body and soul of the one who prays, are bidden to praise him on the speaker's behalf. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "mechtilde-three-acts-of-praise-of-the-trinity",
    title: "Three Acts of Praise of the Blessed Trinity (Saint Mechtilde)",
    leaves: [57],
    body: [
      "I venerate and glorify thee, O most blessed Trinity, in union with that ineffable glory with which God the Father in his omnipotence honours the Son and the Holy Ghost for ever.",
      "I magnify and bless thee, O most blessed Trinity, in union with that most reverent glory with which God the Son in his unsearchable wisdom glorifies the Father and the Holy Ghost for ever.",
      "I adore and extol thee, O most blessed Trinity, in union with that most adequate and befitting glory with which the Holy Ghost in his unchangeable goodness extols the Father and the Son for ever. Amen.",
    ],
    prayerType: "general",
    category: "trinitarian",
    occasions: ["trinity-sunday", "praise", "daily"],
    relatedSaints: [],
    summary: `Three short acts glorifying the Blessed Trinity in union with the glory each divine Person gives the other two: the Father in his omnipotence, the Son in his unsearchable wisdom, the Holy Ghost in his unchangeable goodness. The book calls them "three incomparable acts of praise" taught by Our Lord to Saint Mechtilde. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-efficacious-act-of-praise",
    title: "An Efficacious Act of Praise (Saint Gertrude)",
    leaves: [58],
    body: [
      "O most compassionate Jesus, may all the virtue and efficacy of thy Divinity praise thee for me. May all the tender loving-kindness of thy Humanity satisfy to thee for me. May all the kingly splendour and majesty of the Trinity glorify, magnify, and honour thee in thyself for me, with that sublimest praise wherewith thou sufficest to thyself, and suppliest what is lacking to the praises of all thy creatures.",
    ],
    prayerType: "act",
    category: "devotional",
    occasions: ["praise", "daily"],
    summary: `A short act of praise to Christ that asks his own Divinity to praise him, his Humanity to make satisfaction, and the majesty of the Trinity to honour him, with the praise by which God suffices to himself and makes up what is lacking in the praise of every creature. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-act-of-congratulation-to-god",
    title: "An Act of Congratulation to God (Saint Gertrude)",
    leaves: [59, 60],
    body: [
      "O most glorious God, I, the least of thy servants, congratulate thee, and rejoice with my whole heart that thou art and abidest unchangeably such and so great a God as thou art in thy Godhead and Essence, and shalt be evermore. I congratulate thee and rejoice with thee in thine infinite power and majesty. I rejoice and give thee thanks for thy great glory and thine inexpressible excellency. I rejoice and exult with my whole heart that all things are subject to thy sway, and that there is none that can resist thy will. And to express to thee my congratulations and my gratitude that thou art so great and so ineffable a God, I offer thee, in union with the sweetest Heart of Jesus and in my own name and that of all thy creatures, thy divine and infinite Essence with all the perfections, attributes, and qualities contained therein, in such manner and with such love as thou hast enabled us through thy love in the Holy Ghost. I desire and long that all creatures in heaven and in earth may acknowledge thee and love thee, and rejoice in thine infinite glory and blessedness; and I place them all before thee in spirit, and subject them to thee, and congratulate thee in their name. And since this is far short of showing forth thy praise, I beseech thee that thou wouldest vouchsafe to supply for thine own sake my lack of service, and that of all creatures, in loving thee and rejoicing in thee. And I offer to thee this splendour and fragrance of love and congratulation, together with all the glory, praise, and congratulation which the blessed spirits and souls of the just render thee with one consent, in thanksgiving for all the glory and blessedness which thou dost enjoy for evermore. Amen.",
    ],
    prayerType: "act",
    category: "general",
    occasions: ["praise", "thanksgiving"],
    summary: `An act of rejoicing with God simply because he is who he is: the soul congratulates him on his unchanging being, power, glory and sovereignty, offers him his own infinite Essence in union with the Heart of Jesus, and asks that all creatures in heaven and earth may know, love and rejoice in him. The book calls it most pleasing to God. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-sublime-act-of-thanksgiving",
    title: "Sublime Act of Thanksgiving (Saint Gertrude)",
    leaves: [60, 61],
    body: [
      "Blessed be thy goodness, O my God, and blessed be thy compassion, O thou one and true Godhead, thou one and holy Trinity, thou one and supreme God, for all the benefits and loving-kindnesses with which thy profuse and loving compassion has surrounded me, undeserving as I am. For all these I adore thee, I praise and bless thee, O my most tender Lord and God, in union with that supernal praise with which thou, O glorious Trinity, art thine own sufficient praise, which pours down from thee upon the blessed Humanity of our Lord Jesus Christ, upon his glorious Mother, and upon all holy angels and saints; and from them flows back again into its source in the abysses of thy Divinity. I give thee thanks for the love with which thou hast created and redeemed me, sanctified me, called me, preserved me, and endowed me with all manner of good things. And since praise is not seemly in the mouth of a sinner, I beseech thee, O sweetest Jesus, by that prevailing love wherewith thou sittest at the right hand of the Father, to pay for me to my God eternal, infinite, unfaltering, unceasing praises, such as thou alone canst pay, and as thou knowest to be befitting his most dread glory and the honour of his Majesty, for all the good which has ever flowed forth upon me from the inexhaustible abyss of his Godhead. Break forth, therefore, O beloved Jesus, into such thanksgivings as thou alone canst utter; O my Lord, great and wonderful exceedingly, praise the Godhead in thyself, in me and for me, with all the might of thy Divinity, and with all the love of thy Humanity, in the name and on behalf of all the universe thy hands have made. Amen.",
    ],
    prayerType: "act",
    category: "trinitarian",
    occasions: ["thanksgiving", "trinity-sunday"],
    summary: `A thanksgiving to the Blessed Trinity for creation, redemption and every grace, made in union with the praise the Trinity gives itself; since praise is unseemly in a sinner's mouth, Jesus is asked to render to God the thanks that he alone can give. The book takes it "from the devotions of St. Gertrude". ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-acknowledgment-of-the-benefits-of-god",
    title: "Acknowledgment of the Benefits of God (Saint Gertrude)",
    leaves: [62, 63],
    body: [
      "I give thee thanks, O holy Father, with all my strength, through him who sitteth at thy right hand, for all the gifts I have ever received from thy munificent bounty; and I acknowledge that no power could have bestowed them on me but thine, who art all-powerful, and upholdest all creation.",
      "I give thee thanks, most kind and gentle Jesus, and I confess, and will confess to my latest breath, that thou hast most wisely and well provided for me in body and in soul, in all things prosperous or adverse; and I acknowledge that no wisdom could thus embrace all my whole life but thy increated wisdom alone, O my most tender God, which reacheth from end to end mightily, and ordereth all things sweetly.",
      "I give thee thanks, O good and quickening Spirit, the Comforter, through him who was by thy cooperation made flesh in the Virgin's womb, that thou dost in all things so sweetly anticipate me, unworthy as I am, with the blessings of thy gratuitous bounty; and I acknowledge that no goodness could thus diffuse itself but thy ineffable goodness, in which all good things are contained, from which they proceed, and together with which they are received. And as thou hast hitherto and always provided for me, so I confidently hope and rely that thou wilt provide for me to the end through thy divine goodness, to which I most devoutly commend myself. Amen.",
    ],
    prayerType: "act",
    category: "trinitarian",
    occasions: ["thanksgiving", "trust", "trinity-sunday"],
    summary: `A threefold thanksgiving to the Blessed Trinity, acknowledging every gift as the work of the Father's power, every providence as the work of the Son's wisdom (in words from Wisdom 8:1), and every blessing as the work of the Holy Ghost's goodness, and closing with an act of trust in God's providence to the end. The book connects it with graces Saint Gertrude received while saying it. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-profession-of-faith",
    title: "Profession of Faith (Saint Gertrude)",
    leaves: [63, 64],
    body: [
      "O my God, thou ancient and absolute truth, I (N.) believe with my heart, confess with my mouth, and profess by my actions, that I most firmly believe all and every article of faith which the holy Roman Church proposes to us to be believed, and that I will believe them to the end of my life. And although I can in no wise understand how the truths which the faith delivers to us are possible, nevertheless I bring my understanding into captivity to the obedience of Christ, I revere these most sacred mysteries with profound submission, and I beseech thee to render them availing to my salvation. And even as I now profess this faith, so I vow, promise, and swear, in presence of all the holy angels and saints, and above all in thy presence, O most holy Trinity, that I desire to live and die in the same. So help me God and these his holy Gospels. In the beginning was the Word, and the Word was with God, and the Word was God.",
    ],
    prayerType: "act",
    category: "theological-virtue",
    occasions: ["daily", "conversion", "trinity-sunday"],
    summary: `A solemn act of faith in every article the Church proposes, submitting the understanding "into captivity to the obedience of Christ" (2 Corinthians 10:5) and sworn before the angels, the saints and the Holy Trinity in the form of an oath on the Gospels, ending with the first verse of Saint John's Gospel. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "mechtilde-commendation-of-faith-to-the-trinity",
    title: "Commendation of One's Faith to the Blessed Trinity (Saint Mechtilde)",
    leaves: [64],
    body: [
      "I commend this my faith to thine omnipotence, O eternal Father, beseeching thee that thou wouldest so strengthen me therein with thy divine strength, that I may never depart from it or waver in it.",
      "I commend it to thine unsearchable wisdom, O only-begotten Son, beseeching thee that thou wouldest so enlighten me with the light of thy knowledge, that I may never be led astray by the spirit of error.",
      "I commend it likewise to thy most compassionate goodness, O Holy Ghost the Comforter, beseeching thee that this my faith may so work in me by charity, that at the hour of my death it may be found perfect and entire.",
    ],
    prayerType: "act",
    category: "theological-virtue",
    occasions: ["temptation", "preparation-for-death", "trinity-sunday"],
    relatedSaints: [],
    summary: `A threefold commendation of one's faith: to the power of the Father, that it may never waver; to the wisdom of the Son, that error may never lead it astray; and to the goodness of the Holy Ghost, that it may work by charity and be found entire at death. The book sets it after its Profession of Faith and connects it with a revelation to Saint Mechtilde about temptations against the faith. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-act-of-trust-in-god",
    title: "Act of Trust in God (Saint Gertrude)",
    leaves: [64, 65, 66, 67],
    body: [
      "O God of my heart, my only hope and refuge, I, the poorest of thy creatures and infinitely unworthy of the least good at thy hands, do yet so confidently hope in thy tender kindness, that I have no manner of doubt that as thou knowest how to succour and aid me, so thou both canst and wilt be with me in all things. I know, indeed, O compassionate God, that if thou wert to deal with me as I have deserved, I could expect no grace at thy hand, but only manifold rebuke and punishment; but since I know that thy goodness is so exuberant that thou art wont to do good even to thy worst enemies, I most firmly believe and trust that thou wilt not forsake me in my distresses and miseries, but wilt provide for me with a care and generosity which I should vainly look for in my dearest friend.",
      "O most loving God, although my sins are so manifold and so grievous that they deserve a thousand hells, yet by reason of thine infinite goodness I so securely expect from thee remission of them all, provided only they grieve me, as in deed and in truth they do, that I could more easily doubt my own existence than the certainty of this remission. O infinite goodness, so tender is my confidence in thee, that even if I had sinned a thousand times more than I have, and knew that thine anger was fiercely kindled against me, yet, could I choose my own judge, I would choose none other than thee. In thee alone, and in none other than thee, would I trust, and I should more certainly hope for mercy at thy hand than from my best and dearest friend. For if I had sinned as often and as grievously against any one of my friends as I have against thee, I am most sure that I could not hope for pardon, even from the most tender and compassionate of mothers. Yea, had I been so rebellious and so unloving to my own mother as I have been to thee, she would have cast me off for ever. But thou, notwithstanding all the many and grievous insults I have heaped upon thee, and notwithstanding all my many and grievous negligences in thy service, dost still cherish and sustain me.",
      "And dost thou think, O most loving Father, that I have the smallest doubt that I shall attain to everlasting bliss? Do thou thyself forbid. For my hope of attaining that bliss rests not on my own merits, but on the faithful promise of thy Only-begotten, and on his most abundant and exuberant merits, which he has communicated and made over to his elect. And hence I abound with so great joy and consolation, because I seem already to possess that for which I so eagerly long. For thy Son, who has promised me salvation and his merits, which are its title and its price, is most faithful, nor can any word which has gone forth from his mouth be revoked or fail. Vouchsafe, O eternal Father, to increase in me this hope and trust which I give into thy merciful keeping, until I see thee in thy unfading eternity, and hope is lost in fruition. Amen.",
    ],
    prayerType: "act",
    category: "theological-virtue",
    occasions: ["trust", "times-of-trouble", "confession"],
    summary: `A long act of hope: confidence that God both can and will provide for the soul, that he will forgive every sin that is repented, so that one would choose him above any friend or mother as judge, and that eternal life is assured not by one's own merits but by the faithful promise and merits of Christ. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-act-of-love-of-god",
    title: "Act of Love of God (Saint Gertrude)",
    leaves: [67, 68, 69],
    body: [
      "O my God, most worthy object of my love, my supreme and infinite Good, I love thee and will love thee for ever and ever; I embrace thee with all the affections of my heart, with the strong embrace of love, for thou art my sweetest and much-desired Good, thou my perennial peace and sweetness, thou the sufficing portion of my soul. O thou most gentle, most ravishing, most beloved Lord, thou art the life of my soul, thou the jubilee of my heart, my God, my Love, the chosen One of all my vows. I love thee, O my sweetness, my joy, my delight; I love thee with all my soul and with all my strength, but, alas, not as I ought, not as I would. Would that I could love thee a thousandfold more; would that I could love thee with an infinite love! Pierce my heart, O sweetest God, with the arrow of thy love, and wound it with the languishing wound of thy dilection. Grant that I may love thee, O Lord; for without thee I cannot love thee. Oh, could I draw all created hearts, and contain them all in my heart, with all their affections and their love, how would I love thee then, O my fairest Love! Oh, wouldst thou give me but for one hour the glowing love of Seraphim, that I might be inflamed with the ardour of that impetuous love and enkindle it in every heart of men! And how great is my grief that thou, my tender Love, art not loved! Alas, how I mourn that thou, my sweet Love, art neglected and despised, and above all that thou art so cruelly offended and outraged! I condole with thee, O my God and my Love, on all the injuries and insults which are heaped on thee; and, were I able, I would most gladly make reparation to thee for all the outrages and wrongs done to thine honour; yea, for thy love I would gladly suffer to my dying hour all the pangs of holy desire which the heart of man hath suffered or shall suffer to the end of the world, if so I might offer thee a more worthy shelter within my soul, and make amends to thee for all the contempt and ignominy which thy peerless and excelling dignity sustains at the hands of ungrateful men. Amen.",
    ],
    prayerType: "act",
    category: "theological-virtue",
    occasions: ["act-of-love", "reparation", "daily"],
    summary: `An ardent act of charity: the soul declares its love for God as its supreme Good and the life of its heart, longs to love him a thousandfold more with the love of the Seraphim, grieves that he is not loved, and offers to suffer every pang of holy desire in reparation for the outrages done to him. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-aspirations-of-a-loving-soul",
    title: "Aspirations of a Loving Soul (Saint Gertrude)",
    leaves: [69, 70],
    body: [
      "O God of my heart, I love thee with all my heart, and I would that I could love thee a thousandfold more. Would that I could praise and love thee beyond every other of thy creatures; that I could give thee thanks and condole with thee, and practise all virtues in greatest perfection: most eagerly and gladly would I do so, according to the sovereign good pleasure of thy divine Heart.",
      "O my sweet Love, could I bring before thee, my Lord and my God, all men in whom thou hast vouchsafed to take thy delights, I would most gladly go barefoot throughout the world, and bring to thee in my arms all in whose hearts thou dost deign and delight to dwell, that I might thus satisfy the yearnings of thy infinite, thy divine love. And moreover, were it possible, I would divide my heart into as many fragments as there are men on the earth, that I might communicate to them all a holy resolve to serve and obey thee to the joy and content of thy divine Heart.",
      "O God, worthy of an infinite love, I have nothing which can be commensurate with thy dignity; but such is my desire towards thee, that if I had all that thou hast, I would gladly and thankfully resign all to thee.",
    ],
    prayerType: "act",
    category: "devotional",
    occasions: ["act-of-love", "missions"],
    summary: `Three aspirations of desire: to love and praise God beyond every creature, to go barefoot through the world bringing to him every soul in which he delights, and to give back to him all that he has, were it one's own. The book prefaces them with words of Our Lord to Saint Gertrude about the desire to love him more than any other creature. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-holocaust-offering-of-all-things-to-god",
    title: "The Holocaust: Offering of All Things to God (Saint Gertrude)",
    leaves: [70, 71, 72],
    body: [
      "O God of glorious majesty, Ruler of heaven and earth, I thy most unworthy creature offer thee, upon the most sacred altar of the sweetest Heart of Jesus Christ, myself with all that I am, all I have, all I can do, together with every good gift which thou hast ever bestowed on me from thine unfathomable, overflowing bounty. Moreover I offer thee all the treasures and the wealth of this world, all kingdoms, royalties, princedoms, honours, and dignities, with this intention: that were they all mine, I would distribute them to thy poor, and employ them in pious uses, that for very love of thee I might abide with joy in my present state of poverty.",
      "Further, I offer to thee on the same altar all the virtues, devotions, merits, and holiness of all the just; all the affliction, the crosses, the poverty, and want of all the poor, the afflicted, and the sick; all the pangs, the torments, the wounds, the bloodshedding, and the death of all martyrs; all the penance, the mortification, the fastings, vigils, and austerities of all confessors; all the love, the continence, the purity of all virgins: and I offer them all to thee with this intention: that were they all mine, I would do and suffer them all with most pure intention for thy glory.",
      "Thirdly, I offer thee all the whole fulness of grace and glory, transcending all human thought, wherewith thou hast so super-abundantly enriched thy saints in heaven, and especially the most glorious Virgin Mary, Mother of thy only-begotten Son. And above all these I offer thee the virtues and merits which thy Son manifested on earth, and all the gifts of grace, drawn from the infinitely exuberant treasury of the most Holy Trinity, which thou hast bestowed on his most sacred Humanity. For all which I desire, on behalf of all in heaven and earth, and under the earth; and through the most sacred and blessed Heart of thy Son, which gives forth its ravishing harmony at the touch of the Holy Ghost the Comforter, I sing unto thee praises and thanksgivings, and thus give thee back thine own.",
      "Lastly, I offer thee the priceless ineffable abundance of riches and perfections which thy divine Essence contains within itself, and which one divine Person communicates to another in sweetest, most transcending, and unimaginable manner. For all which I give thee thanks with all my heart and strength; I congratulate thee that thou dost contain within thyself and for thyself such inexhaustible treasures and delights, and dost perpetually and for ever communicate them to thine elect. Wherefore, O my King, live for ever, and enjoy evermore that bliss which is thyself, and vouchsafe to bestow on us wretched exiles in this valley of tears some crumbs from thy heavenly table. Amen.",
    ],
    prayerType: "consecration",
    category: "devotional",
    occasions: ["offering", "praise", "sacred-heart"],
    summary: `An offering laid on the altar of the Sacred Heart in four stages: oneself and all one has, with all the wealth of the world; the merits and sufferings of all the just, the poor, the martyrs, confessors and virgins; the glory of the saints, of Our Lady and of Christ's Humanity; and finally the riches of the divine Essence itself, in thanks to God for being what he is. The book recounts that Christ bore this offering of Saint Gertrude's before the Trinity. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-act-of-resignation-to-the-will-of-god",
    title: "Act of Resignation to the Will of God (Saint Gertrude)",
    leaves: [73],
    body: [
      "O most holy Father, I thy poor and vile creature entirely renounce my own will, and offer and resign myself to thy most holy will and pleasure; above all delights of this world, I wish and desire that thy most adorable, most placid will may be perfectly done in me, by me, in all that concerns me whether in body or in soul, in time and in eternity. And to this end I would readily submit all the members of my body to suffering of any kind and degree.",
      "O my God, wert thou to give me fullest choice of asking all I wish, and didst thou swear to me by thyself that thou wouldst grant my petition in all things, I would neither desire nor ask aught else than that thy most adorable will may be perfectly done in me and in every creature of thine, according to thy supreme and faultless good pleasure. Wherefore, in union with that resignation with which Jesus committed himself wholly to thy will in the garden of Olives, and in union with his affection and his intention, I say from his heart and in his words: Not my will, but thine be done, O most holy Father, in time and in eternity. Amen.",
    ],
    prayerType: "act",
    category: "devotional",
    occasions: ["trust", "suffering", "discernment"],
    summary: `An act of total surrender of one's own will to the Father's: given any wish at all, the soul would ask only that his will be done in it and in every creature, and it ends with Christ's own words in the garden of Olives, "Not my will, but thine be done". ${PRECES_NOTE}`,
  }),

  // ── Preces Gertrudianae, Parts IV and V: Our Lord and his Passion ──────────
  preces({
    slug: "mechtilde-salutation-of-the-heart-of-jesus",
    title: "Salutation of the Heart of Jesus (Saint Mechtilde)",
    leaves: [88, 89, 90, 91],
    body: [
      "Hail, sweetest Heart of Jesus, most tuneful instrument of the Holy Trinity. Hail, Heart of Jesus, flowing with honey, living stream of all goodness and all grace. Hail, loving Heart of Jesus, most noble treasury of the riches of God. I bless and salute thee a thousand and a thousand fold in the divine Goodness, that thou art the Fountain and Source whence all good and all mercy stream forth. O noble and precious Heart of Jesus Christ, I salute and adore thee, through the mutual complacency of the worshipful Trinity, in the abundance of all graces, wherewith thou dost evermore inundate all holy and devout souls, whom thou hast so often bedewed and inebriated with the torrent of thy divine pleasures.",
      "O Heart of Jesus, Heart most sweet; Heart of Jesus, Heart most precious; Heart of Jesus, Heart most worthy of love; O Heart flowing with sweetness, abounding with pity, overflowing with charity; in thy most hidden recesses I plunge my spirit, and in the great deep of thy mercy I bury all the burden of my iniquity and my negligence. To thee I offer all my labours and my toils, to thee I dedicate all my anguish and my misery, to thee I commend my life, and the end of my life. O Heart, sweet-smelling spikenard, frankincense most fragrant, most worthy and adequate sacrifice; offer thyself upon the golden altar of propitiation, to compensate for all the days of my life wherein I have brought no fruit to God.",
      "I bless thee, O most kingly Heart of Jesus, in that love wherewith the Holy Ghost formed thee of the most chaste blood of the Virgin Mary. I glorify thee, O sweetest Heart of Jesus, in that love wherewith the Holy Trinity adorned thee with all heavenly gifts. I magnify thee, O gentlest Heart of Jesus, in that love wherewith thou didst glow for all the human race. I adore thee, O most benign Heart of Jesus, in that love whereby thou wast broken upon the cross. I extol thee, O Heart of Jesus, most true and faithful, in that love wherewith thou didst will to be thrust through with the lance, and to shed forth Blood and Water.",
      "Wherefore, O transcendently glorious Trinity, I praise thee, I glorify and bless thee, through that surpassingly blessed Heart, that thou hast willed and desired to bestow on it such manifold gifts and such an abundance of grace: and with all possible love and reverence I offer to thy divine Majesty that Heart, so ravishing in sweetness, and so supremely and alone worthy, through the fulness of divine complacency and the ineffable perfection of manifold bliss, with which thou hast filled it for ever; and I beseech thee, that thou wouldst vouchsafe for his sake to pardon whatever I have done that is wrong, and to supply and perfect whatever I have omitted or done negligently. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["sacred-heart", "first-friday", "june"],
    relatedSaints: [],
    summary: `A salutation of the Sacred Heart of Jesus as the instrument, treasury and fountain of the Trinity's goodness: the soul buries its sins in the depths of that Heart, blesses it for each mystery of its love from the Incarnation to the lance, and offers it to the Trinity in reparation for all its faults. The book places it under a revelation to Saint Mechtilde. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-the-victim-of-sin",
    title: "The Victim of Sin: Offering of Christ Crucified to the Father (Saint Gertrude)",
    leaves: [105, 106, 107, 108],
    body: [
      "Look down, O pitiful Father, from the throne of thy Majesty and the lofty habitation of thy heavens, and behold thy beloved Son hanging so piteously and so ignominiously on the cross, his sacred Body all stretched, and racked, and torn with cruel wounds. Look down upon that spotless Lamb, who opened not his mouth when in the jaws of the wolves, to speak one word of deprecation or complaint. See thy most beloved Son, thy sweet Jesus, shedding his Blood with such profuse liberality for the sin of his brethren. Behold that sacred Head, before which the Powers of heaven bow in reverent awe, now itself bowed in dereliction and in anguish. See that Face, fairer than the sons of men, defiled with spittings, seamed with scars, besmeared with blood, and marred with livid bruises. Behold his eyes swimming in tears, his gracious mouth distorted, his sunken pallid cheeks, his hair plucked off, his arms so painfully stretched, his bones out of joint, his breast torn with wounds, his skin all scarred with gashes, his weak and trembling knees, his hands and feet dug through with cruel nails, his pierced side, his heart laid open, and all his limbs swollen with scourging and with blows. Remember, O most compassionate Father, who it is that suffers; and remember in thy mercy for whom he suffers. Is not this thy well-beloved Son, whom thou hast begotten from everlasting, and cherished in thine inmost heart? Is not this that most spotless Lamb who, obedient to thee even unto death, hath offered himself a sacrifice and a victim for our sins? Suffer thyself, then, to be touched with that great sight which thine only-begotten Son hath set before thee upon the cross, and with the satisfaction he hath made for our sins. Remember all his groanings, remember all the tears he shed upon the cross, while he prayed for those who had crucified him, saying: Father, forgive them! To this end I set forth before thee and offer thee, for my innumerable sins, offences, and negligences, this thy Son, who is made unto me justice, and sanctification, and redemption. Behold, O most holy Father, I set before thee thy most humble Son, who has made most abundant atonement to thee for all my sins of pride. I set forth before thee and offer thee this thy most meek and gentle Son, who has made atonement to thee for all my sins of anger. I offer thee thy most loving Son, who has fully satisfied for all my sins of hatred. His most gracious liberality has paid whatever debt I have contracted through my avarice. His most holy works have made amends for my sloth. His most perfect abstinence has satisfied for my gluttony. The purity of his most holy life has blotted out whatever sins I have committed by evil thoughts, or words, or deeds. His entire and finished obedience, wherein he was obedient unto thee even unto death, has effaced my disobedience. Lastly, let his universal and absolute perfection plead for my utter imperfection and lack of all virtues. This is my treasure, O most compassionate Father, in which I put my trust; this is the price wherewith I pay thee all my debts. I beseech thee, therefore, by the virtue of all the prayers which thy Son poured out before thee on behalf of sinners, that thou wouldst deign to render this my oblation valid, acceptable, and availing; and by the most sinless Humanity of the same Jesus Christ thy Son to look on me as pure and cleansed from all sin, and endowed and adorned by his glorious Divinity with all those virtues wherewith that same Divinity caused his most holy Humanity to blossom and to bear fruit. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["passion", "good-friday", "lent", "penance"],
    summary: `A prayer in which, as the book's own heading puts it, Our Lord hanging on the cross is offered to God the Father: the Father is asked to look on every wound of his Son, to remember who suffers and for whom, and to accept Christ's humility, meekness, love, liberality, works, abstinence, purity and obedience as satisfaction for the sins opposed to each. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-shorter-offering-of-the-life-and-passion",
    title: "A Shorter Offering of the Life and Passion of Christ (Saint Gertrude)",
    leaves: [108, 109],
    body: [
      "O most loving Father, in atonement and satisfaction for all my sins, I offer thee all the whole Passion of thy most beloved Son, from the plaintive wail he uttered when laid upon straw in the manger, through all the helplessness of his infancy, the privations of his boyhood, the adversities of his youth, the sufferings of his manhood, until that hour when he bowed his Head upon the cross with a loud cry, and gave up the ghost. And, in atonement and satisfaction for all my negligences, I offer thee, O most loving Father, all the whole most holy life and conversation of thy Son, most perfect in its every thought, and word, and action, from the hour when he came down from his lofty throne to the Virgin's womb, and thence came forth into our dreary wilderness, to the hour when he presented to thy Fatherly regard the glory of his conquering Flesh. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["passion", "penance", "offering"],
    summary: `A brief offering to the Father of the whole Passion of Christ, from his first cry in the manger to his death on the cross, in satisfaction for one's sins, and of his whole holy life, from the Incarnation to the Ascension, for one's negligences. The book says it was revealed to Saint Gertrude. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-to-jesus-suffering",
    title: "Prayer to Jesus Suffering (Saint Gertrude)",
    leaves: [109],
    body: [
      "O Lord Jesus Christ, Son of the living God, grant that I may aspire towards thee with all my heart, with yearning desire, with a soul ever athirst for thee; that I may breathe in thee alone, who art all sweetness and all delight; and that my whole spirit and my inmost heart may pant for thee, their true blessedness. O most merciful Lord, engrave thy Wounds upon my heart with thy most precious Blood, that I may read in them all thy grief and all thy love; and may the memory of thy Wounds ever abide in the secret of my heart, to excite my most lively compassion and to enkindle my most glowing love. Grant also that all creatures may grow vile in my eyes, and be thou alone sweet to my heart. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["passion", "lent", "precious-blood"],
    summary: `A prayer to thirst for Christ alone and to have his Wounds engraved on the heart with his Precious Blood, so as to read in them his grief and his love. The book says the prayer was very familiar to Saint Gertrude, whose Herald of Divine Love tells how the wounds of Christ were impressed on her heart. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-to-jesus-hanging-on-the-cross",
    title: "Prayer to Jesus Hanging on the Cross, for the Hour of Death (Saint Gertrude)",
    leaves: [117],
    body: [
      "O my most dear and loving Lord Jesus Christ, by the unutterable love wherewith thou didst love the race of men, when thou, the King of Heaven, didst hang upon the cross, thy Body all marred with wounds, thy Heart pierced through, thy Senses confused, thy most beauteous Face so piteously sad, thy ruddy Wounds dripping blood, thine Arms stretched out and thy Feet dug through, thy most sacred Limbs all wrenched and out of joint, thy Mouth livid and thy Countenance pale, thy tearful Eyes dimmed with the shadow of death, thy Breast heaving with sighs, thy Head bowed, thy Side laid open, and thy Soul saturated with sorrows: by all these, and by the love which broke thy sweetest Heart when thy blessed Soul went forth from thy Body, have mercy on my soul, I beseech thee, in the hour of my going hence. Amen.",
    ],
    prayerType: "intercession",
    category: "devotional",
    occasions: ["passion", "good-friday", "preparation-for-death"],
    summary: `A prayer for mercy at the hour of death, pleading each of Christ's sufferings as he hung on the cross, and the love that broke his Heart when his Soul left his Body. ${PRECES_NOTE}`,
  }),

  // ── Preces Gertrudianae, Part VI: the Blessed Virgin Mary ──────────────────
  preces({
    slug: "gertrude-golden-salutation-of-the-blessed-virgin",
    title: "Golden Salutation of the Blessed Virgin (Saint Gertrude)",
    leaves: [134],
    body: [
      "Hail, fair Lily of the effulgent and ever-peaceful Trinity. Hail, radiant Rose of heavenly fragrance, of whom the King of heaven willed to be born, and with thy milk to be fed; uphold and succour me, a miserable sinner, now and at the hour of my death. Amen.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["marian-devotion", "preparation-for-death", "daily"],
    summary: `A short salutation of Our Lady as the lily of the Holy Trinity and the rose of whom the King of heaven willed to be born, asking her help now and at the hour of death. The book introduces it with a revelation of the Blessed Virgin to Saint Gertrude about those who greet her in these words. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "mechtilde-heavenly-ave-maria",
    title: "Heavenly Ave Maria (Saint Mechtilde)",
    leaves: [135],
    body: [
      "Hail, thou peerless offspring of the omnipotence of the Father, of the wisdom of the Son, and of the enrapturing goodness of the Holy Ghost, Mary, who fillest heaven and earth with thy gentle light. Thou that art full of grace, the Lord is with thee, even the only-begotten Son of the Father, and the one only Son of the love of thy virgin heart, thy sweetest Spouse and thy Beloved. Blessed art thou amongst women, for thou hast annulled the curse of Eve, and hast brought back an everlasting blessing. And blessed is the Fruit of thy womb, Jesus Christ, the Lord and Creator of all things, who doth evermore bless and sanctify, enrich and quicken all things. Amen.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["marian-devotion", "rosary", "daily"],
    relatedSaints: [],
    summary: `An expanded Hail Mary in which each phrase of the angelic salutation is unfolded: Mary as the work of the Father's power, the Son's wisdom and the Holy Ghost's goodness, the Lord with her as her own Son, and her blessing that undoes the curse of Eve. The book says Our Lord himself put it in the mouth of Saint Mechtilde. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "mechtilde-golden-ave-maria",
    title: "Golden Ave Maria (Saint Mechtilde)",
    leaves: [135, 136],
    body: [
      "Hail, Mary, in union with that reverence wherewith God the Father greeted thee with Ave, and by his omnipotence delivered thee from every woe and Væ of sin. Hail, Mary, in union with that love wherewith the Son of God enlightened thee with his wisdom, and made thee a softly-shining star, lighting up heaven and earth. Hail, Mary, in union with that sweet unction of the Holy Ghost, wherewith he so pervaded thee and made thee so full of grace, that every one who through thee seeketh grace doth find it. Call to mind now that unspeakable operation wherewith the whole most Blessed Trinity wrought in thee, when human flesh taken from thy substance was so united to the Divine Nature that God was made man and man became God, and thy whole soul was suffused with a sweetness and a gladness which the heart of man cannot conceive. And therefore every creature with rapturous admiration doth acknowledge and confess that thou art blessed and incomparably exalted above all creatures in heaven or on earth, and blessed the Fruit of thy womb, even Jesus, who quickens, sanctifies, and blesses all things for ever. Amen.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["marian-devotion", "annunciation", "trinity-sunday"],
    relatedSaints: [],
    summary: `A threefold Hail Mary made in union with the Father who greeted Mary with "Ave" and kept her from every woe of sin (the "Væ" that the Ave reverses), the Son who made her a shining star, and the Holy Ghost who filled her with grace, recalling the Incarnation wrought in her by the whole Trinity. The book places it under a revelation to Saint Mechtilde. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-invitation-to-our-lady-at-the-hour-of-death",
    title: "Invitation to the Blessed Virgin to Be Present at Our Death (Saint Gertrude)",
    leaves: [144, 145],
    body: [
      "O most holy Virgin Mary, in union with that most faithful love wherewith thy Son commended thee from his cross to the blessed John, I commend to thee my soul and my body, my thoughts, my words and my actions, my life and my death, and more especially that one last moment of my life on which eternity hangs. And as thou didst invite thy Son to thine own blessed departure, so I invite thee now to mine; beseeching thee, by that love wherewith thou didst stand beneath the cross on which thy Son was dying, and by the bitter tears thou didst shed when thou sawest him bow in death his sacred Head, that thou be not absent from me then, but be there to succour me with a mother's tenderness; for without thee I cannot die in peace. Refuse not, O most tender Mother, this my request, which I make to thee with all the earnestness and devotion of my heart; for if I die without thee, I most justly fear lest I perish everlastingly. For how shall I, fearful and frail as I am, stand then amidst the manifold and most grievous assaults of my enemies, unless thou be near to succour me? How shall I appear in the dread day of judgment, unless thou be my companion and my advocate? How give an account of my innumerable, my enormous, my most exceeding sins, unless thou plead my cause with thy Son, and obtain for me forgiveness of them all? Incline thine ear to my supplication, O my blessed Mother; and by the love of thy Son be with me in my last moments, that by thy availing succour I may be rescued from that appalling peril, and with thee attain to everlasting gladness. Amen.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["preparation-for-death", "marian-devotion", "good-friday"],
    summary: `A commendation of soul, body, life and death to the Blessed Virgin, in union with Christ's entrusting of his Mother to Saint John from the cross, inviting her to be present at one's last moment as her Son was present at hers, and pleading her help against the assaults of the enemy and at the judgment. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-five-swords-of-sorrow",
    title: "The Five Swords of Sorrow of the Blessed Virgin (Saint Gertrude)",
    leaves: [146, 147, 148, 149, 150],
    body: [
      "The First Sword",
      "O most sorrowful Virgin Mary, I recall to thy mind now that sword of sorrow which pierced thy soul, when thy Beloved, thine only one, came to bid thee farewell, and to ask thy maternal blessing, ere he went forth to death. Remember, O Mother most afflicted, how thy heart was wrung when thy most tender and only Son, thy delight, so lovingly embraced thee for the last time, and with plaintive voice and tearful eyes bade thee farewell. Remember now your sighs and tears, when the hearts so joined together by the strongest ties of love were thus torn asunder, and pierced through with the keenest wound of sorrow. By that mournful going away of thy Son, and by all the bitter tears thou didst shed, I beseech thee, O Mary, be with me at the last, when all my friends turn away from my lifeless body, and protect me with thy maternal blessing from all the snares of the enemy. Amen.",
      "The Second Sword",
      "O most afflicted Virgin Mary, I recall to thy mind now that keen sword of sorrow which pierced thy soul, when the blessed John came to tell thee that thy Son had been betrayed by Judas, seized by the Jews, dragged before Annas and Caiphas, and there blasphemed and mocked, spit upon, buffeted, and overwhelmed with contumely and rude reproach. Remember, O thou most afflicted one, how these mournful tidings pierced thy heart. Oh, remember now the moans and wailing plaints with which thou didst fill the house, and how thou didst cry: O Jesus, my Son Jesus, who will grant me that I might die for thee, O Jesus, my Son, my Son! By that keenest sword of sorrow I beseech thee, O Mary, in my last hour, when my heart shall quake with anguish and the dread of death, do thou deign to cheer me with thy most holy presence, lest I sink in the abyss of despair. Amen.",
      "The Third Sword",
      "O most sad Virgin Mary, I recall to thy mind now that sword of sorrow which pierced thy heart, when thou didst behold thy Son led forth by Pilate, his sacred Body torn and bleeding, his Head crowned with thorns, defiled with spittings, so that there was no beauty in him, nor comeliness. Remember, O Mother most sad, how thy heart was torn when thou didst hear the Jews exclaim: Away with him, away with him! crucify him! Remember that keenest wound which was dealt upon thy heart when thou didst hear the sentence of an accursed death pronounced by Pilate. Remember all the compassion and the grief which wrung thy Mother's heart when thou didst see thy Son laden with his heavy cross, and led forth with direst ignominy to the hill of Calvary. Oh, who shall count thy sighs and tears, who shall tell the sorrows of thy most afflicted heart! I compassionate thee, O Mother most desolate, and I humbly beseech thee be with me in the dread hour of judgment, when I am overwhelmed with the accusations of the devil; and drive far from me then all mine enemies. Amen.",
      "The Fourth Sword",
      "O most desolate Virgin Mary, I recall to thy mind now that sword of sorrow which pierced through thy heart, when thou didst behold thy Son raised high upon his cross, and fastened thereunto with three nails. O most sorrowful Mother, how was it that thy soul was not utterly crushed down and wrenched from thy body? How could it be that thine eyes did not fail for tears? Oh, remember now the sadness which filled thy heart when thou didst behold him blasphemed, mocked with vinegar and gall in his thirst, reputed viler and treated more ruthlessly than the very robbers. Remember thine ineffable anguish when thou didst see him fail and sink beneath his impetuous love and sorrow, his lips grow pale, his limbs quiver, his eyes glazed and dim; until at length his heart broke with a mighty pang, and with a loud cry he gave up the ghost. By these thy surpassing sorrows, O Mother most desolate, and by all thy groanings and tears, I beseech thee, be with me with the same love when I draw my last breath, when my heart shall break in the agony of death; and deign to receive my soul into thy hands as it goes forth from the body.",
      "The Fifth Sword",
      "O Virgin Mary, Mother of dolours, I recall to thy mind now that sword of sorrow which pierced thy heart, when thou didst receive into thy bosom thy Son, taken down from the cross, and didst bedew his sacred Body with thy tears. Oh, what didst thou feel as thou didst gaze upon that Head pierced all around with thorns, that Side riven with the lance, those Hands and Feet dug through with the cruel nails, that beauteous Face marred with blows and defiled with spittings, and all that sacred Body torn with wounds, livid with stripes, and besmeared with blood. O most sorrowful Mother, how didst thou kiss that divine Face, and wash it with thy tears, and bewail the dishonour of thy Beloved. O Mother most forlorn, I pray thee, by all the sighs and groans wrung from thy heart, by all the sorrows and the wounds of thy soul, comfort mine in the hour when it goes forth from the body, wash it with thy tears, and receive it into thy maternal arms as thou didst receive the lifeless Body of thy Son, and lead it up to the joys of heaven. Amen.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["our-lady-of-sorrows", "good-friday", "preparation-for-death"],
    summary: `Five prayers recalling the swords of sorrow that pierced Our Lady's heart in the Passion: Christ's farewell before he went to his death, the news of his betrayal and trial, his condemnation by Pilate and the way to Calvary, the crucifixion and his death, and the taking of his body from the cross into her arms. Each asks her help in a different moment of one's own death and judgment. ${PRECES_NOTE}`,
  }),

  // ── Preces Gertrudianae, Part VII: the angels and the saints ───────────────
  preces({
    slug: "gertrude-salutation-of-saint-michael-the-archangel",
    title: "Salutation of Saint Michael the Archangel (Saint Gertrude)",
    leaves: [157, 158],
    body: [
      "Hail, most glorious prince, Michael the Archangel! Hail, most noble leader of the heavenly host! Hail, honour and glory of the hierarchies of heaven! O most august prince, under what obligation dost thou lie to thy Creator, who, without any merit of thine own, hath endowed thee with such excellent might and adorned thee with such peerless virtues? O thou renowned warrior, thou ornament of Paradise, thou lustrous gem of the court of heaven, thou art the seal of likeness to God, full of wisdom and consummate in beauty. Every precious stone is thine adornment, and all the working of thy finished comeliness is of gold, in the delights of the Paradise of our God. Thou hast been appointed prince and captain to receive the souls of the elect, and to lead them into the Paradise of rejoicing. I recall to thy mind now, O most blessed prince, these and all other graces wherewith the boundless liberality of God hath enriched thee above all orders of angels; beseeching thee, by that mutual love which binds thy heart to the Divine Heart of Jesus, that thou wouldst deign to receive my soul at the moment of my departure, and to render the Judge propitious to me through thy intercession. Amen.",
    ],
    prayerType: "intercession",
    category: "angelic",
    occasions: ["september-29", "preparation-for-death", "angels"],
    summary: `A salutation of Saint Michael as prince of the heavenly host and the one appointed to receive the souls of the elect and lead them into Paradise, borrowing the words Ezekiel 28 uses of the "seal of likeness", and asking him to receive one's soul at death and to make the Judge propitious. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-thanksgiving-to-the-guardian-angel",
    title: "Thanksgiving to the Guardian Angel (Saint Gertrude)",
    leaves: [158],
    body: [
      "O most holy angel of God, appointed by him to be my guardian, I give thee thanks for all the benefits which thou hast ever bestowed on me in body and in soul. I praise and glorify thee that thou dost condescend to assist me, miserable and worthless as I am, with such patient fidelity, and to defend me against all the assaults of my enemies. Blessed be the hour in which thou wast assigned me for my guardian, my defender, and my patron. Blessed be all thy love to me, and all thy care for me, wherewith thou dost unwearyingly further my salvation. In acknowledgment and return of all thy loving ministries to me from my youth I offer thee the infinitely precious and noble Heart of Jesus, full and overflowing with all blessedness: beseeching thee to forgive me for having so often striven against thy holy inspirations, and saddened thee my nearest, dearest friend; and firmly purposing to obey thee henceforward, and most faithfully to serve my God. Amen.",
    ],
    prayerType: "intercession",
    category: "angelic",
    occasions: ["guardian-angels", "thanksgiving", "daily"],
    summary: `A thanksgiving to one's guardian angel for his patient care of body and soul since childhood, offering him the Heart of Jesus in return, asking pardon for having resisted his inspirations, and promising to obey him henceforward. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-to-saint-benedict-for-the-hour-of-death",
    title: "Prayer to Saint Benedict for the Hour of Death (Saint Gertrude)",
    leaves: [159, 160],
    body: [
      "O most glorious patriarch, holy father Benedict, I recall to thy mind now that great and glorious grace bestowed on thee by our Lord, of breathing out thy last breath as thou stoodst praying, on which account thy lips now exhale a fragrance which ravishes all the saints with delight; beseeching thee to be with me in the hour of my death with loving fidelity, and to place thyself between me and my enemies round about, wheresoever thou seest them rage most furiously against me; so that, protected by thy presence, I may escape all their snares, and reach the joys of heaven safe and blessed for ever. Amen.",
    ],
    prayerType: "intercession",
    category: "saintly",
    occasions: ["march-21", "july-11", "preparation-for-death"],
    relatedSaints: ["saint-benedict-of-nursia", "saint-gertrude-the-great"],
    summary: `A prayer to Saint Benedict recalling the grace of his death, which he met standing in prayer, and asking him to stand between the dying soul and its enemies at the hour of death. The book introduces it with words of Saint Benedict to Saint Gertrude, a nun of his order. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "mechtilde-thanksgiving-for-the-tears-of-saint-mary-magdalen",
    title: "Thanksgiving for the Tears of Saint Mary Magdalen (Saint Mechtilde)",
    leaves: [160, 161],
    body: [
      "O most merciful Jesus, I give thee thanks for that work of piety which the blessed Mary Magdalen wrought on thee when she washed thy feet with her tears, and wiped them with the hair of her head, and kissed them and anointed them with fragrant ointment; whereby she obtained from thee such signal grace that thou didst pour into her heart and soul so great love of thee that she could love nothing apart from thee: beseeching thee that by her merits and intercessions thou wouldst vouchsafe to me tears of true repentance, and pour into my heart thy divine love. Amen.",
    ],
    prayerType: "intercession",
    category: "saintly",
    occasions: ["july-22", "penance", "confession"],
    relatedSaints: ["saint-mary-magdalene"],
    summary: `A thanksgiving to Jesus for the penitent woman's washing of his feet with her tears (Luke 7), identified here, as in the old Western tradition, with Mary Magdalen, asking through her merits and intercessions for tears of true repentance and for his divine love to be poured into one's heart. The book introduces it with words of Saint Mary Magdalen to Saint Mechtilde. ${PRECES_NOTE}`,
  }),

  // ── Preces Gertrudianae, Part VIII: for different necessities ──────────────
  preces({
    slug: "gertrude-prayer-for-the-whole-church",
    title: "Prayer for the Whole Church (Saint Gertrude)",
    leaves: [179],
    body: [
      "O most compassionate Jesus, I praise, bless, and glorify thee with the love of my whole heart for the creation of all those whom thou hast deigned to form after thine own image and likeness, and I render thee thanks for all the benefits that thou hast ever bestowed, or shalt ever hereafter bestow, on them. In union with thy most exceeding sorrow I pour out now my complaint before thee, with true sorrow and repentance for every manner in which they have ever hindered or frustrated thy grace; and I most devoutly pray for all men, that each in his appointed place may be made perfect in every good work, to thy everlasting praise and glory. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["for-the-church", "daily"],
    summary: `A prayer for all mankind, made with praise for their creation in God's image, thanks for every benefit given them, sorrow in union with Christ's for every resistance to his grace, and the petition that each may be made perfect in every good work in the place God has appointed. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-for-relations-and-friends",
    title: "Prayer for Relations and Friends (Saint Gertrude)",
    leaves: [181, 182],
    body: [
      "O most kind and gentle Jesus, I commend all those who have asked my unworthy prayers to thy divine knowledge and love, under the guidance of which thou didst come down to earth from the bosom of thy Father to save man. And in union with that love wherewith thou didst commend thy Spirit to thy Father, I commend them all to thy sacred Heart, and enclose them all therein; and I offer and set it forth before thee, in union with that love wherewith thou didst take it to thyself, a human heart, for the salvation of all the human race, and hast often given it as a token of thy special friendship to thy well-beloved friends; beseeching thee from its infinite treasures to take wherewith to bless those for whom I pray, or am bound to pray. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["friends", "families", "daily"],
    summary: `A prayer for all who have asked one's prayers, enclosing them in the Sacred Heart and asking Christ to bless them from its treasures. The book adds that Our Lord taught Saint Gertrude to pray in this way, and heads it "a very efficacious prayer for our relations and friends". ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-offering-of-the-passion-for-the-holy-souls",
    title: "Offering of the Passion of Christ for the Faithful Departed (Saint Gertrude)",
    leaves: [194, 195],
    body: [
      "Look down, O Father of compassion, from thy high and holy seat upon the hapless souls detained in purgatory. Look upon all the pains and torments wherewith they are so piteously chastised; regard now the piteous groans and tears which they pour forth unto thee; hear the prayers and the supplications wherewith they entreat thy mercy, and be merciful unto their sins. Remember, O most compassionate Father, all the sufferings which thy Son hath endured for them; remember his precious Blood, shed in such abundance for them; call to mind the most bitter death which he suffered for them, and have mercy on them. For all the sins they have ever committed against thee I offer thee the most holy life and conversation of thy most beloved Son; for all their negligences I offer thee his most fervent desires towards thee; for all their omissions I offer thee the great abundance of his merits; for their every insult and wrong to thee I offer thee the sweet submission with which he honoured thee. Finally, for all the chastisements which they have ever incurred I offer thee all the mortifications, fastings, watchings, the labours and afflictions, wounds and stripes, passion and death, which he endured in such spotless innocence and with such loving eagerness; beseeching thee now to suffer thy anger to be appeased towards them, and to lead them forth into everlasting joy. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["all-souls", "november", "funerals"],
    summary: `A prayer for the souls in purgatory asking the Father to look on their sufferings and remember those of his Son, and offering Christ's holy life, his desires, his merits, his submission and his whole Passion in satisfaction for their sins, negligences and omissions. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-prayer-to-the-faithful-departed",
    title: "Prayer to the Faithful Departed (Saint Gertrude)",
    leaves: [202, 203],
    body: [
      "O most afflicted and unrepining souls, may Jesus Christ have mercy upon you, who for you was crucified and died, and may he refresh you in your sufferings by the sprinkling of his precious Blood. I commend you to that exceeding love which drew down the Son of God from heaven, and constrained him to a most bitter death on earth, that in that amazing compassion wherewith he entered into and took upon himself all the afflictions of the afflicted, he may have compassion on you. And for your full solace and refreshment I offer you all that filial love which the same Jesus Christ felt towards the Father in his Divinity, and towards Mary in his Humanity.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["all-souls", "november", "cemetery-visit"],
    summary: `A prayer spoken to the holy souls themselves, asking that Christ refresh them with the sprinkling of his Precious Blood, commending them to the love that brought him to his death, and offering them for their relief the filial love he bore the Father and his Mother. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "prayer-in-a-burial-ground-hail-all-ye-faithful-souls",
    title: "Prayer in a Burial-Ground: Hail, All Ye Faithful Souls",
    leaves: [203],
    body: [
      "Hail, all ye faithful souls of Christ; may he give you rest, who is himself the one true Rest. May Jesus Christ, the Son of the living God, who for our salvation and for that of all mankind was born of the Immaculate Virgin, and redeemed you with his precious Blood, bless you, release you from your pain, raise you up in the day of judgment, and place you with his holy angels.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["all-souls", "cemetery-visit", "november"],
    relatedSaints: [],
    summary: `A greeting of the faithful departed to be said on passing through a burial-ground, a form of the old prayer "Avete, omnes animae fideles": it asks Christ, who redeemed them with his Blood, to give them rest, release them from their pain, raise them at the judgment and place them among his angels. The Preces Gertrudianae prints it among its prayers for the departed, without naming an author. ${PRECES_NOTE}`,
  }),

  // ── Preces Gertrudianae, Parts IX and X: penance and Holy Communion ────────
  preces({
    slug: "gertrude-act-of-true-contrition",
    title: "Act of True Contrition (Saint Gertrude)",
    leaves: [208, 209],
    body: [
      "O most gracious God, I most unworthy of thy creatures have offended thy Divine goodness in such manifold ways, of my own mere malice and perversity, that thou mightest justly abhor me, and pursue me as thy stubborn and most inveterate enemy. O Christ Jesus, I confess that I have dealt wickedly and have done exceeding evil in thy sight; but I grieve for my sins with so deep and lively sorrow, that I would rather endure any ill than ever sin against thee henceforward by even one mortal sin. Nor do I grieve because of the dread and exceeding punishment I have deserved, but because I have so heinously and so unjustly offended against thee, my loving, kind, and faithful God, who hast never done me the least ill or injustice, but hast bestowed on me all manner of good things. Pardon me, O most merciful Jesus, for the sake of that love wherewith thou didst pray to thy Father for thy murderers; for I profess my readiness to make a true and condign satisfaction to thee for every insult wherewith I have provoked thee by my sins. I do not ask thee to remit to me the pains I have deserved; but I am most ready to accept them as chastisements from thy fatherly hand, when and how and where it shall seem good to thee, and the glory of thy justice shall require. Wherefore I submit myself unto thee with the most profound humility and resignation, and I embrace with all my heart thy just judgment upon me, and gladly welcome whatever adversities and evils thou shalt lay upon me in time or in eternity. Amen.",
    ],
    prayerType: "act",
    category: "penitential",
    occasions: ["confession", "examination-of-conscience", "penance"],
    summary: `An act of perfect contrition: sorrow for sin not from fear of punishment but because it has offended a God who has never done anything but good, joined to a readiness to make satisfaction and to accept from his fatherly hand whatever chastisement his justice requires. ${PRECES_NOTE}`,
  }),
  preces({
    slug: "gertrude-preparation-for-holy-communion",
    title: "Preparation for Holy Communion (Saint Gertrude)",
    leaves: [222, 223, 224],
    body: [
      "O most sweet and loving Jesus, I the most unworthy of all thy creatures propose now to receive the most holy sacrament of thy Body and Blood, as the most effectual remedy for all my miseries of body and of soul; with most certain confidence and with most steadfast faith that I shall thus not only obtain the supply of all my need, but also most perfectly please thy supreme Majesty and all the inhabitants of heaven. But, O thou supreme and ineffable Majesty, before whose face the heavens are not clean and its strong pillars tremble, how shall I, a vile worm of the earth, a very sink of all most loathsome corruption and misery, dare to receive thee, who art the Fountain and Source of all purity, into my polluted heart! How shall I presume to receive thee into a heart all set around with briers and thorns, reeking with the foul vapours of carnal and worldly lusts? Wherefore, O thou most compassionate Lover of my soul, I blush exceedingly and am confounded before thee, and I quake with fear lest I should outrage thee by receiving thee into an abode so foul, so unworthy of thy Majesty. But, O most merciful Jesus, who hast said with thy gracious lips that they that are whole need not the physician, but they that are sick, who didst invite the blind and the lame, the poor and the needy, to thy supper; behold, as one of them, yea, as the poorest and most wretched of them all, I will draw near to the most sacred feast of thy Body and Blood, not in presumption, but with lowly and pious confidence. For the love of thee I bitterly grieve for all and every one of my sins and my negligences, whereby I have ever offended and grieved thy most tender lovingkindness and polluted my soul with such loathsome defilement. Oh, would that I could change the whole sea into blood, and that I could pour its mighty flood through my head and my heart, that thus that sink of unutterable abominations might be cleansed, which thou my last End hast chosen for thine habitation! O would that my heart could be torn from my body and purified in fiercest fire from all its dross, that thus it might offer thee an abode, not, alas, worthy of thee, but at least not so utterly unworthy. But why do I disquiet my soul within me, seeing that even if a thousand years were given me I could not prepare myself to receive thee befittingly; for of myself I have nothing whatever which could in any way avail towards so august and solemn a preparation as beseems thy adorable Majesty. Wherefore, O most loving Jesus, I cast myself in the dust before thee in the humility of my heart, and I beseech thy clemency to deign so to prepare me that I may partake of this heavenly banquet to thy glory and to the profit of all the whole world. I offer and abandon to thy tender pity all my substance, all that I am and have, earnestly desiring and beseeching thee that thou wouldst thyself vouchsafe to prepare within me all that is most pleasing to thy divine goodness. I offer and abandon to thee, O thou surpassingly sweet Lover of my soul, my whole heart, beseeching thee that thou wouldst wash it in that water of mighty efficacy which flowed from thy most holy Side, and adorn it for thine indwelling with the precious Blood of thy most sacred Heart, and fit it for thyself with the fragrant incense of thy divine love. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["before-communion", "mass"],
    summary: `A long preparation for receiving Holy Communion: the soul confesses its utter unworthiness to receive the all-holy God, takes courage from Christ's invitation of the sick, the poor and the lame to his supper, grieves for its sins, and abandons itself and its heart to him, asking to be washed with the water from his Side and adorned with the Blood of his Heart. ${PRECES_NOTE}`,
  }),

  // ── Revelations of St. Bridget (1862): her prayers ─────────────────────────
  revelations({
    slug: "fifteen-prayers-on-the-passion-ascribed-to-saint-bridget",
    title: "The Fifteen Prayers on the Passion Ascribed to Saint Bridget (the Fifteen O's)",
    leaves: [145, 146, 147, 148, 149, 150, 151, 152, 153, 154],
    body: [
      "I.",
      "O Jesus Christ, eternal sweetness of them that hope in thee, joy exceeding all joy and all desire, salvation, and love of sinners, who hast declared it to be thy delight to be with the children of men, made man for man in the end of time; remember all thy premeditation and interior grief, which thou didst endure in thy human body, at the approach of the time of thy most saving Passion, preordained in thy divine heart. Remember the sadness and the bitterness, which as thou thyself didst testify, thou didst feel in thy soul, when at the Last Supper with thy disciples thou didst give them thy Body and Blood, didst wash their feet, and sweetly consoling them, foretell thy imminent Passion. Remember all the fear, anguish, and grief, which thou didst endure in thy delicate body before the Passion of the Cross; when, after thy thrice-repeated prayer and bloody sweat, thou wast betrayed by thy disciple Judas, taken by a chosen people, accused by false witnesses, unjustly judged by three judges, condemned innocent in the chosen city, at Paschal time, in the bloom of youth, stripped of thy own clothing and clothed in the garments of another, buffeted, thy face and eyes veiled, smitten with blows, bound to the pillar, scourged, crowned with thorns, struck with a reed on the head, and torn with numberless other acts of violence. Give me, O Lord God, I beseech thee, before I die, in memory of these thy passions before the cross, a true contrition, true confession, worthy satisfaction and remission of all my sins. Amen.",
      "Our Father. Hail Mary.",
      "II.",
      "O Jesus, maker of the world, whom no measure by just bounds doth compass, who inclosest the earth in thy palm, remember the most bitter grief which thou didst endure, when the Jews first fastened thy most sacred hands to the cross with dull nails, and as thou wast not agreeable to their will, added pain to pain in thy wounds by perforating thy most delicate feet, and cruelly wrenched and distended thee the length and breadth of thy cross, so that the joints of thy limbs were loosened. I beseech thee by the memory of this most sacred and bitter pain on the cross to give me thy fear and love. Amen.",
      "Our Father. Hail Mary.",
      "III.",
      'O Jesus, heavenly physician, remember the languor, livor, and pain which thou didst suffer on the lofty scaffold of the cross, torn in all thy limbs, not one of which had remained in its right state, so that no pain was found like to thy pain; for from the sole of thy foot to the top of thy head, there was no soundness in thee. And yet, regardless of all pains, thou didst piously pray to thy Father for thy enemies, saying: "Father, forgive them, they know not what they do." By this mercy and in remembrance of that pain, grant that this memory of thy most bitter Passion be a full remission of all my sins. Amen.',
      "Our Father. Hail Mary.",
      "IV.",
      "O Jesus, true liberty of Angels, paradise of delights, remember the grief and horror which thou didst endure, when all thy enemies surrounded thee like fierce lions, and tortured thee by buffets, spitting upon thee, tearing and other unheard-of pains. By these pains and all the contumelious words and most severe torments, whereby, O Lord Jesus Christ, all thy enemies afflicted thee, I beseech thee to free me from all my enemies, visible and invisible, and grant me to reach the perfection of eternal salvation under the shadow of thy wings. Amen.",
      "Our Father. Hail Mary.",
      "V.",
      'O Jesus, mirror of eternal brightness, remember the grief which thou didst endure, when thou didst behold in the mirror of thy most serene Majesty the predestination of the elect to be saved by the merits of thy Passion, and the reprobation of the wicked, to be damned by their own demerits; and by the abyss of thy mercy, whereby thou didst then compassionate us lost and hopeless sinners, and which thou didst show the thief on the cross, saying, "This day thou shalt be with me in paradise," I beseech thee, O merciful Jesus, show mercy to me at the hour of my death. Amen.',
      "Our Father. Hail Mary.",
      "VI.",
      'O Jesus, amiable king, and most desirable friend, remember the sorrow thou hadst, when thou didst hang naked and wretched on the cross, and all thy friends and acquaintances stood over against thee, and thou didst find no comforter, except alone thy beloved Mother, most faithfully standing by thee in bitterness of soul, whom thou didst commend to thy disciple, saying, "Woman, behold thy son:" I beseech thee, merciful Jesus, by the sword of grief which then pierced thy soul, to have compassion on me in all my tribulations and afflictions, bodily and spiritual, and give me comfort in time of tribulation and at the hour of my death. Amen.',
      "Our Father. Hail Mary.",
      "VII.",
      'O Jesus, fountain of inexhaustible mercy, who from intense feeling didst exclaim on the cross, "I thirst," thirsting for the salvation of the human race; inflame, we beseech thee, the desires of our hearts to every perfect work, and entirely cool and extinguish in us the thirst of carnal concupiscence and the heat of worldly delight. Amen.',
      "Our Father. Hail Mary.",
      "VIII.",
      "O Jesus, sweetness of hearts and great sweetness of minds, by the bitterness of the vinegar and gall which thou didst taste for us, grant me at the hour of my death worthily to receive thy Body and Blood, for the remedy and consolation of my soul. Amen.",
      "Our Father. Hail Mary.",
      "IX.",
      'O Jesus, royal virtue and mental delight, remember the anguish and pain which thou didst endure, when, from the bitterness of death and the reproaches of the Jews, thou didst exclaim in a loud voice that thou wast forsaken by thy Father, saying, "My God, my God, why hast thou forsaken me?" By this anguish, I beseech thee not to forsake me in my anguish, O Lord our God. Amen.',
      "Our Father. Hail Mary.",
      "X.",
      "O Jesus, Alpha and Omega, ever virtue and life, remember that for us thou didst plunge thyself, from the top of thy head to the sole of thy feet, in the water of thy Passion. By the length and breadth of thy wounds, teach me to keep in true charity thy broad command, too much immersed in sin. Amen.",
      "Our Father. Hail Mary.",
      "XI.",
      "O Jesus, most profound abyss of mercy, I beseech thee by the depth of thy wounds, which pierced the marrow of thy bones and vitals, raise me from the depth of sins in which I am plunged, and hide me in the hollow of thy wounds, from the face of thy wrath, till thy anger pass away, O Lord. Amen.",
      "Our Father. Hail Mary.",
      "XII.",
      "O Jesus, mirror of truth, sign of unity, and bond of charity, remember the multitude of thy innumerable wounds wherewith thou wast wounded from the top of thy head to the sole of thy feet, and reddened with thy most sacred blood, which magnitude of pain thou didst endure on thy virginal flesh for us. O merciful Jesus, what more oughtest thou to do, and hast not done? Engrave, I beseech thee, O merciful Jesus, all thy wounds in my heart with thy most precious blood, that in them I may read thy sorrow and death, and in thanksgiving persevere duly to the end. Amen.",
      "Our Father. Hail Mary.",
      "XIII.",
      'O Jesus, most valiant Lion, immortal and unconquered King, remember the pain which thou didst endure, when all the powers of thy heart and body entirely failed thee, and inclining thy head, thou didst exclaim, "It is consummated." By that anguish and pain, remember me in the last consummation of my departure, when my soul shall be in anguish and my spirit troubled. Amen.',
      "Our Father. Hail Mary.",
      "XIV.",
      'O Jesus, only-begotten Son of the most high Father, splendor and figure of his substance, remember the commendation wherewith thou didst commend thy spirit to thy Father, saying, "Into thy hands, O Lord, I commend my spirit;" and then, with lacerated body and broken heart, with a loud cry, the bowels of thy mercy exposed, didst expire to redeem us. By this precious death, I beseech thee, O King of saints, comfort me to resist the devil, the world, flesh, and blood, that dead to the world, I may live to thee, and in the last hour of my departure receive thou my exiled, wandering spirit returning to thee. Amen.',
      "Our Father. Hail Mary.",
      "XV.",
      "O Jesus, true and fruitful vine, remember the overflowing and abundant effusion of blood, which thou didst pour forth in torrents, like wine pressed from the grape, when on the press of the cross thou didst tread alone; and thy side having been opened with a lance, thou didst pour forth to us blood and water, so that not the least drop remained in thee; and at last thou wast suspended on high like a bundle of myrrh, and thy delicate flesh fainted, and the moisture of thy members dried up, and the marrow of thy bones faded. By this most bitter Passion and the effusion of thy precious blood, O pious Jesus, I pray thee, receive my soul in the agony of my death. Amen.",
      "Our Father. Hail Mary.",
      "O sweet Jesus, wound my heart, that tears of penitence and love may be my food night and day, and bring me entirely to thee; that my heart may ever be habitable for thee, and my conversation pleasing and acceptable to thee; and the end of my life so praiseworthy, that after the close of this life, I may deserve to praise thee with all thy Saints forever.",
      "After five Our Fathers say the following prayer:",
      "O Lord Jesus Christ, Son of the living God, receive this prayer in that most exceeding love, wherewith thou didst bear all the wounds of thy most sacred body; and remember me thy servant, and to all sinners, and all the faithful, living and dead, give mercy, grace, remission, and eternal life. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["passion", "lent", "good-friday", "preparation-for-death"],
    summary: `Fifteen prayers each beginning "O Jesus", which recall in turn Christ's sufferings from the Last Supper to his death and the opening of his side, each followed by an Our Father and a Hail Mary, with two closing prayers. Known in the late Middle Ages as the "Fifteen O's", they are traditionally ascribed to Saint Bridget of Sweden, though the attribution is uncertain; this book prints them as her prayers on the Passion, without the promises that circulated with them elsewhere. ${REVELATIONS_NOTE}`,
  }),
  revelations({
    slug: "saint-bridget-prayer-to-mary-temple-of-solomon",
    title: "Prayer of Saint Bridget to Mary, the Temple of Solomon",
    leaves: [141, 142, 143],
    body: [
      "Blessed art thou, Mary, mother of God, temple of Solomon, whose walls were golden, whose roof resplendent, whose pavement was laid with most precious stones; whose whole structure was splendid, its whole interior redolent and delightful to gaze upon. In every way art thou like to the temple of Solomon, in which the true Solomon walked and sat, unto which he brought in the ark of glory and the candlestick for light. So art thou, Blessed Virgin, the temple of that Solomon who made peace between God and man; who reconciled the guilty, who gave life to the dead, and delivered the poor from the executioner. For thy body and soul were made the temple of the Deity, wherein was the roof of divine charity, under which the Son of God, going forth from the Father to thee, dwelt joyfully with thee. The pavement of the temple was thy well-ordered life and assiduous exercise of virtues; for no grace was wanting in thee, for all in thee was stable, all humble, all devout, all perfect. The walls of the temple were square, for thou art troubled by no opprobrium, puffed up by no honor, disquieted by no impatience, seeking naught but God's love and honor. The pictures of thy temple were a constant fire of the Holy Ghost, whereby thy soul was so exalted, that there was no virtue not more ample and perfect in thee than in any other creature. God walked in his temple, when he infused into thy frame the sweetness of his visitation. He rested when the deity was associated to the humanity. Blessed, therefore, art thou O most blessed Virgin, in whom the mighty God became a little child; the ancient Lord became a puny infant; the everlasting God and invisible Creator became a visible creature. Therefore, because thou art most compassionate and most powerful, O Lady, I beg thee to look on me and take pity on me. For thou art the mother of Solomon; not of him who was David's son, but of him who is the father of David, and the Lord of Solomon, who built that wonderful temple, which truly prefigured thee. For the son will hearken to the mother, and to such and so great a mother. Obtain, then, that the infant Solomon who slumbered in thee, watch with me, so that no sinful delight sting me, that the contrition of my sins be permanent, love of the world be dead within me, my patience persevering, my penance fruitful. For I have no power for me, except one word, and that is: \"Mary, take pity!\" for my temple is all the contrary of thine; it is darkened with vices, soiled with luxury, eaten by the worms of cupidity, unstable by pride, tottering from the vanity of worldliness.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["marian-devotion", "penance", "july-23"],
    summary: `Saint Bridget's prayer comparing the Blessed Virgin to Solomon's temple, its roof, pavement, square walls and pictures standing for her charity, her ordered life, her steadfastness and the fire of the Holy Ghost in her, and asking the Mother of the true Solomon to take pity on a soul whose own temple is darkened by vice. The book cites it from Book III, chapter 29 of her Revelations. ${REVELATIONS_NOTE}`,
  }),
  revelations({
    slug: "saint-bridget-prayer-blessed-art-thou-o-my-god-my-creator",
    title: "Prayer of Saint Bridget: Blessed Art Thou, O My God, My Creator and Redeemer",
    leaves: [143, 144],
    body: [
      "Blessed art thou, O my God, my Creator and Redeemer. Thou art the ransom by which we have been redeemed from captivity, by which we are directed to all salutary things, by which we are associated to the unity and trinity. If I blush for my own sloth, yet I rejoice, that thou who didst once die for our salvation, will die no more. For thou art truly he that was before the ages. Thou art he that has power of life and death. Thou alone art good and just. Thou alone art almighty and fearful. Blessed then be thou forever. But what shall I say of thee O blessed Mary, the whole salvation of the world? Thou art like pointing out suddenly to a friend grieving for it, a lost jewel, whereby his pain is alleviated, his joy increased, his whole mind rekindled with joy. So thou, most sweet mother, didst show to the world its God, whom men had lost, and didst bear him in time who was begotten before time, at whose birth earthly and heavenly things rejoiced. Therefore, O most sweet mother, I beg thee help me, lest the enemy rejoice over me, or prevail against me by his snares.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["praise", "marian-devotion", "temptation"],
    summary: `A prayer of Saint Bridget blessing Christ as Creator and Redeemer, who died once and dies no more, and then the Blessed Virgin, who showed the world its lost God as one shows a grieving friend a lost jewel, asking her help against the snares of the enemy. The book cites it from Book IV, chapter 75 of her Revelations. ${REVELATIONS_NOTE}`,
  }),
  revelations({
    slug: "saint-bridget-prayer-for-a-chaste-body-and-a-humble-mind",
    title: "Prayer of Saint Bridget for a Chaste Body and a Humble Mind",
    leaves: [140],
    body: [
      "Almighty, everlasting God, who didst vouchsafe to be born for us of a most chaste virgin, make us, we beseech thee, serve thee with a chaste body, and please thee by an humble mind.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["chastity", "humility", "christmas"],
    summary: `The first of the book's "Select Prayers of St. Bridget": a single sentence addressed to God, who vouchsafed to be born for us of a most chaste virgin, asking that we may serve him with a chaste body and please him by a humble mind. ${REVELATIONS_NOTE}`,
  }),
  revelations({
    slug: "saint-bridget-prayer-to-the-most-clement-virgin-mary",
    title: "Prayer of Saint Bridget to the Most Clement Virgin Mary",
    leaves: [140],
    body: [
      "We pray thee, O most clement Virgin Mary, queen of the world and of angels, to obtain relief for those whom the fire of purgatory tries, pardon for sinners, perseverance in good to the just, and also defend us weak brethren from menacing danger. Through, &c.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["all-souls", "conversion", "marian-devotion"],
    summary: `A short prayer, among the book's "Select Prayers of St. Bridget", asking Our Lady as queen of the world and of the angels to obtain relief for the souls in purgatory, pardon for sinners and perseverance for the just, and to defend the weak from danger. It ends with the abbreviated conclusion "Through, &c." as printed. ${REVELATIONS_NOTE}`,
  }),
  revelations({
    slug: "saint-bridget-prayer-for-purity-and-the-resurrection-of-the-body",
    title: "Prayer of Saint Bridget for Purity and the Resurrection of the Body",
    leaves: [141],
    body: [
      "O Lord, holy Father, who didst preserve intact in the tomb, the body which thou didst receive from the Virgin Mary for thy Son, and didst raise it incorrupt, preserve, we beseech thee, our bodies clean and immaculate in thy most holy service, and direct our way in this time, that when the great and terrible day of judgment comes, they may be raised to life among thy saints, and our souls eternally rejoice with thee, and deserve to be associated with thy elect.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["chastity", "easter", "preparation-for-death"],
    summary: `A short prayer to the Father, who kept incorrupt in the tomb the body his Son took from the Virgin Mary and raised it, asking that our bodies be kept pure in his service and raised among the saints at the judgment. One of the book's "Select Prayers of St. Bridget". ${REVELATIONS_NOTE}`,
  }),
];
