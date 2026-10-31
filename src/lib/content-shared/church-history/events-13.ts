import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const NA = "https://www.newadvent.org/cathen/";
const V = "https://www.vatican.va/content/";
const VC = "https://www.vatican.va/roman_curia/congregations/";

/**
 * Church-history spine, part 13: a second gap-filling pass over parts 1–12.
 * It adds the religious institutes and lay movements still missing (the
 * Eudists, the Hospitallers of St John of God's approval, Montfort's Company
 * of Mary, the Marianists, Pallottines, Assumptionists, the Milan seminary
 * that became PIME, Mill Hill, the Comboni Missionaries, Schoenstatt,
 * Communion and Liberation, the Neocatechumenal Way and Sant'Egidio); the
 * Petite Église, the Bulgarian and Coptic Catholic unions, the Mariavite
 * schism and the 1973 Catholic–Coptic declaration; missions in Mexico's
 * first sees, Angola, Madagascar, Nigeria, Siam, the Moluccas and Java,
 * Tibet and the Balkans; group canonisations and beatifications that were
 * mentioned only inside other events; Marian shrines honoured by a formal
 * Church act; and the curated magisterial documents that had no event.
 *
 * Document events reuse the curated CHURCH_DOCUMENT slug (and link it as
 * `documentSlug`), so a published document enriches its event on the
 * timeline instead of appearing twice.
 */
export const EVENTS_13: ChurchHistoryEvent[] = [
  // ---------------------------------------------------------------- High Middle Ages to the Reformation
  {
    slug: "brown-scapular-given-to-simon-stock",
    title: "Our Lady gives the brown scapular to St Simon Stock (tradition)",
    year: 1251,
    precision: "circa",
    era: "high-medieval",
    kind: "apparition",
    tags: ["marian"],
    location: "Cambridge, England (by tradition)",
    context:
      "Carmelite tradition holds that the Virgin appeared to Simon Stock at Cambridge holding the scapular of the order's habit, and promised that whoever died wearing it would not suffer eternal fire.",
    significance:
      "The story is first recorded some 150 years later and the Church's official teaching does not rest on it, but the small brown scapular, spread among the laity from the sixteenth century, became a sign of belonging to Mary and a pledge of her protection.",
    citation: `${W}Scapular_of_Our_Lady_of_Mount_Carmel`,
    links: { apparitions: ["apparition-our-lady-of-mount-carmel-simon-stock"] },
  },
  {
    slug: "our-lady-of-caravaggio",
    title: "Reported apparition of Our Lady at Caravaggio",
    year: 1432,
    date: "1432-05-26",
    precision: "day",
    era: "schism-renaissance",
    kind: "apparition",
    tags: ["marian"],
    location: "Caravaggio, Lombardy",
    context:
      "A married woman of Caravaggio named Giovannetta reports that the Virgin appeared to her in a field, asked for fasting on Fridays and devotion on Saturdays, promised peace, and left a spring flowing where she had stood.",
    significance:
      "A sanctuary rose on the spot and was enlarged under St Charles Borromeo; Clement XI decreed the canonical coronation of its image in 1710, and Pius X made the shrine a minor basilica in 1906.",
    citation: `${W}Our_Lady_of_Caravaggio`,
    links: {
      popes: ["pope-clement-xi", "pope-saint-pius-x"],
      saints: ["saint-charles-borromeo"],
    },
  },
  {
    slug: "ahdname-of-milodraz",
    title: "Mehmed II's charter protects the Bosnian Franciscans",
    year: 1463,
    precision: "circa",
    era: "schism-renaissance",
    kind: "mission",
    tags: ["mission"],
    location: "Milodraž, Bosnia",
    context:
      "As the Ottomans conquer Bosnia, the friar Anđeo Zvizdović wins from Sultan Mehmed II a sworn charter, the Ahdname of Milodraž, promising the Franciscans freedom, protection and a safe return to their friaries, to halt the flight of Catholics from the land.",
    significance:
      "Later sultans reaffirmed it, though local officials often ignored it, and it is widely credited with allowing Catholicism to survive in Bosnia and Herzegovina under Ottoman rule.",
    citation: `${W}Ahdname_of_Milodraž`,
  },
  {
    slug: "julian-garces-first-bishop-of-tlaxcala",
    title: "Julián Garcés named the first bishop of Tlaxcala",
    year: 1525,
    precision: "year",
    era: "reformation-trent",
    kind: "mission",
    tags: ["mission"],
    location: "Tlaxcala, New Spain",
    context:
      "At Charles V's request, Clement VII names the Dominican Julián Garcés bishop for the lands Cortés had conquered; Garcés fixes his see at Tlaxcala and takes possession in 1527, giving New Spain its first diocese with a resident bishop.",
    significance:
      "The see moved in 1539 to the new city of Puebla de los Ángeles, which became an archdiocese in 1903; its first territory stretched across today's Puebla, Tlaxcala, Veracruz, Tabasco, Hidalgo and Guerrero.",
    citation: `${NA}14747c.htm`,
    links: { popes: ["pope-clement-vii"] },
  },
  {
    slug: "zumarraga-first-bishop-of-mexico",
    title: "Juan de Zumárraga appointed the first bishop of Mexico",
    year: 1530,
    precision: "year",
    era: "reformation-trent",
    kind: "mission",
    tags: ["mission"],
    location: "Mexico City",
    context:
      "The Basque Franciscan Juan de Zumárraga, in Mexico since December 1528 as bishop-elect and Protector of the Indians, is appointed the first bishop of Mexico, though he is consecrated only in 1533.",
    significance:
      "He defended the Indians against the abuses of the first Audiencia, founded the Colegio de Santa Cruz at Tlatelolco and brought the first printing press to the Americas; as the colony's first inquisitor he also handed the Texcoco lord Carlos Ometochtzin to the secular courts.",
    citation: `${W}Juan_de_Zumárraga`,
  },
  {
    slug: "francis-xavier-in-the-moluccas",
    title: "St Francis Xavier preaches in the Moluccas",
    year: 1546,
    precision: "year",
    era: "reformation-trent",
    kind: "mission",
    tags: ["mission"],
    location: "Ambon, Ternate and Morotai, Moluccas",
    context:
      "Twelve years after the Portuguese reached the Spice Islands, Francis Xavier spends 1546 and 1547 on Ambon, Ternate and Morotai, baptising several thousand islanders and laying the foundations of a lasting mission.",
    significance:
      "Catholicism took root in eastern Indonesia, but after the Portuguese were driven from Ternate in 1574 many northern Moluccan Catholics were killed or became Muslims, and the Dutch later forced Ambon's Catholics into Protestantism.",
    citation: `${W}Catholic_Church_in_Indonesia`,
    links: { saints: ["saint-francis-xavier"] },
  },
  {
    slug: "brothers-hospitallers-approved",
    title: "Pius V approves the Brothers Hospitallers of St John of God",
    year: 1572,
    precision: "year",
    era: "reformation-trent",
    kind: "order",
    tags: ["charity"],
    location: "Rome",
    context:
      "Twenty-two years after John of God's death at Granada, St Pius V approves his followers, who already ran hospitals in Madrid, Córdoba and other Spanish towns, as a religious order under the Rule of St Augustine.",
    significance:
      "Given a Roman mother-house by Gregory XIII in 1584 and a first French hospital in Paris in 1601, the brothers, who add a fourth vow to serve the sick for life, spread their hospitals across Europe and its colonies.",
    citation: `${NA}02802b.htm`,
    links: { popes: ["pope-saint-pius-v"], saints: ["saint-john-of-god"] },
  },
  {
    slug: "diocese-of-angola-and-congo-erected",
    title: "Diocese of Angola and Congo erected at São Salvador",
    year: 1596,
    precision: "year",
    era: "reformation-trent",
    kind: "mission",
    tags: ["mission"],
    location: "São Salvador (Mbanza Kongo)",
    context:
      "A diocese of Angola and Congo is carved out of the diocese of São Tomé, with its first cathedral, the Holy Saviour of Congo, at São Salvador.",
    significance:
      "Its see moved to Luanda in 1716, and it lives on as the Archdiocese of Luanda, the oldest in Angola, which counted some three million Catholics in 2004.",
    citation: `${W}Archdiocese_of_Luanda`,
  },
  {
    slug: "andrade-reaches-tibet",
    title: "António de Andrade opens the first mission in Tibet",
    year: 1624,
    precision: "year",
    era: "reformation-trent",
    kind: "mission",
    tags: ["mission", "jesuits"],
    location: "Tsaparang, kingdom of Guge, western Tibet",
    context:
      "Travelling with Hindu pilgrims bound for Badrinath, the Portuguese Jesuit António de Andrade and Brother Manuel Marques cross the Mana Pass into Tibet, the first Europeans known to do so, and are welcomed by the king of Guge at Tsaparang.",
    significance:
      "Returning in 1625 with other Jesuits, Andrade built a church and made converts with royal support, but after Ladakh conquered Guge the missionaries were persecuted or expelled, and by 1640 the mission had ended.",
    citation: `${W}António_de_Andrade`,
  },
  {
    slug: "eudists-founded",
    title: "St John Eudes founds the Eudists",
    year: 1643,
    date: "1643-03-25",
    precision: "day",
    era: "reformation-trent",
    kind: "order",
    tags: ["education"],
    location: "Caen, Normandy",
    context:
      "After twenty years in the Oratory, the Norman priest John Eudes institutes at Caen the Congregation of Jesus and Mary, a society of priests without religious vows devoted to training clergy in seminaries and preaching missions.",
    significance:
      "In Eudes's lifetime it opened major seminaries at Caen, Coutances, Lisieux, Rouen, Évreux and Rennes, carrying the Tridentine reform of the clergy into Normandy and Brittany; three Eudists died in the September massacres of 1792.",
    citation: `${NA}05596b.htm`,
  },
  // ---------------------------------------------------------------- Missions & Enlightenment
  {
    slug: "lazarist-mission-to-madagascar",
    title: "Vincent de Paul's Lazarists land in Madagascar",
    year: 1648,
    precision: "year",
    era: "early-modern",
    kind: "mission",
    tags: ["mission"],
    location: "Fort-Dauphin, Madagascar",
    context:
      "Sent by St Vincent de Paul, the Lazarist Father Nacquart reaches Fort-Dauphin, the French post on Madagascar's south-east coast, in December and gives himself to evangelising the Malagasy until fever kills him in 1650.",
    significance:
      "Of thirty-seven missionaries sent to the island only two returned to France, and the mission was abandoned in 1674; not until 1855 did a missionary, travelling in disguise, reach the capital, Antananarivo.",
    citation: `${NA}09509e.htm`,
    links: { saints: ["saint-vincent-de-paul"] },
  },
  {
    slug: "querrien-devotion-approved",
    title: "Bishop of Saint-Brieuc approves devotion at Querrien",
    year: 1652,
    date: "1652-09-11",
    precision: "day",
    era: "early-modern",
    kind: "apparition",
    tags: ["marian"],
    location: "Querrien, La Prénessaye, Brittany",
    context:
      "After eleven-year-old Jeanne Courtel reports apparitions of the Virgin from mid-August 1652, Bishop Denis de La Barde of Saint-Brieuc questions her and the witnesses under oath at Querrien, gives a favourable opinion and orders a chapel built.",
    significance:
      "In 1656 he founded four perpetual chaplaincies for the pilgrims to Our Lady of All Help, though the shrine's founding documents never mention the apparitions and no Church authority has formally recognised them.",
    citation: `${W}Querrien_Marian_apparitions`,
  },
  {
    slug: "lambert-de-la-motte-reaches-ayutthaya",
    title: "Bishop Lambert de la Motte reaches Ayutthaya",
    year: 1662,
    precision: "year",
    era: "early-modern",
    kind: "mission",
    tags: ["mission"],
    location: "Ayutthaya, Siam",
    context:
      "Pierre Lambert de la Motte, vicar apostolic of Cochinchina, arrives at the Siamese capital Ayutthaya with Fathers de Bourges and Deydier; Bishop François Pallu joins him there in 1664.",
    significance:
      "Siam, then a refuge for hundreds of Vietnamese and Japanese Christians driven from home by persecution, was entrusted by Clement IX to the newly founded Paris Foreign Missions in 1669.",
    citation: `${NA}13765a.htm`,
  },
  {
    slug: "council-of-arben",
    title: "Council of Arbën strengthens the Church in Ottoman Albania",
    year: 1703,
    date: "1703-01-14",
    precision: "day",
    era: "early-modern",
    kind: "council",
    location: "Mërqi, near Lezhë, Albania",
    context:
      "Under the Albanian-born Pope Clement XI, some two hundred Catholic dignitaries meet for two days at Mërqi near Lezhë, led by the apostolic visitor Archbishop Vincentius Zmajević of Bar, to strengthen the Church and halt conversions to Islam.",
    significance:
      "Its opening address and decrees were given in Albanian, and the acts that Propaganda Fide printed in Albanian and Latin in 1706 are a key witness to the northern Albanian language of the time.",
    citation: `${W}Arbëni_Council`,
    links: { popes: ["pope-clement-xi"] },
  },
  {
    slug: "montfort-writes-the-rule-of-the-company-of-mary",
    title: "St Louis de Montfort writes the Rule of the Company of Mary",
    year: 1713,
    precision: "year",
    era: "early-modern",
    kind: "order",
    tags: ["marian"],
    location: "Western France",
    context:
      "Having prayed since 1700 for a little band of good priests to preach missions under Mary's protection, Louis de Montfort seeks recruits at the Holy Ghost seminary in Paris and writes the Rule of his Company of Mary.",
    significance:
      "At his death in 1716 it counted only two priests and a few brothers, yet these 'Montfortists' gave more than 430 missions in western France by 1781 and, refounded after the Revolution, won canonical approval in the nineteenth century.",
    citation: `${NA}09749d.htm`,
    links: { saints: ["saint-louis-de-montfort"] },
  },
  {
    slug: "desideri-reaches-lhasa",
    title: "Ippolito Desideri reaches Lhasa",
    year: 1716,
    date: "1716-03-18",
    precision: "day",
    era: "early-modern",
    kind: "mission",
    tags: ["mission", "jesuits"],
    location: "Lhasa, Tibet",
    context:
      "After a seven-month winter crossing of the Tibetan plateau in a Mongol governor's caravan, the Italian Jesuit Ippolito Desideri reaches Lhasa, where he settles to master Tibetan language, literature and philosophy.",
    significance:
      "Between 1718 and 1721 he wrote five works in classical Tibetan answering Buddhist teaching on rebirth and emptiness, but the Capuchins, to whom Propaganda Fide had given the Tibet mission in 1703, secured his recall in 1721.",
    citation: `${W}Ippolito_Desideri`,
  },
  // ---------------------------------------------------------------- Revolution to Vatican I
  {
    slug: "petite-eglise-rejects-the-concordat",
    title: "The Petite Église refuses the Concordat of 1801",
    year: 1801,
    precision: "year",
    era: "revolution-19c",
    kind: "schism",
    tags: ["schism"],
    location: "France and Belgium",
    context:
      "French and Belgian Catholics who reject the Concordat between Pius VII and Napoleon, above all its reconciliation of priests compromised under the Revolution, break away into scattered 'little church' communities that Rome regards as schismatic.",
    significance:
      "Once perhaps 100,000 strong, the groups shrank as their priests died: the last enfarinés of Aveyron submitted in 1911, while the Petite Église of Poitou still had thousands of adherents in the 1950s and was approached by John Paul II in 1996.",
    citation: `${W}Petite_Église`,
    links: { popes: ["pope-pius-vii"] },
  },
  {
    slug: "prefecture-apostolic-of-batavia",
    title: "Pius VII restores the Catholic mission in the Dutch East Indies",
    year: 1807,
    precision: "year",
    era: "revolution-19c",
    kind: "mission",
    tags: ["mission"],
    location: "Batavia (Jakarta), Java",
    context:
      "After two centuries in which Dutch rule had made it hard for a priest to enter Java and expelled any who were discovered, Pius VII creates a prefecture apostolic for the Dutch East Indies at Batavia once Louis Napoleon becomes King of Holland; its first two priests land on 4 April 1808.",
    significance:
      "Raised to a vicariate in 1842 and entrusted to the Dutch Jesuits in 1874, the mission spread across Java, Sumatra, Borneo, Timor, Celebes and the Moluccas, the seedbed of the Church in modern Indonesia.",
    citation: `${NA}02346b.htm`,
    links: { popes: ["pope-pius-vii"] },
  },
  {
    slug: "marianists-founded",
    title: "Blessed William Joseph Chaminade founds the Marianists",
    year: 1817,
    date: "1817-10-02",
    precision: "day",
    era: "revolution-19c",
    kind: "order",
    tags: ["marian", "education"],
    location: "Bordeaux",
    context:
      "At Bordeaux, William Joseph Chaminade, a priest marked by exile and persecution during the Revolution, founds the Society of Mary for brothers and priests, growing out of the lay sodalities he had gathered to rebuild Catholic life.",
    significance:
      "Dedicated above all to evangelisation and education, the Marianists received papal approval in 1891 and spread from France to Europe, the Americas, Africa and Asia, where they run schools and universities.",
    citation: `${W}Society_of_Mary_(Marianists)`,
  },
  {
    slug: "pallottines-founded",
    title: "St Vincent Pallotti founds the Society of the Catholic Apostolate",
    year: 1835,
    precision: "year",
    era: "revolution-19c",
    kind: "order",
    location: "Rome",
    context:
      "Vincent Pallotti, a Roman priest who with his associates had built a network of works for the city's poor, sick, soldiers, workers, students and prisoners, gathers priests and brothers into the community that becomes the Pallottines.",
    significance:
      "Part of the wider Union of Catholic Apostolate, the society now serves in some 45 countries; Pallotti died in 1850 and was canonised by John XXIII on 20 January 1963.",
    citation: `${W}Pallottines`,
  },
  {
    slug: "assumptionists-founded",
    title: "Emmanuel d'Alzon founds the Assumptionists",
    year: 1845,
    precision: "year",
    era: "revolution-19c",
    kind: "order",
    location: "Nîmes",
    context:
      "At Nîmes, the diocese's vicar general Emmanuel d'Alzon forms the Augustinians of the Assumption around his College of the Assumption, to combat unbelief in Europe and schism in the East through schools, the press, pilgrimages and missions.",
    significance:
      "Approved by Rome in 1864, they began the mass pilgrimages that grew into the national pilgrimage to Lourdes and founded the daily La Croix, whose antisemitic campaigning in the Dreyfus years preceded their suppression in France in 1900.",
    citation: `${W}Assumptionists`,
  },
  {
    slug: "lombard-seminary-for-foreign-missions-founded",
    title: "Milan's seminary for foreign missions founded, the root of PIME",
    year: 1850,
    precision: "year",
    era: "revolution-19c",
    kind: "order",
    tags: ["mission"],
    location: "Milan",
    context:
      "Bishop Angelo Ramazzotti founds in Milan the Lombard Seminary for Foreign Missions to prepare diocesan priests for countries where the Gospel had not yet been preached.",
    significance:
      "In 1926 Pius XI merged it with Rome's Seminary of Sts Peter and Paul to form the Pontifical Institute for Foreign Missions, whose martyrs include Blessed Giovanni Mazzucconi, killed in New Guinea in 1855, and St Alberico Crescitelli, killed in China in 1900.",
    citation: `${W}Pontifical_Institute_for_Foreign_Missions`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "bulgarian-greek-catholic-union",
    title: "Pius IX consecrates Joseph Sokolsky for the Bulgarian Catholics",
    year: 1861,
    precision: "year",
    era: "revolution-19c",
    kind: "event",
    tags: ["eastern-catholic"],
    location: "Rome",
    context:
      "Seeking freedom from the Greek-dominated Patriarchate of Constantinople, a Bulgarian movement led by Dragan Tsankov turns to Rome, and Pius IX consecrates the archimandrite Joseph Sokolsky archbishop for the Bulgarians of the Byzantine rite.",
    significance:
      "Almost at once Sokolsky was carried off on a Russian ship and held in Kiev for the rest of his life; the union first drew some 60,000 adherents, but most returned to Orthodoxy after the Sultan created the Bulgarian Exarchate in 1870.",
    citation: `${W}Bulgarian_Greek_Catholic_Church`,
    links: { popes: ["pope-pius-ix"] },
  },
  {
    slug: "mill-hill-missionaries-founded",
    title: "Herbert Vaughan founds the Mill Hill Missionaries",
    year: 1866,
    precision: "year",
    era: "revolution-19c",
    kind: "order",
    tags: ["mission"],
    location: "Mill Hill, London",
    context:
      "The English priest Herbert Vaughan, later a cardinal, opens St Joseph's Missionary College in a villa near Mill Hill, north of London, to train priests for peoples beyond Europe, above all in Africa and among Black Americans in the United States.",
    significance:
      "By 1908, when the Holy See gave its constitutions final approval, the society's priests were at work in India, Borneo, among New Zealand's Maori, in Kashmir, Uganda, the Congo and the Philippines.",
    citation: `${NA}08521d.htm`,
  },
  {
    slug: "comboni-missionaries-founded",
    title: "Daniel Comboni founds his missionary institute at Verona",
    year: 1867,
    date: "1867-06-01",
    precision: "day",
    era: "revolution-19c",
    kind: "order",
    tags: ["mission"],
    location: "Verona",
    context:
      "Daniel Comboni founds at Verona a society of missionary priests and brothers for Central Africa, first called the Sons of the Sacred Heart of Jesus.",
    significance:
      "Approved as a diocesan congregation in 1871, it was nearly cut off when the Mahdist war closed its Sudan mission after Comboni's death, but as the 'Verona Fathers' it recovered and now numbers some 1,500 members.",
    citation: `${W}Comboni_Missionaries_of_the_Heart_of_Jesus`,
  },
  {
    slug: "lagos-mission-founded",
    title: "The Society of African Missions opens the Lagos mission",
    year: 1868,
    precision: "year",
    era: "revolution-19c",
    kind: "mission",
    tags: ["mission"],
    location: "Lagos",
    context:
      "Missionaries of the Society of African Missions, already at Ouidah and Porto-Novo, secure land in Lagos and build a bamboo church on the site of today's Holy Cross Cathedral, serving Catholics returned from Brazil whom the catechist 'Padre Anthonio' had kept in the faith.",
    significance:
      "One missionary in four died of malaria or yellow fever in those years, yet the mission grew into the Archdiocese of Lagos, made a metropolitan see in 1950.",
    citation: `${W}Archdiocese_of_Lagos`,
  },
  {
    slug: "arcanum",
    title: "Arcanum: Leo XIII on Christian marriage",
    year: 1880,
    date: "1880-02-10",
    precision: "day",
    era: "revolution-19c",
    kind: "document",
    location: "Rome",
    context:
      "Leo XIII's encyclical on marriage teaches that Christ restored it to its original unity and indissolubility and raised it to a sacrament, so that its regulation belongs to the Church.",
    significance:
      "Written as states spread civil marriage and divorce, it set out the Church's case for the family that Pius XI took up again fifty years later in Casti connubii.",
    citation: `${V}leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_10021880_arcanum.html`,
    links: { popes: ["pope-leo-xiii"] },
  },
  {
    slug: "holy-ghost-fathers-reach-onitsha",
    title: "Holy Ghost Fathers open the mission at Onitsha",
    year: 1885,
    date: "1885-12-05",
    precision: "day",
    era: "revolution-19c",
    kind: "mission",
    tags: ["mission"],
    location: "Onitsha, Nigeria",
    context:
      "Holy Ghost Fathers, chiefly from France, Ireland and Alsace-Lorraine, arrive at Onitsha on the Niger and found the Catholic mission of what is now south-eastern Nigeria.",
    significance:
      "Made a prefecture apostolic in 1889 and built up under Joseph Shanahan, prefect and then vicar apostolic from 1905 to 1931, the mission became the Archdiocese of Onitsha in 1950, the root of the Church in south-eastern Nigeria.",
    citation: `${W}Archdiocese_of_Onitsha`,
  },
  {
    slug: "libertas",
    title: "Libertas: Leo XIII on human liberty",
    year: 1888,
    date: "1888-06-20",
    precision: "day",
    era: "revolution-19c",
    kind: "document",
    location: "Rome",
    context:
      "Leo XIII teaches that true liberty is the power to choose the good under the guidance of reason and God's law, and rejects the liberalism that makes every man a law to himself.",
    significance:
      "It denied that unlimited liberties of worship, speech, press and teaching are rights, while allowing that public authority may tolerate what is contrary to truth to avoid a greater evil or secure a greater good.",
    citation: `${V}leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_20061888_libertas.html`,
    links: { popes: ["pope-leo-xiii"] },
  },
  {
    slug: "coptic-catholic-patriarchate-restored",
    title: "Leo XIII restores the Coptic Catholic patriarchate of Alexandria",
    year: 1895,
    precision: "year",
    era: "revolution-19c",
    kind: "event",
    tags: ["eastern-catholic"],
    location: "Egypt",
    context:
      "As Catholics of the Coptic rite grow in number, Leo XIII restores a Catholic patriarchate of Alexandria for them, with new eparchies at Luxor and Minya and Bishop Cyril Makarios as patriarchal vicar.",
    significance:
      "Makarios became patriarch as Cyril II in 1899 but resigned at Pius X's request in 1908, leaving the see vacant until 1947; the Coptic Catholic Church now has eparchies across Egypt.",
    citation: `${W}Coptic_Catholic_Church`,
    links: { popes: ["pope-leo-xiii"] },
  },
  {
    slug: "basilica-of-covadonga-consecrated",
    title: "Basilica of Our Lady of Covadonga consecrated",
    year: 1901,
    precision: "year",
    era: "revolution-19c",
    kind: "event",
    tags: ["marian"],
    location: "Covadonga, Asturias",
    context:
      "A great basilica is consecrated at the mountain shrine of Our Lady of Covadonga, replacing the sanctuary of the Augustinian canons that fire had destroyed in 1777.",
    significance:
      "The shrine honours the Virgin whose intercession Pelayo credited for his victory at Covadonga in about 722; 'La Santina' is co-patron of Asturias, and her feast on 8 September is also the region's day.",
    citation: `${W}Our_Lady_of_Covadonga`,
  },
  {
    slug: "mariavites-excommunicated",
    title: "Pius X condemns the Mariavites",
    year: 1906,
    precision: "year",
    era: "revolution-19c",
    kind: "schism",
    tags: ["schism"],
    location: "Płock, Poland",
    context:
      "After years of inquiry into the revelations claimed by the Polish nun Feliksa Kozłowska and the priests' movement she led with Jan Kowalski, Pius X condemns the Mariavites in the encyclical Tribus circiter in April, and in December she, Kowalski and their followers are excommunicated.",
    significance:
      "The Mariavites became an independent church, with Kowalski consecrated a bishop by the Old Catholic Archbishop of Utrecht in 1909; his later innovations, among them women priests, and his abuse of young nuns split it in two in 1935.",
    citation: `${W}Mariavite_Church`,
    links: { popes: ["pope-saint-pius-x"] },
  },
  // ---------------------------------------------------------------- Twentieth Century
  {
    slug: "schoenstatt-founded",
    title: "Joseph Kentenich founds the Schoenstatt movement",
    year: 1914,
    date: "1914-10-18",
    precision: "day",
    era: "twentieth",
    kind: "order",
    tags: ["marian"],
    location: "Schoenstatt, Vallendar, Germany",
    context:
      "In a small chapel at Schoenstatt near Koblenz, Father Joseph Kentenich, spiritual director at a Pallottine school, and a group of young seminarians seal a 'covenant of love' with the Virgin Mary.",
    significance:
      "The Marian renewal movement that grew from it was branded a threat by the Nazis, who held Kentenich in Dachau from 1941 to 1945; it is now present in more than a hundred countries.",
    citation: `${W}Schoenstatt_Apostolic_Movement`,
  },
  {
    slug: "rerum-ecclesiae",
    title: "Rerum Ecclesiae: Pius XI on the missions",
    year: 1926,
    date: "1926-02-28",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["mission"],
    location: "Rome",
    context:
      "Pius XI tells mission bishops and superiors that building up a native clergy comes before everything else, and asks why local priests should be kept as mere assistants rather than governing their own people.",
    significance:
      "Insisting that the goal of a mission is a Church made up of local people, clergy and religious, the encyclical gave fresh impetus to the formation of native hierarchies in Asia and Africa.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_28021926_rerum-ecclesiae.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "our-lady-of-manaoag-crowned",
    title: "Our Lady of Manaoag canonically crowned",
    year: 1926,
    date: "1926-04-21",
    precision: "day",
    era: "twentieth",
    kind: "event",
    tags: ["marian"],
    location: "Manaoag, Pangasinan, Philippines",
    context:
      "By a decree of Pius XI, the papal envoy Archbishop Guglielmo Piani crowns the sixteenth-century ivory image of Our Lady of the Most Holy Rosary of Manaoag, kept by the Dominicans in Pangasinan.",
    significance:
      "Venerated as 'Apo Baket' since an apparition reported around 1610, the image was later given spiritual affinity with St Mary Major by Benedict XVI, and Pope Francis made its shrine a minor basilica in 2014.",
    citation: `${W}Our_Lady_of_Manaoag`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "miserentissimus-redemptor",
    title: "Miserentissimus Redemptor: reparation to the Sacred Heart",
    year: 1928,
    date: "1928-05-08",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["sacred-heart"],
    location: "Rome",
    context:
      "Pius XI teaches that the consecration to the Sacred Heart urged by Leo XIII in Annum Sacrum must be joined by reparation, an act of justice and love that makes amends for the sins committed against Christ.",
    significance:
      "He raised the feast of the Sacred Heart to the highest liturgical rank, with an octave, and ordered an act of reparation to be recited on it every year in all the churches of the world.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_19280508_miserentissimus-redemptor.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "canonization-of-the-north-american-martyrs",
    title: "The North American Martyrs canonised",
    year: 1930,
    date: "1930-06-29",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    tags: ["mission"],
    location: "Rome",
    context:
      "Pius XI canonises the eight Jesuit missionaries of the Huron mission killed in the mid-seventeenth century in present-day Ontario and New York, among them Jean de Brébeuf, Isaac Jogues and René Goupil, five years after beatifying them.",
    significance:
      "They became secondary patrons of Canada, while Goupil, Jogues and Jean de Lalande, killed at Ossernenon in what is now New York State, are counted the first three saints of the United States.",
    citation: `${W}Canadian_Martyrs`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "martyrs-of-songkhon",
    title: "The Martyrs of Songkhon killed in Thailand",
    year: 1940,
    precision: "year",
    era: "twentieth",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Songkhon, Mukdahan, Thailand",
    context:
      "During the Franco-Thai war, police who falsely suspect the Catholics of Songkhon of spying for France kill the catechist Philip Siphong Onphitak and then six women and girls, among them two sisters of the Lovers of the Holy Cross, who refuse to deny their faith.",
    significance:
      "Beatified by John Paul II in Rome on 22 October 1989, the seven are honoured at the shrine of Our Lady of the Martyrs of Thailand in Mukdahan province.",
    citation: `${W}Martyrs_of_Songkhon`,
    links: { popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "fulgens-corona",
    title: "Fulgens corona proclaims a Marian Year",
    year: 1953,
    date: "1953-09-08",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["marian"],
    location: "Rome",
    context:
      "On the feast of Mary's Nativity, Pius XII proclaims a Marian Year from December 1953 to December 1954 for the centenary of Pius IX's definition of the Immaculate Conception, recalling the words heard at Lourdes, 'I am the Immaculate Conception'.",
    significance:
      "It asked the faithful everywhere, with Rome and the grotto of Lourdes leading the way, to keep the year with renewed devotion to Mary and by imitating her purity in their own lives.",
    citation: `${V}pius-xii/en/encyclicals/documents/hf_p-xii_enc_08091953_fulgens-corona.html`,
    links: { popes: ["pope-venerable-pius-xii"] },
  },
  {
    slug: "sacra-virginitas",
    title: "Sacra virginitas: on consecrated virginity",
    year: 1954,
    date: "1954-03-25",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["monastic"],
    location: "Rome",
    context:
      "Against recent attacks on the doctrine, Pius XII reaffirms what Christ and St Paul taught and the Council of Trent defined: that virginity consecrated to God surpasses marriage in excellence, because it frees the whole heart for his service.",
    significance:
      "While honouring marriage as a sacrament, it defended religious vows and priestly celibacy and encouraged those who had vowed chastity to trust that God gives the help to keep it.",
    citation: `${V}pius-xii/en/encyclicals/documents/hf_p-xii_enc_25031954_sacra-virginitas.html`,
    links: { documentSlug: "sacra-virginitas", popes: ["pope-venerable-pius-xii"] },
  },
  {
    slug: "communion-and-liberation-begins",
    title: "Luigi Giussani starts the movement that became Communion and Liberation",
    year: 1954,
    precision: "year",
    era: "twentieth",
    kind: "order",
    location: "Milan",
    context:
      "Teaching religion at Milan's Berchet high school, the priest Luigi Giussani forms Gioventù Studentesca, a Catholic Action student group that presents Christianity as an event answering the questions of modern youth.",
    significance:
      "Re-formed after the upheavals of the late 1960s under the name Communion and Liberation, first used in 1969, it spread to some ninety countries, and its Fraternity was recognised by the Pontifical Council for the Laity on 11 February 1982.",
    citation: `${W}Communion_and_Liberation`,
  },
  {
    slug: "our-lady-of-caysasay-crowned",
    title: "Our Lady of Caysasay canonically crowned",
    year: 1954,
    date: "1954-12-08",
    precision: "day",
    era: "twentieth",
    kind: "event",
    tags: ["marian"],
    location: "Taal, Batangas, Philippines",
    context:
      "Under a decree of Pius XII, Cardinal Fernando Quiroga Palacios of Santiago de Compostela crowns Our Lady of Caysasay, a small wooden image of the Immaculate Conception that a fisherman drew from the Pansipit River in 1603.",
    significance:
      "The apparitions reported after its discovery, recorded by Spanish church authorities, are counted the first in the Philippines, and the image remains the patroness of Taal.",
    citation: `${W}Our_Lady_of_Caysasay`,
    links: { popes: ["pope-venerable-pius-xii"] },
  },
  {
    slug: "la-vang-raised-to-a-minor-basilica",
    title: "Our Lady of La Vang raised to a minor basilica",
    year: 1961,
    date: "1961-08-22",
    precision: "day",
    era: "twentieth",
    kind: "event",
    tags: ["marian"],
    location: "La Vang, Quảng Trị, Vietnam",
    context:
      "John XXIII raises the church of Our Lady of La Vang in central Vietnam to a minor basilica, months after the Vietnamese bishops made it their national Marian centre.",
    significance:
      "The shrine keeps the tradition that Mary appeared in 1798 to Catholics hiding in the forest from Emperor Cảnh Thịnh's persecution; the Holy See has never formally recognised the apparition, though John Paul II spoke of the shrine's importance in 1998.",
    citation: `${W}Our_Lady_of_La_Vang`,
    links: { popes: ["pope-saint-john-xxiii"] },
  },
  {
    slug: "veterum-sapientia",
    title: "Veterum sapientia on the study of Latin",
    year: 1962,
    date: "1962-02-22",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["education"],
    location: "St Peter's, Rome",
    context:
      "On the feast of the Chair of St Peter, John XXIII signs an apostolic constitution requiring that the principal sacred sciences be taught in Latin, from Latin textbooks, in seminaries and pontifical universities.",
    significance:
      "It also ordered an academic institute of Latinity to be founded, but the Second Vatican Council opened that October, and the Church's liturgy soon turned to the vernacular.",
    citation: `${V}john-xxiii/la/apost_constitutions/1962/documents/hf_j-xxiii_apc_19620222_veterum-sapientia.html`,
    links: { documentSlug: "veterum-sapientia", popes: ["pope-saint-john-xxiii"] },
  },
  {
    slug: "neocatechumenal-way-begins",
    title: "The Neocatechumenal Way begins in Madrid",
    year: 1964,
    precision: "year",
    era: "twentieth",
    kind: "order",
    location: "Palomeras Altas, Madrid",
    context:
      "Living among Roma and the poor of the Palomeras Altas shanty town in Madrid, the painter Kiko Argüello and Carmen Hernández form a small community following a catechumenal path for the already baptised, with the support of the archbishop of Madrid.",
    significance:
      "Spreading through parishes worldwide, with some 20,000 communities by 2007, the Way had its statutes definitively approved in 2008, though its distinctive liturgical practices have drawn criticism and Vatican scrutiny.",
    citation: `${W}Neocatechumenal_Way`,
  },
  // ---------------------------------------------------------------- Post-Conciliar Church
  {
    slug: "sant-egidio-founded",
    title: "Andrea Riccardi founds the Community of Sant'Egidio",
    year: 1968,
    precision: "year",
    era: "post-conciliar",
    kind: "order",
    tags: ["charity"],
    location: "Rome",
    context:
      "Just after the Council, the Roman schoolboy Andrea Riccardi gathers fellow students of the Virgil high school to live by the Gospel and teach poor children in the shacks of the city's periphery; in 1973 they settle at the former Carmelite convent of Sant'Egidio in Trastevere.",
    significance:
      "Recognised by the Holy See in 1986 as an international association of the faithful, the community prays the Church's evening prayer daily and mediated the 1992 peace agreement that ended Mozambique's sixteen-year civil war.",
    citation: `${W}Community_of_Sant%27Egidio`,
  },
  {
    slug: "paul-vi-shenouda-iii-common-declaration",
    title: "Paul VI and Shenouda III confess a common faith in Christ",
    year: 1973,
    date: "1973-05-10",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["schism"],
    location: "Rome",
    context:
      "Meeting in Rome, Paul VI and the Coptic Orthodox Pope Shenouda III of Alexandria sign a common declaration confessing Christ as perfect God and perfect man, the seven sacraments and Mary as the ever-virgin Theotokos, despite the divisions that followed the year 451.",
    significance:
      "They set up a joint commission to study the remaining differences and renounced proselytism between their Churches, a landmark in the Catholic Church's rapprochement with the Oriental Orthodox Churches.",
    citation: `${V}paul-vi/en/speeches/1973/may/documents/hf_p-vi_spe_19730510_dichiarazione-comune.html`,
    links: { popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "persona-humana",
    title: "Persona humana on sexual ethics",
    year: 1975,
    date: "1975-12-29",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Rome",
    context:
      "With Paul VI's approval, the Congregation for the Doctrine of the Faith restates that sexual intercourse has its moral rightness only within marriage, and rejects premarital relations, homosexual acts and masturbation as gravely contrary to the moral order.",
    significance:
      "Issued amid a spreading permissiveness, it upheld unchanging moral norms while asking that homosexual persons be treated with understanding in pastoral care and that culpability be judged with prudence.",
    citation: `${VC}cfaith/documents/rc_con_cfaith_doc_19751229_persona-humana_en.html`,
    links: { documentSlug: "persona-humana", popes: ["pope-saint-paul-vi"] },
  },
  {
    slug: "salvifici-doloris",
    title: "Salvifici doloris on the meaning of suffering",
    year: 1984,
    date: "1984-02-11",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Rome",
    context:
      "On the memorial of Our Lady of Lourdes, John Paul II issues an apostolic letter on the Christian meaning of human suffering, read in the light of Christ's Passion and Resurrection.",
    significance:
      "It teaches that those who suffer can share in Christ's redemptive suffering, and holds up the Good Samaritan as the model for a Church and a world called to care for the suffering.",
    citation: `${V}john-paul-ii/en/apost_letters/1984/documents/hf_jp-ii_apl_11021984_salvifici-doloris.html`,
    links: { documentSlug: "salvifici-doloris", popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "reconciliatio-et-paenitentia",
    title: "Reconciliatio et paenitentia on reconciliation and penance",
    year: 1984,
    date: "1984-12-02",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Rome",
    context:
      "After the 1983 Synod of Bishops on reconciliation and penance, held in the Holy Year of the Redemption, John Paul II issues an exhortation on sin, conversion and the Church's mission of reconciliation.",
    significance:
      "It treats both personal and 'social' sin, upholds the distinction between mortal and venial sin, and calls individual confession the ordinary way of reconciliation, keeping general absolution for exceptional cases.",
    citation: `${V}john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_02121984_reconciliatio-et-paenitentia.html`,
    links: { documentSlug: "reconciliatio-et-paenitentia", popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "slavorum-apostoli",
    title: "Slavorum apostoli honours Sts Cyril and Methodius",
    year: 1985,
    date: "1985-06-02",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["mission"],
    location: "Rome",
    context:
      "For the eleventh centenary of the death of St Methodius, John Paul II, the first Slav pope, devotes an encyclical to the brothers who evangelised the Slavs and gave them a liturgy in their own tongue.",
    significance:
      "Recalling that he had named them co-patrons of Europe in 1980, he held up Cyril and Methodius as models of inculturation and as a bridge between the Eastern and Western traditions of the one Church.",
    citation: `${V}john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_19850602_slavorum-apostoli.html`,
    links: { popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "christifideles-laici",
    title: "Christifideles laici on the lay faithful",
    year: 1988,
    date: "1988-12-30",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Rome",
    context:
      "Following the 1987 Synod of Bishops on the vocation and mission of the laity twenty years after Vatican II, John Paul II issues an exhortation built on the parable of the labourers sent into the vineyard.",
    significance:
      "It affirms that lay people share fully in the Church's communion and mission through baptism, and calls them to sanctify family, work, culture and political life from within, in keeping with their secular character.",
    citation: `${V}john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_30121988_christifideles-laici.html`,
    links: { documentSlug: "christifideles-laici", popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "vita-consecrata",
    title: "Vita consecrata on the consecrated life",
    year: 1996,
    date: "1996-03-25",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["monastic"],
    location: "Rome",
    context:
      "After a Synod of Bishops on the consecrated life, to which he had invited many religious men and women, John Paul II issues an exhortation on the vocation of those who follow Christ in chastity, poverty and obedience.",
    significance:
      "Taking the Transfiguration as its icon, it presents the consecrated life as a gift to the whole Church and calls religious to fidelity, communion and mission on the threshold of the new millennium.",
    citation: `${V}john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_25031996_vita-consecrata.html`,
    links: { documentSlug: "vita-consecrata", popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "beatification-of-cyprian-michael-tansi",
    title: "Cyprian Michael Tansi beatified in Nigeria",
    year: 1998,
    date: "1998-03-22",
    precision: "day",
    era: "post-conciliar",
    kind: "saint",
    location: "Oba, near Onitsha, Nigeria",
    context:
      "At Oba in Nigeria, John Paul II beatifies Cyprian Michael Iwene Tansi, an Igbo priest of the Onitsha archdiocese who became a Trappist monk at Mount St Bernard Abbey in England and died there in 1964.",
    significance:
      "He was the first West African to be beatified, and Cardinal Francis Arinze, whom he had taught, named him as an inspiration.",
    citation: `${W}Cyprian_Michael_Iwene_Tansi`,
    links: { popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "dies-domini",
    title: "Dies Domini on keeping Sunday holy",
    year: 1998,
    date: "1998-05-31",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["liturgy"],
    location: "Rome",
    context:
      "Dated on Pentecost, John Paul II's apostolic letter calls Catholics to rediscover Sunday as the day of the Lord, of Christ's Resurrection, of the Church gathered for the Eucharist, and of rest.",
    significance:
      "Written as the weekend eroded the Lord's Day, it insists on the obligation of Sunday Mass and asks believers to see that civil law protects Sunday rest.",
    citation: `${V}john-paul-ii/en/apost_letters/1998/documents/hf_jp-ii_apl_05071998_dies-domini.html`,
    links: { documentSlug: "dies-domini", popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "ecclesia-in-america",
    title: "Ecclesia in America signed in Mexico City",
    year: 1999,
    date: "1999-01-22",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["mission"],
    location: "Mexico City",
    context:
      "Visiting Mexico, John Paul II signs the exhortation that follows the 1997 Special Assembly for America of the Synod of Bishops, treating North, Central and South America as one continent called to a new evangelisation.",
    significance:
      "It presents encounter with the living Christ as the way to conversion, communion and solidarity, and asks that Our Lady of Guadalupe, Mother and Evangeliser of America, be honoured with a feast throughout the continent on 12 December.",
    citation: `${V}john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_22011999_ecclesia-in-america.html`,
    links: {
      documentSlug: "ecclesia-in-america",
      popes: ["pope-saint-john-paul-ii"],
      apparitions: ["apparition-our-lady-of-guadalupe"],
    },
  },
  {
    slug: "canonization-of-the-cristero-martyrs",
    title: "The martyrs of the Cristero War canonised",
    year: 2000,
    date: "2000-05-21",
    precision: "day",
    era: "post-conciliar",
    kind: "saint",
    tags: ["persecution"],
    location: "Rome",
    context:
      "John Paul II canonises 25 martyrs of Mexico's religious persecution of the 1920s, among them Cristóbal Magallanes and Toribio Romo, most of them priests executed for carrying on their ministry under the anticlerical laws.",
    significance:
      "Priests who had taken up arms were excluded from the cause; further Cristero-era martyrs were beatified in 2005, and the boy José Sánchez del Río was canonised in 2016.",
    citation: `${W}Saints_of_the_Cristero_War`,
    links: { popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "liturgiam-authenticam",
    title: "Liturgiam authenticam on liturgical translation",
    year: 2001,
    date: "2001-03-28",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["liturgy"],
    location: "Rome",
    context:
      "With John Paul II's approval, the Congregation for Divine Worship issues its fifth instruction implementing the Council's constitution on the liturgy, setting rules for translating the Latin liturgical books into the vernacular.",
    significance:
      "Taking effect on 25 April 2001, it required that the Latin originals be rendered integrally and as exactly as possible rather than paraphrased, setting the norms for new translations in every language.",
    citation: `${VC}ccdds/documents/rc_con_ccdds_doc_20010507_liturgiam-authenticam_en.html`,
    links: { documentSlug: "liturgiam-authenticam", popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "redemptionis-sacramentum",
    title: "Redemptionis sacramentum on the Eucharist",
    year: 2004,
    date: "2004-03-25",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["liturgy", "eucharist"],
    location: "Rome",
    context:
      "Prepared at John Paul II's mandate by the Congregation for Divine Worship with the Congregation for the Doctrine of the Faith, an instruction sets out what must be observed and avoided in celebrating and adoring the Eucharist.",
    significance:
      "Following up Ecclesia de Eucharistia, it names liturgical abuses, from unauthorised changes to the Mass to the misuse of extraordinary ministers, and affirms the faithful's right to a worthy celebration.",
    citation: `${VC}ccdds/documents/rc_con_ccdds_doc_20040423_redemptionis-sacramentum_en.html`,
    links: { documentSlug: "redemptionis-sacramentum", popes: ["pope-saint-john-paul-ii"] },
  },
  {
    slug: "sacramentum-caritatis",
    title: "Sacramentum caritatis on the Eucharist",
    year: 2007,
    date: "2007-02-22",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["eucharist"],
    location: "Rome",
    context:
      "Following the 2005 Synod of Bishops that crowned the Year of the Eucharist, Benedict XVI issues an exhortation on the Eucharist as a mystery to be believed, celebrated and lived.",
    significance:
      "It encourages eucharistic adoration, beauty and reverence in the liturgy and the use of Latin at international Masses, and ties Sunday worship to the moral and social life of Christians.",
    citation: `${V}benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20070222_sacramentum-caritatis.html`,
    links: { documentSlug: "sacramentum-caritatis", popes: ["pope-benedict-xvi"] },
  },
  {
    slug: "beatification-of-498-spanish-martyrs",
    title: "498 martyrs of the Spanish persecution beatified",
    year: 2007,
    date: "2007-10-28",
    precision: "day",
    era: "post-conciliar",
    kind: "saint",
    tags: ["persecution"],
    location: "Rome",
    context:
      "In Rome, 498 bishops, priests, religious and lay people killed in the anticlerical violence in Spain in the 1930s are beatified together, the largest beatification ceremony in the Church's history.",
    significance:
      "The causes left out the priests executed by the Nationalist side early in the war, a choice criticised in Spain; large beatifications of Spanish martyrs continued under Benedict XVI and Francis.",
    citation: `${W}Martyrs_of_the_Spanish_Civil_War`,
    links: { popes: ["pope-benedict-xvi"] },
  },
  {
    slug: "dignitas-personae",
    title: "Dignitas personae on bioethical questions",
    year: 2008,
    date: "2008-09-08",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Rome",
    context:
      "With Benedict XVI's approval, the Congregation for the Doctrine of the Faith issues an instruction on new bioethical questions, applying the principle that every human life must be respected from conception to natural death.",
    significance:
      "Updating Donum vitae of 1987, it judges in vitro fertilisation, the freezing and destruction of embryos, research on embryonic stem cells and human cloning to be morally unacceptable.",
    citation: `${VC}cfaith/documents/rc_con_cfaith_doc_20081208_dignitas-personae_en.html`,
    links: { documentSlug: "dignitas-personae", popes: ["pope-benedict-xvi"] },
  },
  {
    slug: "verbum-domini",
    title: "Verbum Domini on the word of God",
    year: 2010,
    date: "2010-09-30",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["scripture"],
    location: "Rome",
    context:
      "On the memorial of St Jerome, Benedict XVI issues his exhortation on the word of God in the life and mission of the Church, gathering the work of the 2008 Synod of Bishops.",
    significance:
      "Building on Dei Verbum, it urges biblical formation, lectio divina and better homilies, and calls for an interpretation of Scripture that unites historical study with faith.",
    citation: `${V}benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20100930_verbum-domini.html`,
    links: { documentSlug: "verbum-domini", popes: ["pope-benedict-xvi"] },
  },
  {
    slug: "africae-munus",
    title: "Africae munus signed at Ouidah",
    year: 2011,
    date: "2011-11-19",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["mission"],
    location: "Ouidah, Benin",
    context:
      "Visiting Benin, Benedict XVI signs the exhortation following the 2009 Second Special Assembly for Africa of the Synod of Bishops, on the Church in Africa at the service of reconciliation, justice and peace.",
    significance:
      "Calling the Church in Africa to be the salt of the earth and the light of the world, it asks it to heal divisions, defend the dignity of women and the poor, and carry the Gospel into the continent's cultures.",
    citation: `${V}benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20111119_africae-munus.html`,
    links: { documentSlug: "africae-munus", popes: ["pope-benedict-xvi"] },
  },
  {
    slug: "misericordiae-vultus",
    title: "Misericordiae vultus proclaims the Jubilee of Mercy",
    year: 2015,
    date: "2015-04-11",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Rome",
    context:
      "On the eve of Divine Mercy Sunday, Pope Francis issues the bull proclaiming an Extraordinary Jubilee of Mercy, to open on 8 December 2015, the fiftieth anniversary of the close of the Second Vatican Council.",
    significance:
      "Calling mercy the very foundation of the Church's life, it announced Missionaries of Mercy empowered to pardon even sins reserved to the Holy See and asked every diocese to open its own Door of Mercy.",
    citation: `${V}francesco/en/bulls/documents/papa-francesco_bolla_20150411_misericordiae-vultus.html`,
    links: { documentSlug: "misericordiae-vultus", popes: ["pope-francis"] },
  },
  {
    slug: "christus-vivit",
    title: "Christus vivit, to young people",
    year: 2019,
    date: "2019-03-25",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Loreto",
    context:
      "At the shrine of the Holy House in Loreto, Pope Francis signs an exhortation to young people and to the whole People of God, following the 2018 Synod of Bishops on young people, faith and vocational discernment.",
    significance:
      "Opening with the cry 'Christ is alive!', it urges the young to bring their energy to the Church and asks the Church to listen to them and accompany their discernment.",
    citation: `${V}francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20190325_christus-vivit.html`,
    links: { documentSlug: "christus-vivit", popes: ["pope-francis"] },
  },
  {
    slug: "admirabile-signum",
    title: "Admirabile signum on the Christmas crib",
    year: 2019,
    date: "2019-12-01",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Greccio",
    context:
      "Signing it at Greccio, where St Francis set up his living Christmas crib in 1223, Pope Francis writes an apostolic letter on the meaning and value of the nativity scene.",
    significance:
      "He encouraged the custom of setting up cribs in homes, schools, workplaces, hospitals, prisons and town squares as a simple and eloquent way of passing on the faith.",
    citation: `${V}francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20191201_admirabile-signum.html`,
    links: {
      documentSlug: "admirabile-signum",
      popes: ["pope-francis"],
      saints: ["saint-francis-of-assisi"],
    },
  },
  {
    slug: "patris-corde",
    title: "Patris corde on St Joseph",
    year: 2020,
    date: "2020-12-08",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    location: "Rome",
    context:
      "On the 150th anniversary of Pius IX's proclamation of St Joseph as Patron of the Universal Church, Pope Francis issues an apostolic letter written 'with a father's heart'.",
    significance:
      "Shaped by the pandemic's hidden, everyday heroes, it portrays Joseph as a beloved, tender, obedient, accepting, creatively courageous and working father who lived in the shadows.",
    citation: `${V}francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20201208_patris-corde.html`,
    links: { documentSlug: "patris-corde", popes: ["pope-francis"], saints: ["saint-joseph"] },
  },
  {
    slug: "desiderio-desideravi",
    title: "Desiderio desideravi on liturgical formation",
    year: 2022,
    date: "2022-06-29",
    precision: "day",
    era: "post-conciliar",
    kind: "document",
    tags: ["liturgy"],
    location: "Rome",
    context:
      "A year after Traditionis custodes, Pope Francis writes to the whole People of God on the liturgical formation of the faithful and the beauty of the Church's worship.",
    significance:
      "Rooted in Christ's longing to eat the Passover with his disciples, it calls for renewed wonder at the liturgy and affirms the liturgical reform of Vatican II as the Church's path.",
    citation: `${V}francesco/en/apost_letters/documents/20220629-lettera-ap-desiderio-desideravi.html`,
    links: { documentSlug: "desiderio-desideravi", popes: ["pope-francis"] },
  },
  {
    slug: "coptic-martyrs-of-libya-enter-the-roman-martyrology",
    title: "The 21 Coptic martyrs of Libya enter the Roman Martyrology",
    year: 2023,
    date: "2023-05-11",
    precision: "day",
    era: "post-conciliar",
    kind: "saint",
    tags: ["persecution"],
    location: "Vatican",
    context:
      "Receiving the Coptic Orthodox Pope Tawadros II on the fiftieth anniversary of the 1973 Catholic–Coptic declaration, Pope Francis announces that the 21 Christian construction workers beheaded by the Islamic State near Sirte, Libya, in February 2015 will be included in the Roman Martyrology.",
    significance:
      "Twenty Egyptians and a Ghanaian whom Tawadros had canonised a week after their deaths, they were added in what was hailed as a major ecumenical step, a sign, Francis said, of the spiritual communion uniting the two Churches.",
    citation: `${W}21_Coptic_Christian_Martyrs_of_Libya`,
    links: { popes: ["pope-francis"] },
  },
  {
    slug: "canonization-of-the-martyrs-of-damascus",
    title: "The Martyrs of Damascus canonised",
    year: 2024,
    date: "2024-10-20",
    precision: "day",
    era: "post-conciliar",
    kind: "saint",
    tags: ["persecution"],
    location: "St Peter's Square",
    context:
      "Pope Francis canonises the eleven Martyrs of Damascus: eight Franciscans, seven Spaniards and an Austrian, led by their guardian Manuel Ruiz López, and the three Maronite brothers Francis, Mooti and Raphael Massabki.",
    significance:
      "They were killed by Druze attackers in the night of 9–10 July 1860, Francis Massabki after refusing an offer of his life if he became a Muslim, and had been beatified by Pius XI in 1926.",
    citation: `${W}Martyrs_of_Damascus`,
    links: { popes: ["pope-francis"] },
  },
  {
    slug: "canonization-of-the-martyrs-of-compiegne",
    title: "The Carmelite Martyrs of Compiègne canonised",
    year: 2024,
    date: "2024-12-18",
    precision: "day",
    era: "post-conciliar",
    kind: "saint",
    tags: ["persecution"],
    location: "Vatican",
    context:
      "Pope Francis declares the sixteen Discalced Carmelites of Compiègne, guillotined in Paris in July 1794, saints of the universal Church by equipollent canonisation, without the usual approved miracle.",
    significance:
      "Beatified by Pius X in 1906 as the first martyrs of the French Revolution recognised by the Holy See, they had inspired Gertrud von le Fort's novella, Bernanos's Dialogues des carmélites and Poulenc's opera.",
    citation: `${W}Martyrs_of_Compiègne`,
    links: { popes: ["pope-francis"] },
  },
];
