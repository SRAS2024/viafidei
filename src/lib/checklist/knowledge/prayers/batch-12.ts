import type { CuratedEntry } from "../index";

/**
 * Batch 12 of the curated prayer catalogue: prayers of the saints and of the
 * classic Catholic prayer books, all in public-domain English printed before
 * 1929.
 *
 * Every body is copied from the first cited page, which reproduces the old
 * printed book, and was then collated word by word with an archive.org scan of
 * that book (the second citation). Nothing is paraphrased, shortened,
 * modernised, composed or merged across versions. The only changes are
 * typographical or restore the printed text; none alters the wording:
 *   - opening words that the books set in small capitals, and that the web
 *     transcriptions therefore print in full capitals ("O MY God"), are given
 *     in ordinary case;
 *   - page numbers, footnote markers and running heads are dropped;
 *   - where a transcription departs from the printed book, the book is
 *     followed: in Newman's prayers to Saint Philip "chose thee and made thee a
 *     saint" (the third prayer drops "thee"), "Salvator earum" for "Salvador",
 *     "Thou sayest" for "Thou savest", "Thou didst suffer" for "didst'", "my
 *     very body" for "my very, body", and "give us a safe lodging" where the
 *     transcription omits "a".
 *
 * Saint John Henry Newman's prayers come from Meditations and Devotions
 * (Longmans, 1893), Verses on Various Occasions (1868) and Sermons Bearing on
 * Subjects of the Day (1843), as transcribed by the Newman Reader. Most of his
 * meditations are written throughout as prayers and are given whole; where a
 * prayer is the closing colloquy of a longer meditation, only that prayer is
 * given and its summary says where it stands.
 */
export const prayerBatch12: CuratedEntry[] = [
  {
    contentType: "PRAYER",
    slug: "newman-prayer-for-the-light-of-truth",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations8.html#truth",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-prayer-for-the-light-of-truth",
      title: "Prayer for the Light of Truth (Saint John Henry Newman)",
      body: "O my God, I confess that Thou canst enlighten my darkness. I confess that Thou alone canst. I wish my darkness to be enlightened. I do not know whether Thou wilt: but that Thou canst and that I wish, are sufficient reasons for me to ask, what Thou at least hast not forbidden my asking. I hereby promise that by Thy grace which I am asking, I will embrace whatever I at length feel certain is the truth, if ever I come to be certain. And by Thy grace I will guard against all self-deceit which may lead me to take what nature would have, rather than what reason approves.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A short prayer Newman wrote for anyone searching for religious truth, which he wished an enquirer to say continually: it confesses that God alone can enlighten the mind and promises, by his grace, to embrace the truth once it is certainly known. From Meditations and Devotions, the collection of Newman's private prayers published after his death in 1893.",
      occasions: ["conversion", "discernment", "daily"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations8.html#truth",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-prayer-for-a-happy-death",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations8.html#death",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-prayer-for-a-happy-death",
      title: "Prayer for a Happy Death (Saint John Henry Newman)",
      body: "Oh, my Lord and Saviour, support me in that hour in the strong arms of Thy Sacraments, and by the fresh fragrance of Thy consolations. Let the absolving words be said over me, and the holy oil sign and seal me, and Thy own Body be my food, and Thy Blood my sprinkling; and let my sweet Mother, Mary, breathe on me, and my Angel whisper peace to me, and my glorious Saints ... smile upon me; that in them all, and through them all, I may receive the gift of perseverance, and die, as I desire to live, in Thy faith, in Thy Church, in Thy service, and in Thy love. Amen.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        'Newman\'s prayer to be upheld at the hour of death by the last sacraments, by the Blessed Virgin, his guardian angel and the saints, so as to die in the faith, the Church, the service and the love of Christ. The ellipsis after "my glorious Saints" stands in the printed book.',
      occasions: ["preparation-for-death", "deathbed", "daily"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations8.html#death",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-four-prayers-to-saint-philip-neri",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations8.html#prayersphilip",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-four-prayers-to-saint-philip-neri",
      title: "Four Prayers to Saint Philip Neri (Saint John Henry Newman)",
      body: "Prayer I\n\nO my dear and holy Patron, Philip, I put myself into thy hands, and for the love of Jesus, for that love’s sake which chose thee and made thee a saint, I implore thee to pray for me, that, as He has brought thee to heaven, so in due time He may take me to heaven too.\n\nThou hast had experience of the trials and troubles of this life; thou knowest well what it is to bear the assaults of the devil, the mockery of the world, and the temptations of flesh and blood. Thou knowest how weak is human nature, and how treacherous the human heart, and thou art so full of sympathy and compassion, that, amidst all thy present ineffable glory and blessedness, thou canst, I know, give a thought to me.\n\nThink of me then, my dear St. Philip, be sure to think of me, even though I am at times so unmindful of thee. Gain for me all things necessary for my perseverance in the grace of God, and my eternal salvation. Gain for me, by thy powerful intercession, the strength to fight a good fight, to witness boldly for God and religion in the midst of sinners, to be brave when Satan would frighten or force me to what is wrong, to overcome myself, to do my whole duty, and thus to be acquitted in the judgment.\n\nVessel of the Holy Ghost, Apostle of Rome, Saint of primitive times, pray for me.\n\nPrayer II\n\nO my dear and holy Patron, Philip, I put myself into thy hands, and for the love of Jesus, for that love’s sake, which chose thee and made thee a saint, I implore thee to pray for me, that, as He has brought thee to heaven, so in due time He may take me to heaven also.\n\nAnd I ask of thee especially to gain for me a true devotion such as thou hadst to the Holy Ghost, the Third Person in the Ever-blessed Trinity; that, as He at Pentecost so miraculously filled thy heart with his grace, I too may in my measure have the gifts necessary for my salvation.\n\nTherefore I ask thee to gain for me those His seven great gifts, to dispose and excite my heart towards faith and virtue.\n\nBeg for me the gift of Wisdom, that I may prefer heaven to earth, and know truth from falsehood:\n\nThe gift of Understanding, by which I may have imprinted upon my mind the mysteries of His Word:\n\nThe gift of Counsel, that I may see my way in all perplexities:\n\nThe gift of Fortitude, that with bravery and stubbornness I may battle with my foe:\n\nThe gift of Knowledge, to enable me to direct all my doings with a pure intention to the glory of God:\n\nThe gift of Religion, to make me devout and conscientious:\n\nAnd the gift of Holy Fear, to make me feel awe, reverence and sobriety amid all my spiritual blessings.\n\nSweetest Father, Flower of Purity, Martyr of Charity, pray for me.\n\nPrayer III\n\nO my dear and holy Patron, Philip, I put myself into thy hands, and for the love of Jesus, for that love’s sake which chose thee and made thee a saint, I implore thee to pray for me, that, as He has brought thee to heaven, so in due time He may take me to heaven also.\n\nAnd I beg of thee to gain for me a true devotion to the Holy Ghost, by means of that grace which He Himself, the Third Person of the glorious Trinity, bestows. Gain for me a portion of that overflowing devotion which thou hadst towards Him when thou wast on earth; for that, O my dear father, was one of thy special distinctions from other saints, that, though they all adored supremely and solely the Holy Ghost as their one God, yet thou, like Pope St. Gregory, the Apostle of England, didst adore Him not only in the unity of the Godhead, but also as proceeding from the Father and the Son, the gift of the Most High and the Giver of life.\n\nGain for me, O holy Philip, such a measure of thy devotion towards Him, that, as He did deign to come into thy heart miraculously and set it on fire with love, He may reward us too with some special and corresponding gift of grace. O Philip, let us not be the cold sons of so fervent a Father. It will be a great reproach to thee, if thou dost not make us in some measure like thyself. Gain for us the grace of prayer and meditation, power to command our thoughts and keep from distractions, and the gift of conversing with God without being wearied.\n\nHeart of fire, Light of holy joy, Victim of love, pray for me.\n\nPrayer IV\n\nO my dear and holy Patron, Philip, I put myself into thy hands, and for the love of Jesus, for that love’s sake which chose thee and made thee a saint, I implore thee to pray for me, that, as He has brought thee to heaven, so in due time He may take me to heaven also.\n\nThou art my glorious protector, and, after Jesus, Mary, and Joseph, canst do most for me in life and death. In thy labours thou didst follow thy Lord and Saviour, and in thy hidden life and hidden virtues, in thy purity, humility, and fervour, art nearest to Mary and Joseph of all saints. I have long dedicated myself to thee, but I have done nothing worthy of thee, and I am ashamed to call myself thine, because thou hast a right to have followers of great innocence, great honesty of purpose, and great resolution, and these virtues I have not.\n\nThou, Philip, hast no anxiety about thyself, for thou art already in heaven, therefore thou canst afford to have a care for me. Watch over me, keep me from lagging behind, gain for me the grace necessary to keep me up to my duty, so that I may make progress in all virtues, in the three theological virtues of faith, hope, and charity; in the four cardinal virtues of prudence, fortitude, justice, temperance; moreover in humility, in chastity, in liberality, in meekness, and in truthfulness.\n\nDirector of souls, Patron of thine own, who didst turn so many hearts to God, pray for me.",
      prayerType: "intercession",
      category: "saintly",
      language: "en",
      summary:
        "Four prayers to Saint Philip Neri, whose Oratory Newman brought to England. Each opens with the same act of entrustment, then asks in turn for perseverance, for the seven gifts of the Holy Ghost, for Philip's own devotion to the Holy Ghost and the grace of prayer, and for growth in every virtue. The 1893 editor notes that they are what survives of an unfinished novena, and that the invocation closing the fourth prayer was supplied for uniformity.",
      occasions: ["may-26", "pentecost"],
      relatedSaints: ["saint-john-henry-newman", "saint-philip-neri"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations8.html#prayersphilip",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-short-visit-to-the-blessed-sacrament",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations9.html",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-short-visit-to-the-blessed-sacrament",
      title: "A Short Visit to the Blessed Sacrament before Meditation (Saint John Henry Newman)",
      body: "In the Name of the Father, and of the Son, and of the Holy Ghost. Amen.\n\nI place myself in the presence of Him, in whose Incarnate Presence I am before I place myself there.\n\nI adore Thee, O my Saviour, present here as God and man, in soul and body, in true flesh and blood.\n\nI acknowledge and confess that I kneel before that Sacred Humanity, which was conceived in Mary's womb, and lay in Mary's bosom; which grew up to man's estate, and by the Sea of Galilee called the Twelve, wrought miracles, and spoke words of wisdom and peace; which in due season hung on the cross, lay in the tomb, rose from the dead, and now reigns in heaven.\n\nI praise, and bless, and give myself wholly to Him, who is the true Bread of my soul, and my everlasting joy.\n\nSunday\n\nO Sapientia, quæ ex ore Altissimi prodiisti, attingens à fine usque ad finem, fortiter suaviterque disponens omnia: Veni ad docendum nos viam prudentiæ.\n\nMonday\n\nO Adonai, et Dux domus Israel, qui Moysi in igne flammæ rubi apparuisti, et ei in Sina legem dedisti: Veni ad redimendum nos in brachio extento.\n\nTuesday\n\nO Radix Jesse, qui stas in signum populorum, super quem continebunt reges os suum, quem Gentes deprecabuntur: Veni ad liberandum nos, jam noli tardare.\n\nWednesday\n\nO Clavis David, et Sceptrum domus Israel, qui aperis et nemo claudit, claudis et nemo aperit: Veni, et educ vinctum de domo carceris, sedentem in tenebris et umbrâ mortis.\n\nThursday\n\nO Oriens, Splendor lucis æternæ, et sol justitiæ: Veni et illumina sedentes in tenebris et umbrâ mortis.\n\nFriday\n\nO Rex Gentium, et desideratus earum, lapisque angularis, qui facis utraque unum: Veni et salva hominem, quem de limo formasti.\n\nSaturday\n\nO Emmanuel, Rex et Legifer noster, Expectatio gentium, et Salvator earum: Veni ad salvandum nos, Domine Deus noster.",
      prayerType: "general",
      category: "eucharistic",
      language: "en",
      summary:
        "Newman's brief act of adoration before the Blessed Sacrament, dated 1 March 1855 and meant to open a time of meditation: the sign of the cross, placing oneself in Christ's presence, adoration of his Sacred Humanity and an offering of self, followed by the Latin \"O\" antiphon of Advent that Newman assigned to each day of the week.",
      occasions: ["adoration", "visit-to-the-blessed-sacrament", "meditation"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations9.html",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-i-put-myself-without-reserve-into-thy-hands",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations9.html#doctrine1",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-i-put-myself-without-reserve-into-thy-hands",
      title: "I Will Put Myself without Reserve into Thy Hands (Saint John Henry Newman)",
      body: "O, my God, I will put myself without reserve into Thy hands. Wealth or woe, joy or sorrow, friends or bereavement, honour or humiliation, good report or ill report, comfort or discomfort, Thy presence or the hiding of Thy countenance, all is good if it comes from Thee. Thou art wisdom and Thou art love—what can I desire more? Thou hast led me in Thy counsel, and with glory hast Thou received me. What have I in heaven, and apart from Thee what want I upon earth? My flesh and my heart faileth: but God is the God of my heart, and my portion for ever.",
      prayerType: "act",
      category: "act",
      language: "en",
      summary:
        "The colloquy that closes the first of Newman's meditations on Hope in God the Creator (6 March 1848): an act of surrender placing every circumstance of life, wealth or woe, honour or humiliation, into the hands of the God who is wisdom and love. It ends with verses of Psalm 72 (73).",
      occasions: ["trust", "daily", "offering"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations9.html#doctrine1",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-i-ask-simply-to-be-used",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations9.html#doctrine1",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-i-ask-simply-to-be-used",
      title: "I Ask Simply to Be Used (Saint John Henry Newman)",
      body: "O Adonai, O Ruler of Israel, Thou that guidest Joseph like a flock, O Emmanuel, O Sapientia, I give myself to Thee. I trust Thee wholly. Thou art wiser than I—more loving to me than I myself. Deign to fulfil Thy high purposes in me whatever they be—work in and through me. I am born to serve Thee, to be Thine, to be Thy instrument. Let me be Thy blind instrument. I ask not to see—I ask not to know—I ask simply to be used.",
      prayerType: "act",
      category: "act",
      language: "en",
      summary:
        "The prayer that ends Newman's meditation of 7 March 1848, the meditation known for its words on the definite service God has committed to each person. Addressing Christ by titles from the Advent antiphons, it trusts God's purposes without needing to see them and asks only to be his instrument.",
      occasions: ["trust", "vocations", "discernment", "offering"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations9.html#doctrine1",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-god-the-blessedness-of-the-soul",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations9.html#doctrine3",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-god-the-blessedness-of-the-soul",
      title: "God the Blessedness of the Soul (Saint John Henry Newman)",
      body: "1. To possess Thee, O Lover of Souls, is happiness, and the only happiness of the immortal soul! To enjoy the sight of Thee is the only happiness of eternity. At present I might amuse and sustain myself with the vanities of sense and time, but they will not last for ever. We shall be stripped of them when we pass out of this world. All shadows will one day be gone. And what shall I do then? There will be nothing left to me but the Almighty God. If I cannot take pleasure in the thought of Him, there is no one else then to take pleasure in; God and my soul will be the only two beings left in the whole world, as far as I am concerned. He will be all in all, whether I wish it or no. What a strait I shall then be in if I do not love Him, and there is then nothing else to love! if I feel averse to Him, and He is then ever looking upon me!\n\n2. Ah, my dear Lord, how can I bear to say that Thou wilt be all in all, whether I wish it or no? Should I not wish it with my whole heart? What can give me happiness but Thou? If I had all the resources of time and sense about me, just as I have now, should I not in course of ages, nay of years, weary of them? Did this world last for ever, would it be able ever to supply my soul with food? Is there any earthly thing which I do not weary of at length even now? Do old men love what young men love? Is there not constant change? I am sure then, my God, that the time would come, though it might be long in coming, when I should have exhausted all the enjoyment which the world could give. Thou alone, my dear Lord, art the food for eternity, and Thou alone. Thou only canst satisfy the soul of man. Eternity would be misery without Thee, even though Thou didst not inflict punishment. To see Thee, to gaze on Thee, to contemplate Thee, this alone is inexhaustible. Thou indeed art unchangeable, yet in Thee there are always more glorious depths and more varied attributes to search into; we shall ever be beginning as if we had never gazed upon Thee. In Thy presence are torrents of delight, which whoso tastes will never let go. This is my true portion, O my Lord, here and hereafter!\n\n3. My God, how far am I from acting according to what I know so well! I confess it, my heart goes after shadows. I love anything better than communion with Thee. I am ever eager to get away from Thee. Often I find it difficult even to say my prayers. There is hardly any amusement I would not rather take up than set myself to think of Thee. Give me grace, O my Father, to be utterly ashamed of my own reluctance! Rouse me from sloth and coldness, and make me desire Thee with my whole heart. Teach me to love meditation, sacred reading, and prayer. Teach me to love that which must engage my mind for all eternity.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A meditation of Newman's written throughout as a prayer: every earthly good wearies in the end, God alone can satisfy the soul for eternity, and so the speaker asks to be roused from sloth and taught to love meditation, sacred reading and prayer.",
      occasions: ["meditation", "daily"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations9.html#doctrine3",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-jesus-christ-yesterday-and-today",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations9.html#jesus",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-jesus-christ-yesterday-and-today",
      title: "Jesus Christ Yesterday and Today, and the Same for Ever (Saint John Henry Newman)",
      body: '1. All things change here below. I say it, O Lord; I believe it; and I shall feel it more and more the longer I live. Before Thy eyes, most awful Lord, the whole future of my life lies bare. Thou knowest exactly what will befall me every year and every day till my last hour. And, though I know not what Thou seest concerning me, so much I know, viz. that Thou dost read in my life perpetual change. Not a year will leave me as it found me, either within or without. I never shall remain any time in one state. How many things are sure to happen to me, unexpected, sudden, hard to bear! I know them not. I know not how long I have to live. I am hurried on, whether I will it or no, through continual change. O my God, what can I trust in? There is nothing I dare trust in; nay, did I trust in anything of earth, I believe for that very reason it would be taken away from me. I know Thou wouldest take it away, if Thou hadst love for me.\n\n2. Everything short of Thee, O Lord, is changeable, but Thou endurest. Thou art ever one and the same. Ever the true God of man, and unchangeably so. Thou art the rarest, most precious, the sole good; and withal Thou art the most lasting. The creature changes, the Creator never. Then only the creature stops changing, when it rests on Thee. On Thee the Angels look and are at peace; that is why they have perfect bliss. They never can lose their blessedness, for they never can lose Thee. They have no anxiety, no misgivings—because they love the Creator; not any being of time and sense, but "Jesus Christ, the same yesterday and today, who is also for ever.\n\n3. My Lord, my Only God, "Deus meus et omnia," let me never go after vanities. "Vanitas vanitatum et omnia vanitas." All is vanity and shadow here below. Let me not give my heart to anything here. Let nothing allure me from Thee; O keep me wholly and entirely. Keep thou this most frail heart and this most weak head in Thy Divine keeping. Draw me to Thee morning, noon, and night for consolation. Be Thou my own bright Light, to which I look, for guidance and for peace. Let me love Thee, O my Lord Jesus, with a pure affection and a fervent affection! Let me love Thee with the fervour, only greater, with which men of this earth love beings of this earth. Let me have that tenderness and constancy in loving Thee, which is so much praised among men, when the object is of the earth. Let me find and feel Thee to be my only joy, my only refuge, my only strength, my only comfort, my only hope, my only fear, my only love.',
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "Newman's meditation-prayer on Hebrews 13:8: everything in this life changes and nothing earthly can be trusted, but Christ remains the same, and so the soul asks to be kept from vanities and to find in Jesus its only joy, refuge, strength and hope.",
      occasions: ["meditation", "trust", "new-year"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations9.html#jesus",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-act-of-love",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations9.html#love",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-act-of-love",
      title: "An Act of Love (Saint John Henry Newman)",
      body: '1. My Lord, I believe, and know, and feel, that Thou art the Supreme Good. And, in saying so, I mean, not only supreme Goodness and Benevolence, but that Thou art the sovereign and transcendent Beautifulness. I believe that, beautiful as is Thy creation, it is mere dust and ashes, and of no account, compared with Thee, who art the infinitely more beautiful Creator. I know well, that therefore it is that the Angels and Saints have such perfect bliss, because they see Thee. To see even the glimpse of Thy true glory, even in this world throws holy men into an ecstasy. And I feel the truth of all this, in my own degree, because Thou hast mercifully taken our nature upon Thee, and hast come to me as man. "Et vidimus gloriam ejus, gloriam quasi Unigeniti a Patre"—"and we saw His glory, the glory as it were of the only begotten of the Father." The more, O my dear Lord, I meditate on Thy words, works, actions, and sufferings in the Gospel, the more wonderfully glorious and beautiful I see Thee to be.\n\n2. And therefore, O my dear Lord, since I perceive Thee to be so beautiful, I love Thee, and desire to love Thee more and more. Since Thou art the One Goodness, Beautifulness, Gloriousness, in the whole world of being, and there is nothing like Thee, but Thou art infinitely more glorious and good than even the most beautiful of creatures, therefore I love Thee with a singular love, a one, only, sovereign love. Everything, O my Lord, shall be dull and dim to me, after looking at Thee. There is nothing on earth, not even what is most naturally dear to me, that I can love in comparison of Thee. And I would lose everything whatever rather than lose Thee. For Thou, O my Lord, art my supreme and only Lord and love.\n\n3. My God, Thou knowest infinitely better than I, how little I love Thee. I should not love Thee at all, except for Thy grace. It is Thy grace which has opened the eyes of my mind, and enabled them to see Thy glory. It is Thy grace which has touched my heart, and brought upon it the influence of what is so wonderfully beautiful and fair. How can I help loving Thee, O my Lord, except by some dreadful perversion, which hinders me from looking at Thee? O my God, whatever is nearer to me than Thou, things of this earth, and things more naturally pleasing to me, will be sure to interrupt the sight of Thee, unless Thy grace interfere. Keep Thou my eyes, my ears, my heart, from any such miserable tyranny. Break my bonds—raise my heart. Keep my whole being fixed on Thee. Let me never lose sight of Thee; and, while I gaze on Thee, let my love of Thee grow more and more every day.',
      prayerType: "act",
      category: "act",
      language: "en",
      summary:
        "Newman's act of love for God as the supreme Good and the supreme Beauty, seen most clearly in the incarnate Son of the Gospels, with a petition that grace keep the eyes and heart fixed on him so that love may grow every day.",
      occasions: ["act-of-love", "daily", "meditation"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations9.html#love",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-against-thee-only-have-i-sinned",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations10.html#sin2",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-against-thee-only-have-i-sinned",
      title: "Against Thee Only Have I Sinned (Saint John Henry Newman)",
      body: "1. My God, I dare not offend any earthly superior; I am afraid—for I know I shall get into trouble—yet I dare offend Thee. I know, O Lord, that, according to the greatness of the person offended against, the greater is the offence. Yet I do not fear to offend Thee, whom to offend is to offend the infinite God. O my dear Lord, how should I myself feel, what should I say of myself, if I were to strike some revered superior on earth? if I were violently to deal a blow upon some one as revered as a father, or a priest; if I were to strike them on the face? I cannot bear even to think of such a thing—yet what is this compared with lifting up my hand against Thee? and what is sin but this? To sin is to insult Thee in the grossest of all conceivable ways. This then, O my soul! is what the sinfulness of sin consists in. It is lifting up my hand against my Infinite Benefactor, against my Almighty Creator, Preserver and Judge—against Him in whom all majesty and glory and beauty and reverence and sanctity centre; against the one only God.\n\n2. O my God, I am utterly confounded to think of the state in which I lie! What will become of me if Thou art severe? What is my life, O my dear and merciful Lord, but a series of offences, little or great, against Thee! O what great sins I have committed against Thee before now—and how continually in lesser matters I am sinning! My God, what will become of me? What will be my position hereafter if I am left to myself! What can I do but come humbly to Him whom I have so heavily affronted and insulted, and beg Him to forgive the debt which lies against me? O my Lord Jesus, whose love for me has been so great as to bring Thee down from heaven to save me, teach me, dear Lord, my sin—teach me its heinousness—teach me truly to repent of it—and pardon it in Thy great mercy!\n\n3. I beg Thee, O my dear Saviour, to recover me! Thy grace alone can do it. I cannot save myself. I cannot recover my lost ground. I cannot turn to Thee, I cannot please Thee, or save my soul without Thee. I shall go from bad to worse, I shall fall from Thee entirely, I shall quite harden myself against my neglect of duty, if I rely on my own strength. I shall make myself my centre instead of making Thee. I shall worship some idol of my own framing instead of Thee, the only true God and my Maker, unless Thou hinder it by Thy grace. O my dear Lord, hear me! I have lived long enough in this undecided, wavering, unsatisfactory state. I wish to be Thy good servant. I wish to sin no more. Be gracious to me, and enable me to be what I know I ought to be.",
      prayerType: "act",
      category: "penitential",
      language: "en",
      summary:
        "A penitential meditation-prayer from Newman's series on sin: sin is an offence against the infinite God, a life of offences great and small is confessed, and Christ is begged to teach true repentance and by his grace to recover the sinner. Its title is taken from Psalm 50 (51).",
      occasions: ["confession", "examination-of-conscience", "lent"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations10.html#sin2",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-the-power-of-the-cross",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations10.html#doctrine5",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-the-power-of-the-cross",
      title: "The Power of the Cross (Saint John Henry Newman)",
      body: "1. My God, who could have imagined, by any light of nature, that it was one of Thy attributes to lower Thyself, and to work out Thy purposes by Thy own humiliation and suffering? Thou hadst lived from eternity in ineffable blessedness. My God, I might have understood as much as this, viz. that, when Thou didst begin to create and surround Thyself with a world of creatures, that these attributes would show themselves in Thee which before had no exercise. Thou couldest not show Thy power when there was nothing whatever to exercise it. Then too, Thou didst begin to show thy wonderful and tender providence, Thy faithfulness, Thy solicitous care for those whom Thou hadst created. But who could have fancied that Thy creation of the universe implied and involved in it Thy humiliation? O my great God, Thou hast humbled Thyself, Thou hast stooped to take our flesh and blood, and hast been lifted up upon the tree! I praise and glorify Thee tenfold the more, because Thou hast shown Thy power by means of Thy suffering, than hadst Thou carried on Thy work without it. It is worthy of Thy infinitude thus to surpass and transcend all our thoughts.\n\n2. O my Lord Jesu, I believe, and by Thy grace will ever believe and hold, and I know that it is true, and will be true to the end of the world, that nothing great is done without suffering, without humiliation, and that all things are possible by means of it. I believe, O my God, that poverty is better than riches, pain better than pleasure, obscurity and contempt than name, and ignominy and reproach than honour. My Lord, I do not ask Thee to bring these trials on me, for I know not if I could face them; but at least, O Lord, whether I be in prosperity or adversity, I will believe that it is as I have said. I will never have faith in riches, rank, power, or reputation. I will never set my heart on worldly success or on worldly advantages. I will never wish for what men call the prizes of life. I will ever, with Thy grace, make much of those who are despised or neglected, honour the poor, revere the suffering, and admire and venerate Thy saints and confessors, and take my part with them in spite of the world.\n\n3. And lastly, O my dear Lord, though I am so very weak that I am not fit to ask Thee for suffering as a gift, and have not strength to do so, at least I will beg of Thee grace to meet suffering well, when Thou in Thy love and wisdom dost bring it upon me. Let me bear pain, reproach, disappointment, slander, anxiety, suspense, as Thou wouldest have me, O my Jesu, and as Thou by Thy own suffering hast taught me, when it comes. And I promise too, with Thy grace, that I will never set myself up, never seek pre-eminence, never court any great thing of the world, never prefer myself to others. I wish to bear insult meekly, and to return good for evil. I wish to humble myself in all things, and to be silent when I am ill-used, and to be patient when sorrow or pain is prolonged, and all for the love of Thee, and Thy Cross, knowing that in this way I shall gain the promise both of this life and of the next.",
      prayerType: "general",
      category: "devotional",
      language: "en",
      summary:
        "Newman's prayer on the mystery that God works out his purposes through humiliation and suffering. It professes that nothing great is done without suffering, renounces trust in riches and worldly success, and asks for grace to bear pain, slander and disappointment patiently for love of Christ and his Cross.",
      occasions: ["lent", "good-friday", "suffering", "exaltation-of-the-holy-cross"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations10.html#doctrine5",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-my-lord-and-my-god",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations10.html#resurrection2",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-my-lord-and-my-god",
      title: "God Alone: My Lord and My God (Saint John Henry Newman)",
      body: '1. I adore Thee, O my God, with Thomas; and if I have, like him, sinned through unbelief, I adore Thee the more. I adore Thee as the One Adorable, I adore Thee as more glorious in Thy humiliation, when men despised Thee, than when Angels worshipped Thee. Deus meus et omnia—"My God and my all." To have Thee is to have everything I can have. O my Eternal Father, give me Thyself. I dared not have made so bold a request, it would have been presumption, unless Thou hadst encouraged me. Thou hast put it into my mouth, Thou hast clothed Thyself in my nature, Thou hast become my Brother, Thou hast died as other men die, only in far greater bitterness, that, instead of my eyeing Thee fearfully from afar, I might confidently draw near to Thee. Thou dost speak to me as Thou didst speak to Thomas, and dost beckon me to take hold of Thee. My God and my all, what could I say more than this, if I spoke to all eternity! I am full and abound and overflow, when I have Thee; but without Thee I am nothing—I wither away, I dissolve and perish. My Lord and my God, my God and my all, give me Thyself and nothing else.\n\n2. Thomas came and touched Thy sacred wounds. O will the day ever come when I shall be allowed actually and visibly to kiss them? What a day will that be when I am thoroughly cleansed from all impurity and sin, and am fit to draw near to my Incarnate God in His palace of light above! what a morning, when having done with all penal suffering, I see Thee for the first time with these very eyes of mine, I see Thy countenance, gaze upon Thy eyes and gracious lips without quailing, and then kneel down with joy to kiss Thy feet, and am welcomed into Thy arms. O my only true Lover, the only Lover of my soul, Thee will I love now, that I may love Thee then. What a day, a long day without ending, the day of eternity, when I shall be so unlike what I am now, when I feel in myself a body of death, and am perplexed and distracted with ten thousand thoughts, any one of which would keep me from heaven. O my Lord, what a day when I shall have done once for all with all sins, venial as well as mortal, and shall stand perfect and acceptable in Thy sight, able to bear Thy presence, nothing shrinking from Thy eye, not shrinking from the pure scrutiny of Angels and Archangels, when I stand in the midst and they around me!\n\n3. O my God, though I am not fit to see or touch Thee yet, still I will ever come within Thy reach, and desire that which is not yet given me in its fulness. O my Saviour, Thou shalt be my sole God!—I will have no Lord but Thee. I will break to pieces all idols in my heart which rival Thee. I will have nothing but Jesus and Him crucified. It shall be my life to pray to Thee, to offer myself to Thee, to keep Thee before me, to worship Thee in Thy holy Sacrifice, and to surrender myself to Thee in Holy Communion.',
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A meditation-prayer for Eastertide on the confession of Saint Thomas (John 20:28): adoring the risen Christ, the speaker longs for the day of seeing his wounds in heaven and resolves to have no Lord but Jesus, worshipped in the Mass and received in Holy Communion.",
      occasions: ["easter", "divine-mercy-sunday", "adoration"],
      relatedSaints: ["saint-john-henry-newman", "saint-thomas-the-apostle"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations10.html#resurrection2",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-jesus-the-hidden-god",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations10.html#god2",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-jesus-the-hidden-god",
      title: "Jesus the Hidden God (Saint John Henry Newman)",
      body: "1. I adore Thee, O my God, who art so awful, because Thou art hidden and unseen! I adore Thee, and I desire to live by faith in what I do not see; and considering what I am, a disinherited outcast, I think it has indeed gone well with me that I am allowed, O my unseen Lord and Saviour, to worship Thee anyhow. O my God, I know that it is sin that has separated between Thee and me. I know it is sin that has brought on me the penalty of ignorance. Adam, before he fell, was visited by Angels. Thy Saints, too, who keep close to Thee, see visions, and in many ways are brought into sensible perception of Thy presence. But to a sinner such as I am, what is left but to possess Thee without seeing Thee? Ah, should I not rejoice at having that most extreme mercy and favour of possessing Thee at all? It is sin that has reduced me to live by faith, as I must at best, and should I not rejoice in such a life, O Lord my God? I see and know, O my good Jesus, that the only way in which I can possibly approach Thee in this world is the way of faith, faith in what Thou hast told me, and I thankfully follow this only way which Thou hast given me.\n\n2. O my God, Thou dost over-abound in mercy! To live by faith is my necessity, from my present state of being and from my sin; but Thou hast pronounced a blessing on it. Thou hast said that I am more blessed if I believe on Thee, than if I saw Thee. Give me to share that blessedness, give it to me in its fulness. Enable me to believe as if I saw; let me have Thee always before me as if Thou wert always bodily and sensibly present. Let me ever hold communion with Thee, my hidden, but my living God. Thou art in my innermost heart. Thou art the life of my life. Every breath I breathe, every thought of my mind, every good desire of my heart, is from the presence within me of the unseen God. By nature and by grace Thou art in me. I see Thee not in the material world except dimly, but I recognise Thy voice in my own intimate consciousness. I turn round and say Rabboni. O be ever thus with me; and if I am tempted to leave Thee, do not Thou, O my God, leave me!\n\n3. O my dear Saviour, would that I had any right to ask to be allowed to make reparation to Thee for all the unbelief of the world, and all the insults offered to Thy Name, Thy Word, Thy Church, and the Sacrament of Thy Love! But, alas, I have a long score of unbelief and ingratitude of my own to atone for. Thou art in the Sacrifice of the Mass, Thou art in the Tabernacle, verily and indeed, in flesh and blood; and the world not only disbelieves, but mocks at this gracious truth. Thou didst warn us long ago by Thyself and by Thy Apostles that Thou wouldest hide Thyself from the world. The prophecy is fulfilled more than ever now; but I know what the world knows not. O accept my homage, my praise, my adoration!—let me at least not be found wanting. I cannot help the sins of others—but one at least of those whom Thou hast redeemed shall turn round and with a loud voice glorify God. The more men scoff, the more will I believe in Thee, the good God, the good Jesus, the hidden Lord of life, who hast done me nothing else but good from the very first moment that I began to live.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "Newman's prayer of faith in the God who is hidden from sight. It accepts the life of faith as the blessing Christ promised to those who believe without seeing (John 20:29), asks for constant communion with the unseen Lord dwelling within, and offers adoration in reparation for unbelief toward Christ present in the Mass and the tabernacle.",
      occasions: ["easter", "adoration", "meditation"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations10.html#god2",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-jesus-the-light-of-the-soul",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations10.html#god3",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-jesus-the-light-of-the-soul",
      title: "Jesus the Light of the Soul (Saint John Henry Newman)",
      body: '1. I adore Thee, O my God, as the true and only Light! From Eternity to Eternity, before any creature was, when Thou wast alone, alone but not solitary, for Thou hast ever been Three in One, Thou wast the Infinite Light. There was none to see Thee but Thyself. The Father saw that Light in the Son, and the Son in the Father. Such as Thou wast in the beginning, such Thou art now. Most separate from all creatures in this Thy uncreated Brightness. Most glorious, most beautiful. Thy attributes are so many separate and resplendent colours, each as perfect in its own purity and grace as if it were the sole and highest perfection. Nothing created is more than the very shadow of Thee. Bright as are the Angels, they are poor and most unworthy shadows of Thee. They pale and look dim and gather blackness before Thee. They are so feeble beside Thee, that they are unable to gaze upon Thee. The highest Seraphim veil their eyes, by deed as well as by word proclaiming Thy unutterable glory. For me, I cannot even look upon the sun, and what is this but a base material emblem of Thee? How should I endure to look even on an Angel? and how could I look upon Thee and live? If I were placed in the illumination of Thy countenance, I should shrink up like the grass. O most gracious God, who shall approach Thee, being so glorious, yet how can I keep from Thee?\n\n2. How can I keep from Thee? For Thou, who art the Light of Angels, art the only Light of my soul. Thou enlightenest every man that cometh into this world. I am utterly dark, as dark as hell, without Thee. I droop and shrink when Thou art away. I revive only in proportion as Thou dawnest upon me. Thou comest and goest at Thy will. O my God, I cannot keep Thee! I can only beg of Thee to stay. "Mane nobiscum, Domine, quoniam advesperascit." Remain till morning, and then go not without giving me a blessing. Remain with me till death in this dark valley, when the darkness will end. Remain, O Light of my soul, jam advesperascit! The gloom, which is not Thine, falls over me. I am nothing. I have little command of myself. I cannot do what I would. I am disconsolate and sad. I want something, I know not what. It is Thou that I want, though I so little understand this. I say it and take it on faith; I partially understand it, but very poorly. Shine on me, O Ignis semper ardens et nunquam deficiens!—"O fire ever burning and never failing"—and I shall begin, through and in Thy Light, to see Light, and to recognise Thee truly, as the Source of Light. Mane nobiscum; stay, sweet Jesus, stay for ever. In this decay of nature, give more grace.\n\n3. Stay with me, and then I shall begin to shine as Thou shinest: so to shine as to be a light to others. The light, O Jesus, will be all from Thee. None of it will be mine. No merit to me. It will be Thou who shinest through me upon others. O let me thus praise Thee, in the way which Thou dost love best, by shining on all those around me. Give light to them as well as to me; light them with me, through me. Teach me to show forth Thy praise, Thy truth, Thy will. Make me preach Thee without preaching—not by words, but by my example and by the catching force, the sympathetic influence, of what I do—by my visible resemblance to Thy saints, and the evident fulness of the love which my heart bears to Thee.',
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "Newman's prayer to Christ as the true and only Light, built on the plea of the disciples at Emmaus, \"Stay with us, because it is towards evening\" (Luke 24:29). Its closing section, asking to shine with Christ's light so as to preach him by example rather than words, is the text from which the popular prayer known as Radiating Christ was later adapted.",
      occasions: ["evening", "meditation", "daily"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations10.html#god3",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-god-is-love",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations11.html#doctrine10",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-god-is-love",
      title: "God Is Love (Saint John Henry Newman)",
      body: '1. Thou askest us to love Thee, O my God, and Thou art Thyself Love. There was one attribute of Thine which Thou didst exercise from eternity, and that was Love. We hear of no exercise of Thy power whilst Thou wast alone, nor of Thy justice before there were creatures on their trial; nor of Thy wisdom before the acts and works of Thy Providence; but from eternity Thou didst love, for Thou art not only One but Three. The Father loved from eternity His only begotten Son, and the Son returned to Him an equal love. And the Holy Ghost is that love in substance, wherewith the Father and the Son love one another. This, O Lord, is Thine ineffable and special blessedness. It is love. I adore Thee, O my infinite Love!\n\n2. And when Thou hadst created us, then Thou didst but love more, if that were possible. Thou didst love not only Thy own Co-equal Self in the multiplied Personality of the Godhead, but Thou didst love Thy creatures also. Thou wast love to us, as well as Love in Thyself. Thou wast love to man, more than to any other creatures. It was love that brought Thee from heaven, and subjected Thee to the laws of a created nature. It was love alone which was able to conquer Thee, the Highest—and bring Thee low. Thou didst die through Thine infinite love of sinners. And it is love, which keeps Thee here still, even now that Thou hast ascended on high, in a small tabernacle, and under cheap and common outward forms. O Amor meus, if Thou wert not infinite Love, wouldest Thou remain here, one hour, imprisoned and exposed to slight, indignity, and insult? O my God, I do not know what infinity means—but one thing I see, that Thou art loving to a depth and height far beyond any measurement of mine.\n\n3. And now Thou biddest me love Thee in turn, for Thou hast loved me. Thou wooest me to love Thee specially, above others. Thou dost say, "Lovest thou Me more than these?" O my God, how shameful that such a question need be put to me! yet, after all, do I really love Thee more than the run of men? The run of men do not really love Thee at all, but put Thee out of their thoughts. They feel it unpleasant to them to think of Thee; they have no sort of heart for Thee, yet Thou hast need to ask me whether I love Thee even a little. Why should I not love Thee much, how can I help loving Thee much, whom Thou hast brought so near to Thyself, whom Thou hast so wonderfully chosen out of the world to be Thy own special servant and son? Have I not cause to love Thee abundantly more than others, though all ought to love Thee? I do not know what Thou hast done for others personally, though Thou hast died for all—but I know what Thou hast done specially for me. Thou hast done that for me, O my love, which ought to make me love Thee with all my powers.',
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        'A meditation-prayer on God as Love: love is the one attribute God exercised from eternity within the Blessed Trinity, love brought the Son from heaven and keeps him in the tabernacle, and Christ\'s question to Peter, "Lovest thou Me more than these?", calls for generous love in return.',
      occasions: ["meditation", "act-of-love", "daily"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations11.html#doctrine10",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-resignation-to-gods-will",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations11.html#fortydays2",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-resignation-to-gods-will",
      title: "Resignation to God's Will (Saint John Henry Newman)",
      body: "1. O my God, Thou and Thou alone art all-wise and all-knowing! Thou knowest, Thou hast determined everything which will happen to us from first to last. Thou hast ordered things in the wisest way, and Thou knowest what will be my lot year by year till I die. Thou knowest how long I have to live. Thou knowest how I shall die. Thou hast precisely ordained everything, sin excepted. Every event of my life is the best for me that could be, for it comes from Thee. Thou dost bring me on year by year, by Thy wonderful Providence, from youth to age, with the most perfect wisdom, and with the most perfect love.\n\n2. My Lord, who camest into this world to do Thy Father's will, not Thine own, give me a most absolute and simple submission to the will of Father and Son. I believe, O my Saviour, that Thou knowest just what is best for me. I believe that Thou lovest me better than I love myself, that Thou art all-wise in Thy Providence, and all-powerful in Thy protection. I am as ignorant as Peter was what is to happen to me in time to come; but I resign myself entirely to my ignorance, and thank Thee with all my heart that Thou hast taken me out of my own keeping, and, instead of putting such a serious charge upon me, hast bidden me put myself into Thy hands. I can ask nothing better than this, to be Thy care, not my own. I protest, O my Lord, that, through Thy grace, I will follow Thee whithersoever Thou goest, and will not lead the way. I will wait on Thee for Thy guidance, and, on obtaining it, I will act upon it in simplicity and without fear. And I promise that I will not be impatient, if at any time I am kept by Thee in darkness and perplexity; nor will I ever complain or fret if I come into any misfortune or anxiety.\n\n3. I know, O Lord, Thou wilt do Thy part towards me, as I, through Thy grace, desire to do my part towards Thee. I know well Thou never canst forsake those who seek Thee, or canst disappoint those who trust Thee. Yet I know too, the more I pray for Thy protection, the more surely and fully I shall have it. And therefore now I cry out to Thee, and intreat Thee, first that Thou wouldest keep me from myself, and from following any will but Thine. Next I beg of Thee, that in Thy infinite compassion, Thou wouldest temper Thy will to me, that it may not be severe, but indulgent to me. Visit me not, O my loving Lord—if it be not wrong so to pray—visit me not with those trying visitations which saints alone can bear! Pity my weakness, and lead me heavenwards in a safe and tranquil course. Still I leave all in Thy hands, my dear Saviour—I bargain for nothing—only, if Thou shalt bring heavier trials on me, give me more grace—flood me with the fulness of Thy strength and consolation, that they may work in me not death, but life and salvation.",
      prayerType: "act",
      category: "act",
      language: "en",
      summary:
        "Newman's prayer of complete trust in divine providence, set under Christ's words to Peter, \"Follow thou Me\" (John 21:22). It submits every future event to God's wise and loving ordering, promises to follow without fretting in darkness, and asks humbly to be led by a gentle way, or to be given more grace if heavier trials come.",
      occasions: ["trust", "suffering", "times-of-trouble", "easter-season"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations11.html#fortydays2",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-the-paraclete-the-life-of-my-soul",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations11.html#paraclete3",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-the-paraclete-the-life-of-my-soul",
      title: "The Paraclete, the Life of My Soul (Saint John Henry Newman)",
      body: "1. My God, I adore Thee for taking on Thee the charge of sinners; of those, who not only cannot profit Thee, but who continually grieve and profane Thee. Thou hast taken on Thyself the office of a minister, and that for those who did not ask for it. I adore Thee for Thy incomprehensible condescension in ministering to me. I know and feel, O my God, that Thou mightest have left me, as I wished to be left, to go my own way, to go straight forward in my wilfulness and self-trust to hell. Thou mightest have left me in that enmity to Thee which is in itself death. I should at length have died the second death, and should have had no one to blame for it but myself. But Thou, O Eternal Father, hast been kinder to me than I am to myself. Thou hast given me, Thou hast poured out upon me Thy grace, and thus I live.\n\n2. My God, I adore Thee, O Eternal Paraclete, the light and the life of my soul. Thou mightest have been content with merely giving me good suggestions, inspiring grace and helping from without. Thou mightest thus have led me on, cleansing me with Thy inward virtue, when I changed my state from this world to the next. But in Thine infinite compassion Thou hast from the first entered into my soul, and taken possession of it. Thou hast made it Thy Temple. Thou dwellest in me by Thy grace in an ineffable way, uniting me to Thyself and the whole company of angels and saints. Nay, as some have held, Thou art present in me, not only by Thy grace, but by Thy eternal substance, as if, though I did not lose my own individuality, yet in some sense I was even here absorbed in God. Nay—as though Thou hadst taken possession of my very body, this earthly, fleshly, wretched tabernacle—even my body is Thy Temple. O astonishing, awful truth! I believe it, I know it, O my God!\n\n3. O my God, can I sin when Thou art so intimately with me? Can I forget who is with me, who is in me? Can I expel a Divine Inhabitant by that which He abhors more than anything else, which is the one thing in the whole world which is offensive to Him, the only thing which is not His? Would not this be a kind of sin against the Holy Ghost? My God, I have a double security against sinning; first the dread of such a profanation of all Thou art to me in Thy very Presence; and next because I do trust that that Presence will preserve me from sin. My God, Thou wilt go from me, if I sin; and I shall be left to my own miserable self. God forbid! I will use what Thou hast given me; I will call on Thee when tried and tempted. I will guard against the sloth and carelessness into which I am continually falling. Through Thee I will never forsake Thee.",
      prayerType: "general",
      category: "trinitarian",
      language: "en",
      summary:
        "Newman's adoration of the Holy Ghost, who dwells in the soul of the baptized as in his temple, with a resolve never to drive so intimate a Guest away by sin. One of four meditations on the Paraclete in Meditations and Devotions; suited to Pentecost and Confirmation.",
      occasions: ["pentecost", "confirmation", "meditation"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations11.html#paraclete3",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-the-paraclete-the-fount-of-love",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations11.html#paraclete4",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-the-paraclete-the-fount-of-love",
      title: "The Paraclete, the Fount of Love (Saint John Henry Newman)",
      body: '1. My God, I adore Thee, as the Third Person of the Ever-Blessed Trinity, under the name and designation of Love. Thou art that Living Love, wherewith the Father and the Son love each other. And Thou art the Author of supernatural love in our hearts—"Fons vivus, ignis, charitas." As a fire Thou didst come down from heaven on the day of Pentecost; and as a fire Thou burnest away the dross of sin and vanity in the heart and dost light up the pure flame of devotion and affection. It is Thou who unitest heaven and earth by showing to us the glory and beauty of the Divine Nature, and making us love what is in Itself so winning and transporting. I adore Thee, O uncreate and everlasting Fire, by which our souls live, by which alone they are made fit for heaven.\n\n2. My God, the Paraclete, I acknowledge Thee as the Giver of that great gift, by which alone we are saved, supernatural love. Man is by nature blind and hardhearted in all spiritual matters; how is he to reach heaven? It is by the flame of Thy grace, which consumes him in order to new-make him, and so to fit him to enjoy what without Thee he would have no taste for. It is Thou, O Almighty Paraclete, who hast been and art the strength, the vigour and endurance, of the martyr in the midst of his torments. Thou art the stay of the confessor in his long, tedious, and humiliating toils. Thou art the fire, by which the preacher wins souls, without thought of himself, in his missionary labours. By Thee we wake up from the death of sin, to exchange the idolatry of the creature for the pure love of the Creator. By Thee we make acts of faith, hope, charity, and contrition. By Thee we live in the atmosphere of earth, proof against its infection. By Thee we are able to consecrate ourselves to the sacred ministry, and fulfil our awful engagements to it. By the fire which Thou didst kindle within us, we pray, and meditate, and do penance. As well could our bodies live, if the sun were extinguished, as our souls, if Thou art away.\n\n3. My most Holy Lord and Sanctifier, whatever there is of good in me is Thine. Without Thee, I should but get worse and worse as years went on, and should tend to be a devil. If I differ at all from the world, it is because Thou hast chosen me out of the world, and hast lit up the love of God in my heart. If I differ from Thy Saints, it is because I do not ask earnestly enough for Thy grace, and for enough of it, and because I do not diligently improve what Thou hast given me. Increase in me this grace of love, in spite of all my unworthiness. It is more precious than anything else in the world. I accept it in place of all the world can give me. O give it to me! It is my life.',
      prayerType: "general",
      category: "trinitarian",
      language: "en",
      summary:
        "Newman's adoration of the Holy Ghost as the living Love of the Father and the Son and the giver of supernatural charity, the fire that strengthened martyrs, confessors and missionaries, ending with a plea for an increase of the grace of love.",
      occasions: ["pentecost", "confirmation", "act-of-love"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations11.html#paraclete4",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-the-holy-sacrifice-of-the-mass",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations11.html#doctrine15",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-the-holy-sacrifice-of-the-mass",
      title: "The Holy Sacrifice: The Mass (Saint John Henry Newman)",
      body: "1. I adore Thee, O my Lord God, with the most profound awe for thy passion and crucifixion, in sacrifice for our sins. Thou didst suffer incommunicable sufferings in Thy sinless soul. Thou wast exposed in Thy innocent body to ignominious torments, to mingled pain and shame. Thou wast stripped and fiercely scourged, Thy sacred body vibrating under the heavy flail as trees under the blast. Thou wast, when thus mangled, hung up upon the Cross, naked, a spectacle for all to see Thee quivering and dying. What does all this imply, O Mighty God! What a depth is here which we cannot fathom! My God, I know well, Thou couldst have saved us at Thy word, without Thyself suffering; but Thou didst choose to purchase us at the price of Thy Blood. I look on Thee, the Victim lifted up on Calvary, and I know and protest that that death of Thine was an expiation for the sins of the whole world. I believe and know, that Thou alone couldst have offered a meritorious atonement; for it was Thy Divine Nature which gave Thy sufferings worth. Rather then than I should perish according to my deserts, Thou wast nailed to the Tree and didst die.\n\n2. Such a sacrifice was not to be forgotten. It was not to be—it could not be—a mere event in the world's history, which was to be done and over, and was to pass away except in its obscure, unrecognised effects. If that great deed was what we believe it to be, what we know it is, it must remain present, though past; it must be a standing fact for all times. Our own careful reflection upon it tells us this; and therefore, when we are told that Thou, O Lord, though Thou hast ascended to glory, hast renewed and perpetuated Thy sacrifice to the end of all things, not only is the news most touching and joyful, as testifying to so tender a Lord and Saviour, but it carries with it the full assent and sympathy of our reason. Though we neither could, nor would have dared, anticipate so wonderful a doctrine, yet we adore its very suitableness to Thy perfections, as well as its infinite compassionateness for us, now that we are told of it. Yes, my Lord, though Thou hast left the world, Thou art daily offered up in the Mass; and, though Thou canst not suffer pain and death, Thou dost still subject Thyself to indignity and restraint to carry out to the full Thy mercies towards us. Thou dost humble Thyself daily; for, being infinite, Thou couldst not end Thy humiliation while they existed for whom Thou didst submit to it. So Thou remainest a Priest for ever.\n\n3. My Lord, I offer Thee myself in turn as a sacrifice of thanksgiving. Thou hast died for me, and I in turn make myself over to Thee. I am not my own. Thou hast bought me; I will by my own act and deed complete the purchase. My wish is to be separated from everything of this world; to cleanse myself simply from sin; to put away from me even what is innocent, if used for its own sake, and not for Thine. I put away reputation and honour, and influence, and power, for my praise and strength shall be in Thee. Enable me to carry out what I profess.",
      prayerType: "general",
      category: "eucharistic",
      language: "en",
      summary:
        "Newman's meditation-prayer on the Mass: adoration of Christ's sacrifice on Calvary, wonder that this one sacrifice is renewed and perpetuated daily on the altar, and an offering of oneself to him in return as a sacrifice of thanksgiving.",
      occasions: ["mass", "before-mass", "corpus-christi"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations11.html#doctrine15",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-holy-communion",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations11.html#communion2",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-holy-communion",
      title: "Holy Communion: Enable Me to Bear Thee (Saint John Henry Newman)",
      body: '1. My God, who can be inhabited by Thee, except the pure and holy? Sinners may come to Thee, but to whom shouldst Thou come except to the sanctified? My God, I adore Thee as the Holiest; and, when Thou didst come upon earth, Thou didst prepare a holy habitation for Thyself in the most chaste womb of the Blessed Virgin. Thou didst make a dwelling place special for Thyself. She did not receive Thee without first being prepared for Thee; for from the moment that she was at all, she was filled with Thy grace, so that she never knew sin. And so she went on increasing in grace and merit year after year, till the time came, when Thou didst send down the Archangel to signify to her Thy presence within her. So holy must be the dwelling place of the Highest. I adore and glorify Thee, O Lord my God, for Thy great holiness.\n\n2. O my God, holiness becometh Thy House, and yet Thou dost make Thy abode in my breast. My Lord, my Saviour, to me Thou comest, hidden under the semblance of earthly things, yet in that very flesh and blood which Thou didst take from Mary. Thou, who didst first inhabit Mary\'s breast, dost come to me. My God, Thou seest me; I cannot see myself. Were I ever so good a judge about myself, ever so unbiassed, and with ever so correct a rule of judging, still, from my very nature, I cannot look at myself, and view myself truly and wholly. But Thou, as Thou comest to me, contemplatest me. When I say, Domine, non sum dignus—"Lord, I am not worthy"—Thou whom I am addressing, alone understandest in their fulness the words which I use. Thou seest how unworthy so great a sinner is to receive the One Holy God, whom the Seraphim adore with trembling. Thou seest, not only the stains and scars of past sins, but the mutilations, the deep cavities, the chronic disorders which they have left in my soul. Thou seest the innumerable living sins, though they be not mortal, living in their power and presence, their guilt, and their penalties, which clothe me. Thou seest all my bad habits, all my mean principles, all wayward lawless thoughts, my multitude of infirmities and miseries, yet Thou comest. Thou seest most perfectly how little I really feel what I am now saying, yet Thou comest. O my God, left to myself should I not perish under the awful splendour and the consuming fire of Thy Majesty. Enable me to bear Thee, lest I have to say with Peter, "Depart from me, for I am a sinful man, O Lord!"\n\n3. My God, enable me to bear Thee, for Thou alone canst. Cleanse my heart and mind from all that is past. Wipe out clean all my recollections of evil. Rid me from all languor, sickliness, irritability, feebleness of soul. Give me a true perception of things unseen, and make me truly, practically, and in the details of life, prefer Thee to anything on earth, and the future world to the present. Give me courage, a true instinct determining between right and wrong, humility in all things, and a tender longing love of Thee.',
      prayerType: "general",
      category: "eucharistic",
      language: "en",
      summary:
        "Newman's prayer before receiving Holy Communion: as God prepared the sinless Virgin to be his dwelling, so the communicant, knowing that only Christ sees the soul truly, confesses his unworthiness and asks to be cleansed and given courage, humility and a tender longing love of God.",
      occasions: ["before-communion", "mass", "corpus-christi"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations11.html#communion2",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-the-sacred-heart",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations12.html",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-the-sacred-heart",
      title: "The Sacred Heart (Saint John Henry Newman)",
      body: '1. O Sacred Heart of Jesus, I adore Thee in the oneness of the Personality of the Second Person of the Holy Trinity. Whatever belongs to the Person of Jesus, belongs therefore to God, and is to be worshipped with that one and the same worship which we pay to Jesus. He did not take on Him His human nature, as something distinct and separate from Himself, but as simply, absolutely, eternally His, so as to be included by us in the very thought of Him. I worship Thee, O Heart of Jesus, as being Jesus Himself, as being that Eternal Word in human nature which He took wholly and lives in wholly, and therefore in Thee. Thou art the Heart of the Most High made man. In worshipping Thee, I worship my Incarnate God, Emmanuel. I worship Thee, as bearing a part in that Passion which is my life, for Thou didst burst and break, through agony, in the garden of Gethsemani, and Thy precious contents trickled out, through the veins and pores of the skin, upon the earth. And again, Thou hadst been drained all but dry upon the Cross; and then, after death, Thou wast pierced by the lance, and gavest out the small remains of that inestimable treasure, which is our redemption.\n\n2. My God, my Saviour, I adore Thy Sacred Heart, for that heart is the seat and source of all Thy tenderest human affections for us sinners. It is the instrument and organ of Thy love. It did beat for us. It yearned over us. It ached for us, and for our salvation. It was on fire through zeal, that the glory of God might be manifested in and by us. It is the channel through which has come to us all Thy overflowing human affection, all Thy Divine Charity towards us. All Thy incomprehensible compassion for us, as God and Man, as our Creator and our Redeemer and Judge, has come to us, and comes, in one inseparably mingled stream, through that Sacred Heart. O most Sacred symbol and Sacrament of Love, divine and human, in its fulness, Thou didst save me by Thy divine strength, and Thy human affection, and then at length by that wonder-working blood, wherewith Thou didst overflow.\n\n3. O most Sacred, most loving Heart of Jesus, Thou art concealed in the Holy Eucharist, and Thou beatest for us still. Now as then Thou sayest, Desiderio desideravi—"With desire I have desired." I worship Thee then with all my best love and awe, with my fervent affection, with my most subdued, most resolved will. O my God, when Thou dost condescend to suffer me to receive Thee, to eat and drink Thee, and Thou for a while takest up Thy abode within me, O make my heart beat with Thy Heart. Purify it of all that is earthly, all that is proud and sensual, all that is hard and cruel, of all perversity, of all disorder, of all deadness. So fill it with Thee, that neither the events of the day nor the circumstances of the time may have power to ruffle it, but that in Thy love and Thy fear it may have peace.',
      prayerType: "general",
      category: "devotional",
      language: "en",
      summary:
        "Newman's act of adoration of the Sacred Heart of Jesus as the heart of the incarnate Word, the seat of his human affections and the channel of his love, still beating for us in the Eucharist, with a prayer that the communicant's heart may beat with his.",
      occasions: ["sacred-heart", "first-friday", "june", "feast-of-the-sacred-heart"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations12.html",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-the-providence-of-god",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations12.html#doctrine19",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-the-providence-of-god",
      title: "The Providence of God (Saint John Henry Newman)",
      body: "1. I adore Thee, my God, as having laid down the ends and the means of all things which Thou hast created. Thou hast created everything for some end of its own, and Thou dost direct it to that end. The end, which Thou didst in the beginning appoint for man, is Thy worship and service, and his own happiness in paying it; a blessed eternity of soul and body with Thee for ever. Thou hast provided for this, and that in the case of every man. As Thy hand and eye are upon the brute creation, so are they upon us. Thou sustainest everything in life and action for its own end. Not a reptile, not an insect, but Thou seest and makest to live, while its time lasts. Not a sinner, not an idolater, not a blasphemer, not an atheist lives, but by Thee, and in order that he may repent. Thou art careful and tender to each of the beings that Thou hast created, as if it were the only one in the whole world. For Thou canst see every one of them at once, and Thou lovest every one in this mortal life, and pursuest every one by itself, with all the fulness of Thy attributes, as if Thou wast waiting on it and ministering to it for its own sake. My God, I love to contemplate Thee, I love to adore Thee, thus the wonderful worker of all things every day in every place.\n\n2. All Thy acts of providence are acts of love. If Thou sendest evil upon us, it is in love. All the evils of the physical world are intended for the good of Thy creatures, or are the unavoidable attendants on that good. And Thou turnest that evil into good. Thou visitest men with evil to bring them to repentance, to increase their virtue, to gain for them greater good hereafter. Nothing is done in vain, but has its gracious end. Thou dost punish, yet in wrath Thou dost remember mercy. Even Thy justice when it overtakes the impenitent sinner, who had exhausted Thy loving providences towards him, is mercy to others, as saving them from his contamination, or granting them a warning. I acknowledge with a full and firm faith, O Lord, the wisdom and goodness of Thy Providence, even in Thy inscrutable judgments and Thy incomprehensible decrees.\n\n3. O my God, my whole life has been a course of mercies and blessings shewn to one who has been most unworthy of them. I require no faith, for I have had long experience, as to Thy providence towards me. Year after year Thou hast carried me on—removed dangers from my path—recovered me, recruited me, refreshed me, borne with me, directed me, sustained me. O forsake me not when my strength faileth me. And Thou never wilt forsake me. I may securely repose upon Thee. Sinner as I am, nevertheless, while I am true to Thee, Thou wilt still and to the end, be superabundantly true to me. I may rest upon Thy arm; I may go to sleep in Thy bosom. Only give me, and increase in me, that true loyalty to Thee, which is the bond of the covenant between Thee and me, and the pledge in my own heart and conscience that Thou, the Supreme God, wilt not forsake me, the most miserable of Thy children.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "Newman's prayer of thanksgiving and trust in divine providence: God directs every creature to its end with tender care and turns even evil to good, and the speaker, looking back on a lifetime of mercies, asks only for the loyalty that will keep him in God's covenant.",
      occasions: ["thanksgiving", "trust", "meditation"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations12.html#doctrine19",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-prayer-for-the-faithful-departed",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/meditations/meditations6.html#departed",
      "https://archive.org/details/a600404300newmuoft",
    ],
    payload: {
      slug: "newman-prayer-for-the-faithful-departed",
      title: "Prayer for the Faithful Departed (Saint John Henry Newman)",
      body: "O God of the Spirits of all flesh, O Jesu, Lover of souls, we recommend unto Thee the souls of all those Thy servants, who have departed with the sign of faith and sleep the sleep of peace. We beseech Thee, O Lord and Saviour, that, as in Thy mercy to them Thou becamest man, so now Thou wouldest hasten the time, and admit them to Thy presence above. Remember, O Lord, that they are Thy creatures, not made by strange gods, but by Thee, the only Living and True God; for there is no other God but Thou, and none that can equal Thy works. Let their souls rejoice in Thy light, and impute not to them their former iniquities, which they committed through the violence of passion, or the corrupt habits of their fallen nature. For, although they have sinned, yet they always firmly believed in the Father, Son, and Holy Ghost; and before they died, they reconciled themselves to Thee by true contrition and the Sacraments of Thy Church.\n\nO Gracious Lord, we beseech Thee, remember not against them the sins of their youth and their ignorances; but according to Thy great mercy, be mindful of them in Thy heavenly glory. May the heavens be opened to them, and the Angels rejoice with them. May the Archangel St. Michael conduct them to Thee. May Thy holy Angels come forth to meet them, and carry them to the city of the heavenly Jerusalem. May St. Peter, to whom Thou gavest the keys of the kingdom of heaven, receive them. May St. Paul, the vessel of election, stand by them. May St. John, the beloved disciple, who had the revelation of the secrets of heaven, intercede for them. May all the Holy Apostles, who received from Thee the power of binding and loosing, pray for them. May all the Saints and elect of God, who in this world suffered torments for Thy Name, befriend them; that, being freed from the prison beneath, they may be admitted into the glories of that kingdom, where with the Father and the Holy Ghost Thou livest and reignest one God, world without end.\n\nCome to their assistance, all ye Saints of God; gain for them deliverance from their place of punishment; meet them, all ye Angels; receive these holy souls, and present them before the Lord. Eternal rest give to them, O Lord. And may perpetual light shine on them.\n\nMay they rest in peace. Amen.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "Newman's prayer for all who have died in the faith, commending them to Christ, asking that Saint Michael, the angels and the apostles lead them into the heavenly Jerusalem, and closing with the Eternal Rest. It is printed with his twelve Good Friday intercessions in Meditations and Devotions.",
      occasions: ["all-souls", "november", "funerals"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/meditations/meditations6.html#departed",
        "https://archive.org/details/a600404300newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "newman-may-he-support-us-all-the-day-long",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/subjects/sermon20.html",
      "https://archive.org/details/a600668900newmuoft",
    ],
    payload: {
      slug: "newman-may-he-support-us-all-the-day-long",
      title: "May He Support Us All the Day Long (Saint John Henry Newman)",
      body: 'But for us, let us glory in what they disown; let us beg of our Divine Lord to take to Him His great power, and manifest Himself more and more, and reign both in our hearts and in the world. Let us beg of Him to stand by us in trouble, and guide us on our dangerous way. May He, as of old, choose "the foolish things of the world to confound the wise, and the weak things of the world to confound the things which are mighty"! May He support us all the day long, till the shades lengthen, and the evening comes, and the busy world is hushed, and the fever of life is over, and our work is done! Then in His mercy may He give us a safe lodging, and a holy rest, and peace at the last!',
      prayerType: "evening",
      category: "general",
      language: "en",
      summary:
        "The closing words of Newman's Anglican sermon Wisdom and Innocence (1843), whose prayer that God will support us until the evening comes and the fever of life is over, and give a safe lodging and peace at the last, became one of his best-loved evening prayers.",
      occasions: ["evening", "night-prayer", "funerals", "daily"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/subjects/sermon20.html",
        "https://archive.org/details/a600668900newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "lead-kindly-light",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/verses/verse90.html",
      "https://archive.org/details/a676839800newmuoft",
    ],
    payload: {
      slug: "lead-kindly-light",
      title: "Lead, Kindly Light (The Pillar of the Cloud)",
      body: "Lead, Kindly Light, amid the encircling gloom\nLead Thou me on!\nThe night is dark, and I am far from home—\nLead Thou me on!\nKeep Thou my feet; I do not ask to see\nThe distant scene—one step enough for me.\n\nI was not ever thus, nor pray'd that Thou\nShouldst lead me on.\nI loved to choose and see my path, but now\nLead Thou me on!\nI loved the garish day, and, spite of fears,\nPride ruled my will: remember not past years.\n\nSo long Thy power hath blest me, sure it still\nWill lead me on,\nO'er moor and fen, o'er crag and torrent, till\nThe night is gone;\nAnd with the morn those angel faces smile\nWhich I have loved long since, and lost awhile.",
      prayerType: "hymn",
      category: "general",
      language: "en",
      summary:
        "Newman's poem The Pillar of the Cloud, written at sea on 16 June 1833 as he sailed home from Sicily after a grave illness; asking only for light enough for the next step, it became one of the best-known English hymns. From Verses on Various Occasions (1868).",
      occasions: ["trust", "discernment", "evening", "conversion"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/verses/verse90.html",
        "https://archive.org/details/a676839800newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "firmly-i-believe-and-truly",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/verses/gerontius.html",
      "https://archive.org/details/a676839800newmuoft",
    ],
    payload: {
      slug: "firmly-i-believe-and-truly",
      title: "Firmly I Believe and Truly (The Dream of Gerontius)",
      body: "Sanctus fortis, Sanctus Deus,\nDe profundis oro te,\nMiserere, Judex meus,\nParce mihi, Domine.\nFirmly I believe and truly\nGod is three, and God is One;\nAnd I next acknowledge duly\nManhood taken by the Son.\nAnd I trust and hope most fully\nIn that Manhood crucified;\nAnd each thought and deed unruly\nDo to death, as He has died.\nSimply to His grace and wholly\nLight and life and strength belong,\nAnd I love, supremely, solely,\nHim the holy, Him the strong.\nSanctus fortis, Sanctus Deus,\nDe profundis oro te,\nMiserere, Judex meus,\nParce mihi, Domine.\nAnd I hold in veneration,\nFor the love of Him alone,\nHoly Church, as His creation,\nAnd her teachings, as His own.\nAnd I take with joy whatever\nNow besets me, pain or fear,\nAnd with a strong will I sever\nAll the ties which bind me here.\nAdoration aye be given,\nWith and through the angelic host,\nTo the God of earth and heaven,\nFather, Son, and Holy Ghost.\nSanctus fortis, Sanctus Deus,\nDe profundis oro te,\nMiserere, Judex meus,\nMortis in discrimine.",
      prayerType: "hymn",
      category: "general",
      language: "en",
      summary:
        "The profession of faith that the dying Gerontius makes in Newman's poem The Dream of Gerontius (1865): belief in the Trinity and the Incarnation, hope in the crucified Christ, love of God and veneration of the Church, set between a Latin refrain asking the holy and strong God for mercy. Its English verses are sung as a hymn.",
      occasions: ["trinity-sunday", "deathbed", "confirmation"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/verses/gerontius.html",
        "https://archive.org/details/a676839800newmuoft",
      ],
    },
  },
  {
    contentType: "PRAYER",
    slug: "praise-to-the-holiest-in-the-height",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [
      "https://www.newmanreader.org/works/verses/gerontius.html",
      "https://archive.org/details/a676839800newmuoft",
    ],
    payload: {
      slug: "praise-to-the-holiest-in-the-height",
      title: "Praise to the Holiest in the Height (The Dream of Gerontius)",
      body: "Praise to the Holiest in the height\nAnd in the depth be praise:\nIn all His words most wonderful;\nMost sure in all His ways!\n\nO loving wisdom of our God!\nWhen all was sin and shame,\nA second Adam to the fight\nAnd to the rescue came.\n\nO wisest love! that flesh and blood\nWhich did in Adam fail,\nShould strive afresh against the foe,\nShould strive and should prevail;\n\nAnd that a higher gift than grace\nShould flesh and blood refine,\nGod's Presence and His very Self,\nAnd Essence all-divine.\n\nO generous love! that He who smote\nIn man for man the foe,\nThe double agony in man\nFor man should undergo;\n\nAnd in the garden secretly,\nAnd on the cross on high,\nShould teach His brethren and inspire\nTo suffer and to die.",
      prayerType: "hymn",
      category: "general",
      language: "en",
      summary:
        "The song of the Fifth Choir of Angelicals in Newman's The Dream of Gerontius (1865), praising the wisdom and love of God who sent Christ as a second Adam to fight and conquer where the first Adam fell. It is sung as a hymn in Catholic and Anglican churches alike.",
      occasions: ["holy-week", "good-friday", "praise"],
      relatedSaints: ["saint-john-henry-newman"],
      citations: [
        "https://www.newmanreader.org/works/verses/gerontius.html",
        "https://archive.org/details/a676839800newmuoft",
      ],
    },
  },
];
