import type { CuratedEntry } from "../index";

const TPL = "https://www.preces-latinae.org/thesaurus/";
const BRITT = "https://archive.org/details/hymnsofbreviarym00britrich/page/";
const DRBO = "https://www.drbo.org/chapter/";
const DR_1899 = "https://archive.org/details/holybibletransla00denv/page/";

/**
 * Batch 11 of the curated prayer catalogue: hymns of the Roman Breviary and the
 * Liturgy of the Hours with their Latin, in public-domain English translations,
 * followed by the Douay-Rheims canticles and prayers of Scripture.
 *
 * For the hymns, every body and every `latin` value is copied from the first
 * cited page (the Thesaurus Precum Latinarum, preces-latinae.org), which prints
 * the Latin and the English side by side. Only pages whose English that site attributes to a
 * translator published before 1929 were used: Edward Caswall, John Mason
 * Neale, Saint John Henry Newman, William John Copeland, John David Chambers,
 * Joseph William Chadwick, George Herbert Palmer, John Julian, William John
 * Courthope, Denis Florence MacCarthy, an anonymous version of 1854, and Alan
 * G. McDougall, whose translations were printed in Matthew Britt's The Hymns
 * of the Breviary and Missal (New York and London, 1922). Pages whose English
 * is the site compiler's own, unattributed, or not known to have been published
 * before 1929 were left out, and so were pages whose English, set beside the
 * attributed translation, turned out to carry a substituted stanza or doxology.
 *
 * Each English text was compared line by line with Britt's 1922 printing of
 * the same translation, cited second. The site modernises spelling (Saviour,
 * honour, ris'n become Savior, honor, risen); that is kept. A handful of plain
 * transcription slips on the site were corrected against Britt and are listed
 * here rather than made silently: Aeterne rerum conditor ("pilgrim'" for
 * "pilgrim's", "faith to fallen" for "faith to the fallen", "Look in us" for
 * "Look on us"), Consors paterni luminis ("and us Thy praises" for "and as"),
 * Immense caeli conditor ("madist", "heavinly"), Rerum Creator optime ("the rest
 * that in not Thine"), Tu, Trinitatis Unitas (a stray full stop after
 * "course"), Iesu, Rex admirabilis ("out lives" for "our lives"), Iam lucis orto
 * sidere ("the praises that is" for "the praise that is", and a stray "|"),
 * and Stabat Mater speciosa (a stray comma after the opening "By"). Purely
 * typographic matters are normalised: the opening words the site sets in red
 * capitals are given in sentence case, footnote markers are dropped, hyphens
 * standing for dashes are printed as dashes, and editorial placeholders (a "-"
 * for a stanza the translator did not render, a bracketed note in place of a
 * missing Latin stanza) are not reproduced; each summary says when the English
 * and the Latin do not answer stanza for stanza.
 *
 * Most of the Latin here is the Liturgia Horarum text, which restored the
 * ancient wording, while several translations were made from the Roman
 * Breviary as revised under Pope Urban VIII in 1632; where that matters the
 * summary says so. Summaries are editorial and make no claim to be part of the
 * hymn.
 *
 * The second group is the Old and New Testament canticles of the Liturgy of
 * the Hours not already in prayers/batch-7.ts, with a few other prayers of
 * Scripture (Solomon's prayer for wisdom, the prayers of Azarias, Daniel,
 * Esther, Tobias and Sara, the prayer of Jeremias in Lamentations 5, and the
 * prayer of Jesus in John 17). Their text is the Douay-Rheims (Challoner, 1899
 * American edition), copied verse for verse from the cited drbo.org chapter
 * with one verse to a line, as in batch-7. Each passage is given whole and
 * continuous, so where the Liturgy of the Hours sings only some verses the
 * summary says which. No Latin is given for these: drbo.org prints the English
 * alone. Three slips in that online text were checked against the 1899
 * Benziger printing on archive.org (cited third) and corrected there: Isaias
 * 26:1 drops "in" ("be sung the land of Juda"), Isaias 42:14 repeats a word
 * ("I have I kept silence"), and John 17:11 reads "thou has given" for "thou
 * hast given". Its other readings, including its modern "choir" for the 1899
 * "quire" (Lamentations 5:14), are kept as the page prints them.
 *
 * The third group comes straight from Britt's The Hymns of the Breviary and
 * Missal (1922) on archive.org, which prints the Roman Breviary and Missal
 * Latin beside each English version; the first cited page is the page where
 * the hymn begins. Latin and English were transcribed from the page images:
 * the book's ligatures (æ, œ), its j, its accented "blessèd" and "Learnèd" and
 * the translators' own spelling are kept as printed, the opening word the book
 * sets in capitals is given in sentence case, lines broken only by the narrow
 * column are rejoined, and stanza numbers are left out. Plain misprints in
 * the book's Latin are corrected rather than reproduced: "Reconsiliavit" for
 * "Reconciliavit" in Victimae Paschali, "per litum" for "perditum" in Caelestis
 * aulae Nuntius, and a full stop for the comma after "gloria" in the doxology
 * of O Lux beata caelitum. Every translation in this group was in print by
 * 1922, which is the public-domain basis for those whose translators lived on
 * into the twentieth century (Hugh T. Henry, Alan G. McDougall, Athelstan
 * Riley, the Benedictines of Stanbrook, Daniel J. Donahoe, Father Wallace,
 * O.S.B.).
 *
 * The Britt entries from Adeste, fideles onward follow the same method. A few
 * of them are hymns Britt prints that are not in the Breviary or Missal
 * (Adeste, fideles; O Deus, ego amo te), that belonged to an office granted by
 * special concession (Quicumque certum quaeritis, Summi Parentis Filio), or
 * that had been dropped from the latest Breviary of his day (the hymns of the
 * Seven Holy Founders other than Matris sub almae); each summary says so.
 * Britt's abbreviation of the refrain of Adeste, fideles ("O come, etc.") is
 * kept as printed. Where the Breviary sings the parts of one long hymn at
 * different Hours (Saint Martina's hymn, the Paschal hymn of the Apostles),
 * each part is its own entry, as Britt numbers them.
 */
export const prayerBatch11: CuratedEntry[] = [
  {
    contentType: "PRAYER",
    slug: "aeterna-caeli-gloria",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/AeternaCaeli.html`, `${BRITT}68/mode/1up`],
    payload: {
      slug: "aeterna-caeli-gloria",
      title: "Aeterna caeli gloria (O Christ, whose glory fills the heaven)",
      body: "O Christ, whose glory fills the heaven,\nour only hope, in mercy given;\nChild of a Virgin meek and pure;\nSon of the Highest evermore:\n\nGrant us Thine aid Thy praise to sing,\nas opening days new duties bring;\nthat with the light our life may be\nrenewed and sanctified by Thee.\n\nThe morning star fades from the sky,\nthe sun breaks forth; night's shadows fly:\nO Thou, true Light, upon us shine:\nour darkness turn to light divine.\n\nWithin us grant Thy light to dwell:\nand from our souls dark sins expel;\nCleanse Thou our minds from stain of ill,\nand with Thy peace our bosoms fill.\n\nTo us strong faith forever give,\nwith joyous hope, in Thee to live;\nThat life's rough way may ever be\nmade strong and pure by charity.\n\nAll laud to God the Father be;\nAll praise, Eternal Son, to Thee;\nAll glory, as is ever meet,\nto God the Holy Paraclete.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Aeterna caeli gloria,\nbeata spes mortalium,\ncelsi Parentis Unice,\ncastaeque proles Virginis:\n\nDa dexteram surgentibus,\nexsurgat et mens sobria.\nflagrans et in laudem Dei\ngrates rependat debitas.\n\nOrtus refulget lucifer,\nipsamque lucem nuntiat,\ncadit caligo noctium,\nlux sancta nos illuminet.\n\nManensque nostris sensibus\nnoctem repellat saeculi\nomnique fine temporis\npurgata servet pectora.\n\nQuaesita iam primum fides\nradicet altis sensibus,\nsecunda spes congaudeat,\ntunc maior exstat caritas.\n\nSit, Christe, rex piissime,\ntibi Patrique gloria,\ncum Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "An anonymous Ambrosian hymn of the fifth century, sung at Lauds on Fridays in the Roman Breviary and kept in the Liturgy of the Hours for Friday Morning Prayer in Ordinary Time. It greets Christ as the morning star and asks that faith, hope and charity may take root for the day ahead. The English is the translation of John Julian (1839-1913).",
      occasions: ["lauds", "friday", "morning", "ordinary-time"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/TempusPerAnnum/AeternaCaeli.html`, `${BRITT}68/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "aeterne-rerum-conditor",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/AeterneRerum.html`, `${BRITT}49/mode/1up`],
    payload: {
      slug: "aeterne-rerum-conditor",
      title: "Aeterne rerum conditor (Maker of all, eternal King)",
      body: "Maker of all, eternal King,\nwho day and night about dost bring:\nwho weary mortals to relieve,\ndost in their times the seasons give:\n\nNow the shrill cock proclaims the day,\nand calls the sun's awakening ray,\nthe wandering pilgrim's guiding light,\nthat marks the watches night by night.\n\nRoused at the note, the morning star\nheaven's dusky veil uplifts afar:\nnight's vagrant bands no longer roam,\nbut from their dark ways hie them home.\n\nThe encouraged sailor's fears are o'er,\nthe foaming billows rage no more:\nLo! e'en the very Church's Rock\nmelts at the crowing of the cock.\n\nO let us then like men arise;\nthe cock rebukes our slumbering eyes,\nbestirs who still in sleep would lie,\nand shames who would their Lord deny.\n\nNew hope his clarion note awakes,\nsickness the feeble frame forsakes,\nthe robber sheathes his lawless sword,\nfaith to the fallen is restored.\n\nLook on us, Jesu, when we fall,\nand with Thy look our souls recall:\nif Thou but look, our sins are gone,\nand with due tears our pardon won.\n\nShed through our hearts Thy piercing ray,\nour soul's dull slumber drive away:\nThy Name be first on every tongue,\nto Thee our earliest praises sung.\n\nAll laud to God the Father be;\nall praise, Eternal Son, to Thee;\nall glory, as is ever meet,\nto God the Holy Paraclete. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Aeterne rerum conditor,\nnoctem diemque qui regis,\net temporum das tempora,\nut alleves fastidium;\n\nPraeco diei iam sonat,\nnoctis profundae pervigil,\nnocturna lux viantibus\na nocte noctem segregans.\n\nHoc excitatus lucifer\nsolvit polum caligine,\nhoc omnis erronum chorus\nvias nocendi deserit.\n\nHoc nauta vires colligit\npontique mitescunt freta,\nhoc ipsa petra ecclesiae\ncanente culpam diluit.\n\nSurgamus ergo strenue!\nGallus iacentes excitat,\net somnolentos increpat,\nGallus negantes arguit.\n\nGallo canente spes redit,\naegris salus refunditur,\nmucro latronis conditur,\nlapsis fides revertitur.\n\nIesu, labantes respice,\net nos videndo corrige,\nsi respicis, lapsus cadunt,\nfletuque culpa solvitur.\n\nTu lux refulge sensibus,\nmentisque somnum discute,\nte nostra vox primum sonet\net ore psallamus tibi.\n\nSit, Christe, Rex piissime,\ntibi Patrique gloria\ncum Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "Saint Ambrose's hymn of cock-crow at the end of night: the herald of the day wakes the sleeper, calms the sailor and recalls Peter, who wept when the cock crowed. It was the Sunday Lauds hymn of the Roman Breviary after Epiphany and in the autumn weeks, and the Liturgy of the Hours sings it at Sunday Morning Prayer in Ordinary Time. The English is the translation of William John Copeland (1804-1885) in the form printed in The Hymner.",
      occasions: ["lauds", "sunday", "morning", "ordinary-time"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/TempusPerAnnum/AeterneRerum.html`, `${BRITT}49/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "aurora-iam-spargit-polum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/AuroraIam.html`, `${BRITT}71/mode/1up`],
    payload: {
      slug: "aurora-iam-spargit-polum",
      title: "Aurora iam spargit polum (The dawn is sprinkling in the east)",
      body: "The dawn is sprinkling in the east\nits golden shower, as day flows in;\nfast mount the pointed shafts of light:\nfarewell to darkness and to sin!\n\nAway, ye midnight phantoms all!\nAway, despondence and despair!\nWhatever guilt the night has brought\nnow let it vanish into air.\n\nSo, Lord, when that last morning breaks,\nlooking to which we sigh and pray,\nO may it to Thy minstrels prove\nthe dawning of a better day.\n\nTo God the Father glory be,\nand to His sole-begotten Son;\nGlory, O Holy Ghost, to Thee,\nwhile everlasting ages run. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Aurora iam spargit polum:\nterris dies illabitur:\nlucis resultat spiculum:\ndiscedat omne lubricum.\n\nIam vana noctis decidant,\nmentis reatus subruat,\nquicquid tenebris horridum\nnox attulit culpae, cadat.\n\nUt mane illud ultimum\nquod praestolamur cernui,\nin lucem nobis effluat,\ndum hoc canore concrepat.\n\nDeo Patri sit gloria,\neiusque soli Filio,\ncum Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "A dawn hymn of the Ambrosian school, sung at Saturday Lauds in the Roman Breviary and at Saturday Morning Prayer in the Liturgy of the Hours, which turns the coming of daylight into a prayer that the last morning of all may dawn as a better day. The English is the translation of Edward Caswall (1814-1878), made from the Breviary text as revised in 1632; the Latin printed with it is the Liturgia Horarum text.",
      occasions: ["lauds", "saturday", "morning", "ordinary-time"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/TempusPerAnnum/AuroraIam.html`, `${BRITT}71/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "caeli-deus-sanctissime",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/CaeliDeus.html`, `${BRITT}79/mode/1up`],
    payload: {
      slug: "caeli-deus-sanctissime",
      title: "Caeli Deus sanctissime (O God, whose hand hath spread the sky)",
      body: "O God, whose hand hath spread the sky,\nand all its shining hosts on high,\nand painting it with fiery light,\nmade it so beauteous and so bright:\n\nThou, when the fourth day was begun,\ndidst frame the circle of the sun,\nand set the moon for ordered change,\nand planets for their wider range:\n\nTo night and day, by certain line,\ntheir varying bounds Thou didst assign;\nand gav'st a signal, known and meet,\nfor months begun and months complete.\n\nEnlighten Thou the hearts of men:\npolluted souls make pure again:\nunloose the bands of guilt within:\nremove the burden of our sin.\n\nGrant this, O Father, ever One\nwith Christ, Thy sole-begotten Son,\nWhom, with the Spirit we adore,\none God, both now and evermore.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Caeli Deus sanctissime,\nqui lucidum centrum poli\ncandore pingis igneo\naugens decori lumine.\n\nQuarto die qui flammeam\nsolis rotam constituens,\nlunae ministras ordini,\nvagos recursus siderum,\n\nUt noctibus, vel lumini\ndiremptionis terminum,\nprimordiis et mensium\nsignum dares notissimum:\n\nIllumina cor hominum,\nabsterge sordes mentium,\nresolve culpae vinculum,\neverte moles criminum.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum.",
      summary:
        "The Wednesday Vespers hymn of the Roman Office, attributed to Pope Saint Gregory the Great. It recalls the fourth day of creation, when God set the sun, the moon and the stars in the sky (Genesis 1:14-19), and asks the same God to enlighten the hearts of men and loose the bonds of sin. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["vespers", "wednesday", "evening", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/CaeliDeus.html`, `${BRITT}79/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "consors-paterni-luminis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/Consors.html`, `${BRITT}58/mode/1up`],
    payload: {
      slug: "consors-paterni-luminis",
      title: "Consors paterni luminis (O Light of Light, O Dayspring bright)",
      body: "O light of light,\nO Dayspring bright,\ncoequal in Thy Father's light:\nassist us, as with prayer and psalm\nThy servants break the nightly calm.\n\nAll darkness from our minds dispel,\nand turn to flight the hosts of Hell:\nbid sleepfulness our eyelids fly,\nlest overwhelmed in sloth we lie.\n\nJesu, Thy pardon, kind and free,\nbestow on us who trust in Thee:\nand as Thy praises we declare,\nO with acceptance hear our prayer.\n\nO Father, that we ask be done,\nthrough Jesus Christ, Thine only Son,\nWho, with the Holy Ghost and Thee,\ndoth live and reign eternally.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Consors paterni luminis,\nlux ipse lucis et dies,\nnoctem canendo rumpimus:\nassiste postulantibus.\n\nAufer tenebras mentium,\nfuga catervas daemonum,\nexpelle somnolentiam\nne pigritantes obruat.\n\nSic, Christe, nobis omnibus\nindulgeas credentibus,\nut prosit exorantibus\nquod praecinentes psallimus.\n\nSit, Christe, rex piissime,\ntibi Patrique gloria\ncum Spiritu Paraclito\nin sempiterna saecula. Amen.",
      summary:
        "A night-office hymn attributed to Saint Ambrose, sung at Tuesday Matins in the Roman Breviary and in the Office of Readings on Tuesdays in Ordinary Time. It asks Christ, the Light of Light, to scatter the darkness of the mind and drive off sloth while his servants keep vigil in prayer. The English is the translation of Joseph William Chadwick (1841-1882) and John David Chambers (1805-1893); it renders the Breviary's closing doxology, Praesta, Pater piissime, rather than the Sit, Christe printed with the Latin here.",
      occasions: ["office-of-readings", "tuesday", "ordinary-time"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/TempusPerAnnum/Consors.html`, `${BRITT}58/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "immense-caeli-conditor",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/Immense.html`, `${BRITT}75/mode/1up`],
    payload: {
      slug: "immense-caeli-conditor",
      title: "Immense caeli conditor (O great Creator of the sky)",
      body: "O great creator of the sky,\nWho wouldest not the floods on high\nwith earthly water to confound,\nbut madest the firmament their bound;\n\nThe floods above Thou didst ordain;\nthe floods below Thou didst restrain:\nthat moisture might attemper heat,\nlest the parched earth should ruin meet.\n\nUpon our souls, good Lord, bestow\nThy gift of grace in endless flow:\nlest some renewed deceit or wile\nof former sin should us beguile.\n\nLet faith discover heavenly light;\nso shall its rays direct us right:\nand let this faith each error chase,\nand never give to falsehood place.\n\nGrant this, O Father, ever One\nwith Christ, Thy sole-begotten Son,\nand Holy Ghost, whom all adore,\nreigning and blest forevermore. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Immense caeli conditor,\nqui, mixta ne confunderent,\naquae fluenta dividens,\ncaelum dedisti limitem,\n\nFirmans locum caelestibus,\nsimulque terrae rivulis,\nut unda flammas temperet,\nterrae solum ne dissipet:\n\nInfunde nunc, piissime,\ndonum perennis gratiae,\nfraudis novae ne casibus\nnos error atterat vetus.\n\nLucem fides inveniat,\nsic luminis iubar ferat;\nhaec vana cuncta terreat,\nhanc falsa nulla comprimant.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "The Monday Vespers hymn attributed to Pope Saint Gregory the Great. It recalls the second day of creation, when the firmament was set between the waters above and the waters below (Genesis 1:6-8), and prays that grace may keep the soul from being worn down by old sins or new deceits. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["vespers", "monday", "evening", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/Immense.html`, `${BRITT}75/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "lux-ecce-surgit-aurea",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/LuxEcce.html`, `${BRITT}65/mode/1up`],
    payload: {
      slug: "lux-ecce-surgit-aurea",
      title: "Lux ecce surgit aurea (See the golden sun arise)",
      body: "See the golden sun arise!\nLet no more our darkened eyes\nsnare us, tangled by surprise\nIn the maze of sin!\n\nFrom false words and thoughts impure\nlet this Light, serene and sure,\nkeep our lips without secure,\nkeep our souls within.\n\nSo may we the daytime spend,\nthat, till life's temptations end,\ntongue, nor hand, nor eye offend!\nOne, above us all,\n\nViews in His revealing ray\nall we do, and think, and say,\nwatching us from break of day\ntill the twilight fall.\n\nUnto God the Father, Son,\nHoly Spirit, Three in One,\nOne in Three, be glory done,\nnow and evermore.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Lux ecce surgit aurea,\npallens facessat caecitas,\nquae nosmet in praeceps diu\nerrore traxit devio.\n\nHaec lux serenum conferat,\npurosque nos praestet sibi:\nnihil loquamur subdolum:\nVolvamus obscurum nihil.\n\nSic tota decurrat dies,\nne lingua mendax, ne manus\noculive peccent lubrici,\nNe noxa corpus inquinet.\n\nSpeculator astat desuper,\nQui nos diebus omnibus,\nactusque nostros prospicit\na luce prima in vesperum.\n\nDeo Patri sit gloria,\neiusque soli Filio,\ncum Spiritu Paraclito,\nnunc et per omne saeculum.",
      summary:
        "A morning hymn drawn from the Cathemerinon of the Spanish poet Prudentius (348-c. 413) and sung at Thursday Lauds in the Roman Breviary. It prays that the light of day may keep tongue, hand and eye from sin under the gaze of the One who watches from on high; the Liturgy of the Hours sings a recast form beginning Sol ecce surgit igneus. The English is the translation of William John Courthope (1842-1917).",
      occasions: ["lauds", "thursday", "morning"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/TempusPerAnnum/LuxEcce.html`, `${BRITT}65/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "magnae-deus-potentiae",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/MagnaeDeus.html`, `${BRITT}80/mode/1up`],
    payload: {
      slug: "magnae-deus-potentiae",
      title: "Magnae Deus potentiae (O sovereign Lord of Nature's might)",
      body: "O sovereign Lord of Nature's might,\nWho bad'st the water's birth divide;\npart in the heavens to take their flight,\nand part in ocean's deep to hide;\n\nThese low obscured, on airy wing\nexalted those, that either race,\nthough from one element they spring,\nmight serve Thee in a different place.\n\nGrant, Lord, that we Thy servants all,\nsaved by Thy tide of cleansing Blood,\nno more 'neath sin's dominion fall,\nnor fear the thought of death's dark flood!\n\nThy varied love each spirit bless,\nthe humble cheer, the high control;\ncheck in each heart its proud excess,\nbut raise the meek and contrite soul!\n\nThis boon, O Father, we entreat,\nthis blessing grant, Eternal Son,\nand Holy Ghost, the Paraclete,\nboth now, and while the ages run. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Magnae Deus potentiae,\nqui ex aquis ortum genus\npartim remittis gurgiti,\npartim levas in aera.\n\nDemersa lymphis imprimens,\nsubvecta caelis irrogans,\nut, stirpe una prodita,\ndiversa repleant loca:\n\nLargire cunctis servulis,\nquos mundat unda sanguinis,\nnescire lapsus criminum,\nnec ferre mortis taedium.\n\nUt culpa nullum deprimat,\nnullum levet iactantia,\nelisa mens ne concidat,\nelata mens ne corruat.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "The Thursday Vespers hymn attributed to Pope Saint Gregory the Great. It recalls the fifth day of creation, when the birds of the air and the fishes of the sea came forth from the waters (Genesis 1:20-23), and prays that those washed in Christ's blood may be neither cast down by guilt nor lifted up by pride. The English is the translation of William John Courthope (1842-1917).",
      occasions: ["vespers", "thursday", "evening", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/MagnaeDeus.html`, `${BRITT}80/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "nox-atra-rerum-contegit",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/NoxAtra.html`, `${BRITT}64/mode/1up`],
    payload: {
      slug: "nox-atra-rerum-contegit",
      title: "Nox atra rerum contegit (The dusky veil of night hath laid)",
      body: "The dusky veil of night hath laid\nthe varied hues of earth in shade;\nbefore Thee, righteous Judge of all,\nwe contrite in confession fall.\n\nTake far away our load of sin,\nour soiled minds make clean within:\nThy sovereign grace, O Christ impart,\nfrom all offense to guard our heart.\n\nFor lo! our mind is dull and cold,\nenvenomed by sin's baneful hold:\nfain would it now the darkness flee,\nand seek, Redeemer, unto Thee.\n\nFar from it drive the shades of night,\nits inmost darkness put to flight;\ntill in the daylight of the Blest\nit joys to find itself at rest.\n\nAlmighty Father, hear our cry,\nthrough Jesus Christ, our Lord most High,\nwho with the Holy Ghost and Thee\ndoth live and reign eternally. Amen.",
      prayerType: "hymn",
      category: "penitential",
      language: "en",
      latin:
        "Nox atra rerum contegit\nterrae colores omnium:\nnos confitentes poscimus\nte, iuste iudex cordium,\n\nUt auferas piacula\nsordesque mentis abluas,\ndonesque, Christe, gratiam\nut arceantur crimina.\n\nMens, ecce, torpet impia,\nquam culpa mordet noxia;\nobscura gestit tollere\net te, Redemptor, quaerere.\n\nRepelle tu caliginem\nintrinsecus quam maxime,\nut in beato gaudeat\nse collocari lumine.\n\nSit, Christe, rex piissime,\ntibi Patrique gloria\ncum Spiritu Sancto Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "A night-office hymn attributed to Pope Saint Gregory the Great, sung at Thursday Matins in the Roman Breviary and in the Office of Readings on Thursdays in Ordinary Time: a confession of sin made in the dark, asking Christ the Redeemer to drive out the inward night. The English is the translation of Joseph William Chadwick (1841-1882).",
      occasions: ["office-of-readings", "thursday", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/NoxAtra.html`, `${BRITT}64/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "nox-et-tenebrae-et-nubila",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/NoxEtTenebrae.html`, `${BRITT}63/mode/1up`],
    payload: {
      slug: "nox-et-tenebrae-et-nubila",
      title: "Nox et tenebrae et nubila (Day is breaking, dawn is bright)",
      body: "Day is breaking, dawn is bright:\nHence, vain shadows of the night!\nMists that dim our mortal sight,\nChrist is come! Depart!\n\nDarkness routed lifts her wings\nas the radiance upwards springs:\nthrough the world of wakened things\nlife and color dart.\n\nThee, O Christ, alone we know,\nsinging even in our woe,\nwith pure hearts to Thee we go:\non our senses shine!\n\nIn Thy beams be purged away\nall that leads our thoughts astray!\nThrough our spirits, King of day,\npour Thy light divine!\n\nUnto God the Father, Son,\nHoly Spirit, Three in One,\none in Three, be glory done,\nnow and evermore. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Nox et tenebrae et nubila,\nconfusa mundi et turbida,\nlux intrat, albescit polus:\nChristus venit; discedite.\n\nCaligo terrae scinditur\npercussa solis spiculo,\nrebusque iam color redit\nvultu nitentis sideris.\n\nSic nostra mox obscuritas\nfraudisque pectus conscium,\nruptis retectum nubibus,\nregnante pallescet Deo.\n\nTe, Christe, solum novimus,\nte mente pura et simplici\nrogare curvato genu\nflendo et canendo discimus.\n\nIntende nostris sensibus\nvitamque totam dispice:\nsunt multa fucis illita\nquae luce purgentur tua.\n\nSit, Christe, rex piissime,\ntibi Patrique gloria\ncum Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "A cento from the morning hymn of Prudentius's Cathemerinon, sung at Wednesday Lauds in the Roman Breviary and the Liturgy of the Hours, which bids the mists of night depart because Christ is coming. The English is the translation of William John Courthope (1842-1917), made for the shorter Breviary text, so it has no stanza answering the third Latin stanza printed here (Sic nostra mox obscuritas).",
      occasions: ["lauds", "wednesday", "morning", "ordinary-time"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/TempusPerAnnum/NoxEtTenebrae.html`, `${BRITT}63/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "plasmator-hominis-deus",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/Plasmator.html`, `${BRITT}82/mode/1up`],
    payload: {
      slug: "plasmator-hominis-deus",
      title: "Plasmator hominis, Deus (Maker of man, who from Thy throne)",
      body: "Maker of man, who from Thy throne\ndost order all things, God alone;\nby whose decree the teeming earth\nto reptile and to beast gave birth:\n\nThe mighty forms that fill the land,\ninstinct with life at Thy command,\nare given subdued to humankind\nfor service in their rank assigned.\n\nFrom all Thy servants drive away\nwhate'er of thought impure to-day\nhath been with open action blent,\nor mingled with the heart's intent.\n\nIn heaven Thine endless joys bestow,\nand grant Thy gifts of grace below;\nfrom chains of strife our souls release,\nbind fast the gentle bands of peace.\n\nGrant this, O Father, ever One\nwith Christ, Thy sole-begotten Son,\nWhom, with the Spirit we adore,\none God, both now and evermore.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Plasmator hominis, Deus,\nqui cuncta solus ordinans,\nhumum iubes producere\nreptantis et ferae genus:\n\nQui magna rerum corpora,\ndictu iubentis vivida,\nut serviant per ordinem\nsubdens dedisti homini:\n\nRepelle a servis tuis,\nquicquid per immunditiam,\naut moribus se suggerit,\naut actibus se interserit.\n\nDa gaudiorum praemia,\nda gratiarum munera:\ndissolve litis vincula,\nastringe pacis foedera.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum.",
      summary:
        "The Friday Vespers hymn attributed to Pope Saint Gregory the Great. It recalls the sixth day of creation, when God made the beasts of the earth and gave them into man's service (Genesis 1:24-28), and asks for purity of thought and deed, the loosing of strife and the bond of peace. In the Roman Breviary it begins Hominis superne Conditor. The English is the translation of John David Chambers (1805-1893).",
      occasions: ["vespers", "friday", "evening", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/Plasmator.html`, `${BRITT}82/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rerum-creator-optime",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/RerumCreator.html`, `${BRITT}61/mode/1up`],
    payload: {
      slug: "rerum-creator-optime",
      title: "Rerum Creator optime (Who madest all and dost control)",
      body: "Who madest all and dost control,\nLord, with Thy touch divine,\ncast out the slumbers of the soul,\nthe rest that is not Thine.\n\nLook down, Eternal Holiness,\nand wash the sins away,\nof those, who, rising to confess,\noutstrip the lingering day.\n\nOur hearts and hands by night, O Lord,\nwe lift them in our need;\nas holy Psalmists give the word,\nand holy Paul the deed.\n\nEach sin to Thee of years gone by,\neach hidden stain lies bare;\nwe shrink not from Thine awful eye,\nbut pray that Thou wouldst spare.\n\nGrant this, O Father, Only Son\nand Spirit, God of grace,\nto whom all worship shall be done\nin every time and place. Amen.",
      prayerType: "hymn",
      category: "penitential",
      language: "en",
      latin:
        "Rerum Creator optime,\nrectorque noster, respice;\nnos a quiete noxia\nmersos sopore libera.\n\nTe, sancte Christe, poscimus;\nignosce tu criminibus,\nad confitendum surgimus\nmorasque noctis rumpimus.\n\nMentes manusque tollimus,\nPropheta sicut noctibus\nnobis gerendum praecipit\nPaulusque gestis censuit.\n\nVides malum quod gessimus;\nocculta nostra pandimus,\npreces gementes fundimus;\ndimitte quod peccavimus.\n\nSit, Christe rex piissime,\ntibi Patrique gloria\ncum Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "A night-office hymn attributed to Pope Saint Gregory the Great, sung at Wednesday Matins in the Roman Breviary and in the Office of Readings on Wednesdays in Ordinary Time: those who rise by night to pray, as the Prophet and Saint Paul taught, lay bare their hidden sins and ask for pardon. The English is the translation of Saint John Henry Newman (1801-1890).",
      occasions: ["office-of-readings", "wednesday", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great", "saint-john-henry-newman"],
      citations: [`${TPL}Hymni/TempusPerAnnum/RerumCreator.html`, `${BRITT}61/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "somno-refectis-artubus",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/Somno.html`, `${BRITT}54/mode/1up`],
    payload: {
      slug: "somno-refectis-artubus",
      title: "Somno refectis artubus (Our limbs refreshed with slumber now)",
      body: "Our limbs refreshed with slumber now,\nand sloth cast off, in prayer we bow;\nand while we sing Thy praises dear,\nO Father, be Thou present here.\n\nTo Thee our earliest morning song,\nto Thee our hearts' full powers belong;\nand Thou, O Holy One, prevent\neach following action and intent.\n\nAs shades at morning flee away,\nand night before the star of day;\nso each transgression of the night\nbe purged by Thee, celestial Light!\n\nCut off, we pray Thee, each offense,\nand every lust of thought and sense;\nthat by their lips who Thee adore\nThou mayest be praised forevermore.\n\nGrant this, O Father ever One\nwith Christ, Thy sole-begotten Son,\nand Holy Ghost, whom all adore,\nreigning and blest forevermore. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Somno refectis artubus,\nspreto cubili, surgimus:\nnobis, Pater, canentibus\nadesse te deposcimus.\n\nTe lingua primum concinat,\nte mentis ardor ambiat,\nut actuum sequentium\ntu, Sancte, sis exordium.\n\nCedant tenebrae lumini\net nox diurno sideri,\nut culpa, quam nox intulit,\nlucis labascat munere.\n\nPrecamur iidem supplices\nnoxas ut omnes amputes,\net ore te canentium\nlauderis in perpetuum.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "A hymn for the night office attributed to Saint Ambrose, sung at Monday Matins in the Roman Breviary and in the Office of Readings on Mondays in Ordinary Time, which offers God the first words and the first thoughts of the new day and asks that the light may purge what the night has brought. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["office-of-readings", "monday", "morning", "ordinary-time"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${TPL}Hymni/TempusPerAnnum/Somno.html`, `${BRITT}54/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "summae-deus-clementiae",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/SummaeDeus.html`, `${BRITT}70/mode/1up`],
    payload: {
      slug: "summae-deus-clementiae",
      title: "Summae Deus clementiae (Great God of boundless mercy, hear)",
      body: "Great God of boundless mercy hear;\nThou Ruler of this earthly sphere;\nin substance one, in Persons three,\ndread Trinity in Unity!\n\nDo Thou in love accept our lays\nof mingled penitence and praise;\nand set our hearts from error free,\nmore fully to rejoice in Thee.\n\nOur reins and hearts in pity heal,\nand with Thy chastening fire anneal;\ngird Thou our loins, each passion quell,\nand every harmful lust expel.\n\nNow as our anthems, upward borne,\nawake the silence of the morn,\nenrich us with Thy gifts of grace,\nfrom heaven, Thy blissful dwelling place!\n\nHear Thou our prayer, Almighty King;\nhear Thou our praises, while we sing,\nadoring with the heavenly host\nthe Father, Son and Holy Ghost.",
      prayerType: "hymn",
      category: "trinitarian",
      language: "en",
      latin:
        "Summae Deus clementiae\nmundique factor machinae,\nqui trinus almo numine\nunusque firmas omnia,\n\nNostros piis cum canticis\nfletus benigne suscipe,\nquo corde puro sordibus\nte perfruamur largius.\n\nLumbos adure congruis\ntu caritatis ignibus,\naccincti ut adsint perpetim\ntuisque prompti adventibus,\n\nUt, quique horas noctium\nnunc concinendo rumpimus,\ndonis beatae patriae\nditemur omnes affatim.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "A seventh-century hymn of unknown authorship to the Holy Trinity, sung at Saturday Matins in the Roman Breviary, where it begins Summae Parens clementiae, and in the Office of Readings on Saturdays in Ordinary Time. It asks the triune God to accept tears and songs together and to burn away every harmful desire with the fire of charity. The English is the translation of John David Chambers (1805-1893).",
      occasions: ["office-of-readings", "saturday", "ordinary-time"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/TempusPerAnnum/SummaeDeus.html`, `${BRITT}70/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "telluris-ingens-conditor",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/Telluris.html`, `${BRITT}77/mode/1up`],
    payload: {
      slug: "telluris-ingens-conditor",
      title: "Telluris ingens Conditor (Earth's mighty Maker, whose command)",
      body: "Earth's mighty Maker, whose command\nraised from the sea the solid land;\nand drove each billowy heap away,\nand bade the earth stand firm for aye:\n\nThat so, with flowers of golden hue,\nthe seeds of each it might renew;\nand fruit-trees bearing fruit might yield,\nand pleasant pasture of the field:\n\nOur spirit's rankling wounds efface\nwith dewy freshness of Thy grace:\nthat grief may cleanse each deed of ill,\nand o'er each lust may triumph still.\n\nLet every soul Thy law obey,\nand keep from every evil way;\nrejoice each promised good to win,\nand flee from every mortal sin.\n\nHear Thou our prayer, Almighty King!\nhear Thou our praises, while we sing,\nadoring with the heavenly host,\nthe Father, Son, and Holy Ghost!",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Telluris ingens Conditor,\nmundi solum qui eruens,\npulsis aquae molestiis,\nterram dedisti immobilem,\n\nUt germen aptum proferens,\nfulvis decora floribus,\nfecunda fructu sisteret\npastumque gratum redderet:\n\nMentis perustae vulnera\nmunda virore gratiae,\nut facta fletu diluat,\nmotusque pravos atterat,\n\nIussis tuis obtemperet,\nnullis malis approximet,\nbonis repleri gaudeat,\net mortis actum nesciat.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito\nregnans per omne saeculum. Amen.",
      summary:
        "The Tuesday Vespers hymn attributed to Pope Saint Gregory the Great. It recalls the third day of creation, when the dry land rose from the waters and brought forth flowers and fruit (Genesis 1:9-13), and prays that grace may heal the soul's wounds as the earth is clothed in green. In the Roman Breviary it begins Telluris alme Conditor. The English is an anonymous translation published in 1854.",
      occasions: ["vespers", "tuesday", "evening", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/Telluris.html`, `${BRITT}77/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "tu-trinitatis-unitas",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/TuTrinitas.html`, `${BRITT}66/mode/1up`],
    payload: {
      slug: "tu-trinitatis-unitas",
      title: "Tu, Trinitatis Unitas (O Three in One, and One in Three)",
      body: "O Three in One, and One in Three,\nWho rulest all things mightily,\nbow down to hear the songs of praise\nwhich, freed from bonds of sleep, we raise.\n\nWhile lingers yet the peace of night,\nwe rouse us from our slumbers light;\nthat might of instant prayer may win\nThe healing balm for wounds of sin.\n\nIf, by the wiles of Satan caught,\nthis nighttime we have sinned in aught,\nthat sin Thy glorious power today,\nfrom heaven descending, cleanse away.\n\nLet naught impure our bodies stain,\nno laggard sloth our souls detain,\nno taint of sin our spirits know,\nto chill the fervor of their glow.\n\nWherefore, Redeemer, grant that we\nfulfilled with Thine own light may be:\nthat, in our course, from day to day,\nby no misdeed we fall away.\n\nGrant this, O Father ever One\nwith Christ, Thy sole-begotten Son,\nand Holy Ghost, whom all adore,\nreigning and blest forevermore.",
      prayerType: "hymn",
      category: "trinitarian",
      language: "en",
      latin:
        "Tu, Trinitatis Unitas,\norbem potenter qui regis,\nattende laudis canticum\nquod excubantes psallimus.\n\nNam lectulo consurgimus\nnoctis quieto tempore,\nut flagitemus vulnerum\na te medelam omnium.\n\nQuo fraude quicquid daemonum\nin noctibus deliquimus,\nabstergat illud caelitus\ntuae potestas gloriae.\n\nNe corpus astet sordidum,\nnec torpor instet cordium,\nne criminis contagio\ntepescat ardor spiritus.\n\nTe corde fido, quaesumus,\nreple tuo nos lumine,\nper quod dierum circulis\nnullis ruamus actibus.\n\nPraesta, Pater piissime,\nPatrique compar Unice,\ncum Spiritu Paraclito,\nregnans per omne saeculum.",
      summary:
        "A hymn to the Holy Trinity for the night office, attributed to Pope Saint Gregory the Great and sung at Friday Matins in the Roman Breviary and in the Office of Readings on Fridays in Ordinary Time. Rising while the night is still, the singers ask healing for every wound of sin and the light that keeps the coming day free from fault. The English is the translation of George Herbert Palmer (1846-1926) and Joseph William Chadwick (1841-1882).",
      occasions: ["office-of-readings", "friday", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${TPL}Hymni/TempusPerAnnum/TuTrinitas.html`, `${BRITT}66/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "verbum-supernum-prodiens-advent",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Adventus/VerbumProdiens.html`, `${BRITT}97/mode/1up`],
    payload: {
      slug: "verbum-supernum-prodiens-advent",
      title: "Verbum supernum prodiens, a Patre lumen exiens (Celestial Word, to this our earth)",
      body: "Celestial Word, to this our earth\nsent down from God's eternal clime,\nto save mankind by mortal birth\ninto a world of change and time;\n\nLighten our hearts, vain hopes destroy;\nand in Thy love's consuming fire\nFill all the soul with heavenly joy,\nand melt the dross of low desire.\n\nSo when the Judge of quick and dead\nshall bid His awful summons come,\nto whelm the guilty soul with dread,\nand call the blessed to their home.\n\nSaved from the whirling black abyss,\nforevermore to us be given\nto share the feast of saintly bliss,\nand see the face of God in heaven.\n\nTo God the Father and the Son\nour songs with one accord we raise;\nand to the Holy Spirit, One\nwith Them, be ever equal praise. Amen",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Verbum supernum prodiens\na Patre lumen exiens,\nqui natus orbi subvenis\ncursu declivi temporis:\n\nIllumina nunc pectora\ntuoque amore concrema;\naudita per praeconia\nsint pulsa tandem lubrica.\n\nIudexque cum post aderis\nrimari facta pectoris,\nreddens vicem pro abditis\niustisque regnum pro bonis,\n\nNon demum artemur malis\npro qualitate criminis,\nsed cum beatis compotes\nsimus perennes caelites.\n\nSit, Christe, rex piissime,\ntibi Patrique gloria\ncum Sancto Spiritu Paraclito,\nin sempiterna saecula. Amen.",
      summary:
        "An Advent hymn of the sixth or seventh century, sung at Matins in Advent in the Roman Breviary and in the Office of Readings during Advent. It asks the Word who came down from the Father to enlighten and inflame hearts now, so that when he comes again as Judge we may be numbered among the blessed. It is a different hymn from Saint Thomas Aquinas's Corpus Christi hymn that opens with the same words. The English is the translation of William John Courthope (1842-1917), from Church Hymns (1903).",
      occasions: ["advent", "office-of-readings"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/Adventus/VerbumProdiens.html`, `${BRITT}97/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "hostis-herodes-impie",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Epiphania/HostisHerodes.html`, `${BRITT}113/mode/1up`],
    payload: {
      slug: "hostis-herodes-impie",
      title: "Hostis Herodes impie (Why, impious Herod, vainly fear)",
      body: "Why, impious Herod, vainly fear\nthat Christ the Savior cometh here?\nHe takes no earthly realms away\nWho gives the crown that lasts for aye.\n\nTo greet His birth the Wise Men went,\nled by the star before them sent;\ncalled on by light, towards Light they pressed,\nand by their gifts their God confessed.\n\nIn holy Jordan's purest wave\nthe heavenly Lamb vouchsafed to lave;\nThat He, to whom was sin unknown,\nmight cleanse His people from their own.\n\nNew miracle of power divine!\nThe water reddens into wine:\nHe spake the word: and poured the wave\nin other streams than nature gave.\n\nAll glory, Lord, to Thee we pay\nfor Thine Epiphany today;\nall glory as is ever meet,\nto Father and to Paraclete. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Hostis, Herodes impie,\nChristum venire quid times?\nNon eripit mortalia,\nqui regna dat caelestia.\n\nIbant Magi, quam viderant,\nstellam sequentes praeviam:\nLumen requirunt lumine:\nDeum fatentur munere.\n\nLavacra puri gurgitis\ncaelestis Agnus attigit:\npeccata, quae non detulit,\nnos abluendo sustulit.\n\nNovum genus potentiae:\naquae rubescunt hydriae,\nvinumque iussa fundere,\nmutavit unda originem.\n\nIesu, tibi sit gloria,\nqui apparuisti gentibus,\ncum Patre, et almo Spiritu,\nin sempiterna saecula. Amen.",
      summary:
        "The Vespers hymn of the Epiphany, taken from the alphabetical hymn of the fifth-century poet Caelius Sedulius whose opening stanzas form A solis ortus cardine. It joins the three manifestations of Christ the Church celebrates at the Epiphany: the coming of the Magi, the baptism in the Jordan and the water made wine at Cana. The Roman Breviary's revised text begins Crudelis Herodes, Deum. The English is the translation of John Mason Neale (1818-1866).",
      occasions: ["epiphany", "vespers", "january-6"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/Epiphania/HostisHerodes.html`, `${BRITT}113/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-sola-magnarum-urbium",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Epiphania/OSolaMagnarum.html`, `${BRITT}115/mode/1up`],
    payload: {
      slug: "o-sola-magnarum-urbium",
      title: "O sola magnarum urbium (Bethlehem! of noblest cities)",
      body: "Bethlehem! of noblest cities\nnone can once with thee compare;\nthou alone the Lord from heaven\ndidst for us Incarnate bear.\n\nFairer than the sun at morning\nwas the star that told His birth;\nto the lands their God announcing,\nhid beneath a form of earth.\n\nBy its lambent beauty guided,\nsee the eastern kings appear;\nsee them bend, their gifts to offer—\ngifts of incense, gold, and myrrh.\n\nSolemn things of mystic meaning!—\nIncense doth the God disclose;\nGold a royal Child proclaimeth;\nMyrrh a future tomb foreshows.\n\nHoly Jesu, in Thy brightness\nto the Gentile world displayed,\nwith the Father and the Spirit,\nendless praise to Thee be paid.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "O sola magnarum urbium\nmaior Bethlehem, cui contigit\nducem salutis caelitus\nincorporatum gignere.\n\nHaec stella, quae solis rotam\nvincit decore ac lumine,\nvenisse terris nuntiat\ncum carne terrestri Deum.\n\nVidere postquam illum Magi,\neoa promunt munera:\nstratique votis offerunt\nthus, myrrham, et aurum regium.\n\nRegem Deumque annuntiant\nthesaurus, et fragrans odor\nthuris Sabaei, ac myrrheus\npulvis sepulchrum praedocet.\n\nIesu, tibi sit gloria,\nqui apparuisti gentibus,\ncum Patre, et almo Spiritu,\nin sempiterna saecula.",
      summary:
        "The Lauds hymn of the Epiphany in the Roman Breviary, four stanzas taken from the long Epiphany hymn in the Cathemerinon of Prudentius: Bethlehem greater than all great cities, the star that outshines the sun, and what the gold, incense and myrrh of the Magi declare of the Child. The English is the translation of Edward Caswall (1814-1878).",
      occasions: ["epiphany", "lauds", "january-6"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/Epiphania/OSolaMagnarum.html`, `${BRITT}115/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "iesu-decus-angelicum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Nativitatis/IesuDecus.html`, `${BRITT}112/mode/1up`],
    payload: {
      slug: "iesu-decus-angelicum",
      title: "Iesu, decus angelicum (O Jesus, Thou the beauty art)",
      body: "O Jesus, Thou the beauty art\nof Angel worlds above!\nThy name is music to the heart,\nenchanting it with love!\n\nCelestial sweetness unalloyed!\nwho eat Thee hunger still,\nwho drink of Thee still feel a void\nwhich naught but Thou canst fill!\n\nO my sweet Jesus! hear the sighs\nwhich unto Thee I send!\nto Thee my inmost spirit cries\nmy being's hope and end!\n\nStay with us, Lord, and with Thy light\nillume the soul's abyss;\nscatter the darkness of our night\nand fill the world with bliss.\n\nO Jesu! spotless Virgin flower!\nour life and joy! to Thee\nbe praise, beatitude and power,\nthrough all eternity! Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Iesu, decus angelicum,\nin aure dulce canticum,\nin ore mel mirificum,\nin corde nectar caelicum.\n\nQui te gustant, esuriunt,\nqui bibunt, adhuc sitiunt;\ndesiderare nesciunt,\nnisi Iesum, quem diligunt.\n\nO Iesu mi dulcissime,\nspes suspirantis animae!\nTe quaerunt piae lacrimae,\nTe clamor mentis intimae.\n\nMane nobiscum, Domine,\net nos illustra lumine;\nPulsa mentis caligine,\nMundum reple dulcedine.\n\nIesu, flos Matris Virginis,\namor nostrae dulcedinis,\nTibi laus, honor nominis,\nregnum beatitudinis. Amen.",
      summary:
        "Stanzas from the medieval Jubilus on the name of Jesus traditionally attributed to Saint Bernard of Clairvaux, sung at Lauds on the feast of the Holy Name of Jesus in the Roman Breviary. The same poem supplies the Vespers hymn Iesu, dulcis memoria and the Matins hymn Iesu, Rex admirabilis. The English is the translation of Edward Caswall (1814-1878).",
      occasions: ["holy-name-of-jesus", "january", "lauds"],
      relatedSaints: ["saint-bernard-of-clairvaux"],
      citations: [`${TPL}Hymni/Nativitatis/IesuDecus.html`, `${BRITT}112/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "iesu-rex-admirabilis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/Nativitatis/IesuRex.html`, `${BRITT}111/mode/1up`],
    payload: {
      slug: "iesu-rex-admirabilis",
      title: "Iesu, Rex admirabilis (O Jesus, King most wonderful)",
      body: "O Jesus, King most wonderful!\nThou Conqueror renowned!\nThou Sweetness most ineffable!\nin whom all joys are found!\n\nWhen once Thou visitest the heart,\nthen truth begins to shine;\nthen earthly vanities depart;\nthen kindles love divine.\n\nO Jesu! Light of all below!\nThou font of life and fire!\nsurpassing all the joys we know,\nand all we can desire.\n\nMay every heart confess Thy name,\nand ever Thee adore;\nand seeking Thee, itself inflame\nto seek Thee more and more.\n\nThee may our tongues for ever bless;\nThee may we love alone;\nand ever in our lives express\nthe image of Thine own. Amen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Iesu, Rex admirabilis\net triumphator nobilis,\ndulcedo ineffabilis,\ntotus desiderabilis.\n\nQuando cor nostrum visitas,\ntunc lucet ei veritas,\nmundi vilescit vanitas,\net intus fervet caritas.\n\nIesu, dulcedo cordium,\nfons vivus, lumen mentium,\nexcedens omne gaudium\net omne desiderium.\n\nIesum omnes agnoscite,\namorem eius poscite;\nIesum ardenter quaerite,\nquaerendo inardescite.\n\nTe nostra, Iesu, vox sonet,\nnostri te mores exprimant;\nte corda nostra diligant\net nunc, et in perpetuum. Amen.",
      summary:
        "Stanzas from the medieval Jubilus on the name of Jesus traditionally attributed to Saint Bernard of Clairvaux, sung at Matins on the feast of the Holy Name of Jesus in the Roman Breviary: when Christ visits the heart, truth shines in it, the world's vanity grows cheap and love is kindled. The English is the translation of Edward Caswall (1814-1878).",
      occasions: ["holy-name-of-jesus", "january", "office-of-readings"],
      relatedSaints: ["saint-bernard-of-clairvaux"],
      citations: [`${TPL}Hymni/Nativitatis/IesuRex.html`, `${BRITT}111/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "salutis-aeternae-dator",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/OmnesSancti/Salutis.html`, `${BRITT}314/mode/1up`],
    payload: {
      slug: "salutis-aeternae-dator",
      title: "Salutis aeternae dator (Giver of life, eternal Lord)",
      body: "Giver of life, eternal Lord,\nThy own redeemed defend;\nMother of grace, thy children save,\nand help them to the end.\n\nYe thousand thousand Angel hosts,\nassist us in our need;\nYe Patriarchs, with the Prophet choir,\nfor our forgiveness plead.\n\nForerunner blest, and Thou who still\ndost heaven's dread keys retain;\nYe glorious Apostles all,\nunloose our guilty chain.\n\nArmy of Martyrs, holy Priests,\nin beautiful array;\nYe happy troops of Virgins chaste,\nwash all our stains away.\n\nAll ye who high above the stars\nin heavenly glory reign,\nMay we through your prevailing prayers\nunto your joys attain.\n\nPraise, honor, to the Father be,\npraise to His only Son;\nPraise, Holy Paraclete, to Thee,\nwhile endless ages run.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Salutis aeternae dator,\nIesu, redemptis subveni;\nVirgo, parens clementiae,\ndona salutem servulis.\n\nVos, Angelorum millia,\nPatrumque coetus, agmina\ncanora Vatum; vos, reis\nprecamini indulgentiam.\n\nBaptista Christi praevius,\nSummique caeli Claviger\ncum ceteris Apostolis\nnexus resolvant criminum.\n\nCohors triumphans Martyrum,\nalmus Sacerdotum chorus,\net virginalis castitas\nnostros reatus abluant.\n\nQuicumque in alta siderum\nregnatis aula principes,\nfavete votis supplicum,\nqui dona caeli flagitant.\n\nVirtus, honor, laus, gloria\nDeo Patri cum Filio,\nSancto simul Paraclito\nin saeculorum saecula.",
      summary:
        "The Lauds hymn of All Saints in the Roman Breviary: Pope Urban VIII's 1632 recasting of the older Iesu, salvator saeculi ascribed to Rabanus Maurus, which the Liturgy of the Hours has since restored. It asks the Virgin, the angels, the patriarchs and prophets, the Baptist, Peter and the apostles, the martyrs, priests and virgins to pray for sinners. The English is the translation of Edward Caswall (1814-1878).",
      occasions: ["all-saints", "november-1", "lauds"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/OmnesSancti/Salutis.html`, `${BRITT}314/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "stabat-mater-speciosa",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}BVM/SMSpeciosa.html`, `${BRITT}137/mode/1up`],
    payload: {
      slug: "stabat-mater-speciosa",
      title: "Stabat Mater speciosa (By the crib wherein reposing)",
      body: "By the crib wherein reposing,\nwith His eyes in slumber closing,\nlay serene her Infant-boy,\n\nStood the beauteous Mother feeling\nbliss that could not bear concealing,\nso her face o'erflowed with joy.\n\nOh, the rapture naught could smother\nof that most Immaculate Mother\nof the sole-begotten One;\n\nWhen with laughing heart exulting,\nshe beheld her hopes resulting\nIn the great birth of her Son.\n\nWho would not with gratulation\nsee the happy consolation\nof Christ's Mother undefiled?\n\nWho would not be glad surveying\nChrist's dear Mother bending, praying,\nplaying with her heavenly Child\n\nFor a sinful world's salvation,\nChrist her Son's humiliation\nShe beheld and brooded o'er;\n\nSaw Him weak, a child, a stranger,\nyet before Him in the manger\nkings lie prostrate and adore.\n\nO'er that lowly manger winging,\njoyful hosts from heaven were singing\ncanticles of holy praise;\n\nWhile the old man and the maiden,\nspeaking naught, with hearts o'erladen,\npondered on God's wondrous ways.\n\nFount of love, forever flowing,\nwith a burning ardor glowing,\nmake me, Mother, feel like thee;\n\nLet my heart, with graces gifted\nall on fire, to Christ be lifted,\nand by Him accepted be.\n\nHoly Mother, deign to bless me,\nwith His sacred Wounds impress me,\nlet them in my heart abide;\n\nSince He came, thy Son, the Holy,\nto a birth-place, ah, so lowly,\nall His pains with me divide.\n\nMake me with true joy delighted,\nto Child-Jesus be united\nwhile my days of life endure;\n\nWhile an exile here sojourning,\nmake my heart like thine be burning\nwith a love divine and pure.\n\nSpotless Maid and sinless Woman,\nmake us feel a fire in common,\nmake my heart's long longing sure.\n\nVirgin of all virgins highest,\nprayer to thee thou ne'er denyest,\nlet me bear thy sweet Child too.\n\nLet me bear Him in my bosom,\nLord of life, and never lose Him,\nsince His birth doth death subdue.\n\nLet me show forth how immense is\nthe effect on all my senses\nof an union so divine.\n\nAll who in the crib revere Him,\nlike the shepherds watching near Him,\nwill attend Him through the night,\n\nBy thy powerful prayers protected,\ngrant, O Queen, that His elected\nmay behold heaven's moving light.\n\nMake me by His birth be guarded,\nby God's holy word be warded,\nby His grace till all is done;\n\nWhen my body lies obstructed,\nmake my soul to be conducted,\nto the vision of thy Son. Amen.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Stabat Mater speciosa\niuxta faenum gaudiosa,\ndum iacebat parvulus.\n\nCuius animam gaudentem\nlaetabundam et ferventem\npertransivit iubilus.\n\nO quam laeta et beata\nfuit illa immaculata,\nmater Unigeniti!\n\nQuae gaudebat et ridebat,\nexultabat, cum videbat\nnati partum inclyti.\n\nQuisquam est, qui non gauderet,\nChristi matrem si videret\nin tanto solatio?\n\nQuis non posset collaetari,\nChristi Matrem contemplari\nludentem cum Filio?\n\nPro peccatis suae gentis\nChristum vidit cum iumentis\net algori subditum.\n\nVidit suum dulcem Natum\nvagientem, adoratum,\nvili deversorio.\n\nNato, Christo in praesepe\ncaeli cives canunt laete\ncum immenso gaudio.\n\nStabat, senex cum puella\nnon cum verbo nec loquela\nstupescentes cordibus.\n\nEia, Mater, fons amoris\nme sentire vim ardoris\nfac, ut tecum sentiam.\n\nFac, ut ardeat cor meum\nin amatum Christum Deum\nut sibi complaceam.\n\nSancta Mater, istud agas,\nprone introducas plagas\ncordi fixas valide.\n\nTui Nati caelo lapsi,\niam dignati faeno nasci,\npoenas mecum divide.\n\nFac me vere congaudere,\nIesulino cohaerere,\ndonec ego vixero.\n\nIn me sistat ardor tui,\npuerino fac me frui\ndum sum in exilio.\n\nHunc ardorem fac communem,\nNe me facias immunem,\nAb hoc desiderio.\n\nVirgo virginum praeclara,\nmihi iam non sis amara,\nfac me parvum rapere.\n\nFac, ut pulchrum infantem portem,\nqui nascendo vicit mortem,\nvolens vitam tradere.\n\nFac me tecum satiari,\nNato me inebriari,\nstantem in tripudio.\n\nInflammatus et accensus,\nobstupescit omnis sensus\ntali me commercio.\n\nFac, me Nato custodiri,\nverbo Dei praemuniri\nconservari gratia.\n\nQuando corpus morietur,\nfac, ut animae donetur\ntui nati gloria. Amen.",
      summary:
        "A medieval Christmas companion to the Stabat Mater dolorosa, picturing the Mother of God rejoicing beside the manger as the other poem pictures her grieving beside the Cross; both have been ascribed to Jacopone da Todi. It was all but forgotten until Frédéric Ozanam published it in 1852 from a fifteenth-century manuscript. The English is the translation of Denis Florence MacCarthy (1817-1882), which has one stanza with no counterpart in the Latin.",
      occasions: ["christmas", "marian-feasts"],
      relatedSaints: [],
      citations: [`${TPL}BVM/SMSpeciosa.html`, `${BRITT}137/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "iam-lucis-orto-sidere",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Hymni/TempusPerAnnum/IamLucisOrto.html`, `${BRITT}33/mode/1up`],
    payload: {
      slug: "iam-lucis-orto-sidere",
      title: "Iam lucis orto sidere (Now in the sun's new dawning ray)",
      body: "Now in the sun's new dawning ray,\nlowly of heart, our God we pray\nthat He from harm may keep us free\nin all the deeds this day shall see.\n\nMay fear of Him our tongues restrain,\nlest strife unguarded speech should stain:\nHis favoring care our guardian be,\nlest our eyes feed on vanity.\n\nMay every heart be pure from sin,\nand folly find no place therein:\nscant meed of food, excess denied,\nwear down in us the body's pride\n\nThat when the light of day is gone,\nand night in course shall follow on,\nwe, free from cares the world affords,\nmay chant the praise that is our Lord's.\n\nAll laud to God the Father be,\nall praise, Eternal Son, to Thee;\nall glory, as is ever meet,\nto God the Holy Paraclete.\nAmen.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Iam lucis orto sidere,\nDeum precemur supplices,\nut in diurnis actibus\nnos servet a nocentibus.\n\nLinguam refrenans temperet,\nne litis horror insonet,\nvisum fovendo contegat,\nne vanitates hauriat.\n\nSint pura cordis intima,\nabsistat et vecordia:\ncarnis terat superbiam\npotus cibique parcitas.\n\nUt cum dies abscesserit,\nnoctemque sors reduxerit,\nmundi per abstinentiam\nipsi canamus gloriam.\n\nDeo Patri sit gloria,\neiusque soli Filio,\ncum Spiritu Paraclito,\nnunc et per omne saeculum.\nAmen.",
      summary:
        "The hymn of Prime, the first hour of the day, in the Roman Breviary: a prayer of the fifth or sixth century that God will guard the tongue, the eyes and the heart through the day's work, so that at nightfall the singer may still give him glory. The Liturgy of the Hours, which suppressed Prime, sings it at Thursday Morning Prayer in the second and fourth weeks. The English is the translation of Alan G. McDougall (1895-1964), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["morning", "daily", "lauds"],
      relatedSaints: [],
      citations: [`${TPL}Hymni/TempusPerAnnum/IamLucisOrto.html`, `${BRITT}33/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "caelitum-ioseph-decus",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${TPL}Ioseph/Caelitum.html`, `${BRITT}245/mode/1up`],
    payload: {
      slug: "caelitum-ioseph-decus",
      title: "Caelitum, Ioseph, decus (Joseph, the praise and glory of the heavens)",
      body: "Joseph, the praise and glory of the heavens,\nsure pledge of life, and safety of the wide world,\nas in our joy we sing to thee, in kindness\nlisten to our praises.\n\nThou by the world's Creator wert appointed\nspouse of the Virgin; thee He willed to honor\nnaming thee Father of the Word and guardian\nof our salvation.\n\nThou thy Redeemer, lying in a stable,\nwhom long ago foretold the choir of Prophets,\nsawest rejoicing and thy God adoredst\nhumble in childhood.\n\nGod, King of kings, and Governor of the ages,\nHe at whose word the powers of hell do tremble,\nHe whom the adoring heavens ever worship\ncalled thee protector.\n\nPraise to the Triune Godhead ever-lasting,\nWho with such honor mightily hath blest thee;\no may He grant us thy blest petition\njoys everlasting.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Caelitum, Ioseph, decus, atque nostrae\ncerta spes vitae, columenque mundi,\nquas tibi laeti canimus, benignus\nsuscipe laudes.\n\nTe, satum David, statuit Creator\nVirginis sponsum, voluitque Verbi\nte patrem dici, dedit et ministrum\nesse salutis.\n\nTu, Redemptorem stabulo iacentem,\nquem chorus vatum cecinit futurum,\naspicis gaudens, sociusque matris\nprimus adoras.\n\nRex Deus regum, dominator orbis,\ncuius ad nutum tremit infernorum\nturba, cui pronus famulatur aether,\nse tibi subdit.\n\nLaus sit excelsae Triadi perennis,\nquae, tibi insignes tribuens honores,\net tuis nobis meritis beatae\ngaudia vitae.",
      summary:
        "A seventeenth-century hymn to Saint Joseph, ascribed to Juan Escollar (d. 1700), formerly sung at Matins and now at Morning Prayer on the solemnity of Saint Joseph (19 March) and on the memorial of Saint Joseph the Worker (1 May). It honours the son of David chosen to be the Virgin's spouse and the Word's guardian, who with the Virgin was the first to adore the Child in the stable. The English is the translation of Alan G. McDougall (1895-1964), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["march-19", "may-1", "lauds"],
      relatedSaints: ["saint-joseph"],
      citations: [`${TPL}Ioseph/Caelitum.html`, `${BRITT}245/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-hezekiah",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27038.htm`],
    payload: {
      slug: "canticle-of-hezekiah",
      title: "Canticle of Ezechias (Isaias 38:10-20)",
      body: "I said: In the midst of my days I shall go to the gates of hell: I sought for the residue of my years.\nI said: I shall not see the Lord God in the land of the living. I shall behold man no more, nor the inhabitant of rest.\nMy generation is at an end, and it is rolled away from me, as a shepherd's tent. My life is cut off, as by a weaver: whilst I was yet but beginning, he cut me off: from morning even to night thou wilt make an end of me.\nI hoped till morning, as a lion so hath he broken all my bones: from morning even to night thou wilt make an end of me.\nI will cry like a young swallow, I will meditate like a dove: my eyes are weakened looking upward: Lord, I suffer violence, answer thou for me.\nWhat shall I say, or what shall he answer for me, whereas he himself hath done it? I will recount to thee all my years in the bitterness of my soul.\nO Lord, if man's life be such, and the life of my spirit be in such things as these, thou shalt correct me, and make me to live.\nBehold in peace is my bitterness most bitter: but thou hast delivered my soul that it should not perish, thou hast cast all my sins behind thy back.\nFor hell shall not confess to thee, neither shall death praise thee: nor shall they that go down into the pit, look for thy truth.\nThe living, the living, he shall give praise to thee, as I do this day: the father shall make thy truth known to the children.\nO Lord, save me, and we will sing our psalms all the days of our life in the house of the Lord.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The song King Ezechias wrote after he recovered from a mortal illness: the lament of a man who thought his life cut off like a weaver's thread, and his thanks to the God who cast all his sins behind his back. The Church sings it at Lauds in the Office of the Dead, and the Liturgy of the Hours at Morning Prayer on Tuesday of the second week. Douay-Rheims text, Isaias 38:10-20.",
      occasions: ["lauds", "sickness", "all-souls", "funerals"],
      relatedSaints: [],
      citations: [`${DRBO}27038.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-moses-deuteronomy-32",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}05032.htm`],
    payload: {
      slug: "canticle-of-moses-deuteronomy-32",
      title: "Canticle of Moses: Hear, O Ye Heavens (Deuteronomy 32:1-12)",
      body: "Hear, O ye heavens, the things I speak, let the earth give ear to the words of my mouth.\nLet my doctrine gather as the rain, let my speech distil as the dew, as a shower upon the herb, and as drops upon the grass.\nBecause I will invoke the name of the Lord: give ye magnificence to our God.\nThe works of God are perfect, and all his ways are judgments: God is faithful and without any iniquity, he is just and right.\nThey have sinned against him, and are not of his children in their filth: they are a wicked and perverse generation.\nIs this the return thou makest to the Lord, O foolish and senseless people? Is not he thy father, that hath possessed thee, and made thee, and created thee?\nRemember the days of old, think upon every generation: ask thy father, and he will declare to thee: thy elders and they will tell thee.\nWhen the Most High divided the nations: when he separated the sons of Adam, he appointed the bounds of people according to the number of the children of Israel.\nBut the Lord's portion is his people: Jacob the lot of his inheritance.\nHe found him in a desert land, in a place of horror, and of vast wilderness: he led him about, and taught him: and he kept him as the apple of his eye.\nAs the eagle enticing her young to fly, and hovering over them, he spread his wings, and hath taken him and carried him on his shoulders.\nThe Lord alone was his leader: and there was no strange god with him.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The opening of the song Moses taught Israel before his death, calling heaven and earth to hear of the faithful God who found his people in a desert land and kept them as the apple of his eye, bearing them up as an eagle bears its young. The Liturgy of the Hours sings these verses at Morning Prayer on Saturday of the second week. Douay-Rheims text, Deuteronomy 32:1-12.",
      occasions: ["lauds", "saturday", "thanksgiving"],
      relatedSaints: [],
      citations: [`${DRBO}05032.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-david",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}13029.htm`],
    payload: {
      slug: "canticle-of-david",
      title: "Canticle of David (1 Paralipomenon [1 Chronicles] 29:10-13)",
      body: "And he blessed the Lord before all the multitude, and he said: Blessed art thou, O Lord the God of Israel, our father from eternity to eternity.\nThine, O Lord, is magnificence, and power, and glory, and victory: and to thee is praise: for all that is in heaven, and in earth, is thine: thine is the kingdom, O Lord, and thou art above all princes.\nThine are riches, and thine is glory, thou hast dominion over all, in thy hand is power and might: in thy hand greatness, and the empire of all things.\nNow therefore our God we give thanks to thee, and we praise thy glorious name.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "King David's blessing of God before the whole assembly, after the people had given freely for the building of the Temple: magnificence, power, glory and victory are the Lord's, and from his hand come riches and honour. The Liturgy of the Hours sings it at Morning Prayer on Monday of the first week. Douay-Rheims text, 1 Paralipomenon (1 Chronicles) 29:10-13.",
      occasions: ["lauds", "monday", "thanksgiving", "praise"],
      relatedSaints: [],
      citations: [`${DRBO}13029.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-judith",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}18016.htm`],
    payload: {
      slug: "canticle-of-judith",
      title: "Canticle of Judith (Judith 16:1-21)",
      body: "Then Judith sung this canticle to the Lord, saying:\nBegin ye to the Lord with timbrels, sing ye to the Lord with cymbals, tune unto him a new psalm, extol and call upon his name.\nThe Lord putteth an end to wars, the Lord is his name.\nHe hath set his camp in the midst of his people, to deliver us from the hand of all our enemies.\nThe Assyrians came out of the mountains from the north in the multitude of his strength: his multitude stopped up the torrents, and their horses covered the valleys.\nHe bragged that he would set my borders on fire, and kill my young men with the sword, to make my infants a prey, and my virgins captives.\nBut the almighty Lord hath struck him, and hath delivered him into the hands of a woman, and hath slain him.\nFor their mighty one did not fall by young men, neither did the sons of Titan strike him, nor tall giants oppose themselves to him, but Judith the daughter of Merari weakened him with the beauty of her face.\nFor she put off her the garments of widowhood, and put on her the garments of joy, to give joy to the children of Israel.\nShe anointed her face with ointment, and bound up her locks with a crown, she took a new robe to deceive him.\nHer sandals ravished his eyes, her beauty made his soul her captive, with a sword she cut off his head.\nThe Persians quaked at her constancy, and the Medes at her boldness.\nThen the camp of the Assyrians howled, when my lowly ones appeared, parched with thirst.\nThe sons of the damsels have pierced them through, and they have killed them like children fleeing away: they perished in battle before the face of the Lord my God.\nLet us sing a hymn to the Lord, let us sing a new hymn to our God.\nO Adonai, Lord, great art thou, and glorious in thy power, and no one can overcome thee.\nLet all thy creatures serve thee: because thou hast spoken, and they were made: thou didst send forth thy spirit, and they were created, and there is no one that can resist thy voice.\nThe mountains shall be moved from the foundations with the waters: the rocks shall melt as wax before thy face.\nBut they that fear thee, shall be great with thee in all things.\nWoe be to the nation that riseth up against my people: for the Lord almighty will take revenge on them, in the day of judgment he will visit them.\nFor he will give fire, and worms into their flesh, that they may burn, and may feel for ever.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "Judith's song of victory after the deliverance of Bethulia from the army of Holofernes, praising the Lord who puts an end to wars and struck down the enemy by the hand of a woman. Its closing verses, beginning Let us sing a hymn to the Lord, are the canticle at Morning Prayer on Wednesday of the first week in the Liturgy of the Hours. Douay-Rheims text, Judith 16:1-21.",
      occasions: ["lauds", "wednesday", "thanksgiving"],
      relatedSaints: [],
      citations: [`${DRBO}18016.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-jeremiah-31",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}28031.htm`],
    payload: {
      slug: "canticle-of-jeremiah-31",
      title: "Canticle of Jeremias: the Gathering of the Flock (Jeremias 31:10-14)",
      body: "Hear the word of the Lord, O ye nations, and declare it in the islands that are afar off, and say: He that scattered Israel will gather him: and he will keep him as the shepherd doth his flock.\nFor the Lord hath redeemed Jacob, and delivered him out of the hand of one that was mightier than he.\nAnd they shall come, and shall give praise in mount Sion: and they shall flow together to the good things of the Lord, for the corn, and wine, and oil, and the increase of cattle and herds, and their soul shall be as a watered garden, and they shall be hungry no more.\nThen shall the virgin rejoice in the dance, the young men and old men together: and I will turn their mourning into joy, and will comfort them, and make them joyful after their sorrow.\nAnd I will fill the soul of the priests with fatness: and my people shall be filled with my good things, saith the Lord.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The promise that he who scattered Israel will gather it and keep it as a shepherd keeps his flock, turning mourning into joy and filling his people with good things. The Liturgy of the Hours sings it at Morning Prayer on Thursday of the first week. Douay-Rheims text, Jeremias 31:10-14.",
      occasions: ["lauds", "thursday", "trust"],
      relatedSaints: [],
      citations: [`${DRBO}28031.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-45",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27045.htm`],
    payload: {
      slug: "canticle-of-isaiah-45",
      title: "Canticle of Isaias: Verily Thou Art a Hidden God (Isaias 45:15-26)",
      body: "Verily thou art a hidden God, the God of Israel the saviour.\nThey are all confounded and ashamed: the forgers of errors are gone together into confusion.\nIsrael is saved in the Lord with an eternal salvation: you shall not be confounded, and you shall not be ashamed for ever and ever.\nFor thus saith the Lord that created the heavens, God himself that formed the earth, and made it, the very maker thereof: he did not create it in vain: he formed it to be inhabited. I am the Lord, and there is no other.\nI have not spoken in secret, in a dark place of the earth: I have not said to the seed of Jacob: Seek me in vain. I am the Lord that speak justice, that declare right things.\nAssemble yourselves, and come, and draw near together, ye that are saved of the Gentiles: they have no knowledge that set up the wood of their graven work, and pray to a god that cannot save.\nTell ye, and come, and consult together: who hath declared this from the beginning, who hath foretold this from that time? Have not I the Lord, and there is no God else besides me? A just God and a saviour, there is none besides me.\nBe converted to me, and you shall be saved, all ye ends of the earth: for I am God, and there is no other.\nI have sworn by myself, the word of justice shall go out of my mouth, and shall not return:\nFor every knee shall be bowed to me, and every tongue shall swear.\nTherefore shall he say: In the Lord are my justices and empire: they shall come to him, and all that resist him shall be confounded.\nIn the Lord shall all the seed of Israel be justified and praised.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The hidden God who made the earth to be inhabited calls all the ends of the earth to turn to him and be saved, swearing that every knee shall bow to him, words Saint Paul applies to Christ (Philippians 2:10). The Liturgy of the Hours sings it at Morning Prayer on Friday of the first week. Douay-Rheims text, Isaias 45:15-26.",
      occasions: ["lauds", "friday", "missions"],
      relatedSaints: [],
      citations: [`${DRBO}27045.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-sirach-36",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}26036.htm`],
    payload: {
      slug: "canticle-of-sirach-36",
      title:
        "Canticle of Ecclesiasticus: Have Mercy upon Us, O God of All (Ecclesiasticus 36:1-19)",
      body: "Have mercy upon us, O God of all, and behold us, and shew us the light of thy mercies:\nAnd send thy fear upon the nations, that have not sought after thee: that they may know that there is no God beside thee, and that they may shew forth thy wonders.\nLift up thy hand over the strange nations, that they may see thy power.\nFor as thou hast been sanctified in us in their sight, so thou shalt be magnified among them in our presence,\nThat they may know thee, as we also have known thee, that there is no God beside thee, O Lord.\nRenew thy signs, and work new miracles.\nGlorify thy hand, and thy right arm.\nRaise up indignation, and pour out wrath.\nTake away the adversary, and crush the enemy.\nHasten the time, and remember the end, that they may declare thy wonderful works.\nLet him that escapeth be consumed by the rage of the fire: and let them perish that oppress thy people.\nCrush the head of the princes of the enemies that say: There is no other beside us.\nGather together all the tribes of Jacob: that they may know that there is no God besides thee, and may declare thy great works: and thou shalt inherit them as from the beginning.\nHave mercy on thy people, upon whom thy name is invoked: and upon Israel, whom thou hast raised up to be thy firstborn.\nHave mercy on Jerusalem, the city which thou hast sanctified, the city of thy rest.\nFill Sion with thy unspeakable words, and thy people with thy glory.\nGive testimony to them that are thy creatures from the beginning, and raise up the prophecies which the former prophets spoke in thy name.\nReward them that patiently wait for thee, that thy prophets may be found faithful: and hear the prayers of thy servants,\nAccording to the blessing of Aaron over thy people, and direct us into the way of justice, and let all know that dwell upon the earth, that thou art God the beholder of all ages.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The prayer of Jesus son of Sirach for the deliverance of God's people: have mercy on us, renew thy signs and work new miracles, gather the tribes of Jacob, so that all the earth may know that thou art God. Its opening verses are the canticle at Morning Prayer on Monday of the second week in the Liturgy of the Hours. Douay-Rheims text, Ecclesiasticus (Sirach) 36:1-19.",
      occasions: ["lauds", "monday", "for-the-church"],
      relatedSaints: [],
      citations: [`${DRBO}26036.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-the-three-young-men-benedictus-es",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}32003.htm`],
    payload: {
      slug: "canticle-of-the-three-young-men-benedictus-es",
      title: "Canticle of the Three Young Men: Blessed Art Thou, O Lord (Daniel 3:52-57)",
      body: "Blessed art thou, O Lord the God of our fathers: and worthy to be praised, and glorified, and exalted above all for ever: and blessed is the holy name of thy glory: and worthy to be praised, and exalted above all in all ages.\nBlessed art thou in the holy temple of thy glory: and exceedingly to be praised, and exceeding glorious for ever.\nBlessed art thou on the throne of thy kingdom, and exceedingly to be praised, and exalted above all for ever.\nBlessed art thou, that beholdest the depths, and sittest upon the cherubims: and worthy to be praised and exalted above all for ever.\nBlessed art thou in the firmament of heaven: and worthy of praise, and glorious for ever.\nAll ye works of the Lord, bless the Lord: praise and exalt him above all for ever.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The blessing of God sung by Ananias, Azarias and Misael in the fiery furnace, which leads into the Benedicite, their summons to every creature to bless the Lord. The Liturgy of the Hours sings it at Sunday Morning Prayer in the second and fourth weeks. Douay-Rheims text, Daniel 3:52-57; this part of Daniel is preserved in the Greek and Latin Bible.",
      occasions: ["lauds", "sunday", "praise"],
      relatedSaints: [],
      citations: [`${DRBO}32003.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-azariah",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}32003.htm`],
    payload: {
      slug: "prayer-of-azariah",
      title: "Prayer of Azarias in the Furnace (Daniel 3:26-45)",
      body: "Blessed art thou, O Lord, the God of our fathers, and thy name is worthy of praise, and glorious for ever:\nFor thou art just in all that thou hast done to us, and all thy works are true, and thy ways right, and all thy judgments true.\nFor thou hast executed true judgments in all the things that thou hast brought upon us, and upon Jerusalem the holy city of our fathers: for according to truth and judgment, thou hast brought all these things upon us for our sins.\nFor we have sinned, and committed iniquity, departing from thee: and we have trespassed in all things:\nAnd we have not hearkened to thy commandments, nor have we observed nor done as thou hadst commanded us, that it might go well with us.\nWherefore all that thou hast brought upon us, and every thing that thou hast done to us, thou hast done in true judgment:\nAnd thou hast delivered us into the hands of our enemies that are unjust, and most wicked, and prevaricators, and to a king unjust, and most wicked beyond all that are upon the earth.\nAnd now we cannot open our mouths: we are become a shame and reproach to thy servants, and to them that worship thee.\nDeliver us not up for ever, we beseech thee, for thy name's sake, and abolish not thy covenant.\nAnd take not away thy mercy from us for the sake of Abraham thy beloved, and Isaac thy servant, and Israel thy holy one:\nTo whom thou hast spoken, promising that thou wouldst multiply their seed as the stars of heaven, and as the sand that is on the sea shore.\nFor we, O Lord, are diminished more than any nation, and are brought low in all the earth this day for our sins.\nNeither is there at this time prince, or leader, or prophet, or holocaust, or sacrifice, or oblation, or incense, or place of firstfruits before thee,\nThat we may find thy mercy: nevertheless in a contrite heart and humble spirit let us be accepted.\nAs in holocausts of rams, and bullocks, and as in thousands of fat lambs: so let our sacrifice be made in thy sight this day, that it may please thee: for there is no confusion to them that trust in thee.\nAnd now we follow thee with all our heart, and we fear thee, and seek thy face.\nPut us not to confusion, but deal with us according to thy meekness, and according to the multitude of thy mercies.\nAnd deliver us according to thy wonderful works, and give glory to thy name, O Lord:\nAnd let all them be confounded that shew evils to thy servants, let them be confounded in all thy might, and let their strength be broken.\nAnd let them know that thou art the Lord, the only God, and glorious over all the world.",
      prayerType: "canticle",
      category: "penitential",
      language: "en",
      summary:
        "The prayer of Azarias, one of the three young men, standing in the midst of the flames: a confession of his people's sins and a plea that a contrite heart and humble spirit be accepted in place of holocausts, for there is no confusion to them that trust in God. Part of it is the canticle at Morning Prayer on Tuesday of the fourth week in the Liturgy of the Hours. Douay-Rheims text, Daniel 3:26-45; this part of Daniel is preserved in the Greek and Latin Bible.",
      occasions: ["lauds", "lent", "penance"],
      relatedSaints: [],
      citations: [`${DRBO}32003.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-2",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27002.htm`],
    payload: {
      slug: "canticle-of-isaiah-2",
      title: "Canticle of Isaias: the Mountain of the House of the Lord (Isaias 2:2-5)",
      body: "And in the last days the mountain of the house of the Lord shall be prepared on the top of mountains, and it shall be exalted above the hills, and all nations shall flow unto it.\nAnd many people shall go, and say: Come and let us go up to the mountain of the Lord, and to the house of the God of Jacob, and he will teach us his ways, and we will walk in his paths: for the law shall come forth from Sion, and the word of the Lord from Jerusalem.\nAnd he shall judge the Gentiles, and rebuke many people: and they shall turn their swords into ploughshares, and their spears into sickles: nation shall not lift up sword against nation, neither shall they be exercised any more to war.\nO house of Jacob, come ye, and let us walk in the light of the Lord.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The vision of all nations streaming to the mountain of the Lord's house in the last days, when the word of the Lord goes forth from Jerusalem and swords are turned into ploughshares. The Liturgy of the Hours sings it at Morning Prayer on Monday of the third week. Douay-Rheims text, Isaias 2:2-5.",
      occasions: ["lauds", "monday", "advent", "peace"],
      relatedSaints: [],
      citations: [`${DRBO}27002.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-26",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27026.htm`, `${DR_1899}n544/mode/1up`],
    payload: {
      slug: "canticle-of-isaiah-26",
      title: "Canticle of Isaias: Sion the City of Our Strength (Isaias 26:1-12)",
      body: "In that day shall this canticle be sung in the land of Juda. Sion the city of our strength a saviour, a wall and a bulwark shall be set therein.\nOpen ye the gates, and let the just nation, that keepeth the truth, enter in.\nThe old error is passed away: thou wilt keep peace: peace, because we have hoped in thee.\nYou have hoped in the Lord for evermore, in the Lord God mighty for ever.\nFor he shall bring down them that dwell on high, the high city he shall lay low. He shall bring it down even to the ground, he shall pull it down even to the dust.\nThe foot shall tread it down, the feet of the poor, the steps of the needy.\nThe way of the just is right, the path of the just is right to walk in.\nAnd in the way of thy judgments, O Lord, we have patiently waited for thee: thy name, and thy remembrance are the desire of the soul.\nMy soul hath desired thee in the night: yea, and with my spirit within me in the morning early I will watch to thee. When thou shalt do thy judgments on the earth, the inhabitants of the world shall learn justice.\nLet us have pity on the wicked, but he will not learn justice: in the land of the saints he hath done wicked things, and he shall not see the glory of the Lord.\nLord, let thy hand be exalted, and let them not see: let the envious people see, and be confounded: and let fire devour thy enemies.\nLord, thou wilt give us peace: for thou hast wrought all our works for us.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The song to be sung in the land of Juda on the day of salvation: open the gates to the just nation, for the Lord keeps in peace those who hope in him, and the soul desires him in the night. The Liturgy of the Hours sings verses from it at Morning Prayer on Tuesday of the third week. Douay-Rheims text, Isaias 26:1-12.",
      occasions: ["lauds", "tuesday", "trust", "peace"],
      relatedSaints: [],
      citations: [`${DRBO}27026.htm`, `${DR_1899}n544/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-33",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27033.htm`],
    payload: {
      slug: "canticle-of-isaiah-33",
      title: "Canticle of Isaias: Who Shall Dwell with Everlasting Burnings? (Isaias 33:13-16)",
      body: "Hear, you that are far off, what I have done, and you that are near know my strength.\nThe sinners in Sion are afraid, trembling hath seized upon the hypocrites. Which of you can dwell with devouring fire? which of you shall dwell with everlasting burnings?\nHe that walketh in justices, and speaketh truth, that casteth away avarice by oppression, and shaketh his hands from all bribes, that stoppeth his ears lest he hear blood, and shutteth his eyes that he may see no evil.\nHe shall dwell on high, the fortifications of rocks shall be his highness: bread is given him, his waters are sure.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "God's question to the sinners in Sion, which of you can dwell with devouring fire, and his answer: the one who walks in justice, speaks truth, refuses bribes and shuts his eyes to evil shall dwell on high. The Liturgy of the Hours sings it at Morning Prayer on Wednesday of the third week. Douay-Rheims text, Isaias 33:13-16.",
      occasions: ["lauds", "wednesday", "examination-of-conscience"],
      relatedSaints: [],
      citations: [`${DRBO}27033.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-40",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27040.htm`],
    payload: {
      slug: "canticle-of-isaiah-40",
      title: "Canticle of Isaias: He Shall Feed His Flock (Isaias 40:10-17)",
      body: "Behold the Lord God shall come with strength, and his arm shall rule: Behold his reward is with him and his work is before him.\nHe shall feed his flock like a shepherd: he shall gather together the lambs with his arm, and shall take them up in his bosom, and he himself shall carry them that are with young.\nWho hath measured the waters in the hollow of his hand, and weighed the heavens with his palm? who hath poised with three fingers the bulk of the earth, and weighed the mountains in scales, and the hills in a balance?\nWho hath forwarded the spirit of the Lord? or who hath been his counsellor, and hath taught him?\nWith whom hath he consulted, and who hath instructed him, and taught him the path of justice, and taught him knowledge, and shewed him the way of understanding?\nBehold the Gentiles are as a drop of a bucket, and are counted as the smallest grain of a balance: behold the islands are as a little dust.\nAnd Libanus shall not be enough to burn, nor the beasts thereof sufficient for a burnt offering.\nAll nations are before him as if they had no being at all, and are counted to him as nothing, and vanity.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The Lord God comes with strength, yet feeds his flock like a shepherd and carries the lambs in his bosom; before him who measured the waters in his hand the nations are as a drop of a bucket. The Liturgy of the Hours sings it at Morning Prayer on Thursday of the third week. Douay-Rheims text, Isaias 40:10-17.",
      occasions: ["lauds", "thursday", "advent"],
      relatedSaints: [],
      citations: [`${DRBO}27040.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-jeremiah-14",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}28014.htm`],
    payload: {
      slug: "canticle-of-jeremiah-14",
      title: "Canticle of Jeremias in Time of Affliction (Jeremias 14:17-22)",
      body: "And thou shalt speak this word to them: Let my eyes shed down tears night and day, and let them not cease, because the virgin daughter of my people is afflicted with a great affliction, with an exceeding grievous evil.\nIf I go forth into the fields, behold the slain with the sword: and if I enter into the city, behold them that are consumed with famine. The prophet also and the priest are gone into a land which they knew not.\nHast thou utterly cast away Juda, or hath thy soul abhorred Sion? why then hast thou struck us, so that there is no healing for us? we have looked for peace, and there is no good: and for the time of healing, and behold trouble.\nWe acknowledge, O Lord, our wickedness, the iniquities of our fathers, because we have sinned against thee.\nGive us not to be a reproach, for thy name's sake, and do not disgrace in us the throne of thy glory: remember, break not thy covenant with us.\nAre there any among the graven things of the Gentiles that can send rain? or can the heavens give showers? art not thou the Lord our God, whom we have looked for? for thou hast made all these things.",
      prayerType: "canticle",
      category: "penitential",
      language: "en",
      summary:
        "The prophet's lament over his people struck by sword and famine, and the confession that follows: we acknowledge, O Lord, our wickedness; remember, break not thy covenant with us. The Liturgy of the Hours sings verses 17-21 at Morning Prayer on Friday of the third week. Douay-Rheims text, Jeremias 14:17-22.",
      occasions: ["lauds", "friday", "lent", "penance"],
      relatedSaints: [],
      citations: [`${DRBO}28014.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-solomon-for-wisdom",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}25009.htm`],
    payload: {
      slug: "prayer-of-solomon-for-wisdom",
      title: "Prayer of Solomon for Wisdom (Wisdom 9)",
      body: "God of my fathers, and Lord of mercy, who hast made all things with thy word,\nAnd by thy wisdom hast appointed man, that he should have dominion over the creature that was made by thee,\nThat he should order the world according to equity and justice, and execute justice with an upright heart:\nGive me wisdom, that sitteth by thy throne, and cast me not off from among thy children:\nFor I am thy servant, and the son of thy handmaid, a weak man, and of short time, and falling short of the understanding of judgment and laws.\nFor if one be perfect among the children of men, yet if thy wisdom be not with him, he shall be nothing regarded.\nThou hast chosen me to be king of thy people, and a judge of thy sons and daughters.\nAnd hast commanded me to build a temple on thy holy mount, and an altar in the city of thy dwelling place, a resemblance of thy holy tabernacle, which thou hast prepared from the beginning:\nAnd thy wisdom with thee, which knoweth thy works, which then also was present when thou madest the world, and knew what was agreeable to thy eyes, and what was right in thy commandments.\nSend her out of thy holy heaven, and from the throne of thy majesty, that she may be with me, and may labour with me, that I may know what is acceptable with thee:\nFor she knoweth and understandeth all things, and shall lead me soberly in my works, and shall preserve me by her power.\nSo shall my works be acceptable, and I shall govern thy people justly, and shall be worthy of the throne of my father.\nFor who among men is he that can know the counsel of God? or who can think what the will of God is?\nFor the thoughts of mortal men are fearful, and our counsels uncertain.\nFor the corruptible body is a load upon the soul, and the earthly habitation presseth down the mind that museth upon many things.\nAnd hardly do we guess aright at things that are upon earth: and with labour do we find the things that are before us. But the things that are in heaven, who shall search out?\nAnd who shall know thy thought, except thou give wisdom, and send thy Holy Spirit from above:\nAnd so the ways of them that are upon earth may be corrected, and men may learn the things that please thee?\nFor by wisdom they were healed, whosoever have pleased thee, O Lord, from the beginning.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "Solomon's prayer for the wisdom that sits beside God's throne, without which no man can know the counsel of God or govern justly. Part of it is the canticle at Morning Prayer on Saturday of the third week in the Liturgy of the Hours, and it is often prayed before study or a weighty decision. Douay-Rheims text of the whole chapter, Wisdom 9:1-19.",
      occasions: ["lauds", "saturday", "before-study", "discernment"],
      relatedSaints: [],
      citations: [`${DRBO}25009.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-42",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27042.htm`, `${DR_1899}n555/mode/1up`],
    payload: {
      slug: "canticle-of-isaiah-42",
      title: "Canticle of Isaias: Sing Ye to the Lord a New Song (Isaias 42:10-16)",
      body: "Sing ye to the Lord a new song, his praise is from the ends of the earth: you that go down to the sea, and all that are therein: ye islands, and ye inhabitants of them.\nLet the desert and the cities thereof be exalted: Cedar shall dwell in houses: ye inhabitants of Petra, give praise, they shall cry from the top of the mountains.\nThey shall give glory to the Lord, and shall declare his praise in the islands.\nThe Lord shall go forth as a mighty man, as a man of war shall he stir up zeal: he shall shout and cry: he shall prevail against his enemies.\nI have always held my peace, I have kept silence, I have been patient, I will speak now as a woman in labour: I will destroy, and swallow up at once.\nI will lay waste the mountains and hills, and will make all their grass to wither: and I will turn rivers into islands, and will dry up the standing pools.\nAnd I will lead the blind into the way which they know not: and in the paths which they were ignorant of I will make them walk: I will make darkness light before them, and crooked things straight: these things have I done to them, and have not forsaken them.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The whole earth, the sea and the islands are called to sing a new song to the Lord, who goes forth like a mighty man and leads the blind by paths they have not known, making darkness light before them. The Liturgy of the Hours sings it at Morning Prayer on Monday of the fourth week. Douay-Rheims text, Isaias 42:10-16.",
      occasions: ["lauds", "monday", "praise"],
      relatedSaints: [],
      citations: [`${DRBO}27042.htm`, `${DR_1899}n555/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-61",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27061.htm`, `${DRBO}27062.htm`],
    payload: {
      slug: "canticle-of-isaiah-61",
      title: "Canticle of Isaias: I Will Greatly Rejoice in the Lord (Isaias 61:10-62:5)",
      body: "I will greatly rejoice in the Lord, and my soul shall be joyful in my God: for he hath clothed me with the garments of salvation: and with the robe of justice he hath covered me, as a bridegroom decked with a crown, and as a bride adorned with her jewels.\nFor as the earth bringeth forth her bud, and as the garden causeth her seed to shoot forth: so shall the Lord God make justice to spring forth, and praise before all the nations.\nFor Sion's sake I will not hold my peace, and for the sake of Jerusalem, I will not rest till her just one come forth as brightness, and her saviour be lighted as a lamp.\nAnd the Gentiles shall see thy just one, and all kings thy glorious one: and thou shalt be called by a new name, which the mouth of the Lord shall name.\nAnd thou shalt be a crown of glory in the hand of the Lord, and a royal diadem in the hand of thy God.\nThou shalt no more be called Forsaken: and thy land shall no more be called Desolate: but thou shalt be called My pleasure in her, and thy land inhabited. Because the Lord hath been well pleased with thee: and thy land shall be inhabited.\nFor the young man shall dwell with the virgin, and thy children shall dwell in thee. And the bridegroom shall rejoice over the bride, and thy God shall rejoice over thee.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The soul rejoices in God who has clothed it with the garments of salvation like a bride adorned with her jewels, and Sion receives a new name, for the Lord delights in her as the bridegroom in the bride. The Liturgy of the Hours sings it at Morning Prayer on Wednesday of the fourth week. Douay-Rheims text, Isaias 61:10-62:5.",
      occasions: ["lauds", "wednesday", "advent", "thanksgiving"],
      relatedSaints: [],
      citations: [`${DRBO}27061.htm`, `${DRBO}27062.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-isaiah-66",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}27066.htm`],
    payload: {
      slug: "canticle-of-isaiah-66",
      title: "Canticle of Isaias: Rejoice with Jerusalem (Isaias 66:10-14)",
      body: "Rejoice with Jerusalem, and be glad with her, all you that love her: rejoice for joy with her, all you that mourn for her.\nThat you may suck, and be filled with the breasts of her consolations: that you may milk out, and flow with delights, from the abundance of her glory.\nFor thus saith the Lord: Behold I will bring upon her as it were a river of peace, and as an overflowing torrent the glory of the Gentiles, which you shall suck; you shall be carried at the breasts, and upon the knees they shall caress you.\nAs one whom the mother caresseth, so will I comfort you, and you shall be comforted in Jerusalem.\nYou shall see and your heart shall rejoice, and your bones shall flourish like an herb, and the hand of the Lord shall be known to his servants, and he shall be angry with his enemies.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "Rejoice with Jerusalem: the Lord promises to bring upon her peace like a river and to comfort his people as a mother comforts her child. The Liturgy of the Hours sings it at Morning Prayer on Thursday of the fourth week. Douay-Rheims text, Isaias 66:10-14.",
      occasions: ["lauds", "thursday", "peace"],
      relatedSaints: [],
      citations: [`${DRBO}27066.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-ezekiel-36",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}31036.htm`],
    payload: {
      slug: "canticle-of-ezekiel-36",
      title: "Canticle of Ezechiel: a New Heart and a New Spirit (Ezechiel 36:24-28)",
      body: "For I will take you from among the Gentiles, and will gather you together out of all the countries, and will bring you into your own land.\nAnd I will pour upon you clean water, and you shall be cleansed from all your filthiness, and I will cleanse you from all your idols.\nAnd I will give you a new heart, and put a new spirit within you: and I will take away the stony heart out of your flesh, and will give you a heart of flesh.\nAnd I will put my spirit in the midst of you: and I will cause you to walk in my commandments, and to keep my judgments, and do them.\nAnd you shall dwell in the land which I gave to your fathers, and you shall be my people, and I will be your God.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "God's promise to gather his scattered people, pour clean water upon them, take away the stony heart and give them a new heart and his own spirit. It is read at the Easter Vigil and sung at Morning Prayer on Saturday of the fourth week in the Liturgy of the Hours. Douay-Rheims text, Ezechiel 36:24-28.",
      occasions: ["lauds", "saturday", "easter-vigil", "baptism"],
      relatedSaints: [],
      citations: [`${DRBO}31036.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-ephesians-1",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}56001.htm`],
    payload: {
      slug: "canticle-of-ephesians-1",
      title: "Canticle of Ephesians (Ephesians 1:3-10)",
      body: "Blessed be the God and Father of our Lord Jesus Christ, who hath blessed us with spiritual blessings in heavenly places, in Christ:\nAs he chose us in him before the foundation of the world, that we should be holy and unspotted in his sight in charity.\nWho hath predestinated us unto the adoption of children through Jesus Christ unto himself: according to the purpose of his will:\nUnto the praise of the glory of his grace, in which he hath graced us in his beloved son.\nIn whom we have redemption through his blood, the remission of sins, according to the riches of his grace,\nWhich hath superabounded in us in all wisdom and prudence,\nThat he might make known unto us the mystery of his will, according to his good pleasure, which he hath purposed in him,\nIn the dispensation of the fulness of times, to re-establish all things in Christ, that are in heaven and on earth, in him.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "Saint Paul's blessing of the Father, who chose us in Christ before the foundation of the world, made us his adopted children, and made known the mystery of his will: to re-establish all things in Christ. The Liturgy of the Hours sings it at Evening Prayer every Monday. Douay-Rheims text, Ephesians 1:3-10.",
      occasions: ["vespers", "monday", "thanksgiving"],
      relatedSaints: ["saint-paul"],
      citations: [`${DRBO}56001.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-1-peter-2",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}67002.htm`],
    payload: {
      slug: "canticle-of-1-peter-2",
      title: "Canticle of First Peter: Christ Suffered for Us (1 Peter 2:21-24)",
      body: "For unto this are you called: because Christ also suffered for us, leaving you an example that you should follow his steps.\nWho did no sin, neither was guile found in his mouth.\nWho, when he was reviled, did not revile: when he suffered, he threatened not: but delivered himself to him that judged him unjustly.\nWho his own self bore our sins in his body upon the tree: that we, being dead to sins, should live to justice: by whose stripes you were healed.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "Saint Peter's hymn of the suffering Christ, who did no sin, was reviled and did not revile, and bore our sins in his body upon the tree, so that by his stripes we are healed. The Liturgy of the Hours sings it at Sunday Evening Prayer in Lent. Douay-Rheims text, 1 Peter 2:21-24.",
      occasions: ["vespers", "sunday", "lent", "passion"],
      relatedSaints: ["saint-peter"],
      citations: [`${DRBO}67002.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-moses-and-the-lamb",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}73015.htm`],
    payload: {
      slug: "canticle-of-moses-and-the-lamb",
      title: "Canticle of Moses and the Lamb (Apocalypse 15:3-4)",
      body: "And singing the canticle of Moses, the servant of God, and the canticle of the Lamb, saying: Great and wonderful are thy works, O Lord God Almighty; just and true are thy ways, O King of ages.\nWho shall not fear thee, O Lord, and magnify thy name? For thou only art holy: for all nations shall come, and shall adore in thy sight, because thy judgments are manifest.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The song of those who have conquered the beast, standing on the sea of glass with the harps of God: great and wonderful are thy works, O Lord God Almighty; all nations shall come and adore in thy sight. The Liturgy of the Hours sings it at Evening Prayer on Fridays. Douay-Rheims text, Apocalypse 15:3-4.",
      occasions: ["vespers", "friday", "praise"],
      relatedSaints: [],
      citations: [`${DRBO}73015.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-the-marriage-of-the-lamb",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}73019.htm`],
    payload: {
      slug: "canticle-of-the-marriage-of-the-lamb",
      title: "Canticle of the Marriage of the Lamb: Alleluia (Apocalypse 19:1-7)",
      body: "After these things I heard as it were the voice of much people in heaven, saying: Alleluia. Salvation, and glory, and power is to our God.\nFor true and just are his judgments, who hath judged the great harlot which corrupted the earth with her fornication, and hath revenged the blood of his servants, at her hands.\nAnd again they said: Alleluia. And her smoke ascendeth for ever and ever.\nAnd the four and twenty ancients, and the four living creatures fell down and adored God that sitteth upon the throne, saying: Amen; Alleluia.\nAnd a voice came out from the throne, saying: Give praise to our God, all ye his servants; and you that fear him, little and great.\nAnd I heard as it were the voice of a great multitude, and as the voice of many waters, and as the voice of great thunders, saying, Alleluia: for the Lord our God the Almighty hath reigned.\nLet us be glad and rejoice, and give glory to him; for the marriage of the Lamb is come, and his wife hath prepared herself.",
      prayerType: "canticle",
      category: "liturgical",
      language: "en",
      summary:
        "The Alleluia of the great multitude in heaven over the justice of God's judgments and the coming of the marriage of the Lamb. The Liturgy of the Hours sings verses from it, with an Alleluia refrain, at Sunday Evening Prayer outside Lent. Douay-Rheims text, Apocalypse 19:1-7.",
      occasions: ["vespers", "sunday", "easter", "praise"],
      relatedSaints: [],
      citations: [`${DRBO}73019.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-jeremiah-lamentations-5",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}29005.htm`],
    payload: {
      slug: "prayer-of-jeremiah-lamentations-5",
      title: "Prayer of Jeremias: Remember, O Lord (Lamentations 5)",
      body: "Remember, O Lord, what is come upon us: consider and behold our reproach.\nOur inheritance is turned to aliens: our houses to strangers.\nWe are become orphans without a father: our mothers are as widows.\nWe have drunk our water for money: we have bought our wood.\nWe were dragged by the necks, we were weary and no rest was given us.\nWe have given our hand to Egypt, and to the Assyrians, that we might be satisfied with bread.\nOur fathers have sinned, and are not: and we have borne their iniquities.\nServants have ruled over us: there was none to redeem us out of their hand.\nWe fetched our bread at the peril of our lives, because of the sword in the desert.\nOur skin was burnt as an oven, by reason of the violence of the famine.\nThey oppressed the women in Sion, and the virgins in the cities of Juda.\nThe princes were hanged up by their hand: they did not respect the persons of the ancient.\nThey abused the young men indecently: and the children fell under the wood.\nThe ancients have ceased from the gates: the young men from the choir of the singers.\nThe joy of our heart is ceased, our dancing is turned into mourning.\nThe crown is fallen from our head: woe to us, because we have sinned.\nTherefore is our heart sorrowful, therefore are our eyes become dim,\nFor mount Sion, because it is destroyed, foxes have walked upon it.\nBut thou, O Lord, shalt remain for ever, thy throne from generation to generation.\nWhy wilt thou forget us for ever? why wilt thou forsake us for a long time?\nConvert us, O Lord, to thee, and we shall be converted: renew our days, as from the beginning.\nBut thou hast utterly rejected us, thou art exceedingly angry against us.",
      prayerType: "general",
      category: "penitential",
      language: "en",
      summary:
        "The last chapter of the Lamentations, headed in the Latin Bible Oratio Ieremiae prophetae: the plea of the conquered people of Jerusalem, remember, O Lord, what is come upon us ... convert us, O Lord, to thee, and we shall be converted. Its opening verses were sung at Tenebrae on Holy Saturday. Douay-Rheims text, Lamentations 5:1-22.",
      occasions: ["holy-week", "lent", "penance"],
      relatedSaints: [],
      citations: [`${DRBO}29005.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-daniel-for-his-people",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}32009.htm`],
    payload: {
      slug: "prayer-of-daniel-for-his-people",
      title: "Prayer of Daniel for His People (Daniel 9:4-19)",
      body: "And I prayed to the Lord my God, and I made my confession, and said: I beseech thee, O Lord God, great and terrible, who keepest the covenant, and mercy to them that love thee, and keep thy commandments.\nWe have sinned, we have committed iniquity, we have done wickedly, and have revolted: and we have gone aside from thy commandments, and thy judgments.\nWe have not hearkened to thy servants the prophets, that have spoken in thy name to our kings, to our princes, to our fathers, and to all the people of the land.\nTo thee, O Lord, justice: but to us confusion of face, as at this day to the men of Juda, and to the inhabitants of Jerusalem, and to all Israel to them that are near, and to them that are far off in all the countries whither thou hast driven them, for their iniquities by which they have sinned against thee.\nO Lord, to us belongeth confusion of face, to our princes, and to our fathers that have sinned.\nBut to thee, the Lord our God, mercy and forgiveness, for we have departed from thee:\nAnd we have not hearkened to the voice of the Lord our God, to walk in his law, which he set before us by his servants the prophets.\nAnd all Israel have transgressed thy law, and have turned away from hearing thy voice, and the malediction, and the curse, which is written in the book of Moses the servant of God, is fallen upon us, because we have sinned against him.\nAnd he hath confirmed his words which he spoke against us, and against our princes that judged us, that he would bring in upon us a great evil, such as never was under all the heaven, according to that which hath been done in Jerusalem.\nAs it is written in the law of Moses, all this evil is come upon us: and we entreated not thy face, O Lord our God, that we might turn from our iniquities, and think on thy truth.\nAnd the Lord hath watched upon the evil, and hath brought it upon us: the Lord our God is just in all his works which he hath done: for we have not hearkened to his voice.\nAnd now, O Lord our God, who hast brought forth thy people out of the land of Egypt with a strong hand, and hast made thee a name as at this day: we have sinned, we have committed iniquity,\nO Lord, against all thy justice: let thy wrath and thy indignation be turned away, I beseech thee, from thy city Jerusalem, and from thy holy mountain. For by reason of our sins, and the iniquities of our fathers, Jerusalem, and thy people are a reproach to all that are round about us.\nNow therefore, O our God, hear the supplication of thy servant, and his prayers: and shew thy face upon thy sanctuary which is desolate, for thy own sake.\nIncline, O my God, thy ear, and hear: open thy eyes, and see our desolation, and the city upon which thy name is called: for it is not for our justifications that we present our prayers before thy face, but for the multitude of thy tender mercies.\nO Lord, hear: O Lord, be appeased: hearken and do: delay not for thy own sake, O my God: because thy name is invocated upon thy city, and upon thy people.",
      prayerType: "general",
      category: "penitential",
      language: "en",
      summary:
        "Daniel's confession for his people, made with fasting, sackcloth and ashes: we have sinned, we have committed iniquity; it is not for our justifications that we present our prayers before thy face, but for the multitude of thy tender mercies. Douay-Rheims text, Daniel 9:4-19.",
      occasions: ["lent", "penance", "for-the-church"],
      relatedSaints: [],
      citations: [`${DRBO}32009.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-queen-esther",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}19014.htm`],
    payload: {
      slug: "prayer-of-queen-esther",
      title: "Prayer of Queen Esther (Esther 14:3-19)",
      body: "And she prayed to the Lord the God of Israel, saying: O my Lord, who alone art our king, help me a desolate woman, and who have no other helper but thee.\nMy danger is in my hands.\nI have heard of my father that thou, O Lord, didst take Israel from among all nations, and our fathers from all their predecessors, to possess them as an everlasting inheritance, and thou hast done to them as thou hast promised.\nWe have sinned in thy sight, and therefore thou hast delivered us into the hands of our enemies:\nFor we have worshipped their gods. Thou art just, O Lord.\nAnd now they are not content to oppress us with most hard bondage, but attributing the strength of their hands to the power of their idols,\nThey design to change thy promises, and destroy thy inheritance, and shut the mouths of them that praise thee, and extinguish the glory of thy temple and altar,\nThat they may open the mouths of Gentiles, and praise the strength of idols, and magnify for ever a carnal king.\nGive not, O Lord, thy sceptre to them that are not, lest they laugh at our ruin: but turn their counsel upon themselves, and destroy him that hath begun to rage against us.\nRemember, O Lord, and shew thyself to us in the time of our tribulation, and give me boldness, O Lord, king of gods, and of all power:\nGive me a well ordered speech in my mouth in the presence of the lion, and turn his heart to the hatred of our enemy, that both he himself may perish, and the rest that consent to him.\nBut deliver us by thy hand, and help me, who have no other helper, but thee, O Lord, who hast the knowledge of all things.\nAnd thou knowest that I hate the glory of the wicked, and abhor the bed of the uncircumcised, and of every stranger.\nThou knowest my necessity, that I abominate the sign of my pride and glory, which is upon my head in the days of my public appearance, and detest it as a menstruous rag, and wear it not in the days of my silence,\nAnd that I have not eaten at Aman's table, nor hath the king's banquet pleased me, and that I have not drunk the wine of the drink offerings:\nAnd that thy handmaid hath never rejoiced, since I was brought hither unto this day, but in thee, O Lord, the God of Abraham.\nO God, who art mighty above all, hear the voice of them, that have no other hope, and deliver us from the hand of the wicked, and deliver me from my fear.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "The prayer of Esther before she went in unbidden to the king to plead for her people: O my Lord, who alone art our king, help me a desolate woman, who have no other helper but thee. This passage belongs to the parts of Esther preserved in the Greek and Latin Bible. Douay-Rheims text, Esther 14:3-19.",
      occasions: ["times-of-trouble", "protection", "trust"],
      relatedSaints: [],
      citations: [`${DRBO}19014.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-tobit-in-affliction",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}17003.htm`],
    payload: {
      slug: "prayer-of-tobit-in-affliction",
      title: "Prayer of Tobias in Affliction (Tobias 3:1-6)",
      body: "Then Tobias sighed, and began to pray with tears,\nSaying: Thou art just, O Lord, and all thy judgments are just, and all thy ways mercy, and truth, and judgment:\nAnd now, O Lord, think of me, and take not revenge of my sins, neither remember my offenses, nor those of my parents.\nFor we have not obeyed thy commandments, therefore are we delivered to spoil and to captivity, and death, and are made a fable, and a reproach to all nations, amongst which thou hast scattered us.\nAnd now, O Lord, great are thy judgments, because we have not done according to thy precepts, and have not walked sincerely before thee:\nAnd now, O Lord, do with me according to thy will, and command my spirit to be received in peace: for it is better for me to die, than to live.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "The prayer of the blind and grieving Tobias, made with tears: thou art just, O Lord, and all thy ways mercy and truth; do with me according to thy will. The same day the prayer of Sara was heard, and the angel Raphael was sent to heal them both. Douay-Rheims text, Tobias (Tobit) 3:1-6.",
      occasions: ["suffering", "trial", "sickness"],
      relatedSaints: [],
      citations: [`${DRBO}17003.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-sarah-daughter-of-raguel",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}17003.htm`],
    payload: {
      slug: "prayer-of-sarah-daughter-of-raguel",
      title: "Prayer of Sara, Daughter of Raguel (Tobias 3:13-23)",
      body: "She said: Blessed is thy name, O God of our fathers: who when thou hast been angry, wilt shew mercy, and in the time of tribulation forgivest the sins of them that call upon thee.\nTo thee, O Lord, I turn my face, to thee I direct my eyes.\nI beg, O Lord, that thou loose me from the bond of this reproach, or else take me away from the earth.\nThou knowest, O Lord, that I never coveted a husband, and have kept my soul clean from all lust.\nNever have I joined myself with them that play: neither have I made myself partaker with them that walk in lightness.\nBut a husband I consented to take, with thy fear, not with my lust.\nAnd either I was unworthy of them, or they perhaps were not worthy of me: because perhaps thou hast kept me for another man.\nFor thy counsel is not in man's power.\nBut this every one is sure of that worshippeth thee, that his life, if it be under trial, shall be crowned: and if it be under tribulation, it shall be delivered: and if it be under correction, it shall be allowed to come to thy mercy.\nFor thou art not delighted in our being lost: because after a storm thou makest a calm, and after tears and weeping thou pourest in joyfulness.\nBe thy name, O God of Israel, blessed for ever.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "The prayer of Sara after three days of fasting under a cruel reproach: to thee, O Lord, I turn my face; after a storm thou makest a calm, and after tears and weeping thou pourest in joyfulness. God heard her and sent the angel Raphael, and she became the wife of the younger Tobias. Douay-Rheims text, Tobias (Tobit) 3:13-23.",
      occasions: ["trial", "marriage", "suffering"],
      relatedSaints: [],
      citations: [`${DRBO}17003.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-tobias-and-sara",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}17008.htm`],
    payload: {
      slug: "prayer-of-tobias-and-sara",
      title: "Prayer of Tobias and Sara on Their Wedding Night (Tobias 8:4-10)",
      body: "Then Tobias exhorted the virgin, and said to her: Sara, arise, and let us pray to God today, and tomorrow, and the next day: because for these three nights we are joined to God: and when the third night is over, we will be in our own wedlock.\nFor we are the children of saints, and we must not be joined together like heathens that know not God.\nSo they both arose, and prayed earnestly both together that health might be given them,\nAnd Tobias said: Lord God of our father, may the heavens and the earth, and the sea, and the fountains, and the rivers, and all thy creatures that are in them, bless thee.\nThou madest Adam of the slime of the earth, and gavest him Eve for a helper.\nAnd now, Lord, thou knowest, that not for fleshly lust do I take my sister to wife, but only for the love of posterity, in which thy name may be blessed for ever and ever.\nSara also said: Have mercy on us, O Lord, have mercy on us, and let us grow old both together in health.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "The prayer of the newly married Tobias and Sara, who rose to pray together before they came together as husband and wife: may all thy creatures bless thee; not for fleshly lust do I take my sister to wife; have mercy on us, O Lord, and let us grow old both together in health. It is among the readings offered for the celebration of marriage. Douay-Rheims text, Tobias (Tobit) 8:4-10.",
      occasions: ["marriage", "families"],
      relatedSaints: [],
      citations: [`${DRBO}17008.htm`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "priestly-prayer-of-jesus-john-17",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${DRBO}50017.htm`, `${DR_1899}n843/mode/1up`],
    payload: {
      slug: "priestly-prayer-of-jesus-john-17",
      title: "Prayer of Jesus for His Disciples (John 17)",
      body: "These things Jesus spoke, and lifting up his eyes to heaven, he said: Father, the hour is come, glorify thy Son, that thy Son may glorify thee.\nAs thou hast given him power over all flesh, that he may give eternal life to all whom thou hast given him.\nNow this is eternal life: That they may know thee, the only true God, and Jesus Christ, whom thou hast sent.\nI have glorified thee on the earth; I have finished the work which thou gavest me to do.\nAnd now glorify thou me, O Father, with thyself, with the glory which I had, before the world was, with thee.\nI have manifested thy name to the men whom thou hast given me out of the world. Thine they were, and to me thou gavest them; and they have kept thy word.\nNow they have known, that all things which thou hast given me, are from thee:\nBecause the words which thou gavest me, I have given to them; and they have received them, and have known in very deed that I came out from thee, and they have believed that thou didst send me.\nI pray for them: I pray not for the world, but for them whom thou hast given me: because they are thine:\nAnd all my things are thine, and thine are mine; and I am glorified in them.\nAnd now I am not in the world, and these are in the world, and I come to thee. Holy Father, keep them in thy name whom thou hast given me; that they may be one, as we also are.\nWhile I was with them, I kept them in thy name. Those whom thou gavest me have I kept; and none of them is lost, but the son of perdition, that the scripture may be fulfilled.\nAnd now I come to thee; and these things I speak in the world, that they may have my joy filled in themselves.\nI have given them thy word, and the world hath hated them, because they are not of the world; as I also am not of the world.\nI pray not that thou shouldst take them out of the world, but that thou shouldst keep them from evil.\nThey are not of the world, as I also am not of the world.\nSanctify them in truth. Thy word is truth.\nAs thou hast sent me into the world, I also have sent them into the world.\nAnd for them do I sanctify myself, that they also may be sanctified in truth.\nAnd not for them only do I pray, but for them also who through their word shall believe in me;\nThat they all may be one, as thou, Father, in me, and I in thee; that they also may be one in us; that the world may believe that thou hast sent me.\nAnd the glory which thou hast given me, I have given to them; that they may be one, as we also are one:\nI in them, and thou in me; that they may be made perfect in one: and the world may know that thou hast sent me, and hast loved them, as thou hast also loved me.\nFather, I will that where I am, they also whom thou hast given me may be with me; that they may see my glory which thou hast given me, because thou hast loved me before the creation of the world.\nJust Father, the world hath not known thee; but I have known thee: and these have known that thou hast sent me.\nAnd I have made known thy name to them, and will make it known; that the love wherewith thou hast loved me, may be in them, and I in them.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "The prayer Jesus offered to the Father at the Last Supper before going out to his Passion: that the Father glorify the Son, that he keep the disciples from evil and sanctify them in truth, and that all who believe through their word may be one, as the Father and the Son are one. Douay-Rheims text of the whole chapter, John 17:1-26.",
      occasions: ["holy-thursday", "for-the-church", "vocations"],
      relatedSaints: [],
      citations: [`${DRBO}50017.htm`, `${DR_1899}n843/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "lauda-sion",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}178/mode/1up`, `${BRITT}179/mode/1up`, `${BRITT}180/mode/1up`],
    payload: {
      slug: "lauda-sion",
      title: "Lauda Sion Salvatorem (Praise, O Sion, praise thy Saviour)",
      body: "Praise, O Sion, praise thy Saviour,\nShepherd, Prince, with glad behavior,\nPraise in hymn and canticle:\nSing His glory without measure,\nFor the merit of your Treasure\nNever shall your praises fill.\n\nWondrous theme of mortal singing,\nLiving Bread and Bread life-bringing,\nSing we on this joyful day:\nAt the Lord's own table given\nTo the twelve as Bread from Heaven,\nDoubting not we firmly say.\n\nSing His praise with voice sonorous;\nEvery heart shall hear the chorus\nSwell in melody sublime:\nFor this day the Shepherd gave us\nFlesh and Blood to feed and save us,\nLasting to the end of time.\n\nAt the new King's sacred table,\nThe new Law's new Pasch is able\nTo succeed the ancient Rite:\nOld to new its place hath given,\nTruth has far the shadows driven,\nDarkness flees before the Light.\n\nAnd as He hath done and planned it—\n\"Do this\"—hear His love command it,\n\"For a memory of me.\"\nLearnèd, Lord, in Thy own science,\nBread and wine, in sweet compliance,\nAs a Host we offer Thee.\n\nThus in faith the Christian heareth:\nThat Christ's Flesh as bread appeareth,\nAnd as wine His Precious Blood:\nThough we feel it not nor see it,\nLiving Faith that doth decree it\nAll defects of sense makes good.\n\nLo! beneath the species dual\n(Signs not things), is hid a jewel\nFar beyond creation's reach!\nThough His Flesh as food abideth,\nAnd His Blood as drink—He hideth\nUndivided under each.\n\nWhoso eateth It can never\nBreak the Body, rend or sever;\nChrist entire our hearts doth fill:\nThousands eat the Bread of Heaven,\nYet as much to one is given:\nChrist, though eaten, bideth still.\n\nGood and bad, they come to greet Him:\nUnto life the former eat Him,\nAnd the latter unto death;\nThese find death and those find heaven;\nSee, from the same life-seed given,\nHow the harvest differeth!\n\nWhen at last the Bread is broken,\nDoubt not what the Lord hath spoken:\nIn each part the same love-token,\nThe same Christ, our hearts adore:\nFor no power the Thing divideth—\n'Tis the symbols He provideth,\nWhile the Saviour still abideth\nUndiminished as before.\n\nHail, angelic Bread of Heaven,\nNow the pilgrim's hoping-leaven,\nYea, the Bread to children given\nThat to dogs must not be thrown:\nIn the figures contemplated,\n'Twas with Isaac immolated,\nBy the Lamb 'twas antedated,\nIn the Manna it was known.\n\nO Good Shepherd, still confessing\nLove, in spite of our transgressing,—\nHere Thy blessèd Food possessing,\nMake us share Thine every blessing\nIn the land of life and love:\nThou, whose power hath all completed\nAnd Thy Flesh as Food hath meted,\nMake us, at Thy table seated,\nBy Thy Saints, as friends be greeted,\nIn Thy paradise above.",
      prayerType: "hymn",
      category: "eucharistic",
      language: "en",
      latin:
        "Lauda Sion Salvatorem,\nLauda ducem et pastorem,\nIn hymnis et canticis.\nQuantum potes, tantum aude:\nQuia major omni laude,\nNec laudare sufficis.\n\nLaudis thema specialis,\nPanis vivus et vitalis\nHodie proponitur.\nQuem in sacræ mensa cœnæ\nTurbæ fratrum duodenæ\nDatum non ambigitur.\n\nSit laus plena, sit sonora,\nSit jucunda, sit decora,\nMentis jubilatio.\nDies enim solemnis agitur,\nIn qua mensæ prima recolitur\nHujus institutio.\n\nIn hac mensa novi Regis,\nNovum Pascha novæ legis,\nPhase vetus terminat.\nVetustatem novitas,\nUmbram fugat veritas,\nNoctem lux eliminat.\n\nQuod in cœna Christus gessit,\nFaciendum hoc expressit\nIn sui memoriam.\nDocti sacris institutis,\nPanem, vinum in salutis\nConsecramus hostiam.\n\nDogma datur Christianis,\nQuod in carnem transit panis,\nEt vinum in sanguinem.\nQuod non capis, quod non vides,\nAnimosa firmat fides,\nPræter rerum ordinem.\n\nSub diversis speciebus,\nSignis tantum, et non rebus,\nLatent res eximiæ.\nCaro cibus, sanguis potus:\nManet tamen Christus totus,\nSub utraque specie.\n\nA sumente non concisus,\nNon confractus, non divisus:\nInteger accipitur.\nSumit unus, sumunt mille:\nQuantum isti, tantum ille:\nNec sumptus consumitur.\n\nSumunt boni, sumunt mali:\nSorte tamen inæquali,\nVitæ, vel interitus.\nMors est malis, vita bonis:\nVide paris sumptionis,\nQuam sit dispar exitus.\n\nFracto demum Sacramento\nNe vacilles, sed memento,\nTantum esse sub fragmento,\nQuantum toto tegitur.\nNulla rei fit scissura:\nSigni tantum fit fractura:\nQua nec status, nec statura\nSignati minuitur.\n\nEcce panis angelorum,\nFactus cibus viatorum:\nVere panis filiorum,\nNon mittendus canibus.\nIn figuris præsignatur,\nCum Isaac immolatur:\nAgnus Paschæ deputatur:\nDatur manna patribus.\n\nBone Pastor, panis vere,\nJesu, nostri miserere:\nTu nos pasce, nos tuere:\nTu nos bona fac videre\nIn terra viventium.\nTu qui cuncta scis et vales:\nQui nos pascis hic mortales:\nTuos ibi commensales,\nCohæredes et sodales\nFac sanctorum civium.",
      summary:
        "The sequence of the Mass of Corpus Christi, written by Saint Thomas Aquinas when Pope Urban IV extended the feast to the whole Church in 1264. It sets out the doctrine of the Eucharist in verse, from the Last Supper to the presence of the whole Christ under each species and in every fragment, and closes with the prayer to the Good Shepherd; its stanza Ecce panis angelorum is also sung on its own. The English is the translation of Monsignor Hugh T. Henry (1862-1946), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["corpus-christi", "mass", "adoration", "benediction"],
      relatedSaints: ["saint-thomas-aquinas"],
      citations: [`${BRITT}178/mode/1up`, `${BRITT}179/mode/1up`, `${BRITT}180/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "victimae-paschali-laudes",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}141/mode/1up`, `${BRITT}142/mode/1up`],
    payload: {
      slug: "victimae-paschali-laudes",
      title: "Victimae Paschali laudes (Christ the Lord is risen to-day)",
      body: "Christ the Lord is risen to-day:\nChristians, haste your vows to pay;\nOffer ye your praises meet\nAt the Paschal Victim's feet;\nFor the sheep the Lamb hath bled,\nSinless in the sinner's stead.\nChrist the Lord is risen on high;\nNow he lives, no more to die.\n\nChrist, the Victim undefiled,\nMan to God hath reconciled;\nWhen in strange and awful strife\nMet together Death and Life;\nChristians, on this happy day\nHaste with joy your vows to pay.\nChrist the Lord is risen on high;\nNow He lives, no more to die.\n\nSay, O wond'ring Mary, say\nWhat thou sawest on thy way.\n\"I beheld, where Christ had lain,\nEmpty tomb and Angels twain;\nI beheld the glory bright\nOf the risen Lord of light:\nChrist my hope is risen again;\nNow He lives, and lives to reign.\"\n\nChrist, who once for sinners bled,\nNow the first-born from the dead,\nThroned in endless might and power,\nLives and reigns forevermore.\nHail, eternal hope on high!\nHail, Thou King of victory!\nHail, Thou Prince of Life adored!\nHelp and save us, gracious Lord.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Victimæ Paschali\nLaudes immolent Christiani.\n\nAgnus redemit oves:\nChristus innocens Patri\nReconciliavit\nPeccatores.\n\nMors et vita duello\nConflixere mirando:\nDux vitæ mortuus,\nRegnat vivus.\n\nDic nobis, Maria,\nQuid vidisti in via?\nSepulchrum Christi viventis,\nEt gloriam vidi resurgentis.\n\nAngelicos testes,\nSudarium et vestes.\nSurrexit Christus spes mea:\nPræcedet vos in Galilæam.\n\nScimus Christum surrexisse\nA mortuis vere:\nTu nobis, victor\nRex, miserere.\nAmen. Alleluja.",
      summary:
        "The Easter sequence, sung at Mass on Easter Sunday and through its octave and ascribed to Wipo of Burgundy (eleventh century): the Church asks Mary Magdalene what she saw on the way and hears her witness to the empty tomb and the risen Christ. It was one of the few sequences kept when the Roman Missal was reformed in 1570. The English is the free translation of Jane E. Leeson (1809-1881), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["easter", "mass", "eastertide"],
      relatedSaints: ["saint-mary-magdalene"],
      citations: [`${BRITT}141/mode/1up`, `${BRITT}142/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "sacris-solemniis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}185/mode/1up`, `${BRITT}186/mode/1up`, `${BRITT}187/mode/1up`],
    payload: {
      slug: "sacris-solemniis",
      title: "Sacris solemniis juncta sint gaudia (At this our solemn Feast)",
      body: "At this our solemn Feast,\nLet holy joys abound,\nAnd from the inmost breast\nLet songs of praise resound;\nLet ancient rites depart,\nAnd all be new around,\nIn ev'ry act and voice and heart.\n\nRemember we that eve,\nWhen, the Last Supper spread,\nChrist, as we all believe,\nThe lamb, with leavenless bread,\nAmong His brethren shared,\nAnd thus the Law obeyed,\nOf old unto their sires declared.\n\nThe typic lamb consumed,\nThe legal Feast complete,\nThe Lord unto the Twelve\nHis Body gave to eat;\nThe whole to all, no less\nThe whole to each, did mete\nWith His own hands, as we confess.\n\nHe gave them, weak and frail,\nHis Flesh, their food to be;\nOn them, downcast and sad,\nHis Blood bestowèd He:\nAnd thus to them He spake,\n\"Receive this Cup from Me,\nAnd all of you of this partake.\"\n\nSo He this Sacrifice\nTo institute did will,\nAnd charged His priests alone\nThat office to fulfil:\nIn them He did confide:\nTo whom pertaineth still\nTo take, and to the rest divide.\n\nThus Angels' Bread is made\nThe Bread of man to-day:\nThe Living Bread from Heaven\nWith figures doth away:\nO wondrous gift indeed!\nThe poor and lowly may\nUpon their Lord and Master feed.\n\nO Triune Deity,\nTo Thee we meekly pray,\nSo mayst Thou visit us,\nAs we our homage pay;\nAnd in Thy footsteps bright\nConduct us on our way\nTo where Thou dwell'st in cloudless light.",
      prayerType: "hymn",
      category: "eucharistic",
      language: "en",
      latin:
        "Sacris solemniis juncta sint gaudia,\nEt ex præcordiis sonent præconia;\nRecedant vetera, nova sint omnia,\nCorda, voces, et opera.\n\nNoctis recolitur cœna novissima,\nQua Christus creditur agnum et azyma\nDedisse fratribus, juxta legitima\nPriscis indulta patribus.\n\nPost agnum typicum, expletis epulis,\nCorpus Dominicum datum discipulis,\nSic totum omnibus, quod totum singulis,\nEjus fatemur manibus.\n\nDedit fragilibus corporis ferculum,\nDedit et tristibus sanguinis poculum,\nDicens: accipite quod trado vasculum,\nOmnes ex eo bibite.\n\nSic sacrificium istud instituit,\nCujus officium committi voluit\nSolis presbyteris, quibus sic congruit,\nUt sumant, et dent ceteris.\n\nPanis angelicus fit panis hominum;\nDat panis cœlicus figuris terminum:\nO res mirabilis, manducat Dominum\nPauper, servus, et humilis.\n\nTe trina Deitas unaque poscimus,\nSic nos tu visita, sicut te colimus:\nPer tuas semitas duc nos quo tendimus,\nAd lucem, quam inhabitas.",
      summary:
        "The Matins hymn of Corpus Christi, written by Saint Thomas Aquinas for the office of the feast: it recalls the Last Supper, where the lamb of the old Passover gave way to the Lord's own Body and Blood, entrusted to priests to receive and to give to others. Its sixth stanza, Panis angelicus, is often sung on its own. The English is a cento based on the translation of John David Chambers (1805-1893), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["corpus-christi", "office-of-readings", "adoration"],
      relatedSaints: ["saint-thomas-aquinas"],
      citations: [`${BRITT}185/mode/1up`, `${BRITT}186/mode/1up`, `${BRITT}187/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ut-queant-laxis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}256/mode/1up`, `${BRITT}257/mode/1up`],
    payload: {
      slug: "ut-queant-laxis",
      title: "Ut queant laxis (O for thy spirit, holy John, to chasten)",
      body: "O for thy spirit, holy John, to chasten\nLips sin-polluted, fettered tongues to loosen;\nSo by thy children might thy deeds of wonder\nMeetly be chanted.\n\nLo! a swift herald, from the skies descending,\nBears to thy father promise of thy greatness;\nHow he shall name thee, what thy future story,\nDuly revealing.\n\nScarcely believing message so transcendent,\nHim for season power of speech forsaketh,\nTill, at thy wondrous birth, again returneth\nVoice to the voiceless.\n\nThou, in thy mother's womb all darkly cradled,\nKnewest thy Monarch, biding in His chamber,\nWhence the two parents, through their children's merits,\nMysteries uttered.\n\nPraise to the Father, to the Son begotten,\nAnd to the Spirit, equal power possessing,\nOne God whose glory, through the lapse of ages,\nEver resoundeth.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Ut queant laxis resonare fibris\nMira gestorum famuli tuorum,\nSolve polluti labii reatum,\nSancte Joannes.\n\nNuntius celso veniens olympo,\nTe patri magnum fore nasciturum,\nNomen, et vitæ seriem gerendæ\nOrdine promit.\n\nIlle promissi dubius superni,\nPerdidit promptæ modulos loquelæ:\nSed reformasti genitus peremptæ\nOrgana vocis.\n\nVentris obstruso recubans cubili,\nSenseras Regem thalamo manentem:\nHinc parens, nati meritis, uterque\nAbdita pandit.\n\nSit decus Patri, genitæque Proli,\nEt tibi compar utriusque virtus,\nSpiritus semper, Deus unus, omni\nTemporis ævo.",
      summary:
        "The Vespers hymn for the Nativity of Saint John the Baptist (24 June), by Paul the Deacon (c. 720-799): Zachary, struck dumb for doubting the angel, recovers his voice at his son's birth, and the unborn John knows his King from his mother's womb. Guido of Arezzo named the notes of the scale from the syllables that open its first lines: ut, re, mi, fa, sol, la. The English, in the metre of the original, is based on the translation of William John Blew (1808-1894), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["june-24", "vespers"],
      relatedSaints: ["saint-john-the-baptist"],
      citations: [`${BRITT}256/mode/1up`, `${BRITT}257/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "exultet-orbis-gaudiis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}323/mode/1up`, `${BRITT}324/mode/1up`],
    payload: {
      slug: "exultet-orbis-gaudiis",
      title: "Exultet orbis gaudiis (Now let the earth with joy resound)",
      body: "Now let the earth with joy resound,\nAnd heaven the chant re-echo round;\nNor heaven nor earth too high can raise\nThe great Apostles' glorious praise.\n\nO ye who, throned in glory dread,\nShall judge the living and the dead,\nLights of the world forevermore!\nTo you the suppliant prayer we pour.\n\nYe close the sacred gates on high;\nAt your command apart they fly:\nOh! loose for us the guilty chain\nWe strive to break, and strive in vain.\n\nSickness and health your voice obey;\nAt your command they go or stay:\nFrom sin's disease our souls restore;\nIn good confirm us more and more.\n\nSo when the world is at its end,\nAnd Christ to judgment shall descend,\nMay we be called those joys to see\nPrepared from all eternity.\n\nPraise to the Father, with the Son,\nAnd Holy Spirit, Three in One;\nAs ever was in ages past,\nAnd so shall be while ages last.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Exultet orbis gaudiis:\nCœlum resultet laudibus:\nApostolorum gloriam\nTellus et astra concinunt.\n\nVos sæculorum judices,\nEt vera mundi lumina:\nVotis precamur cordium,\nAudite voces supplicum.\n\nQui templa cœli clauditis,\nSerasque verbo solvitis,\nNos a reatu noxios\nSolvi jubete, quæsumus.\n\nPræcepta quorum protinus\nLanguor salusque sentiunt:\nSanate mentes languidas;\nAugete nos virtutibus.\n\nUt, cum redibit arbiter\nIn fine Christus sæculi,\nNos sempiterni gaudii\nConcedat esse compotes.\n\nPatri, simulque Filio,\nTibique sancte Spiritus,\nSicut fuit, sit jugiter\nSæclum per omne gloria.",
      summary:
        "The hymn for Vespers and Lauds in the Common of Apostles outside Eastertide in the Roman Breviary, a tenth-century hymn of unknown authorship: the apostles are hailed as judges of the ages and lights of the world, who shut and open heaven's gates at a word and heal the sick at their command. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["vespers", "lauds", "apostles"],
      relatedSaints: [],
      citations: [`${BRITT}323/mode/1up`, `${BRITT}324/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "aeterna-christi-munera",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}325/mode/1up`, `${BRITT}326/mode/1up`],
    payload: {
      slug: "aeterna-christi-munera",
      title: "Aeterna Christi munera (Th' eternal gifts of Christ the King)",
      body: "Th' eternal gifts of Christ the King,\nThe Apostles' glory, let us sing;\nAnd all with hearts of gladness raise\nDue hymns of thankful love and praise.\n\nFor they the Church's Princes are,\nTriumphant leaders in the war,\nThe heavenly King's own warrior band,\nTrue lights to lighten every land.\n\nTheirs was the steadfast faith of Saints,\nThe hope that never yields nor faints,\nThe love of Christ in perfect glow,\nThat lay the prince of this world low.\n\nIn them the Father's glory shone,\nIn them the Spirit's will was done,\nThe Son Himself exults in them;\nJoy fills the new Jerusalem.\n\nPraise to the Father, with the Son,\nAnd Holy Spirit, Three in One;\nAs ever was in ages past,\nAnd so shall be while ages last.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Æterna Christi munera,\nApostolorum gloriam,\nPalmas et hymnos debitos\nLætis canamus mentibus.\n\nEcclesiarum Principes,\nBelli triumphales duces\nCœlestis aulæ milites,\nEt vera mundi lumina.\n\nDevota sanctorum fides,\nInvicta spes credentium,\nPerfecta Christi caritas\nMundi tyrannum conterit.\n\nIn his Paterna gloria,\nIn his triumphat Filius,\nIn his voluntas Spiritus,\nCœlum repletur gaudio.\n\nPatri, simulque Filio,\nTibique sancte Spiritus,\nSicut fuit, sit jugiter\nSæclum per omne gloria.",
      summary:
        "The Matins hymn for feasts of the Apostles and Evangelists in the Roman Breviary: four stanzas of a hymn by Saint Ambrose first written for the feasts of martyrs, hailing the apostles as princes of the Church, captains in the battle and true lights of the world. The English is based on the translation of John Mason Neale (1818-1866), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["office-of-readings", "apostles"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${BRITT}325/mode/1up`, `${BRITT}326/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "deus-tuorum-militum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}326/mode/1up`, `${BRITT}327/mode/1up`],
    payload: {
      slug: "deus-tuorum-militum",
      title: "Deus tuorum militum (O God, of those that fought Thy fight)",
      body: "O God, of those that fought Thy fight,\nPortion, and prize, and crown of light,\nBreak every bond of sin and shame\nAs now we praise Thy Martyr's name.\n\nHe recked not of the world's allure,\nBut sin and pomp of sin forswore:\nKnew all their gall, and passed them by,\nAnd reached the throne prepared on high.\n\nBravely the course of pain he ran,\nAnd bare his torments as a man:\nFor love of Thee his blood outpoured,\nAnd thus obtained the great reward.\n\nWith humble voice and suppliant word\nWe pray Thee therefore, holy Lord,\nWhile we Thy Martyr's feast-day keep,\nForgive Thy loved and erring sheep.\n\nGlory and praise for aye be done\nTo God the Father, and the Son,\nAnd Holy Ghost, who reign on high,\nOne God, to all eternity.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Deus tuorum militum\nSors, et corona, præmium,\nLaudes canentes Martyris\nAbsolve nexu criminis.\n\nHic nempe mundi gaudia,\nEt blanda fraudum pabula\nImbuta felle deputans,\nPervenit ad cœlestia.\n\nPœnas cucurrit fortiter,\nEt sustulit viriliter,\nFundensque pro te sanguinem,\nÆterna dona possidet.\n\nOb hoc precatu supplici\nTe poscimus, piissime;\nIn hoc triumpho Martyris\nDimitte noxam servulis.\n\nLaus et perennis gloria\nPatri sit, atque Filio,\nSancto simul Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The Vespers hymn for the feast of a single martyr in the Roman Breviary, an Ambrosian hymn of the sixth century: the martyr counted the world's sweet lures as gall, ran bravely the course of pain and now holds the eternal gifts, and on his feast the faithful ask forgiveness. The English is the translation of Alan G. McDougall (1895-1964), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["vespers", "martyrs"],
      relatedSaints: [],
      citations: [`${BRITT}326/mode/1up`, `${BRITT}327/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "iste-confessor",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}334/mode/1up`, `${BRITT}335/mode/1up`],
    payload: {
      slug: "iste-confessor",
      title: "Iste Confessor (This the Confessor of the Lord, whose triumph)",
      body: "This the Confessor of the Lord, whose triumph\nNow all the faithful celebrate, with gladness\nErst on this feast-day merited to enter\nInto his glory.\n\nSaintly and prudent, modest in behavior,\nPeaceful and sober, chaste was he, and lowly,\nWhile that life's vigor, coursing through his members,\nQuickened his being.\n\nSick ones of old time, to his tomb resorting,\nSorely by ailments manifold afflicted,\nOft-times have welcomed health and strength returning,\nAt his petition.\n\nWhence we in chorus gladly do him honor,\nChanting his praises with devout affection,\nThat in his merits we may have a portion,\nNow and forever.\n\nHis be the glory, power and salvation,\nWho over all things reigneth in the highest,\nEarth's mighty fabric ruling and directing,\nOnely and Trinal.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Iste Confessor Domini colentes\nQuem pie laudant populi per orbem:\nHac die lætus meruit beatas\nScandere sedes.\n\nQui pius, prudens, humilis, pudicus,\nSobriam duxit sine labe vitam,\nDonec humanos animavit auræ\nSpiritus artus.\n\nCujus ob præstans meritum frequenter,\nÆgra quæ passim jacuere membra,\nViribus morbi domitis, saluti\nRestituuntur.\n\nNoster hinc illi chorus obsequentem\nConcinit laudem, celebresque palmas;\nUt piis ejus precibus juvemur\nOmne per ævum.\n\nSit salus illi, decus, atque virtus,\nQui super cœli solio coruscans,\nTotius mundi seriem gubernat\nTrinus et unus.",
      summary:
        "The hymn for Vespers and Matins on the feasts of confessors, bishops and others, in the Roman Breviary, an eighth-century Sapphic hymn of unknown authorship: the confessor lived a sober and spotless life, and the sick have found healing at his tomb through his prayers. The English is a cento from The Hymner, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["vespers", "office-of-readings", "confessors"],
      relatedSaints: [],
      citations: [`${BRITT}334/mode/1up`, `${BRITT}335/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "salvete-flores-martyrum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}108/mode/1up`],
    payload: {
      slug: "salvete-flores-martyrum",
      title: "Salvete flores Martyrum (All hail, ye little Martyr flowers)",
      body: "All hail, ye little Martyr flowers,\nSweet rosebuds cut in dawning hours!\nWhen Herod sought the Christ to find\nYe fell as bloom before the wind.\n\nFirst victims of the Martyr bands,\nWith crowns and palms in tender hands,\nAround the very altar, gay\nAnd innocent, ye seem to play.\n\nAll honor, laud, and glory be,\nO Jesu, Virgin-born to Thee;\nAll glory, as is ever meet\nTo Father and to Paraclete.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Salvete flores Martyrum,\nQuos lucis ipso in limine\nChristi insecutor sustulit,\nCeu turbo nascentes rosas.\n\nVos prima Christi victima,\nGrex immolatorum tener,\nAram sub ipsam simplices\nPalma et coronis luditis.\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre et almo Spiritu,\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn for the feast of the Holy Innocents (28 December), stanzas from the Epiphany hymn in the Cathemerinon of Prudentius (348-c. 413): the infants slain by Herod are greeted as the flowers of the martyrs, cut down at the threshold of life like rosebuds in a storm, and the first victims for Christ. The English is the translation of John Athelstan Riley (1858-1945), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["december-28", "lauds", "christmas"],
      relatedSaints: [],
      citations: [`${BRITT}108/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "a-solis-ortus-cardine",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}102/mode/1up`, `${BRITT}103/mode/1up`],
    payload: {
      slug: "a-solis-ortus-cardine",
      title: "A solis ortus cardine (From lands that see the sun arise)",
      body: "From lands that see the sun arise\nTo earth's remotest boundaries,\nThe Virgin-born to-day we sing,\nThe Son of Mary, Christ the King.\n\nBlest Author of this earthly frame,\nTo take a servant's form He came,\nThat, liberating flesh by flesh,\nWhom He had made might live afresh.\n\nIn that chaste parent's holy womb\nCelestial grace hath found its home;\nAnd she, as earthly bride unknown,\nYet calls that Offspring blest her own.\n\nThe mansion of the modest breast\nBecomes a shrine where God shall rest:\nThe pure and undefilèd one\nConceivèd in her womb the Son.\n\nThat Son, that Royal Son she bore,\nWhom Gabriel's voice had told afore;\nWhom, in His mother yet concealed,\nThe infant Baptist had revealed.\n\nThe manger and the straw He bore,\nThe cradle did He not abhor;\nBy milk in infant portions fed,\nWho gives e'en fowls their daily bread.\n\nThe heavenly chorus filled the sky,\nThe Angels sang to God on high,\nWhat time to shepherds, watching lone,\nThey made creation's Shepherd known.\n\nAll honor, laud, and glory be,\nO Jesu, Virgin-born to Thee:\nAll glory, as is ever meet,\nTo Father and to Paraclete.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "A solis ortus cardine\nAd usque terræ limitem,\nChristum canamus Principem,\nNatum Maria Virgine.\n\nBeatus auctor sæculi\nServile corpus induit:\nUt carne carnem liberans,\nNe perderet quos condidit.\n\nCastæ Parentis viscera\nCœlestis intrat gratia:\nVenter Puellæ bajulat\nSecreta, quæ non noverat.\n\nDomus pudici pectoris\nTemplum repente fit Dei:\nIntacta nesciens virum,\nConcepit alvo Filium.\n\nEnititur puerpera,\nQuem Gabriel prædixerat,\nQuem ventre Matris gestiens,\nBaptista clausum senserat.\n\nFœno jacere pertulit:\nPræsepe non abhorruit:\nEt lacte modico pastus est,\nPer quem nec ales esurit.\n\nGaudet chorus cœlestium,\nEt Angeli canunt Deo;\nPalamque fit pastoribus\nPastor, Creator omnium.\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre, et almo Spiritu,\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn of Christmas Day, the first seven stanzas (A to G) of the alphabetical hymn of the fifth-century poet Caelius Sedulius, whose later stanzas give the Epiphany hymn Hostis Herodes impie: the Author of the world takes a servant's form, is laid in the manger and fed with a little milk, though he feeds the very birds. The English is the translation of John Mason Neale (1818-1866), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["christmas", "lauds", "december-25"],
      relatedSaints: [],
      citations: [`${BRITT}102/mode/1up`, `${BRITT}103/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "jesu-redemptor-omnium-quem-lucis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}100/mode/1up`, `${BRITT}101/mode/1up`],
    payload: {
      slug: "jesu-redemptor-omnium-quem-lucis",
      title: "Jesu, Redemptor omnium, quem lucis ante originem (Jesus, the Ransomer of man)",
      body: "Jesus, the Ransomer of man,\nWho, ere created light began,\nDidst from the sovereign Father spring,\nHis power and glory equalling.\n\nThe Father's Light and Splendor Thou,\nTheir endless Hope to Thee that bow;\nAccept the prayers and praise to-day\nThat through the world Thy servants pay.\n\nSalvation's Author, call to mind\nHow, taking form of humankind,\nBorn of a Virgin undefiled,\nThou in man's flesh becam'st a Child.\n\nThus testifies the present day,\nThrough every year in long array,\nThat Thou, salvation's source alone,\nProceededst from the Father's throne.\n\nThe heavens above, the rolling main\nAnd all that earth's wide realms contain,\nWith joyous voice now loudly sing\nThe glory of their new-born King.\n\nAnd we who, by Thy precious Blood\nFrom sin redeemed, are marked for God,\nOn this the day that saw Thy birth,\nSing the new song of ransomed earth.\n\nO Lord, the Virgin-born, to Thee\nEternal praise and glory be,\nWhom with the Father we adore\nAnd Holy Ghost forevermore.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Jesu, Redemptor omnium,\nQuem lucis ante originem\nParem paternæ gloriæ\nPater supremus edidit.\n\nTu lumen, et splendor Patris,\nTu spes perennis omnium,\nIntende quas fundunt preces\nTui per orbem servuli.\n\nMemento, rerum Conditor,\nNostri quod olim corporis,\nSacrata ab alvo Virginis\nNascendo, formam sumpseris.\n\nTestatur hoc præsens dies,\nCurrens per anni circulum,\nQuod solus e sinu Patris\nMundi salus adveneris.\n\nHunc astra, tellus, æquora,\nHunc omne quod cœlo subest,\nSalutis Auctorem novæ\nNovo salutat cantico.\n\nEt nos, beata quos sacri\nRigavit unda sanguinis;\nNatalis ob diem tui\nHymni tributum solvimus.\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre, et almo Spiritu\nIn sempiterna sæcula.",
      summary:
        "The hymn for Vespers and Matins of Christmas Day in the Roman Breviary, the 1632 recasting of the sixth-century Ambrosian hymn Christe, Redemptor omnium: the Son begotten before the dawn of light, who took flesh of the Virgin, is greeted by heaven, earth and sea with a new song. The English is a composite translation drawn from John Mason Neale, Thomas Potter and the Evening Office of 1710, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["christmas", "vespers", "december-25"],
      relatedSaints: [],
      citations: [`${BRITT}100/mode/1up`, `${BRITT}101/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ad-regias-agni-dapes",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}144/mode/1up`, `${BRITT}145/mode/1up`],
    payload: {
      slug: "ad-regias-agni-dapes",
      title: "Ad regias Agni dapes (At the Lamb's high feast we sing)",
      body: "At the Lamb's high feast we sing\nPraise to our victorious King,\nWho hath washed us in the tide\nFlowing from His piercèd side.\n\nPraise we Him whose love divine\nGives the guests His Blood for wine,\nGives His Body for the feast,\nLove the victim, love the priest.\n\nWhere the Paschal blood is poured,\nDeath's dark Angel sheathes his sword;\nIsrael's hosts triumphant go\nThrough the wave that drowns the foe.\n\nChrist, the Lamb whose Blood was shed,\nPaschal victim, Paschal bread;\nWith sincerity and love\nEat we manna from above.\n\nMighty Victim from the sky,\nPowers of hell beneath Thee lie;\nDeath is conquered in the fight;\nThou hast brought us life and light.\n\nNow Thy banner Thou dost wave;\nVanquished Satan and the grave;\nAngels join His praise to tell—\nSee o'erthrown the prince of hell.\n\nPaschal triumph, Paschal joy,\nOnly sin can this destroy;\nFrom the death of sin set free,\nSouls re-born, dear Lord, in Thee.\n\nHymns of glory, songs of praise,\nFather, unto Thee we raise;\nRisen Lord, all praise to Thee,\nEver with the Spirit be.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Ad regias Agni dapes,\nStolis amicti candidis,\nPost transitum Maris rubri,\nChristo canamus Principi:\n\nDivina cujus caritas\nSacrum propinat sanguinem,\nAlmique membra corporis\nAmor sacerdos immolat.\n\nSparsum cruorem postibus\nVastator horret Angelus:\nFugitque divisum mare:\nMerguntur hostes fluctibus.\n\nJam Pascha nostrum Christus est,\nPaschalis idem victima,\nEt pura puris mentibus\nSinceritatis azyma.\n\nO vera cœli victima,\nSubjecta cui sunt tartara,\nSoluta mortis vincula,\nRecepta vitæ præmia.\n\nVictor subactis inferis\nTrophæa Christus explicat,\nCœloque aperto, subditum\nRegem tenebrarum trahit.\n\nUt sis perenne mentibus\nPaschale Jesu gaudium,\nA morte dira criminum\nVitæ renatos libera.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The Vespers hymn of Eastertide in the Roman Breviary, from Low Sunday to the Ascension. The revisers of 1632 recast the ancient Ad cenam Agni providi so thoroughly that only three of its lines survived, so it stands here as a hymn in its own right: Christ is the true Paschal Lamb, whose blood turns away the destroying angel and whose Body and Blood are the feast of the newly baptized. The English is the translation of Robert Campbell (1814-1868), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["easter", "eastertide", "vespers"],
      relatedSaints: [],
      citations: [`${BRITT}144/mode/1up`, `${BRITT}145/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "aurora-caelum-purpurat",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}150/mode/1up`, `${BRITT}151/mode/1up`],
    payload: {
      slug: "aurora-caelum-purpurat",
      title: "Aurora caelum purpurat (The morn had spread her crimson rays)",
      body: "The morn had spread her crimson rays,\nWhen rang the skies with shouts of praise;\nEarth joined the joyful hymn to swell,\nThat brought despair to vanquished hell.\n\nHe comes victorious from the grave,\nThe Lord omnipotent to save,\nAnd brings with Him to light of day\nThe Saints who long imprisoned lay.\n\nVain is the cavern's three-fold ward—\nThe stone, the seal, the armed guard;\nO death, no more thine arm we fear,\nThe Victor's tomb is now thy bier.\n\nLet hymns of joy to grief succeed,\nWe know that Christ is risen indeed;\nWe hear His white-robed Angel's voice,\nAnd in our risen Lord rejoice.\n\nWith Christ we died, with Christ we rose,\nWhen at the font His name we chose;\nOh, let not sin our robes defile,\nAnd turn to grief the Paschal smile.\n\nTo God the Father let us sing,\nTo God the Son, our risen King,\nAnd equally let us adore\nThe Spirit, God forevermore.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Aurora cœlum purpurat,\nÆther resultat laudibus,\nMundus triumphans jubilat,\nHorrens avernus infremit:\n\nRex ille dum fortissimus\nDe mortis inferno specu\nPatrum senatum liberum\nEducit ad vitæ jubar.\n\nCujus sepulchrum plurimo\nCustode signabat lapis,\nVictor triumphat, et suo\nMortem sepulchro funerat.\n\nSat funeri, sat lacrimis,\nSat est datum doloribus:\nSurrexit exstinctor necis,\nClamat coruscans Angelus.\n\nUt sis perenne mentibus\nPaschale Jesu gaudium,\nA morte dira criminum\nVitæ renatos libera.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn of Eastertide in the Roman Breviary, from Low Sunday to the Ascension: the first part of the ancient Aurora lucis rutilat as revised in 1632. The dawn reddens the sky, heaven echoes with praise and hell groans, as the risen King leads the fathers out of the prison of death and buries death in his own tomb. The English is the translation of Robert Campbell (1814-1868), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["easter", "eastertide", "lauds"],
      relatedSaints: [],
      citations: [`${BRITT}150/mode/1up`, `${BRITT}151/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "salutis-humanae-sator",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}155/mode/1up`, `${BRITT}156/mode/1up`],
    payload: {
      slug: "salutis-humanae-sator",
      title: "Salutis humanae Sator (Hail, Thou who man's Redeemer art)",
      body: "Hail, Thou who man's Redeemer art,\nJesu, the joy of every heart;\nGreat Maker of the world's wide frame,\nAnd purest love's delight and flame:\n\nWhat nameless mercy Thee o'ercame,\nTo bear our load of sin and shame?\nFor guiltless, Thou Thy life didst give,\nThat sinful erring man might live.\n\nThe realms of woe are forced by Thee,\nIts captives from their chains set free;\nAnd Thou, amid Thy ransomed train,\nAt God's right hand dost victor reign.\n\nLet mercy sweet with Thee prevail,\nTo cure the wounds we now bewail;\nOh, bless us with Thy holy sight,\nAnd fill us with eternal light.\n\nOur guide, our way to heavenly rest,\nBe Thou the aim of every breast;\nBe Thou the soother of our tears,\nOur sweet reward above the spheres.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Salutis humanæ Sator,\nJesu, voluptas cordium,\nOrbis redempti Conditor,\nEt casta lux amantium:\n\nQua victus es clementia,\nUt nostra ferres crimina?\nMortem subires innocens,\nA morte nos ut tolleres?\n\nPerrumpis infernum chaos;\nVinctis catenas detrahis;\nVictor triumpho nobili\nAd dexteram Patris sedes.\n\nTe cogat indulgentia,\nUt damna nostra sarcias\nTuique vultus compotes\nDites beato lumine.\n\nTu dux ad astra, et semita,\nSis meta nostris cordibus,\nSis lacrymarum gaudium,\nSis dulce vitæ præmium.",
      summary:
        "The Vespers hymn from the Ascension to Pentecost in the Roman Breviary, the 1632 recasting of the Ambrosian Jesu, nostra redemptio of the seventh or eighth century: it asks what mercy moved the guiltless Christ to bear our sins and die, and hails him breaking open the realm of death and taking his seat at the Father's right hand. The English is the translation of Thomas Joseph Potter (1828-1873), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["ascension", "eastertide", "vespers"],
      relatedSaints: [],
      citations: [`${BRITT}155/mode/1up`, `${BRITT}156/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "aeterne-rex-altissime",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}157/mode/1up`, `${BRITT}158/mode/1up`],
    payload: {
      slug: "aeterne-rex-altissime",
      title: "Aeterne Rex altissime (Eternal Monarch, King most High)",
      body: "Eternal Monarch, King most High,\nWhose Blood hath brought redemption nigh,\nBy whom the death of Death was wrought,\nAnd conquering grace's battle fought:\n\nAscending by the starry road,\nThis day Thou wentest home to God,\nBy Heaven to power unending called,\nAnd by no human hand installed.\n\nThat so, in nature's triple frame,\nEach heavenly and each earthly name,\nAnd things in hell's abyss abhorred,\nMay bend the knee and own Him Lord.\n\nYea, Angels tremble when they see\nHow changed is our humanity;\nThat Flesh hath purged what flesh had stained,\nAnd God, the flesh of God, hath reigned.\n\nBe Thou our joy, O mighty Lord,\nAs Thou wilt be our great reward;\nEarth's joys to Thee are nothing worth,\nThou joy and crown of heaven and earth.\n\nTo Thee we therefore humbly pray\nThat Thou wouldst purge our sins away,\nAnd draw our hearts by cords of grace\nTo Thy celestial dwelling-place.\n\nSo when the Judgment day shall come,\nAnd all must rise to meet their doom,\nThou wilt remit the debts we owe,\nAnd our lost crowns again bestow.\n\nAll glory, Lord, to Thee we pay,\nAscending o'er the stars to-day;\nAll glory, as is ever meet,\nTo Father and to Paraclete.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Æterne Rex altissime,\nRedemptor et fidelium,\nCui mors perempta detulit\nSummæ triumphum gloriæ.\n\nAscendis orbes siderum,\nQuo te vocabat cœlitus\nCollata, non humanitus,\nRerum potestas omnium.\n\nUt trina rerum machina,\nCœlestium, terrestrium,\nEt inferorum condita,\nFlectat genu jam subdita.\n\nTremunt videntes Angeli\nVersam vicem mortalium:\nPeccat caro, mundat caro,\nRegnat Deus Dei caro.\n\nSis ipse nostrum gaudium,\nManens olympo præmium,\nMundi regis qui fabricam,\nMundana vincens gaudia.\n\nHinc te precantes quæsumus,\nIgnosce culpis omnibus,\nEt corda sursum subleva\nAd te superna gratia.\n\nUt cum repente cœperis\nClarere nube judicis,\nPœnas repellas debitas,\nReddas coronas perditas.\n\nJesu, tibi sit gloria,\nQui victor in cœlum redis,\nCum Patre, et almo Spiritu,\nIn sempiterna sæcula.",
      summary:
        "The Matins hymn from the Ascension to Pentecost in the Roman Breviary, a fifth-century Ambrosian hymn: the King who destroyed death ascends above the stars, every knee in heaven, on earth and under the earth bends to him, and the angels tremble to see the flesh that sinned now cleansing and reigning as God. The English is the translation of John Mason Neale (1818-1866) and others, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["ascension", "eastertide", "office-of-readings"],
      relatedSaints: [],
      citations: [`${BRITT}157/mode/1up`, `${BRITT}158/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "jam-christus-astra-ascenderat",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}165/mode/1up`, `${BRITT}166/mode/1up`],
    payload: {
      slug: "jam-christus-astra-ascenderat",
      title: "Jam Christus astra ascenderat (Now Christ, ascending whence He came)",
      body: "Now Christ, ascending whence He came,\nHad mounted o'er the starry frame,\nThe Holy Ghost on man below,\nThe Father's promise, to bestow.\n\nThe solemn time was drawing nigh,\nReplete with heav'nly mystery,\nOn seven days' sevenfold circles borne,\nThat first and blessèd Whitsun-morn.\n\nWhen the third hour shone all around,\nThere came a rushing mighty sound,\nAnd told the Apostles, while in prayer,\nThat, as was promised, God was there.\n\nForth from the Father's light it came,\nThat beautiful and kindly flame:\nTo fill with fervor of His word\nThe spirits faithful to their Lord.\n\nWith joy the Apostles' breasts are fired,\nBy God the Holy Ghost inspired:\nAnd straight, in divers kinds of speech,\nThe wondrous works of God they preach.\n\nTo men of every race they speak,\nAlike Barbarian, Roman, Greek:\nFrom the same lips, with awe and fear,\nAll men their native accents hear.\n\nBut Juda's sons, e'en faithless yet,\nWith mad infuriate rage beset,\nTo mock Christ's followers combine,\nAs drunken all with new-made wine.\n\nWhen lo! with signs and mighty deeds,\nStands Peter in the midst, and pleads;\nConfounding their malignant lie\nBy Joel's ancient prophecy.\n\nTo God the Father let us sing,\nTo God the Son, our risen King,\nAnd equally let us adore\nThe Spirit, God forevermore.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Jam Christus astra ascenderat,\nReversus unde venerat,\nPatris fruendum munere\nSanctum daturus Spiritum.\n\nSolemnis urgebat dies,\nQuo mystico septemplici\nOrbis volutus septies,\nSignat beata tempora.\n\nCum lucis hora tertia\nRepente mundus intonat,\nApostolis orantibus\nDeum venire nuntiat.\n\nDe Patris ergo lumine\nDecorus ignis almus est,\nQui fida Christi pectora\nCalore Verbi compleat.\n\nImpleta gaudent viscera,\nAfflata sancto Spiritu,\nVocesque diversas sonant,\nFantur Dei magnalia.\n\nNotique cunctis Gentibus,\nGræcis, Latinis, Barbaris,\nSimulque demirantibus,\nLinguis loquuntur omnium.\n\nJudæa tunc incredula,\nVesana torvo spiritu,\nMadere musto sobrios\nChristi fideles increpat.\n\nSed editis miraculis\nOccurrit et docet Petrus,\nFalsum profari perfidos,\nJoele teste comprobans.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sæculorum sæcula.",
      summary:
        "The Matins hymn of Pentecost and its octave in the Roman Breviary, a fourth-century Ambrosian hymn that retells Acts 2 in verse: the rushing sound at the third hour, the fire from the Father's light, the apostles speaking in every tongue, the mockery of the crowd and Peter's answer from the prophet Joel. The English is the translation of John Mason Neale (the first four stanzas) and of George Herbert Palmer and J. W. Doran (the rest), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["pentecost", "office-of-readings"],
      relatedSaints: ["saint-peter"],
      citations: [`${BRITT}165/mode/1up`, `${BRITT}166/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "beata-nobis-gaudia",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}168/mode/1up`, `${BRITT}169/mode/1up`],
    payload: {
      slug: "beata-nobis-gaudia",
      title: "Beata nobis gaudia (Round roll the weeks our hearts to greet)",
      body: "Round roll the weeks our hearts to greet,\nWith blissful joy returning;\nFor lo! the Holy Paraclete\nOn twelve bright brows sits burning:\n\nWith quivering flame He lights on each,\nIn fashion like a tongue, to teach\nThat eloquent they are of speech,\nTheir hearts with true love yearning.\n\nWhile with all tongues they speak to all,\nThe nations deem them maddened,\nAnd drunk with wine the Prophets call,\nWhom God's good Spirit gladdened;\n\nA marvel this—in mystery done—\nThe holy Paschaltide outrun,\nBy numbers told, whose reckoning won\nRemission for the saddened.\n\nO God most Holy, Thee we pray,\nWith reverent brow low bending,\nGrant us the Spirit's gifts to-day—\nThe gifts from heaven descending;\n\nAnd, since, Thy grace hath deigned to bide\nWithin our breasts once sanctified,\nDeign, Lord, to cast our sins aside,\nHenceforth calm seasons sending.\n\nTo God the Father, laud and praise,\nPraise to the Son be given;\nPraise to the Spirit of all grace,\nThe fount of graces seven—\n\nAs was of old, all worlds before,\nIs now and shall be evermore,\nWhen time and change are spent and o'er—\nAll praise in earth and heaven.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Beata nobis gaudia\nAnni reduxit orbita,\nCum Spiritus Paraclitus\nIllapsus est Apostolis.\n\nIgnis vibrante lumine\nLinguæ figuram detulit,\nVerbis ut essent proflui,\nEt caritate fervidi.\n\nLinguis loquuntur omnium,\nTurbæ pavent Gentilium:\nMusto madere deputant,\nQuos Spiritus repleverat.\n\nPatrata sunt hæc mystice,\nPaschæ peracto tempore,\nSacro dierum circulo,\nQuo lege fit remissio.\n\nTe nunc Deus piissime\nVultu precamur cernuo,\nIllapsa nobis cœlitus\nLargire dona Spiritus.\n\nDudum sacrata pectora\nTua replesti gratia:\nDimitte nostra crimina,\nEt da quieta tempora.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sæculorum sæcula.",
      summary:
        "The Lauds hymn of Pentecost and its octave in the Roman Breviary, once ascribed to Saint Hilary of Poitiers: the turning year brings back the day the Paraclete came down on the apostles in tongues of fire, when the crowds thought them drunk, at the close of the fifty days that recall the law's year of remission. The English is the translation of William John Blew (1808-1894), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["pentecost", "lauds"],
      relatedSaints: [],
      citations: [`${BRITT}168/mode/1up`, `${BRITT}169/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "gloria-laus-et-honor",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}139/mode/1up`, `${BRITT}140/mode/1up`],
    payload: {
      slug: "gloria-laus-et-honor",
      title: "Gloria, laus, et honor (All glory, laud, and honor)",
      body: "All glory, laud, and honor\nTo Thee, Redeemer, King,\nTo whom the lips of children\nMade sweet hosannas ring.\n\nThou art the King of Israel,\nThou David's royal Son,\nWho in the Lord's Name comest,\nThe King and Blessed One.\nAll glory, laud, etc.\n\nThe company of Angels\nAre praising Thee on high,\nAnd mortal men and all things\nCreated make reply.\nAll glory, laud, etc.\n\nThe people of the Hebrews\nWith palms before Thee went;\nOur praise and prayer and anthems\nBefore Thee we present.\nAll glory, laud, etc.\n\nTo Thee before Thy Passion\nThey sang their hymns of praise;\nTo Thee now high exalted\nOur melody we raise.\nAll glory, laud, etc.\n\nThou didst accept their praises,\nAccept the prayers we bring,\nWho in all good delightest,\nThou good and gracious King.\nAll glory, laud, etc.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Gloria, laus, et honor, tibi sit Rex Christe Redemptor:\nCui puerile decus prompsit Hosanna pium.\nGloria, laus, etc.\n\nIsrael es tu Rex, Davidis et inclyta proles:\nNomine qui in Domini, Rex benedicte, venis.\nGloria, laus, etc.\n\nCœtus in excelsis te laudat cœlicus omnis,\nEt mortalis homo, et cuncta creata simul.\nGloria, laus, etc.\n\nPlebs Hebræa tibi cum palmis obvia venit:\nCum prece, voto, hymnis, adsumus ecce tibi.\nGloria, laus, etc.\n\nEt tibi passuro solvebant munia laudis:\nNos tibi regnanti pangimus ecce melos.\nGloria, laus, etc.\n\nHi placuere tibi, placeat devotio nostra:\nRex bone, Rex clemens, cui bona cuncta placent.\nGloria, laus, etc.",
      summary:
        "The processional hymn of Palm Sunday, written in elegiac couplets by Theodulf, Bishop of Orleans (d. 821), whose opening couplet returns as a refrain: as the children of Jerusalem met Christ with palms and hosannas, the Church greets her King on the way to his Passion. A later legend has Theodulf singing it from his prison at Angers as the emperor passed by. The English is the translation of John Mason Neale (1818-1866), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["palm-sunday", "holy-week", "procession"],
      relatedSaints: [],
      citations: [`${BRITT}139/mode/1up`, `${BRITT}140/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ex-more-docti-mystico",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}118/mode/1up`, `${BRITT}119/mode/1up`],
    payload: {
      slug: "ex-more-docti-mystico",
      title: "Ex more docti mystico (The fast, as taught by holy lore)",
      body: "The fast, as taught by holy lore,\nWe keep in solemn course once more:\nThe fast to all men known, and bound\nIn forty days of yearly round.\n\nThe law and seers that were of old\nIn divers ways this Lent foretold,\nWhich Christ, all seasons' King and Guide,\nIn after ages sanctified.\n\nMore sparing therefore let us make\nThe words we speak, the food we take,\nOur sleep and mirth,—and closer barred\nBe every sense in holy guard.\n\nAvoid the evil thoughts that roll\nLike waters o'er the heedless soul;\nNor let the foe occasion find\nOur souls in slavery to bind.\n\nIn prayer together let us fall,\nAnd cry for mercy, one and all,\nAnd weep before the Judge's feet,\nAnd His avenging wrath entreat.\n\nThy grace have we offended sore,\nBy sins, O God, which we deplore;\nBut pour upon us from on high,\nO pardoning One, Thy clemency.\n\nRemember Thou, though frail we be,\nThat yet Thine handiwork are we;\nNor let the honor of Thy Name\nBe by another put to shame.\n\nForgive the sin that we have wrought;\nIncrease the good that we have sought:\nThat we at length, our wanderings o'er,\nMay please Thee here and evermore.\n\nGrant, O Thou Blessed Trinity,\nGrant, O Essential Unity,\nThat this our fast of forty days\nMay work our profit and Thy praise.",
      prayerType: "hymn",
      category: "penitential",
      language: "en",
      latin:
        "Ex more docti mystico\nServemus hoc jejunium,\nDeno dierum circulo\nDucto quater notissimo.\n\nLex et prophetæ primitus\nHoc prætulerunt, postmodum\nChristus sacravit, omnium\nRex atque factor temporum.\n\nUtamur ergo parcius\nVerbis, cibis et potibus,\nSomno, jocis, et arctius\nPerstemus in custodia.\n\nVitemus autem noxia,\nQuæ subruunt mentes vagas:\nNullumque demus callidi\nHostis locum tyrannidi.\n\nFlectamus iram vindicem,\nPloremus ante judicem,\nClamemus ore supplici,\nDicamus omnes cernui:\n\nNostris malis offendimus\nTuam Deus clementiam:\nEffunde nobis desuper,\nRemissor, indulgentiam.\n\nMemento quod sumus tui,\nLicet caduci, plasmatis:\nNe des honorem nominis\nTui, precamur, alteri.\n\nLaxa malum quod fecimus,\nAuge bonum quod poscimus:\nPlacere quo tandem tibi\nPossimus hic, et perpetim.\n\nPræsta beata Trinitas,\nConcede simplex Unitas,\nUt fructuosa sint tuis\nJejuniorum munera.",
      summary:
        "The Matins hymn for Sundays and weekdays of Lent in the Roman Breviary, ascribed to Pope Saint Gregory the Great: the forty days' fast, foreshadowed by the law and the prophets and hallowed by Christ, is a time to be sparing in words, food, drink, sleep and mirth, and to weep together before the Judge. The English is the translation of John Mason Neale (1818-1866), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["lent", "office-of-readings"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${BRITT}118/mode/1up`, `${BRITT}119/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-sol-salutis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}121/mode/1up`],
    payload: {
      slug: "o-sol-salutis",
      title: "O Sol salutis, intimis (Jesu, salvation's Sun Divine)",
      body: "Jesu, salvation's Sun Divine,\nWithin our inmost bosoms shine,\nWith light all darkness drive away\nAnd give the world a better day.\n\nNow days of grace with mercy flow,\nO Lord, the gift of tears bestow,\nTo wash our stains in every part,\nWhilst heavenly fire consumes the heart.\n\nRise, crystal tears, from that same source\nFrom whence our sins derive their course;\nNor cease, till hardened hearts relent,\nAnd softened by your streams, repent.\n\nBehold, the happy days return,\nThe days of joy for them that mourn;\nMay we of their indulgence share,\nAnd bless the God that grants our prayer.\n\nMay heaven and earth aloud proclaim\nThe Trinity's almighty fame;\nAnd we, restored to grace, rejoice\nIn newness both of heart and voice.",
      prayerType: "hymn",
      category: "penitential",
      language: "en",
      latin:
        "O Sol salutis, intimis\nJesu refulge mentibus,\nDum nocte pulsa gratior\nOrbi dies renascitur.\n\nDans tempus acceptabile,\nDa, lacrimarum rivulis\nLavare cordis victimam,\nQuam læta adurat caritas.\n\nQuo fonte manavit nefas,\nFluent perennes lacrimæ,\nSi virga pœnitentiæ\nCordis rigorem conterat.\n\nDies venit, dies tua,\nIn qua reflorent omnia:\nLætemur et nos in viam\nTua reducti dextera.\n\nTe prona mundi machina\nClemens adoret Trinitas,\nEt nos novi per gratiam\nNovum canamus canticum.",
      summary:
        "The Lauds hymn for Sundays and weekdays of Lent in the Roman Breviary, the 1632 form of the sixth-century Ambrosian Jam, Christe, sol justitiae: Christ, the sun of salvation, is asked in this acceptable time for the gift of tears, until hardened hearts relent and his day comes, when all things flower again. The English is from the Primer of 1706, probably by John Dryden, with its first three lines altered, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["lent", "lauds", "morning"],
      relatedSaints: [],
      citations: [`${BRITT}121/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "pange-lingua-gloriosi-lauream-certaminis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}126/mode/1up`, `${BRITT}127/mode/1up`, `${BRITT}128/mode/1up`],
    payload: {
      slug: "pange-lingua-gloriosi-lauream-certaminis",
      title: "Pange lingua gloriosi lauream certaminis (Sing, my tongue, the glorious battle)",
      body: "Sing, my tongue, the glorious battle\nWith completed victory rife:\nAnd above the Cross's trophy\nTell the triumph of the strife:\nHow the world's Redeemer conquered\nBy surrendering of His life.\n\nGod, His Maker, sorely grieving\nThat the first-made Adam fell,\nWhen he ate the fruit of sorrow,\nWhose reward was death and hell,\nNoted then this Wood, the ruin\nOf the ancient wood to quell.\n\nFor the work of our salvation\nNeeds would have his order so,\nAnd the multiform deceiver's\nArt by art would overthrow,\nAnd from thence would bring the med'cine\nWhence the insult of the foe.\n\nWherefore, when the sacred fulness\nOf the appointed time was come,\nThis world's Maker left His Father,\nSent the heav'nly mansion from,\nAnd proceeded, God Incarnate,\nOf the Virgin's holy womb.\n\nWeeps the Infant in the manger\nThat in Bethlehem's stable stands;\nAnd His limbs the Virgin Mother\nDoth compose in swaddling bands,\nMeetly thus in linen folding\nOf her God the feet and hands.\n\nThirty years among us dwelling,\nHis appointed time fulfilled,\nBorn for this, He meets His Passion,\nFor that this He freely willed:\nOn the Cross the Lamb is lifted,\nWhere His life-blood shall be spilled.\n\nHe endured the nails, the spitting,\nVinegar, and spear, and reed;\nFrom that holy Body broken\nBlood and water forth proceed:\nEarth, and stars, and sky, and ocean,\nBy that flood from stain are free.\n\nFaithful Cross! above all other,\nOne and only noble Tree!\nNone in foliage, none in blossom,\nNone in fruit thy peers may be;\nSweetest Wood and sweetest Iron!\nSweetest Weight is hung on thee.\n\nBend thy boughs, O Tree of glory!\nThy relaxing sinews bend;\nFor awhile the ancient rigor,\nThat thy birth bestowed, suspend;\nAnd the King of heavenly beauty\nOn thy bosom gently tend!\n\nThou alone wast counted worthy\nThis world's ransom to uphold;\nFor a shipwrecked race preparing\nHarbor, like the Ark of old;\nWith the sacred Blood anointed\nFrom the smitten lamb that rolled.\n\nTo the Trinity be glory\nEverlasting, as is meet;\nEqual to the Father, equal\nTo the Son, and Paraclete:\nTrinal Unity, whose praises\nAll created things repeat.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Pange lingua gloriosi\nLauream certaminis,\nEt super Crucis trophæo\nDic triumphum nobilem:\nQualiter Redemptor orbis\nImmolatus vicerit.\n\nDe parentis protoplasti\nFraude Factor condolens,\nQuando pomi noxialis\nIn necem morsu ruit:\nIpse lignum tunc notavit,\nDamna ligni ut solveret.\n\nHoc opus nostræ salutis\nOrdo depoposcerat;\nMultiformis proditoris\nArs ut artem falleret,\nEt medelam ferret inde,\nHostis unde læserat.\n\nQuando venit ergo sacri\nPlenitudo temporis,\nMissus est ab arce Patris\nNatus, orbis Conditor;\nAtque ventre virginali\nCarne amictus prodiit.\n\nVagit infans inter arcta\nConditus præsepia:\nMembra pannis involuta\nVirgo Mater alligat:\nEt Dei manus pedesque\nStricta cingit fascia.\n\nLustra sex qui jam peregit,\nTempus implens corporis,\nSponte libera Redemptor\nPassioni deditus,\nAgnus in Crucis levatur\nImmolandus stipite.\n\nFelle potus ecce languet:\nSpina, clavi, lancea\nMite corpus perforarunt:\nUnda manat, et cruor:\nTerra, pontus, astra, mundus,\nQuo lavantur flumine!\n\nCrux fidelis, inter omnes\nArbor una nobilis:\nSilva talem nulla profert\nFronde, flore, germine:\nDulce ferrum, dulce lignum,\nDulce pondus sustinent.\n\nFlecte ramos arbor alta,\nTensa laxa viscera,\nEt rigor lentescat ille,\nQuem dedit nativitas;\nEt superni membra regis\nTende miti stipite.\n\nSola digna tu fuisti\nFerre mundi victimam;\nAtque portum præparare\nArca mundo naufrago,\nQuam sacer cruor perunxit,\nFusus Agni corpore.\n\nSempiterna sit beatæ\nTrinitati gloria,\nÆqua Patri, Filioque;\nPar decus Paraclito:\nUnius Trinique nomen\nLaudet universitas.",
      summary:
        "Venantius Fortunatus's sixth-century hymn of the Holy Cross, in the Roman Breviary's text: the whole hymn is sung at the Adoration of the Cross on Good Friday with Crux fidelis as its refrain, and in Passiontide and on the feasts of the Cross its first five stanzas are the Matins hymn and the rest, from Lustra sex, the Lauds hymn. It is a different hymn from Saint Thomas Aquinas's Eucharistic Pange lingua, which is modelled on it. The English is the translation of John Mason Neale (1818-1866), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["good-friday", "passiontide", "holy-week", "september-14"],
      relatedSaints: [],
      citations: [`${BRITT}126/mode/1up`, `${BRITT}127/mode/1up`, `${BRITT}128/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "audi-benigne-conditor",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}117/mode/1up`],
    payload: {
      slug: "audi-benigne-conditor",
      title: "Audi benigne Conditor (O kind Creator, bow Thine ear)",
      body: "O kind Creator, bow Thine ear\nTo mark the cry, to know the tear\nBefore Thy throne of mercy spent\nIn this Thy holy fast of Lent.\n\nOur hearts are open, Lord, to Thee:\nThou knowest our infirmity;\nPour out on all who seek Thy face\nAbundance of Thy pardoning grace.\n\nOur sins are many, this we know;\nSpare us, good Lord, Thy mercy show;\nAnd for the honor of Thy name\nOur fainting souls to life reclaim.\n\nGive us the self-control that springs\nFrom discipline of outward things,\nThat fasting inward secretly\nThe soul may purely dwell with Thee.\n\nWe pray Thee, Holy Trinity,\nOne God, unchanging Unity,\nThat we from this our abstinence\nMay reap the fruits of penitence.",
      prayerType: "hymn",
      category: "penitential",
      language: "en",
      latin:
        "Audi benigne Conditor\nNostras preces cum fletibus,\nIn hoc sacro jejunio\nFusas quadragenario.\n\nScrutator alme cordium,\nInfirma tu scis virium:\nAd te reversis exhibe\nRemissionis gratiam.\n\nMultum quidem peccavimus,\nSed parce confitentibus:\nAd nominis laudem tui\nConfer medelam languidis.\n\nConcede nostrum conteri\nCorpus per abstinentiam;\nCulpæ ut relinquant pabulum\nJejuna corda criminum.\n\nPræsta beata Trinitas,\nConcede simplex Unitas;\nUt fructuosa sint tuis\nJejuniorum munera.",
      summary:
        "The Vespers hymn for Sundays and weekdays of Lent in the Roman Breviary, attributed to Pope Saint Gregory the Great: the kind Creator, who searches hearts and knows our weakness, is asked to hear the prayers poured out with tears in the forty days' fast and to pardon those who return to him. The English is the translation of Thomas Alexander Lacey (1853-1931), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["lent", "vespers", "evening"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${BRITT}117/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "placare-christe-servulis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}312/mode/1up`, `${BRITT}313/mode/1up`],
    payload: {
      slug: "placare-christe-servulis",
      title: "Placare, Christe, servulis (O Christ, Thy guilty people spare!)",
      body: "O Christ, Thy guilty people spare!\nLo, kneeling at Thy gracious throne,\nThy Virgin-Mother pours her prayer,\nImploring pardon for her own.\n\nYe Angels, happy evermore!\nWho in your circles nine ascend,\nAs ye have guarded us before,\nSo still from harm our steps defend.\n\nYe Prophets and Apostles high!\nBehold our penitential tears;\nAnd plead for us when death is nigh,\nAnd our all-searching Judge appears.\n\nYe Martyrs all! a purple band,\nAnd Confessors, a white-robed train;\nOh, call us to our native land,\nFrom this our exile, back again.\n\nAnd ye, O choirs of Virgins chaste!\nReceive us to your seats on high;\nWith Hermits whom the desert waste\nSent up of old into the sky.\n\nDrive from the flock, O Spirit blest!\nThe false and faithless race away;\nThat all within one fold may rest,\nSecure beneath one Shepherd's sway.\n\nTo God the Father glory be,\nAnd to His sole-begotten Son;\nAnd glory, Holy Ghost, to Thee,\nWhile everlasting ages run.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Placare, Christe, servulis,\nQuibus Patris clementiam\nTuæ ad tribunal gratiæ\nPatrona Virgo postulat.\n\nEt vos beata, per novem\nDistincta gyros agmina,\nAntiqua cum præsentibus,\nFutura damna pellite.\n\nApostoli cum Vatibus,\nApud severum Judicem,\nVeris reorum fletibus\nExposcite indulgentiam.\n\nVos purpurati Martyres,\nVos candidati præmio\nConfessionis, exsules\nVocate nos in patriam.\n\nChorea casta Virginum,\nEt quos eremus incolas\nTransmisit astris, cœlitum\nLocate nos in sedibus.\n\nAuferte gentem perfidam\nCredentium de finibus,\nUt unus omnes unicum\nOvile nos pastor regat.\n\nDeo Patri sit gloria,\nNatoque Patris unico,\nSancto simul Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The Vespers hymn of All Saints (1 November) in the Roman Breviary, the 1632 recasting of the older Christe, Redemptor omnium, conserva tuos famulos ascribed to Rabanus Maurus: the Virgin, the nine choirs of angels, the prophets and apostles, the martyrs and confessors, the virgins and the hermits are asked in turn to plead for those still in exile. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["all-saints", "november-1", "vespers"],
      relatedSaints: [],
      citations: [`${BRITT}312/mode/1up`, `${BRITT}313/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "christe-sanctorum-decus-angelorum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}293/mode/1up`, `${BRITT}294/mode/1up`],
    payload: {
      slug: "christe-sanctorum-decus-angelorum",
      title: "Christe, sanctorum decus Angelorum (Christ, of the Angels praise and adoration)",
      body: "Christ, of the Angels praise and adoration,\nFather and Saviour Thou, of every nation,\nGraciously grant us all to gain a station,\nWhere Thou art reigning.\n\nAngel all peaceful, to our dwellings send us,\nMichael, from heaven coming to befriend us,\nBreathing serenest peace may he attend us,\nGrim war dispelling.\n\nAngel of strength, who triumphed, tumults quelling,\nGabriel send us, ancient foes expelling,\nOft in these temples may he make his dwelling,\nDear unto heaven.\n\nAngel Physician, health on man bestowing,\nRaphael send us from the skies all glowing,\nAll sickness curing, wisest counsel showing\nIn doubt and danger.\n\nMay the fair Mother of the Light be o'er us,\nVirgin of peace, with all the Angel chorus,\nAnd may the heavenly army go before us,\nGuiding and guarding.\n\nO May the Godhead, endless bliss possessing,\nFather, Son, Spirit, grant to us this blessing;\nAll His creation joins His praise confessing,\nNow and forever.",
      prayerType: "hymn",
      category: "angelic",
      language: "en",
      latin:
        "Christe, sanctorum decus Angelorum,\nGentis humanæ sator et redemptor,\nCœlitum nobis tribuas beatas\nScandere sedes.\n\nAngelus pacis Michael in ædes\nCœlitus nostras veniat, serenæ\nAuctor ut pacis lacrimosa in orcum\nBella releget.\n\nAngelus fortis Gabriel, ut hostes\nPellat antiquos, et amica cœlo,\nQuæ triumphator statuit per orbem,\nTempla revisat.\n\nAngelus nostræ medicus salutis,\nAdsit e cœlo Raphael, ut omnes\nSanet ægrotos, dubiosque vitæ\nDirigat actus.\n\nVirgo dux pacis, Genitrixque lucis,\nEt sacer nobis chorus Angelorum\nSemper assistat, simul et micantis\nRegia cœli.\n\nPræstet hoc nobis Deitas beata\nPatris, ac Nati, pariterque sancti\nSpiritus, cujus resonat per omnem\nGloria mundum.",
      summary:
        "The Lauds hymn of the feast of Saint Michael (29 September) in the Roman Breviary, a Sapphic hymn ascribed to Rabanus Maurus: Christ, the glory of the holy angels, is asked to send Michael the angel of peace, Gabriel the angel of strength and Raphael the physician of our salvation, and with them the Virgin and the whole choir of angels, to guard his people. The English is the translation of T. I. Ball, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["september-29", "lauds", "morning"],
      relatedSaints: [],
      citations: [`${BRITT}293/mode/1up`, `${BRITT}294/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "custodes-hominum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}295/mode/1up`, `${BRITT}296/mode/1up`],
    payload: {
      slug: "custodes-hominum",
      title:
        "Custodes hominum psallimus Angelos (Angel-guardians of men, spirits and powers we sing)",
      body: "Angel-guardians of men, spirits and powers we sing,\nWhom our Father hath sent, aids to our weakly frame,\nHeavenly friends and guides, help from on high to bring,\nLest we fail through the foeman's wile.\n\nHe, the spoiler of souls, Angel-traitor of old,\nCast in merited wrath out of his honored place,\nBurns with envy and hate, seeking their souls to gain\nWhom God's mercy invites to heaven.\n\nTherefore come to our help, watchful ward of our lives:\nTurn aside from the land God to thy care confides\nSickness and woe of soul, yea, and what else of ill\nPeace of heart to its folk denies.\n\nNow to the Holy Three praise evermore resound:\nUnder whose hand divine resteth the triple world\nGoverned in wondrous wise: glory be theirs and might\nWhile the ages unending run.",
      prayerType: "hymn",
      category: "angelic",
      language: "en",
      latin:
        "Custodes hominum psallimus Angelos,\nNaturæ fragili quos Pater addidit\nCœlestis comites, insidiantibus\nNe succumberet hostibus.\n\nNam quod corruerit proditor angelus,\nConcessis merito pulsus honoribus,\nArdens invidia pellere nititur\nQuos cœlo Deus advocat.\n\nHuc custos igitur pervigil advola,\nAvertens patria de tibi credita\nTam morbos animi, quam requiescere\nQuidquid non sinit incolas.\n\nSanctæ sit Triadi laus pia jugiter,\nCujus perpetuo numine machina\nTriplex hæc regitur, cujus in omnia\nRegnat gloria sæcula.",
      summary:
        "The Vespers hymn of the feast of the Guardian Angels (2 October) in the Roman Breviary, ascribed to Saint Robert Bellarmine: the angels the Father gave as heavenly companions to our frail nature guard us against the fallen angel, who in his envy tries to drive away those whom God calls to heaven. The English is the translation of Alan G. McDougall (1895-1964), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["october-2", "vespers", "protection"],
      relatedSaints: [],
      citations: [`${BRITT}295/mode/1up`, `${BRITT}296/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "te-joseph-celebrent",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}243/mode/1up`, `${BRITT}244/mode/1up`],
    payload: {
      slug: "te-joseph-celebrent",
      title: "Te, Joseph, celebrent (Let Angels chant thy praise, pure spouse of purest Bride)",
      body: "Let Angels chant thy praise, pure spouse of purest Bride,\nWhile Christendom's sweet choirs the gladsome strains repeat,\nTo tell thy wondrous fame, to raise the pealing hymn,\nWherewith we all thy glory greet.\n\nWhen doubts and bitter fears thy heavy heart oppressed,\nAnd filled thy righteous soul with sorrow and dismay,\nAn Angel quickly came, the wondrous secret told,\nAnd drove thy anxious griefs away.\n\nThy arms thy new-born Lord, with tender joy embrace;\nHim then to Egypt's Land thy watchful care doth bring;\nHim in the Temple's courts once lost thou dost regain,\nAnd 'mid thy tears dost greet thy King.\n\nNot till death's pangs are o'er do others gain their crown,\nBut, Joseph, unto thee the blessed lot was given\nWhile life did yet endure, thy God to see and know,\nAs do the Saints above in heaven.\n\nGrant us, great Trinity, for Joseph's holy sake,\nIn highest bliss and love, above the stars to reign,\nThat we in joy with him may praise our loving God,\nAnd sing our glad eternal strain.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Te, Joseph, celebrent agmina cœlitum,\nTe cuncti resonent christiadum chori,\nQui clarus meritis, junctus es inclytæ\nCasto fœdere Virgini.\n\nAlmo cum tumidam germine conjugem\nAdmirans, dubio tangeris anxius,\nAfflatu superi Flaminis Angelus\nConceptum puerum docet.\n\nTu natum Dominum stringis, ad exteras\nÆgypti profugum tu sequeris plagas;\nAmissum Solymis quæris, et invenis,\nMiscens gaudia fletibus.\n\nPost mortem reliquos mors pia consecrat,\nPalmamque emeritos gloria suscipit:\nTu vivens, Superis par, frueris Deo,\nMira sorte beatior.\n\nNobis, summa Trias, parce precantibus,\nDa Joseph meritis sidera scandere:\nUt tandem liceat nos tibi perpetim\nGratum promere canticum.",
      summary:
        "The Vespers hymn of the feast of Saint Joseph (19 March) in the Roman Breviary, a seventeenth-century hymn of unknown authorship: the spouse of the Virgin, troubled until the angel told him the mystery, embraced the new-born Lord, followed him into Egypt and found him in the Temple, and was given to enjoy the presence of God while still on earth. The English is the translation of Thomas Joseph Potter (1828-1873), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["march-19", "vespers"],
      relatedSaints: ["saint-joseph"],
      citations: [`${BRITT}243/mode/1up`, `${BRITT}244/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-lux-beata-caelitum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}226/mode/1up`, `${BRITT}227/mode/1up`],
    payload: {
      slug: "o-lux-beata-caelitum",
      title: "O Lux beata caelitum (O highest Hope of mortals)",
      body: "O highest Hope of mortals,\nBlest Light of Saints above,\nO Jesu, on whose boyhood\nHome smiled with kindly love;\n\nAnd thou whose bosom nursed Him,\nO Mary, highly graced,\nWhose breast gave milk to Jesus,\nWhose arms thy God embraced;\n\nAnd thou of all men chosen\nTo guard the Virgin's fame,\nTo whom God's Son refused not\nA Father's gracious name;\n\nBorn for the nation's healing,\nOf Jesse's lineage high,\nBehold the suppliants kneeling,\nO hear the sinners' cry!\n\nThe sun returned to evening,\nDusks all the twilight air:\nWe, lingering here before you,\nPour out our heartfelt prayer.\n\nYour home was as a garden\nMade glad with fairest flowers;\nMay life thus blossom sweetly\nIn every home of ours.\n\nJesus, to Thee be glory,\nThe Maiden-Mother's Son,\nWith Father and with Spirit\nWhile endless ages run.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "O Lux beata cœlitum\nEt summa spes mortalium,\nJesu, o cui domestica\nArrisit orto caritas.\n\nMaria, dives gratia,\nO sola quæ casto potes\nFovere Jesum pectore,\nCum lacte donans oscula.\n\nTuque ex vetustis patribus\nDelecte custos Virginis,\nDulci patris quem nomine\nDivina Proles invocat.\n\nDe stirpe Jesse nobili\nNati in salutem gentium,\nAudite nos qui supplices\nVestras ad aras sistimus.\n\nDum sol redux ad vesperum\nRebus nitorem detrahit,\nNos hic manentes intimo\nEx corde vota fundimus.\n\nQua vestra sedes floruit\nVirtutis omnis gratia,\nHanc detur in domesticis\nReferre posse moribus.\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre, et almo Spiritu,\nIn sempiterna sæcula.",
      summary:
        "The Vespers hymn of the feast of the Holy Family in the Roman Breviary, written by Pope Leo XIII (1810-1903): Jesus, Mary and Joseph, sprung from the noble stock of Jesse, are asked at the going down of the sun to hear their suppliants, so that the virtues that flowered in the house of Nazareth may blossom in every home. The English is from the Marquess of Bute's translation of the Roman Breviary, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["holy-family", "vespers", "families"],
      relatedSaints: ["saint-joseph"],
      citations: [`${BRITT}226/mode/1up`, `${BRITT}227/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "sacra-jam-splendent",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}228/mode/1up`, `${BRITT}229/mode/1up`],
    payload: {
      slug: "sacra-jam-splendent",
      title: "Sacra jam splendent (A thousand lights their glory shed)",
      body: "A thousand lights their glory shed\nOn shrines and altars garlanded;\nWhile swinging censers dusk the air\nWith perfumed prayer.\n\nAnd shall we sing the ancestry\nOf Jesus, Son of God most High?\nOr the heroic names retrace\nOf David's race?\n\nSweeter is lowly Nazareth,\nWhere Jesus drew His childish breath—\nSweeter the singing that endears\nHis hidden years.\n\nAn Angel leads the pilgrim band\nFrom Egypt to their native land,\nWhere Jesus clings to Joseph's arm,\nSecure from harm.\n\n\"And the Child grew in wisdom's ken\nAnd years and grace with God and men;\"\nAnd in His father's humble art\nTook share and part.\n\n\"With toil,\" saith He, \"my limbs are wet,\nPrefiguring the Bloody Sweat:\"\nAh! how He bears our chastisement\nWith sweet content!\n\nAt Joseph's bench, at Jesus' side,\nThe Mother sits, the Virgin-Bride;\nHappy, if she may cheer their hearts\nWith loving arts.\n\nO Blessed Three! who felt the sting\nOf want and toil and suffering,\nPity the needy and obscure\nLot of the poor.\n\nBanish the \"pride of life\" from all\nWhom ampler wealth and joys befall:\nBe every heart with love repaid\nThat seeks your aid.\n\nGlory to Thee, O Jesu dear,\nModel of holy living here!\nWho reign'st, with Sire and Holy Ghost,\nO'er heaven's host.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "Sacra jam splendent decorata lychnis\nTempla, jam sertis redimitur ara\nEt pio fumant redolentque acerræ\nThuris honore.\n\nNum juvet Summo Geniti Parente\nRegios ortus celebrare cantu?\nNum domus David, decora et vetustæ\nNomina gentis?\n\nGratius nobis memorare parvum\nNazaræ tectum, tenuemque cultum,\nGratius Jesu tacitam referre\nCarmine vitam.\n\nNili ab extremis peregrinus oris\nAngeli ductu, propere remigrat\nMulta perpessus Puer et paterno\nLimine sospes,\n\nArte, qua Joseph, humili excolendus\nAbdito Jesus juvenescit ævo,\nSeque fabrilis socium laboris\nAdjicit ultro.\n\nIrriget sudor mea membra, dixit,\nAntequam sparso madeant cruore:\nHæc quoque humano generi expiando\nPœna luatur.\n\nAssidet Nato pia Mater almo,\nAssidet Sponso bona nupta; felix\nSi potest curas relevare fessis\nMunere amico.\n\nO neque expertes, operæ et laboris,\nNec mali ignari, miseros juvate,\nQuos reluctantes per acuta rerum\nUrget egestas.\n\nDemite his fastus, quibus ampla splendet\nFaustitas, mentem date rebus æquam:\nQuotquot implorant columen, benigno\nCernite vultu.\n\nSit tibi, Jesu, decus atque virtus,\nSancta qui vitæ documenta præbes,\nQuique cum summo Genitore et almo\nFlamine regnas.",
      summary:
        "The Matins hymn of the feast of the Holy Family in the Roman Breviary, written in Sapphic verse by Pope Leo XIII: instead of the royal ancestry of the Son of God it sings the hidden life at Nazareth, the return from Egypt, the Child sharing Joseph's trade and Mary's care for both, and asks the Holy Family to help the poor in their want and to humble the proud. The English is the translation of Monsignor Hugh T. Henry (1862-1946), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["holy-family", "office-of-readings", "families", "work"],
      relatedSaints: ["saint-joseph"],
      citations: [`${BRITT}228/mode/1up`, `${BRITT}229/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-gente-felix-hospita",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}230/mode/1up`, `${BRITT}231/mode/1up`],
    payload: {
      slug: "o-gente-felix-hospita",
      title: "O gente felix hospita (O house of Nazareth the blest)",
      body: "O house of Nazareth the blest,\nFair hostess of the Lord,\nThe Church was nurtured at Thy breast\nAnd shared thy scanty hoard.\n\nIn all the spreading lands of earth\nThe wandering sun may see\nNo dearer spot, no ampler worth\nThan erst was found in thee!\n\nWe know thy humble tenement\nWas heaven's hermitage:\nCelestial heralds came and went\nIn endless embassage.\n\nThere, whatsoever Joseph asks\nChrist hastens to fulfill;\nWhile Mary loves the household tasks\nThat wait her joyous will.\n\nThere, Joseph toileth at her side\nHer joys and griefs to share,\nWith thousand ties knit to his bride,\nOf love and work and prayer.\n\nYet how their bosoms constant burn\nAnd deeper ardors prove\nIn love of Christ, whose eyes return\nTokens of mutual love.\n\nO then, in all the homes of earth,\nBe Love the bond of life:\nMay it enthrone at every hearth\nThe peace that husheth strife.\n\nO Jesu, born of Virgin bright,\nAll glory be to Thee,\nWith Father and with Paraclete,\nThrough all eternity.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "O gente felix hospita\nAugusta sedes Nazaræ,\nQuæ fovit alma Ecclesiæ\nEt protulit primordia.\n\nSol, qui pererrat aureo\nTerras jacentes lumine,\nNil gratius per sæcula\nHac vidit æde, aut sanctius.\n\nAd hanc frequentes convolant\nCœlestis aulæ nuntii,\nVirtutis hoc sacrarium\nVisunt, revisunt, excolunt.\n\nQua mente Jesus, qua manu,\nOptata patris perficit!\nQuo Virgo gestit gaudio\nMaterna obire munera!\n\nAdest amoris particeps\nCuræque Joseph conjugi,\nQuos mille jungit nexibus\nVirtutis auctor gratia.\n\nHi diligentes invicem\nIn Jesu amorem confluunt,\nUtrique Jesus mutuæ\nDat caritatis præmia.\n\nSic fiat, ut nos caritas\nJungat perenni fœdere,\nPacemque alens domesticam\nAmara vitæ temperet!\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre, et almo Spiritu,\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn of the feast of the Holy Family in the Roman Breviary, written by Pope Leo XIII: the sun has seen nothing dearer or holier than the house of Nazareth, where the Church was first nurtured, where Jesus did what his father asked and Mary rejoiced in her household tasks; it prays that love may bind every home in the same peace. The English is the translation of Monsignor Hugh T. Henry (1862-1946), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["holy-family", "lauds", "families"],
      relatedSaints: ["saint-joseph"],
      citations: [`${BRITT}230/mode/1up`, `${BRITT}231/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "caelestis-aulae-nuntius",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}298/mode/1up`, `${BRITT}299/mode/1up`],
    payload: {
      slug: "caelestis-aulae-nuntius",
      title: "Caelestis aulae Nuntius (The Messenger from God's high throne)",
      body: "The Messenger from God's high throne\nHis secret counsel making known\nHails Mary, child of David's race,\nGod's Virgin-Mother, full of grace.\n\nThe Mother-Maid with joyous feet\nHer friend, John's mother, goes to greet;\nHe, stirring in the enclosing womb,\nDeclares that Christ his Lord has come.\n\nThe Word, who ere the worlds began,\nFrom God the Father's thought forth ran,\nOf Mary, Virgin undefiled,\nFor us is born a mortal child.\n\nChrist to the Temple courts they bring;\nThe King's own law subjects the King;\nThe world's Redeemer for a price\nIs there redeemed, our sacrifice.\n\nThe joyful Mother finds once more\nThe Son she mourned as lost before;\nWhile doctors by His speech were shown\nThe mysteries they had never known.\n\nTo God the Three in One be praise,\nWho through these holy mysteries\nGrants grace to those who seek in prayer\nThe glory of His bliss to share.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Cœlestis aulæ Nuntius,\nArcana pandens Numinis,\nPlenam salutat gratia\nDei Parentem Virginem.\n\nVirgo propinquam sanguine\nMatrem Joannis visitat,\nQui clausus alvo gestiens\nAdesse Christum nuntiat.\n\nVerbum, quod ante sæcula\nE mente Patris prodiit,\nE Matris alvo Virginis\nMortalis Infans nascitur.\n\nTemplo puellus sistitur,\nLegique paret Legifer,\nHic se Redemptor paupere\nPretio redemptus immolat.\n\nQuem jam dolebat perditum,\nMox læta Mater invenit\nIgnota doctis mentibus\nEdisserentem Filium.\n\nGloria tibi Domine\nQui natus es de Virgine,\nCum Patre et Sancto Spiritu\nIn sempiterna sæcula.",
      summary:
        "The Vespers hymn of the feast of the Holy Rosary (7 October) in the Roman Breviary, by the Dominican Augustine Ricchini (eighteenth century), on the five joyful mysteries: the Annunciation, the Visitation, the Nativity, the Presentation in the Temple and the finding of the Child among the doctors. The English is the translation of Alan G. McDougall (1895-1964), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["october-7", "rosary", "vespers", "october"],
      relatedSaints: [],
      citations: [`${BRITT}298/mode/1up`, `${BRITT}299/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "in-monte-olivis-consito",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}300/mode/1up`, `${BRITT}301/mode/1up`],
    payload: {
      slug: "in-monte-olivis-consito",
      title: "In monte olivis consito (The Mount of Olives witnesseth)",
      body: "The Mount of Olives witnesseth\nThe awful agony of God:\nHis soul is sorrowful to death,\nHis sweat of blood bedews the sod.\n\nAnd now the traitor's work is done:\nThe clamorous crowds around Him surge;\nBound to pillar, God the Son\nQuivers beneath the blood-red scourge.\n\nLo! clad in purple soiled and worn,\nMeekly the Saviour waiteth now\nWhile wretches plait the cruel thorn\nTo crown with shame His royal brow.\n\nSweating and sighing, faint with loss\nOf what hath flowed from life's red fount,\nHe bears the exceeding heavy Cross\nUp to the verge of Calvary's mount.\n\nNailed to the wood of ancient curse,\nBetween two thieves the Sinless One\nStill praying for His murderers,\nBreathes forth His soul, and all is done!\n\nGlory to Thee, and honor meet,\nJesu, of Maiden-Mother born,\nAnd Father and the Paraclete,\nThrough endless ages of the morn!",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "In monte olivis consito\nRedemptor orans, procidit,\nMœret, pavescit, deficit,\nSudore manans sanguinis.\n\nA proditore traditus\nRaptatur in pœnas Deus,\nDurisque vinctus nexibus\nFlagris cruentis cæditur.\n\nIntexta acutis sentibus,\nCorona contumeliæ,\nSquallenti amictum purpura,\nRegem coronat gloriæ.\n\nMolis crucem ter arduæ,\nSudans, anhelans concidens,\nAd montis usque verticem\nGestare vi compellitur.\n\nConfixus atro stipite\nInter scelestos innocens,\nOrando pro tortoribus,\nExsanguis efflat spiritum.\n\nGloria tibi, Domine,\nQui natus es de Virgine,\nCum Patre et Sancto Spiritu\nIn sempiterna sæcula.",
      summary:
        "The Matins hymn of the feast of the Holy Rosary (7 October) in the Roman Breviary, by the Dominican Augustine Ricchini (eighteenth century), on the five sorrowful mysteries: the agony in the garden, the scourging at the pillar, the crowning with thorns, the carrying of the Cross and the crucifixion. The English is the translation of Monsignor Hugh T. Henry (1862-1946), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["october-7", "rosary", "office-of-readings", "lent"],
      relatedSaints: [],
      citations: [`${BRITT}300/mode/1up`, `${BRITT}301/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "jam-morte-victor-obruta",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}302/mode/1up`, `${BRITT}303/mode/1up`],
    payload: {
      slug: "jam-morte-victor-obruta",
      title: "Jam morte victor obruta (Now Christ, the Conqueror of death)",
      body: "Now Christ, the Conqueror of death,\nBreaks sin's enslaving chain,\nAnd rising from the tomb returns,\nAnd opens heaven again.\n\nAwhile beheld by mortal men,\nHe rises from their sight;\nAscending to the Father's throne,\nHe reigns in equal light.\n\nHis promised gift unto His own\nHe sends forth from above,\nAnd rains the Holy Spirit down\nIn fiery tongues of love.\n\nThe Virgin, freed of mortal weight,\nIs borne than stars yet higher,\nAnd with glad melody is hailed\nBy each Angelic choir.\n\nOur Mother's gentle brow now shines\nWith crown in starry sheen,\nAs nigh her Son, in light enthroned,\nShe reigns creation's Queen.\n\nO Jesu, born of Virgin bright,\nAll glory be to Thee,\nWith Father and with Paraclete,\nThrough all eternity.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Jam morte victor obruta\nAb inferis Christus redit,\nFractisque culpæ vinculis,\nCœli recludit limina.\n\nVisus satis mortalibus\nAscendit ad cœlestia,\nDexteræque Patris assidet\nConsors paternæ gloriæ.\n\nQuem jam suis promiserat,\nSanctum daturus Spiritum,\nLinguis amoris igneis\nMœstis alumnis impluit.\n\nSoluta carnis pondere\nAd astra Virgo tollitur,\nExcepta cœli jubilo,\nEt Angelorum canticis.\n\nBis sena cingunt sidera\nAlmæ parentis verticem:\nThrono propinqua Filii\nCunctis creatis imperat.\n\nGloria tibi, Domine,\nQui natus es de Virgine,\nCum Patre et Sancto Spiritu\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn of the feast of the Holy Rosary (7 October) in the Roman Breviary, by the Dominican Augustine Ricchini (eighteenth century), on the five glorious mysteries: the Resurrection, the Ascension, the descent of the Holy Spirit, the Assumption of the Virgin and her crowning with twelve stars. The English is the translation of the Benedictine nuns of Stanbrook, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["october-7", "rosary", "lauds", "easter"],
      relatedSaints: [],
      citations: [`${BRITT}302/mode/1up`, `${BRITT}303/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "aeterne-rector-siderum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}297/mode/1up`],
    payload: {
      slug: "aeterne-rector-siderum",
      title: "Aeterne Rector siderum (Ruler of the dread immense!)",
      body: "Ruler of the dread immense!\nMaker of this mighty frame!\nWhose eternal providence\nGuides it, as from Thee it came:\n\nLow before Thy throne we bend;\nHear our supplicating cries;\nAnd Thy light celestial send\nWith the freshly dawning skies.\n\nKing of kings, and Lord most High!\nThis of Thy dear love we pray:\nMay Thy Guardian Angel nigh,\nKeep us from all sin this day.\n\nMay he crush the deadly wiles\nOf the envious serpent's art,\nEver spreading cunning toils\nRound about the thoughtless heart.\n\nMay he scatter ruthless war\nEre to this our land it come;\nPlague and famine drive away,\nFix securely peace at home.\n\nFather, Son, and Holy Ghost,\nOne eternal Trinity!\nGuard by Thy Angelic host\nUs who put our trust in Thee.",
      prayerType: "hymn",
      category: "angelic",
      language: "en",
      latin:
        "Æterne Rector siderum,\nQui, quidquid est, potentia\nMagna creasti, nec regis\nMinore providentia:\n\nAdesto supplicantium\nTibi reorum cœtui,\nLucisque sub crepusculum\nLucem novam da mentibus.\n\nTuusque nobis Angelus\nElectus ad custodiam,\nHic adsit; a contagio\nUt criminum nos protegat.\n\nNobis draconis æmuli\nVersutias exterminet;\nNe rete fraudulentiæ\nIncauta nectat pectora.\n\nMetum repellat hostium\nNostris procul de finibus:\nPacem procuret civium,\nFugetque pestilentiam.\n\nDeo Patri sit gloria,\nQui, quos redemit Filius,\nEt sanctus unxit Spiritus,\nPer Angelos custodiat.",
      summary:
        "The Lauds hymn of the feast of the Guardian Angels (2 October) in the Roman Breviary, written by Saint Robert Bellarmine: as the day dawns the Ruler of the stars is asked to send each one's guardian angel to keep him from sin, foil the serpent's snares, and keep war, plague and famine far from the land. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["october-2", "lauds", "morning", "protection"],
      relatedSaints: [],
      citations: [`${BRITT}297/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "jesu-corona-virginum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}339/mode/1up`],
    payload: {
      slug: "jesu-corona-virginum",
      title: "Jesu, corona Virginum (Jesu, the Virgins' crown, do Thou)",
      body: "Jesu, the Virgins' crown, do Thou\nAccept us as in prayer we bow;\nBorn of that Virgin, whom alone\nThe Mother and the Maid we own.\n\nAmongst the lilies Thou dost feed,\nBy Virgin choirs accompanied—\nWith glory decked, the spotless brides\nWhose bridal gifts Thy love provides.\n\nThey, wheresoe'er Thy footsteps bend,\nWith hymns and praises still attend:\nIn blessèd troops they follow Thee,\nWith dance, and song, and melody.\n\nWe pray Thee therefore to bestow\nUpon our senses here below\nThy grace, that so we may endure\nFrom taint of all corruption pure.\n\nAll laud to God the Father be,\nAll praise, Eternal Son, to Thee;\nAll glory as is ever meet,\nTo God, the holy Paraclete.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Jesu, corona Virginum,\nQuem mater illa concipit,\nQuæ sola Virgo parturit:\nHæc vota clemens accipe.\n\nQui pergis inter lilia,\nSeptus choreis Virginum,\nSponsus decorus gloria,\nSponsisque reddens præmia.\n\nQuocumque tendis, Virgines\nSequuntur, atque laudibus\nPost te canentes cursitant,\nHymnosque dulces personant.\n\nTe deprecamur supplices;\nNostris ut addas sensibus,\nNescire prorsus omnia\nCorruptionis vulnera.\n\nVirtus, honor, laus, gloria\nDeo Patri cum Filio,\nSancto simul Paraclito,\nIn sæculorum sæcula.",
      summary:
        "The hymn for Vespers and Lauds in the Common of Virgins in the Roman Breviary, ascribed to Saint Ambrose and drawn from Isaias, the Canticle of Canticles and the Apocalypse: Christ, born of the one who alone is both Virgin and Mother, walks among the lilies with the choirs of virgins who follow the Lamb wherever he goes. The English is the translation of John Mason Neale (1818-1866), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["vespers", "lauds", "virgins"],
      relatedSaints: ["saint-ambrose"],
      citations: [`${BRITT}339/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "virginis-proles-opifexque-matris",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}340/mode/1up`, `${BRITT}341/mode/1up`],
    payload: {
      slug: "virginis-proles-opifexque-matris",
      title: "Virginis Proles, Opifexque Matris (Son of a Virgin, Maker of Thy Mother)",
      body: "Son of a Virgin, Maker of Thy Mother,\nThou, Rod and Blossom from a Stem unstainèd,\nNow while a Virgin fair of fame we honor,\nHear our devotion!\n\nLo, on Thy handmaid fell a twofold blessing,\nWho, in her body vanquishing the weakness,\nIn that same body, grace from heaven obtaining,\nBore the world witness.\n\nDeath, nor the rending pains of death appalled her;\nBondage and torment found her undefeated:\nSo by the shedding of her blood attained she\nHeavenly guerdon.\n\nFountain of mercy, hear the prayers she offers;\nPurge our offences, pardon our transgressions,\nSo that hereafter we to Thee may render\nPraise with thanksgiving.\n\nThou, the All-Father, Thou, the One-Begotten,\nThou, Holy Spirit, Three in One co-equal,\nGlory be henceforth Thine through all the ages,\nWorld without ending.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Virginis Proles, Opifexque Matris,\nVirgo quem gessit, peperitque Virgo;\nVirginis festum canimus beatæ,\nAccipe votum.\n\nHæc enim palmæ duplicis beata\nSorte, dum gestit fragilem domare\nCorporis sexum, domuit cruentum\nCæde tyrannum.\n\nUnde nec mortem, nec amica mortis\nMille pœnarum genera expavescens,\nSanguine effuso meruit serenum\nScandere cœlum.\n\nHujus oratu Deus alme nobis\nDebitas pœnas scelerum remitte;\nUt tibi puro resonemus almum\nPectore carmen.\n\nSit decus Patri, genitæque Proli,\nEt tibi compar utriusque virtus\nSpiritus semper, Deus unus omni\nTemporis ævo.",
      summary:
        "The Matins hymn in the Common of Virgins in the Roman Breviary, an eighth-century Sapphic hymn of unknown authorship: the whole hymn is sung for a virgin martyr, who won the double palm of virginity and martyrdom, and parts of it serve for virgins and for holy women. The English is the translation of Laurence Housman (1865-1959), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["office-of-readings", "virgins", "martyrs"],
      relatedSaints: [],
      citations: [`${BRITT}340/mode/1up`, `${BRITT}341/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "quicumque-christum-quaeritis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}283/mode/1up`, `${BRITT}284/mode/1up`],
    payload: {
      slug: "quicumque-christum-quaeritis",
      title: "Quicumque Christum quaeritis (All ye who would the Christ descry)",
      body: "All ye who would the Christ descry,\nLift up your eyes to Him on high:\nThere mortal gaze hath strength to see\nThe token of His majesty.\n\nA wondrous sign we there behold,\nThat knows not death nor groweth old,\nSublime, most high, that cannot fade,\nThat was ere earth and heaven were made.\n\nHere is the King the Gentiles fear,\nThe Jews' most mighty King is here\nPromised to Abraham of yore,\nAnd to his seed forevermore.\n\n'Tis He the Prophets' words foretold,\nAnd by their signs shown forth of old;\nThe Father's witness hath ordained\nThat we should hear with faith unfeigned.\n\nJesu, to Thee our praise we pay,\nTo little ones revealed to-day,\nWith Father and Blest Spirit One\nUntil the ages' course is done.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Quicumque Christum quæritis,\nOculos in altum tollite:\nIllic licebit visere\nSignum perennis gloriæ.\n\nIllustre quiddam cernimus,\nQuod nesciat finem pati,\nSublime, celsum, interminum,\nAntiquius cœlo et chao.\n\nHic ille Rex est Gentium,\nPopulique Rex Judaici,\nPromissus Abrahæ patri,\nEjusque in ævum semini.\n\nHunc et Prophetis testibus,\nIisdemque signatoribus\nTestator et Pater jubet\nAudire nos, et credere.\n\nJesu, tibi sit gloria,\nQui te revelas parvulis,\nCum Patre et almo Spiritu\nIn sempiterna sæcula.",
      summary:
        "The hymn for Vespers and Matins of the Transfiguration of Our Lord (6 August) in the Roman Breviary, a cento from the Epiphany hymn of the Cathemerinon of Prudentius (348-c. 413), the same poem that gives O sola magnarum urbium and Salvete flores Martyrum: lift your eyes to the mountain and see the sign of eternal glory, the King promised to Abraham, whom the Father bids us hear. The English is the translation of Alan G. McDougall (1895-1964), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["august-6", "transfiguration", "vespers"],
      relatedSaints: [],
      citations: [`${BRITT}283/mode/1up`, `${BRITT}284/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "auctor-beate-saeculi",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}194/mode/1up`, `${BRITT}195/mode/1up`],
    payload: {
      slug: "auctor-beate-saeculi",
      title: "Auctor beate saeculi (O Christ, the world's Creator bright)",
      body: "O Christ, the world's Creator bright,\nWho didst mankind from sin redeem,\nLight from the Father's glorious Light,\nTrue God of God, in bliss supreme.\n\nThy love compelled Thee to assume\nA mortal body, man to save;\nReversing the old Adam's doom;\nOur ransom the New Adam gave.\n\nThat love which gloriously framed all—\nThe earth, the stars, and wondrous sea—\nTook pity on our parents' fall,\nBroke all our bonds and set us free.\n\nO Saviour, let Thy potent love\nFlow ever from Thy bounteous Heart;\nTo nations that pure fount above\nThe grace of pardon will impart.\n\nHis Heart for this was opened wide,\nAnd wounded by the soldier's spear,\nThat freely from His sacred side\nMight flow the streams our souls to clear.\n\nGlory to Father and to Son,\nAnd to the Holy Ghost the same,\nTo whom all power, when time is done,\nAnd endless rule, in endless fame.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "Auctor beate sæculi,\nChriste Redemptor omnium:\nLumen Patris de lumine,\nDeusque verus de Deo.\n\nAmor coegit te tuus\nMortale corpus sumere,\nUt novus Adam redderes,\nQuod vetus ille abstulerat.\n\nIlle amor almus artifex\nTerræ marisque, et siderum,\nErrata patrum miserans,\nEt nostra rumpens vincula.\n\nNon corde discedat tuo\nVis illa amoris inclyti:\nHoc fonte gentes hauriant\nRemissionis gratiam.\n\nPercussum ad hoc est lancea,\nPassumque ad hoc est vulnera:\nUt nos lavaret sordibus,\nUnda fluente, et sanguine.\n\nDecus Parenti, et Filio,\nSanctoque sit Spiritui,\nQuibus potestas, gloria\nRegnumque in omne est sæculum.",
      summary:
        "The Vespers hymn of the feast of the Sacred Heart in the Roman Breviary, by an unknown eighteenth-century author: the same love that made earth, sea and stars moved Christ to take a mortal body as the new Adam, and his Heart was opened by the lance so that water and blood might wash away our sins. The English is the translation of Frederick Charles Husenbeth (1796-1872), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["feast-of-the-sacred-heart", "june", "vespers", "sacred-heart"],
      relatedSaints: [],
      citations: [`${BRITT}194/mode/1up`, `${BRITT}195/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "primo-die-quo-trinitas",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}40/mode/1up`, `${BRITT}41/mode/1up`],
    payload: {
      slug: "primo-die-quo-trinitas",
      title: "Primo die, quo Trinitas (Hail day! whereon the One in Three)",
      body: "Hail day! whereon the One in Three\nFirst formed the earth by sure decree,\nThe day its Maker rose again,\nAnd vanquished death, and burst our chain.\n\nAway with sleep and slothful ease!\nWe raise our hearts and bend our knees,\nAnd early seek the Lord of all,\nObedient to the Prophet's call.\n\nThat He may hearken to our prayer,\nStretch forth His strong right arm to spare,\nAnd ev'ry past offense forgiven,\nRestore us to our home in heaven.\n\nAssembled here this holy day,\nThis holiest hour we raise the lay;\nAnd O that He to whom we sing,\nMay now reward our offering!\n\nO Father of unclouded light!\nKeep us this day as in Thy sight,\nIn word and deed that we may be\nFrom ev'ry touch of evil free.\n\nThat this our body's mortal frame\nMay know no sin, and fear no shame,\nNor fire hereafter be the end\nOf passions which our bosoms rend.\n\nRedeemer of the world, we pray\nThat Thou wouldst wash our sins away,\nAnd give us, of Thy boundless grace,\nThe blessings of the heavenly place.\n\nMost Holy Father, hear our cry,\nThrough Jesus Christ our Lord most High\nWho, with the Holy Ghost and Thee\nShall live and reign eternally.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Primo die, quo Trinitas\nBeata mundum condidit,\nVel quo resurgens Conditor\nNos morte victa liberat:\n\nPulsis procul torporibus,\nSurgamus omnes ocyus,\nEt nocte quæramus Deum,\nPropheta sicut præcipit:\n\nNostras preces ut audiat,\nSuamque dextram porrigat,\nEt expiatos sordibus\nReddat polorum sedibus:\n\nUt, quique sacratissimo\nHujus diei tempore\nHoris quietis psallimus,\nDonis beatis muneret.\n\nJam nunc, paterna claritas,\nTe postulamus affatim:\nAbsint faces libidinis,\nEt omnis actus noxius.\n\nNe fœda sit, vel lubrica\nCompago nostri corporis,\nOb cujus ignes ignibus\nAvernus urat acrius.\n\nMundi Redemptor, quæsumus,\nTu probra nostra diluas:\nNobisque largus commoda\nVitæ perennis conferas.\n\nPræsta, Pater piissime,\nPatrique compar Unice,\nCum Spiritu Paraclito\nRegnans per omne sæculum.",
      summary:
        "The Sunday Matins hymn of the Roman Breviary from after Epiphany until Lent and in the autumn weeks, ascribed to Pope Saint Gregory the Great and recast in 1632 from the older Primo dierum omnium: Sunday is the first day, on which the Trinity made the world and the Creator rose from the dead, and the faithful rise by night to seek God as the Prophet bids. The English is the translation of John Mason Neale (1818-1866) and others, from The New Office Hymn Book, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["office-of-readings", "sunday", "morning"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${BRITT}40/mode/1up`, `${BRITT}41/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "decora-lux-aeternitatis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}262/mode/1up`],
    payload: {
      slug: "decora-lux-aeternitatis",
      title: "Decora lux aeternitatis (The beauteous light of God's eternal Majesty)",
      body: "The beauteous light of God's eternal Majesty\nStreams down in golden rays to grace this holy day\nWhich crowned the princes of the Apostles' glorious choir,\nAnd unto guilty mortals showed the heavenward way.\n\nThe teacher of the world and keeper of heaven's gate,\nRome's founders twain and rulers too of every land,\nTriumphant over death by sword and shameful cross,\nWith laurel crowned are gathered to the eternal band.\n\nO happy Rome! who in thy martyr princes' blood,\nA twofold stream, art washed and doubly sanctified.\nAll earthly beauty thou alone outshinest far,\nEmpurpled by their outpoured life-blood's glorious tide.\n\nAll honor, power, and everlasting jubilee\nTo Him who all things made and governs here below,\nTo God in essence One, and yet in persons Three,\nBoth now and ever, while unending ages flow.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Decora lux æternitatis, auream\nDiem beatis irrigavit ignibus,\nApostolorum quæ coronat Principes,\nReisque in astra liberam pandit viam.\n\nMundi Magister, atque cœli Janitor,\nRomæ parentes, arbitrique Gentium,\nPer ensis ille, hic per crucis victor necem\nVitæ senatum laureati possident.\n\nO Roma felix, quæ duorum Principum\nEs consecrata glorioso sanguine:\nHorum cruore purpurata ceteras\nExcellis orbis una pulchritudines.\n\nSit Trinitati sempiterna gloria,\nHonor, potestas, atque jubilatio,\nIn unitate, quæ gubernat omnia,\nPer universa sæculorum sæcula.",
      summary:
        "The Vespers hymn of the feast of Saints Peter and Paul (29 June) in the Roman Breviary, the 1632 revision of Aurea luce et decore roseo, which tradition ascribes to Elpis, wife of the philosopher Boethius: Peter the keeper of heaven's gate by the cross and Paul the teacher of the world by the sword won their crowns, and Rome, washed in their blood, outshines every beauty of the earth. The English is the translation of Canon L. Hall, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["june-29", "vespers"],
      relatedSaints: ["saint-peter", "saint-paul"],
      citations: [`${BRITT}262/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "jesu-redemptor-omnium-perpes-corona-praesulum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}336/mode/1up`],
    payload: {
      slug: "jesu-redemptor-omnium-perpes-corona-praesulum",
      title: "Jesu Redemptor omnium, perpes corona Praesulum (Jesu, the world's Redeemer, hear)",
      body: "Jesu, the world's Redeemer, hear;\nThy Bishops' fadeless crown, draw near:\nAccept with gentlest love to-day\nThe prayers and praises that we pay.\n\nThe meek Confessor of Thy Name\nTo-day attained a glorious fame;\nWhose yearly feast, in solemn state,\nThy faithful people celebrate.\n\nThe world and all its boasted good,\nAs vain and passing, he eschewed;\nAnd therefore with Angelic bands,\nIn endless joy forever stands.\n\nGrant then that we, most gracious God,\nMay follow in the steps he trod:\nAnd, at his prayer, Thy servants free\nFrom stain of all iniquity.\n\nTo Thee, O Christ, our loving King,\nAll glory, praise, and thanks we bring:\nAll glory, as is ever meet,\nTo Father and to Paraclete.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Jesu Redemptor omnium,\nPerpes corona Præsulum,\nIn hac die clementius\nIndulgeas precantibus.\n\nTui sacri qua nominis\nConfessor almus claruit:\nHujus celebrat annua\nDevota plebs solemnia,\n\nQui rite mundi gaudia\nHujus caduca respuens,\nÆternitatis præmio\nPotitur inter Angelos.\n\nHujus benignus annue\nNobis sequi vestigia:\nHujus precatu servulis\nDimitte noxam criminis.\n\nSit Christe Rex piissime\nTibi, Patrique gloria,\nCum Spiritu Paraclito,\nNunc et per omne sæculum.",
      summary:
        "The Lauds hymn for the feast of a confessor bishop in the Roman Breviary, an eighth-century Ambrosian hymn: Christ, the unfading crown of bishops, is asked on the saint's yearly feast to grant that the faithful may follow in the steps of one who spurned the world's passing joys and now stands among the angels. It is a different hymn from the Christmas hymn that opens with the same words. The English is the translation of John David Chambers (1805-1893), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["lauds", "confessors", "bishops"],
      relatedSaints: [],
      citations: [`${BRITT}336/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "sanctorum-meritis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}332/mode/1up`, `${BRITT}333/mode/1up`],
    payload: {
      slug: "sanctorum-meritis",
      title:
        "Sanctorum meritis inclyta gaudia (Sing, O Sons of the Church sounding the Martyrs' praise!)",
      body: "Sing, O Sons of the Church sounding the Martyrs' praise!\nGod's true soldiers applaud, who, in their weary days,\nWon bright trophies of good, glad be the voice ye raise,\nWhile these heroes of Christ ye sing!\n\nThey, while yet in the world were by the world abhorred;\nFelt how fading the joys, fleeting the wealth it stored;\nSpurned all pleasure for Thee, and at Thy call, O Lord,\nCame forth strong in Thy Name, as King.\n\nLord, how bravely they bore fury and pain for Thee!\nScourge, rod, sword, and the rack strongly endured; but free\nSang out, bold in Thy love, longing on high to be;\nEarth's might never their souls could bend.\n\nWhile they, shedding their blood, victims for Jesus fell,\nNo sound out of their lips came of their throes to tell;\nBowed low, patient and meek, loving the Lord so well,\nTurned they still to the Christ, their Friend.\n\nWhat joys, bright with the blood shed for thy love they share,\nThose brave Martyrs of Thine crowned with Thy laurels rare;\nMan's tongue never can tell, never can half declare,\nHow pure now is their bliss above!\n\nYet we, Father on high, God of eternal might,\nLift weak voices in prayer asking for peace and light;\nCleanse Thou out of our hearts every stain and blight,\nSo our songs may be songs of love.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Sanctorum meritis inclyta gaudia\nPangamus socii, gestaque fortia:\nGliscens fert animus promere cantibus\nVictorum genus optimum.\n\nHi sunt, quos fatue mundus abhorruit;\nHunc fructu vacuum, floribus aridum\nContempsere tui nominis asseclæ\nJesu Rex bone cœlitum.\n\nHi pro te furias, atque minas truces\nCalcarunt hominum, sævaque verbera:\nHis cessit lacerans fortiter ungula,\nNec carpsit penetralia.\n\nCæduntur gladiis more bidentium:\nNon murmur resonat, non querimonia;\nSed corde impavido mens bene conscia\nConservat patientiam.\n\nQuæ vox, quæ poterit lingua retexere,\nQuæ tu Martyribus munera præparas?\nRubri nam fluido sanguine fulgidis\nCingunt tempora laureis.\n\nTe summa o Deitas, unaque poscimus;\nUt culpas abigas, noxia subtrahas,\nDes pacem famulis, ut tibi gloriam\nAnnorum in seriem canant.",
      summary:
        "The Vespers hymn in the Common of Many Martyrs in the Roman Breviary, an eighth-century hymn of unknown authorship: the world despised them as barren and fruitless, yet they trod its threats and scourges underfoot, went to the sword like sheep without a murmur, and are now crowned with laurels bright with their blood. The English is the translation of Daniel Joseph Donahoe (1853-1930), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["vespers", "martyrs"],
      relatedSaints: [],
      citations: [`${BRITT}332/mode/1up`, `${BRITT}333/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rex-gloriose-martyrum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}329/mode/1up`, `${BRITT}330/mode/1up`],
    payload: {
      slug: "rex-gloriose-martyrum",
      title: "Rex gloriose Martyrum (O glorious King of Martyr hosts)",
      body: "O glorious King of Martyr hosts,\nThou Crown that each Confessor boasts,\nWho leadest to celestial day\nThose who have cast earth's joys away:\n\nThine ear in mercy, Saviour, lend,\nWhile unto Thee our prayers ascend;\nAnd as we count their triumphs won,\nForgive the sins that we have done.\n\nMartyrs in Thee their triumphs gain,\nFrom Thee Confessors grace obtain;\nO'ercome in us the lust of sin,\nThat we Thy pardoning love may win.\n\nTo Thee who, dead, again dost live,\nAll glory, Lord, Thy people give;\nAll glory, as is ever meet,\nTo Father and to Paraclete.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Rex gloriose Martyrum,\nCorona confitentium,\nQui respuentes terrea\nPerducis ad cœlestia:\n\nAurem benignam protinus\nIntende nostris vocibus:\nTrophæa sacra pangimus:\nIgnosce quod deliquimus.\n\nTu vincis inter Martyres,\nParcisque Confessoribus:\nTu vince nostra crimina,\nLargitor indulgentiæ.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn in the Common of Many Martyrs in the Roman Breviary, a sixth-century Ambrosian hymn that names confessors as well as martyrs and so was probably written for both: Christ conquers in the martyrs and spares in the confessors, and the faithful ask him to conquer their sins too. Britt prints it among the Eastertide hymns, with the Paschal doxology. The English is the translation of Richard Frederick Littledale (1833-1890) and George Herbert Palmer (1846-1926), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["lauds", "martyrs", "eastertide"],
      relatedSaints: [],
      citations: [`${BRITT}329/mode/1up`, `${BRITT}330/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "fortem-virili-pectore",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}342/mode/1up`, `${BRITT}343/mode/1up`],
    payload: {
      slug: "fortem-virili-pectore",
      title: "Fortem virili pectore (High let us all our voices raise)",
      body: "High let us all our voices raise\nIn that heroic woman's praise\nWhose name, with saintly glory bright,\nShines in the starry realms of light.\n\nFilled with a pure celestial glow,\nShe spurned all love of things below;\nAnd heedless here on earth to stay,\nClimbed to the skies her toilsome way.\n\nWith fasts her body she subdued,\nBut filled her soul with prayer's sweet food:\nIn other worlds she tastes the bliss\nFor which she left the joys of this.\n\nO Christ, the strength of all the strong;\nTo whom our holiest deeds belong!\nThrough her prevailing prayers on high,\nIn mercy hear Thy people's cry!\n\nTo God the Father, with the Son,\nAnd Holy Spirit, Three in One,\nBe glory while the ages flow,\nFrom all above, and all below.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Fortem virili pectore\nLaudemus omnes feminam,\nQuæ sanctitatis gloria\nUbique fulget inclyta.\n\nHæc sancto amore saucia,\nDum mundi amorem noxium\nHorrescit, ad cœlestia\nIter peregit arduum.\n\nCarnem domans jejuniis,\nDulcique mentem pabulo\nOrationis nutriens,\nCœli potitur gaudiis.\n\nRex Christe virtus fortium,\nQui magna solus efficis,\nHujus precatu, quæsumus,\nAudi benignus supplices.\n\nDeo Patri sit gloria,\nEjusque soli Filio,\nCum Spiritu Paraclito,\nNunc, et per omne sæculum.",
      summary:
        "The hymn for Vespers and Lauds in the Common of Holy Women in the Roman Breviary, written by Cardinal Silvio Antoniano (1540-1603): the valiant woman of manly heart, wounded with holy love, tamed her body with fasting, fed her soul on prayer and climbed the steep way to heaven. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["vespers", "lauds", "holy-women"],
      relatedSaints: [],
      citations: [`${BRITT}342/mode/1up`, `${BRITT}343/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "caelestis-urbs-jerusalem",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}343/mode/1up`, `${BRITT}344/mode/1up`],
    payload: {
      slug: "caelestis-urbs-jerusalem",
      title: "Caelestis urbs Jerusalem (Thou heavenly, new Jerusalem)",
      body: "Thou heavenly, new Jerusalem,\nVision of peace in prophet's dream!\nWith living stones built up on high,\nAnd rising to yon starry sky;\nIn bridal pomp thy form is crowned,\nWith thousand thousand Angels round!\n\nO Bride, betrothed in happy hour,\nThe Father's glory is thy dower;\nThe Bridegroom's grace is shed on thee\nThou Queen all fair eternally;\nTo Christ allied, thy Prince adored,\nBright shining city of the Lord!\n\nBehold with pearls they glittering stand\nThy peaceful gates to all expand;\nBy grace and strength divinely shed\nEach mortal thither may be led;\nWho, kindled by Christ's love, will dare\nAll earthly sufferings now to bear.\n\nBy many a salutary stroke,\nBy many a weary blow that broke,\nOr polished with a workman's skill,\nThe stones that form that glorious pile,\nThey all are fitly framed to lie\nIn their appointed place on high.\n\nFair and well-pleasing in Thy sight,\nParent most high, enthroned in light,\nAnd for Thine only Son most meet,\nAnd Thee, all-glorious Paraclete,\nTo whom praise, power, and glory rise\nForever through the eternal skies.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Cœlestis urbs Jerusalem,\nBeata pacis visio,\nQuæ celsa de viventibus\nSaxis ad astra tolleris,\nSponsæque ritu cingeris\nMille Angelorum millibus.\n\nO sorte nupta prospera,\nDotata Patris gloria,\nRespersa sponsi gratia,\nRegina formosissima,\nChristo jugata Principi,\nCœli corusca civitas.\n\nHic margaritis emicant,\nPatentque cunctis ostia:\nVirtute namque prævia\nMortalis illuc ducitur,\nAmore Christi percitus\nTormenta quisquis sustinet.\n\nScalpri salubris ictibus,\nEt tunsione plurima,\nFabri polita malleo\nHanc saxa molem construunt,\nAptisque juncta nexibus\nLocantur in fastigio.\n\nDecus Parenti debitum\nSit usquequaque Altissimo,\nNatoque Patris unico,\nEt inclyto Paraclito,\nCui laus, potestas, gloria\nÆterna sit per sæcula.",
      summary:
        "The hymn for Vespers and Matins of the Dedication of a Church in the Roman Breviary, the 1632 recasting of the sixth- or seventh-century Urbs Jerusalem beata: the heavenly Jerusalem, built of living stones and adorned as a bride for Christ, opens its gates of pearl to all who suffer for his love, and every stone is shaped by many blows for its place on high. The English is the translation of Joseph William Irons (1812-1883), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["dedication", "vespers", "office-of-readings"],
      relatedSaints: [],
      citations: [`${BRITT}343/mode/1up`, `${BRITT}344/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "urbs-jerusalem-beata",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}348/mode/1up`, `${BRITT}349/mode/1up`],
    payload: {
      slug: "urbs-jerusalem-beata",
      title: "Urbs Jerusalem beata (Blessed City, heavenly Salem)",
      body: "Blessed City, heavenly Salem,\nVision dear of peace and love,\nWho, of living stones upbuilded,\nArt the joy of heaven above,\nAnd, with Angel cohorts circled,\nAs a Bride to earth dost move!\n\nFrom celestial realms descending,\nReady for the nuptial bed,\nTo His presence, decked with jewels,\nBy her Lord shall she be led:\nAll her streets and all her bulwarks\nOf pure gold are fashionèd.\n\nBright with pearls her portal glitters;\nIt is open evermore;\nAnd, by virtue of His merits,\nThither faithful souls may soar,\nWho for Christ's dear Name in this world\nPain and tribulation bore.\n\nMany a blow and biting sculpture\nPolished well those stones elect,\nIn their places now compacted\nBy the heavenly Architect,\nWho therewith hath willed forever\nThat His palace should be decked.\n\nChrist is made the sure Foundation,\nAnd the precious Corner-stone,\nWho, the two walls underlying,\nBound in each, binds both in one,\nHoly Sion's help forever,\nAnd her confidence alone.\n\nAll that dedicated City,\nDearly loved by God on high,\nIn exultant jubilation\nPours perpetual melody;\nGod the One, and God the Trinal,\nSinging everlastingly.\n\nTo this temple, where we call Thee,\nCome, O Lord of Hosts, to-day;\nWith Thy wonted loving-kindness\nHear Thy people as they pray;\nAnd Thy fullest benediction\nShed within its walls for aye.\n\nHere vouchsafe to all Thy servants\nWhat they supplicate to gain;\nHere to have and hold forever\nThose good things their prayers obtain;\nAnd hereafter in Thy glory\nWith Thy blessèd ones to reign.\n\nLaud and honor to the Father;\nLaud and honor to the Son;\nLaud and honor to the Spirit;\nEver Three, and ever One:\nConsubstantial, co-eternal,\nWhile unending ages run.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Urbs Jerusalem beata,\nDicta pacis visio,\nQuæ construitur in cœlis\nVivis ex lapidibus,\nEt Angelis coronata,\nUt sponsata comite.\n\nNova veniens e cœlo,\nNuptiali thalamo,\nPræparata, ut sponsata\nCopuletur Domino:\nPlateæ et muri ejus,\nEx auro purissimo.\n\nPortæ nitent margaritis\nAdytis patentibus;\nEt virtute meritorum\nIlluc introducitur\nOmnis qui ob Christi nomen\nHic in mundo premitur.\n\nTunsionibus, pressuris\nExpoliti lapides,\nSuis coaptantur locis\nPer manus artificis,\nDisponuntur permansuri\nSacris ædificiis.\n\nAngularis fundamentum\nLapis Christus missus est,\nQui parietum compage\nIn utroque nectitur,\nQuem Sion sancta suscepit,\nIn quo credens permanet.\n\nOmnis illa Deo sacra,\nEt dilecta civitas,\nPlena modulis in laude,\nEt canore jubilo,\nTrinum Deum unicumque\nCum fervore prædicat.\n\nHoc in templo, summe Deus,\nExoratus adveni;\nEt clementi bonitate\nPrecum vota suscipe;\nLargam benedictionem\nHic infunde jugiter.\n\nHic promereantur omnes\nPetita acquirere,\nEt adepta possidere,\nCum Sanctis perenniter\nParadisum introire,\nTranslati in requiem.\n\nGloria et honor Deo\nUsquequaque Altissimo,\nUna Patri Filioque,\nInclyto Paraclito,\nCui laus est et potestas,\nPer æterna sæcula.",
      summary:
        "The original sixth- or seventh-century hymn for the Dedication of a Church, which the 1632 revisers recast as Caelestis urbs Jerusalem and Alto ex Olympi vertice and which the Liturgy of the Hours has restored: the heavenly Jerusalem comes down as a bride, its stones polished by many blows, and its second part, beginning Angularis fundamentum, hails Christ as the corner-stone and asks God to fill this temple with his blessing. The English is the translation of John Mason Neale (1818-1866), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922), where its second part is printed as a separate hymn.",
      occasions: ["dedication", "vespers"],
      relatedSaints: [],
      citations: [`${BRITT}348/mode/1up`, `${BRITT}349/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "adeste-fideles",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}105/mode/1up`],
    payload: {
      slug: "adeste-fideles",
      title: "Adeste, fideles (Come, all ye faithful)",
      body: "Come, all ye faithful,\nJoyful and triumphant,\nO hasten, O hasten to Bethlehem;\nSee in a manger\nThe Monarch of Angels.\nO come let us worship\nChrist the Lord.\n\nGod of God eternal,\nLight from Light proceeding,\nHe deigns in the Virgin's womb to lie;\nVery God of very God,\nBegotten, not created.\nO come, etc.\n\nSing alleluia,\nAll ye choirs of Angels;\nSing, all ye citizens of heaven above,\nGlory to God\nIn the highest.\nO come, etc.\n\nYea, Lord, we greet Thee,\nBorn this happy morning;\nTo Thee, O Jesus, be glory given;\nTrue Word of the Father,\nIn our flesh appearing.\nO come let us worship\nChrist the Lord.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "Adeste, fideles,\nLæti triumphantes;\nVenite, venite in Bethlehem;\nNatum videte\nRegem Angelorum:\nVenite adoremus,\nVenite adoremus,\nVenite adoremus Dominum.\n\nDeum de Deo,\nLumen de lumine,\nGestant puellæ viscera:\nDeum verum,\nGenitum, non factum:\nVenite adoremus Dominum.\n\nCantet nunc Io!\nChorus angelorum:\nCantet nunc aula cœlestium,\nGloria\nIn excelsis Deo!\nVenite adoremus Dominum.\n\nErgo qui natus\nDie hodierna,\nJesu tibi sit gloria:\nPatris æterni\nVerbum caro factum!\nVenite adoremus,\nVenite adoremus,\nVenite adoremus Dominum.",
      summary:
        "An eighteenth-century Christmas hymn of unknown authorship, four of whose eight stanzas are commonly sung at Benediction in Christmastide; it belongs to neither the Breviary nor the Missal. The faithful are called to Bethlehem to adore the newborn King of Angels, God of God and Light of Light, born of the Virgin. The English is the translation of Canon Frederick Oakeley (1802-1880), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["christmas", "december-25", "benediction"],
      relatedSaints: [],
      citations: [`${BRITT}105/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "audit-tyrannus-anxius",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}106/mode/1up`],
    payload: {
      slug: "audit-tyrannus-anxius",
      title: "Audit tyrannus anxius (With terror doth the tyrant hear)",
      body: "With terror doth the tyrant hear\nThe King of kings hath come to dwell\nWhere David's court shall widely rear\nA sceptered reign o'er Israel.\n\nThen cries out, raging, at the word:\n\"He comes to stand where we have stood:\nHence, soldier, and with ruthless sword\nDeluge the cradles deep with blood!\"\n\nWhat profiteth a crime so dread?\nWhat hope shall Herod's bosom sway?\nAlone amidst the thronging dead,\nThe Christ is safely borne away!\n\nAll glory for this blessèd morn\nTo God the Father ever be;\nAll praise to Thee, O Virgin-born,\nAll praise, O Holy Ghost, to Thee.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Audit tyrannus anxius\nAdesse regum Principem,\nQui nomen Israel regat,\nTeneatque David regiam.\n\nExclamat amens nuntio:\nSuccessor instat, pellimur:\nSatelles, i, ferrum rape:\nPerfunde cunas sanguine.\n\nQuid proficit tantum nefas?\nQuid crimen Herodem juvat?\nUnus tot inter funera\nImpune Christus tollitur.\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre, et almo Spiritu\nIn sempiterna sæcula.",
      summary:
        "The Matins hymn of the feast of the Holy Innocents (28 December) in the Roman Breviary, a cento from the Epiphany hymn in the Cathemerinon of Prudentius (348-c. 413): Herod, hearing that the King of kings has come, sends his soldiers to drench the cradles in blood, yet among so many deaths the Christ alone is carried away unharmed. The English is the translation of Monsignor Hugh T. Henry (1862-1946), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["december-28", "office-of-readings", "christmas"],
      relatedSaints: [],
      citations: [`${BRITT}106/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rex-sempiterne-caelitum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}147/mode/1up`, `${BRITT}148/mode/1up`],
    payload: {
      slug: "rex-sempiterne-caelitum",
      title: "Rex sempiterne caelitum (O Thou, the heavens' eternal King)",
      body: "O Thou, the heavens' eternal King,\nCreator, unto Thee we sing,\nWith God the Father ever One,\nCo-equal, co-eternal Son.\n\nThy hand, when first the world began,\nMade in Thine own pure image man,\nAnd linked to Adam, sprung from earth,\nA living soul of heavenly birth.\n\nAnd when by craft the envious foe\nHad marred Thy noblest work below,\nClothed in our flesh, Thou didst restore\nThe image Thou hadst made before.\n\nOnce wast Thou born of Mary's womb;\nAnd now, new-born from out the tomb,\nO Christ, Thou bidd'st us rise with Thee\nFrom death to immortality.\n\nEternal Shepherd, Thou dost lave\nThy flock in pure baptismal wave—\nThat mystic bath, that grave of sin,\nWhere ransomed souls new life begin.\n\nRedeemer, Thou for us didst deign\nTo hang upon the Cross of pain,\nAnd give for us the lavish price\nOf Thine own Blood in sacrifice.\n\nGrant, Lord, in Thee each faithful mind\nUnceasing Paschal joy may find;\nAnd from the death of sin set free\nSouls newly born to life by Thee.\n\nTo Thee, once dead, who now dost live,\nAll glory, Lord, Thy people give,\nWhom, with the Father, we adore,\nAnd Holy Ghost forevermore.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Rex sempiterne cœlitum,\nRerum Creator omnium,\nÆqualis ante sæcula\nSemper Parenti Filius.\n\nNascente qui mundo Faber\nImaginem vultus tui\nTradens Adamo, nobilem\nLimo jugasti spiritum.\n\nCum livor et fraus dæmonis\nFœdasset humanum genus:\nTu carne amictus, perditam\nFormam reformas Artifex.\n\nQui natus olim e Virgine,\nNunc e sepulcro nasceris\nTecumque nos a mortuis\nJubes sepultos surgere.\n\nQui pastor æternus gregem\nAqua lavas Baptismatis:\nHæc est lavacrum mentium;\nHæc est sepulcrum criminum.\n\nNobis diu qui debitæ\nRedemptor affixus Cruci,\nNostræ dedisti prodigus\nPretium salutis sanguinem.\n\nUt sis perenne mentibus\nPaschale, Jesu, gaudium,\nA morte dira criminum\nVitæ renatos libera.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The Matins hymn of Eastertide in the Roman Breviary, from Low Sunday to the Ascension, a sixth-century Ambrosian hymn: the Creator who gave Adam his image restored it by taking flesh, was born once from the Virgin and now from the tomb, and washes his flock in baptism, the bath of souls and the grave of sins. The English is a cento of earlier translations, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["easter", "eastertide", "office-of-readings", "baptism"],
      relatedSaints: [],
      citations: [`${BRITT}147/mode/1up`, `${BRITT}148/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "tristes-erant-apostoli",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}152/mode/1up`, `${BRITT}153/mode/1up`],
    payload: {
      slug: "tristes-erant-apostoli",
      title: "Tristes erant Apostoli (While Christ's disciples, grieving, sad)",
      body: "While Christ's disciples, grieving, sad,\nTheir Master's painful death deplore,\nWhom faithless servants' cruel hands,\nHad bathed in His own crimson gore;\n\nQuick from the happy realms above,\nAn Angel comes on joyful wing,\nAnd to the women tells the joy\nThat to His flock their Lord will bring.\n\nAs they with eager steps make haste,\nTheir joyous message to repeat,\nTheir Master's glorious form they see,\nAnd falling clasp His sacred feet.\n\nCheered by this tale, His faithful flock\nThe Galilean mount ascend,\nAnd there with loving awe behold\nTheir heart's sole wish, their truest friend.\n\nThat Thou mayst be our Paschal joy\nThrough happy, never-ending years,\nThine own poor children, Jesu, free\nFrom sin's sad death with all its fears.\n\nTo God the Father, and the Son,\nWho rose from death, glad praise repeat;\nLet equal praise be ever sung\nTo God the Holy Paraclete.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Tristes erant Apostoli\nDe Christi acerbo funere,\nQuem morte crudelissima\nServi necarant impii.\n\nSermone verax Angelus\nMulieribus prædixerat:\nMox ore Christus gaudium\nGregi feret fidelium.\n\nAd anxios Apostolos\nCurrunt statim dum nuntiæ,\nIllæ micantis obvia\nChristi tenent vestigia.\n\nGalilææ ad alta montium\nSe conferunt Apostoli,\nJesuque, voti compotes,\nAlmo beantur lumine.\n\nUt sis perenne mentibus\nPaschale Jesu gaudium;\nA morte dira criminum\nVitæ renatos libera.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The hymn for Vespers and Matins in the Common of Apostles and Evangelists in Eastertide in the Roman Breviary: the second part of the ancient Aurora lucis rutilat as revised in 1632. The apostles mourn their Master, the angel tells the women of the Resurrection, the women meet the risen Christ and clasp his feet, and the apostles see him on the mountain in Galilee. The English is the translation of Thomas Joseph Potter (1828-1873), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["easter", "eastertide", "vespers", "apostles"],
      relatedSaints: [],
      citations: [`${BRITT}152/mode/1up`, `${BRITT}153/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "paschale-mundo-gaudium",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}154/mode/1up`, `${BRITT}155/mode/1up`],
    payload: {
      slug: "paschale-mundo-gaudium",
      title: "Paschale mundo gaudium (With the fair sun of Easter morn)",
      body: "With the fair sun of Easter morn\nThe world's excelling joy is born,\nWhen, bright with new and greater grace,\nThe Apostles see the Saviour's face.\n\nThey in their Lord's fair flesh descry\nThe wounds that shine as stars on high,\nAnd, wondering, faithful witness bear,\nAnd all that they have seen declare.\n\nO Christ, most loving King, we pray,\nPossess our inmost hearts to-day,\nWhile grateful lips with glad acclaim\nSing fervent praises to Thy Name.\n\nLord Jesu, that Thou mayest be\nOur Easter joy eternally,\nOur souls from death of sin set free\nThat they, new born, may live to Thee.\n\nTo God the Father, and the Son,\nFrom death arisen, praise be done:\nWith God the Holy Ghost on high\nHenceforth to all eternity.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Paschale mundo gaudium\nSol nuntiat formosior,\nCum luce fulgentem nova\nJesum vident Apostoli.\n\nIn carne Christi vulnera\nMicare tamquam sidera\nMirantur, et quidquid vident\nTestes fideles prædicant.\n\nRex Christe clementissime,\nTu corda nostra posside:\nUt lingua grates debitas\nTuo rependat nomini.\n\nUt sis perenne mentibus\nPaschale Jesu gaudium;\nA morte dira criminum\nVitæ renatos libera.\n\nDeo Patri sit gloria,\nEt Filio, qui a mortuis\nSurrexit, ac Paraclito,\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn in the Common of Apostles and Evangelists in Eastertide in the Roman Breviary: the third part of the ancient Aurora lucis rutilat (Claro paschali gaudio) as revised in 1632. A fairer sun announces the Easter joy as the apostles see Jesus shining with new light, marvel at his wounds glowing like stars and bear faithful witness to what they have seen. The English is the translation of Alan G. McDougall (1895-1964), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["easter", "eastertide", "lauds", "apostles"],
      relatedSaints: [],
      citations: [`${BRITT}154/mode/1up`, `${BRITT}155/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "nocte-surgentes",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}42/mode/1up`, `${BRITT}43/mode/1up`],
    payload: {
      slug: "nocte-surgentes",
      title: "Nocte surgentes (Now, from the slumbers of the night arising)",
      body: "Now, from the slumbers of the night arising,\nChant we the holy psalmody of David,\nHymns to our Master, with a voice concordant,\nSweetly intoning.\n\nSo may our Monarch pitifully hear us,\nThat we may merit with His Saints to enter\nMansions eternal, therewithal possessing\nJoy beatific.\n\nThis be our portion, God forever blessèd,\nFather eternal, Son, and Holy Spirit,\nWhose is the glory, which through all creation\nEver resoundeth.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Nocte surgentes vigilemus omnes,\nSemper in psalmis meditemur, atque\nVoce concordi Domino canamus\nDulciter hymnos.\n\nUt pio Regi pariter canentes,\nCum suis sanctis mereamur aulam\nIngredi cœli, simul et perennem\nDucere vitam.\n\nPræstet hoc nobis Deitas beata\nPatris, ac Nati, pariterque sancti\nSpiritus, cujus resonat per omnem\nGloria mundum.",
      summary:
        "A Sapphic hymn attributed to Pope Saint Gregory the Great (c. 540-604), sung at Sunday Matins in the Roman Breviary from the third Sunday after Pentecost until the Sunday nearest the first of October: rising in the night, the faithful keep watch in psalms and sing to the Lord with one voice, that they may enter the court of heaven with his saints. The English is a cento from The Hymner in the metre of the original, altered to the Breviary text, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["office-of-readings", "sunday", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${BRITT}42/mode/1up`, `${BRITT}43/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ecce-jam-noctis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}53/mode/1up`, `${BRITT}54/mode/1up`],
    payload: {
      slug: "ecce-jam-noctis",
      title: "Ecce jam noctis (Lo, the dim shadows of the night are waning)",
      body: "Lo, the dim shadows of the night are waning;\nLightsome and blushing, dawn of day returneth;\nFervent in spirit, to the world's Creator\nPray we devoutly:\n\nThat He may pity sinners in their sighing,\nBanish all troubles, kindly health bestowing;\nAnd may He grant us, of His countless blessings,\nPeace that is endless.\n\nThis be our portion, God forever blessèd,\nFather eternal, Son, and Holy Spirit,\nWhose is the glory, which through all creation\nEver resoundeth.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Ecce jam noctis tenuatur umbra,\nLux et auroræ rutilans coruscat:\nSupplices rerum Dominum canora\nVoce precemur:\n\nUt reos culpæ miseratus, omnem\nPellat angorem, tribuat salutem,\nDonet et nobis bona sempiternæ\nMunera pacis.\n\nPræstet hoc nobis Deitas beata\nPatris, ac Nati, pariterque sancti\nSpiritus, cujus resonat per omnem\nGloria mundum.",
      summary:
        "A Sapphic hymn attributed to Pope Saint Gregory the Great, the companion of Nocte surgentes, sung at Sunday Lauds in the Roman Breviary from the third Sunday after Pentecost until the Sunday nearest the first of October: as the shadows thin and the dawn glows, the faithful ask the Lord of all to pity the guilty, banish anguish and grant the gifts of everlasting peace. The English is based on M. J. Blacker's translation of the original text, partly rewritten to fit the Breviary text, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["lauds", "sunday", "morning", "ordinary-time"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: [`${BRITT}53/mode/1up`, `${BRITT}54/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ales-diei-nuntius",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}59/mode/1up`, `${BRITT}60/mode/1up`],
    payload: {
      slug: "ales-diei-nuntius",
      title: "Ales diei nuntius (As the bird, whose clarion gay)",
      body: 'As the bird, whose clarion gay\nSounds before the dawn is grey,\nChrist, who brings the spirit\'s day,\nCalls us, close at hand:\n\n"Wake!" He cries, "and for my sake,\nFrom your eyes dull slumbers shake!\nSober, righteous, chaste, awake!\nAt the door I stand!"\n\nLord, to Thee we lift on high\nFervent prayer and bitter cry:\nHearts aroused to pray and sigh\nMay not slumber more:\n\nBreak the sleep of Death and Time,\nForged by Adam\'s ancient crime;\nAnd the light of Eden\'s prime\nTo the world restore!\n\nUnto God the Father, Son,\nHoly Spirit, Three in One,\nOne in Three, be glory done,\nNow and evermore.',
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Ales diei nuntius\nLucem propinquam præcinit:\nNos excitator mentium\nJam Christus ad vitam vocat.\n\nAuferte, clamat, lectulos,\nÆgro sopore desides:\nCastique, recti, ac sobrii\nVigilate, jam sum proximus.\n\nJesum ciamus vocibus,\nFlentes, precantes, sobrii:\nIntenta supplicatio\nDormire cor mundum vetat.\n\nTu, Christe, somnum discute:\nTu rumpe noctis vincula:\nTu solve peccatum vetus,\nNovumque lumen ingere.\n\nDeo Patri sit gloria,\nEjusque soli Filio,\nCum Spiritu Paraclito\nNunc et per omne sæculum.",
      summary:
        "The Tuesday Lauds hymn of the Roman Breviary, made from stanzas 1, 2, 21 and 25 of the Hymn at Cock-Crow, the first poem of the Cathemerinon of Prudentius (348-c. 413), with a doxology: as the bird of day foretells the light, Christ calls the sleeper to rise, keep watch and pray, and to put off the old sin for new light. The English is the translation of William John Courthope (1842-1917), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["lauds", "tuesday", "morning", "ordinary-time"],
      relatedSaints: [],
      citations: [`${BRITT}59/mode/1up`, `${BRITT}60/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "en-clara-vox-redarguit",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}99/mode/1up`],
    payload: {
      slug: "en-clara-vox-redarguit",
      title: "En clara vox redarguit (Hark, a herald voice is calling)",
      body: 'Hark, a herald voice is calling;\n"Christ is nigh," it seems to say;\n"Cast away the dreams of darkness,\nO ye children of the day."\n\nStartled at the solemn warning,\nLet the earth-bound soul arise;\nChrist, her Sun, all sloth dispelling,\nShines upon the morning skies.\n\nLo, the Lamb, so long expected,\nComes with pardon down from heaven;\nLet us haste, with tears of sorrow,\nOne and all to be forgiven.\n\nSo when next He comes with glory,\nWrapping all the earth in fear,\nMay He then as our defender\nOn the clouds of heaven appear.\n\nHonor, glory, virtue, merit,\nTo the Father and the Son,\nWith the co-eternal Spirit,\nWhile eternal ages run.',
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "En clara vox redarguit\nObscura quæque personans:\nProcul fugentur somnia:\nAb alto Jesus promicat.\n\nMens jam resurgat torpida,\nNon amplius jacens humi:\nSidus refulget jam novum,\nUt tollat omne noxium.\n\nEn Agnus ad nos mittitur\nLaxare gratis debitum:\nOmnes simul cum lacrimis\nPrecemur indulgentiam:\n\nUt, cum secundo fulserit,\nMetuque mundum cinxerit,\nNon pro reatu puniat,\nSed nos pius tunc protegat.\n\nVirtus, honor, laus, gloria\nDeo Patri cum Filio,\nSancto simul Paraclito,\nIn sæculorum sæcula.",
      summary:
        "The Advent hymn at Lauds in the Roman Breviary, the 1632 revision of the fifth-century Ambrosian hymn Vox clara ecce intonat: a clear voice rebukes the darkness and bids the sluggish soul rise, for the Lamb comes to forgive freely, and the faithful pray that when he shines forth a second time he may shield and not punish them. It echoes the Epistle and Gospel of the first Sunday of Advent (Romans 13:11-14; Luke 21:25-33). The English is the translation of Edward Caswall (1814-1878) with its first line altered, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["advent", "lauds", "morning"],
      relatedSaints: [],
      citations: [`${BRITT}99/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-deus-ego-amo-te",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}172/mode/1up`, `${BRITT}173/mode/1up`],
    payload: {
      slug: "o-deus-ego-amo-te",
      title: "O Deus, ego amo te (My God, I love Thee, not because)",
      body: "My God, I love Thee, not because\nI hope for heaven thereby;\nNor yet since they who love Thee not\nMust burn eternally.\n\nThou, O my Jesus, Thou didst me\nUpon the Cross embrace;\nFor me didst bear the nails and spear,\nAnd manifold disgrace;\n\nAnd griefs and torments numberless,\nAnd sweat of agony;\nE'en death itself; and all for one\nWho was Thine enemy.\n\nThen why, O blessèd Jesus Christ,\nShould I not love Thee well,\nNot for the sake of winning heaven,\nOr of escaping hell;\n\nNot with the hope of gaining aught,\nNot seeking a reward;\nBut as Thyself hast lovèd me,\nO ever-loving Lord?\n\nE'en so I love Thee, and will love,\nAnd in Thy praise will sing,\nSolely because Thou art my God,\nAnd my eternal King.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "O Deus, ego amo te,\nNec amo te, ut salves me,\nAut quia non amantes te\nÆterno punis igne.\n\nTu, tu, mi Jesu, totum me\nAmplexus es in cruce;\nTulisti clavos, lanceam,\nMultamque ignominiam,\n\nInnumeros dolores,\nSudores, et angores,\nEt mortem, et hæc propter me,\nAc pro me peccatore.\n\nCur igitur non amem te,\nO Jesu amantissime,\nNon, ut in cœlo salves me,\nAut ne æternum damnes me,\n\nNec præmii ullius spe,\nSed sicut tu amasti me?\nSic amo et amabo te,\nSolum quia Rex meus es,\nEt solum quia Deus es.",
      summary:
        "A Latin hymn of pure love of God traditionally ascribed to Saint Francis Xavier (1506-1552), whose original was probably a Spanish or Portuguese sonnet written in the Indies about 1546; the author of this Latin version is unknown. It loves God not for hope of heaven nor for fear of hell, but because he embraced the sinner on the Cross and because he is God and King. It belongs to neither the Breviary nor the Missal. The English, which runs to six stanzas against the five of the Latin, is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["act-of-love", "adoration", "passion"],
      relatedSaints: ["saint-francis-xavier"],
      citations: [`${BRITT}172/mode/1up`, `${BRITT}173/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "en-ut-superba-criminum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}196/mode/1up`, `${BRITT}197/mode/1up`],
    payload: {
      slug: "en-ut-superba-criminum",
      title: "En ut superba criminum (Lo, how the savage crew)",
      body: "Lo, how the savage crew\nOf our proud sins hath rent\nThe Heart of our all-gracious God,\nThat Heart so innocent.\n\nThe soldier's quivering lance\nOur guilt it was that drave,\nOur wicked deeds that to its point\nSuch cruel sharpness gave.\n\nO wounded Heart, whence sprang\nThe Church, the Saviour's bride;\nThou Door of our Salvation's Ark\nSet in its mystic side.\n\nThou holy fount, whence flows\nThe sacred sevenfold flood,\nWhere we our filthy robes may cleanse\nIn the Lamb's saving Blood:\n\nBy sorrowful relapse,\nThee will we rend no more;\nBut like the flames, those types of love,\nStrive heavenward to soar.\n\nFather and Son supreme\nAnd Spirit, hear our cry;\nWhose is the kingdom, praise and power,\nThrough all eternity.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "En ut superba criminum\nEt sæva nostrorum cohors\nCor sauciavit innocens\nMerentis haud tale Dei!\n\nVibrantis hastam militis\nPeccata nostra dirigunt:\nFerrumque diræ cuspidis\nMortale crimen acuit.\n\nEx corde scisso Ecclesia\nChristo jugata nascitur:\nHoc ostium Arcæ in latere est:\nGenti ad salutem positum.\n\nEx hoc perennis gratia,\nCeu septiformis fluvius;\nStolas ut illic sordidas\nLavemus Agni in sanguine.\n\nTurpe est redire ad crimina,\nQuæ Cor beatum lacerent:\nSed æmulemur cordibus\nFlammas amoris indices.\n\nHoc, Christe, nobis, hoc, Pater,\nHoc sancte, dona, Spiritus,\nQuibus potestas, gloria\nRegnumque in omne est sæculum.",
      summary:
        "The Matins hymn of the feast of the Sacred Heart in the Roman Breviary, by an unknown author of the eighteenth century: the proud and savage host of our sins wounded the innocent Heart of God and sharpened the soldier's lance, yet from that opened side, the door of the Ark of salvation, the Church is born as Christ's bride and grace flows out like a sevenfold river in which to wash our robes in the blood of the Lamb. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["feast-of-the-sacred-heart", "june", "office-of-readings", "sacred-heart"],
      relatedSaints: [],
      citations: [`${BRITT}196/mode/1up`, `${BRITT}197/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "cor-arca-legem-continens",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}198/mode/1up`],
    payload: {
      slug: "cor-arca-legem-continens",
      title: "Cor, arca legem continens (Jesus, behind Thy Temple's veil)",
      body: "Jesus, behind Thy Temple's veil,\nHid in an ark of gold,\nOn stones engraven, lay the Law\nThy finger wrote of old.\n\nBut in Thy Body's temple new,\nThy life-blood's throbbing shrine,\nHeld, upon fleshly tables graved,\nThe law of Love Divine.\n\nAnd when that Heart in death was stilled,\nEach temple's veil was riven:\nAnd lo, within Thy Love's red shrine,\nTo us to look was given.\n\nThere make us gaze and see the love\nWhich drew Thee, for our sake,\nO great High-priest, Thyself to God\nA sacrifice to make.\n\nThou, Saviour, cause that every soul\nWhich Thou hast loved so well,\nMay will within Thine open Heart\nIn life and death to dwell.\n\nGrant it, O Father, only Son,\nAnd Spirit, God of grace,\nTo whom all worship shall be done,\nIn every time and place.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "Cor, arca legem continens\nNon servitutis veteris,\nSed gratiæ, sed veniæ,\nSed et misericordiæ.\n\nCor, Sanctuarium novi\nIntemeratum fœderis,\nTemplum vetusto sanctius,\nVelumque scisso utilius.\n\nTe vulneratum caritas\nIctu patenti voluit;\nAmoris invisibilis\nUt veneremur vulnera.\n\nHoc sub amoris symbolo\nPassus cruenta, et mystica,\nUtrumque sacrificium\nChristus Sacerdos obtulit.\n\nQuis non amantem redamet?\nQuis non redemptus diligat,\nEt Corde in isto seligat\nÆterna tabernacula?\n\nDecus Parenti et Filio,\nSanctoque sit Spiritui,\nQuibus potestas, gloria\nRegnumque in omne est sæculum.",
      summary:
        "The Lauds hymn of the feast of the Sacred Heart in the Roman Breviary, by an unknown author of the eighteenth century: the Heart of Christ is the ark that holds the law not of the old bondage but of grace, pardon and mercy, the sanctuary of the new covenant, holier than the old Temple, which love willed to be wounded so that we might venerate the wounds of an unseen love. The English is from the Marquess of Bute's translation of the Roman Breviary (1879), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["feast-of-the-sacred-heart", "june", "lauds", "sacred-heart"],
      relatedSaints: [],
      citations: [`${BRITT}198/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "quicumque-certum-quaeritis",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}199/mode/1up`, `${BRITT}200/mode/1up`],
    payload: {
      slug: "quicumque-certum-quaeritis",
      title: "Quicumque certum quaeritis (All ye who seek a comfort sure)",
      body: 'All ye who seek a comfort sure\nIn trouble and distress,\nWhatever sorrow vex the mind,\nOr guilt the soul oppress:\n\nJesus, who gave Himself for you\nUpon the Cross to die,\nOpens to you His sacred Heart;\nO to that Heart draw nigh.\n\nYe hear how kindly he invites;\nYe hear His words so blest:\n"All ye that labor come to Me,\nAnd I will give you rest."\n\nWhat meeker than the Saviour\'s Heart?\nAs on the Cross He lay,\nIt did His murderers forgive,\nAnd for their pardon pray.\n\nO Heart, Thou joy of Saints on high,\nThou hope of sinners here,\nAttracted by those loving words\nTo Thee I lift my prayer.\n\nWash thou my wounds in that dear Blood,\nWhich forth from Thee doth flow;\nNew grace, new hope inspire, a new\nAnd better heart bestow.',
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "Quicumque certum quæritis\nRebus levamen asperis:\nSeu culpa mordet anxia,\nSeu pœna vos premit comes.\n\nJesu, qui, ut agnus innocens,\nSese immolandum tradidit,\nAd cor reclusum vulnere,\nAd mite cor accedite.\n\nAuditis ut suavissimis\nInvitet omnes vocibus:\nVenite quos gravat labor\nPremitque pondus criminum:\n\nQuid Corde Jesu mitius?\nJesum cruci qui affixerant\nExcusat, et Patrem rogat\nNe perdat ultor impios.\n\nO Cor, voluptas Cœlitum,\nCor, fida spes mortalium,\nEn hisce tracti vocibus,\nAd te venimus supplices.\n\nTu nostra terge vulnera\nEx te fluente sanguine\nTu da novum cor omnibus\nQui te gementes invocant.",
      summary:
        "A hymn by an unknown eighteenth-century author for Vespers and Matins in an Office of the Sacred Heart granted by special concession, which Britt notes is not in the latest edition of the Breviary: all who seek sure relief in hardship, whether guilt or its punishment weighs on them, are bidden to the meek Heart of Jesus, opened by the lance, which forgave those who crucified him and calls the heavy-laden to rest. The English is the translation of Edward Caswall (1814-1878), long a favourite of hymn-book compilers, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["sacred-heart", "vespers", "office-of-readings", "trust", "suffering"],
      relatedSaints: [],
      citations: [`${BRITT}199/mode/1up`, `${BRITT}200/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "summi-parentis-filio",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}201/mode/1up`, `${BRITT}202/mode/1up`],
    payload: {
      slug: "summi-parentis-filio",
      title: "Summi Parentis Filio (O Thou, the Son of God most High)",
      body: "O Thou, the Son of God most High,\nThou Father of the life to be,\nO Prince of Peace, to Thee we cry,\nWe bring our song of praise to Thee.\n\nThy Heart was wounded by the blow\nOrdained of everlasting love;\nSuch love among Thy flocks below\nThou kindlest at the fires above.\n\nDear Christ in pity for our woe\nThou didst Thyself as victim give,\nThe cruel pangs to undergo,\nTo ope Thy breast that man might live.\n\nO sacred fount of love sublime,\nO living spring of waters free,\nO fire to cleanse away all crime,\nO Heart aflame with charity.\n\nLord, keep us ever in Thy Heart,\nThy tender love to feel and know,\nThe joys of heaven to us impart,\nWhen we shall leave these walks below.\n\nGlory to Father and to Son,\nAnd to the Holy Ghost the same,\nTo whom all power, when time is done,\nAnd endless rule, in endless fame.",
      prayerType: "hymn",
      category: "devotional",
      language: "en",
      latin:
        "Summi Parentis Filio,\nPatri futuri sæculi,\nPacis beatæ Principi,\nPromamus ore canticum.\n\nQui vulneratus pectore\nAmoris ictum pertulit,\nAmoris urens ignibus\nIpsum qui amantem diligunt.\n\nJesu, doloris victima,\nQuis te innocentem compulit,\nDura ut apertum lancea\nLatus pateret vulneri?\n\nO fons amoris inclyte!\nO vena aquarum limpida,\nO flamma adurens crimina!\nO cordis ardens caritas!\n\nIn Corde, Jesu, jugiter\nReconde nos, ut uberi\nDono fruamur gratiæ,\nCœlique tandem præmiis.\n\nSemper Parenti, et Filio,\nSit laus, honor, sit gloria,\nSancto simul Paraclito\nIn sæculorum sæcula.",
      summary:
        "A hymn by an unknown eighteenth-century author for Lauds in an Office of the Sacred Heart granted by special concession, which Britt notes is not in the latest edition of the Breviary: it sings of the Son of the most high Father, the Father of the world to come and the Prince of peace (Isaias 9:6), whose Heart, wounded by love, is a glorious fount of love, a clear spring of living water and a flame that burns away sin. The English is the translation of Daniel Joseph Donahoe (1853-1930), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["sacred-heart", "lauds", "morning"],
      relatedSaints: [],
      citations: [`${BRITT}201/mode/1up`, `${BRITT}202/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "dies-irae",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [
      `${BRITT}202/mode/1up`,
      `${BRITT}203/mode/1up`,
      `${BRITT}204/mode/1up`,
      `${BRITT}205/mode/1up`,
    ],
    payload: {
      slug: "dies-irae",
      title: "Dies irae, dies illa (That day of wrath, that dreadful day)",
      body: "That day of wrath, that dreadful day,\nWhen heaven and earth shall pass away,\nBoth David and the Sibyl say.\n\nWhat terror then shall us befall,\nWhen lo, the Judge's steps appall,\nAbout to sift the deeds of all.\n\nThe mighty trumpet's marvellous tone\nShall pierce through each sepulchral stone\nAnd summon all before the throne.\n\nNow Death and Nature in amaze\nBehold the Lord His creatures raise,\nTo meet the Judge's awful gaze.\n\nThe books are opened, that the dead\nMay have their doom from what is read,\nThe record of our conscience dread.\n\nThe Lord of judgment sits Him down,\nAnd every secret thing makes known;\nNo crime escapes His vengeful frown.\n\nAh, how shall I that day endure?\nWhat patron's friendly voice secure,\nWhen scarce the just themselves are sure?\n\nO King of dreadful majesty,\nWho grantest grace and mercy free,\nGrant mercy now and grace to me.\n\nGood Lord, 'twas for my sinful sake,\nThat Thou our suffering flesh didst take;\nThen do not now my soul forsake.\n\nIn weariness Thy sheep was sought;\nUpon the Cross His life was bought;\nAlas, if all in vain were wrought.\n\nO just avenging Judge, I pray,\nFor pity take my sins away,\nBefore the great accounting-day.\n\nI groan beneath the guilt, which Thou\nCanst read upon my blushing brow;\nBut spare, O God, Thy suppliant now.\n\nThou who didst Mary's sins unbind,\nAnd mercy for the robber find,\nDost fill with hope my anxious mind.\n\nMy feeble prayers can make no claim,\nYet, gracious Lord, for Thy great Name,\nRedeem me from the quenchless flame.\n\nAt Thy right hand, give me a place\nAmong Thy sheep, a child of grace,\nFar from the goats' accursed race.\n\nYea, when Thy justly kindled ire\nShall sinners hurl to endless fire,\nOh, call me to Thy chosen choir.\n\nIn suppliant prayer I prostrate bend,\nMy contrite heart like ashes rend,\nRegard, O Lord, my latter end.\n\nOh, on that day, that tearful day,\nWhen man to judgment wakes from clay,\nBe thou the trembling sinner's stay,\nAnd spare him, God, we humbly pray.\nYea, grant to all, O Saviour Blest,\nWho die in Thee, the Saints' sweet rest.",
      prayerType: "hymn",
      category: "liturgical",
      language: "en",
      latin:
        "Dies iræ, dies illa,\nSolvet sæclum in favilla:\nTeste David cum Sibylla.\n\nQuantus tremor est futurus,\nQuando Judex est venturus,\nCuncta stricte discussurus!\n\nTuba mirum spargens sonum\nPer sepulchra regionum,\nCoget omnes ante thronum.\n\nMors stupebit, et natura,\nCum resurget creatura,\nJudicanti responsura.\n\nLiber scriptus proferetur,\nIn quo totum continetur,\nUnde mundus judicetur.\n\nJudex ergo cum sedebit,\nQuidquid latet, apparebit:\nNil inultum remanebit.\n\nQuid sum, miser, tunc dicturus?\nQuem patronum rogaturus?\nCum vix justus sit securus?\n\nRex tremendæ majestatis,\nQui salvandos salvas gratis,\nSalva me, fons pietatis.\n\nRecordare, Jesu pie,\nQuod sum causa tuæ viæ:\nNe me perdas illa die.\n\nQuærens me, sedisti lassus:\nRedemisti crucem passus:\nTantus labor non sit cassus.\n\nJuste judex ultionis,\nDonum fac remissionis\nAnte diem rationis.\n\nIngemisco tamquam reus:\nCulpa rubet vultus meus:\nSupplicanti parce, Deus.\n\nQui Mariam absolvisti,\nEt latronem exaudisti,\nMihi quoque spem dedisti.\n\nPreces meæ non sunt dignæ:\nSed tu bonus fac benigne,\nNe perenni cremer igne.\n\nInter oves locum præsta,\nEt ab hœdis me sequestra,\nStatuens in parte dextra.\n\nConfutatis maledictis,\nFlammis acribus addictis:\nVoca me cum benedictis.\n\nOro supplex et acclinis,\nCor contritum quasi cinis:\nGere curam mei finis.\n\nLacrimosa dies illa,\nQua resurget ex favilla,\nJudicandus homo reus.\nHuic ergo parce, Deus:\nPie Jesu, Domine,\nDona eis requiem.",
      summary:
        "The sequence of the Requiem Mass, a thirteenth-century poem ascribed to Thomas of Celano: the day of wrath will dissolve the world in ashes, the trumpet will summon all before the throne and the written book will be opened, and the sinner pleads with the Jesus who sought him to the point of weariness and redeemed him on the Cross to set him among the sheep at his right hand. Britt notes that it was probably composed as a sequence for the first Sunday of Advent. The English is a cento, stanzas 1-5, 10, 14, 17 and 18 by W. F. Wingfield and the rest by Father Aylward, O.P., as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["all-souls", "funerals", "mass", "november"],
      relatedSaints: [],
      citations: [
        `${BRITT}202/mode/1up`,
        `${BRITT}203/mode/1up`,
        `${BRITT}204/mode/1up`,
        `${BRITT}205/mode/1up`,
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "praeclara-custos-virginum",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}217/mode/1up`, `${BRITT}218/mode/1up`],
    payload: {
      slug: "praeclara-custos-virginum",
      title: "Praeclara custos virginum (Blest guardian of all virgin souls)",
      body: "Blest guardian of all virgin souls,\nPortal of bliss to man forgiven,\nPure Mother of Almighty God,\nThou hope of earth and joy of heaven!\n\nFair Lily found among the thorns,\nMost beauteous Dove with wings of gold,\nRod from whose tender root upsprang\nThat healing Flower so long foretold.\n\nThou Tower against the dragon proof,\nThou Star to storm-tossed voyagers dear;\nOur course lies o'er a treacherous deep,\nThine be the light by which we steer.\n\nScatter the mists that round us hang;\nKeep far the fatal shoals away;\nAnd while through darkling waves we sweep,\nOpen a path to light and day.\n\nO Jesu, born of Virgin bright,\nImmortal glory be to Thee;\nPraise to the Father infinite\nAnd Holy Ghost eternally.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Præclara custos virginum,\nIntacta Mater Numinis,\nCœlestis aulæ janua,\nSpes nostra, cœli gaudium.\n\nInter rubeta lilium,\nColumba formosissima,\nVirga e radice germinans\nNostro medelam vulneri.\n\nTurris draconi impervia,\nAmica stella naufragis,\nTuere nos a fraudibus,\nTuaque luce dirige.\n\nErroris umbras discute,\nSyrtes dolosas amove,\nFluctus tot inter, deviis\nTutam reclude semitam.\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre, et almo Spiritu,\nIn sempiterna sæcula.",
      summary:
        "A hymn by an unknown seventeenth-century author, first found in the Office of the Purity of the Blessed Virgin authorized by Pope Benedict XIV in 1751, and sung at Matins on the feast of the Immaculate Conception in the Roman Breviary: Mary is hailed as guardian of virgins, gate of heaven, lily among thorns, rod of Jesse, tower the dragon cannot take and star of the shipwrecked, and is asked to scatter the mists of error and open a safe path through the waves. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["december-8", "immaculate-conception", "office-of-readings", "marian-feasts"],
      relatedSaints: [],
      citations: [`${BRITT}217/mode/1up`, `${BRITT}218/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "quodcumque-in-orbe",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}219/mode/1up`, `${BRITT}220/mode/1up`],
    payload: {
      slug: "quodcumque-in-orbe",
      title: "Quodcumque in orbe (Peter, whatever thou shalt bind on earth)",
      body: "Peter, whatever thou shalt bind on earth,\nThe same is bound above the starry sky;\nWhat here thy delegated power doth loose,\nIs loosed in heaven's supremest Court on high:\nTo judgment shalt thou come, when the world's end is nigh.\n\nPraise to the Father, through all ages be;\nPraise to the consubstantial sovereign Son,\nAnd Holy Ghost, One glorious Trinity;\nTo whom all majesty and might belong;\nSo sing we now, and such be our eternal song.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Quodcumque in orbe nexibus revinxeris,\nErit revinctum Petre in arce siderum:\nEt quod resolvit hic potestas tradita,\nErit solutum cœli in alto vertice:\nIn fine mundi judicabis sæculum.\n\nPatri perenne sit per ævum gloria,\nTibique laudes concinamus inclytas,\nÆterne Nate, sit superne Spiritus\nHonor tibi, decusque: sancta jugiter\nLaudetur omne Trinitas per sæculum.",
      summary:
        "The hymn for Vespers and Matins on the feasts of Saint Peter's Chair at Rome (18 January) and at Antioch (22 February) in the Roman Breviary, the revised form of part of a longer hymn ascribed to Saint Paulinus, Patriarch of Aquileia (726-802): it puts into verse Christ's promise that whatever Peter binds or looses on earth is bound or loosed in heaven (Matthew 16:19), and adds that he will sit in judgment at the end of the world. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["january", "february", "vespers", "office-of-readings", "for-the-church"],
      relatedSaints: ["saint-peter"],
      citations: [`${BRITT}219/mode/1up`, `${BRITT}220/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "beate-pastor-petre",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}220/mode/1up`, `${BRITT}221/mode/1up`],
    payload: {
      slug: "beate-pastor-petre",
      title: "Beate Pastor Petre (O Peter, Shepherd good, our voices sing of thee)",
      body: "O Peter, Shepherd good, our voices sing of thee;\nThy very word had might from chains of sin to free;\nTo thee, by power divine, the mystic keys were given,\nWhich ope the skies to men, or close the gates of heaven.\n\nAll honor, might, and power, and hymns of joy we bring,\nWhile to the Trinity eternal praise we sing:\nHe rules the universe in wondrous Unity,\nAnd shall, throughout the days of all eternity.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Beate Pastor Petre, clemens accipe\nVoces precantum, criminumque vincula\nVerbo resolve, cui potestas tradita\nAperire terris cœlum, apertum claudere.\n\nSit Trinitati sempiterna gloria,\nHonor, potestas, atque jubilatio,\nIn unitate, quæ gubernat omnia,\nPer universa æternitatis sæcula.",
      summary:
        "The hymn for Lauds on the feasts of Saint Peter's Chair at Rome (18 January) and at Antioch (22 February) in the Roman Breviary: the first stanza of the Lauds hymn of Saints Peter and Paul, ascribed to Elpis, by tradition the wife of the philosopher Boethius, followed by its doxology. Peter, the good shepherd, is asked to hear his suppliants and loose the chains of their sins by his word, since to him was given the power to open heaven and to shut it. The English is the translation of T. I. Ball, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["january", "february", "lauds", "morning", "for-the-church"],
      relatedSaints: ["saint-peter"],
      citations: [`${BRITT}220/mode/1up`, `${BRITT}221/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "egregie-doctor-paule",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}221/mode/1up`],
    payload: {
      slug: "egregie-doctor-paule",
      title: "Egregie Doctor Paule (Our souls' great Teacher, Paul)",
      body: "Our souls' great Teacher, Paul, our guide in wisdom's ways,\nTeach us, our fainting hearts, to heaven's glad clime to raise,\nTill Faith in clearest light her bright meridian gains,\nAnd Love with sun-like fire within each bosom reigns.\n\nAll honor, might, and power, and hymns of joy we bring,\nWhile to the Trinity eternal praise we sing;\nHe rules the universe in wondrous Unity,\nAnd shall, throughout the days of all eternity.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Egregie Doctor Paule mores instrue,\nEt nostra tecum pectora in cœlum trahe:\nVelata dum meridiem cernat fides,\nEt solis instar sola regnet caritas.\n\nSit Trinitati sempiterna gloria,\nHonor, potestas, atque jubilatio,\nIn unitate, quæ gubernat omnia,\nPer universa æternitatis sæcula.",
      summary:
        "The hymn for Vespers and Matins on the feast of the Conversion of Saint Paul (25 January) in the Roman Breviary: the second stanza of the Lauds hymn of Saints Peter and Paul, ascribed to Elpis, followed by its doxology. Paul, the great teacher, is asked to form our ways and draw our hearts with him to heaven, until veiled faith sees the full noon and charity alone reigns like the sun. The English is the translation of Father Thomas Joseph Potter (1828-1873), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["january", "conversion", "vespers", "office-of-readings"],
      relatedSaints: ["saint-paul"],
      citations: [`${BRITT}221/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "martinae-celebri",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}222/mode/1up`, `${BRITT}223/mode/1up`],
    payload: {
      slug: "martinae-celebri",
      title: "Martinae celebri (With joyous songs, great Rome, Martina's fame extol)",
      body: "With joyous songs, great Rome, Martina's fame extol,\nHer glowing praises tell, and all her mighty deeds;\nA Virgin pure and chaste, she leads a stainless life,\nAnd for her Lord a Martyr bleeds.\n\nA happy home is hers, and all that makes this world\nSo sweet, and fresh, and fair, to those who love its wiles:\nFrom noblest parents sprung, 'mid wealth, and love, and joy,\nHer life speeds on, 'mid naught but smiles.\n\nThese pleasures soon she spurns—her wealth she gladly gives\nTo Christ's own blessed poor—herself, to God above;\nNo other wealth she seeks save her own spotless Spouse,\nForever blest in His pure love.\n\nO Thou, the Martyrs' strength, all cheating joys expel,\nAnd fill us with Thy bright and never-fading love;\nShow us the beam divine, which forms the crowning joy,\nGod, Three in One, of bliss above.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Martinæ celebri plaudite nomini\nCives Romulei, plaudite gloriæ:\nInsignem meritis dicite Virginem,\nChristi dicite Martyrem.\n\nHæc dum conspicuis orta parentibus\nInter delicias, inter amabiles\nLuxus illecebras ditibus affluit\nFaustæ muneribus domus.\n\nVitæ despiciens commoda, dedicat\nSe rerum Domino, et munifica manu\nChristi pauperibus distribuens opes,\nQuærit præmia cœlitum.\n\nA nobis abigas lubrica gaudia\nTu, qui Martyribus dexter ades, Deus\nUne et trine: tuis da famulis jubar,\nQuo clemens animos beas.",
      summary:
        "The Vespers hymn for the feast of Saint Martina, a virgin martyr of Rome, from the hymn of nine stanzas that Pope Urban VIII (1568-1644) wrote in her honour and divided among Vespers, Matins and Lauds, each part closing with the same doxology: the citizens of Rome are bidden to praise Martina, born of noble parents amid wealth and pleasure, who gave her riches to Christ's poor and dedicated herself to the Lord. The English is the translation of Father Thomas Joseph Potter (1828-1873), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["january", "vespers", "martyrs", "virgins"],
      relatedSaints: [],
      citations: [`${BRITT}222/mode/1up`, `${BRITT}223/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "non-illam-crucians",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}223/mode/1up`, `${BRITT}224/mode/1up`],
    payload: {
      slug: "non-illam-crucians",
      title: "Non illam crucians (The agonizing hooks, the rending scourge)",
      body: "The agonizing hooks, the rending scourge,\nShook not the dauntless spirit in her breast;\nWith torments racked, Angels her fainting flesh\nRecruit with heavenly feast.\n\nIn vain they cast her to the ravening beasts;\nCalm at her feet the lion crouches down:\nTill smitten by the sword at length she goes\nTo her immortal crown.\n\nNow with the Saints Martina reigns in bliss,\nAnd where Idolatry sat throned of yore,\nFrom her victorious altar praise and prayer\nWith odorous incense soar.\n\nExpel false worldly joys; and fill us, Lord,\nWith Thy irradiating beam divine;\nWho with Thy suffering Martyrs present art,\nGreat Godhead one and trine.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Non illam crucians ungula, non feræ,\nNon virgæ horribili vulnere commovent;\nHinc lapsi e Superum sedibus Angeli\nCœlesti dape recreant.\n\nQuin et deposita sævitie leo\nSe rictu placido projicit ad pedes:\nTe Martina tamen dans gladius neci\nCœli cœtibus inserit.\n\nTe, thuris redolens ara vaporibus,\nQuæ fumat, precibus jugiter invocat,\nEt falsum perimens auspicium, tui\nDelet nominis omine.\n\nA nobis abigas lubrica gaudia,\nTu, qui Martyribus dexter ades, Deus\nUne et Trine: tuis da famulis jubar,\nQuo clemens animos beas.",
      summary:
        "The Matins hymn for the feast of Saint Martina, the second part of Pope Urban VIII's hymn in her honour: neither hooks, beasts nor rods could shake her, angels came down to strengthen her with heavenly food and a lion lay down at her feet, until the sword sent her to join the hosts of heaven; now her altar sends up incense and prayer where false worship once stood. The English is the translation of Edward Caswall (1814-1878), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["january", "office-of-readings", "martyrs", "virgins"],
      relatedSaints: [],
      citations: [`${BRITT}223/mode/1up`, `${BRITT}224/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "te-dicimus-praeconio",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}232/mode/1up`, `${BRITT}233/mode/1up`],
    payload: {
      slug: "te-dicimus-praeconio",
      title: "Te dicimus praeconio (O Virgin Mother of our God)",
      body: "O Virgin Mother of our God,\nWhile we thy matchless glories chant,\nDo thou, in answer to our praise,\nTo us abundant graces grant.\n\nWe Adam's guilty children are,\nA sin-infected progeny,\nThou art, O Virgin, we believe,\nAlone from his infection free.\n\nThe envious dragon's cruel head\nThou with thy heel dost trample down,\nAnd of a stainless origin\nThou only dost the glory own.\n\nO Flower of the human race,\nWho takest Eve's reproach away,\nProtect us when we cry to thee,\nOur tottering footsteps deign to stay.\n\nFrom the old serpent's wiles and force,\nThy clients mightily defend,\nThat, through thy mercy, they may win\nThose heavenly joys which never end.\n\nJesus, to Thee be glory given,\nWhom erst the Virgin-Mother bore,\nWith Father and with Holy Ghost,\nThrough endless ages evermore.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Te dicimus præconio,\nIntacta Mater Numinis,\nNostris benigna laudibus\nTuam repende gratiam.\n\nSontes Adami posteri\nInfecta proles gignimur;\nLabis paternæ nescia\nTu sola, Virgo, crederis.\n\nCaput draconis invidi\nTu conteris vestigio,\nEt sola gloriam refers\nIntaminatæ originis.\n\nO gentis humanæ decus\nQuæ tollis Hevæ opprobrium,\nTu nos tuere supplices,\nTu nos labantes erige.\n\nSerpentis antiqui potens\nAstus retunde et impetus,\nUt cœlitum perennibus\nPer te fruamur gaudiis.\n\nJesu, tibi sit gloria\nQui natus es de Virgine,\nCum Patre, et almo Spiritu\nIn sempiterna sæcula.",
      summary:
        "The Matins hymn of the feast of the Apparition of the Blessed Virgin Mary Immaculate at Lourdes (11 February), whose office was authorized under Pope Leo XIII and extended to the whole Church by Pope Pius X in 1907; its author is unknown. Of all Adam's guilty children Mary alone is believed free of the inherited stain; she crushes the dragon's head and takes away the reproach of Eve, and is asked to defend her clients against the wiles of the old serpent. The English is the translation of Archbishop Edward Gilpin Bagshawe (1829-1915), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["february-11", "marian-feasts", "office-of-readings", "immaculate-conception"],
      relatedSaints: [],
      citations: [`${BRITT}232/mode/1up`, `${BRITT}233/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "aurora-soli-praevia",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}234/mode/1up`, `${BRITT}235/mode/1up`],
    payload: {
      slug: "aurora-soli-praevia",
      title: "Aurora soli praevia (O rosy dawn! that dost proclaim)",
      body: "O rosy dawn! that dost proclaim\nSalvation's happy day,\nTo thee, O Virgin, 'mid night's shades,\nThy people humbly pray.\n\nThe torrent, that engulfs all those\nWithin its whirlpool drawn,\nRests calm as o'er its softened wave\nThe ark of God is borne.\n\nWhile earth is parched with scorching heat,\nAlone thou art bedewed;\nWith dew o'erspread the earth around,\nAnd thou untouched art viewed.\n\nThe serpent rears his head aloft\nDisgorging poisoned spleen;\nBut thou his proud, inflated head\nDost crush with power as Queen.\n\nO loving Mother, hear our prayer,\nAs suppliant we cry;\nProtect us in our strife with hell\nWho dost its power defy.\n\nO Jesu, born of Virgin bright,\nAll glory be to Thee,\nWith Father and with Paraclete,\nThrough all eternity.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Aurora soli prævia\nFelix salutis nuntia,\nIn noctis umbra plebs tua\nTe, Virgo, supplex invocat.\n\nTorrens nefastis fluctibus\nCunctos trahens voragine,\nLeni residit æquore\nCum transit Arca fœderis.\n\nDum torret arescens humus,\nTu rore sola spargeris;\nTellure circum rorida,\nIntacta sola permanes.\n\nFatale virus evomens\nAttollit anguis verticem;\nAt tu draconis turgidum\nInvicta conteris caput.\n\nMater benigna, respice\nFletus precesque supplicum,\nEt dimicantes tartari\nVictrix tuere ab hostibus.\n\nJesu, tibi sit gloria,\nQui natus es de Virgine,\nCum Patre, et almo Spiritu,\nIn sempiterna sæcula.",
      summary:
        "The Lauds hymn of the feast of Our Lady of Lourdes (11 February), by an unknown author: Mary is the dawn that goes before the sun, the ark of the covenant before which the flood grows calm, and Gideon's fleece, alone bedewed while the earth is parched and alone dry when the ground is wet (Judges 6), and she crushes the serpent's head; her people ask her to protect them in their struggle with the powers of hell. The English is the translation of the Benedictines of Stanbrook, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["february-11", "marian-feasts", "lauds", "morning"],
      relatedSaints: [],
      citations: [`${BRITT}234/mode/1up`, `${BRITT}235/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "omnis-expertem",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}235/mode/1up`, `${BRITT}236/mode/1up`],
    payload: {
      slug: "omnis-expertem",
      title: "Omnis expertem (Lo! Mary is exempt from stain of sin)",
      body: "Lo! Mary is exempt from stain of sin,\nProclaims the Pontiff high;\nAnd earth applauding celebrates with joy\nHer triumph, far and high.\n\nUnto a lowly timid maid she shows\nHer form in beauty fair,\nAnd the Immaculate Conception truth\nHer sacred lips declare.\n\nO honored cave, by Mary's smile adorned!\nO hallowed rock, whence spring\nThe living waters of a gushing stream,\nThe gifts of life to bring.\n\nAnd thither from the farmost bounds of earth\nThe pilgrims wend their way,\nAnd suppliant around the Virgin's shrine\nHer powerful help they pray.\n\nThe sufferers' cry the Mother fondly hears,\nAnd grants the longed-for grace;\nAnd health restored, the pilgrim throng returns\nUnto its native place.\n\nO Virgin! have compassion on our needs,\nRefresh us laboring on;\nObtain for us the joys of heavenly life,\nWhen sorrow all is gone.\n\nAll praise and honor to the Father be,\nAnd to His only Son,\nAnd to the Spirit, power of both, for aye,\nIn Godhead ever One.",
      prayerType: "hymn",
      category: "marian",
      language: "en",
      latin:
        "Omnis expertem maculæ Mariam\nEdocet summus fidei magister;\nVirginis gaudens celebrat fidelis\nTerra triumphum.\n\nIpsa se præbens humili puellæ\nVirgo spectandam, recreat paventem,\nSeque conceptam sine labe sancto\nPrædicat ore.\n\nO specus felix, decorate divæ\nMatris aspectu! veneranda rupes,\nUnde vitales scatuere pleno\nGurgite lymphæ.\n\nHuc catervatim pia turba nostris,\nHuc ab externis peregrina terris\nAffluit supplex, et opem potentis\nVirginis orat.\n\nExcipit Mater lacrimas precantum,\nDonat optatam miseris salutem;\nCompos hinc voti patrias ad oras\nTurba revertit.\n\nSupplicum, Virgo, miserata casus,\nSemper o nostros refove labores,\nImpetrans mœstis bona sempiternæ\nGaudia vitæ.\n\nSit decus Patri, genitæque Proli,\nEt tibi compar utriusque virtus\nSpiritus semper, Deus unus, omni\nTemporis ævo.",
      summary:
        "The hymn for Second Vespers of the feast of Our Lady of Lourdes (11 February), by an unknown author: the supreme teacher of the faith has declared Mary free of every stain, and she showed herself to a humble girl, Saint Bernadette, and named herself conceived without sin; pilgrims come from every land to the grotto and its spring, and the crowds go home with their prayers answered. The English is the translation of the Benedictines of Stanbrook, as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["february-11", "marian-feasts", "vespers", "pilgrimage", "healing"],
      relatedSaints: ["saint-bernadette-soubirous"],
      citations: [`${BRITT}235/mode/1up`, `${BRITT}236/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "bella-dum-late",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}237/mode/1up`, `${BRITT}238/mode/1up`, `${BRITT}239/mode/1up`],
    payload: {
      slug: "bella-dum-late",
      title: "Bella dum late (When war was raging, and the town)",
      body: "When war was raging, and the town\nWas red with blood of brother bands,\nOur Virgin-Mother bowed her down\nWith bounteous hands.\n\nSeven faithful sons she bid to share\nHer Dolours, all the shame and loss\nWhich Jesus suffered, and she bare\nBeneath His Cross.\n\nSo when their Lady called, as naught\nThey deemed their palaces and wealth,\nThe mountain's desert places sought\nFar off by stealth.\n\nFor others' sins the scourge they plied,\nAs they the way of penance trod;\nBy prayers and tears they turned aside\nThe wrath of God.\n\nToken of love, the Mother's hand\nGave to her sons their garb of woe;\nSanctioned the pious work they planned,\nWith wondrous show.\n\nThe vine, to spread their honors wide,\nHer sprouts in winter greenly flung,\n\"See, those are Mary's servants,\" cried\nThe infant tongue.\n\nNow to the Father thanks and praise;\nTo Thee, O Son, the same we send;\nTo Thee, great Spirit, through all days\nWorld without end.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Bella dum late furerent, et urbes\nCæde fraterna gemerent cruentæ,\nAdfuit Virgo, nova semper edens\nMunera matris.\n\nEn vocat septem famulos, fideles\nUt sibi in luctu recolant dolores,\nQuos tulit Jesus, tulit ipsa consors\nSub cruce Nati.\n\nIllico parent Dominæ vocanti:\nSplendidis tectis opibusque spretis,\nUrbe secedunt procul in Senari\nAbdita montis.\n\nCorpora hic pœnis cruciant acerbis,\nSontium labes hominum piantes:\nHic prece avertunt lacrymisque fusis\nNuminis iram.\n\nPerdolens Mater fovet, atque amictum\nIpsa lugubrem monet induendum:\nAgminis sancti pia cœpta surgunt,\nMira patescunt.\n\nPalmes in bruma viridans honores\nNuntiat patrum: proprios Mariæ\nOre lactenti vocitant puelli\nNomine Servos.\n\nSit decus Patri, genitæque Proli,\nEt tibi, compar utriusque virtus\nSpiritus semper, Deus unus, omni\nTemporis ævo.",
      summary:
        "The Matins hymn of the feast of the Seven Holy Founders of the Servite Order (12 February in Britt's day), by Vincent Tarozzi (nineteenth century): while the cities of Italy ran with fraternal bloodshed, the Virgin called seven faithful men to keep her sorrows beneath the Cross in mind; they left their palaces for the solitude of Monte Senario, did penance for others' sins, took the mourning habit she gave them, and were hailed by infants as Servants of Mary. Britt notes that this hymn had been dropped from the latest editions of the Breviary. The English is an anonymous translation from the Servite Manual (1892), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["february", "office-of-readings", "our-lady-of-sorrows"],
      relatedSaints: [],
      citations: [`${BRITT}237/mode/1up`, `${BRITT}238/mode/1up`, `${BRITT}239/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "sic-patres-vitam",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}240/mode/1up`, `${BRITT}241/mode/1up`],
    payload: {
      slug: "sic-patres-vitam",
      title: "Sic patres vitam (The fathers lived a life in shade)",
      body: "The fathers lived a life in shade,\nYet seemed to Peter's vision seven\nWhite glistening lilies for the Maid,\nThe Queen of heaven.\n\nThrough city streets, o'er hills and plains,\nUpborne by love divine, they trod,\nTo fix in men the Mother's pains,\nThe swords of God.\n\nThis was the power in which they spoke,\nTill each wild passion owned their sway:\nThey cheered the sad, from sinners broke\nTheir chains away.\n\nTill at last the Virgin Queen\nLed them to mansions in the sky,\nMansions where garlands aye are green,\nAnd never die.\n\nMay they hear cries of all who pray,\nAnd see how hard our earthly strife:\nAiding us onward to the day\nWhen all is life.\n\nNow to the Father thanks and praise;\nTo Thee, O Son, the same we send;\nTo Thee, great Spirit, through all days,\nWorld without end.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Sic patres vitam peragunt in umbra,\nLilia ut septem nivei decoris,\nVirgini excelsæ bene grata, Petro\nVisa nitere.\n\nJamque divina rapiente flamma,\nCursitant urbes, loca quæque oberrant,\nSi queant cunctis animis dolores\nFigere Matris.\n\nHinc valent iras domuisse cæcas,\nNescia et pacis fera corda jungunt,\nErigunt moestos, revocant nocentes\nDicta piorum.\n\nAt suos Virgo comitata servos\nEvehit tandem superas ad oras:\nGemmeis sertis decorat per ævum\nOmne beatos.\n\nEja nunc cœtus gemitum precantis\nAudiant, duros videant labores:\nSemper et nostris faveant benigno\nLumine votis.\n\nSit decus Patri, genitæque Proli,\nEt tibi, compar utriusque Virtus\nSpiritus semper, Deus unus omni\nTemporis ævo.",
      summary:
        "The Lauds hymn of the feast of the Seven Holy Founders of the Servite Order, by Vincent Tarozzi (nineteenth century): the founders lived hidden lives, yet Saint Peter of Verona saw them in a vision as seven white lilies; burning with divine love they went through the cities to fix the Mother's sorrows in every soul, tamed blind passions and reconciled enemies, until the Virgin led them to heaven. The English is the translation of Charles Kegan Paul (1828-1902), as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["february", "lauds", "our-lady-of-sorrows"],
      relatedSaints: [],
      citations: [`${BRITT}240/mode/1up`, `${BRITT}241/mode/1up`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "matris-sub-almae",
    authorityLevel: "LITURGICAL_BOOK",
    citations: [`${BRITT}241/mode/1up`, `${BRITT}242/mode/1up`],
    payload: {
      slug: "matris-sub-almae",
      title: "Matris sub almae (By Mary's inspiration led)",
      body: "By Mary's inspiration led,\nA sevenfold offspring comes to light;\nAt Mary's call away they sped\nTo Mount Senario's rugged height.\n\nWhat fruits of grace the earth shall bear\nWhen they have sown their seeds divine!\nChrist's vine shall bud with clusters rare,\nEmpurpled with the ruddy wine.\n\nA holy death to heaven speeds\nThe souls with virtue's glory crowned;\nWhen Mary for her servants pleads,\nHeaven's blessed portals they have found.\n\nO happy souls who now obtain\nThe Kingdom, and the scepter bear!\nLook down on us who still remain\nWhere Satan spreads his subtle snare.\n\nTherefore on bended knee we pray,\nFor sake of Mary's bitter grief;\nChase darkness from our mind away,\nAnd give our troubled hearts relief.\n\nAnd Thou, O Trinity Divine!\nConfirm us in Thy holy grace!\nThat so we may our hearts incline\nTo walk in these Thy servants' ways.",
      prayerType: "hymn",
      category: "saintly",
      language: "en",
      latin:
        "Matris sub almæ numine\nSeptena proles nascitur:\nIpsa vocante, ad arduum\nTendit Senari verticem.\n\nQuos terra fructus proferet\nDum sacra proles germinat,\nUvis repente turgitis\nOnusta vitis præmonet.\n\nVirtute claros nobili\nMors sancta cœlo consecrat:\nTenent olympi limina\nServi fideles Virginis.\n\nCohors beata Numinis\nRegno potita respice\nQuos hinc recedens fraudibus\nCinctos relinquis hostium.\n\nErgo, per almæ vulnera\nMatris rogamus supplices,\nMentis tenebras disjice,\nCordis procellas comprime.\n\nTu nos, beata Trinitas,\nPerfunde sancto robore,\nPossimus ut feliciter\nExempla patrum subsequi.",
      summary:
        "The hymn for Second Vespers of the feast of the Seven Holy Founders of the Servite Order, by Vincent Tarozzi (nineteenth century), the one hymn of their office that Britt found still in the Breviary of his day: under the Mother's care a sevenfold family is born and climbs Monte Senario, a vine laden with grapes in winter foretells its fruitfulness, and the founders, now in heaven, are asked by the wounds of the Mother's sorrow to scatter the darkness of our minds and still the storms of our hearts. The English is the translation of Father Wallace, O.S.B., as printed in Matthew Britt's Hymns of the Breviary and Missal (1922).",
      occasions: ["february", "vespers", "our-lady-of-sorrows"],
      relatedSaints: [],
      citations: [`${BRITT}241/mode/1up`, `${BRITT}242/mode/1up`],
    },
  },
];
