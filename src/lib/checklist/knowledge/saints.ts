import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const NEWADVENT = "https://www.newadvent.org/cathen/";

function saint(
  slug: string,
  canonicalName: string,
  feastDay: string,
  saintType:
    | "martyr"
    | "doctor_of_the_church"
    | "virgin"
    | "confessor"
    | "religious"
    | "lay"
    | "bishop"
    | "pope"
    | "apostle"
    | "evangelist"
    | "founder"
    | "missionary"
    | "other",
  canonizationStatus: "canonized" | "beatified" | "venerable" | "servant_of_god",
  patronages: string[],
  biography: string,
): CuratedEntry {
  const [mm, dd] = feastDay.split("-").map((s) => parseInt(s, 10));
  return {
    contentType: "SAINT",
    slug,
    authorityLevel: "VATICAN",
    citations: [VATICAN, NEWADVENT],
    payload: {
      slug,
      canonicalName,
      feastDay,
      feastMonth: mm,
      feastDayOfMonth: dd,
      patronages,
      biography,
      saintType,
      canonizationStatus,
      relatedPrayers: [],
      relatedDevotions: [],
      citations: [VATICAN, NEWADVENT],
    },
  };
}

export const saintKnowledge: CuratedEntry[] = [
  saint(
    "saint-joseph",
    "Saint Joseph",
    "03-19",
    "confessor",
    "canonized",
    ["the universal Church", "workers", "fathers", "a happy death"],
    "Saint Joseph was the foster father of Jesus Christ and the chaste spouse of the Blessed Virgin Mary. A descendant of King David, he was a carpenter in Nazareth. The Gospels of Matthew and Luke record his obedience to the angel's messages and his protective care of the Holy Family. Pope Pius IX declared him patron of the universal Church in 1870. Pope Pius XII established the feast of St. Joseph the Worker on May 1 in 1955. Pope Francis added his name to all the Eucharistic Prayers of the Roman Missal in 2013.",
  ),
  saint(
    "saint-peter",
    "Saint Peter the Apostle",
    "06-29",
    "apostle",
    "canonized",
    ["the papacy", "fishermen", "Rome"],
    "Simon Peter was the brother of Andrew, a fisherman of Bethsaida. Jesus called him to be the first of the Twelve Apostles and renamed him Peter (Cephas, 'rock'), telling him: 'Upon this rock I will build my Church' (Matthew 16:18). After Pentecost he led the apostolic community, was the first bishop of Rome, and was martyred there during the persecution of Nero around AD 64. His tomb lies beneath the high altar of St. Peter's Basilica.",
  ),
  saint(
    "saint-paul",
    "Saint Paul the Apostle",
    "06-29",
    "apostle",
    "canonized",
    ["missionaries", "evangelists", "writers"],
    "Saul of Tarsus, a Pharisee and persecutor of the early Church, was converted on the road to Damascus by a vision of the risen Christ (Acts 9). Taking the name Paul, he became the Apostle to the Gentiles, founding churches throughout the eastern Mediterranean and writing the letters that form a large part of the New Testament. He was martyred in Rome around AD 67.",
  ),
  saint(
    "saint-john-the-baptist",
    "Saint John the Baptist",
    "06-24",
    "martyr",
    "canonized",
    ["converts", "monastic life", "Canada"],
    "Saint John the Baptist was the prophet of the Most High, kinsman of the Lord Jesus, and the immediate precursor of the Messiah. Born of Zechariah and Elizabeth, he preached repentance in the wilderness of Judea and baptized Jesus in the Jordan. Imprisoned and beheaded by Herod Antipas, Jesus said of him: 'Among those born of women there has risen no one greater than John the Baptist' (Matthew 11:11).",
  ),
  saint(
    "saint-mary-magdalene",
    "Saint Mary Magdalene",
    "07-22",
    "other",
    "canonized",
    ["converts", "penitents", "contemplative life"],
    "Saint Mary Magdalene, from whom the Lord cast out seven demons (Luke 8:2), followed Jesus and his disciples, stood beneath the Cross, and was the first witness of the Resurrection on Easter morning (John 20). The Church Fathers honor her as 'Apostle to the Apostles' for bringing the news of the risen Lord to the Twelve. Pope Francis raised her commemoration to the dignity of a feast in 2016.",
  ),
  saint(
    "saint-augustine-of-hippo",
    "Saint Augustine of Hippo",
    "08-28",
    "doctor_of_the_church",
    "canonized",
    ["theologians", "printers", "brewers"],
    "Saint Augustine (354-430) was bishop of Hippo Regius in Roman North Africa and one of the most important Latin Fathers of the Church. Born to St. Monica, he converted after years of intellectual searching, baptized by St. Ambrose in 387. His Confessions, City of God, and treatises on grace and the Trinity shaped Western Christian theology for the next 1600 years. Declared a Doctor of the Church.",
  ),
  saint(
    "saint-thomas-aquinas",
    "Saint Thomas Aquinas",
    "01-28",
    "doctor_of_the_church",
    "canonized",
    ["students", "universities", "philosophers", "Catholic schools"],
    "Saint Thomas Aquinas (1225-1274), a Dominican friar, was the greatest theologian of the High Middle Ages. His Summa Theologiae remains the most comprehensive synthesis of Christian doctrine. Pope Leo XIII (Aeterni Patris, 1879) made his thought normative for Catholic philosophy and theology. He is honored as the Angelic Doctor.",
  ),
  saint(
    "saint-francis-of-assisi",
    "Saint Francis of Assisi",
    "10-04",
    "founder",
    "canonized",
    ["Italy", "animals", "ecology", "merchants"],
    "Saint Francis of Assisi (1181/82-1226) founded the Order of Friars Minor (the Franciscans) after a dramatic conversion from the life of a wealthy merchant's son. Marked by literal imitation of the Gospel, embrace of holy poverty, devotion to the Eucharist and Mary, and tenderness toward all creation, he received the stigmata at La Verna in 1224 — the first recorded stigmatic in the Church.",
  ),
  saint(
    "saint-therese-of-lisieux",
    "Saint Therese of Lisieux",
    "10-01",
    "doctor_of_the_church",
    "canonized",
    ["missions", "florists", "France", "AIDS sufferers"],
    "Saint Therese of the Child Jesus and the Holy Face (1873-1897) was a Discalced Carmelite nun of Lisieux who died at twenty-four. Her autobiography, Story of a Soul, taught the 'Little Way' of trust and confidence in God's merciful love. Pope Pius XI canonized her in 1925, Pope Pius XI named her co-patroness of the missions, and Pope John Paul II declared her a Doctor of the Church in 1997.",
  ),
  saint(
    "saint-padre-pio",
    "Saint Padre Pio of Pietrelcina",
    "09-23",
    "confessor",
    "canonized",
    ["civil defense workers", "adolescents", "stress relief"],
    "Saint Pio of Pietrelcina (1887-1968), a Capuchin Franciscan friar, bore the visible stigmata for fifty years. Known for his long hours in the confessional, mystical gifts, and intense devotion to the Mass, he founded the Home for the Relief of Suffering hospital in San Giovanni Rotondo. Beatified by Pope John Paul II in 1999 and canonized in 2002.",
  ),
  saint(
    "saint-john-paul-ii",
    "Saint Pope John Paul II",
    "10-22",
    "pope",
    "canonized",
    ["young people", "families", "World Youth Day"],
    "Karol Józef Wojtyła (1920-2005) was elected Pope on 16 October 1978 — the first non-Italian Pope in 455 years and the first from Poland. His twenty-six-year pontificate witnessed the fall of communism in Eastern Europe, the establishment of World Youth Day, the publication of the Catechism of the Catholic Church, and the canonization of more saints than any pope before him. Canonized by Pope Francis in 2014.",
  ),
  saint(
    "saint-faustina-kowalska",
    "Saint Faustina Kowalska",
    "10-05",
    "religious",
    "canonized",
    ["mercy"],
    "Saint Maria Faustina Kowalska (1905-1938) was a Polish Sister of Our Lady of Mercy. The Lord Jesus entrusted her with the message of Divine Mercy, recorded in her Diary. Pope John Paul II canonized her in 2000 — the first saint of the new millennium — and established Divine Mercy Sunday for the universal Church.",
  ),
  saint(
    "saint-maximilian-kolbe",
    "Saint Maximilian Kolbe",
    "08-14",
    "martyr",
    "canonized",
    ["prisoners", "the pro-life movement", "drug addicts"],
    "Saint Maximilian Maria Kolbe (1894-1941) was a Polish Conventual Franciscan friar who founded the Militia Immaculatae (Knights of the Immaculata) and the Marian publishing apostolate at Niepokalanów. Imprisoned at Auschwitz, he volunteered to die in place of a stranger, Franciszek Gajowniczek, and was murdered with a phenol injection on 14 August 1941. Canonized as a martyr by Pope John Paul II in 1982.",
  ),
  saint(
    "saint-mother-teresa-of-calcutta",
    "Saint Mother Teresa of Calcutta",
    "09-05",
    "founder",
    "canonized",
    ["World Youth Day", "Missionaries of Charity"],
    "Saint Teresa of Calcutta (Anjezë Gonxhe Bojaxhiu, 1910-1997) was an Albanian-Indian Catholic nun who founded the Missionaries of Charity in 1950. The order serves 'the poorest of the poor' in over 130 countries. Awarded the Nobel Peace Prize in 1979. Beatified by Pope John Paul II in 2003 and canonized by Pope Francis in 2016.",
  ),
  saint(
    "saint-anthony-of-padua",
    "Saint Anthony of Padua",
    "06-13",
    "doctor_of_the_church",
    "canonized",
    ["lost things", "the poor", "Portugal"],
    "Saint Anthony of Padua (1195-1231), born Fernando Martins in Lisbon, joined the Franciscans and became one of the greatest preachers of the Middle Ages. Canonized within a year of his death by Pope Gregory IX. Declared a Doctor of the Church by Pope Pius XII in 1946. His tomb in Padua draws millions of pilgrims annually.",
  ),
  saint(
    "saint-patrick",
    "Saint Patrick",
    "03-17",
    "bishop",
    "canonized",
    ["Ireland", "Nigeria", "engineers"],
    "Saint Patrick (c. 385-461) was the apostle of Ireland. Born in Roman Britain, captured by Irish raiders as a teenager and enslaved for six years, he escaped, became a priest and bishop, and returned to evangelize Ireland. He used the shamrock to explain the Trinity. His Confessio and Letter to the Soldiers of Coroticus survive.",
  ),
  saint(
    "saint-benedict-of-nursia",
    "Saint Benedict of Nursia",
    "07-11",
    "founder",
    "canonized",
    ["Europe", "monastics", "students"],
    "Saint Benedict (c. 480-547) is the patriarch of Western monasticism. His Rule for monasteries — 'pray and work' — became the foundational document for monastic life in Europe and shaped Western Christian culture. Pope Paul VI named him patron of Europe in 1964.",
  ),
  saint(
    "saint-catherine-of-siena",
    "Saint Catherine of Siena",
    "04-29",
    "doctor_of_the_church",
    "canonized",
    ["Italy", "Europe", "nurses"],
    "Saint Catherine of Siena (1347-1380), a Dominican tertiary, was an influential mystic, theologian, and reformer who urged Pope Gregory XI to return the papacy from Avignon to Rome. Her Dialogue of Divine Providence is a masterpiece of mystical theology. Declared a Doctor of the Church by Pope Paul VI in 1970 and co-patroness of Europe by Pope John Paul II.",
  ),
  saint(
    "saint-ignatius-of-loyola",
    "Saint Ignatius of Loyola",
    "07-31",
    "founder",
    "canonized",
    ["soldiers", "retreats", "the Society of Jesus"],
    "Saint Ignatius of Loyola (1491-1556), Basque nobleman turned mystic and reformer, founded the Society of Jesus (the Jesuits) in 1540. His Spiritual Exercises, composed during his convalescence at Manresa, remain one of the most influential works of Western spirituality. Canonized in 1622.",
  ),
  saint(
    "saint-teresa-of-avila",
    "Saint Teresa of Avila",
    "10-15",
    "doctor_of_the_church",
    "canonized",
    ["Spain", "headache sufferers", "writers"],
    "Saint Teresa of Jesus (1515-1582), Discalced Carmelite reformer, mystic, and author of The Interior Castle and the Autobiography. With St. John of the Cross she renewed the Carmelite Order. Declared the first woman Doctor of the Church by Pope Paul VI in 1970.",
  ),
  saint(
    "saint-john-of-the-cross",
    "Saint John of the Cross",
    "12-14",
    "doctor_of_the_church",
    "canonized",
    ["mystics", "contemplative life", "Spanish poets"],
    "Saint John of the Cross (1542-1591), Discalced Carmelite priest, poet, and mystic. Co-founder with St. Teresa of Avila of the reformed Carmelite Order. Author of The Dark Night of the Soul, The Ascent of Mount Carmel, and The Spiritual Canticle. Declared a Doctor of the Church in 1926.",
  ),
];
