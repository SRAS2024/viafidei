import type { CuratedEntry } from "../index";

/**
 * Novena group 4 — novenas whose received texts are in the public domain,
 * reproduced from books printed before 1929 that the earlier groups did not
 * draw on.
 *
 * Sources and copyright basis:
 *
 *   - "A Book of Novenas for the Principal Feasts of the Year" (Baltimore:
 *     Kelly, Piet and Company, copyright 1878; approved by the Archbishop of
 *     Baltimore on 8 March 1878): the novenas for the Circumcision, the
 *     Epiphany and Christ Crucified, each a single prayer said on every day.
 *     The archive.org copy is a Google scan in which some later leaves are
 *     torn; only novenas whose pages are whole are used.
 *
 *   - John Baptist Pagani, "The Way to Heaven: a manual of devotion" (London:
 *     James Burns, 1849): the novenas for the Nativity, Presentation,
 *     Annunciation, Visitation and Purification of Our Lady and for her
 *     Assumption, each a series of numbered petitions closed by the Ave.
 *
 *   - St. Alphonsus Liguori, "The Glories of Mary", arranged for popular use,
 *     with the addition of prayers and devotions (New York: Benziger Brothers,
 *     copyright 1902): the meditations on the Litany of Loreto for a novena to
 *     the Blessed Virgin, and the novena to Our Lady of Mount Carmel for those
 *     who wear the Brown Scapular. Three archive.org scans of this edition were
 *     compared.
 *
 *   - F. X. Lasance, "Prayer-Book for Religious" (New York: Benziger
 *     Brothers, copyright 1904; the Library of Congress copyright-deposit copy,
 *     received 6 July 1904): from its "Little Book of Novenas", the novenas to
 *     St. Dominic, St. Catharine of Siena, St. Jane Frances de Chantal, St.
 *     Ursula and St. Bernard and for the feast of All Saints. A later printing
 *     from different plates (archive.org prayerbookreligi00lasauoft) was used
 *     as a second witness.
 *
 *   - F. X. Lasance, "The Blessed Sacrament Book" (New York: Benziger
 *     Brothers, 1913; imprimatur 6 April 1913): the novena to St. Ignatius
 *     Loyola, which the book attributes to Pagani. F. X. Lasance, "With God: a
 *     book of prayers and reflections" (New York: Benziger Brothers, copyright
 *     1911): the novena for Easter.
 *
 *   - "The Golden Manual: being a guide to Catholic devotion, public and
 *     private" (New York and Montreal: D. & J. Sadlier; American edition
 *     entered 1851, the archive.org copy catalogued as of 1865): the novenas to
 *     the Sacred Heart, to the Blessed Virgin and to St. John the Baptist. The
 *     same plates were reprinted by P. J. Kenedy (New York, 1902), whose scans
 *     were used as a second witness.
 *
 * Every page was read from the archive.org page images and checked word by
 * word against archive.org's OCR and a second OCR made from the same images.
 * Every `prayerText` is copied from the first cited source and nothing in it is
 * paraphrased, shortened, composed or merged across versions. Where a novena's
 * received form says the same prayers on each of the nine days — which is the
 * form of every novena here except St. Alphonsus's meditations on the Litany
 * and the Mount Carmel novena — the prayers are built once, in the order the
 * book prints them, and repeated; the day-by-day distinction then lies in the
 * `meditation`, a short editorial introduction to the day's subject that never
 * pretends to be part of the prayer. Where a book refers back to a prayer it
 * prints once (the Mount Carmel novena's "Preparatory Prayer, Our Father, Hail
 * Mary, as on page 324"), that prayer is written out in full on each day it is
 * said and the page reference is dropped; the Litany of Loreto, which that
 * novena calls for each day without printing it, is indicated by the book's
 * own rubric. Rubrics that the books print within a novena ("Hail Mary, etc.",
 * "Glory be, etc.", "Repeat the Hail Mary nine times") are kept as printed;
 * indulgence notes, footnotes, feast-day notes and attributions are omitted.
 *
 * St. Alphonsus's novena on the Litany of Loreto is printed as nine
 * meditations, each taking one to four invocations of the Litany; under each
 * invocation the book prints a consideration drawn from the saints and then,
 * as a separate paragraph, a prayer to Our Lady. Each day's `prayerText` gives
 * the invocation as the book heads it, in Latin and English, followed by that
 * prayer; the considerations are summarised in the day's `meditation` rather
 * than reproduced. The eighth meditation prints a prayer only under "Refuge of
 * Sinners", so only that invocation appears on the eighth day. Where the book
 * introduces a prayer of a saint for the reader's own use ("let us address her
 * in the words of St. Andrew of Crete", "Let us say, then, with St.
 * Bonaventure"), that prayer is the section's prayer and keeps the book's
 * quotation marks.
 *
 * Corrections and readings. Three printer's slips are corrected: Pagani's
 * novena for the Purification has "ycur" for "your"; the Glories prints a
 * stray full stop after "Virgo fidelis"; and the Golden Manual's novena to the
 * Blessed Virgin prints "the crown of thy occidental glory", an evident
 * misprint for the theological term "accidental glory" (the joy of the blessed
 * that can still grow, as the prayer says it will "to the end of the world"),
 * which is so corrected. On the same page of the Golden Manual a short word at
 * the end of a line is worn away in both the 1865 and the 1902 printings and
 * is read as "so" ("with which thine was ever so inflamed"), as The Garden of
 * the Soul (New York: D. & J. Sadlier, 1871) prints the same prayer. In the
 * Mount Carmel novena the sixth day's prayer ends, as the book prints it,
 * "who with the Father and the Son liveth and reigneth"; it is kept as printed
 * and the background says so.
 *
 * Shared components. The third day's prayer of the Mount Carmel novena is a
 * form of the Memorare, which the catalogue publishes on its own as the PRAYER
 * memorare; it is kept as part of the novena's received form and its
 * background names the separate entry. The Golden Manual follows its novena
 * to St. John the Baptist with the Litany of St. John the Baptist, which the
 * catalogue publishes as litany-of-saint-john-the-baptist; the litany has its
 * own heading in the book and is not part of the novena text given here.
 * Novenas were left out where the novena's prayer is already published in
 * another version: the novenas to the Holy Name and to St. Patrick in the
 * Golden Manual and in A Book of Novenas, the Golden Manual's novena to St.
 * Charles Borromeo (its prayer is that of novena-saint-charles-borromeo), the
 * Glories' novena to the Immaculate Heart (its prayer is the Raccolta's
 * prayer-to-the-heart-of-mary-and-act-of-praise in another translation) and
 * the novena for the feast of the Five Wounds in A Book of Novenas, whose
 * prayer is a version of one of the Fifteen Prayers ascribed to St. Bridget.
 * Where a novena shares its subject with one already in the catalogue, its
 * summary or background says that its text is a different one.
 *
 * Typographic conventions of the printed books are normalised without changing
 * any word: opening words set in capitals or small capitals are given in
 * ordinary case, italics are not marked, curly quotation marks are
 * straightened, the space that the older books set before marks of
 * punctuation is dropped, and words divided at the end of a printed line are
 * joined. Every background states that the novena is a private devotion, not a
 * liturgical rite, and `typicalStartDate` holds only the date phrase: where a
 * book's dates follow an older calendar, the background gives them.
 */

const BOOK_OF_NOVENAS_CIRCUMCISION =
  "https://archive.org/details/ABookOfNovenasForThePrincipalFeastsOfTheYear/page/n11/mode/1up";
const BOOK_OF_NOVENAS_EPIPHANY =
  "https://archive.org/details/ABookOfNovenasForThePrincipalFeastsOfTheYear/page/n13/mode/1up";
const BOOK_OF_NOVENAS_CHRIST_CRUCIFIED =
  "https://archive.org/details/ABookOfNovenasForThePrincipalFeastsOfTheYear/page/n19/mode/1up";
const PAGANI_NATIVITY =
  "https://archive.org/details/TheWayToHeavenAManualOfDevotion/page/n416/mode/1up";
const PAGANI_PRESENTATION =
  "https://archive.org/details/TheWayToHeavenAManualOfDevotion/page/n417/mode/1up";
const PAGANI_ANNUNCIATION =
  "https://archive.org/details/TheWayToHeavenAManualOfDevotion/page/n418/mode/1up";
const PAGANI_VISITATION =
  "https://archive.org/details/TheWayToHeavenAManualOfDevotion/page/n419/mode/1up";
const PAGANI_PURIFICATION =
  "https://archive.org/details/TheWayToHeavenAManualOfDevotion/page/n421/mode/1up";
const PAGANI_ASSUMPTION =
  "https://archive.org/details/TheWayToHeavenAManualOfDevotion/page/n430/mode/1up";
const GLORIES_1902_LITANY =
  "https://archive.org/details/gloriesofmary0000ligu_k0b6/page/n209/mode/1up";
const GLORIES_1902_MOUNT_CARMEL =
  "https://archive.org/details/gloriesofmary0000ligu_k0b6/page/n327/mode/1up";
const LASANCE_1904_DOMINIC =
  "https://archive.org/details/prayerbookforrel00lasa_0/page/n1088/mode/1up";
const LASANCE_1904_CATHARINE =
  "https://archive.org/details/prayerbookforrel00lasa_0/page/n1090/mode/1up";
const LASANCE_1904_JANE_FRANCES =
  "https://archive.org/details/prayerbookforrel00lasa_0/page/n1095/mode/1up";
const LASANCE_1904_URSULA =
  "https://archive.org/details/prayerbookforrel00lasa_0/page/n1099/mode/1up";
const LASANCE_1904_BERNARD =
  "https://archive.org/details/prayerbookforrel00lasa_0/page/n1100/mode/1up";
const LASANCE_1904_ALL_SAINTS =
  "https://archive.org/details/prayerbookforrel00lasa_0/page/n1109/mode/1up";
const LASANCE_1913_IGNATIUS =
  "https://archive.org/details/BlessedSacramentBook/page/n1155/mode/1up";
const LASANCE_1911_EASTER = "https://archive.org/details/WithGod/page/n685/mode/1up";
const GOLDEN_MANUAL_SACRED_HEART = "https://archive.org/details/cihm_49896/page/n639/mode/1up";
const GOLDEN_MANUAL_BLESSED_VIRGIN = "https://archive.org/details/cihm_49896/page/n641/mode/1up";
const GOLDEN_MANUAL_JOHN_THE_BAPTIST = "https://archive.org/details/cihm_49896/page/n644/mode/1up";

const CE_CIRCUMCISION = "https://www.newadvent.org/cathen/03779a.htm";
const CE_EPIPHANY = "https://www.newadvent.org/cathen/05504c.htm";
const CE_PASSION_OF_CHRIST = "https://www.newadvent.org/cathen/11527b.htm";
const CE_NATIVITY_OF_MARY = "https://www.newadvent.org/cathen/10712b.htm";
const CE_PRESENTATION_OF_MARY = "https://www.newadvent.org/cathen/12400a.htm";
const CE_ANNUNCIATION = "https://www.newadvent.org/cathen/01542a.htm";
const CE_VISITATION = "https://www.newadvent.org/cathen/15480a.htm";
const CE_CANDLEMAS = "https://www.newadvent.org/cathen/03245b.htm";
const CE_ASSUMPTION = "https://www.newadvent.org/cathen/02006b.htm";
const CE_LITANY_OF_LORETO = "https://www.newadvent.org/cathen/09287a.htm";
const CE_ALPHONSUS_LIGUORI = "https://www.newadvent.org/cathen/01334a.htm";
const CE_SCAPULAR = "https://www.newadvent.org/cathen/13508b.htm";
const CE_DOMINIC = "https://www.newadvent.org/cathen/05106a.htm";
const CE_CATHERINE_OF_SIENA = "https://www.newadvent.org/cathen/03447a.htm";
const CE_VISITATION_ORDER = "https://www.newadvent.org/cathen/15481a.htm";
const CE_URSULA = "https://www.newadvent.org/cathen/15225d.htm";
const CE_BERNARD = "https://www.newadvent.org/cathen/02498d.htm";
const CE_ALL_SAINTS = "https://www.newadvent.org/cathen/01315a.htm";
const CE_IGNATIUS_LOYOLA = "https://www.newadvent.org/cathen/07639c.htm";
const CE_EASTER = "https://www.newadvent.org/cathen/05224d.htm";
const CE_BLESSED_VIRGIN_MARY = "https://www.newadvent.org/cathen/15464b.htm";
const CE_JOHN_THE_BAPTIST = "https://www.newadvent.org/cathen/08486b.htm";
const CE_DEVOTION_TO_THE_SACRED_HEART = "https://www.newadvent.org/cathen/07163a.htm";

/** The prayer of the novena for the feast of the Circumcision, said on each of the nine days. */
const BOOK_OF_NOVENAS_CIRCUMCISION_PRAYER =
  "Oh! most sweet Infant Jesus, who at the expiration of eight days didst submit to be circumcised, receiving the holy name of Jesus, and becoming, in virtue of that name and by the shedding of that blood, the Saviour of the world, I prostrate myself humbly before Thee, and thank Thee with all my heart for this Thy great mercy and love to me and to all poor sinners. The sight of this Thy blood reminds me hopefully of the source whence flows every grace, every grace which will be imparted to me during the year; and also of the asylum where I will seek shelter and aid in every tribulation. It is Thy heart, dear Lord, which was opened to me in this first shedding of Thy blood. Therefore I devote to thee, Oh! sweetest, dearest Heart, every word and deed, every throb of my heart, all, all that I do or suffer during this year. Accept my offering, and strengthen me with Thy grace; enlighten and shield me, and grant me in virtue of Thy name, that most holy, most efficacious name of Jesus, this my request . . . . . Hear me, oh! Jesus, for the sake of this Thy name and of Thy loving heart! Amen.";

/** The prayer of the novena for the feast of the Epiphany, said on each of the nine days. */
const BOOK_OF_NOVENAS_EPIPHANY_PRAYER =
  "I salute Thee, O divine Heart, with the three Magi who offered their homage to Thee. Regard me, I beseech Thee, with the same love and kindness with which Thou didst receive them, that I may offer with my heart, gold, frankincense and myrrh; that is to say, my intellect, my memory and my will, in complete subjection to Thee, in faith, hope, charity, in thought, word and deed. Accept my offering, accept my heart, and grant that I may live and die thanking Thee for the invaluable favor of being called to the true faith. Hence, I beg of Thee, by the joy which filled Thy heart, when Thou didst see the first of the Gentiles at Thy feet, to hear my prayer and grant the request I make in this Novena. Amen.";

/** The five petitions of the novena in honour of Christ Crucified, each with its Hail Mary, said on each of the nine days. */
const BOOK_OF_NOVENAS_CHRIST_CRUCIFIED_PRAYER =
  "Jesus Christ Crucified, Son of the most holy Virgin Mary, incline Thy sacred Head, and listen to my petitions and sighs, as Thou didst listen to Thy eternal Father on Mount Thabor. Hail Mary, etc.\n\nJesus Christ Crucified, Son of the most holy Virgin Mary, open Thy sacred Eyes, and look upon me as Thou didst look upon Thy sacred Mother from the Cross. Hail Mary, etc.\n\nJesus Christ Crucified, Son of the most holy Virgin Mary, open thy sacred Lips, and speak to my afflicted heart, as Thou didst speak to St. John, when Thou recommendedst him to Thy dear Mother. Hail Mary, etc.\n\nJesus Christ Crucified, Son of the most holy Virgin Mary, open Thy sacred Arms, and receive me Thy poor child, as Thou didst embrace the hard wood of the Cross, for love of me and of all sinners. Hail Mary, etc.\n\nJesus Christ Crucified, Son of the most holy Virgin Mary, open Thy sacred Heart, that seat of love and mercy, and receive mine into it; make it wholly Thine. Hear my prayers, and grant my petitions. Hail Mary, etc.";

/** Pagani's numbered petitions for the novena of the Nativity of Our Lady, all said on each of the nine days. */
const PAGANI_NATIVITY_NOVENA_PRAYER =
  "1. O holy Virgin! whose birth into this world announced peace to suffering men, upon this solemn remembrance of your birth, obtain, we beseech you, true peace to our hearts, to the Church, and to all the world. Ave.\n\n2. O invincible Virgin! who commenced at the instant of your birth the overthrow of the kingdom of the devil, obtain for us that we may be enabled to destroy his reign in our hearts, and continually to resist him by a lively faith, so that Christ may reign in us and with us for ever. Ave.\n\n3. Unspotted Virgin! who was born adorned with perfect purity, obtain for us that we may henceforward cease to live after the flesh, but may be enabled to lead a pure and spotless life, such as true Christians should do. Ave.\n\n4. Heavenly Virgin! who came into the world to triumph over it, obtain for us that we also may be detached from it, living, not according to its laws, but to those of the Gospel. Ave.\n\n5. Glorious Virgin! who was born to triumph over all heresy, dissipate by your power all the errors which oppose themselves to our holy religion, and preserve constantly in us that lively faith which works by charity. Ave.\n\n6. Most holy Virgin! who appeared on this earth to afford us a bright mirror of virtue and holiness; let our eyes be continually turned towards you, that we may be enabled to imitate your virtuous deeds, and become holy like you. Ave.\n\n7. Most happy Virgin! whom God created to bring forth Him who would heal the evils of the whole world, obtain for us that we may be preserved from all sin, the only real evil, and may make so profitable a use of divine grace, that we may attain eternal life. Ave.";

/** Pagani's numbered petitions for the novena of the Presentation of Our Lady, all said on each of the nine days. */
const PAGANI_PRESENTATION_NOVENA_PRAYER =
  "1. O great Virgin and dear Mother! by the marvellous promptitude with which you dedicated your earliest years to the service of God, obtain that we may from this time forward be enabled to consecrate our hearts to the divine service without ever being diverted from our purpose. Ave.\n\n2. O great Virgin and dear Mother! by that seraphic zeal with which in your childhood you served in the temple, thereby becoming an object of admiration to angels and men, obtain for us that we may approach the holy Sacraments with the true spirit of devotion. Ave.\n\n3. O great Virgin and dear Mother! by the admirable courage with which you subdued your attachment to home and parents, in your first years of life, that you might devote yourself to the service of God, obtain for us that, no longer seduced by the deceits of our enemies, we may be able to keep our hearts detached from all earthly things, seeking for our true and perfect good alone, and may enjoy one day with you the eternal delights of Paradise. Ave.";

/** Pagani's numbered petitions for the novena of the Annunciation, all said on each of the nine days. */
const PAGANI_ANNUNCIATION_NOVENA_PRAYER =
  "1. O immaculate Mary! who obtained by your profound humility and perfect chastity to be preferred, before the most renowned women of all ages, for the Mother of your Creator, obtain for us the grace to live like you in the practice of these two beautiful virtues, that we may at length attain, with you, to the joy of our Lord. Ave.\n\n2. O immaculate Mary! who was troubled when you heard the angel's praises, obtain for us the grace to have, like you, a lowly esteem of ourselves, that, shrinking from the praises of men, we may solely endeavour to deserve the approbation of our Lord. Ave.\n\n3. O immaculate Mary! who valued the privilege of virginity not less than the glory of being the Mother of God, obtain for us the grace that we may willingly sacrifice all things, rather than sully the purity of our souls. Ave.\n\n4. O immaculate Mary! who called yourself the handmaid of the Lord, with an extraordinary humility, after the Archangel Gabriel had announced that you were to be His Mother, obtain from the Lord that we may never be elated by any gifts with which God may favour us, but that they may advance us in virtue, and unite us more and more with the true source of all happiness. Ave.\n\n5. O immaculate Mary! who did not refuse to become the Mother of the Redeemer for the salvation of men, though you knew the great sacrifice which you must one day make of Him on the cross, and the bitter passion which you would have to endure with Him, obtain for us, I pray you, that we may never refuse to make any sacrifice which may be required of us for His glory or for the salvation of our neighbour. Ave.\n\n6. O immaculate Mary! who by that fiat which you pronounced when you consented to become the Mother of the Word, rejoiced heaven, consoled earth, and affrighted hell; obtain for us a perfect confidence in your holy protection, by which we may obtain the copious benefits of your Son's redemption, to which you, O great Virgin, lent your desired aid. Ave.\n\n7. O immaculate Mary! who by a miracle till then unheard of became the Mother of the Incarnate Word, without the smallest stain on your spotless purity; obtain, we pray you, that we may be reserved and modest in our looks, words, and actions, and never sully, by any stain, that purity which is suited to our profession. Ave.\n\n8. O immaculate Mary! who contracted so intimate a relation with the Most Holy Trinity, that you became at the same time the Daughter of the Holy Father, the Mother of the Holy Son, and the Spouse of the Holy Ghost, obtain for us that we may so preserve the purity of our souls, that we may be worthy to be the temples of the Father who created us, of the Son who redeemed us, and of the Holy Spirit who sanctifies us. Ave.\n\n9. O immaculate Mary! who had the especial privilege of bearing in your virginal womb Him whom heaven and earth cannot contain, obtain for us that we may so exercise ourselves in continual humility, penitence, charity, and prayer, that we may worthily receive your divine Son, when He vouchsafes to visit us in the blessed Sacrament; and may also be blessed by this gracious presence at the moment of our death; and that at length we may contemplate and possess Him, together with you, and with the angels and saints in heaven. Ave.";

/** Pagani's numbered petitions for the novena of the Visitation, all said on each of the nine days. */
const PAGANI_VISITATION_NOVENA_PRAYER =
  "1. By that purity of intention, through which, O Mary! you quitted your home, and proceeded to visit your cousin Elizabeth, obtain for us, we pray, the grace of seeking in all that we do only the pure glory of God. Ave.\n\n2. By that holy care with which you took the road to the mountains of Judea, obtain for us, we pray, the grace to walk continually in the way of holiness, that we may never be driven back by any obstacles which our enemies may oppose against us. Ave.\n\n3. By the profound humility which induced you, O Mary! first to salute your cousin Elizabeth, obtain for us, we pray, the grace to turn to our profit whatever occasions may be offered us for the practice of this virtue, so beautiful and so necessary for our salvation. Ave.\n\n4. By that extreme joy which you infused into the soul of Elizabeth, when you tenderly embraced her, obtain for us, we pray, the grace to continue until death in the profession of piety, that we may attain to the fulness of heavenly happiness. Ave.\n\n5. By that extraordinary favour which you, O Mary! obtained for John, that he should be sanctified in his mother's womb before he saw the light, obtain for us, we pray, the grace of preserving ourselves free from all stain till death. Ave.\n\n6. By the most humble confession which you made, O Mary! of that marvellous work which Almighty God had performed in you, by which you became the object of the benediction of mankind, obtain for us the grace always to acknowledge the blessings which we receive from the Lord, and to employ them to His honour and glory. Ave.\n\n7. By that ardent charity which you, O Mary! practised during the three months in which you dwelt in the house of Elizabeth, obtain for us, we pray, the grace to be always ready to assist with affection all the necessities of our neighbours. Ave.\n\n8. By the model which you, O Mary! exhibited of every virtue in your daily intercourse with your relations, Elizabeth and her holy spouse Zacharias, obtain for us, we pray, that we may have grace to give continual edification to our neighbours, by all our words and actions. Ave.\n\n9. By that admirable detachment from your nearest relations, O Mary! which you exhibited, when, having completed all the duties which you had undertaken in the house of Elizabeth, you returned immediately to your house in Nazareth, obtain for us, we pray, that we may be enabled always to live so detached from the things of the world, as never to mingle in the affairs of men, except when summoned by necessity or charity; that our hearts may be fixed on God alone, from whom we hope for peace in this life and blessedness in another. Ave.";

/** Pagani's numbered petitions for the novena of the Purification, all said on each of the nine days. */
const PAGANI_PURIFICATION_NOVENA_PRAYER =
  "1. By the heroic obedience which you, O great Virgin! practised in submitting to the law of purification, obtain for us the most exalted obedience to all the laws of God, of the Church, and of our superiors. Ave.\n\n2. By that angelic modesty and heavenly devotion with which you went and presented yourself in the temple, obtain for us, that we may conduct ourselves in the house of God with that exterior and interior devotion which are fitting its sanctity. Ave.\n\n3. By the holy care with which you sought, O most pure Virgin! to cleanse yourself by the sacred rite of purification from the least appearance of outward uncleanness, obtain for us an insatiable desire to cleanse ourselves from the smallest stain of sin. Ave.\n\n4. By that profound humility which led you to resort to the temple amongst sinners, though you were the most perfect of creatures, obtain for us such a spirit of humility, as shall render us dear to God and deserving of His favours. Ave.\n\n5. By that perfect faith in God your Son, which you, O Mary! preserved when you heard the prophecy which foretold that He should become an occasion of contradiction and ruin to many, obtain for us an equally firm and lively faith amidst all temptations and contradictions. Ave.\n\n6. By the invincible resignation with which, O Mary! you listened to the bitter prophecy of holy Simeon, that a sword of sorrow should pierce through your soul, obtain that we also may preserve a most perfect resignation amidst the most afflicting events by which God, in His infinite wisdom, may be pleased to try us. Ave.\n\n7. By the intense charity which induced you, O Mary! to offer to the eternal Father the holy sacrifice of your Son for the redemption and salvation of all men, obtain for us that we may be willing to sacrifice to the Lord whatever is most dear to us, whenever it shall be requisite for our sanctification and salvation. Ave. Gloria.";

/** Pagani's numbered petitions for the novena of the Assumption, all said on each of the nine days. */
const PAGANI_ASSUMPTION_NOVENA_PRAYER =
  "1. Most blessed Virgin! by the joy your soul experienced when you heard yourself called to immortal glory; in humility we pray you to obtain for us the grace so to live that we may meet the approach of death with joy. Ave.\n\n2. Most lovely Virgin! who consoled the holy apostles when, assembled to be present at your death, they deeply lamented their grievous loss; deign to comfort us in all our troubles, especially in our agony and at the hour of our death. Ave.\n\n3. Immaculate Virgin! whose death was not the effect of sin, but of the power of Divine love, which freed your most pure soul from all its earthly chains, that it might fly to the embraces of your divine Son; obtain for us, that by an act of the love of God, we may close this life, and be united for ever with our supreme Good. Ave.\n\n4. We rejoice with you, O elect Virgin, for the honours which were paid by the angels to your body when they sang hymns of praise and glory to the adorable ark in which the Eternal Word had been incarnate. Ah, obtain for us that we may be preserved so pure and chaste, that we may be permitted to enjoy their society in heaven. Ave.\n\n5. Blessed were you, O admirable Virgin, in that happy resurrection in which you were invested with celestial beauty! Oh, well were you then rewarded for all that you had suffered during life! Help us, O dear Mother, to endure, for the love of Jesus, every suffering; that, in the resurrection, we may also obtain the gift of a glorified body. Ave.\n\n6. We venerate, O great Mother of God, your glorious assumption into heaven, accompanied by the angelic choirs in splendid triumph, when you were raised by your only Son to the highest and most glorious place in His blessed kingdom. O triumphant Virgin! disdain not to cast a glance from your throne upon our wretchedness; detach us from this world, and draw our hearts to yourself, that by humbling ourselves on earth, we may be made fit to be exalted with you in heaven. Ave.\n\n7. O Mary, great Daughter of the eternal Father who crowned you with dominion over heaven and earth! ah, be pleased to make use of your power in our favour, by subduing our spiritual enemies, and those of the holy Church, that your Son Jesus may reign triumphant over all things. Ave.\n\n8. O great Mother of the Eternal Word! by that celestial wisdom with which your divine Son adorned you in your triumphant assumption, procure for all Christians, for all heretics, and for all infidels, the light by which they may understand the truths of the Gospel, and the grace which shall enable them to obey them. Ave.\n\n9. Praised be God, O most pure Spouse of the Holy Spirit, who encircled your head with the brightest crown of glory. Oh, be pleased to point out to us how we may follow your blessed footsteps! O prudent Virgin, behold our misery! Powerful Queen, aid us with your power! Tender Mother, make us worthy of love by an imitation of your virtues, most especially of your fervent charity, that we may be partakers of the glories of your immortality. Ave. Gloria.";

/** The invocations and prayers of Meditation 1 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_1 =
  'Sancta Maria, ora pro nobis. "Holy Mary, pray for us."\n"We beseech thee, therefore, O holy Virgin, to grant us the help of thy prayers with God; prayers that are more precious than all the treasures of the world; prayers that obtain for us a very great abundance of graces; prayers that confound all enemies and triumph over their strength."\n\nSancta Maria. "Holy Mary."\nAh, my Lady, had I always invoked thee in my temptations, I should not have fallen. For the future I will never cease to invoke thee, saying, "Mary, help me; Mary, succor me." And do thou obtain me the grace always to invoke thee in time of spiritual danger.\n\nSancta Dei Genitrix. "Holy Mother of God."\nO great Mother of God, pray to Jesus for me. Behold the miseries of my soul and pity me. Pray, and never cease to pray, until thou seest me safe in paradise. O Mary, thou art my hope; abandon me not. "Holy Mother of God, pray for us."';

/** The invocations and prayers of Meditation 2 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_2 =
  'Mater divinæ gratiæ. "Mother of Divine Grace."\nThen, my Queen, if I love thee, I no longer shall be poor as I am. After God, I love thee above all things; do thou obtain me greater tenderness and love for thy goodness. St. Bonaventure tells me that all whom thou willest are saved; therefore will I address thee with the same saint, "O salvation of all who call upon thee, save me from hell:" but first of all, save me from sin, which alone can take me to hell.\n\nMater purissima. "Mother most pure."\nO most pure Mary, deliver me from it. Grant that in my temptations I may always have recourse to thee, and invoke thee as long as the temptation lasts.\n\nMater inviolata. "Mother undefiled."\nAh, my immaculate Queen, fair dove, and the beloved of God, disdain not to cast thine eyes on the many stains and wounds of my soul: see me, and pity me. God, who loves thee so much, denies thee nothing; and thou knowest not how to refuse those who have recourse to thee. O Mary, to thee I have recourse; pity me. "Mother inviolate, pray for us."';

/** The invocations and prayers of Meditation 3 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_3 =
  'Mater amabilis. "Mother most amiable."\nO most beautiful Mary, O most amiable Mary, thou hast gained the heart of God; take also my poor heart, and make me a saint. I love thee; in thee is my confidence. "Most amiable Mother, pray for us."\n\nMater Salvatoris. "Mother of our Redeemer."\nI remind thee, then, O Mother of my Saviour, that thou didst once offer the life of the Son to God; save me now by thy intercession.\n\nVirgo veneranda. "Virgin most venerable."\nO Mother of God, my Mother Mary, I venerate thee, and would wish thee to be venerated by all hearts, as the exalted Lady that thou art. Pity a poor sinner who loves thee and trusts in thee. "Virgin most venerable, pray for us."';

/** The invocations and prayers of Meditation 4 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_4 =
  'Virgo prædicanda. "Virgin most renowned."\nO Queen of heaven, from this time forward I am determined to do all that I can to cause thee to be venerated and loved by all. Accept my desire and help me to execute it; in the mean time inscribe me in the number of thy servants, and never permit me again to become a slave of Lucifer.\n\nVirgo potens. "Virgin most powerful."\nO Mary, thou canst make me a saint; I rely on thee.\n\nVirgo clemens. "Virgin most merciful."\nSee, then, O Mary, see my miseries and help me. "Virgin most merciful, pray for us."';

/** The invocations and prayers of Meditation 5 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_5 =
  'Virgo fidelis. "Virgin most faithful."\nO Mother of God, in thee do I place all my confidence; thou must preserve me from falling any more into sin. My Lady, abandon me not, obtain me the grace rather to die than to lose the grace of God.\n\nCausa nostræ lætitiæ. "Cause of our joy."\nO Mother of God, thou art my joy and my hope; for thou deniest thy graces to no one, and thou obtainest all that thou willest from God.\n\nVas insigne devotionis. "Vessel of singular devotion."\nO blessed art thou my Lady, who wast always, and in all, united to the divine will. Obtain for me the grace to spend the rest of my life in constant conformity to the will of God.\n\nTurris eburnea. "Tower of Ivory."\nThen, O my sovereign Lady, because thou art so beloved of God, thou canst obtain us every grace; and because thou art terrible to the evil spirits, thou canst deliver us from all their snares. Have mercy on us, who glory in living under thy protection.';

/** The invocations and prayers of Meditation 6 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_6 =
  'Domus aurea. "House of Gold."\nO Mary, thou lovest God so much, and therefore thou desirest to see him loved by all. This is the grace which above all others I ask of thee, and which I hope from thee; obtain me great love for God.';

/** The invocations and prayers of Meditation 7 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_7 =
  'Rosa mystica. "Mystical Rose."\nO my dear Mother, could I but love thee as thou lovest me! I will not, however, cease to do all that I can to honor and love thee. My most sweet Lady, do thou obtain for me grace to be faithful to thee.\n\nTurris Davidica. "Tower of David."\nAh, my Queen and Mother, I rejoice in thy greatness, and am willing rather to sacrifice my life than that thy glory should be diminished in the least degree, were such a thing possible. O that I could only by shedding every drop of my blood cause all nations of the earth to adore thee and love thee as the great Lady which thou art!\n\nFœderis arca. "Ark of the Covenant."\nO Mother of mercy, will I then say to thee, in the words of St. Bernard, "Remember that it has never been heard of in any age that any sinner who had recourse to thee was rejected by thee." I, a miserable sinner, have recourse to thee and trust in thee.\n\nJanua cœli. "Gate of Heaven."\nAh, my Mother, in thee do I repose my hope of eternal salvation. I love thee; do thou save me; never allow a servant of thine who loves thee to go to blaspheme thee in hell.';

/** The invocations and prayers of Meditation 8 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_8 =
  'Refugium peccatorum. "Refuge of Sinners."\nSince, then, O my Lady, thou art the refuge of all sinners, thou art also my refuge. Thou, who despisest no one who has recourse to thee, despise me not, who recommend myself to thee: "Refuge of sinners, pray for us." O Mary, pray for us, and save us.';

/** The invocations and prayers of Meditation 9 on the Litany of Loreto. */
const LITANY_OF_LORETO_DAY_9 =
  'Consolatrix afflictorum. "Comfortress of the afflicted."\n"O Mary, console us always, but especially at the hour of our death: come at that last hour and receive our souls, and present them thyself to thy Son, who will judge us."\n\nAuxilium Christianorum. "Help of Christians."\nAh, my Queen, had I always had recourse to thee, I should never have been conquered by my enemies; henceforth thou shalt be my strength: in my temptations I will always have recourse to thee; from thee do I hope for victory.\n\nRegina Martyrum. "Queen of Martyrs."\nO my afflicted Mother, be graciously pleased, by the merit of the sorrows which thou didst endure at the foot of the cross, to obtain for me true sorrow for my sins and love for Jesus my Redeemer; and by the sword which transpierced thy heart when thou didst see him bow down his head and expire, I beseech thee to help me at the hour of my death, and then to obtain me eternal salvation, that I may love thee with thy Jesus forever.';

/** Day 1 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_1 =
  'O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO most glorious and Blessed Virgin Mary of Mount Carmel! I, an unworthy wearer of thy holy scapular, confident, however, that the Church does not call thee in vain the "Refuge of sinners," do beseech thee to make me sensible of the favors thou hast conferred upon me by promoting the welfare of thy holy order, that, being truly contrite for past offences, I may, by thy aid and assistance, break the chains of my slavery and live henceforward in the happy liberty of the children of God. Through Our Lord Jesus Christ, who with the Father and the Holy Ghost liveth and reigneth, one God, world without end. Amen.\n\nLitany of the Blessed Virgin.';

/** Day 2 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_2 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO almighty and eternal God, vouchsafe to impart to us, Thy unworthy servants, a small portion of that heavenly grace with which Thou hast been pleased to sanctify Thy servant Mary; and grant that, through her intercession and protection, we may be shielded against all temptations, and be secure from all our enemies. Through Our Lord Jesus Christ, Thy Son, who liveth and reigneth with Thee in the unity of the Holy Ghost, one God, world without end. Amen.\n\nLitany of the Blessed Virgin.";

/** Day 3 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_3 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nRemember, O most pious Virgin, it is a thing unheard of that thou hast ever forsaken those who have recourse to thee. Encouraged with this hope and confidence, my most dear Mother, I, a miserable sinner, cast myself at thy sacred feet, humbly begging that thou wilt adopt me as thy child forever, and take upon thee the care of my eternal salvation: do not, Mother of the Word Incarnate! reject my petition, but graciously hear and grant it. Amen.\n\nLitany of the Blessed Virgin.";

/** Day 4 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_4 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO most glorious and ever-blessed Virgin Mary of Mount Carmel! I, thy unworthy child and client, sensible of the favors thou enjoyest with God, humbly present myself before thee, and beg that thou wilt intercede and obtain for me true contrition and repentance, an undefiled purity of heart, and a conscience free from sin and all offence against God. Direct me, I beseech thee, in all my actions during life, and in that awful moment when my poor soul departs from my body conduct it into the presence of thy Son, there to sing his praises for ever and ever. Amen.\n\nLitany of the Blessed Virgin.";

/** Day 5 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_5 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO most glorious Virgin Mother! who, by favor of thy divine Son, hast so great power in heaven and on earth, enlighten my blindness and strengthen my resolution. The zeal thou hast in promoting the welfare of thy sacred Order, and the part thou takest in seeing the grace of Our Redeemer abound in us, give me a right to thy interest in this my request; and when that awful hour of death approaches, be to me, I beseech thee, a tender mother, and by thy prayers dispose thy Son Jesus Christ favorably in my regard. Amen.\n\nLitany of the Blessed Virgin.";

/** Day 6 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_6 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO most glorious and ever-virgin Mary of Mount Carmel! I offer unto thee this day all my thoughts, words, and actions. I am weak and infirm, dejected and cast down at every tribulation, and terrified at the dismal prospect a review of my own interior gives me. All is misery, a continual propensity to vice and repugnance to virtue. O Mother of mercy and Refuge of sinners! thou wilt not reject a contrite and humble heart. Intercede for me, I beseech thee, that I may so live in this sinful world that at the hour of death I may be worthy to be admitted into the regions of bliss. Through Our Lord Jesus Christ, who with the Father and the Son liveth and reigneth, one God, world without end. Amen.\n\nLitany of the Blessed Virgin.";

/** Day 7 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_7 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO most holy Mary of Mount Carmel! pray for me, I beseech thee, that, through the merits of thy Son, I may enjoy perpetual health of mind and body, and that I may serve him faithfully in this life, and hereafter see, love, and enjoy him in the kingdom of his glory. Who with the Father and the Holy Ghost liveth and reigneth, one God, world without end. Amen.\n\nLitany of the Blessed Virgin.";

/** Day 8 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany. */
const MOUNT_CARMEL_SCAPULAR_DAY_8 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO most glorious and ever-blessed Virgin Mary of Mount Carmel! faithful protectress of all those who wear thy holy scapular, behold thy poor servant humbly prostrate at thy feet, deploring his misery and imploring thy prayers, and beseeching thee to protect him through the stormy ocean of this tempestuous world; hear my prayers, then, O Refuge of sinners! and after this our exile show unto us the blessed fruit of thy womb, Jesus, O most clement, O most loving, O most sweet Virgin Mary!\n\nLitany of the Blessed Virgin.";

/** Day 9 of the novena to Our Lady of Mount Carmel for wearers of the Brown Scapular: the preparatory prayer, the day's prayer and the rubric for the Litany, then the prayers at the conclusion of the novena. */
const MOUNT_CARMEL_SCAPULAR_DAY_9 =
  "O glorious Queen of angels! most pure and ever-blessed Virgin Mary of Mount Carmel! powerful advocate of all those who wear thy holy scapular! faithful protectress of all the servants of thy Son Jesus Christ! I, an unworthy sinner, do this day, in the presence of thy beloved Son, my Saviour, choose thee for my patroness, that through thy intercession I may receive from him whatsoever grace may be necessary and profitable for me now and at the hour of my death. Amen.\n\nOur Father, Hail Mary, three times.\n\nO blessed finder of grace, Mother of life, Mother of salvation! may we through thee have access to thy Son; and that he who was given us through thee may receive us through thee, may thy integrity and innocence excuse before him the stain of our corruption; may thy abundant charity cover the multitude of our sins, and thy glorious fruitfulness supply our want of merits. Our Mother, our Mediatrix, our Advocate! reconcile us to thy Son, commend us to thy Son, present us to thy Son; by the grace with which thou art honored, obtain that he who through thee put on our weakness may through thee make us partakers of his bliss and glory. Amen.\n\nLitany of the Blessed Virgin.\n\nPrayers at the conclusion of the novena.\n\nO God, who hast deigned to honor the order of Carmel with the glorious title of Thy Virgin Mother, grant the grace of her protection to all who celebrate this solemn commemoration, so that through her we may attain eternal happiness. Amen.\n\nO glorious Virgin Mary! Queen of Carmel, Mother of God and of poor sinners, special protectress of all those who wear thy holy scapular, I supplicate thee, by the glory that has been accorded thee by the Incarnate Word in choosing thee for his Mother, to obtain for me the pardon of my sins, amendment of my life, salvation of my soul, consolation in my pains, and in particular the grace I ask in this novena, provided it be conformable to the will of thy divine Son. Amen.";

/** The five petitions of the novena to St. Dominic, each with its Glory be, said on each of the nine days. */
const LASANCE_DOMINIC_NOVENA_PRAYER =
  "1. O glorious St. Dominic, who were from your earliest infancy the admiration of all the world, by the continual practice of prayer, fasting, vigils, and all kinds of austerity, as well as by the most zealous custody of all your senses, and the most active charity to your neighbor, depriving yourself of all your wealth that you might supply the necessities of the poor: obtain for us the grace to apply ourselves continually to exercises of piety, penance, and charity, and, by the sanctification of our own souls, to promote the salvation of our neighbor.\nGlory be, etc.\n\n2. O glorious St. Dominic, who by the new Order which you instituted, became the support of the Church in the most stormy times: obtain for us, we pray, the grace to be at all times zealous for the glory of the Church, that, regarding her interests as our own, we may never spare ourselves in defending her, but endeavor to make her glorious and triumphant throughout the whole world.\nGlory be, etc.\n\n3. O glorious St. Dominic, who received from the hands of the Blessed Virgin herself, and spread, at her command, through the whole world, the efficacious devotion of the Rosary, which, from the beginning, operated innumerable miracles: obtain, we pray, that we may be always most devout to Mary, especially in her Rosary, which she established to confound heresy, arouse faith, drive away scandals, promote virtue, merit the divine mercy, and to support and defend the holy Church.\nGlory be, etc.\n\n4. O glorious St. Dominic, who never felt the smallest sentiment of vanity, either at the increase of your Order or at the important victories you obtained over heretics, nor at all the miracles which God deigned to work by your means: obtain for us, we pray, the grace to tread faithfully in the way of humility, that we may at length share in the eternal reward to which you have attained.\nGlory be, etc.\n\n5. O glorious St. Dominic, whose characteristics were, besides humility and apostolic zeal, an eminent spirit of prayer and the constant recollection of thy soul in God, obtain for us the grace that we may love prayer, and walk constantly in the presence of God, so that we may attain to eternal union with Him in heaven.\nGlory be, etc.";

/** The nine petitions of the novena to St. Catharine of Siena, each with its Glory be, said on each of the nine days. */
const LASANCE_CATHARINE_NOVENA_PRAYER =
  "1. St. Catharine, fairest and most glorious of the daughters of St. Dominic, by that spirit of prayer, which was your delight from your infancy, obtain for us the love and practice of prayer, and the grace so to converse with God as to become daily more pleasing to Him.\nGlory be, etc.\n\n2. By that especial love which you, O great saint, bore to the virtue of purity, consecrating yourself at eight years of age to the Lord by an irrevocable vow, and afterwards by cutting off your hair, by sighs and tears, rejecting the most honorable and advantageous offers of marriage: obtain for us, we pray you, the grace to be always pure in mind and heart, and to detest and abhor everything which could offend in the smallest degree against a virtue so sublime, which raises men to the rank of angels, and makes them most beloved by God.\nGlory be, etc.\n\n3. By that spirit of retirement which made you, O great saint, desire to behold no one but your Jesus, who when you were distracted by continual employment in your family, taught you to build a solitude in your heart and keep it at all times filled with thoughts of heaven: obtain for us, we pray, the grace so to love solitude and retirement, however the world may invite us to share its pleasures and its pomps, that our hearts may always turn to God amidst the most dissipating cares which may come upon us in our state of life.\nGlory be, etc.\n\n4. By the spirit of penance which taught you to inflict upon yourself, even in your earliest years, the most painful mortifications: obtain for us the grace to bear with patience whatever afflictions God may be pleased to order for our good, and to mortify voluntarily all the perverse inclinations of our hearts, and all the unruly desires of our senses, that we may become, in some measure, like our crucified model, Jesus.\nGlory be, etc.\n\n5. By that heroic charity which led you, O great saint, to attend and minister with your own hands to the poor sick who had been abandoned by all others in disgust, and for which you were repaid only by insult, rudeness, and persecution: obtain of the Lord for us the grace to be, at all times, equally ready to assist our neighbor in his necessities, and to pardon him generously when he returns only insults for the benefits we confer on him, that we may merit the blessedness promised in this life and the next to meekness and true mercy.\nGlory be, etc.\n\n6. By that wonderful constancy with which, by redoubling your prayers, your austerities, and your zeal, O great saint, you dispersed the powers of hell, which, arrayed against you, persecuted you for so long a time with frightful images and violent temptations, and for which you received as a reward from your divine Spouse the privilege of speaking familiarly with His saints and His most blessed Mother Mary, and also were favored with ecstasies, visions, and revelations, and the most intimate communications with His divine Majesty: obtain for us, we pray you, the grace to be equally powerful against the assaults of our spiritual enemies, and that we may, in reward of our fidelity, increase in divine love, and obtain an inseparable union with our true Good.\nGlory be, etc.\n\n7. By that supernatural light with which you, O great saint, were miraculously enabled to counsel the Roman Pontiff, who came in person to consult you, when you obtained for him a reconciliation with his adversaries, and his return to Rome: obtain for us of the Lord the grace to know, in all our doubts, that which is most conformable to the will of God, and most conducive to the salvation of souls, that in all our actions we may promote the honor of God and the welfare of our neighbor.\nGlory be, etc.\n\n8. By that especial devotion which you, O great saint, had to Jesus Christ in the Blessed Sacrament, Who sometimes communicated you with His own hands: obtain for us, we pray you, the grace to feel toward the Blessed Sacrament the most fervent devotion, that we may rejoice to converse with Jesus and receive Him into our bosoms, for His honor and glory, and for the salvation of our own souls.\nGlory be, etc.\n\n9. By the extraordinary love which you had for suffering, for which you were accounted worthy to share in the most bitter pains of your crucified Spouse; and, through which, though reduced to the extremest weakness, you became a spectacle of admiration to all around you by the serenity and joy with which you endured the most frightful torments: obtain for us, of the Lord, grace to receive with Christian resignation and holy joy all the crosses with which God shall be pleased to visit us, so that, after bearing the mortification of Christ in our bodies, we may, with you, share in the fulness of His blessedness for all eternity.\nGlory be, etc.";

/** The prayer, versicle and collect of the novena to St. Jane Frances de Chantal, said on each of the nine days. */
const LASANCE_JANE_FRANCES_NOVENA_PRAYER =
  "O glorious saint, blessed Jane Frances, who, by thy fervent prayer, attention to the Divine Presence, and purity of intention in thy actions, didst attain on earth an intimate union with God, be now our advocate, our mother, our guide in the path of virtue and perfection. Plead our cause near Jesus, Mary, and Joseph, to whom thou wast so tenderly devoted, and whose holy virtues thou didst so closely imitate. Obtain for us, O amiable and compassionate saint! the virtues thou seest most necessary for us; an ardent love of Jesus in the Most Holy Sacrament, a tender and filial confidence in His blessed Mother, and, like thee, a constant remembrance of His sacred Passion and death. Obtain also, we pray thee, that our particular intention in this novena may be fulfilled.\n\nV. St. Jane Frances, pray for us,\nR. That we may be made worthy of the promises of Christ.\n\nLet us pray.\nO almighty and merciful God, Who didst grant blessed St. Jane Frances, so inflamed with the love of Thee, a wonderful degree of fortitude through all the paths of life, and wast pleased through her to adorn Thy Church with a new Religious Order; grant, by her merits and prayers, that we, who, sensible of our weakness, confide in Thy strength, may overcome all adversities with the help of Thy heavenly grace, through Jesus Christ our Lord. Amen.";

/** The three petitions of the novena to St. Ursula, each with its Glory be, said on each of the nine days. */
const LASANCE_URSULA_NOVENA_PRAYER =
  "1. By that most tender love which you always bore to Jesus Christ, and which led you, though born a princess, and educated at your father's court, and sought in marriage by the most renowned princes of Europe, to renounce all earthly delight and consecrate your virginity to God: O ask for us, glorious St. Ursula, that we may never sully the purity which is suitable to our state of life, and never deviate, either through menaces or allurements, from any good resolutions.\nGlory be, etc.\n\n2. By that magnanimous resolution which you infused into your companions, of preferring their espousals with Jesus Christ to a union with the most distinguished personages in the world; by the joy which you felt when the ship in which you were sailing was forced to take shelter in a barbarous land, preferring to fall into the hands of barbarians than into the hands of those who were waiting for you and your companions to make you their spouses; intercede for us, O glorious St. Ursula, that we may recognize the hand of God in all the evils which happen to us on earth, and use all our powers to assist our neighbors in the way of salvation.\nGlory be, etc.\n\n3. By that admirable courage with which you and your companions united in sacrificing your blood and your lives sooner than fail in the fidelity you had vowed to Jesus, your Spouse; and by the infinite blessings which have flowed from the various Orders, instituted under your protection and your name, to instruct youth in the most solid piety: intercede for us all, O most glorious St. Ursula, that we may always be ready to suffer any torments rather than violate the dictates of our consciences, and so to live as always to merit your particular patronage on earth and a share of your glories in heaven.\nGlory be, etc.";

/** The five petitions of the novena to St. Bernard, each with its Glory be, said on each of the nine days. */
const LASANCE_BERNARD_NOVENA_PRAYER =
  "1. Admirable St. Bernard, who, after having been the delight of your parents by the innocence of your manners, became the model of Religious by the austerity of your penances and the fervor of your piety; and who had also the happiness of drawing with you, to a life of holiness, your whole family and an infinite number of distinguished persons: obtain for us, of the Lord, the grace that we may correspond to the divine inspirations, and live up to the perfection of our state.\nGlory be, etc.\n\n2. Admirable St. Bernard, who, advancing in sanctity as you progressed in learning, practiced the most severe mortification of your senses, and conceived the deepest hatred for every kind of sin: obtain for us, of the Lord, the grace, by the practice of penance, always to mortify our unruly passions.\nGlory be, etc.\n\n3. Admirable St. Bernard, who, after founding many monasteries, and filling them with fervent and holy monks effected the greatest good by your counsel and advice; so that not only kings and princes, but bishops and popes applied to you to heal public discords and distresses: obtain for us, of the Lord, the grace to labor continually for His glory, and to walk so faithfully in the way of His precepts, that we may at all times merit His aid.\nGlory be, etc.\n\n4. Admirable St. Bernard, who, passing like an apostle through all the kingdoms of the West, carried to all peace and joy, deciding the most difficult questions, concluding the most complicated affairs, assisting at counsels, confuting errors, converting the most hardened sinners: obtain for us, of the Lord, the grace, that by our lives we may shed the odor of Jesus around, and have, like you, a lively faith and an ardent love for the Most Holy Eucharist, the greatest and the most precious treasure of Christianity.\nGlory be, etc.\n\n5. Admirable St. Bernard, who, notwithstanding your numberless occupations, your continual journeys, and your delicate health, never ceased your meditations, your prayers, and your penances; who, not content to announce the word of God by your voice, also composed most valuable works, for which you have merited the glorious titles of Doctor and Father of the Church; and who, by your beautiful writings for her glory, promoted devotion to Mary: obtain for us, of the Lord, the grace of perseverance till death, in all the practices of piety and penance suitable to our state, and always to breathe the most fervent devotion to our Mother Mary.\nGlory be, etc.";

/** The three petitions of the novena for the feast of All Saints, with their Hail Marys and Glorys, said on each of the nine days. */
const LASANCE_ALL_SAINTS_NOVENA_PRAYER =
  "1. O Queen of All Saints, O most powerful mediatrix between God and man! O supreme arbitress of grace, holy Mary, vouchsafe to look upon us with Thine eyes of mercy: obtain for us that we may follow thee in the path of virtue, and merit the favor of thy most powerful intercession, by which we may attain to a share of thy glory in paradise.\nThree Hail Marys.\n\n2. O heavenly spirits, who from the beginning of the world encircled the throne of the Most High, and who are continually employed in singing His praises, in executing His commands, and who burn in the fire of His love: obtain for us the grace to place all our happiness in obeying the divine laws, and in faithfully performing the duties of our calling, that so we may one day attain to the possession of those thrones which were made void by the rebellion of your companions.\nThree Glorys.\n\n3. O most faithful patriarchs, most holy prophets, most zealous apostles, most invincible martyrs, most righteous confessors, most chaste matrons, most pure virgins, who now reign with Christ in heaven, from the bright seats of your blessedness cast your eyes of pity upon us, unhappy exiles in this vale of tears. O happy spirits, pray for us. Obtain for us all grace to walk faithfully in your footsteps, to follow courageously your example, and to copy your virtues in our lives; and that, meditating upon your victories, we may attain to a participation of your immortal glory.\nThree Glorys.";

/** The four petitions of the novena to St. Ignatius Loyola, each with its Glory be, said on each of the nine days. */
const LASANCE_IGNATIUS_NOVENA_PRAYER =
  '1. O glorious St. Ignatius, who, on reading the lives of saints, didst resolve to imitate them, renouncing for ever all worldly honors, and seeking nothing but the greater glory of God: obtain for us also an efficacious resolution to practise all divine virtues, and like you, free from all earthly love, to desire nothing but to see Our Lord and Saviour Jesus Christ glorified throughout the whole world.\nGlory be, etc.\n\n2. O glorious St. Ignatius, who, resolving to imitate with perfection the poverty, the humility, and the patience of Jesus Christ, didst renounce all the comforts of your home, and didst suffer joyfully the most unjust persecutions: obtain for us the grace of living so detached from all the things of the world, and of enduring so tranquilly all its persecutions, that we may be indeed faithful disciples and true imitators of Jesus Christ.\nGlory be, etc.\n\n3. O glorious St. Ignatius, who through your Spiritual Exercises and the instrumentality of your Society hast converted innumerable souls to God, and in a great measure repaired the ruin caused by heresy and evil customs: obtain for us the grace to be always ready to make any sacrifice to convert souls to God, and to promote the glory of His Church; that we also may at length share in that blessedness which is promised to those who hunger and thirst after justice.\nGlory be, etc.\n\n4. O glorious St. Ignatius, chosen in the designs of God from eternity to be the founder of the Society of Jesus and the father of innumerable saints, vouchsafe to protect me, to direct me, to pray for me, and to guide my petitions, that I may ask and do only what is according to your maxim: "Ad majorem Dei gloriam:" "For the greater honor and glory of God." Obtain for me, also, and for all poor sinners light and salvation through the sacred wounds of Jesus Christ, Our Lord and Saviour. Amen.\nGlory be, etc.';

/** The prayer of the novena for Easter, said on each of the nine days. */
const LASANCE_EASTER_NOVENA_PRAYER =
  'Jesus, Who didst confound all Thine enemies by clothing in glory and splendor that body which had been the victim of the cruelty of man, give me grace to die to myself that I may rise again with Thee, and after Thy likeness lead a new, divine, immortal life: new, by change of conduct, divine by the generosity and purity of my love, immortal by perseverance in well doing. Work in my heart, O Lord, this happy change; make me pass from death to life, from darkness to light, from a life full of imperfections to a life perfect and worthy of Thee. Make me go on from light to light, from virtue to virtue, till I come at last to Thee, O God of virtue, source of all life, and of all light. To thee also I turn, O holy Virgin, Mother of Our Saviour, on this joyous feast; deign to make me a partaker of that divine joy which thou didst feel on the blessed day of His Resurrection. Dry my tears and free my heart from all oppressive sadness. Let Thy risen Son enter into my heart, as through the closed doors, into the upper chamber. Let Him say to me, as to the apostles, "Peace be to thee"; let Him show to me, as to Thomas, His sacred wounds; let Him abide with me continually, and never more depart from me.';

/** The prayers of the novena to the Blessed Virgin, with the book's rubric for the nine Hail Marys, said on each of the nine days. */
const GOLDEN_MANUAL_BLESSED_VIRGIN_NOVENA_PRAYER =
  "O most holy Virgin! who wert chosen by the adorable Trinity from all eternity to be the most pure Mother of Jesus, permit me, thy humble and devoted client, to remind thee of the joy thou didst receive in the instant of the most sacred incarnation of our divine Lord, and during the nine months thou didst carry him in thy chaste womb. I wish most sincerely that I could renew or even increase that joy, by the fervor of my prayers. O tender Mother of the afflicted! grant me, under my present necessities, that peculiar protection thou hast promised to those who devoutly commemorate this ineffable joy. Relying on the infinite mercies of thy divine Son; trusting in that promise which he has made, that those who ask should receive; and penetrated with confidence in thy powerful prayers; I most humbly entreat thee to intercede for me, and to obtain for me the favors which I petition for in this Novena, if it be the holy will of God to grant them; and if not, to ask for me whatever graces I most stand in need of. (Here specify your request.)\n\nI desire by this Novena, which I now offer in thy honor, to prove the lively confidence I have in thy intercession. Accept it, I beseech thee, in honor of that supernatural love and joy with which thy sacred heart was replenished during the abode of thy dear Son in thy womb; in veneration of which I offer thee the sentiments of my heart, and these nine Hail Marys.\n\nRepeat the Hail Mary nine times, and then say the following Prayer.\n\nO Mother of God! accept these salutations, in union with the respect and veneration with which the angel Gabriel first hailed thee full of grace. I wish most sincerely, that they may become so many gems in the crown of thy accidental glory, which will increase in brightness to the end of the world. I beseech thee, O comfortress of the afflicted! by the joy thou didst receive in the nine months of thy pregnancy, to obtain for me the grant of the favors which I have now implored through thy powerful intercession. For this end, I offer thee all the good works which have ever been performed in thy honor. I most humbly entreat thee, for the love of the amiable heart of Jesus, with which thine was ever so inflamed, to hear my humble prayer, and to obtain my requests.";

/** The prayer of the novena to St. John the Baptist, said on each of the nine days. */
const GOLDEN_MANUAL_JOHN_THE_BAPTIST_NOVENA_PRAYER =
  "O glorious precursor of Jesus Christ! great prophet of the Most High! angel of the Lord! who wert created to go before his face, and to prepare his ways, how high must thy throne be in heaven, since even on earth thou wert so exalted! Thou art truly the first and greatest amongst those born of woman, since the Searcher of hearts pronounced thee such. Thou wert great in thy miraculous birth and wonderful life—great in thy penance and in thy zeal; but thou wert much greater in thy purity of heart, and in the depth of thy humility. Thou didst enter this world of sin in the friendship of thy Creator, and never had the misfortune to offend him—thou wert the minister of baptism to Jesus Christ, yet thou didst humbly acknowledge thyself unworthy to loose the latchet of his shoe. O great saint! that glory which always follows the humble, has been abundantly granted to thee. Jesus Christ himself proclaimed thy praises, and the whole world, to the end of time, will rejoice in thy sacred birth. O miracle of God's power and grace! I conjure thee to raise for us and for all the people of this state, of which thou art the special patron, that powerful voice, which once crying in the wilderness, penetrated the heavens in favor of sinners; and to implore for us the intentions of this Novena, N. N.\n\nO blessed contemplative, whose sweet communications with God were earlier than thy birth; thy food and thy life were the heavenly exercise of prayer; thou wert by excellence the friend of the bridegroom, and canst therefore obtain all things of Him, who so ardently loved thee. Deign then to take all my spiritual necessities under thy protection, and to obtain for us all the graces we stand in need of, particularly perfect docility to the voice of those who preach to us, as thou didst to the Jews, the baptism of penance for the remission of our sins.\n\nO burning lamp! may our hearts be at length inflamed with that fire of love which consumed thee, and which is cast also amongst us by the zealous preaching of those whom the Lord has sent amongst us, to show us the way to him. O shining lamp! enlighten us by thy prayers, that we may know ourselves but infinitely more, that we may know our God, and his only Son Jesus Christ our Lord whom he hath sent, obtain for us to participate frequently and worthily in the holy communion, and with that purity of heart, which enabled thee to discover the Lamb of God, though he was then hidden from all others. O blessed martyr of Jesus Christ, though I am most unworthy to lay down my life for his love as thou didst, yet I entreat of thee to intercede for me that I may live and die in the happy martyrdom of Christian mortification, and the faithful discharge of every duty required by the divine law.";

/** The prayer of the novena to the Sacred Heart, said on each of the nine days. */
const GOLDEN_MANUAL_SACRED_HEART_NOVENA_PRAYER =
  "O sacred and adorable Heart of Jesus! Furnace of eternal charity! Ocean of infinite mercy! Consolation of the afflicted! Refuge of sinners! and Hope of the whole world! I most fervently adore thee, and unite my heart, my affections, and supplications, to the perpetual homage thou thyself renderest to the Divinity on our altars. Most amiable Heart! which hast loved us with an eternal love, supply thyself for my insensibility, and receive my desire at least of loving thee with all the ardor and sincerity thou so justly meritest. But remember, O adorable Heart! that thou hast disclosed thyself to us not only as an object of our adorations; thou desirest much more to engage our love, and to become the ground and motive of our tender confidence. For this end thou wert pierced through with a lance on the cross; and for this same purpose thou remainest a daily victim of thy own love on our altars. O infinitely compassionate Heart of Jesus! which was overwhelmed with sorrow in the garden of Olives, at the view of our spiritual and corporal miseries, I recur to thee now with all the confidence thou desirest I should repose in the extent of thy power and the riches of thy mercy. Convinced that those things which are impossible to human means are infinitely easy to thee, and relying with an humble, steadfast faith on the sacred words of truth itself, that whatever we ask the Father in the name of Jesus should be granted, I now most humbly implore in that adorable name, in virtue of that promise, and through the abundant mercies of the sacred Heart of Jesus, the particular favor I petition for in this Novena. (Specify it.)\n\nO blessed St. Gertrude! and all ye glorious servants of Christ! who while on earth were particularly devoted to the sacred Heart of Jesus, join your prayers with mine and implore from the divine object of all your devotion the grant of the petition which I now make, and specially offer up through thy intercession. Beg likewise from this adorable Heart, which has dominion over all hearts, and could in a moment change the most obdurate, to have compassion on those who are in the dreadful state of mortal sin, and to open to us all the treasures of its mercy at the hour of our death. Amen.";

function repeatedPrayerDays(
  prayerText: string,
  subjects: Array<{ title: string; meditation: string; intentionPrompt: string }>,
): Array<{
  day: number;
  title: string;
  meditation: string;
  prayerText: string;
  intentionPrompt: string;
}> {
  return subjects.map((s, i) => ({
    day: i + 1,
    title: s.title,
    meditation: s.meditation,
    prayerText,
    intentionPrompt: s.intentionPrompt,
  }));
}

const BOOK_OF_NOVENAS_SOURCE =
  "It is taken from 'A Book of Novenas for the Principal Feasts of the Year' (Baltimore: Kelly, Piet and Company, 1878), a small book approved by the Archbishop of Baltimore on 8 March 1878, dedicated to the Sacred Heart of Jesus in the tabernacle and sold for the benefit of an association for the relief of poor churches; for each feast it gives a single prayer, which is said on each day of the novena.";

const PAGANI_SOURCE =
  "It is taken from 'The Way to Heaven: a manual of devotion' (London: James Burns, 1849) by the Very Rev. John Baptist Pagani (1806-1860), provincial of the Institute of Charity in England, who dedicated the book to John Henry Newman. Its chapter of devotions to Our Lady gives a novena for each of her feasts as a series of numbered petitions, each closed with the Ave, the last petition of some with the Ave and the Gloria; the book gives no dates or other directions, and the petitions are all said on each day of the novena.";

const LASANCE_1904_SOURCE =
  "It is taken from the 'Little Book of Novenas' in the Prayer-Book for Religious compiled by the Rev. F. X. Lasance (New York: Benziger Brothers, 1904), whose compiler acknowledges a debt to Pagani and to the 'Choir Manual' of the Sisters of Mercy for many of its novenas.";

const GOLDEN_MANUAL_SOURCE =
  "It is taken from 'The Golden Manual: being a guide to Catholic devotion, public and private' (New York and Montreal: D. & J. Sadlier; American edition entered 1851, the copy cited catalogued as of 1865), whose plates P. J. Kenedy reprinted at New York in 1902. The book gives no dates for its novenas: it describes a novena as a devotion of nine days, in honour of a mystery of the Redemption, of the Blessed Virgin or of a saint, made to obtain a particular request.";

export const novenaGroupFour: CuratedEntry[] = [
  {
    contentType: "NOVENA",
    slug: "novena-feast-of-the-circumcision",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [BOOK_OF_NOVENAS_CIRCUMCISION, CE_CIRCUMCISION],
    payload: {
      slug: "novena-feast-of-the-circumcision",
      title: "Novena for the Feast of the Circumcision",
      summary:
        "A novena kept from 23 to 31 December before the feast of the Circumcision on 1 January. Its single prayer thanks the Infant Jesus for the first shedding of His blood and for the holy name He received on the eighth day, and offers to His Heart every word, deed and suffering of the year that is beginning.",
      background: `On the eighth day the Child was circumcised and given the name Jesus (Luke 2:21). The Catholic Encyclopedia notes that the feast kept at Rome in the seventh century on 1 January was the octave of Christmas, and that the Circumcision fell on that day because Christmas was kept on 25 December; since the reform of the calendar in 1969 the day is kept as the Solemnity of Mary, the Holy Mother of God, whose Gospel still ends with the circumcision and naming of the Child. ${BOOK_OF_NOVENAS_SOURCE} The book dates this novena from 23 to 31 December. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "the offering of the new year to the Heart of the Infant Jesus",
      days: repeatedPrayerDays(BOOK_OF_NOVENAS_CIRCUMCISION_PRAYER, [
        {
          title: "The Eighth Day",
          meditation:
            "The Child submitted to the law of Moses on the eighth day after His birth. The novena begins with that first act of obedience, made in the body before He could speak.",
          intentionPrompt: "What small obedience have I been putting off?",
        },
        {
          title: "The Name Above All Names",
          meditation:
            "The prayer ties the name of Jesus to the shedding of His blood: He becomes the Saviour of the world in virtue of that name and by that blood.",
          intentionPrompt: "Do I say the name of Jesus as a prayer or only as a word?",
        },
        {
          title: "Mercy to All Poor Sinners",
          meditation:
            "Thanks are given for a mercy shown 'to me and to all poor sinners'. No one praying this prayer is left outside it, and no one is prayed for alone.",
          intentionPrompt: "Whom do I need to include when I give thanks?",
        },
        {
          title: "The Source of Every Grace",
          meditation:
            "The first drops of the Precious Blood are the source from which every grace of the coming year will flow. The prayer looks forward from the crib to everything the year will need.",
          intentionPrompt: "What grace will this year most demand of me?",
        },
        {
          title: "A Shelter in Every Tribulation",
          meditation:
            "The same blood is named an asylum, a place of refuge to run to in trouble. The novena asks to know where to go before the trouble comes.",
          intentionPrompt: "Where do I run first when things go wrong?",
        },
        {
          title: "The Heart Opened",
          meditation:
            "The book was dedicated to the Sacred Heart, and its prayer sees the Heart of Jesus already opened in this first shedding of His blood, long before the lance.",
          intentionPrompt: "How have I answered the love that was shown me first?",
        },
        {
          title: "Every Word and Deed",
          meditation:
            "The prayer devotes to that Heart every word and deed, every heartbeat, all that one will do or suffer in the year — an offering made in advance, before the year has been lived.",
          intentionPrompt: "What part of the coming year am I holding back?",
        },
        {
          title: "Strengthen, Enlighten and Shield",
          meditation:
            "Having made its offering, the prayer asks for what it needs to keep it: strength by grace, light and protection.",
          intentionPrompt: "Which of the three do I need most right now?",
        },
        {
          title: "For the Sake of His Name",
          meditation:
            "The novena ends on the eve of the feast by pleading the holy name itself, 'that most holy, most efficacious name of Jesus', for the request it has carried for nine days.",
          intentionPrompt: "What resolution will I begin the new year with?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "23 December, ending on 31 December, the eve of the feast",
      relatedFeastSlug: "solemnity-mary-mother-of-god",
      citations: [BOOK_OF_NOVENAS_CIRCUMCISION, CE_CIRCUMCISION],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-feast-of-the-epiphany",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [BOOK_OF_NOVENAS_EPIPHANY, CE_EPIPHANY],
    payload: {
      slug: "novena-feast-of-the-epiphany",
      title: "Novena for the Feast of the Epiphany",
      summary:
        "A novena kept from 28 December to 5 January before the Epiphany. Its prayer greets the divine Heart with the three Magi and offers, as their gold, frankincense and myrrh, the intellect, the memory and the will in faith, hope and charity, giving thanks for the gift of the true faith.",
      background: `The Epiphany on 6 January celebrates the manifestation of Christ, above all to the Gentiles in the coming of the Magi (Matthew 2:1-12); the Catholic Encyclopedia describes how the Nativity, the Baptism, the miracle at Cana and the visit of the Magi were all celebrated in the feast early in its history. Where it is not a holy day of obligation the solemnity is now kept on the Sunday between 2 and 8 January. The prayer, addressed to the Heart of Jesus like the whole book, reads the Magi's three gifts as the offering of the three powers of the soul. ${BOOK_OF_NOVENAS_SOURCE} The book dates this novena from 28 December to 5 January. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme:
        "thanksgiving for the gift of faith and the offering of the whole soul to Christ",
      days: repeatedPrayerDays(BOOK_OF_NOVENAS_EPIPHANY_PRAYER, [
        {
          title: "The Star in the East",
          meditation:
            "Wise men from the East saw a star and set out to find the newborn King. The novena begins with their readiness to leave home on the strength of a sign.",
          intentionPrompt: "What sign of God have I been slow to follow?",
        },
        {
          title: "With the Three Magi",
          meditation:
            "The prayer does not stand apart from the Magi: it greets Christ in their company and joins its homage to theirs.",
          intentionPrompt: "Do I pray alone, or with the whole Church?",
        },
        {
          title: "Received with Love",
          meditation:
            "The Magi were strangers, Gentiles and late arrivals, and they were received with love and kindness. The prayer asks to be received the same way.",
          intentionPrompt: "Do I believe that I am welcome?",
        },
        {
          title: "Gold: the Intellect",
          meditation:
            "Gold was the gift for a king. The prayer offers the mind, that it may be subject to Christ in faith.",
          intentionPrompt: "Where do my opinions take precedence over the faith?",
        },
        {
          title: "Frankincense: the Memory",
          meditation:
            "Incense was offered to God. The memory is offered with it, to be filled with Him in hope rather than with old grievances and fears.",
          intentionPrompt: "What memory do I need to hand over to God?",
        },
        {
          title: "Myrrh: the Will",
          meditation:
            "Myrrh foretold the burial of the King. The will is offered in charity, which is where love always costs something.",
          intentionPrompt: "What is my will refusing to give up?",
        },
        {
          title: "In Thought, Word and Deed",
          meditation:
            "The offering is not only interior: it is to reach every thought, word and deed, in complete subjection to Christ.",
          intentionPrompt: "Which of the three is least subject to Christ in me?",
        },
        {
          title: "Called to the True Faith",
          meditation:
            "The prayer asks to live and die thanking God for the invaluable favour of being called to the faith — the gift every Christian shares with the Magi.",
          intentionPrompt: "When did I last thank God for my faith itself?",
        },
        {
          title: "The First of the Gentiles",
          meditation:
            "The novena ends with the joy of the Heart of Jesus at seeing the first of the Gentiles at His feet, and asks by that joy for the request of the novena.",
          intentionPrompt: "Whom can I help to come to Christ this year?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "28 December, ending on 5 January, the eve of the solemnity",
      relatedFeastSlug: "solemnity-epiphany",
      citations: [BOOK_OF_NOVENAS_EPIPHANY, CE_EPIPHANY],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-christ-crucified",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [BOOK_OF_NOVENAS_CHRIST_CRUCIFIED, CE_PASSION_OF_CHRIST],
    payload: {
      slug: "novena-christ-crucified",
      title: "Novena in Honor of Christ Crucified",
      summary:
        "A Lenten novena 'which can be made at any time during Lent'. Five petitions to Jesus Christ Crucified, Son of the most holy Virgin Mary, ask Him to incline His sacred head and to open His eyes, His lips, His arms and His heart to the one who prays, each followed by a Hail Mary.",
      background: `Each petition asks for the soul what Christ once gave in the Gospel: the Father heard by the Son on Mount Thabor at the Transfiguration, the look He turned from the cross upon His Mother, the words with which He commended St. John to her (John 19:26-27), the arms stretched on the wood of the cross for love of sinners, and the Heart He is asked to open to receive the heart of the one praying. The Catholic Encyclopedia traces how meditation on the sufferings of Christ shaped Christian devotion from an early date. ${BOOK_OF_NOVENAS_SOURCE} Here the prayer is five petitions, each followed by "Hail Mary, etc.", and the book gives no dates beyond Lent. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "the love of Christ crucified and the gift of one's own heart to Him",
      days: repeatedPrayerDays(BOOK_OF_NOVENAS_CHRIST_CRUCIFIED_PRAYER, [
        {
          title: "Before the Crucifix",
          meditation:
            "The novena belongs to Lent and to the crucifix. Every petition addresses the same title — Jesus Christ Crucified, Son of the most holy Virgin Mary — before it asks anything.",
          intentionPrompt: "Where is the crucifix in my home and in my day?",
        },
        {
          title: "Incline Thy Sacred Head",
          meditation:
            "The first petition asks the crucified Lord to bow His head toward us and hear our petitions and sighs.",
          intentionPrompt: "What do I need to bring to Him without dressing it up?",
        },
        {
          title: "As on Mount Thabor",
          meditation:
            "On Thabor the Father spoke and the Son listened. The prayer dares to ask to be heard as the Son heard the Father.",
          intentionPrompt: "Do I listen to God as I want Him to listen to me?",
        },
        {
          title: "Open Thy Sacred Eyes",
          meditation:
            "From the cross Jesus looked upon His Mother. The second petition asks for that same look upon us.",
          intentionPrompt: "Can I bear to be seen by Christ as I am?",
        },
        {
          title: "Open Thy Sacred Lips",
          meditation:
            "From the cross He spoke to St. John and gave him to His Mother. The third petition asks Him to speak to an afflicted heart.",
          intentionPrompt: "What word do I need from Him today?",
        },
        {
          title: "Behold Thy Mother",
          meditation:
            "The words to St. John made the disciple Mary's son. Each petition is answered with a Hail Mary, keeping the Mother at the foot of the cross.",
          intentionPrompt: "Have I taken Mary into my own home, as John did?",
        },
        {
          title: "Open Thy Sacred Arms",
          meditation:
            "The fourth petition asks to be received as a poor child, as Christ embraced the hard wood of the cross for love of us and of all sinners.",
          intentionPrompt: "What cross of mine can I embrace for love of Him?",
        },
        {
          title: "That Seat of Love and Mercy",
          meditation:
            "The fifth petition asks Him to open His Heart and receive the heart of the one praying into it, and to make it wholly His.",
          intentionPrompt: "What part of my heart is not yet wholly His?",
        },
        {
          title: "Hear My Prayers",
          meditation:
            "Only at the end, after the head, eyes, lips, arms and Heart, does the prayer ask plainly: hear my prayers and grant my petitions.",
          intentionPrompt: "What will I give up for the rest of Lent?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "Any nine days during Lent",
      citations: [BOOK_OF_NOVENAS_CHRIST_CRUCIFIED, CE_PASSION_OF_CHRIST],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-nativity-of-our-lady-pagani",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [PAGANI_NATIVITY, CE_NATIVITY_OF_MARY],
    payload: {
      slug: "novena-nativity-of-our-lady-pagani",
      title: "Novena for the Nativity of Our Lady (Pagani)",
      summary:
        "Pagani's novena for the birth of the Blessed Virgin: seven petitions, each closed with a Hail Mary, that greet Mary as the holy, invincible, unspotted, heavenly, glorious, most holy and most happy Virgin, and ask from her birth peace, the overthrow of the devil's reign in our hearts, purity, detachment, a lively faith and freedom from sin.",
      background: `The Church keeps the birth of Mary on 8 September; the Catholic Encyclopedia notes that Rome took the feast from the East in the seventh century and that Sergius I (687-701) prescribed a litany and procession for it. ${PAGANI_SOURCE} This novena is distinct from the Raccolta's novena for Our Lady's Nativity in this catalogue (novena-nativity-of-our-lady), whose prayers are different. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "peace and the renewal of Christian life through the birth of Mary",
      days: repeatedPrayerDays(PAGANI_NATIVITY_NOVENA_PRAYER, [
        {
          title: "A Birth Remembered",
          meditation:
            "The novena keeps the memory of a birthday. The Church celebrates the birth of only three persons: Christ, His Mother and John the Baptist, all bound up with the coming of salvation.",
          intentionPrompt: "What new beginning do I need to ask for?",
        },
        {
          title: "Peace to Suffering Men",
          meditation:
            "Her birth announced peace to suffering men, and the first petition asks true peace for our hearts, for the Church and for the whole world.",
          intentionPrompt: "Where is peace most lacking in my own heart?",
        },
        {
          title: "The Invincible Virgin",
          meditation:
            "From her birth the kingdom of the devil began to be overthrown. The second petition asks to destroy his reign in our own hearts by a lively faith, so that Christ may reign there.",
          intentionPrompt: "Where does Christ not yet reign in me?",
        },
        {
          title: "Born Adorned with Purity",
          meditation:
            "The third petition asks that, no longer living after the flesh, we may lead the pure and spotless life that befits true Christians.",
          intentionPrompt: "What habit stands between me and a pure heart?",
        },
        {
          title: "Detached from the World",
          meditation:
            "Mary came into the world to triumph over it. The fourth petition asks to live, not by the world's laws, but by those of the Gospel.",
          intentionPrompt: "Which of the world's laws do I obey without noticing?",
        },
        {
          title: "Faith that Works by Charity",
          meditation:
            "The fifth petition asks her to dispel the errors that oppose the faith and to keep alive in us the faith that works by charity.",
          intentionPrompt: "Does my faith show itself in works of love?",
        },
        {
          title: "A Mirror of Virtue",
          meditation:
            "She appeared on earth as a bright mirror of virtue and holiness. The sixth petition asks to keep our eyes turned towards her and to imitate what we see.",
          intentionPrompt: "Which of her virtues will I try to copy this week?",
        },
        {
          title: "The Only Real Evil",
          meditation:
            "God created her to bring forth the One who would heal the evils of the world. The seventh petition names sin as the only real evil and asks to be preserved from it.",
          intentionPrompt: "Do I fear sin more than I fear suffering?",
        },
        {
          title: "Eternal Life",
          meditation:
            "The novena closes on the eve of the feast by asking so to use divine grace that we may attain eternal life, the end for which every Christian is born.",
          intentionPrompt: "What grace have I been given that I am not using?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "30 August, ending on 7 September, the eve of the feast",
      relatedFeastSlug: "feast-nativity-of-the-blessed-virgin-mary",
      citations: [PAGANI_NATIVITY, CE_NATIVITY_OF_MARY],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-presentation-of-our-lady-pagani",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [PAGANI_PRESENTATION, CE_PRESENTATION_OF_MARY],
    payload: {
      slug: "novena-presentation-of-our-lady-pagani",
      title: "Novena for the Presentation of Our Lady (Pagani)",
      summary:
        "Pagani's novena for the Presentation of the Blessed Virgin: three petitions to the 'great Virgin and dear Mother', each closed with a Hail Mary, asking by her prompt dedication to God, her zeal in the Temple and her courage in leaving home and parents for consecrated hearts, devout reception of the Sacraments and detachment from earthly things.",
      background: `The memorial on 21 November commemorates the tradition that Mary was brought as a child to the Temple and dedicated to God. The Catholic Encyclopedia notes that the story comes from apocryphal writings such as the Protevangelium of James, that the feast began in the East, and that it was first kept in the West before the papal court at Avignon in 1372. ${PAGANI_SOURCE} This novena is distinct from the novena for the feast of the Presentation in this catalogue (novena-presentation-of-our-lady), whose prayer is different. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme:
        "the consecration of the heart to God after the example of Mary's Presentation",
      days: repeatedPrayerDays(PAGANI_PRESENTATION_NOVENA_PRAYER, [
        {
          title: "Given to God Early",
          meditation:
            "The feast honours an offering made in childhood. The novena asks for the same readiness to give God what is first and best, not what is left over.",
          intentionPrompt: "What do I give God first, and what last?",
        },
        {
          title: "Marvellous Promptitude",
          meditation:
            "The first petition praises the promptness with which she dedicated her earliest years to God, and asks to consecrate our hearts to Him from this time forward.",
          intentionPrompt: "What have I been meaning to give God 'later'?",
        },
        {
          title: "Never Diverted",
          meditation:
            "The petition asks to persevere in that consecration 'without ever being diverted from our purpose'. Beginnings are easier than faithfulness.",
          intentionPrompt: "What distracts me most from my purpose?",
        },
        {
          title: "Seraphic Zeal",
          meditation:
            "The second petition recalls her zeal in the service of the Temple, which made her an object of admiration to angels and men.",
          intentionPrompt: "Where has my zeal for God grown cold?",
        },
        {
          title: "The Holy Sacraments",
          meditation:
            "From that zeal the petition draws a practical request: to approach the holy Sacraments with the true spirit of devotion.",
          intentionPrompt: "How do I prepare for confession and Communion?",
        },
        {
          title: "Leaving Home and Parents",
          meditation:
            "The third petition honours the courage with which she overcame her attachment to home and parents in her first years, to devote herself to God.",
          intentionPrompt: "What attachment would I find hardest to leave for God?",
        },
        {
          title: "The Deceits of Our Enemies",
          meditation:
            "It asks not to be seduced any longer by the deceits of our spiritual enemies, which present passing goods as if they were the true one.",
          intentionPrompt: "What false good keeps deceiving me?",
        },
        {
          title: "Our True and Perfect Good",
          meditation:
            "A heart detached from earthly things is free to seek its true and perfect good alone. The petition asks for that freedom.",
          intentionPrompt: "What do I seek as if it were my final good?",
        },
        {
          title: "The Delights of Paradise",
          meditation:
            "The novena ends with the hope of enjoying one day, with her, the eternal delights of Paradise — the end of every offering made to God on earth.",
          intentionPrompt: "Do I live as someone on the way to heaven?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "12 November, ending on 20 November, the eve of the memorial",
      relatedFeastSlug: "memorial-presentation-of-the-blessed-virgin-mary",
      citations: [PAGANI_PRESENTATION, CE_PRESENTATION_OF_MARY],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-annunciation-pagani",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [PAGANI_ANNUNCIATION, CE_ANNUNCIATION],
    payload: {
      slug: "novena-annunciation-pagani",
      title: "Novena for the Annunciation (Pagani)",
      summary:
        "Pagani's novena for the Annunciation: nine petitions to the immaculate Mary, each closed with a Hail Mary, that follow the Gospel scene — her humility and chastity, her trouble at the angel's praise, her love of virginity, her answer as the handmaid of the Lord, her fiat — and ask for the same virtues in us.",
      background: `The Annunciation on 25 March commemorates the message of the angel Gabriel to Mary and the conception of the Word in her womb (Luke 1:26-38). The Catholic Encyclopedia notes that the feast probably arose about the time of the Council of Ephesus (c. 431) and that the tenth Synod of Toledo (656) and the Trullan Synod (692) speak of it as kept throughout the Church. ${PAGANI_SOURCE} This novena is distinct from the Raccolta's novena for the Annunciation in this catalogue (novena-annunciation), whose prayers are different. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "humility, purity and a generous yes to God after the example of Mary",
      days: repeatedPrayerDays(PAGANI_ANNUNCIATION_NOVENA_PRAYER, [
        {
          title: "Humility and Chastity",
          meditation:
            "The first petition says that Mary was preferred before all women for her profound humility and perfect chastity, and asks to live in those two virtues.",
          intentionPrompt: "Which of the two virtues needs more of my attention?",
        },
        {
          title: "Troubled at His Saying",
          meditation:
            "Mary was troubled at the angel's praises. The second petition asks for the same low esteem of self, shrinking from praise and seeking only God's approval.",
          intentionPrompt: "How much do I depend on being praised?",
        },
        {
          title: "Virginity and Motherhood",
          meditation:
            "She valued her virginity no less than the glory of being Mother of God. The third petition asks to sacrifice anything rather than stain the purity of the soul.",
          intentionPrompt: "What am I unwilling to sacrifice for purity of heart?",
        },
        {
          title: "Behold the Handmaid of the Lord",
          meditation:
            "Told that she was to be His Mother, she called herself His handmaid. The fourth petition asks never to be made proud by God's gifts, but to grow by them in virtue.",
          intentionPrompt: "Which of God's gifts am I tempted to treat as my own?",
        },
        {
          title: "Knowing the Cost",
          meditation:
            "She did not refuse to be Mother of the Redeemer, though she knew the sacrifice it would mean on Calvary. The fifth petition asks never to refuse a sacrifice asked of us.",
          intentionPrompt: "What sacrifice am I refusing right now?",
        },
        {
          title: "The Fiat",
          meditation:
            "Her fiat rejoiced heaven, consoled earth and terrified hell. The sixth petition asks perfect confidence in her protection, so as to gain the fruits of the redemption.",
          intentionPrompt: "Where do I need to say yes to God today?",
        },
        {
          title: "The Spotless Mother",
          meditation:
            "She became Mother of the Incarnate Word without the least stain on her purity. The seventh petition asks for modesty in looks, words and actions.",
          intentionPrompt: "Are my words and looks worthy of a temple of God?",
        },
        {
          title: "Temple of the Trinity",
          meditation:
            "Daughter of the Father, Mother of the Son and Spouse of the Holy Ghost, Mary stood in a unique relation to the Trinity. The eighth petition asks to be worthy temples of the Father, Son and Holy Spirit.",
          intentionPrompt: "Do I remember that God dwells in me?",
        },
        {
          title: "Him Whom Heaven Cannot Contain",
          meditation:
            "She bore in her womb Him whom heaven and earth cannot contain. The last petition asks to receive Him worthily in the Blessed Sacrament, at death, and for ever in heaven.",
          intentionPrompt: "How will I prepare for my next Communion?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "16 March, ending on 24 March, the eve of the solemnity",
      relatedFeastSlug: "solemnity-annunciation",
      citations: [PAGANI_ANNUNCIATION, CE_ANNUNCIATION],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-visitation-pagani",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [PAGANI_VISITATION, CE_VISITATION],
    payload: {
      slug: "novena-visitation-pagani",
      title: "Novena for the Visitation (Pagani)",
      summary:
        "Pagani's novena for the Visitation: nine petitions, each closed with a Hail Mary, that follow Mary from Nazareth to the house of Elizabeth and back — her pure intention, her haste over the mountains, her humble greeting, the joy she brought, the sanctifying of John, her Magnificat, her three months of service and her return home — and ask for her virtues.",
      background: `The Visitation commemorates Mary's journey to her cousin Elizabeth (Luke 1:39-56). The Catholic Encyclopedia notes that the earliest evidence of the feast is its adoption by the Franciscan chapter of 1263 on the advice of St. Bonaventure, and that Urban VI extended it to the whole Church in 1389; it was long kept on 2 July and has been kept on 31 May since the reform of the calendar in 1969. ${PAGANI_SOURCE} This novena is distinct from the novena for the feast of the Visitation in this catalogue (novena-visitation-of-our-lady), whose prayer is different. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "charity toward the neighbour after the example of Mary's visit to Elizabeth",
      days: repeatedPrayerDays(PAGANI_VISITATION_NOVENA_PRAYER, [
        {
          title: "Purity of Intention",
          meditation:
            "Mary left home to visit Elizabeth for God's glory alone. The first petition asks to seek in all we do only the pure glory of God.",
          intentionPrompt: "Whose approval am I really working for?",
        },
        {
          title: "Over the Mountains",
          meditation:
            "She took the road into the hill country with haste and care. The second petition asks to walk always in the way of holiness, undeterred by obstacles.",
          intentionPrompt: "What obstacle is turning me back?",
        },
        {
          title: "The First to Greet",
          meditation:
            "Though she was the Mother of the Lord, Mary was the first to salute her cousin. The third petition asks to profit by every occasion of humility.",
          intentionPrompt: "To whom can I make the first move this week?",
        },
        {
          title: "The Joy She Brought",
          meditation:
            "Elizabeth was filled with joy when Mary embraced her. The fourth petition asks to persevere until death in the profession of piety and so reach the fulness of joy.",
          intentionPrompt: "Do others find joy in my company?",
        },
        {
          title: "John Sanctified",
          meditation:
            "At Mary's greeting the child leapt in Elizabeth's womb, and tradition holds that John was then sanctified. The fifth petition asks to be kept free from every stain until death.",
          intentionPrompt: "What stain on my soul needs confession?",
        },
        {
          title: "My Soul Doth Magnify",
          meditation:
            "In the Magnificat Mary humbly confessed the great things God had done in her. The sixth petition asks always to acknowledge God's gifts and use them for His glory.",
          intentionPrompt: "What gift of God have I failed to thank Him for?",
        },
        {
          title: "Three Months of Service",
          meditation:
            "Mary stayed about three months in Elizabeth's house. The seventh petition asks to be always ready to help our neighbours in their needs.",
          intentionPrompt: "Who near me needs practical help?",
        },
        {
          title: "Edifying Those at Home",
          meditation:
            "She gave an example of every virtue to Elizabeth and Zachary. The eighth petition asks to edify our neighbours by all our words and actions.",
          intentionPrompt: "Do my words at home build others up?",
        },
        {
          title: "The Return to Nazareth",
          meditation:
            "Her work done, Mary went straight home. The last petition asks for detachment from worldly affairs, except as necessity or charity require, with the heart fixed on God alone.",
          intentionPrompt: "What affairs take up more of my heart than they should?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "22 May, ending on 30 May, the eve of the feast",
      relatedFeastSlug: "feast-visitation-of-the-blessed-virgin-mary",
      citations: [PAGANI_VISITATION, CE_VISITATION],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-purification-pagani",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [PAGANI_PURIFICATION, CE_CANDLEMAS],
    payload: {
      slug: "novena-purification-pagani",
      title: "Novena for the Purification (Pagani)",
      summary:
        "Pagani's novena for the Purification of the Blessed Virgin: seven petitions, each closed with a Hail Mary, that honour her obedience to the law, her modesty in the Temple, her care for purity, her humility, her faith and resignation at Simeon's prophecy and her offering of her Son, and ask for the same dispositions.",
      background: `On 2 February the Church keeps the presentation of the Child Jesus in the Temple and the purification of His Mother according to the law of Moses (Luke 2:22-38); the Catholic Encyclopedia notes that the feast, also called Candlemas, was kept in the West as a feast of Mary, and that the blessing of candles did not come into general use before the eleventh century. Since the reform of the calendar in 1969 it is kept as the Feast of the Presentation of the Lord. ${PAGANI_SOURCE} This novena is distinct from the Raccolta's novena for the Purification in this catalogue (novena-purification-of-our-lady), whose prayers are different. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "obedience, humility and the offering of what is dearest to God",
      days: repeatedPrayerDays(PAGANI_PURIFICATION_NOVENA_PRAYER, [
        {
          title: "Forty Days After",
          meditation:
            "Forty days after the birth of her Son, Mary went up to the Temple as the law prescribed, carrying the One who gave the law.",
          intentionPrompt: "What law of God or the Church do I keep only grudgingly?",
        },
        {
          title: "Heroic Obedience",
          meditation:
            "She submitted to a law that did not bind her. The first petition asks for perfect obedience to the laws of God, of the Church and of our superiors.",
          intentionPrompt: "Where is obedience hardest for me?",
        },
        {
          title: "Modesty in the House of God",
          meditation:
            "The second petition asks to conduct ourselves in God's house with the exterior and interior devotion that its holiness demands.",
          intentionPrompt: "How do I behave in church?",
        },
        {
          title: "The Least Stain",
          meditation:
            "The most pure Virgin was careful to fulfil even the outward rite of purification. The third petition asks for a longing to be cleansed from the smallest stain of sin.",
          intentionPrompt: "Do I take small sins seriously?",
        },
        {
          title: "Among Sinners",
          meditation:
            "She went to the Temple among sinners as if she were one of them. The fourth petition asks for a humility that makes us dear to God.",
          intentionPrompt: "Do I mind being taken for less than I am?",
        },
        {
          title: "A Sign of Contradiction",
          meditation:
            "Simeon foretold that her Son would be a sign that is contradicted. The fifth petition asks for a faith that stays firm amid temptation and contradiction.",
          intentionPrompt: "Where is my faith being contradicted now?",
        },
        {
          title: "The Sword of Sorrow",
          meditation:
            "She heard without protest that a sword would pierce her soul. The sixth petition asks for resignation in whatever trials God permits.",
          intentionPrompt: "What trial am I resisting rather than offering?",
        },
        {
          title: "Offering Her Son",
          meditation:
            "Mary offered her Son to the eternal Father for the salvation of all. The seventh petition asks to be ready to give God whatever is dearest to us.",
          intentionPrompt: "What is dearest to me, and is it offered to God?",
        },
        {
          title: "The Light of the Nations",
          meditation:
            "Simeon greeted the Child as a light to the revelation of the Gentiles (Luke 2:32), and the feast is kept with blessed candles. On its eve the petitions are said for the last time, the seventh closing with the Gloria.",
          intentionPrompt: "Who around me needs the light of Christ?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "24 January, ending on 1 February, the eve of the feast",
      relatedFeastSlug: "feast-presentation-of-the-lord",
      citations: [PAGANI_PURIFICATION, CE_CANDLEMAS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-assumption-pagani",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [PAGANI_ASSUMPTION, CE_ASSUMPTION],
    payload: {
      slug: "novena-assumption-pagani",
      title: "Novena for the Assumption (Pagani)",
      summary:
        "Pagani's novena for the Assumption: nine petitions, each closed with a Hail Mary, that follow Mary from her call to glory and her death of love to her resurrection, her assumption amid the angels and her crowning, and ask for a holy death, purity, patience in suffering, detachment and the light of the Gospel for all.",
      background: `The Assumption on 15 August is, as the Catholic Encyclopedia puts it, the principal feast of the Blessed Virgin, with a double object: Mary's happy departure from this life and the taking up of her body into heaven. Pius XII defined the Assumption as a dogma of faith in the apostolic constitution Munificentissimus Deus of 1 November 1950. ${PAGANI_SOURCE} This novena is distinct from the Raccolta's novena for the Assumption in this catalogue (novena-assumption), whose prayers are different. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme:
        "a holy death and the hope of glory after the example of Mary assumed into heaven",
      days: repeatedPrayerDays(PAGANI_ASSUMPTION_NOVENA_PRAYER, [
        {
          title: "Called to Immortal Glory",
          meditation:
            "The first petition recalls the joy with which Mary heard herself called to glory, and asks so to live that we may meet death with joy.",
          intentionPrompt: "Could I welcome death today?",
        },
        {
          title: "Consoler of the Apostles",
          meditation:
            "Tradition gathers the apostles at her death. The second petition asks her comfort in all our troubles, especially in our last agony.",
          intentionPrompt: "Whose grief can I console this week?",
        },
        {
          title: "A Death of Love",
          meditation:
            "Her death, the third petition says, was not the effect of sin but of divine love. It asks that we may close this life with an act of the love of God.",
          intentionPrompt: "Do I make acts of love of God?",
        },
        {
          title: "The Ark Honoured by Angels",
          meditation:
            "The angels honoured the body in which the Word had become flesh. The fourth petition asks for purity, that we may one day enjoy their company.",
          intentionPrompt: "Do I honour my body as a temple?",
        },
        {
          title: "Rewarded for Her Sufferings",
          meditation:
            "In her glorified body she was rewarded for everything she had suffered. The fifth petition asks to bear every suffering for love of Jesus, in hope of the resurrection.",
          intentionPrompt: "What suffering can I offer instead of resent?",
        },
        {
          title: "Raised to the Highest Place",
          meditation:
            "Her Son raised her to the highest place in His kingdom. The sixth petition asks to be detached from the world and humble on earth, so as to be exalted with her.",
          intentionPrompt: "Where am I seeking to be exalted now?",
        },
        {
          title: "Daughter of the Father",
          meditation:
            "The seventh petition asks the crowned Queen to use her power against our spiritual enemies and those of the Church, that Jesus may reign over all things.",
          intentionPrompt: "What enemy of my soul do I need her help against?",
        },
        {
          title: "Light for All",
          meditation:
            "The eighth petition asks her to obtain for all Christians, and for all outside the Church, the light to understand the Gospel and the grace to obey it.",
          intentionPrompt: "For whose conversion will I pray today?",
        },
        {
          title: "Crowned with Glory",
          meditation:
            "The novena ends by praising God who crowned her, and asks to follow her footsteps in fervent charity and share in her immortal glory.",
          intentionPrompt: "Which footstep of hers can I follow tomorrow?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedMarianTitleSlug: "assumption-of-mary",
      typicalStartDate: "6 August, ending on 14 August, the eve of the solemnity",
      relatedFeastSlug: "solemnity-assumption",
      citations: [PAGANI_ASSUMPTION, CE_ASSUMPTION],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-litany-of-loreto-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [GLORIES_1902_LITANY, CE_LITANY_OF_LORETO, CE_ALPHONSUS_LIGUORI],
    payload: {
      slug: "novena-litany-of-loreto-saint-alphonsus",
      title: "Novena on the Litany of Loreto (Saint Alphonsus Liguori)",
      summary:
        "St. Alphonsus Liguori's novena to the Blessed Virgin in nine meditations on the titles of the Litany of Loreto, from Holy Mary to Queen of Martyrs. Each day takes up one to four of her titles, and under all but two of them the saint places a short prayer to Our Lady: for help in temptation, for purity, for confidence, for love of God, for a holy death.",
      background:
        "St. Alphonsus Liguori (1696-1787), founder of the Redemptorists, canonised in 1839 and declared a Doctor of the Church in 1871, wrote 'The Glories of Mary' as an explanation of the Salve Regina and of Our Lady's feasts, with practices of devotion; among them he recommends keeping the novenas, the nine days before her feasts, and gives these meditations on the Litany of Loreto for a novena to the Blessed Virgin. The Litany itself, the Catholic Encyclopedia notes, was first definitely approved by the Church in 1587. The text is that of the edition 'arranged for popular use, with the addition of prayers and devotions' (New York: Benziger Brothers, 1902), whose meditations are shorter than in the complete translations. Each meditation sets a consideration drawn from the Fathers and saints under each title and closes with a prayer; the prayers are given here under their titles, and the considerations are summarised in the day meditations. The eighth meditation has a prayer only under Refuge of Sinners. It is a private devotion, not a liturgical rite.",
      intentionTheme:
        "confidence in the intercession of Mary, learned from the titles of her Litany",
      days: [
        {
          day: 1,
          title: "Holy Mary, Holy Mother of God",
          meditation:
            "Before meditating on Mary's titles, Alphonsus considers the power of her prayers with God, the saving power of her name, which St. Epiphanius says was given by God Himself, and her dignity as Mother of God, which, St. Antoninus concludes, makes it impossible for the Son not to grant what she asks.",
          prayerText: LITANY_OF_LORETO_DAY_1,
          intentionPrompt: "Do I call on Mary's name when I am tempted?",
        },
        {
          day: 2,
          title: "Mother of Divine Grace, Mother Most Pure, Mother Undefiled",
          meditation:
            "Mary is called the treasurer of divine grace, through whose hands God gives His gifts; her very presence, St. Ambrose writes, inspired a love of purity; and she was preserved from every stain because she was to make peace between God and sinners.",
          prayerText: LITANY_OF_LORETO_DAY_2,
          intentionPrompt: "Which temptation will I bring to her today?",
        },
        {
          day: 3,
          title: "Mother Most Amiable, Mother of Our Redeemer, Virgin Most Venerable",
          meditation:
            "God loved Mary more than all the saints together, Suarez says, because she loved Him more; she consented both to the Incarnation and to the death of her Son for our salvation; and her dignity, St. Anselm writes, is surpassed only by God's.",
          prayerText: LITANY_OF_LORETO_DAY_3,
          intentionPrompt: "Is my love for Mary a matter of words or of trust?",
        },
        {
          day: 4,
          title: "Virgin Most Renowned, Most Powerful, Most Merciful",
          meditation:
            "All can praise Mary and lead relatives and friends to her; she obtains whatever she wills; and she is as merciful as she is powerful, since, as St. Bernard says, the will to save us cannot be wanting to one who is our Mother.",
          prayerText: LITANY_OF_LORETO_DAY_4,
          intentionPrompt: "To whom can I speak of Mary this week?",
        },
        {
          day: 5,
          title:
            "Virgin Most Faithful, Cause of Our Joy, Vessel of Singular Devotion, Tower of Ivory",
          meditation:
            "Mary is faithful to all who serve her; her birth was the dawn after the long night of sin; her devotion was a perfect conformity to God's will; and like a tower of ivory she is beloved of God and terrible to the devil.",
          prayerText: LITANY_OF_LORETO_DAY_5,
          intentionPrompt: "Where is my will out of step with God's?",
        },
        {
          day: 6,
          title: "House of Gold",
          meditation:
            "Gold is the symbol of love, and Mary is the house of gold that Eternal Wisdom built for His dwelling on earth, so rich, Richard of St. Laurence says, that it can relieve all our wants.",
          prayerText: LITANY_OF_LORETO_DAY_6,
          intentionPrompt: "Do I ask for the love of God as earnestly as for other things?",
        },
        {
          day: 7,
          title: "Mystical Rose, Tower of David, Ark of the Covenant, Gate of Heaven",
          meditation:
            "Mary is the rose of charity in God's enclosed garden; the tower of David on its height, holy from her first moment; an ark wider than Noah's, where sinners find room; and the gate through which no one enters heaven except by her.",
          prayerText: LITANY_OF_LORETO_DAY_7,
          intentionPrompt: "Do I trust her with my eternal salvation?",
        },
        {
          day: 8,
          title: "Morning Star, Health of the Weak, Refuge of Sinners",
          meditation:
            "As the morning star goes before the sun, devotion to Mary goes before the grace of God; she is not only medicine but health itself to those who come to her; and as refuge of sinners she embraces even the sinner despised by the world until her Son has forgiven him.",
          prayerText: LITANY_OF_LORETO_DAY_8,
          intentionPrompt: "What sin am I afraid to bring to her?",
        },
        {
          day: 9,
          title: "Comfortress of the Afflicted, Help of Christians, Queen of Martyrs",
          meditation:
            "No saint, St. Antoninus says, compassionates our miseries as Mary does; she is an army against the devils who assail her servants; and her martyrdom at the foot of the cross exceeded the sufferings of all the martyrs.",
          prayerText: LITANY_OF_LORETO_DAY_9,
          intentionPrompt: "What grace will I ask her for at the hour of my death?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-alphonsus-liguori",
      typicalStartDate: "The nine days before any feast of Our Lady",
      citations: [GLORIES_1902_LITANY, CE_LITANY_OF_LORETO, CE_ALPHONSUS_LIGUORI],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-our-lady-of-mount-carmel-brown-scapular",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [GLORIES_1902_MOUNT_CARMEL, CE_SCAPULAR],
    payload: {
      slug: "novena-our-lady-of-mount-carmel-brown-scapular",
      title: "Novena to Our Lady of Mount Carmel for Those Who Wear the Brown Scapular",
      summary:
        "A novena kept from 7 to 15 July before the feast of Our Lady of Mount Carmel, 'a devotion for those who wear the brown scapular'. Each day begins with a preparatory prayer choosing Our Lady of Mount Carmel as patroness, with the Our Father and Hail Mary three times, then says a prayer proper to the day and the Litany of the Blessed Virgin; the last day adds the prayers at the conclusion of the novena.",
      background:
        "The Brown Scapular is a small form of the habit of the Carmelite Order, worn by those enrolled in its confraternity; the Catholic Encyclopedia recounts the pious tradition that Our Lady appeared to St. Simon Stock at Cambridge on 16 July 1251 and gave him the scapular, and calls it probably the oldest of the scapulars and the model of the others. The feast of Our Lady of Mount Carmel is kept on 16 July. The novena is taken from the 1902 popular edition of St. Alphonsus Liguori's 'The Glories of Mary' (New York: Benziger Brothers), whose editors added it to the saint's chapter on the feasts of Mary; it is not St. Alphonsus's own text. Its prayers address Our Lady as patroness of the Carmelite order and of all who wear its scapular. It is distinct from the novena to Our Lady of Mount Carmel already in this catalogue (novena-our-lady-of-mount-carmel), whose text is different. The third day's prayer is a form of the Memorare, which the catalogue also publishes on its own as the PRAYER memorare. The sixth day's prayer ends, as the book prints it, 'who with the Father and the Son liveth and reigneth'. The Litany of Loreto, called for on each day, is indicated by the book's rubric. It is a private devotion, not a liturgical rite.",
      intentionTheme: "the protection of Our Lady of Mount Carmel in life and at the hour of death",
      days: [
        {
          day: 1,
          title: "A Patroness Chosen",
          meditation:
            "Every day opens by choosing Our Lady of Mount Carmel for patroness in the presence of her Son. The first prayer asks to understand the favours she has given through her order and to live in the liberty of the children of God.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_1,
          intentionPrompt: "What does wearing the scapular ask of me?",
        },
        {
          day: 2,
          title: "Grace Like Hers",
          meditation:
            "The second prayer is addressed to God, asking a small portion of the grace with which He sanctified Mary, and to be shielded through her from temptation and from every enemy.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_2,
          intentionPrompt: "Which temptation do I most need shielding from?",
        },
        {
          day: 3,
          title: "Never Forsaken",
          meditation:
            "The third prayer, a form of the Memorare, asks the Mother of the Word Incarnate to adopt the one praying as her child for ever and to take charge of his salvation.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_3,
          intentionPrompt: "Do I live as her child, or only call myself one?",
        },
        {
          day: 4,
          title: "Contrition and a Clean Heart",
          meditation:
            "The fourth prayer asks for true contrition, purity of heart and a conscience free from sin, and for her guidance in every action and at the moment of death.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_4,
          intentionPrompt: "When did I last make a good confession?",
        },
        {
          day: 5,
          title: "A Tender Mother at the Last Hour",
          meditation:
            "The fifth prayer appeals to her zeal for her order and for the grace of the Redeemer in us, and asks her to be a tender mother when the hour of death approaches.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_5,
          intentionPrompt: "Do I ask Our Lady for a good death?",
        },
        {
          day: 6,
          title: "Weak and Cast Down",
          meditation:
            "The sixth prayer is a frank admission of weakness and dejection, offered to the Mother of mercy who will not reject a contrite and humble heart.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_6,
          intentionPrompt: "What weakness am I ashamed to admit to her?",
        },
        {
          day: 7,
          title: "Health of Mind and Body",
          meditation:
            "The seventh prayer asks for health of mind and body, to serve her Son faithfully in this life and to see, love and enjoy Him in His kingdom.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_7,
          intentionPrompt: "Whose health will I commend to her today?",
        },
        {
          day: 8,
          title: "Through the Stormy Ocean",
          meditation:
            "The eighth prayer asks her protection through the stormy ocean of this world, and ends with the words of the Salve Regina: after this our exile, show unto us the blessed fruit of thy womb, Jesus.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_8,
          intentionPrompt: "What storm am I in, and have I asked her help?",
        },
        {
          day: 9,
          title: "Finder of Grace",
          meditation:
            "The last day's prayer greets her as the finder of grace and Mother of salvation and asks her to reconcile us to her Son, commend us and present us to Him; the novena closes with the prayers for its conclusion.",
          prayerText: MOUNT_CARMEL_SCAPULAR_DAY_9,
          intentionPrompt: "What grace will I ask of her on the feast?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "brown-scapular",
      associatedMarianTitleSlug: "our-lady-of-mount-carmel",
      typicalStartDate: "7 July, ending on 15 July, the eve of the feast",
      relatedFeastSlug: "optional-memorial-our-lady-of-mount-carmel",
      citations: [GLORIES_1902_MOUNT_CARMEL, CE_SCAPULAR],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-dominic",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1904_DOMINIC, CE_DOMINIC],
    payload: {
      slug: "novena-saint-dominic",
      title: "Novena to St. Dominic",
      summary:
        "A novena to St. Dominic, founder of the Order of Preachers: five petitions, each followed by the Glory be, recalling his prayer and penance from childhood, the order he founded to support the Church, the Rosary, his humility amid success, and his constant recollection in God, and asking for the same graces.",
      background: `Dominic was born at Calaroga in Old Castile about 1170 and died at Bologna on 6 August 1221. He founded the Order of Preachers, which Honorius III confirmed on 22 December 1216; the Catholic Encyclopedia notes the tradition that the devotion of the Rosary was revealed to him, a tradition the prayer repeats. His feast was kept on 4 August, the date the book gives, and has been kept on 8 August since the reform of the calendar in 1969. ${LASANCE_1904_SOURCE} The five petitions, each followed by the Glory be, are said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "zeal for the Church, devotion to the Rosary and the spirit of prayer",
      days: repeatedPrayerDays(LASANCE_DOMINIC_NOVENA_PRAYER, [
        {
          title: "From His Earliest Infancy",
          meditation:
            "The first petition recalls Dominic's prayer, fasting, vigils and custody of the senses from childhood, and the charity that made him give away his possessions for the poor.",
          intentionPrompt: "Which exercise of piety have I let slip?",
        },
        {
          title: "For the Salvation of the Neighbour",
          meditation:
            "The first petition asks for grace to keep to exercises of piety, penance and charity, and by sanctifying our own souls to promote the salvation of our neighbour.",
          intentionPrompt: "Whose salvation do I pray for by name?",
        },
        {
          title: "Support of the Church",
          meditation:
            "Dominic founded his order in stormy times. The second petition asks to be zealous for the glory of the Church and to treat her interests as our own.",
          intentionPrompt: "Do I defend the Church or only criticise her?",
        },
        {
          title: "The Rosary",
          meditation:
            "The third petition repeats the tradition that Dominic received the Rosary from Our Lady and spread it at her command, and asks to be always devout to her in it.",
          intentionPrompt: "Have I prayed the Rosary this week?",
        },
        {
          title: "Against Error and Scandal",
          meditation:
            "The petition names what the Rosary was given for: to confound heresy, arouse faith, drive away scandals, promote virtue and defend the Church.",
          intentionPrompt: "What scandal can I answer with prayer rather than anger?",
        },
        {
          title: "No Vanity in Success",
          meditation:
            "Dominic felt no vanity at the growth of his order or at the miracles God worked through him. The fourth petition asks to tread faithfully in the way of humility.",
          intentionPrompt: "How do I take success?",
        },
        {
          title: "Humility and Apostolic Zeal",
          meditation:
            "The fifth petition sums up his character: besides humility and apostolic zeal, an eminent spirit of prayer.",
          intentionPrompt: "Whose glory is served by what I say about God?",
        },
        {
          title: "Recollection in God",
          meditation:
            "Dominic was known for his spirit of prayer and the constant recollection of his soul in God. The petition asks to love prayer and to walk always in God's presence.",
          intentionPrompt: "When in the day do I remember God's presence?",
        },
        {
          title: "Eternal Union with Him",
          meditation:
            "The novena ends with the goal of all the rest: eternal union with God in heaven.",
          intentionPrompt: "What will I carry from this novena into daily life?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-dominic",
      typicalStartDate: "30 July, ending on the eve of his memorial, 8 August",
      citations: [LASANCE_1904_DOMINIC, CE_DOMINIC],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-catherine-of-siena",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1904_CATHARINE, CE_CATHERINE_OF_SIENA],
    payload: {
      slug: "novena-saint-catherine-of-siena",
      title: "Novena to St. Catherine of Siena",
      summary:
        "A novena to St. Catherine of Siena in nine petitions, each followed by the Glory be, that pass through her life — her prayer, her vow of virginity, her inner solitude, her penance, her service of the sick, her victory over temptation, her counsel to the Pope, her love of the Blessed Sacrament and her joy in suffering — and ask for the same graces.",
      background: `Catherine was born at Siena on 25 March 1347 and died at Rome on 29 April 1380. A Dominican tertiary, she worked to heal the factions of her native land and implored Gregory XI to leave Avignon; she was canonised by Pius II in 1461 and declared a Doctor of the Church by Paul VI in 1970. Her feast, which the book gives on 30 April, is now kept on 29 April. ${LASANCE_1904_SOURCE} The book spells her name "Catharine of Sienna". The nine petitions, each followed by the Glory be, are said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "prayer, purity and charity after the example of St. Catherine of Siena",
      days: repeatedPrayerDays(LASANCE_CATHARINE_NOVENA_PRAYER, [
        {
          title: "The Spirit of Prayer",
          meditation:
            "The first petition begins where Catherine's life began, in prayer from her infancy, and asks for the love and practice of prayer.",
          intentionPrompt: "Do I talk with God, or only to Him?",
        },
        {
          title: "Consecrated to the Lord",
          meditation:
            "The second petition recalls the vow of virginity she made as a child and her refusal of every offer of marriage, and asks for purity of mind and heart.",
          intentionPrompt: "What threatens the purity of my heart?",
        },
        {
          title: "A Solitude in the Heart",
          meditation:
            "Kept busy with work in her family, she learned to build a solitude in her heart. The third petition asks for that inner retirement amid the cares of our state of life.",
          intentionPrompt: "Where is my inner room in a busy day?",
        },
        {
          title: "The Spirit of Penance",
          meditation:
            "The fourth petition asks to bear patiently the afflictions God sends and to mortify our perverse inclinations, so as to become like our crucified model, Jesus.",
          intentionPrompt: "What small penance can I take on freely?",
        },
        {
          title: "Nurse of the Abandoned",
          meditation:
            "She cared with her own hands for the sick whom others had abandoned, and was repaid with insult. The fifth petition asks to help our neighbour and to forgive ingratitude.",
          intentionPrompt: "Whom am I reluctant to help because they are ungrateful?",
        },
        {
          title: "Constancy in Temptation",
          meditation:
            "The sixth petition recalls her long fight against frightful temptations and the intimacy with God that followed, and asks for strength against our spiritual enemies.",
          intentionPrompt: "What temptation keeps returning to me?",
        },
        {
          title: "Counsellor of the Pope",
          meditation:
            "She counselled the Pope and helped bring about his return to Rome. The seventh petition asks to know, in every doubt, what is most conformable to the will of God.",
          intentionPrompt: "What decision do I need God's light for?",
        },
        {
          title: "The Blessed Sacrament",
          meditation:
            "The eighth petition recalls her devotion to Christ in the Blessed Sacrament and asks for the same fervent devotion, that we may rejoice to receive Him.",
          intentionPrompt: "How fervently do I receive Communion?",
        },
        {
          title: "Joy in Suffering",
          meditation:
            "The last petition recalls the serenity and joy with which she bore great pains at the end of her life, and asks to accept our crosses with resignation and holy joy.",
          intentionPrompt: "Which cross can I accept with peace today?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-catherine-of-siena",
      typicalStartDate: "20 April, ending on the eve of her memorial, 29 April",
      citations: [LASANCE_1904_CATHARINE, CE_CATHERINE_OF_SIENA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-jane-frances-de-chantal",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1904_JANE_FRANCES, CE_VISITATION_ORDER],
    payload: {
      slug: "novena-saint-jane-frances-de-chantal",
      title: "Novena to St. Jane Frances de Chantal",
      summary:
        "A novena to St. Jane Frances de Chantal: a prayer asking her, as advocate, mother and guide, to obtain an ardent love of Jesus in the Blessed Sacrament, a filial confidence in His Mother and a constant remembrance of His Passion, with the particular intention of the novena, followed by a versicle and a collect.",
      background: `Jane Frances Frémyot de Chantal (1572-1641), a widow and mother, founded with St. Francis de Sales the Order of the Visitation of Holy Mary at Annecy in 1610; its aim, the Catholic Encyclopedia says, was to open the religious life to those who had neither the physical strength nor the attraction for the corporal austerities then general in religious orders. Her feast, which the book gives on 21 August, is now kept on 12 August. ${LASANCE_1904_SOURCE} The book heads this devotion "Novena and Prayers to St. Jane Frances de Chantal" and notes that its prayers are from the "Visitation Manual". The novena prayer, with its versicle and a collect that thanks God for adorning the Church through her "with a new Religious Order", is said on each day of the novena; the shorter prayers that follow under their own headings, beginning with a "Prayer to Implore Fidelity to Divine Grace", are not part of it. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "union with God through prayer and purity of intention",
      days: repeatedPrayerDays(LASANCE_JANE_FRANCES_NOVENA_PRAYER, [
        {
          title: "Fervent Prayer",
          meditation:
            "The prayer names three means by which she reached union with God. The first is fervent prayer.",
          intentionPrompt: "How fervent is my prayer when no one sees?",
        },
        {
          title: "Attention to the Divine Presence",
          meditation:
            "The second means is attention to the presence of God, kept through the business of a household and later of an order.",
          intentionPrompt: "What helps me remember that God is present?",
        },
        {
          title: "Purity of Intention",
          meditation:
            "The third is purity of intention in her actions: doing ordinary things for God alone.",
          intentionPrompt: "For whom am I really doing my daily work?",
        },
        {
          title: "Advocate, Mother and Guide",
          meditation:
            "The prayer asks her to be our advocate, our mother and our guide in the path of virtue and perfection. She had been a wife and a mother before she became a foundress.",
          intentionPrompt: "In which part of my vocation do I most need a guide?",
        },
        {
          title: "Jesus, Mary and Joseph",
          meditation:
            "She is asked to plead our cause with Jesus, Mary and Joseph, to whom she was tenderly devoted and whose virtues she imitated.",
          intentionPrompt: "What can my family learn from the Holy Family?",
        },
        {
          title: "Love of the Blessed Sacrament",
          meditation:
            "The first virtue asked for is an ardent love of Jesus in the most holy Sacrament.",
          intentionPrompt: "When did I last make a visit to the Blessed Sacrament?",
        },
        {
          title: "Confidence in His Mother",
          meditation: "The second is a tender and filial confidence in the Blessed Mother.",
          intentionPrompt: "Do I go to Mary as a child goes to a mother?",
        },
        {
          title: "Remembrance of the Passion",
          meditation:
            "The third is a constant remembrance, like hers, of the Passion and death of Christ.",
          intentionPrompt: "How often do I think of the Passion?",
        },
        {
          title: "Fortitude Through All the Paths of Life",
          meditation:
            "The collect praises the fortitude God gave her through every path of life, and asks that we who know our weakness may trust in His strength.",
          intentionPrompt: "What adversity do I need strength to overcome?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-jane-frances-de-chantal",
      typicalStartDate: "3 August, ending on the eve of her memorial, 12 August",
      citations: [LASANCE_1904_JANE_FRANCES, CE_VISITATION_ORDER],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-ursula",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1904_URSULA, CE_URSULA],
    payload: {
      slug: "novena-saint-ursula",
      title: "Novena to St. Ursula",
      summary:
        "A novena to St. Ursula, the virgin martyr of Cologne: three petitions, each followed by the Glory be, which recall the story of her consecration, her voyage and her martyrdom with her companions, and ask for purity in our state of life, acceptance of God's hand in our trials, and readiness to suffer rather than violate conscience.",
      background: `The cult of the virgin martyrs of Cologne is ancient, but, as the Catholic Encyclopedia explains, their true history rests only on the inscription of a certain Clematius, who rebuilt a basilica in their honour, and on some details in ancient liturgical books; the legend of Ursula the princess, her voyage and her eleven thousand companions grew up later, and its apocryphal character has come to be recognised. The prayer follows that legend, and also recalls the orders placed under her name, among them the Ursulines, founded by St. Angela Merici in 1535 for the education of girls. Her feast was kept on 21 October, the date the book gives; it was removed from the General Roman Calendar in 1969. ${LASANCE_1904_SOURCE} The three petitions, each followed by the Glory be, are said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "purity, fidelity and courage in confessing the faith",
      days: repeatedPrayerDays(LASANCE_URSULA_NOVENA_PRAYER, [
        {
          title: "The Virgins of Cologne",
          meditation:
            "From early times Cologne honoured a band of virgin martyrs. The novena begins with their fidelity, whatever the details of their story.",
          intentionPrompt: "What does fidelity to Christ cost me?",
        },
        {
          title: "Love of Christ above All",
          meditation:
            "The first petition, following the legend, has Ursula renounce a princely marriage to consecrate her virginity to God for love of Christ.",
          intentionPrompt: "What do I love more than I love Christ?",
        },
        {
          title: "Purity Suitable to Our State",
          meditation:
            "The petition asks for the purity that suits our own state of life, and for steadiness in good resolutions against threats and allurements.",
          intentionPrompt: "Where am I being lured away from a good resolution?",
        },
        {
          title: "Companions in Faith",
          meditation:
            "The second petition recalls how she strengthened her companions to prefer Christ to the most distinguished matches in the world.",
          intentionPrompt: "Whom do I encourage in the faith?",
        },
        {
          title: "The Hand of God",
          meditation:
            "Forced ashore in a barbarous land, the story says, she rejoiced. The petition asks to recognise the hand of God in the evils that happen to us.",
          intentionPrompt: "What misfortune might be God's hand in disguise?",
        },
        {
          title: "Helping Others to Salvation",
          meditation:
            "It asks too that we use all our powers to help our neighbours in the way of salvation.",
          intentionPrompt: "What can I do this week for someone's soul?",
        },
        {
          title: "Martyrdom",
          meditation:
            "The third petition honours the courage of the martyrs, who gave their blood rather than break the fidelity they had vowed to Christ.",
          intentionPrompt: "Where am I tempted to compromise my faith?",
        },
        {
          title: "The Teaching Orders",
          meditation:
            "The petition recalls the blessings that have flowed from the orders founded under her protection and name to instruct the young in solid piety.",
          intentionPrompt: "Who taught me the faith, and have I thanked God for them?",
        },
        {
          title: "Conscience before All",
          meditation:
            "The novena ends asking to be ready to suffer anything rather than violate the dictates of conscience.",
          intentionPrompt: "Is my conscience formed and obeyed?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "12 October, ending on the eve of her traditional feast, 21 October",
      citations: [LASANCE_1904_URSULA, CE_URSULA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-bernard-of-clairvaux",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1904_BERNARD, CE_BERNARD],
    payload: {
      slug: "novena-saint-bernard-of-clairvaux",
      title: "Novena to St. Bernard",
      summary:
        "A novena to St. Bernard of Clairvaux: five petitions to the 'admirable St. Bernard', each followed by the Glory be, recalling his vocation and the kinsmen he drew after him, his penance, his monasteries and his counsel to kings and popes, his journeys as a peacemaker, and his writings in honour of Our Lady, and asking for perseverance and devotion to Mary.",
      background: `Bernard was born in 1090 at Fontaines near Dijon and died at Clairvaux in 1153. In 1113 he sought admission to Cîteaux with thirty young noblemen of Burgundy; sent out to found Clairvaux, he remained its abbot for the rest of his life and founded one hundred and sixty-three monasteries. He was canonised by Alexander III in 1174, and Pius VIII declared him a Doctor of the Church. His feast is kept on 20 August, the date the book gives. ${LASANCE_1904_SOURCE} The five petitions, each followed by the Glory be, are said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "perseverance in holiness and devotion to Mary",
      days: repeatedPrayerDays(LASANCE_BERNARD_NOVENA_PRAYER, [
        {
          title: "The Delight of His Parents",
          meditation:
            "The first petition recalls the innocence of his youth and the austerity and fervour he brought to the monastery.",
          intentionPrompt: "What innocence do I need to recover?",
        },
        {
          title: "A Whole Family Drawn to God",
          meditation:
            "Bernard drew his whole family and many distinguished men with him to a life of holiness. The petition asks to correspond to God's inspirations and live up to the perfection of our state.",
          intentionPrompt: "What inspiration of God am I ignoring?",
        },
        {
          title: "Learning and Mortification",
          meditation:
            "He advanced in holiness as he advanced in learning. The second petition asks, through penance, to master our unruly passions.",
          intentionPrompt: "Which passion most needs mastering in me?",
        },
        {
          title: "Founder and Counsellor",
          meditation:
            "The third petition recalls the monasteries he filled with fervent monks, and the kings, princes, bishops and popes who sought his counsel.",
          intentionPrompt: "Whose advice do I seek, and whose do I ignore?",
        },
        {
          title: "Peacemaker",
          meditation:
            "The fourth petition follows him through the kingdoms of the West, bringing peace, confuting errors and converting hardened sinners.",
          intentionPrompt: "Where can I bring peace this week?",
        },
        {
          title: "The Odour of Jesus",
          meditation:
            "It asks that our lives spread the fragrance of Christ, with a lively faith and an ardent love for the Most Holy Eucharist.",
          intentionPrompt: "Do others meet Christ through me?",
        },
        {
          title: "Never Ceasing to Pray",
          meditation:
            "For all his journeys and his poor health he never gave up his meditations, prayers and penances. The fifth petition asks for perseverance in piety until death.",
          intentionPrompt: "What excuse keeps me from praying?",
        },
        {
          title: "Doctor of the Church",
          meditation:
            "His writings, the petition says, earned him the titles of Doctor and Father of the Church.",
          intentionPrompt: "What spiritual reading will I take up?",
        },
        {
          title: "Devotion to Mary",
          meditation:
            "The novena ends with what Bernard is most loved for: his writings in honour of Our Lady, and the fervent devotion to our Mother Mary that the prayer asks for.",
          intentionPrompt: "How will I honour Our Lady on his feast?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-bernard-of-clairvaux",
      typicalStartDate: "11 August, ending on the eve of his memorial, 20 August",
      citations: [LASANCE_1904_BERNARD, CE_BERNARD],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-feast-of-all-saints",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1904_ALL_SAINTS, CE_ALL_SAINTS],
    payload: {
      slug: "novena-feast-of-all-saints",
      title: "Novena for the Feast of All Saints",
      summary:
        "A novena before All Saints in three petitions: to the Queen of All Saints, with three Hail Marys; to the angels who stand before the throne of God; and to the patriarchs, prophets, apostles, martyrs, confessors, matrons and virgins who reign with Christ, each with three Glorys — asking to follow them in virtue and share their glory.",
      background: `All Saints on 1 November honours all the saints, known and unknown. The Catholic Encyclopedia relates that Boniface IV consecrated the Pantheon at Rome to Our Lady and all the martyrs in 609 or 610, that Gregory III (731-741) consecrated a chapel in St. Peter's to all the saints and fixed the anniversary on 1 November, and that Gregory IV (827-844) extended the feast to the whole Church. ${LASANCE_1904_SOURCE} The three petitions, with their Hail Marys and Glorys, are said on each day of the novena. It is distinct from the novena for the Holy Souls in this catalogue (novena-holy-souls-in-purgatory), which is also kept in the days before All Saints. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "the communion of saints and the call of every Christian to holiness",
      days: repeatedPrayerDays(LASANCE_ALL_SAINTS_NOVENA_PRAYER, [
        {
          title: "The Queen of All Saints",
          meditation:
            "The novena begins with Mary, the most powerful mediatrix between God and man, and asks to follow her in the path of virtue.",
          intentionPrompt: "Which of Mary's virtues do I most need?",
        },
        {
          title: "The Holy Angels",
          meditation:
            "The second petition turns to the angels who from the beginning have surrounded God's throne, singing His praise, doing His will and burning with His love.",
          intentionPrompt: "Do I ask my guardian angel for help?",
        },
        {
          title: "Obeying the Divine Law",
          meditation:
            "The angels' example teaches that happiness lies in obeying God's law and faithfully performing the duties of our calling.",
          intentionPrompt: "Which duty of my state am I neglecting?",
        },
        {
          title: "The Patriarchs and Prophets",
          meditation:
            "The third petition begins its roll of the blessed with the faithful patriarchs and holy prophets who waited for Christ.",
          intentionPrompt: "Do I wait for Christ with longing?",
        },
        {
          title: "The Apostles and Martyrs",
          meditation:
            "It continues with the zealous apostles and the invincible martyrs, who preached Christ and died for Him.",
          intentionPrompt: "What am I willing to suffer for my faith?",
        },
        {
          title: "The Confessors",
          meditation:
            "The righteous confessors bore witness to Christ by the way they lived. The feast honours all the saints, known and unknown.",
          intentionPrompt: "What hidden holiness have I seen in others?",
        },
        {
          title: "Matrons and Virgins",
          meditation:
            "Holy women married and unmarried reign with Christ. The prayer names them both, for every state of life has its saints.",
          intentionPrompt: "Who is a model of holiness in my own state of life?",
        },
        {
          title: "Exiles in a Vale of Tears",
          meditation:
            "From their seats of glory the saints are asked to look with pity on us who are still exiles, and to obtain grace to walk in their footsteps.",
          intentionPrompt: "Which saint will I ask to walk with me?",
        },
        {
          title: "A Share of Their Glory",
          meditation:
            "The novena ends on the eve of the feast, meditating on the saints' victories and asking for a share in their immortal glory.",
          intentionPrompt: "Do I really believe that I am called to be a saint?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "23 October, ending on 31 October, the eve of the solemnity",
      relatedFeastSlug: "solemnity-all-saints",
      citations: [LASANCE_1904_ALL_SAINTS, CE_ALL_SAINTS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-ignatius-of-loyola",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1913_IGNATIUS, CE_IGNATIUS_LOYOLA],
    payload: {
      slug: "novena-saint-ignatius-of-loyola",
      title: "Novena to St. Ignatius Loyola",
      summary:
        "A novena to St. Ignatius of Loyola in four petitions, each followed by the Glory be: for an efficacious resolution to practise every virtue and to desire only the glory of Christ, for detachment and patience in persecution, for readiness to make any sacrifice for souls, and for his protection and guidance according to his maxim 'Ad majorem Dei gloriam'.",
      background: `Ignatius was born in 1491 at the castle of Loyola; wounded at the siege of Pamplona in 1521, he turned to God during his convalescence, wrote the Spiritual Exercises, and founded the Society of Jesus, approved by Paul III in 1540. He died at Rome on 31 July 1556 and was canonised by Gregory XV in 1622; his feast is kept on 31 July, the date the book gives. The novena is taken from 'The Blessed Sacrament Book' compiled by the Rev. F. X. Lasance (New York: Benziger Brothers, 1913), which attributes it to Pagani; the four petitions, each followed by the Glory be, are said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "the greater glory of God and zeal for the salvation of souls",
      days: repeatedPrayerDays(LASANCE_IGNATIUS_NOVENA_PRAYER, [
        {
          title: "Reading the Lives of the Saints",
          meditation:
            "Convalescing from his wound, Ignatius read the lives of the saints and resolved to imitate them. The first petition asks for an efficacious resolution to practise all divine virtues.",
          intentionPrompt: "Whose life could I read to be stirred to follow Christ?",
        },
        {
          title: "Renouncing Worldly Honours",
          meditation:
            "He renounced for ever the worldly honours he had sought as a young soldier, and sought nothing but the greater glory of God.",
          intentionPrompt: "What honour or status am I still chasing?",
        },
        {
          title: "Free from All Earthly Love",
          meditation:
            "The petition asks to desire nothing but to see Christ glorified throughout the world.",
          intentionPrompt: "What would change if Christ's glory were my only aim?",
        },
        {
          title: "Poverty and Humility",
          meditation:
            "The second petition recalls how he imitated the poverty, humility and patience of Christ, renouncing the comforts of his home.",
          intentionPrompt: "What comfort could I give up freely?",
        },
        {
          title: "Joy in Persecution",
          meditation:
            "He suffered unjust persecutions joyfully. The petition asks to endure the world's persecutions tranquilly as true disciples of Christ.",
          intentionPrompt: "How do I respond when I am treated unjustly?",
        },
        {
          title: "The Spiritual Exercises",
          meditation:
            "The third petition recalls the souls converted through his Exercises and his Society, and asks to be ready for any sacrifice to win souls for God.",
          intentionPrompt: "Have I ever made a retreat?",
        },
        {
          title: "Hunger and Thirst after Justice",
          meditation:
            "It asks to share in the blessedness promised to those who hunger and thirst after justice.",
          intentionPrompt: "What do I hunger for most?",
        },
        {
          title: "Father of Innumerable Saints",
          meditation:
            "The fourth petition turns to Ignatius as founder of the Society of Jesus and father of many saints, and asks his protection and guidance.",
          intentionPrompt: "Where do I need guidance in my petitions?",
        },
        {
          title: "Ad Majorem Dei Gloriam",
          meditation:
            "The novena ends with his maxim, 'For the greater honor and glory of God', and asks light and salvation for all poor sinners through the sacred wounds of Christ.",
          intentionPrompt: "What will I do for the greater glory of God tomorrow?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-ignatius-of-loyola",
      typicalStartDate: "22 July, ending on the eve of his memorial, 31 July",
      citations: [LASANCE_1913_IGNATIUS, CE_IGNATIUS_LOYOLA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-for-easter",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [LASANCE_1911_EASTER, CE_EASTER],
    payload: {
      slug: "novena-for-easter",
      title: "Novena for Easter",
      summary:
        "A novena for Easter in honour of the glorious Resurrection of Our Lord. Its prayer asks the risen Jesus for grace to die to oneself and rise to a new, divine and immortal life, and asks His Mother for a share in her joy on the day of the Resurrection, that her risen Son may enter the heart and abide there.",
      background: `Easter, as the Catholic Encyclopedia says, is the principal feast of the ecclesiastical year, which Leo the Great called the greatest feast, festum festorum. The prayer passes from the risen Christ, who clothed in glory the body that had been the victim of men's cruelty, to His Mother's joy at the Resurrection, and asks for the gifts of the risen Lord to the apostles in the upper room and to Thomas. The novena is taken from 'With God: a book of prayers and reflections' compiled by the Rev. F. X. Lasance (New York: Benziger Brothers, 1911), which heads it "Novena for Easter. In Honor of the Glorious Resurrection of Our Lord" beneath the Easter verse "This is the day which the Lord has made". The book gives no dates and a single prayer, which speaks of Easter as "this joyous feast" and is said on each day of the novena; the prayers to the glorious wounds of the risen Jesus that follow it under their own heading are not part of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "dying to self and rising with Christ to a new life",
      days: repeatedPrayerDays(LASANCE_EASTER_NOVENA_PRAYER, [
        {
          title: "Clothed in Glory",
          meditation:
            "The prayer begins with the risen body of Christ, clothed in glory and splendour after it had been the victim of the cruelty of man.",
          intentionPrompt: "Do I believe that my own body will rise?",
        },
        {
          title: "To Die to Myself",
          meditation:
            "The prayer asks for grace to die to oneself in order to rise again with Christ.",
          intentionPrompt: "What in me needs to die?",
        },
        {
          title: "New, by Change of Conduct",
          meditation:
            "The new life it asks for is to be new, first of all, by a change of conduct.",
          intentionPrompt: "What will I do differently after Easter?",
        },
        {
          title: "Divine, by Purity of Love",
          meditation:
            "It is to be divine by the generosity and purity of one's love, and immortal by perseverance in doing good.",
          intentionPrompt: "Is my love generous, or calculating?",
        },
        {
          title: "From Darkness to Light",
          meditation:
            "The prayer asks to pass from death to life, from darkness to light, from a life full of imperfections to one worthy of God.",
          intentionPrompt: "What darkness do I want Christ to dispel?",
        },
        {
          title: "From Virtue to Virtue",
          meditation:
            "It asks to go on from light to light and from virtue to virtue until we come to God, the source of all life and all light.",
          intentionPrompt: "What is my next step in virtue?",
        },
        {
          title: "The Joy of His Mother",
          meditation:
            "The prayer turns to the holy Virgin and asks a share in the divine joy she felt on the day of the Resurrection.",
          intentionPrompt: "What sadness do I need her to lift?",
        },
        {
          title: "Through the Closed Doors",
          meditation:
            "As the risen Lord entered the upper room through closed doors, the prayer asks Him to enter the heart and say, 'Peace be to thee'.",
          intentionPrompt: "What doors have I closed against Christ?",
        },
        {
          title: "Abide with Me",
          meditation:
            "Like Thomas, the one praying asks to be shown the sacred wounds, and that the risen Lord abide continually and never depart.",
          intentionPrompt: "How will I keep the joy of Easter alive?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      relatedFeastSlug: "solemnity-easter",
      citations: [LASANCE_1911_EASTER, CE_EASTER],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-blessed-virgin-golden-manual",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [GOLDEN_MANUAL_BLESSED_VIRGIN, CE_BLESSED_VIRGIN_MARY],
    payload: {
      slug: "novena-blessed-virgin-golden-manual",
      title: "Novena to the Blessed Virgin (Golden Manual)",
      summary:
        "A novena to the Blessed Virgin in honour of the joy she received at the Incarnation and during the nine months she carried her Son. It asks her intercession for the favours of the novena, offers nine Hail Marys in honour of that joy, and closes with a prayer offering them as gems in her crown.",
      background: `The prayer recalls the joy Mary received at the Incarnation and during the nine months in which she carried her Son, and asks the protection which, it says, she has promised to those who devoutly commemorate that joy. ${GOLDEN_MANUAL_SOURCE} It is distinct from the novena in honour of the Blessed Virgin already in this catalogue (novena-blessed-virgin-mary), whose prayer is different. The book prints "occidental glory", an evident misprint for "accidental glory", the joy of the blessed that can still increase, which is so corrected. The prayers, with the nine Hail Marys between them, are said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "confidence in Mary's intercession through the mystery of the Incarnation",
      days: repeatedPrayerDays(GOLDEN_MANUAL_BLESSED_VIRGIN_NOVENA_PRAYER, [
        {
          title: "Chosen from All Eternity",
          meditation:
            "The prayer begins with Mary chosen by the Trinity from all eternity to be the most pure Mother of Jesus.",
          intentionPrompt: "Do I see my own life as chosen and loved by God?",
        },
        {
          title: "The Instant of the Incarnation",
          meditation:
            "It reminds her of the joy she received at the moment the Word became flesh in her womb.",
          intentionPrompt: "When did I last thank God for the Incarnation?",
        },
        {
          title: "Nine Months",
          meditation:
            "The prayer recalls her joy during the nine months in which she carried her Son in her womb.",
          intentionPrompt: "How do I carry Christ into my day?",
        },
        {
          title: "Mother of the Afflicted",
          meditation:
            "The prayer asks her, as tender Mother of the afflicted, for her protection in present necessities.",
          intentionPrompt: "What necessity will I entrust to her?",
        },
        {
          title: "If It Be the Will of God",
          meditation:
            "It asks the favours of the novena only if God wills them, and otherwise whatever graces we most need.",
          intentionPrompt: "Am I willing to receive a different grace than I ask?",
        },
        {
          title: "Lively Confidence",
          meditation:
            "The novena is offered to prove the lively confidence we have in her intercession.",
          intentionPrompt: "Is my trust in Mary real or only dutiful?",
        },
        {
          title: "Nine Hail Marys",
          meditation:
            "The Hail Mary is repeated nine times, and the closing prayer offers the salutations in union with the angel Gabriel, who first greeted her as full of grace.",
          intentionPrompt: "Do I pray the Hail Mary with attention?",
        },
        {
          title: "Gems in Her Crown",
          meditation:
            "The closing prayer offers the salutations as gems in the crown of her accidental glory, which will increase in brightness to the end of the world.",
          intentionPrompt: "What good work can I offer in her honour?",
        },
        {
          title: "Through the Heart of Jesus",
          meditation:
            "The novena ends by asking her to hear the prayer for the love of the Heart of Jesus, with which her own heart was always inflamed.",
          intentionPrompt: "What request will I leave in her hands?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "Any time",
      citations: [GOLDEN_MANUAL_BLESSED_VIRGIN, CE_BLESSED_VIRGIN_MARY],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-john-the-baptist",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [GOLDEN_MANUAL_JOHN_THE_BAPTIST, CE_JOHN_THE_BAPTIST],
    payload: {
      slug: "novena-saint-john-the-baptist",
      title: "Novena to St. John the Baptist",
      summary:
        "A novena to St. John the Baptist whose prayer, in three parts, greets him as the glorious precursor of Christ, great in his birth, penance and zeal and greater in purity of heart and humility; as the blessed contemplative and friend of the bridegroom; and as the burning and shining lamp and martyr of Christ, asking for docility to those who preach, purity of heart and the happy martyrdom of Christian mortification.",
      background: `John the Baptist, son of Zachary and Elizabeth, was sent to prepare the way of the Lord; Christ said that among those born of women there is not a greater (Luke 7:28), and he was beheaded at the command of Herod Antipas. The Church keeps the Solemnity of his Nativity on 24 June, which the Catholic Encyclopedia calls one of the oldest feasts, if not the oldest, introduced to honour a saint, and his beheading on 29 August. ${GOLDEN_MANUAL_SOURCE} The first part of the prayer asks his voice for "all the people of this state, of which thou art the special patron", words kept as printed. The book follows the novena with the Litany of St. John the Baptist, which the catalogue publishes separately as litany-of-saint-john-the-baptist; the prayer given here is said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "humility, purity of heart and docility to the word of God",
      days: repeatedPrayerDays(GOLDEN_MANUAL_JOHN_THE_BAPTIST_NOVENA_PRAYER, [
        {
          title: "To Prepare His Ways",
          meditation:
            "John was created to go before the face of the Lord and prepare His ways. The novena begins with his mission.",
          intentionPrompt: "How can I prepare a way for Christ in someone's life?",
        },
        {
          title: "The Greatest Born of Woman",
          meditation:
            "The Searcher of hearts Himself called him the greatest of those born of women. The prayer honours that praise.",
          intentionPrompt: "Whose praise do I seek, God's or men's?",
        },
        {
          title: "Greater in Humility",
          meditation:
            "He was great in his birth, his penance and his zeal, but greater in purity of heart and humility: he thought himself unworthy to loose the latchet of the Lord's shoe.",
          intentionPrompt: "Where must I decrease so that Christ may increase?",
        },
        {
          title: "The Voice in the Wilderness",
          meditation:
            "The first part of the prayer asks him to raise again the voice that once cried in the wilderness for sinners, and to obtain the intentions of the novena.",
          intentionPrompt: "What intention do I bring to him?",
        },
        {
          title: "The Blessed Contemplative",
          meditation:
            "The second part calls him a contemplative whose communion with God began before his birth and whose food and life was prayer.",
          intentionPrompt: "Does prayer nourish me as food does?",
        },
        {
          title: "Friend of the Bridegroom",
          meditation:
            "As friend of the bridegroom he can obtain all things from Christ. The prayer asks above all for docility to those who preach to us.",
          intentionPrompt: "How do I receive the word preached on Sunday?",
        },
        {
          title: "The Burning and Shining Lamp",
          meditation:
            "Christ called him a burning and shining lamp (John 5:35). The third part asks that our hearts be inflamed with the fire of love that consumed him, and that we may know ourselves and, far more, our God.",
          intentionPrompt: "Do I know myself as God knows me?",
        },
        {
          title: "Behold the Lamb of God",
          meditation:
            "With purity of heart he recognised the Lamb of God when He was hidden from all others. The prayer asks to receive Holy Communion often and worthily.",
          intentionPrompt: "Do I recognise Christ in the Eucharist?",
        },
        {
          title: "The Martyrdom of Mortification",
          meditation:
            "He laid down his life for Christ. The novena ends asking to live and die in the happy martyrdom of Christian mortification and faithful duty.",
          intentionPrompt: "What daily duty can I offer as my martyrdom?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-john-the-baptist",
      typicalStartDate: "Any time",
      relatedFeastSlug: "solemnity-nativity-of-john-the-baptist",
      citations: [GOLDEN_MANUAL_JOHN_THE_BAPTIST, CE_JOHN_THE_BAPTIST],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-sacred-heart-golden-manual",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [GOLDEN_MANUAL_SACRED_HEART, CE_DEVOTION_TO_THE_SACRED_HEART],
    payload: {
      slug: "novena-sacred-heart-golden-manual",
      title: "Novena to the Sacred Heart (Golden Manual)",
      summary:
        "A novena to the Sacred Heart of Jesus, 'furnace of eternal charity' and 'ocean of infinite mercy', which adores the Heart present on our altars, recalls that it was pierced to win our confidence, asks one particular favour in the name of Jesus, and then calls on St. Gertrude and all who were devoted to the Sacred Heart to join their prayers for sinners and for our last hour.",
      background: `The Catholic Encyclopedia traces devotion to the Sacred Heart to the Benedictine and Cistercian monasteries of the Middle Ages and names St. Gertrude and St. Mechtilde among those to whom it was already well known; the prayer calls on St. Gertrude by name among the servants of Christ devoted to His Heart. ${GOLDEN_MANUAL_SOURCE} It is distinct from the other novenas to the Sacred Heart in this catalogue (novena-sacred-heart-of-jesus, novena-sacred-heart-saint-alphonsus and novena-feast-of-the-sacred-heart-lings), whose texts are different. The prayer is said on each day of the novena. The day meditations are editorial. It is a private devotion, not a liturgical rite.`,
      intentionTheme: "confidence in the mercy of the Sacred Heart of Jesus",
      days: repeatedPrayerDays(GOLDEN_MANUAL_SACRED_HEART_NOVENA_PRAYER, [
        {
          title: "Furnace of Eternal Charity",
          meditation:
            "The prayer opens with a string of titles: furnace of charity, ocean of mercy, consolation of the afflicted, refuge of sinners, hope of the whole world.",
          intentionPrompt: "Which of these titles speaks to me most today?",
        },
        {
          title: "On Our Altars",
          meditation:
            "It unites our adoration to the perpetual homage that the Heart of Jesus renders to the Godhead on our altars.",
          intentionPrompt: "How attentive am I at Mass?",
        },
        {
          title: "Supply for My Coldness",
          meditation:
            "Conscious of its own insensibility, the prayer asks the Heart of Jesus to supply for it and to accept at least the desire to love Him as He deserves.",
          intentionPrompt: "Where has my love grown cold?",
        },
        {
          title: "Not Only Adored but Loved",
          meditation:
            "The Heart was disclosed not only to be adored but to win our love and become the ground of our confidence.",
          intentionPrompt: "Do I approach Christ with confidence or with fear?",
        },
        {
          title: "Pierced with a Lance",
          meditation:
            "For this end the Heart was pierced on the cross, and for this it remains a daily victim on our altars.",
          intentionPrompt: "What does the pierced Heart ask of me?",
        },
        {
          title: "Overwhelmed in the Garden",
          meditation:
            "In the garden of Olives His Heart was overwhelmed with sorrow at the sight of our miseries. The prayer brings them to Him with full confidence.",
          intentionPrompt: "What misery of mine will I show Him?",
        },
        {
          title: "Impossible to Men",
          meditation:
            "What is impossible to human means is easy to Him. In the name of Jesus, relying on His promise, the prayer asks one particular favour.",
          intentionPrompt: "What seems impossible that I can still ask?",
        },
        {
          title: "St. Gertrude and the Servants of Christ",
          meditation:
            "St. Gertrude and all who were devoted to the Sacred Heart are asked to join their prayers to ours.",
          intentionPrompt: "Which saint will I ask to pray with me?",
        },
        {
          title: "For Sinners and the Hour of Death",
          meditation:
            "The novena ends with prayer for those in mortal sin, and asks that the treasures of mercy be opened to us all at the hour of our death.",
          intentionPrompt: "For which sinner will I pray by name?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "devotion-sacred-heart-of-jesus",
      typicalStartDate: "Any time",
      relatedFeastSlug: "solemnity-sacred-heart",
      citations: [GOLDEN_MANUAL_SACRED_HEART, CE_DEVOTION_TO_THE_SACRED_HEART],
    },
  },
];
