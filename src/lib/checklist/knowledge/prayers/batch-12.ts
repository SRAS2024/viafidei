import type { CuratedEntry } from "../index";

/**
 * Batch 12 of the curated prayer catalogue: prayers of the saints and of the
 * classic Catholic prayer books, all in public-domain English printed before
 * 1929.
 *
 * Every body is copied character for character from the first cited page and
 * checked against the printed book. Two kinds of first page are used:
 *   - a web transcription of the old book (the Newman Reader), collated word by
 *     word with an archive.org scan of the printed edition, which is cited
 *     second;
 *   - the archive.org scan itself, cited at the leaf where the prayer begins,
 *     transcribed from the page images and checked word by word against the
 *     OCR of a second, independent scan of the same edition. For the Manual of
 *     Prayers the text is the majority reading of six OCRs of the same plates
 *     (the 1888, 1889, 1896 and 1898 issues), every doubtful reading settled
 *     from the page image ("willest", which every OCR reads as "wiliest").
 * Nothing is paraphrased, shortened, modernised, composed or merged across
 * versions. The only changes are typographical, or restore the printed text,
 * and none alters the wording:
 *   - opening words set in small capitals ("O MY God", "GREAT art Thou") are
 *     given in ordinary case, and the period's space before ! ? ; : is closed;
 *   - page numbers, running heads, footnote and marginal references, and the
 *     bracketed chapter and section numbers of the 1838 Confessions are dropped;
 *   - plain printer's slips are corrected: "tabernacle.!" (Saint Francis's
 *     Salutation of the Blessed Virgin) and "but in, Thee" (his Praises);
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
 * given and its summary says where it stands. Saint Francis's prayers are
 * Paschal Robinson's translation, The Writings of Saint Francis of Assisi
 * (Philadelphia: Dolphin Press, 1906); Saint Augustine's are from E. B.
 * Pusey's Confessions in its first edition (Library of the Fathers, Oxford,
 * 1838), not from later reprints, whose wording differs in places.
 *
 * The occasional prayers come from A Manual of Prayers for the Use of the
 * Catholic Laity (New York, 1889), the prayer book prepared by order of the
 * Third Plenary Council of Baltimore. Most are the Roman Missal's collects for
 * particular needs in the Manual's English; its red initials and small
 * capitals ("O GOD", "GRANT") are given in ordinary case, and its rubrics
 * ("N." for a name, "this famine (or pestilence)") are kept as printed. The
 * Manual's old prayers for heretics, Jews and pagans were deliberately left
 * out.
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
  {
    contentType: "PRAYER",
    slug: "praises-of-saint-francis-at-all-the-hours",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n182/mode/1up"],
    payload: {
      slug: "praises-of-saint-francis-at-all-the-hours",
      title:
        "The Praises at All the Hours, with the Paraphrase of the Our Father (Saint Francis of Assisi)",
      body: "Our Father, most holy, our Creator, Redeemer, and Comforter.\n\nWho art in heaven, in the angels and in the saints illuminating them unto knowledge, for Thou, O Lord, art light; inflaming them unto love, for Thou, O Lord, art Love; dwelling in them and filling them with blessedness, for Thou, O Lord, art the highest Good, the eternal Good from whom is all good and without whom is no good.\n\nHallowed be Thy Name: may Thy knowledge shine in us that we may know the breadth of Thy benefits, the length of Thy promises, the height of Thy majesty, and the depth of Thy judgments.\n\nThy Kingdom come, that Thou mayest reign in us by grace and mayest make us come to Thy Kingdom, where there is the clear vision of Thee, the perfect love of Thee, the blessed company of Thee, the eternal enjoyment of Thee.\n\nThy will be done on earth as it is in heaven, that we may love Thee with the whole heart by always thinking of Thee; with the whole soul by always desiring Thee; with the whole mind by directing all our intentions to Thee and seeking Thy honor in all things and with all our strength, by spending all the powers and senses of body and soul in the service of Thy love and not in anything else; and that we may love our neighbors even as ourselves, drawing to the best of our power all to Thy love; rejoicing in the good of others as in our own and compassionating [them] in troubles and giving offence to no one.\n\nGive us this day, through memory and understanding and reverence for the love which He had for us and for those things which He said, did, and suffered, for us,—our daily bread, Thy Beloved Son, our Lord Jesus Christ.\n\nAnd forgive us our trespasses, by Thy ineffable mercy in virtue of the Passion of Thy Beloved Son, our Lord Jesus Christ, and through the merits and intercession of the most Blessed Virgin Mary and of all Thy elect.\n\nAs we forgive them that trespass against us, and what we do not fully forgive, do Thou, O Lord, make us fully forgive, that for Thy sake we may truly love our enemies and devoutly intercede for them with Thee; that we may render no evil for evil, but in Thee may strive to do good to all.\n\nAnd lead us not into temptation, hidden or visible, sudden or continuous.\n\nBut deliver us from evil, past, present, and to come. Amen.\n\nGlory be to the Father, etc.\n\nHoly, Holy, Holy, Lord God Almighty, who is and who was and who is to come. Let us praise and exalt Him above all forever.\n\nWorthy art Thou, O Lord, our God, to receive praise, glory and honor and benediction. Let us praise and exalt Him above all forever.\n\nThe Lamb that was slain is worthy to receive power and divinity and wisdom and strength and honor and benediction. Let us praise and exalt Him above all forever.\n\nLet us bless the Father and the Son with the Holy Ghost. Let us praise and exalt Him above all forever.\n\nAll ye works of the Lord, bless ye the Lord. Let us praise and exalt Him above all forever.\n\nGive praise to God all ye His servants and you that fear Him, little and great. Let us praise and exalt Him above all forever.\n\nLet the heavens and the earth praise Him, the Glorious, and every creature which is in heaven and on earth and under the earth, in the seas and all that are in them. Let us praise and exalt Him above all forever.\n\nGlory be to the Father, and to the Son, and to the Holy Ghost. Let us praise and exalt Him above all forever.\n\nAs it was in the beginning, is now and ever shall be world without end. Amen. Let us praise and exalt Him above all forever.\n\nPrayer.\n\nAlmighty, most holy, most high, and supreme God, highest good, all good, wholly good, who alone art good. To Thee we render all praise, all glory, all thanks, all honor, all blessing, and we shall always refer all good to Thee. Amen.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        'The Praises that Saint Francis composed and said at every Hour of the Divine Office and before the Office of the Blessed Virgin: his phrase-by-phrase meditation on the Our Father, the Glory Be, then scriptural acclamations from the Apocalypse and the Canticle of Daniel, each answered by "Let us praise and exalt Him above all forever", and a closing prayer to God who alone is good. Paschal Robinson\'s 1906 translation; "them" in square brackets is the translator\'s own insertion.',
      occasions: ["lauds", "daily", "october-4"],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: ["https://archive.org/details/cu31924029364787/page/n182/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "salutation-of-the-blessed-virgin-saint-francis",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n186/mode/1up"],
    payload: {
      slug: "salutation-of-the-blessed-virgin-saint-francis",
      title: "Salutation of the Blessed Virgin Mary (Saint Francis of Assisi)",
      body: "Hail, holy Lady, most holy Queen, Mother of God, Mary who art ever Virgin, chosen from Heaven by the most Holy Father, whom He has consecrated with the most holy beloved Son and the Ghostly Paraclete, in whom was and is all the fulness of grace and all good. Hail thou His palace! Hail thou His tabernacle! Hail thou His house. Hail thou His garment! Hail thou His handmaid! Hail thou His Mother and all ye holy virtues which by the grace and illumination of the Holy Ghost thou infusest in the heart of the faithful, that from infidels ye mayest make them faithful to God.",
      prayerType: "marian",
      category: "marian",
      language: "en",
      summary:
        "Saint Francis's greeting of the Blessed Virgin as the palace, tabernacle, house, garment, handmaid and Mother of God, chosen by the Father and consecrated with the Son and the Holy Spirit, together with the holy virtues the Spirit pours into the faithful. Paschal Robinson's 1906 translation from the Quaracchi critical text.",
      occasions: ["marian-feasts", "october-4", "daily"],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: ["https://archive.org/details/cu31924029364787/page/n186/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "absorbeat-prayer-of-saint-francis",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n188/mode/1up"],
    payload: {
      slug: "absorbeat-prayer-of-saint-francis",
      title: "Prayer to Obtain Divine Love (Absorbeat) (Saint Francis of Assisi)",
      body: "I beseech Thee, O Lord, that the fiery and sweet strength of Thy love may absorb my soul from all things that are under heaven, that I may die for love of Thy love as Thou didst deign to die for love of my love.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "A short prayer known from its Latin opening as the Absorbeat, asking that the fire of God's love may draw the soul away from everything under heaven. Its attribution to Saint Francis rests on Ubertino da Casale, who gives it in his Arbor Vitae Crucifixae (1305), and on Saint Bernardine of Siena. Paschal Robinson's 1906 translation.",
      occasions: ["daily", "act-of-love", "october-4"],
      relatedSaints: ["saint-francis-of-assisi", "saint-bernardine-of-siena"],
      citations: ["https://archive.org/details/cu31924029364787/page/n188/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "praises-of-god-saint-francis",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n191/mode/1up"],
    payload: {
      slug: "praises-of-god-saint-francis",
      title: "The Praises of God (Saint Francis of Assisi)",
      body: "Thou art holy, Lord God, who alone workest wonders. Thou art strong. Thou art great. Thou art most high. Thou art the Almighty King, Thou, holy Father, King of heaven and earth. Thou art the Lord God Triune and One; all good. Thou art good, all good, highest good, Lord God living and true. Thou art charity, love. Thou art wisdom. Thou art humility. Thou art patience. Thou art security. Thou art quietude. Thou art joy and gladness. Thou art justice and temperance. Thou art all riches to sufficiency. Thou art beauty. Thou art meekness. Thou art protector. Thou art guardian and defender. Thou art strength. Thou art refreshment. Thou art our hope. Thou art our faith. Thou art our great sweetness. Thou art our eternal life, great and admirable Lord, God Almighty, merciful Saviour.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "The litany of praise that Saint Francis wrote with his own hand on La Verna in September 1224, after receiving the stigmata, on the sheet he gave to Brother Leo; the autograph is kept at the Sacro Convento in Assisi. Paschal Robinson's 1906 translation of the Quaracchi text.",
      occasions: ["praise", "thanksgiving", "september-17", "october-4"],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: ["https://archive.org/details/cu31924029364787/page/n191/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "blessing-of-brother-leo",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n194/mode/1up"],
    payload: {
      slug: "blessing-of-brother-leo",
      title: "The Blessing of Brother Leo (Saint Francis of Assisi)",
      body: "May the Lord bless thee and keep thee. May He shew His face to thee and have mercy on thee. May He turn His countenance to thee and give thee peace. Brother Leo may the Lord bless thee.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "The blessing of Numbers 6:24-26 that Saint Francis wrote out for Brother Leo on the back of the sheet bearing the Praises of God (La Verna, 1224), adding a personal blessing in his own hand. In the autograph the tau that Francis used as his signature is drawn through Leo's name, and the 1906 printing sets a T within the name; it is given here as the plain name.",
      occasions: ["blessing", "september-17", "october-4"],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: ["https://archive.org/details/cu31924029364787/page/n194/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "canticle-of-the-sun",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n197/mode/1up"],
    payload: {
      slug: "canticle-of-the-sun",
      title: "The Canticle of the Sun (Canticle of the Creatures) (Saint Francis of Assisi)",
      body: "Most high, omnipotent, good Lord,\nPraise, glory and honor and benediction all, are Thine.\nTo Thee alone do they belong, most High,\nAnd there is no man fit to mention Thee.\n\nPraise be to Thee, my Lord, with all Thy creatures,\nEspecially to my worshipful brother sun,\nThe which lights up the day, and through him dost Thou brightness give;\nAnd beautiful is he and radiant with splendor great;\nOf Thee, most High, signification gives.\n\nPraised be my Lord, for sister moon and for the stars,\nIn heaven Thou hast formed them clear and precious and fair.\n\nPraised be my Lord for brother wind\nAnd for the air and clouds and fair and every kind of weather,\nBy the which Thou givest to Thy creatures nourishment.\nPraised be my Lord for sister water,\nThe which is greatly helpful and humble and precious and pure.\n\nPraised be my Lord for brother fire,\nBy the which Thou lightest up the dark.\nAnd fair is he and gay and mighty and strong.\n\nPraised be my Lord for our sister, mother earth,\nThe which sustains and keeps us\nAnd brings forth diverse fruits with grass and flowers bright.\n\nPraised be my Lord for those who for Thy love forgive\nAnd weakness bear and tribulation.\nBlessed those who shall in peace endure,\nFor by Thee, most High, shall they be crowned.\n\nPraised be my Lord for our sister, the bodily death,\nFrom the which no living man can flee.\nWoe to them who die in mortal sin;\nBlessed those who shall find themselves in Thy most holy will,\nFor the second death shall do them no ill.\n\nPraise ye and bless ye my Lord, and give Him thanks,\nAnd be subject unto Him with great humility.",
      prayerType: "canticle",
      category: "saintly",
      language: "en",
      summary:
        "Saint Francis's Italian song of praise for God through brother sun, sister moon, wind, water, fire and mother earth, made while he lay ill at San Damiano; the tradition recorded in the Speculum Perfectionis holds that he added the strophe on pardon and peace to reconcile the bishop and magistrates of Assisi, and the strophe on sister bodily death as his own death approached. This is Paschal Robinson's deliberately literal 1906 rendering of the Assisi manuscript, keeping the rhythm of the original rather than rhyming it.",
      occasions: ["creation", "praise", "october-4", "deathbed"],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: ["https://archive.org/details/cu31924029364787/page/n197/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "salutation-of-the-virtues",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n61/mode/1up"],
    payload: {
      slug: "salutation-of-the-virtues",
      title: "Salutation of the Virtues (Saint Francis of Assisi)",
      body: "Hail, queen wisdom! May the Lord save thee with thy sister holy pure simplicity! O Lady, holy poverty, may the Lord save thee with thy sister holy humility! O Lady, holy charity, may the Lord save thee with thy sister holy obedience! O all ye most holy virtues, may the Lord, from whom you proceed and come, save you! There is absolutely no man in the whole world who can possess one among you unless he first die. He who possesses one and does not offend the others, possesses all; and he who offends one, possesses none and offends all; and every one [of them] confounds vices and sins. Holy wisdom confounds Satan and all his wickednesses. Pure holy simplicity confounds all the wisdom of this world and the wisdom of the flesh. Holy poverty confounds cupidity and avarice and the cares of this world. Holy humility confounds pride and all the men of this world and all things that are in the world. Holy charity confounds all diabolical and fleshly temptations and all fleshly fears. Holy obedience confounds all bodily and fleshly desires and keeps the body mortified to the obedience of the spirit and to the obedience of one's brother and makes a man subject to all the men of this world and not to men alone, but also to all beasts and wild animals, so that they may do with him whatsoever they will, in so far as it may be granted to them from above by the Lord.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "Saint Francis's greeting of the virtues as ladies paired in sisterhood (wisdom with simplicity, poverty with humility, charity with obedience) and his teaching on how each confounds its opposing vice. Thomas of Celano quotes its opening in his Second Life (about 1247). Paschal Robinson's 1906 translation; \"of them\" in square brackets is the translator's insertion.",
      occasions: ["october-4", "daily"],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: ["https://archive.org/details/cu31924029364787/page/n61/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "we-adore-thee-lord-jesus-christ-saint-francis",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/cu31924029364787/page/n123/mode/1up"],
    payload: {
      slug: "we-adore-thee-lord-jesus-christ-saint-francis",
      title: "We Adore Thee, Lord Jesus Christ (Prayer of Saint Francis from the Testament)",
      body: "We adore Thee Lord Jesus Christ here and in all Thy churches which are in the whole world, and we bless Thee because by Thy holy cross Thou hast redeemed the world.",
      prayerType: "general",
      category: "devotional",
      language: "en",
      summary:
        "The prayer that Saint Francis says in his Testament (1226) the Lord gave him such faith in churches that he would simply say on entering them. Paschal Robinson's 1906 translation; it is distinct from, though echoed by, the versicle said at each Station of the Cross.",
      occasions: [
        "adoration",
        "visit-to-the-blessed-sacrament",
        "stations-of-the-cross",
        "october-4",
      ],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: ["https://archive.org/details/cu31924029364787/page/n123/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-great-art-thou-o-lord",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n50/mode/1up"],
    payload: {
      slug: "augustine-great-art-thou-o-lord",
      title: "Great Art Thou, O Lord (Saint Augustine, Confessions I.1)",
      body: "Great art Thou, O Lord, and greatly to be praised; great is Thy power, and Thy wisdom infinite. And Thee would man praise; man, but a particle of Thy creation; man, that bears about him his mortality, the witness of his sin, the witness, that Thou resistest the proud: yet would man praise Thee; he, but a particle of Thy creation. Thou awakest us to delight in Thy praise; for Thou madest us for Thyself, and our heart is restless, until it repose in Thee. Grant me, Lord, to know and understand which is first, to call on Thee or to praise Thee? and, again, to know Thee or to call on Thee? For who can call on Thee, not knowing Thee? For he that knoweth Thee not, may call on Thee as other than Thou art. Or, is it rather, that we call on Thee that we may know Thee? But how shall they call on Him in whom they have not believed? or how shall they believe without a preacher? And they that seek the Lord shall praise Him. For they that seek shall find Him, and they that find shall praise Him. I will seek Thee, Lord, by calling on Thee; and will call on Thee, believing in Thee; for to us hast Thou been preached. My faith, Lord, shall call on Thee, which Thou hast given me, wherewith Thou hast inspired me, through the Incarnation of Thy Son, through the ministry of the Preacher.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "The opening chapter of Saint Augustine's Confessions, a prayer of praise that contains his best-known line: God made us for himself, and our heart is restless until it rests in him. The Preacher of the last line is Saint Ambrose, through whom Augustine came to the faith. E. B. Pusey's translation (1838).",
      occasions: ["daily", "august-28", "praise"],
      relatedSaints: ["saint-augustine-of-hippo", "saint-ambrose"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n50/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-what-art-thou-then-my-god",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n52/mode/1up"],
    payload: {
      slug: "augustine-what-art-thou-then-my-god",
      title: "What Art Thou Then, My God? (Saint Augustine, Confessions I.4)",
      body: "What art Thou then, my God? What, but the Lord God? For who is Lord but the Lord? or who is God save our God? Most highest, most good, most potent, most omnipotent; most merciful, yet most just; most hidden, yet most present; most beautiful, yet most strong; stable, yet incomprehensible; unchangeable, yet all-changing; never new, never old; all-renewing, and bringing age upon the proud, and they know it not; ever working, ever at rest; still gathering, yet nothing lacking; supporting, filling, and overspreading; creating, nourishing, and maturing; seeking, yet having all things. Thou lovest, without passion; art jealous, without anxiety; repentest, yet grievest not; art angry, yet serene; changest Thy works, Thy purpose unchanged; receivest again what Thou findest, yet didst never lose; never in need, yet rejoicing in gains; never covetous, yet exacting usury. Thou receivest over and above, that Thou mayest owe; and who hath aught that is not Thine? Thou payest debts, owing nothing; remittest debts, losing nothing. And what have I now said, my God, my life, my holy joy? or what saith any man when he speaks of Thee? Yet woe to him that speaketh not, since mute are even the most eloquent.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "Saint Augustine's hymn to the attributes of God from the fourth chapter of the Confessions, praising him in paradoxes as most hidden yet most present, never new and never old, ever working and ever at rest. E. B. Pusey's translation (1838).",
      occasions: ["praise", "meditation", "august-28"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n52/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-oh-that-i-might-repose-on-thee",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n52/mode/1up"],
    payload: {
      slug: "augustine-oh-that-i-might-repose-on-thee",
      title: "Oh! That I Might Repose on Thee (Saint Augustine, Confessions I.5)",
      body: "Oh! that I might repose on Thee! Oh! that Thou wouldest enter into my heart, and inebriate it, that I may forget my ills, and embrace Thee, my sole good? What art Thou to me? In Thy pity, teach me to utter it. Or what am I to Thee that Thou demandest my love, and, if I give it not, art wroth with me, and threatenest me with grievous woes? Is it then a slight woe to love Thee not? Oh! for Thy mercies' sake, tell me, O Lord my God, what Thou art unto me. Say unto my soul, I am thy salvation. So speak, that I may hear. Behold, Lord, my heart is before Thee; open Thou the ears thereof, and say unto my soul, I am thy salvation. After this voice let me haste, and take hold on Thee. Hide not Thy face from me. Let me die—lest I die—only let me see Thy face.\n\nNarrow is the mansion of my soul; enlarge Thou it, that Thou mayest enter in. It is ruinous; repair Thou it. It has that within which must offend Thine eyes; I confess and know it. But who shall cleanse it? or to whom should I cry, save Thee? Lord, cleanse me from my secret faults, and spare Thy servant from the power of the enemy. I believe, and therefore do I speak. Lord, Thou knowest. Have I not confessed against myself my transgressions unto Thee, and Thou, my God, hast forgiven the iniquity of my heart? I contend not in judgment with Thee, who art the truth; I fear to deceive myself; lest mine iniquity lie unto itself. Therefore I contend not in judgment with Thee; for if Thou, Lord, shouldest mark iniquities, O Lord, who shall abide it?",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        'Saint Augustine\'s plea from the fifth chapter of the Confessions that God would enter his heart and say to his soul, "I am thy salvation", enlarging the narrow mansion of the soul and cleansing it of its secret faults. A note in the 1838 edition explains the words "Let me die—lest I die": let me see the face of God though I die (Exodus 33:20), since not to see it is the second death. E. B. Pusey\'s translation (1838).',
      occasions: ["daily", "confession", "august-28"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n52/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-o-lord-i-am-thy-servant",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n204/mode/1up"],
    payload: {
      slug: "augustine-o-lord-i-am-thy-servant",
      title: "O Lord, I Am Thy Servant (Saint Augustine, Confessions IX.1)",
      body: "O Lord, I am Thy servant; I am Thy servant, and the son of Thy handmaid: Thou hast broken my bonds in sunder. I will offer to Thee the sacrifice of praise. Let my heart and my tongue praise Thee; yea let all my bones say, O Lord, who is like unto Thee? Let them say, and answer Thou me, and say unto my soul, I am thy salvation. Who am I, and what am I? What evil have not been either my deeds, or if not my deeds, my words, or if not my words, my will? But Thou, O Lord, art good and merciful, and Thy right hand had respect unto the depth of my death, and from the bottom of my heart emptied that abyss of corruption. And this Thy whole gift was, to nill what I willed, and to will what Thou willedst. But where through all those years, and out of what low and deep recess was my free-will called forth in a moment, whereby to submit my neck to Thy easy yoke, and my shoulders unto Thy light burthen, O Christ Jesus, my Helper and my Redeemer? How sweet did it at once become to me, to want the sweetnesses of those toys! and what I feared to be parted from, was now a joy to part with. For Thou didst cast them forth from me, Thou true and highest sweetness. Thou castest them forth, and for them enteredst in Thyself, sweeter than all pleasure, though not to flesh and blood; brighter than all light, but more hidden than all depths, higher than all honour, but not to the high in their own conceits. Now was my soul free from the biting cares of canvassing and getting, and weltering in filth, and scratching off the itch of lust. And my infant tongue spake freely to Thee, my brightness, and my riches, and my health, the Lord my God.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "Saint Augustine's thanksgiving, at the opening of Book IX of the Confessions, for the grace of his conversion, when God broke his bonds and made sweet the easy yoke of Christ he had feared to take up. E. B. Pusey's translation (1838).",
      occasions: ["thanksgiving", "conversion", "august-28"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n204/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-prayer-for-his-mother-monica",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n229/mode/1up"],
    payload: {
      slug: "augustine-prayer-for-his-mother-monica",
      title: "Prayer for His Mother Monica (Saint Augustine, Confessions IX.13)",
      body: "I therefore, O my Praise and my Life, God of my heart, laying aside for a while her good deeds, for which I give thanks to Thee with joy, do now beseech Thee for the sins of my mother. Hearken unto me, I entreat Thee, by the Medicine of our wounds, Who hung upon the tree, and now sitting at Thy right hand maketh intercession to Thee for us. I know that she dealt mercifully, and from her heart forgave her debtors their debts; do Thou also forgive her debts, whatever she may have contracted in so many years, since the water of salvation. Forgive her, Lord, forgive, I beseech Thee; enter not into judgment with her. Let Thy mercy be exalted above Thy justice, since Thy words are true, and Thou hast promised mercy unto the merciful; which Thou gavest them to be, who wilt have mercy on whom thou wilt have mercy; and wilt have compassion, on whom Thou hast had compassion.\n\nAnd, I believe, Thou hast already done what I ask; but accept, O Lord, the free-will offerings of my mouth. For she, the day of her dissolution now at hand, took no thought to have her body sumptuously wound up, or embalmed with spices; nor desired she a choice monument, or to be buried in her own land. These things she enjoined us not; but desired only to have her name commemorated at Thy Altar, which she had served without intermission of one day: whence she knew that holy sacrifice to be dispensed, by which the hand-writing that was against us, is blotted out; through which the enemy was triumphed over, who summing up our offences, and seeking what to lay to our charge, found nothing in Him, in Whom we conquer. Who shall restore to Him the innocent blood? Who repay Him the price wherewith He bought us, and so take us from Him? Unto the Sacrament of which our ransom, Thy handmaid bound her soul by the bond of faith. Let none sever her from Thy protection: let neither the lion nor the dragon interpose himself by force or fraud. For she will not answer that she owes nothing, lest she be convicted and seized by the crafty accuser: but she will answer, that her sins are forgiven her by Him, to Whom none can repay that price, which He, Who owed nothing, paid for us.\n\nMay she rest then in peace with the husband, before and after whom she had never any; whom she obeyed, with patience bringing forth fruit unto Thee, that she might win him also unto Thee. And inspire, O Lord my God, inspire Thy servants my brethren, Thy sons my masters, whom with voice, and heart, and pen I serve, that so many as shall read these Confessions, may at Thy Altar remember Monnica Thy handmaid, with Patricius, her sometimes husband, by whose bodies Thou broughtest me into this life, how, I know not. May they with devout affection remember my parents in this transitory light, my brethren under Thee our Father in our Catholic Mother, and my fellow citizens in that eternal Jerusalem, which Thy pilgrim people sigheth after from their Exodus, even unto their return thither. That so, my mother's last request of me, may through my confessions, more than through my prayers, be, through the prayers of many, more abundantly fulfilled to her.",
      prayerType: "intercession",
      category: "saintly",
      language: "en",
      summary:
        "The prayer with which Saint Augustine closes Book IX of the Confessions: he begs forgiveness for the sins of his mother, Saint Monica, who asked only to be remembered at the altar, and asks all who read the book to remember her and his father Patricius at Mass. E. B. Pusey's translation (1838), which spells her name Monnica.",
      occasions: ["all-souls", "funerals", "august-27", "mothers"],
      relatedSaints: ["saint-augustine-of-hippo", "saint-monica"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n229/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-let-me-know-thee-o-lord",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n231/mode/1up"],
    payload: {
      slug: "augustine-let-me-know-thee-o-lord",
      title: "Let Me Know Thee, O Lord (Saint Augustine, Confessions X.1)",
      body: "Let me know Thee, O Lord, who knowest me: let me know Thee, as I am known. Power of my soul, enter into it, and fit it for Thee, that Thou mayest have and hold it without spot or wrinkle. This is my hope, therefore do I speak; and in this hope do I rejoice, when I rejoice healthfully. Other things of this life are the less to be sorrowed for, the more they are sorrowed for; and the more to be sorrowed for, the less men sorrow for them. For behold, Thou lovest the truth, and he that doth it, cometh to the light. This would I do in my heart before Thee in confession: and in my writing, before many witnesses.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "The prayer that opens Book X of the Confessions, asking to know God as one is known by him (1 Corinthians 13:12) and that he, the power of the soul, would enter it and fit it for himself. E. B. Pusey's translation (1838).",
      occasions: ["daily", "meditation", "august-28"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n231/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-give-what-thou-enjoinest",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n253/mode/1up"],
    payload: {
      slug: "augustine-give-what-thou-enjoinest",
      title: "Give What Thou Enjoinest (Saint Augustine, Confessions X.29)",
      body: "And all my hope is no where but in Thy exceeding great mercy. Give what Thou enjoinest, and enjoin what Thou wilt. Thou enjoinest us continency; and when I knew, saith one, that no man can be continent, unless God give it, this also was a part of wisdom to know whose gift she is. By continency verily, are we bound up and brought back into One, whence we were dissipated into many. For too little doth he love Thee, who loves any thing with Thee, which he loveth not for Thee. O love, who ever burnest and never consumest! O charity, my God! kindle me. Thou enjoinest continency: give me what Thou enjoinest, and enjoin what Thou wilt.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "Saint Augustine's short prayer of entire dependence on grace from Book X of the Confessions: \"Give what Thou enjoinest, and enjoin what Thou wilt\", with the cry to the love that ever burns and is never consumed to kindle him. A note in the 1838 edition recalls Augustine's own report that Pelagius could not bear to hear these words. E. B. Pusey's translation (1838).",
      occasions: ["temptation", "chastity", "august-28"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n253/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "augustine-o-lord-god-give-peace-unto-us",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/confessionsofsau01augu/page/n361/mode/1up"],
    payload: {
      slug: "augustine-o-lord-god-give-peace-unto-us",
      title: "O Lord God, Give Peace unto Us (Saint Augustine, Confessions XIII.35-38)",
      body: "O Lord God, give peace unto us: (for Thou hast given us all things;) the peace of rest, the peace of the Sabbath, which hath no evening. For all this most goodly array of things very good, having finished their courses, is to pass away, for in them there was morning and evening.\n\nBut the seventh day hath no evening, nor hath it setting; because Thou hast sanctified it to an everlasting continuance; that that which Thou didst after Thy works which were very good, resting the seventh day, although Thou madest them in unbroken rest, that may the voice of Thy Book announce beforehand unto us, that we also after our works, (therefore very good, because Thou hast given them us,) shall rest in Thee also in the Sabbath of eternal life.\n\nFor then shalt Thou so rest in us, as now Thou workest in us; and so shall that be Thy rest through us, as these are Thy works through us. But Thou, Lord, ever workest, and art ever at rest. Nor dost Thou see in time, nor art moved in time, nor restest in a time; and yet Thou makest things seen in time, yea the times themselves, and the rest which results from time.\n\nWe therefore see these things which Thou madest, because they are: but they are, because Thou seest them. And we see without, that they are, and within, that they are good, but Thou sawest them there, when made, where Thou sawest them, yet to be made. And we were at a later time moved to do well, after our hearts had conceived of Thy Spirit; but in the former time we were moved to do evil, forsaking Thee; but Thou, the One, the Good God, didst never cease doing good. And we also have some good works, of Thy gift, but not eternal; after them we trust to rest in Thy great hallowing. But Thou, being the Good which needeth no good, art ever at rest, because Thy rest is Thou Thyself. And what man can teach man to understand this? or what Angel, an Angel? or what Angel, a man? Let it be asked of Thee, sought in Thee, knocked for at Thee; so, so shall it be received, so shall it be found, so shall it be opened. Amen.",
      prayerType: "general",
      category: "saintly",
      language: "en",
      summary:
        "The four closing chapters of the Confessions, praying for the peace of the eternal Sabbath that has no evening, when God, who ever works and is ever at rest, will rest in us as he now works in us. E. B. Pusey's translation (1838).",
      occasions: ["evening", "sunday", "august-28"],
      relatedSaints: ["saint-augustine-of-hippo"],
      citations: ["https://archive.org/details/confessionsofsau01augu/page/n361/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-bishops-and-the-people-committed-to-them",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n172/mode/1up"],
    payload: {
      slug: "prayer-for-bishops-and-the-people-committed-to-them",
      title: "Prayer for Bishops and the People Committed to Them",
      body: "Almighty and Everlasting God, who alone doest great wonders, send down upon Thy servants, and the congregations committed unto them, the spirit of Thy saving grace; and that they may truly please Thee, pour forth upon them the continual dew of Thy blessing.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking the spirit of saving grace and the continual dew of God's blessing for bishops and the flocks entrusted to them.",
      occasions: ["for-the-church", "ordination"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n172/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-bishop-of-the-diocese",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n172/mode/1up"],
    payload: {
      slug: "prayer-for-the-bishop-of-the-diocese",
      title: "Prayer for the Bishop of the Diocese",
      body: "Grant, we beseech Thee, O Lord, to Thy servant our Bishop, that, by preaching and doing such things as are right, he may by the example of good works edify the minds of those under his authority, and receive of Thee, most tender Shepherd, an everlasting recompense and reward.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, praying that the diocesan bishop may teach by word and good example and receive his reward from Christ the Shepherd.",
      occasions: ["for-the-church"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n172/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-concord-in-a-congregation",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    payload: {
      slug: "prayer-for-concord-in-a-congregation",
      title: "Prayer for Concord in a Congregation",
      body: "O God, the Giver of peace and Lover of charity, grant to Thy servants true concord and union with Thy holy will, that we may be delivered from all temptations which assault us.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, for true concord in a parish, community or household and union with the will of God.",
      occasions: ["peace", "families", "for-the-church"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-against-the-persecutors-of-the-church",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    payload: {
      slug: "prayer-against-the-persecutors-of-the-church",
      title: "Prayer against the Persecutors of the Church",
      body: "Mercifully hear, O Lord, we beseech Thee, the prayers of Thy Church: that all adversities and errors being done away, we may serve Thee with a pure and undisturbed devotion.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking that the Church, freed from every adversity and error, may serve God in undisturbed devotion.",
      occasions: ["for-the-church", "persecuted-christians"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-in-any-tribulation",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    payload: {
      slug: "prayer-in-any-tribulation",
      title: "Prayer in Any Tribulation",
      body: "O Almighty God, despise not Thy people who cry unto Thee in their affliction; but, for the glory of Thy name, turn away Thine anger, and help us in our tribulations.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, a short cry for help in any affliction.",
      occasions: ["times-of-trouble", "suffering"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-in-time-of-famine-or-pestilence",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    payload: {
      slug: "prayer-in-time-of-famine-or-pestilence",
      title: "Prayer in Time of Famine or Pestilence",
      body: "Grant, we beseech Thee, O Lord, an answer to our hearty supplications; and, Thy wrath being appeased, turn away from us this famine (or pestilence), that the hearts of men may know that these scourges proceed from Thine anger, and cease by Thy mercy.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, said in time of famine or of epidemic disease; the words in brackets are the book's own direction to name the affliction.",
      occasions: ["times-of-trouble", "epidemic", "sickness"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n173/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-rain",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    payload: {
      slug: "prayer-for-rain",
      title: "Prayer for Rain",
      body: "O God, in whom we live, and move, and are, grant us seasonable rain; that we, enjoying a sufficiency of support in this life, may with more confidence strive after the things which are eternal.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        'One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking seasonable rain in time of drought in the words of Saint Paul at Athens, "in whom we live, and move, and are" (Acts 17:28).',
      occasions: ["drought", "creation", "rogation-days"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-fair-weather",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    payload: {
      slug: "prayer-for-fair-weather",
      title: "Prayer for Fair Weather",
      body: "Hear us, O Lord, who cry unto Thee, and grant fair weather to us, Thy suppliant servants; that we, who are justly afflicted for our sins, may by Thy preventing pity find mercy.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking fair weather in a season of storms or excessive rain.",
      occasions: ["weather", "rogation-days", "creation"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-gift-of-tears",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    payload: {
      slug: "prayer-for-the-gift-of-tears",
      title: "Prayer for the Gift of Tears",
      body: "Almighty and most Merciful God, who didst cause a fount of living water to spring out of a rock, for Thy people in their thirst: draw forth tears of compunction from our stony hearts; that we may weep over our sins, and by Thy mercy deserve to obtain pardon for the same.",
      prayerType: "general",
      category: "penitential",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking that as God drew water from the rock for Israel in the desert, he may draw tears of compunction from hearts of stone.",
      occasions: ["lent", "penance", "confession"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-forgiveness-of-sins",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    payload: {
      slug: "prayer-for-the-forgiveness-of-sins",
      title: "Prayer for the Forgiveness of Sins",
      body: "O God, who rejectest none that come unto Thee, but in loving-kindness art appeased even with the greatest sinners who repent: mercifully regard our prayers in our humiliation, and enlighten our hearts, that we may be able to fulfil Thy commandments.",
      prayerType: "general",
      category: "penitential",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, trusting in the God who rejects no repentant sinner.",
      occasions: ["confession", "penance", "lent"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n174/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-tempted-and-afflicted",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n175/mode/1up"],
    payload: {
      slug: "prayer-for-the-tempted-and-afflicted",
      title: "Prayer for the Tempted and Afflicted",
      body: "O God, who justifiest the ungodly, and willest not the death of a sinner: we humbly entreat Thy Majesty to protect Thy servants, who trust in Thy mercy, with Thy heavenly assistance, and preserve them by Thy continual protection; that they may constantly serve Thee, and by no temptation be separated from Thee.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, for all who are tempted or troubled, that no temptation may separate them from God.",
      occasions: ["temptation", "times-of-trouble"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n175/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-against-evil-thoughts",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n175/mode/1up"],
    payload: {
      slug: "prayer-against-evil-thoughts",
      title: "Prayer against Evil Thoughts",
      body: "Almighty and most Merciful God, graciously hearken unto our prayers: and free our hearts from the temptations of evil thoughts; that we may worthily become a fit habitation for Thy Holy Spirit.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking to be freed from tempting thoughts so as to become a fit dwelling for the Holy Spirit.",
      occasions: ["temptation", "purity"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n175/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-gift-of-humility",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n175/mode/1up"],
    payload: {
      slug: "prayer-for-the-gift-of-humility",
      title: "Prayer for the Gift of Humility",
      body: "O God, who resistest the proud, and givest grace to the humble: grant us the virtue of true humility, whereof Thine Only-begotten showed in Himself a pattern for Thy faithful; that we may never by our pride provoke Thine anger, but rather by our meekness receive the riches of Thy grace.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        'One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, built on James 4:6, "God resisteth the proud, and giveth grace to the humble", asking for the humility of which Christ is the pattern.',
      occasions: ["humility", "daily"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n175/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-gift-of-patience",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n176/mode/1up"],
    payload: {
      slug: "prayer-for-the-gift-of-patience",
      title: "Prayer for the Gift of Patience",
      body: "O God, who didst crush the pride of the enemy by the long-suffering of Thine Only-begotten Son: grant, we beseech Thee, that we may worthily recall those things which in His tender love He bore for us; and thus following His example may patiently endure all our adversities.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking to bear every adversity patiently after the example of Christ's long-suffering.",
      occasions: ["suffering", "daily"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n176/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-gift-of-charity",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n176/mode/1up"],
    payload: {
      slug: "prayer-for-the-gift-of-charity",
      title: "Prayer for the Gift of Charity",
      body: "O God, who makest all things to work together for good unto those who love Thee: give to our hearts the lasting affection of Thy love; that such desires as are inspired by Thee may never be changed by any temptation.",
      prayerType: "general",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, echoing Romans 8:28 and asking for a lasting love of God that no temptation can change.",
      occasions: ["act-of-love", "daily"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n176/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-those-at-sea",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n176/mode/1up"],
    payload: {
      slug: "prayer-for-those-at-sea",
      title: "Prayer for Those at Sea",
      body: "O God, who didst bring our fathers through the Red Sea, and bear them through the great waters singing praises unto Thy name: we humbly beseech Thee to vouchsafe to turn away all adversities from Thy servants at sea, and to bring them with a calm voyage unto the haven where they would be.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, for sailors and all who travel by sea, recalling the crossing of the Red Sea.",
      occasions: ["travel", "seafarers"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n176/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-our-friends",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n177/mode/1up"],
    payload: {
      slug: "prayer-for-our-friends",
      title: "Prayer for Our Friends",
      body: "O God, who, by the grace of the Holy Spirit, hast poured into the hearts of Thy faithful the gifts of charity: grant to Thy servants and handmaids, for whom we implore Thy mercy, health both of body and soul; that they may love Thee with all their strength, and cheerfully perform those things which are pleasing unto Thee.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, asking health of body and soul for friends and for all for whom we pray.",
      occasions: ["friends", "healing"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n177/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-our-enemies",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n177/mode/1up"],
    payload: {
      slug: "prayer-for-our-enemies",
      title: "Prayer for Our Enemies",
      body: "O God, the lover and preserver of peace and charity: grant unto all our enemies peace and true charity; give them remission of all their sins, and by Thy power deliver us from their snares.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, fulfilling Christ's command to pray for those who persecute us by asking peace, charity and pardon for them.",
      occasions: ["peace", "forgiveness"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n177/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "a-short-recommendation-to-god",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n178/mode/1up"],
    payload: {
      slug: "a-short-recommendation-to-god",
      title: "A Short Recommendation to God",
      body: "Into the hands of Thy unspeakable mercy, O Lord, I commend my soul and body; my senses, my words, my thoughts, and all my actions, with all the necessities of my body and soul; my going forth and my coming in; my faith and conversation; the course and end of my life; the day and hour of my death; my rest and resurrection with the Saints and Elect.",
      prayerType: "act",
      category: "general",
      language: "en",
      summary:
        "A brief act of commending body, soul and the whole course of life and death into God's mercy, printed among the occasional prayers of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore.",
      occasions: ["morning", "evening", "offering"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n178/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-a-sick-person-near-death",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n178/mode/1up"],
    payload: {
      slug: "prayer-for-a-sick-person-near-death",
      title: "Prayer for a Sick Person near Death",
      body: "Almighty and Everlasting God, preserver of souls, who dost correct those whom Thou dost love, and for their amendment dost tenderly chastise those whom Thou dost receive, we call upon Thee, O Lord, to bestow Thy healing, that the soul of Thy servant, at the hour of its departure from the body, may by the hands of Thy holy Angels be presented without spot unto Thee.",
      prayerType: "intercession",
      category: "liturgical",
      language: "en",
      summary:
        "One of the collects for particular needs in the Roman Missal (orationes diversae), in the English of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore, for a sick person close to death, that the soul may be presented spotless to God by the hands of the angels.",
      occasions: ["deathbed", "for-the-dying", "sickness"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n178/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-parents-for-their-children",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n179/mode/1up"],
    payload: {
      slug: "prayer-of-parents-for-their-children",
      title: "Prayer of Parents for Their Children",
      body: "O Father of mankind, who hast given unto me these my children, and committed them to my charge to bring them up for Thee, and to prepare them for everlasting life: assist me with Thy heavenly grace, that I may be able to fulfil this most sacred duty and stewardship. Teach me both what to give and what to withhold; when to reprove and when to forbear; make me to be gentle, yet firm; considerate and watchful; and deliver me equally from the weakness of indulgence, and the excess of severity; and grant that, both by word and example, I may be careful to lead them in the ways of wisdom and true piety, so that at last I may, with them, be admitted to the unspeakable joys of our true home in heaven, in the company of the blessed Angels and Saints.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "A parent's prayer for the grace to raise children for God, knowing what to give and what to withhold, when to reprove and when to forbear, and to be gentle yet firm. Printed among the occasional prayers of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore.",
      occasions: ["families", "children", "parents"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n179/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-of-parents-commending-their-children-to-god",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n180/mode/1up"],
    payload: {
      slug: "prayer-of-parents-commending-their-children-to-god",
      title: "Prayer of Parents Commending Their Children to God",
      body: "O Heavenly Father, I commend my children unto Thee. Be Thou their God and Father; and mercifully supply whatever is wanting in me through frailty or negligence. Strengthen them to overcome the corruptions of the world, to resist all solicitations to evil, whether from within or without; and deliver them from the secret snares of the enemy. Pour Thy grace into their hearts, and confirm and multiply in them the gifts of Thy Holy Spirit, that they may daily grow in grace and in the knowledge of our Lord Jesus Christ; and so, faithfully serving Thee here, may come to rejoice in Thy presence hereafter.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "A parent's act of entrusting children to God as their Father, asking him to supply what is lacking in the parent and to strengthen them against evil. The second of the parents' prayers in the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore.",
      occasions: ["families", "children", "parents"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n180/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "a-childs-prayer-for-parents",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n180/mode/1up"],
    payload: {
      slug: "a-childs-prayer-for-parents",
      title: "A Child's Prayer for Parents",
      body: "O Almighty God, who hast given unto me my father and mother, and made them to be an image of Thine authority, and love, and tender watchfulness; and hast commanded me to love, and honor, and obey them in all things: give me grace cheerfully and with my whole heart to keep this Thy law. Help me to love them fervently, to honor them truly, to yield a ready obedience to their commands, to comply with their wishes, to study their happiness in everything, and to bear their rebukes with patience and humility. Deliver me, O God, from pride, rebellion, and wilfulness, from passion and stubbornness, from sloth and carelessness. Make me diligent in all my duties and studies, and patient in all my trials; that so living, I may deserve to be Thy child, who art our Father in Heaven.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A child's prayer to keep the Fourth Commandment, seeing in father and mother an image of God's authority and love, printed as A Child's Prayer in the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore.",
      occasions: ["children", "families", "parents"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n180/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-choosing-a-state-of-life",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n181/mode/1up"],
    payload: {
      slug: "prayer-for-choosing-a-state-of-life",
      title: "Prayer for Choosing a State of Life",
      body: "O Lord, I beseech Thee to grant me Thy divine light, that I may know the designs of Thy providence concerning me, and that, filled with a sincere desire for my soul's salvation, I may say, with the young man in the Gospel: What must I do to be saved? All states of life are before me; but, still undecided what to do, I await Thy commands, I offer myself to Thee without restriction, without reserve, with a most perfect submission.\n\nFar be it from me, O Lord, to oppose the order of Thy wisdom, and, unfaithful to the inspiration of Thy grace, to strive to subject the will of the Creator to the caprice of the creature. It is not for the servant to choose the way in which he will serve his master: do Thou lay upon me what commands Thou pleasest. My lot is in Thy hands. I make no exception, lest perchance what I except be that which Thou willest, and because I am too short-sighted to discover in the future the different obstacles I shall meet with, if, without Thy guidance, I make myself the arbiter of my own conduct. Speak, Lord, to my soul; speak to me as Thou didst to the youthful Samuel: Speak, Lord; for Thy servant heareth. I cast myself at Thy feet, and I am ready, if it be Thy will, to sacrifice myself as a victim to Thee for the remainder of my days, in such wise as Thou shalt deem most worthy of Thy greatness.\n\nO my God, inspire the affections of my parents, and guide their projects according to the counsels of Thy wisdom. Lord, I sincerely desire to consult Thee who art the Eternal Truth; grant that my parents also may submit themselves to its decrees, faithfully and without reserve.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A young person's prayer for light to know God's will about a state of life, offering to follow his call without reserve in the words of the rich young man and of the boy Samuel (1 Samuel 3:10), and praying that parents too may accept God's plan. From the occasional prayers of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore.",
      occasions: ["vocations", "discernment"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n181/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-in-time-of-threatened-calamity",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n182/mode/1up"],
    payload: {
      slug: "prayer-in-time-of-threatened-calamity",
      title: "Prayer in Time of Threatened Calamity",
      body: "O Jesus Christ, we call upon Thee, Holy, Immortal God. Have mercy upon us and upon all men. Purify us by Thy holy Blood, forgive us by Thy holy Blood, save us by Thy holy Blood, now and for ever. Amen.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        "A short appeal to Christ as the Holy and Immortal God of the Trisagion, asking to be purified, forgiven and saved by his Precious Blood when disaster threatens. From the occasional prayers of the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore.",
      occasions: ["times-of-trouble", "precious-blood"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n182/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "prayer-for-the-church-and-the-civil-authorities",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n63/mode/1up"],
    payload: {
      slug: "prayer-for-the-church-and-the-civil-authorities",
      title: "Prayer for the Church and the Civil Authorities (Archbishop John Carroll)",
      body: "We pray Thee, O Almighty and Eternal God, who through Jesus Christ hast revealed Thy glory to all nations, to preserve the works of Thy mercy; that Thy Church, being spread through the whole world, may continue, with unchanging faith, in the confession of Thy Name.\n\nWe pray Thee, who alone art good and holy, to endow with heavenly knowledge, sincere zeal, and sanctity of life our chief Bishop, N., the Vicar of our Lord Jesus Christ in the government of His Church; our own Bishop, (or Archbishop,) N. (if he is not consecrated, our Bishop-elect); all other Bishops, Prelates, and Pastors of the Church; and especially those who are appointed to exercise among us the functions of the holy ministry, and conduct Thy people into the ways of salvation.\n\nWe pray Thee, O God of might, wisdom, and justice, through whom authority is rightly administered, laws are enacted, and judgment decreed, assist, with Thy Holy Spirit of counsel and fortitude, the President of these United States, that his administration may be conducted in righteousness, and be eminently useful to Thy people, over whom he presides, by encouraging due respect for virtue and religion; by a faithful execution of the laws in justice and mercy; and by restraining vice and immorality. Let the light of Thy divine wisdom direct the deliberations of Congress, and shine forth in all the proceedings and laws framed for our rule and government; so that they may tend to the preservation of peace, the promotion of national happiness, the increase of industry, sobriety, and useful knowledge, and may perpetuate to us the blessings of equal liberty.\n\nWe pray for his Excellency the Governor of this State, for the members of the Assembly, for all Judges, Magistrates, and other officers who are appointed to guard our political welfare; that they may be enabled, by Thy powerful protection, to discharge the duties of their respective stations with honesty and ability.\n\nWe recommend likewise to Thy unbounded mercy all our brethren and fellow-citizens, throughout the United States, that they may be blessed in the knowledge, and sanctified in the observance of Thy most holy law; that they may be preserved in union, and in that peace which the world cannot give; and, after enjoying the blessings of this life, be admitted to those which are eternal.\n\nFinally, we pray Thee, O Lord of mercy, to remember the souls of Thy servants departed who are gone before us with the sign of faith, and repose in the sleep of peace: the souls of our parents, relations, and friends; of those who, when living, were members of this congregation; and particularly of such as are lately deceased; of all benefactors who, by their donations or legacies to this Church, witnessed their zeal for the decency of divine worship, and proved their claim to our grateful and charitable remembrance. To these, O Lord, and to all that rest in Christ, grant, we beseech Thee, a place of refreshment, light, and everlasting peace, through the same Jesus Christ, our Lord and Saviour. Amen.",
      prayerType: "intercession",
      category: "general",
      language: "en",
      summary:
        'The prayer composed by John Carroll, first bishop and archbishop of Baltimore, for the Pope and the bishops, for the President, Congress, the Governor and all who hold public office, for the whole people of the United States, and for the faithful departed. The Manual of Prayers (1889) heads it with the date 1800; "N." marks where the names of the Pope and the local bishop are said.',
      occasions: ["for-the-church", "country", "all-souls"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n63/mode/1up"],
    },
  },
  {
    contentType: "PRAYER",
    slug: "universal-prayer-of-pope-clement-xi",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ["https://archive.org/details/manualofprayersf00wood/page/n182/mode/1up"],
    payload: {
      slug: "universal-prayer-of-pope-clement-xi",
      title: "The Universal Prayer for All Things Necessary to Salvation (Pope Clement XI)",
      body: "O my God, I believe in Thee; do Thou strengthen my faith. All my hopes are in Thee; do Thou secure them. I love Thee; teach me to love Thee daily more and more. I am sorry that I have offended Thee; do Thou increase my sorrow.\n\nI adore Thee as my first beginning; I aspire after Thee as my last end. I give Thee thanks as my constant benefactor; I call upon Thee as my sovereign protector.\n\nVouchsafe, O my God, to conduct me by Thy wisdom, to restrain me by Thy justice, to comfort me by Thy mercy, to defend me by Thy power.\n\nTo Thee I desire to consecrate all my thoughts, words, actions, and sufferings; that henceforward I may think of Thee, speak of Thee, refer all my actions to Thy greater glory, and suffer willingly whatever Thou shalt appoint.\n\nLord, I desire that in all things Thy will may be done, because it is Thy will, and in the manner that Thou willest.\n\nI beg of Thee to enlighten my understanding, to inflame my will, to purify my body, and to sanctify my soul.\n\nGive me strength, O my God, to expiate my offences, to overcome my temptations, to subdue my passions, and to acquire the virtues proper for my state.\n\nFill my heart with tender affection for Thy goodness, hatred of my faults, love of my neighbor, and contempt of the world.\n\nLet me always remember to be submissive to my superiors, courteous to my inferiors, faithful to my friends, and charitable to my enemies.\n\nAssist me to overcome sensuality by mortification, avarice by almsdeeds, anger by meekness, and tepidity by devotion.\n\nO my God, make me prudent in my undertakings, courageous in dangers, patient in affliction, and humble in prosperity.\n\nGrant that I may be ever attentive at my prayers, temperate at my meals, diligent in my employments, and constant in my resolutions.\n\nLet my conscience be ever upright and pure, my exterior modest, my conversation edifying, and my deportment regular.\n\nAssist me, that I may continually labor to overcome nature, to correspond with Thy grace, to keep Thy commandments, and to work out my salvation.\n\nDiscover to me, O my God, the nothingness of this world, the greatness of heaven, the shortness of time, and the length of eternity.\n\nGrant that I may prepare for death; that I may fear Thy judgments, escape hell, and in the end obtain heaven; through Jesus Christ our Lord. Amen.",
      prayerType: "general",
      category: "general",
      language: "en",
      summary:
        "A comprehensive prayer of faith, hope, love and contrition, and for every virtue needed for salvation, which the Manual of Prayers (1889), the prayer book prepared by order of the Third Plenary Council of Baltimore ascribes to Pope Clement XI (1721).",
      occasions: ["daily", "morning"],
      relatedSaints: [],
      citations: ["https://archive.org/details/manualofprayersf00wood/page/n182/mode/1up"],
    },
  },
];
