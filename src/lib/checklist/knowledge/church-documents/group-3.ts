import type { CuratedEntry } from "../index";

/**
 * Church document group 3: the papal magisterium that groups 1 and 2 leave
 * out, from the bulls of union of the Council of Florence through the
 * encyclicals of Leo XIII, Saint Pius X, Benedict XV, Pius XI and Pius XII, to
 * the apostolic constitutions, exhortations, letters and motu proprio
 * documents of the popes from Saint John XXIII to Leo XIV.
 *
 * House rules for this file:
 *
 *   - Every `canonicalUrl` is the document's own page on vatican.va. Each was
 *     fetched before it was written here, and its title and dateline were read
 *     from the page itself. Where the Holy See publishes a document only in
 *     Latin or Italian, that page is the canonical link and the summary says
 *     so. The second citation is the vatican.va index page that lists the
 *     document, fetched the same way.
 *   - `issuedDate` is the date in the document's own dateline. Where that
 *     differs from the date in the Vatican's URL path (Pastores Dabo Vobis,
 *     Apostolos Suos, Sacramentorum Sanctitatis Tutela and others), the
 *     dateline wins.
 *   - Summaries and key themes are short factual descriptions written for this
 *     catalogue. No document text is reproduced: there is no `bodyExcerpt` in
 *     this file, and nothing inside a summary is a quotation.
 *   - `relatedDocuments` only names slugs that exist as CHURCH_DOCUMENT
 *     entries in the curated registry.
 *   - Before an entry was added, its slug, title and incipit were checked
 *     against the published CHURCH_DOCUMENT rows, the checklist, every curated
 *     knowledge file and the shared claims list, so nothing here duplicates a
 *     document already on the site. Christus Dominus (1953), Pius XII's
 *     constitution on the eucharistic fast, shares its incipit with the
 *     Second Vatican Council's decree and so carries a descriptive title.
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
  indexUrl: string;
  relatedDocuments?: string[];
}

function doc(input: DocInput): CuratedEntry {
  const citations = [input.canonicalUrl, input.indexUrl];
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
      relatedDocuments: input.relatedDocuments ?? [],
      citations,
    },
  };
}

// Verified vatican.va index pages, used as the second citation of each entry.
const EUGENE_IV_INDEX = "https://www.vatican.va/content/eugenius-iv/la.html";
const BENEDICT_XIV_INDEX = "https://www.vatican.va/content/benedictus-xiv/it.html";
const CLEMENT_XIV_INDEX = "https://www.vatican.va/content/clemens-xiv/it.html";
const PIUS_VI_INDEX = "https://www.vatican.va/content/pius-vi/it.html";
const PIUS_VII_INDEX = "https://www.vatican.va/content/pius-vii/it.html";
const GREGORY_XVI_INDEX = "https://www.vatican.va/content/gregorius-xvi/it.html";
const PIUS_IX_INDEX = "https://www.vatican.va/content/pius-ix/it.html";
const LEO_XIII_ENCYCLICALS = "https://www.vatican.va/content/leo-xiii/en/encyclicals.index.html";
const PIUS_X_ENCYCLICALS = "https://www.vatican.va/content/pius-x/en/encyclicals.index.html";
const PIUS_X_MOTU_PROPRIO = "https://www.vatican.va/content/pius-x/en/motu_proprio.index.html";
const PIUS_X_EXHORTATIONS =
  "https://www.vatican.va/content/pius-x/en/apost_exhortations.index.html";
const PIUS_X_CONSTITUTIONS =
  "https://www.vatican.va/content/pius-x/en/apost_constitutions.index.html";
const BENEDICT_XV_ENCYCLICALS =
  "https://www.vatican.va/content/benedict-xv/en/encyclicals.index.html";
const BENEDICT_XV_BULLS = "https://www.vatican.va/content/benedict-xv/en/bulls.index.html";
const PIUS_XI_ENCYCLICALS = "https://www.vatican.va/content/pius-xi/en/encyclicals.index.html";

export const churchDocumentGroupThree: CuratedEntry[] = [
  // ---------------------------------------------------------------------------
  // The Council of Florence and the popes before Leo XIII
  // ---------------------------------------------------------------------------
  doc({
    slug: "exultate-deo",
    title: "Exultate Deo",
    documentType: "papal_bull",
    issuingAuthority: "Pope Eugene IV / Council of Florence",
    issuedDate: "1439-11-22",
    summary:
      "The bull of union with the Armenian Church, promulgated in a public session of the Council of Florence on 22 November 1439, a few months after the union with the Greeks. To set out the faith the Armenian envoys were accepting, it hands over in turn the Nicene-Constantinopolitan Creed with the Filioque, to be sung or read at Mass at least on Sundays and great feasts; the Chalcedonian definition of the two natures of Christ and the Third Council of Constantinople's teaching on his two wills and operations, together with the acceptance of Chalcedon and of Pope Leo the Great; a short instruction on the seven sacraments, giving the matter, form and minister of each and noting that baptism, confirmation and holy orders imprint an indelible character and so are never repeated; the Athanasian Creed; the decree of union with the Greeks; and the dates on which the Latin Church keeps the Annunciation, the Nativity of John the Baptist, Christmas, the Circumcision and the Presentation. Its sacramental instruction, often called the Decree for the Armenians, long served as a reference point in sacramental theology. The Holy See publishes the text in Latin and Italian.",
    keyThemes: [
      "Union of the Armenian Church with Rome",
      "The Creed with the Filioque",
      "Chalcedon and the two wills of Christ",
      "Matter, form and minister of the seven sacraments",
      "The sacramental character of baptism, confirmation and orders",
      "A common calendar of feasts",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/eugenius-iv/la/documents/bulla-exultate-deo-22-nov-1439.html",
    indexUrl: EUGENE_IV_INDEX,
    relatedDocuments: ["laetentur-caeli", "cantate-domino", "council-of-florence"],
  }),
  doc({
    slug: "cantate-domino",
    title: "Cantate Domino",
    documentType: "papal_bull",
    issuingAuthority: "Pope Eugene IV / Council of Florence",
    issuedDate: "1442-02-04",
    summary:
      "The bull of union with the Copts of Egypt and the Ethiopians, read at a public session of the Council of Florence on 4 February 1442 (1441 in the Florentine reckoning), after the Coptic envoy, the abbot Andrew, had been examined on the articles of faith and had accepted them in the name of his patriarch. Framed as a long profession of what the Roman Church firmly believes and teaches, it sets out the doctrine of the Trinity, with the Holy Spirit proceeding from the Father and the Son; the one God as author of both Testaments, with a list of the books of Scripture the Church receives; the Incarnation, with the condemnation of the ancient Christological heresies, the rejection of the Robber Synod of Ephesus and the acceptance of Chalcedon; the passing of the ceremonial law of Moses with the coming of Christ; the goodness of every creature as food; the baptism of infants without delay; and the teaching that those who remain outside the unity of the Catholic Church cannot share in eternal life unless they are joined to it before death. It also declares second and later marriages after the death of a spouse lawful. The Holy See publishes the text in Latin and Italian.",
    keyThemes: [
      "Union of the Coptic and Ethiopian Christians with Rome",
      "The Trinity and the procession of the Holy Spirit",
      "The canon of Scripture",
      "The Incarnation and the Council of Chalcedon",
      "The end of the ceremonial law",
      "The unity of the Church and salvation",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/eugenius-iv/la/documents/bulla-cantate-domino-4-febr-1442.html",
    indexUrl: EUGENE_IV_INDEX,
    relatedDocuments: ["laetentur-caeli", "exultate-deo", "council-of-florence"],
  }),
  doc({
    slug: "vix-pervenit",
    title: "Vix Pervenit",
    documentType: "encyclical",
    issuingAuthority: "Pope Benedict XIV",
    issuedDate: "1745-11-01",
    summary:
      "The encyclical on usury that Benedict XIV addressed to the bishops of Italy after a dispute over the lawfulness of a particular contract had begun to spread unsound opinions through the country. Before writing, the Pope had the question studied by a group of cardinals, theologians and canonists meeting in his presence, and, without ruling on the disputed contract itself, he set out the principles on which they agreed. Usury, the sin proper to the contract of loan, consists in demanding back more than was lent by reason of the loan itself, and it is not excused because the gain is moderate, because the borrower is rich, or because he will put the money to profitable use. At the same time the letter recognises that titles extrinsic to the loan may justly entitle a lender to something beyond the principal, and that money may lawfully earn a return through other contracts of an altogether different nature, while warning against assuming that such titles are always present. It closes by asking bishops and confessors to avoid both excessive rigour and laxity, and to have the terms of contracts explained clearly in advance.",
    keyThemes: [
      "The nature of usury",
      "Loans and the return of the principal",
      "Extrinsic titles to interest",
      "Lawful contracts distinct from the loan",
      "Avoiding both rigorism and laxity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedictus-xiv/it/documents/enciclica--i-vix-pervenit--i---1-novembre-1745--poiche-e-venuto-.html",
    indexUrl: BENEDICT_XIV_INDEX,
    relatedDocuments: ["rerum-novarum"],
  }),
  doc({
    slug: "dominus-ac-redemptor",
    title: "Dominus ac Redemptor",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Clement XIV",
    issuedDate: "1773-07-21",
    summary:
      "The brief by which Clement XIV suppressed the Society of Jesus throughout the world. Opening from Christ the Prince of peace and the Pope's charge to preserve the peace of the Church, it recalls the religious orders that earlier popes had reformed or abolished once they had ceased to serve their purpose — among them the Templars under Clement V and the Humiliati under Saint Pius V — and then reviews the history of the Society: its approval by Paul III in 1540, the favours of later popes, and the long series of complaints, disputes and papal measures that had surrounded it, through the troubles of the pontificate of Clement XIII. Judging that peace could not otherwise be restored to the Church, the Pope declares the Society suppressed and extinguished, with all its offices, houses, colleges and statutes, including the provinces from which its members had already been expelled, and lays down how its former members, its works and its missions are to be provided for. The Society was restored throughout the world by Pius VII in 1814. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "Suppression of the Society of Jesus",
      "The papal power over religious orders",
      "Precedents of earlier suppressions",
      "The peace of the Church",
      "Provision for former Jesuits and their missions",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/clemens-xiv/it/documents/breve-dominus-ac-redemptor-21-luglio-1773.html",
    indexUrl: CLEMENT_XIV_INDEX,
    relatedDocuments: ["sollicitudo-omnium-ecclesiarum"],
  }),
  doc({
    slug: "auctorem-fidei",
    title: "Auctorem Fidei",
    documentType: "papal_bull",
    issuingAuthority: "Pope Pius VI",
    issuedDate: "1794-08-28",
    summary:
      "The bull in which Pius VI condemned the errors of the diocesan synod that Bishop Scipione de' Ricci had held at Pistoia, a synod shaped by Jansenist and Gallican ideas. After describing his efforts to bring the bishop to correct his course and the examination of the synod's acts by bishops and theologians, the Pope lists eighty-five propositions drawn from them, each with its own theological censure, ranging from heretical and schismatic to rash, false or offensive to pious ears. They concern the authority of the Church and of the Roman Pontiff, the powers claimed for bishops and parish priests in a synod, grace and fallen human nature, the limbo of unbaptised infants, the sacrifice of the Mass and the use of the vernacular in the liturgy, penance, indulgences and censures, devotion to the Sacred Heart of Jesus and the veneration of images, a plan to reform the religious orders, and marriage. The bull also rebukes the synod for adopting the Gallican Declaration of 1682 and forbids its acts. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "The Synod of Pistoia and Jansenism",
      "The authority of the Church and the Roman Pontiff",
      "Grace and fallen human nature",
      "The Mass, the sacraments and indulgences",
      "Devotion to the Sacred Heart",
      "Theological censures",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-vi/it/documents/bolla-auctorem-fidei-28-agosto-1794.html",
    indexUrl: PIUS_VI_INDEX,
    relatedDocuments: ["haurietis-aquas", "council-of-trent"],
  }),
  doc({
    slug: "sollicitudo-omnium-ecclesiarum",
    title: "Sollicitudo Omnium Ecclesiarum",
    documentType: "papal_bull",
    issuingAuthority: "Pope Pius VII",
    issuedDate: "1814-08-07",
    summary:
      "The bull by which Pius VII restored the Society of Jesus throughout the world, forty-one years after its suppression by Clement XIV. The Pope recalls that he had already allowed priests of the former Society living in the Russian Empire to remain united in one body under the rule of Saint Ignatius, at their own petition, and had later extended the same provision to the Kingdom of the Two Sicilies at the request of King Ferdinand; and that bishops and eminent persons from almost the whole Christian world were now asking him to restore the Society everywhere in view of the fruit it had borne in those lands. Judging that in such stormy times the Church should not refuse the help of experienced labourers, he grants to the superior general, Father Tadeusz Brzozowski, and to those he deputes the faculties to receive members, to open houses and colleges and to minister freely, and exhorts the restored Society to follow the example and rule of its founder. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "Restoration of the Society of Jesus",
      "The Society's survival in the Russian Empire",
      "The petitions of bishops and the faithful",
      "Faculties granted to the superior general",
      "Fidelity to the rule of Saint Ignatius",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-vii/it/documents/bolla-sollicitudo-omnium-7-agosto-1814.html",
    indexUrl: PIUS_VII_INDEX,
    relatedDocuments: ["dominus-ac-redemptor"],
  }),
  doc({
    slug: "mirari-vos",
    title: "Mirari Vos",
    documentType: "encyclical",
    issuingAuthority: "Pope Gregory XVI",
    issuedDate: "1832-08-15",
    summary:
      "The first encyclical of Gregory XVI, addressed to the bishops of the whole Church on the feast of the Assumption in 1832, after the upheavals that had marked the opening of his pontificate. It asks the bishops to guard the deposit of faith and the discipline of the Church against innovators, rejecting the idea that the Church needs to be restored or regenerated as though she could fail, and defends clerical celibacy and the holiness and indissolubility of Christian marriage. Its best-known pages condemn religious indifferentism — the view that eternal salvation can be reached by any profession of faith so long as one's morals are upright — together with the unrestricted liberty of conscience and of the press that the Pope saw as flowing from it, and the spread of teachings that undermined loyalty to lawful rulers. It also rejects the separation of Church and State. Although it names no one, it was widely read as a rejection of the liberal Catholic programme of Félicité de Lamennais. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "Fidelity to the deposit of faith",
      "Religious indifferentism",
      "Liberty of conscience and of the press",
      "Clerical celibacy and Christian marriage",
      "Church and State",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/gregorius-xvi/it/documents/encyclica-mirari-vos-15-augusti-1832.html",
    indexUrl: GREGORY_XVI_INDEX,
    relatedDocuments: ["quanta-cura", "qui-pluribus", "libertas-praestantissimum"],
  }),
  doc({
    slug: "in-supremo-apostolatus",
    title: "In Supremo Apostolatus",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Gregory XVI",
    issuedDate: "1839-12-03",
    summary:
      "The apostolic letter in the form of a brief in which Gregory XVI condemned the slave trade. Recalling how the spread of the Gospel had softened and gradually ended slavery among Christian peoples, and how his predecessors — Paul III in 1537, Urban VIII in 1639, Benedict XIV in 1741 and, in his own time, Pius VII — had condemned the enslavement of the native peoples of the Indies and worked to end the traffic in Africans, the Pope observes that the trade, though much diminished, was still carried on by many Christians. With the counsel of the cardinals he warns all the faithful that no one may unjustly harass, despoil or reduce to slavery Africans or any other human beings, or help those who do, and he condemns the traffic in Black Africans, treated as though they were not human beings, as unworthy of the Christian name. He forbids any cleric or lay person to defend it as lawful under any pretext, or to teach otherwise in public or in private. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "Condemnation of the slave trade",
      "The dignity of every human being",
      "The witness of earlier popes against slavery",
      "A prohibition on defending the trade",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/gregorius-xvi/it/documents/breve-in-supremo-3-dicembre-1839.html",
    indexUrl: GREGORY_XVI_INDEX,
    relatedDocuments: ["in-plurimis"],
  }),
  doc({
    slug: "qui-pluribus",
    title: "Qui Pluribus",
    documentType: "encyclical",
    issuingAuthority: "Pope Blessed Pius IX",
    issuedDate: "1846-11-09",
    summary:
      "The first encyclical of Blessed Pius IX, sent to the bishops of the whole Church a few months after his election. It surveys the attacks on the faith of the day: the rationalism that would submit divine revelation to the judgement of human reason, which the Pope answers by showing that faith and reason both come from God and cannot contradict each other, and that reason itself can recognise the evidence that God has spoken; indifference in matters of religion; the secret societies already condemned by his predecessors; the Bible societies that spread unauthorised vernacular versions of Scripture; the campaign against the Roman See; and communism, which he calls contrary to the natural law and destructive of property and of society itself. He then urges the bishops to vigilance and unity with the Holy See, to the careful choice and formation of candidates for the priesthood, to the spiritual exercises for the clergy, and to works of charity and peace among the faithful, and asks Catholic rulers to protect the Church. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "Faith and reason",
      "Rationalism and indifferentism",
      "Secret societies and Bible societies",
      "Communism and the natural law",
      "The formation of the clergy",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-ix/it/documents/enciclica-qui-pluribus-9-novembre-1846.html",
    indexUrl: PIUS_IX_INDEX,
    relatedDocuments: ["mirari-vos", "quanta-cura", "dei-filius"],
  }),
  doc({
    slug: "ineffabilis-deus",
    title: "Ineffabilis Deus",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Blessed Pius IX",
    issuedDate: "1854-12-08",
    summary:
      "The apostolic constitution in which Blessed Pius IX defined the dogma of the Immaculate Conception. The Pope first traces the belief through the life of the Church: the liturgical feast of the Conception and the constitutions of earlier popes, among them Sixtus IV and Alexander VII, that protected it; the Council of Trent's statement that its decree on original sin did not include the Blessed Virgin; the support of religious orders, theologians and bishops; and the testimony of the Fathers, who saw Mary prefigured in Noah's ark, Jacob's ladder and other figures of the Old Testament and honoured her as the new Eve. He recounts how he had consulted the bishops of the whole world and received an almost unanimous request for a definition, and how the cardinals in consistory had asked the same. He then declares, as a doctrine revealed by God and therefore to be firmly believed by all the faithful, that the Blessed Virgin Mary, in the first instant of her conception, by a singular grace and privilege of God and in view of the merits of Jesus Christ, was preserved free from every stain of original sin. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "The dogma of the Immaculate Conception",
      "Mary preserved from original sin",
      "The feast of the Conception and earlier popes",
      "The witness of the Fathers and the new Eve",
      "The consultation of the world's bishops",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-ix/it/documents/18541208-costituzione-apostolica-ineffabilis-deus.html",
    indexUrl: PIUS_IX_INDEX,
    relatedDocuments: ["lumen-gentium", "redemptoris-mater", "marialis-cultus"],
  }),
  doc({
    slug: "quanta-cura",
    title: "Quanta Cura",
    documentType: "encyclical",
    issuingAuthority: "Pope Blessed Pius IX",
    issuedDate: "1864-12-08",
    summary:
      "The encyclical in which Blessed Pius IX, ten years to the day after the definition of the Immaculate Conception, condemned what he judged the leading errors of the age, and with which the Syllabus of Errors was sent to the bishops of the world. The letter rejects naturalism, the principle that human society should be governed without any regard to religion, and with it the claim that unlimited liberty of conscience and of worship is a right owed to every person by the State; the idea that the will of the people, expressed through public opinion, is a supreme law independent of all divine and human right; socialism and communism; the subjection of the Church's authority to the civil power; and the attempt to remove the education of youth from the Church's influence. It closes by granting a plenary indulgence in the form of a jubilee, to be gained during one month of 1865. The Syllabus attached to it gathers eighty propositions already condemned in Pius IX's earlier allocutions and letters, arranged under ten headings that run from pantheism and rationalism to marriage, the civil princedom of the Pope and modern liberalism. The Holy See publishes the text in Latin.",
    keyThemes: [
      "Naturalism and the secular state",
      "Liberty of conscience and of worship",
      "Socialism and communism",
      "The rights of the Church",
      "The Syllabus of Errors",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-ix/la/documents/encyclica-quanta-cura-8-decembris-1864.html",
    indexUrl: PIUS_IX_INDEX,
    relatedDocuments: ["mirari-vos", "qui-pluribus", "immortale-dei", "dignitatis-humanae"],
  }),

  // ---------------------------------------------------------------------------
  // Pope Leo XIII
  // ---------------------------------------------------------------------------
  doc({
    slug: "inscrutabili-dei-consilio",
    title: "Inscrutabili Dei Consilio",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1878-04-21",
    summary:
      "The first encyclical of Leo XIII, given on Easter Sunday 1878, two months after his election, on the evils afflicting society. The Pope finds their source in the rejection of the authority of the Church, which upholds every lawful authority, and argues that a civilisation cut off from the truth and justice the Church guards deserves the name only in appearance; he recalls how much the Roman Pontiffs had done for the peoples of Europe and protests against the loss of the temporal sovereignty of the Holy See and the restraints placed on its freedom. He then asks the bishops to strengthen the bond between the faithful and the Chair of Peter, to see that the young are formed in sound doctrine and sound philosophy, and above all to defend Christian marriage and the Christian education of children in the family, from which the renewal of society must begin.",
    keyThemes: [
      "The evils of modern society",
      "The Church as the guardian of civilisation",
      "The freedom of the Holy See",
      "Christian marriage and family education",
      "Sound doctrine and philosophy",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_21041878_inscrutabili-dei-consilio.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["quod-apostolici-muneris", "aeterni-patris", "arcanum-divinae-sapientiae"],
  }),
  doc({
    slug: "quod-apostolici-muneris",
    title: "Quod Apostolici Muneris",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1878-12-28",
    summary:
      "An encyclical issued at the end of the first year of Leo XIII's pontificate on the movements he names as socialism, communism and nihilism, which he regarded as a mortal threat to society. Against their programme he sets out the Church's teaching on three foundations of social life: civil authority, which comes from God and must be obeyed in conscience while rulers must govern justly and will answer to God; the family, rooted in the unity and indissolubility of marriage; and the right of private property, protected by the natural law. The inequality of rights and of power among people comes from the Author of nature, but the Church obliges the rich to give of their abundance to the poor, honours poverty after the example of Christ, and has always cared for those in need. The Pope asks the bishops to teach these truths from childhood up and recommends societies of artisans and workers under the guardianship of religion — themes that Rerum Novarum would develop a little over twelve years later.",
    keyThemes: [
      "Socialism, communism and nihilism",
      "Authority from God and the duties of rulers",
      "Marriage and the family",
      "The right to private property",
      "Charity toward the poor and workers' associations",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_28121878_quod-apostolici-muneris.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["rerum-novarum", "inscrutabili-dei-consilio", "divini-redemptoris"],
  }),
  doc({
    slug: "arcanum-divinae-sapientiae",
    title: "Arcanum Divinae Sapientiae",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1880-02-10",
    summary:
      "Leo XIII's encyclical on Christian marriage. It begins from God's plan at creation — the union of one man and one woman, for life — traces how marriage was corrupted among the nations and how divorce came to be tolerated even under the Mosaic law, and shows how Christ restored it to its original unity and indissolubility and raised it to the dignity of a sacrament. It follows that the Church has received from Christ authority over the marriages of Christians, an authority she has used since the earliest centuries, and that the State cannot claim the whole of it or separate the sacrament from the contract; among the faithful a union that is not a sacrament is not a true marriage, whatever the civil law provides. The Pope then describes the harm that divorce does to spouses, children and society, credits the Church with defending the sanctity of marriage, asks rulers to work with her rather than against her, warns against marriages with those who are not Catholics, and asks pastors to bring those living together without marriage to a lawful union.",
    keyThemes: [
      "God's plan for marriage",
      "Unity and indissolubility",
      "Marriage as a sacrament",
      "The Church's authority over Christian marriage",
      "The harms of divorce",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_10021880_arcanum.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["casti-connubii", "humanae-vitae", "familiaris-consortio"],
  }),
  doc({
    slug: "diuturnum",
    title: "Diuturnum",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1881-06-29",
    summary:
      "An encyclical on the origin of civil power, written a few months after the assassination of Tsar Alexander II amid repeated attacks on rulers. Against the theory, popularised by the philosophers of the previous century, that all authority comes from the people and may be withdrawn by them, Leo XIII teaches that the right to rule comes from God, the author of nature, who made human beings for life in society. The people may in some cases choose who is to govern, but their choice designates the ruler and does not confer the authority itself; and the Church does not prefer one form of government to another, provided it is just and serves the common good. Citizens owe rulers obedience in conscience, the one exception being a command contrary to the natural or divine law, while rulers must govern as God does, for the good of those entrusted to them. The letter concludes that the Church, far from threatening the State, is its surest support.",
    keyThemes: [
      "The divine origin of civil authority",
      "Designation of rulers and the source of power",
      "Forms of government and the common good",
      "Obedience and its limits",
      "The duties of rulers",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_29061881_diuturnum.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["immortale-dei", "sapientiae-christianae", "libertas-praestantissimum"],
  }),
  doc({
    slug: "supremi-apostolatus-officio",
    title: "Supremi Apostolatus Officio",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1883-09-01",
    summary:
      "The first of Leo XIII's many encyclicals on the Rosary, written as the Church faced what he saw as grave dangers to faith and society. Recalling how the Church has always turned to the Mother of God in times of trial, and how Saint Dominic had answered the evils of his own age by leading people to meditate on the mysteries of salvation while seeking Mary's intercession, the Pope consecrated the whole month of October 1883 to the Queen of the Holy Rosary. From the first day of October to the second of November, in every parish church and, where the bishop judged it useful, in chapels dedicated to Our Lady, at least five decades of the Rosary were to be recited daily with the Litany of Loreto, and indulgences were granted to those who took part publicly or, when prevented, privately. The October devotions he established, renewed by his later Rosary encyclicals, made October the month of the Rosary in Catholic life.",
    keyThemes: [
      "The Rosary in times of trial",
      "Saint Dominic and the Rosary",
      "October dedicated to the Queen of the Holy Rosary",
      "Daily Rosary and the Litany of Loreto",
      "Indulgences for the October devotions",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_01091883_supremi-apostolatus-officio.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["quamquam-pluries", "rosarium-virginis-mariae"],
  }),
  doc({
    slug: "humanum-genus",
    title: "Humanum Genus",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1884-04-20",
    summary:
      "Leo XIII's encyclical on Freemasonry. It opens with Saint Augustine's image of the two cities, formed by two opposed loves, and places the Masonic movement among the forces ranged against the Church. The Pope objects to the secrecy and blind obedience demanded of members and identifies the movement's guiding principle as naturalism — the claim that human nature and reason should be the sole guide in all things — tracing its effects in religion, in the treatment of marriage as a dissoluble civil contract, in the secularisation of the education of youth, and in political doctrines that recognise no authority above the will of the people. Renewing the condemnations of his predecessors, he asks the bishops to expose the true nature of the sect, to instruct the faithful through preaching and pastoral letters, to promote the Third Order of Saint Francis, to revive the associations of workers once organised under the guidance of religion, and to give careful attention to the Christian education of the young.",
    keyThemes: [
      "Freemasonry and the Church",
      "The two cities of Saint Augustine",
      "Naturalism",
      "Marriage, education and the State",
      "Remedies: instruction, the Third Order, workers' guilds",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_18840420_humanum-genus.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["quod-apostolici-muneris", "immortale-dei"],
  }),
  doc({
    slug: "immortale-dei",
    title: "Immortale Dei",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1885-11-01",
    summary:
      "Leo XIII's encyclical on the Christian constitution of states. Because human beings are social by nature and all authority comes from God, the political community must honour God and favour religion. God has divided the care of the human race between two powers, the ecclesiastical and the civil, each supreme in its own order, and their right relationship is a harmony that the Pope compares to the union of soul and body. He contrasts this with the newer political principles that make the people the sole source of authority, treat all religions alike and subject the Church to the State, and recalls the condemnations of his predecessors. Yet he insists that no just form of government is condemned, that the people may rightly share in government, that rulers may for good reasons tolerate the public presence of other religions, and that no one is to be forced to embrace the Catholic faith against his will. Catholics are urged to take part in public life, including national politics, and to avoid quarrels that divide them.",
    keyThemes: [
      "The two powers, ecclesiastical and civil",
      "The State's duties toward God",
      "Critique of liberal political principles",
      "Tolerance and the freedom of the act of faith",
      "Catholic participation in public life",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_01111885_immortale-dei.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["diuturnum", "libertas-praestantissimum", "dignitatis-humanae"],
  }),
  doc({
    slug: "in-plurimis",
    title: "In Plurimis",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1888-05-05",
    summary:
      "An encyclical to the bishops of Brazil on the abolition of slavery. Leo XIII explains that of all the tributes he received for the golden jubilee of his priesthood none moved him more than the legal freeing of large numbers of slaves in Brazil, offered in his honour, and he takes the occasion to set out the Church's teaching. Slavery entered the world through sin and the pagan world treated slaves as chattels; Christ restored the brotherhood of the human race, and the Church, through the Apostles, the Fathers and the popes, worked patiently to soften the condition of slaves and to bring them to freedom. He recalls the protests of the Holy See against the enslavement of the peoples of the newly discovered lands, holds up Saint Peter Claver as a model, deplores the slave raids still carried on in parts of Africa, and rejoices at the measures by which Brazil was granting freedom to all who remained enslaved, counselling the newly freed to use their liberty well for their families and their country.",
    keyThemes: [
      "Abolition of slavery in Brazil",
      "Christ and the brotherhood of the human race",
      "The Church's long work against slavery",
      "The slave trade in Africa",
      "Saint Peter Claver",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_05051888_in-plurimis.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["in-supremo-apostolatus"],
  }),
  doc({
    slug: "libertas-praestantissimum",
    title: "Libertas Praestantissimum",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1888-06-20",
    summary:
      "Leo XIII's encyclical on the nature of human liberty, which he calls the highest of natural endowments, belonging only to beings endowed with intelligence. Natural liberty is the power to choose the means to an end; moral liberty is the right use of that power under the guidance of reason and law. Law — the eternal law, the natural law and the human laws derived from them — does not destroy freedom but directs it, and grace strengthens it. The Pope then examines the liberalism of his day, which makes human reason its own supreme law, and criticises in turn liberty of worship, of speech and the press, of teaching, and of conscience as liberalism understood them, distinguishing from these a true liberty of conscience, the freedom to do the will of God without hindrance. He explains when public authority may tolerate evil for the sake of a greater good or to avoid a greater evil, and concludes that liberty is truly served only where truth and justice are respected.",
    keyThemes: [
      "Natural and moral liberty",
      "Law as the guide of freedom",
      "Liberalism and its forms",
      "Freedoms of worship, speech, teaching and conscience",
      "Tolerance in public life",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_20061888_libertas.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["immortale-dei", "veritatis-splendor", "dignitatis-humanae"],
  }),
  doc({
    slug: "quamquam-pluries",
    title: "Quamquam Pluries",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1889-08-15",
    summary:
      "Leo XIII's encyclical on devotion to Saint Joseph, written as the Church faced grave difficulties and the month of October, already dedicated to the Rosary, approached. The Pope explains why Joseph is the special patron of the Church: as the husband of Mary and the reputed father of Jesus he was head of the Holy Family, the household in which the Church had its beginning, and he continues to watch over the household of God. He presents Joseph as a model for fathers of families, for the poor and for working people, since he was of royal descent yet earned his living by the work of his hands. Leo XIII prescribed that during October a prayer to Saint Joseph be added to the recitation of the Rosary, granted an indulgence for it, and asked that the faithful turn to Joseph with confidence; the prayer he gave in the encyclical remains widely used.",
    keyThemes: [
      "Saint Joseph, patron of the universal Church",
      "Joseph as head of the Holy Family",
      "A model for fathers and workers",
      "A prayer to Saint Joseph during October",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_15081889_quamquam-pluries.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["patris-corde", "supremi-apostolatus-officio"],
  }),
  doc({
    slug: "sapientiae-christianae",
    title: "Sapientiae Christianae",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1890-01-10",
    summary:
      "Leo XIII's encyclical on the chief duties of Christians as citizens. Love of one's country and obedience to its laws are duties of the natural law, but the love owed to the Church, which leads to eternal life, comes first, and when the law of the State commands what the law of God forbids, the Christian must obey God. The Pope sets out the duties that follow for Catholics: to know the faith, to profess it openly and to defend and spread it, each according to his state; to remain united in mind and action with the bishops and the Roman Pontiff, never dragging the Church into party strife; and to carry Christian principles into public life through upright conduct. He gives particular attention to the Christian family, where children are to be formed in faith and virtue, and explains that the Church binds herself to no political party and does not decide which form of government is best, provided religion and morality are respected.",
    keyThemes: [
      "Duties toward Church and country",
      "Obedience to God before human law",
      "Professing and defending the faith",
      "Unity with the bishops and the Pope",
      "The Christian family",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_10011890_sapientiae-christianae.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["immortale-dei", "diuturnum", "apostolicam-actuositatem"],
  }),
  doc({
    slug: "octobri-mense",
    title: "Octobri Mense",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1891-09-22",
    summary:
      "An encyclical on the Rosary, written as October, already consecrated to Our Lady of the Rosary, approached once more. Reflecting on the place of the Mother of God in the plan of redemption, Leo XIII recalls that at the Annunciation Mary gave her consent as it were in the name of all humanity, and teaches that by God's will she is the one through whom the immense treasury of mercy won by Christ is distributed to us: as no one comes to the Father except through the Son, so no one comes to Christ except through his Mother. From this he draws the reasons for confident prayer to her in the troubles of the age, and among the many ways of honouring her he singles out the Rosary, which recalls the great mysteries of the faith and which, he notes, Saint Dominic spread as a defence of the faith in a time of great danger. He renews his call for the October devotions and pictures the whole Catholic world praying to Mary with one voice.",
    keyThemes: [
      "Mary's place in the work of redemption",
      "Mary as the channel of the graces won by Christ",
      "Confident prayer to the Mother of God",
      "The Rosary and the October devotions",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_22091891_octobri-mense.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["supremi-apostolatus-officio", "redemptoris-mater"],
  }),
  doc({
    slug: "au-milieu-des-sollicitudes",
    title: "Au Milieu des Sollicitudes",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1892-02-16",
    summary:
      "Leo XIII's encyclical, written in French, to the bishops, clergy and faithful of France on the situation of the Church under the Third Republic. Urging Catholics to unite in defence of religion, the Pope distinguishes between forms of government — each of which can be good if it serves the common good — and the legislation enacted by those who hold power. When a new government has been constituted, accepting it is not merely permitted but required for the sake of the common good; yet respect for constituted power does not mean approving every law, and Catholics should combine to oppose by all lawful means the legislation hostile to religion. The letter defends the Concordat between France and the Holy See and rejects the separation of Church and State. It launched the policy known as the Ralliement, by which the Holy See asked French Catholics to rally to the Republic while working to change its anticlerical laws.",
    keyThemes: [
      "Catholics and the French Republic",
      "Constituted power and legislation",
      "Unity of Catholics for the defence of religion",
      "The Concordat",
      "Church and State",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_16021892_au-milieu-des-sollicitudes.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["immortale-dei", "sapientiae-christianae"],
  }),
  doc({
    slug: "laetitiae-sanctae",
    title: "Laetitiae Sanctae",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1893-09-08",
    summary:
      "An encyclical in which Leo XIII commends the Rosary as a remedy for the ills of society. He names three influences that he saw dragging society downward — a distaste for a simple and laborious life, a repugnance to suffering of any kind, and forgetfulness of the life to come — and sets against each one part of the Rosary, which joins a fixed order of prayer to meditation on the life of Christ and his Mother. The Joyful Mysteries, centred on the home of Nazareth, teach the dignity of humble work, family life and contentment with one's state; the Sorrowful Mysteries teach patience and the value of suffering borne with Christ; and the Glorious Mysteries keep before the mind the unseen goods that God has prepared for those who love him, without diminishing love of one's earthly country. The Pope asks for renewed zeal in founding and directing the Confraternities of the Rosary, a work in which the sons of Saint Dominic have a leading part.",
    keyThemes: [
      "The Rosary as a remedy for social ills",
      "The Joyful Mysteries and the dignity of humble work",
      "The Sorrowful Mysteries and patience in suffering",
      "The Glorious Mysteries and the life to come",
      "Confraternities of the Rosary",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_08091893_laetitiae-sanctae.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["supremi-apostolatus-officio", "octobri-mense", "rosarium-virginis-mariae"],
  }),
  doc({
    slug: "longinqua-oceani",
    title: "Longinqua Oceani",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1895-01-06",
    summary:
      "Leo XIII's encyclical to the archbishops and bishops of the United States on Catholicism in their country. Looking across the ocean, the Pope rejoices at the rapid growth of the Church in the young republic and recalls what he had done for it: promoting the Third Plenary Council of Baltimore, founding a Catholic university at Washington under the authority of the Apostolic See, and establishing an Apostolic Delegation. He acknowledges the freedom the Church enjoys under American law but cautions against concluding that the American arrangement of Church and State is the model to be sought everywhere, since the Church would bear still more fruit if, besides liberty, she enjoyed the favour of the laws. He then addresses the unity and indissolubility of marriage, the duties of citizens, the right of workers to form associations and the care needed in joining societies, the responsibilities of Catholic writers, and the evangelisation of Native Americans and Black Americans.",
    keyThemes: [
      "The Church in the United States",
      "The Third Plenary Council of Baltimore",
      "The Catholic university at Washington",
      "Church and State in America",
      "Workers' associations and the Catholic press",
      "Missions among Native and Black Americans",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_06011895_longinqua.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["testem-benevolentiae", "rerum-novarum"],
  }),
  doc({
    slug: "satis-cognitum",
    title: "Satis Cognitum",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1896-06-29",
    summary:
      "Leo XIII's encyclical on the unity of the Church, written to help bring back to the one fold those who had strayed from it. Christ founded one Church, at once visible and invisible, like a living body animated by its soul, and willed that she be one in faith and one in government. Unity of faith is secured by a living, authoritative and perpetual teaching office, given by Christ to the Apostles and continued in their successors, whose teaching must be accepted whole, since rejecting even one revealed truth breaks that unity. Unity of government rests on Peter, whom Christ made the foundation of the Church, and on the Roman Pontiffs who succeed to his primacy of jurisdiction over the whole Church. The bishops, as successors of the Apostles, are true shepherds of their flocks, but they exercise their authority in communion with and under the successor of Peter, and bishops who deliberately separate themselves from him lose the right and power to govern.",
    keyThemes: [
      "The one Church founded by Christ",
      "The Church as visible and invisible",
      "Unity of faith and the magisterium",
      "The primacy of Peter and his successors",
      "Bishops in communion with the Pope",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_29061896_satis-cognitum.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["pastor-aeternus", "lumen-gentium", "mystici-corporis-christi"],
  }),
  doc({
    slug: "annum-sacrum",
    title: "Annum Sacrum",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1899-05-25",
    summary:
      "The encyclical in which Leo XIII announced the consecration of the whole human race to the Sacred Heart of Jesus. Building on his predecessors' promotion of the devotion and on his own decree of 1889 raising the rank of the feast of the Sacred Heart, he explains the twofold title by which Christ rules over all people — by nature, as the Son of God, and by right of conquest, as the Redeemer who purchased humanity with his blood — and teaches that his empire extends not only to Catholics but also to the baptised who are separated from the Church and to all who have never received the faith. To this the faithful may add the free gift of consecration, and since the Heart of Jesus is the symbol of his infinite love, consecration to it is an offering of oneself to Christ. Seeing in the Sacred Heart surmounted by a cross a sign of hope for a troubled age, as the cross had been for Constantine, the Pope ordered prayers on 9, 10 and 11 June in the principal church of every town and village, with the Litany of the Sacred Heart, and the recitation on the last day of the act of consecration he sent with the letter.",
    keyThemes: [
      "Consecration of the human race to the Sacred Heart",
      "The universal kingship of Christ",
      "The Sacred Heart as the symbol of Christ's love",
      "Christ's rule over states and public life",
      "The triduum and act of consecration of June 1899",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_25051899_annum-sacrum.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["quas-primas", "haurietis-aquas", "dilexit-nos"],
  }),
  doc({
    slug: "tametsi-futura-prospicientibus",
    title: "Tametsi Futura Prospicientibus",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1900-11-01",
    summary:
      "Leo XIII's encyclical on Jesus Christ the Redeemer, written as the nineteenth century closed amid what the Pope saw as signs of a revival of faith. Reminding a world that wished to order its life without God that there is salvation in no one but Christ, whose redemption is not a past event but a permanent source of life, he takes Christ's words in Saint John's Gospel as his outline. Christ is the Way, since no one reaches God, the last end of human life, except through him, and nations as well as individuals go astray when they leave that road; he is the Truth, to whom the human mind must submit in faith and whose teaching the Church guards; and he is the Life, the source of the grace without which the moral law cannot be kept and society cannot be renewed. Judging that ignorance more than ill will keeps people from Christ, the Pope asks the bishops and the whole clergy to make him truly known, so that the new century might be won back to him.",
    keyThemes: [
      "Christ the Redeemer of humanity",
      "Christ the Way, the Truth and the Life",
      "The kingship of Christ over nations",
      "Grace and the moral life",
      "Making Christ known",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_01111900_tametsi-futura-prospicientibus.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["redemptor-hominis", "annum-sacrum", "quas-primas"],
  }),
  doc({
    slug: "graves-de-communi-re",
    title: "Graves de Communi Re",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1901-01-18",
    summary:
      "Leo XIII's encyclical on Christian democracy, written to settle the disputes that had arisen among Catholics over the name and character of the social action inspired by Rerum Novarum. The Pope contrasts social democracy, which recognises nothing above the natural order, would level all ranks and introduce the community of goods, with Christian democracy, which rests on the principles of faith, holds justice sacred, respects the right to property, and seeks to improve the condition of the people for the good of their souls as well as their bodies. He insists that the term be used without any political meaning — not as a preference for popular government but simply as beneficent Christian action on behalf of the people — and that it neither neglect the upper classes nor weaken obedience to lawful authority. The social question, he explains, is not merely economic but above all moral and religious, and charity perfects justice. Catholic social works are to act in unity, coordinated in Italy by the Opera dei Congressi under the authority of the bishops.",
    keyThemes: [
      "Christian democracy and social democracy",
      "Beneficent action for the people",
      "The social question as a moral and religious question",
      "Justice and charity",
      "Unity of Catholic social action under the bishops",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_18011901_graves-de-communi-re.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["rerum-novarum", "quod-apostolici-muneris", "il-fermo-proposito"],
  }),
  doc({
    slug: "mirae-caritatis",
    title: "Mirae Caritatis",
    documentType: "encyclical",
    issuingAuthority: "Pope Leo XIII",
    issuedDate: "1902-05-28",
    summary:
      "Leo XIII's encyclical on the Holy Eucharist, given on the vigil of Corpus Christi in the twenty-fifth year of his pontificate. Having written throughout his reign on the manifestations of Christ's love, the Pope turns to the sacrament in which Christ himself is present. The Eucharist is the mystery of faith that strengthens the mind against the errors of the age; it nourishes hope and every virtue; and, as the memorial of Christ's passion, it calls Christians to penance and self-denial. Finding at the root of the evils of society a cooling of charity toward God and neighbour, he presents the Eucharist as the source of charity, binding the faithful together and reaching through the sacrifice of the Mass to the whole communion of saints, including the souls in purgatory; it is, he says, as it were the soul of the Church. He urges frequent Communion, observing that Christian life has flourished wherever it was practised, and asks that the sacrifice of the Mass be honoured with renewed outward reverence and inward devotion.",
    keyThemes: [
      "The Eucharist as the mystery of faith",
      "The Eucharist and the Christian virtues",
      "The Eucharist as the source of charity",
      "The sacrifice of the Mass and the communion of saints",
      "Frequent Communion",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_28051902_mirae-caritatis.html",
    indexUrl: LEO_XIII_ENCYCLICALS,
    relatedDocuments: ["mysterium-fidei", "ecclesia-de-eucharistia", "sacramentum-caritatis"],
  }),

  // ---------------------------------------------------------------------------
  // Pope Saint Pius X
  // ---------------------------------------------------------------------------
  doc({
    slug: "e-supremi",
    title: "E Supremi",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1903-10-04",
    summary:
      "The first encyclical of Saint Pius X, written two months after his election, in which he announced the programme of his pontificate: to restore all things in Christ. The Pope speaks of his reluctance to accept the office and of the great evil of the age, a turning away from God; the only remedy is to bring people back to God through Christ, and the way to Christ is the Church. The means, he says, are plain. First comes the formation of holy priests, so that the seminaries must be the bishops' chief concern and flourish in sound teaching and blameless conduct; then religious instruction, since many oppose Christ more from ignorance than from malice; and in all things charity, because souls are won by patience and kindness rather than bitter zeal. He also calls on all the faithful, and lay associations working under the bishops' guidance, to share in the work of restoring society to Christ.",
    keyThemes: [
      "Restoring all things in Christ",
      "The Church as the way to Christ",
      "The holiness and formation of priests",
      "Religious instruction",
      "Charity and the lay apostolate",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/en/encyclicals/documents/hf_p-x_enc_04101903_e-supremi.html",
    indexUrl: PIUS_X_ENCYCLICALS,
    relatedDocuments: ["acerbo-nimis", "il-fermo-proposito", "haerent-animo"],
  }),
  doc({
    slug: "tra-le-sollecitudini",
    title: "Tra le Sollecitudini",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1903-11-22",
    summary:
      "The motu proprio on sacred music issued by Saint Pius X in the first months of his pontificate, together with an instruction to which he gave the force of law as a juridical code of sacred music. Its introduction explains that the faithful draw the true Christian spirit from its first and indispensable source, active participation in the sacred mysteries and in the public prayer of the Church, and that nothing in church should disturb that prayer. Sacred music must share the qualities of the liturgy — holiness, beauty of form and, as a result, universality. Gregorian chant is the music proper to the Roman Church and its supreme model, to be restored widely, including among the people; classical polyphony, above all that of Palestrina, comes next, while the theatrical style is excluded. The instruction requires Latin in solemn liturgical functions and the integrity of the liturgical texts, treats singers as holding a liturgical office (a role it reserved to men and boys), allows the organ but forbids the piano and noisy instruments in church, and asks every diocese to set up a commission for sacred music. The Holy See publishes the text on vatican.va in Italian, Latin, Spanish and Portuguese.",
    keyThemes: [
      "Active participation in the liturgy",
      "Holiness, beauty and universality of sacred music",
      "Gregorian chant as the supreme model",
      "Classical polyphony",
      "Norms for texts, singers and instruments",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/it/motu_proprio/documents/hf_p-x_motu-proprio_19031122_sollecitudini.html",
    indexUrl: PIUS_X_MOTU_PROPRIO,
    relatedDocuments: ["sacrosanctum-concilium", "mediator-dei"],
  }),
  doc({
    slug: "ad-diem-illum-laetissimum",
    title: "Ad Diem Illum Laetissimum",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1904-02-02",
    summary:
      "Saint Pius X's encyclical for the fiftieth anniversary of the definition of the Immaculate Conception. Linking the jubilee to his programme of restoring all things in Christ, the Pope explains that there is no surer or easier way to Christ than through Mary: she gave the Son of God his human flesh, lived united with him for thirty years in the intimacy of family life, and stood by him in his passion, so that as mother of Christ she is mother of all the members of his mystical body. Because of this companionship in suffering she became the most powerful mediatrix and dispenser of the graces that Christ alone merited, he remaining by nature the one mediator between God and humanity. True devotion to Mary therefore means imitating her virtues, above all faith, hope and charity, and the dogma itself, which presupposes original sin and the need of redemption, answers the errors of the age. To mark the anniversary the Pope proclaimed an extraordinary jubilee with a plenary indulgence.",
    keyThemes: [
      "Fiftieth anniversary of the Immaculate Conception",
      "Through Mary to Christ",
      "Mary, mother of the members of Christ's body",
      "Mary's mediation and the one Mediator",
      "Imitation of Mary's faith, hope and charity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/en/encyclicals/documents/hf_p-x_enc_02021904_ad-diem-illum-laetissimum.html",
    indexUrl: PIUS_X_ENCYCLICALS,
    relatedDocuments: ["ineffabilis-deus", "e-supremi", "redemptoris-mater"],
  }),
  doc({
    slug: "acerbo-nimis",
    title: "Acerbo Nimis",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1905-04-15",
    summary:
      "Saint Pius X's encyclical on teaching Christian doctrine. The Pope finds a chief cause of the decline of faith and morals in widespread ignorance of religion, among the educated as well as the uneducated, since the will cannot be upright where the mind is shrouded in ignorance. The duty of dispelling it falls on every pastor of souls and above all on parish priests, whose first task, as the Council of Trent taught, is the instruction of the faithful; teaching the catechism may win little praise, but it is more fruitful than eloquent preaching. He then lays down binding norms: an hour of catechism for boys and girls every Sunday and holy day; instruction over several days to prepare children for confession and confirmation, and in Lent for first Communion; the canonical establishment of the Confraternity of Christian Doctrine in every parish, so that lay people help in the teaching; religion classes in the cities for young people attending schools from which religion is excluded; and catechism for adults on holy days, in plain language adapted to the hearers.",
    keyThemes: [
      "Religious ignorance as a cause of moral decline",
      "The catechetical duty of parish priests",
      "Weekly catechism for children",
      "The Confraternity of Christian Doctrine",
      "Catechesis of adults",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/en/encyclicals/documents/hf_p-x_enc_15041905_acerbo-nimis.html",
    indexUrl: PIUS_X_ENCYCLICALS,
    relatedDocuments: ["e-supremi", "catechism-of-the-catholic-church"],
  }),
  doc({
    slug: "il-fermo-proposito",
    title: "Il Fermo Proposito",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1905-06-11",
    summary:
      "Saint Pius X's encyclical to the bishops of Italy on Catholic Action, given on Pentecost 1905. Under that name the Pope gathers the many works by which lay Catholics, in union with the Church's pastors, defend the rights of the Church and seek to restore Jesus Christ to the family, the school and society — and above all to resolve the social question according to Christian principles, as Leo XIII had taught in Rerum Novarum. He commends the organisation of these works around a general Popular Union, with the economic and social institutions grouped about it, and insists that Catholic Action, being a true apostolate, depends on grace and on the virtue of those who take part in it, and that the works serving the Church's spiritual mission are subject to the bishops. While keeping in force the general rule that Catholics in Italy should take no part in parliamentary politics, he allows exceptions where bishops judge the good of souls requires it, and urges Catholics to prepare themselves for political life. He also warns priests not to let social activity crowd out the duties of their ministry.",
    keyThemes: [
      "Catholic Action and the lay apostolate",
      "Restoring Christ to family, school and society",
      "The social question",
      "Catholic Action and the bishops",
      "Catholics and political life in Italy",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/en/encyclicals/documents/hf_p-x_enc_11061905_il-fermo-proposito.html",
    indexUrl: PIUS_X_ENCYCLICALS,
    relatedDocuments: ["rerum-novarum", "graves-de-communi-re", "apostolicam-actuositatem"],
  }),
  doc({
    slug: "haerent-animo",
    title: "Haerent Animo",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1908-08-04",
    summary:
      "The apostolic exhortation that Saint Pius X addressed to the Catholic clergy on the fiftieth anniversary of his own ordination to the priesthood. Convinced that the future of the Church depends on the quality of her priests, he urges them to the holiness their office demands: the priest acts in the name of Christ, and, as Christ himself did, he must teach first by example and then by word. Priestly holiness does not consist simply in spending oneself in activity for others; it rests on the so-called passive virtues, such as humility and obedience, and on union with God, nourished by prayer. The Pope dwells on the necessity of daily meditation and the harm that follows from neglecting it, on spiritual reading and especially the reading of Scripture, and on the daily examination of conscience; he grieves over the faults of some clergy and sets out their present duties; and he recommends the annual spiritual exercises, a monthly retreat, and associations by which priests can support one another. The Holy See publishes the text on vatican.va in Italian and Latin.",
    keyThemes: [
      "The holiness of the priest",
      "Example before word",
      "The passive virtues and union with God",
      "Meditation, spiritual reading and examination of conscience",
      "Retreats and priestly fraternity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/it/apost_exhortations/documents/hf_p-x_exh_19080804_haerent-animo.html",
    indexUrl: PIUS_X_EXHORTATIONS,
    relatedDocuments: ["e-supremi", "presbyterorum-ordinis", "sacerdotalis-caelibatus"],
  }),
  doc({
    slug: "sacrorum-antistitum",
    title: "Sacrorum Antistitum",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1910-09-01",
    summary:
      "The motu proprio by which Saint Pius X laid down laws to resist Modernism, three years after the encyclical Pascendi. Observing that the Modernists had not abandoned their aims, the Pope repeats and makes binding the disciplinary measures of that encyclical: scholastic philosophy as the foundation of sacred studies; the careful choice of seminary superiors, professors and candidates for orders; the bishops' vigilance over books, periodicals and publishing, with limits on clerics directing newspapers; restrictions on gatherings of priests; norms for preaching; and a council of vigilance in every diocese. He adds that professors must submit their texts or theses to the bishop, and prescribes an oath against Modernism, to be taken together with the profession of faith of Pius IV by clerics before major orders, by confessors and preachers before receiving their faculties, by parish priests and canons, by officials of diocesan curias and Roman congregations, and by seminary and university teachers. The oath remained in force until 1967. The Holy See publishes the text in Latin.",
    keyThemes: [
      "Measures against Modernism",
      "Scholastic philosophy in sacred studies",
      "Vigilance over teaching and publications",
      "Councils of vigilance",
      "The oath against Modernism",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/la/motu_proprio/documents/hf_p-x_motu-proprio_19100901_sacrorum-antistitum.html",
    indexUrl: PIUS_X_MOTU_PROPRIO,
    relatedDocuments: ["pascendi-dominici-gregis", "humani-generis"],
  }),
  doc({
    slug: "divino-afflatu",
    title: "Divino Afflatu",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1911-11-01",
    summary:
      "The apostolic constitution by which Saint Pius X reorganised the Psalter in the Roman Breviary, issued on the feast of All Saints 1911. The Pope praises the Psalms, composed under divine inspiration, as the heart of the Church's prayer, and explains that over the centuries the multiplication of the offices of the saints had pushed aside the Sunday and weekday offices, so that many psalms were seldom said; bishops, notably at the First Vatican Council, had asked that the ancient custom of reciting the whole Psalter every week be restored without adding to the burden of the clergy. He therefore abolishes the existing distribution of the psalms and, from 1 January 1913, prescribes a new arrangement for all who are bound to the Roman Breviary, with rubrics that restore the Sunday and weekday psalmody; he presents this as a first step toward the reform of the Breviary and the Missal, for which a commission would be appointed. The Holy See publishes the text in Latin.",
    keyThemes: [
      "The Psalms in the Church's prayer",
      "Reform of the Roman Breviary",
      "The whole Psalter each week",
      "The Sunday and weekday office",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/la/apost_constitutions/documents/hf_p-x_apc_19111101_divino-afflatu.html",
    indexUrl: PIUS_X_CONSTITUTIONS,
    relatedDocuments: ["sacrosanctum-concilium", "tra-le-sollecitudini"],
  }),
  doc({
    slug: "lacrimabili-statu",
    title: "Lacrimabili Statu",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint Pius X",
    issuedDate: "1912-06-07",
    summary:
      "Saint Pius X's encyclical to the archbishops and bishops of Latin America on the condition of the native peoples of South America. Recalling that Benedict XIV had pleaded their cause in 1741, and that slavery properly so called had since been abolished in Brazil and elsewhere with the encouragement of the Church, the Pope deplores reports that in many regions Indians were still being enslaved, sold, robbed and treated with appalling cruelty out of greed, women and children not excepted. He asks the bishops to make the cause their special concern and to support every work for the Indians' good; announces that, hoping for the support of the civil authorities, the Holy See was opening new mission stations where they could find safety and help; and renews the condemnation of all who enslave or traffic in them or teach that it is lawful, reserving absolution for these crimes to the local ordinaries.",
    keyThemes: [
      "The native peoples of South America",
      "Condemnation of enslavement and exploitation",
      "The pastoral duty of bishops",
      "New mission stations",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-x/en/encyclicals/documents/hf_p-x_enc_07061912_lacrimabili-statu.html",
    indexUrl: PIUS_X_ENCYCLICALS,
    relatedDocuments: ["in-supremo-apostolatus", "in-plurimis"],
  }),

  // ---------------------------------------------------------------------------
  // Pope Benedict XV
  // ---------------------------------------------------------------------------
  doc({
    slug: "ad-beatissimi-apostolorum",
    title: "Ad Beatissimi Apostolorum",
    documentType: "encyclical",
    issuingAuthority: "Pope Benedict XV",
    issuedDate: "1914-11-01",
    summary:
      "The first encyclical of Benedict XV, issued on the feast of All Saints 1914, in the first months of the First World War. Grieving over the slaughter, the Pope begs rulers to end the war and looks for its deeper causes in four disorders of modern society: the absence of mutual love among people, contempt for authority, injustice and strife between social classes, and an all-absorbing desire for material goods. Against each he sets the teaching of the Gospel — the new commandment of charity, authority grounded in God, the Christian ordering of social relations, and the detachment that seeks lasting goods. Turning to the life of the Church, he condemns Modernism anew, asks Catholics to drop the labels by which they had begun to divide themselves into factions, urges priests to close union with their bishops, and laments that the Church has lacked full freedom since the Roman Pontiff was deprived of the protection of his temporal sovereignty. He closes with a prayer for peace.",
    keyThemes: [
      "An appeal for peace in the First World War",
      "Four causes of social disorder",
      "Charity and respect for authority",
      "Unity among Catholics",
      "The freedom of the Holy See",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_01111914_ad-beatissimi-apostolorum.html",
    indexUrl: BENEDICT_XV_ENCYCLICALS,
    relatedDocuments: ["pacem-dei-munus-pulcherrimum", "pascendi-dominici-gregis"],
  }),
  doc({
    slug: "providentissima-mater-ecclesia",
    title: "Providentissima Mater Ecclesia",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Benedict XV",
    issuedDate: "1917-05-27",
    summary:
      "The apostolic constitution by which Benedict XV promulgated the Code of Canon Law, the first comprehensive codification of the law of the Latin Church, given at Saint Peter's on Pentecost 1917. The Pope recalls that the Church, as a perfect society, has always had her own laws, but that the canons accumulated over many centuries had become difficult to know and apply, so that Saint Pius X, by his motu proprio Arduum Sane of 1904, ordered them gathered into a single code. He describes the work: canonists from Rome and many nations, coordinated by Cardinal Pietro Gasparri; a commission of cardinals; and the sending of the finished draft to the bishops of the whole world and to the superiors of religious orders for their observations. Having reviewed the whole, he promulgates the Code with perpetual force and decrees that it take effect from Pentecost of the following year, 19 May 1918. This Code governed the Latin Church until it was replaced by the Code of 1983. The Holy See publishes the text on vatican.va in Italian.",
    keyThemes: [
      "Promulgation of the 1917 Code of Canon Law",
      "The codification begun by Saint Pius X",
      "Consultation of the world's bishops",
      "The Code's entry into force in 1918",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xv/it/bulls/documents/hf_ben-xv_bulls_19170527_providentissima-mater.html",
    indexUrl: BENEDICT_XV_BULLS,
    relatedDocuments: ["code-of-canon-law-1983"],
  }),
  doc({
    slug: "humani-generis-redemptionem",
    title: "Humani Generis Redemptionem",
    documentType: "encyclical",
    issuingAuthority: "Pope Benedict XV",
    issuedDate: "1917-06-15",
    summary:
      "Benedict XV's encyclical on the preaching of the Word of God, given on the feast of the Sacred Heart in 1917. The Pope observes that preachers had perhaps never been so numerous, yet public and private morals showed little fruit, and traces the failure to three causes: the wrong people are chosen to preach, they preach with the wrong intention, or they preach in the wrong way. Preaching is the paramount duty of bishops, as the Council of Trent taught, and they must entrust it only to those able to exercise it with profit to souls, examining the character and learning of preachers as carefully as those of confessors. The preacher's aim must be the salvation of souls rather than applause or display; his matter, the truths of faith and the moral law; and his manner, that of Saint Paul, who preached Christ crucified rather than the persuasive words of human wisdom and drew his power from prayer and a holy life.",
    keyThemes: [
      "The ministry of preaching",
      "Preaching as the duty of bishops",
      "The fitness of preachers",
      "Right intention and right method",
      "Saint Paul as the model preacher",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_15061917_humani-generis-redemptionem.html",
    indexUrl: BENEDICT_XV_ENCYCLICALS,
    relatedDocuments: ["evangelii-nuntiandi", "verbum-domini"],
  }),
  doc({
    slug: "pacem-dei-munus-pulcherrimum",
    title: "Pacem, Dei Munus Pulcherrimum",
    documentType: "encyclical",
    issuingAuthority: "Pope Benedict XV",
    issuedDate: "1920-05-23",
    summary:
      "Benedict XV's encyclical on peace and Christian reconciliation, given on Pentecost 1920 after the treaties that ended the First World War. The Pope rejoices that peace has at last been signed but warns that it cannot last if hatred and hostility survive among the nations. He recalls the Gospel precept of mutual charity and the command to forgive and to love one's enemies, and asks the bishops to lead the faithful to lay aside bitterness and to support the works of charity needed in lands devastated by war and famine. What he asks of individuals he asks also of peoples, who should resume friendly relations so far as justice allows. To encourage concord he relaxes the restrictions his predecessors had placed on official visits to Rome by the heads of Catholic states, while renewing the Holy See's protest over its situation, and he expresses the hope that all states might unite in a league, a kind of family of nations, to safeguard their independence and the order of human society, a work to which the Church would gladly lend her help.",
    keyThemes: [
      "Peace after the First World War",
      "Forgiveness and love of enemies",
      "Charity toward the victims of war",
      "Reconciliation between nations",
      "A league of nations",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_23051920_pacem-dei-munus-pulcherrimum.html",
    indexUrl: BENEDICT_XV_ENCYCLICALS,
    relatedDocuments: ["ad-beatissimi-apostolorum", "pacem-in-terris"],
  }),
  doc({
    slug: "spiritus-paraclitus",
    title: "Spiritus Paraclitus",
    documentType: "encyclical",
    issuingAuthority: "Pope Benedict XV",
    issuedDate: "1920-09-15",
    summary:
      "Benedict XV's encyclical on Saint Jerome, written for the fifteenth centenary of his death. It recounts Jerome's life — his studies in Rome, his years in the desert and at Constantinople, the revision of the Latin Bible entrusted to him by Pope Damasus, and his long labours at Bethlehem — and then sets out his teaching on Scripture as the teaching of the whole Church: the sacred books, written under the inspiration of the Holy Spirit, have God for their author and are wholly free from error. On that basis the Pope rejects recent attempts to confine inerrancy to the religious or primary elements of the Bible, to treat its historical passages as recording only relative truth or popular opinion, or to undermine the historical trustworthiness of the Gospels. He closes with Jerome's counsel to all who study and love Scripture — piety, humility and daily reading of the sacred text — and commends the Society of Saint Jerome, which he had helped to found to put the Gospels and Acts into the hands of as many families as possible.",
    keyThemes: [
      "Saint Jerome, Doctor of Scripture",
      "Inspiration and inerrancy of Scripture",
      "The historical truth of the Bible",
      "Daily reading of Scripture",
      "The Society of Saint Jerome",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_15091920_spiritus-paraclitus.html",
    indexUrl: BENEDICT_XV_ENCYCLICALS,
    relatedDocuments: ["providentissimus-deus", "divino-afflante-spiritu", "dei-verbum"],
  }),
  doc({
    slug: "principi-apostolorum-petro",
    title: "Principi Apostolorum Petro",
    documentType: "encyclical",
    issuingAuthority: "Pope Benedict XV",
    issuedDate: "1920-10-05",
    summary:
      "Benedict XV's encyclical on Saint Ephrem the Syrian, in which he declared Ephrem a Doctor of the Universal Church. Opening from the primacy of Peter and the recourse of the great Eastern Fathers to the Apostolic See, and rejoicing that many Eastern Christians had regained their freedom after the war, the Pope presents Ephrem alongside Jerome, whom he had just honoured: near contemporaries, both monks living in Syria and devoted to the Scriptures, two lights for the East and the West. He recounts Ephrem's life at Nisibis and Edessa, his humility in remaining a deacon, his charity during a famine, and his vast work of commentaries, sermons and hymns, which earned him the name of lyre of the Holy Spirit and show how poetry and music can serve sacred doctrine. Invoking the Holy Spirit, he confers on Ephrem the title and honours of Doctor of the Universal Church, with his feast on 18 June, and prays for the return of the separated Eastern Churches to unity with Rome.",
    keyThemes: [
      "Saint Ephrem, Doctor of the Universal Church",
      "The Eastern Fathers and the Apostolic See",
      "Ephrem's life at Nisibis and Edessa",
      "Hymnody in the service of doctrine",
      "Unity with the Eastern Churches",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_05101920_principi-apostolorum-petro.html",
    indexUrl: BENEDICT_XV_ENCYCLICALS,
    relatedDocuments: ["spiritus-paraclitus", "orientalium-ecclesiarum"],
  }),
  doc({
    slug: "in-praeclara-summorum",
    title: "In Praeclara Summorum",
    documentType: "encyclical",
    issuingAuthority: "Pope Benedict XV",
    issuedDate: "1921-04-30",
    summary:
      "Benedict XV's encyclical to teachers and students of letters and learning for the sixth centenary of the death of Dante Alighieri. The Pope claims Dante for the Church, which has a special right to call him her own, and recalls that he had already supported the restoration of the church at Ravenna where the poet is buried. He shows how the Divine Comedy and Dante's other works rest on the Catholic faith: reverence for Scripture, whose principal author is God; respect for the authority of the Church and of the Roman Pontiff; and a treasury of Christian philosophy and theology, including the principles of justice by which states should be governed. Dante's genius, the Pope argues, was not hindered but raised by his faith, which refutes the claim that obedience to God stifles learning and shows the harm of banishing religion from education; he asks students to continue to love and study the poet, whose greatness owes so much to the faith.",
    keyThemes: [
      "Sixth centenary of Dante's death",
      "Dante's Catholic faith",
      "Scripture and the authority of the Church in Dante",
      "Faith as the inspiration of art and learning",
      "Religion in education",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_30041921_in-praeclara-summorum.html",
    indexUrl: BENEDICT_XV_ENCYCLICALS,
    relatedDocuments: ["aeterni-patris"],
  }),

  // ---------------------------------------------------------------------------
  // Pope Pius XI
  // ---------------------------------------------------------------------------
  doc({
    slug: "ubi-arcano-dei-consilio",
    title: "Ubi Arcano Dei Consilio",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1922-12-23",
    summary:
      "The first encyclical of Pius XI, on the peace of Christ in the kingdom of Christ. Surveying a world that four years after the Great War had still not found true peace, the Pope describes the resentments between nations, the war between classes, the weakening of family life and the general unrest, and traces them to the threefold concupiscence of the flesh, of the eyes and of the pride of life, and to the banishing of God and of Christ from public life and from the school. Real peace cannot be produced by treaties alone; it is the peace of Christ, founded on justice and made gentle by charity, and it can exist only where Christ reigns over individuals, families and nations, with the Church as the sure guide of consciences. Uniting the programmes of his two predecessors, the Pope takes as his own motto the peace of Christ in the kingdom of Christ. He condemns a social, legal and moral modernism alongside the theological, calls the laity to share in the apostolate in union with their bishops, speaks cautiously of reconvening the interrupted Vatican Council, and voices his sorrow at the unresolved Roman Question with Italy.",
    keyThemes: [
      "The peace of Christ in the kingdom of Christ",
      "The causes of unrest after the Great War",
      "Justice and charity as the foundations of peace",
      "The lay apostolate",
      "Social and moral modernism",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_19221223_ubi-arcano-dei-consilio.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["quas-primas", "e-supremi", "pacem-dei-munus-pulcherrimum"],
  }),
  doc({
    slug: "studiorum-ducem",
    title: "Studiorum Ducem",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1923-06-29",
    summary:
      "Pius XI's encyclical on Saint Thomas Aquinas for the sixth centenary of his canonisation. The Pope presents Thomas first as a saint in whom learning was joined to holiness — humility, purity and prayer, with the crucified Christ as his book — and then as the master of the sacred sciences: the philosopher who best explained the nature and divisions of philosophy and its harmony with faith; the theologian who expounded the mysteries of the faith, from the inner life of God to his providential government of the world, with unmatched depth; the teacher of moral, social and political doctrine; and a guide in ascetical and mystical theology. He asks that young students in particular take Thomas as their model in humility and purity, and, as the Egyptians were once sent to Joseph for bread, he sends all who hunger for truth to Thomas. The centenary was to be kept wherever young clerics are trained, and the feast of Thomas, patron of all Catholic schools, marked with a holiday from lessons and a solemn disputation; debates among his followers are to be carried on within a just freedom and without the bitterness that wounds charity. The Holy See publishes the text on vatican.va in Italian and Latin.",
    keyThemes: [
      "Sixth centenary of the canonisation of Saint Thomas",
      "Holiness joined to learning",
      "Thomas as master of philosophy and theology",
      "Thomas as patron of Catholic schools",
      "Charity and freedom in theological debate",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/it/encyclicals/documents/hf_p-xi_enc_19230629_studiorum-ducem.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["aeterni-patris", "fides-et-ratio"],
  }),
  doc({
    slug: "rerum-ecclesiae",
    title: "Rerum Ecclesiae",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1926-02-28",
    summary:
      "Pius XI's encyclical on the Catholic missions. Mission, the Pope teaches, is a duty of charity for every Catholic, and he asks bishops to promote it in their dioceses through prayer, vocations and the Missionary Union of the Clergy, and through generous support of the pontifical mission societies: the Society for the Propagation of the Faith, which he had transferred to Rome; the Association of the Holy Childhood; and the Society of Saint Peter the Apostle, whose heavenly patroness he had made Saint Thérèse of the Child Jesus. To the heads of missions he gives practical direction. Above all they must build up a native clergy, able in time to lead their own Churches without depending on foreign missionaries, since the faith was first planted in that way and the foreign missionary is hampered by language and custom; they should increase the number of catechists, preferably drawn from the local people; welcome contemplative communities into mission lands; and avoid churches and buildings too costly for the young Churches.",
    keyThemes: [
      "The missionary duty of all Catholics",
      "The pontifical mission societies",
      "A native clergy for the young Churches",
      "Catechists in the missions",
      "Contemplative life in mission lands",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_28021926_rerum-ecclesiae.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["fidei-donum", "ad-gentes", "redemptoris-missio"],
  }),
];
