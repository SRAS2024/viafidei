import type { CuratedEntry } from "../index";

const CATHOLIC_ONLINE = "https://www.catholic.org/prayers/prayer.php?p=";
const EWTN = "https://www.ewtn.com/catholicism/devotions/";
const EWTN_LIBRARY = "https://www.ewtn.com/catholicism/library/";
const DRBO_PSALM_37 = "https://drbo.org/chapter/21037.htm";

/**
 * Batch 6 of the curated prayer catalogue: prayers for the sick and for
 * healing, for family life and motherhood, for home and work, and the
 * seasonal hymns of Advent, Lent and Passiontide.
 *
 * Every body is the received public-domain text copied character for
 * character from the cited page; line breaks follow the page, and stanzas
 * are separated by a blank line. Nothing here is modernised, shortened or
 * merged from two versions. Where the only reachable approved page carried a
 * copyrighted modern composition, the prayer was left out rather than
 * repaired silently.
 *
 * One exception, recorded here rather than made silently: the Rorate Caeli
 * page at Catholic Online carries three plain scan errors in its final and
 * third stanzas ("why bath sorrow seized thee", and two colons dropped after
 * "have taken us away" and "shall speedily come"). These have been corrected
 * against the received text of the Advent prose; nothing else on that page
 * was touched.
 */
export const prayerBatch6: CuratedEntry[] = [
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-sick",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}484`],
    payload: {
      slug: "prayer-for-the-sick",
      title: "Prayer for the Sick (Watch, O Lord)",
      body: "Watch, O Lord, with those who wake, or watch, or weep tonight, and give your angels charge over those who sleep.\n\nTend your sick ones, O Lord Christ.\nRest your weary ones.\nBless your dying ones.\nSoothe your suffering ones.\nPity your afflicted ones.\nShield your joyous ones.\nAnd for all your love's sake. Amen.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "An evening intercession for the sick, the dying and the sleeping, traditionally attributed to Saint Augustine and long used at the close of the day in hospitals and at sickbeds. It asks nothing for the one praying, only care for each condition of the household of God.",
      occasions: ["sickness", "evening", "hospital-visit", "night-prayer"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: [`${CATHOLIC_ONLINE}484`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "psalm-for-the-sick",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [DRBO_PSALM_37],
    payload: {
      slug: "psalm-for-the-sick",
      title: "Psalm for the Sick (Psalm 37, Douay-Rheims)",
      body: "A psalm for David, for a remembrance of the sabbath.\n\nRebuke me not, O Lord, in thy indignation; nor chastise me in thy wrath.\nFor thy arrows are fastened in me: and thy hand hath been strong upon me.\nThere is no health in my flesh, because of thy wrath: there is no peace for my bones, because of my sins.\nFor my iniquities are gone over my head: and as a heavy burden are become heavy upon me.\nMy sores are putrified and corrupted, because of my foolishness.\nI am become miserable, and am bowed down even to the end: I walked sorrowful all the day long.\nFor my loins are filled with illusions; and there is no health in my flesh.\nI am afflicted and humbled exceedingly: I roared with the groaning of my heart.\nLord, all my desire is before thee, and my groaning is not hidden from thee.\nMy heart is troubled, my strength hath left me, and the light of my eyes itself is not with me.\nMy friends and my neighbours have drawn near, and stood against me. And they that were near me stood afar off:\nAnd they that sought my soul used violence. And they that sought evils to me spoke vain things, and studied deceits all the day long.\nBut I, as a deaf man, heard not: and as a dumb man not opening his mouth.\nAnd I became as a man that heareth not: and that hath no reproofs in his mouth.\nFor in thee, O Lord, have I hoped: thou wilt hear me, O Lord my God.\nFor I said: Lest at any time my enemies rejoice over me: and whilst my feet are moved, they speak great things against me.\nFor I am ready for scourges: and my sorrow is continually before me.\nFor I will declare my iniquity: and I will think for my sin.\nBut my enemies live, and are stronger than I: and they that hate me wrongfully are multiplied.\nThey that render evil for good, have detracted me, because I followed goodness.\nForsake me not, O Lord my God: do not thou depart from me.\nAttend unto my help, O Lord, the God of my salvation.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "Psalm 37 in the Douay-Rheims (Vulgate) numbering, the third of the seven penitential psalms, headed in the Douay text as the prayer of a penitent for the remission of his sins. Its account of sickness of body borne together with sorrow for sin has made it a psalm long prayed by and for the sick.",
      occasions: ["sickness", "lent", "penance", "anointing-of-the-sick"],
      relatedSaints: [],
      citations: [DRBO_PSALM_37],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-in-time-of-sickness",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}486`],
    payload: {
      slug: "prayer-in-time-of-sickness",
      title: "Prayer in Time of Sickness or Trial",
      body: "O good Jesus, I accept willingly this sickness [or trial] which it has pleased you to lay upon me. I confide all my pains to your Sacred Heart, and beg you to unite them with your bitter sufferings, and thus perfect them by making them your own.\n\nSince I cannot render you the praise due to you because of the multitude of my sorrows and afflictions, I ask you to praise God the Father for all I suffer, with the same tribute of praise you offered him when your agony on the Cross was at its height.\n\nAs you thanked him with all the powers of your soul for all the sufferings and injustice which he willed you should endure, so, I pray you, give him thanks for my trials also. Offer my sufferings, physical and spiritual, to him together with your most holy pains to his eternal honor and glory. Amen.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A prayer of acceptance for one who is ill or under trial, joining the sufferer's pains to the Passion of Christ so that they may be offered to the Father with His. The bracketed words allow the same prayer to be used for a trial that is not an illness.",
      occasions: ["sickness", "suffering", "trial"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}486`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-doctors-and-nurses",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}476`],
    payload: {
      slug: "prayer-for-doctors-and-nurses",
      title: "Prayer for Doctors and Nurses",
      body: "O merciful Father,\nwho have wonderfully fashioned man in your own image,\nand have made his body to be a temple of the Holy Spirit,\nsanctify, we pray you,\nour doctors and nurses and all those whom you have called to study and practice the arts of healing the sick and the prevention of disease and pain.\nStrengthen them in body and soul,\nand bless their work,\nthat they may give comfort to those for whose salvation\nyour Son became Man,\nlived on this earth,\nhealed the sick,\nand suffered and died on the Cross.\nAmen.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "An intercession for physicians, nurses and all who care for the sick, asking that their skill be sanctified by the God who fashioned the body and made it a temple of the Holy Spirit. Often prayed on the feast of Saint Luke and in hospital chapels.",
      occasions: ["healthcare", "sickness", "feast-of-saint-luke"],
      relatedSaints: ["saint-luke-the-evangelist"],
      citations: [`${CATHOLIC_ONLINE}476`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-healing",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}481`],
    payload: {
      slug: "prayer-for-healing",
      title: "Prayer for Healing",
      body: "O God who are the only source of health and healing, the spirit of calm and the central peace of this universe, grant to me such a consciousness of your indwelling and surrounding presence that I may permit you to give me health and strength and peace, through Jesus Christ our Lord. Amen.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A short prayer for healing that asks first for awareness of God's presence and only then for health, strength and peace. It is commonly prayed by the sick themselves and by those keeping vigil with them.",
      occasions: ["sickness", "healing", "anointing-of-the-sick"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}481`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-help-against-spiritual-enemies",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN}prayer-for-help-against-spiritual-enemies-327`],
    payload: {
      slug: "prayer-for-help-against-spiritual-enemies",
      title: "Prayer for Help against Spiritual Enemies",
      body: "Glorious Saint Michael, Prince of the heavenly hosts, who stands always ready to give assistance to the people of God; who fought with the dragon, the old serpent, and cast him out of heaven, and now valiantly defends the Church of God that the gates of hell may never prevail against her, I earnestly entreat you to assist me also, in the painful and dangerous conflict which I sustain against the same formidable foe.\n\nBe with me, O mighty Prince! that I may courageously fight and vanquish that proud spirit, whom you, by the Divine Power, gloriously overthrew, and whom our powerful King, Jesus Christ, has, in our nature, completely overcome; so having triumphed over the enemy of my salvation, I may with you and the holy angels, praise the clemency of God who, having refused mercy to the rebellious angels after their fall, has granted repentance and forgiveness to fallen man. Amen.",
      prayerType: "intercession",
      category: "angelic",
      language: "en",
      summary:
        "A traditional petition to Saint Michael the Archangel in temptation and spiritual combat, recalling his victory over the dragon in the Apocalypse and his guardianship of the Church. It ends in praise of the mercy God has shown to fallen man and withheld from the fallen angels.",
      occasions: ["spiritual-warfare", "temptation", "september-29"],
      relatedSaints: [],
      citations: [`${EWTN}prayer-for-help-against-spiritual-enemies-327`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-a-good-spouse",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}497`],
    payload: {
      slug: "prayer-for-a-good-spouse",
      title: "Prayer for a Good Husband or Wife",
      body: "O Jesus, lover of the young, the dearest Friend I have, in all confidence I open my heart to You to beg Your light and assistance in the important task of planning my future. Give me the light of Your grace, that I may decide wisely concerning the person who is to be my partner through life. Dearest Jesus, send me such a one whom in Your divine wisdom You judge best suited to be united with me in marriage. May her/his character reflect some of the traits of Your own Sacred Heart. May s/he be upright, loyal, pure, sincere and noble, so that with united efforts and with pure and unselfish love we both may strive to perfect ourselves in soul and body, as well as the children it may please You to entrust to our care. Bless our friendship before marriage, that sin may have no part in it. May our mutual love bind us so closely, that our future home may ever be most like Your own at Nazareth.\n\nO Mary Immaculate, sweet Mother of the young, to your special care I entrust the decision I am to make as to my future wife/husband. You are my guiding Star! Direct me to the person with whom I can best cooperate in doing God's Holy Will, with whom I can live in peace, love and harmony in this life, and attain to eternal joys in the next.\n\nAmen.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "A prayer of discernment for the unmarried, asking Christ and His Mother for guidance in choosing a spouse and for a courtship kept free from sin. The page prints it with the alternative pronouns so that either a man or a woman may pray it.",
      occasions: ["marriage", "discernment", "courtship"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}497`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-purity",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}498`],
    payload: {
      slug: "prayer-for-purity",
      title: "Prayer for Purity",
      body: 'Jesus, Lover of chastity, Mary, Mother most pure, and Joseph, chaste guardian of the Virgin, to you I come at this hour, begging you to plead with God for me. I earnestly wish to be pure in thought, word and deed in imitation of your own holy purity.\n\nObtain for me, then, a deep sense of modesty which will be reflected in my external conduct. Protect my eyes, the windows of my soul, from anything that might dim the luster of a heart that must mirror only Christlike purity.\n\nAnd when the "Bread of Angels becomes the Bread of me" in my heart at Holy Communion, seal it forever against the suggestions of sinful pleasures.\n\nHeart of Jesus, Fount of all purity, have mercy on us.',
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A petition to Jesus, Mary and Joseph for the virtue of chastity in thought, word and deed, and for the modesty that guards it. It is often prayed in preparation for Holy Communion and as part of a daily rule of life.",
      occasions: ["chastity", "daily", "before-communion"],
      relatedSaints: ["saint-joseph"],
      citations: [`${CATHOLIC_ONLINE}498`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-expectant-mothers",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}499`],
    payload: {
      slug: "prayer-for-expectant-mothers",
      title: "Prayer for Expectant Mothers",
      body: "Almighty and everlasting God, through the power of the Holy Spirit, you prepared the body of the Virgin Mary to be a worthy dwelling place of your divine son. You sanctified St. John the Baptist, while still in his mother's womb. Listen now to my prayer. Through the intercession of St. Gerard, watch over my child and me; protect us at the time of delivery. May my child receive the saving graces of Baptism, lead a Christian life, and, together with all the members of our family, attain everlasting happiness in heaven. Amen.",
      prayerType: "intercession",
      category: "saintly",
      language: "en",
      summary:
        "A prayer of an expectant mother for her child and for a safe delivery, made through the intercession of Saint Gerard Majella, whom Catholic devotion has long invoked as a patron of mothers. It asks first for the child's Baptism and Christian life.",
      occasions: ["pregnancy", "childbirth", "october-16"],
      relatedSaints: ["saint-gerard-majella", "saint-john-the-baptist"],
      citations: [`${CATHOLIC_ONLINE}499`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-motherhood",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}500`],
    payload: {
      slug: "prayer-for-motherhood",
      title: "Prayer for Motherhood",
      body: "Good St. Gerard, powerful intercessor before the throne of God, wonder-worker of our day, I call upon you and seek your aid. You know that my husband and I desire the gift of a child. Please present our fervent plea to the Creator of life from whom all parenthood proceeds and beseech him to bless us with a child whom we may raise as his child and heir of heaven. Amen.",
      prayerType: "intercession",
      category: "saintly",
      language: "en",
      summary:
        "A prayer of husband and wife who long for a child, asking Saint Gerard Majella to carry their petition to the Creator of life. It names the child sought as God's own child and heir of heaven.",
      occasions: ["infertility", "marriage", "october-16"],
      relatedSaints: ["saint-gerard-majella"],
      citations: [`${CATHOLIC_ONLINE}500`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "blessing-of-a-bedroom",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}19`],
    payload: {
      slug: "blessing-of-a-bedroom",
      title: "Blessing of a Bedroom",
      body: "V. Our help is in the name of the Lord.\nR. Who has made heaven and earth.\nV. The Lord be with you.\nR. And with your spirit.\n\nLet us pray.\n\nBless this bedroom, Lord, so that all who live in it may remain firm in Your peace and persevere in Your will. May they live a long life and have children for many days to come, and finally arrive at the kingdom of heaven through Christ our Lord.\n\nR. Amen.\n\n(And it is sprinkled with holy water.)",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        "One of the household blessings of the Roman Ritual, prayed over a bedroom with its versicles, collect and sprinkling of holy water. In the traditional discipline the blessing of a home and its rooms belongs to a priest, though families keep the prayer in their own devotions.",
      occasions: ["home", "house-blessing", "epiphany"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}19`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "christmas-anticipation-prayer",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN}christmas-anticipation-prayer-343`],
    payload: {
      slug: "christmas-anticipation-prayer",
      title: "Christmas Anticipation Prayer (Saint Andrew Christmas Novena)",
      body: "Hail and blessed be the hour and moment In which the Son of God was born Of the most pure Virgin Mary, at midnight, in Bethlehem, in the piercing cold. In that hour vouchsafe, I beseech Thee, O my God, to hear my prayer and grant my desires,\n[here mention your request]\nthrough the merits of Our Saviour Jesus Christ, and of His blessed Mother. Amen.",
      prayerType: "general",
      category: "devotional",
      language: "en",
      summary:
        "The Christmas Anticipation Prayer, commonly called the Saint Andrew Christmas Novena because it is begun on his feast, November 30, and prayed through Christmas Eve. The received custom is to repeat it fifteen times a day during Advent; the bracketed line is where the petition is named.",
      occasions: ["advent", "november-30", "christmas-novena"],
      relatedSaints: ["saint-andrew-the-apostle"],
      citations: [`${EWTN}christmas-anticipation-prayer-343`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "rorate-caeli",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}1668`],
    payload: {
      slug: "rorate-caeli",
      title: "Rorate Caeli",
      body: "Drop down dew, ye heavens, from above,\nand let the clouds rain the Just One.\n\nBe not angry, O Lord,\nand remember no longer our iniquity:\nbehold the city of thy sanctuary is become a desert,\nSion is made a desert.\nJerusalem is desolate,\nthe house of our holiness and of thy glory,\nwhere our fathers praised thee.\n\nDrop down dew, ye heavens, from above,\nand let the clouds rain the Just One.\n\nWe have sinned, and we are become as one unclean,\nand we have all fallen as a leaf;\nand our iniquities, like the wind,\nhave taken us away: thou hast hid thy face from us,\nand hast crushed us by the hand of our iniquity.\n\nDrop down dew, ye heavens, from above,\nand let the clouds rain the Just One.\n\nSee, O Lord, the affliction of thy people,\nand send him whom thou hast promised to send.\nSend forth the Lamb, the ruler of the earth,\nfrom the rock of the desert to the mount of the daughter of Sion,\nthat he himself may take off the yoke of our captivity.\n\nDrop down dew, ye heavens, from above,\nand let the clouds rain the Just One.\n\nBe comforted, be comforted, my people;\nthy salvation shall speedily come: why wilt thou waste away in sadness?\nwhy hath sorrow seized thee?\nI will save thee; fear not:\nfor I am the Lord thy God,\nthe Holy One of Israel, thy Redeemer.\n\nDrop down dew, ye heavens, from above,\nand let the clouds rain the Just One.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        "The great Advent prose, woven from the prophecies of Isaias, whose refrain gives the votive Rorate Mass its name. Verses of penitence and desolation alternate with the refrain begging the heavens to rain down the Just One, and close with God's own answer of comfort.",
      occasions: ["advent", "rorate-mass"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}1668`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "attende-domine",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${EWTN_LIBRARY}attende-domine-hearken-o-lord-11827`],
    payload: {
      slug: "attende-domine",
      title: "Attende Domine (Hearken, O Lord)",
      body: "R: Hearken, O Lord, and have mercy, for we have sinned against Thee.\n\nCrying, we raise our eyes to Thee, Sovereign King, Redeemer of all. Listen, Christ, to the pleas of the supplicant sinners. R.\n\nThou art at the Right Hand of God the Father, the Keystone, the Way of salvation and Gate of Heaven, cleanse the stains of our sins. R.\n\nO God, we beseech Thy majesty to hear our groans; to forgive our sins. R.\n\nWe confess to Thee our consented sins; we declare our hidden sins with contrite heart; in Thy mercy, O Redeemer, forgive them. R.\n\nThou wert captured, being innocent; brought about without resistance, condemned by impious men with false witnesses. O Christ keep safe those whom Thou hast redeemed. R.",
      prayerType: "general",
      category: "penitential",
      language: "en",
      latin:
        "R: Attende Domine, et miserere, quia peccavimus tibi.\n\nAd te Rex summe, omnium redemptor, oculos nostros sublevamus flentes: exaudi, Christe, supplicantum preces. R.\n\nDextera Patris, lapis angularis, via salutis, ianua caelestis, ablue nostri maculas delicti. R.\n\nRogamus, Deus, tuam maiestatem: auribus sacris gemitus exaudi: crimina nostra placidus indulge. R.\n\nTibi fatemur crimina admissa: contrito corde pandimus occulta: tua Redemptor, pietas ignoscat. R.\n\nInnocens captus, nec repugnans ductus, testibus falsis pro impiis damnatus: quos redemisti, tu conserva, Christe. R.",
      summary:
        "A Mozarabic hymn of the tenth century, sung in Lent, whose refrain begs the Lord to hear and have mercy on a people that has sinned against Him. The verses move from the confession of sins openly consented to, to those hidden in the heart.",
      occasions: ["lent", "penance", "confession"],
      relatedSaints: [],
      citations: [`${EWTN_LIBRARY}attende-domine-hearken-o-lord-11827`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "vexilla-regis",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}1670`],
    payload: {
      slug: "vexilla-regis",
      title: "Vexilla Regis (The Royal Banners Forward Go)",
      body: 'The royal banners forward go;\nThe Cross shines forth in mystic glow,\nWhere Life for sinners death endured,\nAnd life by death for man procured.\n\nWhere deep for us the spear was dyed,\nLife\'s torrent rushing from His side,\nTo wash us in that precious flood\nWhere mingled, Water flowed, and Blood.\n\nFulfilled is all that David told\nIn true prophetic song of old;\n"Amidst the nations, God," saith he,\n"Hath reigned and triumphed from the Tree."\n\nO Tree of beauty! Tree of light!\nO Tree with royal purple dight!\nElect on whose triumphal breast\nThose holy Limbs should find their rest.\n\nOn whose dear arms, so widely flung,\nThe weight of this world\'s ransom hung:\nThe price of human kind to pay\nAnd spoil the spoiler of his prey.\n\nO Cross, our one reliance, hail,\nThou glory of the saved, avail\nTo give fresh merit to the Saint,\nAnd pardon to the penitent.\n\nTo Thee, Eternal Three in One,\nLet homage meet by all be done;\nWhom by the Cross Thou dost restore,\nPreserve and govern evermore.\n\nAmen.',
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        "The Passiontide hymn of Venantius Fortunatus, written in 569 for the reception of a relic of the True Cross, here in the English translation of John Mason Neale. It is sung at Vespers from Passion Sunday and on the feasts of the Holy Cross; the second line of the sixth stanza is varied according to the season.",
      occasions: ["passiontide", "good-friday", "exaltation-of-the-holy-cross"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}1670`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-before-work",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}50`],
    payload: {
      slug: "prayer-before-work",
      title: "Direction of Intention (Prayer before Work)",
      body: "My God, I give you this day.\nI offer you, now,\nall of the good that I shall do\nand I promise to accept,\nfor love of you,\nall of the difficulty that I shall meet.\nHelp me to conduct myself\nduring this day\nin a manner pleasing to you.\nAmen.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "The Direction of Intention, a short prayer said at the beginning of the day or before a piece of work, offering its good in advance and accepting its difficulty for love of God. Teaching orders have long made it a habit of prayer before each class or task.",
      occasions: ["work", "morning", "study", "daily"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}50`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "thanksgiving-prayer",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}2828`],
    payload: {
      slug: "thanksgiving-prayer",
      title: "Prayer of Thanksgiving",
      body: "O God, of Whose mercies there is no number,\nand of Whose goodness the treasure is infinite;\nwe render thanks to Your most gracious majesty\nfor the gifts You have bestowed upon us,\nevermore beseeching Your clemency,\nthat as You grant the petitions of them that ask You,\nYou will never forsake them,\nbut will prepare for the reward to come.\nThrough Christ our Lord.\n\nAmen.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "The traditional collect of thanksgiving, Deus cuius misericordiae non est numerus, used in the Roman books for a general act of thanks. It gives thanks for gifts already received and asks that God not forsake those He has heard.",
      occasions: ["thanksgiving", "after-communion", "evening"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}2828`],
    },
  },
  {
    contentType: "PRAYER",
    slug: "act-of-resignation",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [`${CATHOLIC_ONLINE}445`],
    payload: {
      slug: "act-of-resignation",
      title: "Act of Resignation",
      body: "O Lord, my God, from this day I accept from your hand willingly and with submission, the kind of death that it may please you to send me, with all its sorrows, pains, and anguish. Into your hands, O Lord, I commend my spirit.",
      prayerType: "act",
      category: "general",
      language: "en",
      summary:
        "An act by which a Christian accepts in advance, from the hand of God, whatever death He may send, closing with the words of Christ on the Cross. It belongs to the traditional preparation for a happy death.",
      occasions: ["suffering", "sickness", "preparation-for-death"],
      relatedSaints: [],
      citations: [`${CATHOLIC_ONLINE}445`],
    },
  },
];
