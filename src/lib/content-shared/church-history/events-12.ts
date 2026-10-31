import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";
const JUBILEE = `${W}Jubilee_in_the_Catholic_Church`;
const APPARITIONS = `${W}List_of_Marian_apparitions`;

/**
 * Church-history spine, part 12: the completeness pass across all eras. It
 * fills the gaps left between the era parts (5–11) in the categories a
 * detailed Catholic timeline must cover — every Holy Year from 1390 to the
 * Franciscan jubilee of 2026, every papal death and election since 1823 not
 * already present, the Doctors (John of Damascus, John of Ávila, the Greek
 * Doctors of 1568) still without a key moment, Trent's and Florence's
 * remaining dogmatic decrees, the founding of further major orders, reunions
 * and schisms, the evangelisation of Brazil, the Philippines, Vietnam, New
 * Zealand, Finland, Livonia and East Africa, groups of canonised martyrs, the
 * remaining Church-approved Marian apparitions, landmark encyclicals and the
 * other nine Vatican II decrees, and the law books and catechisms.
 *
 * Events that share a slug with a published CHURCH_DOCUMENT are enriched by
 * it on the timeline instead of appearing twice; `documentSlug` is set where
 * the document is part of the curated knowledge base.
 */
export const EVENTS_12: ChurchHistoryEvent[] = [
  // ---------------------------------------------------------------- Apostolic Age to the early Middle Ages
  {
    slug: "our-lady-of-the-pillar",
    title: "Our Lady of the Pillar appears to St James at Zaragoza (tradition)",
    year: 40,
    precision: "circa",
    era: "apostolic",
    kind: "apparition",
    tags: ["marian"],
    location: "Caesaraugusta (Zaragoza), Hispania",
    context:
      "Spanish tradition holds that Mary, then still living in Jerusalem, appeared to the Apostle James on the banks of the Ebro to strengthen him in a discouraging mission.",
    significance:
      "Counted the first Marian apparition, and unique in being set within Mary's earthly life, it received approval for liturgical veneration from Clement XII in 1730.",
    citation: APPARITIONS,
    links: {
      apparitions: ["apparition-our-lady-of-the-pillar-zaragoza"],
      saints: ["saint-james-the-greater"],
    },
  },
  {
    slug: "formula-of-hormisdas-ends-the-acacian-schism",
    title: "Formula of Hormisdas ends the Acacian Schism",
    year: 519,
    date: "0519-03-28",
    precision: "day",
    era: "fathers",
    kind: "event",
    tags: ["schism"],
    location: "Constantinople",
    context:
      "On Holy Thursday Patriarch John of Constantinople signs Pope Hormisdas's profession of faith; Acacius and the emperors Zeno and Anastasius are struck from the diptychs and communion with Rome is solemnly restored.",
    significance:
      "Most Eastern bishops signed the same formula, whose confession that the Catholic faith has always been kept spotless in the Apostolic See was cited again at the First Vatican Council.",
    citation: `${NA}07470a.htm`,
    links: { popes: ["pope-saint-hormisdas"] },
  },
  {
    slug: "john-damascene-defends-the-holy-images",
    title: "St John of Damascus defends the holy images",
    year: 730,
    precision: "circa",
    era: "early-medieval",
    kind: "document",
    tags: ["doctor"],
    location: "Damascus",
    context:
      "From the safety of the caliph's court, where he had risen to chief councillor, John of Damascus answers Leo III's edicts of 726 and 730 against the icons with writings defending their veneration.",
    significance:
      "Condemned by name by the iconoclast synod of 754 and vindicated at Nicaea II in 787, the last of the Greek Fathers was enrolled among the Doctors of the Church under Leo XIII.",
    citation: `${NA}08459b.htm`,
    links: { doctors: ["doctor-john-of-damascus"] },
  },
  // ---------------------------------------------------------------- High Middle Ages
  {
    slug: "richeldis-vision-at-walsingham",
    title: "Richeldis's vision of the Holy House at Walsingham (tradition)",
    year: 1061,
    precision: "circa",
    era: "high-medieval",
    kind: "apparition",
    tags: ["marian"],
    location: "Walsingham, Norfolk",
    context:
      "The Saxon noblewoman Richeldis de Faverches reports that Mary showed her in a vision the house of the Annunciation at Nazareth and asked her to build a copy of it at Walsingham.",
    significance:
      "Kept by Augustinian canons from the twelfth century, the shrine stood until Henry VIII's soldiers sacked the priory in 1538; Leo XIII established a new Catholic shrine of the Holy House in 1897.",
    citation: APPARITIONS,
    links: { apparitions: ["apparition-our-lady-of-walsingham"] },
  },
  {
    slug: "martyrdom-of-henry-of-finland",
    title: "St Henry of Finland killed at Lake Köyliö (tradition)",
    year: 1156,
    precision: "circa",
    era: "high-medieval",
    kind: "martyrdom",
    tags: ["mission"],
    location: "Lake Köyliö, Finland",
    context:
      "Legend tells that Henry, an English-born bishop who had come north with Cardinal Nicholas Breakspear, entered Finland with King Eric of Sweden and was killed there by the peasant Lalli.",
    significance:
      "No record proves that he existed, yet he is the patron saint of Finland's Catholics, and the Lutheran Church of Finland also keeps his feast.",
    citation: `${W}Henry_(bishop_of_Finland)`,
  },
  {
    slug: "bishop-albert-founds-riga",
    title: "Bishop Albert founds Riga and the Livonian mission",
    year: 1201,
    precision: "year",
    era: "high-medieval",
    kind: "mission",
    tags: ["mission", "crusade"],
    location: "Riga, Livonia",
    context:
      "Albert of Buxhoeveden, bishop of Uexküll in Livonia, founds Riga on the Daugava with merchants from Gotland, and in 1204 obtains a papal bull allowing him to enlist crusaders.",
    significance:
      "The baptism of the Livs went hand in hand with conquest: Albert and his Brothers of the Sword spent nearly thirty years subduing Livonia, and Riga later became an archbishopric.",
    citation: `${W}Albert_of_Riga`,
  },
  {
    slug: "clementines-promulgated",
    title: "John XXII promulgates the Clementines",
    year: 1317,
    date: "1317-10-25",
    precision: "day",
    era: "high-medieval",
    kind: "document",
    tags: ["canon"],
    location: "Avignon",
    context:
      "With the bull Quoniam nulla, John XXII publishes the constitutions of his predecessor Clement V as a further book of the Decretals, known as the Clementines.",
    significance:
      "It was the last official collection added to the body of medieval canon law later called the Corpus Iuris Canonici.",
    citation: `${NA}04391a.htm`,
  },
  // ---------------------------------------------------------------- Western Schism and Renaissance
  {
    slug: "jubilee-of-1390",
    title: "The Jubilee of 1390",
    year: 1390,
    precision: "year",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Rome keeps a Holy Year under Urban VI's ordinance that a jubilee be held every thirty-three years, the span of Christ's life on earth.",
    significance:
      "St Mary Major was added to the basilicas the pilgrims had to visit, completing the four-basilica pilgrimage still required for the Roman jubilee.",
    citation: JUBILEE,
  },
  {
    slug: "jubilee-of-1400",
    title: "The Jubilee of 1400",
    year: 1400,
    precision: "year",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "So many pilgrims reach Rome that Boniface IX grants the jubilee indulgence again, although he had decreed no Holy Year.",
    significance:
      "The crowds fed one of the worst outbreaks of the plague in the Second Pandemic, with hundreds of the faithful dying in the city each day.",
    citation: JUBILEE,
  },
  {
    slug: "jubilee-of-1423",
    title: "Martin V's Jubilee of 1423",
    year: 1423,
    precision: "year",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Martin V proclaims a Holy Year thirty-three years after that of 1390, keeping to Urban VI's cycle.",
    significance:
      "It was the last jubilee on the thirty-three-year interval: Nicholas V returned to fifty years for 1450.",
    citation: JUBILEE,
    links: { popes: ["pope-martin-v"] },
  },
  {
    slug: "decree-for-the-armenians",
    title: "Florence's Decree for the Armenians on the seven sacraments",
    year: 1439,
    precision: "year",
    era: "schism-renaissance",
    kind: "document",
    tags: ["dogma", "eastern-catholic"],
    location: "Florence",
    context:
      "A decree issued for the Armenians at the Council of Florence lists the seven sacraments and treats each in terms of its matter, its form and its minister.",
    significance:
      "Though it does not carry the weight of a conciliar definition, its enumeration of the seven sacraments was solemnly defined by the Council of Trent.",
    citation: `${NA}13295a.htm`,
    links: { documentSlug: "council-of-florence", popes: ["pope-eugene-iv"] },
  },
  {
    slug: "jubilee-of-1450",
    title: "Nicholas V's Jubilee of 1450",
    year: 1450,
    precision: "year",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Returning to the fifty-year cycle, Nicholas V welcomes a reported 40,000 pilgrims a day; nearly two hundred die in a crush on the Ponte Sant'Angelo, and plague drives the pope from the city.",
    significance:
      "He spent the pilgrims' offerings on remaking Rome as a Renaissance capital, laying the foundations of the Vatican Library and making the Vatican the papal residence.",
    citation: JUBILEE,
    links: { popes: ["pope-nicholas-v"] },
  },
  {
    slug: "sixtus-iv-approves-the-minims",
    title: "Sixtus IV approves Francis of Paola's Minims",
    year: 1474,
    date: "1474-05-17",
    precision: "day",
    era: "schism-renaissance",
    kind: "order",
    tags: ["monastic"],
    location: "Rome",
    context:
      "The bull Sedes Apostolica confirms as a religious order the hermits gathered around Francis of Paola since 1435, and turns them into mendicant friars.",
    significance:
      "Wishing to be lower even than the Friars Minor, they took the name Minims, 'the least'; Julius II approved their definitive rule in 1506.",
    citation: `${W}Order_of_Minims`,
    links: { popes: ["pope-sixtus-iv"] },
  },
  {
    slug: "jubilee-of-1475",
    title: "The Jubilee of 1475",
    year: 1475,
    precision: "year",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "The first Holy Year kept on the twenty-five-year interval decreed by Paul II in 1470 again draws vast crowds of pilgrims to Rome.",
    significance:
      "Paul II's rule, which also let some who could not travel gain the indulgence at a church in their own country, has fixed the rhythm of ordinary jubilees ever since.",
    citation: JUBILEE,
  },
  {
    slug: "martyrs-of-otranto",
    title: "The Martyrs of Otranto",
    year: 1480,
    date: "1480-08-14",
    precision: "day",
    era: "schism-renaissance",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Otranto, Apulia",
    context:
      "After an Ottoman army under Gedik Ahmed Pasha takes Otranto, some 813 of its inhabitants are put to death; tradition holds that they would not renounce Christ for Islam.",
    significance:
      "Venerated as Antonio Primaldo and companions, they were beatified in 1771 and canonised by Pope Francis on 12 May 2013.",
    citation: `${W}Martyrs_of_Otranto`,
    links: { popes: ["pope-francis"] },
  },
  {
    slug: "first-mass-in-brazil",
    title: "First Mass in Brazil",
    year: 1500,
    date: "1500-04-26",
    precision: "day",
    era: "schism-renaissance",
    kind: "mission",
    tags: ["mission"],
    location: "Coroa Vermelha, Bahia",
    context:
      "Friar Henrique de Coimbra sings Mass on the coast of Bahia for Pedro Álvares Cabral's India-bound fleet, as Pero Vaz de Caminha reports to King Manuel I.",
    significance:
      "Celebrated on the land the Portuguese named the Island of the True Cross, it is honoured as the first Mass in Brazil and was immortalised in Victor Meirelles's painting of 1860.",
    citation: `${W}First_Mass_in_Brazil`,
  },
  {
    slug: "jubilee-of-1500",
    title: "Alexander VI's Jubilee of 1500",
    year: 1500,
    precision: "year",
    era: "schism-renaissance",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Alexander VI has the Holy Doors of the four major basilicas opened together and opens that of St Peter's himself; some 200,000 people attend the opening ceremonies.",
    significance:
      "The rites of 1500 settled customs, above all the opening and walling up of the Holy Doors, that have marked every jubilee since.",
    citation: JUBILEE,
    links: { popes: ["pope-alexander-vi"] },
  },
  {
    slug: "first-dioceses-of-the-americas",
    title: "First dioceses of the Americas erected",
    year: 1511,
    date: "1511-08-08",
    precision: "day",
    era: "schism-renaissance",
    kind: "mission",
    tags: ["mission"],
    location: "Hispaniola and Puerto Rico",
    context:
      "Julius II's bull erects the dioceses of Santo Domingo, Concepción de la Vega and San Juan in Puerto Rico, the first sees of the New World.",
    significance:
      "Santo Domingo, the oldest see in the Western Hemisphere, became an archdiocese in 1546, and its archbishop bears the title Primate of the Indies.",
    citation: `${W}Roman_Catholic_Archdiocese_of_Santo_Domingo`,
    links: { popes: ["pope-julius-ii"] },
  },
  // ---------------------------------------------------------------- Reformation and Trent
  {
    slug: "first-mass-in-the-philippines",
    title: "First Mass in the Philippines",
    year: 1521,
    date: "1521-03-31",
    precision: "day",
    era: "reformation-trent",
    kind: "mission",
    tags: ["mission"],
    location: "Mazaua (Limasawa), Southern Leyte",
    context:
      "On Easter Sunday Fr Pedro de Valderrama, chaplain of Magellan's expedition, celebrates the first documented Mass in the islands, at the place Pigafetta's journal calls Mazaua.",
    significance:
      "Mazaua is now generally identified with Limasawa in Southern Leyte, though the site of this first Mass in the Philippines has long been disputed.",
    citation: `${W}First_Mass_in_the_Philippines`,
  },
  {
    slug: "jubilee-of-1525",
    title: "Clement VII's Jubilee of 1525",
    year: 1525,
    precision: "year",
    era: "reformation-trent",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Clement VII opens the Holy Year on Christmas Eve 1524, as the Protestant Reformation begins to tear Western Christendom apart.",
    significance: "It was counted the ninth jubilee since Boniface VIII's first in 1300.",
    citation: JUBILEE,
    links: { popes: ["pope-clement-vii"] },
  },
  {
    slug: "somascans-founded",
    title: "Jerome Emiliani founds the Somascans",
    year: 1534,
    precision: "year",
    era: "reformation-trent",
    kind: "order",
    tags: ["charity"],
    location: "Venice",
    context:
      "The Venetian former soldier Jerome Emiliani gathers his lay and priestly companions into the Company of the Servants of the Poor, devoted above all to orphans, the poor and the sick.",
    significance:
      "Named after their motherhouse at Somasca, the Somascan Fathers still staff homes for boys and parishes around the world.",
    citation: `${W}Somaschi_Fathers`,
    links: { saints: ["saint-jerome-emiliani"] },
  },
  {
    slug: "trent-decree-on-original-sin",
    title: "Trent's decree on original sin",
    year: 1546,
    date: "1546-06-17",
    precision: "day",
    era: "reformation-trent",
    kind: "document",
    tags: ["dogma", "reformation"],
    location: "Trent",
    context:
      "In its fifth session the Council of Trent defines the doctrine of original sin, its nature, effects and remission in Baptism, with five canons, and passes its first reform decree on teaching Scripture and preaching.",
    significance:
      "Debating the decree, the fathers chose not to give a dogmatic decision on the Immaculate Conception, leaving that question open.",
    citation: `${NA}15030c.htm`,
    links: { documentSlug: "council-of-trent", popes: ["pope-paul-iii"] },
  },
  {
    slug: "jubilee-of-1550",
    title: "The Jubilee of 1550",
    year: 1550,
    precision: "year",
    era: "reformation-trent",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Proclaimed by Paul III, the Holy Year of 1550 is opened by his successor, Julius III.",
    significance:
      "One pope proclaimed and another inaugurated the jubilee, as would happen again in 1775.",
    citation: JUBILEE,
    links: { popes: ["pope-paul-iii"] },
  },
  {
    slug: "trent-decree-on-penance-and-extreme-unction",
    title: "Trent's decree on Penance and Extreme Unction",
    year: 1551,
    date: "1551-11-25",
    precision: "day",
    era: "reformation-trent",
    kind: "document",
    tags: ["dogma", "reformation"],
    location: "Trent",
    context:
      "At its fourteenth session the Council of Trent promulgates nine doctrinal chapters on the sacrament of Penance and three on Extreme Unction, each followed by canons.",
    significance:
      "It set out against the Reformers the Catholic teaching on sacramental confession and on the anointing of the sick.",
    citation: `${NA}15030c.htm`,
    links: { documentSlug: "council-of-trent" },
  },
  {
    slug: "martyrdom-of-goncalo-da-silveira",
    title: "Gonçalo da Silveira killed in the Mutapa kingdom",
    year: 1561,
    precision: "year",
    era: "reformation-trent",
    kind: "martyrdom",
    tags: ["mission"],
    location: "Mutapa (modern Zimbabwe)",
    context:
      "The Portuguese Jesuit, who had baptised the Mutapa ruler Negomo, his mother and hundreds of Shona nobles, is strangled after court rivals, by the traditional account, persuade the king he is a spy and a sorcerer.",
    significance:
      "His cause for beatification was opened in 1629, and a Jesuit development centre in Zimbabwe bears his name.",
    citation: `${W}Gon%C3%A7alo_da_Silveira`,
  },
  {
    slug: "pius-v-names-the-greek-doctors",
    title: "Pius V names the four Greek Doctors of the Church",
    year: 1568,
    precision: "year",
    era: "reformation-trent",
    kind: "saint",
    tags: ["doctor"],
    location: "Rome",
    context:
      "A year after declaring Thomas Aquinas a Doctor, Pius V recognises Athanasius, Basil the Great, Gregory of Nazianzus and John Chrysostom as Doctors of the Church.",
    significance:
      "The four great Eastern Fathers took their place beside the four Latin Doctors honoured by Boniface VIII in 1298.",
    citation: `${W}Doctor_of_the_Church`,
    links: {
      popes: ["pope-saint-pius-v"],
      doctors: [
        "doctor-athanasius-of-alexandria",
        "doctor-basil-the-great",
        "doctor-gregory-of-nazianzus",
        "doctor-john-chrysostom",
      ],
    },
  },
  {
    slug: "discalced-carmelite-friars-at-duruelo",
    title: "First Discalced Carmelite friars at Duruelo",
    year: 1568,
    date: "1568-11-28",
    precision: "day",
    era: "reformation-trent",
    kind: "order",
    tags: ["reform", "monastic"],
    location: "Duruelo, Castile",
    context:
      "Working closely with Teresa of Ávila, John of the Cross and Anthony of Jesus open the first house of Discalced Carmelite friars at Duruelo.",
    significance:
      "The Teresian reform now had friars as well as nuns; Gregory XIII made the Discalced a separate province of the Carmelite Order in 1580.",
    citation: `${W}Discalced_Carmelites`,
    links: {
      saints: ["saint-john-of-the-cross", "saint-teresa-of-avila"],
      doctors: ["doctor-john-of-the-cross", "doctor-teresa-of-avila"],
    },
  },
  {
    slug: "death-of-john-of-avila",
    title: "Death of St John of Ávila",
    year: 1569,
    date: "1569-05-10",
    precision: "day",
    era: "reformation-trent",
    kind: "saint",
    tags: ["doctor"],
    location: "Montilla, Andalusia",
    context:
      "The secular priest and preacher known as the Apostle of Andalusia dies at Montilla, aged seventy.",
    significance:
      "His counsel shaped Teresa of Ávila, John of God, Francis Borgia and Louis of Granada; canonised in 1970, he was declared a Doctor of the Church in 2012.",
    citation: `${W}John_of_%C3%81vila`,
    links: { doctors: ["doctor-john-of-avila"] },
  },
  {
    slug: "our-lady-of-good-health-velankanni",
    title: "Our Lady of Good Health at Velankanni (tradition)",
    year: 1570,
    precision: "circa",
    era: "reformation-trent",
    kind: "apparition",
    tags: ["marian"],
    location: "Velankanni, Tamil Nadu",
    context:
      "Tradition tells of two appearances of Mary at Velankanni, in 1570 and 1587, each to a local child, asking for milk for her infant and each followed by a miracle.",
    significance:
      "Its public veneration is approved, and John XXIII raised the shrine of Our Lady of Good Health to a minor basilica in 1962.",
    citation: APPARITIONS,
  },
  {
    slug: "jubilee-of-1575",
    title: "Gregory XIII's Jubilee of 1575",
    year: 1575,
    precision: "year",
    era: "reformation-trent",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "As many as 300,000 pilgrims from all over Europe come to Rome for the Holy Year under Gregory XIII.",
    significance:
      "Confraternities sheltered the crowds, the most famous being St Philip Neri's Archconfraternity of the Holy Trinity for pilgrims.",
    citation: JUBILEE,
    links: { popes: ["pope-gregory-xiii"], saints: ["saint-philip-neri"] },
  },
  {
    slug: "our-lady-of-lezajsk",
    title: "Our Lady of Consolation at Leżajsk",
    year: 1578,
    precision: "year",
    era: "reformation-trent",
    kind: "apparition",
    tags: ["marian"],
    location: "Leżajsk, Poland",
    context:
      "The woodcutter Tomasz Michałek reports that the Virgin appeared to him in a bright light in the forest and asked that a church be built on the spot.",
    significance: "Henryk Firlej, Bishop of Przemyśl, approved the apparition on 2 July 1724.",
    citation: APPARITIONS,
  },
  {
    slug: "roman-edition-of-the-corpus-iuris-canonici",
    title: "Roman edition of the Corpus Iuris Canonici",
    year: 1582,
    precision: "year",
    era: "reformation-trent",
    kind: "document",
    tags: ["canon"],
    location: "Rome",
    context:
      "The corrected text of the Church's classical law books, prepared by a commission Pius V set up in 1566, is published at Rome, and Gregory XIII forbids any change to it.",
    significance:
      "The Roman edition became the exemplar for every later edition of the Corpus Iuris Canonici.",
    citation: `${NA}04391a.htm`,
    links: { popes: ["pope-gregory-xiii", "pope-saint-pius-v"] },
  },
  {
    slug: "jubilee-of-1600",
    title: "Clement VIII's Jubilee of 1600",
    year: 1600,
    precision: "year",
    era: "reformation-trent",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Some three million pilgrims visit the holy places of Rome during the Holy Year proclaimed by Clement VIII.",
    significance:
      "It crowned a pontificate that also saw the Ruthenian bishops reunited with Rome at Brest and the trial and execution of Giordano Bruno.",
    citation: `${W}Pope_Clement_VIII`,
  },
  {
    slug: "our-lady-of-the-hens",
    title: "Our Lady of the Hens at Pagani",
    year: 1609,
    precision: "year",
    era: "reformation-trent",
    kind: "apparition",
    tags: ["marian"],
    location: "Pagani, Campania",
    context:
      "A crippled man asleep before an old image of the Virgin, said to have been found by hens, sees her in a dream telling him to rise, and is healed; seven more cures follow in 1609–1610.",
    significance:
      "Approved in August 1786, the devotion gave rise to the Shrine of Our Lady of the Hens.",
    citation: APPARITIONS,
  },
  {
    slug: "jubilee-of-1625",
    title: "Urban VIII's Jubilee of 1625",
    year: 1625,
    precision: "year",
    era: "reformation-trent",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Urban VIII opens the Holy Doors, but war in northern Italy keeps pilgrims away, and he suspends the indulgences available outside Rome to draw them to the city.",
    significance:
      "He went on to declare extraordinary jubilees in 1628 and 1629 to pray for peace.",
    citation: JUBILEE,
    links: { popes: ["pope-urban-viii"] },
  },
  {
    slug: "alexandre-de-rhodes-reaches-tonkin",
    title: "Alexandre de Rhodes begins the Jesuit mission in Tonkin",
    year: 1627,
    date: "1627-03-19",
    precision: "day",
    era: "reformation-trent",
    kind: "mission",
    tags: ["mission", "jesuits"],
    location: "Thanh Hoá, Tonkin",
    context:
      "The Avignon-born Jesuit, who had learned Vietnamese in Cochinchina, lands with Pero Marques on the feast of St Joseph and reaches the capital Thăng Long in July.",
    significance:
      "His preaching and his Vietnamese–Portuguese–Latin dictionary, printed at Rome in 1651, left a lasting mark on Christianity in Vietnam.",
    citation: `${W}Alexandre_de_Rhodes`,
  },
  {
    slug: "daughters-of-charity-founded",
    title: "Louise de Marillac and Vincent de Paul found the Daughters of Charity",
    year: 1633,
    date: "1633-11-29",
    precision: "day",
    era: "reformation-trent",
    kind: "order",
    tags: ["charity"],
    location: "Paris",
    context:
      "On the eve of St Andrew, Louise de Marillac begins forming into a community the young countrywomen Vincent de Paul had sent to serve the sick poor of Paris.",
    significance:
      "Unlike the nuns of their day they were not cloistered and took only annual vows, so that they could live among the poor they served.",
    citation: `${W}Daughters_of_Charity_of_Saint_Vincent_de_Paul`,
    links: { saints: ["saint-louise-de-marillac", "saint-vincent-de-paul"] },
  },
  {
    slug: "martyrs-of-natal",
    title: "The Martyrs of Natal",
    year: 1645,
    precision: "year",
    era: "reformation-trent",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Cunhaú and Uruaçu, Rio Grande do Norte",
    context:
      "In massacres at Cunhaú on 16 July and Uruaçu on 3 October, thirty Catholics of Dutch-occupied north-eastern Brazil, two of them priests, are killed by forces led by Dutch Calvinists.",
    significance:
      "Beatified in 2000 and canonised by Pope Francis in 2017, they are the patrons of the state of Rio Grande do Norte.",
    citation: `${W}Martyrs_of_Natal`,
    links: { popes: ["pope-francis"] },
  },
];
