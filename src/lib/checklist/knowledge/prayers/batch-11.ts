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
];
