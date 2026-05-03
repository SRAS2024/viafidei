import type { LiturgyKind } from "@prisma/client";

export type LiturgyEntrySeed = {
  slug: string;
  kind: LiturgyKind;
  title: string;
  summary?: string;
  body: string;
};

// Database-managed liturgy content. The on-screen pages render entries from
// the LiturgyEntry table; this seed provides the initial bedrock of
// approved-source content. The automated ingestion system can append
// translations and additional entries from the Vatican allowlist over time.
export const LITURGY_ENTRIES: LiturgyEntrySeed[] = [
  {
    slug: "order-of-the-mass",
    kind: "MASS_STRUCTURE",
    title: "Order of the Mass — Overview",
    summary:
      "The structure of the ordinary form of the Roman Rite Mass, from the Introductory Rites to the Concluding Rite.",
    body: `The Mass is divided into four principal parts: the Introductory Rites, the Liturgy of the Word, the Liturgy of the Eucharist, and the Concluding Rite. Each part is composed of distinct prayers, responses, and actions that together form a single act of worship. Detailed sub-pages walk through each section.

**Introductory Rites**
The Entrance Chant, Greeting, Penitential Act (Confiteor or Kyrie), Gloria (on Sundays and feasts), and Collect open the Mass, gathering the people and preparing hearts to hear the Word.

**Liturgy of the Word**
A First Reading (usually from the Old Testament), a Responsorial Psalm, a Second Reading (Epistle), the Gospel Acclamation, the Gospel, a Homily, the Profession of Faith (Nicene Creed on Sundays), and the Prayer of the Faithful.

**Liturgy of the Eucharist**
The Preparation of the Gifts (Offertory), the Eucharistic Prayer (including the Preface, Sanctus, Consecration, and Doxology), the Lord's Prayer, the Sign of Peace, the Fraction Rite, the Agnus Dei, and Holy Communion.

**Concluding Rite**
The Blessing and Dismissal send the faithful forth to live the Mass in daily life.`,
  },
  {
    slug: "mass-introductory-rites",
    kind: "MASS_STRUCTURE",
    title: "The Introductory Rites of the Mass",
    summary:
      "How the Mass begins — the procession, greeting, penitential act, Gloria, and Collect — and what each element signifies.",
    body: `The Introductory Rites prepare the faithful to listen to God's Word and celebrate the Eucharist worthily. They establish the assembly as the gathered Body of Christ.

**Entrance Chant and Procession**
As the priest and ministers approach the altar, the people sing the Introit or an entrance hymn. The procession represents the Church's pilgrimage toward the heavenly Jerusalem.

**Veneration of the Altar and Sign of the Cross**
The priest reverences the altar — symbol of Christ — with a kiss and incense (when used). All make the Sign of the Cross: "In the name of the Father, and of the Son, and of the Holy Spirit."

**Greeting**
"The Lord be with you." / "And with your spirit." This dialogue, drawn from Ruth 2:4 and 2 Timothy 4:22, expresses the mystery of the Church gathered in Christ.

**Penitential Act**
The faithful acknowledge their sins. The Confiteor ("I confess to almighty God…") is one option; another is the dialogue "Lord, have mercy" (Kyrie eleison). The Penitential Act always concludes with absolution: "May almighty God have mercy on us, forgive us our sins, and bring us to everlasting life. Amen."

**Gloria**
On Sundays outside Lent and Advent, and on feasts and solemnities, the people sing the Gloria — an ancient hymn rooted in Luke 2:14 ("Glory to God in the highest…"). It is praise to the Trinity for the gift of salvation.

**Collect**
The priest invites all to pray, brief silence is observed, and the priest "collects" the prayers of the people in a single petition addressed to the Father through Christ. The people respond "Amen."`,
  },
  {
    slug: "mass-liturgy-of-the-word",
    kind: "MASS_STRUCTURE",
    title: "The Liturgy of the Word",
    summary:
      "The proclamation of Scripture, the homily, the Creed, and the Prayer of the Faithful — the heart of how God speaks to his people.",
    body: `The Liturgy of the Word is one of the two great tables of the Mass — Christ feeds his people first by his Word, then by his Body. The readings on Sundays follow a three-year cycle (A, B, C); weekday readings follow a two-year cycle (I, II).

**First Reading**
Usually from the Old Testament (or, in Easter, from Acts of the Apostles). It is chosen to harmonise with the Gospel, showing the unity of salvation history. Concludes with: "The word of the Lord." / "Thanks be to God."

**Responsorial Psalm**
The cantor or psalmist sings a psalm; the people repeat a refrain. Singing the psalm is the normative form. The psalm is itself God's Word given to us as our prayerful response.

**Second Reading** (Sundays and Solemnities)
From an apostolic letter (epistle), the Acts of the Apostles, or Revelation. It is not directly tied to the day's Gospel; it gives the faithful a continuous reading of the apostolic writings.

**Gospel Acclamation**
"Alleluia" (or, in Lent, a substitute acclamation) is sung as the people stand. A Gospel verse is announced. The Alleluia is the song of the heavenly liturgy itself (Revelation 19).

**The Gospel**
The deacon (or priest) proclaims the Gospel. All trace a small cross on forehead, lips, and heart — that the Gospel may be in our minds, on our lips, and in our hearts. Concludes with: "The Gospel of the Lord." / "Praise to you, Lord Jesus Christ."

**Homily**
The priest or deacon breaks open the Word for the assembly, applying it to Christian life. On Sundays and Holy Days of Obligation it is required.

**Profession of Faith (Creed)**
On Sundays and Solemnities the people profess the Nicene-Constantinopolitan Creed (or, on certain occasions, the Apostles' Creed). At "by the power of the Holy Spirit … and became man" all bow profoundly (or genuflect on Christmas and the Annunciation) — honouring the mystery of the Incarnation.

**Prayer of the Faithful (Universal Prayer)**
The faithful intercede for the Church, public authorities, those in need, and the local community. The standard sequence ends with prayers for the dead. Each petition is closed with a response such as "Lord, hear our prayer."`,
  },
  {
    slug: "mass-liturgy-of-the-eucharist",
    kind: "MASS_STRUCTURE",
    title: "The Liturgy of the Eucharist",
    summary:
      "The presentation of the gifts, the Eucharistic Prayer, the Lord's Prayer, the sign of peace, and Holy Communion.",
    body: `In the Liturgy of the Eucharist the bread and wine become, by the words of consecration and the action of the Holy Spirit, the Body and Blood, Soul and Divinity of Jesus Christ. The faithful receive him in Holy Communion and are united more deeply with him and with one another.

**Preparation of the Gifts (Offertory)**
The altar is prepared, and bread and wine are brought forward. The priest prays: "Blessed are you, Lord God of all creation, for through your goodness we have received the bread we offer you…" A small drop of water is added to the wine, recalling the union of Christ's divinity with our humanity. The priest washes his hands while quietly praying Psalm 51:2: "Lord, wash away my iniquity."

**Prayer over the Offerings**
Concluded by the people's "Amen."

**Eucharistic Prayer**
The summit of the entire celebration. There are several approved Eucharistic Prayers; the most ancient is the Roman Canon (Eucharistic Prayer I).

  **a. Preface and Sanctus**
  The Preface gives thanks for a particular aspect of the mystery of salvation. It concludes with the Sanctus: "Holy, Holy, Holy Lord God of hosts. Heaven and earth are full of your glory. Hosanna in the highest." (Isaiah 6:3; Matthew 21:9.)

  **b. Epiclesis**
  The priest invokes the Holy Spirit upon the gifts so they may become the Body and Blood of Christ.

  **c. Institution Narrative and Consecration**
  The priest speaks the words of Christ at the Last Supper: "Take this, all of you, and eat of it, for this is my Body, which will be given up for you." And: "Take this, all of you, and drink from it, for this is the chalice of my Blood, the Blood of the new and eternal covenant…" The bread and wine are now truly the Body and Blood of Christ.

  **d. Anamnesis and Memorial Acclamation**
  The Church remembers Christ's Passion, Resurrection, and Ascension. The people respond with one of the memorial acclamations: "We proclaim your Death, O Lord, and profess your Resurrection until you come again."

  **e. Offering, Intercessions, and Doxology**
  The Church offers the sacrifice of Christ to the Father, prays for the living and the dead, and concludes with the great Doxology: "Through him, and with him, and in him, O God, almighty Father, in the unity of the Holy Spirit, all glory and honour is yours, for ever and ever." All respond with the Great Amen.

**Communion Rite**

  **a. The Lord's Prayer**
  Together the assembly prays the Our Father, the prayer Jesus himself taught (Matthew 6:9–13). It is followed by the embolism ("Deliver us, Lord…") and the doxology "For the kingdom, the power and the glory are yours, now and for ever."

  **b. Sign of Peace**
  The priest invokes Christ's peace: "Peace I leave you, my peace I give you." The faithful exchange a sign of peace as a sign of communion in Christ.

  **c. Fraction and Agnus Dei**
  The priest breaks the consecrated host (recalling the breaking of bread at the Last Supper and at Emmaus). The Agnus Dei is sung: "Lamb of God, you take away the sins of the world, have mercy on us."

  **d. Invitation to Communion**
  The priest holds up the host: "Behold the Lamb of God, behold him who takes away the sins of the world. Blessed are those called to the supper of the Lamb." All respond with the centurion's words from Matthew 8:8: "Lord, I am not worthy that you should enter under my roof, but only say the word and my soul shall be healed."

  **e. Holy Communion**
  The faithful approach reverently and receive: "The Body of Christ. / Amen." Communion may be received in the hand or on the tongue, kneeling or standing, according to local norms.

  **f. Communion Chant and Silent Thanksgiving**
  As the faithful return, the Communion antiphon or hymn is sung. A period of silent thanksgiving follows.

**Prayer after Communion**
The priest gives thanks for the gift received and asks that its grace bear fruit in our lives. The people respond "Amen."`,
  },
  {
    slug: "mass-concluding-rite",
    kind: "MASS_STRUCTURE",
    title: "The Concluding Rite",
    summary: "The blessing and dismissal — and what 'Ite, missa est' means for daily life.",
    body: `The Concluding Rite is brief but theologically rich. It does not "end" the Mass so much as send the faithful out to live what they have just celebrated.

**Greeting and Final Blessing**
"The Lord be with you." / "And with your spirit." The priest blesses the people: "May almighty God bless you, the Father, and the Son, and the Holy Spirit." On certain solemnities a more elaborate solemn blessing or prayer over the people is used.

**Dismissal**
The deacon (or priest) dismisses the people with one of these formulas:
- "Go forth, the Mass is ended."
- "Go and announce the Gospel of the Lord."
- "Go in peace, glorifying the Lord by your life."
- "Go in peace."

The people respond: "Thanks be to God."

The Latin form, "Ite, missa est," is the source of the word *Mass* itself — *missa*, "sent." The faithful are sent on mission to bring Christ to the world.

**Veneration of the Altar and Recession**
The priest reverences the altar with a kiss and departs in procession, often accompanied by a closing hymn.`,
  },
  {
    slug: "mass-rite-comparison",
    kind: "MASS_STRUCTURE",
    title: "Rite Comparison — Roman, Byzantine, Maronite, and Other Catholic Liturgies",
    summary:
      "An overview of the principal Catholic liturgical rites and how their celebration of the Eucharist differs from the Roman Rite.",
    body: `The Catholic Church embraces twenty-three sui iuris Churches, each with its own liturgical patrimony. All celebrate the same one Eucharistic sacrifice; the prayers, gestures, language, and sequence differ.

**Roman (Latin) Rite**
The most widespread. The post-Conciliar Ordinary Form (the Mass of Paul VI) is celebrated in vernacular languages with elements such as the Liturgy of the Word and the Roman Canon. The Extraordinary Form (the 1962 Missale Romanum, the "Tridentine Mass") is celebrated in Latin and follows the older Roman ceremonial.

**Byzantine Rite** (Ukrainian, Melkite, Ruthenian, Romanian, and other Greek-Catholic Churches)
The Divine Liturgy of Saint John Chrysostom is the ordinary form. It is sung throughout. Distinctive features include the iconostasis screen, the Great Entrance, frequent litanies, and reception of communion under both species from a spoon.

**Maronite Rite** (Lebanese tradition)
West Syriac liturgical heritage. The Qurbono ("Holy Sacrifice") is celebrated partly in Syriac (especially the words of consecration in Aramaic, the language of Christ). The rite emphasises Eucharistic mystery and Marian theology.

**Chaldean Rite** (Iraq, India)
East Syriac heritage. Uses the Anaphora of Addai and Mari, one of the oldest extant Eucharistic prayers. Strong sense of liturgical procession and incense.

**Coptic Rite** (Egypt)
Alexandrian tradition. Distinctive triple use of the censer and a Eucharistic prayer that explicitly recalls all the Patriarchs and the entire Egyptian Christian heritage.

**Syro-Malabar and Syro-Malankara Rites** (India)
Two distinct East and West Syriac traditions, both fully Catholic and in communion with Rome.

**Armenian Rite**
Liturgy traceable to Saint Gregory the Illuminator. The use of unleavened bread (like the Latin Rite) and unmixed wine is characteristic.

**Ethiopic / Ge'ez Rite**
Alexandrian heritage with strong African inculturation. Fourteen anaphoras may be used.

Despite differences in ritual, all these Catholic Churches profess the same faith, share the same seven sacraments, and acknowledge the universal authority of the Bishop of Rome.`,
  },
  {
    slug: "the-liturgical-year",
    kind: "LITURGICAL_YEAR",
    title: "The Liturgical Year",
    summary:
      "The Church's annual cycle of seasons — Advent, Christmas, Ordinary Time, Lent, and Easter — through which the faithful relive the mysteries of Christ.",
    body: `The liturgical year is the annual cycle by which the Church celebrates and makes present the entire mystery of Christ, from Incarnation to Pentecost.

**Advent** (Four weeks before Christmas)
A season of joyful expectation and preparation for the coming of Christ — both his historical birth at Bethlehem and his glorious return at the end of time. Liturgical colour: violet (rose on Gaudete Sunday).

**Christmas Season** (Christmas Day to the Baptism of the Lord)
Celebrating the Nativity and early life of Christ. Solemnities include the Holy Family, Mary, Mother of God (1 January), Epiphany, and the Baptism of the Lord. Colour: white/gold.

**Ordinary Time (I)**
The weeks between the Christmas Season and Ash Wednesday, focusing on the ministry of Christ. Colour: green.

**Lent** (Ash Wednesday to Holy Thursday)
Forty days of penance, fasting, and almsgiving in preparation for Easter. Colour: violet.

**Sacred Triduum** (Holy Thursday evening to Easter Sunday)
The pinnacle of the liturgical year: the Mass of the Lord's Supper, the Celebration of the Lord's Passion, and the Easter Vigil.

**Easter Season** (Easter Sunday to Pentecost)
Fifty days celebrating the Resurrection. Colour: white/gold; red on Pentecost.

**Ordinary Time (II)**
The remaining weeks of the year, deepening the faithful in the mystery of Christ. Colour: green.`,
  },
  {
    slug: "history-of-the-roman-rite",
    kind: "GENERAL",
    title: "Historical Background of the Roman Rite",
    summary:
      "A short history of how the Roman Rite developed from the apostolic age through the Council of Trent and Vatican II.",
    body: `The Roman Rite is the liturgical tradition of the Diocese of Rome, which over centuries became the predominant liturgical use in the Western Church.

**Apostolic Foundations (1st century)**
The earliest Christian liturgy is described in 1 Corinthians 11, the Didache, and Saint Justin Martyr's First Apology (c. 155). The basic shape — Word, then Eucharist — is already established.

**Patristic Crystallisation (3rd–6th centuries)**
The Roman Canon, attested in Saint Ambrose's De Sacramentis, takes its mature form. Pope Gregory I (590–604) gives the calendar and chant their lasting structure (whence "Gregorian chant").

**Carolingian Synthesis (8th–9th centuries)**
Charlemagne imposes the Roman liturgy across his empire. The texts are stabilised in the Frankish-Roman synthesis.

**Medieval Diversification (11th–14th centuries)**
Many local uses (Sarum, Lyon, Braga, etc.) develop alongside the Roman Use; mendicant orders (Dominican, Franciscan) take the Roman Use across Europe.

**Tridentine Codification (1570)**
After the Council of Trent, Pope Pius V promulgates the Missale Romanum (1570), unifying the Roman Rite for the Latin Church.

**Twentieth-Century Reform (1903–1962)**
Saint Pius X reforms the breviary; Pius XII restores the Holy Week liturgy (1955); the calendar is simplified.

**Second Vatican Council Reform (1963–1970)**
Sacrosanctum Concilium, the Council's first document, calls for full and active participation. The reformed Missal of Paul VI (Novus Ordo Missae) is promulgated in 1969.

**Twenty-First Century**
A revised English translation of the Roman Missal takes effect in 2011. Pope Benedict XVI's Summorum Pontificum (2007) clarifies the use of the 1962 Missal as the Extraordinary Form. Pope Francis's Traditionis Custodes (2021) returns its regulation to local bishops.`,
  },
  {
    slug: "history-of-liturgical-vestments",
    kind: "GENERAL",
    title: "Historical Background of Liturgical Vestments",
    summary:
      "How everyday Roman clothing of the first centuries became the sacred vesture of Catholic liturgy.",
    body: `The vestments worn by clergy in the Roman Rite descend from the secular Roman clothing of late antiquity. Over centuries the Church set them apart as sacred and gave them theological meaning.

**Alb** (from Latin *alba*, "white")
A long white tunic. Symbol of the baptismal garment and of purity.

**Cincture**
The cord tied around the waist of the alb. Symbol of chastity and self-control.

**Stole**
A long band worn around the neck by the priest, or over the left shoulder by the deacon. Symbol of priestly authority and the yoke of Christ.

**Chasuble**
The outer garment worn by the priest at Mass. Descended from the Roman *paenula*, a hooded travelling cloak. Symbol of the charity that covers all things.

**Dalmatic**
The proper vestment of a deacon, descended from a tunic of Dalmatian origin.

**Cope**
A semicircular cape worn for solemn liturgies outside Mass — Vespers, processions, exposition of the Blessed Sacrament.

**Liturgical Colours**
The colours follow a system codified after Trent: white (joy), red (martyrs and the Holy Spirit), green (Ordinary Time), violet (penance), rose (Gaudete and Laetare Sundays), and black (funerals, retained as an option).`,
  },
  {
    slug: "history-of-sacred-music",
    kind: "GENERAL",
    title: "Historical Background of Catholic Sacred Music",
    summary:
      "From psalm singing in the apostolic age to Gregorian chant, polyphony, and the modern rediscovery of sacred music.",
    body: `**Apostolic and Patristic Origins**
The first Christians sang psalms (Ephesians 5:19, Colossians 3:16). Saint Ambrose (4th century) introduced antiphonal hymn singing in Milan.

**Gregorian Chant**
Named for Pope Gregory I, Gregorian chant — single-line, unaccompanied, modal — was the cantus proprius of the Roman Rite for over a thousand years. Vatican II affirmed it as proper to the Roman liturgy and "to be given pride of place" (Sacrosanctum Concilium 116).

**Polyphony**
The development of multi-voice music from the 9th century onward culminated in the polyphony of Palestrina, Victoria, Lassus, and Byrd.

**The Cecilian Movement**
The 19th-century movement to restore Gregorian chant and Renaissance polyphony as the proper music of the Roman liturgy.

**Vatican II and After**
Sacrosanctum Concilium calls for the treasury of sacred music to be preserved and increased. Vernacular hymnody flourished alongside chant. The pipe organ remains "held in high esteem in the Latin Church."`,
  },
  {
    slug: "sacred-symbolism-glossary",
    kind: "SYMBOLISM",
    title: "Sacred Symbolism in the Catholic Tradition",
    summary:
      "An introductory glossary of recurring symbols in Catholic art, architecture, and liturgy.",
    body: `Catholic worship is rich with symbolic language drawn from Scripture, patristic tradition, and centuries of sacred art.

**The Cross**
The central symbol of Christianity, representing the redemptive death of Christ. The Latin cross, crucifix, and empty cross each carry distinct emphases.

**The Fish (Ichthys)**
From the Greek acronym Iēsous Christos Theou Yios Sōtēr (Jesus Christ, Son of God, Saviour). An early Christian secret symbol, still used today.

**The Chi-Rho (☧)**
A monogram of the first two letters of "Christ" in Greek. Emperor Constantine's battle standard after his vision before the Battle of Milvian Bridge (312 AD).

**Alpha and Omega (Α Ω)**
"I am the Alpha and the Omega," says the Lord God (Revelation 1:8). Christ as the beginning and end of all things.

**The Lamb**
Agnus Dei — Lamb of God. Christ as the Passover Lamb whose sacrifice takes away the sins of the world (John 1:29).

**The Dove**
The Holy Spirit, recalling the Spirit's descent at Christ's baptism (Matthew 3:16). Also the dove of Noah, symbol of peace and the end of divine judgment.

**Candles**
Light of Christ dispersing the darkness of sin and death. The Paschal Candle is the pre-eminent symbol of the Risen Christ.

**Incense**
"Let my prayer be counted as incense before you" (Psalm 141:2). Rising smoke symbolises prayer ascending to God and honours the presence of Christ.`,
  },
  {
    slug: "rite-of-marriage",
    kind: "MARRIAGE_RITE",
    title: "The Rite of Marriage",
    summary:
      "An overview of the Catholic Rite of Marriage — the Sacrament of Matrimony celebrated within or outside Mass.",
    body: `The Sacrament of Matrimony is administered by the spouses themselves; the priest (or deacon) acts as the Church's official witness.

**The Order of Celebrating Matrimony within Mass**
After the Liturgy of the Word, the Rite of Marriage takes place: the address by the celebrant, the questions before the consent (freedom, fidelity, children), the exchange of consent (the vows), the blessing and giving of rings, the Prayer of the Faithful, and the nuptial blessing at the end of the Eucharistic Prayer.

**The Exchange of Consent**
"I, N., take you, N., to be my wife/husband. I promise to be faithful to you, in good times and in bad, in sickness and in health, to love you and to honour you all the days of my life."

**The Nuptial Blessing**
A solemn blessing over the couple invoking God's grace upon the marriage and the family that may spring from it.

**The Unity Candle and Other Customs**
While optional, many parishes include the lighting of a unity candle (symbolising two lives becoming one) and the presentation of lazo or arras according to cultural traditions.`,
  },
  {
    slug: "council-of-nicaea",
    kind: "COUNCIL_TIMELINE",
    title: "The Ecumenical Councils: A Timeline",
    summary:
      "From Nicaea I (325 AD) to Vatican II (1962–1965): the twenty-one ecumenical councils that shaped Catholic doctrine.",
    body: `An ecumenical council is a solemn assembly of the world's bishops convened by the Pope to define doctrine, address heresy, or reform discipline. The Catholic Church recognises twenty-one such councils.

**Nicaea I (325)** — Defined the full divinity of Christ against Arianism; produced the Nicene Creed.

**Constantinople I (381)** — Confirmed the divinity of the Holy Spirit; completed the Nicene-Constantinopolitan Creed.

**Ephesus (431)** — Defined Mary as Theotokos (God-bearer) against Nestorianism.

**Chalcedon (451)** — Defined Christ as one Person with two natures (divine and human) against Monophysitism.

**Trent (1545–1563)** — The Counter-Reformation council: defined Scripture and Tradition, justification, the seven sacraments, and reformed the liturgy.

**Vatican I (1869–1870)** — Defined papal infallibility and the primacy of the Roman Pontiff.

**Vatican II (1962–1965)** — Called by Blessed John XXIII; produced sixteen documents on the Church, liturgy, ecumenism, and the Church in the modern world. Its four constitutions — Lumen Gentium, Dei Verbum, Sacrosanctum Concilium, and Gaudium et Spes — remain authoritative.`,
  },
];
