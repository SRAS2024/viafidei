import type { CuratedEntry } from "./index";

const USCCB = "https://www.usccb.org/";
const VATICAN = "https://www.vatican.va/";

/**
 * The prayers each kind of guide uses, in the order they are prayed (first to
 * last). The guide page renders these at the bottom as dropdown toggles with a
 * universal Latin/Greek language switch, so a user has every prayer of the
 * guide readily available even if they don't know it by heart.
 */
const RELATED_PRAYERS_BY_KIND: Record<string, string[]> = {
  rosary: [
    "apostles-creed",
    "our-father",
    "hail-mary",
    "glory-be",
    "fatima-prayer",
    "salve-regina",
    "prayer-to-saint-michael",
  ],
  chaplet: ["our-father", "hail-mary", "apostles-creed"],
  confession: ["confiteor", "act-of-contrition"],
  adoration: ["anima-christi", "our-father", "glory-be"],
  consecration: ["memorare", "hail-mary", "glory-be"],
  discernment: ["veni-creator-spiritus", "our-father"],
  vocation: ["veni-creator-spiritus", "our-father"],
};

function guide(
  slug: string,
  title: string,
  kind:
    | "rosary"
    | "chaplet"
    | "confession"
    | "adoration"
    | "consecration"
    | "discernment"
    | "vocation"
    | "lent_preparation"
    | "advent_preparation"
    | "rcia"
    | "ocia"
    | "general",
  summary: string,
  steps: Array<{ order: number; title: string; body: string }>,
  sacramentKey?:
    | "baptism"
    | "confirmation"
    | "eucharist"
    | "reconciliation"
    | "anointing_of_the_sick"
    | "holy_orders"
    | "matrimony",
): CuratedEntry {
  return {
    contentType: "GUIDE",
    slug,
    authorityLevel: "USCCB",
    citations: [USCCB, VATICAN],
    payload: {
      slug,
      title,
      summary,
      kind,
      ...(sacramentKey ? { sacramentKey } : {}),
      steps,
      relatedPrayers: RELATED_PRAYERS_BY_KIND[kind] ?? [],
      citations: [USCCB, VATICAN],
    },
  };
}

export const guideKnowledge: CuratedEntry[] = [
  guide(
    "how-to-pray-the-rosary",
    "How to Pray the Holy Rosary",
    "rosary",
    "A step-by-step guide to praying the Rosary, the great Marian psalter of the Latin Church.",
    [
      {
        order: 1,
        title: "Begin with the Sign of the Cross and the Apostles' Creed",
        body: "Make the Sign of the Cross. Hold the crucifix and pray the Apostles' Creed.",
      },
      {
        order: 2,
        title: "Opening prayers on the first beads",
        body: "On the first bead pray the Our Father. On the next three pray a Hail Mary on each (for an increase of faith, hope, and charity). Pray the Glory Be.",
      },
      {
        order: 3,
        title: "Announce the first mystery",
        body: "Announce the first mystery (Joyful, Sorrowful, Glorious, or Luminous, depending on the day) and pray an Our Father on the large bead.",
      },
      {
        order: 4,
        title: "Pray a decade",
        body: "On each of the ten small beads pray one Hail Mary while meditating on the mystery. End with a Glory Be and (optionally) the Fatima Prayer: 'O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of Thy mercy.'",
      },
      {
        order: 5,
        title: "Repeat for the remaining four mysteries",
        body: "Continue for the four remaining mysteries of the set, announcing each, praying an Our Father, ten Hail Marys, and a Glory Be.",
      },
      {
        order: 6,
        title: "Conclude with the Hail Holy Queen",
        body: "Pray the Hail Holy Queen (Salve Regina), the closing prayer of the Rosary. Make the Sign of the Cross.",
      },
    ],
  ),
  guide(
    "how-to-pray-the-divine-mercy-chaplet",
    "How to Pray the Divine Mercy Chaplet",
    "chaplet",
    "A step-by-step guide to praying the Chaplet of Divine Mercy, prayed on ordinary Rosary beads.",
    [
      {
        order: 1,
        title: "Begin with the Sign of the Cross",
        body: "Make the Sign of the Cross. The Chaplet of Divine Mercy is prayed on ordinary Rosary beads.",
      },
      {
        order: 2,
        title: "Optional opening prayers",
        body: "You may pray the optional opening: 'You expired, Jesus, but the source of life gushed forth for souls, and the ocean of mercy opened up for the whole world.' Then three times: 'O Blood and Water, which gushed forth from the Heart of Jesus as a fount of Mercy for us, I trust in You!'",
      },
      {
        order: 3,
        title: "Our Father, Hail Mary, and the Apostles' Creed",
        body: "On the opening beads, pray one Our Father, one Hail Mary, and the Apostles' Creed.",
      },
      {
        order: 4,
        title: "The Eternal Father prayer on the large bead",
        body: "On the large bead before each decade, pray: 'Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.'",
      },
      {
        order: 5,
        title: "Pray the decade and repeat for all five",
        body: "On each of the ten small beads, pray: 'For the sake of His sorrowful Passion, have mercy on us and on the whole world.' Then repeat the Eternal Father prayer and the ten petitions for all five decades.",
      },
      {
        order: 6,
        title: "Conclude with the Holy God (three times)",
        body: "After the five decades, pray three times: 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.'",
      },
      {
        order: 7,
        title: "Optional closing prayer",
        body: "You may conclude with the closing prayer to the merciful God, then make the Sign of the Cross.",
      },
    ],
  ),
  guide(
    "how-to-go-to-confession",
    "How to Go to Confession",
    "confession",
    "A simple step-by-step guide to the Sacrament of Reconciliation.",
    [
      {
        order: 1,
        title: "Examine your conscience",
        body: "Before going, review your life in the light of God's love. The Ten Commandments, the Beatitudes, and the Precepts of the Church are the traditional framework.",
      },
      {
        order: 2,
        title: "Be sorry for your sins",
        body: "Contrition (sorrow for sin) is the most important part. Perfect contrition (sorrow for love of God) brings the soul to friendship with God even before sacramental absolution.",
      },
      {
        order: 3,
        title: "Resolve not to sin again",
        body: "Form a firm purpose of amendment — the resolve, with God's grace, to avoid sin and the occasions of sin.",
      },
      {
        order: 4,
        title: "Confess your sins to the priest",
        body: "Begin: 'Bless me, Father, for I have sinned. It has been [time] since my last confession. These are my sins...' Confess all mortal sins by kind and number to the best of your memory. Venial sins may also be confessed (and are highly recommended).",
      },
      {
        order: 5,
        title: "Pray the Act of Contrition",
        body: "When the priest invites you, pray an Act of Contrition. The priest will give you a penance and grant sacramental absolution.",
      },
      {
        order: 6,
        title: "Complete your penance",
        body: "Complete the penance the priest assigned as soon as possible after confession. Thank God for the gift of his mercy.",
      },
    ],
    "reconciliation",
  ),
  guide(
    "examination-of-conscience",
    "Examination of Conscience",
    "confession",
    "A traditional examination of conscience structured on the Ten Commandments.",
    [
      {
        order: 1,
        title: "I am the Lord your God; you shall not have strange gods before me.",
        body: "Have I made anything (work, money, possessions, a person, an addiction) more important to me than God? Have I omitted daily prayer? Have I dabbled in occult practices, fortune telling, the New Age?",
      },
      {
        order: 2,
        title: "You shall not take the name of the Lord your God in vain.",
        body: "Have I used the names of God, Jesus, Mary, or the saints irreverently? Have I blasphemed, cursed, or sworn falsely?",
      },
      {
        order: 3,
        title: "Remember to keep holy the Lord's day.",
        body: "Have I missed Sunday Mass or a Holy Day of Obligation through my own fault? Have I done unnecessary servile work on the Lord's day?",
      },
      {
        order: 4,
        title: "Honor your father and your mother.",
        body: "Have I honored my parents (or, as a parent, raised my children in the faith)? Have I respected legitimate civil authority?",
      },
      {
        order: 5,
        title: "You shall not kill.",
        body: "Have I harmed another person in body, soul, or reputation? Have I been complicit in abortion, euthanasia, or other direct attacks on human life? Have I harbored anger, hatred, or grudges?",
      },
      {
        order: 6,
        title: "You shall not commit adultery.",
        body: "Have I been chaste in thought, word, and deed appropriate to my state in life? Have I committed adultery, fornication, masturbation, pornography use, or contraceptive acts?",
      },
      {
        order: 7,
        title: "You shall not steal.",
        body: "Have I stolen, cheated, or defrauded another? Have I been just in my work and business dealings? Have I given alms in proportion to my means?",
      },
      {
        order: 8,
        title: "You shall not bear false witness against your neighbor.",
        body: "Have I lied, gossiped, slandered, or detracted? Have I damaged another's reputation? Have I kept secrets I was bound to keep?",
      },
      {
        order: 9,
        title: "You shall not covet your neighbor's wife.",
        body: "Have I entertained impure thoughts about another? Have I deliberately fed desires contrary to chastity?",
      },
      {
        order: 10,
        title: "You shall not covet your neighbor's goods.",
        body: "Have I been envious, greedy, or grasping? Have I trusted in possessions rather than in God's providence?",
      },
    ],
    "reconciliation",
  ),
  guide(
    "how-to-pray-the-stations-of-the-cross",
    "How to Pray the Stations of the Cross",
    "general",
    "A guide to the Way of the Cross, a devotion that walks with Christ through the fourteen stations of his Passion from condemnation to burial.",
    [
      {
        order: 1,
        title: "Begin in a spirit of prayer",
        body: "Make the Sign of the Cross and ask for the grace to walk with Christ in his Passion. The Stations may be prayed before the images mounted in a church, or privately with a booklet.",
      },
      {
        order: 2,
        title: "Move from station to station",
        body: "At each of the fourteen stations, genuflect or pause and pray: 'We adore you, O Christ, and we bless you, because by your holy Cross you have redeemed the world.' Then meditate briefly on that moment of the Passion.",
      },
      {
        order: 3,
        title: "The fourteen stations",
        body: "1. Jesus is condemned to death. 2. Jesus takes up his Cross. 3. Jesus falls the first time. 4. Jesus meets his Mother. 5. Simon helps carry the Cross. 6. Veronica wipes the face of Jesus. 7. Jesus falls the second time. 8. Jesus meets the women of Jerusalem. 9. Jesus falls the third time. 10. Jesus is stripped of his garments. 11. Jesus is nailed to the Cross. 12. Jesus dies on the Cross. 13. Jesus is taken down from the Cross. 14. Jesus is laid in the tomb.",
      },
      {
        order: 4,
        title: "Conclude",
        body: "Many add a fifteenth station, the Resurrection. Conclude with prayer for the intentions of the Holy Father and an Our Father, Hail Mary, and Glory Be.",
      },
    ],
  ),
  guide(
    "how-to-make-a-holy-hour",
    "How to Make a Holy Hour",
    "adoration",
    "A guide to spending an hour in adoration before the Blessed Sacrament, keeping watch with the Lord as he asked of his disciples in Gethsemane.",
    [
      {
        order: 1,
        title: "Come into the Lord's presence",
        body: "Genuflect before the Blessed Sacrament (on both knees if it is exposed in the monstrance) and quiet your heart, aware that you are before the Lord truly present in the Eucharist.",
      },
      {
        order: 2,
        title: "Adore and give thanks",
        body: "Begin with adoration and thanksgiving — perhaps with a hymn such as O Salutaris Hostia, a psalm, or simply resting in silent love before the Lord.",
      },
      {
        order: 3,
        title: "Pray with Scripture and intercession",
        body: "Read slowly from Scripture (lectio divina), bring your needs and the needs of the world before the Lord, and listen for his voice in the silence. The Rosary or the Liturgy of the Hours may also be prayed.",
      },
      {
        order: 4,
        title: "Conclude",
        body: "If a priest or deacon gives Benediction, adore as the Tantum Ergo is sung and receive the blessing with the Blessed Sacrament. Otherwise, conclude with thanksgiving and a genuflection.",
      },
    ],
  ),
  guide(
    "how-to-pray-the-angelus",
    "How to Pray the Angelus",
    "general",
    "A guide to the Angelus, a traditional Marian prayer commemorating the Incarnation, prayed three times daily at six in the morning, noon, and six in the evening.",
    [
      {
        order: 1,
        title: "The versicles and Hail Marys",
        body: "Pray in three exchanges, each followed by a Hail Mary: 'The Angel of the Lord declared unto Mary, and she conceived of the Holy Spirit.' 'Behold the handmaid of the Lord; be it done unto me according to thy word.' 'And the Word was made flesh, and dwelt among us.'",
      },
      {
        order: 2,
        title: "The concluding prayer",
        body: "Conclude with: 'Pray for us, O holy Mother of God, that we may be made worthy of the promises of Christ.' Then pray the collect, 'Pour forth, we beseech thee, O Lord, thy grace into our hearts…'",
      },
      {
        order: 3,
        title: "During the Easter season",
        body: "From Easter Sunday to Pentecost, the Regina Caeli is prayed in place of the Angelus, rejoicing in the Resurrection of the Lord.",
      },
    ],
  ),
  guide(
    "how-to-make-a-marian-consecration",
    "How to Make a Marian Consecration",
    "consecration",
    "A guide to entrusting oneself entirely to Jesus through Mary, following the 'total consecration' taught by Saint Louis de Montfort.",
    [
      {
        order: 1,
        title: "Understand the consecration",
        body: "Marian consecration is the giving of oneself entirely to Jesus Christ through the hands of his Mother, so that she may form us into the image of her Son. It does not replace devotion to Christ but deepens it.",
      },
      {
        order: 2,
        title: "Prepare over several weeks",
        body: "Saint Louis de Montfort's method involves a period of preparation (traditionally 33 days) of prayer and meditation — renouncing the spirit of the world, growing in knowledge of self, of Mary, and of Jesus.",
      },
      {
        order: 3,
        title: "Make the act of consecration",
        body: "On the chosen Marian feast, pray the act of consecration, entrusting your body and soul, your goods and merits, to Jesus through Mary. Renew it often, and live it through faithful daily devotion such as the Rosary.",
      },
    ],
  ),
  guide(
    "understanding-the-parts-of-the-mass",
    "Understanding the Parts of the Mass",
    "general",
    "A guide to the structure and meaning of the Holy Mass, the source and summit of the Christian life, in its two great parts: the Liturgy of the Word and the Liturgy of the Eucharist.",
    [
      {
        order: 1,
        title: "The Introductory Rites",
        body: "The Entrance, the Sign of the Cross and Greeting, the Penitential Act, the Gloria (on Sundays and feasts), and the Collect gather the faithful and prepare them to hear God's Word and celebrate the Eucharist.",
      },
      {
        order: 2,
        title: "The Liturgy of the Word",
        body: "God speaks to his people in the readings from Scripture: the First Reading, Responsorial Psalm, Second Reading (on Sundays), the Gospel, the Homily, the Profession of Faith (Creed), and the Universal Prayer.",
      },
      {
        order: 3,
        title: "The Liturgy of the Eucharist",
        body: "The Preparation of the Gifts, the Eucharistic Prayer (in which the bread and wine become the Body and Blood of Christ), and the Communion Rite (the Our Father, Sign of Peace, Lamb of God, and reception of Holy Communion) make present the sacrifice of Christ.",
      },
      {
        order: 4,
        title: "The Concluding Rites",
        body: "The Blessing and the Dismissal send the faithful out to love and serve the Lord, carrying the grace of the Eucharist into the world.",
      },
    ],
  ),
];
