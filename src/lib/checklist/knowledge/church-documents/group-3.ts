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
const PIUS_XI_CONSTITUTIONS =
  "https://www.vatican.va/content/pius-xi/en/apost_constitutions.index.html";
const PIUS_XII_ENCYCLICALS = "https://www.vatican.va/content/pius-xii/en/encyclicals.index.html";
const PIUS_XII_CONSTITUTIONS =
  "https://www.vatican.va/content/pius-xii/en/apost_constitutions.index.html";
const PIUS_XII_EXHORTATIONS =
  "https://www.vatican.va/content/pius-xii/en/apost_exhortations.index.html";
const JOHN_XXIII_ENCYCLICALS =
  "https://www.vatican.va/content/john-xxiii/en/encyclicals.index.html";
const JOHN_XXIII_CONSTITUTIONS_1961 =
  "https://www.vatican.va/content/john-xxiii/en/apost_constitutions/1961.index.html";
const PAUL_VI_ENCYCLICALS = "https://www.vatican.va/content/paul-vi/en/encyclicals.index.html";
const PAUL_VI_EXHORTATIONS =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations.index.html";
const PAUL_VI_CONSTITUTIONS =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions.index.html";
const PAUL_VI_CONSTITUTIONS_LATIN =
  "https://www.vatican.va/content/paul-vi/la/apost_constitutions.index.html";
const PAUL_VI_MOTU_PROPRIO = "https://www.vatican.va/content/paul-vi/en/motu_proprio.index.html";
const PAUL_VI_LETTERS = "https://www.vatican.va/content/paul-vi/en/apost_letters.index.html";

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
  doc({
    slug: "rite-expiatis",
    title: "Rite Expiatis",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1926-04-30",
    summary:
      "Pius XI's encyclical for the seventh centenary of the death of Saint Francis of Assisi, written as the jubilee of the Holy Year was being extended to the whole world. The Pope asks that the celebrations honour Francis as he really was, not as a figure remade to suit modern tastes, and recalls the love for the saint awakened forty-four years earlier by Leo XIII's encyclical Auspicato. He describes the harsh and divided society into which Francis was born and his conversion; his love of evangelical poverty, which he embraced as his bride after the example of Christ on the Cross and of the Blessed Virgin; his humility, obedience and devotion to the Church and the Holy See; and the renewal of Christian society that he brought about through his brothers and through the Third Order, which offered men and women living in the world a way to holiness without vows. The Pope commends this Franciscan spirit, so close to the Gospel itself, to clergy and faithful alike, and asks the bishops to foster the Third Order.",
    keyThemes: [
      "Seventh centenary of the death of Saint Francis",
      "Evangelical poverty",
      "Humility, obedience and love of the Church",
      "The Third Order and the renewal of society",
      "The Franciscan spirit and the Gospel",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_30041926_rite-expiatis.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["perfectae-caritatis", "laudato-si"],
  }),
  doc({
    slug: "mortalium-animos",
    title: "Mortalium Animos",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1928-01-06",
    summary:
      "Pius XI's encyclical on religious unity, written in response to the conferences of the 1920s that sought to unite Christian bodies on the basis of common elements. The Pope acknowledges the longing for unity among those who invoke the name of Christ, but rejects the approach of assemblies that treat all Christian communities as more or less equal parts of a Church that does not yet exist, and the idea that unity can rest on a minimum of shared doctrine while each body keeps its own beliefs. God has revealed a definite body of truth that must be accepted whole, and Christ founded one visible Church; the faithful may not choose among revealed truths as though some were negotiable. Because taking part in such gatherings would give countenance to a false idea of Christianity, the Apostolic See cannot join them and Catholics may not support them; the unity of Christians is to be sought through the return of the separated to the one Church of Christ, which includes acceptance of the authority of Peter's successors. The letter closes with an invitation to those separated to draw near to the Apostolic See.",
    keyThemes: [
      "The unity of the Church",
      "Revealed truth to be accepted whole",
      "The visible Church founded by Christ",
      "Catholic participation in interdenominational assemblies",
      "Return to the one Church and the primacy of Peter",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_19280106_mortalium-animos.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["satis-cognitum", "unitatis-redintegratio", "ut-unum-sint"],
  }),
  doc({
    slug: "miserentissimus-redemptor",
    title: "Miserentissimus Redemptor",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1928-05-08",
    summary:
      "Pius XI's encyclical on reparation to the Sacred Heart of Jesus. Recalling the revelations to Saint Margaret Mary and the practices that had spread from them, among them Communion on the first Friday of each month, together with Leo XIII's consecration of the human race and his own institution of the feast of Christ the King, the Pope explains that consecration must be joined by expiation. Justice demands that the offence of sin be repaired, and love moves us to console Christ; since no creature could atone for sin, the Son of God became man, and the faithful, uniting themselves to his sacrifice above all in the Mass, share in his sufferings for their own sins and for those of others. The spirit of reparation has always stood at the heart of devotion to the Sacred Heart, as the Communion of Reparation and the Holy Hour show. The Pope raised the feast of the Sacred Heart to a double of the first class with an octave, and decreed that every year on that feast a prescribed act of reparation, attached to the letter, be solemnly recited in every church in the world.",
    keyThemes: [
      "Reparation and expiation",
      "Consecration to the Sacred Heart",
      "Sharing in the sacrifice of Christ",
      "The Communion of Reparation and the Holy Hour",
      "The annual act of reparation",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_19280508_miserentissimus-redemptor.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["annum-sacrum", "quas-primas", "haurietis-aquas"],
  }),
  doc({
    slug: "divini-cultus",
    title: "Divini Cultus",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1928-12-20",
    summary:
      "The apostolic constitution on the liturgy, Gregorian chant and sacred music that Pius XI issued on the fiftieth anniversary of his own ordination to the priesthood and in the twenty-fifth year since Saint Pius X's Tra le Sollecitudini. The Pope recalls why the Church has always guarded the liturgy as carefully as dogma, and adds practical norms drawn from a quarter century of experience: candidates for the priesthood are to be trained in chant and sacred music from their first years, with brief and almost daily practice in seminaries; chapters of canons and religious communities must provide for the chant of the Office; musical chapels are to cultivate polyphony, and schools for boys' voices are to be founded even in parish churches; music that merely joins voices to an orchestra is not to be regarded as a more perfect form suited to worship, while the organ, the Church's traditional instrument, is to keep its proper role. Above all, Gregorian chant is to be restored to the people in the parts that belong to them, so that the faithful take an active part in worship rather than looking on in silence. The Holy See publishes the text in Latin.",
    keyThemes: [
      "Liturgy as the Church's public worship",
      "Chant and music in the formation of the clergy",
      "Polyphony and boys' choirs",
      "The organ and the place of instruments",
      "Active participation of the people through chant",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/la/apost_constitutions/documents/hf_p-xi_apc_19281220_divini-cultus-sanctitatem.html",
    indexUrl: PIUS_XI_CONSTITUTIONS,
    relatedDocuments: ["tra-le-sollecitudini", "mediator-dei", "sacrosanctum-concilium"],
  }),
  doc({
    slug: "mens-nostra",
    title: "Mens Nostra",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1929-12-20",
    summary:
      "Pius XI's encyclical on the promotion of the spiritual exercises, offered as a memorial of the jubilee year 1929 and of the fiftieth year of his own priesthood. The Pope finds the chief disease of the age in a thoughtless absorption in external things that leaves no room for eternal truths, and commends retreats as the remedy, tracing their roots to Christ's forty days in the desert and the Apostles' days of prayer in the upper room, through the Fathers to Saint Charles Borromeo, who founded what the Pope believed to be the first house dedicated to them. He urges retreats on bishops, the secular clergy — at least to the extent the Code of Canon Law requires — religious, members of Catholic Action and young people, and commends retreats for workers; he especially recommends closed retreats made in solitude, and praises the method of Saint Ignatius of Loyola, whom he had declared the heavenly patron of all spiritual exercises in 1922.",
    keyThemes: [
      "The spiritual exercises",
      "Retreats as a remedy for the distraction of the age",
      "Retreats for clergy, religious and laity",
      "Closed retreats",
      "Saint Ignatius of Loyola, patron of the spiritual exercises",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_19291220_mens-nostra.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["haerent-animo", "ad-catholici-sacerdotii"],
  }),
  doc({
    slug: "divini-illius-magistri",
    title: "Divini Illius Magistri",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1929-12-31",
    summary:
      "Pius XI's encyclical on the Christian education of youth. Education concerns the whole person and is ordered to the last end of human life, so it belongs to three societies: the family and civil society in the natural order, and the Church in the supernatural order. The Church has a pre-eminent right to educate by a double title — the mission to teach given her by Christ and her supernatural motherhood — and the right and duty to watch over the education of her children in every school, public or private, in all that touches faith and morals. Parents receive from God a right to educate their children that is prior to the rights of the State, whose task is to protect and supplement the family and respect the rights of the Church while promoting education for the common good. The Pope rejects naturalism in education, public and indiscriminate sex instruction, coeducation founded on a denial of original sin, and the so-called neutral or lay school, and calls for Catholic schools in which all teaching is permeated with the Christian spirit. The proper end of Christian education is to form the true and perfect Christian.",
    keyThemes: [
      "Education and the last end of man",
      "The rights of the family, the State and the Church",
      "Parents as first educators",
      "Errors in education",
      "The Catholic school",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_31121929_divini-illius-magistri.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["gravissimum-educationis", "casti-connubii"],
  }),
  doc({
    slug: "lux-veritatis",
    title: "Lux Veritatis",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1931-12-25",
    summary:
      "Pius XI's encyclical for the fifteenth centenary of the Council of Ephesus, which proclaimed the divine motherhood of Mary. Retelling the controversy — Nestorius's teaching, drawn from Theodore of Mopsuestia, which divided Christ into two persons and so denied that Mary is truly Theotokos, Mother of God; Saint Cyril of Alexandria's opposition and his appeal to Pope Celestine; and the council's reception of the Pope's judgement through his legates — the Pope draws out two lessons: the primacy of the Roman Pontiff, acknowledged by the bishops assembled at Ephesus, and the union of two natures in the one divine Person of the Word, on which Mary's divine motherhood rests. He invites the separated Christians of the East to return to unity, hoping that they will one day venerate with Rome the Mother of God whose mosaic image Pope Sixtus III had set in the Liberian basilica, a work Pius XI had restored. To keep the anniversary in the liturgy he had an Office and Mass of the Divine Maternity of Mary prepared for the universal Church. The Holy See publishes the text on vatican.va in Italian and Latin.",
    keyThemes: [
      "Fifteenth centenary of the Council of Ephesus",
      "Mary, Mother of God",
      "The hypostatic union",
      "The primacy of the Roman Pontiff",
      "The feast of the Divine Maternity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/it/encyclicals/documents/hf_p-xi_enc_19311225_lux-veritatis.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["council-of-ephesus", "orientalis-ecclesiae", "redemptoris-mater"],
  }),
  doc({
    slug: "caritate-christi-compulsi",
    title: "Caritate Christi Compulsi",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1932-05-03",
    summary:
      "Pius XI's encyclical on the Sacred Heart, written during the world economic crisis a few months after his letter Nova Impendet. The Pope sees in the distress of the time — mass unemployment, an excessive love of self and of one's own nation, and above all a hatred of God openly organised and spread — a crisis graver than any since the Flood, whose root is the revolt of humanity against God. Human means alone cannot meet it. He calls the whole Church to prayer, which lifts minds toward heavenly goods and makes for peace among peoples, and to penance, which strikes at the root of evil in the craving for wealth and pleasure. He asks that the coming feast of the Sacred Heart be kept everywhere as a day of reparation and supplication, with the Blessed Sacrament solemnly exposed, and that its octave be a time of prayer, mortification and almsgiving, with the poor and the unemployed offering their privations in the same spirit.",
    keyThemes: [
      "The world crisis of the 1930s",
      "Organised atheism",
      "Prayer as the first remedy",
      "Penance and detachment",
      "The feast and octave of the Sacred Heart",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_03051932_caritate-christi-compulsi.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["miserentissimus-redemptor", "quadragesimo-anno", "divini-redemptoris"],
  }),
  doc({
    slug: "ad-catholici-sacerdotii",
    title: "Ad Catholici Sacerdotii",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1935-12-20",
    summary:
      "Pius XI's encyclical on the Catholic priesthood. The priest, the Pope teaches, is another Christ who continues his work: by the powers conferred in ordination, which are stable and joined to an indelible character, he offers the eucharistic sacrifice, forgives sins, preaches the word and prays in the name of the Church. Such dignity demands corresponding holiness, and the Pope dwells on piety; on chastity, tracing the law of celibacy in the Latin Church to the Council of Elvira early in the fourth century and noting the esteem in which it is held in the East; on detachment from earthly goods, zeal, obedience and learning. He then turns to formation, asking bishops to choose candidates carefully and to provide well-ordered seminaries, and asking families and parishes to foster vocations, and he commends the priesthood to the prayers of the faithful. To honour the one priesthood of Christ he published with the encyclical a votive Mass of Jesus Christ the Supreme and Eternal Priest, to be celebrated on Thursdays.",
    keyThemes: [
      "The dignity and powers of the priest",
      "Priestly holiness",
      "Celibacy and chastity",
      "Formation of candidates and vocations",
      "The votive Mass of Christ the Eternal Priest",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_19351220_ad-catholici-sacerdotii.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["haerent-animo", "presbyterorum-ordinis", "sacerdotalis-caelibatus"],
  }),
  doc({
    slug: "vigilanti-cura",
    title: "Vigilanti Cura",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1936-06-29",
    summary:
      "Pius XI's encyclical on motion pictures, addressed above all to the bishops of the United States. The Pope praises the Legion of Decency they had launched, whose pledge millions of American Catholics had signed, and which had helped to bring about a marked improvement in films without harming their artistic quality. He describes the power of the cinema, which speaks through vivid images that everyone can grasp, to do great good or great harm, especially among the young, and teaches that recreation, now a necessity for working people, must be morally healthy and worthy of rational beings. He asks bishops everywhere to obtain from the faithful a yearly promise to avoid harmful films, and to set up in each country a permanent national reviewing office, preferably entrusted to Catholic Action, to promote good films, publish classified lists telling the faithful which films are suitable for all, suitable with reservations, or harmful, and organise parish and Catholic cinema halls.",
    keyThemes: [
      "The influence of the cinema",
      "The Legion of Decency",
      "Moral standards for recreation",
      "National reviewing offices and classified lists",
      "The responsibility of bishops and families",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_29061936_vigilanti-cura.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: ["inter-mirifica"],
  }),
  doc({
    slug: "ingravescentibus-malis",
    title: "Ingravescentibus Malis",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XI",
    issuedDate: "1937-09-29",
    summary:
      "Pius XI's encyclical on the Rosary, written as the evils of the age — above all atheistic communism and the persecution of the Church — grew more grave. The Pope presents the Rosary as a garland woven from the holiest prayers, the Our Father and the Hail Mary, joined to contemplation of the mysteries of Christ and his Mother: simple enough for everyone, and its repetitions not an empty formula but the language of love. Spread by Saint Dominic and recommended by the Virgin herself at Lourdes, it has been dear to saints, scholars and rulers alike. He asks that it be prayed with special devotion in October, in churches and in homes, trusting that Mary, who once overcame the Albigensian heresy, will turn aside the errors of the day, especially communism, and that the Rosary will nourish faith, hope and charity. Above all he asks fathers and mothers to gather their families each evening to pray it together.",
    keyThemes: [
      "The Rosary in a time of trial",
      "The prayers and mysteries of the Rosary",
      "The October devotion",
      "The Rosary against the errors of the age",
      "The family Rosary",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_29091937_ingravescentibus-malis.html",
    indexUrl: PIUS_XI_ENCYCLICALS,
    relatedDocuments: [
      "supremi-apostolatus-officio",
      "divini-redemptoris",
      "rosarium-virginis-mariae",
    ],
  }),

  // ---------------------------------------------------------------------------
  // Pope Pius XII
  // ---------------------------------------------------------------------------
  doc({
    slug: "summi-pontificatus",
    title: "Summi Pontificatus",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1939-10-20",
    summary:
      "The first encyclical of Pius XII, written in the first weeks of the Second World War and in the fortieth year since Leo XIII's consecration of the human race to the Sacred Heart. Placing his pontificate under the sign of Christ the King, the Pope finds the root of the evils of modern society in the rejection of a universal norm of morality — the natural law grounded in God — in individual, social and international life. He singles out two errors: the forgetting of the law of human solidarity and charity that follows from the common origin of all people, the equality of rational nature in every race, and Christ's redemption of all; and the idea of the State with unlimited authority, which deforms education, harms its own citizens and destroys the foundations of international law and of treaties. As a sign of the Church's universality he announced that on the feast of Christ the King he would consecrate twelve bishops from widely different peoples and races. He grieves over the war that had broken out despite his efforts, and welcomes the growing share of the laity, supported by the family, in the apostolate.",
    keyThemes: [
      "The unity of human society",
      "The natural law and a universal moral order",
      "Human solidarity across nations and races",
      "Against the State with unlimited authority",
      "The lay apostolate",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_20101939_summi-pontificatus.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["annum-sacrum", "quas-primas", "mit-brennender-sorge"],
  }),
  doc({
    slug: "sertum-laetitiae",
    title: "Sertum Laetitiae",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1939-11-01",
    summary:
      "Pius XII's encyclical to the Church in the United States for the hundred and fiftieth anniversary of the establishment of its hierarchy, when Pius VI gave John Carroll to Baltimore as its first bishop. The Pope celebrates the growth of the American Church, the help it received from priests who had fled persecution elsewhere, its generosity to the missions, its charities and its associations of the laity — Catholic Action, the Marian sodalities and the Confraternity of Christian Doctrine — and expresses his special paternal affection for Black Americans. He then warns against the materialism and secularism that weaken faith and morals, defends the unity and indissolubility of marriage against divorce, commends the Catholic University in Washington and the use of the press and radio for the faith, and restates the Church's social teaching: wages sufficient to support workers and their families, a just distribution of goods, and the natural right of workers and farmers to form associations, which must be guided by justice and charity.",
    keyThemes: [
      "Sesquicentenary of the American hierarchy",
      "The growth of the Church in the United States",
      "Marriage and the family",
      "Catholic education and the press",
      "Just wages and workers' associations",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_01111939_sertum-laetitiae.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["longinqua-oceani", "testem-benevolentiae", "quadragesimo-anno"],
  }),
  doc({
    slug: "orientalis-ecclesiae",
    title: "Orientalis Ecclesiae",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1944-04-09",
    summary:
      "Pius XII's encyclical on Saint Cyril, Patriarch of Alexandria, for the fifteenth centenary of his death, given on Easter Sunday 1944. The Pope recounts Cyril's life and his tireless defence of the faith, above all against Nestorius, which led to the Council of Ephesus and its proclamation of Mary as Mother of God, and recalls the honour in which Pope Celestine and the Council of Chalcedon held his teaching. Cyril is a glory of the Eastern Churches, which count him among their great Fathers; the Pope grieves that not all of them are yet joined in the unity Cyril loved, and proposes him as the model for restoring it through the threefold bond that Christ gave his Church — one faith, one charity toward God and all people, and one obedience to the hierarchy he established — recalling that Cyril himself turned to the Roman See in the Nestorian controversy.",
    keyThemes: [
      "Fifteenth centenary of Saint Cyril of Alexandria",
      "The defence of Mary as Mother of God",
      "The Eastern Churches and their Fathers",
      "The threefold bond of unity",
      "The Roman See in the Nestorian controversy",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_09041944_orientalis-ecclesiae.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["lux-veritatis", "council-of-ephesus", "orientalium-ecclesiarum"],
  }),
  doc({
    slug: "deiparae-virginis-mariae",
    title: "Deiparae Virginis Mariae",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1946-05-01",
    summary:
      "A short encyclical letter in which Pius XII consulted the bishops of the world on whether the bodily Assumption of the Blessed Virgin Mary into heaven could be defined as a dogma of faith. Noting the petitions for such a definition that had reached the Holy See over many years from cardinals, bishops, clergy, religious, associations and the faithful, and following the example of Pius IX before the definition of the Immaculate Conception, the Pope asks each bishop to tell him what devotion his clergy and people have toward the Assumption and whether he himself judges that it can be proposed and defined, and to join his prayers to the Pope's for light from heaven. The replies prepared the way for the definition of the Assumption in 1950.",
    keyThemes: [
      "The Assumption of the Blessed Virgin Mary",
      "Consultation of the world's bishops",
      "The faith of clergy and people",
      "Preparation for a dogmatic definition",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_01051946_deiparae-virginis-mariae.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["ineffabilis-deus", "ad-caeli-reginam", "lumen-gentium"],
  }),
  doc({
    slug: "provida-mater-ecclesia",
    title: "Provida Mater Ecclesia",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1947-02-02",
    summary:
      "The apostolic constitution in which Pius XII gave canonical recognition to secular institutes, societies whose members profess the evangelical counsels while living in the world. Tracing how the Church had gradually approved new forms of the state of perfection — from the ancient orders to congregations of simple vows and societies living in common without public vows — the Pope observes that since the nineteenth century groups had arisen whose members sought perfection in the world without common life or religious habit, often to take up works of charity closed to religious communities, and that neither earlier legislation nor the Code of Canon Law had provided for them. Approving a text examined by the Holy Office and drafted by the Sacred Congregation of Religious, he establishes secular institutes as a recognised state of perfection under that congregation and sets out their general law: the consecration by which members bind themselves to the counsels, their form of life, their government, and their approval as institutes of diocesan or pontifical right.",
    keyThemes: [
      "Secular institutes",
      "The evangelical counsels lived in the world",
      "The development of the states of perfection",
      "Canonical structure and approval",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/apost_constitutions/documents/hf_p-xii_apc_19470202_provida-mater-ecclesia.html",
    indexUrl: PIUS_XII_CONSTITUTIONS,
    relatedDocuments: ["perfectae-caritatis", "vita-consecrata", "lumen-gentium"],
  }),
  doc({
    slug: "sacramentum-ordinis",
    title: "Sacramentum Ordinis",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1947-11-30",
    summary:
      "The apostolic constitution by which Pius XII settled what is required for the valid conferral of the diaconate, the priesthood and the episcopate. The sacrament of orders is one and the same for the whole Church, and the Church has no power over the substance of the sacraments; yet the many rites added over the centuries had raised doubts about which of them belong to its essence. With his supreme authority the Pope declares that the sole matter of each of these orders is the imposition of hands, and the sole form the words that determine its application by signifying the power of orders and the grace of the Holy Spirit, and he identifies the essential words of the consecratory preface for each order. He further declares that the handing over of the instruments is, at least for the future, not necessary for validity, requires that the imposition of hands be made by physically touching the head of the candidate, and orders that all the other rites of the Roman Pontifical continue to be observed. The Holy See publishes the text in Latin.",
    keyThemes: [
      "Matter and form of holy orders",
      "The imposition of hands",
      "The essential words of ordination",
      "The handing over of the instruments",
      "The Roman Pontifical",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/la/apost_constitutions/documents/hf_p-xii_apc_19471130_sacramentum-ordinis.html",
    indexUrl: PIUS_XII_CONSTITUTIONS,
    relatedDocuments: ["apostolicae-curae", "exultate-deo", "presbyterorum-ordinis"],
  }),
  doc({
    slug: "menti-nostrae",
    title: "Menti Nostrae",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1950-09-23",
    summary:
      "The apostolic exhortation on the holiness of priestly life that Pius XII addressed to the clergy of the whole world during the Holy Year 1950, in gratitude for the prayers offered on the golden jubilee of his own priesthood. The first part treats the priest's call to perfection in charity and the imitation of Christ — humility, obedience, celibacy guarded by vigilance and prayer, detachment from earthly goods, and above all union with Christ's sacrifice in the Mass — nourished by the Divine Office, meditation, visits to the Blessed Sacrament, devotion to Mary, examination of conscience, frequent confession, spiritual direction and retreats. The second treats holiness in the sacred ministry, warning against an activism that neglects the interior life and proposing Saint Joseph Cafasso as a model. The third gives practical norms for fostering and testing vocations and for the human, intellectual and spiritual formation of seminarians and young priests, and the fourth turns to the economic hardships that many priests faced after the war. The Holy See publishes the text on vatican.va in Italian, Latin and other languages.",
    keyThemes: [
      "The holiness of priestly life",
      "The Mass and the priest's self-offering",
      "Prayer, meditation and the means of sanctification",
      "Holiness in the ministry",
      "Formation of seminarians and young priests",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/it/apost_exhortations/documents/hf_p-xii_exh_19500923_menti-nostrae.html",
    indexUrl: PIUS_XII_EXHORTATIONS,
    relatedDocuments: ["haerent-animo", "ad-catholici-sacerdotii", "presbyterorum-ordinis"],
  }),
  doc({
    slug: "sponsa-christi",
    title: "Sponsa Christi",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1950-11-21",
    summary:
      "The apostolic constitution in which Pius XII adapted the life of nuns to the needs of the time while keeping its contemplative character intact. After a long historical survey of consecrated virgins and of women's monastic life in the Church, the Pope issues General Statutes for Nuns: he confirms the major papal enclosure laid down in the Code while introducing a minor papal enclosure for monasteries that cannot keep the stricter form; encourages independent monasteries to unite in federations for mutual help; requires that nuns support themselves by suitable manual or intellectual work, undertaken in a spirit of penance and obedience; and allows forms of apostolate compatible with the contemplative life. The Sacred Congregation of Religious was charged with applying it. The Holy See publishes the text on vatican.va in Italian, Latin and other languages.",
    keyThemes: [
      "Contemplative life of nuns",
      "Papal enclosure, major and minor",
      "Federations of monasteries",
      "Work as a duty and a means of support",
      "Apostolate compatible with contemplation",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/it/apost_constitutions/documents/hf_p-xii_apc_19501121_sponsa-christi.html",
    indexUrl: PIUS_XII_CONSTITUTIONS,
    relatedDocuments: ["perfectae-caritatis", "provida-mater-ecclesia"],
  }),
  doc({
    slug: "evangelii-praecones",
    title: "Evangelii Praecones",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1951-06-02",
    summary:
      "Pius XII's encyclical on the promotion of the Catholic missions, written for the twenty-fifth anniversary of Pius XI's Rerum Ecclesiae. The Pope surveys the progress of a quarter century — the missions grown from about four hundred to nearly six hundred, many more Catholics, native priests and seminarians, new hierarchies and plenary councils — and honours the missionaries and martyrs, especially in the Far East, where flourishing missions were being destroyed. He restates that the final aim of missionary work is to establish the Church firmly among each people under its own native hierarchy and clergy, that the Church seeks not to dominate peoples but to bring them the light of faith, and that missionaries must be trained in the languages and learning their work requires. He gives a large place to lay people in Catholic Action, who have helped the Church since apostolic times, and to schools and colleges, the press and works of charity in mission lands.",
    keyThemes: [
      "Twenty-five years of missionary progress",
      "A native hierarchy and clergy",
      "The formation of missionaries",
      "The laity and Catholic Action in the missions",
      "Schools and works of charity",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_02061951_evangelii-praecones.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["rerum-ecclesiae", "fidei-donum", "ad-gentes"],
  }),
  doc({
    slug: "sempiternus-rex-christus",
    title: "Sempiternus Rex Christus",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1951-09-08",
    summary:
      "Pius XII's encyclical for the fifteenth centenary of the Council of Chalcedon. Recounting the controversy raised by the archimandrite Eutyches, who held that after the union there was only one nature in Christ; his condemnation at Constantinople under Flavian; the Robber Synod of Ephesus; and the council of 451, where the bishops greeted Pope Leo's dogmatic letter to Flavian as the faith of the Fathers, the Pope draws out two lessons: the primacy of the Roman Pontiff, which shone out through the whole affair, and the doctrine of the one Person of the Word in two natures, without confusion or separation. He rejects modern errors that distort it — kenotic theories built on a misreading of Philippians 2:7, and psychological studies of Christ's humanity that treat it as though it were a subject in its own right — and turns with affection to the Eastern Christians separated from Rome, many of whom differ chiefly in their terminology, inviting them to return to unity.",
    keyThemes: [
      "Fifteenth centenary of the Council of Chalcedon",
      "Two natures in the one Person of Christ",
      "The Tome of Leo and the primacy of Rome",
      "Kenotic and psychological errors about Christ",
      "Unity with the Eastern Christians",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_08091951_sempiternus-rex-christus.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["council-of-chalcedon", "lux-veritatis", "orientalis-ecclesiae"],
  }),
  doc({
    slug: "ingruentium-malorum",
    title: "Ingruentium Malorum",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1951-09-15",
    summary:
      "Pius XII's encyclical on reciting the Rosary, given on the feast of the Seven Sorrows of Mary in 1951. Recalling how often he had entrusted the human family to the Mother of God, the Pope looks to the coming month of October amid lingering hatred between nations, threats of new war and the persecution of the Church, and asks the bishops to see that the faithful pray the Rosary with greater zeal and esteem. Above all he wants the Rosary restored in the family: when parents and children gather at evening to pray it, the Christian home becomes like the home of Nazareth, and the family, the foundation of society, is renewed. He closes by asking Mary to obtain the return of those who have strayed, peace among peoples, and freedom for the persecuted Church.",
    keyThemes: [
      "The Rosary in a troubled world",
      "The October devotion",
      "The family Rosary",
      "The Christian home and Nazareth",
      "Prayer for peace and for the persecuted Church",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15091951_ingruentium-malorum.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["ingravescentibus-malis", "rosarium-virginis-mariae"],
  }),
  doc({
    slug: "exsul-familia",
    title: "Exsul Familia",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1952-08-01",
    summary:
      "The apostolic constitution in which Pius XII set out the Church's law on the spiritual care of migrants. It opens with the Holy Family of Nazareth, exiled in Egypt, as the model and protector of emigrants, exiles and refugees of every age, and then recalls at length the Church's care for those forced to leave their homelands: the priests who went with settlers to newly discovered lands, Blessed Vincent Pallotti's mission to Italians in London, the Saint Raphael Society, Bishop Giovanni Battista Scalabrini's missionaries for the Americas, the Apostleship of the Sea, and the relief work of the Holy See during and after the world wars. The second part lays down norms for the pastoral care of emigrants under the Consistorial Congregation, including the appointment and faculties of missionaries and chaplains who share the language of the migrants they serve. The Holy See publishes the text in Latin.",
    keyThemes: [
      "The Holy Family as model of migrants",
      "The Church's history of care for emigrants",
      "Missionaries and chaplains for migrants",
      "Pastoral care in the migrants' own language",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/la/apost_constitutions/documents/hf_p-xii_apc_19520801_exsul-familia.html",
    indexUrl: PIUS_XII_CONSTITUTIONS,
    relatedDocuments: ["rerum-novarum", "fratelli-tutti"],
  }),
  doc({
    slug: "christus-dominus-eucharistic-fast",
    title: "Christus Dominus (on the Eucharistic Fast)",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1953-01-06",
    summary:
      "The apostolic constitution, given on the Epiphany 1953, in which Pius XII relaxed the discipline of the eucharistic fast; it shares its opening words with the Second Vatican Council's later decree on bishops but is a distinct document. Because the conditions of modern life had made the strict fast from midnight a serious obstacle to frequent Communion and to the celebration of Mass, the Pope keeps the fast from midnight as the general rule but lays down that natural water no longer breaks it. The sick may take true medicine or non-alcoholic drink; priests who celebrate late, after heavy ministry or after a long journey, and faithful who face grave inconvenience from exhausting work, a late hour or a long journey, may take non-alcoholic drink up to an hour beforehand. Local ordinaries may also permit evening Masses, beginning no earlier than four in the afternoon on certain days, with a fast of three hours from solid food and alcohol and of one hour from other drink. The Holy See publishes the text on vatican.va in Italian and Latin.",
    keyThemes: [
      "The eucharistic fast",
      "Water no longer breaks the fast",
      "Concessions for the sick, workers and travellers",
      "Evening Masses",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/it/apost_constitutions/documents/hf_p-xii_apc_19530106_christus-dominus.html",
    indexUrl: PIUS_XII_CONSTITUTIONS,
    relatedDocuments: ["mediator-dei", "sacrosanctum-concilium"],
  }),
  doc({
    slug: "doctor-mellifluus",
    title: "Doctor Mellifluus",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1953-05-24",
    summary:
      "Pius XII's encyclical on Saint Bernard of Clairvaux for the eighth centenary of his death. The Pope presents Bernard, the restorer and promoter of the Cistercian Order, as the honey-sweet Doctor whose learning, drawn from Scripture and the Fathers, was guided by love rather than by subtle reasoning, so that knowledge was for him a path to God. He dwells on Bernard's teaching on the love of God and mystical union, which he fears is neglected in an age absorbed in practical affairs, and on the way that contemplation overflowed into tireless action — healing schism, reconciling princes, counselling popes and upholding the supreme authority of the Roman Pontiff. He closes with Bernard's tender devotion to the Blessed Virgin, commending his celebrated meditation on Mary as Star of the Sea, and asks all to seek her help in the troubles of the time as Bernard did in his.",
    keyThemes: [
      "Eighth centenary of Saint Bernard",
      "Learning guided by love",
      "The love of God and mystical union",
      "Contemplation overflowing into action",
      "Devotion to Mary, Star of the Sea",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_24051953_doctor-mellifluus.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["studiorum-ducem", "ad-caeli-reginam"],
  }),
  doc({
    slug: "fulgens-corona",
    title: "Fulgens Corona",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1953-09-08",
    summary:
      "The encyclical in which Pius XII proclaimed a Marian Year for the centenary of the definition of the Immaculate Conception. The Pope recalls Pius IX's definition and the apparitions at Lourdes four years later, which the faithful understood as a heavenly confirmation of it, and sets out the foundations of the doctrine: the promise in Genesis of enmity between the woman and the serpent, the angel's greeting full of grace, and the unanimous witness of the Fathers, who gave Mary such titles as lily among thorns and land wholly intact. He notes that even Eastern Christians separated from Rome keep a feast of the Conception, and that the definition of the Assumption in the Holy Year of 1950 has cast new light on the older dogma, the two being closely joined. He asks that the Marian Year be marked not only by celebrations but by imitation of Mary's virtues and the reform of Christian life, that Rome lead the way at the Liberian basilica, and that prayer be offered above all for the freedom of the Church where she was persecuted.",
    keyThemes: [
      "Centenary of the Immaculate Conception",
      "The Marian Year 1953-1954",
      "Scriptural and patristic foundations of the dogma",
      "The Immaculate Conception and the Assumption",
      "Prayer for the persecuted Church",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_08091953_fulgens-corona.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["ineffabilis-deus", "ad-caeli-reginam", "le-pelerinage-de-lourdes"],
  }),
  doc({
    slug: "musicae-sacrae",
    title: "Musicae Sacrae",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1955-12-25",
    summary:
      "Pius XII's encyclical on sacred music, given on Christmas Day 1955 and building on Tra le Sollecitudini. The Pope traces the place of song and instruments in the worship of Israel and of the Church from apostolic times, the rise of Gregorian chant, the organ and polyphony, and the vigilance of the popes and the Council of Trent against profane intrusions. Sacred music shares in the dignity of the liturgy: it must be holy, a true art and universal, and Gregorian chant, the Church's own patrimony, keeps the first place, with polyphony and fitting modern compositions also admitted and the organ held in special honour among instruments. Beyond the liturgy, the Pope commends popular religious hymns, often in the vernacular, as a powerful means of catechesis, especially for children and in the missions, where native musical traditions may be drawn into worship. He asks bishops to see to the training of clergy and choirs, the work of scholae cantorum and institutes of sacred music, and the sound formation of composers and musicians, whose art is a true apostolate.",
    keyThemes: [
      "The history of sacred music in the Church",
      "Holiness, art and universality",
      "Gregorian chant, polyphony and the organ",
      "Popular religious song and catechesis",
      "Music in the missions",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_25121955_musicae-sacrae.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["tra-le-sollecitudini", "divini-cultus", "mediator-dei"],
  }),
  doc({
    slug: "le-pelerinage-de-lourdes",
    title: "Le Pèlerinage de Lourdes",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1957-07-02",
    summary:
      "Pius XII's encyclical to the cardinals, archbishops and bishops of France for the centenary of the apparitions of the Blessed Virgin at Lourdes, known by its French opening words and dated on the feast of the Visitation. Recalling his own pilgrimage there as papal legate in 1935, the Pope reviews the long history of Marian devotion in France, the Miraculous Medal, and the apparitions to Bernadette between February and July 1858, which came only a few years after the definition of the Immaculate Conception and seemed to confirm it; he traces the bonds between the popes and the shrine. Lourdes, he says, leads to Christ, and its message is one of prayer and penance. He warns against the materialism of the age — not only the atheistic philosophy that governed whole nations, but the love of money, the unrestrained search for pleasure and indifference to one's neighbour — and asks that the jubilee year be one of conversion: for priests and religious, for families, which he invites to consecrate themselves to the Immaculate Heart of Mary, and for a society made more just and fraternal.",
    keyThemes: [
      "Centenary of the apparitions at Lourdes",
      "Bernadette and the Immaculate Conception",
      "Prayer and penance",
      "Materialism in its many forms",
      "Renewal of families and society",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_02071957_le-pelerinage-de-lourdes.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["ineffabilis-deus", "fulgens-corona"],
  }),
  doc({
    slug: "miranda-prorsus",
    title: "Miranda Prorsus",
    documentType: "encyclical",
    issuingAuthority: "Pope Pius XII",
    issuedDate: "1957-09-08",
    summary:
      "Pius XII's encyclical on motion pictures, radio and television. The Church welcomes these remarkable inventions, the Pope explains, because they can carry truth and the Gospel to whole peoples, and watches over them because of their great influence on how people think and act. Recalling the teaching of Pius XI in Vigilanti Cura and his own many addresses, and the commission he had set up in the Roman Curia to study these questions, he sets out the principles that should govern them: the right to information and the freedom of expression are subject to truth and the moral law; the public authority has duties to protect the common good; and those who produce, distribute and use these media share responsibility for their effects, especially on the young. He then treats each medium in turn — the review and classification of films, radio, and television, whose programmes enter directly into the family circle — and asks bishops to establish national offices for cinema, radio and television under their authority, working with the commission in Rome, and calls on priests, lay people and Catholic artists to bring these arts into the service of the faith.",
    keyThemes: [
      "Cinema, radio and television",
      "Freedom of information and the moral law",
      "Responsibilities of producers, authorities and audiences",
      "Protection of the young and the family",
      "National Catholic offices for the media",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_08091957_miranda-prorsus.html",
    indexUrl: PIUS_XII_ENCYCLICALS,
    relatedDocuments: ["vigilanti-cura", "inter-mirifica"],
  }),

  // ---------------------------------------------------------------------------
  // Pope Saint John XXIII
  // ---------------------------------------------------------------------------
  doc({
    slug: "ad-petri-cathedram",
    title: "Ad Petri Cathedram",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint John XXIII",
    issuedDate: "1959-06-29",
    summary:
      "The first encyclical of Saint John XXIII, on truth, unity and peace in a spirit of charity, issued on the feast of Saints Peter and Paul a few months after he had announced an ecumenical council, a Roman synod and the revision of the Code of Canon Law. The Pope finds the root of the world's evils in ignorance or contempt of the truth, and asks that truth be served — by reason, by revelation, by a responsible press — rather than treated as a matter of indifference. He then speaks of unity: among nations and peoples, among social classes, within the family, and above all in the Church, whose unity of doctrine, government and worship he describes, addressing with fatherly warmth the Christians separated from the Apostolic See and expressing the hope that the coming council would be a sign inviting them to unity. Finally he treats peace, which rests on justice and charity and must begin in each person's heart, and closes with words of encouragement to bishops, clergy, religious, missionaries, the laity and the persecuted Church.",
    keyThemes: [
      "Truth, unity and peace",
      "Respect for truth and the role of the press",
      "Concord among nations and social classes",
      "The unity of the Church and separated Christians",
      "The coming ecumenical council",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-xxiii/en/encyclicals/documents/hf_j-xxiii_enc_29061959_ad-petri.html",
    indexUrl: JOHN_XXIII_ENCYCLICALS,
    relatedDocuments: ["humanae-salutis", "mater-et-magistra", "pacem-in-terris"],
  }),
  doc({
    slug: "sacerdotii-nostri-primordia",
    title: "Sacerdotii Nostri Primordia",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint John XXIII",
    issuedDate: "1959-08-01",
    summary:
      "Saint John XXIII's encyclical for the centenary of the death of Saint John Mary Vianney, the Curé of Ars, whom he proposes to priests as a model. The Pope recalls how the saint had marked his own life, from the beatification he attended as a young priest to the canonisation in the year he became a bishop. He then draws three lessons from the Curé's life: his asceticism — voluntary penance, poverty and detachment, chastity and humble obedience, practised out of love of God and for the salvation of souls; his prayer and his devotion to the Eucharist, celebrated and adored with fervour; and his pastoral zeal, shown above all in catechesis, preaching and the long hours spent in the confessional, through which he converted so many. The letter calls the clergy of the world to the same holiness and pastoral charity, and asks the faithful to pray for and support their priests.",
    keyThemes: [
      "Centenary of Saint John Vianney",
      "The Curé of Ars as a model for priests",
      "Priestly asceticism: poverty, chastity, obedience",
      "Prayer and devotion to the Eucharist",
      "Pastoral zeal in catechesis and confession",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-xxiii/en/encyclicals/documents/hf_j-xxiii_enc_19590801_sacerdotii.html",
    indexUrl: JOHN_XXIII_ENCYCLICALS,
    relatedDocuments: ["haerent-animo", "ad-catholici-sacerdotii", "menti-nostrae"],
  }),
  doc({
    slug: "princeps-pastorum",
    title: "Princeps Pastorum",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint John XXIII",
    issuedDate: "1959-11-28",
    summary:
      "Saint John XXIII's encyclical on the missions, the native clergy and the participation of the laity, written for the fortieth anniversary of Benedict XV's apostolic letter Maximum Illud. The Pope rejoices that the hope of his predecessors had been fulfilled in a numerous body of bishops and priests drawn from the mission peoples themselves, while the young Churches still need missionaries from abroad. He asks that native clergy be formed with care — in holiness, in sound learning adapted to their own cultures, and with teachers from their own peoples in the seminaries — so that the Church in each land may be rooted in its life. He gives particular attention to the laity: well-trained catechists and lay apostles, Catholic Action adapted to local conditions, and Christians who bring their faith into public, social and cultural life. He closes by asking all Catholics for prayer, vocations and generous support for the missions.",
    keyThemes: [
      "Fortieth anniversary of Maximum Illud",
      "The growth of a native clergy and hierarchy",
      "Formation of seminarians in mission lands",
      "Catechists and the lay apostolate",
      "Support of the whole Church for the missions",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-xxiii/en/encyclicals/documents/hf_j-xxiii_enc_28111959_princeps.html",
    indexUrl: JOHN_XXIII_ENCYCLICALS,
    relatedDocuments: ["rerum-ecclesiae", "evangelii-praecones", "ad-gentes"],
  }),
  doc({
    slug: "aeterna-dei-sapientia",
    title: "Aeterna Dei Sapientia",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint John XXIII",
    issuedDate: "1961-11-11",
    summary:
      "Saint John XXIII's encyclical for the fifteenth centenary of the death of Saint Leo the Great, Pope and Doctor of the Church. The Pope recalls Leo's greatness: his courage in confronting Attila at the river Mincio in 452, his wisdom in governing the Church, his preaching and his care for the liturgy. Above all he presents Leo as the Doctor of the Church's unity — the defender of the true faith in the Incarnation through his letter to Flavian, which the Council of Chalcedon received as the voice of Peter, the judge who condemned the Robber Council of Ephesus, and the witness to the primacy of the See of Peter as the centre of unity. Recalling that the Byzantine liturgy still keeps Leo's feast, and drawing the lesson for his own time as the Second Vatican Council approached, the Pope makes Leo's appeal for unity his own and prays that all Christians may come to recognise the marks of the true Church.",
    keyThemes: [
      "Fifteenth centenary of Saint Leo the Great",
      "Leo as Doctor of the Church's unity",
      "The Tome of Leo and Chalcedon",
      "The primacy of the See of Peter",
      "Preparation for the Second Vatican Council",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-xxiii/en/encyclicals/documents/hf_j-xxiii_enc_11111961_aeterna-dei.html",
    indexUrl: JOHN_XXIII_ENCYCLICALS,
    relatedDocuments: ["sempiternus-rex-christus", "council-of-chalcedon", "humanae-salutis"],
  }),
  doc({
    slug: "humanae-salutis",
    title: "Humanae Salutis",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint John XXIII",
    issuedDate: "1961-12-25",
    summary:
      "The apostolic constitution, given on Christmas Day 1961, by which Saint John XXIII formally convoked the Second Vatican Council. Looking at a world rich in technical progress but poor in spiritual values, and at a Church full of vitality, the Pope explains that the council is meant to strengthen the faith, renew the Church and help her bring the Gospel to the needs of the age, to promote the unity of Christians, which so many were then seeking, and to serve peace among peoples. He recalls that he had first announced the council on 25 January 1959 and describes the work of the preparatory commissions, and then, having heard the cardinals, he announces, proclaims and convokes the ecumenical council for 1962. He entrusts it to the intercession of Mary and Saint Joseph, asks the whole Church to prepare by prayer and penance, and asks Christians not in communion with the Catholic Church to pray for it as well. The opening date of 11 October 1962 was fixed by a later motu proprio. The Holy See publishes the text on vatican.va in Italian, Latin and other languages.",
    keyThemes: [
      "Convocation of the Second Vatican Council",
      "The Church and the needs of the modern world",
      "Christian unity",
      "Peace among peoples",
      "Prayer and preparation for the council",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-xxiii/it/apost_constitutions/1961/documents/hf_j-xxiii_apc_19611225_humanae-salutis.html",
    indexUrl: JOHN_XXIII_CONSTITUTIONS_1961,
    relatedDocuments: ["second-vatican-council", "ad-petri-cathedram", "paenitentiam-agere"],
  }),
  doc({
    slug: "paenitentiam-agere",
    title: "Paenitentiam Agere",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint John XXIII",
    issuedDate: "1962-07-01",
    summary:
      "Saint John XXIII's encyclical on the need for interior and exterior penance as preparation for the Second Vatican Council, given on the feast of the Precious Blood a few months before the council opened. Repeating the request he had made when he convoked it, the Pope explains that the council, a gathering of the successors of the Apostles charged to teach all nations, should be prepared for by prayer and penance. He shows from Scripture that God has never revealed himself in any solemn way without first calling people to prayer and penance, from the prophets to John the Baptist, Christ and the Apostles, and teaches that penance is needed not only for conversion but throughout Christian life, to restrain concupiscence and to make reparation for sin. He asks bishops to lead the faithful in penitential practices, especially a novena to the Holy Spirit, and urges everyone to accept the trials and duties of daily life in a spirit of penance and to perform works of charity.",
    keyThemes: [
      "Penance as preparation for the council",
      "Calls to penance in Scripture",
      "Interior and exterior penance",
      "Penance in the Christian life",
      "Prayer for the council",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/john-xxiii/en/encyclicals/documents/hf_j-xxiii_enc_01071962_paenitentiam.html",
    indexUrl: JOHN_XXIII_ENCYCLICALS,
    relatedDocuments: ["humanae-salutis", "paenitemini"],
  }),

  // ---------------------------------------------------------------------------
  // Pope Saint Paul VI
  // ---------------------------------------------------------------------------
  doc({
    slug: "apostolica-sollicitudo",
    title: "Apostolica Sollicitudo",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1965-09-15",
    summary:
      "The apostolic letter given motu proprio by which Paul VI established the Synod of Bishops, issued on the eve of the fourth and final session of the Second Vatican Council. Wishing to make wider use of the counsel of the bishops in caring for the universal Church, the Pope creates a permanent council of bishops for the whole Church, directly subject to his authority, whose purposes are to foster union and cooperation between the Pope and the bishops, to provide direct information on the condition of the Church and the questions it faces, and to facilitate agreement on doctrine and action. The Synod is to give information and advice, and may have deliberative power only when the Pope grants it; it is convoked by the Pope, who sets its agenda and presides over it. The letter provides for general, extraordinary and special sessions, sets out who takes part in each — chiefly bishops elected by episcopal conferences, Eastern patriarchs and heads of Curial dicasteries — and establishes a permanent general secretary.",
    keyThemes: [
      "Establishment of the Synod of Bishops",
      "Collegial cooperation with the Pope",
      "Consultative and deliberative roles",
      "General, extraordinary and special sessions",
      "A permanent general secretariat",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/motu_proprio/documents/hf_p-vi_motu-proprio_19650915_apostolica-sollicitudo.html",
    indexUrl: PAUL_VI_MOTU_PROPRIO,
    relatedDocuments: ["christus-dominus", "lumen-gentium"],
  }),
  doc({
    slug: "in-spiritu-sancto",
    title: "In Spiritu Sancto",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1965-12-08",
    summary:
      "The apostolic letter in the form of a brief by which Paul VI formally closed the Second Vatican Council, read at the closing ceremony on the solemnity of the Immaculate Conception 1965. Recalling that the council had been assembled in the Holy Spirit under the protection of the Blessed Virgin Mary, whom he had declared Mother of the Church, of Saint Joseph and of the Apostles Peter and Paul, the Pope numbers it among the greatest events of the Church's history, a council rich in doctrine and concerned for all humanity. Since all its constitutions, decrees, declarations and votes had been approved by the council and promulgated by him, he declares the council closed in every respect, and decrees that everything it has established synodally be religiously observed by all the faithful, for the glory of God, the dignity of the Church and the peace of all people.",
    keyThemes: [
      "Closing of the Second Vatican Council",
      "The council's place in the Church's history",
      "Mary, Mother of the Church",
      "Reception and observance of the council's decrees",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_letters/documents/hf_p-vi_apl_19651208_in-spiritu-sancto.html",
    indexUrl: PAUL_VI_LETTERS,
    relatedDocuments: ["second-vatican-council", "humanae-salutis", "lumen-gentium"],
  }),
  doc({
    slug: "paenitemini",
    title: "Paenitemini",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1966-02-17",
    summary:
      "The apostolic constitution by which Paul VI reorganised the Church's discipline of penance, fast and abstinence after the Second Vatican Council. The first part sets out the meaning of penance in the Old Testament, in Christ, who began his preaching with the call to repent, and in the life of the Church: an interior conversion of heart that must also be expressed outwardly in body as well as soul, through the traditional triad of prayer, fasting and charity, and through acceptance of the trials of daily life. The norms that follow declare that all the faithful are bound by divine law to do penance; that Lent keeps its penitential character and every Friday and Ash Wednesday are days of penance; that abstinence from meat is observed on Fridays that are not holy days of obligation, and fasting with abstinence on Ash Wednesday and Good Friday; that abstinence binds from the completion of the fourteenth year and fasting from the twenty-first to the beginning of the sixtieth; and that episcopal conferences may substitute other forms of penance, especially works of charity and piety, for abstinence and fasting.",
    keyThemes: [
      "The meaning of penance in Scripture and the Church",
      "Prayer, fasting and charity",
      "Fridays and Lent as penitential times",
      "Norms of fast and abstinence",
      "The role of episcopal conferences",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_19660217_paenitemini.html",
    indexUrl: PAUL_VI_CONSTITUTIONS,
    relatedDocuments: ["paenitentiam-agere", "reconciliatio-et-paenitentia"],
  }),
  doc({
    slug: "christi-matri",
    title: "Christi Matri",
    documentType: "encyclical",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1966-09-15",
    summary:
      "Paul VI's encyclical asking for prayers for peace during the month of October 1966, when an armed conflict then under way threatened to spread. Recalling his visit to the United Nations the previous year, where he had pleaded for an end to war, the Pope cries out once more to those responsible for the nations to stop the fighting and to turn to sincere negotiations, even at some cost, before greater slaughter makes them impossible, reminding them of their grave obligation in conscience. Turning to heaven for help, he asks the whole Christian family to pray to Mary, Queen of Peace, through the Rosary during October, which nourishes faith as well as warding off evils, and he asks that 4 October, the anniversary of his visit to the United Nations, be kept as a special day of prayer for peace, including true religious peace for those not free to profess their faith.",
    keyThemes: [
      "Prayer for peace in time of war",
      "Appeal to the leaders of nations",
      "Mary, Queen of Peace",
      "The October Rosary",
      "A day of prayer for peace",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/encyclicals/documents/hf_p-vi_enc_15091966_christi-matri.html",
    indexUrl: PAUL_VI_ENCYCLICALS,
    relatedDocuments: ["pacem-in-terris", "populorum-progressio"],
  }),
  doc({
    slug: "indulgentiarum-doctrina",
    title: "Indulgentiarum Doctrina",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1967-01-01",
    summary:
      "The apostolic constitution in which Paul VI restated the doctrine of indulgences and reformed their practice. The Pope explains that sin brings not only guilt but also punishment, which remains to be expiated even after the guilt is forgiven, and that the faithful are joined in the communion of saints, so that the infinite merits of Christ, together with the prayers and good works of the Blessed Virgin and the saints, form the treasury of the Church. In granting an indulgence the Church does not merely pray but, as minister of the redemption, authoritatively applies this treasury for the remission of temporal punishment, encouraging works of piety, penance and charity. The norms that follow define an indulgence; abolish the old reckoning of partial indulgences in days and years in favour of a measure based on the act and devotion of the person; allow a plenary indulgence to be gained only once a day, except at the hour of death; require for it sacramental confession, Eucharistic Communion, prayer for the Pope's intentions and freedom from all attachment to sin; and order a revision of the Enchiridion of indulgences.",
    keyThemes: [
      "Sin, guilt and temporal punishment",
      "The communion of saints and the treasury of the Church",
      "Plenary and partial indulgences",
      "Conditions for a plenary indulgence",
      "Reform of indulgence practice",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_01011967_indulgentiarum-doctrina.html",
    indexUrl: PAUL_VI_CONSTITUTIONS,
    relatedDocuments: ["paenitemini", "reconciliatio-et-paenitentia"],
  }),
  doc({
    slug: "signum-magnum",
    title: "Signum Magnum",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1967-05-13",
    summary:
      "Paul VI's apostolic exhortation on the veneration and imitation of the Blessed Virgin Mary, Mother of the Church, given on the day he went as a pilgrim to Fatima for the fiftieth anniversary of the apparitions. Recalling that he had proclaimed Mary the spiritual Mother of the Church at the close of the council's third session, the Pope explains two truths: Mary is Mother of the Church not only because she is the Mother of Christ but because she continues to cooperate, by her intercession and her example, in the birth and growth of the divine life in the faithful; and Christians are therefore called to imitate her virtues — her faith, her obedience to God's word and her charity. He presents her as a sign of unity among Christians and, on the twenty-fifth anniversary of Pius XII's consecration of the Church and the human race to her Immaculate Heart, invites all the faithful to renew their personal consecration to the Immaculate Heart of Mary.",
    keyThemes: [
      "Mary, Mother of the Church",
      "Mary's intercession and example",
      "Imitation of the Virgin's virtues",
      "Fiftieth anniversary of Fatima",
      "Consecration to the Immaculate Heart of Mary",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19670513_signum-magnum.html",
    indexUrl: PAUL_VI_EXHORTATIONS,
    relatedDocuments: ["lumen-gentium", "marialis-cultus", "redemptoris-mater"],
  }),
  doc({
    slug: "sacrum-diaconatus-ordinem",
    title: "Sacrum Diaconatus Ordinem",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1967-06-18",
    summary:
      "The apostolic letter given motu proprio in which Paul VI laid down general norms for restoring the permanent diaconate in the Latin Church, as the Second Vatican Council had allowed. It belongs to the episcopal conferences, with the Pope's approval, to decide whether and where deacons of this kind should be ordained. Young men called to the diaconate are bound to celibacy and may not be ordained before the age of twenty-five, after at least three years of formation in a special institute; mature married men may be ordained from the age of thirty-five with their wives' consent, provided they have shown a Christian life worthy of esteem, though if widowed they may not marry again. The letter lists the functions that may be entrusted to deacons — assisting the bishop and priest at the liturgy, administering baptism, distributing the Eucharist and bringing Viaticum, assisting at and blessing marriages, presiding at funerals, reading Scripture and preaching, leading prayer, and carrying out works of charity and administration — and treats their spiritual life and incardination.",
    keyThemes: [
      "Restoration of the permanent diaconate",
      "Celibate and married deacons",
      "Formation of deacons",
      "Liturgical and pastoral functions",
      "The role of episcopal conferences",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/motu_proprio/documents/hf_p-vi_motu-proprio_19670618_sacrum-diaconatus.html",
    indexUrl: PAUL_VI_MOTU_PROPRIO,
    relatedDocuments: ["lumen-gentium", "ministeria-quaedam"],
  }),
  doc({
    slug: "mysterii-paschalis",
    title: "Mysterii Paschalis",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1969-02-14",
    summary:
      "The apostolic letter given motu proprio by which Paul VI approved the general norms for the liturgical year and the new General Roman Calendar. Since the paschal mystery is the heart of Christian worship in its daily, weekly and yearly cycle, the Pope explains, the restoration of the liturgical year decreed by the council must bring it into sharper focus, continuing the work of Saint Pius X and John XXIII in restoring Sunday as the original feast day and renewing Lent, and of Pius XII in reviving the solemn Paschal Vigil. The feasts of the Blessed Virgin and the saints keep their place, but because saints' days had multiplied over the centuries, many were left to particular Churches, nations or communities, some names were removed from the universal calendar, and saints from every part of the world and age of history were added, so that the calendar better reflects the universality of the Church. The new calendar and norms were to take effect on 1 January 1970.",
    keyThemes: [
      "The paschal mystery at the centre of the liturgical year",
      "Restoration of Sunday",
      "Reform of the calendar of saints",
      "The universality of the Church in the calendar",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/motu_proprio/documents/hf_p-vi_motu-proprio_19690214_mysterii-paschalis.html",
    indexUrl: PAUL_VI_MOTU_PROPRIO,
    relatedDocuments: ["sacrosanctum-concilium", "missale-romanum", "dies-domini"],
  }),
  doc({
    slug: "laudis-canticum",
    title: "Laudis Canticum",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1970-11-01",
    summary:
      "The apostolic constitution, given on All Saints' Day 1970, by which Paul VI promulgated the Divine Office revised by decree of the Second Vatican Council, the Liturgy of the Hours. The Pope recalls that the hymn of praise sung eternally in heaven was brought to earth by Christ and is continued in the prayer of the Church, and explains the principal features of the reform, prepared after consultation of bishops, pastors, religious and laity: the Office is the prayer of the whole People of God, open to lay people as well as clergy and religious; Prime is suppressed, while Morning and Evening Prayer become the two hinges of the daily Office; the Office of Readings may be prayed at any hour; the psalter is distributed over four weeks in a new Latin version; the readings from Scripture and the Fathers are enriched; and intercessions are added at Lauds and Vespers, with the Lord's Prayer restored to its ancient place three times a day. Those mandated by the Church are to celebrate the whole cycle daily, keeping as far as possible to the true time of each hour. The Holy See publishes the text in Latin.",
    keyThemes: [
      "Promulgation of the Liturgy of the Hours",
      "The prayer of the whole People of God",
      "Morning and Evening Prayer as hinges of the day",
      "The four-week psalter",
      "The obligation of the Office",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/la/apost_constitutions/documents/hf_p-vi_apc_19701101_laudis-canticum.html",
    indexUrl: PAUL_VI_CONSTITUTIONS_LATIN,
    relatedDocuments: ["sacrosanctum-concilium", "divino-afflatu", "missale-romanum"],
  }),
  doc({
    slug: "octogesima-adveniens",
    title: "Octogesima Adveniens",
    documentType: "apostolic_letter",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1971-05-14",
    summary:
      "The apostolic letter that Paul VI addressed to Cardinal Maurice Roy, president of the Council of the Laity and of the Pontifical Commission Justice and Peace, for the eightieth anniversary of Rerum Novarum. Acknowledging that situations differ so widely that no single solution can be proposed for the whole world, the Pope asks Christian communities to analyse their own situation in the light of the Gospel and of the Church's social teaching. He surveys new social questions — urbanisation and the uprooting it causes, the place of young people and of women, the rights of workers and the role of unions, the victims of change, discrimination, emigration, the influence of the media, and the environment endangered by ill-considered exploitation of nature — and then examines the ideologies on offer, warning that a Christian cannot adhere to Marxist ideology or to liberal ideology in their full systems. He calls Christians to political action as a demanding form of charity, carried out with discernment and respect for legitimate diversity.",
    keyThemes: [
      "Eightieth anniversary of Rerum Novarum",
      "Discernment by local Christian communities",
      "New social questions: cities, youth, women, migrants",
      "The environment",
      "Ideologies and Christian political action",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_letters/documents/hf_p-vi_apl_19710514_octogesima-adveniens.html",
    indexUrl: PAUL_VI_LETTERS,
    relatedDocuments: ["rerum-novarum", "populorum-progressio", "quadragesimo-anno"],
  }),
  doc({
    slug: "evangelica-testificatio",
    title: "Evangelica Testificatio",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1971-06-29",
    summary:
      "Paul VI's apostolic exhortation on the renewal of religious life according to the teaching of the Second Vatican Council. Speaking to religious as dear sons and daughters, the Pope recalls how religious life grew in the Church under the Holy Spirit and distinguishes what must change — outdated external forms and encumbrances — from what must remain: the founders' charism and the total, irreversible gift of self to Christ through the evangelical counsels. He treats in turn the contemplative and the apostolic forms of religious life; consecrated chastity, given freely for the kingdom; poverty, which must make religious attentive to the cry of the poor and simple in their lifestyle; and obedience, lived in faith and in community. He insists on fraternal life, on prayer and the Eucharist as the centre of the community, on a sober and recognisable witness, and on fidelity, so that religious may show the world the primacy of God.",
    keyThemes: [
      "Renewal of religious life after the council",
      "The charism of founders",
      "Chastity, poverty and obedience",
      "The cry of the poor",
      "Community, prayer and witness",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19710629_evangelica-testificatio.html",
    indexUrl: PAUL_VI_EXHORTATIONS,
    relatedDocuments: ["perfectae-caritatis", "vita-consecrata", "lumen-gentium"],
  }),
  doc({
    slug: "divinae-consortium-naturae",
    title: "Divinae Consortium Naturae",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1971-08-15",
    summary:
      "The apostolic constitution by which Paul VI approved the revised rite of Confirmation and determined its essential elements. The Pope explains that the sacraments of Christian initiation — Baptism, Confirmation and the Eucharist — together bring the faithful to the full stature of Christ, comparing them to the birth, growth and nourishment of natural life, and traces the gift of the Spirit from Christ's promises and Pentecost through the laying on of hands by the Apostles and the anointing with chrism attested in East and West. Reviewing the history of the rite and the various formulas used in the Churches, and taking into account a venerable formula of the Eastern tradition, he decrees that in the Latin Church the sacrament of Confirmation is conferred through the anointing with chrism on the forehead, done with the laying on of the hand, together with words by which the confirmed receives the seal of the gift of the Holy Spirit. The Holy See publishes the text on vatican.va in Italian, Latin and Portuguese.",
    keyThemes: [
      "Christian initiation",
      "The gift of the Holy Spirit",
      "Anointing with chrism and laying on of hands",
      "The essential rite of Confirmation",
      "Eastern and Western traditions",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/it/apost_constitutions/documents/hf_p-vi_apc_19710815_divina-consortium.html",
    indexUrl: PAUL_VI_CONSTITUTIONS,
    relatedDocuments: ["sacrosanctum-concilium", "lumen-gentium"],
  }),
  doc({
    slug: "ministeria-quaedam",
    title: "Ministeria Quaedam",
    documentType: "motu_proprio",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1972-08-15",
    summary:
      "The apostolic letter given motu proprio by which Paul VI reformed the discipline of first tonsure, the minor orders and the subdiaconate in the Latin Church. Recalling that certain offices had long been regarded as steps toward the sacred orders, and that many bishops had asked for their review at the time of the council, the Pope decrees that first tonsure is no longer conferred and that entry into the clerical state is joined to the diaconate. What were called minor orders are henceforth called ministries and are conferred by institution rather than ordination; two are kept throughout the Latin Church, those of lector and acolyte, to which the functions of the former subdeacon pass, so that the major order of subdiaconate no longer exists, while episcopal conferences may ask the Holy See for others such as porter, exorcist or catechist. The letter sets out the functions of lector and acolyte, the requirements and intervals for candidates for orders, and, as was the norm at that time, reserves institution to these ministries to men. The Holy See publishes the text on vatican.va in Latin, Italian and Spanish.",
    keyThemes: [
      "Suppression of tonsure and the subdiaconate",
      "Minor orders become ministries",
      "The ministries of lector and acolyte",
      "Entry into the clerical state through the diaconate",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/la/motu_proprio/documents/hf_p-vi_motu-proprio_19720815_ministeria-quaedam.html",
    indexUrl: PAUL_VI_MOTU_PROPRIO,
    relatedDocuments: ["sacrum-diaconatus-ordinem", "sacrosanctum-concilium"],
  }),
  doc({
    slug: "sacram-unctionem-infirmorum",
    title: "Sacram Unctionem Infirmorum",
    documentType: "apostolic_constitution",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1972-11-30",
    summary:
      "The apostolic constitution by which Paul VI promulgated the revised rite of the Anointing of the Sick and determined its essential elements. The Pope recalls the Church's faith in this sacrament from the Letter of James, the Fathers and the Councils of Florence and Trent, and the Second Vatican Council's teaching that it is not only for those at the point of death but for any of the faithful who begin to be in danger because of sickness or old age. He decrees that the sacrament is conferred on those who are dangerously ill by anointing them on the forehead and hands with blessed olive oil or, where appropriate, another oil pressed from plants, while the prescribed words are said once; in necessity a single anointing on the forehead or another suitable part of the body suffices. He also provides that the sacrament may be repeated if the sick person recovers and falls ill again, or if the danger becomes more serious in the same illness.",
    keyThemes: [
      "The sacrament of the Anointing of the Sick",
      "For the seriously ill, not only the dying",
      "Anointing on the forehead and hands",
      "Olive oil or other plant oil",
      "Repetition of the sacrament",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_19721130_sacram-unctionem.html",
    indexUrl: PAUL_VI_CONSTITUTIONS,
    relatedDocuments: ["sacrosanctum-concilium", "salvifici-doloris"],
  }),
  doc({
    slug: "gaudete-in-domino",
    title: "Gaudete in Domino",
    documentType: "apostolic_exhortation",
    issuingAuthority: "Pope Saint Paul VI",
    issuedDate: "1975-05-09",
    summary:
      "Paul VI's apostolic exhortation on Christian joy, written during the Holy Year 1975 as a kind of hymn to the divine joy, in preparation for Pentecost. The Pope observes that technological society multiplies pleasures yet struggles to give joy, which comes from another source, and asks people to learn again to savour the simple human joys the Creator gives. Christian joy, however, is a sharing in the joy of the heart of Christ glorified: it was announced in the history of Israel, revealed fully in Christ, who lived in the joy of the Father's love even through the cross, and poured out by the Holy Spirit on the Church. The Pope shows it shining in Mary, in the martyrs and in the saints of East and West, dwelling on three figures in particular — Saint Francis of Assisi, Saint Thérèse of Lisieux and Blessed Maximilian Kolbe — and finds it present even in suffering and death for those who believe. He addresses the faithful of every condition, and especially the young, inviting them to find in the Jubilee and in the Holy Spirit the source of a joy that the world cannot give.",
    keyThemes: [
      "Christian joy",
      "Joy in the history of salvation",
      "The joy of Christ and of the Holy Spirit",
      "The saints as witnesses of joy",
      "The Holy Year 1975",
    ],
    canonicalUrl:
      "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19750509_gaudete-in-domino.html",
    indexUrl: PAUL_VI_EXHORTATIONS,
    relatedDocuments: ["evangelii-nuntiandi", "evangelii-gaudium", "gaudete-et-exsultate"],
  }),
];
