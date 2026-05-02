import type { LiturgyKind } from "@prisma/client";

export type LiturgyEntrySeed = {
  slug: string;
  kind: LiturgyKind;
  title: string;
  summary?: string;
  body: string;
};

export const LITURGY_ENTRIES: LiturgyEntrySeed[] = [
  {
    slug: "order-of-the-mass",
    kind: "MASS_STRUCTURE",
    title: "Order of the Mass",
    summary: "The structure of the ordinary form of the Roman Rite Mass, from the Introductory Rites to the Concluding Rite.",
    body: `The Mass is divided into four principal parts: the Introductory Rites, the Liturgy of the Word, the Liturgy of the Eucharist, and the Concluding Rite.

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
    slug: "the-liturgical-year",
    kind: "LITURGICAL_YEAR",
    title: "The Liturgical Year",
    summary: "The Church's annual cycle of seasons — Advent, Christmas, Ordinary Time, Lent, and Easter — through which the faithful relive the mysteries of Christ.",
    body: `The liturgical year is the annual cycle by which the Church celebrates and makes present the entire mystery of Christ, from Incarnation to Pentecost.

**Advent** (Four weeks before Christmas)
A season of joyful expectation and preparation for the coming of Christ — both his historical birth at Bethlehem and his glorious return at the end of time. Its liturgical colour is violet (or rose on Gaudete Sunday).

**Christmas Season** (Christmas Day to the Baptism of the Lord)
Celebrating the Nativity and early life of Christ. Solemnities include the Holy Family, Mary, Mother of God (1 January), Epiphany, and the Baptism of the Lord.

**Ordinary Time (I)**
The weeks between the Christmas Season and Ash Wednesday, focusing on the ministry of Christ.

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
    slug: "sacred-symbolism-glossary",
    kind: "SYMBOLISM",
    title: "Sacred Symbolism in the Catholic Tradition",
    summary: "An introductory glossary of recurring symbols in Catholic art, architecture, and liturgy.",
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
    summary: "An overview of the Catholic Rite of Marriage — the Sacrament of Matrimony celebrated within or outside Mass.",
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
    summary: "From Nicaea I (325 AD) to Vatican II (1962–1965): the twenty-one ecumenical councils that shaped Catholic doctrine.",
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
