import type { CuratedEntry } from "../index";

/**
 * Novena group 3 — novenas whose received texts are in the public domain,
 * reproduced from books printed before 1929.
 *
 * Sources and copyright basis:
 *
 *   - Bonaventure Hammer, O.F.M., "Mary, Help of Christians, and the Fourteen
 *     Saints Invoked as Holy Helpers" (New York: Benziger Brothers, 1909): the
 *     fourteen novenas to the individual Holy Helpers and the novena to all
 *     fourteen together. The text was taken from the Project Gutenberg
 *     transcription (#33596) and checked word by word against two archive.org
 *     scans of the 1909 printing; where the transcription departs from the
 *     printed page, the printed page is followed (the invocation of St.
 *     Erasmus reads "pray Jesus for me").
 *
 *   - The Raccolta, or Collection of Indulgenced Prayers and Good Works
 *     (London: Burns & Oates; New York: Benziger Bros., 1910), no. 199: the
 *     five novenas for the principal feasts of Our Lady (the Immaculate
 *     Conception, her Nativity, the Annunciation, the Purification and the
 *     Assumption), transcribed from the page images of the archive.org scan
 *     and checked against its OCR. Where the book refers back to a prayer
 *     printed earlier in the same section (the Come, O Holy Ghost, the
 *     closing prayers for the Pope and the Church, the versicles and collect
 *     of the first day), that prayer is written out in full; page
 *     cross-references are dropped, and the Litany of Loreto, printed in
 *     another chapter, is left to the book's own rubric. Three printer's
 *     slips, "ot" for "of", are corrected.
 *
 * Every `prayerText` is copied from the first cited source and nothing in it is
 * paraphrased, shortened, composed or merged across versions. Where a novena's
 * received form says the same prayers on each of the nine days, the prayers are
 * built once from their received parts, in the order the book prints them, and
 * repeated; the day-by-day distinction then lies in the `meditation`, which is a
 * short editorial introduction to the day's subject and never pretends to be
 * part of the prayer. Summaries and backgrounds are editorial and rest on the
 * cited sources; where the old Acts of a saint are legendary, the background
 * says so.
 *
 * Typographic conventions of the printed books are normalised without changing
 * any word: opening words set in capitals or small capitals are given in
 * ordinary case, and curly quotation marks are straightened. Obvious scanning
 * slips in the transcriptions have been corrected against the page images.
 */

const HAMMER_SCAN = "https://archive.org/details/maryhelpofchrist0000hamm/page/219/mode/1up";
const HAMMER_SCAN_FULL = "https://archive.org/details/maryhelpchristi00burkgoog";
const HAMMER_GUTENBERG = "https://www.gutenberg.org/ebooks/33596";
const CE_GEORGE = "https://www.newadvent.org/cathen/06453a.htm";
const CE_BLAISE = "https://www.newadvent.org/cathen/02592a.htm";
const CE_PANTALEON = "https://www.newadvent.org/cathen/11447a.htm";
const CE_VITUS = "https://www.newadvent.org/cathen/15490b.htm";
const CE_CHRISTOPHER = "https://www.newadvent.org/cathen/03728a.htm";
const CE_DENIS = "https://www.newadvent.org/cathen/04721a.htm";
const CE_EUSTACHIUS = "https://www.newadvent.org/cathen/05627a.htm";
const CE_GILES = "https://www.newadvent.org/cathen/06559a.htm";
const CE_MARGARET = "https://www.newadvent.org/cathen/09652b.htm";
const CE_CATHERINE = "https://www.newadvent.org/cathen/03445a.htm";
const CE_BARBARA = "https://www.newadvent.org/cathen/02284d.htm";
const MARTYROLOGY_2_JUNE = "https://roman-martyrology.brandt.id.au/martyrs/06-02.html";
const MARTYROLOGY_8_AUGUST = "https://roman-martyrology.brandt.id.au/martyrs/08-08.html";
const MARTYROLOGY_8_MAY = "https://roman-martyrology.brandt.id.au/martyrs/05-08.html";
const RACCOLTA_1910_NOVENAS =
  "https://archive.org/details/theraccoltaorcol00unknuoft/page/n195/mode/1up";
const CE_RACCOLTA = "https://www.newadvent.org/cathen/12620a.htm";
const CE_IMMACULATE_CONCEPTION = "https://www.newadvent.org/cathen/07674d.htm";
const CE_NATIVITY_OF_MARY = "https://www.newadvent.org/cathen/10712b.htm";
const CE_ANNUNCIATION = "https://www.newadvent.org/cathen/01542a.htm";
const CE_CANDLEMAS = "https://www.newadvent.org/cathen/03245b.htm";
const CE_ASSUMPTION = "https://www.newadvent.org/cathen/02006b.htm";
const MUNIFICENTISSIMUS_DEUS =
  "https://www.vatican.va/content/pius-xii/en/apost_constitutions/documents/hf_p-xii_apc_19501101_munificentissimus-deus.html";

/** Hammer's preparatory prayer, said first in each of the fourteen novenas to the Holy Helpers. */
const HOLY_HELPER_PREPARATORY =
  'Almighty and eternal God! With lively faith and reverently worshiping Thy divine Majesty, I prostrate myself before Thee and invoke with filial trust Thy supreme bounty and mercy. Illumine the darkness of my intellect with a ray of Thy heavenly light and inflame my heart with the fire of Thy divine love, that I may contemplate the great virtues and merits of the saint in whose honor I make this novena, and following his example imitate, like him, the life of Thy divine Son.\n\nMoreover, I beseech Thee to grant graciously, through the merits and intercession of this powerful Helper, the petition which through him I humbly place before Thee, devoutly saying, "Thy will be done on earth as it is in heaven." Vouchsafe graciously to hear it, if it redounds to Thy greater glory and to the salvation of my soul. Amen.';

/** Hammer's closing prayer, said last in each of the fourteen novenas to the Holy Helpers. */
const HOLY_HELPER_CLOSING =
  "My Lord and my God! I offer up to Thee my petition in union with the bitter passion and death of Jesus Christ, Thy Son, together with the merits of His immaculate and blessed Mother, Mary ever virgin, and of all the saints, particularly with those of the holy Helper in whose honor I make this novena.\n\nLook down upon me, merciful Lord! Grant me Thy grace and Thy love, and graciously hear my prayer. Amen.";

/** Hammer's novena in honor of St. George, said unchanged on each of the nine days. */
const GEORGE_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst grant to St. George strength and constancy in the various torments which he sustained for our holy faith; we beseech Thee to preserve, through his intercession, our faith from wavering and doubt, so that we may serve Thee with a sincere heart faithfully unto death. Through Christ our Lord. Amen.",
  "Faithful servant of God and invincible martyr, St. George; favored by God with the gift of faith, and inflamed with an ardent love of Christ, thou didst fight valiantly against the dragon of pride, falsehood, and deceit. Neither pain nor torture, sword nor death could part thee from the love of Christ. I fervently implore thee for the sake of this love to help me by thy intercession to overcome the temptations that surround me, and to bear bravely the trials that oppress me, so that I may patiently carry the cross which is placed upon me; and let neither distress nor difficulties separate me from the love of Our Lord Jesus Christ. Valiant champion of the Faith, assist me in the combat against evil, that I may win the crown promised to them that persevere unto the end.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Blase, said unchanged on each of the nine days. */
const BLASE_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, deliver us through the intercession of Thy holy bishop and martyr Blase, from all evil of soul and body, especially from all ills of the throat; and grant us the grace to make a good confession in the confident hope of obtaining Thy pardon, and ever to praise with worthy lips Thy most holy name. Through Christ our Lord. Amen.",
  "St. Blase, gracious benefactor of mankind and faithful servant of God, who for the love of our Saviour didst suffer so many tortures with patience and resignation; I invoke thy powerful intercession. Preserve me from all evils of soul and body. Because of thy great merits God endowed thee with the special grace to help those that suffer from ills of the throat; relieve and preserve me from them, so that I may always be able to fulfil my duties, and with the aid of God's grace perform good works. I invoke thy help as special physician of souls, that I may confess my sins sincerely in the holy sacrament of Penance and obtain their forgiveness. I recommend to thy merciful intercession also those who unfortunately concealed a sin in confession. Obtain for them the grace to accuse themselves sincerely and contritely of the sin they concealed, of the sacrilegious confessions and communions they made, and of all the sins they committed since then, so that they may receive pardon, the grace of God, and the remission of the eternal punishment. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Erasmus, said unchanged on each of the nine days. */
const ERASMUS_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, grant us through the intercession of Thy dauntless bishop and martyr Erasmus, who so valiantly confessed the Faith, that we may learn the doctrine of this faith, practise its precepts, and thereby be made worthy to attain its promises. Through Christ our Lord. Amen.",
  "Holy martyr Erasmus, who didst willingly and bravely bear the trials and sufferings of life, and by thy charity didst console many fellow-sufferers; I implore thee to remember me in my needs and to intercede for me with God. Staunch confessor of the Faith, victorious vanquisher of all tortures, pray Jesus for me and ask Him to grant me the grace to live and die in the Faith through which thou didst obtain the crown of glory. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Pantaleon, said unchanged on each of the nine days. */
const PANTALEON_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst give to St. Pantaleon the grace of exercising charity toward his fellow-men by distributing his goods to the poor, and hast made him a special patron of the sick, grant, that we, too, show our charity by works of mercy; and through the intercession of this Thy servant preserve us from sickness. But if it be Thy will that illness should afflict us, give us the grace to bear it patiently, and let it promote our soul's salvation. Amen.",
  "St. Pantaleon, who during life didst have great pity for the sick and with the help of God didst often relieve and cure them; I invoke thy intercession with God, that I may obtain the grace to serve Him in good health by cheerfully fulfilling the duties of my state of life. But if it be His holy will to visit me with illness, pain, and suffering, do thou aid me with thy powerful prayer to submit humbly to His chastisements, to accept sickness in the spirit of penance and to bear it patiently according to His holy will. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Vitus, said unchanged on each of the nine days. */
const VITUS_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "Grant us, O God, through the intercession of St. Vitus, a due estimation of the value of our soul and of its redemption by the precious blood of Thy Son Jesus Christ; so that, for its salvation, we bear all trials with fortitude. Give this Thy youthful servant and heroic martyr as a guide and protector to Christian youths, that following his example they may after a victorious combat receive the crown of justice in heaven. Through Christ our Lord. Amen.",
  "St. Vitus, glorious martyr of Christ; in thy youth thou wast exposed to violent and dangerous temptations, but in the fear of God and for the love of Jesus thou didst victoriously overcome them. O amiable, holy youth, I implore thee by the love of Jesus, assist me with thy powerful intercession to overcome the temptations to evil, to avoid every occasion of sin, and thus to preserve spotless the robe of innocence and sanctifying grace, and to bring it unstained to the judgment-seat of Jesus Christ, that I may forever enjoy the beatific vision of God which is promised to the pure of heart. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Christophorus, said unchanged on each of the nine days. */
const CHRISTOPHER_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst make St. Christophorus a true Christ-bearer, who converted multitudes to the Christian faith, and who didst give him the grace to suffer for Thy sake the most cruel torments; through the intercession of this saint we implore Thee to protect us from sin, the only real evil. Preserve us, also, against harmful elementary forces, such as earthquake, lightning, fire, and flood. Amen.",
  "Great St. Christophorus, seeking the strongest and mightiest master thou didst find him in Jesus Christ, the almighty God of heaven and earth, and didst faithfully serve Him with all thy power to the end of thy life, gaining for Him countless souls and finally shedding thy blood for Him; obtain for me the grace to bear Christ always in my heart, as thou didst once bear Him on thy shoulder, so that I thereby may be strengthened to overcome victoriously all temptations and resist all enticements of the world, the devil, and the flesh, and that the powers of darkness may not prevail against me. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Dionysius, said unchanged on each of the nine days. */
const DENIS_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst confer Thy saving faith on the people of France through Thy holy bishop and martyr Dionysius, and didst glorify him before and after his martyrdom by many miracles; grant us through his intercession that the Faith practised and preached by him be our light on the way of life, so that we may be preserved from all anxieties of conscience, and if by human frailty we have sinned, we may return to Thee speedily by true penance. Through Christ our Lord. Amen.",
  "Glorious servant of God, St. Dionysius, with intense love thou didst devote thyself to Christ after learning to know Him through the apostle St. Paul, and didst preach His saving name to the nations, to bring whom to His knowledge and love thou didst not shrink from martyrdom; implore for me a continual growth in the knowledge and love of Jesus, so that my restless heart may experience that peace which He alone can give. Help me by thy powerful intercession with God to serve Him with a willing heart, to devote myself with abiding love to His service, and thereby to attain the eternal bliss of heaven. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Cyriacus, said unchanged on each of the nine days. */
const CYRIACUS_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst grant to St. Cyriacus the grace of heroic charity and trustful resignation to Thy holy will; bestow upon us, through his intercession, the grace to walk before Thee in self-denying charity and to know and fulfil Thy will in all things. Through Christ our Lord. Amen.",
  "St. Cyriacus, great servant of God, loving Christ with all thy heart, thou didst for His sake also love thy fellow-men, and didst serve them even at the peril of thy life, for which charity God rewarded thee with the power to overcome Satan, the arch-enemy, and to deliver the poor obsessed from his dreadful tyranny; implore for me of God an effective, real, and true charity. Show thy power over Satan also in me; deliver me from his influence when he tries to tempt me. Help me to repel his assaults and to gain the victory over him in life and in death. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Achatius, said unchanged on each of the nine days. */
const ACHATIUS_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst fortify Thy holy martyr Achatius with constancy and trustful reliance on Thee in death; grant us through his intercession at the hour of our death to be free from all anxiety and victorious in our last combat with the enemy. Through Christ our Lord. Amen.",
  "Valiant martyr of Christ, St. Achatius, who preached Christ faithfully before kings and judges, and didst gain the victory over the enemies of God; help me through thy powerful intercession to resist and gain the victory over all the enemies of my salvation, over the world and its allurements, over the concupiscence of the flesh, and over the temptations of Satan. I implore thee particularly to assist me in my agony, when the powers of hell rise against me to rob my soul. Then do thou come to my aid and repel the assaults of the enemy, so that I surrender my soul into the hands of my Redeemer in faith, hope, and charity, and confiding in His infinite merits. Through the same Christ our Lord. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Eustachius, said unchanged on each of the nine days. */
const EUSTACE_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst lead Thy holy martyr Eustachius safely through many trials and dangers to the glorious crown of martyrdom; enlighten and strengthen us through his intercession, that we persevere in Thy love amid the trials of this life, and by resignation to Thy holy will come forth from the darkness of this earth into the light of Thy eternal glory. Amen.",
  "Heroic servant of God, St. Eustachius, cast from the height of earthly glory and power into the deepest misery, thou wast engaged for a long time in the labor of a menial servant, eating the bitter bread of destitution; but never didst thou murmur against the severe probation to which God subjected thee. I implore thee to aid me with thy powerful intercession, that in all conditions I may resign myself to the holy will of God, and particularly that I may bear poverty and its consequences with patience, trusting in God's providence, completely resigned to the decrees of Him who humbles and exalts, chastises and heals, sends trials and consolations, and who has promised to those who follow Him in the spirit of poverty His beatific vision throughout all eternity. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Giles, said unchanged on each of the nine days. */
const GILES_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, we beseech Thee to grant us through the merits and intercession of St. Giles to flee from the vanity and praise of this world, to avoid carefully all occasions of sin, to cleanse our hearts from all wickedness by a sincere confession, to leave this world in Thy love and rich in good works, and to find Thee gracious on the day of judgment. Through Christ our Lord. Amen.",
  'Zealous follower of Christ, St. Giles; from early youth thou didst take to heart the words of our Saviour: "Learn of Me, because I am meek and humble of heart." Therefore thou didst flee from the praise and honors of the world, and wast rewarded with the grace to preserve thy heart from all sin and to persevere in a holy life to a ripe old age. I, on my part, through pride, self-confidence, and negligence, yielded to my evil inclinations, and thereby sinned grievously and often, offending my God and Lord, my Creator and Redeemer, my most loving Father. Therefore I implore thee to help me through thy mighty intercession to be enlightened by the Holy Ghost, that I may know the malice, grievousness, and multitude of my sins, confess them humbly, fully, and contritely, and receive pardon, tranquillity of heart, and peace of conscience from God. Amen.',
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Margaret, said unchanged on each of the nine days. */
const MARGARET_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, grant us through the intercession of thy holy virgin and martyr Margaret, undauntedly to confess the Faith, carefully to observe the chastity of our state of life, and to overcome the temptations of the world, the devil, and the flesh, and thereby escape the punishments of eternal damnation. Amen.",
  'St. Margaret, holy virgin and martyr, thou didst faithfully preserve the robe of holy innocence and purity, valiantly resisting all the blandishments and allurements of the world for the love of thy divine Spouse, Jesus Christ; help me to overcome all temptations against the choicest of all virtues, holy purity, and to remain steadfast in the love of Christ, in order to preserve this great gift of God. Implore for me the grace of perseverance in prayer, distrust of myself, and flight from the occasions of sin, and finally the grace of a good death, so that in heaven I may "follow the Lamb whithersoever He goeth." Amen.',
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Catherine, said unchanged on each of the nine days. */
const CATHERINE_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst distinguish Thy holy virgin and martyr Catherine by the gift of great wisdom and virtue, and a victorious combat with the enemies of the Faith; grant us, we beseech Thee, through her intercession, constancy in the Faith and the wisdom of the saints, that we may devote all the powers of our mind and heart to Thy service. Through Christ our Lord. Amen.",
  "St. Catherine, glorious virgin and martyr, resplendent in the luster of wisdom and purity; thy wisdom refuted the adversaries of divine truth and covered them with confusion; thy immaculate purity made thee a spouse of Christ, so that after thy glorious martyrdom angels carried thy body to Mount Sinai. Implore for me progress in the science of the saints and the virtue of holy purity, that vanquishing the enemies of my soul, I may be victorious in my last combat and after death be conducted by the angels into the eternal beatitude of heaven. Amen.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** Hammer's novena in honor of St. Barbara, said unchanged on each of the nine days. */
const BARBARA_NOVENA_PRAYER = [
  HOLY_HELPER_PREPARATORY,
  "O God, who didst adorn Thy holy virgin and martyr Barbara with extraordinary fortitude in the confession of the Faith, and didst console her in the most atrocious torments; grant us through her intercession perseverance in the fulfilment of Thy law and the grace of being fortified before our end with the holy sacraments, and of a happy death. Through Christ our Lord. Amen.",
  "Intrepid virgin and martyr, St. Barbara, through thy intercession come to my aid in all needs of my soul. Obtain for me the grace to be preserved from a sudden and unprovided death; assist me in my agony, when my senses are benumbed and I am in the throes of death. Then, O powerful patroness of the dying, come to my aid! Repel from me all the assaults and temptations of the evil one, and obtain for me the grace to receive before death the holy sacraments, that I breathe forth my soul confirmed in faith, hope, and charity, and be worthy to enter eternal glory. Amen.",
  "St. Barbara, at my last end\nObtain for me the Sacrament;\nAssist one in that direst need\nWhen I my God and Judge must meet:\nThat robed in sanctifying grace\nMy soul may stand before His face.",
  HOLY_HELPER_CLOSING,
].join("\n\n");

/** St. Alphonsus's preparatory prayer, said first on each day of the novena to all the Holy Helpers. */
const HOLY_HELPERS_PREPARATORY =
  "Great princes of heaven, Holy Helpers, who sacrificed to God all your earthly possessions, wealth, preferment, and even life, and who now are crowned in heaven in the secure enjoyment of eternal bliss and glory; have compassion on me, a poor sinner in this vale of tears, and obtain for me from God, for whom you gave up all things and who loves you as His servants, the strength to bear patiently all the trials of this life, to overcome all temptations, and to persevere in God's service to the end, that one day I too may be received into your company, to praise and glorify Him, the supreme Lord, whose beatific vision you enjoy, and whom you praise and glorify for ever. Amen.";

/** The litany, versicle, collects and invocation said after the day's prayer on every day of that novena. */
const HOLY_HELPERS_LITANY_AND_PRAYERS = [
  "Lord, have mercy on us.\nChrist, have mercy on us.\nLord, have mercy on us.\nChrist, hear us.\nChrist, graciously hear us.\nGod the Father of heaven, have mercy on us.\nGod the Son, Redeemer of the world, have mercy on us.\nGod the Holy Ghost, have mercy on us.\nHoly Trinity, one God, have mercy on us.\nHoly Mary, queen of martyrs, pray for us.\nSt. Joseph, helper in all needs, pray for us.\nFourteen Holy Helpers, pray for us.\nSt. George, valiant martyr of Christ, pray for us.\nSt. Blase, zealous bishop and benefactor of the poor, pray for us.\nSt. Erasmus, mighty protector of the oppressed, pray for us.\nSt. Pantaleon, miraculous exemplar of charity, pray for us.\nSt. Vitus, special protector of chastity, pray for us.\nSt. Christophorus, mighty intercessor in dangers, pray for us.\nSt. Dionysius, shining mirror of faith and confidence, pray for us.\nSt. Cyriacus, terror of hell, pray for us.\nSt. Achatius, helpful advocate in death, pray for us.\nSt. Eustachius, exemplar of patience in adversity, pray for us.\nSt. Giles, despiser of the world, pray for us.\nSt. Margaret, valiant champion of the Faith, pray for us.\nSt. Catherine, victorious defender of the Faith and of purity, pray for us.\nSt. Barbara, mighty patroness of the dying, pray for us.\nAll ye Holy Helpers, pray for us.\nAll ye saints of God, pray for us.\nIn temptations against faith, pray for us.\nIn adversity and trials, pray for us.\nIn anxiety and want, pray for us.\nIn every combat, pray for us.\nIn every temptation, pray for us.\nIn sickness, pray for us.\nIn all needs, pray for us.\nIn fear and terror, pray for us.\nIn dangers of salvation, pray for us.\nIn dangers of honor, pray for us.\nIn dangers of reputation, pray for us.\nIn dangers of property, pray for us.\nIn dangers by fire and water, pray for us.\nBe merciful, spare us, O Lord!\nBe merciful, graciously hear us, O Lord!\nFrom all sin, deliver us, O Lord.\nFrom Thy wrath, deliver us, O Lord.\nFrom the scourge of earthquake, deliver us, O Lord.\nFrom plague, famine, and war, deliver us, O Lord.\nFrom lightning and storms, deliver us, O Lord.\nFrom a sudden and unprovided death, deliver us, O Lord.\nFrom eternal damnation, deliver us, O Lord.\nThrough the mystery of Thy holy incarnation, deliver us, O Lord.\nThrough Thy birth and Thy life, deliver us, O Lord.\nThrough Thy cross and passion, deliver us, O Lord.\nThrough Thy death and burial, deliver us, O Lord.\nThrough the merits of Thy blessed Mother Mary, deliver us, O Lord.\nThrough the merits of the Fourteen Holy Helpers, deliver us, O Lord.\nOn the Day of Judgment, deliver us, O Lord!\nWe sinners, beseech Thee, hear us.\nThat Thou spare us, we beseech Thee, hear us.\nThat Thou pardon us, we beseech Thee, hear us.\nThat Thou convert us to true penance, we beseech Thee, hear us.\nThat Thou give and preserve the fruits of the earth, we beseech Thee, hear us.\nThat Thou protect and propagate Thy holy Church, we beseech Thee, hear us.\nThat Thou preserve peace and concord among the nations, we beseech Thee, hear us.\nThat Thou give eternal rest to the souls of the departed, we beseech Thee, hear us.\nThat Thou come to our aid through the intercession of the Holy Helpers, we beseech Thee, hear us.\nThat through the intercession of St. George Thou preserve us in the Faith, we beseech Thee, hear us.\nThat through the intercession of St. Blase Thou confirm us in hope, we beseech Thee, hear us.\nThat through the intercession of St. Erasmus Thou enkindle in us Thy holy love, we beseech Thee, hear us.\nThat through the intercession of St. Pantaleon Thou give us charity for our neighbor, we beseech Thee, hear us.\nThat through the intercession of St. Vitus Thou teach us the value of our soul, we beseech Thee, hear us.\nThat through the intercession of St. Christophorus Thou preserve us from sin, we beseech Thee, hear us.\nThat through the intercession of St. Dionysius Thou give us tranquillity of conscience, we beseech Thee, hear us.\nThat through the intercession of St. Cyriacus Thou grant us resignation to Thy holy will, we beseech Thee, hear us.\nThat through the intercession of St. Eustachius Thou give us patience in adversity, we beseech Thee, hear us.\nThat through the intercession of St. Achatius Thou grant us a happy death, we beseech Thee, hear us.\nThat through the intercession of St. Giles Thou grant us a merciful judgment, we beseech Thee, hear us.\nThat through the intercession of St. Margaret Thou preserve us from hell, we beseech Thee, hear us.\nThat through the intercession of St. Catherine Thou shorten our purgatory, we beseech Thee, hear us.\nThat through the intercession of St. Barbara Thou receive us in heaven, we beseech Thee, hear us.\nThat through the intercession of all the Holy Helpers Thou wilt grant our prayers, we beseech Thee, hear us.\nLamb of God, who takest away the sins of the world, spare us, O Lord.\nLamb of God, who takest away the sins of the world, graciously hear us, O Lord.\nLamb of God, who takest away the sins of the world, have mercy on us, O Lord.",
  "V. Pray for us, ye Fourteen Holy Helpers.\nR. That we may be made worthy of the promise of Christ.",
  "Let us Pray\n\nAlmighty and eternal God, who hast bestowed extraordinary graces and gifts on Thy saints George, Blase, Erasmus, Pantaleon, Vitus, Christophorus, Dionysius, Cyriacus, Eustachius, Achatius, Giles, Margaret, Catherine, and Barbara, and hast illustrated them by miracles; we beseech Thee to graciously hear the petitions of all who invoke their intercession. Through Christ our Lord. Amen.\n\nO God, who didst miraculously fortify the Fourteen Holy Helpers in the confession of the Faith; grant us, we beseech Thee, to imitate their fortitude in overcoming all temptations against it, and protect us through their intercession in all dangers of soul and body, so that we may serve Thee in purity of heart and chastity of body. Through Christ our Lord. Amen.",
  "Fourteen Holy Helpers, who served God in humility and confidence on earth and are now in the enjoyment of His beatific vision in heaven; because you persevered till death you gained the crown of eternal life. Remember the dangers that surround us in this vale of tears, and intercede for us in all our needs and adversities. Amen.\n\nFourteen Holy Helpers, select friends of God, I honor you as mighty intercessors, and come with filial confidence to you in my needs, for the relief of which I have undertaken to make this novena. Help me by your intercession to placate God's wrath, which I have provoked by my sins, and aid me in amending my life and doing penance. Obtain for me the grace to serve God with a willing heart, to be resigned to His holy will, to be patient in adversity and to persevere unto the end, so that, having finished my earthly course, I may join you in heaven, there to praise for ever God, who is wonderful in His saints. Amen.",
].join("\n\n");

const HOLY_HELPERS_DAY_1 = [
  HOLY_HELPERS_PREPARATORY,
  "We beseech Thee, O Lord, to hear the prayer which we send up to Thee in honor of Thy glorified servants, the Fourteen Holy Helpers: and as we can not rely upon our own justice, grant our petition through the intercession of those whose merits have made them especially dear to Thee. Through Christ our Lord. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_2 = [
  HOLY_HELPERS_PREPARATORY,
  "O God, who according to the decrees of Thy providence hast created man for eternal bliss; grant, through the intercession of the Holy Helpers, that I may attain to my destiny by being united with Thee in this life and loving and praising Thee for ever in heaven. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_3 = [
  HOLY_HELPERS_PREPARATORY,
  "O God, I beseech Thee, through the faith of the Holy Helpers, grant me the grace to treasure in my heart the doctrines of our holy faith, to believe them firmly, to confess them bravely, and to live according to their precepts, that through that same faith I may become worthy to be admitted to Thy beatific vision in heaven. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_4 = [
  HOLY_HELPERS_PREPARATORY,
  "Eternal God of love and mercy, I thank Thee for all the benefits Thou hast conferred upon me, and hope to obtain, through the intercession of the Holy Helpers, all the graces necessary for my salvation. Through Christ our Lord. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_5 = [
  HOLY_HELPERS_PREPARATORY,
  "O God of mercy and love, I thank Thee from all my heart for the countless graces which Thy infinite love has bestowed on me. By the ardent love which the Holy Helpers had for Thee, I implore Thee to enkindle in my heart the flame of Thy love, so that I may remain in Thee and Thou in me. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_6 = [
  HOLY_HELPERS_PREPARATORY,
  'O God of charity, who dost will that I love my neighbor for Thy sake, grant me the grace, through the intercession of the Holy Helpers, to be animated with that spirit of charity which embraces all and excludes none, which "is patient, kind, envieth not, dealeth not perversely, is not puffed up, is not ambitious, seeketh not her own, is not provoked to anger, thinketh no evil, rejoiceth not in iniquity, but rejoiceth with the truth, beareth all things, believeth all things, endureth all things, and never falleth away" (1 Cor. xiii. 4-8). Amen.',
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_7 = [
  HOLY_HELPERS_PREPARATORY,
  "Merciful God, who gavest the Holy Helpers the grace to fulfil Thy will regardless of human respect; grant that we may obtain through their intercession and merits the courage to despise the opinion of men, and ever serve Thee with a fearless heart. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_8 = [
  HOLY_HELPERS_PREPARATORY,
  "O God, I implore Thee through the merits and intercession of the Holy Helpers, to grant me the spirit of prayer, that following their example I may walk in Thy presence and ever enjoy the consolation of intercourse with Thee. Through Christ our Lord. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
].join("\n\n");

const HOLY_HELPERS_DAY_9 = [
  HOLY_HELPERS_PREPARATORY,
  "O God, whose mercies are infinite and whose goodness is without limit, I beseech Thee through the merits and intercession of the Holy Helpers, grant me the grace of perseverance in Thy love and service to the end. Thou, who dost dispense so many favors through the Holy Helpers, despise not my prayer, but graciously hear and grant it. Amen.",
  HOLY_HELPERS_LITANY_AND_PRAYERS,
  "O faithful servants of God and powerful protectors of man, Holy Helpers! Since Our Lord appointed you the heavenly advocates for our needs on earth, I confidently turn to you for help in my distress. Countless numbers praise you for aiding them with counsel in doubt, with consolation in anxiety, with health in illness, with safety in danger, with delivery from prison, and with help and assistance in all tribulations. Therefore I, too, have recourse to you, and implore you not to refuse me your aid.\n\nGive thanks to God for me for all the graces He granted me during this novena. I ascribe them to your great merits and powerful intercession. I thank you all together, and each one in particular, for your interest in my favor before the throne of God. I commend myself to your continued protection, that I may one day be united with you in heaven, there to thank the Giver of all good things and to praise Him for all eternity. Amen.",
].join("\n\n");

/** The Come, O Holy Ghost with which each of the Raccolta's five Marian novenas opens. */
const RACCOLTA_COME_HOLY_GHOST =
  "Come, O Holy Ghost, fill the hearts of thy faithful and kindle in them the fire of thy love.\nV. Send forth thy Spirit and they shall be created;\nR. And Thou shalt renew the face of the earth.\nLet us pray.\nO God, who hast taught the hearts of the faithful by the light of the Holy Spirit; grant us by the same Spirit to relish what is right, and evermore to rejoice in his consolation. Through Christ our Lord.\nR. Amen.";

/** The prayers for the Pope and for the Church with which each of those novenas closes. */
const RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH = [
  "O God, the Shepherd and Ruler of all the faithful, graciously look down upon thy servant N., whom Thou hast chosen to be the Pastor of thy Church; and grant him, we beseech Thee, both by word and example, so to direct those over whom Thou hast placed him, that together with the flock entrusted to his care, he may attain eternal life.",
  "O God, our refuge and strength, who art the author of all holiness, listen to the pious prayers of thy Church, and grant that what we ask in faith we may effectually obtain, through Christ our Lord.\nR. Amen.",
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_1 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Behold me at thy sacred feet, O Immaculate Virgin. I rejoice with thee, because from all eternity thou wast elected to be the Mother of the Eternal Word, and wast preserved stainless from the taint of original sin. I praise and bless the Most Holy Trinity, who poured out upon thy soul in thy Conception the treasure of that privilege. I humbly pray thee to obtain for me grace effectually to overcome the sad effects produced in my soul by original sin; make me wholly victorious over them, that I may never cease to love my God.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_2 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Mary, unsullied lily of purity, I rejoice with thee, because from the first moment of thy Conception thou wast filled with grace, and hadst given unto thee the perfect use of reason. I thank and adore the ever blessed Trinity, who gave thee those high gifts. Behold me at thy feet overwhelmed with shame to see myself so poor in grace. O Thou who wast filled full of heavenly grace, grant me a portion of that same grace, and make me a partaker in the treasures of thy Immaculate Conception.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_3 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Mary, mystic rose of purity, I rejoice with thee at the glorious triumph thou didst gain over the serpent by thy Immaculate Conception, in that thou wast conceived without original sin. I thank and praise with my whole heart the ever blessed Trinity, who granted thee that glorious privilege; and I pray thee to obtain for me courage to overcome every snare of the great enemy, and never to stain my soul with mortal sin. Be thou always mine aid, and enable me with thy protection to obtain the victory over all the enemies of man's eternal welfare.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_4 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Mary Immaculate Virgin, mirror of holy purity, I rejoice exceedingly to see how from thy Immaculate Conception there were infused into thy soul the most sublime and perfect virtues with all the gifts of the most Holy Spirit. I thank and praise the ever blessed Trinity who bestowed upon thee these high privileges, and I beseech thee, gracious Mother, obtain for me grace to practise every Christian virtue, and so to become worthy to receive the gifts and graces of the Holy Ghost.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_5 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Mary, bright moon of purity, I congratulate thee in that the mystery of thy Immaculate Conception was the beginning of salvation to the human race, and was the joy of the whole world. I thank and bless the ever blessed Trinity who did so magnify and glorify thy person. I entreat thee to obtain for me grace so to profit by the death and passion of thy dear Son, that his Precious Blood may not have been shed upon the Cross for me in vain, but that after a holy life I may be saved.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_6 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Mary Immaculate, brilliant star of purity, I rejoice with thee, because thy Immaculate Conception brought exceeding joy to all the angels of Paradise. I thank and bless the ever blessed Trinity, who enriched thee with this privilege. Enable me also one day to take part in this heavenly joy, praising and blessing thee in the company of angels, world without end. Amen.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_7 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Mary Immaculate, rising morn of purity, I rejoice with thee, and I am filled with admiration at beholding thee confirmed in grace and rendered sinless from the first moment of thy Conception. I thank and praise the ever blessed Trinity, who elected thee alone from all mankind for this special privilege. Holiest Virgin, obtain for me so entire and lasting a hatred of sin, the worst of all evils, that I may rather die than ever again commit a mortal sin.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_8 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Mary, Virgin, sun without stain, I congratulate thee and I rejoice with thee, because God gave thee in thy Conception a greater and more abundant grace than He gave to all his angels and his saints together, even when their merits were most exalted. I thank and admire the immense beneficence of the ever blessed Trinity, who hath dispensed to thee alone this privilege. Oh, enable me too to correspond with the grace of God, and never more to receive it in vain; change my heart, and help me to begin in earnest a new life.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_IMMACULATE_CONCEPTION_DAY_9 = [
  RACCOLTA_COME_HOLY_GHOST,
  "Virgin most pure, conceived without sin, all fair and stainless in thy Conception; glorious Mary, full of grace, Mother of my God, Queen of Angels and of men,—I humbly venerate thee as Mother of my Saviour, who, though He was God, taught me by his own veneration, reverence, and obedience to thee, the honour and homage that are due to thee. Vouchsafe, I pray thee, to accept this Novena which I dedicate to thee. Thou art the safe refuge of the penitent sinner; it is very fitting, then, that I should have recourse to thee. Thou art the Mother of Compassion; then wilt thou surely be moved with pity for my many miseries. Thou art my best hope after Jesus; thou canst not but accept the loving confidence that I have in thee. Make me worthy to be called thy son, that so I may dare to cry unto thee: Show thyself a mother.\nAve Maria nine times, and Gloria Patri once.",
  "Immaculate Mary, living light of holiness, model of purity, Virgin and Mother, as soon as thou wast conceived, thou didst profoundly adore thy God, giving him thanks, because by means of thee the ancient curse was blotted out, and blessing was again come upon the sinful sons of Adam. Let this blessing kindle in my heart love towards God; and do thou inflame my heart still more and more, that I may ever love Him constantly on earth, and afterwards eternally enjoy Him in heaven, there to thank and praise Him more and more fervently for all the wondrous privileges conferred on thee, and to rejoice with thee for thy high crown of glory.",
  "Then say or sing the Litany of the Blessed Virgin, or else,\nV. All fair art thou, O Mary.\nR. All fair art thou, O Mary.\nV. The original stain is not in thee.\nR. The original stain is not in thee.\nV. Thou art the glory of Jerusalem.\nR. Thou art the joy of Israel.\nV. Thou art the honour of our people.\nR. Thou art the advocate of sinners.\nV. O Mary.\nR. O Mary.\nV. Virgin most prudent.\nR. Mother most clement.\nV. Pray for us.\nR. Intercede for us with our Lord Jesus Christ.",
  "After the Litany or Hymn as above, say,\nV. In thy conception, O Virgin, thou wast immaculate.\nR. Pray for us to the Father, whose Son was born of thee.\nLet us pray.\nO God, who through the Immaculate Conception of a Virgin didst prepare a worthy dwelling-place for thy Son, we beseech Thee, who by the death of that Son, foreseen by Thee, didst preserve her from all stain of sin, to grant that by her intercession we also may be purified, and so may come to Thee. Through Christ our Lord. Amen.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

/** The Raccolta novena for Our Lady's Nativity, said the same on each of the nine days. */
const RACCOLTA_NATIVITY_NOVENA_PRAYER = [
  RACCOLTA_COME_HOLY_GHOST,
  "Most holy Mary, elect and predestined from all eternity by the most Holy Trinity to be Mother of the only-begotten Son of the Eternal Father, foretold by the Prophets, expected by the Patriarchs, desired by all nations, Sanctuary and living temple of the Holy Ghost, sun without stain, conceived free from original sin, Mistress of Heaven and of Earth, Queen of Angels: humbly prostrate at thy feet we give thee our homage, rejoicing that the year has brought round again the memory of thy most happy Nativity; and we pray thee with all our hearts to vouchsafe in thy goodness now to come down again and be reborn spiritually in our souls, that, led captive by thy loveliness and sweetness, they may ever live united to thy most sweet and loving heart.\n\nSo now whilst we salute thee nine times, we will direct our thoughts to the nine months which thou didst pass enclosed in thy mother's womb; and we will devoutly say:\n\nWe hail thee, O Mary, who tracing thy descent from the royal house of David, didst come forth to the light of Heaven with high honour from the womb of holy Anna, thy most happy mother. Ave Maria.\n\nWe hail thee, heavenly babe, white dove of purity; who in spite of the serpent wast conceived free from original sin. Ave Maria.\n\nWe hail thee, bright morn; who, forerunner of the heavenly Sun of Justice, didst bring the first light to earth. Ave Maria.\n\nWe hail thee, Elect; who, like the untarnished Sun, didst burst forth in the dark night of sin. Ave Maria.\n\nWe hail thee, beauteous Moon; who didst shed light upon a world wrapped in the thickest darkness of paganism. Ave Maria.\n\nWe hail thee, dread warrior-child; who, in thyself a host, didst put to flight all hell. Ave Maria.\n\nWe hail thee, fair soul of Mary; who from eternity wast possessed by God. Ave Maria.\n\nWe hail thee, dear child, and we humbly venerate thy most holy infant body, the sacred swaddling clothes wherewith they bound thee, the sacred crib wherein they laid thee, and we bless the hour and the day when thou wast born. Ave Maria.\n\nWe hail thee, much beloved infant, adorned with every virtue immeasurably above all saints, and therefore worthy Mother of the Saviour of the world; who, having been made fruitful by the Holy Spirit, didst bring forth the Word Incarnate. Ave Maria.\n\nLet us pray.\nO most lovely infant, who by thy holy birth hast comforted the world, made glad the Heavens, struck terror into hell, brought help to the fallen, consolation to the sad, salvation to the weak, joy to all men living; we entreat thee, with the most fervent love and gratitude, to be spiritually reborn in our souls by means of thy most holy love; renew our spirit in thy service, rekindle in our hearts the fire of charity, bid all virtues blossom there, that so we may find more and more favour in thy gracious eyes. Mary! be thou our Mary, and may we feel the saving power of thy sweetest name; may it ever be our comfort to call on that name in all our troubles; may it be our hope in dangers, our shield in temptation, and our last utterance in death. Sit nobis nomen Mariæ mel in ore, melos in aure, et jubilus in corde. Amen. Let the name of Mary be honey in the mouth, melody in the ear, joy in the heart. Amen.",
  "Here follows the Litany. Then say:\nV. The Nativity, O Virgin Mother of God.\nR. Hath brought joy to the whole world.\nLet us pray.\nGrant to us thy servants, we beseech Thee, O Lord, the gift of heavenly grace; that to all those for whom the delivery of the Blessed Virgin was the beginning of salvation, this her votive festival may give increase of peace.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

/** The Raccolta novena for the Annunciation, said the same on each of the nine days. */
const RACCOLTA_ANNUNCIATION_NOVENA_PRAYER = [
  RACCOLTA_COME_HOLY_GHOST,
  'I venerate and I admire thee, most holy Virgin Mary, as the humblest of all the creatures of God on the very day of thy Annunciation, when God Himself exalted thee to the most sublime dignity of his own Mother. O mighty Virgin, enable me, wretched sinner that I am, to know the depths of my own nothingness, and at once with all my heart to humble myself before all men. Ave Maria.\n\nMary, most holy Virgin, when thou wast saluted by Gabriel the Archangel, and the message from God was conveyed to thee, and thou wast exalted by God above all the Choirs of the Angels, then thou didst humbly say, "Behold the handmaid of the Lord." Oh, obtain for me true humility and angelic purity, enabling me so to live on earth that I may ever be worthy of the blessing of God. Ave Maria.\n\nO Virgin ever blessed, I rejoice with thee because solely by thy humble Fiat thou didst draw from the bosom of the Eternal Father the divine Word into thy own pure bosom. Draw then ever my heart to God; and with God draw grace into my heart, that I may ever bless thy Fiat, and cry with devotion, "O mighty Fiat! O efficacious Fiat! O Fiat to be venerated above all Fiats" (St Thomas of Villanova). Ave Maria.\n\nO Virgin Mary, on the day of thy Annunciation thou wast found by Gabriel the Archangel quick and ready to do God\'s will, when it pleased the most Holy Trinity to await thy consent in order to redeem the world. Enable me in every good and bad fortune to turn to God with resignation and say: Be it done unto me according to thy word. Ave Maria.\n\nMost holy Mary, I well understand that thy obedience made the union between thy God and thee more intimate than shall ever again be possible for any other creature: ("No creature could be in closer union with God." B. Albertus Magnus). I am confounded to see how sin has separated me from God. Help me then, kind Mother, truly to do penance for my sins, that thy own loving Jesus may yet once more live in me and I in Him. Ave Maria.\n\nMost holy Mary, thou wast troubled by reason of thy modesty, when Gabriel the Archangel stood before thee in thy house; but I, when I come before thee, am troubled because of my great pride; wherefore do thou in thy incomparable humility, "which brought forth God for men, reopened Paradise, and set the captive souls free from hell beneath" (S. Aug. Sermo de Sanct.), draw me, I pray thee, out of the deep pit of my sins, and enable me to save my soul. Ave Maria.\n\nMost holy Virgin, though I have an unhallowed tongue, I have the boldness to salute thee all hours of the day: "Hail, hail Mary, full of grace." I pray thee from my heart to replenish my soul with a little of that grace wherewith the Holy Spirit, when He overshadowed thee, filled thee to the full. Ave Maria.\n\nMost holy Mary, "The Lord is with thee"; I know by faith that the great God who has been ever with thee from thy Conception, is, by his Incarnation in thy purest womb, made still more closely one with thee; make it thy care, I pray thee, that I may ever be one in heart and soul with that same dear Lord Jesus, by means of his sanctifying grace. Ave Maria.\n\nMost holy Mary, "Blessed art thou amongst women"; pour out upon my heart and soul thy heavenly blessing, as thou thyself wast ever blessed of God among all women; for I have this sure hope, that if, my dear Mother, thou wilt bless me while I live, then when I die I shall be blessed of God in the everlasting glory of Heaven. Ave Maria.',
  "Then say the Litany, and then:\nV. The angel of the Lord declared unto Mary.\nR. And she conceived of the Holy Ghost.\nLet us pray.\nO God, who by the message of an angel didst will that the divine Word should take flesh of the Blessed Virgin Mary; grant unto us thy suppliants that we, who believe her to be truly the Mother of God, may be helped by her intercession with Thee.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

/** The Raccolta novena for the Purification, said the same on each of the nine days. */
const RACCOLTA_PURIFICATION_NOVENA_PRAYER = [
  RACCOLTA_COME_HOLY_GHOST,
  "Most holy Virgin, bright mirror of all virtues, the forty days after thy delivery were no sooner passed than thou, though the purest of all virgins, didst will to be presented in the Temple to be purified; oh, help us then to keep our hearts unstained by sin, that so we too may be made worthy one day to be presented to our God in Heaven. Ave Maria.\n\nVirgin most obedient, at thy presentation in the Temple, thou didst willingly offer the sacrifice customary among women; enable us so to follow thy example, that we may make ourselves a living sacrifice to God by practising every virtue. Ave Maria.\n\nVirgin most pure, thou didst despise the reproach of men, observing the precepts of the Law; ask for us grace always to keep our hearts pure, whatever the world may think of us. Ave Maria.\n\nVirgin most holy, by offering thy Son, the Divine Word, to his Eternal Father, thou didst make Heaven glad; present our poor hearts to God, that by his grace they may be kept free from mortal sin. Ave Maria.\n\nVirgin most humble, in consigning Jesus into the arms of the holy old man Simeon, thou didst fill his spirit full of heavenly joy; consign our hearts to God, that He may fill them full of his Holy Spirit. Ave Maria.\n\nVirgin most diligent, in ransoming thy Son Jesus according to the Law, thou didst co-operate in the salvation of the world; ransom our poor hearts from the slavery of sin, that they may be ever pure in the sight of God. Ave Maria.\n\nVirgin most clement, on hearing the prophecy of Simeon foretelling thy woes, thou didst at once resign thyself to the good pleasure of thy God; make us always resigned to the dispositions of his Providence, and enable us to bear all troubles with patience. Ave Maria.\n\nVirgin most compassionate, when thou didst fill the soul of Anna the prophetess with light, by means of thy Divine Son, thou didst make her magnify the mercies of God by recognizing Jesus as the Redeemer of the world; enrich our spirits too with heavenly grace, that we may joyfully reap in full measure the fruits of our Lord's Redemption. Ave Maria.\n\nVirgin most resigned, although thou didst feel thine own soul transfixed with sorrow, foreseeing all the bitter Passion of thy Son, yet knowing the grief of Joseph thy spouse for all thy sufferings, thou didst console him with holy words; pierce through and through our souls with true sorrow for our sins, that we may one day come to rejoice with thee in everlasting bliss, partakers of thy glory. Ave Maria.",
  "Then say the Litany, and then:\nV. Simeon received answer from the Holy Spirit.\nR. That he should not see death till he had seen the Christ of the Lord.\nLet us pray.\nAlmighty, everlasting God, we humbly pray thy Majesty that, as thine only begotten Son was presented in the Temple in the substance of our flesh, so Thou wouldst enable us to present ourselves before thee with clean hearts.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_1 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious Mary was at the moment of her death, because in life she was so well prepared to die; first by reason of her ardent longing to see her God and to be again united to her Son; and next, by the unapproachable merit of her consummate perfection. Then, reflecting how different we are from Mary in our practice of preparation for our death, let us say:\n\nMost holy Virgin, who in order to prepare thyself for a holy death, didst live in continual desire of the beatific vision; oh, take from us all vain desires for the frail things of earth. Ave Maria thrice.\n\nMost holy Virgin, who in order to prepare thyself for a holy death didst in life ever sigh to be united to thy Son Jesus; obtain for us fidelity to Jesus even unto death. Ave Maria thrice.\n\nMost holy Virgin, who, in preparation for a holy death, didst attain an unapproachable height of merit and of virtue; intercede for us that we may know that virtue and the grace of God alone will lead us to salvation. Ave Maria thrice.\n\nLet us now give praise to Mary, so prudent in preparing for death; and whilst we exalt her glory, we will unite with the nine Choirs of Angels, who, on her Assumption into Heaven, escorted her, praising her with the first Choir:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_2 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious Mary was at her death, in that, according to the teaching of holy writers, she was comforted not only by the apostles and saints, but also by her dear Son Jesus; and whilst we contemplate the unspeakable joy which filled her soul at this grace granted to her alone, let us entreat her for ourselves:\n\nGlorious Virgin, who for thy consolation didst merit to die in the blessed company of apostles and saints: obtain for us, that when we breathe forth our souls we may feel thy presence and that of our holy patrons, assisting us. Ave Maria thrice.\n\nGlorious Virgin, who at the moment of thy death wast comforted by the sight of thy dear Son Jesus: oh, pray for us, that at that awful moment we too may be comforted by receiving Jesus in the most holy Viaticum. Ave Maria thrice.\n\nGlorious Virgin, who didst surrender thy spirit into the arms of Jesus: assist us, that we also, in life and in death, may surrender our souls into the arms of Jesus, and that we may always desire that his most holy will be done. Ave Maria thrice.\n\nCome then, let us magnify the glory of Mary, assisted at her death by her Son Jesus and his apostles, and join in jubilee at her triumph, with the second Choir of the heavenly host:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_3 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious the holy Mary was in her death, because she died in a very ecstasy of the love of God; and desiring that we too may be strengthened by that holy fire of love, let us ask for her help.\n\nMary, most happy Virgin, who didst die of the vehemence of the love of God; make it thy care that in our hearts, as God wills, there be lit up this living fire of his love. Ave Maria thrice.\n\nMary, most happy Virgin, who dying of divine love didst teach us what our love of God ought to do; pray for us, that we may never abandon our God in life or death. Ave Maria thrice.\n\nMary, most happy Virgin, who in leaving this mortal life, by virtue of an ecstasy of love didst make known the fire which ever burnt in thy heart, obtain for us at least a spark of that same fire, to give us true sorrow for our sins. Ave Maria thrice.\n\nLet us with the third Choir of Angels now exalt the ineffable glory of Mary inflamed with the love of her God:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_4 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious Mary was in her dead body, because it was adorned with marvellous splendour and majesty, and spread around an odour of sanctity, which was the very fragrance of Paradise, and because innumerable miracles were wrought at the sight of it. Then, thinking on our own misery, let us pray:\n\nO Lady, most pure, who by reason of thy virginal purity didst merit the glory of being so bright and so majestic in thy body after death; obtain for us the strength to detach ourselves from every foul spirit of impurity. Ave Maria thrice.\n\nO Lady most pure, who by reason of thy rare virtue didst from thy dead body spread around the sweetness of Paradise; make it thy care that we may edify our neighbour by our life, and never more by our bad example become a stumbling-block to others. Ave Maria thrice.\n\nO Lady most pure, at the sight of whose holy body numberless bodily infirmities were cured; intercede for us, that by thy prayers all our spiritual ills may be healed. Ave Maria thrice.\n\nCome, let us rejoice in the glory given to the dead body of Mary, magnifying her with the fourth Choir of Angels:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_5 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious Mary was after death, since by the power of the Highest her body, raised again to life, forthwith acquired the four gifts of brightness, agility, subtlety and impassibility; and filled with consolation at the excellence of her glory, let us invoke her:\n\nO Lady exalted, who wast so gloriously raised to life again by thy God; help us so to live on earth, that we also may rise again like unto thee in the last judgment day. Ave Maria thrice.\n\nO Lady exalted, to whose risen body were given the gifts of brightness and subtlety, by reason of the bright example and humility of thy life on earth; pray for us, that all contemptuous affectation may be taken from us; that so our souls, being freed from all self-love, may be adorned with humility. Ave Maria thrice.\n\nO Lady exalted, whose risen body was glorified by the gifts of agility and impassibility, by reason of thy spiritual zeal and patience while on earth; obtain for us courage valiantly to mortify our bodies, and patiently to curb all our disordinate inclinations. Ave Maria thrice.\n\nThen let us render due praise to Mary, and magnify the glory which adorned her risen body; while, with the fifth Choir, we exalt her:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_6 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how gloriously Mary was taken up to Heaven, being escorted thither by many legions of the heavenly host and of blessed souls drawn by her merits out of Purgatory; and rejoicing in that majestic triumph, let us with all humility offer to her our supplications:\n\nGreat Queen, who wast assumed so royally into the Kingdom of eternal peace; obtain for us that all sordid, earthly thoughts be taken away from us, and our hearts be fixed upon the contemplation of the unchangeable happiness of Heaven. Ave Maria thrice.\n\nGreat Queen, who wast assumed to Heaven amidst a company of the Angelic Hierarchy; obtain for us strength to overcome the wiles of all our enemies, and that we may lend a docile ear to the counsels of that good angel who continually assists and governs us. Ave Maria thrice.\n\nGreat Queen, who wast assumed to Heaven most gloriously, in the company of souls drawn by thy merits out of Purgatory; free us from the slavery of sin, and make us worthy to praise thee for all eternity. Ave Maria thrice.\n\nLet us not cease to applaud the royal triumph of Mary; and uniting our homage with the sixth Choir of angels, let us honour the singular glory of her Assumption into Heaven:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_7 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious Mary is in Heaven, because she is enthroned there as Queen of the universe, and is ever receiving homage and veneration from countless hosts of angels and of saints; and assisting at her royal throne, let us implore her aid:\n\nSovereign Queen of the universe, who for thy incomparable merit art raised to such high glory in the heavens; in thy pity look upon our miseries, and rule us with the gentle sway of thy protection. Ave Maria thrice.\n\nSovereign Queen of the universe, who art ever receiving worship and homage from all the heavenly host; accept, we pray thee, these our invocations, offered with such reverence as befits thy dignity and greatness. Ave Maria thrice.\n\nSovereign Queen of the universe, by that glory which thou hast by reason of thy high place in Heaven; vouchsafe to take us into the number of thy servants, and obtain for us grace that with quick and ready will we may faithfully keep the precepts of God our Lord. Ave Maria thrice.\n\nLet us take part in the joy of the angels praising Mary, and rejoice with the seventh Choir, because we know that she is raised to the dignity of Queen of the universe.",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_8 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious Mary is in Heaven by reason of the royal crown wherewith her divine Son has crowned her, and for the full knowledge which she now has of the deep mysteries of God, past, present and to come; and full of veneration for the incomparable honour bestowed upon our Queen, let us have recourse to her and say:\n\nQueen unrivalled, who in Heaven above dost enjoy the high glory of being crowned by thy divine Son with a royal diadem; help us to share thy matchless virtues, and ask for us that, purified in heart, we may be made worthy to be crowned with thee in Paradise. Ave Maria thrice.\n\nQueen unrivalled, in the full knowledge granted thee of all things on earth; for thy own glory's sake obtain pardon for our past evil deeds, that we may never offend again by froward tongue or wanton thought. Ave Maria thrice.\n\nQueen unrivalled, whose desire it is to see men pure and clean of heart, that so they may be made worthy of thy God; obtain for us forgiveness of our sins, and help us, that all our looks, words and deeds may please his heavenly Majesty. Ave Maria thrice.\n\nLet us then purify our hearts, in order that we may be worthy to give praise to Mary; and to the glory she possesses in that bright crown which decks her royal brow, let us add humble tokens of our love, rejoicing in union with the eighth Choir:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

const RACCOLTA_ASSUMPTION_DAY_9 = [
  RACCOLTA_COME_HOLY_GHOST,
  "O Queen of all the virgin choir,\nEnthroned above the starry sky;\nWho with pure milk from thy own breast\nThy own Creator didst supply.\n\nWhat man hath lost in hapless Eve,\nThy sacred womb to man restores;\nThou to the sorrowing here beneath\nHast opened heaven's eternal doors.\n\nHail, O refulgent Hall of Light!\nHail, Gate sublime of Heaven's high King!\nThrough Thee redeemed to endless life,\nThy praise let all the nations sing.\n\nO Jesu, born of Virgin bright\nImmortal glory be to Thee;\nPraise to the Father infinite,\nAnd Holy Ghost eternally. Amen.",
  "Let us meditate how glorious Mary is in Heaven by reason of her patronage of man, and for the power she has to aid him with great watchfulness in all his necessities; wherefore with lively confidence in the patronage of the very Mother of our God, let us implore her aid.\n\nMary, our most powerful patroness, whose glory it is in Heaven to be the advocate of man; oh! take us from the hands of the enemy and place us in the arms of our God and Creator. Ave Maria thrice.\n\nMary, our most powerful patroness, who being in Heaven the advocate of men wouldst that all men should be saved; make it thy care that none of us succumb at the thought of our past relapses into sin. Ave Maria thrice.\n\nMary, our most powerful patroness, who to fulfil thy office dost love to be continually invoked by men; obtain for us such true devotion that we may ever call upon thee in life, and above all at the awful moment of our death. Ave Maria thrice.\n\nNow with all our hearts let us celebrate the glories of Mary; and consoled at having Mary for our advocate in Heaven, let us join in praising her with the ninth Choir of angels:",
  "Then say the Litany, and then:\nV. The Holy Mother of God is exalted.\nR. Into the heavenly kingdom above the Angel Choirs.\nLet us pray.\nWe beseech Thee, O Lord, to pardon the shortcomings of thy servants; that we who by our own works are not able to please Thee, may be saved by the intercession of the Mother of thy Son, our Lord Jesus Christ.",
  RACCOLTA_PRAYERS_FOR_POPE_AND_CHURCH,
].join("\n\n");

/**
 * Builds the nine days of a novena whose received form repeats the same
 * prayers on every day. The day-by-day distinction is the meditation subject,
 * which is editorial; the prayer is the received text, unaltered.
 */
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

export const novenaGroupThree: CuratedEntry[] = [
  {
    contentType: "NOVENA",
    slug: "novena-saint-george",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_GEORGE],
    payload: {
      slug: "novena-saint-george",
      title: "Novena to Saint George",
      summary:
        "A nine-day novena to St. George, soldier and martyr, the first of the Fourteen Holy Helpers. Each day the same received prayers are said, asking through his intercession that faith be kept from wavering and doubt, that temptations be overcome, and that the cross God sends be carried patiently to the end.",
      background:
        "St. George suffered martyrdom at or near Lydda, also called Diospolis, in Palestine, probably before the time of Constantine. The Catholic Encyclopedia of 1913, following the Bollandist Delehaye, holds that little more than this can be safely affirmed: his early Acts are full of marvels, and the dragon story is a later legend. His cult was nonetheless among the most widespread in East and West; he is the patron of England, and his feast falls on 23 April. He is counted first among the Fourteen Holy Helpers, the saints invoked together in German lands since the late Middle Ages. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "steadfast faith and courage under trial, through the intercession of St. George",
      days: repeatedPrayerDays(GEORGE_NOVENA_PRAYER, [
        {
          title: "Strength and Constancy",
          meditation:
            "The prayer begins by recalling what God gave St. George: not freedom from torment, but strength and constancy in it. Grace seldom removes the trial; it makes the soul equal to it.",
          intentionPrompt: "Where do I need constancy more than relief?",
        },
        {
          title: "Faith Kept from Wavering",
          meditation:
            "The first petition is that our faith be preserved from wavering and doubt. Faith more often weakens from neglect than from argument; the novena asks for a faith that is fed and therefore holds.",
          intentionPrompt: "What feeds my faith, and what has been starving it?",
        },
        {
          title: "A Sincere Heart, unto Death",
          meditation:
            "George is asked to help us serve God with a sincere heart faithfully unto death. Sincerity is the refusal to be divided — the same person before God as before others.",
          intentionPrompt: "Where is my service of God divided, or done for show?",
        },
        {
          title: "The Dragon of Pride, Falsehood and Deceit",
          meditation:
            "The invocation reads the old dragon story as a figure of the enemies George really fought: pride, falsehood and deceit. They are also the enemies most of us actually meet.",
          intentionPrompt: "Which of the three do I most need to fight this week?",
        },
        {
          title: "Nothing Could Part Him from Christ",
          meditation:
            "Neither pain nor torture, sword nor death could part him from the love of Christ — an echo of St. Paul's question in Romans 8. The martyr's courage was first of all love.",
          intentionPrompt: "What, in practice, most easily parts me from the love of Christ?",
        },
        {
          title: "Temptations That Surround Us",
          meditation:
            "The invocation is realistic: temptations surround us. George is asked not to take them away but to help us overcome them, which is the way grace ordinarily works.",
          intentionPrompt: "Which temptation do I meet most often, and do I plan for it?",
        },
        {
          title: "The Cross Placed upon Me",
          meditation:
            "The cross is not chosen; it is placed upon us. The prayer asks for patience to carry the cross we actually have, not the one we imagine we could bear better.",
          intentionPrompt: "What cross have I been refusing to accept as mine?",
        },
        {
          title: "Neither Distress nor Difficulties",
          meditation:
            "Hardship can draw a soul closer to Christ or drive it away. The prayer asks that distress and difficulty never be allowed to separate us from Him.",
          intentionPrompt: "Do I pray more, or less, when things go badly?",
        },
        {
          title: "The Crown Promised to Those Who Persevere",
          meditation:
            "The novena ends with the crown promised to those who persevere to the end. George, the valiant champion of the Faith, is asked to stand with us in the combat that remains.",
          intentionPrompt: "What will I keep doing after this novena ends?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-george",
      typicalStartDate: "14 April, ending on the eve of his feast, 23 April",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_GEORGE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-blaise",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_BLAISE],
    payload: {
      slug: "novena-saint-blaise",
      title: "Novena to Saint Blaise",
      summary:
        "A nine-day novena to St. Blaise (Blase), bishop and martyr, one of the Fourteen Holy Helpers, long invoked against ills of the throat. The received prayers ask deliverance from every evil of soul and body, and above all the grace of a sincere and confident confession.",
      background:
        "By the common witness of the martyrologies, St. Blaise was Bishop of Sebaste in Armenia and died a martyr early in the fourth century, most accounts placing his death under Licinius about 316; the Catholic Encyclopedia of 1913 treats the details of his Acts as legendary. Among them is the cure, while he was in prison, of a boy choking on a fishbone, from which comes his patronage of the throat and the blessing of throats given on his feast, 3 February in the Latin Church, with two candles held crossed. Hammer's invocation also calls him a physician of souls and asks his help for those who have concealed sins in confession. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "health of body and soul, and a good confession, through the intercession of St. Blaise",
      days: repeatedPrayerDays(BLASE_NOVENA_PRAYER, [
        {
          title: "Every Evil of Soul and Body",
          meditation:
            "The prayer asks deliverance from all evil of soul and body together. The Church has never divided the person: the same God who forgives also heals, and both may be asked for.",
          intentionPrompt: "What am I carrying in body or soul that I have not yet prayed about?",
        },
        {
          title: "Ills of the Throat",
          meditation:
            "St. Blaise's ancient patronage of the throat comes from the legend of the boy he saved from choking. Bring today anyone whose illness touches breath, voice or swallowing.",
          intentionPrompt: "Whose sickness will I name before God today?",
        },
        {
          title: "Patience and Resignation",
          meditation:
            "The invocation recalls that Blaise suffered many tortures with patience and resignation for the love of our Saviour. Patience is not passivity; it is love that refuses to be hurried out of fidelity.",
          intentionPrompt: "Where is impatience making me unfaithful?",
        },
        {
          title: "Able to Fulfil My Duties",
          meditation:
            "Health is asked for a purpose: so that I may always be able to fulfil my duties and do good works. A prayer for recovery is also a promise about how restored strength will be used.",
          intentionPrompt: "If I were well tomorrow, what good would I do with it?",
        },
        {
          title: "Physician of Souls",
          meditation:
            "Blaise is invoked as a special physician of souls. The deeper sickness the novena attends to is sin, and its remedy is the sacrament of Penance.",
          intentionPrompt: "When did I last make a careful confession?",
        },
        {
          title: "A Good Confession in Confident Hope",
          meditation:
            "The prayer asks for a good confession made in the confident hope of pardon. Contrition without hope turns to despair; hope without contrition turns to presumption.",
          intentionPrompt: "Do I go to confession expecting to be forgiven?",
        },
        {
          title: "For Those Who Concealed a Sin",
          meditation:
            "The invocation turns to others: those who have hidden a sin in confession and since received the sacraments unworthily. It asks for them the grace of a sincere accusation and full pardon.",
          intentionPrompt:
            "Is there someone whose return to the sacraments I can pray for by name?",
        },
        {
          title: "Worthy Lips",
          meditation:
            "The prayer ends by asking to praise God's name ever with worthy lips. The throat that is healed is meant for praise, and the tongue that confesses sin is meant also to bless.",
          intentionPrompt: "What do my words most need to stop saying, and start saying?",
        },
        {
          title: "Pardon, Grace and Remission",
          meditation:
            "On the last day the novena asks for the whole gift: pardon, the grace of God, and the remission of eternal punishment. Every healing in this life points to that one.",
          intentionPrompt: "What will I do this week to thank God for His mercy?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-blaise",
      associatedDevotionSlug: "blessing-of-throats-on-saint-blaise-day",
      typicalStartDate: "25 January, ending on the eve of his feast, 3 February",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_BLAISE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-erasmus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, MARTYROLOGY_2_JUNE],
    payload: {
      slug: "novena-saint-erasmus",
      title: "Novena to Saint Erasmus",
      summary:
        "A nine-day novena to St. Erasmus (Elmo), bishop and martyr, one of the Fourteen Holy Helpers. The received prayers ask through his intercession to learn the faith, practise its precepts, bear the trials of life bravely, and live and die in the Faith.",
      background:
        "St. Erasmus is venerated as a bishop and martyr of Campania; the Roman Martyrology commemorates him on 2 June, recording that he was scourged under Decius and again cruelly tortured at Mola (Formia) under Maximian, and was preserved by God for the strengthening of others in the faith. Hammer's legend, following the old Acts, makes him a bishop of Antioch who hid on Mount Lebanon during the persecution, was delivered from prison by an angel, and preached in many lands before dying in Italy. He was invoked against ills of the abdomen, and Hammer's lesson on his life recalls St. Augustine's saying that peace also has its martyrs. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "fidelity to the faith and courage in suffering, through the intercession of St. Erasmus",
      days: repeatedPrayerDays(ERASMUS_NOVENA_PRAYER, [
        {
          title: "A Dauntless Confessor",
          meditation:
            "The prayer names Erasmus God's dauntless bishop and martyr, who so valiantly confessed the Faith. Courage in confessing Christ is asked of every Christian, not only of bishops in persecution.",
          intentionPrompt: "Where am I silent about Christ when I should speak?",
        },
        {
          title: "Learning the Doctrine of the Faith",
          meditation:
            "The first petition is simply to learn the faith. One cannot love or defend what one has never troubled to know.",
          intentionPrompt: "What part of the Church's teaching have I never actually studied?",
        },
        {
          title: "Practising Its Precepts",
          meditation:
            "Knowledge is asked for the sake of practice: that we may practise the precepts of the faith we have learned. Doctrine that never reaches conduct has not yet been received.",
          intentionPrompt: "Which precept do I know well and keep badly?",
        },
        {
          title: "Made Worthy of Its Promises",
          meditation:
            "The prayer looks to the end: to be made worthy to attain the promises of the faith. Learning and practice are ordered to that inheritance.",
          intentionPrompt: "Do I think of heaven as a promise I am living toward?",
        },
        {
          title: "The Trials and Sufferings of Life",
          meditation:
            "The invocation recalls that Erasmus bore the trials and sufferings of life willingly and bravely. Willingness changes suffering from something endured into something offered.",
          intentionPrompt: "What suffering could I offer today instead of merely enduring it?",
        },
        {
          title: "Consoling Fellow-Sufferers",
          meditation:
            "By his charity he consoled many fellow-sufferers. Those who suffer are often the best comforters of others who suffer, because they do not offer easy words.",
          intentionPrompt: "Who near me is suffering, and have I visited or written to them?",
        },
        {
          title: "Remember Me in My Needs",
          meditation:
            "The invocation asks plainly: remember me in my needs, and intercede for me with God. There is nothing unworthy in asking the saints for help in ordinary troubles.",
          intentionPrompt: "What need will I name to St. Erasmus today?",
        },
        {
          title: "Peace Also Has Its Martyrs",
          meditation:
            "Hammer's lesson on Erasmus recalls St. Augustine's word that peace also has its martyrs: a long illness, the daily combat with the world and the flesh, fidelity kept up for years.",
          intentionPrompt: "What long, quiet fidelity is God asking of me?",
        },
        {
          title: "To Live and Die in the Faith",
          meditation:
            "The invocation ends by asking the grace to live and die in the Faith through which Erasmus obtained the crown of glory. Final perseverance is the gift that gathers all the others.",
          intentionPrompt: "What would I want to have been faithful in, if today were my last day?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "24 May, ending on the eve of his feast, 2 June",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, MARTYROLOGY_2_JUNE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-pantaleon",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_PANTALEON],
    payload: {
      slug: "novena-saint-pantaleon",
      title: "Novena to Saint Pantaleon",
      summary:
        "A nine-day novena to St. Pantaleon, physician and martyr, one of the Fourteen Holy Helpers and patron of physicians. The received prayers ask for charity shown in works of mercy, for health used in God's service, and for patience and a spirit of penance when sickness comes.",
      background:
        "St. Pantaleon died a martyr about 305. According to the legend summarised in the Catholic Encyclopedia of 1913, he was the son of a wealthy pagan of Nicomedia, was taught the faith by his Christian mother, studied medicine and became physician to the emperor, drifted from the faith, and was won back by the priest Hermolaus; denounced in the persecution of Diocletian, he healed a paralytic as proof that Christ is God and was put to death. His feast is kept on 27 July. Hammer names him the patron of physicians, and his novena prays both for the sick and for the charity of those who care for them. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "health, patience in sickness and charity toward the sick, through the intercession of St. Pantaleon",
      days: repeatedPrayerDays(PANTALEON_NOVENA_PRAYER, [
        {
          title: "A Physician Won Back to Christ",
          meditation:
            "By the legend Pantaleon had drifted from the faith of his childhood and was brought back by a priest's patient friendship. Many who pray this novena are praying for someone like him.",
          intentionPrompt:
            "Who do I know that has drifted from the faith, and how can I befriend them?",
        },
        {
          title: "Goods Given to the Poor",
          meditation:
            "The prayer recalls that he exercised charity by distributing his goods to the poor. Wealth in his hands became a work of mercy.",
          intentionPrompt: "What do I own that would do more good in someone else's hands?",
        },
        {
          title: "Works of Mercy",
          meditation:
            "The first petition is that we too show our charity by works of mercy. Visiting the sick is one of them, and among the easiest to put off.",
          intentionPrompt: "Which sick or housebound person could I visit this week?",
        },
        {
          title: "A Special Patron of the Sick",
          meditation:
            "God made Pantaleon a special patron of the sick. Name today those you know who are ill, and place them under his care.",
          intentionPrompt: "Whom will I name to St. Pantaleon today?",
        },
        {
          title: "Health Used Well",
          meditation:
            "The invocation asks for the grace to serve God in good health by cheerfully fulfilling the duties of one's state of life. Health is a loan to be spent, not a possession to be guarded.",
          intentionPrompt: "How am I spending the strength I have?",
        },
        {
          title: "When It Is God's Will That Illness Come",
          meditation:
            "The prayer does not pretend that every sickness will be lifted. If illness is God's will, it asks for the grace to bear it patiently.",
          intentionPrompt: "Can I pray for healing and for acceptance at the same time?",
        },
        {
          title: "Sickness in the Spirit of Penance",
          meditation:
            "The invocation asks to accept sickness in the spirit of penance. Suffering united to Christ's can make reparation for sin, our own and others'.",
          intentionPrompt: "What suffering could I offer today for someone else?",
        },
        {
          title: "For Doctors and Nurses",
          meditation:
            "As patron of physicians, Pantaleon is the natural intercessor for those who care for the sick. Pray for their skill, their patience and their faith.",
          intentionPrompt: "Which doctor, nurse or carer will I pray for by name?",
        },
        {
          title: "For the Salvation of the Soul",
          meditation:
            "The prayer ends by asking that sickness, if it comes, promote the soul's salvation. Bodily healing is a sign; the healing it points to is eternal.",
          intentionPrompt: "What has illness, mine or another's, already taught me about God?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "18 July, ending on the eve of his feast, 27 July",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_PANTALEON],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-vitus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_VITUS],
    payload: {
      slug: "novena-saint-vitus",
      title: "Novena to Saint Vitus",
      summary:
        "A nine-day novena to St. Vitus, the boy martyr, one of the Fourteen Holy Helpers and protector of the young. The received prayers ask for a true estimation of the soul redeemed by Christ's blood, fortitude in trials, and the grace to keep the robe of innocence unstained.",
      background:
        "Sts. Vitus, Modestus and Crescentia are recorded as martyrs under Diocletian, and their feast stands in the Roman Martyrology on 15 June. According to the legend summarised in the Catholic Encyclopedia of 1913, Vitus was a boy of seven, or in other versions twelve, the son of a pagan senator, who stood firm when his own father tried to make him apostatize, fled with his tutor Modestus, and was tortured with Modestus and his nurse Crescentia. Hammer records that he was invoked against epilepsy, and the prayer of his novena asks God to give him as guide and protector to Christian youth. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "purity, fortitude and the protection of the young, through the intercession of St. Vitus",
      days: repeatedPrayerDays(VITUS_NOVENA_PRAYER, [
        {
          title: "The Value of a Soul",
          meditation:
            "The prayer opens with an unusual petition: a due estimation of the value of our soul. Most sins come from valuing something else more than the soul God made.",
          intentionPrompt: "What am I treating as worth more than my soul?",
        },
        {
          title: "Redeemed by the Precious Blood",
          meditation:
            "The soul's value is measured by its price: the precious blood of the Son of God. No one for whom Christ died is cheap.",
          intentionPrompt: "Whom have I been treating as if Christ had not died for them?",
        },
        {
          title: "Fortitude in All Trials",
          meditation:
            "Knowing the soul's worth is what makes fortitude possible. We bear trials for its salvation because we know what is at stake.",
          intentionPrompt: "What trial am I facing that I need courage for?",
        },
        {
          title: "Guide and Protector of the Young",
          meditation:
            "The prayer asks God to give Vitus as guide and protector to Christian youths. Pray today for the young people in your family, parish and town.",
          intentionPrompt: "Which young person will I pray for by name?",
        },
        {
          title: "Temptation in Youth",
          meditation:
            "The invocation recalls that in his youth Vitus was exposed to violent and dangerous temptations and overcame them. Youth is not too young for holiness.",
          intentionPrompt: "What can I do to make the path of virtue easier for a young person?",
        },
        {
          title: "The Fear of God and the Love of Jesus",
          meditation:
            "He overcame temptation in the fear of God and for the love of Jesus. Holy fear guards the soul; love gives it a reason to want guarding.",
          intentionPrompt: "Is my resistance to sin moved more by fear or by love?",
        },
        {
          title: "Every Occasion of Sin",
          meditation:
            "The invocation asks help to avoid every occasion of sin. The battle is usually won or lost before the temptation itself, in what we allow near us.",
          intentionPrompt: "What occasion of sin could I remove from my life this week?",
        },
        {
          title: "The Robe of Innocence",
          meditation:
            "It asks to keep spotless the robe of innocence and sanctifying grace given in Baptism, and to bring it unstained to the judgment-seat of Christ.",
          intentionPrompt: "If I have stained that robe, when will I go to confession?",
        },
        {
          title: "Blessed Are the Pure of Heart",
          meditation:
            "The novena ends with the promise of the beatitude: the pure of heart shall see God. Purity is not a lack but a clarity of sight.",
          intentionPrompt: "What would it mean for my heart to be undivided?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-vitus",
      typicalStartDate: "6 June, ending on the eve of his feast, 15 June",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_VITUS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-christopher",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_CHRISTOPHER],
    payload: {
      slug: "novena-saint-christopher",
      title: "Novena to Saint Christopher",
      summary:
        "A nine-day novena to St. Christopher, martyr, the Christ-bearer, one of the Fourteen Holy Helpers. The received prayers ask protection from sin, the only real evil, and from earthquake, lightning, fire and flood, and the grace to bear Christ always in the heart as he once bore Him on his shoulder.",
      background:
        "St. Christopher was a martyr, probably of the third century; his feast is kept on 25 July in the Latin Church. The Catholic Encyclopedia of 1913 recounts his famous legend: a man of great stature who resolved to serve only the mightiest master, and who, while carrying travellers across a raging stream for God's sake, bore a child who grew so heavy that it seemed he carried the whole world — Christ Himself, from whom he took the name Christ-bearer. Hammer records that he was invoked against the plague and against a sudden and unprovided death. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "protection from sin and from danger, and the grace to carry Christ in the heart, through the intercession of St. Christopher",
      days: repeatedPrayerDays(CHRISTOPHER_NOVENA_PRAYER, [
        {
          title: "A True Christ-Bearer",
          meditation:
            "The prayer begins with his name: God made Christopher a true Christ-bearer. Every baptized person is meant to carry Christ into places He would not otherwise go.",
          intentionPrompt: "Where will I carry Christ today?",
        },
        {
          title: "Seeking the Mightiest Master",
          meditation:
            "The legend tells of a man who would serve only the strongest master and found him at last in Jesus Christ. Our own service follows whomever we think strongest.",
          intentionPrompt: "Whom or what am I really serving with my best strength?",
        },
        {
          title: "Serving with All One's Power",
          meditation:
            "Having found his Master, he served Him faithfully with all his power to the end of his life. Half-hearted service is not what conversion asks.",
          intentionPrompt: "What part of my strength am I holding back from God?",
        },
        {
          title: "Christ Carried in the Heart",
          meditation:
            "The invocation asks the grace to bear Christ always in the heart, as Christopher once bore Him on his shoulder. Interior prayer is how Christ is carried through an ordinary day.",
          intentionPrompt: "How often today did I remember that Christ was with me?",
        },
        {
          title: "Sin, the Only Real Evil",
          meditation:
            "The prayer calls sin the only real evil. Every other loss can be turned to good; sin alone separates us from God.",
          intentionPrompt: "Am I more afraid of misfortune than of sin?",
        },
        {
          title: "Earthquake, Lightning, Fire and Flood",
          meditation:
            "It asks protection also against the harmful forces of nature. Pray today for any place struck by disaster, and for those who rescue and rebuild.",
          intentionPrompt: "What disaster-stricken people will I remember before God?",
        },
        {
          title: "Travellers on the Road",
          meditation:
            "Christopher carried travellers across dangerous water, and Christians have long asked his protection on journeys. Every journey, too, is a small image of the pilgrimage of life.",
          intentionPrompt: "Where am I going, in this life, and am I going there with God?",
        },
        {
          title: "The World, the Devil and the Flesh",
          meditation:
            "The invocation asks strength to overcome all temptations and resist the enticements of the world, the devil and the flesh — the three old enemies of the soul.",
          intentionPrompt: "Which of the three troubles me most at present?",
        },
        {
          title: "The Powers of Darkness Shall Not Prevail",
          meditation:
            "The novena closes asking that the powers of darkness may not prevail against us. The one who carries Christ does not carry Him alone; Christ carries him.",
          intentionPrompt: "What fear will I hand over to Christ today?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-christopher",
      typicalStartDate: "16 July, ending on the eve of his feast, 25 July",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_CHRISTOPHER],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-denis",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_DENIS],
    payload: {
      slug: "novena-saint-denis",
      title: "Novena to Saint Denis (Dionysius)",
      summary:
        "A nine-day novena to St. Denis (Dionysius), first Bishop of Paris and martyr, one of the Fourteen Holy Helpers. The received prayers ask that the faith he preached be a light on the way, that the soul be freed from anxieties of conscience, and that it grow continually in the knowledge and love of Jesus.",
      background:
        "St. Denis was sent to Gaul about the middle of the third century, in the time of Pope Fabian, and with his companions the priest Rusticus and the deacon Eleutherius founded the Church at Paris, where he died by the sword; his feast is kept on 9 October. The Catholic Encyclopedia of 1913 explains that he was later confused with Dionysius the Areopagite, St. Paul's convert at Athens, an error that took deep root through the Areopagitica of Abbot Hilduin in 836; Hammer's invocation, which speaks of his learning to know Christ through St. Paul, follows that old identification. Hammer records that he was invoked against headache. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "peace of conscience and growth in the knowledge and love of Jesus, through the intercession of St. Denis",
      days: repeatedPrayerDays(DENIS_NOVENA_PRAYER, [
        {
          title: "Apostle of a People",
          meditation:
            "The prayer thanks God for conferring His saving faith on the people of France through Denis. Nations receive the faith through particular men and women; pray today for those who first brought it to your own land.",
          intentionPrompt: "Who first handed on the faith to my family?",
        },
        {
          title: "The Faith as Light on the Way",
          meditation:
            "It asks that the faith Denis practised and preached be our light on the way of life. Faith is not only a set of truths but a lamp for decisions.",
          intentionPrompt: "What decision before me needs the light of faith?",
        },
        {
          title: "Anxieties of Conscience",
          meditation:
            "The prayer asks to be preserved from all anxieties of conscience. Scruples and needless dread are not humility; they can keep a soul from trusting God's mercy.",
          intentionPrompt: "Is there a fear about my soul I should bring to a confessor?",
        },
        {
          title: "Return Speedily by Penance",
          meditation:
            "If by human frailty we have sinned, the prayer asks that we return speedily by true penance. Delay is the danger; the longer a sin is left, the more at home it becomes.",
          intentionPrompt: "What have I been putting off confessing?",
        },
        {
          title: "Growth in the Knowledge of Jesus",
          meditation:
            "The invocation asks for a continual growth in the knowledge of Jesus. The Gospels are the ordinary place where He is known.",
          intentionPrompt: "Will I read one Gospel chapter each day for the rest of this novena?",
        },
        {
          title: "Growth in the Love of Jesus",
          meditation:
            "Knowledge is asked for the sake of love. Denis devoted himself to Christ with intense love; the novena asks that ours grow as well.",
          intentionPrompt: "What act of love for Christ can I make today?",
        },
        {
          title: "The Restless Heart",
          meditation:
            "The invocation asks that my restless heart may experience the peace which He alone can give — the same restlessness St. Augustine named as the heart's longing for God.",
          intentionPrompt: "What am I trying to rest in that is not God?",
        },
        {
          title: "A Willing Heart",
          meditation:
            "It asks the grace to serve God with a willing heart and abiding love. Service grudgingly given is still service, but God desires the gift of the will.",
          intentionPrompt: "What duty could I do today without complaint?",
        },
        {
          title: "The Bliss of Heaven",
          meditation:
            "The novena ends looking to the eternal bliss Denis won by his martyrdom. The headless martyr of the old images carries his head in his hands: death did not have the last word.",
          intentionPrompt: "What hope will I carry out of this novena?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "30 September, ending on the eve of his feast, 9 October",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_DENIS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-cyriacus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, MARTYROLOGY_8_AUGUST],
    payload: {
      slug: "novena-saint-cyriacus",
      title: "Novena to Saint Cyriacus",
      summary:
        "A nine-day novena to St. Cyriacus, deacon and martyr of Rome, one of the Fourteen Holy Helpers, invoked against the assaults of the devil. The received prayers ask for heroic, self-denying charity, trustful resignation to God's will, and victory over the enemy in life and in death.",
      background:
        "St. Cyriacus was a deacon of the Roman Church martyred with Largus and Smaragdus in the persecution of Diocletian and Maximian; the Roman Martyrology records that they suffered on 16 March and that their bodies were translated on 8 August, the day on which their feast has been kept. Hammer's legend tells how he served the Christian prisoners forced to labour on the Baths of Diocletian, once taking the place of an old man too weak to work, and how he delivered the emperor's daughter from an evil spirit. Hammer records that he was invoked in temptations, especially at the hour of death. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "charity, resignation to God's will and victory over temptation, through the intercession of St. Cyriacus",
      days: repeatedPrayerDays(CYRIACUS_NOVENA_PRAYER, [
        {
          title: "A Deacon of Rome",
          meditation:
            "Cyriacus was a deacon, ordained to serve the poor and the prisoner in the name of the Church. The diaconate began as charity made official.",
          intentionPrompt: "Which person in need is the Church, through me, meant to serve?",
        },
        {
          title: "Another's Burden",
          meditation:
            "By his legend he took the place of an old prisoner too weak for his labour. Carrying another's load is the plainest form of Christian love.",
          intentionPrompt: "Whose burden could I lift, even a little, this week?",
        },
        {
          title: "Heroic Charity",
          meditation:
            "The prayer thanks God for the grace of heroic charity given to Cyriacus. Heroism in charity usually begins with small kindnesses done when they cost something.",
          intentionPrompt: "What kindness would cost me something today?",
        },
        {
          title: "Charity That Denies Itself",
          meditation:
            "It asks that we walk before God in self-denying charity. Love that never denies itself has not yet been tested.",
          intentionPrompt: "What preference could I give up for someone else's good?",
        },
        {
          title: "Trustful Resignation",
          meditation:
            "Cyriacus is remembered for trustful resignation to God's holy will. Resignation is not giving up; it is giving over.",
          intentionPrompt: "What outcome am I still trying to control?",
        },
        {
          title: "To Know and Fulfil God's Will",
          meditation:
            "The prayer asks to know and fulfil God's will in all things. The knowing is often easier than the fulfilling.",
          intentionPrompt: "What do I already know God wants that I have not done?",
        },
        {
          title: "Power over the Enemy",
          meditation:
            "The invocation recalls that God gave Cyriacus power over Satan and to deliver the oppressed from his tyranny. The devil is real, and he is not the equal of God.",
          intentionPrompt: "Do I take spiritual combat seriously enough to pray against it?",
        },
        {
          title: "Deliver Me from His Influence",
          meditation:
            "It asks Cyriacus to deliver me from the enemy's influence when he tries to tempt me, and to help me repel his assaults. The ordinary weapons are prayer, the sacraments and humility.",
          intentionPrompt: "Which of those three have I neglected?",
        },
        {
          title: "Victory in Life and in Death",
          meditation:
            "The novena ends asking victory over the enemy in life and in death. Hammer notes that Cyriacus was invoked especially in temptations at the hour of death; pray today for the dying.",
          intentionPrompt: "Whom do I know who is near death, and have I prayed for them?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "30 July, ending on the eve of his feast, 8 August",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, MARTYROLOGY_8_AUGUST],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-achatius",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, MARTYROLOGY_8_MAY],
    payload: {
      slug: "novena-saint-achatius",
      title: "Novena to Saint Achatius (Acacius)",
      summary:
        "A nine-day novena to St. Achatius (Acacius), soldier and martyr, one of the Fourteen Holy Helpers and advocate of the dying. The received prayers ask for constancy and trustful reliance on God, victory over the world, the flesh and the devil, and help in the last agony.",
      background:
        "The Achatius counted among the Holy Helpers is the centurion commemorated in the Roman Martyrology on 8 May: denounced as a Christian in the persecution of Diocletian and Maximian, he was cruelly tortured at Perinthus and condemned to death at Byzantium by the proconsul. Hammer's legend makes him a native of Cappadocia and records that he was invoked in the agony of death; both the prayer and the invocation of his novena are prayers for a holy death. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "constancy in faith and a holy death, through the intercession of St. Achatius",
      days: repeatedPrayerDays(ACHATIUS_NOVENA_PRAYER, [
        {
          title: "A Soldier's Confession",
          meditation:
            "Achatius was a soldier who confessed Christ at the cost of his career and his life. Every state of life has its own way of being faithful under pressure.",
          intentionPrompt: "Where does my work or position tempt me to keep my faith quiet?",
        },
        {
          title: "Before Kings and Judges",
          meditation:
            "The invocation recalls that he preached Christ faithfully before kings and judges. Christ promised that His witnesses would be given what to say.",
          intentionPrompt: "Before whom am I most afraid to be known as a Christian?",
        },
        {
          title: "The World and Its Allurements",
          meditation:
            "The first enemy named is the world and its allurements — not creation, which is good, but the habit of living as if this world were all there is.",
          intentionPrompt: "What allurement of the world has the strongest hold on me?",
        },
        {
          title: "The Concupiscence of the Flesh",
          meditation:
            "The second is the concupiscence of the flesh, the disordered desire that remains even after Baptism. It is fought by vigilance, prayer and the sacraments.",
          intentionPrompt: "Where do I need more vigilance?",
        },
        {
          title: "The Temptations of Satan",
          meditation:
            "The third is the temptation of the evil one. Achatius gained the victory over the enemies of God; the novena asks a share in that victory.",
          intentionPrompt: "What temptation keeps returning, and have I asked for help against it?",
        },
        {
          title: "Trustful Reliance on God",
          meditation:
            "The prayer recalls that God fortified Achatius with constancy and trustful reliance on Him in death. Trust learned in life is what remains at the end.",
          intentionPrompt: "Where am I relying on myself instead of on God?",
        },
        {
          title: "Free from All Anxiety",
          meditation:
            "It asks that at the hour of our death we be free from all anxiety. Fear of death is natural; the remedy is not denial but hope.",
          intentionPrompt: "What do I fear most about dying, and have I told God?",
        },
        {
          title: "Help in the Agony",
          meditation:
            "The invocation asks Achatius to assist us in our agony, when the powers of hell rise against the soul. Pray today for all who are dying, especially those who will die alone.",
          intentionPrompt: "Who will I pray for among the dying today?",
        },
        {
          title: "Into the Hands of the Redeemer",
          meditation:
            "The novena ends with the last act of a Christian life: to surrender the soul into the hands of the Redeemer in faith, hope and charity, confiding in His infinite merits.",
          intentionPrompt: "Can I make that surrender now, in a small way, today?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "29 April, ending on the eve of his feast, 8 May",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, MARTYROLOGY_8_MAY],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-eustace",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_EUSTACHIUS],
    payload: {
      slug: "novena-saint-eustace",
      title: "Novena to Saint Eustace (Eustachius)",
      summary:
        "A nine-day novena to St. Eustace (Eustachius), martyr, one of the Fourteen Holy Helpers, long invoked in difficulties and family troubles. The received prayers ask for perseverance in God's love amid the trials of life and for patient resignation in poverty and loss.",
      background:
        "Sts. Eustachius and Companions are honoured as martyrs under the Emperor Hadrian; their feast is kept in the West on 20 September. The Catholic Encyclopedia of 1913 relates the legend: Placidus, a Roman general under Trajan, saw a stag bearing a crucifix between its horns, and was baptized with his wife and two sons; through adverse fortune the family was scattered, later reunited, and at last put to death together. The Encyclopedia judges the Acts fabulous, but notes that his veneration is very old in both the Greek and Latin Churches. Hammer records that he was invoked in all kinds of difficulties and, because he was for a time parted from his wife and children, in family troubles. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "patience and trust in God's providence in trials and family troubles, through the intercession of St. Eustace",
      days: repeatedPrayerDays(EUSTACE_NOVENA_PRAYER, [
        {
          title: "The Stag and the Cross",
          meditation:
            "The legend of Eustace begins with a hunt in which the hunter is found: Christ met him through the image of a stag bearing the cross. God still finds people in the middle of their ordinary pursuits.",
          intentionPrompt: "Where has God unexpectedly met me?",
        },
        {
          title: "Cast Down from Glory",
          meditation:
            "The invocation recalls that Eustace was cast from the height of earthly glory and power into the deepest misery. Few trials are harder than a sudden fall in fortune.",
          intentionPrompt: "What security am I relying on that could be taken away?",
        },
        {
          title: "The Bread of Destitution",
          meditation:
            "He laboured for a long time as a menial servant, eating the bitter bread of destitution. Pray today for those who have lost their work or their home.",
          intentionPrompt: "Whom do I know who is struggling to make a living?",
        },
        {
          title: "Never Murmuring",
          meditation:
            "Through all of it, the invocation says, he never murmured against God's severe probation. Complaint is not always sinful, but murmuring against God closes the heart.",
          intentionPrompt: "What have I been murmuring about?",
        },
        {
          title: "Families Parted and Restored",
          meditation:
            "Eustace was separated for years from his wife and sons before they were found again. Bring before God any family that is divided or estranged.",
          intentionPrompt: "Which family, perhaps my own, needs reconciliation?",
        },
        {
          title: "Poverty Borne with Patience",
          meditation:
            "The invocation asks particularly the grace to bear poverty and its consequences with patience, trusting in God's providence.",
          intentionPrompt: "Do I trust God with my finances, or only with my soul?",
        },
        {
          title: "He Who Humbles and Exalts",
          meditation:
            "It names God as He who humbles and exalts, chastises and heals, sends trials and consolations. Both halves come from the same Father's hand.",
          intentionPrompt: "Can I see God's hand in the hard things as well as the good?",
        },
        {
          title: "Perseverance in God's Love",
          meditation:
            "The prayer asks that we persevere in God's love amid the trials of this life. Trials do not end love; they reveal whether it was real.",
          intentionPrompt: "What trial is testing my love for God now?",
        },
        {
          title: "Out of Darkness into Light",
          meditation:
            "The novena ends asking to come forth from the darkness of this earth into the light of God's eternal glory. Every restoration in this life foreshadows that one.",
          intentionPrompt: "What darkness am I asking God to bring me out of?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "11 September, ending on the eve of his feast, 20 September",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_EUSTACHIUS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-giles",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_GILES],
    payload: {
      slug: "novena-saint-giles",
      title: "Novena to Saint Giles",
      summary:
        "A nine-day novena to St. Giles, hermit and abbot, one of the Fourteen Holy Helpers, invoked for the grace of a good confession. The received prayers ask to flee the vanity and praise of the world, to know one's sins truly, to confess them humbly and contritely, and to find God gracious at the judgment.",
      background:
        "St. Giles was a hermit who withdrew to a dense forest near Nîmes in Provence, his only companion a hind, until the king's hunters discovered his retreat; a monastery grew up around him, and he died in the early eighth century with a great reputation for holiness and miracles. His shrine became one of the great pilgrimages of medieval Europe, and his feast is kept on 1 September. Hammer records that he was invoked against the plague and for the grace of making a good confession, and the invocation of his novena is in effect a prayer of preparation for confession. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "humility, a good confession and peace of conscience, through the intercession of St. Giles",
      days: repeatedPrayerDays(GILES_NOVENA_PRAYER, [
        {
          title: "The Hermit of the Forest",
          meditation:
            "Giles fled to the forest to be alone with God, and the world came looking for him. Solitude sought for God's sake often becomes a gift to others.",
          intentionPrompt: "Where can I find a little silence with God today?",
        },
        {
          title: "Meek and Humble of Heart",
          meditation:
            "The invocation recalls that from his youth Giles took to heart the words, Learn of Me, because I am meek and humble of heart. Humility is learned from Christ, not invented.",
          intentionPrompt: "Where does my pride show itself most readily?",
        },
        {
          title: "Fleeing Praise and Honour",
          meditation:
            "He fled the praise and honours of the world, and the prayer asks the same grace for us. Praise is not evil, but the craving for it quietly rules a life.",
          intentionPrompt: "Whose approval do I most crave?",
        },
        {
          title: "Pride, Self-Confidence and Negligence",
          meditation:
            "The invocation confesses that I have sinned through pride, self-confidence and negligence. Naming the roots of sin is the beginning of uprooting them.",
          intentionPrompt: "Which of these three is the root of my most frequent sins?",
        },
        {
          title: "Light to Know One's Sins",
          meditation:
            "It asks to be enlightened by the Holy Ghost to know the malice, grievousness and multitude of one's sins. A good examination of conscience is itself a grace to be prayed for.",
          intentionPrompt: "Will I make a careful examination of conscience tonight?",
        },
        {
          title: "A Humble, Full and Contrite Confession",
          meditation:
            "The prayer asks to confess our sins humbly, fully and contritely. These three marks of a good confession are what Giles is invoked to obtain.",
          intentionPrompt: "When will I go to confession?",
        },
        {
          title: "Peace of Conscience",
          meditation:
            "The fruit asked for is pardon, tranquillity of heart and peace of conscience from God. That peace is real, and it is given in the sacrament.",
          intentionPrompt: "What would it mean for me to be at peace with God?",
        },
        {
          title: "Rich in Good Works",
          meditation:
            "The prayer asks to leave this world in God's love and rich in good works. Faith is shown in what it leaves behind.",
          intentionPrompt: "What good work have I been meaning to begin?",
        },
        {
          title: "A Gracious Judge",
          meditation:
            "The novena ends asking to find God gracious on the day of judgment. Those who have often met His mercy in confession will know the face of their Judge.",
          intentionPrompt: "Do I think of the judgment with fear, with hope, or not at all?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-giles",
      typicalStartDate: "23 August, ending on the eve of his feast, 1 September",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_GILES],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-margaret-of-antioch",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_MARGARET],
    payload: {
      slug: "novena-saint-margaret-of-antioch",
      title: "Novena to Saint Margaret of Antioch",
      summary:
        "A nine-day novena to St. Margaret of Antioch, virgin and martyr, one of the Fourteen Holy Helpers. The received prayers ask for courage in confessing the faith, chastity according to one's state of life, perseverance in prayer, distrust of self and flight from the occasions of sin.",
      background:
        "St. Margaret, called Marina in the East, was a virgin and martyr of Pisidian Antioch in Asia Minor. According to the legend recorded in the Catholic Encyclopedia of 1913, she was the daughter of a pagan priest, was raised by a Christian nurse, refused the advances of the prefect who sought to marry her, and after many torments was put to death; she is often shown in art leading a chained dragon. The Latin Church honours her on 20 July, the Greek on 13 July. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "courage in confessing the faith and purity of heart, through the intercession of St. Margaret",
      days: repeatedPrayerDays(MARGARET_NOVENA_PRAYER, [
        {
          title: "Undaunted Confession",
          meditation:
            "The prayer asks to confess the faith undauntedly, as Margaret did before her judge. Fear of ridicule silences more Christians than fear of death.",
          intentionPrompt: "When did I last let fear keep me silent about my faith?",
        },
        {
          title: "Chastity According to One's State",
          meditation:
            "It asks to observe carefully the chastity of our state of life. Chastity is asked of the married, the single and the consecrated alike, each in a different form.",
          intentionPrompt: "What does chastity ask of me in my present state of life?",
        },
        {
          title: "The Robe of Innocence",
          meditation:
            "The invocation recalls that Margaret faithfully preserved the robe of holy innocence and purity. Grace can restore what has been lost; it can also guard what remains.",
          intentionPrompt: "What do I need to guard more carefully?",
        },
        {
          title: "Blandishments of the World",
          meditation:
            "She resisted all the blandishments and allurements of the world for love of her divine Spouse. The world's flattery is often harder to resist than its threats.",
          intentionPrompt: "What flattery or attraction is drawing me away from Christ?",
        },
        {
          title: "Steadfast in the Love of Christ",
          meditation:
            "The invocation asks to remain steadfast in the love of Christ in order to preserve His great gift. Purity is kept by love more than by fear.",
          intentionPrompt: "How can I grow in love for Christ this week?",
        },
        {
          title: "Perseverance in Prayer",
          meditation:
            "It asks for perseverance in prayer, the first defence of every virtue. Prayer abandoned is a wall left unguarded.",
          intentionPrompt: "Have I kept a fixed time of prayer every day?",
        },
        {
          title: "Distrust of Myself",
          meditation:
            "It asks for distrust of myself: not anxiety, but the humility that knows its weakness and therefore leans on God.",
          intentionPrompt: "Where am I overconfident in my own strength?",
        },
        {
          title: "Flight from the Occasions of Sin",
          meditation:
            "It asks for flight from the occasions of sin. The saints won this battle chiefly by not going where they knew they would fall.",
          intentionPrompt: "What place, company or habit should I flee?",
        },
        {
          title: "Following the Lamb",
          meditation:
            "The novena ends with the grace of a good death and the hope to follow the Lamb whithersoever He goeth, as the Apocalypse says of the pure.",
          intentionPrompt: "What would it mean to follow Christ wherever He leads me now?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-margaret-of-antioch",
      typicalStartDate: "11 July, ending on the eve of her feast, 20 July",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_MARGARET],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-catherine-of-alexandria",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_CATHERINE],
    payload: {
      slug: "novena-saint-catherine-of-alexandria",
      title: "Novena to Saint Catherine of Alexandria",
      summary:
        "A nine-day novena to St. Catherine of Alexandria, virgin and martyr, one of the Fourteen Holy Helpers and patroness of scholars. The received prayers ask for constancy in the faith, the wisdom of the saints, purity, and victory in the last combat.",
      background:
        "St. Catherine is a virgin and martyr of Alexandria whose feast is kept on 25 November, and for centuries she was among the most popular saints of East and West. According to the legend recounted in the Catholic Encyclopedia of 1913, she confounded the philosophers sent by the emperor Maximinus to dispute with her and converted many of them; condemned to die on the wheel, which broke at her touch, she was beheaded, and angels were said to have carried her body to Mount Sinai, where a church and monastery were later built in her honour. Hammer records that she was invoked against ills of the tongue and against a sudden death. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "wisdom, constancy in the faith and purity, through the intercession of St. Catherine",
      days: repeatedPrayerDays(CATHERINE_NOVENA_PRAYER, [
        {
          title: "Wisdom and Virtue Together",
          meditation:
            "The prayer recalls that God distinguished Catherine by the gift of great wisdom and virtue. Learning without virtue puffs up; virtue without learning can be easily misled.",
          intentionPrompt: "Is my mind growing along with my soul?",
        },
        {
          title: "The Adversaries of Truth",
          meditation:
            "By her legend her wisdom refuted the adversaries of divine truth. Truth is best defended by those who know it well and speak it with charity.",
          intentionPrompt: "How well could I explain my faith to someone who doubts it?",
        },
        {
          title: "Constancy in the Faith",
          meditation:
            "The first petition is for constancy in the Faith. Catherine's learning did not make her faith complicated; it made it unshakeable.",
          intentionPrompt: "What question about my faith have I been avoiding?",
        },
        {
          title: "The Wisdom of the Saints",
          meditation:
            "The prayer asks for the wisdom of the saints, which is not the same as cleverness. It is knowing how to live for God.",
          intentionPrompt: "Which saint's practical wisdom do I most need?",
        },
        {
          title: "Mind and Heart in God's Service",
          meditation:
            "It asks that we devote all the powers of our mind and heart to God's service. Pray today for students, teachers and scholars.",
          intentionPrompt: "How can my work or study be offered to God?",
        },
        {
          title: "The Science of the Saints",
          meditation:
            "The invocation asks for progress in the science of the saints — the knowledge of God that comes through prayer as much as through study.",
          intentionPrompt: "Do I pray as seriously as I read?",
        },
        {
          title: "Purity of Heart",
          meditation:
            "It asks also for the virtue of holy purity, which the invocation calls her immaculate purity, by which she became a spouse of Christ.",
          intentionPrompt: "What would purity of heart change in how I see others?",
        },
        {
          title: "Victory in the Last Combat",
          meditation:
            "It asks to vanquish the enemies of the soul and be victorious in the last combat. Hammer notes that she was invoked against a sudden death.",
          intentionPrompt: "Am I ready to die today?",
        },
        {
          title: "Carried by Angels",
          meditation:
            "The novena ends with the legend of her body carried by angels to Mount Sinai, and asks that after death we be conducted by the angels into eternal beatitude.",
          intentionPrompt: "Do I pray to my guardian angel for the hour of death?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-catherine-of-alexandria",
      typicalStartDate: "16 November, ending on the eve of her feast, 25 November",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_CATHERINE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-barbara",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_BARBARA],
    payload: {
      slug: "novena-saint-barbara",
      title: "Novena to Saint Barbara",
      summary:
        "A nine-day novena to St. Barbara, virgin and martyr, one of the Fourteen Holy Helpers and patroness of the dying. The received prayers ask for fortitude in confessing the faith, preservation from a sudden and unprovided death, and the grace to receive the sacraments before the end.",
      background:
        "St. Barbara is a virgin and martyr whose feast the Latin Church keeps on 4 December. According to the legend recounted in the Catholic Encyclopedia of 1913, she was the daughter of a rich pagan, Dioscorus, who kept her shut up in a tower; when she became a Christian he denounced her, and after cruel tortures he himself carried out her sentence of death, and was struck by lightning on his way home. Hammer records that she was invoked against fever and against a sudden and unprovided death, and the litany of the Holy Helpers names her the mighty patroness of the dying. Her novena closes with a short rhyme asking her help to receive the sacrament at the last. The prayers are those of Bonaventure Hammer's manual of the Holy Helpers (New York: Benziger Brothers, 1909): a preparatory prayer common to all fourteen novenas, the prayer and invocation proper to the saint, and a common closing offering, said unchanged on each of the nine days. The day-by-day subjects below are editorial.",
      intentionTheme:
        "a holy death fortified by the sacraments, through the intercession of St. Barbara",
      days: repeatedPrayerDays(BARBARA_NOVENA_PRAYER, [
        {
          title: "Fortitude in Confessing the Faith",
          meditation:
            "The prayer recalls that God adorned Barbara with extraordinary fortitude in the confession of the Faith. Her persecutor was her own father; the hardest opposition often comes from home.",
          intentionPrompt:
            "Is there someone close to me who makes faith hard, and do I pray for them?",
        },
        {
          title: "Consolation in Torment",
          meditation:
            "God consoled her in the most atrocious torments. Consolation is not the absence of suffering but God's presence within it.",
          intentionPrompt: "Where have I felt God's consolation in a hard time?",
        },
        {
          title: "Perseverance in God's Law",
          meditation:
            "The first petition is perseverance in the fulfilment of God's law. The commandments are kept day by day, and so is perseverance.",
          intentionPrompt: "Which commandment do I find hardest to keep faithfully?",
        },
        {
          title: "A Sudden and Unprovided Death",
          meditation:
            "The invocation asks to be preserved from a sudden and unprovided death — not from death itself, but from meeting it unprepared.",
          intentionPrompt: "If I died suddenly today, would I be ready?",
        },
        {
          title: "The Last Sacraments",
          meditation:
            "Both prayers ask the grace to be fortified before the end with the holy sacraments. Make sure those you love know you want a priest called when the time comes.",
          intentionPrompt: "Have I told my family to call a priest for me?",
        },
        {
          title: "Patroness of the Dying",
          meditation:
            "The litany of the Holy Helpers calls Barbara the mighty patroness of the dying. Pray today for all who will die tonight, especially those without the sacraments.",
          intentionPrompt: "Whom do I know who is dying, and how can I help them prepare?",
        },
        {
          title: "Against the Assaults of the Evil One",
          meditation:
            "The invocation asks her to repel all the assaults and temptations of the evil one at the end. The last battle is fought with the weapons of a lifetime: prayer, confession and the Eucharist.",
          intentionPrompt: "Which of those weapons am I neglecting?",
        },
        {
          title: "Faith, Hope and Charity at the End",
          meditation:
            "It asks to breathe forth the soul confirmed in faith, hope and charity. These three virtues, practised now, are what the soul will carry into death.",
          intentionPrompt: "Which of the three most needs strengthening in me?",
        },
        {
          title: "Robed in Sanctifying Grace",
          meditation:
            "The closing rhyme asks that, robed in sanctifying grace, the soul may stand before God's face. Grace is the wedding garment of the parable; without it no one enters.",
          intentionPrompt: "When will I next go to confession to keep that robe clean?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-barbara",
      typicalStartDate: "25 November, ending on the eve of her feast, 4 December",
      citations: [HAMMER_SCAN, HAMMER_GUTENBERG, CE_BARBARA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-fourteen-holy-helpers",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [HAMMER_GUTENBERG, HAMMER_SCAN_FULL],
    payload: {
      slug: "novena-fourteen-holy-helpers",
      title: "Novena to All the Fourteen Holy Helpers",
      summary:
        "The nine-day novena to the Fourteen Holy Helpers together — Sts. George, Blaise, Erasmus, Pantaleon, Vitus, Christopher, Denis, Cyriacus, Achatius, Eustace, Giles, Margaret, Catherine and Barbara. Each day opens with a preparatory prayer attributed to St. Alphonsus Liguori, says a prayer proper to the day's subject, and continues with the litany, collects and invocation of the Holy Helpers.",
      background:
        "Devotion to the fourteen saints invoked together as Holy Helpers arose in German lands in the late Middle Ages, in times of plague, when each was already invoked against particular ills. Hammer relates the tradition of the shepherd of the Cistercian abbey of Langheim, near Bamberg, who in 1445 and 1446 saw a child and then fourteen children who called themselves the Fourteen Helpers and asked for a chapel; the chapel built there in 1447-1448 became the pilgrimage of Vierzehnheiligen. The nine days follow Hammer's subjects: the devotion itself, man's destiny, faith, hope, the love of God, charity toward one's neighbour, human respect, prayer and perseverance. The prayers are those of Hammer's manual (New York: Benziger Brothers, 1909); the day's prayer changes, while the preparatory prayer, the litany and the closing prayers are said every day, and a concluding prayer of thanksgiving is added on the last day. The meditations below are short editorial introductions, not Hammer's own meditations.",
      intentionTheme:
        "help in every need of body and soul through the intercession of the Fourteen Holy Helpers",
      days: [
        {
          day: 1,
          title: "The Devotion to the Fourteen Holy Helpers",
          meditation:
            "The first day considers the devotion itself: the faithful learned to call on particular saints in particular needs, and found them helpers. Begin the novena by naming plainly the need you bring.",
          prayerText: HOLY_HELPERS_DAY_1,
          intentionPrompt: "What need am I bringing to the Holy Helpers in these nine days?",
        },
        {
          day: 2,
          title: "The Destiny of Man",
          meditation:
            "The Holy Helpers kept their eyes on the end for which God made them. Man is created for eternal union with God, and no lesser goal can satisfy him.",
          prayerText: HOLY_HELPERS_DAY_2,
          intentionPrompt: "What am I living for, in practice, from day to day?",
        },
        {
          day: 3,
          title: "The Virtue of Faith",
          meditation:
            "The Helpers believed so firmly that torments could not shake them. Faith is treasured, believed, confessed and lived — the four things today's prayer asks for.",
          prayerText: HOLY_HELPERS_DAY_3,
          intentionPrompt: "Where am I ashamed or careless of my faith?",
        },
        {
          day: 4,
          title: "The Virtue of Hope",
          meditation:
            "Their hope rested on faith and was therefore firm. True hope trusts God for all things necessary to salvation without presuming on His mercy or despairing of it.",
          prayerText: HOLY_HELPERS_DAY_4,
          intentionPrompt: "Am I tempted more to presumption or to discouragement?",
        },
        {
          day: 5,
          title: "The Love of God",
          meditation:
            "The love of God showed itself in the whole of their lives, and above all in their deaths. God loved us first; the novena asks that His love kindle ours.",
          prayerText: HOLY_HELPERS_DAY_5,
          intentionPrompt: "What would it look like to love God with my whole heart today?",
        },
        {
          day: 6,
          title: "Charity toward One's Neighbour",
          meditation:
            "The second great commandment is like the first. Today's prayer is woven from St. Paul's hymn to charity in the First Letter to the Corinthians.",
          prayerText: HOLY_HELPERS_DAY_6,
          intentionPrompt: "Which line of St. Paul's hymn to charity most convicts me?",
        },
        {
          day: 7,
          title: "Human Respect",
          meditation:
            "The Holy Helpers did God's will without regard to what others thought of them. Fear of what people will say has quietly ruined many good intentions.",
          prayerText: HOLY_HELPERS_DAY_7,
          intentionPrompt: "What good thing am I not doing because of what others might think?",
        },
        {
          day: 8,
          title: "Prayer",
          meditation:
            "The saints drew their strength from prayer. Today's prayer asks for the spirit of prayer: to walk always in God's presence and to know the consolation of speaking with Him.",
          prayerText: HOLY_HELPERS_DAY_8,
          intentionPrompt: "How can I turn my ordinary work into prayer?",
        },
        {
          day: 9,
          title: "Perseverance",
          meditation:
            "The novena ends where every Christian life must end, in perseverance. Good resolutions made in these nine days are worth only as much as the fidelity that keeps them; a prayer of thanksgiving is added today.",
          prayerText: HOLY_HELPERS_DAY_9,
          intentionPrompt: "Which resolution from this novena will I keep, and how?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "Any time of need",
      citations: [HAMMER_GUTENBERG, HAMMER_SCAN_FULL],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-immaculate-conception-raccolta",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [RACCOLTA_1910_NOVENAS, CE_IMMACULATE_CONCEPTION, CE_RACCOLTA],
    payload: {
      slug: "novena-immaculate-conception-raccolta",
      title: "Raccolta Novena for the Immaculate Conception",
      summary:
        "The Raccolta's novena for the Immaculate Conception, kept from 29 November to 7 December. Each day opens with the Come, O Holy Ghost and a preparatory prayer and nine Hail Marys, then says a prayer proper to the day that rejoices with Mary under a new image of her purity — lily, rose, mirror, moon, star, morning and sun — and closes with the Tota pulchra or the Litany and the collect of the feast.",
      background:
        "The Raccolta, first compiled at Rome in 1807 by Telesforo Galli for the Congregation of Indulgences, gathered the prayers and pious exercises to which the popes had attached indulgences; its five novenas for the principal feasts of Our Lady were indulgenced by Pius VII in rescripts of 1808 and 1809. The English is that of the authorised translation printed by Burns & Oates in 1910. This novena is distinct from the shorter traditional novena to the Immaculate Conception in this catalogue: its nine prayers each rejoice with Mary in a different aspect of the privilege defined by Pius IX in 1854, while the preparatory prayer, the Tota pulchra versicles and the collect of the feast are said throughout, as the book directs: the same order is kept every day, the prayer for the day alone being changed. Where the book refers back to prayers printed elsewhere — the Come, O Holy Ghost and its collect, and the closing prayers for the Pope and for the Church — they are written out in full; the Litany of Loreto, printed in another part of the book, is indicated by the book's own rubric.",
      intentionTheme: "purity of heart and victory over sin through Mary Immaculate",
      days: [
        {
          day: 1,
          title: "Chosen from All Eternity",
          meditation:
            "The first prayer rejoices that Mary was elected from all eternity to be the Mother of the Word and preserved from the taint of original sin, and asks victory over the wounds that original sin has left in us.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_1,
          intentionPrompt:
            "Which effect of original sin do I struggle with most — pride, weakness of will, or a darkened mind?",
        },
        {
          day: 2,
          title: "Unsullied Lily: Full of Grace",
          meditation:
            "Mary was filled with grace from the first moment of her existence. The prayer does not envy her; it asks for a portion of the same grace and a share in the treasures of her Conception.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_2,
          intentionPrompt: "Do I live as someone poor in grace who needs to ask for more?",
        },
        {
          day: 3,
          title: "Mystic Rose: Victory over the Serpent",
          meditation:
            "The third prayer recalls the promise of Genesis that the woman would crush the serpent's head, and asks courage against every snare of the enemy and the grace never to sin mortally.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_3,
          intentionPrompt: "What snare do I keep walking into?",
        },
        {
          day: 4,
          title: "Mirror of Holy Purity: The Virtues and Gifts",
          meditation:
            "With her Conception came every virtue and the gifts of the Holy Spirit. The petition is practical: the grace to practise every Christian virtue, and so to be ready for the Spirit's gifts.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_4,
          intentionPrompt: "Which virtue have I stopped even trying to practise?",
        },
        {
          day: 5,
          title: "Bright Moon: The Beginning of Salvation",
          meditation:
            "Her Conception was the dawn of redemption and the joy of the world. The day's prayer asks that the Precious Blood may not have been shed for us in vain.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_5,
          intentionPrompt: "Am I letting Christ's sacrifice bear fruit in my life, or wasting it?",
        },
        {
          day: 6,
          title: "Brilliant Star: The Joy of the Angels",
          meditation:
            "The angels rejoiced at her Conception. The novena asks to share their joy one day, praising her in their company for ever.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_6,
          intentionPrompt: "Do I think of heaven as joy, or only as reward?",
        },
        {
          day: 7,
          title: "Rising Morn: Confirmed in Grace",
          meditation:
            "Mary was confirmed in grace and never sinned. The prayer asks for a hatred of sin so entire and lasting that one would rather die than commit a mortal sin.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_7,
          intentionPrompt: "Do I hate sin, or only its consequences?",
        },
        {
          day: 8,
          title: "Sun without Stain: Grace beyond All the Saints",
          meditation:
            "God gave her more grace than all the angels and saints together. The eighth prayer asks the grace not to receive God's grace in vain, and to begin in earnest a new life.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_8,
          intentionPrompt: "What grace have I been given that I am still receiving in vain?",
        },
        {
          day: 9,
          title: "Living Light: The Ancient Curse Blotted Out",
          meditation:
            "Her first act, the last prayer says, was to adore her God and give Him thanks, because through her the ancient curse was lifted. The novena ends asking for a love of God that lasts on earth and for ever.",
          prayerText: RACCOLTA_IMMACULATE_CONCEPTION_DAY_9,
          intentionPrompt: "What will I give thanks for on the feast tomorrow?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedMarianTitleSlug: "immaculate-conception",
      typicalStartDate: "29 November, ending on 7 December, the eve of the solemnity",
      relatedFeastSlug: "solemnity-immaculate-conception",
      citations: [RACCOLTA_1910_NOVENAS, CE_IMMACULATE_CONCEPTION, CE_RACCOLTA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-nativity-of-our-lady",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [RACCOLTA_1910_NOVENAS, CE_NATIVITY_OF_MARY, CE_RACCOLTA],
    payload: {
      slug: "novena-nativity-of-our-lady",
      title: "Novena for the Nativity of Our Lady (Raccolta)",
      summary:
        "The Raccolta's novena for the birthday of the Blessed Virgin, kept from 30 August to 7 September. Each day she is greeted nine times, one Hail Mary for each month she was carried in her mother's womb, and asked to be spiritually reborn in the soul; the same received prayers are said on all nine days.",
      background:
        "The feast of the Nativity of the Blessed Virgin Mary on 8 September is first attested in the sixth century, in a hymn of St. Romanus the Melodist; the Catholic Encyclopedia of 1913 thinks it arose in Syria or Palestine and was adopted at Rome from the East in the seventh century, Pope Sergius I prescribing a litany and procession for it. The Raccolta, first compiled at Rome in 1807 by Telesforo Galli for the Congregation of Indulgences, gathered the prayers and pious exercises to which the popes had attached indulgences; its five novenas for the principal feasts of Our Lady were indulgenced by Pius VII in rescripts of 1808 and 1809. The English is that of the authorised translation printed by Burns & Oates in 1910. The novena opens with a prayer greeting Mary as foretold by the prophets and desired by all nations, follows with nine salutations each closed by a Hail Mary, and ends with a prayer to the holy infant that her name be honey in the mouth, melody in the ear and joy in the heart — words the book gives first in Latin. The day-by-day subjects below follow the nine salutations; the prayers themselves are said in full every day. Where the book refers back to prayers printed elsewhere — the Come, O Holy Ghost and its collect, and the closing prayers for the Pope and for the Church — they are written out in full; the Litany of Loreto, printed in another part of the book, is indicated by the book's own rubric.",
      intentionTheme:
        "that Mary be spiritually reborn in our souls, and that her name be our comfort in life and in death",
      days: repeatedPrayerDays(RACCOLTA_NATIVITY_NOVENA_PRAYER, [
        {
          title: "Of the House of David",
          meditation:
            "The first salutation recalls Mary's descent from the royal house of David and her birth to holy Anna. God keeps His promises through families and generations.",
          intentionPrompt: "What has God handed on to me through my own family?",
        },
        {
          title: "White Dove of Purity",
          meditation:
            "The second greets the heavenly babe conceived free from original sin. Her birth is celebrated because her life was holy from its first moment.",
          intentionPrompt: "What would it mean for my life to be holy from now on?",
        },
        {
          title: "The Bright Morning before the Sun",
          meditation:
            "Mary is hailed as the morning that comes before the Sun of Justice. Her birth is the first light of the day of redemption.",
          intentionPrompt: "Where in my life is the light just beginning?",
        },
        {
          title: "The Elect, Shining in the Night",
          meditation:
            "The fourth salutation calls her the Elect who burst forth in the dark night of sin. God's choice of her is a promise that grace is stronger than the world's darkness.",
          intentionPrompt: "What darkness do I most need grace to break into?",
        },
        {
          title: "Beauteous Moon over a Darkened World",
          meditation:
            "She shed light on a world wrapped in the darkness of paganism. The moon gives no light of its own; Mary's light is all from her Son.",
          intentionPrompt: "Do I reflect Christ, or try to shine by my own light?",
        },
        {
          title: "Terrible as an Army",
          meditation:
            "The warrior-child, a host in herself, put all hell to flight — an image the Church took from the Song of Songs. Devotion to Mary is not sentimental; it is protection in spiritual combat.",
          intentionPrompt: "In what battle do I need to call on Mary's help?",
        },
        {
          title: "Possessed by God from Eternity",
          meditation:
            "The seventh salutation hails the fair soul of Mary, possessed by God from eternity, in words the liturgy borrowed from the Wisdom of Proverbs. Every person was first a thought in the mind of God.",
          intentionPrompt: "Do I believe that God wanted me before I existed?",
        },
        {
          title: "The Hour She Was Born",
          meditation:
            "The eighth salutation venerates her infant body, the swaddling clothes and the crib, and blesses the hour of her birth. The Incarnation made infancy itself holy.",
          intentionPrompt: "Whose birth — a child's, a godchild's — can I thank God for today?",
        },
        {
          title: "Mother of the Word Incarnate",
          meditation:
            "The last salutation hails the beloved infant who would become Mother of the Saviour of the world by the power of the Holy Spirit. The birthday of the Mother points to the birth of the Son.",
          intentionPrompt: "How will I keep Our Lady's birthday tomorrow?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "30 August, ending on 7 September, the eve of the feast",
      relatedFeastSlug: "feast-nativity-of-the-blessed-virgin-mary",
      citations: [RACCOLTA_1910_NOVENAS, CE_NATIVITY_OF_MARY, CE_RACCOLTA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-annunciation",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [RACCOLTA_1910_NOVENAS, CE_ANNUNCIATION, CE_RACCOLTA],
    payload: {
      slug: "novena-annunciation",
      title: "Novena for the Annunciation (Raccolta)",
      summary:
        "The Raccolta's novena for the Annunciation, kept from 16 to 24 March: nine salutations of the Blessed Virgin, each followed by a Hail Mary, meditating on her humility, her purity, her obedience and the Fiat by which the Word took flesh, said the same on each of the nine days.",
      background:
        "The feast of 25 March, in old calendars called the feast of the Incarnation and the beginning of the Redemption, probably arose about the time of the Council of Ephesus and appears in the Latin Church in the Gelasian Sacramentary; in the Latin Church it is kept as a feast of Mary, in the East as a feast of Christ. The Raccolta, first compiled at Rome in 1807 by Telesforo Galli for the Congregation of Indulgences, gathered the prayers and pious exercises to which the popes had attached indulgences; its five novenas for the principal feasts of Our Lady were indulgenced by Pius VII in rescripts of 1808 and 1809. The English is that of the authorised translation printed by Burns & Oates in 1910. The nine salutations walk through the angel's message and Mary's answer, quoting St. Thomas of Villanova on her Fiat, St. Albert the Great on her union with God and St. Augustine on her humility, and taking up in turn the words Hail, full of grace, The Lord is with thee and Blessed art thou amongst women. The day-by-day subjects follow the salutations; the prayers are said in full every day. Where the book refers back to prayers printed elsewhere — the Come, O Holy Ghost and its collect, and the closing prayers for the Pope and for the Church — they are written out in full; the Litany of Loreto, printed in another part of the book, is indicated by the book's own rubric.",
      intentionTheme:
        "humility, purity and ready obedience to God's will, after the example of Mary at the Annunciation",
      days: repeatedPrayerDays(RACCOLTA_ANNUNCIATION_NOVENA_PRAYER, [
        {
          title: "The Humblest of All Creatures",
          meditation:
            "On the day God exalted her to be His Mother, Mary was the humblest of His creatures. The first salutation asks to know the depth of one's own nothingness.",
          intentionPrompt: "Where does my pride hide behind good works?",
        },
        {
          title: "Behold the Handmaid of the Lord",
          meditation:
            "Exalted above the choirs of angels, she called herself a handmaid. The second salutation asks for true humility and angelic purity.",
          intentionPrompt: "Whose servant am I, really?",
        },
        {
          title: "The Humble Fiat",
          meditation:
            "By her Fiat the Word came down into her womb. St. Thomas of Villanova's cry — O mighty Fiat! — is taken up as a prayer that our hearts be drawn to God.",
          intentionPrompt: "What is God asking me to say yes to?",
        },
        {
          title: "Be It Done unto Me",
          meditation:
            "The Trinity waited on her consent. The fourth salutation asks to say the same words in every good and bad fortune.",
          intentionPrompt: "Can I say be it done unto me about something I did not choose?",
        },
        {
          title: "No Creature Closer to God",
          meditation:
            "Her obedience made her union with God more intimate than any other creature's. Sin works the opposite way; the prayer asks for true penance so that Jesus may live in us again.",
          intentionPrompt: "What sin is keeping me at a distance from God?",
        },
        {
          title: "Troubled by Modesty, Troubled by Pride",
          meditation:
            "Mary was troubled by the angel's praise because she was modest; we are troubled before her because we are proud. St. Augustine's words on her humility close the petition.",
          intentionPrompt: "When was I last troubled by praise instead of hungry for it?",
        },
        {
          title: "Hail, Full of Grace",
          meditation:
            "We greet her at all hours with the angel's words. The seventh salutation asks for a little of the grace with which the Holy Spirit filled her when He overshadowed her.",
          intentionPrompt: "Do I pray the Hail Mary attentively, or only quickly?",
        },
        {
          title: "The Lord Is with Thee",
          meditation:
            "God was with her from her Conception, and still more closely by the Incarnation. The prayer asks to be one in heart and soul with Jesus by sanctifying grace.",
          intentionPrompt: "Is the Lord with me today, in grace?",
        },
        {
          title: "Blessed Art Thou amongst Women",
          meditation:
            "The last salutation asks her blessing on heart and soul, in the sure hope that those she blesses in life will be blessed of God in death.",
          intentionPrompt: "What blessing do I most need from Our Lady?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "16 March, ending on 24 March, the eve of the solemnity",
      relatedFeastSlug: "solemnity-annunciation",
      citations: [RACCOLTA_1910_NOVENAS, CE_ANNUNCIATION, CE_RACCOLTA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-purification-of-our-lady",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [RACCOLTA_1910_NOVENAS, CE_CANDLEMAS, CE_RACCOLTA],
    payload: {
      slug: "novena-purification-of-our-lady",
      title: "Novena for the Purification of Our Lady (Raccolta)",
      summary:
        "The Raccolta's novena for Candlemas, the feast of the Purification of the Blessed Virgin and the Presentation of the Lord on 2 February, kept from 24 January to 1 February: nine invocations of Mary as Virgin most obedient, pure, holy, humble, diligent, clement, compassionate and resigned, each with a Hail Mary, said the same on each day.",
      background:
        "Forty days after Christ's birth Mary fulfilled the law of purification and redeemed her first-born in the Temple, where Simeon and Anna recognised Him (Luke 2:22-38). The feast, called the Purification of the Blessed Virgin, the Presentation of Christ in the Temple, and in Greek the Hypapante or Meeting, is attested at Jerusalem in the fourth century by the pilgrim Egeria; it is kept on 2 February and known as Candlemas from its blessing of candles. The Raccolta, first compiled at Rome in 1807 by Telesforo Galli for the Congregation of Indulgences, gathered the prayers and pious exercises to which the popes had attached indulgences; its five novenas for the principal feasts of Our Lady were indulgenced by Pius VII in rescripts of 1808 and 1809. The English is that of the authorised translation printed by Burns & Oates in 1910. Each of the nine invocations recalls one part of the Gospel scene and turns it into a petition. The day-by-day subjects follow the invocations; the prayers are said in full every day. Where the book refers back to prayers printed elsewhere — the Come, O Holy Ghost and its collect, and the closing prayers for the Pope and for the Church — they are written out in full; the Litany of Loreto, printed in another part of the book, is indicated by the book's own rubric.",
      intentionTheme:
        "purity of heart and the offering of ourselves to God, with Mary in the Temple",
      days: repeatedPrayerDays(RACCOLTA_PURIFICATION_NOVENA_PRAYER, [
        {
          title: "Presented in the Temple",
          meditation:
            "The purest of virgins submitted to a law of purification that did not bind her. The first invocation asks that our hearts be kept unstained so that we too may be presented to God in heaven.",
          intentionPrompt: "What law of God do I keep only when it suits me?",
        },
        {
          title: "Virgin Most Obedient",
          meditation:
            "Mary offered the sacrifice of the poor, two turtle-doves. The prayer asks that we make ourselves a living sacrifice by practising every virtue.",
          intentionPrompt: "What could I offer to God this week that costs me something?",
        },
        {
          title: "Virgin Most Pure",
          meditation:
            "She kept the precepts of the law without regard to the reproach of men. Purity of heart is kept whatever the world may think.",
          intentionPrompt: "Whose opinion makes me compromise?",
        },
        {
          title: "Virgin Most Holy",
          meditation:
            "By offering her Son to the Father she made heaven glad. Ask her today to present your heart to God and keep it free from mortal sin.",
          intentionPrompt: "Have I offered myself to God today?",
        },
        {
          title: "Virgin Most Humble",
          meditation:
            "She placed Jesus in the arms of old Simeon, who could then depart in peace. Pray today for the elderly, and for those waiting to die.",
          intentionPrompt: "Which older person could I visit or call this week?",
        },
        {
          title: "Virgin Most Diligent",
          meditation:
            "She ransomed her first-born according to the law, co-operating in the salvation of the world. The prayer asks that our hearts be ransomed from the slavery of sin.",
          intentionPrompt: "What habit of sin still holds me captive?",
        },
        {
          title: "Virgin Most Clement",
          meditation:
            "When Simeon foretold the sword that would pierce her soul, she resigned herself at once to God's good pleasure. The prayer asks patience in all troubles.",
          intentionPrompt: "What sorrow have I been refusing to accept?",
        },
        {
          title: "Virgin Most Compassionate",
          meditation:
            "Anna the prophetess recognised the Redeemer and spoke of Him to all who were waiting. Pray for the gift of recognising Christ and making Him known.",
          intentionPrompt: "To whom could I speak about Christ?",
        },
        {
          title: "Virgin Most Resigned",
          meditation:
            "Foreseeing the Passion, Mary still consoled Joseph with holy words. The last invocation asks for true sorrow for sin and a share in her glory.",
          intentionPrompt: "Whom can I console this week, even while I am troubled myself?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "24 January, ending on 1 February, the eve of the feast",
      relatedFeastSlug: "feast-presentation-of-the-lord",
      citations: [RACCOLTA_1910_NOVENAS, CE_CANDLEMAS, CE_RACCOLTA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-assumption",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [RACCOLTA_1910_NOVENAS, CE_ASSUMPTION, MUNIFICENTISSIMUS_DEUS],
    payload: {
      slug: "novena-assumption",
      title: "Novena for the Assumption (Raccolta)",
      summary:
        "The Raccolta's novena for the Assumption, kept from 6 to 14 August. Each day considers a different glory of the Blessed Virgin in her death and after it — her preparation for death, her passing in the company of her Son and the Apostles, her death of love, her body, its resurrection, her Assumption, her queenship, her crown and her patronage of mankind — with three petitions, each followed by three Hail Marys, offered in union with one of the nine choirs of angels.",
      background:
        "The feast of 15 August, called in old liturgical books the Dormition or Falling Asleep of Mary, has a double object: her happy departure from this life and the assumption of her body into heaven. Pius XII defined as a dogma of faith on 1 November 1950, in the apostolic constitution Munificentissimus Deus, that the Immaculate Mother of God, having completed the course of her earthly life, was assumed body and soul into heavenly glory. The Raccolta, first compiled at Rome in 1807 by Telesforo Galli for the Congregation of Indulgences, gathered the prayers and pious exercises to which the popes had attached indulgences; its five novenas for the principal feasts of Our Lady were indulgenced by Pius VII in rescripts of 1808 and 1809. The English is that of the authorised translation printed by Burns & Oates in 1910. Each day opens with the Come, O Holy Ghost and the hymn O Gloriosa Virginum, sets before the soul one glory of Mary in a short consideration printed as part of the prayer, and closes with the Litany, the versicle Exaltata est and the collect. The considerations of her death draw on the traditions of the holy writers, as the book says; the Church has not defined the manner of her passing. Where the book refers back to prayers printed elsewhere — the Come, O Holy Ghost and its collect, and the closing prayers for the Pope and for the Church — they are written out in full; the Litany of Loreto, printed in another part of the book, is indicated by the book's own rubric.",
      intentionTheme: "a holy death and a share in the glory of Mary assumed into heaven",
      days: [
        {
          day: 1,
          title: "Well Prepared to Die",
          meditation:
            "The novena begins with Mary's death because her whole life had been a preparation for it. The comparison with our own preparation is meant to sting a little.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_1,
          intentionPrompt: "If I died this year, what would I wish I had prepared?",
        },
        {
          day: 2,
          title: "Assisted by Her Son and the Apostles",
          meditation:
            "Tradition pictures her death surrounded by the Apostles and comforted by her Son. The petitions ask for the same at our own death, and above all for Viaticum.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_2,
          intentionPrompt: "Have I asked to receive the Last Sacraments when my time comes?",
        },
        {
          day: 3,
          title: "Dying of Love",
          meditation:
            "The third day considers the old teaching that Mary died of love rather than of illness. The petitions ask for a spark of the same fire, enough to give true sorrow for sin.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_3,
          intentionPrompt: "What would it look like for love of God to shape how I die?",
        },
        {
          day: 4,
          title: "Her Body after Death",
          meditation:
            "Her virginal body, the consideration says, remained bright and fragrant and was a source of healing. The petitions turn to purity and to the example our bodies give others.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_4,
          intentionPrompt: "Is my bodily life an example or a stumbling-block to others?",
        },
        {
          day: 5,
          title: "The Resurrection of Her Body",
          meditation:
            "Her risen body received the gifts the theologians attribute to glorified bodies — brightness, agility, subtlety and impassibility. The petitions ask for the virtues that prepare our own resurrection.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_5,
          intentionPrompt: "Do I believe in the resurrection of my own body?",
        },
        {
          day: 6,
          title: "Assumed into Heaven",
          meditation:
            "The sixth day contemplates the Assumption itself, with the angelic hosts and the souls her merits had helped. The petitions ask that our hearts be fixed on the happiness of heaven.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_6,
          intentionPrompt: "How often do I think about heaven?",
        },
        {
          day: 7,
          title: "Queen of the Universe",
          meditation:
            "Mary reigns as Queen and receives the homage of angels and saints. The petitions ask her to rule us with the gentle sway of her protection.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_7,
          intentionPrompt: "Have I placed myself under Mary's protection?",
        },
        {
          day: 8,
          title: "The Crown upon Her Brow",
          meditation:
            "Crowned by her Son, she knows the deep mysteries of God. The petitions ask pardon for sins of the tongue and the eyes, so that we too may be crowned.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_8,
          intentionPrompt: "Which of my words and looks would not please God?",
        },
        {
          day: 9,
          title: "Patroness of Mankind",
          meditation:
            "The novena ends with Mary's patronage: she is the advocate of men and desires that all be saved. The last petition asks that we call on her always, and above all at the moment of death.",
          prayerText: RACCOLTA_ASSUMPTION_DAY_9,
          intentionPrompt: "What relapse into sin do I need to stop despairing over?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedMarianTitleSlug: "assumption-of-mary",
      typicalStartDate: "6 August, ending on 14 August, the eve of the solemnity",
      relatedFeastSlug: "solemnity-assumption",
      citations: [RACCOLTA_1910_NOVENAS, CE_ASSUMPTION, MUNIFICENTISSIMUS_DEUS],
    },
  },
];
