import type { CuratedEntry } from "../index";

const EWTN_DEVOTIONS = "https://www.ewtn.com/catholicism/devotions/";
const EWTN_TEACHINGS = "https://www.ewtn.com/catholicism/teachings/";
const CATHOLIC_ONLINE = "https://www.catholic.org/prayers/prayer.php?p=";
const PRECES = "https://www.preces-latinae.org/thesaurus/BVM/";

/**
 * Batch 3 of the curated prayer catalogue: the Marian prayers.
 *
 * Every body is the received public-domain English text copied character for
 * character from the cited page, with the page's own line breaks (fixed-width
 * wrapping in the older EWTN electronic texts is unwrapped, nothing else is
 * touched). Latin is taken only from a received liturgical source. Prayers the
 * plan listed whose only available page carried a typo, whose text duplicated
 * an entry already in the knowledge base, or whose text is under modern
 * copyright were left out rather than repaired or paraphrased.
 */
export const prayerBatch3: CuratedEntry[] = [
  {
    contentType: "PRAYER",
    slug: "alma-redemptoris-mater",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      `${EWTN_TEACHINGS}alma-redemptoris-mater-o-loving-mother-of-our-redeemer-12735`,
      `${PRECES}AlmaRed.html`,
    ],
    payload: {
      slug: "alma-redemptoris-mater",
      title: "Alma Redemptoris Mater (O Loving Mother of Our Redeemer)",
      body: "O loving Mother of our Redeemer, gate of heaven, star of the sea,\nHasten to aid thy fallen people who strive to rise once more.\nThou who brought forth thy holy Creator, all creation wond'ring,\nYet remainest ever Virgin, taking from Gabriel's lips\nthat joyful \"Hail!\": be merciful to us sinners.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      latin:
        "Alma Redemptoris Mater, quae pervia caeli\nPorta manes, et stella maris, succurre cadenti,\nSurgere qui curat, populo: tu quae genuisti,\nNatura mirante, tuum sanctum Genitorem,\nVirgo prius ac posterius, Gabrielis ab ore\nSumens illud Ave, peccatorum miserere.",
      summary:
        "One of the four seasonal Marian antiphons sung at the close of Compline, traditionally from the beginning of Advent until the Presentation on 2 February. It is generally ascribed to the eleventh-century monk Hermann Contractus; in the books it is followed by a seasonal versicle and collect, which change at Christmas Eve.",
      occasions: ["advent", "christmastide", "compline", "night-prayer"],
      relatedSaints: [],
      citations: [
        `${EWTN_TEACHINGS}alma-redemptoris-mater-o-loving-mother-of-our-redeemer-12735`,
        `${PRECES}AlmaRed.html`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ave-regina-caelorum",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      `${EWTN_TEACHINGS}ave-regina-caelorum-welcome-o-queen-of-heaven-12736`,
      `${PRECES}AveRegina.html`,
    ],
    payload: {
      slug: "ave-regina-caelorum",
      title: "Ave Regina Caelorum (Hail, O Queen of Heaven)",
      body: "Welcome, O Queen of Heaven.\nWelcome, O Lady of Angels\nHail! thou root, hail! thou gate\nFrom whom unto the world, a light has arisen:\n\nRejoice, O glorious Virgin,\nLovely beyond all others,\nFarewell, most beautiful maiden,\nAnd pray for us to Christ.\n\nV. Allow me to praise thee, O sacred Virgin.\nR. Against thy enemies give me strength.\n\nGrant unto us, O merciful God, a defense against our weakness, that we who remember the holy Mother of God, by the help of her intercession, may rise from our iniquities, through the same Christ our Lord. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      latin:
        "Ave, Regina caelorum,\nAve, Domina Angelorum:\nSalve, radix, salve, porta\nEx qua mundo lux est orta:\n\nGaude, Virgo gloriosa,\nSuper omnes speciosa,\nVale, o valde decora,\nEt pro nobis Christum exora.\n\nV. Dignare me laudare te, Virgo sacrata.\nR. Da mihi virtutem contra hostes tuos.\n\nOremus. Concede, misericors Deus, fragilitati nostrae praesidium: ut, qui sanctae Dei Genitricis memoriam agimus; intercessionis eius auxilio, a nostris iniquitatibus resurgamus. Per eundem Christum Dominum nostrum. Amen.",
      summary:
        "The Marian antiphon of Compline traditionally used from the Presentation on 2 February until Wednesday of Holy Week. It is an anonymous monastic text known from about the twelfth century, and is given here with its versicle, response and collect.",
      occasions: ["lent", "compline", "night-prayer", "february-2"],
      relatedSaints: [],
      citations: [
        `${EWTN_TEACHINGS}ave-regina-caelorum-welcome-o-queen-of-heaven-12736`,
        `${PRECES}AveRegina.html`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ave-maris-stella",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${PRECES}AveMarisStella.html`],
    payload: {
      slug: "ave-maris-stella",
      title: "Ave Maris Stella (Hail, O Star of the Ocean)",
      body: "Hail, O Star of the ocean,\nGod's own Mother blest,\never sinless Virgin,\ngate of heav'nly rest.\n\nTaking that sweet Ave,\nwhich from Gabriel came,\npeace confirm within us,\nchanging Eve's name.\n\nBreak the sinners' fetters,\nmake our blindness day,\nChase all evils from us,\nfor all blessings pray.\n\nShow thyself a Mother,\nmay the Word divine\nborn for us thine Infant\nhear our prayers through thine.\n\nVirgin all excelling,\nmildest of the mild,\nfree from guilt preserve us\nmeek and undefiled.\n\nKeep our life all spotless,\nmake our way secure\ntill we find in Jesus,\njoy for evermore.\n\nPraise to God the Father,\nhonor to the Son,\nin the Holy Spirit,\nbe the glory one. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      latin:
        "Ave maris stella,\nDei Mater alma,\natque semper Virgo,\nfelix caeli porta.\n\nSumens illud Ave\nGabrielis ore,\nfunda nos in pace,\nmutans Hevae nomen.\n\nSolve vincula reis,\nprofer lumen caecis\nmala nostra pelle,\nbona cuncta posce.\n\nMonstra te esse matrem:\nsumat per te preces,\nqui pro nobis natus,\ntulit esse tuus.\n\nVirgo singularis,\ninter omnes mitis,\nnos culpis solutos,\nmites fac et castos.\n\nVitam praesta puram,\niter para tutum:\nut videntes Iesum\nsemper collaetemur.\n\nSit laus Deo Patri,\nsummo Christo decus,\nSpiritui Sancto,\ntribus honor unus. Amen.",
      summary:
        "The Vespers hymn of the Blessed Virgin Mary, preserved in a ninth-century manuscript of St Gall and still sung at Vespers on Marian feasts and in the Little Office of the Blessed Virgin. The Latin is that of the Liturgia Horarum; the English is the traditional Breviary rendering.",
      occasions: ["vespers-of-mary", "marian-feasts", "office"],
      relatedSaints: [],
      citations: [`${PRECES}AveMarisStella.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "maria-mater-gratiae",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${PRECES}MariaGratia.html`, `${CATHOLIC_ONLINE}2006`],
    payload: {
      slug: "maria-mater-gratiae",
      title: "Maria, Mater Gratiae (Mary, Mother of Grace)",
      body: "Mary, Mother of Grace,\nMother of mercy,\nShield me from the enemy\nAnd receive me at the hour of my death.\nAmen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      latin:
        "Maria, Mater gratiae,\nMater misericordiae,\ntu me ab hoste protege\net hora mortis suscipe.\nAmen.",
      summary:
        "A short prayer from the Roman Ritual, taken from the second stanza of the hymn Memento, salutis Auctor, and commonly said at the close of the day. Catholic Online prints the same English without the closing Amen.",
      occasions: ["compline", "evening", "night-prayer"],
      relatedSaints: [],
      citations: [`${PRECES}MariaGratia.html`, `${CATHOLIC_ONLINE}2006`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "flos-carmeli",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${PRECES}FlosCarmeli.html`],
    payload: {
      slug: "flos-carmeli",
      title: "Flos Carmeli (Flower of Carmel)",
      body: "Flower of Carmel,\nTall vine blossom laden;\nSplendor of heaven,\nChildbearing yet maiden.\nNone equals thee.\n\nMother so tender,\nWho no man didst know,\nOn Carmel's children\nThy favors bestow.\nStar of the Sea.\n\nStrong stem of Jesse,\nWho bore one bright flower,\nBe ever near us\nAnd guard us each hour,\nwho serve thee here.\n\nPurest of lilies,\nThat flowers among thorns,\nBring help to the true heart\nThat in weakness turns\nand trusts in thee.\n\nStrongest of armor,\nWe trust in thy might:\nUnder thy mantle,\nHard press'd in the fight,\nwe call to thee.\n\nOur way uncertain,\nSurrounded by foes,\nUnfailing counsel\nYou give to those\nwho turn to thee.\n\nO gentle Mother\nWho in Carmel reigns,\nShare with your servants\nThat gladness you gained\nand now enjoy.\n\nHail, Gate of Heaven,\nWith glory now crowned,\nBring us to safety\nWhere thy Son is found,\ntrue joy to see.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      latin:
        "Flos Carmeli,\nvitis florigera,\nsplendor caeli,\nvirgo puerpera\nsingularis.\n\nMater mitis\nsed viri nescia\nCarmelitis\nesto propitia\nstella maris.\n\nRadix Iesse\ngerminans flosculum\nnos ad esse\ntecum in saeculum\npatiaris.\n\nInter spinas\nquae crescis lilium\nserva puras\nmentes fragilium\ntutelaris.\n\nArmatura\nfortis pugnantium\nfurunt bella\ntende praesidium\nscapularis.\n\nPer incerta\nprudens consilium\nper adversa\niuge solatium\nlargiaris.\n\nMater dulcis\nCarmeli domina,\nplebem tuam\nreple laetitia\nqua bearis.\n\nParadisi\nclavis et ianua,\nfac nos duci\nquo, Mater, gloria\ncoronaris. Amen",
      summary:
        "The Carmelite sequence for the feast of Our Lady of Mount Carmel, in use for that feast since 1663 and earlier as an antiphon and responsory in the order's office. Its composition is traditionally ascribed to Saint Simon Stock; the English translator is unknown.",
      occasions: ["july-16", "carmelite", "scapular"],
      relatedSaints: [],
      citations: [`${PRECES}FlosCarmeli.html`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "fatima-pardon-prayer",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}2313`],
    payload: {
      slug: "fatima-pardon-prayer",
      title: "Pardon Prayer of the Angel of Fatima",
      body: "O my God,\nI believe,\nI adore,\nI hope and I love Thee.\nI ask pardon for those who do not believe,\ndo not adore,\ndo not hope and do not love Thee.",
      prayerType: "act",
      category: "marian",
      language: "en",
      summary:
        "A short act of faith, hope and charity offered in reparation for those who do not believe, which Sister Lucia recorded in her memoirs as taught to the three children of Fatima by the Angel of Peace in 1916.",
      occasions: ["fatima", "reparation", "daily"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}2313`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "fatima-angel-prayer",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}245`],
    payload: {
      slug: "fatima-angel-prayer",
      title: "O Most Holy Trinity (Prayer of the Angel of Fatima)",
      body: "Most Holy Trinity - Father, Son, and Holy Spirit - I adore thee profoundly. I offer Thee the most precious Body, Blood, Soul and Divinity of Jesus Christ, present in all the tabernacles of the world, in reparation for the outrages, sacrileges and indifferences whereby He is offended. And through the infinite merits of His Most Sacred Heart and the Immaculate Heart of Mary, I beg of Thee the conversion of poor sinners.",
      prayerType: "act",
      category: "eucharistic",
      language: "en",
      summary:
        "The Eucharistic prayer of adoration and reparation which Sister Lucia's memoirs record the Angel of Peace teaching the children of Fatima in 1916, and which is widely prayed during Eucharistic adoration.",
      occasions: ["fatima", "adoration", "reparation"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}245`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "act-of-consecration-to-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      `${EWTN_DEVOTIONS}consecration-to-mary-345`,
      `${EWTN_DEVOTIONS}a-prayer-to-the-immaculate-heart-12764`,
    ],
    payload: {
      slug: "act-of-consecration-to-mary",
      title: "Consecration to Mary",
      body: "O Mary, Virgin most powerful and Mother of mercy, Queen of Heaven and Refuge of sinners, we consecrate ourselves to thine Immaculate Heart.\n\nWe consecrate to thee our very being and our whole life; all that we have, all that we love, all that we are. To thee we give our bodies, our hearts and our souls; to thee we give our homes, our families, our country.\n\nWe desire that all that is in us and around us may belong to thee, and may share in the benefits of thy motherly benediction. And that this act of consecration may be truly efficacious and lasting, we renew this day at thy feet the promises of our Baptism and our first Holy Communion.\n\nWe pledge ourselves to profess courageously and at all times the truths of our holy Faith, and to live as befits Catholics who are duly submissive to all the directions of the Pope and the Bishops in communion with him.\n\nWe pledge ourselves to keep the commandments of God and His Church, in particular to keep holy the Lord's Day.\n\nWe likewise pledge ourselves to make the consoling practices of the Christian religion, and above all, Holy Communion, an integral part of our lives, in so far as we shall be able so to do.\n\nFinally, we promise thee, O glorious Mother of God and loving Mother of men, to devote ourselves whole-heartedly to the service of thy blessed cult, in order to hasten and assure, through the sovereignty of thine Immaculate Heart, the coming of the kingdom of the Sacred Heart of thine adorable Son, in our own hearts and in those of all men, in our country and in all the world, as in heaven. so on earth. Amen.",
      prayerType: "consecration",
      category: "consecration",
      language: "en",
      summary:
        "An act by which a person, a family or a community gives itself entirely to the Immaculate Heart of Mary, renewing the promises of Baptism and pledging fidelity to the faith and the commandments. EWTN prints the same text under a second title, A Prayer to the Immaculate Heart.",
      occasions: ["marian-consecration", "may", "october", "first-saturday"],
      relatedSaints: [],
      citations: [
        `${EWTN_DEVOTIONS}consecration-to-mary-345`,
        `${EWTN_DEVOTIONS}a-prayer-to-the-immaculate-heart-12764`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "act-of-consecration-to-the-immaculate-heart",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      `${EWTN_DEVOTIONS}solemn-act-of-consecration-to-the-immaculate-heart-of-mary-12729`,
    ],
    payload: {
      slug: "act-of-consecration-to-the-immaculate-heart",
      title: "A Solemn Act of Consecration to the Immaculate Heart of Mary",
      body: "Most Holy Virgin Mary, tender Mother of men, to fulfill the desires of the Sacred Heart of Jesus and the request of the Vicar of Your Son on earth, we consecrate ourselves and our families to your Sorrowful and Immaculate Heart, O Queen of the Most Holy Rosary, and we recommend to You, all the people of our country and all the world.\n\nPlease accept our consecration, dearest Mother, and use us as You wish to accomplish Your designs in the world.\n\nO Sorrowful and Immaculate Heart of Mary, Queen of the Most Holy Rosary, and Queen of the World, rule over us, together with the Sacred Heart of Jesus Christ, Our King. Save us from the spreading flood of modern paganism; kindle in our hearts and homes the love of purity, the practice of a virtuous life, an ardent zeal for souls, and a desire to pray the Rosary more faithfully.\n\nWe come with confidence to You, O Throne of Grace and Mother of Fair Love. Inflame us with the same Divine Fire which has inflamed Your own Sorrowful and Immaculate Heart. Make our hearts and homes Your shrine, and through us, make the Heart of Jesus, together with your rule, triumph in every heart and home.\n\nAmen.",
      prayerType: "consecration",
      category: "consecration",
      language: "en",
      summary:
        "A solemn form of the consecration of self, family and nation to the Sorrowful and Immaculate Heart of Mary, commonly used on the First Saturdays and on the memorial of the Immaculate Heart.",
      occasions: ["first-saturday", "immaculate-heart", "marian-consecration"],
      relatedSaints: [],
      citations: [
        `${EWTN_DEVOTIONS}solemn-act-of-consecration-to-the-immaculate-heart-of-mary-12729`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-of-guadalupe",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN_DEVOTIONS}prayer-to-our-lady-of-guadalupe-333`],
    payload: {
      slug: "prayer-to-our-lady-of-guadalupe",
      title: "A Prayer to Our Lady of Guadalupe",
      body: "Our Lady of Guadalupe,\nMystical Rose,\nmake intercession for holy Church,\nprotect the sovereign Pontiff,\nhelp all those who invoke you in their necessities,\nand since you are the ever Virgin Mary\nand Mother of the true God,\nobtain for us from your most holy Son\nthe grace of keeping our faith,\nof sweet hope in the midst of the bitterness of life\nof burning charity, and the precious gift\nof final perseverance.\n\nAmen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The traditional prayer to Our Lady of Guadalupe, who appeared to Saint Juan Diego at Tepeyac in 1531 and is honoured as Patroness of the Americas. It asks her intercession for the Church, the Pope and the gift of final perseverance.",
      occasions: ["december-12", "americas"],
      relatedSaints: ["saint-juan-diego"],
      citations: [`${EWTN_DEVOTIONS}prayer-to-our-lady-of-guadalupe-333`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-of-perpetual-help",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN_DEVOTIONS}our-lady-of-perpetual-help-354`],
    payload: {
      slug: "prayer-to-our-lady-of-perpetual-help",
      title: "Prayer to Our Lady of Perpetual Help",
      body: "O Mother of Perpetual Help, grant that I may ever invoke thy most powerful name, which is the safeguard of the living and the salvation of the dying. O Purest Mary, O Sweetest Mary, let thy name henceforth be ever on my lips. Delay not, O Blessed Lady, to help me whenever I call on thee, for, in all my needs, in all my temptations I shall never cease to call on thee, ever repeating thy sacred name, Mary, Mary.\n\nO what consolation, what sweetness, what confidence, what emotion fill my soul when I pronounce thy sacred name, or even only think of thee. I thank God for having given thee, for my good, so sweet, so powerful, so lovely a name. But I will not be content with merely pronouncing thy name: let my love for thee prompt me ever to hail thee, Mother of Perpetual Help.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A prayer of confidence in the name of Mary under her title of Perpetual Help, the Byzantine icon entrusted by Pope Pius IX to the Redemptorists in 1866. Longer devotional forms of this prayer, drawn from Saint Alphonsus Liguori, are also in use.",
      occasions: ["wednesdays", "june-27", "novena"],
      relatedSaints: [],
      citations: [`${EWTN_DEVOTIONS}our-lady-of-perpetual-help-354`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-in-honor-of-the-immaculate-conception",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN_DEVOTIONS}prayer-in-honor-of-the-immaculate-conception-331`],
    payload: {
      slug: "prayer-in-honor-of-the-immaculate-conception",
      title: "A Prayer in Honor of the Immaculate Conception",
      body: "ANT. This is the rod in which was neither knot of original sin, nor rind of actual guilt.\n\nV. In thy conception, O Virgin! Thou wast immaculate.\n\nR. Pray for us to the Father, Whose Son thou didst bring forth.\n\nLet us Pray\n\nO GOD, Who, by the Immaculate Conception of the Virgin, didst prepare a worthy habitation for Thy Son, we beseech Thee, that as by the foreseen death of that same Son, Thou didst preserve her from all stain, so too thou wouldst permit us, purified through her intercession, to come unto Thee. Through the same Christ our Lord. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The antiphon, versicle and collect honouring the Immaculate Conception of the Blessed Virgin Mary, the dogma defined by Blessed Pope Pius IX in 1854 and kept as a solemnity on 8 December.",
      occasions: ["december-8", "immaculate-conception"],
      relatedSaints: [],
      citations: [`${EWTN_DEVOTIONS}prayer-in-honor-of-the-immaculate-conception-331`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-immaculate",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      `${EWTN_DEVOTIONS}prayer-in-honor-of-the-immaculate-conception-331`,
      `${CATHOLIC_ONLINE}318`,
    ],
    payload: {
      slug: "prayer-to-our-lady-immaculate",
      title: "Prayer to Our Lady Immaculate",
      body: "Most holy Virgin, who wast pleasing to the Lord and became His Mother, immaculate in body and spirit, in faith and in love, look kindly on the wretched who implore thy powerful patronage. The wicked serpent, against whom was hurled the first curse, continues fiercely to attack and ensnare the unhappy children of Eve. Do thou, then, O Blessed Mother, our queen and advocate, who from the first instant of thy conception didst crush the head of the enemy, receive the prayers which, united with thee in our single heart, we implore thee to present at the throne of God, that we may never fall into the snares which are laid out for us, and may all arrive at the port of salvation; and, in so many dangers, may the Church and Christian society sing once again the hymn of deliverance and of victory and of peace. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A prayer for the Church and for perseverance addressed to Mary Immaculate, who from the first instant of her conception was preserved from sin. EWTN and Catholic Online print the text identically.",
      occasions: ["december-8", "immaculate-conception", "daily"],
      relatedSaints: [],
      citations: [
        `${EWTN_DEVOTIONS}prayer-in-honor-of-the-immaculate-conception-331`,
        `${CATHOLIC_ONLINE}318`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-immaculate-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}309`],
    payload: {
      slug: "prayer-to-immaculate-mary",
      title: "Immaculate Mary (The Lourdes Hymn)",
      body: "Immaculate Mary, your praises we sing\nWho reigns now with Christ, our Redeemer and King.\nAve, Ave, Ave, Maria!\nAve, Ave, Ave, Maria!\n\nIn heaven the blessed your glory proclaim\nOn earth we, your children, invoke your fair name.\nAve, Ave, Ave, Maria!\nAve, Ave, Ave, Maria!",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The hymn sung at Lourdes and in Marian processions, whose refrain repeats the angel's greeting. Catholic Online prints these two verses; many more verses exist in the various English versions.",
      occasions: ["december-8", "february-11", "may", "procession"],
      relatedSaints: ["saint-bernadette-soubirous"],
      citations: [`${CATHOLIC_ONLINE}309`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-of-lourdes-traditional",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}2224`],
    payload: {
      slug: "prayer-to-our-lady-of-lourdes-traditional",
      title: "Prayer to Our Lady of Lourdes",
      body: "O Immaculate Virgin Mary,\nMother of Mercy,\nyou are the refuge of sinners,\nthe health of the sick,\nand the comfort of the afflicted.\nYou know my wants,\nmy troubles, my sufferings.\nBy your appearance at the Grotto of Lourdes\nyou made it a privileged sanctuary\nwhere your favors are given to people\nstreaming to it from the whole world.\nOver the years countless sufferers\nhave obtained the cure for their infirmities -\nwhether of soul, mind, or body.\nTherefore I come to you\nwith limitless confidence\nto implore your motherly intercession.\nObtain, O loving Mother,\nthe grant of my requests.\nThrough gratitude for Your favors,\nI will endeavor to imitate Your virtues,\nthat I may one day share in Your glory.\n\nAmen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The prayer of pilgrims to Our Lady of Lourdes, who appeared to Saint Bernadette Soubirous at the grotto of Massabielle in 1858 and named herself the Immaculate Conception.",
      occasions: ["february-11", "sickness", "pilgrimage"],
      relatedSaints: ["saint-bernadette-soubirous"],
      citations: [`${CATHOLIC_ONLINE}2224`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "childrens-prayer-to-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN_DEVOTIONS}childrens-prayer-to-mary-341`],
    payload: {
      slug: "childrens-prayer-to-mary",
      title: "Children's Prayer to Mary",
      body: "Dear Mother of Jesus,\nlook down upon me\nAs I say my prayers slowly\nat my mother's knee.\n\nI love thee, O Lady\nand please willest thou bring\nAll little children\nTo Jesus our King.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A simple rhymed prayer for children to say to the Blessed Virgin Mary at bedtime, asking her to bring all little children to her Son.",
      occasions: ["children", "bedtime", "evening"],
      relatedSaints: [],
      citations: [`${EWTN_DEVOTIONS}childrens-prayer-to-mary-341`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "don-bosco-prayer-to-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN_DEVOTIONS}don-boscos-prayer-to-mary-12741`],
    payload: {
      slug: "don-bosco-prayer-to-mary",
      title: "Don Bosco's Prayer to Mary, Help of Christians",
      body: "Most Holy Virgin Mary, Help of Christians,\nhow sweet it is to come to your feet\nimploring your perpetual help.\nIf earthly mothers cease not to remember their children,\nhow can you, the most loving of all mothers forget me?\nGrant then to me, I implore you,\nyour perpetual help in all my necessities,\nin every sorrow, and especially in all my temptations.\nI ask for your unceasing help for all who are now suffering.\nHelp the weak, cure the sick, convert sinners.\nGrant through your intercessions many vocations to the religious life.\nObtain for us, O Mary, Help of Christians,\nthat having invoked you on earth we may love and eternally thank you in heaven.",
      prayerType: "marian",
      category: "saintly",
      language: "en",
      summary:
        "The prayer of Saint John Bosco to Our Lady under the title Help of Christians, whose feast is kept on 24 May and to whom he dedicated the basilica he built in Turin. It asks her help in temptation and vocations for the Church.",
      occasions: ["january-31", "may-24", "vocations"],
      relatedSaints: ["saint-john-bosco"],
      citations: [`${EWTN_DEVOTIONS}don-boscos-prayer-to-mary-12741`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-mary-mother-of-grace",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}312`],
    payload: {
      slug: "prayer-to-mary-mother-of-grace",
      title: "Prayer to Mary, Mother of Grace",
      body: "It becomes you to be mindful of us, as you stand near him who granted you all graces, for you are the Mother of God and our Queen. Help us for the sake of the King, the Lord God and Master who was born of you. For this reason, you are called full of grace. Remember us, most holy Virgin, and bestow on us gifts from the riches of your graces, Virgin full of graces.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A short prayer asking the Mother of God to remember us and to share with us the riches of the grace she received, printed by Catholic Online under the name of Saint Athanasius.",
      occasions: ["daily"],
      relatedSaints: ["saint-athanasius"],
      citations: [`${CATHOLIC_ONLINE}312`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-mother-of-mercy",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}904`],
    payload: {
      slug: "prayer-to-our-lady-mother-of-mercy",
      title: "Prayer to Our Lady of Mercy",
      body: "Blessed Virgin Mary,\nwho can worthily repay you with praise\nand thanks for having rescued a fallen world\nby your generous consent!\nReceive our gratitude,\nand by your prayers obtain the pardon of our sins.\nTake our prayers into the sanctuary of heaven\nand enable them to make our peace with God.\n\nHoly Mary, help the miserable,\nstrengthen the discouraged,\ncomfort the sorrowful,\npray for your people,\nplead for the clergy,\nintercede for all women consecrated to God.\nMay all who venerate you\nfeel now your help and protection.\nBe ready to help us when we pray,\nand bring back to us the answers to our prayers.\nMake it your continual concern\nto pray for the people of God,\nfor you were blessed by God\nand were made worthy to bear the Redeemer of the world,\nwho lives and reigns forever.\n\nAmen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A prayer of thanksgiving and petition to the Mother of Mercy, printed by Catholic Online under the name of Saint Augustine of Hippo, asking her intercession for sinners, for the clergy and for consecrated women.",
      occasions: ["daily", "september-24"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: [`${CATHOLIC_ONLINE}904`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "seven-sorrows-of-mary-prayer",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN_TEACHINGS}prayer-of-st-alphonus-de-liguori-to-the-sorrowful-mother-12740`],
    payload: {
      slug: "seven-sorrows-of-mary-prayer",
      title: "Prayer to the Sorrowful Mother (Saint Alphonsus Liguori)",
      body: 'O my afflicted Mother! Queen of martyrs and of sorrows, thou didst so bitterly weep over thy Son, who died for my salvation; but what will thy tears avail me if I am lost? By the merit, then, of thy sorrows, obtain me true contrition for my sins, and a real amendment of life, together with constant and tender compassion for the sufferings of Jesus and thy dolours. And if Jesus and thou, being so innocent, have suffered so much for love of me, obtain that at least I, who am deserving of hell, may suffer something for your love. "O Lady," will I say with St. Bonaventure, "if I have offended thee, in justice wound my heart; if I have served thee, I now ask wounds for my reward. It is shameful to me to see my Lord Jesus wounded, and thee wounded with Him, and myself without a wound." In fine, O my Mother, by the grief thou didst experience in seeing thy Son bow down His head and expire on the cross in the midst of so many torments, I beseech thee to obtain me a good death. Ah, cease not, O advocate of sinners, to assist my afflicted soul in the midst of the combats in which it will have to engage on its great passage from time to eternity. And as it is probable that I may then have lost my speech, and strength to invoke thy name and that of Jesus, who are all my hope, I do so now; I invoke thy Son and thee to succour me in that last moment; and I say, Jesus and Mary, to you I commend my soul. Amen.',
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A prayer to Our Lady of Sorrows from the ninth discourse, Of the Dolours of Mary, in Saint Alphonsus Liguori's The Glories of Mary, asking through her sorrows for contrition, amendment of life and a good death.",
      occasions: ["september-15", "lent", "fridays"],
      relatedSaints: ["saint-alphonsus-liguori", "saint-bonaventure"],
      citations: [
        `${EWTN_TEACHINGS}prayer-of-st-alphonus-de-liguori-to-the-sorrowful-mother-12740`,
      ],
    },
  },
];
