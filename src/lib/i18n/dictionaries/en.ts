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
  "nav.menu.open": "Open menu",
  "nav.menu.close": "Close menu",
  "nav.appearance": "Appearance",
  "nav.appearance.light": "Light mode",
  "nav.appearance.dark": "Dark mode",
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
  "search.resultsCount": '{count} results for "{query}".',
  "search.group.apparitions": "Marian apparitions",
  "search.group.parishes": "Parishes",
  "search.group.devotions": "Devotions",
  "search.group.liturgy": "Liturgy & History",
  "search.group.spiritualLife": "Spiritual Life",
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
  "auth.weakPassword":
    "Password must be at least 5 characters and include at least one number and one capital letter.",
  "auth.passwordRequirements":
    "Use at least 5 characters, with at least one number and one capital letter.",
  "auth.signOut": "Sign out",
  "auth.forgot.title": "Forgot password",
  "auth.forgot.subtitle":
    "Enter your email and we'll send a link to reset your password if an account exists.",
  "auth.forgot.submit": "Send reset link",
  "auth.forgot.success":
    "If that email matches an account, a password reset link has been sent. Check your inbox.",
  "auth.forgot.rateLimited": "Too many requests. Please wait a moment and try again.",
  "auth.forgot.error": "Something went wrong. Please try again.",
  "auth.forgot.backToLogin": "Back to sign in",
  "auth.reset.title": "Reset password",
  "auth.reset.subtitle": "Choose a new password for your account.",
  "auth.reset.newPassword": "New password",
  "auth.reset.confirmPassword": "Confirm new password",
  "auth.reset.submit": "Reset password",
  "auth.reset.missingToken": "This reset link is missing a token. Request a new one.",
  "auth.reset.invalidToken": "This reset link is invalid. Request a new one.",
  "auth.reset.expiredToken": "This reset link has expired. Request a new one.",
  "auth.reset.usedToken": "This reset link has already been used. Request a new one.",
  "auth.reset.success": "Your password was reset successfully. You can now sign in.",
  "auth.login.passwordReset": "Your password was reset successfully. Please sign in.",
  "auth.verify.title": "Verify email",
  "auth.verify.checking": "Verifying your email…",
  "auth.verify.success": "Your email is verified. Thank you!",
  "auth.verify.missingToken": "This verification link is missing a token.",
  "auth.verify.invalidToken": "This verification link is invalid.",
  "auth.verify.expiredToken":
    "This verification link has expired. Request a new one from your profile.",
  "auth.verify.usedToken": "This verification link has already been used.",
  "auth.verify.unverifiedNotice":
    "Your email is not yet verified. Check your inbox for a verification link.",
  "auth.verify.resend": "Resend verification email",
  "auth.verify.resendSent": "Verification email sent. Check your inbox.",
  "auth.verify.resendRateLimited": "Please wait before requesting another verification email.",
  "auth.verify.resendError": "Could not send the verification email. Please try again later.",
  "auth.verify.alreadyVerified": "Your email is already verified.",
  "auth.privacyNotice.before": "By selecting create account, you agree to our ",
  "auth.privacyNotice.linkText": "privacy policy",
  "auth.privacyNotice.after": ".",
  "auth.success.created": "Account created. Welcome!",
  "auth.success.passwordReset": "Password updated. You can now sign in.",
  "auth.success.verified": "Your email is verified. Thank you!",
  "auth.error.rateLimited": "Too many requests. Please wait a moment and try again.",
  "auth.error.exists": "An account already exists for that email.",
  "auth.error.generic": "Something went wrong. Please try again.",
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
  "profile.tab.favorites": "Favorites",
  "profile.tab.savedPrayers": "Saved prayers",
  "profile.tab.savedLiturgy": "Saved liturgical content",
  "profile.tab.savedLearning": "Saved Catholic learning guides",
  "profile.section.goals": "Goals",
  "profile.section.journals": "Journals",
  "profile.section.favorites": "Favorites",
  "profile.section.savedPrayers": "Saved prayers",
  "profile.section.savedLiturgy": "Saved liturgical content",
  "profile.section.savedLearning": "Saved Catholic learning guides",
  "profile.journal.newEntry": "New entry",
  "profile.journal.editEntry": "Edit entry",
  "profile.journal.title": "Title",
  "profile.journal.body": "Body",
  "profile.journal.save": "Save",
  "profile.journal.cancel": "Cancel",
  "profile.journal.favorite": "Favorite",
  "profile.journal.unfavorite": "Unfavorite",
  "profile.journal.edit": "Edit",
  "profile.journal.delete": "Delete",
  "profile.journal.deleteConfirm": "Delete this entry? This cannot be undone.",
  "profile.journal.deleteTitle": "Delete entry",
  "profile.journal.deleteBody": 'Delete "{name}"? This cannot be undone.',
  "profile.avatar.editTooltip": "Change photo",
  "profile.milestones.sacraments": "Sacraments",
  "profile.milestones.spiritual": "Spiritual milestones",
  "profile.milestones.personal": "Personal milestones",
  "profile.milestones.record": "Record milestone",
  "profile.milestones.delete": "Remove",
  "profile.milestones.deleteTitle": "Remove milestone",
  "profile.milestones.deleteBody": 'Remove "{name}" from your milestones?',
  "profile.milestones.alreadyRecorded": "Already recorded",
  "profile.milestones.addCustom": "Add personal milestone",
  "profile.milestones.customTitle": "Title",
  "profile.milestones.customDesc": "Description (optional)",
  "profile.goals.new": "New goal",
  "profile.goals.title": "Title",
  "profile.goals.edit": "Edit",
  "profile.goals.delete": "Delete",
  "profile.goals.complete": "Mark complete",
  "profile.goals.archive": "Archive",
  "profile.goals.addChecklist": "Add step",
  "profile.goals.dueDate": "Due date (optional)",
  "profile.goals.description": "Description (optional)",
  "profile.goals.deleteTitle": "Delete goal",
  "profile.goals.deleteBody": 'Delete "{name}"? This cannot be undone.',
  "profile.goals.checklist": "Checklist",
  "profile.saved.remove": "Remove",
  "profile.saved.removeTitle": "Remove saved item",
  "profile.saved.removeBody": 'Remove "{name}" from your saved items?',
  "profile.settings.language": "Language override",
  "profile.settings.languageHint": "By default, Via Fidei follows your device language.",
  "profile.settings.theme": "Theme",
  "profile.settings.themeLight": "Light",
  "profile.settings.themeDark": "Dark",
  "profile.settings.themeSystem": "System default",
  "profile.settings.privacy": "Privacy",
  "profile.settings.section.profile": "Profile",
  "profile.settings.section.language": "Language",
  "profile.settings.section.appearance": "Appearance",
  "profile.settings.section.profile.body":
    "Update your personal details, photo, and how others see you on Via Fidei.",
  "profile.settings.section.appearance.body":
    "Choose how Via Fidei appears for you on this device.",
  "profile.settings.openProfile": "Open profile page",
  "profile.settings.signedInOnly": "Settings are only available to signed-in members.",
  "profile.settings.appearance.light": "Light mode",
  "profile.settings.appearance.dark": "Dark mode",
};

const rite: Dict = {
  "rite.label": "Catholic Rite",
  "rite.help":
    "Choose the rite you'd like content displayed for. Pages where rite makes no difference will look the same regardless.",
  "rite.roman": "Roman (Latin)",
  "rite.byzantine": "Byzantine",
  "rite.maronite": "Maronite",
  "rite.chaldean": "Chaldean",
  "rite.coptic": "Coptic",
  "rite.syroMalabar": "Syro-Malabar",
  "rite.syroMalankara": "Syro-Malankara",
  "rite.armenian": "Armenian",
  "rite.ethiopic": "Ethiopic / Ge'ez",
  "rite.melkite": "Melkite",
  "rite.ukrainian": "Ukrainian Greek",
  "rite.ruthenian": "Ruthenian",
};

const admin: Dict = {
  "admin.brand": "Via Fidei · Admin",
  "admin.create": "Create new",
  "admin.edit": "Edit",
  "admin.publish": "Publish",
  "admin.archive": "Archive",
  "admin.reject": "Reject",
  "admin.delete": "Delete",
  "admin.deleteTitle": "Delete item",
  "admin.deleteBody": 'Delete "{name}"? This cannot be undone.',
  "admin.status": "Status",
  "admin.updated": "Updated",
  "admin.actions": "Actions",
  "admin.noItems": "No items yet.",
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
  "admin.card.sources": "Approved sources",
  "admin.card.search": "Search index",
  "admin.card.audit": "Audit log",
  "admin.card.media": "Media library",
  "admin.card.homepage": "Homepage mirror editor",
  "admin.card.favicon": "Favicon",
  "admin.card.users": "User Accounts",
  "admin.signOut": "Sign out of admin",
  "admin.welcomeLine": "You are signed in as the administrator.",
};

const footer: Dict = {
  "footer.copy": "Via Fidei — a reverent, private Catholic companion.",
  "footer.canonical": "etviafidei.com",
  "footer.copyright": "© 2025 Via Fidei. All rights reserved.",
  "footer.privacy": "Privacy policy",
};

const privacy: Dict = {
  "privacy.title": "Privacy policy",
  "privacy.subtitle": "How Via Fidei handles the information you entrust to us.",
  "privacy.intro":
    "Via Fidei is a reverent, private Catholic companion. We treat your information with respect and only collect what we genuinely need to operate the service. This page is written in plain language and is not a legal document.",
  "privacy.notSold.title": "We do not sell your information",
  "privacy.notSold.body":
    "Via Fidei does not sell user information. We do not rent or trade your personal data with advertisers or marketers.",
  "privacy.notShared.title": "We do not intentionally share your data",
  "privacy.notShared.body":
    "We do not intentionally share user data except where it is needed to operate the service, comply with the law, protect Via Fidei and its users, or provide functionality you specifically request.",
  "privacy.collect.title": "What we collect",
  "privacy.collect.body":
    "Via Fidei may collect basic account information including your name, email address, language preference, account creation date, and content you create within the app where applicable.",
  "privacy.email.title": "Account-related emails",
  "privacy.email.body":
    "Via Fidei may send account-related emails for registration, welcome messages, password reset, email verification, security, and other service purposes.",
  "privacy.processors.title": "Third-party providers",
  "privacy.processors.body":
    "Third-party infrastructure providers may process your data as needed for hosting, database storage, email delivery, security, and service operation. We work with vendors that take privacy and security seriously.",
  "privacy.contact.title": "Contact",
  "privacy.contact.body":
    "Questions about this privacy policy can be sent to notifications@viafidei.com.",
  "privacy.security.title": "A note on security",
  "privacy.security.body":
    "We follow common-sense security practices and continually improve them, but no online service can promise absolute security. We will not make promises we cannot keep.",
};

const common: Dict = {
  "common.loading": "Loading",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.continue": "Continue",
  "common.delete": "Delete",
  "common.remove": "Remove",
  "common.edit": "Edit",
  "common.back": "Back",
  "common.create": "Create",
  "common.confirm": "Confirm",
  "common.close": "Close",
  "common.notFound": "Not found",
  "common.notFoundBody": "This page doesn't exist or has been removed.",
  "common.backToList": "Back to list",
  "common.saveItem": "Save",
  "common.savedItem": "Saved",
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
  ...rite,
  ...admin,
  ...footer,
  ...privacy,
  ...common,
};
