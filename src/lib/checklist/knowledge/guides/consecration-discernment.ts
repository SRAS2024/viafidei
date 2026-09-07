import type { CuratedEntry } from "../index";

/**
 * Guides — sections E (Consecrations), F (Discernment) and G (Vocation).
 *
 * Every step body is written to be followed from the page: prayer names are
 * spelled out (PrayerLinkedText makes them expandable), and nothing is
 * presented as a norm that the Church does not actually ask for. The
 * "promises" attached to private revelations are deliberately not listed as
 * guarantees; canonical and formation details are given only where they are
 * well established (Code of Canon Law, Pastores Dabo Vobis, Vita Consecrata,
 * the USCCB formation programs).
 */

// USCCB pages (they sit behind a JS connection check for non-browser clients
// but render normally in a browser; each was opened and confirmed).
const U_DEV = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions";
const U_VOC = "https://www.usccb.org/beliefs-and-teachings/vocations";
const U_MFL = "https://www.usccb.org/topics/marriage-and-family-life-ministries";

// Vatican documents.
const V_RVM =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";
const V_DPP =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const V_MC =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus.html";
const V_HA =
  "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15051956_haurietis-aquas.html";
const V_PC =
  "https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20201208_patris-corde.html";
const V_RC =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_15081989_redemptoris-custos.html";
const V_EG =
  "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20131124_evangelii-gaudium.html";
const V_NMI =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2001/documents/hf_jp-ii_apl_20010106_novo-millennio-ineunte.html";
const V_PDV =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_25031992_pastores-dabo-vobis.html";
const V_AL =
  "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20160319_amoris-laetitia.html";
const V_VC =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_25031996_vita-consecrata.html";
const V_CL =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_30121988_christifideles-laici.html";

// Catechism of the Catholic Church (vatican.va IntraText edition; the
// ccc_css article URLs return 404, these are the same articles).
const V_CCC_BATTLE = "https://www.vatican.va/archive/ENG0015/__P9O.HTM"; // Part 4, The Battle of Prayer
const V_CCC_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9K.HTM"; // Part 4, Expressions of Prayer
const V_CCC_ORD = "https://www.vatican.va/archive/ENG0015/__P4R.HTM"; // Part 2, The Sacrament of Holy Orders

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  kind: "consecration" | "discernment" | "vocation";
  sacramentKey?: "holy_orders";
  authorityLevel: "USCCB" | "VATICAN";
  citations: string[];
  intro: string;
  whatYouNeed: string[];
  whenToPray: string;
  tips: string[];
  steps: Step[];
  durationMinutes: number;
  relatedPrayers: string[];
  relatedDevotions?: string[];
  relatedPractices?: string[];
  relatedSaints?: string[];
}

function guide(g: GuideInput): CuratedEntry {
  return {
    contentType: "GUIDE",
    slug: g.slug,
    authorityLevel: g.authorityLevel,
    citations: g.citations,
    payload: {
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      kind: g.kind,
      ...(g.sacramentKey ? { sacramentKey: g.sacramentKey } : {}),
      intro: g.intro,
      whatYouNeed: g.whatYouNeed,
      whenToPray: g.whenToPray,
      tips: g.tips,
      steps: g.steps,
      durationMinutes: g.durationMinutes,
      relatedPrayers: g.relatedPrayers,
      relatedDevotions: g.relatedDevotions ?? [],
      relatedPractices: g.relatedPractices ?? [],
      relatedSaints: g.relatedSaints ?? [],
      citations: g.citations,
    },
  };
}

export const consecrationAndDiscernmentGuides: CuratedEntry[] = [
  // ───────────────────────── E. CONSECRATIONS ─────────────────────────
  guide({
    slug: "how-to-make-a-marian-consecration",
    title: "How to Make a Marian Consecration",
    summary:
      "An overview of consecration to Jesus through Mary: what it means, how to prepare, which feast to choose, the act itself, and how to live and renew it afterwards.",
    kind: "consecration",
    authorityLevel: "VATICAN",
    citations: [V_DPP, V_RVM],
    intro:
      "Marian consecration is the giving of oneself entirely to Jesus Christ through the hands of his Mother, so that she may form us into the likeness of her Son. Its best-known form is the 'total consecration' taught by Saint Louis de Montfort in True Devotion to the Blessed Virgin, summed up in the words Saint John Paul II took as his motto: Totus tuus, 'I am all yours.' The Church understands the act as a way of living out the promises of Baptism: the Directory on Popular Piety explains that the word 'consecration' is used here in a broad, non-technical sense — strictly, consecration is reserved for self-offerings that have God as their object — and that 'entrustment' is the alternative term some prefer for what we do when we place ourselves in Mary's care. It does not replace devotion to Christ; it is a way of belonging to him more completely.",
    whatYouNeed: [
      "A period of preparation — traditionally the 33 days of Saint Louis de Montfort (see the companion guide)",
      "A Marian feast chosen as the day of consecration",
      "The text of the act of consecration you will pray",
      "Confession and Holy Communion arranged for the feast day",
    ],
    whenToPray:
      "The act is made on a Marian feast at the end of the preparation and renewed each year on the same feast; many renew it briefly every morning.",
    tips: [
      "Do not rush the preparation. The act takes a minute to say; the 33 days are what make it sincere.",
      "If you cannot make the full de Montfort preparation, a shorter novena of prayer and a good confession is a legitimate way to prepare; the Church prescribes no particular program.",
      "Consecration is a beginning, not a finish line. The daily Rosary, the Angelus, and a short renewal of the act keep it alive.",
      "Parishes and families can make the act together; a priest may lead it after Mass on the feast.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Understand what you are doing",
        body: "Read what the consecration is before you begin: a free, total gift of yourself — body and soul, possessions and merits — to Jesus through Mary, made by a baptised Christian who wants to live his Baptism to the full. Saint Louis de Montfort calls it the 'perfect renewal of the vows and promises of holy Baptism.' Read at least the relevant chapters of True Devotion, or a sound modern presentation of it, so that the act is an informed one.",
      },
      {
        order: 2,
        title: "Choose the feast and set the date",
        body: "Pick a feast of Our Lady and count back to the start of your preparation. Feasts commonly chosen include the Immaculate Conception (8 December), Our Lady of Guadalupe (12 December), the Solemnity of Mary, Mother of God (1 January), Our Lady of Lourdes (11 February), the Annunciation (25 March), Our Lady of Fatima (13 May), the Visitation (31 May), the Immaculate Heart of Mary (the Saturday after the Solemnity of the Sacred Heart), Our Lady of Mount Carmel (16 July), the Assumption (15 August), the Queenship of Mary (22 August), the Nativity of Mary (8 September), Our Lady of the Rosary (7 October) and the Presentation of Mary (21 November).",
      },
      {
        order: 3,
        title: "Make the preparation",
        body: "Give the weeks before the feast to prayer and reading. The de Montfort method has twelve preliminary days of turning away from the spirit of the world, then a week each on knowledge of self, knowledge of Mary and knowledge of Jesus; the companion guide sets out that schedule day by day. Pray the Veni Creator Spiritus for light, the Magnificat with Mary, and the Litany of the Blessed Virgin Mary, and pray the Rosary daily if you can.",
      },
      {
        order: 4,
        title: "Go to confession and receive Holy Communion",
        body: "Go to confession in the days before the feast, and on the feast itself attend Mass and receive Holy Communion. Saint Louis de Montfort intends the act to be made in the state of grace and in union with Christ received in the Eucharist, since it is to him, through Mary, that we give ourselves.",
      },
      {
        order: 5,
        title: "Pray the act of consecration",
        body: "After Communion, or before an image of Our Lady at home or in church, pray the Act of Consecration to Jesus Christ through Mary of Saint Louis de Montfort slowly and in full, aloud if possible. Many sign and date a written copy and keep it. If you are consecrating a family or a parish, one person reads the act and the others join in the concluding words.",
      },
      {
        order: 6,
        title: "Give thanks",
        body: "Close with the Magnificat, Mary's own song of thanksgiving, and a Glory Be. Ask her, in the words of the Memorare, never to leave your side. Then let the day be a feast: the consecration is meant to be joyful, not anxious.",
      },
      {
        order: 7,
        title: "Live the consecration",
        body: "Saint Louis de Montfort's rule for afterwards is to do everything 'with Mary, in Mary, through Mary and for Mary.' Practically that means the daily Rosary or at least a decade, the Angelus, a Hail Mary before decisions, and treating every duty as something done in her company. The Rosary in particular, as Rosarium Virginis Mariae says, is the school in which Mary teaches us Christ.",
      },
      {
        order: 8,
        title: "Renew it often",
        body: 'Renew the full act every year on the feast you chose, ideally after the same preparation or a shorter one. Each morning you can renew it in the short form de Montfort gives: "I am all thine, and all that I have is thine, O most loving Jesus, through Mary, thy most holy Mother." Renewal keeps the consecration from becoming a memory and turns it into a way of life.',
      },
    ],
    relatedPrayers: [
      "veni-creator-spiritus",
      "litany-of-the-blessed-virgin-mary",
      "act-of-consecration-to-mary-de-montfort",
      "magnificat",
      "glory-be",
      "memorare",
      "hail-mary",
    ],
    relatedDevotions: ["consecration-to-mary", "holy-rosary"],
    relatedSaints: ["saint-louis-de-montfort", "saint-maximilian-kolbe", "saint-john-paul-ii"],
  }),

  guide({
    slug: "how-to-make-the-33-day-preparation-for-marian-consecration",
    title: "How to Make the 33-Day Preparation for Marian Consecration",
    summary:
      "The schedule of Saint Louis de Montfort: twelve preliminary days and three weeks of prayer and reading, timed to end on the eve of a Marian feast, followed by the act of consecration.",
    kind: "consecration",
    authorityLevel: "VATICAN",
    citations: [V_RVM, V_MC],
    intro:
      "Saint Louis de Montfort (1673-1716) did not want the consecration made lightly, so he laid out a period of preparation: twelve days spent emptying oneself of the spirit of the world, then three weeks devoted in turn to knowing oneself, knowing Mary and knowing Jesus Christ. Thirty-three days honour the years of Our Lord's earthly life. Each day takes about twenty minutes of prayer and reading; the point is not to complete a syllabus but to arrive at the feast day free, humble and in love. Saint John Paul II, whose motto Totus tuus came from de Montfort, described the reading of True Devotion as 'a decisive turning point' in his life.",
    whatYouNeed: [
      "True Devotion to the Blessed Virgin by Saint Louis de Montfort, or a preparation book based on it",
      "A Bible and, if you have one, The Imitation of Christ, which the traditional readings draw on",
      "The date of the Marian feast you will consecrate yourself on",
      "About twenty minutes a day for 33 days",
      "A rosary",
    ],
    whenToPray:
      "Begin 33 days before the feast so that the last day falls on its eve. Traditional starting dates: 9 January for Our Lady of Lourdes (11 February); 20 February for the Annunciation (25 March; 21 February in a leap year); 10 April for Our Lady of Fatima (13 May); 13 July for the Assumption (15 August); 4 September for Our Lady of the Rosary (7 October); 5 November for the Immaculate Conception (8 December); 9 November for Our Lady of Guadalupe (12 December).",
    tips: [
      "A missed day is not a failure; simply continue where you left off. The dates are a help, not a law.",
      "Keep the daily prayers short enough to say every day; consistency matters more than volume.",
      "Make notes: a line each day on what struck you will be the best preparation for the act itself.",
      "Praying the schedule with a group — a parish, a family, a few friends — is the traditional way, and it makes the feast a shared celebration.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Choose the feast and count back 33 days",
        body: "Decide which feast of Our Lady you will make the consecration on, then count back so that the preparation begins 33 days before it and ends on its eve; the act is prayed on the feast itself. Write the dates of each stage in your calendar: days 1-12, then the three weeks of seven days each.",
      },
      {
        order: 2,
        title: "Days 1-12: renouncing the spirit of the world",
        body: "The preliminary period is a turning away from what de Montfort calls the spirit of the world — pride, self-seeking, the love of comfort and applause — which is the opposite of the spirit of Christ. Each day read a short passage (the traditional readings come from the Gospels, especially the Sermon on the Mount, and from The Imitation of Christ), examine one attachment honestly, and pray the Veni Creator Spiritus, the Magnificat and a Glory Be. An examination of conscience during these days prepares the confession you will make before the feast.",
      },
      {
        order: 3,
        title: "Week 1 (days 13-19): knowledge of self",
        body: "The first week asks for humility: to know ourselves as we are, our weakness and our need of grace, without either despair or excuse. Read Gospel scenes of repentance and de Montfort's passages on our need of Mary, examine your conscience gently each day, and add the Litany of the Blessed Virgin Mary to the daily prayers. Ask the Holy Spirit for self-knowledge that leads to trust rather than discouragement.",
      },
      {
        order: 4,
        title: "Week 2 (days 20-26): knowledge of the Blessed Virgin",
        body: "The second week is spent coming to know Mary: her place in God's plan, her virtues, and her role as Mother of the Church. Read the Gospel passages where she appears (Luke 1-2, John 2 and 19) and de Montfort's chapters on true devotion, and pray the Rosary each day — the whole five decades if you can. Keep the Litany of the Blessed Virgin Mary and the Magnificat in the daily prayers. Saint Paul VI's Marialis Cultus is a sound guide here: authentic devotion to Mary is Trinitarian, Christ-centred, rooted in Scripture and the liturgy, and free of sentimentality.",
      },
      {
        order: 5,
        title: "Week 3 (days 27-33): knowledge of Jesus Christ",
        body: "The final week turns to Jesus himself, to whom the whole consecration is directed: his Incarnation, his Passion, his Eucharist, his kingship. Read from the Gospels and from de Montfort on Jesus as the final end of devotion to Mary, keep the daily Rosary and Litany, and add the Anima Christi or a prayer before a crucifix. The last day, the eve of the feast, is for quiet and for reading through the act you will pray tomorrow.",
      },
      {
        order: 6,
        title: "Go to confession and receive Holy Communion on the feast",
        body: "Go to confession during the last week or on the eve of the feast. On the feast day attend Mass and receive Holy Communion. De Montfort intends the act to be made in the state of grace and united to Christ in the Eucharist, since the consecration is to him, through Mary.",
      },
      {
        order: 7,
        title: "Pray the act of consecration",
        body: "After Communion, or before an image of Our Lady, pray the Act of Consecration to Jesus Christ through Mary of Saint Louis de Montfort slowly and in full. Many sign and date a written copy. Finish with the Magnificat and the Memorare, and let the rest of the day be a celebration.",
      },
      {
        order: 8,
        title: "Renew it each year",
        body: 'Mark the feast in next year\'s calendar and renew the act on it, with the full preparation or a shorter one such as a novena. In between, renew it daily in the short form: "I am all thine, and all that I have is thine, O most loving Jesus, through Mary, thy most holy Mother." Living the consecration is the daily Rosary, the Angelus, and the habit of doing everything with Mary and for Jesus.',
      },
    ],
    relatedPrayers: [
      "veni-creator-spiritus",
      "magnificat",
      "glory-be",
      "litany-of-the-blessed-virgin-mary",
      "hail-mary",
      "anima-christi",
      "act-of-consecration-to-mary-de-montfort",
      "memorare",
    ],
    relatedDevotions: ["consecration-to-mary", "holy-rosary"],
    relatedSaints: ["saint-louis-de-montfort", "saint-john-paul-ii"],
  }),

  guide({
    slug: "how-to-consecrate-yourself-to-the-sacred-heart-of-jesus",
    title: "How to Consecrate Yourself to the Sacred Heart of Jesus",
    summary:
      "Personal consecration to the Sacred Heart: what the devotion is, how to prepare, choosing the day, the Litany and the act, and living it through the First Fridays and the Morning Offering.",
    kind: "consecration",
    authorityLevel: "VATICAN",
    citations: [V_HA, U_DEV],
    intro:
      "Devotion to the Sacred Heart honours the human heart of Jesus, pierced on the Cross, as the sign and centre of the love with which God has loved us. Pope Pius XII's encyclical Haurietis Aquas (1956) sets out its foundations in Scripture and Tradition and calls it 'the most effective school of the love of God.' The devotion took its modern shape from the revelations to Saint Margaret Mary Alacoque at Paray-le-Monial (1673-1675), and Pope Leo XIII consecrated the whole human race to the Sacred Heart in 1899. To consecrate yourself to the Sacred Heart is to answer love with love: to give Jesus your heart, and to make reparation for the coldness with which his love is met.",
    whatYouNeed: [
      "An image of the Sacred Heart, at home or in church",
      "The text of an act of consecration to the Sacred Heart",
      "Confession arranged in the days before",
      "The Litany of the Sacred Heart of Jesus",
    ],
    whenToPray:
      "Any day; most fitting on a First Friday, on the Solemnity of the Sacred Heart (the Friday after the second Sunday after Pentecost), or during June, the month of the Sacred Heart. The act of consecration of the human race is prayed publicly on the Solemnity of Christ the King.",
    tips: [
      "The devotion is at heart the Eucharist, the Cross and reparation; the images and prayers are ways into that, not ends in themselves.",
      "Keep the consecration simple and daily: the Morning Offering each morning is the whole devotion in a few lines.",
      "A family can make the act together; see the guide to enthroning the Sacred Heart in the home.",
      "The Manual of Indulgences grants a plenary indulgence, under the usual conditions, for the public recitation of the act of dedication of the human race to Jesus Christ the King on that solemnity, and a partial indulgence for praying it devoutly at other times.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Understand the devotion",
        body: "Read Haurietis Aquas, or at least its central teaching: the heart of Jesus is the natural sign of the threefold love of the Word made flesh — divine, spiritual and sensible — and devotion to it is nothing other than devotion to the love of Christ, above all as shown in the Eucharist and on the Cross. The devotion asks for two things: love returned, and reparation for love refused. The First Fridays and the Holy Hour grew from Saint Margaret Mary's revelations; the Church treats those revelations with respect but does not oblige anyone to believe them, and the devotion stands on Scripture and the faith of the Church.",
      },
      {
        order: 2,
        title: "Prepare with prayer and confession",
        body: "Spend a few days, or a novena of nine days, praying the Litany of the Sacred Heart of Jesus and reading the Gospel of Saint John (chapters 13-19 especially). Go to confession before the day of consecration, so that the gift you make is made from a clean heart.",
      },
      {
        order: 3,
        title: "Choose the day",
        body: "Pick a First Friday, the Solemnity of the Sacred Heart, or a day in June. Attend Mass and receive Holy Communion on that day: the consecration is to the Heart of Jesus present in the Eucharist, and it is most naturally made in thanksgiving after Communion or before the Blessed Sacrament.",
      },
      {
        order: 4,
        title: "Pray the Litany of the Sacred Heart",
        body: "Before the image or the Blessed Sacrament, pray the Litany of the Sacred Heart of Jesus, approved for the whole Church under Pope Leo XIII. Its thirty-three invocations — 'Heart of Jesus, Son of the Eternal Father', 'Heart of Jesus, pierced with a lance', 'Heart of Jesus, our peace and reconciliation' — are themselves a summary of what the devotion honours.",
      },
      {
        order: 5,
        title: "Make the act of consecration",
        body: "Pray the Act of Consecration to the Sacred Heart slowly and in full, aloud if you can. Saint Margaret Mary's own act ('I give and consecrate to the Sacred Heart of our Lord Jesus Christ my person and my life...') and the act of Leo XIII ('Most sweet Jesus, Redeemer of the human race...') are both in common use. Then be silent for a few minutes: you have given your heart, and the Lord answers.",
      },
      {
        order: 6,
        title: "Live it: the Morning Offering and the First Fridays",
        body: "Each morning pray the Morning Offering, giving the Heart of Jesus the prayers, works, joys and sufferings of the day. Keep the First Fridays: confession, Mass and Holy Communion in a spirit of reparation, and if possible an hour before the Blessed Sacrament on the Thursday night or the Friday. Renew the act on the Solemnity of the Sacred Heart each year.",
      },
    ],
    relatedPrayers: [
      "litany-of-the-sacred-heart-of-jesus",
      "act-of-consecration-to-the-sacred-heart",
      "morning-offering",
    ],
    relatedDevotions: [
      "devotion-sacred-heart-of-jesus",
      "nine-first-fridays",
      "enthronement-of-the-sacred-heart",
    ],
    relatedSaints: ["saint-margaret-mary-alacoque"],
  }),

  guide({
    slug: "how-to-enthrone-the-sacred-heart-in-your-home",
    title: "How to Enthrone the Sacred Heart in Your Home",
    summary:
      "The family enthronement of the Sacred Heart: choosing and placing the image, inviting a priest or preparing as a family, the blessing, the reading and act of consecration, and keeping the image honoured afterwards.",
    kind: "consecration",
    authorityLevel: "VATICAN",
    citations: [V_HA, V_DPP],
    intro:
      "The Enthronement of the Sacred Heart is the solemn placing of an image of the Sacred Heart in a place of honour in the home and the consecration of the family to him, so that Christ is acknowledged as the King and Friend of the household. It was begun by Father Mateo Crawley-Boevey in 1907 with the blessing of Saint Pius X and spread through the whole Church; Pius XII commends devotion to the Sacred Heart in Haurietis Aquas, and the Directory on Popular Piety lists family consecration to the Sacred Heart — the family dedicated to Christ 'so that he might reign in the hearts of all its members' — among the devotions explicitly approved and recommended by the Apostolic See. It is ideally led by a priest, but where none is available the head of the household leads the family prayer.",
    whatYouNeed: [
      "An image or statue of the Sacred Heart, and a place of honour for it (a shelf, a small table, the main room)",
      "A priest or deacon invited to bless the image and lead the ceremony, or the family's own preparation to lead it",
      "The text of the act of consecration of the family to the Sacred Heart, and the Litany of the Sacred Heart",
      "Candles and flowers for the place of enthronement; a Bible",
      "The whole family present, with any friends who are invited",
    ],
    whenToPray:
      "Any day; often on the Solemnity of the Sacred Heart, on a First Friday, in June, or at a moment of family importance such as moving into a new home.",
    tips: [
      "The image should stand somewhere the family actually lives, not a corridor; the point is that the Lord shares the household's daily life.",
      "Keep the ceremony short enough for children; the meaning is carried by the act of consecration and the blessing, not by length.",
      "If some family members are absent or estranged, name them in the prayers; the enthronement is for the whole family.",
      "Renew the family's consecration each year on the anniversary or on the Solemnity of the Sacred Heart.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Choose the image and the place",
        body: "Choose a worthy image of the Sacred Heart, painted or carved, and decide where it will stand: a place of honour in the room where the family gathers. Prepare the place with a clean cloth, candles and flowers before the ceremony. The image is not yet put in place; it is enthroned during the prayer.",
      },
      {
        order: 2,
        title: "Invite the priest or prepare as a family",
        body: "Ask your parish priest or a deacon to come and bless the image and lead the enthronement; many parishes are glad to do this. If no priest is available, the father or mother of the family leads. Before the day, go to confession as a family if you can, attend Mass and receive Holy Communion, and read through the prayers together so that everyone knows their part.",
      },
      {
        order: 3,
        title: "Gather and bless the image",
        body: "Gather around the prepared place. Begin with the Sign of the Cross. The priest blesses the image with the Church's blessing for sacred images and sprinkles it with holy water; if a lay person leads, the family asks God's blessing on the image in their own words or with a prayer from a family prayer book, since the liturgical blessing is reserved to a priest or deacon. Then the head of the household, or a child, places the image in its place of honour and lights the candles.",
      },
      {
        order: 4,
        title: "Listen to the Word of God",
        body: "Read a short passage of Scripture: Matthew 11:25-30 ('Come to me, all you who labour... learn from me, for I am meek and humble of heart'), John 19:31-37 (the pierced side) or Ephesians 3:14-19 are often used. The priest or the reader may add a few words on what the family is doing.",
      },
      {
        order: 5,
        title: "Pray the act of consecration of the family",
        body: "The head of the household, or the whole family together, prays the act of consecration of the family to the Sacred Heart: acknowledging Jesus as King of the home, asking him to bless the family in its joys and sorrows, remembering absent and departed members, and promising to keep him at the centre of the household. Pray an Our Father, a Hail Mary and a Glory Be for the members of the family who are absent, and the Eternal Rest for those who have died.",
      },
      {
        order: 6,
        title: "Make the family's promises",
        body: "The family promises together to honour the enthroned image, to pray before it, and to make the Sacred Heart the heart of the home. Some families sign a certificate of enthronement and keep it near the image. Many also consecrate the family to the Immaculate Heart of Mary at the same time, with a Hail Mary or the Memorare.",
      },
      {
        order: 7,
        title: "Pray the Litany of the Sacred Heart and receive the blessing",
        body: "Pray the Litany of the Sacred Heart of Jesus together, with one person leading and the family answering 'have mercy on us.' The priest then blesses the family; if a lay person leads, close with a Glory Be and the Sign of the Cross. A hymn to the Sacred Heart and a shared meal afterwards are the traditional way to end.",
      },
      {
        order: 8,
        title: "Keep the image honoured",
        body: "Let the enthroned image become the place of the family's prayer: the evening prayer, the Rosary, grace before meals said facing it. Keep a candle or flowers there on feasts and First Fridays, and renew the family consecration each year on the anniversary. The enthronement is kept alive by the ordinary habit of turning to the Lord in his own house.",
      },
    ],
    relatedPrayers: [
      "litany-of-the-sacred-heart-of-jesus",
      "our-father",
      "hail-mary",
      "glory-be",
      "eternal-rest",
      "memorare",
    ],
    relatedDevotions: ["enthronement-of-the-sacred-heart", "devotion-sacred-heart-of-jesus"],
    relatedSaints: ["saint-margaret-mary-alacoque"],
  }),

  guide({
    slug: "how-to-consecrate-yourself-to-saint-joseph",
    title: "How to Entrust Yourself to Saint Joseph",
    summary:
      "Entrustment to Saint Joseph in the spirit of Redemptoris Custos and Patris Corde: who he is for the Church, preparing over several days, confession, the Litany, the act of entrustment, and keeping Wednesdays and his feasts.",
    kind: "consecration",
    authorityLevel: "VATICAN",
    citations: [V_PC, V_RC],
    intro:
      "Saint Joseph, husband of Mary and guardian of the Redeemer, was declared Patron of the Universal Church by Blessed Pius IX in 1870. Saint John Paul II's Redemptoris Custos (1989) presents him as the man who lived the mystery of the Incarnation from the inside, and Pope Francis, proclaiming a Year of Saint Joseph in Patris Corde (2020), invited the whole Church to entrust itself to him 'with a father's heart.' To entrust yourself to Saint Joseph is to place your life, your work and your family under his fatherly protection, as Jesus and Mary did at Nazareth, and to learn from him obedience, silence and creative courage. The word 'consecration' is often used for this; strictly, the Church consecrates to God alone, and entrustment is the exact term.",
    whatYouNeed: [
      "An image of Saint Joseph, or a church with his altar or statue",
      "The Litany of Saint Joseph and the prayer 'To you, O blessed Joseph'",
      "The text of an act of entrustment to Saint Joseph",
      "Several days set aside for preparation, and confession arranged",
    ],
    whenToPray:
      "Most fitting on the Solemnity of Saint Joseph (19 March) or the memorial of Saint Joseph the Worker (1 May); Wednesday is his traditional day, and March is his month.",
    tips: [
      "Several published 33-day preparations for entrustment to Saint Joseph exist; they are a good help, but the Church prescribes no particular program, and a novena and a good confession are enough.",
      "Entrustment to Saint Joseph does not compete with Marian consecration; he and Mary were one household, and devotion to him leads to her and to Jesus.",
      "Give Saint Joseph your work in particular: he is the patron of workers, and most of life is work.",
      "Ask him for a happy death, of which he is the patron, and pray to him for the dying.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Come to know who Saint Joseph is for the Church",
        body: "Read Redemptoris Custos and Patris Corde, or at least the Gospel passages about Joseph (Matthew 1:18-25 and 2:13-23; Luke 2:1-52). Pope Francis names him a beloved, tender and loving, obedient, accepting, creatively courageous, working father, and a father in the shadow. Entrustment begins with knowing the man you are entrusting yourself to: a just man who said nothing in Scripture and did everything he was asked.",
      },
      {
        order: 2,
        title: "Prepare over several days",
        body: "Set aside several days, or a novena of nine, before the day of entrustment. Each day pray the Litany of Saint Joseph, read one passage on him, and bring one area of your life — your work, your family, your fears, your purity — to him in a few words of your own. Pray the Memorare too, asking Mary to bring you to her husband.",
      },
      {
        order: 3,
        title: "Go to confession",
        body: "Go to confession before the day of entrustment, and on the day attend Mass and receive Holy Communion. Saint Joseph guarded the Body of Christ at Nazareth; the entrustment is made most naturally in thanksgiving after receiving that same Body in the Eucharist.",
      },
      {
        order: 4,
        title: "Pray the Litany of Saint Joseph",
        body: "Before his image or altar, pray the Litany of Saint Joseph, approved for public use by Saint Pius X in 1909 and enlarged with new invocations by the Holy See in 2021: 'Guardian of the Redeemer', 'Servant of Christ', 'Minister of salvation', 'Support in difficulties', 'Patron of exiles, of the afflicted, of the poor.'",
      },
      {
        order: 5,
        title: "Make the act of entrustment",
        body: "Pray the act of entrustment slowly and in full: give Saint Joseph your person, your work, your family and your death, and ask him to be for you what he was for Jesus and Mary. Then pray the prayer 'To you, O blessed Joseph, we have recourse in our affliction', which Leo XIII gave the whole Church in 1889 to be added to the Rosary in October; Pope Francis closes Patris Corde with his own prayer to Saint Joseph, 'Hail, Guardian of the Redeemer', which may be prayed as well.",
      },
      {
        order: 6,
        title: "Keep Wednesdays and his feasts",
        body: "Wednesday is Saint Joseph's traditional day: pray his Litany or his prayer then, and go to Mass on Wednesday when you can. Keep the Solemnity of Saint Joseph on 19 March and the memorial of Saint Joseph the Worker on 1 May as family feasts, renew the entrustment on one of them each year, and turn to him in the ordinary way — before work, in worry, at bedtime — as a child turns to a father.",
      },
    ],
    relatedPrayers: ["litany-of-saint-joseph", "memorare", "prayer-to-saint-joseph"],
    relatedDevotions: ["devotion-to-saint-joseph"],
    relatedSaints: ["saint-joseph", "saint-teresa-of-avila", "saint-andre-bessette"],
  }),

  guide({
    slug: "how-to-consecrate-yourself-to-the-immaculate-heart-of-mary",
    title: "How to Consecrate Yourself to the Immaculate Heart of Mary",
    summary:
      "Consecration to the Immaculate Heart in the form the Fatima message asks for: the request itself, preparation with confession, the act, the five First Saturdays, the daily Rosary and renewal on Marian feasts.",
    kind: "consecration",
    authorityLevel: "VATICAN",
    citations: [V_DPP, V_RVM],
    intro:
      "Devotion to the Immaculate Heart of Mary honours the interior life of the Mother of God: her love for her Son and for us, her sorrow, and her purity of heart. It has deep roots in the tradition, and it became a request of the Church's own life at Fatima in 1917, when Our Lady told the children that God wished to establish devotion to her Immaculate Heart in the world and asked for consecration to it and for Communion of reparation on the First Saturdays. Pius XII consecrated the world to the Immaculate Heart in 1942, Saint John Paul II renewed the consecration in union with the world's bishops on 25 March 1984, and Pope Francis consecrated Russia and Ukraine to it on 25 March 2022. To consecrate yourself to the Immaculate Heart is to take refuge in Mary's heart and to be led by it to the Heart of her Son.",
    whatYouNeed: [
      "An image of the Immaculate Heart, or of Our Lady of Fatima",
      "The text of an act of consecration to the Immaculate Heart of Mary",
      "A rosary, and the intention to pray it daily",
      "Confession arranged in the days before",
    ],
    whenToPray:
      "Any Marian feast; most fitting on the memorial of the Immaculate Heart of Mary (the Saturday after the Solemnity of the Sacred Heart), on a First Saturday, on 13 May (Our Lady of Fatima) or 13 October, or on 8 December.",
    tips: [
      "The Fatima message is a private revelation the Church has judged worthy of belief; the consecration rests on the Church's ancient devotion to Mary's Heart, not on believing every detail.",
      "The First Saturdays are the practical form of this consecration: keep the five, and then keep them as a habit.",
      "The consecration to the Immaculate Heart and the Montfort consecration are the same self-gift to Jesus through Mary in two forms; you do not need both, but nothing prevents you from making both.",
      "Sub Tuum Praesidium, the oldest known prayer to Mary, is a two-line renewal of the consecration you can say anywhere.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Understand the request of Fatima",
        body: "At Fatima on 13 June 1917 Our Lady told Lucia that Jesus wished to establish devotion to her Immaculate Heart in the world and that this Heart would be her refuge and the way that leads to God; on 13 July she asked for the consecration of Russia and the Communion of reparation on the First Saturdays, and in 1925 at Pontevedra she set out the First Saturday devotion in detail. The Church's own devotion to the Immaculate Heart is older and rests on the Gospel: Mary 'kept all these things, pondering them in her heart' (Luke 2:19), and a sword pierced her soul (Luke 2:35).",
      },
      {
        order: 2,
        title: "Prepare with confession and prayer",
        body: "Spend several days, or a novena, before the day of consecration praying the Rosary and the Litany of the Blessed Virgin Mary and reading the Gospel passages about Mary. Go to confession in the days before, so that the heart you give her is clean, and on the day attend Mass and receive Holy Communion.",
      },
      {
        order: 3,
        title: "Pray the act of consecration",
        body: "Before an image of the Immaculate Heart, at home or in church, pray an act of consecration to the Immaculate Heart of Mary slowly and in full, aloud if you can. Several approved texts are in use; any of them makes the same gift — your heart, your life and your loved ones placed in her Heart to be brought to Jesus. Finish with the Hail, Holy Queen (Salve Regina) and the Sub Tuum Praesidium: 'We fly to thy protection, O holy Mother of God.'",
      },
      {
        order: 4,
        title: "Make the five First Saturdays",
        body: "On the first Saturday of five consecutive months, in reparation to the Immaculate Heart: go to confession (within about a week before or after), receive Holy Communion, pray five decades of the Rosary, and keep Mary company for fifteen minutes meditating on the mysteries of the Rosary. This is the devotion asked for at Pontevedra, and it is the ordinary way of living the consecration.",
      },
      {
        order: 5,
        title: "Pray the Rosary daily",
        body: "Our Lady asked at every Fatima apparition for the daily Rosary. Pray it, or at least a decade, every day, with the Fatima Prayer after each Glory Be: 'O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of Thy mercy.' Saint John Paul II's Rosarium Virginis Mariae is the Church's fullest guide to praying it well.",
      },
      {
        order: 6,
        title: "Renew the consecration on Marian feasts",
        body: "Renew the act each year on the memorial of the Immaculate Heart and on any Marian feast you keep, especially 13 May and 8 December, and renew it briefly every day with the Sub Tuum Praesidium or a Hail Mary. Offer the small sacrifices of the day in reparation, as the children of Fatima did, and wear the Brown Scapular or the Miraculous Medal if you wish as a sign of belonging to her.",
      },
    ],
    relatedPrayers: [
      "litany-of-the-blessed-virgin-mary",
      "hail-mary",
      "salve-regina",
      "sub-tuum-praesidium",
      "fatima-prayer",
    ],
    relatedDevotions: [
      "devotion-immaculate-heart-of-mary",
      "five-first-saturdays",
      "holy-rosary",
      "brown-scapular",
      "miraculous-medal",
    ],
    relatedSaints: ["saint-john-paul-ii", "saint-louis-de-montfort"],
  }),

  // ────────────────────────── F. DISCERNMENT ──────────────────────────
  guide({
    slug: "how-to-discern-gods-will-in-a-major-decision",
    title: "How to Discern God's Will in a Major Decision",
    summary:
      "A practical Catholic discernment for a big decision: prayer for openness, the facts, the options, counsel, the rules of Saint Ignatius on consolation and desolation, a provisional decision, confirmation in peace, and acting in trust.",
    kind: "discernment",
    authorityLevel: "VATICAN",
    citations: [V_CCC_BATTLE, V_EG],
    intro:
      "Discernment is the art of finding what God wants in a concrete situation where more than one good is possible — a job, a move, a relationship, a commitment. The Church's most tested method is that of Saint Ignatius of Loyola in the Spiritual Exercises: a decision is made in prayer, with the facts in hand, by weighing the movements of consolation and desolation in the heart and then confirming the choice in peace. The Catechism reminds us that prayer is a battle, and that dryness and distraction are part of it; Pope Francis in Evangelii Gaudium asks for 'an evangelical discernment', the approach of a missionary disciple nourished by the light and strength of the Holy Spirit, rather than a merely clinical method. God does not usually shout; he draws.",
    whatYouNeed: [
      "A decision that is real and yours to make, with a deadline you know",
      "Time set aside for prayer over days or weeks, not a single evening",
      "A notebook for facts, options and the movements you notice in prayer",
      "A wise person to consult: a spiritual director, a priest, or a mature friend in the faith",
    ],
    whenToPray:
      "Daily, for as long as the decision takes; each session begins with a prayer to the Holy Spirit and ends with a brief examen of what moved in you.",
    tips: [
      "Do not discern between good and evil; that is not discernment but obedience. Discernment is for choosing among goods.",
      "Ignatius's first rule for hard times: never make a change in desolation. Wait for the light you had before it came.",
      "Beware of discerning what you have already decided. Ask for indifference — the freedom to want only what God wants — before you ask for an answer.",
      "Most decisions are confirmed not by a sign but by a quiet, lasting peace that survives being looked at.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Pray for openness",
        body: "Begin every session with the Veni Creator Spiritus or the Prayer to the Holy Spirit, asking not for the answer but for freedom: the 'indifference' Saint Ignatius describes, in which you are ready for either outcome so long as it is God's will. Name honestly which way you are leaning and what you are afraid of, and hand both over. Without this step you will hear your own voice and call it God's.",
      },
      {
        order: 2,
        title: "Gather the facts",
        body: "Grace builds on nature, and God rarely asks us to decide in ignorance. Find out what you need to know: the real conditions of the job, the community, the person, the cost; the obligations you already carry; the time you actually have. Write the facts down plainly. A decision made on wishful thinking is not a discerned one.",
      },
      {
        order: 3,
        title: "Name the options clearly",
        body: "Write out the real options, usually two or three, in a single sentence each, and check that none of them involves sin or breaks a commitment you have already made before God — those are not options. Ignatius suggests, for the calm-minded, listing the advantages and disadvantages of each purely for the glory of God and the good of your soul, and noticing which way reason inclines.",
      },
      {
        order: 4,
        title: "Consult a wise person",
        body: "Lay the whole thing before someone who knows you and the faith and has no stake in the outcome: a spiritual director if you have one, a priest, a religious, a wise friend. Tell them the facts, the options, and what you notice in prayer. The Church has always taught that we see ourselves poorly alone; counsel is a gift of the Holy Spirit, not a sign of weakness.",
      },
      {
        order: 5,
        title: "Weigh the movements: consolation and desolation",
        body: "Over days of prayer, place yourself before each option in turn and notice what happens in you. Consolation, in Ignatius's sense, is an increase of faith, hope and love, a quiet peace and a drawing toward God; desolation is darkness, disquiet, a pull toward the low and earthly, a loss of trust. Ask which option, held before God, brings the consolation that lasts, and be suspicious of an excitement that fades or a peace that comes only from escaping something hard. Take notes each day; patterns appear over a week that a single evening hides.",
      },
      {
        order: 6,
        title: "Decide provisionally",
        body: "When reason and the movements of the heart point the same way, make the decision provisionally, in prayer, and offer it to God. Ignatius suggests three tests for a calm-minded choice: what you would advise a stranger in your position; what you would wish to have chosen on your deathbed; what you would wish to have chosen on the day of judgment. If they agree with the choice, you are probably right.",
      },
      {
        order: 7,
        title: "Seek confirmation in peace",
        body: "Live with the provisional decision for some days without announcing it. Bring it to Mass, receive Holy Communion with it in mind, and watch: if the peace deepens and holds, the decision is confirmed; if it curdles into unease that will not go away, return to the weighing. Confirmation is usually not a sign but a settled peace that survives scrutiny and the opinions of others.",
      },
      {
        order: 8,
        title: "Act and trust",
        body: "Then act, promptly and without endless re-opening. A discerned decision is not a guarantee that everything will go well; it is a decision made with God, and he stays with it. If it later becomes clear that you were mistaken, that too is material for a new discernment, not proof that the first one was foolish. Close with the Our Father: 'Thy will be done.'",
      },
    ],
    relatedPrayers: ["veni-creator-spiritus", "prayer-to-the-holy-spirit", "our-father"],
    relatedPractices: ["discernment-of-spirits", "ignatian-examen", "spiritual-direction"],
    relatedSaints: ["saint-ignatius-of-loyola"],
  }),

  guide({
    slug: "how-to-make-a-retreat",
    title: "How to Make a Retreat",
    summary:
      "Preparing for, making and returning from a retreat: choosing the kind, setting an intention, arriving and going silent, following the rhythm of Mass and prayer, meeting the director, confession, resolutions, and a gentle return home.",
    kind: "discernment",
    authorityLevel: "VATICAN",
    citations: [V_NMI, V_CCC_PRAYER],
    intro:
      "A retreat is time deliberately taken away from ordinary life to be alone with God: a day, a weekend, a week, or the full thirty days of the Spiritual Exercises. Jesus himself went apart to a deserted place to pray, and the Church has always sent her people after him. Priests and religious are bound by canon law to make one regularly; the laity are simply, warmly, invited. Saint John Paul II in Novo Millennio Ineunte asked that our parishes and communities become 'genuine schools of prayer', and the Catechism describes the three great expressions of prayer — vocal, meditative, contemplative — that a retreat gives room to. A retreat is not a course to pass; it is a place where God can speak because, for once, you are listening.",
    whatYouNeed: [
      "A retreat booked: at a retreat house, a monastery, or a parish program",
      "A Bible, a notebook and a rosary",
      "Simple clothes, and whatever the house asks you to bring",
      "Arrangements at home and work so that you can actually be absent",
      "A question or intention to bring, or simply the desire to be with God",
    ],
    whenToPray:
      "Once a year if you can, as many religious communities require of their members; Advent and Lent are natural seasons, and a retreat is the traditional way to prepare for a big decision, a sacrament, or a consecration.",
    tips: [
      "Silence is the main event. Everything else on the retreat exists to let it happen.",
      "Do not measure the retreat by feelings; dryness in prayer, the Catechism says, is often where the real work is done.",
      "Sleep. Most people arrive exhausted, and God is not offended by rest.",
      "Take away one or two resolutions, not ten; the ones you keep are the ones the retreat was for.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Choose the kind of retreat",
        body: "Decide what you need and what you can give. A preached retreat has talks and a shared timetable; a directed retreat (in the Ignatian tradition) is silent, with a daily meeting with a director who gives you Scripture to pray; a private retreat at a monastery follows the monks' Hours with no program; parish weekends and movements such as Cursillo are more communal. Beginners are usually best served by a preached or directed retreat of two to five days. Ask your parish or diocese for retreat houses; most monasteries also receive guests.",
      },
      {
        order: 2,
        title: "Prepare your intention",
        body: "In the week before, ask yourself what you are bringing: a decision to discern, a grief, a dryness in prayer, a wish to begin again, or simply the desire to be with God. Write it in one sentence in your notebook and pray the Veni Creator Spiritus for it each day. Go to confession beforehand if you can, so that the retreat begins clean; if not, plan to go during it.",
      },
      {
        order: 3,
        title: "Arrive and put the phone away",
        body: "Arrive on time, settle your room, and then switch the phone off and put it out of reach for the duration, having told the people who need to know how to reach the house in an emergency. Leave the news, the email and the podcasts at the door. The first hours often feel empty or restless; that is withdrawal, not failure, and it passes.",
      },
      {
        order: 4,
        title: "Follow the rhythm: Mass, prayer, silence",
        body: "Keep the house's timetable faithfully: daily Mass, the Liturgy of the Hours if it is prayed, the talks or director's meetings, meals in silence. Between them give yourself set times of prayer — an hour with Scripture in the morning, the Rosary or Stations in the afternoon, time before the Blessed Sacrament — and walk outside. Read little; pray much. The Catechism's three forms of prayer are all welcome: vocal prayer to steady you, meditation on a Gospel scene, and simple silent attention to God, which is contemplation.",
      },
      {
        order: 5,
        title: "Meet the director",
        body: "If the retreat has a director, meet him or her honestly: say what is happening in your prayer, including nothing, and what is stirring in you, including what embarrasses you. The director's task is to help you notice where God is at work and to give you the next passage to pray, not to solve your life. If there is no director, use the notebook each evening: what did I pray, what moved, what do I want tomorrow?",
      },
      {
        order: 6,
        title: "Go to confession",
        body: "Make a good confession during the retreat; nearly every retreat house makes a priest available. Use the quiet to make a thorough examination of conscience, perhaps over a whole life if it has been long since your last serious one. Confession in the middle of a retreat is often its turning point: what follows is lighter.",
      },
      {
        order: 7,
        title: "Make resolutions",
        body: "On the last day, before the Blessed Sacrament if possible, ask what God has been saying and write down one or two concrete resolutions — a daily time of prayer, a reconciliation to make, a habit to drop, a decision taken. Pray the Anima Christi, offering them to Christ, and give thanks with the Te Deum or a Glory Be. Keep the resolutions few and specific enough to check.",
      },
      {
        order: 8,
        title: "Return home gently",
        body: "Go home slowly: do not turn the phone on until you leave the grounds, and if you can, keep the first evening quiet. Tell the people at home something of what happened, and put the first resolution into practice the next morning. The grace of a retreat is meant for ordinary life; a short daily prayer and a monthly look at your notebook will keep it there.",
      },
    ],
    relatedPrayers: ["veni-creator-spiritus", "anima-christi", "te-deum", "glory-be"],
    relatedPractices: ["spiritual-direction", "lectio-divina", "contemplative-prayer"],
    relatedSaints: ["saint-ignatius-of-loyola", "saint-benedict-of-nursia"],
  }),

  guide({
    slug: "how-to-find-a-spiritual-director",
    title: "How to Find a Spiritual Director",
    summary:
      "What spiritual direction is and is not, how to find a director through your pastor or a religious community, what the first meeting is like, how often to meet, what to bring, and when it is right to change.",
    kind: "discernment",
    authorityLevel: "VATICAN",
    citations: [V_PDV, V_CCC_BATTLE],
    intro:
      "Spiritual direction is a regular conversation with an experienced Christian whose task is to help you notice and respond to what God is doing in your life. The Catechism says the Holy Spirit gives some of the faithful gifts of wisdom and discernment for the sake of others' prayer, and Saint John Paul II in Pastores Dabo Vobis calls direction indispensable for those in formation for the priesthood; the saints — Teresa of Avila, Francis de Sales, Thérèse — all had and gave it. It is not therapy, not confession, and not obedience to a guru; the director accompanies, and you decide. Most lay Catholics never have a director, and would be helped by one.",
    whatYouNeed: [
      "A regular prayer life, however small — direction accompanies prayer, it does not replace it",
      "The willingness to speak honestly about your interior life to another person",
      "A notebook to jot what you notice in prayer between meetings",
      "Patience: finding the right director can take a few tries",
    ],
    whenToPray:
      "Meetings are usually monthly, for about an hour; ask the Holy Spirit's guidance before each one.",
    tips: [
      "A director need not be a priest. Religious sisters and brothers and trained lay people give excellent direction; what matters is prayer, prudence and experience.",
      "Keep direction and confession distinct even when your director is a priest; you may confess to him, but the direction conversation is not under the seal and should not become a confession by stealth.",
      "Do not look for someone who will tell you what to do. Look for someone who will help you hear what God is telling you.",
      "If your parish has no one, try a retreat house, a monastery, a religious order's house, or the diocesan office for spirituality or vocations.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Know what direction is and is not",
        body: "Direction is about your relationship with God: how you pray, what you notice, where you resist, what he seems to be asking. It is not counselling for problems, though problems come up; not confession, though sin comes up; and not a substitute for your own conscience and decisions. A good director listens more than talks, asks about your prayer, helps you discern the spirits, and suggests Scripture and practices — and refers you to a doctor or counsellor when that is what you need.",
      },
      {
        order: 2,
        title: "Ask your pastor or a religious community",
        body: "Start by asking your parish priest, either to direct you himself or to recommend someone. Then ask at retreat houses, monasteries, and the houses of religious orders in your area; Jesuits, Carmelites, Benedictines and many congregations of sisters have a long tradition of direction, and many dioceses keep a list of trained directors. Programs that train lay directors usually have graduates available. Pray the Prayer to the Holy Spirit while you look: the right director is something you ask for, not only search for.",
      },
      {
        order: 3,
        title: "The first meeting",
        body: "Treat the first meeting as mutual discernment, and say so. Tell your story briefly: your life, your faith, how you pray, why you want direction now. Ask about the director's approach, training and availability. Notice afterwards whether you felt heard and whether you were drawn to prayer. It is entirely normal, and no offence, to meet two or three people before settling.",
      },
      {
        order: 4,
        title: "How often to meet",
        body: "Monthly is the usual rhythm, for forty-five minutes to an hour; some meet every six weeks. More often than that is rarely helpful outside a retreat or a crisis, and less often loses the thread. Fix the next date at the end of each meeting. Many directors ask for no fee; where a donation or a fee is customary, it is right to give it.",
      },
      {
        order: 5,
        title: "What to bring",
        body: "Bring your prayer: what you have been praying with, what happened, what was dry, what moved you, what you avoided. Bring the events of the month that touched your relationship with God, the decisions ahead, and the resolutions from last time. Bring your notebook. Do not prepare a performance; the meeting works when you say what is true, including 'nothing much is happening', which is often where the most is happening.",
      },
      {
        order: 6,
        title: "When to change directors",
        body: "Direction can end or change without drama. Change when the director moves or can no longer meet, when you have gone as far together as you can, when your circumstances change (a vocation, a marriage, a new stage of prayer), or when you find you cannot be honest with this person. Do not change simply because the director says something hard; that is often the moment direction is doing its work. Say thank you, and begin again with step two.",
      },
    ],
    relatedPrayers: ["prayer-to-the-holy-spirit", "our-father"],
    relatedPractices: ["spiritual-direction", "discernment-of-spirits", "ignatian-examen"],
    relatedSaints: ["saint-francis-de-sales", "saint-teresa-of-avila", "saint-ignatius-of-loyola"],
  }),

  guide({
    slug: "how-to-discern-a-call-to-marriage",
    title: "How to Discern a Call to Marriage",
    summary:
      "Discerning marriage as a vocation, not only a relationship: praying alone and together, knowing the person and the faith, talking about children, faith and money, seeking counsel, chastity in courtship, and deciding to begin preparation.",
    kind: "discernment",
    authorityLevel: "VATICAN",
    citations: [V_AL, U_MFL],
    intro:
      "The Church calls marriage a vocation: a way in which God calls most Christians to holiness, and a sacrament in which the love of Christ for his Church becomes present in the love of a husband and wife. Discerning it is therefore more than deciding whether you are in love. Pope Francis in Amoris Laetitia devotes a section to preparing engaged couples and insists that the sacrament of marriage is not a social convention or an empty ritual but a vocation to be prepared for with the same seriousness as any other; Saint John Paul II in Familiaris Consortio described the stages of remote, proximate and immediate preparation. This guide is for a person, or a couple, asking whether God is calling them to marry — and to marry this person.",
    whatYouNeed: [
      "A relationship that is real, exclusive, and serious enough that the question of marriage is genuinely on the table",
      "Daily prayer, alone and, when possible, together",
      "Honesty with each other about faith, children, money, family and the past",
      "A priest, a married couple you trust, or a spiritual director to talk to",
    ],
    whenToPray:
      "Daily during the courtship; a shared prayer — an Our Father and a Hail Mary — at the end of time spent together is a simple beginning.",
    tips: [
      "You are not discerning whether the other person is perfect but whether God is calling the two of you to become one in him.",
      "Most dioceses ask couples to contact the parish six months to a year before a wedding date; discernment should be done before you book the hall.",
      "Peace, not intensity, is the mark of a discerned decision. If you cannot bring the relationship into prayer, ask why.",
      "If either of you has been married before, speak to a priest early; the Church will need to establish that you are free to marry.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Understand marriage as a vocation",
        body: "Read what the Church teaches: marriage is a lifelong, faithful, exclusive covenant between a man and a woman, open to children, and for the baptised a sacrament that gives grace to live it. It is a call to lay down your life for another every day. Ask yourself first whether you want that — a whole life given, not a partnership of convenience — before asking whether you want it with this person. Amoris Laetitia's chapter on love in marriage, built on Saint Paul's hymn to charity (1 Corinthians 13), is the best short reading.",
      },
      {
        order: 2,
        title: "Pray about it, alone and together",
        body: "Bring the relationship into your daily prayer: thank God for the person, ask honestly whether this is his will, and pray the Prayer to the Holy Spirit for light. Go to Mass together, and begin to pray together, simply — an Our Father and a Hail Mary, or a decade of the Rosary. A couple who cannot pray together will find it hard to raise children who do.",
      },
      {
        order: 3,
        title: "Know the person, and know the faith you share",
        body: "Take time. See each other in ordinary life, in the other's family, under stress, with money, with children, in disagreement. Talk about faith directly: whether you both believe, whether you will practise, what you expect of each other. If one of you is not Catholic, the Church permits such a marriage, but the Catholic must promise to do all in their power to have the children baptised and raised Catholic, and the other must know it; that conversation belongs to discernment, not to the wedding rehearsal.",
      },
      {
        order: 4,
        title: "Talk about children, faith and money",
        body: "Speak plainly about the things marriages founder on. Children: that you are open to them, how many you hope for, and that you will not use contraception but will learn natural family planning if you need to space births. Faith: the practice of it in the home. Money: debts, habits, work, generosity, who decides. Family: how much of it, and whose. If you cannot have these conversations now, you are not ready to marry; if you can, you are discovering whether you can be one.",
      },
      {
        order: 5,
        title: "Seek counsel",
        body: "Talk to a priest about the relationship, and ask a married couple whose marriage you admire to speak honestly with you both. Your parents, if they are wise, know things about you that you do not. Many parishes offer marriage preparation inventories that surface differences early; use them as tools of discernment, not hurdles. Listen especially to concerns you would rather not hear.",
      },
      {
        order: 6,
        title: "Live chastely during the courtship",
        body: "The Church asks engaged couples to reserve sexual intimacy for marriage, and not as a rule imposed from outside: chastity in courtship keeps your judgement free, lets you learn each other as persons rather than as bodies, and is the first practice of the fidelity you are discerning. If you are living together, speak to a priest about it honestly; it is not a barrier to marriage but it is a matter for confession and for a decision. Go to confession together in the months before the wedding.",
      },
      {
        order: 7,
        title: "Decide, and begin preparation",
        body: "When prayer, knowledge, counsel and peace agree, decide: propose, or accept. Then go to the parish promptly to begin marriage preparation — most dioceses ask for six months to a year — which will include meetings with the priest or deacon, a preparation program, natural family planning instruction where offered, and the gathering of baptismal and freedom-to-marry records. Keep praying together through the engagement; the discernment continues until the vows, and the vocation begins with them.",
      },
    ],
    relatedPrayers: ["prayer-to-the-holy-spirit", "our-father", "hail-mary"],
    relatedPractices: ["spiritual-direction", "discernment-of-spirits"],
    relatedSaints: ["saint-joseph", "saint-gianna-molla"],
  }),

  // ─────────────────────────── G. VOCATION ───────────────────────────
  guide({
    slug: "discerning-religious-vocation",
    title: "Discerning a Religious Vocation",
    summary:
      "Discerning a call to consecrated life: what it is, the signs of a call, prayer and the sacraments, talking to a vocation director, visiting communities, the 'come and see', and the stages of formation from application to final vows.",
    kind: "vocation",
    authorityLevel: "VATICAN",
    citations: [V_VC, U_VOC],
    intro:
      "Religious life is the public profession of the evangelical counsels of poverty, chastity and obedience in a community approved by the Church: monks and nuns, friars and sisters, missionaries and contemplatives. Saint John Paul II's Vita Consecrata calls it 'a gift of God the Father to his Church through the Holy Spirit', and a living sign of the world to come. A call to it is not a feeling of unworthiness or a flight from the world; it is an attraction, tested over time, to give one's whole life to Christ in this way. This guide walks through how that testing is done, in the way the Church and religious communities actually do it.",
    whatYouNeed: [
      "A regular life of prayer and the sacraments — Sunday Mass at least, confession regularly, and daily prayer",
      "The freedom to consider it: no marriage bond, no debts or dependants you cannot honestly leave",
      "A spiritual director or a priest you can talk to",
      "Patience: discernment and formation together take years, and the Church wants it so",
    ],
    whenToPray:
      "Daily, for as long as the question is alive; a weekly holy hour and the Veni Creator Spiritus are the traditional prayers of someone discerning a vocation.",
    tips: [
      "You do not have to be certain before you contact a community; that is what the visits and the 'come and see' are for.",
      "There are many kinds of religious life. Not being drawn to one community is not a sign that you have no vocation.",
      "The Church discerns with you: the community's decision to admit you is part of the call, and its decision not to is not a judgement on your holiness.",
      "Tell your family gently and early; their reaction, whatever it is, is something to bring to prayer rather than a verdict.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Learn what consecrated life is",
        body: "Read Vita Consecrata, or at least its opening chapters, and learn the main forms: monastic life (Benedictines, Cistercians, Carthusians), the mendicant orders (Franciscans, Dominicans, Carmelites, Augustinians), apostolic congregations devoted to teaching, nursing and the missions, and contemplative nuns and monks who live in enclosure. All profess poverty, chastity and obedience; they differ in prayer, work and the shape of community. Knowing the range helps you notice where you are drawn.",
      },
      {
        order: 2,
        title: "Notice the signs of a call",
        body: "The ordinary signs the Church looks for are these: a lasting attraction to the life that survives being examined; a desire for God and for prayer; the capacity to live in community and in obedience; good physical and psychological health; sound judgement and a generous heart; and a peace that grows when you imagine the life rather than a dread. The absence of a signed letter from heaven is not a sign against. Neither guilt, escape from a difficult situation, nor the wishes of others is a sign for.",
      },
      {
        order: 3,
        title: "Pray, and receive the sacraments",
        body: "Discernment is done in prayer or not at all. Go to daily Mass when you can, confess monthly, and give a fixed time each day to prayer with Scripture — the calls of the disciples (Mark 1:16-20, John 1:35-51), the rich young man (Mark 10:17-31), Mary's Magnificat. Pray the Veni Creator Spiritus and the Prayer for Vocations for your own vocation. Find a spiritual director if you do not have one; nearly every community will ask whether you have.",
      },
      {
        order: 4,
        title: "Talk to a vocation director",
        body: "Every diocese has a vocation office, and every religious community a vocation director whose whole task is to talk to people like you, without pressure. Contact one or more: tell them your story, your attraction and your doubts. They will suggest communities to look at, retreats to make, and reading. The USCCB's vocations pages and the diocesan website are the usual starting points.",
      },
      {
        order: 5,
        title: "Visit communities",
        body: "Visit two or three communities that draw you, for a day or a weekend: pray with them, eat with them, watch how they live and treat one another. Notice what happens in your prayer during and after. Ask about their charism, their prayer, their work, their formation, and their expectations of candidates. A community should be honest with you about itself; you should be honest with it.",
      },
      {
        order: 6,
        title: "Make a 'come and see' and a discernment retreat",
        body: "Most communities offer a longer live-in, often called a 'come and see', of a week to a month, in which you follow the community's timetable as a guest. Make one with the community you are most drawn to, and make a directed retreat, ideally with a director who knows religious life. Bring what you find to your spiritual director. This is the stage at which many discover a clear yes — or a clear and peaceful no, which is also a fruit of discernment.",
      },
      {
        order: 7,
        title: "Apply, and enter formation",
        body: "If you and the community agree, apply. The application usually includes a personal history, references, medical and psychological evaluations, and interviews; the community then decides whether to admit you. Formation has stages set by canon law and the community's own rule: a period of candidacy or postulancy (often six months to two years) living with the community; the novitiate, which canon law requires to last at least twelve months, ending in first, temporary vows; several years in temporary vows (canon law sets not less than three and not more than six before perpetual profession, extendable to nine); and finally perpetual profession. At every stage both you and the community remain free.",
      },
      {
        order: 8,
        title: "Trust the process, whatever the outcome",
        body: "Discernment that ends in leaving a community, or in not entering, is not a failure; it is how the Church discerns. If you leave, you carry the prayer and formation with you into whatever God calls you to next. If you stay, the vows will be the freest act of your life. Pray the Magnificat either way: 'He who is mighty has done great things for me.'",
      },
    ],
    relatedPrayers: [
      "veni-creator-spiritus",
      "prayer-for-vocations",
      "prayer-to-the-holy-spirit",
      "magnificat",
    ],
    relatedPractices: ["spiritual-direction", "discernment-of-spirits"],
    relatedSaints: [
      "saint-therese-of-lisieux",
      "saint-benedict-of-nursia",
      "saint-clare-of-assisi",
      "saint-francis-of-assisi",
    ],
  }),

  guide({
    slug: "how-to-discern-a-call-to-the-priesthood",
    title: "How to Discern a Call to the Priesthood",
    summary:
      "Diocesan and religious priesthood: what a priest is, the signs of a call, daily prayer and Mass, contacting the vocation office, discernment groups and retreats, application, the stages of seminary formation, and ordination.",
    kind: "vocation",
    sacramentKey: "holy_orders",
    authorityLevel: "VATICAN",
    citations: [V_PDV, U_VOC],
    intro:
      "A priest is a baptised man configured by the sacrament of Holy Orders to Christ the Head and Shepherd, so as to preach the Gospel, celebrate the Eucharist and the other sacraments, and shepherd the People of God. Saint John Paul II's Pastores Dabo Vobis (1992) remains the Church's charter for priestly vocation and formation, and its four dimensions — human, spiritual, intellectual and pastoral — shape every seminary today. A diocesan priest serves the parishes of a particular diocese under its bishop; a religious priest belongs to an order and lives its rule as well. Discerning the call is done with the Church, over years, and the Church is glad of every man who asks the question honestly.",
    whatYouNeed: [
      "A regular life of prayer and the sacraments: Sunday and, if possible, daily Mass, regular confession, daily prayer",
      "Reasonable health, the capacity for study, and the freedom to consider it (an unmarried, baptised and confirmed Catholic man)",
      "A spiritual director or a priest you trust",
      "Contact with the diocesan vocation office or a religious community's vocation director",
    ],
    whenToPray:
      "Daily; a weekly holy hour for your own vocation, and Mass as often as you can, are the ordinary prayer of a man discerning priesthood.",
    tips: [
      "Feeling unworthy is not a sign against a vocation; every priest has felt it. Feeling that you would be good at it is not a sign for one either. Look for a steady drawing and a peace in prayer.",
      "The seminary is a place of discernment, not a commitment to ordination; entering it does not mean you must be ordained, and a man who leaves has not failed.",
      "Converts and men returning to the faith are usually asked to live the faith for a few years before applying; use the time well.",
      "Talk to priests, several of them, about their lives; the priesthood is best discerned in the company of priests.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Understand what a priest is",
        body: "Read Pastores Dabo Vobis, especially its chapters on the nature of the priesthood and on formation, and the Catechism on Holy Orders. The priest acts in the person of Christ the Head; his life is the Eucharist, the Word, and the care of souls, lived in celibacy for the sake of the Kingdom and in obedience to his bishop or superior. Learn the difference between diocesan and religious priesthood, and notice which draws you: the parish and the diocese, or a particular community's rule and charism.",
      },
      {
        order: 2,
        title: "Notice the signs of a call",
        body: "The Church looks for right intention (the desire to serve God and his people, not status or refuge); a life of faith and prayer; human maturity — the ability to relate well, to be honest, to live celibacy freely; adequate health and intelligence; and a lasting attraction to the priestly life that grows in prayer and brings peace. Often the first sign is simply that others — a priest, a teacher, a parent — have asked you whether you have thought of it.",
      },
      {
        order: 3,
        title: "Pray daily and go to Mass",
        body: "Give a fixed time to prayer every day, with Scripture: the call of the apostles, the Good Shepherd (John 10), the priestly prayer of Jesus (John 17), the Last Supper. Attend Mass daily if you can, confess regularly, and make a weekly holy hour before the Blessed Sacrament for your vocation. Pray the Veni Creator Spiritus and the Prayer for Vocations. Get a spiritual director, ideally a priest; the seminary will require one, and starting now is the best preparation.",
      },
      {
        order: 4,
        title: "Contact the vocation office",
        body: "Every diocese has a vocation director, a priest whose task is to accompany men asking this question; find him through the diocesan website or your pastor. If you are drawn to a religious order, contact its vocation director instead or as well. Tell him your story frankly. He will meet you, suggest reading and prayer, and invite you to the diocese's discernment events. This is a conversation, not an application.",
      },
      {
        order: 5,
        title: "Join discernment groups and make retreats",
        body: "Most dioceses run discernment groups that meet regularly for prayer, a talk and conversation with priests and seminarians, and discernment retreats or weekends, often with a visit to the seminary. Take part. Spend time with priests in their ordinary work — a parish, a hospital, a school — and ask them what the life is really like. Make a directed retreat with the question before God.",
      },
      {
        order: 6,
        title: "Apply",
        body: "When you and the vocation director agree it is time, apply to the diocese or the order. The application includes an autobiography, references, sacramental records, academic transcripts, a medical examination, a psychological evaluation, background checks and interviews with an admissions board; the bishop or superior makes the decision. The process is thorough because the Church takes both you and the people you would serve seriously. Canon law requires a man to be at least twenty-five for priestly ordination, so the timeline is long by design.",
      },
      {
        order: 7,
        title: "Seminary formation: human, spiritual, intellectual, pastoral",
        body: "Seminary forms the whole man in the four dimensions Pastores Dabo Vobis names. In the United States the Program of Priestly Formation (2022 edition) organises it in stages: a propaedeutic stage of at least a year, focused on prayer and human formation; a discipleship stage, with philosophy and the beginnings of a priestly way of life; a configuration stage of theological study and pastoral placements, during which a man is admitted to candidacy, instituted as lector and acolyte, and ordained a transitional deacon; and a vocational synthesis stage after diaconal ordination, lived in a parish. Throughout, spiritual direction, daily Mass, the Liturgy of the Hours and regular evaluation continue. A man may leave at any stage, and the Church may ask him to.",
      },
      {
        order: 8,
        title: "Ordination",
        body: "At the end of formation, the bishop calls the deacon to priestly ordination. In the rite he promises obedience to the bishop and his successors, lies prostrate while the Church sings the Litany of the Saints, receives the laying on of hands and the prayer of consecration, is anointed on the palms with chrism and receives the paten and chalice, and concelebrates his first Mass. From that day he is a priest forever. The discernment of the call has become the living of it, and the daily prayer that began it continues.",
      },
    ],
    relatedPrayers: [
      "veni-creator-spiritus",
      "prayer-for-vocations",
      "our-father",
      "litany-of-the-saints",
    ],
    relatedPractices: ["spiritual-direction", "discernment-of-spirits"],
    relatedSaints: ["saint-john-vianney", "saint-john-paul-ii", "saint-philip-neri"],
  }),

  guide({
    slug: "how-to-discern-a-call-to-the-permanent-diaconate",
    title: "How to Discern a Call to the Permanent Diaconate",
    summary:
      "The permanent diaconate for married and single men: what a deacon does, the requirements of age and a wife's consent, inquiry with the diocese, aspirancy, formation, the ministries of lector and acolyte, and ordination and assignment.",
    kind: "vocation",
    sacramentKey: "holy_orders",
    authorityLevel: "VATICAN",
    citations: [V_CCC_ORD, U_VOC],
    intro:
      "The permanent diaconate, restored by the Second Vatican Council and Saint Paul VI, is the first degree of the sacrament of Holy Orders lived as a lifelong ministry, open to married and unmarried men. The Catechism describes the deacon as ordained 'not unto the priesthood, but unto the ministry', configured to Christ the Servant for the threefold ministry of the word, the liturgy and charity. A deacon proclaims the Gospel and preaches, baptises, witnesses marriages, presides at funerals and blessings, assists at the altar, and gives himself to the works of charity — usually while continuing his job and family life. Discerning it is a discernment for the man and, if he is married, for his wife and family with him.",
    whatYouNeed: [
      "A stable life of faith, prayer and the sacraments, and active service in your parish",
      "If married, a stable marriage and your wife's free consent; if single, the readiness to embrace lifelong celibacy",
      "The age and freedom the Church requires (see the requirements step) and the health and capacity for several years of study",
      "The support of your pastor, who will be asked to recommend you",
    ],
    whenToPray:
      "Daily, with the Liturgy of the Hours if you can begin it now — deacons are bound to pray Morning and Evening Prayer — and Mass as often as possible.",
    tips: [
      "A deacon is not a 'mini-priest' nor a super-volunteer; he is ordained for service, and the parish should already see him serving.",
      "Your wife is not an appendix to your discernment. Most programs involve wives in formation, and her consent is required by canon law; discern together from the start.",
      "The ordinary path takes four to six years from inquiry to ordination; if that feels too long, ask what the hurry is.",
      "Your bishop, not you, assigns your ministry after ordination; discernment includes a willingness to serve where you are sent.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Understand what a deacon does",
        body: "Read the Catechism's paragraphs on the diaconate and the USCCB's National Directory for the Formation, Ministry and Life of Permanent Deacons if you can find it. The deacon serves the word (proclaiming the Gospel, preaching, catechesis), the liturgy (assisting the priest at Mass, baptising, witnessing marriages, presiding at funerals outside Mass, exposition and benediction of the Blessed Sacrament, blessings), and charity (the poor, the sick, prisoners, the parish's works of mercy), and is meant to be a bridge between the altar and the world of work and family. He does not celebrate Mass, hear confessions or anoint the sick.",
      },
      {
        order: 2,
        title: "Check the requirements",
        body: "The Code of Canon Law sets minimum ages for the permanent diaconate: twenty-five for an unmarried candidate and thirty-five for a married one, and the bishops of the United States have set thirty-five as the minimum for all candidates; many dioceses also set an upper age limit for beginning formation. A married candidate must have his wife's written consent. A married deacon who is widowed does not ordinarily remarry, and an unmarried man ordained deacon takes on lifelong celibacy. Candidates must be confirmed Catholics of stable life, sound doctrine and good reputation, with the health and education needed for formation.",
      },
      {
        order: 3,
        title: "Inquire with the diocese",
        body: "Speak first with your pastor, who knows you and whose recommendation the diocese will ask for. Then contact the diocesan office for the permanent diaconate; most hold information evenings, and the director will meet you, and your wife if you are married, to talk over your life, your motives and the program. This inquiry period is a conversation, with no commitment on either side.",
      },
      {
        order: 4,
        title: "Aspirancy",
        body: "Men accepted for discernment enter a period of aspirancy, usually about a year, in which the diocese and the aspirant test the call together: monthly gatherings for prayer, study and formation, a spiritual director, a retreat, and the involvement of wives. At its end the aspirant applies for admission to candidacy, and the bishop, having heard the formation team, either admits him in the Rite of Admission to Candidacy or does not. Either is a fruit of discernment.",
      },
      {
        order: 5,
        title: "Formation",
        body: "Candidacy formation lasts several years — commonly three to four — and, like priestly formation, has human, spiritual, intellectual and pastoral dimensions: theology, Scripture, liturgy, canon law and homiletics, together with supervised pastoral placements, regular spiritual direction, annual retreats, and the daily prayer of the Liturgy of the Hours. Wives commonly share in much of it. The candidate's marriage, work and parish life continue throughout, and are part of what is formed.",
      },
      {
        order: 6,
        title: "The ministries of lector and acolyte",
        body: "During formation the candidate is instituted by the bishop in the ministries of lector (to proclaim the Word) and acolyte (to serve at the altar and assist with Holy Communion), and canon law requires an interval of at least six months between receiving the ministry of acolyte and ordination. These are not ordinations but public steps by which the Church confirms the candidate's progress and gives him a share in her ministry.",
      },
      {
        order: 7,
        title: "Ordination and assignment",
        body: "When the formation team, the pastor and the candidate's wife have been heard and the bishop calls him, the candidate is ordained a deacon: he promises respect and obedience to the bishop, the Church prays the Litany of the Saints over him as he lies prostrate, the bishop lays hands on him and prays the prayer of ordination, and he is vested with the stole and dalmatic and receives the Book of the Gospels. The bishop then assigns him to a parish or another ministry, and his life as a deacon begins where his life as a Christian husband, father and worker already is.",
      },
    ],
    relatedPrayers: ["veni-creator-spiritus", "prayer-of-saint-francis", "litany-of-the-saints"],
    relatedPractices: ["spiritual-direction"],
    relatedSaints: ["saint-stephen", "saint-lawrence", "saint-francis-of-assisi"],
  }),

  guide({
    slug: "how-to-discern-consecrated-life-as-a-lay-person",
    title: "How to Discern Consecrated Life as a Lay Person",
    summary:
      "The forms of consecrated and committed life lived in the world: secular institutes, consecrated virginity, the eremitical life, societies of apostolic life, and the third orders; signs and motives, how to learn about each, contacting the diocese or institute, formation, and commitment.",
    kind: "vocation",
    authorityLevel: "VATICAN",
    citations: [V_VC, V_CL],
    intro:
      "Not every consecration is lived in a convent or a monastery. The Church recognises forms of consecrated life lived in the midst of the world — secular institutes, the order of virgins, hermits — and forms of committed life that resemble it, such as societies of apostolic life and the third orders attached to the great religious families. Vita Consecrata describes the consecrated life in all its forms, and Christifideles Laici the vocation of the laity to sanctify the world from within. This guide is for a lay person who feels drawn to a definitive gift of self to God but not to religious life in community, and it tries to name the forms accurately, since they are not all the same thing.",
    whatYouNeed: [
      "A stable life of prayer and the sacraments, and some experience of living the faith in your work and relationships",
      "The freedom to make a lifelong commitment (no marriage bond; for consecrated virginity, a woman who has never married or lived in public violation of chastity)",
      "A spiritual director",
      "Contact with the diocesan vocation office or with the institute or community that draws you",
    ],
    whenToPray:
      "Daily, with the Liturgy of the Hours if possible, since most of these forms ask for it; a monthly day of recollection is the traditional practice.",
    tips: [
      "Be precise about what you are discerning. Consecrated virginity, the eremitical life and secular institutes are consecrated life in the Church's strict sense; third orders and oblates are associations of the faithful, a real and holy commitment but not a consecration.",
      "Because these forms are lived alone or in the world, the Church asks for more, not less, proof of stability and prayer before commitment.",
      "Many people are drawn to a third order first and only later, if at all, to a consecrated form; that is a normal path, not a detour.",
      "The diocesan bishop is the ordinary point of contact for consecrated virgins and hermits; institutes and orders handle their own members.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Learn the forms of consecrated life in the world",
        body: "Secular institutes (approved by Pius XII in 1947) are institutes of consecrated life whose members, lay or clerical, profess the evangelical counsels by sacred bonds while living in the world, usually without community life and often without public sign, sanctifying the world from within. Consecrated virgins (canon 604) are women who, having never married, are consecrated to Christ by the diocesan bishop in the ancient Rite of Consecration of Virgins and live in the world under his care. Hermits (canon 603) profess the counsels publicly in the hands of the bishop and live a life of silence and solitude. Societies of apostolic life (for example the Congregation of the Mission and the Daughters of Charity) pursue an apostolic purpose in community, some with bonds that are not religious vows. Third orders or secular orders (Secular Franciscans, Lay Dominicans, Lay Carmelites, Benedictine Oblates) are associations of the faithful who share a religious family's spirituality while living ordinary lay or married life; their promises are a real commitment but not a consecration in the canonical sense.",
      },
      {
        order: 2,
        title: "Examine your signs and motives",
        body: "The signs are those of any consecrated vocation: a lasting attraction to give yourself wholly to Christ, a life of prayer that is already real, chastity lived freely, the capacity for the solitude or the hidden fidelity these forms require, and a peace that grows when you imagine the life. Examine motives honestly with your director: a desire for a definitive gift of self is a sign; a wish to avoid community, marriage or failure is not. The third orders in particular can be discerned by married people, and the question there is whether a religious family's spirituality is genuinely yours.",
      },
      {
        order: 3,
        title: "Learn about each form concretely",
        body: "Read Vita Consecrata (especially its treatment of secular institutes, consecrated virgins and hermits) and the relevant canons; for consecrated virginity, the 2018 instruction Ecclesiae Sponsae Imago sets out the vocation and its formation. Find the secular institutes present in your country, the third orders active in your area, and whether your diocese has consecrated virgins or hermits. Meet members of the form that draws you and ask how they pray, work, and live their commitment day to day.",
      },
      {
        order: 4,
        title: "Contact the diocese or the institute",
        body: "For consecrated virginity or the eremitical life, contact the diocesan bishop through the vocation office or the office for consecrated life; the bishop decides whether to admit a candidate, and the diocese will set a formation path. For a secular institute or society of apostolic life, contact its vocation director. For a third order, contact the local fraternity or chapter, usually through a parish or a friary served by that order. In every case bring your spiritual director into the conversation.",
      },
      {
        order: 5,
        title: "Enter the period of formation",
        body: "Each form has its own formation, and it is long by design. Secular institutes have a probation of several years before temporary and then perpetual incorporation, set by their constitutions. Candidates for consecrated virginity are prepared over a period the bishop determines, usually years, in prayer, doctrine and the life of the diocese. Hermits are normally asked to live the eremitical life for years under direction before public profession. Third orders have an inquiry, a period of initial formation commonly of one to three years, and then profession or promises. Use the time to test the call in ordinary life, which is where these vocations are lived.",
      },
      {
        order: 6,
        title: "Make the commitment",
        body: "At the end of formation, if you and the Church agree, comes the definitive act: perpetual incorporation in a secular institute, the Rite of Consecration of Virgins celebrated by the bishop, the public profession of a hermit in his hands, or the profession of a third order made before the fraternity and the religious who assists it. Prepare for it with a retreat and confession, pray the Veni Creator Spiritus for the grace to keep it, and give thanks with the Magnificat. What follows is the same as before — work, prayer, the people around you — now lived as a gift already given.",
      },
    ],
    relatedPrayers: ["veni-creator-spiritus", "prayer-to-the-holy-spirit", "magnificat"],
    relatedPractices: ["spiritual-direction", "discernment-of-spirits"],
    relatedSaints: ["saint-francis-of-assisi", "saint-vincent-de-paul", "saint-catherine-of-siena"],
  }),

  guide({
    slug: "how-to-pray-for-vocations",
    title: "How to Pray for Vocations",
    summary:
      "Praying for priests, deacons and religious as a family or a parish: why the Church asks it, a daily prayer for vocations, a holy hour for vocations, praying for a named priest, the World Day of Prayer for Vocations, and encouraging the young.",
    kind: "vocation",
    authorityLevel: "USCCB",
    citations: [U_VOC, V_PDV],
    intro:
      "'Pray therefore the Lord of the harvest to send out labourers into his harvest' (Matthew 9:38) is the one command of Jesus about vocations, and the Church has taken it literally ever since. Saint John Paul II wrote in Pastores Dabo Vobis that the Church 'should daily take up Jesus' persuasive and demanding invitation' to pray to the Lord of the harvest, and that in praying for vocations she acknowledges that they are a gift of God and not a product of recruitment. Saint Paul VI instituted the World Day of Prayer for Vocations in 1964, and the bishops of the United States keep a National Vocation Awareness Week each November. Praying for vocations is something a child, a family, a sick person or a whole parish can do, and it is the part of vocations work that everyone is asked to share.",
    whatYouNeed: [
      "A short prayer for vocations you can say daily — the Prayer for Vocations, or an Our Father and a Hail Mary for the intention",
      "The names of your parish priests, deacons and seminarians, and of any religious from your parish",
      "An hour, monthly or weekly, before the Blessed Sacrament if you are able",
      "The dates of the World Day of Prayer for Vocations (the Fourth Sunday of Easter) and of your diocese's ordinations",
    ],
    whenToPray:
      "Daily; especially on Thursdays, the day of the Last Supper and the institution of the priesthood, and on the Fourth Sunday of Easter, Good Shepherd Sunday.",
    tips: [
      "Pray for the vocations already given — the priests and religious you know — as much as for new ones; perseverance is also a grace.",
      "Children who hear their family pray for vocations learn that a vocation is something to hope for, not fear.",
      "Add the intention to the Prayers of the Faithful at Mass and to the family Rosary; the Church has always prayed for vocations in company.",
      "Say a word of encouragement to a young person in whom you see the signs; many priests trace their vocation to one such remark.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand why the Church asks us to pray",
        body: "A vocation is a call from God, received in freedom; the Church cannot manufacture one, but she can ask for it, and Jesus told her to. Pastores Dabo Vobis says that the Church must never cease to pray to the Lord of the harvest, that the whole community shares the responsibility for vocations, and — quoting the Second Vatican Council — that the family is 'as it were, a first seminary'. Praying for vocations is also an act of love for the people who will one day need a priest at their bedside, a religious in their school, a deacon at their graveside.",
      },
      {
        order: 2,
        title: "Pray for vocations daily",
        body: "Choose a fixed moment — morning prayer, the family Rosary, grace after the evening meal — and pray a short prayer for vocations every day: the Prayer for Vocations, or an Our Father and a Hail Mary for the intention 'that the Lord of the harvest may send labourers into his harvest, and give those he calls the grace to answer'. Add a petition for the perseverance and holiness of the priests and religious you know. It takes a minute and is the whole foundation.",
      },
      {
        order: 3,
        title: "Make a holy hour for vocations",
        body: "Spend an hour before the Blessed Sacrament, weekly or monthly, for vocations; many parishes hold a monthly holy hour for this intention, often on a Thursday, and it is one of the best-attested vocation practices in the Church. Open with the O Salutaris Hostia, read the call of the apostles or John 10, pray a Rosary for vocations naming an intention for each decade — priests, deacons, religious sisters, religious brothers, missionaries — and close with the Tantum Ergo and the Divine Praises if Benediction is given.",
      },
      {
        order: 4,
        title: "Pray for a named priest",
        body: "Adopt a priest, a deacon or a seminarian by name — your pastor, the newly ordained, one who is struggling — and pray for him every day, offering a Mass, a Rosary, a sacrifice, for a year or for life. Some parishes organise this so that every priest of the diocese has people praying for him each day; ask your pastor whether yours does, and start it if not. Tell the priest, simply, that you are praying for him.",
      },
      {
        order: 5,
        title: "Keep the World Day of Prayer for Vocations",
        body: "On the Fourth Sunday of Easter, Good Shepherd Sunday, the whole Church prays for vocations; the Pope writes a message for the day each year, which is worth reading as a family. Take part in the parish's prayer, and mark National Vocation Awareness Week in November and the day of your diocese's ordinations, usually in late spring or summer, by praying for those to be ordained and by attending if you can.",
      },
      {
        order: 6,
        title: "Encourage the young",
        body: "Speak of priests and religious with respect at home; invite them to your table; let children serve at the altar, visit a monastery, and meet sisters and seminarians. When you see in a young person the signs of a vocation — prayer, generosity, a love of the Church — say so, once, without pressure, and keep praying. Parents who tell their children they would be glad of a vocation in the family are answering, in their own home, the prayer they make for the harvest.",
      },
    ],
    relatedPrayers: [
      "prayer-for-vocations",
      "our-father",
      "hail-mary",
      "o-salutaris-hostia",
      "tantum-ergo",
      "divine-praises",
    ],
    relatedDevotions: ["holy-hour", "eucharistic-adoration", "holy-rosary"],
    relatedSaints: ["saint-john-vianney", "saint-therese-of-lisieux"],
  }),
];
