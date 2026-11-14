/**
 * The one-off "Thank you!" letter to Via Fidei's members (November 2026),
 * in each member's own language. The wording is the owner's; the figures for
 * every section of the site are read from the live catalogue at send time.
 *
 * Sent by scripts/email/send-thank-you.ts.
 */
import { formatEmailCount, renderEmail } from "./layout";
import type { RenderedEmail } from "./templates";
import { copyrightNotice, resolveEmailLocale, type EmailLocale } from "./translations";

/**
 * What the site holds, section by section in the order of its own menu. The
 * owner asked for every kind of content; sacraments are left out (there are
 * seven, which goes without saying) and the liturgical calendar is complete
 * rather than counted.
 */
export type SiteContentCounts = {
  prayers: number;
  litanies: number;
  devotions: number;
  novenas: number;
  saints: number;
  apparitions: number;
  marianTitles: number;
  doctors: number;
  popes: number;
  parishes: number;
  spiritualLife: number;
  guides: number;
  liturgy: number;
  rites: number;
  history: number;
  churchDocuments: number;
};

type ThankYouDictionary = {
  subject: string;
  heading: string;
  preheader: string;
  paragraph1: string;
  paragraph2: string;
  listIntro: string;
  item1: string;
  item2: string;
  item3: string;
  labelSaints: string;
  labelApparitions: string;
  labelChurchDocuments: string;
  labelPrayers: string;
  labelGuides: string;
  labelLitanies: string;
  labelDevotions: string;
  labelNovenas: string;
  labelMarianTitles: string;
  labelDoctors: string;
  labelPopes: string;
  labelParishes: string;
  labelSpiritualLife: string;
  labelLiturgy: string;
  labelLiturgicalCalendar: string;
  valueComplete: string;
  labelRites: string;
  labelHistory: string;
  closing: string;
  signoffBlessing: string;
  signoffTeam: string;
};

const EN: ThankYouDictionary = {
  subject: "Thank you!",
  heading: "Thank you!",
  preheader: "We would like to thank you for using our platform.",
  paragraph1:
    "We would like to thank you for using our platform. We have made a number of updates to the website to polish things off, as this is a new project to make the Catholic faith more accessible on the internet, providing accurate and quality Catholic content to help the Church fulfill her mission of spreading the Good News.",
  paragraph2:
    "We are ready to have more users. If you know anyone else that may find use in our website, give it a share and introduce them to it. Maybe share your favorite prayer or saint. We will be developing more features while maintaining an easy-to-use page.",
  listIntro: "In the coming months we plan to roll out:",
  item1: "An audio companion that will help people with prayers.",
  item2: "A feedback feature for product requests and issue reporting.",
  item3: "And of course, adding more content to what we currently have.",
  labelSaints: "Saints",
  labelApparitions: "Apparitions",
  labelChurchDocuments: "Church Documents",
  labelPrayers: "Prayers",
  labelGuides: "Guides",
  labelLitanies: "Litanies",
  labelDevotions: "Devotions",
  labelNovenas: "Novenas",
  labelMarianTitles: "Marian Titles",
  labelDoctors: "Doctors of the Church",
  labelPopes: "Popes",
  labelParishes: "Parishes",
  labelSpiritualLife: "Spiritual Life",
  labelLiturgy: "Liturgy",
  labelLiturgicalCalendar: "Liturgical Calendar",
  valueComplete: "Complete",
  labelRites: "Rites",
  labelHistory: "History",
  closing: "We look forward to seeing how this project grows, as we already have dozens of users!",
  signoffBlessing: "Blessings,",
  signoffTeam: "The Via Fidei Team",
};

/* TRANSLATIONS:BEGIN */
const ES: ThankYouDictionary = {
  subject: "¡Gracias!",
  heading: "¡Gracias!",
  preheader: "Nos gustaría darte las gracias por usar nuestra plataforma.",
  paragraph1:
    "Nos gustaría darte las gracias por usar nuestra plataforma. Hemos hecho varias actualizaciones en el sitio web para pulir los últimos detalles, ya que este es un proyecto nuevo para hacer más accesible la fe católica en internet, ofreciendo contenido católico preciso y de calidad para ayudar a la Iglesia a cumplir su misión de difundir la Buena Nueva.",
  paragraph2:
    "Estamos listos para recibir a más usuarios. Si conoces a alguien más a quien nuestro sitio web le pueda resultar útil, compártelo y preséntaselo. Tal vez puedas compartir tu oración favorita o tu santo favorito. Desarrollaremos más funciones, manteniendo a la vez una página fácil de usar.",
  listIntro: "En los próximos meses tenemos previsto lanzar:",
  item1: "Un acompañante en audio que ayudará a las personas con sus oraciones.",
  item2: "Una función de comentarios para solicitar mejoras e informar sobre problemas.",
  item3: "Y, por supuesto, añadir más contenido al que ya tenemos.",
  labelSaints: "Santos",
  labelApparitions: "Apariciones",
  labelChurchDocuments: "Documentos de la Iglesia",
  labelPrayers: "Oraciones",
  labelGuides: "Guías",
  labelLitanies: "Letanías",
  labelDevotions: "Devociones",
  labelNovenas: "Novenas",
  labelMarianTitles: "Advocaciones marianas",
  labelDoctors: "Doctores de la Iglesia",
  labelPopes: "Papas",
  labelParishes: "Parroquias",
  labelSpiritualLife: "Vida Espiritual",
  labelLiturgy: "Liturgia",
  labelLiturgicalCalendar: "Calendario litúrgico",
  valueComplete: "Completo",
  labelRites: "Ritos",
  labelHistory: "Historia",
  closing:
    "¡Esperamos con entusiasmo ver cómo crece este proyecto, pues ya tenemos decenas de usuarios!",
  signoffBlessing: "Bendiciones,",
  signoffTeam: "El equipo de Via Fidei",
};

const FR: ThankYouDictionary = {
  subject: "Merci !",
  heading: "Merci !",
  preheader: "Nous tenons à vous remercier d’utiliser notre plateforme.",
  paragraph1:
    "Nous tenons à vous remercier d’utiliser notre plateforme. Nous avons apporté un certain nombre de mises à jour au site pour peaufiner l’ensemble, car il s’agit d’un nouveau projet qui vise à rendre la foi catholique plus accessible sur Internet, en proposant des contenus catholiques exacts et de qualité pour aider l’Église à accomplir sa mission de répandre la Bonne Nouvelle.",
  paragraph2:
    "Nous sommes prêts à accueillir davantage d’utilisateurs. Si vous connaissez d’autres personnes à qui notre site pourrait être utile, partagez-le et faites-le-leur découvrir. Partagez, pourquoi pas, votre prière préférée ou votre saint préféré. Nous allons développer d’autres fonctionnalités tout en conservant un site simple à utiliser.",
  listIntro: "Dans les mois à venir, nous prévoyons de lancer :",
  item1: "Un compagnon audio qui aidera les gens à prier.",
  item2:
    "Une fonctionnalité de retours pour les demandes d’amélioration et le signalement de problèmes.",
  item3:
    "Et bien sûr, de nouveaux contenus qui viendront s’ajouter à ceux que nous proposons déjà.",
  labelSaints: "Saints",
  labelApparitions: "Apparitions",
  labelChurchDocuments: "Documents de l’Église",
  labelPrayers: "Prières",
  labelGuides: "Guides",
  labelLitanies: "Litanies",
  labelDevotions: "Dévotions",
  labelNovenas: "Neuvaines",
  labelMarianTitles: "Titres marials",
  labelDoctors: "Docteurs de l’Église",
  labelPopes: "Papes",
  labelParishes: "Paroisses",
  labelSpiritualLife: "Vie spirituelle",
  labelLiturgy: "Liturgie",
  labelLiturgicalCalendar: "Calendrier liturgique",
  valueComplete: "Complet",
  labelRites: "Rites",
  labelHistory: "Histoire",
  closing:
    "Nous avons hâte de voir ce projet grandir, car nous comptons déjà des dizaines d’utilisateurs !",
  signoffBlessing: "Que Dieu vous bénisse,",
  signoffTeam: "L’équipe Via Fidei",
};

const IT: ThankYouDictionary = {
  subject: "Grazie!",
  heading: "Grazie!",
  preheader: "Vorremmo ringraziarti di usare la nostra piattaforma.",
  paragraph1:
    "Vorremmo ringraziarti di usare la nostra piattaforma. Abbiamo apportato diversi aggiornamenti al sito per dare gli ultimi ritocchi, poiché si tratta di un nuovo progetto per rendere la fede cattolica più accessibile su internet, offrendo contenuti cattolici accurati e di qualità per aiutare la Chiesa a compiere la sua missione di diffondere la Buona Novella.",
  paragraph2:
    "Siamo pronti ad accogliere altri utenti. Se conosci qualcun altro a cui il nostro sito potrebbe essere utile, condividilo e faglielo conoscere. Magari condividi la preghiera o il santo che preferisci. Svilupperemo altre funzioni, mantenendo al tempo stesso una pagina facile da usare.",
  listIntro: "Nei prossimi mesi prevediamo di lanciare:",
  item1: "Un compagno audio che aiuterà le persone nelle preghiere.",
  item2: "Una funzione di feedback per richiedere miglioramenti e segnalare problemi.",
  item3: "E, naturalmente, aggiungere altri contenuti a quelli che abbiamo già.",
  labelSaints: "Santi",
  labelApparitions: "Apparizioni",
  labelChurchDocuments: "Documenti della Chiesa",
  labelPrayers: "Preghiere",
  labelGuides: "Guide",
  labelLitanies: "Litanie",
  labelDevotions: "Devozioni",
  labelNovenas: "Novene",
  labelMarianTitles: "Titoli mariani",
  labelDoctors: "Dottori della Chiesa",
  labelPopes: "Papi",
  labelParishes: "Parrocchie",
  labelSpiritualLife: "Vita Spirituale",
  labelLiturgy: "Liturgia",
  labelLiturgicalCalendar: "Calendario liturgico",
  valueComplete: "Completo",
  labelRites: "Riti",
  labelHistory: "Storia",
  closing:
    "Non vediamo l'ora di scoprire come crescerà questo progetto, visto che abbiamo già decine di utenti!",
  signoffBlessing: "Dio ti benedica,",
  signoffTeam: "Il team di Via Fidei",
};

const DE: ThankYouDictionary = {
  subject: "Vielen Dank!",
  heading: "Vielen Dank!",
  preheader: "Wir möchten dir dafür danken, dass du unsere Plattform nutzt.",
  paragraph1:
    "Wir möchten dir dafür danken, dass du unsere Plattform nutzt. Wir haben eine Reihe von Aktualisierungen an der Website vorgenommen, um ihr den letzten Schliff zu geben, denn dies ist ein neues Projekt, das den katholischen Glauben im Internet leichter zugänglich machen soll. Es bietet korrekte und hochwertige katholische Inhalte, die der Kirche helfen sollen, ihre Sendung zu erfüllen: die Frohe Botschaft zu verbreiten.",
  paragraph2:
    "Wir sind bereit für mehr Nutzerinnen und Nutzer. Wenn du andere Menschen kennst, denen unsere Website nützlich sein könnte, teile sie und stelle sie ihnen vor. Vielleicht magst du dein Lieblingsgebet oder deinen Lieblingsheiligen teilen. Wir werden weitere Funktionen entwickeln und die Seite dabei einfach bedienbar halten.",
  listIntro: "In den kommenden Monaten planen wir, Folgendes einzuführen:",
  item1: "Einen Audio-Begleiter, der Menschen beim Beten hilft.",
  item2: "Eine Feedback-Funktion für Verbesserungswünsche und das Melden von Problemen.",
  item3: "Und natürlich weitere Inhalte zusätzlich zu dem, was wir bereits haben.",
  labelSaints: "Heilige",
  labelApparitions: "Erscheinungen",
  labelChurchDocuments: "Kirchendokumente",
  labelPrayers: "Gebete",
  labelGuides: "Anleitungen",
  labelLitanies: "Litaneien",
  labelDevotions: "Andachten",
  labelNovenas: "Novenen",
  labelMarianTitles: "Marientitel",
  labelDoctors: "Kirchenlehrer",
  labelPopes: "Päpste",
  labelParishes: "Pfarreien",
  labelSpiritualLife: "Geistliches Leben",
  labelLiturgy: "Liturgie",
  labelLiturgicalCalendar: "Liturgischer Kalender",
  valueComplete: "Vollständig",
  labelRites: "Riten",
  labelHistory: "Geschichte",
  closing:
    "Wir freuen uns darauf, zu sehen, wie dieses Projekt wächst, denn wir haben bereits Dutzende Nutzerinnen und Nutzer!",
  signoffBlessing: "Gottes Segen",
  signoffTeam: "Das Team von Via Fidei",
};

const PT: ThankYouDictionary = {
  subject: "Obrigado!",
  heading: "Obrigado!",
  preheader: "Gostaríamos de agradecer a você por usar nossa plataforma.",
  paragraph1:
    "Gostaríamos de agradecer a você por usar nossa plataforma. Fizemos várias atualizações no site para dar os últimos retoques, já que este é um projeto novo para tornar a fé católica mais acessível na internet, oferecendo conteúdo católico preciso e de qualidade para ajudar a Igreja a cumprir sua missão de difundir a Boa-Nova.",
  paragraph2:
    "Estamos prontos para receber mais usuários. Se você conhece mais alguém a quem o nosso site possa ser útil, compartilhe-o e apresente-o a essa pessoa. Talvez você possa compartilhar sua oração favorita ou seu santo favorito. Desenvolveremos mais recursos, mantendo ao mesmo tempo uma página fácil de usar.",
  listIntro: "Nos próximos meses, pretendemos lançar:",
  item1: "Um companheiro em áudio que ajudará as pessoas em suas orações.",
  item2: "Um recurso de feedback para solicitar melhorias e relatar problemas.",
  item3: "E, claro, adicionar mais conteúdo ao que já temos.",
  labelSaints: "Santos",
  labelApparitions: "Aparições",
  labelChurchDocuments: "Documentos da Igreja",
  labelPrayers: "Orações",
  labelGuides: "Guias",
  labelLitanies: "Ladainhas",
  labelDevotions: "Devoções",
  labelNovenas: "Novenas",
  labelMarianTitles: "Títulos marianos",
  labelDoctors: "Doutores da Igreja",
  labelPopes: "Papas",
  labelParishes: "Paróquias",
  labelSpiritualLife: "Vida Espiritual",
  labelLiturgy: "Liturgia",
  labelLiturgicalCalendar: "Calendário litúrgico",
  valueComplete: "Completo",
  labelRites: "Ritos",
  labelHistory: "História",
  closing:
    "Estamos ansiosos para ver como este projeto vai crescer, pois já temos dezenas de usuários!",
  signoffBlessing: "Deus abençoe,",
  signoffTeam: "Equipe Via Fidei",
};

const PL: ThankYouDictionary = {
  subject: "Dziękujemy!",
  heading: "Dziękujemy!",
  preheader: "Chcielibyśmy podziękować Ci za korzystanie z naszej platformy.",
  paragraph1:
    "Chcielibyśmy podziękować Ci za korzystanie z naszej platformy. Wprowadziliśmy na stronie szereg aktualizacji, aby dopiąć wszystko na ostatni guzik, ponieważ jest to nowy projekt, który ma sprawić, że wiara katolicka będzie bardziej dostępna w internecie. Oferujemy rzetelne treści katolickie wysokiej jakości, aby pomóc Kościołowi wypełniać misję szerzenia Dobrej Nowiny.",
  paragraph2:
    "Jesteśmy gotowi przyjąć więcej użytkowników. Jeśli znasz kogoś, komu nasza strona mogłaby się przydać, udostępnij ją i zapoznaj z nią tę osobę. Może podzielisz się swoją ulubioną modlitwą lub ulubionym świętym? Będziemy rozwijać kolejne funkcje, dbając o to, by strona pozostała łatwa w obsłudze.",
  listIntro: "W najbliższych miesiącach planujemy wprowadzić:",
  item1: "Towarzysza audio, który pomoże ludziom w modlitwie.",
  item2: "Funkcję przesyłania opinii, służącą do zgłaszania propozycji ulepszeń i problemów.",
  item3: "I oczywiście więcej treści, które uzupełnią to, co już mamy.",
  labelSaints: "Święci",
  labelApparitions: "Objawienia",
  labelChurchDocuments: "Dokumenty Kościoła",
  labelPrayers: "Modlitwy",
  labelGuides: "Przewodniki",
  labelLitanies: "Litanie",
  labelDevotions: "Nabożeństwa",
  labelNovenas: "Nowenny",
  labelMarianTitles: "Tytuły maryjne",
  labelDoctors: "Doktorzy Kościoła",
  labelPopes: "Papieże",
  labelParishes: "Parafie",
  labelSpiritualLife: "Życie duchowe",
  labelLiturgy: "Liturgia",
  labelLiturgicalCalendar: "Kalendarz liturgiczny",
  valueComplete: "Pełny",
  labelRites: "Obrządki",
  labelHistory: "Historia",
  closing:
    "Z niecierpliwością czekamy na dalszy rozwój tego projektu, bo mamy już dziesiątki użytkowników!",
  signoffBlessing: "Szczęść Boże!",
  signoffTeam: "Zespół Via Fidei",
};

const LA: ThankYouDictionary = {
  subject: "Gratias tibi agimus!",
  heading: "Gratias tibi agimus!",
  preheader: "Gratias tibi agere volumus quod situ nostro uteris.",
  paragraph1:
    "Gratias tibi agere volumus quod situ nostro uteris. Complura in situ interretiali renovavimus ut omnia perpoliremus, quoniam hoc novum est inceptum quo fides catholica per interrete facilius pateat, argumenta catholica accurata et praestantia praebens, ut Ecclesia adiuvetur ad missionem suam Evangelii nuntiandi implendam.",
  paragraph2:
    "Parati sumus plures utentes accipere. Si quem alium nosti cui situs noster usui esse possit, situm communica eique ostende. Fortasse orationem vel sanctum tibi praedilectum communicare velis. Plures facultates elaborabimus, paginam usu facilem servantes.",
  listIntro: "Proximis mensibus haec proferre in animo habemus:",
  item1: "Comitem audibilem, qui homines in orationibus adiuvet.",
  item2: "Facultatem sententiae significandae, qua nova petere et difficultates nuntiare liceat.",
  item3: "Ac sane plura argumenta, iis quae nunc habemus addenda.",
  labelSaints: "Sancti",
  labelApparitions: "Apparitiones",
  labelChurchDocuments: "Documenta Ecclesiae",
  labelPrayers: "Orationes",
  labelGuides: "Duces",
  labelLitanies: "Litaniae",
  labelDevotions: "Devotiones",
  labelNovenas: "Novenae",
  labelMarianTitles: "Tituli Mariani",
  labelDoctors: "Doctores Ecclesiae",
  labelPopes: "Summi Pontifices",
  labelParishes: "Paroeciae",
  labelSpiritualLife: "Vita Spiritualis",
  labelLiturgy: "Liturgia",
  labelLiturgicalCalendar: "Calendarium liturgicum",
  valueComplete: "Integrum",
  labelRites: "Ritus",
  labelHistory: "Historia",
  closing:
    "Cupide exspectamus quomodo hoc inceptum crescat, cum iam aliquot utentium decades habeamus!",
  signoffBlessing: "Benedicat te Deus,",
  signoffTeam: "Coetus Via Fidei",
};

const TL: ThankYouDictionary = {
  subject: "Salamat!",
  heading: "Salamat!",
  preheader: "Nais naming magpasalamat sa iyo sa paggamit mo ng aming platform.",
  paragraph1:
    "Nais naming magpasalamat sa iyo sa paggamit mo ng aming platform. Gumawa kami ng ilang pagbabago sa website upang maging pulido ang lahat, dahil ito ay isang bagong proyektong naglalayong gawing mas abot-kamay ang pananampalatayang Katoliko sa internet, at nagbibigay ng tumpak at de-kalidad na nilalamang Katoliko upang matulungan ang Simbahan na tuparin ang kanyang misyong ipalaganap ang Mabuting Balita.",
  paragraph2:
    "Handa na kaming magkaroon ng mas maraming gumagamit. Kung may kilala ka pang iba na maaaring makinabang sa aming website, ibahagi mo ito at ipakilala mo ito sa kanila. Baka gusto mong ibahagi ang paborito mong panalangin o santo. Bubuo kami ng mas maraming feature habang pinananatili naming madaling gamitin ang pahina.",
  listIntro: "Sa mga darating na buwan, plano naming ilunsad ang mga sumusunod:",
  item1: "Isang audio companion na tutulong sa mga tao sa pagdarasal.",
  item2: "Isang feedback feature para sa mga kahilingan sa produkto at pag-uulat ng mga problema.",
  item3:
    "At siyempre, ang pagdaragdag ng mas maraming nilalaman sa kung ano ang mayroon kami ngayon.",
  labelSaints: "Mga Santo",
  labelApparitions: "Mga Pagpapakita",
  labelChurchDocuments: "Mga Dokumento ng Simbahan",
  labelPrayers: "Mga Panalangin",
  labelGuides: "Mga Gabay",
  labelLitanies: "Mga Litanya",
  labelDevotions: "Mga Debosyon",
  labelNovenas: "Mga Nobena",
  labelMarianTitles: "Mga Titulo ni Maria",
  labelDoctors: "Mga Doktor ng Simbahan",
  labelPopes: "Mga Papa",
  labelParishes: "Mga Parokya",
  labelSpiritualLife: "Buhay Espirituwal",
  labelLiturgy: "Liturhiya",
  labelLiturgicalCalendar: "Kalendaryong Liturhiko",
  valueComplete: "Kumpleto",
  labelRites: "Mga Rito",
  labelHistory: "Kasaysayan",
  closing:
    "Sabik kaming makita kung paano lalago ang proyektong ito, dahil mayroon na kaming dose-dosenang gumagamit!",
  signoffBlessing: "Pagpalain ka ng Diyos,",
  signoffTeam: "Ang Koponan ng Via Fidei",
};

const VI: ThankYouDictionary = {
  subject: "Cảm ơn bạn!",
  heading: "Cảm ơn bạn!",
  preheader: "Chúng tôi xin cảm ơn bạn đã sử dụng nền tảng của chúng tôi.",
  paragraph1:
    "Chúng tôi xin cảm ơn bạn đã sử dụng nền tảng của chúng tôi. Chúng tôi đã thực hiện một số cập nhật cho trang web để hoàn thiện mọi thứ, vì đây là một dự án mới nhằm làm cho đức tin Công giáo dễ tiếp cận hơn trên Internet, cung cấp nội dung Công giáo chính xác và có chất lượng để giúp Hội Thánh chu toàn sứ mạng loan báo Tin Mừng của mình.",
  paragraph2:
    "Chúng tôi đã sẵn sàng đón thêm người dùng. Nếu bạn biết ai khác có thể thấy trang web của chúng tôi hữu ích, hãy chia sẻ và giới thiệu trang web với họ. Bạn có thể chia sẻ kinh nguyện hoặc vị thánh mà bạn yêu thích nhất. Chúng tôi sẽ phát triển thêm các tính năng trong khi vẫn giữ cho trang web dễ sử dụng.",
  listIntro: "Trong những tháng tới, chúng tôi dự định ra mắt:",
  item1: "Một người bạn đồng hành bằng âm thanh để giúp mọi người cầu nguyện.",
  item2: "Một tính năng góp ý để gửi yêu cầu về sản phẩm và báo cáo sự cố.",
  item3: "Và tất nhiên, bổ sung thêm nội dung vào những gì chúng tôi hiện có.",
  labelSaints: "Các Thánh",
  labelApparitions: "Các cuộc hiện ra",
  labelChurchDocuments: "Văn kiện Giáo hội",
  labelPrayers: "Kinh nguyện",
  labelGuides: "Hướng dẫn",
  labelLitanies: "Kinh cầu",
  labelDevotions: "Lòng sùng kính",
  labelNovenas: "Tuần cửu nhật",
  labelMarianTitles: "Tước hiệu Đức Mẹ",
  labelDoctors: "Tiến sĩ Hội Thánh",
  labelPopes: "Các Giáo hoàng",
  labelParishes: "Giáo xứ",
  labelSpiritualLife: "Đời sống thiêng liêng",
  labelLiturgy: "Phụng vụ",
  labelLiturgicalCalendar: "Lịch phụng vụ",
  valueComplete: "Đầy đủ",
  labelRites: "Các nghi lễ",
  labelHistory: "Lịch sử",
  closing:
    "Chúng tôi mong chờ được thấy dự án này phát triển như thế nào, vì chúng tôi đã có hàng chục người dùng!",
  signoffBlessing: "Xin Chúa chúc lành cho bạn,",
  signoffTeam: "Đội ngũ Via Fidei",
};

const KO: ThankYouDictionary = {
  subject: "감사합니다!",
  heading: "감사합니다!",
  preheader: "저희 플랫폼을 이용해 주셔서 감사드립니다.",
  paragraph1:
    "저희 플랫폼을 이용해 주셔서 감사드립니다. 인터넷에서 가톨릭 신앙을 더 쉽게 접할 수 있도록 하려는 새로운 프로젝트인 만큼, 웹사이트를 다듬기 위해 여러 가지 업데이트를 했습니다. 정확하고 질 높은 가톨릭 콘텐츠를 제공하여 교회가 복음을 전하는 사명을 다할 수 있도록 돕고자 합니다.",
  paragraph2:
    "더 많은 사용자를 맞이할 준비가 되었습니다. 저희 웹사이트가 도움이 될 만한 다른 분을 알고 계시다면, 사이트를 공유하여 그분께 소개해 주세요. 가장 좋아하시는 기도문이나 성인을 공유해 보시는 것도 좋겠습니다. 사용하기 쉬운 페이지를 유지하면서 더 많은 기능을 개발해 나가겠습니다.",
  listIntro: "앞으로 몇 달 안에 다음을 선보일 계획입니다:",
  item1: "사람들의 기도를 도와줄 오디오 동반자.",
  item2: "제품 관련 요청과 문제 신고를 위한 피드백 기능.",
  item3: "그리고 물론, 현재 갖춘 콘텐츠에 더 많은 콘텐츠 추가.",
  labelSaints: "성인",
  labelApparitions: "성모 발현",
  labelChurchDocuments: "교회 문헌",
  labelPrayers: "기도문",
  labelGuides: "안내서",
  labelLitanies: "호칭 기도",
  labelDevotions: "신심",
  labelNovenas: "9일 기도",
  labelMarianTitles: "성모 칭호",
  labelDoctors: "교회 학자",
  labelPopes: "교황",
  labelParishes: "본당",
  labelSpiritualLife: "영성 생활",
  labelLiturgy: "전례",
  labelLiturgicalCalendar: "전례력",
  valueComplete: "전체 수록",
  labelRites: "예법",
  labelHistory: "역사",
  closing: "이미 수십 명의 사용자가 있기에, 이 프로젝트가 어떻게 성장해 나갈지 기대됩니다!",
  signoffBlessing: "주님의 축복을 빕니다.",
  signoffTeam: "Via Fidei 팀 드림",
};

const ZH: ThankYouDictionary = {
  subject: "谢谢您！",
  heading: "谢谢您！",
  preheader: "我们在此感谢您使用我们的平台。",
  paragraph1:
    "我们在此感谢您使用我们的平台。我们对网站进行了多项更新，使其更加完善，因为这是一个旨在让天主教信仰在互联网上更加触手可及的新项目，提供准确、优质的天主教内容，帮助教会履行她传扬福音的使命。",
  paragraph2:
    "我们已准备好迎接更多用户。如果您认识其他可能会用到我们网站的人，请将网站分享给他们，并向他们介绍。您不妨分享自己最喜爱的祈祷文或圣人。我们将开发更多功能，同时保持页面简单易用。",
  listIntro: "在接下来的几个月里，我们计划推出：",
  item1: "一个帮助人们祈祷的音频同伴。",
  item2: "一个用于提出产品需求和报告问题的反馈功能。",
  item3: "当然，还有在现有内容的基础上增加更多内容。",
  labelSaints: "圣人",
  labelApparitions: "圣母显现",
  labelChurchDocuments: "教会文献",
  labelPrayers: "祈祷文",
  labelGuides: "指南",
  labelLitanies: "祷文",
  labelDevotions: "敬礼",
  labelNovenas: "九日敬礼",
  labelMarianTitles: "圣母称号",
  labelDoctors: "教会圣师",
  labelPopes: "教宗",
  labelParishes: "堂区",
  labelSpiritualLife: "灵修生活",
  labelLiturgy: "礼仪",
  labelLiturgicalCalendar: "礼仪日历",
  valueComplete: "完整",
  labelRites: "礼仪传统",
  labelHistory: "历史",
  closing: "我们已经有了数十位用户，期待看到这个项目如何成长！",
  signoffBlessing: "愿天主降福您，",
  signoffTeam: "Via Fidei 团队",
};

const THANK_YOU: Record<EmailLocale, ThankYouDictionary> = {
  en: EN,
  es: ES,
  fr: FR,
  it: IT,
  de: DE,
  pt: PT,
  pl: PL,
  la: LA,
  tl: TL,
  vi: VI,
  ko: KO,
  zh: ZH,
};
/* TRANSLATIONS:END */

export function thankYouDictionary(locale: EmailLocale): ThankYouDictionary {
  return THANK_YOU[locale] ?? EN;
}

export const THANK_YOU_LOCALES = Object.keys(THANK_YOU) as EmailLocale[];

export function renderThankYouEmail(params: {
  /** The member's saved language; anything unsupported falls back to English. */
  language: string | null | undefined;
  counts: SiteContentCounts;
  siteUrl: string;
}): RenderedEmail & { locale: EmailLocale } {
  const requested = resolveEmailLocale(params.language);
  // A language without its own letter goes out, and is labelled, as English:
  // never English text marked as another language for a screen reader.
  const locale: EmailLocale =
    requested !== "en" && thankYouDictionary(requested) === EN ? "en" : requested;
  const t = thankYouDictionary(locale);
  const n = (value: number) => formatEmailCount(value, locale);
  const siteUrl = params.siteUrl.replace(/\/+$/, "");

  const { htmlBody, textBody } = renderEmail({
    locale,
    title: t.subject,
    preheader: t.preheader,
    blocks: [
      { type: "heading", text: t.heading },
      { type: "paragraph", text: t.paragraph1 },
      { type: "paragraph", text: t.paragraph2 },
      { type: "paragraph", text: t.listIntro },
      { type: "list", items: [t.item1, t.item2, t.item3] },
      {
        type: "figures",
        rows: [
          { label: t.labelPrayers, value: n(params.counts.prayers) },
          { label: t.labelLitanies, value: n(params.counts.litanies) },
          { label: t.labelDevotions, value: n(params.counts.devotions) },
          { label: t.labelNovenas, value: n(params.counts.novenas) },
          { label: t.labelSaints, value: n(params.counts.saints) },
          { label: t.labelApparitions, value: n(params.counts.apparitions) },
          { label: t.labelMarianTitles, value: n(params.counts.marianTitles) },
          { label: t.labelDoctors, value: n(params.counts.doctors) },
          { label: t.labelPopes, value: n(params.counts.popes) },
          { label: t.labelParishes, value: n(params.counts.parishes) },
          { label: t.labelSpiritualLife, value: n(params.counts.spiritualLife) },
          { label: t.labelGuides, value: n(params.counts.guides) },
          { label: t.labelLiturgy, value: n(params.counts.liturgy) },
          { label: t.labelLiturgicalCalendar, value: t.valueComplete },
          { label: t.labelRites, value: n(params.counts.rites) },
          { label: t.labelHistory, value: n(params.counts.history) },
          { label: t.labelChurchDocuments, value: n(params.counts.churchDocuments) },
        ],
      },
      { type: "paragraph", text: t.closing },
      // The site's address on the line under the team's name, easy to share.
      {
        type: "signature",
        lines: [t.signoffBlessing, t.signoffTeam],
        link: { url: siteUrl, label: new URL(siteUrl).host },
      },
    ],
    footer: { copyright: copyrightNotice(locale) },
    siteUrl,
  });

  return { subject: t.subject, htmlBody, textBody, locale };
}
