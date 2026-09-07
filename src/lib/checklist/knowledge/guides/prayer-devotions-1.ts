import type { CuratedEntry } from "../index";

/**
 * Guides — section L (Prayer, Devotions & Sacramentals), first half.
 *
 * Includes the rewrites of the three original "general" guides (the
 * Stations of the Cross, the Angelus, and the parts of the Mass) and the
 * first eight new guides of the section. Every step body is written to be
 * read from the page while actually praying: versicles and responses are
 * given in full, prayer names are spelled out so PrayerLinkedText can make
 * them expandable, and nothing is presented as a norm that the Church does
 * not actually ask for. Private-revelation promises are mentioned only where
 * the devotion cannot be explained without them, and then as what the saint
 * recorded, never as doctrine.
 */

// USCCB pages (the site blocks non-browser clients; all six verified in a
// browser on 2026-09-06).
const U_STATIONS =
  "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/stations-of-the-cross";
const U_PRAYERS = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/prayers";
const U_DEV = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions";
const U_LOTH = "https://www.usccb.org/prayer-and-worship/liturgy-of-the-hours";
const U_ORDER = "https://www.usccb.org/prayer-and-worship/the-mass/order-of-mass";

// Vatican documents (all verified 200).
const V_DPP =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const V_MC =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus.html";
const V_SC =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html";
const V_GIRM =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20030317_ordinamento-messale_en.html";
const V_FC =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_19811122_familiaris-consortio.html";
const V_IND =
  "https://www.vatican.va/roman_curia/tribunals/apost_penit/documents/rc_trib_appen_pro_20000129_indulgence_en.html";
const V_HA =
  "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15051956_haurietis-aquas.html";
// The plan's ccc_css URLs no longer resolve; these are the same articles in
// the Vatican's IntraText edition of the Catechism.
// Part 4, Section 1, Chapter 3: The Life of Prayer (CCC 2697-2758).
const V_CCC_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9J.HTM";
// Part 2, Section 2, Article 4: Penance and Reconciliation, incl. X. Indulgences (CCC 1471-1479).
const V_CCC_PEN = "https://www.vatican.va/archive/ENG0015/__P46.HTM";

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  kind: "general" | "liturgy_of_the_hours";
  category: "devotion" | "liturgy" | "family";
  sacramentKey?: "eucharist";
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
      category: g.category,
      ...(g.sacramentKey ? { sacramentKey: g.sacramentKey } : {}),
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

/** The versicle and response said at every station. */
const STATION_VERSICLE =
  "V. We adore you, O Christ, and we bless you. R. Because by your holy Cross you have redeemed the world.";

export const prayerAndDevotionGuidesOne: CuratedEntry[] = [
  // ─────────────── REWRITE: STATIONS OF THE CROSS ───────────────
  guide({
    slug: "how-to-pray-the-stations-of-the-cross",
    title: "How to Pray the Stations of the Cross",
    summary:
      "Walk with Christ from Pilate's judgment seat to the tomb: how to open, what to say and do at each of the fourteen stations, and how to close.",
    kind: "general",
    category: "devotion",
    authorityLevel: "USCCB",
    citations: [U_STATIONS, V_DPP],
    intro:
      "The Way of the Cross (Via Crucis) follows Jesus through fourteen moments of his Passion, from his condemnation to his burial. It grew out of the pilgrims who traced his path along the Via Dolorosa in Jerusalem, and was spread through the Franciscans so that every parish church could become a place of pilgrimage. It is prayed by moving from station to station, pausing at each to adore Christ, to consider what he suffered for us, and to pray. The Directory on Popular Piety and the Liturgy calls it a devotion in deep harmony with the liturgy of Lent and Good Friday.",
    whatYouNeed: [
      "The fourteen stations mounted in a church, or a set of images or a booklet at home",
      "A set of meditations — many parishes use those of Saint Alphonsus Liguori, or a Scriptural Way of the Cross",
      "About thirty unhurried minutes",
      "Optionally the verses of the Stabat Mater, sung while moving between stations",
    ],
    whenToPray:
      "Any day, but above all on the Fridays of Lent, when most parishes pray the Stations publicly, and on Good Friday. Many pray them every Friday of the year in memory of the Lord's death.",
    tips: [
      "If you cannot walk from station to station, pray from your place while the leader moves; it is the leader's movement that carries the group.",
      "Do not hurry the twelfth station. A minute of silence on your knees after 'Jesus dies on the Cross' is worth more than any words.",
      "A Scriptural Way of the Cross, such as the one used at the papal Good Friday Via Crucis, keeps every station to an event recorded in the Gospels; either form is fully approved.",
      "Children follow the Stations well if they are given something to do: carrying a candle, reading the station's title, or leading the versicle.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Choose your meditations and find the stations",
        body: "Decide which set of meditations you will use: a booklet from the parish, the meditations of Saint Alphonsus Liguori, or a Scriptural Way of the Cross. In a church, the fourteen stations are usually numbered plaques or images along the side walls; begin at the first, near the sanctuary on one side, and follow them around. At home, set out the images or simply hold the booklet and make the journey in your imagination.",
      },
      {
        order: 2,
        title: "Open with the Sign of the Cross and an act of contrition",
        body: "Standing before the altar or the first station, make the Sign of the Cross. Ask for the grace to walk with Jesus in his sufferings and to be truly sorry for the sins that caused them. Many begin with the Act of Contrition, or with a short prayer such as: 'Lord Jesus, you walked this way for me; help me to follow you to Calvary with love and sorrow.' Name any intention you are bringing.",
      },
      {
        order: 3,
        title: "Learn the pattern you will repeat at every station",
        body: `Each station has the same shape. The leader announces it: 'The First Station: Jesus is condemned to death.' All genuflect or bow and say the versicle and response: ${STATION_VERSICLE} Then the meditation is read, followed by a moment of silence. Pray the Our Father, the Hail Mary and the Glory Be, and, while moving to the next station, sing a verse of the Stabat Mater or keep silence. The Directory on Popular Piety notes that this movement from station to station is part of the devotion itself: a pilgrimage in miniature.`,
      },
      {
        order: 4,
        title: "Stations 1 to 3: condemned, burdened, fallen",
        body: `The First Station: Jesus is condemned to death. Pilate washes his hands and hands over the innocent Lamb; ask for the courage never to condemn the innocent by silence or cowardice. The Second Station: Jesus takes up his Cross. He receives it freely, for love of us; offer him the crosses you carry today. The Third Station: Jesus falls the first time. The weight of our sins brings him down; ask for the grace to rise after your own falls. At each: ${STATION_VERSICLE} Then the Our Father, Hail Mary and Glory Be.`,
      },
      {
        order: 5,
        title: "Stations 4 to 6: his Mother, Simon, Veronica",
        body: `The Fourth Station: Jesus meets his Mother. Mary's sorrow is the sword Simeon foretold; ask her to stand with you at your own crosses. The Fifth Station: Simon of Cyrene helps Jesus carry the Cross. Simon was pressed into service and became a disciple; ask for a willing heart when you are asked to help. The Sixth Station: Veronica wipes the face of Jesus. A small act of compassion, remembered for ever; ask to see the face of Christ in the suffering. At each: ${STATION_VERSICLE} Then the Our Father, Hail Mary and Glory Be.`,
      },
      {
        order: 6,
        title: "Stations 7 to 9: the second fall, the women, the third fall",
        body: `The Seventh Station: Jesus falls the second time. Exhausted, he gets up again; ask for perseverance in the sins you keep confessing. The Eighth Station: Jesus meets the women of Jerusalem. 'Do not weep for me; weep for yourselves and for your children' (Luke 23:28); let your sorrow be for sin, not sentiment. The Ninth Station: Jesus falls the third time. Almost at Calvary, he falls hardest of all; ask for the grace never to despair, however often you fall. At each: ${STATION_VERSICLE} Then the Our Father, Hail Mary and Glory Be.`,
      },
      {
        order: 7,
        title: "Stations 10 to 12: stripped, nailed, and dying",
        body: `The Tenth Station: Jesus is stripped of his garments. He is left with nothing; ask for detachment from what you cling to. The Eleventh Station: Jesus is nailed to the Cross. 'Father, forgive them, for they know not what they do' (Luke 23:34); ask for the grace to forgive as he forgave. The Twelfth Station: Jesus dies on the Cross. Here all kneel. Keep a long silence; then, if you wish, pray the Prayer Before a Crucifix or simply say, 'Jesus, I love you.' At each: ${STATION_VERSICLE} Then the Our Father, Hail Mary and Glory Be.`,
      },
      {
        order: 8,
        title: "Stations 13 and 14: taken down and laid in the tomb",
        body: `The Thirteenth Station: Jesus is taken down from the Cross. His body is placed in his Mother's arms; ask Mary to teach you to receive Jesus with the same love in Holy Communion. The Fourteenth Station: Jesus is laid in the tomb. Joseph of Arimathea gives his own tomb; the Sabbath silence begins, and with it our hope. At each: ${STATION_VERSICLE} Then the Our Father, Hail Mary and Glory Be.`,
      },
      {
        order: 9,
        title: "The fifteenth station, if your booklet includes it",
        body: "The traditional Way of the Cross ends at the tomb, but the Passion is not the end of the story. Some approved forms add a fifteenth station, the Resurrection, and the Directory on Popular Piety encourages ending the devotion in a way that opens the faithful to Easter hope. If your booklet includes it, pray it as the others; if not, a moment of thanksgiving for the Resurrection before the closing prayers serves the same purpose.",
      },
      {
        order: 10,
        title: "Close with prayers for the Holy Father's intentions",
        body: "Return to the altar or the first station. It is customary to pray one Our Father, one Hail Mary and one Glory Be for the intentions of the Pope, and to add a closing prayer of thanksgiving. Many end with the Prayer Before a Crucifix, or with a hymn. Make the Sign of the Cross to finish.",
      },
      {
        order: 11,
        title: "Know the indulgence attached to the Way of the Cross",
        body: "The Church grants a plenary indulgence to the faithful who make the Way of the Cross before legitimately erected stations, moving from station to station (or following a leader who moves) and meditating on the Passion, under the usual conditions: sacramental confession, Holy Communion, prayer for the Pope's intentions, and freedom from attachment to any sin. Those who are sick or otherwise prevented may gain the same indulgence by spending at least half an hour in devout reading and meditation on the Passion and death of the Lord. The indulgence may be applied to yourself or to the souls in purgatory.",
      },
      {
        order: 12,
        title: "Praying the Stations at home or in the sickroom",
        body: "The Stations need no church. Set out fourteen small images, or use a booklet and let each page be a station; say the versicle and response, read the meditation, and pray the Our Father, Hail Mary and Glory Be at each. If you are ill, pray a few stations at a time, or read the Passion narrative from one of the Gospels slowly across the day. What matters is to keep company with Jesus on his way, not to complete a course.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "act-of-contrition",
      "our-father",
      "hail-mary",
      "glory-be",
      "stabat-mater",
      "prayer-before-a-crucifix",
    ],
    relatedDevotions: ["stations-of-the-cross"],
    relatedSaints: ["saint-alphonsus-liguori", "saint-francis-of-assisi"],
  }),

  // ─────────────────── REWRITE: THE ANGELUS ───────────────────
  guide({
    slug: "how-to-pray-the-angelus",
    title: "How to Pray the Angelus",
    summary:
      "The three-times-daily prayer of the Incarnation: the three versicles with their Hail Marys, the closing collect, and the Regina Caeli that replaces it in Eastertide.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [U_PRAYERS, V_MC],
    intro:
      "The Angelus recalls the moment the Angel Gabriel announced to Mary that she would conceive the Son of God, and her yes that let the Word become flesh. It is traditionally prayed at six in the morning, at noon and at six in the evening, when church bells ring for it, so that three times a day the ordinary business of life stops for a minute before the mystery of the Incarnation. Saint Paul VI, in Marialis Cultus, praised its simple structure, its biblical character and its rhythm of sanctifying the day, and every Pope since has prayed it publicly with pilgrims on Sundays.",
    whatYouNeed: [
      "One minute, three times a day",
      "The text until you know it by heart — it is short",
      "Optionally the bell: many Catholics set an alarm for noon",
    ],
    whenToPray:
      "At six in the morning, noon and six in the evening, or as near as your day allows. From Easter Sunday through Pentecost Sunday the Regina Caeli is prayed instead, standing.",
    tips: [
      "The Angelus is traditionally prayed standing, and many kneel for the third versicle, 'And the Word was made flesh', in honour of the Incarnation.",
      "Praying it in a family or an office is easy: one person leads the versicles and everyone answers and joins in the Hail Marys.",
      "In some places three Glory Bes and an Eternal Rest for the faithful departed are added after the collect. That is a local custom, not part of the prayer itself.",
      "If you miss the hour, pray it when you remember; the point is to return to the Incarnation, not to keep a schedule.",
    ],
    durationMinutes: 3,
    steps: [
      {
        order: 1,
        title: "Stop at the hour and make the Sign of the Cross",
        body: "When the bell rings or the clock reaches six, noon or six, pause whatever you are doing. Stand, recollect yourself for a moment, and make the Sign of the Cross. If you are praying with others, one person leads each versicle (V.) and everyone answers with the response (R.).",
      },
      {
        order: 2,
        title: "The first versicle and a Hail Mary",
        body: "V. The Angel of the Lord declared unto Mary. R. And she conceived of the Holy Spirit. Then all pray the Hail Mary together. Let the first line rest for a moment in your mind: the announcement of Gabriel, and the Spirit overshadowing the Virgin.",
      },
      {
        order: 3,
        title: "The second versicle and a Hail Mary",
        body: "V. Behold the handmaid of the Lord. R. Be it done unto me according to thy word. Then pray the Hail Mary. These are Mary's own words from Luke 1:38, and praying them is a way of making her consent your own for the rest of the day.",
      },
      {
        order: 4,
        title: "The third versicle, with a bow or genuflection, and a Hail Mary",
        body: "V. And the Word was made flesh. R. And dwelt among us. It is customary to bow the head or to genuflect at these words, taken from John 1:14, as we do at the same words in the Creed on Christmas Day and the Annunciation. Then pray the Hail Mary.",
      },
      {
        order: 5,
        title: "The closing versicle and collect",
        body: "V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ. Let us pray: Pour forth, we beseech thee, O Lord, thy grace into our hearts; that we, to whom the Incarnation of Christ thy Son was made known by the message of an angel, may by his Passion and Cross be brought to the glory of his Resurrection, through the same Christ our Lord. R. Amen. End with the Sign of the Cross.",
      },
      {
        order: 6,
        title: "In Eastertide, pray the Regina Caeli instead",
        body: "From Easter Sunday through Pentecost Sunday the Angelus gives way to the Regina Caeli, prayed standing as a sign of the Resurrection: 'Queen of Heaven, rejoice, alleluia. For he whom you did merit to bear, alleluia, has risen as he said, alleluia. Pray for us to God, alleluia.' V. Rejoice and be glad, O Virgin Mary, alleluia. R. For the Lord is truly risen, alleluia. Then the collect: 'O God, who through the resurrection of your Son, our Lord Jesus Christ, did vouchsafe to give joy to the world; grant, we beseech you, that through his Mother, the Virgin Mary, we may obtain the joys of everlasting life, through the same Christ our Lord. Amen.'",
      },
    ],
    relatedPrayers: ["sign-of-the-cross", "angelus", "hail-mary", "regina-caeli"],
  }),

  // ──────────────── REWRITE: THE PARTS OF THE MASS ────────────────
  guide({
    slug: "understanding-the-parts-of-the-mass",
    title: "Understanding the Parts of the Mass",
    summary:
      "What happens at each moment of the Mass, what the people say and do, and why: from the Sign of the Cross to the dismissal.",
    kind: "general",
    category: "liturgy",
    sacramentKey: "eucharist",
    authorityLevel: "USCCB",
    citations: [U_ORDER, V_GIRM],
    intro:
      "The Mass is made up of two great parts, the Liturgy of the Word and the Liturgy of the Eucharist, framed by the Introductory and Concluding Rites. The General Instruction of the Roman Missal describes them as so closely joined that they form one single act of worship: at the table of God's Word and the table of Christ's Body the faithful are instructed and refreshed. Knowing the shape of the Mass is the first step toward what the Second Vatican Council asked of every Catholic: full, conscious and active participation. This guide walks through a Sunday Mass in the Ordinary Form of the Roman Rite as it is celebrated in the United States.",
    whatYouNeed: [
      "Nothing but yourself; a missal or the parish's worship aid helps you follow the readings and responses",
      "The Eucharistic fast: one hour from food and drink (other than water and medicine) before receiving Communion",
      "The state of grace, if you intend to receive Holy Communion — confession first if you are aware of mortal sin",
    ],
    whenToPray:
      "Every Sunday and holy day of obligation, at the vigil Mass on the evening before or on the day itself; daily Mass whenever you can. Sunday is the original feast day, and the precept binds all Catholics who are not prevented by serious reason.",
    tips: [
      "Arrive a few minutes early. Bless yourself with holy water at the door, genuflect toward the tabernacle before entering the pew, and use the quiet to prepare.",
      "The postures — standing, sitting, kneeling — are not arbitrary: we stand to pray and to hear the Gospel, sit to listen, and kneel to adore. In the United States the faithful kneel from after the Holy, Holy, Holy until after the Great Amen, and again after the Lamb of God.",
      "Join in the responses and the singing out loud. The General Instruction says the people's acclamations and responses are not decoration but their proper part in the celebration.",
      "If you cannot receive Communion, you may still come forward with your arms crossed over your chest for a blessing, or remain in the pew and make an Act of Spiritual Communion.",
    ],
    durationMinutes: 60,
    steps: [
      {
        order: 1,
        title: "The Introductory Rites: gathering as one body",
        body: "The Mass begins with the entrance chant as the priest and ministers process to the altar; the priest kisses the altar, a sign of Christ. Then all make the Sign of the Cross together and the priest greets the people: 'The Lord be with you.' R. 'And with your spirit.' The Penitential Act follows — often the Confiteor ('I confess to almighty God...'), striking the breast at 'through my fault, through my fault, through my most grievous fault' — and then the Kyrie: 'Lord, have mercy. Christ, have mercy. Lord, have mercy.' On Sundays outside Advent and Lent, and on solemnities and feasts, the Gloria is sung or said. The priest then invites 'Let us pray' and prays the Collect, gathering the prayers of all, to which the people answer 'Amen.'",
      },
      {
        order: 2,
        title: "The Liturgy of the Word: the readings and the psalm",
        body: "All sit. The First Reading is usually from the Old Testament (from the Acts of the Apostles in Easter Time) and is chosen to echo the Gospel. The lector ends 'The word of the Lord' and all answer 'Thanks be to God.' The Responsorial Psalm follows, sung or said, with the people repeating the refrain; it is the people's meditative answer to God's word. On Sundays and solemnities there is a Second Reading from the New Testament letters or Revelation, again closing with 'The word of the Lord. R. Thanks be to God.' Keep a moment of silence after each reading to let it settle.",
      },
      {
        order: 3,
        title: "The Gospel: standing to hear Christ speak",
        body: "All stand for the Gospel Acclamation — the Alleluia, or in Lent 'Praise to you, Lord Jesus Christ, King of endless glory' or a similar acclamation. The deacon or priest says 'The Lord be with you. R. And with your spirit. A reading from the holy Gospel according to N.' and all answer 'Glory to you, O Lord,' tracing a small cross on the forehead, lips and heart: that the Gospel may be in my mind, on my lips and in my heart. At the end: 'The Gospel of the Lord.' R. 'Praise to you, Lord Jesus Christ.' In the Gospel, Christ himself is present and speaking to his people.",
      },
      {
        order: 4,
        title: "The Homily, the Creed and the Universal Prayer",
        body: "All sit for the Homily, in which the priest or deacon opens the Scriptures and applies them to life; the homily is part of the liturgy itself, not an interruption of it. On Sundays and solemnities all then stand for the Profession of Faith, ordinarily the Nicene Creed; everyone bows at the words 'and by the Holy Spirit was incarnate of the Virgin Mary, and became man' (and genuflects at them on Christmas and the Annunciation). The Apostles' Creed may be used instead, especially in Lent and Easter Time. The Liturgy of the Word closes with the Universal Prayer (the Prayer of the Faithful), in which the people intercede for the Church, the world, those in need and the local community, answering each petition, usually 'Lord, hear our prayer.'",
      },
      {
        order: 5,
        title: "The Preparation of the Gifts",
        body: "All sit as the Liturgy of the Eucharist begins. Members of the congregation bring forward the bread and wine, and the collection for the Church and the poor is gathered — both are the people's offering of themselves. The priest places the gifts on the altar with the prayers 'Blessed are you, Lord God of all creation...', to which the people may answer 'Blessed be God for ever,' and washes his hands. Then all stand as he says: 'Pray, brethren (brothers and sisters), that my sacrifice and yours may be acceptable to God, the almighty Father.' R. 'May the Lord accept the sacrifice at your hands, for the praise and glory of his name, for our good and the good of all his holy Church.' He prays the Prayer over the Offerings; all answer 'Amen.'",
      },
      {
        order: 6,
        title: "The Eucharistic Prayer: the centre and summit of the Mass",
        body: "The Eucharistic Prayer opens with the Preface dialogue: 'The Lord be with you. R. And with your spirit. Lift up your hearts. R. We lift them up to the Lord. Let us give thanks to the Lord our God. R. It is right and just.' After the Preface all sing 'Holy, Holy, Holy Lord God of hosts...' and then kneel. The priest asks the Father to send the Holy Spirit upon the gifts, and then, taking the bread and the chalice, speaks the words of Christ at the Last Supper: 'This is my Body... This is the chalice of my Blood.' By these words the bread and wine become the Body and Blood of Christ, and his one sacrifice on the Cross is made present. The priest raises the Host and the chalice; it is customary to look at them and adore in silence, or to say quietly 'My Lord and my God.' Then: 'The mystery of faith.' R. 'We proclaim your Death, O Lord, and profess your Resurrection until you come again' (or one of the other two acclamations). The prayer continues with intercession for the Church, the Pope and bishop, the living and the dead, and ends with the doxology: 'Through him, and with him, and in him, O God, almighty Father, in the unity of the Holy Spirit, all glory and honour is yours, for ever and ever.' The people's 'Amen' — the Great Amen — is their assent to everything that has been done.",
      },
      {
        order: 7,
        title: "The Communion Rite: the Our Father, the peace and the Lamb of God",
        body: "All stand and pray the Our Father together, the prayer Christ gave us, asking for our daily bread. The priest continues 'Deliver us, Lord, we pray, from every evil...' and the people answer 'For the kingdom, the power and the glory are yours now and for ever.' After the prayer for peace the deacon or priest may say 'Let us offer each other the sign of peace,' and those nearby exchange a simple greeting of peace — a handshake or a bow — as a sign of the reconciliation Christ has given. Then the priest breaks the Host while all sing the Lamb of God: 'Lamb of God, you take away the sins of the world, have mercy on us... grant us peace.' In the United States all kneel after the Lamb of God.",
      },
      {
        order: 8,
        title: "Receiving Holy Communion",
        body: "The priest holds up the Host: 'Behold the Lamb of God, behold him who takes away the sins of the world. Blessed are those called to the supper of the Lamb.' All answer: 'Lord, I am not worthy that you should enter under my roof, but only say the word and my soul shall be healed.' Catholics in the state of grace who have kept the one-hour fast come forward in procession. Bow your head as the person in front of you receives, then step forward; the minister says 'The Body of Christ' and you answer 'Amen' before receiving, on the tongue or on the hand (if in the hand, place one hand under the other, receive the Host, and consume it at once, before stepping away). If the chalice is offered: 'The Blood of Christ.' R. 'Amen.' Return to your place and keep a time of silent thanksgiving; the Anima Christi is a traditional prayer for this moment. The rite ends with the Prayer after Communion, to which all answer 'Amen.'",
      },
      {
        order: 9,
        title: "The Concluding Rites: blessed and sent",
        body: "After any brief announcements, the priest greets the people once more — 'The Lord be with you. R. And with your spirit.' — and blesses them: 'May almighty God bless you, the Father, and the Son, and the Holy Spirit.' R. 'Amen.' Then the dismissal, which gives the Mass its name (missa, 'sending'): 'Go forth, the Mass is ended,' or 'Go and announce the Gospel of the Lord,' or 'Go in peace, glorifying the Lord by your life,' or simply 'Go in peace.' R. 'Thanks be to God.' The priest kisses the altar and leaves in procession. Stay for the closing hymn, and, if you can, a minute of quiet before leaving: the Eucharist you have received is meant to be carried into the week.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "confiteor",
      "nicene-creed",
      "apostles-creed",
      "our-father",
      "act-of-spiritual-communion",
      "anima-christi",
    ],
  }),

  // ───────────── 80. THE LITURGY OF THE HOURS ─────────────
  guide({
    slug: "how-to-pray-the-liturgy-of-the-hours",
    title: "How to Pray the Liturgy of the Hours",
    summary:
      "Morning, Evening and Night Prayer with a breviary or an approved app: what the Hours are, how the four-week psalter works, and the order of each Hour.",
    kind: "liturgy_of_the_hours",
    category: "liturgy",
    authorityLevel: "USCCB",
    citations: [U_LOTH, V_SC],
    intro:
      "The Liturgy of the Hours, also called the Divine Office, is the public prayer of the Church that sanctifies the whole course of the day and night with psalms, Scripture and intercession. Bishops, priests, deacons and religious are bound to it, but the Second Vatican Council warmly encouraged the laity to pray it too, alone or with others, and above all Morning and Evening Prayer, the two 'hinges' of the day. When you pray it you are not saying private prayers: you are joining the prayer that the whole Church, with Christ its Head, offers to the Father at every hour.",
    whatYouNeed: [
      "A breviary — the four-volume Liturgy of the Hours, or the one-volume Christian Prayer, which contains Morning, Evening and Night Prayer — or an approved app or website that lays out the day's texts",
      "A guide (ordo) or the app's calendar to tell you today's week of the psalter and any feast",
      "About fifteen minutes for Morning or Evening Prayer, five for Night Prayer",
      "If praying with others, one person to lead and a way to alternate the psalm verses",
    ],
    whenToPray:
      "Morning Prayer soon after rising, Evening Prayer at the end of the working day, Night Prayer just before sleep. If you can pray only one Hour, choose Morning or Evening Prayer; the Council names them the principal Hours.",
    tips: [
      "An app removes the ribbons and the page-flipping. Begin there, and take up a printed breviary when you know the shape of the Hours by heart.",
      "Pray the psalms slowly and pause between them. The Church asks that the psalmody be prayed with the mind attentive to the words, and gives an antiphon to each psalm to show how the Church reads it in Christ.",
      "Make the Sign of the Cross at the opening words of the Benedictus, the Magnificat and the Nunc Dimittis, as the rubrics direct, and stand for these Gospel canticles.",
      "Many parishes sing Evening Prayer on Sundays and during Advent and Lent; Sacrosanctum Concilium specifically asked for this. Join them if you can.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Know the Hours and what each is for",
        body: "The full Office has five parts. Morning Prayer (Lauds) consecrates the day as it begins and recalls the Resurrection; Evening Prayer (Vespers) gives thanks for the day and recalls the evening sacrifice; these two are the hinges, and lay people who pray the Office usually pray these. The Office of Readings, with its longer Scripture and Church Fathers, may be prayed at any hour. Daytime Prayer (mid-morning, midday or mid-afternoon) is brief, and Night Prayer (Compline) is the short prayer before sleep. Each Hour is built from a hymn, psalms with antiphons, a reading, a responsory, a Gospel canticle at the major Hours, intercessions and a concluding prayer.",
      },
      {
        order: 2,
        title: "Set up your breviary or app",
        body: "In a printed breviary, find the four-week Psalter (the largest section), the Proper of Seasons (Advent, Christmas, Lent, Easter), the Proper of Saints and the Commons, and the Ordinary, which gives the fixed structure of each Hour. Place a ribbon in each of the first three. An app does this for you: open today's date and choose the Hour. Check the day's guide for the week of the psalter and whether a feast replaces the ordinary texts. Choose a quiet place and, if possible, face a crucifix or icon.",
      },
      {
        order: 3,
        title: "Find your place in the four-week psalter",
        body: "The psalms are spread over a four-week cycle, Week I to Week IV. In Ordinary Time the week of the psalter matches the Sunday: the first, fifth, ninth and thirteenth Sundays (and so on) begin Week I, the second, sixth and tenth begin Week II, and likewise for Weeks III and IV; the First Sunday of Advent, the First Sunday of Lent and Easter Sunday always begin Week I. Sundays and solemnities have Evening Prayer I on the evening before. If in doubt, the ordo or the app tells you; in a printed breviary the week is printed at the head of each page.",
      },
      {
        order: 4,
        title: "Morning Prayer step by step",
        body: "If this is the first Hour of your day, begin with the Invitatory: 'Lord, open my lips. R. And my mouth will proclaim your praise,' then Psalm 95 (or 100, 67 or 24) with its antiphon repeated after each stanza. Otherwise begin 'God, come to my assistance. R. Lord, make haste to help me,' then the Glory Be, and 'Alleluia' outside Lent. Sing or say the hymn. Pray the first psalm with its antiphon before and after and the Glory Be at the end, then the Old Testament canticle, then the second psalm, each in the same way. Read the short Scripture reading and pause. Say the responsory line by line. Stand and make the Sign of the Cross for the Benedictus, the Canticle of Zechariah, with its antiphon. Pray the intercessions, answering each with the given response, then the Our Father and the concluding prayer. If no priest or deacon is present, end: 'May the Lord bless us, protect us from all evil and bring us to everlasting life. R. Amen.'",
      },
      {
        order: 5,
        title: "Evening Prayer step by step",
        body: "Begin 'God, come to my assistance. R. Lord, make haste to help me,' the Glory Be and 'Alleluia' outside Lent. The hymn follows. Pray two psalms and a New Testament canticle, each framed by its antiphon and closed with the Glory Be. Read the short reading, pause in silence, and say the responsory. Stand and make the Sign of the Cross for the Magnificat, the Canticle of Mary, with its antiphon; this is the heart of Evening Prayer. The intercessions at Evening Prayer always end with a petition for the dead. Then the Our Father, the concluding prayer and the blessing: 'May the Lord bless us, protect us from all evil and bring us to everlasting life. R. Amen.'",
      },
      {
        order: 6,
        title: "Night Prayer before sleep",
        body: "Night Prayer is short and changes little from week to week, so it is easily learned by heart. Begin 'God, come to my assistance. R. Lord, make haste to help me,' with the Glory Be. Make a brief examination of conscience in silence, and pray the Confiteor or another act of contrition. Sing or say the hymn, then the psalm (or two) for the day of the week with its antiphon. Read the short reading, and say the responsory: 'Into your hands, Lord, I commend my spirit.' Make the Sign of the Cross for the Nunc Dimittis, the Canticle of Simeon, with its antiphon 'Protect us, Lord, as we stay awake; watch over us as we sleep, that awake we may keep watch with Christ, and asleep rest in his peace.' Pray the concluding prayer, and end: 'May the all-powerful Lord grant us a restful night and a peaceful death. R. Amen.' Finish with a Marian antiphon — the Salve Regina, or the Regina Caeli in Easter Time.",
      },
      {
        order: 7,
        title: "Feasts and seasons",
        body: "In Advent, Christmas, Lent and Easter the Proper of Seasons supplies antiphons, readings, responsories and prayers that replace those of the psalter, while the psalms themselves usually stay. On a solemnity or feast, the Proper of Saints or the Commons supplies almost everything, and the psalms are those of Sunday Week I; the Te Deum is added to the Office of Readings on Sundays outside Lent, solemnities and feasts. Memorials of saints normally keep the weekday psalms and take only the concluding prayer, and perhaps the antiphons of the Gospel canticles, from the saint. Your app or ordo marks all of this; when in doubt, pray the weekday and do not worry.",
      },
      {
        order: 8,
        title: "Praying the Hours with others",
        body: "The Office is by nature communal, and it is simple to pray together. One person leads the opening versicle, the intercessions and the concluding prayer; the group divides into two sides that alternate the stanzas of each psalm, or a cantor sings the verses and all answer the antiphon. All stand for the opening, the hymn, the Gospel canticle, the intercessions and the concluding prayer, and sit for the psalms and the reading. In a family, a single psalm, the reading and the Gospel canticle already make a true celebration of the Hour. Sacrosanctum Concilium asked pastors to celebrate the principal Hours, especially Vespers, in church on Sundays and greater feasts, and encouraged the laity to pray the Office with priests, among themselves, or alone.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "glory-be",
      "benedictus-canticle-of-zechariah",
      "our-father",
      "magnificat",
      "confiteor",
      "nunc-dimittis",
      "salve-regina",
      "regina-caeli",
      "te-deum",
    ],
    relatedDevotions: ["liturgy-of-the-hours"],
  }),

  // ───────── 81. BEGINNING AND ENDING THE DAY WITH PRAYER ─────────
  guide({
    slug: "how-to-begin-and-end-the-day-with-prayer",
    title: "How to Begin and End the Day with Prayer",
    summary:
      "A simple daily rule of prayer that fits an ordinary life: the Morning Offering on waking, the Angelus at noon, a moment of Scripture, the evening examen and night prayer.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_CCC_PRAYER, U_PRAYERS],
    intro:
      "The Catechism teaches that prayer is a habit to be learned, and that the Christian tradition has always marked certain moments for it: morning and evening, before and after meals, and the Hours of the day. This guide offers a small rule that a busy person can actually keep — a few minutes at the beginning, the middle and the end of the day — built from prayers the Church has used for centuries. A rule of life is not a burden but a set of handrails: on the days you feel nothing, it carries you.",
    whatYouNeed: [
      "Ten minutes across the day, split between morning, noon and evening",
      "The texts of the Morning Offering, the Angelus and the Act of Contrition until you know them",
      "A Bible, or the day's Mass readings from a missal or app",
      "A fixed place to pray, even if it is only a chair facing a crucifix",
    ],
    whenToPray:
      "On waking, at noon, and before sleep, every day. The times matter less than the fixedness: the same moments, kept daily, become prayer without effort.",
    tips: [
      "Start with less than you think you can manage. A rule you keep for a year does more than a generous one you abandon by Lent.",
      "Tie each prayer to something you already do: the Morning Offering before you check your phone, the Angelus with lunch, the examen while brushing your teeth.",
      "If you miss the morning, do not skip the day. Pick up the rule at the next moment.",
      "As the rule takes root, let it grow toward the Liturgy of the Hours or a daily decade of the Rosary rather than adding many small devotions.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "On waking: the Morning Offering",
        body: "Before the day claims you, make the Sign of the Cross and pray the Morning Offering: 'O Jesus, through the Immaculate Heart of Mary, I offer you my prayers, works, joys and sufferings of this day in union with the Holy Sacrifice of the Mass throughout the world...' Everything you will do today — the work, the interruptions, the tiredness — is given to God in advance, joined to every Mass being offered in the world. Add a short intention for the day, and, if you like, the Guardian Angel Prayer.",
      },
      {
        order: 2,
        title: "At noon: the Angelus",
        body: "Set an alarm for noon and stop for one minute. Pray the Angelus: the three versicles, 'The Angel of the Lord declared unto Mary... Behold the handmaid of the Lord... And the Word was made flesh,' each followed by a Hail Mary, then 'Pray for us, O holy Mother of God' and the collect. In Easter Time pray the Regina Caeli instead. This midday pause puts the Incarnation into the middle of the working day; Catholics have kept it for centuries at the sound of the church bell.",
      },
      {
        order: 3,
        title: "Sometime in the day: a moment of Scripture",
        body: "Read the Gospel of the day's Mass, or a few verses of a Gospel read in order, slowly and once. Stop at a word or phrase that strikes you and stay with it for a minute; ask what God is saying to you through it, and answer him. This is the beginning of lectio divina, which the Church commends to every Christian as the ordinary way of praying with the word of God. Five minutes is enough.",
      },
      {
        order: 4,
        title: "In the evening: the examen",
        body: "Before supper or before bed, take five minutes to look back over the day with God. Thank him for what was good, and name two or three specific things. Ask the Holy Spirit for light, then walk through the day from morning to now: where did you act with love, and where did you fail? Be sorry for the failures and pray the Act of Contrition. Finally, look to tomorrow and ask for one grace you will need. Saint Ignatius of Loyola shaped this practice, and the Catechism describes the daily examination of conscience as a normal part of Christian life.",
      },
      {
        order: 5,
        title: "Before sleep: night prayer and the guardian angel",
        body: "End the day as the Church does in Night Prayer. Pray the Our Father and a Hail Mary, then the Nunc Dimittis, the Canticle of Simeon: 'Lord, now you let your servant go in peace...' Commend yourself to God with 'Into your hands, Lord, I commend my spirit,' and pray the Guardian Angel Prayer: 'Angel of God, my guardian dear, to whom God's love commits me here, ever this day be at my side, to light and guard, to rule and guide. Amen.' Many end with a Marian antiphon such as the Salve Regina and the Sign of the Cross.",
      },
      {
        order: 6,
        title: "Keeping the rule",
        body: "Write your rule down — three lines are enough — and keep it where you pray. Review it once a month: is it too much, too little, being kept? Adjust it rather than abandoning it. Bring it to confession or to a spiritual director if you have one. Sundays are for Mass and rest, not for extra obligations, so let the rule be lighter that day. The aim is not to have prayed a certain number of prayers but to have lived the whole day, from waking to sleep, in the presence of God.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "morning-offering",
      "guardian-angel-prayer",
      "angelus",
      "regina-caeli",
      "act-of-contrition",
      "our-father",
      "hail-mary",
      "nunc-dimittis",
      "salve-regina",
    ],
    relatedPractices: ["ignatian-examen", "lectio-divina"],
    relatedSaints: ["saint-ignatius-of-loyola"],
  }),

  // ──────────────── 82. GRACE AT MEALS ────────────────
  guide({
    slug: "how-to-pray-grace-at-meals",
    title: "How to Pray Grace Before and After Meals",
    summary:
      "The traditional blessings before and after eating, how to lead them at home, with children, in public, and on feast days.",
    kind: "general",
    category: "family",
    authorityLevel: "USCCB",
    citations: [U_PRAYERS, V_DPP],
    intro:
      "Jesus gave thanks before he broke bread, at the feeding of the five thousand and at the Last Supper, and the first Christians did the same. Grace at meals is the simplest of all family prayers: a few words that turn a table into a place where God is remembered and thanked. The Catechism lists the blessing of meals among the moments the Christian tradition sets aside for prayer, and the Directory on Popular Piety counts it among the devotions that sanctify daily life.",
    whatYouNeed: [
      "The two short prayers, learned by heart",
      "A moment of quiet before the food is touched",
      "One person to begin, so that everyone starts together",
    ],
    whenToPray:
      "Before and after every meal eaten together, at home or away, and before a meal eaten alone. The blessing before the meal is the one most families keep; the thanksgiving after is worth restoring.",
    tips: [
      "Hold hands or fold them, and let one person lead; when everyone knows the words, take turns leading, including the youngest.",
      "Grace can be sung; many families keep a sung grace for Sundays.",
      "If a guest at the table is not Catholic, pray as you always do without fuss. A short grace embarrasses no one, and many are moved by it.",
      "On fast days, grace before a smaller meal is a natural moment to remember those who have no meal at all.",
    ],
    durationMinutes: 5,
    steps: [
      {
        order: 1,
        title: "Why we bless the table",
        body: "Grace is an act of faith that everything on the table comes from God, and an act of thanksgiving for it. It does not change the food; it changes the eaters. Saying it together also makes the meal a shared prayer, the first liturgy a child ever takes part in. Wait until everyone is seated and the serving has paused, so that grace is not something muttered while the food is being passed.",
      },
      {
        order: 2,
        title: "Grace before meals",
        body: "Make the Sign of the Cross, then pray: 'Bless us, O Lord, and these thy gifts, which we are about to receive from thy bounty, through Christ our Lord. Amen.' End with the Sign of the Cross. That is the whole prayer. Some families add a short intention — 'and bless those who prepared this food' or 'and remember those who are hungry' — before the Amen.",
      },
      {
        order: 3,
        title: "Grace after meals",
        body: "When the meal ends and before the table is cleared, pray: 'We give thee thanks for all thy benefits, O almighty God, who livest and reignest world without end. Amen.' Then add the prayer for the dead that has always accompanied it: 'May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.' Make the Sign of the Cross. If it is hard to gather everyone at the end of a meal, say it while people are still seated with the last of their food.",
      },
      {
        order: 4,
        title: "With children",
        body: "Children learn grace by hearing it every day and being asked to lead it. Begin with the Sign of the Cross, which a toddler can make; then let a small child say a one-line grace, 'Thank you, God, for our food. Amen,' until the traditional words come. Let older children take turns leading the full grace and choosing an intention. A child who has led grace at home is not shy about praying anywhere.",
      },
      {
        order: 5,
        title: "In restaurants and in public",
        body: "Grace in public is a quiet witness, not a performance. Say it in a normal, lowered voice with the Sign of the Cross, exactly as at home; there is no need either to hide it or to announce it. If you are eating with people who would be uncomfortable, a silent grace with a discreet Sign of the Cross is still grace. Eating alone, bless the food as you always do; the habit is what keeps the prayer alive.",
      },
      {
        order: 6,
        title: "On Sundays and feast days",
        body: "On Sundays, on the great feasts and at family celebrations, grace can be lengthened a little: a verse of Scripture, a psalm, or the seasonal blessings the United States bishops publish in Catholic Household Blessings and Prayers, which give meal prayers for Advent, Christmas, Lent and Easter. In Easter Time an 'Alleluia' may be added, and at Christmas dinner the family may bless the table with the Gloria's opening words, 'Glory to God in the highest.' Keep the prayer short enough that it never becomes a reason to skip it.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "grace-before-meals",
      "grace-after-meals",
      "eternal-rest",
    ],
  }),

  // ──────────────── 83. HOW TO PRAY A NOVENA ────────────────
  guide({
    slug: "how-to-pray-a-novena",
    title: "How to Pray a Novena",
    summary:
      "The nine-day form of prayer: what it is, how to choose one, how to fix the days so they end on the feast, and the novenas the Church itself keeps.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_DEV],
    intro:
      "A novena is nine consecutive days of prayer for a particular intention or in preparation for a feast. The pattern comes from the Acts of the Apostles: after the Ascension, the apostles with Mary and the disciples devoted themselves to prayer in the upper room for the nine days before Pentecost. The Directory on Popular Piety and the Liturgy recognises novenas as a legitimate form of popular devotion when they draw the faithful toward the liturgy and the sacraments, and warns against treating them as a formula that binds God. The nine days are a school of persevering prayer, nothing more and nothing less.",
    whatYouNeed: [
      "A novena text approved for use, from a prayer book, the parish or a trusted Catholic publisher",
      "A clear intention, or a feast you are preparing for",
      "Five to ten minutes a day for nine days",
      "A reminder — a note on the calendar or an alarm — so the days are not lost",
    ],
    whenToPray:
      "Any nine days, but traditionally the nine days ending on the eve of a feast, or beginning on the feast itself. The same hour each day helps.",
    tips: [
      "Choose a novena whose prayers you can pray with a whole heart. The best novenas are mostly Scripture and the Church's own prayers.",
      "Pray for a specific intention, but end each day by asking that God's will, not yours, be done.",
      "Go to Mass, and if possible to confession, during the nine days. A novena is meant to lead to the sacraments, not to replace them.",
      "Avoid any novena text that promises a guaranteed result or asks you to leave copies in a church. The Church calls that superstition, not devotion.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand what a novena is",
        body: "The word comes from the Latin novem, nine. A novena is nine days of prayer, most often for a particular intention or in preparation for a feast, following the example of the apostles gathered with Mary between the Ascension and Pentecost (Acts 1:14). It is not a magic number or a bargain with heaven; it is a form of the persevering prayer that Jesus asked for when he told the parable of the widow and the judge. Whatever is asked is asked in trust that God answers every prayer in the way that is best.",
      },
      {
        order: 2,
        title: "Choose a novena",
        body: "There are novenas to the Holy Spirit, to the Sacred Heart, to Our Lady under her many titles, to Saint Joseph and to the saints, each with its own daily prayer. Choose one that fits your intention or the feast you are preparing for, and use a text from a reliable source: a parish leaflet, a standard prayer book, or a text that carries a bishop's approval. A good novena is built from Scripture, a short meditation, the traditional prayers and a prayer of petition; anything that reads like a chain letter should be set aside.",
      },
      {
        order: 3,
        title: "Fix the nine days",
        body: "Count backward from the feast so that the ninth day falls on the day before it: a novena to Saint Joseph, for example, begins on March 10 and ends on March 18 for the feast on the 19th. Some novenas instead begin on the feast day itself, and a novena for a private intention may be prayed on any nine consecutive days. Write the dates down. Decide the hour, too, and keep it: after morning prayer, at lunch, or before bed.",
      },
      {
        order: 4,
        title: "The daily structure",
        body: "Each day, make the Sign of the Cross and state your intention simply before God. Pray the novena's prayer for that day, reading the meditation slowly if it has one. Add the Church's basic prayers as the text directs — usually an Our Father, a Hail Mary and a Glory Be, sometimes a litany or a decade of the Rosary. Close with the invocation of the saint or mystery ('Saint Joseph, pray for us'; 'Come, Holy Spirit') and the Sign of the Cross. Five minutes done every day is better than half an hour done twice.",
      },
      {
        order: 5,
        title: "If you miss a day",
        body: "Simply pray the missed day's prayer when you remember, and continue. The novena is not spoiled, because God is not counting days; you are. If you miss several days, either pray them together on one day or begin again, whichever helps you pray better. What matters is the perseverance of the heart, not an unbroken sequence.",
      },
      {
        order: 6,
        title: "The novenas the whole Church keeps",
        body: "Three novenas belong to the Church's own calendar. The novena to the Holy Spirit is the original one, prayed on the nine days between the Ascension and Pentecost; the Veni Creator Spiritus or the Come, Holy Spirit is its natural prayer. The Christmas novena runs from December 16 to 24, and from December 17 to 23 it is joined by the O Antiphons sung at Vespers before the Magnificat. The Divine Mercy novena begins on Good Friday and ends on the Saturday before Divine Mercy Sunday, praying the Chaplet of Divine Mercy each day for a different group of souls. Praying these with the Church is the best introduction to the novena as a form.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "our-father",
      "hail-mary",
      "glory-be",
      "veni-creator-spiritus",
      "o-antiphons",
    ],
  }),

  // ──────────────── 84. HOW TO PRAY A LITANY ────────────────
  guide({
    slug: "how-to-pray-a-litany",
    title: "How to Pray a Litany",
    summary:
      "The call-and-response prayer of invocations: the litanies approved for public use, how a leader and people pray them, how to pray one alone, and when.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_PRAYERS],
    intro:
      "A litany is a prayer of many short invocations, each answered by the same response: 'pray for us', 'have mercy on us', 'deliver us, O Lord'. The form is ancient; the Litany of the Saints is already found in the liturgy of the first millennium, and it is still sung at the Easter Vigil, at ordinations and at the consecration of churches. The Directory on Popular Piety counts litanies among the devotions most in harmony with the liturgy, because their rhythm of invocation and response is the rhythm of the Church's own prayer, and because they are so easily prayed together.",
    whatYouNeed: [
      "The text of the litany — several are in every Catholic prayer book",
      "For a group: one leader to sing or say the invocations, and everyone else to answer",
      "About ten minutes",
    ],
    whenToPray:
      "At any time; in public devotions the Litany of Loreto is sung at May crownings and after the Rosary, the Litany of the Sacred Heart in June and on First Fridays, the Litany of Saint Joseph in March, and the Litany of the Saints on All Saints' Day, at the Easter Vigil and in processions.",
    tips: [
      "Do not rush. The repetition of the response is meant to still the mind, as the repetition of the Hail Mary does in the Rosary.",
      "Sung litanies carry better than spoken ones; the simple chant tones are easily learned.",
      "In a group, the leader alone says the invocations and the people alone say the response. Everyone saying everything defeats the form.",
      "Litanies not on the approved list, such as the Litany of Humility, may be prayed privately with profit; they are simply not used in public liturgical worship.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand the shape of a litany",
        body: "Every litany has the same architecture. It opens with the Kyrie: 'Lord, have mercy. Christ, have mercy. Lord, have mercy,' and invocations of the Trinity answered 'have mercy on us.' The body is a series of titles or names — of Christ, of Our Lady, of a saint, or of the saints in order — each answered by the same response. It usually ends with invocations of the Lamb of God, a versicle and response, and a closing collect said by the leader. Once you know this shape, you can pray any litany without a rehearsal.",
      },
      {
        order: 2,
        title: "Know the litanies approved for public use",
        body: "The Church has approved six litanies for public liturgical use: the Litany of the Saints, the oldest and the one used in the liturgy itself; the Litany of the Blessed Virgin Mary, called the Litany of Loreto; the Litany of the Most Holy Name of Jesus; the Litany of the Sacred Heart of Jesus; the Litany of the Most Precious Blood; and the Litany of Saint Joseph. Any of these may be sung or said in church, in processions and at public devotions. Other litanies exist and may be prayed privately, but these six are the Church's own.",
      },
      {
        order: 3,
        title: "Praying with a leader and people",
        body: "The leader says or sings each invocation and the people answer with the response. For the Litany of Loreto: 'Holy Mary — pray for us. Holy Mother of God — pray for us. Mother of Christ — pray for us.' For the Litany of the Sacred Heart: 'Heart of Jesus, Son of the Eternal Father — have mercy on us.' For the Litany of the Saints: 'Saint Peter — pray for us. Saint Paul — pray for us,' and, in the petitions, 'From all evil — deliver us, O Lord' and 'That you would be pleased to grant us peace — we ask you, hear our prayer.' Keep one steady pace throughout; the leader sets it, and the people match it.",
      },
      {
        order: 4,
        title: "Praying a litany alone",
        body: "Alone, say both the invocation and the response yourself, quietly and without hurry: 'Mother most pure, pray for us. Mother most chaste, pray for us.' Some prefer to say only the invocations and let the response be silent in the heart. Either way, let a title occasionally stop you; a litany is a rosary of names, and any one of them can become a meditation. Stand or kneel as you would in church, and end with the closing prayer.",
      },
      {
        order: 5,
        title: "The closing prayer",
        body: "After the last invocations of the Lamb of God — 'Lamb of God, who take away the sins of the world, spare us, O Lord... graciously hear us, O Lord... have mercy on us' — the leader says the versicle and the people the response: for the Litany of Loreto, 'V. Pray for us, O holy Mother of God. R. That we may be made worthy of the promises of Christ.' Then the leader prays the collect given with the litany, and all answer 'Amen.' The closing prayer is not optional: it gathers the whole litany into a single petition through Christ.",
      },
      {
        order: 6,
        title: "When to pray the litanies through the year",
        body: "The litanies have their seasons. May, the month of Mary, and every Marian feast call for the Litany of Loreto, often after the Rosary or at a May crowning; it is also the customary conclusion of the Rosary in many places. June, the month of the Sacred Heart, and the First Fridays call for the Litany of the Sacred Heart, which is prayed publicly before the Blessed Sacrament. March and the feast of Saint Joseph on the 19th belong to the Litany of Saint Joseph. The Litany of the Saints is sung at the Easter Vigil before the baptisms, at ordinations and religious professions, and on All Saints' Day; it is also the Church's litany for times of great need, prayed in processions of petition.",
      },
    ],
    relatedPrayers: [
      "litany-of-the-blessed-virgin-mary",
      "litany-of-the-sacred-heart-of-jesus",
      "litany-of-saint-joseph",
      "litany-of-the-saints",
      "litany-of-humility",
    ],
  }),

  // ──────── 85. TEACHING A CHILD THE BASIC PRAYERS ────────
  guide({
    slug: "how-to-teach-a-child-the-basic-prayers",
    title: "How to Teach a Child the Basic Prayers",
    summary:
      "The Sign of the Cross, grace at meals, the Guardian Angel Prayer, the Our Father, the Hail Mary, the Glory Be and the Act of Contrition, taught age by age at home.",
    kind: "general",
    category: "family",
    authorityLevel: "VATICAN",
    citations: [V_FC, U_PRAYERS],
    intro:
      "Parents are the first teachers of prayer. Saint John Paul II wrote in Familiaris Consortio that the concrete example and living witness of parents is fundamental and irreplaceable in educating children to pray, and that the mother and father who pray with their children reach their hearts in a way no one else can. Children do not learn prayers from books; they learn them from the lips of someone who loves them, repeated at the same moments every day until the words become their own. This guide gives the order in which the Church's basic prayers are usually taught and the simplest way to teach each.",
    whatYouNeed: [
      "The prayers yourself, known by heart — a child copies what you know, not what you look up",
      "Fixed moments: waking, meals, bedtime",
      "A crucifix or holy picture in the child's room, and a rosary or holy card of their own",
      "Patience with mispronunciations; they are part of the charm and correct themselves",
    ],
    whenToPray:
      "Every day at the same moments, from infancy: the Sign of the Cross and a short blessing over the baby, grace at meals as soon as the child sits at the table, bedtime prayers from the first words. A child should know the Our Father, the Hail Mary, the Glory Be and the Act of Contrition before first confession and Communion, usually around age seven.",
    tips: [
      "Say the prayer with the child, not to the child. Pray it slowly, with the same wording every time, and let the child join in the words they know.",
      "One prayer at a time. Do not add the next until the last is secure; a child who knows three prayers well is better off than one who half-knows eight.",
      "Let the child see you pray alone. Familiaris Consortio insists that the parents' own prayer is the lesson.",
      "Use the parish's sacramental preparation as a check, not a substitute: catechists reinforce what has been learned at home.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "The Sign of the Cross (from infancy)",
        body: "Begin before the child can speak. Trace the cross on the baby's forehead at bedtime, as the priest did at baptism, and say the words: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.' As soon as the child can move a hand, guide it: forehead, breast, left shoulder, right shoulder. Every prayer you teach will begin and end with this sign, so it is learned by sheer repetition. Explain, when the child is old enough to ask, that it says who we belong to and what Jesus did for us.",
      },
      {
        order: 2,
        title: "Grace at meals (as soon as the child sits at the table)",
        body: "Grace is the first prayer a child prays with the whole family, and the first one they can lead. Say it together at every meal: 'Bless us, O Lord, and these thy gifts, which we are about to receive from thy bounty, through Christ our Lord. Amen.' A two-year-old will say 'Amen' with great conviction; a four-year-old can say the whole prayer. Let the child lead grace on their birthday and on feast days, and add the Grace After Meals as the family's habit allows.",
      },
      {
        order: 3,
        title: "The Guardian Angel Prayer (bedtime, from the first words)",
        body: "The Guardian Angel Prayer is short, rhymes, and answers a small child's fear of the dark: 'Angel of God, my guardian dear, to whom God's love commits me here, ever this day be at my side, to light and guard, to rule and guide. Amen.' Pray it at bedtime with the Sign of the Cross, kneeling by the bed or sitting on it. Tell the child, in a few words, that God has given them an angel who watches over them; the Catechism teaches that every person has one. This is usually the first prayer a child can say alone.",
      },
      {
        order: 4,
        title: "The Our Father (around ages four to six)",
        body: "The Our Father is the prayer Jesus taught, so teach it as such: 'This is how Jesus told us to talk to God.' Say it every night, one phrase at a time, and let the child echo each phrase until the whole prayer flows. Explain the hard words in a sentence — 'hallowed' means holy, 'trespasses' means the wrong things we do. A child who knows the Our Father can join in at Mass, and that is a great moment: point it out to them the first Sunday they pray it with the whole church.",
      },
      {
        order: 5,
        title: "The Hail Mary and the Glory Be (around ages five to seven)",
        body: "Teach the Hail Mary from the Gospel: the first half is what the angel and Elizabeth said to Mary, and the second half is our asking her to pray for us. Say it at bedtime after the Our Father, and let the child hold a rosary while learning it. The Glory Be follows quickly, because it is short: 'Glory be to the Father, and to the Son, and to the Holy Spirit; as it was in the beginning, is now, and ever shall be, world without end. Amen.' With these three prayers a child can pray a decade of the Rosary, and a single decade prayed with the family on a Sunday evening is the best way to fix them for life.",
      },
      {
        order: 6,
        title: "The Act of Contrition (before first confession)",
        body: "In the year before first confession, teach the Act of Contrition: 'O my God, I am heartily sorry for having offended thee, and I detest all my sins because of thy just punishments, but most of all because they offend thee, my God, who art all good and deserving of all my love. I firmly resolve, with the help of thy grace, to sin no more and to avoid the near occasions of sin. Amen.' The parish may use a simpler approved form; learn the one the child will use in the confessional. Say it together each night after a one-minute look back over the day: what was I sorry for today? A child who has prayed it at bedtime for months will not freeze when the priest asks for it.",
      },
      {
        order: 7,
        title: "Praying at bedtime: putting it together",
        body: "By the age of seven the bedtime prayers can take five minutes and have a settled order: the Sign of the Cross; the Our Father; the Hail Mary; the Glory Be; a short look back over the day and the Act of Contrition; prayers for named people — grandparents, a sick friend, the dead; the Guardian Angel Prayer; the Sign of the Cross. Keep the order the same every night, let the child lead parts of it, and bless the child at the end with a cross traced on the forehead. Familiaris Consortio says the family that prays together in this way is a domestic church; this is what that looks like at half past seven in the evening.",
      },
    ],
    relatedPrayers: [
      "sign-of-the-cross",
      "grace-before-meals",
      "grace-after-meals",
      "guardian-angel-prayer",
      "our-father",
      "hail-mary",
      "glory-be",
      "act-of-contrition",
    ],
  }),

  // ──────────── 86. GAINING A PLENARY INDULGENCE ────────────
  guide({
    slug: "how-to-gain-a-plenary-indulgence",
    title: "How to Gain a Plenary Indulgence",
    summary:
      "What an indulgence is and the conditions for a plenary one: the indulgenced work, sacramental confession, Holy Communion, prayer for the Pope's intentions and detachment from sin.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_IND, V_CCC_PEN],
    intro:
      "An indulgence, the Catechism teaches, is the remission before God of the temporal punishment due to sins whose guilt has already been forgiven, which the Church grants from the treasury of the merits of Christ and the saints. It is plenary if it removes all of that punishment and partial if it removes part. An indulgence is never a forgiveness of sin, which comes only through repentance and the sacrament of Penance; it is the Church's help to a Christian who has been forgiven and wants to be wholly healed of the effects of sin, in this life or in purgatory. The conditions below are those of the Church's Manual of Indulgences, summarised by the Apostolic Penitentiary in The Gift of the Indulgence.",
    whatYouNeed: [
      "A work to which the Church has attached a plenary indulgence (see step 2)",
      "Sacramental confession, within about twenty days before or after the work",
      "Holy Communion, preferably on the day of the work",
      "Prayer for the Holy Father's intentions — an Our Father and a Hail Mary suffice",
      "The interior disposition of being free from all attachment to sin, even venial sin",
    ],
    whenToPray:
      "Whenever you perform an indulgenced work; a plenary indulgence can be gained only once a day (except at the moment of death). Certain days carry special grants: All Souls' Day for the visit to a church, November 1 to 8 for the visit to a cemetery, and the days of a Jubilee year.",
    tips: [
      "Do not be discouraged by the condition of detachment from sin. If it is lacking, the indulgence is still gained as partial, and the honest attempt is itself a grace.",
      "One confession serves for several plenary indulgences, but each one needs its own Communion and its own prayer for the Pope.",
      "Form the intention at least in a general way — 'I wish to gain any indulgences I can' — since indulgences are gained only by those who intend to gain them.",
      "The indulgence can be applied to yourself or to a soul in purgatory, never to another living person.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Understand what an indulgence is and is not",
        body: "Sin has two consequences: guilt, which separates us from God and is forgiven in confession, and a disordered attachment to created things that remains even after forgiveness and must be purified, here or in purgatory; this purification is what the Catechism calls temporal punishment. An indulgence is the Church, exercising the power of binding and loosing given to Peter, applying the merits of Christ and the saints to remit that punishment. It presupposes forgiveness; it cannot be bought, and it does not excuse anyone from repentance or conversion. It is a gift, and the Church attaches it to works of prayer, penance and charity precisely to encourage them.",
      },
      {
        order: 2,
        title: "Perform an indulgenced work",
        body: "The Manual of Indulgences lists the works. Four can be done on any day: adoration of the Blessed Sacrament for at least half an hour; devout reading or hearing of Sacred Scripture for at least half an hour; the Way of the Cross before legitimately erected stations; and the Rosary (five decades, prayed continuously, with meditation on the mysteries) in a church or oratory, or in a family, a religious community or a pious association. Other grants are attached to particular days and places: visiting a church or oratory on All Souls' Day and praying the Our Father and the Creed; visiting a cemetery and praying for the dead from November 1 to 8; the papal blessing Urbi et Orbi; the renewal of baptismal promises at the Easter Vigil; and the works of a Jubilee. Do the work devoutly and completely.",
      },
      {
        order: 3,
        title: "Go to sacramental confession",
        body: "A plenary indulgence requires sacramental confession. It need not be on the same day: the Apostolic Penitentiary explains that the confession may be made within about twenty days before or after the work. A single confession suffices for several plenary indulgences gained in that period. Confession is required even if you are not conscious of mortal sin; the point is the sacramental grace of reconciliation, without which the healing an indulgence completes has not begun.",
      },
      {
        order: 4,
        title: "Receive Holy Communion",
        body: "Receive the Eucharist, preferably on the same day as the indulgenced work, though it too may be received within the same period of several days before or after. Unlike confession, a separate Communion is required for each plenary indulgence: one Communion, one plenary indulgence. Receive in the state of grace and with the usual fast, and let the Communion itself be the centre of the day, not a box to be ticked.",
      },
      {
        order: 5,
        title: "Pray for the intentions of the Holy Father",
        body: "Pray for the Pope's intentions, preferably on the same day as the work. The condition is fully satisfied by one Our Father and one Hail Mary, but any other prayer may be added or substituted according to your devotion. The intentions are the Pope's, not yours: you pray for whatever he is praying for, whether or not you know what that is. As with Communion, a separate prayer is required for each plenary indulgence.",
      },
      {
        order: 6,
        title: "Be free from all attachment to sin, even venial",
        body: "This is the hardest condition and the most important. It is not the same as being sinless; it means that there is no sin, even a small one, that you are holding on to and unwilling to give up. Examine yourself honestly: is there a habit, a resentment, a compromise that you would rather keep than surrender? Ask God for the grace to let it go. If, despite your good will, this full disposition is lacking, the Church says the indulgence is gained partially rather than not at all. Aim at the full gift, and trust God with the rest.",
      },
      {
        order: 7,
        title: "Apply the indulgence to yourself or to the dead",
        body: "Decide, at least in a general way, for whom you are gaining the indulgence. You may apply it to yourself, or offer it by way of suffrage for a soul in purgatory: a parent, a friend, or simply the soul most in need. You cannot apply it to another living person, who must gain their own. Many Catholics make it their custom to offer every indulgence for the dead, and in November especially the Church invites this. Then let the matter rest with God; the indulgence is his gift through the Church, and he applies it as he wills.",
      },
    ],
    relatedPrayers: ["our-father", "hail-mary", "apostles-creed", "glory-be", "eternal-rest"],
    relatedDevotions: ["devotion-to-the-holy-souls"],
  }),

  // ──────────── 87. THE NINE FIRST FRIDAYS ────────────
  guide({
    slug: "how-to-make-the-nine-first-fridays",
    title: "How to Make the Nine First Fridays",
    summary:
      "The Sacred Heart devotion of receiving Holy Communion in reparation on nine consecutive First Fridays: its origin, how to keep the nine months, and what to do if you miss one.",
    kind: "general",
    category: "devotion",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_HA, U_DEV],
    intro:
      "The devotion of the Nine First Fridays comes from the revelations of the Sacred Heart to Saint Margaret Mary Alacoque at Paray-le-Monial in the 1670s. Among the things she recorded, the Lord asked for Holy Communion on the first Friday of each month in reparation for the coldness and ingratitude with which his love is met, and promised his grace of final repentance to those who receive Communion on nine consecutive First Fridays. The Church has approved the devotion and, in Pius XII's encyclical Haurietis Aquas, commended the worship of the Sacred Heart as a summary of the whole Gospel. The promise is private revelation, never defined as doctrine; the devotion's real value is the nine months of faithful, reparative love it asks for.",
    whatYouNeed: [
      "A calendar with the first Friday of each of the next nine months marked",
      "A parish where you can attend Mass on Fridays, or a plan to reach one",
      "The state of grace for each Communion — confession beforehand when needed",
      "The Litany of the Sacred Heart and an act of reparation, from any Catholic prayer book",
    ],
    whenToPray:
      "On the first Friday of nine consecutive months, at Mass. Many parishes keep First Friday with exposition of the Blessed Sacrament, confessions and Benediction, and the devotion is naturally joined to the Solemnity of the Sacred Heart, the Friday after the second Sunday after Pentecost.",
    tips: [
      "Keep the intention explicit: at each Communion, offer it in reparation to the Sacred Heart. The Communion is the devotion; the intention is what makes it this devotion.",
      "First Friday is also a day of penance like every Friday. Fasting or abstinence that day fits the spirit of reparation well.",
      "The First Saturdays devotion of Fatima pairs naturally with the First Fridays; many keep both.",
      "Never let the counting overshadow the love. The Lord's promise is a promise of his fidelity, not a mechanism.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand the devotion and its promise",
        body: "Saint Margaret Mary recorded that the Lord, showing her his Heart, asked for a Communion of reparation on the first Friday of every month, and that he promised the grace of final perseverance — that those who receive Communion on nine consecutive First Fridays would not die in his displeasure nor without receiving the sacraments. The Church has judged the revelations worthy of belief and has spread the devotion for three centuries, while teaching that no devotion dispenses anyone from living in grace. Make the Nine First Fridays, then, not as an insurance policy but as nine months of returning love for love, which is exactly what the Sacred Heart asked.",
      },
      {
        order: 2,
        title: "Mark the nine months",
        body: "Find the first Friday of next month and mark it, then the first Friday of each of the following eight months. The Fridays must be consecutive: nine months in a row, without a gap. Note that a First Friday that falls on a holy day or during travel still counts if you receive Communion that day, so plan ahead for holidays and work trips. Tell your family or a friend; the devotion is easier to keep when someone else is keeping it with you.",
      },
      {
        order: 3,
        title: "Go to confession beforehand",
        body: "Holy Communion must be received in the state of grace, so go to confession before the First Friday whenever you are conscious of mortal sin, and it is a good custom to confess regularly during the nine months in any case — many parishes offer confessions on First Fridays or the Thursday evening before. Confession is not itself a condition of the devotion, but the devotion is one of reparation for sin, and a heart that has just been reconciled makes the best reparation.",
      },
      {
        order: 4,
        title: "Attend Mass and receive Communion on the First Friday",
        body: "On the First Friday, go to Mass and receive Holy Communion with the explicit intention of reparation to the Sacred Heart of Jesus. Before Communion, renew the intention in a sentence: 'Lord, I receive you today in reparation for the sins that wound your Heart, my own first of all.' After Communion, make a thanksgiving; the Anima Christi or a quiet minute of adoration is enough. If you cannot get to Mass in the morning, an evening Mass on the Friday fulfils the devotion; the day, not the hour, is what matters.",
      },
      {
        order: 5,
        title: "Make an act of reparation",
        body: "Reparation is the heart of the devotion, and the Church gives it words. On the First Friday, or during adoration if your parish has exposition, pray the Litany of the Sacred Heart of Jesus and an act of reparation or of consecration to the Sacred Heart; the Act of Consecration to the Sacred Heart used by many families is fitting here. Some also pray the Morning Offering with special attention that day, since it offers the whole day 'for the intentions of your Sacred Heart... in reparation for sin.' Reparation is completed by a concrete act of charity: a kindness done, a wrong repaired, a Friday abstinence kept.",
      },
      {
        order: 6,
        title: "If you miss a First Friday",
        body: "If a month is missed, the traditional understanding is that the sequence of nine begins again from the next First Friday. Do not be disheartened; the Communions already made were not wasted, and the Lord who asked for this devotion is not a bookkeeper. Simply begin again. Many Catholics, having completed the nine, go on receiving Communion in reparation every First Friday for the rest of their lives, which is the devotion's true aim: a heart that returns, month after month, to the Heart that first loved it.",
      },
    ],
    relatedPrayers: [
      "act-of-contrition",
      "morning-offering",
      "anima-christi",
      "litany-of-the-sacred-heart-of-jesus",
      "act-of-consecration-to-the-sacred-heart",
    ],
    relatedDevotions: ["nine-first-fridays", "devotion-sacred-heart-of-jesus"],
    relatedSaints: ["saint-margaret-mary-alacoque"],
  }),
];
