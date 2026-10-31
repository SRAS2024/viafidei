import type { CuratedEntry } from "../index";

/** The 1910 English Raccolta on archive.org; a printed page number follows. */
const RACCOLTA = "https://archive.org/details/theraccoltaorcol00unknuoft/page/";

/** The prayerType values of the PRAYER schema that this batch uses. */
type PrayerType =
  | "morning"
  | "evening"
  | "litany"
  | "marian"
  | "general"
  | "intercession"
  | "consecration"
  | "act"
  | "chaplet"
  | "hymn";

interface RaccoltaInput {
  slug: string;
  title: string;
  /** Printed pages of the 1910 edition the text runs over, first page first. */
  pages: number[];
  /** Paragraphs as printed; a line inside a paragraph is separated by "\n". */
  body: string[];
  /** The Latin the same pages print alongside the English, when they do. */
  latin?: string[];
  prayerType: PrayerType;
  category: string;
  occasions: string[];
  relatedSaints?: string[];
  summary: string;
}

/**
 * Batch 9 of the curated prayer catalogue: prayers from The Raccolta, or
 * Collection of Indulgenced Prayers and Good Works, in the 1910 English edition
 * of Ambrose St John of the Birmingham Oratory (London: Burns & Oates; New
 * York: Benziger), sections I to IX — prayers to the Most Holy Trinity, to
 * Almighty God, to the Holy Ghost, to our Lord Jesus Christ and his Holy Name,
 * to the Child Jesus, to our Lord in the Blessed Sacrament, to Jesus Crucified,
 * to the Precious Blood and to the Sacred Heart.
 *
 * The edition was published in 1910 (St John's translation dates from 1857),
 * so the text is in the public domain; every citation is the archive.org scan
 * of that edition (University of Toronto copy), opened at the printed page
 * where the prayer begins, followed by any page it runs on to. Every body is copied
 * character for character from those pages, and every `latin` value is the
 * Latin printed alongside the English there. Nothing is paraphrased,
 * shortened or merged with another version, and prayers already in the
 * catalogue (the Suscipe, the Anima Christi, the Adoro te and the like) are
 * left out rather than repeated in the Raccolta's wording.
 *
 * Only the typography is not reproduced: the small capitals in which the book
 * sets the divine names (GOD, LORD, JESUS, CHRIST, FATHER, SON, HOLY GHOST;
 * DEUS, DOMINE in the Latin) and the capitals after each drop initial are
 * given in ordinary capitalisation; the printer's line-end hyphens and the
 * spaces set before "!" and ";" are closed up; and the italic rubrics ("Gloria
 * Patri thrice") stand in plain type. The indulgence notes, the footnoted
 * rescript dates and the page cross-references ("see p. 154") are not part of
 * any prayer and are not copied; where a summary dates a prayer by its
 * indulgence it is giving history, not claiming a grant still in force (the
 * Raccolta's grants were superseded by the Enchiridion Indulgentiarum of
 * 1968).
 *
 * Corrections, all of them slips rather than readings: where the worn type of
 * the scan prints "of" as "or" or "ot" (nos. 23, 60, 75, 76) it is read as
 * "of", as the Latin beside it confirms where there is one; "O must just God"
 * is read "O most just God" (no. 58) and "througn-out" "throughout" (no. 88).
 * The book's own errata ("Notification", November 1909) are applied where
 * they touch these prayers: "mi sery" is "misery" (no. 10, page 9), "in
 * perfection of thy ways" is "in the perfection of thy ways" (no. 48), "whom
 * Thou has redeemed" is "whom Thou hast redeemed" (no. 49, both page 45), and
 * "To ap pease" is "To appease" (no. 115). The same "Thou has redeemed" in the
 * versicle of no. 88, which the errata miss, is given as "Thou hast".
 */
function raccolta(input: RaccoltaInput): CuratedEntry {
  const citations = input.pages.map((page) => `${RACCOLTA}${page}`);
  const payload: Record<string, unknown> = {
    slug: input.slug,
    title: input.title,
    body: input.body.join("\n\n"),
    prayerType: input.prayerType,
    category: input.category,
    language: "en",
    summary: input.summary,
    occasions: input.occasions,
    relatedSaints: input.relatedSaints ?? [],
    citations,
  };
  if (input.latin) payload.latin = input.latin.join("\n\n");
  return {
    contentType: "PRAYER",
    slug: input.slug,
    authorityLevel: "TRUSTED_PUBLISHER",
    citations,
    payload,
  };
}

const ST_JOHN = "Text from the 1910 English Raccolta of Ambrose St John.";

export const prayerBatch9: CuratedEntry[] = [
  // ── I. The Holy Trinity ──────────────────────────────────────────────────
  raccolta({
    slug: "thanksgiving-to-the-trinity-for-our-ladys-privileges",
    title: "Thanksgiving to the Most Holy Trinity for Our Lady's Privileges",
    pages: [3, 4, 5],
    body: [
      "Most Holy Trinity, Father, Son, and Holy Ghost, Three Persons and one God, we adore Thee, and with all the love of our whole hearts we give Thee thanks for the high gifts and privileges granted to Mary most holy in her glorious and Immaculate Conception. Gloria Patri thrice, and Ave Maria once.",
      "Most Holy Trinity, Father, Son, and Holy Ghost, we adore Thee, and with all the love of our whole hearts we give Thee thanks for the high gifts and privileges granted to Mary most holy in her glorious Nativity. Gloria Patri thrice, and Ave Maria once.",
      "Most Holy Trinity, Father, Son, and Holy Ghost, we adore Thee, and with all the love of our whole hearts we give Thee thanks for the high gifts and privileges granted to Mary most holy in her glorious Presentation in the Temple. Gloria Patri thrice, and Ave Maria once.",
      "Most Holy Trinity, Father, Son, and Holy Ghost, we adore Thee, and with all the love of our whole hearts we give Thee thanks for the high gifts and privileges granted to Mary most holy in her glorious Annunciation. Gloria Patri thrice, and Ave Maria once.",
      "Most Holy Trinity, Father, Son, and Holy Ghost, we adore Thee, and with all the love of our whole hearts we give Thee thanks for the high gifts and privileges granted to Mary most holy in her glorious Visitation. Gloria Patri thrice, and Ave Maria once.",
      "Most Holy Trinity, Father, Son, and Holy Ghost, we adore Thee, and with all the love of our whole hearts we give Thee thanks for the high gifts and privileges granted to Mary most holy in her glorious Purification. Gloria Patri thrice, and Ave Maria once.",
      "Most Holy Trinity, Father, Son, and Holy Ghost, we adore Thee, and with all the love of our whole hearts we give Thee thanks for the high gifts and privileges granted to Mary most holy in her most glorious Assumption. Gloria Patri thrice, and Ave Maria once.",
      "Lastly, we give Thee most hearty thanks, for that Thou hast exalted and glorified the most holy and most sweet name of Mary throughout the whole world.",
      "Prayer to the most Holy Virgin.",
      "Mary, dear Mother! Mother most amiable! tender Mother! Mother full of love and sweetness for thy clients and children! we pray thee, by this our loving act of thanksgiving to the Most Holy Trinity, obtain for all of us grace ever to employ the powers of our souls, and our bodily senses, to the honour and glory of God, one in Three Persons, directing all our actions to Him, and loving Him with pure hearts, even as thou didst love Him here on earth; that thus we may be able to attain to the enjoyment of Him in the bliss of heaven with thee for ever and ever.",
      "Bless us in the name of the Father, and of the Son, and of the Holy Ghost.",
      "All say the Salve Regina.",
      "V. Let us bless the Father, Son, and Holy Ghost.\nR. Let us praise and exalt Him above all for ever.",
      "Let us pray.",
      "Almighty and eternal God, who hast given to us thy servants grace by the confession of the true faith to acknowledge the glory of the eternal Trinity, and in the power of thy Majesty to worship the Unity; grant, we beseech Thee, that by the firmness of this our faith we may ever be defended from all adversities. Through Christ our Lord. R. Amen.",
    ],
    prayerType: "general",
    category: "trinitarian",
    occasions: ["trinity-sunday", "marian-feasts", "thanksgiving"],
    summary: `Seven acts of thanksgiving to the Blessed Trinity for the graces given to Our Lady in her Immaculate Conception, Nativity, Presentation, Annunciation, Visitation, Purification and Assumption, each followed by three Glory Bes and a Hail Mary, then a prayer to the Blessed Virgin, the Salve Regina and the collect of the Holy Trinity. The Raccolta (no. 3) gives them as the prayers said by priest and people after a votive Mass of the Holy Trinity, a devotion that began at the church of Our Lady of Loreto by Trajan's Forum in Rome and was indulgenced by Pius VII in 1815. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "thanksgiving-to-the-trinity-for-our-ladys-assumption",
    title: "Thanksgiving to the Holy Trinity for Our Lady's Assumption",
    pages: [5, 6, 7],
    body: [
      "Adore the eternal Father with a Pater, Ave, and Gloria; then say,",
      "I adore Thee, Eternal Father, my Lord and my God, in union with all the heavenly host, rendering Thee infinite thanks for every grace and favour Thou hast granted to Mary, most holy Virgin, thy well-beloved daughter, and, above all, for that height of power to which Thou didst exalt her by her Assumption into heaven.",
      "Adore the Eternal Son with a Pater, Ave, and Gloria; then say,",
      "I adore Thee too, Eternal Son, my God, my Lord, and my Redeemer, in union with all the heavenly host, rendering Thee infinite thanks for every grace and favour Thou hast granted to Mary, Virgin most blessed, thy well-beloved Mother, and, above all, for the gift of highest wisdom with which Thou didst glorify her on her Assumption into heaven.",
      "Adore the Holy Ghost with a Pater, Ave, and Gloria; then say,",
      "I adore Thee also, O Holy Ghost, the Paraclete, my God and my Lord, and in union with all the heavenly host I render Thee infinite thanks for every grace and favour Thou hast granted to the most blessed Virgin, thy most loving Spouse, and, above all, for that most perfect and divine charity with which Thou didst inflame her most holy and most pure heart in the act of her most glorious Assumption into heaven. In the name of thy most chaste Spouse, I humbly beg of Thee to grant me the grace of remission of all my most grievous sins which I have committed from the first moment when I was able to sin until this day, for all of which I grieve exceedingly, firmly purposing rather to die than ever again offend thy Divine Majesty; and relying on the high merits and most powerful protection of this thy most loving Spouse, I beg of Thee to grant me the most precious gift of thy grace and Divine love, by vouchsafing me those lights and special helps whereby thy eternal providence has determined to will my salvation, and to bring me to Thyself.",
      "Then say three times,",
      "Holy Mary, all ye holy men and women, saints of God, intercede for us to our Lord, that we may merit his help and be saved. Amen.",
      "To the Most Blessed Virgin.",
      "I acknowledge thee and I venerate thee, most holy Virgin, Queen of Heaven, Lady and Mistress of the Universe, as Daughter of the Eternal Father, Mother of his well-beloved Son, and most loving Spouse of the Holy Spirit. Kneeling at the feet of thy great Majesty, with all humility I pray thee, through that divine charity with which thou wast so bounteously enriched on thy Assumption into heaven, to vouchsafe me favour and pity, placing me under thy most safe and faithful protection, and receiving me into the number of thy happy and highly-favoured servants. Deign, Mother and Lady most tender, to accept my miserable heart, memory, will, powers, and senses, internal and external; govern them all in conformity to the good pleasure of thy Divine Son, as I intend by my every thought and deed to give thee glory and honour. And, by that wisdom with which thy well-beloved Son glorified thee, I pray and beseech thee to obtain for me light that I may clearly know myself and my own nothingness, and in particular my sins, that so I may hate and loathe them; and that I may discern the snares of the infernal enemy, and all his modes of attack, whether open or hidden. Above all, most tender Mother, I beg of thee the grace of N.",
      "Say three times,",
      "Virgin of all virgins,\nTo thy shelter take us,\nGentlest of the gentle,\nChaste and gentle make us.",
      "Let us pray.",
      "Pardon, O Lord, we beseech Thee, the sins of thy servants; that we, who of our own actions know not how to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord. Through the same Christ our Lord. Amen.",
      "May the almighty and merciful Lord, Father, Son, and Holy Ghost, bless and preserve us. Amen.",
    ],
    prayerType: "general",
    category: "trinitarian",
    occasions: ["assumption", "august-15", "marian-feasts"],
    summary: `Thanksgiving to each Person of the Blessed Trinity in turn for the graces given to the Blessed Virgin in her Assumption, each act preceded by an Our Father, Hail Mary and Glory Be; it goes on to an invocation of Our Lady and all the saints, a prayer of self-offering to Mary, a stanza of the Ave maris stella, and a closing collect and blessing. Raccolta no. 5, indulgenced by Pius VII in 1822. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "three-offerings-to-the-trinity-for-a-good-death",
    title: "Three Offerings of Thanksgiving to the Holy Trinity for a Good Death",
    pages: [7, 8],
    body: [
      "We offer to the Most Holy Trinity the merits of Jesus Christ, in thanksgiving for the Most Precious Blood which He shed in the garden for us; and through those merits we beseech his Divine Majesty for pardon of our sins. Pater, Ave, Gloria.",
      "We offer to the Most Holy Trinity the merits of Jesus Christ, in thanksgiving for his most precious death endured on the Cross for us; and through those merits we beseech his Divine Majesty for the remission of the pains due to our sins. Pater, Ave, Gloria.",
      "We offer to the Most Holy Trinity the merits of Jesus Christ, in thanksgiving for his unspeakable charity, in descending from heaven to earth to take human flesh, and to suffer and die for us upon the Cross; and by those merits we beseech his Divine Majesty to bring our souls to the glory of heaven after our death. Pater, Ave, Gloria.",
    ],
    prayerType: "general",
    category: "trinitarian",
    occasions: ["preparation-for-death", "daily", "trinity-sunday"],
    summary: `Three offerings to the Most Holy Trinity of the merits of Jesus Christ — in thanksgiving for the Blood He shed in the garden, for his death on the Cross and for his Incarnation — asking pardon of sin, remission of the punishment due to it, and the glory of heaven after death; each is followed by an Our Father, Hail Mary and Glory Be. Raccolta no. 6, indulgenced by Leo XII in 1823 and by Pius IX in 1876. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "omnipotence-of-the-father-prayer",
    title: "Omnipotence of the Father (Omnipotentia Patris)",
    pages: [9],
    body: [
      "Omnipotence of the Father, help my frailty, and rescue me from the depths of misery.",
      "Wisdom of the Son, direct all my thoughts, words, and actions.",
      "Love of the Holy Spirit, be the source of all the operations of my soul, so that they may be entirely conformed to the divine will.",
    ],
    latin: [
      "Omnipotentia Patris, adjuva fragilitatem meam, et e profundo miseriæ eripe me.",
      "Sapientia Filii, dirige cogitationes, verba et actiones meas omnes.",
      "Amor Spiritus Sancti, esto cunctarum animæ meæ operationum principium, quo jugiter sint divino beneplacito conformes.",
    ],
    prayerType: "general",
    category: "trinitarian",
    occasions: ["morning", "daily", "trinity-sunday"],
    summary: `A short threefold prayer asking the power of the Father to help human frailty, the wisdom of the Son to direct every thought, word and action, and the love of the Holy Spirit to be the source of all the soul's works. The Raccolta (no. 10) prints it in Latin and English; Leo XIII indulgenced it in 1890. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "acts-of-adoration-and-thanksgiving-to-the-blessed-trinity",
    title: "Acts of Adoration and Thanksgiving to the Blessed Trinity",
    pages: [9, 10],
    body: [
      "Most Holy Trinity, Father, Son, and Holy Ghost, behold us prostrate in thy divine presence. We humble ourselves profoundly, and beg of Thee pardon for our sins.",
      "We adore Thee, Omnipotent Father, and with the outpouring of our hearts we thank Thee for having given us thy divine Son Jesus to be our Redeemer, and for having left Him with us to the consummation of the world in the most august sacrament of the Holy Eucharist, in which mystery of faith and love He reveals to us the wonders of his Sacred Heart. Gloria Patri.",
      "O divine Word, most adorable Jesus, we adore Thee in thy Sacrament, and with the outpouring of our hearts we thank Thee for having taken human flesh and for having made Thyself, for our redemption, Priest and Victim in the sacrifice of the Cross, a sacrifice which, by an excess of the love of thy adorable Heart, Thou dost renew every moment on our altars throughout the world. O supreme Priest, O divine Victim, grant that we may honour the sacrifice of the most holy Eucharist with the united homage of most holy Mary and of all thy Church, in triumph, in suffering, and in warfare. We offer ourselves wholly to Thee, and since thou dost deign to have victims associated with Thee, accept our offering, and, uniting it with thine, bless us. Gloria Patri.",
      "O divine Spirit and Paraclete, we adore Thee, and with the outpouring of our hearts, we thank Thee for having, with so much love for us, wrought the ineffable blessing of the Incarnation of the divine Word, a benefit which is continually being extended and increased in the most holy Eucharist. By this adorable mystery of the love of the Sacred Heart of Jesus, grant to us and to all sinners thy grace; pour out upon us and upon all redeemed souls thy holy gifts, but in a special manner bestow them upon the holy Church, the Spouse of Jesus Christ and our Mother, upon its visible head the supreme Pontiff, upon all the Cardinals, the Bishops and pastors of souls, on all priests, and on all the other ministers of the Sanctuary. Amen. Gloria Patri.",
    ],
    prayerType: "general",
    category: "trinitarian",
    occasions: ["trinity-sunday", "adoration", "thanksgiving"],
    summary: `Acts of adoration and thanksgiving addressed to the Father for the gift of his Son in the Eucharist, to the Word made flesh as Priest and Victim, and to the Holy Spirit as author of the Incarnation, each closed with a Glory Be; the last asks the Spirit's gifts for the Church, the Pope, the bishops and all priests. Raccolta no. 11, indulgenced by Pius X in 1905. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-the-holy-trinity-i-adore-thee",
    title: "Prayer to the Holy Trinity (I adore Thee, O my God, one God in three Persons)",
    pages: [10, 11],
    body: [
      "I adore Thee, O my God, one God in three Persons; I annihilate myself before thy Majesty. Thou alone art being, life, truth, beauty, and goodness. I glorify Thee, I praise Thee, I thank Thee, and I love Thee, all incapable and unworthy as I am, in union with thy dear Son Jesus Christ, our Saviour and our Father, in the mercifulness of his heart and through his infinite merits. I wish to serve Thee, to please Thee, to obey Thee, and to love Thee always, in union with Mary immaculate, Mother of God and our Mother, loving also and serving my neighbour for thy sake. Therefore, give me thy Holy Spirit to enlighten, correct, and guide me in the way of thy commandments, and in all perfection, until we come to the happiness of heaven, where we shall glorify Thee for ever. Amen.",
    ],
    prayerType: "general",
    category: "trinitarian",
    occasions: ["trinity-sunday", "morning", "daily"],
    summary: `An act of adoration, praise and love of the one God in three Persons, made in union with Christ and with Mary Immaculate, asking the Holy Spirit's guidance in the way of the commandments until we glorify God in heaven. Raccolta no. 12, indulgenced by Pius X in 1906. ${ST_JOHN}`,
  }),

  // ── II. Almighty God ─────────────────────────────────────────────────────
  raccolta({
    slug: "chaplet-of-acts-of-the-love-of-god",
    title: "Chaplet of Acts of the Love of God",
    pages: [13, 14, 15],
    body: [
      "O my God, and Sovereign Good, would that I had always loved Thee!\n2. My God, I detest that time when I loved Thee not.\n3. How could I ever live so long without thy holy love?\n4. And Thou, too, my God, how couldst Thou bear with me?\n5. My God, I give Thee thanks for thy great patience.\n6. But now I desire to love Thee for ever.\n7. I am content rather to die than love Thee not.\n8. Take from me my life, O my God, if I am not to love Thee.\n9. The grace I beg of Thee is to love Thee ever.\n10. With thy love I shall be blessed. Gloria Patri.",
      "My God, I would see Thee loved by all.\n2. Happy should I be, could I but shed my blood that all might love Thee.\n3. He who loves Thee not is blind indeed.\n4. My God, give him thy light.\n5. Miserable indeed are they who love not Thee, the Sovereign Good.\n6. My God, let me never be one of those wretched ones who love Thee not.\n7. My God, be Thou my joy, and all my good.\n8. I would be wholly thine for ever.\n9. Who shall separate me from thy holy love?\n10. Come, all ye creatures, love ye my God. Gloria Patri.",
      "My God, I would I had a thousand hearts wherewith to love Thee.\n2. I would that I had all hearts of all men wherewith to love Thee.\n3. I would there were more worlds, that all might love Thee.\n4. How blessed would he be who could love Thee with the hearts of all possible creatures!\n5. Thou meritest, my God, to be so loved.\n6. My heart is too poor, too cold, to love Thee.\n7. Alas for the dead coldness of men in not loving their Sovereign Good!\n8. Alas for the miserable blindness of the world which knows not Thee, who art true love.\n9. O blessed inhabitants of heaven, who know and love him!\n10. O blessed necessity of loving God! Gloria Patri.",
      "My God, when will the time come that I shall burn with love for Thee?\n2. Oh, then what happiness were mine!\n3. But, since I know not how to love Thee, I will at least rejoice that there are so many others who love Thee with their whole hearts.\n4. In particular I rejoice that Thou art loved by all angels and all saints in heaven.\n5. With the hearts of all these I unite the love of my poor heart.\n6. In a special manner I intend to love Thee with the love with which those Saints who loved Thee best have loved Thee.\n7. Wherefore I intend to love Thee with the love wherewith St Mary Magdalene, St Catherine and St Teresa loved Thee.\n8. With the love wherewith St Augustine, St Dominic, St Francis Xavier, St Philip Neri and St Louis Gonzaga loved Thee.\n9. With the love wherewith thy Holy Apostles, especially St Peter, St Paul, and the beloved Disciple, loved Thee.\n10. With that same love wherewith St Joseph the great Patriarch loved Thee. Gloria Patri.",
      "Moreover, I intend to love Thee with that love wherewith Mary most holy, loved Thee when on earth.\n2. In particular with that love wherewith she loved Thee when she conceived thy Divine Son in her virgin womb, when she brought Him forth, when she suckled Him, and when she saw Him die.\n3. Yet more, I intend to love Thee with that love wherewith she loves Thee, and will love Thee for ever in heaven.\n4. But to love Thee worthily, O my God of infinite goodness, not even this love suffices.\n5. Wherefore I would love Thee as thy Son, the Divine Word made Man, did love Thee.\n6. As He loved Thee when He was born.\n7. As He loved Thee when He died upon the Cross.\n8. As He loves Thee ever in those sacred tabernacles where He lies hid.\n9. And with that love with which He loves Thee and will love Thee in heaven for all eternity.\n10. Lastly, I would fain love Thee with that love with which Thou lovest thyself; but since that is impossible, grant me, O my God, of thy tender pity, that I may love Thee as far as I know how and am able, and as Thou art pleased that I should love Thee. Amen and Amen. Gloria Patri.",
      "Let us pray.",
      "O God, who hast prepared invisible good things for them that love Thee, pour into our hearts such a desire of thy love, that we, loving Thee in all things and above all things, may attain thy heavenly promises, which exceed all that we can desire. Through Christ our Lord. Amen.",
    ],
    prayerType: "chaplet",
    category: "chaplet",
    occasions: ["daily", "act-of-love"],
    summary: `Fifty acts of the love of God in five decades of ten, each decade closed with a Glory Be, and the whole concluded with the collect Deus, qui diligentibus te. The acts move from sorrow at having loved God too late, through the desire that all creatures should love Him, to the wish to love Him with the love of the saints, of Our Lady and of Christ himself. Raccolta no. 15, indulgenced by Pius VII in 1818. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "loosen-o-lord-the-bonds-of-our-sins",
    title: "Prayer for All Needs (Loosen, O Lord, the Bonds of Our Sins)",
    pages: [16],
    body: [
      "Loosen, O Lord, we pray Thee, in thy pity, the bonds of our sins, and by the intercession of the blessed Mary ever Virgin, Mother of God, St Joseph, the blessed Apostles Peter and Paul, and all saints, keep us thy servants and our abodes in all holiness; cleanse us, our relations, kinsfolk, and acquaintances from all vices; adorn us with all virtues; grant us peace and health; repel our enemies visible and invisible; curb our carnal desires; give us healthful seasons; bestow thy charity upon our friends and our enemies; guard thy holy City; preserve our Sovereign Pontiff N.; defend all prelates, princes, and Christian people from all adversity. Let thy blessing be ever upon us, and grant to all the faithful departed eternal rest. Through Christ our Lord. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["daily", "saturday", "for-the-church"],
    summary: `A comprehensive petition asking, through the intercession of Our Lady, St Joseph, Sts Peter and Paul and all the saints, for forgiveness, holiness and virtue for ourselves and our families, for peace and health, for friends and enemies, for the Pope and the whole Christian people, and for eternal rest for the faithful departed. Raccolta no. 16, indulgenced by Leo XII in 1828. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-peace-da-pacem",
    title: "Prayer for Peace (Da pacem, Domine)",
    pages: [17, 18],
    body: [
      "Give peace, O Lord, in our days; for there is none other that fighteth for us, but only Thou, our God.\nV. Let there be peace in thy strength, O Lord.\nR. And plenty in thy strong places.",
      "Let us pray.",
      "O God, from whom proceed all holy desires, all right counsels and just works; grant unto us thy servants that peace which the world cannot give, that our hearts may be devoted to thy service, and that, being delivered from the fear of our enemies, we may pass our time in peace under thy protection. Through Christ our Lord. Amen.",
    ],
    latin: [
      "Da pacem, Domine, in diebus nostris: quia non est alius qui pugnet pro nobis nisi tu, Deus noster.\nV. Fiat pax in virtute tua.\nR. Et abundantia in turribus tuis.",
      "Oremus.",
      "Deus, a quo sancta desideria, recta consilia, et justa sunt opera: da servis tuis illam, quam mundus dare non potest, pacem: ut et corda nostra mandatis tuis dedita, et hostium sublata formidine, tempora sint tua protectione tranquilla. Per Christum Dominum nostrum. Amen.",
    ],
    prayerType: "general",
    category: "peace",
    occasions: ["peace", "times-of-trouble", "vespers"],
    summary: `The antiphon Da pacem, Domine with its versicle, followed by the collect for peace Deus, a quo sancta desideria that the Roman Missal uses in the votive Mass for peace. The Raccolta (no. 18) prints it in Latin and English; Pius IX indulgenced it in 1848. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "offering-of-the-masses-of-the-world-at-the-beginning-of-the-day",
    title: "Offering of the Masses of the World at the Beginning of the Day",
    pages: [18, 19],
    body: [
      "O Lord God Almighty, behold me prostrate before Thee in order to appease Thee, and to honour thy Divine Majesty, in the name of all creatures. But how can I do this who am myself but a poor sinner? Nay, but I both can and will, knowing that Thou dost make it thy boast to be called Father of mercies, and for love of us hast given thy only-begotten Son, who sacrificed Himself upon the Cross, and for our sake doth continually renew that sacrifice of Himself upon our altars. And therefore do I—sinner, but penitent; poor, but rich in Jesus Christ—present myself before Thee, and, with the love of angels and of all thy saints, and with the tender affection of the Immaculate Heart of Mary, I offer to Thee in the name of all creatures the Masses which are now being celebrated, together with all those which have been celebrated, and which shall be celebrated to the end of the world. Moreover, I intend to renew the offering of them every moment of this day and of all my life, that I may thereby render to thy infinite Majesty an honour and a glory worthy of Thee, thus to appease thy indignation, to satisfy thy justice for our many sins, to render Thee thanks in proportion to thy benefits, and to implore thy mercies for myself and for all sinners, for all the faithful, living and dead, for thy whole Church, and principally for its visible Head, the Sovereign Pontiff, and lastly for all poor schismatics, heretics, and infidels, that they also may be converted and save their souls.",
    ],
    prayerType: "morning",
    category: "eucharistic",
    occasions: ["morning", "daily", "mass"],
    summary: `A morning offering, made in the name of all creatures, of every Mass being celebrated, already celebrated and yet to be celebrated throughout the world, to honour God, make satisfaction for sin, give thanks and implore mercy for the living and the dead, for the Church and for the Pope. With the offering during Mass that follows it in the Raccolta (no. 19), it was indulgenced by Pius IX in 1860. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "offering-of-the-holy-sacrifice-during-mass",
    title:
      "Offering of the Holy Sacrifice during Mass (Eternal Father, I offer to Thee the sacrifice)",
    pages: [19],
    body: [
      "During, or (in the case of priests) before Mass.",
      "Eternal Father, I offer to Thee the sacrifice which thy beloved Son Jesus made of Himself upon the Cross, and which He now renews upon this altar; I offer it to Thee in the name of all creatures, together with the Masses which have been celebrated, and which shall be celebrated in the whole world, in order to adore Thee, and to give Thee the honour which Thou dost deserve, to render to Thee due thanks for thy innumerable benefits, to appease thy anger, which our many sins have provoked, and to give Thee due satisfaction for them; to entreat Thee also for myself, for the Church, for the whole world, and for the blessed souls in purgatory. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "before-mass"],
    summary: `An offering to the Father, made during Mass (or by a priest before it), of the sacrifice of the Cross renewed on the altar together with every Mass in the world, for the ends of the sacrifice — adoration, thanksgiving, satisfaction for sin and petition — and for the Church, the world and the souls in purgatory. Raccolta no. 19, indulgenced by Pius IX in 1860. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "offering-of-the-blood-passion-and-death-of-jesus",
    title: "Offering of the Blood, Passion and Death of Jesus Christ",
    pages: [20],
    body: [
      "Eternal Father, we offer Thee the Blood, Passion, and Death of Jesus Christ, and the sorrows of the most holy Mary and St Joseph, in payment for our sins, in suffrage for the holy souls in purgatory, for the wants of our holy Mother the Church, and for the conversion of sinners. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["daily", "all-souls", "precious-blood"],
    summary: `A short offering to the Eternal Father of the Blood, Passion and Death of Christ and of the sorrows of Our Lady and St Joseph, in payment for sin, for the holy souls, for the needs of the Church and for the conversion of sinners. Raccolta no. 20, indulgenced by Pius IX in 1860. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "morning-offering-of-the-days-works-eternal-god",
    title: "Morning Offering of the Day's Works (Eternal God, behold me prostrate)",
    pages: [20],
    body: [
      "Eternal God, behold me prostrate before the immensity of thy majesty. I humbly adore Thee, and offer Thee all my thoughts, words, and works of this day. I intend to do everything for love of Thee, for thy glory, and for the fulfilment of thy divine will; in order to serve, praise, and bless Thee, to be enlightened in the mysteries of our holy faith, to secure my salvation, and to hope in thy mercy; to satisfy the divine justice for my many grievous sins, to assist the holy souls in purgatory, and to obtain the grace of a true conversion for all sinners. I desire, in fine, to do everything in union with that most pure intention which Jesus and Mary had during life, and which the saints now have in heaven, and the just on earth. Would that I could write down this intention with my own blood, and repeat it as often as there be moments in eternity! O my God, accept my goodwill; grant me thy holy blessing and efficacious grace never to commit a mortal sin throughout the course of my life, but particularly on this day, on which I desire and purpose to gain all the indulgences which it is possible for me to gain, and to be present in spirit at all the Masses which will be celebrated to-day in the whole world, that I may apply them to the holy souls in purgatory, and free them from all pain. Amen.",
    ],
    prayerType: "morning",
    category: "general",
    occasions: ["morning", "daily", "all-souls"],
    summary: `A morning offering of the day's thoughts, words and works, made in union with the intention of Jesus and Mary and of the saints, with the resolve to avoid all mortal sin and to assist in spirit at every Mass of the day on behalf of the holy souls in purgatory. Raccolta no. 21, indulgenced by Pius IX in 1867. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "act-of-faith-immaculate-conception-and-infallibility",
    title: "Act of Faith in the Immaculate Conception and Papal Infallibility",
    pages: [21],
    body: [
      "O my God! I believe in Thee; I believe all that Thou hast revealed, and that the holy Catholic Church proposes for my belief. I believe, first, that the most blessed Virgin is truly the Mother of God; I believe firmly, and with all certainty, that she is at the same time mother and virgin, and that she is free from even the least actual sin. I also believe most firmly, and with all certainty, that by a singular grace and privilege of Almighty God, in view of the merits of Jesus Christ, the Saviour of the human race, Mary was, in the first instant of her conception, preserved free from all stain of original sin. I believe most firmly and with all certainty that when the Roman Pontiff speaks ex cathedra—that is, when, fulfilling the office of chief pastor and teacher of all Christians, he, in virtue of his supreme and apostolic authority, defines a doctrine concerning faith or morals to be held by the universal Church—by the divine assistance, promised him in the person of St Peter, possesses that infallibility with which the divine Redeemer wished his Church to be endowed when defining matters of faith or morals; and, therefore, that such definitions of the Roman Pontiff are, of themselves, and not from the consent of the Church, irreformable. I believe all this, because thy holy Church, which is the pillar and ground of truth, which has never erred and can never err, proposes it to be believed.",
    ],
    prayerType: "act",
    category: "theological-virtue",
    occasions: ["daily", "december-8"],
    summary: `An act of faith in all that God has revealed, naming in particular the divine motherhood and virginity of Mary, her freedom from all actual sin and her Immaculate Conception, and the infallibility of the Roman Pontiff speaking ex cathedra as the First Vatican Council defined it in 1870. Pius IX indulgenced it in January 1871; Raccolta no. 22. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-of-saint-bonaventure-domine-sancte",
    title:
      "Prayer of Saint Bonaventure for the Love of God Alone (Domine sancte, Pater omnipotens)",
    pages: [21, 22],
    body: [
      "O holy Lord, almighty Father, eternal God! through thy liberality and that of thy Son, who for me endured suffering and death, through the surpassing holiness of His Mother, and through the merits of blessed Francis, and of all the saints, grant me, a sinner, undeserving of all thy benefits, that I may love Thee alone, and always thirst for thy love; that I may constantly feel in my heart the benefit of thy Passion; that I may acknowledge my misery, and desire to be trampled upon and despised by all men; that nothing but sin may sadden my heart. Amen.",
    ],
    latin: [
      "Domine sancte, Pater omnipotens, æterne Deus, propter tuam largitatem et Filii tui, qui pro me sustinuit passionem et mortem, et matris ejus excellentissimam sanctitatem, atque beati Francisci, et omnium sanctorum merita, concede mihi peccatori, et omni tuo beneficio indigno, ut te solum diligam, tuo amore semper sitiam, beneficium passionis continuo in corde habeam, meam miseriam recognoscam, et ab omnibus conculcari et contemni cupiam: nihil me contristet nisi culpa. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["daily", "lent", "passion"],
    relatedSaints: ["saint-bonaventure", "saint-francis-of-assisi"],
    summary: `A prayer the Raccolta gives as St Bonaventure's, asking, through the Passion of Christ, the holiness of his Mother and the merits of St Francis and all the saints, to love God alone and thirst always for his love, to keep the Passion in the heart, and to be saddened by nothing but sin. The Raccolta (no. 23) prints it in Latin and English; Pius IX indulgenced it in 1874. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-remain-faithful-unto-death",
    title: "Prayer to Remain Faithful unto Death (O Lord Almighty, who permittest evil)",
    pages: [22],
    body: [
      "O Lord Almighty, who permittest evil to draw good therefrom, hear our humble prayers, and grant that we remain faithful to Thee unto death. Grant us also, through the intercession of most holy Mary, the strength ever to conform ourselves to thy most holy Will.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["trust", "suffering", "daily"],
    summary: `A short petition to the Lord who draws good out of evil, asking for faithfulness until death and, through Mary's intercession, the strength always to conform ourselves to his will. Raccolta no. 24, indulgenced by Pius IX in 1862 and by Leo XIII in 1879. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-peace-thou-seest-o-lord",
    title: "Prayer for Peace in the World (Thou seest, O Lord)",
    pages: [23, 24],
    body: [
      "Thou seest, O Lord, how on all sides the winds are let loose upon us, and the sea is growing rough with the violent commotion of the waves. Do Thou, we beseech Thee, who alone art able, command the winds and the waves. Restore to mankind that true peace which the world cannot give, the peace which comes of good order. Let men impelled by thy grace return to a right and orderly course of life, practising again, as they ought, love towards God, justice and charity in dealing with their neighbour, temperance and self-control in their own lives. May thy kingdom come, and may those who now vainly and laboriously seek for truth and salvation, far removed from Thee, understand that they must live as thy servants in subjection to Thee. Thy laws show forth thy justice and paternal gentleness, and to enable us to keep them, Thou dost freely supply by thy grace the ready means. The life of man on earth is a warfare, but “Thou dost thyself behold the strife, Thou dost help man to conquer, raise him when he falls, and crown him when he is victorious.”—St. Aug. in Ps. 32.",
    ],
    prayerType: "intercession",
    category: "peace",
    occasions: ["peace", "times-of-trouble"],
    summary: `A prayer asking the Lord, who alone commands the winds and the waves, to restore to mankind the peace that comes of good order — love of God, justice and charity toward one's neighbour, and self-control — and closing with words of St Augustine on Psalm 32 about God's help in the warfare of life. Raccolta no. 26, indulgenced by Leo XIII in January 1889. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-on-the-transfiguration",
    title: "Prayer on the Transfiguration",
    pages: [24],
    body: [
      "O Lord, who in the mystery of the glorious Transfiguration of thy Divine Son, didst deign to make resplendent the truth of the holy Catholic Faith, and to confirm miraculously, by thy very word, spoken from a cloud, our perfect adoption as thy sons; we humbly beg of Thee to grant that we may in truth become coheirs of this same King of Glory, and share in thy everlasting happiness. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["transfiguration", "august-6", "lent"],
    summary: `A prayer recalling how, at the Transfiguration, the Father's voice from the cloud confirmed our adoption as his sons, and asking that we may become co-heirs of the King of Glory. Raccolta no. 27, indulgenced by Leo XIII in December 1889. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-the-supreme-pontiff",
    title: "Prayer for the Supreme Pontiff (O Lord, in union with millions of believers)",
    pages: [24, 25],
    body: [
      "O Lord, in union with millions of believers, and prostrate here at thy feet, we pray Thee to save, defend, and long preserve the Vicar of Christ, the Father of the glorious society of souls, our own Father. To-day and every day he prays for us, fervently offering to Thee the sacred victim of love and peace. Turn then, O Lord, thy loving eyes upon us, who forgetful as it were of ourselves pray now above all things for him. Unite our prayers with his, and receive them into the bosom of thy infinite mercy, as a most sweet perfume of that living and efficacious charity, in which the children of the Church are united to their Father. All that he asks of Thee to-day we too ask for with him. Whether he sorrows or rejoices, or when he hopes or offers the victim of love for his people, we would be united with him. We desire that the utterance of our souls should be one with his. Mercifully grant, O Lord, that no one of us be far from his mind and heart during the hour of his prayer, and when he offers to Thee the sacrifice of thy blessed Son. And in the moment that he, our most revered Pontiff, holding in his hands the very body of Jesus Christ, shall say to the people over the Chalice of benediction the words: The peace of the Lord be ever with you, do Thou, O Lord, cause thy most sweet peace to descend with a new and manifest power into our hearts, and upon all the nations of mankind. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["for-the-church", "daily"],
    summary: `A prayer for the Pope offered in union with the faithful throughout the world, asking that their prayers be joined to his and that, when he gives the peace of the Lord over the chalice at Mass, God's peace may descend on all nations. Raccolta no. 28, indulgenced by Leo XIII in 1896. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "fiat-ejaculation-of-resignation-to-the-will-of-god",
    title: "Prayer of Resignation to the Will of God (Fiat, laudetur)",
    pages: [25],
    body: [
      "May the most just, most high, and most adorable will of God be in all things done, praised, and magnified for ever.",
    ],
    latin: [
      "Fiat, laudetur, atque in æternum superexaltetur justissima, altissima, et amabilissima voluntas Dei in omnibus.",
    ],
    prayerType: "act",
    category: "general",
    occasions: ["trust", "suffering", "preparation-for-death"],
    summary: `A one-sentence act of conformity to the will of God, Fiat, laudetur, atque in aeternum superexaltetur, which the Raccolta (no. 29) prints in Latin and English as an "ejaculation of resignation" and connects in particular with accepting death from God's hands. Pius VII indulgenced it in 1818. ${ST_JOHN}`,
  }),

  // ── III. The Holy Ghost ──────────────────────────────────────────────────
  raccolta({
    slug: "prayer-for-the-church-o-holy-spirit-creator",
    title: "Prayer for the Church (O Holy Spirit, Creator)",
    pages: [31],
    body: [
      "O Holy Spirit, Creator, be propitious to the Catholic Church; and by thy heavenly power make it strong and secure against the attacks of its enemies; and renew in charity and grace the spirit of thy servants, whom Thou hast anointed, that they may glorify Thee and the Father and his only begotten Son, Jesus Christ, our Lord. Amen.",
    ],
    latin: [
      "O Creator Sancte Spiritus, adesto propitius Ecclesiæ Catholicæ, eamque contra inimicorum incursus tua superna virtute robora et confirma; tua caritate, et gratia spiritum famulorum tuorum, quos unxisti, renova, ut in te clarificent Patrem Filiumque ejus unigenitum Jesum Christum Dominum nostrum. Amen.",
    ],
    prayerType: "intercession",
    category: "trinitarian",
    occasions: ["pentecost", "for-the-church"],
    summary: `A prayer to the Holy Spirit, the Creator, to make the Church strong against her enemies and to renew in charity and grace the spirit of his anointed servants, so that they may glorify the Father and the Son. The Raccolta (no. 39) prints it in Latin and English; Leo XIII indulgenced it in 1889. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-the-propagation-of-the-faith-spirit-of-truth",
    title: "Prayer for the Propagation of the Faith (O Holy Spirit, Spirit of Truth)",
    pages: [31],
    body: [
      "O Holy Spirit, Spirit of Truth, come into our hearts; shed the brightness of thy light on all nations, that they may be one in Faith and pleasing to Thee.",
    ],
    latin: [
      "Spiritus Sancte, Spiritus veritatis, veni in corda nostra; da populis claritatem lucis tuæ, ut in fidei unitate tibi complaceant.",
    ],
    prayerType: "intercession",
    category: "trinitarian",
    occasions: ["pentecost", "missions", "for-the-church"],
    summary: `A brief prayer to the Spirit of Truth to shed the brightness of his light on all nations, so that they may be one in faith and pleasing to God. The Raccolta (no. 40) prints it in Latin and English; Leo XIII indulgenced it in 1897. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "chaplet-of-the-holy-spirit-prayers",
    title: "The Prayers of the Chaplet of the Holy Spirit",
    pages: [32, 33, 34],
    body: [
      "Short Act of Contrition.",
      "I grieve, O my God, for having sinned against Thee, because Thou art so good; and with the assistance of thy grace I will never sin again.",
      "Come, O Creator Spirit blest, etc.",
      "V. Send forth thy Spirit, and they shall be created.\nR. And Thou shalt renew the face of the earth.",
      "Let us pray.",
      "O God, who didst instruct the hearts of the faithful by the light of the Holy Spirit, grant us in the same Spirit to be truly wise and ever to rejoice in His consolation, through Jesus Christ our Lord. Amen.",
      "First Mystery. Jesus was conceived of the Virgin Mary by the power of the Holy Ghost.\nMeditation. “The Holy Spirit shall descend upon thee, and the power of the most high shall overshadow thee, and therefore the Holy one that shall be born of thee shall be called the Son of God” (St Luke i, 35).\nApplication. Pray earnestly for the help of the divine Spirit and, through the intercession of Mary, for grace to imitate the virtues of Jesus Christ, who is the example of all virtue, and so to be conformed to the image of the Son of God. Pater and Ave once, Gloria seven times.",
      "Second Mystery. The Spirit of God rests upon Jesus.\nMeditation. “Jesus being baptized came forth immediately from the water, and behold the Heavens were opened, and He saw the Spirit of God descend like a dove, and coming, stand over Him” (St Matt. iii, 16).\nApplication. Hold in the highest esteem the priceless gift of sanctifying grace, which the Holy Spirit infused into your heart in Baptism. Keep the promises to the observance of which you have bound yourself. By continual exercise, increase Faith, Hope and Charity. Live always as becomes children of God, and members of his true Church, in order that after this life has run its course, you may be worthy to receive your heavenly inheritance. Pater and Ave once, Gloria seven times.",
      "Third Mystery. Jesus was conducted by the Spirit into the desert.\nMeditation. “But Jesus, full of the Holy Spirit, retired from the Jordan, and was conducted by the Spirit into the desert for forty days; and was tempted by the Devil” (St Luke iv, 1, 2).\nApplication. Be always grateful for the seven gifts given to you by the Holy Spirit in Confirmation; for the spirit of wisdom and understanding, of counsel and fortitude, of knowledge and piety, and of the fear of the Lord. Faithfully adhere to your divine Guide, acting manfully in all the dangers of this life and in temptation, as becomes a perfect Christian and a brave athlete of Jesus Christ. Pater and Ave once, Gloria seven times.",
      "Fourth Mystery. The Holy Spirit in the Church.\nMeditation. “And suddenly there was a sound from Heaven as of a mighty wind coming where they were assembled; and they were all filled with the Holy Spirit, and began to discourse of the wonderful works of God” (Acts ii, 2, 4, 11).\nApplication. Thank God for making you a child of his Church which the divine Spirit, sent into the world on the day of Pentecost, ever vivifies and rules. Hear and obey the Supreme Pontiff, who by the assistance of the Holy Spirit is the infallible teacher, and the Church, which is the pillar and foundation of truth. Hold fast her doctrines, maintain her cause, defend her rights. Pater and Ave once, Gloria seven times.",
      "Fifth Mystery. The Holy Spirit in the soul of the just man.\nMeditation. “Do you not know that your members are the temple of the Holy Spirit, who is in you” (1 Cor. vi, 19).\n“Do not extinguish the Spirit” (1 Thess. v, 19).\n“And grieve not the Holy Spirit of God, whereby you are sealed unto the day of redemption” (Ephes. iv, 30).\nApplication. Be ever mindful of the Holy Spirit who is in you, and watch with all possible care over purity of soul and body. Faithfully obey his divine inspirations, so as to gather therefrom the fruits of the Spirit: Charity, joy, peace, benignity, goodness, longanimity, mildness, faith, modesty, continency, chastity. Pater and Ave once, Gloria seven times.",
      "End with the Creed, as a profession of faith, and Pater and Ave once according to the intention of the Pope.",
    ],
    prayerType: "chaplet",
    category: "chaplet",
    occasions: ["pentecost", "confirmation", "novena"],
    summary: `The full text of the Chaplet of the Holy Spirit as the Raccolta gives it (no. 42): an act of contrition, the Veni Creator, the versicle and collect of the Holy Spirit, and five mysteries — the Incarnation, the Baptism of Christ, the temptation in the desert, Pentecost, and the Spirit's indwelling in the just — each with a meditation from Scripture, a practical application, an Our Father, a Hail Mary and seven Glory Bes, ending with the Creed. Leo XIII indulgenced it by brief in 1902. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-the-holy-spirit-divine-spirit-of-light-and-love",
    title: "Prayer to the Holy Spirit (Divine Spirit of Light and Love)",
    pages: [34],
    body: [
      "O Holy Spirit, divine spirit of light and love, I consecrate to Thee my understanding, heart and will, my whole being for time and for eternity. May my understanding be always submissive to thy heavenly inspirations, and to the teaching of the Catholic Church, of which Thou art the infallible Guide; may my heart be ever inflamed with love of God and of my neighbour; may my will be ever conformed to the divine will, and may my whole life be a faithful imitation of the life and virtues of our Lord and Saviour Jesus Christ, to whom with the Father and Thee be honour and glory for ever. Amen.",
    ],
    prayerType: "consecration",
    category: "trinitarian",
    occasions: ["pentecost", "confirmation", "daily"],
    summary: `A consecration of understanding, heart and will to the Holy Spirit, asking that the mind be submissive to his inspirations and to the teaching of the Church, the heart inflamed with love of God and neighbour, and the whole life an imitation of Christ. Raccolta no. 43, indulgenced by Pius X in 1908. ${ST_JOHN}`,
  }),

  // ── IV. Jesus Christ ─────────────────────────────────────────────────────
  raccolta({
    slug: "rosary-of-our-lord",
    title: "The Rosary of Our Lord (Camaldolese Chaplet)",
    pages: [36, 37, 38],
    body: [
      "Begin with an act of contrition.",
      "First Decade.\nThe Archangel Gabriel makes known to Mary the Incarnation of the Divine Word in her pure womb. Ave Maria.\n1. The Son of God made man is born of Mary the Virgin in a stable. Pater noster.\n2. The Angels rejoice and sing Gloria in excelsis Deo. Pater noster.\n3. The shepherds hear the Angels' tidings, and come and adore Him. Pater noster.\n4. He is circumcised the eighth day, and called by the most holy Name of Jesus. Pater noster.\n5. Is adored by the Magi with offerings of gold, frankincense, and myrrh. Pater noster.\n6. Is presented in the Temple, and foretold to be the Saviour of the world. Pater noster.\n7. Flees from the persecution of Herod, and is carried into Egypt. Pater noster.\n8. Herod finds him not, and murders the Innocents. Pater noster.\n9. He is carried back by Joseph and his Mother into Nazareth, his home. Pater noster.\n10. Disputes in the Temple with the doctors, being twelve years old. Pater noster.\n(Add Eternal rest, etc., if said for the departed.)",
      "Second Decade.\nJesus is most obedient to the Blessed Virgin his Mother, and to St Joseph. Ave Maria.\n1. When thirty years old, He is baptized by John in the Jordan. Pater noster.\n2. Fasts forty days in the desert, and overcomes the tempter. Pater noster.\n3. Practises and preaches his own holy law, whereby is life eternal. Pater noster.\n4. Calls his disciples, who forthwith leave all and follow Him. Pater noster.\n5. Works his first miracle of changing water into wine. Pater noster.\n6. Heals the sick, makes the lame to walk, gives hearing to the deaf, sight to the blind, life to the dead. Pater noster.\n7. Converts sinful men and women, and pardons their sins. Pater noster.\n8. When the Jews persecute Him even unto death, He chastises them not, but sweetly chides them. Pater noster.\n9. Is transfigured on Mount Thabor, in the presence of Peter, James and John. Pater noster.\n10. Enters triumphant into Jerusalem sitting on an ass's colt, and drives the profaners from the Temple. Pater noster.\n(Eternal rest, etc., as above.)",
      "Third Decade.\nJesus takes leave of his most holy Mother before He goes to die for our salvation. Ave Maria.\n1. Celebrates the last Paschal Supper, washes the Apostles' feet. Pater noster.\n2. Institutes the most holy Sacrament of the Eucharist. Pater noster.\n3. Prays in the garden, sweats blood, and is comforted by an angel. Pater noster.\n4. Is betrayed by Judas with a kiss, is taken and bound by the officers of justice as a great malefactor. Pater noster.\n5. Is falsely accused, is buffeted and spit upon, and shamefully used before four tribunals. Pater noster.\n6. Looks tenderly on Peter after he had thrice denied Him, and converts him; whilst Judas despairs, hangs himself, and is lost. Pater noster.\n7. Is cruelly scourged at the pillar, and receives innumerable blows. Pater noster.\n8. Is crowned with thorns, shown to the people, who cry, Crucify Him! Crucify Him! Pater noster.\n9. Is condemned to die, carries the heavy cross with grievous pain upon his shoulders to Mount Calvary. Pater noster.\n10. Is crucified between two thieves, dies after three hours' most painful agony, is wounded in the side with a lance, and is buried. Pater noster.\n(Eternal rest, etc., as above.)",
      "Jesus rises the third day, and visits first of all Mary his most holy Mother. Ave Maria.\n1. Appears to the three Marys, and bids them tell the disciples they have seen Him risen from the dead. Pater noster.\n2. Appears to the disciples, shows them his most holy Wounds, makes Thomas touch them. Pater noster.\n3. The fortieth day after his resurrection, blesses most holy Mary his Mother and all his disciples; then ascends into heaven. Pater noster.\nLet us pray to the most holy Virgin to obtain for us also the blessing of her divine Son Jesus Christ, now and at the hour of our death. Ave Maria.\n(Eternal rest, etc., as above.)",
      "Then say the Credo in honour of the holy Apostles.",
    ],
    prayerType: "chaplet",
    category: "chaplet",
    occasions: ["daily", "rosary", "all-souls"],
    summary: `The chaplet of the Camaldolese monks: thirty-three Our Fathers in remembrance of the thirty-three years of Christ's life on earth and five Hail Marys in honour of his five wounds, each Our Father joined to a short mystery of his birth, hidden life, ministry, Passion and Resurrection, ending with the Creed in honour of the Apostles. The Raccolta (no. 44) records indulgences granted for it by Clement X in 1674 and Leo XII in 1824. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-a-holy-death-divine-jesus",
    title: "Prayer for a Holy Death (Divine Jesus, Incarnate Son of God)",
    pages: [43, 44],
    body: [
      "Divine Jesus, incarnate Son of God, who for our salvation didst vouchsafe to be born in a stable, to pass thy life in poverty, trials, and misery, and to die amid the sufferings of the Cross, I entreat Thee in the hour of my death, say to thy divine Father: “Father, forgive him”; say to thy beloved Mother: “behold thy son”; say to my soul: “this day thou shalt be with me in Paradise.” My God, my God, forsake me not in that hour. “I thirst”: truly, my God, my soul thirsts after Thee, who art the fountain of living waters. My life passes like a shadow; yet a little while and all will be consummated. Wherefore, O my adorable Saviour, from this moment, for all eternity, “into thy hands I commend my spirit.” Lord Jesus, receive my soul. Amen.",
    ],
    latin: [
      "Divine Jesu, Fili Dei incarnate, qui pro nostra salute in stabulo nasci, vitam in paupertate, ærumnis et miseria degere, et in crucis doloribus mori dignatus es, divino tuo Patri dic, quæso, in momento mortis meæ: Pater ignosce ei; dic matri tuæ dilectæ: Ecce filius tuus; dic animæ meæ: Hodie eris mecum in Paradiso. Deus meus, Deus meus, ne derelinquas me in illa hora. Sitio: utique, Deus meus, anima mea sitit ad te, qui es fons aquarum viventium. Vita mea præterit velut umbra; adhuc modicum et consummata erunt omnia. Quapropter, O Salvator mi adorabilis, ex hoc momento in omnem æternitatem, in manus tuas commendo spiritum meum. Domine Jesu, accipe animam meam. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["preparation-for-death", "good-friday", "for-the-dying"],
    summary: `A prayer for the hour of death built on the seven last words of Christ from the Cross, asking Him to speak them over the dying soul — the Father's forgiveness, his Mother's care, the promise of Paradise — and ending with the commendation of the spirit into his hands. The Raccolta (no. 47) prints it in Latin and English; Pius IX indulgenced it in 1856. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "o-jesus-living-in-mary",
    title: "O Jesus, Living in Mary (O Jesu vivens in Maria)",
    pages: [44, 45],
    body: [
      "O Jesus, who dost live in Mary, come and live in thy servants, in the spirit of thine own holiness, in the fullness of thy power, in the reality of thy virtues, in the perfection of thy ways, in the communion of thy Mysteries; have Thou dominion over every adverse power, in thine own Spirit, to the glory of thy Father. Amen.",
    ],
    latin: [
      "O Jesu, vivens in Maria, veni et vive in famulis tuis, in Spiritu sanctitatis tuæ, in plenitudine virtutis tuæ, in veritate virtutum tuarum, in perfectione viarum tuarum, in communione Mysteriorum tuorum, dominare omni adversæ potestati in Spiritu tuo ad gloriam Patris. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["daily", "marian-consecration"],
    summary: `A prayer of the seventeenth-century French school of spirituality, long said in the seminaries of Saint-Sulpice founded by Jean-Jacques Olier, asking Jesus who lives in Mary to come and live in his servants by his Spirit, his virtues and his mysteries. The Raccolta (no. 48) prints it in Latin and English; Pius IX indulgenced it in 1859. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-o-most-compassionate-jesus",
    title: "Prayer to the Most Compassionate Jesus (O clementissime Jesu)",
    pages: [45],
    body: [
      "O most compassionate Jesus! Thou alone art our salvation, our life, and our resurrection. We implore Thee, therefore, do not forsake us in our needs and afflictions, but by the agony of thy most Sacred Heart, & by the sorrows of thy immaculate Mother, succour thy servants whom Thou hast redeemed by thy most Precious Blood.",
    ],
    latin: [
      "O clementissime Jesu, salus, vita, resurrectio nostra tu solus es. Te ergo quæsumus ne derelinquas nos in angustiis et perturbationibus nostris, sed per agoniam cordis tui sanctissimi et per dolores matris tuæ immaculatæ tuis famulis subveni, quos pretioso sanguine redemisti.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["trust", "suffering", "sacred-heart"],
    summary: `A short prayer to Jesus, our salvation, life and resurrection, asking Him not to forsake us in our needs and afflictions, through the agony of his Sacred Heart and the sorrows of his Mother. The Raccolta (no. 49) prints it in Latin and English; Pius IX indulgenced it in 1870. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-the-holy-name-o-good-jesu",
    title: "Prayer to the Holy Name of Jesus (O Good Jesu! O Most Tender Jesu!)",
    pages: [45, 46],
    body: [
      "O good Jesu! O most tender Jesu! O most sweet Jesu! O Jesu, Son of Mary the Virgin, full of mercy and kindness! O sweet Jesu, according to thy great mercy, have pity on me! O most merciful Jesu, I entreat Thee by that Precious Blood of thine, which Thou didst will to pour forth for sinners, to wash away all my iniquities, and to look upon me, poor and unworthy as I am, asking humbly pardon of Thee, and invoking this holy Name of Jesus. O Name of Jesus, sweet Name! Name of Jesus, Name of joy! Name of Jesus, Name of strength! Nay, what meaneth the Name of Jesus but Saviour? Wherefore, O Jesus, by thine own holy Name, be to me Jesus, and save me. Suffer me not to be lost—me, whom Thou didst create out of nothing. O good Jesu, let not my iniquity destroy what thy almighty goodness made. O sweet Jesu, recognize what is thine own, and wipe away from me what is not of Thee! O most kind Jesu, have pity on me while it is the time of pity, and condemn me not when it is the time of judgment. The dead shall not praise Thee, Lord Jesu, nor all those who go down into hell. O most loving Jesu! O Jesu, most longed for by thine own! O most gentle Jesu! Jesu, Jesu, Jesu, let me enter into the number of thine elect. O Jesu, salvation of those who believe in Thee; Jesu, consolation of those who fly to Thee. Jesu, Son of Mary the Virgin, pour into me grace, wisdom, charity, chastity, and humility, that I may be able perfectly to love Thee, to praise Thee, to enjoy Thee, to serve Thee, and make my boast in Thee, together with all those who invoke thy Name, which is Jesus. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["holy-name-of-jesus", "january", "daily"],
    summary: `A prayer of invocation of the Holy Name that begs Jesus, by his Precious Blood, to wash away sin and to be, according to his Name, a Saviour — "what meaneth the Name of Jesus but Saviour?" — and asks for grace, wisdom, charity, chastity and humility. Raccolta no. 50, indulgenced by Pius IX in 1876. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-of-saint-thomas-aquinas-concede-mihi",
    title: "Prayer of Saint Thomas Aquinas to Fulfil God's Will (Concede mihi, misericors Deus)",
    pages: [46, 47],
    body: [
      "O merciful God, grant that I may eagerly desire, carefully search out, truthfully acknowledge, and ever perfectly fulfil all things which are pleasing to Thee, to the praise and glory of thy Name. Amen.",
    ],
    latin: [
      "Concede mihi, misericors Deus, quæ tibi placita sunt ardenter concupiscere, prudenter investigare, veraciter agnoscere et perfecte adimplere ad laudem et gloriam nominis tui. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["before-study", "study", "daily"],
    relatedSaints: ["saint-thomas-aquinas"],
    summary: `St Thomas Aquinas's short prayer to desire ardently, search out carefully, acknowledge truly and fulfil perfectly whatever is pleasing to God. The Raccolta (no. 51) directs that it be said before study or class and prints it in Latin and English; Leo XIII indulgenced it in 1879. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "petitions-of-saint-augustine",
    title: "Petitions of Saint Augustine (Noverim me, noverim te)",
    pages: [48, 49],
    body: [
      "Lord Jesus, may I know myself and know Thee.\nAnd desire nothing save only Thee.\nMay I hate myself and love Thee.\nMay I do everything for the sake of Thee.\nMay I humble myself and exalt Thee.\nMay I think of nothing except Thee.\nMay I die to myself and live in Thee.\nMay I receive whatever happens as from Thee.\nMay I banish self and follow Thee.\nAnd ever desire to follow Thee.\nMay I fly from myself and fly to Thee,\nThat I may deserve to be defended by Thee.\nMay I fear for myself and fear Thee,\nAnd be among those who are chosen by Thee.\nMay I distrust myself and trust in Thee.\nMay I be willing to obey on account of Thee.\nMay I cling to nothing but to Thee.\nMay I be poor for the sake of Thee.\nLook upon me that I may love Thee.\nCall me that I may see Thee,\nAnd ever and ever enjoy Thee. Amen.",
    ],
    latin: [
      "Domine Jesu, noverim me, noverim te,\nNec aliquid cupiam nisi te.\nOderim me et amem te.\nOmnia agam propter te.\nHumiliem me, exaltem te.\nNihil cogitem nisi te.\nMortificem me et vivam in te.\nQuæcunque eveniant accipiam a te.\nPersequar me, sequar te.\nSemperque optem sequi te.\nFugiam me, confugiam ad te.\nUt merear defendi a te.\nTimeam mihi, timeam te,\nEt sim inter electos a te.\nDiffidam mihi, fidam in te.\nObedire velim propter te.\nAd nihil afficiar nisi ad te.\nEt pauper sim propter te.\nAspice me, ut diligam te.\nVoca me ut videam te.\nEt in æternum fruar te. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["daily", "humility", "lent"],
    relatedSaints: ["saint-augustine-of-hippo"],
    summary: `The petitions Noverim me, noverim te, which the Raccolta gives as St Augustine's: a chain of short requests to know oneself and to know Christ, to die to self and live in Him, and to enjoy Him for ever. The Raccolta (no. 53) prints them in Latin and English; Leo XIII indulgenced them in 1883. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-grace-to-do-the-will-of-god",
    title: "Prayer for Grace to Do the Will of God (from the Imitation of Christ)",
    pages: [54, 55],
    body: [
      "Grant me, most kind Jesus, thy grace, that it may abide with me, labour with me, and persevere with me to the end.",
      "Grant me ever to desire and to will that which is the more acceptable to Thee, and pleases Thee more dearly.",
      "May thy will be mine, and my will ever follow thine, and be in closest accord with it.",
      "May it be my one care to will and to be unwilling with Thee, and may I be unable to will or not will anything but what Thou willest or willest not.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["daily", "discernment", "trust"],
    summary: `A prayer drawn from the Imitation of Christ (Book III, chapter 15) asking Jesus for grace to abide and persevere with us, and for a will so united with his that we can will nothing but what He wills. Raccolta no. 57, indulgenced by Leo XIII in 1886. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-the-preservation-of-faith",
    title: "Prayer for the Preservation of the Faith",
    pages: [55, 56],
    body: [
      "O my Redeemer, will that terrible moment ever come, when but few Christians will be found animated with a spirit of faith? that moment when, provoked to indignation, Thou wilt remove from us thy protection? The vices, the evil habits of our children, have perhaps irrevocably moved thy justice this very day to vengeance! O Thou who art the author and finisher of our faith, we conjure Thee, in the bitterness of our hearts, humbled and contrite, not to permit the beautiful light of faith to be extinguished in us. Be mindful of thy mercies of old, cast a compassionate regard upon that vine which Thou hast planted with thy right hand, which was bedewed with the sweat of the Apostles, watered with the precious blood of thousands upon thousands of martyrs and the tears of so many generous penitents, and made fruitful by the prayers of so many confessors and innocent virgins. O divine Mediator, have regard for those zealous souls who incessantly raise their hearts to Thee and pray for the maintenance of that most precious treasure, the true Faith. Suspend, O most just God, the decree of our reprobation, turn away thine eyes from our sins, and fix them on the adorable blood, shed upon the Cross as the price of salvation, and daily pleading for it, on our behalf, upon our altars. Oh, preserve us in the true Catholic Roman Faith. Infirmities afflict us, annoyances wear us away, misfortunes oppress us: but preserve to us thy holy faith; for, endowed with this precious gift, we shall willingly bear every sorrow, and nothing can affect our happiness. On the other hand, without this supreme treasure of the faith, our misfortunes will be unspeakable and immense. O good Jesus, author of our faith, keep it pure; keep us safe within the bark of Peter, faithful and obedient to his successor, thy Vicar here on earth, that so the unity of holy Church may be preserved, holiness fostered, the Holy See kept free and protected, and the universal Church extended, to the advantage of souls. O Jesus, author of our faith, humble and convert the enemies of thy Church; bestow on all Kings and Christian Princes, and on all the faithful, peace and true unity; strengthen and maintain all in thy holy service, to the end that we may live by Thee and die in Thee. Ah! my Jesus, author of our faith, in Thee I would live, and in Thee would I die. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["for-the-church", "times-of-trouble"],
    summary: `An urgent prayer to Christ the Redeemer, author and finisher of our faith, not to let the light of faith be put out among his people, but to keep them within the bark of Peter, faithful to the Pope, and to give the Church peace and unity. Raccolta no. 58, indulgenced by Leo XIII in 1888. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-the-love-of-god-o-my-jesus",
    title: "Prayer for the Love of God (O my Jesus, Thou well knowest that I love Thee)",
    pages: [56],
    body: [
      "O my Jesus, Thou well knowest that I love Thee; but I do not love Thee enough: Oh! make me to love Thee more. O Love which burnest always and is never extinguished, my God, Thou who art Charity itself, kindle in my heart that divine fire which consumes the Saints and transforms them into Thee. Amen.",
    ],
    prayerType: "act",
    category: "general",
    occasions: ["daily", "act-of-love"],
    summary: `A short act of love asking Jesus, who knows that we love Him but not enough, to kindle in the heart the divine fire that consumes the saints and transforms them into Him. Raccolta no. 59, indulgenced by Leo XIII in 1893. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-in-honour-of-the-holy-family",
    title: "Prayer in Honour of the Holy Family (Fac nos, Domine Jesu)",
    pages: [56, 57],
    body: [
      "Grant us, O Lord Jesus, faithfully to imitate the examples of thy Holy Family, so that in the hour of our death, in the company of thy glorious Virgin Mother and St Joseph, we may deserve to be received by Thee into eternal tabernacles.",
    ],
    latin: [
      "Fac nos, Domine Jesu, Sanctæ Familiæ tuæ exempla jugiter imitari, ut in hora mortis nostræ, occurrente gloriosa Virgine Matre tua cum beato Joseph, per te in æterna tabernacula recipi mereamur.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["holy-family", "families", "preparation-for-death"],
    relatedSaints: ["saint-joseph"],
    summary: `A prayer to imitate the example of the Holy Family, so as to be received into the eternal tabernacles at death in the company of Our Lady and St Joseph; it echoes the postcommunion of the Mass of the Holy Family. The Raccolta (no. 60) prints it in Latin and English; Leo XIII indulgenced it in 1897. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-jesus-our-redeemer-reparation",
    title: "Prayer to Jesus Our Redeemer in Reparation for Blasphemy",
    pages: [58, 59],
    body: [
      "O Jesus, Son of the living God, my Saviour and Redeemer, behold us prostrate at thy feet. We beg pardon, and make this act of reparation for all the blasphemies uttered against thy holy Name, for all the outrages committed against Thee in the most holy Sacrament of the altar, for all irreverence shown to thy most blessed and immaculate Mother, and for all the calumnies spoken against thy spouse, our holy Mother, the Catholic Church. O Jesus, who didst say: whatever you shall ask the Father in my Name, that I will do, we pray and beseech Thee for our brethren who are living in danger of sin, that Thou wouldst preserve them from the seductions of apostasy. Save them who stand over the abyss; give them light and knowledge of the truth, power and strength in the conflict against evil, and perseverance in faith and active charity. And therefore, most merciful Jesus, do we pray to the Father in thy Name, with whom Thou livest and reignest, in the unity of the Holy Spirit, world without end. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["reparation", "holy-name-of-jesus", "for-the-church"],
    summary: `An act of reparation to Christ for blasphemies against his Name, outrages against the Blessed Sacrament, irreverence to his Mother and calumnies against the Church, joined to a prayer for those in danger of losing the faith. Raccolta no. 68, indulgenced by Leo XIII in 1903. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-the-conversion-of-sinners-most-merciful-saviour",
    title: "Prayer for the Conversion of Sinners (O Lord Jesus, most merciful Saviour)",
    pages: [59],
    body: [
      "O Lord Jesus, most merciful Saviour of the world, we beg and beseech Thee, through thy most Sacred Heart, that all wandering sheep may now return to Thee, the Shepherd and Bishop of their souls. Who livest and reignest with God the Father and the Holy Spirit, God for ever and ever. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["conversion", "sacred-heart", "lent"],
    summary: `A short prayer through the Sacred Heart that all wandering sheep may return to Christ, the Shepherd and Bishop of souls (1 Peter 2:25). Raccolta no. 70, indulgenced by Pius X in 1905. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-students-of-the-sciences-uncreated-word",
    title: "Prayer for Students of the Sciences (O Uncreated Word)",
    pages: [59, 60],
    body: [
      "O uncreated Word, exemplar and creator of all things, redeemer of men, who didst bestow on blessed Albert a powerful mind to contemplate all beings in their dependence one on another, from God and his infinite perfections to the constellations of Heaven, and the most minute of terrestrial creatures with all their wonderful qualities; grant that I too may understand, according to the humble proportion of my intellectual gifts, the bond which binds together the human sciences in their diversity, and the mutual assistance they can render one another in their common service of the one truth. Then shall I value them all, as well as those who cultivate the various branches of them, and I shall summon up in desire the blessed hour when all the learned shall agree to place their persevering labours, their acquired knowledge, and their many discoveries at the service of the Faith. I beg this favour of Thee, O Lord, for thy glory, for the honour of thy holy Church, and for the salvation of souls purchased by thy Precious Blood. Amen.",
    ],
    prayerType: "general",
    category: "general",
    occasions: ["study", "before-study", "november-15"],
    summary: `A prayer that recalls the learning of Albert the Great (then Blessed Albert; canonized in 1931) and asks to see the bond that unites the human sciences in the service of the one truth, and to hasten the day when all learning is placed at the service of the faith. Raccolta no. 71, indulgenced by Pius X in 1907. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-of-catechists-to-jesus-friend-of-children",
    title: "Prayer of Catechists to Jesus, Friend of Children",
    pages: [60],
    body: [
      "O Jesus, friend of children, who from thy most tender years didst grow visibly in wisdom and in grace before God and men; who at the age of twelve wast seated in the Temple, in the midst of the doctors, listening to them attentively, humbly asking them questions, and exciting their admiration by the prudence and wisdom of thy discourse; who didst receive so willingly the children, blessing them and saying to thy disciples: Let them come to Me, for of such is the Kingdom of Heaven, inspire me as Thou didst inspire Blessed Peter Canisius, model and guide of the perfect Catechist, with a profound respect and a holy affection for childhood, a taste and a marked devotion for instructing them in Christian doctrine, a special aptitude in making them understand its mysteries and love its beauties. I ask this of Thee, through the intercession of the blessed Virgin Mary. Amen.",
    ],
    prayerType: "intercession",
    category: "general",
    occasions: ["catechesis", "children", "teachers"],
    summary: `A prayer for catechists to Jesus, the friend of children, asking for the respect, affection and skill in teaching Christian doctrine that He gave to Peter Canisius (then Blessed; canonized in 1925), the model of catechists. Raccolta no. 72, indulgenced by Pius X in 1906. ${ST_JOHN}`,
  }),

  // ── V. The Child Jesus ───────────────────────────────────────────────────
  raccolta({
    slug: "mysteries-of-the-holy-childhood",
    title: "Devotion to the Mysteries of the Holy Childhood",
    pages: [61, 62, 63, 64],
    body: [
      "V. Incline unto my aid, O God.\nR. O Lord, make haste to help me.\nV. Glory be to the Father, etc.\nPater noster.",
      "I\nJesu, sweetest Child, who didst come down from the bosom of the Father for our Salvation, who wast conceived by the Holy Ghost, who didst not abhor the Virgin's womb, and, the Word made flesh, didst take upon Thee the form of a servant; have mercy upon us.\nR. Have mercy on us, Infant Jesus, have mercy on us. Ave Maria.",
      "II\nJesu, sweetest Child, who, through thy Virgin Mother, didst visit Saint Elisabeth, and fill thy forerunner the holy Baptist with the Holy Ghost, sanctifying him whilst yet in his mother's womb; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "III\nJesu, sweetest Child, who, shut up for nine months in thy Mother's womb, wast looked for with eager expectation by Mary and by Joseph, and wast offered to God the Father for the salvation of the world; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "IV\nJesu, sweetest Child, born in Bethlehem of Mary ever Virgin, swathed in rags, laid in the manger, announced by angels, visited by shepherds; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "O Jesu, born of Virgin bright,\nImmortal glory be to Thee;\nPraise to the Father Infinite,\nAnd Holy Ghost eternally.\nV. Christ is at hand.\nR. Come let us worship.\nPater noster.",
      "V\nJesu, sweetest Child, wounded in thy circumcision the eighth day, called by the glorious Name of Jesus, and at once by thy Name and thy Blood foreshown as the Saviour of the world; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "VI\nJesu, sweetest Child, made known to the three Magi by a star, adored in the arms of thy Mother, presented with the mystic gifts of gold, frankincense, and myrrh; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "VII\nJesu, sweetest Child, who wast presented in the Temple by thy Virgin Mother, who wast embraced by Simeon, and revealed to Israel by Anna the prophetess; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "VIII\nJesu, sweetest Child, whom wicked Herod sought to slay, whom Joseph carried with Mary into Egypt, who wast taken from a cruel death and wast glorified by the blood of innocents; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "O Jesu, etc., as above. V. and R. as above.\nPater noster.",
      "IX\nJesu, sweetest Child, who didst dwell in Egypt with most holy Mary and the Patriarch holy Joseph until the death of Herod; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "X\nJesu, sweetest Child, who didst return with Mary and Joseph out of Egypt into the land of Israel, who didst suffer many toils by the way, and didst enter into the city of Nazareth; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "XI\nJesu, sweetest Child, who in the holy house at Nazareth didst remain subject to Mary and Joseph, didst dwell there most holily, wast wearied by poverty and labours, and didst advance in wisdom, age, and grace; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "XII\nJesu, sweetest Child, at twelve years old brought to Jerusalem, sought for by Mary and Joseph with sorrow, and found with joy after three days amongst the doctors; have mercy upon us. R. Have mercy, etc. Ave Maria.",
      "O Jesu, etc., as above.",
      "For Christmas Day and its Octave.\nV. The Word was made flesh. Alleluia.\nR. And dwelt among us. Alleluia.\nThe Alleluia is omitted during the rest of the year.",
      "For the Epiphany and its Octave.\nV. Christ hath manifested Himself to us. Alleluia.\nR. Come, let us adore. Alleluia.",
      "Let us pray.",
      "Almighty and everlasting God, Lord of heaven and earth, who dost reveal thyself to little ones; grant, we beseech Thee, that we, duly honouring the holy mysteries of thy Son, the Infant Jesus, and daily imitating Him in our lives, may come to the kingdom of Heaven promised by Thee to little children. Through the same Jesus Christ, etc. R. Amen.",
    ],
    prayerType: "chaplet",
    category: "devotional",
    occasions: ["christmas", "christmastide", "twenty-fifth-of-the-month"],
    summary: `Twelve invocations of the "sweetest Child" Jesus, from his coming down from the Father to his finding in the Temple, each answered by "Have mercy on us, Infant Jesus" and a Hail Mary, in three groups divided by an Our Father and a doxology, with proper versicles for Christmas and the Epiphany and a closing collect. The Raccolta (no. 75) attaches it in particular to the twenty-fifth of every month; Pius VII indulgenced it in 1819. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "five-offerings-in-honour-of-the-nativity",
    title:
      "Five Offerings in Honour of the Nativity (Novena for the Twenty-fifth Day of the Month)",
    pages: [64, 65],
    body: [
      "First Offering.\nEternal Father, I offer to thy honour and glory, and for my own salvation, and for the salvation of all the world, the mystery of the Birth of our Divine Saviour. Gloria Patri.",
      "Second Offering.\nEternal Father, I offer to thy honour and glory, and for my eternal salvation, the sufferings of the most holy Virgin and of St Joseph in that long and weary journey from Nazareth to Bethlehem; I offer Thee their pain in finding no place wherein to shelter themselves, when the Saviour of the world was to be born. Gloria Patri.",
      "Third Offering.\nEternal Father, I offer to thy honour and glory, and for my eternal salvation, the stable where Jesus was born, the hard straw which served Him for a bed, the cold He suffered, the swaddling-clothes which bound Him, the tears He shed, and his tender infant cries. Gloria Patri.",
      "Fourth Offering.\nEternal Father, I offer to thy honour and glory, and for my eternal salvation, the pain which the divine Child Jesus felt in his tender infant body when He submitted it to the keen knife of circumcision; I offer Thee that Precious Blood which then first He shed for the salvation of the whole race of man. Gloria Patri.",
      "Fifth Offering.\nEternal Father, I offer to thy honour and glory, and for my eternal salvation, the humility, mortification, patience, charity and all the virtues of the Child Jesus; I thank Thee, and I love Thee, and I bless Thee without end, for this ineffable mystery of the Incarnation of the divine Word. Gloria Patri.",
      "V. The Word was made flesh.\nR. And dwelt amongst us.",
      "Let us pray.",
      "O God, whose only-begotten Son was made manifest to us in the substance of our flesh; grant, we beseech Thee, that our souls may be inwardly renewed through Him, whom our eyes have seen externally like unto ourselves. Who liveth and reigneth with Thee for ever and ever. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["christmas", "advent", "novena"],
    summary: `Five offerings to the Eternal Father of the mysteries of the Nativity — the Birth itself, the journey to Bethlehem, the stable and the manger, the Circumcision, and the virtues of the Child Jesus — each with a Glory Be, followed by a versicle and a closing collect. The Raccolta (no. 76) gives them for a novena on the nine days before the twenty-fifth of any month; Pius IX indulgenced it in 1846. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-before-the-crib",
    title: "Prayer before the Crib",
    pages: [65, 66],
    body: [
      "I adore Thee, O Word Incarnate, true Son of God from all eternity, and true Son of Mary ever Virgin in the fullness of time. When I adore thy divine Person, and the Humanity united to thy Divinity, I venerate the poor manger which welcomed Thee when an Infant, and which was truly the throne of thy love. I prostrate myself before it with the simplicity of the shepherds, with the faith of Joseph, with the love of Mary. I bow down in veneration of this precious memorial of our salvation with the same spirit of mortification, poverty and humility with which Thou, though the Lord of heaven and earth, didst choose for thyself a manger wherein to lay thy tender infant limbs. And Thou, O Lord, who in thine Infancy didst deign to lay thyself in this manger, vouchsafe also to pour into my heart a drop of that joy to which the sight of thy lovely Childhood, and the miracles which accompanied thy Birth, gave rise. By that holy Birth, I now implore Thee to grant to all the world peace and goodwill, and in the name of the whole human race I render thanks and honour to God the Father, and to God the Holy Spirit, who with Thee live and reign one God world without end. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["christmas", "christmastide", "advent"],
    summary: `An act of adoration of the Word made flesh and of veneration of the manger that received Him, made with the simplicity of the shepherds, the faith of Joseph and the love of Mary, and asking peace and goodwill for the whole world. The Raccolta (no. 77) gives a greater indulgence when it is said in the Basilica of St Mary Major in Rome, where relics of the manger are kept; Pius IX indulgenced it in 1861. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-the-infant-jesus-most-dear-lord",
    title: "Prayer to the Infant Jesus (Most dear Lord Jesus Christ)",
    pages: [66, 67],
    body: [
      "Most dear Lord Jesus Christ, who, being made an infant for us, wast willing to be born in a cave, to free us from the darkness of sin, to draw us to thyself, and to inflame us with thy holy love; we adore Thee as our Creator and Redeemer, we accept and choose Thee for our King and Lord, and for tribute we offer Thee all the affections of our poor hearts. Dear Jesus, our Lord and God, deign to accept this offering, and that it may be worthy of thine acceptance, pardon us our faults, enlighten us, and inflame us with that holy fire which Thou camest to bring into the world and enkindle in men's hearts. May our souls thus become a perpetual sacrifice in thy honour. Grant that we may ever seek thy greater glory here on earth, so that we may one day come to rejoice in thy infinite loveliness in Heaven. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["christmas", "christmastide", "epiphany"],
    summary: `A prayer to the Infant Christ, born in a cave to free us from the darkness of sin, choosing Him as King and Lord and offering Him the affections of our hearts as tribute. Raccolta no. 78, indulgenced by Leo XIII in 1894. ${ST_JOHN}`,
  }),

  // ── VI. The Blessed Sacrament ────────────────────────────────────────────
  raccolta({
    slug: "prayer-for-the-spread-of-daily-communion-dulcissime-jesu",
    title: "Prayer for the Spread of Daily Communion (Dulcissime Jesu)",
    pages: [68, 69],
    body: [
      "O sweetest Jesus, who came into this world to enrich the souls of all with thy grace, and who, in order to preserve and increase it in them, didst in the most august Sacrament of the Eucharist, give thyself to be a salutary remedy for our infirmities and divine food to sustain our weakness; we humbly beg of Thee mercifully to pour out upon all men thy Holy Spirit, which may enable them, if stained with any mortal guilt, to recover the life of grace lost by sin, and return to Thee; while those who through thy great mercy are still united with Thee may daily, so far as each may be able, approach thy heavenly table, where they may find strength, and an antidote for their daily faults, may nourish the life of grace within them, and, being more and more purified, may attain to everlasting happiness in Heaven. Amen.",
    ],
    latin: [
      "O dulcissime Jesu, qui in hunc mundum venisti, ut omnes animas vita ditares gratiæ tuæ, ad quam in illis servandam simulque fovendam in augustissimo Eucharistiæ Sacramento salutare pharmacum earum infirmitatibus sanandis, et cibum divinum debilitati sustinendæ temetipsum quotidie præbes, te supplices deprecamur, ut super eas sanctum tuum spiritum benignus effundas; quo repletæ, lethali labe si quæ sint inquinatæ ad te revertentes, vitam gratiæ deperditam recuperent; quæ vero, te misericorditer largiente, jam tibi adhærent, quotidie, prout cui dabitur, ad tuam cœlestem dapem devote accedant, qua roboratæ, venialium culparum a se quotidie admissarum antidotum sibi comparare, vitamque gratiæ tuæ alere valeant, sicque magis magisque emundatæ, sempiternam in cœlis beatitudinem consequantur. Amen.",
    ],
    prayerType: "intercession",
    category: "eucharistic",
    occasions: ["corpus-christi", "before-communion", "adoration"],
    summary: `The prayer for frequent and daily Communion issued under Pius X, asking Jesus, who gives Himself in the Eucharist as remedy and food, to pour out his Spirit so that sinners may return to the life of grace and the faithful approach his table daily. The Raccolta prints it in Latin and English (no. 82) to be said after the sermon on each day of the Corpus Christi triduo, and gives a second English rendering of the same prayer as no. 111; Pius X indulgenced it in 1905 and 1907. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayers-before-the-blessed-sacrament-to-the-three-divine-persons",
    title: "Prayers before the Blessed Sacrament to the Three Divine Persons",
    pages: [71, 72],
    body: [
      "V. We adore Thee, Christ, and we bless Thee.\nR. Because by thy holy Cross Thou hast redeemed the world.",
      "I adore Thee, Eternal Father, and I give Thee thanks for the infinite love with which Thou didst deign to send thy only-begotten Son to redeem me, and to become the food of my soul. I offer Thee all the acts of adoration and thanksgiving that are offered to Thee by the angels and saints in heaven and by the just on earth. I praise, love, and thank Thee with all the praise, love, and thanksgiving that are offered to Thee by thine own Son in the Blessed Sacrament; and I beg Thee to grant that He may be known, loved, honoured, praised, and worthily received by all, in this most divine Sacrament. Pater, Ave, Gloria.",
      "I adore Thee, Eternal Son, and I thank Thee for the infinite love which caused Thee to become man for me, to be born in a stable, to live in poverty, to suffer hunger, thirst, heat, cold, fatigue, hardships, contempt, persecutions, the scourging, the crowning with thorns, and a cruel death upon the hard wood of the Cross. I thank Thee, with the Church militant and triumphant, for the infinite love with which Thou didst institute the most blessed Sacrament to be the food of my soul.",
      "I adore Thee in all the consecrated hosts throughout the whole world, and I return thanks for those who know Thee not, and who do not thank Thee. Would that I were able to give my life to make Thee known, loved, and honoured by all, in this sacrament of love, and to prevent the irreverences and sacrileges that are committed against Thee! I love Thee, divine Jesus, and I desire to receive Thee with all the purity, love, and affection of thy blessed Mother, and with the love and affection of thy own most pure Heart. Grant, O most amiable spouse of my soul, in coming to me in this most holy Sacrament, that I may receive all the graces and blessings which Thou dost come to bestow on us, and let me rather die than receive Thee unworthily. Pater, Ave, Gloria.",
      "I adore Thee, Eternal Spirit, and I give Thee thanks for the infinite love with which Thou didst work the ineffable mystery of the Incarnation, and for the infinite love with which Thou didst form the sacred body of our Lord Jesus Christ out of the most pure blood of the Blessed Virgin Mary, to become in this Sacrament the food of my soul. I beg Thee to enlighten my mind, and to purify my heart and the hearts of all men, that they all may know this great benefit of thy love, and receive worthily this most blessed Sacrament. Pater, Ave, Gloria.",
      "Tantum ergo, with Versicle and Prayer.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["adoration", "thursday", "visit-to-the-blessed-sacrament"],
    summary: `Acts of adoration and thanksgiving before the Blessed Sacrament addressed in turn to the Eternal Father, who sent his Son to be our food, to the Son, who instituted the Sacrament, and to the Holy Spirit, who formed his Body in the Virgin's womb; each is followed by an Our Father, Hail Mary and Glory Be, and the whole closes with the Tantum ergo. Raccolta no. 88, indulgenced by Pius VI in 1796. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "acts-of-adoration-and-reparation-to-the-blessed-sacrament",
    title: "Acts of Adoration and Reparation to the Blessed Sacrament",
    pages: [72, 73, 74],
    body: [
      "I\nI adore Thee, my Jesus, in the Blessed Sacrament; I acknowledge Thee, true God and true Man. By this my act of adoration I intend to make Thee reparation for the coldness of so many of thy people, who pass before thy churches, nay, before thy very tabernacle, where hour after hour Thou dost deign to dwell in loving impatience to communicate thyself to thy faithful, yet do not even bow the knee before Thee, but like the Israelites in the wilderness, seem by their indifference to loathe this heavenly manna. I offer Thee thine own most precious Blood which Thou didst shed from the wound in thy Left Foot, in reparation for this hateful coldness, and entering therein, I cry, and will never cease to cry—\nBlessed and praised every moment\nBe the most holy and divine Sacrament!\nPater, Ave, Gloria.",
      "II\nI profoundly adore Thee, my Jesus; I acknowledge Thee present in the most holy Sacrament. By this act of adoration I would fain make amends for the forgetfulness of so many Christian people, who, when they see Thee go to the poor sick, to be their strength in their great journey to eternity, leave Thee unescorted, and hardly give Thee even one outward sign of homage. I offer Thee, in reparation for this coldness, that most precious Blood which Thou didst shed from the wound in thy Right Foot, and entering therein, I cry, and will never cease to cry:\nBlessed and praised every moment\nBe the most holy and divine Sacrament!\nPater, Ave, Gloria.",
      "III\nI profoundly adore Thee, my Jesus, true Bread of life eternal; and by this my act of adoration I would fain make Thee compensation for all the wounds with which thy Sacred Heart bleeds daily to see the profanation of those churches wherein Thou dost vouchsafe to abide, beneath the sacramental species, to receive the love and adoration of thy people. I offer Thee, in reparation for all these irreverences, that most precious Blood which Thou didst shed from the wound in thy Left Hand, and, entering therein, I will ever cry:\nBlessed and praised every moment\nBe the most holy and divine Sacrament!\nPater, Ave, Gloria.",
      "IV\nI profoundly adore Thee, my Jesus, Living Bread come down from heaven; and by this act of adoration I would fain make amends for all the acts of irreverence which thy people day by day commit whilst they assist at holy Mass, in which bloodless Sacrifice Thou dost renew the very Sacrifice which once Thou didst consummate on Calvary for our salvation. I offer Thee, in reparation for all this ingratitude, that most precious Blood which Thou didst shed from the wound in thy Right Hand; and, entering therein, I unite my voice with the voices of the holy angels who adore around thy throne:\nBlessed and praised every moment\nBe the most holy and divine Sacrament!\nPater, Ave, Gloria.",
      "V\nI profoundly adore Thee, my Jesus, true Victim of expiation for our sins; and I offer Thee this act of adoration in compensation for the sacrilegious outrages Thou dost receive from so many of thy ungrateful people, who dare to draw nigh to Thee and receive Thee in Communion with mortal sin upon their souls. In reparation for these hateful sacrileges, I offer Thee those last drops of thy most precious Blood which Thou didst shed from the wound in thy Side; and, entering therein, I approach Thee with acts of adoration, love, and thanksgiving, and, with all holy souls who are devout to Thee in this most holy Sacrament, I cry:\nBlessed and praised every moment\nBe the most holy and divine Sacrament!\nPater, Ave, Gloria.",
      "Tantum ergo with Versicle and Prayer.",
    ],
    prayerType: "act",
    category: "eucharistic",
    occasions: ["adoration", "reparation", "holy-hour"],
    summary: `Five acts of adoration of Christ in the Blessed Sacrament, each offering the Blood of one of his five wounds in reparation for a particular neglect — coldness before the tabernacle, indifference when the Sacrament is carried to the sick, profanation of churches, irreverence at Mass, and sacrilegious Communions — and each ending "Blessed and praised every moment be the most holy and divine Sacrament!" Raccolta no. 89, indulgenced by Pius VII in 1814. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-behold-my-most-loving-jesus",
    title: "Prayer to the Loving Heart of Jesus in the Eucharist (Behold, my most loving Jesus)",
    pages: [76],
    body: [
      "Behold, my most loving Jesus, to what an excess thy boundless love has carried Thee. Of thine own Flesh and Precious Blood Thou hast made ready for me a divine banquet in order to give me all thyself. What was it that impelled Thee to this transport of love? It was thy Heart, thy loving Heart. O adorable Heart of my Jesus! burning furnace of Divine Love! within thy most sacred wound receive Thou my soul; that in that school of charity I may learn to requite the love of that God who has given me such wondrous proofs of his love. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["after-communion", "adoration", "sacred-heart"],
    summary: `A short prayer of wonder at the love that moved Christ to give his own Flesh and Blood as our food, asking to be received into the wound of his Heart, that school of charity. Raccolta no. 93, indulgenced by Pius VII in 1818. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-dear-jesus-present-in-the-sacrament",
    title: "Prayer to Jesus Present in the Sacrament of the Altar (Dear Jesus)",
    pages: [81],
    body: [
      "Dear Jesus, present in the Sacrament of the Altar, be for ever thanked and praised. Love, worthy of all celestial and terrestrial love! who, out of infinite love for me, ungrateful sinner, didst assume our human nature, didst shed thy most precious Blood in the cruel scourging, and didst expire on a shameful cross for our eternal welfare! Now, illumined with lively faith, with the outpouring of my whole soul and the fervour of my heart, I humbly beseech Thee, through the infinite merits of thy painful sufferings, give me strength and courage to destroy every evil passion which sways my heart, to bless Thee in my greatest afflictions, to glorify Thee by the exact fulfilment of all my duties, supremely to hate all sin, and thus to become a saint.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["adoration", "visit-to-the-blessed-sacrament"],
    summary: `A prayer of thanks and praise to Jesus present on the altar, recalling his Incarnation, scourging and death, and asking strength to overcome every evil passion, to bless Him in affliction, to fulfil every duty and so to become a saint. Raccolta no. 97, indulgenced by Pius IX in 1866. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-a-visit-look-down-holy-father",
    title: "Prayer for a Visit to the Blessed Sacrament (Look down, Holy Father)",
    pages: [82],
    body: [
      "Look down, Holy Father and Lord, from thy sanctuary, and from heaven, thy dwelling-place on high, and behold this sacred Victim which our great High Priest, thy holy Child, our Lord Jesus, offers up to Thee for the sins of his brethren; and be appeased for the multitude of our transgressions. Behold, the voice of the Blood of Jesus, our Brother, cries to Thee from the Cross. Give ear, O Lord! Be appeased, O Lord! Hearken, and do not tarry, for thine own sake, O my God, for thy Name is invoked upon this city and upon thy people; and deal with us according to thy mercy. Amen.\nV. That Thou vouchsafe to defend, pacify, keep, preserve, and bless this city.\nR. We beseech Thee to hear us.",
    ],
    prayerType: "intercession",
    category: "eucharistic",
    occasions: ["visit-to-the-blessed-sacrament", "adoration", "for-the-church"],
    summary: `A prayer for a visit to the Blessed Sacrament that offers the Father the Victim of the altar, whose Blood cries to Him from the Cross, and begs mercy for "this city and thy people", closing with a versicle for the city's protection. Raccolta no. 99, indulgenced by Pius IX in 1877. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-during-the-elevation-salve-salutaris-victima",
    title: "Prayer during the Elevation (Salve, salutaris victima)",
    pages: [83],
    body: [
      "Hail, saving victim, offered upon the scaffold of the Cross, for me, and for the whole human race.",
      "Hail, Precious Blood streaming from the wounds of my crucified Lord Jesus Christ, washing away the sins of the whole world.",
      "Remember, O Lord, thy servant, the work of thy hands, whom Thou hast redeemed with thy Precious Blood.",
    ],
    latin: [
      "Salve, salutaris victima, pro me et omni humano genere in patibulo crucis oblata.",
      "Salve, pretiose Sanguis, de vulneribus crucifixi Domini nostri Jesu Christi profluens, et peccata totius mundi abluens.",
      "Recordare, Domine, creaturæ tuæ, quam tuo pretioso sanguine redemisti.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "elevation", "precious-blood"],
    summary: `Three short salutations for the elevation at Mass: to the saving Victim offered on the Cross, to the Precious Blood that washes away the sins of the world, and a plea to be remembered as one redeemed by that Blood. The Raccolta (no. 102) prints them in Latin and English; Leo XIII indulgenced them in 1893. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "act-of-homage-to-christ-our-god-and-king",
    title: "Act of Homage to Christ, Our God and Our King",
    pages: [84, 85, 86],
    body: [
      "To be said by priest and people together during Exposition of the Blessed Sacrament.",
      "O sweet Saviour and Redeemer of mankind, Jesus Christ, who in the impenetrable designs of thine infinite wisdom bearest with the audacity of the impious and sufferest the violence of the wicked, reserving to thyself the sovereign right of judging the impious man and his perverse works, turn thy merciful regard upon thy children, who in the blindness of their hearts have turned from Thee in rebellion. With the eyes of a Father, and with the power of the sovereign King of the Universe, stretch forth thy hand to bless and regenerate modern society, which is rebelliously turning its back upon Thee, the King of Kings, Lord of Lords. Be moved to compassion for thy people, whom Thou hast purchased with thy Blood, regenerated with thy grace, and exalted with thy love. Thou hast given them true liberty, Thou hast called them to the inheritance of thy Father, Thou hast numbered them among thy brethren; but in the delirium of their rebellion they have preferred the slavery of Satan, and live in abject misery, without joy, without hope.",
      "O my Lord Jesus Christ, King of eternal glory, restorer of all things in heaven and on earth, supreme and omnipotent, who with infinite wisdom reunitest at thy feet things scattered and dispersed; enlighten the Kings of the earth, the rulers of nations; instil thy spirit into all civil institutions, into every form of government, into laws and armies; grant that all the powers of earth may recognize in Thee the majesty of the eternal God, the source from which all authority is derived; illuminate the nations that they may understand that Thou art the origin of rights and duties, that it is through Thee that the Kings of the earth rule, and that it is to Thee that Kings and people alike owe obedience. O most sweet Jesus, who hast deigned to descend into this valley of tears, and to dwell with us, suffering and dying for the salvation of us sinners, and who in an excess of charity hast set up thy abode in the midst of men, hidden under the sacramental species, and who in the fullness of the Godhead, corporally present in our tabernacles, makest thyself the food and life of our souls; oh, receive the humble but sincere and profound homage of our hearts, offered in reparation for the falling away of the rebellious. We firmly believe in Thee and all that the faith infused into our hearts by the Holy Spirit has revealed to us about Thee. We see in Thee the beginning and the end of all existing things, we adore Thee as the one true God, we wish to live only for Thee and in thy service. Do Thou, O Lord, save our brethren, reunite the scattered members of modern society gone astray, that we as brethren may together be one with Thee, as Thou art one with thy Father in Heaven. May thy will be done by all and in everything. May thy Majesty shine forth on the throne of thy earthly dominion, and the world confess Thee to be the true Son of God, through whom all things were created.",
      "O Jesus, God of love, set free from his chains thy Vicar, the successor of Peter; re-establish him in the exercise of that liberty which Thou thyself didst give him, together with the supreme keys, that he might effectually carry on thy work of regenerating mankind; and so hasten on that longed-for day, in which Thou wilt be glorified by the return of Society to its paternal home. Gather together, O King of the nations, the sheep and the lambs under the care of the one shepherd. O Lord, do not abandon us; we are thy children, we love Thee; recognize us still as thy children, unworthy, yet ever thine; save us, and together with us, save Kings, Rulers, and Nations. Amen.",
    ],
    prayerType: "act",
    category: "eucharistic",
    occasions: ["christ-the-king", "adoration", "benediction"],
    summary: `An act of homage to be said by priest and people together during exposition of the Blessed Sacrament, asking Christ the King to regenerate a society that has turned away from Him, to enlighten rulers and nations, to set free his Vicar (written while the popes regarded themselves as prisoners in the Vatican after 1870) and to gather all under one shepherd. Raccolta no. 105, indulgenced by Leo XIII in 1895. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-after-communion-how-full-of-delight",
    title: "Prayer after Communion (How full of delight is the sweetness of thy heavenly bread)",
    pages: [88],
    body: [
      "How full of delight is the sweetness of thy heavenly bread! How admirable is the tranquillity and how complete the peace of those who receive Thee, after detesting and sincerely confessing their sins. Be Thou blessed a thousand times, my Jesus! When I was in sin, I was unhappy. Now not only do I find my soul tranquil, but I seem to enjoy a very foretaste of the peace of Paradise. How true it is that our hearts are made for Thee, my beloved Lord, and that they rejoice only when they repose in Thee. I, then, render Thee thanks, and firmly purpose ever to fly sin and its occasions, to fix my abode in thy divine Heart, and thence to look for help to love Thee until death. Amen.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["after-communion", "thanksgiving", "confession"],
    summary: `A thanksgiving after Communion that rejoices in the peace of a soul reconciled to God — "our hearts are made for Thee" — and resolves to flee sin and its occasions and to dwell in the divine Heart. Raccolta no. 107, indulgenced by Leo XIII in 1896. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-our-lady-of-the-blessed-sacrament",
    title: "Prayer to Our Lady of the Blessed Sacrament",
    pages: [89, 90],
    body: [
      "O Virgin Mary, our Lady of the Blessed Sacrament, glory of the Christian people, joy of the universal Church, salvation of the world; pray for us, and awaken in all the faithful devotion to the Holy Eucharist in order that they may render themselves worthy to receive it daily.",
    ],
    prayerType: "marian",
    category: "marian",
    occasions: ["corpus-christi", "marian-devotion", "adoration"],
    summary: `A short prayer to the Virgin under the title Our Lady of the Blessed Sacrament, asking her to awaken in all the faithful a devotion to the Eucharist that makes them worthy to receive it daily. Raccolta no. 112, indulgenced by Pius X in 1907. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-our-lord-in-the-blessed-sacrament-our-sins",
    title: "Prayer to Our Lord in the Blessed Sacrament (Our sins, O Lord, darken our minds)",
    pages: [90],
    body: [
      "Our sins, O Lord, darken our minds, and we lose the benefit of loving Thee as Thou deservest. Enlighten us with a ray of thy bright light. Thou art Friend, Redeemer, Father of all who turn repentant to thy Heart; and we return to Thee sorrowing. Save us, O Jesus; provide out of thy infinite bounty for our miseries. O Jesus, we hope in Thee because we know that our salvation cost Thee thy life sacrificed upon the Cross, and induced Thee to dwell continuously in the Blessed Sacrament, in order to be united with us as often as we desire. We, O Lord, to thank Thee for the great love Thou bearest us, promise with the help of thy grace to receive Thee in the Blessed Sacrament as often as possible; to declare thy praises in church and in every place, without human respect. O Lord, confiding in thy Sacred Heart, we beseech Thee, to preserve in thy love those who love Thee, and to invite all to receive Thee daily at the altar in accordance with thy burning desire.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["adoration", "before-communion", "confession"],
    summary: `A prayer of repentance and hope to Christ in the Blessed Sacrament, promising to receive Him as often as possible and to praise Him without human respect, and asking Him to draw all to daily Communion. Raccolta no. 113, indulgenced by Pius X in 1906. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-at-the-beginning-of-mass-with-our-lady-of-sorrows",
    title: "Prayer at the Beginning of Mass in Union with Our Lady of Sorrows",
    pages: [91],
    body: [
      "Eternal Father, I unite myself with the intentions and affections of our Lady of Sorrows on Calvary, and I offer Thee the sacrifice which thy beloved Son Jesus made of himself on the Cross, and now renews on this holy altar: 1. To adore Thee and give Thee the honour which is due to Thee, confessing thy supreme dominion over all things, and the absolute dependence of everything upon Thee, Thou who art our one and last end. 2. To thank Thee for innumerable benefits received. 3. To appease thy justice, irritated against us by so many sins, and to make satisfaction for them. 4. To implore grace and mercy for myself, for . . . , for all afflicted and sorrowing, for poor sinners, for all the world, and for the holy souls in Purgatory.",
    ],
    prayerType: "general",
    category: "eucharistic",
    occasions: ["mass", "before-mass", "september-15"],
    summary: `An offering of the sacrifice of the Mass at its beginning, made in union with Our Lady of Sorrows on Calvary, for the four ends of the sacrifice: adoration, thanksgiving, satisfaction for sin, and petition for the living and the dead. Raccolta no. 115, indulgenced by Pius X in 1904. ${ST_JOHN}`,
  }),

  // ── VII. Jesus Crucified ─────────────────────────────────────────────────
  raccolta({
    slug: "stations-of-the-cross-raccolta-prayers",
    title: "Prayers for the Stations of the Cross (from the Raccolta)",
    pages: [92, 93, 94, 95, 96],
    body: [
      "Begin with an act of contrition.",
      "Station I. Jesus condemned to death.\nV. We adore Thee, O Christ, and we bless Thee.\nR. Because by thy holy Cross Thou hast redeemed the world.\nMy Jesus, oft have I signed thy death-warrant by my sins; save me by thy death from that death eternal I deserve. Pater, Ave.\nV. Have mercy on us, O Lord.\nR. Have mercy on us.",
      "Passing on from one station to another, say, or sing,\nHoly Mother, pierce me through,\nIn my heart each wound renew\nOf my Saviour crucified.\nor the Stabat Mater.",
      "Station II. Jesus receives his cross.\nV. Adoramus, etc.\nMy Jesus, who by thine own will didst take on Thee the Cross which I made for Thee by my sins; oh, make me know the weight of them, and sorrow for them ever while I live. Pater, Ave. V. Miserere.",
      "Station III. Jesus falls the first time beneath the Cross.\nV. Adoramus, etc.\nMy Jesus, the heavy burden of my sins has made Thee fall down beneath the Cross. My Jesus, I loathe them, I detest them, I beseech Thee to pardon them; aided by thy grace, I will never commit them more. Pater, Ave. V. Miserere.",
      "Station IV. Jesus meets his Mother.\nV. Adoramus, etc.\nJesus, most suffering! Mary, Mother most sorrowful! if for the past by sin I have caused you pain and sorrow, yet by divine grace it shall be so no more, but I will love you faithfully until death. Pater, Ave. V. Miserere.",
      "Station V. Simon of Cyrene helps Jesus to carry the Cross.\nV. Adoramus, etc.\nMy Jesus, happy was that man of Cyrene who aided Thee to bear the Cross. Happy shall I be if I too aid Thee to bear the Cross, by suffering with patience and goodwill the crosses Thou shalt send me during life. My Jesus, give me grace to do so. Pater, Ave. V. Miserere.",
      "Station VI. Jesus and Veronica.\nV. Adoramus, etc.\nJesus most compassionate, who didst deign to print thy sacred countenance upon the cloth with which Veronica wiped the sweat from off thy brows; print in my soul deep, I pray Thee, the lasting memory of thy most bitter pains. Pater, Ave. V. Miserere.",
      "Station VII. Jesus falls a second time.\nV. Adoramus, etc.\nMy Jesus, oft have I sinned, and by sin often made Thee fall beneath the Cross. Help me to use such efficacious means of grace that I may never fall again into sin. Pater, Ave. V. Miserere.",
      "Station VIII. Jesus comforts the women of Jerusalem.\nV. Adoramus, etc.\nMy Jesus, who didst comfort the pious women of Jerusalem who wept to see Thee so tormented; comfort my soul with thy mercy, for in thy mercy alone is my trust; oh, may I never frustrate it! Pater, Ave. V. Miserere.",
      "Station IX. Again a third time Jesus falls.\nV. Adoramus, etc.\nMy Jesus, by all the bitter woe Thou didst endure when a third time Thou didst fall beneath the heavy Cross, oh, never, never let me fall away; but rather let me die than ever mortally sin again. Pater, Ave. V. Miserere.",
      "Station X. Jesus stripped and given gall to drink.\nV. Adoramus, etc.\nMy Jesus, who wast stripped of thy clothes and given gall to drink, strip me of love for things of earth, and make me loathe all that savours of the world and sin. Pater, Ave. V. Miserere.",
      "Station XI. Jesus nailed to the Cross.\nV. Adoramus, etc.\nMy Jesus, by those agonizing pains Thou didst endure when the hard nails pierced thy tender hands and feet and fixed them to the Cross, oh, make me ever crucify my flesh with the spirit of true Christian penance. Pater, Ave. V. Miserere.",
      "Station XII. Jesus dies upon the Cross.\nV. Adoramus, etc.\nMy Jesus, three hours didst Thou hang in agony upon the Cross, and then didst die for me; let me die before I sin again, and if I live, may I live to love Thee and to serve Thee faithfully. Pater, Ave. V. Miserere.",
      "Station XIII. Jesus taken from the Cross and laid in Mary's bosom.\nV. Adoramus, etc.\nMary, Mother most sorrowful, the sword of grief went through thy soul when thou didst see thy dear Son Jesus lying lifeless in thy bosom; ask for me hatred of sin, which was the cause of his death and made thee suffer so much; and then obtain for me grace to live a true Christian life, and save my soul. Pater, Ave. V. Miserere.",
      "Station XIV. Jesus laid in the tomb.\nV. Adoramus, etc.\nMy Jesus, beside Thee in the tomb I desire that I may ever remain as one dead; and if I live, I wish to live only to Thee, that so one day I may come with Thee to taste of the bliss of heaven, fruit of thy Passion and most painful death. Amen. Pater, Ave. V. Miserere.",
      "Let us pray.",
      "God, who by the Precious Blood of thy only-begotten Son didst sanctify the standard of the Cross; grant, we beseech Thee, that all those who rejoice in the glory of the same Holy Cross may at all times and places feel the gladness of thy protection. Through the same Christ our Lord. R. Amen.",
      "End with one Pater, Ave, and Gloria for the intention of the Sovereign Pontiff.",
    ],
    latin: [
      "V. Adoramus te, Christe, et benedicimus tibi.\nR. Quia per sanctam Crucem tuam redemisti mundum.",
      "V. Miserere nostri, Domine.\nR. Miserere nostri.",
      "Oremus.",
      "Deus, qui Unigeniti Filii tui pretioso sanguine vivificæ crucis vexillum sanctificare voluisti; concede, quæsumus, eos, qui ejusdem sanctæ crucis gaudent honore, tua quoque ubique protectione gaudere. Per eundem Christum Dominum nostrum. R. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["stations-of-the-cross", "lent", "good-friday", "friday"],
    summary: `The short prayers for each of the fourteen Stations of the Cross printed in the Raccolta (no. 117), each with the versicle Adoramus te, an Our Father and Hail Mary, and the Miserere nostri, with a verse of the Stabat Mater sung between the stations and the collect of the Holy Cross at the end. The Raccolta notes that any other devotions may be used for the Stations; the Latin given here is the versicles and collect the book prints beside the English. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "devotion-to-the-five-wounds-raccolta",
    title: "Devotions in Honour of the Five Wounds (Holy wound of the Left Foot of my Jesus)",
    pages: [97, 98, 99, 100],
    body: [
      "Act of Contrition.",
      "As I kneel before Thee on the Cross, most loving Saviour of my soul, my conscience tells me it was I who nailed Thee to that Cross with these hands of mine, as often as I have fallen into mortal sin, wearying Thee with my monstrous ingratitude. My God, my chief and most perfect Good, worthy of all my love, seeing Thou hast ever loaded me with blessings, I cannot now undo my misdeeds, as I would most willingly, but I can and will loathe them, grieving greatly for having offended Thee who art infinite Goodness. And now, kneeling at thy feet, I will try at least to compassionate Thee, to give Thee thanks, to ask of Thee pardon and contrition; wherefore with heart and lips I say:",
      "To the First Wound of the Left Foot.\nHoly wound of the Left Foot of my Jesus, I adore Thee! I compassionate Thee, O my Jesus, for that most bitter pain which Thou didst suffer. I thank Thee for the love whereby Thou wast wearied in overtaking me on the way to ruin, and didst bleed amid the thorns and brambles of my sins. I offer to the Eternal Father the pain and love of thy most sacred humanity, in atonement for my sins, all which I detest with sincere and bitter contrition. Pater, Ave, Gloria.\nHoly Mother, pierce me through;\nIn my heart each wound renew\nOf my Saviour crucified.",
      "To the Second Wound, of the Right Foot.\nHoly wound of the Right Foot of my Jesus, I adore Thee! I compassionate Thee, O my Jesus, for that most bitter pain which Thou didst suffer. I thank Thee for the love which pierced Thee with such torture and shedding of blood in order to punish my wanderings and the guilty pleasures I have granted to my passions. I offer the Eternal Father all the pain and love of thy most sacred humanity, and I pray unto Him for grace to weep over my transgressions with burning tears, and to enable me to persevere in the good which I have begun, without ever swerving again from my obedience to the Commandments of my God. Pater, Ave, Gloria.\nHoly Mother, etc.",
      "To the Third Wound, of the Left Hand.\nHoly wound of the Left Hand of my Jesus, I adore Thee! I compassionate Thee, O my Jesus, for that most bitter pain which Thou didst suffer. I thank Thee for having, in thy love, spared me the scourges and eternal damnation which my sins have merited. I offer to the Eternal Father the pain and love of thy most sacred humanity, and I pray Him to teach me how to turn to good account my span of life, and bring forth in it worthy fruits of penance, and so disarm the angry justice of my God. Pater, Ave, Gloria.\nHoly Mother, etc.",
      "To the Fourth Wound, of the Right Hand.\nHoly wound of the Right Hand of my Jesus, I adore Thee! I compassionate Thee, O my Jesus, for that most bitter pain which Thou didst suffer. I thank Thee for thy graces lavished on me with such love, in spite of all my miserable obstinacy. I offer to the Eternal Father all the pain and love of thy most sacred humanity, and I pray Him to change my heart and its affections, and make me do all my actions in accordance with the will of God. Pater, Ave, Gloria.\nHoly Mother, etc.",
      "To the Fifth Wound, of the sacred Side.\nHoly wound in the side of my Jesus, I adore Thee! I compassionate Thee, O my Jesus, for the cruel insult Thou didst suffer. I thank Thee, my Jesus, for the love which suffered thy side and heart to be pierced, that so the last drops of blood and water might issue forth, making my redemption to abound. I offer to the Eternal Father this outrage, and the love of thy most sacred humanity, that my soul may enter once for all into that most loving Heart, eager and ready to receive the greatest sinners, and from it may never more depart. Pater, Ave, Gloria.\nHoly Mother, etc.",
      "To the most Holy Virgin, Mother of Sorrows.\nMary, Virgin Mother of God, Martyr of love and sorrow, in that thou didst witness the pains and torments of Jesus; truly didst thou concur in the great work of my redemption, first by thy innumerable afflictions, and then by the offering thou didst make to the Eternal Father of his and thy only-begotten for a holocaust and victim of propitiation for my sins. I thank thee for that love, well-nigh infinite, through which thou didst bereave thyself of the fruit of thy womb, very God and very Man, to save me, sinner that I am; let thy intercession, which never returneth to thee void, interpose with the Father and the Son for me; that I may steadily amend my evil ways, and never by further faults crucify afresh my loving Saviour; that so, persevering in his grace until death, I may obtain eternal life through the merits of his painful Passion and Death upon the Cross. Ave Maria, thrice.",
      "Let us pray.",
      "O Lord Jesus Christ, who at the sixth hour of the day didst, for the redemption of the world, mount the scaffold of the Cross, and shed thy Precious Blood for the remission of sins; we humbly beseech Thee grant us that after our death we may joyfully enter the gates of Paradise.",
      "We beseech Thee, O Lord Jesus Christ, that now, and at the hour of our death, blessed Mary ever Virgin, thy Mother, may intercede for us, through whose most holy soul the sword passed in the hour of thy Passion. Through Thee, Jesus Christ, Saviour of the world, who with the Father and the Holy Ghost livest and reignest for ever and ever. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["lent", "passiontide", "friday", "exaltation-of-the-holy-cross"],
    summary: `An act of contrition before the crucifix followed by five prayers of adoration, compassion, thanksgiving and offering to each of the wounds of Christ — the left foot, the right foot, the left hand, the right hand and the side — each with an Our Father, Hail Mary and Glory Be and a verse of the Stabat Mater, then a prayer to the Mother of Sorrows and two closing collects. Raccolta no. 121, indulgenced by Pius VII in 1807, in particular for Passiontide. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "devotion-of-the-seven-words",
    title: "Devotion of the Seven Words of Our Lord on the Cross",
    pages: [100, 101, 102, 103, 104, 105],
    body: [
      "V. O God, come to my assistance.\nR. O Lord make haste to help me.\nV. Glory be to the Father, etc.",
      "First Word: Father, forgive them; for they know not what they do.\nV. We adore Thee, O Christ, and we bless Thee.\nR. Because by thy holy Cross Thou hast redeemed the world.\nJesus, my love! who for love of me didst hang in agony upon the Cross, there by thy pains to pay the penalty of my sins, and didst open thy divine mouth to obtain for me the pardon of them from Eternal Justice; O Jesus, pity all the faithful who are now in their last agony, and pity me when I too shall be in mine. By the merits of thy most Precious Blood shed for our salvation, vouchsafe unto us all such lively sorrow for our sins that at our death we may breathe forth our souls into the bosom of thy infinite mercy. Gloria Patri, thrice.\nHave mercy on us, O Lord; have mercy on us.\nMy God, I believe in Thee, I hope in Thee, I love Thee. I repent of my sins, because by them I have offended Thee.",
      "Second Word: This day shalt thou be with Me in Paradise.\nV. We adore Thee, etc.\nJesus, my love! who for love of me didst hang in agony upon the Cross, and with such readiness and bounty didst respond to the faith of the good thief, who in thy humiliations acknowledged Thee to be the Son of God, and didst assure unto him the Paradise prepared for him; oh, pity all the faithful who are in their last agony, and pity me when I too shall be in mine. By the merit of thy most Precious Blood, wake up in our souls such firm and steadfast faith as shall never waver at any suggestion of the evil one; that so we also may obtain the prize of holy Paradise. Gloria Patri, thrice.\nHave mercy, etc. My God, etc.",
      "Third Word: Behold thy Mother! Behold thy Son.\nV. We adore Thee, etc.\nJesus, my love! who for love of me didst hang in agony upon the Cross, and, unmindful of thine own sorrows, didst leave us thy own most holy Mother as the pledge of thy love, that through her intercession we might seek Thee with confidence in our greatest straits; have pity on all the faithful who are in their last agony, and pity me when I too shall be in mine. By the inward martyrdom of thy dear Mother, quicken in our hearts a firm hope in the infinite merits of thine own most Precious Blood, that so we may escape the sentence of eternal death, which we have merited by our sins. Gloria Patri, thrice.\nV. Have mercy, etc. My God, etc.",
      "Fourth Word: My God, my God, why hast Thou forsaken Me?\nV. We adore Thee, etc.\nJesus, my love! who for love of me didst hang in agony upon the Cross, and, whilst suffering after suffering was heaped upon Thee, with all thy bodily pain didst bear with infinite patience the most afflicting desolation of spirit, being forsaken by thine Eternal Father; pity all the faithful who are in their last agony, and pity me when I too shall be in mine. By the merits of thy most Precious Blood, grant us all thy grace, that we may suffer with patience the pain and anguish of our last agony, and so, joining our pains with thine, be made partakers of thy glory in Paradise. Gloria Patri, thrice.\nV. Have mercy, etc. My God, etc.",
      "Fifth Word: I thirst.\nV. We adore Thee, etc.\nJesus, my love! who for love of me didst hang in agony upon the Cross, and who, insatiable in thy thirst for insults and sufferings, didst will yet more and more to suffer, that all men might be saved, showing thereby that all the torrent of thy Passion was not enough to quench the thirst of thy most loving Heart; pity all the faithful who are in their last agony, and pity me when I too shall be in mine. By the merits of thy most Precious Blood, kindle in our hearts such fire of charity as may make them burn to be made one with Thee for all eternity. Gloria Patri, thrice.\nV. Have mercy, etc. My God, etc.",
      "Sixth Word: It is consummated.\nV. We adore Thee, etc.\nJesus, my love! who for love of me didst hang in agony upon the Cross, and from this pulpit of truth didst announce that the work of our redemption was finished—that work through which, from children of wrath and perdition, we become God's children and the heirs of heaven; pity all the faithful who are in their last agony, and pity me when I too shall be in mine. By the merits of thy most Precious Blood, detach us wholly from the world and from ourselves, and at the moment of our agony grant us grace to offer Thee with all our hearts the sacrifice of our life, in expiation for our sins. Gloria Patri, thrice.\nV. Have mercy, etc. My God, etc.",
      "Seventh Word: Father, into Thy hands I commend My spirit.\nV. We adore Thee, etc.\nJesus, my love! who for love of me didst hang in agony upon the Cross, and who in accomplishment of the great sacrifice didst accept the will of thine Eternal Father, commending thy spirit into his hands, and so didst bow thy head and die; pity all the faithful who are in their last agony, and pity me when I too shall be in mine. By the merits of thy most Precious Blood, give us in our agony an entire conformity to thy divine will, that ready to live or die as it please Thee, we may desire nothing so much as that thine adorable will may ever find its full accomplishment in us. Gloria Patri, thrice.\nV. Have mercy, etc. My God, etc.",
      "Prayer to the Holy Virgin, Mother of Sorrows.\nMost Holy Mother of sorrows, by that intense martyrdom which thou didst suffer at the foot of the Cross during the three hours of the agony of Jesus, deign to aid us all, children of thy sorrows, in our last agony, that by thy prayers we may pass from our bed of death to adorn thy crown in Paradise. Ave Maria, thrice.",
      "Mother of mercy, Mother of grace,\nMary, help a fallen race;\nShield us when the foe is nigh,\nAnd receive us when we die.",
      "V. From sudden and unprepared death,\nR. Deliver us, O Lord.\nV. From the snares of the devil,\nR. Deliver us, O Lord.\nV. From everlasting death,\nR. Deliver us, O Lord.",
      "Let us pray.",
      "God, who for the salvation of the human race hast, in the most bitter death of thy Son, made for us both an example and a refuge; grant, we beseech Thee, that in the last peril, at the hour of our death, we may merit to obtain the full effect of his great charity, and be made partakers of our Redeemer's glory. Through the same Jesus Christ our Lord. Amen.",
      "End with the three ejaculations,\nJesus, Mary, and Joseph, I give you my heart and my soul.\nJesus, Mary, and Joseph, assist me in my last agony.\nJesus, Mary, and Joseph, may I breathe forth my soul with you in peace.",
    ],
    latin: [
      "V. Deus, in adjutorium meum intende.\nR. Domine, ad adjuvandum me festina.\nV. Gloria Patri, etc.",
      "V. Adoramus te, Christe, et benedicimus tibi.\nR. Quia per sanctam crucem tuam redemisti mundum.\nMiserere nostri, Domine, miserere nostri.",
      "Maria, mater gratiæ,\nMater misericordiæ,\nTu nos ab hoste protege,\nEt mortis hora suscipe.",
      "V. A subitanea et improvisa morte,\nR. Libera nos, Domine.\nV. Ab insidiis diaboli,\nR. Libera nos, Domine.\nV. A morte perpetua,\nR. Libera nos, Domine.",
      "Oremus.",
      "Deus, qui ad humani generis salutem in dolorosissima Filii tui morte exemplum et subsidium constituisti; concede, quæsumus, ut in extremo mortis nostræ periculo tantæ charitatis effectum consequi et ipsius Redemptoris gloriæ consociari mereamur. Per eundem Christum Dominum nostrum. R. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["good-friday", "lent", "for-the-dying", "preparation-for-death"],
    summary: `A meditation on each of the seven last words of Christ from the Cross, every one closing with a prayer for all who are in their last agony and for oneself at the hour of death, three Glory Bes, and acts of faith, hope, love and contrition; it ends with a prayer to the Mother of Sorrows, the verse Maria, mater gratiae, versicles against sudden death and the three invocations of Jesus, Mary and Joseph. Raccolta no. 122, indulgenced by Leo XIII in 1897; the Latin is that of the versicles, verse and collect the book prints beside the English. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "deus-qui-pro-redemptione-mundi",
    title: "Prayer to Christ in His Passion (Deus, qui pro redemptione mundi)",
    pages: [106],
    body: [
      "O God, who to redeem the world didst vouchsafe to be born amongst men, to be circumcised, rejected by the Jews, betrayed by the traitor Judas with a kiss, to be bound with cords, and as an innocent lamb to be led to the slaughter; who didst suffer thyself to be shamelessly exposed to the gaze of Annas, Caiphas, Pilate and Herod; to be accused by false witnesses, tormented by scourges and insults, crowned with thorns, smitten with blows, defiled with spittings, to have thy divine countenance covered, to be struck with a reed, to be stripped of thy clothes, nailed to and raised high upon a Cross between two thieves, to be given gall and vinegar to drink, and then pierced with a lance; do Thou, O Lord, by these most sacred sufferings, which I, unworthy as I am, yet dare to contemplate, by thy holy Cross and by thy bitter Death, free me from the pains of hell, and vouchsafe to bring me to Paradise, whither Thou didst lead the thief who was crucified with Thee, my Jesus, who with the Father and the Holy Ghost livest and reignest God for ever and ever. Amen. Pater, Ave and Gloria five times.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["lent", "good-friday", "passion"],
    summary: `The old prayer Deus, qui pro redemptione mundi, which recounts the sufferings of Christ from his birth and circumcision to the lance, and asks by them to be freed from the pains of hell and brought to Paradise like the good thief; it is followed by five Our Fathers, Hail Marys and Glory Bes. Raccolta no. 125, indulgenced by Pius VII in 1820. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "five-credos-of-saint-pius-v",
    title: "The Five Creeds of Saint Pius V (My Lord Jesus Christ crucified)",
    pages: [108, 109],
    body: [
      "I\nO my Lord Jesus Christ crucified, Son of the most blessed Virgin Mary, open thine ears, and listen to me as Thou didst listen to the Eternal Father on Mount Tabor. Credo.",
      "II\nO my Lord Jesus Christ crucified, Son of the most Blessed Virgin Mary, open thine eyes, and look upon me as Thou didst look from the tree of the Cross upon thy dear Mother sorrowing and afflicted. Credo.",
      "III\nO my Lord Jesus Christ crucified, Son of the most Blessed Virgin Mary, open thy blessed mouth, and speak to me as Thou didst speak to St John when Thou gavest him for son to thine own most beloved Mother. Credo.",
      "IV\nO my Lord Jesus Christ crucified, Son of the most Blessed Virgin Mary, open thine arms and embrace me as Thou didst open them upon the Cross to embrace the whole human race. Credo.",
      "V\nO my Lord Jesus Christ crucified, Son of the most Blessed Virgin Mary, open thy Heart and receive therein my heart, and hear me in all that I ask of Thee, if so be it be agreeable to thy most holy will. Credo.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["lent", "friday", "passion"],
    summary: `Five short petitions to Christ crucified — to open his ears, his eyes, his mouth, his arms and his Heart to the one who prays — each followed by the Apostles' Creed; the Raccolta (no. 128) says they are known as the Five Credos of St Pius V. Pius IX indulgenced them in 1859. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "invocation-of-saint-thomas-aquinas-to-the-cross",
    title: "Invocation of Saint Thomas Aquinas to the Cross (Crux mihi certa salus)",
    pages: [109],
    body: [
      "The Cross is my sure salvation. The Cross I ever adore. The Cross of my Lord is with me. The Cross is my refuge.",
    ],
    latin: [
      "Crux mihi certa salus. Crux est quam semper adoro. Crux Domini mecum. Crux mihi refugium.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["exaltation-of-the-holy-cross", "lent", "protection"],
    relatedSaints: ["saint-thomas-aquinas"],
    summary: `Four short acclamations of the Cross as salvation, object of adoration, companion and refuge, which the Raccolta (no. 129) gives as an invocation of St Thomas Aquinas and prints in Latin and English. Pius IX indulgenced it in 1874. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayers-of-saint-clare-to-the-five-wounds",
    title: "Prayers of Saint Clare of Assisi to the Five Wounds",
    pages: [109, 110, 111],
    body: [
      "I. To the Wound in the Right Hand.\nPraise be to Thee, O Jesus Christ, for the most sacred wound in thy Right Hand. By this adorable wound, and by thy most sacred Passion, pardon me all the sins I have committed against Thee in thought, word and deed, and all negligence in thy service, and all sensuality for which I have been to blame whether asleep or awake. Grant that I may be able to recall with devotion thy most pitiful death and sacred wounds; grant me the grace to mortify my body, and so to offer a pledge of my gratitude to Thee, who livest and reignest world without end. Amen. Pater noster, Ave Maria.",
      "II. To the Wound in the Left Hand.\nPraise and glory be to Thee, O sweetest Jesus Christ, for the most sacred wound in thy Left Hand. By this adorable wound, have mercy on me, and deign to root out of my heart everything displeasing to Thee. Give me the victory over thy perverse enemies, so that with thy grace I may be able to overcome them; and by the merits of thy most pitiful death save me from all the dangers of my present and future life; and then, grant that I may share thy glory in heaven, who livest and reignest for ever and ever. Amen. Pater noster and Ave Maria.",
      "III. To the Wound in the Right Foot.\nPraise and glory be to Thee, O sweet Jesus Christ, for the most sacred wound in thy Right Foot; and by that adorable wound, grant me grace to do penance for my sins. And by thy most pitiful death I devoutly beg of Thee to keep me, thy poor servant, united, night and day, to thy holy will, and to remove afar off every misfortune of body and soul. And when the day of wrath shall come, receive me into thy mercy, and lead me to eternal happiness. Who livest and reignest world without end. Amen. Pater noster and Ave Maria.",
      "IV. To the Wound in the Left Foot.\nPraise and glory be to Thee, most merciful Jesus Christ, for the most sacred wound in thy Left Foot; and by this adorable wound, grant me the grace of a full pardon, that with thine aid I may deserve to escape the sentence of eternal reprobation. I pray Thee, moreover, by thy most holy death, O my loving Redeemer, that I may be able before my death to receive the sacrament of thy Body and Blood, after confession of my sins, and with perfect repentance and purity of body and mind. Grant that I may merit also to receive the holy anointing, for my eternal salvation, O Lord, who liveth and reigneth world without end. Amen. Pater noster and Ave Maria.",
      "V. To the Wound in the sacred Side.\nPraise and glory be to Thee, most loving Jesus Christ, for the most sacred wound in thy Side, and by that adorable wound, and by thy infinite mercy, which Thou didst make known in the opening of thy Breast to the soldier Longinus, and so to us all, I pray Thee, O most gentle Jesus, that having redeemed me by baptism from original sin, so now by thy Precious Blood, which is offered and received throughout the world, deliver me from all evils, past, present and to come. And by thy most bitter death give me a lively faith, a firm hope, and a perfect charity, so that I may love Thee with all my heart, and all my soul, and all my strength; make me firm and steadfast in good works, and grant me perseverance in thy service, so that I may be able to please Thee always. Amen. Pater noster and Ave Maria.",
      "V. We adore Thee, O Christ, and we bless Thee.\nR. Because by thy death and Blood Thou hast redeemed the world.",
      "Let us pray.",
      "Almighty and everlasting God, who by the five wounds of thy Son, our Lord Jesus Christ, hast redeemed the human race, grant to thy suppliants that we who daily venerate those wounds may, by the shedding of his Precious Blood, be freed from sudden and everlasting death. Through the same Christ our Lord. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["lent", "friday", "august-11", "passion"],
    relatedSaints: ["saint-clare-of-assisi"],
    summary: `Five prayers of praise to the wounds of Christ in his hands, feet and side, which the Raccolta (no. 130) gives as St Clare of Assisi's, asking pardon, perseverance, a good death with the last sacraments, and faith, hope and charity, each with an Our Father and Hail Mary and closing with a collect of the Five Wounds. Leo XIII indulgenced them in 1885. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-our-lord-scourged-at-the-pillar",
    title: "Prayer to Our Lord Scourged at the Pillar",
    pages: [113, 114],
    body: [
      "My divine Saviour, what didst Thou become, when for love of souls Thou didst allow thyself to be bound to the column? Oh, how literally was then fulfilled the word of the prophet, that from head to foot Thou shouldst be all one wound, and such as not to be recognized for what Thou wast. What shame when they stripped Thee of thy clothes! What torment under the tempest of blows, multiplied without measure! What a profusion of blood from thy streaming wounds!",
      "But it was neither the injustice of the Roman governor nor the cruelty of the soldiers that scourged Thee, but my sins. O miserable pleasures which have cost Thee such pains! O hardness of heart, when, knowing Thee to be tormented for my sake, I have gone on offending Thee!",
      "From to-day, then, it shall be so no more. Bound to Thee with eternal bonds and fastened with Thee to the column, as long as my life endures, I will make satisfaction to thy offended justice.",
      "By the column to which Thou wast bound, by the scourges which furrowed thy innocent flesh, by the blood Thou didst shed in such abundance, have pity, O Lord, have pity, on me in my desolation. Release me this day from the snares of the tempter and preserve me from them for ever; and at the end of this exile, receive me in heaven. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["lent", "passion", "penance"],
    summary: `A meditation turned into prayer before Christ bound to the pillar, confessing that it was the sinner's own sins, not Pilate or the soldiers, that scourged Him, and resolving to make satisfaction for the rest of life. Raccolta no. 132, indulgenced by Leo XIII through the Cardinal Vicar in 1886. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "ecce-crucem-domini",
    title: "Behold the Cross of the Lord (Ecce Crucem Domini)",
    pages: [114],
    body: [
      "Behold the Cross of the Lord, ✠ flee ye adversaries, the Lion of the tribe of Juda has conquered, the root of David. Alleluia.",
    ],
    latin: [
      "Ecce Crucem Domini ✠ fugite partes adversæ, vicit Leo de tribu Juda, radix David. Alleluia.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["protection", "spiritual-warfare", "exaltation-of-the-holy-cross"],
    relatedSaints: ["saint-anthony-of-padua"],
    summary: `The invocation Ecce Crucem Domini, known as the "Brief of St Anthony" from the legend that St Anthony of Padua gave it written out to a woman troubled by the devil, taken from the Apocalypse (5:5); the cross printed in the text marks where the sign of the cross is made. The Raccolta (no. 134) prints it in Latin and English; Leo XIII indulgenced it in 1892. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-our-lord-on-the-cross-for-the-hour-of-death",
    title: "Prayer to Our Lord on the Cross for the Hour of Death (Jesu mi crucifixe)",
    pages: [114, 115],
    body: [
      "My crucified Jesus, mercifully accept the prayer which I now make to Thee for help in the moment of my death, when at its approach all my senses shall fail me.",
      "When therefore, O sweetest Jesus, my weary and downcast eyes can no longer look up to Thee, be mindful of the loving gaze which now I turn on Thee, and have mercy on me.",
      "When my parched lips can no longer kiss thy most sacred wounds, remember then those kisses which now I imprint on thee, and have mercy on me.",
      "When my cold hands can no longer embrace thy Cross, forget not the affection with which I embrace it now, and have mercy on me.",
      "And when, at length, my swollen and lifeless tongue can no longer speak, remember that I called upon Thee now.",
      "Jesu, Joseph, Mary, to you I commend my soul.",
    ],
    latin: [
      "Jesu mi crucifixe, suscipe benignus precem quam nunc pro meæ mortis articulo tibi fundo, quando illa jam appetente, omnes mei sensus deficient.",
      "Cum igitur, dulcissime Jesu, mei oculi languidi et demissi te non amplius respicere poterunt, memento illius succensi aspectus, quem nunc tibi converto, et miserere mei.",
      "Cum labia mea arefacta non amplius tuas sacratissimas plagas osculari poterunt, memento illorum osculorum, quæ nunc tibi figo, et miserere mei.",
      "Cum manus meæ frigidæ non amplius tuam crucem amplecti poterunt, memento sensus, quo nunc hoc ago, et miserere mei.",
      "Et cum tandem mea lingua tumens et immobilis non amplius loqui poterit, memento meæ invocationis hujus momenti.",
      "Jesu, Joseph, Maria, vobis commendo animam meam.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["preparation-for-death", "for-the-dying", "good-friday"],
    summary: `A prayer made now, before the crucifix, for the moment of death when the senses fail: when the eyes can no longer look up, the lips no longer kiss the wounds, the hands no longer embrace the Cross and the tongue no longer speak, Christ is asked to remember the love shown Him now. The Raccolta (no. 135) prints it in Latin and English; Pius X indulgenced it in 1903. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-to-the-holy-face-of-jesus-dead",
    title: "Prayer to the Holy Face of Jesus Dead (Saint Thérèse of Lisieux)",
    pages: [115, 116],
    body: [
      "O Jesus, who in thy bitter Passion didst become the reproach of men and the man of sorrows, I venerate thy sacred face on which shone the grace and sweetness of the Divinity, now for my sake changed into the likeness of a leper. But under this deformity I perceive thy infinite love, and I am overwhelmed with the desire of loving Thee and making Thee beloved by all men. The tears which stream from thy eyes seem as precious pearls, which I love to gather up, in order to purchase with their infinite value the souls of poor sinners.",
      "O Jesus, thy face is the only beauty which ravishes my heart. I am content not to see here below the sweetness of thy look, not to feel the ineffable delight of a kiss of thy mouth; but oh! I beseech Thee print on me thy divine likeness, and inflame me with thy love, so that it may rapidly consume me, and I may soon come to see thy glorious face in Heaven. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["lent", "holy-face", "good-friday"],
    relatedSaints: ["saint-therese-of-lisieux"],
    summary: `A prayer of veneration of the Holy Face of Christ disfigured in the Passion, whose tears are gathered "as precious pearls" to purchase the souls of sinners. Its words are those of St Thérèse of Lisieux's prayer to the Holy Face; the Raccolta (no. 136), published before her beatification, prints it under the title "Prayer to Jesus Dead" without naming her. Pius X indulgenced it in 1906. ${ST_JOHN}`,
  }),
  raccolta({
    slug: "prayer-for-a-happy-death-o-jesus-while-adoring-thy-last-breath",
    title:
      "Prayer for a Happy Death in Union with the Death of Jesus (O Jesus, while adoring thy last breath)",
    pages: [116],
    body: [
      "O Jesus, while adoring thy last breath, I pray Thee to receive mine. In the uncertainty whether I shall have the command of my senses, when I shall depart out of this world, I offer Thee from this moment my agony and all the pains of my passing away. Thou art my Father and my Saviour, and I give back my soul into thy hands. I desire that my last moment may be united to the moment of thy death, and that the last beat of my heart may be an act of pure love of Thee. Amen.",
    ],
    prayerType: "general",
    category: "devotional",
    occasions: ["preparation-for-death", "good-friday", "evening"],
    summary: `A prayer of offering of one's own death, made in advance while the senses are still at command, asking that the last moment be united to the moment of Christ's death and the last heartbeat be an act of pure love. Raccolta no. 137, indulgenced by Leo XIII in 1902. ${ST_JOHN}`,
  }),
];
