import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";

function doc(
  slug: string,
  title: string,
  documentType:
    | "encyclical"
    | "apostolic_exhortation"
    | "apostolic_constitution"
    | "motu_proprio"
    | "apostolic_letter"
    | "decree"
    | "declaration"
    | "council_document"
    | "catechism_section"
    | "instruction"
    | "vatican_document"
    | "uscb_pastoral_letter",
  issuingAuthority: string,
  issuedDate: string,
  summary: string,
  keyThemes: string[],
  canonicalUrl: string,
): CuratedEntry {
  return {
    contentType: "CHURCH_DOCUMENT",
    slug,
    authorityLevel: "VATICAN",
    citations: [canonicalUrl, VATICAN],
    payload: {
      slug,
      title,
      documentType,
      issuingAuthority,
      issuedDate,
      summary,
      keyThemes,
      canonicalUrl,
      relatedDocuments: [],
      citations: [canonicalUrl, VATICAN],
    },
  };
}

export const churchDocumentKnowledge: CuratedEntry[] = [
  doc(
    "catechism-of-the-catholic-church",
    "Catechism of the Catholic Church",
    "catechism_section",
    "Pope John Paul II",
    "1992-10-11",
    "Promulgated by Pope John Paul II in 1992, the Catechism of the Catholic Church is the official synthesis of Catholic doctrine in four pillars: The Profession of Faith (the Creed), The Celebration of the Christian Mystery (the Sacraments), Life in Christ (the moral life), and Christian Prayer (the Our Father).",
    [
      "The Profession of Faith",
      "The Celebration of the Christian Mystery",
      "Life in Christ",
      "Christian Prayer",
    ],
    "https://www.vatican.va/archive/ENG0015/_INDEX.HTM",
  ),
  doc(
    "lumen-gentium",
    "Lumen Gentium",
    "council_document",
    "Pope Paul VI / Second Vatican Council",
    "1964-11-21",
    "The Dogmatic Constitution on the Church promulgated by the Second Vatican Council. Defines the Church as the Mystical Body of Christ, the People of God, and a sacrament of salvation. Treats the hierarchy, the laity, the universal call to holiness, religious life, and the Blessed Virgin Mary in the mystery of Christ and the Church.",
    [
      "The mystery of the Church",
      "The People of God",
      "The hierarchical structure of the Church",
      "The laity",
      "The universal call to holiness",
      "Religious life",
      "The pilgrim Church",
      "The Blessed Virgin Mary",
    ],
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html",
  ),
  doc(
    "dei-verbum",
    "Dei Verbum",
    "council_document",
    "Pope Paul VI / Second Vatican Council",
    "1965-11-18",
    "The Dogmatic Constitution on Divine Revelation. Affirms that Tradition and Scripture, flowing from the same divine wellspring, are bound closely together; that the Magisterium serves the Word of God; and that Scripture must be read in the Spirit in whom it was written.",
    [
      "Divine Revelation itself",
      "The transmission of Divine Revelation",
      "Sacred Scripture: its inspiration and divine interpretation",
      "The Old Testament",
      "The New Testament",
      "Sacred Scripture in the life of the Church",
    ],
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html",
  ),
  doc(
    "sacrosanctum-concilium",
    "Sacrosanctum Concilium",
    "council_document",
    "Pope Paul VI / Second Vatican Council",
    "1963-12-04",
    "The Constitution on the Sacred Liturgy — the first major document of the Second Vatican Council. Calls for the full, conscious, and active participation of the faithful in the liturgy and authorizes the liturgical reform that produced the Roman Missal of 1969.",
    [
      "General principles for the restoration and promotion of the sacred liturgy",
      "The most sacred mystery of the Eucharist",
      "The other sacraments and the sacramentals",
      "The divine office",
      "The liturgical year",
      "Sacred music",
      "Sacred art and furnishings",
    ],
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html",
  ),
  doc(
    "gaudium-et-spes",
    "Gaudium et Spes",
    "council_document",
    "Pope Paul VI / Second Vatican Council",
    "1965-12-07",
    "The Pastoral Constitution on the Church in the Modern World. The longest document of the Second Vatican Council. Treats the dignity of the human person, the community of mankind, human activity, the role of the Church in the modern world, and pressing problems (marriage and family, culture, economic and social life, political life, peace).",
    [
      "The dignity of the human person",
      "The community of mankind",
      "Human activity throughout the world",
      "The role of the Church in the modern world",
      "Marriage and the family",
      "The proper development of culture",
      "Economic and social life",
      "Political life",
      "The fostering of peace",
    ],
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_cons_19651207_gaudium-et-spes_en.html",
  ),
  doc(
    "humanae-vitae",
    "Humanae Vitae",
    "encyclical",
    "Pope Paul VI",
    "1968-07-25",
    "Pope Paul VI's encyclical on the regulation of birth, reaffirming the Church's teaching that each and every marriage act must remain open to the transmission of life. Condemns contraception, sterilization, and abortion as intrinsically disordered.",
    [
      "The transmission of life",
      "The unitive and procreative meanings of the conjugal act",
      "Responsible parenthood",
      "Lawful and unlawful means of regulating birth",
    ],
    "https://www.vatican.va/content/paul-vi/en/encyclicals/documents/hf_p-vi_enc_25071968_humanae-vitae.html",
  ),
  doc(
    "veritatis-splendor",
    "Veritatis Splendor",
    "encyclical",
    "Pope John Paul II",
    "1993-08-06",
    "Pope John Paul II's foundational moral encyclical. Reaffirms the existence of universal and unchanging moral norms knowable by reason and confirmed by revelation. Critiques proportionalism and other forms of consequentialism.",
    [
      "The foundations of moral theology",
      "Intrinsically evil acts",
      "The relation between freedom and truth",
      "Faith and morality",
    ],
    "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_06081993_veritatis-splendor.html",
  ),
  doc(
    "evangelium-vitae",
    "Evangelium Vitae",
    "encyclical",
    "Pope John Paul II",
    "1995-03-25",
    "Pope John Paul II's encyclical on the value and inviolability of human life. Definitively reaffirms the Church's teaching that the direct killing of an innocent human being is always gravely immoral. Condemns abortion, euthanasia, and the death penalty as applied today.",
    [
      "The Gospel of Life",
      "Threats to human life today",
      "The value of human life",
      "A new culture of life",
    ],
    "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_25031995_evangelium-vitae.html",
  ),
  doc(
    "deus-caritas-est",
    "Deus Caritas Est",
    "encyclical",
    "Pope Benedict XVI",
    "2005-12-25",
    "Pope Benedict XVI's first encyclical. Reflects on God as love, the unity of love (eros and agape) in creation and salvation, and the practice of love by the Church as a community of love.",
    ["God is love", "Eros and agape", "Charity as the Church's mission"],
    "https://www.vatican.va/content/benedict-xvi/en/encyclicals/documents/hf_ben-xvi_enc_20051225_deus-caritas-est.html",
  ),
  doc(
    "laudato-si",
    "Laudato Si'",
    "encyclical",
    "Pope Francis",
    "2015-05-24",
    "Pope Francis's encyclical on care for our common home. Diagnoses the ecological and human crisis of our time, presents the Catholic doctrine of creation, and calls for an 'integral ecology' that joins concern for the environment to concern for the poor and for the dignity of every human person.",
    [
      "What is happening to our common home",
      "The Gospel of creation",
      "The human roots of the ecological crisis",
      "Integral ecology",
      "Lines of approach and action",
      "Ecological education and spirituality",
    ],
    "https://www.vatican.va/content/francesco/en/encyclicals/documents/papa-francesco_20150524_enciclica-laudato-si.html",
  ),
  doc(
    "evangelii-gaudium",
    "Evangelii Gaudium",
    "apostolic_exhortation",
    "Pope Francis",
    "2013-11-24",
    "Pope Francis's programmatic apostolic exhortation on the Church's mission of evangelization. Calls for missionary disciples who go out to the peripheries with joy and proclaim Jesus Christ.",
    [
      "The joy of the Gospel",
      "Missionary transformation of the Church",
      "Pastoral activity and conversion",
      "The proclamation of the Gospel",
      "Social dimension of evangelization",
    ],
    "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20131124_evangelii-gaudium.html",
  ),
];
