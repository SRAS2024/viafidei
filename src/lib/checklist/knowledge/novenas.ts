import type { CuratedEntry } from "./index";

import { novenaGroupOne } from "./novenas/group-1";
import { novenaGroupTwo } from "./novenas/group-2";

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

const LEGACY: CuratedEntry[] = [
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
    slug: "novena-saint-therese",
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug: "novena-saint-therese",
      title: "Novena to Saint Thérèse of Lisieux",
      summary:
        "A nine-day novena to Saint Thérèse of the Child Jesus, the Little Flower and Doctor of the Church, who promised to 'let fall a shower of roses' and to spend her heaven doing good upon earth.",
      background:
        "Saint Thérèse of Lisieux (1873-1897), a Carmelite who taught the 'little way' of spiritual childhood, was canonized in 1925 and declared a Doctor of the Church in 1997. She is a patroness of the missions.",
      intentionTheme: "the intercession of St. Thérèse and her 'little way' of confidence",
      days: nineDays(
        "the intercession of St. Thérèse of Lisieux and the grace to follow her little way of trust and love",
      ),
      associatedSaintSlug: "saint-therese-of-lisieux",
      citations: [VATICAN, USCCB],
    },
  },
];

/**
 * The novena registry: the hand-written entries above plus every per-group
 * file under `./novenas/`. The group files are imported by their full explicit
 * path so the bare `./novenas` specifier keeps resolving to THIS file (see the
 * module-resolution note in `./guides.ts`).
 */
export const novenaKnowledge: CuratedEntry[] = [...LEGACY, ...novenaGroupOne, ...novenaGroupTwo];
