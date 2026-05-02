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
];
