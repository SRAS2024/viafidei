import type { CuratedEntry } from "../index";

/**
 * Group 2 of the curated apparition catalogue: twelve Marian apparitions on
 * which the Church has acted formally and positively.
 *
 * The rules of group 1 apply unchanged. `approvedStatus` records only what a
 * named authority decided, and `decisionAuthority` / `decisionYear` say who and
 * when:
 *
 * - `nihil_obstat` is used for the four cases decided under the May 2024 DDF
 *   Norms (Montichiari-Fontanelle, Santa Domenica di Placanica, Chandavila,
 *   Mount Zvir). A nihil obstat authorises public devotion and prudent
 *   adherence; it is never a declaration that the events were supernatural,
 *   and each entry says so, together with the cautions the Dicastery attached.
 * - `private_revelation` is used where the Church has approved and fostered the
 *   cult — a bishop's decree authorising worship at the site, a canonical
 *   coronation, a basilica, a patronage, a regional sanctuary — without a
 *   juridical judgement on the apparition itself. The background says exactly
 *   what was approved and by whom, and where a tradition has no contemporary
 *   documentation the entry says that too.
 *
 * Message highlights summarise neutrally what the cited pages report; no message
 * text is invented, and where nothing reliable is recorded the list is empty.
 * Summaries and backgrounds are editorial text written from the cited sources.
 * Approved private revelation binds no one in faith.
 */

const DDF_NORMS_2024 =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240517_norme-fenomeni-soprannaturali_en.html";

const DDF_ROSA_MYSTICA_LETTER =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240705_lettera-devozione-mariarosamistica_en.html";
const DDF_PLACANICA_LETTER =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240705_lettera-santuario-placanica_en.html";
const DDF_CHANDAVILA_LETTER =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240822_lettera-chandavila_en.html";
const DDF_LITMANOVA_LETTER =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20250704_lettera-esperienza-litmanova_en.html";

const MONTICHIARI_CITATIONS = [
  DDF_ROSA_MYSTICA_LETTER,
  "https://www.vaticannews.va/en/vatican-city/news/2024-07/dicastery-doctrine-faith-our-lady-rosa-mystica-approval-devotion.html",
  "https://www.oursundayvisitor.com/?p=94994",
  "https://rosamisticafontanelle.it/?p=13686",
  DDF_NORMS_2024,
];

const PLACANICA_CITATIONS = [
  DDF_PLACANICA_LETTER,
  "https://www.vaticannews.va/en/vatican-city/news/2024-07/dicastery-for-the-doctrine-of-the-faith-rules-on-sanctuary.html",
  "https://ewtnnews.com/vatican/vatican-approves-our-lady-of-the-rock-shrine-at-alleged-marian-apparition-site-in-italy",
  DDF_NORMS_2024,
];

const CHANDAVILA_CITATIONS = [
  DDF_CHANDAVILA_LETTER,
  "https://ewtnnews.com/vatican/vatican-approves-devotion-to-1945-apparition-of-our-lady-of-sorrows-in-spain",
  "https://thedialog.org/vatican-news/dicastery-for-the-doctrine-of-faith-describes-approved-devotion-at-site-of-marian-apparition-as-a-light-in-spain/",
  DDF_NORMS_2024,
];

const LITMANOVA_CITATIONS = [
  DDF_LITMANOVA_LETTER,
  "https://www.vaticannews.va/en/vatican-city/news/2025-07/ddf-vatican-nihil-obstat-marian-devotion-slovakia-mount-zvir.html",
  "https://www.ewtnnews.com/vatican/vatican-approves-marian-devotion-in-slovakia-but-doesn-t-recognize-apparitions",
  DDF_NORMS_2024,
];

const ILE_BOUCHARD_CITATIONS = [
  "https://dioceseparis.fr/dites-aux-petits-enfants-de-prier.html",
  "https://miraclehunter.com/marian_apparitions/approved_apparitions/lile_bouchard/index.html",
];

const QUERRIEN_CITATIONS = [
  "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/querrien/index.html",
  "https://en.wikipedia.org/wiki/Marian_apparitions_of_Querrien",
];

const CIMBRES_CITATIONS = [
  "https://www.ewtnnews.com/es/mundo/america/obispo-da-primer-paso-hacia-aprobacion-de-apariciones-de-la-virgen-a-dos-adolescentes",
  "https://www.diariodepernambuco.com.br/vida-urbana/2026/08/11720064-aparicao-de-nossa-senhora-das-gracas-em-cimbres-completa-90-anos-de-devocao.html",
  "https://en.wikipedia.org/wiki/Cimbres_Marian_apparition",
];

const MONTE_BERICO_CITATIONS = [
  "https://www.monteberico.it/?p=2677",
  "https://www.avvenire.it/chiesa/chiesa-italiana/la-rinascita-e-la-festa-per-i-600-anni-perche-la-madonna-di-monte-berico-e-cosi-importante-per-vicenza_104299",
];

const CARAVAGGIO_CITATIONS = [
  "https://www.diocesidicremona.it/verso-lanniversario-dellapparizione-a-caravaggio-il-calendario-dei-riti-il-rettore-don-mascaretti-al-servizio-della-misericordia-12-05-2016.html",
  "https://www.avvenire.it/chiesa/chiesa-italiana/caravaggio-proclamato-santuario-regionale-della-lombardia_67363",
  "https://www.miraclehunter.com/marian_apparitions/approved_apparitions/caravaggio/index.html",
];

const GUARDIA_CITATIONS = [
  "https://www.vatican.va/content/benedict-xvi/it/angelus/2008/documents/hf_ben-xvi_ang_20080518_genova.html",
  "https://www.museivaticani.va/content/museivaticani/it/patrimonio-naturale-archeologico/giardini/presentazione-giardini/madonna-guardia.html",
  "https://miraclehunter.com/marian_apparitions/approved_apparitions/laguria/index.html",
];

const MANAOAG_CITATIONS = [
  "https://manaoagminorbasilica.org/the-minor-basilica-of-manaoag",
  "https://www.ust.edu.ph/ust-celebrates-our-lady-of-manaoags-pontifical-canonical-crowning-centennial/",
];

const LA_VANG_CITATIONS = [
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=481",
  "https://www.mariedenazareth.com/en/marian-encyclopedia/mary-fills-the-world/main-marian-shrines/in-vietnam-our-lady-of-la-vang",
];

export const apparitionGroupTwo: CuratedEntry[] = [
  /* ---------------- Nihil obstat under the 2024 DDF Norms ---------------- */
  {
    contentType: "APPARITION",
    slug: "apparition-maria-rosa-mystica-montichiari-fontanelle",
    authorityLevel: "VATICAN",
    citations: MONTICHIARI_CITATIONS,
    payload: {
      slug: "apparition-maria-rosa-mystica-montichiari-fontanelle",
      title: "Apparitions Reported at Montichiari and Fontanelle (Maria Rosa Mystica)",
      location: "Montichiari and Fontanelle, Diocese of Brescia",
      country: "Italy",
      approvedStatus: "nihil_obstat",
      decisionAuthority:
        "Bishop Pierantonio Tremolada of Brescia, following the letter of the Dicastery for the Doctrine of the Faith of 5 July 2024, approved by Pope Francis",
      decisionYear: 2024,
      subject: "marian",
      yearOfApparition: 1947,
      feastDay: "07-13",
      summary:
        "Pierina Gilli (1911–1991), a nurse of Montichiari near Brescia, reported apparitions of the Blessed Virgin Mary at Montichiari in 1947 and at nearby Fontanelle in 1966, where a spring became a place of prayer; Mary is honoured there as Rosa Mystica, Mother of the Church. On 8 July 2024 Bishop Pierantonio Tremolada of Brescia granted a nihil obstat to the devotion, after the Dicastery for the Doctrine of the Faith found that the spiritual proposal arising from her experiences contains nothing contrary to the faith or morals of the Church.",
      background:
        "The nihil obstat, the most favourable of the conclusions provided by the 2024 Norms, does not declare the events supernatural: the faithful are authorised to give the devotion their prudent adherence but are not obliged to believe in it, and the bishop's decree applies to the Diocese of Brescia. Earlier bishops had not found sufficient grounds to pronounce on the supernatural character of the apparitions; in 2001 Bishop Giulio Sanguineti appointed a priest to oversee the devotion at Fontanelle, and in December 2019 Bishop Tremolada established there the diocesan Sanctuary of Rosa Mystica – Mother of the Church. In its letter the Dicastery praised the seer's humility and the Christ-centred character of the devotion, but asked that some of her expressions be read with care: Mary must never be imagined as a lightning rod holding back the justice of God, Christ alone is the Redeemer and the Lord alone gives grace, and Mary's part is that of a mother who intercedes. The sanctuary keeps its feast on 13 July.",
      visionaries: ["Pierina Gilli"],
      messageHighlights: [
        "Mary presented as Rosa Mystica and Mother of the Church — a title the Dicastery valued as a safeguard against a merely individual devotion.",
        "The three roses on the Virgin's breast, explained in Pierina Gilli's writings as prayer, sacrifice and penance; the Dicastery cautioned that they are not to be offered as a programme for all believers, since the heart of the Gospel is charity.",
      ],
      officialDocumentUrl: DDF_ROSA_MYSTICA_LETTER,
      citations: MONTICHIARI_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-the-rock-placanica",
    authorityLevel: "VATICAN",
    citations: PLACANICA_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-the-rock-placanica",
      title: "Apparitions Reported at Santa Domenica di Placanica (Our Lady of the Rock)",
      location: "Santa Domenica di Placanica, Diocese of Locri-Gerace",
      country: "Italy",
      approvedStatus: "nihil_obstat",
      decisionAuthority:
        "Bishop Francesco Oliva of Locri-Gerace, whose proposed nihil obstat the Dicastery for the Doctrine of the Faith confirmed on 5 July 2024 with the approval of Pope Francis",
      decisionYear: 2024,
      subject: "marian",
      yearOfApparition: 1968,
      summary:
        "On 11 May 1968 Cosimo Fragomeni, then an eighteen-year-old farmer of the Calabrian village of Santa Domenica di Placanica, reported that the Blessed Virgin appeared to him beside a sandstone rock near his home, and the experience was repeated over the following days. The place is now the diocesan Sanctuary of the Madonna dello Scoglio, Our Lady of the Rock, and on 5 July 2024 the Dicastery for the Doctrine of the Faith confirmed the nihil obstat proposed by the Bishop of Locri-Gerace for the spiritual experience connected with it.",
      background:
        "The Dicastery made no judgement on whether the events were supernatural and asked that the bishop's decree say so: the nihil obstat recognises the spiritual fruits of the place and permits the faithful to adhere to it prudently, without obliging anyone to believe. The bishop had reported a spirit of prayer, conversions, some vocations to the priesthood and religious life and works of charity, and no critical or risky elements over the years. The Dicastery added that the decision implies no judgement on the lives of the persons involved, that any further messages are to be made known only after the bishop's discernment, and that devotion at the shrine must avoid improper forms or titles and keep a clear Christological focus. Cosimo Fragomeni became a Franciscan tertiary in 1987; the site was placed under the pastoral care of the diocesan bishop in 2008 and erected as a diocesan sanctuary on 11 February 2016, and it is known locally as the little Lourdes of Calabria.",
      visionaries: ["Cosimo Fragomeni"],
      messageHighlights: [],
      officialDocumentUrl: DDF_PLACANICA_LETTER,
      citations: PLACANICA_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-sorrows-chandavila",
    authorityLevel: "VATICAN",
    citations: CHANDAVILA_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-sorrows-chandavila",
      title: "Apparitions Reported at Chandavila (Our Lady of Sorrows)",
      location: "Chandavila, La Codosera, Archdiocese of Mérida-Badajoz",
      country: "Spain",
      approvedStatus: "nihil_obstat",
      decisionAuthority:
        "Archbishop José Rodríguez Carballo of Mérida-Badajoz, with the consent of the Dicastery for the Doctrine of the Faith in the letter 'A light in Spain', approved by Pope Francis on 22 August 2024",
      decisionYear: 2024,
      subject: "marian",
      yearOfApparition: 1945,
      summary:
        "In the summer of 1945, at Chandavila near La Codosera on the border between Spain and Portugal, two girls of the district, Marcelina Barroso Expósito and Afra Brígido Blanco, separately reported visions of the Virgin of Sorrows, whom Marcelina described in a black mantle full of stars above a chestnut tree. A shrine of Our Lady of Sorrows grew up at the place, and on 22 August 2024 the Dicastery for the Doctrine of the Faith gave its consent for the Archbishop of Mérida-Badajoz to declare a nihil obstat for the devotion.",
      background:
        "The Dicastery's letter, entitled 'A light in Spain', speaks of alleged visions and does not declare them supernatural; it finds nothing to object to in the devotion and sees signs of the action of the Holy Spirit in its fruits — conversions, healings and the pilgrims who come from both Spain and Portugal. It notes that the two seers afterwards led discreet lives given to the care of the sick, the elderly and orphans, and that the previous archbishop had welcomed the jubilee of the seventy-fifth anniversary as a blessing for the archdiocese. The archbishop had asked for the nihil obstat in a letter of 28 July 2024, and the Dicastery expressed the hope that the shrine would remain a place of interior peace, consolation and conversion. As with every nihil obstat, the faithful may give the devotion their prudent adherence, and no one is bound to believe the visions.",
      visionaries: ["Marcelina Barroso Expósito", "Afra Brígido Blanco"],
      messageHighlights: [
        "The Dicastery reads the experience as a message of consolation, trust and charity under the sign of the Sorrowful Mother.",
      ],
      associatedMarianTitleSlug: "our-lady-of-sorrows",
      officialDocumentUrl: DDF_CHANDAVILA_LETTER,
      citations: CHANDAVILA_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-mount-zvir-litmanova",
    authorityLevel: "VATICAN",
    citations: LITMANOVA_CITATIONS,
    payload: {
      slug: "apparition-mount-zvir-litmanova",
      title: "Apparitions Reported on Mount Zvir at Litmanová (the Immaculate Purity)",
      location: "Mount Zvir, Litmanová, Archeparchy of Prešov",
      country: "Slovakia",
      approvedStatus: "nihil_obstat",
      decisionAuthority:
        "Archbishop Jonáš Jozef Maxim of Prešov for Catholics of the Byzantine rite, with the consent of the Dicastery for the Doctrine of the Faith in the letter 'Let Jesus set you free'",
      decisionYear: 2025,
      subject: "marian",
      yearOfApparition: 1990,
      summary:
        "Between 1990 and 1995 three children of the Byzantine Catholic village of Litmanová in northern Slovakia — Ivetka Korčáková, Katka Česelková and Mitko Česelka, then aged eleven, twelve and nine — reported apparitions of the Blessed Virgin Mary on Mount Zvir, beginning on 5 August 1990; Mary is venerated there as the Immaculate Purity. On 4 July 2025 the Dicastery for the Doctrine of the Faith accepted the proposal of the Archbishop of Prešov to declare a nihil obstat for the Marian devotion that arose on the mountain.",
      background:
        "The Dicastery states that the nihil obstat does not recognise the supernatural authenticity of the alleged apparitions, though it permits public devotion and assures the faithful that they may approach this spiritual proposal without risk. It points to sincere confessions, conversions and a growing stream of pilgrims, and to the messages' repeated invitations to conversion, inner freedom, joy, simplicity, peace and love of neighbour. It also judges a few messages unacceptable as worded — one that could be read as saying that almost all the people of one part of the world are condemned, and one that makes sin the cause of every illness — and, since the seers described the communication as interior, treats the wording as their own limited rendering of the experience. The archbishop was asked to publish a collection of the messages leaving out the statements that could confuse or disturb the faith of simple people.",
      visionaries: ["Ivetka Korčáková", "Katka Česelková", "Mitko Česelka"],
      messageHighlights: [
        "Repeated invitations to conversion, inner freedom, joy, simplicity and peace, gathered up in the call to let Jesus set one free.",
      ],
      officialDocumentUrl: DDF_LITMANOVA_LETTER,
      citations: LITMANOVA_CITATIONS,
    },
  },

  /* ---------- Cult authorised by the bishop after examining the events --------- */
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-prayer-ile-bouchard",
    authorityLevel: "DIOCESAN",
    citations: ILE_BOUCHARD_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-prayer-ile-bouchard",
      title: "Apparitions Reported at L'Île-Bouchard (Our Lady of Prayer)",
      location: "Church of Saint-Gilles, L'Île-Bouchard, Archdiocese of Tours",
      country: "France",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Archbishop André Vingt-Trois of Tours, by the decree authorising pilgrimages and the public worship of Our Lady of Prayer in the church of Saint-Gilles",
      decisionYear: 2001,
      subject: "marian",
      yearOfApparition: 1947,
      summary:
        "From 8 to 14 December 1947, in a France shaken by strikes and social unrest, four girls of L'Île-Bouchard in Touraine — Jacqueline Aubry, her sister Jeannette, their cousin Nicole Robin and Laura Croizon — reported seeing the Blessed Virgin, with an angel kneeling beside her, in their parish church of Saint-Gilles, asking the children to pray for France. On 8 December 2001 Archbishop André Vingt-Trois of Tours authorised pilgrimages and public worship of Our Lady of Prayer in the church, without pronouncing on the apparitions themselves.",
      background:
        "The decree of 2001 approves the devotion — pilgrimages and the public cult celebrated in the church of Saint-Gilles to invoke Our Lady of Prayer — and makes no judgement on the supernatural character of the events; earlier archbishops of Tours had already allowed Mary to be invoked there under that title. The children described a lady in white with a rosary, who asked for the Hail Mary to be prayed and sung and for a grotto to be made in the church; a grotto with statues of the Virgin and the angel Gabriel now stands there. The sanctuary is entrusted to the Emmanuel Community, and Jacqueline Aubry, the eldest of the four, died in 2016. As with every approved private revelation, no Catholic is bound to believe the apparitions.",
      visionaries: ["Jacqueline Aubry", "Jeannette Aubry", "Nicole Robin", "Laura Croizon"],
      messageHighlights: [
        "A call for children to pray for France in her great need.",
        "A request for the Hail Mary to be prayed and sung, and for a grotto to be made in the church.",
      ],
      citations: ILE_BOUCHARD_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-all-help-querrien",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: QUERRIEN_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-all-help-querrien",
      title: "Apparition of Our Lady of All Help at Querrien",
      location: "Querrien, La Prénessaye, Diocese of Saint-Brieuc and Tréguier",
      country: "France",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Bishop Denis de La Barde of Saint-Brieuc, who examined the seer and witnesses under oath and authorised a chapel and public worship",
      decisionYear: 1652,
      subject: "marian",
      yearOfApparition: 1652,
      summary:
        "On 15 August 1652 Jeanne Courtel, a shepherd girl of about eleven from the hamlet of Querrien in Brittany who had been deaf and mute from birth, reported that the Blessed Virgin appeared to her in the fields, spoke with her and asked for a chapel to be built in the village; Jeanne is remembered to have recovered her hearing and speech. An old wooden statue of the Virgin and Child was dug up near a spring where the Lady had indicated, and the shrine of Notre-Dame de Toute-Aide, Our Lady of All Help, grew from it.",
      background:
        "Bishop Denis de La Barde of Saint-Brieuc had the events examined: in September 1652 he went to Querrien, questioned Jeanne and the witnesses under oath, and then decided that a chapel should be built and worship organised there. The foundation stone was blessed that autumn, the chapel was finished in 1656, and the bishop endowed perpetual chaplaincies for it. Historians differ on how far his decision amounted to a formal recognition of the apparition, since the episcopal documents speak of the cult rather than of the vision, and it is the devotion that the Church has gone on confirming: the statue was canonically crowned on 14 August 1950 before a great crowd of pilgrims. Jeanne Courtel married, raised a family and died in 1703; she is buried in the chapel. The principal pilgrimage is held on 15 August.",
      visionaries: ["Jeanne Courtel"],
      messageHighlights: [
        "A request that a chapel be built in the village, where pilgrims could come to pray.",
      ],
      citations: QUERRIEN_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-grace-cimbres",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: CIMBRES_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-grace-cimbres",
      title: "Apparitions Reported at Cimbres (Our Lady of Grace)",
      location: "Aldeia Guarda, Cimbres, Diocese of Pesqueira",
      country: "Brazil",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Bishop José Luiz Ferreira Salles of Pesqueira, by a pastoral letter permitting the devotion",
      decisionYear: 2021,
      subject: "marian",
      yearOfApparition: 1936,
      summary:
        "From 6 August 1936, on a rocky hillside at the Sítio Guarda near Cimbres in the backlands of Pernambuco, two poor teenage girls, Maria da Luz and Maria da Conceição, reported apparitions of the Blessed Virgin, who called herself Grace and urged prayer and penance, and the seers were shown water flowing from the rock for the healing of the sick. In a pastoral letter of October 2021 Bishop José Luiz Ferreira Salles of Pesqueira permitted the faithful to continue their devotion to Our Lady of Grace there, without declaring the apparitions supernatural.",
      background:
        "Bishop Adalberto Accioli Sobral of Pesqueira had the events examined at the time by priests including the German missionary Fr. José Kehrle, and in 1998 Bishop Manoel Palmeira da Rocha decreed the site a sanctuary of Our Lady of Grace. The 2021 pastoral letter found the messages consistent with the Christian faith and spoke of a great probability that the experience was supernatural, but stopped short of a declaration; it placed the pastoral care of pilgrims at Aldeia Guarda in the hands of the diocese and asked that the cause of beatification of Maria da Luz, who became Sister Adélia of the Religious of Christian Instruction, be opened. Accounts that describe the letter as a full recognition of the apparitions overstate it. The reported messages, which include warnings of chastisement, belong to a private revelation that binds no one in faith.",
      visionaries: [
        "Maria da Luz Teixeira de Carvalho (later Sister Adélia)",
        "Maria da Conceição",
      ],
      messageHighlights: [
        "A call to prayer and penance.",
        "Water from the rock, which the seers were told was for the healing of the sick.",
      ],
      citations: CIMBRES_CITATIONS,
    },
  },

  /* ------------- Ancient apparitions whose cult the Church has confirmed ------------- */
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-monte-berico",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: MONTE_BERICO_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-monte-berico",
      title: "Apparitions of Our Lady of Monte Berico",
      location: "Monte Berico, Vicenza, Diocese of Vicenza",
      country: "Italy",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Saint Paul VI, who declared Our Lady of Monte Berico patroness of the city and Diocese of Vicenza",
      decisionYear: 1978,
      subject: "marian",
      yearOfApparition: 1426,
      summary:
        "On 7 March 1426, while plague had ravaged Vicenza for years, the Blessed Virgin is remembered to have appeared to Vincenza Pasini, an elderly peasant woman, on the hill of Berico above the city, asking that a church be built there in her honour; she appeared to her again on 1 August 1428. Bishop Pietro Emiliani of Vicenza laid the first stone on 25 August 1428, and the sanctuary of Santa Maria di Monte Berico, in the care of the Servants of Mary since 1435, has been the heart of the city's devotion ever since.",
      background:
        "Vincenza's account was set down in a formal record, the Processus of 1430, which names the Virgin as the fount of mercies who has compassion on human misfortune, and tradition holds that the plague ended as the building began. A first chapel was raised within months, Palladio enlarged the church in 1578 after a vow of the city, and the present Baroque sanctuary replaced his building from 1688. Mary is venerated at Monte Berico as Mother of Mercy, sheltering the city beneath her mantle, and in 1978 Pope Paul VI made her patroness of the city and Diocese of Vicenza. Pilgrims climb the hill before dawn on 8 September, the Nativity of Mary, and the sixth centenary of the first apparition was opened as a Marian jubilee year in February 2026.",
      visionaries: ["Vincenza Pasini"],
      messageHighlights: [
        "A request that the city build a church in Mary's honour on the hill of the apparitions.",
      ],
      citations: MONTE_BERICO_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-caravaggio",
    authorityLevel: "DIOCESAN",
    citations: CARAVAGGIO_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-caravaggio",
      title: "Apparition of Our Lady at Caravaggio (Santa Maria del Fonte)",
      location: "Caravaggio, Diocese of Cremona",
      country: "Italy",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "The bishops of Lombardy, at whose gathering in Caravaggio Santa Maria del Fonte was proclaimed the regional sanctuary of Lombardy",
      decisionYear: 2023,
      subject: "marian",
      yearOfApparition: 1432,
      feastDay: "05-26",
      summary:
        "Towards five in the evening of 26 May 1432, Giannetta de' Vacchi, a devout countrywoman of thirty-two married to Francesco Varoli, was cutting grass outside Caravaggio on the road to Misano when the Blessed Virgin appeared to her, told her not to be afraid, and asked for penance: fasting on bread and water on Fridays in honour of her Son, and honouring Mary on Saturdays from the hour of Vespers. A spring that no one had seen before was found at the spot, and the great sanctuary of Santa Maria del Fonte now stands over it.",
      background:
        "In Giannetta's account Mary said she had pleaded with her Son for seven years to spare a sinful world, and promised signs to confirm the message; many of the sick who came to the spring reported healings. In the same year the vicar of the Bishop of Cremona wanted a votive chapel built on the site, and from 1575, with the strong support of Saint Charles Borromeo, the present sanctuary was raised to a design by Pellegrino Tibaldi, its building continuing in stages into the eighteenth century. The Diocese of Cremona, to which Caravaggio belongs, keeps the anniversary of the apparition each 26 May. In May 2020, during the pandemic, Italy was entrusted to Mary at Caravaggio, and on 25 May 2023 Santa Maria del Fonte was proclaimed the regional sanctuary of Lombardy. These acts concern the cult and the sanctuary; they are not a juridical judgement on the apparition itself.",
      visionaries: ["Giannetta de' Vacchi"],
      messageHighlights: [
        "A call to penance: fasting on bread and water on Fridays in honour of her Son, and honouring Mary on Saturdays from the hour of Vespers.",
        "Mary's assurance that she had long pleaded with her Son for mercy on the world, and her promise of signs to confirm the message.",
      ],
      citations: CARAVAGGIO_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-the-guard-monte-figogna",
    authorityLevel: "VATICAN",
    citations: GUARDIA_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-the-guard-monte-figogna",
      title: "Apparition of Our Lady of the Guard on Monte Figogna",
      location: "Monte Figogna, Ceranesi, Archdiocese of Genoa",
      country: "Italy",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Benedict XV, who granted the sanctuary of Nostra Signora della Guardia the title of basilica",
      decisionYear: 1915,
      subject: "marian",
      yearOfApparition: 1490,
      summary:
        "Genoese tradition holds that on 29 August 1490 the Blessed Virgin appeared to Benedetto Pareto, a countryman working on Monte Figogna above Genoa, and asked him to build a chapel on the summit. He hesitated, being poor; after he was badly hurt in a fall she appeared to him again and he was healed, and he built the first chapel himself. The sanctuary of Nostra Signora della Guardia, Our Lady of the Guard, that grew from it keeps watch over the city and its port.",
      background:
        "Speaking at Genoa in 2008, Pope Benedict XVI recalled the tradition that Mary encouraged the hesitant Pareto to trust in her and to hold firm to his resolve. The chapel was enlarged again and again for the growing pilgrimage, and the present sanctuary was inaugurated on 26 May 1890. Pope Benedict XV, a Genoese, was a frequent pilgrim there and granted it the title of basilica in 1915; in 1917 his native city gave him a reproduction of the shrine and its image, which still stands in the Vatican Gardens and where he is said to have prayed each morning. Pope Saint John Paul II visited the sanctuary in 1985. These acts honour the cult and the sanctuary; the apparition itself is handed down as the tradition of Genoa.",
      visionaries: ["Benedetto Pareto"],
      messageHighlights: [
        "A request for a chapel on the mountain, and the encouragement to trust in her that Benedict XVI recalled at Genoa in 2008.",
      ],
      citations: GUARDIA_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-manaoag",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: MANAOAG_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-manaoag",
      title: "Apparition of Our Lady of Manaoag",
      location: "Manaoag, Pangasinan, Archdiocese of Lingayen-Dagupan",
      country: "Philippines",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Pius XI, by whose authority the image of Our Lady of the Rosary of Manaoag was canonically crowned",
      decisionYear: 1926,
      subject: "marian",
      summary:
        "According to the tradition of Pangasinan, the Blessed Virgin appeared to a farmer on a treetop on the hill where the church of Manaoag now stands and asked that a shrine be built there; the town is said to take its name from the people's account of the Virgin who calls. The Dominicans, who have cared for the place since the early seventeenth century, enshrined there an image of Our Lady of the Most Holy Rosary, and Manaoag has become one of the great Marian shrines of the Philippines.",
      background:
        "The image is believed to have been brought from Spain by way of Mexico by the Dominican Fr. Juan de San Jacinto, who planned a chapel dedicated to Our Lady of the Rosary, and the shrine has remained in the care of the Order of Preachers. The Church's approval has been given to the cult: the image was canonically crowned in April 1926 by the Apostolic Delegate, Archbishop Guglielmo Piani, acting for Pope Pius XI; in 2011 the shrine received a bond of spiritual affinity with the Basilica of Saint Mary Major in Rome; and in 2015 it was proclaimed a minor basilica. The centenary of the coronation was celebrated in April 2026. The apparition itself survives as the oral tradition of the town.",
      visionaries: ["a farmer of the district, according to tradition"],
      messageHighlights: ["A request that a shrine be built on the spot."],
      associatedMarianTitleSlug: "our-lady-of-manaoag",
      citations: MANAOAG_CITATIONS,
    },
  },
  {
    contentType: "APPARITION",
    slug: "apparition-our-lady-of-la-vang",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: LA_VANG_CITATIONS,
    payload: {
      slug: "apparition-our-lady-of-la-vang",
      title: "Apparitions of Our Lady of La Vang",
      location: "La Vang, Quảng Trị, Archdiocese of Huế",
      country: "Vietnam",
      approvedStatus: "private_revelation",
      decisionAuthority:
        "Pope Saint John XXIII, who raised the church of La Vang to the dignity of a minor basilica after the bishops of Vietnam recognised it as the national Marian centre",
      decisionYear: 1961,
      subject: "marian",
      yearOfApparition: 1798,
      summary:
        "In 1798, when a persecution drove the Catholics of central Vietnam into the forest of La Vang in Quảng Trị, the refugees who gathered under a great tree to pray the Rosary are remembered to have seen the Blessed Virgin holding the Child, with two angels, who consoled them and promised that their prayers would be heard. La Vang became the national Marian shrine of Vietnam and the goal of its great pilgrimages.",
      background:
        "As L'Osservatore Romano noted at the bicentenary, there is no written documentation of the apparitions: the archives of the Church of Huế that might have recorded them were destroyed in the nineteenth century, and the account has come down as the living tradition of the Vietnamese Church. Successive chapels were built at the place, national pilgrimages began in 1901, and in 1928 La Vang became a parish. On 8 August 1961 the bishops of South Vietnam recognised it as the national Marian centre, and on 22 August 1961 Pope John XXIII raised its church to the dignity of a minor basilica; the bishops of the whole country renewed the recognition in 1980. The basilica was destroyed in the fighting of 1972. Pope John Paul II recalled La Vang on the day of the canonisation of the Vietnamese martyrs in 1988, hoping it would become a sign of renewal and reconciliation, and sent a special envoy for the bicentenary in 1998. What the Church has approved is the shrine and its devotion; the Holy See has not pronounced on the apparitions themselves.",
      visionaries: ["Catholics sheltering in the forest of La Vang during the persecution of 1798"],
      messageHighlights: [
        "Mary's assurance to the persecuted that their prayers would be heard, with a promise of protection.",
      ],
      associatedMarianTitleSlug: "our-lady-of-la-vang",
      citations: LA_VANG_CITATIONS,
    },
  },
];
