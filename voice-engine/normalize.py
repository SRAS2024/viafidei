"""How a person reads what a prayer clip writes: digits, ordinal marks, a pope's
number and stray symbols, per language.

The website hands the engine the exact words of a clip (src/lib/pray-along/
speech-text.ts has already removed rubrics, made Greek monotonic, kept Latin in
Latin spelling and expanded English "St." and most popes' numerals). The engine may
change how words are WRITTEN so a voice says them as a person would; it never
changes which words are said. This module is that step:

  * digits become words in the clip's language (cardinals; years, gender, Korean
    counters and Chinese measure words where the language reads them differently);
  * ordinal marks become ordinal words: 1st, 1º/1ª, 1er/2e, a German "1." after an
    article or before a month, Polish years before "roku", "ika-3", "thứ 2", "1ος";
  * a Roman numeral after a capitalised name ("Juan Pablo II") becomes what the
    language says ("Juan Pablo segundo"); Greek alphabetic numerals likewise
    ("Παύλος Β΄" -> "Παύλος δεύτερος");
  * clock times ("3:00", "15h30") become words;
  * "&" and "%" become words; characters a voice would read aloud or stumble on
    (* _ # ~ | [ ] { } < > ^ = \\ ` bullets, stray slashes and a lone "+") are
    removed, keeping the words they enclosed; a psalm's mediant asterisk or a verse
    bar between words becomes a comma, the pause it marks;
  * whitespace is collapsed (and a space before "," or "." removed).

The QA step runs the same function over the speech recogniser's transcript, which
writes digits, so both sides compare as words.

normalize_for_voice is idempotent; text with nothing to normalise comes back
unchanged apart from collapsed whitespace. Pure stdlib, no I/O.

Choices made per language (where one had to be made):
  en  American: "one hundred five" (no "and"). A plain 4-digit 1100-2099 is a year
      ("nineteen seventeen", "twenty twenty-six", "two thousand five"). A lone "I"
      is never a numeral (the pronoun). After Vatican/Chapter/Psalm/Station... a
      numeral is a cardinal ("Vatican two"); after a name, "the Fifth".
  es  "veintiún mil", "un millón"; a number ending in 1 (and the hundreds) agrees
      with the next word by its ending ("una vez", "un día", "doscientas personas").
      Popes' numerals: ordinal up to X, cardinal above ("Pío doce", "Juan
      veintitrés"), the usual Spanish practice. Years are cardinals.
  fr  Traditional spelling ("vingt et un", "quatre-vingts", "deux cents", "deux
      cent un"). Regnal numerals are cardinals except Ier/Ire (premier/première);
      Roman + e ("XXe") is an ordinal. "15h30" -> "quinze heures trente".
  it  One word up to the thousands ("duemilaventisei", "centotto", "ventitré").
      Regnal numerals are ordinals all the way ("Giovanni ventitreesimo").
  de  "hundert"/"tausend" leading, "einhundert" inside ("tausendeinhundert");
      1100-1999 as a plain 4-digit number is a year ("neunzehnhundertsiebzehn").
      "Johannes Paul II." -> "Johannes Paul der Zweite": NOMINATIVE ONLY (a
      genitive or dative context is not detected). Ordinal "1." only after an
      article/preposition (der, am, zum...) or before a month name.
  pt  Brazilian: "dezesseis", "dezessete", "dezenove", "quatorze", "bilhão";
      "e" before the last group when it is < 100 or a round hundred ("dois mil e
      vinte e seis", "mil cento e um"). 1/2 and hundreds agree with the next word
      ("uma vez", "duas horas"). Popes: ordinal up to X, then cardinal ("Pio
      doze"), the usual Brazilian practice.
  pl  Cardinals in the nominative with tysiąc/tysiące/tysięcy. A year before
      "roku"/"r." is an ordinal: locative after "w" ("w tysiąc dziewięćset
      siedemnastym roku"), genitive otherwise. Regnal numerals are ordinals whose
      case follows the name's ending ("Jan Paweł Drugi", "Jana Pawła Drugiego",
      "Janowi Pawłowi Drugiemu"); feminine after Stacja/Tajemnica/Część...
      Clock times are feminine ordinals ("o piętnastej"). Other "1." left alone.
  la  Classical forms with subtraction ("duodeviginti", "undecentum"), to 999,999.
      Regnal numerals are ordinals declined by the name's ending ("Pius
      duodecimus", "Pauli sexti", "Leo quartus decimus").
  tl  Native numerals ("dalawang libo't dalawampu't anim", "apat na raan"). Popes'
      numerals use the Spanish-derived forms Filipino Catholics say ("Juan Pablo
      Segundo", "Pio Dose", "Juan Bente Tres"), spelled the Filipino way.
  vi  Northern standard: "linh", "nghìn", "mốt", "lăm"; "bốn" (not "tư") in 24.
      Popes I-IV take Sino-Vietnamese "đệ nhất/nhị/tam/tứ" ("Gioan Phaolô đệ
      nhị"); V and above plain numbers ("Bênêđictô mười sáu"). "thứ 1" -> "thứ
      nhất", "thứ 4" -> "thứ tư".
  ko  Sino-Korean by default ("이천이십육년", "요한 바오로 이세"); native Korean
      before native counters (번, 개, 명, 시, 시간, 살, 가지, 마리...): "열 번",
      "첫 번째". 개월/분/세/년/월/일 stay Sino.
  zh  "两" for a leading 2 before 千/万/亿 ("两千零二十六") and for a lone 2 before a
      measure word ("两次"), else "二"; 4-digit years before 年 digit by digit
      ("二〇二六年"); "50%" -> "百分之五十".
  el  Formal forms "επτά", "οκτώ", "εννέα"; thousands agree with χιλιάδες
      ("τρεις χιλιάδες", "διακόσιες χιλιάδες"); 1/3/4 agree with the next word's
      ending. Greek alphabetic numerals with a keraia (Β΄, ΙΔ΄) after a name are
      ordinals whose case follows the article or name.
"""

from __future__ import annotations

import re

__all__ = ["LANGS", "MAX_NUMBER", "normalize_for_voice", "ordinal", "spell_number"]

LANGS: tuple[str, ...] = ("en", "es", "fr", "it", "de", "pt", "pl", "la", "tl", "vi", "ko", "zh", "el")

#: The largest number spelled out; longer digit strings are left as written.
MAX_NUMBER = 999_999_999
_LA_MAX = 999_999

_L = r"[^\W\d_]"  # one letter, any script
_NOT_LETTER_BEFORE = r"(?<![^\W\d_])"
_NOT_LETTER_AFTER = r"(?![^\W\d_])"


# =============================================================================
# English
# =============================================================================

_EN_ONES = (
    "zero one two three four five six seven eight nine ten eleven twelve thirteen "
    "fourteen fifteen sixteen seventeen eighteen nineteen"
).split()
_EN_TENS = ("", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")


def _en_100(n: int) -> str:
    if n < 20:
        return _EN_ONES[n]
    t, u = divmod(n, 10)
    return _EN_TENS[t] + (f"-{_EN_ONES[u]}" if u else "")


def _en_1000(n: int) -> str:
    h, r = divmod(n, 100)
    parts = []
    if h:
        parts.append(f"{_EN_ONES[h]} hundred")
    if r:
        parts.append(_en_100(r))
    return " ".join(parts)


def _en_cardinal(n: int) -> str:
    if n == 0:
        return "zero"
    parts = []
    for value, name in ((10**6, "million"), (1000, "thousand")):
        q, n = divmod(n, value)
        if q:
            parts.append(f"{_en_1000(q)} {name}")
    if n:
        parts.append(_en_1000(n))
    return " ".join(parts)


_EN_ORD_IRREGULAR = {
    "one": "first",
    "two": "second",
    "three": "third",
    "five": "fifth",
    "eight": "eighth",
    "nine": "ninth",
    "twelve": "twelfth",
}


def _en_ordinal(n: int) -> str:
    words = _en_cardinal(n)
    head, sep, last = words.rpartition(" ")
    pre, hyphen, core = last.rpartition("-")
    if core in _EN_ORD_IRREGULAR:
        core = _EN_ORD_IRREGULAR[core]
    elif core.endswith("y"):
        core = core[:-1] + "ieth"
    else:
        core += "th"
    return f"{head}{sep}{pre}{hyphen}{core}"


def _en_year(n: int) -> str:
    """1100-2099 as a year: nineteen seventeen, nineteen oh five, two thousand five."""
    if 2000 <= n <= 2009:
        return _en_cardinal(n)
    hi, lo = divmod(n, 100)
    if lo == 0:
        return f"{_en_100(hi)} hundred"
    if lo < 10:
        return f"{_en_100(hi)} oh {_EN_ONES[lo]}"
    return f"{_en_100(hi)} {_en_100(lo)}"


# =============================================================================
# Spanish
# =============================================================================

_ES_0_29 = (
    "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce "
    "quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós "
    "veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve"
).split()
_ES_TENS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa"}
_ES_HUNDREDS = {
    1: "ciento",
    2: "doscientos",
    3: "trescientos",
    4: "cuatrocientos",
    5: "quinientos",
    6: "seiscientos",
    7: "setecientos",
    8: "ochocientos",
    9: "novecientos",
}


def _es_100(n: int) -> str:
    if n < 30:
        return _ES_0_29[n]
    t, u = divmod(n, 10)
    return _ES_TENS[t] + (f" y {_ES_0_29[u]}" if u else "")


def _es_1000(n: int) -> str:
    if n == 100:
        return "cien"
    h, r = divmod(n, 100)
    parts = []
    if h:
        parts.append(_ES_HUNDREDS[h])
    if r:
        parts.append(_es_100(r))
    return " ".join(parts)


def _es_apocope(words: str) -> str:
    """'uno' before a masculine noun or 'mil'/'millones': un, veintiún, treinta y un."""
    if words.endswith("veintiuno"):
        return words[: -len("veintiuno")] + "veintiún"
    if words == "uno" or words.endswith(" uno"):
        return words[:-3] + "un"
    return words


def _es_feminine(words: str) -> str:
    words = re.sub(r"ientos\b", "ientas", words)
    if words.endswith("veintiuno"):
        return words[:-1] + "a"
    if words == "uno" or words.endswith(" uno"):
        return words[:-1] + "a"
    return words


def _es_cardinal(n: int, gender: str | None = None) -> str:
    """gender None: standalone ("uno"); "m": before a masculine noun ("un"); "f": "una"."""
    if n == 0:
        return "cero"
    parts = []
    m, rest = divmod(n, 10**6)
    if m:
        parts.append("un millón" if m == 1 else f"{_es_apocope(_es_1000(m))} millones")
    k, u = divmod(rest, 1000)
    if k:
        kw = "mil" if k == 1 else f"{_es_apocope(_es_1000(k))} mil"
        if gender == "f" and k > 1:
            kw = re.sub(r"ientos\b", "ientas", kw)
        parts.append(kw)
    if u:
        uw = _es_1000(u)
        if gender == "m":
            uw = _es_apocope(uw)
        elif gender == "f":
            uw = _es_feminine(uw)
        parts.append(uw)
    return " ".join(parts)


_ES_ORD_1_10 = ("", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo")
_ES_ORD_11_19 = {
    11: "undécimo",
    12: "duodécimo",
    13: "decimotercero",
    14: "decimocuarto",
    15: "decimoquinto",
    16: "decimosexto",
    17: "decimoséptimo",
    18: "decimoctavo",
    19: "decimonoveno",
}
_ES_ORD_TENS = {
    2: "vigésimo",
    3: "trigésimo",
    4: "cuadragésimo",
    5: "quincuagésimo",
    6: "sexagésimo",
    7: "septuagésimo",
    8: "octogésimo",
    9: "nonagésimo",
}


def _es_ordinal(n: int, fem: bool = False, apocope: bool = False) -> str:
    if n <= 10:
        w = _ES_ORD_1_10[n]
    elif n < 20:
        w = _ES_ORD_11_19[n]
    elif n < 100:
        t, u = divmod(n, 10)
        w = _ES_ORD_TENS[t] + (f" {_ES_ORD_1_10[u]}" if u else "")
    elif n == 100:
        w = "centésimo"
    else:
        return _es_cardinal(n)
    if fem:
        return " ".join(x[:-1] + "a" for x in w.split())
    if apocope and (w.endswith("primero") or w.endswith("tercero")):
        return w[:-1]
    return w


_ES_FEM_WORDS = {
    "vez", "veces", "noche", "noches", "mujer", "mujeres", "madre", "madres", "imagen", "imágenes",
    "gente", "parte", "partes", "muerte", "fe", "cruz", "cruces", "luz", "paz", "voz", "voces",
    "carne", "sangre", "tarde", "tardes", "llave", "llaves", "clase", "clases", "virgen", "flor",
    "flores", "ave", "aves", "mano", "manos", "calle", "calles", "fuente", "fuentes",
}
_ES_MASC_A = {
    "día", "días", "mapa", "mapas", "problema", "problemas", "tema", "temas", "sistema", "sistemas",
    "planeta", "planetas", "poeta", "poetas", "profeta", "profetas", "papa", "papas", "idioma",
    "idiomas", "programa", "programas", "clima", "dogma", "dogmas", "drama", "dramas", "salmista",
    "evangelista", "patriarca", "patriarcas", "monarca",
}


def _es_is_fem(word: str) -> bool:
    w = word.lower()
    if w in _ES_MASC_A:
        return False
    if w in _ES_FEM_WORDS:
        return True
    return w.endswith(("a", "as", "ión", "iones", "dad", "dades", "tud", "tudes", "umbre", "umbres"))


# =============================================================================
# Portuguese (Brazil)
# =============================================================================

_PT_0_19 = (
    "zero um dois três quatro cinco seis sete oito nove dez onze doze treze quatorze "
    "quinze dezesseis dezessete dezoito dezenove"
).split()
_PT_TENS = {2: "vinte", 3: "trinta", 4: "quarenta", 5: "cinquenta", 6: "sessenta", 7: "setenta", 8: "oitenta", 9: "noventa"}
_PT_HUNDREDS = {
    1: "cento",
    2: "duzentos",
    3: "trezentos",
    4: "quatrocentos",
    5: "quinhentos",
    6: "seiscentos",
    7: "setecentos",
    8: "oitocentos",
    9: "novecentos",
}


def _pt_100(n: int) -> str:
    if n < 20:
        return _PT_0_19[n]
    t, u = divmod(n, 10)
    return _PT_TENS[t] + (f" e {_PT_0_19[u]}" if u else "")


def _pt_1000(n: int) -> str:
    if n == 100:
        return "cem"
    h, r = divmod(n, 100)
    if not h:
        return _pt_100(r)
    return _PT_HUNDREDS[h] + (f" e {_pt_100(r)}" if r else "")


def _pt_feminine(words: str) -> str:
    words = re.sub(r"\bum\b", "uma", words)
    words = re.sub(r"\bdois\b", "duas", words)
    return re.sub(r"entos\b", "entas", words)


def _pt_cardinal(n: int, fem: bool = False) -> str:
    if n == 0:
        return "zero"
    m, rest = divmod(n, 10**6)
    k, u = divmod(rest, 1000)
    chunks: list[tuple[int, str]] = []
    if m:
        chunks.append((m, "um milhão" if m == 1 else f"{_pt_1000(m)} milhões"))
    if k:
        kw = "mil" if k == 1 else f"{_pt_1000(k)} mil"
        chunks.append((k, _pt_feminine(kw) if fem else kw))
    if u:
        uw = _pt_1000(u)
        chunks.append((u, _pt_feminine(uw) if fem else uw))
    out = chunks[0][1]
    for i, (group, words) in enumerate(chunks[1:], 1):
        last = i == len(chunks) - 1
        out += f" e {words}" if last and (group < 100 or group % 100 == 0) else f" {words}"
    return out


_PT_ORD_1_9 = ("", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono")
_PT_ORD_TENS = {
    1: "décimo",
    2: "vigésimo",
    3: "trigésimo",
    4: "quadragésimo",
    5: "quinquagésimo",
    6: "sexagésimo",
    7: "septuagésimo",
    8: "octogésimo",
    9: "nonagésimo",
}


def _pt_ordinal(n: int, fem: bool = False) -> str:
    if n < 10:
        w = _PT_ORD_1_9[n]
    elif n < 100:
        t, u = divmod(n, 10)
        w = _PT_ORD_TENS[t] + (f" {_PT_ORD_1_9[u]}" if u else "")
    elif n == 100:
        w = "centésimo"
    else:
        return _pt_cardinal(n)
    return " ".join(x[:-1] + "a" for x in w.split()) if fem else w


_PT_FEM_WORDS = {
    "vez", "vezes", "noite", "noites", "mulher", "mulheres", "mãe", "mães", "imagem", "imagens",
    "gente", "parte", "partes", "morte", "fé", "cruz", "cruzes", "luz", "paz", "voz", "vozes",
    "carne", "tarde", "tardes", "chave", "chaves", "virgem", "flor", "flores", "ave", "aves", "mão",
    "mãos", "fonte", "fontes", "ordem", "ordens", "viagem", "mensagem",
}
_PT_MASC_A = {
    "dia", "dias", "mapa", "mapas", "problema", "problemas", "tema", "temas", "sistema", "sistemas",
    "planeta", "planetas", "poeta", "poetas", "profeta", "profetas", "papa", "papas", "idioma",
    "idiomas", "programa", "programas", "clima", "dogma", "dogmas", "drama", "dramas", "salmista",
    "evangelista", "patriarca", "patriarcas",
}


def _pt_is_fem(word: str) -> bool:
    w = word.lower()
    if w in _PT_MASC_A:
        return False
    if w in _PT_FEM_WORDS:
        return True
    return w.endswith(("a", "as", "ção", "ções", "são", "sões", "dade", "dades", "gem", "gens"))


# =============================================================================
# Italian
# =============================================================================

_IT_0_19 = (
    "zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici "
    "quattordici quindici sedici diciassette diciotto diciannove"
).split()
_IT_TENS = {2: "venti", 3: "trenta", 4: "quaranta", 5: "cinquanta", 6: "sessanta", 7: "settanta", 8: "ottanta", 9: "novanta"}


def _it_100(n: int) -> str:
    if n < 20:
        return _IT_0_19[n]
    t, u = divmod(n, 10)
    base = _IT_TENS[t]
    if u in (1, 8):
        base = base[:-1]  # ventuno, ventotto
    return base + (_IT_0_19[u] if u else "")


def _it_1000(n: int) -> str:
    h, r = divmod(n, 100)
    if not h:
        return _it_100(r)
    head = "cento" if h == 1 else _IT_0_19[h] + "cento"
    if not r:
        return head
    tail = _it_100(r)
    if tail.startswith("ott"):
        head = head[:-1]  # centotto, centottanta
    return head + tail


def _it_accent(word: str) -> str:
    """A compound ending in 'tre' takes the accent: ventitré, centotré, milletré."""
    return word[:-3] + "tré" if word.endswith("tre") and len(word) > 3 else word


def _it_cardinal(n: int) -> str:
    if n == 0:
        return "zero"
    parts = []
    m, rest = divmod(n, 10**6)
    if m:
        parts.append("un milione" if m == 1 else f"{_it_1000(m)} milioni")
    k, u = divmod(rest, 1000)
    low = ""
    if k:
        low = "mille" if k == 1 else _it_1000(k) + "mila"
    if u:
        low += _it_1000(u)
    if low:
        parts.append(low)
    return " ".join(_it_accent(w) for w in " ".join(parts).split())


_IT_ORD_1_10 = ("", "primo", "secondo", "terzo", "quarto", "quinto", "sesto", "settimo", "ottavo", "nono", "decimo")


def _it_ordinal(n: int, fem: bool = False) -> str:
    if n <= 10:
        w = _IT_ORD_1_10[n]
    else:
        c = _it_cardinal(n).replace(" ", "")
        if c.endswith("tré"):
            w = c[:-1] + "eesimo"  # ventitré -> ventitreesimo
        elif c.endswith("sei"):
            w = c + "esimo"  # ventiseiesimo
        elif c.endswith("mila"):
            w = c[:-4] + "millesimo"
        else:
            w = c[:-1] + "esimo"  # undicesimo, ventesimo, ventunesimo, centesimo
    return w[:-1] + "a" if fem else w


_IT_FEM_WORDS = {
    "notte", "notti", "madre", "croce", "luce", "pace", "voce", "carne", "fede", "morte", "mente",
    "gente", "parte", "chiave", "ave", "mano", "fonte", "orazione", "preghiere",
}
_IT_MASC_A = {"papa", "problema", "tema", "sistema", "pianeta", "poeta", "profeta", "programma", "clima", "dogma", "dramma", "salmista", "patriarca"}


def _it_one(next_word: str) -> str:
    w = next_word.lower()
    if w not in _IT_MASC_A and (w in _IT_FEM_WORDS or w.endswith("a")):
        return "una"
    if re.match(r"(s[^aeiouàèéìòù]|z|gn|ps|x|y|pn)", w):
        return "uno"
    return "un"


# =============================================================================
# French
# =============================================================================

_FR_0_19 = (
    "zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze "
    "quinze seize dix-sept dix-huit dix-neuf"
).split()
_FR_TENS = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}


def _fr_100(n: int) -> str:
    if n < 20:
        return _FR_0_19[n]
    t, u = divmod(n, 10)
    if t == 7:
        return "soixante et onze" if u == 1 else "soixante-" + _FR_0_19[10 + u]
    if t == 8:
        return "quatre-vingts" if u == 0 else "quatre-vingt-" + _FR_0_19[u]
    if t == 9:
        return "quatre-vingt-" + _FR_0_19[10 + u]
    base = _FR_TENS[t]
    if u == 0:
        return base
    if u == 1:
        return base + " et un"
    return base + "-" + _FR_0_19[u]


def _fr_1000(n: int) -> str:
    h, r = divmod(n, 100)
    if not h:
        return _fr_100(r)
    head = "cent" if h == 1 else _FR_0_19[h] + " cent"
    if not r:
        return head + ("s" if h > 1 else "")
    return f"{head} {_fr_100(r)}"


def _fr_cardinal(n: int) -> str:
    if n == 0:
        return "zéro"
    parts = []
    m, rest = divmod(n, 10**6)
    if m:
        parts.append("un million" if m == 1 else f"{_fr_1000(m)} millions")
    k, u = divmod(rest, 1000)
    if k:
        if k == 1:
            parts.append("mille")
        else:
            kw = _fr_1000(k)
            if kw.endswith("cents") or kw.endswith("vingts"):
                kw = kw[:-1]  # "deux cent mille", "quatre-vingt mille"
            parts.append(f"{kw} mille")
    if u:
        parts.append(_fr_1000(u))
    return " ".join(parts)


def _fr_ordinal(n: int, fem: bool = False) -> str:
    if n == 1:
        return "première" if fem else "premier"
    c = _fr_cardinal(n)
    if c.endswith("cinq"):
        return c + "uième"
    if c.endswith("neuf"):
        return c[:-1] + "vième"
    if c.endswith("et un"):
        return c[:-2] + "unième"
    if c.endswith("s") and (c.endswith("cents") or c.endswith("vingts")):
        c = c[:-1]
    if c.endswith("e"):
        return c[:-1] + "ième"
    return c + "ième"


# =============================================================================
# German
# =============================================================================

_DE_0_19 = (
    "null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn "
    "vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn"
).split()
_DE_TENS = {2: "zwanzig", 3: "dreißig", 4: "vierzig", 5: "fünfzig", 6: "sechzig", 7: "siebzig", 8: "achtzig", 9: "neunzig"}


def _de_100(n: int, final: bool = True) -> str:
    if n < 20:
        return "ein" if (n == 1 and not final) else _DE_0_19[n]
    t, u = divmod(n, 10)
    if not u:
        return _DE_TENS[t]
    return ("ein" if u == 1 else _DE_0_19[u]) + "und" + _DE_TENS[t]


def _de_1000(n: int, final: bool = True, lead: bool = True) -> str:
    h, r = divmod(n, 100)
    s = ""
    if h:
        s = "hundert" if (h == 1 and lead) else ("ein" if h == 1 else _DE_0_19[h]) + "hundert"
    if r:
        s += _de_100(r, final)
    return s


def _de_cardinal(n: int) -> str:
    if n == 0:
        return "null"
    words = []
    m, rest = divmod(n, 10**6)
    if m:
        words.append("eine Million" if m == 1 else f"{_de_1000(m, final=False)} Millionen")
    k, u = divmod(rest, 1000)
    low = ""
    if k:
        low = ("eintausend" if m else "tausend") if k == 1 else _de_1000(k, final=False) + "tausend"
    if u:
        low += _de_1000(u, final=True, lead=not (m or k))
    if low:
        words.append(low)
    return " ".join(words)


def _de_year(n: int) -> str:
    """1100-1999: neunzehnhundertsiebzehn."""
    hi, lo = divmod(n, 100)
    return _de_100(hi) + "hundert" + (_de_100(lo) if lo else "")


_DE_ORD_1_19 = (
    "",
    "erst",
    "zweit",
    "dritt",
    "viert",
    "fünft",
    "sechst",
    "siebt",
    "acht",
    "neunt",
    "zehnt",
    "elft",
    "zwölft",
    "dreizehnt",
    "vierzehnt",
    "fünfzehnt",
    "sechzehnt",
    "siebzehnt",
    "achtzehnt",
    "neunzehnt",
)


def _de_ordinal_stem(n: int) -> str:
    """'zweit', 'dritt', 'zwanzigst', 'hundertdritt': add the ending (e, en, er, es)."""
    r = n % 100
    if 1 <= r <= 19:
        prefix = _de_cardinal(n - r) if n - r else ""
        return prefix + _DE_ORD_1_19[r]
    return _de_cardinal(n) + "st"


_DE_FEM_WORDS = {
    "stunde", "woche", "nacht", "zeit", "seele", "frau", "mutter", "hand", "kirche", "messe",
    "minute", "sekunde", "jungfrau", "gnade", "sünde", "bitte", "tochter", "welt", "station",
}
_DE_NOT_FEM = {"name", "glaube", "gedanke", "friede", "wille", "junge", "ende", "auge", "erbe", "käse", "hirte", "herde"}


def _de_one(next_word: str) -> str:
    w = next_word.lower()
    if not next_word[:1].isupper():
        return "eins"
    if w in _DE_NOT_FEM:
        return "ein"
    if w in _DE_FEM_WORDS or w.endswith(("ung", "heit", "keit", "schaft", "ion", "tät", "ei", "e")):
        return "eine"
    return "ein"


# =============================================================================
# Polish
# =============================================================================

_PL_0_19 = (
    "zero jeden dwa trzy cztery pięć sześć siedem osiem dziewięć dziesięć jedenaście "
    "dwanaście trzynaście czternaście piętnaście szesnaście siedemnaście osiemnaście "
    "dziewiętnaście"
).split()
_PL_TENS = {
    2: "dwadzieścia",
    3: "trzydzieści",
    4: "czterdzieści",
    5: "pięćdziesiąt",
    6: "sześćdziesiąt",
    7: "siedemdziesiąt",
    8: "osiemdziesiąt",
    9: "dziewięćdziesiąt",
}
_PL_HUNDREDS = {
    1: "sto",
    2: "dwieście",
    3: "trzysta",
    4: "czterysta",
    5: "pięćset",
    6: "sześćset",
    7: "siedemset",
    8: "osiemset",
    9: "dziewięćset",
}
_PL_SCALES = ((10**6, ("milion", "miliony", "milionów")), (1000, ("tysiąc", "tysiące", "tysięcy")))


def _pl_1000(n: int) -> str:
    h, r = divmod(n, 100)
    parts = []
    if h:
        parts.append(_PL_HUNDREDS[h])
    if r:
        if r < 20:
            parts.append(_PL_0_19[r])
        else:
            t, u = divmod(r, 10)
            parts.append(_PL_TENS[t])
            if u:
                parts.append(_PL_0_19[u])
    return " ".join(parts)


def _pl_plural(k: int, forms: tuple[str, str, str]) -> str:
    if k == 1:
        return forms[0]
    if k % 10 in (2, 3, 4) and k % 100 not in (12, 13, 14):
        return forms[1]
    return forms[2]


def _pl_cardinal(n: int) -> str:
    if n == 0:
        return "zero"
    parts = []
    for value, forms in _PL_SCALES:
        k, n = divmod(n, value)
        if k:
            word = _pl_plural(k, forms)
            parts.append(word if k == 1 else f"{_pl_1000(k)} {word}")
    if n:
        parts.append(_pl_1000(n))
    return " ".join(parts)


_PL_ORD_1_19 = (
    "",
    "pierwszy",
    "drugi",
    "trzeci",
    "czwarty",
    "piąty",
    "szósty",
    "siódmy",
    "ósmy",
    "dziewiąty",
    "dziesiąty",
    "jedenasty",
    "dwunasty",
    "trzynasty",
    "czternasty",
    "piętnasty",
    "szesnasty",
    "siedemnasty",
    "osiemnasty",
    "dziewiętnasty",
)
_PL_ORD_TENS = {
    2: "dwudziesty",
    3: "trzydziesty",
    4: "czterdziesty",
    5: "pięćdziesiąty",
    6: "sześćdziesiąty",
    7: "siedemdziesiąty",
    8: "osiemdziesiąty",
    9: "dziewięćdziesiąty",
}
_PL_ORD_HUNDREDS = {
    1: "setny",
    2: "dwusetny",
    3: "trzechsetny",
    4: "czterechsetny",
    5: "pięćsetny",
    6: "sześćsetny",
    7: "siedemsetny",
    8: "osiemsetny",
    9: "dziewięćsetny",
}
_PL_ORD_THOUSANDS = {1: "tysięczny", 2: "dwutysięczny", 3: "trzytysięczny"}


def _pl_decline(word: str, gender: str = "m", case: str = "nom") -> str:
    """A nominative masculine ordinal (-y / -i) in another gender and case."""
    if word.endswith("y"):
        stem, kind = word[:-1], "hard"
    elif word.endswith(("gi", "ki")):
        stem, kind = word[:-1], "velar"
    else:
        stem, kind = word[:-1], "soft"  # trzeci
    i = "" if kind == "hard" else "i"
    if gender == "f":
        if case == "nom":
            return stem + ("ia" if kind == "soft" else "a")
        if case in ("gen", "dat", "loc"):
            return stem + i + "ej"
        return stem + ("ią" if kind == "soft" else "ą")  # acc, ins
    if case == "nom" or case == "acc_inanimate":
        return word
    if case == "gen":
        return stem + i + "ego"
    if case == "dat":
        return stem + i + "emu"
    return stem + ("ym" if kind == "hard" else "im")  # ins, loc


def _pl_ordinal_parts(n: int) -> tuple[str, list[str]]:
    """(cardinal prefix that stays as it is, ordinal words to decline). 1..2999."""
    r = n % 100
    h = (n // 100) % 10
    th = n // 1000
    if r == 0:
        if h:
            return (_pl_cardinal(th * 1000) if th else "", [_PL_ORD_HUNDREDS[h]])
        if th in _PL_ORD_THOUSANDS and n < 10_000:
            return ("", [_PL_ORD_THOUSANDS[th]])
        raise ValueError(n)
    prefix = _pl_cardinal(n - r) if n - r else ""
    if r < 20:
        return (prefix, [_PL_ORD_1_19[r]])
    t, u = divmod(r, 10)
    return (prefix, [_PL_ORD_TENS[t]] + ([_PL_ORD_1_19[u]] if u else []))


def _pl_ordinal(n: int, gender: str = "m", case: str = "nom") -> str:
    prefix, words = _pl_ordinal_parts(n)
    declined = " ".join(_pl_decline(w, gender, case) for w in words)
    return f"{prefix} {declined}".strip()


# =============================================================================
# Latin
# =============================================================================

_LA_0_19 = (
    "nihil unus duo tres quattuor quinque sex septem octo novem decem undecim duodecim "
    "tredecim quattuordecim quindecim sedecim septendecim duodeviginti undeviginti"
).split()
_LA_TENS = {
    2: "viginti",
    3: "triginta",
    4: "quadraginta",
    5: "quinquaginta",
    6: "sexaginta",
    7: "septuaginta",
    8: "octoginta",
    9: "nonaginta",
    10: "centum",
}
_LA_HUNDREDS = {
    1: "centum",
    2: "ducenti",
    3: "trecenti",
    4: "quadringenti",
    5: "quingenti",
    6: "sescenti",
    7: "septingenti",
    8: "octingenti",
    9: "nongenti",
}


def _la_100(n: int, after_hundreds: bool = False) -> str:
    if n < 20:
        return _LA_0_19[n]
    t, u = divmod(n, 10)
    # Subtraction from the next ten (duodetriginta, undeviginti); 98/99 after a hundred
    # are added instead ("nongenti nonaginta novem", not "nongenti undecentum").
    if u in (8, 9) and not (t == 9 and after_hundreds):
        return ("duode" if u == 8 else "unde") + _LA_TENS[t + 1]
    return _LA_TENS[t] + (f" {_LA_0_19[u]}" if u else "")


def _la_1000(n: int) -> str:
    h, r = divmod(n, 100)
    if not h:
        return _la_100(r)
    return _LA_HUNDREDS[h] + (f" {_la_100(r, after_hundreds=True)}" if r else "")


def _la_neuter(words: str) -> str:
    out = []
    for w in words.split():
        if w == "unus":
            w = "unum"
        elif w == "tres":
            w = "tria"
        elif w.endswith("enti"):
            w = w[:-1] + "a"  # ducenta, quadringenta
        out.append(w)
    return " ".join(out)


def _la_cardinal(n: int) -> str:
    if n == 0:
        return "nihil"
    k, u = divmod(n, 1000)
    parts = []
    if k:
        parts.append("mille" if k == 1 else f"{_la_neuter(_la_1000(k))} milia")
    if u:
        parts.append(_la_1000(u))
    return " ".join(parts)


_LA_ORD_1_19 = (
    "",
    "primus",
    "secundus",
    "tertius",
    "quartus",
    "quintus",
    "sextus",
    "septimus",
    "octavus",
    "nonus",
    "decimus",
    "undecimus",
    "duodecimus",
    "tertius decimus",
    "quartus decimus",
    "quintus decimus",
    "sextus decimus",
    "septimus decimus",
    "duodevicesimus",
    "undevicesimus",
)
_LA_ORD_TENS = {
    2: "vicesimus",
    3: "tricesimus",
    4: "quadragesimus",
    5: "quinquagesimus",
    6: "sexagesimus",
    7: "septuagesimus",
    8: "octogesimus",
    9: "nonagesimus",
    10: "centesimus",
}
_LA_ENDINGS = {
    ("m", "nom"): "us",
    ("m", "gen"): "i",
    ("m", "dat"): "o",
    ("m", "acc"): "um",
    ("m", "abl"): "o",
    ("f", "nom"): "a",
    ("f", "gen"): "ae",
    ("f", "dat"): "ae",
    ("f", "acc"): "am",
    ("f", "abl"): "a",
    ("n", "nom"): "um",
    ("n", "gen"): "i",
    ("n", "dat"): "o",
    ("n", "acc"): "um",
    ("n", "abl"): "o",
}


def _la_ordinal(n: int, gender: str = "m", case: str = "nom") -> str:
    if n < 20:
        words = _LA_ORD_1_19[n]
    elif n < 100:
        t, u = divmod(n, 10)
        if u == 8:
            words = "duode" + _LA_ORD_TENS[t + 1]
        elif u == 9:
            words = "unde" + _LA_ORD_TENS[t + 1]
        else:
            words = _LA_ORD_TENS[t] + (f" {_LA_ORD_1_19[u]}" if u else "")
    elif n == 100:
        words = "centesimus"
    else:
        return _la_cardinal(n)
    ending = _LA_ENDINGS[(gender, case)]
    return " ".join(w[:-2] + ending for w in words.split())


# =============================================================================
# Tagalog (Filipino)
# =============================================================================

_TL_1_9 = ("", "isa", "dalawa", "tatlo", "apat", "lima", "anim", "pito", "walo", "siyam")
_TL_10_19 = {
    10: "sampu",
    11: "labing-isa",
    12: "labindalawa",
    13: "labintatlo",
    14: "labing-apat",
    15: "labinlima",
    16: "labing-anim",
    17: "labimpito",
    18: "labingwalo",
    19: "labinsiyam",
}
_TL_TENS = {2: "dalawampu", 3: "tatlumpu", 4: "apatnapu", 5: "limampu", 6: "animnapu", 7: "pitumpu", 8: "walumpu", 9: "siyamnapu"}


def _tl_link(words: str) -> str:
    """A number ready to count a noun: isang, dalawang, apat na, isang daang."""
    last = words[-1]
    if last in "aeiou":
        return words + "ng"
    if last == "n":
        return words + "g"
    return words + " na"


def _tl_join(a: str, b: str) -> str:
    """'a at b', contracted after a vowel: dalawampu't isa, isang daan at isa."""
    return f"{a}'t {b}" if a[-1] in "aeiou" else f"{a} at {b}"


def _tl_100(n: int) -> str:
    if n < 10:
        return _TL_1_9[n]
    if n < 20:
        return _TL_10_19[n]
    t, u = divmod(n, 10)
    return _tl_join(_TL_TENS[t], _TL_1_9[u]) if u else _TL_TENS[t]


def _tl_count(count: str, noun: str) -> str:
    linked = _tl_link(count)
    if noun == "daan" and linked.endswith(" na"):
        noun = "raan"  # apat na raan
    return f"{linked} {noun}"


def _tl_1000(n: int) -> str:
    h, r = divmod(n, 100)
    if not h:
        return _tl_100(r)
    head = _tl_count(_TL_1_9[h], "daan")
    return _tl_join(head, _tl_100(r)) if r else head


def _tl_cardinal(n: int) -> str:
    if n == 0:
        return "sero"
    m, rest = divmod(n, 10**6)
    k, u = divmod(rest, 1000)
    chunks = []
    if m:
        chunks.append(_tl_count(_tl_1000(m), "milyon"))
    if k:
        chunks.append(_tl_count(_tl_1000(k), "libo"))
    if u:
        chunks.append(_tl_1000(u))
    out = chunks[0]
    for c in chunks[1:]:
        out = _tl_join(out, c)
    return out


_TL_ORD_1_10 = ("", "una", "ikalawa", "ikatlo", "ikaapat", "ikalima", "ikaanim", "ikapito", "ikawalo", "ikasiyam", "ikasampu")


def _tl_ordinal(n: int) -> str:
    return _TL_ORD_1_10[n] if n <= 10 else "ika-" + _tl_cardinal(n)


# Popes' numerals as Filipino Catholics say them: the Spanish forms, Filipino spelling.
_TL_REGNAL_1_10 = ("", "Primero", "Segundo", "Tersero", "Kuwarto", "Kinto", "Seksto", "Setimo", "Oktabo", "Nobeno", "Desimo")
_TL_ES_UNITS = ("", "Uno", "Dos", "Tres", "Kuwatro", "Singko", "Sais", "Siyete", "Otso", "Nuwebe")
_TL_ES_11_20 = {
    11: "Onse",
    12: "Dose",
    13: "Trese",
    14: "Katorse",
    15: "Kinse",
    16: "Disisais",
    17: "Disisiyete",
    18: "Disiotso",
    19: "Disinuwebe",
    20: "Bente",
}


def _tl_regnal(n: int) -> str:
    if n <= 10:
        return _TL_REGNAL_1_10[n]
    if n <= 20:
        return _TL_ES_11_20[n]
    t, u = divmod(n, 10)
    tens = "Bente" if t == 2 else "Trenta"
    return f"{tens} {_TL_ES_UNITS[u]}" if u else tens


# =============================================================================
# Vietnamese
# =============================================================================

_VI_UNITS = ("không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín")


def _vi_100(n: int) -> str:
    if n < 10:
        return _VI_UNITS[n]
    t, u = divmod(n, 10)
    if t == 1:
        head = "mười"
        if not u:
            return head
        return f"{head} {'lăm' if u == 5 else _VI_UNITS[u]}"
    head = f"{_VI_UNITS[t]} mươi"
    if not u:
        return head
    if u == 1:
        return f"{head} mốt"
    if u == 5:
        return f"{head} lăm"
    return f"{head} {_VI_UNITS[u]}"


def _vi_1000(n: int, full: bool = False) -> str:
    """full: inside a larger number, say 'không trăm' and 'linh' for a missing hundred/ten."""
    h, r = divmod(n, 100)
    parts = []
    if h or full:
        parts.append(f"{_VI_UNITS[h]} trăm")
    if r:
        if r < 10 and (h or full):
            parts.append(f"linh {_VI_UNITS[r]}")
        else:
            parts.append(_vi_100(r))
    return " ".join(parts)


def _vi_cardinal(n: int) -> str:
    if n == 0:
        return "không"
    parts = []
    started = False
    for value, name in ((10**6, "triệu"), (1000, "nghìn"), (1, "")):
        q, n = divmod(n, value)
        if q:
            words = _vi_1000(q, full=started)
            parts.append(f"{words} {name}".strip())
            started = True
    return " ".join(parts)


def _vi_ordinal(n: int) -> str:
    """The word after 'thứ': nhất, hai, ba, tư, năm..."""
    if n == 1:
        return "nhất"
    if n == 4:
        return "tư"
    return _vi_cardinal(n)


_VI_REGNAL_SINO = {1: "đệ nhất", 2: "đệ nhị", 3: "đệ tam", 4: "đệ tứ"}


# =============================================================================
# Korean
# =============================================================================

_KO_DIGITS = ("영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구")


def _ko_sino_group(n: int) -> str:
    s = ""
    for value, unit in ((1000, "천"), (100, "백"), (10, "십")):
        d, n = divmod(n, value)
        if d:
            s += ("" if d == 1 else _KO_DIGITS[d]) + unit
    if n:
        s += _KO_DIGITS[n]
    return s


def _ko_cardinal(n: int) -> str:
    """Sino-Korean: 이천이십육, 만, 일억 이천삼백사십오만 육천칠백팔십구."""
    if n == 0:
        return "영"
    parts = []
    eok, rest = divmod(n, 10**8)
    man, il = divmod(rest, 10**4)
    if eok:
        parts.append(_ko_sino_group(eok) + "억" if eok > 1 else "일억")
    if man:
        parts.append("만" if man == 1 else _ko_sino_group(man) + "만")
    if il:
        parts.append(_ko_sino_group(il))
    return " ".join(parts)


_KO_NATIVE_ONES = ("", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉")
_KO_NATIVE_TENS = ("", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔")


def _ko_native(n: int) -> str:
    """Native Korean before a counter (1..99): 한, 두, 열, 스무, 스물한."""
    t, u = divmod(n, 10)
    if not u:
        return "스무" if t == 2 else _KO_NATIVE_TENS[t]
    return _KO_NATIVE_TENS[t] + _KO_NATIVE_ONES[u]


# Counters that take native numbers; Sino ones that start the same way are checked first.
_KO_SINO_FIRST = ("개월", "분", "번지", "시편", "세", "년", "월", "일", "장", "절", "단", "회", "층", "원", "주", "차", "편", "명절")
_KO_NATIVE_COUNTERS = (
    "번째",
    "번",
    "개",
    "명",
    "사람",
    "시간",
    "시",
    "살",
    "가지",
    "마리",
    "곳",
    "군데",
    "그루",
    "권",
    "잔",
    "벌",
    "송이",
    "켤레",
    "채",
    "척",
)


# =============================================================================
# Chinese (Mandarin)
# =============================================================================

_ZH_DIGITS = "零一二三四五六七八九"
_ZH_YEAR_DIGITS = "〇一二三四五六七八九"


def _zh_group(n: int, leading: bool) -> str:
    digits = (n // 1000, n // 100 % 10, n // 10 % 10, n % 10)
    units = ("千", "百", "十", "")
    out = []
    pending_zero = False
    started = False
    for d, unit in zip(digits, units):
        if d == 0:
            if started:
                pending_zero = True
            continue
        if pending_zero:
            out.append("零")
            pending_zero = False
        if unit == "十" and d == 1 and not started and leading:
            out.append("十")
        else:
            out.append(_ZH_DIGITS[d] + unit)
        started = True
    return "".join(out)


def _zh_cardinal(n: int) -> str:
    if n == 0:
        return "零"
    yi, rest = divmod(n, 10**8)
    wan, ge = divmod(rest, 10**4)
    parts = []
    started = False
    gap = False
    for g, unit in ((yi, "亿"), (wan, "万"), (ge, "")):
        if g == 0:
            gap = started
            continue
        if started and (gap or g < 1000):
            parts.append("零")
        parts.append(_zh_group(g, not started) + unit)
        started = True
        gap = False
    s = "".join(parts)
    if s.startswith(("二千", "二万", "二亿")):
        s = "两" + s[1:]  # 两千零二十六: how a leading 2 is said before 千/万/亿
    return s


_ZH_MEASURE = (
    "小时", "分钟", "个月", "个", "次", "遍", "位", "天", "人", "名", "本", "件", "种", "句", "段", "首",
    "颗", "只", "条", "张", "点", "周", "岁", "年", "回", "场", "份", "双", "对", "座", "家", "层", "步",
    "声", "下", "串", "端",
)


# =============================================================================
# Greek (modern)
# =============================================================================

_EL_0_19 = (
    "μηδέν ένα δύο τρία τέσσερα πέντε έξι επτά οκτώ εννέα δέκα έντεκα δώδεκα δεκατρία "
    "δεκατέσσερα δεκαπέντε δεκαέξι δεκαεπτά δεκαοκτώ δεκαεννέα"
).split()
_EL_FEM = {1: "μία", 3: "τρεις", 4: "τέσσερις", 13: "δεκατρείς", 14: "δεκατέσσερις"}
_EL_MASC = {1: "ένας", 3: "τρεις", 4: "τέσσερις", 13: "δεκατρείς", 14: "δεκατέσσερις"}
_EL_TENS = {2: "είκοσι", 3: "τριάντα", 4: "σαράντα", 5: "πενήντα", 6: "εξήντα", 7: "εβδομήντα", 8: "ογδόντα", 9: "ενενήντα"}
_EL_HUNDREDS = {
    1: "εκατό",
    2: "διακόσια",
    3: "τριακόσια",
    4: "τετρακόσια",
    5: "πεντακόσια",
    6: "εξακόσια",
    7: "επτακόσια",
    8: "οκτακόσια",
    9: "εννιακόσια",
}


def _el_100(n: int, gender: str = "n") -> str:
    if n < 20:
        table = _EL_FEM if gender == "f" else _EL_MASC if gender == "m" else {}
        return table.get(n, _EL_0_19[n])
    t, u = divmod(n, 10)
    return _EL_TENS[t] + (f" {_el_100(u, gender)}" if u else "")


def _el_1000(n: int, gender: str = "n") -> str:
    h, r = divmod(n, 100)
    if not h:
        return _el_100(r, gender)
    head = "εκατόν" if (h == 1 and r) else _EL_HUNDREDS[h]
    if h > 1 and gender == "f":
        head = head[:-1] + "ες"  # διακόσιες
    elif h > 1 and gender == "m":
        head = head[:-1] + "οι"  # διακόσιοι
    return head + (f" {_el_100(r, gender)}" if r else "")


def _el_cardinal(n: int, gender: str = "n") -> str:
    if n == 0:
        return "μηδέν"
    parts = []
    m, rest = divmod(n, 10**6)
    if m:
        parts.append("ένα εκατομμύριο" if m == 1 else f"{_el_1000(m)} εκατομμύρια")
    k, u = divmod(rest, 1000)
    if k:
        parts.append("χίλια" if k == 1 else f"{_el_1000(k, 'f')} χιλιάδες")
    if u:
        parts.append(_el_1000(u, gender))
    return " ".join(parts)


# (masculine nominative, stem used before -ου/-ων/-ους, formal stress)
_EL_ORD = {
    1: ("πρώτος", "πρώτ"),
    2: ("δεύτερος", "δευτέρ"),
    3: ("τρίτος", "τρίτ"),
    4: ("τέταρτος", "τετάρτ"),
    5: ("πέμπτος", "πέμπτ"),
    6: ("έκτος", "έκτ"),
    7: ("έβδομος", "εβδόμ"),
    8: ("όγδοος", "ογδό"),
    9: ("ένατος", "ενάτ"),
    10: ("δέκατος", "δεκάτ"),
    11: ("ενδέκατος", "ενδεκάτ"),
    12: ("δωδέκατος", "δωδεκάτ"),
}
_EL_ORD_TENS = {
    2: "εικοστ",
    3: "τριακοστ",
    4: "τεσσαρακοστ",
    5: "πεντηκοστ",
    6: "εξηκοστ",
    7: "εβδομηκοστ",
    8: "ογδοηκοστ",
    9: "ενενηκοστ",
}
_EL_OXYTONE = {
    "ος": "ός",
    "η": "ή",
    "ο": "ό",
    "ου": "ού",
    "ης": "ής",
    "οι": "οί",
    "ες": "ές",
    "α": "ά",
    "ους": "ούς",
    "ων": "ών",
    "ον": "όν",
}


def _el_ord_word(n: int, ending: str) -> str:
    nom, gen_stem = _EL_ORD[n]
    return (gen_stem if ending in ("ου", "ων", "ους") else nom[:-2]) + ending


def _el_ordinal(n: int, ending: str = "ος") -> str:
    if n <= 12:
        return _el_ord_word(n, ending)
    if n < 20:
        return f"{_el_ord_word(10, ending)} {_el_ord_word(n - 10, ending)}"
    if n < 100:
        t, u = divmod(n, 10)
        tens = _EL_ORD_TENS[t] + _EL_OXYTONE[ending]
        return f"{tens} {_el_ord_word(u, ending)}" if u else tens
    return _el_cardinal(n)


def _el_gender_of(word: str | None) -> str:
    """Rough gender from a following noun's ending (singular or plural)."""
    if not word:
        return "n"
    w = word.lower()
    if w.endswith(("ες", "ές", "οι", "οί", "ος", "ός", "ας", "άς", "ης", "ής")):
        return "m" if w.endswith(("ος", "ός", "ας", "άς", "ης", "ής", "οι", "οί")) else "f"
    if w.endswith(("α", "ά", "η", "ή")) and not w.endswith(("ια", "ιά", "ματα", "μα")):
        return "f"
    return "n"


# =============================================================================
# Public: numbers and ordinals
# =============================================================================

_CARDINALS = {
    "en": _en_cardinal,
    "es": _es_cardinal,
    "fr": _fr_cardinal,
    "it": _it_cardinal,
    "de": _de_cardinal,
    "pt": _pt_cardinal,
    "pl": _pl_cardinal,
    "la": _la_cardinal,
    "tl": _tl_cardinal,
    "vi": _vi_cardinal,
    "ko": _ko_cardinal,
    "zh": _zh_cardinal,
    "el": _el_cardinal,
}


def _check_lang(lang: str) -> None:
    if lang not in _CARDINALS:
        raise ValueError(f"unsupported language: {lang!r} (expected one of {', '.join(LANGS)})")


def spell_number(n: int, lang: str) -> str:
    """The cardinal number `n` in words, as said on its own (0..999,999,999; Latin 0..999,999)."""
    _check_lang(lang)
    if isinstance(n, bool) or not isinstance(n, int) or n < 0:
        raise ValueError(f"not a non-negative integer: {n!r}")
    if n > (_LA_MAX if lang == "la" else MAX_NUMBER):
        raise ValueError(f"{n} is beyond what is spelled out in {lang}")
    return _CARDINALS[lang](n)


def ordinal(n: int, lang: str, gender: str = "m", case: str = "nom") -> str:
    """The ordinal `n` in words: first, segundo, deuxième, der zweite... (1..99 everywhere).

    gender is "m", "f" or (Latin, Greek) "n"; case matters for de ("nom" -> -e, else
    -en), pl (nom, gen, dat, acc, ins, loc), la (nom, gen, dat, acc, abl) and el.
    """
    _check_lang(lang)
    if isinstance(n, bool) or not isinstance(n, int) or n < 1:
        raise ValueError(f"not a positive integer: {n!r}")
    fem = gender == "f"
    if lang == "en":
        return _en_ordinal(n)
    if lang == "es":
        return _es_ordinal(n, fem)
    if lang == "pt":
        return _pt_ordinal(n, fem)
    if lang == "it":
        return _it_ordinal(n, fem)
    if lang == "fr":
        return _fr_ordinal(n, fem)
    if lang == "de":
        return _de_ordinal_stem(n) + ("e" if case == "nom" else "en")
    if lang == "pl":
        return _pl_ordinal(n, gender, case)
    if lang == "la":
        return _la_ordinal(n, gender, case)
    if lang == "tl":
        return _tl_ordinal(n)
    if lang == "vi":
        return f"thứ {_vi_ordinal(n)}"
    if lang == "ko":
        return f"제{_ko_cardinal(n)}"
    if lang == "zh":
        return f"第{_zh_cardinal(n)}"
    ending = {
        ("m", "nom"): "ος",
        ("m", "gen"): "ου",
        ("m", "acc"): "ο",
        ("f", "nom"): "η",
        ("f", "gen"): "ης",
        ("f", "acc"): "η",
        ("n", "nom"): "ο",
        ("n", "gen"): "ου",
        ("n", "acc"): "ο",
    }.get((gender, case), "ος")
    return _el_ordinal(n, ending)


# =============================================================================
# Text passes
# =============================================================================

_FULLWIDTH = {ord("０") + i: ord("0") + i for i in range(10)}
_FULLWIDTH[ord("％")] = ord("%")

_AND = {
    "en": "and",
    "es": "y",
    "fr": "et",
    "it": "e",
    "de": "und",
    "pt": "e",
    "pl": "i",
    "la": "et",
    "tl": "at",
    "vi": "và",
    "zh": "和",
    "el": "και",
}
_PERCENT = {
    "en": "percent",
    "es": "por ciento",
    "fr": "pour cent",
    "it": "per cento",
    "de": "Prozent",
    "pt": "por cento",
    "pl": "procent",
    "la": "per centum",
    "tl": "porsiyento",
    "vi": "phần trăm",
    "ko": "퍼센트",
    "el": "τοις εκατό",
}


def _ampersand(s: str, lang: str) -> str:
    if "&" not in s:
        return s
    if lang == "ko":

        def ko(m: re.Match[str]) -> str:
            prev = m.group(1)
            last = prev[-1]
            if "가" <= last <= "힣":
                return prev + ("과" if (ord(last) - 0xAC00) % 28 else "와") + " "
            return prev + " 그리고 "

        s = re.sub(r"(\S+)\s*&\s*", ko, s)
        return s.replace("&", " 그리고 ")
    if lang == "zh":
        return re.sub(r"\s*&\s*", "和", s)
    if lang == "es":
        # "y" becomes "e" before an i- sound: "Fernando e Isabel".
        s = re.sub(r"\s*&\s*(?=[iIíÍ]|[hH][iIíÍ](?![aeouáéóú]))", " e ", s)
    return re.sub(r"\s*&\s*", f" {_AND[lang]} ", s)


def _symbols(s: str, lang: str) -> str:
    # A psalm's mediant asterisk or a verse bar between words is a pause.
    s = re.sub(r"(?<=[^\s,.;:!?·…—–\-])\s+[*|]\s+(?=\S)", ", ", s)
    s = re.sub(r"\s+/\s+(?=\S)", ", ", s)
    s = s.replace("/", " ")
    s = re.sub(r"[*_#~|\[\]{}<>^=\\`•▪◦●■□]", " ", s)
    s = re.sub(r"(?<!\S)\+(?!\S)", " ", s)
    return _ampersand(s, lang)


def _tidy(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    return re.sub(r" +(?=[,.](?!\d))", "", s)


def _next_word(s: str, end: int) -> str | None:
    m = re.match(rf"[ \u00a0]+({_L}+)", s[end:])
    return m.group(1) if m else None


# ---------------------------------------------------------------- Roman regnal

_ROMAN_VALID = re.compile(r"^(?=[IVX])X{0,3}(?:IX|IV|V?I{0,3})$")


def _roman_value(s: str) -> int | None:
    if not _ROMAN_VALID.match(s):
        return None
    vals = {"I": 1, "V": 5, "X": 10}
    total = 0
    for i, ch in enumerate(s):
        v = vals[ch]
        total += -v if i + 1 < len(s) and vals[s[i + 1]] > v else v
    return total if 1 <= total <= 39 else None


# After these words (capitalised or not) a numeral is a cardinal ("Vatican two",
# "Kapitel vier", "siglo veinte", "chapitre quatre").
_CARDINAL_CONTEXT = {
    "en": {
        "vatican", "chapter", "psalm", "part", "book", "volume", "station", "article", "section",
        "canon", "lesson", "session", "week", "day", "mystery", "decade", "hymn", "number", "act",
    },
    "es": {"capítulo", "salmo", "estación", "parte", "libro", "tomo", "artículo", "sección", "lección", "día", "semana", "número", "himno", "siglo"},
    "pt": {"capítulo", "salmo", "estação", "parte", "livro", "tomo", "artigo", "seção", "secção", "lição", "dia", "semana", "número", "hino", "século"},
    "fr": {"chapitre", "livre", "tome", "partie", "acte", "psaume", "station", "leçon"},
    "de": {"kapitel", "psalm", "station", "teil", "buch", "band", "artikel", "abschnitt", "vatikanum", "lektion", "tag", "woche", "nummer", "hymnus"},
    "vi": {"vaticanô", "vatican", "vaticano", "chương", "phần", "kỷ"},
}
# After these nouns (capitalised or not) a numeral is an ordinal agreeing with the noun.
_ORDINAL_CONTEXT = {
    "it": {"capitolo": "m", "secolo": "m", "libro": "m", "canto": "m", "atto": "m", "tomo": "m", "volume": "m", "parte": "f", "stazione": "f"},
    "pl": {
        "rozdział": "m", "wiek": "m", "tom": "m", "psalm": "m", "sobór": "m", "dzień": "m",
        "stacja": "f", "tajemnica": "f", "część": "f", "księga": "f", "niedziela": "f",
        "modlitwa": "f", "godzina": "f", "lekcja": "f",
    },
    "la": {"caput": "n", "capitulum": "n", "liber": "m", "psalmus": "m", "pars": "f", "statio": "f", "concilium": "n"},
}
_ES_FEM_NAMES = {"isabel", "leonor", "beatriz", "inés", "mercedes"}
_PT_FEM_NAMES = {"isabel", "leonor", "beatriz", "inês"}
_IT_MASC_A_NAMES = {"andrea", "luca", "nicola", "elia", "enea", "mattia", "battista", "giosuè"}


def _in_context(lang: str, word: str) -> bool:
    low = word.lower()
    return low in _CARDINAL_CONTEXT.get(lang, ()) or low in _ORDINAL_CONTEXT.get(lang, {})


def _pl_case_of(name: str) -> str:
    w = name.lower()
    if w.endswith("owi"):
        return "dat"
    if w.endswith("ego"):
        return "gen"
    if w.endswith(("em", "im", "ym")):
        return "ins"
    if w.endswith("e"):
        return "loc"
    if w.endswith(("a", "u")):
        return "gen"
    return "nom"


def _la_case_of(name: str) -> tuple[str, str]:
    w = name.lower()
    if w in ("leo", "ioannes", "iohannes", "joannes", "johannes", "franciscus"):
        return ("m", "nom")
    if w.endswith(("us", "es", "ns", "x", "or")):
        return ("m", "nom")
    if w.endswith("ae"):
        return ("f", "gen")
    if w.endswith("am"):
        return ("f", "acc")
    if w.endswith(("um", "em")):
        return ("m", "acc")
    if w.endswith(("is", "i")):
        return ("m", "gen")
    if w.endswith(("o", "e")):
        return ("m", "abl")
    if w.endswith("a"):
        return ("f", "nom")
    return ("m", "nom")


def _regnal_words(lang: str, name: str, n: int, suf: str | None) -> str | None:
    low = name.lower()
    if low in _CARDINAL_CONTEXT.get(lang, ()):
        return _CARDINALS[lang](n) if not suf else None
    noun_gender = _ORDINAL_CONTEXT.get(lang, {}).get(low)
    if noun_gender:
        if lang == "it":
            return _it_ordinal(n, noun_gender == "f")
        if lang == "pl":
            return _pl_ordinal(n, noun_gender, "nom")
        return _la_ordinal(n, noun_gender, "nom")
    if lang == "en":
        o = _en_ordinal(n)
        return f"the {o[0].upper()}{o[1:]}"
    if lang == "es":
        fem = low in _ES_FEM_NAMES or (low.endswith("a") and low not in _ES_MASC_A)
        return _es_ordinal(n, fem) if n <= 10 else _es_cardinal(n)
    if lang == "pt":
        fem = low in _PT_FEM_NAMES or (low.endswith("a") and low not in _PT_MASC_A)
        return _pt_ordinal(n, fem) if n <= 10 else _pt_cardinal(n)
    if lang == "it":
        return _it_ordinal(n, low.endswith("a") and low not in _IT_MASC_A_NAMES)
    if lang == "fr":
        if suf in ("er", "ers") or (not suf and n == 1):
            return "premier"
        if suf in ("re", "ère", "res", "ères"):
            return "première"
        if suf:
            return None
        return _fr_cardinal(n)
    if lang == "de":
        o = _de_ordinal_stem(n) + "e"
        return f"der {o[0].upper()}{o[1:]}"
    if lang == "pl":
        o = _pl_ordinal(n, "m", _pl_case_of(name))
        return o[0].upper() + o[1:]
    if lang == "la":
        gender, case = _la_case_of(name)
        return _la_ordinal(n, gender, case)
    if lang == "tl":
        return _tl_regnal(n)
    if lang == "vi":
        return _VI_REGNAL_SINO.get(n) or _vi_cardinal(n)
    return None


_REGNAL_RE = re.compile(
    rf"{_NOT_LETTER_BEFORE}(?P<name>{_L}+(?:[-'’]{_L}+)*)(?P<sp>[ \u00a0]+)"
    rf"(?P<num>[IVX]{{1,7}})(?P<suf>ères|ère|ers|er|res|re)?(?P<dot>\.)?{_NOT_LETTER_AFTER}"
)
_CLAUSE_END = re.compile(r"\s*(?:$|[,.;:!?)\]…—–\-«»\"”’])")


def _regnal(s: str, lang: str) -> str:
    def repl(m: re.Match[str]) -> str:
        name, sp, num, suf, dot = m.group("name", "sp", "num", "suf", "dot")
        titled = name[0].isupper() and any(c.islower() for c in name)
        if not (titled or _in_context(lang, name)):
            return m.group(0)
        n = _roman_value(num)
        if n is None or (suf and lang != "fr"):
            return m.group(0)
        after = m.string[m.end() :]
        if num == "I" and not suf:
            # A lone "I" is a numeral only at the end of a clause ("Giovanni Paolo I.",
            # never "Ojca I Syna"), and never in English (the pronoun).
            if lang == "en" or not (dot or _CLAUSE_END.match(after)):
                return m.group(0)
        words = _regnal_words(lang, name, n, suf)
        if words is None:
            return m.group(0)
        tail = ""
        if dot:
            # German writes the ordinal's own point ("Paul II. besuchte"): it is kept only
            # where it also ends a sentence (end of text, or a capital follows).
            nxt = after.lstrip()[:1]
            tail = ("." if (not nxt or nxt.isupper()) else "") if lang == "de" else "."
        return f"{name}{sp}{words}{tail}"

    return _REGNAL_RE.sub(repl, s)


def _fr_roman_ordinals(s: str) -> str:
    """'XXe siècle' -> 'vingtième siècle'."""

    def repl(m: re.Match[str]) -> str:
        n = _roman_value(m.group(1))
        if n is None or n < 2:
            return m.group(0)
        return _fr_ordinal(n) + ("s" if m.group(2).endswith("s") else "")

    return re.sub(rf"{_NOT_LETTER_BEFORE}([IVX]{{1,7}})(èmes|ème|es|e|è){_NOT_LETTER_AFTER}", repl, s)


# ---------------------------------------------------------------- Greek numerals

_EL_NUMERAL_VALUES = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "Ϛ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10, "Κ": 20, "Λ": 30}
_KERAIA = "\u0374\u02b9\u0384'\u2019\u00b4"


def _el_numeral_value(letters: str) -> int | None:
    s = letters.upper().replace("ΣΤ", "Ϛ")
    total, last = 0, 1000
    for ch in s:
        v = _EL_NUMERAL_VALUES.get(ch)
        if v is None or v >= last or (v < 10 and last < 10):
            return None
        total += v
        last = v
    return total or None


def _el_regnal(s: str) -> str:
    pattern = re.compile(
        rf"{_NOT_LETTER_BEFORE}(?P<name>{_L}+)(?P<sp1>\s+)(?:(?P<art>ο|του|τον|η|της|την)(?P<sp2>\s+))?"
        rf"(?P<num>[Α-ΩϚ]{{1,3}})[{_KERAIA}]"
    )

    def repl(m: re.Match[str]) -> str:
        name, art = m.group("name"), m.group("art")
        if not (name[0].isupper() and any(c.islower() for c in name)):
            return m.group(0)
        n = _el_numeral_value(m.group("num"))
        if n is None:
            return m.group(0)
        if art:
            ending = {"ο": "ος", "του": "ου", "τον": "ο", "η": "η", "της": "ης", "την": "η"}[art]
        else:
            w = name.lower()
            ending = "ου" if w.endswith("ου") else "ο" if w.endswith(("ο", "η", "ά", "α")) else "ος"
        article = f"{art}{m.group('sp2')}" if art else ""
        return f"{name}{m.group('sp1')}{article}{_el_ordinal(n, ending)}"

    return pattern.sub(repl, s)


# ---------------------------------------------------------------- ordinal marks

_DE_MONTHS = "Januar|Jänner|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember"
_DE_ARTICLE_E = {"der", "die", "das"}
_DE_ARTICLE_EN = {"den", "dem", "des", "am", "im", "zum", "zur", "vom", "beim", "ins"}


def _ordinal_marks(s: str, lang: str) -> str:
    if lang == "en":
        return re.sub(r"\b(\d+)(st|nd|rd|th)\b", lambda m: _en_ordinal(int(m.group(1))), s, flags=re.I)
    if lang in ("es", "pt", "it"):

        def romance(m: re.Match[str]) -> str:
            n, mark = int(m.group(1)), m.group(2)
            if not 1 <= n <= 100:
                return m.group(0)
            fem = mark == "ª"
            if lang == "es":
                if mark.endswith("er"):
                    return _es_ordinal(n, apocope=True)
                return _es_ordinal(n, fem)
            return _pt_ordinal(n, fem) if lang == "pt" else _it_ordinal(n, fem)

        s = re.sub(r"\b(\d{1,3})(?:\.\s?)?(º|ª|°)", romance, s)
        if lang == "es":
            s = re.sub(r"\b(\d{1,3})(\.?er)\b", romance, s)
        return s
    if lang == "fr":

        def fr(m: re.Match[str]) -> str:
            n, suf = int(m.group(1)), m.group(2)
            plural = "s" if suf.endswith("s") else ""
            if suf.startswith("nd"):
                return ("seconde" if "e" in suf else "second") + plural
            if suf in ("er", "ers"):
                return "premier" + plural
            if suf in ("re", "res", "ère", "ères"):
                return "première" + plural
            if n < 2:
                return m.group(0)
            return _fr_ordinal(n) + plural

        return re.sub(r"\b(\d+)(ères|ère|ers|er|res|re|èmes|ème|es|e|è|ndes|nds|nde|nd)\b", fr, s)
    if lang == "de":

        def de(m: re.Match[str]) -> str:
            article = (m.group(1) or "").strip().lower()
            n = int(m.group(2))
            if not 1 <= n <= 99:
                return m.group(0)
            ending = "e" if article in _DE_ARTICLE_E else "en" if (article in _DE_ARTICLE_EN or not article) else "e"
            return (m.group(1) or "") + _de_ordinal_stem(n) + ending

        articles = "|".join(sorted(_DE_ARTICLE_E | _DE_ARTICLE_EN, key=len, reverse=True))
        s = re.sub(rf"(?i:\b((?:{articles})\s+))(\d{{1,2}})\.(?=\s+{_L})", de, s)
        return re.sub(rf"()\b(\d{{1,2}})\.(?=\s+(?:{_DE_MONTHS})\b)", de, s)
    if lang == "pl":

        def pl_year(m: re.Match[str]) -> str:
            n = int(m.group(2))
            if not 1000 <= n <= 2999:
                return m.group(0)
            case = "loc" if m.group(1) else "gen"
            word = "roku"  # "1917 r." is always read "roku"
            if m.group(4) == "r.":
                nxt = m.string[m.end() :].lstrip()[:1]
                if not nxt or nxt.isupper():
                    word = "roku."  # the abbreviation's point also ended the sentence
            return (m.group(1) or "") + _pl_ordinal(n, "m", case) + m.group(3) + word

        return re.sub(r"(\b[wW]\s+)?\b(\d{4})(\s+)(roku\b|r\.)", pl_year, s)
    if lang == "tl":
        return re.sub(r"\b([Ii]ka)-?\s?(\d+)\b", lambda m: _tl_ordinal(int(m.group(2))) if int(m.group(2)) else m.group(0), s)
    if lang == "vi":
        return re.sub(r"\b([Tt]hứ)\s+(\d+)\b", lambda m: f"{m.group(1)} {_vi_ordinal(int(m.group(2)))}" if int(m.group(2)) else m.group(0), s)
    if lang == "el":

        def el(m: re.Match[str]) -> str:
            n = int(m.group(1))
            return _el_ordinal(n, m.group(2)) if 1 <= n <= 99 else m.group(0)

        return re.sub(r"\b(\d{1,2})(ους|ου|ος|ον|ης|ων|οι|ες|ο|η|α)\b", el, s)
    return s


# ---------------------------------------------------------------- clock times

# "3:16" is as often a Bible reference as a time, so outside English a time needs a
# sign that it is one: the words before it, a round hour, "h" (fr, vi) or "Uhr" (de).
_TIME_BEFORE = {
    "es": r"\b(?:a\s+las|las|a\s+la|la|desde\s+las|hasta\s+las)\s*$",
    "pt": r"\b(?:às|as|à|a|das|até\s+as|até\s+às)\s*$",
    "it": r"(?:\b(?:alle|le|ore|dalle|alla)\s*|\bl['’]\s*)$",
    "fr": r"(?:\b(?:à|vers|dès|de)\s*|\bjusqu['’]à\s*)$",
    "el": r"\b(?:στις|στη|στην|ώρα|από\s+τις|μέχρι\s+τις)\s*$",
    "pl": r"(?:^|\s)(?:[oO]|godz\.|godzina|godzinie|od|do)\s*$",
    "vi": r"\b(?:lúc|vào\s+lúc|từ|đến)\s*$",
    "ko": r"(?:오전|오후|새벽|아침|저녁|밤|낮)\s*$",
    "zh": r"(?:上午|下午|晚上|早上|凌晨|中午|傍晚)\s*$",
}
# Filipino tells the time in Spanish: "alas tres", "alas dos y medya".
_TL_HOURS = ("", "una", "dos", "tres", "kuwatro", "singko", "sais", "siyete", "otso", "nuwebe", "diyes", "onse", "dose")


def _is_time(lang: str, before: str, mi: int, h_sep: bool, uhr: bool) -> bool:
    if lang == "en":
        return True
    if lang == "de":
        return uhr
    if lang == "tl":
        return bool(re.search(r"\balas[\s-]*$", before, re.I))
    if h_sep or mi == 0:
        return True
    marker = _TIME_BEFORE.get(lang)
    return bool(marker and re.search(marker, before, re.I))


def _time_words(lang: str, h: int, mi: int, before: str, after: str) -> str | None:
    """h:mi as said in `lang`, or None to leave it as written."""
    if lang == "en":
        if mi == 0:
            ampm = re.match(r"\s*[aApP]\.?\s?[mM]\b\.?", after)
            return _en_cardinal(h) + ("" if ampm else " o'clock")
        return f"{_en_cardinal(h)} {f'oh {_EN_ONES[mi]}' if mi < 10 else _en_100(mi)}"
    if lang == "fr":
        hour = "une heure" if h == 1 else f"{_fr_cardinal(h)} heures"
        return hour + (f" {_fr_cardinal(mi)}" if mi else "")
    if lang == "de":
        hour = "ein" if h == 1 else _de_cardinal(h)
        return f"{hour} Uhr" + (f" {_de_cardinal(mi)}" if mi else "")
    if lang == "pl":
        if h == 0:
            return None
        case = "loc" if re.search(r"(?:^|\s)[oO]\s*$", before) else "nom"
        return _pl_ordinal(h, "f", case) + (f" {_pl_cardinal(mi)}" if mi else "")
    if lang == "vi":
        return f"{_vi_cardinal(h)} giờ" + (f" {_vi_cardinal(mi)}" if mi else "")
    if lang == "ko":
        hour = f"{_ko_native(h)} 시" if 1 <= h <= 12 else f"{_ko_cardinal(h)} 시"
        return hour + (f" {_ko_cardinal(mi)} 분" if mi else "")
    if lang == "zh":
        hour = "两" if h == 2 else _zh_cardinal(h)
        minutes = (("零" + _ZH_DIGITS[mi]) if mi < 10 else _zh_cardinal(mi)) + "分" if mi else ""
        return f"{hour}点{minutes}"
    if lang == "el":
        return _el_cardinal(h, "f") + (f" {_el_cardinal(mi)}" if mi else "")
    if lang == "tl":
        if not 1 <= h <= 12 or mi not in (0, 30):
            return None
        return _TL_HOURS[h] + (" y medya" if mi else "")
    one = {"es": "una", "pt": "uma", "it": "una"}.get(lang)
    hour = one if (h == 1 and one) else _CARDINALS[lang](h)
    return hour + (f" {_CARDINALS[lang](mi)}" if mi else "")


def _times(s: str, lang: str) -> str:
    if lang == "la":
        return s
    sep = r"(?P<sep>:|\s?h\s?)" if lang in ("fr", "vi") else r"(?P<sep>:)"
    tail = r"(?P<uhr>\s*Uhr\b)?" if lang == "de" else r"(?P<uhr>)"
    # No \b before the hour: Chinese and Korean write the time straight after a word (下午3:05).
    pattern = re.compile(rf"(?<![\d:.,A-Za-z])(?P<h>[01]?\d|2[0-4]){sep}(?P<m>[0-5]\d)(?![:.,]?\d){tail}")

    def repl(m: re.Match[str]) -> str:
        h, mi = int(m.group("h")), int(m.group("m"))
        before, after = m.string[: m.start()], m.string[m.end() :]
        if not _is_time(lang, before, mi, m.group("sep").strip() == "h", bool(m.group("uhr"))):
            return m.group(0)
        words = _time_words(lang, h, mi, before, after)
        return m.group(0) if words is None else words

    s = pattern.sub(repl, s)
    if lang in ("fr", "vi"):

        def hour_only(m: re.Match[str]) -> str:
            h = int(m.group(1))
            if lang == "fr":
                return "une heure" if h == 1 else f"{_fr_cardinal(h)} heures"
            return f"{_vi_cardinal(h)} giờ"

        s = re.sub(r"(?<![\d:.,])\b([01]?\d|2[0-4])\s?h\b(?!\d)", hour_only, s)
    return s


# ---------------------------------------------------------------- language passes


def _korean_counters(s: str) -> str:
    def repl(m: re.Match[str]) -> str:
        digits, space, after = m.group(1), m.group(2), m.string[m.end() :]
        n = int(digits)
        for counter in _KO_SINO_FIRST:
            if after.startswith(counter):
                return _ko_cardinal(n) + space
        for counter in _KO_NATIVE_COUNTERS:
            if after.startswith(counter) and 1 <= n <= 99:
                if counter == "번째" and n == 1:
                    return "첫 "
                return _ko_native(n) + " "
        return m.group(0)

    return re.sub(r"(?<![\d.,])(\d{1,3})(?![\d.,])( ?)(?=[가-힣])", repl, s)


def _chinese_numbers(s: str) -> str:
    def year(m: re.Match[str]) -> str:
        return (m.group(1) or "") + "".join(_ZH_YEAR_DIGITS[int(c)] for c in m.group(2))

    s = re.sub(r"(?<![\d.])(公元前?)?(\d{4})(?=\s?年)", year, s)
    s = re.sub(r"(公元前?)(\d{1,3})(?=\s?年)", year, s)
    s = re.sub(r"(?<![\d.第])2(?![\d.])(?=\s?(?:" + "|".join(_ZH_MEASURE) + "))", "两", s)
    s = re.sub(
        r"(?<![\d.])(\d+(?:\.\d+)?)\s?%",
        lambda m: "百分之" + _zh_decimal(m.group(1)),
        s,
    )
    return s


def _zh_decimal(token: str) -> str:
    whole, _, frac = token.partition(".")
    out = _zh_cardinal(int(whole)) if int(whole) <= MAX_NUMBER else whole
    if frac:
        out += "点" + "".join(_ZH_DIGITS[int(c)] for c in frac)
    return out


_GROUP_SEP = {
    "en": ",\u00a0\u202f\u2009",
    "tl": ",\u00a0\u202f\u2009",
    "zh": ",\u00a0\u202f\u2009",
    "ko": ",\u00a0\u202f\u2009",
    "fr": " .\u00a0\u202f\u2009",
    "pl": " \u00a0\u202f\u2009",
}
_DECIMAL_POINT = {"en": ".", "tl": ".", "zh": ".", "ko": "."}
_DECIMAL_WORD = {
    "en": "point",
    "es": "coma",
    "fr": "virgule",
    "it": "virgola",
    "de": "Komma",
    "pt": "vírgula",
    "pl": "przecinek",
    "tl": "punto",
    "vi": "phẩy",
    "ko": "점",
    "zh": "点",
    "el": "κόμμα",
}
_DIGIT_BY_DIGIT_FRACTION = {"en", "de", "zh", "ko", "tl"}


# Words after a number that are not the thing counted ("1 y 2", "1 e 2"): no agreement.
_FUNCTION_WORDS = {
    "es": {"y", "e", "o", "u", "ni", "de", "del", "a", "al", "en", "con", "por", "para", "que", "es", "son"},
    "it": {"e", "ed", "o", "di", "a", "da", "in", "con", "su", "per", "tra", "fra", "che", "\u00e8"},
    "pt": {"e", "ou", "de", "do", "da", "a", "o", "em", "com", "por", "para", "que", "\u00e9"},
}


def _cardinal_in_context(n: int, lang: str, next_word: str | None) -> str:
    """A cardinal that agrees with the word after it where the language needs it."""
    if next_word and next_word.lower() in _FUNCTION_WORDS.get(lang, ()):
        next_word = None
    if next_word and lang == "es":
        fem = _es_is_fem(next_word)
        if n % 10 == 1 and n % 100 != 11:
            return _es_cardinal(n, "f" if fem else "m")
        if fem:
            return _es_cardinal(n, "f")
    if next_word and lang == "pt" and _pt_is_fem(next_word):
        return _pt_cardinal(n, fem=True)
    if next_word and lang == "it" and n == 1:
        return _it_one(next_word)
    if next_word and lang == "de" and n == 1:
        return _de_one(next_word)
    if next_word and lang == "el":
        return _el_cardinal(n, _el_gender_of(next_word))
    return _CARDINALS[lang](n)


def _digits(s: str, lang: str) -> str:
    seps = _GROUP_SEP.get(lang, ".\u00a0\u202f\u2009")
    point = _DECIMAL_POINT.get(lang, ",")
    pattern = re.compile(
        rf"(?<!\d)(\d{{1,3}}(?:[{re.escape(seps)}]\d{{3}})+(?!\d)|\d+)(?:{re.escape(point)}(\d+))?(?!\d)"
    )
    limit = _LA_MAX if lang == "la" else MAX_NUMBER
    cjk = lang in ("zh", "ko")

    def spell_digits(digits: str) -> str:
        words = [_CARDINALS[lang](int(c)) for c in digits]
        return ("" if cjk else " ").join(words)

    def repl(m: re.Match[str]) -> str:
        raw, frac = m.group(1), m.group(2)
        digits = re.sub(r"\D", "", raw)
        grouped = digits != raw
        if len(digits) > 1 and digits.startswith("0") and not grouped:
            words = spell_digits(digits)  # "007": digit by digit
        else:
            n = int(digits)
            if n > limit:
                return m.group(0)
            plain4 = not grouped and not frac and len(digits) == 4
            if lang == "en" and plain4 and 1100 <= n <= 2099:
                words = _en_year(n)
            elif lang == "de" and plain4 and 1100 <= n <= 1999:
                words = _de_year(n)
            else:
                words = _cardinal_in_context(n, lang, None if frac else _next_word(m.string, m.end()))
        if frac:
            if lang == "la":
                fparts = [_la_cardinal(int(c)) for c in frac]
                words = f"{words}{point} {' '.join(fparts)}"
            else:
                if lang in _DIGIT_BY_DIGIT_FRACTION or frac.startswith("0") or int(frac) > limit:
                    fwords = spell_digits(frac)
                else:
                    fwords = _CARDINALS[lang](int(frac))
                words = f"{words}\u70b9{fwords}" if lang == "zh" else f"{words} {_DECIMAL_WORD[lang]} {fwords}"
        if not cjk:
            before = m.string[m.start() - 1] if m.start() else ""
            after = m.string[m.end()] if m.end() < len(m.string) else ""
            if before.isalpha():
                words = " " + words
            if after.isalpha():
                words += " "
        return words

    return pattern.sub(repl, s)


def _percent(s: str, lang: str) -> str:
    if lang == "zh":
        return s.replace("%", "百分之")  # a lone sign; numbers were handled with it
    return re.sub(r"\s?%", f" {_PERCENT[lang]}", s)


# =============================================================================
# Public: the whole pass
# =============================================================================


def normalize_for_voice(text: str, lang: str) -> str:
    """`text` written the way a voice should read it in `lang`; never different words."""
    _check_lang(lang)
    if not text:
        return ""
    s = text.translate(_FULLWIDTH)
    s = _symbols(s, lang)
    if lang == "fr":
        s = _fr_roman_ordinals(s)
    if lang == "el":
        s = _el_regnal(s)
    elif lang not in ("ko", "zh"):
        s = _regnal(s, lang)
    s = _ordinal_marks(s, lang)
    s = _times(s, lang)
    if lang == "ko":
        s = _korean_counters(s)
    elif lang == "zh":
        s = _chinese_numbers(s)
    s = _digits(s, lang)
    s = _percent(s, lang)
    return _tidy(s)
