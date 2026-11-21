"""
Checks every take before it is kept: does it say exactly the words, at a human pace,
with nothing extra?

  - Whisper large-v3-turbo (MIT, mlx-whisper) transcribes the take in the clip's
    language, and a character error rate (CER) compares it with the text. Both sides
    go through the same normaliser (normalize.py: numbers as words) and the same
    per-language fold, so the CER measures pronunciation and not spelling habits:
      * en es fr it de pt tl: letters, case, punctuation and diacritics folded;
      * pl vi: diacritics KEPT (Polish letters, Vietnamese tones are pronunciation);
      * el: a modern-Greek phonemic fold (ει, οι, η, ι, υ -> i; ω -> o; αι -> e ...),
        because the prayers are Koine Greek said with modern pronunciation and Whisper
        spells archaic words as their modern homophones;
      * zh: Hanyu Pinyin WITH tones (pypinyin), so homophone characters (玛利亚 /
        玛丽亚) do not count as errors but a wrong tone does;
      * ko: Hangul syllables, spaces ignored;
      * la: see LATIN_CHECK below.
  - Pace: estimated syllables per second over the spoken span, against a normal rate
    for the language (Pellegrino, Coupé & Marsico 2011 for en fr de it es zh vi;
    estimates for the rest) times a prayer factor. A clip of one to three syllables is
    allowed its drawn-out last syllable (SHORT_CLIP_SYLLABLES).
  - No long internal silences, no untranscribed tail (run-on babble), no extra words
    at either end, and a sane duration.
  - Pitch: median F0 (is the female voice in a female range?) and its spread in
    semitones (a flat, robotic read has very little).

`evaluate()` returns a QAResult with a verdict ('pass' | 'marginal' | 'fail') and a
score (lower is better) to pick the best of several takes.
"""

from __future__ import annotations

import difflib
import math
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from typing import Optional

import numpy as np

import audio as A
import latin
from normalize import normalize_for_voice

WHISPER_REPO = "mlx-community/whisper-large-v3-turbo"

# Whisper's language codes; Latin is decided by LATIN_CHECK.
WHISPER_LANG = {
    "en": "en", "es": "es", "fr": "fr", "it": "it", "de": "de", "pt": "pt", "pl": "pl",
    "tl": "tl", "vi": "vi", "ko": "ko", "zh": "zh", "el": "el", "la": "la",
}

# How Latin is checked: "it" = Whisper in Italian against the Italian respelling of
# the text; "la" = Whisper's own Latin against the Latin (both folded so that the
# Ecclesiastical mergers ae/e, v/u, j/i, ph/f... do not count). Chosen by
# tools/validate_qa.py (see the bake-off report): the check that separates good
# Ecclesiastical Latin from known-bad renderings best.
LATIN_CHECK = "la"

# Normal syllable rates (syllables per second) of read speech.
NORMAL_RATE = {
    "en": 6.19, "fr": 7.18, "de": 5.97, "it": 6.99, "es": 7.82, "zh": 5.18, "vi": 5.22,
    "pt": 6.9, "pl": 6.0, "la": 6.5, "tl": 6.8, "ko": 7.0, "el": 6.6,
}
# Prayer recited aloud, pauses included, runs at about this share of that rate.
PRAYER_FACTOR = 0.70

# CER thresholds on the fair fold. Whisper itself is weaker on some languages (its
# error on HUMAN Greek and Filipino read speech is 13-17% WER in ZTTS2), so those
# allow more; the bake-off records how the chosen voices actually do.
PASS_CER = {"el": 0.08, "la": 0.10, "tl": 0.06, "vi": 0.05, "zh": 0.05, "ko": 0.05, "pl": 0.04}
MARGINAL_CER = {"el": 0.18, "la": 0.22, "tl": 0.14, "vi": 0.12, "zh": 0.12, "ko": 0.12, "pl": 0.10}
DEFAULT_PASS = 0.035
DEFAULT_MARGINAL = 0.10

PACE_OK = (0.72, 1.40)
PACE_MARGINAL = (0.58, 1.70)
# A clip of one to three syllables ("Dos.", "Amén.", "Let us pray.") is said in one breath,
# and its last syllable is drawn out the way every speaker draws out the end of an
# utterance; a heavy syllable (tres, seis) and the hiss of a final s add to it. In a long
# clip that one syllable is lost in the average; here it is a third of the clip or more.
# By syllable rate alone, the 24 takes of the Spanish numerals "dos", "tres" and "seis"
# (measured 2026-11-21; Whisper heard the right word in every one) were 0.25-0.60x the
# voice's pace, and 23 failed. So a short clip's norm is a range, from its syllables at the
# voice's pace to the same with the last syllable counted twice: a take inside the range is
# at the voice's pace, a slower one is measured against its slow end (then 19 of those 24
# takes pass, 4 are marginal and a 0.77 s "seis" still fails), and a faster one is judged
# as before. Only pace changes: the words, silences, tail and extra words are judged alike.
# The allowance is for a drawn-out syllable only: on a clip this short, pace is the one check
# that sees sound Whisper did not write down (a murmur after the word, a gap inside it, both
# under the silence and tail limits), so a take with any silence inside or more than
# SHORT_CLIP_TAIL_S of untranscribed tail is judged as before (the 24 numeral takes had no
# silence and tails of 0.04-0.27 s).
SHORT_CLIP_SYLLABLES = 3
SHORT_CLIP_TAIL_S = 0.3
SILENCE_MARGINAL_S = 1.4
SILENCE_FAIL_S = 2.4
TAIL_GAP_S = 0.9


# --------------------------------------------------------------------------- #
# Folding                                                                     #
# --------------------------------------------------------------------------- #

KEEP_DIACRITICS = {"pl", "vi"}
NO_SPACES = {"zh", "ko", "el", "la", "tl"}  # word boundaries are not heard; ASR guesses them


def _strip_marks(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def _letters_only(s: str) -> str:
    s = re.sub(r"[^\w\s]|_", " ", s)
    s = re.sub(r"\d", " ", s)
    return re.sub(r"\s+", " ", s).strip()


_GREEK_SEQ = [
    ("ου", "u"), ("αι", "e"), ("ει", "i"), ("οι", "i"), ("υι", "i"),
    ("αυ", "av"), ("ευ", "ev"), ("ηυ", "iv"),
    ("γγ", "g"), ("γκ", "g"), ("μπ", "b"), ("ντ", "d"), ("τσ", "c"), ("τζ", "j"),
]
_GREEK_ONE = {
    "α": "a", "ε": "e", "η": "i", "ι": "i", "υ": "i", "ο": "o", "ω": "o",
    "β": "v", "γ": "q", "δ": "D", "ζ": "z", "θ": "T", "κ": "k", "λ": "l", "μ": "m",
    "ν": "n", "ξ": "ks", "π": "p", "ρ": "r", "σ": "s", "ς": "s", "τ": "t", "φ": "f",
    "χ": "x", "ψ": "ps",
}


def greek_phonemes(text: str) -> str:
    """Modern Greek pronunciation as a rough phoneme string (one letter per sound)."""
    t = unicodedata.normalize("NFD", text.lower())
    # A diaeresis on the second vowel, or an accent on the first (τσάι), splits a
    # digraph: keep a marker "|", drop every other mark.
    t = t.replace("̈", "|")
    t = re.sub("([αεοη])́([ιυ])", r"\1|\2", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = unicodedata.normalize("NFC", t)
    out = []
    i = 0
    while i < len(t):
        two = t[i : i + 2]
        hit = next((v for k, v in _GREEK_SEQ if two == k), None)
        if hit is not None and not (i + 2 < len(t) and t[i + 2] == "|"):
            out.append(hit)
            i += 2
            continue
        ch = t[i]
        if ch == "|":
            i += 1
            continue
        out.append(_GREEK_ONE.get(ch, ch if ch.isspace() else ""))
        i += 1
    s = "".join(out)
    s = re.sub(r"(.)\1+", r"\1", s)  # no gemination in modern Greek
    return re.sub(r"\s+", " ", s).strip()


# Korean liaison (연음): a final consonant before a syllable that starts with the silent
# ㅇ is pronounced as that syllable's first sound (이를 and 일을 sound the same).
_JONG_TO_CHO = {1: (0, 0), 2: (0, 1), 3: (1, 9), 4: (0, 2), 5: (4, 12), 6: (4, 2), 7: (0, 3), 8: (0, 5),
                9: (8, 0), 10: (8, 6), 11: (8, 7), 12: (8, 9), 13: (8, 16), 14: (8, 17), 15: (0, 5),
                16: (0, 6), 17: (0, 7), 18: (17, 10), 19: (0, 9), 20: (0, 10), 22: (0, 12), 23: (0, 14),
                24: (0, 15), 25: (0, 16), 26: (0, 17)}


def korean_liaison(text: str) -> str:
    syl = [ord(c) - 0xAC00 for c in text if "\uac00" <= c <= "\ud7a3"]
    parts = [[s // 588, (s % 588) // 28, s % 28] for s in syl]
    for i in range(len(parts) - 1):
        cho, _, jong = parts[i]
        nxt = parts[i + 1]
        if jong == 0 or nxt[0] != 11:
            continue
        if jong == 27:  # ㅎ is silent before a vowel
            parts[i][2] = 0
        elif jong in _JONG_TO_CHO:
            keep, move = _JONG_TO_CHO[jong]
            parts[i][2] = keep
            nxt[0] = move
    return "".join(chr(0xAC00 + (a * 21 + b) * 28 + c) for a, b, c in parts)


def tagalog_spelling(text: str) -> str:
    """Spellings Tagalog says alike: the particle ng = nang; Spanish-origin letters
    (Jesus = Hesus, Cristo = Kristo, Virgen = Birhen)."""
    words = ["nang" if w == "ng" else w for w in text.split()]
    t = " ".join(words)
    for a, b in (("j", "h"), ("qu", "k"), ("c", "k"), ("v", "b"), ("z", "s"), ("ñ", "ny"), ("ll", "ly"), ("f", "p")):
        t = t.replace(a, b)
    return t


def northern_vietnamese(text: str) -> str:
    """Spellings the Hanoi accent (the voices' accent) says alike: tr = ch, x = s,
    d = gi = r. Tones and vowels stay, so a wrong tone still counts."""
    def one(w: str) -> str:
        lw = w
        for a, b in (("tr", "ch"), ("gi", "d"), ("r", "d"), ("x", "s")):
            if lw.startswith(a) and not (a == "gi" and len(lw) == 2):
                return b + lw[len(a):]
        return lw
    return " ".join(one(w) for w in text.split())


def _pinyin(text: str) -> str:
    from pypinyin import Style, lazy_pinyin

    text = text.replace("阿们", "阿门")  # the Catholic spelling of Amen, said ā mén
    han = "".join(c for c in text if "㐀" <= c <= "鿿" or "豈" <= c <= "﫿")
    return " ".join(lazy_pinyin(han, style=Style.TONE3, neutral_tone_with_five=True, errors="ignore"))


def _latin_letters(s: str) -> str:
    """Latin folded the way Ecclesiastical pronunciation merges sounds."""
    s = _strip_marks(s.lower())
    s = s.replace("æ", "e").replace("œ", "e").replace("ae", "e").replace("oe", "e")
    s = s.replace("j", "i").replace("v", "u").replace("y", "i").replace("k", "c")
    s = s.replace("ph", "f").replace("th", "t").replace("ch", "c").replace("h", "")
    s = s.replace("w", "u")
    s = re.sub(r"([cg])i(?=e)", r"\1", s)  # Italian-style spelling of the same sound: cielo = celo
    s = re.sub(r"([b-df-hj-np-tv-z])\1", r"\1", s)  # Whisper spells geminates at random
    return _letters_only(s)


# The recogniser abbreviates words a clip says in full ("St. Peter" for "Saint Peter",
# "Ste Marie", "St. Michael" for "Sankt Michael", "Sta. María"). Each is read as its
# word on both sides, so a take is never failed for Whisper's spelling; only forms
# that stand for one word in prayer are listed (Polish "św." or German "hl." do not:
# they stand for every case of the word).
ABBREVIATIONS: dict[str, list[tuple[str, str]]] = {
    "en": [(r"\bSts\.?(?=\s)", "Saints"), (r"\bSt\.?(?=\s)", "Saint"), (r"\bMt\.?(?=\s)", "Mount")],
    "fr": [
        (r"\bStes\b\.?", "Saintes"),
        (r"\bSte\b\.?", "Sainte"),
        (r"\bSts\b\.?", "Saints"),
        (r"\bSt\b\.?", "Saint"),
    ],
    "de": [(r"\bSt\.(?=\s)", "Sankt")],
    "es": [(r"\bSto\.(?=\s)", "Santo"), (r"\bSta\.(?=\s)", "Santa")],
    "pt": [(r"\bSto\.(?=\s)", "Santo"), (r"\bSta\.(?=\s)", "Santa")],
    "tl": [(r"\bSto\.(?=\s)", "Santo"), (r"\bSta\.(?=\s)", "Santa")],
}


# English the recogniser spells differently from a prayer book, with the same sound:
# the vocative "O" it writes "Oh", "for ever" it writes "forever", and British "-our"
# ("honour", "Saviour") it writes American. Read alike on both sides.
EN_SAME_SOUND: list[tuple[str, str]] = [
    (r"\boh\b", "o"),
    (r"\bfor ever\b", "forever"),
    (r"\b([a-z]{3,})our\b", r"\1or"),
]


def expand_abbreviations(text: str, lang: str) -> str:
    """`text` with the recogniser's abbreviations written out (see ABBREVIATIONS)."""
    for pattern, word in ABBREVIATIONS.get(lang, []):
        text = re.sub(pattern, word, text)
    return text


def _fold_spaced(text: str, lang: str, strict: bool) -> str:
    """fold() with one space between words, in every language (see fold_words)."""
    text = expand_abbreviations(text, lang)
    try:
        t = normalize_for_voice(text, lang)
    except Exception:
        t = text
    t = unicodedata.normalize("NFKC", t).lower()
    if lang == "en":
        for pattern, same in EN_SAME_SOUND:
            t = re.sub(pattern, same, t)
    if lang == "zh":
        return _pinyin(t) if not strict else " ".join(re.findall(r"[㐀-鿿]", t))
    if lang == "ko":
        return " ".join(w for w in (re.sub(r"[^가-힣]", "", w) for w in t.split()) if w)
    if lang == "el":
        if strict:
            return _letters_only(_strip_marks(t))
        return greek_phonemes(_letters_only(t))
    if lang == "la":
        return _latin_letters(t)
    if lang == "vi" and not strict:
        t = northern_vietnamese(_letters_only(t))
    if lang == "tl" and not strict:
        t = tagalog_spelling(_letters_only(_strip_marks(t)))
    t = t.replace("ß", "ss").replace("æ", "ae").replace("œ", "oe")
    if not strict and lang not in KEEP_DIACRITICS:
        t = _strip_marks(t)
    return _letters_only(t)


def fold(text: str, lang: str, *, strict: bool = False) -> str:
    """The text as the CER compares it (see the module docstring)."""
    t = _fold_spaced(text, lang, strict)
    if lang == "ko":
        t = t.replace(" ", "")
        return t if strict else korean_liaison(t)
    return t.replace(" ", "") if lang in NO_SPACES else t


def fold_words(text: str, lang: str, *, strict: bool = False) -> list[str]:
    """The text as fold() reads it, word by word, also in the languages whose fold drops the
    spaces (NO_SPACES): there the words of the normalised text, each folded alike, so that
    joined they are fold()'s string. Korean gives the Hangul of each word, without the liaison
    (it moves a sound across a word boundary); Chinese, written without spaces, gives its
    characters (strict) or their syllables in Pinyin."""
    return _fold_spaced(text, lang, strict).split()


SYLLABLE_LANGS = {"vi", "zh"}  # a wrong tone is a wrong word: count whole syllables
PASS_SER = {"vi": 0.06, "zh": 0.06}  # Whisper itself mishears ~4% of human Vietnamese words
MARGINAL_SER = {"vi": 0.15, "zh": 0.15}


def syllables_of(text: str, lang: str) -> list[str]:
    """The text as syllables (with tones) for the syllable error rate of vi and zh."""
    if lang == "zh":
        return _pinyin(text).split()
    t = unicodedata.normalize("NFC", text).lower().replace("giêsu", "giê su")
    return fold(t, lang).replace("-", " ").split()


def ser(ref: str, hyp: str, lang: str) -> float:
    r, h = syllables_of(ref, lang), syllables_of(hyp, lang)
    if not r:
        return 0.0 if not h else 1.0
    return edit_distance(r, h) / len(r)


def edit_distance(a, b) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(ref: str, hyp: str) -> float:
    if not ref:
        return 0.0 if not hyp else 1.0
    return edit_distance(ref, hyp) / len(ref)


def word_diff(ref: str, hyp: str) -> list[str]:
    """Human-readable differences between two folded strings, word by word."""
    r, h = ref.split(), hyp.split()
    if len(r) <= 1 and len(h) <= 1:  # unspaced folds (zh, ko, el): compare in chunks
        r, h = list(ref), list(hyp)
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=r, b=h, autojunk=False).get_opcodes():
        if op == "equal":
            continue
        a = "".join(r[i1:i2]) if len(r) == len(ref) else " ".join(r[i1:i2])
        b = "".join(h[j1:j2]) if len(h) == len(hyp) else " ".join(h[j1:j2])
        out.append(f"{op}:{a!r}->{b!r}")
    return out[:12]


def end_insertions(ref: str, hyp: str) -> tuple[int, int]:
    """Characters Whisper heard before the first / after the last matched character."""
    if not ref or not hyp:
        return 0, len(hyp)
    sm = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size > 0]
    if not blocks:
        return 0, len(hyp)
    lead = blocks[0].b - blocks[0].a if blocks[0].b > blocks[0].a else 0
    last = blocks[-1]
    ref_left = len(ref) - (last.a + last.size)
    hyp_left = len(hyp) - (last.b + last.size)
    return max(0, lead), max(0, hyp_left - ref_left)


# --------------------------------------------------------------------------- #
# Repeated words                                                              #
# --------------------------------------------------------------------------- #

# A word the text says N times running must be heard N times, whatever the CER. Qwen3-TTS
# drops one of a run: the female English voice said "Ave, Ave, Ave, Maria! Ave, Ave, Ave,
# Maria!" with five Aves in every whole take (the voice, not Whisper: that half lasted 1.5 s,
# not 2.1 s), and in a verse one Ave is CER 0.033, under the pass line, so two clips were made
# with five ("Immaculate Mary, your praises we sing", "In heaven the blessed"). So:
#   - a run is the same word in the text's STRICT fold (fold_words), so only a word said again
#     counts: Spanish "para mí, mi Jesús" is two words, though the fair fold reads both "mi";
#   - the transcript is lined up with the text in the FAIR fold, word by word (word_alignment),
#     so Whisper's case, punctuation, accents and Greek spelling of a sound are not a word lost
#     ("AVE", "Avé", "άγειος" for "ἅγιος");
#   - a copy not lined up with the same word may still have been said: the run's copies are
#     looked for in the transcript between the nearest words lined up around the run, and
#     the larger of two counts there is credited: the words that no word of the text accounts
#     for (a copy Whisper spelled otherwise, "Santus" for "Sanctus", "Jesús" for "Jesu", is
#     judged by the CER like any misheard word), or the times the word itself is written there,
#     inside other words too ("Avemaria", "aveave": a copy Whisper joined to the next word lost
#     no copy). The two are not added, so a gap holding both kinds can read short. Letters
#     alone are no copy: Whisper wrote the two drawn-out Aves the male voice said in each half
#     of a verse's refrain as "Eveveve, eveve" (12 letters, enough for three), and that take
#     said four Aves, not six.
#     Rare false fails, each only another take, never a clip kept with a copy missing: a copy
#     both joined to another and spelled otherwise ("santussantus"); one copy spelled otherwise
#     beside one joined to a word ("Ava, ave, Avemaria"); the refrain's two halves sharing one
#     gap. None was seen in the 386 real transcripts checked.
# Chinese is lined up by character, not by its Pinyin, which reads a character two ways in two
# words; Korean by its words between spaces (fold_words).
# A run is three copies or more. Whisper itself drops one of a word said twice, as a speaker's
# stumble ("I, I have"), and collapses a sentence said twice in a long litany: judged again on
# 2026-11-21, of the 88 stored clips that say a word twice running it wrote "But all that is" for
# "But all, all that is" and "but I have used it" for "but I, I have used it", where the same
# audio cut shorter has both copies; and it heard 7 of the 10 sentences of a Spanish litany
# whose voice had said 9. Of the 15 stored clips with a run of three (Holy, Ave, Santo, Sanctus,
# Hagios; Jesu four times) it heard every copy in 13; the other 2 are the verses above, which
# the voice made short.
REPEAT_MIN = 3


def repeat_runs(words: Sequence[str], least: int = REPEAT_MIN) -> list[tuple[int, int]]:
    """[start, end) of each run of one word `least` times or more in a row in `words`."""
    runs, i = [], 0
    while i < len(words):
        j = i + 1
        while j < len(words) and words[j] == words[i]:
            j += 1
        if j - i >= least:
            runs.append((i, j))
        i = j
    return runs


def word_alignment(a: Sequence[str], b: Sequence[str]) -> dict[int, int]:
    """The words of `a` lined up with the same word of `b`, as {index in a: index in b}: an
    alignment of the fewest edits (a word left out, put in or changed), and of those the one
    that lines up the most words, taking a word the same on both sides as early as it can, so a
    copy `b` lacks is the run's last one, beside what follows. difflib's matcher lines up the
    longest stretch first: where Whisper wrote the last word of the bare refrain's first half
    otherwise ("Mariah", "Avemaria"), it lined up the text's first half with the transcript's
    second and found the whole second half lost. The most words: a word Whisper wrote that the
    text's fold has not (a Latin "O" in a Greek prayer, heard as Greek "Ω") is one put in, not a
    chain of words changed that leaves the word after it unmatched."""
    n, m = len(a), len(b)

    def edit(rest: tuple[int, int]) -> tuple[int, int]:  # one edit more than the rest's
        return rest[0] + 1, rest[1]

    def lined_up(rest: tuple[int, int]) -> tuple[int, int]:  # one word lined up more
        return rest[0], rest[1] - 1

    # best[i][j]: (edits, -words lined up) of the best alignment of a[i:] with b[j:]
    best = [[(0, 0)] * (m + 1) for _ in range(n + 1)]
    for i in range(n, -1, -1):
        for j in range(m, -1, -1):
            if i == n or j == m:
                best[i][j] = ((n - i) + (m - j), 0)
                continue
            here = min(edit(best[i + 1][j + 1]), edit(best[i + 1][j]), edit(best[i][j + 1]))
            best[i][j] = min(here, lined_up(best[i + 1][j + 1])) if a[i] == b[j] else here
    lined: dict[int, int] = {}
    i = j = 0
    while i < n and j < m:
        here = best[i][j]
        if a[i] == b[j] and here == lined_up(best[i + 1][j + 1]):
            lined[i] = j
            i, j = i + 1, j + 1
        elif here == edit(best[i + 1][j + 1]):  # a word changed
            i, j = i + 1, j + 1
        elif here == edit(best[i + 1][j]):  # a word of `a` left out
            i += 1
        else:  # a word put in
            j += 1
    return lined


def copies_in(written: str, word: str) -> int:
    """How many times `word` stands in the one word `written`, overlaps counted: the Latin fold
    writes a doubled consonant once, so two copies of "sanctus" joined fold to "sanctusanctus".
    Word by word, never across two: a copy Whisper split in two is a word left over already, and
    a count across two words would find "ave" in "a very"."""
    return sum(1 for i in range(len(written) - len(word) + 1) if written.startswith(word, i)) if word else 0


def dropped_repeats(ref_text: str, hyp_text: str, lang: str) -> list[tuple[str, int, int]]:
    """Each run of one word said N times in `ref_text` that the transcript `hyp_text` has fewer
    times: (the word as the strict fold writes it, times heard, N). See REPEAT_MIN."""
    by_character = lang == "zh"
    named = fold_words(ref_text, lang, strict=True)
    ref = fold_words(ref_text, lang, strict=by_character)
    hyp = fold_words(hyp_text, lang, strict=by_character)
    if len(named) != len(ref):
        # The folds split the text otherwise (2 Greek clips write a word in Latin letters, which
        # the phonemic fold drops): the runs are those of the fold lined up.
        named = ref
    runs = repeat_runs(named)
    if not runs:
        return []
    lined = word_alignment(ref, hyp)
    dropped = []
    for start, end in runs:
        heard = sum(1 for i in range(start, end) if i in lined)
        lost = (end - start) - heard
        if lost:
            # Every copy Whisper wrote is in the transcript between the nearest words lined up
            # around the run, wherever the alignment left a gap or a word written otherwise.
            before = max((i for i in lined if i < start), default=None)
            after = min((i for i in lined if i >= end), default=None)
            lo = 0 if before is None else before + 1
            hi = len(ref) if after is None else after
            j_lo = 0 if before is None else lined[before] + 1
            j_hi = len(hyp) if after is None else lined[after]
            taken = {lined[i] for i in range(start, end) if i in lined}
            free = [hyp[j] for j in range(j_lo, j_hi) if j not in taken]
            # The text's other words there, none of them lined up: what the transcript has for
            # them is not a copy.
            others = ref[lo:start] + ref[end:hi]
            word = ref[start]
            words_left = len(free) - len(others)
            written = sum(copies_in(w, word) for w in free) - sum(copies_in(w, word) for w in others)
            heard += max(0, min(lost, max(words_left, written)))
        if heard < end - start:
            dropped.append((named[start], heard, end - start))
    return dropped


# --------------------------------------------------------------------------- #
# Syllables and pitch                                                         #
# --------------------------------------------------------------------------- #

_VOWELS = "aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüýÿąęœ"

# Latin words English prayers keep, whose final e is said ("A-ve", "Do-mi-ne"). The English
# silent-e rule in estimate_syllables would count "Ave" as one syllable, like "have": the refrain
# "Ave, Ave, Ave, Maria! Ave, Ave, Ave, Maria!" read as 10 syllables (16 now), so its takes read
# as 0.5-0.8x the voice's pace, and a take of the male voice that said every word as 0.46x, a
# fail (0.74x with 16, a pass). Taken from the English clips (all 6,302 distinct texts,
# 2026-11-21): Ave (5 clips, 20 times), Domine and Miserere (6 clips each) and Parce (3); Kyrie,
# Christe, Ecce and Sancte, the same kind of Latin in other English prayers; and the words
# ending in e of the Latin that 13 English clips quote ("Sit nobis nomen Mariae mel in ore,
# melos in aure, et jubilus in corde"; the O Antiphons). It raises the count of 26 clips and
# lowers none. Left to the rule: Latin words that are also English words with a silent e
# (salve, pace, ore, fine, and mane: the 2 clips that say "Mane nobiscum" count 88 and 75
# syllables where they say 89 and 76, too little to move their pace).
EN_LATIN_FINAL_E = frozenset({
    "ave", "domine", "miserere", "parce", "kyrie", "christe", "ecce", "sancte",
    "aeternae", "aure", "averte", "confige", "corde", "discrimine", "flammae", "igne", "infirmitate",
    "justitiae", "lapisque", "libertate", "mariae", "patre", "prudentiae", "suaviterque", "tardare",
    "timore", "usque", "utraque", "voluntate",
})


def estimate_syllables(text: str, lang: str) -> int:
    t = unicodedata.normalize("NFC", normalize_for_voice(text, lang) if lang != "la" else text).lower()
    if lang == "zh":
        return sum(1 for c in t if "㐀" <= c <= "鿿")
    if lang == "ko":
        return sum(1 for c in t if "가" <= c <= "힣")
    if lang == "vi":
        return len(re.findall(r"[^\W\d_]+", t))
    if lang == "el":
        ph = greek_phonemes(t)
        return len(re.findall(r"[aeiou]", ph))
    if lang == "la":
        n = 0
        for w in re.findall(r"[^\W\d_]+", t):
            try:
                n += max(1, len(latin.syllables(w)))
            except Exception:
                n += max(1, len(re.findall(f"[{_VOWELS}]+", w)))
        return n
    n = 0
    for w in re.findall(r"[^\W\d_]+", t):
        k = len(re.findall(f"[{_VOWELS}]+", w))
        if (
            lang == "en" and k > 1 and w.endswith("e") and not w.endswith(("le", "ee", "ye"))
            and w not in EN_LATIN_FINAL_E
        ):
            k -= 1
        if lang == "en" and k > 1 and w.endswith("ed") and not w.endswith(("ted", "ded")):
            k -= 1
        if lang == "fr" and k > 1 and re.search(r"(e|es|ent)$", w):
            k -= 1
        n += max(1, k)
    return n


def pitch_stats(audio: np.ndarray, sr: int) -> dict:
    """Median F0 (Hz), spread in semitones (robust), and voiced share of the speech."""
    x = A.resample(audio, sr, 16000)
    sr = 16000
    frame, hop = int(0.040 * sr), int(0.010 * sr)
    lo, hi = int(sr / 400), int(sr / 65)
    db = A.frame_db(x, sr)
    thr = A.speech_threshold(db) + 10
    f0s = []
    voiced = total = 0
    for k, start in enumerate(range(0, len(x) - frame, hop)):
        seg = x[start : start + frame]
        level = 20 * math.log10(float(np.sqrt(np.mean(seg**2))) + 1e-12)
        if level < thr:
            continue
        total += 1
        seg = seg - seg.mean()
        n = 1 << (2 * frame - 1).bit_length()
        spec = np.fft.rfft(seg, n)
        ac = np.fft.irfft(spec * np.conj(spec))[: frame]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.55:
            f0s.append(sr / lag)
            voiced += 1
    if len(f0s) < 5:
        return {"f0_median_hz": None, "f0_spread_st": None, "voiced_share": 0.0}
    f = np.array(f0s)
    med = float(np.median(f))
    st = 12 * np.log2(f / med)
    spread = float((np.percentile(st, 90) - np.percentile(st, 10)) / 2.56)
    return {
        "f0_median_hz": round(med, 1),
        "f0_spread_st": round(spread, 2),
        "voiced_share": round(voiced / max(1, total), 2),
    }


# --------------------------------------------------------------------------- #
# Whisper                                                                     #
# --------------------------------------------------------------------------- #


def transcribe(audio: np.ndarray, sr: int, lang: str, *, word_timestamps: bool = True) -> dict:
    import mlx_whisper

    x = A.resample(audio, sr, 16000)
    return mlx_whisper.transcribe(
        x,
        path_or_hf_repo=WHISPER_REPO,
        language=lang,
        temperature=(0.0, 0.2, 0.4),
        condition_on_previous_text=False,
        word_timestamps=word_timestamps,
        verbose=None,
    )


def last_word_end(result: dict) -> Optional[float]:
    ends = [w["end"] for s in result.get("segments", []) for w in s.get("words", []) if "end" in w]
    if ends:
        return float(max(ends))
    segs = result.get("segments", [])
    return float(segs[-1]["end"]) if segs else None


# --------------------------------------------------------------------------- #
# Evaluation                                                                  #
# --------------------------------------------------------------------------- #


@dataclass
class QAResult:
    lang: str
    verdict: str
    score: float
    cer: float  # the fair fold (see module docstring)
    cer_strict: float
    ser: Optional[float]  # syllable error rate (vi, zh), None elsewhere
    transcript: str
    reference: str
    diff: list[str]
    duration_s: float
    speech_s: float
    syllables: int
    syl_per_s: float
    pace_ratio: float
    max_silence_s: float
    tail_gap_s: Optional[float]
    extra_start: int
    extra_end: int
    lufs: float
    true_peak: float
    f0_median_hz: Optional[float]
    f0_spread_st: Optional[float]
    reasons: list[str] = field(default_factory=list)
    # True when another take could help: wrong words or a broken take. A voice's own
    # steady pace is not a reason to re-take (every take of a locked voice shares it).
    retake: bool = False
    # True when the take failed on its words: a character or syllable error over the marginal
    # limit, a word said fewer times running than the text says it (dropped_repeats), or no
    # speech recognised. Its pace, a silence and a tail are not its words, nor the check of extra
    # words at an end, though those add to its error like any word not in the text (engine.
    # words_wrong reads this and words_marginal, to say a clip again a sentence at a time).
    words_failed: bool = False
    # True when its character or syllable error is between the pass and the marginal limits: the
    # words a little off, as when a sentence of a long litany is missing (CER 0.099).
    words_marginal: bool = False

    def to_dict(self) -> dict:
        d = asdict(self)
        for k, v in d.items():
            if isinstance(v, float):
                d[k] = round(v, 4)
        return d


def latin_reference(text: str) -> tuple[str, str]:
    """(Whisper language, reference text) for a Latin clip under LATIN_CHECK."""
    if LATIN_CHECK == "it":
        return "it", latin.to_respelling(text)
    return "la", text


def evaluate(
    audio: np.ndarray,
    sr: int,
    text: str,
    lang: str,
    *,
    check: Optional[str] = None,
    pace_ref: Optional[float] = None,
    words_verified: Optional[float] = None,
) -> QAResult:
    """QA of a FINISHED take (trimmed, normalised) against the exact words `text`.

    `pace_ref`: the voice's own usual pace ratio (measured in the bake-off and kept in
    voices/registry.json). When given, pace is judged against the voice's own norm, so
    only a take that is stretched or rushed compared with the voice itself is flagged;
    whether the voice's pace is natural was settled when the voice was chosen.

    `words_verified`: the take's words were already heard right piece by piece, and this is
    their combined error (the per-sentence route, when every sentence passed its own check).
    Whisper on a whole joined clip collapses a repeated sentence (a litany's "Señor, ten piedad
    de nosotros." said twice: ten sentences passed one by one, and the joined clip was heard as
    CER 0.325) and stops early, so the words, the tail and extra words are not judged again;
    what the audio itself shows (pace over its sound, silences inside it) still is.
    """
    check = check or (LATIN_CHECK if lang == "la" else None)
    if lang == "la":
        wl, ref_text = ("it", latin.to_respelling(text)) if check == "it" else ("la", text)
        fold_lang = "it" if check == "it" else "la"
    else:
        wl, ref_text, fold_lang = WHISPER_LANG[lang], text, lang

    result = transcribe(audio, sr, wl)
    hyp_text = result.get("text", "").strip()
    ref, hyp = fold(ref_text, fold_lang), fold(hyp_text, fold_lang)
    ref_s, hyp_s = fold(ref_text, fold_lang, strict=True), fold(hyp_text, fold_lang, strict=True)
    c = cer(ref, hyp)
    c_strict = cer(ref_s, hyp_s)
    s_err = ser(ref_text, hyp_text, lang) if lang in SYLLABLE_LANGS else None
    if words_verified is not None:  # judged sentence by sentence already (see the docstring)
        if s_err is not None:
            s_err = words_verified
        else:
            c = words_verified

    duration = len(audio) / sr
    start, end = A.speech_bounds(audio, sr)
    speech = max(1e-3, (end - start) / sr)
    syl = estimate_syllables(text, lang)
    rate = syl / speech
    pace_ratio = rate / (NORMAL_RATE.get(lang, 6.5) * PRAYER_FACTOR)
    pace_judged = pace_ratio / pace_ref if pace_ref else pace_ratio
    sil = A.silences(audio, sr)
    max_sil = sil[0][1] if sil else 0.0
    lw = last_word_end(result) if words_verified is None else None
    tail_gap = (end / sr - lw) if lw is not None else None
    if (
        0 < syl <= SHORT_CLIP_SYLLABLES
        and pace_judged < 1.0
        and max_sil == 0.0
        and tail_gap is not None
        and tail_gap <= SHORT_CLIP_TAIL_S
    ):  # its last syllable drawn out, and nothing else
        pace_judged = min(1.0, pace_judged * (syl + 1) / syl)
    extra_start, extra_end = end_insertions(ref, hyp) if words_verified is None else (0, 0)
    pitch = pitch_stats(audio, sr)

    reasons: list[str] = []
    fail = False
    marginal = False
    retake = False
    words_failed = words_marginal = False
    pass_cer = PASS_CER.get(lang, DEFAULT_PASS)
    marg_cer = MARGINAL_CER.get(lang, DEFAULT_MARGINAL)
    err = c
    if s_err is not None:  # tonal languages are judged by whole syllables
        err, pass_cer, marg_cer = s_err, PASS_SER[lang], MARGINAL_SER[lang]
    what = "the voice's own pace" if pace_ref else "normal"
    if end <= start or (not hyp and words_verified is None):
        reasons.append("no speech recognised")
        fail = retake = words_failed = True
    what_err = "ser" if s_err is not None else "cer"
    if words_verified is not None:
        pass  # the words were judged sentence by sentence (see the docstring)
    elif err > marg_cer:
        reasons.append(f"{what_err} {err:.3f} > {marg_cer}")
        fail = retake = words_failed = True
    elif err > pass_cer:
        reasons.append(f"{what_err} {err:.3f} > {pass_cer}")
        marginal = retake = words_marginal = True
    repeats = dropped_repeats(ref_text, hyp_text, fold_lang) if hyp and words_verified is None else []
    for word, heard, times in repeats:
        reasons.append(f"{what_err} {err:.3f}: said {word!r} {heard} {'time' if heard == 1 else 'times'}, not {times}")
        fail = retake = words_failed = True
    if not (PACE_MARGINAL[0] <= pace_judged <= PACE_MARGINAL[1]):
        reasons.append(f"pace {pace_judged:.2f}x {what}")
        fail = retake = True
    elif not (PACE_OK[0] <= pace_judged <= PACE_OK[1]):
        reasons.append(f"pace {pace_judged:.2f}x {what}")
        marginal = True
        retake = retake or bool(pace_ref)
    if max_sil > SILENCE_FAIL_S:
        reasons.append(f"silence {max_sil:.1f}s inside")
        fail = retake = True
    elif max_sil > SILENCE_MARGINAL_S:
        reasons.append(f"silence {max_sil:.1f}s inside")
        marginal = retake = True
    if tail_gap is not None and tail_gap > TAIL_GAP_S:
        reasons.append(f"untranscribed tail {tail_gap:.1f}s")
        fail = retake = True
    long_extra = max(8, int(0.12 * len(ref)))
    if extra_end > long_extra or extra_start > long_extra:
        reasons.append(f"extra words (start {extra_start}, end {extra_end} chars)")
        fail = retake = True

    score = 100 * (s_err / 3 if s_err is not None else c) + 8 * abs(math.log(max(pace_judged, 1e-3)))
    score += 3 * max(0.0, max_sil - 1.0)
    if tail_gap is not None:
        score += 4 * max(0.0, tail_gap - 0.5)
    score += 0.2 * (extra_start + extra_end)
    if fail:
        score += 100
    elif marginal:
        score += 10

    return QAResult(
        lang=lang,
        verdict="fail" if fail else ("marginal" if marginal else "pass"),
        score=round(score, 3),
        cer=c,
        cer_strict=c_strict,
        ser=s_err,
        transcript=hyp_text,
        reference=ref_text,
        diff=word_diff(ref, hyp),
        duration_s=duration,
        speech_s=speech,
        syllables=syl,
        syl_per_s=rate,
        pace_ratio=pace_ratio,
        max_silence_s=max_sil,
        tail_gap_s=tail_gap,
        extra_start=extra_start,
        extra_end=extra_end,
        lufs=A.loudness(audio, sr),
        true_peak=A.true_peak_db(audio, sr),
        f0_median_hz=pitch["f0_median_hz"],
        f0_spread_st=pitch["f0_spread_st"],
        reasons=reasons,
        retake=retake,
        words_failed=words_failed,
        words_marginal=words_marginal,
    )
