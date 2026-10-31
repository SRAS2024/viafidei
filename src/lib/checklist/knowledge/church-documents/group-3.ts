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
];
