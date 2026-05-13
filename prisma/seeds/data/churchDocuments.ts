import type { LiturgyEntrySeed } from "./liturgyEntries";

/**
 * Seed entries for the Catechism of the Catholic Church and the Code of
 * Canon Law (Latin Church). Each row is a LiturgyEntry with kind=GLOSSARY
 * for catechism sections and kind=GENERAL for canon law books, sufficient
 * to surface them in /liturgy-history.
 *
 * Body text summarizes the section and points to the canonical source
 * (vatican.va) where the full text resides. The ingestion pipeline pulls
 * additional passages over time.
 */
export const CHURCH_DOCUMENT_ENTRIES: LiturgyEntrySeed[] = [
  // ──────────────────────────────────────────────────────────────────
  //  CATECHISM OF THE CATHOLIC CHURCH (CCC)
  //  Promulgated 11 October 1992 by Pope John Paul II; revised 1997.
  // ──────────────────────────────────────────────────────────────────
  {
    slug: "catechism-overview",
    kind: "GLOSSARY",
    title: "Catechism of the Catholic Church — Overview",
    summary:
      "The official compendium of Catholic doctrine promulgated by Pope John Paul II in 1992.",
    body: `The Catechism of the Catholic Church (Catechismus Catholicae Ecclesiae) was promulgated by Pope John Paul II on 11 October 1992 — the thirtieth anniversary of the opening of the Second Vatican Council — through the apostolic constitution Fidei Depositum. A revised editio typica was released in Latin in 1997 (Pope John Paul II).

The CCC is organized into four parts:
  • Part One — The Profession of Faith (the Apostles' Creed)
  • Part Two — The Celebration of the Christian Mystery (the Sacraments and Liturgy)
  • Part Three — Life in Christ (the Commandments and the moral life)
  • Part Four — Christian Prayer (with the Lord's Prayer)

It contains 2,865 numbered paragraphs and is intended as a "sure norm for teaching the faith" and a reference text for catechisms produced by particular Churches. The full text is published at vatican.va.`,
  },
  {
    slug: "catechism-part-1-profession-of-faith",
    kind: "GLOSSARY",
    title: "CCC Part One — The Profession of Faith",
    summary: "What the Church believes: the Apostles' Creed unfolded article by article.",
    body: `Part One of the Catechism (paragraphs 26–1065) treats the divine Revelation given in Sacred Scripture and Sacred Tradition, the response of faith, and the unfolding of that faith in the twelve articles of the Apostles' Creed.

Section One — "I Believe" / "We Believe" — treats the human capacity for God and his self-revelation in Christ, transmitted to us through the Church.

Section Two — The Profession of the Christian Faith — comments on the Creed article by article: God the Father and Creator, Jesus Christ the only Son of God, his Incarnation, Passion, Resurrection, and Ascension, the Holy Spirit, the Holy Catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting.`,
  },
  {
    slug: "catechism-part-2-celebration-of-the-mystery",
    kind: "GLOSSARY",
    title: "CCC Part Two — The Celebration of the Christian Mystery",
    summary: "The sacramental economy: how Christ acts in and through the liturgy.",
    body: `Part Two (paragraphs 1066–1690) treats the Sacred Liturgy and the Seven Sacraments.

Section One sets out the principles of liturgical theology: the liturgy as the work of the Holy Trinity, the paschal mystery, the sacramental economy.

Section Two treats the Seven Sacraments of the Church grouped under three headings:
  • Sacraments of Christian Initiation — Baptism, Confirmation, and the Eucharist
  • Sacraments of Healing — Penance and Reconciliation, and the Anointing of the Sick
  • Sacraments at the Service of Communion — Holy Orders and Matrimony

Each sacrament is treated under its sign, its institution by Christ, its minister, recipient, effects, and necessity.`,
  },
  {
    slug: "catechism-part-3-life-in-christ",
    kind: "GLOSSARY",
    title: "CCC Part Three — Life in Christ",
    summary: "Catholic moral teaching: the human vocation and the Ten Commandments.",
    body: `Part Three (paragraphs 1691–2557) treats Christian moral life as the response of the human person to the divine call.

Section One — Man's Vocation: Life in the Spirit — covers the dignity of the human person, human community, and God's salvation through law and grace, including the Beatitudes and the gifts of the Holy Spirit.

Section Two — The Ten Commandments — treats each commandment in turn as a privileged expression of the natural moral law, illuminated by Christ's revelation and the Church's living Tradition.`,
  },
  {
    slug: "catechism-part-4-christian-prayer",
    kind: "GLOSSARY",
    title: "CCC Part Four — Christian Prayer",
    summary: "Prayer in the Christian life, culminating in the Our Father.",
    body: `Part Four (paragraphs 2558–2865) treats Christian prayer.

Section One — Prayer in the Christian Life — sets out the meaning, sources, expressions, and practice of prayer, including its difficulties and the battle of prayer.

Section Two — The Lord's Prayer "Our Father" — is a sustained commentary on the seven petitions of the Pater Noster, presented as the summary of the whole Gospel.`,
  },
  // Key CCC sections
  {
    slug: "catechism-on-the-mass",
    kind: "GLOSSARY",
    title: "CCC §1322–1419 — The Sacrament of the Eucharist",
    summary: "The Catechism's full treatment of the Most Holy Eucharist.",
    body: `Paragraphs 1322–1419 of the Catechism set out the doctrine of the Eucharist as the source and summit of the Christian life: its institution by Christ at the Last Supper, the names by which it is called (Eucharist, Lord's Supper, the Breaking of Bread, the Holy Sacrifice, Holy Communion, Holy Mass), the liturgical celebration, the sacrificial dimension, the Real Presence and transubstantiation, and the worship of the Eucharist outside Mass.`,
  },
  {
    slug: "catechism-on-the-creed",
    kind: "GLOSSARY",
    title: "CCC §26–1065 — The Apostles' Creed",
    summary: "The Catechism's commentary on the twelve articles of the Creed.",
    body: `The Catechism's commentary on the Apostles' Creed covers each article in detail: the existence of God, the Trinity, creation, the fall, Christology, the Holy Spirit, the Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting.`,
  },
  {
    slug: "catechism-on-the-our-father",
    kind: "GLOSSARY",
    title: "CCC §2759–2865 — The Lord's Prayer",
    summary: "The Catechism's commentary on each petition of the Our Father.",
    body: `Paragraphs 2759–2865 comment on the Pater Noster phrase by phrase: the address "Our Father in heaven", the three theological petitions (your name, your kingdom, your will), and the four anthropological petitions (daily bread, forgive us, lead us not into temptation, deliver us from evil).`,
  },
  {
    slug: "catechism-on-the-ten-commandments",
    kind: "GLOSSARY",
    title: "CCC §2052–2557 — The Ten Commandments",
    summary: "The Catechism's commentary on the Decalogue.",
    body: `Each of the Ten Commandments is treated as a privileged expression of the natural law, refined and elevated by Christ's teaching. The Catechism shows how each commandment opens onto positive virtues and concrete acts of love of God and neighbor.`,
  },
  {
    slug: "catechism-on-grace-and-justification",
    kind: "GLOSSARY",
    title: "CCC §1987–2029 — Grace and Justification",
    summary: "How the human person is renewed in the Holy Spirit.",
    body: `The Catechism treats justification as the work of God's grace cleansing us of sin and communicating the righteousness of God through faith in Jesus Christ. It distinguishes sanctifying grace, actual grace, sacramental graces, charisms, and the graces of state.`,
  },
  {
    slug: "catechism-on-the-virtues",
    kind: "GLOSSARY",
    title: "CCC §1803–1845 — The Virtues",
    summary: "Theological and cardinal virtues; gifts and fruits of the Spirit.",
    body: `The Catechism teaches that virtues are firm dispositions of intellect and will to do good. The four cardinal virtues — prudence, justice, fortitude, and temperance — are the hinge virtues of natural moral life. The three theological virtues — faith, hope, and charity — are infused by God and have God himself as their direct object.`,
  },

  // ──────────────────────────────────────────────────────────────────
  //  CODE OF CANON LAW (CIC 1983, Latin Church)
  //  Promulgated 25 January 1983 by Pope John Paul II.
  //  Substantively revised by Mitis Iudex (2015), Episcopalis Communio
  //  (2018), and Pascite Gregem Dei (2021).
  // ──────────────────────────────────────────────────────────────────
  {
    slug: "code-of-canon-law-overview",
    kind: "GENERAL",
    title: "Code of Canon Law (1983) — Overview",
    summary: "The current law of the Latin Catholic Church.",
    body: `The 1983 Code of Canon Law (Codex Iuris Canonici, abbreviated CIC) was promulgated by Pope John Paul II on 25 January 1983 through the apostolic constitution Sacrae Disciplinae Leges and entered into force on the First Sunday of Advent, 27 November 1983. It replaced the 1917 Pio-Benedictine Code.

The Code contains 1,752 canons organized into seven books. Its companion Code of Canons of the Eastern Churches (CCEO), governing the 23 Eastern Catholic Churches sui iuris, was promulgated by John Paul II in 1990.

Several books have been substantially updated since 1983:
  • Book VII (Marriage nullity processes) — Mitis Iudex Dominus Iesus, 2015.
  • Book II (Synodality) — Episcopalis Communio, 2018.
  • Book VI (Penal sanctions) — Pascite Gregem Dei, 2021, effective 8 December 2021.`,
  },
  {
    slug: "code-of-canon-law-book-1-general-norms",
    kind: "GENERAL",
    title: "CIC Book I — General Norms",
    summary: "Foundational principles: ecclesiastical laws, custom, persons, juridic acts.",
    body: `Book I (canons 1–203) sets out the general principles of canon law: the nature and binding force of ecclesiastical laws, custom, general decrees and instructions, juridic acts, physical and juridic persons, time, and the canonical interpretation of laws.`,
  },
  {
    slug: "code-of-canon-law-book-2-people-of-god",
    kind: "GENERAL",
    title: "CIC Book II — The People of God",
    summary: "Rights and obligations of the faithful; the Church's hierarchical and consecrated structures.",
    body: `Book II (canons 204–746) treats the Christian faithful — their fundamental rights and obligations — and the hierarchical constitution of the Church: the Roman Pontiff, the College of Bishops, the Synod of Bishops (significantly revised by Episcopalis Communio, 2018), the Roman Curia, particular Churches (dioceses), parishes, and consecrated life.`,
  },
  {
    slug: "code-of-canon-law-book-3-teaching-office",
    kind: "GENERAL",
    title: "CIC Book III — The Teaching Office of the Church",
    summary: "The ministry of the divine word, catechesis, and Catholic education.",
    body: `Book III (canons 747–833) treats the Church's teaching office: the ministry of the divine word, the missionary action of the Church, Catholic education, ecclesiastical universities and faculties, instruments of social communication, and the profession of faith.`,
  },
  {
    slug: "code-of-canon-law-book-4-sanctifying-office",
    kind: "GENERAL",
    title: "CIC Book IV — The Sanctifying Office of the Church",
    summary: "The seven sacraments, sacred places and times, and the rest of the liturgy.",
    body: `Book IV (canons 834–1253) governs the sanctifying office: the seven sacraments (Baptism, Confirmation, Most Holy Eucharist, Penance, Anointing of the Sick, Orders, and Marriage), the other acts of divine worship (sacramentals, the liturgy of the hours, ecclesiastical funerals, the cult of the saints, sacred images, and relics), and sacred places and times.`,
  },
  {
    slug: "code-of-canon-law-book-5-temporal-goods",
    kind: "GENERAL",
    title: "CIC Book V — The Temporal Goods of the Church",
    summary: "Acquisition, administration, contracts, and pious wills.",
    body: `Book V (canons 1254–1310) governs the temporal goods of the Church: their acquisition, administration, contracts, and pious wills and foundations.`,
  },
  {
    slug: "code-of-canon-law-book-6-sanctions",
    kind: "GENERAL",
    title: "CIC Book VI — Sanctions in the Church (revised 2021)",
    summary: "Penal law; substantially revised by Pope Francis in Pascite Gregem Dei.",
    body: `Book VI (canons 1311–1399) treats the Church's penal law: offenses against the faith and unity of the Church, against ecclesiastical authorities, the freedom of the Church, and against special obligations of clerics and religious. The book was substantially revised by Pope Francis through the apostolic constitution Pascite Gregem Dei (23 May 2021), effective 8 December 2021, introducing clearer penalties for sexual abuse of minors and vulnerable adults and tightening procedural norms.`,
  },
  {
    slug: "code-of-canon-law-book-7-processes",
    kind: "GENERAL",
    title: "CIC Book VII — Processes",
    summary: "Tribunals, judicial process, marriage nullity processes, administrative procedure.",
    body: `Book VII (canons 1400–1752) governs ecclesiastical processes: trials in general, the contentious trial, special processes (especially marriage nullity processes, revised by Pope Francis in Mitis Iudex Dominus Iesus, 2015), the penal process, the administrative procedure for the removal of pastors, and the procedure in administrative recourse.`,
  },
  {
    slug: "code-of-canons-of-the-eastern-churches",
    kind: "GENERAL",
    title: "Code of Canons of the Eastern Churches (CCEO, 1990)",
    summary: "The law of the 23 Eastern Catholic Churches in communion with Rome.",
    body: `The Code of Canons of the Eastern Churches (Codex Canonum Ecclesiarum Orientalium) was promulgated by Pope John Paul II on 18 October 1990 and entered into force on 1 October 1991. It contains 1,546 canons in 30 titles and governs the 23 sui iuris Eastern Catholic Churches in full communion with the Bishop of Rome.`,
  },
];
