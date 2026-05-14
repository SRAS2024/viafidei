import type { SpiritualLifeGuideSeed } from "./spiritualLifeGuides";

/**
 * Seed entries for the Seven Sacraments and the four major personal
 * consecrations. Each entry is a SpiritualLifeGuide row whose `slug`
 * is namespaced with `sacrament-` or `consecration-` so the new
 * /sacraments tab can filter the catalog by prefix without a schema
 * migration.
 *
 * Each row carries:
 *   • Title — the sacrament/consecration name
 *   • Summary — a single-sentence description for catalog cards
 *   • bodyText — the catechetical explanation, history, scriptural and
 *     magisterial grounding, and the practical effect of the rite
 *   • steps — the canonical preparation (when present)
 *   • goalTemplateSlug — wires the "Add as goal" button to the matching
 *     goal-template (sacrament completion / consecration journey)
 */

const SACRAMENTS: SpiritualLifeGuideSeed[] = [
  {
    slug: "sacrament-baptism",
    kind: "DEVOTION",
    title: "Baptism — Sacrament of Christian Initiation",
    summary:
      "The first of the seven sacraments and the gateway to the Christian life — by water and the word the soul is reborn in Christ.",
    bodyText: `Baptism is the first of the seven sacraments and the gateway to the Christian life. By water and the word, the soul is reborn in Christ, freed from original sin, made an adopted child of the Father, and incorporated into the Church (CCC §1213).

**Institution.** Christ himself instituted Baptism. After his Resurrection he commanded the Apostles: "Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit" (Matthew 28:19).

**Matter and Form.** The matter is true water; the form is the Trinitarian formula: "I baptize you in the name of the Father, and of the Son, and of the Holy Spirit." The minister is ordinarily a priest or deacon; in case of necessity any person, even a non-baptized person, can baptize validly using true water and the Trinitarian formula with the intention of doing what the Church does.

**Effects.** Baptism remits all sin — original sin and all personal sin — and all the temporal punishment due to sin. It infuses sanctifying grace, the theological virtues (faith, hope, charity), and the gifts of the Holy Spirit. It imprints an indelible spiritual character (sphragis) on the soul, so the sacrament can never be repeated (CCC §1262–1274).

**Authority.** "Unless one is born of water and the Spirit, he cannot enter the kingdom of God" (John 3:5). The Council of Trent infallibly defined the necessity, matter, form, and effects of Baptism (Session VII, 1547). The Catechism of the Catholic Church treats Baptism at §1213–1284.

**As a goal in this app.** Baptism is the first of the three Sacraments of Christian Initiation. Adult candidates ordinarily receive Baptism through the Order of Christian Initiation of Adults (OCIA, formerly RCIA).`,
    goalTemplateSlug: "sacrament-baptism",
  },
  {
    slug: "sacrament-confirmation",
    kind: "DEVOTION",
    title: "Confirmation — Sealed with the Gift of the Holy Spirit",
    summary:
      "The completion of baptismal grace by which the Holy Spirit is conferred with the fullness of his sevenfold gifts.",
    bodyText: `Confirmation completes the grace of Baptism. Through the anointing with sacred chrism and the laying on of hands, the Holy Spirit is conferred with the fullness of his sevenfold gifts (wisdom, understanding, counsel, fortitude, knowledge, piety, fear of the Lord). The candidate is "sealed with the Gift of the Holy Spirit" (CCC §1285–1321).

**Institution and biblical basis.** "Now when the Apostles at Jerusalem heard that Samaria had received the word of God, they sent Peter and John to them. They came down and prayed for them that they might receive the Holy Spirit … Then they laid their hands on them and they received the Holy Spirit" (Acts 8:14–17). The post-baptismal anointing developed quickly into a distinct sacramental act in apostolic times.

**Matter and Form.** The matter is the anointing with sacred chrism (consecrated by the bishop at the Chrism Mass) on the forehead. The form in the Latin Rite is: "Be sealed with the Gift of the Holy Spirit." The ordinary minister is the bishop; priests may confirm in danger of death and by faculty.

**Effects.** Confirmation gives the increase and deepening of baptismal grace, roots us more deeply in our divine filiation, unites us more firmly to Christ, increases the gifts of the Holy Spirit, makes our bond with the Church more perfect, and gives a special strength to spread and defend the faith (CCC §1303). It imprints an indelible character; the sacrament is therefore unrepeatable.

**Authority.** The Council of Trent defined Confirmation as a true sacrament instituted by Christ (Session VII, 1547). The Catechism treats Confirmation at §1285–1321.`,
    goalTemplateSlug: "sacrament-confirmation",
  },
  {
    slug: "sacrament-eucharist",
    kind: "ADORATION",
    title: "The Most Holy Eucharist — Source and Summit",
    summary:
      "The sacrament in which Jesus Christ is truly, really, and substantially present under the appearances of bread and wine.",
    bodyText: `The Eucharist is "the source and summit of the Christian life" (Lumen Gentium 11). Under the appearances of bread and wine the body, blood, soul, and divinity of Jesus Christ is truly, really, and substantially present. The change is called transubstantiation (CCC §1373–1377).

**Institution.** Christ instituted the Eucharist at the Last Supper on Holy Thursday: "Take, eat; this is my body … Drink of it, all of you, for this is my blood of the covenant, which is poured out for many for the forgiveness of sins" (Matthew 26:26–28). Saint Paul records the same institution narrative in 1 Corinthians 11:23–26, and concludes: "as often as you eat this bread and drink the cup, you proclaim the Lord's death until he comes."

**Sacrifice and Sacrament.** The Eucharist is both a sacrifice and a sacrament. As sacrifice it is the same one Sacrifice of Calvary made present sacramentally upon the altar (CCC §1366). As sacrament it is the food of pilgrims, the medicine of immortality, and the pledge of future glory.

**The Real Presence.** Christ's Real Presence is whole and entire under each of the species and in every fragment (concomitance). The Eucharist remains the Real Presence as long as the species of bread and wine remain. This is why Catholics reserve, adore, and worship the Blessed Sacrament (CCC §1378).

**Authority.** The Council of Trent infallibly defined the Real Presence, transubstantiation, and the sacrificial character of the Mass (Session XIII, 1551 and Session XXII, 1562). Pope Paul VI reaffirmed the same teaching in Mysterium Fidei (1965) against contemporary attempts to reduce the Eucharist to symbolism. Pope John Paul II's encyclical Ecclesia de Eucharistia (2003) and the Catechism §1322–1419 give the fullest modern treatment.

**As a goal in this app.** Eucharistic reception begins with First Holy Communion (typically around age 7 in the Latin Church) and is renewed at every Mass thereafter.`,
    goalTemplateSlug: "sacrament-first-communion",
  },
  {
    slug: "sacrament-reconciliation",
    kind: "CONFESSION",
    title: "Penance and Reconciliation — Confession",
    summary:
      "The sacrament of mercy by which sins committed after Baptism are forgiven and the penitent is reconciled with God and the Church.",
    bodyText: `The Sacrament of Penance — also called Reconciliation, Confession, Conversion, or Forgiveness — is the sacrament of mercy by which sins committed after Baptism are forgiven and the penitent is reconciled with God and the Church (CCC §1422–1498).

**Institution.** On the evening of his Resurrection, Christ breathed on the Apostles and said: "Receive the Holy Spirit. If you forgive the sins of any, they are forgiven; if you retain the sins of any, they are retained" (John 20:22–23). The Apostles received the authority to forgive sins in Christ's name.

**The four acts of the penitent.** Contrition (sorrow for sin, with the resolution not to sin again), confession (telling the priest one's sins), satisfaction (performing the penance imposed), and absolution (received from the priest as Christ's minister) (CCC §1450–1460).

**Matter and Form.** The matter is the penitent's own acts of contrition, confession, and satisfaction. The form is the prayer of absolution: "I absolve you from your sins in the name of the Father, and of the Son, and of the Holy Spirit."

**Effects.** Reconciliation with God (the principal effect), reconciliation with the Church, remission of the eternal punishment due to mortal sin, remission (at least in part) of temporal punishment, peace of conscience, and an increase of spiritual strength for the Christian battle (CCC §1496).

**Frequency.** Every Catholic is obliged to confess any mortal sin at least once a year, and before receiving Holy Communion if conscious of mortal sin. The faithful are warmly encouraged to confess venial sins also; frequent confession is one of the great means of growth in holiness.

## How to Go to Confession — A Step-by-Step Guide

**1. Preparation.** Before entering the confessional, find a quiet place and ask the Holy Spirit to enlighten your conscience. Recall the time since your last confession, the major events and decisions that filled it, and any persistent struggles.

**2. Examination of Conscience.** Slowly review your thoughts, words, deeds, and omissions against the Ten Commandments, the Beatitudes, the precepts of the Church, and the duties of your state in life. A traditional outline:

  • *First Commandment — I am the Lord your God; you shall have no strange gods before me.* Have I given God first place in my life? Have I doubted the faith, dabbled in superstition, neglected prayer or the sacraments?
  • *Second — You shall not take the name of the Lord your God in vain.* Have I used God's name irreverently? Broken a vow or oath?
  • *Third — Remember to keep holy the Lord's Day.* Have I deliberately missed Sunday Mass or a Holy Day of Obligation? Have I worked unnecessarily on Sunday or neglected its rest?
  • *Fourth — Honor your father and mother.* Have I respected, supported, and prayed for my parents, family, lawful superiors? As a parent, have I cared spiritually and materially for those entrusted to me?
  • *Fifth — You shall not kill.* Have I harmed others in word, thought, or deed? Held hatred or contempt? Driven recklessly? Cooperated in abortion, euthanasia, or grave injustice? Cared for my own life and health?
  • *Sixth and Ninth — You shall not commit adultery; you shall not covet your neighbour's wife.* Have I sinned against chastity in thought, look, or deed — alone or with another? Consumed pornography? Indulged impurity in conversation or media? Been faithful in marriage?
  • *Seventh and Tenth — You shall not steal; you shall not covet your neighbour's goods.* Have I taken what is not mine? Cheated in school, work, business, taxes? Damaged property? Failed to make restitution? Indulged envy or greed?
  • *Eighth — You shall not bear false witness.* Have I lied? Gossiped, slandered, judged rashly? Failed to defend the reputation of others?

**3. Contrition.** True sorrow for sin — not because of consequences but because sin offends a good and loving God — is the essential interior act. *Perfect contrition* is sorrow rooted in love of God; *imperfect contrition* (attrition) is sorrow rooted in fear of just punishment. Both suffice for the sacrament. Make a firm purpose of amendment: a real intention to avoid the sin and the occasions that lead to it.

**4. Entering the Confessional.** You may confess face-to-face or behind a screen — both are valid. Begin: *"Bless me, Father, for I have sinned. It has been [length of time] since my last confession. These are my sins…"*

**5. Confess Your Sins.** Tell your sins clearly and simply. For *mortal sins*, name the sin, its species, and approximate number ("I missed Sunday Mass three times"). Do not minimise; do not exaggerate; do not blame others. For *venial sins*, a general statement is sufficient. If you are uncertain whether a sin is mortal, mention it — the priest is there to help, not to judge.

**6. Counsel and Penance.** The priest may offer guidance and will assign a *penance* — usually prayers, an act of charity, or a small mortification. The penance is part of the *satisfaction* you offer for your sins; it is not a payment, but a real expression of your contrition.

**7. Act of Contrition.** When invited, pray an Act of Contrition aloud:

> *O my God, I am heartily sorry for having offended Thee, and I detest all my sins because of Thy just punishments, but most of all because they offend Thee, my God, who art all-good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasions of sin. Amen.*

**8. Absolution.** The priest extends his hand and prays the formula of absolution: *"God, the Father of mercies, through the death and resurrection of his Son has reconciled the world to himself and sent the Holy Spirit among us for the forgiveness of sins; through the ministry of the Church may God give you pardon and peace, and I absolve you from your sins in the name of the Father, and of the Son, and of the Holy Spirit."* You answer *"Amen."* Your sins are forgiven by Christ himself.

**9. After Confession.** Leave the confessional in peace. Find a quiet place, kneel, and pray the *Te Deum*, the *Magnificat*, or simply give thanks. Complete your penance as soon as practicable. Resolve concrete steps to avoid the occasions of the sins you confessed.

**Spiritual follow-up.** Confession is a moment in a longer conversion. Find a confessor you can return to. Read Scripture daily, frequent the Eucharist, pray a daily examen, and consider regular monthly confession — the spiritual masters describe it as one of the most powerful means of growth in holiness.`,
    steps: [
      {
        order: 1,
        title: "Preparation",
        body: "Find a quiet place. Ask the Holy Spirit to enlighten your conscience. Recall the time since your last confession.",
      },
      {
        order: 2,
        title: "Examination of conscience",
        body: "Review your thoughts, words, deeds, and omissions against the Ten Commandments, the Beatitudes, and the duties of your state in life.",
      },
      {
        order: 3,
        title: "Contrition",
        body: "Arouse true sorrow for sin because sin offends a good and loving God. Make a firm purpose of amendment.",
      },
      {
        order: 4,
        title: "Enter the confessional",
        body: "Greet the priest. Make the Sign of the Cross and say: ‘Bless me, Father, for I have sinned. It has been [length of time] since my last confession.’",
      },
      {
        order: 5,
        title: "Confess your sins",
        body: "Tell your sins clearly. Name the kind and approximate number of mortal sins. Do not minimise or exaggerate.",
      },
      {
        order: 6,
        title: "Counsel and penance",
        body: "Listen to the priest's counsel. Accept the penance he assigns — it is a real expression of your contrition.",
      },
      {
        order: 7,
        title: "Act of contrition",
        body: "Pray aloud: ‘O my God, I am heartily sorry for having offended Thee…’",
      },
      {
        order: 8,
        title: "Absolution",
        body: "The priest extends his hand and pronounces the words of absolution. Your sins are forgiven by Christ.",
      },
      {
        order: 9,
        title: "After confession",
        body: "Leave in peace. Give thanks. Complete your penance as soon as practicable. Resolve concrete steps to avoid the occasions of sin.",
      },
    ],
    goalTemplateSlug: "monthly-confession",
  },
  {
    slug: "sacrament-anointing-of-the-sick",
    kind: "DEVOTION",
    title: "Anointing of the Sick — Sacrament of Healing",
    summary:
      "The sacrament given to those in danger of death from sickness or old age, conferring strength, peace, and (when expedient) the forgiveness of sins.",
    bodyText: `The Anointing of the Sick — historically called Extreme Unction or Last Rites — is the sacrament given to those who are seriously ill or in danger of death from sickness or old age. It confers strength, peace, and courage to overcome the difficulties that accompany serious illness, and the forgiveness of sins if the sick person is not able to obtain it through the Sacrament of Penance (CCC §1499–1532).

**Institution.** "Is anyone among you sick? Let him call for the elders of the church, and let them pray over him, anointing him with oil in the name of the Lord; and the prayer of faith will save the sick man, and the Lord will raise him up; and if he has committed sins, he will be forgiven" (James 5:14–15).

**Matter and Form.** The matter is the anointing with the Oil of the Sick (blessed by the bishop at the Chrism Mass) on the forehead and hands. The form is: "Through this holy anointing may the Lord in his love and mercy help you with the grace of the Holy Spirit. May the Lord who frees you from sin save you and raise you up."

**The minister** is a priest. The recipient is any baptized Catholic who has reached the age of reason and is in danger of death from sickness or old age. The sacrament may be repeated when the same illness worsens or when a new serious illness arises.

**Effects.** Union with the Passion of Christ, strength to endure suffering Christianly, the forgiveness of sins (when the recipient could not confess), restoration of health if it conduces to the salvation of the soul, and preparation for the passage to eternal life (CCC §1532).

**Authority.** The Council of Trent defined the Anointing as a sacrament instituted by Christ and promulgated by St. James (Session XIV, 1551).`,
    goalTemplateSlug: "sacrament-anointing-of-the-sick",
  },
  {
    slug: "sacrament-holy-orders",
    kind: "VOCATION",
    title: "Holy Orders — At the Service of Communion",
    summary:
      "The sacrament that configures a man to Christ the Priest, Prophet, and King through ordination as bishop, priest, or deacon.",
    bodyText: `Holy Orders is the sacrament by which the mission entrusted by Christ to his Apostles continues to be exercised in the Church until the end of time. It is the sacrament of apostolic ministry, including three degrees: bishop (episcopate), priest (presbyterate), and deacon (diaconate) (CCC §1536–1600).

**Institution.** Christ instituted the priesthood of the New Covenant at the Last Supper, when he established the Eucharist and commanded: "Do this in memory of me" (Luke 22:19). He sent the Apostles with the same authority and mission with which the Father had sent him (John 20:21).

**The three degrees.**
  • **Bishops** receive the fullness of the sacrament of Holy Orders. They are successors of the Apostles, and as a body they constitute the College of Bishops in union with the Pope.
  • **Priests** are co-workers of the bishops, ordained for the service of the People of God. They preside at the Eucharist, forgive sins in confession, anoint the sick, and preach the Gospel.
  • **Deacons** are ordained for service — at the altar, in the ministry of the word, and in works of charity. They may be transitional (preparing for priesthood) or permanent.

**Matter and Form.** The matter is the imposition of hands by the bishop on the head of the candidate. The form is the consecratory prayer proper to each degree.

**Effects.** Holy Orders imprints an indelible spiritual character configuring the recipient to Christ the Priest, Prophet, and King. The sacrament is unrepeatable. It confers the grace of the Holy Spirit proper to the office and the power to act in persona Christi capitis (in the person of Christ the Head).

**Authority.** The Council of Trent defined the sacramentality of Holy Orders and its institution by Christ (Session XXIII, 1563). St. John Paul II in Ordinatio Sacerdotalis (1994) definitively reserved priestly ordination to baptized men. The Catechism treats Holy Orders at §1536–1600.`,
    goalTemplateSlug: "vocation-discernment",
  },
  {
    slug: "sacrament-matrimony",
    kind: "VOCATION",
    title: "Matrimony — At the Service of Communion",
    summary:
      "The covenant by which a baptized man and woman establish a partnership of the whole of life, ordered by its nature to the good of the spouses and to the procreation and education of offspring.",
    bodyText: `Matrimony is the covenant by which a baptized man and a baptized woman establish between themselves a partnership of the whole of life. By its nature this covenant is ordered to the good of the spouses and to the procreation and education of offspring; Christ raised it between the baptized to the dignity of a sacrament (CCC §1601–1666; CIC canons 1055–1165).

**Institution.** Matrimony was instituted by God at the creation of man and woman: "Therefore a man leaves his father and his mother and cleaves to his wife, and they become one flesh" (Genesis 2:24). Christ raised matrimony to the dignity of a sacrament and restored it to its original unity and indissolubility: "What therefore God has joined together, let no man put asunder" (Matthew 19:6).

**The Ministers.** The ministers of the sacrament of Matrimony are the spouses themselves — they confer the sacrament on each other through the exchange of consent. A priest or deacon ordinarily witnesses the marriage in the name of the Church and gives the nuptial blessing.

**The Essential Properties.** Unity (one man with one woman) and indissolubility (until death) are the essential properties of marriage. Sacramental marriage between two baptized persons, once consummated, is absolutely indissoluble (CIC §1056, §1141).

**The Three Goods of Marriage** (Saint Augustine, refined by the Council of Trent): proles (children), fides (fidelity), and sacramentum (indissoluble bond).

**Authority.** The Council of Trent affirmed the sacramentality of Christian marriage (Session XXIV, 1563). Pope Pius XI's Casti Connubii (1930), the Second Vatican Council's Gaudium et Spes 47–52, Paul VI's Humanae Vitae (1968), and John Paul II's Familiaris Consortio (1981) develop the modern Catholic theology of marriage.`,
    goalTemplateSlug: "sacrament-matrimony",
  },
];

const CONSECRATIONS: SpiritualLifeGuideSeed[] = [
  {
    slug: "consecration-marian-de-montfort",
    kind: "CONSECRATION",
    title: "Marian Consecration — Total Consecration to Jesus through Mary",
    summary:
      "A 33-day spiritual preparation to consecrate oneself wholly to Jesus through the hands of Mary, following the rule of Saint Louis-Marie Grignion de Montfort.",
    bodyText: `Total Consecration to Jesus through Mary, in its classical form prepared by Saint Louis-Marie Grignion de Montfort (1673–1716), is a 33-day spiritual exercise culminating in a personal act of consecration on a Marian feast.

**The book.** The traditional preparation follows Saint Louis de Montfort's "True Devotion to Mary" (Traité de la vraie dévotion à la Sainte Vierge), written c. 1712 and republished countless times. A modern adaptation widely used today is Fr. Michael Gaitley's "33 Days to Morning Glory" (Marian Press).

**The four weeks.**
  1. **Days 1–12: Spirit of the world.** Renunciation of the world's spirit and reflection on Christian conversion.
  2. **Days 13–19: Knowledge of self.** Examination of one's own corruption, weakness, and need for grace.
  3. **Days 20–26: Knowledge of the Blessed Virgin Mary.** Meditation on Mary's role in salvation history and her relationship to her Son.
  4. **Days 27–33: Knowledge of Jesus Christ.** Drawing closer to the Sacred Heart of Jesus through the heart of his Mother.

**Daily structure.** Each day of the 33-day preparation traditionally includes: the reading from de Montfort's True Devotion for that day, the Litany of the Holy Spirit (weeks 1–2), the Ave Maris Stella (weeks 3), the Litany of the Blessed Virgin (week 4), the Magnificat, and at least one Rosary (or one of its decades) said with the intention of preparing for the consecration.

**The act of consecration.** Made publicly or privately on a Marian feast (most commonly the Annunciation, the Assumption, the Immaculate Conception, or another solemnity of Our Lady), the consecration is a free and total gift of oneself — body, soul, possessions, and merits — to Jesus through Mary.

**Authority and tradition.** Saint Louis de Montfort was canonized by Pope Pius XII in 1947 and Pope John Paul II adopted his motto Totus Tuus and made the consecration his personal rule of life.`,
    steps: [
      {
        order: 1,
        title: "Days 1–12 — Spirit of the world",
        body: "Renunciation of the world's spirit and reflection on Christian conversion. Daily reading from True Devotion; Litany of the Holy Spirit; one decade of the Rosary.",
      },
      {
        order: 2,
        title: "Days 13–19 — Knowledge of self",
        body: "Examination of one's own corruption, weakness, and need for grace. Daily reading; Litany of the Holy Spirit; Ave Maris Stella; one decade of the Rosary.",
      },
      {
        order: 3,
        title: "Days 20–26 — Knowledge of the Blessed Virgin Mary",
        body: "Meditation on Mary's role in salvation history and her relationship to her Son. Daily reading; Ave Maris Stella; Litany of Loreto; one decade of the Rosary.",
      },
      {
        order: 4,
        title: "Days 27–33 — Knowledge of Jesus Christ",
        body: "Drawing closer to the Sacred Heart of Jesus through the heart of his Mother. Daily reading; O Jesu vivens in Maria; Litany of Loreto; one decade of the Rosary.",
      },
      {
        order: 5,
        title: "Day 34 — The act of consecration",
        body: "On a Marian feast, attend Mass and after receiving Holy Communion pray the formal act of consecration as a free and total gift of oneself to Jesus through Mary.",
      },
    ],
    durationDays: 33,
    goalTemplateSlug: "consecration-de-montfort",
  },
  {
    slug: "consecration-st-joseph",
    kind: "CONSECRATION",
    title: "Consecration to Saint Joseph — 33 Days",
    summary:
      "A 33-day spiritual preparation to entrust oneself to Saint Joseph, the spiritual father of all Christians, following the method of Fr. Donald Calloway.",
    bodyText: `Consecration to Saint Joseph is a 33-day spiritual preparation widely promoted by Fr. Donald H. Calloway, MIC, whose book "Consecration to St. Joseph: The Wonders of Our Spiritual Father" (Marian Press, 2020) is the most-used contemporary guide.

**Saint Joseph in Catholic tradition.** Saint Joseph is the chaste spouse of the Blessed Virgin Mary, the virginal father and protector of the Lord Jesus, the Patron of the Universal Church (declared by Bd. Pius IX in 1870), and the Patron of a Happy Death. Pope Francis declared the Year of Saint Joseph from 8 December 2020 through 8 December 2021 with the apostolic letter Patris Corde.

**The 33-day structure.** The Calloway preparation is divided into ten "Wonders" of Saint Joseph — meditations on his titles such as Son of David, Light of Patriarchs, Just Man, Protector of the Holy Church — combined with daily readings, prayers (including the Litany of Saint Joseph), and reflections. The 33 days culminate in a personal act of consecration on one of seven recommended feast days of Saint Joseph (most commonly 19 March or 1 May).

**Authority and tradition.** Saint Teresa of Ávila wrote: "I took for my advocate and lord the glorious Saint Joseph and earnestly recommended myself to him. I saw clearly that as in this need so in other greater ones … this Father and Lord of mine came to my rescue in better ways than I knew how to ask for." Pope Pius IX's decree Quemadmodum Deus (1870) declared Saint Joseph Patron of the Universal Church. Pope Francis's Patris Corde (2020) gathered the magisterial tradition into a single accessible letter.`,
    steps: [
      {
        order: 1,
        title: "Days 1–4 — Saint Joseph, son of David",
        body: "Read Calloway's introduction and the meditation on the first Wonder. Pray the Litany of Saint Joseph and one decade of the Rosary, offered for the grace to know Saint Joseph as your spiritual father.",
      },
      {
        order: 2,
        title: "Days 5–9 — Light of patriarchs and Spouse of the Mother of God",
        body: "Meditate on Joseph as the heir to Abraham, Isaac, and Jacob, and as the just spouse of Mary. Daily reading; Litany of Saint Joseph; the prayer 'Hail, Guardian of the Redeemer' from Patris Corde.",
      },
      {
        order: 3,
        title: "Days 10–14 — Foster father of the Son of God",
        body: "Meditate on Joseph's hidden fatherhood over Jesus. Daily reading; Litany of Saint Joseph; the Memorare to Saint Joseph; one decade of the Rosary on the Joyful Mysteries.",
      },
      {
        order: 4,
        title: "Days 15–19 — Diligent protector of Christ and Pillar of families",
        body: "Meditate on Joseph as protector and provider. Daily reading; Litany of Saint Joseph; an Our Father offered for fathers, husbands, and the protection of family life.",
      },
      {
        order: 5,
        title: "Days 20–24 — Mirror of patience and Lover of poverty",
        body: "Meditate on Joseph's hidden, ordinary holiness. Daily reading; Litany of Saint Joseph; the prayer 'To you, O blessed Joseph' (Leo XIII).",
      },
      {
        order: 6,
        title: "Days 25–29 — Model of workers and Patron of the dying",
        body: "Meditate on Joseph as patron of work and of a happy death. Daily reading; Litany of Saint Joseph; the prayer for a holy death.",
      },
      {
        order: 7,
        title: "Days 30–32 — Terror of demons and Protector of the Holy Church",
        body: "Meditate on Joseph's intercession against evil and his patronage of the universal Church. Daily reading; the Litany; a closing Rosary offered for the Church.",
      },
      {
        order: 8,
        title: "Day 33 — Vigil of consecration",
        body: "Make a confession if possible. Read the act of consecration to Saint Joseph aloud, slowly, the night before the feast on which you will consecrate yourself.",
      },
      {
        order: 9,
        title: "Day 34 — Act of consecration",
        body: "On the chosen feast of Saint Joseph (commonly 19 March or 1 May), attend Mass and after Communion pray the formal act of consecration, entrusting yourself wholly to Saint Joseph as your spiritual father.",
      },
    ],
    durationDays: 33,
    goalTemplateSlug: "consecration-st-joseph",
  },
  {
    slug: "consecration-holy-family",
    kind: "CONSECRATION",
    title: "Consecration to the Holy Family",
    summary:
      "A personal entrustment to Jesus, Mary, and Joseph as the model of every Christian household.",
    bodyText: `Consecration to the Holy Family of Jesus, Mary, and Joseph is the personal entrustment of oneself and one's family to the protection and intercession of the Holy Family of Nazareth, the model and pattern of every Christian household.

**Tradition.** The cult of the Holy Family developed especially in seventeenth-century France through Saint François de Laval, the first bishop of Quebec. Pope Leo XIII established the feast of the Holy Family in 1893; Pope Pius VI raised it to a feast of the universal Church; and Pope Francis has repeatedly held up the Holy Family as the school of holiness for our age.

**The pattern of the act of consecration.** The act of consecration to the Holy Family typically calls upon Jesus, Mary, and Joseph by name; commends to them one's spouse, children, household, and worldly affairs; renounces sin; and asks for the grace of imitating their hidden life in Nazareth.

**A traditional act of consecration (Pope Leo XIII).**
"O Jesus, our most loving Redeemer, who having come to enlighten the world with thy teaching and example, didst will to pass the greater part of thy life in humility and subjection to Mary and Joseph in the poor home of Nazareth, thus sanctifying the family destined to be the model of all Christian families, graciously receive our family as it dedicates and consecrates itself to thee this day. Defend us, guard us, and establish among us thy holy fear, true peace, and concord in Christian love, in order that, by living according to the divine pattern of thy Family, we may all attain to eternal happiness. Amen."`,
    steps: [
      {
        order: 1,
        title: "Day 1 — The Annunciation (Luke 1:26–38)",
        body: "Read the Gospel passage. Meditate on Mary's fiat. Pray the Angelus and one decade of the Joyful Mysteries.",
      },
      {
        order: 2,
        title: "Day 2 — The Visitation (Luke 1:39–56)",
        body: "Read the Gospel passage. Pray the Magnificat with your family. Ask the grace of charity in your household.",
      },
      {
        order: 3,
        title: "Day 3 — The Nativity (Luke 2:1–20)",
        body: "Read the Gospel passage. Pray the Glory Be three times in thanksgiving for the gift of family life.",
      },
      {
        order: 4,
        title: "Day 4 — The Presentation in the Temple (Luke 2:22–38)",
        body: "Read the Gospel passage. Offer your family to God as Simeon offered the Christ Child. Pray a Nunc Dimittis.",
      },
      {
        order: 5,
        title: "Day 5 — The Flight into Egypt (Matthew 2:13–23)",
        body: "Read the Gospel passage. Pray for families who suffer displacement, persecution, or material want.",
      },
      {
        order: 6,
        title: "Day 6 — The hidden life at Nazareth (Luke 2:39–40, 51–52)",
        body: "Read the Gospel passage. Meditate on the ordinary holiness of Nazareth. Pray for grace in the daily work of your home.",
      },
      {
        order: 7,
        title: "Day 7 — The Finding in the Temple (Luke 2:41–52)",
        body: "Read the Gospel passage. Pray for any family member who has wandered from the faith.",
      },
      {
        order: 8,
        title: "Day 8 — Litany of the Holy Family",
        body: "Pray the Litany of the Holy Family of Jesus, Mary, and Joseph. Make any needed confession before the consecration.",
      },
      {
        order: 9,
        title: "Day 9 — Act of consecration",
        body: "Gather the household. Pray Pope Leo XIII's act of consecration to the Holy Family aloud together, ideally on the feast of the Holy Family (the Sunday within the Octave of Christmas).",
      },
    ],
    durationDays: 9,
    goalTemplateSlug: "consecration-holy-family",
  },
  {
    slug: "consecration-sacred-heart",
    kind: "CONSECRATION",
    title: "Consecration to the Sacred Heart of Jesus",
    summary:
      "Personal consecration to the Sacred Heart of Jesus, the burning furnace of charity revealed to Saint Margaret Mary Alacoque.",
    bodyText: `Consecration to the Sacred Heart of Jesus is the personal entrustment of oneself to the love of Christ symbolized by his Sacred Heart — wounded, burning with love, surmounted by a crown of thorns and a cross.

**Origins.** Devotion to the Sacred Heart took its modern form in the revelations to Saint Margaret Mary Alacoque (1647–1690), a Visitandine nun of Paray-le-Monial, France, between 1673 and 1675. Christ revealed his Heart to her and asked for a feast of the Sacred Heart, the practice of First Fridays, and a Holy Hour on Thursday nights. Saint Claude de la Colombière, S.J., was her spiritual director and the great propagator of the devotion.

**The Twelve Promises of the Sacred Heart** were made by Christ to Saint Margaret Mary for those who practise devotion to his Heart. They include: peace in families, comfort in trials, the conversion of sinners, the grace of final perseverance, and the promise that for those who receive Holy Communion on nine consecutive First Fridays in reparation, "I will grant them the grace of final repentance."

**The Enthronement of the Sacred Heart** is the public installation of an image of the Sacred Heart of Jesus in a Catholic home as a reigning King, accompanied by a family act of consecration. Father Mateo Crawley-Boevey, SS.CC., propagated this practice in the early 20th century with the approval of Saint Pius X and Benedict XV.

**Magisterium.** Pope Pius IX extended the Feast of the Sacred Heart to the universal Church in 1856. Pope Leo XIII consecrated the entire human race to the Sacred Heart in 1899 (Annum Sacrum). Pope Pius XII's Haurietis Aquas (1956) is the great encyclical on devotion to the Sacred Heart. Pope Francis released Dilexit Nos on 24 October 2024 to renew the devotion for our time.`,
    steps: [
      {
        order: 1,
        title: "Day 1 — The Heart of Jesus, sanctuary of mercy",
        body: "Read the Gospel of the Sacred Heart (John 19:31–37). Pray the Litany of the Sacred Heart. Make a brief examen of any rejection of God's love in your day.",
      },
      {
        order: 2,
        title: "Day 2 — The Heart of Jesus, formed in the womb of the Virgin Mother",
        body: "Meditate on the union of Jesus and Mary. Pray one decade of the Rosary (Joyful Mysteries). Reflect on a moment when you experienced Christ's tenderness.",
      },
      {
        order: 3,
        title: "Day 3 — The Heart of Jesus, of infinite majesty",
        body: "Meditate on the divinity of Christ. Pray the Te Deum or the Adoro Te Devote. Make an act of adoration before the tabernacle or a crucifix.",
      },
      {
        order: 4,
        title: "Day 4 — The Heart of Jesus, burning furnace of charity",
        body: "Meditate on the love of God poured out in the Cross. Pray the Anima Christi. Identify one concrete act of charity to perform today.",
      },
      {
        order: 5,
        title: "Day 5 — The Heart of Jesus, fount of life and holiness",
        body: "Meditate on the seven sacraments as wellsprings of the Sacred Heart. Pray a decade of the Sorrowful Mysteries.",
      },
      {
        order: 6,
        title: "Day 6 — The Heart of Jesus, our peace and reconciliation",
        body: "Meditate on Christ as Prince of Peace. Make a confession during the novena if you have not done so recently.",
      },
      {
        order: 7,
        title: "Day 7 — The Heart of Jesus, victim for our sins",
        body: "Meditate on the sacrificial love of the Cross. Pray the Stations of the Cross or one decade of the Sorrowful Mysteries.",
      },
      {
        order: 8,
        title: "Day 8 — Holy Hour and confession before the act",
        body: "If possible make a Holy Hour before the Blessed Sacrament. Confess any unconfessed sins. Read aloud the act of consecration the night before the feast.",
      },
      {
        order: 9,
        title: "Day 9 — Act of consecration",
        body: "On the chosen feast (the Solemnity of the Sacred Heart, the First Friday, or another Friday), attend Mass and after Communion pray the act of consecration: 'I give myself and consecrate to the Sacred Heart of our Lord Jesus Christ, my person and my life, my actions, pains and sufferings…'",
      },
    ],
    durationDays: 9,
    goalTemplateSlug: "consecration-sacred-heart",
  },
];

export const SACRAMENT_GUIDES: SpiritualLifeGuideSeed[] = [...SACRAMENTS, ...CONSECRATIONS];
