import type { CuratedEntry } from "../index";

/**
 * Church document group 1: the nine remaining documents of the Second Vatican
 * Council, the two dogmatic constitutions of the First Vatican Council, and the
 * landmark texts from the Council of Florence through Pope Paul VI.
 *
 * Every `canonicalUrl` below was fetched and confirmed to exist on vatican.va
 * before it was written here. Where the Holy See publishes a document only in
 * Latin (the two First Vatican Council constitutions, Laetentur Caeli,
 * Apostolicae Curae, Veterum Sapientia), the Latin page is the canonical link
 * and the summary says so, rather than pointing the reader at an unofficial
 * English text.
 *
 * Dates are the day of promulgation as recorded by the Holy See — in most cases
 * the date encoded in the Vatican's own document path. Every `bodyExcerpt` is
 * verbatim from the cited Vatican page; nothing is paraphrased inside quotation
 * marks, and where no short passage carries the document on its own, the field
 * is simply omitted.
 *
 * Three documents named in the content plan are deliberately absent: the
 * Council of Trent's decrees, the medieval and early-modern bulls (Unam
 * Sanctam, Exsurge Domine, Sublimis Deus, Quo Primum) and the 1907 Holy Office
 * decree Lamentabili have no page in the Vatican archive, and this file does not
 * guess a URL.
 */

// Verified index pages, used as the second citation alongside each document.
const VATICAN_II_INDEX =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/index.htm";
const VATICAN_I_INDEX = "https://www.vatican.va/archive/hist_councils/i-vatican-council/index.htm";
const EUGENE_IV_INDEX = "https://www.vatican.va/content/eugenius-iv/la.html";
const LEO_XIII_APOSTOLIC_LETTERS =
  "https://www.vatican.va/content/leo-xiii/en/apost_letters.index.html";
const LEO_XIII_LETTERS = "https://www.vatican.va/content/leo-xiii/en/letters.index.html";
const PIUS_XII_ENCYCLICALS = "https://www.vatican.va/content/pius-xii/en/encyclicals.index.html";
const JOHN_XXIII_CONSTITUTIONS_1962 =
  "https://www.vatican.va/content/john-xxiii/la/apost_constitutions/1962.index.html";
const PAUL_VI_EXHORTATIONS =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations.index.html";
const PAUL_VI_CONSTITUTIONS =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions.index.html";
const PAUL_VI_MOTU_PROPRIO = "https://www.vatican.va/content/paul-vi/en/motu_proprio.index.html";

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

function doc(args: {
  slug: string;
  title: string;
  documentType: DocumentType;
  issuingAuthority: string;
  issuedDate: string;
  summary: string;
  keyThemes: string[];
  canonicalUrl: string;
  indexUrl: string;
  bodyExcerpt?: string;
  relatedDocuments?: string[];
}): CuratedEntry {
  const citations = [args.canonicalUrl, args.indexUrl];
  return {
    contentType: "CHURCH_DOCUMENT",
    slug: args.slug,
    authorityLevel: "VATICAN",
    citations,
    payload: {
      slug: args.slug,
      title: args.title,
      documentType: args.documentType,
      issuingAuthority: args.issuingAuthority,
      issuedDate: args.issuedDate,
      summary: args.summary,
      keyThemes: args.keyThemes,
      canonicalUrl: args.canonicalUrl,
      ...(args.bodyExcerpt ? { bodyExcerpt: args.bodyExcerpt } : {}),
      relatedDocuments: args.relatedDocuments ?? [],
      citations,
    },
  };
}

export const churchDocumentGroupOne: CuratedEntry[] = [
  // ---------------------------------------------------------------------------
  // Second Vatican Council (1962-1965)
  // ---------------------------------------------------------------------------
  doc({
    slug: "inter-mirifica",
    title: "Inter Mirifica",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1963-12-04",
    summary:
      "The Decree on the Media of Social Communications, promulgated on the same day as Sacrosanctum Concilium at the close of the Council's second session — the first two documents Vatican II gave the Church. In two short chapters the Council sets out the Church's teaching on the press, cinema, radio and television: the moral order governs their use, the faithful have a right to information that is true and complete, the demands of art never dispense from the moral law, and readers, viewers and listeners bear real responsibility for what they choose. The second chapter turns to pastoral action, asking bishops and the faithful to support a Catholic press and Catholic broadcasting, to form consciences in the right use of the media, and to keep an annual day in every diocese on which the faithful are instructed in their duties in this field and asked to support the Church's work of communication.",
    keyThemes: [
      "The moral order and the media of social communication",
      "The right to true and complete information",
      "Art, morality, and the formation of conscience",
      "The duties of authors, readers, viewers, and listeners",
      "Pastoral action and a Catholic press",
      "An annual day for social communications",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19631204_inter-mirifica_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "The Church recognizes that these media, if properly utilized, can be of great service to mankind, since they greatly contribute to men's entertainment and instruction as well as to the spread and support of the Kingdom of God.",
    relatedDocuments: ["sacrosanctum-concilium", "gaudium-et-spes"],
  }),
  doc({
    slug: "orientalium-ecclesiarum",
    title: "Orientalium Ecclesiarum",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1964-11-21",
    summary:
      "The Decree on the Catholic Eastern Churches, promulgated on the same day as Lumen Gentium and Unitatis Redintegratio. The Council declares that the Catholic Church is made up of particular Churches or rites which are of equal dignity, none of them superior to the others by reason of rite, and that the Eastern Churches are to keep their own liturgical, theological, spiritual and disciplinary heritage whole and entire, restoring what has been lost through circumstances of time or person. It confirms the rights and privileges of the Eastern patriarchs, restores to Eastern priests the faculty of administering confirmation with the sacred chrism, treats the observance of the Eastern liturgical laws and the use of the vernacular, and lays down careful norms for relations with the Eastern Christians not in full communion with Rome, including the limited sharing in sacraments that the Council permits under specified conditions.",
    keyThemes: [
      "The equal dignity of the particular Churches and rites",
      "Preservation of the Eastern spiritual and liturgical heritage",
      "The rights of the Eastern patriarchs",
      "Discipline of the sacraments in the Eastern Churches",
      "Divine worship and liturgical law",
      "Relations with the Eastern Christians not in full communion",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19641121_orientalium-ecclesiarum_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "Between these there exists an admirable bond of union, such that the variety within the Church in no way harms its unity; rather it manifests it.",
    relatedDocuments: ["lumen-gentium", "unitatis-redintegratio"],
  }),
  doc({
    slug: "christus-dominus",
    title: "Christus Dominus",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1965-10-28",
    summary:
      "The Decree on the Pastoral Office of Bishops in the Church, which takes up in practical terms what Lumen Gentium had taught doctrinally about the episcopate. Three chapters treat the bishops in relation to the universal Church — their share, with and under the Roman Pontiff, in care for the whole Church, the newly established Synod of Bishops, and the wish that the Roman Curia be reorganised and internationalised; then the bishop in his own diocese as teacher of the faith, sanctifier and shepherd, with directives on preaching, catechesis, the diocesan curia and pastoral council, pastors and parishes, and the resignation of bishops who can no longer fulfil their office; and finally the cooperation of bishops for the common good of several churches, through episcopal conferences and the revision of diocesan and provincial boundaries.",
    keyThemes: [
      "Bishops as successors of the Apostles",
      "The bishop's teaching, sanctifying, and governing office",
      "The Synod of Bishops and the reform of the Roman Curia",
      "The diocese, its curia, and its parishes",
      "Episcopal conferences and regional cooperation",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651028_christus-dominus_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "Bishops, therefore, have been made true and authentic teachers of the faith, pontiffs, and pastors through the Holy Spirit, who has been given to them.",
    relatedDocuments: ["lumen-gentium", "presbyterorum-ordinis", "optatam-totius"],
  }),
  doc({
    slug: "perfectae-caritatis",
    title: "Perfectae Caritatis",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1965-10-28",
    summary:
      "The Decree on the Up-to-Date Renewal of Religious Life. The Council sets out the twofold principle that has guided renewal ever since: a continuous return to the sources of all Christian life and to the original inspiration behind each institute, together with an adjustment of the institute to the changed conditions of the times — a renewal that is finally the work of the heart, since even the best adaptations avail nothing without a renewal of spirit. It then treats the evangelical counsels of chastity, poverty and obedience one by one, the common life and its prayer and the Eucharist at its centre, the religious habit as a sign of consecration, the different forms of religious life from the contemplative to the apostolic, and the formation of members, insisting that no institute be renewed without the participation of its own members.",
    keyThemes: [
      "Return to the sources and to the founder's charism",
      "Adaptation to the conditions of the times",
      "The evangelical counsels of chastity, poverty, and obedience",
      "Common life, prayer, and the Eucharist",
      "Contemplative and apostolic forms of religious life",
      "The formation of religious",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651028_perfectae-caritatis_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "Indeed from the very beginning of the Church men and women have set about following Christ with greater freedom and imitating Him more closely through the practice of the evangelical counsels, each in his own way leading a life dedicated to God.",
    relatedDocuments: ["lumen-gentium", "optatam-totius"],
  }),
  doc({
    slug: "optatam-totius",
    title: "Optatam Totius",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1965-10-28",
    summary:
      "The Decree on Priestly Training. Because seminaries differ so widely from place to place, the Council asks each country or rite to draw up its own programme of priestly formation, approved by the Apostolic See and revised as circumstances change. It then treats the fostering of vocations as a duty of the whole Christian community, beginning with families and parishes; the purpose of minor seminaries; the spiritual formation of seminarians around the Eucharist, the Scriptures and the liturgy, and their preparation for celibacy and obedience; and the revision of ecclesiastical studies, with a philosophical and theological formation that draws on Scripture as the soul of theology and takes Saint Thomas as a guide. It closes with strictly pastoral training and with the insistence that formation continue after ordination.",
    keyThemes: [
      "A programme of priestly training for each country",
      "The fostering of vocations by the whole community",
      "Spiritual formation and preparation for celibacy",
      "The revision of philosophical and theological studies",
      "Scripture as the soul of theology",
      "Pastoral training and ongoing formation",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651028_optatam-totius_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "The duty of fostering vocations pertains to the whole Christian community, which should exercise it above all by a fully Christian life.",
    relatedDocuments: ["presbyterorum-ordinis", "dei-verbum", "christus-dominus"],
  }),
  doc({
    slug: "gravissimum-educationis",
    title: "Gravissimum Educationis",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1965-10-28",
    summary:
      "The Declaration on Christian Education. The Council affirms that every human being has an inalienable right to an education answering to his or her destiny, and that parents, having given life to their children, are the primary and principal educators, whose right to choose their children's school civil society must protect without imposing an unjust burden. The Church claims her own role in education because she must lead every one of her children to the fullness of Christian life, and the declaration therefore treats catechesis and moral formation, the mission and character of the Catholic school, the special place of the teacher's vocation, and Catholic universities and ecclesiastical faculties, asking that theology and the other sciences be pursued together so that faith and reason may be seen to meet in one truth.",
    keyThemes: [
      "The universal right to education",
      "Parents as the primary educators of their children",
      "Moral and religious formation",
      "The Catholic school and the vocation of teachers",
      "Catholic universities and ecclesiastical faculties",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_gravissimum-educationis_en.html",
    indexUrl: VATICAN_II_INDEX,
    relatedDocuments: ["gaudium-et-spes", "dignitatis-humanae"],
  }),
  doc({
    slug: "apostolicam-actuositatem",
    title: "Apostolicam Actuositatem",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1965-11-18",
    summary:
      "The Decree on the Apostolate of the Laity, promulgated on the same day as Dei Verbum. The Council teaches that the lay apostolate derives from the Christian vocation itself, from baptism and confirmation and the charity poured out by the Holy Spirit, so that the Church can never be without it. Six chapters treat the vocation of the laity to share in the Church's saving mission; the twofold objective of that apostolate — the evangelisation and sanctification of others, and the renewal of the temporal order from within, together with works of charity; the fields in which it is exercised, from the parish and the family to youth, the social milieu, and the national and international spheres; its individual and organised forms, including Catholic Action; its right relationship with the hierarchy; and the formation that equips lay people for it.",
    keyThemes: [
      "The lay apostolate as rooted in baptism and confirmation",
      "Evangelisation and sanctification of the world",
      "Renewal of the temporal order",
      "Charity as the mark of the lay apostolate",
      "Family, parish, youth, and the social milieu",
      "Formation of the laity and relations with the hierarchy",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651118_apostolicam-actuositatem_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "Our own times require of the laity no less zeal: in fact, modern conditions demand that their apostolate be broadened and intensified.",
    relatedDocuments: ["lumen-gentium", "gaudium-et-spes"],
  }),
  doc({
    slug: "presbyterorum-ordinis",
    title: "Presbyterorum Ordinis",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1965-12-07",
    summary:
      "The Decree on the Ministry and Life of Priests, promulgated on the Council's last working day. Three chapters treat the place of the priesthood in the Church's mission, the priest sharing through ordination in the one priesthood of Christ the Teacher, Priest and King; the priestly ministry itself — the ministry of the word, the sacraments and above all the Eucharist as the source and summit of all evangelisation, and the pastoral guidance of God's people — together with the priest's relations with his bishop, with his brother priests, and with the laity, and his duty to foster vocations; and finally the life of priests, their call to holiness in and through their ministry, celibacy embraced as a gift, voluntary poverty and obedience, the spiritual helps of prayer, study and retreat, and the just provision to be made for their support.",
    keyThemes: [
      "The priesthood in the mission of the Church",
      "The ministry of the word and the sacraments",
      "The Eucharist as source and summit of evangelisation",
      "Relations with the bishop, brother priests, and the laity",
      "The call to holiness in priestly life",
      "Celibacy, poverty, obedience, and the support of priests",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651207_presbyterorum-ordinis_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "Priests by sacred ordination and mission which they receive from the bishops are promoted to the service of Christ the Teacher, Priest and King.",
    relatedDocuments: [
      "lumen-gentium",
      "optatam-totius",
      "christus-dominus",
      "sacerdotalis-caelibatus",
    ],
  }),
  doc({
    slug: "ad-gentes",
    title: "Ad Gentes",
    documentType: "council_document",
    issuingAuthority: "Pope Paul VI / Second Vatican Council",
    issuedDate: "1965-12-07",
    summary:
      "The Decree on the Church's Missionary Activity. Its doctrinal principles ground mission not in strategy but in the Trinity: the Church is missionary by her very nature because she is born of the mission of the Son and the mission of the Holy Spirit, sent by the Father who wills all to be saved. The decree then describes missionary work itself — the witness of Christian life and charity, the preaching of the Gospel, the catechumenate and Christian initiation — and the forming of local Christian communities with their own clergy, religious and lay apostolate, until a young Church can take its own share in the mission of the whole Church. Further chapters treat the vocation and formation of missionaries, the ordering and planning of missionary activity, and the cooperation owed by bishops, priests, religious and laity everywhere.",
    keyThemes: [
      "The Church is missionary by her very nature",
      "The Trinitarian source of the Church's mission",
      "Witness, preaching, and the catechumenate",
      "Forming local Churches with their own clergy and laity",
      "The vocation and formation of missionaries",
      "The missionary cooperation of the whole Church",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651207_ad-gentes_en.html",
    indexUrl: VATICAN_II_INDEX,
    bodyExcerpt:
      "The pilgrim Church is missionary by her very nature, since it is from the mission of the Son and the mission of the Holy Spirit that she draws her origin, in accordance with the decree of God the Father.",
    relatedDocuments: ["lumen-gentium", "redemptoris-missio", "evangelii-nuntiandi", "fidei-donum"],
  }),

  // ---------------------------------------------------------------------------
  // First Vatican Council (1869-1870)
  // ---------------------------------------------------------------------------
  doc({
    slug: "dei-filius",
    title: "Dei Filius",
    documentType: "council_document",
    issuingAuthority: "Blessed Pope Pius IX / First Vatican Council",
    issuedDate: "1870-04-24",
    summary:
      "The Dogmatic Constitution on the Catholic Faith, approved in the third session of the First Vatican Council against the rationalism, pantheism and materialism of the nineteenth century. Four chapters treat God the Creator of all things, who made the world out of nothing by his free counsel; divine revelation, which it pleased God to give beyond what human reason could reach, so that the truths of religion may be known by all with firm certainty and no admixture of error; faith, the supernatural virtue by which we believe what God has revealed because of his authority, aided by grace and confirmed by the signs of credibility; and finally faith and reason, which can never be at variance since the same God gives both the light of reason and the gift of faith, though faith remains above reason and its mysteries are not demonstrable. Each chapter closes with canons. The Holy See publishes the text on vatican.va in Latin and Italian.",
    keyThemes: [
      "God the Creator of all things",
      "The fact and necessity of divine revelation",
      "Faith as a supernatural gift",
      "The harmony of faith and reason",
      "Condemnation of rationalism, pantheism, and materialism",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/i-vatican-council/documents/vat-i_const_18700424_dei-filius_la.html",
    indexUrl: VATICAN_I_INDEX,
    relatedDocuments: [
      "pastor-aeternus",
      "aeterni-patris",
      "dei-verbum",
      "pascendi-dominici-gregis",
      "humani-generis",
    ],
  }),
  doc({
    slug: "pastor-aeternus",
    title: "Pastor Aeternus",
    documentType: "council_document",
    issuingAuthority: "Blessed Pope Pius IX / First Vatican Council",
    issuedDate: "1870-07-18",
    summary:
      "The First Dogmatic Constitution on the Church of Christ, approved in the fourth session of the First Vatican Council. Its four chapters define that Christ instituted the apostolic primacy in Saint Peter; that this primacy endures by Christ's own institution in the Roman Pontiffs, Peter's successors; that the Roman Pontiff's power is a primacy of true, ordinary and immediate episcopal jurisdiction over the whole Church and over each of the faithful, which does not diminish but supports the ordinary jurisdiction of the bishops in their own sees; and that when he speaks ex cathedra — that is, when as pastor and teacher of all Christians he defines by his supreme apostolic authority a doctrine concerning faith or morals to be held by the whole Church — he possesses that infallibility with which Christ willed his Church to be endowed. The Council was suspended before it could complete its treatment of the Church; that work was taken up by Lumen Gentium.",
    keyThemes: [
      "The primacy of Saint Peter and of his successors",
      "The universal ordinary jurisdiction of the Roman Pontiff",
      "Papal infallibility in ex cathedra definitions",
      "The bishops' own ordinary jurisdiction",
      "The unity of the Church in faith and communion",
    ],
    canonicalUrl:
      "https://www.vatican.va/archive/hist_councils/i-vatican-council/documents/vat-i_const_18700718_pastor-aeternus_la.html",
    indexUrl: VATICAN_I_INDEX,
    relatedDocuments: ["dei-filius", "lumen-gentium", "ut-unum-sint"],
  }),

  // ---------------------------------------------------------------------------
  // Pre-modern landmarks
  // ---------------------------------------------------------------------------
  doc({
    slug: "laetentur-caeli",
    title: "Laetentur Caeli",
    documentType: "papal_bull",
    issuingAuthority: "Pope Eugene IV / Council of Florence",
    issuedDate: "1439-07-06",
    summary:
      "The bull of union with the Greeks, solemnly read in the cathedral of Florence and the high point of the Council of Ferrara-Florence. Working through the questions that had divided East and West, it defines that the Holy Spirit proceeds eternally from the Father and the Son as from one principle and by one spiration, and that the Latin addition of the Filioque to the Creed was lawfully made; that the Body of Christ is truly confected in unleavened and in leavened wheat bread alike, each priest following the usage of his own Church; that the souls of those who die in charity but have not yet made satisfaction are cleansed after death and helped by the suffrages of the living, that the fully purified are received into heaven and see God clearly, and that those who die in mortal sin descend to hell; and that the Roman Pontiff holds the primacy over the whole Church as successor of Peter, with the order of the ancient patriarchal sees set out. The union it proclaimed did not endure in the East. The Holy See publishes the text in Latin and Italian.",
    keyThemes: [
      "The procession of the Holy Spirit and the Filioque",
      "The validity of leavened and unleavened bread",
      "Purgatory, suffrages for the dead, and the last things",
      "The primacy of the Roman Pontiff",
      "The order of the patriarchal sees",
      "Union between East and West",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/eugenius-iv/la/documents/bulla-laetentur-caeli-6-iulii-1439.html",
    indexUrl: EUGENE_IV_INDEX,
    relatedDocuments: ["pastor-aeternus", "orientalium-ecclesiarum", "unitatis-redintegratio"],
  }),
  doc({
    slug: "apostolicae-curae",
    title: "Apostolicae Curae",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1896-09-13",
    summary:
      "The apostolic letter in which Leo XIII gave the Holy See's judgement on the validity of Anglican ordinations, after a specially appointed commission had examined the question and the Pope had reviewed the practice of his predecessors. Rehearsing the constant discipline by which converted Anglican clergy had been ordained absolutely, and examining the Edwardine Ordinal itself, the letter concludes that the rite is defective in form, because its words do not signify definitely the order of the priesthood with its power to consecrate and offer the Body and Blood of the Lord, and defective in intention, because those who framed and used it deliberately set aside the Church's sacrificial priesthood. Leo XIII therefore declares ordinations carried out according to the Anglican rite to have been and to be absolutely null and utterly void, and the letter remains the Church's authoritative judgement on the question. The Holy See publishes the text in Latin.",
    keyThemes: [
      "The validity of Anglican ordinations",
      "Form and intention in the sacrament of Holy Orders",
      "The sacrificial priesthood",
      "The constant practice of the Holy See",
      "Catholic-Anglican relations",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/la/apost_letters/documents/litterae-apostolicae-apostolicae-curae-13-septembris-1896.html",
    indexUrl: LEO_XIII_APOSTOLIC_LETTERS,
    relatedDocuments: ["unitatis-redintegratio", "ut-unum-sint"],
  }),
  doc({
    slug: "testem-benevolentiae",
    title: "Testem Benevolentiae Nostrae",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1899-01-22",
    summary:
      "A letter addressed by Leo XIII to Cardinal James Gibbons, Archbishop of Baltimore, on opinions then circulating under the name of Americanism. Writing with evident affection for the Church in the United States, the Pope distinguishes carefully between the qualities and institutions of the American people, to which he takes no exception, and a set of ideas he cannot approve: that the Church should soften or pass over parts of her doctrine to make it easier for those outside to accept, that the guidance of a spiritual director is less necessary now that the Holy Spirit pours out his gifts more abundantly, that the natural virtues and the so-called active virtues are to be preferred to the supernatural and the passive ones, and that the religious vows are ill-suited to the age. Leo XIII answers each point from the deposit of faith, and asks that if Americanism means anything other than the legitimate character of a people, it should not be so called.",
    keyThemes: [
      "The unchangeable deposit of faith and its presentation",
      "The necessity of spiritual direction",
      "Natural and supernatural virtue",
      "The value of the religious vows",
      "The Church in the United States",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/letters/documents/hf_l-xiii_let_18990122_testem-benevolentiae.html",
    indexUrl: LEO_XIII_LETTERS,
    relatedDocuments: ["pascendi-dominici-gregis", "aeterni-patris"],
  }),
  doc({
    slug: "sacra-virginitas",
    title: "Sacra Virginitas",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1954-03-25",
    summary:
      "An encyclical on consecrated virginity, given on the Annunciation during the Marian Year of 1954. Pius XII gathers the witness of Scripture and the Fathers on virginity embraced for the kingdom of heaven: it is a counsel, not a precept, freely offered to those who can receive it; its first motive is an undivided heart, free to be occupied with the things of the Lord; and it is fruitful, since those who renounce natural motherhood and fatherhood beget a spiritual family. Against opinions then current the Pope reaffirms the Church's constant teaching, defined at the Council of Trent, that the state of virginity consecrated to God is more excellent than the married state, without in any way disparaging Christian marriage, which he calls a great sacrament. The encyclical closes with the means by which chastity is preserved — vigilance and mortification, humility, prayer, the Eucharist, and devotion to the Blessed Virgin.",
    keyThemes: [
      "Virginity consecrated for the kingdom of heaven",
      "The undivided heart and spiritual fruitfulness",
      "The excellence of virginity and the goodness of marriage",
      "Errors concerning the counsels",
      "The means of preserving chastity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_25031954_sacra-virginitas.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["casti-connubii", "perfectae-caritatis"],
  }),
  doc({
    slug: "ad-caeli-reginam",
    title: "Ad Caeli Reginam",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1954-10-11",
    summary:
      "The encyclical on the Queenship of the Blessed Virgin Mary, given to crown the Marian Year kept for the centenary of the definition of the Immaculate Conception. Pius XII traces the title of Queen through Scripture, the Fathers, the liturgy and Christian art, and explains its foundation: Mary is Queen because she is the Mother of the Son of God and King, and because she was associated with him as the new Eve in the work of redemption — a queenship of grace and of intercession, wholly derived from and subordinate to the kingship of Christ, exercised in mercy for the members of his body. By this letter the Pope decreed the liturgical feast of the Queenship of Mary, to be kept each year throughout the world, and asked that the consecration of the human race to the Immaculate Heart of Mary be renewed on the same day. In the reformed calendar the memorial is kept on 22 August, the octave day of the Assumption.",
    keyThemes: [
      "Mary's queenship and the kingship of Christ",
      "The divine motherhood as the ground of the title",
      "Mary's association in the work of redemption",
      "The witness of the Fathers, the liturgy, and Christian art",
      "The feast of the Queenship of Mary",
      "Consecration to the Immaculate Heart",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_11101954_ad-caeli-reginam.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    bodyExcerpt:
      "by Our Apostolic authority We decree and establish the feast of Mary's Queenship, which is to be celebrated every year in the whole world on the 31st of May.",
    relatedDocuments: ["quas-primas", "redemptoris-mater", "lumen-gentium"],
  }),
  doc({
    slug: "haurietis-aquas",
    title: "Haurietis Aquas",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1956-05-15",
    summary:
      "The encyclical on devotion to the Sacred Heart of Jesus, given for the centenary of the extension of the feast to the universal Church by Pius IX. Against the suggestion that the devotion is a sentimental accretion, Pius XII shows its foundations in Scripture, from the covenant love of God in the Old Testament to the pierced side of the Crucified in Saint John, and in the Fathers and the Church's doctors. He explains what is honoured in the Heart of the Incarnate Word: a threefold love — the divine love he shares with the Father and the Spirit, the spiritual love of his human will, and the sensible love of his human affections — all resting on the hypostatic union, so that worship offered to his Heart is worship offered to the Person of the Word made flesh. The encyclical concludes with the practices of consecration and reparation and with the Heart of Jesus as the school of charity for the whole Church.",
    keyThemes: [
      "The scriptural foundations of the devotion",
      "The threefold love in the Heart of Christ",
      "The hypostatic union and the worship due to the Heart of Jesus",
      "Consecration and reparation",
      "The Sacred Heart as the school of charity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15051956_haurietis-aquas.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    bodyExcerpt:
      "It is altogether impossible to enumerate the heavenly gifts which devotion to the Sacred Heart of Jesus has poured out on the souls of the faithful, purifying them, offering them heavenly strength, rousing them to the attainment of all virtues.",
    relatedDocuments: ["quas-primas", "mystici-corporis-christi", "ad-caeli-reginam"],
  }),
  doc({
    slug: "fidei-donum",
    title: "Fidei Donum",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1957-04-21",
    summary:
      "The encyclical on the condition of the Catholic missions, and especially on Africa at a moment of rapid social and political change. Pius XII sets out the missionary responsibility that belongs to every bishop and not only to those who govern mission territories: the whole Church is answerable for the whole Church, and dioceses rich in clergy are asked to lend priests, for a fixed term, to the young Churches that lack them — the practice from which such priests came to be known as Fidei donum priests. The letter also urges the raising up and thorough formation of a local clergy, religious and lay apostolate; the support of Catholic schools, catechists and charitable works; prayer and sacrifice for the missions; and generous cooperation with the pontifical mission societies, so that the faith which is itself God's gift may be handed on by those who have received it.",
    keyThemes: [
      "The missionary responsibility of every bishop",
      "Priests lent to the young Churches",
      "The formation of a local clergy and laity",
      "The Church in Africa",
      "Prayer, sacrifice, and material support for the missions",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_21041957_fidei-donum.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["ad-gentes", "evangelii-nuntiandi", "redemptoris-missio"],
  }),
  doc({
    slug: "veterum-sapientia",
    title: "Veterum Sapientia",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint John XXIII",
    issuedDate: "1962-02-22",
    summary:
      "The apostolic constitution on the promotion of the study of Latin, signed on the feast of the Chair of Saint Peter a few months before the Second Vatican Council opened. John XXIII recalls that the wisdom of the ancient world came to the Church largely through Greek and Latin, and that Latin in particular became the Church's own tongue: universal, so that pastors of every nation can speak to one another and to the Holy See; unchanging, so that the terms in which the faith is defined keep their exact sense; and dignified, raised above the daily speech of any one people. He therefore lays down that bishops and religious superiors take care that no one write against the use of Latin, that candidates for the priesthood be thoroughly trained in it before their higher studies, that the major sacred sciences be taught in Latin from Latin textbooks, and that an institute be established for its teaching. The Holy See publishes the text in Latin.",
    keyThemes: [
      "Latin as the universal language of the Church",
      "The precision and permanence of theological language",
      "Latin in seminary formation",
      "The teaching of the sacred sciences",
      "Continuity with the Church's tradition",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-xxiii/la/apost_constitutions/1962/documents/hf_j-xxiii_apc_19620222_veterum-sapientia.html",
    indexUrl: JOHN_XXIII_CONSTITUTIONS_1962,
    relatedDocuments: ["sacrosanctum-concilium", "optatam-totius"],
  }),

  // ---------------------------------------------------------------------------
  // Pope Saint Paul VI
  // ---------------------------------------------------------------------------
  doc({
    slug: "credo-of-the-people-of-god",
    title: "Solemni Hac Liturgia (Credo of the People of God)",
    documentType: "vatican_document",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1968-06-30",
    summary:
      "The solemn profession of faith made by Paul VI to close the Year of Faith he had called for the nineteenth centenary of the martyrdom of Saints Peter and Paul. Fulfilling, as he says, the mandate given to Peter to confirm his brethren at a moment of widespread questioning, the Pope pronounces a creed which — without being strictly speaking a dogmatic definition — repeats in substance the Creed of Nicaea with the developments the age required. It professes the one God in three Persons; the Incarnation, passion, resurrection and coming again of the Son; the Holy Spirit and his work; original sin and its transmission; the Immaculate Conception and Assumption of the Blessed Virgin; the one Church, apostolic and hierarchical, built on Peter and his successors; the sacrifice of the Mass and the change of the whole substance of the bread and wine into the Body and Blood of Christ; and the communion of saints with purgatory and eternal life.",
    keyThemes: [
      "A solemn profession of faith for the Year of Faith",
      "Continuity with the Creed of Nicaea",
      "The Trinity and the Incarnation",
      "Original sin and redemption",
      "The Church, the Eucharist, and transubstantiation",
      "The communion of saints and the last things",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/motu_proprio/documents/hf_p-vi_motu-proprio_19680630_credo.html",
    indexUrl: PAUL_VI_MOTU_PROPRIO,
    bodyExcerpt:
      "we shall accordingly make a profession of faith, pronounce a creed which, without being strictly speaking a dogmatic definition, repeats in substance, with some developments called for by the spiritual condition of our time, the creed of Nicea, the creed of the immortal tradition of the holy Church of God.",
    relatedDocuments: ["mysterium-fidei", "lumen-gentium", "catechism-of-the-catholic-church"],
  }),
  doc({
    slug: "missale-romanum",
    title: "Missale Romanum",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1969-04-03",
    summary:
      "The apostolic constitution, given on Holy Thursday, by which Paul VI promulgated the Roman Missal revised by decree of the Second Vatican Council. Recalling how Saint Pius V had published the Missal of 1570 after the Council of Trent, the Pope explains the principal changes: a revised Order of Mass in which the rites are simplified and the parts proper to each minister and to the assembly are made clear; the addition of three new Eucharistic Prayers to the Roman Canon, which is retained; a great enrichment of the prefaces; the restoration of the prayer of the faithful; proper prayers for the ferias of Advent, Christmas, Lent and Easter; and a far wider selection of Scripture spread over a multi-year cycle so that the table of God's word may be more lavishly prepared. He gives these prescriptions the force of law and sets them to take effect on the First Sunday of Advent, 30 November 1969.",
    keyThemes: [
      "Liturgical reform mandated by Sacrosanctum Concilium",
      "The revised Order of Mass",
      "The Eucharistic Prayers and the Roman Canon",
      "An enriched lectionary and the table of God's word",
      "Continuity with the Missal of Saint Pius V",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_19690403_missale-romanum.html",
    indexUrl: PAUL_VI_CONSTITUTIONS,
    bodyExcerpt:
      "We order that the prescriptions of this Constitution go into effect November 30th of this year, the first Sunday of Advent.",
    relatedDocuments: ["sacrosanctum-concilium", "mediator-dei", "mysterium-fidei"],
  }),
  doc({
    slug: "marialis-cultus",
    title: "Marialis Cultus",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1974-02-02",
    summary:
      "The apostolic exhortation for the right ordering and development of devotion to the Blessed Virgin Mary, given on the feast of the Presentation of the Lord. The first part shows how the reformed liturgy honours Mary — in the solemnities and feasts of the year, in Advent and the Christmas season, and above all as the model of the Church at worship, the attentive Virgin who receives the word, the Virgin in prayer, the Mother, and the Virgin presenting her offering. The second part gives the guidelines that keep Marian devotion sound: it must be Trinitarian, Christological, ecclesial and attentive to the Holy Spirit, and it must bear four notes — biblical, liturgical, ecumenical and anthropological, avoiding both exaggeration and a narrow sentimentality, and taking account of the changed situation of women. The third part commends two devotions in particular, the Angelus and the Rosary, which the Pope presents as a Gospel prayer centred on the mystery of the Incarnation.",
    keyThemes: [
      "Mary in the reformed liturgy",
      "The Blessed Virgin as model of the Church at worship",
      "Trinitarian, Christological, and ecclesial devotion",
      "The biblical, liturgical, ecumenical, and anthropological notes",
      "The Angelus",
      "The Rosary as a Gospel prayer",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus.html",
    indexUrl: PAUL_VI_EXHORTATIONS,
    relatedDocuments: ["lumen-gentium", "sacrosanctum-concilium", "redemptoris-mater"],
  }),
  doc({
    slug: "evangelii-nuntiandi",
    title: "Evangelii Nuntiandi",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1975-12-08",
    summary:
      "The apostolic exhortation on evangelisation in the modern world, given at the close of the Holy Year of 1975, on the tenth anniversary of the closing of the Second Vatican Council and a year after the Synod of Bishops had devoted itself to this theme. Paul VI begins from Christ the first evangeliser, whose proclamation of the kingdom the Church continues, and states that evangelising is the Church's deepest identity: she exists in order to evangelise. He describes what evangelisation is — not the delivery of a message alone but the transformation of humanity from within, so that the Gospel affects and upsets the criteria of judgement and the ways of thinking of whole cultures; its content, Christ crucified and risen and the salvation he gives; its methods, from the witness of life and personal contact to preaching, catechesis and the media; the whole Church as its agent; and the interior dispositions, above all fidelity to the Holy Spirit and love for those to whom one is sent.",
    keyThemes: [
      "The Church exists in order to evangelise",
      "Christ the first evangeliser and the kingdom of God",
      "The evangelisation of cultures",
      "The witness of life and personal proclamation",
      "Popular piety and the local Churches",
      "Evangelisation, human advancement, and liberation",
      "Fidelity to the Holy Spirit in the evangeliser",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19751208_evangelii-nuntiandi.html",
    indexUrl: PAUL_VI_EXHORTATIONS,
    bodyExcerpt:
      "Evangelizing is in fact the grace and vocation proper to the Church, her deepest identity. She exists in order to evangelize.",
    relatedDocuments: ["ad-gentes", "redemptoris-missio", "evangelii-gaudium", "fidei-donum"],
  }),
];
