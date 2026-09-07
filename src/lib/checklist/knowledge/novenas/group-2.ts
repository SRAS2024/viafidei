import type { CuratedEntry } from "../index";

/**
 * Novena group 2 — the non-Marian novenas: Christ, the Holy Family, the Holy
 * Souls, the angels and the saints, plus the two novenas whose received form is
 * not nine literal days (the St. Andrew Christmas novena, kept from November 30
 * to December 24, and the fifty-four day Rosary novena of Pompeii).
 *
 * Every `prayerText` below is a received text reproduced from the cited page —
 * the nine daily prayers of St. Alphonsus Liguori's Christmas novena, the nine
 * day-prayers of the traditional novenas to St. Anne and to St. Jude, the
 * received petition and thanksgiving prayers of the fifty-four day Rosary
 * novena, and the single received prayer that each of the remaining novenas
 * repeats on all nine days. Nothing here is paraphrased, templated or composed.
 *
 * Where a novena's received form repeats one prayer on each of the nine days —
 * which is the ordinary shape of a novena in the old prayer books — that is
 * said plainly in `background`, and the day-by-day distinction lies in the
 * `meditation`, which is a short editorial introduction to the day's subject
 * and never pretends to be part of the prayer.
 *
 * Obvious scanning slips in the transcribed sources (a dropped word, "preserve"
 * for "persevere", "form" for "from", "a apprentice" for "an apprentice", "was"
 * for "wast", modern quotation marks) have been silently corrected; no wording
 * has been changed.
 *
 * One slug here is a deliberate replacement rather than an addition:
 * `novena-saint-jude` supersedes the template-generated entry of the same slug
 * in `../novenas.ts`, in the same way group 1 supersedes the eight placeholders
 * it rewrites. Every other slug in this file is new.
 */

const CD_CHRISTMAS = "https://www.catholicdoors.com/prayers/novenas/p04337.htm";
const CD_ANDREW = "https://www.catholicdoors.com/prayers/novenas/p00098.htm";
const CD_FIFTY_FOUR = "https://www.catholicdoors.com/prayers/novenas/p00074.htm";
const CD_HOLY_FAMILY = "https://www.catholicdoors.com/prayers/novenas/p00114.htm";
const CD_HOLY_SOULS = "https://www.catholicdoors.com/prayers/novenas/p03831.htm";
const CD_MICHAEL = "https://www.catholicdoors.com/prayers/novenas/p00084.htm";
const CD_GUARDIAN_ANGEL = "https://www.catholicdoors.com/prayers/novenas/p00850.htm";
const CD_HOLY_NAME = "https://www.catholicdoors.com/prayers/novenas/p00061.htm";
const CD_CHRIST_THE_KING = "https://www.catholicdoors.com/prayers/novenas/p00109.htm";
const CD_PRECIOUS_BLOOD = "https://www.catholicdoors.com/prayers/novenas/p04335.htm";
const CD_CORPUS_CHRISTI = "https://www.catholicdoors.com/prayers/novenas/p03452.htm";
const CD_NOVENA_OF_GRACE = "https://www.catholicdoors.com/prayers/novenas/p00072.htm";
const CD_ANNE = "https://www.catholicdoors.com/prayers/novenas/p00007.htm";
const CD_JUDE = "https://www.catholicdoors.com/prayers/novenas/p00003.htm";
const CD_RITA = "https://www.catholicdoors.com/prayers/novenas/p00069.htm";
const CD_PEREGRINE = "https://www.catholicdoors.com/prayers/novenas/p00021.htm";
const CD_GERARD = "https://www.catholicdoors.com/prayers/novenas/p00108.htm";
const CD_FRANCIS_ASSISI = "https://www.catholicdoors.com/prayers/novenas/p00085.htm";
const CD_BENEDICT = "https://www.catholicdoors.com/prayers/novenas/p00022.htm";
const CD_PATRICK = "https://www.catholicdoors.com/prayers/novenas/p00057.htm";
const CRUSADE_FIFTY_FOUR = "https://thecatholiccrusade.com/day-01-the-54-day-rosary-novena/";

const NA_NOVENA = "https://www.newadvent.org/cathen/11141b.htm";
const NA_CHRISTMAS = "https://www.newadvent.org/cathen/03724b.htm";
const NA_ANDREW = "https://www.newadvent.org/cathen/01471a.htm";
const NA_PURGATORY = "https://www.newadvent.org/cathen/12575a.htm";
const NA_MICHAEL = "https://www.newadvent.org/cathen/10275b.htm";
const NA_GUARDIAN_ANGELS = "https://www.newadvent.org/cathen/07049c.htm";
const NA_HOLY_NAME = "https://www.newadvent.org/cathen/07421a.htm";
const NA_PRECIOUS_BLOOD = "https://www.newadvent.org/cathen/12373a.htm";
const NA_ANNE = "https://www.newadvent.org/cathen/01538a.htm";
const NA_JUDE = "https://www.newadvent.org/cathen/08542b.htm";
const NA_RITA = "https://www.newadvent.org/cathen/13064a.htm";
const NA_XAVIER = "https://www.newadvent.org/cathen/06233b.htm";
const NA_BENEDICT = "https://www.newadvent.org/cathen/02467b.htm";
const NA_FRANCIS = "https://www.newadvent.org/cathen/06221a.htm";
const NA_PATRICK = "https://www.newadvent.org/cathen/11554a.htm";

const QUAS_PRIMAS =
  "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_11121925_quas-primas.html";
const FAMILIARIS_CONSORTIO =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_19811122_familiaris-consortio.html";
const SPE_SALVI =
  "https://www.vatican.va/content/benedict-xvi/en/encyclicals/documents/hf_ben-xvi_enc_20071130_spe-salvi.html";
const ECCLESIA_DE_EUCHARISTIA =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_20030417_eccl-de-euch.html";
const ROSARIUM_VIRGINIS_MARIAE =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";
const BXVI_FRANCIS_OF_ASSISI =
  "https://www.vatican.va/content/benedict-xvi/en/audiences/2010/documents/hf_ben-xvi_aud_20100127.html";
const BXVI_BENEDICT_OF_NURSIA =
  "https://www.vatican.va/content/benedict-xvi/en/audiences/2008/documents/hf_ben-xvi_aud_20080409.html";
const EWTN_NOVENA_OF_GRACE = "https://www.ewtn.com/catholicism/devotions/novena-for-grace-318";

/** The prayer the St. Andrew Christmas novena repeats fifteen times a day. */
const ANDREW_PRAYER =
  "Hail and blessed be the hour and moment in which the Son of God was born of the most pure Virgin Mary, at midnight, in Bethlehem, in piercing cold. In that hour, vouchsafe, O my God! to hear my prayer and grant my desires, through the merits of Our Saviour Jesus Christ, and of His Blessed Mother. Amen.";

const HOLY_FAMILY_PRAYER =
  "Jesus, Mary, and Joseph, bless me and grant me the grace of loving Holy Church as I should, above every earthly thing, and of ever showing my love by deeds. Jesus, Mary, and Joseph, bless me and grant me the grace of openly professing as I should, with courage and without human respect, the faith that I received as your gift in holy Baptism. Jesus, Mary, and Joseph, bless me and grant me the grace of sharing as I should in the defense and propagation of the Faith when duty calls, whether by word or by the sacrifice of my possessions and my life. Jesus, Mary, and Joseph, bless me and grant me the grace of loving my family and others in mutual charity as I should, and establish us in perfect harmony of thought, will, and action, under the rule and guidance of the shepherds of the Church. Jesus, Mary, and Joseph, bless me and grant me the grace of conforming my life fully as I should to the commandments of God's law and those of His Holy Church, so as to live always in that charity which they set forth. Jesus, Mary, and Joseph, I ask in particular this special favor: (state your intention).";

const HOLY_SOULS_PRAYER =
  "Holy Souls in Purgatory, you are the certain heirs of Heaven. You are most dear to Jesus as the trophies of His Precious Blood and to Mary, Mother of Mercy. Obtain for me through your intercession the grace to lead a holy life, to die a happy death and to attain the blessedness of eternity in Heaven. Dear suffering souls, who long to be delivered in order to praise and glorify God in Heaven, by your unfailing pity help me in the needs which distress me at this time, particularly (mention your request), so that I may obtain relief and assistance from God. In gratitude for your intercession I offer to God on your behalf the satisfactory merits of my prayer and work, my joys and sufferings of this day.";

const MICHAEL_PRAYER =
  "Glorious Saint Michael, guardian and defender of the Church of Jesus Christ, come to the assistance of His followers, against whom the powers of hell are unchained. Guard with special care our Holy Father, the Pope, and our bishops, priests, all our religious and lay people, and especially the children. Saint Michael, watch over us during life, defend us against the assaults of the demon, and assist us especially at the hour of death. Help us achieve the happiness of beholding God face to face for all eternity. Amen. Saint Michael, intercede for me with God in all my necessities, especially (state your intention). Obtain for me a favourable outcome in the matter I recommend to you. Mighty prince of the heavenly host, and victor over rebellious spirits, remember me for I am weak and sinful and so prone to pride and ambition. Be for me, I pray, my powerful aid in temptation and difficulty, and above all do not forsake me in my last struggle with the powers of evil. Amen.";

const GUARDIAN_ANGEL_PRAYER =
  "O most faithful companion, appointed by God to be my guardian, and who never leaves my side, how shall I thank you for your faithfulness and love and for the benefits which you have obtained for me! You watch over me when I sleep; you comfort me when I am sad; you avert the dangers that threaten me and warn me of those to come; you withdraw me from sin and inspire me to good; you exhort me to penance when I fall and reconcile me to God. I beg you not to leave me. Comfort me in adversity, restrain me in prosperity, defend me in danger, and assist me in temptations, lest at any time I fall beneath them. Offer up in the sight of the Divine Majesty my prayers and petitions, and all my works of piety, and help me to persevere in grace until I come to everlasting life. Amen.";

const HOLY_NAME_PRAYER =
  "O merciful Jesus! Who didst in Thine early infancy commence Thine office of Saviour, by shedding Thy precious Blood, and assuming for us that Name which is above all names; we thank Thee for such early proofs of Thine infinite love; we venerate Thy sacred Name, in union with the profound respect of the Angel who first announced it to the earth, and unite our affections to the sentiments of tender devotion which the adorable Name of Jesus has in all ages enkindled in the hearts of Thy servants. Animated with a firm faith in Thine unerring word, and penetrated with confidence in Thy mercy, we now most humbly remind Thee of the promise Thou hast made, that when two or three should assemble in Thy Name, Thou Thyself wouldst be in the midst of them. Come, then, into the midst of us, most amiable Jesus! for it is in Thy Sacred Name we are here assembled. Come into our hearts, that Thy Holy Spirit may pray in and by us; and mercifully grant us, through that adorable Name, which is the joy of heaven, the terror of hell, the consolation of the afflicted, and the solid ground of our unlimited confidence, all the petitions we make in this Novena. O Blessed Mother of our Redeemer; who didst participate so deeply in the sufferings of thy dear Son, when He shed His sacred Blood, and assumed for us the Name of Jesus; obtain for us through that adorable Name, the favours we petition in this Novena. Beg, also, that the most ardent love may imprint on our hearts that sacred Name, that it may be always in our minds, and frequently on our lips; that it may be our defence in temptations, and our refuge in danger, during our lives, and our consolation and support in the hour of death. Amen.";

const CHRIST_THE_KING_PRAYER =
  "O Lord our God, You alone are the Most Holy King and Ruler of all nations. We pray to You, Lord, in the great expectation of receiving from You, O Divine King, mercy, peace, justice and all good things. Protect, O Lord our King, our families and the land of our birth. Guard us we pray Most Faithful One. Protect us from our enemies and from Your Just Judgment. Forgive us, O Sovereign King, our sins against You. Jesus, You are a King of Mercy. We have deserved Your Just Judgment. Have mercy on us, Lord, and forgive us. We trust in Your Great Mercy. O most awe-inspiring King, we bow before You and pray; May Your Reign, Your Kingdom, be recognized on earth. Amen.";

const PRECIOUS_BLOOD_PRAYER =
  "By the Voice of your Blood, O Jesus, I would press you, solicit you, importune you. Though you seem to reject my supplications I will not leave your bleeding feet until you hear me. Too many graces, too many mercies flow from your Blood for me not to hope in its efficacy. Then, O Jesus, by the Precious Blood seven times shed for the welfare of all, by each drop of that sacred price of our redemption, by the tears of your immaculate mother, I implore you, hear my earnest prayer. (Here specify your request.) O Jesus, during all the days of your mortal life you consoled so many sufferers, healed so many infirmities, raised so often a sinking courage, you will not fail to have pity on one who cries to you from the depths of anguish. Oh! No, it is impossible. Another profound sigh from my heart, and from the wound in your own there will flow to me upon a wave of your merciful Blood the grace so ardently desired. O Jesus, Jesus, hasten the moment when you will change my tears into joy, my sighs into thanksgiving. Holy Mary, source of the divine Blood, I implore you not to lose this occasion of glorifying the Blood which made you immaculate. Amen.";

const CORPUS_CHRISTI_PRAYER =
  "I thank You, Jesus, my Divine Redeemer, for coming upon the earth for our sake, and for instituting the adorable Sacrament of the Holy Eucharist in order to remain with us until the end of the world. I thank You for hiding beneath the Eucharistic species Your infinite majesty and beauty, which Your Angels delight to behold, so that I might have courage to approach the throne of Your Mercy. I thank You, most loving Jesus, for having made Yourself my food, and for uniting me to Yourself with so much love in this wonderful Sacrament that I may live in You. I thank You, my Jesus, for giving Yourself to me in this Blessed Sacrament, and so enriching it with the treasures of Your love that You have no greater gift to give me. I thank You not only for becoming my food but also for offering Yourself as a continual sacrifice to Your Eternal Father for my salvation. I thank You, Divine Priest, for offering Yourself as a Sacrifice daily upon our altars in adoration and homage to the Most Blessed Trinity, and for making amends for our poor and miserable adorations. I thank You for renewing in this daily Sacrifice the actual Sacrifice of the Cross offered on Calvary, in which You satisfy Divine justice for us poor sinners. I thank You, dear Jesus, for having become the priceless Victim to merit for me the fullness of heavenly favors. Awaken in me such confidence in You that their fullness may descend ever more fruitfully upon my soul. I thank You for offering Yourself in thanksgiving to God for all His benefits, spiritual and temporal, which He has bestowed upon me. In union with Your offering of Yourself to Your Father in the Holy Sacrifice of the Mass, I ask for this special favor: (state your intention). If it be Your holy Will, grant my request. Through You I also hope to receive the grace of perseverance in Your love and faithful service, a holy death, and a happy eternity with You in Heaven. Amen.";

const NOVENA_OF_GRACE_PRAYER =
  "O most lovable and loving Saint Francis Xavier, in union with thee I adore the Divine Majesty. The remembrance of the favors with which God blessed thee during life and of thy glory after death fills me with joy; and I unite with thee in offering to Him my humble tribute of thanksgiving and of praise. I implore thee to secure for me through thy powerful intercession the inestimable blessing of living and dying in the state of grace. I also beseech thee to obtain for me the favour I ask in this novena. (State your intention.) But if what I ask is not for the glory of God and for the good of my soul, do thou obtain for me what is more conducive to both. Amen.";

const RITA_PRAYER =
  "O holy patroness of those in need, St. Rita, whose pleadings before thy Divine Lord are almost irresistible, who for thy lavishness in granting favours hast been called the Advocate of the hopeless and even of the impossible; St. Rita, so humble, so pure, so mortified, so patient and of such compassionate love for thy Crucified Jesus that thou couldst obtain from Him whatsoever thou askest, on account of which all confidently have recourse to thee expecting, if not always relief, at least comfort; be propitious to our petition, showing thy power with God on behalf of thy suppliant; be lavish to us, as thou hast been in so many wonderful cases, for the greater glory of God, for the spreading of thine own devotion, and for the consolation of those who trust in thee. We promise, if our petition is granted, to glorify thee by making known thy favour, to bless and sing thy praises forever. Relying then upon thy merits and power before the Sacred Heart of Jesus, we pray thee grant that (state your intention) as soon as God deems fit. Amen.";

const PEREGRINE_PRAYER =
  "Glorious wonder-worker, St. Peregrine, you answered the divine call with a ready spirit, and forsook all the comforts of a life of ease and all the empty honors of the world to dedicate yourself to God in the Order of His holy Mother. You labored manfully for the salvation of souls. In union with Jesus crucified, you endured painful sufferings with such patience as to deserve to be healed miraculously of an incurable cancer in your leg by a touch of His divine hand. Obtain for me the grace to answer every call of God and to fulfill His will in all the events of life. Enkindle in my heart a consuming zeal for the salvation of all men. Deliver me from the infirmities that afflict my body. (State your need.) Obtain for me also a perfect resignation to the sufferings it may please God to send me, so that, imitating our crucified Savior and His sorrowful Mother, I may merit eternal glory in heaven. St. Peregrine, pray for me and for all who invoke your aid.";

const GERARD_PRAYER =
  "Most Blessed Trinity, I, Your child, thank You for all the gifts and privileges which You granted to St. Gerard, especially for those virtues with which You adorned him on earth and the glory which You now impart to him in heaven. Accomplish Your work, O Lord, so that Your kingdom may come about on earth. Through his merits, in union with those of Jesus and Mary, grant me the grace for which I ask. (Mention your request.) And you, my powerful intercessor, St. Gerard, always so ready to help those who have recourse to you, pray for me. Come before the throne of Divine Mercy and do not leave without being heard. To you I confide this important and urgent affair. Graciously take my cause in hand and do not let me end this novena without having experienced in some way the effects of your intercession. Amen.";

const FRANCIS_ASSISI_PRAYER =
  'Glorious Saint Francis, who voluntarily renounced all the comforts and riches of your home to follow more perfectly the life of poverty and abnegation of Jesus Christ: obtain for us, we pray, a generous contempt of all things in this world, that we may secure the true and eternal things of heaven. Glory be to the Father. O glorious Saint Francis, who during the whole course of your life continually wept over the passion of the Redeemer, and laboured most zealously for the salvation of souls: obtain for us, we pray, the grace of weeping continually over those sins by which we have crucified afresh Our Lord Jesus Christ, that we may attain to be of the number of those who shall eternally bless His supreme mercy. Glory be to the Father. O glorious Saint Francis, who, loving above all things suffering and the cross, merited to bear in your body the miraculous stigmata, by which you became a living image of Jesus Christ crucified: obtain for us, we pray, the grace to bear in our bodies the mortifications of Christ, that we may merit one day to receive the consolations which are infallibly promised to all those who now weep. "If we be dead with Christ Jesus, we shall live also with Him," says the Apostle; "if we suffer, we shall also reign with Him." Pray for us, Saint Francis, that we may obtain the graces and favours we ask for in this novena; pray for us, especially, that we may obtain the grace of perseverance, of a holy death and a happy eternity.';

const BENEDICT_PRAYER =
  "Glorious Saint Benedict, sublime model of virtue, pure vessel of God's grace! Behold me humbly kneeling at your feet. I implore you in your loving kindness to pray for me before the throne of God. To you I have recourse in the dangers that daily surround me. Shield me against my selfishness and my indifference to God and to my neighbor. Inspire me to imitate you in all things. May your blessing be with me always, so that I may see and serve Christ in others and work for His kingdom. Graciously obtain for me from God those favors and graces which I need so much in the trials, miseries and afflictions of life. Your heart was always full of love, compassion and mercy toward those who were afflicted or troubled in any way. You never dismissed without consolation and assistance anyone who had recourse to you. I therefore invoke your powerful intercession, confident in the hope that you will hear my prayers and obtain for me the special grace and favor I earnestly implore. (State your intention.) Help me, great Saint Benedict, to live and die as a faithful child of God, to run in the sweetness of His loving will, and to attain the eternal happiness of heaven. Amen.";

const PATRICK_PRAYER =
  "Blessed Saint Patrick, glorious Apostle of Ireland, who didst become a friend and father to me for ages before my birth, hear my prayer and accept, for God, the sentiments of gratitude and veneration with which my heart is filled. Through thee I have inherited that faith which is dearer than life. I now make thee the representative of my thanks, and the mediator of my homage to Almighty God. Most holy Father and patron of my country, despise not my weakness; remember that the cries of little children were the sounds that rose, like a mysterious voice from heaven, and invited thee to come amongst us. Listen, then, to my humble supplication; may my prayer ascend to the throne of God, with the praises and blessings which shall ever sanctify thy name and thy memory. May my hope be animated by the patronage and intercession of our forefathers, who now enjoy eternal bliss and owe their salvation, under God, to thy courage and charity. Obtain for me grace to love God with my whole heart, to serve Him with my whole strength, and to persevere in good purposes to the end. O faithful shepherd of the Irish flock, who wouldst have laid down a thousand lives to save one soul, take my soul, and the souls of my countrymen, under thy special care. Be a father to the Church of Ireland and her faithful people. Grant that all hearts may share the blessed fruits of that Gospel thou didst plant and water. Grant that, as our ancestors of old had learned, under thy guidance, to unite science with virtue, we too may learn, under thy patronage, to consecrate all Christian duty to the glory of God. I commend to thee my native land, which was so dear to thee while on earth. Protect it still, and, above all, direct its chief pastors, particularly those who teach us. Give them grace to walk in thy footsteps, to nurture the flock with the word of life and the bread of salvation, and to lead the heirs of the Saints thou hast formed to the possession of that glory which they, with thee, enjoy in the kingdom of the Blessed: through Christ Jesus, our Lord. Amen.";

const FIFTY_FOUR_JOYFUL =
  "Hail, Queen of the Most Holy Rosary, my Mother Mary, hail! At thy feet I humbly kneel to offer thee a Crown of Roses, snow white buds to remind thee of thy joys. Each bud recalling to thee a holy mystery. Each ten bound together with my petition for a particular grace. O Holy Queen, dispenser of God's graces, and Mother of all who invoke thee, thou canst not look upon my gift and fail to see its binding. As thou receivest my gift, so wilt thou receive my petition; from thy bounty thou wilt give me the favor I so earnestly and trustingly seek. I despair of nothing that I ask of thee. Show thyself my Mother!";

const FIFTY_FOUR_SORROWFUL =
  "Hail, Queen of the Most Holy Rosary, my Mother Mary, hail! At thy feet I humbly kneel to offer thee a Crown of Roses, blood red roses to remind thee of the passion of thy divine Son, with Whom thou didst so fully partake of its bitterness. Each rose recalling to thee a holy mystery. Each ten bound together with my petition for a particular grace. O Holy Queen, dispenser of God's graces, and Mother of all who invoke thee! Thou canst not look upon my gift and fail to see its binding. As thou receivest my gift, so wilt thou receive my petition; from thy bounty thou wilt give me the favor I so earnestly and trustingly seek. I despair of nothing that I ask of thee. Show thyself my Mother!";

const FIFTY_FOUR_GLORIOUS =
  "Hail, Queen of the Most Holy Rosary, my Mother Mary, hail! At thy feet I humbly kneel to offer thee a Crown of Roses, full-blown white roses, tinged with the red of the passion, to remind thee of thy glories, fruits of the sufferings of thy Son and thee. Each rose recalling to thee a holy mystery. Each ten bound together with my petition for a particular grace. O Holy Queen, dispenser of God's graces, and Mother of all who invoke thee! Thou canst not look upon my gift and fail to see its binding. As thou receivest my gift, so wilt thou receive my petition; from thy bounty thou wilt give me the favor I so earnestly and trustingly seek. I despair of nothing that I ask of thee. Show thyself my Mother!";

/**
 * Builds the nine days of a novena whose received form repeats a single prayer
 * on every day. The day-by-day distinction is the meditation subject, which is
 * editorial; the prayer is the received text, unaltered.
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

export const novenaGroupTwo: CuratedEntry[] = [
  {
    contentType: "NOVENA",
    slug: "novena-christmas-saint-alphonsus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_CHRISTMAS, NA_CHRISTMAS],
    payload: {
      slug: "novena-christmas-saint-alphonsus",
      title: "Christmas Novena (Saint Alphonsus Liguori)",
      summary:
        "The nine days before Christmas kept with the nine meditations and prayers St. Alphonsus Liguori wrote for the Nativity. Each day sets one aspect of the Incarnation before the mind — that God became man, that He became an infant, that He was born poor, humiliated, sorrowful — and closes with the saint's own affection and prayer. A devotional novena for private and family use, not a liturgical rite.",
      background:
        "St. Alphonsus Liguori (1696-1787), founder of the Redemptorists and Doctor of the Church, wrote this novena in the same manner as his novena of the Holy Spirit: a 'Thought' to be pondered and a 'Prayer' to be said. It is ordinarily begun on 16 December, the day the Roman liturgy itself turns wholly toward the Nativity with the late Advent ferias. In many editions the prayer of the St. Andrew Christmas novena is printed at its head and said with it; the two devotions are distinct and may be kept together or apart. The meditations given here are short editorial introductions to the subject St. Alphonsus assigns each day; his own meditations and the prayers below are in the cited source.",
      intentionTheme:
        "preparing the heart to receive the Word made flesh, and love in return for the love that brought Him down",
      days: [
        {
          day: 1,
          title: "God's Love Revealed in His Becoming Man",
          meditation:
            "The Son of God saw man lost by Adam's sin and offered to take our nature and to die a criminal's death rather than leave us in it. St. Alphonsus imagines the Father setting out the whole cost — the stable, the flight into Egypt, the workshop, the cross — and the Son answering that all this matters not, if only He can save man. Consider what it means that the eternal Word chose to become what we are.",
          prayerText:
            "O Great Son of God, Thou hast become man in order to make Thyself loved by men. But where is the love that men give Thee in return? Thou hast given Thy life blood to save our souls. Why then are we so unappreciative that, instead of repaying Thee with love, we spurn Thee with ingratitude? And I, Lord, I myself more than others have thus ill treated Thee. But Thy Passion is my hope. For the sake of that love which led Thee to take upon Thyself human nature and to die for me on the cross, forgive me all the offenses I have committed against Thee. I love Thee, O Word Incarnate; I love Thee, O infinite goodness. Out of love for Thee, would that I could die of grief for these offenses. Give me, O Jesus, Thy love. Let me no longer live in ungrateful forgetfulness of the love Thou bearest me. I wish to love Thee always. Grant that I may always persevere in this holy desire. O Mary, Mother of God and my Mother, pray for me that thy Son may give me the grace to love Him always, unto death. Amen.",
          intentionPrompt:
            "What has God's coming in the flesh actually cost Him, and what has it cost me to receive it?",
        },
        {
          day: 2,
          title: "God's Love Revealed in His Being Born an Infant",
          meditation:
            "He could have appeared on earth full-grown, as Adam was created. He chose instead to come as the poorest and most pitiful infant ever born, because, as St. Peter Chrysologus says, He wished to teach us to love Him and not to fear Him. He who kindles the seraphim shivers in a stable; He who feeds every creature needs a little milk.",
          prayerText:
            "O Dearest Infant! Tell me, what hast Thou come on earth to do? Tell me, whom art Thou seeking? Yes, I already know. Thou hast come to die for me, in order to save me from hell. Thou hast come to seek me, the lost sheep, so that, instead of fleeing from Thee any more, I may rest in Thy loving arms. Ah my Jesus, my treasure, my life, my love and my all! Whom will I love, if not Thee? Where can I find a father, a friend, a spouse more loving and lovable than Thou art? I love Thee, my dear God; I love Thee, my only good. I regret the many years when I have not loved Thee, but rather spurned and offended Thee. Forgive me, O my beloved Redeemer; for I am sorry that I have thus treated Thee, and I regret it with all my heart. Pardon me, and give me the grace never more to withdraw from Thee, but constantly to love Thee in all the years that still lie before me in this life. My love, I give myself entirely to Thee; accept me, and do not reject me as I deserve. O Mary, thou art my advocate. By thy prayers thou dost obtain whatever thou wilt from thy Son. Pray Him then to forgive me, and to grant me holy perseverance until death. Amen.",
          intentionPrompt:
            "Do I approach God as one to be feared, or as the Child who came to be loved?",
        },
        {
          day: 3,
          title: "The Life of Poverty Which Jesus Led from His Birth",
          meditation:
            "Turned away from the inn and from the houses of Bethlehem, Joseph and Mary spent that night in a cave used as a stable, and there the King of heaven was born, with prickly straw for a mattress and a manger for a cradle. Enter the cave with faith: without it you see only a poor infant; with it you see the Son of God paying the penalty of your sins.",
          prayerText:
            "O Dear Infant Jesus, how could I be so ungrateful and offend Thee so often, if I realized how much Thou hast suffered for me? But these tears which Thou sheddest, this poverty which Thou embracest for love of me, make me hope for the pardon of all the offenses I have committed against Thee. My Jesus, I am sorry for having so often turned my back on Thee. But now I love Thee above all else. My God and my all! From now on Thou, O my God, shalt be my only treasure and my only good. With Saint Ignatius of Loyola I will say to Thee, Give me the grace to love Thee; that is enough for me. I long for nothing else; I want nothing else. Thou alone art enough for me, my Jesus, my life, my love. O Mary, my Mother, obtain for me the grace that I may always love Jesus and always be loved by Him. Amen.",
          intentionPrompt:
            "What comfort am I unwilling to give up for the sake of the poor Christ?",
        },
        {
          day: 4,
          title: "The Life of Humiliation Which Jesus Led from His Birth",
          meditation:
            "The sign given the shepherds was itself a lowliness: an infant in swaddling clothes lying in a feeding trough. The King of heaven chose that beginning because He came to destroy the pride that had ruined man, and He carried it to the end — scourged like a slave, mocked as a king, and left to die between two thieves.",
          prayerText:
            "O Dearest Savior, Thou hast embraced so many outrages for love of me, yet I have not been able to bear one word of insult without at once being filled with resentful thought, I who have so often deserved to be trodden under foot by the demons in hell! I am ashamed to appear before Thee, sinful and proud as I am. Yet do not drive me from Thy presence, O Lord, even though that is what I deserve. Thou hast said that Thou wilt not spurn a contrite and humbled heart. I am sorry for the offenses I have committed against Thee. Forgive me, O Jesus. I will not offend Thee again. For love of me Thou hast borne so many injuries; for love of Thee I will bear all the injuries that are done to me. I love Thee, Jesus, who wast despised for love of me. I love Thee above every other good. Give me the grace to love Thee always and to bear every insult for love of Thee. O Mary, recommend me to thy Son; pray to Jesus for me. Amen.",
          intentionPrompt: "What slight am I still nursing that Christ bore a thousand times over?",
        },
        {
          day: 5,
          title: "The Life of Sorrow Which Jesus Led from His Birth",
          meditation:
            "Isaiah called Him a man of sorrows, and His Passion did not begin a few hours before His death but at the first moment of His birth. What afflicted Him most was not the cold or the cave but the sight of our sins, by which we repaid His love. St. Margaret of Cortona could not stop weeping for hers, knowing they had kept her Lord in pain all His life.",
          prayerText:
            "O Jesus, my sweet Love! I too have kept Thee suffering through all Thy life. Tell me, then, what I must do in order to win Thy forgiveness. I am ready to do all Thou askest of me. I am sorry, O sovereign Good, for all the offenses I have committed against Thee. I love Thee more than myself, or at least I feel a great desire to love Thee. Since it is Thou who hast given me this desire, do Thou also give me the strength to love Thee exceedingly. It is only right that I, who have offended Thee so much, should love Thee very much. Always remind me of the love Thou hast borne me, in order that my soul may ever burn with love of Thee and long to please Thee alone. O God of love, I, who was once a slave of hell, now give myself all to Thee. Graciously accept me and bind me to Thee with the bonds of Thy love. My Jesus, from this day and forever in loving Thee will I live, and in loving Thee will I die. O Mary, my Mother and my hope, help me to love thy dear God and mine. This is the only favor I ask of thee, and through thee I hope to receive it. Amen.",
          intentionPrompt:
            "Am I sorry for my sins because of their cost to me, or because of their cost to Him?",
        },
        {
          day: 6,
          title: "God's Mercy Revealed in His Coming Down from Heaven to Save Us",
          meditation:
            "God's power appeared in creating the world and His wisdom in sustaining it, but His mercy appeared, says St. Bernard, in taking our nature to save us by His death. He would not send an angel to redeem us, for He desired the whole of our hearts: having been our Creator, He wished also to be our Redeemer.",
          prayerText:
            "O my Dear Redeemer! Where should I be now, if Thou hadst not borne with me so patiently, but hadst called me from life while I was in the state of sin? Since Thou hast waited for me till now, forgive me quickly, O my Jesus, before death finds me still guilty of so many offenses that I have committed against Thee. I am so sorry for having vilely despised Thee, my sovereign Good, that I could die of grief. But Thou canst not abandon a soul that seeks Thee. If hitherto I have forsaken Thee, I now seek Thee and love Thee. Yes, my God, I love Thee above all else; I love Thee more than myself. Help me, Lord, to love Thee always during the rest of my life. Nothing else do I seek of Thee. But this I beg of Thee, this I hope to receive from Thee. Mary, my hope, do thou pray for me. If thou prayest for me, I am sure of grace. Amen.",
          intentionPrompt:
            "How patiently has God waited for me, and what am I doing with the time He has given?",
        },
        {
          day: 7,
          title: "The Flight of the Child Jesus into Egypt",
          meditation:
            "Scarcely born, He is hunted. Joseph is warned in a dream, takes the tools of his trade, and sets out that same night; Mary wraps a small bundle of clothes and weeps over the sleeping Child. They cross the desert with nights in the open and the bare ground for a bed, and the Son of God is a fugitive on earth.",
          prayerText:
            "Dear Infant Jesus, crying so bitterly! Well hast Thou reason to weep in seeing Thyself persecuted by men whom Thou lovest so much. I, too, O God, have once persecuted Thee by my sins. But Thou knowest that now I love Thee more than myself, and that nothing pains me more than the thought that I have so often spurned Thee, my sovereign Good. Forgive me, O Jesus, and let me bear Thee with me in my heart in all the rest of the journey that I have still to make through life, so that together with Thee I may enter into eternity. So often have I driven Thee from my soul by my sins. But now I love Thee above all things, and I regret above other misfortunes that I have offended Thee. I wish to leave Thee no more, my beloved Lord. But do Thou give me the strength to resist temptations. Never permit me to be separated from Thee again. Let me rather die than ever again lose Thy good grace. O Mary, my hope, make me always live in God's love and then die in loving Him. Amen.",
          intentionPrompt:
            "Who near me is a stranger or a refugee, and what does the flight into Egypt ask of me for them?",
        },
        {
          day: 8,
          title: "The Life of the Child Jesus in Egypt and in Nazareth",
          meditation:
            "In Egypt they were foreigners without relatives or friends, earning their bread with difficulty; there Mary made His first garments, there He took His first steps and spoke His first words. Back in Nazareth He lived thirty years as a workman in a carpenter's shop, subject to Joseph and Mary. God Himself, serving as an apprentice.",
          prayerText:
            "O Jesus, my Savior! When I consider how, for love of me, Thou didst spend thirty years of Thy life hidden and unknown in a poor workshop, how can I desire the pleasures and honors and riches of the world? Gladly do I renounce all these things, since I wish to be Thy companion on this earth, poor as Thou wast, mortified and humble as Thou wast, so that I may hope to be able one day to enjoy Thy companionship in heaven. What are all the treasures and kingdoms of this world? Thou, O Jesus, art my only treasure, my only Good! I keenly regret the many times in the past when I spurned Thy friendship in order to satisfy my foolish whims. I am sorry for them with all my heart. For the future I would rather lose my life a thousand times than lose Thy grace by sin. I wish never to offend Thee again, but always to love Thee. Help me to remain faithful to Thee until death. O Mary, thou art the refuge of sinners, thou art my hope. Amen.",
          intentionPrompt:
            "Can I be content, as He was, with thirty years of hidden and unnoticed work?",
        },
        {
          day: 9,
          title: "The Birth of Jesus in the Stable of Bethlehem",
          meditation:
            "On Christmas Eve the novena comes to the cave itself. Driven from the houses and the inn, Mary enters, and when Joseph grieves that she must give birth in such a place she answers that this cave is the royal palace in which the King of kings wishes to be born. Kneeling in prayer she sees the cave filled with light, and her Son lying before her.",
          prayerText:
            "O Adorable Infant Jesus! I should not have the boldness to cast myself at Thy feet, if I did not know that Thou Thyself invitest me to draw near Thee. It is I who by my sins have made Thee shed so many tears in the stable of Bethlehem. But since Thou hast come on earth to pardon repentant sinners, forgive me also, now that I am heartily sorry for having spurned Thee, my Savior and my God, who art so good and who hast loved me so much. In this night, in which Thou bestowest great graces on so many souls, grant Thy heavenly consolation to this poor soul of mine also. All that I ask of Thee is the grace to love Thee always, from this day forward, with all my heart. Set me all on fire with Thy holy love. I love Thee, O my God, who hast become a Babe for love of me. Never let me cease from loving Thee ever more. O Mary, Mother of Jesus and my Mother, thou canst obtain everything from thy Son by thy prayers. This is the only favor I ask of thee. Do thou pray to Jesus for me. Amen.",
          intentionPrompt:
            "What one grace do I most want to carry out of the stable and into the new year?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-alphonsus-liguori",
      typicalStartDate: "16 December, ending on Christmas Eve",
      relatedFeastSlug: "solemnity-christmas",
      citations: [CD_CHRISTMAS, NA_CHRISTMAS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-andrew-christmas",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_ANDREW, NA_ANDREW],
    payload: {
      slug: "novena-saint-andrew-christmas",
      title: "Saint Andrew Christmas Novena",
      summary:
        "A single short prayer honouring the hour of Christ's birth, said fifteen times a day from the feast of St. Andrew on 30 November until Christmas. It is called a novena by custom rather than by arithmetic: it runs twenty-five days, not nine, and takes its name from the day it begins rather than from any authorship by the apostle.",
      background:
        "The prayer is an old devotional text of unknown authorship, printed in English with the imprimatur of Archbishop Michael Augustine Corrigan of New York, 6 February 1897. It is a private devotion, not a liturgical office, and the Church attaches no promise to it: the note that accompanies the prayer in the old books says only that it is piously believed that whoever recites it will obtain what is asked, which is a report of popular confidence and not a guarantee. The received form gives one prayer, not nine; the nine subjects below are an editorial way of keeping the long Advent stretch fruitful, and the prayer itself is unaltered on every day.",
      intentionTheme:
        "keeping Advent by returning again and again to the hour and moment of the Nativity, with one intention held before God",
      days: repeatedPrayerDays(ANDREW_PRAYER, [
        {
          title: "The Hour and the Moment",
          meditation:
            "The prayer fixes on a point in time: an hour, a moment, at midnight, in Bethlehem. Advent is the season for learning that God acts in real time and in real places, and that He asks us to wait through them.",
          intentionPrompt:
            "What intention will I hold before God through the whole of Advent this year?",
        },
        {
          title: "Born of the Most Pure Virgin",
          meditation:
            "The prayer names the Mother before it names the request. Everything asked in this devotion is asked through the merits of Christ and of the Blessed Mother who gave Him His human nature.",
          intentionPrompt: "Have I asked Our Lady to carry this intention with me?",
        },
        {
          title: "In Piercing Cold",
          meditation:
            "The received text refuses to prettify the Nativity. Cold, a stable, the middle of the night: God enters our poverty at its least comfortable point, which is why the poor have always found Him easy to approach.",
          intentionPrompt:
            "Where is my life cold and unlovely, and can I let Christ be born there?",
        },
        {
          title: "Fifteen Times a Day",
          meditation:
            "The devotion asks for repetition, and repetition is its whole discipline. Fifteen times daily for twenty-five days is a small penance that fits inside an ordinary working life and teaches the habit of turning to God without waiting for a free hour.",
          intentionPrompt:
            "When in my day can I actually stop and pray, rather than when I would like to?",
        },
        {
          title: "Vouchsafe to Hear My Prayer",
          meditation:
            "The petition is confident but not presumptuous. It asks God to hear, and grounds the asking in the merits of Christ, never in the number of repetitions or in any promise attached to the prayer.",
          intentionPrompt:
            "Am I trusting in Christ's merits, or quietly trusting in my own persistence?",
        },
        {
          title: "Through the Merits of Our Saviour",
          meditation:
            "Every Christian prayer is offered through Christ. The novena's plain closing clause keeps the devotion from drifting into superstition: it is His redemption, not the formula, that opens the Father's hand.",
          intentionPrompt:
            "Do I treat any prayer as a technique rather than as speaking to a Father?",
        },
        {
          title: "Advent Patience",
          meditation:
            "Twenty-five days is long enough to grow tired. The saints treat that weariness as the point: perseverance in a dry prayer is worth more than fervour in an easy one.",
          intentionPrompt: "Will I keep this up on the day it feels pointless?",
        },
        {
          title: "With Saint Andrew",
          meditation:
            "The devotion begins on the feast of the apostle who first brought his brother to Christ. It is fitting to carry another person's need in this novena, as Andrew carried Simon.",
          intentionPrompt: "Whom should I be bringing to Christ, as Andrew brought Peter?",
        },
        {
          title: "Until Christmas",
          meditation:
            "The novena ends not on a ninth day but at the crib. Whatever has been asked, the devotion closes by putting the one who prayed in front of the Child who was the answer before the question was formed.",
          intentionPrompt: "If my request is not granted, will I still keep Christmas with joy?",
        },
      ]),
      durationDays: 25,
      structure: "daily_until_feast",
      associatedSaintSlug: "saint-andrew-the-apostle",
      typicalStartDate:
        "30 November, the feast of Saint Andrew, continuing daily until Christmas Eve",
      relatedFeastSlug: "solemnity-christmas",
      citations: [CD_ANDREW, NA_ANDREW],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-fifty-four-day-rosary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CRUSADE_FIFTY_FOUR, CD_FIFTY_FOUR, ROSARIUM_VIRGINIS_MARIAE],
    payload: {
      slug: "novena-fifty-four-day-rosary",
      title: "The Fifty-Four Day Rosary Novena",
      summary:
        "Six nine-day novenas of the Rosary prayed back to back: three in petition and three in thanksgiving, fifty-four days in all. One Rosary is said each day, the mysteries rotating Joyful, Sorrowful and Glorious in turn, and each Rosary is opened with the received prayer offering Our Lady a crown of roses. The thanksgiving half is prayed whether or not the favour has been granted.",
      background:
        "The devotion is associated with the shrine of Our Lady of the Rosary at Pompeii and with the healing of Fortuna Agrelli in 1884, in which Our Lady is reported to have asked for three novenas of the Rosary in petition and three in thanksgiving. The apparition is a private revelation; no Catholic is bound to believe it, and the Church proposes the Rosary itself, not the report, as the reason for praying. The received opening prayer varies with the mystery set — snow-white buds for the Joyful, blood-red roses for the Sorrowful, full-blown white roses tinged with the red of the passion for the Glorious — and the nine days below are one full turn of that rotation, repeated six times. From the twenty-eighth day the same prayer is said in the thanksgiving form: 'At thy feet I gratefully kneel to offer thee a Crown of Roses... As thou receivest my gift, so wilt thou receive my thanksgiving; from thy bounty thou hast given me the favor I so earnestly and trustingly sought. I despaired not of what I asked of thee, and thou hast truly shown thyself my Mother.'",
      intentionTheme:
        "one grave intention carried through the whole mystery of Christ in the Rosary, and thanksgiving offered before the answer is seen",
      days: [
        {
          day: 1,
          title: "The Joyful Mysteries: A Crown of Snow-White Buds",
          meditation:
            "The first day of each nine opens with the Joyful Mysteries, from the Annunciation to the finding in the Temple. The petition prayer offers Our Lady white buds for her joys, and binds each decade to a particular grace asked of God.",
          prayerText: FIFTY_FOUR_JOYFUL,
          intentionPrompt: "Can I name my intention plainly, in one sentence, before God?",
        },
        {
          day: 2,
          title: "The Sorrowful Mysteries: A Crown of Blood-Red Roses",
          meditation:
            "The second day turns to the Agony in the Garden and what follows. The prayer changes its flowers to blood-red roses and its subject to the Passion of Christ, in whose bitterness His Mother so fully shared.",
          prayerText: FIFTY_FOUR_SORROWFUL,
          intentionPrompt: "What part of my intention involves suffering I would rather not name?",
        },
        {
          day: 3,
          title: "The Glorious Mysteries: A Crown of Full-Blown White Roses",
          meditation:
            "The third day rises with the Resurrection. The roses are white again but tinged with the red of the passion, because Our Lady's glories are the fruit of her Son's sufferings and of her own.",
          prayerText: FIFTY_FOUR_GLORIOUS,
          intentionPrompt:
            "Do I believe that what I am asking for is small next to the glory promised me?",
        },
        {
          day: 4,
          title: "The Joyful Mysteries Again",
          meditation:
            "The rotation returns to the Joyful Mysteries. Repetition is the discipline of this novena: the same mysteries, the same prayer, the same intention, until the praying has changed the one who prays.",
          prayerText: FIFTY_FOUR_JOYFUL,
          intentionPrompt: "Has my intention shifted since the first day, and if so, why?",
        },
        {
          day: 5,
          title: "The Sorrowful Mysteries Again",
          meditation:
            "Halfway through the nine, the Passion is set before the mind a second time. Bringing a request to the Crucified guards it from becoming a demand.",
          prayerText: FIFTY_FOUR_SORROWFUL,
          intentionPrompt: "Am I willing for God to answer this in a way I did not ask for?",
        },
        {
          day: 6,
          title: "The Glorious Mysteries Again",
          meditation:
            "The Glorious Mysteries end at the crowning of Our Lady, which is why the prayer calls her Queen of the Most Holy Rosary. It is to a queen with real access to the King that the petition is entrusted.",
          prayerText: FIFTY_FOUR_GLORIOUS,
          intentionPrompt: "Whom else should I be carrying in this Rosary besides myself?",
        },
        {
          day: 7,
          title: "The Joyful Mysteries a Third Time",
          meditation:
            "The last turn of the rotation begins. St. John Paul II calls the Rosary a compendium of the Gospel; by the third round its scenes have begun to lodge in the memory and to interpret the day's events.",
          prayerText: FIFTY_FOUR_JOYFUL,
          intentionPrompt: "Which mystery is God using to speak to me in this novena?",
        },
        {
          day: 8,
          title: "The Sorrowful Mysteries a Third Time",
          meditation:
            "The devotion asks for perseverance more than for fervour. If the Rosary has grown dry, that dryness is itself an offering, and the received prayer is said no differently.",
          prayerText: FIFTY_FOUR_SORROWFUL,
          intentionPrompt: "What will I do on the days when this feels like nothing at all?",
        },
        {
          day: 9,
          title: "The Glorious Mysteries a Third Time",
          meditation:
            "One nine-day novena closes and the next begins the following day without a break. After twenty-seven days of petition come twenty-seven of thanksgiving, offered whether or not the favour has yet been given — which is the heart of this devotion and its chief school of faith.",
          prayerText: FIFTY_FOUR_GLORIOUS,
          intentionPrompt: "Can I thank God for an answer I have not yet seen?",
        },
      ],
      durationDays: 54,
      structure: "fifty_four_days",
      associatedDevotionSlug: "holy-rosary",
      associatedMarianTitleSlug: "our-lady-of-pompeii",
      typicalStartDate:
        "Any time; often begun so that the fifty-fourth day falls on a Marian feast",
      citations: [CRUSADE_FIFTY_FOUR, CD_FIFTY_FOUR, ROSARIUM_VIRGINIS_MARIAE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-holy-family",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_HOLY_FAMILY, FAMILIARIS_CONSORTIO],
    payload: {
      slug: "novena-holy-family",
      title: "Novena to the Holy Family",
      summary:
        "Nine days of prayer to Jesus, Mary and Joseph for one's own household, kept in the days before the feast of the Holy Family at the end of the Christmas octave. The received novena is a single set of petitions repeated daily, each asking for a grace the family is meant to hand on: love of the Church, courage in professing the faith, charity at home, and obedience to God's law.",
      background:
        "The devotion belongs to the family consecrations encouraged by Leo XIII and his successors, who set the household of Nazareth before Christian families as their model and patron. It is a private devotion. The prayer below is said in full on each of the nine days; the received form gives no separate day-texts, so the day-by-day subjects here are editorial and the prayer is unchanged. A dedication of one's family and a closing prayer for perseverance are printed with it in the cited source and may be added.",
      intentionTheme: "the peace, unity and holiness of one's own household",
      days: repeatedPrayerDays(HOLY_FAMILY_PRAYER, [
        {
          title: "A Household Under God",
          meditation:
            "Nazareth was an ordinary house with ordinary work in it, and it was holy because God was at its centre. The novena begins by asking that this family, with its actual members and its actual failings, be placed under His rule.",
          intentionPrompt:
            "Who in my household most needs prayer right now, and have I named them?",
        },
        {
          title: "Loving the Church Above Every Earthly Thing",
          meditation:
            "The first petition asks for love of the Church shown by deeds, not sentiment. Families keep the faith alive chiefly by what they do on Sunday and how they speak of the Church on Monday.",
          intentionPrompt:
            "What do my children or housemates learn about the Church from how I speak of her?",
        },
        {
          title: "Professing the Faith Without Human Respect",
          meditation:
            "Human respect is the fear of looking foolish. The second petition asks for the courage to be openly Catholic among people who are not, which is often harder inside a family than outside it.",
          intentionPrompt:
            "Where am I quiet about my faith out of embarrassment rather than prudence?",
        },
        {
          title: "Defending and Spreading the Faith",
          meditation:
            "The third petition is willing to count the cost — by word, or by the sacrifice of possessions and of life. Most families are asked for far less, but the willingness has to be real before the small sacrifices come easily.",
          intentionPrompt:
            "What would I actually give up for the faith if it were asked of me this year?",
        },
        {
          title: "Mutual Charity at Home",
          meditation:
            "The fourth petition asks for harmony of thought, will and action. Charity at home is tested not in crises but in the daily friction of shared space, and it is the part of holiness a family cannot fake.",
          intentionPrompt: "With whom under this roof do I need to make peace?",
        },
        {
          title: "Conforming Life to God's Commandments",
          meditation:
            "The fifth petition asks that the household's life be shaped by the commandments of God and of the Church, so as to live always in the charity they set forth. Law and love are not rivals here; the law names what love looks like.",
          intentionPrompt: "Which commandment does my household treat as optional?",
        },
        {
          title: "Jesus, the Centre of the Home",
          meditation:
            "Every petition begins by naming Jesus first. A Christian home is not a well-run house with prayers added; it is a house whose ordering is decided by Christ.",
          intentionPrompt:
            "If a stranger watched us for a week, would they guess that Christ lives here?",
        },
        {
          title: "Mary, the Mother of the House",
          meditation:
            "Mary's part at Nazareth was hidden and constant. Families ask her for the ordinary virtues — patience, attention, the willingness to be interrupted — that hold a household together.",
          intentionPrompt: "What small, unnoticed service can I do today without being asked?",
        },
        {
          title: "Joseph, the Guardian",
          meditation:
            "Joseph provided, protected and said nothing that Scripture records. On the last day the novena asks his protection for the family's work, its safety and its future, and commends it to the companionship of the Holy Family in heaven.",
          intentionPrompt: "What am I responsible for protecting, and have I been doing it?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-joseph",
      typicalStartDate:
        "The nine days before the Feast of the Holy Family, in the Christmas octave",
      relatedFeastSlug: "feast-holy-family",
      citations: [CD_HOLY_FAMILY, FAMILIARIS_CONSORTIO],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-holy-souls-in-purgatory",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_HOLY_SOULS, SPE_SALVI, NA_PURGATORY],
    payload: {
      slug: "novena-holy-souls-in-purgatory",
      title: "Novena for the Holy Souls in Purgatory",
      summary:
        "Nine days of prayer for the faithful departed who are being purified before entering the joy of heaven, customarily kept from 24 October to All Saints so that it ends as the Church begins the month of the dead. The received prayer asks the Holy Souls' intercession and offers them, in return, the satisfactory value of one's prayers, work, joys and sufferings.",
      background:
        "The Church teaches that those who die in God's grace but imperfectly purified undergo a purification so as to achieve the holiness needed to enter heaven, and that the living can help them by prayer, almsgiving, indulgences and above all the Sacrifice of the Mass. This is a devotional novena, not a liturgical rite; its proper season is the days around All Souls, 2 November, when a plenary indulgence applicable only to the departed is attached to visiting a cemetery under the usual conditions. The received form repeats one prayer daily, so the day-by-day subjects below are editorial and the prayer is unaltered. The cited source rightly adds that assisting at Mass and having a Mass offered for them are the most powerful helps of all.",
      intentionTheme:
        "the relief and swift entry into glory of the souls being purified, and preparation for one's own death",
      days: repeatedPrayerDays(HOLY_SOULS_PRAYER, [
        {
          title: "Certain Heirs of Heaven",
          meditation:
            "The Holy Souls are not in danger; they are saved, and their purification is the last work of God's mercy in them. Praying for them is an act of charity toward people whose salvation is already secure and whose gratitude is certain.",
          intentionPrompt: "Whose name from my own family shall I carry through these nine days?",
        },
        {
          title: "Trophies of the Precious Blood",
          meditation:
            "Every soul in purgatory was bought at the price of Christ's blood. Their purification is not a punishment added to the redemption but the redemption completing its work in them.",
          intentionPrompt:
            "Do I really believe that God's mercy has the last word over the people I have lost?",
        },
        {
          title: "The Communion of Saints",
          meditation:
            "The Church on earth, the Church being purified and the Church in glory are one body. Prayer for the dead is not a message shouted across a gap; it is help passed between members of a single household.",
          intentionPrompt: "Have I let death cut me off from someone I could still be helping?",
        },
        {
          title: "The Most Forsaken",
          meditation:
            "The old prayers make a point of the souls nobody remembers — those with no family left to pray, and those whose release is most remote. Charity here reaches exactly where it can expect nothing back.",
          intentionPrompt: "Will I pray today for someone whose name I will never know?",
        },
        {
          title: "Those Who Have Offended Me",
          meditation:
            "The received novenas for the dead deliberately include those who wronged us. Praying for the eternal good of an enemy is one of the surest signs that a grudge has actually been surrendered.",
          intentionPrompt: "Is there someone dead whom I have never forgiven?",
        },
        {
          title: "Offering My Own Day",
          meditation:
            "The prayer offers the Holy Souls the satisfactory merits of one's prayer and work, joys and sufferings. An ordinary day's labour and its irritations become currency of charity when they are deliberately offered.",
          intentionPrompt: "What in today's work or discomfort can I offer for the dead?",
        },
        {
          title: "The Help of the Mass",
          meditation:
            "The Sacrifice of the Mass is the Church's supreme intercession for the dead. Having a Mass offered for a departed person is a greater gift than any private devotion, and this novena is meant to lead there.",
          intentionPrompt: "Have I arranged a Mass for the person I am praying for?",
        },
        {
          title: "Indulgences and the Treasury of the Church",
          meditation:
            "The Church can apply the merits of Christ and the saints to the departed by way of suffrage. The November visits to a cemetery and the prayers for the dead are among the plainest examples of that ancient practice.",
          intentionPrompt: "Will I visit a grave this week and pray there?",
        },
        {
          title: "A Happy Death",
          meditation:
            "The prayer asks the Holy Souls for the grace to lead a holy life and to die a happy death. Praying for the dead is also, quietly, a preparation for one's own going out.",
          intentionPrompt: "If I died this month, what would I most want to have set right first?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "devotion-to-the-holy-souls",
      typicalStartDate: "24 October, ending on the Solemnity of All Saints",
      relatedFeastSlug: "solemnity-all-saints",
      citations: [CD_HOLY_SOULS, SPE_SALVI, NA_PURGATORY],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-michael-the-archangel",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_MICHAEL, NA_MICHAEL],
    payload: {
      slug: "novena-saint-michael-the-archangel",
      title: "Novena to Saint Michael the Archangel",
      summary:
        "Nine days of prayer to the prince of the heavenly host, ordinarily kept from 20 to 28 September before the feast of the Archangels on 29 September. The received prayer asks Michael's protection for the Church and her pastors, his defence against the assaults of the enemy, and his help at the hour of death.",
      background:
        "St. Michael is honoured in the Roman liturgy on 29 September together with Gabriel and Raphael. This is a devotional novena and is distinct from the Chaplet of St. Michael, which honours the nine choirs of angels. The received form repeats one prayer on each of the nine days; the subjects below are editorial, and the prayer is unaltered. Catholic teaching is sober about the angels: they are creatures and servants of God, and every grace they obtain for us comes from Christ alone.",
      intentionTheme: "protection of the Church and of one's own soul in spiritual combat",
      days: repeatedPrayerDays(MICHAEL_PRAYER, [
        {
          title: "Guardian and Defender of the Church",
          meditation:
            "The prayer begins not with a private need but with the Church. Michael's title in this novena is guardian and defender of the Church of Jesus Christ, and the first petition is for her, not for me.",
          intentionPrompt: "When did I last pray for the Church rather than about her?",
        },
        {
          title: "For the Holy Father and the Bishops",
          meditation:
            "The received text names the Pope, the bishops, priests, religious and lay people, and especially the children. It is a prayer for the whole visible body in the order in which it stands.",
          intentionPrompt: "Which pastor of the Church shall I pray for by name today?",
        },
        {
          title: "The Powers of Hell Are Unchained",
          meditation:
            "The Church has never denied the reality of the enemy, nor exaggerated his power. He is a defeated creature permitted to tempt, and the answer to him is grace, the sacraments, and a settled refusal.",
          intentionPrompt:
            "What temptation keeps returning, and what practical guard have I put on it?",
        },
        {
          title: "Who Is Like God?",
          meditation:
            "Michael's name is a question — Mi-ka-el, who is like God? — and it is the answer to every pride. The angel's whole greatness consists in refusing to be more than a servant.",
          intentionPrompt: "Where am I quietly acting as if I were the measure of things?",
        },
        {
          title: "Weak, Sinful and Prone to Pride",
          meditation:
            "The received prayer makes a plain confession: remember me for I am weak and sinful and so prone to pride and ambition. Honest self-knowledge is the beginning of protection.",
          intentionPrompt: "What is my besetting fault, named without excuse?",
        },
        {
          title: "Aid in Temptation and Difficulty",
          meditation:
            "The petition is not for the removal of trial but for aid within it. God ordinarily leaves the difficulty and increases the strength.",
          intentionPrompt: "Am I asking God to take this away, or to make me equal to it?",
        },
        {
          title: "For Children",
          meditation:
            "The prayer singles out children. Those least able to defend themselves have the first claim on the Church's intercession and on the vigilance of adults.",
          intentionPrompt: "What child in my life needs my protection as well as my prayer?",
        },
        {
          title: "The Hour of Death",
          meditation:
            "Christian tradition gives Michael a place at the deathbed. The novena asks that he not forsake us in the last struggle, which is the one battle no one else can fight for us.",
          intentionPrompt: "Am I living so that death would be a homecoming rather than an ambush?",
        },
        {
          title: "To Behold God Face to Face",
          meditation:
            "The prayer's final request is not victory over enemies but the beatific vision. Spiritual combat is not the goal of the Christian life; it is what clears the road to the goal.",
          intentionPrompt: "What am I actually fighting for?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "chaplet-of-saint-michael",
      typicalStartDate: "20 September, ending on the eve of the Feast of the Archangels",
      citations: [CD_MICHAEL, NA_MICHAEL],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-guardian-angel",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_GUARDIAN_ANGEL, NA_GUARDIAN_ANGELS],
    payload: {
      slug: "novena-guardian-angel",
      title: "Novena to One's Guardian Angel",
      summary:
        "Nine days of thanksgiving and petition to the angel God has given each person as guardian, ordinarily kept before the memorial of the Guardian Angels on 2 October. The received prayer is a long act of gratitude for services already rendered, followed by the request that the angel not leave.",
      background:
        "The Church holds that from infancy to death human life is surrounded by the watchful care and intercession of the angels, and keeps the memorial of the Guardian Angels on 2 October. This is a devotional novena for private use. The received form repeats one prayer on each of the nine days; the subjects below are editorial and the prayer is unchanged. Devotion to the angels is always subordinate to the worship due to God alone, whom they serve.",
      intentionTheme:
        "gratitude for God's providence exercised through the angels, and docility to their promptings",
      days: repeatedPrayerDays(GUARDIAN_ANGEL_PRAYER, [
        {
          title: "A Most Faithful Companion",
          meditation:
            "The prayer opens by naming the angel a companion appointed by God who never leaves my side. The first fruit of this devotion is simply remembering that one is not alone and never has been.",
          intentionPrompt: "When today will I deliberately remember that I am not alone?",
        },
        {
          title: "Who Watches Over Me When I Sleep",
          meditation:
            "God's care does not depend on our attention to it. The hours in which we are least capable of guarding ourselves are covered by a providence that has never once lapsed.",
          intentionPrompt:
            "What have I been trying to hold together by vigilance that God is already holding?",
        },
        {
          title: "Who Comforts Me When I Am Sad",
          meditation:
            "Consolation in sorrow is one of the services the received prayer names. God consoles through creatures, visible and invisible, and it is no less His comfort for coming through them.",
          intentionPrompt: "Where have I refused comfort that was actually being offered?",
        },
        {
          title: "Who Averts the Dangers That Threaten Me",
          meditation:
            "Most of what we are spared we never learn about. Gratitude for unknown deliverances is a real and slightly humbling exercise.",
          intentionPrompt: "For what disaster that never happened can I thank God today?",
        },
        {
          title: "Who Withdraws Me from Sin and Inspires Me to Good",
          meditation:
            "The angel's chief work is not physical protection but the quiet suggestion toward the good. Learning to notice and follow those promptings is the whole practical content of the devotion.",
          intentionPrompt: "What good prompting have I felt lately and set aside?",
        },
        {
          title: "Who Exhorts Me to Penance When I Fall",
          meditation:
            "The prayer says the angel exhorts to penance and reconciles us to God. The impulse to go to confession after a fall is itself a grace, and it should be obeyed quickly.",
          intentionPrompt: "How long has it been since my last confession?",
        },
        {
          title: "Restrain Me in Prosperity",
          meditation:
            "The petition asks for restraint in prosperity as much as defence in danger. Good times undo more souls than hard times do, because they are not recognised as trials.",
          intentionPrompt: "What is going well in my life that I am handling carelessly?",
        },
        {
          title: "Offer Up My Prayers",
          meditation:
            "The angel is asked to carry our prayers and works of piety into the sight of the Divine Majesty. Nothing we offer God arrives unaccompanied.",
          intentionPrompt: "Is there a work of mine today I can consciously offer to God?",
        },
        {
          title: "Help Me to Persevere",
          meditation:
            "The prayer ends where all the novenas end: perseverance in grace until everlasting life. The angel's whole commission runs to that point and no further, because at that point it is fulfilled.",
          intentionPrompt: "What single habit would most help me persevere this year?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "24 September, ending on the Memorial of the Guardian Angels, 2 October",
      citations: [CD_GUARDIAN_ANGEL, NA_GUARDIAN_ANGELS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-holy-name-of-jesus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_HOLY_NAME, NA_HOLY_NAME],
    payload: {
      slug: "novena-holy-name-of-jesus",
      title: "Novena in Honour of the Holy Name of Jesus",
      summary:
        "Nine days of prayer honouring the Name given to the Son of God at His circumcision, kept in the days between Christmas and the feast of the Most Holy Name of Jesus on 3 January. The received prayer venerates the Name in union with the angel who first announced it and asks, through that Name, for the petitions of the novena.",
      background:
        "The Church keeps the optional memorial of the Most Holy Name of Jesus on 3 January; the devotion was spread above all by St. Bernardine of Siena and the Franciscans and later by the Dominicans of the Holy Name Society. This is a private devotion. The received form repeats one prayer on each of the nine days, and the Litany of the Holy Name of Jesus is customarily added; the day-by-day subjects below are editorial and the prayer is unaltered.",
      intentionTheme: "reverence for the Name of Jesus and confidence in the salvation it names",
      days: repeatedPrayerDays(HOLY_NAME_PRAYER, [
        {
          title: "The Name Above All Names",
          meditation:
            "St. Paul writes that God has given Him the name which is above every name. The novena begins by taking that seriously: the Name is not a label but the revelation of who He is and what He does.",
          intentionPrompt: "Do I say the name of Jesus with reverence, or only out of habit?",
        },
        {
          title: "Given at the Circumcision",
          meditation:
            "The Name was given on the eighth day, when the Child first shed His blood. The prayer notes that He commenced His office of Saviour in His early infancy: the Name and the sacrifice belong together from the start.",
          intentionPrompt: "What has my faith cost me lately, in anything more than words?",
        },
        {
          title: "Announced First by an Angel",
          meditation:
            "The Name was not invented; it was announced from heaven to Joseph and to Mary. We venerate it in union with the profound respect of the angel who first brought it to earth.",
          intentionPrompt: "Am I receiving the faith as something given, or editing it to taste?",
        },
        {
          title: "Jesus Means Saviour",
          meditation:
            "He shall save his people from their sins. The Name is a statement of purpose, and it rules out treating Christ as a teacher of ethics who leaves us essentially as we were.",
          intentionPrompt: "What sin am I asking to be saved from, by name?",
        },
        {
          title: "Where Two or Three Are Gathered",
          meditation:
            "The prayer reminds God of His own promise: where two or three assemble in His Name, He is in the midst of them. Novenas are traditionally made together for exactly this reason.",
          intentionPrompt: "Whom could I invite to pray this novena with me?",
        },
        {
          title: "The Joy of Heaven, the Terror of Hell",
          meditation:
            "The received text piles up the effects of the Name: joy of heaven, terror of hell, consolation of the afflicted, ground of unlimited confidence. It is a summary of what the Church has found the Name to do.",
          intentionPrompt: "Which of those four do I most need the Name to be for me now?",
        },
        {
          title: "Our Defence in Temptation",
          meditation:
            "The old practice of simply saying Jesus in the moment of temptation is not magic; it is the shortest possible act of faith, and it works because it turns the will toward a Person.",
          intentionPrompt: "Will I use the Name itself the next time temptation comes?",
        },
        {
          title: "With Mary at the Circumcision",
          meditation:
            "The prayer turns to the Mother who was present when the Name was given and who shared so deeply in her Son's sufferings. She is asked to obtain the favours petitioned through that Name.",
          intentionPrompt: "Have I asked Our Lady to bring this intention to her Son?",
        },
        {
          title: "Our Support at the Hour of Death",
          meditation:
            "The novena ends by asking that the Name be always in our minds and frequently on our lips, so that it may be our consolation and support in the hour of death. It is a prayer to die saying the Name we have practised saying.",
          intentionPrompt: "What would I want to be the last word I say?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate:
        "26 December, ending on the Memorial of the Most Holy Name of Jesus, 3 January",
      relatedFeastSlug: "solemnity-mary-mother-of-god",
      citations: [CD_HOLY_NAME, NA_HOLY_NAME],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-christ-the-king",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_CHRIST_THE_KING, QUAS_PRIMAS],
    payload: {
      slug: "novena-christ-the-king",
      title: "Novena to Christ the King",
      summary:
        "Nine days of prayer before the Solemnity of Our Lord Jesus Christ, King of the Universe, which closes the liturgical year. The received prayer acknowledges Christ as the one Ruler of all nations, asks His mercy and forgiveness for our sins against Him, and prays that His kingdom be recognised on earth.",
      background:
        "Pope Pius XI instituted the feast of Christ the King in the encyclical Quas Primas of 11 December 1925, to set against the secularism of the age the public and social kingship of Christ over individuals, families and nations. Since the reform of the calendar the solemnity is kept on the last Sunday of Ordinary Time. This novena is a private devotion prepared for that solemnity; the received form repeats one prayer on each of the nine days, with an Our Father, Hail Mary and Glory Be, and the day-by-day subjects below are editorial.",
      intentionTheme:
        "the recognition of Christ's kingship in one's own life, in one's country, and in the world",
      days: repeatedPrayerDays(CHRIST_THE_KING_PRAYER, [
        {
          title: "You Alone Are King",
          meditation:
            "Quas Primas begins from Christ's kingship by right: it belongs to Him as God and is His also as man, by the title of redemption. The novena opens by conceding what is already true.",
          intentionPrompt: "What in my life am I still governing as though it were mine outright?",
        },
        {
          title: "King and Ruler of All Nations",
          meditation:
            "Pius XI insisted that Christ's rule is not confined to private conscience. Nations too have duties to God, and the peace they want is unattainable while they refuse Him.",
          intentionPrompt: "How do I pray for my country — for its comfort, or for its conversion?",
        },
        {
          title: "Mercy, Peace and Justice",
          meditation:
            "The prayer asks the Divine King for mercy, peace, justice and all good things, in that order. Peace without justice is a truce, and justice without mercy is unbearable.",
          intentionPrompt: "Where have I wanted justice for others and mercy for myself?",
        },
        {
          title: "Protect Our Families",
          meditation:
            "The received text asks protection for our families and the land of our birth. Christ's social kingship begins in households before it reaches parliaments.",
          intentionPrompt: "Is Christ actually king in my home, or only in my opinions?",
        },
        {
          title: "Our Sins Against You",
          meditation:
            "The novena does not pretend to innocence. Forgive us, O Sovereign King, our sins against You — a subject's plea, made by someone who knows he has been disloyal.",
          intentionPrompt: "In what way have I been personally disloyal to Christ this year?",
        },
        {
          title: "A King of Mercy",
          meditation:
            "We have deserved Your Just Judgment. Have mercy on us. The prayer holds the two together: the judgement is real, and so is the mercy, and only the second is a place to stand.",
          intentionPrompt:
            "Do I believe in God's judgement and in His mercy, or only in whichever is convenient?",
        },
        {
          title: "We Trust in Your Great Mercy",
          meditation:
            "Trust is the hinge of the whole prayer. It is not optimism about ourselves but confidence in Him, which is why it can survive an honest look at our record.",
          intentionPrompt: "What sin do I still not quite believe God would forgive?",
        },
        {
          title: "We Bow Before You",
          meditation:
            "The old translation calls Him most awe-inspiring. Adoration is the proper posture of a creature before its King, and it is the one act no other being can perform on our behalf.",
          intentionPrompt: "When did I last simply adore, asking for nothing?",
        },
        {
          title: "May Your Kingdom Be Recognized on Earth",
          meditation:
            "The novena's last petition is the second petition of the Our Father. The end of the liturgical year turns the Church toward the end of all things, and asks that the reign already begun be made manifest.",
          intentionPrompt: "What would change tomorrow if I lived as though Christ reigned?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate:
        "The nine days before the Solemnity of Christ the King, the last Sunday of Ordinary Time",
      relatedFeastSlug: "solemnity-christ-the-king",
      citations: [CD_CHRIST_THE_KING, QUAS_PRIMAS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-precious-blood",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_PRECIOUS_BLOOD, NA_PRECIOUS_BLOOD],
    payload: {
      slug: "novena-precious-blood",
      title: "Novena to the Most Precious Blood of Jesus",
      summary:
        "Nine days of prayer honouring the Blood that Christ shed for the redemption of the world, traditionally kept at the beginning of July, the month the older calendar devoted to the Precious Blood. The received prayer pleads by the seven sheddings of that Blood and refuses to leave the Saviour's feet unheard.",
      background:
        "Devotion to the Precious Blood was spread above all by St. Gaspar del Bufalo and the Missionaries of the Precious Blood; Pope Pius IX extended a feast of the Most Precious Blood to the universal Church, kept on 1 July until the calendar reform of 1969, which joined its content to the Solemnity of Corpus Christi. This is a private devotion. The received form repeats one prayer on each of the nine days; the subjects below are editorial and the prayer is unaltered.",
      intentionTheme:
        "confidence in the redeeming power of Christ's Blood for oneself and for the whole world",
      days: repeatedPrayerDays(PRECIOUS_BLOOD_PRAYER, [
        {
          title: "The Voice of Your Blood",
          meditation:
            "Scripture says the blood of Abel cried out from the ground, and that the blood of Christ speaks better things. The prayer begins from that image: the Blood itself is an argument before God.",
          intentionPrompt: "What am I asking God for that I have never dared to ask plainly?",
        },
        {
          title: "I Will Not Leave Your Bleeding Feet",
          meditation:
            "The prayer is deliberately importunate, in the manner of the widow in the parable and the Canaanite woman. Persistence in prayer is commanded by Christ Himself, and apparent refusal is often only delay.",
          intentionPrompt: "Have I given up on a prayer too soon?",
        },
        {
          title: "Seven Times Shed",
          meditation:
            "The old devotion counts the seven sheddings: the circumcision, the agony in the garden, the scourging, the crowning with thorns, the way of the cross, the crucifixion, and the piercing of the side. Each is a distinct act of love with a name and a place.",
          intentionPrompt:
            "Which moment of the Passion do I most need to hold before me this week?",
        },
        {
          title: "The Price of Our Redemption",
          meditation:
            "You were bought with a price. Christian dignity is not self-esteem; it is the value God set on us by what He was willing to spend.",
          intentionPrompt: "Do I treat my own soul as something that cost God everything?",
        },
        {
          title: "By the Tears of Your Immaculate Mother",
          meditation:
            "The prayer joins the Mother's tears to the Son's Blood. She stood by the cross and consented; her compassion is offered with, and never apart from, His sacrifice.",
          intentionPrompt: "Whose suffering am I standing beside, and am I staying?",
        },
        {
          title: "You Consoled So Many Sufferers",
          meditation:
            "The prayer reasons from Christ's recorded behaviour: He healed so many infirmities and raised so often a sinking courage. What He did then is the evidence for what He will do now.",
          intentionPrompt: "What Gospel healing can I read today as addressed to me?",
        },
        {
          title: "From the Depths of Anguish",
          meditation:
            "The received text does not pretend to composure. It cries from the depths, and treats it as impossible that Christ should fail to pity such a cry.",
          intentionPrompt: "Have I told God the truth about how bad this is?",
        },
        {
          title: "Another Profound Sigh",
          meditation:
            "The prayer imagines a sigh from my heart answered by a wave of merciful Blood from the wound in His. Prayer is not a transaction but an exchange between two hearts.",
          intentionPrompt: "Am I praying at God, or with Him?",
        },
        {
          title: "Tears Changed into Joy",
          meditation:
            "The last petition asks Him to hasten the moment when tears become joy and sighs become thanksgiving. Christian hope expects that reversal, in this life if God wills, and in the next without fail.",
          intentionPrompt: "For what shall I begin thanking God now, before the answer arrives?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "chaplet-of-the-precious-blood",
      typicalStartDate:
        "Late June, ending on 1 July, the traditional feast of the Most Precious Blood",
      citations: [CD_PRECIOUS_BLOOD, NA_PRECIOUS_BLOOD],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-corpus-christi",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_CORPUS_CHRISTI, ECCLESIA_DE_EUCHARISTIA],
    payload: {
      slug: "novena-corpus-christi",
      title: "Novena for Corpus Christi",
      summary:
        "Nine days of prayer before the Solemnity of the Most Holy Body and Blood of Christ. The received prayer is a sustained act of thanksgiving — for the institution of the Eucharist, for Christ's hiddenness under the sacramental species, for His giving Himself as food, and for the daily renewal of Calvary's sacrifice on the altar.",
      background:
        "The Solemnity of Corpus Christi was extended to the universal Church by Urban IV in 1264, and its Office and Mass texts are traditionally ascribed to St. Thomas Aquinas. This novena is a private devotion prepared for that solemnity and is well suited to be prayed before the Blessed Sacrament. The received form repeats one prayer on each of the nine days, with the antiphon O Sacrum Convivium and its collect; the day-by-day subjects below are editorial and the prayer is unaltered.",
      intentionTheme:
        "thanksgiving for the gift of the Eucharist and a deeper reverence in receiving it",
      days: repeatedPrayerDays(CORPUS_CHRISTI_PRAYER, [
        {
          title: "I Thank You for Coming Upon the Earth",
          meditation:
            "The novena's whole form is thanksgiving, which is what the word Eucharist means. Before any petition, the prayer simply enumerates what has been given.",
          intentionPrompt:
            "When did I last thank God for the Eucharist rather than ask something of Him there?",
        },
        {
          title: "To Remain With Us Until the End of the World",
          meditation:
            "The Blessed Sacrament is the fulfilment of Christ's promise to be with us always. Every tabernacle in the world is that promise kept in a particular place.",
          intentionPrompt: "Where is the nearest tabernacle to me, and when will I go there?",
        },
        {
          title: "Hidden Majesty",
          meditation:
            "The prayer thanks Christ for hiding beneath the Eucharistic species the majesty which the angels delight to behold, so that I might have courage to approach. His concealment is an act of kindness to our weakness.",
          intentionPrompt: "Do I approach Communion with reverence, or with mere routine?",
        },
        {
          title: "Made Yourself My Food",
          meditation:
            "He who feeds every living thing becomes food. This is the reason the Church has always spoken of Communion as the most intimate of all God's gifts on earth.",
          intentionPrompt: "What in my life is being nourished by the Eucharist, and what is not?",
        },
        {
          title: "No Greater Gift to Give",
          meditation:
            "The prayer says He has enriched this Sacrament with the treasures of His love so that He has no greater gift to give. God does not hold anything back beyond it.",
          intentionPrompt: "Am I living as someone who has already received God's greatest gift?",
        },
        {
          title: "A Continual Sacrifice",
          meditation:
            "The Eucharist is not only food but sacrifice, offered to the Father for our salvation. The two aspects are inseparable: we eat the Victim who was offered.",
          intentionPrompt: "Do I come to Mass to receive, or also to offer?",
        },
        {
          title: "Renewing the Sacrifice of the Cross",
          meditation:
            "The Mass does not repeat Calvary; it makes the one sacrifice of the Cross present. The Church has taught that the Victim and the Priest are the same, only the manner of offering differing.",
          intentionPrompt:
            "What of my own life can I place on the altar at the next Mass I attend?",
        },
        {
          title: "Offered in Thanksgiving for All His Benefits",
          meditation:
            "The prayer joins our thanksgiving to Christ's own, which is the only offering worthy of the Father. Our gratitude is small; carried in His, it is enough.",
          intentionPrompt: "What benefit of God's have I never actually thanked Him for?",
        },
        {
          title: "A Pledge of Future Glory",
          meditation:
            "The antiphon O Sacrum Convivium calls the Eucharist a pledge of future glory. Communion is a beginning of what will be complete only in heaven, which is why the Church calls it viaticum for the dying.",
          intentionPrompt: "Does my hope of heaven show anywhere in how I live this week?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "eucharistic-adoration",
      typicalStartDate:
        "The nine days before the Solemnity of the Most Holy Body and Blood of Christ",
      relatedFeastSlug: "solemnity-corpus-christi",
      citations: [CD_CORPUS_CHRISTI, ECCLESIA_DE_EUCHARISTIA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-of-grace-saint-francis-xavier",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_NOVENA_OF_GRACE, EWTN_NOVENA_OF_GRACE, NA_XAVIER],
    payload: {
      slug: "novena-of-grace-saint-francis-xavier",
      title: "The Novena of Grace (Saint Francis Xavier)",
      summary:
        "Nine days of prayer to the great missionary of the Indies and Japan, kept from 4 to 12 March. The received prayer adores the Divine Majesty in union with the saint, rejoices in the graces God gave him, and asks through his intercession for the blessing of living and dying in the state of grace before it asks for anything else.",
      background:
        "The novena takes its name from the recovery of the Jesuit Marcello Mastrilli at Naples in 1634, after which the devotion spread from the Society of Jesus through the whole Church; the dates 4-12 March end on the anniversary of St. Francis Xavier's canonisation in 1622. It is also made in the nine days before his feast on 3 December. This is a devotional novena, not a liturgical rite. The received form repeats one prayer on each of the nine days, with the versicle Pray for us, Saint Francis Xavier, an Our Father, Hail Mary and Glory Be, and the saint's own prayer for unbelievers; the day-by-day subjects below are editorial and the prayer is unaltered.",
      intentionTheme:
        "the grace of living and dying in God's friendship, missionary zeal, and one particular favour asked in submission to God's will",
      days: repeatedPrayerDays(NOVENA_OF_GRACE_PRAYER, [
        {
          title: "In Union With Thee I Adore the Divine Majesty",
          meditation:
            "The prayer begins with adoration, not petition, and it adores in union with the saint. Asking a saint's intercession is joining a prayer already in progress before the throne of God.",
          intentionPrompt: "Can I begin this novena by adoring God before naming what I want?",
        },
        {
          title: "The Favours With Which God Blessed Thee",
          meditation:
            "Francis Xavier left a Paris professorship for Goa, the Fishery Coast, Malacca and Japan, and died within sight of China in 1552. The prayer rejoices in the graces God gave him rather than in his own achievement.",
          intentionPrompt: "Do I praise God for the holiness of others, or envy it?",
        },
        {
          title: "Thy Glory After Death",
          meditation:
            "The saints are not remembered figures but living intercessors in glory. The Church canonises them precisely to say that this life can end well.",
          intentionPrompt: "Whose holiness in my own life would I most like to imitate?",
        },
        {
          title: "The Inestimable Blessing of Grace",
          meditation:
            "Before the special favour, the prayer asks for the state of grace at life's end. Every other request in the novena is subordinated to that one.",
          intentionPrompt: "If I could have only one prayer answered, would it be this one?",
        },
        {
          title: "The Favour I Ask in This Novena",
          meditation:
            "Only now does the received text make room for the particular petition. The Church has never discouraged asking God for concrete things; she orders the asking.",
          intentionPrompt: "What exactly am I asking for, and why?",
        },
        {
          title: "But If What I Ask Is Not for the Glory of God",
          meditation:
            "The prayer contains its own correction: if the request is not for God's glory and my soul's good, let Him give what is. This is the clause that makes a novena an act of faith rather than a bargain.",
          intentionPrompt: "Would I still trust God if the answer were no?",
        },
        {
          title: "A Missionary's Zeal",
          meditation:
            "Xavier baptised in such numbers that his arm grew tired, and wrote home begging the scholars of Europe to come and help. The novena is traditionally made for the spread of the faith as well as for private needs.",
          intentionPrompt: "Whom do I know who has never really been offered the faith?",
        },
        {
          title: "Prayer for Unbelievers",
          meditation:
            "The saint's own prayer for unbelievers is said with this novena: it asks the Father to remember that the souls of unbelievers were made in His image and redeemed by His Son's cruel death.",
          intentionPrompt: "Do I pray for people outside the Church, or only complain about them?",
        },
        {
          title: "That We May Imitate His Example",
          meditation:
            "The closing collect asks not for Xavier's miracles but for imitation of his life. Devotion to a saint that does not change the one praying has stopped short.",
          intentionPrompt: "What one concrete thing will I change because of this novena?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-francis-xavier",
      typicalStartDate:
        "4 March, ending on 12 March; also the nine days before his feast on 3 December",
      citations: [CD_NOVENA_OF_GRACE, EWTN_NOVENA_OF_GRACE, NA_XAVIER],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-anne",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_ANNE, NA_ANNE],
    payload: {
      slug: "novena-saint-anne",
      title: "Novena to Saint Anne",
      summary:
        "Nine days of prayer to the mother of the Blessed Virgin Mary, kept from 17 to 25 July before her feast with St. Joachim on 26 July. Unlike most novenas this one has nine distinct received prayers, one for each day, moving from the salvation of one's soul through confidence, family life, suffering, perseverance and the sick to a final act of consecration.",
      background:
        "The names of Mary's parents, Joachim and Anne, come to us not from Scripture but from ancient tradition, and the Church honours them together on 26 July. Devotion to St. Anne is very old in the East and was carried through the West by shrines such as Sainte-Anne-d'Auray in Brittany and Sainte-Anne-de-Beaupre in Quebec, where this nine-day form was long used. It is a private devotion. Each day the opening prayer, Glorious St. Anne, filled with compassion, is said first, then the prayer proper to the day, then an Our Father, Hail Mary and Glory Be with the versicle Pray for us, Saint Anne. The prayers below are the received day-texts; the meditations are short editorial introductions.",
      intentionTheme:
        "the salvation of one's soul above every temporal favour, and the sanctification of family life",
      days: [
        {
          day: 1,
          title: "What Shall It Profit a Man",
          meditation:
            "The novena opens by setting first things first. Whatever else is asked in these nine days is placed under our Lord's question about gaining the world and losing one's soul.",
          prayerText:
            "Great Saint Anne, engrave indelibly on my heart and in my mind the words that have reclaimed and sanctified so many sinners: What shall it profit a man to gain the whole world if he lose his own soul? May this be the principal fruit of these prayers by which I will strive to honor you during this novena. At your feet renew my resolution to invoke you daily, not only for the success of my temporal affairs and to be preserved from sickness and suffering, but above all, that I may be preserved from all sin, that I may succeed in working out my eternal salvation and that I will receive the special grace of (state your intention). O most powerful Saint Anne, do not let me lose my soul, but obtain for me the grace of winning my way to heaven, there with you, your blessed spouse, and your glorious daughter, to sing the praise of the most holy and adorable Trinity forever and ever. Amen.",
          intentionPrompt: "What am I asking for, and where does it stand next to my salvation?",
        },
        {
          day: 2,
          title: "Grandmother of the Redeemer",
          meditation:
            "The prayer reasons from St. Anne's place in the family of God: she is grandmother of Him who shed His blood for sinners and mother of her whom the saints call the advocate of sinners. That is the ground of the confidence with which she is approached.",
          prayerText:
            "Glorious Saint Anne, how can you be otherwise than overflowing with tenderness toward sinners like myself, since you are the grandmother of Him who shed His blood for them, and the mother of her whom the saints call advocate of sinners? To you, therefore, I address my prayers with confidence. Vouchsafe to commend me to Jesus and Mary so that, at your request, I may be granted remission of my sins, perseverance, the love of God, charity for all mankind, and the special grace of (state your intention) which I stand in need of at the present time. O most powerful protectress, let me not lose my soul, but obtain for me that through the merits of Jesus Christ and the intercession of Mary, I may have the happiness of seeing them, of loving and praising them with you through all eternity. Amen.",
          intentionPrompt:
            "Do I approach God as a sinner who is welcome, or as one who is barely tolerated?",
        },
        {
          day: 3,
          title: "Model of Christian Womanhood and of the Home",
          meditation:
            "The third day turns to the household. St. Anne formed the heart of the girl who would become the Mother of God, and the prayer asks her for the graces of those who enter the married state.",
          prayerText:
            "Beloved of Jesus, Mary and Joseph, mother of the Queen of Heaven, take us and all who are dear to us under your special care. Obtain for us the virtues you instilled in the heart of her who was destined to become Mother of God, and the graces with which you were endowed. Sublime model of Christian womanhood, pray that we may imitate your example in our homes and families; listen to our petitions (state your intention). Guardian of the infancy and childhood of the most Blessed Virgin Mary, obtain the graces necessary for all who enter the marriage state, that imitating your virtues they may sanctify their homes and lead the souls entrusted to their care to eternal glory. Amen.",
          intentionPrompt: "What virtue am I actually teaching the people who live with me?",
        },
        {
          day: 4,
          title: "You Also Have Tasted the Bitterness of Life",
          meditation:
            "Tradition holds that Joachim and Anne were long childless before Mary was born. The fourth day appeals to those twenty years of waiting and humiliation as the reason she understands the tears of others.",
          prayerText:
            "Glorious Saint Anne, I kneel in confidence at your feet, for you also have tasted the bitterness and sorrow of life. My necessities, the cause of my tears, are (state your intention). Good Saint Anne, you who did suffer much during the twenty years that preceded your glorious maternity, I beseech you, by all your sufferings and humiliations, to grant my prayer. I pray to you, through your love for your glorious spouse Saint Joachim, through your love for your immaculate child, through the joy you did feel at the moment of her happy birth, not to refuse me. Bless me, bless my family and all who are dear to me, so that some day we may all be with you in the glory of heaven, for all eternity. Amen.",
          intentionPrompt:
            "What long waiting am I in, and can I let it be fruitful rather than only bitter?",
        },
        {
          day: 5,
          title: "Perseverance in Prayer",
          meditation:
            "The fifth day is an honest confession of impatience: the tendency to stop praying when God does not answer at once. It asks that confidence grow in proportion as the trial is prolonged.",
          prayerText:
            "Great Saint Anne, how far I am from resembling you. I so easily give way to impatience and discouragement, and so easily give up praying when God does not at once answer my request. Prayer is the key to all heavenly treasures and I cannot pray, because my weak faith and lack of confidence fail me at the slightest delay of divine mercy. O my powerful protectress, come to my aid, listen to my petition (state your intention); make my confidence and fervor, supported by the promise of Jesus Christ, redouble in proportion as the trial to which God in His goodness subjects me is prolonged, that I may obtain like you more than I can venture to ask for. In the future I will remember that I am made for heaven and not for earth, for eternity and not for time; that consequently I must ask, above all, the salvation of my soul, which is assured to all who pray properly and who persevere in prayer. Amen.",
          intentionPrompt: "How do I behave toward God when He delays?",
        },
        {
          day: 6,
          title: "Pardon and Protection",
          meditation:
            "The sixth day asks for the pardon of sins and for guidance in the path of Christian perfection, ending with the request for the death of the just. It is a prayer about direction as much as about relief.",
          prayerText:
            "Glorious Saint Anne, mother of the Mother of God, I beg you to obtain through your powerful intercession the pardon of my sins and the assistance I need in my troubles (state your intention). What can I not hope for if you deign to take me under your protection? The Most High has been pleased to grant the prayers of sinners, whenever you have been charitable enough to be their advocate. Kneeling at your feet, I beg you to help me in all spiritual and temporal dangers, to guide me in the true path of Christian perfection, and finally to obtain for me the grace of ending my life with the death of the just, so that I may contemplate face to face your beloved Jesus and daughter Mary in your loving companionship throughout eternity. Amen.",
          intentionPrompt:
            "Which of my troubles is really a symptom of a sin I have not confessed?",
        },
        {
          day: 7,
          title: "Mother of the Infirm",
          meditation:
            "The seventh day prays for the sick — that their sufferings be sanctified and, if God wills, that health be restored — while insisting that the soul's health matters more than the body's.",
          prayerText:
            "O Good Saint Anne, so justly called the mother of the infirm, the cure for those who suffer from disease, look kindly upon the sick for whom I pray; alleviate their sufferings; cause them to sanctify their sufferings by patience and complete submission to the divine will; finally deign to obtain health for them and with it the firm resolution to honor Jesus, Mary, and yourself by the faithful performance of their duties. But, merciful Saint Anne, I ask you above all for the salvation of my soul, rather than bodily health, for I am convinced that this fleeting life is given us solely to assure us a better one. Now, we cannot obtain that better life without the help of God's graces. I earnestly beg them of you for the sick and for myself, especially the petition for which I am making this novena (state your intention), through the merits of our Lord Jesus Christ, through the intercession of His Immaculate Mother, and through your efficacious and powerful mediation, O glorious Saint Anne. Amen.",
          intentionPrompt:
            "Whom that I know is ill, and have I done anything for them besides pray?",
        },
        {
          day: 8,
          title: "Never Was It Known",
          meditation:
            "The eighth day borrows the shape of the Memorare. It is the shortest of the nine and the most direct: a sinner taking refuge, burdened, asking not to be sent away.",
          prayerText:
            "Remember, O Saint Anne, you whose name signifies grace and mercy, that never was it known that anyone who fled to your protection, implored your help, and sought your intercession was left unaided. Inspired with this confidence, I fly unto you, good and kind mother; I take refuge at your feet, burdened with the weight of my sins. O holy mother of the Immaculate Virgin Mary, despise not my petition (state your intention), but hear me and grant my prayer. Amen.",
          intentionPrompt: "What sin is weighing on me that I have been carrying alone?",
        },
        {
          day: 9,
          title: "An Act of Consecration",
          meditation:
            "The last day is not a request but a handing over: the person, their interests, and above all the hour of death are placed in St. Anne's care and in her daughter's, so as to appear before the Judge under her patronage.",
          prayerText:
            "Most holy mother of the Virgin Mary, glorious Saint Anne, I, a miserable sinner, confiding in your kindness, choose you today as my special advocate. I offer and consecrate my person and all my interests to your care and maternal solicitude. I hope to serve you and honor you all my life for the love of your most holy daughter and to do all in my power to spread devotion to you. O my very good mother and advocate, deign to accept me as your servant, and to adopt me as your child. O glorious Saint Anne, I beg you, by the passion of my most loving Jesus, the Son of Mary, your most holy daughter, to assist me in all the necessities both of my body and my soul. Venerable Mother, I beg you to obtain for me the favor I seek in this novena (state your intention) and the grace of leading a life perfectly conformable in all things to the divine will. I place my soul in your hands and in those of your kind daughter. I confide it to you, above all at the moment when it will be separated from my body, in order that, appearing under your patronage before the Supreme Judge, He may find it worthy of enjoying His Divine Presence in your holy companionship in Heaven. Amen.",
          intentionPrompt: "What am I willing to hand over to God entirely, today?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-anne",
      typicalStartDate:
        "17 July, ending on the eve of the Memorial of Saints Joachim and Anne, 26 July",
      citations: [CD_ANNE, NA_ANNE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-jude",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_JUDE, NA_JUDE],
    payload: {
      slug: "novena-saint-jude",
      title: "Novena to Saint Jude Thaddeus",
      summary:
        "Nine days of prayer to the apostle whom the Church invokes as patron of desperate and hopeless cases, kept from 19 to 27 October before his feast with St. Simon on 28 October. The novena has nine distinct received prayers, each ending with the invocations Saint Jude, pray for us and My Jesus, mercy.",
      background:
        "Jude Thaddeus was one of the Twelve and the author of the short canonical epistle that bears his name; because his name was confused with that of the traitor he was long neglected, which is the origin of the tradition that he is especially quick to help those whom no one else will. The Church honours him with St. Simon on 28 October. This is a private devotion. The opening prayer, Saint Jude, glorious apostle, is said first each day, followed by the prayer proper to the day. The prayers below are the received day-texts; the meditations are short editorial introductions.",
      intentionTheme:
        "hope in a situation that seems beyond remedy, and resignation to God's will in whatever way He answers",
      days: [
        {
          day: 1,
          title: "Patron of Needy and Despairing Cases",
          meditation:
            "The novena opens by naming what it is for. The first prayer asks the apostle to take a special interest in us and our needs, and asks in the same breath for patience in learning God's will and courage in carrying it out.",
          prayerText:
            "O blessed apostle St. Jude, who labored zealously among the Gentiles in many lands, and performed numerous miracles in needy and despairing cases, we invoke you to take special interest in us and our needs. We feel that you understand us in a particular way. Hear our prayers and our petitions and plead for us in all our necessities, especially (make your request). May we be patient in learning God's holy will and courageous in carrying it out. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "What is the situation I have almost stopped praying about?",
        },
        {
          day: 2,
          title: "To Serve Christ as He Deserves",
          meditation:
            "The second prayer asks that we serve Jesus Christ as He deserves to be served, and that we dispose our hearts and minds so that God will be inclined to listen. Petition and conversion are not separate projects.",
          prayerText:
            "O blessed apostle Jude, who has been instrumental in gathering us here together this day, grant that we may always serve Jesus Christ as he deserves to be served, giving of our best efforts in living as he wishes us to live. May we dispose our hearts and minds that God will always be inclined to listen to our prayers and petitions, especially those petitions which we entrust to your care and for which we ask you to plead for us (make your request). Grant that we may be enlightened as to what is best for us, in the present and future, not forgetting the blessings we have received in the past. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt:
            "Is there something in my life that makes it hard for me to pray honestly?",
        },
        {
          day: 3,
          title: "No Sincere Prayer Left Unanswered",
          meditation:
            "The third prayer asks for fervour and devotion and for the sight of God's purpose in every trial, resting on the conviction that no sincere prayer is left unanswered in some way.",
          prayerText:
            "O holy St. Jude, apostle of Jesus Christ, you who have so faithfully and devotedly helped to spread his Gospel of Light, we who are gathered together today in your honor ask and petition you to remember us and our needs. Especially do we pray for (make your request). May it also please our Lord to lend an ear to your supplications in our behalf. Grant that we may ever pray with fervor and devotion, resigning ourselves humbly to the divine will, seeing God's purpose in all our trials and knowing that he will leave no sincere prayer unanswered in some way. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "Have I been assuming God's silence means refusal?",
        },
        {
          day: 4,
          title: "Chosen to Be One of the Apostles",
          meditation:
            "The fourth prayer recalls that Jude was called by Christ Himself and laboured to bring men to the knowledge and love of God. His nearness to Christ is the reason his intercession carries weight.",
          prayerText:
            "Saint blessed Jude, you were called to be one of Christ's chosen apostles and labored to bring men to a knowledge and love of God; listen with compassion to those gathered together to honor you and ask your intercession. In this troubled world of ours we have many trials, difficulties, and temptations. Plead for us in the heavenly court, asking that our petitions may be answered, especially the particular one we have in mind at this moment (make your request). May it please God to answer our prayers in the way that he knows best, giving us grace to see his purpose in all things. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "Am I willing for God to answer in the way He knows best?",
        },
        {
          day: 5,
          title: "Returning to Give Thanks",
          meditation:
            "The fifth prayer asks that in praying for present and future favours we may not forget the innumerable ones already granted. Gratitude is the memory that keeps petition from turning into complaint.",
          prayerText:
            "O holy St. Jude, apostle and companion of Christ Jesus, you have shown us by example how to lead a life of zeal and devotion. We humbly entreat you today to hear our prayers and petitions. Especially do we ask you to obtain for us the following favor (make your request). Grant that in praying for present and future favors we may not forget the innumerable ones granted in the past but often return to give thanks. Humbly we resign ourselves to God's holy will, knowing that he alone knows what is best for us, especially in our present needs and necessities. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "What answered prayer have I never gone back to thank God for?",
        },
        {
          day: 6,
          title: "Only What Is Pleasing to God",
          meditation:
            "The sixth prayer sets a condition on the request itself: obtain them for us, if they are for the good of our souls. It is the clause that keeps a novena from becoming an attempt to bend God.",
          prayerText:
            "St. Jude, apostle of Christ and helper in despairing cases, hear the prayers and petitions of those who are gathered together in your honor. In all our needs and desires may we only seek what is pleasing to God and what is best for our salvation. These, our petitions (make your request), we submit to you, asking you to obtain them for us, if they are for the good of our souls. We are resigned to God's holy will in all things, knowing that he will leave no sincere prayer unanswered in some way, though it may be in a way unexpected by us. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "Would I want this if it were bad for my soul?",
        },
        {
          day: 7,
          title: "A Close Friend of Almighty God",
          meditation:
            "The seventh prayer rests on two facts: the apostle's calling and his martyrdom for the faith. Because of them we do not hesitate to petition him in our necessities.",
          prayerText:
            "O holy apostle Saint Jude, in whose honor we are gathered today, may we never forget that our Lord and Savior Jesus Christ chose you to be one of twelve apostles. Because of this and of the martyrdom you suffered for the Faith, we know you are a close friend of Almighty God. Therefore we do not hesitate to petition you in our necessities, especially (make your request). We humbly submit ourselves to the will of God, knowing full well that no sincere prayer is ever left unanswered. May we see God's good and gracious purpose working in all our trials. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "What have I suffered for the faith, and what have I refused to suffer?",
        },
        {
          day: 8,
          title: "Whatsoever Is Necessary for Our Salvation",
          meditation:
            "The eighth prayer asks first to imitate the Divine Master and to cooperate with grace, and only then not to forget our special petitions. The order of asking is itself instruction.",
          prayerText:
            "O holy Saint Jude, apostle of Christ, pray that we may ever imitate the Divine Master and live according to His will. May we cooperate with the grace of God and ever remain pleasing in His sight. Especially do we ask you to plead for us and obtain whatsoever is necessary for our salvation. Forget not our special petitions (make your request). May we always be thankful to God for the blessings we have received in the past. Whatsoever we ask for the present or future, we submit to the divine will, realizing that God knows best what is good for us. We know He will respond to our prayers and petitions in one way or another. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "Where have I been resisting a grace God is clearly offering?",
        },
        {
          day: 9,
          title: "Not Temporal Good but What Will Avail Our Souls",
          meditation:
            "The last prayer closes the novena with our Lord's own warning about gaining the world and losing the soul, and asks that we incline ourselves toward the divine will, seeing God's purpose in all our trials.",
          prayerText:
            "O holy Saint Jude, apostle and martyr, grant that we may so dispose our lives that we may always be pleasing to God. In working out our salvation in this life we have many needs and necessities. Today we turn to you, asking you to intercede for us and obtain for us the favors we ask of God. Especially do we petition for (make your request). May we not so much seek temporal good but rather what will avail our souls, knowing that it will profit us nothing if we gain the whole world yet suffer the loss of our soul. Therefore, may we incline ourselves toward the divine will, seeing God's good and gracious purpose in all our trials. Amen. St. Jude, pray for us! My Jesus, mercy!",
          intentionPrompt: "If this prayer is not granted, what will I do next?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-jude-thaddeus",
      typicalStartDate:
        "19 October, ending on the eve of the Feast of Saints Simon and Jude, 28 October",
      citations: [CD_JUDE, NA_JUDE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-rita-of-cascia",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_RITA, NA_RITA],
    payload: {
      slug: "novena-saint-rita-of-cascia",
      title: "Novena to Saint Rita of Cascia",
      summary:
        "Nine days of prayer to the Augustinian nun of Cascia, wife, mother, widow and religious, whom devotion calls the advocate of the hopeless and of the impossible. The received prayer appeals to her humility, purity and patient love of the crucified Jesus, and promises, if the petition is granted, to make her favour known.",
      background:
        "Rita of Cascia (c. 1381-1457) endured a difficult marriage, the violent death of her husband and the death of her two sons before entering the Augustinian monastery at Cascia, where she received a wound in the forehead from the crown of thorns. She was canonised by Leo XIII in 1900 and is kept on 22 May. This is a private devotion. The received form repeats one prayer on each of the nine days; the day-by-day subjects below are editorial and the prayer is unaltered. The old printed note that a granted petition must be published in a newspaper is a nineteenth-century custom of publicising favours, not a condition the Church imposes.",
      intentionTheme:
        "hope in a situation that looks closed, and patience in a suffering that cannot be changed",
      days: repeatedPrayerDays(RITA_PRAYER, [
        {
          title: "Patroness of Those in Need",
          meditation:
            "The novena begins by taking the title seriously. Rita is invoked by people whose situations have no visible remedy, and the prayer says frankly that they expect, if not always relief, at least comfort.",
          intentionPrompt: "What have I been calling impossible?",
        },
        {
          title: "A Difficult Marriage",
          meditation:
            "Rita bore years of a violent husband with patience and won him at last to repentance. Her sanctity was formed inside a home that did not improve on schedule.",
          intentionPrompt:
            "Whom am I waiting for God to change, and how am I treating them meanwhile?",
        },
        {
          title: "A Mother's Grief",
          meditation:
            "She lost her husband to a feud and then both her sons, praying that they might die rather than take revenge. Devotion to Rita has always been strong among those who have buried their own children.",
          intentionPrompt: "What loss have I never brought to God in prayer?",
        },
        {
          title: "So Humble, So Pure",
          meditation:
            "The received prayer lists her virtues before it lists her powers: humble, pure, mortified, patient. The intercession it counts on is the fruit of a life, not a mechanism.",
          intentionPrompt: "Which of those four virtues is furthest from me?",
        },
        {
          title: "Compassionate Love for the Crucified",
          meditation:
            "The prayer says her love for the crucified Jesus was such that she could obtain from Him whatsoever she asked. Intimacy with the Passion is the source of everything else in her.",
          intentionPrompt: "How much time do I actually spend with the crucifix?",
        },
        {
          title: "The Wound of the Thorn",
          meditation:
            "For the last fifteen years of her life Rita bore a wound in her forehead from the crown of thorns, which isolated her and which she did not ask to have removed. Some sufferings are vocations.",
          intentionPrompt:
            "Is there a suffering in my life I am meant to carry rather than escape?",
        },
        {
          title: "For the Greater Glory of God",
          meditation:
            "The prayer asks the favour for the greater glory of God, for the spreading of her devotion, and for the consolation of those who trust in her. It never asks simply for our own convenience.",
          intentionPrompt: "How would God be glorified if this prayer were answered?",
        },
        {
          title: "We Promise to Make Known Your Favour",
          meditation:
            "The old novenas promise publicity for a granted request. Stripped of the newspaper notice, the promise is simply this: gratitude that is told to somebody, so that another person's hope is strengthened.",
          intentionPrompt: "Whose faith could be helped by hearing what God has done for me?",
        },
        {
          title: "As Soon as God Deems Fit",
          meditation:
            "The last clause of the received prayer surrenders the timing. Rita waited decades for the conversion of her household; the novena ends by leaving the hour to God.",
          intentionPrompt: "Can I keep asking without setting God a deadline?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-rita-of-cascia",
      typicalStartDate: "13 May, ending on the eve of her memorial, 22 May",
      citations: [CD_RITA, NA_RITA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-peregrine",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_PEREGRINE, NA_NOVENA],
    payload: {
      slug: "novena-saint-peregrine",
      title: "Novena to Saint Peregrine, Patron of the Sick",
      summary:
        "Nine days of prayer to the Servite friar who was cured of a cancer of the leg on the eve of its amputation, and who is invoked by those suffering from cancer and other grave illness. The received prayer asks for healing and, in the same breath, for perfect resignation to whatever suffering God permits.",
      background:
        "Peregrine Laziosi (c. 1265-1345) opposed the Church as a young man in Forli and struck St. Philip Benizi, who answered by turning the other cheek; converted, he entered the Servite Order and spent his life in penance and service of the poor. Tradition holds that on the night before his leg was to be amputated he prayed before a crucifix and awoke healed. He was canonised in 1726 and is kept on 1 May. This is a private devotion. The received form repeats one prayer on each of the nine days; the day-by-day subjects below are editorial and the prayer is unaltered. The Church never promises a cure, and this novena is rightly prayed alongside, not instead of, medical care and the Anointing of the Sick.",
      intentionTheme: "healing for the sick, and the grace to accept whatever God permits",
      days: repeatedPrayerDays(PEREGRINE_PRAYER, [
        {
          title: "A Ready Spirit",
          meditation:
            "The prayer begins with Peregrine's conversion: he answered the divine call with a ready spirit and forsook the comforts of an easy life. Sickness often forces the same question — what is now worth keeping?",
          intentionPrompt: "For whom am I making this novena, and have I told them?",
        },
        {
          title: "Forsaking the Empty Honors of the World",
          meditation:
            "Illness strips away a great deal that seemed important. Peregrine gave those things up freely; the sick are asked to give them up under compulsion, and can still make the surrender an offering.",
          intentionPrompt: "What has this illness already taken that I did not really need?",
        },
        {
          title: "Dedicated to God in the Order of His Holy Mother",
          meditation:
            "Peregrine's whole remedy was to give himself away. The Servite Order he joined is dedicated to Our Lady of Sorrows, who stood by the cross and did not leave.",
          intentionPrompt:
            "Am I staying with the person who is suffering, or finding reasons to be elsewhere?",
        },
        {
          title: "You Labored for the Salvation of Souls",
          meditation:
            "He preached and served the poor for years while carrying his own painful disease. Suffering did not excuse him from charity; it became the material of it.",
          intentionPrompt: "What can I still do for someone else today, however little?",
        },
        {
          title: "In Union With Jesus Crucified",
          meditation:
            "The prayer says he endured painful sufferings in union with Jesus crucified. That union, not stoicism, is what the Church means by offering up a pain.",
          intentionPrompt: "Have I actually offered this pain, or only endured it?",
        },
        {
          title: "Healed by a Touch of His Divine Hand",
          meditation:
            "The cure came the night before the amputation, and it came from Christ, not from the saint. Every miracle attributed to a saint is God's work done at a friend's request.",
          intentionPrompt: "Do I ask God for healing directly, or only through intermediaries?",
        },
        {
          title: "To Answer Every Call of God",
          meditation:
            "The petition is not first for health but for the grace to answer every call of God and to fulfil His will in all the events of life. Illness is one of those events.",
          intentionPrompt: "What is God asking of me inside this situation, rather than out of it?",
        },
        {
          title: "A Consuming Zeal for the Salvation of All",
          meditation:
            "The received prayer asks for zeal for all people even while asking to be delivered from bodily infirmity. Sickness narrows a life; charity widens it again.",
          intentionPrompt: "Whom else, besides myself, am I praying for in this novena?",
        },
        {
          title: "Perfect Resignation",
          meditation:
            "The last petition asks for perfect resignation to the sufferings it may please God to send, in imitation of the crucified Saviour and His sorrowful Mother. It is asked for whether or not the cure comes.",
          intentionPrompt: "Can I say, and mean, Thy will be done, about this?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      typicalStartDate: "22 April, ending on the eve of his feast, 1 May",
      citations: [CD_PEREGRINE, NA_NOVENA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-gerard-majella",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_GERARD, NA_NOVENA],
    payload: {
      slug: "novena-saint-gerard-majella",
      title: "Novena to Saint Gerard Majella",
      summary:
        "Nine days of prayer to the Redemptorist lay brother whom the Church honours as patron of expectant mothers and of those longing for children, kept before his memorial on 16 October. The received prayer thanks the Blessed Trinity for the gifts given him and asks him to take one urgent affair in hand.",
      background:
        "Gerard Majella (1726-1755) was a tailor's son from Muro Lucano who was received as a lay brother by the Redemptorists and died at twenty-nine. Falsely accused of grave sin, he answered by silence until the accuser retracted; his intercession has long been sought for mothers in childbirth and for couples hoping for a child. He was canonised by St. Pius X in 1904. This is a private devotion. The received form repeats one prayer on each of the nine days, with a second prayer for the gift of children; the day-by-day subjects below are editorial and the prayer is unaltered.",
      intentionTheme:
        "the safety of mothers and children, and confidence in God's providence over a family's future",
      days: repeatedPrayerDays(GERARD_PRAYER, [
        {
          title: "Thanks to the Blessed Trinity",
          meditation:
            "The prayer is addressed to God first and to the saint second. Everything asked here is asked of the Trinity, through merits which are Christ's before they are Gerard's.",
          intentionPrompt:
            "Am I praying to God through the saints, or to the saints instead of God?",
        },
        {
          title: "The Virtues With Which You Adorned Him",
          meditation:
            "Gerard's holiness was not spectacular in its materials: obedience, poverty, hard work, and silence under a false accusation. The prayer thanks God for those before it mentions any miracle.",
          intentionPrompt:
            "What ordinary duty am I doing badly that holiness would require me to do well?",
        },
        {
          title: "That Your Kingdom May Come About on Earth",
          meditation:
            "Before the personal request the prayer asks that God accomplish His own work. Petition set inside that frame is protected from becoming purely self-regarding.",
          intentionPrompt: "How does what I am asking for serve something larger than myself?",
        },
        {
          title: "In Union With Jesus and Mary",
          meditation:
            "The received text asks through Gerard's merits in union with those of Jesus and Mary. No saint's merits stand alone; they are a share in Christ's.",
          intentionPrompt: "Do I really believe my prayers are heard because of Christ?",
        },
        {
          title: "Always So Ready to Help",
          meditation:
            "The prayer calls him a powerful intercessor always ready to help those who have recourse to him. Confidence of this kind is the ordinary Catholic instinct about the communion of saints.",
          intentionPrompt: "Whom in heaven do I actually think of as a friend?",
        },
        {
          title: "Before the Throne of Divine Mercy",
          meditation:
            "Come before the throne of Divine Mercy and do not leave without being heard. The boldness of the phrase belongs to the old novenas and is meant to stir confidence, not to command God.",
          intentionPrompt: "Have I asked for what I want in plain words?",
        },
        {
          title: "This Important and Urgent Affair",
          meditation:
            "The received prayer lets the petitioner call the matter important and urgent. God is not offended by urgency; He is the one who gave us the capacity to care this much.",
          intentionPrompt: "What is the urgency underneath my request?",
        },
        {
          title: "Mothers and Children",
          meditation:
            "The second received prayer beseeches the master of life, from whom all parenthood proceeds, for the blessing of children. Devotion to Gerard has long belonged to women in pregnancy and to couples waiting.",
          intentionPrompt: "Which family that I know is carrying a hidden grief about children?",
        },
        {
          title: "Heirs to the Kingdom of God's Glory",
          meditation:
            "The prayer asks not only for children but for children raised up to God — heirs to the kingdom of glory. Catholic prayer about family always looks past this life.",
          intentionPrompt: "Am I raising, or helping to raise, anyone for heaven?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-gerard-majella",
      typicalStartDate: "7 October, ending on the eve of his memorial, 16 October",
      citations: [CD_GERARD, NA_NOVENA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-francis-of-assisi",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_FRANCIS_ASSISI, BXVI_FRANCIS_OF_ASSISI, NA_FRANCIS],
    payload: {
      slug: "novena-saint-francis-of-assisi",
      title: "Novena to Saint Francis of Assisi",
      summary:
        "Nine days of prayer to the Poverello, kept from 25 September to 3 October before his feast on 4 October. The received form is three short petitions, each followed by a Glory Be, asking for detachment from the world, sorrow for sin, and the grace to bear the mortification of Christ in our bodies.",
      background:
        "Francis of Assisi (1181/2-1226) renounced his father's wealth, rebuilt the Church by a poverty and obedience that Innocent III recognised, and two years before his death received the stigmata on Mount La Verna. Benedict XVI, teaching on him in 2010, drew out how his radical poverty was inseparable from his obedience to the Church and his love of the Eucharist. This is a private devotion. The received form repeats the same three petitions on each of the nine days, closing with five Our Fathers, Hail Marys and Glory Bes in honour of the five wounds; the day-by-day subjects below are editorial and the prayers are unaltered.",
      intentionTheme: "poverty of spirit, sorrow for sin, and conformity to Christ crucified",
      days: repeatedPrayerDays(FRANCIS_ASSISI_PRAYER, [
        {
          title: "He Renounced All the Comforts of His Home",
          meditation:
            "Francis handed back even his clothes to his father in the square at Assisi. The first petition asks for a generous contempt of all things in this world, which is not disdain for creation but freedom from being owned by it.",
          intentionPrompt: "What possession would be hardest for me to lose, and why?",
        },
        {
          title: "The Life of Poverty of Jesus Christ",
          meditation:
            "Francis's poverty was an imitation, not an ideology: he wanted to live as the Christ of the Gospels lived. Benedict XVI notes that this is what made it fruitful rather than merely radical.",
          intentionPrompt: "Is my simplicity, such as it is, for Christ or for my own self-image?",
        },
        {
          title: "That We May Secure the True and Eternal Things",
          meditation:
            "The first petition ends by naming what detachment is for: the true and eternal things of heaven. Renunciation with no object is only loss.",
          intentionPrompt: "What eternal good am I actually working toward?",
        },
        {
          title: "He Wept Over the Passion of the Redeemer",
          meditation:
            "The second petition recalls that Francis wept continually over the sufferings of Christ. Compunction of this kind is a gift, and it is right to ask for it.",
          intentionPrompt: "When did my sin last actually grieve me?",
        },
        {
          title: "Zeal for the Salvation of Souls",
          meditation:
            "The same petition remembers that he laboured most zealously for the salvation of souls — preaching in Italy, and going unarmed to the Sultan in Egypt during the Fifth Crusade.",
          intentionPrompt: "Whom have I stopped hoping for?",
        },
        {
          title: "Those Sins by Which We Have Crucified Him Afresh",
          meditation:
            "The prayer asks for tears over our own sins, which is where devotion to the Passion becomes personal rather than sentimental.",
          intentionPrompt: "What sin have I been treating as small?",
        },
        {
          title: "Loving Above All Things Suffering and the Cross",
          meditation:
            "The third petition names what most people find hardest in Francis: he loved the cross. It is asked for as a grace, not claimed as an achievement.",
          intentionPrompt: "What cross am I currently trying to put down?",
        },
        {
          title: "The Miraculous Stigmata",
          meditation:
            "On La Verna in 1224 he received the wounds of Christ and became, as the prayer says, a living image of Jesus Christ crucified. The five Our Fathers said at the end honour those five wounds.",
          intentionPrompt: "Where is Christ's likeness visible in my life, if anywhere?",
        },
        {
          title: "Perseverance, a Holy Death, and a Happy Eternity",
          meditation:
            "The closing petition of the novena is the same as that of every other: perseverance to the end. Francis called death his sister and greeted her; the novena asks for the grace to be able to.",
          intentionPrompt: "What would I need to change to be able to greet death without dread?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-francis-of-assisi",
      typicalStartDate: "25 September, ending on the eve of his feast, 4 October",
      citations: [CD_FRANCIS_ASSISI, BXVI_FRANCIS_OF_ASSISI, NA_FRANCIS],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-benedict",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_BENEDICT, BXVI_BENEDICT_OF_NURSIA, NA_BENEDICT],
    payload: {
      slug: "novena-saint-benedict",
      title: "Novena to Saint Benedict of Nursia",
      summary:
        "Nine days of prayer to the father of Western monasticism and patron of Europe, kept from 2 to 10 July before his feast on 11 July. The received prayer asks his intercession against the dangers that surround us daily, against selfishness and indifference, and for the grace to see and serve Christ in others.",
      background:
        "Benedict of Nursia (c. 480-547) withdrew to Subiaco, gathered disciples, and at Monte Cassino wrote the Rule whose moderation and wisdom shaped the monastic life of the West; Paul VI proclaimed him patron of Europe in 1964, and Benedict XVI took his name. Devotion to him includes the Medal of St. Benedict with its exorcism formula, which is why the older manuals head this novena as a prayer for protection. It is a private devotion. The received form repeats one prayer on each of the nine days; the day-by-day subjects below are editorial and the prayer is unaltered.",
      intentionTheme:
        "protection from evil, and the ordering of an ordinary life around prayer and work",
      days: repeatedPrayerDays(BENEDICT_PRAYER, [
        {
          title: "Sublime Model of Virtue",
          meditation:
            "The novena opens by looking at Benedict as a model before treating him as a protector. His Rule is famous for its moderation: it asks for nothing heroic, only for constancy.",
          intentionPrompt: "What small rule of life could I actually keep?",
        },
        {
          title: "Pure Vessel of God's Grace",
          meditation:
            "Benedict fled Rome as a student because of its corruption and lived alone in a cave at Subiaco for three years. Purity of heart, in the monastic tradition, is not innocence but singleness of aim.",
          intentionPrompt: "What is competing with God for the centre of my attention?",
        },
        {
          title: "The Dangers That Daily Surround Me",
          meditation:
            "The prayer names ordinary daily danger rather than dramatic assault. Most spiritual harm is done by drift, and the Rule exists precisely to interrupt drift.",
          intentionPrompt: "What in my daily routine is quietly harming my soul?",
        },
        {
          title: "Shield Me Against My Selfishness",
          meditation:
            "The petition asks for protection from myself first: from selfishness and from indifference to God and to my neighbour. The enemy the Rule spends most of its time on is self-will.",
          intentionPrompt: "Whose need have I been ignoring because noticing it would cost me?",
        },
        {
          title: "Inspire Me to Imitate You",
          meditation:
            "Benedict's imitators are not chiefly monks. Ora et labora — prayer and work in a settled rhythm — is a pattern any household or workplace can borrow.",
          intentionPrompt: "Do prayer and work have fixed times in my week, or only leftover ones?",
        },
        {
          title: "To See and Serve Christ in Others",
          meditation:
            "The Rule commands that guests be received as Christ and that the sick be served before and above all. This is the prayer's central petition and the Rule's most demanding sentence.",
          intentionPrompt: "Whom did I fail to receive as Christ this week?",
        },
        {
          title: "In the Trials, Miseries and Afflictions of Life",
          meditation:
            "The prayer asks for favours and graces needed in real trouble. Benedict's own life included a community that tried to poison him; his answer was to leave quietly and begin again.",
          intentionPrompt: "What trouble am I in that I have not asked God's help with?",
        },
        {
          title: "You Never Dismissed Anyone Without Consolation",
          meditation:
            "The received text recalls that his heart was full of love and mercy toward the afflicted. An abbot in the Rule is told to temper all things so that the strong have something to strive for and the weak nothing to run from.",
          intentionPrompt: "Am I harder on other people than God is on me?",
        },
        {
          title: "To Run in the Sweetness of His Loving Will",
          meditation:
            "The closing petition echoes the Rule's prologue: as we progress in the monastic life we shall run with hearts enlarged in the way of God's commandments. The novena ends asking for that enlargement.",
          intentionPrompt:
            "Do I obey God grudgingly or gladly, and what would make the difference?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-benedict-of-nursia",
      typicalStartDate: "2 July, ending on the eve of his memorial, 11 July",
      citations: [CD_BENEDICT, BXVI_BENEDICT_OF_NURSIA, NA_BENEDICT],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-patrick",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CD_PATRICK, NA_PATRICK],
    payload: {
      slug: "novena-saint-patrick",
      title: "Novena to Saint Patrick",
      summary:
        "Nine days of prayer to the Apostle of Ireland, kept from 8 to 16 March before his feast on 17 March. The received prayer is above all an act of gratitude for the gift of the faith received through him, and it prays for one's native land, its bishops and its priests before it prays for oneself.",
      background:
        "Patrick, a Romano-British Christian carried to Ireland as a slave, escaped, returned as a bishop, and evangelised the island in the fifth century; his own Confessio survives and is one of the earliest Christian documents from the British Isles. The prayer below comes from the Irish prayer books of the nineteenth century and reflects them in its concern for the Church of Ireland and for the emigrant's memory of home. It is a private devotion. The received form repeats one prayer on each of the nine days, with the versicle Pray for us, O glorious Saint Patrick; the day-by-day subjects below are editorial and the prayer is unaltered.",
      intentionTheme:
        "gratitude for the faith handed down, and the conversion and perseverance of one's own country",
      days: repeatedPrayerDays(PATRICK_PRAYER, [
        {
          title: "A Father to Me for Ages Before My Birth",
          meditation:
            "The prayer's first thought is that the faith reached me through somebody, centuries before I existed. Gratitude for the chain of transmission is the whole opening movement.",
          intentionPrompt: "Who handed the faith on to me, and have I thanked God for them?",
        },
        {
          title: "That Faith Which Is Dearer Than Life",
          meditation:
            "The received text calls the inherited faith dearer than life. In Ireland that phrase was not rhetorical, and it is worth asking whether it is more than rhetorical for me.",
          intentionPrompt: "What would I actually give up rather than lose the faith?",
        },
        {
          title: "The Cries of Little Children",
          meditation:
            "The prayer recalls the voice of the Irish in Patrick's dream, calling him to come and walk among them again. He returned to the country of his slavery because he was asked.",
          intentionPrompt: "Is God calling me back to something I would rather leave behind?",
        },
        {
          title: "Mediator of My Homage to Almighty God",
          meditation:
            "The saint is asked to carry our thanks to God, not to receive them. Every honour paid to Patrick in this novena terminates in the God who made him a saint.",
          intentionPrompt: "Do I let devotion to the saints lead me to God, or stop with them?",
        },
        {
          title: "Our Forefathers Who Now Enjoy Eternal Bliss",
          meditation:
            "The prayer takes courage from the generations already saved through Patrick's courage and charity. Hope is easier when it has a history.",
          intentionPrompt: "Which of my own dead do I believe are with God?",
        },
        {
          title: "To Love God With My Whole Heart",
          meditation:
            "The personal petition, when it comes, is unremarkable and total: to love God wholly, serve Him with my whole strength, and persevere in good purposes to the end.",
          intentionPrompt: "What good purpose have I abandoned that I should take up again?",
        },
        {
          title: "A Thousand Lives to Save One Soul",
          meditation:
            "The prayer calls Patrick a faithful shepherd who would have laid down a thousand lives to save one soul. That is the measure by which pastoral work, and our own concern for others, is judged.",
          intentionPrompt: "For whose soul am I willing to be inconvenienced?",
        },
        {
          title: "Be a Father to the Church",
          meditation:
            "The novena prays for the local Church and especially for its chief pastors and teachers, that they may nurture the flock with the word of life and the bread of salvation.",
          intentionPrompt: "When did I last pray for my own bishop and parish priest by name?",
        },
        {
          title: "To Unite Science With Virtue",
          meditation:
            "The last movement recalls the schools of early Ireland, where learning and holiness were taught together, and asks for the same union today: all Christian duty consecrated to the glory of God.",
          intentionPrompt: "Is my work consecrated to God, or merely kept separate from Him?",
        },
      ]),
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-patrick",
      typicalStartDate: "8 March, ending on the eve of his feast, 17 March",
      citations: [CD_PATRICK, NA_PATRICK],
    },
  },
];
