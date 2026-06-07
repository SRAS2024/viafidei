import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const USCCB = "https://www.usccb.org/";

function devotion(
  slug: string,
  title: string,
  summary: string,
  background: string,
  practice: string,
  type = "general",
  relatedPrayers: string[] = [],
): CuratedEntry {
  return {
    contentType: "DEVOTION",
    slug,
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug,
      title,
      summary,
      background,
      devotionType: type,
      practiceInstructions: practice,
      relatedPrayers,
      relatedSaints: [],
      citations: [VATICAN, USCCB],
    },
  };
}

export const devotionKnowledge: CuratedEntry[] = [
  devotion(
    "holy-rosary",
    "The Holy Rosary",
    "The Rosary is the great Marian psalter of the Latin Church: a meditation on the mysteries of Christ's life prayed in the company of his Mother.",
    "Developed in the early medieval period; popularized in its modern form by the Dominicans. Pope St. John Paul II added the Luminous Mysteries (Mysteries of Light) in his 2002 apostolic letter Rosarium Virginis Mariae.",
    "Begin with the Sign of the Cross and the Apostles' Creed. Pray one Our Father, three Hail Marys (for an increase of faith, hope, and charity), and a Glory Be. Then meditate on each of the five mysteries in turn, praying one Our Father, ten Hail Marys, and a Glory Be for each. Conclude with the Hail Holy Queen.",
    "marian",
    ["our-father", "hail-mary", "glory-be", "apostles-creed", "salve-regina"],
  ),
  devotion(
    "divine-mercy-chaplet",
    "The Divine Mercy Chaplet",
    "A devotion to the Divine Mercy of Jesus, revealed to St. Faustina Kowalska. Prayed on rosary beads.",
    "The Lord Jesus dictated the chaplet to St. Faustina in Vilnius in 1935. Pope John Paul II canonized St. Faustina in 2000 and established Divine Mercy Sunday for the universal Church.",
    "Begin with the Sign of the Cross, the Our Father, the Hail Mary, and the Apostles' Creed. On the Our Father beads pray: 'Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your Dearly Beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.' On the Hail Mary beads pray: 'For the sake of His sorrowful Passion, have mercy on us and on the whole world.' Conclude by praying three times: 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.'",
    "marian",
    ["our-father", "hail-mary", "apostles-creed"],
  ),
  devotion(
    "stations-of-the-cross",
    "Stations of the Cross",
    "A devotion that follows Christ's path to Calvary in fourteen stations, each meditated with prayer and reflection.",
    "Pilgrims walked the Via Dolorosa in Jerusalem from the early centuries. The fourteen stations as a portable devotion were popularized by the Franciscans in the 14th-17th centuries and granted indulgences by multiple popes.",
    "Move (in person or in meditation) from station to station. At each, recite: 'We adore you, O Christ, and we bless you, because by your Holy Cross you have redeemed the world.' Read or meditate on the station's mystery, then pray an Our Father, Hail Mary, and Glory Be. The fourteen stations: (1) Jesus is condemned to death; (2) Jesus carries his Cross; (3) Jesus falls the first time; (4) Jesus meets his Mother; (5) Simon of Cyrene helps Jesus carry the Cross; (6) Veronica wipes the face of Jesus; (7) Jesus falls the second time; (8) Jesus meets the women of Jerusalem; (9) Jesus falls the third time; (10) Jesus is stripped of his garments; (11) Jesus is nailed to the Cross; (12) Jesus dies on the Cross; (13) Jesus is taken down from the Cross; (14) Jesus is laid in the tomb.",
    "passion",
  ),
  devotion(
    "eucharistic-adoration",
    "Eucharistic Adoration",
    "The worship of Christ truly, really, and substantially present in the Most Blessed Sacrament of the Eucharist, exposed or reserved in the tabernacle.",
    "Public exposition of the Blessed Sacrament developed in the medieval Latin Church, especially in connection with the feast of Corpus Christi (1264). Pope John Paul II called it 'one of the proofs of the Catholic faith.'",
    "Approach the Blessed Sacrament reverently. Genuflect on entering and leaving. Spend the time in silent prayer, vocal prayer, Scripture reading, or singing. A Holy Hour traditionally includes time for adoration, thanksgiving, reparation, and supplication.",
    "eucharistic",
    ["anima-christi", "divine-praises"],
  ),
  devotion(
    "devotion-sacred-heart-of-jesus",
    "Devotion to the Sacred Heart of Jesus",
    "Adoration of the wounded Heart of Christ as the symbol and source of his redeeming love.",
    "Roots in the writings of the Latin Fathers, the medieval mystics (St. Gertrude, St. Mechtilde), and especially the apparitions to St. Margaret Mary Alacoque at Paray-le-Monial (1673-1675). Pope Pius XII gave the most authoritative magisterial teaching in the encyclical Haurietis Aquas (1956).",
    "The Solemnity of the Sacred Heart is celebrated on the Friday after the Second Sunday after Pentecost. First Fridays are dedicated to honoring the Sacred Heart by attending Mass and receiving Holy Communion. The Litany of the Sacred Heart is prayed throughout June.",
    "christological",
  ),
  devotion(
    "devotion-immaculate-heart-of-mary",
    "Devotion to the Immaculate Heart of Mary",
    "Veneration of the immaculate Heart of Mary as the seat of her purity, her love for God, and her maternal love for the Church.",
    "Promoted by St. John Eudes in the 17th century. Pope Pius XII consecrated the world to the Immaculate Heart of Mary in 1942 in response to Our Lady of Fatima's requests.",
    "The Memorial of the Immaculate Heart of Mary falls on the day after the Solemnity of the Sacred Heart. First Saturdays are dedicated to acts of reparation to the Immaculate Heart, including Mass, Communion, confession (within 8 days), the Rosary, and 15 minutes of meditation.",
    "marian",
  ),
  devotion(
    "liturgy-of-the-hours",
    "Liturgy of the Hours",
    "The public prayer of the Church, sanctifying the hours of the day with psalms, canticles, Scripture, and intercessions.",
    "Rooted in the Jewish prayer of the synagogue. Developed in monastic communities and codified in successive breviaries. Reformed after the Second Vatican Council (Apostolic Constitution Laudis Canticum, 1970).",
    "The principal Hours are Morning Prayer (Lauds) and Evening Prayer (Vespers). Other Hours are the Office of Readings, Daytime Prayer, and Night Prayer (Compline). Bishops, priests, deacons, and consecrated religious are bound to pray it. Laity are warmly encouraged.",
    "liturgical",
    ["magnificat"],
  ),
];
