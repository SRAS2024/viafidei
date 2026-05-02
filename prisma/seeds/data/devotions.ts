export type DevotionSeed = {
  slug: string;
  title: string;
  summary: string;
  practiceText?: string;
  durationMinutes?: number;
};

export const DEVOTIONS: DevotionSeed[] = [
  {
    slug: "holy-rosary",
    title: "The Holy Rosary",
    summary:
      "A Marian devotion meditating on the life of Christ through twenty mysteries, prayed with a string of beads.",
    practiceText:
      "Begin with the Apostles' Creed, then pray one Our Father, three Hail Marys, and one Glory Be on the introductory beads. Announce each mystery, pray one Our Father, ten Hail Marys, and one Glory Be. Conclude with the Hail Holy Queen.",
    durationMinutes: 20,
  },
  {
    slug: "stations-of-the-cross",
    title: "Stations of the Cross",
    summary:
      "A devotional journey through fourteen scriptural and traditional stations commemorating the Passion of Christ.",
    practiceText:
      "Move prayerfully before each station. At each one: We adore you, O Christ, and we praise you — Because by your holy cross you have redeemed the world. Read or meditate on the event, then offer a brief prayer. Conclude with a prayer for the suffering.",
    durationMinutes: 30,
  },
  {
    slug: "chaplet-of-divine-mercy",
    title: "Chaplet of Divine Mercy",
    summary:
      "A short Rosary-based prayer revealed to Saint Faustina Kowalska, offered as an act of mercy and intercession.",
    practiceText:
      "Begin with one Our Father, one Hail Mary, and the Apostles' Creed. On the large bead of each decade: Eternal Father, I offer you the Body and Blood, Soul and Divinity of your dearly beloved Son, our Lord Jesus Christ, in atonement for our sins and those of the whole world. On the ten small beads: For the sake of his sorrowful Passion, have mercy on us and on the whole world. Conclude: Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world (×3).",
    durationMinutes: 10,
  },
  {
    slug: "angelus",
    title: "The Angelus",
    summary:
      "A traditional Catholic prayer commemorating the Annunciation, prayed three times daily at 6 am, noon, and 6 pm.",
    practiceText:
      "The Angel of the Lord declared unto Mary — And she conceived of the Holy Spirit. Hail Mary… Behold the handmaid of the Lord — Be it done unto me according to your word. Hail Mary… And the Word was made flesh — And dwelt among us. Hail Mary… Pray for us, O Holy Mother of God — That we may be made worthy of the promises of Christ. Let us pray: Pour forth, we beseech thee, O Lord, thy grace into our hearts… Amen.",
    durationMinutes: 3,
  },
  {
    slug: "eucharistic-adoration",
    title: "Eucharistic Adoration",
    summary:
      "Silent or structured prayer before the Blessed Sacrament exposed in a monstrance, a central pillar of Catholic devotional life.",
    practiceText:
      "Arrive quietly and genuflect before the Blessed Sacrament. Spend time in silent contemplation, Scripture reading, or recitation of the Divine Office. You may use Litanies, the Anima Christi, or spontaneous prayer. Close with Tantum Ergo and a Benediction blessing if available.",
    durationMinutes: 60,
  },
  {
    slug: "novena-to-our-lady-of-lourdes",
    title: "Novena to Our Lady of Lourdes",
    summary:
      "A nine-day novena imploring Our Lady of Lourdes for healing, comfort, and intercession.",
    practiceText:
      "Pray each day for nine consecutive days: O ever Immaculate Virgin, Mother of Mercy, health of the sick, refuge of sinners, comforter of the afflicted — you know my wants, my troubles, my sufferings. Look upon me with mercy. When you appeared in the grotto of Lourdes, you gave a mission to Saint Bernadette to pray and do penance. I beg you to obtain for me the grace I need. [State intention.] O Mary, conceived without sin, pray for us who have recourse to thee.",
    durationMinutes: 10,
  },
  {
    slug: "litany-of-loreto",
    title: "Litany of Loreto",
    summary:
      "An ancient litany of the Blessed Virgin Mary, approved by Pope Sixtus V in 1587, invoking Mary under her many titles.",
    practiceText:
      "Lord, have mercy. Christ, have mercy. Lord, have mercy. Then invoke each title of the Virgin: Holy Mary — pray for us. Holy Mother of God — pray for us. Mother most pure — pray for us. (Continue through all approved titles.) Conclude: Lamb of God who takes away the sins of the world — spare us, O Lord. Grant us, O Lord God…",
    durationMinutes: 10,
  },
  {
    slug: "morning-offering",
    title: "Morning Offering",
    summary:
      "A brief prayer consecrating the day's works, joys, and sufferings to God through the Sacred Heart of Jesus.",
    practiceText:
      "O Jesus, through the Immaculate Heart of Mary, I offer you my prayers, works, joys and sufferings of this day for all the intentions of your Sacred Heart, in union with the Holy Sacrifice of the Mass throughout the world, in reparation for my sins, for the intentions of all our associates, and in particular for the intention recommended this month by the Holy Father.",
    durationMinutes: 2,
  },
];
