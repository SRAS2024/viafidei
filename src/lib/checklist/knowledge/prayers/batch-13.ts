import type { CuratedEntry } from "../index";

/**
 * The archive.org scan of Preces Gertrudianae: Prayers of St. Gertrude and St.
 * Mechtilde of the Order of St. Benedict (London: Burns and Lambert, 1861),
 * addressed by leaf: printed page P of the prayers is leaf n(P + 12).
 */
const PRECES = "https://archive.org/details/PrecesGertrudianae/page/n";

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
 * Batch 13 of the curated prayer catalogue: the prayers of Saint Gertrude the
 * Great and Saint Mechtilde of Helfta in the English of the Preces
 * Gertrudianae of 1861.
 *
 * The Preces Gertrudianae is a Latin manual compiled in the seventeenth
 * century from the revelations of the two Benedictine nuns of Helfta. Its
 * English translation, "the only one from the Latin" in the words of its own
 * preface, was published in London in 1861 with the approval of Cardinal
 * Wiseman; the archive.org record credits it to Thomas Alder Pope (1819-1904).
 * The book is in the public domain. Every citation is the archive.org scan of
 * it (a Google scan of a library copy), opened at the leaf where the prayer
 * begins, followed by any leaf it runs on to.
 *
 * Every body is transcribed from those page images and checked word by word
 * against two independent OCRs of them: the text layer archive.org publishes
 * with the scan and a second recognition of the same images, read column by
 * column. Every place where the two disagree, or where either looks wrong,
 * was settled by reading the page image itself. Nothing is paraphrased,
 * shortened, modernised, composed or merged across versions. The changes are
 * typographical only:
 *   - the capitals of the opening words and the drop initials ("O MOST loving
 *     Je-sus", "HAIL, my God") are given in ordinary case;
 *   - the line-end hyphens of the narrow two-column page are closed up, while
 *     the compounds the book hyphenates elsewhere keep their hyphen
 *     (Life-giving, sweet-smelling, ever-peaceful, only-begotten); "five-fold"
 *     broken at a line end is given as "fivefold", as the book prints
 *     "twofold" and "thousandfold";
 *   - the space the period set before ; : ! and ? is closed, a space the
 *     printer dropped between two words is restored ("tremendous Mysteries",
 *     "me, for salvation", "it may be therein cleansed"), and apostrophes and
 *     quotation marks are given as plain ASCII characters;
 *   - specks of ink in the scan that are not letters are ignored, and worn
 *     type is read as the letter it is: the broken final "e" of "thee" in the
 *     Morning Aspiration to Jesus.
 * The book's alternatives in square brackets ("[or, this prayer]",
 * "[especially N.]") and its "N." for a name are kept as printed.
 *
 * The book sets an italic note before many prayers, reporting what Our Lord
 * said to Saint Gertrude or Saint Mechtilde about it. Those notes are not part
 * of the prayers and are not copied; a summary may say that the book connects
 * a prayer with one of the saints, but it repeats no promise. A title credits
 * the saint the book itself names for the prayer, Saint Gertrude by default,
 * as the book's running head ("Prayers of St. Gertrude") does.
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

const PRECES_NOTE =
  "From the Preces Gertrudianae, the seventeenth-century manual of prayers drawn from the revelations of Saint Gertrude and Saint Mechtilde of Helfta, in its English translation of 1861.";

export const prayerBatch13: CuratedEntry[] = [
  // ── Preces Gertrudianae, Part I: prayers for daily use ─────────────────────
  preces({
    slug: "gertrude-morning-salutation-of-the-sacred-heart",
    title: "Morning Salutation of the Sacred Heart (Saint Mechtilde)",
    leaves: [13, 14],
    body: [
      "I adore, praise, and salute thee, O most sweet Heart of Jesus Christ, fresh and gladdening as the breath of spring, from which, as from a fountain of graces, sweeter than the honeycomb, floweth evermore all good and all delight. I thank thee with all the powers of my heart for having preserved me throughout this night, and for having rendered to God the Father praises and thanksgivings on my behalf. And now, O my sweet Love, I offer thee my wretched and worthless heart as a morning sacrifice; I place it in thy most tender Heart, and intrust it to thy keeping; beseeching thee that thou wouldst deign to pour into it thy divine inspirations, and to enkindle it with thy holy love. Amen.",
    ],
    prayerType: "morning",
    category: "devotional",
    occasions: ["morning", "sacred-heart", "daily"],
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
    occasions: ["morning", "sunday", "offering"],
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
    summary: `The act of spiritual communion the book sets for those who hear Mass without receiving the Sacrament, "saying with St Gertrude and with St Mechtilde": it grieves that the soul must go away fasting from the heavenly banquet, and asks Christ to prepare it to receive him and to work in it all he has decreed. ${PRECES_NOTE}`,
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
    occasions: ["mass", "after-mass", "all-souls"],
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
];
