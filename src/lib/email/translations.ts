import { isSupportedLocale, type Locale } from "@/lib/i18n/locales";

export type EmailLocale = Locale;

type EmailDictionary = {
  shared_footerLine: string;
  shared_siteLabel: string;
  welcome_subject: string;
  welcome_heading: string;
  welcome_intro: string;
  // Required wording: "Welcome, {name}. Account creation successful."
  welcome_required: string;
  welcome_cta: string;
  welcome_fineprint: string;
  reset_subject: string;
  reset_heading: string;
  reset_intro: string;
  reset_body: string;
  // CTA must read: "Reset password for {name}".
  reset_cta: string;
  reset_fineprint: string;
  verify_subject: string;
  verify_heading: string;
  verify_intro: string;
  verify_body: string;
  verify_cta: string;
  verify_fineprint: string;
};

const EN: EmailDictionary = {
  shared_footerLine: "Via Fidei — a reverent, private Catholic companion.",
  shared_siteLabel: "Visit Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Welcome to Via Fidei",
  welcome_intro: "We are glad to walk this path of faith with you.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Open Via Fidei",
  welcome_fineprint:
    "If you did not create this account, you can ignore this email and the address will remain unused.",
  reset_subject: "Password Reset",
  reset_heading: "Reset your Via Fidei password",
  reset_intro: "We received a request to reset your password.",
  reset_body: "Use the secure link below to choose a new password.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "This single-use link expires at {expiresAt}. If you did not request a reset, you can ignore this email.",
  verify_subject: "Verify your Via Fidei email",
  verify_heading: "Verify your Via Fidei email",
  verify_intro:
    "Hello {name}, please confirm your email address to finish setting up your account.",
  verify_body: "Use the secure link below to verify your email.",
  verify_cta: "Verify my email",
  verify_fineprint:
    "This link expires at {expiresAt}. If you did not create an account, you can ignore this email.",
};

const ES: EmailDictionary = {
  shared_footerLine: "Via Fidei — un acompañante católico reverente y privado.",
  shared_siteLabel: "Visitar Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Bienvenido a Via Fidei",
  welcome_intro: "Nos alegra acompañarte en este camino de la fe.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Abrir Via Fidei",
  welcome_fineprint:
    "Si no creaste esta cuenta, puedes ignorar este correo y la dirección permanecerá sin uso.",
  reset_subject: "Password Reset",
  reset_heading: "Restablecer tu contraseña de Via Fidei",
  reset_intro: "Recibimos una solicitud para restablecer tu contraseña.",
  reset_body: "Usa el enlace seguro a continuación para elegir una nueva contraseña.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Este enlace de un solo uso expira el {expiresAt}. Si no solicitaste un restablecimiento, puedes ignorar este correo.",
  verify_subject: "Verifica tu correo de Via Fidei",
  verify_heading: "Verifica tu correo",
  verify_intro: "Hola {name}, confirma tu dirección de correo para terminar de crear tu cuenta.",
  verify_body: "Usa el enlace seguro a continuación para verificar tu correo.",
  verify_cta: "Verificar mi correo",
  verify_fineprint:
    "Este enlace expira el {expiresAt}. Si no creaste una cuenta, puedes ignorar este correo.",
};

const FR: EmailDictionary = {
  shared_footerLine: "Via Fidei — un compagnon catholique discret et révérent.",
  shared_siteLabel: "Visiter Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Bienvenue sur Via Fidei",
  welcome_intro: "Nous sommes heureux de cheminer avec vous dans la foi.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Ouvrir Via Fidei",
  welcome_fineprint:
    "Si vous n'avez pas créé ce compte, vous pouvez ignorer cet e-mail et l'adresse ne sera pas utilisée.",
  reset_subject: "Password Reset",
  reset_heading: "Réinitialisez votre mot de passe Via Fidei",
  reset_intro: "Nous avons reçu une demande de réinitialisation de votre mot de passe.",
  reset_body: "Utilisez le lien sécurisé ci-dessous pour choisir un nouveau mot de passe.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Ce lien à usage unique expire le {expiresAt}. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail.",
  verify_subject: "Vérifiez votre e-mail Via Fidei",
  verify_heading: "Vérifiez votre e-mail",
  verify_intro:
    "Bonjour {name}, veuillez confirmer votre adresse e-mail pour finaliser votre compte.",
  verify_body: "Utilisez le lien sécurisé ci-dessous pour vérifier votre e-mail.",
  verify_cta: "Vérifier mon e-mail",
  verify_fineprint:
    "Ce lien expire le {expiresAt}. Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.",
};

const IT: EmailDictionary = {
  shared_footerLine: "Via Fidei — un compagno cattolico riservato e devoto.",
  shared_siteLabel: "Visita Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Benvenuto in Via Fidei",
  welcome_intro: "Siamo lieti di camminare con te in questa via della fede.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Apri Via Fidei",
  welcome_fineprint:
    "Se non hai creato questo account, puoi ignorare questa email e l'indirizzo non verrà usato.",
  reset_subject: "Password Reset",
  reset_heading: "Reimposta la password di Via Fidei",
  reset_intro: "Abbiamo ricevuto una richiesta di reimpostazione della tua password.",
  reset_body: "Usa il link sicuro qui sotto per scegliere una nuova password.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Questo link monouso scade il {expiresAt}. Se non hai richiesto la reimpostazione, puoi ignorare questa email.",
  verify_subject: "Verifica la tua email Via Fidei",
  verify_heading: "Verifica la tua email",
  verify_intro: "Ciao {name}, conferma il tuo indirizzo email per completare l'account.",
  verify_body: "Usa il link sicuro qui sotto per verificare la tua email.",
  verify_cta: "Verifica la mia email",
  verify_fineprint:
    "Questo link scade il {expiresAt}. Se non hai creato un account, puoi ignorare questa email.",
};

const DE: EmailDictionary = {
  shared_footerLine: "Via Fidei — ein stiller, ehrfürchtiger katholischer Begleiter.",
  shared_siteLabel: "Via Fidei besuchen",
  welcome_subject: "Welcome!",
  welcome_heading: "Willkommen bei Via Fidei",
  welcome_intro: "Wir freuen uns, diesen Weg des Glaubens mit dir zu gehen.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Via Fidei öffnen",
  welcome_fineprint:
    "Falls du dieses Konto nicht erstellt hast, kannst du diese E-Mail ignorieren — die Adresse bleibt ungenutzt.",
  reset_subject: "Password Reset",
  reset_heading: "Setze dein Via-Fidei-Passwort zurück",
  reset_intro: "Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten.",
  reset_body: "Verwende den sicheren Link unten, um ein neues Passwort zu wählen.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Dieser einmal verwendbare Link läuft am {expiresAt} ab. Wenn du kein Zurücksetzen angefordert hast, kannst du diese E-Mail ignorieren.",
  verify_subject: "Bestätige deine Via-Fidei-E-Mail",
  verify_heading: "E-Mail bestätigen",
  verify_intro:
    "Hallo {name}, bitte bestätige deine E-Mail-Adresse, um dein Konto fertigzustellen.",
  verify_body: "Verwende den sicheren Link unten, um deine E-Mail zu bestätigen.",
  verify_cta: "E-Mail bestätigen",
  verify_fineprint:
    "Dieser Link läuft am {expiresAt} ab. Falls du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.",
};

const PT: EmailDictionary = {
  shared_footerLine: "Via Fidei — um companheiro católico reverente e discreto.",
  shared_siteLabel: "Visitar Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Bem-vindo ao Via Fidei",
  welcome_intro: "Estamos felizes por caminhar contigo nesta via da fé.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Abrir Via Fidei",
  welcome_fineprint:
    "Se não criou esta conta, pode ignorar este e-mail e o endereço permanecerá sem uso.",
  reset_subject: "Password Reset",
  reset_heading: "Redefina sua senha do Via Fidei",
  reset_intro: "Recebemos um pedido para redefinir sua senha.",
  reset_body: "Use o link seguro abaixo para escolher uma nova senha.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Este link de uso único expira em {expiresAt}. Se não solicitou a redefinição, pode ignorar este e-mail.",
  verify_subject: "Verifique seu e-mail do Via Fidei",
  verify_heading: "Verifique seu e-mail",
  verify_intro: "Olá {name}, confirme seu endereço de e-mail para concluir sua conta.",
  verify_body: "Use o link seguro abaixo para verificar seu e-mail.",
  verify_cta: "Verificar meu e-mail",
  verify_fineprint:
    "Este link expira em {expiresAt}. Se não criou uma conta, pode ignorar este e-mail.",
};

const PL: EmailDictionary = {
  shared_footerLine: "Via Fidei — pełen czci, dyskretny katolicki towarzysz.",
  shared_siteLabel: "Odwiedź Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Witaj w Via Fidei",
  welcome_intro: "Cieszymy się, że możemy iść z tobą tą drogą wiary.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Otwórz Via Fidei",
  welcome_fineprint:
    "Jeśli nie zakładałeś tego konta, możesz zignorować tę wiadomość — adres pozostanie nieużywany.",
  reset_subject: "Password Reset",
  reset_heading: "Zresetuj hasło Via Fidei",
  reset_intro: "Otrzymaliśmy prośbę o zresetowanie twojego hasła.",
  reset_body: "Skorzystaj z bezpiecznego linku poniżej, aby wybrać nowe hasło.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Ten jednorazowy link wygasa {expiresAt}. Jeśli nie prosiłeś o reset, możesz zignorować tę wiadomość.",
  verify_subject: "Zweryfikuj e-mail Via Fidei",
  verify_heading: "Zweryfikuj e-mail",
  verify_intro: "Cześć {name}, potwierdź swój adres e-mail, aby zakończyć konfigurację konta.",
  verify_body: "Skorzystaj z bezpiecznego linku poniżej, aby zweryfikować e-mail.",
  verify_cta: "Zweryfikuj mój e-mail",
  verify_fineprint:
    "Ten link wygasa {expiresAt}. Jeśli nie zakładałeś konta, możesz zignorować tę wiadomość.",
};

const LA: EmailDictionary = {
  shared_footerLine: "Via Fidei — comes catholicus reverens et privatus.",
  shared_siteLabel: "Adi Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Salve in Via Fidei",
  welcome_intro: "Gaudemus tecum hac via fidei ambulare.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Aperi Via Fidei",
  welcome_fineprint:
    "Si tu hanc rationem non condidisti, hanc epistulam neglegere potes; inscriptio inusitata manebit.",
  reset_subject: "Password Reset",
  reset_heading: "Tesseram tuam Via Fidei restitue",
  reset_intro: "Petitionem accepimus ut tessera tua restituatur.",
  reset_body: "Tutus nexus infra novum tesseram eligere permittit.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Hic nexus semel tantum valens ad {expiresAt} expirat. Si non petisti, neglegere potes.",
  verify_subject: "Inscriptionem electronicam Via Fidei confirma",
  verify_heading: "Inscriptionem confirma",
  verify_intro: "Salve {name}, inscriptionem tuam confirma ut rationem perficias.",
  verify_body: "Utere tuto nexu infra ad inscriptionem confirmandam.",
  verify_cta: "Inscriptionem confirma",
  verify_fineprint:
    "Hic nexus ad {expiresAt} expirat. Si rationem non condidisti, neglegere potes.",
};

const TL: EmailDictionary = {
  shared_footerLine: "Via Fidei — isang taimtim at pribadong Katolikong kasama.",
  shared_siteLabel: "Bisitahin ang Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Maligayang pagdating sa Via Fidei",
  welcome_intro: "Masaya kaming makasama ka sa landas ng pananampalataya.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Buksan ang Via Fidei",
  welcome_fineprint:
    "Kung hindi mo ginawa ang account na ito, maaari mong balewalain ang email na ito.",
  reset_subject: "Password Reset",
  reset_heading: "I-reset ang iyong password sa Via Fidei",
  reset_intro: "Nakatanggap kami ng kahilingan na i-reset ang iyong password.",
  reset_body: "Gamitin ang ligtas na link sa ibaba upang pumili ng bagong password.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Ang single-use na link na ito ay magtatapos sa {expiresAt}. Kung hindi ka humiling ng reset, balewalain ang email.",
  verify_subject: "I-verify ang iyong email sa Via Fidei",
  verify_heading: "I-verify ang iyong email",
  verify_intro: "Kumusta {name}, kumpirmahin ang iyong email upang matapos ang account mo.",
  verify_body: "Gamitin ang ligtas na link sa ibaba upang i-verify ang iyong email.",
  verify_cta: "I-verify ang aking email",
  verify_fineprint:
    "Ang link na ito ay magtatapos sa {expiresAt}. Kung hindi ka gumawa ng account, balewalain ang email.",
};

const VI: EmailDictionary = {
  shared_footerLine: "Via Fidei — người bạn đồng hành Công giáo trang nghiêm và riêng tư.",
  shared_siteLabel: "Truy cập Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "Chào mừng đến với Via Fidei",
  welcome_intro: "Chúng tôi vui mừng được đồng hành cùng bạn trên hành trình đức tin.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Mở Via Fidei",
  welcome_fineprint:
    "Nếu bạn không tạo tài khoản này, bạn có thể bỏ qua email này và địa chỉ sẽ không được sử dụng.",
  reset_subject: "Password Reset",
  reset_heading: "Đặt lại mật khẩu Via Fidei",
  reset_intro: "Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu của bạn.",
  reset_body: "Dùng liên kết an toàn bên dưới để chọn mật khẩu mới.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "Liên kết một lần này hết hạn lúc {expiresAt}. Nếu bạn không yêu cầu đặt lại, có thể bỏ qua email.",
  verify_subject: "Xác minh email Via Fidei",
  verify_heading: "Xác minh email",
  verify_intro: "Chào {name}, vui lòng xác nhận địa chỉ email để hoàn tất tài khoản.",
  verify_body: "Dùng liên kết an toàn bên dưới để xác minh email.",
  verify_cta: "Xác minh email của tôi",
  verify_fineprint:
    "Liên kết hết hạn lúc {expiresAt}. Nếu bạn không tạo tài khoản, có thể bỏ qua email.",
};

const KO: EmailDictionary = {
  shared_footerLine: "Via Fidei — 경건하고 개인적인 가톨릭 동반자.",
  shared_siteLabel: "Via Fidei 방문",
  welcome_subject: "Welcome!",
  welcome_heading: "Via Fidei에 오신 것을 환영합니다",
  welcome_intro: "신앙의 길에서 함께하게 되어 기쁩니다.",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "Via Fidei 열기",
  welcome_fineprint: "이 계정을 만들지 않으셨다면 이 이메일을 무시하셔도 됩니다.",
  reset_subject: "Password Reset",
  reset_heading: "Via Fidei 비밀번호 재설정",
  reset_intro: "비밀번호 재설정 요청을 받았습니다.",
  reset_body: "아래의 안전한 링크로 새 비밀번호를 선택하세요.",
  reset_cta: "Reset password for {name}",
  reset_fineprint:
    "이 일회용 링크는 {expiresAt}에 만료됩니다. 요청하지 않으셨다면 이 이메일을 무시하세요.",
  verify_subject: "Via Fidei 이메일 인증",
  verify_heading: "이메일 인증",
  verify_intro: "{name}님, 계정을 마무리하려면 이메일 주소를 확인해 주세요.",
  verify_body: "아래의 안전한 링크로 이메일을 인증하세요.",
  verify_cta: "내 이메일 인증",
  verify_fineprint:
    "이 링크는 {expiresAt}에 만료됩니다. 계정을 만들지 않으셨다면 이 이메일을 무시하세요.",
};

const ZH: EmailDictionary = {
  shared_footerLine: "Via Fidei — 一位虔敬而私密的天主教同伴。",
  shared_siteLabel: "访问 Via Fidei",
  welcome_subject: "Welcome!",
  welcome_heading: "欢迎来到 Via Fidei",
  welcome_intro: "我们很高兴与您一同踏上这条信仰之路。",
  welcome_required: "Welcome, {name}. Account creation successful.",
  welcome_cta: "打开 Via Fidei",
  welcome_fineprint: "如果不是您创建的账户,可以忽略此邮件,该地址将保持未使用。",
  reset_subject: "Password Reset",
  reset_heading: "重置您的 Via Fidei 密码",
  reset_intro: "我们收到了重置您密码的请求。",
  reset_body: "使用下面的安全链接选择新密码。",
  reset_cta: "Reset password for {name}",
  reset_fineprint: "此一次性链接于 {expiresAt} 过期。如果不是您发起的请求,可忽略此邮件。",
  verify_subject: "验证您的 Via Fidei 邮箱",
  verify_heading: "验证邮箱",
  verify_intro: "{name},您好,请确认您的电子邮箱地址以完成账户设置。",
  verify_body: "使用下面的安全链接来验证您的邮箱。",
  verify_cta: "验证我的邮箱",
  verify_fineprint: "此链接于 {expiresAt} 过期。如果不是您创建的账户,可忽略此邮件。",
};

const DICT: Record<EmailLocale, EmailDictionary> = {
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

export function resolveEmailLocale(input: string | null | undefined): EmailLocale {
  return isSupportedLocale(input) ? input : "en";
}

export function translateEmail(locale: EmailLocale): EmailDictionary {
  return DICT[locale] ?? DICT.en;
}
