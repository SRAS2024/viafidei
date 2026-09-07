import type { CuratedEntry } from "../index";

const USCCB_LITURGICAL_YEAR = "https://www.usccb.org/prayer-worship/liturgical-year";
const USCCB_CALENDAR = "https://www.usccb.org/committees/divine-worship/liturgical-calendar";
const USCCB_TRIDUUM = "https://www.usccb.org/prayer-worship/liturgical-year/triduum";
const USCCB_ORDINARY_TIME = "https://www.usccb.org/prayer-worship/liturgical-year/ordinary-time";
const GIRM =
  "https://www.usccb.org/prayer-and-worship/the-mass/general-instruction-of-the-roman-missal";
const DIRECTORY_POPULAR_PIETY =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";

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

export const liturgicalGroupOne: CuratedEntry[] = [
  liturgical({
    slug: "solemnity-saint-joseph",
    title: "Solemnity of Saint Joseph, Spouse of the Blessed Virgin Mary",
    kind: "solemnity",
    rank: "solemnity",
    season: "lent",
    feastDate: "03-19",
    associatedSaintSlugs: ["saint-joseph"],
    summary:
      "The Church's principal celebration of Saint Joseph, the just man entrusted with the Virgin Mary and the Child Jesus, kept as a solemnity on March 19 in the midst of Lent.",
    body: "March 19 was observed as the day of Saint Joseph in parts of the Latin West by the close of the Middle Ages, and Pope Sixtus IV placed it in the calendar of the Roman Church in the fifteenth century. Devotion grew steadily afterward: in 1870 Blessed Pope Pius IX declared Joseph Patron of the Universal Church, Pope Pius XII instituted the memorial of Saint Joseph the Worker on May 1 in 1955, Saint John XXIII inserted his name into the Roman Canon, and in 2013 Pope Francis extended that mention to all the Eucharistic Prayers of the Roman Missal. Pope Francis devoted the apostolic letter Patris corde to him in 2020.\n\nAs a solemnity the day is celebrated with white vestments, the Gloria, and the Creed, even though it falls within Lent, when the Gloria is otherwise omitted. The Missal provides its own prayers and a proper preface honoring Joseph as the faithful and prudent servant set over the Lord's household. The first reading recalls the promise made to the house of David, and the Gospel is either Matthew's account of the angel's word to Joseph in a dream or Luke's account of the finding of the child Jesus in the Temple. Because a solemnity may not displace a Sunday of Lent or the days of Holy Week, the celebration is transferred whenever March 19 falls on one of those days; local calendars published each year indicate the transferred date.\n\nIn the United States March 19 is not a holy day of obligation, though many parishes keep it with unusual warmth. Popular piety surrounds the day with customs of long standing: the Saint Joseph's table or altar of the Sicilian tradition, at which food is blessed and given to the poor; the seven Sundays of Saint Joseph observed before the solemnity; and prayers commending workers, fathers, and the dying to his protection. The Directory on Popular Piety and the Liturgy commends such practices when they lead the faithful back to the liturgy rather than away from it.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "commemoration-all-souls",
    title: "The Commemoration of All the Faithful Departed (All Souls' Day)",
    kind: "solemnity",
    season: "ordinary_time",
    feastDate: "11-02",
    summary:
      "On November 2 the whole Church prays for the dead who are still being purified, offering the Eucharist for them and pleading God's mercy on every soul in purgatory.",
    body: "The custom of setting aside a single day for all the faithful departed spread from Cluny, where Saint Odilo assigned November 2 to the commemoration for his monasteries at the end of the tenth century. The date, following immediately upon the Solemnity of All Saints, expresses the one communion of saints: the Church in glory, the Church still being purified, and the Church on earth. The practice rests on the Church's constant faith that prayer and sacrifice avail for the dead, a conviction Scripture already reflects in the account of Judas Maccabeus offering atonement for the fallen, and which the Catechism sets out in its teaching on the final purification.\n\nIn the Table of Liturgical Days the Commemoration is ranked in the highest class together with the solemnities of the General Roman Calendar, and so it is celebrated even when November 2 falls on a Sunday, taking the place of that Sunday in Ordinary Time. Its proper name is a commemoration rather than a feast: the Church does not celebrate a triumph but intercedes. Every priest may offer three Masses on this day, a permission granted by Pope Benedict XV in 1915, with one offered for the intention of the priest, one for all the faithful departed, and one for the intentions of the Holy Father. Violet vestments are ordinarily used; black and white are also permitted.\n\nThe liturgy's tone is confident rather than bleak: the readings speak of the souls of the just resting in the hand of God and of the resurrection promised to those baptized into Christ's death. Related customs are ancient and widespread — visiting and blessing graves, lighting candles, inscribing names in a book of the dead kept near the altar through November. The Church attaches a plenary indulgence, applicable only to the souls in purgatory, to a devout visit to a cemetery with prayer for the dead on each day from November 1 through 8, under the usual conditions of confession, Communion, and prayer for the Holy Father's intentions.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "ash-wednesday",
    title: "Ash Wednesday",
    kind: "liturgical_season",
    season: "lent",
    movableFeast: true,
    associatedReadings: ["Joel 2:12-18", "2 Corinthians 5:20—6:2", "Matthew 6:1-6, 16-18"],
    summary:
      "The day that opens Lent, when ashes are placed on the heads of the faithful as a sign of repentance and of the forty days of fasting, prayer, and almsgiving that lead to Easter.",
    body: "Ash Wednesday takes its name from the imposition of ashes made from the palms blessed on the previous year's Palm Sunday. In the ancient Roman discipline ashes marked those entering the order of public penitents at the beginning of Lent; by the end of the eleventh century the sign had been extended to the whole assembly, so that the entire Church takes the penitent's place. The date is movable, falling forty-six days before Easter Sunday, since the Sundays of Lent are not counted among the forty days of fast.\n\nAt Mass the blessing and distribution of ashes follows the homily and takes the place of the penitential act. The minister uses one of two formulas: \"Repent, and believe in the Gospel,\" drawn from the preaching of Jesus in Mark, or \"Remember that you are dust, and to dust you shall return,\" drawn from Genesis. Violet vestments are worn, the Alleluia is set aside for the whole season, and the readings are the same every year: Joel's summons to return to the Lord with the whole heart, Paul's appeal to be reconciled to God in this acceptable time, and the Lord's teaching on almsgiving, prayer, and fasting done in secret.\n\nAsh Wednesday is not a holy day of obligation, yet it is one of the most heavily attended days of the year, and it is a day of both fasting and abstinence for the universal Church. Church law binds abstinence from meat on all who have reached fourteen and fasting on those between eighteen and fifty-nine, with the ordinary exceptions for health. In the Table of Liturgical Days the day ranks in the first class, above every solemnity, so nothing may displace it. Ashes are a sacramental, not a sacrament, and the Church cautions that receiving them without conversion of heart is precisely what the day's Gospel warns against.",
    citations: [USCCB_LITURGICAL_YEAR, USCCB_CALENDAR],
  }),
  liturgical({
    slug: "gaudete-sunday",
    title: "Gaudete Sunday (Third Sunday of Advent)",
    kind: "liturgical_season",
    season: "advent",
    movableFeast: true,
    summary:
      'The Third Sunday of Advent, named from its entrance antiphon "Rejoice in the Lord always," when rose vestments may be worn and the season\'s note of expectation turns to nearby joy.',
    body: "The Sunday takes its traditional name from the first word of its entrance antiphon, Gaudete in Domino semper — \"Rejoice in the Lord always; again I say, rejoice. The Lord is near.\" The text is Saint Paul's to the Philippians, and it gives the whole day its character: Advent's penitential restraint is briefly lifted so that the Church can look at how close the Lord's coming is.\n\nThe General Instruction of the Roman Missal permits rose-colored vestments, where it is the practice, on this Sunday and on Laetare Sunday in Lent. Rose is violet lightened, a color that says the fast is not over but the end is in sight. Where an Advent wreath is used, the rose candle is lit on this day. Advent itself has two movements, and Gaudete Sunday stands near the hinge: until December 16 the season looks toward the Lord's coming in glory at the end of time, and from December 17, when the O Antiphons begin at Vespers, it prepares directly for the Nativity.\n\nThe Gospel of the Third Sunday concerns John the Baptist in each of the three years of the Lectionary cycle — his answer to those sent from Jerusalem, his preaching of repentance and its practical demands, or the question he sends from prison and the Lord's reply that the blind see and the poor have the good news preached to them. The Sunday belongs to the first class in the Table of Liturgical Days, so no feast or solemnity of the calendar may replace it.",
    citations: [GIRM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "octave-of-christmas",
    title: "The Octave of Christmas",
    kind: "liturgical_season",
    season: "christmas",
    summary:
      "The eight days from Christmas Day through January 1, during which the Church prolongs the celebration of the Nativity and closes with the Solemnity of Mary, the Holy Mother of God.",
    body: 'An octave is an ancient way of keeping a mystery too great for one day: the celebration is stretched across eight days so that the eighth day returns to the first. The Roman Calendar now retains only two, Easter and Christmas. The Christmas Octave runs from December 25 through January 1, and every day within it is celebrated with the Gloria and the prayers and preface of the Nativity.\n\nThe days within the octave keep three ancient feasts of the companions of Christ: Saint Stephen the first martyr on December 26, Saint John the Apostle and Evangelist on December 27, and the Holy Innocents on December 28. The Feast of the Holy Family of Jesus, Mary and Joseph is kept on the Sunday within the octave, or on December 30 in years when Christmas itself falls on a Sunday. December 29 and 31 are days within the octave on which the optional memorials of Saint Thomas Becket and Saint Sylvester I may be observed.\n\nThe octave day, January 1, is the Solemnity of Mary, the Holy Mother of God — the oldest Marian feast of the Roman liturgy, honoring the title Theotokos defined at the Council of Ephesus in 431 — and it is a holy day of obligation. In the dioceses of the United States the obligation is lifted when January 1 falls on a Saturday or a Monday. Since 1968 the same day has been kept as the World Day of Peace, and the first reading is the Aaronic blessing, "The Lord bless you and keep you." The Christmas Season itself continues past the octave, through the Epiphany, to the Feast of the Baptism of the Lord.',
    citations: [USCCB_LITURGICAL_YEAR, USCCB_CALENDAR],
  }),
  liturgical({
    slug: "holy-week",
    title: "Holy Week",
    kind: "liturgical_season",
    season: "lent",
    movableFeast: true,
    summary:
      "The final week of Lent, from Palm Sunday through Holy Saturday, in which the Church accompanies Christ from his entrance into Jerusalem to the tomb and into the Easter Triduum.",
    body: "The Universal Norms on the Liturgical Year state that Holy Week has as its purpose the remembrance of Christ's Passion, beginning with his Messianic entrance into Jerusalem. It opens with Palm Sunday of the Passion of the Lord and runs through Holy Saturday. Lent itself continues until the Evening Mass of the Lord's Supper on Holy Thursday, at which point the Easter Triduum begins; so the last three days of the week belong to the Triduum rather than to Lent.\n\nThe weekdays from Monday to Thursday rank in the first class of the Table of Liturgical Days, above every solemnity and feast, so no celebration of the saints may be kept on them and any impeded solemnity is transferred. The Gospels of those days follow the Lord toward the Passion: the anointing at Bethany, the betrayal foretold, and the bargain of Judas. On Holy Thursday morning, or on another day of the week where pastoral need requires, the bishop celebrates the Chrism Mass in the cathedral with his presbyterate, blessing the oil of the sick and the oil of catechumens, consecrating the sacred chrism, and receiving the priests' renewal of their promises.\n\nThe Church has always urged that the faithful prepare for these days by the sacrament of penance, and many parishes provide communal celebrations of reconciliation during the week. The Office of Readings and Morning Prayer of the Triduum, sung together in the traditional form called Tenebrae, remains a treasured observance. The Directory on Popular Piety and the Liturgy encourages processions, the Stations of the Cross, and other customs of these days while insisting that they be ordered to the liturgy, which is their source and summit and which no devotion may replace.",
    citations: [USCCB_LITURGICAL_YEAR, USCCB_TRIDUUM, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "palm-sunday-of-the-passion-of-the-lord",
    title: "Palm Sunday of the Passion of the Lord",
    kind: "liturgical_season",
    season: "lent",
    movableFeast: true,
    associatedReadings: [
      "Isaiah 50:4-7",
      "Philippians 2:6-11",
      "Matthew 26:14—27:66 (Year A)",
      "Mark 14:1—15:47 (Year B)",
      "Luke 22:14—23:56 (Year C)",
    ],
    summary:
      "The Sunday that opens Holy Week, joining the procession with palms in memory of Christ's entrance into Jerusalem to the solemn proclamation of his Passion.",
    body: "The two halves of this day's title belong together. Egeria's fourth-century account of the liturgy in Jerusalem already describes the faithful walking down the Mount of Olives with branches, and the Roman liturgy joined that memory to the reading of the Passion that had long marked the beginning of Holy Week. The Church therefore acclaims Christ as king and hears within the same liturgy how that kingship was exercised on the Cross.\n\nThe Missal gives three forms for the commemoration of the Lord's entrance: the Procession, in which the people gather away from the church, branches of palm or olive are blessed, the Gospel of the entrance into Jerusalem is proclaimed, and all move to the church singing the antiphon \"Hosanna to the Son of David\"; the Solemn Entrance, used when a procession outside is not possible; and the Simple Entrance at other Masses. Red vestments are worn, the color of both martyrdom and royal triumph.\n\nAt the Liturgy of the Word the first reading is the third Song of the Suffering Servant and the second is Paul's hymn of Christ who emptied himself and was obedient unto death. The Passion is then proclaimed according to Matthew in Year A, Mark in Year B, and Luke in Year C; it may be read by deacons or priests, or by readers with the part of Christ reserved to a priest, and all kneel and keep silence for a moment at the words recording the Lord's death. Palms blessed on this day are sacramentals: the Directory on Popular Piety notes the custom of keeping them in the home as a witness of faith in Christ the King, and they are burned the following year to provide the ashes of Ash Wednesday.",
    citations: [USCCB_LITURGICAL_YEAR, USCCB_TRIDUUM, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "holy-thursday-mass-of-the-lords-supper",
    title: "Holy Thursday: The Evening Mass of the Lord's Supper",
    kind: "liturgical_season",
    season: "triduum",
    movableFeast: true,
    associatedReadings: ["Exodus 12:1-8, 11-14", "1 Corinthians 11:23-26", "John 13:1-15"],
    summary:
      "The evening Mass that opens the Easter Triduum, commemorating the institution of the Eucharist and of the priesthood and the Lord's command of fraternal charity.",
    body: "The Easter Triduum begins with this Mass and ends with Evening Prayer on Easter Sunday; the Church counts it as the summit of the whole liturgical year. Earlier the same day the bishop gathers his priests in the cathedral for the Chrism Mass, at which the holy oils for the coming year are blessed and the sacred chrism consecrated. In the evening every parish celebrates the one Mass of the Lord's Supper, and the whole community is invited, since this Mass makes present the night on which the Lord gave himself.\n\nThe Gloria is sung after the long silence of Lent and the bells are rung; then bells and organ fall silent until the Gloria of the Easter Vigil. The readings are the same every year: the institution of the Passover in Exodus, Saint Paul's account of the Supper handed on to him — the earliest written witness to the Eucharist — and John's account of the washing of the disciples' feet. The Missal places the washing of feet, the Mandatum, after the homily; in 2016 Pope Francis decreed that those chosen may be taken from among all the members of the People of God.\n\nAfter the prayer after Communion the Blessed Sacrament is carried in procession to a place of reposition prepared elsewhere in the church, while Pange Lingua is sung, its last verses, Tantum Ergo, at the moment of reposition. The altar is then stripped and crosses are removed or veiled. The faithful are urged to remain in adoration for some part of the night, keeping watch as the Lord asked in Gethsemane; adoration continues at least until midnight, though after that hour it is kept without solemnity. No Mass may be celebrated after this one until the Easter Vigil, except for the sick.",
    citations: [USCCB_TRIDUUM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "good-friday-of-the-lords-passion",
    title: "Good Friday of the Passion of the Lord",
    kind: "liturgical_season",
    season: "triduum",
    movableFeast: true,
    associatedReadings: ["Isaiah 52:13—53:12", "Hebrews 4:14-16; 5:7-9", "John 18:1—19:42"],
    summary:
      "The day of Christ's death, on which no Mass is celebrated anywhere and the Church keeps the Celebration of the Passion of the Lord with word, veneration of the Cross, and Communion.",
    body: "On this day and the next the Church by ancient tradition does not celebrate the sacraments at all, except penance and the anointing of the sick. There is no Mass anywhere in the world. The altar is completely bare: no cloth, no cross, no candles. The Celebration of the Passion of the Lord takes place in the afternoon, ordinarily around three o'clock, and it begins in silence — the ministers enter without song and prostrate themselves before the altar while the people kneel.\n\nThe rite has three parts. In the Liturgy of the Word the fourth Song of the Suffering Servant is proclaimed, then the passage from Hebrews on the high priest who has been tested in every way, and then the Passion according to John, which presents the Cross as the hour of Christ's glorification. There follow the Solemn Intercessions, ten in number, in which the Church prays in the most ancient Roman form for the Church, the Pope, the clergy and faithful, catechumens, the unity of Christians, the Jewish people, those who do not believe in Christ, those who do not believe in God, public officials, and all in tribulation. In the second part the Cross is shown to the people with the acclamation \"Behold the wood of the Cross, on which hung the salvation of the world,\" and all come forward to venerate it. In the third part Holy Communion is distributed from hosts consecrated at the Mass of the Lord's Supper the evening before. Red vestments are worn.\n\nGood Friday is a day of fasting and abstinence for the whole Church, and the fast is fittingly continued through Holy Saturday. Popular devotions of the day are among the most beloved in Catholic life — the Stations of the Cross, the Seven Last Words, processions of the dead Christ and of the Sorrowful Mother in many cultures. The Directory on Popular Piety encourages them precisely because they carry the mystery into the home and the street, provided they never take the place of the liturgical celebration itself. In many countries a collection is taken on this day for the support of the Church in the Holy Land.",
    citations: [USCCB_TRIDUUM, USCCB_LITURGICAL_YEAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "holy-saturday-and-the-easter-vigil",
    title: "Holy Saturday and the Easter Vigil in the Holy Night",
    kind: "liturgical_season",
    season: "triduum",
    movableFeast: true,
    associatedReadings: ["Exodus 14:15—15:1", "Romans 6:3-11"],
    summary:
      "The day the Church waits at the Lord's tomb, ending in the Easter Vigil, the mother of all vigils, at which the elect are baptized and the Resurrection is proclaimed.",
    body: "Holy Saturday is a day of silence. The Church waits at the Lord's tomb, meditating on his Passion and Death and on his descent to the dead, by which he opened the gates of heaven to the just who had gone before him. There is no Mass, the altar remains bare, and Holy Communion is given only as Viaticum to the dying. Morning Prayer and the Office of Readings are the day's proper liturgy, and the fast of Good Friday is fittingly prolonged.\n\nThe Easter Vigil is celebrated in the night and belongs already to Easter Sunday. It must begin after nightfall and end before daybreak; Saint Augustine called it the mother of all holy vigils. It has four parts. The first is the Lucernarium: a fire is blessed outside the church, the paschal candle is prepared and lit from it, and the deacon carries it into the dark church with the threefold acclamation \"The Light of Christ,\" after which the Exsultet, the great Easter Proclamation, is sung. The second is the Liturgy of the Word, in which the Church reads the story of salvation — seven readings from the Old Testament, each with its psalm and prayer, then the Epistle and the Gospel. Where circumstances require, the number of Old Testament readings may be reduced, but at least three are to be read, and the account of the crossing of the Red Sea with its canticle may never be omitted. After the last Old Testament prayer the Gloria is intoned and the bells are rung; the Alleluia is then solemnly sung for the first time since before Lent.\n\nThe third part is the Baptismal Liturgy. The Litany of the Saints is sung, the baptismal water is blessed, the elect are baptized and confirmed, and the whole assembly renews its baptismal promises and is sprinkled with the blessed water. The fourth part is the Liturgy of the Eucharist, at which the newly baptized come to the Lord's table for the first time. The paschal candle then stands in the sanctuary throughout the fifty days of Easter, and afterward at the font for baptisms and beside the coffin at funerals — the same light carried into every Christian life and out of it.",
    citations: [USCCB_TRIDUUM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "octave-of-easter",
    title: "The Octave of Easter",
    kind: "liturgical_season",
    season: "easter",
    movableFeast: true,
    summary:
      "The eight days from Easter Sunday through the Second Sunday of Easter, each celebrated as a solemnity of the Lord, prolonging the one day of Resurrection.",
    body: 'The Universal Norms on the Liturgical Year state that the first eight days of Easter Time constitute the Octave of Easter and are celebrated as solemnities of the Lord. The Church treats these eight days as a single day too great to be contained by one: what is celebrated on Easter Sunday is celebrated again each morning until the Second Sunday of Easter, which closes the octave.\n\nEach day has the Gloria, the proper Easter preface with its "on this day above all" phrasing, and the readings that follow the first witnesses to the Resurrection — the women at the tomb, the disciples on the road to Emmaus, the appearance in the upper room, the meal by the Sea of Tiberias. The first readings are taken from the Acts of the Apostles, the preaching of the Church that flows immediately from the empty tomb. The sequence Victimae paschali laudes is prescribed on Easter Sunday itself and may be sung on the other days of the octave, and the double Alleluia is added to the dismissal throughout the octave. No solemnity, feast, or memorial may be celebrated during these days; a funeral Mass may not use the usual funeral texts.\n\nIn the ancient Church the newly baptized wore their white garments through the whole week — the octave was called the week in albis — and came each day for instruction in the mysteries they had received. That is the origin of the mystagogical catechesis given to the neophytes in the Order of Christian Initiation of Adults, which the Church still asks to be continued through the Easter Season. The Second Sunday of Easter, the octave day, is also called Divine Mercy Sunday.',
    citations: [USCCB_LITURGICAL_YEAR, USCCB_CALENDAR],
  }),
  liturgical({
    slug: "divine-mercy-sunday",
    title: "Divine Mercy Sunday (Second Sunday of Easter)",
    kind: "liturgical_season",
    season: "easter",
    movableFeast: true,
    associatedSaintSlugs: ["saint-faustina-kowalska", "saint-john-paul-ii"],
    associatedReadings: ["John 20:19-31"],
    summary:
      "The octave day of Easter, given the additional title of Divine Mercy Sunday by Saint John Paul II in 2000, whose Gospel is the Lord's gift of peace and the forgiveness of sins.",
    body: 'The Second Sunday of Easter closes the Octave of Easter and is celebrated as a solemnity of the Lord. On April 30, 2000, at the canonization of Saint Faustina Kowalska, Pope Saint John Paul II announced that from then on this Sunday would also be called Divine Mercy Sunday throughout the Church, and the Congregation for Divine Worship confirmed the title by decree shortly afterward. The name adds nothing to the Sunday\'s rank or texts; it names what the day\'s own liturgy already proclaims.\n\nThe Gospel is the same in all three years of the Lectionary cycle: on the evening of the first day of the week the risen Lord stands among the disciples behind locked doors, shows them his wounds, breathes on them and says, "Receive the Holy Spirit. Whose sins you forgive are forgiven them," and eight days later meets the doubt of Thomas with the invitation to touch his side. The Easter octave thus ends with the institution of the sacrament of reconciliation and with the confession "My Lord and my God." The first reading describes the early community holding all things in common; the second speaks of the water and the blood that testify to Christ.\n\nThe devotion associated with the day comes from Saint Faustina, a Polish Sister of Our Lady of Mercy who died in 1938 and whose spiritual diary records her call to spread trust in God\'s mercy. The image of the Merciful Jesus with the pale and red rays, the Chaplet of Divine Mercy prayed on rosary beads, and the novena begun on Good Friday are its principal forms. In 2002 the Apostolic Penitentiary attached a plenary indulgence to devout participation on this Sunday in devotions in honor of Divine Mercy, or to the recitation of the Our Father and the Creed with a pious invocation of the merciful Lord Jesus, under the usual conditions of sacramental confession, Holy Communion, and prayer for the intentions of the Holy Father.',
    citations: [USCCB_LITURGICAL_YEAR, USCCB_CALENDAR],
  }),
  liturgical({
    slug: "laetare-sunday",
    title: "Laetare Sunday (Fourth Sunday of Lent)",
    kind: "liturgical_season",
    season: "lent",
    movableFeast: true,
    summary:
      'The Fourth Sunday of Lent, named from the entrance antiphon "Rejoice, Jerusalem," on which rose vestments may be worn and the austerity of Lent is briefly relaxed.',
    body: 'The Sunday is named from the first word of its entrance antiphon, Laetare Ierusalem — "Rejoice, Jerusalem, and all who love her. Be joyful, all who were in mourning." The text is from Isaiah, and it interrupts Lent at roughly its midpoint with a promise of consolation. The season does not end, but the Church lets the coming Easter show through.\n\nThe General Instruction of the Roman Missal permits rose-colored vestments on this Sunday, where it is the practice, as on Gaudete Sunday in Advent. Two other Lenten restrictions are relaxed on this day alone: the altar may be decorated with flowers, which is otherwise forbidden during Lent, and the organ and other instruments may be played rather than used only to support the singing. The Sunday belongs to the first class in the Table of Liturgical Days and may not be displaced by any celebration.\n\nIn Year A the Gospel is the healing of the man born blind, one of the three great baptismal Gospels of Lent. Where the elect are being prepared for the sacraments at the Easter Vigil, the second scrutiny is celebrated on this Sunday and this Gospel is used even in Years B and C, since the scrutinies belong to the Sundays with their proper readings. The image is exact for the season: Lent is the Church\'s journey from blindness to sight, and baptism has been called illumination from the earliest centuries. A long papal custom of blessing a golden rose on this Sunday gave the day its other traditional name.',
    citations: [GIRM, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-conversion-of-saint-paul",
    title: "Feast of the Conversion of Saint Paul the Apostle",
    kind: "feast",
    rank: "feast",
    feastDate: "01-25",
    associatedSaintSlugs: ["saint-paul"],
    summary:
      "Celebrated on January 25, this feast commemorates the encounter with the risen Christ on the road to Damascus that turned the persecutor Saul into the Apostle to the Gentiles.",
    body: "Unlike most days in the sanctoral cycle, this feast celebrates not a saint's death but an event in his life: the moment on the Damascus road when a light from heaven struck Saul to the ground and a voice asked, \"Saul, Saul, why are you persecuting me?\" The Acts of the Apostles tells the story three times, a sign of how decisive the Church judged it to be, and Paul himself refers to it repeatedly in his letters as the source of his apostolate. The observance is attested in the West from the early Middle Ages and was extended to the whole Roman Church by the thirteenth century.\n\nThe feast is kept with white vestments and the Gloria. The first reading is Paul's own account of the event before the crowd in Jerusalem, or the narrative from the ninth chapter of Acts, and the Gospel is the Lord's commission to go into the whole world and proclaim the Gospel to every creature. The prayers of the Mass ask that the Church, which learned the Gospel through Paul's preaching, may follow him toward God.\n\nJanuary 25 closes the Week of Prayer for Christian Unity, which begins on January 18. That placement is deliberate: the day the Church remembers a man wholly changed by Christ is the day she prays that Christians divided among themselves may be made one. In Rome the Pope has traditionally presided at Vespers on this evening in the Basilica of Saint Paul Outside the Walls, which stands over the apostle's tomb, together with representatives of other Christian communions. Saint Paul is also honored, with Saint Peter, in the solemnity of June 29.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-chair-of-saint-peter",
    title: "Feast of the Chair of Saint Peter the Apostle",
    kind: "feast",
    rank: "feast",
    feastDate: "02-22",
    associatedSaintSlugs: ["saint-peter"],
    summary:
      "Kept on February 22, this feast honors not a relic of wood but the office of teaching and governing that Christ entrusted to Peter and to those who succeed him.",
    body: "A Roman calendar of the year 354 already lists February 22 as the natale Petri de cathedra, making this one of the oldest observances in the Roman liturgy. The chair, or cathedra, is the seat from which a bishop teaches, and the word survives in the name of a diocese's principal church, the cathedral. The feast therefore celebrates the Petrine ministry itself: the unity of faith and communion for which Christ prayed and which he founded on the confession of Peter.\n\nThe Gospel of the day is Matthew's account at Caesarea Philippi — Peter's confession that Jesus is the Christ, the Son of the living God, and the Lord's reply that on this rock he will build his Church and will give him the keys of the kingdom. The first reading is Peter's own exhortation to the elders of the Church to tend the flock of God willingly, not lording it over those in their charge. White vestments are worn, and the Preface of the Apostles is used.\n\nIn the apse of Saint Peter's Basilica an ancient wooden chair, long venerated as connected with the apostle, is enclosed in the bronze monument of the Cathedra Petri made by Bernini. The image is instructive: the visible seat is hidden inside a work of art that shows it upheld by the Doctors of the Church and lit by the Holy Spirit. Catholics commonly mark the day by praying for the Pope, and the feast provides a natural occasion for catechesis on the primacy and on the Church's teaching about the successor of Peter as the perpetual and visible source of unity among the bishops and the faithful.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-mark",
    title: "Feast of Saint Mark, Evangelist",
    kind: "feast",
    rank: "feast",
    feastDate: "04-25",
    associatedSaintSlugs: ["saint-mark-the-evangelist"],
    summary:
      "On April 25 the Church honors the evangelist whose short and urgent Gospel, associated by ancient tradition with the preaching of Saint Peter, is read in Year B.",
    body: "Mark appears in the New Testament as John Mark, a companion of Barnabas and Paul on missionary travel and later a helper close to Peter, who calls him \"my son\" at the end of his first letter. Papias, writing early in the second century, records the tradition that Mark set down what Peter preached, and the Church has read the second Gospel in that light ever since. It is the shortest of the four and the most rapid, driving toward the centurion's confession at the Cross: \"Truly this man was the Son of God.\"\n\nThe feast is celebrated with red vestments, the color of martyrdom, since ancient tradition holds that Mark died a martyr at Alexandria, the church whose foundation is attributed to him. His relics were taken to Venice in the ninth century, and he remains that city's patron. In Christian art his symbol is the winged lion, one of the four living creatures of Ezekiel and Revelation assigned to the evangelists; the lion was traditionally connected with the voice crying in the wilderness with which his Gospel opens.\n\nAt Mass the Gospel is the missionary commission at the end of Mark, and the first reading is Peter's counsel to clothe oneself with humility, ending with the greeting that names Mark. In the Lectionary's three-year Sunday cycle the Gospel of Mark is read in Year B, supplemented by the sixth chapter of John. April 25 was historically the day of the Greater Litanies, a Roman procession of intercession for the fruits of the earth; that observance is no longer part of the General Roman Calendar but may be kept in local usage as one of the days of prayer for the harvest.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saints-philip-and-james",
    title: "Feast of Saints Philip and James, Apostles",
    kind: "feast",
    rank: "feast",
    feastDate: "05-03",
    associatedSaintSlugs: ["saints-philip-and-james"],
    summary:
      "Two of the Twelve are honored together on May 3, their joint feast rooted in the Roman basilica where their relics were enshrined.",
    body: 'Philip came from Bethsaida, the town of Peter and Andrew. John\'s Gospel gives him more attention than the others do: he is called by the Lord with the word "Follow me," he brings Nathanael to Jesus with the answer "Come and see," he is asked where bread might be bought for the crowd, and at the Last Supper he says, "Lord, show us the Father, and it is enough for us," drawing the reply, "Whoever has seen me has seen the Father." That exchange is the Gospel of the feast.\n\nJames, called the Less to distinguish him from the son of Zebedee, is named in the lists of the Twelve as the son of Alphaeus. Christian tradition has commonly identified him with James who led the church in Jerusalem and to whom the Letter of James is ascribed, though the New Testament does not make the identification explicit. Saint Paul names James among those to whom the risen Lord appeared, and the first reading of the feast is that list of resurrection witnesses from the fifteenth chapter of First Corinthians.\n\nThe two apostles are joined in one celebration because their relics were placed together in the Roman basilica now known as the Church of the Holy Apostles, and the anniversary of its dedication became their feast. The date has moved more than once; in the reform of the General Roman Calendar following the Second Vatican Council the feast was assigned to May 3. Red vestments are worn, with the Gloria and the Preface of the Apostles, whom the Church honors as the foundation on which she is built.',
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-matthias",
    title: "Feast of Saint Matthias, Apostle",
    kind: "feast",
    rank: "feast",
    feastDate: "05-14",
    associatedSaintSlugs: ["saint-matthias"],
    summary:
      "On May 14 the Church honors the disciple chosen to take the place left by Judas, the one apostle called to the Twelve after the Ascension.",
    body: "The first chapter of Acts tells how, in the days between the Ascension and Pentecost, Peter stood among about a hundred and twenty believers and said that one who had accompanied them from the baptism of John until the day the Lord was taken up must become with them a witness to the Resurrection. Two men were proposed, Joseph called Barsabbas and Matthias. The community prayed, cast lots, and the lot fell to Matthias, who was numbered with the eleven apostles. That account is the first reading of the feast.\n\nThe choice is instructive about the Church's own self-understanding: the number twelve, corresponding to the tribes of Israel, was to be restored before the Spirit was given, and the qualification was to have been an eyewitness of the Lord's ministry and Resurrection. Nothing further about Matthias is recorded in the New Testament, and the later accounts of his preaching and martyrdom belong to tradition rather than to Scripture; the Church honors him with red vestments as a martyr.\n\nThe Gospel of the feast is the Lord's word at the Last Supper: \"It was not you who chose me, but I who chose you and appointed you to go and bear fruit that will remain.\" In the reform of the calendar after the Second Vatican Council the feast was moved from February 24 to May 14, so that it would fall within the Easter Season near the events of Acts that it commemorates. In some particular calendars and religious orders the older date is still observed.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-visitation-of-the-blessed-virgin-mary",
    title: "Feast of the Visitation of the Blessed Virgin Mary",
    kind: "feast",
    rank: "feast",
    feastDate: "05-31",
    summary:
      "On May 31 the Church remembers Mary's journey to the hill country to serve her kinswoman Elizabeth, the meeting at which the Magnificat was first sung.",
    body: "Luke's Gospel places the visitation immediately after the Annunciation: Mary sets out in haste to the hill country of Judah, greets Elizabeth, and at the sound of her voice the child in Elizabeth's womb leaps for joy. Elizabeth, filled with the Holy Spirit, cries out, \"Blessed are you among women, and blessed is the fruit of your womb,\" words the Church has prayed for centuries in the Hail Mary, and asks, \"How does this happen to me, that the mother of my Lord should come to me?\" Mary answers with the Magnificat, the canticle the Church sings every evening at Vespers.\n\nThe feast spread through the Franciscan Order in the thirteenth century and was extended to the whole Latin Church by Pope Urban VI in 1389, with the intention of imploring an end to the Great Western Schism through Mary's intercession. In the revision of the calendar after the Second Vatican Council it was moved from July 2 to May 31, so that it falls between the Solemnity of the Annunciation on March 25 and the Solemnity of the Nativity of Saint John the Baptist on June 24, matching the sequence of events in the Gospel.\n\nThe day is celebrated with white vestments, the Gloria, and a proper preface. The Church reads the scene as the first act of the Gospel's mission: the one who carries Christ carries him to others, and does so in service. The Visitation is the second of the Joyful Mysteries of the Rosary, and its fruit is traditionally named as love of neighbor. The Directory on Popular Piety commends the daily singing or recitation of the Magnificat as the Church's own response to the mercy shown to the lowly.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "feast-saint-thomas",
    title: "Feast of Saint Thomas, Apostle",
    kind: "feast",
    rank: "feast",
    feastDate: "07-03",
    associatedSaintSlugs: ["saint-thomas-the-apostle"],
    summary:
      'On July 3 the Church honors the apostle whose doubt became the clearest confession of Christ\'s divinity in the Gospels: "My Lord and my God."',
    body: 'John\'s Gospel gives Thomas three moments. When Jesus resolves to return to Judea where his life is threatened, Thomas says to the others, "Let us also go to die with him." At the Last Supper he objects, "Master, we do not know where you are going; how can we know the way?" and receives the answer, "I am the way and the truth and the life." And on the octave day of the Resurrection, having refused to believe the others, he is invited to put his finger into the wounds and answers, "My Lord and my God" — the Gospel proclaimed at this feast.\n\nThe Church has never treated that episode as an embarrassment. Thomas\'s demand for evidence and his surrender before the risen body of Christ stand at the end of John\'s Gospel as the confession toward which the whole book moves, and the Lord\'s reply — "Blessed are those who have not seen and have believed" — is addressed to every later generation. The first reading of the feast is from Ephesians: the faithful are no longer strangers but fellow citizens, built upon the foundation of the apostles and prophets.\n\nAncient and continuous tradition holds that Thomas carried the Gospel east to India, and the Saint Thomas Christians of Kerala trace their origin to his preaching; the Syro-Malabar and Syro-Malankara Churches, in full communion with Rome, are their heirs. His relics were venerated at Edessa, and July 3 in the General Roman Calendar is associated with their translation there; before the post-conciliar reform the Roman Rite kept his feast on December 21. Red vestments are worn.',
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-james",
    title: "Feast of Saint James, Apostle",
    kind: "feast",
    rank: "feast",
    feastDate: "07-25",
    associatedSaintSlugs: ["saint-james-the-greater"],
    summary:
      "On July 25 the Church honors James the son of Zebedee, one of the three closest to the Lord and the first of the apostles to be martyred.",
    body: "James and his brother John were mending nets with their father Zebedee when the Lord called them, and they left the boat at once. With Peter the two brothers form the inner circle admitted to the raising of Jairus's daughter, the Transfiguration, and the agony in Gethsemane. The Lord named them Boanerges, sons of thunder. The Gospel of the feast is their mother's request that they sit at his right and left in the kingdom, and the Lord's question, \"Can you drink the chalice that I am going to drink?\" — with his warning that among his followers greatness is service, for the Son of Man came to give his life as a ransom for many.\n\nJames answered that question with his life. The twelfth chapter of Acts records in a single sentence that Herod had James, the brother of John, killed by the sword; he is the only apostle whose death the New Testament reports, and it occurred around the year 44. The first reading of the feast is Saint Paul's image of the treasure held in earthen vessels, that the surpassing power may be God's and not ours. Red vestments are worn.\n\nBy the ninth century a tomb venerated as his had been identified at Compostela in Galicia, and the Camino de Santiago became one of the three great pilgrimages of Christendom alongside Rome and Jerusalem. The scallop shell of the pilgrim, still worn on the road today, comes from that devotion, and July 25 is kept as a solemnity in Spain and in the churches that bear his name. He is called James the Greater to distinguish him from the apostle James son of Alphaeus, honored on May 3.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-lawrence",
    title: "Feast of Saint Lawrence, Deacon and Martyr",
    kind: "feast",
    rank: "feast",
    feastDate: "08-10",
    associatedSaintSlugs: ["saint-lawrence"],
    summary:
      "On August 10 the Church honors the deacon of Rome who was martyred in 258 and who presented the poor to his persecutors as the treasures of the Church.",
    body: "Lawrence was one of the seven deacons of the Church of Rome under Pope Sixtus II. In the persecution of Valerian the Pope and his deacons were seized; Lawrence, who had charge of the Church's goods and of the care of the poor, was executed a few days later, on August 10 in the year 258. The account preserved by Saint Ambrose and celebrated in the hymns of Prudentius tells how, ordered to hand over the Church's treasures, he gathered the poor, the crippled, and the blind and presented them, saying that these were the Church's wealth. The gridiron of his martyrdom belongs to the same early tradition.\n\nHis cult was immediate and immense. Constantine built a basilica over his tomb on the Via Tiburtina, now San Lorenzo fuori le Mura, one of the great churches of Rome; his name stands in the Roman Canon among the martyrs; and by the fourth century Rome kept his day with a vigil, an honor otherwise reserved to the apostles. That antiquity is why a Roman deacon holds the rank of feast in the General Roman Calendar, a distinction shared by very few saints who were neither apostles nor evangelists.\n\nThe Mass is celebrated with red vestments and has proper readings that fit him exactly: Saint Paul's teaching that whoever sows bountifully will reap bountifully, for God loves a cheerful giver, and the Lord's word that unless the grain of wheat falls to the earth and dies it remains just a grain of wheat. Lawrence is patron of deacons, of cooks, and of the poor, and the Perseid meteors of mid-August are known in many countries as the tears of Saint Lawrence.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-bartholomew",
    title: "Feast of Saint Bartholomew, Apostle",
    kind: "feast",
    rank: "feast",
    feastDate: "08-24",
    associatedSaintSlugs: ["saint-bartholomew"],
    summary:
      "On August 24 the Church honors the apostle named in the lists of the Twelve and traditionally identified with Nathanael, the Israelite without guile.",
    body: 'The three Synoptic Gospels and the Acts of the Apostles name Bartholomew among the Twelve, always near Philip; John never uses the name but tells of Nathanael, whom Philip brings to Jesus. From that pairing the Christian tradition has commonly identified the two, and the Gospel of the feast is the Johannine scene: Nathanael\'s blunt question, "Can anything good come from Nazareth?", Philip\'s reply, "Come and see," and the Lord\'s greeting, "Here is a true Israelite. There is no duplicity in him." Nathanael then confesses him as Son of God and King of Israel and is promised the sight of heaven opened.\n\nThe first reading is taken from the Book of Revelation, where the wall of the holy city has twelve courses of stones as its foundation, on which are inscribed the twelve names of the twelve apostles of the Lamb — an image the Church applies to all the apostolic feasts. Red vestments are worn, with the Gloria and the Preface of the Apostles.\n\nLater accounts, none of them in Scripture, describe Bartholomew\'s preaching in Armenia and his martyrdom by flaying, which is why art gives him a knife and, most famously in Michelangelo\'s Last Judgment, his own skin. The Armenian Apostolic Church venerates him as one of its founders. His relics have been honored since the tenth century in the basilica on the Tiber Island in Rome, which in recent decades has become a memorial of the martyrs of the twentieth and twenty-first centuries — a fitting continuity for an apostle whose own witness ended in blood.',
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-nativity-of-the-blessed-virgin-mary",
    title: "Feast of the Nativity of the Blessed Virgin Mary",
    kind: "feast",
    rank: "feast",
    season: "ordinary_time",
    feastDate: "09-08",
    summary:
      "On September 8 the Church celebrates the birth of Mary, kept nine months after the Solemnity of her Immaculate Conception on December 8.",
    body: "The Church celebrates only three birthdays in her calendar: the Nativity of the Lord on December 25, the Nativity of Saint John the Baptist on June 24, and the Nativity of the Blessed Virgin Mary on September 8. The reason is the same in each case — these are births of those already sanctified, and in Mary's case the Church looks to the one preserved from original sin from the first moment of her conception. The date is fixed nine months after December 8, the Solemnity of the Immaculate Conception, so that the two celebrations belong to one another.\n\nThe observance began in the East and reached Rome by the seventh century, where Pope Sergius I provided it, along with the other principal Marian celebrations, with a solemn procession. It was long associated in Jerusalem with the dedication of a church near the Sheep Pool honoring Mary's birth; the site is venerated as the home of her parents, Saints Joachim and Anne, whose memorial the Church keeps on July 26. Scripture records nothing of Mary's birth; the liturgy simply rejoices that the dawn of salvation appeared.\n\nThe Mass is celebrated with white vestments, the Gloria, and a proper preface. The Gospel is Matthew's genealogy of Jesus Christ, son of David, son of Abraham, ending with Mary of whom Jesus was born, or the announcement to Joseph that follows it. The Collect asks that the feast of her Nativity may bring an increase of peace. In many countries the day carries harvest customs and the blessing of seed, and in the Byzantine tradition it opens the liturgical year, which begins on September 1.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-matthew",
    title: "Feast of Saint Matthew, Apostle and Evangelist",
    kind: "feast",
    rank: "feast",
    feastDate: "09-21",
    associatedSaintSlugs: ["saint-matthew"],
    summary:
      "On September 21 the Church honors the tax collector called from his customs post, apostle and evangelist, whose Gospel is read in Year A.",
    body: "The Gospel of the feast is Matthew's account of his own call. Jesus, passing by, saw a man named Matthew sitting at the customs post and said, \"Follow me,\" and he got up and followed him. There followed the meal at which the Lord sat with tax collectors and sinners and answered the objection with the words of Hosea: \"I desire mercy, not sacrifice. I did not come to call the righteous but sinners.\" Mark and Luke tell the same story of a man they call Levi. The scene has shaped Christian imagination ever since; Caravaggio's Calling of Saint Matthew hangs in the French church in Rome that bears the apostle's name.\n\nA tax collector in first-century Galilee worked for the occupying power and was regarded as a public sinner. That the risen Lord's Church counts such a man among the Twelve and among the four evangelists is itself a statement of the Gospel. The first reading of the feast is Saint Paul's appeal to live in a manner worthy of the call received, with humility, gentleness, and patience, in the one body and one Spirit.\n\nAncient tradition, going back to Papias, ascribes to Matthew a collection of the Lord's sayings in the Hebrew tongue, and the first Gospel of the canon bears his name. It is the Gospel most concerned with showing that Jesus fulfills the Law and the Prophets, and it is read on the Sundays of Year A. His symbol among the four living creatures is the winged man, traditionally connected with the human genealogy with which his Gospel opens. Red vestments are worn, since tradition honors him as a martyr.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-holy-archangels-michael-gabriel-raphael",
    title: "Feast of Saints Michael, Gabriel, and Raphael, Archangels",
    kind: "feast",
    rank: "feast",
    feastDate: "09-29",
    summary:
      "September 29 honors the three archangels named in Scripture, joined in a single feast in the revised General Roman Calendar.",
    body: 'The Roman observance of September 29 began as the anniversary of the dedication of a basilica of Saint Michael on the Salarian Way, and the day was long known as Michaelmas. In the reform of the calendar after the Second Vatican Council the two other angels named in Scripture were joined to it, so that the Church now honors Michael, Gabriel, and Raphael together in one feast.\n\nEach is known by what he does. Michael, whose name is the question "Who is like God?", appears in Daniel as the great prince who stands guard over God\'s people, in the Letter of Jude contending with the devil, and in Revelation casting down the dragon; he is invoked as protector of the Church. Gabriel, "God is my strength," interprets the vision to Daniel and is sent to Zechariah in the Temple and to Mary at Nazareth, so that every Hail Mary begins with his greeting. Raphael, "God heals," walks the whole length of the Book of Tobit as the companion of the young Tobiah, heals the elder Tobit\'s blindness, and finally reveals himself as one of the seven who stand before the glory of the Lord.\n\nThe Gospel of the feast is the Lord\'s promise to Nathanael that he will see the heavens opened and the angels of God ascending and descending on the Son of Man. The Church\'s teaching on the angels is set out in the Catechism: they are spiritual, non-corporeal creatures with intelligence and will, servants and messengers of God, and they surround the liturgy, as the Sanctus of every Mass makes plain. White vestments are worn. The Prayer to Saint Michael composed under Pope Leo XIII in the nineteenth century remains widely used, and the Feast of the Guardian Angels follows on October 2.',
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-luke",
    title: "Feast of Saint Luke, Evangelist",
    kind: "feast",
    rank: "feast",
    feastDate: "10-18",
    associatedSaintSlugs: ["saint-luke-the-evangelist"],
    summary:
      "On October 18 the Church honors the evangelist and companion of Saint Paul who wrote both the third Gospel and the Acts of the Apostles.",
    body: 'Saint Paul calls him "Luke the beloved physician," names him among his fellow workers, and writes from prison at the end of his life that "Luke is the only one with me" — the verse read as the first reading of this feast. From the second century the Church has ascribed to him the third Gospel and its sequel, the Acts of the Apostles, two volumes addressed to Theophilus that together make up more of the New Testament than the writings of any other author.\n\nLuke\'s Gospel is the one that preserves the Annunciation and the Visitation, the Magnificat, the Benedictus, and the Nunc Dimittis, the shepherds at the manger, the good Samaritan, the prodigal son, and the two disciples on the road to Emmaus. It has been called the Gospel of mercy, of the poor, of prayer, and of the Holy Spirit, and its attention to Mary and to the women who followed Jesus is without parallel among the four. The Gospel proclaimed at the feast is the sending of the seventy-two, the Lord\'s own missionary charge: "The harvest is abundant but the laborers are few."\n\nRed vestments are worn. His symbol among the four living creatures is the ox, traditionally connected with the Temple sacrifice at which his Gospel opens. A tradition of long standing holds that he painted an image of the Virgin, and he is honored as patron of physicians, surgeons, and artists; October 18 is widely kept as a day of prayer and blessing for those who work in medicine. In the Sunday Lectionary his Gospel is read in Year C.',
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saints-simon-and-jude",
    title: "Feast of Saints Simon and Jude, Apostles",
    kind: "feast",
    rank: "feast",
    feastDate: "10-28",
    associatedSaintSlugs: ["saint-jude-thaddeus"],
    summary:
      "On October 28 the Church honors two of the Twelve about whom the Gospels say very little, joined in one celebration since their relics were venerated together in Rome.",
    body: "Simon is called the Zealot in Luke and Acts, and the Cananean in Matthew and Mark — two renderings of the same designation, marking him as a man of fierce devotion to the Law, perhaps once attached to the movement that resisted Roman rule. Jude, also called Thaddeus, is distinguished in John's Gospel from Judas Iscariot, and it is he who asks at the Last Supper, \"Master, what happened that you are going to reveal yourself to us and not to the world?\" The Lord's answer — that whoever loves him will keep his word, and that the Father and he will come and make their dwelling with him — is the Gospel of the feast in one of its options.\n\nThe Church attributes to Jude the short canonical Letter of Jude, which urges the faithful to contend for the faith once delivered to the saints and closes with the doxology to the God who is able to keep them from stumbling. The two apostles are commemorated together because their relics have long been venerated in the same Roman church, and the joint celebration passed from there into the General Roman Calendar.\n\nRed vestments are worn, and the first reading is again the passage from Ephesians on the household of God built upon the foundation of the apostles, with Christ Jesus himself as the capstone. Popular devotion to Saint Jude as the patron of desperate and seemingly hopeless causes is widespread; its origin is often explained by the reluctance of the faithful to invoke a name so close to that of the traitor, so that his intercession was left, as it were, in reserve. The Church has never discouraged the practice, provided it remains prayer and does not slip into superstition.",
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "feast-dedication-of-the-lateran-basilica",
    title: "Feast of the Dedication of the Lateran Basilica",
    kind: "feast",
    rank: "feast",
    season: "ordinary_time",
    feastDate: "11-09",
    summary:
      "On November 9 the whole Church keeps the dedication of the cathedral of Rome, mother and head of all the churches of the City and of the world.",
    body: "The Archbasilica of the Most Holy Savior and of Saints John the Baptist and John the Evangelist at the Lateran is the cathedral of the Bishop of Rome, not Saint Peter's. Constantine gave the Lateran property to the Church after the peace of the fourth century, and the basilica was dedicated in the time of Pope Sylvester I. An inscription on its façade names it the mother and head of all the churches of the City and of the world, and for a thousand years the popes lived beside it.\n\nThat is why the anniversary of a single building's dedication is kept by the universal Church. The feast is a sign of communion with the Church of Rome, which presides in charity, and of the unity of all the local churches around the successor of Peter. Because it is a feast of the dedication of the Lord's own cathedral, it is celebrated even when November 9 falls on a Sunday in Ordinary Time, taking the place of that Sunday.\n\nThe readings are those of a dedication and are chosen to keep the emphasis where it belongs. Ezekiel sees water flowing from the right side of the Temple, giving life wherever it goes; Saint Paul tells the Corinthians, \"You are God's building,\" and asks, \"Do you not know that you are the temple of God?\"; and the Gospel is the cleansing of the Temple in John, where the Lord speaks of the temple of his body. A church building is consecrated with chrism, incense, and light because it houses the people who are themselves the living stones. White vestments are worn, with the Gloria and a proper preface for the mystery of the Church.",
    citations: [USCCB_CALENDAR, USCCB_ORDINARY_TIME],
  }),
  liturgical({
    slug: "feast-saint-andrew",
    title: "Feast of Saint Andrew, Apostle",
    kind: "feast",
    rank: "feast",
    feastDate: "11-30",
    associatedSaintSlugs: ["saint-andrew-the-apostle"],
    summary:
      "On November 30 the Church honors Andrew, the brother of Peter and the first to be called, whose feast stands at the threshold of Advent.",
    body: 'John\'s Gospel presents Andrew as a disciple of John the Baptist who heard his master point to Jesus as the Lamb of God, followed him, stayed with him that day, and then went to find his own brother Simon with the words, "We have found the Messiah." For that reason the Christian East calls him Protoclete, the first-called. The Gospel of the feast is Matthew\'s account by the Sea of Galilee: Jesus sees the two brothers casting a net, says, "Come after me, and I will make you fishers of men," and at once they leave their nets and follow him.\n\nThe first reading is Saint Paul\'s reflection on how faith comes through hearing and hearing through the word of Christ, ending with Isaiah\'s cry, "How beautiful are the feet of those who bring the good news." Red vestments are worn. Ancient tradition holds that Andrew preached in Greece and Asia Minor and was crucified at Patras; the X-shaped saltire cross of his later iconography gave Scotland, of which he is patron, its flag. He is also patron of Greece, of Russia, and of the Ecumenical Patriarchate of Constantinople, which venerates him as its founder.\n\nThat last connection gives the day an ecumenical character. Each year on November 30 a delegation of the Holy See travels to the Phanar for the patronal feast of the Church of Constantinople, and a delegation of the Ecumenical Patriarch comes to Rome on June 29 for the Solemnity of Saints Peter and Paul — two brothers standing for two Churches that seek full communion. Because November 30 falls near the beginning of Advent, the feast yields in years when it coincides with the First Sunday of Advent, which takes precedence.',
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-stephen",
    title: "Feast of Saint Stephen, the First Martyr",
    kind: "feast",
    rank: "feast",
    season: "christmas",
    feastDate: "12-26",
    associatedSaintSlugs: ["saint-stephen"],
    summary:
      "The day after Christmas the Church honors the deacon Stephen, the first to give his life for Christ, whose death is recorded in the Acts of the Apostles.",
    body: "Stephen was one of the seven men, filled with the Spirit and with wisdom, whom the apostles chose to serve the tables of the Greek-speaking widows in Jerusalem. Acts describes him working great signs among the people, disputing in the synagogue, and delivering before the Sanhedrin the long speech that traces Israel's history and ends with the charge that they have betrayed and murdered the Righteous One. He is stoned outside the city, and as he dies he sees the heavens opened and the Son of Man standing at God's right hand, commends his spirit to the Lord Jesus, and prays aloud, \"Lord, do not hold this sin against them.\" A young man named Saul stands by, consenting.\n\nThat account is the first reading of the feast, and its placement on the second day of Christmas is deliberate. Christian tradition calls Stephen, Saint John, and the Holy Innocents the comites Christi, the companions of Christ, ranged around the crib on the days following the Nativity: the martyr who died in will and in blood, the apostle who died in will alone, and the children who died in blood without knowing it. The Church, having sung of the Word made flesh, immediately shows what it costs to belong to him.\n\nRed vestments are worn, and the Gospel is the Lord's warning that his disciples will be handed over and hated by all because of his name, with the promise that the Spirit will speak in them. His death is also the first hint of Saul's conversion, and Saint Augustine's observation that the Church would not have Paul if Stephen had not prayed has been repeated ever since. In many countries December 26 is a public holiday, kept with customs of almsgiving that recall the office of the deacon.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
  liturgical({
    slug: "feast-saint-john-apostle-and-evangelist",
    title: "Feast of Saint John, Apostle and Evangelist",
    kind: "feast",
    rank: "feast",
    season: "christmas",
    feastDate: "12-27",
    summary:
      "On December 27, the third day of Christmas, the Church honors the beloved disciple who stood at the Cross and wrote the Gospel of the Word made flesh.",
    body: 'John, the son of Zebedee and brother of James, belonged with Peter and his brother to the inner circle of the Twelve. The fourth Gospel calls him the disciple whom Jesus loved: he reclines next to the Lord at the Last Supper, stands beneath the Cross where Jesus entrusts his mother to him and him to his mother, outruns Peter to the empty tomb and, seeing the burial cloths, believes. The Gospel of this feast is that Easter morning scene, read now within the Christmas Octave because the Church sees one mystery in the manger and the empty tomb.\n\nTradition ascribes to him the fourth Gospel, the three Letters of John, and the Book of Revelation, and remembers his long years at Ephesus and his exile on Patmos. The first reading of the feast is the opening of the First Letter of John: "What was from the beginning, what we have heard, what we have seen with our eyes and touched with our hands concerns the Word of life." That insistence on having touched him is why the day belongs to Christmas, and it is his prologue — "And the Word became flesh and made his dwelling among us" — that the Church proclaims at the Mass of Christmas Day.\n\nWhite vestments are worn, since ancient tradition holds that John alone among the apostles did not die a martyr, though he shared the sufferings of the persecuted Church. His symbol among the four living creatures is the eagle, for the height at which his Gospel begins. The Book of Blessings provides for the blessing of wine on his feast, an old custom drawn from a legend of the apostle drinking unharmed from a poisoned cup, and the toast to the love of Saint John is still kept in many households and religious communities on this day.',
    citations: [USCCB_CALENDAR, DIRECTORY_POPULAR_PIETY],
  }),
  liturgical({
    slug: "feast-holy-innocents",
    title: "Feast of the Holy Innocents, Martyrs",
    kind: "feast",
    rank: "feast",
    season: "christmas",
    feastDate: "12-28",
    summary:
      "On December 28 the Church honors the children of Bethlehem killed by Herod, martyrs who died for Christ without knowing him.",
    body: "Matthew's Gospel records that when Herod realized he had been deceived by the magi he became furious and ordered the massacre of all the boys in Bethlehem and its vicinity two years old and under. The evangelist hears in it the voice of Jeremiah: Rachel weeping for her children and refusing to be consoled, since they are no more. That passage is the Gospel of the feast, read on the fourth day of Christmas while the crib is still in the church.\n\nThe Church has honored these children as martyrs since antiquity, though they neither chose nor understood their death. Prudentius called them the flowers of the martyrs, cut down at the very dawn by the persecutor as a whirlwind takes the opening rosebuds; the Latin hymn Salvete flores martyrum still carries the image in the Liturgy of the Hours. Their inclusion among the companions of Christ on the days after Christmas makes the same point as the feasts of Saint Stephen and Saint John: the Child born in Bethlehem was born into a world that would resist him, and to be near him is to share his lot.\n\nRed vestments are worn, and the first reading is from the First Letter of John, that God is light and in him there is no darkness at all. The Gloria is sung, as on all the days of the Christmas Octave. In many places the day carries customs of blessing children, and it has become a natural occasion for prayer and reparation for children who are lost to violence and abortion; a number of dioceses in the United States observe it as a day of prayer for the protection of unborn human life.",
    citations: [USCCB_CALENDAR, USCCB_LITURGICAL_YEAR],
  }),
];
