import type { CuratedEntry } from "../index";

/**
 * Curated CHURCH_DOCUMENT entries, group two: the modern papal magisterium
 * from John Paul II to Leo XIV, the doctrinal and liturgical instructions and
 * declarations of the Holy See's dicasteries, and the two codes of canon law
 * together with the Compendium of the Catechism.
 *
 * `church-documents.ts` already carries the Vatican II constitutions and the
 * social encyclicals; `church-history.ts` carries the twenty-one ecumenical
 * councils. This file fills the stretch of the timeline that a Catholic today
 * is most likely to be handed a reference to — Familiaris Consortio, the 1983
 * Code, Ordinatio Sacerdotalis, Summorum Pontificum, Amoris Laetitia,
 * Traditionis Custodes, Dignitas Infinita — so a reader who meets one of
 * these names in a homily or a catechesis can find out what it actually is.
 *
 * Every `canonicalUrl` here was fetched and confirmed to resolve on
 * vatican.va, and every `issuedDate` is the date the document itself carries
 * in its own dateline (which is not always the date embedded in the Vatican
 * URL — Dies Domini, for one, is dated 31 May 1998 under a `05071998` path).
 */

type DocumentType =
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
  | "uscb_pastoral_letter"
  | "papal_bull"
  | "code_of_canon_law";

interface DocInput {
  slug: string;
  title: string;
  documentType: DocumentType;
  issuingAuthority: string;
  issuedDate: string;
  summary: string;
  keyThemes: string[];
  canonicalUrl: string;
  bodyExcerpt?: string;
  relatedDocuments?: string[];
  extraCitations?: string[];
}

function doc(input: DocInput): CuratedEntry {
  const citations = [input.canonicalUrl, ...(input.extraCitations ?? [])];
  return {
    contentType: "CHURCH_DOCUMENT",
    slug: input.slug,
    authorityLevel: "VATICAN",
    citations,
    payload: {
      slug: input.slug,
      title: input.title,
      documentType: input.documentType,
      issuingAuthority: input.issuingAuthority,
      issuedDate: input.issuedDate,
      summary: input.summary,
      keyThemes: input.keyThemes,
      canonicalUrl: input.canonicalUrl,
      ...(input.bodyExcerpt ? { bodyExcerpt: input.bodyExcerpt } : {}),
      relatedDocuments: input.relatedDocuments ?? [],
      citations,
    },
  };
}

export const churchDocumentGroupTwo: CuratedEntry[] = [
  // ---------------------------------------------------------------- John Paul II
  doc({
    slug: "laborem-exercens",
    title: "Laborem Exercens",
    documentType: "encyclical",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1981-09-14",
    summary:
      "Written for the ninetieth anniversary of Rerum Novarum, this encyclical on human work argues that work is not first an economic quantity but an activity of the person: because the worker is a subject made in God's image, labour has priority over capital and no economic system may treat the worker as an instrument. John Paul II examines work in the book of Genesis, the conflict between labour and capital, the rights of workers (just wage, rest, association in unions, the situation of the disabled and of emigrants), and closes with a spirituality of work rooted in Christ the carpenter and in the Cross.",
    keyThemes: [
      "The dignity of human work",
      "The priority of labour over capital",
      "The subjective dimension of work",
      "The rights of workers and the just wage",
      "A spirituality of work",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_14091981_laborem-exercens.html",
    relatedDocuments: ["rerum-novarum", "quadragesimo-anno", "centesimus-annus", "gaudium-et-spes"],
  }),
  doc({
    slug: "familiaris-consortio",
    title: "Familiaris Consortio",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1981-11-22",
    summary:
      "The post-synodal apostolic exhortation on the role of the Christian family in the modern world, issued after the 1980 Synod of Bishops. It is arranged in four parts: the lights and shadows of family life today, God's plan for marriage and the family, the four tasks of the family (forming a community of persons, serving life, sharing in the development of society, and sharing in the life and mission of the Church), and the pastoral care of the family. It confirms the teaching of Humanae Vitae on the unitive and procreative meaning of conjugal love, treats the family as the domestic church, and gives careful pastoral direction for difficult situations.",
    keyThemes: [
      "God's plan for marriage and the family",
      "The family as a communion of persons",
      "The family at the service of life",
      "The domestic church",
      "Pastoral care of families in difficulty",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_19811122_familiaris-consortio.html",
    relatedDocuments: ["humanae-vitae", "gaudium-et-spes", "casti-connubii"],
  }),
  doc({
    slug: "salvifici-doloris",
    title: "Salvifici Doloris",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1984-02-11",
    summary:
      "An apostolic letter on the Christian meaning of human suffering, given on the World Day of the Sick during the Holy Year of the Redemption. Taking as its text Saint Paul's words about completing in his flesh what is lacking in the sufferings of Christ, it moves through the world of human suffering, the problem raised by suffering in the Book of Job, the Cross as the answer God gives not in words but in his Son, the sharing of the Christian in Christ's redemptive suffering, and the parable of the Good Samaritan as the summons to those who stand beside the one who suffers.",
    keyThemes: [
      "The Christian meaning of suffering",
      "The Book of Job and the mystery of innocent suffering",
      "Suffering united to the Cross of Christ",
      "Sharing in the redemption",
      "The Gospel of the Good Samaritan",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1984/documents/hf_jp-ii_apl_11021984_salvifici-doloris.html",
    bodyExcerpt:
      'Suffering seems to belong to man\'s transcendence: it is one of those points in which man is in a certain sense "destined" to go beyond himself, and he is called to this in a mysterious way.',
    relatedDocuments: ["redemptor-hominis", "dives-in-misericordia"],
  }),
  doc({
    slug: "reconciliatio-et-paenitentia",
    title: "Reconciliatio et Paenitentia",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1984-12-02",
    summary:
      "The post-synodal apostolic exhortation on reconciliation and penance in the mission of the Church today, following the 1983 Synod of Bishops. Its three parts treat conversion and reconciliation as the Church's own work, the mystery of sin — including the distinction between mortal and venial sin and the careful correction of the notion of merely 'social' or structural sin — and the means by which the Church acts: catechesis, penance, and above all the sacrament of Penance. It insists on the enduring value of individual and integral confession as the ordinary way of reconciling the baptised with God and the Church.",
    keyThemes: [
      "Conversion and reconciliation",
      "The mystery of sin",
      "Mortal and venial sin",
      "The sacrament of Penance",
      "Individual and integral confession",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_02121984_reconciliatio-et-paenitentia.html",
    relatedDocuments: ["dives-in-misericordia", "catechism-of-the-catholic-church"],
  }),
  doc({
    slug: "sollicitudo-rei-socialis",
    title: "Sollicitudo Rei Socialis",
    documentType: "encyclical",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1987-12-30",
    summary:
      "Issued for the twentieth anniversary of Populorum Progressio, this social encyclical reads the state of development in the world and finds it worse, not better: a widening gap between North and South, an arms race, and two opposed ideological blocs. Against a purely economic idea of progress it sets authentic integral human development, ordered to the whole person and to every person. It names the 'structures of sin' that flow from the desire for profit and the thirst for power, and answers them with solidarity — not vague compassion but the firm and persevering determination to commit oneself to the common good.",
    keyThemes: [
      "Authentic integral human development",
      "Structures of sin",
      "Solidarity as a moral virtue",
      "The preferential option for the poor",
      "The universal destination of goods",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_30121987_sollicitudo-rei-socialis.html",
    relatedDocuments: ["populorum-progressio", "centesimus-annus", "laborem-exercens"],
  }),
  doc({
    slug: "mulieris-dignitatem",
    title: "Mulieris Dignitatem",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1988-08-15",
    summary:
      "An apostolic letter on the dignity and vocation of women, written during the Marian Year. It begins from Mary, the woman in whom God's plan for humanity is revealed, then reads the creation accounts to show man and woman as equally the image of God and made for a communion of persons, and traces the wound that sin inflicts on that communion. It treats the way Jesus dealt with women in the Gospels, the two vocations of virginity and motherhood, and the nuptial imagery by which Scripture speaks of Christ and the Church, concluding with the 'feminine genius' the Church needs.",
    keyThemes: [
      "The dignity and vocation of women",
      "Mary, woman and mother",
      "Man and woman created in the image of God",
      "Virginity and motherhood",
      "The nuptial mystery of Christ and the Church",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1988/documents/hf_jp-ii_apl_19880815_mulieris-dignitatem.html",
    relatedDocuments: ["redemptoris-mater", "gaudium-et-spes", "ordinatio-sacerdotalis"],
  }),
  doc({
    slug: "christifideles-laici",
    title: "Christifideles Laici",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1988-12-30",
    summary:
      "The post-synodal apostolic exhortation on the vocation and mission of the lay faithful in the Church and in the world, following the 1987 Synod of Bishops. Structured on the parable of the labourers in the vineyard, it presents the lay faithful in the mystery of the Church as sharers by baptism in Christ's priestly, prophetic and kingly office; describes the parish and the associations of the faithful as places of communion; sets out the secular character of the lay vocation as the sanctification of temporal realities; and treats the particular gifts of women, young people, the sick and the elderly, closing with a call to formation.",
    keyThemes: [
      "The vocation and mission of the laity",
      "Baptismal sharing in the priestly, prophetic and kingly office of Christ",
      "The secular character of the lay vocation",
      "Communion in parish and association",
      "Formation of the lay faithful",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_30121988_christifideles-laici.html",
    relatedDocuments: ["lumen-gentium", "gaudium-et-spes"],
  }),
  doc({
    slug: "ex-corde-ecclesiae",
    title: "Ex Corde Ecclesiae",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1990-08-15",
    summary:
      "The apostolic constitution on Catholic universities, which are born, as its opening words say, from the heart of the Church. The first part sets out the identity and mission of a Catholic university: the search for truth in every discipline, the dialogue between faith and reason, the integration of knowledge, and pastoral ministry and cultural dialogue as part of its service to the Church and to society. The second part gives general norms on the university's Catholic character, its statutes, the responsibilities of theologians who teach in the name of the Church, and its relationship with ecclesiastical authority.",
    keyThemes: [
      "The identity and mission of a Catholic university",
      "Faith and reason in the search for truth",
      "The integration of knowledge",
      "Service to the Church and to culture",
      "Norms for the Catholic character of universities",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_constitutions/documents/hf_jp-ii_apc_15081990_ex-corde-ecclesiae.html",
    relatedDocuments: ["fides-et-ratio", "aeterni-patris"],
  }),
  doc({
    slug: "fidei-depositum",
    title: "Fidei Depositum",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1992-10-11",
    summary:
      "The apostolic constitution by which John Paul II promulgated the Catechism of the Catholic Church, published on the thirtieth anniversary of the opening of the Second Vatican Council. It recounts the 1985 Extraordinary Synod's request for a compendium of doctrine, the six years of work by the commission of cardinals and bishops and the worldwide consultation of the episcopate, and explains the Catechism's four-part structure. It declares the Catechism a sure norm for teaching the faith and a valid and legitimate instrument for ecclesial communion, offered to the pastors and faithful of the whole Church.",
    keyThemes: [
      "Promulgation of the Catechism of the Catholic Church",
      "A sure norm for teaching the faith",
      "The four pillars of catechesis",
      "The deposit of faith",
      "Service to ecclesial communion",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_constitutions/documents/hf_jp-ii_apc_19921011_fidei-depositum.html",
    relatedDocuments: [
      "catechism-of-the-catholic-church",
      "compendium-of-the-catechism-of-the-catholic-church",
      "second-vatican-council",
    ],
  }),
  doc({
    slug: "ordinatio-sacerdotalis",
    title: "Ordinatio Sacerdotalis",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1994-05-22",
    summary:
      "A brief apostolic letter to the bishops of the Catholic Church on reserving priestly ordination to men alone. It rehearses the constant tradition: that Christ chose the Twelve from among men, that the Apostles did otherwise, that the Church has always so understood herself, and that this is a matter not of the dignity of women — which the same pontificate had defended at length — but of the Church's lack of authority over the form Christ himself gave to the ministerial priesthood. It closes with a formal declaration that this judgment is to be definitively held by all the faithful.",
    keyThemes: [
      "The ministerial priesthood",
      "The choice of the Twelve",
      "The constant tradition of the Church",
      "The limits of the Church's authority",
      "A judgment to be definitively held",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1994/documents/hf_jp-ii_apl_19940522_ordinatio-sacerdotalis.html",
    bodyExcerpt:
      "I declare that the Church has no authority whatsoever to confer priestly ordination on women and that this judgment is to be definitively held by all the Church's faithful.",
    relatedDocuments: ["mulieris-dignitatem", "lumen-gentium"],
  }),
  doc({
    slug: "vita-consecrata",
    title: "Vita Consecrata",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1996-03-25",
    summary:
      "The post-synodal apostolic exhortation on the consecrated life and its mission in the Church and in the world, following the 1994 Synod of Bishops. Its three chapters are built on the Transfiguration: consecration as a confession of the Trinity, communion as a sign of fraternal life in the Church, and mission as service to God and humanity. It treats the evangelical counsels of chastity, poverty and obedience as a living memorial of Christ's own way of life, surveys the forms of consecrated life from monasticism to secular institutes and new communities, and calls religious to prophetic witness, formation and fidelity.",
    keyThemes: [
      "The consecrated life as a gift to the Church",
      "The evangelical counsels",
      "Consecration, communion and mission",
      "Forms of consecrated life",
      "Prophetic witness and formation",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_25031996_vita-consecrata.html",
    relatedDocuments: ["lumen-gentium", "redemptoris-missio"],
  }),
  doc({
    slug: "dies-domini",
    title: "Dies Domini",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1998-05-31",
    summary:
      "An apostolic letter on keeping the Lord's Day holy, given on Pentecost 1998 in preparation for the Great Jubilee. It gathers five names for Sunday and gives a chapter to each: Dies Domini, the day of the Lord as the day of creation; Dies Christi, the day of the risen Lord and of the gift of the Spirit; Dies Ecclesiae, the day of the eucharistic assembly, where the Sunday obligation is explained as the response of a people gathered by the Lord; Dies Hominis, the day of rest, joy, solidarity and works of mercy; and Dies Dierum, Sunday as the primordial feast that reveals the meaning of time.",
    keyThemes: [
      "The Lord's Day",
      "Sunday as the weekly Easter",
      "The Sunday eucharistic assembly",
      "Rest, joy and works of mercy",
      "Sunday and the sanctification of time",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1998/documents/hf_jp-ii_apl_05071998_dies-domini.html",
    relatedDocuments: ["sacrosanctum-concilium", "ecclesia-de-eucharistia"],
  }),
  doc({
    slug: "ecclesia-in-america",
    title: "Ecclesia in America",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1999-01-22",
    summary:
      "The post-synodal apostolic exhortation given at the Basilica of Our Lady of Guadalupe in Mexico City after the 1997 Special Assembly for America, which deliberately treated the continent as one America rather than two. Organised around the theme of encounter with the living Jesus Christ as the way to conversion, communion and solidarity, it reviews the lights and shadows of the Church in America, calls for a new evangelisation, and addresses the social realities of the hemisphere — poverty, foreign debt, corruption, the drug trade, migration and the rights of indigenous peoples — while proposing Our Lady of Guadalupe as patroness of all America.",
    keyThemes: [
      "Encounter with the living Jesus Christ",
      "Conversion, communion and solidarity",
      "The new evangelisation in America",
      "Solidarity with the poor of the continent",
      "Our Lady of Guadalupe, patroness of America",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_22011999_ecclesia-in-america.html",
    relatedDocuments: ["redemptoris-missio", "sollicitudo-rei-socialis"],
  }),
  doc({
    slug: "novo-millennio-ineunte",
    title: "Novo Millennio Ineunte",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "2001-01-06",
    summary:
      "The apostolic letter written at the close of the Great Jubilee of the Year 2000, given as the Holy Door of Saint Peter's was sealed. It looks back on the graces of the Jubilee, contemplates the face of Christ crucified and risen, and then sets a programme for the new millennium that is not a new strategy but holiness: 'Duc in altum', put out into the deep. It calls for a genuine training in prayer, Sunday Eucharist, the sacrament of Reconciliation, the primacy of grace, listening to the word and proclaiming it, and for a spirituality of communion lived in concrete charity toward the poor.",
    keyThemes: [
      "Duc in altum — putting out into the deep",
      "The universal call to holiness",
      "A training in prayer",
      "The spirituality of communion",
      "Charity as the witness of the new millennium",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2001/documents/hf_jp-ii_apl_20010106_novo-millennio-ineunte.html",
    relatedDocuments: ["rosarium-virginis-mariae", "ecclesia-de-eucharistia", "lumen-gentium"],
  }),
  doc({
    slug: "rosarium-virginis-mariae",
    title: "Rosarium Virginis Mariae",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "2002-10-16",
    summary:
      "The apostolic letter on the Most Holy Rosary, which opened the Year of the Rosary at the beginning of the twenty-fifth year of John Paul II's pontificate. It presents the Rosary as a Christ-centred and contemplative prayer, a compendium of the Gospel prayed in Mary's company and at her school. Its best known contribution is the proposal of five new mysteries of light — the Baptism in the Jordan, the wedding at Cana, the proclamation of the Kingdom, the Transfiguration, and the institution of the Eucharist — and it also gives practical guidance on how to pray the beads well and commends the Rosary for peace and for the family.",
    keyThemes: [
      "The Rosary as a compendium of the Gospel",
      "Contemplating the face of Christ with Mary",
      "The Luminous Mysteries",
      "How to pray the Rosary well",
      "The Rosary for peace and for the family",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html",
    relatedDocuments: ["novo-millennio-ineunte", "redemptoris-mater"],
  }),
  doc({
    slug: "code-of-canon-law-1983",
    title: "Code of Canon Law (1983)",
    documentType: "code_of_canon_law",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1983-01-25",
    summary:
      "The Codex Iuris Canonici for the Latin Church, promulgated by John Paul II with the apostolic constitution Sacrae Disciplinae Leges on 25 January 1983 and in force from the following First Sunday of Advent. It replaces the 1917 Code and translates the ecclesiology of the Second Vatican Council into law across seven books: General Norms; The People of God; The Teaching Office of the Church; The Sanctifying Office of the Church; The Temporal Goods of the Church; Sanctions in the Church; and Processes. It governs the Latin Church alone; the Eastern Catholic Churches have their own code.",
    keyThemes: [
      "The law of the Latin Church",
      "Vatican II ecclesiology translated into law",
      "The rights and obligations of the faithful",
      "The sacraments and the sanctifying office",
      "Governance, sanctions and processes",
    ],
    canonicalUrl: "https://www.vatican.va/archive/cod-iuris-canonici/cic_index_en.html",
    bodyExcerpt:
      "the Code is in no way intended as a substitute for faith, grace and the charisms in the life of the Church and of the faithful.",
    relatedDocuments: [
      "code-of-canons-of-the-eastern-churches",
      "lumen-gentium",
      "second-vatican-council",
    ],
    extraCitations: [
      "https://www.vatican.va/content/john-paul-ii/en/apost_constitutions/documents/hf_jp-ii_apc_25011983_sacrae-disciplinae-leges.html",
    ],
  }),
  doc({
    slug: "code-of-canons-of-the-eastern-churches",
    title: "Code of Canons of the Eastern Churches (1990)",
    documentType: "code_of_canon_law",
    issuingAuthority: "Pope John Paul II",
    issuedDate: "1990-10-18",
    summary:
      "The Codex Canonum Ecclesiarum Orientalium, promulgated by John Paul II with the apostolic constitution Sacri Canones on 18 October 1990 and in force from 1 October 1991. It is the first common code for all the Eastern Catholic Churches, drawn from the ancient canonical patrimony of the Eastern traditions and completing, with the 1983 Latin Code, the codification of the Church's law. Its thirty titles cover the rights and obligations of the Christian faithful, patriarchal and major archiepiscopal Churches, eparchies, the sacraments of Christian initiation given together, monks and other religious, ecumenism, sanctions and procedures.",
    keyThemes: [
      "Law of the Eastern Catholic Churches",
      "The canonical patrimony of the East",
      "Patriarchal and major archiepiscopal Churches",
      "Eastern sacramental discipline",
      "Communion between East and West",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-paul-ii/en/apost_constitutions/documents/hf_jp-ii_apc_19901018_sacri-canones.html",
    relatedDocuments: ["code-of-canon-law-1983", "lumen-gentium"],
  }),

  // ---------------------------------------------------------------- Benedict XVI
  doc({
    slug: "compendium-of-the-catechism-of-the-catholic-church",
    title: "Compendium of the Catechism of the Catholic Church",
    documentType: "catechism_section",
    issuingAuthority: "Pope Benedict XVI",
    issuedDate: "2005-06-28",
    summary:
      "A faithful and certain synthesis of the Catechism of the Catholic Church, requested by John Paul II and approved and published by Benedict XVI with a motu proprio given on 28 June 2005. It follows the same four parts as the Catechism — the profession of faith, the celebration of the Christian mystery, life in Christ, and Christian prayer — but presents them in 598 questions and answers, with cross-references to the corresponding paragraphs of the Catechism. Sacred images introduce each part, and appendices gather the common prayers and a set of formulas of Catholic doctrine for memorisation.",
    keyThemes: [
      "A synthesis of the Catechism",
      "Question-and-answer catechesis",
      "The four pillars of the faith",
      "Common prayers and formulas of doctrine",
      "Sacred images in catechesis",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/compendium_ccc/documents/archive_2005_compendium-ccc_en.html",
    relatedDocuments: ["catechism-of-the-catholic-church", "fidei-depositum"],
  }),
  doc({
    slug: "sacramentum-caritatis",
    title: "Sacramentum Caritatis",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Benedict XVI",
    issuedDate: "2007-02-22",
    summary:
      "The post-synodal apostolic exhortation on the Eucharist as the source and summit of the Church's life and mission, following the 2005 Synod of Bishops that closed the Year of the Eucharist. It is built on three headings drawn from the Synod: the Eucharist as a mystery to be believed, treating the Trinitarian and ecclesial faith of the Church; a mystery to be celebrated, on the ars celebrandi, active participation, sacred music, silence and the liturgical books; and a mystery to be lived, on eucharistic consistency in moral and social life. It also treats eucharistic adoration, Sunday, and the discipline of communion.",
    keyThemes: [
      "The Eucharist as source and summit",
      "The ars celebrandi",
      "Active participation in the liturgy",
      "Eucharistic adoration",
      "Eucharistic consistency in Christian life",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20070222_sacramentum-caritatis.html",
    relatedDocuments: ["ecclesia-de-eucharistia", "sacrosanctum-concilium", "mysterium-fidei"],
  }),
  doc({
    slug: "summorum-pontificum",
    title: "Summorum Pontificum",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Benedict XVI",
    issuedDate: "2007-07-07",
    summary:
      "The apostolic letter given motu proprio on the use of the Roman liturgy prior to the reform of 1970, accompanied by a letter to the bishops of the world explaining the pope's reasons. It declared that the Roman Missal promulgated by Paul VI is the ordinary expression of the lex orandi of the Roman Rite and that the Missal of 1962 is to be regarded as an extraordinary expression of the same lex orandi, never abrogated; it permitted priests to celebrate with the older Missal without special permission and set out how stable groups of the faithful might request it in parishes.",
    keyThemes: [
      "The Roman liturgy prior to the reform of 1970",
      "Ordinary and extraordinary expressions of the lex orandi",
      "The Missal of 1962",
      "Pastoral provision for stable groups",
      "Liturgical continuity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xvi/en/motu_proprio/documents/hf_ben-xvi_motu-proprio_20070707_summorum-pontificum.html",
    relatedDocuments: ["sacrosanctum-concilium", "traditionis-custodes"],
  }),
  doc({
    slug: "anglicanorum-coetibus",
    title: "Anglicanorum Coetibus",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Benedict XVI",
    issuedDate: "2009-11-04",
    summary:
      "The apostolic constitution providing for personal ordinariates for Anglicans entering into full communion with the Catholic Church, issued in response to repeated petitions from groups of Anglican clergy and faithful. It establishes a canonical structure — the personal ordinariate, juridically comparable to a diocese — within which former Anglicans may be received corporately while retaining elements of the Anglican patrimony of liturgy, spirituality and pastoral practice that are consonant with Catholic faith. Complementary norms issued with it govern the ordinary, the admission of married former Anglican clergy to Catholic ordination, and the formation of seminarians.",
    keyThemes: [
      "Personal ordinariates",
      "Corporate reunion with the Catholic Church",
      "The Anglican patrimony",
      "Christian unity",
      "Norms for clergy and formation",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xvi/en/apost_constitutions/documents/hf_ben-xvi_apc_20091104_anglicanorum-coetibus.html",
    relatedDocuments: ["unitatis-redintegratio", "ut-unum-sint", "code-of-canon-law-1983"],
  }),
  doc({
    slug: "verbum-domini",
    title: "Verbum Domini",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Benedict XVI",
    issuedDate: "2010-09-30",
    summary:
      "The post-synodal apostolic exhortation on the word of God in the life and mission of the Church, following the 2008 Synod of Bishops and given on the memorial of Saint Jerome. Its three parts are Verbum Dei, on the God who speaks and the human response of faith, with Mary as the model hearer; Verbum in Ecclesia, on Scripture in the liturgy, the homily, lectio divina, and the relationship of exegesis and theology; and Verbum Mundo, on the Church's mission to proclaim the word to the world, in dialogue with culture, in commitment to justice, and in the care of creation.",
    keyThemes: [
      "The God who speaks and the response of faith",
      "Scripture and Tradition",
      "The word of God in the liturgy",
      "Lectio divina",
      "Proclaiming the word to the world",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20100930_verbum-domini.html",
    relatedDocuments: ["dei-verbum", "divino-afflante-spiritu", "providentissimus-deus"],
  }),
  doc({
    slug: "porta-fidei",
    title: "Porta Fidei",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Benedict XVI",
    issuedDate: "2011-10-11",
    summary:
      "The apostolic letter given motu proprio by which Benedict XVI announced a Year of Faith, to run from 11 October 2012 — the fiftieth anniversary of the opening of the Second Vatican Council and the twentieth of the publication of the Catechism — to the Solemnity of Christ the King in 2013. Taking its title from the Acts of the Apostles' 'door of faith', it calls for a rediscovery of the journey of faith, a renewed reading of the Council's documents and of the Catechism, a profession of the Creed, and a faith that works through charity, so that the new evangelisation may be rooted in conversion.",
    keyThemes: [
      "The Year of Faith",
      "The door of faith",
      "Rereading the Second Vatican Council",
      "The Catechism as a tool for the new evangelisation",
      "Faith working through charity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xvi/en/motu_proprio/documents/hf_ben-xvi_motu-proprio_20111011_porta-fidei.html",
    relatedDocuments: ["catechism-of-the-catholic-church", "second-vatican-council", "lumen-fidei"],
  }),
  doc({
    slug: "africae-munus",
    title: "Africae Munus",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Benedict XVI",
    issuedDate: "2011-11-19",
    summary:
      "The post-synodal apostolic exhortation on the Church in Africa in service to reconciliation, justice and peace, signed at Ouidah in Benin after the 2009 Second Special Assembly for Africa. Its first part treats the theological and spiritual foundations: conversion, the sacrament of Reconciliation, the family, the dignity of women, and the Church as the family of God on the continent. The second part turns to the concrete tasks of the members of the Church — bishops, priests, catechists, the lay faithful — and to the fields of action: governance and civil society, health care, education, communications, and dialogue with Islam and with traditional African religion.",
    keyThemes: [
      "Reconciliation, justice and peace",
      "The Church as the family of God in Africa",
      "Conversion and the sacrament of Reconciliation",
      "Education, health care and communications",
      "Interreligious dialogue in Africa",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20111119_africae-munus.html",
    relatedDocuments: ["caritas-in-veritate", "redemptoris-missio", "nostra-aetate"],
  }),

  // ---------------------------------------------------------------- Francis
  doc({
    slug: "lumen-fidei",
    title: "Lumen Fidei",
    documentType: "encyclical",
    issuingAuthority: "Pope Francis",
    issuedDate: "2013-06-29",
    summary:
      "The first encyclical of Pope Francis, completing a text substantially drafted by Benedict XVI and so, as Francis says, the work of four hands. It sets out to recover faith as light rather than as a leap in the dark. Four chapters trace the faith of Abraham and Israel fulfilled in Christ, the bond of faith with truth and love against the reduction of faith to private feeling, the ecclesial transmission of faith through the sacraments, the Creed, prayer and the Decalogue, and the way faith builds up the common good — the family, society, consolation in suffering.",
    keyThemes: [
      "Faith as light",
      "Faith and truth",
      "The ecclesial transmission of faith",
      "The sacraments and the Creed",
      "Faith and the common good",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/encyclicals/documents/papa-francesco_20130629_enciclica-lumen-fidei.html",
    relatedDocuments: ["porta-fidei", "fides-et-ratio", "deus-caritas-est", "spe-salvi"],
  }),
  doc({
    slug: "misericordiae-vultus",
    title: "Misericordiae Vultus",
    documentType: "papal_bull",
    issuingAuthority: "Pope Francis",
    issuedDate: "2015-04-11",
    summary:
      "The bull of indiction of the Extraordinary Jubilee of Mercy, given on the vigil of Divine Mercy Sunday and proclaiming a Holy Year from 8 December 2015 to 20 November 2016. It opens by naming Jesus Christ the face of the Father's mercy, then sets out the biblical vocabulary of mercy, the practices proposed for the Year — pilgrimage through the Holy Doors, the corporal and spiritual works of mercy, the mission of the Missionaries of Mercy, the '24 Hours for the Lord' — and the relation of mercy to justice, ending with a plea that the Church's language and action be shaped by mercy.",
    keyThemes: [
      "Jesus Christ, the face of the Father's mercy",
      "The Extraordinary Jubilee of Mercy",
      "The Holy Door and pilgrimage",
      "The corporal and spiritual works of mercy",
      "Mercy and justice",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/bulls/documents/papa-francesco_bolla_20150411_misericordiae-vultus.html",
    relatedDocuments: ["dives-in-misericordia", "evangelii-gaudium"],
  }),
  doc({
    slug: "amoris-laetitia",
    title: "Amoris Laetitia",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Francis",
    issuedDate: "2016-03-19",
    summary:
      "The post-synodal apostolic exhortation on love in the family, gathering the work of the two Synods of Bishops of 2014 and 2015. Its nine chapters move from the Scriptures on the family, through the realities and challenges families face today, to the Church's teaching on marriage as an indissoluble covenant open to life. Chapter four is an extended meditation on Saint Paul's hymn to charity applied to married love; later chapters treat the education of children, pastoral perspectives on preparation for marriage and on accompanying couples in the first years, a spirituality of the family, and the accompaniment, discernment and integration of those in irregular situations.",
    keyThemes: [
      "The joy of love in the family",
      "Marriage as covenant and sacrament",
      "The hymn to charity lived in marriage",
      "The education of children",
      "Accompaniment, discernment and integration",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20160319_amoris-laetitia.html",
    relatedDocuments: ["familiaris-consortio", "humanae-vitae", "evangelii-gaudium"],
  }),
  doc({
    slug: "gaudete-et-exsultate",
    title: "Gaudete et Exsultate",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Francis",
    issuedDate: "2018-03-19",
    summary:
      "An apostolic exhortation on the call to holiness in today's world, offered not as a treatise but as a way of reproposing the universal call to holiness in a practical key. Its five chapters treat the saints next door and holiness lived in ordinary circumstances; two subtle enemies of holiness, the contemporary forms of gnosticism and pelagianism; the Beatitudes and Matthew 25 as the great criterion of a holy life; five marks of holiness in the modern world — perseverance, joy, boldness, community and constant prayer; and the necessity of spiritual combat, vigilance and discernment.",
    keyThemes: [
      "The universal call to holiness",
      "The saints next door",
      "Gnosticism and pelagianism as enemies of holiness",
      "The Beatitudes as the great criterion",
      "Spiritual combat and discernment",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20180319_gaudete-et-exsultate.html",
    relatedDocuments: ["lumen-gentium", "novo-millennio-ineunte", "evangelii-gaudium"],
  }),
  doc({
    slug: "christus-vivit",
    title: "Christus Vivit",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Francis",
    issuedDate: "2019-03-25",
    summary:
      "The post-synodal apostolic exhortation to young people and to the entire People of God, following the 2018 Synod of Bishops on young people, faith and vocational discernment, and signed at the shrine of Loreto. Its nine chapters begin with what the word of God says about the young, present Jesus as forever young and the Church's youth, listen to the situation of young people today, and then proclaim three great truths: God loves you, Christ saves you, he is alive. The later chapters treat youth ministry, roots and the elderly, vocation as a call to love and to work, and discernment.",
    keyThemes: [
      "God loves you, Christ saves you, he is alive",
      "Young people in the word of God",
      "Youth ministry and accompaniment",
      "Roots, memory and the elderly",
      "Vocation and discernment",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20190325_christus-vivit.html",
    relatedDocuments: ["gaudete-et-exsultate", "evangelii-gaudium"],
  }),
  doc({
    slug: "vos-estis-lux-mundi",
    title: "Vos Estis Lux Mundi",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Francis",
    issuedDate: "2019-05-07",
    summary:
      "The apostolic letter given motu proprio establishing universal Church procedures for reporting and investigating the sexual abuse of minors and vulnerable persons, and the conduct of bishops and religious superiors who cover such crimes up. It requires every diocese to have a public and accessible system for receiving reports, obliges clerics and religious to report allegations to the competent ecclesiastical authority, protects those who report from retaliation and from any obligation of silence, and sets out how the metropolitan or another designated bishop investigates a bishop, with time limits and reporting to the Holy See. Its provisions were revised and confirmed in 2023.",
    keyThemes: [
      "Protection of minors and vulnerable persons",
      "Obligation to report allegations",
      "Accountability of bishops and religious superiors",
      "Diocesan reporting systems",
      "Care for victims",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/motu_proprio/documents/papa-francesco-motu-proprio-20190507_vos-estis-lux-mundi.html",
    relatedDocuments: ["code-of-canon-law-1983"],
  }),
  doc({
    slug: "admirabile-signum",
    title: "Admirabile Signum",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Francis",
    issuedDate: "2019-12-01",
    summary:
      "A short apostolic letter on the meaning and importance of the nativity scene, signed at Greccio, where Saint Francis of Assisi made the first crib in 1223. It recounts that night as Thomas of Celano describes it, and then walks through the figures of the presepe one by one — the starry sky and the night, the ruins and the landscape, the shepherds and the poor, the angels and the star, the figures of daily work, Mary and Joseph, and finally the Child laid in the manger — explaining what each says about the Incarnation, and encouraging the custom in homes, workplaces and public places.",
    keyThemes: [
      "The nativity scene",
      "Greccio and Saint Francis of Assisi",
      "The Incarnation made visible",
      "The poor and the shepherds",
      "A family custom of popular piety",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20191201_admirabile-signum.html",
    relatedDocuments: ["patris-corde"],
  }),
  doc({
    slug: "querida-amazonia",
    title: "Querida Amazonia",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Francis",
    issuedDate: "2020-02-02",
    summary:
      "The post-synodal apostolic exhortation to the People of God and to all persons of good will, following the 2019 Special Assembly for the Pan-Amazon Region. Rather than repeat the Synod's final document, which he formally presents alongside it, Francis offers four dreams for the Amazon: a social dream of a region where the rights of the poorest and of the indigenous peoples are defended; a cultural dream of preserving the region's distinctive human richness; an ecological dream of protecting the natural beauty entrusted to it; and an ecclesial dream of Christian communities with an Amazonian face, with inculturated liturgy and catechesis and a strengthened role for lay ministry and for women.",
    keyThemes: [
      "The rights of indigenous peoples",
      "Integral ecology in the Amazon",
      "Inculturation of the faith",
      "Communities with an Amazonian face",
      "The role of the laity and of women in mission",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20200202_querida-amazonia.html",
    relatedDocuments: ["laudato-si", "evangelii-gaudium"],
  }),
  doc({
    slug: "patris-corde",
    title: "Patris Corde",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Francis",
    issuedDate: "2020-12-08",
    summary:
      "The apostolic letter marking the 150th anniversary of the proclamation of Saint Joseph as patron of the universal Church, which also opened a Year of Saint Joseph. Written in the first year of the COVID-19 pandemic and dedicated to the hidden people who quietly carry others through a crisis, it contemplates Joseph under seven headings: a beloved father, a tender and loving father, an obedient father, an accepting father, a creatively courageous father, a working father, and a father in the shadows. It closes with a prayer to Saint Joseph and a note on the plenary indulgences granted for the Year.",
    keyThemes: [
      "Saint Joseph, patron of the universal Church",
      "Fatherhood in the shadows",
      "Obedience and acceptance of God's will",
      "The dignity of work",
      "The Year of Saint Joseph",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20201208_patris-corde.html",
    relatedDocuments: ["admirabile-signum"],
  }),
  doc({
    slug: "traditionis-custodes",
    title: "Traditionis Custodes",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Francis",
    issuedDate: "2021-07-16",
    summary:
      "The apostolic letter given motu proprio on the use of the Roman liturgy prior to the reform of 1970, issued with a letter to the bishops of the world explaining that it followed a consultation of the episcopate about the effects of Summorum Pontificum. In eight articles it declares that the liturgical books promulgated by Paul VI and John Paul II are the unique expression of the lex orandi of the Roman Rite, makes the diocesan bishop the sole competent authority to authorise the use of the 1962 Missal in his diocese, restricts where and by whom it may be celebrated, and directs that readings be proclaimed in the vernacular.",
    keyThemes: [
      "The lex orandi of the Roman Rite",
      "The authority of the diocesan bishop over the liturgy",
      "Use of the 1962 Missal",
      "Unity of the Roman Rite",
      "Reception of the liturgical reform of Vatican II",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/motu_proprio/documents/20210716-motu-proprio-traditionis-custodes.html",
    bodyExcerpt:
      "The liturgical books promulgated by Saint Paul VI and Saint John Paul II, in conformity with the decrees of Vatican Council II, are the unique expression of the lex orandi of the Roman Rite.",
    relatedDocuments: ["summorum-pontificum", "sacrosanctum-concilium", "desiderio-desideravi"],
  }),
  doc({
    slug: "praedicate-evangelium",
    title: "Praedicate Evangelium",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Francis",
    issuedDate: "2022-03-19",
    summary:
      "The apostolic constitution on the Roman Curia and its service to the Church and to the world, promulgated on the Solemnity of Saint Joseph and in force from Pentecost 2022. It replaces Pastor Bonus and reorganises the Curia around evangelisation: the Dicastery for Evangelisation, presided over by the pope himself, is placed first, followed by the Dicastery for the Doctrine of the Faith and the Dicastery for the Service of Charity. It renames congregations and councils uniformly as dicasteries, states that any member of the faithful may head a dicastery since governance flows from the canonical mission rather than from ordination, and stresses synodality, subsidiarity and service to the local Churches.",
    keyThemes: [
      "Reform of the Roman Curia",
      "The primacy of evangelisation",
      "Dicasteries and their competences",
      "Lay participation in Church governance",
      "Synodality and service to particular Churches",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_constitutions/documents/20220319-costituzione-ap-praedicate-evangelium.html",
    relatedDocuments: ["evangelii-gaudium", "code-of-canon-law-1983"],
  }),
  doc({
    slug: "desiderio-desideravi",
    title: "Desiderio Desideravi",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Francis",
    issuedDate: "2022-06-29",
    summary:
      "An apostolic letter to the bishops, priests, deacons, consecrated persons and lay faithful on the liturgical formation of the People of God, offered as a reflection rather than as new legislation after Traditionis Custodes. Taking its title from Christ's words at the Last Supper, it presents the liturgy as the place of encounter with the risen Lord, insists that the Council's liturgical reform is irreversible, and diagnoses the real problem as a lack of formation. It distinguishes formation for the liturgy from formation by the liturgy, treats the recovery of a capacity for symbols and for silence, and gives careful attention to the ars celebrandi.",
    keyThemes: [
      "Encounter with the risen Christ in the liturgy",
      "Liturgical formation of the whole People of God",
      "The irreversibility of the conciliar reform",
      "Recovering the capacity for symbols",
      "The ars celebrandi",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_letters/documents/20220629-lettera-ap-desiderio-desideravi.html",
    relatedDocuments: ["sacrosanctum-concilium", "traditionis-custodes", "sacramentum-caritatis"],
  }),
  doc({
    slug: "laudate-deum",
    title: "Laudate Deum",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Francis",
    issuedDate: "2023-10-04",
    summary:
      "An apostolic exhortation to all people of good will on the climate crisis, published on the memorial of Saint Francis of Assisi eight years after Laudato Si' and addressed to the situation in the run-up to the COP28 conference in Dubai. It reviews the state of the global climate and answers common objections, criticises the technocratic paradigm and the illusion of unlimited human power, calls for effective and binding multilateralism reformed 'from below', assesses the record of the climate conferences, and closes with spiritual motivations drawn from Scripture and from the Christian understanding of the human person within, not above, creation.",
    keyThemes: [
      "The global climate crisis",
      "The technocratic paradigm",
      "Multilateralism and international agreements",
      "Integral ecology",
      "Spiritual motivations for care of creation",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/20231004-laudate-deum.html",
    relatedDocuments: ["laudato-si", "fratelli-tutti"],
  }),
  doc({
    slug: "dilexit-nos",
    title: "Dilexit Nos",
    documentType: "encyclical",
    issuingAuthority: "Pope Francis",
    issuedDate: "2024-10-24",
    summary:
      "An encyclical on the human and divine love of the heart of Jesus Christ, published in the 350th anniversary year of the first apparitions to Saint Margaret Mary Alacoque at Paray-le-Monial. Its five chapters treat the importance of the heart in a fragmented age, the gestures and words of Christ's love in the Gospels, the Church's reflection on that love from the Fathers through the mystics and the great devotional tradition, the drinking from the wellspring of the pierced side in acts of reparation and consecration, and finally love that gives itself in mission and communal reparation, so that the devotion is never merely private sentiment.",
    keyThemes: [
      "The Sacred Heart of Jesus",
      "The heart as the centre of the person",
      "The love of Christ in the Gospels",
      "Reparation and consecration",
      "Devotion that overflows into mission",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/francesco/en/encyclicals/documents/20241024-enciclica-dilexit-nos.html",
    relatedDocuments: ["fratelli-tutti", "dilexi-te"],
  }),

  // ---------------------------------------------------------------- CDF / DDF / CDW
  doc({
    slug: "persona-humana",
    title: "Persona Humana",
    documentType: "declaration",
    issuingAuthority: "Congregation for the Doctrine of the Faith",
    issuedDate: "1975-12-29",
    summary:
      "A declaration on certain questions concerning sexual ethics, approved by Paul VI and issued by the Congregation for the Doctrine of the Faith at a moment of widespread confusion about the moral norms governing sexuality. It restates that the moral principles in this field flow from the finality of the sexual act within marriage and are not merely conventional; it reaffirms the immorality of sexual relations outside marriage, addresses homosexual acts while distinguishing them from the persons concerned, and treats masturbation, the formation of conscience, the necessity of grace and the virtue of chastity as a work of the Holy Spirit.",
    keyThemes: [
      "The objective moral order in sexual ethics",
      "Chastity as a virtue",
      "Marriage as the setting of the conjugal act",
      "Conscience and moral formation",
      "Grace and the Christian moral life",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19751229_persona-humana_en.html",
    relatedDocuments: ["humanae-vitae", "gaudium-et-spes", "veritatis-splendor"],
  }),
  doc({
    slug: "donum-vitae",
    title: "Donum Vitae",
    documentType: "instruction",
    issuingAuthority: "Congregation for the Doctrine of the Faith",
    issuedDate: "1987-02-22",
    summary:
      "The instruction on respect for human life in its origin and on the dignity of procreation, approved by John Paul II and issued on the Feast of the Chair of Saint Peter in answer to questions raised by the new reproductive technologies. Its three parts treat respect for human embryos, who are to be treated as persons from conception; interventions upon human procreation, distinguishing therapies that assist the conjugal act from techniques that substitute for it, and so judging in vitro fertilisation, surrogate motherhood and heterologous procedures; and the duties of civil law to protect the rights of the child, of marriage and of the family.",
    keyThemes: [
      "Respect for the human embryo from conception",
      "The dignity of procreation",
      "Artificial reproductive technologies",
      "The unity of the conjugal act",
      "The responsibility of civil law",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19870222_respect-for-human-life_en.html",
    relatedDocuments: ["evangelium-vitae", "humanae-vitae", "dignitas-personae"],
  }),
  doc({
    slug: "dominus-iesus",
    title: "Dominus Iesus",
    documentType: "declaration",
    issuingAuthority: "Congregation for the Doctrine of the Faith",
    issuedDate: "2000-08-06",
    summary:
      "The declaration on the unicity and salvific universality of Jesus Christ and the Church, ratified by John Paul II and published on the Feast of the Transfiguration during the Great Jubilee. Against relativistic theories that would treat the revelation in Christ as one among several complementary revelations, it restates the fullness and definitiveness of that revelation, the unicity of Christ's saving mediation, the inseparability of Christ and the Church, and the single Church of Christ subsisting in the Catholic Church. It affirms that God's grace can reach those outside the visible Church while insisting that whatever grace they receive comes from Christ.",
    keyThemes: [
      "The unicity of Jesus Christ as saviour",
      "The definitiveness of Christian revelation",
      "The Church of Christ subsisting in the Catholic Church",
      "Religious pluralism and relativism",
      "The necessity of the Church for salvation",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_20000806_dominus-iesus_en.html",
    relatedDocuments: ["lumen-gentium", "nostra-aetate", "redemptoris-missio", "ut-unum-sint"],
  }),
  doc({
    slug: "liturgiam-authenticam",
    title: "Liturgiam Authenticam",
    documentType: "instruction",
    issuingAuthority: "Congregation for Divine Worship and the Discipline of the Sacraments",
    issuedDate: "2001-03-28",
    summary:
      "The fifth instruction for the right implementation of the Constitution on the Sacred Liturgy of the Second Vatican Council, governing the translation of the liturgical books into vernacular languages. It replaces the earlier translation norms with a requirement that translations render the Latin editio typica integrally and exactly, preserving its distinctive vocabulary, syntax and imagery rather than paraphrasing, and it sets out the responsibilities of conferences of bishops, the process for obtaining the recognitio of the Holy See, and rules for the biblical texts, the psalter, and the preparation of new editions.",
    keyThemes: [
      "Vernacular translation of the liturgical books",
      "Fidelity to the Latin editio typica",
      "The sacred character of liturgical language",
      "The role of conferences of bishops",
      "The recognitio of the Holy See",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20010507_liturgiam-authenticam_en.html",
    relatedDocuments: ["sacrosanctum-concilium", "redemptionis-sacramentum"],
  }),
  doc({
    slug: "redemptionis-sacramentum",
    title: "Redemptionis Sacramentum",
    documentType: "instruction",
    issuingAuthority: "Congregation for Divine Worship and the Discipline of the Sacraments",
    issuedDate: "2004-03-25",
    summary:
      "An instruction on certain matters to be observed or avoided regarding the Most Holy Eucharist, prepared at the request of John Paul II in Ecclesia de Eucharistia and given on the Solemnity of the Annunciation. Its eight chapters set out the regulation of the sacred liturgy, the participation proper to the lay faithful, the celebration of Mass and its parts, the distribution and reception of Holy Communion, other aspects of eucharistic worship including reservation and adoration, extraordinary functions of the lay faithful, and remedies for abuses — listing the graviora delicta and other grave matters and the right of the faithful to a liturgy celebrated according to the books.",
    keyThemes: [
      "Right celebration of the Eucharist",
      "The roles of ministers and of the lay faithful",
      "Distribution and reception of Holy Communion",
      "Eucharistic reservation and adoration",
      "Remedies for liturgical abuses",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20040423_redemptionis-sacramentum_en.html",
    relatedDocuments: [
      "ecclesia-de-eucharistia",
      "sacrosanctum-concilium",
      "liturgiam-authenticam",
    ],
  }),
  doc({
    slug: "dignitas-personae",
    title: "Dignitas Personae",
    documentType: "instruction",
    issuingAuthority: "Congregation for the Doctrine of the Faith",
    issuedDate: "2008-09-08",
    summary:
      "An instruction on certain bioethical questions, given on the Feast of the Nativity of the Blessed Virgin Mary, which updates Donum Vitae after twenty years of new biomedical developments. Its first part restates the anthropological, theological and ethical principles: the dignity of every human being from conception, and the dignity of marriage and procreation. The second examines new techniques of assisting fertility, freezing of embryos and oocytes, embryo reduction, preimplantation diagnosis and gene therapy. The third treats proposals that make use of human embryos or of material of illicit origin, including stem-cell research, cloning, hybrids and vaccines, and the question of cooperation in evil.",
    keyThemes: [
      "The dignity of the human person from conception",
      "New techniques of assisted procreation",
      "Embryo freezing and preimplantation diagnosis",
      "Stem-cell research and cloning",
      "Cooperation in illicit research",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_20081208_dignitas-personae_en.html",
    relatedDocuments: ["donum-vitae", "evangelium-vitae"],
  }),
  doc({
    slug: "fiducia-supplicans",
    title: "Fiducia Supplicans",
    documentType: "declaration",
    issuingAuthority: "Dicastery for the Doctrine of the Faith",
    issuedDate: "2023-12-18",
    summary:
      "A declaration on the pastoral meaning of blessings, approved by Pope Francis and issued by the Dicastery for the Doctrine of the Faith. It distinguishes liturgical and ritual blessings from the spontaneous pastoral blessing that a priest may give to those who ask, and on that basis says that a blessing may be imparted to couples in irregular situations and to same-sex couples, without any ritual form, without resemblance to a marriage rite, and without validating their status. It repeats without change the Church's perennial teaching that marriage is the exclusive, indissoluble and fruitful union of one man and one woman.",
    keyThemes: [
      "The pastoral meaning of blessings",
      "Liturgical and non-liturgical blessings",
      "The unchanged doctrine of marriage",
      "Pastoral closeness without ritual form",
      "Popular piety and trust in God's mercy",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20231218_fiducia-supplicans_en.html",
    relatedDocuments: ["amoris-laetitia", "familiaris-consortio"],
  }),
  doc({
    slug: "dignitas-infinita",
    title: "Dignitas Infinita",
    documentType: "declaration",
    issuingAuthority: "Dicastery for the Doctrine of the Faith",
    issuedDate: "2024-04-02",
    summary:
      "A declaration on human dignity, five years in preparation and approved by Pope Francis, published on the nineteenth anniversary of the death of Saint John Paul II. Its first three sections trace the growing awareness of human dignity in Revelation and in the magisterium, distinguish ontological dignity — which belongs to every person inalienably — from moral, social and existential dignity, and ground it in the human person's creation in God's image and calling in Christ. The final section names thirteen grave violations of that dignity, among them poverty, war, the abuse of migrants, human trafficking, abortion, surrogacy, euthanasia, the death penalty, violence against women, and digital violence.",
    keyThemes: [
      "The infinite dignity of the human person",
      "Ontological and moral dignity",
      "Dignity in Revelation and in the magisterium",
      "Grave violations of human dignity",
      "The defence of the poor and the vulnerable",
    ],
    canonicalUrl:
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240402_dignitas-infinita_en.html",
    bodyExcerpt:
      "Every human person possesses an infinite dignity, inalienably grounded in his or her very being, which prevails in and beyond every circumstance, state, or situation the person may ever encounter.",
    relatedDocuments: ["evangelium-vitae", "fratelli-tutti", "gaudium-et-spes"],
  }),

  // ---------------------------------------------------------------- Leo XIV
  doc({
    slug: "dilexi-te",
    title: "Dilexi Te",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Leo XIV",
    issuedDate: "2025-10-04",
    summary:
      "The first apostolic exhortation of Pope Leo XIV, addressed to all Christians on love for the poor and given on the memorial of Saint Francis of Assisi in the first year of his pontificate. Leo XIV explains that Pope Francis had been preparing a document on the Church's care for the poor in the last months of his life, under this title taken from the Book of Revelation, and that he makes it his own with added reflections. Its five chapters — a few essential words, God chooses the poor, a Church for the poor, a history that continues, and a constant challenge — join the love of Christ's heart to the summons to serve the poor as a path of holiness.",
    keyThemes: [
      "Love for the poor",
      "God's preferential love for the little ones",
      "A Church that is poor and for the poor",
      "The Church's history of charity",
      "Care for the poor as a path of holiness",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiv/en/apost_exhortations/documents/20251004-dilexi-te.html",
    relatedDocuments: ["dilexit-nos", "evangelii-gaudium", "fratelli-tutti"],
  }),
  doc({
    slug: "magnifica-humanitas",
    title: "Magnifica Humanitas",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIV",
    issuedDate: "2026-05-15",
    summary:
      "The first encyclical of Pope Leo XIV, on the social doctrine of the Church in the time of artificial intelligence, given at Saint Peter's in the second year of his pontificate. Its introduction sets the choice before this generation between building a new Tower of Babel and building the city where God and humanity dwell together. Five chapters follow: a dynamic approach faithful to the Gospel, tracing social doctrine from Leo XIII to the present; the foundations and principles of social doctrine, including the common good, subsidiarity, solidarity and integral human development; technology and dominance in the light of the promises of AI; the safeguarding of truth, work and freedom; and the culture of power set against the civilisation of love.",
    keyThemes: [
      "The social doctrine of the Church",
      "Artificial intelligence and the technocratic paradigm",
      "The dignity and grandeur of the human person",
      "Truth, work and freedom in the digital age",
      "The civilisation of love and the building of peace",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiv/en/encyclicals/documents/20260515-magnifica-humanitas.html",
    relatedDocuments: ["rerum-novarum", "laudato-si", "fratelli-tutti", "gaudium-et-spes"],
  }),
];
