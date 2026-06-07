import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const USCCB = "https://www.usccb.org/";

function title(
  slug: string,
  name: string,
  summary: string,
  origin: string,
  theology: string,
  feastDay?: string,
): CuratedEntry {
  return {
    contentType: "MARIAN_TITLE",
    slug,
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug,
      title: name,
      summary,
      origin,
      ...(feastDay ? { feastDay } : {}),
      theologicalSignificance: theology,
      associatedPrayers: [],
      citations: [VATICAN, USCCB],
    },
  };
}

export const marianTitleKnowledge: CuratedEntry[] = [
  title(
    "mother-of-god",
    "Mother of God (Theotokos)",
    "Mary is honored as the Mother of God because the one she bore is the eternal Son of God made man. This is the most fundamental of all Marian titles.",
    "Defined as dogma at the Council of Ephesus in 431 against the Nestorian heresy, which sought to separate the divinity and humanity of Christ.",
    "The title Theotokos affirms that Jesus Christ is one Divine Person with two natures (divine and human), so the woman who bore him truly bore God-made-man. The dogma protects the unity of Christ's person.",
    "01-01",
  ),
  title(
    "immaculate-conception",
    "Immaculate Conception",
    "Mary, in the first moment of her conception, by a singular grace and privilege of Almighty God, in view of the merits of Jesus Christ, was preserved free from all stain of original sin.",
    "Defined as dogma by Pope Pius IX in the apostolic constitution Ineffabilis Deus, December 8, 1854. Mary herself confirmed the title to St. Bernadette at Lourdes in 1858: 'I am the Immaculate Conception.'",
    "The dogma affirms that Mary's freedom from original sin was a singular grace of God in view of the merits of Christ. She is the most perfectly redeemed of the redeemed.",
    "12-08",
  ),
  title(
    "assumption-of-mary",
    "Assumption of Mary",
    "The Immaculate Mother of God, the ever-Virgin Mary, having completed the course of her earthly life, was assumed body and soul into heavenly glory.",
    "Defined as dogma by Pope Pius XII in the apostolic constitution Munificentissimus Deus, November 1, 1950. The faith of the Church in Mary's Assumption is attested from the earliest centuries.",
    "The Assumption manifests the fullness of Christ's victory over death. Mary, sharing perfectly in the Paschal Mystery of her Son, anticipates the resurrection promised to all the faithful.",
    "08-15",
  ),
  title(
    "perpetual-virginity",
    "Perpetual Virginity of Mary",
    "Mary remained a virgin in conceiving her Son, a virgin in giving birth to him, a virgin in carrying him, a virgin in nursing him at her breast, always a virgin.",
    "Affirmed in the Apostles' and Nicene Creeds and by the Lateran Council of 649. The Church has always confessed Mary's virginity ante partum, in partu, et post partum.",
    "Mary's virginity is the sign that her Son is God: born of a woman but not of the will of man. Her virginity also signifies the Church's undivided love of Christ.",
  ),
  title(
    "queen-of-heaven",
    "Queen of Heaven",
    "Mary is crowned Queen of Heaven and Earth because she is the Mother of the King of kings and shares in the glory of her Son.",
    "Affirmed by Pope Pius XII in the encyclical Ad Caeli Reginam (1954), which established the Memorial of the Queenship of Mary.",
    "Mary's queenship is participated, not autonomous: she reigns as Mother of the King and as the woman whose total obedience to God brings her to share in Christ's royal mediation.",
    "08-22",
  ),
  title(
    "our-lady-of-guadalupe",
    "Our Lady of Guadalupe",
    "Patroness of the Americas. Mary appeared to St. Juan Diego in 1531 at Tepeyac, leaving her image miraculously imprinted on his tilma.",
    "The apparitions of December 1531 led to the conversion of millions of indigenous peoples in the Americas. The tilma is preserved in the Basilica of Our Lady of Guadalupe in Mexico City.",
    "The image presents Mary as a pregnant mestiza woman, indicating the universal motherhood of God's people and the Christological centrality of the Incarnation.",
    "12-12",
  ),
  title(
    "our-lady-of-sorrows",
    "Our Lady of Sorrows",
    "Mary as Mater Dolorosa, the Sorrowful Mother, who shared in her Son's Passion. Seven sorrows are traditionally honored.",
    "The devotion is rooted in Simeon's prophecy (Luke 2:35): 'a sword will pierce through your own soul also.' The Servite Order spread the Seven Sorrows devotion in the 13th century.",
    "Mary's sorrows reveal her perfect union with the redeeming Passion of Christ and her motherhood of all the suffering members of his Body.",
    "09-15",
  ),
  title(
    "our-lady-of-the-rosary",
    "Our Lady of the Rosary",
    "Mary venerated under the title of the Rosary, the great Marian psalter of the Latin Church.",
    "Pope St. Pius V established the feast in 1573 in thanksgiving for the Christian victory at the Battle of Lepanto (October 7, 1571), attributed to the prayer of the Rosary.",
    "The Rosary is a Christ-centered prayer, meditating on the mysteries of Christ's life in the company of his Mother. Pope John Paul II added the Luminous Mysteries in 2002.",
    "10-07",
  ),
];
