import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";
const V = "https://www.vatican.va/content/";
const VII = "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/";
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
  // ---------------------------------------------------------------- Missions and Enlightenment
  {
    slug: "sisters-of-st-joseph-founded",
    title: "Jean-Pierre Médaille founds the Sisters of St Joseph at Le Puy",
    year: 1650,
    precision: "circa",
    era: "early-modern",
    kind: "order",
    tags: ["charity"],
    location: "Le Puy-en-Velay, France",
    context:
      "The Jesuit Jean-Pierre Médaille gathers women at Le Puy-en-Velay into a congregation named for St Joseph.",
    significance:
      "Its many independent branches now count some 9,500 sisters, working in France, the United States and some fifty other countries.",
    citation: `${W}Sisters_of_St._Joseph`,
  },
  {
    slug: "jubilee-of-1650",
    title: "Innocent X's Jubilee of 1650",
    year: 1650,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context: "Innocent X celebrates the Holy Year of 1650.",
    significance:
      "His reign also enriched Rome with new marble and reliefs in St Peter's and Bernini's Fountain of the Four Rivers in Piazza Navona.",
    citation: `${W}Pope_Innocent_X`,
    links: { popes: ["pope-innocent-x"] },
  },
  {
    slug: "trappist-reform-at-la-trappe",
    title: "Rancé's reform at La Trappe begins the Trappists",
    year: 1664,
    precision: "year",
    era: "early-modern",
    kind: "order",
    tags: ["monastic", "reform"],
    location: "La Trappe Abbey, Normandy",
    context:
      "Abbot Armand-Jean de Rancé introduces a strict reform of Cistercian life at the abbey of La Trappe.",
    significance:
      "The movement grew into congregations and, in 1892, the separate Order of Cistercians of the Strict Observance, known worldwide as the Trappists.",
    citation: `${W}Trappists`,
  },
  {
    slug: "jubilee-of-1675",
    title: "Clement X's Jubilee of 1675",
    year: 1675,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Old and crippled by gout, Clement X still visits the jubilee churches and twelve times washes the feet of pilgrims at the Trinity hospital.",
    significance:
      "Counted the fourteenth Holy Year, it was the only jubilee of his short pontificate.",
    citation: `${W}Pope_Clement_X`,
  },
  {
    slug: "la-salle-opens-free-schools-at-reims",
    title: "La Salle begins the free schools of Reims",
    year: 1679,
    precision: "year",
    era: "early-modern",
    kind: "order",
    tags: ["education"],
    location: "Reims",
    context:
      "Canon Jean-Baptiste de La Salle meets the schoolmaster Adrien Nyel and helps him open free schools for poor boys in Reims, the seed of the Brothers of the Christian Schools.",
    significance:
      "Lay teachers bound by a vow of association, the Brothers were recognised by the pope in 1725 and teach worldwide.",
    citation: `${W}De_La_Salle_Brothers`,
    links: { saints: ["saint-john-baptist-de-la-salle"] },
  },
  {
    slug: "jubilee-of-1700",
    title: "The Jubilee of 1700",
    year: 1700,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Too ill with gout to open the Holy Door at Christmas 1699, Innocent XII is represented by Cardinal de La Tour d'Auvergne, and dies on 27 September 1700, in the middle of the Holy Year.",
    significance: "The jubilee ended under his successor, Clement XI.",
    citation: `${W}Pope_Innocent_XII`,
    links: { popes: ["pope-clement-xi"] },
  },
  {
    slug: "spiritans-founded",
    title: "Claude Poullart des Places founds the Spiritans",
    year: 1703,
    date: "1703-05-27",
    precision: "day",
    era: "early-modern",
    kind: "order",
    tags: ["mission"],
    location: "Paris",
    context:
      "At Pentecost the young Breton Claude Poullart des Places founds in Paris a community to train poor students for the priesthood, the Congregation of the Holy Spirit.",
    significance:
      "Renewed by Francis Libermann, its 'second founder', the Holy Ghost Fathers supplied missionaries to Africa, the Caribbean and the Indian Ocean.",
    citation: `${W}Congregation_of_the_Holy_Spirit`,
  },
  {
    slug: "jubilee-of-1725",
    title: "Benedict XIII's Jubilee of 1725",
    year: 1725,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["papacy", "charity"],
    location: "Rome",
    context:
      "Benedict XIII holds the Holy Year of 1725, for which new houses are opened to shelter and care for the pilgrims.",
    significance:
      "They followed Clement XI's hospice of San Michele a Ripa among the charitable foundations that the jubilees left in Rome.",
    citation: JUBILEE,
  },
  {
    slug: "armenian-catholic-church-established",
    title: "Benedict XIV establishes the Armenian Catholic Church",
    year: 1742,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["eastern-catholic"],
    context:
      "Two years after Abraham Ardzivian, already a Catholic, is elected patriarch of Sis, Benedict XIV formally establishes the Armenian Catholic Church.",
    significance:
      "It renewed a union first sealed at Florence in 1439; scattered by the genocide of 1915–1918, the church now has its patriarchal see in Beirut.",
    citation: `${W}Armenian_Catholic_Church`,
    links: { popes: ["pope-benedict-xiv"] },
  },
  {
    slug: "jubilee-of-1750",
    title: "Benedict XIV's Jubilee of 1750",
    year: 1750,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "During the Holy Year proclaimed by Benedict XIV, the celebrated preacher Leonard of Port Maurice sets up the fourteen Stations of the Cross in the ruins of the Colosseum.",
    significance:
      "The pope also used the jubilee to absolve and reconcile a number of former Freemasons.",
    citation: JUBILEE,
    links: { popes: ["pope-benedict-xiv"] },
  },
  {
    slug: "our-lady-of-las-lajas",
    title: "Our Lady of Las Lajas",
    year: 1754,
    precision: "year",
    era: "early-modern",
    kind: "apparition",
    tags: ["marian"],
    location: "Guáitara Canyon, Colombia",
    context:
      "Popular tradition holds that Mary appeared to María Mueses de Quiñones and her deaf-mute daughter Rosa as they sheltered from a storm by the Guáitara river.",
    significance:
      "A first shrine followed within a few years; Paul VI approved the public veneration of Our Lady of Las Lajas in 1965.",
    citation: APPARITIONS,
    links: { apparitions: ["apparition-our-lady-of-las-lajas"] },
  },
  {
    slug: "jubilee-of-1775",
    title: "The Jubilee of 1775",
    year: 1775,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Clement XIV announces the Holy Year but dies three months before Christmas 1774, and the Holy Door is opened by his successor, Pius VI.",
    significance:
      "The new pope, Pius VI, thus began his long pontificate by presiding over the Holy Year.",
    citation: JUBILEE,
    links: { popes: ["pope-clement-xiv", "pope-pius-vi"] },
  },
  {
    slug: "syriac-catholic-patriarchate-of-michael-jarweh",
    title: "Michael Jarweh founds the Syriac Catholic patriarchal line",
    year: 1782,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["eastern-catholic"],
    context:
      "Elected patriarch of Antioch by the Syriac Orthodox synod, Michael Jarweh declares himself in communion with the pope, beginning the unbroken line of Syriac Catholic patriarchs.",
    significance:
      "An earlier Catholic patriarch, Andrew Akijan (1662), had left no lasting succession; Jarweh's monastery at Sharfeh in Lebanon still houses the church's seminary.",
    citation: `${W}Syriac_Catholic_Church`,
  },
  // ---------------------------------------------------------------- Revolution to Vatican I
  {
    slug: "christian-brothers-founded",
    title: "Edmund Rice founds the Christian Brothers",
    year: 1802,
    precision: "year",
    era: "revolution-19c",
    kind: "order",
    tags: ["education"],
    location: "Waterford, Ireland",
    context:
      "The Waterford merchant Edmund Rice opens a school for poor boys, the beginning of the Congregation of Christian Brothers.",
    significance:
      "The first Irish congregation of men to receive papal approval (1820), it taught generations across the English-speaking world; inquiries such as Ireland's Ryan Report of 2009 later exposed grave abuse of children in its institutions.",
    citation: `${W}Congregation_of_Christian_Brothers`,
  },
  {
    slug: "death-of-pius-vii",
    title: "Death of Pius VII",
    year: 1823,
    date: "1823-08-20",
    precision: "day",
    era: "revolution-19c",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Pius VII dies at eighty-one after twenty-three years as pope, having lost the Papal States to Napoleon from 1809 until 1814.",
    significance:
      "His reign spanned the Concordat of 1801, his captivity and the restoration of the Jesuits, though back in Rome he also re-established the Jewish ghetto.",
    citation: `${W}Pope_Pius_VII`,
    links: { popes: ["pope-pius-vii"] },
  },
  {
    slug: "election-of-leo-xii",
    title: "Leo XII elected",
    year: 1823,
    date: "1823-09-28",
    precision: "day",
    era: "revolution-19c",
    kind: "pope",
    tags: ["papacy"],
    location: "Quirinal Palace, Rome",
    context:
      "After a veto from Emperor Francis I of Austria rules out Cardinal Severoli, the conclave elects Annibale della Genga, cardinal vicar of Rome.",
    significance:
      "Forty-seven of the forty-nine electors had never taken part in a conclave, so long had Pius VII reigned.",
    citation: `${W}1823_conclave`,
    links: { popes: ["pope-leo-xii", "pope-pius-vii"] },
  },
  {
    slug: "jubilee-of-1825",
    title: "Leo XII's Jubilee of 1825",
    year: 1825,
    precision: "year",
    era: "revolution-19c",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context: "More than half a million pilgrims come to Rome for the Holy Year held by Leo XII.",
    significance:
      "It was the first jubilee in half a century, the troubles of Napoleon's time having prevented Pius VII from proclaiming one in 1800.",
    citation: JUBILEE,
    links: { popes: ["pope-leo-xii"] },
  },
  {
    slug: "death-of-leo-xii",
    title: "Death of Leo XII",
    year: 1829,
    date: "1829-02-10",
    precision: "day",
    era: "revolution-19c",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Leo XII, ill throughout his pontificate, dies in Rome after less than six years as pope.",
    significance:
      "A strict conservative, he had held the Holy Year of 1825 and enforced harsh laws in the Papal States, among them a ban on Jews owning property.",
    citation: `${W}Pope_Leo_XII`,
    links: { popes: ["pope-leo-xii"] },
  },
  {
    slug: "election-of-pius-viii",
    title: "Pius VIII elected",
    year: 1829,
    date: "1829-03-31",
    precision: "day",
    era: "revolution-19c",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "After a five-week conclave attended by forty-two of the fifty cardinals, Francesco Castiglioni, prefect of the Congregation of the Index, is elected and takes the name Pius VIII.",
    significance:
      "France would not accept the moderates' candidate Pacca, and the zelanti's De Gregorio could not win, so the sickly Castiglioni emerged as the compromise.",
    citation: `${W}1829_conclave`,
    links: { popes: ["pope-pius-viii", "pope-leo-xii"] },
  },
  {
    slug: "death-of-pius-viii",
    title: "Death of Pius VIII",
    year: 1830,
    date: "1830-11-30",
    precision: "day",
    era: "revolution-19c",
    kind: "pope",
    tags: ["papacy"],
    location: "Quirinal Palace, Rome",
    context: "Pius VIII dies at sixty-nine after a pontificate of twenty months.",
    significance:
      "He had welcomed Catholic Emancipation in Britain, reluctantly accepted France's July Revolution, and ruled on marriages between Catholics and Protestants.",
    citation: `${W}Pope_Pius_VIII`,
    links: { popes: ["pope-pius-viii"] },
  },
  {
    slug: "congregation-of-holy-cross-founded",
    title: "Basil Moreau founds the Congregation of Holy Cross",
    year: 1837,
    date: "1837-03-01",
    precision: "day",
    era: "revolution-19c",
    kind: "order",
    tags: ["education"],
    location: "Le Mans, France",
    context:
      "At Le Mans, Fr Basil Moreau founds a congregation of priests and brothers, the Congregation of Holy Cross, and later the Marianite sisters.",
    significance:
      "Its members carried the work to North America, where they founded the University of Notre Dame in Indiana in 1842.",
    citation: `${W}Congregation_of_Holy_Cross`,
  },
  {
    slug: "first-mass-in-new-zealand",
    title: "First Mass in New Zealand",
    year: 1838,
    date: "1838-01-13",
    precision: "day",
    era: "revolution-19c",
    kind: "mission",
    tags: ["mission"],
    location: "Totara Point, Hokianga",
    context:
      "Three days after landing at the Hokianga, Bishop Jean-Baptiste Pompallier, vicar apostolic of Western Oceania, celebrates the first documented Mass in New Zealand.",
    significance:
      "With the Marists he organised the Church throughout the country and became the first Bishop of Auckland in 1848.",
    citation: `${W}Jean-Baptiste_Pompallier`,
  },
  {
    slug: "death-of-gregory-xvi",
    title: "Death of Gregory XVI",
    year: 1846,
    date: "1846-06-01",
    precision: "day",
    era: "revolution-19c",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context: "Gregory XVI, a Camaldolese monk elected in 1831, dies of erysipelas at eighty.",
    significance:
      "A firm opponent of the Italian national movements, he gave new impetus to the foreign missions and condemned the slave trade; he remains the most recent pope who was not a bishop when elected.",
    citation: `${W}Pope_Gregory_XVI`,
    links: { popes: ["pope-gregory-xvi"] },
  },
  {
    slug: "our-lady-of-filippsdorf",
    title: "Our Lady, Help of Christians, at Filippsdorf",
    year: 1866,
    date: "1866-01-13",
    precision: "day",
    era: "revolution-19c",
    kind: "apparition",
    tags: ["marian"],
    location: "Filippsdorf (Filipov), Bohemia",
    context:
      "In the Bohemian village of Filippsdorf the bedridden Magdalena Kade sees the Virgin Mary and is instantly healed.",
    significance:
      "Recognised as a miracle and listed among the apparitions approved by the Church, with approval dated to 1885 under Leo XIII, it led to the building of a basilica on the site.",
    citation: APPARITIONS,
    links: { apparitions: ["apparition-our-lady-help-of-christians-filippsdorf"] },
  },
  {
    slug: "spiritans-at-bagamoyo",
    title: "The Holy Ghost Fathers open the mission of Bagamoyo",
    year: 1868,
    precision: "year",
    era: "revolution-19c",
    kind: "mission",
    tags: ["mission", "slavery"],
    location: "Bagamoyo, East Africa",
    context:
      "Local rulers at Bagamoyo give the Holy Ghost Fathers land north of the town for a mission, first meant as a home for children freed from slavery.",
    significance:
      "Soon grown into a church, a school, workshops and farms, it is remembered as the first mission in East Africa.",
    citation: `${W}Bagamoyo`,
  },
  {
    slug: "daughters-of-mary-help-of-christians-founded",
    title: "Don Bosco and Maria Mazzarello found the Salesian Sisters",
    year: 1872,
    date: "1872-08-05",
    precision: "day",
    era: "revolution-19c",
    kind: "order",
    tags: ["education"],
    location: "Mornese, Piedmont",
    context:
      "At Mornese the first Daughters of Mary Help of Christians make their profession before Don Bosco and the Bishop of Acqui, with Maria Domenica Mazzarello among them.",
    significance:
      "Sharing Don Bosco's preventive system of education, the Salesian Sisters became a worldwide teaching congregation.",
    citation: `${W}Salesian_Sisters_of_Don_Bosco`,
    links: { saints: ["saint-john-bosco"] },
  },
  {
    slug: "jubilee-of-1875",
    title: "Pius IX's Jubilee of 1875",
    year: 1875,
    precision: "year",
    era: "revolution-19c",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Five years after the loss of Rome, Pius IX proclaims a Holy Year, but it is kept without public solemnity and the Holy Doors stay closed.",
    significance:
      "The pilgrims came chiefly to show loyalty to a pope who refused to accept Italy's annexation of Rome; there had been no jubilee in 1850 because of the Roman Republic.",
    citation: JUBILEE,
    links: { popes: ["pope-pius-ix"] },
  },
  {
    slug: "immortale-dei",
    title: "Immortale Dei: the Christian constitution of states",
    year: 1885,
    date: "1885-11-01",
    precision: "day",
    era: "revolution-19c",
    kind: "document",
    tags: ["social-teaching"],
    location: "Rome",
    context:
      "Leo XIII teaches that God has entrusted mankind to two powers, the Church over divine things and the civil authority over human things, each supreme in its own sphere.",
    significance:
      "Leo held that a well-ordered harmony between the two powers brings blessings that no other arrangement of Church and state can offer.",
    citation: `${V}leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_01111885_immortale-dei.html`,
    links: { popes: ["pope-leo-xiii"] },
  },
  {
    slug: "baltimore-catechism",
    title: "The Baltimore Catechism",
    year: 1885,
    precision: "year",
    era: "revolution-19c",
    kind: "document",
    tags: ["education"],
    location: "United States",
    context:
      "Prepared by order of the Third Plenary Council of Baltimore, 'A Catechism of Christian Doctrine' is issued for Catholic children in the United States.",
    significance:
      "Despite early calls for revision, it remained the standard text of American Catholic schools until the late 1960s.",
    citation: `${W}Baltimore_Catechism`,
  },
  {
    slug: "satis-cognitum",
    title: "Satis cognitum: on the unity of the Church",
    year: 1896,
    date: "1896-06-29",
    precision: "day",
    era: "revolution-19c",
    kind: "document",
    location: "Rome",
    context:
      "Leo XIII's encyclical on the unity of the Church teaches that Christ founded one visible Church, bound together by unity of faith and of government under Peter's successor.",
    significance:
      "Leo held unity of government, and the communion it brings, to be necessary by divine law, and wrote to draw separated Christians back into the one fold.",
    citation: `${V}leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_29061896_satis-cognitum.html`,
    links: { popes: ["pope-leo-xiii"] },
  },
  {
    slug: "polish-national-catholic-church",
    title: "Polish National Catholic Church breaks from Rome",
    year: 1897,
    precision: "year",
    era: "revolution-19c",
    kind: "schism",
    tags: ["schism"],
    location: "Scranton, Pennsylvania",
    context:
      "In Scranton the priest Franciszek Hodur leads Polish immigrants, aggrieved that the American hierarchy had no Polish bishops and few Polish priests, into a separate national church.",
    significance:
      "Old Catholic in orientation and not in communion with Rome, it counts some 30,000 members in the United States and Canada.",
    citation: `${W}Polish_National_Catholic_Church`,
  },
  {
    slug: "jubilee-of-1900",
    title: "Leo XIII's Jubilee of 1900",
    year: 1900,
    precision: "year",
    era: "revolution-19c",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Though he has confined himself to the Vatican since the loss of Rome, Leo XIII proclaims and keeps the Holy Year of 1900.",
    significance:
      "Shorn of some of its splendour, it was still carried out with all the solemnity possible, unlike the subdued jubilee of 1875.",
    citation: JUBILEE,
    links: { popes: ["pope-leo-xiii"] },
  },
  {
    slug: "catechism-of-pius-x",
    title: "The Catechism of Pius X",
    year: 1905,
    precision: "year",
    era: "revolution-19c",
    kind: "document",
    tags: ["education"],
    location: "Rome",
    context:
      "Pius X prescribes his Compendium of Christian Doctrine, with its larger catechism, for the diocese and province of Rome; in 1912 he replaces it with a shorter catechism.",
    significance:
      "An English translation of 1910 made the larger catechism widely known as the Catechism of St Pius X.",
    citation: `${W}Catechism_of_Saint_Pius_X`,
    links: { popes: ["pope-saint-pius-x"] },
  },
  // ---------------------------------------------------------------- Twentieth century
  {
    slug: "death-of-benedict-xv",
    title: "Death of Benedict XV",
    year: 1922,
    date: "1922-01-22",
    precision: "day",
    era: "twentieth",
    kind: "pope",
    tags: ["papacy"],
    location: "Apostolic Palace, Rome",
    context: "Benedict XV dies at sixty-seven of pneumonia, after seven years as pope.",
    significance:
      "Elected as the First World War began, he devoted his reign to its victims and to the missions, earning the name 'Pope of the Missions'.",
    citation: `${W}Pope_Benedict_XV`,
    links: { popes: ["pope-benedict-xv"] },
  },
  {
    slug: "jubilee-of-1925",
    title: "Pius XI's Holy Year of 1925",
    year: 1925,
    precision: "year",
    era: "twentieth",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "With the bull Infinita Dei misericordia of 29 May 1924, Pius XI proclaims a universal jubilee for 1925, asking pilgrims to visit the four major basilicas.",
    significance:
      "He asked the faithful to pray above all for peace, in hearts and among the nations, after the Great War.",
    citation: `${V}pius-xi/it/bulls/documents/hf_p-xi_bulls_19240529_dei-misericordia.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "divini-illius-magistri",
    title: "Divini illius magistri: on Christian education",
    year: 1929,
    date: "1929-12-31",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["education"],
    location: "Rome",
    context:
      "Pius XI teaches that education belongs to three societies willed by God, the family, civil society and the Church, and defends the prior right of parents.",
    significance:
      "It condemned any state monopoly of schooling that forces families into government schools against their Christian conscience.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_31121929_divini-illius-magistri.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "our-lady-of-tears-campinas",
    title: "Our Lady of Tears at Campinas",
    year: 1930,
    date: "1930-03-08",
    precision: "day",
    era: "twentieth",
    kind: "apparition",
    tags: ["marian"],
    location: "Campinas, Brazil",
    context:
      "Sister Amália of Jesus Scourged reports that the Virgin appeared to her in her institute's chapel and asked her to spread a rosary called the 'Crown of Tears'.",
    significance:
      "Bishop Francisco de Campos Barreto of Campinas recognised the events as supernatural a year later, on 8 March 1931.",
    citation: APPARITIONS,
  },
  {
    slug: "syro-malankara-reunion",
    title: "Mar Ivanios and the Syro-Malankara reunion",
    year: 1930,
    date: "1930-09-20",
    precision: "day",
    era: "twentieth",
    kind: "event",
    tags: ["eastern-catholic"],
    location: "Kerala, India",
    context:
      "Archbishop Geevarghese Mar Ivanios and another bishop of the Malankara Orthodox Church are received into full communion with Rome, with a priest, a deacon and a layman.",
    significance:
      "The resulting Syro-Malankara Catholic Church, which keeps the West Syriac liturgy, now numbers over 400,000 faithful in India and abroad.",
    citation: `${W}Syro-Malankara_Catholic_Church`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "holy-year-of-the-redemption-1933",
    title: "Extraordinary Holy Year of the Redemption",
    year: 1933,
    precision: "year",
    era: "twentieth",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "With the constitution Quod nuper of 6 January 1933, Pius XI proclaims an extraordinary Holy Year for the nineteenth centenary of the Redemption, running from Easter time to Easter time.",
    significance:
      "Pius XI asked the faithful to ponder how greatly the Saviour loved them and to receive Penance and the Eucharist often throughout the year.",
    citation: `${V}pius-xi/la/apost_constitutions/documents/hf_p-xi_apc_19330106_quod-nuper.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "our-lady-of-cimbres",
    title: "Our Lady of Grace at Cimbres",
    year: 1936,
    date: "1936-08-06",
    precision: "day",
    era: "twentieth",
    kind: "apparition",
    tags: ["marian"],
    location: "Cimbres, Pernambuco, Brazil",
    context:
      "Two girls of thirteen and sixteen walking near Cimbres report seeing a woman with a child who calls herself 'Grace' and later warns them of the danger of communism.",
    significance: "The Bishop of Pesqueira approved the apparitions on 13 October 2021.",
    citation: APPARITIONS,
  },
  {
    slug: "kiwanuka-first-african-bishop",
    title: "Joseph Kiwanuka, first African bishop of modern times",
    year: 1939,
    date: "1939-10-29",
    precision: "day",
    era: "twentieth",
    kind: "mission",
    tags: ["mission"],
    location: "St Peter's Basilica",
    context:
      "Pius XII himself consecrates the Ugandan White Father Joseph Kiwanuka, vicar apostolic of Masaka, as a bishop.",
    significance:
      "The first native African to become a Catholic bishop in modern times, he later served as Archbishop of Rubaga.",
    citation: `${W}Joseph_Kiw%C3%A1nuka`,
    links: { popes: ["pope-venerable-pius-xii"] },
  },
  {
    slug: "jubilee-of-1950",
    title: "Pius XII's Holy Year of 1950",
    year: 1950,
    precision: "year",
    era: "twentieth",
    kind: "event",
    tags: ["papacy"],
    location: "Rome",
    context:
      "By the bull Iubilaeum maximum of 26 May 1949, Pius XII proclaims a universal jubilee in Rome from Christmas 1949 to Christmas 1950.",
    significance:
      "The bull called it a year of expiation and granted the jubilee indulgence to pilgrims who visited the four major basilicas and prayed for the pope's intentions.",
    citation: `${V}pius-xii/it/bulls/documents/hf_p-xii_bull_19490526_iubilaeum-maximum.html`,
    links: { popes: ["pope-venerable-pius-xii"] },
  },
  {
    slug: "fidei-donum",
    title: "Fidei donum: on the missions in Africa",
    year: 1957,
    date: "1957-04-21",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["mission"],
    location: "Rome",
    context:
      "On Easter Sunday Pius XII issues an encyclical on the state of the Catholic missions, especially in Africa, where a few missionaries serve vast populations.",
    significance:
      "It pleaded for more apostolic workers and aid to be sent to help Africa's young local clergy before the opportunity was lost.",
    citation: `${V}pius-xii/en/encyclicals/documents/hf_p-xii_enc_21041957_fidei-donum.html`,
    links: { documentSlug: "fidei-donum", popes: ["pope-venerable-pius-xii"] },
  },
  {
    slug: "inter-mirifica",
    title: "Inter mirifica: the Decree on the Media of Social Communications",
    year: 1963,
    date: "1963-12-04",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "The Council's decree on the means of social communication recognises the power of the press, film, radio and television to reach and influence whole societies.",
    significance:
      "It urged Catholics to use these media for the good of souls and to form right consciences in their use.",
    citation: `${VII}vat-ii_decree_19631204_inter-mirifica_en.html`,
    links: { documentSlug: "inter-mirifica", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "canonization-of-the-uganda-martyrs",
    title: "The Uganda Martyrs canonised",
    year: 1964,
    date: "1964-10-18",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    tags: ["persecution"],
    location: "St Peter's Basilica",
    context:
      "Paul VI canonises Charles Lwanga, Matthias Mulumba and their twenty Catholic companions, killed for their faith at the court of Buganda.",
    significance:
      "In the ceremony he also honoured the Anglican converts who died for Christ in the same persecution.",
    citation: `${W}Uganda_Martyrs`,
    links: { saints: ["saint-charles-lwanga"], popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "orientalium-ecclesiarum",
    title: "Orientalium Ecclesiarum: the Decree on the Eastern Catholic Churches",
    year: 1964,
    date: "1964-11-21",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["eastern-catholic"],
    location: "Rome",
    context:
      "Promulgated with Lumen gentium, the decree declares the particular Churches of East and West of equal dignity and urges the Eastern Catholic Churches to keep their own rites and traditions.",
    significance:
      "It upheld the ancient rights of the Eastern patriarchs and gave the Eastern Catholic Churches a special duty of promoting the unity of all Christians, above all in the East.",
    citation: `${VII}vat-ii_decree_19641121_orientalium-ecclesiarum_en.html`,
    links: { documentSlug: "orientalium-ecclesiarum", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "mysterium-fidei",
    title: "Mysterium fidei: on the Holy Eucharist",
    year: 1965,
    date: "1965-09-03",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["eucharist", "dogma"],
    location: "Rome",
    context:
      "Paul VI answers opinions he judges disturbing about private Masses and the dogma of transubstantiation by restating the Church's doctrine of the Eucharist.",
    significance:
      "It reaffirmed transubstantiation and the adoration owed to Christ present in the Blessed Sacrament as the liturgical reform got under way.",
    citation: `${V}paul-vi/en/encyclicals/documents/hf_p-vi_enc_03091965_mysterium.html`,
    links: { documentSlug: "mysterium-fidei", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "christus-dominus",
    title: "Christus Dominus: the Decree on the Pastoral Office of Bishops",
    year: 1965,
    date: "1965-10-28",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "The Council sets out the pastoral office of bishops in the universal Church and in their own dioceses, and encourages national episcopal conferences.",
    significance:
      "It gave national conferences of bishops a defined place in the life of the Church.",
    citation: `${VII}vat-ii_decree_19651028_christus-dominus_en.html`,
    links: { documentSlug: "christus-dominus", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "perfectae-caritatis",
    title: "Perfectae caritatis: the Decree on the Renewal of Religious Life",
    year: 1965,
    date: "1965-10-28",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["monastic", "reform"],
    location: "Rome",
    context:
      "The Council asks religious institutes to renew themselves by returning to the sources of Christian life and to their founders' original spirit, while adapting to the conditions of the time.",
    significance:
      "It set off the post-conciliar renewal of religious life, down to the habit, which it asked to be simple, modest and poor.",
    citation: `${VII}vat-ii_decree_19651028_perfectae-caritatis_en.html`,
    links: { documentSlug: "perfectae-caritatis", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "optatam-totius",
    title: "Optatam totius: the Decree on Priestly Training",
    year: 1965,
    date: "1965-10-28",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "The Council asks each nation to draw up its own programme of priestly formation and sets out the spiritual, intellectual and pastoral training of seminarians.",
    significance:
      "It declared major seminaries necessary for priestly formation and reshaped their studies and spiritual training after the Council.",
    citation: `${VII}vat-ii_decree_19651028_optatam-totius_en.html`,
    links: { documentSlug: "optatam-totius", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "gravissimum-educationis",
    title: "Gravissimum educationis: the Declaration on Christian Education",
    year: 1965,
    date: "1965-10-28",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["education"],
    location: "Rome",
    context:
      "The Council declares the right of all to an education and calls parents the primary and principal educators of their children, supported by Catholic schools and universities.",
    significance:
      "It also defended the place of Catholic schools and the Church's own right to educate.",
    citation: `${VII}vat-ii_decl_19651028_gravissimum-educationis_en.html`,
    links: { documentSlug: "gravissimum-educationis", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "apostolicam-actuositatem",
    title: "Apostolicam actuositatem: the Decree on the Apostolate of the Laity",
    year: 1965,
    date: "1965-11-18",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "The Council teaches that lay people share in Christ's priestly, prophetic and royal office and so have their own part in the Church's mission in the Church and in the world.",
    significance:
      "It taught that lay people, joined to Christ in Baptism and strengthened by the Spirit in Confirmation, are sent to the apostolate by the Lord himself.",
    citation: `${VII}vat-ii_decree_19651118_apostolicam-actuositatem_en.html`,
    links: { documentSlug: "apostolicam-actuositatem", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "presbyterorum-ordinis",
    title: "Presbyterorum ordinis: the Decree on the Ministry and Life of Priests",
    year: 1965,
    date: "1965-12-07",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "The Council's decree describes the priest's ministry of word and sacrament and commends celibacy as a gift to be embraced for the sake of the Kingdom.",
    significance:
      "It also stressed the sacramental brotherhood that unites priests with one another under their bishop and asked that they receive equitable support.",
    citation: `${VII}vat-ii_decree_19651207_presbyterorum-ordinis_en.html`,
    links: { documentSlug: "presbyterorum-ordinis", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "ad-gentes",
    title: "Ad gentes: the Decree on the Mission Activity of the Church",
    year: 1965,
    date: "1965-12-07",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["mission"],
    location: "Rome",
    context:
      "The Council teaches that the pilgrim Church is missionary by her very nature, since she springs from the missions of the Son and of the Holy Spirit.",
    significance:
      "Because the whole Church is missionary, it called evangelisation a basic duty of all the People of God, not of missionary institutes alone.",
    citation: `${VII}vat-ii_decree_19651207_ad-gentes_en.html`,
    links: { documentSlug: "ad-gentes", popes: ["pope-saint-paul-vi"] },
  },
];
