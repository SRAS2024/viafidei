import type { ChurchHistoryEvent } from "./types";

const NA = "https://www.newadvent.org/cathen/";
const W = "https://en.wikipedia.org/wiki/";

/**
 * Church-history spine, part 6: the age of the Fathers and the first
 * councils (313 – 589), between the Edict of Milan and the election of
 * Gregory the Great — the Arian crisis and the Christological controversies,
 * the great Fathers and Doctors, the rise of monasticism East and West, the
 * popes of late antiquity, and the missions and barbarian kingdoms that
 * outlived Rome. It fills in around the landmark events of part 1, never
 * repeating one. Every event cites one page that supports its date and
 * claim; approximate dates carry `precision: "circa"`, and a day is stored
 * only where the exact day is well attested.
 */
export const EVENTS_6: ChurchHistoryEvent[] = [
  // ---------------------------------------------------------------- Constantine and Nicaea
  {
    slug: "lateran-synod-on-the-donatists",
    title: "Lateran synod judges the Donatist dispute",
    year: 313,
    date: "0313-10-02",
    precision: "day",
    era: "fathers",
    kind: "council",
    tags: ["schism", "papacy"],
    location: "Lateran Palace, Rome",
    context:
      "Asked by Constantine to settle the disputed see of Carthage, Pope Miltiades holds a synod of eighteen bishops from Gaul and Italy in the Lateran Palace, which upholds Caecilian as lawful bishop against the rival party of Majorinus.",
    significance:
      "The first Roman judgment in the Donatist schism, a rigorist break that divided the African Church for generations.",
    citation: `${NA}10318a.htm`,
    links: { popes: ["pope-saint-miltiades"] },
  },
  {
    slug: "arius-and-bishop-alexander",
    title: "Arius's quarrel with Bishop Alexander",
    year: 318,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["dogma"],
    location: "Alexandria",
    context:
      "The Alexandrian priest Arius teaches that the Son of God is a creature with a beginning; his bishop, Alexander, opposes him, and in 321 a synod of nearly a hundred Egyptian and Libyan bishops condemns him.",
    significance:
      "The opening of the Arian crisis, which spread across the East and led Constantine to summon the Council of Nicaea.",
    citation: `${NA}01718a.htm`,
  },
  {
    slug: "pachomius-founds-tabennisi",
    title: "St Pachomius founds a monastery of common life",
    year: 320,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Tabennisi, Egypt",
    context:
      "Sometime between 318 and 323 Pachomius establishes a monastery at Tabennisi where monks live together under a rule, sharing property, work and prayer instead of living as solitary hermits.",
    significance:
      "Father of cenobitic monasticism: by his death several monasteries and hundreds of monks followed his rule, a pattern later communities copied.",
    citation: `${W}Pachomius_the_Great`,
  },
  {
    slug: "forty-martyrs-of-sebaste",
    title: "Forty Martyrs of Sebaste",
    year: 320,
    precision: "circa",
    era: "fathers",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Sebaste, Armenia Minor",
    context:
      "During Licinius's persecution in the East, forty Christian soldiers are left naked on a frozen pond near Sebaste and die of exposure.",
    significance:
      "Among the most honoured martyrs of the East: Basil of Caesarea's homily on them is the earliest account, and Gregory of Nyssa and Ephrem also praised them.",
    citation: `${W}Forty_Martyrs_of_Sebaste`,
  },
  {
    slug: "constantine-begins-saint-peters-basilica",
    title: "Constantine begins the basilica of St Peter",
    year: 320,
    precision: "circa",
    era: "fathers",
    kind: "event",
    location: "Vatican Hill, Rome",
    context:
      "Constantine orders a great basilica raised over the grave venerated as St Peter's on the Vatican Hill, a work that takes some forty years to finish.",
    significance:
      "Old St Peter's was the heart of pilgrimage to Rome for more than a thousand years, until it gave way to the present basilica.",
    citation: `${W}Old_St._Peter%27s_Basilica`,
    links: { saints: ["saint-peter"], popes: ["pope-saint-sylvester-i"] },
  },
  {
    slug: "constantine-sunday-rest-law",
    title: "Constantine makes Sunday a day of rest",
    year: 321,
    date: "0321-03-07",
    precision: "day",
    era: "fathers",
    kind: "event",
    tags: ["liturgy"],
    location: "Roman Empire",
    context:
      "An imperial decree orders magistrates and city-dwellers to rest and workshops to close on the day of the Sun, while farmers may keep working when the season requires.",
    significance:
      "The first civil law of Sunday rest, giving the Christian Lord's Day a protected place in the week of the empire.",
    citation: `${W}Sunday`,
  },
  {
    slug: "dedication-of-the-lateran-basilica",
    title: "Dedication of the Lateran Basilica",
    year: 324,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "On the Lateran property that Constantine had given to the Bishop of Rome, Pope Sylvester I dedicates the basilica of the Saviour and the adjoining palace.",
    significance:
      "Rome's cathedral and its oldest public church, honoured as mother and head of all the churches of the city and the world.",
    citation: `${W}Archbasilica_of_Saint_John_Lateran`,
    links: { popes: ["pope-saint-sylvester-i"] },
  },
  {
    slug: "eusebius-ecclesiastical-history",
    title: "Eusebius completes his Church History",
    year: 324,
    precision: "circa",
    era: "fathers",
    kind: "document",
    location: "Caesarea Maritima",
    context:
      "Bishop Eusebius of Caesarea brings his Ecclesiastical History, which runs from the Apostles to Constantine's defeat of Licinius, to its final form in ten books.",
    significance:
      "The first full history of the Church, and a storehouse of early sources that would otherwise be lost.",
    citation: `${NA}05617b.htm`,
  },
  {
    slug: "saint-helena-pilgrimage-to-the-holy-land",
    title: "St Helena's pilgrimage to the Holy Land",
    year: 326,
    precision: "circa",
    era: "fathers",
    kind: "saint",
    location: "Palestine",
    context:
      "Constantine's mother, by now elderly, travels through Palestine and sponsors churches at Bethlehem and on the Mount of Olives.",
    significance:
      "Her journey spurs pilgrimage to the holy places; a legend first recorded at the end of the century credits her with finding the True Cross.",
    citation: `${W}Helena,_mother_of_Constantine_I`,
    links: { saints: ["saint-helena"] },
  },
  {
    slug: "conversion-of-iberia",
    title: "Iberia (Georgia) adopts Christianity",
    year: 326,
    precision: "circa",
    era: "fathers",
    kind: "mission",
    location: "Kingdom of Iberia (Georgia)",
    context:
      "Through the Cappadocian woman Nino, Queen Nana and then King Mirian III of Iberia embrace the faith, and the king makes Christianity the religion of his realm.",
    significance:
      "Georgia becomes one of the oldest Christian nations; many scholars now favour 326 over the once-accepted 337 for the conversion.",
    citation: `${W}Christianization_of_Iberia`,
  },
  {
    slug: "athanasius-becomes-bishop-of-alexandria",
    title: "St Athanasius becomes Bishop of Alexandria",
    year: 328,
    precision: "year",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Alexandria",
    context:
      "Athanasius succeeds Alexander, the bishop who had first opposed Arius, at the head of the Church of Alexandria.",
    significance:
      "For forty-five years, many of them spent in exile, he is the leading champion of the Nicene faith.",
    citation: `${NA}02035a.htm`,
    links: { saints: ["saint-athanasius"], doctors: ["doctor-athanasius-of-alexandria"] },
  },
  {
    slug: "dedication-of-constantinople",
    title: "Constantine dedicates Constantinople",
    year: 330,
    date: "0330-05-11",
    precision: "day",
    era: "fathers",
    kind: "event",
    location: "Constantinople",
    context:
      "Constantine solemnly inaugurates his new capital on the Bosporus, old Byzantium rebuilt as a New Rome, and the court settles there.",
    significance:
      "The empire's centre of gravity moves east, and the bishop of the new capital rises to become one of the great sees of Christendom.",
    citation: `${NA}04301a.htm`,
  },
  {
    slug: "synod-of-tyre-condemns-athanasius",
    title: "Synod of Tyre condemns Athanasius",
    year: 335,
    precision: "year",
    era: "fathers",
    kind: "council",
    location: "Tyre",
    context:
      "A synod at Tyre dominated by his opponents condemns Athanasius, and early in 336 he is sent into exile at Trier.",
    significance:
      "The first of his exiles, and the start of years in which the anti-Nicene party holds the emperor's favour.",
    citation: `${NA}02035a.htm`,
    links: { doctors: ["doctor-athanasius-of-alexandria"] },
  },
  {
    slug: "dedication-of-the-holy-sepulchre",
    title: "Dedication of the Church of the Holy Sepulchre",
    year: 335,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Jerusalem",
    context:
      "Constantine's church over the site of Christ's tomb, ordered about 326 to replace a pagan temple, is consecrated in September 335.",
    significance:
      "Jerusalem's central shrine and, ever since, a chief goal of Christian pilgrimage.",
    citation: `${W}Church_of_the_Holy_Sepulchre`,
  },
  {
    slug: "christmas-on-25-december-first-recorded",
    title: "Christmas on 25 December first recorded",
    year: 336,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["liturgy"],
    location: "Rome",
    context:
      "A Roman calendar of martyrs' feasts, probably drawn up in 336 and preserved in the Chronograph of 354, sets Christ's birth at Bethlehem on 25 December.",
    significance:
      "The earliest firm evidence of the Christmas feast, which passed from Rome to the East later in the century.",
    citation: `${NA}03724b.htm`,
  },
  {
    slug: "baptism-and-death-of-constantine",
    title: "Baptism and death of Constantine",
    year: 337,
    date: "0337-05-22",
    precision: "day",
    era: "fathers",
    kind: "event",
    location: "near Nicomedia",
    context:
      "Long a catechumen, Constantine is baptised on his deathbed by Eusebius of Nicomedia, a bishop of the Arian party, and dies on 22 May 337.",
    significance:
      "The first Christian emperor leaves a Church freed and favoured, but closely bound to imperial power.",
    citation: `${W}Constantine_the_Great`,
  },
  {
    slug: "shapur-ii-persecution-of-christians",
    title: "Shapur II's persecution of Persian Christians",
    year: 339,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["persecution"],
    location: "Sasanian Persia",
    context:
      "From about 339 until his death in 379, King Shapur II persecutes the Church in Persia; Bishop Simeon bar Sabbae of Seleucia-Ctesiphon is among the martyrs.",
    significance:
      "One of the longest persecutions the Church has known: Sozomen put the known martyrs at more than sixteen thousand.",
    citation: `${W}Martyrs_of_Persia_under_Shapur_II`,
  },
  {
    slug: "frumentius-first-bishop-of-aksum",
    title: "Frumentius becomes first bishop of Aksum",
    year: 340,
    precision: "circa",
    era: "fathers",
    kind: "mission",
    location: "Aksum (Ethiopia)",
    context:
      "Frumentius, enslaved as a boy at the court of Aksum, asks Athanasius of Alexandria to send the kingdom a bishop and is consecrated himself; he then baptises King Ezana.",
    significance:
      "Honoured as Abba Salama, he founds the Ethiopian Church; the date is uncertain, traditionally 328 or between 340 and 346.",
    citation: `${W}Frumentius`,
    links: { doctors: ["doctor-athanasius-of-alexandria"] },
  },
  {
    slug: "ulfilas-bishop-of-the-goths",
    title: "Ulfilas becomes bishop of the Goths",
    year: 341,
    precision: "circa",
    era: "fathers",
    kind: "mission",
    location: "Gothia, north of the Danube",
    context:
      "Ulfilas is consecrated bishop for the Goths by the Arian Eusebius of Nicomedia, probably at Antioch in 341, and devises a Gothic alphabet for the Scriptures.",
    significance:
      "The Goths receive Christianity in its Homoian (Arian) form, which long set the Germanic kingdoms apart from their Catholic subjects.",
    citation: `${W}Ulfilas`,
  },
  {
    slug: "pope-julius-i-vindicates-athanasius",
    title: "Pope Julius I vindicates Athanasius",
    year: 341,
    precision: "circa",
    era: "fathers",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "A Roman synod under Julius I clears the exiled Athanasius and Marcellus of Ancyra, and the pope reproaches the Eastern bishops for acting against Alexandria without first writing to Rome.",
    significance:
      "An early and explicit claim of Rome's part in judging the bishops of the great sees.",
    citation: `${NA}08561a.htm`,
    links: { popes: ["pope-saint-julius-i"], doctors: ["doctor-athanasius-of-alexandria"] },
  },
  {
    slug: "council-of-serdica",
    title: "Council of Serdica",
    year: 343,
    precision: "circa",
    era: "fathers",
    kind: "council",
    tags: ["papacy", "schism"],
    location: "Serdica (Sofia)",
    context:
      "Called by the emperors Constans and Constantius II and presided over by Hosius of Córdoba, the council meets without the Eastern bishops, who refuse to sit with the Westerners and issue their own decrees from Philippopolis.",
    significance:
      "Its canons give a condemned bishop recourse to the Bishop of Rome, and the rival anathemas mark the first open breach between East and West.",
    citation: `${W}Council_of_Serdica`,
    links: { popes: ["pope-saint-julius-i"] },
  },
  {
    slug: "cyril-of-jerusalem-catechetical-lectures",
    title: "St Cyril of Jerusalem's Catechetical Lectures",
    year: 347,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["liturgy", "doctor"],
    location: "Jerusalem",
    context:
      "Cyril, then probably still a priest, gives Lenten instructions to those preparing for baptism and, in Easter week, five mystagogical lectures on the sacraments they have received.",
    significance:
      "A vivid witness to the faith and to the rites of baptism, chrismation and the Eucharist in fourth-century Jerusalem.",
    citation: `${NA}04595b.htm`,
    links: { doctors: ["doctor-cyril-of-jerusalem"] },
  },
  {
    slug: "codex-sinaiticus",
    title: "Codex Sinaiticus is written",
    year: 350,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["scripture"],
    context:
      "Scribes copy a great Greek Bible on parchment in the middle of the fourth century; it was later preserved at St Catherine's Monastery on Sinai.",
    significance:
      "It contains the oldest complete copy of the New Testament; most of it is now in the British Library.",
    citation: `${W}Codex_Sinaiticus`,
  },
  {
    slug: "exile-of-pope-liberius",
    title: "Pope Liberius exiled for defending Athanasius",
    year: 355,
    precision: "year",
    era: "fathers",
    kind: "pope",
    tags: ["papacy"],
    location: "Milan → Beroea, Thrace",
    context:
      "After the Council of Milan, Constantius II banishes Liberius to Thrace for refusing to condemn Athanasius, who had been acquitted by two synods.",
    significance:
      "He is back in Rome within about two years; whether he won his return by signing a compromise formula has been argued since antiquity and remains disputed.",
    citation: `${NA}09217a.htm`,
    links: { popes: ["pope-liberius"] },
  },
  {
    slug: "hilary-of-poitiers-exiled",
    title: "St Hilary of Poitiers exiled to Phrygia",
    year: 356,
    precision: "year",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Béziers → Phrygia",
    context:
      "After a synod at Béziers led by the Arian bishop Saturninus of Arles, Constantius II banishes the bishop of Poitiers to Asia Minor, where he writes on the synods and the faith.",
    significance:
      "He returns to Poitiers in 361 as the foremost Latin defender of Nicaea; Pius IX declared him a Doctor of the Church.",
    citation: `${NA}07349b.htm`,
    links: { saints: ["saint-hilary-of-poitiers"], doctors: ["doctor-hilary-of-poitiers"] },
  },
  {
    slug: "basil-founds-community-at-annesi",
    title: "St Basil's monastic community in Pontus",
    year: 358,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic", "doctor"],
    location: "Annesi, Pontus",
    context:
      "Basil and his family found a monastic settlement on their estate near Annesi, where his friend Gregory of Nazianzus joins him for a time.",
    significance:
      "His guidelines for common life, liturgical prayer and manual work shape Eastern monasticism, and the Rule of St Benedict points to his rule.",
    citation: `${W}Basil_of_Caesarea`,
    links: { doctors: ["doctor-basil-the-great"] },
  },
  {
    slug: "councils-of-rimini-and-seleucia",
    title: "Councils of Rimini and Seleucia",
    year: 359,
    precision: "year",
    era: "fathers",
    kind: "council",
    tags: ["dogma"],
    location: "Rimini and Seleucia",
    context:
      "About four hundred Western bishops at Rimini and 150 Eastern bishops at Seleucia are pressed by Constantius II's officials into accepting a Homoian creed, which calls the Son only like the Father.",
    significance:
      "The high-water mark of imperial Arianism, with the faith of Nicaea set aside by bishops of East and West under duress.",
    citation: `${W}Council_of_Rimini`,
  },
  {
    slug: "athanasius-writes-the-life-of-anthony",
    title: "Athanasius writes the Life of Anthony",
    year: 360,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["monastic", "doctor"],
    location: "Egypt",
    context:
      "A few years after the desert father's death, Athanasius writes the life of Anthony of Egypt; before 374 Evagrius of Antioch translates it into Latin.",
    significance:
      "It carries the monastic ideal through East and West, and its story helped move Augustine to conversion.",
    citation: `${W}Life_of_Anthony`,
    links: {
      saints: ["saint-anthony-the-abbot", "saint-athanasius"],
      doctors: ["doctor-athanasius-of-alexandria"],
    },
  },
  {
    slug: "julian-the-apostate-pagan-revival",
    title: "Julian the Apostate's pagan revival",
    year: 361,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Constantinople",
    context:
      "Sole emperor after Constantius II dies on 3 November 361, Julian reopens the temples, bars Christians from teaching rhetoric and grammar, and tries to rebuild the Temple at Jerusalem.",
    significance:
      "His death on campaign in Persia on 26 June 363 ends the last attempt to make paganism the religion of the empire again.",
    citation: `${NA}08558b.htm`,
  },
  {
    slug: "council-of-alexandria-362",
    title: "Council of Alexandria",
    year: 362,
    precision: "year",
    era: "fathers",
    kind: "council",
    tags: ["dogma"],
    location: "Alexandria",
    context:
      "Back from exile, Athanasius presides over a synod at Alexandria that reaches out to the orthodox Semi-Arians, moderates who had kept their distance from the Nicene formula.",
    significance:
      "It unites them with Athanasius and the West, strengthening the Nicene cause on the way to the Council of Constantinople in 381.",
    citation: `${NA}01707c.htm`,
    links: { doctors: ["doctor-athanasius-of-alexandria"] },
  },
  {
    slug: "disputed-election-of-pope-damasus",
    title: "Disputed election of Pope Damasus I",
    year: 366,
    precision: "year",
    era: "fathers",
    kind: "pope",
    tags: ["papacy", "schism"],
    location: "Rome",
    context:
      "After Liberius dies, rival factions elect Damasus and the deacon Ursinus; the struggle turns to street violence, with 137 people killed in a single basilica, and the city prefects banish Ursinus.",
    significance:
      "A grim episode, plainly recorded; Damasus went on to have Jerome revise the Latin Bible and to honour the martyrs of the catacombs with verse inscriptions.",
    citation: `${W}Pope_Damasus_I`,
    links: { popes: ["pope-saint-damasus-i"] },
  },
  {
    slug: "basil-becomes-bishop-of-caesarea",
    title: "St Basil becomes Bishop of Caesarea",
    year: 370,
    precision: "year",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Caesarea, Cappadocia",
    context:
      "Basil succeeds Eusebius in the see of Caesarea, consecrated according to tradition on 14 June 370.",
    significance:
      "He stands firm against the Arianising Emperor Valens and builds the Basileiad, a great complex for the poor and the sick.",
    citation: `${NA}02330b.htm`,
    links: { doctors: ["doctor-basil-the-great"] },
  },
  {
    slug: "martin-becomes-bishop-of-tours",
    title: "St Martin becomes Bishop of Tours",
    year: 371,
    precision: "circa",
    era: "fathers",
    kind: "saint",
    location: "Tours",
    context:
      "Lured into the city by a ruse and acclaimed by the people over some bishops' objections, the monk Martin is consecrated bishop of Tours; he soon founds the monastery of Marmoutier nearby.",
    significance:
      "His ideal of the monk-bishop, and his cult, kept each year on 11 November, spread across the West.",
    citation: `${NA}09732b.htm`,
    links: { saints: ["saint-martin-of-tours"] },
  },
  {
    slug: "death-of-saint-athanasius",
    title: "Death of St Athanasius",
    year: 373,
    date: "0373-05-02",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Alexandria",
    context:
      "Athanasius dies in Alexandria after forty-five years as its bishop, many of them spent in exile.",
    significance:
      "Revered as the pillar of Nicene orthodoxy; eight years later the Council of Constantinople confirms the faith he defended.",
    citation: `${NA}02035a.htm`,
    links: { saints: ["saint-athanasius"], doctors: ["doctor-athanasius-of-alexandria"] },
  },
  {
    slug: "death-of-saint-ephrem",
    title: "Death of St Ephrem the Syrian",
    year: 373,
    precision: "year",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Edessa",
    context:
      "Ephrem dies in June 373 at Edessa, where he had spent his last ten years after leaving Nisibis when it was ceded to Persia.",
    significance:
      "His hymns, written to be sung by alternating choirs of consecrated women, earned him the name Harp of the Holy Spirit.",
    citation: `${NA}05498a.htm`,
    links: { doctors: ["doctor-ephrem-the-syrian"] },
  },
  {
    slug: "ambrose-becomes-bishop-of-milan",
    title: "St Ambrose becomes Bishop of Milan",
    year: 374,
    date: "0374-12-07",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Milan",
    context:
      "Ambrose, consular governor of Liguria and Aemilia, is acclaimed bishop while still a catechumen; he is baptised and, eight days later, consecrated.",
    significance:
      "Preacher, hymn-writer and defender of the Church's freedom before emperors, he becomes the great pastor-bishop of the West, and his preaching helps win Augustine.",
    citation: `${NA}01383c.htm`,
    links: { saints: ["saint-ambrose"], doctors: ["doctor-ambrose-of-milan"] },
  },
  {
    slug: "basil-on-the-holy-spirit",
    title: "St Basil writes On the Holy Spirit",
    year: 375,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["holy-spirit", "dogma", "doctor"],
    location: "Caesarea, Cappadocia",
    context:
      "Answering in part the Macedonians, who denied the divinity of the Spirit, Basil defends giving the Holy Spirit glory together with the Father and the Son.",
    significance:
      "The classic patristic treatise on the Holy Spirit, preparing the confession of the Spirit's divinity at Constantinople in 381.",
    citation: `${NA}02330b.htm`,
    links: { doctors: ["doctor-basil-the-great"] },
  },
  {
    slug: "gregory-of-nazianzus-theological-orations",
    title: "St Gregory of Nazianzus preaches the Theological Orations",
    year: 380,
    precision: "year",
    era: "fathers",
    kind: "document",
    tags: ["dogma", "doctor"],
    location: "Constantinople",
    context:
      "Shepherding the small Nicene community of Constantinople, Gregory delivers five discourses on the Trinity in the course of 380.",
    significance:
      "They earn him the title the Theologian; in 381 he briefly presides over the Council of Constantinople before resigning his see.",
    citation: `${NA}07010b.htm`,
    links: { doctors: ["doctor-gregory-of-nazianzus"] },
  },
  {
    slug: "egeria-pilgrimage",
    title: "Egeria's pilgrimage to the Holy Land",
    year: 381,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["liturgy"],
    location: "Jerusalem",
    context:
      "A Christian woman, probably from Hispania, travels through the holy places about 381–384 and writes a detailed account of her journey.",
    significance:
      "Her description of Jerusalem's liturgy, including Holy Week and the Easter vigil, is a unique window on early Christian worship; the text was rediscovered at Arezzo in 1884.",
    citation: `${W}Egeria_(pilgrim)`,
  },
  {
    slug: "altar-of-victory-controversy",
    title: "Ambrose answers Symmachus on the Altar of Victory",
    year: 384,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Milan and Rome",
    context:
      "When the senator Symmachus asks Valentinian II to restore the pagan Altar of Victory, removed from the Senate house by Gratian in 382, Ambrose persuades the young emperor to refuse.",
    significance:
      "A sign of paganism's waning hold on the Roman state; later petitions were turned away as well.",
    citation: `${W}Altar_of_Victory`,
    links: { doctors: ["doctor-ambrose-of-milan"] },
  },
  {
    slug: "siricius-decretal-to-himerius",
    title: "Pope Siricius's decretal to Himerius",
    year: 385,
    date: "0385-02-10",
    precision: "day",
    era: "fathers",
    kind: "document",
    tags: ["papacy"],
    location: "Rome → Tarragona",
    context:
      "Answering Bishop Himerius of Tarragona, Siricius rules on baptism, penance, church discipline and the celibacy of the clergy, and asks that his decisions be made known to neighbouring provinces.",
    significance: "The oldest papal decretal to survive complete.",
    citation: `${NA}14026a.htm`,
    links: { popes: ["pope-saint-siricius"] },
  },
  {
    slug: "execution-of-priscillian",
    title: "Execution of Priscillian",
    year: 385,
    precision: "circa",
    era: "fathers",
    kind: "event",
    location: "Trier",
    context:
      "Accused by Bishop Ithacius, the Spanish ascetic teacher Priscillian is convicted of sorcery under the usurper Maximus and put to death with several followers.",
    significance:
      "Ambrose and Pope Siricius condemned the bishops responsible and Martin of Tours protested; historians see it as the first killing of a Christian by Christians for heresy.",
    citation: `${W}Priscillian`,
    links: { saints: ["saint-martin-of-tours"], popes: ["pope-saint-siricius"] },
  },

  // ---------------------------------------------------------------- Ambrose and Augustine to Chalcedon
  {
    slug: "ambrose-holds-the-milan-basilicas",
    title: "Ambrose refuses to surrender the Milan basilicas",
    year: 386,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["liturgy", "doctor"],
    location: "Milan",
    context:
      "Pressed by the court of the Arian Empress Justina to give up one of Milan's basilicas for Arian worship, Ambrose and his people refuse to hand it over.",
    significance:
      "The struggle asserts the bishop's independence from the court and spurs the church chant of which Ambrose laid the foundation.",
    citation: `${NA}01383c.htm`,
    links: { saints: ["saint-ambrose"], doctors: ["doctor-ambrose-of-milan"] },
  },
  {
    slug: "paula-and-jerome-settle-at-bethlehem",
    title: "Paula and Jerome found monasteries at Bethlehem",
    year: 386,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Bethlehem",
    context:
      "Having left Rome in 385, the widow Paula, her daughter Eustochium and Jerome settle at Bethlehem, where two monasteries are founded, one for men and one for women.",
    significance:
      "Bethlehem becomes Jerome's home for the rest of his life and the workshop of his biblical translation and commentary.",
    citation: `${NA}11582a.htm`,
    links: { saints: ["saint-jerome"], doctors: ["doctor-jerome"] },
  },
  {
    slug: "massacre-of-thessalonica-and-penance-of-theodosius",
    title: "Massacre of Thessalonica and Theodosius's penance",
    year: 390,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Thessalonica and Milan",
    context:
      "In revenge for a riot, Theodosius I orders a massacre in which thousands of the people of Thessalonica die; Ambrose bars him from church until he has done public penance.",
    significance:
      "An emperor submits to a bishop's judgment and does penance before the congregation, a landmark for the Church's moral authority over rulers.",
    citation: `${NA}14577d.htm`,
    links: { saints: ["saint-ambrose"], doctors: ["doctor-ambrose-of-milan"] },
  },
  {
    slug: "theodosius-bans-pagan-sacrifice",
    title: "Theodosius bans pagan sacrifice",
    year: 391,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Roman Empire",
    context:
      "Imperial decrees forbid sacrifice and the frequenting of temples, and in Alexandria soldiers demolish the great Serapeum after rioting in the city.",
    significance: "Public pagan worship loses its legal footing across the empire.",
    citation: `${W}Theodosian_decrees`,
  },
  {
    slug: "augustine-becomes-bishop-of-hippo",
    title: "St Augustine becomes Bishop of Hippo",
    year: 395,
    precision: "circa",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Hippo Regius",
    context:
      "Ordained a priest at Hippo in 391, Augustine is made coadjutor bishop in 395 and soon succeeds as bishop, keeping a monastic way of life in the bishop's house.",
    significance:
      "For some thirty-five years he preaches, governs and writes from this African port town, shaping the theology of the Latin West.",
    citation: `${W}Augustine_of_Hippo`,
    links: { saints: ["saint-augustine-of-hippo"], doctors: ["doctor-augustine-of-hippo"] },
  },
  {
    slug: "death-of-saint-ambrose",
    title: "Death of St Ambrose",
    year: 397,
    date: "0397-04-04",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Milan",
    context: "Ambrose dies at Milan on 4 April 397, after more than two decades as its bishop.",
    significance:
      "With Jerome, Augustine and Gregory the Great he is counted among the four great Doctors of the Latin Church.",
    citation: `${NA}01383c.htm`,
    links: { saints: ["saint-ambrose"], doctors: ["doctor-ambrose-of-milan"] },
  },
  {
    slug: "augustine-writes-the-confessions",
    title: "St Augustine writes the Confessions",
    year: 397,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["doctor"],
    location: "Hippo Regius",
    context:
      "In thirteen books addressed to God, Augustine recounts his restless and sinful youth and his conversion to Christ.",
    significance:
      "One of the most influential works of Western spirituality, often called the first autobiography.",
    citation: `${W}Confessions_(Augustine)`,
    links: { saints: ["saint-augustine-of-hippo"], doctors: ["doctor-augustine-of-hippo"] },
  },
  {
    slug: "chrysostom-becomes-bishop-of-constantinople",
    title: "St John Chrysostom becomes Bishop of Constantinople",
    year: 398,
    date: "0398-02-26",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Constantinople",
    context:
      "The renowned preacher of Antioch is brought to the capital and consecrated its bishop on 26 February 398.",
    significance:
      "He reforms the clergy and preaches against the extravagance of the rich, winning the people but turning the court, and at length the empress, against him.",
    citation: `${NA}08452b.htm`,
    links: { saints: ["saint-john-chrysostom"], doctors: ["doctor-john-chrysostom"] },
  },
  {
    slug: "mesrop-mashtots-armenian-alphabet",
    title: "Mesrop Mashtots creates the Armenian alphabet",
    year: 405,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["scripture"],
    location: "Armenia",
    context:
      "With the backing of Catholicos Sahak and King Vramshapuh, Mesrop devises an alphabet for Armenian; the first sentence written in it comes from the Book of Proverbs.",
    significance:
      "The Bible is soon translated into Armenian, founding a Christian literature and culture for the nation.",
    citation: `${W}Mesrop_Mashtots`,
  },
  {
    slug: "death-of-saint-john-chrysostom",
    title: "Death of St John Chrysostom in exile",
    year: 407,
    date: "0407-09-14",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Comana, Pontus",
    context:
      "Deposed through the intrigues of Theophilus of Alexandria and exiled again in 404, Chrysostom dies at Comana as soldiers force him on toward a remoter place of exile.",
    significance:
      "Pope Innocent I and the Western bishops had stood by him; his eloquence earned him the name Chrysostom, the golden-mouthed.",
    citation: `${NA}08452b.htm`,
    links: {
      saints: ["saint-john-chrysostom"],
      doctors: ["doctor-john-chrysostom"],
      popes: ["pope-saint-innocent-i"],
    },
  },
  {
    slug: "synod-of-seleucia-ctesiphon",
    title: "Synod of Seleucia-Ctesiphon organises the Church of the East",
    year: 410,
    precision: "year",
    era: "fathers",
    kind: "council",
    location: "Seleucia-Ctesiphon, Persia",
    context:
      "Convened under King Yazdegerd I, who had allowed Christians to worship openly, and presided over by Mar Isaac, the bishops of Persia adopt the Nicene Creed and arrange their Church in provinces.",
    significance:
      "The Persian Church gains a legal footing and a structure under the bishop of the capital, later styled the Catholicos.",
    citation: `${W}Synod_of_Seleucia-Ctesiphon`,
  },
  {
    slug: "honoratus-founds-lerins",
    title: "Honoratus founds the monastery of Lérins",
    year: 410,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Lérins Islands, Provence",
    context:
      "Honoratus settles on an island off the coast of Provence and founds a monastery there around 410.",
    significance:
      "Lérins becomes a nursery of bishops and writers for Gaul, among them Hilary and Caesarius of Arles and Vincent of Lérins.",
    citation: `${W}L%C3%A9rins_Abbey`,
  },
  {
    slug: "conference-of-carthage-411",
    title: "Conference of Carthage with the Donatists",
    year: 411,
    precision: "year",
    era: "fathers",
    kind: "council",
    tags: ["schism", "doctor"],
    location: "Carthage",
    context:
      "In June 411, 286 Catholic and 279 Donatist bishops meet before the emperor's representative Marcellinus; Augustine argues the Catholic case, and Marcellinus rules for the Catholics on every point.",
    significance:
      "Augustine's defence of a Church that bears with sinners in order to convert them prevails, and Donatism dwindles away over the following decades.",
    citation: `${NA}02084a.htm`,
    links: { saints: ["saint-augustine-of-hippo"], doctors: ["doctor-augustine-of-hippo"] },
  },
  {
    slug: "john-cassian-founds-monasteries-at-marseille",
    title: "John Cassian founds monasteries at Marseille",
    year: 415,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Marseille",
    context:
      "After years among the monks of Egypt, Cassian founds a monastery for men over the tomb of St Victor and another for women, and later writes his Institutes and Conferences.",
    significance:
      "His books bring the wisdom of the desert to the West and were drawn on by St Benedict, though his teaching on grace was later judged Semipelagian.",
    citation: `${NA}03404a.htm`,
  },
  {
    slug: "murder-of-hypatia",
    title: "Murder of Hypatia",
    year: 415,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Alexandria",
    context:
      "During Lent 415 a Christian mob led by a lector named Peter kills the pagan philosopher Hypatia, an adviser to the prefect Orestes in his feud with Bishop Cyril.",
    significance:
      "A crime long remembered against the church of Alexandria; no firm evidence ties Cyril to it, though the bitter feud around him helped set it in motion.",
    citation: `${W}Hypatia`,
  },
  {
    slug: "innocent-i-condemns-pelagius",
    title: "Pope Innocent I confirms the condemnation of Pelagius",
    year: 417,
    date: "0417-01-27",
    precision: "day",
    era: "fathers",
    kind: "pope",
    tags: ["grace", "papacy"],
    location: "Rome",
    context:
      "Answering the African councils of Carthage and Milevis, Innocent excludes Pelagius and Caelestius from communion until they repent.",
    significance:
      "Augustine hailed the replies as closing the case, though Pope Zosimus briefly reopened it later that year.",
    citation: `${NA}11604a.htm`,
    links: { popes: ["pope-saint-innocent-i"], doctors: ["doctor-augustine-of-hippo"] },
  },
  {
    slug: "council-of-carthage-418",
    title: "Council of Carthage condemns Pelagianism",
    year: 418,
    date: "0418-05-01",
    precision: "day",
    era: "fathers",
    kind: "council",
    tags: ["grace"],
    location: "Carthage",
    context:
      "The African bishops brand Pelagianism a heresy in canons on original sin, the baptism of infants and the need of grace for good works.",
    significance:
      "Pope Zosimus's circular letter then demands its condemnation across the Church, and these canons become a norm of Catholic teaching on grace.",
    citation: `${NA}11604a.htm`,
    links: { doctors: ["doctor-augustine-of-hippo"] },
  },
  {
    slug: "death-of-saint-jerome",
    title: "Death of St Jerome",
    year: 420,
    date: "0420-09-30",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["doctor", "scripture"],
    location: "Bethlehem",
    context:
      "Jerome dies at Bethlehem after more than thirty years of translating and expounding the Scriptures there.",
    significance:
      "His Latin Bible and commentaries make him the Church's model of biblical scholarship.",
    citation: `${NA}08341a.htm`,
    links: { saints: ["saint-jerome"], doctors: ["doctor-jerome"] },
  },
  {
    slug: "augustine-completes-the-city-of-god",
    title: "St Augustine completes The City of God",
    year: 426,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["doctor"],
    location: "Hippo Regius",
    context:
      "Augustine finishes the twenty-two books he had begun to answer the charge that Christianity was to blame for Rome's decline.",
    significance:
      "Its picture of history as the story of two cities, the earthly and the heavenly, shaped Christian thought on Church and society for centuries.",
    citation: `${W}The_City_of_God`,
    links: { saints: ["saint-augustine-of-hippo"], doctors: ["doctor-augustine-of-hippo"] },
  },
  {
    slug: "nestorius-preaches-against-theotokos",
    title: "Nestorius preaches against the title Theotokos",
    year: 428,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["dogma", "marian"],
    location: "Constantinople",
    context:
      "Soon after his consecration as Patriarch of Constantinople in April 428, Nestorius preaches against calling Mary Theotokos, the Mother of God, stirring protest among clergy and people.",
    significance:
      "Cyril of Alexandria and Pope Celestine take up the case, and the Council of Ephesus upholds the title in 431.",
    citation: `${NA}10755a.htm`,
    links: { popes: ["pope-saint-celestine-i"], doctors: ["doctor-cyril-of-alexandria"] },
  },
  {
    slug: "germanus-of-auxerre-mission-to-britain",
    title: "Germanus of Auxerre's mission to Britain",
    year: 429,
    precision: "year",
    era: "fathers",
    kind: "mission",
    location: "Britain",
    context:
      "Answering an appeal from the British bishops, and with Pope Celestine's backing, the bishops of Gaul send Germanus of Auxerre and Lupus of Troyes to confront the Pelagians, whom they meet in debate at St Albans.",
    significance:
      "Catholic teaching on grace is upheld in Britain, the homeland of Pelagius himself.",
    citation: `${NA}06472b.htm`,
    links: { popes: ["pope-saint-celestine-i"] },
  },
  {
    slug: "palladius-sent-to-the-irish",
    title: "Pope Celestine sends Palladius to the Irish",
    year: 431,
    precision: "year",
    era: "fathers",
    kind: "mission",
    location: "Ireland",
    context:
      "Celestine I sends Palladius as the first bishop for the Irish who already believe in Christ.",
    significance:
      "The first recorded papal mission to Ireland; Palladius soon leaves the island and dies in Britain the following year.",
    citation: `${NA}03477c.htm`,
    links: { popes: ["pope-saint-celestine-i"] },
  },
  {
    slug: "formula-of-reunion",
    title: "Formula of Reunion between Cyril and John of Antioch",
    year: 433,
    precision: "year",
    era: "fathers",
    kind: "document",
    tags: ["dogma"],
    location: "Alexandria and Antioch",
    context:
      "In April 433 Cyril of Alexandria and John of Antioch, estranged since the Council of Ephesus, are reconciled by accepting a shared confession of Christ in two natures joined without confusion.",
    significance:
      "It heals the breach left by Ephesus and supplies much of the language of the definition of Chalcedon.",
    citation: `${W}Chalcedonian_schism`,
    links: { doctors: ["doctor-cyril-of-alexandria"] },
  },
  {
    slug: "peter-chrysologus-bishop-of-ravenna",
    title: "St Peter Chrysologus becomes Bishop of Ravenna",
    year: 433,
    precision: "year",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Ravenna",
    context:
      "Peter is raised to the metropolitan see of Ravenna, where he enjoys the patronage of the Empress Galla Placidia.",
    significance:
      "His preaching wins him the name Chrysologus, the golden-worded, and a collection of 176 of his sermons survives.",
    citation: `${NA}11762c.htm`,
    links: { doctors: ["doctor-peter-chrysologus"] },
  },
  {
    slug: "sixtus-iii-dedicates-saint-mary-major",
    title: "Pope Sixtus III dedicates St Mary Major",
    year: 434,
    precision: "circa",
    era: "fathers",
    kind: "event",
    tags: ["marian"],
    location: "Esquiline Hill, Rome",
    context:
      "Honouring the Council of Ephesus's proclamation of Mary as Mother of God, Pope Sixtus III builds and consecrates the great basilica on the Esquiline, with mosaics that survive to this day.",
    significance:
      "Rome's largest Marian church, regarded as the first Marian sanctuary and the mother of all Marian shrines.",
    citation: `${W}Santa_Maria_Maggiore`,
  },
  {
    slug: "vincent-of-lerins-commonitorium",
    title: "St Vincent of Lérins writes the Commonitorium",
    year: 434,
    precision: "year",
    era: "fathers",
    kind: "document",
    tags: ["dogma"],
    location: "Lérins",
    context:
      "Writing under the name Peregrinus, the monk Vincent sets out a test for true doctrine: hold fast to what has been believed everywhere, always and by all.",
    significance:
      "His picture of doctrine growing like a seed while keeping the same meaning has guided Catholic thinking on tradition ever since, though he himself leaned toward Semipelagianism.",
    citation: `${NA}15439b.htm`,
  },
  {
    slug: "leo-the-great-becomes-pope",
    title: "St Leo the Great becomes pope",
    year: 440,
    date: "0440-09-29",
    precision: "day",
    era: "fathers",
    kind: "pope",
    tags: ["papacy", "doctor"],
    location: "Rome",
    context:
      "Leo, a deacon of the Roman Church, is elected while away in Gaul on an imperial mission and is consecrated on 29 September 440.",
    significance:
      "In twenty-one years as pope he defines the faith in Christ's two natures, shields Rome from Huns and Vandals, and sets out the Petrine office in sermons and letters.",
    citation: `${NA}09154b.htm`,
    links: {
      popes: ["pope-saint-leo-the-great"],
      saints: ["saint-leo-the-great"],
      doctors: ["doctor-leo-the-great"],
    },
  },
  {
    slug: "death-of-saint-cyril-of-alexandria",
    title: "Death of St Cyril of Alexandria",
    year: 444,
    precision: "year",
    era: "fathers",
    kind: "saint",
    tags: ["doctor"],
    location: "Alexandria",
    context: "Cyril dies in June 444 after nearly thirty-two years as Patriarch of Alexandria.",
    significance:
      "The champion of Ephesus and of Mary's title Mother of God, his teaching on the one Christ became a touchstone of orthodoxy; Leo XIII approved his feast as a Doctor of the Church.",
    citation: `${NA}04592b.htm`,
    links: { saints: ["saint-cyril-of-alexandria"], doctors: ["doctor-cyril-of-alexandria"] },
  },
  {
    slug: "tome-of-leo",
    title: "Pope Leo's Tome to Flavian",
    year: 449,
    date: "0449-06-13",
    precision: "day",
    era: "fathers",
    kind: "document",
    tags: ["dogma", "papacy"],
    location: "Rome → Constantinople",
    context:
      "Approving Flavian's condemnation of Eutyches, Pope Leo sends him a dogmatic letter setting out the faith in one Christ, true God and true man, in two natures.",
    significance:
      "Brushed aside at the Robber Synod that summer, it is acclaimed at Chalcedon in 451 as an expression of the Catholic faith.",
    citation: `${NA}06098c.htm`,
    links: { popes: ["pope-saint-leo-the-great"], doctors: ["doctor-leo-the-great"] },
  },
  {
    slug: "robber-synod-of-ephesus",
    title: "The Robber Synod of Ephesus",
    year: 449,
    date: "0449-08-08",
    precision: "day",
    era: "fathers",
    kind: "council",
    tags: ["dogma"],
    location: "Ephesus",
    context:
      "Presided over by Dioscorus of Alexandria, the synod restores Eutyches and deposes Flavian amid violence; the papal legate Hilarus protests in the pope's name and escapes, and Flavian dies in exile days later.",
    significance:
      "Leo names it a robbery, a latrocinium, declares all its acts null and absolves those it had condemned.",
    citation: `${NA}05495a.htm`,
    links: { popes: ["pope-saint-leo-the-great", "pope-saint-hilarius"] },
  },
  {
    slug: "saint-genevieve-and-the-huns",
    title: "St Genevieve rallies Paris against the Huns",
    year: 451,
    precision: "year",
    era: "fathers",
    kind: "saint",
    location: "Paris",
    context:
      "As Attila's Huns approach, the young consecrated virgin Genevieve urges the people of Paris to pray and do penance rather than flee, and the invaders turn toward Orléans.",
    significance:
      "The beginning of her role as protector of the city; she is venerated as the patroness of Paris.",
    citation: `${NA}06413f.htm`,
    links: { saints: ["saint-genevieve"] },
  },
  {
    slug: "battle-of-avarayr",
    title: "Battle of Avarayr",
    year: 451,
    date: "0451-05-26",
    precision: "day",
    era: "fathers",
    kind: "event",
    tags: ["persecution"],
    location: "Avarayr, Armenia",
    context:
      "Armenian Christians led by Vardan Mamikonian take the field against a Persian army sent to impose Zoroastrianism; the Persians win, and Vardan is slain with eight of his officers.",
    significance:
      "A defeat that proved a moral victory: Persia afterwards allowed the Armenians freedom of religion, and the Armenian Church honours Vardan as a saint.",
    citation: `${W}Battle_of_Avarayr`,
  },
  {
    slug: "vandal-sack-of-rome",
    title: "Vandal sack of Rome",
    year: 455,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Rome",
    context:
      "King Gaiseric's Vandals plunder Rome for two weeks in June 455, carrying off its treasures, many of its people and the empress Eudoxia.",
    significance:
      "Pope Leo persuades Gaiseric to spare the citizens from slaughter and the city's buildings from fire.",
    citation: `${W}Sack_of_Rome_(455)`,
    links: { popes: ["pope-saint-leo-the-great"] },
  },
  {
    slug: "death-of-saint-simeon-stylites",
    title: "Death of St Simeon Stylites",
    year: 459,
    date: "0459-09-02",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["monastic"],
    location: "Northern Syria",
    context:
      "Simeon dies after some thirty-six years living on top of a pillar, from which he preached to the crowds who came to him.",
    significance:
      "The first and most famous of the pillar-dwelling ascetics; his fame spread as far as Western Europe.",
    citation: `${NA}13795a.htm`,
  },

  // ---------------------------------------------------------------- After Rome: kingdoms, schisms and monks
  {
    slug: "saint-brigid-founds-kildare",
    title: "St Brigid founds Kildare",
    year: 480,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Kildare, Ireland",
    context:
      "According to tradition, Brigid founds a double monastery for women and for men at Kildare around 480.",
    significance:
      "Kildare grows into a centre of religion and learning, and Brigid is honoured with Patrick and Columba as one of Ireland's three national saints.",
    citation: `${W}Brigid_of_Kildare`,
    links: { saints: ["saint-brigid-of-ireland"] },
  },
  {
    slug: "henotikon-of-zeno",
    title: "Emperor Zeno's Henotikon",
    year: 482,
    precision: "year",
    era: "fathers",
    kind: "document",
    tags: ["dogma"],
    location: "Constantinople",
    context:
      "Devised by Patriarch Acacius and issued by Zeno without any council, the formula of union condemns Nestorius and Eutyches and approves Cyril's anathemas while avoiding the question of Christ's one or two natures.",
    significance:
      "Meant to reconcile the opponents of Chalcedon, it satisfies neither side and leads to the Acacian Schism with Rome.",
    citation: `${W}Henotikon`,
  },
  {
    slug: "death-of-saint-severinus-of-noricum",
    title: "Death of St Severinus of Noricum",
    year: 482,
    date: "0482-01-08",
    precision: "day",
    era: "fathers",
    kind: "saint",
    tags: ["monastic"],
    location: "Favianae, Noricum",
    context:
      "Severinus, who since Attila's death had cared for the Roman frontier people along the Danube, organising refuge and food and founding monasteries at Passau and Favianae, dies in his cell at Favianae.",
    significance:
      "A saint of the collapsing frontier, respected even by the Germanic chieftain Odoacer; his disciple Eugippius preserved his story in a Life written in 511.",
    citation: `${W}Severinus_of_Noricum`,
  },
  {
    slug: "saint-sabbas-founds-the-great-lavra",
    title: "St Sabbas founds the Great Lavra",
    year: 484,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Kidron Valley, near Jerusalem",
    context:
      "The monk Sabbas founds a lavra of hermits' cells in the Kidron Valley south of Jerusalem, traditionally in 484, and is later made archimandrite of the region's anchorites.",
    significance:
      "Mar Saba long remains the most influential monastery in the region, and Sabbas a leading defender of Chalcedon against its opponents.",
    citation: `${W}Sabbas_the_Sanctified`,
  },
  {
    slug: "huneric-persecutes-african-catholics",
    title: "Huneric's persecution of the African Church",
    year: 484,
    precision: "year",
    era: "fathers",
    kind: "event",
    tags: ["persecution"],
    location: "Vandal North Africa",
    context:
      "After summoning Nicene and Arian bishops to Carthage in February 484, the Arian Vandal king Huneric strips the Catholic bishops of their sees and exiles some to Corsica; at Tipasa, Catholics have their tongues and right hands cut off.",
    significance:
      "The persecution for which his reign is chiefly remembered; his contemporary Victor of Vita wrote its history.",
    citation: `${W}Huneric`,
  },
  {
    slug: "gelasius-letter-on-the-two-powers",
    title: "Pope Gelasius I on the two powers",
    year: 494,
    precision: "year",
    era: "fathers",
    kind: "document",
    tags: ["papacy"],
    location: "Rome → Constantinople",
    context:
      "Writing to Emperor Anastasius I, Gelasius distinguishes the sacred authority of bishops from royal power, each independent in its own sphere and meant to work in harmony.",
    significance:
      "The classic statement of the two powers, which underlay Western thinking on Church and state for nearly a thousand years.",
    citation: `${W}Duo_sunt`,
    links: { popes: ["pope-saint-gelasius-i"] },
  },
  {
    slug: "laurentian-schism",
    title: "Laurentian Schism",
    year: 498,
    date: "0498-11-22",
    precision: "day",
    era: "fathers",
    kind: "schism",
    tags: ["schism", "papacy"],
    location: "Rome",
    context:
      "Most of the Roman clergy elect Symmachus while a minority elect the archpriest Laurentius; King Theodoric rules for Symmachus, but the quarrel revives when his opponents bring charges against him.",
    significance:
      "Rival factions fight for years in Rome until Theodoric has the city's churches restored to Symmachus and the Laurentian party collapses.",
    citation: `${NA}14377a.htm`,
  },
  {
    slug: "athanasian-creed",
    title: "The Athanasian Creed",
    year: 500,
    precision: "circa",
    era: "fathers",
    kind: "document",
    tags: ["dogma"],
    location: "Southern Gaul",
    context:
      "A Latin creed on the Trinity and the Incarnation, long attributed to Athanasius, is composed, most likely in southern Gaul in the late fifth or early sixth century.",
    significance:
      "Recited for centuries at Sunday Prime and still used on Trinity Sunday, it became a standard Western statement of faith in the Trinity and in Christ.",
    citation: `${W}Athanasian_Creed`,
  },
  {
    slug: "writings-of-pseudo-dionysius",
    title: "The writings of Pseudo-Dionysius",
    year: 500,
    precision: "circa",
    era: "fathers",
    kind: "document",
    context:
      "An unknown author writing at the close of the fifth century, under the name of Paul's Athenian convert Dionysius the Areopagite, composes treatises on the divine names, the heavenly and church hierarchies and mystical theology.",
    significance:
      "Long received as apostolic, they deeply shaped medieval theology and mysticism, from Albert the Great and Aquinas to the Rhineland mystics.",
    citation: `${NA}05013a.htm`,
  },
  {
    slug: "saint-benedict-at-subiaco",
    title: "St Benedict withdraws to Subiaco",
    year: 500,
    precision: "circa",
    era: "fathers",
    kind: "saint",
    tags: ["monastic"],
    location: "Subiaco",
    context:
      "Leaving Rome around 500, the young Benedict lives for three years as a hermit in a cave above the lake at Subiaco, then gathers disciples into twelve monasteries of twelve monks each.",
    significance:
      "The first form of the monastic life he later carried to Monte Cassino and set down in his Rule.",
    citation: `${NA}02467b.htm`,
    links: { saints: ["saint-benedict-of-nursia"] },
  },
  {
    slug: "first-council-of-orleans",
    title: "First Council of Orléans",
    year: 511,
    precision: "year",
    era: "fathers",
    kind: "council",
    location: "Orléans",
    context:
      "Summoned by Clovis, the bishops of the Frankish kingdom rule on the right of sanctuary in churches, the ordination of freemen, and the relations of monks with abbots and of abbots with bishops.",
    significance:
      "The first settlement between the Frankish state and the Church after Clovis's baptism.",
    citation: `${NA}11318a.htm`,
  },
  {
    slug: "caesarius-of-arles-rule-for-nuns",
    title: "Caesarius of Arles writes a rule for nuns",
    year: 512,
    precision: "year",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Arles",
    context:
      "Bishop Caesarius gives the community of women he founded at Arles, led by his sister Caesaria, a Rule for Virgins.",
    significance:
      "The first rule in the West written specifically for women, with lifelong enclosure as its hallmark.",
    citation: `${W}Caesarius_of_Arles`,
  },
  {
    slug: "martyrs-of-najran",
    title: "Martyrs of Najran",
    year: 523,
    precision: "circa",
    era: "fathers",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Najran, Arabia",
    context:
      "The Himyarite king Dhu Nuwas has the Christians of Najran put to death; their leader al-Harith, known as Arethas, is among the dead, though the numbers given vary widely.",
    significance:
      "They are honoured as martyrs in East and West, and the outrage brings an army from Christian Aksum, at Byzantium's request, to overthrow Dhu Nuwas.",
    citation: `${W}Christian_community_of_Najran`,
  },
  {
    slug: "boethius-consolation-of-philosophy",
    title: "Boethius writes The Consolation of Philosophy",
    year: 524,
    precision: "circa",
    era: "fathers",
    kind: "document",
    location: "Pavia",
    context:
      "Accused of disloyalty to the Ostrogothic king Theodoric, the Roman statesman Boethius is imprisoned and condemned unheard; in prison he writes his Consolation before he is executed.",
    significance:
      "A classic of Western literature; his translations of Aristotle taught the medieval schools, and Pavia honours him as St Severinus Boethius.",
    citation: `${NA}02610b.htm`,
  },
  {
    slug: "dionysius-exiguus-anno-domini",
    title: "Dionysius Exiguus counts the years from the Incarnation",
    year: 525,
    precision: "year",
    era: "fathers",
    kind: "event",
    tags: ["liturgy"],
    location: "Rome",
    context:
      "Preparing an Easter table at the request of Pope John I, the monk Dionysius numbers the years from the Incarnation instead of from the reign of Diocletian, a persecutor he did not wish to commemorate.",
    significance: "The origin of the Anno Domini era by which the years are still counted.",
    citation: `${W}Dionysius_Exiguus`,
  },
  {
    slug: "pope-john-i-dies-in-prison",
    title: "Pope John I dies in Theodoric's prison",
    year: 526,
    precision: "year",
    era: "fathers",
    kind: "martyrdom",
    tags: ["papacy"],
    location: "Ravenna",
    context:
      "Forced by Theodoric to lead an embassy to Constantinople about Emperor Justin's measures against the Arians, John is received there with great honour, but on his return he is imprisoned at Ravenna and dies in May 526.",
    significance: "The Latin Church honours him as a martyr.",
    citation: `${NA}08421a.htm`,
  },
  {
    slug: "john-ii-takes-a-new-name",
    title: "John II, the first pope to take a new name",
    year: 533,
    date: "0533-01-02",
    precision: "day",
    era: "fathers",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Mercurius, a priest of the Roman church of St Clement, is consecrated pope and takes the name John.",
    significance:
      "He seems to be the first pope to change his name on election, a custom that later became the rule.",
    citation: `${NA}08421b.htm`,
  },
  {
    slug: "agapetus-deposes-anthimus",
    title: "Pope Agapetus I deposes Patriarch Anthimus",
    year: 536,
    precision: "year",
    era: "fathers",
    kind: "pope",
    tags: ["papacy"],
    location: "Constantinople",
    context:
      "Sent to Constantinople by the Gothic king Theodahad, Agapetus refuses to deal with Patriarch Anthimus, who had left his see of Trebizond uncanonically and sided with the crypto-Monophysites, then deposes him and consecrates Mennas in his place.",
    significance:
      "A rare act of papal judgment within the imperial capital itself; Agapetus dies there in April 536.",
    citation: `${NA}01202c.htm`,
  },
  {
    slug: "deposition-of-pope-silverius",
    title: "Deposition of Pope Silverius",
    year: 537,
    precision: "year",
    era: "fathers",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "With Byzantine forces holding Rome, Silverius is accused through a forged letter of plotting with the Goths, arrested in March 537 and exiled; Vigilius, favoured by the Empress Theodora, is consecrated in his place.",
    significance:
      "A low point of imperial interference in the papacy; Silverius dies in exile and is later venerated as a saint.",
    citation: `${NA}13793a.htm`,
    links: { popes: ["pope-vigilius"] },
  },
  {
    slug: "dedication-of-hagia-sophia",
    title: "Dedication of Hagia Sophia",
    year: 537,
    date: "0537-12-27",
    precision: "day",
    era: "fathers",
    kind: "event",
    location: "Constantinople",
    context:
      "Justinian and Patriarch Menas inaugurate the new church of Holy Wisdom, raised in under six years by the architects Anthemius of Tralles and Isidore of Miletus.",
    significance:
      "The largest church in the world for more than five hundred years and the heart of Byzantine worship.",
    citation: `${W}Hagia_Sophia`,
  },
  {
    slug: "nobatia-accepts-christianity",
    title: "Nobatia in Nubia adopts Christianity",
    year: 543,
    precision: "year",
    era: "fathers",
    kind: "mission",
    location: "Nobatia (Nubia)",
    context:
      "The Nubian kingdom of Nobatia officially adopts Christianity in its Coptic, Miaphysite form, after years in which the faith had been spreading among its people.",
    significance:
      "The beginning of Christian Nubia; the faith then spread through the kingdom at varying speeds, reaching the villages only in the seventh to ninth centuries.",
    citation: `${W}Nobatia`,
  },
  {
    slug: "jacob-baradaeus-builds-a-miaphysite-hierarchy",
    title: "Jacob Baradaeus builds a separate Miaphysite hierarchy",
    year: 543,
    precision: "circa",
    era: "fathers",
    kind: "schism",
    tags: ["schism"],
    location: "Edessa and the East",
    context:
      "Consecrated bishop of Edessa in Constantinople in 543 or 544 by the exiled Patriarch Theodosius of Alexandria, Jacob travels through Mesopotamia, Asia Minor, Syria, Palestine and Egypt ordaining non-Chalcedonian clergy.",
    significance:
      "The opponents of Chalcedon gain a hierarchy of their own, and the Syriac Orthodox Church comes to be called Jacobite after him.",
    citation: `${W}Jacob_Baradaeus`,
  },
  {
    slug: "cassiodorus-founds-vivarium",
    title: "Cassiodorus founds Vivarium",
    year: 544,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Squillace, Calabria",
    context:
      "Retired from public life, the Roman statesman Cassiodorus founds a monastery near Squillace where monks copy, preserve and study sacred and classical texts.",
    significance:
      "Its library and centre of biblical study make it a model for the monastic preservation of learning in the West.",
    citation: `${W}Vivarium_(monastery)`,
  },
  {
    slug: "saint-ciaran-founds-clonmacnoise",
    title: "St Ciarán founds Clonmacnoise",
    year: 544,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Clonmacnoise, Ireland",
    context:
      "Ciarán and seven companions found a monastery where the main road across central Ireland crosses the River Shannon.",
    significance:
      "It grows into one of Ireland's great centres of religion and learning, known for its manuscripts, annals and high crosses.",
    citation: `${W}Clonmacnoise`,
  },
  {
    slug: "vigilius-taken-to-constantinople",
    title: "Pope Vigilius taken to Constantinople",
    year: 545,
    precision: "year",
    era: "fathers",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome → Constantinople",
    context:
      "On imperial orders Vigilius is taken from Rome in November 545 and kept for years in Constantinople, where he suffers much for refusing Justinian concessions on the Three Chapters.",
    significance:
      "He finally accepts the verdict of the council of 553 and dies at Syracuse on his way home in 555, a stark instance of imperial pressure on the papacy.",
    citation: `${NA}15427b.htm`,
    links: { popes: ["pope-vigilius"] },
  },
  {
    slug: "martin-of-braga-and-the-suebi",
    title: "Martin of Braga and the conversion of the Suebi",
    year: 550,
    precision: "circa",
    era: "fathers",
    kind: "mission",
    location: "Gallaecia",
    context:
      "Arriving by sea around 550, Martin founds monasteries, the best known at Dumium near Braga, and helps bring the Suebian kingdom from Arianism to the Catholic faith.",
    significance:
      "As metropolitan of Braga he shapes the Church of north-western Iberia, and his sermon On the Correction of Rustics addresses lingering pagan customs.",
    citation: `${W}Martin_of_Braga`,
  },
  {
    slug: "schism-of-the-three-chapters",
    title: "Schism of the Three Chapters",
    year: 553,
    precision: "year",
    era: "fathers",
    kind: "schism",
    tags: ["schism"],
    location: "Northern Italy",
    context:
      "Holding that the condemnation of the Three Chapters by Justinian and the council of 553 betrays Chalcedon, the bishops of Aquileia, Milan, Istria and neighbouring regions refuse to accept it and break communion with Rome.",
    significance:
      "Milan returns to communion around 581, but Aquileia ends the schism only at the Synod of Pavia in 698.",
    citation: `${W}Schism_of_the_Three_Chapters`,
  },
  {
    slug: "lombards-invade-italy",
    title: "The Lombards invade Italy",
    year: 568,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Northern Italy",
    context:
      "In the spring of 568 King Alboin leads the Lombards into Italy; some of them are still pagan, others Arian Christians.",
    significance:
      "Much of Italy passes under Lombard rule; the Catholic queen Theodelinda, a correspondent of Gregory the Great, later encourages their conversion.",
    citation: `${W}Lombards`,
  },
  {
    slug: "vexilla-regis-first-sung",
    title: "Vexilla Regis first sung at Poitiers",
    year: 569,
    date: "0569-11-19",
    precision: "day",
    era: "fathers",
    kind: "event",
    tags: ["liturgy"],
    location: "Poitiers",
    context:
      "Venantius Fortunatus writes the hymn for the procession that brings a relic of the True Cross, sent by Emperor Justin II at St Radegund's request, to her convent at Poitiers.",
    significance:
      "The hymn still belongs to the Church's Passiontide office and is recalled in the Good Friday liturgy.",
    citation: `${NA}15396a.htm`,
  },
  {
    slug: "gregory-becomes-bishop-of-tours",
    title: "St Gregory becomes Bishop of Tours",
    year: 573,
    precision: "year",
    era: "fathers",
    kind: "saint",
    location: "Tours",
    context: "Gregory succeeds Euphronius as bishop of Tours, the city of St Martin.",
    significance:
      "His ten-book History of the Franks preserves much of what is known of the early Frankish kingdom and its Church.",
    citation: `${NA}07018b.htm`,
  },
  {
    slug: "gregory-founds-saint-andrews-monastery",
    title: "Gregory turns his Roman home into St Andrew's monastery",
    year: 574,
    precision: "circa",
    era: "fathers",
    kind: "order",
    tags: ["monastic"],
    location: "Caelian Hill, Rome",
    context:
      "Leaving his office as prefect of Rome, Gregory gives his Sicilian estates to found six monasteries and makes his family house on the Caelian Hill into the monastery of St Andrew, where he becomes a monk.",
    significance:
      "The monastic formation of the future Pope Gregory the Great, who is drawn from St Andrew's into papal service and, in 590, to the papacy itself.",
    citation: `${NA}06780a.htm`,
    links: {
      popes: ["pope-saint-gregory-the-great"],
      saints: ["saint-gregory-the-great"],
      doctors: ["doctor-gregory-the-great"],
    },
  },
  {
    slug: "conversion-of-reccared",
    title: "Reccared and the Visigoths embrace the Catholic faith",
    year: 587,
    precision: "year",
    era: "fathers",
    kind: "event",
    location: "Toledo",
    context:
      "In January 587 the Visigothic king Reccared renounces Arianism for the Catholic faith, and most of the Arian nobles and clergy around him follow.",
    significance:
      "The turning point for Visigothic Spain, sealed two years later at the Third Council of Toledo.",
    citation: `${W}Reccared_I`,
  },
  {
    slug: "third-council-of-toledo",
    title: "Third Council of Toledo",
    year: 589,
    precision: "year",
    era: "fathers",
    kind: "council",
    tags: ["dogma", "liturgy"],
    location: "Toledo",
    context:
      "Convoked by Reccared and organised by Leander of Seville, the council hears the king renounce Arianism, and Arian bishops, clergy and Gothic nobles subscribe to the Catholic creeds.",
    significance:
      "It orders the Creed to be recited at Mass with the Filioque, a Western addition the Christian East never accepted.",
    citation: `${W}Third_Council_of_Toledo`,
  },
];
