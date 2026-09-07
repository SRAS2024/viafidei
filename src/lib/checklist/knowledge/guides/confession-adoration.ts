import type { CuratedEntry } from "../index";

/**
 * Guides — sections C (Confession) and D (Eucharist & Adoration).
 *
 * Every step body is written to be read from the page while actually doing
 * the thing: the words a penitent says are given in full, the versicles and
 * responses of Benediction are given in full, prayer names are spelled out so
 * PrayerLinkedText can make them expandable, and nothing is presented as a
 * norm that the Church does not actually ask for. The examinations of
 * conscience follow the Decalogue, the Beatitudes and the precepts of the
 * Church, in the shape of the examinations the USCCB itself publishes.
 */

// USCCB pages (verified in a browser; the site blocks non-browser clients).
const U_PEN = "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance";
const U_EXAM =
  "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance/examinations-of-conscience";
const U_EXAM_CHILDREN =
  "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance/sacrament-reconciliation-children-examination-conscience.cfm";
const U_EXAM_YOUNG_ADULTS =
  "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance/sacrament-reconciliation-young-adults-examination-of-conscience.cfm";
const U_EXAM_MARRIED =
  "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance/sacrament-reconciliation-married-persons-examination-of-conscience.cfm";
// The plan's ".../sacraments-and-sacramentals/eucharist" page no longer exists;
// the USCCB's Eucharist page now lives at /eucharist.
const U_EUCH = "https://www.usccb.org/eucharist";

// Vatican documents (all verified 200).
// Catechism, Part 2, Section 2, Article 4: The Sacrament of Penance and Reconciliation.
const V_CCC_PEN = "https://www.vatican.va/archive/ENG0015/__P46.HTM";
const V_EDE =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_20030417_eccl-de-euch.html";
const V_SCAR =
  "https://www.vatican.va/content/benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20070222_sacramentum-caritatis.html";
const V_DPP =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const V_MND =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2004/documents/hf_jp-ii_apl_20041008_mane-nobiscum-domine.html";
const V_RP =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_02121984_reconciliatio-et-paenitentia.html";
const V_FC =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_19811122_familiaris-consortio.html";
const V_MV =
  "https://www.vatican.va/content/francesco/en/bulls/documents/papa-francesco_bolla_20150411_misericordiae-vultus.html";

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  kind: "confession" | "adoration";
  sacramentKey: "reconciliation" | "eucharist";
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
      kind: g.kind,
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

/** The words of absolution from the Rite of Penance, quoted in several guides. */
const ABSOLUTION =
  "God, the Father of mercies, through the death and resurrection of his Son has reconciled the world to himself and sent the Holy Spirit among us for the forgiveness of sins; through the ministry of the Church may God give you pardon and peace, and I absolve you from your sins in the name of the Father, and of the Son, and of the Holy Spirit.";

/** Shared closing step for the examinations: how to end and what to bring to the priest. */
const EXAM_CLOSING = (order: number, prayers: string): Step => ({
  order,
  title: "Be sorry, resolve to change, and pray the Act of Contrition",
  body: `Looking over what you have found, ask God for true sorrow: not mainly fear of punishment, but grief at having offended the One who loves you. Decide on one concrete thing you will change, with his grace. Then pray ${prayers}. Bring to the priest every mortal sin you have found, by kind and number as best you can, and whatever venial sins trouble you most. Nothing you say will surprise him, and nothing leaves the confessional.`,
});

export const confessionAndAdorationGuides: CuratedEntry[] = [
  // ─────────────────────────── C. CONFESSION ───────────────────────────
  guide({
    slug: "how-to-go-to-confession",
    title: "How to Go to Confession",
    summary:
      "Step by step through the Sacrament of Penance and Reconciliation: preparing, what to say when you enter, confessing by kind and number, the Act of Contrition, absolution and your penance.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_PEN, V_CCC_PEN],
    intro:
      "Confession is the sacrament in which Christ, through the ministry of a priest, forgives the sins committed after Baptism and restores us to friendship with God and with the Church. Nothing is required of you except honesty, sorrow and the will to change; the priest does the rest, and he is bound by an absolute seal never to reveal anything he hears. The whole celebration usually takes five to ten minutes. This guide walks through the ordinary form of the sacrament, one penitent with one priest, as it is celebrated in every Catholic parish.",
    whatYouNeed: [
      "The confession times of a parish near you (the bulletin or website), or an appointment with a priest",
      "Fifteen quiet minutes beforehand for an examination of conscience — see the Examination of Conscience guide",
      "The Act of Contrition, memorised or on a card; most confessionals also have it printed",
      "Optionally a short written list of what you want to confess (take it home or destroy it afterward)",
    ],
    whenToPray:
      "Whenever you are aware of a mortal sin, before receiving Holy Communion; and by precept at least once a year. Many Catholics go monthly, and before the great feasts of Christmas and Easter. Every parish keeps regular times, most often Saturday afternoon.",
    tips: [
      "If it has been a long time, say so at the start. The priest will lead you through everything; you do not need to know the form by heart.",
      "You may confess anonymously behind a screen or face to face; both are always your choice and both are the sacrament in full.",
      "Confess mortal sins by kind and, as best you can, by number ('three times', 'about once a week'). The priest may ask a brief question to understand; he is not there to interrogate.",
      "If you honestly forget a sin, it is forgiven with the rest. Simply mention it the next time you go.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Examine your conscience",
        body: "Before you go, spend ten or fifteen minutes asking the Holy Spirit to show you your sins, and then look over your life since your last confession in the light of the Ten Commandments, the Beatitudes and the precepts of the Church. Note every mortal sin (a grave matter, done with full knowledge and deliberate consent), and the venial sins that most weigh on you. The Examination of Conscience guide on this site walks through the Commandments one by one.",
      },
      {
        order: 2,
        title: "Be sorry and resolve to change",
        body: "Contrition, sorrow for sin together with the resolve not to sin again, is the heart of the sacrament. Ask God for it: sorrow because sin offends him who is all good and deserving of all our love, not merely because you fear the consequences. Decide concretely what you will avoid or change, including the people, places or habits that lead you into sin. Perfection is not required; a sincere intention is.",
      },
      {
        order: 3,
        title: "Go at the parish's time, and choose the screen or face to face",
        body: "Find the confession times in the parish bulletin or online, or ask a priest for an appointment. Confessionals offer a screen for anonymity and usually a chair for face-to-face confession; either is entirely your choice. Wait your turn in prayer. When you enter, kneel behind the screen or sit facing the priest.",
      },
      {
        order: 4,
        title: "Begin with the Sign of the Cross and the opening words",
        body: "Make the Sign of the Cross. The priest may greet you and say: 'May God, who has enlightened every heart, help you to know your sins and trust in his mercy.' Answer: 'Amen.' Then say: 'Bless me, Father, for I have sinned. It has been [two weeks, six months, many years] since my last confession.' If it helps, add a word about your state in life ('I am married with three children', 'I am a college student'), so the priest can counsel you well.",
      },
      {
        order: 5,
        title: "Confess your sins by kind and number",
        body: "Simply and plainly name your sins: 'I lied to my employer twice. I missed Sunday Mass three times without a serious reason. I looked at pornography, about once a week.' Confess every mortal sin you are aware of after your examination, by kind and, as far as you can, by number; do not hide one out of shame, since a deliberately concealed mortal sin is not forgiven and the confession would need to be made again. You may also confess venial sins, which the Church strongly recommends. There is no need to excuse or explain at length. When you are finished, say: 'For these and all the sins of my past life, I am sorry.'",
      },
      {
        order: 6,
        title: "Listen to the priest's counsel and accept your penance",
        body: "The priest may offer a word of encouragement or advice, and may ask a short question to understand a sin better. He will then give you a penance: usually a prayer or a small act of charity, sometimes an act of restitution. The penance is not a payment for forgiveness, which is Christ's free gift, but a first step in repairing the harm sin has done and in growing in the opposite virtue. If for some real reason you cannot do the penance he gives, tell him then and he will change it.",
      },
      {
        order: 7,
        title: "Pray the Act of Contrition",
        body: "The priest will invite you to express your sorrow. Pray the Act of Contrition aloud: 'O my God, I am heartily sorry for having offended Thee, and I detest all my sins because of Thy just punishments, but most of all because they offend Thee, my God, who art all good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasions of sin. Amen.' Any sincere prayer of sorrow is acceptable; the Rite of Penance offers several forms, and the priest can prompt you if you lose your place.",
      },
      {
        order: 8,
        title: "Receive absolution",
        body: `The priest extends his hands over you and prays the words of absolution: '${ABSOLUTION}' Make the Sign of the Cross with him as he says the last words, and answer: 'Amen.' At that moment every sin you have confessed, and every sin you have honestly forgotten, is forgiven. The priest may then say: 'Give thanks to the Lord, for he is good.' Answer: 'His mercy endures for ever.' And he dismisses you: 'The Lord has freed you from your sins. Go in peace.'`,
      },
      {
        order: 9,
        title: "Do your penance and give thanks",
        body: "Leave the confessional and, unless it is an act to be done later, complete your penance at once in a pew, before you forget it. Then stay a few moments to thank God: an Our Father, a Glory Be, or simply your own words. If you had been away from Communion because of mortal sin, you may now receive again. Leave the church free, and try to keep the resolution you made.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "confiteor",
      "act-of-contrition",
      "our-father",
      "glory-be",
    ],
    relatedPractices: ["ignatian-examen", "spiritual-direction"],
    relatedSaints: ["saint-john-vianney", "saint-padre-pio"],
  }),

  guide({
    slug: "examination-of-conscience",
    title: "Examination of Conscience",
    summary:
      "A traditional examination of conscience before confession, built on the Ten Commandments and the precepts of the Church, with a prayer to begin and the Act of Contrition to end.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_EXAM, V_CCC_PEN],
    intro:
      "An examination of conscience is a prayerful, honest look at one's thoughts, words, deeds and omissions in the light of God's law, made before receiving the Sacrament of Penance. The Church has always rooted it in the Ten Commandments, read through the Gospel and the teaching of the Church, because the Commandments name the ways we fail in love of God and of neighbour. It is not a scrupulous audit: the aim is to know the sins one must confess, to be sorry for them, and to see where grace is asking for growth. Work through each commandment below; the questions are prompts, not a checklist to be completed in full.",
    whatYouNeed: [
      "Ten to fifteen unhurried minutes, ideally in a church or a quiet room",
      "Something to note what you find, if your memory needs it",
      "A confession time to go to afterward, so the examination leads somewhere",
    ],
    whenToPray:
      "Before every confession; briefly each night as part of a daily examen; and more carefully before Christmas and Easter. Those preparing for Holy Communion after a mortal sin must examine themselves and confess first.",
    tips: [
      "Begin with the Holy Spirit, not with yourself. Self-knowledge is his gift, and he gives it gently.",
      "Distinguish mortal from venial sin: mortal sin needs grave matter, full knowledge and deliberate consent, all three. When in doubt, ask the priest rather than deciding alone.",
      "If you have been away a long time, the questions cover the whole period since your last confession, but you need only confess what you actually remember.",
      "Do not linger over the past once it has been confessed. God has forgotten it; you may too.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Begin with prayer",
        body: "Make the Sign of the Cross and ask for light: 'Come, Holy Spirit, show me my sins as you see them, give me true sorrow for them, and the courage to confess them.' The Prayer to the Holy Spirit may be used. Remember that you are examining yourself before a Father who already knows everything and still wants you home. Then take the Commandments in order.",
      },
      {
        order: 2,
        title: "I am the Lord your God; you shall not have strange gods before me",
        body: "Have I loved God above all things, or have I let work, money, comfort, a relationship, an addiction or my own image take his place? Have I neglected prayer for days or weeks? Have I doubted or denied the faith, or been ashamed to profess it? Have I despaired of God's mercy, or presumed on it while planning to sin? Have I taken part in superstition, fortune telling, horoscopes, spiritualism or occult practices? Have I received Holy Communion in a state of mortal sin, or knowingly made a bad confession?",
      },
      {
        order: 3,
        title: "You shall not take the name of the Lord your God in vain",
        body: "Have I used the name of God or of Jesus carelessly, in anger, or as a curse? Have I blasphemed, or spoken with contempt of God, of his Mother, of the saints or of holy things? Have I sworn a false oath, or broken a vow or a promise made to God? Have I spoken of the Church and her sacraments with mockery?",
      },
      {
        order: 4,
        title: "Remember to keep holy the Lord's day",
        body: "Have I missed Mass on a Sunday or a holy day of obligation through my own fault, without a serious reason such as illness or the care of the sick? Have I come habitually late, or left early without need? Have I been inattentive or irreverent at Mass? Have I done unnecessary work on Sunday, or required it of others, and failed to make it a day of rest, worship and family? Have I kept the days of fast and abstinence the Church asks of me?",
      },
      {
        order: 5,
        title: "Honour your father and your mother",
        body: "Have I respected, obeyed and cared for my parents, especially if they are elderly or ill? As a parent, have I provided for my children's needs, prayed with them, taught them the faith and corrected them with love? Have I neglected or abandoned my family duties? Have I shown due respect to teachers, employers and lawful civil authority, and fulfilled my duties as a citizen? Have I fostered division or resentment at home?",
      },
      {
        order: 6,
        title: "You shall not kill",
        body: "Have I harmed anyone in body or in spirit? Have I had, procured, paid for or encouraged an abortion, or taken part in euthanasia or assisted suicide? Have I harboured anger, hatred or the desire for revenge, or refused to forgive? Have I insulted, bullied or humiliated another? Have I given scandal, leading someone else into sin? Have I abused alcohol or drugs, driven recklessly, or neglected my own health? Have I been indifferent to the poor, the sick or the lonely whom I could have helped?",
      },
      {
        order: 7,
        title: "You shall not commit adultery",
        body: "Have I been chaste according to my state in life? Have I committed adultery, or engaged in sexual relations outside marriage? Have I used pornography, or masturbated? Have I used contraception, or been sterilised without grave medical cause? Have I dressed, spoken or acted in ways meant to arouse lust in others? In marriage, have I treated my spouse as an object rather than a person, or refused the gift of self without a real reason?",
      },
      {
        order: 8,
        title: "You shall not steal",
        body: "Have I taken what is not mine, at work, from a shop, from the state, from family? Have I cheated on taxes, exams, contracts or benefits, or failed to pay debts and wages I owe? Have I damaged or wasted the property of others, or used my employer's time and resources dishonestly? Have I made restitution for what I have stolen or damaged? Have I been stingy with the poor and with the Church, or greedy in business? Have I wasted the goods of creation?",
      },
      {
        order: 9,
        title: "You shall not bear false witness against your neighbour",
        body: "Have I lied, and has a lie of mine harmed anyone? Have I gossiped, revealing another's faults without need (detraction), or spread things I knew to be false (calumny)? Have I judged others rashly, or ruined a reputation? Have I flattered, or kept silent when I should have defended the truth or an innocent person? Have I broken a confidence or a professional secret? Have I been sincere with my confessor and with those I love?",
      },
      {
        order: 10,
        title: "You shall not covet your neighbour's wife",
        body: "Have I deliberately entertained impure thoughts or fantasies, or looked at another person with lust? Have I fed my imagination with films, books, images or conversations that inflame it? Have I guarded my eyes and my heart, or let a wrongful attachment to someone grow, whether or not it led to action?",
      },
      {
        order: 11,
        title: "You shall not covet your neighbour's goods",
        body: "Have I been envious of what others have: their money, their success, their gifts, their family? Have I been greedy, always wanting more, or discontented with what God has given me? Have I let anxiety about possessions crowd out trust in his providence? Have I measured people by their wealth or status?",
      },
      {
        order: 12,
        title: "The precepts of the Church",
        body: "Finally, check the minimum the Church asks of all her members: to attend Mass on Sundays and holy days of obligation; to confess my sins at least once a year; to receive Holy Communion at least during the Easter season; to observe the days of fasting and abstinence; and to help provide for the needs of the Church according to my means. Have I kept them? Where I have not, is there a mortal sin to confess, or a habit to change?",
      },
      EXAM_CLOSING(
        13,
        "the Act of Contrition slowly, meaning every word: 'O my God, I am heartily sorry for having offended Thee...'",
      ),
    ],
    relatedPrayers: ["sign-of-the-cross", "prayer-to-the-holy-spirit", "act-of-contrition"],
    relatedPractices: ["ignatian-examen"],
  }),

  guide({
    slug: "examination-of-conscience-for-children",
    title: "Examination of Conscience for Children",
    summary:
      "A simple examination for first confession and for young children, built on love of God, love of family and friends, and honesty with oneself, ending with the Act of Contrition.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_EXAM_CHILDREN, V_CCC_PEN],
    intro:
      "Jesus loved children and told his disciples to let them come to him. Confession is one of the ways he still does, and a child needs only a child's examination: a few honest questions about God, about family and friends, and about himself or herself, asked in the child's own words. This guide follows the shape of the examination the United States bishops publish for children. A parent or catechist can read it aloud with a young child, pausing after each question; an older child can use it alone.",
    whatYouNeed: [
      "A quiet few minutes, at home the night before or in the pew before confession",
      "The Act of Contrition, learned by heart or on a card in simple words",
      "A parent or catechist to read the questions with a younger child",
    ],
    whenToPray:
      "Before first confession and before each confession afterward; a shorter version can be prayed each night before bed as a habit of asking Jesus for forgiveness.",
    tips: [
      "Keep it short. Three or four honest sins are plenty; a child does not need a long list.",
      "Explain the difference between a sin and a mistake: forgetting your homework is not a sin; lying about it is.",
      "Praise the child for honesty rather than reacting to what is confessed. What is said in the confessional stays there.",
      "Practise the words to say to the priest at home so the room holds no surprises.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Get quiet and ask Jesus to help",
        body: "Make the Sign of the Cross. Sit or kneel still for a moment and say in your own words: 'Jesus, help me remember the times I did not love you or other people the way I should. Help me be sorry, and help me do better.' Then think back over the time since your last confession, or, if this is your first, over the last little while.",
      },
      {
        order: 2,
        title: "My responsibilities to God",
        body: "Have I prayed every day, in the morning and at night? Have I prayed with my family? Have I gone to Mass on Sunday, and paid attention there, or have I complained and been moody about going? Have I used God's name or Jesus' name in a bad way? When I was tempted to do something wrong, did I ask God to help me do what is right?",
      },
      {
        order: 3,
        title: "My responsibilities to my family",
        body: "Have I obeyed my parents, and the people who take care of me? Have I talked back, been rude, or sulked when I did not get my way? Have I lied to my parents? Have I been selfish or unkind to my brothers and sisters? Have I done my chores and my homework? Have I shown my family that I love them?",
      },
      {
        order: 4,
        title: "My responsibilities to friends and others",
        body: "Have I been kind to other children, or have I made fun of them, called them names, or left someone out? Have I hit anyone, or lost my temper? Have I told lies, cheated, or taken something that was not mine? If I took something, did I give it back? Have I used bad words? Have I forgiven the people who hurt me, or am I still holding a grudge?",
      },
      {
        order: 5,
        title: "My responsibilities to myself",
        body: "Have I taken care of the body and the mind God gave me: eating, sleeping and playing sensibly, and staying away from things that are bad for me? Have I been honest with myself about what I have done, or have I made excuses? Have I been grateful for what I have, or jealous of what others have? Have I tried to be brave and do the right thing even when it was hard?",
      },
      {
        order: 6,
        title: "Being sorry",
        body: "Now think about the things you found. Tell Jesus you are sorry, not only because you might get into trouble, but because he loves you and sin hurts him and other people. Choose one thing you will try hard to do better this week. Ask him to help you, because you cannot do it on your own, and he does not expect you to.",
      },
      {
        order: 7,
        title: "Telling Jesus through the priest",
        body: "When you go into the confessional, make the Sign of the Cross and say: 'Bless me, Father, for I have sinned. This is my first confession' (or: 'It has been [a month] since my last confession'). Then tell Father your sins simply: 'I lied to my mom two times. I was mean to my brother. I did not say my prayers.' When you finish, say: 'I am sorry for these and all my sins.' Father will talk with you and give you a penance. Then pray the Act of Contrition: 'O my God, I am sorry for my sins with all my heart. In choosing to do wrong and failing to do good, I have sinned against you whom I should love above all things. I firmly intend, with your help, to do penance, to sin no more, and to avoid whatever leads me to sin. Our Saviour Jesus Christ suffered and died for us. In his name, my God, have mercy. Amen.' Father will say the words that forgive your sins; answer 'Amen', say 'Thank you, Father', and go do your penance.",
      },
    ],
    relatedPrayers: ["sign-of-the-cross", "act-of-contrition", "our-father"],
  }),

  guide({
    slug: "examination-of-conscience-for-young-adults",
    title: "Examination of Conscience for Young Adults and Singles",
    summary:
      "The Ten Commandments applied to study, work, friendship, dating and life on one's own, in the shape of the examination the United States bishops publish for young adults.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_EXAM_YOUNG_ADULTS, V_CCC_PEN],
    intro:
      "When the rich young man asked what he must do to inherit eternal life, Jesus looked at him and loved him, and then named the commandments. The same look of love rests on every young person who comes to confession. This examination takes the Ten Commandments in groups and asks them of the life a student, a young worker or a single adult actually lives: the phone, the party, the relationship, the job, the empty apartment. Answer honestly; the point is freedom, not shame.",
    whatYouNeed: [
      "Fifteen honest minutes, with the phone put away",
      "A confession time you can actually get to this week",
      "The Act of Contrition, on a card or memorised",
    ],
    whenToPray:
      "Before each confession; at least once a year by precept, and much more often if you want to grow. A short version each night keeps the list short.",
    tips: [
      "Sins against chastity are common and forgivable; confess them plainly, by kind and rough number, and move on. Priests hear them every day.",
      "Confess what you did, not who you are. 'I got drunk twice' is a confession; 'I'm a mess' is not.",
      "If you are not sure whether something is a sin, ask the priest in the confessional. That is what he is for.",
      "Choose one occasion of sin to cut off this week: an app, a habit, a place, a time of night.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Begin with the Holy Spirit",
        body: "Make the Sign of the Cross and ask for honesty: 'Come, Holy Spirit. Show me what you see, give me sorrow for it, and give me the courage to say it out loud.' The Prayer to the Holy Spirit may be prayed. Remember that Jesus looked at the young man and loved him before he said anything else.",
      },
      {
        order: 2,
        title: "The first, second and third commandments: God, his name, his day",
        body: "Have I gone to Mass every Sunday and holy day, or skipped it for sleep, work, travel or friends? Did I take part, or scroll and daydream? Have I prayed each day, or gone weeks without speaking to God? Have I read Scripture at all? Have I hidden or denied my faith to fit in? Have I used God's name or Jesus' name to curse? Have I dabbled in astrology, tarot, ouija boards or the occult? Have I received Communion knowing I was in mortal sin?",
      },
      {
        order: 3,
        title: "The fourth commandment: family and authority",
        body: "Have I been disrespectful, dishonest or contemptuous toward my parents, even now that I live on my own? Do I call, visit and help them? Have I been fair to roommates, teachers, coaches, employers and the law, or cut corners because no one was watching? Have I taken responsibility for my own life, or left it to others to carry me?",
      },
      {
        order: 4,
        title: "The fifth commandment: anger, life and self-respect",
        body: "Have I nursed anger, resentment or hatred, or refused to forgive someone who hurt me? Have I mocked, bullied or excluded anyone, online or in person? Have I got drunk, used drugs, or driven under the influence? Have I harmed my body or my mind by what I eat, watch or take? Have I had, paid for or pressured someone toward an abortion, or encouraged another to do so? Have I led anyone else into sin?",
      },
      {
        order: 5,
        title: "The sixth and ninth commandments: chastity and relationships",
        body: "Have I used pornography? Have I masturbated? Have I had sexual intercourse, or engaged in sexual touching, outside of marriage? Have I cohabited, or treated dating as a trial marriage? Have I looked at others lustfully, or fed sexual fantasies on purpose? Have I sent or asked for explicit images? Have I dressed or behaved to provoke desire? Have I used another person, or let myself be used?",
      },
      {
        order: 6,
        title: "The seventh and tenth commandments: honesty and generosity",
        body: "Have I stolen, shoplifted, pirated, or cheated on an exam, a time sheet or an application? Have I taken from an employer, or slacked when paid to work? Have I paid back what I owe? Have I been envious of friends' success, looks, money or relationships? Have I spent selfishly and given nothing to the poor or to the Church? Have I let money or career become the measure of my life?",
      },
      {
        order: 7,
        title: "The eighth commandment: truth and reputation",
        body: "Have I lied to get out of trouble or to look better? Have I gossiped, exposed others' faults, or spread rumours, in person or in group chats? Have I mocked or slandered anyone? Have I broken a confidence? Have I been two-faced with friends? Have I stayed silent when someone was being treated unjustly?",
      },
      EXAM_CLOSING(
        8,
        "the Confiteor ('I confess to almighty God...') if you like, and then the Act of Contrition",
      ),
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "prayer-to-the-holy-spirit",
      "confiteor",
      "act-of-contrition",
    ],
    relatedPractices: ["ignatian-examen"],
  }),

  guide({
    slug: "examination-of-conscience-for-married-persons",
    title: "Examination of Conscience for Married Persons",
    summary:
      "The commandments applied to spouses and parents: prayer at home, fidelity and chastity in marriage, openness to life, raising children in the faith, honesty and charity in the household.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_EXAM_MARRIED, V_FC],
    intro:
      "Christian marriage is a sacrament, and the home it builds is a domestic church. Sin wounds it first, in a thousand small refusals of love, and confession heals it. This examination follows the pattern the United States bishops publish for married persons: duties to God, to one's spouse, to one's children and to society, read through the Ten Commandments. Husbands and wives may find it fruitful to go to confession together, each to the priest alone, and then to pray together afterward.",
    whatYouNeed: [
      "Fifteen honest minutes, ideally before a regular confession time you and your spouse both go to",
      "The Act of Contrition",
      "The willingness to ask forgiveness at home as well as in the confessional",
    ],
    whenToPray:
      "Before each confession, and especially before the anniversaries and feasts a family keeps. Many couples go monthly.",
    tips: [
      "Examine your own conscience, not your spouse's. The sins you can confess are yours.",
      "Marriage and sexuality are frequent matters in confession; priests hear them daily. Name them plainly and let the priest help.",
      "What is confessed and forgiven in the confessional may still need to be repaired at home with an apology; do both.",
      "If your marriage is in serious trouble, ask the priest for a conversation outside confession, and for help from your parish or diocese.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Begin with prayer",
        body: "Make the Sign of the Cross and ask the Holy Spirit to show you your sins, above all the ones your spouse and children see and you do not. Remember that God is the author of your marriage and wants it to succeed far more than you do.",
      },
      {
        order: 2,
        title: "Faith and prayer at home",
        body: "Have I gone to Mass every Sunday and holy day, and brought my family? Have I prayed daily, and prayed with my spouse and children: grace at meals, prayers at bedtime, the Rosary? Have I read Scripture, or anything that feeds my faith? Have I nursed resentment against God or the Church? Have I given to the parish and taken part in its life according to my means? Have I made our home a place where Jesus is Lord, or left the faith at the church door?",
      },
      {
        order: 3,
        title: "Fidelity and chastity in marriage",
        body: "Have I committed adultery? Have I flirted with, fantasised about, or fostered an improper attachment to someone other than my spouse, in person or online? Have I used pornography, or masturbated? In our marital relations, have I sought only my own pleasure, been demanding, or refused my spouse out of laziness, revenge or manipulation? Have I been tender and generous, and told my spouse that I love them?",
      },
      {
        order: 4,
        title: "Openness to life",
        body: "Have I used contraception, or been sterilised without grave medical cause? Have I refused children out of selfishness, fear or love of comfort, rather than for the serious reasons the Church recognises? Have I had, paid for or encouraged an abortion? Have I welcomed the children God has given us as gifts, or treated them as burdens? Have I supported my spouse through pregnancy, illness and the exhaustion of raising children?",
      },
      {
        order: 5,
        title: "Raising children in the faith",
        body: "Have I taught my children the Gospel and the commandments, prayed with them, and brought them to the sacraments? Have I been a shepherd to their souls, or left their formation to the school or the screen? Have I disciplined them with patience and love, or with anger, sarcasm or neglect? Have I been affectionate, and spent real time with them? Have I been of one mind with my spouse in raising them, or undermined my spouse in front of them? Do I demand of them a standard I do not keep myself?",
      },
      {
        order: 6,
        title: "Justice and honesty in the household",
        body: "Have I been honest with my spouse about money, time, work and my inner life? Have I been financially responsible, or hidden spending and debt? Have I bullied, manipulated or tried to overpower my spouse to get my way? Have I physically or emotionally abused my spouse or children? Have I misused alcohol or drugs? Have I been just and honest at work, paid what I owe, and cared for the poor and for elderly parents?",
      },
      {
        order: 7,
        title: "Charity in speech",
        body: "Have I spoken sharply, sarcastically or contemptuously to my spouse or children? Have I called them names, or taunted them? Have I gossiped about my spouse to friends or family? Have I nursed bitterness and kept a list of wrongs, or forgiven as I have been forgiven? Have I listened to my spouse's worries, or been too busy? Have I been sullen, moody or silent as a weapon? Have I said 'I am sorry' and 'thank you' at home?",
      },
      EXAM_CLOSING(
        8,
        "the Confiteor and the Act of Contrition, and consider asking your spouse's forgiveness tonight for what you have found",
      ),
    ],
    relatedPrayers: ["sign-of-the-cross", "confiteor", "act-of-contrition"],
    relatedDevotions: ["enthronement-of-the-sacred-heart"],
  }),

  guide({
    slug: "examination-of-conscience-on-the-beatitudes",
    title: "Examination of Conscience on the Beatitudes",
    summary:
      "The eight Beatitudes of the Sermon on the Mount as a mirror for the heart: not only what I have done wrong, but where I have fallen short of the happiness Christ promises.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_EXAM, V_CCC_PEN],
    intro:
      "The Ten Commandments name the boundaries of love; the Beatitudes describe its face, which is the face of Christ. The Church commends both as a basis for examining one's conscience. An examination on the Beatitudes is especially useful for the person who goes to confession regularly and finds the same short list every time: it reaches past actions to attitudes, and asks not only 'what have I done?' but 'whom am I becoming?' Read each Beatitude slowly from Matthew 5, then ask the questions.",
    whatYouNeed: [
      "A Bible open at Matthew 5:1-12, or the text of the Beatitudes",
      "Fifteen quiet minutes",
      "The Act of Contrition, and a confession time to go to",
    ],
    whenToPray:
      "Before confession, particularly for those who confess often; also as a retreat exercise or on a Friday in Lent.",
    tips: [
      "The Beatitudes reveal venial sins and omissions more than mortal sins. Still confess any grave sin you find, by kind and number.",
      "Do not be discouraged: the Beatitudes describe Christ, and no one measures up. They show the direction, not the exam grade.",
      "Pick the one Beatitude that convicts you most and make it your penance and your resolution for the month.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Begin by reading the Beatitudes",
        body: "Make the Sign of the Cross, ask the Holy Spirit for light, and read Matthew 5:1-12 slowly. Jesus is not giving eight new commandments; he is describing the kind of person the Kingdom makes, and the one who first lived every word. Ask him to show you where you resemble him and where you do not.",
      },
      {
        order: 2,
        title: "Blessed are the poor in spirit, for theirs is the kingdom of heaven",
        body: "Do I depend on God, or on my money, competence and connections? Am I attached to possessions, comfort and security in a way that crowds him out? Have I been proud, self-sufficient, unwilling to ask for help or to admit need? Have I hoarded, or been stingy with the poor? Do I pray as one who needs God?",
      },
      {
        order: 3,
        title: "Blessed are those who mourn, for they shall be comforted",
        body: "Do I grieve over my own sins, or shrug them off? Does the suffering of others move me, or have I grown numb to it? Have I run from grief into distraction, drink or busyness? Have I stood with the bereaved, the sick and the lonely, or avoided them because it was uncomfortable? Have I let God comfort me, or refused consolation out of pride?",
      },
      {
        order: 4,
        title: "Blessed are the meek, for they shall inherit the earth",
        body: "Have I been quick to anger, harsh in words, impatient with slow or difficult people? Do I need to win every argument and have the last word? Have I been domineering at home or at work? Have I been gentle with those weaker than I am, with children, with the elderly, with those who serve me? Do I accept correction, or bristle at it?",
      },
      {
        order: 5,
        title:
          "Blessed are those who hunger and thirst for righteousness, for they shall be satisfied",
        body: "Do I actually want to be holy, or only to be comfortable? Have I been lukewarm in prayer, in the sacraments, in learning the faith? Have I been complacent about injustice around me, in my workplace, my city, the treatment of the unborn, the poor, the immigrant? Have I told myself that holiness is for other people?",
      },
      {
        order: 6,
        title: "Blessed are the merciful, for they shall obtain mercy",
        body: "Is there anyone I have not forgiven? Do I hold grudges, keep score, or wish someone ill? Have I been quick to judge and slow to excuse? Have I performed the works of mercy: fed the hungry, visited the sick or imprisoned, instructed, counselled, borne wrongs patiently, prayed for the living and the dead? Have I been merciful to myself, as God is?",
      },
      {
        order: 7,
        title: "Blessed are the pure in heart, for they shall see God",
        body: "Have I been chaste in thought, look and deed according to my state in life? Have I used pornography or fed impure fantasies? Beyond chastity: are my motives pure, or do I do good to be seen? Am I honest, or do I say one thing and mean another? Is there a hidden compartment of my life that I keep from God and from those who love me?",
      },
      {
        order: 8,
        title: "Blessed are the peacemakers, for they shall be called children of God",
        body: "Have I sown discord by gossip, sarcasm or taking sides? Have I made peace between people who were at odds, or enjoyed the conflict? Have I apologised first, or waited for the other to come to me? At home, have I been a source of calm or of tension? Have I prayed and worked for peace in the Church and in the world, or merely complained?",
      },
      {
        order: 9,
        title:
          "Blessed are those who are persecuted for righteousness' sake, for theirs is the kingdom of heaven",
        body: "Have I hidden my faith to avoid mockery or disadvantage? Have I compromised the truth to keep a job, a friend or my reputation? Have I complained bitterly about small slights while the Church suffers real persecution elsewhere? Have I prayed for persecuted Christians, and for those who persecute them? Have I rejoiced, as Jesus commands, when I suffered something for his sake?",
      },
      EXAM_CLOSING(
        10,
        "the Act of Contrition, and then the Prayer of Saint Francis, asking to become an instrument of the peace the Beatitudes describe",
      ),
    ],
    relatedPrayers: ["sign-of-the-cross", "act-of-contrition", "prayer-of-saint-francis"],
    relatedPractices: ["ignatian-examen", "lectio-divina"],
    relatedSaints: ["saint-francis-of-assisi"],
  }),

  guide({
    slug: "how-to-make-a-first-confession",
    title: "How to Make a First Confession (for Children and Parents)",
    summary:
      "Preparing a child for the first celebration of the Sacrament of Penance: what to explain, how to practise, what the child says in the room, and how parents keep confession a normal part of life afterward.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_PEN, V_CCC_PEN],
    intro:
      "Children who have reached the age of reason, around seven, make their first confession before their First Holy Communion; the Church asks it in her law, and parishes prepare children for it in the year of First Communion. Parents are the first teachers of their children in the faith, and a child's fear or peace about confession is mostly caught at home. This guide is for parents and catechists: it explains what to say, how to practise, and exactly what happens in the room, so that the child's first meeting with God's mercy is simple and glad.",
    whatYouNeed: [
      "The date and place of the parish's first confession celebration, and its practice sessions",
      "The Act of Contrition in a form the child can learn (the parish will usually supply one)",
      "The children's examination of conscience on this site, or the parish's own",
      "A parent who goes to confession too, ideally on the same day",
    ],
    whenToPray:
      "In the weeks before first confession, a few minutes at bedtime each night; the sacrament itself is usually celebrated in a parish service during the school year, often in Lent or Advent.",
    tips: [
      "Do not tell a child that confession is scary, embarrassing or a test. Say what it is: telling Jesus you are sorry, and hearing him say 'I forgive you' out loud.",
      "Never ask a child what they confessed. Ask instead how it felt to be forgiven.",
      "Let the child see you go. A parent in the confession line teaches more than any lesson.",
      "If the child forgets the words, the priest will help. Say so, often.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Explain what the sacrament is, in a child's words",
        body: "Tell the child: 'When we do something wrong on purpose, that is a sin, and it hurts our friendship with God and with other people. Jesus gave the priests the power to forgive sins in his name. In confession you tell the priest your sins, you say you are sorry, and Jesus forgives you through him. It is a secret between you, the priest and God, and the priest can never tell anyone.' Read together the parable of the lost sheep (Luke 15:1-7) or the prodigal son (Luke 15:11-32).",
      },
      {
        order: 2,
        title: "Practise the examination of conscience together",
        body: "Over several evenings, go through a children's examination of conscience: prayers, obedience to parents, kindness to brothers, sisters and friends, honesty, chores. Ask the questions gently and let the child answer silently; you are teaching the habit, not collecting the answers. Help the child tell the difference between a sin and an accident, and between a sin and a feeling.",
      },
      {
        order: 3,
        title: "Learn the Act of Contrition",
        body: "Teach one simple form and repeat it at bedtime until it is easy. The Rite of Penance allows any sincere prayer of sorrow; a common children's form is: 'O my God, I am sorry for my sins with all my heart. In choosing to do wrong and failing to do good, I have sinned against you whom I should love above all things. I firmly intend, with your help, to do penance, to sin no more, and to avoid whatever leads me to sin. Our Saviour Jesus Christ suffered and died for us. In his name, my God, have mercy. Amen.' Explain what 'penance' means: a prayer or a kind thing the priest asks us to do to show we are sorry.",
      },
      {
        order: 4,
        title: "Explain what happens in the room",
        body: "Describe the confessional or reconciliation room: the child may kneel behind a screen or sit in a chair facing the priest, and can choose. The priest will be kind and will help with every step. He may read a short line from the Bible. The child tells his or her sins, the priest talks a little, gives a penance, listens to the Act of Contrition, and then says the prayer that forgives sins while holding his hand out over the child. Then the child says 'Amen' and 'Thank you, Father' and leaves. If possible, visit the confessional when the church is empty so the child can see the space.",
      },
      {
        order: 5,
        title: "Practise the words to say",
        body: "Rehearse the whole thing at home, with a parent playing the priest: 'Bless me, Father, for I have sinned. This is my first confession. These are my sins: I disobeyed my mom. I was mean to my sister three times. I told a lie.' Then: 'I am sorry for these and all my sins.' Then the Act of Contrition when Father asks for it. Then 'Amen' after the absolution. Keep it to a few sins; three or four is normal for a child.",
      },
      {
        order: 6,
        title: "Penance and thanksgiving on the day",
        body: "On the day, arrive early and pray quietly together in the pew; a parent may make his or her own confession first. After the child comes out, help him or her do the penance right away in the pew (usually an Our Father or a Hail Mary), and then say a short thank-you to Jesus together. Many families mark the day with a small celebration afterward, because it is one.",
      },
      {
        order: 7,
        title: "Keep confession normal afterward",
        body: "First confession is the beginning of a habit, not a one-off. Take the child with you when you go, every month or two, and keep a nightly moment of sorrow and thanks at bedtime. Do not ask what was confessed. When the child sins seriously or is upset about something, suggest confession as the natural remedy, and go together. A child who sees parents forgiven learns that mercy is real.",
      },
    ],
    relatedPrayers: ["sign-of-the-cross", "act-of-contrition", "our-father", "hail-mary"],
  }),

  guide({
    slug: "how-to-return-to-confession-after-many-years",
    title: "How to Return to Confession After Many Years",
    summary:
      "Coming back to the Sacrament of Penance after a long absence: what to expect, how to prepare, what to tell the priest, and how to begin again without fear.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "USCCB",
    citations: [U_PEN, V_MV],
    intro:
      "Many Catholics have not been to confession in ten, twenty or forty years, and the longer it has been, the harder the door looks. It is not. Priests count a returning penitent among the best moments of their ministry, and the sacrament exists precisely for the person who has been away. You do not need to remember the form, you do not need a complete list, and you do not need to have your life in order first. You need only to come, to be honest, and to be sorry. This guide tells you exactly what will happen.",
    whatYouNeed: [
      "A confession time from a parish bulletin or website, or a phone call to a parish to ask for an appointment",
      "Half an hour beforehand to look back over the years with the Examination of Conscience guide",
      "The Act of Contrition on a card; the priest can also prompt you",
      "Optionally, a few notes so nerves do not empty your memory",
    ],
    whenToPray:
      "Now, rather than later; Advent and Lent are natural seasons, and most parishes hold extra confessions and penance services then. Any regular Saturday time will do.",
    tips: [
      "Tell the priest at once that it has been a long time. He will guide you through everything from there.",
      "If you cannot remember exact numbers, give an honest estimate: 'often', 'for several years', 'a few times'.",
      "If you have been away because of something in your life you are not sure the Church can forgive, come anyway and tell the priest. There is no sin the sacrament cannot absolve.",
      "If you are in a marriage the Church has not recognised, still come; the priest can tell you what is possible and help you toward it.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Know that you are welcome",
        body: "Begin by settling one thing: God has been waiting for you, not keeping score. Read the parable of the prodigal son (Luke 15:11-32) and notice that the father runs. Psalm 130, the De Profundis, is the prayer of exactly this moment: 'Out of the depths I cry to you, O Lord... If you, O Lord, should mark our guilt, Lord, who would survive? But with you is found forgiveness.' Pray it, and go.",
      },
      {
        order: 2,
        title: "Find a time, or ask for an appointment",
        body: "Look up the confession times of a parish near you; most offer Saturday afternoon, and many a weekday. If you would rather not be rushed, phone or email the parish and ask a priest for an appointment, saying only that it has been many years. Any Catholic priest may hear your confession; you need not belong to that parish. Many returning Catholics find it easier to go to a parish where they are not known, and that is fine.",
      },
      {
        order: 3,
        title: "Examine your conscience over the years",
        body: "Take thirty quiet minutes with the Examination of Conscience guide and go through the Ten Commandments, thinking in periods of your life: school, early adulthood, marriage or single life, work, now. You are looking for the serious sins you actually remember, by kind and roughly by number, and the patterns that have marked the years. Write a short list if it helps. Do not try to reconstruct everything; God asks only for what you can honestly recall after a real effort.",
      },
      {
        order: 4,
        title: "Tell the priest it has been a long time",
        body: "When you enter, kneel behind the screen or sit facing the priest, whichever you prefer. Make the Sign of the Cross and say: 'Bless me, Father, for I have sinned. It has been about twenty years since my last confession, and I am not sure I remember how this goes.' The priest will be glad you came and will lead you. If you have notes, you may read from them.",
      },
      {
        order: 5,
        title: "Confess what you remember, by kind and number",
        body: "Go through your list plainly: 'I stopped going to Mass for about fifteen years. I lived with my partner before we married. I used contraception for years. I have been drunk many times. I lied and cheated at work more than once.' Give the kind of sin and an honest sense of how often. Mention the sins you are most ashamed of; those are the ones it helps most to say aloud. Finish with: 'For these and all the sins of my life, especially those I cannot remember, I am sorry.'",
      },
      {
        order: 6,
        title: "Let the priest help",
        body: "The priest may ask a question or two so he understands, and may give some advice about beginning again. He will give you a penance suited to what you have confessed; it will be manageable. If anything in your situation needs sorting out, for instance a marriage outside the Church, he will tell you what the next step is. Ask anything you like; this is your time.",
      },
      {
        order: 7,
        title: "Pray the Act of Contrition and receive absolution",
        body: `When he asks you to express your sorrow, pray the Act of Contrition from the card, or in your own words: 'Lord Jesus, I am sorry for all my sins. I want to come home. Help me to begin again.' Then the priest extends his hands and prays: '${ABSOLUTION}' Answer: 'Amen.' Every sin you confessed, and every sin you honestly forgot, is forgiven at that moment. The priest may add: 'Give thanks to the Lord, for he is good.' Answer: 'His mercy endures for ever.'`,
      },
      {
        order: 8,
        title: "Do your penance and make a fresh start",
        body: "Do your penance in the pew before you leave, and stay a few minutes to thank God. You are now fully reconciled with God and the Church and may receive Holy Communion at the next Mass. Make the next steps small and concrete: Mass this Sunday, a short prayer each morning, and confession again in a month so that the habit takes root. The Confiteor at Mass and a nightly examen will keep the list short from now on.",
      },
    ],
    relatedPrayers: ["de-profundis", "sign-of-the-cross", "act-of-contrition", "confiteor"],
    relatedDevotions: ["divine-mercy-chaplet"],
    relatedSaints: ["saint-augustine-of-hippo", "saint-john-vianney"],
  }),

  guide({
    slug: "how-to-make-an-act-of-perfect-contrition",
    title: "How to Make an Act of Perfect Contrition",
    summary:
      "Sorrow for sin out of love of God, made when confession is not available, together with the firm resolve to confess as soon as possible, as the Catechism teaches.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "VATICAN",
    citations: [V_CCC_PEN, U_PEN],
    intro:
      "The Catechism distinguishes two kinds of contrition. Imperfect contrition, or attrition, is sorrow born of the ugliness of sin or the fear of punishment; it is a gift of God and enough to receive absolution in confession. Perfect contrition is sorrow that arises from love of God above all things. Such contrition, the Catechism teaches, forgives venial sins, and also obtains forgiveness of mortal sins if it includes the firm resolution to have recourse to sacramental confession as soon as possible. It is not a substitute for confession but a bridge to it, for the sick, the isolated, the person in danger of death, or anyone who has fallen and cannot reach a priest tonight.",
    whatYouNeed: [
      "A few minutes of quiet, and a crucifix or an image of Christ if one is at hand",
      "The Act of Contrition and the Act of Love, or your own words",
      "The honest intention to go to confession at the first real opportunity",
    ],
    whenToPray:
      "Whenever you are conscious of mortal sin and cannot confess soon; every night as part of your evening prayer; and in danger of death, for yourself or with someone who is dying.",
    tips: [
      "Perfect contrition is about the motive, not the feeling. You need not weep; you need to be sorry because God is good and you love him.",
      "It does not permit you to receive Holy Communion in place of confession. Someone conscious of grave sin may receive only when there is a grave reason and no opportunity to confess, and even then must resolve to confess as soon as possible.",
      "Do not use it to postpone confession indefinitely. The resolve to confess is part of the act itself.",
    ],
    durationMinutes: 5,
    steps: [
      {
        order: 1,
        title: "Understand what perfect contrition is",
        body: "Perfect contrition is sorrow for sin because it offends God, who is infinitely good and loves us, rather than chiefly because of the punishment sin deserves. It is a grace to be asked for, not a mood to be manufactured. When it is joined to the firm intention to confess as soon as one can, the Church teaches that it restores a person in mortal sin to God's friendship even before absolution; the confession that follows completes and seals what God has already begun.",
      },
      {
        order: 2,
        title: "Know when it applies",
        body: "Make an act of perfect contrition whenever you have sinned gravely and cannot get to confession at once: late at night, when ill, when travelling, or in a place with no priest. Make it with the dying, aloud if they can no longer speak. Make it too as a daily habit, since it deepens sorrow for venial sin. It never replaces confession where confession is possible, and it does not by itself permit Holy Communion.",
      },
      {
        order: 3,
        title: "Recall God's goodness",
        body: "Look at a crucifix, or simply call to mind who God is: the Father who made you and keeps you in being, the Son who died for the very sin you have just committed, the Spirit who has never stopped drawing you back. Let sorrow come from that, from love answering love, and not first from fear. The Act of Love may be prayed here: 'O my God, I love you above all things, with my whole heart and soul, because you are all good and worthy of all my love.'",
      },
      {
        order: 4,
        title: "Pray the act, with the resolve to confess",
        body: "Pray the Act of Contrition slowly, giving weight to its central words: 'O my God, I am heartily sorry for having offended Thee, and I detest all my sins because of Thy just punishments, but most of all because they offend Thee, my God, who art all good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasions of sin. Amen.' Add explicitly: 'I will go to confession as soon as I can.' That resolve is what makes the act complete.",
      },
      {
        order: 5,
        title: "Avoid the occasion of sin",
        body: "Sorrow that is real changes something at once. Close the app, leave the place, end the conversation, pour out the drink, make the phone call you have been avoiding. Decide what you will do differently tomorrow so that the sin is not simply repeated. Ask God, in a sentence, for the help you will need.",
      },
      {
        order: 6,
        title: "Go to confession at the first opportunity",
        body: "Look up the next confession time tonight and plan to go. When you do, confess the sin as you would any other, by kind and number; the act of perfect contrition does not remove the obligation to confess mortal sins, it prepares for it. Then thank God that his mercy reached you before you could reach a priest.",
      },
    ],
    relatedPrayers: ["act-of-love", "act-of-contrition"],
  }),

  guide({
    slug: "how-to-make-a-general-confession",
    title: "How to Make a General Confession",
    summary:
      "A review of one's whole life, or of a long period of it, brought to confession with a priest's guidance at a turning point: entering a new state of life, after a conversion, or on a retreat.",
    kind: "confession",
    sacramentKey: "reconciliation",
    authorityLevel: "VATICAN",
    citations: [V_RP, U_PEN],
    intro:
      "A general confession is a confession that deliberately covers one's whole life, or a long stretch of it, including sins already confessed and forgiven. It is never required and is not a repair for confessions that were valid, but the Church's spiritual masters have long recommended it at moments of new beginning: Saint Ignatius of Loyola places it in the first week of the Spiritual Exercises, and Saint Francis de Sales opens the Introduction to the Devout Life with one. Made once, with a priest's guidance and without anxiety, it can bring a deep peace and a clear view of the patterns of a life. Made repeatedly or in scruples, it does harm, which is why it should always be arranged with a priest beforehand.",
    whatYouNeed: [
      "An appointment with a priest, arranged in advance, and about forty-five minutes",
      "Several days of preparation, using the Examination of Conscience guide period by period",
      "Written notes, which you will destroy afterward",
      "The Act of Contrition",
    ],
    whenToPray:
      "At a turning point: before marriage, ordination or religious profession; after a conversion or return to the faith; during a retreat; or once in a life, when a priest agrees it would help. Not as a regular practice.",
    tips: [
      "Ask a priest first. He may say it would help, or he may say you need something else; either answer is a grace.",
      "A general confession is not for people struggling with scrupulosity, and confessors will usually advise against it for them. If you doubt the validity of past confessions in general, that doubt itself is something to bring to a priest, not to solve by repeating everything.",
      "You are confessing patterns as much as acts: 'for about ten years I...' is exactly right.",
      "When it is over, it is over. Do not go back over the same ground in later confessions.",
    ],
    durationMinutes: 45,
    steps: [
      {
        order: 1,
        title: "Know when a general confession helps, and when it does not",
        body: "It helps when a life is turning: at conversion, before a vocation is embraced, on a serious retreat, or when someone realises that past confessions were made carelessly or with a sin deliberately withheld (in which case it is not merely helpful but necessary, because those confessions were invalid). It does not help the person who is anxious about whether past confessions 'counted' despite honest effort, nor the person who wants to feel clean by repetition. In those cases the remedy is trust and obedience to a confessor, not another list.",
      },
      {
        order: 2,
        title: "Ask a priest beforehand",
        body: "Speak to a priest, ideally one who knows you or who is giving your retreat, and tell him you are thinking of a general confession and why. He will tell you whether it is wise, arrange enough time, and may suggest how to prepare. Never attempt a general confession in the ordinary Saturday line; it is unfair to those waiting and to the priest.",
      },
      {
        order: 3,
        title: "Examine your life by period",
        body: "Over several days, take the Ten Commandments through each stage of your life in turn: childhood, adolescence, early adulthood, and so on to the present. Look for the serious sins you remember, their kind and rough frequency, and for the deeper patterns and roots: pride, lust, resentment, dishonesty, fear. The Litany of Humility prayed each day of the preparation is a good companion. Do not force memories, and do not despair at what you find; you are looking at it with God, who has seen it all along and still called you.",
      },
      {
        order: 4,
        title: "Write brief notes",
        body: "Write a short outline, by period, of what you intend to confess: kinds of sin, approximate numbers or durations, and the main patterns. Notes keep the confession orderly and calm, and let the priest follow. Keep them brief and keep them private; destroy them once the confession is made.",
      },
      {
        order: 5,
        title: "Confess by kind and number, period by period",
        body: "Begin as usual: 'Bless me, Father, for I have sinned. It has been [a month] since my last confession. With your permission I would like to make a general confession of my life.' Then go through your notes in order: 'As a child and teenager, I... In my twenties, I... In my marriage, I...' Give kinds and numbers as honestly as you can. Say which sins were never confessed before, if any. When you finish, add: 'For all these sins, and for all the sins of my life that I cannot remember, I am sorry.'",
      },
      {
        order: 6,
        title: "Receive counsel, penance and absolution",
        body: `The priest may help you see the shape of what you have said, the mercies as well as the wounds, and will give you a penance. Pray the Act of Contrition. Then he prays the words of absolution: '${ABSOLUTION}' Answer: 'Amen.' Everything you have named, and everything you have forgotten, is forgiven; whatever was forgiven long ago is confirmed; whatever was never validly confessed is now absolved.`,
      },
      {
        order: 7,
        title: "Leave scrupulosity behind",
        body: "Do your penance, thank God, and destroy your notes. From now on, confess only new sins, and do not revisit what was covered. If anxiety about the past returns, tell your confessor once and then obey him. A general confession is meant to close a door on the past so that you can walk forward; let it.",
      },
    ],
    relatedPrayers: ["litany-of-humility", "sign-of-the-cross", "confiteor", "act-of-contrition"],
    relatedPractices: ["spiritual-direction", "ignatian-examen"],
    relatedSaints: ["saint-ignatius-of-loyola", "saint-francis-de-sales"],
  }),

  // ──────────────────── D. EUCHARIST & ADORATION ────────────────────
  guide({
    slug: "how-to-make-a-holy-hour",
    title: "How to Make a Holy Hour",
    summary:
      "How to spend an hour in adoration before the Blessed Sacrament: arriving, adoring, giving thanks, praying with Scripture, interceding, resting in silence, and closing, with or without Benediction.",
    kind: "adoration",
    sacramentKey: "eucharist",
    authorityLevel: "USCCB",
    citations: [U_EUCH, V_EDE],
    intro:
      "A holy hour is an hour of prayer before Jesus truly present in the Eucharist, whether exposed in a monstrance or reserved in the tabernacle. Its name recalls Gethsemane: 'Could you not watch one hour with me?' (Matthew 26:40). Saint John Paul II wrote of the pleasure of spending time in Christ's company before the Blessed Sacrament, and many saints, priests and lay people have made a daily holy hour the anchor of their lives. There is no prescribed method: what follows is a traditional shape that keeps the hour from drifting, built on the four ends of prayer, adoration, thanksgiving, petition and reparation, with Scripture and silence.",
    whatYouNeed: [
      "A church or chapel where the Blessed Sacrament is reserved, or a scheduled time of exposition or perpetual adoration",
      "A Bible, or the readings of the day",
      "Optionally a rosary, a prayer book, or a notebook",
      "One hour, and the willingness to stay when it feels long",
    ],
    whenToPray:
      "Any time a church is open; Thursday evening is traditional in memory of Gethsemane, and the First Friday and First Thursday of the month in many parishes. A weekly hour in a perpetual adoration chapel is a common commitment.",
    tips: [
      "Divide the hour loosely into four quarters: adoration, Scripture, intercession, silence. The structure carries you when devotion does not.",
      "Dryness and distraction are normal and do not make the hour a failure; the point is to be there with him, as he is with you.",
      "If the chapel has exposition, do not leave the Blessed Sacrament alone: wait for the next adorer before going.",
      "Leave the phone in the car or silenced in a bag. The hour belongs to him.",
    ],
    durationMinutes: 60,
    steps: [
      {
        order: 1,
        title: "Arrive and come into his presence",
        body: "Enter in silence. Genuflect on one knee toward the tabernacle or the monstrance, as the Church's rite for worship of the Eucharist outside Mass directs (some kneel on both knees before the exposed Sacrament by older custom, and may). Take a place where you can see the Host or the tabernacle, kneel or sit, and make the Sign of the Cross. For a minute do nothing but become aware that the Lord who fed the crowds and rose from the dead is here, a few yards away, and that he sees you.",
      },
      {
        order: 2,
        title: "Adore",
        body: "Begin with adoration, the prayer that simply acknowledges who God is. Pray the O Salutaris Hostia if the Sacrament has just been exposed, or the Adoro Te Devote of Saint Thomas Aquinas: 'Godhead here in hiding, whom I do adore...' Then say slowly, in your own words or in silence: 'My Lord and my God.' Let adoration take the first ten minutes; it puts everything else in order.",
      },
      {
        order: 3,
        title: "Give thanks",
        body: "Thank him, in particular: for the last week, for the people you love, for the Mass and this hour, for the mercies you have not noticed. Gratitude is the meaning of the word Eucharist. A psalm of thanksgiving (Psalm 103 or Psalm 116) may be read here.",
      },
      {
        order: 4,
        title: "Pray with Scripture",
        body: "Read a short passage slowly, ideally the Gospel of the day or a Eucharistic text: John 6, the Emmaus road (Luke 24:13-35), the Last Supper (Luke 22:14-20). Read it once for the sense and once for a word that strikes you; stay with that word and speak to the Lord about it; then listen. This is lectio divina, and before the Blessed Sacrament it becomes conversation with the One who spoke the words.",
      },
      {
        order: 5,
        title: "Intercede",
        body: "Bring the world to him: your family by name, the sick, the dying, the Church and the Pope, priests and vocations, those who have asked your prayers, those who have no one to pray for them, the souls in purgatory. A decade of the Rosary, or the whole Rosary, may be prayed here; many pray it before the Blessed Sacrament. Keep a short list in your notebook so that no one is forgotten.",
      },
      {
        order: 6,
        title: "Make reparation and examine the day",
        body: "Look honestly at the day or the week, ask forgiveness for what needs it, and offer him some small reparation for your own sins and for the indifference he receives in the Eucharist: the Anima Christi is a fitting prayer here ('Soul of Christ, sanctify me... Within thy wounds hide me'). If you find a serious sin, resolve to bring it to confession.",
      },
      {
        order: 7,
        title: "Rest in silence",
        body: "Spend the last part of the hour saying nothing. Look at him, and let him look at you, as the old farmer told the Curé of Ars. If thoughts crowd in, return gently with a single word: 'Jesus'. This silence is not empty; it is the part of the hour that most resembles heaven.",
      },
      {
        order: 8,
        title: "Close, with or without Benediction",
        body: "If a priest or deacon gives Benediction at the end of exposition, kneel as the Tantum Ergo is sung, bow your head as he blesses with the monstrance, and join in the Divine Praises ('Blessed be God. Blessed be his holy Name...') before the Sacrament is reposed. Otherwise, close with the Divine Praises or a Glory Be, a brief act of thanksgiving, and a resolution for the day. Genuflect as you leave, and take the silence with you.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "o-salutaris-hostia",
      "adoro-te-devote",
      "anima-christi",
      "tantum-ergo",
      "divine-praises",
    ],
    relatedDevotions: ["holy-hour", "eucharistic-adoration", "holy-rosary"],
    relatedPractices: ["lectio-divina", "mental-prayer", "contemplative-prayer"],
    relatedSaints: ["saint-margaret-mary-alacoque", "saint-john-vianney", "saint-thomas-aquinas"],
  }),

  guide({
    slug: "how-to-attend-eucharistic-adoration-for-the-first-time",
    title: "How to Attend Eucharistic Adoration for the First Time",
    summary:
      "What to do, how to behave and what to pray when you first visit a church or chapel for adoration of the Blessed Sacrament, whether exposed in a monstrance or reserved in the tabernacle.",
    kind: "adoration",
    sacramentKey: "eucharist",
    authorityLevel: "USCCB",
    citations: [U_EUCH, V_EDE],
    intro:
      "Catholics believe that after the consecration at Mass the bread and wine have become the Body and Blood of Christ, and that he remains present in the consecrated Hosts kept in the tabernacle. Adoration is simply spending time with him there. Some parishes have an adoration chapel open around the clock; many hold set hours of exposition, when a Host is placed in a monstrance on the altar; and every Catholic church allows a quiet visit to the tabernacle whenever it is open. Nothing is expected of a first-time visitor except reverence and quiet. This guide explains what you will see and what to do.",
    whatYouNeed: [
      "A parish with an adoration chapel or scheduled exposition (the website or bulletin will say), or any open Catholic church",
      "Twenty or thirty minutes",
      "Optionally a Bible, a rosary or a prayer book; none is required",
    ],
    whenToPray:
      "Whenever a church is open; adoration chapels often welcome visitors at any hour. Exposition is commonly held after a weekday Mass, on Thursday evenings, on First Fridays and during Lent.",
    tips: [
      "There is no wrong way to adore, but there are a few conventions: silence, a genuflection on entering and leaving, and never leaving the exposed Sacrament alone if you are the only one there.",
      "If you are not Catholic, you are welcome. Sit quietly and pray as you can.",
      "Dress as you would for Mass. Silence your phone before you enter.",
      "Come back. Adoration is a habit that grows quiet and deep with repetition.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Know what you will see: exposition or the tabernacle",
        body: "In a chapel of exposition you will see a consecrated Host in a monstrance, a gold stand with a glass window, on the altar, often with candles burning; people are kneeling or sitting in silence. In an ordinary church the Blessed Sacrament is reserved in the tabernacle, a locked box on or behind the altar, marked by a lamp (usually red) burning nearby. In both cases Christ is truly present, and the same reverence is due.",
      },
      {
        order: 2,
        title: "Enter in silence and genuflect",
        body: "Enter quietly, bless yourself with holy water if there is a font, and before taking a seat genuflect on your right knee toward the monstrance or the tabernacle, saying inwardly: 'My Lord and my God.' A single genuflection is the Church's norm before the Blessed Sacrament, exposed or reserved; some kneel on both knees before the exposed Sacrament by older custom, and either is fine. If you cannot genuflect, a deep bow is right.",
      },
      {
        order: 3,
        title: "Choose where to sit and settle",
        body: "Sit or kneel anywhere you can see the monstrance or tabernacle; there are no reserved places. Put your bag down, silence your phone, and make the Sign of the Cross. If a rosary or a prayer book is being used by others, that is their prayer; yours can be entirely silent. Give yourself a full minute of stillness before you try to pray anything.",
      },
      {
        order: 4,
        title: "Simply be present",
        body: "The heart of adoration is being with him, not producing prayers. Look at the Host and let the truth sink in: this is Jesus, who said 'I am with you always.' Tell him why you have come, in a sentence. Then stay. When your mind wanders, and it will, come back with a word: 'Jesus', or 'You are here.' An Act of Faith may help: 'O my God, I firmly believe that you are one God in three divine Persons... I believe that your divine Son became man and died for our sins, and that he will come to judge the living and the dead.'",
      },
      {
        order: 5,
        title: "Pray in whatever way helps",
        body: "If silence is hard at first, use a structure. Read a Gospel passage slowly, perhaps John 6 or the Emmaus story (Luke 24:13-35), and speak to him about it. Pray a decade or five of the Rosary. Pray the Adoro Te Devote of Saint Thomas Aquinas ('Godhead here in hiding, whom I do adore'), or the Anima Christi ('Soul of Christ, sanctify me'). Bring him the people you love by name. Any of these is adoration; all of them lead back to silence.",
      },
      {
        order: 6,
        title: "If Benediction is given",
        body: "At the end of a period of exposition a priest or deacon may give Benediction. You will hear the Tantum Ergo sung; kneel for it. He blesses the people with the monstrance, in silence, while bells may be rung: bow your head. Then the Divine Praises are usually said together ('Blessed be God. Blessed be his holy Name...'), and the Host is returned to the tabernacle while a hymn is sung. Join in as you can; a printed card is often in the pew.",
      },
      {
        order: 7,
        title: "Leave quietly",
        body: "When you are ready to go, thank him briefly, stand, genuflect toward the Sacrament again, and leave in silence. If the Sacrament is exposed and you are the only person present, wait until someone else arrives before leaving; the Church asks that the exposed Sacrament never be left unattended. Do not worry if the visit felt dry or awkward; it counted.",
      },
      {
        order: 8,
        title: "Come back regularly",
        body: "Adoration bears fruit in habit. Choose a realistic rhythm: fifteen minutes on the way home from work, half an hour on Saturday, a weekly hour in an adoration chapel. Many parishes ask for a committed weekly hour in their chapel, which is a good way to make it stick. Over time the silence that felt empty becomes the part of the week you most look forward to.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "act-of-faith",
      "adoro-te-devote",
      "anima-christi",
      "tantum-ergo",
      "divine-praises",
    ],
    relatedDevotions: ["eucharistic-adoration", "holy-hour"],
    relatedPractices: ["contemplative-prayer"],
  }),

  guide({
    slug: "how-to-pray-benediction-of-the-blessed-sacrament",
    title: "How to Pray Benediction of the Blessed Sacrament",
    summary:
      "The rite of Benediction as the Church celebrates it: exposition with the O Salutaris, a time of adoration, the Tantum Ergo, the versicle and prayer, the blessing with the monstrance, the Divine Praises and reposition.",
    kind: "adoration",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_EUCH],
    intro:
      "Benediction of the Blessed Sacrament is the blessing given to the people with the Host in the monstrance at the close of a period of exposition. The Church's rite, in Holy Communion and Worship of the Eucharist Outside Mass, asks that exposition always include a real time of adoration with prayer, Scripture, song and silence; exposition merely in order to give the blessing is not permitted. Only a priest or deacon may give the blessing itself, though an acolyte or extraordinary minister may expose and repose the Sacrament when no priest or deacon is available. The Directory on Popular Piety commends the rite warmly. This guide follows it as a lay person in the pew experiences it, with the texts to sing and say.",
    whatYouNeed: [
      "A parish celebration of exposition and Benediction (Sunday evening, First Friday, Forty Hours, Corpus Christi, or after a holy hour)",
      "The hymns O Salutaris Hostia and Tantum Ergo, in Latin or English; a card is usually provided",
      "The Divine Praises",
    ],
    whenToPray:
      "Whenever the parish schedules it: commonly at the end of a holy hour, on Sunday afternoons, First Fridays, during Forty Hours devotion, on Corpus Christi and its procession, and at the close of retreats and missions.",
    tips: [
      "Kneel from the Tantum Ergo through the blessing; stand or sit for the rest as the community does.",
      "Bow your head, do not make the Sign of the Cross, as the monstrance is raised over you; the blessing is Christ's own, given in silence.",
      "Learn the Latin of the Tantum Ergo once and you will be able to sing it anywhere in the world.",
      "The Divine Praises were composed as an act of reparation for blasphemy; say them slowly, with that in mind.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Exposition and the O Salutaris",
        body: "The priest or deacon, wearing a cope or surplice and stole, brings the Host from the tabernacle and places it in the monstrance on the altar, then kneels and incenses it. Meanwhile the people sing the O Salutaris Hostia: 'O saving Victim, opening wide the gate of heaven to man below; our foes press on from every side; thine aid supply, thy strength bestow.' Kneel as the Sacrament is exposed, and genuflect if you arrive afterward.",
      },
      {
        order: 2,
        title: "The time of adoration",
        body: "There follows a period of adoration, longer or shorter according to the occasion: readings from Scripture, a homily or reflection, hymns, litanies, the Rosary, and above all silence. This is not a preamble to the blessing but the substance of the rite; the Church forbids exposition solely for the sake of Benediction. Pray as at any holy hour: adore, thank, ask, and rest. The Adoro Te Devote is a fitting prayer here.",
      },
      {
        order: 3,
        title: "The Tantum Ergo",
        body: "Toward the end the minister returns to the altar, kneels, and the people sing the Tantum Ergo, the last two verses of Saint Thomas Aquinas' hymn Pange Lingua: 'Down in adoration falling, lo, the sacred Host we hail; lo, o'er ancient forms departing, newer rites of grace prevail; faith for all defects supplying, where the feeble senses fail. To the everlasting Father, and the Son who reigns on high, with the Holy Spirit proceeding forth from each eternally, be salvation, honour, blessing, might and endless majesty. Amen.' The minister incenses the Sacrament again during the hymn. Kneel.",
      },
      {
        order: 4,
        title: "The versicle and the prayer",
        body: "The minister stands and sings or says: 'You have given them bread from heaven.' All answer: 'Having all sweetness within it.' In Easter time 'alleluia' is added to both. Then: 'Let us pray. O God, who in this wonderful Sacrament have left us a memorial of your Passion, grant us, we pray, so to revere the sacred mysteries of your Body and Blood that we may always experience in ourselves the fruits of your redemption. Who live and reign for ever and ever.' All: 'Amen.' Other Eucharistic prayers from the rite may be used instead.",
      },
      {
        order: 5,
        title: "The blessing with the monstrance",
        body: "The minister puts on the humeral veil, takes the monstrance in veiled hands, and makes the Sign of the Cross over the people with it, in silence, while a server may ring the bells and incense the Sacrament. Kneel, bow your head, and receive the blessing without making the Sign of the Cross yourself; it is Christ himself who blesses. This is Benediction properly so called, and it may be given only by a priest or deacon.",
      },
      {
        order: 6,
        title: "The Divine Praises",
        body: "After the blessing, the minister kneels and, by widespread custom, leads the Divine Praises, the people repeating each line: 'Blessed be God. Blessed be his holy Name. Blessed be Jesus Christ, true God and true Man. Blessed be the Name of Jesus. Blessed be his most Sacred Heart. Blessed be his most Precious Blood. Blessed be Jesus in the most holy Sacrament of the altar. Blessed be the Holy Spirit, the Paraclete. Blessed be the great Mother of God, Mary most holy. Blessed be her holy and Immaculate Conception. Blessed be her glorious Assumption. Blessed be the name of Mary, Virgin and Mother. Blessed be Saint Joseph, her most chaste spouse. Blessed be God in his angels and in his saints.'",
      },
      {
        order: 7,
        title: "Reposition and the closing hymn",
        body: "The minister returns the Host to the tabernacle and genuflects; the people stand and sing a closing hymn, very often 'Holy God, We Praise Thy Name', the English paraphrase of the Te Deum, or a Marian antiphon. Genuflect toward the tabernacle as you leave, and carry the blessing out with you.",
      },
    ],
    relatedPrayers: [
      "o-salutaris-hostia",
      "adoro-te-devote",
      "tantum-ergo",
      "divine-praises",
      "te-deum",
    ],
    relatedDevotions: ["eucharistic-adoration", "forty-hours-devotion", "holy-hour"],
    relatedSaints: ["saint-thomas-aquinas"],
  }),

  guide({
    slug: "how-to-make-a-visit-to-the-blessed-sacrament",
    title: "How to Make a Visit to the Blessed Sacrament",
    summary:
      "A short daily visit to Jesus in the tabernacle: finding an open church, greeting him, adoring, thanking, asking and repenting, a brief prayer, and leaving in peace.",
    kind: "adoration",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_EDE, U_EUCH],
    intro:
      "A visit to the Blessed Sacrament is the simplest Eucharistic devotion: a few minutes, on the way to or from work or errands, in any church where the tabernacle lamp is burning. The Catechism, quoting Saint Paul VI, calls it a proof of gratitude, an expression of love and a duty of adoration toward Christ our Lord. Saint Alphonsus Liguori wrote a famous little book of Visits, and Saint John Paul II confessed the pleasure of spending time with the Lord in this way. No method is required; this guide gives one, built on the four ends of prayer, that fits in ten minutes.",
    whatYouNeed: [
      "A Catholic church that is open during the day; many are, and adoration chapels usually are",
      "Five to ten minutes",
      "Nothing else; a rosary or a short prayer book is optional",
    ],
    whenToPray:
      "Daily if you can, at the same hour so that it becomes a habit: before work, at lunch, or on the way home. Saint Alphonsus recommends a visit each day, and one to Our Lady at the same time.",
    tips: [
      "Look for the sanctuary lamp: where it burns, the Blessed Sacrament is reserved and the visit is to him.",
      "Short and daily beats long and occasional. Five minutes is a real visit.",
      "Say the same thing every day if you like; friends do.",
      "If the church is locked, ask the parish office when it is open; many will tell you gladly and some will give a code to the adoration chapel.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Find an open church",
        body: "Note the churches on your daily routes and learn which are open and when; parish websites and doors usually say. An adoration chapel is ideal, but any church with the sanctuary lamp lit will do. Plan the visit into the day so it is not left to chance: the same church, the same time.",
      },
      {
        order: 2,
        title: "Genuflect and greet the Lord",
        body: "Enter, take holy water, genuflect toward the tabernacle or the monstrance, and kneel in a pew near the front. Greet him as you would a friend you have come to see: 'Jesus, I believe you are here. I have come to be with you for a few minutes.' Saint Alphonsus begins each visit with an act of faith in his presence; make one in your own words.",
      },
      {
        order: 3,
        title: "Adore",
        body: "Spend a moment simply adoring: 'My Lord and my God', or a verse of the Adoro Te Devote ('Godhead here in hiding, whom I do adore'). Acknowledge who it is you are kneeling before and let yourself be small and glad.",
      },
      {
        order: 4,
        title: "Thank",
        body: "Thank him for something specific from the last day: a person, a mercy, a piece of good news, the Mass, the fact that you are here. If nothing comes, thank him for the Eucharist itself, and for being findable in a church on an ordinary Tuesday.",
      },
      {
        order: 5,
        title: "Ask",
        body: "Tell him what you need and whom you are worried about, briefly and by name. Ask for the grace you most need today. Pray for the priest of this parish, for someone who is dying, for the person you find hardest to love. A single Hail Mary for each intention keeps it short.",
      },
      {
        order: 6,
        title: "Repent",
        body: "Look quickly at the last day, ask forgiveness for what needs it, and tell him you are sorry: a short Act of Contrition or simply 'Lord, have mercy.' If you cannot receive Communion today, make an Act of Spiritual Communion: 'My Jesus, I believe that you are present in the Most Holy Sacrament. I love you above all things, and I desire to receive you into my soul. Since I cannot at this moment receive you sacramentally, come at least spiritually into my heart...'",
      },
      {
        order: 7,
        title: "A short prayer, and leave in peace",
        body: "Close with one prayer said slowly: the Anima Christi ('Soul of Christ, sanctify me'), a psalm, or a Glory Be. Ask him to stay with you through the rest of the day. Genuflect and leave without hurry. The visit is over; his company is not.",
      },
    ],
    relatedPrayers: [
      "adoro-te-devote",
      "hail-mary",
      "act-of-contrition",
      "act-of-spiritual-communion",
      "anima-christi",
      "glory-be",
    ],
    relatedDevotions: ["eucharistic-adoration"],
    relatedSaints: ["saint-alphonsus-liguori", "saint-john-paul-ii"],
  }),

  guide({
    slug: "how-to-make-a-thanksgiving-after-holy-communion",
    title: "How to Make a Thanksgiving After Holy Communion",
    summary:
      "How to pray in the minutes after receiving Communion, when Christ is sacramentally present within you: silence, adoration, thanksgiving, self-offering, petition and a traditional prayer to carry into the day.",
    kind: "adoration",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_SCAR, U_EUCH],
    intro:
      "The minutes after Holy Communion are the most intimate of the Christian's week: the Lord is present within, body, blood, soul and divinity, under the sacramental species. The Church builds a sacred silence into the Mass after Communion precisely so that these minutes are not lost, and Pope Benedict XVI in Sacramentum Caritatis urged that thanksgiving after Communion be recovered as a real time of prayer. The saints spent a quarter of an hour on it. This guide gives a shape for the silence in the pew, and for a few minutes after Mass if you can stay.",
    whatYouNeed: [
      "The few minutes of silence after Communion at Mass, and if possible five more after the dismissal",
      "One or two prayers by heart: the Anima Christi, the Prayer Before a Crucifix, the Adoro Te Devote",
      "A pew, a kneeler and a closed missalette",
    ],
    whenToPray:
      "At every Mass, from the moment you return to your place until the Prayer after Communion, and after the final blessing for as long as you can stay; it is a good reason to be in no hurry to leave.",
    tips: [
      "Kneel or sit, close your eyes, and let the singing carry on without you if you need silence; the communion hymn is not obligatory for every person.",
      "Do not spend the time watching others go up. Look inward.",
      "One prayer said slowly is better than five said fast. Choose your prayer beforehand so you do not hunt for it.",
      "If you have received Communion unworthily, or fear you have, that is a matter for confession, not for anxiety during thanksgiving.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Return to your place and kneel or sit",
        body: "After receiving, walk back without hurry, and kneel, or sit if you cannot kneel. Close your eyes or fix them on the crucifix or the tabernacle. Put the hymnal down. The Church asks for a sacred silence at this point of the Mass; give yourself to it.",
      },
      {
        order: 2,
        title: "Adore in silence",
        body: "For a full minute say nothing at all. Become aware of what has just happened: the Lord of heaven and earth has come to you, not as a symbol but in reality, as he promised. Let that fact fill the silence. If words come, keep them to the fewest: 'My Lord and my God.' 'You are here.'",
      },
      {
        order: 3,
        title: "Give thanks",
        body: "Thank him. Thank him for coming, for the Cross that made this possible, for the priest who consecrated, for the faith that lets you believe. Thank him for one specific thing from the week. The whole Mass is called 'thanksgiving'; this is the moment to mean it personally.",
      },
      {
        order: 4,
        title: "Offer yourself",
        body: "He has given himself to you; give yourself to him. In your own words or with the Prayer Before a Crucifix ('Look down upon me, good and gentle Jesus...'), offer him the day, your work, your family, your body and its weaknesses, your plans and the disruption of your plans. The Morning Offering may be renewed here. Ask him to make of you what he made of the bread.",
      },
      {
        order: 5,
        title: "Ask for what you need",
        body: "Now ask. Communion is the moment when he is nearest; bring him the grace you most need to live the week as a Christian, the person you are worried about, the sin you keep committing, the decision you cannot make. Ask for the fruits of Communion the Church promises: closer union with him, protection from mortal sin, deeper charity, and unity with the whole Church.",
      },
      {
        order: 6,
        title: "Pray a traditional prayer of thanksgiving",
        body: "Close the silence with one prayer said slowly. The Anima Christi is the classic: 'Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Within thy wounds hide me. Suffer me not to be separated from thee...' Or pray the Adoro Te Devote, or an Act of Love: 'O my God, I love you above all things, with my whole heart and soul, because you are all good and worthy of all my love.'",
      },
      {
        order: 7,
        title: "Carry it into the day",
        body: "After the blessing and dismissal, stay a few minutes if you can and finish your thanksgiving. Then take one concrete resolution with you: an act of charity to do today, a person to forgive, a temptation to refuse. The sacramental presence lasts only minutes; the grace lasts as long as you cooperate with it. Leave as one who has been sent.",
      },
    ],
    relatedPrayers: [
      "prayer-before-a-crucifix",
      "morning-offering",
      "anima-christi",
      "adoro-te-devote",
      "act-of-love",
    ],
    relatedPractices: ["mental-prayer"],
    relatedSaints: ["saint-thomas-aquinas", "saint-philip-neri"],
  }),

  guide({
    slug: "how-to-make-an-act-of-spiritual-communion",
    title: "How to Make an Act of Spiritual Communion",
    summary:
      "Uniting oneself to Christ in the Eucharist by desire when unable to receive him sacramentally: what spiritual communion is, when it applies, and how to make it with the traditional act.",
    kind: "adoration",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_EDE, U_EUCH],
    intro:
      "Spiritual communion is an ardent desire to receive Jesus in the Eucharist, made when one cannot receive him sacramentally, together with an act of love as though one had received him. Saint John Paul II, in Ecclesia de Eucharistia, recalled that the practice grew out of the constant desire for the Eucharist that the saints cultivated, and quoted Saint Teresa of Jesus, who taught that when one cannot receive at Mass one can make a spiritual communion and receive great grace from the Lord's love. Saint Alphonsus Liguori wrote the short act most Catholics use. It is a prayer for the sick, the homebound, the traveller, the person who arrives at a Mass already begun, and anyone who is not able to receive.",
    whatYouNeed: [
      "A quiet moment; before a crucifix, during a Mass watched or attended, or at a visit to the Blessed Sacrament",
      "The traditional Act of Spiritual Communion, or your own words",
      "A real desire for the Eucharist",
    ],
    whenToPray:
      "Whenever you attend Mass without receiving; when you are ill or far from a church; when you follow a Mass by broadcast; during a visit to the Blessed Sacrament; and any time in the day when you long for him.",
    tips: [
      "Spiritual communion is not a second-class Communion; the grace given is real, measured by the desire and love with which it is made.",
      "It does not remove the need for confession if you are in mortal sin, but it is exactly the prayer to make while you wait to confess.",
      "Make it several times a day if you like; the saints did.",
      "It never replaces Mass when Mass is possible. Sunday Mass remains an obligation for those who are able to attend.",
    ],
    durationMinutes: 5,
    steps: [
      {
        order: 1,
        title: "Understand what spiritual communion is",
        body: "Spiritual communion is not a substitute ritual but an act of the heart: faith in the Real Presence, love for the Lord who gives himself in the Eucharist, and the desire to receive him, expressed to him directly. The Church has always taught that the effects of the sacrament can be received by desire when the sacrament itself cannot be had; the Council of Trent spoke of those who eat the Eucharist spiritually. It costs nothing but attention and love.",
      },
      {
        order: 2,
        title: "Know when to make it",
        body: "Make an act of spiritual communion when illness, distance, age or duty keeps you from Mass; when you are at Mass but cannot receive, because you have not kept the one-hour fast, have arrived late, are not Catholic, or are conscious of grave sin and have not yet confessed; when you follow Mass on television or online; and at any visit to the Blessed Sacrament. It is not to be made in place of Mass when Mass is possible.",
      },
      {
        order: 3,
        title: "Prepare your heart",
        body: "Pause, make the Sign of the Cross, and turn to him. Make an act of faith in his presence in the Eucharist, wherever the nearest tabernacle is: 'Jesus, I believe you are truly present in the Blessed Sacrament.' Make an act of sorrow for your sins, and if you are conscious of a mortal sin, an act of perfect contrition with the intention of confessing as soon as you can. Then let the desire grow: you want him, and you want him now.",
      },
      {
        order: 4,
        title: "Pray the Act of Spiritual Communion",
        body: "Pray slowly the act of Saint Alphonsus Liguori: 'My Jesus, I believe that you are present in the Most Holy Sacrament. I love you above all things, and I desire to receive you into my soul. Since I cannot at this moment receive you sacramentally, come at least spiritually into my heart. I embrace you as if you were already there, and unite myself wholly to you. Never permit me to be separated from you. Amen.' If you are at a Mass, pray it at the moment the others receive.",
      },
      {
        order: 5,
        title: "Continue with thanksgiving",
        body: "Then behave as though you had received: stay a few minutes in silence, thank him, offer yourself, ask for what you need, and pray an Act of Love or the Anima Christi. Saint Teresa told her sisters to make their thanksgiving after a spiritual communion as carefully as after a sacramental one, because the Lord's love, she said, is imprinted in the soul either way.",
      },
      {
        order: 6,
        title: "Return to sacramental Communion as soon as you can",
        body: "Spiritual communion should lead back to the altar. If sin keeps you from receiving, go to confession. If distance or illness keeps you, ask the parish about Communion brought to the home, which priests, deacons and extraordinary ministers do gladly. If it is the Sunday obligation you cannot fulfil, ask your pastor about it; the Church dispenses those who truly cannot attend. Let the desire you have expressed be answered.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "act-of-faith",
      "act-of-contrition",
      "act-of-spiritual-communion",
      "act-of-love",
      "anima-christi",
    ],
    relatedDevotions: ["eucharistic-adoration"],
    relatedSaints: ["saint-alphonsus-liguori", "saint-teresa-of-avila", "saint-john-paul-ii"],
  }),

  guide({
    slug: "how-to-take-part-in-a-eucharistic-procession",
    title: "How to Take Part in a Eucharistic Procession",
    summary:
      "Corpus Christi and other Eucharistic processions: what they mean, how a parish prepares the route and altars, the order of the procession, hymns and the Rosary along the way, Benediction at the stations and at the end.",
    kind: "adoration",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_DPP, V_MND],
    intro:
      "In a Eucharistic procession the Blessed Sacrament is carried in a monstrance through the streets or the parish grounds, with hymns, prayers and candles, as a public act of faith in Christ's presence and a blessing on the place. The Church's law and rites provide for it, above all on the Solemnity of the Body and Blood of Christ (Corpus Christi), which in the United States is kept on the Sunday after Trinity Sunday; the Directory on Popular Piety calls the Corpus Christi procession the 'sequel' to the Mass of that day. Saint John Paul II, in Mane Nobiscum Domine, asked parishes to hold such processions during the Year of the Eucharist. This guide explains how the procession is ordered and how to take part well.",
    whatYouNeed: [
      "A parish or diocesan procession, usually after the Corpus Christi Mass or at the close of Forty Hours; the bulletin will give the time and route",
      "Comfortable shoes, and dress suitable for Mass",
      "A rosary, and the hymns (Pange Lingua, Tantum Ergo, O Salutaris) which the parish usually prints",
      "A candle, if the parish provides them",
    ],
    whenToPray:
      "On Corpus Christi (the Sunday after Trinity Sunday in the United States; the Thursday in some places), at the close of Forty Hours devotion, at Eucharistic congresses, and on other occasions the bishop approves.",
    tips: [
      "Walk behind the Blessed Sacrament, not ahead of it, unless you are a server or in the choir. The Lord leads.",
      "Keep singing and praying along the whole route; a silent, chatting procession says the opposite of what a procession means.",
      "Kneel when the monstrance is raised in blessing at each station; a street is no obstacle.",
      "Bring children; a procession is the Eucharistic teaching they will remember.",
    ],
    durationMinutes: 60,
    steps: [
      {
        order: 1,
        title: "Understand the meaning of the procession",
        body: "A Eucharistic procession is not a parade about the Eucharist; it is Christ himself, sacramentally present, walking among his people and through their streets. It professes the Real Presence publicly, asks his blessing on homes, fields and workplaces, and images the pilgrim Church following her Lord. The Church asks that it be arranged with the local bishop's judgement as to whether it is fitting in a given place, and that it be done with dignity and reverence, never in a way that would expose the Sacrament to irreverence.",
      },
      {
        order: 2,
        title: "How the parish prepares the route and the altars",
        body: "The parish chooses a route and, by custom, one or more 'stations' along it: outdoor altars, often at homes, schools or a neighbouring church, decorated with flowers and candles, where the procession halts for Benediction. Parishioners decorate windows and doorways along the way; children who have recently made First Communion may scatter petals. Servers prepare the processional cross, candles, the canopy (baldachin), the thurible, bells and the humeral veil. If you can help, offer.",
      },
      {
        order: 3,
        title: "The order of the procession",
        body: "The procession forms after Mass, the Host having been consecrated at that Mass and placed in the monstrance. The usual order is: the processional cross with candles; the faithful, groups and confraternities with their banners; the choir; then servers with incense going before the Blessed Sacrament; then the priest carrying the monstrance under the canopy, wearing cope and humeral veil, with candle bearers on either side; and after the Sacrament, the rest of the clergy and the faithful. Custom varies; follow the ushers. Walk with recollection, at the pace of the Sacrament.",
      },
      {
        order: 4,
        title: "Hymns and the Rosary along the way",
        body: "The procession sings Eucharistic hymns: the Pange Lingua (of which the Tantum Ergo is the close), the Adoro Te Devote, the Lauda Sion, and familiar English hymns. Between hymns the Rosary is often prayed aloud, the leader and the people alternating, or Eucharistic litanies and acclamations. Sing and pray for the whole route; if you do not know a hymn, keep silence and prayer rather than conversation.",
      },
      {
        order: 5,
        title: "Benediction at each station",
        body: "At each outdoor altar the priest places the monstrance on the altar, all kneel, and the station follows the shape of Benediction in brief: a short reading or prayer, the Tantum Ergo, the versicle 'You have given them bread from heaven' with the response 'Having all sweetness within it', the prayer, and the blessing with the monstrance in silence while the bells ring. Bow your head for the blessing. Then the procession resumes.",
      },
      {
        order: 6,
        title: "Return and final Benediction",
        body: "The procession returns to the church, where the Blessed Sacrament is placed on the altar for the closing Benediction: the Tantum Ergo, versicle and prayer, the blessing, and customarily the Divine Praises ('Blessed be God. Blessed be his holy Name...'). The Sacrament is then reposed in the tabernacle. A solemn hymn of thanksgiving follows, often the Te Deum ('Holy God, We Praise Thy Name'), sung with everything the parish has.",
      },
      {
        order: 7,
        title: "Carry the procession home",
        body: "A procession ends where daily life begins. Go home with the resolve the procession teaches: to receive the Lord you have followed through the streets more worthily at Mass, to visit him in the tabernacle during the week, and to let the faith you have professed in public be seen in how you live in the same streets tomorrow. Many parishes end with a meal or a festival; stay, because Corpus Christi is a feast.",
      },
    ],
    relatedPrayers: [
      "o-salutaris-hostia",
      "adoro-te-devote",
      "hail-mary",
      "tantum-ergo",
      "divine-praises",
      "te-deum",
    ],
    relatedDevotions: ["eucharistic-adoration", "forty-hours-devotion", "holy-rosary"],
    relatedSaints: ["saint-thomas-aquinas", "saint-john-paul-ii"],
  }),
];
