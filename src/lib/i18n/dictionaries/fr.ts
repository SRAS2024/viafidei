import type { Dict } from "./types";
import { en } from "./en";

export const fr: Dict = {
  ...en,
  "brand.tagline": "La Voie de la Foi",
  "nav.home": "Accueil",
  "nav.prayers": "Prières",
  "nav.spiritualLife": "Vie spirituelle",
  "nav.spiritualGuidance": "Notre-Dame",
  "nav.liturgyHistory": "Liturgie & Histoire",
  "nav.saints": "Saints & Notre-Dame",
  "nav.search": "Recherche",
  "nav.login": "Connexion",
  "nav.profile": "Profil",
  "nav.register": "Créer un compte",
  "nav.logout": "Se déconnecter",
  "nav.settings": "Paramètres",
  "home.title": "Un lieu paisible pour prier, apprendre, revenir.",
  "home.ctaExplore": "Explorer les prières",
  "home.ctaJoin": "Créer un profil",
  "home.featured.section": "Sélection",
  "home.featured.saints": "Saints",
  "home.featured.devotions": "Dévotions",
  "home.featured.novenas": "Neuvaines",
  "auth.signIn": "Connexion",
  "auth.register": "Créer un compte",
  "auth.email": "Courriel",
  "auth.password": "Mot de passe",
  "auth.passwordConfirm": "Confirmer le mot de passe",
  "auth.firstName": "Prénom",
  "auth.lastName": "Nom",
  "auth.invalid": "Courriel ou mot de passe incorrect.",
  "auth.adminNotice":
    "Cette connexion est réservée aux membres. Les administrateurs doivent utiliser le portail dédié.",
  "parishes.distanceAway": "À {distance}",
  "parishes.locate.button": "Utiliser ma position",
  "parishes.locate.locating": "Recherche des paroisses près de vous…",
  "parishes.locate.tryAgain": "Réessayer",
  "parishes.locate.howTo": "Comment activer la localisation",
  "parishes.locate.blocked":
    "Votre navigateur bloque la localisation pour ce site ; il ne peut donc pas vous la demander. Autorisez-la, puis réessayez.",
  "parishes.locate.notShared":
    "Votre appareil n'a pas partagé sa position. Si la question ne vous a pas été posée, la localisation est probablement désactivée pour votre navigateur.",
  "parishes.locate.timeout":
    "Votre appareil a mis trop de temps à trouver votre position. Vérifiez que le service de localisation est activé, puis réessayez.",
  "parishes.locate.unavailable":
    "Votre appareil n'a pas pu déterminer votre position pour le moment. Vérifiez que le service de localisation est activé, puis réessayez.",
  "parishes.locate.unsupported":
    "Ce navigateur ne peut pas partager votre position. Vous pouvez toujours parcourir l'annuaire ci-dessous.",
  "parishes.locate.insecure":
    "La localisation ne fonctionne qu'avec une connexion sécurisée. Ouvrez cette page en https, puis réessayez.",
  "parishes.locate.lookupFailed":
    "Nous n'avons pas pu charger les paroisses près de vous. L'annuaire ci-dessous fonctionne toujours.",
  "parishes.locate.steps.iosSafariSettings":
    "Ouvrez Réglages › Confidentialité et sécurité › Service de localisation, vérifiez qu'il est activé, touchez « Sites web Safari » et choisissez « Lorsque l'app est active ».",
  "parishes.locate.steps.iosSafariSite":
    "Dans Safari, touchez « aA » dans la barre d'adresse › Réglages du site web › Position, puis choisissez « Demander » ou « Autoriser ».",
  "parishes.locate.steps.iosOtherSettings":
    "Ouvrez Réglages › Confidentialité et sécurité › Service de localisation, vérifiez qu'il est activé, touchez le navigateur ou l'app que vous utilisez et choisissez « Lorsque l'app est active ».",
  "parishes.locate.steps.androidSite":
    "Touchez l'icône à gauche de l'adresse web › Autorisations › Position, puis choisissez « Autoriser ».",
  "parishes.locate.steps.androidDevice":
    "Vérifiez que la localisation est activée dans les réglages rapides de votre téléphone.",
  "parishes.locate.steps.macSafariSite":
    "Dans Safari, ouvrez Safari › Réglages › Sites web › Position, puis choisissez « Demander » ou « Autoriser » pour ce site.",
  "parishes.locate.steps.desktopSite":
    "Cliquez sur l'icône de localisation ou de cadenas dans la barre d'adresse et autorisez la localisation pour ce site.",
  "parishes.locate.steps.desktopDevice":
    "Si la localisation est désactivée sur votre ordinateur, activez-la dans ses paramètres de confidentialité (sur Mac : Réglages Système › Confidentialité et sécurité › Service de localisation).",
  "common.open": "Ouvrir",
  "common.skipToContent": "Aller au contenu",
  "listSearch.submit": "Rechercher",
  "listSearch.clear": "Effacer la recherche",
  "listSearch.results.one": "{count} résultat pour « {query} »",
  "listSearch.results.many": "{count} de résultats pour « {query} »",
  "listSearch.results.other": "{count} résultats pour « {query} »",
  "listSearch.none": "Rien ici ne correspond à « {query} ».",
  "listSearch.noneHint": "Essayez avec moins de mots ou une autre orthographe.",
  "listSearch.prayers": "Rechercher une prière",
  "listSearch.litanies": "Rechercher une litanie",
  "listSearch.saints": "Rechercher un saint",
  "listSearch.ourLady": "Rechercher vocables et apparitions",
  "listSearch.doctors": "Rechercher un docteur de l'Église",
  "listSearch.popes": "Rechercher un pape",
  "listSearch.parishes": "Rechercher par nom, ville ou code postal",
  "listSearch.parishesPlaceholder": "Nom, ville ou code postal",
  "listSearch.spiritualLife": "Rechercher une pratique spirituelle",
  "listSearch.guides": "Rechercher un guide",
  "listSearch.liturgy": "Rechercher dans la liturgie",
  "listSearch.rites": "Rechercher un rite",
  "listSearch.churchDocuments": "Rechercher un document de l'Église",
  "listSearch.devotions": "Rechercher une dévotion",
  "listSearch.novenas": "Rechercher une neuvaine",
  "admin.loading.greeting": "Bienvenue !",
  "admin.login.title": "Connexion administrateur",
  "admin.login.subtitle":
    "Ce portail est réservé aux administrateurs autorisés. Toutes les actions sont journalisées.",
  "admin.login.username": "Nom d'utilisateur administrateur",
  "admin.login.password": "Mot de passe administrateur",
  "admin.login.submit": "Entrer",
  "admin.login.invalid": "Identifiants incorrects.",
  "admin.dashboard.title": "Tableau de bord",
  "admin.dashboard.subtitle":
    "Gérez le contenu, les traductions, l'ingestion, les médias et la page d'accueil.",
  "admin.signOut": "Déconnexion",
  "admin.welcomeLine": "Vous êtes connecté en tant qu'administrateur.",
  "common.loading": "Chargement",
};
