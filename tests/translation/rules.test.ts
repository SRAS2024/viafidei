import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import {
  decideParishName,
  decideTitle,
  detectScript,
  findPersonNames,
  findProtectedSpans,
  isDocumentIncipit,
  isEnglishLanguageCode,
  isLatinTitleText,
  isLiturgicalLanguageCode,
  isTranslatableKey,
  isTranslatablePrayerText,
  isUniversalLatinGreekTitle,
  leadingIncipit,
  localeScript,
  looksLatin,
  personNameForms,
  titleParts,
  UNIVERSAL_LATIN_GREEK_TITLES,
  verifyProtectedSpans,
  withOriginal,
} from "@/lib/translation/rules";

const spans = (text: string, extra: string[] = []) =>
  findProtectedSpans(text, extra).map((s) => s.text);

describe("scripts", () => {
  it.each([
    ["Salve Regina", "latin"],
    ["Tiếng Việt", "latin"],
    ["Ἅγιος ὁ Θεός", "greek"],
    ["Церква Святого Миколая", "cyrillic"],
    ["圣若瑟堂", "han"],
    ["명동대성당", "hangul"],
    ["東京カテドラル聖マリア大聖堂", "japanese"],
    ["カトリック教会", "japanese"],
    ["كنيسة مار الياس", "arabic"],
    ["כנסיית הבשורה", "hebrew"],
    ["โบสถ์คาทอลิก", "thai"],
    ["संत मरियम", "devanagari"],
    ["1873–1897", "none"],
    ["", "none"],
  ])("%s is %s", (text, script) => {
    expect(detectScript(text)).toBe(script);
  });

  it("decides a mixed name by its majority script, kana marking Japanese", () => {
    expect(detectScript("Paroisse Notre-Dame-de-la-Paix أبرشية")).toBe("latin");
    expect(detectScript("聖イグナチオ教会")).toBe("japanese");
  });

  it("knows the script of every site locale", () => {
    const scripts = Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, localeScript(l)]));
    expect(scripts).toEqual({
      en: "latin",
      es: "latin",
      fr: "latin",
      it: "latin",
      de: "latin",
      pt: "latin",
      pl: "latin",
      la: "latin",
      tl: "latin",
      vi: "latin",
      ko: "hangul",
      zh: "han",
    });
  });
});

describe("language codes", () => {
  it.each([
    "la",
    "LA",
    "lat",
    "latin",
    "Latina",
    "la-VA",
    "el",
    "grc",
    "gr",
    "greek",
    "koine",
    "el_GR",
  ])("%s is a liturgical language", (code) => expect(isLiturgicalLanguageCode(code)).toBe(true));
  it.each(["en", "es", "fr", "", null, undefined, 3])("%s is not", (code) =>
    expect(isLiturgicalLanguageCode(code)).toBe(false),
  );
  it("treats an absent or English declaration as English", () => {
    for (const c of [undefined, null, "", "en", "EN", "en-US", "en_GB", "English"])
      expect(isEnglishLanguageCode(c)).toBe(true);
    for (const c of ["la", "es", "el", 1]) expect(isEnglishLanguageCode(c)).toBe(false);
  });
});

describe("rule (a): Latin and Greek titles stay as written", () => {
  const SPEC_TITLES = [
    "Pater Noster",
    "Ave Maria",
    "Salve Regina",
    "Te Deum",
    "Magnificat",
    "Agnus Dei",
    "Kyrie eleison",
    "Gloria Patri",
    "Anima Christi",
    "Tantum Ergo",
    "Regina Caeli",
    "Sub Tuum Praesidium",
    "Veni Creator Spiritus",
    "Dies Irae",
    "Stabat Mater",
    "Ubi Caritas",
    "Lumen Gentium",
  ];

  it.each(SPEC_TITLES)("%s is a universal title, kept for every content type", (title) => {
    expect(isUniversalLatinGreekTitle(title)).toBe(true);
    for (const type of ["PRAYER", "DEVOTION", "LITURGICAL", "CHURCH_DOCUMENT", "GUIDE", "NOVENA"]) {
      expect(decideTitle(type, title)).toEqual({ mode: "keep", reason: "latin-greek" });
    }
  });

  it("keeps every title on the universal list (and ignores case, accents and spacing)", () => {
    for (const title of UNIVERSAL_LATIN_GREEK_TITLES) {
      expect(decideTitle("PRAYER", title).mode, title).toBe("keep");
    }
    expect(isUniversalLatinGreekTitle("  salve   regina ")).toBe(true);
    expect(isUniversalLatinGreekTitle("Kýrie eléison")).toBe(true);
    expect(isUniversalLatinGreekTitle("Laudato Si’")).toBe(true);
  });

  it("keeps Greek-script titles and any other non-Latin script", () => {
    expect(decideTitle("PRAYER", "Ἄξιόν ἐστιν")).toEqual({ mode: "keep", reason: "latin-greek" });
    expect(decideTitle("PRAYER", "Ἅγιος ὁ Θεός")).toEqual({ mode: "keep", reason: "latin-greek" });
  });

  it("keeps a whole Latin title it has never seen", () => {
    expect(decideTitle("PRAYER", "Ave Maris Stella Dei Mater Alma").mode).toBe("keep");
    expect(decideTitle("PRAYER", "Oremus pro Pontifice nostro").mode).toBe("keep");
  });

  it("translates titles languages translate, and English titles", () => {
    for (const title of [
      "Hail Mary",
      "The Angelus",
      "Memorial Acclamation",
      "Corpus Christi Procession",
    ]) {
      expect(decideTitle("PRAYER", title).mode, title).toBe("translate");
    }
  });

  it("translates an English title but protects its Latin part", () => {
    expect(decideTitle("PRAYER", "Hail Holy Queen (Salve Regina)")).toEqual({
      mode: "translate",
      protect: ["Salve Regina"],
    });
    expect(decideTitle("PRAYER", "Salve Regina (Hail, Holy Queen)")).toEqual({
      mode: "translate",
      protect: ["Salve Regina"],
    });
    expect(decideTitle("PRAYER", "Eternal Rest (Requiem Aeternam)")).toEqual({
      mode: "translate",
      protect: ["Requiem Aeternam"],
    });
    expect(decideTitle("SPIRITUAL_PRACTICE", "Ora et Labora — The Benedictine Balance")).toEqual({
      mode: "translate",
      protect: ["Ora et Labora"],
    });
    expect(
      decideTitle("SPIRITUAL_PRACTICE", "Memento Mori — Keeping Death Before One's Eyes"),
    ).toEqual({ mode: "translate", protect: ["Memento Mori"] });
  });

  it("protects Latin incipits the lexicon does not know, by their parts", () => {
    const protect = (title: string) => {
      const d = decideTitle("PRAYER", title);
      return d.mode === "translate" ? d.protect : null;
    };
    expect(protect("Conditor alme siderum (Creator of the stars of night)")).toContain(
      "Conditor alme siderum",
    );
    expect(protect("Prayer Before Study (Creator ineffabilis)")).toContain("Creator ineffabilis");
    expect(protect("Prayer of Saint Bonaventure (Transfige dulcissime)")).toEqual([
      "Saint Bonaventure",
      "Transfige dulcissime",
    ]);
    expect(protect("Itinerarium (Blessing for a Journey)")).toEqual(["Itinerarium"]);
    expect(protect("Psalm 94 (95): Venite: Come let us praise the Lord with joy")).toEqual([
      "Venite",
    ]);
    expect(protect("Psalm 109 (110): Dixit Dominus: The Lord said to my Lord")).toEqual([
      "Dixit Dominus",
    ]);
    expect(protect("Mother of God (Theotokos)")).toEqual(["Theotokos"]);
    // Published titles whose Latin part the rules used to translate (2026-10-31).
    expect(protect("Athanasian Creed (Quicumque)")).toEqual(["Quicumque"]);
    expect(protect("Flos Carmeli (Flower of Carmel)")).toEqual(["Flos Carmeli"]);
    expect(protect("Morning Star (Stella Matutina)")).toEqual(["Stella Matutina"]);
  });

  it("keeps the Latin word of a Latin-and-English name, and translates the English", () => {
    const protect = (title: string) => {
      const d = decideTitle("LITURGICAL", title);
      return d.mode === "translate" ? d.protect : null;
    };
    // Not "Gaudete Sunday": the reader gets "Domingo Gaudete", not "Gaudete Sunday".
    expect(protect("Gaudete Sunday (Third Sunday of Advent)")).toEqual(["Gaudete"]);
    expect(protect("Laetare Sunday (Fourth Sunday of Lent)")).toEqual(["Laetare"]);
    expect(isLatinTitleText("Gaudete Sunday")).toBe(false);
    expect(isLatinTitleText("Tenebrae Service")).toBe(false);
    expect(decideTitle("SPIRITUAL_PRACTICE", "Lectio Divina")).toEqual({
      mode: "keep",
      reason: "latin-greek",
    });
  });

  it("does not mistake English glosses or scripture references for Latin", () => {
    expect(decideTitle("PRAYER", "O Gloriosa Domina (O heaven's glorious mistress)").mode).toBe(
      "translate",
    );
    expect(isLatinTitleText("O heaven's glorious mistress")).toBe(false);
    expect(isLatinTitleText("Exodus 15:1-18")).toBe(false);
    expect(isLatinTitleText("Pious Invocations")).toBe(false);
    expect(isLatinTitleText("Christmas Novena")).toBe(false);
    expect(isLatinTitleText("Mysteries of Light")).toBe(false);
    expect(decideTitle("PRAYER", "Fatima Prayer (O My Jesus)")).toEqual({
      mode: "translate",
      protect: [],
    });
  });

  it("splits titles into their parts exactly as written", () => {
    expect(titleParts("Psalm 109 (110): Dixit Dominus: The Lord said")).toEqual([
      "Psalm 109",
      "110",
      "Dixit Dominus",
      "The Lord said",
    ]);
    expect(titleParts("Ora et Labora — The Benedictine Balance")).toEqual([
      "Ora et Labora",
      "The Benedictine Balance",
    ]);
  });
});

describe("rule (a): Church documents keep their incipit", () => {
  it.each([
    "Lumen Gentium",
    "Rerum Novarum",
    "Pacem in Terris",
    "Laudato Si'",
    "Fratelli Tutti",
    "Querida Amazonia",
    "Mit brennender Sorge",
    "Spiritus Paraclitus",
    "Ad Tuendam Fidem",
    "Vehementer Nos",
    "Divini Amoris Scientia",
    "Africae Munus",
    "Inter caetera",
    "Redemptionis Sacramentum",
    // Published incipits the rules used to translate (found 2026-10-31).
    "Ecclesia in America",
    "Vox in Rama",
    "Liturgiam Authenticam",
    "Magnifica Humanitas",
    "Missale Romanum",
  ])("%s is kept", (title) => {
    expect(decideTitle("CHURCH_DOCUMENT", title).mode).toBe("keep");
  });

  it("protects an incipit that leads an English gloss", () => {
    expect(
      decideTitle("CHURCH_DOCUMENT", "Solemni Hac Liturgia (Credo of the People of God)"),
    ).toEqual({ mode: "translate", protect: ["Solemni Hac Liturgia", "Credo"] });
  });

  it.each([
    "Catechism of the Catholic Church",
    "Code of Canon Law",
    "Decree on Ecumenism",
    "Spiritual Exercises",
    "Compendium of the Social Doctrine of the Church",
  ])("%s is a description and is translated", (title) => {
    expect(isDocumentIncipit(title)).toBe(false);
    expect(decideTitle("CHURCH_DOCUMENT", title).mode).toBe("translate");
  });

  it("protects an incipit that leads an English description", () => {
    expect(leadingIncipit("Dei Verbum: Dogmatic Constitution on Divine Revelation")).toBe(
      "Dei Verbum",
    );
    expect(leadingIncipit("Humanae Vitae — On the Regulation of Birth")).toBe("Humanae Vitae");
    expect(leadingIncipit("The Joy of the Gospel: an exhortation")).toBeNull();
    const d = decideTitle(
      "CHURCH_DOCUMENT",
      "Dei Verbum: Dogmatic Constitution on Divine Revelation",
    );
    expect(d).toEqual({ mode: "translate", protect: ["Dei Verbum"] });
  });
});

describe("rule (a): Latin and Greek inside English prose", () => {
  it("finds universal titles, longest first, capitalized when one word", () => {
    expect(spans("We sing the Salve Regina after Compline.")).toEqual(["Salve Regina"]);
    expect(spans("The Stabat Mater Dolorosa is a sequence.")).toEqual(["Stabat Mater Dolorosa"]);
    expect(spans("Mary's Magnificat is in Luke 1.")).toEqual(["Magnificat"]);
    expect(spans("His credo was simple.")).toEqual([]);
  });

  it("finds Latin phrases, Greek runs and caller-supplied terms", () => {
    expect(spans("Every Jesuit work is done ad maiorem Dei gloriam, they say.")).toContain(
      "ad maiorem Dei gloriam",
    );
    expect(spans("The response is ora pro nobis.")).toEqual(["ora pro nobis"]);
    expect(spans("The hymn Φῶς ἱλαρόν is very old.")).toEqual(["Φῶς ἱλαρόν"]);
    expect(spans("Read Fratelli Tutti slowly.", ["Fratelli Tutti"])).toEqual(["Fratelli Tutti"]);
  });

  it("does not protect ordinary English", () => {
    expect(spans("Pray the rosary every day with your family.")).toEqual([]);
    expect(spans("In the beginning was the Word.")).toEqual([]);
  });

  it("keeps a canonical Latin term inside an English label", () => {
    expect(spans("Byzantine tradition · Church sui iuris")).toEqual(["sui iuris"]);
  });

  it("restores a span the model returned with other case or accents, and rejects a lost one", () => {
    expect(verifyProtectedSpans("Rezamos la salve regina.", [{ text: "Salve Regina" }])).toBe(
      "Rezamos la Salve Regina.",
    );
    expect(verifyProtectedSpans("Le Magníficat est chanté.", [{ text: "Magnificat" }])).toBe(
      "Le Magnificat est chanté.",
    );
    expect(verifyProtectedSpans("Rezamos la Salve Reina.", [{ text: "Salve Regina" }])).toBeNull();
    expect(verifyProtectedSpans("Sin nada.", [])).toBe("Sin nada.");
  });
});

describe("rule (c): saints' names are never machine-translated", () => {
  const names = (text: string) => findPersonNames(text).map((n) => n.text);

  it("finds saints, the blessed and the venerable, with the joiners of names", () => {
    expect(names("Saint John Vianney was parish priest of Ars.")).toEqual(["Saint John Vianney"]);
    expect(names("St. Thérèse of Lisieux entered Carmel.")).toEqual(["St. Thérèse of Lisieux"]);
    expect(names("Saint John of the Cross wrote poems.")).toEqual(["Saint John of the Cross"]);
    expect(names("Pray to Saint Michael the Archangel.")).toEqual(["Saint Michael the Archangel"]);
    expect(names("Saints Peter and Paul died in Rome.")).toEqual(["Saints Peter and Paul"]);
    expect(names("Blessed Carlo Acutis loved the Eucharist.")).toEqual(["Blessed Carlo Acutis"]);
    expect(names("Venerable Fulton Sheen preached on TV.")).toEqual(["Venerable Fulton Sheen"]);
    expect(names("Sts. Cyril and Methodius evangelised the Slavs.")).toEqual([
      "Sts. Cyril and Methodius",
    ]);
  });

  it("stops at a possessive, a common noun and sentence punctuation", () => {
    expect(names("Saint Anthony's Bread feeds the poor.")).toEqual(["Saint Anthony"]);
    expect(names("Prayer for St. Joseph's Protection")).toEqual(["St. Joseph"]);
    expect(names("Saint Andrew Christmas Novena")).toEqual(["Saint Andrew"]);
    expect(names("St. Gerard Majella Annual Novena")).toEqual(["St. Gerard Majella"]);
    expect(names("It was canonized by Saint Francis.")).toEqual(["Saint Francis"]);
    expect(names("Saint Monica and her son prayed.")).toEqual(["Saint Monica"]);
  });

  it("is not fooled by things called blessed, or by All Saints", () => {
    expect(names("The Blessed Virgin Mary and the Blessed Sacrament.")).toEqual([]);
    // At the end of a sentence too (the full stop used to hide "Sacrament").
    expect(names("Many pray it before the Blessed Sacrament.")).toEqual([]);
    expect(spans("Many pray it before the Blessed Sacrament.")).toEqual([]);
    expect(names("Blessed Candles and Blessed Palms")).toEqual([]);
    expect(names("All Saints Day is on 1 November.")).toEqual([]);
    expect(names("the saint of the day")).toEqual([]);
  });

  it("leaves a pope's regnal name to the model", () => {
    expect(names("Pope Leo XIII wrote Rerum Novarum.")).toEqual([]);
    expect(names("Pope Saint John Paul II visited Poland.")).toEqual(["Saint John Paul II"]);
  });

  it("protects saints' names inside prose, alongside Latin titles", () => {
    expect(spans("Pope Pius XII established the feast of St. Joseph the Worker.")).toEqual([
      "St. Joseph the Worker",
    ]);
    expect(spans("Saint Bernard loved the Salve Regina.")).toEqual([
      "Saint Bernard",
      "Salve Regina",
    ]);
  });

  it("never translates the title of a saint's, Doctor's or pope's page", () => {
    for (const type of ["SAINT", "DOCTOR", "POPE"]) {
      expect(decideTitle(type, "Saint Thérèse of Lisieux")).toEqual({
        mode: "keep",
        reason: "person-name",
      });
    }
  });

  it("derives every form a page's own saint takes in its prose", () => {
    expect(personNameForms("Saint Aaron of Aleth")).toEqual(["Aaron of Aleth", "Aaron"]);
    expect(personNameForms("Saint Thérèse of Lisieux")).toEqual(["Thérèse of Lisieux", "Thérèse"]);
    expect(personNameForms("Saints Abdon and Sennen")).toEqual([
      "Abdon and Sennen",
      "Abdon",
      "Sennen",
    ]);
    expect(personNameForms("Anthony, John, and Eustathios")).toEqual([
      "Anthony",
      "John",
      "Eustathios",
    ]);
    expect(personNameForms("Saint Mother Teresa of Calcutta")).toEqual([
      "Teresa of Calcutta",
      "Teresa",
    ]);
    expect(personNameForms("Saint Adelaide, Abbess of Vilich")).toEqual([
      "Adelaide, Abbess of Vilich",
      "Adelaide",
    ]);
    expect(personNameForms("Patriarch Parthenius III of Constantinople")).toEqual([
      "Parthenius III of Constantinople",
      "Parthenius",
    ]);
    expect(personNameForms("Blessed beato Bonaventura, da Potenza")).toEqual([
      "Bonaventura, da Potenza",
      "Bonaventura",
    ]);
    // Not names: a group, a number, a description.
    expect(personNameForms("Blessed 108 Martyrs of World War II")).toEqual([]);
    expect(personNameForms("Saint Martyrs of Compiègne")).toEqual([]);
    expect(personNameForms("Saint The Seven Brothers of Lazia")).toEqual([]);
  });

  it("protects a one-word name only where it is capitalized, and stops before a possessive", () => {
    expect(spans("Faith was martyred under Hadrian.", ["Faith"])).toEqual(["Faith"]);
    expect(spans("She kept the faith to the end.", ["Faith"])).toEqual([]);
    expect(spans("During Agatho's tenure the council met.", ["Agatho"])).toEqual(["Agatho"]);
  });

  it("protects the saint in a translated title", () => {
    expect(decideTitle("NOVENA", "Novena to Saint Thérèse of Lisieux")).toEqual({
      mode: "translate",
      protect: ["Saint Thérèse of Lisieux"],
    });
  });
});

describe("which payload fields are prose", () => {
  it.each(["summary", "body", "background", "biography", "instructions", "steps", "patronages"])(
    "%s is translated",
    (key) => expect(isTranslatableKey(key)).toBe(true),
  );
  it.each([
    "latin",
    "greek",
    "translations",
    "language",
    "officialPrayer",
    "quote",
    "scripture",
    "relatedSaintSlugs",
    "sourceUrl",
    "canonicalName",
    "latinText",
    "greekTitle",
    "slug",
    "citations",
    "feastDay",
  ])("%s is never translated", (key) => {
    expect(isTranslatableKey(key)).toBe(false);
    expect(isTranslatableKey(key, true)).toBe(false);
  });
  it("knows the prose keys of structured entries", () => {
    expect(isTranslatableKey("title")).toBe(false);
    expect(isTranslatableKey("title", true)).toBe(true);
    expect(isTranslatableKey("text", true)).toBe(true);
    expect(isTranslatableKey("intention", true)).toBe(true);
  });

  it("translates a prayer's own text only when it is English", () => {
    const hail = "Hail Mary, full of grace, the Lord is with thee.";
    const ave = "Ave Maria, gratia plena, Dominus tecum.";
    expect(isTranslatablePrayerText({}, hail)).toBe(true);
    expect(isTranslatablePrayerText({ language: "en" }, hail)).toBe(true);
    expect(isTranslatablePrayerText({ language: "la" }, hail)).toBe(false);
    expect(isTranslatablePrayerText({ language: "el" }, hail)).toBe(false);
    expect(isTranslatablePrayerText({ language: "grc" }, hail)).toBe(false);
    expect(isTranslatablePrayerText({ language: "es" }, hail)).toBe(false);
    expect(isTranslatablePrayerText({}, ave)).toBe(false);
    expect(isTranslatablePrayerText({}, "Ἅγιος ὁ Θεός, Ἅγιος ἰσχυρός")).toBe(false);
  });

  it("recognises Latin lines and leaves English alone", () => {
    expect(looksLatin("Pater noster, qui es in caelis, sanctificetur nomen tuum.")).toBe(true);
    expect(looksLatin("Ora pro nobis")).toBe(true);
    expect(looksLatin("Requiem aeternam dona eis, Domine")).toBe(true);
    expect(looksLatin("Our Father, who art in heaven, hallowed be thy name.")).toBe(false);
    expect(looksLatin("The Salve Regina is sung after Compline.")).toBe(false);
    expect(looksLatin("Amen.")).toBe(false);
  });
});

describe("rule (b): parish names", () => {
  const LATIN_READERS: Locale[] = ["en", "es", "fr", "it", "de", "pt", "pl", "la", "tl", "vi"];

  it("keeps every Latin-script name for every Latin-script reader", () => {
    for (const name of [
      "Parroquia Nuestra Señora de Guadalupe",
      "Église Saint-Roch",
      "Kościół pw. Świętych Apostołów Szymona i Judy Tadeusza w Skawinie",
      "Nhà thờ Đức Bà Sài Gòn",
      "St. Mary's Catholic Church",
    ]) {
      for (const locale of LATIN_READERS) {
        expect(decideParishName(name, locale), `${name} / ${locale}`).toEqual({
          action: "keep",
          reason: "same-script",
        });
      }
    }
  });

  it("keeps a name in the reader's own script", () => {
    expect(decideParishName("명동대성당", "ko")).toEqual({ action: "keep", reason: "same-script" });
    expect(decideParishName("北京圣母无染原罪主教座堂", "zh")).toEqual({
      action: "keep",
      reason: "same-script",
    });
  });

  it("transliterates Hangul, kana, Cyrillic and Greek names for Latin-script readers", () => {
    for (const name of [
      "명동대성당",
      "カトリック教会",
      "Церква Святого Миколая",
      "Храм Святого Николая",
      "Καθολική εκκλησία Αγίου Ιωάννου",
    ]) {
      for (const locale of LATIN_READERS) {
        expect(decideParishName(name, locale), `${name} / ${locale}`).toEqual({
          action: "transliterate",
        });
      }
    }
  });

  it("transliterates across the CJK scripts too: Hangul for Chinese readers, kana for Korean", () => {
    expect(decideParishName("명동대성당", "zh")).toEqual({ action: "transliterate" });
    expect(decideParishName("カトリック教会", "ko")).toEqual({ action: "transliterate" });
    expect(decideParishName("Храм Святого Николая", "ko")).toEqual({ action: "transliterate" });
  });

  it("keeps a name whose script has no letter-by-letter transliteration as written", () => {
    for (const name of [
      "北京圣母无染原罪主教座堂",
      "كنيسة مار الياس",
      "כנסיית הבשורה",
      "โบสถ์คาทอลิก",
      "სამების ტაძარი",
      "Սուրբ Աստվածածին",
    ]) {
      expect(decideParishName(name, "en"), name).toEqual({
        action: "keep",
        reason: "no-transliteration",
      });
    }
    // Han for a Korean reader: legible as hanja, and nothing to transliterate it with.
    expect(decideParishName("北京圣母无染原罪主教座堂", "ko")).toEqual({
      action: "keep",
      reason: "no-transliteration",
    });
  });

  it("never machine-translates a name: a Latin-script name stays as written for every reader", () => {
    for (const locale of ["zh", "ko"] as const) {
      for (const name of [
        "St. Mary's Catholic Church",
        "Parroquia San José",
        "Église Saint-Roch",
      ]) {
        expect(decideParishName(name, locale), `${name} / ${locale}`).toEqual({
          action: "keep",
          reason: "latin-script",
        });
      }
    }
    expect(decideParishName("12", "zh")).toEqual({ action: "keep", reason: "no-letters" });
    // No locale, for any name, ever gets anything but keep or transliterate.
    for (const locale of SUPPORTED_LOCALES) {
      for (const name of [
        "명동대성당",
        "北京圣母无染原罪主教座堂",
        "St. Mary's",
        "Храм",
        "Άγιος",
      ]) {
        expect(["keep", "transliterate"]).toContain(decideParishName(name, locale).action);
      }
    }
  });

  it("always shows the original beside a rendering", () => {
    expect(withOriginal("Myeongdong Daeseongdang", "명동대성당")).toBe(
      "Myeongdong Daeseongdang (명동대성당)",
    );
    expect(withOriginal("명동대성당", "명동대성당")).toBe("명동대성당");
    expect(withOriginal("  ", "명동대성당")).toBe("명동대성당");
  });
});
