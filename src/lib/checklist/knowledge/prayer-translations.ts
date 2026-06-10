/**
 * Curated liturgical translations for the canonical prayers (spec: every prayer
 * and guide offers a Latin / Greek toggle). These are FIXED, public-domain
 * liturgical texts of the Catholic Church — reproduced verbatim, never machine
 * translated. The Admin Worker publishes them with the prayer (curated ingest),
 * and the `PrayerLanguageToggle` renders them (Latin/Greek are `preserve: true`,
 * so they are marked `translate="no"` and never auto-translated).
 *
 * Prayers without an authentic curated translation here are intentionally left
 * untranslated: a content-custody check flags them so a curator can add the
 * exact text, rather than the worker fabricating a sacred text.
 */

export interface PrayerTranslation {
  latin?: string;
  greek?: string;
}

export const PRAYER_TRANSLATIONS: Record<string, PrayerTranslation> = {
  "our-father": {
    latin:
      "Pater noster, qui es in caelis,\nsanctificetur nomen tuum;\nadveniat regnum tuum;\nfiat voluntas tua,\nsicut in caelo, et in terra.\nPanem nostrum quotidianum da nobis hodie;\net dimitte nobis debita nostra,\nsicut et nos dimittimus debitoribus nostris;\net ne nos inducas in tentationem;\nsed libera nos a malo.\nAmen.",
    greek:
      "Πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς·\nἁγιασθήτω τὸ ὄνομά σου·\nἐλθέτω ἡ βασιλεία σου·\nγενηθήτω τὸ θέλημά σου,\nὡς ἐν οὐρανῷ καὶ ἐπὶ τῆς γῆς·\nτὸν ἄρτον ἡμῶν τὸν ἐπιούσιον δὸς ἡμῖν σήμερον·\nκαὶ ἄφες ἡμῖν τὰ ὀφειλήματα ἡμῶν,\nὡς καὶ ἡμεῖς ἀφίεμεν τοῖς ὀφειλέταις ἡμῶν·\nκαὶ μὴ εἰσενέγκῃς ἡμᾶς εἰς πειρασμόν,\nἀλλὰ ῥῦσαι ἡμᾶς ἀπὸ τοῦ πονηροῦ.\nἈμήν.",
  },
  "hail-mary": {
    latin:
      "Ave Maria, gratia plena,\nDominus tecum.\nBenedicta tu in mulieribus,\net benedictus fructus ventris tui, Iesus.\nSancta Maria, Mater Dei,\nora pro nobis peccatoribus,\nnunc et in hora mortis nostrae.\nAmen.",
    greek:
      "Θεοτόκε Παρθένε, χαῖρε, κεχαριτωμένη Μαρία,\nὁ Κύριος μετὰ σοῦ.\nεὐλογημένη σὺ ἐν γυναιξί,\nκαὶ εὐλογημένος ὁ καρπὸς τῆς κοιλίας σου,\nὅτι Σωτῆρα ἔτεκες τῶν ψυχῶν ἡμῶν.",
  },
  "glory-be": {
    latin:
      "Gloria Patri, et Filio, et Spiritui Sancto.\nSicut erat in principio, et nunc, et semper,\net in saecula saeculorum.\nAmen.",
    greek:
      "Δόξα Πατρὶ καὶ Υἱῷ καὶ Ἁγίῳ Πνεύματι,\nκαὶ νῦν καὶ ἀεὶ καὶ εἰς τοὺς αἰῶνας τῶν αἰώνων.\nἈμήν.",
  },
  "apostles-creed": {
    latin:
      "Credo in Deum Patrem omnipotentem,\nCreatorem caeli et terrae.\nEt in Iesum Christum, Filium eius unicum, Dominum nostrum,\nqui conceptus est de Spiritu Sancto,\nnatus ex Maria Virgine,\npassus sub Pontio Pilato,\ncrucifixus, mortuus, et sepultus,\ndescendit ad inferos,\ntertia die resurrexit a mortuis,\nascendit ad caelos,\nsedet ad dexteram Dei Patris omnipotentis,\ninde venturus est iudicare vivos et mortuos.\nCredo in Spiritum Sanctum,\nsanctam Ecclesiam catholicam,\nsanctorum communionem,\nremissionem peccatorum,\ncarnis resurrectionem,\nvitam aeternam.\nAmen.",
  },
  "salve-regina": {
    latin:
      "Salve, Regina, Mater misericordiae,\nvita, dulcedo, et spes nostra, salve.\nAd te clamamus, exsules filii Hevae.\nAd te suspiramus, gementes et flentes\nin hac lacrimarum valle.\nEia ergo, advocata nostra,\nillos tuos misericordes oculos ad nos converte.\nEt Iesum, benedictum fructum ventris tui,\nnobis post hoc exsilium ostende.\nO clemens, O pia, O dulcis Virgo Maria.",
  },
  "regina-caeli": {
    latin:
      "Regina caeli, laetare, alleluia.\nQuia quem meruisti portare, alleluia.\nResurrexit, sicut dixit, alleluia.\nOra pro nobis Deum, alleluia.",
  },
  memorare: {
    latin:
      "Memorare, O piissima Virgo Maria,\nnon esse auditum a saeculo,\nquemquam ad tua currentem praesidia,\ntua implorantem auxilia,\ntua petentem suffragia, esse derelictum.\nEgo tali animatus confidentia,\nad te, Virgo Virginum, Mater, curro,\nad te venio, coram te gemens peccator assisto.\nNoli, Mater Verbi, verba mea despicere;\nsed audi propitia et exaudi.\nAmen.",
  },
  "anima-christi": {
    latin:
      "Anima Christi, sanctifica me.\nCorpus Christi, salva me.\nSanguis Christi, inebria me.\nAqua lateris Christi, lava me.\nPassio Christi, conforta me.\nO bone Iesu, exaudi me.\nIntra tua vulnera absconde me.\nNe permittas me separari a te.\nAb hoste maligno defende me.\nIn hora mortis meae voca me.\nEt iube me venire ad te,\nut cum Sanctis tuis laudem te\nin saecula saeculorum.\nAmen.",
  },
  "prayer-to-saint-michael": {
    latin:
      "Sancte Michael Archangele,\ndefende nos in proelio;\ncontra nequitiam et insidias diaboli esto praesidium.\nImperet illi Deus, supplices deprecamur:\ntuque, Princeps militiae caelestis,\nSatanam aliosque spiritus malignos,\nqui ad perditionem animarum pervagantur in mundo,\ndivina virtute in infernum detrude.\nAmen.",
  },
  confiteor: {
    latin:
      "Confiteor Deo omnipotenti\net vobis, fratres,\nquia peccavi nimis\ncogitatione, verbo, opere et omissione:\nmea culpa, mea culpa, mea maxima culpa.\nIdeo precor beatam Mariam semper Virginem,\nomnes Angelos et Sanctos, et vos, fratres,\norare pro me ad Dominum Deum nostrum.\nAmen.",
  },
  "nicene-creed": {
    latin:
      "Credo in unum Deum,\nPatrem omnipotentem,\nfactorem caeli et terrae,\nvisibilium omnium et invisibilium.\nEt in unum Dominum Iesum Christum,\nFilium Dei unigenitum,\net ex Patre natum ante omnia saecula.\nDeum de Deo, lumen de lumine,\nDeum verum de Deo vero,\ngenitum, non factum, consubstantialem Patri:\nper quem omnia facta sunt.\nQui propter nos homines et propter nostram salutem\ndescendit de caelis.\nEt incarnatus est de Spiritu Sancto\nex Maria Virgine, et homo factus est.\nCrucifixus etiam pro nobis sub Pontio Pilato;\npassus et sepultus est,\net resurrexit tertia die, secundum Scripturas,\net ascendit in caelum, sedet ad dexteram Patris.\nEt iterum venturus est cum gloria,\niudicare vivos et mortuos,\ncuius regni non erit finis.\nEt in Spiritum Sanctum, Dominum et vivificantem:\nqui ex Patre Filioque procedit.\nQui cum Patre et Filio simul adoratur et conglorificatur:\nqui locutus est per prophetas.\nEt unam, sanctam, catholicam et apostolicam Ecclesiam.\nConfiteor unum baptisma in remissionem peccatorum.\nEt exspecto resurrectionem mortuorum,\net vitam venturi saeculi.\nAmen.",
  },
  magnificat: {
    latin:
      "Magnificat anima mea Dominum,\net exsultavit spiritus meus in Deo salutari meo.\nQuia respexit humilitatem ancillae suae:\necce enim ex hoc beatam me dicent omnes generationes.\nQuia fecit mihi magna qui potens est,\net sanctum nomen eius.\nEt misericordia eius a progenie in progenies\ntimentibus eum.\nFecit potentiam in bracchio suo:\ndispersit superbos mente cordis sui.\nDeposuit potentes de sede,\net exaltavit humiles.\nEsurientes implevit bonis,\net divites dimisit inanes.\nSuscepit Israel puerum suum,\nrecordatus misericordiae suae.\nSicut locutus est ad patres nostros,\nAbraham et semini eius in saecula.\nAmen.",
  },
  angelus: {
    latin:
      "V. Angelus Domini nuntiavit Mariae.\nR. Et concepit de Spiritu Sancto.\nAve Maria…\nV. Ecce ancilla Domini.\nR. Fiat mihi secundum verbum tuum.\nAve Maria…\nV. Et Verbum caro factum est.\nR. Et habitavit in nobis.\nAve Maria…\nV. Ora pro nobis, sancta Dei Genetrix.\nR. Ut digni efficiamur promissionibus Christi.\nOremus. Gratiam tuam, quaesumus, Domine,\nmentibus nostris infunde;\nut qui, Angelo nuntiante,\nChristi Filii tui incarnationem cognovimus,\nper passionem eius et crucem,\nad resurrectionis gloriam perducamur.\nPer eundem Christum Dominum nostrum.\nAmen.",
  },
  "veni-creator-spiritus": {
    latin:
      "Veni, Creator Spiritus,\nmentes tuorum visita,\nimple superna gratia,\nquae tu creasti pectora.\nQui diceris Paraclitus,\naltissimi donum Dei,\nfons vivus, ignis, caritas,\net spiritalis unctio.\nAccende lumen sensibus,\ninfunde amorem cordibus,\ninfirma nostri corporis\nvirtute firmans perpeti.\nDeo Patri sit gloria,\net Filio, qui a mortuis\nsurrexit, ac Paraclito,\nin saeculorum saecula.\nAmen.",
  },
  "act-of-contrition": {
    latin:
      "Deus meus, ex toto corde paenitet me omnium meorum peccatorum,\neaque detestor, quia peccando,\nnon solum poenas a te iuste statutas promeritus sum,\nsed praesertim quia offendi te,\nsummum bonum, ac dignum qui super omnia diligaris.\nIdeo firmiter propono,\nadiuvante gratia tua,\nde cetero me non peccaturum peccandique occasiones proximas fugiturum.\nAmen.",
  },
  "act-of-faith": {
    latin:
      "Domine Deus, firma fide credo et confiteor omnia et singula\nquae sancta Ecclesia Catholica proponit,\nquia tu, Deus, ea omnia revelasti,\nqui es aeterna veritas et sapientia,\nquae nec fallere nec falli potest.\nIn hac fide vivere et mori statuo.\nAmen.",
  },
  "act-of-hope": {
    latin:
      "Domine Deus, spero per gratiam tuam remissionem omnium peccatorum,\net post hanc vitam aeternam felicitatem me esse consecuturum,\nquia tu promisisti, qui es infinite potens, fidelis, benignus, et misericors.\nIn hac spe vivere et mori statuo.\nAmen.",
  },
  "act-of-love": {
    latin:
      "Domine Deus, amo te super omnia et proximum meum propter te,\nquia tu es summum, infinitum, et perfectissimum bonum,\nomni dilectione dignum.\nIn hac caritate vivere et mori statuo.\nAmen.",
  },
  "divine-praises": {
    latin:
      "Benedictus Deus.\nBenedictum Nomen Sanctum eius.\nBenedictus Iesus Christus, verus Deus et verus homo.\nBenedictum Nomen Iesu.\nBenedictum Cor eius sacratissimum.\nBenedictus Sanguis eius pretiosissimus.\nBenedictus Iesus in sanctissimo altaris Sacramento.\nBenedictus Sanctus Spiritus Paraclitus.\nBenedicta excelsa Mater Dei, Maria sanctissima.\nBenedicta sancta eius et immaculata Conceptio.\nBenedicta eius gloriosa Assumptio.\nBenedictum nomen Mariae, Virginis et Matris.\nBenedictus sanctus Ioseph, eius castissimus Sponsus.\nBenedictus Deus in Angelis suis, et in Sanctis suis.\nAmen.",
  },
  "grace-before-meals": {
    latin:
      "Benedic, Domine, nos et haec tua dona,\nquae de tua largitate sumus sumpturi.\nPer Christum Dominum nostrum.\nAmen.",
  },
  "grace-after-meals": {
    latin:
      "Agimus tibi gratias, omnipotens Deus,\npro universis beneficiis tuis,\nqui vivis et regnas in saecula saeculorum.\nAmen.",
  },
};

/** Slugs that intentionally carry no curated Latin/Greek yet (need a curator). */
export function hasCuratedTranslation(slug: string): boolean {
  return PRAYER_TRANSLATIONS[slug] != null;
}
