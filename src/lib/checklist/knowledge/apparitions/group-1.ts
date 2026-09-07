import type { CuratedEntry } from "../index";

/**
 * Group 1 of the curated apparition catalogue.
 *
 * Every entry here is an apparition the Church has actually acted upon, and the
 * `approvedStatus` records only what a named authority actually decided — the
 * 1978 vocabulary for the older judgements, the six categories of the May 2024
 * DDF *Norms for proceeding in the discernment of alleged supernatural
 * phenomena* for the recent ones. Where the Church has approved the cult (a
 * feast, a canonical coronation, a patronage, a confraternity) without ever
 * pronouncing juridically on the apparition itself, the status is
 * `private_revelation` and the background says exactly what was approved.
 *
 * Approved private revelation belongs to the "help" the Church offers, not to
 * the deposit of faith: no Catholic is bound to believe any of it.
 */

const DDF_NORMS_2024 =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240517_norme-fenomeni-soprannaturali_en.html";
const DDF_MEDJUGORJE_NOTE =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240919_nota-esperienza-medjugorje_en.html";
export const apparitionGroupOne: CuratedEntry[] = [
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-queen-of-peace-medjugorje",
    authorityLevel: "VATICAN",
    citations: [
      DDF_MEDJUGORJE_NOTE,
      DDF_NORMS_2024,
      "https://press.vatican.va/content/salastampa/en/bollettino/pubblico/2024/09/19/240919i.html",
    ],
    payload: {
      slug: "apparition-our-lady-queen-of-peace-medjugorje",
      title: "Apparitions Reported at Medjugorje (Our Lady, Queen of Peace)",
      location: "Medjugorje, Diocese of Mostar-Duvno",
      country: "Bosnia and Herzegovina",
      approvedStatus: "nihil_obstat",
      decisionAuthority:
        "Dicastery for the Doctrine of the Faith, in the Note 'The Queen of Peace', approved by Pope Francis",
      decisionYear: 2024,
      subject: "marian",
      yearOfApparition: 1981,
      summary:
        "Beginning on 24 June 1981 six young people of the parish of Medjugorje reported apparitions of the Blessed Virgin Mary under the title Queen of Peace. On 19 September 2024 the Dicastery for the Doctrine of the Faith granted a nihil obstat to the spiritual experience connected with Medjugorje, recognising abundant fruits of conversion, prayer and reconciliation and authorising public devotion — while deliberately not pronouncing on the supernatural character of the reported apparitions themselves.",
      background:
        "The nihil obstat is the most favourable of the six conclusions set out in the 2024 DDF Norms for discerning alleged supernatural phenomena, and it is not a declaration of supernatural origin: the Note states that the faithful may give their prudent adherence to the spiritual proposal of Medjugorje, while the Church makes no judgement on the personal lives of the reported visionaries and does not affirm that the messages come from the Blessed Virgin. The Note distinguishes carefully between the abundant good fruits of the place — confessions, vocations, reconciliations, works of charity — and the individual reported messages, some of which it cautions must be read within the whole of Christian revelation. Belief in the events remains entirely free.",
      visionaries: [
        "Ivan Dragičević",
        "Ivanka Ivanković-Elez",
        "Jakov Čolo",
        "Marija Pavlović-Lunetti",
        "Mirjana Dragičević-Soldo",
        "Vicka Ivanković-Mijatović",
      ],
      messageHighlights: [
        "The reported messages centre on peace — with God, within oneself and among peoples — under the title Queen of Peace.",
        "They repeatedly urge conversion of heart, daily prayer, fasting, Scripture, confession and the Eucharist.",
      ],
      associatedMarianTitleSlug: "our-lady-queen-of-peace",
      officialDocumentUrl: DDF_MEDJUGORJE_NOTE,
      citations: [
        DDF_MEDJUGORJE_NOTE,
        DDF_NORMS_2024,
        "https://press.vatican.va/content/salastampa/en/bollettino/pubblico/2024/09/19/240919i.html",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-mercy-pellevoisin",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.pellevoisin.net/en/infos-pratiques/nihil-obstat-2024/",
      DDF_NORMS_2024,
      "https://www.ncregister.com/cna/vatican-grants-nihil-obstat-to-our-lady-of-mercy-shrine-in-france",
    ],
    payload: {
      slug: "apparition-our-lady-of-mercy-pellevoisin",
      title: "Apparitions of Our Lady of Mercy at Pellevoisin",
      location: "Pellevoisin, Archdiocese of Bourges",
      country: "France",
      approvedStatus: "nihil_obstat",
      decisionAuthority:
        "Dicastery for the Doctrine of the Faith, at the request of Archbishop Jérôme Beau of Bourges",
      decisionYear: 2024,
      subject: "marian",
      yearOfApparition: 1876,
      summary:
        "Estelle Faguette, a servant dying of tuberculosis at Pellevoisin in central France, reported fifteen apparitions of the Blessed Virgin Mary between February and December 1876, together with a sudden and lasting recovery. On 22 August 2024 the Dicastery for the Doctrine of the Faith granted a nihil obstat to the spiritual experience of Pellevoisin, so that the faithful are authorised to give it their prudent adherence.",
      background:
        "Pellevoisin was one of the first cases decided under the DDF's 2024 Norms. As with every nihil obstat, the Church affirms no certainty about the supernatural authenticity of the events; she recognises many signs of the action of the Holy Spirit in the fruits of the shrine and permits and encourages the devotion. Mary is honoured there under the title Mother of Mercy, and the shrine is associated with the scapular of the Sacred Heart, whose making Estelle reported being asked to promote. The archdiocesan shrine remains a place of pilgrimage in the Diocese of Bourges.",
      visionaries: ["Estelle Faguette"],
      messageHighlights: [
        "The reported messages call for calm, confidence and trust in God's mercy.",
        "They are bound up with devotion to the Sacred Heart of Jesus and with Mary invoked as Mother of Mercy.",
      ],
      associatedMarianTitleSlug: "our-lady-of-mercy",
      officialDocumentUrl: "https://www.pellevoisin.net/en/infos-pratiques/nihil-obstat-2024/",
      citations: [
        "https://www.pellevoisin.net/en/infos-pratiques/nihil-obstat-2024/",
        DDF_NORMS_2024,
        "https://www.ncregister.com/cna/vatican-grants-nihil-obstat-to-our-lady-of-mercy-shrine-in-france",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-kibeho",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://www.ewtn.com/catholicism/library/judgement-on-the-apparitions-of-kibeho-5709",
      "https://www.ewtn.com/catholicism/library/declaration-apparitions-of-kibeho-21169",
      "http://miraclehunter.com/marian_apparitions/statements/kibeho_statement_01.html",
    ],
    payload: {
      slug: "apparition-our-lady-of-kibeho",
      title: "Apparitions of Our Lady of Kibeho",
      location: "Kibeho, Diocese of Gikongoro",
      country: "Rwanda",
      approvedStatus: "approved",
      decisionAuthority: "Bishop Augustin Misago of Gikongoro",
      decisionYear: 2001,
      subject: "marian",
      yearOfApparition: 1981,
      summary:
        "From 28 November 1981 the Blessed Virgin Mary appeared at the college of Kibeho in southern Rwanda to three schoolgirls, presenting herself as Nyina wa Jambo, Mother of the Word. After twenty years of study by medical and theological commissions, Bishop Augustin Misago of Gikongoro declared on 29 June 2001 that the apparitions to these three visionaries are worthy of belief — the first Marian apparitions recognised in Africa.",
      background:
        "The bishop's declaration approved the apparitions received by Alphonsine Mumureke, Nathalie Mukamazimpaka and Marie-Claire Mukangango only, and expressly left aside the many other claims that arose at Kibeho in the same years. Some of what was reported — visions of rivers of blood and of a people destroying itself — has been read by many Rwandans in the light of the 1994 genocide, though the Church has made no pronouncement identifying the two. Kibeho is now a Marian shrine of Our Lady of Sorrows and a national centre of pilgrimage, penance and reconciliation.",
      visionaries: ["Alphonsine Mumureke", "Nathalie Mukamazimpaka", "Marie-Claire Mukangango"],
      messageHighlights: [
        "An urgent call to repentance and conversion of heart.",
        "A call to unceasing prayer, especially the Rosary and the Rosary of the Seven Sorrows of Our Lady.",
        "A call to sincere sorrow for sin and to fasting and penance offered for others.",
      ],
      associatedMarianTitleSlug: "our-lady-of-sorrows",
      officialDocumentUrl:
        "https://www.ewtn.com/catholicism/library/declaration-apparitions-of-kibeho-21169",
      citations: [
        "https://www.ewtn.com/catholicism/library/judgement-on-the-apparitions-of-kibeho-5709",
        "https://www.ewtn.com/catholicism/library/declaration-apparitions-of-kibeho-21169",
        "http://miraclehunter.com/marian_apparitions/statements/kibeho_statement_01.html",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-gietrzwald",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://gietrzwald.cudamaryjne.pl/en/cud-w-gietrzwaldzie.html",
      "https://www.ncregister.com/blog/40-years-before-fatima-our-lady-appeared-in-poland",
      "https://aleteia.org/2017/10/18/our-lady-of-gietrzwald-polands-only-approved-marian-appearance/",
    ],
    payload: {
      slug: "apparition-our-lady-of-gietrzwald",
      title: "Apparitions of Our Lady of Gietrzwałd",
      location: "Gietrzwałd, Warmia",
      country: "Poland",
      approvedStatus: "approved",
      decisionAuthority: "Bishop Józef Drzazga of Warmia",
      decisionYear: 1977,
      subject: "marian",
      yearOfApparition: 1877,
      summary:
        "Between 27 June and 16 September 1877 the Blessed Virgin Mary appeared at Gietrzwałd in Warmia to two peasant girls, Justyna Szafryńska and Barbara Samulowska, identifying herself as the Immaculate Conception and calling for the daily Rosary. On 11 September 1977, the centenary of the events, Bishop Józef Drzazga of Warmia formally recognised the apparitions — the only Marian apparitions approved by the Church in Poland.",
      background:
        "The apparitions took place under Prussian rule during the Kulturkampf, when Polish-speaking Catholics of Warmia were under heavy pressure; Our Lady spoke to the children in Polish, and the memory of that fact strengthened the faith and the language of the region. Both visionaries later entered the Sisters of Charity. The centenary celebration at which the recognition was announced was presided over by Cardinal Karol Wojtyła, Archbishop of Kraków, thirteen months before his election as Pope John Paul II. The shrine at Gietrzwałd is a place of pilgrimage, with a spring venerated since the time of the apparitions.",
      visionaries: ["Justyna Szafryńska", "Barbara Samulowska"],
      messageHighlights: [
        "Our Lady identified herself as the Immaculate Conception.",
        "She asked that the Rosary be prayed daily.",
      ],
      associatedMarianTitleSlug: "immaculate-conception",
      citations: [
        "https://gietrzwald.cudamaryjne.pl/en/cud-w-gietrzwaldzie.html",
        "https://www.ncregister.com/blog/40-years-before-fatima-our-lady-appeared-in-poland",
        "https://aleteia.org/2017/10/18/our-lady-of-gietrzwald-polands-only-approved-marian-appearance/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-betania",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://en.wikipedia.org/wiki/Betania,_Venezuela",
      "https://www.mariaesperanza.org/apparitions-in-finca-betania/",
      "https://english.religion.info/2005/05/02/venezuela-the-marian-apparitions-of-betania-attract-an-international-following/",
    ],
    payload: {
      slug: "apparition-our-lady-of-betania",
      title: "Apparitions of Our Lady of Betania (Reconciler of Peoples)",
      location: "Finca Betania, Cúa, Diocese of Los Teques",
      country: "Venezuela",
      approvedStatus: "approved",
      decisionAuthority: "Bishop Pío Bello Ricardo of Los Teques",
      decisionYear: 1987,
      subject: "marian",
      yearOfApparition: 1976,
      summary:
        "From 25 March 1976 the Blessed Virgin Mary was reported to appear at the farm of Betania near Cúa, first to María Esperanza Medrano de Bianchini and later, on 25 March 1984, to a large crowd of witnesses at once. On 21 November 1987 Bishop Pío Bello Ricardo of Los Teques declared the apparitions authentic and of supernatural character, and designated Betania a place of pilgrimage.",
      background:
        "Bishop Bello Ricardo, a Jesuit trained in psychology, conducted the inquiry himself, interviewing hundreds of witnesses and gathering several hundred written depositions before issuing his pastoral instruction. Mary is invoked at Betania under the title Reconciler of Peoples and Nations, and the site is dedicated to prayer for peace and reconciliation. The judgement is that of the local ordinary; as with all approved private revelation, no one is bound in faith to accept it.",
      visionaries: ["María Esperanza Medrano de Bianchini"],
      messageHighlights: [
        "Mary is invoked at Betania as Virgin and Mother, Reconciler of Peoples and Nations.",
        "The reported messages call for reconciliation, family prayer and peace.",
      ],
      citations: [
        "https://en.wikipedia.org/wiki/Betania,_Venezuela",
        "https://www.mariaesperanza.org/apparitions-in-finca-betania/",
        "https://english.religion.info/2005/05/02/venezuela-the-marian-apparitions-of-betania-attract-an-international-following/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-cuapa",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://www.ncregister.com/blog/1980-approved-marian-apparition-echoes-fatima",
      "https://thedivinemercy.org/articles/who-was-our-lady-cuapa",
    ],
    payload: {
      slug: "apparition-our-lady-of-cuapa",
      title: "Apparitions of Our Lady of Cuapa",
      location: "Cuapa, Chontales, Prelature of Juigalpa",
      country: "Nicaragua",
      approvedStatus: "approved",
      decisionAuthority: "Bishop Pablo Antonio Vega Mantilla of the Prelature of Juigalpa",
      decisionYear: 1982,
      subject: "marian",
      yearOfApparition: 1980,
      summary:
        "Between May 1980 and the following year the Blessed Virgin Mary appeared several times at Cuapa in Nicaragua to Bernardo Martínez, the sacristan of the village church, calling for the Rosary, for peace and for love among a people on the edge of civil war. Bishop Pablo Antonio Vega of Juigalpa issued a positive judgement on the apparitions in 1982.",
      background:
        "Bernardo Martínez was a poor, unlettered tailor and sacristan who at first told no one what he had seen. He was ordained a priest in 1995 and died in 2000. The apparitions took place while Nicaragua was descending into armed conflict, and their insistence on peace, forgiveness and the renewal of family prayer was heard against that background. A national sanctuary now stands at Cuapa.",
      visionaries: ["Bernardo Martínez"],
      messageHighlights: [
        "A call to pray the Rosary within the family, and to pray it with the heart rather than by rote.",
        "A call to make peace, to forgive one another and to fulfil the obligations of the faith.",
        "A call to listen to and live the word of God.",
      ],
      citations: [
        "https://www.ncregister.com/blog/1980-approved-marian-apparition-echoes-fatima",
        "https://thedivinemercy.org/articles/who-was-our-lady-cuapa",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-the-rosary-of-san-nicolas",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://www.ncregister.com/news/local-bishop-ongoing-messages-at-argentine-apparition-will-be-kept-private",
      "https://www.catholiccompany.com/blogs/magazine/our-lady-rosary-san-nicolas-5830",
    ],
    payload: {
      slug: "apparition-our-lady-of-the-rosary-of-san-nicolas",
      title: "Apparitions of Our Lady of the Rosary of San Nicolás",
      location: "San Nicolás de los Arroyos, Buenos Aires Province",
      country: "Argentina",
      approvedStatus: "approved",
      decisionAuthority: "Bishop Héctor Sabatino Cardelli of San Nicolás de los Arroyos",
      decisionYear: 2016,
      subject: "marian",
      yearOfApparition: 1983,
      summary:
        "From September 1983 Gladys Quiroga de Motta, a housewife of San Nicolás de los Arroyos, reported apparitions of the Blessed Virgin Mary holding the Child and a rosary, asking that a forgotten image of Our Lady of the Rosary be restored to honour and a sanctuary built by the river Paraná. On 22 May 2016 Bishop Héctor Cardelli declared the events and revelations up to 1990 to be of supernatural origin and worthy of belief.",
      background:
        "The image Gladys described was found stored away in the tower of the local cathedral, and the diocesan sanctuary of Our Lady of the Rosary of San Nicolás was built on the site indicated. Successive bishops permitted the publication of the messages with an imprimatur before the 2016 declaration; the bishop at the same time determined that any continuing communications would remain private. Pilgrims come in large numbers each 25 September. The declaration is that of the local ordinary and binds no one to belief.",
      visionaries: ["Gladys Quiroga de Motta"],
      messageHighlights: [
        "A request that the neglected image of Our Lady of the Rosary be restored to public veneration and a sanctuary raised.",
        "A steady call to the Rosary, to Scripture and to the sacrament of Confession.",
      ],
      associatedMarianTitleSlug: "our-lady-of-the-rosary",
      citations: [
        "https://www.ncregister.com/news/local-bishop-ongoing-messages-at-argentine-apparition-will-be-kept-private",
        "https://www.catholiccompany.com/blogs/magazine/our-lady-rosary-san-nicolas-5830",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-sorrows-castelpetroso",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/castelpetroso/index.html",
      "https://www.ncronline.org/blogs/ncr-today/day-apparition-castelpetroso",
    ],
    payload: {
      slug: "apparition-our-lady-of-sorrows-castelpetroso",
      title: "Apparition of Our Lady of Sorrows at Castelpetroso",
      location: "Castelpetroso, Molise, Diocese of Bojano",
      country: "Italy",
      approvedStatus: "approved",
      decisionAuthority: "Bishop Francesco Macarone Palmieri of Bojano",
      decisionYear: 1889,
      subject: "marian",
      yearOfApparition: 1888,
      summary:
        "On 22 March 1888 two peasant women of the hamlet of Pastine, Fabiana Cicchino and Serafina Valentino, saw in a hillside hollow near Castelpetroso the Blessed Virgin kneeling in the image of the Pietà, her arms open above the dead body of her Son. The Bishop of Bojano, who went to the place and saw the same vision on 26 September 1888, issued a formal declaration in February 1889 and opened a diocesan inquiry; devotion was authorised and a great sanctuary of Our Lady of Sorrows was built on the site.",
      background:
        "The foundation stone of the Gothic sanctuary was laid in 1890 before an immense crowd, and the church was consecrated only in 1975; Our Lady of Sorrows of Castelpetroso is honoured as patroness of the region of Molise. The apparition's whole content is the Sorrowful Mother beside her crucified Son — it carries no verbal message, and none should be attributed to it.",
      visionaries: ["Fabiana Cicchino", "Serafina Valentino"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-of-sorrows",
      citations: [
        "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/castelpetroso/index.html",
        "https://www.ncronline.org/blogs/ncr-today/day-apparition-castelpetroso",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-help-of-christians-filippsdorf",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/filippsdorf/index.html",
      "https://www.omnesmag.com/en/news/filipov-the-czech-sanctuary-uniting-faith-and-reconciliation/",
    ],
    payload: {
      slug: "apparition-our-lady-help-of-christians-filippsdorf",
      title: "Apparition of Our Lady, Help of Christians, at Filippsdorf",
      location: "Filippsdorf (Filipov), Diocese of Litoměřice",
      country: "Czech Republic",
      approvedStatus: "approved",
      decisionAuthority:
        "Bishop Augustin Pavel Wahala of Litoměřice, whose diocesan commission of inquiry recognised the healing as miraculous",
      subject: "marian",
      yearOfApparition: 1866,
      summary:
        "In the early morning of 13 January 1866 Magdalena Kade, a poor seamstress of Filippsdorf in northern Bohemia who had been given the last rites, saw the Blessed Virgin Mary at her bedside and was instantly and completely cured of a long and mortal illness. A diocesan commission examined the healing and recognised it as miraculous, and the basilica of Our Lady, Help of Christians, was raised over the room where it happened.",
      background:
        "The church built on the site was given the rank of minor basilica in 1885, and Filipov became known as the Lourdes of Bohemia; pilgrims still keep the anniversary with a Mass in the small hours of 13 January. In the twentieth century, after the expulsions that followed the Second World War, the shrine took on a further character as a place of reconciliation between Czechs and Germans. Only a single sentence of the apparition is handed down — that the sick woman was healed — and nothing further should be added to it.",
      visionaries: ["Magdalena Kade"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-help-of-christians",
      citations: [
        "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/filippsdorf/index.html",
        "https://www.omnesmag.com/en/news/filipov-the-czech-sanctuary-uniting-faith-and-reconciliation/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-siluva",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/siluva/index.html",
      "https://en.wikipedia.org/wiki/Our_Lady_of_%C5%A0iluva",
    ],
    payload: {
      slug: "apparition-our-lady-of-siluva",
      title: "Apparition of Our Lady of Šiluva",
      location: "Šiluva, Samogitia, Archdiocese of Kaunas",
      country: "Lithuania",
      approvedStatus: "approved",
      decisionAuthority: "Pope Pius VI",
      decisionYear: 1775,
      subject: "marian",
      yearOfApparition: 1608,
      summary:
        "In 1608, in a country where the Catholic parish of Šiluva had been suppressed for two generations, shepherd children saw a young woman standing on a rock in the fields, holding a child and weeping. Asked why she wept, she is remembered to have answered that once her Son was worshipped in that place, and now it is ploughed and sown. The Catholic church of Šiluva was restored, and the Holy See confirmed the veneration; Pope Pius VI granted a canonical coronation to the image in 1786.",
      background:
        "Šiluva is one of the earliest apparitions in Europe to receive papal confirmation, and the events were witnessed by Calvinists as well as Catholics in a district that had passed to the Reformation. The Basilica of the Nativity of the Blessed Virgin Mary and the Chapel of the Apparition mark the site; Šiluva remained a rallying point of Lithuanian Catholic identity through the Soviet period, and Pope John Paul II prayed there in 1993. The great pilgrimage is kept in early September around the feast of Mary's Nativity.",
      visionaries: ["shepherd children of Šiluva"],
      messageHighlights: [],
      citations: [
        "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/siluva/index.html",
        "https://en.wikipedia.org/wiki/Our_Lady_of_%C5%A0iluva",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-the-miracle-santandrea-delle-fratte",
    authorityLevel: "DIOCESAN",
    citations: [
      "http://www.miraclehunter.com/marian_apparitions/approved_apparitions/rome1842/index.html",
      "https://famvin.org/en/2024/11/26/basilica-of-santandrea-delle-fratte-rome-italy-a-significant-site-for-devotees-of-our-lady-of-the-miraculous-medal/",
    ],
    payload: {
      slug: "apparition-our-lady-of-the-miracle-santandrea-delle-fratte",
      title: "Apparition of Our Lady of the Miracle (Sant'Andrea delle Fratte)",
      location: "Basilica of Sant'Andrea delle Fratte, Rome",
      country: "Italy",
      approvedStatus: "approved",
      decisionAuthority:
        "Cardinal Costantino Patrizi, Vicar General of Rome, by the canonical inquiry ordered by Pope Gregory XVI",
      decisionYear: 1842,
      subject: "marian",
      yearOfApparition: 1842,
      summary:
        "On 20 January 1842 Alphonse Ratisbonne, a young Jewish banker from Strasbourg, hostile to the Catholic faith and in Rome only as a traveller, entered the church of Sant'Andrea delle Fratte and there saw the Blessed Virgin Mary as she is shown on the Miraculous Medal. He was baptised eleven days later. Pope Gregory XVI ordered a canonical investigation, conducted by his Cardinal Vicar Costantino Patrizi, which concluded in 1842 that the sudden conversion was a true miracle.",
      background:
        "Ratisbonne had accepted a Miraculous Medal and the Memorare only days before, as a wager against a Catholic friend. After his conversion he became a priest and, with his brother Théodore, founded a congregation dedicated to prayer for the Jewish people. The chapel where it happened is now the Sanctuary of the Madonna del Miracolo within the basilica. The vision was silent; Ratisbonne always insisted that he had been given no words but an overwhelming knowledge of the truth of the faith.",
      visionaries: ["Alphonse Marie Ratisbonne"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-of-the-miraculous-medal",
      citations: [
        "http://www.miraclehunter.com/marian_apparitions/approved_apparitions/rome1842/index.html",
        "https://famvin.org/en/2024/11/26/basilica-of-santandrea-delle-fratte-rome-italy-a-significant-site-for-devotees-of-our-lady-of-the-miraculous-medal/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-lichen",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://marian.org/articles/beautiful-sorrowful-mother-poland",
      "https://udayton.edu/imri/mary/o/our-lady-of-lichen.php",
    ],
    payload: {
      slug: "apparition-our-lady-of-lichen",
      title: "Apparitions Reported at Licheń (Our Lady of Sorrows, Queen of Poland)",
      location: "Licheń Stary, Diocese of Włocławek",
      country: "Poland",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Cardinal Stefan Wyszyński, Primate of Poland, by the canonical coronation of the image of Our Lady of Licheń",
      decisionYear: 1967,
      subject: "marian",
      yearOfApparition: 1850,
      summary:
        "In 1850 and 1852 the shepherd Mikołaj Sikatka reported apparitions of the Blessed Virgin Mary in the woods of Grablin near Licheń, calling the people to penance and the Rosary and foretelling a time of trial; a cholera epidemic swept the district soon after, and the small image of the Sorrowful Mother, Queen of Poland became a centre of pilgrimage. The Church has approved and fostered the cult without issuing a juridical judgement on the apparitions themselves.",
      background:
        "The image at Licheń had been found in the forest by Tomasz Kłossowski, a soldier wounded at Leipzig in 1813. It was solemnly transferred to Licheń in 1852 before a great crowd of pilgrims. Cardinal Stefan Wyszyński crowned the image in 1967, and the enormous basilica raised at Licheń in the 1990s and 2000s, entrusted to the Marian Fathers, received the title of minor basilica in 2005. What the Church has approved here is the veneration of Our Lady of Sorrows, Queen of Poland — the apparitions have never been the object of a formal decree.",
      visionaries: ["Mikołaj Sikatka"],
      messageHighlights: ["A call to penance, to the Rosary and to the reform of life."],
      associatedMarianTitleSlug: "our-lady-of-sorrows",
      citations: [
        "https://marian.org/articles/beautiful-sorrowful-mother-poland",
        "https://udayton.edu/imri/mary/o/our-lady-of-lichen.php",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-good-success-quito",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://en.wikipedia.org/wiki/Our_Lady_of_the_Good_Event",
      "https://focus.org/posts/meet-our-lady-our-lady-of-good-success/",
    ],
    payload: {
      slug: "apparition-our-lady-of-good-success-quito",
      title: "Revelations to Mother Mariana de Jesús Torres (Our Lady of Good Success)",
      location: "Royal Monastery of the Immaculate Conception, Quito",
      country: "Ecuador",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Bishop Salvador de Ribera of Quito, who attested the making of the statue and solemnly consecrated it on 2 February 1611",
      decisionYear: 1611,
      subject: "marian",
      yearOfApparition: 1594,
      summary:
        "Mother Mariana de Jesús Torres, a Spanish Conceptionist among the founders of the Royal Monastery of the Immaculate Conception in Quito, reported visions of the Blessed Virgin Mary under the title of Good Success between 1594 and her death in 1635, including the request for a statue to be made and set above the abbess's chair. Bishop Salvador de Ribera consecrated that statue in 1611, and the cult of Our Lady of Good Success has been approved and fostered ever since.",
      background:
        "What the Church has approved at Quito is the veneration of Our Lady of Good Success: the bishop's act of 1611, the enduring devotion of the monastery and city, and the canonical coronation of the image in 1991. No ecclesiastical decree has ever judged the supernatural character of the revelations themselves. Much of the material circulated in modern devotional literature — including the long prophecies about later centuries — derives from a biography written in 1790, more than a century and a half after Mother Mariana's death, and has never been the subject of any Church judgement; it should be read with corresponding reserve.",
      visionaries: ["Mother Mariana de Jesús Torres y Berriochoa"],
      messageHighlights: [],
      citations: [
        "https://en.wikipedia.org/wiki/Our_Lady_of_the_Good_Event",
        "https://focus.org/posts/meet-our-lady-our-lady-of-good-success/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-ocotlan",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://miraclehunter.com/marian_apparitions/approved_apparitions/ocotlan/index.html",
      "https://www.ncregister.com/features/where-our-lady-keeps-her-promises",
    ],
    payload: {
      slug: "apparition-our-lady-of-ocotlan",
      title: "Apparition of Our Lady of Ocotlán",
      location: "Ocotlán, Tlaxcala",
      country: "Mexico",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Saint Pius X, by the decree of canonical coronation of the image of Our Lady of Ocotlán",
      decisionYear: 1909,
      subject: "marian",
      yearOfApparition: 1541,
      summary:
        "In 1541, ten years after Guadalupe and during an epidemic that was emptying the villages of Tlaxcala, the Blessed Virgin Mary is remembered to have met the Christian Indian Juan Diego Bernardino as he carried water to his sick relatives, and to have shown him a spring whose water healed them. A statue of Our Lady was found in the pine grove that gives Ocotlán its name, and the sanctuary built there is one of the great Marian shrines of Mexico.",
      background:
        "The devotion has been repeatedly confirmed by the Church: Our Lady of Ocotlán was declared patroness of Tlaxcala in the eighteenth century, the image received a decree of canonical coronation from Pope Saint Pius X in 1909, and the sanctuary was later raised to the rank of a basilica. As at many colonial-era shrines, no juridical decree has ever pronounced on the apparition itself; what the Church approves and encourages is the cult.",
      visionaries: ["Juan Diego Bernardino"],
      messageHighlights: [],
      citations: [
        "https://miraclehunter.com/marian_apparitions/approved_apparitions/ocotlan/index.html",
        "https://www.ncregister.com/features/where-our-lady-keeps-her-promises",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-coromoto",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.vaticanstate.va/en/news/2921-the-inauguration-of-the-mosaic-of-our-lady-of-coromoto-in-the-vatican-gardens.html",
      "https://en.wikipedia.org/wiki/Our_Lady_of_Coromoto",
    ],
    payload: {
      slug: "apparition-our-lady-of-coromoto",
      title: "Apparition of Our Lady of Coromoto",
      location: "Guanare, Portuguesa",
      country: "Venezuela",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Pius XII, who declared Our Lady of Coromoto Patroness of the Republic of Venezuela",
      decisionYear: 1944,
      subject: "marian",
      feastDay: "09-11",
      yearOfApparition: 1652,
      summary:
        "According to the tradition of Guanare, the Blessed Virgin Mary appeared in 1651 and again on 8 September 1652 to the chief of the Cospes people, urging him to receive baptism; when he resisted and reached out to seize her, she vanished, leaving in his hand a small image which is venerated to this day in the basilica of Our Lady of Coromoto.",
      background:
        "The Holy See has confirmed the devotion in the strongest terms available for a cult: Pope Pius XII declared Our Lady of Coromoto Patroness of Venezuela in 1944, raised her sanctuary to a basilica in 1949 and ordered the canonical coronation of the image on the third centenary of the apparition. Pope Saint John Paul II visited and crowned the new national sanctuary in 1996. As with the other colonial apparitions of the Americas, no decree has ever ruled juridically on the events themselves; it is the veneration that the Church has approved.",
      visionaries: ["the chief of the Cospes people, baptised Juan Coromoto"],
      messageHighlights: [],
      citations: [
        "https://www.vaticanstate.va/en/news/2921-the-inauguration-of-the-mosaic-of-our-lady-of-coromoto-in-the-vatican-gardens.html",
        "https://en.wikipedia.org/wiki/Our_Lady_of_Coromoto",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-las-lajas",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "http://www.miraclehunter.com/marian_apparitions/approved_apparitions/guaitara/index.html",
      "https://catholicexchange.com/miraculous-image-lady-las-lajas/",
    ],
    payload: {
      slug: "apparition-our-lady-of-las-lajas",
      title: "Our Lady of Las Lajas",
      location: "Guáitara Canyon near Ipiales, Nariño",
      country: "Colombia",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Pius XII, by the canonical coronation of the image of Our Lady of Las Lajas",
      decisionYear: 1952,
      subject: "marian",
      feastDay: "09-16",
      yearOfApparition: 1754,
      summary:
        "In 1754 María Mueses de Quiñones and her small deaf-mute daughter Rosa took shelter from a storm in a rock cleft above the Guáitara canyon; according to the tradition the child spoke for the first time, saying that a lady was calling her, and an image of the Virgin with the Child was afterwards found on the face of the flagstone. The sanctuary of Las Lajas, built across the gorge, grew from that place.",
      background:
        "The Church's recognition here has been of the cult: Pope Pius XII granted the image a canonical coronation in 1952 and the title of minor basilica to the sanctuary shortly afterwards. Popular accounts of scientific tests on the rock circulate widely; they are not the basis of the Church's approval, which rests on the enduring devotion of the faithful, and they should not be repeated as though they were.",
      visionaries: ["María Mueses de Quiñones", "her daughter Rosa"],
      messageHighlights: [],
      citations: [
        "http://www.miraclehunter.com/marian_apparitions/approved_apparitions/guaitara/index.html",
        "https://catholicexchange.com/miraculous-image-lady-las-lajas/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-zeitoun",
    authorityLevel: "ACADEMIC",
    citations: [
      "https://udayton.edu/blogs/marianlibrary/2024-04-29-mary-in-zeitoun.php",
      "https://en.wikipedia.org/wiki/Our_Lady_of_Zeitoun",
      "https://catholicexchange.com/the-unlikely-marian-apparition-at-zeitoun-egypt/",
    ],
    payload: {
      slug: "apparition-our-lady-of-zeitoun",
      title: "Apparitions Reported at Zeitoun, Cairo",
      location: "Coptic Orthodox Church of the Virgin Mary, Zeitoun, Cairo",
      country: "Egypt",
      approvedStatus: "not_yet_judged",
      subject: "marian",
      yearOfApparition: 1968,
      summary:
        "From 2 April 1968 and for some three years, luminous figures resembling the Blessed Virgin Mary were reported above the domes of the Coptic Orthodox church of the Virgin Mary at Zeitoun in Cairo, seen by very large crowds of Christians, Muslims and others, and widely photographed. The apparitions were silent, and no words were reported.",
      background:
        "Zeitoun was investigated by the Coptic Orthodox Patriarchate of Alexandria: Pope Kyrillos VI appointed a commission of bishops and priests, and on 4 May 1968 issued an official statement confirming the apparitions. That decision belongs to the Coptic Orthodox Church, not to the Catholic Church, and it is important not to present it as a Catholic approval. The events occurred at an Orthodox church, and no decree of the Holy See or of a Catholic ordinary has judged them; the Catholic Church has therefore taken no position, and Catholics remain entirely free with regard to them. Zeitoun stands near the traditional route of the Holy Family's flight into Egypt, which is why so many in Egypt received the reports as a sign of Mary's presence with a suffering people.",
      visionaries: ["large public crowds; no individual seer"],
      messageHighlights: [],
      citations: [
        "https://udayton.edu/blogs/marianlibrary/2024-04-29-mary-in-zeitoun.php",
        "https://en.wikipedia.org/wiki/Our_Lady_of_Zeitoun",
        "https://catholicexchange.com/the-unlikely-marian-apparition-at-zeitoun-egypt/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-the-pillar-zaragoza",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://udayton.edu/imri/mary/o/our-lady-of-the-pillar.php",
      "https://en.wikipedia.org/wiki/Our_Lady_of_the_Pillar",
    ],
    payload: {
      slug: "apparition-our-lady-of-the-pillar-zaragoza",
      title: "Our Lady of the Pillar Appearing to Saint James at Zaragoza",
      location: "Zaragoza (Caesaraugusta), Aragón",
      country: "Spain",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Innocent XIII, who extended the liturgical veneration of Our Lady of the Pillar throughout the Spanish dominions",
      decisionYear: 1730,
      subject: "marian",
      feastDay: "10-12",
      yearOfApparition: 40,
      summary:
        "An ancient Spanish tradition holds that while the Apostle James was preaching with little success on the banks of the Ebro at Caesaraugusta, the Blessed Virgin Mary — still living in Jerusalem — came to encourage him, standing upon a pillar of jasper, and asked that a chapel be raised on that spot. The pillar is venerated in the Basilica of Our Lady of the Pillar in Zaragoza, and the feast is kept on 12 October.",
      background:
        "This is a venerable tradition, not a juridically approved apparition: the Church has issued no decree on the event, and its earliest written attestations are many centuries later than the date it assigns. What the Church has approved is the cult — the liturgical feast, extended by Pope Innocent XIII in 1730 and now kept as a solemnity in Zaragoza and throughout Spain, and the canonical coronation of the image by Pope Saint Pius X in 1905. Our Lady of the Pillar is honoured as patroness of Hispanic peoples, and 12 October is the national feast of Spain.",
      visionaries: ["Saint James the Greater, Apostle"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-of-the-pillar",
      citations: [
        "https://udayton.edu/imri/mary/o/our-lady-of-the-pillar.php",
        "https://en.wikipedia.org/wiki/Our_Lady_of_the_Pillar",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-walsingham",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://www.walsingham.org.uk/our-story/",
      "https://en.wikipedia.org/wiki/Our_Lady_of_Walsingham",
    ],
    payload: {
      slug: "apparition-our-lady-of-walsingham",
      title: "Vision of the Holy House at Walsingham",
      location: "Walsingham, Norfolk",
      country: "United Kingdom",
      approvedStatus: "private_revelation",
      subject: "marian",
      feastDay: "09-24",
      yearOfApparition: 1061,
      summary:
        "The tradition of Walsingham holds that in 1061 the widowed noblewoman Richeldis de Faverches, praying to be given some work in Our Lady's honour, was shown in spirit the house at Nazareth where the Annunciation took place, and was asked to build its likeness in Norfolk. The Holy House she raised made Walsingham 'England's Nazareth' and one of the great pilgrimage places of medieval Europe.",
      background:
        "The Church has never issued a decree on Richeldis's vision; what she has approved and cherished is the shrine and its devotion. The medieval shrine was destroyed under Henry VIII in 1538. Catholic pilgrimage was restored in the nineteenth century and the Slipper Chapel a mile from the village became the Catholic National Shrine of Our Lady; an Anglican shrine also flourishes in the village, and Walsingham has become a place of ecumenical prayer. The feast of Our Lady of Walsingham is kept in England on 24 September.",
      visionaries: ["Richeldis de Faverches"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-of-walsingham",
      citations: [
        "https://www.walsingham.org.uk/our-story/",
        "https://en.wikipedia.org/wiki/Our_Lady_of_Walsingham",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-mount-carmel-simon-stock",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: [
      "https://carmelitefriarsocd.org/blog/brown-scapular",
      "https://www.wordonfire.org/articles/5-things-to-know-about-our-lady-of-mt-carmel-and-the-brown-scapular/",
    ],
    payload: {
      slug: "apparition-our-lady-of-mount-carmel-simon-stock",
      title: "Our Lady of Mount Carmel and the Brown Scapular (Saint Simon Stock)",
      location: "Aylesford, Kent",
      country: "United Kingdom",
      approvedStatus: "private_revelation",
      subject: "marian",
      feastDay: "07-16",
      yearOfApparition: 1251,
      summary:
        "Carmelite tradition holds that on 16 July 1251 the Blessed Virgin Mary appeared at Aylesford to Saint Simon Stock, then leading the order in its difficult transplanting from Mount Carmel to Europe, and gave him the scapular of the habit as a sign of her protection. The brown scapular has since become one of the most widespread sacramentals in the Church.",
      background:
        "The Church has never issued any pronouncement on the historicity of this vision, and historians debate its earliest attestation; what she has approved is the scapular itself as a sacramental and the devotion to Our Lady of Mount Carmel, whose feast on 16 July is kept in the universal calendar. The Carmelite orders teach that the scapular is a sign of consecration to Mary and of the desire to live her fidelity to Christ, worn by those who intend to live and die in the state of grace — and they expressly do not promote the so-called Sabbatine privilege or any promise that mere wearing of the cloth guarantees salvation. A sacramental disposes to grace; it never dispenses from conversion, the sacraments and a Christian life.",
      visionaries: ["Saint Simon Stock"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-of-mount-carmel",
      citations: [
        "https://carmelitefriarsocd.org/blog/brown-scapular",
        "https://www.wordonfire.org/articles/5-things-to-know-about-our-lady-of-mt-carmel-and-the-brown-scapular/",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-mercy-peter-nolasco",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: [
      "https://www.orderofmercy.org/our-history",
      "https://www.newadvent.org/cathen/10197b.htm",
    ],
    payload: {
      slug: "apparition-our-lady-of-mercy-peter-nolasco",
      title: "Our Lady of Mercy and the Founding of the Mercedarians",
      location: "Barcelona, Catalonia",
      country: "Spain",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Gregory IX, by the bull confirming the Order of the Blessed Virgin Mary of Mercy",
      decisionYear: 1230,
      subject: "marian",
      feastDay: "09-24",
      yearOfApparition: 1218,
      summary:
        "Mercedarian tradition holds that in 1218 the Blessed Virgin Mary made known to Saint Peter Nolasco, and to those who counselled him, her desire for an order devoted to ransoming Christians held captive and in danger of losing their faith. On 10 August 1218 Peter and his first companions were received as the Order of the Blessed Virgin Mary of Mercy, whose members take a fourth vow to give themselves as hostages in place of captives if need be.",
      background:
        "The Church has issued no decree on the vision itself; her approval belongs to the order and to the devotion that came from it. Saint Raymond of Penyafort assisted the foundation and King James I of Aragon protected it; Pope Gregory IX confirmed the order in 1230 and gave it the Rule of Saint Augustine. Our Lady of Mercy — Nuestra Señora de la Merced — is honoured on 24 September and is patroness of Barcelona and of the Dominican Republic; the Mercedarians continue their work today among prisoners and the trafficked.",
      visionaries: ["Saint Peter Nolasco"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-of-mercy",
      citations: [
        "https://www.orderofmercy.org/our-history",
        "https://www.newadvent.org/cathen/10197b.htm",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-the-snows-rome",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.catholicculture.org/culture/library/view.cfm?recnum=5814",
      "https://www.ncregister.com/blog/st-mary-major-and-our-lady-of-the-snows",
    ],
    payload: {
      slug: "apparition-our-lady-of-the-snows-rome",
      title: "Our Lady of the Snows and the Founding of Saint Mary Major",
      location: "Esquiline Hill, Rome",
      country: "Italy",
      approvedStatus: "private_revelation",
      subject: "marian",
      feastDay: "08-05",
      summary:
        "A Roman tradition tells that in the fourth century, in the time of Pope Liberius, the Blessed Virgin Mary appeared in a dream to a childless patrician named John and to the Pope himself, asking that a church be built where snow would fall in the height of summer; on the morning of 5 August snow was found lying on the Esquiline Hill, and the basilica of Saint Mary Major was raised there.",
      background:
        "The legend of the snow is a pious tradition first attested centuries after the events it describes; the Church has made no judgement on it, and what she celebrates on 5 August is the Dedication of the Basilica of Saint Mary Major, the greatest of the Roman churches of Our Lady. The story is still commemorated each year at the basilica with a fall of white petals. Many churches and shrines around the world bear the title Our Lady of the Snows, which comes from this tradition.",
      visionaries: ["a Roman patrician named John", "Pope Liberius"],
      messageHighlights: [],
      associatedMarianTitleSlug: "our-lady-of-the-snows",
      citations: [
        "https://www.catholicculture.org/culture/library/view.cfm?recnum=5814",
        "https://www.ncregister.com/blog/st-mary-major-and-our-lady-of-the-snows",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-saint-michael-monte-gargano",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://longobardinitalia.it/en/sanctuary-complex-of-san-michele-arcangelo/",
      "https://en.wikipedia.org/wiki/Sanctuary_of_Monte_Sant%27Angelo",
    ],
    payload: {
      slug: "apparition-saint-michael-monte-gargano",
      title: "Apparitions of Saint Michael the Archangel at Monte Gargano",
      location: "Monte Sant'Angelo, Gargano, Apulia",
      country: "Italy",
      approvedStatus: "private_revelation",
      subject: "angel",
      feastDay: "09-29",
      yearOfApparition: 490,
      summary:
        "The oldest shrine of Saint Michael in western Europe stands over a cave on the Gargano promontory where, according to a tradition reaching back to the end of the fifth century, the Archangel appeared three times to Saint Laurence Maiorano, Bishop of Siponto, claiming the cave as his own and declaring that where the rock opens, the sins of men may be forgiven.",
      background:
        "The cave-basilica of San Michele Arcangelo has been a place of pilgrimage without interruption since late antiquity; it lay on the pilgrim roads to Jerusalem, and popes, emperors and saints — among them Saint Francis of Assisi and Saint Padre Pio — went there. The Church has never issued a decree on the apparitions; the cult is ancient and fully approved, and the sanctuary is a UNESCO World Heritage site. The universal Church keeps the feast of the Holy Archangels Michael, Gabriel and Raphael on 29 September; the Gargano sanctuary also keeps 8 May, the day traditionally assigned to the dedication of the cave.",
      visionaries: ["Saint Laurence Maiorano, Bishop of Siponto"],
      messageHighlights: [],
      citations: [
        "https://longobardinitalia.it/en/sanctuary-complex-of-san-michele-arcangelo/",
        "https://en.wikipedia.org/wiki/Sanctuary_of_Monte_Sant%27Angelo",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-saint-joseph-cotignac",
    authorityLevel: "DIOCESAN",
    citations: [
      "https://frejustoulon.fr/diocese/hauts-lieux-spirituels-var/sanctuaire-saint-joseph-du-bessillon-a-cotignac/",
      "https://en.saintjosephcotignac.com/histoire",
    ],
    payload: {
      slug: "apparition-saint-joseph-cotignac",
      title: "Apparition of Saint Joseph at Cotignac",
      location: "Mont Bessillon, Cotignac, Diocese of Fréjus-Toulon",
      country: "France",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Bishop Joseph Zongo Ondedei of Fréjus, who entrusted the place of the apparition to the Oratorians in January 1661",
      decisionYear: 1661,
      subject: "saint",
      yearOfApparition: 1660,
      summary:
        "On 7 June 1660 a young shepherd named Gaspard Ricard, exhausted and parched on the slope of Mont Bessillon near Cotignac, saw a man who pointed to a boulder and said: I am Joseph; lift that rock and you will drink. The shepherd moved the stone, which several men could barely shift afterwards, and a spring came forth that flows still.",
      background:
        "The Bishop of Fréjus acted at once: within months the place was entrusted to the Oratorians, and a sanctuary was consecrated there in 1663. Cotignac is the only place in the world with a recognised sanctuary of an apparition of Saint Joseph, and it stands a short distance from Notre-Dame de Grâces, where Mary had been venerated since 1519 and where Louis XIII consecrated France to her. The Church has never issued a decree on the supernatural character of the event; she has approved and sustained the cult, and Cotignac remains a diocesan shrine of the Diocese of Fréjus-Toulon.",
      visionaries: ["Gaspard Ricard"],
      messageHighlights: [
        "'I am Joseph; lift it and you will drink' — the only words handed down from the apparition.",
      ],
      citations: [
        "https://frejustoulon.fr/diocese/hauts-lieux-spirituels-var/sanctuaire-saint-joseph-du-bessillon-a-cotignac/",
        "https://en.saintjosephcotignac.com/histoire",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-sacred-heart-paray-le-monial",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15051956_haurietis-aquas.html",
      "https://sacrecoeur-paray.org/en/home/",
      "https://www.ewtn.com/catholicism/library/the-revelation-of-the-sacred-heart-of-jesus-paral-le-monial-france-13719",
    ],
    payload: {
      slug: "apparition-sacred-heart-paray-le-monial",
      title: "Revelations of the Sacred Heart to Saint Margaret Mary Alacoque",
      location: "Monastery of the Visitation, Paray-le-Monial",
      country: "France",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Pius IX, who extended the feast of the Sacred Heart of Jesus to the universal Church",
      decisionYear: 1856,
      subject: "christ",
      yearOfApparition: 1673,
      summary:
        "Between December 1673 and June 1675, in the Visitation monastery of Paray-le-Monial, our Lord showed Saint Margaret Mary Alacoque his Heart burning with love for humanity and asked for a return of love: frequent Communion, Communion on the first Friday of the month, an hour of prayer on Thursday nights in union with his agony, and a feast in honour of his Heart.",
      background:
        "Margaret Mary's revelations were long resisted; her Jesuit confessor, Saint Claude de la Colombière, recognised their soundness and helped make them known. The Church's response has come through the liturgy and the magisterium rather than through a decree on the apparitions themselves: Pope Pius IX extended the feast of the Sacred Heart to the whole Church in 1856, Margaret Mary was canonised in 1920, Pope Leo XIII consecrated the human race to the Sacred Heart in 1899, and Pope Pius XII set out the doctrine of the devotion in the encyclical Haurietis Aquas (1956), teaching that its object is the love of the Incarnate Word, symbolised by his wounded human Heart. The devotion is entirely at the service of that mystery; the promises circulated in popular literature under the name of the twelve promises are not part of the Church's doctrinal teaching and should not be presented as such.",
      visionaries: ["Saint Margaret Mary Alacoque"],
      messageHighlights: [
        "A revelation of the Heart of Jesus as the sign of his love for humanity, and a request for love in return.",
        "A call to reparation for indifference and ingratitude toward that love.",
        "The requests for Communion on the first Friday, the Holy Hour, and a feast in honour of the Sacred Heart.",
      ],
      officialDocumentUrl:
        "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15051956_haurietis-aquas.html",
      citations: [
        "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15051956_haurietis-aquas.html",
        "https://sacrecoeur-paray.org/en/home/",
        "https://www.ewtn.com/catholicism/library/the-revelation-of-the-sacred-heart-of-jesus-paral-le-monial-france-13719",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-divine-mercy-saint-faustina",
    authorityLevel: "VATICAN",
    citations: [
      "https://www.vatican.va/content/john-paul-ii/en/homilies/2000/documents/hf_jp-ii_hom_20000430_faustina.html",
      "https://www.vatican.va/news_services/liturgy/documents/ns_lit_doc_20000430_notification-canonizzazione_en.html",
      "https://www.vatican.va/content/john-paul-ii/en/homilies/2001/documents/hf_jp-ii_hom_20010422_divina-misericordia.html",
    ],
    payload: {
      slug: "apparition-divine-mercy-saint-faustina",
      title: "Revelations of the Divine Mercy to Saint Faustina Kowalska",
      location: "Płock and Vilnius",
      country: "Poland",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Congregation for the Doctrine of the Faith, by the notification withdrawing the 1959 prohibition of the devotion in the forms proposed by Sister Faustina",
      decisionYear: 1978,
      subject: "christ",
      yearOfApparition: 1931,
      summary:
        "On 22 February 1931, in the convent at Płock, Sister Faustina Kowalska of the Congregation of the Sisters of Our Lady of Mercy saw our Lord clothed in white, with two rays streaming from his breast, and was asked that an image be painted with the words 'Jesus, I trust in You'. Over the following years, chiefly at Vilnius and Kraków, she recorded in her Diary the message of God's mercy, the chaplet, the hour of mercy and the request for a feast on the Sunday after Easter.",
      background:
        "The devotion had a difficult history. In 1959 the Holy Office forbade the spreading of images and writings propagating the devotion in the forms proposed by Sister Faustina, partly on the basis of faulty translations of her Diary. After further study the Congregation for the Doctrine of the Faith withdrew that prohibition in 1978. Sister Faustina was beatified in 1993 and canonised on 30 April 2000, when Pope Saint John Paul II established that the Second Sunday of Easter would be called Divine Mercy Sunday throughout the Church. The Church's approval concerns the devotion and its doctrinal soundness — mercy as the greatest attribute of God, and trust as the vessel by which it is received; no one is bound to believe the revelations themselves.",
      visionaries: ["Saint Maria Faustina Kowalska"],
      messageHighlights: [
        "The image of the merciful Christ with the two rays and the words 'Jesus, I trust in You'.",
        "The Chaplet of Divine Mercy and the hour of mercy at three in the afternoon.",
        "The request for a Feast of Mercy on the Sunday after Easter, established for the universal Church in 2000.",
      ],
      officialDocumentUrl:
        "https://www.vatican.va/content/john-paul-ii/en/homilies/2000/documents/hf_jp-ii_hom_20000430_faustina.html",
      citations: [
        "https://www.vatican.va/content/john-paul-ii/en/homilies/2000/documents/hf_jp-ii_hom_20000430_faustina.html",
        "https://www.vatican.va/news_services/liturgy/documents/ns_lit_doc_20000430_notification-canonizzazione_en.html",
        "https://www.vatican.va/content/john-paul-ii/en/homilies/2001/documents/hf_jp-ii_hom_20010422_divina-misericordia.html",
      ],
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-holy-face-tours-marie-de-saint-pierre",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://en.wikipedia.org/wiki/Archconfraternity_of_the_Holy_Face",
      "https://www.catholicmom.com/articles/the-work-of-reparation-through-devotion-to-the-holy-face",
    ],
    payload: {
      slug: "apparition-holy-face-tours-marie-de-saint-pierre",
      title: "Revelations of the Holy Face to Sister Marie de Saint-Pierre",
      location: "Carmel of Tours",
      country: "France",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Leo XIII, who raised the Confraternity of the Holy Face at Tours to an archconfraternity",
      decisionYear: 1885,
      subject: "christ",
      yearOfApparition: 1843,
      summary:
        "From 1843 Sister Marie de Saint-Pierre, a Carmelite of Tours, reported interior communications of our Lord asking for reparation to his Holy Face for blasphemy and the profanation of Sunday. Out of this grew the Work of Reparation and the devotion to the Holy Face, spread from Tours by the layman Venerable Léon Papin-Dupont and approved by the Church in the form of a confraternity.",
      background:
        "The Church's approval here is of the devotion, not a judgement on the revelations: Archbishop Charles Colet erected the Confraternity of the Holy Face at Tours in 1876, and Pope Leo XIII raised it to an archconfraternity and approved the scapular of the Holy Face in 1885. Sister Marie de Saint-Pierre is Venerable; her cause has not gone further. Saint Thérèse of Lisieux, who took the name Thérèse of the Child Jesus and of the Holy Face, drew deeply on this devotion. The particular promises attached to the devotion in popular literature are not part of the Church's teaching and should not be repeated as though they were.",
      visionaries: ["Venerable Sister Marie de Saint-Pierre of the Holy Family"],
      messageHighlights: [
        "A call to reparation for blasphemy and for the profanation of the Lord's Day.",
        "The veneration of the Holy Face of Christ, disfigured in the Passion, as the image of a love outraged and still offered.",
      ],
      citations: [
        "https://en.wikipedia.org/wiki/Archconfraternity_of_the_Holy_Face",
        "https://www.catholicmom.com/articles/the-work-of-reparation-through-devotion-to-the-holy-face",
      ],
    },
  },
];
