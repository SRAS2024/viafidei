import type { CuratedEntry } from "../index";

/**
 * Marian titles, group 1: the title Mother of the Church, the great national
 * and shrine titles of the Americas, Asia, Africa and Europe, four invocations
 * of the Litany of Loreto, and the title Mediatrix of All Graces.
 *
 * Two rules govern everything below.
 *
 * First, a title is not an apparition. Where a shrine grew out of events the
 * Church has judged, the judgement is reported as the Church made it and no
 * further; where devotion rests on an account handed down among the faithful
 * that the Holy See has never ruled on — La Vang is the clearest case — the
 * entry says so in those words. No entry sets `associatedApparitionSlug`
 * unless the corresponding apparition is already curated.
 *
 * Second, no feast day is invented. Many of these titles are kept on a movable
 * day (the Monday after Pentecost for Mother of the Church, the third Saturday
 * of September at Naga) or have no feast at all, and in those cases the
 * `feastDay` field is simply absent rather than filled with a plausible date.
 * Dogmas are distinguished from devotion throughout: none of these titles has
 * been defined as a dogma, so `dogmaDefinedYear` appears nowhere in this file —
 * least of all on Mediatrix of All Graces, which Lumen Gentium 62 records as a
 * title under which Mary is invoked, carefully qualified, and which the Church
 * has never defined.
 */

// Holy See
const LUMEN_GENTIUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html";
const NOSTRA_AETATE =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_nostra-aetate_en.html";
const MARIALIS_CULTUS =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus.html";
const REDEMPTORIS_MATER =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_25031987_redemptoris-mater.html";
const ROSARIUM_VIRGINIS_MARIAE =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";
const AD_CAELI_REGINAM =
  "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_11101954_ad-caeli-reginam.html";
const SPE_SALVI =
  "https://www.vatican.va/content/benedict-xvi/en/encyclicals/documents/hf_ben-xvi_enc_20071130_spe-salvi.html";
const DIRECTORY_POPULAR_PIETY =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const LITANY_OF_LORETO =
  "https://www.vatican.va/special/rosary/documents/litanie-lauretane_en.html";
const ECCLESIA_IN_AMERICA =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_22011999_ecclesia-in-america.html";
const ECCLESIA_IN_ASIA =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_06111999_ecclesia-in-asia.html";
const ECCLESIA_IN_AFRICA =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_14091995_ecclesia-in-africa.html";
const ECCLESIA_IN_EUROPA =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_20030628_ecclesia-in-europa.html";
const LETTER_TO_CHINESE_CATHOLICS =
  "https://www.vatican.va/content/benedict-xvi/en/letters/2007/documents/hf_ben-xvi_let_20070527_china.html";

// USCCB
const USCCB_LITURGICAL_CALENDAR =
  "https://www.usccb.org/committees/divine-worship/liturgical-calendar";
const USCCB_PRAYERS_AND_DEVOTIONS =
  "https://www.usccb.org/prayer-and-worship/prayers-and-devotions";
const USCCB_ROSARIES = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/rosaries";

interface TitleInput {
  slug: string;
  title: string;
  summary: string;
  origin: string;
  theologicalSignificance: string;
  citations: string[];
  feastDay?: string;
  region?: string;
  associatedPrayers?: string[];
  iconographyNotes?: string;
  aliases?: string[];
}

function marianTitle(input: TitleInput): CuratedEntry {
  const {
    slug,
    title,
    summary,
    origin,
    theologicalSignificance,
    citations,
    feastDay,
    region,
    associatedPrayers = [],
    iconographyNotes,
    aliases = [],
  } = input;
  return {
    contentType: "MARIAN_TITLE",
    slug,
    authorityLevel: "VATICAN",
    citations,
    payload: {
      slug,
      title,
      summary,
      origin,
      ...(feastDay ? { feastDay } : {}),
      ...(region ? { region } : {}),
      associatedPrayers,
      ...(iconographyNotes ? { iconographyNotes } : {}),
      aliases,
      theologicalSignificance,
      citations,
    },
  };
}

export const marianTitleGroupOne: CuratedEntry[] = [
  /* ------------------------- Universal titles ------------------------- */
  marianTitle({
    slug: "mother-of-the-church",
    title: "Mother of the Church (Mater Ecclesiae)",
    summary:
      "Mary is honoured as Mother of the Church because the mother of Christ the Head is also mother of his Body: she was given to the disciple at the foot of the Cross and prayed with the apostles as the Church was born at Pentecost.",
    origin:
      "The substance of the title is patristic and medieval, and it was solemnly given to Mary by Pope St. Paul VI on 21 November 1964, at the close of the third session of the Second Vatican Council, on the day he promulgated the Dogmatic Constitution Lumen Gentium with its eighth chapter on the Blessed Virgin in the mystery of Christ and the Church. The invocation Mater Ecclesiae was afterwards added to the Litany of Loreto, and in 2018 the memorial of the Blessed Virgin Mary, Mother of the Church, was inscribed in the General Roman Calendar, to be kept each year on the Monday after Pentecost — a movable day, so no fixed date is given here.",
    region: "Universal Church",
    associatedPrayers: ["sub-tuum-praesidium", "litany-of-the-blessed-virgin-mary", "salve-regina"],
    iconographyNotes:
      "Two scenes carry the title. The first is John 19:25-27, Mary and the beloved disciple standing beneath the Cross as Jesus gives them to each other. The second is Pentecost, Mary seated among the apostles in the Upper Room with the tongues of fire descending. A large mosaic of Mater Ecclesiae looks down on St. Peter's Square from the Apostolic Palace, keeping the title before the pilgrims who gather there.",
    aliases: ["Mater Ecclesiae", "Mother of the Church"],
    theologicalSignificance:
      "Lumen Gentium teaches that Mary's motherhood in the order of grace did not end at Nazareth or Calvary but continues until the eternal fulfilment of all the elect. Because the Church is the Body of Christ, the mother of the Head is truly mother of the members. The title therefore says something about the Church as much as about Mary: the Church is born of the same consent and the same Cross, and she learns from Mary what it is to receive the Word in faith and bear Christ into the world.",
    citations: [LUMEN_GENTIUM, MARIALIS_CULTUS, LITANY_OF_LORETO, USCCB_LITURGICAL_CALENDAR],
  }),
  marianTitle({
    slug: "mediatrix-of-all-graces",
    title: "Mediatrix of All Graces",
    summary:
      "A title of devotion, not a defined dogma: Mary is invoked as Mediatrix because her maternal intercession is wholly at the service of the one mediation of Christ, from which it draws all its power.",
    origin:
      "The language of Mary's mediation grew out of the Fathers' reading of her consent at the Annunciation and her presence at Calvary, and was carried into medieval and modern devotion, especially by the great Marian preachers and by movements that petitioned for a dogmatic definition in the early twentieth century. The Second Vatican Council did not define such a dogma. Lumen Gentium 62 records instead that the Blessed Virgin is invoked in the Church under the titles of Advocate, Helper, Benefactress and Mediatrix, and adds at once that this is to be understood so that it neither takes away from nor adds anything to the dignity and efficacy of Christ the one Mediator. The Church has never defined Mary as Mediatrix of all graces, and this entry does not treat the title as defined.",
    region: "Universal Church",
    associatedPrayers: ["memorare", "sub-tuum-praesidium", "litany-of-the-blessed-virgin-mary"],
    aliases: ["Mediatrix", "Mary Mediatrix"],
    theologicalSignificance:
      "Scripture is unambiguous that there is one mediator between God and men, the man Christ Jesus (1 Timothy 2:5). Whatever is said of Mary's mediation is said within that one mediation and never beside it: as Lumen Gentium puts it, her saving influence flows from the superabundance of Christ's merits, rests on his mediation, depends entirely on it and draws all its power from it. Understood this way the title guards a real truth — that God freely wills to give his gifts through the communion of the saints and above all through the Mother he chose — while the Council's qualification guards against any suggestion that grace must be prised from Christ through her.",
    citations: [LUMEN_GENTIUM, MARIALIS_CULTUS, REDEMPTORIS_MATER],
  }),

  /* --------------------- Litany of Loreto invocations --------------------- */
  marianTitle({
    slug: "our-lady-refuge-of-sinners",
    title: "Our Lady, Refuge of Sinners (Refugium Peccatorum)",
    summary:
      "The invocation asks the sinless Mother to be a shelter for sinners — not a hiding place from her Son's judgement, but the place where sinners are brought back to his mercy.",
    origin:
      "Refugium peccatorum is one of the petitions of the Litany of Loreto, the Marian litany of the Holy House of Loreto that the Holy See approved for public use in the sixteenth century and that the Church still prays in the form published on the Vatican's own rosary pages. The invocation was carried into ordinary Catholic speech by centuries of preaching and by devotional classics on Mary's mercy, and it stands behind the closing petitions of the Hail Mary and the Memorare.",
    region: "Universal Church",
    associatedPrayers: [
      "litany-of-the-blessed-virgin-mary",
      "memorare",
      "salve-regina",
      "sub-tuum-praesidium",
    ],
    iconographyNotes:
      "The usual image is the Virgin of Mercy: Mary standing with her mantle held wide by angels while people of every rank kneel beneath it. The gesture is the same one the third-century prayer Sub tuum praesidium already makes — fleeing under her protection.",
    aliases: ["Refugium Peccatorum", "Refuge of Sinners"],
    theologicalSignificance:
      "The title says nothing about Mary that is not first about Christ: she is a refuge because she leads to him, and the sinner who takes shelter with her is being led to confession, to penance and to the Cross where mercy was won. It also expresses the Church's confidence that holiness is not repelled by sin. The one preserved from all sin is precisely the one most willing to receive sinners, because her whole existence is ordered to the Redeemer who came to call them.",
    citations: [LITANY_OF_LORETO, LUMEN_GENTIUM, MARIALIS_CULTUS],
  }),
  marianTitle({
    slug: "mystical-rose",
    title: "Mystical Rose (Rosa Mystica)",
    summary:
      "An invocation of the Litany of Loreto that praises Mary under the image of the rose: the flower of the enclosed garden, beautiful, fragrant and, in the medieval reading, without thorns.",
    origin:
      "Rosa mystica belongs to the Litany of Loreto as the Church prays it, and its roots lie in the medieval hymns and sermons that read the Song of Songs of Mary — the garden enclosed, the flower of the field — and in the tradition that called the thorns of the rose an image of sin from which she alone was preserved. The same imagery gave the Rosary its name, the rosarium or rose garden of prayers offered to her. The title is sometimes attached in popular usage to private claims the Church has not approved; this entry follows only the Litany's own use of it.",
    region: "Universal Church",
    associatedPrayers: ["litany-of-the-blessed-virgin-mary", "hail-mary", "salve-regina"],
    iconographyNotes:
      "Roses in Marian art are a standing sign of this invocation: a rose held in the Child's hand or Mary's, a crown or garland of roses, the hortus conclusus of a walled rose garden, and the rose windows that light medieval churches dedicated to Our Lady.",
    aliases: ["Rosa Mystica", "Mystic Rose"],
    theologicalSignificance:
      "This is a title of praise rather than a distinct doctrine, and Marialis Cultus asks that such poetic titles be read for what they teach. What the rose teaches is her holiness: a beauty that is entirely God's gift and entirely fruitful, since the flower exists for the fruit. The invocation belongs with the Immaculate Conception on one side and with the Church's own vocation to be holy and without blemish on the other.",
    citations: [LITANY_OF_LORETO, MARIALIS_CULTUS, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "gate-of-heaven",
    title: "Gate of Heaven (Ianua Caeli)",
    summary:
      "Mary is invoked as the gate of heaven because heaven's King entered the world through her, and because her intercession opens the way for the pilgrim Church that follows him.",
    origin:
      "Ianua caeli is an invocation of the Litany of Loreto. Its language comes from the Church's oldest Marian hymnody — the Ave maris stella calls her felix caeli porta, the happy gate of heaven, and the antiphon Alma Redemptoris Mater greets her as the gate by which heaven is entered — and behind that from the Fathers' reading of the closed gate of Ezekiel 44:2, through which the Lord alone passes, as a figure of her virginity.",
    region: "Universal Church",
    associatedPrayers: [
      "litany-of-the-blessed-virgin-mary",
      "salve-regina",
      "sub-tuum-praesidium",
      "hail-mary",
    ],
    iconographyNotes:
      "Medieval and Renaissance art gives the title an architectural form: Mary framed within a doorway or archway, the Virgin of the enclosed garden with its gate, and the great Marian portals of cathedrals through which the faithful literally walk to enter the church.",
    aliases: ["Ianua Caeli", "Janua Caeli", "Gate of Heaven"],
    theologicalSignificance:
      "Christ says of himself, I am the door (John 10:9), and the title never competes with that. Mary is a gate in a derived sense: the way by which the Word came to us in the flesh, and the mother whose prayer accompanies the Church on its way back to him. Read this way the invocation is a compact statement of the Incarnation — God really entered our history through a particular woman's consent — and of Christian hope, that the road he opened is open still.",
    citations: [LITANY_OF_LORETO, LUMEN_GENTIUM, MARIALIS_CULTUS],
  }),
  marianTitle({
    slug: "morning-star",
    title: "Morning Star (Stella Matutina)",
    summary:
      "The morning star rises before the sun and announces it; Mary is invoked under that name because her appearing in the history of salvation announces Christ, the true light of the world.",
    origin:
      "Stella matutina is an invocation of the Litany of Loreto, drawn from the scriptural praise of light — the woman fair as the moon and bright as the sun of the Song of Songs, and the morning star of the Wisdom books — and developed by medieval preachers who called Mary the dawn that comes before the Sun of Justice. Benedict XVI took up the same imagery at the end of the encyclical Spe Salvi, addressing Mary as a star of hope for those who travel in the dark.",
    region: "Universal Church",
    associatedPrayers: ["litany-of-the-blessed-virgin-mary", "salve-regina", "magnificat"],
    iconographyNotes:
      "Mary is shown crowned with twelve stars after Revelation 12:1, or with a single star on the shoulder or veil of her mantle, an old convention of Eastern icons; blue and gold, the colours of the night sky before dawn, belong to the same visual language.",
    aliases: ["Stella Matutina", "Morning Star", "Star of Hope"],
    theologicalSignificance:
      "The title is Christological before it is Marian: it is Christ who says in Revelation 22:16 that he is the bright morning star, and Mary is called by that name only by participation, as the first light that heralds his day. It also names her place in Christian hope. She has already reached the end of the road the Church is still walking, and her presence at the edge of the darkness is a promise that the darkness ends.",
    citations: [LITANY_OF_LORETO, SPE_SALVI, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "queen-of-apostles",
    title: "Queen of the Apostles (Regina Apostolorum)",
    summary:
      "Mary is invoked as Queen of the Apostles because she was with the Twelve in the Upper Room, persevering in prayer, when the Spirit came upon the Church that was about to be sent out.",
    origin:
      "Regina apostolorum is among the queenly invocations of the Litany of Loreto. Its scriptural ground is Acts 1:14, where the apostles devote themselves to prayer together with Mary the mother of Jesus in the days between the Ascension and Pentecost. Modern apostolic religious families took the title as their own: the Society of the Catholic Apostolate founded by St. Vincent Pallotti and the Pauline family founded by Blessed James Alberione both placed their mission under Mary Queen of the Apostles. Pius XII set the whole family of queenly titles on a firm footing in the 1954 encyclical Ad Caeli Reginam.",
    region: "Universal Church",
    associatedPrayers: [
      "litany-of-the-blessed-virgin-mary",
      "veni-creator-spiritus",
      "prayer-to-the-holy-spirit",
      "magnificat",
    ],
    iconographyNotes:
      "The standard image is Pentecost: Mary seated or standing at the centre of the apostles, hands raised or joined, with flames above each head. She is often given no attribute of rule at all except her place among them, which is the point of the title.",
    aliases: ["Regina Apostolorum", "Queen of Apostles"],
    theologicalSignificance:
      "Mary's queenship, as Ad Caeli Reginam sets out, is participated and maternal: she reigns because she is the mother of the King and because she was perfectly obedient, not by any authority of her own. Applied to the apostles, the title says that the Church's mission begins in prayer and in the receptivity Mary showed at the Annunciation. Apostolic work is fruitful in the measure that it is born of the Spirit, and Mary is the one who shows the apostles how the Spirit is received.",
    citations: [LITANY_OF_LORETO, AD_CAELI_REGINAM, LUMEN_GENTIUM],
  }),

  /* --------------------------- The Americas --------------------------- */
  marianTitle({
    slug: "our-lady-of-the-angels",
    title: "Our Lady of the Angels (La Negrita)",
    summary:
      "The patronal title of Costa Rica, taken from a small dark stone image of the Virgin and Child venerated at Cartago, to which the whole country walks in pilgrimage each August.",
    origin:
      "According to the account kept at the shrine, on 2 August 1635 a young woman of Cartago found a small dark stone image of the Virgin and Child on a rock outside the town; it was enshrined where it had been found, and the church built over the spot is now the Basilica of Our Lady of the Angels. Our Lady of the Angels is honoured as patroness of Costa Rica, and on 2 August pilgrims make the romería, walking the road from San José up to the basilica. The same date is kept at Assisi for the little church of St. Mary of the Angels, the Portiuncula, from which the Franciscans carried the title around the world.",
    feastDay: "08-02",
    region: "Costa Rica",
    associatedPrayers: ["hail-mary", "salve-regina", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "The original is tiny — a few inches high — and carved from dark volcanic stone, which gave it the affectionate name La Negrita, the little dark one. Copies keep the dark colouring, the crowned Virgin and the Child held before her, and do not attempt the detail of the worn original.",
    aliases: ["La Negrita", "Nuestra Señora de los Ángeles"],
    theologicalSignificance:
      "The devotion is a clear instance of what Ecclesia in America calls the Marian face of the Church in the New World: a poor and unremarkable image, found by a poor woman, becoming the point where a whole people recognises itself as loved. Its theological weight is that of the Magnificat — God looks upon the lowly — and the pilgrimage on foot expresses the Christian life as a journey made together toward Christ, to whom his Mother points.",
    citations: [ECCLESIA_IN_AMERICA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-divine-providence",
    title: "Our Lady of Divine Providence",
    summary:
      "Principal patroness of Puerto Rico, venerated in an image of the Virgin holding the sleeping Christ Child — the sleep of a child in his mother's arms taken as the picture of trust in God's providence.",
    origin:
      "The devotion began in Italy, where the Barnabite fathers spread the veneration of an image of the Madonna of Divine Providence kept in Rome. Bishop Gil Esteve y Tomás, arriving in San Juan in 1853 to a diocese in serious difficulty, entrusted his work to Our Lady of Divine Providence, and the devotion took root across the island. In 1969 St. Paul VI declared Our Lady of Divine Providence the principal patroness of Puerto Rico, and her feast is kept on 19 November.",
    feastDay: "11-19",
    region: "Puerto Rico",
    associatedPrayers: ["hail-mary", "memorare", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "The Virgin is shown seated with the Christ Child asleep across her lap, her hands gathered about him and her eyes lowered toward him. Nothing else is added: the whole meaning is in the child's untroubled sleep and the mother's attentiveness.",
    aliases: ["Nuestra Señora de la Divina Providencia", "Madonna della Divina Provvidenza"],
    theologicalSignificance:
      "Providence is not fate but the fatherly care by which God leads all things to their end, and the image translates that doctrine into something a family can read at a glance. Mary, who lived on nothing but that care from Nazareth to Calvary, teaches the believer the same abandonment: not passivity, but the confidence of a child who sleeps because he is held.",
    citations: [ECCLESIA_IN_AMERICA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-coromoto",
    title: "Our Lady of Coromoto",
    summary:
      "Patroness of Venezuela, honoured at Guanare, where a minute image of the Virgin and Child is kept as a relic of the events by which the Cospes people were drawn to baptism.",
    origin:
      "The devotion goes back to the middle of the seventeenth century in the plains near Guanare, where, according to the account handed down, the Blessed Virgin urged the chief of the Cospes and his people to receive baptism, and a very small image was left behind and afterwards enshrined. Pope Pius XII declared Our Lady of Coromoto patroness of Venezuela in 1942. The relic is venerated at the national shrine at Guanare, and her feast is kept in Venezuela on 11 September.",
    feastDay: "09-11",
    region: "Venezuela",
    associatedPrayers: ["hail-mary", "salve-regina", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "The image itself is astonishingly small, smaller than a postage stamp, showing the Virgin seated with the Child; it is displayed in a monstrance-like reliquary so that pilgrims can see it. The paintings and statues made from it enlarge the same seated composition.",
    aliases: ["Nuestra Señora de Coromoto", "Virgen de Coromoto"],
    theologicalSignificance:
      "Coromoto belongs to the missionary history of the Americas that Ecclesia in America describes, in which Marian devotion opened the way for the preaching of the Gospel among indigenous peoples. The whole content of the account is a call to baptism, which keeps the devotion pointed where it belongs: Mary's word to the Cospes is the word she speaks at Cana, do whatever he tells you.",
    citations: [ECCLESIA_IN_AMERICA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-lujan",
    title: "Our Lady of Luján",
    summary:
      "Patroness of Argentina, Uruguay and Paraguay, venerated in a small terracotta image of the Immaculate Conception at the great basilica on the Luján river.",
    origin:
      "In 1630 a terracotta image of the Immaculate Conception, brought from Brazil for a chapel far inland, was being carried by ox-cart across the pampas. At a place beside the Luján river the cart would not go on until the image was taken down, and the settlers took this as a sign that Our Lady wished to stay. A chapel was built, then a shrine, and finally the neo-Gothic basilica that now stands at Luján, the goal of a pilgrimage on foot from Buenos Aires that draws enormous crowds each year. Her feast is kept on 8 May.",
    feastDay: "05-08",
    region: "Argentina",
    associatedPrayers: [
      "hail-mary",
      "salve-regina",
      "memorare",
      "litany-of-the-blessed-virgin-mary",
    ],
    iconographyNotes:
      "The image is small, of fired clay, showing the Virgin of the Immaculate Conception with hands joined and eyes lowered, standing on a crescent moon. It is vested in a mantle of blue and white, the colours of Argentina, and crowned.",
    aliases: ["Nuestra Señora de Luján", "Virgen de Luján"],
    theologicalSignificance:
      "That the image is of the Immaculate Conception matters: what the pilgrims walk toward is the mystery of a human being wholly preserved by grace, the first fruit of the redemption they are asking for themselves. The pilgrimage itself, made across an entire night on foot, is the kind of popular piety the Directory on Popular Piety and the Liturgy commends when it is joined to the sacraments and leads back to Sunday Mass.",
    citations: [ECCLESIA_IN_AMERICA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-copacabana",
    title: "Our Lady of Copacabana",
    summary:
      "Patroness of Bolivia, venerated in a wooden image carved by an Andean sculptor for his own people and enshrined on the shore of Lake Titicaca.",
    origin:
      "The image was carved in 1583 by Francisco Tito Yupanqui, an indigenous Andean sculptor, for the confraternity of his town of Copacabana on Lake Titicaca, after earlier attempts had been refused as unskilled. It was enshrined at Copacabana, where the sanctuary became the chief place of Marian pilgrimage in the Andes and is served by an Augustinian community. Our Lady of Copacabana is honoured as patroness of Bolivia, and her feast is kept there on 5 August.",
    feastDay: "08-05",
    region: "Bolivia",
    associatedPrayers: ["hail-mary", "salve-regina", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "The statue is of the Candelaria type: the Virgin standing, the Child on one arm and a candle in the other hand, carved in wood, gilded and vested in richly embroidered robes with a crown. It is kept in its niche above the high altar rather than carried in procession.",
    aliases: ["Virgen de Copacabana", "Nuestra Señora de Copacabana"],
    theologicalSignificance:
      "The devotion is a landmark in the inculturation of the faith in the Andes, since the image was made by an Andean hand for Andean Christians rather than imported. Ecclesia in America notes how deeply Marian piety shaped the identity of the peoples of the continent; Copacabana shows what that means concretely, a people receiving Christ through his Mother in their own artistic and human idiom.",
    citations: [ECCLESIA_IN_AMERICA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-altagracia",
    title: "Our Lady of Altagracia",
    summary:
      "Protectress of the Dominican people, venerated at Higüey in a sixteenth-century painting of the Nativity in which the Virgin kneels in adoration before her newborn Son.",
    origin:
      "The painting was brought to Hispaniola from Spain early in the sixteenth century and venerated at Higüey in the east of the island, where devotion to Our Lady of Altagracia became the oldest continuous Marian devotion of the Americas. The great modern basilica at Higüey was built to receive the pilgrims. Her feast is kept in the Dominican Republic on 21 January, a day observed throughout the country; St. John Paul II's first journey outside Italy, in January 1979, began at Santo Domingo.",
    feastDay: "01-21",
    region: "Dominican Republic",
    associatedPrayers: ["hail-mary", "salve-regina", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "Unusually for a national patronal image, this is a Nativity scene rather than a portrait: the Virgin, in a blue mantle strewn with stars, kneels with hands joined before the newborn Christ laid before her, with St. Joseph behind and the stable roof above. Mary is shown adoring her Son, not presenting herself.",
    aliases: ["Nuestra Señora de la Altagracia", "Virgen de la Altagracia"],
    theologicalSignificance:
      "Because the image is of the Nativity, the devotion is Christmas devotion: what is venerated is the Word made flesh and the Mother's adoration of him. It illustrates the rule Marialis Cultus lays down for all Marian piety, that it be Christological in orientation, since here Mary herself is depicted with her eyes on Christ and the pilgrim's eyes are led to follow hers.",
    citations: [ECCLESIA_IN_AMERICA, MARIALIS_CULTUS, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-suyapa",
    title: "Our Lady of Suyapa",
    summary:
      "Patroness of Honduras, venerated in an image only a few centimetres high that has been kept at Suyapa, near Tegucigalpa, since the eighteenth century.",
    origin:
      "According to the account preserved at the shrine, in 1747 a labourer sleeping in the open near Suyapa found a very small wooden image of the Virgin, which was kept in his family's home and then, as reports of favours multiplied, in a chapel built for it. Pope Pius XI declared Our Lady of Suyapa patroness of Honduras in 1925. The image is venerated at the Basilica of Suyapa outside Tegucigalpa, and her feast is kept on 3 February.",
    feastDay: "02-03",
    region: "Honduras",
    associatedPrayers: ["hail-mary", "salve-regina", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "The image is about six centimetres tall, carved from dark cedar, showing the Virgin standing with hands joined in prayer. Because it is so small it is set within a large gilded frame of rays, which is what most reproductions show.",
    aliases: ["Nuestra Señora de Suyapa", "Virgen de Suyapa"],
    theologicalSignificance:
      "The size of the image is itself part of the catechesis: a nation's patronal shrine is built around something a labourer could hold in his palm. The devotion carries the Magnificat's reversal into national life, and it has held Honduran Catholic identity together through poverty, migration and disaster, which is precisely the consolation the Church expects popular Marian piety to give.",
    citations: [ECCLESIA_IN_AMERICA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),

  /* ------------------------------- Asia ------------------------------- */
  marianTitle({
    slug: "our-lady-of-vailankanni",
    title: "Our Lady of Vailankanni (Our Lady of Good Health)",
    summary:
      "The great Marian shrine of India, on the Coromandel coast of Tamil Nadu, where Mary is invoked as Our Lady of Good Health by Catholics and by pilgrims of other faiths alike.",
    origin:
      "Devotion at Velankanni rests on accounts handed down from the sixteenth and seventeenth centuries — help given to a boy carrying milk, healing given to a lame child, and the rescue of Portuguese sailors from a storm who fulfilled a vow by building a chapel on the shore. The shrine grew from that chapel; Pope St. John XXIII raised its church to the rank of a minor basilica in 1962. The principal feast is the Nativity of the Blessed Virgin Mary on 8 September, preceded by a festival of days that draws pilgrims from across India.",
    feastDay: "09-08",
    region: "India (Velankanni, Tamil Nadu)",
    associatedPrayers: ["hail-mary", "memorare", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "The Virgin is vested in a sari and holds the Child, who is likewise dressed in Indian fashion; pilgrims traditionally offer saris for the image. The basilica itself is white with a red-tiled roof and rises directly above the shore.",
    aliases: ["Our Lady of Velankanni", "Our Lady of Good Health", "Vailankanni Matha"],
    theologicalSignificance:
      "Ecclesia in Asia asks that the Gospel be presented in Asia with an Asian face, and Velankanni is one of the places where that has happened without any loss of substance: a sari-clad Madonna, an Indian pilgrimage culture, and unaltered Catholic faith in the Incarnation. The title Good Health also keeps the Church's ancient conviction that the God who saves souls cares about bodies, and that prayer for healing is a proper part of Christian life.",
    citations: [ECCLESIA_IN_ASIA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-la-vang",
    title: "Our Lady of La Vang",
    summary:
      "The national Marian shrine of Vietnam, whose devotion arose among Catholics hiding in the forest during persecution and which has accompanied the Vietnamese Church through two centuries of suffering.",
    origin:
      "Vietnamese Catholics hand down an account that in 1798, during a violent persecution, Christians who had fled into the forest of La Vang in the province of Quang Tri were consoled by the appearance of a lady holding a child, who encouraged them to persevere. The Holy See has never issued a judgement on those events, and this entry reports them as the tradition of the Vietnamese Church rather than as an approved apparition. A chapel was built on the site, La Vang became the national Marian centre of Vietnam, and its church was raised to the rank of a minor basilica in 1961. The national pilgrimage is held around the solemnity of the Assumption.",
    region: "Vietnam",
    associatedPrayers: [
      "hail-mary",
      "salve-regina",
      "memorare",
      "litany-of-the-blessed-virgin-mary",
    ],
    iconographyNotes:
      "The statue most often used shows the Virgin in the Vietnamese áo dài with an elaborate headdress, holding the Child dressed in the same manner. The ruined bell tower of the old church, left standing after the war, has become part of the shrine's own iconography.",
    aliases: ["Đức Mẹ La Vang", "Our Lady of Lavang"],
    theologicalSignificance:
      "La Vang is inseparable from the Vietnamese martyrs, and its meaning is the meaning the Church gives to Mary at the foot of the Cross: she stands with those who suffer for her Son and does not remove the Cross from them. Ecclesia in Asia points to the martyrs and to Marian devotion together as the twin roots of Asian Catholic endurance, and this shrine holds both.",
    citations: [ECCLESIA_IN_ASIA, LUMEN_GENTIUM, DIRECTORY_POPULAR_PIETY],
  }),
  marianTitle({
    slug: "our-lady-of-sheshan",
    title: "Our Lady of Sheshan",
    summary:
      "Mary venerated at the hilltop basilica of Sheshan outside Shanghai under the title Help of Christians, and invoked by the whole Church on 24 May as the patroness of Catholics in China.",
    origin:
      "A Marian shrine was established in the nineteenth century on the hill of Sheshan, west of Shanghai, and grew into the great pilgrimage church that crowns the hill, where May has long been the month of pilgrimage. In his Letter to the Catholics of the People's Republic of China of 27 May 2007, Pope Benedict XVI asked that 24 May, the memorial of Our Lady Help of Christians who is venerated with great devotion at Sheshan, be kept each year as a day of prayer for the Church in China; he afterwards composed a prayer to Our Lady of Sheshan for that day.",
    feastDay: "05-24",
    region: "China (Sheshan, Shanghai)",
    associatedPrayers: ["hail-mary", "memorare", "sub-tuum-praesidium", "salve-regina"],
    iconographyNotes:
      "The bronze figure on the basilica's tower shows Mary holding the Child above her head, his arms stretched wide so that his small body forms a cross against the sky — the Mother offering her Son, and the Son offering himself, in one image.",
    aliases: ["Our Lady of Zose", "Our Lady Help of Christians of Sheshan"],
    theologicalSignificance:
      "The title binds Marian devotion to intercession for a suffering and divided local Church, and the annual day of prayer makes that intercession an act of the whole Catholic communion rather than of Chinese Catholics alone. The statue's own theology is exact: Mary's help is never independent of Christ, since what she lifts up for the world to see is the crucified Son.",
    citations: [LETTER_TO_CHINESE_CATHOLICS, ECCLESIA_IN_ASIA, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-penafrancia",
    title: "Our Lady of Peñafrancia",
    summary:
      "Patroness of the Bicol region of the Philippines, honoured at Naga with a nine-day novena and a river procession that carries her image home along the Naga River.",
    origin:
      "The devotion was carried to the Philippines from the Spanish shrine of Nuestra Señora de la Peña de Francia in the mountains near Salamanca. At Naga in Camarines Sur a Spanish priest, Miguel Robles de Covarrubias, had an image made and enshrined in 1710 in thanksgiving for recovery from illness, and the devotion spread through the whole Bicol peninsula. The feast is kept on the third Saturday of September — a movable day, so no fixed date is given here — after a nine-day novena, and concludes with the fluvial procession that returns the image to her shrine by river.",
    region: "Philippines (Naga, Bicol)",
    associatedPrayers: [
      "hail-mary",
      "salve-regina",
      "litany-of-the-blessed-virgin-mary",
      "memorare",
    ],
    iconographyNotes:
      "The image is a dark-complexioned standing Virgin holding the Child, vested in a wide embroidered cape and crowned. During the fluvial procession she is carried on a decorated barge accompanied by hundreds of small boats, with the traditional cry Viva la Virgen taken up along the banks.",
    aliases: ["Nuestra Señora de Peñafrancia", "Ina", "Our Lady of Penafrancia"],
    theologicalSignificance:
      "Peñafrancia is a textbook case of what the Directory on Popular Piety and the Liturgy has in mind when it asks that popular devotion be ordered to the liturgy: the novena prepares for the Mass, and the procession is an act of public faith rather than a spectacle. Bicolanos call her simply Ina, Mother, which is the whole theology of the devotion — the Church's confidence that Mary's motherhood is exercised for real people in a real place.",
    citations: [ECCLESIA_IN_ASIA, DIRECTORY_POPULAR_PIETY, USCCB_PRAYERS_AND_DEVOTIONS],
  }),
  marianTitle({
    slug: "our-lady-of-manaoag",
    title: "Our Lady of Manaoag",
    summary:
      "Our Lady of the Most Holy Rosary venerated at Manaoag in Pangasinan, the Dominican shrine to which Filipinos come in enormous numbers to ask her prayers.",
    origin:
      "The shrine at Manaoag, in the province of Pangasinan on Luzon, has been in the care of the Order of Preachers for centuries, and the devotion is bound to the Dominican preaching of the Rosary in the Philippines; the ivory-faced image of Our Lady of the Most Holy Rosary is enshrined above the high altar. The church was raised to the rank of a minor basilica in 2015. The local feast is kept on a movable day in the Easter season, so no fixed date is given here.",
    region: "Philippines (Manaoag, Pangasinan)",
    associatedPrayers: [
      "hail-mary",
      "salve-regina",
      "memorare",
      "litany-of-the-blessed-virgin-mary",
    ],
    iconographyNotes:
      "The image shows the Virgin standing, crowned, with the Child on her arm and a rosary in her hand; both are vested in stiff embroidered robes in the Spanish colonial manner. Pilgrims traditionally climb the stairs behind the altar to touch the base of the image and leave candles in the votive chapel below.",
    aliases: ["Nuestra Señora de Manaoag", "Apo Baket"],
    theologicalSignificance:
      "The shrine's title is the Rosary, which keeps its devotion tethered to the mysteries of Christ's life: as Rosarium Virginis Mariae insists, the Rosary is a Christological prayer prayed in Mary's company and at her school. The steady flow of pilgrims asking for help in ordinary troubles is an exercise of the communion of saints, the confidence that those already in glory pray for those still on the way.",
    citations: [ROSARIUM_VIRGINIS_MARIAE, ECCLESIA_IN_ASIA, USCCB_ROSARIES],
  }),

  /* ------------------------------ Europe ------------------------------ */
  marianTitle({
    slug: "our-lady-of-montserrat",
    title: "Our Lady of Montserrat (La Moreneta)",
    summary:
      "The dark Romanesque Virgin of the Benedictine abbey of Montserrat, patroness of Catalonia, venerated on the serrated mountain above Barcelona.",
    origin:
      "A monastic community has lived on the mountain of Montserrat since the eleventh century, and the wooden image of the seated Virgin and Child venerated in the abbey church is Romanesque, darkened with age until the Catalans named it La Moreneta, the little dark one. Montserrat became one of the chief pilgrimage places of Europe; St. Ignatius of Loyola kept vigil before the image in 1522 and laid down his sword there before going on to Manresa. Pope Leo XIII declared Our Lady of Montserrat patroness of Catalonia in 1881, and her feast is kept on 27 April.",
    feastDay: "04-27",
    region: "Spain (Catalonia)",
    associatedPrayers: [
      "salve-regina",
      "hail-mary",
      "litany-of-the-blessed-virgin-mary",
      "magnificat",
    ],
    iconographyNotes:
      "A Romanesque Virgin in Majesty: Mary seated as a throne with the Child upright on her knee, both crowned, the faces and hands dark. Her right hand holds a sphere, which pilgrims touch as they file past. The abbey's boys' choir, the Escolania, sings the Virolai and the Salve at the shrine.",
    aliases: ["La Moreneta", "Mare de Déu de Montserrat", "Virgen de Montserrat"],
    theologicalSignificance:
      "The Virgin in Majesty is a doctrinal image before it is a devotional one: Mary is depicted as the throne of Wisdom, her whole posture existing to present the Child who blesses from her lap. The sphere in her hand belongs to him, the world he holds. Ecclesia in Europa appeals to shrines such as this one as living memory, places where a people's Christian roots are not an argument but an experience.",
    citations: [ECCLESIA_IN_EUROPA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-covadonga",
    title: "Our Lady of Covadonga (La Santina)",
    summary:
      "Patroness of Asturias, venerated in a cave sanctuary in the Picos de Europa that Asturians associate with the beginnings of the Christian recovery of the peninsula.",
    origin:
      "The Holy Cave of Covadonga, high in the mountains of Asturias, has been a place of prayer for many centuries and is bound in Asturian memory to Pelayo and the resistance that began there in the eighth century. The image venerated in the cave replaced an earlier one destroyed by fire, and the basilica below the cave was built in the nineteenth century for the pilgrims. Our Lady of Covadonga, affectionately called La Santina, is honoured as patroness of Asturias, and her feast is kept on 8 September, the Nativity of the Blessed Virgin Mary.",
    feastDay: "09-08",
    region: "Spain (Asturias)",
    associatedPrayers: ["hail-mary", "salve-regina", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "A small standing Virgin with the Child on her left arm, crowned and vested, set in the mouth of the cave above a waterfall so that pilgrims see her framed by rock and falling water. Copies keep the crown, the white and blue vesting, and the flowers Asturians bring her.",
    aliases: ["La Santina", "Virgen de Covadonga", "Nuestra Señora de Covadonga"],
    theologicalSignificance:
      "A shrine so tied to national memory needs the caution Ecclesia in Europa gives: Christian roots are received as a call to conversion, not as a claim of possession, and Marian devotion must never be enlisted as a badge of ethnic or political triumph. Read rightly, Covadonga proclaims that faith survives in caves and among the poor, and that its endurance is God's work and not a nation's achievement.",
    citations: [ECCLESIA_IN_EUROPA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-einsiedeln",
    title: "Our Lady of Einsiedeln",
    summary:
      "The Black Madonna of the Chapel of Grace in the Benedictine abbey of Einsiedeln, one of the oldest continuously visited Marian pilgrimages north of the Alps.",
    origin:
      "The abbey of Einsiedeln in the Swiss canton of Schwyz grew from the hermitage of St. Meinrad, who was killed there in the ninth century, and Benedictine monks have kept the place ever since. Inside the great baroque abbey church stands the Chapel of Grace, a small dark chapel housing a late-Gothic carved image of the Virgin and Child. Einsiedeln became a principal station on the pilgrim roads of Europe, including the routes toward Compostela, and the monastic community still sings the Salve Regina before the image each evening.",
    region: "Switzerland (Einsiedeln, Schwyz)",
    associatedPrayers: ["salve-regina", "hail-mary", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "A late-Gothic standing Virgin holding the Child, blackened over centuries by lamp and candle smoke and kept black when restored. Both figures are vested in embroidered robes that the monks change according to the liturgical season, so the image appears in the colour of the day.",
    aliases: ["Black Madonna of Einsiedeln", "Unsere Liebe Frau von Einsiedeln"],
    theologicalSignificance:
      "Einsiedeln shows Marian devotion in its monastic form: not an occasional feast but the daily Salve sung at the end of the day, prayer to the Mother of God woven into the rhythm of the Divine Office. The Directory on Popular Piety and the Liturgy holds up exactly this ordering, in which popular Marian devotion draws its life from the liturgy and returns to it, rather than running alongside it.",
    citations: [ECCLESIA_IN_EUROPA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-ta-pinu",
    title: "Our Lady of Ta' Pinu",
    summary:
      "The national Marian shrine of Malta, on the island of Gozo, grown from a small country chapel where a farm woman said in 1883 that she had heard a call to stop and pray.",
    origin:
      "The chapel called Ta' Pinu, after Pinu Gauci who cared for it in earlier centuries, stands alone in the fields of Gozo. In 1883 Karmni Grima, passing by, said she heard a voice calling her to go in and pray; the reports of favours that followed drew growing numbers of pilgrims, and a large church was built beside the old chapel, which was incorporated into it. The shrine was raised to the rank of a minor basilica and became the national Marian sanctuary of Malta. St. John Paul II prayed there in 1990 and Pope Francis in 2022.",
    region: "Malta (Gozo)",
    associatedPrayers: [
      "hail-mary",
      "salve-regina",
      "memorare",
      "litany-of-the-blessed-virgin-mary",
    ],
    iconographyNotes:
      "The painting over the altar of the old chapel shows the Assumption of Our Lady. The walls of the corridors behind the sanctuary are covered with ex-voto offerings — crutches, letters, plaster casts, photographs of the sick — left by pilgrims in thanksgiving.",
    aliases: ["Ta' Pinu", "Our Lady of Ta Pinu"],
    theologicalSignificance:
      "The account at the heart of Ta' Pinu is not a vision but a call to prayer, which is a useful correction to devotion that hunts for the extraordinary: what is asked of the passer-by is simply to go in and pray. The ex-votos express the Church's belief in intercessory prayer and in the communion of saints, and the shrine has become the place where an entire island nation entrusts its sick to the Mother of God.",
    citations: [ECCLESIA_IN_EUROPA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),

  /* ------------------------------ Africa ------------------------------ */
  marianTitle({
    slug: "our-lady-of-kibeho",
    title: "Our Lady of Kibeho (Mother of the Word)",
    summary:
      "Mary venerated at Kibeho in Rwanda under the name Nyina wa Jambo, Mother of the Word, at the only Marian apparition site in Africa whose events have been recognised by the local bishop.",
    origin:
      "Between 1981 and 1983 several young people at Kibeho, in the south of Rwanda, reported that the Blessed Virgin appeared to them, calling herself Nyina wa Jambo, Mother of the Word, and calling for prayer, penance and conversion. The Bishop of Gikongoro authorised public devotion at the site in 1988 and on 29 June 2001 declared that the apparitions to three of the visionaries — Alphonsine Mumureke, Nathalie Mukamazimpaka and Marie Claire Mukangango — could be held as authentic. That judgement concerns those three alone, and not every claim ever made at Kibeho. The shrine is dedicated to Our Lady of Sorrows, and 28 November, the anniversary of the first reported apparition, is kept there.",
    feastDay: "11-28",
    region: "Rwanda",
    associatedPrayers: ["hail-mary", "sub-tuum-praesidium", "litany-of-the-blessed-virgin-mary"],
    iconographyNotes:
      "The shrine statue shows the Virgin standing with hands open and lowered, in blue and white, without the crown and sceptre of European royal imagery. The Rosary of the Seven Sorrows, long prayed in Rwanda and closely associated with the shrine, supplies the devotional setting for the title Mother of the Word.",
    aliases: ["Nyina wa Jambo", "Mother of the Word", "Our Lady of Sorrows of Kibeho"],
    theologicalSignificance:
      "The name given at Kibeho is doctrinal: Mother of the Word says the same thing as Theotokos, that the child she bore is the eternal Word made flesh. Its message — prayer, penance, conversion of heart, sorrow over the wounds of the world — adds nothing to the deposit of faith and is not required to be believed, since even approved private revelation, as the Church teaches, only helps the faithful live the public revelation given once for all in Christ.",
    citations: [ECCLESIA_IN_AFRICA, DIRECTORY_POPULAR_PIETY, LUMEN_GENTIUM],
  }),
  marianTitle({
    slug: "our-lady-of-africa",
    title: "Our Lady of Africa",
    summary:
      "Mary invoked for the whole African continent from the basilica above the bay of Algiers, whose sanctuary carries the prayer that she intercede for Christians and for Muslims alike.",
    origin:
      "The bronze statue of Notre-Dame d'Afrique was given to the Church in Algiers in the mid-nineteenth century, and the basilica raised for it on the cliffs above the bay was consecrated in 1872. Behind the sanctuary an inscription asks Our Lady of Africa to pray for us and for the Muslims. Cardinal Charles Lavigerie, Archbishop of Algiers, placed the missionary society he founded — the Missionaries of Africa, commonly called the White Fathers — under her patronage, and the title travelled with them across the continent. The basilica was restored and reopened in the early twenty-first century.",
    region: "Algeria (Algiers)",
    associatedPrayers: [
      "hail-mary",
      "memorare",
      "salve-regina",
      "litany-of-the-blessed-virgin-mary",
    ],
    iconographyNotes:
      "A dark bronze standing Virgin with her hands open and slightly raised, alone, without the Child — a figure of intercession. The basilica that houses her mixes Byzantine and North African architectural forms and looks out over the Mediterranean.",
    aliases: ["Notre-Dame d'Afrique", "Our Lady of Africa"],
    theologicalSignificance:
      "The inscription in the apse is the shrine's theology in a line: a tiny Christian community in a Muslim land praying for its neighbours rather than against them, in the spirit that Nostra Aetate would later make the Church's common teaching. The title also expresses the Church's hope for a continent of great suffering and great faith, which Ecclesia in Africa entrusts to Mary as the Church there continues its mission.",
    citations: [ECCLESIA_IN_AFRICA, NOSTRA_AETATE, LUMEN_GENTIUM],
  }),
];
