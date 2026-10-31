import type { CuratedEntry } from "../index";

const TPL = "https://www.preces-latinae.org/thesaurus/";
const BRITT = "https://archive.org/details/hymnsofbreviarym00britrich/page/";

/**
 * Batch 11 of the curated prayer catalogue: hymns of the Roman Breviary and the
 * Liturgy of the Hours with their Latin, in public-domain English translations.
 *
 * Every body and every `latin` value is copied from the first cited page (the
 * Thesaurus Precum Latinarum, preces-latinae.org), which prints the Latin and
 * the English side by side. Only pages whose English that site attributes to a
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
];
