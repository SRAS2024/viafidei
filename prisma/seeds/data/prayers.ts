export type PrayerSeed = {
  slug: string;
  defaultTitle: string;
  category: string;
  body: string;
  officialPrayer?: string;
};

export const PRAYERS: PrayerSeed[] = [
  {
    slug: "pater-noster",
    defaultTitle: "Pater Noster",
    category: "Dominical",
    body: "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
  },
  {
    slug: "ave-maria",
    defaultTitle: "Ave Maria",
    category: "Marian",
    body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
  },
  {
    slug: "anima-christi",
    defaultTitle: "Anima Christi",
    category: "Eucharistic",
    body: "Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Within thy wounds hide me. Suffer me not to be separated from thee. From the malignant enemy defend me. In the hour of my death call me, and bid me come unto thee, that with thy saints I may praise thee for ever and ever. Amen.",
  },
  {
    slug: "regina-caeli",
    defaultTitle: "Regina Cæli",
    category: "Marian",
    body: "Queen of Heaven, rejoice, alleluia, for He whom you did merit to bear, alleluia, has risen as He said, alleluia. Pray for us to God, alleluia.",
  },
  {
    slug: "memorare",
    defaultTitle: "Memorare",
    category: "Marian",
    body: "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession, was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee I come; before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
  },
  {
    slug: "gloria-patri",
    defaultTitle: "Gloria Patri",
    category: "Trinitarian",
    body: "Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.",
  },
  {
    slug: "sub-tuum",
    defaultTitle: "Sub Tuum Praesidium",
    category: "Marian",
    body: "We fly to thy patronage, O holy Mother of God. Despise not our petitions in our necessities, but deliver us always from all dangers, O glorious and blessed Virgin. Amen.",
  },
  {
    slug: "salve-regina",
    defaultTitle: "Salve Regina",
    category: "Marian",
    body: "Hail, Holy Queen, Mother of mercy, our life, our sweetness and our hope! To thee do we cry, poor banished children of Eve. To thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy towards us, and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary.",
  },
  {
    slug: "act-of-contrition",
    defaultTitle: "Act of Contrition",
    category: "Sacramental",
    body: "O my God, I am heartily sorry for having offended Thee, and I detest all my sins because of Thy just punishments, but most of all because they offend Thee, my God, Who art all-good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasions of sin. Amen.",
  },
  {
    slug: "act-of-faith",
    defaultTitle: "Act of Faith",
    category: "Theological Virtue",
    body: "O my God, I firmly believe that Thou art one God in three divine Persons, Father, Son, and Holy Spirit. I believe that Thy divine Son became man and died for our sins, and that He will come to judge the living and the dead. I believe these and all the truths which the Holy Catholic Church teaches, because Thou hast revealed them, Who canst neither deceive nor be deceived. Amen.",
  },
  {
    slug: "act-of-hope",
    defaultTitle: "Act of Hope",
    category: "Theological Virtue",
    body: "O my God, relying on Thy almighty power and infinite mercy and promises, I hope to obtain pardon of my sins, the help of Thy grace, and life everlasting, through the merits of Jesus Christ, my Lord and Redeemer. Amen.",
  },
  {
    slug: "act-of-love",
    defaultTitle: "Act of Love",
    category: "Theological Virtue",
    body: "O my God, I love Thee above all things, with my whole heart and soul, because Thou art all-good and worthy of all love. I love my neighbor as myself for the love of Thee. I forgive all who have injured me and ask pardon of all whom I have injured. Amen.",
  },
  {
    slug: "fatima-prayer",
    defaultTitle: "Fatima Prayer",
    category: "Marian",
    body: "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to Heaven, especially those in most need of Thy mercy. Amen.",
  },
  {
    slug: "angel-of-god",
    defaultTitle: "Angel of God",
    category: "Angelic",
    body: "Angel of God, my guardian dear, to whom God's love commits me here, ever this day be at my side, to light and guard, to rule and guide. Amen.",
  },
  {
    slug: "morning-offering",
    defaultTitle: "Morning Offering",
    category: "Daily",
    body: "O Jesus, through the immaculate heart of Mary, I offer Thee my prayers, works, joys and sufferings of this day in union with the holy sacrifice of the Mass throughout the world. I offer them for all the intentions of Thy Sacred Heart: the salvation of souls, reparation for sin, and the reunion of all Christians. I offer them for the intentions of our bishops and of all Apostles of Prayer, and in particular for those recommended by our Holy Father this month. Amen.",
  },
  {
    slug: "angelus",
    defaultTitle: "The Angelus",
    category: "Marian",
    body: "V. The Angel of the Lord declared unto Mary.\nR. And she conceived of the Holy Spirit.\n\nHail Mary, full of grace...\n\nV. Behold the handmaid of the Lord.\nR. Be it done unto me according to thy word.\n\nHail Mary, full of grace...\n\nV. And the Word was made flesh.\nR. And dwelt among us.\n\nHail Mary, full of grace...\n\nV. Pray for us, O holy Mother of God.\nR. That we may be made worthy of the promises of Christ.\n\nLet us pray: Pour forth, we beseech Thee, O Lord, Thy grace into our hearts, that we, to whom the Incarnation of Christ Thy Son was made known by the message of an Angel, may by His Passion and Cross be brought to the glory of His Resurrection. Through the same Christ Our Lord. Amen.",
  },
  {
    slug: "rosary-mysteries-joyful",
    defaultTitle: "Joyful Mysteries of the Rosary",
    category: "Rosary",
    body: "The Five Joyful Mysteries are prayed on Mondays and Saturdays:\n1. The Annunciation\n2. The Visitation\n3. The Nativity of Our Lord\n4. The Presentation in the Temple\n5. The Finding of Jesus in the Temple",
  },
  {
    slug: "divine-mercy-chaplet",
    defaultTitle: "Chaplet of Divine Mercy",
    category: "Devotional",
    body: "Begin with the Our Father, Hail Mary, and the Apostles' Creed.\n\nOn each large bead:\nEternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.\n\nOn each small bead:\nFor the sake of His sorrowful Passion, have mercy on us and on the whole world.\n\nConclude with (three times):\nHoly God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.",
  },
  {
    slug: "prayer-to-st-michael",
    defaultTitle: "Prayer to Saint Michael",
    category: "Angelic",
    body: "Saint Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do Thou, O Prince of the Heavenly Host, by the power of God, cast into hell Satan and all the evil spirits who prowl about the world seeking the ruin of souls. Amen.",
  },
  {
    slug: "sign-of-the-cross",
    defaultTitle: "The Sign of the Cross",
    category: "Trinitarian",
    body: "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
  },
  {
    slug: "apostles-creed",
    defaultTitle: "The Apostles' Creed",
    category: "Creedal",
    body: "I believe in God, the Father almighty, Creator of heaven and earth, and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; he descended into hell; on the third day he rose again from the dead; he ascended into heaven, and is seated at the right hand of God the Father almighty; from there he will come to judge the living and the dead.\n\nI believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.",
  },
  {
    slug: "nicene-creed",
    defaultTitle: "The Nicene Creed",
    category: "Creedal",
    body: "I believe in one God, the Father almighty, maker of heaven and earth, of all things visible and invisible. I believe in one Lord Jesus Christ, the Only Begotten Son of God, born of the Father before all ages. God from God, Light from Light, true God from true God, begotten, not made, consubstantial with the Father; through him all things were made. For us men and for our salvation he came down from heaven, and by the Holy Spirit was incarnate of the Virgin Mary, and became man. For our sake he was crucified under Pontius Pilate, he suffered death and was buried, and rose again on the third day in accordance with the Scriptures. He ascended into heaven and is seated at the right hand of the Father. He will come again in glory to judge the living and the dead and his kingdom will have no end.\n\nI believe in the Holy Spirit, the Lord, the giver of life, who proceeds from the Father and the Son, who with the Father and the Son is adored and glorified, who has spoken through the prophets.\n\nI believe in one, holy, catholic and apostolic Church. I confess one Baptism for the forgiveness of sins and I look forward to the resurrection of the dead and the life of the world to come. Amen.",
  },
  {
    slug: "hail-holy-queen",
    defaultTitle: "Hail, Holy Queen",
    category: "Marian",
    body: "Hail, Holy Queen, Mother of mercy, our life, our sweetness and our hope! To thee do we cry, poor banished children of Eve. To thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy towards us, and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary. Amen.",
  },
  {
    slug: "fatima-decade-prayer",
    defaultTitle: "The Fatima Prayer",
    category: "Marian",
    body: "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to heaven, especially those most in need of thy mercy. Amen.",
  },
  {
    slug: "tantum-ergo",
    defaultTitle: "Tantum Ergo",
    category: "Eucharistic",
    body: "Down in adoration falling, lo! the sacred Host we hail; lo! o'er ancient forms departing, newer rites of grace prevail; faith for all defects supplying, where the feeble senses fail.\n\nTo the everlasting Father, and the Son who reigns on high, with the Holy Spirit proceeding forth from each eternally, be salvation, honour, blessing, might and endless majesty. Amen.",
  },
  {
    slug: "o-salutaris-hostia",
    defaultTitle: "O Salutaris Hostia",
    category: "Eucharistic",
    body: "O saving Victim, opening wide the gate of heaven to man below; our foes press on from every side; thine aid supply, thy strength bestow.\n\nTo thy great name be endless praise, immortal Godhead, One in Three. O grant us endless length of days in our true native land, with thee. Amen.",
  },
  {
    slug: "divine-praises",
    defaultTitle: "The Divine Praises",
    category: "Eucharistic",
    body: "Blessed be God.\nBlessed be his holy Name.\nBlessed be Jesus Christ, true God and true Man.\nBlessed be the name of Jesus.\nBlessed be his most Sacred Heart.\nBlessed be his most Precious Blood.\nBlessed be Jesus in the most holy Sacrament of the altar.\nBlessed be the Holy Spirit, the Paraclete.\nBlessed be the great Mother of God, Mary most holy.\nBlessed be her holy and Immaculate Conception.\nBlessed be her glorious Assumption.\nBlessed be the name of Mary, Virgin and Mother.\nBlessed be Saint Joseph, her most chaste spouse.\nBlessed be God in his angels and in his saints.",
  },
  {
    slug: "litany-of-humility",
    defaultTitle: "Litany of Humility",
    category: "Litany",
    body: "O Jesus, meek and humble of heart, hear me.\n\nFrom the desire of being esteemed, deliver me, Jesus.\nFrom the desire of being loved, deliver me, Jesus.\nFrom the desire of being extolled, deliver me, Jesus.\nFrom the desire of being honored, deliver me, Jesus.\nFrom the desire of being praised, deliver me, Jesus.\nFrom the desire of being preferred to others, deliver me, Jesus.\nFrom the desire of being consulted, deliver me, Jesus.\nFrom the desire of being approved, deliver me, Jesus.\n\nFrom the fear of being humiliated, deliver me, Jesus.\nFrom the fear of being despised, deliver me, Jesus.\nFrom the fear of suffering rebukes, deliver me, Jesus.\nFrom the fear of being calumniated, deliver me, Jesus.\nFrom the fear of being forgotten, deliver me, Jesus.\nFrom the fear of being ridiculed, deliver me, Jesus.\nFrom the fear of being wronged, deliver me, Jesus.\nFrom the fear of being suspected, deliver me, Jesus.\n\nThat others may be loved more than I, Jesus, grant me the grace to desire it.\nThat others may be esteemed more than I, Jesus, grant me the grace to desire it.\nThat in the opinion of the world, others may increase, and I may decrease, Jesus, grant me the grace to desire it.\nThat others may be chosen and I set aside, Jesus, grant me the grace to desire it.\nThat others may be praised and I unnoticed, Jesus, grant me the grace to desire it.\nThat others may be preferred to me in everything, Jesus, grant me the grace to desire it.\nThat others may become holier than I, provided that I become as holy as I should, Jesus, grant me the grace to desire it.",
  },
  {
    slug: "suscipe",
    defaultTitle: "Suscipe (Saint Ignatius)",
    category: "Devotional",
    body: "Take, Lord, and receive all my liberty, my memory, my understanding, and my entire will. All I have and call my own. Whatever I have or hold, you have given me. I return it all to you and surrender it wholly to be governed by your will. Give me only your love and your grace, and I am rich enough and ask for nothing more. Amen.",
  },
  {
    slug: "prayer-for-vocations",
    defaultTitle: "Prayer for Vocations",
    category: "Devotional",
    body: "Lord Jesus, who called those whom you wished, call many of us to work for you and with you. Lord, who has enlightened all with your word, enlighten in us the gift of vocation. Lord, who has loved us with your example, grant us the courage to follow you. Mary, Mother of all Christians, pray for us. Amen.",
  },
  {
    slug: "te-deum",
    defaultTitle: "Te Deum",
    category: "Liturgical",
    body: "We praise you, O God: we acclaim you as the Lord. Everlasting Father, all the world bows down before you. All the angels sing your praise, the hosts of heaven and all the angelic powers, all the cherubim and seraphim call out to you in unending song: Holy, Holy, Holy, is the Lord God of angel hosts! The heavens and the earth are filled with your majesty and glory.\n\nThe glorious band of apostles, the noble company of prophets, the white-robed army who shed their blood for Christ, all sing your praise. And to the ends of the earth your holy Church proclaims her faith in you: Father, whose majesty is boundless; your true and only Son, who is to be adored; the Holy Spirit, sent to be our Advocate. Amen.",
  },
  {
    slug: "veni-creator-spiritus",
    defaultTitle: "Veni Creator Spiritus",
    category: "Pneumatological",
    body: "Come, Holy Spirit, Creator blest, and in our souls take up thy rest; come with thy grace and heavenly aid to fill the hearts which thou hast made.\n\nO Comforter, to thee we cry, thou heavenly gift of God most high, thou Fount of life, and Fire of love, and sweet anointing from above.\n\nO finger of the hand divine, the sevenfold gifts of grace are thine; true promise of the Father thou, who dost the tongue with power endow.\n\nKindle our senses from above, and make our hearts o'erflow with love; with patience firm and virtue high the weakness of our flesh supply.\n\nFar from us drive the foe we dread, and grant us thy true peace instead; so shall we not, with thee for guide, turn from the path of life aside.\n\nO may thy grace on us bestow the Father and the Son to know, and thee through endless times confessed of both the eternal Spirit blest. Amen.",
  },
  {
    slug: "sacred-heart-litany",
    defaultTitle: "Litany of the Sacred Heart (excerpt)",
    category: "Litany",
    body: "Lord, have mercy. Christ, have mercy. Lord, have mercy.\nChrist, hear us. Christ, graciously hear us.\nGod, the Father of heaven, have mercy on us.\nGod, the Son, Redeemer of the world, have mercy on us.\nGod, the Holy Spirit, have mercy on us.\nHoly Trinity, one God, have mercy on us.\n\nHeart of Jesus, Son of the Eternal Father, have mercy on us.\nHeart of Jesus, formed by the Holy Spirit in the womb of the Virgin Mother, have mercy on us.\nHeart of Jesus, substantially united to the Word of God, have mercy on us.\nHeart of Jesus, of infinite majesty, have mercy on us.\nHeart of Jesus, holy temple of God, have mercy on us.\nHeart of Jesus, tabernacle of the Most High, have mercy on us.\nHeart of Jesus, house of God and gate of heaven, have mercy on us.\nHeart of Jesus, burning furnace of charity, have mercy on us.\nHeart of Jesus, abode of justice and love, have mercy on us.\nHeart of Jesus, full of goodness and love, have mercy on us.",
  },
  {
    slug: "divine-mercy-eternal-father",
    defaultTitle: "Eternal Father (Divine Mercy)",
    category: "Devotional",
    body: "Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.",
  },
  {
    slug: "divine-mercy-holy-god",
    defaultTitle: "Holy God (Divine Mercy)",
    category: "Devotional",
    body: "Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.",
  },
  {
    slug: "prayer-before-confession",
    defaultTitle: "Prayer Before Confession",
    category: "Penitential",
    body: "O Lord, grant me light to see myself as Thou dost see me, and the grace to repent truly and sincerely of my sins. Mary, Mother of mercy, pray for me. Amen.",
  },
];
