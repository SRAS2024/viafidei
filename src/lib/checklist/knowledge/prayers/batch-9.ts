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
 * is read "O most just God" (no. 58). The book's own errata ("Notification",
 * November 1909) are applied where they touch these prayers: "mi sery" is
 * "misery" (no. 10, page 9), "in perfection of thy ways" is "in the
 * perfection of thy ways" (no. 48) and "whom Thou has redeemed" is "whom Thou
 * hast redeemed" (no. 49, both page 45).
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
];
