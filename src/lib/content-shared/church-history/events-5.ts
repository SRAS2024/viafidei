import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";

/**
 * Church-history spine, part 5: the Apostolic Age and the age of persecutions
 * in depth, filling in around the headline events of part 1 — the apostles'
 * missions and deaths, the New Testament writings, the first bishops of Rome,
 * the persecutions and their named martyrs, the Apostolic Fathers and
 * Apologists, the early heresies and schisms, and the Church's spread from
 * Rome and Carthage to Alexandria, Edessa and Armenia. Where an event rests on
 * tradition rather than record (an apostle's mission or death, a martyr's
 * legend) the title or context says so.
 */
export const EVENTS_5: ChurchHistoryEvent[] = [
  // ---------------------------------------------------------------- Apostolic
  {
    slug: "saint-mark-founds-the-church-of-alexandria",
    title: "St Mark founds the Church of Alexandria (tradition)",
    year: 43,
    precision: "circa",
    era: "apostolic",
    kind: "mission",
    tags: ["mission"],
    location: "Alexandria",
    context:
      "Eusebius preserves the tradition that Mark, Peter's disciple, preached in Egypt and founded the church of Alexandria early in the reign of Claudius.",
    significance:
      "The great see of Alexandria has always traced its apostolic origin to Mark, though the written evidence for the tradition is comparatively late.",
    citation: `${NA}09672c.htm`,
    links: { saints: ["saint-mark-the-evangelist"] },
  },
  {
    slug: "claudius-expels-the-jews-from-rome",
    title: "Claudius expels the Jews from Rome",
    year: 49,
    precision: "circa",
    era: "apostolic",
    kind: "event",
    location: "Rome",
    context:
      "Suetonius records that Claudius banished the Jews from Rome over disturbances stirred up by one 'Chrestus'; Acts 18 says this is why Aquila and Priscilla came to Corinth, where they met Paul.",
    significance:
      "If, as many scholars think, 'Chrestus' means Christ, preaching about Jesus was already dividing Rome's synagogues, and Romans still saw it as a Jewish quarrel.",
    citation: `${W}Claudius%27_expulsion_of_Jews_from_Rome`,
  },
  {
    slug: "paul-brings-the-gospel-to-philippi",
    title: "Paul brings the Gospel to Europe at Philippi",
    year: 49,
    precision: "circa",
    era: "apostolic",
    kind: "mission",
    tags: ["mission"],
    location: "Philippi, Macedonia",
    context:
      "On his second missionary journey Paul crosses from Asia into Macedonia and preaches at Philippi, where the purple-cloth merchant Lydia of Thyatira is baptised with her household (Acts 16).",
    significance:
      "Believed to be Paul's first preaching on European soil, it founds one of Europe's oldest Christian communities, to which he later writes the Letter to the Philippians.",
    citation: `${W}Philippi`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "first-letter-to-the-thessalonians",
    title: "First Letter to the Thessalonians",
    year: 50,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["scripture"],
    location: "Corinth → Thessalonica",
    context:
      "Probably from Corinth, Paul writes to encourage the young church of Thessalonica, founded on the same journey, and to answer its questions about believers who have died before the Lord's coming.",
    significance:
      "Widely regarded as the oldest surviving Christian writing and among the first New Testament books to be composed.",
    citation: `${W}First_Epistle_to_the_Thessalonians`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "paul-at-corinth-before-gallio",
    title: "Paul at Corinth before the proconsul Gallio",
    year: 51,
    precision: "circa",
    era: "apostolic",
    kind: "mission",
    tags: ["mission"],
    location: "Corinth",
    context:
      "While Paul spends a year and a half founding the church of Corinth, opponents bring him before the proconsul Gallio, who dismisses the case as a dispute about Jewish law (Acts 18).",
    significance:
      "Gallio's term in Achaea can be dated to about 51–52, making this the best-fixed date in Paul's life and an anchor for the chronology of the apostolic age.",
    citation: `${W}Lucius_Junius_Gallio_Annaeanus`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "saint-thomas-reaches-india",
    title: "St Thomas brings the Gospel to India (tradition)",
    year: 52,
    precision: "circa",
    era: "apostolic",
    kind: "mission",
    tags: ["mission"],
    location: "Muziris, Kerala",
    context:
      "The Saint Thomas Christians of Kerala hold that the Apostle Thomas landed at Muziris on the Malabar coast and founded seven communities there.",
    significance:
      "It is the founding story of India's ancient Saint Thomas Christians, though historians still debate whether the Apostle himself made the journey.",
    citation: `${W}Thomas_the_Apostle`,
    links: { saints: ["saint-thomas-the-apostle"] },
  },
  {
    slug: "paul-at-ephesus",
    title: "Paul's ministry at Ephesus",
    year: 53,
    precision: "circa",
    era: "apostolic",
    kind: "mission",
    tags: ["mission"],
    location: "Ephesus",
    context:
      "On his third journey Paul teaches daily in the lecture hall of Tyrannus for over two years, until the silversmith Demetrius, fearing for the trade in shrines of Artemis, stirs up a riot in the theatre (Acts 19).",
    significance:
      "From Ephesus the Gospel spreads through the Roman province of Asia, which becomes a heartland of early Christianity.",
    citation: `${NA}11567b.htm`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "first-letter-to-the-corinthians",
    title: "First Letter to the Corinthians",
    year: 54,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["scripture"],
    location: "Ephesus → Corinth",
    context:
      "From Ephesus Paul writes to a quarrelsome church at Corinth about factions, marriage, food offered to idols, disorder at the Lord's Supper and doubts about the resurrection.",
    significance:
      "It hands on one of the earliest summaries of the Easter faith (15:3–7), a tradition Paul says he himself received, together with his account of the Last Supper (11:23–26).",
    citation: `${W}First_Epistle_to_the_Corinthians`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "letter-to-the-romans",
    title: "Letter to the Romans",
    year: 57,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["scripture"],
    location: "Corinth → Rome",
    context:
      "Writing from Corinth to a church he has not yet visited, Paul sets out at length the Gospel of salvation through faith in Christ, offered to Jew and Gentile alike.",
    significance:
      "His most systematic letter shows a sizeable Christian community already established in Rome before his arrival, and it has shaped Christian theology ever since.",
    citation: `${W}Epistle_to_the_Romans`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "paul-arrested-in-jerusalem",
    title: "Paul arrested in Jerusalem",
    year: 57,
    precision: "circa",
    era: "apostolic",
    kind: "event",
    location: "Jerusalem → Caesarea",
    context:
      "Accused of bringing Gentiles into the Temple, Paul is seized by a crowd, taken into custody by the Roman tribune and held for two years at Caesarea, where he appeals to Caesar (Acts 21–26).",
    significance:
      "The appeal means his case must be heard in Rome, carrying the Apostle of the Gentiles to the capital of the empire.",
    citation: `${NA}11567b.htm`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "paul-shipwrecked-on-malta-reaches-rome",
    title: "Paul shipwrecked on Malta, then reaches Rome",
    year: 60,
    precision: "circa",
    era: "apostolic",
    kind: "mission",
    tags: ["mission"],
    location: "Malta → Rome",
    context:
      "Sent to Rome as a prisoner, Paul survives two weeks adrift in a storm and a shipwreck on Malta, winters on the island and reaches Rome in the spring (Acts 27–28).",
    significance:
      "Acts closes with Paul spending two years under house arrest in Rome, proclaiming the kingdom of God openly at the heart of the empire.",
    citation: `${NA}11567b.htm`,
    links: { saints: ["saint-paul"] },
  },
  {
    slug: "martyrdom-of-saint-andrew",
    title: "Martyrdom of St Andrew at Patras",
    year: 60,
    precision: "circa",
    era: "apostolic",
    kind: "martyrdom",
    location: "Patras, Achaia",
    context:
      "Tradition holds that Andrew, Peter's brother, is crucified at Patras in Achaia on the orders of the Roman governor, bound rather than nailed to prolong his suffering.",
    significance:
      "Honoured in East and West as the first-called Apostle; the X-shaped cross later linked with him is a much later, medieval tradition.",
    citation: `${NA}01471a.htm`,
    links: { saints: ["saint-andrew-the-apostle"] },
  },
  {
    slug: "martyrdom-of-saint-james-of-jerusalem",
    title: "Martyrdom of St James, bishop of Jerusalem",
    year: 62,
    precision: "circa",
    era: "apostolic",
    kind: "martyrdom",
    location: "Jerusalem",
    context:
      "In the gap between two Roman governors, the high priest Ananus has James, 'the brother of the Lord' and head of the Jerusalem church, condemned and stoned, as Josephus reports.",
    significance:
      "The leader who gave the decisive judgment at the Council of Jerusalem is honoured as the city's first bishop; Catholic tradition identifies him with the Apostle James the Less.",
    citation: `${W}James,_brother_of_Jesus`,
    links: { saints: ["saints-philip-and-james"] },
  },
  {
    slug: "gospel-of-mark-written",
    title: "The Gospel according to Mark",
    year: 65,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["scripture"],
    location: "Rome",
    context:
      "According to Papias, Mark, who had been Peter's interpreter, writes down what he remembered of Peter's preaching about the words and deeds of Jesus; tradition places the work in Rome.",
    significance:
      "It gives the Church Peter's apostolic preaching in written form, one of the four Gospels received everywhere.",
    citation: `${NA}09674b.htm`,
    links: { saints: ["saint-mark-the-evangelist", "saint-peter"] },
  },
  {
    slug: "linus-succeeds-saint-peter",
    title: "St Linus succeeds St Peter as bishop of Rome",
    year: 67,
    precision: "circa",
    era: "apostolic",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "The oldest Roman succession lists, Irenaeus's among them, record that the Apostles entrusted the leadership of the Roman church to Linus after Peter.",
    significance:
      "The first link in the succession of the bishops of Rome; Irenaeus identifies him with the Linus greeted in 2 Timothy 4:21.",
    citation: `${NA}09272b.htm`,
    links: { popes: ["pope-saint-linus"] },
  },
  {
    slug: "martyrdom-of-saint-thomas-at-mylapore",
    title: "Martyrdom of St Thomas at Mylapore (tradition)",
    year: 72,
    precision: "circa",
    era: "apostolic",
    kind: "martyrdom",
    location: "Mylapore, India",
    context:
      "According to Syrian Christian tradition, Thomas is killed with a spear on a hill near present-day Chennai and buried at Mylapore.",
    significance:
      "His reputed tomb at Mylapore has long drawn pilgrims and remains central to the identity of India's Saint Thomas Christians.",
    citation: `${W}Thomas_the_Apostle`,
    links: { saints: ["saint-thomas-the-apostle"] },
  },
  {
    slug: "didache-composed",
    title: "The Didache, a first-century church manual",
    year: 80,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["liturgy"],
    context:
      "An anonymous 'Teaching of the Twelve Apostles' gives moral instruction and rules for baptism in the name of the Father, Son and Holy Spirit, Wednesday and Friday fasts, Eucharistic thanksgivings and a Sunday assembly under bishops and deacons.",
    significance:
      "Rediscovered in 1873 after centuries of loss, it is one of the earliest windows on Christian worship and church order outside the New Testament.",
    citation: `${NA}04779a.htm`,
  },
  {
    slug: "gospel-of-matthew-written",
    title: "The Gospel according to Matthew",
    year: 80,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["scripture"],
    context:
      "A Gospel steeped in the Jewish Scriptures presents Jesus as the promised Messiah and gathers his teaching into great discourses such as the Sermon on the Mount; Papias is the first to name Matthew as its author.",
    significance:
      "The early Church quoted it more than any other Gospel and placed it first in the canon.",
    citation: `${W}Gospel_of_Matthew`,
    links: { saints: ["saint-matthew"] },
  },
  {
    slug: "gospel-of-luke-and-acts-written",
    title: "Luke's Gospel and the Acts of the Apostles",
    year: 85,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["scripture"],
    context:
      "A single author, identified by tradition as Luke the physician and companion of Paul, writes a two-part account running from the births of John the Baptist and Jesus to Paul preaching in Rome.",
    significance:
      "Acts is the only narrative history of the first Christian generation; Irenaeus is the first to record that Luke wrote the Gospel.",
    citation: `${W}Gospel_of_Luke`,
    links: { saints: ["saint-luke-the-evangelist"] },
  },
  {
    slug: "domitian-executes-flavius-clemens",
    title: "Domitian executes Flavius Clemens and exiles Domitilla",
    year: 95,
    precision: "year",
    era: "apostolic",
    kind: "event",
    tags: ["persecution"],
    location: "Rome",
    context:
      "Soon after sharing the consulship with Domitian, the emperor's cousin Titus Flavius Clemens is put to death on a charge of 'atheism', and his wife Flavia Domitilla is banished to the island of Pandateria.",
    significance:
      "Atheism was the usual charge against Christians, and later tradition honours both as believers — evidence, if so, that the faith had reached the imperial family.",
    citation: `${W}Titus_Flavius_Clemens_(consul)`,
  },
  {
    slug: "book-of-revelation-written",
    title: "The Book of Revelation written on Patmos",
    year: 95,
    precision: "circa",
    era: "apostolic",
    kind: "document",
    tags: ["scripture", "canon"],
    location: "Patmos",
    context:
      "On the island of Patmos a prophet named John records his visions of the risen Christ, with letters to seven churches of Asia, most likely near the end of Domitian's reign.",
    significance:
      "Irenaeus ascribes it to the Apostle John; long doubted in parts of the East, it was among the last books received into the canon.",
    citation: `${W}Book_of_Revelation`,
  },
  {
    slug: "evaristus-succeeds-clement",
    title: "St Evaristus succeeds Clement as bishop of Rome",
    year: 99,
    precision: "circa",
    era: "apostolic",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "The second-century papal lists name Evaristus as Clement's immediate successor, with a reign of about eight years spanning the turn of the century.",
    significance:
      "Little more than his place in the lists is known, but it carries the Roman succession from the apostolic generation into the second century.",
    citation: `${NA}05646a.htm`,
    links: { popes: ["pope-saint-evaristus"] },
  },

  // -------------------------------------------------------------- Persecution
  {
    slug: "martyrdom-of-simeon-of-jerusalem",
    title: "Martyrdom of St Simeon, bishop of Jerusalem",
    year: 107,
    precision: "circa",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Jerusalem",
    context:
      "Simeon son of Clopas, a cousin of the Lord who had succeeded James as head of the Jerusalem church, is executed under Trajan, about 107 according to Eusebius.",
    significance:
      "With him the Jerusalem church loses one of the last links between the Christian community and the Lord's own family.",
    citation: `${W}Simeon_of_Jerusalem`,
  },
  {
    slug: "polycarp-letter-to-the-philippians",
    title: "Polycarp's Letter to the Philippians",
    year: 108,
    precision: "circa",
    era: "persecution",
    kind: "document",
    location: "Smyrna → Philippi",
    context:
      "Bishop Polycarp of Smyrna urges the Philippians to steadfastness and sound teaching and, at their request, sends them the letters of Ignatius he has gathered.",
    significance:
      "As a covering letter it helped preserve the Ignatian letters, and its many echoes of apostolic writings show them already in use; the date is traditional, and some scholars place parts of it later.",
    citation: `${W}Epistle_of_Polycarp_to_the_Philippians`,
    links: { saints: ["saint-polycarp"] },
  },
  {
    slug: "papias-collects-the-sayings-of-the-lord",
    title: "Papias collects the sayings of the Lord",
    year: 125,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["scripture"],
    location: "Hierapolis, Phrygia",
    context:
      "Papias, bishop of Hierapolis and, Irenaeus says, a hearer of John and companion of Polycarp, gathers oral traditions about the Lord into five books of exposition.",
    significance:
      "Only fragments survive, but they hold the oldest statements on how the Gospels came to be: Mark recorded Peter's preaching, and Matthew wrote in the Hebrew tongue.",
    citation: `${NA}11457c.htm`,
  },
  {
    slug: "quadratus-and-aristides-apologies-to-hadrian",
    title: "First apologies presented to Emperor Hadrian",
    year: 125,
    precision: "circa",
    era: "persecution",
    kind: "document",
    location: "Athens",
    context:
      "During Hadrian's stay in Greece, Quadratus and the Athenian philosopher Aristides present written defences of the Christian faith to the emperor.",
    significance:
      "They begin the age of the Apologists, who answered slander by explaining Christian belief and life to educated pagans; Aristides' full text resurfaced in 1889 in a Syriac copy at Mount Sinai.",
    citation: `${NA}01712d.htm`,
  },
  {
    slug: "martyrdom-of-pope-telesphorus",
    title: "Martyrdom of Pope St Telesphorus",
    year: 136,
    precision: "circa",
    era: "persecution",
    kind: "martyrdom",
    tags: ["papacy", "persecution"],
    location: "Rome",
    context:
      "After about a decade as bishop of Rome, Telesphorus dies a martyr; Irenaeus, listing the Roman bishops, singles him out for his glorious witness.",
    significance:
      "He kept Easter on a Sunday yet stayed in communion with churches that followed another custom, an example Irenaeus later held up to Pope Victor.",
    citation: `${NA}14477b.htm`,
    links: { popes: ["pope-saint-telesphorus"] },
  },
  {
    slug: "valentinus-teaches-in-rome",
    title: "Valentinus brings Gnostic teaching to Rome",
    year: 138,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["heresy"],
    location: "Rome",
    context:
      "The Egyptian teacher Valentinus arrives in Rome under Pope Hyginus and teaches there into the time of Anicetus, spreading an elaborate Gnostic system of divine emanations and saving knowledge.",
    significance:
      "Tertullian says he had hoped to become bishop; his school became one of the most influential Gnostic movements, which Irenaeus set out to refute.",
    citation: `${W}Valentinus_(Gnostic)`,
  },
  {
    slug: "shepherd-of-hermas",
    title: "The Shepherd of Hermas written in Rome",
    year: 140,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["canon"],
    location: "Rome",
    context:
      "Hermas, said by the Muratorian fragment to be a brother of Pope Pius I, writes a book of visions, commandments and parables calling Christians who have sinned after baptism to repentance.",
    significance:
      "Widely read in the early churches and counted as Scripture by some, it is a key witness to the early practice of penance; later lists kept it out of the canon.",
    citation: `${NA}12126b.htm`,
    links: { popes: ["pope-saint-pius-i"] },
  },
  {
    slug: "marcion-breaks-with-the-church-of-rome",
    title: "Marcion breaks with the Church of Rome",
    year: 144,
    precision: "year",
    era: "persecution",
    kind: "schism",
    tags: ["heresy", "schism", "canon"],
    location: "Rome",
    context:
      "Marcion of Pontus, teaching that the God of the Old Testament is a lesser creator distinct from the good Father of Jesus, is cut off by the Roman church and founds a rival church.",
    significance:
      "His Bible — an edited Luke and ten letters of Paul, with no Old Testament — pressed the Church to say which writings it held as Scripture; Marcionite churches lasted for centuries.",
    citation: `${NA}09645c.htm`,
    links: { popes: ["pope-saint-pius-i"] },
  },
  {
    slug: "protoevangelium-of-james",
    title: "The Protoevangelium of James",
    year: 150,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["marian"],
    context:
      "An apocryphal account of Mary's own life names her parents Joachim and Anne and tells of her birth, her presentation in the Temple and her virginity before, during and after Christ's birth.",
    significance:
      "Never received as Scripture and later classed as apocryphal in the West, it nonetheless shaped Marian devotion and art, and it is the earliest surviving text to assert Mary's perpetual virginity.",
    citation: `${W}Gospel_of_James`,
  },
  {
    slug: "polycarp-visits-pope-anicetus",
    title: "Polycarp visits Pope Anicetus in Rome",
    year: 154,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["liturgy"],
    location: "Rome",
    context:
      "The aged bishop of Smyrna comes to Rome to confer with Anicetus; they cannot agree on Easter, Polycarp keeping the Asian date of 14 Nisan and Rome the Sunday.",
    significance:
      "Each kept his own custom without breaking communion, and Anicetus let his guest celebrate the Eucharist in his church — an early model of unity amid differing practice.",
    citation: `${W}Polycarp`,
    links: { saints: ["saint-polycarp"] },
  },
  {
    slug: "montanus-begins-the-new-prophecy",
    title: "Montanus launches the New Prophecy in Phrygia",
    year: 156,
    precision: "circa",
    era: "persecution",
    kind: "schism",
    tags: ["heresy", "schism"],
    location: "Ardabau, Phrygia",
    context:
      "Montanus begins to prophesy in ecstasy at Ardabau and, with the prophetesses Priscilla and Maximilla, proclaims a new outpouring of the Spirit and a stricter discipline.",
    significance:
      "The faithful of Asia judged the prophecies false and cut its followers off from the Church, yet its rigour later won over Tertullian.",
    citation: `${NA}10521a.htm`,
  },
  {
    slug: "shrine-built-over-saint-peters-grave",
    title: "A shrine marks St Peter's grave on the Vatican Hill",
    year: 160,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["papacy"],
    location: "Vatican Hill, Rome",
    context:
      "Roman Christians build a small niched monument over the grave they honour as Peter's; early in the next century the presbyter Gaius can point visitors to the 'trophies' of the apostles on the Vatican and the Ostian Way.",
    significance:
      "It is the oldest physical witness to the veneration of Peter's tomb, uncovered beneath St Peter's Basilica in the excavations begun in 1939.",
    citation: `${W}Saint_Peter%27s_tomb`,
    links: { saints: ["saint-peter"], popes: ["pope-saint-peter"] },
  },
  {
    slug: "martyrdom-of-saint-justin",
    title: "Martyrdom of St Justin and his companions",
    year: 165,
    precision: "circa",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Rome",
    context:
      "Justin, the philosopher who had defended the faith before the emperors, is tried with six companions by the prefect Rusticus and beheaded for refusing to sacrifice to the gods.",
    significance:
      "The authentic record of their trial preserves his calm confession; the Church has remembered him ever since simply as Justin Martyr.",
    citation: `${NA}08580c.htm`,
    links: { saints: ["saint-justin-martyr"] },
  },
  {
    slug: "tatian-composes-the-diatessaron",
    title: "Tatian's Diatessaron weaves the four Gospels into one",
    year: 168,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["scripture"],
    context:
      "Tatian, an Eastern convert and former pupil of Justin, combines the four Gospels into a single continuous narrative of the life of Christ.",
    significance:
      "Built only from the four Gospels, it shows them already set apart; it served as the Gospel text of parts of the Syriac Church for some three centuries.",
    citation: `${W}Diatessaron`,
  },
  {
    slug: "pope-soter-writes-to-corinth",
    title: "Pope Soter's letter and alms to Corinth",
    year: 170,
    precision: "circa",
    era: "persecution",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome → Corinth",
    context:
      "Bishop Dionysius of Corinth thanks Pope Soter for a letter and for keeping up Rome's custom of sending alms to needy churches and to Christians condemned to the mines.",
    significance:
      "Corinth read Soter's letter at its Sunday assembly, as it still read Clement's — a glimpse of Rome's care for distant churches.",
    citation: `${NA}03144c.htm`,
    links: { popes: ["pope-saint-soter"] },
  },
  {
    slug: "melito-of-sardis-on-the-pascha",
    title: "Melito of Sardis's homily On the Pascha",
    year: 170,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["liturgy", "canon"],
    location: "Sardis",
    context:
      "Melito, bishop of Sardis and a leading voice of the Asian churches, preaches a poetic Easter homily on Christ the true Passover and draws up the earliest known Christian list of Old Testament books.",
    significance:
      "Rediscovered only in 1940, the homily is also the first text to blame the Jewish people as a whole for Christ's death, a charge the Catholic Church repudiated at the Second Vatican Council.",
    citation: `${W}Melito_of_Sardis`,
  },
  {
    slug: "thundering-legion-rain-miracle",
    title: "The 'Thundering Legion' and the rain miracle",
    year: 174,
    precision: "circa",
    era: "persecution",
    kind: "event",
    location: "Danube frontier",
    context:
      "A sudden thunderstorm saves Marcus Aurelius's thirst-stricken army in its war against the Quadi; Christian writers credit the prayers of Christian soldiers of the Twelfth Legion, pagan ones Jupiter or an Egyptian magician.",
    significance:
      "The storm itself is well attested and became a favourite proof of the apologists that Christians were loyal subjects, though persecution grew harsher soon afterwards.",
    citation: `${NA}14711b.htm`,
  },
  {
    slug: "athenagoras-plea-for-the-christians",
    title: "Athenagoras's Plea for the Christians",
    year: 177,
    precision: "circa",
    era: "persecution",
    kind: "document",
    location: "Athens",
    context:
      "The Christian philosopher Athenagoras of Athens writes to Marcus Aurelius and Commodus refuting the charges of atheism, cannibalism and immorality laid against Christians.",
    significance:
      "A reasoned defence of one God and of the Christian reverence for human life, which already led believers to reject abortion.",
    citation: `${NA}02042b.htm`,
  },
  {
    slug: "celsus-attacks-christianity",
    title: "Celsus attacks Christianity in The True Word",
    year: 177,
    precision: "circa",
    era: "persecution",
    kind: "event",
    context:
      "The Platonist Celsus publishes a sweeping literary attack that mocks the Gospel story and Christian divisions and urges believers to return to the gods of the empire.",
    significance:
      "Christianity was now prominent enough to need refuting by intellectuals; some seventy years later Origen answered Celsus point by point, preserving most of his text.",
    citation: `${NA}03490a.htm`,
  },
  {
    slug: "theophilus-of-antioch-names-the-trinity",
    title: "Theophilus of Antioch first speaks of the 'Trinity'",
    year: 180,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["dogma"],
    location: "Antioch",
    context:
      "In his apology To Autolycus, Bishop Theophilus of Antioch calls God, his Word and his Wisdom a 'triad' (trias).",
    significance:
      "It is the earliest surviving Christian use of the word 'Trinity', the term that would become central to the Church's confession of God.",
    citation: `${W}Theophilus_of_Antioch`,
  },
  {
    slug: "pantaenus-leads-the-school-of-alexandria",
    title: "Pantaenus leads the catechetical school of Alexandria",
    year: 180,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["mission"],
    location: "Alexandria",
    context:
      "Pantaenus, a Sicilian-born Stoic philosopher turned Christian, teaches the faith in Alexandria and, Eusebius says, travels as far as India, finding Christians there who already have Matthew's Gospel.",
    significance:
      "Carried on by his pupil Clement and then by Origen, his school makes Alexandria a leading centre of Christian learning.",
    citation: `${W}Pantaenus`,
  },
  {
    slug: "muratorian-fragment",
    title: "The Muratorian fragment lists the New Testament books",
    year: 180,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["canon"],
    location: "Rome",
    context:
      "A Roman list of the writings read in the Church, known from an eighth-century Latin copy published by Muratori in 1740, names the Gospels, Acts, the letters of Paul, Jude, two letters of John and the Apocalypse.",
    significance:
      "The oldest known list of New Testament books shows a canon largely settled at Rome by the end of the second century; it rejects letters forged in Paul's name and allows the Shepherd of Hermas only for private reading.",
    citation: `${NA}10642a.htm`,
  },
  {
    slug: "scillitan-martyrs",
    title: "The Scillitan Martyrs",
    year: 180,
    date: "0180-07-17",
    precision: "day",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Carthage",
    context:
      "Twelve Christians from the North African town of Scilli, seven men and five women, refuse to swear by the emperor and are beheaded at Carthage on the orders of the proconsul Vigellius Saturninus.",
    significance:
      "The record of their trial is the oldest dated document of the Latin Church and the first witness to a Latin Bible.",
    citation: `${W}Scillitan_Martyrs`,
  },
  {
    slug: "martyrdom-of-apollonius-of-rome",
    title: "Martyrdom of Apollonius the Apologist",
    year: 185,
    precision: "circa",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Rome",
    context:
      "Apollonius, a learned Roman and perhaps a senator, is denounced as a Christian under Commodus and, after reading a defence of the faith before the Senate, is put to death.",
    significance:
      "His defence, which Eusebius collected among the acts of the martyrs, shows the faith reaching Rome's educated elite.",
    citation: `${W}Apollonius_the_Apologist`,
  },
  {
    slug: "pope-victor-and-the-easter-controversy",
    title: "Pope Victor I and the Easter controversy",
    year: 190,
    precision: "circa",
    era: "persecution",
    kind: "pope",
    tags: ["papacy", "liturgy"],
    location: "Rome",
    context:
      "Victor, an African by birth, has synods held across the Church on the date of Easter and threatens to cut off the churches of Asia, which under Polycrates of Ephesus keep the fourteenth of Nisan.",
    significance:
      "Synods from Palestine to Gaul back the Sunday Easter and Irenaeus urges restraint; the episode is an early and striking exercise of Roman authority over the wider Church.",
    citation: `${NA}15408a.htm`,
    links: {
      popes: ["pope-saint-victor-i"],
      saints: ["saint-irenaeus-of-lyon"],
      doctors: ["doctor-irenaeus-of-lyon"],
    },
  },
  {
    slug: "victor-excommunicates-theodotus",
    title: "Pope Victor I excommunicates Theodotus",
    year: 190,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["heresy", "dogma"],
    location: "Rome",
    context:
      "Theodotus, a leather-seller from Byzantium, teaches in Rome that Christ was a mere man empowered by the Holy Spirit at his baptism; Pope Victor expels him from the Church.",
    significance:
      "An early condemnation of 'adoptionism', the view that Jesus became Son of God only by adoption, which returned with Paul of Samosata.",
    citation: `${NA}10448a.htm`,
    links: { popes: ["pope-saint-victor-i"] },
  },
  {
    slug: "clement-of-alexandria-heads-the-school",
    title: "Clement of Alexandria heads the catechetical school",
    year: 190,
    precision: "circa",
    era: "persecution",
    kind: "event",
    location: "Alexandria",
    context:
      "Succeeding his teacher Pantaenus, Clement directs Christian instruction in Alexandria and writes the Exhortation to the Greeks, The Instructor and the Miscellanies.",
    significance:
      "He presents the faith as the true philosophy for educated pagans; the persecution of 202 drives him from the city, leaving the school to the young Origen.",
    citation: `${NA}04045a.htm`,
  },
  {
    slug: "tertullian-apologeticum",
    title: "Tertullian's Apology",
    year: 197,
    precision: "year",
    era: "persecution",
    kind: "document",
    location: "Carthage",
    context:
      "The Carthaginian convert Tertullian addresses the governors of the empire with a forceful legal and moral defence of Christians, condemning the injustice of punishing them for the name alone.",
    significance:
      "Its claim that the blood of Christians is seed became proverbial, and Tertullian's vigorous Latin helped shape the theological vocabulary of the West.",
    citation: `${NA}14520c.htm`,
  },
  {
    slug: "callixtus-takes-charge-of-the-appian-way-cemetery",
    title: "Zephyrinus entrusts the Appian Way cemetery to Callixtus",
    year: 200,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["papacy"],
    location: "Via Appia, Rome",
    context:
      "Pope Zephyrinus puts the deacon Callixtus in charge of a Christian burial ground on the Appian Way, which he enlarges into the catacomb that bears his name.",
    significance:
      "Its Crypt of the Popes received nine third-century bishops of Rome and St Cecilia was buried beside it; at its height it held perhaps half a million graves.",
    citation: `${W}Catacomb_of_Callixtus`,
    links: { popes: ["pope-saint-callixtus-i"], saints: ["saint-cecilia"] },
  },
  {
    slug: "alexamenos-graffito",
    title: "The Alexamenos graffito mocks Christian worship",
    year: 200,
    precision: "circa",
    era: "persecution",
    kind: "event",
    location: "Palatine Hill, Rome",
    context:
      "On a wall near the Palatine someone scratches a crucified figure with a donkey's head and a man raising his hand to it, captioned 'Alexamenos worships his god'.",
    significance:
      "Meant to ridicule a Christian, it is often called the earliest surviving image of Jesus and shows how absurd the worship of a crucified man seemed to pagans.",
    citation: `${W}Alexamenos_graffito`,
  },
  {
    slug: "epitaph-of-abercius",
    title: "The epitaph of Abercius",
    year: 200,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["liturgy"],
    location: "Hieropolis, Phrygia",
    context:
      "Abercius, probably bishop of Hieropolis in Phrygia, composes his own epitaph in veiled language, telling how faith everywhere fed him with the Fish, with bread and wine.",
    significance:
      "Carved before 216, it is among the oldest Christian inscriptions and a coded witness to the Eucharist; fragments found by William Ramsay are now in the Vatican Museums.",
    citation: `${W}Inscription_of_Abercius`,
  },
  {
    slug: "flood-destroys-the-church-of-edessa",
    title: "Flood at Edessa destroys the Christian church",
    year: 201,
    precision: "year",
    era: "persecution",
    kind: "event",
    location: "Edessa, Osroene",
    context:
      "The Chronicle of Edessa records that a great flood devastates the city and destroys its Christian church.",
    significance:
      "An early notice of a church building; Edessa, whose bishop Palut had been ordained by Serapion of Antioch, grows into the centre of Syriac-speaking Christianity.",
    citation: `${NA}05282a.htm`,
  },
  {
    slug: "leonides-martyred-under-septimius-severus",
    title: "Leonides martyred in the persecution of Septimius Severus",
    year: 202,
    precision: "year",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Alexandria",
    context:
      "Under Septimius Severus persecution falls on Alexandria; Leonides is beheaded and his property seized, while his teenage son Origen is kept from following him only because his mother hides his clothes.",
    significance:
      "The same wave of persecution claimed Perpetua and Felicity at Carthage the next year; Leonides' son grew into the foremost Christian scholar of his age.",
    citation: `${W}Leonides_of_Alexandria`,
  },
  {
    slug: "tertullian-embraces-montanism",
    title: "Tertullian embraces Montanism",
    year: 207,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["heresy"],
    location: "Carthage",
    context: "In mid-life Tertullian is drawn to the rigorist New Prophecy of the Montanists.",
    significance:
      "Even so his writings shaped Western theology: he is the first Latin writer known to call God a Trinity (trinitas), and his language of persons and substance entered the Church's vocabulary.",
    citation: `${W}Tertullian`,
  },
  {
    slug: "schism-of-hippolytus",
    title: "Schism of Hippolytus at Rome",
    year: 217,
    precision: "circa",
    era: "persecution",
    kind: "schism",
    tags: ["schism", "papacy"],
    location: "Rome",
    context:
      "The learned presbyter Hippolytus, who had accused Pope Zephyrinus of modalism, is scandalised when Callixtus I absolves Christians guilty of grave sins and lets himself be set up as a rival bishop of Rome.",
    significance:
      "Often counted the first antipope, he was probably reconciled before dying in exile with Pope Pontian, and the Church honours the two together as martyrs.",
    citation: `${W}Hippolytus_of_Rome`,
    links: { popes: ["pope-saint-callixtus-i", "pope-saint-pontian"] },
  },
  {
    slug: "pope-callixtus-excommunicates-sabellius",
    title: "Pope Callixtus I excommunicates Sabellius",
    year: 220,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["heresy", "dogma"],
    location: "Rome",
    context:
      "Sabellius, teaching in Rome that Father, Son and Holy Spirit are only successive modes of the one God, is excommunicated by Pope Callixtus.",
    significance:
      "Sabellianism became the classic name for modalism, which the Church rejected in confessing three distinct Persons in one God.",
    citation: `${NA}10448a.htm`,
    links: { popes: ["pope-saint-callixtus-i"] },
  },
  {
    slug: "origen-on-first-principles",
    title: "Origen's On First Principles",
    year: 225,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["dogma"],
    location: "Alexandria",
    context:
      "Origen sets out Christian teaching on God, creation, rational souls, free will and the interpretation of Scripture in one ordered treatise.",
    significance:
      "It is the first systematic exposition of Christian theology; some of its speculations, such as the final restoration of all things, were later rejected as heretical.",
    citation: `${W}On_First_Principles`,
  },
  {
    slug: "megiddo-christian-prayer-hall",
    title: "Christian prayer hall at Megiddo",
    year: 230,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["liturgy"],
    location: "Kefar 'Othnay, near Megiddo",
    context:
      "Christians, among them a Roman officer named Gaianus who pays for a mosaic, worship in a hall whose floor records the gift of a table 'to God Jesus Christ' as a memorial.",
    significance:
      "Found in 2005 and dated by its finds to about 230, though some argue for later, it is among the oldest church buildings known and bears an early inscription calling Christ God.",
    citation: `${W}Megiddo_church_(Israel)`,
  },
  {
    slug: "virgin-and-child-in-the-catacomb-of-priscilla",
    title: "Virgin and Child painted in the Catacomb of Priscilla",
    year: 230,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["marian"],
    location: "Via Salaria, Rome",
    context:
      "In a Roman catacomb used for Christian burials since the late second century, a painter depicts Mary holding the infant Jesus beside a prophet, usually identified as Isaiah.",
    significance:
      "Dated to about 230–240, it may be the oldest known image of the Virgin Mary; the same catacomb holds the graves of several early popes and many martyrs.",
    citation: `${W}Catacomb_of_Priscilla`,
  },
  {
    slug: "origen-settles-in-caesarea",
    title: "Origen leaves Alexandria for Caesarea",
    year: 231,
    precision: "circa",
    era: "persecution",
    kind: "event",
    location: "Caesarea Maritima",
    context:
      "After his ordination as a priest in Palestine angers Bishop Demetrius of Alexandria, Origen leaves Egypt for good and opens a new school at Caesarea.",
    significance:
      "Caesarea becomes his home and the base of his great biblical work for the rest of his life, and a lasting centre of Christian learning.",
    citation: `${NA}11306b.htm`,
  },
  {
    slug: "pope-pontian-resigns-in-exile",
    title: "Pope Pontian resigns in exile in Sardinia",
    year: 235,
    date: "0235-09-28",
    precision: "day",
    era: "persecution",
    kind: "pope",
    tags: ["papacy", "persecution"],
    location: "Sardinia",
    context:
      "When Maximinus Thrax turns on the Church's leaders, Pontian and Hippolytus are deported to the mines of Sardinia, where Pontian resigns so that Rome can elect a successor.",
    significance:
      "Pontian is the first pope known to have resigned; Pope Fabian later brought his body back to Rome for burial in the papal crypt of St Callixtus.",
    citation: `${NA}12229b.htm`,
    links: { popes: ["pope-saint-pontian"] },
  },
  {
    slug: "election-of-pope-fabian",
    title: "Election of Pope Fabian",
    year: 236,
    precision: "year",
    era: "persecution",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Eusebius tells how a dove settled on the head of Fabian, newly arrived in Rome from the countryside, and the assembled brethren chose him at once as bishop.",
    significance:
      "In fourteen years he divided Rome into seven districts under deacons, developed the catacombs and brought Pontian's body home, before dying a martyr under Decius.",
    citation: `${NA}05742d.htm`,
    links: { popes: ["pope-saint-fabian"], saints: ["saint-fabian"] },
  },
  {
    slug: "house-church-of-dura-europos",
    title: "House church of Dura-Europos",
    year: 240,
    precision: "circa",
    era: "persecution",
    kind: "event",
    tags: ["liturgy"],
    location: "Dura-Europos, Syria",
    context:
      "In the Roman frontier town of Dura-Europos, a house built in 232/233 is converted into a church whose baptistery is painted with the Good Shepherd, the healing of the paralytic and Christ walking on the water.",
    significance:
      "Buried during the Persian siege of 256 and excavated in 1931–32, it is the earliest identified Christian house church, and its paintings are among the oldest images of Jesus.",
    citation: `${W}Dura-Europos_church`,
  },
  {
    slug: "origen-compiles-the-hexapla",
    title: "Origen compiles the Hexapla",
    year: 240,
    precision: "circa",
    era: "persecution",
    kind: "document",
    tags: ["scripture"],
    location: "Caesarea",
    context:
      "Origen sets the Hebrew Old Testament, its transliteration into Greek letters and four Greek versions, the Septuagint among them, side by side in six columns.",
    significance:
      "The greatest critical work of ancient biblical scholarship was kept at Caesarea, where Eusebius and Jerome consulted it, before it vanished in the seventh century.",
    citation: `${NA}07316a.htm`,
  },
  {
    slug: "mani-begins-to-preach",
    title: "Mani begins to preach in Persia",
    year: 242,
    precision: "year",
    era: "persecution",
    kind: "event",
    tags: ["heresy"],
    location: "Sasanian Persia",
    context:
      "Mani, raised in a Jewish-Christian baptist sect, first preaches publicly at the court of Shapur I, proclaiming a dualist religion of light and darkness and calling himself an apostle of Jesus Christ.",
    significance:
      "Manichaeism spread from the Roman West to China; the Fathers fought it as a heresy, and the young Augustine joined its community at Rome before his conversion.",
    citation: `${NA}09591a.htm`,
  },
  {
    slug: "cyprian-becomes-bishop-of-carthage",
    title: "Cyprian becomes bishop of Carthage",
    year: 248,
    precision: "circa",
    era: "persecution",
    kind: "saint",
    location: "Carthage",
    context:
      "A wealthy orator baptised only about two years earlier, Cyprian is pressed by the people of Carthage into accepting the bishopric, over the opposition of some of the priests.",
    significance:
      "His decade as bishop, through persecution, plague and controversy, made him the model of a Latin bishop and ended in martyrdom in 258.",
    citation: `${NA}04583b.htm`,
    links: { saints: ["saint-cyprian-of-carthage"] },
  },
  {
    slug: "origen-against-celsus",
    title: "Origen answers Celsus",
    year: 248,
    precision: "circa",
    era: "persecution",
    kind: "document",
    location: "Caesarea",
    context:
      "At the urging of his patron Ambrose, Origen, now over sixty, writes Against Celsus, refuting the pagan philosopher's attack of some seventy years before.",
    significance:
      "One of the most important apologetic works of the early Church; Eusebius thought it answered in advance every objection the Church would ever face.",
    citation: `${W}Contra_Celsum`,
  },
  {
    slug: "martyrdom-of-saint-apollonia",
    title: "Martyrdom of St Apollonia at Alexandria",
    year: 249,
    precision: "circa",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Alexandria",
    context:
      "In a mob attack on Alexandria's Christians, the aged virgin Apollonia has her teeth broken and, threatened with burning unless she blasphemes, walks into the fire herself.",
    significance:
      "Bishop Dionysius's letter preserves the story; the riot foreshadowed Decius's empire-wide persecution, and Apollonia is invoked against toothache.",
    citation: `${NA}01617c.htm`,
    links: { saints: ["saint-apollonia"] },
  },
  {
    slug: "plague-of-cyprian",
    title: "The Plague of Cyprian",
    year: 250,
    precision: "circa",
    era: "persecution",
    kind: "event",
    location: "Roman Empire",
    context:
      "An epidemic that breaks out in Egypt around 249 reaches Rome by 251, killing thousands a day at its height, while Bishop Cyprian urges the Christians of Carthage to care for the sick and the poor.",
    significance:
      "Christian care for the dying and hope of eternal life won many converts, even as some pagans blamed the Christians for the plague.",
    citation: `${W}Plague_of_Cyprian`,
    links: { saints: ["saint-cyprian-of-carthage"] },
  },
  {
    slug: "novatianist-schism",
    title: "Novatian's schism at Rome",
    year: 251,
    precision: "year",
    era: "persecution",
    kind: "schism",
    tags: ["schism", "papacy"],
    location: "Rome",
    context:
      "When Cornelius is elected bishop of Rome in March 251, the rigorist priest Novatian has himself consecrated as a rival, denying that Christians who lapsed under persecution can ever be readmitted.",
    significance:
      "A council of about sixty bishops at Rome excommunicates him, upholding the Church's power to reconcile penitents; his rigorist church nevertheless survives for centuries.",
    citation: `${NA}11138a.htm`,
    links: { popes: ["pope-saint-cornelius"], saints: ["saint-cornelius"] },
  },
  {
    slug: "council-of-carthage-on-the-lapsed",
    title: "Council of Carthage on the lapsed",
    year: 251,
    precision: "year",
    era: "persecution",
    kind: "council",
    location: "Carthage",
    context:
      "As the Decian persecution wanes, Cyprian returns from hiding and holds a council in spring 251 to decide how Christians who sacrificed, or bought certificates saying they had, may be restored.",
    significance:
      "Each case is to be judged on its merits: certificate-buyers may return after penance, those who sacrificed only after lifelong penance — a stern path between laxity and Novatian's refusal of all pardon.",
    citation: `${NA}04583b.htm`,
    links: { saints: ["saint-cyprian-of-carthage"] },
  },
  {
    slug: "cornelius-describes-the-roman-church",
    title: "Pope Cornelius describes the clergy and poor of Rome",
    year: 251,
    precision: "year",
    era: "persecution",
    kind: "document",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Writing to Fabius of Antioch about Novatian, Cornelius incidentally counts the Roman church's 46 priests, 7 deacons, 7 subdeacons, 42 acolytes, 52 exorcists, readers and doorkeepers, and more than 1,500 widows and needy people in its care.",
    significance:
      "A rare snapshot of the size, ordered ministries and charity of the third-century Roman church.",
    citation: `${NA}04375c.htm`,
    links: { popes: ["pope-saint-cornelius"], saints: ["saint-cornelius"] },
  },
  {
    slug: "martyrdom-of-saint-agatha",
    title: "Martyrdom of St Agatha at Catania",
    year: 251,
    precision: "circa",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Catania, Sicily",
    context:
      "The young Christian Agatha is put to death at Catania for her faith; her legend places the martyrdom in the persecution of Decius.",
    significance:
      "Her Acts are late, but the fact of her martyrdom is certain, and her cult spread early through Sicily and to Rome, where Gregory the Great restored her church in the Subura.",
    citation: `${NA}01203c.htm`,
    links: { saints: ["saint-agatha"] },
  },
  {
    slug: "alexander-of-jerusalem-dies-in-prison",
    title: "Bishop Alexander of Jerusalem dies in prison",
    year: 251,
    precision: "circa",
    era: "persecution",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Caesarea",
    context:
      "Alexander, bishop of Jerusalem and a close friend of Origen, is imprisoned at Caesarea in the Decian persecution and dies there.",
    significance:
      "He had ordained Origen a priest and built up a Christian library at Jerusalem; the Church venerates him as a martyr.",
    citation: `${W}Alexander_of_Jerusalem`,
  },
];
