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
};

/** Slugs that intentionally carry no curated Latin/Greek yet (need a curator). */
export function hasCuratedTranslation(slug: string): boolean {
  return PRAYER_TRANSLATIONS[slug] != null;
}
