import type { CuratedEntry } from "../index";

const USCCB_LITURGICAL_YEAR = "https://www.usccb.org/prayer-worship/liturgical-year";
const USCCB_CALENDAR = "https://www.usccb.org/committees/divine-worship/liturgical-calendar";
const USCCB_ORDINARY_TIME = "https://www.usccb.org/prayer-worship/liturgical-year/ordinary-time";
const USCCB_TRIDUUM = "https://www.usccb.org/prayer-worship/liturgical-year/triduum";
const GIRM =
  "https://www.usccb.org/prayer-and-worship/the-mass/general-instruction-of-the-roman-missal";
const DIRECTORY_POPULAR_PIETY =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const SACROSANCTUM_CONCILIUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html";
// Book IV of the 1983 Code (the sanctifying office) is published on vatican.va
// in five separate files, not one. The single combined URL that used to stand
// here (cic_lib4-cann834-1253) does not exist and returned 404 for every entry
// that cited it; each entry now cites the file that actually carries its canons.
const CANON_LAW_BAPTISM =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann834-878_en.html";
const CANON_LAW_CONFIRMATION_EUCHARIST =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann879-958_en.html";
const CANON_LAW_ORDERS_AND_MARRIAGE =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann998-1165_en.html";
const CANON_LAW_FUNERALS =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1166-1190_en.html";
const CANON_LAW_SACRED_TIMES =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1244-1253_en.html";
const REDEMPTIONIS_SACRAMENTUM =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20040423_redemptionis-sacramentum_en.html";
const LUMEN_GENTIUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html";

type LiturgicalKind =
  | "feast"
  | "solemnity"
  | "memorial"
  | "optional_memorial"
  | "liturgical_season"
  | "liturgical_year"
  | "mass_structure"
  | "marriage_rite"
  | "funeral_rite"
  | "ordination_rite"
  | "council_event"
  | "symbolism"
  | "glossary_term";

type LiturgicalRank = "solemnity" | "feast" | "memorial" | "optional_memorial" | "weekday" | "n/a";

type LiturgicalSeason =
  | "advent"
  | "christmas"
  | "ordinary_time"
  | "lent"
  | "triduum"
  | "easter"
  | "n/a";

interface LiturgicalInput {
  slug: string;
  title: string;
  kind: LiturgicalKind;
  rank?: LiturgicalRank;
  season?: LiturgicalSeason;
  summary: string;
  body: string;
  feastDate?: string;
  movableFeast?: boolean;
  associatedSaintSlugs?: string[];
  associatedReadings?: string[];
  citations: string[];
}

function liturgical(input: LiturgicalInput): CuratedEntry {
  const citations = input.citations;
  return {
    contentType: "LITURGICAL",
    slug: input.slug,
    authorityLevel: "LITURGICAL_BOOK",
    citations,
    payload: {
      slug: input.slug,
      title: input.title,
      kind: input.kind,
      ...(input.rank ? { rank: input.rank } : {}),
      ...(input.season ? { season: input.season } : {}),
      summary: input.summary,
      body: input.body,
      ...(input.feastDate ? { feastDate: input.feastDate } : {}),
      movableFeast: input.movableFeast ?? false,
      associatedSaintSlugs: input.associatedSaintSlugs ?? [],
      associatedReadings: input.associatedReadings ?? [],
      citations,
    },
  };
}

export const liturgicalGroupTwo: CuratedEntry[] = [
  liturgical({
    slug: "memorial-immaculate-heart-of-mary",
    title: "Memorial of the Immaculate Heart of the Blessed Virgin Mary",
    kind: "memorial",
    rank: "memorial",
    season: "ordinary_time",
    movableFeast: true,
    associatedReadings: ["Luke 2:41-51"],
    summary:
      "Kept on the Saturday after the Solemnity of the Most Sacred Heart of Jesus, this memorial honors the heart of the Mother of God, wholly given to the Father's will and pierced in union with the Passion of her Son.",
    body: "Scripture itself supplies the ground of the devotion. Twice Saint Luke says that Mary kept the events of her Son's life and pondered them in her heart, and Simeon foretells that a sword would pierce her own soul. From these texts the Fathers and later spiritual writers spoke of Mary's heart as the place where faith, love, and sorrow met. Saint John Eudes gave the devotion its liturgical shape in seventeenth-century France, and the messages associated with the apparitions at Fatima in 1917 spread it widely in the twentieth century.\n\nPope Pius XII consecrated the human race to the Immaculate Heart of Mary in 1942 and two years later instituted a feast for the universal Church, then assigned to August 22. When the calendar was revised after the Second Vatican Council the celebration was moved to the day after the Solemnity of the Most Sacred Heart of Jesus, so that the two hearts are honored together; it was kept at first as an optional memorial, and Saint John Paul II raised it to an obligatory memorial in 2000. Because the date depends on Easter, it is movable, falling on the Saturday of the third week after Pentecost.\n\nThe Mass uses white vestments and proper prayers; the Gospel is Luke's account of the finding of the child Jesus in the Temple, which ends with the note that his mother kept all these things in her heart. The Church is careful about what the devotion means: honor given to Mary's heart is honor given to her whole person and to the grace of God at work in her, and it is always ordered to the worship of her Son. The Directory on Popular Piety and the Liturgy commends acts of consecration to the Immaculate Heart while insisting that they be understood as a total gift of self to Christ made through Mary, not as a substitute for the sacraments or for the moral life.",
    citations: [USCCB_CALENDAR, USCCB_ORDINARY_TIME, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "memorial-queenship-of-the-blessed-virgin-mary",
    title: "Memorial of the Queenship of the Blessed Virgin Mary",
    kind: "memorial",
    rank: "memorial",
    season: "ordinary_time",
    feastDate: "08-22",
    summary:
      "Celebrated on August 22, the octave day of the Assumption, this memorial honors Mary as Queen of heaven and earth, crowned in glory beside her Son the King of the universe.",
    body: "The title Queen is among the oldest given to the Mother of God. It appears in the ancient antiphons Salve Regina, Ave Regina Caelorum, and Regina Caeli, in the coronation imagery of medieval art, and in the fifth glorious mystery of the Rosary, the crowning of the Blessed Virgin. Its foundation is not a claim of power belonging to Mary in her own right but the truth that she is the mother of the Messianic King and the first of the redeemed to share fully in his risen glory.\n\nPope Pius XII instituted the celebration for the universal Church in the encyclical Ad caeli Reginam in 1954, at the close of a Marian Year, and assigned it to May 31. In the revision of the calendar that followed the Second Vatican Council it was moved to August 22 and ranked as a memorial. The new date is deliberate: August 22 is the octave day of the Solemnity of the Assumption, so the Church celebrates Mary's queenship as the immediate consequence of her being taken body and soul into heaven.\n\nWhite vestments are worn and the Missal provides proper prayers; the readings offered speak of the Lord's promise to the house of David and of the Annunciation, in which Gabriel says of her child that he will reign over the house of Jacob forever. Popular piety surrounds the day with the crowning of Marian images, a custom the Directory on Popular Piety treats as fitting when it leads the faithful to honor Christ the King in his mother. The Second Vatican Council states the whole doctrine soberly in Lumen gentium: the Immaculate Virgin was taken up body and soul into heavenly glory and exalted by the Lord as Queen over all things, that she might be more fully conformed to her Son.",
    citations: [USCCB_CALENDAR, LUMEN_GENTIUM, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "memorial-our-lady-of-the-rosary",
    title: "Memorial of Our Lady of the Rosary",
    kind: "memorial",
    rank: "memorial",
    season: "ordinary_time",
    feastDate: "10-07",
    associatedSaintSlugs: ["saint-dominic"],
    summary:
      "Kept on October 7, this memorial gives thanks for the Rosary, the contemplative prayer in which the faithful walk with Mary through the mysteries of Christ's life, death, and resurrection.",
    body: "The celebration began as a thanksgiving. After the naval battle of Lepanto on October 7, 1571, which was fought while rosary confraternities across Europe prayed, Pope Saint Pius V established a commemoration of Our Lady of Victory. Pope Gregory XIII renamed it the feast of the Most Holy Rosary and attached it to the first Sunday of October, and in 1716 Pope Clement XI extended it to the whole Church. Saint Pius X fixed it again on October 7, and the reformed calendar keeps it there as an obligatory memorial.\n\nThe Rosary itself grew slowly out of the monastic practice of praying the one hundred fifty psalms; lay people and those who could not read substituted one hundred fifty Hail Marys, divided into groups and joined to meditation on events in the life of Christ. Tradition associates its spread with Saint Dominic and the Order of Preachers, and the Dominicans have been its chief promoters ever since. Saint John Paul II proposed the five luminous mysteries in the apostolic letter Rosarium Virginis Mariae of 2002, giving the prayer a fuller sweep from the Baptism of the Lord to the institution of the Eucharist.\n\nThe Mass is celebrated in white; the Gospel offered is the Annunciation, the scene from which the Hail Mary itself is drawn. Because of this memorial the whole of October is widely kept as the month of the Rosary, a devotion Pope Leo XIII urged in a long series of encyclicals. The Directory on Popular Piety and the Liturgy describes the Rosary as an essentially contemplative prayer, warns against a merely mechanical recitation, and asks that it never be prayed during the celebration of Mass, since the liturgy and popular devotion each have their own proper place.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY, USCCB_ORDINARY_TIME],
  }),
  liturgical({
    slug: "optional-memorial-our-lady-of-lourdes",
    title: "Optional Memorial of Our Lady of Lourdes",
    kind: "optional_memorial",
    rank: "optional_memorial",
    season: "ordinary_time",
    feastDate: "02-11",
    associatedSaintSlugs: ["saint-bernadette-soubirous"],
    summary:
      "On February 11 the Church remembers the apparitions of the Blessed Virgin Mary to Saint Bernadette Soubirous at Lourdes in 1858, and prays with and for the sick throughout the world.",
    body: "Between February 11 and July 16, 1858, a poor and asthmatic fourteen-year-old, Bernadette Soubirous, saw a lady at the grotto of Massabielle near Lourdes in the French Pyrenees on eighteen occasions. On March 25 the lady identified herself with the words Bernadette did not understand and had to repeat all the way home: \"I am the Immaculate Conception.\" The local bishop declared the apparitions worthy of belief in 1862, four years after they began, and Pope Saint Pius X extended the celebration to the universal Church in 1907. It is kept as an optional memorial, so the Mass and Office of the day may be used instead where local custom prefers.\n\nLourdes became one of the great pilgrimage places of the Catholic world, visited each year by millions, many of them sick or disabled and accompanied by volunteers and medical personnel. The Church has recognized a small number of cures there as miraculous after long and deliberately severe medical and theological examination; far more common, and more to the point of the shrine, is the consolation of those who are not cured. The washing in the spring water, the candlelight procession, and the daily Rosary at the grotto are its best-known customs.\n\nIn 1992 Saint John Paul II established the World Day of the Sick on this date. Parishes commonly mark it by celebrating the sacrament of the Anointing of the Sick within Mass, by prayer for caregivers, and by visits to the homebound. The Mass is celebrated in white, and the prayers ask that those weighed down by illness may find help in Mary's intercession. The Church's teaching keeps the emphasis where the Gospel puts it: private revelation, even when approved, adds nothing to the deposit of faith, and its value lies in helping the faithful live the Gospel more fully in a particular time.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "feast-our-lady-of-guadalupe",
    title: "Feast of Our Lady of Guadalupe",
    kind: "feast",
    rank: "feast",
    season: "advent",
    feastDate: "12-12",
    associatedSaintSlugs: ["saint-juan-diego"],
    summary:
      "December 12 honors Our Lady of Guadalupe, who appeared to Saint Juan Diego at Tepeyac in 1531 and is venerated as Patroness of the Americas; in the dioceses of the United States the day is kept as a feast.",
    body: "The account handed down in the Nahuatl narrative known as the Nican Mopohua tells how in December 1531 a recently baptized indigenous man, Juan Diego Cuauhtlatoatzin, met the Mother of God on the hill of Tepeyac near Mexico City. She spoke to him in his own language, called herself his mother, and asked that a church be built there. When the bishop asked for a sign, she filled Juan Diego's tilma with Castilian roses out of season, and when he opened the cloak before the bishop the image of the Virgin appeared on it. That image, dark-skinned and dressed as a native noblewoman with child, is venerated in the basilica at Tepeyac and remains one of the most visited shrines in the world.\n\nThe evangelization of the peoples of Mexico advanced enormously in the years that followed, and the Church has always read the event in that light: the Gospel was received not as the religion of the conquerors but in the language and the imagery of the conquered. Pope Benedict XIV approved the Mass and Office in 1754. Pope Pius XII called her Empress of the Americas, Saint John Paul II canonized Juan Diego in 2002, and in 1999 he declared Our Lady of Guadalupe Patroness of America and asked that December 12 be kept throughout the continent.\n\nRanks differ by calendar, and the difference is worth knowing. In the General Roman Calendar the celebration is an optional memorial; in the dioceses of Mexico it is a solemnity; in the dioceses of the United States it is a feast, celebrated in white with proper prayers even though it falls within Advent. It is not a holy day of obligation in the United States.\n\nThe customs of the day are among the most vivid in the Church: the mañanitas sung before dawn, processions with the image, dancing before the shrine in the ancient manner, and the pilgrimage of families and parishes. The Directory on Popular Piety and the Liturgy speaks with warmth of such expressions of Marian devotion among peoples who have made the faith their own, asking only that they remain joined to the liturgy and open to the whole of Christian life.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "optional-memorial-our-lady-of-mount-carmel",
    title: "Optional Memorial of Our Lady of Mount Carmel",
    kind: "optional_memorial",
    rank: "optional_memorial",
    season: "ordinary_time",
    feastDate: "07-16",
    summary:
      "July 16 honors the Blessed Virgin Mary under the title given her by the Carmelite Order, whose life of contemplation began among the hermits of Mount Carmel in the Holy Land.",
    body: "Mount Carmel, the ridge above the plain of Israel where the prophet Elijah confronted the prophets of Baal, drew Latin hermits during the era of the Crusades. Early in the thirteenth century they received a rule of life from Saint Albert, the Latin Patriarch of Jerusalem, and dedicated their chapel to the Mother of God; from that dedication they came to be known as the Brothers of the Blessed Virgin Mary of Mount Carmel. When they were driven from the Holy Land they carried the observance to Europe, and the celebration of July 16, kept in the Order from the fourteenth century, was extended to the whole Latin Church in the eighteenth.\n\nThe Carmelite tradition understands Mary as the model of the contemplative life: the woman who heard the word of God and kept it, whose whole existence was ordered to her Son. Saint Teresa of Ávila and Saint John of the Cross, who reformed the Order in sixteenth-century Spain, and Saint Thérèse of Lisieux and Saint Teresa Benedicta of the Cross in later centuries, all belong to this family and shaped Catholic spirituality far beyond it.\n\nThe brown scapular of Our Lady of Mount Carmel is the best-known devotion of the day. It is a small version of the Carmelite habit, given at enrollment, and the Church presents it as a sign of belonging to Mary and of the intention to imitate her. The Directory on Popular Piety and the Liturgy insists that the scapular be understood as an outward sign of a real interior commitment, and warns against treating any sacramental as though it worked automatically or dispensed the wearer from conversion, the sacraments, and the moral life.\n\nAs an optional memorial the celebration may be chosen or the weekday kept in its place. White vestments are used; the Gospel offered is the scene at Cana or the words of Jesus about those who do the will of his Father.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "memorial-holy-guardian-angels",
    title: "Memorial of the Holy Guardian Angels",
    kind: "memorial",
    rank: "memorial",
    season: "ordinary_time",
    feastDate: "10-02",
    summary:
      "October 2 gives thanks for the angels whom God assigns to watch over each person, a truth the Church has always held and expressed in her prayer.",
    body: "Scripture speaks often of angels sent to guard and guide: the angel who leads Israel in the Exodus, Raphael who accompanies Tobiah, the angel who frees Peter from prison, and above all the Lord's own warning not to despise the little ones, for their angels in heaven always look upon the face of his Father. The Catechism of the Catholic Church states the Church's belief plainly: from infancy to death human life is surrounded by the watchful care and intercession of angels, and each of the faithful has beside him an angel as protector and shepherd leading him to life.\n\nA distinct celebration of the guardian angels appeared in Spain and elsewhere in the sixteenth century, was approved for local use by Pope Paul V in 1608, and was extended to the whole Church on October 2 by Pope Clement X in 1670. The date places it immediately after the Feast of the Holy Archangels Michael, Gabriel, and Raphael on September 29, so that the two celebrations together cover the Church's honoring of the angelic world. It is an obligatory memorial, celebrated in white.\n\nThe brief prayer beginning \"Angel of God, my guardian dear\" is among the first that Catholic children learn, and the memorial is a natural day for parents and catechists to teach it. The Church is careful, here as always, to keep the distinction that governs all such devotion: angels are creatures and are venerated, never adored; worship belongs to God alone, who created them and sends them. The Directory on Popular Piety and the Liturgy commends devotion to the angels while cautioning against curiosity about their names or private communications, which has no basis in Scripture or in the Church's tradition.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "optional-memorial-most-holy-name-of-jesus",
    title: "Optional Memorial of the Most Holy Name of Jesus",
    kind: "optional_memorial",
    rank: "optional_memorial",
    season: "christmas",
    feastDate: "01-03",
    associatedSaintSlugs: ["saint-bernardine-of-siena"],
    summary:
      "Kept on January 3 within the Christmas Season, this optional memorial honors the name given to the Son of God at his circumcision, the name at which every knee should bend.",
    body: "The name was given before the child was conceived. The angel told Joseph to call him Jesus, which means God saves, for he would save his people from their sins, and the name was bestowed on the eighth day according to the Law. The Acts of the Apostles insists there is no other name under heaven given to men by which we must be saved, and Saint Paul's hymn to the Philippians proclaims that at the name of Jesus every knee should bend in heaven, on earth, and under the earth.\n\nDevotion to the Holy Name flourished in the later Middle Ages, above all through the preaching of Saint Bernardine of Siena and his Franciscan brethren, who displayed the monogram IHS, drawn from the first letters of the name in Greek. A feast of the Holy Name was granted to the Franciscans in the early sixteenth century and extended to the universal Church by Pope Innocent XIII in 1721. It was removed from the general calendar in the revision of 1969, when its content was seen as already present in the Solemnity of Mary, Mother of God on January 1, and was restored as an optional memorial on January 3 in the third edition of the Roman Missal published in 2002.\n\nBecause it is an optional memorial within the Christmas Season, it may be celebrated or the weekday of Christmastide kept instead. White vestments are worn and the Missal provides proper prayers. Related customs include the Litany of the Holy Name, the practice of bowing the head at the name of Jesus, and the reverence for the name enjoined by the second commandment, which the Catechism treats as an obligation of praise rather than merely a prohibition of blasphemy.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "optional-memorial-most-holy-name-of-mary",
    title: "Optional Memorial of the Most Holy Name of the Blessed Virgin Mary",
    kind: "optional_memorial",
    rank: "optional_memorial",
    season: "ordinary_time",
    feastDate: "09-12",
    summary:
      "September 12, four days after the Nativity of Mary, honors her name, as a child's naming follows shortly upon birth.",
    body: "The placing of the celebration is a small piece of liturgical craftsmanship. The Nativity of the Blessed Virgin Mary is kept on September 8; the honoring of her name falls on September 12, in the same relation as the naming of a child to the child's birth. The name Mary, Miriam in Hebrew, was borne by the sister of Moses and was common in first-century Galilee; Christian writers have offered many interpretations of it, and the Church has never settled on one, so the day honors the person the name designates rather than an etymology.\n\nThe celebration began in Spain in the late fifteenth century and was extended to the universal Church by Pope Innocent XI in 1683, in thanksgiving for the deliverance of Vienna from the siege of that year. Like the Holy Name of Jesus it was dropped from the general calendar in 1969 and restored as an optional memorial in the third edition of the Roman Missal in 2002, a pair of restorations that reflected the continued vitality of both devotions among the faithful.\n\nAs an optional memorial in Ordinary Time it may be chosen freely; white vestments are used and the Missal provides its own collect, with readings taken from the common of the Blessed Virgin Mary. Reverence for Mary's name belongs to the wider devotion the Church expresses in the Hail Mary, in the Litany of Loreto, and in the many titles under which she is invoked, all of which, as the Second Vatican Council teaches in Lumen gentium, are directed to Christ and take nothing from the unique mediation of the one Redeemer.",
    citations: [USCCB_CALENDAR, LUMEN_GENTIUM],
  }),
  liturgical({
    slug: "optional-memorial-our-lady-of-fatima",
    title: "Optional Memorial of Our Lady of Fatima",
    kind: "optional_memorial",
    rank: "optional_memorial",
    season: "easter",
    feastDate: "05-13",
    summary:
      "May 13 recalls the first of the 1917 apparitions of the Blessed Virgin Mary to three shepherd children at Fatima in Portugal, with its call to prayer, penance, and conversion.",
    body: "Between May and October of 1917, at the Cova da Iria near Fatima, three children — Lucia dos Santos and her cousins Francisco and Jacinta Marto — reported six apparitions of a lady who asked for the daily Rosary, for prayer and sacrifice for the conversion of sinners, and for devotion to her Immaculate Heart. The events took place while the First World War was consuming Europe, and the message is inseparable from that setting. The bishop of Leiria declared the apparitions worthy of belief in 1930 after thirteen years of investigation.\n\nThe Church's judgment on Fatima follows the rule that governs all private revelation. Such revelations, as the Catechism teaches, do not belong to the deposit of faith and cannot correct or complete it; their role is to help the faithful live the Gospel more fully at a given moment. What Fatima asks is nothing new: repentance, the Rosary, the Eucharist, and trust in God's mercy. Francisco and Jacinta Marto, who died young in the influenza epidemic, were canonized in 2017 on the centenary of the apparitions.\n\nSaint John Paul II had a particular attachment to the shrine after the attempt on his life in Saint Peter's Square on May 13, 1981, and he returned to Fatima in thanksgiving. The optional memorial was inserted into the General Roman Calendar in the third edition of the Roman Missal in 2002. Depending on the year the date usually falls in the Easter Season, and where it is celebrated white vestments are worn with prayers from the common of the Blessed Virgin Mary. The Directory on Popular Piety and the Liturgy asks that pilgrimage and Marian devotion of this kind always lead back to the sacraments and to charity, which are the ordinary paths of holiness.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "memorial-presentation-of-the-blessed-virgin-mary",
    title: "Memorial of the Presentation of the Blessed Virgin Mary",
    kind: "memorial",
    rank: "memorial",
    season: "ordinary_time",
    feastDate: "11-21",
    summary:
      "November 21 celebrates the offering of the child Mary to God, a memorial that honors her total consecration to the Lord from the beginning of her life.",
    body: "The celebration has an unusual history, and honesty about it is part of understanding it. The narrative of Mary being brought to the Temple as a small child and presented to God comes not from the canonical Gospels but from the second-century apocryphal writing known as the Protoevangelium of James. The Church has never proposed that account as historical fact. What the liturgy celebrates is what the story expresses and what the Church holds with certainty: that the Mother of God was set apart for the Lord from the beginning and gave herself wholly to his will.\n\nThe date is anchored in something concrete. On November 21, 543, a church dedicated to Saint Mary the New was consecrated in Jerusalem near the site of the Temple, and the anniversary was kept in the East as a Marian celebration. It reached the papal court at Avignon in 1372 through the influence of a diplomat from Cyprus, and Pope Sixtus V extended it to the whole Latin Church in 1585. The revised calendar retains it as an obligatory memorial, celebrated in white.\n\nThe Gospel offered is the Lord's word that whoever does the will of his Father is his brother and sister and mother, which sets the memorial exactly where it belongs: Mary's greatness lies in her obedience of faith. Since 1953 the day has been widely observed as Pro Orantibus Day, a day of prayer and support for contemplative religious, whose enclosed life mirrors the hidden self-offering the memorial celebrates. Many communities of nuns and monks renew their vows on this day.",
    citations: [USCCB_CALENDAR, USCCB_ORDINARY_TIME],
  }),
  liturgical({
    slug: "memorial-saints-joachim-and-anne",
    title: "Memorial of Saints Joachim and Anne, Parents of the Blessed Virgin Mary",
    kind: "memorial",
    rank: "memorial",
    season: "ordinary_time",
    feastDate: "07-26",
    associatedSaintSlugs: ["saint-anne"],
    summary:
      "July 26 honors the parents of the Blessed Virgin Mary, the grandparents of Jesus in the flesh, and with them all who hand on the faith within a family.",
    body: "Nothing is known of Mary's parents from the New Testament. Their names, Joachim and Anne, come from the second-century apocryphal Protoevangelium of James, and the Church has always been clear that this is the source. The veneration nevertheless rests on something certain: Mary had a father and a mother who raised her in the faith of Israel, and through them the promise made to Abraham reached the moment of its fulfillment.\n\nDevotion to Saint Anne appears in the Christian East by the sixth century and became widespread in the medieval West, where she was among the most beloved of saints, patroness of mothers, of women in labor, and of miners and cabinetmakers. Her celebration was fixed on July 26 in the Roman calendar under Pope Gregory XIII in 1584. Saint Joachim was honored on various dates over the centuries; the calendar reform of 1969 joined the two in a single obligatory memorial on July 26, which is how the Roman Rite keeps them today. White vestments are used, and the Gospel offered is the Lord's word to his disciples that many prophets and righteous people longed to see what they see.\n\nIn 2021 Pope Francis instituted the World Day for Grandparents and the Elderly, observed on the fourth Sunday of July, near this memorial and deliberately tied to it. The pairing gives the day a pastoral shape: parishes visit the homebound elderly, honor grandparents at Mass, and pray for families in which faith is handed down across generations. The great shrines of Sainte-Anne-de-Beaupré in Quebec and Sainte-Anne-d'Auray in Brittany draw pilgrims around this date, and the memorial has long been a favorite of Catholic families praying for children.",
    citations: [USCCB_CALENDAR, USCCB_ORDINARY_TIME],
  }),
  liturgical({
    slug: "optional-memorial-saint-joseph-the-worker",
    title: "Optional Memorial of Saint Joseph the Worker",
    kind: "optional_memorial",
    rank: "optional_memorial",
    season: "easter",
    feastDate: "05-01",
    associatedSaintSlugs: ["saint-joseph"],
    associatedReadings: ["Matthew 13:54-58"],
    summary:
      "May 1 honors Saint Joseph the carpenter as the patron of workers, placing the dignity of human labor under the protection of the man who taught Jesus a trade.",
    body: "Pope Pius XII instituted this celebration in 1955 and assigned it to May 1, the day widely observed as a workers' holiday. The intention was not to compete with that observance but to give it a Christian foundation: labor is not merely an economic transaction or a field of class conflict but a share in the Creator's work and a means of sanctification. The Church's social teaching, from Leo XIII's Rerum novarum through Saint John Paul II's Laborem exercens, develops this at length, insisting on the priority of the worker over the work and on the right to just wages, rest, and association.\n\nJoseph is the natural patron for such a day. The Gospel of Matthew records the astonishment of the people of Nazareth: is this not the carpenter's son? The Greek word describes a craftsman working in wood and stone, and it is the only trade the New Testament attaches to the household in which Jesus grew up. For roughly thirty years the Son of God worked with his hands under Joseph's instruction, which is why the Church can say that ordinary labor has been taken into the mystery of redemption.\n\nThe celebration is an optional memorial, and it usually falls within the Easter Season; white vestments are worn and the Missal provides proper prayers, with the Gospel of the carpenter's son. Because it is optional, the Easter weekday may be kept instead. Related customs include the blessing of tools and workplaces, prayers for the unemployed, and the observance of May as the month of Mary alongside it. Saint Joseph is also honored on March 19 as Spouse of the Blessed Virgin Mary, which is his principal celebration and a solemnity of the General Roman Calendar.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "optional-memorial-dedication-of-the-basilica-of-saint-mary-major",
    title: "Optional Memorial of the Dedication of the Basilica of Saint Mary Major",
    kind: "optional_memorial",
    rank: "optional_memorial",
    season: "ordinary_time",
    feastDate: "08-05",
    summary:
      "August 5 keeps the anniversary of the dedication of the great Roman basilica of Saint Mary Major, the oldest church in the West dedicated to the Mother of God.",
    body: "Rome has four papal basilicas, and the Church marks the dedication of each. Saint Mary Major stands on the Esquiline Hill and was built or rebuilt by Pope Sixtus III in the years just after the Council of Ephesus of 431, which had defined that Mary is truly Theotokos, the Mother of God. Its fifth-century mosaics, among the oldest Marian images in Christian art, proclaim that definition in stone and glass. The basilica houses the venerated icon known as Salus Populi Romani, before which popes and pilgrims have prayed for centuries, and it preserves relics honored as belonging to the manger of Bethlehem.\n\nA later medieval legend gave the day its popular name. It tells of a Roman patrician and of Pope Liberius, both directed in a dream to build a church where snow would fall in August, and of a miraculous snowfall on the Esquiline on August 5. The Church has never proposed the story as history; it is remembered in the Roman custom of letting white petals fall from the basilica's ceiling during the liturgy of the day. For a period the celebration was called Our Lady of the Snows, and the revised calendar restored its proper title, the Dedication of the Basilica of Saint Mary Major.\n\nThe celebration is an optional memorial in the General Roman Calendar, celebrated in white with proper prayers. Anniversaries of dedication of churches are more than architectural commemorations: the rite of dedication treats the building as a sign of the Church herself, the living temple built of the faithful, and the annual celebration renews that meaning. In the church of its own dedication the anniversary is kept as a solemnity, and in the diocese the anniversary of the cathedral's dedication is kept as a feast.",
    citations: [USCCB_CALENDAR, USCCB_ORDINARY_TIME],
  }),
  liturgical({
    slug: "rite-of-marriage",
    title: "The Order of Celebrating Matrimony",
    kind: "marriage_rite",
    rank: "n/a",
    season: "n/a",
    summary:
      "The liturgical book and rite by which a baptized man and woman exchange consent before the Church, entering the covenant that Christ has raised to the dignity of a sacrament.",
    body: "The current ritual is the second typical edition of the Ordo celebrandi Matrimonium, published in 1990; the English translation for the dioceses of the United States, The Order of Celebrating Matrimony, came into use on the Feast of the Holy Family in December 2016. It provides three orders of service: the celebration of matrimony within Mass, the celebration without Mass, and the celebration between a Catholic and a catechumen or a non-Christian. The choice depends on the situation of the couple, and the Church does not treat a wedding outside Mass as a lesser event.\n\nIn the Latin Church the spouses themselves are the ministers of the sacrament; the priest or deacon assists, asks for and receives their consent in the name of the Church, and gives the Church's blessing. Consent is what makes the marriage — a free, unconditional, and public act of the will by which the two give and accept each other for life. Canon law therefore requires the canonical form: consent exchanged before the local Ordinary or pastor or a delegated priest or deacon, and before two witnesses, unless a dispensation has been granted.\n\nThe structure follows the Mass. After the Introductory Rites, in which the couple may be received at the door or accompanied in procession, comes the Liturgy of the Word, with readings the couple may choose from an ample selection. The Celebration of Matrimony follows the homily: the questions before the consent, concerning freedom, faithfulness, and the acceptance and Christian upbringing of children; the exchange of consent; the reception of the consent by the minister and the acclamation of the assembly; and the blessing and giving of rings. In the United States the ritual also provides for the blessing and giving of the arras, the coins, and for the lazo or veil where these are the custom of the families.\n\nWhen Mass follows, the Nuptial Blessing is prayed after the Lord's Prayer, and the Missal gives three forms of it. The blessing invokes the Holy Spirit upon the bride and groom and asks for fidelity, fruitfulness, and perseverance to the end of life. Marriage between two baptized persons is a sacrament and is by its nature ordered to the good of the spouses and to the procreation and education of children; a ratified and consummated sacramental marriage cannot be dissolved by any human power. Preparation for the celebration is a serious pastoral responsibility of the parish, and the couple's own catechesis and reception of the sacraments of penance and the Eucharist belong to it.",
    citations: [CANON_LAW_ORDERS_AND_MARRIAGE, USCCB_LITURGICAL_YEAR, GIRM],
  }),
  liturgical({
    slug: "order-of-christian-funerals",
    title: "The Order of Christian Funerals",
    kind: "funeral_rite",
    rank: "n/a",
    season: "n/a",
    summary:
      "The Church's rites for the dead, in which she commends the deceased to God's mercy, comforts the mourners, and proclaims the hope of resurrection given in baptism.",
    body: "The Order of Christian Funerals, the ritual book in use in the dioceses of the United States since 1989, arranges the Church's prayer around three principal moments. The Vigil for the Deceased is celebrated in the days between death and the funeral, often at the funeral home or in the church, and consists of a liturgy of the word with prayer and, by custom, remembrances and the Rosary. The Funeral Liturgy — ordinarily the Funeral Mass — is the central celebration. The Rite of Committal is celebrated at the grave or place of interment and concludes the rites. The book also provides related prayers: prayers after death, gathering in the presence of the body, and the transfer of the body to the church.\n\nThe Funeral Mass is shaped throughout by baptism. The body is received at the door of the church, sprinkled with holy water, and covered with the white pall, both signs of the baptismal garment; the Paschal candle, lit at the Easter Vigil, is placed near the coffin. Only Christian symbols may rest on the coffin — a Book of the Gospels, a Bible, or a cross. The homily is preached on the Christian mystery of death and resurrection and is never a eulogy; where a member of the family or a friend wishes to speak in remembrance, the ritual places that briefly before the Final Commendation. That rite concludes the Mass with the song of farewell, the sprinkling with holy water, and the incensation of the body, a last honoring of a temple of the Holy Spirit.\n\nWhite, violet, or black vestments may be worn; white has become common in the United States as the color of the resurrection. The readings are chosen from a wide selection in the Lectionary that speak of consolation, judgment, and the promise of eternal life. The Church offers the Mass for the deceased because she believes prayer avails for those who have died and are still being purified, and this conviction, not sentiment, is what makes the funeral liturgy an act of charity.\n\nThe Church permits cremation and prefers that, where possible, the funeral rites be celebrated with the body present and cremation follow. When the cremated remains are present, they are treated with the same reverence as the body: they are to be buried in a cemetery or entombed in a sacred place, and they may not be scattered, divided among family members, or kept in a private home. Pastoral care of the bereaved does not end at the cemetery; the ministry of consolation, which the ritual describes as belonging to the whole community, continues in the weeks and months that follow.",
    citations: [CANON_LAW_FUNERALS, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "rites-of-ordination",
    title: "The Rites of Ordination of a Bishop, of Priests, and of Deacons",
    kind: "ordination_rite",
    rank: "n/a",
    season: "n/a",
    summary:
      "The liturgy by which a bishop, through the laying on of hands and the prayer of consecration, confers one of the three degrees of the sacrament of Holy Orders.",
    body: "Holy Orders is conferred in three degrees — episcopate, presbyterate, and diaconate — and the ritual book provides an order of celebration for each. Only a validly ordained bishop can ordain, and for the ordination of a bishop the tradition asks that three bishops take part; a papal mandate must be read before an episcopal ordination can proceed. Ordinations take place within Mass, ordinarily in the cathedral, on a Sunday or feast when the people can be present, since the whole local Church receives the new minister.\n\nThe rite unfolds after the Gospel. The candidates are called by name and presented; the bishop asks whether they have been found worthy and, hearing the testimony, elects them, and the people give their assent. The homily follows, then the examination of the candidates concerning their intention and their willingness to fulfill the office, and the promise of obedience made with the candidate's hands in the hands of the bishop. All then pray the Litany of Supplication — the Litany of the Saints — while the candidates lie prostrate on the floor, a moment that expresses better than any words that the office is received and not achieved.\n\nThe essential rite is brief and silent: the bishop lays his hands upon the head of each candidate, and then prays the Prayer of Ordination proper to the degree being conferred. In the ordination of priests all priests present also lay on hands, and in the ordination of a bishop all bishops present do so while the Book of the Gospels is held open above the head of the one being ordained. The sacrament confers an indelible character and cannot be repeated.\n\nExplanatory rites follow and make visible what has been given. A new deacon is vested with the stole worn across the chest and the dalmatic and receives the Book of the Gospels, with the charge to believe what he reads and teach what he believes. A new priest is vested with stole and chasuble, his palms are anointed with sacred chrism, and he receives the paten with the bread and the chalice with the wine for the offering of the people. A new bishop is anointed on the head with chrism and receives the Book of the Gospels, the ring, the mitre, and the pastoral staff, and is seated in the cathedra if it is his own diocese. Each ordination concludes with the fraternal kiss of the order into which the newly ordained has been received.",
    citations: [LUMEN_GENTIUM, CANON_LAW_ORDERS_AND_MARRIAGE, GIRM],
  }),
  liturgical({
    slug: "rite-of-baptism-for-children",
    title: "The Rite of Baptism for Children",
    kind: "mass_structure",
    rank: "n/a",
    season: "n/a",
    summary:
      "The order of celebration by which infants and young children are baptized, freed from original sin, made children of God, and incorporated into the Church.",
    body: "The Rite of Baptism for Children was published in 1969 as one of the first fruits of the liturgical reform called for by the Second Vatican Council, and it was designed with the actual situation of a family in mind: parents and godparents speak throughout, and the ceremony assumes that the child's faith will be carried by the household and the parish until the child can profess it personally. Canon law asks that infants be baptized within the first weeks after birth, and that the celebration take place in the parish church, preferably on a Sunday or at the Easter Vigil, and when possible with several children together.\n\nThe rite has four parts. In the Reception of the Children the minister asks the name chosen, what the parents ask of the Church for their child, and whether parents and godparents understand what they are undertaking; he then traces the sign of the cross on the child's forehead and invites them to do the same, claiming the child for Christ. The Celebration of God's Word follows, with readings, a homily, intercessions, the invocation of the saints, a prayer of exorcism, and the anointing with the oil of catechumens or the laying on of hands.\n\nAt the font the water is blessed, or blessed water from the Easter Vigil is used with a prayer of thanksgiving. Parents and godparents renounce sin and profess the faith of the Church in the words of the Apostles' Creed, and the celebrant asks whether it is their will that the child be baptized in that faith. The child is then baptized by immersion or by pouring water three times on the head while the minister says: \"N., I baptize you in the name of the Father, and of the Son, and of the Holy Spirit.\" That form and the washing with water are the essentials; anyone, even an unbaptized person, may baptize in danger of death using them with the intention of doing what the Church does.\n\nThe explanatory rites follow: anointing with sacred chrism on the crown of the head, signifying the share in Christ's priestly, prophetic, and kingly office; the clothing with the white garment; and the giving of a candle lit from the Paschal candle to the father or godparent, with the charge to keep the flame of faith alive. The Ephphetha, the touching of ears and mouth, may be added. All then go to the altar to pray the Lord's Prayer, and the rite closes with a blessing of the mother, the father, and the whole assembly. The ordinary ministers are bishop, priest, and deacon. At least one godparent is required, a confirmed and practicing Catholic at least sixteen years of age; a baptized non-Catholic may take part as a Christian witness alongside a Catholic godparent.",
    citations: [CANON_LAW_BAPTISM, SACROSANCTUM_CONCILIUM],
  }),
  liturgical({
    slug: "rite-of-confirmation",
    title: "The Rite of Confirmation",
    kind: "mass_structure",
    rank: "n/a",
    season: "n/a",
    summary:
      "The rite by which the baptized are sealed with the Gift of the Holy Spirit through the laying on of hands and anointing with sacred chrism, ordinarily by the bishop.",
    body: 'Pope Saint Paul VI promulgated the revised rite in the apostolic constitution Divinae consortium naturae in 1971. That document settled a long-debated question by declaring the essential rite of Confirmation to be the anointing with sacred chrism on the forehead, done by the laying on of the hand, with the words: "Be sealed with the Gift of the Holy Spirit." The sacrament completes baptismal grace, roots the confirmed more deeply in divine sonship, strengthens the bond with the Church, and gives a special strength of the Holy Spirit to spread and defend the faith. Like baptism and orders it imprints an indelible character and is received only once.\n\nThe celebration ordinarily takes place within Mass, so that the connection between the three sacraments of initiation is clear. After the Gospel the candidates are presented, sometimes by name; the bishop preaches and then asks the candidates to renew the promises made at their baptism, renouncing sin and professing the faith. He extends his hands over all of them and prays that God send the Holy Spirit upon them with the sevenfold gift — wisdom and understanding, counsel and fortitude, knowledge and piety, and the fear of the Lord. Each candidate then comes forward with a sponsor, and the bishop dips his thumb in the chrism, traces the cross on the forehead, and says the words of the form, adding, "Peace be with you."\n\nThe bishop is the ordinary minister, a sign of the confirmed person\'s bond with the apostolic Church and with the diocese. A priest confirms by law when he baptizes an adult or receives a baptized Christian into full communion, and when he baptizes a child old enough for catechesis; he may also receive the faculty from the bishop or from law in danger of death. The sacred chrism itself, olive oil mixed with balsam, is consecrated by the bishop at the Chrism Mass in Holy Week and distributed to the parishes of the diocese.\n\nA sponsor is required and it is desirable that one of the baptismal godparents serve, again to show the unity of initiation; the sponsor must be a confirmed, practicing Catholic. The choice of a confirmation name is a custom rather than a requirement of the rite. Practice as to age varies legitimately: in the Latin Church in the United States the diocesan bishop determines the age, and in some dioceses Confirmation is celebrated in the restored order, before First Communion, while in the Eastern Catholic Churches chrismation is conferred with baptism in infancy.',
    citations: [CANON_LAW_CONFIRMATION_EUCHARIST, SACROSANCTUM_CONCILIUM],
  }),
  liturgical({
    slug: "ocia-scrutinies-and-the-easter-vigil-sacraments",
    title: "The Order of Christian Initiation of Adults: Scrutinies and the Easter Vigil",
    kind: "mass_structure",
    rank: "n/a",
    season: "lent",
    movableFeast: true,
    associatedReadings: ["John 4:5-42", "John 9:1-41", "John 11:1-45"],
    summary:
      "The Church's process for initiating adults, whose Lenten scrutinies purify the elect and whose goal is the celebration of Baptism, Confirmation, and the Eucharist at the Easter Vigil.",
    body: "The Second Vatican Council asked that the catechumenate of the early Church be restored, and the resulting ritual — known in English as the Order of Christian Initiation of Adults, formerly the Rite of Christian Initiation of Adults — governs how an unbaptized adult becomes a Catholic. It is not a course of instruction with a ceremony at the end but a gradual journey in four periods marked by three liturgical steps.\n\nThe period of evangelization and precatechumenate is a time of inquiry and first conversion. The first step, the Rite of Acceptance into the Order of Catechumens, admits inquirers as catechumens, who are henceforth joined to the Church and have a right to Christian burial. The period of the catechumenate follows, with catechesis, participation in the Liturgy of the Word, celebrations of the word, minor exorcisms and blessings, and formation in the Christian life. The second step, the Rite of Election or Enrollment of Names, is normally celebrated by the diocesan bishop at the cathedral on the First Sunday of Lent; from that point the catechumens are called the elect.\n\nThe period of purification and enlightenment coincides with Lent, and its distinctive rites are the three scrutinies, celebrated at Mass on the Third, Fourth, and Fifth Sundays of Lent. Each consists of intercessions for the elect, an exorcism prayer, and a laying on of hands, and each asks God to uncover and heal whatever is weak in them and to strengthen what is good. The Gospels proper to the scrutinies are the three great Johannine readings of Year A — the Samaritan woman at the well, the man born blind, and the raising of Lazarus — and these may be read in Years B and C as well when the scrutinies are celebrated, because water, light, and life are precisely what the elect are about to receive. In the same weeks the Church presents to them the Creed and the Lord's Prayer.\n\nThe third step is the celebration of the sacraments of initiation at the Easter Vigil: the elect are baptized at the font blessed in the same liturgy, confirmed by the celebrant, who has the faculty by law, and receive the Eucharist for the first time in that Mass. Baptized Christians seeking full communion with the Catholic Church are in a different situation and are never rebaptized; they make a profession of faith and are received, then confirmed and admitted to the Eucharist, and the ritual provides combined rites where a parish has both catechumens and candidates. The period of mystagogy through the Easter Season completes the process, as the newly initiated — the neophytes — deepen their understanding of the mysteries they have now received and take their place in the life and mission of the parish.",
    citations: [SACROSANCTUM_CONCILIUM, USCCB_TRIDUUM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "exposition-and-benediction-of-the-blessed-sacrament",
    title: "Exposition and Benediction of the Blessed Sacrament",
    kind: "mass_structure",
    rank: "n/a",
    season: "n/a",
    summary:
      "The rite in which the Eucharist is exposed for adoration and the assembly is blessed with the Blessed Sacrament, an extension of the worship offered in the Mass.",
    body: 'The rite is set out in the ritual book Holy Communion and Worship of the Eucharist outside Mass, published in 1973. Its opening principle governs everything else: eucharistic adoration flows from the Mass and leads back to it, since the Sacrament is reserved above all so that it may be given to the sick and the dying, and adoration of the reserved Sacrament grows from that reservation. Exposition is therefore never a rival to the Mass but a prolonging of the communion received in it.\n\nExposition may be made with the monstrance or with the ciborium. The Sacrament is placed on the altar, incense is used when the monstrance is exposed, and candles are lit — at least four, and customarily six, for exposition in the monstrance. The time of adoration should include readings from Scripture, silence, songs, and prayers, so that the faithful are nourished by the word as well as by contemplation; the Liturgy of the Hours may be celebrated before the exposed Sacrament. Mass may not be celebrated in the same part of the church while exposition is taking place, and exposition is not to be held merely in order to give benediction.\n\nBenediction concludes a period of exposition. The minister, wearing a cope and a humeral veil, incenses the Sacrament while a eucharistic hymn is sung — traditionally Tantum Ergo, the last two verses of Saint Thomas Aquinas\'s Pange Lingua, with O Salutaris Hostia often sung at the beginning of exposition. The versicle "You have given them bread from heaven" and its response are followed by the collect. Then, in silence, the minister takes the monstrance and makes the sign of the cross over the people with it; the blessing is given by Christ himself, and this is why nothing is said. The Sacrament is then reposed in the tabernacle, and in many places the Divine Praises are recited and a hymn is sung.\n\nA priest or deacon presides at exposition and gives the blessing. An instituted acolyte, an extraordinary minister of Holy Communion, or another person deputed by the local Ordinary may expose and repose the Sacrament in the absence of a priest or deacon, but may not give the blessing. Where a community is able to sustain it, perpetual adoration or the Forty Hours devotion may be established, and the Church encourages these while asking that they always keep their link to the Mass and to charity toward the poor.',
    citations: [REDEMPTIONIS_SACRAMENTUM, DIRECTORY_POPULAR_PIETY, GIRM],
  }),
  liturgical({
    slug: "structure-of-the-liturgy-of-the-hours",
    title: "The Structure of the Liturgy of the Hours",
    kind: "mass_structure",
    rank: "n/a",
    season: "n/a",
    summary:
      "The public prayer of the Church that sanctifies the whole course of day and night, composed of psalms, Scripture, hymns, and intercessions distributed across the hours.",
    body: "The Second Vatican Council's constitution on the liturgy calls the Divine Office the prayer of Christ with his Body to the Father: when the Church prays the psalms, it is Christ himself who continues his priestly work through her, and the hours of the day are consecrated by the praise of God. Saint Paul VI promulgated the revised Liturgy of the Hours in 1970 in the apostolic constitution Laudis canticum, which distributed the one hundred fifty psalms over a four-week cycle and restored a rich selection of biblical and patristic readings.\n\nThe office has five hours. The Office of Readings may be prayed at any time and offers a longer passage of Scripture with a reading from the Fathers, the saints, or a Church document. Morning Prayer and Evening Prayer are the two hinges on which the daily office turns, the Council says, and they are the hours most suited to celebration with a parish congregation. Daytime Prayer may be prayed once or, in monastic use, three times as Midmorning, Midday, and Midafternoon Prayer. Night Prayer closes the day before sleep.\n\nThe hours share a common shape: an introductory versicle, a hymn, psalmody, a reading with a responsory, and a concluding prayer. Morning and Evening Prayer add a Gospel canticle with its antiphon — the Benedictus of Zechariah in the morning and the Magnificat of Mary in the evening — followed by intercessions and the Lord's Prayer. Night Prayer includes an examination of conscience, the canticle of Simeon, and one of the Marian antiphons, such as the Salve Regina or, in Eastertide, the Regina Caeli. The texts change with the seasons and with the celebrations of the calendar; on solemnities there is a first Evening Prayer on the preceding day.\n\nBishops, priests, and deacons preparing for priesthood are bound to pray the whole office daily; permanent deacons are bound to the portion determined by their conference of bishops, and religious according to their own constitutions. The Council warmly encouraged the laity to pray the Hours, alone, in families, or with a parish community, and the availability of the office in print and in electronic form has made this far easier. Praying Morning and Evening Prayer in a parish, especially on Sundays and in Advent and Lent, is one of the simplest ways to recover the Church's own daily prayer.",
    citations: [SACROSANCTUM_CONCILIUM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "eucharistic-prayers-of-the-roman-missal",
    title: "The Eucharistic Prayers of the Roman Missal",
    kind: "mass_structure",
    rank: "n/a",
    season: "n/a",
    summary:
      "The great prayer of thanksgiving and consecration at the center of the Mass, of which the Roman Missal offers four principal forms together with others for particular occasions.",
    body: "The General Instruction of the Roman Missal calls the Eucharistic Prayer the center and high point of the entire celebration: a prayer of thanksgiving and sanctification in which the whole congregation joins itself with Christ in confessing the great works of God and offering the sacrifice. The priest alone says it, in the person of Christ the head, while the people take part through the acclamations and above all through the great Amen at the end. All listen in reverent silence.\n\nThe Instruction sets out its constant elements. Thanksgiving is expressed in the Preface; the acclamation is the Sanctus; the epiclesis calls down the Holy Spirit that the gifts may become the Body and Blood of Christ and that those who receive them may become one body; the Institution Narrative and Consecration repeat the Lord's words and actions at the Supper; the anamnesis recalls his Passion, Resurrection, and Ascension; the oblation offers the spotless Victim to the Father; the intercessions name the Pope, the bishop, the living and the dead, and the whole Church in heaven and on earth; and the final doxology, \"Through him, and with him, and in him,\" closes the prayer.\n\nEucharistic Prayer I is the Roman Canon, in substance the prayer of the Roman Church from at least the time of Saint Gregory the Great, with its lists of saints and its proper insertions on Christmas, Epiphany, Easter, the Ascension, and Pentecost. Eucharistic Prayer II is a shorter prayer modeled on a very ancient anaphora preserved in the Apostolic Tradition, with its own preface; its brevity suits weekdays. Eucharistic Prayer III was newly composed in the reform after the Council and may be used with any preface; it is especially suited to Sundays and feasts and contains a strong petition for the dead. Eucharistic Prayer IV, drawing on the style of the Eastern anaphoras, recounts the whole history of salvation in one sweep and has a fixed preface that may not be replaced.\n\nThe Missal also provides two Eucharistic Prayers for Reconciliation, valuable in Lent and at penitential celebrations, and the Eucharistic Prayer for Masses for Various Needs, which appears in four forms with different prefaces and intercessions. The priest may choose among these according to the day and the pastoral circumstances, following the rubrics; the texts themselves are never to be altered, since they are the Church's own profession of faith, not the celebrant's composition.",
    citations: [GIRM, REDEMPTIONIS_SACRAMENTUM],
  }),
  liturgical({
    slug: "the-roman-missal-third-edition",
    title: "The Roman Missal, Third Edition",
    kind: "mass_structure",
    rank: "n/a",
    season: "n/a",
    summary:
      "The liturgical book containing the prayers and rubrics for the celebration of Mass in the Roman Rite, in the Latin edition of 2002 and the English translation implemented in 2011.",
    body: 'The Missal is the priest\'s book at the altar and the Church\'s chief witness to how she prays. After the Second Vatican Council, Saint Paul VI promulgated a revised Roman Missal in 1970, with a second Latin edition in 1975. Saint John Paul II approved a third Latin typical edition in 2000, published in 2002 and reprinted with emendations in 2008. It is this third edition that governs the celebration of Mass in the ordinary form of the Roman Rite today.\n\nThe English translation was prepared by the International Commission on English in the Liturgy according to the translation principles set out in the 2001 instruction Liturgiam authenticam, which called for a rendering closer to the structure and vocabulary of the Latin than the earlier translation had been. The conferences of bishops of the English-speaking world approved the text and the Congregation for Divine Worship confirmed it in 2010. It came into use in the dioceses of the United States on the First Sunday of Advent, November 27, 2011.\n\nThe book opens with the General Instruction of the Roman Missal, which explains the structure and theology of the Mass and gives the norms for its celebration, and with the Universal Norms on the Liturgical Year and the General Roman Calendar. It then contains the Proper of Time, following the seasons from Advent to the last week of Ordinary Time; the Order of Mass with the prefaces and Eucharistic Prayers; the Proper of Saints, arranged by date; the Commons, for celebrations of the Blessed Virgin Mary, martyrs, pastors, doctors, virgins, and holy men and women; Ritual Masses connected with the sacraments; Masses and Prayers for Various Needs and Occasions; Votive Masses; and Masses for the Dead, with appendices of chants, blessings, and rites.\n\nSeveral texts of the people\'s parts changed in 2011 and are now familiar: the response "And with your spirit," the threefold "through my fault" in the Confiteor, "consubstantial with the Father" in the Creed, "for many" in the words over the chalice, and "Lord, I am not worthy that you should enter under my roof" before Communion. Editions for particular countries include the proper calendar of that territory; the Missal used in the dioceses of the United States, for example, contains the celebrations proper to the United States alongside those of the General Roman Calendar.',
    citations: [GIRM, USCCB_CALENDAR, REDEMPTIONIS_SACRAMENTUM],
  }),
  liturgical({
    slug: "lectionary-cycles-and-the-order-of-readings",
    title: "The Lectionary: Sunday Cycles A, B, C and Weekday Cycles I and II",
    kind: "mass_structure",
    rank: "n/a",
    season: "n/a",
    summary:
      "The ordered arrangement of Scripture readings for Mass, which opens the treasures of the Bible more lavishly to the faithful across a three-year Sunday cycle and a two-year weekday cycle.",
    body: "The Second Vatican Council asked that the treasures of the Bible be opened up more lavishly so that a richer fare might be provided for the faithful at the table of God's word. The result was the Order of Readings for Mass, published in 1969 and revised in a second edition in 1981, which replaced the single annual cycle of the previous Missal with a far wider selection. The Lectionary used in the dioceses of the United States renders those readings in the New American Bible translation approved for liturgical use.\n\nSundays follow a three-year cycle. In Year A the Gospel of Matthew is read semi-continuously through Ordinary Time, in Year B the Gospel of Mark, and in Year C the Gospel of Luke; because Mark is the shortest, the sixth chapter of John, the discourse on the Bread of Life, is read in the summer of Year B. John is also read extensively in Lent and throughout the Easter Season in every year. The year is named for the calendar year in which it ends, and Year C falls in years whose number is divisible by three. Each Sunday has three readings: a first reading, usually from the Old Testament and chosen to harmonize with the Gospel, a responsorial psalm, and a second reading taken semi-continuously from the letters. During the Easter Season the first reading is taken from the Acts of the Apostles instead of the Old Testament.\n\nWeekdays in Ordinary Time follow a two-year cycle for the first reading and psalm — Year I in odd-numbered years and Year II in even-numbered years — while the Gospel is read on a single annual cycle, so that the same Gospel passage is heard on a given weekday in both years. In the seasons of Advent, Christmas, Lent, and Easter the weekday readings are proper to the season and are the same every year, chosen for the particular character of those days.\n\nSolemnities and feasts have their own proper readings, and the Commons supply readings for memorials that lack them, which is why a memorial is ordinarily celebrated with the weekday readings and only the prayers of the saint. The Lectionary also provides readings for the sacraments, for funerals, for ritual and votive Masses, and for Masses for various needs. Its arrangement is itself a form of catechesis: over three years a congregation that comes to Sunday Mass hears the essentials of the whole of Scripture, and the homily, which the Council calls part of the liturgy itself, is meant to open those texts for the assembly.",
    citations: [SACROSANCTUM_CONCILIUM, GIRM, USCCB_CALENDAR],
  }),
  liturgical({
    slug: "the-liturgical-year",
    title: "The Liturgical Year",
    kind: "liturgical_year",
    rank: "n/a",
    season: "n/a",
    summary:
      "The Church's yearly cycle, which unfolds the whole mystery of Christ from the Incarnation to Pentecost and to the expectation of his return, and sanctifies time itself.",
    body: "The Second Vatican Council describes what the liturgical year is for: within the cycle of a year the Church unfolds the whole mystery of Christ, from the Incarnation and Nativity to the Ascension, Pentecost, and the expectation of the blessed hope and the coming of the Lord. Recalling these mysteries opens to the faithful the riches of the Lord's power and merits, so that they are in some way made present in every age. The year is not a set of anniversaries but a way of being drawn into what Christ has done.\n\nSunday stands at its foundation. The Council calls the Lord's Day the original feast day, the weekly Easter on which the Church gathers to hear the word and celebrate the Eucharist; every other cycle is built around it. Above Sunday stands the Easter Triduum, the culmination of the entire year, and around the Triduum turns the paschal cycle: Lent prepares for it, the fifty days of the Easter Season prolong it to Pentecost. The Christmas cycle — Advent and the Christmas Season through the Baptism of the Lord — celebrates the Lord's coming in the flesh. Ordinary Time, thirty-three or thirty-four weeks in two portions, is devoted to the mystery of Christ in its fullness rather than to any single aspect of it.\n\nWoven through this temporal cycle is the sanctoral cycle, the celebrations of the saints. The Church honors them not to add to the worship due to God but because in them she sees the paschal mystery brought to completion, and in their feasts she proclaims what grace has done. The Blessed Virgin Mary is joined to her Son by an inseparable bond in this annual cycle, and her celebrations hold a special place. The Universal Norms on the Liturgical Year and the General Roman Calendar, published with the Roman Missal, govern how the two cycles fit together and which celebration takes precedence when they meet.\n\nThe year begins with Evening Prayer I of the First Sunday of Advent, which falls on the Sunday nearest November 30, and ends on the Saturday after the Solemnity of Our Lord Jesus Christ, King of the Universe. Colors mark the seasons: violet in Advent and Lent, white or gold at Christmas and Easter and on feasts of the Lord, of Mary, and of saints who were not martyrs, red on Passion days and at Pentecost and for martyrs and apostles, green in Ordinary Time, and rose where it is the custom on Gaudete and Laetare Sundays. Alongside the general calendar every nation, diocese, and religious order has its own proper calendar, so that the local Church's own saints and the anniversary of its cathedral's dedication take their place in the year.",
    citations: [SACROSANCTUM_CONCILIUM, USCCB_LITURGICAL_YEAR, USCCB_CALENDAR],
  }),
  liturgical({
    slug: "holy-days-of-obligation",
    title: "Holy Days of Obligation",
    kind: "glossary_term",
    rank: "n/a",
    season: "n/a",
    summary:
      "The days besides Sunday on which the faithful are bound to participate in Mass and to refrain from work that impedes worship; the list is set by universal law and adapted by each conference of bishops.",
    body: "The Code of Canon Law states that on Sundays and other holy days of obligation the faithful are bound to participate in the Mass and to abstain from those labors and business concerns that impede the worship to be rendered to God, the joy proper to the Lord's Day, or the suitable relaxation of mind and body. The obligation is satisfied by assisting at Mass wherever it is celebrated in a Catholic rite, either on the day itself or on the evening of the preceding day.\n\nUniversal law lists ten holy days besides Sunday: the Nativity of the Lord, the Epiphany, the Ascension, the Body and Blood of Christ, Mary the Mother of God, the Immaculate Conception, the Assumption, Saint Joseph, Saints Peter and Paul, and All Saints. The same canon allows a conference of bishops, with the prior approval of the Apostolic See, to suppress some of these or to transfer them to a Sunday, which is why the list a Catholic actually keeps depends on the country.\n\nIn the dioceses of the United States six days are observed: Mary, the Holy Mother of God on January 1; the Ascension of the Lord; the Assumption of the Blessed Virgin Mary on August 15; All Saints on November 1; the Immaculate Conception on December 8, the patronal feast of the United States; and the Nativity of the Lord on December 25. The Epiphany is transferred to the Sunday between January 2 and 8, and Corpus Christi to the Sunday after Trinity Sunday. The Ascension is transferred from Thursday to the Seventh Sunday of Easter in most ecclesiastical provinces of the country, while a number of provinces in the Northeast and one in the Midwest retain it on Thursday; the diocesan calendar states which applies.\n\nOne further adaptation is peculiar to the United States and often misunderstood. When January 1, August 15, or November 1 falls on a Saturday or a Monday, the obligation to attend Mass is lifted, though the solemnity itself is still celebrated. December 8 and December 25 always oblige. When December 8 falls on a Sunday of Advent the solemnity is transferred to Monday, December 9; the bishops publish guidance whenever this occurs, and the faithful should follow the direction given for that year. Anyone unable to attend for a serious reason, such as illness or the care of an infant, is excused, and the Church urges such persons to keep the day in prayer, with the Scriptures of the Mass, or by joining a broadcast liturgy, which does not satisfy the obligation but does sanctify the day.",
    citations: [CANON_LAW_SACRED_TIMES, USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "ranks-of-liturgical-celebrations",
    title: "The Ranks of Liturgical Celebrations",
    kind: "glossary_term",
    rank: "n/a",
    season: "n/a",
    summary:
      "Solemnity, feast, obligatory memorial, optional memorial, and weekday: the grades by which the Church orders her calendar and settles which celebration takes precedence.",
    body: "The Universal Norms on the Liturgical Year, printed at the front of the Roman Missal, divide celebrations into solemnities, feasts, and memorials according to their importance. The grade determines how the day is celebrated and, when two celebrations fall on the same date, which one is kept.\n\nSolemnities are the highest grade. They begin on the evening before with Evening Prayer I, they have the Gloria and the Creed at Mass, and they have three readings; some have a proper vigil Mass with its own texts. Easter and Christmas are prolonged through eight days as octaves. When a solemnity is impeded by a day of higher rank — a Sunday of Advent, Lent, or Easter, or a day of Holy Week or the Easter Octave — it is transferred to the nearest free day, which is why the Annunciation and Saint Joseph sometimes move.\n\nFeasts are celebrated within the limits of a single day and have no Evening Prayer I, except for feasts of the Lord that fall on a Sunday. The Gloria is sung at Mass but the Creed is not, since the Creed belongs to Sundays and solemnities. Memorials are of two kinds. An obligatory memorial must be observed: the collect of the saint is used, and the readings are ordinarily those of the weekday, since the Church wants the semi-continuous reading of Scripture to go forward. An optional memorial may be chosen or passed over in favor of the weekday, and where several fall on the same day only one is chosen. During Lent obligatory memorials are reduced to commemorations, kept only by an added collect.\n\nWeekdays are themselves ranked. The weekdays of Holy Week from Monday to Thursday and the days within the Octave of Easter outrank everything and admit no other celebration; Ash Wednesday stands with them. Next come the weekdays of Advent from December 17 to 24, the days within the Octave of Christmas, and the weekdays of Lent, on which only obligatory memorials may be commemorated. The remaining weekdays of Advent, the Christmas Season after the octave, the Easter Season, and Ordinary Time freely admit memorials and optional memorials. Sundays hold a rank of their own: the Sundays of Advent, Lent, and Easter yield to nothing, while the Sundays of the Christmas Season and of Ordinary Time give way to feasts of the Lord and to solemnities. The Table of Liturgical Days, which arranges all of this in nine numbered categories, is the practical instrument for resolving any conflict.",
    citations: [USCCB_CALENDAR, GIRM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "glossary-liturgical-vestments",
    title: "The Liturgical Vestments",
    kind: "glossary_term",
    rank: "n/a",
    season: "n/a",
    summary:
      "The garments worn by ordained and instituted ministers in the liturgy, which signify the office each exercises and give visible beauty to the sacred action.",
    body: "The General Instruction of the Roman Missal explains the purpose of vesture: diversity of office in the celebration of the Eucharist is shown outwardly by the diversity of sacred vestments, which should also contribute to the beauty of the rite. The vestments are not costumes and not personal adornment; they clothe the minister in his office so that what the assembly sees is the Church's ministry rather than the individual man.\n\nThe alb is the common vestment of all ministers, a long white garment recalling the robe put on at baptism. It is worn with a cincture at the waist and, when it does not cover the ordinary clothing at the neck, with an amice. Over the alb the deacon wears his stole across the chest, from the left shoulder to the right side, and the dalmatic; the priest wears the stole around the neck hanging down in front, and over it the chasuble, which is the vestment proper to the priest celebrating Mass. Where a chasuble-alb is used in particular circumstances it is always worn with a stole.\n\nA bishop celebrating adds the pectoral cross, the mitre, and the pastoral staff, and wears the zucchetto; a metropolitan archbishop wears the pallium, a band of white wool conferred by the Pope, within his province. Outside Mass, and in processions, at Benediction, and at other rites, the cope is worn, and the humeral veil is used to carry or to hold the Blessed Sacrament. Servers, readers, and choirs may wear the alb or the cassock and surplice.\n\nColor is regulated by the Instruction. White or gold is worn in the Christmas and Easter Seasons, on celebrations of the Lord other than of his Passion, of the Blessed Virgin Mary, of the angels, and of saints who were not martyrs. Red is worn on Palm Sunday and Good Friday, at Pentecost, on celebrations of the Lord's Passion, and for apostles, evangelists, and martyrs. Green is used in Ordinary Time. Violet is used in Advent and Lent and may be used in offices and Masses for the dead, for which black is also permitted. Rose may be worn on Gaudete Sunday and Laetare Sunday where that is the custom. The materials are to be of noble simplicity and genuine quality rather than mere ornament, and images or symbols, where used, should serve the sense of the celebration.",
    citations: [GIRM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "glossary-sacred-vessels",
    title: "The Sacred Vessels",
    kind: "glossary_term",
    rank: "n/a",
    season: "n/a",
    summary:
      "The chalice, paten, ciborium, monstrance, and other vessels that hold or carry the Body and Blood of Christ, together with the norms that govern their material and care.",
    body: "Among the requisites for the celebration of Mass, the General Instruction of the Roman Missal singles out the sacred vessels as held in special honor, above all the chalice and paten, in which the bread and wine are offered and consecrated and from which they are consumed. The chalice is the cup for the Precious Blood; the paten is the plate for the host of the celebrant. The ciborium holds the hosts for the Communion of the faithful and for reservation in the tabernacle; the pyx is the small vessel in which Communion is carried to the sick; the cruets hold the wine and the water; the monstrance, sometimes called the ostensorium, displays the Sacrament for adoration, with the host held in a small crescent-shaped luna.\n\nThe norms about material are strict for a reason. Vessels are to be made of noble metal, or of other solid materials that in the estimation of each region are precious and do not break easily or deteriorate. Vessels that hold the Blood of the Lord must have bowls of material that does not absorb liquid, which excludes glass, earthenware, clay, and similar substances. If a metal that rusts or is less noble than gold is used, the interior is ordinarily to be gilded. Vessels are blessed according to the rites in the liturgical books before being put into use, and they are reserved for sacred purposes alone.\n\nThe linens serve the vessels and are distinct from them: the corporal, spread on the altar beneath the vessels; the purificator, used to wipe the chalice; the pall, a stiffened square that may cover the chalice; the finger towel; and the altar cloth itself, which is white and covers the table of the altar. After Communion the vessels are purified by the priest, the deacon, or an instituted acolyte, at the altar or at the credence table, or after Mass; whatever remains of the Precious Blood is consumed, and particles of the host are gathered with care.\n\nThese rules are not fussiness about objects. Reverence in handling the vessels is a profession of faith in the real presence of Christ under the appearances of bread and wine, and the instruction Redemptionis Sacramentum treats abuses in this matter as offenses against that faith. Sacristans, servers, and extraordinary ministers of Holy Communion are well served by careful instruction in the names, uses, and care of the vessels entrusted to them.",
    citations: [GIRM, REDEMPTIONIS_SACRAMENTUM],
  }),
  liturgical({
    slug: "symbolism-of-the-paschal-candle",
    title: "The Paschal Candle",
    kind: "symbolism",
    rank: "n/a",
    season: "easter",
    summary:
      "The great candle blessed at the Easter Vigil and marked with the cross, the Alpha and the Omega, and the year, which stands as the sign of the risen Christ, the light of the world.",
    body: 'The Paschal candle is lit for the first time in the darkness at the Easter Vigil, from the fire blessed outside the church. It is to be made of wax, never artificial, renewed each year, one only, and of sufficient size to speak clearly of Christ as the true light. Before it is lit the celebrant cuts a cross into the wax and traces the Greek letter Alpha above it and Omega below, and the four numerals of the current year in the angles of the cross, saying: Christ yesterday and today, the beginning and the end, the Alpha and the Omega; all time belongs to him and all the ages; to him be glory and power through every age and for ever. Five grains of incense may then be inserted in the form of a cross, recalling the wounds of the Lord.\n\nThe lighted candle is carried into the dark church, and three times the deacon or priest sings "The Light of Christ," while the people\'s candles are lit from it and the church slowly fills with light. Beside the candle the Exsultet is then sung, the great proclamation of Easter that praises this night when Christ broke the prison bars of death, and that speaks of the candle itself as an offering of the Church, fed by the melting wax of the bees.\n\nThroughout the fifty days of the Easter Season the candle stands in the sanctuary near the ambo or the altar and is lit for all liturgical celebrations. After Pentecost it is kept in the baptistery near the font. There it is lit for baptisms, and the candle given to the newly baptized or to the parents and godparents is lit from it, joining every baptism to the Easter Vigil at which the sacrament finds its source. At funerals the candle is placed near the coffin, so that the same flame that greeted the Christian at the font accompanies the body to the altar and to the grave.\n\nThe symbolism is therefore a single line running through a Catholic life: the pillar of fire that led Israel out of Egypt, the Lord who is the light of the world, the light received at baptism, and the light of the resurrection in which the faithful hope to rise. Care for the candle — a clean stand, a proper size, its renewal each year — is a small but real way of keeping that sign legible.',
    citations: [USCCB_TRIDUUM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "symbolism-of-the-advent-wreath",
    title: "The Advent Wreath",
    kind: "symbolism",
    rank: "n/a",
    season: "advent",
    summary:
      "A circle of evergreens holding four candles, one lit for each week of Advent, whose growing light marks the approach of Christmas and the coming of Christ the light of the world.",
    body: "The Advent wreath came into use among German Christians in the nineteenth century and spread through Europe and the Americas until it became one of the most widespread of all Advent customs, kept in churches, schools, and above all in homes. The Directory on Popular Piety and the Liturgy treats it as a genuine expression of the season: the progressive lighting of the four candles, one on each Sunday, symbolizes the various stages of salvation history before Christ and the light of the Redeemer's coming, growing week by week into the world.\n\nThe form is simple. A circle of evergreen branches, whose unbroken shape suggests eternity and whose greenery suggests life that does not fail in winter, holds four candles. The common custom uses three violet candles and one rose candle, the rose lit on the Third Sunday of Advent, Gaudete Sunday, when rose vestments may be worn; other colors are used in some places, and a white candle is sometimes added in the center for Christmas Day. Popular practice attaches themes such as hope, peace, joy, and love to the successive candles; these are pious customs, edifying but not prescribed by any liturgical book.\n\nThe Book of Blessings provides a rite for blessing an Advent wreath, ordinarily used before the First Sunday of Advent or at its Masses. It also provides a form that a lay person may use, which makes the wreath a natural centerpiece of family prayer: a parent may bless it, and the family may light the candles at the evening meal with a short Scripture reading and prayer through the four weeks. Where a wreath is placed in a church, it should not obscure the altar, ambo, or the movement of the ministers, and it should not become the visual center of the sanctuary, which belongs to the altar.\n\nThe custom is valuable precisely because it is small and daily. Advent asks for watchfulness in the ordinary conditions of life, and a wreath on a kitchen table teaches that better than any explanation: the light increases quietly, week by week, until the season of waiting gives way to the celebration of the Nativity.",
    citations: [DIRECTORY_POPULAR_PIETY, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "ember-days-and-rogation-days",
    title: "Ember Days and Rogation Days",
    kind: "glossary_term",
    rank: "n/a",
    season: "n/a",
    summary:
      "Ancient days of prayer, fasting, and procession by which the Church begs God's blessing on human labor and the fruits of the earth and gives him thanks for them.",
    body: "The Universal Norms on the Liturgical Year keep both observances in the reformed calendar. On Rogation and Ember Days, they state, the Church is accustomed to entreat the Lord for the various needs of humanity, especially for the fruits of the earth and for human labor, and to give him public thanks. The Norms then leave the arrangement to the local Church: conferences of bishops determine the time and manner of their celebration, adapting them to the needs of the different regions, and the competent authority sets how many days are kept and what texts are used from the Masses for Various Needs and Occasions.\n\nThe Ember Days — in Latin quatuor tempora, the four seasons — are among the oldest observances of the Roman Church, attested by the fifth century and probably older. They fell four times a year on a Wednesday, Friday, and Saturday: in Advent after the memorial of Saint Lucy, in Lent after the First Sunday, in the week after Pentecost, and in September after the Exaltation of the Holy Cross. They were days of fasting and prayer marking the turning of the seasons and the harvests, and by long custom ordinations were conferred on the Ember Saturdays, which is why prayer for ministers of the Church became attached to them.\n\nThe Rogation Days took their name from the Latin rogare, to ask. The Major Litany was kept on April 25, a Roman procession that took over the route of an older civic rite for the protection of the crops; the Minor Rogations, on the three days before the Ascension, began at Vienne in Gaul in the fifth century under Saint Mamertus in a time of earthquake and disaster. Both were marked by processions through fields and streets while the Litany of the Saints was sung.\n\nSince the reform these days no longer appear as fixed obligatory observances on the General Roman Calendar, and their practice varies widely. Where they are kept, they take fitting forms: a Rogation procession and blessing of fields in a rural parish in spring, days of prayer for vocations or for the harvest, a parish day of fasting for a local need, or a blessing of workplaces. Their instinct is worth recovering, since it joins the liturgy to the soil, the seasons, and the labor by which people actually live.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "symbolism-of-incense-and-candles",
    title: "Incense and Candles in the Liturgy",
    kind: "symbolism",
    rank: "n/a",
    season: "n/a",
    summary:
      "Two of the oldest signs in Christian worship: rising smoke that figures prayer ascending to God, and burning light that figures Christ, the light no darkness overcomes.",
    body: "Incense belongs to the worship of Israel before it belongs to the Church. The psalmist asks that his prayer rise like incense before the Lord, the Book of Revelation shows an angel offering incense with the prayers of all the saints, and the Magi bring frankincense to the child at Bethlehem. In the liturgy incense is a sign of reverence and of prayer offered to God; the General Instruction of the Roman Missal permits its use at any Mass and names the moments — during the entrance procession, at the beginning of Mass to incense the cross and the altar, at the Gospel procession and proclamation, at the offertory to incense the gifts, the cross, the altar, the priest, and the people, and at the showing of the host and the chalice after the consecration. It is used as well at Benediction, at the dedication of a church, at the Exsultet, and at the final commendation of a funeral, where the body is honored as a temple of the Holy Spirit.\n\nThe incensation of persons is itself a piece of teaching. The priest is incensed because he acts in the person of Christ, and the assembly is incensed because the baptized are a holy people and their prayer rises with the same reverence. The practice is bodily and unmistakable, and the Church has always valued signs that address the senses rather than the mind alone.\n\nCandles carry the other sign. The Instruction requires at least two candles on or near the altar, and permits four or six, or seven when the diocesan bishop of the place celebrates; candlesticks may be carried in the entrance procession and set by the ambo for the Gospel. The sanctuary lamp burns continually near the tabernacle, fed by oil or wax, to indicate and honor the presence of Christ. The Paschal candle, the candle given at baptism, the candles carried at the Presentation of the Lord on February 2, and the candles blessed on that day for use in homes all belong to the same language.\n\nThe meaning is stated by the Lord himself: he is the light of the world, and whoever follows him will not walk in darkness. Real flame matters here. Wax and fire consume themselves in giving light, which is why the liturgy prefers them to artificial substitutes, and why the Church has kept these ancient materials while so much else has changed.",
    citations: [GIRM, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "angelus-and-regina-caeli",
    title: "The Angelus and the Regina Caeli",
    kind: "glossary_term",
    rank: "n/a",
    season: "n/a",
    summary:
      "The daily prayers at morning, midday, and evening by which the faithful recall the Incarnation, and the Easter antiphon that replaces the Angelus throughout the fifty days.",
    body: "The Angelus is prayed three times a day, at dawn, at noon, and at dusk, traditionally at the sound of a bell. It consists of three short versicles with a Hail Mary after each — the angel's announcement to Mary, her answer that she is the handmaid of the Lord, and the words of Saint John that the Word became flesh and dwelt among us — followed by the versicle Pray for us, O holy Mother of God, and a concluding prayer asking that, having known the Incarnation through the message of an angel, we may be brought by his Passion and Cross to the glory of the resurrection.\n\nIt grew slowly. An evening bell calling for Ave Marias is recorded in the thirteenth century, a morning bell followed, and the midday prayer was added later; the text reached its present form by the sixteenth century. The Directory on Popular Piety and the Liturgy praises it as a simple and adaptable devotion, easily prayed by individuals, families, and communities, that keeps the mystery of the Incarnation before the mind through the ordinary hours of the day. It is traditionally recited kneeling, except on Sundays and throughout Eastertide, when it is said standing.\n\nDuring the Easter Season the Angelus gives way to the Regina Caeli — Queen of Heaven, rejoice, alleluia, for he whom you were worthy to bear, alleluia, has risen as he said, alleluia; pray for us to God, alleluia. The antiphon dates from the medieval period and is one of the four seasonal Marian antiphons sung at the close of Night Prayer, alongside the Alma Redemptoris Mater, the Ave Regina Caelorum, and the Salve Regina. It is prayed from Easter Sunday through Pentecost Sunday, standing, and its repeated alleluias give the season's joy to a prayer that otherwise recalls the Annunciation.\n\nThe custom is publicly kept at the Vatican, where the Pope prays the Angelus, or the Regina Caeli in Eastertide, with pilgrims in Saint Peter's Square at midday on Sundays. In parishes the bell at noon and at six in the evening once ordered the day for whole towns; in a household, a pause at noon for these few lines is one of the least demanding and most durable ways of keeping the day turned toward God.",
    citations: [DIRECTORY_POPULAR_PIETY, USCCB_LITURGICAL_YEAR],
  }),
];
