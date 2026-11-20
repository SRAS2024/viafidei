"""Ecclesiastical Latin for the voices: Kokoro phonemes, and an Italian respelling.

No commercially licensed speech model speaks Latin, so the engine speaks it two ways:

* ``to_ipa(text)``: the words as a Kokoro phoneme string (Kokoro's Italian voices,
  ``if_sara`` / ``im_nicola``, read raw phonemes and keep every stress mark);
* ``to_respelling(text)``: the words spelt as Italian, for an Italian voice of a
  text-only model (the challenger route).

Both come from one analysis of each word: letters -> sounds -> syllables -> stress.
Pure standard library; nothing here touches a model, a file outside this folder, or
the network.

Pronunciation: modern Italianate Ecclesiastical Latin (Liber Usualis; the Church's
pronunciation as Rome prays it)
------------------------------------------------------------------------------------
=====================  ==========================  ===============================
Spelling               Sound                       Example (Kokoro string)
=====================  ==========================  ===============================
c + e, i, y, ae, oe    ʧ                           caelis -> ʧˈɛːlis
cc + front vowel       tʧ                          ecce -> ˈɛtʧe
sc + front vowel       ʃ (ʃʃ after a vowel)        suscipe -> sˈuʃʃipe
xc + front vowel       kʃ                          excelsis -> ekʃˈɛlsis
c elsewhere, ch, k     k                           Christe -> krˈiste, Kyrie
g + front vowel        ʤ (gg -> dʤ)                Virgine -> vˈirʤine
gn                     ɲɲ after a vowel, else ɲ    regnum -> rˈɛɲɲum
h                      silent                      hodie -> ˈɔːdie
mihi, nihil(-)         h = k                       mihi -> mˈiːki
ti + vowel             ʦi (tʦi after a vowel),     gratia -> ɡrˈatʦia,
                       but ti after s, t, x        hostia -> ˈɔstia
ph, th, rh, y          f, t, r, i                  catholicam -> katˈɔːlikam
qu; ngu + vowel        kw; ŋɡw                     sanguis -> sˈaŋɡwis
suav-, suad-, suet-    sw                          suavis -> swˈaːvis
x                      ks                          Rex -> rˈɛks
ex + vowel (or h)      eɡz                         exaudi -> eɡzˈaudi
exs                    eks (the s is the x's own)  exsultavit -> eksultˈaːvit
z                      ʣ (dʣ between vowels)       Nazarenus -> nadʣarˈɛːnus
i/j before a vowel     j (word-initially, or       Iesus -> jˈɛːzus,
                       between vowels)             eius -> ˈɛːjus, alleluia
v                      v                           vivat
s between vowels       z                           Iesus, eleison -> elˈɛːizon
s + voiced consonant   z (as Italian does)         Israel -> ˈizrael
n + velar              ŋ                           Sancti -> sˈaŋkti
double consonants      geminated (written twice)   terra -> tˈɛrra
ae, oe                 e (ɛ when stressed)         saeculorum -> sekulˈɔːrum
au, eu (Greek eu-)     au, eu                      laudate, Eucharistia
cui, huic              one syllable                cui -> kˈui
every other vowel      its own syllable (hiatus)   Filii -> fˈiːlii, Dei -> dˈɛːi
=====================  ==========================  ===============================

Vowels: stressed e and o are open (ɛ, ɔ), unstressed e, o close; a stressed vowel
in an open syllable that is not the last of its word is long (ː), as in Italian.

Stress, in this order:
1. a printed accent in the text (acute, grave or circumflex: Dómine, adorémus,
   sǽculum) - liturgical books print one on the stressed vowel;
2. the lexicon (``latin_lexicon.tsv``, below);
3. the rules: a monosyllable is stressed unless it is a function word (below); two
   syllables -> the first; longer words -> the penult if it is heavy (closed by a
   consonant - x, z and gn close it, a stop + l/r does not -, or a diphthong, or a
   vowel long by nature), else the antepenult when the penult vowel stands before
   another vowel ("vocalis ante vocalem corripitur": gloria, Filius, Spiritui);
   the enclitic -que pulls the stress onto the syllable before it (Filióque,
   Spiritúsque; not atque, itaque, undique, utique, denique, which are lexicon
   words); endings whose penult vowel is always long or short (-atus, -ibus,
   -tionem, -orum, -osus, -ulus, ...);
4. likely endings (-inus long, -ilis short, -ere short, ...) and, when nothing
   decides, the penult (a "fallback guess"). Words decided by 4 are what
   ``to_ipa_report`` returns; each is logged once per process to
   ``logging.getLogger("voice_engine.latin")`` and appended to the file named by
   ``VOICE_ENGINE_LATIN_UNKNOWN_LOG`` when that is set, for the lexicon.

Unstressed monosyllables (function words): et ac aut vel nec neu seu sed ut si an
ne nam dum cum, the prepositions in ad ab abs a e ex de per pro prae sub ob post
trans, and the relatives qui quae quod quo qua quem quam quos quas. Every other
monosyllable - pronouns (te, tu, nos, me), verbs (est, es, sit), nouns, non, o,
nunc - is stressed.

House style (every choice the rules leave open)
-----------------------------------------------
* intervocalic s is voiced [z] (Iesus [ˈjɛːzus], misericordia, causa);
* excelsis is [ekʃˈɛlsis] (xc before a front vowel = k + ʃ, per the Liber Usualis);
* mihi and nihil (and nihil-) sound the h as [k];
* Míchaël, Ráphaël, Ísraël are stressed on the first syllable and keep a-e apart,
  as liturgical books print them (Wiktionary's Michael [miˈkaː.el] is not used);
* ex + vowel (or h) at the start of a word is [eɡz] (exaudi, exaltavit, exhibe);
  exs is [eks] with a single s (exsultavit [eksultˈaːvit]); some editions of the
  Liber Usualis voice it ([eɡz]) - flagged, not followed;
* the consonantal i between vowels is a single [j] (eius [ˈɛːjus], alleluia
  [allelˈuːja]); for stress the syllable before it counts as heavy (Pompéius);
* ti + vowel is [ʦi] even when stressed; th never assibilates (Matthias);
* s before a voiced consonant is [z] (Israel, eiusdem), as an Italian says it;
* no secondary stresses; Kokoro's Italian is natural without them.

Kokoro strings
--------------
Only symbols from Kokoro's 114-symbol vocabulary: ligatures ʧ ʤ ʦ ʣ, ɡ (U+0261),
ˈ immediately before the stressed vowel (stress="vowel", the espeak-ng / misaki
convention Kokoro was trained on: /kˈOkəɹO/) or at the stressed syllable's onset
(stress="syllable", Wiktionary's convention), ː only with length=True; no dots, no
tie bars. Words are separated by one space; , . ; : ! ? stay on their word; — and …
are kept; quotes, brackets and other marks are dropped; a slash becomes a comma.
Kokoro reads at most 510 symbols at once: split longer strings with ``chunk_ipa``.

Italian respelling
------------------
ae/oe -> e; ti + vowel -> zi; h dropped (michi, nichil); ch and k -> c, or ch before
e/i; ph -> f; th -> t; y -> i; j -> i; xc before e/i -> csc (ecscelsis); exs -> ecs;
every other letter as written (Italian reads x as [ks]). A grave accent marks the
stressed vowel only where Italian spelling would need one to be read right, that is
when the stress is not on the penult (nòmine, Spìritus, Dòminus, gràzia, but Patris,
sanctificetur, Maria); accents="all" marks every word of two or more syllables
(Pàtris, sanctificètur), for the A/B test. Stressed e and o are open: è, ò.

Lexicon (latin_lexicon.tsv, next to this file)
----------------------------------------------
One word per line, tab-separated: ``key  form  source  note``.
* key: the word in lower case, accents stripped, æ/œ -> ae/oe, j -> i (v kept);
* form: the word with an acute on the stressed vowel (on a diphthong's first letter:
  ǽ may be written áe); macrons/breves for vowel length; a diaeresis where two
  vowels stay apart (Míchaël, aër) or where i/u is a vowel; j for a consonantal i
  after a consonant (adjutórium); | for a syllable break the rules would not make,
  after a prefix before l/r (súb|leva, ób|ruta); the form must reduce to its key;
* source: ``own`` (quantities from the author's knowledge of Latin) or ``accent``
  (the stress printed in the site's liturgical texts);
* note: free text; ``?`` marks an entry its author was unsure of; ``name`` makes the
  entry apply only to a capitalised word (María; lower-case maria, "seas", keeps
  the rule's stress).
"""

from __future__ import annotations

import logging
import os
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Optional

__all__ = [
    "KOKORO_VOCAB",
    "LEXICON_PATH",
    "WordAnalysis",
    "analyse",
    "check_vocab",
    "chunk_ipa",
    "stress_position",
    "syllables",
    "to_ipa",
    "to_ipa_report",
    "to_respelling",
    "word_ipa",
]

#: Kokoro-82M's phoneme vocabulary (config.json "vocab"), every symbol it can read.
KOKORO_VOCAB: frozenset[str] = frozenset(
    " !\u0022(),.:;?AIOQSTWYabcdefhijklmnopqrstuvwxyz\u00e6\u00e7\u00f0\u00f8\u014b"
    "\u0153\u0250\u0251\u0252\u0254\u0255\u0256\u0259\u025a\u025b\u025c\u025f\u0261"
    "\u0263\u0264\u0265\u0268\u026a\u026f\u0270\u0272\u0273\u0274\u0278\u0279\u027b"
    "\u027d\u027e\u0281\u0282\u0283\u0288\u028a\u028b\u028c\u028e\u0292\u0294\u029d"
    "\u02a3\u02a4\u02a5\u02a6\u02a7\u02a8\u02b0\u02b2\u02c8\u02cc\u02d0\u0303\u03b2"
    "\u03b8\u03c7\u1d4a\u1d5d\u1d7b\u2014\u201c\u201d\u2026\u2192\u2193\u2197\u2198"
    "\uab67"
)

LOG = logging.getLogger("voice_engine.latin")

#: The stress lexicon read at import.
LEXICON_PATH = Path(__file__).with_name("latin_lexicon.tsv")

STRESS = "\u02c8"  # primary stress mark
LONG = "\u02d0"  # length mark

_LETTERS = frozenset("abcdefghijklmnopqrstuvwxyz")
_VOWELS = frozenset("aeiouy")
_ACCENT_MARKS = frozenset("\u0301\u0300\u0302\u0342")  # acute, grave, circumflex, perispomeni
_MACRON = "\u0304"
_BREVE = "\u0306"
_DIAERESIS = "\u0308"

#: Monosyllables said without stress (prepositions, conjunctions, relatives).
_UNSTRESSED = frozenset(
    "et ac aut vel nec neu seu sed ut si an ne nam dum cum "
    "in ad ab abs a e ex de per pro prae sub ob post trans "
    "qui quae quod quo qua quem quam quos quas".split()
)

#: Words in which eu is one syllable (besides Greek words opening with eu + consonant).
_EU_WORDS = frozenset("heu eheu seu neu ceu neutiquam".split())
#: Words in which ui is one syllable.
_UI_WORDS = frozenset("cui huic hui cuique cuiquam cuipiam".split())
#: Words ending in -que that are not a word + the enclitic.
_QUE_NOT_ENCLITIC = frozenset("itaque undique utique denique quoque".split())

#: Consonants that, before l or r, leave the syllable open (muta cum liquida).
_MUTA = frozenset("pbtdkɡf")
#: Consonant letters before which s is voiced.
_VOICED_AFTER_S = frozenset("bdglmnrv")

_VOWEL_IPA = {
    # nucleus: (unstressed, stressed)
    "a": ("a", "a"),
    "e": ("e", "ɛ"),
    "i": ("i", "i"),
    "o": ("o", "ɔ"),
    "u": ("u", "u"),
    "y": ("i", "i"),
    "ae": ("e", "ɛ"),
    "oe": ("e", "ɛ"),
    "au": ("au", "au"),
    "eu": ("eu", "ɛu"),
    "ui": ("ui", "ui"),
}
#: Nuclei that are one vowel sound (and so lengthen when stressed in an open syllable).
_MONOPHTHONGS = frozenset("a e i o u y ae oe".split())
_DIPHTHONGS = frozenset("ae oe au eu ui".split())

_GRAVE = {"a": "à", "e": "è", "i": "ì", "o": "ò", "u": "ù"}

# Endings that fix the penult vowel's length: (ending, index of its first vowel, long?,
# sure?). An ending applies only when its first vowel is the penult's vowel and that
# syllable is open. "Sure" endings count as rules (their few exceptions - ángeli,
# córporis, Lázarum - are in the lexicon); the others are likely guesses that
# to_ipa_report lists.
_SUFFIXES_RAW: list[tuple[str, int, bool, bool]] = []


def _add(endings: str, long_: bool, sure: bool) -> None:
    for e in endings.split():
        offset = next(i for i, ch in enumerate(e) if ch in "aeiouy")
        _SUFFIXES_RAW.append((e, offset, long_, sure))


# Sure long.
_add("atus ata atum ati atae ato atam atos atas atis ates atem ate", True, True)
_add("etur atur emur amur emus amus ete", True, True)
_add("avit avi ivit ivi evit evi ovit erunt", True, True)
_add("abat abant abam abas ebat ebant ebam ebas ibat ibant", True, True)
_add("abit abis abo abunt ebit ebis ebo ebunt abor ebor", True, True)
_add("are ari aris arem ares aret arent", True, True)
_add("ire iri iret irent irem", True, True)
_add("osus osa osum osi osae oso osam osos osas osis", True, True)
_add("alis ale ali alem ales", True, True)
_add("orum arum", True, True)
_add("onis onem one ones onum", True, True)
_add("ivus iva ivum ivae ivo ivam ivos ivas ivis", True, True)
_add("udo ator atrix tricis tricem trice trices", True, True)
_add("elis ele eli elem eles", True, True)
# Sure short.
_add("ibus imus ima imi imo imum imae imam imos imas imis itas mini ifer iger", False, True)
_add("idit cipi iter", False, True)
_add("mina mino minum mine minis minem mines gini gine ginis ginem gines ginum", False, True)
_add("ulus ula ulum uli ulae ulo ulam ulos ulas ulis", False, True)
_add("idus ida idum idae idam idos idas", False, True)
_add("erat erant eram eras erit erint", False, True)
_add("cipe cipis cipes cipem cipit", False, True)
# Likely long.
_add("etis edo ela ago ugo", True, False)
_add("inus ina ini inae ino inam inos inas", True, False)
_add("ura urus urum uri urae uro uram uros uras uris", True, False)
_add("enus ena enum eni enae eno enam enos enas enis", True, False)
_add("anus ana anum ani anae ano anam anos anas anis", True, False)
_add("utus uta utum uti utae uto", True, False)
_add("ore orem ores oris", True, False)
# Likely short.
_add("icus ica icum ici icae ico icam icos icas icis", False, False)
_add("ilis ile ili ilem iles", False, False)
_add("inis ine inem ines inum", False, False)
_add("itus ita itum iti itae ito itam itos itis ite itur imur", False, False)
_add("era erus erum eri erae ero eros eris", False, False)
_add("ere eret erent erem eres", False, False)
_add("olus ola olum oli olae olo", False, False)
_add("ido idi igo ime ora ices icem ice ige igit igis igunt itu itor", False, False)

_SUFFIXES: tuple[tuple[str, int, bool, bool], ...] = tuple(
    sorted(_SUFFIXES_RAW, key=lambda t: -len(t[0]))
)


# ---------------------------------------------------------------------------------
# Letters
# ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Spelled:
    """A word as plain letters a-z, with what its diacritics said."""

    chars: str
    stress: Optional[int]  # index of the letter carrying a printed accent
    length: tuple[Optional[bool], ...]  # True = macron, False = breve
    split: tuple[bool, ...]  # diaeresis: a vowel of its own
    breaks: frozenset[int] = frozenset()  # letters that must open a syllable ("|")


def _spell(word: str) -> _Spelled:
    chars: list[str] = []
    length: list[Optional[bool]] = []
    split: list[bool] = []
    stress: Optional[int] = None
    breaks: set[int] = set()
    ligature_first: dict[int, int] = {}
    for ch in unicodedata.normalize("NFD", word):
        if ch == "|":
            breaks.add(len(chars))
            continue
        if unicodedata.combining(ch):
            if not chars:
                continue
            i = len(chars) - 1
            if ch in _ACCENT_MARKS:
                stress = ligature_first.get(i, i)
            elif ch == _MACRON:
                length[i] = True
            elif ch == _BREVE:
                length[i] = False
            elif ch == _DIAERESIS:
                split[i] = True
            continue
        low = ch.lower()
        if low in ("æ", "œ"):
            chars += ["a" if low == "æ" else "o", "e"]
            length += [None, None]
            split += [False, False]
            ligature_first[len(chars) - 1] = len(chars) - 2
        elif low in _LETTERS:
            chars.append(low)
            length.append(None)
            split.append(False)
    return _Spelled("".join(chars), stress, tuple(length), tuple(split), frozenset(breaks))


def _key(chars: str) -> str:
    return chars.replace("j", "i")


def _load_lexicon(path: Path) -> dict[str, tuple[str, bool]]:
    """key -> (form, applies only to a capitalised word, i.e. a name)."""
    lexicon: dict[str, tuple[str, bool]] = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        LOG.warning("latin: no lexicon at %s; stress falls back to the rules", path)
        return lexicon
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        cols = line.split("\t")
        if len(cols) < 2 or not cols[0].strip() or not cols[1].strip():
            continue
        name_only = len(cols) > 3 and "name" in cols[3].split()
        lexicon[cols[0].strip()] = (cols[1].strip(), name_only)
    return lexicon


_LEXICON: dict[str, tuple[str, bool]] = _load_lexicon(LEXICON_PATH)


def _merge(spelled: _Spelled, form: str) -> tuple[_Spelled, bool]:
    """The lexicon form, with the text's own printed accent and j's on top.

    Returns the merged spelling and whether the stress is the text's own.
    """
    lex = _spell(form)
    if len(lex.chars) != len(spelled.chars):
        LOG.warning("latin: lexicon form %r does not match %r; ignored", form, spelled.chars)
        return spelled, spelled.stress is not None
    chars = list(lex.chars)
    for i, c in enumerate(spelled.chars):
        if c == "j":
            chars[i] = "j"
    own = spelled.stress is not None
    return (
        _Spelled(
            "".join(chars),
            spelled.stress if own else lex.stress,
            tuple(a if a is not None else b for a, b in zip(spelled.length, lex.length)),
            tuple(a or b for a, b in zip(spelled.split, lex.split)),
            lex.breaks | spelled.breaks,
        ),
        own,
    )


# ---------------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------------


@dataclass
class _Syl:
    onset: list[str]
    nucleus: str
    coda: list[str]
    first_letter: int
    long: Optional[bool]
    hiatus_after: bool = False
    heavy_j: bool = False
    onset_letters: list[int] = field(default_factory=list)


@dataclass
class WordAnalysis:
    """One word, analysed."""

    word: str
    chars: str  # plain letters (after the lexicon form)
    key: str  # the lexicon key
    syllables: list[_Syl]
    stress: Optional[int]  # syllable index, None for an unstressed monosyllable
    source: str  # accent | lexicon | rule | suffix | fallback | none
    roles: str  # per letter: V vowel, J consonantal i, W consonantal u, C consonant
    nuclei: list[tuple[int, int]]
    #: what decided the stress: accent, lexicon, function-word, monosyllable,
    #: disyllable, enclitic, heavy-penult, hiatus, -<ending> (sure or likely), fallback
    reason: str = ""

    @property
    def guessed(self) -> bool:
        """Was the stress a guess (a likely ending, or the fallback)?"""
        return self.source in ("suffix", "fallback")


def _roles(s: str, split: tuple[bool, ...]) -> list[str]:
    n = len(s)
    role = ["V" if c in _VOWELS else ("J" if c == "j" else "C") for c in s]
    # Consonantal u: qu, ngu + vowel, suav-/suad-/suas-/suet-/suesc-.
    for k, c in enumerate(s):
        if c != "u" or split[k]:
            continue
        prev = s[k - 1] if k else ""
        next_vowel = k + 1 < n and s[k + 1] in _VOWELS
        if prev == "q":
            role[k] = "W"
        elif prev == "g" and k >= 2 and s[k - 2] == "n" and next_vowel:
            role[k] = "W"
        elif prev == "s" and (
            s.startswith(("suav", "suad", "suet", "suesc"), k - 1)
            or (s.startswith("suas", k - 1) and k + 3 < n)
        ):
            role[k] = "W"
    # Consonantal i: word-initially before a vowel, or between vowels.
    for k, c in enumerate(s):
        if c != "i" or split[k]:
            continue
        nxt_vowel = k + 1 < n and role[k + 1] == "V" and not split[k + 1]
        if k == 0 and nxt_vowel and s[k + 1] != "i":
            role[k] = "J"
        elif k > 0 and role[k - 1] == "V" and nxt_vowel:
            role[k] = "J"
    return role


def _eu_is_diphthong(s: str, k: int) -> bool:
    if s in _EU_WORDS or s.startswith("neut"):
        return True
    return k == 0 and len(s) > 2 and s[2] not in _VOWELS and s[2] not in "mn"


def _nuclei(s: str, role: list[str], split: tuple[bool, ...]) -> list[tuple[int, int]]:
    nuclei: list[tuple[int, int]] = []
    n = len(s)
    k = 0
    while k < n:
        if role[k] != "V":
            k += 1
            continue
        end = k + 1
        if k + 1 < n and role[k + 1] == "V" and not split[k + 1]:
            pair = s[k : k + 2]
            if (
                pair in ("ae", "oe", "au")
                or (pair == "eu" and _eu_is_diphthong(s, k))
                or (pair == "ui" and s in _UI_WORDS)
            ):
                end = k + 2
        nuclei.append((k, end))
        k = end
    return nuclei


def _sounds(
    s: str, role: list[str], nuclei: list[tuple[int, int]]
) -> list[tuple[str, object, int]]:
    """Letters to sounds: ("V", nucleus index, letter) and ("C", phoneme, letter)."""
    n = len(s)
    start_of = {st: i for i, (st, _en) in enumerate(nuclei)}
    h_is_k = s == "mihi" or s.startswith("nihil")

    def front(j: int) -> bool:
        if j not in start_of:
            return False
        st, en = nuclei[start_of[j]]
        nuc = s[st:en]
        return nuc[0] in "eiy" or nuc in ("ae", "oe")

    def vowel_at(j: int) -> bool:
        return 0 <= j < n and role[j] == "V"

    def after_vowel(j: int) -> bool:
        return j > 0 and role[j - 1] == "V"

    out: list[tuple[str, object, int]] = []

    def c(ph: str, at: int) -> None:
        out.append(("C", ph, at))

    k = 0
    while k < n:
        ch = s[k]
        r = role[k]
        nxt = s[k + 1] if k + 1 < n else ""
        if r == "V":
            idx = start_of.get(k)
            if idx is None:  # cannot happen: every vowel letter is in a nucleus
                k += 1
                continue
            out.append(("V", idx, k))
            k = nuclei[idx][1]
            continue
        if r == "J":
            c("j", k)
        elif r == "W":
            c("w", k)  # an orphan consonantal u (consumed below in every real case)
        elif ch == "h":
            if h_is_k:
                c("k", k)
        elif ch == "c":
            if nxt == "h":
                c("k", k)
                k += 2
                continue
            if nxt == "c":
                c("k" if k + 2 < n and s[k + 2] == "h" else ("t" if front(k + 2) else "k"), k)
            else:
                c("ʧ" if front(k + 1) else "k", k)
        elif ch == "g":
            if nxt == "n":
                if after_vowel(k):
                    c("ɲ", k)
                c("ɲ", k + 1)
                k += 2
                continue
            if nxt == "g":
                c("d" if front(k + 2) else "ɡ", k)
            elif k + 1 < n and role[k + 1] == "W":
                c("ɡw", k)
                k += 2
                continue
            else:
                c("ʤ" if front(k + 1) else "ɡ", k)
        elif ch == "q":
            c("kw", k)
            k += 2 if nxt == "u" else 1
            continue
        elif ch == "s":
            if nxt == "c" and front(k + 2):
                if after_vowel(k):
                    c("ʃ", k)
                c("ʃ", k + 1)
                k += 2
                continue
            if k + 1 < n and role[k + 1] == "W":
                c("sw", k)
                k += 2
                continue
            if after_vowel(k) and vowel_at(k + 1):
                c("z", k)
            elif nxt in _VOICED_AFTER_S:
                c("z", k)
            else:
                c("s", k)
        elif ch == "t":
            if nxt == "h":
                c("t", k)
                k += 2
                continue
            if (
                nxt == "i"
                and role[k + 1] == "V"
                and vowel_at(k + 2)
                and k > 0
                and s[k - 1] not in "stx"
            ):
                if after_vowel(k):
                    c("t", k)
                c("ʦ", k)
            else:
                c("t", k)
        elif ch == "x":
            initial_ex = k == 1 and s[0] == "e"
            if initial_ex and (vowel_at(2) or (nxt == "h" and vowel_at(3))):
                c("ɡ", k)
                c("z", k)
            elif nxt == "c" and front(k + 2):
                c("k", k)
                c("ʃ", k + 1)
                k += 2
                continue
            elif nxt == "s":
                c("k", k)
                c("s", k + 1)
                k += 2
                continue
            else:
                c("k", k)
                c("s", k)
        elif ch == "z":
            if after_vowel(k) and vowel_at(k + 1):
                c("d", k)
            c("ʣ", k)
        elif ch == "p" and nxt == "h":
            c("f", k)
            k += 2
            continue
        elif ch == "r" and nxt == "h":
            c("r", k)
            k += 2
            continue
        else:
            c(ch, k)  # b d f k l m n p r v
        k += 1

    # n before a velar is [ŋ].
    for i in range(len(out) - 1):
        kind, ph, at = out[i]
        if kind == "C" and ph == "n":
            nk, nph, _ = out[i + 1]
            if nk == "C" and str(nph)[0] in ("k", "ɡ"):
                out[i] = ("C", "ŋ", at)
    return out


def _split_cluster(cons: list[str]) -> int:
    """Where a consonant cluster between two vowels splits: the onset's start index."""
    if len(cons) <= 1:
        return 0
    if cons[-2] in _MUTA and cons[-1] in ("l", "r"):
        return len(cons) - 2
    return len(cons) - 1


def _syllabify(
    s: str, nuclei: list[tuple[int, int]], sounds: list[tuple[str, object, int]],
    length: tuple[Optional[bool], ...], breaks: frozenset[int] = frozenset(),
) -> list[_Syl]:
    vpos = [i for i, t in enumerate(sounds) if t[0] == "V"]
    syls: list[_Syl] = []
    if not vpos:
        return syls
    for si, ti in enumerate(vpos):
        idx = int(sounds[ti][1])  # type: ignore[arg-type]
        st, en = nuclei[idx]
        nuc = s[st:en]
        long_ = None
        for j in range(st, en):
            if length[j] is not None:
                long_ = length[j]
        syls.append(_Syl([], nuc, [], st, long_))
    # leading consonants
    first = vpos[0]
    syls[0].onset = [str(t[1]) for t in sounds[:first]]
    syls[0].onset_letters = [t[2] for t in sounds[:first]]
    # gaps
    for si in range(len(vpos) - 1):
        a, b = vpos[si], vpos[si + 1]
        gap = sounds[a + 1 : b]
        cons = [str(t[1]) for t in gap]
        at = [t[2] for t in gap]
        cut = _split_cluster(cons)
        for j, letter in enumerate(at):
            if letter in breaks:
                cut = j
                break
        syls[si].coda = cons[:cut]
        syls[si + 1].onset = cons[cut:]
        syls[si + 1].onset_letters = at[cut:]
        if not cons:
            syls[si].hiatus_after = True
        elif cons == ["j"]:
            syls[si].heavy_j = True
    syls[-1].coda = [str(t[1]) for t in sounds[vpos[-1] + 1 :]]
    return syls


def _heavy(syl: _Syl) -> bool:
    return bool(syl.coda) or syl.nucleus in _DIPHTHONGS or syl.long is True or syl.heavy_j


def _known_light(syl: _Syl) -> bool:
    return syl.long is False or (syl.hiatus_after and syl.long is not True)


def _suffix_stress(s: str, syls: list[_Syl]) -> Optional[tuple[int, bool, str]]:
    pen = syls[-2]
    for ending, offset, long_, sure in _SUFFIXES:
        if s.endswith(ending) and len(s) - len(ending) + offset == pen.first_letter:
            return (len(syls) - 2 if long_ else len(syls) - 3), sure, ending
    return None


def _syllable_of_letter(syls: list[_Syl], nuclei: list[tuple[int, int]], letter: int) -> int:
    """The syllable whose vowel is at or nearest before `letter`."""
    best = 0
    for i, syl in enumerate(syls):
        if syl.first_letter <= letter:
            best = i
    return best


@lru_cache(maxsize=65536)
def analyse(word: str) -> WordAnalysis:
    """Analyse one word (letters only; punctuation is ignored)."""
    spelled = _spell(word)
    key = _key(spelled.chars)
    source = "rule"
    own_accent = spelled.stress is not None
    entry = _LEXICON.get(key)
    if entry is not None and (not entry[1] or word[:1].isupper()):
        spelled, own_accent = _merge(spelled, entry[0])
        source = "lexicon"
    s = spelled.chars
    role = _roles(s, spelled.split)
    nuclei = _nuclei(s, role, spelled.split)
    sounds = _sounds(s, role, nuclei)
    syls = _syllabify(s, nuclei, sounds, spelled.length, spelled.breaks)
    n = len(syls)
    stress: Optional[int]
    if n == 0:
        return WordAnalysis(word, s, key, syls, None, "none", "".join(role), nuclei, "no vowel")
    if spelled.stress is not None:
        stress = _syllable_of_letter(syls, nuclei, spelled.stress)
        source = "accent" if own_accent else "lexicon"
        reason = source
    elif n == 1:
        unstressed = key in _UNSTRESSED and source != "lexicon"
        stress = None if unstressed else 0
        reason = "function-word" if unstressed else "monosyllable"
    elif n == 2:
        stress, reason = 0, "disyllable"
    elif s.endswith("que") and key not in _QUE_NOT_ENCLITIC and source != "lexicon":
        stress, reason = n - 2, "enclitic"
    else:
        pen = syls[-2]
        if _heavy(pen):
            stress, reason = n - 2, "heavy-penult"
        elif _known_light(pen):
            stress, reason = n - 3, "hiatus" if pen.long is None else "short-penult"
        else:
            guess = _suffix_stress(s, syls)
            if guess is None and s.endswith(("ens", "ans")):
                guess = (n - 3, False, "ens/-ans")  # a participle: its stem vowel is short
            if guess is not None:
                stress, sure, ending = guess
                reason = f"-{ending}"
                if source != "lexicon":
                    source = "rule" if sure else "suffix"
            else:
                stress, reason = n - 2, "fallback"
                if source != "lexicon":
                    source = "fallback"
    return WordAnalysis(word, s, key, syls, stress, source, "".join(role), nuclei, reason)


# ---------------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------------


def _render(an: WordAnalysis, stress: str, length: bool) -> str:
    out: list[str] = []
    last = len(an.syllables) - 1
    for i, syl in enumerate(an.syllables):
        on = "".join(syl.onset)
        co = "".join(syl.coda)
        if i == an.stress:
            v = _VOWEL_IPA[syl.nucleus][1]
            if length and not syl.coda and i < last and syl.nucleus in _MONOPHTHONGS:
                v += LONG
            if stress == "syllable":
                out.append(STRESS + on + v + co)
            else:
                out.append(on + STRESS + v + co)
        else:
            out.append(on + _VOWEL_IPA[syl.nucleus][0] + co)
    return "".join(out)


_SEEN_GUESSES: set[str] = set()


def _note_guess(an: WordAnalysis, ipa: str) -> None:
    if an.key in _SEEN_GUESSES:
        return
    _SEEN_GUESSES.add(an.key)
    LOG.warning("latin: stress of %r is a guess (%s): %s", an.word, an.source, ipa)
    path = os.environ.get("VOICE_ENGINE_LATIN_UNKNOWN_LOG")
    if path:
        try:
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(f"{an.key}\t{an.source}\t{ipa}\n")
        except OSError as exc:  # never break speech over a log file
            LOG.warning("latin: cannot append to %s: %s", path, exc)


def _check_style(stress: str) -> None:
    if stress not in ("vowel", "syllable"):
        raise ValueError(f"stress must be 'vowel' or 'syllable', not {stress!r}")


def word_ipa(word: str, *, stress: str = "vowel", length: bool = True) -> str:
    """One word as a Kokoro phoneme string (no punctuation)."""
    _check_style(stress)
    an = analyse(word)
    return _render(an, stress, length)


def syllables(word: str) -> list[str]:
    """The word's syllables, in its plain letters (Dominus -> do, mi, nus)."""
    an = analyse(word)
    s = an.chars
    if not an.syllables:
        return [s] if s else []
    starts: list[int] = [0]
    for syl in an.syllables[1:]:
        st = min(syl.onset_letters) if syl.onset_letters else syl.first_letter
        while st > starts[-1] + 1 and s[st - 1] == "h" and st - 1 not in syl.onset_letters:
            st -= 1  # a silent h belongs to the syllable it opens
        starts.append(max(st, starts[-1] + 1))
    starts.append(len(s))
    return [s[a:b] for a, b in zip(starts, starts[1:])]


def stress_position(word: str) -> int:
    """Index into ``syllables(word)`` of the stressed syllable; -1 if it has none."""
    an = analyse(word)
    return -1 if an.stress is None else an.stress


def _is_letter(ch: str) -> bool:
    return unicodedata.category(ch).startswith("L")


def _tokens(text: str) -> list[tuple[str, str]]:
    """("w", word) and ("p", one other character), in order."""
    text = unicodedata.normalize("NFC", text)
    toks: list[tuple[str, str]] = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if _is_letter(ch):
            j = i + 1
            while j < n and (_is_letter(text[j]) or unicodedata.category(text[j]).startswith("M")):
                j += 1
            toks.append(("w", text[i:j]))
            i = j
        else:
            toks.append(("p", ch))
            i += 1
    return toks


_PUNCT = {
    ",": ",",
    ".": ".",
    ";": ";",
    ":": ":",
    "!": "!",
    "?": "?",
    "\u2014": "\u2014",
    "\u2013": "\u2014",
    "\u2026": "\u2026",
    "/": ",",
    "\u00b7": ",",
}


def _ipa_and_guesses(text: str, stress: str, length: bool) -> tuple[str, list[str]]:
    _check_style(stress)
    out = ""
    guesses: list[str] = []
    toks = _tokens(text)
    # "..." -> "\u2026"
    merged: list[tuple[str, str]] = []
    for kind, val in toks:
        if kind == "p" and val == "." and len(merged) >= 2 and merged[-1] == ("p", ".") and merged[-2] == ("p", "."):
            merged[-2:] = [("p", "\u2026")]
        else:
            merged.append((kind, val))
    for kind, val in merged:
        if kind == "w":
            an = analyse(val)
            if not an.syllables:
                LOG.info("latin: %r has no vowel; not spoken", val)
                continue
            ipa = _render(an, stress, length)
            if an.guessed:
                _note_guess(an, ipa)
                if val not in guesses:
                    guesses.append(val)
            if out and not out.endswith(" "):
                out += " "
            out += ipa
            continue
        if val.isdigit():
            LOG.warning("latin: digit %r in Latin text is not spoken", val)
            continue
        sym = _PUNCT.get(val)
        if sym is None or not out:
            continue
        if sym == "\u2014":
            out = out.rstrip() + " \u2014 "
            continue
        out = out.rstrip()
        if out and out[-1] == sym:
            continue
        if out.endswith("\u2014"):
            out = out[:-1].rstrip()
        out += sym + " "
    out = " ".join(out.split())
    if out.endswith("\u2014"):
        out = out[:-1].rstrip()
    return out, guesses


def to_ipa(text: str, *, stress: str = "vowel", length: bool = True) -> str:
    """Latin text -> one Kokoro phoneme string."""
    return _ipa_and_guesses(text, stress, length)[0]


def to_ipa_report(text: str, **kw: object) -> tuple[str, list[str]]:
    """``to_ipa`` plus the words whose stress was a guess, in order of appearance."""
    stress = str(kw.pop("stress", "vowel"))
    length = bool(kw.pop("length", True))
    if kw:
        raise TypeError(f"unexpected arguments: {', '.join(kw)}")
    return _ipa_and_guesses(text, stress, length)


def check_vocab(ipa: str) -> set[str]:
    """Symbols in `ipa` that Kokoro cannot read (empty for every string made here)."""
    return {ch for ch in ipa if ch not in KOKORO_VOCAB}


def chunk_ipa(ipa: str, limit: int = 500) -> list[str]:
    """Splits a long phoneme string at sentence marks, then commas, then spaces."""
    if len(ipa) <= limit:
        return [ipa] if ipa else []
    for marks in (".!?;:\u2026", ",\u2014", " "):
        best = -1
        for i, ch in enumerate(ipa[:limit]):
            if ch in marks:
                best = i
        if best > 0:
            head = ipa[: best + 1].strip()
            tail = ipa[best + 1 :].strip()
            return [head] + chunk_ipa(tail, limit)
    return [ipa[:limit]] + chunk_ipa(ipa[limit:], limit)


# ---------------------------------------------------------------------------------
# Italian respelling
# ---------------------------------------------------------------------------------


def _respell_word(word: str, accents: str) -> str:
    an = analyse(word)
    s = an.chars
    if not an.syllables:
        return word
    role = an.roles
    n = len(s)
    nsyl = len(an.syllables)
    start_of = {st: (st, en) for st, en in an.nuclei}
    accent_at: Optional[int] = None
    if an.stress is not None and nsyl >= 2 and (accents == "all" or an.stress != nsyl - 2):
        accent_at = an.syllables[an.stress].first_letter

    def front(j: int) -> bool:
        if j not in start_of:
            return False
        st, en = start_of[j]
        nuc = s[st:en]
        return nuc[0] in "eiy" or nuc in ("ae", "oe")

    def vowel_at(j: int) -> bool:
        return 0 <= j < n and role[j] == "V"

    h_is_k = s == "mihi" or s.startswith("nihil")
    out: list[str] = []
    k = 0
    while k < n:
        ch = s[k]
        nxt = s[k + 1] if k + 1 < n else ""
        if role[k] == "V":
            st, en = start_of.get(k, (k, k + 1))
            text = s[st:en]
            if text in ("ae", "oe"):
                text = "e"
            text = text.replace("y", "i")
            if k == accent_at:
                text = _GRAVE.get(text[0], text[0]) + text[1:]
            out.append(text)
            k = en
            continue
        if role[k] == "J":
            out.append("i")
        elif ch == "h":
            if h_is_k:
                out.append("ch")
        elif ch == "c" and nxt == "h":
            out.append("ch" if front(k + 2) else "c")
            k += 2
            continue
        elif ch == "k":
            out.append("ch" if front(k + 1) else "c")
        elif ch == "p" and nxt == "h":
            out.append("f")
            k += 2
            continue
        elif ch in "tr" and nxt == "h":
            out.append(ch)
            k += 2
            continue
        elif (
            ch == "t"
            and nxt == "i"
            and role[k + 1] == "V"
            and vowel_at(k + 2)
            and k > 0
            and s[k - 1] not in "stx"
        ):
            out.append("z")
        elif ch == "x" and nxt == "c" and front(k + 2):
            out.append("cs")
        elif ch == "x" and nxt == "s":
            out.append("cs")
            k += 2
            continue
        elif ch == "y":
            out.append("i")
        else:
            out.append(ch)
        k += 1
    result = "".join(out)
    if word[:1].isupper() and result:
        result = result[0].upper() + result[1:]
    return result


def to_respelling(text: str, *, accents: str = "italian") -> str:
    """Latin text spelt as Italian, for an Italian voice. accents: "italian" | "all"."""
    if accents not in ("italian", "all"):
        raise ValueError(f"accents must be 'italian' or 'all', not {accents!r}")
    out: list[str] = []
    for kind, val in _tokens(text):
        out.append(_respell_word(val, accents) if kind == "w" else val)
    return "".join(out)
