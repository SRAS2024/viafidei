import type { Dict } from "./types";

const brand: Dict = {
  "brand.name": "Via Fidei",
  "brand.tagline": "The Way of Faith",
};

const nav: Dict = {
  "nav.home": "Home",
  "nav.prayers": "Prayers",
  "nav.devotions": "Devotions",
  "nav.spiritualLife": "Spiritual Life",
  "nav.spiritualGuidance": "Spiritual Guidance",
  "nav.liturgyHistory": "Liturgy & History",
  "nav.saints": "Saints & Our Lady",
  "nav.search": "Search",
  "nav.login": "Sign in",
  "nav.profile": "Profile",
  "nav.register": "Create account",
  "nav.logout": "Sign out",
  "nav.settings": "Settings",
};

const home: Dict = {
  "home.eyebrow": "Est. MMXXVI · Canonical",
  "home.title": "A quiet place to pray, to learn, and to return.",
  "home.lede":
    "Via Fidei is a multilingual Catholic companion — a curated library of prayers, saints, sacramental guidance, liturgical formation, and parish discovery, presented with reverence and clarity.",
  "home.ctaExplore": "Explore prayers",
  "home.ctaJoin": "Create your profile",
  "home.mission.title": "Our mission",
  "home.mission.body":
    "We make the beauty and precision of the Catholic tradition legible to both newcomers and lifelong faithful. Nothing noisy, nothing distracting — only what belongs on the page.",
  "home.catholic.title": "What is Catholicism?",
  "home.catholic.body":
    "The Catholic Church is the community of disciples gathered around Jesus Christ, guided by Scripture, Sacred Tradition, and the magisterial teaching entrusted to Peter and the apostles.",
  "home.quickLinks.title": "Begin here",
  "home.ql.sacraments": "The Seven Sacraments",
  "home.ql.ocia": "OCIA / RCIA",
  "home.ql.rosary": "Praying the Rosary",
  "home.ql.confession": "A guide to Confession",
  "home.ql.parish": "Find a parish",
  "home.featured.title": "Featured prayers",
  "home.newcomer.title": "New to the faith?",
  "home.newcomer.body":
    "A calm, step-by-step introduction to prayer, the sacraments, and the life of grace.",
};

const prayers: Dict = {
  "prayers.title": "Prayers",
  "prayers.subtitle":
    "A curated library of Catholic prayers — Marian, Christocentric, angelic, sacramental, seasonal, and daily devotions.",
  "prayers.category.marian": "Marian",
  "prayers.category.christ": "Christ-centered",
  "prayers.category.angelic": "Angelic",
  "prayers.category.sacramental": "Sacramental",
  "prayers.category.seasonal": "Seasonal",
  "prayers.category.daily": "Daily",
  "prayers.save": "Save to my prayers",
  "prayers.saved": "Saved",
  "prayers.print": "Print",
};

const spiritualLife: Dict = {
  "spiritualLife.title": "Spiritual Life",
  "spiritualLife.subtitle":
    "Formation pathways, guided devotions, and step-by-step checklists for growing in holiness.",
  "spiritualLife.rosary": "The Rosary",
  "spiritualLife.confession": "Confession",
  "spiritualLife.adoration": "Adoration",
  "spiritualLife.consecration": "Consecrations",
  "spiritualLife.vocations": "Vocations",
  "spiritualLife.addGoal": "Add as goal",
};

const devotions: Dict = {
  "devotions.title": "Devotions",
  "devotions.subtitle":
    "Traditional Catholic devotions — the Rosary, Divine Mercy, the Angelus, novenas, and more.",
};

const guidance: Dict = {
  "guidance.title": "Spiritual Guidance",
  "guidance.subtitle": "Find a parish, OCIA cohort, or local Catholic community near you.",
  "guidance.searchPlaceholder": "City, region, or postal code",
};

const liturgy: Dict = {
  "liturgy.title": "Liturgy & History",
  "liturgy.subtitle":
    "Formation through the structure, symbolism, and historical continuity of the Church.",
  "liturgy.massOrder": "Order of the Mass",
  "liturgy.year": "The Liturgical Year",
  "liturgy.rites": "Rites",
  "liturgy.councils": "Councils",
  "liturgy.symbols": "Symbol glossary",
};

const saints: Dict = {
  "saints.title": "Saints & Our Lady",
  "saints.subtitle":
    "Canonized saints, approved Marian apparitions, feast days, and patronage references.",
  "saints.feastDay": "Feast day",
  "saints.patronages": "Patronages",
  "saints.officialPrayer": "Official prayer",
};

const search: Dict = {
  "search.title": "Search",
  "search.subtitle": "One unified library — prayers, saints, liturgy, parishes, and more.",
  "search.placeholder": "Search prayers, saints, parishes…",
  "search.noResults": "Nothing matches yet.",
  "search.resultsCount": "{count} results for “{query}”.",
  "search.group.apparitions": "Marian apparitions",
  "search.group.parishes": "Parishes",
};

const auth: Dict = {
  "auth.signIn": "Sign in",
  "auth.signInSubtitle": "Return to your Via Fidei profile.",
  "auth.register": "Create an account",
  "auth.registerSubtitle": "A private, reverent place to grow in your faith.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.passwordConfirm": "Re-enter password",
  "auth.firstName": "First name",
  "auth.lastName": "Last name",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.forgot": "Forgot password?",
  "auth.submitLogin": "Sign in",
  "auth.submitRegister": "Create account",
  "auth.toRegister": "No account? Create one.",
  "auth.toLogin": "Already have an account? Sign in.",
  "auth.adminNotice":
    "This sign-in is for Via Fidei members only. Administrators must use the dedicated admin portal.",
  "auth.invalid": "Email or password is incorrect.",
  "auth.mismatch": "Passwords do not match.",
  "auth.weakPassword": "Password must be at least 12 characters.",
  "auth.signOut": "Sign out",
};

const profile: Dict = {
  "profile.title": "Profile",
  "profile.tab.prayers": "My Prayers",
  "profile.tab.saints": "Saints & Our Lady",
  "profile.tab.apparitions": "Apparitions",
  "profile.tab.devotions": "Devotions",
  "profile.tab.parishes": "Parishes",
  "profile.tab.journal": "Journal",
  "profile.tab.milestones": "Milestones",
  "profile.tab.goals": "My Goals",
  "profile.tab.settings": "Settings",
  "profile.journal.newEntry": "New entry",
  "profile.journal.title": "Title",
  "profile.journal.body": "Body",
  "profile.journal.save": "Save",
  "profile.journal.cancel": "Cancel",
  "profile.journal.favorite": "Favorite",
  "profile.journal.delete": "Delete",
  "profile.journal.deleteConfirm": "Delete this entry? This cannot be undone.",
  "profile.journal.deleteTitle": "Delete entry",
  "profile.journal.deleteBody": "Delete “{name}”? This cannot be undone.",
  "profile.avatar.editTooltip": "Change photo",
  "profile.milestones.sacraments": "Sacraments",
  "profile.milestones.spiritual": "Spiritual milestones",
  "profile.milestones.personal": "Personal milestones",
  "profile.goals.new": "New goal",
  "profile.settings.language": "Language override",
  "profile.settings.languageHint": "By default, Via Fidei follows your device language.",
  "profile.settings.theme": "Theme",
  "profile.settings.privacy": "Privacy",
};

const admin: Dict = {
  "admin.brand": "Via Fidei · Admin",
  "admin.loading.greeting": "Welcome!",
  "admin.login.title": "Administrator sign-in",
  "admin.login.subtitle":
    "This portal is for authorized Via Fidei administrators only. All actions are audited.",
  "admin.login.username": "Administrator username",
  "admin.login.password": "Administrator password",
  "admin.login.submit": "Enter admin",
  "admin.login.invalid": "Those credentials do not match.",
  "admin.login.userRedirect": "Looking for the member sign-in? Go to the standard site.",
  "admin.dashboard.title": "Administrator dashboard",
  "admin.dashboard.subtitle":
    "Manage content, translations, ingestion, media, and the live homepage.",
  "admin.card.prayers": "Prayers",
  "admin.card.saints": "Saints",
  "admin.card.apparitions": "Marian apparitions",
  "admin.card.parishes": "Parishes",
  "admin.card.devotions": "Devotions",
  "admin.card.liturgy": "Liturgy content",
  "admin.card.translations": "Translations",
  "admin.card.ingestion": "Ingestion jobs",
  "admin.card.search": "Search index",
  "admin.card.audit": "Audit log",
  "admin.card.media": "Media library",
  "admin.card.homepage": "Homepage mirror editor",
  "admin.card.favicon": "Favicon",
  "admin.signOut": "Sign out of admin",
  "admin.welcomeLine": "You are signed in as the administrator.",
};

const footer: Dict = {
  "footer.copy": "Via Fidei — a reverent, private Catholic companion.",
  "footer.canonical": "viafidei.com",
};

const common: Dict = {
  "common.loading": "Loading",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.continue": "Continue",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.back": "Back",
  "common.languageAuto": "Automatic (device language)",
};

export const en: Dict = {
  ...brand,
  ...nav,
  ...home,
  ...prayers,
  ...devotions,
  ...spiritualLife,
  ...guidance,
  ...liturgy,
  ...saints,
  ...search,
  ...auth,
  ...profile,
  ...admin,
  ...footer,
  ...common,
};
