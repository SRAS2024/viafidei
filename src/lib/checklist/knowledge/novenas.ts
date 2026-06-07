import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const USCCB = "https://www.usccb.org/";

function nineDays(
  theme: string,
): Array<{ day: number; title: string; meditation: string; prayerText: string }> {
  return Array.from({ length: 9 }, (_, i) => ({
    day: i + 1,
    title: `Day ${i + 1}`,
    meditation: `On the ${i + 1}${["st", "nd", "rd", "th", "th", "th", "th", "th", "th"][i]} day of this novena, draw near to the Lord with the intention of ${theme}. Spend several minutes in silent meditation, asking the Holy Spirit to open your heart to God's will. Reflect on how God's grace is at work in your life and the needs you bring before him.`,
    prayerText: `Heavenly Father, on this ${i + 1}${["st", "nd", "rd", "th", "th", "th", "th", "th", "th"][i]} day of prayer, I come before you with humble trust. Through the intercession of the saints and the Blessed Virgin Mary, hear my prayer for ${theme}. Grant me the grace to persevere in faith, hope, and charity. I make this petition through Christ our Lord. Amen.`,
  }));
}

export const novenaKnowledge: CuratedEntry[] = [
  {
    contentType: "NOVENA",
    slug: "divine-mercy-novena",
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug: "divine-mercy-novena",
      title: "Divine Mercy Novena",
      summary:
        "The novena revealed by the Lord to St. Faustina Kowalska, traditionally prayed from Good Friday through Divine Mercy Sunday (the Second Sunday of Easter). Each day intercedes for a different group of souls.",
      background:
        "The Lord Jesus dictated the novena to St. Faustina in 1937 (Diary entries 1209-1229). Pope John Paul II canonized her in 2000 and established Divine Mercy Sunday for the universal Church.",
      intentionTheme: "Divine Mercy for all souls",
      days: [
        {
          day: 1,
          title: "All Mankind, Especially Sinners",
          meditation:
            "Today bring to Me all mankind, especially all sinners, and immerse them in the ocean of My mercy.",
          prayerText:
            "Most Merciful Jesus, whose very nature is to have compassion on us and to forgive us, do not look upon our sins but upon our trust which we place in Your infinite goodness. Receive us all into the abode of Your Most Compassionate Heart, and never let us escape from It. We beg this of You by Your love which unites You to the Father and the Holy Spirit.",
        },
        {
          day: 2,
          title: "The Souls of Priests and Religious",
          meditation:
            "Today bring to Me the souls of priests and religious, and immerse them in My unfathomable mercy.",
          prayerText:
            "Most Merciful Jesus, from whom comes all that is good, increase Your grace in priests and religious, that they may worthily and fruitfully perform the works of mercy; and that all who see them may glorify the Father of Mercy who is in heaven.",
        },
        {
          day: 3,
          title: "All Devout and Faithful Souls",
          meditation:
            "Today bring to Me all devout and faithful souls, and immerse them in the ocean of My mercy.",
          prayerText:
            "Most Merciful Jesus, from the treasury of Your mercy, You impart Your graces in great abundance to each and all. Receive us into the abode of Your Most Compassionate Heart and never let us escape from It.",
        },
        {
          day: 4,
          title: "Those Who Do Not Believe in God and Those Who Do Not Yet Know Me",
          meditation:
            "Today bring to Me those who do not believe in God and those who do not yet know Me. Immerse them in the ocean of My mercy.",
          prayerText:
            "Most Compassionate Jesus, You are the Light of the whole world. Receive into the abode of Your Most Compassionate Heart the souls of those who do not believe in God and of those who as yet do not know You. Let the rays of Your grace enlighten them, that they too, together with us, may extol Your wondrous mercy.",
        },
        {
          day: 5,
          title: "The Souls of Separated Brethren",
          meditation:
            "Today bring to Me the souls of those who have separated themselves from My Church, and immerse them in the ocean of My mercy.",
          prayerText:
            "Most Merciful Jesus, Goodness itself, You do not refuse Light to those who seek it of You. Receive into the abode of Your Most Compassionate Heart the souls of those who have separated themselves from Your Church, and draw them by Your light into the unity of the Church.",
        },
        {
          day: 6,
          title: "The Meek and Humble Souls and the Souls of Little Children",
          meditation:
            "Today bring to Me the meek and humble souls and the souls of little children, and immerse them in My mercy.",
          prayerText:
            "Most Merciful Jesus, You yourself have said: 'Learn from Me, for I am meek and humble of heart.' Receive into the abode of Your Most Compassionate Heart all meek and humble souls and the souls of little children.",
        },
        {
          day: 7,
          title: "The Souls Who Especially Venerate and Glorify My Mercy",
          meditation:
            "Today bring to Me the souls who especially venerate and glorify My mercy, and immerse them in My mercy.",
          prayerText:
            "Most Merciful Jesus, whose Heart is Love itself, receive into the abode of Your Most Compassionate Heart the souls of those who particularly extol and venerate the greatness of Your mercy.",
        },
        {
          day: 8,
          title: "The Souls Detained in Purgatory",
          meditation:
            "Today bring to Me the souls who are detained in purgatory, and immerse them in the abyss of My mercy.",
          prayerText:
            "Most Merciful Jesus, You yourself have said that You desire mercy; so I bring into the abode of Your Most Compassionate Heart the souls in Purgatory — souls who are very dear to You, and yet, who must make retribution to Your justice.",
        },
        {
          day: 9,
          title: "Souls Who Have Become Lukewarm",
          meditation:
            "Today bring to Me souls who have become lukewarm, and immerse them in the abyss of My mercy.",
          prayerText:
            "Most Compassionate Jesus, You are Compassion Itself. I bring lukewarm souls into the abode of Your Most Compassionate Heart. In this fire of Your pure love, let these tepid souls, who like corpses filled You with such deep loathing, be once again set aflame.",
        },
      ],
      associatedSaintSlug: "saint-faustina-kowalska",
      citations: [VATICAN, USCCB],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-holy-spirit",
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug: "novena-holy-spirit",
      title: "Novena to the Holy Spirit",
      summary:
        "The original novena of the Church — prayed from the day after the Ascension through the Vigil of Pentecost, modeled on the nine days the apostles and Mary spent in the upper room praying for the descent of the Holy Spirit.",
      background:
        "This is the first novena, modeled on Acts 1:14: 'All these with one accord devoted themselves to prayer, together with the women and Mary the mother of Jesus.' Pope Leo XIII commanded its annual celebration in Divinum Illud Munus (1897).",
      intentionTheme: "the seven gifts of the Holy Spirit",
      days: nineDays("the outpouring of the seven gifts of the Holy Spirit"),
      relatedFeastSlug: "solemnity-pentecost",
      citations: [VATICAN, USCCB],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-sacred-heart-of-jesus",
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug: "novena-sacred-heart-of-jesus",
      title: "Novena to the Sacred Heart of Jesus",
      summary:
        "A nine-day novena traditionally prayed in preparation for the Solemnity of the Most Sacred Heart of Jesus, drawing on the spirituality revealed to St. Margaret Mary Alacoque.",
      background:
        "The devotion to the Sacred Heart was greatly promoted by the apparitions to St. Margaret Mary Alacoque (1673-1675). Pope Pius XII gave the most authoritative magisterial teaching in Haurietis Aquas (1956).",
      intentionTheme: "trust in the Sacred Heart of Jesus",
      days: nineDays("trust and consecration to the Sacred Heart of Jesus"),
      relatedFeastSlug: "solemnity-sacred-heart",
      citations: [VATICAN, USCCB],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-our-lady-of-guadalupe",
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug: "novena-our-lady-of-guadalupe",
      title: "Novena to Our Lady of Guadalupe",
      summary:
        "A novena to the Patroness of the Americas, traditionally prayed from December 4 through December 12 in preparation for her feast.",
      background:
        "Honors the apparitions of the Blessed Virgin Mary to St. Juan Diego at Tepeyac in December 1531, and the miraculous image of Our Lady of Guadalupe preserved in the Basilica in Mexico City.",
      intentionTheme: "the intercession of Our Lady of Guadalupe",
      days: nineDays("Our Lady of Guadalupe's intercession and motherly care"),
      associatedMarianTitleSlug: "our-lady-of-guadalupe",
      citations: [VATICAN, USCCB],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-joseph",
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug: "novena-saint-joseph",
      title: "Novena to Saint Joseph",
      summary:
        "A nine-day novena to the foster father of Jesus and patron of the universal Church, prayed in preparation for his feast (March 19) or in any time of family or vocational need.",
      background:
        "Pope Pius IX declared St. Joseph patron of the universal Church in 1870. Pope Francis added his name to all the Eucharistic Prayers of the Roman Missal in 2013 and proclaimed the Year of St. Joseph in 2020-2021.",
      intentionTheme: "the protection and intercession of St. Joseph",
      days: nineDays("the intercession of St. Joseph for families, workers, and a happy death"),
      associatedSaintSlug: "saint-joseph",
      citations: [VATICAN, USCCB],
    },
  },
];
