import type { CuratedEntry } from "../index";

/**
 * Guides — section K (Sacraments), first half: Baptism, Confirmation, and the
 * Eucharist (First Communion, receiving Communion, taking part in Mass, and
 * keeping Sunday).
 *
 * Every step is written to be read while actually doing the thing: the words
 * of the rites are given where a parent, godparent, sponsor or communicant
 * has to say or answer them, the canonical requirements are stated as the
 * Code of Canon Law states them, and parish customs (preparation classes,
 * sponsor letters, service hours) are named as customs, not as norms. Where a
 * detail varies by diocese the guide says so and sends the reader to the
 * parish.
 */

// USCCB pages (verified in a browser; the site blocks non-browser clients).
const U_BAPT = "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/baptism";
const U_CONF = "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/confirmation";
// The plan's ".../sacraments-and-sacramentals/eucharist" page no longer exists;
// the USCCB's Eucharist page now lives at /eucharist.
const U_EUCH = "https://www.usccb.org/eucharist";
const U_ORDER = "https://www.usccb.org/prayer-and-worship/the-mass/order-of-mass";

// Vatican documents (all verified 200). The Catechism pages are the IntraText
// article pages (the legend's ccc_css paths 404); the Canon Law pages are the
// live cic_lib4 files, which group the canons differently from the legend.
// Catechism, Part 2, Section 2, Article 1: The Sacrament of Baptism.
const V_CCC_BAPT = "https://www.vatican.va/archive/ENG0015/__P3G.HTM";
// Catechism, Part 2, Section 2, Article 2: The Sacrament of Confirmation.
const V_CCC_CONF = "https://www.vatican.va/archive/ENG0015/__P3P.HTM";
// Catechism, Part 2, Section 2, Article 3: The Sacrament of the Eucharist.
const V_CCC_EUCH = "https://www.vatican.va/archive/ENG0015/__P3W.HTM";
// Code of Canon Law, Book IV, canons 834-878 (Baptism is canons 849-878).
const V_CIC_BAPT =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann834-878_en.html";
// Code of Canon Law, Book IV, canons 879-958 (Confirmation 879-896; Eucharist 897-958).
const V_CIC_CONF_EUCH =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann879-958_en.html";
// Code of Canon Law, Book IV, canons 1244-1253 (feast days and days of penance).
const V_CIC_TIMES =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1244-1253_en.html";
const V_GIRM =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20030317_ordinamento-messale_en.html";
const V_DD =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1998/documents/hf_jp-ii_apl_05071998_dies-domini.html";

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  sacramentKey: "baptism" | "confirmation" | "eucharist";
  authorityLevel: "USCCB" | "VATICAN";
  citations: string[];
  intro: string;
  whatYouNeed: string[];
  whenToPray: string;
  tips: string[];
  steps: Step[];
  durationMinutes: number;
  relatedPrayers: string[];
  relatedDevotions?: string[];
  relatedPractices?: string[];
  relatedSaints?: string[];
}

function guide(g: GuideInput): CuratedEntry {
  return {
    contentType: "GUIDE",
    slug: g.slug,
    authorityLevel: g.authorityLevel,
    citations: g.citations,
    payload: {
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      kind: "general",
      category: "sacraments",
      sacramentKey: g.sacramentKey,
      intro: g.intro,
      whatYouNeed: g.whatYouNeed,
      whenToPray: g.whenToPray,
      tips: g.tips,
      steps: g.steps,
      durationMinutes: g.durationMinutes,
      relatedPrayers: g.relatedPrayers,
      relatedDevotions: g.relatedDevotions ?? [],
      relatedPractices: g.relatedPractices ?? [],
      relatedSaints: g.relatedSaints ?? [],
      citations: g.citations,
    },
  };
}

/** The requirements for a sponsor (baptismal godparent or confirmation sponsor), canon 874. */
const SPONSOR_REQUIREMENTS =
  "be chosen by the parents (or by the one to be baptized) and have the aptitude and intention for the role; be at least sixteen years old, unless the diocesan bishop has set another age or the pastor or minister judges a just exception should be made; be a Catholic who has been confirmed and has received Holy Communion, and who leads a life in harmony with the faith and with the role being undertaken; not be under any canonical penalty; and not be the father or mother of the one to be baptized.";

export const sacramentGuidesOne: CuratedEntry[] = [
  // ───────────────────────────── BAPTISM ─────────────────────────────
  guide({
    slug: "preparing-for-baptism-infant",
    title: "How to Prepare for Your Child's Baptism",
    summary:
      "Infant Baptism from the first phone call to the parish to the day itself: the preparation session, choosing godparents, the documents to bring, what happens in the rite, the promises you will make, and raising the child in the faith afterward.",
    sacramentKey: "baptism",
    authorityLevel: "USCCB",
    citations: [U_BAPT, V_CIC_BAPT],
    intro:
      "Baptism is the gateway to life in the Spirit and the door to the other sacraments: it frees a child from original sin, makes him or her a child of God and a member of Christ's Body, the Church, and marks the soul with a seal that can never be removed. The Church asks parents to have their infants baptized within the first weeks after birth, and to prepare themselves for it, because they and the godparents will speak for the child and promise to raise him or her in the faith. This guide walks through the ordinary parish practice in the United States.",
    whatYouNeed: [
      "A call or visit to your parish office as soon as the child is born, or before",
      "One or two godparents who meet the Church's requirements (see the guide on choosing godparents)",
      "The child's birth certificate and, for the godparents, a letter or sponsor certificate from their own parish",
      "A white garment for the child and a baptismal candle (many parishes provide both; ask)",
    ],
    whenToPray:
      "As soon as possible after birth. Canon 867 asks parents to see to it that their infants are baptized within the first weeks, and to approach the parish soon after the birth or even before it. Most parishes celebrate infant Baptisms on Sundays, either during Mass or in a separate celebration after it.",
    tips: [
      "Do not wait for the perfect date or the perfect party. The sacrament is the point; the celebration can follow whenever the family can gather.",
      "If one parent is not Catholic, the child may still be baptized. Canon 868 asks only that at least one parent (or the person lawfully standing in for them) consents, and that there be a founded hope the child will be raised Catholic.",
      "If you are not registered at a parish, this is the moment to register. Baptism is normally celebrated in the parents' own parish church.",
      "Bring the godparents to the preparation session if the parish invites them; their promises are as real as yours.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Contact the parish early",
        body: "Call or visit your parish office as soon as you can, ideally during the pregnancy or in the first days after the birth. Ask when Baptisms are celebrated, what preparation the parish asks of parents and godparents, and what documents to bring. Baptism is ordinarily celebrated in the parish church of the parents (canon 857), so if you have moved, or have never registered, register now. If your child is ill or in danger, tell the parish at once: an infant in danger of death is to be baptized without any delay, and any person can do it (see the guide on emergency Baptism).",
      },
      {
        order: 2,
        title: "Attend the preparation session",
        body: "Canon 851 asks that the parents of a child to be baptized, and those who will be godparents, be properly instructed on the meaning of the sacrament and the obligations attached to it. Most parishes do this in one evening session or a short series, sometimes with a video and a conversation with the priest, deacon or a catechist. Go with your questions: what the promises mean, why the Church baptizes infants who cannot yet believe for themselves (because faith is a gift given within the faith of the Church, and the child will grow into it), and what the parish offers families afterward.",
      },
      {
        order: 3,
        title: "Choose the godparents",
        body: `A child may have one godparent, or one godfather and one godmother, and not more (canon 873). Each godparent must ${SPONSOR_REQUIREMENTS} A baptized Christian who is not Catholic cannot be a godparent, but may stand alongside a Catholic godparent as a Christian witness. Choose someone who actually practices the faith and will stay in your child's life; the godparent's task, in the words of canon 872, is to help the baptized lead a Christian life in keeping with Baptism.`,
      },
      {
        order: 4,
        title: "Gather the documents",
        body: "Parishes typically ask for the child's birth certificate (to record the legal name, date and place of birth, and the parents' names in the baptismal register), the parents' contact and marriage information, and for each godparent a sponsor certificate or letter from the godparent's own parish stating that he or she is a practicing Catholic in good standing who has been confirmed. Ask the godparents to request this from their parish as soon as they accept; it can take a week or two. The parish will keep everything in its baptismal register, which is the permanent record your child will need for First Communion, Confirmation and marriage.",
      },
      {
        order: 5,
        title: "Know the rite: reception, Word and prayers",
        body: "The celebration begins at the church door or the entrance. The celebrant asks the parents, 'What name do you give your child?' and, 'What do you ask of God's Church for your child?' The parents answer with the name, and 'Baptism.' He reminds the parents that in asking for Baptism they accept the responsibility of training the child in the practice of the faith, and asks whether they understand this; they answer, 'We do.' The godparents are asked whether they are ready to help the parents in this duty and answer, 'We are.' The celebrant, parents and godparents then trace the Sign of the Cross on the child's forehead. Scripture readings, a short homily and intercessions follow, ending with the invocation of the saints, a prayer of exorcism and an anointing on the breast with the oil of catechumens.",
      },
      {
        order: 6,
        title: "Make the promises: renounce sin and profess the faith",
        body: "At the font the celebrant blesses the water (or, in Easter time, uses the water blessed at the Vigil). He then asks the parents and godparents, on the child's behalf, to renounce sin and profess the faith. To each of three questions beginning 'Do you renounce Satan?' or 'Do you reject sin?' you answer, 'I do.' Then to each of three questions of the Apostles' Creed, 'Do you believe in God, the Father almighty...? Do you believe in Jesus Christ, his only Son, our Lord...? Do you believe in the Holy Spirit, the holy catholic Church...?' you answer, 'I do.' The celebrant says, 'This is our faith. This is the faith of the Church. We are proud to profess it, in Christ Jesus our Lord,' and all answer, 'Amen.' Then he asks, 'Is it your will that N. should be baptized in the faith of the Church, which we have all professed with you?' and you answer, 'It is.'",
      },
      {
        order: 7,
        title: "The Baptism, the anointing with chrism, the white garment and the candle",
        body: "The celebrant immerses the child or pours water three times over the head, saying, 'N., I baptize you in the name of the Father, and of the Son, and of the Holy Spirit.' At that moment your child is a Christian. He then anoints the crown of the head with sacred chrism, the perfumed oil consecrated by the bishop, as a sign that the child now shares in Christ, who is priest, prophet and king. The child is clothed in the white garment, the outward sign of Christian dignity, which the parents and godparents are asked to help him or her bring unstained into eternal life. A parent or godparent lights the child's candle from the Easter candle as the celebrant says, 'Receive the light of Christ,' and the parents and godparents are told the light is entrusted to them to be kept burning brightly. The rite ends with the Our Father, prayed by all, and blessings of the mother, the father and the whole assembly.",
      },
      {
        order: 8,
        title: "Afterward: raise the child in the faith you promised",
        body: "Keep the candle and the garment; light the candle on each baptismal anniversary and tell the story of the day. Teach the child to make the Sign of the Cross and to say the Our Father and the Hail Mary as soon as he or she can speak. Bring the child to Sunday Mass from infancy, bless him or her at bedtime, keep the parish informed as you move, and, in a few years, enroll the child in preparation for first Confession and First Holy Communion. The promises you made were not a formality: the parish, the godparents and the whole Church made them with you, and will help you keep them.",
      },
    ],
    relatedPrayers: ["apostles-creed", "our-father", "hail-mary", "guardian-angel-prayer"],
    relatedSaints: ["saint-john-the-baptist"],
  }),

  guide({
    slug: "how-to-choose-godparents",
    title: "How to Choose Godparents",
    summary:
      "What a godparent is for, the Church's requirements in canon law (age, Confirmation, a practicing Catholic life), how many you may have, the place of a non-Catholic Christian witness, the sponsor certificate, and what to look for beyond the requirements.",
    sacramentKey: "baptism",
    authorityLevel: "VATICAN",
    citations: [V_CIC_BAPT, U_BAPT],
    intro:
      "A godparent is not an honorary title given to a favorite relative or a way of thanking a friend. In the rite of Baptism the godparents speak with the parents for the child, promise to help the parents in their duty, and take on, in the Church's own words, the task of helping the baptized to lead a Christian life in keeping with Baptism. Choosing well is a gift to your child that lasts a lifetime. This guide gives the requirements the Church sets in canons 872 to 874 and some practical wisdom for choosing among the people who meet them.",
    whatYouNeed: [
      "A short list of practicing Catholics you trust with your child's faith",
      "Canons 872 to 874 of the Code of Canon Law (summarized below)",
      "A conversation with the person you are asking, well before the Baptism date",
    ],
    whenToPray:
      "As soon as you begin planning the Baptism, ideally during the pregnancy. Godparents need time to say yes freely and to get a sponsor certificate from their own parish.",
    tips: [
      "The requirements are the floor, not the ceiling. Ask yourself who would actually pray for this child, bring him or her to Mass if you could not, and talk about the faith in twenty years.",
      "A grandparent, aunt, uncle, cousin or family friend can all be godparents; only the child's own parents cannot.",
      "If a beloved friend is a baptized non-Catholic, he or she may stand as a Christian witness alongside a Catholic godparent; someone who is not baptized cannot take either role.",
      "Do not choose someone to pressure them back to the practice of the faith. A godparent who does not practice cannot promise what the rite asks.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand what a godparent is",
        body: "Canon 872 says that, as far as possible, a person to be baptized is given a sponsor who, for an infant, presents the child for Baptism together with the parents and helps the baptized lead a Christian life in keeping with Baptism and to fulfill faithfully the obligations inherent in it. The Catechism adds that godparents must be firm believers, able and ready to help the newly baptized on the road of Christian life, and that their task is a truly ecclesial function. In short: a godparent is a companion in faith for life, chosen by the parents but acting in the name of the Church.",
      },
      {
        order: 2,
        title: "Check the requirements of canon law",
        body: `Canon 874 sets the requirements. A godparent must ${SPONSOR_REQUIREMENTS} 'Leads a life in harmony with the faith' means, in practice, a Catholic who goes to Mass on Sundays, is not living in a situation contrary to the Church's teaching (for example, a Catholic married outside the Church without a convalidation), and can honestly make the baptismal promises. The parish may ask a godparent to confirm these things in writing.`,
      },
      {
        order: 3,
        title: "Decide on one or two, and about a Christian witness",
        body: "Canon 873 allows one godparent (a man or a woman) or two, one godfather and one godmother; the Church does not permit two of the same sex or more than two. Canon 874 §2 adds that a baptized person who belongs to a non-Catholic ecclesial community may be admitted only together with a Catholic sponsor, and only as a witness of the Baptism, not as a godparent. An Orthodox Christian may, under the Church's ecumenical guidance, act as a godparent together with a Catholic godparent; ask the parish. A person who has not been baptized cannot serve in either role, since he or she cannot profess the faith the rite asks for.",
      },
      {
        order: 4,
        title: "Ask early, and ask plainly",
        body: "Speak to the person in good time, before the date is fixed if possible. Say what you are asking: to promise before the Church to help you raise this child as a Catholic, to be present at the Baptism, and to keep praying for and staying close to the child afterward. Give the person freedom to say no; a godparent who accepts out of politeness will not do what the rite asks. If the person lives far away, that need not exclude them, but ask honestly whether the relationship will survive the distance.",
      },
      {
        order: 5,
        title: "Ask for the sponsor certificate",
        body: "Most parishes in the United States ask each godparent to bring a sponsor certificate or a letter from his or her own parish, signed by the pastor or his delegate, stating that the godparent is a registered, practicing Catholic who has been confirmed and is free to take on the role. The godparent requests it from the parish office, sometimes in person; some parishes ask the godparent to be registered there for a period first. Tell your godparents about this as soon as they accept, so the letter arrives before the Baptism.",
      },
      {
        order: 6,
        title: "Remember that it is a lifelong role",
        body: "The godparent's name is entered in the baptismal register beside the child's and stays there permanently. Canon 893 says it is desirable that the same person later serve as the child's Confirmation sponsor, so that the unity of the two sacraments is clear. Choose, then, with the next sixteen years in view: someone who will remember the baptismal anniversary and the child's name-day, who will pray for the child, who could be called upon in hard years, and whose own life gives the child something to imitate. Pray about the choice before you make it.",
      },
    ],
    relatedPrayers: ["our-father", "guardian-angel-prayer"],
  }),

  guide({
    slug: "how-to-be-a-godparent",
    title: "How to Be a Godparent",
    summary:
      "What you promise in the rite, how to prepare yourself with Confession and Mass, your part in the ceremony, and how to keep the role alive afterward: praying for your godchild, marking the baptismal anniversary and feast days, and being there in the teenage years.",
    sacramentKey: "baptism",
    authorityLevel: "USCCB",
    citations: [U_BAPT, V_CCC_BAPT],
    intro:
      "To be asked to be a godparent is to be trusted with a child's faith. The Church does not treat it as a courtesy: in the rite you will promise, aloud and before the assembly, to help the parents raise the child as a Christian, and canon 872 describes your task as helping the baptized to lead a Christian life in keeping with Baptism. That promise is kept mostly in ordinary ways over many years. This guide covers your preparation, your part in the ceremony, and what a faithful godparent does afterward.",
    whatYouNeed: [
      "A sponsor certificate or letter from your own parish, requested as soon as you accept",
      "A recent Confession and a Sunday Mass or two with the Baptism in mind",
      "The renunciation of sin and profession of faith (the Apostles' Creed in question form) read over beforehand",
      "A note of the Baptism date, so you can keep the anniversary every year",
    ],
    whenToPray:
      "Begin the day you accept, and keep praying for your godchild for the rest of your life. Mark the baptismal anniversary, the child's birthday and the feast of his or her patron saint.",
    tips: [
      "If you cannot honestly make the promises, say so with kindness now. The parents will be better served by a godparent who can.",
      "Ask the parents which side of the font to stand on and whether they would like you to hold the child; customs vary and no one minds being asked.",
      "A simple annual gift that builds faith (a children's Bible, a rosary, a saint's life, a Mass offered for the child) does more than an expensive one.",
      "Godparents who live far away can still send a card on the baptismal anniversary and a text on Sundays; the point is that the child knows someone is praying.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Know what you will promise",
        body: "In the rite the celebrant asks the godparents, 'Are you ready to help the parents of this child in their duty as Christian parents?' and you answer, 'We are.' At the font you will be asked with the parents to renounce sin and to profess the faith of the Church in the words of the Apostles' Creed, answering 'I do' to each question, and then whether it is your will that the child be baptized in that faith: 'It is.' You will trace the Sign of the Cross on the child's forehead, and the light of Christ will be entrusted to you and the parents to keep burning brightly. Read the promises before the day so that you can make them with a full heart.",
      },
      {
        order: 2,
        title: "Prepare yourself: Confession and Mass",
        body: "You are about to profess the faith on someone else's behalf, so make sure it is alive in you. Go to Confession in the week before the Baptism; if it has been a long time, tell the priest so and he will help you. Attend Sunday Mass with the Baptism in mind, asking God for the grace to be a real companion to this child. If the parish invites godparents to the parents' preparation session, go. And request the sponsor certificate from your own parish as soon as you accept; it can take a week or two to arrive.",
      },
      {
        order: 3,
        title: "Your part in the rite",
        body: "Arrive early and stand where the parents or the celebrant place you, normally beside the parents. At the reception of the child you answer 'We are' when asked whether you are ready to help the parents, and after the parents you trace the cross on the child's forehead with your thumb. At the font you answer the renunciation and the profession of faith with 'I do' and 'It is.' Depending on local custom the godmother may hold the child for the Baptism or the godfather may light the candle from the Easter candle when the celebrant says, 'Receive the light of Christ.' Join in the Our Father and receive the closing blessing. It is all simple; the celebrant will guide you.",
      },
      {
        order: 4,
        title: "Pray for your godchild",
        body: "The first duty of a godparent is prayer, and it is the one that never lapses. Add the child by name to your daily prayers: a Hail Mary each day, the Guardian Angel Prayer for the child, a decade of the Rosary on the child's birthday, a Mass offered for the child once a year. When your godchild is old enough, tell him or her that you pray every day; children remember that. If the parents drift from the practice of the faith, your prayer becomes even more important, and it is never wasted.",
      },
      {
        order: 5,
        title: "Mark the baptismal anniversary and the patron's feast",
        body: "Note the date of the Baptism and the feast day of the saint whose name the child bears, and keep them every year with a card, a phone call, a small religious gift or a visit. Remind the child of the day he or she became a Christian and light the baptismal candle together if you can. As the years go on, take an interest in the sacraments that follow: be present at First Holy Communion, and be ready to serve as the Confirmation sponsor, which canon 893 says is desirable for the baptismal godparent.",
      },
      {
        order: 6,
        title: "Be there in the teenage years",
        body: "The promise you made comes due most in adolescence, when a young person needs a trusted adult who is not a parent and who takes the faith seriously without preaching. Keep the relationship warm enough that your godchild would call you. Invite him or her to Mass when you are together, answer questions honestly, share how you have kept the faith through your own doubts and failures, and pray more, not less. A godparent who quietly practices what he or she professed at the font is one of the strongest arguments for the faith a young person will ever meet.",
      },
    ],
    relatedPrayers: ["apostles-creed", "hail-mary", "guardian-angel-prayer", "our-father"],
    relatedSaints: ["saint-monica"],
  }),

  guide({
    slug: "how-to-baptize-in-an-emergency",
    title: "How to Baptize in an Emergency",
    summary:
      "In danger of death any person, even someone not baptized, may baptize: when it applies, the water to use, the words to say, the intention required, and what to do afterward so the parish records the Baptism and supplies the remaining rites.",
    sacramentKey: "baptism",
    authorityLevel: "VATICAN",
    citations: [V_CCC_BAPT, V_CIC_BAPT],
    intro:
      "The ordinary ministers of Baptism are the bishop, the priest and the deacon, but the Church has always taught that in case of necessity anyone, even a person who is not baptized, can baptize, provided he or she has the intention of doing what the Church does and uses water and the Trinitarian formula (Catechism 1256; canon 861 §2). This is the Church's provision for a newborn in a hospital, an accident, or any situation where death is near and no priest or deacon can come in time. Learn it now, so that you can act calmly if the moment ever comes.",
    whatYouNeed: [
      "Ordinary natural water (tap water, bottled water, sterile water in a hospital)",
      "The words: 'I baptize you in the name of the Father, and of the Son, and of the Holy Spirit'",
      "The intention to do what the Church does when she baptizes",
      "Afterward, the name and contact details of the parish where the Baptism should be recorded",
    ],
    whenToPray:
      "Only in genuine necessity: danger of death when no priest or deacon can be reached in time. Outside such necessity Baptism is celebrated by the Church's ministers in the parish church.",
    tips: [
      "If a priest or deacon can arrive before the danger becomes acute, call one; if there is any doubt about the time, baptize and call anyway.",
      "Do not delay to find a godparent, a candle or a prayer book. Water and the words are enough; everything else can be supplied later.",
      "A hospital chaplain, nurse or any bystander may baptize; so may a parent. Nothing in the person's own state (an unbaptized friend, a lapsed Catholic) invalidates the Baptism if the water, words and intention are right.",
      "If you are unsure whether someone was already baptized, canon 869 provides for conditional Baptism; in an emergency simply baptize, and tell the parish of your doubt afterward.",
    ],
    durationMinutes: 5,
    steps: [
      {
        order: 1,
        title: "Know when it applies",
        body: "Emergency Baptism is for danger of death: a newborn who may not survive, an unbaptized adult who asks for Baptism as death approaches, an accident. Canon 867 §2 says an infant in danger of death is to be baptized without delay. For an adult, canon 865 §2 asks that in danger of death he or she have some knowledge of the principal truths of the faith, manifest in some way the intention to receive Baptism, and promise to observe the commandments; a dying person who asks for Baptism and assents to a few words about Christ is enough. Ordinarily the parents' consent is asked for an infant; but canon 868 §2 provides that an infant in danger of death is baptized licitly even against the parents' wishes.",
      },
      {
        order: 2,
        title: "Get water",
        body: "Use natural water: from the tap, a bottle, a sterile container, a stream, melted snow. It need not be blessed. Warm it if you can for an infant, but do not delay for that. Have enough to pour so that it actually flows over the skin of the head; a damp finger is not sufficient. If the head cannot be reached, for instance in a medical situation, pour it on whatever part of the body is accessible and tell the parish, which will judge whether the rite should later be repeated conditionally.",
      },
      {
        order: 3,
        title: "Pour the water on the head while saying the words",
        body: "Pour water over the person's head, three times if you can, one pouring for each divine Person, while you yourself say aloud: 'N., I baptize you in the name of the Father, and of the Son, and of the Holy Spirit.' Use the person's name if you know it; the name is customary, not essential. The one who pours the water must be the one who says the words, and the words and the water must go together: one person cannot pour while another speaks. Say the formula exactly; 'in the name of the Father, and of the Son, and of the Holy Spirit' is what the Church has always used and what Christ commanded.",
      },
      {
        order: 4,
        title: "Intend what the Church intends",
        body: "You do not need to be able to explain the theology of Baptism. You need only to intend to do what the Church does when she baptizes, which is to say, to give this person Christian Baptism. The Catechism (1256) puts it plainly: anyone, even a non-baptized person, can baptize with the required intention. Keep the intention simple and clear in your mind as you act. If you are a believer, add a prayer afterward: the Our Father, the Apostles' Creed on the person's behalf, or simply, 'Lord, receive your child.'",
      },
      {
        order: 5,
        title: "Tell the parish afterward",
        body: "Canon 878 requires that when Baptism is conferred by someone other than the pastor and not in his presence, the minister must inform the pastor of the parish where it took place, so that the Baptism is recorded in the register. Write down at once the person's full name, the date, the place, the names of the parents if an infant, your own name, and the names of any witnesses. Then contact the local parish or, in a hospital, the Catholic chaplain, and give them this record. The register entry is what the Church will rely on for every later sacrament.",
      },
      {
        order: 6,
        title: "Supply the remaining rites later",
        body: "The Baptism itself is complete and can never be repeated. What was omitted in the emergency, the anointing with chrism, the white garment, the candle and the rest, is supplied afterward by the parish in a short celebration that the Rite of Baptism provides for bringing a child who has already been baptized to the church. If the person recovers, contact the parish to arrange this and to name godparents. If the person dies, he or she died a baptized Christian, and the parish will arrange a Catholic funeral. In both cases, give thanks: you have done what the Church asked of you.",
      },
    ],
    relatedPrayers: ["apostles-creed", "our-father"],
  }),

  // ─────────────────────────── CONFIRMATION ───────────────────────────
  guide({
    slug: "preparing-for-confirmation",
    title: "How to Prepare for Confirmation",
    summary:
      "What Confirmation is and does, the seven gifts of the Holy Spirit, the parish preparation, choosing a sponsor and a name, going to Confession beforehand, the rite itself (renewal of baptismal promises, laying on of hands, anointing with chrism), and living as a confirmed Catholic.",
    sacramentKey: "confirmation",
    authorityLevel: "USCCB",
    citations: [U_CONF, V_CCC_CONF],
    intro:
      "Confirmation completes the grace of Baptism. In it the baptized are sealed with the gift of the Holy Spirit, bound more perfectly to the Church, enriched with the Spirit's special strength, and, as the Catechism says, more strictly obliged to spread and defend the faith by word and deed as true witnesses of Christ (1285, 1303). Like Baptism it imprints a permanent character and can be received only once. This guide is for a candidate, or the parent of one, going through parish preparation in the United States, where the sacrament is normally conferred by the bishop on the baptized who have reached the age of discretion, at an age set by each diocese.",
    whatYouNeed: [
      "Your baptismal certificate (request a recent copy from the parish of your Baptism)",
      "Enrollment in your parish's Confirmation preparation, usually a year or more of catechesis",
      "A sponsor who meets the Church's requirements, and his or her sponsor certificate",
      "A recent Confession, so that you receive the sacrament in a state of grace",
      "The renewal of baptismal promises read over beforehand",
    ],
    whenToPray:
      "Throughout the preparation period, and especially in the days before the celebration. Many candidates pray a novena to the Holy Spirit in the nine days before Confirmation, using Veni Creator Spiritus or the Prayer to the Holy Spirit.",
    tips: [
      "Confirmation is not a graduation from religious education, and the Church does not treat it as a rite of passage into adulthood; it is the completion of your Baptism and a sending on mission.",
      "Baptized Catholics who were never confirmed can receive the sacrament at any age; ask the parish about adult preparation, often in a few sessions in the weeks before Pentecost or the Easter Vigil.",
      "Attend Mass every Sunday during preparation. The best preparation is a habit of prayer and the sacraments, not the completion of a checklist.",
      "If your diocese confirms at a young age or restores the original order (Confirmation before First Communion), the preparation will look different; the sacrament is the same.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Understand what Confirmation is",
        body: "At Pentecost the Holy Spirit came upon the Apostles, and from the beginning the Apostles handed on that gift to the newly baptized by the laying on of hands. Confirmation is that gift, given to you. Its effects, the Catechism teaches (1303), are a deeper rooting in divine sonship, a firmer union with Christ, an increase of the gifts of the Holy Spirit, a more perfect bond with the Church, and a special strength to spread and defend the faith. It is received once, it is normally conferred by the bishop, and in the Latin Church it is ordinarily received after Baptism and at the age of discretion, the exact age being set by each conference of bishops and diocese.",
      },
      {
        order: 2,
        title: "Learn the gifts of the Holy Spirit",
        body: "The seven gifts of the Holy Spirit are wisdom, understanding, counsel, fortitude, knowledge, piety and fear of the Lord (Catechism 1831); they belong in their fullness to Christ and are given to sustain the moral life of every Christian. Learn them by name and ask for them by name in prayer, one each day for a week. The traditional way to do this is to pray Veni Creator Spiritus or the Prayer to the Holy Spirit ('Come, Holy Spirit, fill the hearts of your faithful...') daily during your preparation, and to ask the Spirit for whichever gift you most need.",
      },
      {
        order: 3,
        title: "Take part in preparation, and in service if your parish asks",
        body: "Canon 889 §2 asks that a candidate be suitably instructed, properly disposed and able to renew the baptismal promises; canon 890 makes parents and pastors responsible for seeing that the faithful are prepared. Parishes do this through classes, retreats, and often a period of service to the parish or the poor. Take these seriously as preparation, not as hurdles: the classes teach what you are receiving, the retreat gives you time to pray, and the service is a first taste of the mission the sacrament sends you on. Service hours are a parish custom rather than a requirement of the Church, but a good one.",
      },
      {
        order: 4,
        title: "Choose a sponsor",
        body: `A sponsor presents you to the bishop and, canon 892 says, takes care that you behave as a true witness of Christ and fulfill the obligations of the sacrament. The requirements are the same as for a godparent (canon 893): the sponsor must ${SPONSOR_REQUIREMENTS} The Church says it is desirable that one of your baptismal godparents be your sponsor, to show the unity of the two sacraments. Ask early, and ask the sponsor to get a certificate from his or her parish. See the guide on choosing a Confirmation saint and sponsor.`,
      },
      {
        order: 5,
        title: "Choose a Confirmation name",
        body: "In many places it is the custom for a candidate to take the name of a saint at Confirmation, chosen as a patron and model; the bishop uses it when he anoints you. This is a custom, not a requirement of the rite, and you may simply keep your baptismal name, especially if it is already a saint's name. If you choose a new name, choose it for the saint, not for the sound: read the saint's life, learn why he or she is honored, and ask that saint's prayers during your preparation. Tell the parish the name in good time so the certificate can be prepared.",
      },
      {
        order: 6,
        title: "Go to Confession beforehand",
        body: "To receive Confirmation one must be in a state of grace, and the Catechism (1310) says one should receive the Sacrament of Penance in order to be cleansed for the gift of the Holy Spirit. Most parishes schedule a Confession service or extra times in the week before the celebration. Prepare with an examination of conscience, confess honestly, and pray the Act of Contrition. Go even if you have no serious sin to confess; the grace of the sacrament prepares the soul, and it is good to come to the bishop with a clear conscience.",
      },
      {
        order: 7,
        title: "The rite: promises, laying on of hands, chrism",
        body: "Confirmation is usually celebrated within Mass, after the Gospel and homily. The candidates are presented, and the bishop asks you to renew the promises of your Baptism: to each question, 'Do you renounce Satan...? Do you believe in God, the Father almighty...?' you answer, 'I do.' The bishop and the priests with him then extend their hands over all the candidates while the bishop prays that the Father will send the Holy Spirit with his gifts. Then each candidate comes forward with the sponsor's right hand on his or her shoulder. The bishop dips his thumb in chrism and traces the cross on your forehead, saying, 'N., be sealed with the Gift of the Holy Spirit.' You answer, 'Amen.' He says, 'Peace be with you,' and you answer, 'And with your spirit.' Mass continues with the Prayer of the Faithful and the Eucharist.",
      },
      {
        order: 8,
        title: "Live confirmed",
        body: "The sacrament is not the end of anything. You are now, in the Church's words, more strictly obliged to spread and defend the faith by word and deed. Concretely: keep Sunday Mass without exception, go to Confession regularly, pray every day (the Morning Offering is a good daily habit to begin), and find one way to serve, in the parish or beyond. Keep in touch with your sponsor and ask your Confirmation saint's prayers by name. Pray the Prayer to the Holy Spirit often, asking for the gifts you were given to grow. The Holy Spirit does not leave; the question is whether you will keep listening.",
      },
    ],
    relatedPrayers: [
      "veni-creator-spiritus",
      "prayer-to-the-holy-spirit",
      "act-of-contrition",
      "nicene-creed",
      "morning-offering",
    ],
    relatedPractices: ["spiritual-direction"],
  }),

  guide({
    slug: "how-to-choose-a-confirmation-saint-and-sponsor",
    title: "How to Choose a Confirmation Saint and Sponsor",
    summary:
      "Why candidates take a saint's name, how to search for a patron (by patronage, by your own name, by your own story), how to read the saint's life, the Church's requirements for a sponsor, how to ask, and what to tell the parish.",
    sacramentKey: "confirmation",
    authorityLevel: "USCCB",
    citations: [U_CONF, V_CIC_CONF_EUCH],
    intro:
      "Two choices belong to a Confirmation candidate: a saint and a sponsor. The saint is a custom, a patron whose name you may take and whose prayers and example you claim for the rest of your life. The sponsor is required by the Church, a confirmed Catholic who presents you to the bishop and undertakes to help you live what the sacrament gives. Both should be chosen slowly and prayerfully rather than in the last week before the forms are due. This guide takes each in turn.",
    whatYouNeed: [
      "Time: begin months before the parish deadline, not days",
      "A good source of saints' lives (the parish library, this site's saints pages, a reliable Catholic biography)",
      "Canon 893 and canon 874, which set the requirements for a sponsor (summarized below)",
      "The parish's form or deadline for the saint's name and the sponsor certificate",
    ],
    whenToPray:
      "During the preparation year. Ask the Holy Spirit to lead you to a saint and a sponsor, and ask the saint you are considering to pray for you as you decide.",
    tips: [
      "Your baptismal name is already a saint's name for most Catholics; keeping it is a perfectly good choice and the rite does not require a new one.",
      "Choose a saint whose life you have actually read, not one whose name simply sounds good.",
      "The sponsor need not be a family member, but may be; only your parents are excluded.",
      "If you cannot find a sponsor who meets the requirements, ask the parish; it will help you find a suitable Catholic rather than let you choose someone who cannot serve.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Why a saint",
        body: "The custom of taking a saint's name at Confirmation grew from the practice of giving a Christian name at Baptism: the name places you under the protection of a member of the Church in heaven and gives you a model of holiness in the flesh. The Order of Confirmation does not require a new name; where the custom exists the bishop uses the chosen name when he says, 'N., be sealed with the Gift of the Holy Spirit.' Choosing a saint is therefore an act of friendship, not a formality: you are asking someone who has finished the race to pray for you as you run it.",
      },
      {
        order: 2,
        title: "How to search: patronages, your name, your story",
        body: "There are three good doors in. First, patronage: the Church honors saints as patrons of students, nurses, musicians, soldiers, those with a particular illness, those struggling with a particular sin, whole countries; look for one whose patronage touches your life. Second, your own name: if you were baptized with a saint's name, consider simply keeping it and learning that saint's story. Third, your story: a saint from your family's homeland, a saint whose conversion resembles your own, a saint who died young if you are young, a saint who struggled where you struggle. Make a short list of two or three and pray to each for a week.",
      },
      {
        order: 3,
        title: "Read the saint's life",
        body: "Read a real life, not a paragraph: how the saint was raised, what he or she was like before conversion, what the saint suffered, what the saint wrote or said, how he or she died. Note the saint's feast day, so you can keep it every year, and learn one prayer or line associated with the saint. If after reading you find that you admire the saint but do not want to imitate him or her, choose someone else; the point is imitation. Ask the saint's prayers in your own words, and choose when you find yourself returning to one name.",
      },
      {
        order: 4,
        title: "Know the sponsor requirements",
        body: `Canon 893 says the sponsor must fulfill the conditions of canon 874 for a baptismal godparent, and that it is desirable that the sponsor be one of your baptismal godparents. The sponsor must ${SPONSOR_REQUIREMENTS} A practicing Catholic who is married outside the Church without a convalidation, or who has abandoned the practice of the faith, cannot honestly take the role, however much you love them; the parish may ask the sponsor to attest to these things in writing.`,
      },
      {
        order: 5,
        title: "Ask the sponsor",
        body: "Ask in person if you can, and say what you are asking: to present you to the bishop, to stand with a hand on your shoulder as you are anointed, and, in the words of canon 892, to take care that you behave as a true witness of Christ and faithfully fulfill the obligations of the sacrament. Give the person freedom to decline. Once he or she accepts, ask for a sponsor certificate from the sponsor's own parish and pass along the date, the time, and any parish rehearsal. A sponsor who is a godparent, an older sibling, an aunt or uncle, a teacher or a family friend can all be excellent; a sponsor who lives far away can still serve if he or she can be present on the day.",
      },
      {
        order: 6,
        title: "Tell the parish",
        body: "Give the parish the saint's name you have chosen (or say that you are keeping your baptismal name) and the sponsor's name and certificate by the deadline it sets; the parish needs these for the bishop's list and for your Confirmation certificate, and it will record the sponsor's name in the Confirmation register and notify the parish of your Baptism. Then, having chosen, stop deliberating and start praying: ask your saint daily for his or her intercession, and ask your sponsor to pray for you until the day. Pray the Litany of Humility if you notice the choices becoming about appearances rather than about holiness.",
      },
    ],
    relatedPrayers: ["prayer-to-the-holy-spirit", "litany-of-humility", "veni-creator-spiritus"],
  }),

  guide({
    slug: "how-to-be-a-confirmation-sponsor",
    title: "How to Be a Confirmation Sponsor",
    summary:
      "The Church's requirements for a sponsor, how to prepare yourself, exactly what you do in the rite (the hand on the shoulder), and how to keep the role alive afterward through prayer, contact and the witness of your own life.",
    sacramentKey: "confirmation",
    authorityLevel: "USCCB",
    citations: [U_CONF, V_CCC_CONF],
    intro:
      "A Confirmation sponsor presents the candidate to the bishop and, in the words of canon 892, takes care that the confirmed person behaves as a true witness of Christ and faithfully fulfills the obligations inherent in the sacrament. It is a real office in the Church, not a seat of honor, and it continues long after the day. If you have been asked, someone thinks your faith is worth imitating. This guide tells you what the Church requires of you, what you will do in the rite, and how to be a sponsor for life.",
    whatYouNeed: [
      "A sponsor certificate or letter from your own parish, requested as soon as you accept",
      "A recent Confession and Sunday Mass with the candidate in mind",
      "The date, time and any rehearsal the candidate's parish has scheduled",
      "The candidate's Confirmation name, so you can pray to that saint for him or her",
    ],
    whenToPray:
      "From the day you accept, through the preparation, on the day itself, and for as long as you live. A daily Hail Mary or Our Father for your candidate is a good measure.",
    tips: [
      "If you are the candidate's baptismal godparent, you are the Church's first choice for sponsor (canon 893 §2); say yes if you can.",
      "Dress and behave on the day as someone presenting a young Christian to the bishop; the candidate will follow your lead.",
      "The hand on the shoulder is your one physical task in the rite; watch the sponsor ahead of you if you are unsure of the moment.",
      "Your candidate may drift in the years after Confirmation. Keep praying and keep in touch; the office does not end when the practice lapses.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Check that you meet the requirements",
        body: `Canon 893 applies to a Confirmation sponsor the same requirements as for a baptismal godparent. You must ${SPONSOR_REQUIREMENTS} 'A life in harmony with the faith' means in practice a Catholic who attends Sunday Mass, whose marriage (if married) is recognized by the Church, and who can honestly promise to help the candidate live as a Catholic. If you cannot meet these, tell the candidate kindly and at once; the parish will help find someone who can.`,
      },
      {
        order: 2,
        title: "Prepare yourself",
        body: "Request the sponsor certificate from your parish office as soon as you accept; it can take a week or two. Go to Confession in the weeks before the celebration, and come to the Mass ready to receive Holy Communion. If the candidate's parish holds a session or rehearsal for sponsors, attend it. Read over the renewal of baptismal promises so that you can answer with the candidates, and pray Veni Creator Spiritus or the Prayer to the Holy Spirit for your candidate each day beforehand. Learn the candidate's Confirmation saint and ask that saint's prayers as well.",
      },
      {
        order: 3,
        title: "The rite: your hand on the candidate's shoulder",
        body: "Sit or stand with your candidate as the parish directs. After the homily the candidates renew their baptismal promises and the bishop, with the priests, extends his hands over them and prays for the gifts of the Spirit. Then the candidates come forward one by one. You come with your candidate and place your right hand on his or her right shoulder; in some dioceses the sponsor also gives the candidate's Confirmation name to the bishop. The bishop anoints the candidate's forehead with chrism, saying, 'N., be sealed with the Gift of the Holy Spirit,' the candidate answers, 'Amen,' and to 'Peace be with you' answers, 'And with your spirit.' Then you both return to your places. That is the whole of your part; do it with recollection.",
      },
      {
        order: 4,
        title: "Pray for your candidate",
        body: "The first and lasting duty of a sponsor is prayer. Put your candidate's name into your daily prayers and keep it there: an Our Father or Hail Mary each day, a Mass offered for him or her on the anniversary of Confirmation, the Prayer to the Holy Spirit at moments you know are hard for the young person (exams, a move, a loss). Tell your candidate that you pray for him or her daily; it may be the thing he or she remembers longest.",
      },
      {
        order: 5,
        title: "Stay in touch",
        body: "Mark the anniversary of the Confirmation and the feast of the candidate's saint each year with a card, a message or a visit. Keep the relationship warm enough that your candidate would call you with a question about the faith, or about anything. Invite him or her to Mass when you are together, to a parish event, to a retreat. In the years after Confirmation many young people stop practicing; a sponsor who remains present without pressure or reproach is often the reason they come back.",
      },
      {
        order: 6,
        title: "Model the faith",
        body: "Canon 892 asks you to take care that the confirmed person behaves as a true witness of Christ; the most effective way to do that is to be one. Keep Sunday Mass, go to Confession, pray, serve, speak of the faith naturally and without embarrassment, and let your candidate see how you handle failure, doubt and suffering as a Christian. You cannot give what you do not have, and you will give more than you know by simply living as a confirmed Catholic in front of someone who is watching.",
      },
    ],
    relatedPrayers: [
      "veni-creator-spiritus",
      "prayer-to-the-holy-spirit",
      "our-father",
      "hail-mary",
    ],
  }),

  // ────────────────────────── EUCHARIST AND MASS ──────────────────────────
  guide({
    slug: "preparing-for-first-communion",
    title: "How to Prepare a Child for First Holy Communion",
    summary:
      "The parish programme, how to teach the Real Presence simply, the first Confession that precedes First Communion, the one-hour Eucharistic fast, how to receive, the day itself, and keeping Sunday Mass afterward.",
    sacramentKey: "eucharist",
    authorityLevel: "USCCB",
    citations: [U_EUCH, V_CCC_EUCH],
    intro:
      "The Eucharist is the source and summit of the Christian life, and a child's first Holy Communion is one of the great days of a Catholic family. The Church's law (canon 913) asks that children receive when they have sufficient knowledge and careful preparation to understand the mystery of Christ according to their capacity, and can receive the Body of the Lord with faith and devotion; this is ordinarily around the age of seven, the age of discretion. Parents are the first teachers, and the parish walks with them. This guide follows the ordinary path in the United States.",
    whatYouNeed: [
      "The child's baptismal certificate, requested from the parish of Baptism",
      "Enrollment in the parish's First Communion preparation, usually a year of catechesis",
      "A simple, true way of explaining the Eucharist to a child (below)",
      "Preparation for the child's first Confession, which comes before First Communion",
      "A modest white dress or a suit, or whatever the parish asks",
    ],
    whenToPray:
      "Throughout the preparation year, and at home every day: grace before meals, a bedtime Our Father and Hail Mary, and Sunday Mass together without exception.",
    tips: [
      "The child learns most from watching you receive. Go to Communion reverently, and go to Confession yourself before the day.",
      "Keep the party proportionate to the sacrament. The child should remember Jesus, not the bounce house.",
      "Children with disabilities have the same right to the sacraments as any other child; the Church asks only that the child be able to distinguish the Eucharist from ordinary food in some way. Talk with the parish.",
      "If your family has been away from Mass, First Communion is a natural moment to return; the parish will welcome you without questions.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Enroll in the parish programme",
        body: "Contact the parish religious education office a year or more before you hope your child will receive; most parishes prepare children in the second grade or around age seven, over a full year of classes, often with parent sessions. Bring the child's baptismal certificate; if the child was baptized elsewhere, the parish will need the name and location of that church. Canon 914 places the duty of preparation first on the parents and then on the pastor, so do not treat the classes as delegation: ask what is being taught each week and continue it at home.",
      },
      {
        order: 2,
        title: "Teach the Real Presence simply",
        body: "A seven-year-old can grasp the heart of it. At the Last Supper Jesus took bread and said, 'This is my Body,' and took the cup and said, 'This is my Blood,' and told the Apostles to do this in memory of him. At every Mass the priest says the same words, and by the power of the Holy Spirit the bread and wine become the Body and Blood of Jesus, really and truly, even though they still look and taste like bread and wine. When we receive Holy Communion, Jesus himself comes to us. Say it often, say it plainly, and let your own reverence at Mass show the child you believe it. Genuflect toward the tabernacle together, and explain why.",
      },
      {
        order: 3,
        title: "Prepare for first Confession",
        body: "Canon 914 asks that sacramental Confession precede First Communion, so parishes prepare children for first Reconciliation in the months before. Teach your child to examine his or her conscience with a few simple questions (Have I obeyed my parents? Have I told the truth? Have I been kind? Have I prayed?), to say, 'Bless me, Father, for I have sinned; this is my first Confession,' to name what he or she is sorry for, and to pray a simple Act of Contrition. Reassure the child that the priest is kind, that nothing said is ever repeated, and that Jesus forgives everything. Go to Confession yourself the same week.",
      },
      {
        order: 4,
        title: "Teach the Eucharistic fast",
        body: "Canon 919 asks that a person who is to receive Holy Communion abstain from all food and drink, except water and medicine, for at least one hour before receiving. For a child that usually means no snacks in the car on the way to Mass. Explain it as a way of showing that Jesus is the most important food of the day, and make it a family habit rather than a rule for the child alone. The elderly and the sick, and those who care for them, may receive even if they have eaten within the hour.",
      },
      {
        order: 5,
        title: "Practice how to receive",
        body: "In the United States the communicant receives standing, and bows the head before receiving as a sign of reverence. Practice at home: walk up with hands folded, bow the head, and when the minister holds up the Host and says, 'The Body of Christ,' answer clearly, 'Amen.' The child may receive on the tongue (tilt the head back slightly, open the mouth, extend the tongue) or in the hand (place the left hand on top of the right, or the reverse if left-handed, receive the Host, step aside, and place it in the mouth at once with the other hand, before turning away). If the Precious Blood is offered, the child bows, hears 'The Blood of Christ,' answers 'Amen,' takes a small sip, and hands the chalice back. Then return to the pew, kneel and talk to Jesus.",
      },
      {
        order: 6,
        title: "The day itself",
        body: "Keep the morning calm: the fast, a prayer together, arriving early. Sit where the parish directs, and let the child know you are proud and praying. Watch him or her receive; then, back in the pew, give the child a few quiet minutes to make a thanksgiving, perhaps with the Anima Christi or the child's own words. Take photographs after Mass, not during Communion. Whatever gifts are given, let one be a rosary, a Bible or a holy card the child can keep. Have the priest bless the child if the parish offers it, and thank the catechists.",
      },
      {
        order: 7,
        title: "Keep Sunday Mass afterward",
        body: "First Communion is meant to be the first of a lifetime. The surest way to make it so is for the family to keep Sunday Mass every week without exception, to receive Communion together whenever you are properly disposed, to go to Confession regularly (monthly is a good family rhythm), and to talk about the readings on the way home. Teach the child the Act of Spiritual Communion for days he or she cannot receive. Mark the anniversary each year. A child who receives Jesus every Sunday for ten years has been given a foundation nothing can take away.",
      },
    ],
    relatedPrayers: [
      "act-of-contrition",
      "grace-before-meals",
      "anima-christi",
      "act-of-spiritual-communion",
      "our-father",
    ],
    relatedDevotions: ["eucharistic-adoration"],
    relatedSaints: ["saint-pope-pius-x", "saint-tarcisius"],
  }),

  guide({
    slug: "how-to-prepare-to-receive-holy-communion",
    title: "How to Prepare to Receive Holy Communion",
    summary:
      "Being in a state of grace, keeping the one-hour fast, coming with attention, approaching reverently, receiving on the tongue or in the hand, answering Amen, and making a thanksgiving afterward, as the Church's law and the General Instruction of the Roman Missal ask.",
    sacramentKey: "eucharist",
    authorityLevel: "USCCB",
    citations: [U_EUCH, V_CIC_CONF_EUCH],
    intro:
      "Holy Communion is the reception of Christ himself, Body, Blood, Soul and Divinity, under the appearances of bread and wine. Because of who is received, the Church asks the communicant to come prepared: free of grave sin, fasting, attentive and reverent. None of this is meant to keep anyone away; St. Paul's warning about receiving unworthily (1 Corinthians 11) and the Church's law together exist so that we receive the Lord as the gift he is. This guide gives what the Church actually asks, and the ordinary way of receiving in the United States.",
    whatYouNeed: [
      "A conscience free of unconfessed mortal sin (go to Confession first if it is not)",
      "The one-hour fast from food and drink other than water and medicine",
      "A few minutes before Mass to recollect yourself",
      "A prayer of thanksgiving for afterward: the Anima Christi, Adoro te devote, or your own words",
    ],
    whenToPray:
      "At every Mass you attend when you are properly disposed; the Church asks Catholics to receive at least once a year, in Easter time, and encourages frequent, even daily, Communion. A person may receive a second time on the same day only within a Mass he or she is taking part in (canon 917).",
    tips: [
      "If you are conscious of a mortal sin, do not receive until you have been to Confession, except in the case canon 916 provides: a grave reason, no opportunity to confess, and an act of perfect contrition with the intention of confessing as soon as possible.",
      "Venial sins do not bar you from Communion; the Confiteor and the Lamb of God at Mass, prayed sincerely, are already a remedy for them.",
      "The choice between receiving on the tongue and in the hand belongs to you, not to the minister.",
      "If you cannot receive for any reason, come forward for a blessing where that is the custom, or remain in the pew and make an Act of Spiritual Communion.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Be in a state of grace",
        body: "Canon 916 says that one who is conscious of grave sin is not to receive the Body of the Lord without previous sacramental Confession, unless there is a grave reason and no opportunity to confess, in which case the person must make an act of perfect contrition with the intention of confessing as soon as possible. The Catechism (1385) says the same. So examine your conscience honestly before Mass. If you find a mortal sin, a serious matter done with full knowledge and deliberate consent, go to Confession before receiving; most parishes hear confessions on Saturday and often before Sunday Masses. If you find only venial sins, ask forgiveness in the Confiteor and receive.",
      },
      {
        order: 2,
        title: "Keep the Eucharistic fast",
        body: "Canon 919 asks that you abstain from all food and drink, except water and medicine, for at least one hour before receiving Holy Communion, not before Mass begins. The fast is small, and that is the point: a bodily sign that you are hungry for the Bread of Life. The elderly, the sick and those who care for them may receive even if they have eaten within the hour. If you have simply forgotten and eaten, the ordinary counsel is to refrain from receiving that day and make a spiritual Communion instead, and to remember next time.",
      },
      {
        order: 3,
        title: "Come with attention",
        body: "Arrive a few minutes early, kneel, and tell the Lord why you have come. Take part in the whole Mass, since Communion is the fruit of the sacrifice, not a separate event: confess with the Confiteor, listen to the readings, pray the Creed, unite yourself with the offering in the Eucharistic Prayer. As the Our Father and the Lamb of God are prayed, gather your desire. Before Communion the priest holds up the Host and says, 'Behold the Lamb of God, behold him who takes away the sins of the world. Blessed are those called to the supper of the Lamb,' and all answer, 'Lord, I am not worthy that you should enter under my roof, but only say the word and my soul shall be healed.' Mean it.",
      },
      {
        order: 4,
        title: "Approach reverently",
        body: "Come forward in the procession with your hands folded or held before you, walking unhurriedly and without talking. In the dioceses of the United States the norm is to receive standing, and to make a bow of the head before receiving the Sacrament as a sign of reverence; do this as the person ahead of you is receiving, so you do not hold up the line. Kneeling to receive is not forbidden and a communicant who kneels is not to be refused. Keep your eyes on the Host, not on the people around you.",
      },
      {
        order: 5,
        title: "Receive on the tongue or in the hand",
        body: "Either way is the sacrament in full, and the choice is yours. To receive on the tongue: tilt your head back slightly, open your mouth and extend your tongue enough for the minister to place the Host on it, then close your mouth and step aside. To receive in the hand: hold your hands at chest height, one open palm resting on the other, and let the minister place the Host in your palm; do not reach for it or take it with your fingers. Step to one side, and with your free hand place the Host in your mouth at once, in the presence of the minister, before turning to return. Never walk away with the Host in your hand. If the chalice is offered, bow, answer 'Amen' to 'The Blood of Christ,' take a small sip, and return the chalice with both hands.",
      },
      {
        order: 6,
        title: "Say Amen",
        body: "The minister shows you the Host and says, 'The Body of Christ.' You answer, aloud and clearly, 'Amen.' That single word is your profession of faith: it means 'It is so'; it is Christ; I believe. St. Augustine told his people that in answering Amen they were saying yes to what they are, the Body of Christ. Say it, then, as a believer and not as a reflex. If you are receiving from the chalice, the same exchange follows: 'The Blood of Christ.' 'Amen.'",
      },
      {
        order: 7,
        title: "Return and give thanks",
        body: "Go back to your place, kneel or sit as the assembly does, and spend the minutes after Communion with the One you have received. This is the closest union with Christ that you will have on earth. Pray in your own words, or use a prayer the Church has loved: the Anima Christi ('Soul of Christ, sanctify me...') or Adoro te devote. Thank him, ask him for what you need, pray for those you love and for the dead. Stay through the closing prayer, the blessing and the dismissal. If you can, remain for a few minutes after Mass; the Church's tradition prizes a thanksgiving of about a quarter of an hour, and the Real Presence remains within you as long as the appearances of bread remain.",
      },
    ],
    relatedPrayers: [
      "confiteor",
      "act-of-contrition",
      "anima-christi",
      "adoro-te-devote",
      "act-of-spiritual-communion",
    ],
    relatedDevotions: ["eucharistic-adoration"],
    relatedPractices: ["fasting"],
    relatedSaints: ["saint-thomas-aquinas"],
  }),

  guide({
    slug: "how-to-participate-in-mass",
    title: "How to Participate in Mass",
    summary:
      "The full, conscious and active participation the Church asks for: arriving prepared, the postures of standing, kneeling and sitting, the responses in full, listening to the readings, the Creed and the Prayer of the Faithful, the Eucharistic Prayer, Communion and thanksgiving, and the dismissal.",
    sacramentKey: "eucharist",
    authorityLevel: "USCCB",
    citations: [U_ORDER, V_GIRM],
    intro:
      "The Second Vatican Council asked that all the faithful be led to that full, conscious and active participation in the liturgy which the very nature of the liturgy demands. Participation is not first of all doing things; it is uniting yourself, body and soul, with Christ's sacrifice as it is made present on the altar. But it has a body: postures, responses, silence and song. This guide walks through the Mass of the Roman Rite as celebrated in the United States, giving the responses in full and the postures the General Instruction of the Roman Missal and the American adaptations ask for.",
    whatYouNeed: [
      "Ten minutes before Mass to arrive, find a place and settle",
      "The Sunday readings, read once beforehand if you can (a missal, the parish's missalette, or the USCCB daily readings)",
      "The responses of the Mass, given below until they are yours by heart",
      "A state of grace and the one-hour fast if you intend to receive Communion",
    ],
    whenToPray:
      "Every Sunday and holy day of obligation, and as often as you can on weekdays. Canon 1248 allows the obligation to be satisfied at a Mass on the day itself or on the evening of the preceding day.",
    tips: [
      "Postures differ slightly from country to country; when the local custom differs from what is written here, follow the assembly.",
      "Sing. The General Instruction says the singing of the people is of great importance; a spoken Gloria is a lesser thing than a sung one.",
      "Keep silence at the moments the Missal asks for it: after the readings, after the homily, and after Communion.",
      "Put the phone away entirely; even a missal app is a distraction for most people. A printed missal or the missalette is enough.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Arrive early and prepare",
        body: "Come ten minutes before Mass begins. Bless yourself with holy water at the door, a reminder of your Baptism. Genuflect toward the tabernacle (or bow to the altar if the Blessed Sacrament is not reserved there) before entering the pew, kneel, and pray briefly: thank God for bringing you, ask forgiveness for the week's sins, and offer the Mass for an intention. Glance over the readings. Then sit or kneel quietly; the minutes before Mass belong to God, not to conversation.",
      },
      {
        order: 2,
        title: "Standing, kneeling, sitting",
        body: "In the United States the faithful stand from the entrance chant until the end of the Collect (the opening prayer); sit for the first reading, the psalm and the second reading; stand for the Alleluia and the Gospel; sit for the homily; stand for the Creed and the Prayer of the Faithful; sit during the preparation of the gifts; stand from the invitation 'Pray, brethren' through the Holy, Holy, Holy; kneel from after the Holy, Holy, Holy until after the great Amen that ends the Eucharistic Prayer; stand for the Our Father, the sign of peace and the Lamb of God; kneel after the Lamb of God; and stand for the prayer after Communion and the dismissal. Standing is the posture of the risen; kneeling of adoration and penitence; sitting of listening. Each is a prayer of the body.",
      },
      {
        order: 3,
        title: "The introductory rites and the responses",
        body: "Mass begins with the Sign of the Cross: 'In the name of the Father, and of the Son, and of the Holy Spirit.' 'Amen.' The priest greets you: 'The Lord be with you.' 'And with your spirit.' In the Penitential Act you may pray the Confiteor together ('I confess to almighty God and to you, my brothers and sisters, that I have greatly sinned...'), striking your breast at 'through my fault, through my fault, through my most grievous fault,' or answer the priest's invocations: 'Lord, have mercy.' 'Christ, have mercy.' 'Lord, have mercy.' On Sundays outside Advent and Lent the Gloria follows, sung if possible. The priest says, 'Let us pray,' and after a pause prays the Collect, to which all answer, 'Amen.'",
      },
      {
        order: 4,
        title: "Listen to the readings",
        body: "Sit and listen; the Word of God is being proclaimed to you, and listening is participation. After the first and second readings the reader says, 'The word of the Lord,' and you answer, 'Thanks be to God.' Sing or say the response to the psalm. Stand for the Alleluia (or the Lenten acclamation). The deacon or priest says, 'The Lord be with you.' 'And with your spirit.' 'A reading from the holy Gospel according to N.' 'Glory to you, O Lord,' as you trace a small cross on your forehead, lips and heart, asking that the Gospel be in your mind, on your lips and in your heart. At the end: 'The Gospel of the Lord.' 'Praise to you, Lord Jesus Christ.' Sit for the homily and listen for one thing to take home.",
      },
      {
        order: 5,
        title: "The Creed and the Prayer of the Faithful",
        body: "Stand and profess the faith in the Nicene Creed ('I believe in one God, the Father almighty...'), bowing at the words 'and by the Holy Spirit was incarnate of the Virgin Mary, and became man.' The Apostles' Creed may be used instead, especially in Lent and Easter. Then the Prayer of the Faithful: to each petition answer with the response given, most often, 'Lord, hear our prayer.' Add your own intentions silently. Sit as the gifts are brought forward and the altar is prepared; if a collection is taken, give as an act of worship, not a fee.",
      },
      {
        order: 6,
        title: "The Eucharistic Prayer",
        body: "Stand as the priest says, 'Pray, brethren, that my sacrifice and yours may be acceptable to God, the almighty Father,' and answer, 'May the Lord accept the sacrifice at your hands, for the praise and glory of his name, for our good and the good of all his holy Church.' After the Prayer over the Offerings, the dialogue: 'The Lord be with you.' 'And with your spirit.' 'Lift up your hearts.' 'We lift them up to the Lord.' 'Let us give thanks to the Lord our God.' 'It is right and just.' Sing the Holy, Holy, Holy, then kneel. This is the heart of the Mass: unite yourself in silence with what the priest is doing as the bread and wine become the Body and Blood of Christ. After the consecration answer the Mystery of Faith, for example: 'We proclaim your Death, O Lord, and profess your Resurrection until you come again.' At the end, to 'Through him, and with him, and in him...', answer with the great 'Amen.'",
      },
      {
        order: 7,
        title: "Communion and thanksgiving",
        body: "Stand and pray the Our Father with everyone. Answer the priest's prayer for peace: 'The Lord be with you.' 'And with your spirit.' Offer the sign of peace to those near you. Sing or say the Lamb of God and kneel. The priest holds up the Host: 'Behold the Lamb of God, behold him who takes away the sins of the world. Blessed are those called to the supper of the Lamb.' All: 'Lord, I am not worthy that you should enter under my roof, but only say the word and my soul shall be healed.' If you are properly disposed, come forward, bow your head, answer 'Amen' to 'The Body of Christ,' receive, and return to kneel and give thanks; the Anima Christi is a fitting prayer. If you cannot receive, make an Act of Spiritual Communion in your place. Keep the silence after Communion.",
      },
      {
        order: 8,
        title: "The dismissal",
        body: "Stand for the Prayer after Communion ('Amen'), any announcements, and the final blessing: 'The Lord be with you.' 'And with your spirit.' 'May almighty God bless you, the Father, and the Son, and the Holy Spirit.' 'Amen,' as you make the Sign of the Cross. Then the dismissal, 'Go forth, the Mass is ended,' or 'Go in peace, glorifying the Lord by your life,' to which you answer, 'Thanks be to God.' The word Mass comes from this sending. Stay for the closing hymn, genuflect as you leave the pew, and carry what you have received into the week. Participation ends not at the church door but in how you live until next Sunday.",
      },
    ],
    relatedPrayers: [
      "confiteor",
      "nicene-creed",
      "apostles-creed",
      "our-father",
      "anima-christi",
      "act-of-spiritual-communion",
    ],
    relatedDevotions: ["eucharistic-adoration"],
  }),

  guide({
    slug: "how-to-keep-sunday-holy",
    title: "How to Keep Sunday Holy",
    summary:
      "The Lord's Day as the Church asks it to be kept: the Sunday obligation and its meaning, planning Mass first, rest from unnecessary work, the family meal, works of charity, and closing the day with Vespers or the Rosary.",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_DD, V_CIC_TIMES],
    intro:
      "Sunday is the day of the Lord's Resurrection, the first day of the week and the weekly Easter of the Church. The third commandment, 'Remember to keep holy the sabbath day,' is fulfilled for Christians on Sunday, and canon 1247 gives it two parts: to take part in Mass, and to abstain from those works and affairs which hinder the worship of God, the joy proper to the Lord's Day, or the due relaxation of mind and body. Pope St. John Paul II's letter Dies Domini describes Sunday as the day of the Lord, of Christ, of the Church, of man and of days. This guide turns that into a week-by-week practice.",
    whatYouNeed: [
      "A fixed Sunday Mass time your household actually keeps",
      "A plan made on Saturday for whatever work can be finished or set aside",
      "A meal, a table and the people who belong at it",
      "Some way of ending the day in prayer: the Rosary, Evening Prayer from the Liturgy of the Hours, or a family blessing",
    ],
    whenToPray:
      "Every Sunday, from the Saturday evening vigil (which already belongs to Sunday) to Sunday night. Holy days of obligation are kept in the same way.",
    tips: [
      "The vigil Mass on Saturday evening satisfies the obligation (canon 1248 §1), but Dies Domini is clear that it is Sunday itself, not merely a Mass, that the Church wants kept holy.",
      "The Church does not condemn all Sunday work: those who must work (in health care, public safety, hospitality) are asked to keep the day as best they can and to find rest at another time; employers are asked not to demand what is unnecessary.",
      "Family obligations or important social service can legitimately excuse from the obligation on a given Sunday, but do not become a habit of excuse.",
      "If Sunday has collapsed into errands and screens, restore one thing at a time: Mass first, then the meal, then the rest.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Understand the obligation and its meaning",
        body: "Canon 1247: on Sundays and other holy days of obligation, the faithful are bound to participate in the Mass, and to abstain from those works and affairs which hinder the worship of God, the joy proper to the Lord's Day, or the due relaxation of mind and body. The Catechism (2181) says deliberately missing Sunday Mass without a serious reason (such as illness or the care of infants) or a dispensation is a grave sin. But the obligation is the minimum, not the meaning. Dies Domini insists that Sunday is not first a rule but a gift: the day on which Christ rose, on which the Church gathers, and on which the human person is set free from the tyranny of work to worship, rest and love.",
      },
      {
        order: 2,
        title: "Plan Mass first",
        body: "Decide on Saturday, at the latest, which Mass the household will attend, and arrange everything else around it rather than the reverse. Canon 1248 §1 says the obligation is satisfied by taking part in a Mass celebrated in a Catholic rite either on the day itself or on the evening of the preceding day, anywhere, so travel is no excuse; look up the Mass times where you will be. Arrive early, take part fully (see the guide on participating in Mass), and receive Communion if you are properly disposed. If you are genuinely unable to attend, canon 1248 §2 recommends a Liturgy of the Word if one is held, or prayer at home, alone or as a family; make an Act of Spiritual Communion.",
      },
      {
        order: 3,
        title: "Rest from unnecessary work",
        body: "Sunday rest is not idleness; it is freedom for what matters. Do not do on Sunday the work that can be done on Saturday or Monday: the laundry, the shopping, the emails. Dies Domini calls this the sanctification of the day and a prophetic witness in a society that never stops. Where the household has children, protect their Sunday from homework marathons and organized sport that crowd out Mass and the family. Where you must work, keep whatever part of the day you can, and take the rest the Lord's Day would have given you at another time.",
      },
      {
        order: 4,
        title: "Share a meal and be a family",
        body: "The Sunday table is the natural echo of the Eucharistic table. Make one meal of the day a real meal: cooked with some care, eaten together without screens, begun with Grace Before Meals and ended with Grace After Meals. Invite someone who would otherwise eat alone. Dies Domini calls Sunday the day of man, a day for the family, for friendship, for creation, for culture; a walk, a visit to grandparents, an afternoon at home together are all ways of keeping it. Talk about the readings from Mass; ask the children what they heard.",
      },
      {
        order: 5,
        title: "Do a work of charity",
        body: "From the beginning, Sunday was the day on which the Church collected for the poor (1 Corinthians 16:2), and Dies Domini says the Lord's Day should be a day of solidarity: a visit to the sick or the lonely, a phone call to someone grieving, a share of the week's earnings given to the parish or to the poor, a kindness to a neighbor. Choose one thing. The rest of Sunday is for receiving; this is for giving, and it keeps the day from turning inward.",
      },
      {
        order: 6,
        title: "End the day with Vespers or the Rosary",
        body: "Close Sunday as you began it, with prayer. Many parishes celebrate Sunday Vespers (Evening Prayer from the Liturgy of the Hours), which the Council and Dies Domini both commend to the faithful; if yours does not, pray Evening Prayer at home, with its psalms and the Magnificat. Or gather the family for the Rosary, or a single decade with the children and a blessing at bedtime. On great feasts the Te Deum is the Church's song of thanksgiving. However you do it, let the last word of the Lord's Day be his, so that the week that follows begins from rest and not from hurry.",
      },
    ],
    relatedPrayers: [
      "act-of-spiritual-communion",
      "grace-before-meals",
      "grace-after-meals",
      "magnificat",
      "te-deum",
      "our-father",
    ],
    relatedDevotions: ["liturgy-of-the-hours", "holy-rosary"],
  }),
];
