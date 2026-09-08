import type { CuratedEntry } from "../index";

/**
 * Novena group 1.
 *
 * These entries replace eight of the nine placeholder novenas that were
 * generated from a template. Every `prayerText` below is a received text
 * reproduced from the cited page — the nine "Affections and prayers" of St
 * Alphonsus Liguori's novena of the Holy Spirit, the nine day-prayers of the
 * Guadalupe, Antonian, Holy Face and Infant Jesus novenas, and the received
 * daily prayers of the Redemptorist novena to Our Lady of Perpetual Help and of
 * the traditional novenas to St Joseph and to the Immaculate Conception.
 * Nothing here is paraphrased or composed.
 *
 * There is deliberately no Sacred Heart novena here. The nine-day novena
 * published by the USCCB, which an earlier draft of this file reproduced, is
 * built out of texts still under copyright — day four is Diary 950 of St
 * Faustina Kowalska, and days one, two, five and nine are modern compositions,
 * the last of them the bishops' own act of consecration — so it cannot be
 * vendored in full. The entry for that slug lives in ../novenas.ts and now
 * carries the traditional public-domain novena prayer to the Sacred Heart
 * instead, repeated on each of the nine days.
 *
 * Where a novena's received form repeats one prayer on
 * each of the nine days (St Joseph, the Immaculate Conception, Our Lady of
 * Perpetual Help), that is said plainly in `background` and the day-by-day
 * distinction lies in the received meditation subjects, not in an invented
 * prayer. The `meditation` field is a short editorial introduction to the day's
 * received subject; it never pretends to be part of the prayer.
 *
 * Obvious scanning slips in the transcribed sources (a zero for a capital O, a
 * period for a comma, a run-together word, "they" for "thy") have been silently
 * corrected; no wording has been changed.
 */

const ECATHOLIC_HOLY_SPIRIT = "https://www.ecatholic2000.com/cts/untitled-05.shtml";
const ECATHOLIC_ANTHONY = "https://www.ecatholic2000.com/cts/untitled-310.shtml";
const ECATHOLIC_JOSEPH = "https://www.ecatholic2000.com/cts/untitled-404.shtml";
const CC_GUADALUPE =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=940";
const CC_IMMACULATE =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1206";
const CC_HOLY_FACE =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1259";
const CC_INFANT = "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=897";
const PRAGJESU_HISTORY = "https://pragjesu.cz/en/history-of-the-statue/";
const OLPH_NOVENA = "https://maryourhelp.org/novena-to-our-lady-of-perpetual-help-day1.html";
const OLPH_ICON = "https://www.catholicculture.org/culture/library/view.cfm?id=1410";
const DIVINUM_ILLUD =
  "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_09051897_divinum-illud-munus.html";
const ECCLESIA_IN_AMERICA =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_22011999_ecclesia-in-america.html";
const PATRIS_CORDE =
  "https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20201208_patris-corde.html";
const BENEDICT_XVI_ANTHONY =
  "https://www.vatican.va/content/benedict-xvi/en/audiences/2010/documents/hf_ben-xvi_aud_20100210.html";
const FULGENS_CORONA =
  "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_08091953_fulgens-corona.html";
const CE_REPARATION = "https://www.newadvent.org/cathen/12775a.htm";

export const novenaGroupOne: CuratedEntry[] = [
  {
    contentType: "NOVENA",
    slug: "novena-holy-spirit",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [ECATHOLIC_HOLY_SPIRIT, DIVINUM_ILLUD],
    payload: {
      slug: "novena-holy-spirit",
      title: "Novena of the Holy Spirit (Saint Alphonsus Liguori)",
      summary:
        "The oldest novena in the Church, prayed in the nine days between the Ascension and Pentecost in imitation of the Apostles and the Blessed Virgin in the upper room. This is the form given by St. Alphonsus Liguori: nine meditations on divine love, each closing with his own affections and prayers to the Holy Spirit.",
      background:
        "St. Alphonsus Liguori (1696-1787), Doctor of the Church and founder of the Redemptorists, wrote this novena as nine meditations on charity, the gift proper to the Holy Spirit. It is a devotional novena for private and parish use, not a liturgical rite. Pope Leo XIII, in the encyclical Divinum Illud Munus (1897), directed that a solemn novena to the Holy Spirit be made each year in every parish of the world before Pentecost.",
      intentionTheme: "the outpouring of the Holy Spirit and the gift of divine charity",
      days: [
        {
          day: 1,
          title: "Love Is a Fire That Inflames the Heart",
          meditation:
            "God commanded that a fire be kept always burning on the altar of the old law; St. Gregory says that our hearts are those altars. Jesus came to cast fire on the earth, and it was under the form of tongues of fire that the Holy Spirit came down in the upper room. Today ask that this holy fire be kindled in you by prayer, which is the furnace in which divine love is enkindled.",
          prayerText:
            "O my God, up to now I have done nothing for Thee Who hast done so much for me. My coldness could well make Thee cast me away from Thee. But, O Holy Spirit, make warm what is cold. Deliver me from my lack of fervour and make me burn with the desire to please Thee. I now wish to deny all that pleases me. I would rather die than displease Thee in the least thing. To Thee Who hast appeared in the form of fiery tongues, I consecrate my tongue that it may not offend Thee again. Thou didst give it to me to praise Thee, but I, I have used it to injure Thee and cause others to offend Thee. I am sorry for my sins. For the love of Jesus Christ Who honoured Thee so much by His tongue when He walked this earth, grant that henceforward I may honour Thee by praising Thee, by asking often for Thy help and by speaking of Thy goodness and the infinite love Thou deservest. I love Thee, my supreme Good, I love Thee, O loving God. O Mary, most beloved Spouse of the Holy Spirit, obtain for me this holy fire.",
          intentionPrompt:
            "Where has my love for God gone cold, and what one act of love can I make today?",
        },
        {
          day: 2,
          title: "Love Is a Light That Enlightens the Soul",
          meditation:
            "One of the wounds left by original sin is a darkened reason, and every unruly passion is a veil over the truth. The Holy Spirit is called blessed light because he both enlightens the mind to see the evil of sin and warms the heart to hate it. Ask today for that light, and for the strength to walk in it.",
          prayerText:
            "Holy and Divine Spirit, I believe that Thou art true God, yet one God with the Father and the Son. I adore Thee and acknowledge Thee as the Giver of those lights which make me know the evil I have done in offending Thee and the obligation I have to love Thee. I thank Thee for these lights. I am sorry for having offended Thee. I have deserved to be left in darkness, but I see that I am not yet abandoned by Thee. Continue, O eternal Spirit, to enlighten my mind. Make me know still more Thy infinite goodness. Give me strength now to love Thee with all my heart. Add grace upon grace so that I may be gently drawn to Thee and compelled to love none but Thee. I ask for this grace through the merits of Jesus Christ. I love Thee, infinite Goodness, I love Thee more than myself. I will be all Thine. Accept me and do not permit me to be separated from Thee again. O my Mother, Mary, help me always by thy intercession.",
          intentionPrompt: "What truth about my life am I refusing to look at honestly?",
        },
        {
          day: 3,
          title: "Love Is a Fountain That Satisfies",
          meditation:
            "Our Lord promised the Samaritan woman water that would become in her a fountain springing up to eternal life. Every created thing leaves the heart thirsty again; only the love of God satisfies it. Ask today for that living water, and for the grace to stop drinking from cisterns that cannot hold it.",
          prayerText:
            "Lord, give me this water. Yes, Lord Jesus, I will say to Thee like the Samaritan woman: give me this water of divine love that I may turn away from this world and live only for Thee Who art so lovely. Water that which is dry. My soul is like a dry land where nothing but the briars and thorns of sin grow. Ah! give me, before I pass out of this world, an outpouring of divine grace to make my soul fruitful in works worthy of Thy heavenly glory. O Fountain of living water, O supreme Good, too often have I left Thee for the corrupt waters of this earth which have deprived me of Thy love. Why did not death overtake me before I offended Thee? In the future I will seek nothing but Thee, O my God. Assist me and grant that I may be faithful to Thee. Mary, my hope, keep me ever under thy protection.",
          intentionPrompt: "What am I trying to satisfy with something other than God?",
        },
        {
          day: 4,
          title: "Love Is a Dew Which Fertilizes",
          meditation:
            "The Church prays that the Holy Spirit may water the soul as dew waters dry ground; and the ordinary channel of that dew is prayer. St. Alphonsus taught all his life that whoever prays will be saved and whoever does not pray will not. Ask today above all for the gift of prayer, and for perseverance in it when prayer is dry.",
          prayerText:
            "O holy and Divine Spirit, I will no longer live to myself. I will spend the remaining days of my life in loving and pleasing Thee. For that purpose I beseech Thee to grant me the gift of prayer. Come into my heart and teach me how to pray as I ought. Give me strength not to neglect prayer when my soul is weary and dry before Thee. Give me the spirit of prayer, that is, the grace to pray always and to say those prayers that are most agreeable to Thy divine Heart. My sins have endangered my salvation, but I understand from so many kindnesses in my regard that Thou wishest me to be saved and to become a saint. I will become a saint to please Thee. I love Thee, O supreme Good, O my Love and my All. I give myself wholly to Thee. O Mary, my hope, protect me.",
          intentionPrompt: "Have I given up prayer because it felt dry, or kept at it anyway?",
        },
        {
          day: 5,
          title: "Love Is a Repose That Refreshes",
          meditation:
            "The Church calls the Holy Spirit the soul's sweet guest and its rest. There is no rest in a will divided between God and self; peace comes only when we want what God wants. Ask today for the grace to say Speak, Lord, for thy servant heareth, and to mean it.",
          prayerText:
            "O my God, how often have I opposed and despised Thy will to do my own. I am sorry for this evil more than for any other. Henceforward, O Lord, I will love Thee with all my heart. Speak, Lord, for thy servant heareth. Make me know what Thou wouldst have me do and I will do it all. I will always desire and love nothing but Thy will. O Holy Spirit, help my weakness. Thou art goodness itself: how can I love anything but Thee? Ah! may Thy holy love draw my whole heart to Thee! I leave all things to give myself entirely to Thee. Accept me and help me. O my Mother Mary, I trust in thee.",
          intentionPrompt: "In what matter am I still preferring my own will to God's?",
        },
        {
          day: 6,
          title: "Love Is the Virtue Which Gives Us Strength",
          meditation:
            "Charity is strong as death; the martyrs were not braver than we by nature but more loved and more loving. Love is proved not by feelings but by what it is willing to suffer. Ask today for the courage to do and to bear something real for God before you die.",
          prayerText:
            "O God of my soul, I pretend to love Thee, and yet I do nothing for Thy love. Would it not be a sign that I love Thee not, or very little? But send me the Holy Spirit, O Jesus, the Holy Spirit Who will give me strength to suffer for Thy love and do something for Thee before I die. I pray Thee, O my beloved Redeemer, let me not die now, cold and ungrateful to Thee as I have been. Though I have committed so many sins for which I should be in hell, grant me the courage to love suffering, to do something for Thee. O my God, Whose nature is all goodness and love, Thou desirest to be the guest of my soul from which I have so often driven Thee. Oh! come and dwell in it: be Thou its Master and make it all Thine. I love Thee, O my Lord, but if I love Thee Thou art already with me, since St. John assures us that he who abides in love abides in God and God in him. Thou art within me then, O my God. Make my love more ardent still. Bind me with stronger chains that I may desire, seek and love nothing but Thee. Let me never be separated from Thy love. I desire to be all Thine, O my Jesus. O Mary, my Queen and Advocate, obtain for me love and perseverance.",
          intentionPrompt: "What hard thing is love asking of me that I have been avoiding?",
        },
        {
          day: 7,
          title: "Love Causes God to Dwell in Our Souls",
          meditation:
            "If anyone love me, my Father will love him, and we will come to him and make our abode with him. The soul in grace is a living temple of the Holy Trinity. Ask today that God take full possession of you, and that nothing be kept back from him.",
          prayerText:
            "I understand, O my God, that Thou wantest me to be all Thine. Many times have I driven Thee from my soul, but Thou didst not shrink from returning to be united to me again. Ah! take possession of my entire self, for today I give myself wholly to Thee. Do Thou accept me, O Jesus, and do not permit that I should again live in the future, no, not even for a moment, without Thy love. Thou seekest me and I seek none but Thee. Thou lovest me and I love Thee. Since Thou lovest me, bind me to Thyself that I may never abandon Thee. O Mary, Queen of heaven, I trust in thee.",
          intentionPrompt: "What corner of my life have I not yet handed over to God?",
        },
        {
          day: 8,
          title: "Love Is a Bond Which Binds",
          meditation:
            "Charity is called the bond of perfection because it binds the soul to God and holds all the other virtues together. Christ bound himself to us by his blood; love asks that we bind ourselves back to him and detach our hearts from what competes with him. Ask today for a single-hearted desire: Thee alone.",
          prayerText:
            "O my dear Jesus, Thou hast put me under a sweet obligation to love Thee, and how much it has cost Thee to win my love! I would be an ungrateful wretch if I loved Thee little after that, or if I let creatures share my heart with Thee Who hast given Thy life and Thy blood for me. I wish to detach myself from everything and place all my affections in Thee alone. But I am weak and unable to realize this desire. Thou Who hast inspired it, help me to bring it into effect. O my beloved Jesus, pierce my heart with the arrows of Thy love so that it may sigh ever after Thee and be melted in Thee! Thou alone I seek, Thou alone may I always seek. None but Thee may I desire and find! My Jesus, I desire only Thee and nothing more. Grant that I may repeat it always during my life, and especially at the moment of my death: I desire only Thee and nothing more. O my Mother Mary, from henceforward make me desire nothing but God.",
          intentionPrompt: "What attachment is competing with God for my heart?",
        },
        {
          day: 9,
          title: "Love Is a Treasure Containing Every Good",
          meditation:
            "Charity is the treasure hidden in the field, worth everything a man has. The Lord is good to the soul that seeketh him: whoever finds this love finds every other good with it. On this last day give yourself over entirely and ask the Holy Spirit to burn away every affection that is not for God.",
          prayerText:
            "I have not lived for Thee in the past, O my God, but rather for myself and my own gratifications. I have accordingly turned my back upon Thee, my supreme good. But I take heart at these words of Jeremias: The Lord is good to the soul that seeketh him. He says then that Thou art all goodness for him who seeks Thee. O my beloved Lord, I know well the evil I have done in going away from Thee and I am sorry for it with all my heart. I know the infinite treasure we find in Thee. I will profit by this light that Thou givest me. I leave all things and choose Thee for my only love. My God, my love, my all, I love Thee, I sigh after Thee, I desire Thee. Come, O Holy Spirit, come and consume in me by Thy sacred fire every affection that is not for Thee. Make me all Thine and grant me the grace to overcome everything in order to please Thee. O Mary, my Advocate and Mother, help me by thy prayers.",
          intentionPrompt: "What one resolution will I carry out of this novena into Pentecost?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-alphonsus-liguori",
      typicalStartDate:
        "The day after the Solemnity of the Ascension, ending on the Vigil of Pentecost",
      relatedFeastSlug: "solemnity-pentecost",
      citations: [ECATHOLIC_HOLY_SPIRIT, DIVINUM_ILLUD],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-our-lady-of-guadalupe",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CC_GUADALUPE, ECCLESIA_IN_AMERICA],
    payload: {
      slug: "novena-our-lady-of-guadalupe",
      title: "Novena in Honor of Our Lady of Guadalupe",
      summary:
        "A nine-day novena to the Patroness of the Americas, prayed from December 4 through December 12. Each day has its own petition, and each closes with an Our Father, a Hail Mary and a Glory Be.",
      background:
        "The novena honours the apparitions of the Blessed Virgin Mary to St. Juan Diego Cuauhtlatoatzin at Tepeyac in December 1531 and the image left on his tilma, venerated today in the basilica in Mexico City. St. John Paul II, who canonized Juan Diego in 2002, called Our Lady of Guadalupe the Mother and Evangelizer of America and asked the whole continent to entrust its future to her (Ecclesia in America, 1999). This is a devotional novena, not a liturgical rite.",
      intentionTheme:
        "the maternal intercession of Our Lady of Guadalupe for the Americas and for every family",
      days: [
        {
          day: 1,
          title: "Gentleness and Strength",
          meditation:
            "The novena begins by asking Mary for the two things her own life holds together without strain: gentleness toward others and strength in God. Name here the favour you will carry through all nine days.",
          prayerText:
            "Dearest Lady of Guadalupe, fruitful Mother of holiness, teach me your ways of gentleness and strength. Hear my humble prayer offered with heartfelt confidence to beg this favor. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "What favour am I entrusting to Our Lady over these nine days?",
        },
        {
          day: 2,
          title: "A Lively Faith to Do God's Will",
          meditation:
            "At Tepeyac Mary spoke in the language and imagery of a conquered people and drew them to her Son. Ask today for the living faith that says with her, let it be done to me according to thy word.",
          prayerText:
            "O Mary, conceived without sin, I come to your throne of grace to share the fervent devotion of your faithful Mexican children who call to you under the glorious Aztec title of Guadalupe. Obtain for me a lively faith to do your Son's holy will always: May His will be done on earth as it is in heaven. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "Where is God's will clear to me and still unwelcome?",
        },
        {
          day: 3,
          title: "Courage amid Sorrow",
          meditation:
            "Simeon foretold that a sword would pierce Mary's soul. Those who ask her help are not promised a life without thorns but the strength to walk through them without bitterness.",
          prayerText:
            "O Mary, whose Immaculate Heart was pierced by seven swords of grief, help me to walk valiantly amid the sharp thorns strewn across my pathway. Obtain for me the strength to be a true imitator of you. This I ask you, my dear Mother. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "What suffering am I being asked to carry patiently right now?",
        },
        {
          day: 4,
          title: "Charity toward Those in Need",
          meditation:
            "Mary went in haste to Elizabeth; her charity was practical and immediate. Ask today for a will strong enough to seek the good of someone who needs you.",
          prayerText:
            "Dearest Mother of Guadalupe, I beg you for a fortified will to imitate your divine Son's charity, to always seek the good of others in need. Grant me this, I humbly ask of you. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "Whose need am I aware of and have not yet answered?",
        },
        {
          day: 5,
          title: "Pardon of Sins and Perseverance",
          meditation:
            "The heart of every novena is conversion. Ask pardon today for your sins, the grace to serve God more faithfully from now on, and the final grace of praising him with Mary for ever.",
          prayerText:
            "O most holy Mother, I beg you to obtain for me pardon of all my sins, abundant graces to serve your Son more faithfully from now on, and lastly, the grace to praise Him with you forever in heaven. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "When did I last go to confession?",
        },
        {
          day: 6,
          title: "Vocations to the Priesthood and Religious Life",
          meditation:
            "Mary is the Mother of vocations because she is the Mother of the one High Priest. Pray today by name for a priest, a seminarian, or a religious you know.",
          prayerText:
            "Mary, Mother of vocations, multiply priestly vocations and fill the earth with religious houses which will be light and warmth for the world, safety in stormy nights. Beg your Son to send us many priests and religious. This we ask of you, O Mother. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "Which priest or religious will I pray for by name today?",
        },
        {
          day: 7,
          title: "The Christian Family",
          meditation:
            "The image of Guadalupe shows a woman with child, and the novena turns naturally to the household. Pray today for parents, for children, and for families that no longer pray together.",
          prayerText:
            "O Lady of Guadalupe, we beg you that parents live a holy life and educate their children in a Christian manner; that children obey and follow the directions of their parents; that all members of the family pray and worship together. This we ask of you, O Mother. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "What is one thing my household could pray together this week?",
        },
        {
          day: 8,
          title: "Faithfulness in My State of Life",
          meditation:
            "Juan Diego was sanctified by obedience in a very ordinary errand. Ask today for constancy in the duties that are actually yours, rather than the ones you would have chosen.",
          prayerText:
            "With my heart full of the most sincere veneration, I prostrate myself before you, O Mother, to ask you to obtain for me the grace to fulfill the duties of my state in life with faithfulness and constancy. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "Which duty of my state in life am I neglecting?",
        },
        {
          day: 9,
          title: "To See Her Face to Face",
          meditation:
            "The novena closes on the feast itself with the prayer of the Church: that those who honour Mary on earth may come to see her in heaven. Give thanks today, whatever the answer to your petition has been.",
          prayerText:
            "O God, You have been pleased to bestow upon us unceasing favors by having placed us under the special protection of the Most Blessed Virgin Mary. Grant us, your humble servants, who rejoice in honoring her today upon earth, the happiness of seeing her face to face in heaven. Our Father, Hail Mary, Glory be.",
          intentionPrompt: "What am I thankful for at the end of these nine days?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-juan-diego",
      associatedMarianTitleSlug: "our-lady-of-guadalupe",
      typicalStartDate: "December 4, concluding on the feast of Our Lady of Guadalupe, December 12",
      citations: [CC_GUADALUPE, ECCLESIA_IN_AMERICA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-joseph",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [ECATHOLIC_JOSEPH, PATRIS_CORDE],
    payload: {
      slug: "novena-saint-joseph",
      title: "Novena in Honour of Saint Joseph",
      summary:
        "The traditional nine-day novena to St. Joseph, prayed from March 10 to March 18 in preparation for his solemnity, or on nine consecutive Wednesdays. The same received prayers are said on each of the nine days; what changes is the day's subject for meditation.",
      background:
        "This is the received form of the St. Joseph novena as printed in devotional manuals: a preparatory prayer to the Holy Spirit, the two daily prayers to St. Joseph given below, and a different subject for meditation on each of the nine days. Blessed Pius IX declared St. Joseph patron of the universal Church in 1870; Leo XIII wrote Quamquam Pluries in 1889; Pope Francis added his name to all the Eucharistic Prayers in 2013 and proclaimed a Year of St. Joseph with the apostolic letter Patris Corde in 2020. Because the daily prayer does not change, the novena is easily prayed by heart.",
      intentionTheme:
        "the fatherly protection of Saint Joseph over families, work, and a happy death",
      days: [
        {
          day: 1,
          title: "Faith, Hope and Charity",
          meditation:
            "The three theological virtues contain the whole of our happiness. By faith we believe what God has promised, by hope we await it, and in heaven both will give way to charity alone, which never ends. Ask St. Joseph, who lived by faith in a promise he could not see, for an increase of all three.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "Which of the three — faith, hope, or charity — is weakest in me?",
        },
        {
          day: 2,
          title: "Love of Our Neighbour",
          meditation:
            "Bear with one another and forgive one another, as God has pardoned you. Patience would cost us very little if we remembered how much Christ bears with us. Ask St. Joseph, who bore in silence with a mystery he did not understand, for patience with the people God has actually given you.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "Whom am I finding it hardest to bear with, and why?",
        },
        {
          day: 3,
          title: "The Greater the Cross, the Brighter the Crown",
          meditation:
            "A stone is chiselled according to the place it is destined to occupy in the building. Trials are measured to the glory God intends for us; nothing befalls us but what has pleased the Lord. Ask for the steadiness that lets you stay on the cross until God unfastens you from it.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "What cross am I trying to put down that God has not yet lifted?",
        },
        {
          day: 4,
          title: "The Thought of Heaven",
          meditation:
            "Raise your mind to the heavenly Jerusalem and ask the saints how they arrived there: the apostles chiefly by love, the martyrs by constancy, the doctors by meditation, the confessors by mortification, the virgins by purity, and all of them by humility. Every trial of this life ends; what follows does not.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "How often do I actually think about heaven?",
        },
        {
          day: 5,
          title: "The Vanity of Earthly Things",
          meditation:
            "We are not sent into the world to amuse ourselves but to spend this exile well and win a happy eternity. Honours, riches and pleasures pass; do not set your heart on a happiness that is only a dream. Ask St. Joseph, a poor workman who possessed the Son of God, for a right estimate of what things are worth.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "What am I spending myself on that will not last?",
        },
        {
          day: 6,
          title: "The Most Tender of Fathers",
          meditation:
            "Joseph is our father because we are Mary's children and co-heirs with her Son. St. Thomas observes that God did not need to command parents to love their children, since nature does the work of the law; how much more, then, will Joseph not forget those entrusted to him. Bring him a family need today.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "Which member of my family will I entrust to St. Joseph today?",
        },
        {
          day: 7,
          title: "The Love of God",
          meditation:
            "To love God is the one end for which we were made. Faith and hope will be rewarded and then cease; charity alone enters heaven and lasts for ever. Let God be before your eyes in all you do, and bear joyfully whatever mortifies self-love.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "What would loving God with all my strength change about today?",
        },
        {
          day: 8,
          title: "Be Ready",
          meditation:
            "Few are converted at the hour of death, because that hour is dark and the soul is occupied with the body. As our last illness finds us, so shall we be for eternity. St. Joseph is invoked as patron of a happy death because he died in the arms of Jesus and Mary; ask him for the grace to be ready.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "If today were my last, what would I want to have put right?",
        },
        {
          day: 9,
          title: "Never Lose Courage",
          meditation:
            "St. Bonaventure says that perseverance carries us to perfection faster than anything else: however slowly the traveller walks, if he walks every day he arrives. If you fall a thousand times a day, rise a thousand times; join your thread where it broke instead of starting a new one. The novena ends with St. Joseph's own petition for perseverance.",
          prayerText:
            "O glorious St Joseph, faithful follower of Jesus Christ, to you we raise our hearts and hands to implore your powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favour we now implore. O Guardian of the Word Incarnate, we feel animated with confidence that your prayers on our behalf will be graciously heard before the throne of God. V. O glorious St Joseph, through the love you bear to Jesus Christ, and for the glory of his name. R. Hear our prayers and obtain our petitions. O glorious St Joseph, spouse of the Immaculate Virgin, obtain for me a pure, humble and charitable mind, and perfect resignation to the divine will. Be my guide, father and model through life, that I may merit to die, as you did, in the arms of Jesus and Mary. O glorious St Joseph, I most humbly beg of you, by the love and care you have for Jesus and Mary, to take my affairs, spiritual and temporal into your hands. Draw from them the greater glory of God and obtain for me the grace to do his holy will. O Joseph, virgin foster father of Jesus, most pure spouse of the Virgin Mary, pray daily for us to the same Jesus, son of God, that being strengthened by the powers of his grace, and successfully striving during life, we may be crowned in death by him. Our Father. Hail Mary. Glory. St Joseph, foster father of Our Lord Jesus Christ, and true spouse of the Virgin Mary, pray for us. Jesus, Mary and good St Joseph, bless us now and in the agony of death. Jesus, Mary, Joseph.",
          intentionPrompt: "Where have I given up because I fell, and where will I begin again?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-joseph",
      associatedDevotionSlug: "devotion-to-saint-joseph",
      typicalStartDate: "March 10, concluding March 18, the eve of the Solemnity of Saint Joseph",
      citations: [ECATHOLIC_JOSEPH, PATRIS_CORDE],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-saint-anthony",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [ECATHOLIC_ANTHONY, BENEDICT_XVI_ANTHONY],
    payload: {
      slug: "novena-saint-anthony",
      title: "Novena to Saint Anthony of Padua",
      summary:
        "A nine-day novena to St. Anthony of Padua, Doctor of the Church, in which each day takes one of his virtues and closes with its own received prayer. The custom is to make it on nine consecutive Tuesdays, or in the nine days before his feast on June 13.",
      background:
        "St. Anthony (1195-1231) was born in Lisbon, joined the Canons Regular of St. Augustine and then the newly founded Friars Minor, preached across Italy and southern France, and died at thirty-six. He was canonized within a year of his death and declared a Doctor of the Church in 1946. The daily subjects of this novena follow the outline of Pope Pius XI's apostolic letter Antoniana Solemnia, written for the seventh centenary of his death in 1931. The Tuesday devotion to St. Anthony dates from the seventeenth century.",
      intentionTheme:
        "the intercession of Saint Anthony for the poor, the lost, and those in urgent need",
      days: [
        {
          day: 1,
          title: "Vocation",
          meditation:
            "Anthony was born to wealth and a promising career and gave up both, first for the Canons Regular and then for the poverty of the Franciscans. He heard the words spoken to the rich young man as spoken to himself. Ask today for the grace to hear and answer God's call in your own state of life, and pray for vocations to the priesthood and religious life.",
          prayerText:
            "Glorious St. Anthony, who from your earliest years were consecrated to the service of God, and practiced the greatest austerities, who burning with zeal for justice, caused yourself to be conveyed to the coast of Africa that you might preach the Gospel to the Saracens, obtain for us the grace to apply ourselves continually to the service of God, to our personal mortification and the salvation of our brethren, that we may thus become true disciples and imitators of Jesus Christ.",
          intentionPrompt: "What is God asking of me that I keep postponing?",
        },
        {
          day: 2,
          title: "Preaching and the Word of God",
          meditation:
            "Anthony knew the Scriptures so thoroughly that it was said he could have restored them from memory. He preached not for applause or gain but out of the divine truth he drew each day from the sacred text. Ask today for a love of Scripture, and pray with his own prayer before study.",
          prayerText:
            "O Light of the world, Infinite God, Father of Eternity, Giver of wisdom and knowledge, and ineffable Dispenser of every spiritual grace, Who knowest all things before they are made, Who makest the darkness and the light, stretch forth Thy hand and place Thy spirit, O Lord, in me that I may understand and retain what I learn and meditate on. Do Thou lovingly, mercifully, and gently inspire me with Thy grace. Do Thou teach, guide, and strengthen the thoughts of my mind and let Thy discipline instruct me to the end, and the counsel of the Most High help me, through Thy infinite wisdom and mercy. Amen.",
          intentionPrompt: "When did I last read a Gospel passage slowly and prayerfully?",
        },
        {
          day: 3,
          title: "Chastity",
          meditation:
            "Pius XI wrote that among the gifts adorning Anthony's soul, perfect chastity shone the brightest, and that he won it not without temptation. The images that show him holding the Child Jesus and a lily are a picture of purity of heart. Ask today for that purity, in thought as much as in act.",
          prayerText:
            "O sweet Jesus, Thou best and only hope of afflicted souls, I prostrate myself at Thy Feet, and beseech Thee, through the immeasurable love and grace with which Thou didst visit Thy blessed servant, St. Anthony, when Thou didst comfort and embrace him, to come to me at his intercession and let me taste how sweet Thy presence is in the souls that trust in Thee. Amen.",
          intentionPrompt: "What occasion of sin do I need to give up rather than manage?",
        },
        {
          day: 4,
          title: "Humility",
          meditation:
            "Anthony hid his learning and washed dishes in the friary kitchen until he was ordered, at short notice, to preach. Christian humility does not weaken a soul; it strengthens it, because it puts a man in the truth. Ask today for the grace to think little of the esteem of others.",
          prayerText:
            "Glorious St. Anthony, who hid your rare talents with the greatest care and patiently suffered the contempt of men, obtain for us grace to despise the esteem of men and the honors of the world, and always increase in merit before God. Amen.",
          intentionPrompt: "Where do I want to be seen more than I want to be good?",
        },
        {
          day: 5,
          title: "Prayer",
          meditation:
            "Pius XI wrote that Anthony persevered so in prayer day and night that the whole course of his life could be called a perpetual prayer. Work does not exclude prayer; offered to God, it becomes prayer. Ask today for the habit of lifting your heart to God through the ordinary hours.",
          prayerText:
            "O marvelous Saint, who didst always worthily receive Jesus in His Sacrament, I bless, praise and venerate thee, thanking God Who has sanctified thee by His graces and His Most Holy Sacrament. I implore Him to pardon me for having so often profaned by sin my tongue, sanctified and consecrated so many times by contact with the Body and Blood of Jesus Christ in my communions. O great St. Anthony, obtain for me the grace to preserve my tongue pure and spotless from sin, that I may henceforth merit to receive Jesus Christ worthily in the Sacrament of His love. Amen.",
          intentionPrompt: "At what point in my day could I make a habit of turning to God?",
        },
        {
          day: 6,
          title: "The Blessed Sacrament",
          meditation:
            "The best known of the Antonian miracles is the story of the starving beast that knelt before the Blessed Sacrament rather than eat. Whatever the details, the point is the one Anthony preached: Christ is truly present, and faith should be at least as ready as instinct. Make a visit or an act of adoration today.",
          prayerText:
            "O marvelous Saint, whose blessed tongue did always bless the Lord, and cause others to bless Him when they saw the fishes themselves obey thee and raise their heads from the water to listen to thy word, when they saw a stupid beast prostrate itself to adore Jesus Christ in the Most Holy Sacrament, I bless, praise and venerate thee, I thank God for having worked such prodigies to confirm my faith. Through thy sanctity and thy teaching I implore thee to obtain the grace to hear with fruit the word of God, and to be devout to the Holy Sacrament of the altar. Amen.",
          intentionPrompt: "How do I show, in my body, that I believe Christ is present?",
        },
        {
          day: 7,
          title: "Zeal for Souls",
          meditation:
            "Anthony asked to preach in Africa hoping for martyrdom, was turned back by illness, and found his mission in Italy instead. He earned the title Hammer of the Heretics not by contempt but by patient care for the straying. Ask today for zeal for the people around you who have drifted from the faith.",
          prayerText:
            "Glorious St. Anthony, who by your sanctity and your eloquence triumphed over the hardest heart, obtain for us the grace faithfully to follow the Divine call that we may obtain the blessedness promised to those who faithfully keep the Divine Word. Amen.",
          intentionPrompt:
            "Who in my life has stopped practising the faith, and how can I love them well?",
        },
        {
          day: 8,
          title: "Wonder Worker",
          meditation:
            "Anthony is invoked for lost things because of the novice who stole his psalter and, struck by conscience, brought it back. The Church has always known that God glorifies some of his saints with signs so that the wavering may return to the way of salvation. Bring him your need with a child's confidence.",
          prayerText:
            "O glorious St. Anthony, since God has given thee the power of miracles, a power thou hast exercised for centuries, and since He has given thee in particular the power of finding that which has been lost, I come to thee with the confidence of a child as to the best of fathers. By thy intercession obtain for me above all to find the grace of God, if I have had the misfortune to lose it. May I find also my former fervor in the service of God and in the practice of virtue; and as a pledge of these graces so important for my eternal salvation, may I find also the things I have lost. Thus thou shalt make me experience the presence of thy goodness and thou wilt increase my confidence and my love for thee. Amen.",
          intentionPrompt:
            "What have I lost that matters more than the thing I came here to ask for?",
        },
        {
          day: 9,
          title: "Model for Every Walk of Life",
          meditation:
            "Anthony was a student, a friar, a preacher and a public man, and he was holy in each. As death approached he received the last sacraments and went out to meet God as he had lived. The novena ends with the prayer for a happy death, offered for yourself and for those you love.",
          prayerText:
            "Great St. Anthony of Padua, sweet hope of all who implore thee, I prostrate myself humbly at thy feet to obtain by thy powerful intercession the greatest of all blessings, the grace of dying well. Do not allow, I entreat thee, by the pierced Heart of Jesus, that I be suddenly seized by death in the deplorable state of mortal sin; by thy intercession obtain for me that at the last moment I may experience the most profound sorrow for the sins of my whole life, that I may be penetrated with love for Jesus, and full of confidence in the power of His Blood which was shed for me; that the last movements of my hands may be to carry the crucifix to my lips and my last words the holy names of Jesus and Mary. In short, that expiring in the embraces of my sweet Redeemer, I may have the happiness to see Him, to love Him and to possess Him with thee for all eternity. Obtain this grace also for my parents, my friends, my benefactors and all who are dear to me in our Lord Jesus Christ, to Whom be honor and glory with the Father in the unity of the Holy Spirit forever and ever. Amen.",
          intentionPrompt: "For whom, besides myself, am I asking the grace of a happy death?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedSaintSlug: "saint-anthony-of-padua",
      typicalStartDate:
        "Nine consecutive Tuesdays, or June 4 in preparation for his feast on June 13",
      citations: [ECATHOLIC_ANTHONY, BENEDICT_XVI_ANTHONY],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-immaculate-conception",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CC_IMMACULATE, FULGENS_CORONA],
    payload: {
      slug: "novena-immaculate-conception",
      title: "Novena to the Immaculate Conception",
      summary:
        "The traditional novena in preparation for the Solemnity of the Immaculate Conception, prayed once a day from November 30 to December 8. The same received prayer, versicles and collect are said on each of the nine days; the subject for meditation changes.",
      background:
        "Blessed Pius IX defined the dogma of the Immaculate Conception in the bull Ineffabilis Deus on 8 December 1854: from the first instant of her conception the Blessed Virgin Mary was preserved free from all stain of original sin, by a singular grace and in view of the merits of Jesus Christ. Four years later, at Lourdes, Our Lady told St. Bernadette, I am the Immaculate Conception. Pius XII recounted this history in the encyclical Fulgens Corona (1953). This is a devotional novena for private or parish use; the day-by-day distinction below lies in the meditation, since the received prayer is the same each day.",
      intentionTheme: "purity of heart and confidence in the intercession of Mary Immaculate",
      days: [
        {
          day: 1,
          title: "Preserved from All Stain",
          meditation:
            "The dogma does not say that Mary needed no Saviour; it says that she was saved more perfectly than anyone else, redeemed in advance and in view of her Son's merits. Begin the novena by thanking God for what grace can do in a creature.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "What am I asking Our Lady for over these nine days?",
        },
        {
          day: 2,
          title: "Mother of God",
          meditation:
            "Mary was preserved from sin because of who her Son is. The privilege is not decoration; it is a consequence of the Incarnation, the fitting preparation of the dwelling in which the Word became flesh.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "Do I honour Mary in a way that leads me to her Son?",
        },
        {
          day: 3,
          title: "Refuge and Advocate of Sinners",
          meditation:
            "The same prayer that praises Mary's sinlessness calls her the refuge and advocate of sinners. Her holiness is not distance; it is what makes her intercession powerful. Bring her today the sin you are most ashamed of.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "What have I been afraid to bring to confession?",
        },
        {
          day: 4,
          title: "Purity of Heart",
          meditation:
            "Blessed are the clean of heart, for they shall see God. Purity of heart is not merely the absence of a particular sin; it is a heart attached to God alone. Ask for it today as the novena's own prayer asks for it.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "What is my heart divided between?",
        },
        {
          day: 5,
          title: "Purity of Intention",
          meditation:
            "Purity of intention consecrates every thought, word and action to God's greater glory. Much of what we do is good in itself and spoiled by why we do it. Ask today that your motives be cleaned.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "Why am I really doing the good thing I am doing?",
        },
        {
          day: 6,
          title: "A Constant Spirit of Prayer",
          meditation:
            "The novena asks not for a burst of fervour but for constancy. Mary's life was hidden and ordinary and wholly given; ask for the perseverance that keeps praying when nothing is felt.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "What small rule of prayer could I keep every single day?",
        },
        {
          day: 7,
          title: "Penance and Self-Denial",
          meditation:
            "Innocence lost by sin is recovered by penance. Advent is a penitential season for exactly this reason. Choose one concrete act of self-denial today and offer it with the novena.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "What will I give up today, and for whom will I offer it?",
        },
        {
          day: 8,
          title: "Where Nothing Defiled Can Enter",
          meditation:
            "The prayer ends by looking at heaven, into which nothing defiled can enter. The Immaculate Conception is a promise as well as a privilege: God intends to make his people spotless. Ask for final perseverance.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "What in me would have to be healed before I could see God?",
        },
        {
          day: 9,
          title: "You Are All Fair, O Mary",
          meditation:
            "On the eve of the solemnity the novena's own versicles answer themselves: you are all fair, O Mary. Pray the day's prayer with its versicles and concluding collect, celebrating the holy and immaculate conception of the Virgin and asking, through her, the forgiveness of all your sins.",
          prayerText:
            "Immaculate Virgin! Mary, conceived without sin! Remember, you were miraculously preserved from even the shadow of sin, because you were destined to become not only the Mother of God, but also the mother, the refuge, and the advocate of man; penetrated therefore, with the most lively confidence in your never-failing intercession, we most humbly implore you to look with favor upon the intentions of this novena, and to obtain for us the graces and the favors we request. You know, O Mary, how often our hearts are the sanctuaries of God, Who abhors iniquity. Obtain for us, then, that angelic purity which was your favorite virtue, that purity of heart which will attach us to God alone, and that purity of intention which will consecrate every thought, word, and action to His greater glory. Obtain also for us a constant spirit of prayer and self-denial, that we may recover by penance that innocence which we have lost by sin, and at length attain safely to that blessed abode of the saints, where nothing defiled can enter. O Mary, conceived without sin, pray for us who have recourse to you. V. You are all fair, O Mary. R. You are all fair, O Mary. V. And the original stain is not in you. R. And the original stain is not in you. V. You are the glory of Jerusalem. R. You are the joy of Israel. V. You are the honor of our people. R. You are the advocate of sinners. V. O Mary, Virgin, most prudent. R. O Mary, Mother, most tender. V. Pray for us. R. Intercede for us with Jesus our Lord. V. In your conception, Holy Virgin, you were immaculate. R. Pray for us to the Father Whose Son you didst bring forth. V. O Lady, aid my prayer. R. And let my cry come unto you. Let us pray. Holy Mary, Queen of Heaven, Mother of Our Lord Jesus Christ, and mistress of the world, who forsakest no one, and despisest no one, look upon me, O Lady, with an eye of pity, and entreat for me of your beloved Son the forgiveness of all my sins; that, as I now celebrate, with devout affection, your holy and immaculate conception, so, hereafter I may receive the prize of eternal blessedness, by the grace of Him whom you, in virginity, didst bring forth, Jesus Christ Our Lord: Who, with the Father and the Holy Ghost, lives and reigns, in perfect Trinity, God, world without end. Amen.",
          intentionPrompt: "How will I keep tomorrow's solemnity?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedMarianTitleSlug: "immaculate-conception",
      typicalStartDate: "November 30, concluding December 8",
      relatedFeastSlug: "solemnity-immaculate-conception",
      citations: [CC_IMMACULATE, FULGENS_CORONA],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-our-lady-of-perpetual-help",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: [OLPH_NOVENA, OLPH_ICON],
    payload: {
      slug: "novena-our-lady-of-perpetual-help",
      title: "Novena to Our Lady of Perpetual Help",
      summary:
        "The Redemptorist novena to Our Lady of Perpetual Help: an act of contrition, the received preparatory prayer said on each of the nine days, and a different meditation each day on one of the ways her help is called perpetual. It is commonly prayed from June 18 to June 26, before her feast on June 27, and at any time of need.",
      background:
        "The icon of the Mother of Perpetual Help, painted in the Byzantine manner and venerated on Crete by the fifteenth century, was brought to Rome and later given by Blessed Pius IX to the Redemptorists in 1866 with the charge to make her known throughout the world. The perpetual novena that grew up around it became one of the most widespread Marian devotions of the twentieth century. The daily prayer does not change; the nine meditation subjects below are those of the received Redemptorist novena.",
      intentionTheme:
        "the unfailing maternal help of Mary in every necessity of life, death and purgatory",
      days: [
        {
          day: 1,
          title: "The Title Our Lady of Perpetual Help",
          meditation:
            "Consider what human life is — a chain of miseries, dangers and labours — and then what this title of Mary means. Few names are so apt to lift the heart to confidence, because it promises help that is not occasional but perpetual.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt: "What need am I bringing to Our Lady over these nine days?",
        },
        {
          day: 2,
          title: "She Helps Her Devotees to Cease Sinning",
          meditation:
            "The greater a child's misfortune, the more a mother's love increases; and no misfortune is greater than being separated from Christ by mortal sin. Mary reserves her most tender care for sinners, and many have been converted simply by looking at her image.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt:
            "What sin do I keep returning to, and what will I change about the occasion of it?",
        },
        {
          day: 3,
          title: "She Helps Her Devotees to Overcome Lukewarmness",
          meditation:
            "Tepidity is a state almost as dangerous as mortal sin, because it is comfortable. Ask Mary today for the grace to want to want God, and to take one concrete step out of spiritual sloth.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt: "Where have I settled for the minimum in my life with God?",
        },
        {
          day: 4,
          title: "She Defends Her Devotees in Temptation",
          meditation:
            "Temptation is not sin, and no one is exempt from it. The habit of invoking Mary's name at the first movement of temptation has been recommended by the saints precisely because it is short enough to be actually used.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt: "What short prayer will I say the moment temptation comes?",
        },
        {
          day: 5,
          title: "She Protects Her Devotees in the Necessities and Afflictions of Life",
          meditation:
            "This world is a place of trial, and Christians are not promised exemption from illness, poverty or grief. What is promised is a Mother who is present in them. Name your affliction plainly today.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt: "What am I carrying that I have not yet said out loud in prayer?",
        },
        {
          day: 6,
          title: "She Sustains Her Devotees in the Practice of Virtue",
          meditation:
            "Grace does not replace effort; it makes effort fruitful. Choose one virtue you most need — patience, chastity, honesty, generosity — and ask Mary's help in practising it today.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt:
            "Which single virtue would change my life most if I actually practised it?",
        },
        {
          day: 7,
          title: "She Grants Her Devotees Fidelity in Her Service",
          meditation:
            "Perseverance is the whole question: not how well we begin but whether we are still there at the end. Ask today for fidelity to the small practices you have taken up, long after the novena is over.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt: "What practice will I still be keeping a year from now?",
        },
        {
          day: 8,
          title: "She Assists Her Devotees at the Hour of Death",
          meditation:
            "Every Hail Mary asks for help now and at the hour of our death. That hour is the one for which this whole devotion prepares. Pray today for the dying, and for your own last hour.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt: "Who is dying, or grieving, that I should pray for by name today?",
        },
        {
          day: 9,
          title: "She Assists Her Devotees in Purgatory",
          meditation:
            "Her help does not stop at the threshold of eternity: the Church has always believed that the prayers of the Mother of Mercy reach the souls being purified, who cannot help themselves. End the novena by praying for the holy souls, and especially the most forsaken.",
          prayerText:
            "My Lord Jesus Christ, true God and true man, my Father and Redeemer, behold at Thy feet a poor sinner who has so grievously afflicted Thy loving Heart. O lovable Jesus, how could I have offended Thee and filled with bitterness that Heart that loves me so and that has spared no effort to attain my love? How great has been my ingratitude! But, O my Saviour, be consoled, be consoled, I say to Thee; now I find myself repentant, such grief I feel for the afflictions I have caused Thee, that I would like to die of pure sorrow and contrition. O my Jesus! Who could have made me weep for sin as Thou hast wept for them in Thy mortal life! My soul is oppressed for having offended Thee. Eternal Father, in satisfaction for my offences, I offer Thee the affliction and sorrow the Heart of Thy Divine Son has felt for them. And Thou, O loving Jesus! Give me such a horror for sin that it may make me avoid even the most trifling of faults from now on. Depart from my heart, earthly affections; I do not want to love anything now but my most bountiful Redeemer. O my Jesus, help me, strengthen me, and pardon me. My Mother of Perpetual Help, intercede for me and obtain for me the pardon of my sins. O Most Blessed Virgin Mary! Whom to inspire us with boundless confidence has been pleased to take the sweet name of Mother of Perpetual Help; I implore Thee to come to my aid always and everywhere, in my temptations, after my falls, in my difficulties, in all the miseries of life, and above all, at the hour of my death. Give me, O loving Mother, the desire, nay more, the habit always to have recourse to Thee, for I feel assured that if I am faithful in invoking Thee, Thou wilt be faithful in coming to my assistance. Obtain for me, then, this grace of graces, the grace to pray to Thee without ceasing and with childlike trust, that, by means of my constant plea, I may ensure Thy Perpetual Help and final perseverance. Bless me, O tender and solicitous Mother, pray for me now and at the hour of my death. Amen.",
          intentionPrompt: "For which of my dead will I have a Mass offered?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedMarianTitleSlug: "our-lady-of-perpetual-help",
      typicalStartDate:
        "June 18, concluding on her feast, June 27; also prayed at any time of need",
      citations: [OLPH_NOVENA, OLPH_ICON],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-holy-face-of-jesus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CC_HOLY_FACE, CE_REPARATION],
    payload: {
      slug: "novena-holy-face-of-jesus",
      title: "Novena to the Most Holy Face of Jesus",
      summary:
        "A nine-day novena of reparation to the Holy Face of Jesus. Each day takes the next verses of Psalm 51, the Miserere, adds its own prayer to the Holy Face, and closes with the aspiration: O Jesus, through the merits of your Holy Face, have pity on us and on the whole world.",
      background:
        "Devotion to the Holy Face grew from meditation on the disfigured face of the suffering Christ described in Isaiah 53 and on the veil of Veronica. It was promoted in the nineteenth century by the Carmelite Sr. Mary of St. Peter of Tours and by the layman Ven. Leo Dupont, the holy man of Tours, through whose piety the Archconfraternity of the Holy Face was established at Tours about 1851 as a work of reparation; Bl. Maria Pierina De Micheli spread the devotion again in the twentieth century. The prayer said on the third day of this novena is that of Blessed Pius IX. It is a devotion of reparation: the faithful seek to console Christ for the offences of sin. Each day is preceded by the daily preparatory prayer and followed by an Our Father, three Hail Marys and a Glory Be.",
      intentionTheme: "reparation to the suffering Face of Christ and mercy for the whole world",
      days: [
        {
          day: 1,
          title: "Have Mercy on Me, O God",
          meditation:
            "Psalm 51:3-4 opens the novena: Have mercy on me, O God, in your goodness; in your great tenderness wipe away my faults; wash me clean of my guilt, purify me from my sin. Begin by looking at the face of Christ and asking for a clean heart.",
          prayerText:
            "O Most Holy Face of Jesus, look with tenderness on us who are sinners. You are a merciful God, full of love and compassion. Keep us pure of heart so that we may see Thee always. Mary, our Mother, intercede for us; Saint Joseph, pray for us. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy. Almighty Father, come into our hearts, and so fill us with your love that, forsaking all evil desires, we may embrace you, our only good. Show us, O Lord our God, what you are to us. Say to our souls, I am your salvation, speak so that we may hear. Our hearts are before you; open our ears; let us hasten after your voice. Hide not your Face from us, we beseech you, O Lord. Open our hearts so that you may enter in. Repair the ruined mansions, that you may dwell therein. Hear us, O Heavenly Father, for the sake of your only Son, Our Lord Jesus Christ, who lives and reigns with you and the Holy Spirit, one God, now and forever. Amen.",
          intentionPrompt: "What guilt am I asking to have washed away in these nine days?",
        },
        {
          day: 2,
          title: "My Sin Is Always Before Me",
          meditation:
            "Psalm 51:2: My offenses truly I know them; my sin is always before me. Against you, you alone, have I sinned. Reparation begins with honest naming — of what was done and of the good that was left undone.",
          prayerText:
            "Most Holy Face of Jesus, we are truly sorry that we have hurt you so much by constantly doing what is wrong, and for all the good works that we have failed to do. Immaculate Heart of Mary, Saint Joseph, intercede for us, help us to console the Most Holy Face of Jesus. Pray that we may share in the tremendous love You have for one another, and for the Most Blessed Trinity. Amen. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "What good have I failed to do that I should confess as well?",
        },
        {
          day: 3,
          title: "You Are Just When You Pass Sentence",
          meditation:
            "Psalm 51:3: You are just when you pass sentence on me, blameless when you give judgement. Blessed Pius IX asked not to see the Face of Christ with bodily eyes but to have it turned toward the heart, as a source of strength for the day's combat.",
          prayerText:
            "O Jesus! Cast upon us a look of mercy; turn your Face towards each of us as you did to Veronica; not that we may see it with our bodily eyes, for this we do not deserve, but turn it towards our hearts, so that, remembering you, we may ever draw from this fountain of strength the vigor necessary to sustain the combats of life. Amen. Mary, our Mother, and Saint Joseph, pray for us. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "What combat of my life needs Christ's strength today?",
        },
        {
          day: 4,
          title: "Learn of Me, for I Am Meek and Humble",
          meditation:
            "Psalm 51:4: Indeed you love truth in the heart; then in the secret of my heart teach me wisdom. The face of Christ shows what his heart is: meekness and humility, the two virtues he asked us to learn from him.",
          prayerText:
            "O Lord Jesus, who hast said, learn of me for I am meek and gentle of heart, and who didst manifest upon Thy Holy Face the sentiments of Thy divine heart, grant that we may love to come frequently and meditate upon Thy divine features. May we read there Thy gentleness and Thy humility, and learn how to form our hearts in the practice of these two virtues which Thou desirest to see shine in Thy servants. Mary, our Mother, and Saint Joseph, help us. Through the merits of Thy precious blood and Thy Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "Where was I harsh this week when I could have been gentle?",
        },
        {
          day: 5,
          title: "Turn Away Your Face from My Sins",
          meditation:
            "Psalm 51:5: Make me hear rejoicing and gladness; from my sins turn away your Face, and blot out all my guilt. God's patience is not indifference; it is the space he gives us to repent. That patience should give courage, not presumption.",
          prayerText:
            "Holy Face of Jesus, Sacred Countenance of God, how great is your patience with humankind, how infinite your forgiveness. We are sinners, yet you love us. This gives us courage. For the glory of your Holy Face and of the Blessed Trinity, hear and answer us. Mary our Mother, intercede for us; Saint Joseph, pray for us. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "Have I mistaken God's patience for permission?",
        },
        {
          day: 6,
          title: "A Pure Heart Create for Me",
          meditation:
            "Psalm 51:6: A pure heart create for us, O God; put a steadfast spirit within us. Do not cast us away from your presence nor deprive us of your Holy Spirit. Only the Holy Spirit can make a heart clean and keep it so.",
          prayerText:
            "May our hearts be cleansed, O Lord, by the inpouring of the Holy Spirit, and may He render them fruitful by watering them with His heavenly dew. Mary, the most chaste spouse of the Holy Spirit, intercede for us; Saint Joseph, pray for us. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "What am I asking the Holy Spirit to cleanse in me?",
        },
        {
          day: 7,
          title: "Sinners Shall Return to You",
          meditation:
            "Psalm 51:7: Give me again the joy of your help; with a spirit of fervor sustain me, that I may teach transgressors your ways and sinners may return to you. Compassion for the suffering Christ is not enough; the devotion asks for a share in his expiation.",
          prayerText:
            "Lord Jesus! After contemplating Thy features, disfigured by grief, after meditating upon Thy passion with compunction and love, how can our hearts fail to be inflamed with a holy hatred of sin, which even now outrages Thy Adorable Face! Lord, suffer us not to be content with mere compassion, but give us grace so closely to follow Thee in this Calvary, so that the opprobrium destined for Thee may fall on us, O Jesus, that thus we may have a share, small though it may be, in expiation of sin. Amen. Mary, our Mother, intercede for us; Saint Joseph, pray for us. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "What penance will I offer today for someone else's conversion?",
        },
        {
          day: 8,
          title: "Healer of the Sick, Shepherd of the Straying",
          meditation:
            "Psalm 51:8: O rescue me, God my helper, and my tongue shall ring out your goodness. Christ called himself the physician of the sick and the shepherd of the lost sheep. Ask that Satan never draw you away from that protection.",
          prayerText:
            "Most merciful Face of Jesus, who in this vale of tears was so moved by our misfortunes as to call yourself the healer of the sick, and the good Shepherd of the souls gone astray, allow not Satan to draw us away from you, but keep us always under your loving protection, together with all souls who endeavor to console you. Mary, our Mother, intercede for us; Saint Joseph, pray for us. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "Which straying soul am I asking the Good Shepherd to go after?",
        },
        {
          day: 9,
          title: "A Humbled, Contrite Heart",
          meditation:
            "Psalm 51:9-10: My sacrifice a contrite spirit; a humbled, contrite heart you will not spurn. In your goodness, show favour to Zion. The novena ends in thanksgiving, whatever the answer, because the asking itself has been heard.",
          prayerText:
            "Sacred Face of our Lord and our God, what words can we say to express our gratitude? How can we speak of our joy? That you have deigned to hear us, that you have chosen to answer us in our hour of need. We say this because we know that our prayers will be granted. We know that you, in your loving kindness, listened to our pleading hearts, and will give, out of your fullness, the answer to our problems. Mary, our Mother, thank you for your intercession on our behalf. Saint Joseph, thank you for your prayers. Through the merits of your precious blood and your Holy Face, O Jesus, grant us our petition, pardon and mercy.",
          intentionPrompt: "What will I thank God for, whether or not I received what I asked?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "holy-face-of-jesus",
      typicalStartDate: "Any time of need; traditionally prayed in the days before Lent",
      citations: [CC_HOLY_FACE, CE_REPARATION],
    },
  },
  {
    contentType: "NOVENA",
    slug: "novena-infant-of-prague",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [CC_INFANT, PRAGJESU_HISTORY],
    payload: {
      slug: "novena-infant-of-prague",
      title: "Novena to the Infant Jesus of Prague",
      summary:
        "A nine-day novena to the Holy Child under the image of the Infant Jesus of Prague. Each day contemplates one detail of the statue — the face, the crown, the royal mantle, the cross, the little golden heart, the raised right hand — and prays its own short petition, followed by an Our Father, a Hail Mary and a Glory Be.",
      background:
        "The small wax-coated wooden statue of the Infant Jesus venerated in the Carmelite church of Our Lady Victorious in Prague came from Spain, was brought to Bohemia by Maria Manrique de Lara and passed to her daughter Polyxena of Lobkowicz, who gave it to the Discalced Carmelites there in 1628. Devotion to it spread through the Carmelite order and, from the nineteenth century, throughout the Catholic world. The devotion honours the mystery of the Incarnation in the Lord's infancy and asks the confidence proper to a child. Each day closes with the invocation: By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
      intentionTheme: "childlike confidence in the Incarnate Word and trust in his providence",
      days: [
        {
          day: 1,
          title: "The Soul That Knows Its Nothingness",
          meditation:
            "The novena begins with the disproportion between the one who asks and the one who is asked: a soul conscious of its nothingness turning to the One who is all. Say the day's prayer, then name your request.",
          prayerText:
            "O sweet Child Jesus, here at Your feet is a soul that, conscious of its nothingness, turns to You, who are all. I have so much need of Your help. Look on me, O Jesus, with love and, since You are all powerful, help me in my poverty. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good. Do not look upon my unworthiness, but rather on my faith, and show me Your infinite mercy.",
          intentionPrompt: "What am I asking for, and am I willing for God to answer differently?",
        },
        {
          day: 2,
          title: "The Splendour of the Father",
          meditation:
            "The Child in the manger is the brightness of the Father's glory. Adore him today as true God and true man, and offer him the homage of your whole self.",
          prayerText:
            "O Splendour of the heavenly Father, in whose face shines the light of the divinity, I adore You profoundly and I confess You as the true Son of the living God. I offer You, O Lord, the humble homage of all my being. Grant that I may never separate myself from You, my highest good. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "Do I really believe that the Child of Bethlehem is God?",
        },
        {
          day: 3,
          title: "His Countenance and Our Trust",
          meditation:
            "The statue shows a child's face, and its smile is the whole argument of this novena. Confidence in God is not naivety; it is the reasonable response to the way he has shown himself.",
          prayerText:
            "O Holy Child Jesus, in gazing upon Your countenance, from which comes the most beautiful of smiles, I feel myself filled with a lively trust. Yes, I hope for all from Your goodness. Shed, O Jesus, on me and on those dear to me Your smile of grace and I will praise Your infinite mercy. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "Whom will I name today among those dear to me?",
        },
        {
          day: 4,
          title: "The Crown",
          meditation:
            "The Child wears a crown: this infant is a king. Accept his sovereignty today over the parts of your life you have kept under other rule.",
          prayerText:
            "O Child Jesus, whose forehead is adorned with a crown, I accept You as my absolute sovereign. I do not wish to serve any longer the evil one, my passions or sin. Reign, O Jesus, over this poor heart and make it all Yours for ever. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "What part of my life is still ruled by something other than Christ?",
        },
        {
          day: 5,
          title: "The Royal Mantle",
          meditation:
            "The purple mantle is royal, and it is the colour of blood. From the crib the Child is already on the way to Calvary, and he shed that blood for you. Offer him a share in it today.",
          prayerText:
            "I gaze upon You, O Most Sweet Redeemer, dressed in a mantle of purple. It is Your royal attire. How it speaks to me of blood! That Blood which You have shed solely on my account. Grant, O Child Jesus, that I may respond to Your great sacrifice and not refuse, when You offer me some difficulty, to suffer with You and for You. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "What difficulty of today can I accept deliberately, with him?",
        },
        {
          day: 6,
          title: "The Globe in His Hand",
          meditation:
            "The Child holds the world in his hand. Among the countless beings he sustains at every instant, you are one, held and watched over deliberately.",
          prayerText:
            "O Most Lovable Child, in contemplating You as You sustain the world, my heart fills with joy. Among the innumerable beings that You sustain I also am one. You look on me, uphold me at every instant and guard me as Your own. Look after, O Jesus, this humble being and help it in its many necessities. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "What worry am I holding that God is already holding?",
        },
        {
          day: 7,
          title: "The Cross upon the Globe",
          meditation:
            "A cross surmounts the world in the Child's hand: the standard of our redemption. Every Christian has a cross, usually light and often felt as heavy. Ask that carrying yours be fruitful and not merely endured.",
          prayerText:
            "On Your breast, O Child Jesus, shines a Cross. It is the standard of our redemption. I also, O Divine Saviour, have my cross, that, although light, very often weighs me down. Help me to bear it and may the carrying of it be fruitful. You well know how weak and worthless I am. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "What is my cross right now, and for whom can I offer it?",
        },
        {
          day: 8,
          title: "The Little Golden Heart",
          meditation:
            "Beside the cross is a small golden heart, the image of the tenderness of the Heart of Jesus, which gives itself away and is even immolated for those it loves. Ask to learn to answer love with love.",
          prayerText:
            "Together with the cross, I see on Your breast, O Child Jesus, a little golden heart. It is the image of Your heart, which is truly golden on account of its infinite tenderness. You are the true friend, that generously gives Himself, even immolates Himself, for the one He loves. Continue to pour out on me, O Jesus, the enthusiasm which Your love inspires and teach me to respond always to Your great love. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "How will I answer today the love Christ has shown me?",
        },
        {
          day: 9,
          title: "The Hand Raised in Blessing",
          meditation:
            "The Child's right hand is raised in blessing. The novena ends by asking that blessing on soul, body and daily affairs, and by promising to bless his holy name in return.",
          prayerText:
            "How many blessings, O Little Child, has Your almighty right hand poured out on those who honour You and call upon You. Bless me also, O Child Jesus, my soul, my body and my interests. Bless and help me in my necessities, and grant me what I now desire. Listen with compassion to my prayers and I will bless Your Holy Name every day. Our Father. Hail Mary. Glory Be to the Father. By Your Divine Infancy, O Jesus, grant me the grace that I now ask, if it is according to Your will and for my true good.",
          intentionPrompt: "What blessing have I already received that I never thanked God for?",
        },
      ],
      durationDays: 9,
      structure: "nine_days",
      associatedDevotionSlug: "infant-of-prague",
      typicalStartDate: "Any time of need",
      citations: [CC_INFANT, PRAGJESU_HISTORY],
    },
  },
];
