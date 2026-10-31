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
];
