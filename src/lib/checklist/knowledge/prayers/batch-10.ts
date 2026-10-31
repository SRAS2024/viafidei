import type { CuratedEntry } from "../index";

const RACCOLTA = "https://archive.org/details/theraccoltaorcol00unknuoft/page/";
// A page of the 1910 Raccolta scan on archive.org: its printed page number,
// or "nNNN" (zero-based leaf index) for an unnumbered leaf.
const page = (n: number | string) => `${RACCOLTA}${n}/mode/1up`;

/**
 * Batch 10 of the curated prayer catalogue: prayers from the 1910 English
 * Raccolta (London: Burns & Oates; the translation of Ambrose St John of the
 * Birmingham Oratory, revised there for this edition) — to the Blessed Virgin
 * under her various titles, the holy angels, St Joseph and the saints, for the
 * dying and the faithful departed, for the Pope and the Church, and for other
 * intentions.
 *
 * The book was published in 1910 and is in the public domain. Every entry cites
 * the page of the archive.org scan (University of Toronto copy,
 * theraccoltaorcol00unknuoft) on which the prayer begins, and each body is that
 * page's text word for word: the typed text was compared with the archive.org
 * OCR and with an independent OCR of the same page images, and every point where
 * either disagreed was checked against the scan. Corrections are limited to
 * plain scanning slips. Typography is normalised, never wording: words the book
 * sets in small capitals (God, Lord, Jesus Christ, Father, Holy Ghost) and the
 * capitalised word after a drop initial are written in ordinary case, the signs
 * ℣ and ℟ are written V. and R., lines broken by the page are rejoined, and
 * rubrics printed in italics ("Ave Maria thrice") are kept as plain text. The
 * indulgence notes printed with each prayer are not part of its text and are
 * left out, as are the book's cross-references to its own page numbers; a
 * summary names the granting Pope only as the book records him, not as a
 * present-day indulgence.
 *
 * Where the book's own list of corrections (the unnumbered "Notification" leaf
 * after the contents, cited second) corrects a word on the page, the corrected
 * reading is given and the summary says so. A `latin` value is given only where
 * the same page prints the Latin alongside the English. Prayers whose text is
 * already in the catalogue under another title were left out.
 */
export const prayerBatch10: CuratedEntry[] = [
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-sunday-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(155)],
    payload: {
      slug: "prayer-to-our-lady-for-sunday-saint-alphonsus",
      title: "Prayer to Our Lady for Sunday (St Alphonsus Liguori)",
      body: "Mother of my God, look down upon a poor sinner, who has recourse to thee and puts his trust in thee. I am not worthy that thou shouldst even cast thine eyes upon me; but I know that thou, beholding Jesus thy Son dying for sinners, dost thyself yearn exceedingly to save them. O Mother of Mercy, look on my miseries and have pity upon me. Men say thou art the refuge of the sinner, the hope of the desperate, the aid of the lost; be thou, then, my refuge, hope, and aid. It is thy prayers which must save me. For the love of Jesus Christ be thou my help; reach forth thy hand to the poor fallen sinner who recommends himself to thee. I know that it is thy joy to aid the sinner when thou canst; help me now, thou who canst help. By my sins I have forfeited the grace of God and my own soul. I place myself in thy hands; oh, tell me what to do that I may regain the grace of God, and I will do it. My Saviour bids me go to thee for help; He wills that I should look to thy pity; that so, not only the merits of thy Son, but thine own prayers too, may unite to save me. To thee, then, I have recourse: pray thou to Jesus for me; and make me experience how great good thou canst do for one who trusts in thee. Be it done unto me according to my hope. Amen.\n\nThen say thrice Ave Maria to the Blessed Virgin Mary, in reparation for the blasphemies uttered against her.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The Sunday prayer of the seven prayers to the Blessed Virgin for the days of the week that the Raccolta gives under the name of St Alphonsus Liguori, each followed by three Hail Marys. A sinner who has lost the grace of God turns to Mary as refuge and hope of sinners and asks her to show him how to regain it. For Sunday the book adds that the three Hail Marys are said in reparation for blasphemies against her. The Raccolta records the set's indulgence by Pius VII in 1808.",
      occasions: ["sunday", "marian-devotion", "daily"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(155)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-monday-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(156)],
    payload: {
      slug: "prayer-to-our-lady-for-monday-saint-alphonsus",
      title: "Prayer to Our Lady for Monday (St Alphonsus Liguori)",
      body: "Most holy Mary, Queen of Heaven, I who was once the slave of the Evil One now dedicate myself to thy service for ever; and I offer myself, to honour and to serve thee as long as I live. Accept me for thy servant, and cast me not away from thee as I deserve. In thee, O my Mother, I place all my hope. All blessing and thanksgiving be to God, who in his mercy giveth me this trust in thee. True it is, that in past time I have fallen miserably into sin; but by the merits of Jesus Christ, and by thy prayers, I hope that God has pardoned me. But this is not enough, my Mother. One thought appals me; it is, that I may yet lose the grace of God. Danger is ever nigh; the devil sleeps not; fresh temptations assail me. Protect me, then, my Queen; help me against the assaults of my spiritual enemy. Never suffer me to sin again, or to offend Jesus thy Son. Let me not by sin lose my soul, heaven, and my God. This one grace, Mary, I ask of thee; this is my desire; this may thy prayers obtain for me. Such is my hope. Amen. Ave Maria thrice.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The Monday prayer of the seven prayers to the Blessed Virgin for the days of the week that the Raccolta gives under the name of St Alphonsus Liguori. Once the slave of the Evil One, the one praying dedicates himself to Mary's service for ever and begs her protection against the danger of losing the grace of God again. It closes with three Hail Marys; the Raccolta records the set's indulgence by Pius VII in 1808.",
      occasions: ["monday", "marian-devotion", "daily"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(156)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-tuesday-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(156)],
    payload: {
      slug: "prayer-to-our-lady-for-tuesday-saint-alphonsus",
      title: "Prayer to Our Lady for Tuesday (St Alphonsus Liguori)",
      body: "Most holy Mary, Mother of Goodness, Mother of Mercy, when I reflect upon my sins and upon the moment of my death, I tremble and am confounded. O my sweetest Mother, in the Blood of Jesus, in thy intercession, are my hopes. Comforter of the sad, abandon me not at that hour; fail not to console me in that affliction. If even now I am so tormented by remorse for the sins I have committed, the uncertainty of my pardon, the danger of a relapse, and the strictness of the Judgment, how will it be with me then? O my Mother, before death overtake me, obtain for me great sorrow for my sins, a true amendment, and constant fidelity to God for the remainder of my life. And when at length my hour is come, then do thou, Mary, my hope, be thyself my aid in those great troubles wherewith my soul will be encompassed. Strengthen me, that I may not despair when the enemy sets my sins before my face. Obtain for me at that moment grace to invoke thee often, so that with thine own sweet name and that of thy most holy Son upon my lips I may breathe forth my spirit. This grace thou hast granted to many of thy servants; this, too, is my hope and my desire. Ave Maria thrice.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The Tuesday prayer of the seven prayers to the Blessed Virgin for the days of the week that the Raccolta gives under the name of St Alphonsus Liguori. Trembling at the thought of death and judgment, the one praying asks Mary to obtain sorrow for sin and fidelity to God, and to stand by him at the last hour so that he may die with the names of Jesus and Mary on his lips. It closes with three Hail Marys; the Raccolta records the set's indulgence by Pius VII in 1808.",
      occasions: ["tuesday", "marian-devotion", "preparation-for-death", "daily"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(156)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-wednesday-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(157)],
    payload: {
      slug: "prayer-to-our-lady-for-wednesday-saint-alphonsus",
      title: "Prayer to Our Lady for Wednesday (St Alphonsus Liguori)",
      body: "Mother of God, most holy Mary, how often by my sins have I merited hell! Long ago, perhaps, judgment would have gone forth against my first mortal sin, hadst not thou in thy tender pity delayed the justice of God, and afterwards attracted me by thy sweetness to have confidence in thy prayers. And oh, how very often should I have fallen in the dangers which beset my steps hadst not thou, loving Mother that thou art, preserved me by the graces thou, by thy prayers, didst obtain for me. But oh, my Queen, what will thy pity and thy favours avail me, if after all I perish in the flames of hell? If there was once a time when I loved thee not, yet now, next to God, I love thee before all. Wherefore, henceforth and for ever, suffer me not to turn my back upon thee and upon my God, who through thee has granted me so many mercies. O Lady, most worthy of all love, let it not be that I, thy child, should be doomed to hate and to curse thee for ever in hell. Thou wilt surely never endure to see thy servant lost who loves thee. O Mary, say not that I ever can be lost! Yet lost I shall assuredly be if I abandon thee. But who could ever have the heart to leave thee? Who can ever forget thy love? No, it is impossible for that man to perish who faithfully recommends himself to thee, and has recourse to thee. Only leave me not, my Mother, in my own hands, or I am lost! Let me but cling to thee! Save me, my hope! save me from hell; or, rather, save me from sin, which alone can condemn me to hell. Ave Maria thrice.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The Wednesday prayer of the seven prayers to the Blessed Virgin for the days of the week that the Raccolta gives under the name of St Alphonsus Liguori. The one praying thanks Mary for the mercies obtained through her and begs never to be separated from her, since no one who faithfully recommends himself to her can perish. The Raccolta also prescribes this prayer, followed by three Salve Reginas, as a separately indulgenced prayer of St Alphonsus (no. 190).",
      occasions: ["wednesday", "marian-devotion", "daily"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(157)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-thursday-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(158)],
    payload: {
      slug: "prayer-to-our-lady-for-thursday-saint-alphonsus",
      title: "Prayer to Our Lady for Thursday (St Alphonsus Liguori)",
      body: "Queen of heaven, who sittest enthroned above all the choirs of the angels nighest to God, from this vale of miseries I, a poor sinner, say to thee, “Hail, Mary,” praying thee in thy love to turn upon me those gracious eyes of thine. See, Mary, the dangers among which I dwell, and shall ever have to dwell whilst I live upon this earth. I may yet lose my soul, Paradise, and God. In thee, Lady, is my hope. I love thee; and I sigh after the time when I shall see thee and praise thee in Paradise. O Mary, how soon will the happy day come when I shall see myself safe at thy feet? When shall I kiss that hand, which has dispensed to me so many graces? Alas, it is too true, my Mother, that I have ever been very ungrateful during my whole life; but if I get to Heaven, then I will love thee there every moment of a whole eternity, and make thee reparation in some sort for my ingratitude by ever blessing and praising thee. Thanks be to God, for that He hath vouchsafed me this hope through the Precious Blood of Jesus, and through thy powerful intercession. This has been the hope of all thy true lovers; and no one of them has been defrauded of his hope. No, neither shall I be defrauded of mine. O Mary, pray to thine own Son Jesus, as I too pray to Him, by the merits of his Passion, to strengthen and increase this hope. Amen. Ave Maria thrice.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The Thursday prayer of the seven prayers to the Blessed Virgin for the days of the week that the Raccolta gives under the name of St Alphonsus Liguori. Greeting the Queen of heaven from this vale of miseries, the one praying longs for the day when he will see her in Paradise and asks her to strengthen his hope of salvation through the Precious Blood of Jesus. It closes with three Hail Marys; the Raccolta records the set's indulgence by Pius VII in 1808.",
      occasions: ["thursday", "marian-devotion", "daily"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(158)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-friday-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(158)],
    payload: {
      slug: "prayer-to-our-lady-for-friday-saint-alphonsus",
      title: "Prayer to Our Lady for Friday (St Alphonsus Liguori)",
      body: "O Mary, thou art the noblest, highest, purest, fairest creature of God, the holiest of all creatures! Oh, that all men knew thee, loved thee, my Queen, as thou deservest to be loved! Yet great is my consolation, Mary, in that there are blessed souls in the courts of heaven, and just souls still on earth, whose hearts thou leadest captive with thy beauty and thy goodness. But above all I rejoice in this, that our God Himself loves thee alone more than all men and angels together. I too, O loveliest Queen, I, miserable sinner, dare to love thee, though my love is too little; I would I had a greater love, a more tender love; this thou must gain for me, since to love thee is a great mark of predestination, and a grace which God grants to those who shall be saved. Moreover, O my Mother, when I reflect upon the debt I owe thy Son, I see He deserves of me an immeasurable love. Do thou, then, who desirest nothing so much as to see Him loved, pray that I may have this grace—a great love for Jesus Christ. Obtain it, thou who obtainest what thou wilt. I covet not goods of earth, nor honours, nor riches, but I desire that which thine own heart desires most—to love my God alone. Oh, can it be that thou wilt not aid me in a desire so acceptable to thee? No, it is impossible! Even now I feel thy help; even now thou prayest for me. Pray for me, Mary, pray; nor ever cease to pray, till thou dost see me safe in Paradise, where I shall be certain of possessing and of loving my God and thee, my dearest Mother, for ever and for ever. Amen. Ave Maria thrice.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The Friday prayer of the seven prayers to the Blessed Virgin for the days of the week that the Raccolta gives under the name of St Alphonsus Liguori. Praising Mary as the holiest of God's creatures, the one praying asks her to obtain for him a greater love of herself and above all a great love for Jesus Christ, and to pray for him until she sees him safe in Paradise. It closes with three Hail Marys; the Raccolta records the set's indulgence by Pius VII in 1808.",
      occasions: ["friday", "marian-devotion", "daily"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(158)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-saturday-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(159)],
    payload: {
      slug: "prayer-to-our-lady-for-saturday-saint-alphonsus",
      title: "Prayer to Our Lady for Saturday (St Alphonsus Liguori)",
      body: "Most holy Mary, I know the graces which thou hast obtained for me, and I know the ingratitude which I have shown thee. The ungrateful man is unworthy of favours, and yet for all this I will not distrust thy mercy. O my great Advocate, have pity on me. Thou, Mary, art the stewardess of every grace which God vouchsafes to give us sinners, and therefore did He make thee so mighty, rich, and kind, that thou mightest succour us. I will that I may be saved: in thy hands I place my eternal salvation, to thee I consign my soul. I will to be associated with those who are thy special servants: reject me not. Thou goest up and down seeking the wretched, to console them. Cast not away, then, a wretched sinner who has recourse to thee. Speak for me, Mary; thy Son grants what thou askest. Take me beneath thy shelter, and it is enough for me; for with thee to guard me I fear no ill—no, not even my sins, because thou wilt obtain God's pardon for them; no, nor yet evil spirits, because thou art far mightier than hell; no, nor my Judge Jesus Christ, for at thy prayer He will lay aside his wrath. Protect me, then, my Mother; obtain for me pardon of my sins, love of Jesus, holy perseverance, a good death, and heaven. It is too true, I merit not these graces; yet do thou only ask them of our God and I shall obtain them. Pray, then, to Jesus for me. Mary, my Queen, in thee I trust; in this trust I rest, I live; and with this trust I will that I may die. Amen. Ave Maria thrice.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "The Saturday prayer of the seven prayers to the Blessed Virgin for the days of the week that the Raccolta gives under the name of St Alphonsus Liguori. Calling Mary the stewardess of every grace God gives to sinners, the one praying places his eternal salvation in her hands and asks pardon, love of Jesus, perseverance and a good death. It closes with three Hail Marys; the Raccolta records the set's indulgence by Pius VII in 1808.",
      occasions: ["saturday", "marian-devotion", "daily"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(159)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-twenty-five-days-before-christmas-saint-catherine-of-bologna",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(164)],
    payload: {
      slug: "prayer-for-the-twenty-five-days-before-christmas-saint-catherine-of-bologna",
      title: "Prayer for the Twenty-five Days before Christmas (after St Catherine of Bologna)",
      body: "In lowly reverence at thy feet we kneel, great Mother of our God, most holy Mary, advocate of sinners; humbly praying thee, by the merits of the Precious Blood of thy Divine Son, shed for us sinners, and by the intercession of thy well-beloved servant, Catharine, to gain for us by thy prayers true fervour of spirit in this holy exercise, and the grace to walk in the way of all thy virtues, after the example of St Catharine, to the honour and glory of Jesus Christ, thine only Son our Saviour. Forget our monstrous ingratitude, look not upon our sins, but rather find for us a refuge in the depths of thy loving kindness; and having regard to that love wherewith thou didst ever love thy faithful servant Catharine, obtain for us the remission of our sins, so that we may confidently hope to attain all that we desire for our spiritual wants. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        'The prayer said each day of a twenty-five days\' preparation for Christmas that the Raccolta describes "after the example of St Catharine of Bologna", the Poor Clare abbess who honoured the Nativity by greeting Mary with a thousand Hail Marys in the days before the feast. The one praying asks Mary, through the Precious Blood and the intercession of St Catherine, for fervour in the exercise and the grace to follow her virtues. The book records its indulgence by Pius VII in 1815.',
      occasions: ["advent", "christmas", "marian-devotion"],
      relatedSaints: [],
      citations: [page(164)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "three-offerings-to-the-blessed-virgin",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(170)],
    payload: {
      slug: "three-offerings-to-the-blessed-virgin",
      title: "Three Offerings to the Most Holy Virgin",
      body: "Most Holy Virgin, I venerate thee with my whole heart above all angels and saints in Paradise, as the Daughter of the Eternal Father, and I consecrate to thee my soul with all its powers. Ave Maria.\n\nMost Holy Virgin, I venerate thee with my whole heart above all angels and saints in Paradise, as the Mother of the Only-begotten Son, and I consecrate to thee my body with all its senses. Ave Maria.\n\nMost Holy Virgin, I venerate thee with my whole heart above all angels and saints in Paradise, as the Spouse of the Holy Ghost, and I consecrate to thee my heart and all its affections, praying thee to obtain for me from the ever-blessed Trinity all that is necessary for my salvation. Ave Maria.",
      prayerType: "consecration",
      category: "marian",
      language: "en",
      summary:
        "Three short acts of homage in which the Blessed Virgin is venerated above all angels and saints as Daughter of the Father, Mother of the Son and Spouse of the Holy Ghost, and soul, body and heart are consecrated to her in turn, each act closing with a Hail Mary. The Raccolta records their indulgence by Leo XII in 1823.",
      occasions: ["marian-devotion", "daily", "morning"],
      relatedSaints: [],
      citations: [page(170)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-the-virgin-treasurer-of-graces",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(171)],
    payload: {
      slug: "prayer-to-the-virgin-treasurer-of-graces",
      title: "Prayer to the Virgin Most Holy, Treasurer of Graces",
      body: "Virgin most holy, Mother of the Word Incarnate, Treasurer of graces, Refuge of us poor sinners; we fly to thy maternal love with lively faith, and we ask thee to obtain for us grace ever to do the will of God and thine own. Into thy most holy hands we commit the keeping of our hearts; beseeching thee for health of soul and body, in the certain hope that thou, our most loving Mother, wilt hear our prayer. Wherefore with lively faith we say, Ave Maria thrice.\n\nLet us pray.\n\nDefend, O Lord, we beseech Thee, us thy servants, through the intercession of the Blessed Mary ever-Virgin, from all infirmity both of body and soul; and mercifully protect from the snares of enemies those who, with their whole heart, prostrate themselves before Thee. Through Christ our Lord. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A prayer entrusting the keeping of the heart to the Blessed Virgin, Mother of the Incarnate Word and treasurer of graces, asking the grace always to do the will of God and health of soul and body. It is followed by three Hail Marys and the collect Defend, O Lord, which asks protection from all infirmity through her intercession. The Raccolta records its indulgence by Leo XII in 1824.",
      occasions: ["marian-devotion", "daily", "sickness"],
      relatedSaints: [],
      citations: [page(171)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-excellentissima",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(171)],
    payload: {
      slug: "o-excellentissima",
      title: "O Excellentissima (O Most Excellent, Glorious and Most Holy Virgin)",
      body: "O most excellent, glorious, most holy and ever inviolate blessed Virgin Mary, Mother of our Lord Jesus Christ, Queen of the world, and Mistress of all creatures! Thou who forsakest no one, despisest no one, who leavest in sadness none who seek help at thy hands with pure and lowly hearts; do not despise me because of the number and hatefulness of my sins, do not abandon me on account of my grievous iniquities nor on account of the hardness and uncleanness of my heart. Do not refuse me, thy servant, a share in thy favour and thy love. Hear me, a wretched sinner, who trusts in thy mercy and pity. Help me, O most loving Virgin Mary, in all my perils and needs, and obtain for me from thy beloved Son, Almighty God and our Lord Jesus Christ, the forgiveness of all my sins, the grace of the fear and love of thee, health and chastity of body, and deliverance from all the dangers which beset both soul and body. In the last moments of my life be thou my kind helper, and save from eternal darkness, and from evil of every kind, my poor soul, and the souls of my parents, brothers, sisters, friends, relatives, and benefactors, together with the souls of all the faithful, both living and dead; through the grace of Him whom for nine months thou didst bear in thy most holy womb, and whom thou didst place with thy holy hands in the manger, Jesus Christ our Lord, to whom be all honour given for endless ages. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "An old prayer, known by its Latin opening O Excellentissima, that greets Mary as Queen of the world and Mistress of all creatures and asks through her the forgiveness of sins, the fear and love of God, chastity, and her help at the hour of death for oneself, one's family and all the faithful living and dead. The Raccolta gives it in English and records its indulgence by Leo XII in 1828.",
      occasions: ["marian-devotion", "daily", "preparation-for-death"],
      relatedSaints: [],
      citations: [page(171)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-true-conversion",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(172)],
    payload: {
      slug: "prayer-to-our-lady-for-true-conversion",
      title: "Prayer to Our Lady for a True Conversion",
      body: "Virgin Mother of God, most holy Mary, safe refuge of sinners! to thee, who art, after God, our hope and consolation in this place of exile, to thee I have recourse with sincere confidence, though most undeserving of thy patronage. I know, on the one hand, how much I stand in need of being converted from my very heart; yet, on the other, the heinousness of my crimes strikes me with terror. To thee, then, I betake myself—to thee who art our sovereign mediator with thy dear Son Jesus, as He is with his Eternal Father. To thee, after Jesus, must I look for my amendment. Vouchsafe then, O Mother of Mercy, to obtain for me the grace of a true and lasting conversion. I wish to change my life entirely. In this I am sincere; but my evil habits and the ill use I have made of so many saving inspirations, the multitude and heinousness of my sins, and the bonds by which the world holds me, while they render amendment difficult, call for thy special assistance. Grant it to me in spite of my unworthiness. In thee I trust; do thou not reject me. Although deserving of eternal punishment, I throw myself at thy feet, sorrowful and repentant. My sins, I own, have taken from me the strength which grace imparts, have cast me out from among the adopted sons of God, have deprived me of the right to everlasting happiness, and drawn on me instead the wrath of heaven. Tell me what I must do to regain the friendship of thy Son Jesus. Beg of Him, by his Precious Blood, his bitter Passion, and cruel death on the Cross, to pardon my offences, and He will pardon them. Tell Him thy desire for my salvation, and He will save me. But as I can still fall into sin and lose the life of grace amid the dangers which encompass me, ever watch thou over me, and I shall surely triumph over the enemies who incessantly work for my ruin. Instil into my heart a lively faith, a firm hope, an ardent charity, and all the virtues suitable to my state of life; and obtain for me constancy in good, and final perseverance. In fine, be thou my loving Mother here below, and my advocate at the hour of death, that I may be of the number of those to whom thy divine Son shall say: “Come, ye blessed of my Father, possess the kingdom prepared for you.” Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A penitent's prayer to the Virgin Mother of God, refuge of sinners, asking her to obtain the grace of a true and lasting conversion, the pardon of sins through the Passion of her Son, the theological virtues and final perseverance. The Raccolta records its indulgence by Leo XII in 1828.",
      occasions: ["confession", "conversion", "penance", "marian-devotion"],
      relatedSaints: [],
      citations: [page(172)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "crown-of-twelve-stars",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(174)],
    payload: {
      slug: "crown-of-twelve-stars",
      title: "The Crown of Twelve Stars",
      body: "All praise and thanksgiving be to the ever-blessed Trinity, who hath shown unto us Mary, ever-Virgin, clothed with the sun, with the moon beneath her feet, and on her head a mystic crown of twelve stars. R. For ever and ever. Amen.\n\nLet us praise and give thanks to God the Father, who elected her for his daughter. R. Amen. Pater noster.\n\nPraise be to God the Father, who predestined her to be the Mother of his Son. R. Amen. Ave Maria.\n\nPraise be to God the Father, who preserved her from all stain in her conception. R. Amen. Ave Maria.\n\nPraise be to God the Father, who on her birthday adorned her with his choicest gifts. R. Amen. Ave Maria.\n\nPraise be to God the Father, who gave her Joseph for her pure spouse and companion. R. Amen. Ave Maria and Gloria Patri.\n\nLet us praise and give thanks to God the Son, who chose her for his Mother. R. Amen. Pater noster.\n\nPraise be to God the Son, who became Incarnate in her womb, and abode there nine months. R. Amen. Ave Maria.\n\nPraise be to God the Son, who was born of her and was nourished at her breast. R. Amen. Ave Maria.\n\nPraise be to God the Son, who in his childhood willed that Mary should teach Him. R. Amen. Ave Maria.\n\nPraise be to God the Son, who revealed to her the mysteries of the redemption of the world. R. Amen. Ave Maria and Gloria Patri.\n\nLet us praise and give thanks to God the Holy Ghost who made her his spouse. R. Amen. Pater noster.\n\nPraise be to God the Holy Ghost, who revealed to her first his name of Holy Ghost. R. Amen. Ave Maria.\n\nPraise be to God the Holy Ghost, through whose operation she became at once Virgin and Mother. R. Amen. Ave Maria.\n\nPraise be to God the Holy Ghost, through whom she became the living temple of the Most Holy Trinity. R. Amen. Ave Maria.\n\nPraise be to God the Holy Ghost, by whom she was exalted in Heaven high above all creatures. R. Amen. Ave Maria and Gloria Patri.\n\nFor the Holy Catholic Church, for the propagation of the faith, for peace among Christian princes, and for the uprooting of heresies, let us say Salve Regina, etc.",
      prayerType: "chaplet",
      category: "chaplet",
      language: "en",
      summary:
        "A chaplet of praise to the Holy Trinity for the privileges of the Blessed Virgin, the woman of the Apocalypse crowned with twelve stars: four praises each to the Father, the Son and the Holy Ghost, said with an Our Father and Hail Marys, and closed with the Salve Regina for the Church. The Raccolta records its indulgence by Gregory XVI, Pius IX and Leo XIII.",
      occasions: ["marian-devotion", "marian-feasts", "daily"],
      relatedSaints: [],
      citations: [page(174)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "ave-augustissima",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(176)],
    payload: {
      slug: "ave-augustissima",
      title: "Ave Augustissima (Hail, Queen of Peace)",
      body: "Hail, thou that art most venerable, Queen of Peace, most holy Mother of God; through the Sacred Heart of Jesus, thy Son, the Prince of Peace, procure for us the cessation of his anger, that so He may reign over us in peace. Remember, O most gracious Virgin Mary, that never was it known that any one who sought thy prayers was forsaken by God. Inspired with this confidence, I come unto Thee. Despise not my petitions, O Mother of the Incarnate Word; but in thy loving-kindness hear and answer me, O merciful, O sweet Virgin Mary.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A prayer to Mary as Queen of Peace, asking through the Sacred Heart of her Son, the Prince of Peace, that his anger may cease and He may reign over us in peace; its second half takes up the words of the Memorare. The Raccolta gives it in English under its Latin title Ave Augustissima and records its indulgence by Pius IX in 1846.",
      occasions: ["peace", "marian-devotion", "daily"],
      relatedSaints: [],
      citations: [page(176)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-saint-alphonsus-before-an-image-of-our-lady",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(201), page("n448")],
    payload: {
      slug: "prayer-of-saint-alphonsus-before-an-image-of-our-lady",
      title: "Prayer of St Alphonsus before an Image of Our Lady",
      body: "Most holy Mary, Immaculate Virgin and Mother, to thee who art the Mother of my Lord, the refuge of sinners, I, who am the most miserable of all, have recourse to-day. I worship thee, O great Queen, and I thank thee for the many favours thou hast done me up to now, especially for having preserved me from hell, which I have so often deserved. I love thee, most dear Lady; and by the love I bear thee I promise to desire ever to serve thee and to do all I can to make thee loved by others. I place all my hopes in thee, all my salvation. Accept me for thy servant and shelter me under thy mantle, O thou Mother of mercy. And since thou art so powerful with God, free me from all temptations, or obtain for me strength to overcome them as long as I live. Of thee I ask true love of Jesus Christ. Through thee I hope to die a good death. O Mother, by the love thou bearest to God, I pray thee to help me always, but specially in the last moment of my life. Do not leave me until thou seest me safe in Heaven, there to bless thee and sing thy mercies for all eternity. This is my hope. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        'A prayer of St Alphonsus Liguori to be said before a picture or statue of the Blessed Virgin: the one praying thanks her for the favours received, promises to make her loved, and asks for victory in temptation, true love of Jesus Christ and her help at the hour of death. The text follows the correction printed in the book\'s own list of corrections, the "Notification" leaf after the contents (second citation), which for page 201 directs "I worship" to be read for "I adore". The Raccolta records its indulgence by Pius IX in 1854.',
      occasions: ["marian-devotion", "daily", "preparation-for-death"],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: [page(201), page("n448")],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-for-a-good-death",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(202)],
    payload: {
      slug: "prayer-to-our-lady-for-a-good-death",
      title: "Prayer to Our Lady for a Good Death",
      body: "O Mary, conceived without stain, pray for us who fly to thee. Refuge of sinners, Mother of those who are in their agony, leave us not in the hour of our death, but obtain for us perfect sorrow, sincere contrition, remission of our sins, a worthy reception of the most holy Viaticum, the strengthening of the Sacrament of Extreme Unction, so that we may be able to stand with safety before the throne of the just but merciful Judge, our God and our Redeemer. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A short prayer to Mary conceived without stain, refuge of sinners and Mother of the dying, asking her to stay with us at the hour of death and obtain perfect contrition, worthy reception of Viaticum and the strength of Extreme Unction. The Raccolta records its indulgence by Pius IX in 1856.",
      occasions: ["preparation-for-death", "deathbed", "last-rites", "marian-devotion"],
      relatedSaints: [],
      citations: [page(202)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "chaplet-of-the-twelve-privileges-of-our-lady",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(202)],
    payload: {
      slug: "chaplet-of-the-twelve-privileges-of-our-lady",
      title: "Chaplet of the Twelve Privileges of Our Lady",
      body: "In the Name of the Father and of the Son and of the Holy Ghost. Amen.\nV. O God, come to my assistance.\nR. O Lord, make haste to help me.\nGlory be to the Father, etc.\n\nHail to thee, purest, holiest Mother of Jesus. We humbly pray thee, by thy predestination, whereby thou wast even from all eternity elected Mother of God; by thy Immaculate Conception, whereby thou wast conceived without stain of original sin; by thy most perfect resignation, whereby thou wast ever conformed to the will of God; and, lastly, by thy consummate holiness, whereby throughout thy whole life thou didst never commit one single fault: we pray thee to become our advocate with our Lord, that He may pardon our many sins, which are the cause of his wrath. And thou, O Father Almighty, by the merits of these privileges vouchsafed to this thy well-beloved Daughter, hear her supplications for us, and pardon us, her clients.\n\nSpare, O Lord, spare thy people. Pater once, Ave four times, Gloria once.\n\nBy thy holy and Immaculate Conception deliver us, glorious Virgin Mary.\n\nHail to thee, purest, holiest Mother of Jesus. We humbly pray thee, by the most holy Annunciation, when thou didst conceive the Divine Word in thy womb; by thy most happy delivery, in which thou didst experience no pain; by thy perpetual virginity, which thou didst unite with the fruitfulness of a mother; and, lastly, by the bitter martyrdom which thou didst undergo in our Saviour's death: we pray thee to become our mediatrix, that we may reap the fruit of the Precious Blood of thy Son. And Thou, O Divine Son, by the merit of these privileges granted to thy well-beloved Mother, hear her supplications, and pardon us, her clients.\n\nSpare, O Lord, spare thy people. Pater once, Ave four times, Gloria once.\n\nBy thy holy and Immaculate Conception deliver us, glorious Virgin Mary.\n\nHail to thee, purest, holiest Mother of Jesus. We humbly pray thee, by the joys which thou didst feel in thy heart at the Resurrection and Ascension of Jesus Christ; by thy Assumption into Heaven, whereby thou wast exalted above all the Choirs of the Angels; by the glory which God has given thee to be Queen of all saints; and, lastly, by that most powerful intercession, whereby thou art able to obtain all that thou dost desire: we pray thee, obtain for us true love of God. And Thou, O Holy Spirit, by the merits of these privileges of thy well-beloved Spouse, hear her supplications, and pardon us her clients. Amen.\n\nSpare, O Lord, spare thy people. Pater once, Ave four times, Gloria once.\n\nBy thy holy and Immaculate Conception deliver us, O glorious Virgin Mary.\n\nAntiphon. Thy Conception, Virgin Mother of God, brought joy to the whole world, for of thee was born the Sun of Justice, Christ our God, who, loosing the curse, bestowed the blessing, and, confounding death, gave unto us eternal life.\nV. In thy Conception, Virgin Mary, thou wast Immaculate.\nR. Pray to the Father for us, whose Son Jesus, conceived by the Holy Ghost, thou didst bring forth.\n\nLet us pray.\n\nGod of mercy, God of pity, God of tenderness, who, pitying the affliction of thy people, didst say to the angel smiting them, “Withhold thy hand”; for the love of thy glorious Mother, at whose precious breast thou didst sweetly find an antidote to the venom of our sins, bestow on us the help of thy grace, that we may be freed from all evil, and mercifully protected from every onset of destruction. Who livest and reignest for ever and ever. Amen.",
      prayerType: "chaplet",
      category: "chaplet",
      language: "en",
      summary:
        "A chaplet in three parts addressed to the Father, the Son and the Holy Ghost, each recalling four of the Blessed Virgin's privileges, from her predestination and Immaculate Conception to her Assumption and power of intercession, with an Our Father, four Hail Marys and a Glory be after each part. It ends with the antiphon Thy Conception, a versicle and a prayer for deliverance from all evil. The Raccolta records its indulgence by Pius IX in 1860.",
      occasions: ["immaculate-conception", "december-8", "marian-devotion"],
      relatedSaints: [],
      citations: [page(202)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "act-of-reparation-for-blasphemies-against-our-lady",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(206)],
    payload: {
      slug: "act-of-reparation-for-blasphemies-against-our-lady",
      title: "Act of Reparation for Blasphemies against Our Lady",
      body: "Most glorious Virgin Mary, Mother of God, and our mother, look with pity upon us poor sinners, who, afflicted with so many miseries surrounding us in this life, feel ourselves cut to the heart by the many horrible insults and blasphemies which we are often constrained to hear uttered against thee, O Immaculate Virgin. Oh, how these impious sayings offend the infinite Majesty of God, and Jesus Christ his only begotten Son! How they provoke his anger, and give us cause to fear the terrible effects of his vengeance! If the sacrifice of our lives could avail against such outrages and blasphemies, very willingly would we make it, for we desire, most holy Mother, to love and honour thee with all our hearts, such being the will of God. And just because we love thee, we will do whatever lies in our power to make thee loved and honoured by all. And do thou, Mother of pity, supreme consoler of the afflicted, accept this act of reparation offered to thee, in our name and in the name of all our families, and on behalf of those who, not knowing what they say, impiously blaspheme thee; that so, by obtaining from God their conversion, thy glorious compassion, thy power, and thy great mercy may become more manifest, and they too may join with us in proclaiming thee blessed amongst women, the Immaculate Virgin, the most compassionate Mother of God. Ave Maria thrice.",
      prayerType: "act",
      category: "marian",
      language: "en",
      summary:
        "An act of reparation offered to the Blessed Virgin, in one's own name, one's family's and on behalf of those who blaspheme her, for the insults uttered against her, asking that by obtaining their conversion her compassion and mercy may be made known. It closes with three Hail Marys. The Raccolta records its indulgence by Leo XIII in 1885.",
      occasions: ["reparation", "first-saturday", "marian-devotion"],
      relatedSaints: [],
      citations: [page(206)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-the-powerful-virgin-against-error",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(207)],
    payload: {
      slug: "prayer-to-the-powerful-virgin-against-error",
      title: "Prayer to the Powerful Virgin for the Return of the Erring",
      body: "O powerful Virgin, who alone hast destroyed all heresies throughout the world, deliver the Christian world from the snares of the devil, and have compassion on the souls deceived by diabolical cunning, that laying aside all heretical guilt, the hearts of the erring may be converted and return to the unity of the Catholic Faith, through thy intercession with our Lord Jesus Christ thy Son, who liveth and reigneth with God the Father in the unity of the Holy Spirit, God for ever and ever. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A brief prayer that echoes the old liturgical praise of Mary as the Virgin who alone has overcome all heresies, asking her to deliver the Christian world from the snares of the devil and to obtain that those led astray may return to the unity of the Catholic faith. The Raccolta records its indulgence by Leo XIII in 1885.",
      occasions: ["for-the-church", "conversion", "marian-devotion"],
      relatedSaints: [],
      citations: [page(207)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-mary-crowned-with-stars",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(207)],
    payload: {
      slug: "prayer-to-mary-crowned-with-stars",
      title: "Prayer to Mary Crowned with Stars, Mother of the Living",
      body: "O Mary, who, crowned with stars, hast for a footstool under thy feet the moon, and for thy throne the wings of angels; turn thy eyes upon this valley of sorrows, and listen to the voice of one who puts his hope and refuge in thee. Thou dost now enjoy the infinite sweetness of Paradise, but in the midst of joy and splendour thou bearest always in thy inmost heart the recollection of what thou didst suffer in this life. Thou hast tried the needs of this exile, and therefore knowest how bitterly flow the days of those who live in sorrow.\n\nEver in thy remembrance rises up a mount covered with armed men and the dregs of the people; thou hearest ever a voice, so well known by thee, which says to thee: “O Lady, behold, in my place, thy son.” And these thoughts move thee to profound tenderness, and thou dost realize, O blessed one, that on that mountain and with those words thou wast destined to be the Mother of the living.\n\nWithout thee what would life be to the unhappy children of Adam. Each one of them has a sorrow which tries him, a grief which overwhelms, a wound which torments. And all have recourse to thee, as to a port of safety, to a fount of complete refreshment. When the waves lash themselves into fury, the wayfarer turns to thee and prays for calm. To thee has recourse the orphan who, like a flower in the wilderness, lies exposed to the whirlwind of life. To thee pray the poor who want their daily bread; and not one of them remains without help and consolation. But if all find in thee aid and refreshment, what shall we say, to whom thou art wont to appear, glorious as thou art in heaven.\n\nO Mary, mother of all, enlighten our minds, soften our hearts, so that this most pure love which streams from thy eyes may be poured forth on every side, and produce those marvellous fruits which thy Son prepared for by shedding his Blood, whilst thou didst suffer the most cruel pangs at the foot of the Cross.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        'A meditative prayer to the Blessed Virgin enthroned in glory, who still remembers Calvary, where the words "behold thy son" made her Mother of the living; all the afflicted, the wayfarer, the orphan and the poor, turn to her, and she is asked to enlighten minds and soften hearts. The Raccolta records its indulgence by Pius X in 1905.',
      occasions: ["sorrow", "trust", "marian-devotion"],
      relatedSaints: [],
      citations: [page(207)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "o-mary-bless-this-house",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(210)],
    payload: {
      slug: "o-mary-bless-this-house",
      title: "O Mary, Bless This House",
      body: "O Mary, bless this house, where thy name is ever held in benediction. All glory to Mary ever Immaculate, ever Virgin, blessed among women, the Mother of our Lord Jesus Christ, Queen of Paradise.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A short invocation asking the Blessed Virgin to bless a home where her name is honoured, followed by a greeting of praise to Mary ever Immaculate and ever Virgin, Mother of our Lord and Queen of Paradise. The Raccolta gives it under the heading of reparation for blasphemy against Our Lady and records its indulgence by Pius X in 1905.",
      occasions: ["home", "house-blessing", "reparation", "families"],
      relatedSaints: [],
      citations: [page(210)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-saint-aloysius-gonzaga-to-our-lady",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(211)],
    payload: {
      slug: "prayer-of-saint-aloysius-gonzaga-to-our-lady",
      title: "Prayer of St Aloysius Gonzaga to Our Lady",
      body: "O Holy Mary, my mistress, into thy blessed trust and special custody, and into the bosom of thy mercy I this day, every day, and in the hour of my death, commend my soul and my body: to thee I commit all my anxieties and miseries, my life and the end of my life, that by thy most holy intercession and by thy merits all my actions may be directed and disposed according to thy will and that of thy Son. Amen.",
      prayerType: "consecration",
      category: "marian",
      language: "en",
      summary:
        "The short act of entrustment attributed to St Aloysius Gonzaga, in which the one praying commends soul and body, every anxiety and the hour of death to the keeping of the Blessed Virgin, so that every action may be directed according to her will and her Son's. The Raccolta records its indulgence by Leo XIII in 1890.",
      occasions: ["daily", "morning", "marian-consecration", "june-21"],
      relatedSaints: ["saint-aloysius-gonzaga"],
      citations: [page(211)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-england-leo-xiii",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(211)],
    payload: {
      slug: "prayer-for-england-leo-xiii",
      title: "Prayer for England (Leo XIII)",
      body: "O Blessed Virgin Mary, Mother of God, and our most gentle Queen and Mother, look down in mercy upon England thy Dowry, and upon us all who greatly hope and trust in thee. By thee it was that Jesus our Saviour and our hope was given unto the world; and He has given thee to us that we might hope still more. Plead for us thy children, whom thou didst receive and accept at the foot of the Cross, O sorrowful Mother. Intercede for our separated brethren, that with us in the one true fold they may be united to the supreme Shepherd, the Vicar of thy Son. Pray for us all, dear Mother, that by faith fruitful in good works we may all deserve to see and praise God together with thee in our heavenly home. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        'The prayer to the Blessed Virgin for England, "thy Dowry", that Pope Leo XIII attached to his apostolic letter of 1895 to the English people, asking Our Lady of Sorrows to intercede for separated Christians, that they may be united with Catholics in the one fold under the Vicar of Christ.',
      occasions: ["for-the-church", "unity", "marian-devotion"],
      relatedSaints: [],
      citations: [page(211)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-the-mother-of-mercy-help-of-christians",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(215)],
    payload: {
      slug: "prayer-to-the-mother-of-mercy-help-of-christians",
      title: "Prayer to the Mother of Mercy, Help of Christians, Treasurer of All Graces",
      body: "O Mother of mercy, help of Christians, faithful handmaid of divine providence, treasurer of all graces, remember that never was it known that those who devoutly had recourse to thee were left without consolation. Wherefore, I prostrate myself humbly before thee, trusting in thy heart of pity and in thy most generous watchfulness, and beg of thee to hear my prayers.\n\nObtain for me holy prudence, and graces in all my spiritual needs, and also that temporal prudence necessary for spending my days in this vale of tears.\n\nI commend most fervently to thy loving and maternal heart Holy Church, the Supreme Pontiff, the conversion of souls, the propagation of the Catholic Faith, as well as the chosen spouses of our Lord who are suffering in the cruel flames of Purgatory, that they may quickly be consoled with eternal refreshment. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A prayer to the Blessed Virgin as Mother of mercy, faithful handmaid of divine providence and treasurer of all graces, asking spiritual and temporal prudence and commending to her heart the Church, the Pope, the conversion of souls, the spread of the faith and the souls in Purgatory. The Raccolta records its indulgence by Pius X in 1906.",
      occasions: ["for-the-church", "all-souls", "marian-devotion"],
      relatedSaints: [],
      citations: [page(215)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rosary-of-the-seven-dolours-servite-chaplet",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(218)],
    payload: {
      slug: "rosary-of-the-seven-dolours-servite-chaplet",
      title: "The Rosary of the Seven Dolours (Servite Chaplet)",
      body: "Act of Contrition.\n\nO my Lord, Thou who alone art most worthy of my love, behold me standing before thy Divine Presence utterly overwhelmed by the thought of the many grievous injuries I have done Thee. I ask thy pardon for them with my whole heart, repenting of them purely for love of Thee, and at the thought of thy great goodness hating and loathing them above every evil of this life. As I would rather have died a thousand times than have offended Thee, so now I am most firmly resolved to die a thousand deaths rather than offend Thee again. My crucified Jesus, I firmly purpose to cleanse my soul as soon as possible by thy most Precious Blood in the Sacrament of Penance. And thou, most tender Virgin, Mother of mercy and Refuge of sinners, do thou obtain for me by virtue of thy bitter pains, the pardon of sin which I desire; whilst, praying according to the mind of so many holy Pontiffs in order to obtain the Indulgences granted to this thy holy Rosary, I hope thereby to obtain remission of all pains due to my sins.\n\nWith this confidence in my heart, I meditate on the First Sorrow, when Mary, Virgin Mother of my God, presented Jesus her only Son in the Temple, laid Him in the arms of holy and aged Simeon, and heard his prophetic word, “The sword of grief shall pierce thy soul,” foretelling thereby the Passion and Death of her Son Jesus. Pater once, Ave seven times.\n\nThe Second Sorrow of the Blessed Virgin was when she was obliged to fly into Egypt by reason of the persecution of cruel Herod, who impiously sought to slay her well beloved Son. Pater once, Ave seven times.\n\nThe Third Sorrow of the Blessed Virgin was when, after having gone up to Jerusalem at the Paschal Feast with Joseph her spouse and Jesus her beloved Son, she lost Him on the way back to her poor house, and for three days bewailed the loss of her only Love. Pater once, Ave seven times.\n\nThe Fourth Sorrow of the Blessed Virgin was when she met her dear Son Jesus carrying to Mount Calvary on his tender shoulders the heavy Cross whereon He was to be crucified for our salvation. Pater once, Ave seven times.\n\nThe Fifth Sorrow of the Blessed Virgin was when she saw her Son Jesus raised upon the hard tree of the Cross, and blood flowing from every part of his sacred Body, and then beheld Him die after three hours' agony. Pater once, Ave seven times.\n\nThe Sixth Sorrow of the Blessed Virgin was when she saw the lance pierce the sacred Side of Jesus, her beloved Son, the nails withdrawn, and his holy Body laid in her purest bosom. Pater once, Ave seven times.\n\nThe Seventh and last Sorrow of the Blessed Virgin, Queen and Advocate of us, her servants, miserable sinners, was when she saw the holy Body of her Son buried in the grave. Pater once, Ave seven times.\n\nThen say Ave thrice in veneration of the tears which Mary shed in her sorrows, to obtain thereby true sorrow for sins and the holy Indulgences attached to this pious exercise.\n\nV. Pray for us, Virgin most sorrowful.\nR. That we may be made worthy of the promises of Christ.\n\nLet us pray.\n\nGrant, we beseech Thee, O Lord Jesus Christ, that the most blessed Virgin Mary, thy Mother, may intercede for us before the throne of thy mercy, now and at the hour of our death, whose most holy soul was transfixed with the sword of sorrow in the hour of thine own Passion. Through Thee, Jesus Christ, Saviour of the world, who livest and reignest, etc. Amen.",
      prayerType: "chaplet",
      category: "chaplet",
      language: "en",
      summary:
        "The prayers of the chaplet of the Seven Sorrows of the Blessed Virgin as the Servite Order propagated it: an act of contrition, the seven sorrows, from Simeon's prophecy to the burial of Jesus, each with an Our Father and seven Hail Marys, three Hail Marys in honour of Mary's tears, and the collect Grant, we beseech Thee. The Raccolta gives its indulgences, granted from Benedict XIII onwards, for beads blessed by a Servite Father.",
      occasions: ["our-lady-of-sorrows", "september-15", "lent", "fridays"],
      relatedSaints: [],
      citations: [page(218)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "devotion-to-the-sorrowful-heart-of-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(221)],
    payload: {
      slug: "devotion-to-the-sorrowful-heart-of-mary",
      title: "Devotion to the Sorrowful Heart of Mary (I Compassionate Thee)",
      body: "V. O God, come to my assistance.\nR. O Lord, make haste to help me.\nGlory be to the Father, etc.\n\nI compassionate thee, sorrowing Mary, in the affliction of thy tender heart at the prophecy of the holy old man Simeon. Dear Mother, by thy heart then so afflicted, obtain for me the virtue of humility and the gift of holy fear of God. Ave Maria.\n\nI compassionate thee, sorrowing Mary, in the anxiety which thy sensitive heart underwent in the flight and sojourn in Egypt. Dear Mother, by thy heart then made so anxious, obtain for me the virtue of liberality, especially towards the poor, and the gift of pity. Ave Maria.\n\nI compassionate thee, sorrowing Mary, in the trouble of thy anxious heart, when thou didst lose thy dear Son Jesus. Dear Mother, by thy heart then so troubled, obtain for me the virtue of holy chastity and the gift of knowledge. Ave Maria.\n\nI compassionate thee, sorrowing Mary, in the shock thy maternal heart underwent when Jesus met thee carrying his Cross. Dear Mother, by thy loving heart then so overwhelmed, obtain for me the virtue of patience and the gift of fortitude. Ave Maria.\n\nI compassionate thee, sorrowing Mary, in the martyrdom thy generous heart bore so nobly whilst thou didst stand by Jesus in his agony. Dear Mother, by thy heart then so martyred, obtain for me the virtue of temperance and the gift of counsel. Ave Maria.\n\nI compassionate thee, sorrowing Mary, in the wound of thy tender heart when the sacred Side of Jesus was pierced with the lance. Dear Mother, by thy heart then so transfixed, obtain for me the virtue of fraternal charity and the gift of understanding. Ave Maria.\n\nI compassionate thee, sorrowing Mary, in the pang felt by thy loving heart when the Body of Jesus was buried in the grave. Dear Mother, by all the bitterness of desolation thou didst then experience, obtain for me the virtue of diligence and the gift of wisdom. Ave Maria.\n\nV. Pray for us, Virgin most sorrowful.\nR. That we may be made worthy of the promises of Christ.\n\nLet us pray.\n\nGrant, we beseech Thee, etc.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "Seven acts of compassion with the sorrowing heart of Mary, one for each of her seven sorrows, each asking through that sorrow for a virtue and a gift of the Holy Ghost, from humility and holy fear to diligence and wisdom, and each followed by a Hail Mary. The devotion ends with the versicle Pray for us, Virgin most sorrowful, and the collect Grant, we beseech Thee, which the Raccolta gives in full after the Rosary of the Seven Dolours. It records its indulgence by Pius VII in 1815.",
      occasions: ["our-lady-of-sorrows", "september-15", "lent", "fridays"],
      relatedSaints: [],
      citations: [page(221)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-mary-queen-of-martyrs",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(226), page("n448")],
    payload: {
      slug: "prayer-to-mary-queen-of-martyrs",
      title: "Prayer to Mary, Queen of Martyrs",
      body: "Mary, most holy Virgin and Queen of Martyrs, would that I could be transported to Heaven, there to contemplate the honours bestowed on thee by the Blessed Trinity and by all the heavenly court. But since I am still a pilgrim in this valley of tears, accept from me, thy unworthy and sinful servant, the most sincere homage and the most complete act of submission which a human being is capable of making to thee. In thy most sacred heart, transfixed with so many swords of grief, I lay, once for all, my poor soul; receive me as the companion of thy sorrows, and do not allow me ever to be separated from that Cross on which thy only Son breathed forth his blessed Soul for me. With thee, O Mary, will I suffer all the trials, contradictions and infirmities with which it may please thy Divine Son to visit me in this life. I offer all to thee in memory of those sorrows which thou didst endure in thy life on earth; so that every thought of my mind, every beating of my heart, may henceforth be an act of compassion for thy sorrows and an act of rejoicing in the glories which thou dost now enjoy in Heaven. Therefore, dear Mother, while I now compassionate thee and rejoice to see thee thus glorified, do thou have compassion on me, and reconcile me with thy Son Jesus, so that I may be able to return and be thy true and faithful son. Come on my last day to assist me in my agony, as thou didst once assist at that of thy Divine Son, so that from this cruel exile I may come to share in thy glory in Heaven. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        'An act of homage to the Blessed Virgin as Queen of Martyrs, in which the one praying lays his soul in her heart pierced with swords of grief, offers her all the trials of life in memory of her sorrows, and asks her to reconcile him with her Son and to assist him in his agony. The text follows the correction printed in the book\'s own list of corrections, the "Notification" leaf after the contents (second citation), which for page 227 directs "most sacred" to be read for "adorable". The Raccolta records its indulgence by Leo XIII in 1887.',
      occasions: ["our-lady-of-sorrows", "september-15", "suffering", "preparation-for-death"],
      relatedSaints: [],
      citations: [page(226), page("n448")],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-to-our-lady-of-sorrows-for-the-church",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(227)],
    payload: {
      slug: "prayer-to-our-lady-of-sorrows-for-the-church",
      title: "Prayer to Our Lady of Sorrows for the Church and the Pope",
      body: "O most holy Virgin and Mother, whose soul a sword of grief went through in the Passion of thy Divine Son, and who in his glorious Resurrection wast filled with unending joy at his triumph; intercede for us thy suppliants, that we may become so truly partakers in the adversities of the Church and the trials of the Supreme Pontiff, that we may deserve to share in the consolations they desire, in the charity and peace of the same Christ our Lord. Amen.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "A short prayer recalling the sword of grief that pierced Mary's soul in the Passion and her joy at the Resurrection, asking her to make us sharers in the trials of the Church and of the Pope so that we may also share in their consolations. The Raccolta records its indulgence by Pius X in 1906.",
      occasions: ["our-lady-of-sorrows", "for-the-church", "easter"],
      relatedSaints: [],
      citations: [page(227)],
    },
  },
  {
    contentType: "PRAYER",
    slug: "chaplet-of-the-immaculate-conception",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [page(228)],
    payload: {
      slug: "chaplet-of-the-immaculate-conception",
      title: "Chaplet of the Immaculate Conception",
      body: "In the name of the Father and of the Son and of the Holy Ghost. Amen.\n\nFirst Set of Beads.\nBlessed be the Holy and Immaculate Conception of the most Blessed Virgin Mary. Pater once, Ave four times and Gloria once.\n\nSecond Set. Blessed, etc., as before. Pater, etc., as before.\n\nThird Set. Blessed, etc., as before. Pater, etc., as before.",
      prayerType: "chaplet",
      category: "chaplet",
      language: "en",
      summary:
        "A simple chaplet of three sets of beads, each beginning with the praise Blessed be the Holy and Immaculate Conception of the most Blessed Virgin Mary and continuing with an Our Father, four Hail Marys and a Glory be. The Raccolta records its indulgence by Pius IX in 1855, the year after the dogma of the Immaculate Conception was defined.",
      occasions: ["immaculate-conception", "december-8", "marian-devotion"],
      relatedSaints: [],
      citations: [page(228)],
    },
  },
];
