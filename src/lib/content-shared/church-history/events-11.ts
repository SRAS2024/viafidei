import type { ChurchHistoryEvent } from "./types";

const W = "https://en.wikipedia.org/wiki/";
const V = "https://www.vatican.va/content/";

/**
 * Church-history spine, part 11: the contemporary Church in detail, from the
 * death of Pius X in the first weeks of the Great War (1914) to the present —
 * the Twentieth Century and Post-Conciliar eras. It fills in around the
 * landmarks already in part 4 (Fatima, the Lateran Treaty, Vatican II, the
 * elections and deaths of popes) without repeating them.
 *
 * Events that share a slug with a published CHURCH_DOCUMENT are enriched by
 * it on the timeline instead of appearing twice; `documentSlug` is set where
 * the document is part of the curated knowledge base.
 */
export const EVENTS_11: ChurchHistoryEvent[] = [
  // ---------------------------------------------------------------- Benedict XV and the Great War
  {
    slug: "death-of-pius-x",
    title: "Death of St Pius X",
    year: 1914,
    date: "1914-08-20",
    precision: "day",
    era: "twentieth",
    kind: "pope",
    tags: ["papacy"],
    location: "Apostolic Palace, Rome",
    context:
      "Pius X dies at seventy-nine in the first weeks of the First World War, after eleven years as pope.",
    significance:
      "The conclave that follows must choose a pope for a Church whose faithful are fighting on both sides of the war.",
    citation: `${W}Pope_Pius_X`,
    links: { popes: ["pope-saint-pius-x"], saints: ["saint-pope-pius-x"] },
  },
  {
    slug: "election-of-benedict-xv",
    title: "Benedict XV elected",
    year: 1914,
    date: "1914-09-03",
    precision: "day",
    era: "twentieth",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "Giacomo della Chiesa, Archbishop of Bologna and a cardinal for only three months, is elected as the war spreads across Europe.",
    significance:
      "The cardinals choose an experienced diplomat; when his peace efforts fail he turns the Holy See to relief for prisoners of war and the wounded.",
    citation: `${W}Pope_Benedict_XV`,
    links: { popes: ["pope-benedict-xv"] },
  },
  {
    slug: "ad-beatissimi-apostolorum",
    title: "Ad beatissimi Apostolorum: an appeal for peace",
    year: 1914,
    date: "1914-11-01",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "In his first encyclical, dated on All Saints' Day, Benedict XV mourns the carnage of the war and pleads for peace among the nations.",
    significance:
      'He renews the condemnation of Modernism yet asks Catholics to stop branding one another with party labels: "Christian is my name and Catholic my surname."',
    citation: `${V}benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_01111914_ad-beatissimi-apostolorum.html`,
    links: { popes: ["pope-benedict-xv"] },
  },
  {
    slug: "martyrdom-of-ignatius-maloyan",
    title: "St Ignatius Maloyan martyred",
    year: 1915,
    date: "1915-06-11",
    precision: "day",
    era: "twentieth",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Near Mardin",
    context:
      "The Armenian Catholic Archbishop of Mardin is tortured and killed by Ottoman forces during the Armenian genocide after refusing again and again to convert to Islam.",
    significance:
      "A witness for the many Christians killed in the genocide; he is beatified in 2001 and canonised in 2025.",
    citation: `${W}Ignatius_Maloyan`,
  },
  {
    slug: "padre-pio-receives-the-stigmata",
    title: "Padre Pio receives the stigmata",
    year: 1918,
    date: "1918-09-20",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    location: "San Giovanni Rotondo",
    context:
      "Wounds like those of the crucified Christ appear on the hands, feet and side of the Capuchin friar, who bears them for fifty years.",
    significance:
      "Investigated and for a time restricted by the Holy Office, he becomes one of the century's most sought-after confessors and is canonised in 2002.",
    citation: `${W}Padre_Pio`,
    links: { saints: ["saint-padre-pio"] },
  },
  {
    // No documentSlug: the letter is published as its own page (not curated),
    // and the merge enriches this event by its own slug.
    slug: "maximum-illud",
    title: "Maximum illud: on the missions",
    year: 1919,
    date: "1919-11-30",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["mission"],
    location: "Rome",
    context:
      "Benedict XV's apostolic letter tells missionaries to serve the Gospel rather than the interests of their home countries and to form a well-trained native clergy.",
    significance:
      "It turns the missions toward local churches led by their own priests and bishops.",
    citation: `${V}benedict-xv/en/apost_letters/documents/hf_ben-xv_apl_19191130_maximum-illud.html`,
    links: { popes: ["pope-benedict-xv"] },
  },
  {
    slug: "canonization-of-margaret-mary-alacoque",
    title: "St Margaret Mary Alacoque canonised",
    year: 1920,
    date: "1920-05-13",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    location: "Rome",
    context:
      "Benedict XV canonises the Visitation nun of Paray-le-Monial whose visions of Christ between 1673 and 1675 spread devotion to the Sacred Heart.",
    significance:
      "Confirms the place of the Sacred Heart devotion in the life of the whole Church, three days before Joan of Arc is canonised.",
    citation: `${W}Margaret_Mary_Alacoque`,
    links: {
      saints: ["saint-margaret-mary-alacoque"],
      apparitions: ["apparition-sacred-heart-paray-le-monial"],
    },
  },
  {
    slug: "canonization-of-joan-of-arc",
    title: "St Joan of Arc canonised",
    year: 1920,
    date: "1920-05-16",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    location: "Rome",
    context:
      "Nearly five centuries after she was burned at Rouen, Benedict XV canonises the Maid of Orléans.",
    significance: "Two years later Pius XI names her one of the patron saints of France.",
    citation: `${W}Joan_of_Arc`,
    links: { saints: ["saint-joan-of-arc"] },
  },
  {
    slug: "ephrem-declared-doctor-of-the-church",
    title: "St Ephrem the Syrian declared a Doctor of the Church",
    year: 1920,
    date: "1920-10-05",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    tags: ["doctor"],
    location: "Rome",
    context:
      "In the encyclical Principi Apostolorum Petro, Benedict XV confers the title of Doctor of the Universal Church on the fourth-century deacon of Edessa.",
    significance:
      "Honours the hymn-writer long called the Doctor of the Syrians, and with him the Syriac Christian tradition.",
    citation: `${V}benedict-xv/en/encyclicals/documents/hf_ben-xv_enc_05101920_principi-apostolorum-petro.html`,
    links: { doctors: ["doctor-ephrem-the-syrian"], popes: ["pope-benedict-xv"] },
  },
  {
    slug: "legion-of-mary-founded",
    title: "Legion of Mary founded",
    year: 1921,
    date: "1921-09-07",
    precision: "day",
    era: "twentieth",
    kind: "order",
    tags: ["marian"],
    location: "Dublin",
    context:
      "Frank Duff, a layman and civil servant, founds the Legion of Mary, an association of lay Catholics devoted to prayer and apostolic service under Mary's patronage.",
    significance:
      "It grows into the largest lay apostolic organisation in the world, with more than ten million active and auxiliary members.",
    citation: `${W}Legion_of_Mary`,
  },
  {
    slug: "election-of-pius-xi",
    title: "Pius XI elected",
    year: 1922,
    date: "1922-02-06",
    precision: "day",
    era: "twentieth",
    kind: "pope",
    tags: ["papacy"],
    location: "Rome",
    context:
      "After Benedict XV's death on 22 January, Achille Ratti — scholar-librarian, former nuncio to Poland and Archbishop of Milan — is elected on the fourteenth ballot.",
    significance:
      "His first act is to bless the crowd from the outer balcony of St Peter's, a custom abandoned since the loss of Rome in 1870.",
    citation: `${W}Pope_Pius_XI`,
    links: { popes: ["pope-pius-xi", "pope-benedict-xv"] },
  },
  {
    slug: "ubi-arcano-dei-consilio",
    title: "Ubi arcano: the peace of Christ in the Kingdom of Christ",
    year: 1922,
    date: "1922-12-23",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "Pius XI's first encyclical traces the unrest of the post-war world to society's rejection of God and offers the peace of Christ in the Kingdom of Christ as the remedy.",
    significance:
      "It sets the programme of his pontificate, including the growth of Catholic Action among the laity.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_19221223_ubi-arcano-dei-consilio.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "moscow-trial-of-catholic-clergy",
    title: "Moscow show trial of Catholic clergy",
    year: 1923,
    precision: "year",
    era: "twentieth",
    kind: "event",
    tags: ["persecution"],
    location: "Moscow",
    context:
      "Archbishop Jan Cieplak, his vicar general Konstantin Budkevich, the Byzantine Catholic exarch Leonid Feodorov and other priests are tried by the Soviet state; Cieplak and Budkevich are sentenced to death.",
    significance:
      "Cieplak's sentence is commuted after protests around the world, but Budkevich is shot on Easter Sunday — part of a campaign to root out organised Catholicism.",
    citation: `${W}Jan_Cieplak`,
  },
  {
    slug: "canonization-of-therese-of-lisieux",
    title: "St Thérèse of Lisieux canonised",
    year: 1925,
    date: "1925-05-17",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    location: "Rome",
    context:
      "During the Holy Year, Pius XI canonises the Carmelite of Lisieux only twenty-eight years after her death.",
    significance:
      'Her "Little Way" of trust and love makes her one of the most popular saints of the twentieth century.',
    citation: `${W}Thérèse_of_Lisieux`,
    links: { saints: ["saint-therese-of-lisieux"], popes: ["pope-pius-xi"] },
  },
  {
    slug: "canonization-of-peter-canisius",
    title: "St Peter Canisius canonised and declared a Doctor",
    year: 1925,
    date: "1925-05-21",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    tags: ["doctor"],
    location: "Rome",
    context:
      "Pius XI canonises the Jesuit known as the second Apostle of Germany and on the same day declares him a Doctor of the Church.",
    significance:
      "Honours the preacher whose German Catechism set out the Catholic faith for readers after the Reformation.",
    citation: `${W}Peter_Canisius`,
    links: { doctors: ["doctor-peter-canisius"] },
  },
  {
    slug: "canonization-of-john-vianney",
    title: "St John Vianney canonised",
    year: 1925,
    date: "1925-05-31",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    location: "Rome",
    context:
      "Pius XI canonises the Curé d'Ars, who spent up to sixteen hours a day in the confessional as pilgrims flocked to his village parish.",
    significance: "In 1929 Pius XI names him patron saint of parish priests.",
    citation: `${W}John_Vianney`,
    links: { saints: ["saint-john-vianney"] },
  },
  {
    slug: "quas-primas",
    title: "Quas primas: the feast of Christ the King",
    year: 1925,
    date: "1925-12-11",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "As the Holy Year draws to a close, Pius XI institutes an annual feast of the Kingship of Christ.",
    significance:
      "He offers Christ's reign over individuals, families and nations as the remedy for the anticlericalism of the age.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_11121925_quas-primas.html`,
    links: { documentSlug: "quas-primas", popes: ["pope-pius-xi"] },
  },
  {
    slug: "john-of-the-cross-declared-doctor-of-the-church",
    title: "St John of the Cross declared a Doctor of the Church",
    year: 1926,
    precision: "year",
    era: "twentieth",
    kind: "saint",
    tags: ["doctor"],
    location: "Rome",
    context:
      "Pius XI declares the sixteenth-century Carmelite reformer and poet a Doctor of the Church.",
    significance:
      "Known as the Mystical Doctor, he shapes Catholic teaching on prayer and the dark nights of the soul.",
    citation: `${W}John_of_the_Cross`,
    links: { doctors: ["doctor-john-of-the-cross"], saints: ["saint-john-of-the-cross"] },
  },
  {
    slug: "first-chinese-bishops-of-modern-times",
    title: "First Chinese bishops of modern times consecrated",
    year: 1926,
    precision: "year",
    era: "twentieth",
    kind: "mission",
    tags: ["mission"],
    location: "Rome",
    context:
      "Six Chinese priests are consecrated bishops in Rome, the first Chinese Catholic bishops of modern times.",
    significance:
      "The Holy See presents the consecrations as a milestone in giving the Church in China its own shepherds, as Maximum illud had urged.",
    citation: `${W}Catholic_Church_in_China`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "martyrdom-of-miguel-pro",
    title: "Blessed Miguel Pro executed",
    year: 1927,
    date: "1927-11-23",
    precision: "day",
    era: "twentieth",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Mexico City",
    context:
      "The Jesuit priest, who had celebrated Mass in secret during the Calles persecution, is shot by firing squad without trial on false charges of an assassination plot.",
    significance:
      "Beatified in 1988 as a martyr killed in hatred of the faith, he becomes an emblem of the Cristero years.",
    citation: `${W}Miguel_Pro`,
  },
  {
    slug: "mortalium-animos",
    title: "Mortalium animos: on religious unity",
    year: 1928,
    date: "1928-01-06",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["schism"],
    location: "Rome",
    context:
      "Pius XI forbids Catholics to take part in the new interdenominational unity conferences, teaching that Christian unity can come only through return to the one Church of Christ.",
    significance:
      "It fixes the Catholic Church's reserved stance toward the early ecumenical movement for a generation.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_19280106_mortalium-animos.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "casti-connubii",
    title: "Casti connubii: on Christian marriage",
    year: 1930,
    date: "1930-12-31",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "Pius XI reaffirms the unity, indissolubility and sacramental dignity of marriage and condemns contraception, abortion and divorce.",
    significance:
      "A foundational modern statement of Catholic teaching on marriage and the transmission of life.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_19301231_casti-connubii.html`,
    links: { documentSlug: "casti-connubii", popes: ["pope-pius-xi"] },
  },
  {
    slug: "vatican-radio-inaugurated",
    title: "Vatican Radio goes on the air",
    year: 1931,
    date: "1931-02-12",
    precision: "day",
    era: "twentieth",
    kind: "event",
    location: "Vatican City",
    context:
      "The station built by Guglielmo Marconi begins broadcasting with a radio message from Pius XI addressed to every creature, Omni creaturae.",
    significance:
      "The pope can now speak directly to the whole world; the service broadcasts today in more than forty languages.",
    citation: `${W}Vatican_Radio`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "divine-mercy-vision-at-plock",
    title: "St Faustina's vision of the Divine Mercy",
    year: 1931,
    date: "1931-02-22",
    precision: "day",
    era: "twentieth",
    kind: "apparition",
    location: "Płock",
    context:
      'In her convent cell, Sister Faustina Kowalska reports a vision of Jesus robed in white, with red and pale rays streaming from his heart, beneath the words "Jesus, I trust in you."',
    significance:
      "The origin of the Divine Mercy image, venerated worldwide and used in the celebration of Divine Mercy Sunday.",
    citation: `${W}Divine_Mercy_image`,
    links: {
      apparitions: ["apparition-divine-mercy-saint-faustina"],
      saints: ["saint-faustina-kowalska"],
    },
  },
  {
    slug: "quadragesimo-anno",
    title: "Quadragesimo anno",
    year: 1931,
    date: "1931-05-15",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "On the fortieth anniversary of Rerum novarum, Pius XI calls for the reconstruction of the social order, criticising both concentrated economic power and socialism.",
    significance:
      "It gives Catholic social teaching the principle of subsidiarity: larger bodies should not absorb what smaller communities can do for themselves.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_19310515_quadragesimo-anno.html`,
    links: { documentSlug: "quadragesimo-anno", popes: ["pope-pius-xi"] },
  },
  {
    slug: "non-abbiamo-bisogno",
    title: "Non abbiamo bisogno",
    year: 1931,
    date: "1931-06-29",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "Pius XI protests the Fascist regime's attacks on Catholic Action and its resolve to monopolise the formation of the young for a single party.",
    significance:
      "A direct papal challenge to the totalitarian claims of Mussolini's state over the family and the Church.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_29061931_non-abbiamo-bisogno.html`,
    links: { popes: ["pope-pius-xi"] },
  },
  {
    slug: "robert-bellarmine-declared-doctor-of-the-church",
    title: "St Robert Bellarmine declared a Doctor of the Church",
    year: 1931,
    precision: "year",
    era: "twentieth",
    kind: "saint",
    tags: ["doctor"],
    location: "Rome",
    context:
      "A year after canonising him, Pius XI declares the Jesuit cardinal and theologian a Doctor of the Church.",
    significance: "Honours one of the most important theologians of the Catholic Reformation.",
    citation: `${W}Robert_Bellarmine`,
    links: { doctors: ["doctor-robert-bellarmine"] },
  },
  {
    slug: "albert-the-great-declared-doctor-of-the-church",
    title: "St Albert the Great canonised and declared a Doctor",
    year: 1931,
    date: "1931-12-16",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    tags: ["doctor"],
    location: "Rome",
    context:
      "Pius XI canonises the thirteenth-century Dominican bishop and teacher of Thomas Aquinas and proclaims him a Doctor of the Church.",
    significance:
      "In 1941 Pius XII names him patron of natural scientists, honouring his study of the natural world.",
    citation: `${W}Albertus_Magnus`,
    links: { doctors: ["doctor-albert-the-great"] },
  },
  {
    slug: "our-lady-of-beauraing",
    title: "Our Lady of Beauraing",
    year: 1932,
    date: "1932-11-29",
    precision: "day",
    era: "twentieth",
    kind: "apparition",
    tags: ["marian"],
    location: "Beauraing, Belgium",
    context:
      "Five children report the first of thirty-three apparitions of the Virgin, later called the Virgin of the Golden Heart, which continue until 3 January 1933.",
    significance:
      "The Bishop of Namur approves the apparitions in 1949, and Beauraing becomes a place of pilgrimage.",
    citation: `${W}Our_Lady_of_Beauraing`,
    links: { apparitions: ["apparition-our-lady-of-beauraing"] },
  },
  {
    slug: "our-lady-of-banneux",
    title: "Our Lady of Banneux",
    year: 1933,
    date: "1933-01-15",
    precision: "day",
    era: "twentieth",
    kind: "apparition",
    tags: ["marian"],
    location: "Banneux, Belgium",
    context:
      "Mariette Beco, a young girl of the village, reports the first of eight apparitions of a Lady in white who calls herself the Virgin of the Poor.",
    significance:
      'Her words "I come to relieve suffering" make Banneux a shrine for the sick; the Bishop of Liège approves the apparitions in 1949.',
    citation: `${W}Our_Lady_of_Banneux`,
    links: { apparitions: ["apparition-our-lady-of-banneux"] },
  },
  {
    slug: "catholic-worker-movement-founded",
    title: "Catholic Worker movement founded",
    year: 1933,
    date: "1933-05-01",
    precision: "day",
    era: "twentieth",
    kind: "event",
    location: "New York",
    context:
      "Dorothy Day and Peter Maurin launch the Catholic Worker, a newspaper sold for a penny that grows into a movement of houses of hospitality.",
    significance:
      "It joins the works of mercy, voluntary poverty and nonviolence; its communities still serve the poor today.",
    citation: `${W}Catholic_Worker_Movement`,
  },
  {
    slug: "reichskonkordat",
    title: "Reichskonkordat signed with Germany",
    year: 1933,
    date: "1933-07-20",
    precision: "day",
    era: "twentieth",
    kind: "event",
    location: "Rome",
    context:
      "Cardinal Secretary of State Eugenio Pacelli and Vice-Chancellor Franz von Papen sign a concordat between the Holy See and the new National Socialist government.",
    significance:
      "Meant to protect the Church's freedom, it is violated by the regime almost as soon as it is signed — breaches Pius XI denounces in Mit brennender Sorge.",
    citation: `${W}Reichskonkordat`,
    links: { popes: ["pope-pius-xi", "pope-venerable-pius-xii"] },
  },
  {
    slug: "canonization-of-bernadette-soubirous",
    title: "St Bernadette Soubirous canonised",
    year: 1933,
    date: "1933-12-08",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    tags: ["marian"],
    location: "Rome",
    context:
      "On the feast of the Immaculate Conception, Pius XI canonises the visionary of Lourdes, who had died a Sister of Charity at Nevers in 1879.",
    significance:
      "Honours the humble witness through whom Lourdes became one of the great places of pilgrimage in the world.",
    citation: `${W}Bernadette_Soubirous`,
    links: {
      saints: ["saint-bernadette-soubirous"],
      apparitions: ["apparition-our-lady-of-lourdes"],
    },
  },
  {
    slug: "canonization-of-john-bosco",
    title: "St John Bosco canonised",
    year: 1934,
    date: "1934-04-01",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    location: "Rome",
    context:
      "On Easter Sunday, Pius XI — who had known him personally — canonises the founder of the Salesians.",
    significance:
      "Hailed as Father and Teacher of Youth, his preventive system of education inspires Salesian schools worldwide.",
    citation: `${W}John_Bosco`,
    links: { saints: ["saint-john-bosco"], popes: ["pope-pius-xi"] },
  },
  {
    slug: "canonization-of-thomas-more-and-john-fisher",
    title: "Sts Thomas More and John Fisher canonised",
    year: 1935,
    date: "1935-05-19",
    precision: "day",
    era: "twentieth",
    kind: "saint",
    location: "Rome",
    context:
      "Four centuries after their execution under Henry VIII, Pius XI canonises the former Lord Chancellor and the Bishop of Rochester as martyrs.",
    significance: "In 2000 John Paul II names More patron of statesmen and politicians.",
    citation: `${W}Thomas_More`,
    links: { saints: ["saint-thomas-more", "saint-john-fisher"] },
  },
  {
    slug: "martyrs-of-the-spanish-civil-war",
    title: "Martyrs of the Spanish Civil War",
    year: 1936,
    precision: "year",
    era: "twentieth",
    kind: "martyrdom",
    tags: ["persecution"],
    location: "Spain",
    context:
      "After the military uprising of July 1936, anticlerical violence in the Republican zone kills some 6,800 clergy and religious, among them 13 bishops and 283 nuns, most in the first months of the war.",
    significance:
      "Terror was committed on both sides of the war; the Church has since beatified hundreds of these martyrs, 498 of them in a single ceremony in 2007.",
    citation: `${W}Red_Terror_(Spain)`,
  },
  {
    slug: "mit-brennender-sorge",
    title: "Mit brennender Sorge",
    year: 1937,
    date: "1937-03-14",
    precision: "day",
    era: "twentieth",
    kind: "document",
    tags: ["persecution"],
    location: "Rome",
    context:
      "Pius XI's encyclical, written in German and smuggled into the Reich, condemns the regime's breaches of the concordat and the idolatry of race and state; it is read from Catholic pulpits on Palm Sunday, 21 March.",
    significance: "The regime answers with an intensified persecution of the Church in Germany.",
    citation: `${W}Mit_brennender_Sorge`,
    links: { documentSlug: "mit-brennender-sorge", popes: ["pope-pius-xi"] },
  },
  {
    slug: "divini-redemptoris",
    title: "Divini Redemptoris: on atheistic Communism",
    year: 1937,
    date: "1937-03-19",
    precision: "day",
    era: "twentieth",
    kind: "document",
    location: "Rome",
    context:
      "Five days after Mit brennender Sorge, Pius XI condemns atheistic Communism, protesting the persecutions in Russia, Mexico and Spain.",
    significance:
      "Together the two encyclicals set the Church against both great totalitarian ideologies of the age.",
    citation: `${V}pius-xi/en/encyclicals/documents/hf_p-xi_enc_19370319_divini-redemptoris.html`,
    links: { documentSlug: "divini-redemptoris", popes: ["pope-pius-xi"] },
  },
];
