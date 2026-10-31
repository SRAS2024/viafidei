import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";

/**
 * Church-history spine, part 9: the Western Schism, the Renaissance, the
 * Reformation and Trent in detail (1378–1648). It fills in the years between
 * the landmarks of parts 2 and 3: the councils of Constance, Basel and
 * Florence and their decrees, Wycliffe and Hus, the Renaissance popes and
 * their scandals, the opening of the missions in Africa and the Americas, the
 * Protestant reformers, the English martyrs, the sessions of Trent, the
 * Catholic reform and its saints, the Asian missions, and the Thirty Years'
 * War. Each entry cites the one page it was checked against.
 */
export const EVENTS_9: ChurchHistoryEvent[] = [
  // ---------------------------------------------------------------- Western Schism & Renaissance
  {
    slug: "election-of-urban-vi",
    title: "Urban VI elected in a disputed conclave",
    year: 1378,
    date: "1378-04-08",
    precision: "day",
    era: "schism-renaissance",
    kind: "pope",
    tags: ["papacy", "schism"],
    location: "Rome",
    context:
      "With a Roman crowd surrounding the conclave and demanding a Roman pope, the cardinals elect Bartolomeo Prignano, Archbishop of Bari, the last pope chosen from outside the College of Cardinals.",
    significance:
      "Within months the French cardinals declare that the mob had cowed them and the election was invalid, and the Western Schism follows.",
    citation: `${W}Pope_Urban_VI`,
  },
  {
    slug: "death-of-catherine-of-siena",
    title: "Death of St Catherine of Siena",
    year: 1380,
    date: "1380-04-29",
    precision: "day",
    era: "schism-renaissance",
    kind: "saint",
    location: "Rome",
    context:
      "The Dominican tertiary who had implored Gregory XI to leave Avignon, and who rallied to Urban VI from the outset of the schism, dies in Rome aged thirty-three.",
    significance:
      "Pius II canonises her in 1461; her Dialogue and nearly four hundred letters rank among the classics of the Italian language.",
    citation: `${NA}03447a.htm`,
    links: { saints: ["saint-catherine-of-siena"], doctors: ["doctor-catherine-of-siena"] },
  },
  {
    slug: "blackfriars-synod-condemns-wycliffe",
    title: "Blackfriars Synod condemns Wycliffe",
    year: 1382,
    date: "1382-05-21",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["reformation"],
    location: "London",
    context:
      "Archbishop William Courtenay's assembly, shaken by an earthquake during its deliberations, condemns twenty-four propositions drawn from John Wycliffe's teaching, ten as heretical and fourteen as erroneous.",
    significance:
      "His Oxford followers are summoned to recant and Wycliffe withdraws to Lutterworth, where he dies in 1384; the Lollards keep his ideas alive, and his theology shapes Jan Hus.",
    citation: `${W}Blackfriars_Synod`,
  },
  {
    slug: "baptism-of-jogaila",
    title: "Baptism of Jogaila and the conversion of Lithuania",
    year: 1386,
    date: "1386-02-15",
    precision: "day",
    era: "schism-renaissance",
    kind: "mission",
    tags: ["mission"],
    location: "Kraków",
    context:
      "Grand Duke Jogaila of Lithuania, who agreed at Krėva to accept Catholicism and marry Queen Jadwiga of Poland, is baptised in Wawel Cathedral and becomes King Władysław II Jagiełło.",
    significance:
      "Returning in 1387, he has nobles and peasants baptised around Vilnius and builds its cathedral, bringing the last pagan state in Europe into Christendom.",
    citation: `${W}Christianization_of_Lithuania`,
  },
  {
    slug: "canonization-of-bridget-of-sweden",
    title: "St Bridget of Sweden canonised",
    year: 1391,
    date: "1391-10-07",
    precision: "day",
    era: "schism-renaissance",
    kind: "saint",
    location: "Rome",
    context:
      "Boniface IX canonises Bridget of Sweden, the widowed visionary who founded the Order of St Saviour and spent her last years in Rome.",
    significance:
      "Bridget had urged the popes to bring the Holy See back from Avignon to Rome, and her Revelations were held in great repute throughout the Middle Ages.",
    citation: `${NA}02782a.htm`,
    links: { saints: ["saint-bridget-of-sweden"] },
  },
  {
    slug: "haec-sancta",
    title: "Haec sancta asserts the council's authority",
    year: 1415,
    date: "1415-04-06",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["schism", "papacy"],
    location: "Constance",
    context:
      "In its fifth session the Council of Constance declares that it holds its power immediately from Christ and that everyone, the pope included, must obey it in matters of faith, the ending of the schism and reform.",
    significance:
      "It becomes the charter of conciliarism; readings of its authority have ranged ever since from binding dogma to an emergency measure for a Church with three claimants.",
    citation: `${W}Haec_sancta`,
  },
  {
    slug: "resignation-of-gregory-xii",
    title: "Gregory XII resigns",
    year: 1415,
    date: "1415-07-04",
    precision: "day",
    era: "schism-renaissance",
    kind: "pope",
    tags: ["schism", "papacy"],
    location: "Constance",
    context:
      "Having had the Council of Constance formally convoked in his name, the Roman pope Gregory XII has his resignation pronounced by his proxy Carlo Malatesta.",
    significance:
      "His abdication clears the way for a single undisputed pope; no pope resigns again until Benedict XVI in 2013.",
    citation: `${W}Pope_Gregory_XII`,
  },
  {
    slug: "burning-of-jan-hus",
    title: "Jan Hus burned at Constance",
    year: 1415,
    date: "1415-07-06",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["reformation"],
    location: "Constance",
    context:
      "The Czech preacher Jan Hus, deeply influenced by the writings of Wycliffe, is tried and condemned by the Council of Constance and burned at the stake.",
    significance:
      "His followers in Bohemia, the Hussites, take up his cause against both Rome and the Empire.",
    citation: `${NA}07584b.htm`,
  },
  {
    slug: "frequens",
    title: "Frequens decrees regular general councils",
    year: 1417,
    date: "1417-10-09",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["reform"],
    location: "Constance",
    context:
      "In its thirty-ninth session the Council of Constance decrees that a general council shall be held every ten years.",
    significance:
      "Together with Haec sancta it embodies the conciliar programme that the popes of the following decades resist.",
    citation: `${NA}04288a.htm`,
  },
  {
    slug: "death-of-vincent-ferrer",
    title: "Death of St Vincent Ferrer",
    year: 1419,
    date: "1419-04-05",
    precision: "day",
    era: "schism-renaissance",
    kind: "saint",
    location: "Vannes",
    context:
      "The Dominican Vincent Ferrer, long a loyal supporter of the Avignon claimant Benedict XIII until he abandoned him in 1416, dies in Brittany after twenty years of preaching penance across western Europe.",
    significance:
      "One of the most celebrated preachers of the Middle Ages, he is canonised by Callixtus III in 1455.",
    citation: `${NA}15437a.htm`,
  },
  {
    slug: "first-defenestration-of-prague",
    title: "First Defenestration of Prague",
    year: 1419,
    date: "1419-07-30",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["schism"],
    location: "Prague",
    context:
      "A Hussite procession led by the priest Jan Želivský storms the town hall and throws the judge, the burgomaster and several councillors from the windows to their deaths.",
    significance: "The killings set off the long Hussite Wars in Bohemia.",
    citation: `${W}First_Defenestration_of_Prague`,
  },
  {
    slug: "martin-v-enters-rome",
    title: "Martin V enters Rome",
    year: 1420,
    date: "1420-09-28",
    precision: "day",
    era: "schism-renaissance",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Martin V arrives in a Rome lying almost in ruins, its people decimated by famine and sickness after decades of absent and divided popes.",
    significance:
      "He restores the city's churches, bridges and public buildings and recovers the Papal States, making Rome again the settled seat of the papacy.",
    citation: `${NA}09725a.htm`,
    links: { popes: ["pope-martin-v"] },
  },
  {
    slug: "frances-of-rome-founds-tor-de-specchi",
    title: "St Frances of Rome founds the Oblates of Tor de' Specchi",
    year: 1433,
    date: "1433-03-25",
    precision: "day",
    era: "schism-renaissance",
    kind: "order",
    location: "Rome",
    context:
      "Frances of Rome gathers the women she had associated as oblates of the Benedictine monastery of Santa Maria Nuova into a common life at Tor de' Specchi.",
    significance:
      "Eugene IV approves the community that July; Frances dies in 1440 and is canonised by Paul V in 1608.",
    citation: `${NA}06205c.htm`,
    links: { saints: ["saint-frances-of-rome"], popes: ["pope-eugene-iv"] },
  },
  {
    slug: "compacts-of-basel",
    title: "Compacts of Basel reconcile the Utraquists",
    year: 1436,
    date: "1436-07-05",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["schism"],
    location: "Jihlava",
    context:
      "At the Diet of Iglau the Bohemian representatives accept the Compacts agreed with the Council of Basel, allowing communion under both kinds to all adults in Bohemia and Moravia who desire it.",
    significance:
      "The settlement reconciles the moderate Hussites with the Church, though Pius II declares the Compacts null and void in 1462.",
    citation: `${NA}07585a.htm`,
  },
  {
    slug: "pragmatic-sanction-of-bourges",
    title: "Pragmatic Sanction of Bourges",
    year: 1438,
    date: "1438-07-07",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["papacy"],
    location: "Bourges",
    context:
      "Charles VII of France decrees that a general council, superior to the pope, is to meet every ten years and that church offices are to be filled by election rather than papal appointment.",
    significance:
      "A founding charter of French Gallicanism, it governs the Church in France until the Concordat of Bologna supersedes it in 1516.",
    citation: `${W}Pragmatic_Sanction_of_Bourges`,
  },
  {
    slug: "laetentur-caeli",
    title: "Laetentur caeli: union with the Greeks",
    year: 1439,
    date: "1439-07-06",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["schism", "dogma"],
    location: "Florence",
    context:
      "After long debate on the Filioque, purgatory, unleavened bread and the primacy, the decree of union between the Latin and Greek Churches is solemnly proclaimed in Florence Cathedral.",
    significance:
      "Opposition among the Byzantine clergy and people keeps it from taking hold before Constantinople falls in 1453.",
    citation: `${NA}06111a.htm`,
    links: { documentSlug: "laetentur-caeli", popes: ["pope-eugene-iv"] },
  },
  {
    slug: "basel-elects-felix-v",
    title: "Basel deposes Eugene IV and elects Felix V",
    year: 1439,
    precision: "year",
    era: "schism-renaissance",
    kind: "schism",
    tags: ["schism"],
    location: "Basel",
    context:
      "The rump Council of Basel declares Eugene IV deposed as a heretic and elects Duke Amadeus VIII of Savoy, who takes the name Felix V.",
    significance:
      "The last antipope with a significant following, he submits to Nicholas V in 1449 and the conciliar schism ends.",
    citation: `${W}Antipope_Felix_V`,
    links: { popes: ["pope-eugene-iv", "pope-nicholas-v"] },
  },
  {
    slug: "valla-exposes-the-donation-of-constantine",
    title: "Lorenzo Valla exposes the Donation of Constantine",
    year: 1440,
    precision: "circa",
    era: "schism-renaissance",
    kind: "document",
    tags: ["papacy"],
    context:
      "Writing in the service of Alfonso V of Aragon, then at odds with the Papal States, the humanist Lorenzo Valla shows from its language that the Donation of Constantine cannot date from the fourth century.",
    significance:
      "His philological critique undermines a text long used to support the popes' temporal power; first printed in 1517, it becomes popular among Protestants.",
    citation: `${W}Lorenzo_Valla`,
  },
  {
    slug: "cantate-domino-union-with-the-copts",
    title: "Cantate Domino: union with the Copts",
    year: 1442,
    date: "1442-02-04",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["schism"],
    location: "Florence",
    context:
      "At the Council of Florence Eugene IV promulgates the bull of union with the Coptic Church, which also rejects continued observance of circumcision and the Mosaic law.",
    significance:
      "The attempted union soon fails, but the bull stands among the Council of Florence's major doctrinal statements.",
    citation: `${W}Bull_of_Union_with_the_Copts`,
    links: { popes: ["pope-eugene-iv"] },
  },
  {
    slug: "death-of-bernardine-of-siena",
    title: "Death of St Bernardine of Siena",
    year: 1444,
    date: "1444-05-20",
    precision: "day",
    era: "schism-renaissance",
    kind: "saint",
    location: "L'Aquila",
    context:
      "Bernardine of Siena, the great Observant Franciscan preacher who urged cities to replace their factional emblems with the monogram of the Holy Name, IHS, dies at L'Aquila.",
    significance:
      "Nicholas V canonises him only six years later, and the devotion to the Holy Name of Jesus he championed spreads through the Church.",
    citation: `${NA}02505b.htm`,
    links: { saints: ["saint-bernardine-of-siena"] },
  },
  {
    slug: "crusade-of-varna",
    title: "Crusade of Varna defeated",
    year: 1444,
    date: "1444-11-10",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["crusade"],
    location: "Varna",
    context:
      "The crusade Eugene IV proclaimed against the Ottomans is crushed at Varna; King Władysław III of Poland and Hungary vanishes in the battle and the papal legate Cardinal Julian Cesarini is killed.",
    significance:
      "The defeat ends serious attempts to drive the Ottomans from Europe for decades and deters real help when Constantinople is besieged in 1453.",
    citation: `${W}Crusade_of_Varna`,
    links: { popes: ["pope-eugene-iv"] },
  },
  {
    slug: "dum-diversas",
    title: "Dum Diversas",
    year: 1452,
    date: "1452-06-18",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    location: "Rome",
    context:
      "Nicholas V grants King Afonso V of Portugal full permission to invade, capture and subjugate 'Saracens and pagans' and to reduce them to perpetual servitude.",
    significance:
      "With Romanus Pontifex (1455), it gives the Portuguese what they take as moral sanction for the slave trade from West Africa.",
    citation: `${W}Dum_Diversas`,
    links: { popes: ["pope-nicholas-v"] },
  },
  {
    slug: "union-proclaimed-in-hagia-sophia",
    title: "Union proclaimed in Hagia Sophia",
    year: 1452,
    date: "1452-12-12",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["schism"],
    location: "Constantinople",
    context:
      "Cardinal Isidore of Kiev, sent from Rome, proclaims in Hagia Sophia the union of the Greek and Latin Churches agreed at Florence, as the Ottomans close in on Constantinople.",
    significance:
      "Less than six months later the city falls; Isidore, wounded in the sack, escapes in disguise.",
    citation: `${W}Isidore_of_Kiev`,
  },
  {
    slug: "siege-of-belgrade-1456",
    title: "Siege of Belgrade lifted",
    year: 1456,
    date: "1456-07-22",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["crusade"],
    location: "Belgrade",
    context:
      "John Hunyadi's army and a crusading host raised by the Franciscan John of Capistrano force Sultan Mehmed II to lift his siege of Belgrade.",
    significance:
      "The noon bell that Callixtus III ordered rung in every church is traditionally linked with the victory; Hunyadi dies of plague three weeks later.",
    citation: `${W}Siege_of_Belgrade_(1456)`,
    links: { saints: ["saint-john-of-capistrano"] },
  },
  {
    slug: "death-of-rita-of-cascia",
    title: "Death of St Rita of Cascia",
    year: 1457,
    date: "1457-05-22",
    precision: "day",
    era: "schism-renaissance",
    kind: "saint",
    location: "Cascia",
    context:
      "Rita, a widow who entered the Augustinian monastery of St Mary Magdalene at Cascia and bore a wound on her forehead regarded as a partial stigmata, dies there.",
    significance:
      "Canonised by Leo XIII in 1900, she becomes one of the most popular saints of the Catholic world.",
    citation: `${W}Rita_of_Cascia`,
    links: { saints: ["saint-rita-of-cascia"] },
  },
  {
    slug: "execrabilis",
    title: "Execrabilis forbids appeals to a future council",
    year: 1460,
    date: "1460-01-18",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["papacy"],
    context:
      "Pius II condemns as erroneous and detestable any appeal from the pope to a future general council.",
    significance:
      "A papal answer to conciliarism, though in its own day it was received more as the manifesto of one party than as an authoritative ruling.",
    citation: `${W}Execrabilis`,
    links: { popes: ["pope-pius-ii"] },
  },
  {
    slug: "vatican-library-founded",
    title: "Vatican Library founded",
    year: 1475,
    date: "1475-06-15",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    location: "Rome",
    context:
      "Sixtus IV formally establishes the Vatican Library with the bull Ad decorem militantis Ecclesiae, after Nicholas V had sought to found a public library at the Vatican.",
    significance:
      "Holding some 3,500 manuscripts at its foundation, it grows into one of the world's great research libraries.",
    citation: `${W}Vatican_Apostolic_Library`,
    links: { popes: ["pope-sixtus-iv", "pope-nicholas-v"] },
  },
  {
    slug: "sixtus-iv-adopts-the-immaculate-conception-feast",
    title: "Sixtus IV adopts the feast of the Immaculate Conception",
    year: 1476,
    date: "1476-02-28",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["marian"],
    location: "Rome",
    context:
      "Sixtus IV adopts the feast of the Immaculate Conception for the whole Latin Church, with a proper Office and an indulgence for those who take part.",
    significance:
      "In 1483 he forbids either side in the debate to brand the other heretical; the doctrine is defined as dogma in 1854.",
    citation: `${NA}07674d.htm`,
    links: { popes: ["pope-sixtus-iv"] },
  },
  {
    slug: "pazzi-conspiracy",
    title: "Pazzi conspiracy",
    year: 1478,
    date: "1478-04-26",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Florence",
    context:
      "In a plot laid by Sixtus IV's nephew Girolamo Riario, Archbishop Francesco Salviati and Francesco de' Pazzi, assassins stab Giuliano de' Medici to death and wound Lorenzo during High Mass in Florence Cathedral.",
    significance:
      "Sixtus, who backed the plot's aims while refusing to sanction killing, excommunicates Lorenzo and lays Florence under interdict after Salviati is hanged.",
    citation: `${W}Pazzi_conspiracy`,
    links: { popes: ["pope-sixtus-iv"] },
  },
  {
    slug: "sistine-chapel-consecrated",
    title: "Sistine Chapel consecrated",
    year: 1483,
    date: "1483-08-15",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "The chapel built for Sixtus IV between 1473 and 1481, its walls frescoed by Botticelli, Perugino, Ghirlandaio and others, is consecrated and dedicated to the Virgin Mary on the feast of the Assumption.",
    significance:
      "It becomes the setting of every papal conclave, and Michelangelo later paints its ceiling and the Last Judgment.",
    citation: `${W}Sistine_Chapel`,
    links: { popes: ["pope-sixtus-iv"] },
  },
  {
    slug: "death-of-saint-casimir",
    title: "Death of St Casimir",
    year: 1484,
    date: "1484-03-04",
    precision: "day",
    era: "schism-renaissance",
    kind: "saint",
    location: "Grodno",
    context:
      "The Polish prince Casimir, noted for his special devotion to the Blessed Virgin, dies at the court of Grodno on a journey to Lithuania.",
    significance: "Canonised in 1522, he is the patron of Poland and Lithuania.",
    citation: `${NA}03402a.htm`,
    links: { saints: ["saint-casimir"] },
  },
  {
    slug: "summis-desiderantes-affectibus",
    title: "Summis desiderantes affectibus",
    year: 1484,
    date: "1484-12-05",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    location: "Rome",
    context:
      "At the request of the Dominican inquisitor Heinrich Kramer, Innocent VIII confirms the authority of Kramer and James Sprenger to prosecute witchcraft in Germany.",
    significance:
      "Kramer prints the bull in his Malleus Maleficarum (1487), implying a papal approval that scholars judge misleading; the bull is often seen as opening the door to the early modern witch-hunts.",
    citation: `${W}Summis_desiderantes_affectibus`,
  },
  {
    slug: "baptism-of-the-king-of-kongo",
    title: "King of Kongo baptised",
    year: 1491,
    date: "1491-05-03",
    precision: "day",
    era: "schism-renaissance",
    kind: "mission",
    tags: ["mission"],
    location: "Kongo",
    context:
      "Nzinga a Nkuwu, ruler of the Kingdom of Kongo, is baptised with his family as João I by Portuguese priests who arrive with a royal embassy.",
    significance:
      "He abandons the faith within a few years, partly over the demand for monogamy, but his son Afonso, baptised with the royal family, succeeds him in 1509.",
    citation: `${W}Nzinga_a_Nkuwu`,
  },
  {
    slug: "fall-of-granada",
    title: "Fall of Granada",
    year: 1492,
    date: "1492-01-02",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    location: "Granada",
    context:
      "Boabdil surrenders the Emirate of Granada to Ferdinand and Isabella, ending the last Muslim state in the Iberian peninsula and the long Reconquista.",
    significance:
      "The surrender treaty guarantees Muslims freedom of religion, but by 1501 Granada's Muslims are compelled to convert, accept slavery or leave.",
    citation: `${W}Fall_of_Granada`,
  },
  {
    slug: "alhambra-decree",
    title: "Alhambra Decree expels the Jews of Spain",
    year: 1492,
    date: "1492-03-31",
    precision: "day",
    era: "schism-renaissance",
    kind: "event",
    tags: ["persecution"],
    location: "Granada",
    context:
      "Ferdinand and Isabella order every Jew who will not accept baptism to leave Castile and Aragon by 31 July.",
    significance:
      "Tens of thousands go into exile and many more convert under pressure, a grave injustice the Spanish state formally revoked only in 1968.",
    citation: `${W}Alhambra_Decree`,
  },
  {
    slug: "election-of-alexander-vi",
    title: "Rodrigo Borgia elected as Alexander VI",
    year: 1492,
    date: "1492-08-11",
    precision: "day",
    era: "schism-renaissance",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Cardinal Rodrigo Borgia, father of four children by Vannozza Cattanei, is proclaimed pope amid a general belief that he had bought his election.",
    significance:
      "Catholic historians judge that he carried into the papacy the manner of life that had disgraced his cardinalate, while distinguishing the man from the office he held.",
    citation: `${NA}01289a.htm`,
    links: { popes: ["pope-alexander-vi"] },
  },
  {
    slug: "inter-caetera",
    title: "Inter caetera",
    year: 1493,
    date: "1493-05-04",
    precision: "day",
    era: "schism-renaissance",
    kind: "document",
    tags: ["mission"],
    location: "Rome",
    context:
      "Alexander VI grants the Catholic Monarchs the lands west and south of a line a hundred leagues beyond the Azores and Cape Verde, charging them to spread the Catholic faith there.",
    significance:
      "The 1494 Treaty of Tordesillas moves the line further west; centuries later the grant is cited in the legal doctrine of discovery.",
    citation: `${W}Inter_caetera`,
    links: { popes: ["pope-alexander-vi"] },
  },
];
