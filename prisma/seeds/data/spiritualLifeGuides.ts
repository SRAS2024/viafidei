import type { SpiritualLifeKind } from "@prisma/client";

export type SpiritualLifeGuideSeed = {
  slug: string;
  kind: SpiritualLifeKind;
  title: string;
  summary: string;
  bodyText?: string;
  steps?: object;
  durationDays?: number;
  goalTemplateSlug?: string;
};

export const SPIRITUAL_LIFE_GUIDES: SpiritualLifeGuideSeed[] = [
  {
    slug: "how-to-pray-the-rosary",
    kind: "ROSARY",
    title: "How to Pray the Rosary",
    summary:
      "A complete step-by-step guide to praying the Holy Rosary — the structure, the mysteries, the prayers, and the spiritual meaning of each part.",
    bodyText: `The Rosary is one of the most beloved prayers in the Catholic tradition. Pope John Paul II called it "a compendium of the Gospel" (Rosarium Virginis Mariae, 18). Each decade meditates on a mystery from the life of Christ and Mary, weaving Scripture and contemplation into a single sustained prayer.

**Structure of the Rosary**
A complete Rosary is five decades. A "decade" is one Our Father, ten Hail Marys, and one Glory Be, said while meditating on a single mystery. Many people pray fifteen or twenty decades at a sitting, but five is the ordinary form.

**The Four Sets of Mysteries**
Saint Pius V codified the original three sets of mysteries (Joyful, Sorrowful, Glorious) in 1569. Saint John Paul II added the Luminous Mysteries in 2002.

  **Joyful Mysteries** — traditionally Mondays and Saturdays
  1. The Annunciation (Luke 1:26–38) — Mary is greeted by the Angel Gabriel and conceives the Son of God by the Holy Spirit. Fruit: humility.
  2. The Visitation (Luke 1:39–56) — Mary visits Elizabeth; John leaps in the womb. Fruit: love of neighbour.
  3. The Nativity (Luke 2:1–20) — Christ is born in Bethlehem. Fruit: poverty of spirit.
  4. The Presentation (Luke 2:22–38) — Christ is presented in the Temple; Simeon prophesies. Fruit: obedience.
  5. The Finding in the Temple (Luke 2:41–52) — Mary and Joseph find the boy Jesus among the doctors. Fruit: piety.

  **Luminous Mysteries (Mysteries of Light)** — Thursdays
  1. The Baptism of the Lord in the Jordan (Matthew 3:13–17) — the Father reveals Christ as his beloved Son. Fruit: openness to the Holy Spirit.
  2. The Wedding at Cana (John 2:1–11) — Christ's first public miracle, at his Mother's request. Fruit: trust in Mary's intercession.
  3. The Proclamation of the Kingdom (Mark 1:14–15) — Christ calls all to repentance and faith. Fruit: conversion.
  4. The Transfiguration (Matthew 17:1–8) — Christ reveals his glory on Mount Tabor. Fruit: desire for holiness.
  5. The Institution of the Eucharist (Matthew 26:26–30) — at the Last Supper, Christ gives his Body and Blood. Fruit: Eucharistic adoration.

  **Sorrowful Mysteries** — Tuesdays and Fridays
  1. The Agony in the Garden (Matthew 26:36–46). Fruit: contrition for sin.
  2. The Scourging at the Pillar (Matthew 27:26). Fruit: purity and mortification.
  3. The Crowning with Thorns (Matthew 27:27–31). Fruit: moral courage.
  4. The Carrying of the Cross (Luke 23:26–32). Fruit: patience.
  5. The Crucifixion and Death (John 19:17–30). Fruit: salvation.

  **Glorious Mysteries** — Wednesdays and Sundays
  1. The Resurrection (Mark 16:1–8). Fruit: faith.
  2. The Ascension (Acts 1:6–11). Fruit: hope of heaven.
  3. The Descent of the Holy Spirit at Pentecost (Acts 2:1–13). Fruit: love of God.
  4. The Assumption of Mary (Revelation 12:1; Pius XII, Munificentissimus Deus). Fruit: a holy death.
  5. The Coronation of Mary as Queen of Heaven and Earth (Revelation 12:1; Lumen Gentium 59). Fruit: trust in Mary's intercession.

**The Core Prayers**

  *Sign of the Cross.* "In the name of the Father, and of the Son, and of the Holy Spirit. Amen."

  *Apostles' Creed.* The ancient baptismal symbol: "I believe in God, the Father almighty, Creator of heaven and earth…"

  *Our Father.* The prayer Christ taught in Matthew 6:9–13 and Luke 11:2–4.

  *Hail Mary.* "Hail Mary, full of grace, the Lord is with thee. Blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen."

  *Glory Be.* "Glory be to the Father, and to the Son, and to the Holy Spirit; as it was in the beginning, is now, and ever shall be, world without end. Amen."

  *Fatima Prayer* (added by request of Our Lady of Fatima, 1917): "O my Jesus, forgive us our sins, save us from the fires of hell, and lead all souls to heaven, especially those most in need of thy mercy."

  *Hail, Holy Queen (Salve Regina).* The traditional concluding antiphon.

**Spiritual meaning**
The Rosary is sometimes called "Mary's Psalter" — a way for the unlettered to pray the 150 psalms in a single decade-times-fifteen sequence. More deeply, it is meditation: the repeated Hail Marys form a quiet rhythm against which the mind contemplates the mysteries. Saint John Paul II compares it to the contemplation Mary herself made when "she pondered all these things in her heart" (Luke 2:19).`,
    steps: [
      {
        order: 1,
        title: "Hold the crucifix",
        body: "Make the Sign of the Cross and pray the Apostles' Creed.",
      },
      { order: 2, title: "First large bead", body: "Pray one Our Father." },
      {
        order: 3,
        title: "Three small beads",
        body: "Pray three Hail Marys for an increase of faith, hope, and charity.",
      },
      {
        order: 4,
        title: "Glory Be",
        body: "Pray the Glory Be. Announce the first mystery of the day and read or recall the Scripture passage that goes with it.",
      },
      {
        order: 5,
        title: "First large bead of the decade",
        body: "Pray one Our Father, holding the mystery in your mind.",
      },
      {
        order: 6,
        title: "Ten small beads",
        body: "Pray ten Hail Marys, meditating on the mystery throughout. Do not rush — repeat slowly.",
      },
      {
        order: 7,
        title: "Glory Be and Fatima Prayer",
        body: "End each decade with the Glory Be, then the Fatima Prayer: O my Jesus, forgive us our sins…",
      },
      {
        order: 8,
        title: "Repeat for the remaining four decades",
        body: "Announce the second, third, fourth, and fifth mysteries in turn, with the same Our Father — ten Hail Marys — Glory Be — Fatima Prayer pattern.",
      },
      {
        order: 9,
        title: "Conclude",
        body: "Pray the Hail, Holy Queen, then the closing prayer: O God, whose only-begotten Son, by his life, death, and resurrection, has purchased for us the rewards of eternal life…",
      },
      {
        order: 10,
        title: "Sign of the Cross",
        body: "Conclude with the Sign of the Cross.",
      },
    ],
    durationDays: 30,
    goalTemplateSlug: "pray-rosary-daily",
  },
  {
    slug: "guide-to-confession",
    kind: "CONFESSION",
    title: "A Guide to the Sacrament of Confession",
    summary:
      "How to prepare for and make a good Confession — from examination of conscience to receiving absolution.",
    bodyText: `The Sacrament of Penance and Reconciliation is the ordinary means by which mortal sins committed after Baptism are forgiven. Regular confession of venial sins is also a pious practice that strengthens the soul.`,
    steps: [
      {
        order: 1,
        title: "Examination of conscience",
        body: "Using the Ten Commandments or a printed guide, review your thoughts, words, and actions since your last confession. Be honest and thorough.",
      },
      {
        order: 2,
        title: "Contrition",
        body: "Arouse genuine sorrow for having offended God — not merely fear of punishment. Firm purpose of amendment: intend not to sin again.",
      },
      {
        order: 3,
        title: "Enter the confessional",
        body: "Greet the priest. Make the Sign of the Cross: Bless me, Father, for I have sinned. It has been [time] since my last confession.",
      },
      {
        order: 4,
        title: "Confess your sins",
        body: "Tell your sins clearly, including kind and number for mortal sins. Avoid unnecessary detail; stick to what is needed for absolution.",
      },
      {
        order: 5,
        title: "Listen to the priest",
        body: "He may offer counsel and will give you a penance (prayers or acts of charity to perform).",
      },
      {
        order: 6,
        title: "Act of contrition",
        body: "Pray an Act of Contrition aloud: O my God, I am heartily sorry for having offended Thee…",
      },
      {
        order: 7,
        title: "Absolution",
        body: "The priest pronounces the words of absolution. Your sins are forgiven. Leave in peace.",
      },
      {
        order: 8,
        title: "Perform your penance",
        body: "Complete the penance given as soon as possible.",
      },
    ],
    durationDays: 1,
    goalTemplateSlug: "monthly-confession",
  },
  {
    slug: "eucharistic-adoration-guide",
    kind: "ADORATION",
    title: "A Guide to Eucharistic Adoration",
    summary:
      "How to spend time fruitfully in the presence of the Blessed Sacrament, whether for a holy hour or a brief visit.",
    bodyText: `Eucharistic Adoration is the practice of spending time in prayer before the Blessed Sacrament, whether reserved in the tabernacle or exposed in a monstrance. It is one of the most direct forms of union with Christ available outside of Mass itself.`,
    steps: [
      {
        order: 1,
        title: "Arrive and genuflect",
        body: "Upon entering the chapel, genuflect on your right knee to acknowledge the Real Presence of Christ.",
      },
      {
        order: 2,
        title: "Begin with praise",
        body: "Open with the Anima Christi or a short act of adoration: I adore you, Lord Jesus Christ, truly present in the Blessed Sacrament.",
      },
      {
        order: 3,
        title: "Silence and listening",
        body: "Spend time simply being present. Do not feel the need to fill the silence with words. Let Christ speak to your heart.",
      },
      {
        order: 4,
        title: "Scripture",
        body: "Read a passage of the Gospel slowly, pausing to let the words settle. The Bread of Life discourse (John 6) is especially fitting.",
      },
      {
        order: 5,
        title: "Intercession",
        body: "Bring your intentions, those of others, and the needs of the Church before the Lord.",
      },
      {
        order: 6,
        title: "Thanksgiving",
        body: "Thank God for specific gifts — his presence, the gift of faith, particular graces received.",
      },
      {
        order: 7,
        title: "Closing prayer",
        body: "End with the Divine Praises (if Benediction is given) or with a personal act of love.",
      },
    ],
    durationDays: 7,
    goalTemplateSlug: "weekly-adoration",
  },
  {
    slug: "marian-consecration-33-days",
    kind: "CONSECRATION",
    title: "33-Day Preparation for Marian Consecration",
    summary:
      "A 33-day preparation for total consecration to Jesus through Mary, following the method of Saint Louis de Montfort.",
    bodyText: `Marian consecration is an act by which a baptised Christian entrusts themselves entirely to Mary, so that she may lead them more perfectly to Christ. The most celebrated method is that of Saint Louis-Marie Grignion de Montfort, systematised in his work True Devotion to the Blessed Virgin.`,
    steps: [
      {
        order: 1,
        title: "Days 1–12: Renouncing the world",
        body: "Examine and renounce attachment to the world, sin, and self. Pray: Come, Holy Spirit. Litany of the Holy Spirit. Ave Maris Stella.",
      },
      {
        order: 2,
        title: "Days 13–19: Knowledge of self",
        body: "Deepen awareness of personal weakness and dependence on grace. Pray: Litany of the Holy Spirit. Ave Maris Stella. Psalm 50.",
      },
      {
        order: 3,
        title: "Days 20–26: Knowledge of Mary",
        body: "Study Mary's role in salvation history and her virtues. Pray: Litany of Loreto. Ave Maris Stella. Little Crown of the Blessed Virgin.",
      },
      {
        order: 4,
        title: "Days 27–33: Knowledge of Jesus",
        body: "Meditate on the Incarnation, life, and Passion of Christ. Pray: Litany of Loreto. Ave Maris Stella. O Jesus Living in Mary.",
      },
      {
        order: 5,
        title: "Day 33: Act of Consecration",
        body: "On the chosen feast day, recite the Act of Consecration: I, N., a faithless sinner, renew and ratify today in your hands, O Immaculate Mother…",
      },
    ],
    durationDays: 33,
    goalTemplateSlug: "marian-consecration",
  },
  {
    slug: "discerning-your-vocation",
    kind: "VOCATION",
    title: "Discerning Your Vocation",
    summary:
      "A prayerful guide to discovering God's particular call — to marriage, consecrated life, priesthood, or dedicated single life.",
    bodyText: `Every baptised Christian has a universal vocation to holiness (Lumen Gentium, 40). Within that, God calls each person to a particular state of life. Discernment is the prayerful process of listening for that call.`,
    steps: [
      {
        order: 1,
        title: "Establish a prayer life",
        body: "Daily Mass, Rosary, and examination of conscience create the interior quiet in which God's voice can be heard.",
      },
      {
        order: 2,
        title: "Know yourself",
        body: "What gifts, desires, and natural inclinations has God given you? Vocation often builds on these, not against them.",
      },
      {
        order: 3,
        title: "Learn the vocations",
        body: "Read about married life, priesthood, religious life, and the dedicated single life. Speak with those living each vocation.",
      },
      {
        order: 4,
        title: "Seek a spiritual director",
        body: "A wise priest or religious can help you interpret what you hear in prayer and weigh consolations and desolations.",
      },
      {
        order: 5,
        title: "Pray the 'vocation prayer'",
        body: "Lord, I want what you want. Show me the path. Give me the courage to take the first step.",
      },
      {
        order: 6,
        title: "Act and observe",
        body: "Visit a seminary, make a vocations retreat, or serve in a parish ministry. Act on the promptings you receive and note the fruit.",
      },
      {
        order: 7,
        title: "Trust and decide",
        body: "God does not torment souls he calls. At the right time, with peace and counsel, make your choice and trust in his providence.",
      },
    ],
    durationDays: 90,
    goalTemplateSlug: "vocation-discernment",
  },
  {
    slug: "the-seven-sacraments-overview",
    kind: "GENERAL",
    title: "The Seven Sacraments — A Catechetical Overview",
    summary:
      "An introduction to the seven sacraments instituted by Christ — what they are, how they are celebrated, and the grace each gives.",
    bodyText: `The sacraments are efficacious signs of grace, instituted by Christ and entrusted to the Church, by which divine life is dispensed to us (CCC 1131). The Council of Trent definitively taught that there are seven, no more and no less.`,
    steps: [
      {
        order: 1,
        title: "Baptism",
        body: "The gateway sacrament. Through water and the Trinitarian formula, original sin and all personal sins are forgiven, and the soul is made a temple of the Holy Spirit. Required for salvation. Cf. John 3:5; CCC 1213–1284.",
      },
      {
        order: 2,
        title: "Confirmation",
        body: "The sealing of baptism with the gift of the Holy Spirit. Through anointing with sacred chrism by the bishop (or his delegate), the baptised are strengthened to bear witness to Christ. Cf. Acts 8:14–17; CCC 1285–1321.",
      },
      {
        order: 3,
        title: "Eucharist",
        body: "The source and summit of Christian life (Lumen Gentium 11). At Mass, bread and wine become truly the Body, Blood, Soul, and Divinity of Jesus Christ. Cf. CCC 1322–1419.",
      },
      {
        order: 4,
        title: "Penance and Reconciliation",
        body: "The sacrament by which the baptised are reconciled with God after sin. Through contrition, confession, satisfaction, and absolution, mortal sins are forgiven and grace is restored. Cf. John 20:23; CCC 1422–1498.",
      },
      {
        order: 5,
        title: "Anointing of the Sick",
        body: "Strengthens, forgives, and consoles those gravely ill or in danger of death by anointing with the Oil of the Sick. Cf. James 5:14–15; CCC 1499–1532.",
      },
      {
        order: 6,
        title: "Holy Orders",
        body: "The sacrament of apostolic ministry — the bishop, priest, and deacon. Configures the recipient to Christ the Head and Servant. Cf. CCC 1536–1600.",
      },
      {
        order: 7,
        title: "Matrimony",
        body: "The covenant by which a baptised man and woman form an indissoluble partnership of life and love, ordered by its nature to the good of the spouses and the procreation and education of children. Cf. Mark 10:6–9; CCC 1601–1666.",
      },
    ],
  },
  {
    slug: "praying-the-liturgy-of-the-hours",
    kind: "GENERAL",
    title: "Praying the Liturgy of the Hours (Divine Office)",
    summary:
      "How to pray Lauds, Vespers, and the other hours that sanctify the day with the prayer of the universal Church.",
    bodyText: `The Liturgy of the Hours is the public, official prayer of the Church. It sanctifies the whole day by extending the praise and supplication of the Eucharist into the hours of work, meal, rest, and night (CCC 1174–1178; SC 83–101).`,
    steps: [
      {
        order: 1,
        title: "The structure",
        body: "Five hours mark the day: Office of Readings (Matins), Lauds (Morning Prayer), Daytime Prayer (Terce, Sext, None), Vespers (Evening Prayer), and Compline (Night Prayer).",
      },
      {
        order: 2,
        title: "Lauds and Vespers",
        body: "Morning and Evening Prayer are the two 'hinges' of the liturgical day (SC 89). Each consists of opening, hymn, three psalms or canticles, Scripture reading, response, Gospel canticle (Benedictus or Magnificat), intercessions, Our Father, and concluding prayer.",
      },
      {
        order: 3,
        title: "Choose a starting place",
        body: "Most lay people begin with Vespers and Compline. The four-week psalter cycles through the Psalms; lay editions abridge to a one-volume Christian Prayer.",
      },
      {
        order: 4,
        title: "Use the proper apps and books",
        body: "iBreviary, Universalis, and Liturgy of the Hours from USCCB are convenient. The complete editions in print are the four-volume Roman Liturgy of the Hours.",
      },
      {
        order: 5,
        title: "Sing or chant when you can",
        body: "The Hours are designed to be sung. Even simple recitation honours the Church's intention; chanting deepens the prayer.",
      },
      {
        order: 6,
        title: "Persevere",
        body: "The Office is the prayer of the Church, not your private devotion alone. Even a brief Compline gathers you into the worldwide voice of priests and religious praying with you.",
      },
    ],
  },
  {
    slug: "guide-to-lectio-divina",
    kind: "GENERAL",
    title: "Lectio Divina — Praying with Scripture",
    summary:
      "The classic monastic method for praying with Scripture: read, meditate, pray, contemplate.",
    bodyText: `Lectio divina ("divine reading") is a slow, contemplative reading of Scripture that lets the Word of God become prayer. It is rooted in the Rule of Saint Benedict and was systematised by the Carthusian monk Guigo II in the 12th century.`,
    steps: [
      {
        order: 1,
        title: "Lectio (read)",
        body: "Choose a short passage — a few verses of the Gospel of the day, or a psalm. Read it slowly, aloud if possible. Note any word or phrase that strikes you.",
      },
      {
        order: 2,
        title: "Meditatio (meditate)",
        body: "Linger on the passage. Repeat the word or phrase. Ask: what is God saying to me here? What memories, hopes, or concerns does it surface?",
      },
      {
        order: 3,
        title: "Oratio (pray)",
        body: "Speak to God from the heart in response to what you have heard. Thanksgiving, repentance, intercession — let the prayer arise from the text.",
      },
      {
        order: 4,
        title: "Contemplatio (contemplate)",
        body: "Rest silently in God's presence. Do not strive for words or insights; simply remain with him. This is the work of the Holy Spirit, not our effort.",
      },
      {
        order: 5,
        title: "Actio (act)",
        body: "A 5th step many writers add: carry one resolution from the prayer into your day. Let the Word bear fruit in deed.",
      },
    ],
  },
  {
    slug: "guide-to-novenas",
    kind: "DEVOTION",
    title: "How to Pray a Novena",
    summary:
      "What a novena is, why we pray nine days, and a simple template for praying any approved novena.",
    bodyText: `A novena is a Catholic devotion in which a particular prayer is repeated for nine consecutive days. The nine-day pattern echoes the nine days the Apostles and Mary spent in prayer between the Ascension and Pentecost (Acts 1:14).`,
    steps: [
      {
        order: 1,
        title: "Choose your intention",
        body: "Be specific. A novena is a prayer of confident petition, often joined to a saint's intercession.",
      },
      {
        order: 2,
        title: "Choose your novena",
        body: "Some classic novenas: Divine Mercy (the days before Mercy Sunday), the Sacred Heart, the Immaculate Conception, Our Lady of Perpetual Help, Saint Joseph, the Holy Spirit (between Ascension and Pentecost), Saint Jude.",
      },
      {
        order: 3,
        title: "Set a daily time",
        body: "Whether morning prayer, lunch, or before bed, anchor the novena to a regular moment so it does not get forgotten.",
      },
      {
        order: 4,
        title: "Pray the daily prayers",
        body: "Most novenas have nine distinct daily texts. Pray slowly, with intention. Conclude each day with three Hail Marys for the intentions of the Blessed Mother.",
      },
      {
        order: 5,
        title: "Trust the outcome",
        body: "God always answers prayer, but not always in the way we expect. A novena disposes us to receive what is best. Conclude with the Te Deum or a brief act of thanksgiving on the ninth day.",
      },
    ],
  },
  {
    slug: "guide-to-stations-of-the-cross",
    kind: "DEVOTION",
    title: "Praying the Stations of the Cross",
    summary: "How to walk the fourteen stations of Christ's Passion as a meditative pilgrimage.",
    bodyText: `The Stations of the Cross — the Via Crucis — is a devotion that retraces Christ's last journey from condemnation to burial. The fourteen stations were popularised by Franciscan friars from the 14th century onward and are found in nearly every Catholic church.`,
    steps: [
      {
        order: 1,
        title: "Begin at the first station",
        body: "Genuflect or bow at each station. Pray: 'We adore thee, O Christ, and we praise thee. Because by thy holy cross thou hast redeemed the world.'",
      },
      {
        order: 2,
        title: "The fourteen stations",
        body: "1. Jesus is condemned to death. 2. Jesus accepts the cross. 3. Jesus falls the first time. 4. Jesus meets his Mother. 5. Simon of Cyrene helps Jesus. 6. Veronica wipes the face of Jesus. 7. Jesus falls the second time. 8. Jesus meets the women of Jerusalem. 9. Jesus falls the third time. 10. Jesus is stripped of his garments. 11. Jesus is nailed to the cross. 12. Jesus dies on the cross. 13. Jesus is taken down from the cross. 14. Jesus is laid in the tomb.",
      },
      {
        order: 3,
        title: "Optional fifteenth station",
        body: "Some celebrations add a fifteenth station: the Resurrection. This emphasises that the Cross is fulfilled in the Resurrection.",
      },
      {
        order: 4,
        title: "A meditation at each station",
        body: "Read a brief Scripture passage or meditation. Pause in silence. Offer one Our Father, one Hail Mary, and one Glory Be.",
      },
      {
        order: 5,
        title: "Concluding prayer",
        body: "After the fourteenth station, pray for the intentions of the Holy Father (one Our Father, Hail Mary, and Glory Be) to gain the plenary indulgence under the usual conditions.",
      },
    ],
  },
  {
    slug: "guide-to-the-creed",
    kind: "GENERAL",
    title: "The Apostles' Creed and the Nicene Creed Explained",
    summary:
      "An article-by-article explanation of the two principal Catholic professions of faith.",
    bodyText: `A creed is a concise summary of the faith. The Apostles' Creed is the ancient baptismal symbol of the Roman Church; the Nicene-Constantinopolitan Creed (commonly called the Nicene Creed) was developed at the first two ecumenical councils and is professed at Mass on Sundays and Solemnities.`,
    steps: [
      {
        order: 1,
        title: "I believe in God, the Father almighty",
        body: "The first article confesses one God, eternal, Creator of heaven and earth — a personal Father, not a distant force.",
      },
      {
        order: 2,
        title: "And in Jesus Christ, his only Son, our Lord",
        body: "The Son is true God from true God, consubstantial with the Father (Greek: *homoousios*). The Nicene Creed adds 'begotten, not made' — affirming his divinity against Arianism.",
      },
      {
        order: 3,
        title: "Conceived by the Holy Spirit, born of the Virgin Mary",
        body: "The Incarnation: God truly became man, taking flesh from the Virgin Mary by the power of the Holy Spirit. Mary remains ever-virgin (CCC 499).",
      },
      {
        order: 4,
        title: "Suffered under Pontius Pilate",
        body: "The historical anchor: Christ was crucified at a specific moment in human history. The mention of Pilate is included precisely so the Creed cannot be mistaken for myth.",
      },
      {
        order: 5,
        title: "He descended into hell. On the third day he rose again",
        body: "Christ truly died and his soul descended to the abode of the dead to liberate the just (1 Peter 3:19). On the third day, he rose bodily — the foundation of Christian hope.",
      },
      {
        order: 6,
        title: "He ascended into heaven … will come again to judge",
        body: "Christ's enthronement at the Father's right hand and his promised return in glory.",
      },
      {
        order: 7,
        title: "I believe in the Holy Spirit",
        body: "The third Person of the Trinity, the Lord and Giver of Life. The Nicene Creed adds 'who proceeds from the Father and the Son' (the Filioque).",
      },
      {
        order: 8,
        title: "The holy catholic Church, the communion of saints",
        body: "One, holy, catholic, and apostolic — the four marks. The communion of saints unites the Church on earth, in purgatory, and in heaven.",
      },
      {
        order: 9,
        title: "The forgiveness of sins",
        body: "Effected primarily by Baptism and Penance.",
      },
      {
        order: 10,
        title: "The resurrection of the body and life everlasting",
        body: "At the Last Day, the dead will rise in their bodies — glorified for the just, in shame for the unjust. Heaven and Hell are real and final.",
      },
    ],
  },
  {
    slug: "the-our-father-explained",
    kind: "GENERAL",
    title: "The Lord's Prayer (Our Father) — Verse by Verse",
    summary: "An explanation of the seven petitions of the prayer Jesus himself taught us.",
    bodyText: `The Our Father is the prayer Christ taught his disciples (Matthew 6:9–13; Luke 11:2–4). Tertullian called it 'a summary of the whole Gospel' (De Oratione 1). The Catechism dedicates an entire fourth pillar to its exposition (CCC 2759–2865).`,
    steps: [
      {
        order: 1,
        title: "Our Father, who art in heaven",
        body: "We do not approach God alone, but as members of the Church. He is *our* Father — Father by nature of the Son, by adoption of all the baptised (Romans 8:15).",
      },
      {
        order: 2,
        title: "Hallowed be thy name",
        body: "The first petition: that God's name be revered, that we acknowledge his holiness and not profane it (Leviticus 22:32).",
      },
      {
        order: 3,
        title: "Thy kingdom come",
        body: "The second petition: for the coming of God's reign of justice and peace, both now in the Church and finally at Christ's return.",
      },
      {
        order: 4,
        title: "Thy will be done on earth as it is in heaven",
        body: "The third petition: that we do God's will perfectly here below as the angels and saints do it above. Christ models this in Gethsemane (Matthew 26:42).",
      },
      {
        order: 5,
        title: "Give us this day our daily bread",
        body: "The fourth petition: for what we need to live — physical bread, the Word, and the Eucharist (the *epiousios artos*, the supersubstantial bread, of Matthew 6:11).",
      },
      {
        order: 6,
        title: "And forgive us our trespasses, as we forgive those who trespass against us",
        body: "The fifth petition: forgiveness conditional on our forgiveness of others. Christ glosses this in Matthew 6:14–15.",
      },
      {
        order: 7,
        title: "And lead us not into temptation",
        body: "The sixth petition: that God preserve us from yielding to temptation. The 2017 Italian translation (and the 2020 Vatican-approved English alternative) clarifies: 'do not let us fall.'",
      },
      {
        order: 8,
        title: "But deliver us from evil",
        body: "The seventh petition: deliverance from the Evil One (Greek: *tou ponērou*) and from all evils.",
      },
      {
        order: 9,
        title: "For the kingdom, the power and the glory are yours",
        body: "The doxology added in liturgical use, drawn from the Didache and 1 Chronicles 29:11. Concludes with 'Amen.'",
      },
    ],
  },
  {
    slug: "general-examination-of-conscience",
    kind: "GENERAL",
    title: "General Examination of Conscience",
    summary:
      "A daily practice of reviewing the day with God — a key tool for spiritual growth and preparation for confession.",
    bodyText: `The daily examination of conscience (examen) was promoted by Saint Ignatius of Loyola. It takes five to ten minutes and is traditionally made at the end of the day.`,
    steps: [
      {
        order: 1,
        title: "Give thanks",
        body: "Recall the gifts of the day — people, moments, graces — and thank God for them.",
      },
      {
        order: 2,
        title: "Ask for light",
        body: "Ask the Holy Spirit to show you the movements of the day clearly.",
      },
      {
        order: 3,
        title: "Review the day",
        body: "Walk back through the hours: your thoughts, words, and actions. Where did you respond to grace? Where did you resist it?",
      },
      {
        order: 4,
        title: "Express sorrow",
        body: "For any sins or failures, express genuine contrition: O my God, I am sorry.",
      },
      {
        order: 5,
        title: "Look to tomorrow",
        body: "Ask for grace for the coming day, particularly in areas where you struggled today.",
      },
    ],
    durationDays: 30,
    goalTemplateSlug: "daily-examen",
  },
];
