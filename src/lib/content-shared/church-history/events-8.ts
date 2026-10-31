import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";

/**
 * Church-history spine, part 8: the High Middle Ages in detail (1054–1378) —
 * the Gregorian reform and the Investiture Controversy, the crusades, the new
 * monastic, canonical, military and mendicant orders, the schools and
 * universities, the Albigensian crisis and the medieval Inquisition, the
 * Avignon popes and the Black Death. It fills in around the landmark events
 * of part 2 without repeating them. Every event cites one page that supports
 * its date and claim; a day is stored only where the exact day is well
 * attested, and contested dates fall back to the year or to "circa".
 */
export const EVENTS_8: ChurchHistoryEvent[] = [
  // ------------------------------------------------- Gregorian reform (1057–1122)
  {
    slug: "pataria-movement-in-milan",
    title: "The Pataria rises in Milan",
    year: 1057,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["reform"],
    location: "Milan",
    context:
      "The preacher Ariald begins rousing Milan against its married and simoniac clergy, launching the popular reform movement that came to be called the Pataria.",
    significance:
      "Backed by Rome's reformers, its long struggle over the see of Milan fed directly into the conflict between pope and emperor.",
    citation: `${W}Pataria`,
  },
  {
    slug: "synod-of-melfi-normans-become-papal-vassals",
    title: "Synod of Melfi: the Normans become vassals of the pope",
    year: 1059,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["papacy"],
    location: "Melfi",
    context:
      "Pope Nicholas II invests Robert Guiscard with Apulia, Calabria and a Sicily still to be won from the Saracens; Guiscard swears to hold his lands as the pope's vassal and to protect the Roman See.",
    significance:
      "The reform papacy gains armed protectors, pledged also to defend the freedom of papal elections decreed that same year.",
    citation: `${NA}11055a.htm`,
  },
  {
    slug: "death-of-saint-peter-damian",
    title: "Death of St Peter Damian",
    year: 1072,
    precision: "year",
    era: "high-medieval",
    kind: "saint",
    tags: ["reform", "doctor"],
    location: "Faenza",
    context:
      "Returning from a mission to reconcile Ravenna with the Holy See, the cardinal-bishop of Ostia and prior of Fonte Avellana falls ill with fever and dies at Faenza.",
    significance:
      "Hermit, reformer and tireless opponent of simony and clerical corruption, he was pronounced a Doctor of the Church in the nineteenth century.",
    citation: `${NA}11764a.htm`,
    links: { saints: ["saint-peter-damian"], doctors: ["doctor-peter-damian"] },
  },
  {
    slug: "election-of-gregory-vii",
    title: "Hildebrand elected Pope Gregory VII",
    year: 1073,
    date: "1073-04-22",
    precision: "day",
    era: "high-medieval",
    kind: "pope",
    tags: ["reform", "papacy"],
    location: "Lateran, Rome",
    context:
      "During the funeral rites for Alexander II, clergy and people cry out for the archdeacon Hildebrand, who is elected that day and takes the name Gregory.",
    significance:
      "Long the driving force behind the reform popes, he now leads the campaign against simony, clerical marriage and lay control of the Church in his own name.",
    citation: `${NA}06791c.htm`,
    links: { popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "henry-iv-excommunicated-1076",
    title: "Henry IV's bishops depose Gregory VII; the pope excommunicates the king",
    year: 1076,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["reform"],
    location: "Worms and Rome",
    context:
      "On 23 January a synod of Henry IV's supporters at Worms declares Gregory deposed; the pope answers by excommunicating Henry and releasing his subjects from their oaths of allegiance.",
    significance:
      "The Investiture Controversy becomes open conflict between papacy and empire, and within a year the king is a penitent at Canossa.",
    citation: `${NA}06791c.htm`,
    links: { popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "anselm-writes-the-proslogion",
    title: "St Anselm writes the Proslogion",
    year: 1078,
    precision: "circa",
    era: "high-medieval",
    kind: "document",
    tags: ["doctor"],
    context:
      "Anselm composes a prayerful meditation, first titled 'Faith Seeking Understanding', that reasons toward God as the being than which nothing greater can be conceived.",
    significance:
      "Its proof of God's existence, later named the ontological argument, has been debated by philosophers and theologians ever since.",
    citation: `${W}Proslogion`,
    links: { saints: ["saint-anselm"], doctors: ["doctor-anselm-of-canterbury"] },
  },
  {
    slug: "martyrdom-of-saint-stanislaus",
    title: "Martyrdom of St Stanislaus of Kraków",
    year: 1079,
    precision: "year",
    era: "high-medieval",
    kind: "martyrdom",
    location: "Kraków",
    context:
      "Bishop Stanislaus, who had excommunicated King Bolesław II for his cruelty, is struck down by the king himself, according to tradition while celebrating Mass.",
    significance:
      "Canonized by Innocent IV at Assisi in 1253, he became patron of Poland and of Kraków.",
    citation: `${NA}14246a.htm`,
    links: { saints: ["saint-stanislaus"], popes: ["pope-innocent-iv"] },
  },
  {
    slug: "berengar-signs-the-roman-eucharistic-profession",
    title: "Berengar of Tours signs a profession on the Eucharist",
    year: 1079,
    precision: "year",
    era: "high-medieval",
    kind: "document",
    tags: ["dogma"],
    location: "Lateran, Rome",
    context:
      "At a council in the Lateran under Gregory VII, Berengar, long accused of denying the real presence, signs a formula confessing that the bread and wine are substantially changed into the true body and blood of Christ.",
    significance:
      "The Roman formula expressed the Eucharistic change more clearly than any earlier document and prepared the later language of transubstantiation.",
    citation: `${NA}02487a.htm`,
    links: { popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "council-of-burgos-adopts-roman-rite",
    title: "Council of Burgos adopts the Roman Rite in Castile",
    year: 1080,
    precision: "year",
    era: "high-medieval",
    kind: "council",
    tags: ["liturgy"],
    location: "Burgos",
    context:
      "Encouraged by Gregory VII and Abbot Hugh of Cluny, King Alfonso VI's council decrees that the Roman liturgy replace the old Hispanic, or Mozarabic, rite in Castile.",
    significance:
      "Spain is drawn into the liturgical unity of the Latin West, while the ancient rite lives on among the Mozarabic Christians of Toledo.",
    citation: `${NA}10611a.htm`,
    links: { popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "synod-of-brixen-antipope-clement-iii",
    title: "Synod of Brixen names the antipope Clement III",
    year: 1080,
    precision: "year",
    era: "high-medieval",
    kind: "schism",
    tags: ["schism"],
    location: "Brixen",
    context:
      "Excommunicated a second time, Henry IV gathers his bishops at Brixen in June, and they choose the excommunicated Archbishop Guibert of Ravenna as pope under the name Clement III.",
    significance:
      "The empire now has its own claimant to set against the reform popes, and the schism outlasts Gregory himself.",
    citation: `${NA}06791c.htm`,
    links: { popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "canonization-of-stephen-of-hungary",
    title: "St Stephen of Hungary raised to the altars",
    year: 1083,
    date: "1083-08-20",
    precision: "day",
    era: "high-medieval",
    kind: "saint",
    location: "Székesfehérvár",
    context:
      "With Gregory VII's permission, King Ladislaus I has the remains of Hungary's first Christian king solemnly elevated; his son Emeric and Bishop Gerard of Csanád are canonized the same day.",
    significance:
      "Hungary gains its royal patron, and 20 August remains both his feast and the nation's founding day.",
    citation: `${W}Stephen_I_of_Hungary`,
    links: { saints: ["saint-stephen-of-hungary"], popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "normans-sack-rome-1084",
    title: "Robert Guiscard's Normans sack Rome",
    year: 1084,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Called in by Gregory VII, besieged by Henry IV, the Norman duke drives the emperor from Rome in May; when the citizens riot, his troops plunder the city for three days and set it ablaze.",
    significance:
      "Gregory is freed, but whole districts from the Capitoline to the Lateran are gutted, the darkest fruit of the papal alliance with the Normans.",
    citation: `${W}Sack_of_Rome_(1084)`,
    links: { popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "death-of-gregory-vii-in-exile",
    title: "Gregory VII dies in exile at Salerno",
    year: 1085,
    date: "1085-05-25",
    precision: "day",
    era: "high-medieval",
    kind: "pope",
    tags: ["reform", "papacy"],
    location: "Salerno",
    context:
      "Forced out of Rome by the anger his Norman allies' excesses had stirred, the pope dies at Salerno with the words, 'I have loved justice and hated iniquity; therefore I die in exile.'",
    significance:
      "He died seemingly defeated, yet the reform he championed shaped the medieval Church; he was canonized in 1728.",
    citation: `${NA}06791c.htm`,
    links: { popes: ["pope-saint-gregory-vii"] },
  },
  {
    slug: "election-of-urban-ii",
    title: "Odo of Châtillon elected Pope Urban II",
    year: 1088,
    date: "1088-03-12",
    precision: "day",
    era: "high-medieval",
    kind: "pope",
    tags: ["reform", "papacy"],
    location: "Terracina",
    context:
      "With Rome in the antipope's hands, bishops loyal to Gregory VII meet at Terracina and unanimously elect Odo, a former prior of Cluny whom Gregory had proposed as a successor.",
    significance:
      "He carries the Gregorian reform forward and, seven years later, summons the First Crusade.",
    citation: `${NA}15210a.htm`,
    links: { popes: ["pope-blessed-urban-ii"] },
  },
  {
    slug: "death-of-saint-margaret-of-scotland",
    title: "Death of St Margaret of Scotland",
    year: 1093,
    date: "1093-11-16",
    precision: "day",
    era: "high-medieval",
    kind: "saint",
    location: "Edinburgh",
    context:
      "The Anglo-Saxon princess who became the queen of Malcolm III dies at Edinburgh and is buried before the high altar at Dunfermline.",
    significance:
      "A reforming synod on the Lenten fast and Easter communion, and her life of prayer and charity, renewed Scottish church life; Innocent IV canonized her in 1250.",
    citation: `${NA}09655c.htm`,
    links: { saints: ["saint-margaret-of-scotland"], popes: ["pope-innocent-iv"] },
  },
  {
    slug: "council-of-piacenza",
    title: "Council of Piacenza hears the Byzantine appeal",
    year: 1095,
    date: "1095-03-01",
    precision: "day",
    era: "high-medieval",
    kind: "council",
    tags: ["crusade"],
    location: "Piacenza",
    context:
      "At a great synod held 1–7 March, Urban II receives envoys of Emperor Alexios I Komnenos seeking Western help against the Seljuk Turks and urges those present to give it.",
    significance:
      "The appeal set the stage for the crusade Urban would proclaim at Clermont that November.",
    citation: `${W}Council_of_Piacenza`,
    links: { popes: ["pope-blessed-urban-ii"] },
  },
  {
    slug: "rhineland-massacres-1096",
    title: "Crusading bands massacre the Jews of the Rhineland",
    year: 1096,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["crusade", "persecution"],
    location: "Speyer, Worms, Mainz",
    context:
      "Bands gathering for the crusade, above all Count Emicho's, slaughter the Jewish communities of Speyer, Worms, Mainz and other towns; bishops who try to shelter them are mostly overwhelmed.",
    significance:
      "The first great anti-Jewish violence of the crusading era, condemned by Church and imperial authorities and mourned in Jewish memory ever since.",
    citation: `${W}Rhineland_massacres`,
  },
  {
    slug: "council-of-bari",
    title: "Council of Bari: St Anselm defends the Filioque",
    year: 1098,
    precision: "year",
    era: "high-medieval",
    kind: "council",
    tags: ["schism"],
    location: "Bari",
    context:
      "In October Urban II gathers the Latin and Greek bishops of southern Italy; at the pope's call the exiled Anselm argues for the procession of the Holy Spirit from the Father and the Son.",
    significance:
      "The Italo-Greek bishops accepted the Latin positions on the Filioque and unleavened bread, but the council did nothing to heal the breach with Constantinople.",
    citation: `${W}Council_of_Bari`,
    links: {
      popes: ["pope-blessed-urban-ii"],
      saints: ["saint-anselm"],
      doctors: ["doctor-anselm-of-canterbury"],
    },
  },
  {
    slug: "anselm-completes-cur-deus-homo",
    title: "St Anselm completes Cur Deus Homo",
    year: 1098,
    precision: "year",
    era: "high-medieval",
    kind: "document",
    tags: ["doctor"],
    location: "Southern Italy",
    context:
      "In exile from England, Anselm finishes in an Italian mountain village the treatise 'Why God Became Man' that he had begun at Canterbury.",
    significance:
      "Its account of the satisfaction Christ offers for sin became the classic Western theology of the Atonement.",
    citation: `${NA}01546a.htm`,
    links: { saints: ["saint-anselm"], doctors: ["doctor-anselm-of-canterbury"] },
  },
  {
    slug: "foundation-of-fontevraud",
    title: "Robert of Arbrissel founds Fontevraud",
    year: 1100,
    precision: "circa",
    era: "high-medieval",
    kind: "order",
    tags: ["monastic"],
    location: "Anjou",
    context:
      "The wandering preacher Robert of Arbrissel settles his following of men and women in a double monastery and places the whole community under the rule of an abbess.",
    significance:
      "Approved by Paschal II in 1112, Fontevraud counted thousands of nuns within a generation and kept its rare government by an abbess over both sexes for centuries.",
    citation: `${NA}06129b.htm`,
    links: { popes: ["pope-paschal-ii"] },
  },
  {
    slug: "concordat-of-london",
    title: "Concordat of London settles investiture in England",
    year: 1107,
    precision: "year",
    era: "high-medieval",
    kind: "document",
    tags: ["reform"],
    location: "London",
    context:
      "After years of conflict and exile, Archbishop Anselm and King Henry I agree that the king will no longer invest bishops and abbots, while prelates still do homage for their lands.",
    significance:
      "The English compromise eased the investiture struggle fifteen years before the empire's settlement at Worms.",
    citation: `${NA}01546a.htm`,
    links: { saints: ["saint-anselm"], doctors: ["doctor-anselm-of-canterbury"] },
  },
  {
    slug: "abbey-of-saint-victor-founded",
    title: "William of Champeaux founds St Victor",
    year: 1108,
    precision: "year",
    era: "high-medieval",
    kind: "order",
    location: "Paris",
    context:
      "The famous master William of Champeaux gives up his chair at Notre-Dame and withdraws to a hermitage outside Paris, where his followers become canons regular and he resumes teaching.",
    significance:
      "St Victor became a center of piety and learning and, with the schools of Notre-Dame and Ste-Geneviève, a cradle of the University of Paris.",
    citation: `${NA}13388a.htm`,
  },
  {
    slug: "death-of-saint-anselm",
    title: "Death of St Anselm of Canterbury",
    year: 1109,
    date: "1109-04-21",
    precision: "day",
    era: "high-medieval",
    kind: "saint",
    tags: ["doctor"],
    location: "Canterbury",
    context:
      "The monk of Bec who became archbishop of Canterbury dies on Holy Wednesday, after years of exile in defense of the Church's rights.",
    significance:
      "Called the father of scholasticism, he was proclaimed a Doctor of the Church by Clement XI in 1720.",
    citation: `${W}Anselm_of_Canterbury`,
    links: { saints: ["saint-anselm"], doctors: ["doctor-anselm-of-canterbury"] },
  },
  {
    slug: "henry-v-takes-paschal-ii-captive",
    title: "Henry V takes Paschal II captive",
    year: 1111,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["reform"],
    location: "Rome",
    context:
      "When an agreement on investiture collapses in uproar at St Peter's on the day set for his coronation, Henry V carries off the pope and cardinals; after two months Paschal yields him the right of investiture.",
    significance:
      "Christendom condemned the emperor's violence, and the extorted concession settled nothing before the Concordat of Worms.",
    citation: `${NA}11514b.htm`,
    links: { popes: ["pope-paschal-ii"] },
  },
  {
    slug: "pie-postulatio-hospitallers-recognized",
    title: "Pie postulatio voluntatis: the Hospitallers recognized",
    year: 1113,
    date: "1113-02-15",
    precision: "day",
    era: "high-medieval",
    kind: "order",
    tags: ["crusade"],
    location: "Benevento",
    context:
      "Paschal II takes Brother Gerard's hospital for pilgrims in Jerusalem under the sole protection of the Holy See, with the right to elect its own master.",
    significance:
      "The Hospitallers grew into one of the great military orders; the Sovereign Military Order of Malta still commemorates the bull as its foundation.",
    citation: `${W}Pie_postulatio_voluntatis`,
    links: { popes: ["pope-paschal-ii"] },
  },
  {
    slug: "carta-caritatis-approved",
    title: "The Cistercian Charter of Charity approved",
    year: 1119,
    precision: "year",
    era: "high-medieval",
    kind: "document",
    tags: ["monastic", "reform"],
    location: "Cîteaux",
    context:
      "Pope Callixtus II approves the constitution, attributed to Abbot Stephen Harding, that binds Cîteaux and its daughter houses together through regular visitation and an annual general chapter.",
    significance:
      "It turned a family of abbeys into a true order, and the Fourth Lateran Council later required general chapters of every new order.",
    citation: `${W}Carta_Caritatis`,
    links: { popes: ["pope-callixtus-ii"] },
  },
  {
    slug: "sicut-judaeis",
    title: "Sicut Judaeis: a papal charter of protection for the Jews",
    year: 1120,
    precision: "circa",
    era: "high-medieval",
    kind: "document",
    location: "Rome",
    context:
      "In the wake of the crusade massacres, Callixtus II issues the first papal bull of protection for the Jews under this name; its reissues forbid forcing Jews to baptism or doing them violence.",
    significance:
      "Reissued by pope after pope, it fixed the official papal position that Jews were to be protected and never forcibly converted.",
    citation: `${W}Sicut_Judaeis`,
    links: { popes: ["pope-callixtus-ii"] },
  },
  {
    slug: "premonstratensians-founded",
    title: "St Norbert founds the Premonstratensians",
    year: 1120,
    precision: "year",
    era: "high-medieval",
    kind: "order",
    location: "Prémontré, near Laon",
    context:
      "Norbert of Xanten and thirteen companions settle at Prémontré to live as canons regular under the Rule of St Augustine, with austere statutes of their own.",
    significance:
      "Approved by Honorius II in 1126, the 'White Canons' spread rapidly, with some 1,300 houses of men by the mid-fourteenth century.",
    citation: `${W}Premonstratensians`,
    links: { saints: ["saint-norbert"] },
  },
  {
    slug: "otto-of-bamberg-mission-to-pomerania",
    title: "St Otto of Bamberg evangelizes Pomerania",
    year: 1124,
    precision: "year",
    era: "high-medieval",
    kind: "mission",
    tags: ["mission"],
    location: "Pomerania",
    context:
      "Invited by Duke Bolesław III of Poland, the bishop of Bamberg travels as papal legate among the Pomeranians, preaching in towns such as Pyrzyce, Kamień and Szczecin and reportedly baptizing thousands.",
    significance:
      "Succeeding where forcible attempts had failed, he earned the title 'Apostle of Pomerania' and was canonized in 1189.",
    citation: `${W}Otto_of_Bamberg`,
  },
  {
    slug: "council-of-troyes-templar-rule",
    title: "Council of Troyes gives the Templars a rule",
    year: 1129,
    precision: "year",
    era: "high-medieval",
    kind: "council",
    tags: ["crusade"],
    location: "Troyes",
    context:
      "Convened through St Bernard and attended by a papal legate, the council hears Hugues de Payens and approves a rule binding his knights to poverty, chastity, obedience and the defense of the Holy Land.",
    significance:
      "Founded a decade earlier with only a handful of knights, the order gains standing and recruits across Europe and grows into a power of the crusading age.",
    citation: `${W}Council_of_Troyes_(1129)`,
    links: { saints: ["saint-bernard-of-clairvaux"], doctors: ["doctor-bernard-of-clairvaux"] },
  },
  {
    slug: "papal-schism-of-1130",
    title: "Double election of 1130: Innocent II and Anacletus II",
    year: 1130,
    date: "1130-02-14",
    precision: "day",
    era: "high-medieval",
    kind: "schism",
    tags: ["schism", "papacy"],
    location: "Rome",
    context:
      "The morning after Honorius II's death a minority of cardinals hastily elects Innocent II; later the same day the majority proclaims Cardinal Pietro Pierleone as Anacletus II.",
    significance:
      "St Bernard's advocacy won most of Christendom for Innocent, and the schism ended only in 1138, after Anacletus's death.",
    citation: `${NA}01447a.htm`,
    links: { saints: ["saint-bernard-of-clairvaux"], doctors: ["doctor-bernard-of-clairvaux"] },
  },
  {
    slug: "council-of-sens-condemns-abelard",
    title: "Council of Sens condemns Peter Abelard",
    year: 1141,
    precision: "circa",
    era: "high-medieval",
    kind: "council",
    tags: ["dogma"],
    location: "Sens",
    context:
      "Prosecuted by St Bernard, the celebrated Paris master sees propositions from his writings condemned and appeals to Rome, but Innocent II confirms the sentence.",
    significance:
      "Abbot Peter the Venerable took him in at Cluny and reconciled him with Bernard; he died a Cluniac monk in 1142.",
    citation: `${NA}01036b.htm`,
    links: { saints: ["saint-bernard-of-clairvaux"], doctors: ["doctor-bernard-of-clairvaux"] },
  },
  {
    slug: "first-latin-translation-of-the-quran",
    title: "Peter the Venerable has the Qur'an translated into Latin",
    year: 1143,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    context:
      "The abbot of Cluny engages Robert of Ketton and a team of translators, and the first Latin version of the Qur'an is completed.",
    significance:
      "The earliest translation into a Western European language, made to equip Christians for apologetics and mission; later scholars faulted it as a loose paraphrase.",
    citation: `${W}Lex_Mahumet_pseudoprophete`,
  },
  {
    slug: "saint-denis-gothic-choir-dedicated",
    title: "Abbot Suger dedicates the Gothic choir of Saint-Denis",
    year: 1144,
    date: "1144-06-11",
    precision: "day",
    era: "high-medieval",
    kind: "event",
    location: "Saint-Denis, near Paris",
    context:
      "Built in just four years, Suger's new abbey choir, with rib vaults, pointed arches and walls opened up for great windows, is dedicated in the king's presence.",
    significance:
      "Widely held to be the first Gothic building, it opened an age of churches designed to be filled with light.",
    citation: `${W}Basilica_of_Saint-Denis`,
  },
  {
    slug: "bernard-preaches-the-second-crusade",
    title: "St Bernard preaches the Second Crusade at Vézelay",
    year: 1146,
    date: "1146-03-31",
    precision: "day",
    era: "high-medieval",
    kind: "event",
    tags: ["crusade"],
    location: "Vézelay",
    context:
      "Commissioned by Eugene III after the fall of Edessa, Bernard preaches before King Louis VII, Queen Eleanor and their nobles, who take the cross.",
    significance:
      "The crusade collapsed before Damascus in 1148; Bernard, stung by the failure, ascribed it to the crusaders' sins.",
    citation: `${W}Second_Crusade`,
    links: {
      popes: ["pope-eugene-iii"],
      saints: ["saint-bernard-of-clairvaux"],
      doctors: ["doctor-bernard-of-clairvaux"],
    },
  },
  {
    slug: "eugene-iii-approves-hildegards-visions",
    title: "Eugene III approves Hildegard's visions",
    year: 1147,
    precision: "circa",
    era: "high-medieval",
    kind: "saint",
    tags: ["doctor"],
    location: "Trier",
    context:
      "While at Trier, Pope Eugene III has the writings of the Benedictine visionary Hildegard examined by a commission, which reports favourably; she continues her Scivias.",
    significance:
      "Approval opened her way to an extraordinary public voice: popes, emperors and St Bernard were among her correspondents.",
    citation: `${NA}07351a.htm`,
    links: {
      popes: ["pope-eugene-iii"],
      saints: ["saint-hildegard-of-bingen"],
      doctors: ["doctor-hildegard-of-bingen"],
    },
  },
  {
    slug: "death-of-saint-malachy",
    title: "St Malachy dies at Clairvaux",
    year: 1148,
    date: "1148-11-02",
    precision: "day",
    era: "high-medieval",
    kind: "saint",
    location: "Clairvaux",
    context:
      "Travelling to Rome, the former archbishop of Armagh falls ill at Clairvaux and dies in the arms of his friend St Bernard.",
    significance:
      "He had restored discipline and the Roman liturgy in the Irish Church and brought the Cistercians to Ireland at Mellifont; Bernard wrote his life.",
    citation: `${NA}09565a.htm`,
    links: { saints: ["saint-bernard-of-clairvaux"] },
  },
  {
    slug: "nidaros-becomes-norways-metropolitan-see",
    title: "Nidaros becomes the metropolitan see of Norway",
    year: 1152,
    precision: "circa",
    era: "high-medieval",
    kind: "mission",
    tags: ["mission"],
    location: "Nidaros (Trondheim)",
    context:
      "Sent by Eugene III, the legate Nicholas Breakspear installs an archbishop at Nidaros, the city of St Olaf's shrine, with sees from Oslo to Iceland and Greenland as suffragans.",
    significance:
      "The Norwegian Church gains its own province, no longer subject to Lund; the legate would soon be elected pope as Adrian IV.",
    citation: `${W}Roman_Catholic_Archdiocese_of_Nidaros`,
    links: { popes: ["pope-eugene-iii", "pope-adrian-iv"] },
  },
  {
    slug: "death-of-saint-bernard",
    title: "Death of St Bernard of Clairvaux",
    year: 1153,
    precision: "year",
    era: "high-medieval",
    kind: "saint",
    tags: ["doctor"],
    location: "Clairvaux",
    context:
      "The abbot whose voice had carried through the councils, schisms and crusades of his age dies at Clairvaux, having founded 163 monasteries across Europe.",
    significance:
      "Canonized by Alexander III in 1174, the first Cistercian on the calendar of saints, he was later named a Doctor of the Church.",
    citation: `${NA}02498d.htm`,
    links: {
      popes: ["pope-alexander-iii"],
      saints: ["saint-bernard-of-clairvaux"],
      doctors: ["doctor-bernard-of-clairvaux"],
    },
  },
  {
    slug: "election-of-adrian-iv",
    title: "Nicholas Breakspear elected Pope Adrian IV",
    year: 1154,
    date: "1154-12-04",
    precision: "day",
    era: "high-medieval",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Back from his legation to Scandinavia, the cardinal-bishop of Albano is elected the day after the death of Anastasius IV.",
    significance:
      "The only pope born in England; his reign was taken up with the Roman commune, the Normans of Sicily and a growing rift with Frederick Barbarossa.",
    citation: `${W}Pope_Adrian_IV`,
    links: { popes: ["pope-adrian-iv"] },
  },
  {
    slug: "execution-of-arnold-of-brescia",
    title: "Arnold of Brescia executed",
    year: 1155,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["reform"],
    location: "Rome",
    context:
      "The canon who demanded that the clergy renounce property, and who had led the Roman commune against the popes, is seized by Frederick Barbarossa's men, condemned by the Curia as a rebel and hanged; his ashes are thrown into the Tiber.",
    significance:
      "He was never charged with heresy, and his ideal of a poor Church lived on among later dissenting movements.",
    citation: `${W}Arnold_of_Brescia`,
  },
  {
    slug: "papal-schism-of-1159",
    title: "Disputed election of 1159: Alexander III and Victor IV",
    year: 1159,
    date: "1159-09-07",
    precision: "day",
    era: "high-medieval",
    kind: "schism",
    tags: ["schism", "papacy"],
    location: "Rome",
    context:
      "Most of the cardinals elect the canonist Orlando Bandinelli as Alexander III, while an imperial minority names Cardinal Octavian as Victor IV, whom Frederick Barbarossa backs.",
    significance:
      "A schism of seventeen years followed, ending only when the emperor, defeated at Legnano, made peace at Venice in 1177.",
    citation: `${NA}01287a.htm`,
    links: { popes: ["pope-alexander-iii"] },
  },
  {
    slug: "canonization-of-edward-the-confessor",
    title: "Alexander III canonizes Edward the Confessor",
    year: 1161,
    precision: "year",
    era: "high-medieval",
    kind: "saint",
    location: "Westminster",
    context:
      "The pope enrolls among the saints the Anglo-Saxon king who rebuilt Westminster Abbey and was buried there in January 1066.",
    significance:
      "On 13 October 1163, still his feast day, Thomas Becket solemnly translated his incorrupt body.",
    citation: `${NA}05322a.htm`,
    links: { saints: ["saint-edward-the-confessor"], popes: ["pope-alexander-iii"] },
  },
  {
    slug: "notre-dame-de-paris-begun",
    title: "Construction of Notre-Dame de Paris begins",
    year: 1163,
    precision: "year",
    era: "high-medieval",
    kind: "event",
    tags: ["marian"],
    location: "Paris",
    context:
      "Bishop Maurice de Sully begins a great new Gothic cathedral of Our Lady; a chronicler records the laying of its cornerstone in the presence of King Louis VII and Pope Alexander III.",
    significance:
      "Largely complete by 1260, it became one of the best-known churches of Christendom.",
    citation: `${W}Notre-Dame_de_Paris`,
    links: { popes: ["pope-alexander-iii"] },
  },
];
