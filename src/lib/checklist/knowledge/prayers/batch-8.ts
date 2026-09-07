import type { CuratedEntry } from "../index";

const EWTN = "https://www.ewtn.com/catholicism/devotions/";
const CATHOLIC_ONLINE = "https://www.catholic.org/prayers/prayer.php?p=";
const TPL = "https://www.preces-latinae.org/thesaurus/";
const VATICAN_ROSARY = "https://www.vatican.va/special/rosary/index_rosary.htm";

/**
 * Batch 8 of the curated prayer catalogue: the Rosary set, chaplets and acts of
 * consecration, and the Latin hymns of the Missal and the Liturgy of the Hours.
 *
 * Every body is copied character for character from the first cited page, and
 * every `latin` value is the Latin printed alongside it on that same page.
 * Nothing here is paraphrased, shortened or merged across versions.
 *
 * The English is whatever the cited page prints, which is not uniform: most of
 * the hymns carry the nineteenth-century verse translations (Neale, Caswall,
 * Bridges, Newman) in thee/thou, but a few entries reproduce their source's
 * modern-English rendering instead — the O Antiphons and the Stabat Mater from
 * Catholic Online, and the Episcopal Blessing from EWTN, which still prints the
 * superseded 1973 ICEL response "And also with you". Each such case is named in
 * that entry's summary. Two entries are rubrics rather than prayer texts
 * (rosary-opening-prayers, divine-mercy-chaplet-prayers) and say so.
 */
export const prayerBatch8: CuratedEntry[] = [
  {
    contentType: "PRAYER",
    slug: "rosary-opening-prayers",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN}holy-rosary-390`, VATICAN_ROSARY],
    payload: {
      slug: "rosary-opening-prayers",
      title: "Opening Prayers of the Rosary",
      body: "The Preparatory Prayers\n\nStarting on the Crucifix, we call to mind our Redemption and the truths of the Faith.\n\n1. Holding the Crucifix make the Sign of the Cross, praying: “In the name of the Father, and of the Son, and of the Holy Spirit. Amen.”\n\n2. Still on the Crucifix profess the Apostles Creed. “I believe in God, the Father Almighty . . .”\n\nOn the group of 4 beads, honor the Holy Trinity, One God and Three Divine Persons. On the three beads, one may also ask successively for an increase of Faith, of Hope and of Charity, the three theological virtues (1 Cor. 13).\n\n3. On the single bead, pray the Our Father.\n\n4. On the three beads, pray three Hail Marys.\n\n5. On the space after the beads pray the Glory Be.",
      prayerType: "rosary",
      category: "marian",
      language: "en",
      summary:
        "The customary prayers said on the crucifix and the first four beads before the decades of the Rosary begin. Saint John Paul II noted in Rosarium Virginis Mariae that these opening prayers are customary rather than obligatory and vary from place to place; the Vatican's own Rosary pages begin instead with the Sign of the Cross and “O God come to my aid”.",
      occasions: ["rosary", "october", "may", "daily"],
      relatedSaints: [],
      citations: [`${EWTN}holy-rosary-390`, VATICAN_ROSARY],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rosary-closing-prayer",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN}holy-rosary-390`, `${TPL}BVM/Rosarium.html`],
    payload: {
      slug: "rosary-closing-prayer",
      title: "The Rosary Prayer (O God, whose only begotten Son)",
      body: "O God, whose only begotten Son, by His life, death and resurrection, has purchased for us the rewards of eternal salvation, grant, we beseech thee, that while meditating on these mysteries of the most holy rosary of the Blessed Virgin Mary, that we may both imitate what they contain and obtain what they promise through Christ our Lord, Amen.",
      prayerType: "rosary",
      category: "marian",
      language: "en",
      latin:
        "DEUS, cuius Unigenitus per vitam, mortem et resurrectionem suam nobis salutis aeternae praemia comparavit, concede, quaesumus: ut haec mysteria sacratissimo beatae Mariae Virginis Rosario recolentes, et imitemur quod continent, et quod promittunt assequamur. Per eundem Christum Dominum nostrum. Amen.",
      officialPrayer:
        "O God, Who by the life, death, and resurrection of Thy only-begotten Son, hath purchased for us the rewards of eternal salvation, grant, we beseech Thee, that meditating on these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.",
      summary:
        "The collect traditionally said after the Hail, Holy Queen at the end of the Rosary, asking that those who meditate on its mysteries may imitate what they contain. The body is EWTN's English form; the officialPrayer field gives the rendering printed with the Latin collect Deus, cuius Unigenitus.",
      occasions: ["rosary", "october", "may", "daily"],
      relatedSaints: [],
      citations: [`${EWTN}holy-rosary-390`, `${TPL}BVM/Rosarium.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "joyful-mysteries",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.vatican.va/special/rosary/documents/misteri_gaudiosi_en.html",
      `${EWTN}joyful-mysteries-13653`,
    ],
    payload: {
      slug: "joyful-mysteries",
      title: "The Joyful Mysteries of the Rosary",
      body: "Prayed on Mondays and Saturdays, and on the Sundays of Advent and Christmas.\n\nFirst Joyful Mystery: The Annunciation (Lk 1:26-27)\nSecond Joyful Mystery: The Visitation (Lk 1:39-42)\nThird Joyful Mystery: The Birth of Our Lord (Lk 2:1-7)\nFourth Joyful Mystery: The Presentation in the Temple (Lk 2:21-24)\nFifth Joyful Mystery: The Finding of Jesus in the Temple (Lk 2:41-47)\n\nAt the beginning of each decade, announce the mystery to be contemplated. After a short pause for reflection, recite the Our Father, ten Hail Marys and the Glory be to the Father.",
      prayerType: "rosary",
      category: "marian",
      language: "en",
      summary:
        "The first series of the Rosary's twenty mysteries, contemplating the Incarnation and the hidden life of Jesus. The titles and scripture references are those given on the Vatican's Rosary pages, which assign these mysteries to Mondays and Saturdays following Saint John Paul II's Apostolic Letter Rosarium Virginis Mariae; the further custom of praying them on the Sundays of Advent and Christmas is as EWTN prints it.",
      occasions: ["rosary", "advent", "christmas", "monday", "saturday"],
      relatedSaints: [],
      citations: [
        "https://www.vatican.va/special/rosary/documents/misteri_gaudiosi_en.html",
        `${EWTN}joyful-mysteries-13653`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "luminous-mysteries",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.vatican.va/special/rosary/documents/misteri_luminosi_en.html",
      `${EWTN}luminous-mysteries-13659`,
    ],
    payload: {
      slug: "luminous-mysteries",
      title: "The Luminous Mysteries of the Rosary (Mysteries of Light)",
      body: "Prayed on Thursdays.\n\nFirst Mystery of Light: The Baptism in the Jordan (Mt 3:16-17)\nSecond Mystery of Light: The wedding feast of Cana (Jn 2:1-5)\nThird Mystery of Light: The proclamation of the kingdom of God (Mk 1:15)\nFourth Mystery of Light: The Transfiguration (Mt 17:1-2)\nFifth Mystery of Light: The institution of the Eucharist (Mt 26:26)\n\nAt the beginning of each decade, announce the mystery to be contemplated. After a short pause for reflection, recite the Our Father, ten Hail Marys and the Glory be to the Father.",
      prayerType: "rosary",
      category: "marian",
      language: "en",
      summary:
        "The five mysteries of Christ's public ministry, proposed by Saint John Paul II in the Apostolic Letter Rosarium Virginis Mariae in 2002 and assigned to Thursdays. The titles and scripture references are those given on the Vatican's Rosary pages.",
      occasions: ["rosary", "thursday", "ordinary-time"],
      relatedSaints: ["saint-john-paul-ii"],
      citations: [
        "https://www.vatican.va/special/rosary/documents/misteri_luminosi_en.html",
        `${EWTN}luminous-mysteries-13659`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "sorrowful-mysteries",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.vatican.va/special/rosary/documents/misteri_dolorosi_en.html",
      `${EWTN}sorrowful-mysteries-13665`,
    ],
    payload: {
      slug: "sorrowful-mysteries",
      title: "The Sorrowful Mysteries of the Rosary",
      body: "Prayed on Tuesdays and Fridays, and on the Sundays of Lent.\n\nFirst Sorrowful Mystery: The agony in the Garden (Mt 26:36-39)\nSecond Sorrowful Mystery: The scourging at the pillar (Mt 27:26)\nThird Sorrowful Mystery: The crowning with thorns (Mt 27:27-29)\nFourth Sorrowful Mystery: The carrying of the cross (Mk 15:21-22)\nFifth Sorrowful Mystery: The crucifixion (Lk 23:33-46)\n\nAt the beginning of each decade, announce the mystery to be contemplated. After a short pause for reflection, recite the Our Father, ten Hail Marys and the Glory be to the Father.",
      prayerType: "rosary",
      category: "marian",
      language: "en",
      summary:
        "The mysteries of the Passion and death of Christ. The titles and scripture references are those given on the Vatican's Rosary pages, which assign these mysteries to Tuesdays and Fridays; the further custom of praying them on the Sundays of Lent is as EWTN prints it.",
      occasions: ["rosary", "lent", "friday", "tuesday", "holy-week"],
      relatedSaints: [],
      citations: [
        "https://www.vatican.va/special/rosary/documents/misteri_dolorosi_en.html",
        `${EWTN}sorrowful-mysteries-13665`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "glorious-mysteries",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.vatican.va/special/rosary/documents/misteri_gloriosi_en.html",
      `${EWTN}glorious-mysteries-13671`,
    ],
    payload: {
      slug: "glorious-mysteries",
      title: "The Glorious Mysteries of the Rosary",
      body: "Prayed on Wednesdays and Sundays.\n\nFirst Glorious Mystery: The Resurrection (Lk 24:1-5)\nSecond Glorious Mystery: The Ascension (Mk 16:19)\nThird Glorious Mystery: The descent of the Holy Spirit (Acts 2:1-4)\nFourth Glorious Mystery: The Assumption (Lk 1:48-49)\nFifth Glorious Mystery: The crowning of Our Lady Queen of Heaven (Rev 12:1)\n\nAt the beginning of each decade, announce the mystery to be contemplated. After a short pause for reflection, recite the Our Father, ten Hail Marys and the Glory be to the Father.",
      prayerType: "rosary",
      category: "marian",
      language: "en",
      summary:
        "The mysteries of the Resurrection and of the glory given to Christ and to his Mother, prayed on Wednesdays and Sundays. The titles, scripture references and days assigned are those given on the Vatican's Rosary pages.",
      occasions: ["rosary", "easter", "sunday", "wednesday"],
      relatedSaints: [],
      citations: [
        "https://www.vatican.va/special/rosary/documents/misteri_gloriosi_en.html",
        `${EWTN}glorious-mysteries-13671`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "divine-mercy-chaplet-prayers",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN}chaplet-of-the-divine-mercy-387`],
    payload: {
      slug: "divine-mercy-chaplet-prayers",
      title: "The Prayers of the Chaplet of the Divine Mercy",
      body: "1. Begin with the Sign of the Cross, 1 Our Father, 1 Hail Mary and The Apostles Creed.\n\n2. Then on the Our Father Beads say the following:\nEternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.\n\n3. On the 10 Hail Mary Beads say the following:\nFor the sake of His sorrowful Passion, have mercy on us and on the whole world.\n\n(Repeat step 2 and 3 for all five decades).\n\n4. Conclude with (three times):\nHoly God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.",
      prayerType: "chaplet",
      category: "chaplet",
      language: "en",
      summary:
        "The prayers of the Chaplet of Divine Mercy, prayed on ordinary rosary beads and associated with the revelations recorded by Saint Faustina Kowalska in 1935. Only the prayer formulas are given here; the accounts and promises recorded in her Diary are not reproduced.",
      occasions: ["divine-mercy-sunday", "three-oclock-hour", "for-the-dying", "daily"],
      relatedSaints: ["saint-faustina-kowalska"],
      citations: [`${EWTN}chaplet-of-the-divine-mercy-387`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "act-of-consecration-to-the-sacred-heart",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN}act-of-consecration-to-the-sacred-heart-12727`],
    payload: {
      slug: "act-of-consecration-to-the-sacred-heart",
      title: "Act of Consecration to the Sacred Heart",
      body: "O Sacred Heart of Jesus, to Thee I consecrate and offer up my person and my life, my actions, trials, and sufferings, that my entire being may henceforth only be employed in loving, honoring and glorifying Thee. This is my irrevocable will, to belong entirely to Thee, and to do all for Thy love, renouncing with my whole heart all that can displease Thee.\n\nI take Thee, O Sacred Heart, for the sole object of my love, the protection of my life, the pledge of my salvation, the remedy of my frailty and inconstancy, the reparation for all the defects of my life, and my secure refuge at the hour of my death. Be Thou, O Most Merciful Heart, my justification before God Thy Father, and screen me from His anger which I have so justly merited. I fear all from my own weakness and malice, but placing my entire confidence in Thee, O Heart of Love, I hope all from Thine infinite Goodness. Annihilate in me all that can displease or resist Thee. Imprint Thy pure love so deeply in my heart that I may never forget Thee or be separated from Thee.\n\nI beseech Thee, through Thine infinite Goodness, grant that my name be engraved upon Thy Heart, for in this I place all my happiness and all my glory, to live and to die as one of Thy devoted servants.\n\nAmen.",
      prayerType: "consecration",
      category: "consecration",
      language: "en",
      summary:
        "The personal act of consecration to the Sacred Heart written by Saint Margaret Mary Alacoque, printed in Father John Croiset's Devotion to the Sacred Heart. It is commonly made on the feast of the Sacred Heart or on a First Friday.",
      occasions: ["first-friday", "june", "feast-of-the-sacred-heart"],
      relatedSaints: ["saint-margaret-mary-alacoque"],
      citations: [`${EWTN}act-of-consecration-to-the-sacred-heart-12727`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "act-of-consecration-to-mary-de-montfort",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}120`],
    payload: {
      slug: "act-of-consecration-to-mary-de-montfort",
      title: "Act of Consecration to Jesus through Mary (Saint Louis de Montfort)",
      body: "I, N., a faithless sinner-- renew and ratify today in thy hands, O Immaculate Mother, the vows of my Baptism; I renounce forever Satan, his pomps and works; and I give myself entirely to Jesus Christ, the Incarnate Wisdom, to carry my cross after Him all the days of my life, and to be more faithful to Him than I have ever been before.\n\nIn the presence of all the heavenly court I choose thee this day, for my Mother and Mistress. I deliver and consecrate to thee, as thy slave, my body and soul, my goods, both interior and exterior, and even the value of all my good actions, past, present and future; leaving to thee the entire and full right of disposing of me, and all that belongs to me, without exception, according to thy good pleasure, for the greater glory of God, in time and in eternity. Amen.",
      prayerType: "consecration",
      category: "consecration",
      language: "en",
      summary:
        "The short formula of total consecration to Jesus Christ through the hands of Mary composed by Saint Louis Marie de Montfort (1673-1716), by which the baptismal promises are renewed. It is traditionally made at the end of a period of preparation, and is customarily preceded by the doctrine of his True Devotion to the Blessed Virgin. Catholic Online prints it under the heading “Act of Consecration to the Immaculate Heart of Mary” and sources the wording to the Montfort Publications edition of The Secret of the Rosary (1954).",
      occasions: ["marian-feasts", "annunciation", "consecration"],
      relatedSaints: ["saint-louis-de-montfort"],
      citations: [`${CATHOLIC_ONLINE}120`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "consecration-to-christ-the-king",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Filius/IesuDRedempt.html`, `${CATHOLIC_ONLINE}26`],
    payload: {
      slug: "consecration-to-christ-the-king",
      title: "Act of Consecration of the Human Race to the Sacred Heart of Jesus",
      body: "Most sweet Jesus, Redeemer of the human race, look down upon us humbly prostrate before Thee. We are Thine, and Thine we wish to be; but to be more surely united with Thee, behold each one of us freely consecrates himself today to Thy Most Sacred Heart. Many indeed have never known Thee; many, too, despising Thy precepts, have rejected Thee. Have mercy on them all, most merciful Jesus, and draw them to Thy Sacred Heart.\n\nBe King, O Lord, not only of the faithful who have never forsaken Thee, but also of the prodigal children who have abandoned Thee; grant that they may quickly return to their Father's house, lest they die of wretchedness and hunger.\n\nBe King of those who are deceived by erroneous opinions, or whom discord keeps aloof, and call them back to the harbor of truth and the unity of faith, so that soon there may be but one flock and one Shepherd.\n\nGrant, O Lord, to Thy Church assurance of freedom and immunity from harm; give tranquility of order to all nations; make the earth resound from pole to pole with one cry: Praise to the divine Heart that wrought our salvation; to It be glory and honor for ever! Amen.",
      prayerType: "consecration",
      category: "consecration",
      language: "en",
      latin:
        "Iesu dulcissime, Redemptor humani generis, respice nos ante conspectum tuum humillime provolutos. Tui sumus, tui esse volumus; quo autem tibi coniuncti firmius esse possimus, en hodie sacratissimo Cordi tuo se quisque nostrum sponte dedicat. Te quidem multi novere nunquam; te, spretis mandatis tuis, multi repudiarunt. Miserere utrorumque, benignissime Iesu, atque ad sanctum Cor tuum rape universos.\n\nRex esto, Domine, nec fidelium tantum qui nullo tempore discessere a te, sed etiam prodigorum filiorum qui te reliquerunt; fac hos, ut domum paternam cito repetant, ne miseria et fame pereant.\n\nRex esto eorum, quos aut opinionum error deceptos habet, aut discordia separatos, eosque ad portum veritatis atque ad unitatem fidei revoca, ut brevi fiat unum ovile et unus pastor.\n\nLargire, Domine, Ecclesiae tuae securam cum incolumitate libertatem; largire cunctis gentibus tranquillitatem ordinis; perfice, ut ab utroque terrae vertice una resonet vox: Sit laus divino Cordi, per quod nobis parta salus: ipsi gloria et honor in saecula! Amen.",
      summary:
        "The act of dedication of the human race to the Sacred Heart, first prescribed by Pope Leo XIII in 1899 and appointed by Pope Pius XI to be renewed each year on the feast of Christ the King. This is the shorter form given in the Enchiridion Indulgentiarum, without the paragraphs added for particular groups.",
      occasions: ["christ-the-king", "feast-of-the-sacred-heart", "june"],
      relatedSaints: [],
      citations: [`${TPL}Filius/IesuDRedempt.html`, `${CATHOLIC_ONLINE}26`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "stabat-mater",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}325`, `${TPL}BVM/SMDolorosa.html`],
    payload: {
      slug: "stabat-mater",
      title: "Stabat Mater Dolorosa (At the Cross her station keeping)",
      body: "At the Cross Her station keeping\nStood the mournful Mother weeping,\nClose to Jesus to the last.\n\nThrough Her Heart, His sorrow sharing,\nAll His bitter anguish bearing,\nLo! the piercing sword had passed.\n\nO how sad and sore distressed\nWas that Mother, highly blessed,\nOf the Sole-Begotten One.\n\nMournful, with Heart's prostration,\nMother meek, the bitter Passion\nSaw She of Her glorious Son.\n\nWho on Christ's dear Mother gazing,\nIn Her trouble so amazing,\nBorn of woman, would not weep?\n\nWho on Christ's dear Mother thinking,\nSuch a cup of sorrow drinking,\nWould not share Her sorrow deep?\n\nFor His people's sins rejected,\nSaw Her Jesus unprotected.\nSaw with thorns, with scourges rent.\n\nSaw Her Son from judgement taken,\nHer Beloved in death forsaken,\nTill His Spirit forth He sent.\n\nFount of love and holy sorrow,\nMother, may my spirit borrow\nSomewhat of Your woe profound.\n\nUnto Christ with pure emotion,\nRaise my contrite heart's devotion,\nTo read love in every wound.\n\nThose Five Wounds on Jesus smitten,\nMother! in my heart be written,\nDeep as in Your own they be.\n\nYou, Your Savior's Cross did bare,\nYou, Your Son's rebuke did share.\nLet me share them both with Thee.\n\nIn the Passion of my Maker,\nBe my sinful soul partaker,\nWeep 'til death and weep with You.\n\nMine with You be that sad station,\nThere to watch the great salvation,\nWrought upon the atoning Tree.\n\nVirgin, you of virgins fairest,\nMay the bitter woe Thou bearest\nMake on me impression deep.\n\nThus Christ's dying may I carry,\nWith Him in His Passion tarry,\nAnd His Wounds in memory keep.\n\nMay His Wound both wound and heal me,\nHe enkindle, cleanse, strengthen me,\nBy His Cross my hope and stay.\n\nMay He, when the mountains quiver,\nFrom that flame which burns forever,\nShield me on the Judgement Day.\n\nJesus, may Your Cross defend me,\nAnd Your Mother's prayer befriend me;\nLet me die in Your embrace.\n\nWhen to dust my dust returns,\nGrant a soul, that to You yearns,\nIn Your paradise a place. Amen.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Stabat Mater dolorosa\niuxta Crucem lacrimosa,\ndum pendebat Filius.\n\nCuius animam gementem,\ncontristatam et dolentem\npertransivit gladius.\n\nO quam tristis et afflicta\nfuit illa benedicta,\nmater Unigeniti!\n\nQuae maerebat et dolebat,\npia Mater, dum videbat\nnati poenas inclyti.\n\nQuis est homo qui non fleret,\nmatrem Christi si videret\nin tanto supplicio?\n\nQuis non posset contristari\nChristi Matrem contemplari\ndolentem cum Filio?\n\nPro peccatis suae gentis\nvidit Iesum in tormentis,\net flagellis subditum.\n\nVidit suum dulcem Natum\nmoriendo desolatum,\ndum emisit spiritum.\n\nEia, Mater, fons amoris\nme sentire vim doloris\nfac, ut tecum lugeam.\n\nFac, ut ardeat cor meum\nin amando Christum Deum\nut sibi complaceam.\n\nSancta Mater, istud agas,\ncrucifixi fige plagas\ncordi meo valide.\n\nTui Nati vulnerati,\ntam dignati pro me pati,\npoenas mecum divide.\n\nFac me tecum pie flere,\ncrucifixo condolere,\ndonec ego vixero.\n\nIuxta Crucem tecum stare,\net me tibi sociare\nin planctu desidero.\n\nVirgo virginum praeclara,\nmihi iam non sis amara,\nfac me tecum plangere.\n\nFac, ut portem Christi mortem,\npassionis fac consortem,\net plagas recolere.\n\nFac me plagis vulnerari,\nfac me Cruce inebriari,\net cruore Filii.\n\nFlammis ne urar succensus,\nper te, Virgo, sim defensus\nin die iudicii.\n\nChriste, cum sit hinc exire,\nda per Matrem me venire\nad palmam victoriae.\n\nQuando corpus morietur,\nfac, ut animae donetur\nparadisi gloria. Amen.",
      summary:
        "The thirteenth-century sequence on the Mother of Sorrows standing beneath the Cross, most commonly attributed to Jacopone da Todi. Since 1727 it has been the sequence of the Mass of Our Lady of Sorrows on 15 September and is also sung at the Stations of the Cross. The English here is Catholic Online's own rendering, which is not the traditional missal translation: it modernises the address to Our Lady, so that “thou” and “You” stand side by side within a single stanza. The Latin is the text of the Liturgia Horarum, which Thesaurus Precum Latinarum prints instead with Father Edward Caswall's classic verse translation (“At the Cross her station keeping … safe in paradise with Thee”).",
      occasions: ["lent", "our-lady-of-sorrows", "stations-of-the-cross", "good-friday"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}325`, `${TPL}BVM/SMDolorosa.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-antiphons",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://www.catholic.org/advent/advent.php?id=7"],
    payload: {
      slug: "o-antiphons",
      title: "The O Antiphons of Advent",
      body: "O Sapientia - December 17th\nO Wisdom, you come forth from the mouth of the Most High. You fill the universe and hold all things together in a strong yet gentle manner. O come to teach us the way of truth.\n\nO Adonai - December 18th\nO Adonai and leader of Israel, you appeared to Moses in a burning bush and you gave him the Law on Sinai. O come and save us with your mighty power.\n\nO Radix Jesse - December 19th\nO stock of Jesse, you stand as a signal for the nations; kings fall silent before you whom the peoples acclaim. O come to deliver us, and do not delay.\n\nO Clavis David - December 20th\nO key of David and scepter of Israel, what you open no one else can close again; what you close no one can open. O come to lead the captive from prison; free those who sit in darkness and in the shadow of death.\n\nO Oriens - December 21st\nO Rising Sun, you are the splendor of eternal light and the sun of justice. O come and enlighten those who sit in darkness and in the shadow of death.\n\nO Rex Gentium - December 22nd\nO King whom all the peoples desire, you are the cornerstone which makes all one. O come and save man whom you made from clay.\n\nO Emmanuel - December 23rd\nO Emmanuel, you are our king and judge, the One whom the peoples await and their Savior. O come and save us, Lord, our God.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        "The seven antiphons sung before the Magnificat at Evening Prayer from 17 to 23 December, each addressing Christ by a title drawn from the Old Testament and ending with a plea that he come. Their Latin initials read backwards spell ERO CRAS, “Tomorrow I will be there”. The hymn Veni, veni Emmanuel is a paraphrase of them. The English given here is Catholic Online's modern rendering, not the translation used in the Liturgy of the Hours.",
      occasions: ["advent", "december-17", "vespers", "christmas-novena"],
      relatedSaints: [],
      citations: ["https://www.catholic.org/advent/advent.php?id=7"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "veni-veni-emmanuel",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${TPL}Hymni/VeniEmm.html`],
    payload: {
      slug: "veni-veni-emmanuel",
      title: "Veni, Veni Emmanuel (O Come, O Come, Emmanuel)",
      body: "O come, O come, Emmanuel,\nand ransom captive Israel,\nthat morns in lonely exile here\nuntil the Son of God appear.\nR: Rejoice! Rejoice! O Israel,\nto thee shall come Emmanuel!\n\nO come, Thou Wisdom, from on high,\nand order all things far and nigh;\nto us the path of knowledge show,\nand teach us in her ways to go. R.\n\nO come, o come, Thou Lord of might,\nwho to thy tribes on Sinai's height\nin ancient times did give the law,\nin cloud, and majesty, and awe. R.\n\nO come, Thou Rod of Jesse's stem,\nfrom ev'ry foe deliver them\nthat trust Thy mighty power to save,\nand give them vict'ry o'er the grave. R.\n\nO come, Thou Key of David, come,\nand open wide our heav'nly home,\nmake safe the way that leads on high,\nthat we no more have cause to sigh. R.\n\nO come, Thou Dayspring from on high,\nand cheer us by thy drawing nigh;\ndisperse the gloomy clouds of night\nand death's dark shadow put to flight. R.\n\nO come, Desire of the nations, bind\nin one the hearts of all mankind;\nbid every strife and quarrel cease\nand fill the world with heaven's peace. R.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Veni veni, Emmanuel\ncaptivum solve Israel,\nqui gemit in exsilio,\nprivatus Dei Filio.\nR: Gaude! Gaude! Emmanuel,\nnascetur pro te Israel!\n\nVeni, O Sapientia,\nquae hic disponis omnia,\nveni, viam prudentiae\nut doceas et gloriae. R.\n\nVeni, veni, Adonai,\nqui populo in Sinai\nlegem dedisti vertice\nin maiestate gloriae. R.\n\nVeni, O Iesse virgula,\nex hostis tuos ungula,\nde specu tuos tartari\neduc et antro barathri. R.\n\nVeni, Clavis Davidica,\nregna reclude caelica,\nfac iter tutum superum,\net claude vias inferum. R.\n\nVeni, veni O Oriens,\nsolare nos adveniens,\nnoctis depelle nebulas,\ndirasque mortis tenebras. R.\n\nVeni, veni, Rex Gentium,\nveni, Redemptor omnium,\nut salvas tuos famulos\npeccati sibi conscios. R.",
      summary:
        "A synthesis in verse of the seven O Antiphons, first printed in the Psalteriolum Cantionum Catholicarum (Cologne, 1710). The English is the translation of Thomas Helmore (1811-1890) and John Mason Neale (1818-1866). The first verse sets the last of the antiphons, O Emmanuel, at the head of the hymn.",
      occasions: ["advent", "december-17", "christmas-novena"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/VeniEmm.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "gloria-in-excelsis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Trinitas/Gloria.html`],
    payload: {
      slug: "gloria-in-excelsis",
      title: "Gloria in excelsis Deo (The Greater Doxology)",
      body: "Glory to God in the highest, and peace on earth to men of good will.\n\nWe praise Thee, we bless Thee, we adore Thee, we glorify Thee, we give Thee thanks for Thy great glory, O Lord God, heavenly King, God the Father Almighty.\n\nO Lord Jesus Christ, only begotten Son, Lord God, Lamb of God, Son of the Father, Thou who takest away the sins of the world, have mercy on us; Thou who takest away the sins of the world, receive our prayer. Thou who sittest at the right hand of the Father, have mercy on us.\n\nFor Thou alone art the Holy One, Thou alone art the Lord, Thou alone art the Most High, Jesus Christ, with the Holy Spirit, in the glory of God the Father. Amen.",
      prayerType: "hymn",
      category: "trinitarian",
      language: "en",
      latin:
        "Gloria in excelsis Deo et in terra pax hominibus bonae voluntatis.\n\nLaudamus te, benedicimus te, adoramus te, glorificamus te, gratias agimus tibi propter magnam gloriam tuam, Domine Deus, Rex caelestis, Deus Pater omnipotens.\n\nDomine Fili unigenite, Iesu Christe, Domine Deus, Agnus Dei, Filius Patris, qui tollis peccata mundi, miserere nobis; qui tollis peccata mundi, suscipe deprecationem nostram. Qui sedes ad dexteram Patris, miserere nobis.\n\nQuoniam tu solus Sanctus, tu solus Dominus, tu solus Altissimus, Iesu Christe, cum Sancto Spiritu in gloria Dei Patris. Amen",
      summary:
        "The ancient hymn of praise to the Trinity that opens with the angels' song at Bethlehem (Lk 2:14) and has belonged to the Mass of the Western rites since the fifth century. The English given here is the traditional hand-missal translation; the wording used at Mass today is the current approved liturgical translation.",
      occasions: ["mass", "sunday", "christmas", "easter", "solemnities"],
      relatedSaints: ["saint-hilary-of-poitiers"],
      citations: [`${TPL}Trinitas/Gloria.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "sanctus",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Trinitas/Sanctus.html`],
    payload: {
      slug: "sanctus",
      title: "Sanctus (Holy, Holy, Holy)",
      body: "Holy, holy, holy, Lord God of hosts. Heaven and earth are full of Thy glory. Hosanna in the highest. Blessed is He who comes in the name of the Lord. Hosanna in the highest.",
      prayerType: "hymn",
      category: "eucharistic",
      language: "en",
      latin:
        "Sanctus, Sanctus, Sanctus, Dominus Deus Sabaoth. Pleni sunt caeli et terra gloria tua. Hosanna in excelsis. Benedictus qui venit in nomine Domini. Hosanna in excelsis.",
      summary:
        "The acclamation sung at the close of the Preface of the Mass, joining the voices of the Church to those of the angels. Its first part is drawn from Isaiah 6:3 and its second from Matthew 21:9. The English given here is the traditional hand-missal translation; the wording used at Mass today is the current approved liturgical translation.",
      occasions: ["mass", "adoration"],
      relatedSaints: [],
      citations: [`${TPL}Trinitas/Sanctus.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "jesu-dulcis-memoria",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Nativitatis/IesuDulcis.html`],
    payload: {
      slug: "jesu-dulcis-memoria",
      title: "Iesu, Dulcis Memoria (Jesu, the very thought of Thee)",
      body: "Jesu, the very thought of Thee,\nwith sweetness fills my breast,\nbut sweeter far Thy face to see,\nand in Thy presence rest.\n\nNor voice can sing, nor heart can frame,\nnor can the memory find\na sweeter sound than Thy blest Name,\no Savior of mankind!.\n\nO hope of every contrite heart\no joy of all the meek,\nto those who fall, how kind Thou art!\nhow good to those who seek!\n\nBut what to those who find? Ah this\nnor tongue nor pen can show:\nthe love of Jesus, what it is\nnone but His loved ones know.\n\nJesu, our only joy be Thou,\nAs Thou our prize wilt be:\nJesu, be Thou our glory now,\nAnd through eternity.\nAmen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Iesu, dulcis memoria,\ndans vera cordis gaudia,\nsed super mel et omnia,\neius dulcis praesentia.\n\nNil canitur suavius,\nnil auditur iucundius,\nnil cogitatur dulcius,\nquam Iesus Dei Filius.\n\nIesu, spes paenitentibus,\nquam pius es petentibus!\nquam bonus te quaerentibus!\nsed quid invenientibus?\n\nNec lingua valet dicere,\nnec littera exprimere:\nexpertus potest credere,\nquid sit Iesum diligere.\n\nSis, Iesu, nostrum gaudium,\nqui es futurus praemium:\nsit nostra in te gloria,\nper cuncta semper saecula.\nAmen.",
      summary:
        "The Vespers portion of a twelfth-century hymn on the Holy Name of Jesus, long attributed to Saint Bernard of Clairvaux though its origin appears to be English. The English is the translation of Father Edward Caswall (1814-1878). The optional memorial of the Most Holy Name of Jesus is kept on 3 January.",
      occasions: ["holy-name-of-jesus", "january", "adoration"],
      relatedSaints: ["saint-bernard-of-clairvaux"],
      citations: [`${TPL}Hymni/Nativitatis/IesuDulcis.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "te-lucis-ante-terminum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/TeLucis.html`],
    payload: {
      slug: "te-lucis-ante-terminum",
      title: "Te lucis ante terminum (To Thee, before the close of day)",
      body: "To Thee, before the close of day\nCreator of the world, we pray\nthat with Thy wonted favor, Thou\nwouldst be our Guard and Keeper now.\n\nFrom all ill dreams defend our eyes,\nfrom nightly fears and fantasies:\ntread under foot our ghostly foe,\nthat no pollution we may know.\n\nO Father, that we ask be done\nthrough Jesus Christ Thine only Son,\nwho, with the Holy Ghost and Thee,\nshall live and reign eternally.\nAmen.",
      prayerType: "evening",
      category: "liturgical",
      language: "en",
      latin:
        "Te lucis ante terminum,\nrerum Creator, poscimus\nut pro tua clementia\nsis praesul et custodia.\n\nProcul recedant somnia\net noctium phantasmata;\nhostemque nostrum comprime,\nne polluantur corpora.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum.\nAmen.",
      summary:
        "The seventh-century Ambrosian hymn of Compline, asking God's protection through the night. This is the form found in the Roman and Monastic Breviaries; the Liturgy of the Hours drops the second verse and replaces it with two others.",
      occasions: ["compline", "evening", "night-prayer"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/TempusPerAnnum/TeLucis.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "lucis-creator-optime",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/LucisCreator.html`],
    payload: {
      slug: "lucis-creator-optime",
      title: "Lucis Creator optime (O blest Creator of the light)",
      body: "O blest Creator of the light,\nWho mak'st the day with radiance bright,\nand o'er the forming world didst call\nthe light from chaos first of all;\n\nWhose wisdom joined in meet array\nthe morn and eve, and named them Day:\nnight comes with all its darkling fears;\nregard Thy people's prayers and tears.\n\nLest, sunk in sin, and whelmed with strife,\nthey lose the gift of endless life;\nwhile thinking but the thoughts of time,\nthey weave new chains of woe and crime.\n\nBut grant them grace that they may strain\nthe heavenly gate and prize to gain:\neach harmful lure aside to cast,\nand purge away each error past.\n\nO Father, that we ask be done,\nthrough Jesus Christ, Thine only Son;\nWho, with the Holy Ghost and Thee,\ndoth live and reign eternally. Amen.",
      prayerType: "evening",
      category: "liturgical",
      language: "en",
      latin:
        "Lucis Creator optime\nlucem dierum proferens,\nprimordiis lucis novae,\nmundi parans originem:\n\nQui mane iunctum vesperi\ndiem vocari praecipis:\ntetrum chaos illabitur,\naudi preces cum fletibus.\n\nNe mens gravata crimine,\nvitae sit exsul munere,\ndum nil perenne cogitat,\nseseque culpis illigat.\n\nCaeleste pulset ostium:\nvitale tollat praemium:\nvitemus omne noxium:\npurgemus omne pessimum.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "The Sunday Vespers hymn of the Roman Breviary, attributed to Pope Saint Gregory the Great (540-604) and kept in the Liturgy of the Hours for Sunday evening in Ordinary Time. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["vespers", "sunday", "evening", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/LucisCreator.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "conditor-alme-siderum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Adventus/Conditor.html`],
    payload: {
      slug: "conditor-alme-siderum",
      title: "Conditor alme siderum (Creator of the stars of night)",
      body: "Creator of the stars of night,\nThy people's everlasting light,\nJesu, Redeemer, save us all,\nand hear Thy servants when they call.\n\nThou, grieving that the ancient curse\nshould doom to death a universe,\nhast found the medicine, full of grace,\nto save and heal a ruined race.\n\nThou camest, the Bridegroom of the Bride,\nas drew the world to evening tide,\nproceeding from a virgin shrine,\nthe spotless Victim all divine.\n\nAt whose dread Name, majestic now,\nall knees must bend, all hearts must bow;\nand things celestial Thee shall own,\nand things terrestrial Lord alone.\n\nO Thou whose coming is with dread,\nto judge and doom the quick and dead,\npreserve us, while we dwell below,\nfrom every insult of the foe.\n\nTo God the Father, God the Son,\nand God the Spirit, Three in One,\nlaud, honor, might, and glory be\nfrom age to age eternally. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Conditor alme siderum,\naeterna lux credentium,\nChriste, redemptor omnium,\nexaudi preces supplicum.\n\nQui condolens interitu\nmortis perire saeculum,\nsalvasti mundum languidum,\ndonans reis remedium,\n\nVergente mundi vespere,\nuti sponsus de thalamo,\negressus honestissima\nVirginis matris clausula.\n\nCuius forti potentiae\ngenu curvantur omnia;\ncaelestia, terrestria\nnutu fatentur subdita.\n\nTe, Sancte, fide quaesumus,\nventure iudex saeculi,\nconserva nos in tempore\nhostis a telo perfidi.\n\nSit, Christe, rex piissime,\ntibi Patrique gloria\ncum Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "The anonymous seventh-century hymn sung at Vespers during Advent, restored to the liturgy in the Liturgia Horarum after Pope Urban VIII's 1632 revision had replaced it with Creator alme siderum. The English is a nineteenth-century translation.",
      occasions: ["advent", "vespers", "evening"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/Adventus/Conditor.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "creator-alme-siderum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Adventus/CreatorAlme.html`],
    payload: {
      slug: "creator-alme-siderum",
      title: "Creator alme siderum (Bright builder of the heavenly poles)",
      body: "Bright builder of the heavenly poles,\neternal light of faithful souls,\nJesus, Redeemer of mankind,\nour humble prayers vouchsafe to mind:\n\nWho, lest the fraud of hell's black king\nshould all men to destruction bring,\ndidst, by an act of generous love,\nthe fainting world's physician prove.\n\nThou, that Thou mightst our ransom pay\nand wash the stains of sin away,\ndidst from a Virgin's womb proceed\nand on the Cross a Victim bleed.\n\nThy glorious power, Thy saving Name\nno sooner any voice can frame,\nbut heaven and earth and hell agree\nto honor them with trembling knee.\n\nThee, Christ, who at the latter day\nshalt be our Judge, we humbly pray\nsuch arms of heavenly grace to send\nas may Thy Church from foes defend.\n\nBe glory given and honor done\nto God the Father and the Son\nand to the Holy Ghost on high,\nfrom age to age eternally.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Creator alme siderum,\naeterna lux credentium,\nIesu, Redemptor omnium,\nintende votis supplicum.\n\nQui daemonis ne fraudibus\nperiret orbis, impetu\namoris actus, languidi,\nmundi medela factus es,\n\nCommune qui mundi nefas\nut expiares, ad crucem\ne Virginis sacrario\nintacta prodis victima.\n\nCuius potestas gloriae,\nNomenque cum primum sonat,\net caelites et inferi\ntremente curvantur genu.\n\nTe, deprecamur ultimae\nmagnum diei Iudicem,\narmis supernae gratiae\ndefende nos ab hostibus.\n\nVirtus, honor, laus, gloria\nDeo Patri cum Filio,\nSancto simul Paraclito,\nin saeculorum saecula.",
      summary:
        "The revision of Conditor alme siderum made for the Roman Breviary under Pope Urban VIII in 1632, so thoroughly recast in classical metre that it is effectively a hymn in its own right. It was formerly sung at Vespers in Advent. The English is drawn from the Primer (1685) and the Evening Office (1710).",
      occasions: ["advent", "vespers", "evening"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/Adventus/CreatorAlme.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "veni-redemptor-gentium",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Adventus/VeniRedemptorG.html`],
    payload: {
      slug: "veni-redemptor-gentium",
      title: "Veni, redemptor gentium (O come, Redeemer of the earth)",
      body: "O come, Redeemer of the earth,\nand manifest thy virgin-birth.\nLet every age in wonder fall:\nsuch birth befits the God of all.\n\nBegotten of no human will\nbut of the Spirit, Thou art still\nthe Word of God in flesh arrayed,\nthe promised fruit to man displayed.\n\nThe Virgin's womb that burden gained,\nits virgin honor still unstained.\nThe banners there of virtue glow;\nGod in his temple dwells below.\n\nProceeding from His chamber free\nthat royal home of purity\na giant in twofold substance one,\nrejoicing now His course to run.\n\nO equal to the Father, Thou!\ngird on Thy fleshly mantle now;\nthe weakness of our mortal state\nwith deathless might invigorate.\n\nThy cradle here shall glitter bright,\nand darkness breathe a newer light\nwhere endless faith shall shine serene\nand twilight never intervene.\n\nAll praise, eternal Son, to Thee,\nwhose advent sets Thy people free,\nwhom, with the Father, we adore,\nand Holy Ghost, for evermore. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Veni, redemptor gentium,\nostende partum Virginis;\nmiretur omne saeculum:\ntalis decet partus Deum.\n\nNon ex virili semine,\nsed mystico spiramine\nVerbum Dei factum est caro\nfructusque ventris floruit.\n\nAlvus tumescit Virginis,\nclaustrum pudoris permanet,\nvexilla virtutum micant,\nversatur in templo Deus.\n\nProcedat e thalamo suo,\npudoris aula regia,\ngeminae gigas substantiae\nalacris ut currat viam.\n\nAequalis aeterno Patri,\ncarnis tropaeo cingere,\ninfirma nostri corporis\nvirtute firmans perpeti.\n\nPraesepe iam fulget tuum\nlumenque nox spirat novum,\nquod nulla nox interpolet\nfideque iugi luceat.\n\nSit, Christe, rex piissime,\ntibi Patrique gloria\ncum Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "An Advent hymn on the Incarnation written by Saint Ambrose of Milan (340-397) and used in the Liturgy of the Hours for the Office of Readings in the octave before Christmas. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["advent", "christmas", "office-of-readings"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/Adventus/VeniRedemptorG.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ad-cenam-agni-providi",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Paschale/AdCenamAgni.html`],
    payload: {
      slug: "ad-cenam-agni-providi",
      title: "Ad cenam Agni providi (The Lamb's high banquet we await)",
      body: "The Lamb's high banquet we await\nin snow-white robes of royal state:\nand now, the Red Sea's channel past,\nto Christ our Prince we sing at last.\n\nUpon the Altar of the Cross\nHis Body hath redeemed our loss:\nand tasting of his roseate Blood,\nour life is hid with Him in God.\n\nThat Paschal Eve God's arm was bared,\nthe devastating Angel spared:\nby strength of hand our hosts went free\nfrom Pharaoh's ruthless tyranny.\n\nNow Christ, our Paschal Lamb, is slain,\nthe Lamb of God that knows no stain,\nthe true Oblation offered here,\nour own unleavened Bread sincere.\n\nO Thou, from whom hell's monarch flies,\nO great, O very Sacrifice,\nThy captive people are set free,\nand endless life restored in Thee.\n\nFor Christ, arising from the dead,\nfrom conquered hell victorious sped,\nand thrust the tyrant down to chains,\nand Paradise for man regains.\n\nWe pray Thee, King with glory decked,\nin this our Paschal joy, protect\nfrom all that death would fain effect\nThy ransomed flock, Thine own elect.\n\nTo Thee who, dead, again dost live,\nall glory Lord, Thy people give;\nall glory, as is ever meet,\nto Father and to Paraclete. Amen.",
      prayerType: "hymn",
      category: "eucharistic",
      language: "en",
      latin:
        "Ad cenam Agni providi,\nstolis salutis candidi,\npost transitum maris Rubri\nChristo canamus principi.\n\nCuius corpus sanctissimum\nin ara crucis torridum,\nsed et cruorem roseum\ngustando, Deo vivimus.\n\nProtecti paschae vespero\na devastante angelo,\nde Pharaonis aspero\nsumus erepti imperio.\n\nIam pascha nostrum Christus est,\nagnus occisus innocens;\nsinceritatis azyma\nqui carnem suam obtulit.\n\nO vera, digna hostia,\nper quam franguntur tartara,\ncaptiva plebs redimitur,\nredduntur vitae praemia!\n\nConsurgit Christus tumulo,\nvictor redit de barathro,\ntyrannum trudens vinculo\net paradisum reserans.\n\nEsto perenne mentibus\npaschale, Iesu, gaudium\net nos renatos gratiae\ntuis triumphis aggrega.\n\nIesu, tibi sit gloria,\nqui morte victa praenites,\ncum Patre et almo Spiritu,\nin sempiterna saecula. Amen.",
      summary:
        "One of the earliest Ambrosian hymns, sung at Vespers from Easter Sunday until the Ascension, joining the Passover of Israel to the Paschal Lamb who is Christ. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["easter", "vespers", "eastertide"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/Paschale/AdCenamAgni.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-gloriosa-virginum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}BVM/OGloriosa.html`],
    payload: {
      slug: "o-gloriosa-virginum",
      title: "O Gloriosa Domina (O heaven's glorious mistress)",
      body: "O heaven's glorious mistress,\nenthron'd above the starry sky!\nthou feedest with thy sacred breast\nthy own Creator, Lord most high.\n\nWhat man had lost in hapless Eve,\nthy sacred womb to man restores,\nthou to the wretched here beneath\nhast open'd Heaven's eternal doors.\n\nHail, O refulgent Hall of light!\nHail Gate august of Heaven's high King!\nthrough thee redeem'd to endless life,\nthy praise let all the nations sing.\n\nTo the Father and the Spirit\nand to thy Son all glory be,\nwho with a wonderous garment\nof graces encircled thee. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      latin:
        "O gloriosa domina\nexcelsa super sidera,\nqui te creavit provide,\nlactas sacrato ubere.\n\nQuod Eva tristis abstulit,\ntu reddis almo germine;\nintrent ut astra flebiles,\nsternis benigna semitam.\n\nTu regis alti ianua\net porta lucis fulgida;\nvitam datam per Virginem,\ngentes redemptae, plaudite.\n\nPatri sit Paraclito\ntuoque Nato gloria,\nqui veste te mirabili\ncircumdederunt gratiae. Amen.",
      summary:
        "The second half of Venantius Fortunatus's hymn Quem terra, pontus, aethera, used at Lauds in the Common of the Blessed Virgin Mary. Pope Urban VIII's 1632 revision of the Breviary begins it “O gloriosa virginum”. It was a favourite hymn of Saint Anthony of Padua. The English is by Richard Frederick Littledale (1833-1890) and others.",
      occasions: ["lauds", "marian-feasts", "may"],
      relatedSaints: ["saint-anthony-of-padua"],
      citations: [`${TPL}BVM/OGloriosa.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "quem-terra-pontus-sidera",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}BVM/QuemTerra.html`],
    payload: {
      slug: "quem-terra-pontus-sidera",
      title: "Quem terra, pontus, aethera (The God whom earth and sea and sky)",
      body: "The God whom earth, and sea, and sky\nadore, and laud, and magnify,\nwho o'er their threefold fabric reigns,\nthe Virgin's spotless womb contains.\n\nThe God whose will by moon, and sun,\nand all things in due course is done,\nis borne upon a Maiden's breast,\nby fullest heavenly grace possessed.\n\nHow blest that Mother, in whose shrine\nthe great Artificer Divine,\nwhose hand contains the earth and sky,\nvouchsafed, as in His ark, to lie.\n\nBlest, in the message Gabriel brought;\nblest, by the work the Spirit wrought;\nfrom whom the great Desire of earth\ntook human flesh and human birth.\n\nAll honor, laud, and glory be,\no Jesu Virgin-born, to Thee,\nwhom with the Father we adore,\nand Holy Ghost for evermore. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      latin:
        "Quem terra, pontus, aethera\ncolunt, adorant, praedicant,\ntrinam regentem machinam\nclaustrum Mariae baiulat.\n\nCui Luna, Sol, et omnia\ndeserviunt per tempora,\nperfusa caeli gratia,\ngestant Puellae viscera.\n\nBeata Mater, munere,\ncuius supernus Artifex,\nmundum pugillo continens,\nventris sub arca clausus est.\n\nBeata caeli nuntio,\nfecunda Sancto Spiritu,\ndesideratus Gentibus,\ncuius per alvum fusus est.\n\nIesu, Tibi sit gloria,\nqui natus es de Virgine,\ncum Patre, et almo Spiritu,\nin sempiterna saecula. Amen.",
      summary:
        "A Marian hymn by Venantius Fortunatus (530-609), Bishop of Poitiers, used in the Liturgy of the Hours as the hymn for the Office of Readings in the Common of the Blessed Virgin Mary and daily in the Little Office. Pope Urban VIII's revision reads “sidera” for “aethera”. The English is the translation of John Mason Neale (1818-1866), with a different final couplet.",
      occasions: ["office-of-readings", "marian-feasts", "little-office"],
      relatedSaints: [],
      citations: [`${TPL}BVM/QuemTerra.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-lux-beata-trinitas",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/OLuxBeata.html`],
    payload: {
      slug: "o-lux-beata-trinitas",
      title: "O lux beata Trinitas (O Trinity of blessed Light)",
      body: "O Trinity of blessed Light,\nO Unity of sovereign might,\nas now the fiery sun departs,\nshed Thou Thy beams within our hearts.\n\nTo Thee our morning song of praise,\nto Thee our evening prayer we raise;\nThee may our glory evermore\nin lowly reverence adore.\n\nAll laud to God the Father be;\nall praise, Eternal Son, to Thee;\nall glory, as is ever meet,\nto God the Holy Paraclete.",
      prayerType: "hymn",
      category: "trinitarian",
      language: "en",
      latin:
        "O lux beata Trinitas,\net principalis Unitas,\niam sol recedit igneus,\ninfunde lumen cordibus.\n\nTe mane laudum carmine,\nte deprecemur vespere:\nte nostra supplex gloria\nper cuncta laudet saecula.\n\nDeo Patri sit gloria,\neiusque soli Filio,\ncum Spiritu Paraclito,\net nunc, et in perpetuum.",
      summary:
        "An evening hymn to the Holy Trinity ascribed to Saint Ambrose, used at Sunday Vespers in the Liturgy of the Hours. In the Roman Breviary it appears under the title Iam sol recedit igneus. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["vespers", "evening", "trinity-sunday", "sunday"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/TempusPerAnnum/OLuxBeata.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "nunc-sancte-nobis-spiritus",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/NuncSancte.html`],
    payload: {
      slug: "nunc-sancte-nobis-spiritus",
      title: "Nunc, Sancte, nobis Spiritus (Come, Holy Ghost, who ever One)",
      body: "Come, Holy Ghost, who ever One\nart with the Father and the Son,\nit is the hour, our souls possess\nwith Thy full flood of holiness.\n\nLet flesh, and heart, and lips, and mind,\nsound forth our witness to mankind;\nand love light up our mortal frame,\ntill others catch the living flame.\n\nGrant this, O Father, ever One\nwith Christ, Thy sole-begotten Son,\nand Holy Ghost, whom all adore,\nreigning and blest forevermore.",
      prayerType: "morning",
      category: "trinitarian",
      language: "en",
      latin:
        "Nunc, Sancte, nobis Spiritus,\nunum Patri cum Filio,\ndignare promptus ingeri\nnostro refusus pectori.\n\nOs, lingua, mens, sensus, vigor\nconfessionem personent,\nflammescat igne caritas,\naccendat ardor proximos.\n\nPer te sciamus da Patrem,\nnoscamus atque Filium,\nte utriusque Spiritum\ncredamus omni tempore. Amen.",
      summary:
        "The hymn of Terce, mid-morning prayer, attributed to Saint Ambrose and fitting to the hour at which the Holy Spirit came upon the Apostles at Pentecost (Acts 2:15). The English is the translation of Saint John Henry Newman, who rendered the Roman Breviary's alternative doxology.",
      occasions: ["terce", "mid-morning-prayer", "pentecost"],
      relatedSaints: ["saint-ambrose", "saint-john-henry-newman"],
      citations: [`${TPL}Hymni/TempusPerAnnum/NuncSancte.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rector-potens-verax-deus",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/RectorPotens.html`],
    payload: {
      slug: "rector-potens-verax-deus",
      title: "Rector potens, verax Deus (O God of truth, O Lord of might)",
      body: "O God of truth, O Lord of might,\nWho orderest time and change aright,\nand sendest the early morning ray,\nand lightest the glow of perfect day.\n\nExtinguish Thou each sinful fire,\nand banish every ill desire:\nand while Thou keepest the body whole\nshed forth Thy peace upon the soul.\n\nAlmighty Father, hear our cry\nthrough Jesus Christ, Our Lord most High\nWho, with the Holy Ghost and Thee,\ndoth live and reign eternally. Amen.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      latin:
        "Rector potens, verax Deus,\nqui temperas rerum vices,\nsplendore mane instruis\net ignibus meridiem,\n\nExtingue flammas litium,\naufer calorem noxium,\nconfer salutem corporum\nveramque pacem cordium.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "The hymn of Sext, midday prayer, attributed to Saint Ambrose, asking that the noonday heat of quarrels and ill desire be quenched. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["sext", "midday-prayer"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/TempusPerAnnum/RectorPotens.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rerum-deus-tenax-vigor",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/RerumDeus.html`],
    payload: {
      slug: "rerum-deus-tenax-vigor",
      title: "Rerum, Deus, tenax vigor (O Strength and Stay upholding all creation)",
      body: "O Strength and Stay upholding all creation\nWho ever dost Thyself unmoved abide,\nyet day by day the light in due gradation\nfrom hour to hour though all its changes guide;\n\nGrant to life's day a calm unclouded ending,\nan eve untouched by shadows of decay,\nthe brightness of a holy deathbed blending\nwith dawning glories of the eternal day.\n\nHear us, O Father, gracious and forgiving,\nand Thou, O Christ, the coeternal Word,\nWho, with the Holy Ghost by all things living,\nnow and to endless ages art adored. Amen.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      latin:
        "Rerum, Deus, tenax vigor,\nimmotus in te permanens,\nlucis diurnae tempora\nsuccessibus determinans,\n\nLargire clarum vespere,\nquo vita numquam decidat,\nsed praemium mortis sacrae\nperennis instet gloria.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "The hymn of None, mid-afternoon prayer, attributed to Saint Ambrose and prayed at the ninth hour, the hour of Christ's death. The English is the translation of John Ellerton (1826-1893) and Fenton John Anthony Hort (1828-1892).",
      occasions: ["none", "mid-afternoon-prayer", "three-oclock-hour"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/TempusPerAnnum/RerumDeus.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "splendor-paternae-gloriae",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/Splendor.html`],
    payload: {
      slug: "splendor-paternae-gloriae",
      title: "Splendor paternae gloriae (O splendor of God's glory bright)",
      body: "O splendor of God's glory bright,\nO Thou that bringest light from light,\nO Light of Light, light's Living Spring,\nO Day, all days illumining.\n\nO Thou true Sun, on us Thy glance\nlet fall in royal radiance,\nthe Spirit's sanctifying beam\nupon our earthly senses stream.\n\nThe Father too our prayers implore,\nFather of glory evermore,\nthe Father of all grace and might,\nto banish sin from our delight:\n\nTo guide whate'er we nobly do,\nwith love all envy to subdue,\nto make ill-fortune turn to fair,\nand give us grace our wrongs to bear.\n\nOur mind be in His keeping placed,\nour body true to Him and chaste,\nwhere only faith her fire shall feed\nto burn the tares of Satan's seed.\n\nAnd Christ to us for food shall be,\nfrom Him our drink that welleth free,\nthe Spirit's wine, that maketh whole,\nand mocking not, exalts the soul.\n\nRejoicing may this day go hence,\nlike virgin dawn our innocence,\nlike fiery noon our faith appear,\nnor know the gloom of twilight drear.\n\nMorn in her rosy car is borne:\nlet Him come forth our Perfect Morn,\nthe Word in God the Father One,\nthe Father perfect in the Son. Amen.",
      prayerType: "morning",
      category: "liturgical",
      language: "en",
      latin:
        "Splendor paternae gloriae,\nde luce lucem proferens,\nlux lucis et fons luminis,\ndiem dies illuminans.\n\nVerusque sol, illabere\nmicans nitore perpeti,\niubarque Sancti Spiritus\ninfunde nostris sensibus.\n\nVotis vocemus et Patrem,\nPatrem perennis gloriae,\nPatrem potentis gratiae,\nculpam releget lubricam.\n\nInformet actus strenuos,\ndentem retundat invidi,\ncasus secundet asperos,\ndonet gerendi gratiam.\n\nMentem gubernet et regat\ncasto, fideli corpore;\nfides calore ferveat,\nfraudis venena nesciat.\n\nChristusque nobis sit cibus,\npotusque noster sit fides;\nlaeti bibamus sobriam\nebrietatem Spiritus.\n\nLaetus dies hic transeat;\npudor sit ut diluculum,\nfides velut meridies,\ncrepusculum mens nesciat.\n\nAurora cursus provehit:\nAurora totus prodeat,\nin Patre totus Filius\net totus in Verbo Pater. Amen.",
      summary:
        "A morning hymn written by Saint Ambrose (340-397), addressed to Christ as the Light of the world and used at Lauds on Mondays in the Liturgy of the Hours. The English is the translation of Robert Bridges (1844-1930) from the Yattendon Hymnal (1899).",
      occasions: ["lauds", "morning", "monday"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/TempusPerAnnum/Splendor.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "verbum-supernum-prodiens",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/CorpusChristi/VerbumSup.html`],
    payload: {
      slug: "verbum-supernum-prodiens",
      title: "Verbum Supernum Prodiens (The heavenly Word proceeding forth)",
      body: "The heavenly Word proceeding forth,\nyet not leaving the Father's side,\nwent forth upon His work on earth\nand reached at length life's eventide.\n\nBy false disciple to be given\nto foemen for His Blood athirst,\nHimself, the living Bread from heaven,\nHe gave to His disciples first.\n\nTo them He gave, in twofold kind,\nHis very Flesh, His very Blood:\nof twofold substance man is made,\nand He of man would be the Food.\n\nBy birth our fellowman was He,\nour Food while seated at the board;\nHe died, our ransomer to be;\nHe ever reigns, our great reward.\n\nO saving Victim, opening wide\nthe gate of heaven to all below:\nour foes press on from every side;\nThine aid supply, Thy strength bestow.\n\nTo Thy great Name be endless praise,\nimmortal Godhead, One in Three!\nO grant us endless length of days\nin our true native land with Thee. Amen.",
      prayerType: "hymn",
      category: "eucharistic",
      language: "en",
      latin:
        "Verbum supernum prodiens,\nnec Patris linquens dexteram,\nad opus suum exiens,\nvenit ad vitae vesperam.\n\nIn mortem a discipulo\nsuis tradendus aemulis,\nprius in vitae ferculo\nse tradidit discipulis.\n\nQuibus sub bina specie\ncarnem dedit et sanguinem;\nut duplicis substantiae\ntotum cibaret hominem.\n\nSe nascens dedit socium,\nconvescens in edulium,\nse moriens in pretium,\nse regnans dat in praemium.\n\nO salutaris hostia,\nquae caeli pandis ostium,\nbella premunt hostilia;\nda robur, fer auxilium.\n\nUni trinoque Domino\nsit sempiterna gloria:\nqui vitam sine termino\nnobis donet in patria. Amen.",
      summary:
        "The hymn for Lauds on Corpus Christi, written by Saint Thomas Aquinas at the request of Pope Urban IV when the feast was established in 1264. Its last two stanzas form the Benediction hymn O Salutaris Hostia. The English draws on the translations of Neale, Caswall and others.",
      occasions: ["corpus-christi", "adoration", "benediction", "lauds"],
      relatedSaints: ["saint-thomas-aquinas"],
      citations: [`${TPL}Hymni/CorpusChristi/VerbumSup.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "blessing-before-a-journey",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Varia/Itinerarium.html`],
    payload: {
      slug: "blessing-before-a-journey",
      title: "Itinerarium (Blessing for a Journey)",
      body: "Ant. Into the way of peace.\n\nCanticle of Zachary (Benedictus)\n\nGlory be ....\n\nAnt. Into the way of peace and prosperity, may the almighty and merciful Lord lead us and may the Angel Raphael be with us along the way, that we may come to our home again in peace, and health, and gladness.\n\nLord, have mercy.\nChrist, have mercy.\nLord, have mercy.\n\nOur Father (silently as far as):\nV. And lead us not into temptation.\nR. But deliver us from evil.\n\nV. Save Thy servants.\nR. My God, who hope in Thee.\n\nV. O Lord, send us help from the sanctuary.\nR. And strengthen us out of Sion.\n\nV. Be unto us, O Lord, a tower of strength.\nR. In the face of the enemy.\n\nV. Let not the enemy prevail against us.\nR. Nor the son of iniquity have power to harm us.\n\nV. Blessed be the Lord daily.\nR. The God of our salvation maketh our way prosperous.\n\nV. Show us Thy ways, O Lord.\nR. And teach us Thy paths.\n\nV. O that our ways were directed.\nR. To keep Thy precepts.\n\nV. The crooked shall be made straight.\nR. And the rough ways plain.\n\nV. God has given His Angels charge over thee.\nR. That they may keep thee in all thy ways.\n\nV. O Lord, hear my prayer.\nR. And let my cry come unto Thee.\n\nV. The Lord be with you.\nR. And with thy spirit.\n\nLet us pray:\nO God, who madest the children of Israel to walk with dry feet through the midst of the sea, and who didst open unto the three wise men, by the guiding of a star, the way that led unto Thee, grant us good speed, and quietness: may thy holy Angel accompany us during our pilgrimage and in the end, may we attain the haven of eternal salvation.\n\nO God, who didst call Thy servant Abraham out of Ur of the Chaldees, and didst keep him from evil through all the ways of his pilgrimage, we beseech Thee, that it may please Thee to keep us Thy servants. Be Thou unto us, O Lord, a help when we go forward, a comfort by the way, a shadow from the heat, a covering from the rain and the cold, a chariot in weariness, a refuge in trouble, a staff in slippery paths, a haven in shipwreck Do Thou lead us, that we may happily come thither where we would be, and thereafter come again safe unto our own home.\n\nGraciously hear our supplications, O Lord, we beseech Thee, and order the goings of Thy servants in the safe path that leadeth unto salvation in Thee, that amidst all the manifold changes of this life's pilgrimage, Thy shield may never cease from us.\n\nGrant, we beseech Thee, O almighty God, that Thy family may fare onward in the path of salvation, and by giving heed to the preaching of the blessed Fore-runner John, may safely attain unto Him whom John preached, even our Lord Jesus Christ Thy Son, who liveth and reigneth with Thee, in the unity of the Holy Ghost, one God, world without end. R. Amen.\n\nV. Let us proceed in peace.\nR. In the name of the Lord.\nAmen.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "The Itinerarium of the Roman Breviary, the Church's order of prayer for those about to set out on a journey: the Benedictus with its antiphon, a series of versicles, and four collects asking the company of the Angel Raphael and a safe return home.",
      occasions: ["travel", "pilgrimage", "departure"],
      relatedSaints: [],
      citations: [`${TPL}Varia/Itinerarium.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "episcopal-blessing",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN}episcopal-blessing-347`],
    payload: {
      slug: "episcopal-blessing",
      title: "Episcopal Blessing",
      body: "V. The Lord be with you. / R. And also with you.\n\nV. Blessed be the name of the Lord. / R. Both now and forever.\n\nV. Our help is in the name of the Lord. / R. Who made heaven and earth.\n\nV. May almighty God bless you, + the Father, + and the Son, + and the Holy Spirit.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      latin:
        "V. Dominus Vobiscum. / R. Et cum spiritu tuo.\n\nV. Sit nomen Domini benedictum. / R. Ex hoc nunc et usque in saeculum\n\nV. Adjutorium nostrum in nomine Domini. / R. Qui fecit caelum et terram.\n\nV. Benedicat vos omnipotens Deus, + Pater, + et Filius, + et Spiritus Sanctus. / R. Amen:",
      summary:
        "The solemn form of blessing used by bishops in place of the simple priestly blessing, with its three versicles and the triple sign of the cross. The faithful answer Amen. The English is EWTN's, which still gives the superseded 1973 ICEL response “And also with you”; since 2011 the response at Mass is “And with your spirit”, as the Latin Et cum spiritu tuo has always read.",
      occasions: ["mass", "episcopal-visitation", "confirmation"],
      relatedSaints: [],
      citations: [`${EWTN}episcopal-blessing-347`],
    },
  },
];
