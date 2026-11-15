/**
 * The words the Rosary says that are not a prayer of their own: each mystery's
 * announcement before its decade, the versicle and response after the Hail, Holy
 * Queen, and the closing prayer. The prayers themselves (the Creed, the Our Father,
 * the Hail Mary, the Glory Be, the Fatima Prayer, the Hail, Holy Queen) are the site's
 * own prayer records, in the language the reader prays them in.
 *
 * Every language follows its Church's own wording, gathered and then checked by a
 * second, independent reviewer against the sources (2026-11-14): the Holy See's
 * Compendium of the Catechism (Appendix A, in each of its languages), Vatican News's
 * Rosary pages, Rosarium Virginis Mariae, and the bishops' conferences and their
 * liturgical offices (USCCB and the Catholic Truth Society in English; the Catholic
 * Bishops' Conference of Korea's 묵주기도; the mainland Catholic Chinese of 信德; the
 * Vietnamese bishops' Mân Côi; the CBCP's Filipino; the ΙΣΚΙΕ in Greece). The English
 * closing prayer is the Holy See's own. Where a title is a small faithful expansion of
 * the official one ("The Coronation of Mary as Queen of Heaven and Earth"), it follows
 * the site's own mystery list.
 *
 * Pure: no I/O, no React.
 */

import type { MysterySetKey } from "@/lib/content-shared/rosary";

import type { AudioLang } from "./languages";

export interface RosaryTexts {
  /** Each set's five announcements, in order, as a leader says them aloud. */
  announcements: Readonly<Record<MysterySetKey, readonly string[]>>;
  versicle: string;
  response: string;
  letUsPray: string;
  closingPrayer: string;
}

const ROSARY_TEXTS: Readonly<Record<AudioLang, RosaryTexts>> = {
  // English
  en: {
    announcements: {
      joyful: [
        "The First Joyful Mystery: The Annunciation.",
        "The Second Joyful Mystery: The Visitation.",
        "The Third Joyful Mystery: The Nativity.",
        "The Fourth Joyful Mystery: The Presentation in the Temple.",
        "The Fifth Joyful Mystery: The Finding of Jesus in the Temple.",
      ],
      sorrowful: [
        "The First Sorrowful Mystery: The Agony in the Garden.",
        "The Second Sorrowful Mystery: The Scourging at the Pillar.",
        "The Third Sorrowful Mystery: The Crowning with Thorns.",
        "The Fourth Sorrowful Mystery: The Carrying of the Cross.",
        "The Fifth Sorrowful Mystery: The Crucifixion and Death of Our Lord.",
      ],
      glorious: [
        "The First Glorious Mystery: The Resurrection.",
        "The Second Glorious Mystery: The Ascension.",
        "The Third Glorious Mystery: The Descent of the Holy Spirit.",
        "The Fourth Glorious Mystery: The Assumption of Mary.",
        "The Fifth Glorious Mystery: The Coronation of Mary as Queen of Heaven and Earth.",
      ],
      luminous: [
        "The First Luminous Mystery: The Baptism of Jesus in the Jordan.",
        "The Second Luminous Mystery: The Wedding at Cana.",
        "The Third Luminous Mystery: The Proclamation of the Kingdom of God.",
        "The Fourth Luminous Mystery: The Transfiguration.",
        "The Fifth Luminous Mystery: The Institution of the Eucharist.",
      ],
    },
    versicle: "Pray for us, O holy Mother of God.",
    response: "That we may be made worthy of the promises of Christ.",
    letUsPray: "Let us pray.",
    closingPrayer:
      "O God, whose only-begotten Son, by his life, death and resurrection, has purchased for us the rewards of eternal life, grant, we beseech thee, that meditating on these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.",
  },
  // Spanish
  es: {
    announcements: {
      joyful: [
        "Primer misterio gozoso: La Encarnación del Hijo de Dios.",
        "Segundo misterio gozoso: La Visitación de Nuestra Señora a su prima Santa Isabel.",
        "Tercer misterio gozoso: El Nacimiento del Hijo de Dios.",
        "Cuarto misterio gozoso: La Presentación de Jesús en el Templo.",
        "Quinto misterio gozoso: El Niño Jesús perdido y hallado en el Templo.",
      ],
      sorrowful: [
        "Primer misterio doloroso: La Oración de Jesús en el Huerto.",
        "Segundo misterio doloroso: La Flagelación del Señor.",
        "Tercer misterio doloroso: La Coronación de espinas.",
        "Cuarto misterio doloroso: Jesús con la Cruz a cuestas camino del Calvario.",
        "Quinto misterio doloroso: La Crucifixión y Muerte de Nuestro Señor.",
      ],
      glorious: [
        "Primer misterio glorioso: La Resurrección del Hijo de Dios.",
        "Segundo misterio glorioso: La Ascensión del Señor a los Cielos.",
        "Tercer misterio glorioso: La Venida del Espíritu Santo sobre los Apóstoles.",
        "Cuarto misterio glorioso: La Asunción de Nuestra Señora a los Cielos.",
        "Quinto misterio glorioso: La Coronación de la Santísima Virgen como Reina de Cielos y Tierra.",
      ],
      luminous: [
        "Primer misterio luminoso: El Bautismo de Jesús en el Jordán.",
        "Segundo misterio luminoso: La autorrevelación de Jesús en las bodas de Caná.",
        "Tercer misterio luminoso: El anuncio del Reino de Dios invitando a la conversión.",
        "Cuarto misterio luminoso: La Transfiguración.",
        "Quinto misterio luminoso: La Institución de la Eucaristía.",
      ],
    },
    versicle: "Ruega por nosotros, Santa Madre de Dios.",
    response: "Para que seamos dignos de alcanzar las promesas de Nuestro Señor Jesucristo.",
    letUsPray: "Oremos.",
    closingPrayer:
      "Oh Dios, cuyo Hijo, por medio de su vida, muerte y resurrección, nos otorgó los premios de la vida eterna, te rogamos que, venerando humildemente los misterios del Rosario de la Santísima Virgen María, imitemos lo que contienen y consigamos lo que nos prometen. Por Jesucristo, nuestro Señor. Amén.",
  },
  // French
  fr: {
    announcements: {
      joyful: [
        "Premier mystère joyeux : l'Annonciation.",
        "Deuxième mystère joyeux : la Visitation.",
        "Troisième mystère joyeux : la Nativité.",
        "Quatrième mystère joyeux : la Présentation de Jésus au Temple.",
        "Cinquième mystère joyeux : le recouvrement de Jésus au Temple.",
      ],
      sorrowful: [
        "Premier mystère douloureux : l'agonie de Jésus au Jardin des Oliviers.",
        "Deuxième mystère douloureux : la flagellation.",
        "Troisième mystère douloureux : le couronnement d'épines.",
        "Quatrième mystère douloureux : Jésus porte sa croix.",
        "Cinquième mystère douloureux : la mort de Jésus en croix.",
      ],
      glorious: [
        "Premier mystère glorieux : la Résurrection.",
        "Deuxième mystère glorieux : l'Ascension.",
        "Troisième mystère glorieux : la Pentecôte.",
        "Quatrième mystère glorieux : l'Assomption.",
        "Cinquième mystère glorieux : le couronnement de Marie.",
      ],
      luminous: [
        "Premier mystère lumineux : le baptême de Jésus dans le Jourdain.",
        "Deuxième mystère lumineux : les noces de Cana.",
        "Troisième mystère lumineux : l'annonce du Royaume de Dieu.",
        "Quatrième mystère lumineux : la Transfiguration.",
        "Cinquième mystère lumineux : l'institution de l'Eucharistie.",
      ],
    },
    versicle: "Prie pour nous, Sainte Mère de Dieu.",
    response: "Afin que nous soyons rendus dignes des promesses du Christ.",
    letUsPray: "Prions.",
    closingPrayer:
      "Ô Dieu, dont le Fils unique, par sa vie, sa mort et sa résurrection, nous a acquis les récompenses de la vie éternelle, fais, nous t'en supplions, qu'en méditant ces mystères du Rosaire de la Bienheureuse Vierge Marie, nous puissions imiter ce qu'ils contiennent et obtenir ce qu'ils promettent. Par Jésus Christ, notre Seigneur. Amen.",
  },
  // Italian
  it: {
    announcements: {
      joyful: [
        "Primo mistero della gioia: l'annuncio dell'Angelo a Maria.",
        "Secondo mistero della gioia: la visita di Maria a Elisabetta.",
        "Terzo mistero della gioia: la nascita di Gesù a Betlemme.",
        "Quarto mistero della gioia: la presentazione di Gesù al Tempio.",
        "Quinto mistero della gioia: il ritrovamento di Gesù nel Tempio.",
      ],
      sorrowful: [
        "Primo mistero del dolore: Gesù nell'orto degli ulivi.",
        "Secondo mistero del dolore: Gesù flagellato alla colonna.",
        "Terzo mistero del dolore: Gesù è coronato di spine.",
        "Quarto mistero del dolore: Gesù sale al Calvario.",
        "Quinto mistero del dolore: Gesù muore in Croce.",
      ],
      glorious: [
        "Primo mistero della gloria: Gesù risorge da morte.",
        "Secondo mistero della gloria: Gesù ascende al cielo.",
        "Terzo mistero della gloria: la discesa dello Spirito Santo.",
        "Quarto mistero della gloria: l'assunzione di Maria al cielo.",
        "Quinto mistero della gloria: Maria, Regina del cielo e della terra.",
      ],
      luminous: [
        "Primo mistero della luce: il battesimo di Gesù al Giordano.",
        "Secondo mistero della luce: l'auto-rivelazione di Gesù alle nozze di Cana.",
        "Terzo mistero della luce: l'annuncio del Regno di Dio con l'invito alla conversione.",
        "Quarto mistero della luce: la trasfigurazione di Gesù sul Tabor.",
        "Quinto mistero della luce: l'istituzione dell'Eucaristia.",
      ],
    },
    versicle: "Prega per noi, santa Madre di Dio.",
    response: "Affinché siamo fatti degni delle promesse di Cristo.",
    letUsPray: "Preghiamo.",
    closingPrayer:
      "O Dio, il tuo unico Figlio ci ha acquistato con la sua vita, morte e risurrezione i beni della salvezza eterna: concedi a noi che, venerando questi misteri del santo Rosario della Vergine Maria, imitiamo ciò che contengono e otteniamo ciò che promettono. Per Cristo nostro Signore. Amen.",
  },
  // German
  de: {
    announcements: {
      joyful: [
        "Das erste freudenreiche Geheimnis: Jesus, den du, o Jungfrau, vom Heiligen Geist empfangen hast.",
        "Das zweite freudenreiche Geheimnis: Jesus, den du, o Jungfrau, zu Elisabet getragen hast.",
        "Das dritte freudenreiche Geheimnis: Jesus, den du, o Jungfrau, zu Betlehem geboren hast.",
        "Das vierte freudenreiche Geheimnis: Jesus, den du, o Jungfrau, im Tempel aufgeopfert hast.",
        "Das fünfte freudenreiche Geheimnis: Jesus, den du, o Jungfrau, im Tempel wiedergefunden hast.",
      ],
      sorrowful: [
        "Das erste schmerzhafte Geheimnis: Jesus, der für uns Blut geschwitzt hat.",
        "Das zweite schmerzhafte Geheimnis: Jesus, der für uns gegeißelt worden ist.",
        "Das dritte schmerzhafte Geheimnis: Jesus, der für uns mit Dornen gekrönt worden ist.",
        "Das vierte schmerzhafte Geheimnis: Jesus, der für uns das schwere Kreuz getragen hat.",
        "Das fünfte schmerzhafte Geheimnis: Jesus, der für uns gekreuzigt worden ist.",
      ],
      glorious: [
        "Das erste glorreiche Geheimnis: Jesus, der von den Toten auferstanden ist.",
        "Das zweite glorreiche Geheimnis: Jesus, der in den Himmel aufgefahren ist.",
        "Das dritte glorreiche Geheimnis: Jesus, der uns den Heiligen Geist gesandt hat.",
        "Das vierte glorreiche Geheimnis: Jesus, der dich, o Jungfrau, in den Himmel aufgenommen hat.",
        "Das fünfte glorreiche Geheimnis: Jesus, der dich, o Jungfrau, im Himmel gekrönt hat.",
      ],
      luminous: [
        "Das erste lichtreiche Geheimnis: Jesus, der von Johannes getauft worden ist.",
        "Das zweite lichtreiche Geheimnis: Jesus, der sich bei der Hochzeit in Kana offenbart hat.",
        "Das dritte lichtreiche Geheimnis: Jesus, der uns das Reich Gottes verkündet hat.",
        "Das vierte lichtreiche Geheimnis: Jesus, der auf dem Berg verklärt worden ist.",
        "Das fünfte lichtreiche Geheimnis: Jesus, der uns die Eucharistie geschenkt hat.",
      ],
    },
    versicle: "Bitte für uns, heilige Gottesmutter.",
    response: "Dass wir würdig werden der Verheißungen Christi.",
    letUsPray: "Lasset uns beten.",
    closingPrayer:
      "Gott, dein eingeborener Sohn hat uns durch sein Leben, seinen Tod und seine Auferstehung die Schätze des ewigen Heiles erworben. Wir verehren diese Geheimnisse im heiligen Rosenkranz der seligen Jungfrau Maria. Lass uns nachahmen, was sie enthalten, und erlangen, was sie verheißen. Darum bitten wir durch Christus, unsern Herrn. Amen.",
  },
  // Portuguese (Brazil)
  pt: {
    announcements: {
      joyful: [
        "Primeiro Mistério Gozoso: A Anunciação do Anjo a Maria.",
        "Segundo Mistério Gozoso: A Visitação de Nossa Senhora a sua prima Isabel.",
        "Terceiro Mistério Gozoso: O Nascimento de Jesus em Belém.",
        "Quarto Mistério Gozoso: A Apresentação do Menino Jesus no Templo.",
        "Quinto Mistério Gozoso: A Perda e o Encontro do Menino Jesus no Templo.",
      ],
      sorrowful: [
        "Primeiro Mistério Doloroso: A Agonia de Jesus no Horto das Oliveiras.",
        "Segundo Mistério Doloroso: A Flagelação de Jesus, preso à coluna.",
        "Terceiro Mistério Doloroso: A Coroação de Espinhos.",
        "Quarto Mistério Doloroso: Jesus carregando a cruz no caminho do Calvário.",
        "Quinto Mistério Doloroso: A Crucifixão e Morte de Jesus.",
      ],
      glorious: [
        "Primeiro Mistério Glorioso: A Ressurreição de Jesus.",
        "Segundo Mistério Glorioso: A Ascensão de Jesus ao Céu.",
        "Terceiro Mistério Glorioso: A Vinda do Espírito Santo sobre os Apóstolos.",
        "Quarto Mistério Glorioso: A Assunção de Maria ao Céu.",
        "Quinto Mistério Glorioso: A Coroação de Maria como Rainha do Céu e da Terra.",
      ],
      luminous: [
        "Primeiro Mistério Luminoso: O Batismo de Jesus no rio Jordão.",
        "Segundo Mistério Luminoso: A Autorrevelação de Jesus nas Bodas de Caná.",
        "Terceiro Mistério Luminoso: O Anúncio do Reino de Deus.",
        "Quarto Mistério Luminoso: A Transfiguração de Jesus.",
        "Quinto Mistério Luminoso: A Instituição da Eucaristia.",
      ],
    },
    versicle: "Rogai por nós, santa Mãe de Deus.",
    response: "Para que sejamos dignos das promessas de Cristo.",
    letUsPray: "Oremos.",
    closingPrayer:
      "Ó Deus, que, pela vida, morte e ressurreição do vosso Filho Unigênito, nos adquiristes o prêmio da salvação eterna, concedei-nos, vos pedimos, que, venerando os mistérios do santíssimo Rosário da Virgem Maria, imitemos o que eles contêm e alcancemos o que eles prometem. Por Cristo, nosso Senhor. Amém.",
  },
  // Polish
  pl: {
    announcements: {
      joyful: [
        "Pierwsza tajemnica radosna: Zwiastowanie Najświętszej Maryi Pannie.",
        "Druga tajemnica radosna: Nawiedzenie świętej Elżbiety.",
        "Trzecia tajemnica radosna: Narodzenie Pana Jezusa.",
        "Czwarta tajemnica radosna: Ofiarowanie Pana Jezusa w świątyni.",
        "Piąta tajemnica radosna: Odnalezienie Pana Jezusa w świątyni.",
      ],
      sorrowful: [
        "Pierwsza tajemnica bolesna: Modlitwa Pana Jezusa w Ogrójcu.",
        "Druga tajemnica bolesna: Biczowanie Pana Jezusa.",
        "Trzecia tajemnica bolesna: Cierniem ukoronowanie Pana Jezusa.",
        "Czwarta tajemnica bolesna: Dźwiganie krzyża na Kalwarię.",
        "Piąta tajemnica bolesna: Śmierć Pana Jezusa na krzyżu.",
      ],
      glorious: [
        "Pierwsza tajemnica chwalebna: Zmartwychwstanie Pana Jezusa.",
        "Druga tajemnica chwalebna: Wniebowstąpienie Pana Jezusa.",
        "Trzecia tajemnica chwalebna: Zesłanie Ducha Świętego.",
        "Czwarta tajemnica chwalebna: Wniebowzięcie Najświętszej Maryi Panny.",
        "Piąta tajemnica chwalebna: Ukoronowanie Najświętszej Maryi Panny na Królową nieba i ziemi.",
      ],
      luminous: [
        "Pierwsza tajemnica światła: Chrzest Pana Jezusa w Jordanie.",
        "Druga tajemnica światła: Objawienie się Pana Jezusa na weselu w Kanie Galilejskiej.",
        "Trzecia tajemnica światła: Głoszenie królestwa Bożego i wzywanie do nawrócenia.",
        "Czwarta tajemnica światła: Przemienienie na górze Tabor.",
        "Piąta tajemnica światła: Ustanowienie Eucharystii.",
      ],
    },
    versicle: "Módl się za nami, Święta Boża Rodzicielko.",
    response: "Abyśmy się stali godnymi obietnic Chrystusowych.",
    letUsPray: "Módlmy się.",
    closingPrayer:
      "Boże, którego Jednorodzony Syn przez swoje życie, śmierć i zmartwychwstanie wysłużył nam nagrodę zbawienia wiecznego, spraw, prosimy, abyśmy, rozważając te tajemnice w Najświętszym Różańcu Błogosławionej Maryi Panny, naśladowali to, co one zawierają, i osiągnęli to, co obiecują. Przez Chrystusa, Pana naszego. Amen.",
  },
  // Latin
  la: {
    announcements: {
      joyful: [
        "Primum mysterium gaudiosum: Annuntiatio.",
        "Secundum mysterium gaudiosum: Visitatio.",
        "Tertium mysterium gaudiosum: Nativitas.",
        "Quartum mysterium gaudiosum: Praesentatio.",
        "Quintum mysterium gaudiosum: Inventio in Templo.",
      ],
      sorrowful: [
        "Primum mysterium dolorosum: Agonia in Horto.",
        "Secundum mysterium dolorosum: Flagellatio.",
        "Tertium mysterium dolorosum: Coronatio Spinis.",
        "Quartum mysterium dolorosum: Baiulatio Crucis.",
        "Quintum mysterium dolorosum: Crucifixio et Mors.",
      ],
      glorious: [
        "Primum mysterium gloriosum: Resurrectio.",
        "Secundum mysterium gloriosum: Ascensio.",
        "Tertium mysterium gloriosum: Descensus Spiritus Sancti.",
        "Quartum mysterium gloriosum: Assumptio.",
        "Quintum mysterium gloriosum: Coronatio in Caelo.",
      ],
      luminous: [
        "Primum mysterium luminosum: Baptisma apud Iordanem.",
        "Secundum mysterium luminosum: Autorevelatio apud Cananense matrimonium.",
        "Tertium mysterium luminosum: Regni Dei proclamatio coniuncta cum invitamento ad conversionem.",
        "Quartum mysterium luminosum: Transfiguratio.",
        "Quintum mysterium luminosum: Eucharistiae Institutio.",
      ],
    },
    versicle: "Ora pro nobis, sancta Dei Genetrix.",
    response: "Ut digni efficiamur promissionibus Christi.",
    letUsPray: "Oremus.",
    closingPrayer:
      "Deus, cuius Unigenitus per vitam, mortem et resurrectionem suam nobis salutis aeternae praemia comparavit: concede, quaesumus, ut haec mysteria sacratissimo beatae Mariae Virginis Rosario recolentes, et imitemur quod continent, et quod promittunt assequamur. Per Christum Dominum nostrum. Amen.",
  },
  // Filipino
  tl: {
    announcements: {
      joyful: [
        "Ang Unang Misteryo ng Tuwa: Ang Pagbati ng Anghel sa Mahal na Birheng Maria.",
        "Ang Ikalawang Misteryo ng Tuwa: Ang Pagdalaw ng Mahal na Birheng Maria kay Santa Isabel.",
        "Ang Ikatlong Misteryo ng Tuwa: Ang Pagsilang sa Daigdig ng Anak ng Diyos.",
        "Ang Ikaapat na Misteryo ng Tuwa: Ang Paghahain kay Hesus sa Templo.",
        "Ang Ikalimang Misteryo ng Tuwa: Ang Pagkakita kay Hesus sa Templo.",
      ],
      sorrowful: [
        "Ang Unang Misteryo ng Hapis: Ang Pananalangin ni Hesus sa Halamanan ng Getsemani.",
        "Ang Ikalawang Misteryo ng Hapis: Ang Paghampas kay Hesus na Nakagapos sa Haliging Bato.",
        "Ang Ikatlong Misteryo ng Hapis: Ang Pagpuputong ng Koronang Tinik kay Hesus.",
        "Ang Ikaapat na Misteryo ng Hapis: Ang Pagpapasan ng Krus ni Hesus.",
        "Ang Ikalimang Misteryo ng Hapis: Ang Pagkapako at Pagkamatay ni Hesus sa Krus.",
      ],
      glorious: [
        "Ang Unang Misteryo ng Luwalhati: Ang Muling Pagkabuhay ni Hesus.",
        "Ang Ikalawang Misteryo ng Luwalhati: Ang Pag-akyat sa Langit ni Hesus.",
        "Ang Ikatlong Misteryo ng Luwalhati: Ang Pagpanaog ng Espiritu Santo sa mga Apostol.",
        "Ang Ikaapat na Misteryo ng Luwalhati: Ang Pag-aakyat sa Langit sa Mahal na Birheng Maria.",
        "Ang Ikalimang Misteryo ng Luwalhati: Ang Pagpuputong sa Mahal na Birheng Maria bilang Reyna ng Langit at Lupa.",
      ],
      luminous: [
        "Ang Unang Misteryo ng Liwanag: Ang Pagbibinyag kay Hesus sa Ilog Jordan.",
        "Ang Ikalawang Misteryo ng Liwanag: Ang Pagpapahayag ni Hesus ng Kanyang Sarili sa Kasalan sa Cana.",
        "Ang Ikatlong Misteryo ng Liwanag: Ang Pagpapahayag ni Hesus ng Kaharian ng Diyos.",
        "Ang Ikaapat na Misteryo ng Liwanag: Ang Pagbabagong-anyo ni Hesus sa Bundok ng Tabor.",
        "Ang Ikalimang Misteryo ng Liwanag: Ang Pagtatatag ni Hesus ng Banal na Eukaristiya.",
      ],
    },
    versicle: "Ipanalangin mo kami, O Santang Ina ng Diyos.",
    response: "Nang kami'y maging karapat-dapat sa mga pangako ni Kristo.",
    letUsPray: "Manalangin tayo.",
    closingPrayer:
      "O Diyos, na ang bugtong Mong Anak, sa pamamagitan ng Kanyang buhay, kamatayan, at muling pagkabuhay, ay nagtamo para sa amin ng gantimpala ng buhay na walang hanggan; ipagkaloob Mo, hinihiling namin sa Iyo, na sa pagninilay namin sa mga misteryong ito ng kabanal-banalang Rosaryo ng Mahal na Birheng Maria, ay matularan namin ang kanilang nilalaman at makamtan ang kanilang ipinangangako. Sa pamamagitan din ni Kristong aming Panginoon. Amen.",
  },
  // Vietnamese
  vi: {
    announcements: {
      joyful: [
        "Thứ nhất thì ngắm: Thiên Thần truyền tin cho Đức Bà chịu thai. Ta hãy xin cho được ở khiêm nhường.",
        "Thứ hai thì ngắm: Đức Bà đi viếng bà thánh Isave. Ta hãy xin cho được lòng yêu người.",
        "Thứ ba thì ngắm: Đức Bà sinh Đức Chúa Giêsu nơi hang đá. Ta hãy xin cho được lòng khó khăn.",
        "Thứ bốn thì ngắm: Đức Bà dâng Đức Chúa Giêsu trong Đền Thánh. Ta hãy xin cho được vâng lời chịu lụy.",
        "Thứ năm thì ngắm: Đức Bà tìm được Đức Chúa Giêsu trong Đền Thánh. Ta hãy xin cho được giữ nghĩa cùng Chúa luôn.",
      ],
      sorrowful: [
        "Thứ nhất thì ngắm: Đức Chúa Giêsu lo buồn đổ mồ hôi máu. Ta hãy xin cho được ăn năn tội nên.",
        "Thứ hai thì ngắm: Đức Chúa Giêsu chịu đánh đòn. Ta hãy xin cho được hãm mình chịu khó bằng lòng.",
        "Thứ ba thì ngắm: Đức Chúa Giêsu chịu đội mão gai. Ta hãy xin cho được chịu mọi sự sỉ nhục bằng lòng.",
        "Thứ bốn thì ngắm: Đức Chúa Giêsu vác cây Thánh Giá. Ta hãy xin cho được vác Thánh Giá theo chân Chúa.",
        "Thứ năm thì ngắm: Đức Chúa Giêsu chịu chết trên cây Thánh Giá. Ta hãy xin đóng đinh tính xác thịt vào Thánh Giá Chúa.",
      ],
      glorious: [
        "Thứ nhất thì ngắm: Đức Chúa Giêsu sống lại. Ta hãy xin cho được sống lại thật về phần linh hồn.",
        "Thứ hai thì ngắm: Đức Chúa Giêsu lên trời. Ta hãy xin cho được ái mộ những sự trên trời.",
        "Thứ ba thì ngắm: Đức Chúa Thánh Thần hiện xuống. Ta hãy xin cho được lòng đầy dẫy mọi ơn Đức Chúa Thánh Thần.",
        "Thứ bốn thì ngắm: Đức Chúa Trời cho Đức Bà lên trời. Ta hãy xin ơn chết lành trong tay Đức Mẹ.",
        "Thứ năm thì ngắm: Đức Chúa Trời thưởng Đức Mẹ trên trời. Ta hãy xin Đức Mẹ phù hộ cho ta được thưởng cùng Đức Mẹ trên nước thiên đàng.",
      ],
      luminous: [
        "Thứ nhất thì ngắm: Đức Chúa Giêsu chịu phép Rửa tại sông Giođan. Ta hãy xin cho được sống xứng đáng là con cái Chúa.",
        "Thứ hai thì ngắm: Đức Chúa Giêsu dự tiệc cưới Cana. Ta hãy xin cho được vững tin vào quyền năng của Ngài.",
        "Thứ ba thì ngắm: Đức Chúa Giêsu rao giảng Nước Trời và kêu gọi sám hối. Ta hãy xin cho được hoán cải và đón nhận Tin Mừng.",
        "Thứ bốn thì ngắm: Đức Chúa Giêsu biến hình trên núi. Ta hãy xin cho được lắng nghe và thực hành lời Chúa.",
        "Thứ năm thì ngắm: Đức Chúa Giêsu lập bí tích Thánh Thể. Ta hãy xin cho được năng kết hợp cùng Chúa Giêsu Thánh Thể.",
      ],
    },
    versicle: "Lạy Rất Thánh Đức Mẹ Chúa Trời, xin cầu cho chúng con.",
    response: "Đáng chịu lấy những sự Chúa Kitô đã hứa.",
    letUsPray: "Chúng ta hãy cầu nguyện.",
    closingPrayer:
      "Lạy Cha, Con Một Cha đã sắm sẵn cho chúng con phần thưởng cứu rỗi đời đời, bởi công Người đã sống, đã chết và đã sống lại. Nay chúng con kính nhớ các mầu nhiệm ấy trong phép Rất Thánh Mân Côi Đức Trinh Nữ Maria, thì xin Cha ban cho chúng con được bắt chước gương lành tích chứa trong các mầu nhiệm ấy, và lãnh phần hưởng hứa ban. Nhờ Đức Giêsu Kitô, Chúa chúng con. Amen.",
  },
  // Korean
  ko: {
    announcements: {
      joyful: [
        "환희의 신비 1단, 마리아께서 예수님을 잉태하심을 묵상합시다.",
        "환희의 신비 2단, 마리아께서 엘리사벳을 찾아보심을 묵상합시다.",
        "환희의 신비 3단, 마리아께서 예수님을 낳으심을 묵상합시다.",
        "환희의 신비 4단, 마리아께서 예수님을 성전에 바치심을 묵상합시다.",
        "환희의 신비 5단, 마리아께서 잃으셨던 예수님을 성전에서 찾으심을 묵상합시다.",
      ],
      sorrowful: [
        "고통의 신비 1단, 예수님께서 우리를 위하여 피땀 흘리심을 묵상합시다.",
        "고통의 신비 2단, 예수님께서 우리를 위하여 매 맞으심을 묵상합시다.",
        "고통의 신비 3단, 예수님께서 우리를 위하여 가시관 쓰심을 묵상합시다.",
        "고통의 신비 4단, 예수님께서 우리를 위하여 십자가 지심을 묵상합시다.",
        "고통의 신비 5단, 예수님께서 우리를 위하여 십자가에 못 박혀 돌아가심을 묵상합시다.",
      ],
      glorious: [
        "영광의 신비 1단, 예수님께서 부활하심을 묵상합시다.",
        "영광의 신비 2단, 예수님께서 승천하심을 묵상합시다.",
        "영광의 신비 3단, 예수님께서 성령을 보내심을 묵상합시다.",
        "영광의 신비 4단, 예수님께서 마리아를 하늘에 불러올리심을 묵상합시다.",
        "영광의 신비 5단, 예수님께서 마리아께 천상 모후의 관을 씌우심을 묵상합시다.",
      ],
      luminous: [
        "빛의 신비 1단, 예수님께서 세례 받으심을 묵상합시다.",
        "빛의 신비 2단, 예수님께서 카나에서 첫 기적을 행하심을 묵상합시다.",
        "빛의 신비 3단, 예수님께서 하느님 나라를 선포하심을 묵상합시다.",
        "빛의 신비 4단, 예수님께서 거룩하게 변모하심을 묵상합시다.",
        "빛의 신비 5단, 예수님께서 성체성사를 세우심을 묵상합시다.",
      ],
    },
    versicle: "천주의 성모님, 저희를 위하여 빌어 주시어",
    response: "그리스도께서 약속하신 영원한 생명을 얻게 하소서.",
    letUsPray: "기도합시다.",
    closingPrayer:
      "하느님, 외아드님께서 삶과 죽음과 부활로 저희에게 영원한 구원을 마련해 주셨나이다. 복되신 동정 마리아와 함께 이 신비를 묵상하며 묵주 기도를 바치오니 저희가 그 가르침을 따라 영원한 생명을 얻게 하소서. 우리 주 그리스도를 통하여 비나이다. 아멘.",
  },
  // Chinese
  zh: {
    announcements: {
      joyful: [
        "欢喜一端：圣母领报。",
        "欢喜二端：圣母往见圣妇依撒伯尔。",
        "欢喜三端：耶稣基督降生。",
        "欢喜四端：圣母献耶稣于圣殿。",
        "欢喜五端：耶稣十二龄讲道。",
      ],
      sorrowful: [
        "痛苦一端：耶稣山园祈祷。",
        "痛苦二端：耶稣受鞭打之刑。",
        "痛苦三端：耶稣受茨冠之苦辱。",
        "痛苦四端：耶稣背十字架上山。",
        "痛苦五端：耶稣死在十字架上。",
      ],
      glorious: [
        "荣福一端：耶稣复活。",
        "荣福二端：耶稣升天。",
        "荣福三端：圣神降临。",
        "荣福四端：圣母蒙召升天。",
        "荣福五端：圣母为天地之母后。",
      ],
      luminous: [
        "光明一端：耶稣在约但河受洗。",
        "光明二端：耶稣参加加纳婚宴。",
        "光明三端：耶稣宣讲天国福音。",
        "光明四端：耶稣大博尔山显容。",
        "光明五端：耶稣建立圣体圣事。",
      ],
    },
    versicle: "天主圣母，请为我们祈求。",
    response: "使我们堪受基督的恩许。",
    letUsPray: "请大家祈祷。",
    closingPrayer:
      "天主，你的独生子以祂的生命、死亡与复活，为我们换取了永生的赏报。求你使我们在默想荣福童贞玛利亚至圣玫瑰经的这些奥迹时，效法其中所蕴含的，并获得其中所许诺的。因我们的主基督。阿们。",
  },
  // Greek
  el: {
    announcements: {
      joyful: [
        "Στο πρώτο χαροποιό μυστήριο μελετούμε τον ευαγγελισμό της Θεοτόκου.",
        "Στο δεύτερο χαροποιό μυστήριο μελετούμε την επίσκεψη της Παναγίας στην Αγία Ελισάβετ.",
        "Στο τρίτο χαροποιό μυστήριο μελετούμε τη γέννηση του Κυρίου μας Ιησού Χριστού.",
        "Στο τέταρτο χαροποιό μυστήριο μελετούμε την προσφορά του Ιησού στο ναό.",
        "Στο πέμπτο χαροποιό μυστήριο μελετούμε την εύρεση του Ιησού στο ναό ανάμεσα στους διδασκάλους.",
      ],
      sorrowful: [
        "Στο πρώτο λυπηρό μυστήριο μελετούμε την προσευχή του Ιησού στον κήπο των ελαιών.",
        "Στο δεύτερο λυπηρό μυστήριο μελετούμε τη μαστίγωση του Ιησού.",
        "Στο τρίτο λυπηρό μυστήριο μελετούμε την ακάνθινη στεφάνωση του Ιησού.",
        "Στο τέταρτο λυπηρό μυστήριο μελετούμε την πορεία του Ιησού προς το Γολγοθά.",
        "Στο πέμπτο λυπηρό μυστήριο μελετούμε τη σταύρωση και το θάνατο του Ιησού.",
      ],
      glorious: [
        "Στο πρώτο ένδοξο μυστήριο μελετούμε την Ανάσταση του Ιησού.",
        "Στο δεύτερο ένδοξο μυστήριο μελετούμε την Ανάληψη του Ιησού.",
        "Στο τρίτο ένδοξο μυστήριο μελετούμε την έλευση του Αγίου Πνεύματος επί των Αποστόλων.",
        "Στο τέταρτο ένδοξο μυστήριο μελετούμε τη μετάσταση της Παναγίας στον ουρανό με το σώμα της και την ψυχή της.",
        "Στο πέμπτο ένδοξο μυστήριο μελετούμε τη στέψη της Παναγίας ως Βασίλισσας του ουρανού και της γης.",
      ],
      luminous: [
        "Στο πρώτο φωτεινό μυστήριο μελετούμε τη βάπτιση του Ιησού στον Ιορδάνη ποταμό.",
        "Στο δεύτερο φωτεινό μυστήριο μελετούμε τη φανέρωση της θεότητας του Ιησού στο Γάμο της Κανά.",
        "Στο τρίτο φωτεινό μυστήριο μελετούμε την αναγγελία της Βασιλείας του Θεού και το κάλεσμα σε μεταστροφή.",
        "Στο τέταρτο φωτεινό μυστήριο μελετούμε τη μεταμόρφωση του Ιησού επάνω στο όρος Θαβώρ.",
        "Στο πέμπτο φωτεινό μυστήριο μελετούμε τη σύσταση του Μυστηρίου της θείας Ευχαριστίας.",
      ],
    },
    versicle: "Ικέτευε για μας, Υπεραγία Θεοτόκε.",
    response: "Για να γίνουμε άξιοι των υποσχέσεων του Χριστού.",
    letUsPray: "Ας προσευχηθούμε.",
    closingPrayer:
      "Θεέ Πατέρα, του οποίου ο Μονογενής Υιός, με τη ζωή, το θάνατο και την ανάστασή του, μας απέκτησε την αμοιβή της αιώνιας σωτηρίας, σε παρακαλούμε, όταν απαγγέλλουμε το σεπτό Ροδάριο της μακαρίας και Αειπαρθένου Μαρίας, και μελετούμε τα Μυστήρια αυτά της σωτηρίας, κάνε να τηρούμε όσα μας διδάσκουν και ν’ αποκτήσομε όσα μας υπόσχονται. Διά του Ιησού Χριστού, του Κυρίου μας. Αμήν.",
  },
};

/** The Rosary's own words in `lang`. */
export function rosaryTextsFor(lang: AudioLang): RosaryTexts | null {
  return ROSARY_TEXTS[lang] ?? null;
}
