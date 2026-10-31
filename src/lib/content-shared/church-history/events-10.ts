import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";

/**
 * Church-history spine, part 10: the detailed record of the Missions &
 * Enlightenment era and the Revolution-to-Vatican-I era (1648–1914) —
 * Jansenism and Gallicanism, the Jesuit expulsions, the Asian, African and
 * Oceanian missions and their martyrs, the Revolution and Napoleon, the
 * Oxford Movement, the papacies of Pius IX, Leo XIII and Pius X, and the
 * congregations and saints of the nineteenth century. Each event cites the
 * one page its date and claim were checked against.
 */
export const EVENTS_10: ChurchHistoryEvent[] = [
  // ---------------------------------------------------------------- Missions & Enlightenment
  {
    slug: "martyrdom-of-francis-de-capillas",
    title: "St Francis de Capillas, protomartyr of China",
    year: 1648,
    date: "1648-01-15",
    precision: "day",
    era: "early-modern",
    kind: "martyrdom",
    tags: ["mission", "persecution"],
    location: "Fu'an, Fujian",
    context:
      "Seized in November 1647 by officials of the new Qing dynasty, the Spanish Dominican missionary is tortured in prison and then beheaded.",
    significance:
      "Venerated as the first martyr of China, he was canonised in 2000 among the 120 Martyrs of China.",
    citation: `${W}Francis_Ferdinand_de_Capillas`,
  },
  {
    slug: "our-lady-of-coromoto",
    title: "Our Lady of Coromoto",
    year: 1652,
    date: "1652-09-08",
    precision: "day",
    era: "early-modern",
    kind: "apparition",
    tags: ["marian"],
    location: "Guanare, Venezuela",
    context:
      "By tradition the Virgin appears in his hut to Coromoto, a local chief who keeps putting off baptism, and vanishes when he reaches for her, leaving a small painting of herself.",
    significance:
      "Our Lady of Coromoto is the patroness of Venezuela, a title ratified by Pius XII in 1944.",
    citation: `${W}Our_Lady_of_Coromoto`,
    links: { apparitions: ["apparition-our-lady-of-coromoto"] },
  },
  {
    slug: "coonan-cross-oath",
    title: "Coonan Cross Oath divides the St Thomas Christians",
    year: 1653,
    date: "1653-01-03",
    precision: "day",
    era: "early-modern",
    kind: "schism",
    tags: ["schism"],
    location: "Mattancherry, Malabar",
    context:
      "A large part of the ancient St Thomas Christian community of India swears publicly to refuse obedience to the Jesuit prelates and the Portuguese-backed Latin hierarchy.",
    significance:
      "A lasting division follows between those who stay in communion with Rome and those who follow the archdeacon Thomas, later consecrated Mar Thoma I.",
    citation: `${W}Coonan_Cross_Oath`,
  },
  {
    slug: "death-of-peter-claver",
    title: "Death of St Peter Claver",
    year: 1654,
    date: "1654-09-08",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    tags: ["mission"],
    location: "Cartagena, New Granada",
    context:
      "The Spanish Jesuit dies at Cartagena, the chief slave market of the New World, where for forty-four years he cared for and instructed the enslaved Africans landed there.",
    significance:
      "Credited with baptising some 300,000 people, he was canonised in 1888 and named patron of the Catholic missions among Black people in 1896.",
    citation: `${NA}11763a.htm`,
    links: { saints: ["saint-peter-claver"] },
  },
  {
    slug: "provincial-letters",
    title: "Pascal's Provincial Letters",
    year: 1656,
    date: "1656-01-23",
    precision: "day",
    era: "early-modern",
    kind: "event",
    tags: ["jansenism"],
    location: "Paris",
    context:
      "Under a pseudonym Blaise Pascal issues the first of eighteen letters defending his friend Antoine Arnauld and mocking the casuistry of Jesuit moral theologians.",
    significance:
      "Their wit carries the Jansenist quarrel to a wide lay readership, and they shape the prose of later French writers.",
    citation: `${W}Lettres_provinciales`,
  },
  {
    slug: "paris-foreign-missions-society",
    title: "Paris Foreign Missions Society founded",
    year: 1663,
    precision: "year",
    era: "early-modern",
    kind: "order",
    tags: ["mission"],
    location: "Paris",
    context:
      "Bishops François Pallu and Pierre Lambert de la Motte, vicars apostolic for Tonkin and Cochinchina, found a society of secular priests whose Paris seminary opens in 1663.",
    significance:
      "Its aim of raising up a native clergy under bishops answerable to Rome shapes the missions of Vietnam, Cambodia and Siam.",
    citation: `${NA}14079a.htm`,
  },
  {
    slug: "our-lady-of-laus",
    title: "Our Lady of Laus",
    year: 1664,
    date: "1664-05-16",
    precision: "day",
    era: "early-modern",
    kind: "apparition",
    tags: ["marian"],
    location: "Saint-Étienne-le-Laus, France",
    context:
      "In an Alpine valley the Virgin appears to the seventeen-year-old shepherdess Benoîte Rencurel, the first of apparitions that continue until 1718.",
    significance:
      "Laus becomes a shrine of the 'Refuge of Sinners'; the local bishop approved the apparitions in 2008.",
    citation: `${W}Our_Lady_of_Laus`,
    links: { apparitions: ["apparition-our-lady-of-laus"] },
  },
  {
    slug: "regiminis-apostolici-formulary",
    title: "Regiminis apostolici imposes the anti-Jansenist formulary",
    year: 1665,
    date: "1665-02-15",
    precision: "day",
    era: "early-modern",
    kind: "document",
    tags: ["jansenism"],
    location: "Rome",
    context:
      "Alexander VII requires all clergy and teachers to sign a formulary accepting the condemnation of the five propositions in the sense of Jansen's Augustinus.",
    significance:
      "Jansenist refusals to sign keep the 'formulary controversy' alive in France into the eighteenth century.",
    citation: `${W}Formulary_controversy`,
  },
  {
    slug: "canonisation-of-rose-of-lima",
    title: "St Rose of Lima canonised",
    year: 1671,
    precision: "year",
    era: "early-modern",
    kind: "saint",
    location: "Rome",
    context:
      "Clement X canonises the Dominican tertiary of Lima, who died in 1617 after a life of severe penance offered for sinners and for her country.",
    significance: "She is the first saint of the Americas to be canonised.",
    citation: `${NA}13192c.htm`,
    links: { saints: ["saint-rose-of-lima"] },
  },
  {
    slug: "martyrs-of-guam",
    title: "St Pedro Calungsod and Diego Luis de San Vitores killed on Guam",
    year: 1672,
    date: "1672-04-02",
    precision: "day",
    era: "early-modern",
    kind: "martyrdom",
    tags: ["mission"],
    location: "Tumon, Guam",
    context:
      "The Visayan catechist Pedro Calungsod and the Jesuit Diego Luis de San Vitores are killed by the Chamorro chief Mata'pang after San Vitores baptises the chief's infant daughter against his will.",
    significance:
      "Venerated as martyrs of the Marianas mission, whose methods remain contested in Chamorro memory; Calungsod was canonised in 2012 as the second Filipino saint.",
    citation: `${W}Pedro_Calungsod`,
  },
  {
    slug: "diocese-of-quebec",
    title: "Diocese of Quebec erected",
    year: 1674,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["mission"],
    location: "Quebec",
    context:
      "Clement X makes Quebec a regular diocese subject directly to Rome, with François de Laval, vicar apostolic of New France since 1658, as its first bishop.",
    significance:
      "The diocese spans almost all of North America outside the English and Spanish colonies, the mother church of some hundred later dioceses.",
    citation: `${NA}09045a.htm`,
  },
  {
    slug: "election-of-innocent-xi",
    title: "Bl. Innocent XI elected",
    year: 1676,
    date: "1676-09-21",
    precision: "day",
    era: "early-modern",
    kind: "pope",
    tags: ["papacy", "reform"],
    location: "Rome",
    context:
      "Benedetto Odescalchi is elected unanimously once Louis XIV drops his opposition, and at once cuts the Curia's expenses and legislates against nepotism.",
    significance:
      "His frugal reign restores the papal finances, resists Louis XIV, and rallies the Christian powers to the relief of Vienna in 1683.",
    citation: `${NA}08021a.htm`,
    links: { popes: ["pope-blessed-innocent-xi"] },
  },
  {
    slug: "popish-plot",
    title: "The Popish Plot",
    year: 1678,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["persecution"],
    location: "London",
    context:
      "Titus Oates invents a Jesuit conspiracy to murder Charles II, and paid, perjured witnesses send innocent Catholics to their deaths in the panic that follows.",
    significance:
      "Sixteen men are executed for the imaginary plot and eight more priests die in the persecution it sets off.",
    citation: `${NA}11173c.htm`,
  },
  {
    slug: "death-of-kateri-tekakwitha",
    title: "Death of St Kateri Tekakwitha",
    year: 1680,
    date: "1680-04-17",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    tags: ["mission"],
    location: "Caughnawaga, New France",
    context:
      "Baptised by the Jesuit Jacques de Lamberville, the young Mohawk woman escapes persecution in her village to the Christian settlement of Caughnawaga, where she dies at about twenty-four.",
    significance:
      "Remembered as the 'Lily of the Mohawks' for her purity and severe penances, she was beatified in 1980.",
    citation: `${NA}14471a.htm`,
    links: { saints: ["saint-kateri-tekakwitha"] },
  },
  {
    slug: "martyrdom-of-oliver-plunkett",
    title: "St Oliver Plunkett martyred at Tyburn",
    year: 1681,
    date: "1681-07-11",
    precision: "day",
    era: "early-modern",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Tyburn, London",
    context:
      "The Archbishop of Armagh, arrested in 1679 and tried in London on the perjured evidence of informers, is executed at Tyburn (1 July in England's Old Style calendar).",
    significance:
      "His death closed the long line of Catholics put to death for the faith at Tyburn; he was canonised in 1975.",
    citation: `${NA}12169b.htm`,
  },
  {
    slug: "declaration-of-the-clergy-of-france",
    title: "Declaration of the Clergy of France",
    year: 1682,
    date: "1682-03-19",
    precision: "day",
    era: "early-modern",
    kind: "event",
    tags: ["gallicanism", "papacy"],
    location: "Paris",
    context:
      "In Louis XIV's quarrel with Innocent XI over royal rights to vacant sees, an assembly of the French clergy adopts the Four Articles limiting papal power.",
    significance:
      "The charter of Gallicanism: Innocent XI refuses to confirm its signatories as bishops, and Alexander VIII annuls it in 1690.",
    citation: `${NA}06351a.htm`,
    links: { popes: ["pope-blessed-innocent-xi"] },
  },
  {
    slug: "battle-of-vienna",
    title: "Relief of Vienna",
    year: 1683,
    date: "1683-09-12",
    precision: "day",
    era: "early-modern",
    kind: "event",
    tags: ["marian"],
    location: "Kahlenberg, Vienna",
    context:
      "A Christian army led by King John III Sobieski of Poland, assembled with Innocent XI's diplomacy and money, breaks the Ottoman siege of Vienna.",
    significance:
      "In thanksgiving Innocent XI extends the feast of the Holy Name of Mary to the whole Church; the victory opens the reconquest of Hungary.",
    citation: `${W}Battle_of_Vienna`,
    links: { popes: ["pope-blessed-innocent-xi"] },
  },
  {
    slug: "revocation-of-the-edict-of-nantes",
    title: "Louis XIV revokes the Edict of Nantes",
    year: 1685,
    date: "1685-10-18",
    precision: "day",
    era: "early-modern",
    kind: "event",
    tags: ["persecution"],
    location: "Fontainebleau",
    context:
      "The Edict of Fontainebleau outlaws Protestant worship in France, orders Huguenot churches destroyed, and makes official the forced conversions already pursued by the dragonnades.",
    significance:
      "Estimates of the Huguenots who flee abroad run from about 200,000 to 900,000; civil toleration returns only with the Edict of Versailles in 1787.",
    citation: `${W}Edict_of_Fontainebleau`,
  },
  {
    slug: "coelestis-pastor-quietism",
    title: "Coelestis Pastor condemns Quietism",
    year: 1687,
    precision: "year",
    era: "early-modern",
    kind: "document",
    location: "Rome",
    context:
      "After a Holy Office trial the Spanish priest Miguel de Molinos is sentenced to life imprisonment, and Innocent XI condemns sixty-eight of his propositions.",
    significance:
      "The bull rejects Molinos's teaching that perfection lies in interior annihilation and passivity before God.",
    citation: `${NA}10441a.htm`,
    links: { popes: ["pope-blessed-innocent-xi"] },
  },
  {
    slug: "joseph-vaz-in-ceylon",
    title: "St Joseph Vaz begins his mission in Ceylon",
    year: 1687,
    precision: "year",
    era: "early-modern",
    kind: "mission",
    tags: ["mission", "persecution"],
    location: "Ceylon",
    context:
      "The Goan Oratorian enters Dutch-ruled Ceylon, where Catholic worship is banned, and secretly brings the sacraments to Catholic communities long left without priests.",
    significance:
      "Later sheltered by the Kingdom of Kandy, he revives the Church across the island; he was canonised in 2015 as the Apostle of Sri Lanka.",
    citation: `${W}Joseph_Vaz`,
  },
  {
    slug: "romanum-decet-pontificem",
    title: "Romanum decet Pontificem curbs papal nepotism",
    year: 1692,
    date: "1692-06-22",
    precision: "day",
    era: "early-modern",
    kind: "document",
    tags: ["reform", "papacy"],
    location: "Rome",
    context:
      "Innocent XII abolishes the office of cardinal-nephew, allows a pope to raise only one relative to the cardinalate, and caps what papal kin may receive.",
    significance: "It ends a long-standing abuse of the Renaissance and Baroque papacy.",
    citation: `${W}Romanum_decet_Pontificem`,
  },
  {
    slug: "martyrdom-of-john-de-britto",
    title: "St John de Britto martyred at Oriyur",
    year: 1693,
    precision: "year",
    era: "early-modern",
    kind: "martyrdom",
    tags: ["mission"],
    location: "Oriyur, Marava",
    context:
      "The Portuguese Jesuit, who lived as an Indian ascetic in the Madurai mission, is beheaded after a prince he converted dismisses all his wives but one.",
    significance:
      "He had made many converts and founded many mission stations; Pius IX beatified him in 1853.",
    citation: `${NA}08461a.htm`,
  },
  {
    slug: "fenelon-maxims-condemned",
    title: "Fénelon's Maxims of the Saints condemned",
    year: 1699,
    date: "1699-03-12",
    precision: "day",
    era: "early-modern",
    kind: "document",
    location: "Rome",
    context:
      "After two years of examination by the Holy Office, twenty-three propositions from the Archbishop of Cambrai's book on 'pure love' are condemned amid his quarrel with Bossuet.",
    significance:
      "Fénelon submits at once and without reservation, announcing the verdict to his own flock.",
    citation: `${NA}06035a.htm`,
  },
  {
    slug: "union-of-alba-iulia",
    title: "Romanian Church of Transylvania unites with Rome",
    year: 1700,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["eastern-catholic"],
    location: "Alba Iulia, Transylvania",
    context:
      "After the Habsburg conquest of Transylvania, Metropolitan Atanasie Anghel enters full communion with Rome by the Act of Union of 1698, formalised by a synod in 1700.",
    significance:
      "The union founds the Romanian Greek Catholic Church, which keeps the Byzantine liturgy in Romanian.",
    citation: `${W}Romanian_Greek_Catholic_Church`,
  },
  {
    slug: "port-royal-suppressed",
    title: "Port-Royal des Champs suppressed",
    year: 1709,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["jansenism"],
    location: "Port-Royal des Champs, near Paris",
    context:
      "Royal authorities expel the last twenty-five nuns of Port-Royal des Champs, the heart of French Jansenism, which had refused to sign the formulary.",
    significance:
      "The buildings are razed in 1710, but Jansenist sympathies live on in the Paris Parlement and the university.",
    citation: `${NA}12295a.htm`,
  },
  {
    slug: "death-of-louis-de-montfort",
    title: "Death of St Louis de Montfort",
    year: 1716,
    date: "1716-04-28",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    tags: ["marian"],
    location: "Saint-Laurent-sur-Sèvre",
    context:
      "The French missionary priest, founder of the Company of Mary and the Daughters of Wisdom, dies after years of walking from parish to parish preaching missions.",
    significance:
      "His True Devotion to Mary, teaching consecration to Jesus through Mary, became a classic of Marian spirituality; he was canonised in 1947.",
    citation: `${W}Louis_de_Montfort`,
    links: { saints: ["saint-louis-de-montfort"] },
  },
  {
    slug: "death-of-john-baptist-de-la-salle",
    title: "Death of St John Baptist de La Salle",
    year: 1719,
    date: "1719-04-07",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    location: "Rouen",
    context:
      "The canon of Reims who gave up his canonry and his fortune to found the Brothers of the Christian Schools for free schooling dies on Good Friday.",
    significance:
      "Benedict XIII approves his institute in 1725; hailed as a father of modern pedagogy, he was canonised in 1900.",
    citation: `${NA}08444a.htm`,
    links: { saints: ["saint-john-baptist-de-la-salle"] },
  },
  {
    slug: "passionists-founded",
    title: "St Paul of the Cross founds the Passionists",
    year: 1720,
    precision: "year",
    era: "early-modern",
    kind: "order",
    location: "Castellazzo, Piedmont",
    context:
      "Clothed by his bishop in the habit of the Passion, Paul Danei writes in December 1720 the rule of a congregation devoted to preaching Christ crucified.",
    significance:
      "Benedict XIII allows him to gather companions in 1725 and ordains him and his brother priests in 1727.",
    citation: `${NA}11521d.htm`,
    links: { saints: ["saint-paul-of-the-cross"] },
  },
  {
    slug: "schism-of-utrecht",
    title: "Schism of Utrecht",
    year: 1724,
    precision: "year",
    era: "early-modern",
    kind: "schism",
    tags: ["schism", "jansenism"],
    location: "Utrecht",
    context:
      "Dutch clergy of the suppressed archdiocese of Utrecht elect Cornelius Steenoven archbishop, and the suspended bishop Dominique Varlet consecrates him without papal mandate.",
    significance:
      "A Jansenist-leaning church separates from Rome; it later becomes the anchor of the Old Catholic Union of Utrecht.",
    citation: `${W}Old_Catholic_Church_of_the_Netherlands`,
  },
  {
    slug: "melkite-catholic-church",
    title: "The Melkite Patriarchate of Antioch divides",
    year: 1724,
    precision: "year",
    era: "early-modern",
    kind: "schism",
    tags: ["schism", "eastern-catholic"],
    location: "Damascus",
    context:
      "When the pro-Roman Cyril VI Tanas is elected Patriarch of Antioch, Constantinople declares the election invalid and installs Sylvester; Cyril's followers enter communion with Rome.",
    significance:
      "The Melkite Greek Catholic Church and the Greek Orthodox Patriarchate of Antioch have since shared one Byzantine heritage under separate patriarchs.",
    citation: `${W}Melkite_Greek_Catholic_Church`,
  },
  {
    slug: "convulsionnaires-of-saint-medard",
    title: "Convulsionnaires of Saint-Médard",
    year: 1731,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["jansenism"],
    location: "Saint-Médard, Paris",
    context:
      "At the tomb of the Jansenist deacon François de Pâris reported cures multiply and pilgrims fall into convulsions, until the crown closes the cemetery in January 1732.",
    significance:
      "The closure wins public sympathy for the Jansenists and turns resentment against the monarchy's control of religion.",
    citation: `${W}Convulsionnaires_of_Saint-Médard`,
  },
  {
    slug: "in-eminenti-apostolatus",
    title: "In eminenti apostolatus condemns Freemasonry",
    year: 1738,
    date: "1738-04-28",
    precision: "day",
    era: "early-modern",
    kind: "document",
    location: "Rome",
    context:
      "Clement XII forbids Catholics, under pain of excommunication, to join Masonic lodges, which bind men of every religion by oaths of secrecy.",
    significance:
      "The first papal condemnation of Freemasonry; Catholics remain forbidden to join the lodges.",
    citation: `${W}In_eminenti_apostolatus`,
  },
  {
    slug: "grey-nuns-founded",
    title: "Marguerite d'Youville founds the Grey Nuns",
    year: 1738,
    precision: "year",
    era: "early-modern",
    kind: "order",
    location: "Montreal",
    context:
      "The widowed Marguerite d'Youville and three companions open a small house in Montreal and take in the poor, the start of the Sisters of Charity of the General Hospital.",
    significance:
      "Entrusted with Montreal's General Hospital in 1747, the 'Grey Nuns' receive episcopal approval of their rule in 1754.",
    citation: `${NA}07031a.htm`,
  },
  {
    slug: "election-of-benedict-xiv",
    title: "Benedict XIV elected",
    year: 1740,
    precision: "year",
    era: "early-modern",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "After a deadlocked six-month conclave, the learned Archbishop of Bologna, Prospero Lambertini, is chosen as a compromise candidate.",
    significance:
      "A scholar-pope whose treatise on beatification and canonisation long governed the Church's process for declaring saints.",
    citation: `${NA}02432a.htm`,
    links: { popes: ["pope-benedict-xiv"] },
  },
  {
    slug: "omnium-sollicitudinum-malabar-rites",
    title: "Omnium sollicitudinum settles the Malabar Rites",
    year: 1744,
    date: "1744-09-12",
    precision: "day",
    era: "early-modern",
    kind: "document",
    tags: ["mission"],
    location: "Rome",
    context:
      "Benedict XIV confirms the limits on the Madurai Jesuits' adoption of Hindu customs and assigns separate missionaries to serve the lowest castes.",
    significance:
      "It upholds Clement XII's rules of 1734 and closes the long dispute over the accommodation begun by Roberto de Nobili.",
    citation: `${NA}09558b.htm`,
    links: { popes: ["pope-benedict-xiv"] },
  },
  {
    slug: "death-of-leonard-of-port-maurice",
    title: "Death of St Leonard of Port Maurice",
    year: 1751,
    date: "1751-11-26",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    location: "Rome",
    context:
      "The Franciscan mission preacher, who set up the Stations of the Cross in the Colosseum and in 571 other places, dies in Rome on returning from a mission in Bologna.",
    significance:
      "A great promoter of the Way of the Cross and of a definition of the Immaculate Conception, he was canonised in 1867.",
    citation: `${NA}09178c.htm`,
  },
  {
    slug: "death-of-gerard-majella",
    title: "Death of St Gerard Majella",
    year: 1755,
    date: "1755-10-16",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    context:
      "The Redemptorist brother, remembered for his obedience and for bearing in silence a false accusation of grave sin, dies at twenty-nine.",
    significance:
      "Reputed a wonder-worker in life and after death, he was canonised by Pius X in 1904.",
    citation: `${NA}06467c.htm`,
    links: { saints: ["saint-gerard-majella"] },
  },
  {
    slug: "guarani-war",
    title: "Guaraní War and the fall of the Seven Reductions",
    year: 1756,
    date: "1756-02-10",
    precision: "day",
    era: "early-modern",
    kind: "event",
    tags: ["mission"],
    location: "Misiones Orientales",
    context:
      "When the Treaty of Madrid hands seven Jesuit reductions east of the Uruguay River to Portugal, the Guaraní refuse to leave; at Caiboaté a Spanish–Portuguese army kills some 1,500 of them.",
    significance:
      "The occupation ends the missions' self-rule; Spain recovers the territory when the treaty is annulled in 1761, a story retold in the film The Mission.",
    citation: `${W}Guaraní_War`,
  },
  {
    slug: "jesuits-expelled-from-portugal",
    title: "Portugal suppresses the Jesuits",
    year: 1759,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["jesuits", "persecution"],
    location: "Lisbon",
    context:
      "The Marquis of Pombal, chief minister of Joseph I, accuses the Jesuits of complicity in a plot against the king and has the Society civilly suppressed.",
    significance:
      "The charge is never proved; Father Gabriel Malagrida is burned in 1761 and many imprisoned Jesuits perish, the first blow of the campaign that ends in 1773.",
    citation: `${NA}14096a.htm`,
  },
  {
    slug: "febronius-de-statu-ecclesiae",
    title: "Febronius attacks papal primacy",
    year: 1763,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["gallicanism", "papacy"],
    location: "Trier",
    context:
      "Writing as Justinus Febronius, Johann Nikolaus von Hontheim, auxiliary bishop of Trier, urges that papal power be cut back and that Catholic rulers act together against Rome.",
    significance:
      "Clement XIII condemns the book in 1764 and Hontheim recants in 1778, but Catholic courts eagerly adopt its ideas.",
    citation: `${NA}06023a.htm`,
  },
  {
    slug: "jesuits-suppressed-in-france",
    title: "Louis XV dissolves the Society of Jesus in France",
    year: 1764,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["jesuits"],
    location: "Paris",
    context:
      "After the parlements close the Jesuit colleges and order the fathers to renounce their vows, Louis XV reluctantly signs an edict dissolving the Society throughout his kingdom.",
    significance:
      "Only a handful of Jesuits accept the conditions; France joins Portugal in pressing Rome for a universal suppression.",
    citation: `${NA}14096a.htm`,
  },
  {
    slug: "jesuits-expelled-from-spain",
    title: "Charles III expels the Jesuits from Spain",
    year: 1767,
    precision: "year",
    era: "early-modern",
    kind: "event",
    tags: ["jesuits"],
    location: "Madrid",
    context:
      "Sealed royal orders opened on the night of 1–2 April send about 6,000 Jesuits under guard to the coast for deportation to the Papal States and then Corsica.",
    significance:
      "Decided in secret and without trial, the expulsion is extended to Spain's colonies, Naples and Parma and helps force the suppression of 1773.",
    citation: `${NA}14096a.htm`,
  },
  {
    slug: "election-of-pius-vi",
    title: "Pius VI elected",
    year: 1775,
    date: "1775-02-15",
    precision: "day",
    era: "early-modern",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Cardinal Giovanni Angelo Braschi is elected despite the early opposition of Spain, Portugal and France.",
    significance:
      "His long reign meets Febronianism, Josephinism and the French Revolution, and ends with his death as a prisoner of France in 1799.",
    citation: `${NA}12131a.htm`,
    links: { popes: ["pope-pius-vi"] },
  },
  {
    slug: "presentation-sisters-founded",
    title: "Nano Nagle founds the Presentation Sisters",
    year: 1775,
    date: "1775-12-24",
    precision: "day",
    era: "early-modern",
    kind: "order",
    location: "Cork",
    context:
      "Having opened schools for poor children while the penal laws still barred Catholic education, Nano Nagle founds the Society of Charitable Instruction of the Sacred Heart of Jesus on Christmas Eve.",
    significance:
      "It became the Presentation Sisters, a worldwide teaching institute whose lantern recalls her nightly rounds among the poor.",
    citation: `${W}Nano_Nagle`,
  },
  {
    slug: "gordon-riots",
    title: "Gordon Riots",
    year: 1780,
    date: "1780-06-02",
    precision: "day",
    era: "early-modern",
    kind: "event",
    tags: ["persecution"],
    location: "London",
    context:
      "Lord George Gordon's Protestant Association marches against the Catholic Relief Act of 1778, and for a week mobs sack Catholic chapels and homes and burn London's prisons.",
    significance:
      "Soldiers finally restore order after violence that strikes Catholics and unpopular Protestants alike.",
    citation: `${NA}06649c.htm`,
  },
  {
    slug: "pius-vi-visits-vienna",
    title: "Pius VI travels to Vienna",
    year: 1782,
    date: "1782-03-22",
    precision: "day",
    era: "early-modern",
    kind: "pope",
    tags: ["gallicanism", "papacy"],
    location: "Vienna",
    context:
      "Hoping to turn Joseph II from reforms that cut the Austrian bishops off from Rome and dissolved many monasteries, Pius VI goes to Vienna and stays a month.",
    significance:
      "He wins only a promise that the reforms will not touch dogma or the dignity of the pope.",
    citation: `${NA}12131a.htm`,
    links: { popes: ["pope-pius-vi"] },
  },
  {
    slug: "death-of-benedict-joseph-labre",
    title: "Death of St Benedict Joseph Labre",
    year: 1783,
    date: "1783-04-16",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    location: "Rome",
    context:
      "The French pilgrim who chose a life of poverty and penance on the roads to Europe's shrines collapses on the steps of Santa Maria dei Monti and dies.",
    significance:
      "Miracles are soon attributed to his intercession, and Leo XIII canonised him in 1881.",
    citation: `${NA}02442a.htm`,
  },
  {
    slug: "baptism-of-yi-seung-hun",
    title: "Yi Seung-hun baptised: the Korean Church begins",
    year: 1784,
    precision: "year",
    era: "early-modern",
    kind: "mission",
    tags: ["mission"],
    location: "Beijing and Seoul",
    context:
      "A Korean scholar who has studied Catholic books is baptised Peter in Beijing, then returns with books and crucifixes to baptise his fellow converts.",
    significance:
      "The Korean Church begins among lay believers; Yi is executed in the persecution of 1801.",
    citation: `${W}Yi_Sŭnghun`,
  },
  {
    slug: "synod-of-pistoia",
    title: "Synod of Pistoia",
    year: 1786,
    date: "1786-09-18",
    precision: "day",
    era: "early-modern",
    kind: "council",
    tags: ["jansenism", "gallicanism"],
    location: "Pistoia",
    context:
      "Backed by Grand Duke Leopold of Tuscany, Bishop Scipione de' Ricci holds a diocesan synod that adopts Jansenist and state-church reforms of doctrine, discipline and worship.",
    significance:
      "Pius VI condemns eighty-five of its propositions in the bull Auctorem fidei of 1794, ending Jansenism's bid for a foothold in Italy.",
    citation: `${NA}12116c.htm`,
  },
  {
    slug: "death-of-alphonsus-liguori",
    title: "Death of St Alphonsus Liguori",
    year: 1787,
    date: "1787-08-01",
    precision: "day",
    era: "early-modern",
    kind: "saint",
    tags: ["doctor"],
    location: "Nocera de' Pagani",
    context:
      "The founder of the Redemptorists, moral theologian and former bishop dies in his ninety-first year as the midday Angelus rings.",
    significance: "Canonised in 1839, he was declared a Doctor of the Church in 1871.",
    citation: `${NA}01334a.htm`,
    links: { saints: ["saint-alphonsus-liguori"], doctors: ["doctor-alphonsus-liguori"] },
  },
];
