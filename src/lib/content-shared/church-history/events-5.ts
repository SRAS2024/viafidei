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
];
