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
  // ------------------------------------------- Boniface and the Frankish Church
  {
    slug: "death-of-saint-bede",
    title: "Death of St Bede the Venerable",
    year: 735,
    precision: "year",
    era: "early-medieval",
    kind: "saint",
    tags: ["doctor", "monastic"],
    location: "Jarrow",
    context:
      "On the eve of the Ascension, Bede dies in his monastery at Jarrow, still dictating an English translation of St John's Gospel to the last.",
    significance:
      "Scholar of Scripture, time-reckoning and history, he was given the title of Doctor of the Church by Leo XIII in 1899.",
    citation: `${NA}02384a.htm`,
    links: {
      saints: ["saint-bede-the-venerable"],
      doctors: ["doctor-bede-the-venerable"],
    },
  },
  {
    slug: "concilium-germanicum",
    title: "Concilium Germanicum",
    year: 742,
    precision: "circa",
    era: "early-medieval",
    kind: "council",
    tags: ["reform"],
    context:
      "Called by Carloman and presided over by Boniface on 21 April 742 or 743, the synod orders yearly councils, forbids clergy to bear arms or hunt and makes the Rule of St Benedict binding on every monastery.",
    significance:
      "The first of the synods by which Boniface, as papal legate, set about reforming the Church in the eastern Frankish lands.",
    citation: `${W}Concilium_Germanicum`,
    links: { saints: ["saint-boniface"] },
  },
  {
    slug: "founding-of-fulda",
    title: "Foundation of Fulda",
    year: 744,
    date: "0744-03-12",
    precision: "day",
    era: "early-medieval",
    kind: "order",
    tags: ["monastic"],
    location: "Fulda, Hesse",
    context:
      "Sturm, Boniface's disciple and its first abbot, takes possession of land obtained from Carloman and raises the cross to found the abbey.",
    significance:
      "Placed directly under the Holy See in 751 and later the school of Rabanus Maurus, Fulda became a chief centre of learning in Germany and keeps Boniface's tomb.",
    citation: `${NA}06313b.htm`,
    links: { saints: ["saint-boniface"] },
  },
  {
    slug: "donation-of-constantine-forged",
    title: "The Donation of Constantine is forged",
    year: 750,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    tags: ["papacy"],
    context:
      "A forged decree is composed in which Emperor Constantine supposedly hands Pope Sylvester authority over Rome and the western half of the empire.",
    significance:
      "Taken as genuine for centuries and invoked by popes from Leo IX on, it was exposed as a forgery by Lorenzo Valla around 1440.",
    citation: `${W}Donation_of_Constantine`,
  },
  {
    slug: "pepin-made-king-with-papal-sanction",
    title: "Pepin made king with Pope Zachary's sanction",
    year: 751,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["papacy"],
    location: "Soissons",
    context:
      "Told by Pope Zachary that the man who wields royal power should bear the royal title, the Franks depose the last Merovingian, Childeric III, and elect Pepin, who is anointed at Soissons.",
    significance:
      "Papal approval of the new Carolingian dynasty begins the alliance between the popes and the Frankish kings.",
    citation: `${W}Pepin_the_Short`,
    links: { popes: ["pope-saint-zachary"] },
  },
  {
    slug: "stephen-ii-anoints-pepin",
    title: "Stephen II anoints Pepin at Saint-Denis",
    year: 754,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["papacy"],
    location: "Abbey of Saint-Denis",
    context:
      "Seeking Frankish help against the Lombards, Pope Stephen II travels to Francia and in midsummer anoints Pepin and his sons Charles and Carloman, naming Pepin Patrician of the Romans.",
    significance:
      "The Frankish king becomes protector of the Roman Church, and his campaigns against the Lombards lead to the Donation of 756.",
    citation: `${W}Pepin_the_Short`,
  },
  {
    slug: "council-of-hieria",
    title: "Iconoclast Council of Hieria",
    year: 754,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    location: "Hieria, near Chalcedon",
    context:
      "Emperor Constantine V gathers 338 bishops at his palace of Hieria; with no patriarch and no envoy of the pope present, they condemn the making and veneration of icons as idolatry.",
    significance: "The Second Council of Nicaea reversed nearly all of its rulings in 787.",
    citation: `${W}Council_of_Hieria`,
  },
  {
    slug: "lateran-council-of-769",
    title: "Lateran Council of 769",
    year: 769,
    date: "0769-04-12",
    precision: "day",
    era: "early-medieval",
    kind: "council",
    tags: ["papacy"],
    location: "Lateran Basilica, Rome",
    context:
      "Pope Stephen III, joined by twelve Frankish bishops, condemns the usurper Constantine II, bars laymen from the papacy and from papal elections, and upholds the veneration of icons.",
    significance:
      "After years of factional violence it limits the papacy to the cardinal priests and deacons, and it rejects the iconoclast council of Hieria.",
    citation: `${W}Lateran_Council_(769)`,
  },
  // ------------------------------------------------ The Carolingian Church
  {
    slug: "alcuin-joins-charlemagne",
    title: "Alcuin joins Charlemagne's court",
    year: 782,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Frankish royal court",
    context:
      "Alcuin of York, whom Charlemagne had met at Parma in 781, enters the king's service and takes charge of the Palace School.",
    significance:
      "The leading mind of the Carolingian revival of learning, he revised the text of the Vulgate and led a reform of the liturgy.",
    citation: `${NA}01276a.htm`,
  },
  {
    slug: "capitulatio-de-partibus-saxoniae",
    title: "Capitulary for Saxony: baptism under pain of death",
    year: 782,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    location: "Saxony",
    context:
      "Charlemagne's law for the conquered Saxons makes refusing baptism, like burning a church, a crime punishable by death.",
    significance:
      "A stark instance of forced conversion during the Saxon Wars; a capitulary of 797 replaced its harshest measures with gentler means.",
    citation: `${W}Capitulatio_de_partibus_Saxoniae`,
  },
  {
    slug: "baptism-of-widukind",
    title: "Baptism of Widukind",
    year: 785,
    precision: "year",
    era: "early-medieval",
    kind: "mission",
    context:
      "After years of war, including the mass execution of Saxon captives at Verden, the Saxon leader Widukind submits and is baptised with Charlemagne as his godfather.",
    significance:
      "His submission ends the resistance he had led, though the Saxons' conversion was imposed largely by force.",
    citation: `${W}Widukind`,
  },
  {
    slug: "admonitio-generalis",
    title: "Admonitio generalis",
    year: 789,
    precision: "year",
    era: "early-medieval",
    kind: "document",
    tags: ["reform"],
    context:
      "Charlemagne issues a capitulary of 82 chapters calling clergy and people to amend their lives and ordering monasteries and cathedrals to keep schools.",
    significance:
      "Drawing on the Dionysio-Hadriana collection of canon law, it laid a foundation for the Carolingian Renaissance.",
    citation: `${W}Admonitio_generalis`,
  },
  {
    slug: "viking-raid-on-lindisfarne",
    title: "Vikings raid Lindisfarne",
    year: 793,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Lindisfarne",
    context:
      "Norse raiders plunder the monastery of Lindisfarne and kill members of its community; from Charlemagne's court Alcuin writes that Britain has never known such terror.",
    significance:
      "Often taken as the start of the Viking Age; in 875 the monks abandoned the island, carrying St Cuthbert's body with them.",
    citation: `${W}Lindisfarne`,
  },
  {
    slug: "council-of-frankfurt",
    title: "Council of Frankfurt",
    year: 794,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    tags: ["dogma"],
    location: "Frankfurt",
    context:
      "Charlemagne's synod, attended by legates of Pope Adrian I, condemns the Adoptionism of Archbishop Elipandus of Toledo and Bishop Felix of Urgell.",
    significance:
      "Relying on the Frankish Libri Carolini, it also rejected the Second Council of Nicaea's decrees on images, which Pope Adrian had approved.",
    citation: `${W}Council_of_Frankfurt`,
    links: { popes: ["pope-adrian-i"] },
  },
  {
    slug: "theodore-the-studite-at-stoudios",
    title: "Theodore the Studite takes charge of Stoudios",
    year: 798,
    precision: "circa",
    era: "early-medieval",
    kind: "order",
    tags: ["monastic"],
    location: "Constantinople",
    context:
      "Empress Irene entrusts the monk Theodore with the ancient monastery of Stoudios, where he writes a rule and gathers a large congregation of dependent houses.",
    significance:
      "The Studite reform shaped Byzantine monastic life, and Theodore became a leading champion of the icons during the second iconoclasm.",
    citation: `${W}Theodore_the_Studite`,
  },
  {
    slug: "book-of-kells",
    title: "The Book of Kells",
    year: 800,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    tags: ["scripture"],
    location: "Iona and Kells",
    context:
      "Columban monks, probably beginning on Iona and finishing at Kells, produce a lavishly illuminated Latin Gospel book.",
    significance:
      "Regarded as the summit of Insular illumination, it is kept at Trinity College Dublin.",
    citation: `${W}Book_of_Kells`,
  },
  {
    slug: "council-of-aachen-809",
    title: "Council of Aachen and Leo III on the Filioque",
    year: 809,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    tags: ["dogma"],
    location: "Aachen",
    context:
      "A Frankish council at Aachen favours singing the Creed with the Filioque; Pope Leo III approves the doctrine but advises against adding the words to the Creed.",
    significance:
      "Rome kept the Creed unaltered for two more centuries, until the Filioque was adopted there around 1014.",
    citation: `${NA}06073a.htm`,
    links: { popes: ["pope-saint-leo-iii"] },
  },
  {
    slug: "tomb-of-saint-james-at-compostela",
    title: "The tomb of St James at Compostela",
    year: 814,
    precision: "circa",
    era: "early-medieval",
    kind: "event",
    location: "Santiago de Compostela, Galicia",
    context:
      "According to tradition the hermit Pelagius finds a tomb held to be that of St James the Greater; Bishop Theodemir of Iria proclaims it, and King Alfonso II of Asturias builds a chapel over it.",
    significance:
      "Compostela grows into one of the great pilgrimage goals of medieval Christendom, the end of the Way of St James.",
    citation: `${W}Santiago_de_Compostela_Cathedral`,
    links: { saints: ["saint-james-the-greater"] },
  },
  {
    slug: "second-iconoclasm",
    title: "Second Iconoclasm begins",
    year: 815,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Constantinople",
    context:
      "Emperor Leo V the Armenian has Patriarch Nicephorus deposed, and a synod under his successor Theodotus condemns the Second Council of Nicaea and returns to the iconoclast decrees of 754.",
    significance:
      "Icons are banned again and their defenders, Theodore the Studite among them, are exiled until the restoration of 843.",
    citation: `${NA}07620a.htm`,
  },
  {
    slug: "aachen-monastic-reform",
    title: "Benedict of Aniane's monastic reform at Aachen",
    year: 817,
    precision: "year",
    era: "early-medieval",
    kind: "order",
    tags: ["monastic", "reform"],
    location: "Aachen",
    context:
      "Under Emperor Louis the Pious, a council of abbots led by Benedict of Aniane adopts a common code of regulations binding the monasteries of the empire.",
    significance:
      "Remembered as the 'second Benedict', he worked to bring the empire's monks back to the first strictness of their Rule.",
    citation: `${W}Benedict_of_Aniane`,
  },
  {
    slug: "ansgar-mission-to-birka",
    title: "Ansgar's mission to Sweden",
    year: 829,
    precision: "year",
    era: "early-medieval",
    kind: "mission",
    location: "Birka, Sweden",
    context:
      "When the Swedish king Björn asks for missionaries, the Frankish monk Ansgar, back from a mission to Denmark, goes to preach at the trading town of Birka.",
    significance:
      "Christianity's first foothold among the Swedes; in 831 Ansgar is made archbishop of Hamburg for the northern mission.",
    citation: `${W}Ansgar`,
  },
  {
    slug: "paschasius-radbertus-on-the-eucharist",
    title: "Paschasius Radbertus writes on the Eucharist",
    year: 831,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    tags: ["dogma"],
    location: "Corbie",
    context:
      "Paschasius Radbertus, a monk of Corbie, writes De corpore et sanguine Domini, teaching that the Eucharist is truly Christ's own historical body.",
    significance:
      "The first full treatise on the Eucharist in the West; Ratramnus's figurative reply opened a debate that the Church later settled in favour of Christ's substantial presence.",
    citation: `${W}Paschasius_Radbertus`,
  },
  {
    slug: "all-saints-on-1-november",
    title: "All Saints' Day fixed on 1 November in the Frankish realm",
    year: 835,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["liturgy"],
    location: "Frankish Empire",
    context:
      "At the urging of Pope Gregory IV and with the bishops' assent, Emperor Louis the Pious makes 1 November a holy day of obligation throughout the Frankish Empire.",
    significance: "Fixes the date on which the Western Church still keeps the feast of All Saints.",
    citation: `${W}All_Saints%27_Day`,
  },
  {
    slug: "triumph-of-orthodoxy",
    title: "Triumph of Orthodoxy",
    year: 843,
    date: "0843-03-11",
    precision: "day",
    era: "early-medieval",
    kind: "event",
    tags: ["dogma", "liturgy"],
    location: "Constantinople",
    context:
      "On the first Sunday of Lent a synod summoned by the regent Theodora for the young Michael III, with Patriarch Methodios, restores the veneration of icons.",
    significance:
      "Iconoclasm ends for good, and the Eastern Churches still keep the day each year as the Sunday of Orthodoxy.",
    citation: `${W}Feast_of_Orthodoxy`,
  },
  {
    slug: "arab-raid-on-rome",
    title: "Arab raiders sack St Peter's and St Paul's",
    year: 846,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    location: "Rome",
    context:
      "Muslim raiders from the sea plunder the outskirts of Rome, desecrating the basilicas of St Peter and St Paul, which stood outside the city walls.",
    significance: "The shock moves Pope Leo IV to enclose the Vatican hill within a new wall.",
    citation: `${W}Arab_raid_against_Rome`,
  },
  {
    slug: "gottschalk-condemned-at-quierzy",
    title: "Gottschalk condemned at Quierzy",
    year: 849,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    tags: ["grace"],
    location: "Quierzy",
    context:
      "Already condemned at Mainz in 848 for teaching double predestination, the monk Gottschalk of Orbais is condemned again at Quierzy before Archbishop Hincmar of Reims, flogged and confined at Hautvillers.",
    significance:
      "He remained a prisoner until his death around 868, and the dispute over grace and predestination drew in the leading churchmen of the age.",
    citation: `${W}Gottschalk_of_Orbais`,
  },
  {
    slug: "pseudo-isidorian-decretals",
    title: "The False Decretals",
    year: 850,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    tags: ["canon", "papacy"],
    location: "Province of Reims",
    context:
      "A forger in the province of Reims compiles a vast canon-law collection that mixes genuine texts with more than ninety forged papal decretals.",
    significance:
      "Meant to shield accused bishops and widen papal jurisdiction, they were copied throughout the Middle Ages until David Blondel proved them forgeries in 1628.",
    citation: `${W}Pseudo-Isidore`,
  },
  {
    slug: "leonine-wall-completed",
    title: "Leo IV completes the Leonine Wall",
    year: 852,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["papacy"],
    location: "Vatican, Rome",
    context:
      "After four years' work, Pope Leo IV blesses the new fortifications around St Peter's, called the Leonine City after him; a Saracen fleet had been destroyed off Ostia in 849.",
    significance:
      "St Peter's, which lay outside Rome's ancient walls, is at last protected from raiders from the sea.",
    citation: `${NA}09159a.htm`,
    links: { popes: ["pope-saint-leo-iv"] },
  },
  {
    slug: "martyrdom-of-saint-eulogius-of-cordoba",
    title: "Martyrdom of St Eulogius of Córdoba",
    year: 859,
    date: "0859-03-11",
    precision: "day",
    era: "early-medieval",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Córdoba",
    context:
      "Eulogius, the priest who recorded the deaths of the forty-eight martyrs of Córdoba from 850 onward, is himself beheaded for sheltering a young convert.",
    significance:
      "The martyrs, executed for publicly denouncing Islam or for apostasy, witness to the pressures on Christians in Muslim Spain, where some church leaders urged compromise with the emirs.",
    citation: `${W}Martyrs_of_C%C3%B3rdoba`,
  },
  // ------------------------------------------- Nicholas I and the Slavic mission
  {
    slug: "nicholas-i-upholds-teutbergas-marriage",
    title: "Nicholas I upholds Teutberga's marriage",
    year: 863,
    precision: "year",
    era: "early-medieval",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "When King Lothair II casts off Queen Teutberga for his mistress Waldrada with the backing of a synod at Metz, a Lateran synod in October annuls its decision and deposes the archbishops of Cologne and Trier.",
    significance: "The pope defends the bond of marriage against a king and his compliant bishops.",
    citation: `${W}Pope_Nicholas_I`,
    links: { popes: ["pope-saint-nicholas-i"] },
  },
  {
    slug: "baptism-of-boris-of-bulgaria",
    title: "Baptism of Boris I of Bulgaria",
    year: 864,
    precision: "year",
    era: "early-medieval",
    kind: "mission",
    location: "Pliska",
    context:
      "Late in 864 a mission sent by the patriarch of Constantinople baptises Khan Boris I, who takes the Christian name Michael after the Byzantine emperor.",
    significance:
      "Bulgaria becomes a Christian nation, and Boris's dealings with both Rome and Constantinople make it a prize in their rivalry.",
    citation: `${W}Christianization_of_Bulgaria`,
  },
  {
    slug: "death-of-saint-ansgar",
    title: "Death of St Ansgar",
    year: 865,
    date: "0865-02-03",
    precision: "day",
    era: "early-medieval",
    kind: "saint",
    tags: ["mission"],
    location: "Bremen",
    context:
      "Ansgar, archbishop of Hamburg-Bremen and papal legate for the northern lands, dies at Bremen after decades of missions to the Danes and Swedes.",
    significance: "Remembered as the Apostle of the North.",
    citation: `${W}Ansgar`,
  },
  {
    slug: "responsa-ad-consulta-bulgarorum",
    title: "Nicholas I answers the Bulgarians",
    year: 866,
    precision: "year",
    era: "early-medieval",
    kind: "document",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Answering an embassy from Boris I, Pope Nicholas I replies point by point to the Bulgarians' questions on Christian faith and life and sends missionaries under the legate Formosus.",
    significance:
      "A model of pastoral moderation: indifferent customs, down to the wearing of trousers, are left free, while faith and morals are taught firmly.",
    citation: `${W}Pope_Nicholas_I`,
    links: { popes: ["pope-saint-nicholas-i"] },
  },
  {
    slug: "death-of-saint-cyril",
    title: "Death of St Cyril in Rome",
    year: 869,
    date: "0869-02-14",
    precision: "day",
    era: "early-medieval",
    kind: "saint",
    tags: ["mission", "liturgy"],
    location: "Rome",
    context:
      "Constantine-Cyril, who with his brother Methodius had given the Slavs the liturgy in their own tongue, dies in Rome and is buried in the Basilica of San Clemente.",
    significance:
      "Pope Adrian II had formally authorised the brothers' Slavonic liturgy; Methodius carried their work on as archbishop.",
    citation: `${W}Saints_Cyril_and_Methodius`,
  },
  {
    slug: "baptism-of-guthrum",
    title: "Baptism of Guthrum",
    year: 878,
    precision: "year",
    era: "early-medieval",
    kind: "mission",
    location: "Aller, Somerset",
    context:
      "Defeated by King Alfred at Edington, the Danish leader Guthrum is baptised at Aller, taking the name Æthelstan.",
    significance:
      "A treaty fixes the bounds between the two kingdoms, and East Anglia passes to a Danish king who is now a Christian.",
    citation: `${W}Guthrum`,
  },
  {
    slug: "council-of-constantinople-879",
    title: "Council of Constantinople restores Photius",
    year: 879,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    tags: ["schism"],
    location: "Constantinople",
    context:
      "In the presence of legates of Pope John VIII, a council sitting into 880 confirms Photius as the rightful patriarch and reads the Creed without the Filioque.",
    significance:
      "Many Orthodox count it the Eighth Ecumenical Council; the Catholic Church gives that place to the council of 869–870 instead.",
    citation: `${W}Fourth_Council_of_Constantinople_(Eastern_Orthodox)`,
  },
  {
    slug: "death-of-saint-methodius",
    title: "Death of St Methodius",
    year: 885,
    date: "0885-04-06",
    precision: "day",
    era: "early-medieval",
    kind: "saint",
    tags: ["mission", "liturgy"],
    location: "Great Moravia",
    context:
      "Methodius, archbishop for the Slavs, dies after naming his disciple Gorazd as successor; Pope John VIII had upheld the Slavonic liturgy, with the Gospel read first in Latin.",
    significance:
      "With Cyril he is honoured as Apostle of the Slavs; their liturgy and letters outlived the expulsion of their disciples from Moravia.",
    citation: `${NA}04592a.htm`,
  },
  {
    slug: "ohrid-literary-school",
    title: "Clement founds the Ohrid Literary School",
    year: 886,
    precision: "year",
    era: "early-medieval",
    kind: "mission",
    tags: ["liturgy"],
    location: "Ohrid",
    context:
      "At the order of Boris I, Clement founds a school at Ohrid to form a Slavonic-speaking clergy, later handing it on to Naum.",
    significance:
      "With Preslav, one of the two great centres of Slavonic Christian letters in the First Bulgarian Empire.",
    citation: `${W}Ohrid_Literary_School`,
  },
  {
    slug: "council-of-preslav",
    title: "Council of Preslav adopts Slavonic",
    year: 893,
    precision: "year",
    era: "early-medieval",
    kind: "council",
    tags: ["liturgy"],
    location: "Preslav",
    context:
      "A council under Boris I replaces his son Vladimir with Simeon, moves the capital to Preslav, sends away the Byzantine clergy and makes Slavonic the language of Church and state.",
    significance:
      "Bulgaria's Church gains its own clergy and liturgical tongue, opening a golden age of Slavonic letters.",
    citation: `${W}Council_of_Preslav`,
  },
  {
    slug: "cadaver-synod",
    title: "The Cadaver Synod",
    year: 897,
    precision: "year",
    era: "early-medieval",
    kind: "event",
    tags: ["papacy"],
    location: "Lateran Basilica, Rome",
    context:
      "Pope Stephen VI has the corpse of his predecessor-but-one, Pope Formosus, exhumed, put on trial, declared unworthy and finally thrown into the Tiber.",
    significance:
      "A low point of the papacy's capture by Roman factions: a revolt soon deposed Stephen, who was strangled in prison, and later synods annulled the trial.",
    citation: `${W}Cadaver_Synod`,
  },
];
