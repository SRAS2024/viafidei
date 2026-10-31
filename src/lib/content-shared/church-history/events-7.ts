import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";

/**
 * Church-history spine, part 7: the Early Middle Ages in detail (590–1054).
 * Gregory the Great and the missions to the English and the Germans, the
 * Monothelite and iconoclast crises, the rise of Islam, the Carolingian and
 * Ottonian Churches, the conversion of the Slavs, Scandinavia, Hungary,
 * Poland and Rus', the papacy's tenth-century nadir and the reform that
 * leads up to 1054. It fills in around the headline events of parts 1 and 2
 * without repeating them. Every event cites one page that supports its date
 * and claim; approximate dates carry `precision: "circa"`, and a day is
 * stored only where the exact day is well attested.
 */
export const EVENTS_7: ChurchHistoryEvent[] = [
  // ------------------------------------------------- Gregory the Great's age
  {
    slug: "columbanus-founds-luxeuil",
    title: "St Columbanus founds Luxeuil",
    year: 590,
    precision: "circa",
    era: "early-medieval",
    kind: "order",
    tags: ["monastic"],
    location: "Luxeuil, Vosges",
    context:
      "The Irish monk Columbanus, already settled with his companions at Annegray in the Vosges, founds a second and larger abbey at Luxeuil.",
    significance:
      "Luxeuil becomes one of the great monasteries of Gaul, though Columbanus's Irish customs, his Easter date among them, set him at odds with the Frankish bishops.",
    citation: `${NA}04137a.htm`,
  },
  {
    slug: "gregory-the-great-pastoral-rule",
    title: "Gregory the Great writes the Pastoral Rule",
    year: 590,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    tags: ["papacy", "doctor"],
    location: "Rome",
    context:
      "Soon after his election Gregory answers a question from Bishop John of Ravenna with a treatise on the duties and inner life of those who have charge of souls.",
    significance:
      "It became the medieval handbook for bishops: Emperor Maurice had it spread through the East, and Alfred the Great translated it into English.",
    citation: `${W}Regula_Pastoralis`,
    links: {
      popes: ["pope-saint-gregory-the-great"],
      doctors: ["doctor-gregory-the-great"],
    },
  },
  {
    slug: "gregory-the-great-dialogues",
    title: "Gregory the Great completes the Dialogues",
    year: 593,
    precision: "year",
    era: "early-medieval",
    kind: "document",
    tags: ["monastic", "doctor"],
    location: "Rome",
    context:
      "Gregory finishes four books of conversations on the miracles of Italy's holy men and on the soul's life after death; the second book is given wholly to St Benedict.",
    significance:
      "Book II remains the principal source for the life of Benedict, and the work set the pattern for how the medieval West told its saints' stories.",
    citation: `${W}Dialogues_of_Gregory_the_Great`,
    links: {
      popes: ["pope-saint-gregory-the-great"],
      doctors: ["doctor-gregory-the-great"],
      saints: ["saint-benedict-of-nursia"],
    },
  },
  {
    slug: "death-of-saint-columba",
    title: "Death of St Columba",
    year: 597,
    date: "0597-06-09",
    precision: "day",
    era: "early-medieval",
    kind: "saint",
    tags: ["mission", "monastic"],
    location: "Iona",
    context:
      "Columba dies on Iona, the island abbey from which he and his monks had carried the faith to the Picts of northern Britain.",
    significance:
      "His foundation launched the Hiberno-Scottish mission; Iona would later send Aidan to evangelise Northumbria.",
    citation: `${W}Columba`,
    links: { saints: ["saint-columba"] },
  },
  {
    slug: "death-of-saint-gregory-the-great",
    title: "Death of St Gregory the Great",
    year: 604,
    date: "0604-03-12",
    precision: "day",
    era: "early-medieval",
    kind: "saint",
    tags: ["papacy", "doctor"],
    location: "Rome",
    context:
      "Gregory dies in Rome and is buried the same day in the portico of St Peter's Basilica.",
    significance:
      "Monk, preacher and administrator, he left the papacy a model of pastoral care, the mission to England and a body of writing that made him a Doctor of the Church.",
    citation: `${NA}06780a.htm`,
    links: {
      popes: ["pope-saint-gregory-the-great"],
      saints: ["saint-gregory-the-great"],
      doctors: ["doctor-gregory-the-great"],
    },
  },
  {
    slug: "pantheon-becomes-a-church",
    title: "The Pantheon becomes a church",
    year: 609,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["marian"],
    location: "Rome",
    context:
      "Emperor Phocas gives the Pantheon to Pope Boniface IV, who consecrates the ancient temple as the church of St Mary and the Martyrs.",
    significance:
      "Its new life as a church preserved one of the great buildings of ancient Rome, still a place of worship today.",
    citation: `${W}Pantheon,_Rome`,
  },
  {
    slug: "saint-gall-remains-in-alemannia",
    title: "St Gall stays behind in Alemannia",
    year: 612,
    precision: "year",
    era: "early-medieval",
    kind: "saint",
    tags: ["monastic", "mission"],
    location: "Arbon and the Steinach valley",
    context:
      "When Columbanus moves on from Bregenz to Italy, his companion Gall, too ill to travel, stays behind and later settles as a hermit near the source of the Steinach.",
    significance:
      "In 719 Othmar enlarged Gall's cell into the Abbey of St Gall, one of the great centres of learning of medieval Europe.",
    citation: `${W}Saint_Gall`,
  },
  {
    slug: "columbanus-founds-bobbio",
    title: "St Columbanus founds Bobbio",
    year: 614,
    precision: "year",
    era: "early-medieval",
    kind: "order",
    tags: ["monastic"],
    location: "Bobbio, northern Italy",
    context:
      "The Lombard king Agilulf grants Columbanus a ruined church and lands at Bobbio, where the Irish abbot builds his last monastery and dies the following year.",
    significance:
      "Bobbio became a centre of resistance to the Arianism of the Lombards and one of the great libraries of the Middle Ages.",
    citation: `${W}Bobbio_Abbey`,
  },
  {
    slug: "persian-capture-of-jerusalem",
    title: "Persians take Jerusalem and the True Cross",
    year: 614,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Jerusalem",
    context:
      "A Sasanian Persian army captures Jerusalem in the spring of 614; the relic of the True Cross is carried off to Ctesiphon and Patriarch Zacharias is deported.",
    significance:
      "Thousands of Christians are killed or led into captivity, and the loss of the Cross grieves the Christian world until Heraclius recovers it.",
    citation: `${W}Sasanian_conquest_of_Jerusalem`,
  },
  // ------------------------------------------------------- The rise of Islam
  {
    slug: "hijra-of-muhammad",
    title: "The Hijra: Muhammad goes to Medina",
    year: 622,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Mecca and Medina",
    context:
      "Muhammad and his followers emigrate from Mecca to Medina; the year is later fixed as the first of the Islamic calendar.",
    significance:
      "Within a century Muslim armies would conquer the Christian heartlands of Syria, Palestine, Egypt and North Africa and most of Spain, redrawing the map of Christendom.",
    citation: `${W}Hijrah`,
  },
  {
    slug: "siege-of-constantinople-626",
    title: "Avar–Persian siege of Constantinople",
    year: 626,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["marian"],
    location: "Constantinople",
    context:
      "With Emperor Heraclius away on campaign, Avars and Slavs assault the capital in concert with a Persian army across the Bosporus; Patriarch Sergius leads processions along the walls and the attack fails.",
    significance:
      "The city credited its rescue to the protection of the Virgin Mary, and a new opening hymn of thanksgiving was added to the Akathist.",
    citation: `${W}Siege_of_Constantinople_(626)`,
  },
  {
    slug: "baptism-of-edwin-of-northumbria",
    title: "Baptism of King Edwin of Northumbria",
    year: 627,
    date: "0627-04-12",
    precision: "day",
    era: "early-medieval",
    kind: "mission",
    location: "York",
    context:
      "Won over by the Roman missionary Paulinus and his Kentish queen Æthelburh, Edwin is baptised together with his chief men.",
    significance:
      "Northumbria gains its first Christian king, and Paulinus becomes the first bishop of York.",
    citation: `${W}Edwin_of_Northumbria`,
  },
  {
    slug: "heraclius-restores-the-true-cross",
    title: "Heraclius restores the True Cross to Jerusalem",
    year: 630,
    precision: "circa",
    era: "early-medieval",
    kind: "event",
    location: "Jerusalem",
    context:
      "After defeating Persia, Emperor Heraclius receives back the relic of the Cross and brings it home to Jerusalem in March 629 or 630.",
    significance:
      "The high point of Byzantium's long war with Persia; within a decade Jerusalem would fall to the Arabs.",
    citation: `${W}Heraclius`,
  },
  {
    slug: "fourth-council-of-toledo",
    title: "Fourth Council of Toledo",
    year: 633,
    date: "0633-12-05",
    precision: "day",
    era: "early-medieval",
    kind: "council",
    tags: ["liturgy"],
    location: "Toledo",
    context:
      "Called by King Sisenand and probably presided over by Isidore of Seville, the bishops of Visigothic Spain decree one liturgy for the whole kingdom and require schools in every cathedral city.",
    significance:
      "Its canons shaped the Hispanic Church for generations; it also laid harsh measures on baptised Jews who returned to Judaism.",
    citation: `${W}Fourth_Council_of_Toledo`,
    links: {
      saints: ["saint-isidore-of-seville"],
      doctors: ["doctor-isidore-of-seville"],
    },
  },
  {
    slug: "aidan-founds-lindisfarne",
    title: "St Aidan, first bishop of Lindisfarne",
    year: 635,
    precision: "year",
    era: "early-medieval",
    kind: "mission",
    tags: ["monastic"],
    location: "Lindisfarne",
    context:
      "Aidan, a monk of Iona and a friend of King Oswald, is chosen as the first bishop of Lindisfarne, the island see from which he evangelises Northumbria.",
    significance:
      "Lindisfarne becomes the cradle of Christianity in the north of England; Aidan dies at Bamburgh in 651.",
    citation: `${NA}01233d.htm`,
  },
  {
    slug: "alopen-reaches-china",
    title: "Alopen brings Christianity to China",
    year: 635,
    precision: "year",
    era: "early-medieval",
    kind: "mission",
    location: "Chang'an",
    context:
      "Alopen, a monk of the Church of the East, reaches the Tang capital; Emperor Taizong has his scriptures translated and in 638 decrees protection for the faith.",
    significance:
      "The first recorded Christian mission to China, known chiefly from the Xi'an Stele unearthed in the seventeenth century.",
    citation: `${W}Alopen`,
  },
  {
    slug: "death-of-saint-isidore-of-seville",
    title: "Death of St Isidore of Seville",
    year: 636,
    date: "0636-04-04",
    precision: "day",
    era: "early-medieval",
    kind: "saint",
    tags: ["doctor"],
    location: "Seville",
    context:
      "Isidore, who succeeded his brother Leander as bishop of Seville and presided over the Fourth Council of Toledo, dies in his see.",
    significance:
      "His Etymologies condensed the learning of the ancient world into an encyclopaedia that schooled the Middle Ages; he is a Doctor of the Church.",
    citation: `${NA}08186a.htm`,
    links: {
      saints: ["saint-isidore-of-seville"],
      doctors: ["doctor-isidore-of-seville"],
    },
  },
  {
    slug: "ecthesis-of-heraclius",
    title: "The Ecthesis teaches one will in Christ",
    year: 638,
    precision: "year",
    era: "early-medieval",
    kind: "document",
    tags: ["dogma"],
    location: "Constantinople",
    context:
      "Emperor Heraclius and Patriarch Sergius publish the Ecthesis, which holds that Christ, though in two natures, has only one will.",
    significance:
      "Popes Severinus and John IV reject it, opening the Monothelite crisis that the Third Council of Constantinople would settle in 680–681.",
    citation: `${W}Ecthesis`,
  },
  {
    slug: "arab-conquest-of-alexandria",
    title: "Alexandria falls to the Arabs",
    year: 642,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Alexandria",
    context:
      "After Amr ibn al-As's conquest of Egypt, Patriarch Cyrus negotiates the city's surrender, and Arab forces take possession of Alexandria in 642.",
    significance:
      "Egypt, seat of one of the ancient patriarchates and a heartland of early Christian thought, passes under Muslim rule.",
    citation: `${W}Muslim_conquest_of_Egypt`,
  },
  // ----------------------------------------------------- The Monothelite crisis
  {
    slug: "lateran-council-of-649",
    title: "Lateran Council of 649",
    year: 649,
    date: "0649-10-05",
    precision: "day",
    era: "early-medieval",
    kind: "council",
    tags: ["dogma"],
    location: "Lateran Basilica, Rome",
    context:
      "Presided over by Pope Martin I, with texts prepared by Maximus the Confessor and his monks, a synod of Western bishops sits through October 649.",
    significance:
      "It condemns Monothelitism together with the imperial Ecthesis and Typos, and both Martin and Maximus are arrested for it.",
    citation: `${W}Lateran_Council_of_649`,
  },
  {
    slug: "death-of-pope-saint-martin-i",
    title: "Pope St Martin I dies in exile",
    year: 655,
    date: "0655-09-16",
    precision: "day",
    era: "early-medieval",
    kind: "martyrdom",
    tags: ["papacy", "persecution"],
    location: "Cherson, Crimea",
    context:
      "Taken from Rome in 653 on the emperor's orders, tried in Constantinople and banished to Cherson in the Crimea, Martin dies there.",
    significance:
      "Honoured as a martyr, he suffered for refusing to accept the imperial ban on teaching two wills in Christ.",
    citation: `${NA}09723c.htm`,
  },
  {
    slug: "death-of-saint-maximus-the-confessor",
    title: "Death of St Maximus the Confessor",
    year: 662,
    date: "0662-08-13",
    precision: "day",
    era: "early-medieval",
    kind: "martyrdom",
    tags: ["dogma", "persecution"],
    location: "Colchis",
    context:
      "Condemned in Constantinople with two disciples and sentenced to lose his tongue and right hand, the aged monk dies in exile in Colchis.",
    significance:
      "The great theologian of Christ's two wills gave his life for the orthodox faith and communion with Rome; Constantinople III vindicated his teaching.",
    citation: `${NA}10078b.htm`,
  },
  // ------------------------------------------------- The English Church grows
  {
    slug: "theodore-of-tarsus-reaches-canterbury",
    title: "Theodore of Tarsus reaches Canterbury",
    year: 669,
    date: "0669-05-27",
    precision: "day",
    era: "early-medieval",
    kind: "event",
    location: "Canterbury",
    context:
      "Chosen by Pope Vitalian and consecrated in Rome, the Greek monk Theodore arrives as archbishop of Canterbury, accompanied by the abbot Hadrian.",
    significance:
      "He fills vacant sees, reorganises the English dioceses and, with Hadrian, opens a school teaching both Greek and Latin.",
    citation: `${W}Theodore_of_Tarsus`,
  },
  {
    slug: "synod-of-hertford",
    title: "Synod of Hertford",
    year: 672,
    precision: "circa",
    era: "early-medieval",
    kind: "council",
    location: "Hertford",
    context:
      "Archbishop Theodore gathers the English bishops, who confirm the Roman Easter, forbid bishops to intrude on one another's dioceses and agree to meet in synod each year.",
    significance:
      "The first general council of the Anglo-Saxon Church and the start of its tradition of national synods.",
    citation: `${W}Council_of_Hertford`,
  },
  {
    slug: "benedict-biscop-founds-wearmouth",
    title: "Benedict Biscop founds Wearmouth",
    year: 674,
    precision: "year",
    era: "early-medieval",
    kind: "order",
    tags: ["monastic"],
    location: "Monkwearmouth, Northumbria",
    context:
      "On land given by King Ecgfrith, Benedict Biscop builds St Peter's monastery with masons and glaziers from Francia and fills it with books from Rome; its twin, St Paul's at Jarrow, follows in 685.",
    significance:
      "The double monastery was Bede's home and produced the Codex Amiatinus, the oldest surviving complete Vulgate Bible.",
    citation: `${W}Monkwearmouth–Jarrow_Abbey`,
  },
  {
    slug: "death-of-saint-cuthbert",
    title: "Death of St Cuthbert",
    year: 687,
    date: "0687-03-20",
    precision: "day",
    era: "early-medieval",
    kind: "saint",
    tags: ["monastic"],
    location: "Farne Islands",
    context:
      "Cuthbert, monk of Melrose, prior and then bishop of Lindisfarne, dies in his hermitage on the Farne Islands.",
    significance:
      "The most venerated saint of northern England: his body, found incorrupt, was later carried by his community to Durham, where it still rests.",
    citation: `${NA}04578a.htm`,
  },
  // ----------------------------------------------- Missions on the continent
  {
    slug: "martyrdom-of-saint-kilian",
    title: "Martyrdom of St Kilian",
    year: 689,
    precision: "circa",
    era: "early-medieval",
    kind: "martyrdom",
    tags: ["mission"],
    location: "Würzburg",
    context:
      "The Irish missionary Kilian and his companions Colmán and Totnan are beheaded at the order of Geilana, whose marriage to Duke Gozbert, her late husband's brother, Kilian had condemned.",
    significance: "Venerated as the Apostle of Franconia.",
    citation: `${W}Saint_Kilian`,
  },
  {
    slug: "council-in-trullo",
    title: "Council in Trullo (Quinisext)",
    year: 692,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    location: "Constantinople",
    context:
      "Under Emperor Justinian II, Eastern bishops issue 102 disciplinary canons to supply what the fifth and sixth ecumenical councils had left undone.",
    significance:
      "Canons allowing married clergy to keep their wives and renewing Constantinople's claim to privileges equal to Rome's were never accepted in the West.",
    citation: `${NA}04311b.htm`,
  },
  {
    slug: "willibrord-consecrated-for-the-frisians",
    title: "Willibrord consecrated bishop of the Frisians",
    year: 695,
    date: "0695-11-21",
    precision: "day",
    era: "early-medieval",
    kind: "mission",
    location: "Rome",
    context:
      "On his second visit to Rome, the Northumbrian monk Willibrord receives the pallium from Pope Sergius I and is consecrated bishop of the Frisians.",
    significance:
      "Counted as the first bishop of Utrecht, he lays the foundations of the Church in the Low Countries and founds Echternach Abbey in 698.",
    citation: `${W}Willibrord`,
  },
  {
    slug: "fall-of-carthage-698",
    title: "Carthage falls to the Umayyads",
    year: 698,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Carthage",
    context:
      "An Umayyad army under Hassan ibn al-Nu'man defeats the Byzantines, takes Carthage and destroys the city.",
    significance:
      "Roman rule ends in North Africa, the homeland of Tertullian, Cyprian and Augustine.",
    citation: `${W}Battle_of_Carthage_(698)`,
  },
  {
    slug: "umayyad-conquest-of-hispania",
    title: "Muslim conquest of Hispania begins",
    year: 711,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Iberian Peninsula",
    context:
      "Tariq ibn Ziyad crosses from North Africa, King Roderic falls at the Guadalete, and within a few years most of the Visigothic kingdom is under Umayyad rule.",
    significance:
      "Most Iberian Christians now live under Muslim rule, keeping their own law and the Mozarabic rite.",
    citation: `${W}Umayyad_conquest_of_Hispania`,
  },
  {
    slug: "lindisfarne-gospels",
    title: "The Lindisfarne Gospels",
    year: 715,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    tags: ["scripture"],
    location: "Lindisfarne",
    context:
      "The four Gospels are copied and illuminated at Lindisfarne, probably by Bishop Eadfrith, apparently in honour of St Cuthbert.",
    significance:
      "A masterpiece of Insular art; the Old English gloss added in the tenth century is the oldest surviving translation of the Gospels into English.",
    citation: `${W}Lindisfarne_Gospels`,
  },
  {
    slug: "arab-siege-of-constantinople-fails",
    title: "Arab siege of Constantinople fails",
    year: 718,
    date: "0718-08-15",
    precision: "day",
    era: "early-medieval",
    kind: "event",
    location: "Constantinople",
    context:
      "After thirteen months of siege by land and sea, the Umayyad forces under Maslama withdraw, worn down by Greek fire and Bulgar attacks.",
    significance:
      "Emperor Leo III's victory halts the Muslim advance into south-eastern Europe for centuries.",
    citation: `${W}Siege_of_Constantinople_(717–718)`,
  },
  {
    slug: "gregory-ii-commissions-boniface",
    title: "Gregory II commissions Boniface",
    year: 719,
    date: "0719-05-15",
    precision: "day",
    era: "early-medieval",
    kind: "mission",
    location: "Rome",
    context:
      "Pope Gregory II gives the English monk Boniface (Winfrid) full authority to preach the Gospel to the pagan peoples of Germany.",
    significance:
      "The German mission is bound to Rome from its start; Boniface becomes the Apostle of Germany.",
    citation: `${NA}02656a.htm`,
    links: { popes: ["pope-saint-gregory-ii"], saints: ["saint-boniface"] },
  },
  {
    slug: "battle-of-covadonga",
    title: "Battle of Covadonga",
    year: 722,
    precision: "circa",
    era: "early-medieval",
    kind: "event",
    location: "Covadonga, Asturias",
    context:
      "In the mountains of Asturias, the Christian leader Pelagius defeats an Umayyad force sent to subdue him.",
    significance:
      "Traditionally the founding of the kingdom of Asturias and the start of the Reconquista; the site is a shrine of Our Lady of Covadonga.",
    citation: `${W}Battle_of_Covadonga`,
  },
  {
    slug: "boniface-fells-donars-oak",
    title: "Boniface fells Donar's Oak",
    year: 723,
    precision: "circa",
    era: "early-medieval",
    kind: "mission",
    location: "Geismar, Hesse",
    context:
      "Boniface cuts down an oak sacred to the god Donar and builds an oratory to St Peter from its timber, as Willibald's Life of Boniface tells it.",
    significance:
      "The best-remembered moment of the mission to the Germans, a public sign that the old gods could not defend their sanctuaries.",
    citation: `${W}Donar%27s_Oak`,
    links: { saints: ["saint-boniface"] },
  },
  {
    slug: "pirmin-founds-reichenau",
    title: "St Pirmin founds Reichenau",
    year: 724,
    precision: "year",
    era: "early-medieval",
    kind: "order",
    tags: ["monastic"],
    location: "Reichenau, Lake Constance",
    context:
      "The itinerant missionary Pirmin founds a Benedictine abbey on the island of Reichenau.",
    significance:
      "Its scriptorium grew into one of Europe's most influential workshops of illuminated manuscripts; the island is now a World Heritage site.",
    citation: `${W}Reichenau_Abbey`,
  },
  {
    slug: "donation-of-sutri",
    title: "Donation of Sutri",
    year: 728,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["papacy"],
    location: "Sutri, Lazio",
    context:
      "At Pope Gregory II's request, the Lombard king Liutprand hands back the hill town of Sutri as a gift to the Apostles Peter and Paul.",
    significance:
      "The first papal territory beyond the Duchy of Rome, an early step toward the Papal States.",
    citation: `${W}Donation_of_Sutri`,
    links: { popes: ["pope-saint-gregory-ii"] },
  },
  // ------------------------------------------------------------ Iconoclasm
  {
    slug: "patriarch-germanus-resigns",
    title: "Patriarch Germanus refuses iconoclasm",
    year: 730,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Constantinople",
    context:
      "Patriarch Germanus I steps down rather than support Emperor Leo III's measures against images and is replaced by the more pliant Anastasius.",
    significance:
      "Exiled for his stand, he is venerated as a saint in East and West; Pius XII drew on his writings when defining the Assumption.",
    citation: `${W}Germanus_I_of_Constantinople`,
  },
  {
    slug: "gregory-iii-condemns-iconoclasm",
    title: "Gregory III's synods condemn iconoclasm",
    year: 731,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    tags: ["dogma"],
    location: "Rome",
    context:
      "In the year of his election Pope Gregory III holds two synods in Rome that condemn the destruction of sacred images.",
    significance:
      "Rome's open rejection of imperial iconoclasm deepens the estrangement between the popes and Byzantium.",
    citation: `${NA}06789a.htm`,
  },
];
