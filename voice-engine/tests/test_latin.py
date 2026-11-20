"""Tests for latin.py: Ecclesiastical Latin -> Kokoro phonemes and Italian respelling.

The 40 test words come from the research file (Wiktionary's modern Italianate
Ecclesiastical IPA, run 2026-11-14), rewritten in this module's convention: the stress
mark stands immediately before the stressed vowel (espeak-ng / misaki, which Kokoro was
trained on) instead of at the start of the syllable. Deliberate deviations:

* Michael: mˈiːkael (Míchaël, as liturgical books print it), not Wiktionary's miˈkaːel;
* exsultavit: eksultˈaːvit, one s (the x already ends in [s]), not ekssulˈtaːvit.

Every other word matches Wiktionary's segments, stress and length exactly.
"""

import logging
import os
from pathlib import Path

import pytest

import latin

ITALIAN_LETTERS = set("abcdefghijklmnopqrstuvwxyzàèìòùABCDEFGHIJKLMNOPQRSTUVWXYZÀÈÌÒÙ")

# A local export of the site's Latin prayers (slug<TAB>text per line), e.g.
#   psql "$DATABASE_URL" -At -F $'\t' -c "select slug, replace(payload->>'latin', E'\n', ' / ')
#     from \"PublishedContent\" where payload ? 'latin' and \"contentType\"='PRAYER'" > latin_prayers.tsv
# Found at $LATIN_CORPUS, else in the repo's .cache/pray-along-work/voice/data/ (gitignored).
SCRATCH = Path(
    os.environ.get(
        "LATIN_CORPUS",
        Path(__file__).resolve().parents[2] / ".cache" / "pray-along-work" / "voice" / "data" / "latin_prayers.tsv",
    )
)

# (word, stress="vowel", stress="syllable", respelling, respelling accents="all")
FORTY = [
    ("nomine", "nˈɔːmine", "ˈnɔːmine", "nòmine", "nòmine"),
    ("Patris", "pˈaːtris", "ˈpaːtris", "Patris", "Pàtris"),
    ("Filii", "fˈiːlii", "ˈfiːlii", "Fìlii", "Fìlii"),
    ("Spiritus", "spˈiːritus", "ˈspiːritus", "Spìritus", "Spìritus"),
    ("Sancti", "sˈaŋkti", "ˈsaŋkti", "Sancti", "Sàncti"),
    ("Amen", "ˈaːmen", "ˈaːmen", "Amen", "Àmen"),
    ("caelis", "ʧˈɛːlis", "ˈʧɛːlis", "celis", "cèlis"),
    ("sanctificetur", "saŋktifiʧˈɛːtur", "saŋktifiˈʧɛːtur", "sanctificetur", "sanctificètur"),
    ("adveniat", "advˈɛːniat", "adˈvɛːniat", "advèniat", "advèniat"),
    ("regnum", "rˈɛɲɲum", "ˈrɛɲɲum", "regnum", "règnum"),
    ("voluntas", "volˈuntas", "voˈluntas", "voluntas", "volùntas"),
    ("quotidianum", "kwotidiˈaːnum", "kwotidiˈaːnum", "quotidianum", "quotidiànum"),
    ("hodie", "ˈɔːdie", "ˈɔːdie", "òdie", "òdie"),
    ("debitoribus", "debitˈɔːribus", "debiˈtɔːribus", "debitòribus", "debitòribus"),
    ("tentationem", "tentatʦiˈɔːnem", "tentatʦiˈɔːnem", "tentazionem", "tentaziònem"),
    ("gratia", "ɡrˈatʦia", "ˈɡratʦia", "gràzia", "gràzia"),
    ("Dominus", "dˈɔːminus", "ˈdɔːminus", "Dòminus", "Dòminus"),
    ("benedicta", "benedˈikta", "beneˈdikta", "benedicta", "benedìcta"),
    ("mulieribus", "muliˈɛːribus", "muliˈɛːribus", "mulièribus", "mulièribus"),
    ("Iesus", "jˈɛːzus", "ˈjɛːzus", "Iesus", "Ièsus"),
    ("peccatoribus", "pekkatˈɔːribus", "pekkaˈtɔːribus", "peccatòribus", "peccatòribus"),
    ("Spiritui", "spirˈiːtui", "spiˈriːtui", "Spirìtui", "Spirìtui"),
    ("saeculorum", "sekulˈɔːrum", "sekuˈlɔːrum", "seculorum", "seculòrum"),
    ("principio", "prinʧˈiːpio", "prinˈʧiːpio", "princìpio", "princìpio"),
    ("excelsis", "ekʃˈɛlsis", "ekˈʃɛlsis", "ecscelsis", "ecscèlsis"),
    ("suscipe", "sˈuʃʃipe", "ˈsuʃʃipe", "sùscipe", "sùscipe"),
    ("ecce", "ˈɛtʧe", "ˈɛtʧe", "ecce", "ècce"),
    ("gementes", "ʤemˈɛntes", "ʤeˈmɛntes", "gementes", "gemèntes"),
    ("Virgine", "vˈirʤine", "ˈvirʤine", "Vìrgine", "Vìrgine"),
    ("mihi", "mˈiːki", "ˈmiːki", "michi", "mìchi"),
    ("Kyrie", "kˈiːrie", "ˈkiːrie", "Chìrie", "Chìrie"),
    ("eleison", "elˈɛːizon", "eˈlɛːizon", "elèison", "elèison"),
    ("sanguis", "sˈaŋɡwis", "ˈsaŋɡwis", "sanguis", "sànguis"),
    ("catholicam", "katˈɔːlikam", "kaˈtɔːlikam", "catòlicam", "catòlicam"),
    ("Michael", "mˈiːkael", "ˈmiːkael", "Mìcael", "Mìcael"),
    ("proelio", "prˈɛːlio", "ˈprɛːlio", "prèlio", "prèlio"),
    ("Nazarenus", "nadʣarˈɛːnus", "nadʣaˈrɛːnus", "Nazarenus", "Nazarènus"),
    ("hostia", "ˈɔstia", "ˈɔstia", "òstia", "òstia"),
    ("exsultavit", "eksultˈaːvit", "eksulˈtaːvit", "ecsultavit", "ecsultàvit"),
    ("alleluia", "allelˈuːja", "alleˈluːja", "alleluia", "allelùia"),
]

SIGNUM = "In nomine Patris, et Filii, et Spiritus Sancti. Amen."
PATER = (
    "Pater noster, qui es in caelis, sanctificetur nomen tuum. Adveniat regnum tuum. "
    "Fiat voluntas tua, sicut in caelo et in terra. Panem nostrum quotidianum da nobis "
    "hodie, et dimitte nobis debita nostra, sicut et nos dimittimus debitoribus nostris. "
    "Et ne nos inducas in tentationem; sed libera nos a malo. Amen."
)
AVE = (
    "Ave Maria, gratia plena, Dominus tecum. Benedicta tu in mulieribus, et benedictus "
    "fructus ventris tui, Iesus. Sancta Maria, Mater Dei, ora pro nobis peccatoribus, "
    "nunc et in hora mortis nostrae. Amen."
)
GLORIA = (
    "Gloria Patri, et Filio, et Spiritui Sancto. Sicut erat in principio, et nunc, et "
    "semper, et in saecula saeculorum. Amen."
)

# Verified word by word against the rules and the 40 words above.
GOLDEN = {
    SIGNUM: "in nˈɔːmine pˈaːtris, et fˈiːlii, et spˈiːritus sˈaŋkti. ˈaːmen.",
    PATER: (
        "pˈaːter nˈɔster, kwi ˈɛs in ʧˈɛːlis, saŋktifiʧˈɛːtur nˈɔːmen tˈuːum. "
        "advˈɛːniat rˈɛɲɲum tˈuːum. fˈiːat volˈuntas tˈuːa, sˈiːkut in ʧˈɛːlo et in "
        "tˈɛrra. pˈaːnem nˈɔstrum kwotidiˈaːnum dˈa nˈɔːbis ˈɔːdie, et dimˈitte nˈɔːbis "
        "dˈɛːbita nˈɔstra, sˈiːkut et nˈɔs dimˈittimus debitˈɔːribus nˈɔstris. et ne nˈɔs "
        "indˈuːkas in tentatʦiˈɔːnem; sed lˈiːbera nˈɔs a mˈaːlo. ˈaːmen."
    ),
    AVE: (
        "ˈaːve marˈiːa, ɡrˈatʦia plˈɛːna, dˈɔːminus tˈɛːkum. benedˈikta tˈu in "
        "muliˈɛːribus, et benedˈiktus frˈuktus vˈɛntris tˈuːi, jˈɛːzus. sˈaŋkta marˈiːa, "
        "mˈaːter dˈɛːi, ˈɔːra pro nˈɔːbis pekkatˈɔːribus, nˈuŋk et in ˈɔːra mˈɔrtis "
        "nˈɔstre. ˈaːmen."
    ),
    GLORIA: (
        "ɡlˈɔːria pˈaːtri, et fˈiːlio, et spirˈiːtui sˈaŋkto. sˈiːkut ˈɛːrat in "
        "prinʧˈiːpio, et nˈuŋk, et sˈɛmper, et in sˈɛːkula sekulˈɔːrum. ˈaːmen."
    ),
}

RESPELT = {
    SIGNUM: "In nòmine Patris, et Fìlii, et Spìritus Sancti. Amen.",
    PATER: (
        "Pater noster, qui es in celis, sanctificetur nomen tuum. Advèniat regnum tuum. "
        "Fiat voluntas tua, sicut in celo et in terra. Panem nostrum quotidianum da nobis "
        "òdie, et dimitte nobis dèbita nostra, sicut et nos dimìttimus debitòribus nostris. "
        "Et ne nos inducas in tentazionem; sed lìbera nos a malo. Amen."
    ),
    AVE: (
        "Ave Maria, gràzia plena, Dòminus tecum. Benedicta tu in mulièribus, et benedictus "
        "fructus ventris tui, Iesus. Sancta Maria, Mater Dei, ora pro nobis peccatòribus, "
        "nunc et in ora mortis nostre. Amen."
    ),
    GLORIA: (
        "Glòria Patri, et Fìlio, et Spirìtui Sancto. Sicut erat in princìpio, et nunc, et "
        "semper, et in sècula seculorum. Amen."
    ),
}


# --------------------------------------------------------------------------------------
# The 40 words
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize("word,vowel,syllable,_r,_ra", FORTY)
def test_forty_words_vowel_stress(word, vowel, syllable, _r, _ra):
    assert latin.word_ipa(word) == vowel


@pytest.mark.parametrize("word,vowel,syllable,_r,_ra", FORTY)
def test_forty_words_syllable_stress(word, vowel, syllable, _r, _ra):
    assert latin.word_ipa(word, stress="syllable") == syllable


@pytest.mark.parametrize("word,vowel,_s,_r,_ra", FORTY)
def test_forty_words_without_length(word, vowel, _s, _r, _ra):
    assert latin.word_ipa(word, length=False) == vowel.replace("ː", "")


@pytest.mark.parametrize("word,_v,_s,respelt,respelt_all", FORTY)
def test_forty_words_respelling(word, _v, _s, respelt, respelt_all):
    assert latin.to_respelling(word) == respelt
    assert latin.to_respelling(word, accents="all") == respelt_all


@pytest.mark.parametrize("word,vowel,_s,_r,_ra", FORTY)
def test_forty_words_are_not_guesses(word, vowel, _s, _r, _ra):
    ipa, guessed = latin.to_ipa_report(word)
    assert ipa == vowel
    assert guessed == []
    assert latin.check_vocab(ipa) == set()


# --------------------------------------------------------------------------------------
# The four prayers
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize("text", list(GOLDEN))
def test_prayers_golden(text):
    ipa, guessed = latin.to_ipa_report(text)
    assert ipa == GOLDEN[text]
    assert guessed == []
    assert latin.check_vocab(ipa) == set()
    assert len(ipa) <= 510 or all(len(c) <= 500 for c in latin.chunk_ipa(ipa))


@pytest.mark.parametrize("text", list(RESPELT))
def test_prayers_respelling(text):
    assert latin.to_respelling(text) == RESPELT[text]


def test_signum_variants():
    assert latin.to_ipa(SIGNUM, stress="syllable") == (
        "in ˈnɔːmine ˈpaːtris, et ˈfiːlii, et ˈspiːritus ˈsaŋkti. ˈaːmen."
    )
    assert latin.to_ipa(SIGNUM, length=False) == (
        "in nˈɔmine pˈatris, et fˈilii, et spˈiritus sˈaŋkti. ˈamen."
    )
    assert latin.to_ipa(SIGNUM, stress="syllable", length=False) == (
        "in ˈnɔmine ˈpatris, et ˈfilii, et ˈspiritus ˈsaŋkti. ˈamen."
    )
    assert latin.to_respelling(SIGNUM, accents="all") == (
        "In nòmine Pàtris, et Fìlii, et Spìritus Sàncti. Àmen."
    )


def test_pater_noster_syllable_style_keeps_segments():
    vowel = latin.to_ipa(PATER)
    syllable = latin.to_ipa(PATER, stress="syllable")
    assert vowel.replace("ˈ", "") == syllable.replace("ˈ", "")
    assert vowel.count("ˈ") == syllable.count("ˈ")


# --------------------------------------------------------------------------------------
# Rules
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "word,ipa",
    [
        ("Filioque", "filiˈɔːkwe"),  # the enclitic pulls the stress
        ("Spiritusque", "spiritˈuskwe"),
        ("Patrique", "patrˈiːkwe"),
        ("pacemque", "paʧˈɛmkwe"),
        ("atque", "ˈatkwe"),
        ("itaque", "ˈiːtakwe"),  # not an enclitic: lexicon
        ("undique", "ˈundikwe"),
        ("utique", "ˈuːtikwe"),
    ],
)
def test_enclitics(word, ipa):
    assert latin.word_ipa(word) == ipa


@pytest.mark.parametrize(
    "word,ipa",
    [
        ("Dómine", "dˈɔːmine"),
        ("adorémus", "adorˈɛːmus"),
        ("sǽculum", "sˈɛːkulum"),
        ("Jerúsalem", "jerˈuːzalem"),
        ("Domínus", "domˈiːnus"),  # a printed accent beats the lexicon
        ("Ísrael", "ˈizrael"),
    ],
)
def test_printed_accents(word, ipa):
    an = latin.analyse(word)
    assert an.source == "accent"
    assert latin.word_ipa(word) == ipa


@pytest.mark.parametrize(
    "a,b",
    [
        ("caelum", "cælum"),
        ("coelum", "cœlum"),
        ("Iesu", "Jesu"),
        ("eius", "ejus"),
        ("maiestas", "majestas"),
        ("Caecilia", "Cæcilia"),
    ],
)
def test_ligatures_and_j_spellings(a, b):
    assert latin.word_ipa(a) == latin.word_ipa(b)


@pytest.mark.parametrize(
    "word,ipa",
    [
        ("caelum", "ʧˈɛːlum"),
        ("eius", "ˈɛːjus"),
        ("Iesu", "jˈɛːzu"),
        ("maiestas", "majˈɛstas"),
        ("adiuvante", "adjuvˈante"),  # consonantal i after a prefix: lexicon
        ("iusiurandum", "jusjurˈandum"),
        ("Pompeius", "pompˈɛːjus"),  # the syllable before an intervocalic i is heavy
        ("ii", "ˈiːi"),
    ],
)
def test_consonantal_i(word, ipa):
    assert latin.word_ipa(word) == ipa


@pytest.mark.parametrize(
    "word,ipa",
    [
        ("Christe", "krˈiste"),
        ("schola", "skˈɔːla"),
        ("Bacchus", "bˈakkus"),
        ("accipe", "ˈatʧipe"),
        ("descendit", "deʃʃˈɛndit"),
        ("scio", "ʃˈiːo"),
        ("agnus", "ˈaɲɲus"),
        ("gignit", "ʤˈiɲɲit"),
        ("lingua", "lˈiŋɡwa"),
        ("quinque", "kwˈiŋkwe"),
        ("nunc", "nˈuŋk"),
        ("suavis", "swˈaːvis"),
        ("exaudi", "eɡzˈaudi"),
        ("exitum", "ˈɛɡzitum"),
        ("exspecto", "ekspˈɛkto"),
        ("Rex", "rˈɛks"),
        ("baptizare", "baptidʣˈaːre"),
        ("zelus", "ʣˈɛːlus"),
        ("nihil", "nˈiːkil"),
        ("hodie", "ˈɔːdie"),
        ("Hosanna", "ozˈanna"),
        ("Sabaoth", "sˈaːbaot"),
        ("tertia", "tˈɛrʦia"),
        ("nequitiam", "nekwˈitʦiam"),
        ("hostia", "ˈɔstia"),
        ("Matthias", "mattˈiːas"),  # th never assibilates
        ("Eucharistia", "eukarˈistia"),
        ("eum", "ˈɛːum"),
        ("Deus", "dˈɛːus"),
        ("cui", "kˈui"),
        ("Israel", "ˈizrael"),
        ("Michael", "mˈiːkael"),
        ("aer", "ˈaːer"),
        ("Noe", "nˈɔːe"),
        ("subleva", "sˈubleva"),  # the forced break after sub-
        ("tenebrae", "tˈɛːnebre"),  # muta cum liquida leaves the penult open
        ("Paraclito", "parˈaːklito"),
        ("eleison", "elˈɛːizon"),
    ],
)
def test_sounds_and_stress(word, ipa):
    assert latin.word_ipa(word) == ipa


def test_name_only_entry():
    assert latin.word_ipa("Maria") == "marˈiːa"
    assert latin.word_ipa("maria") == "mˈaːria"  # "seas": the rule's stress


@pytest.mark.parametrize(
    "word,ipa",
    [("et", "et"), ("in", "in"), ("qui", "kwi"), ("ad", "ad"), ("cum", "kum"),
     ("est", "ˈɛst"), ("non", "nˈɔn"), ("te", "tˈɛ"), ("O", "ˈɔ"), ("nos", "nˈɔs")],
)
def test_monosyllables(word, ipa):
    assert latin.word_ipa(word) == ipa


def test_syllables_and_stress_position():
    assert latin.syllables("Dominus") == ["do", "mi", "nus"]
    assert latin.stress_position("Dominus") == 0
    assert latin.syllables("sanctificetur") == ["sanc", "ti", "fi", "ce", "tur"]
    assert latin.stress_position("sanctificetur") == 3
    assert latin.syllables("Patris") == ["pa", "tris"]
    assert latin.syllables("trahe") == ["tra", "he"]
    assert latin.syllables("subleva") == ["sub", "le", "va"]
    assert latin.stress_position("et") == -1
    assert latin.stress_position("Amen") == 0


# --------------------------------------------------------------------------------------
# Text handling
# --------------------------------------------------------------------------------------


def test_capitals_and_punctuation():
    assert latin.to_ipa("AMEN.") == "ˈaːmen."
    assert latin.to_ipa("Ave, Maria!") == "ˈaːve, marˈiːa!"
    assert latin.to_ipa("«Ave»  Maria?") == "ˈaːve marˈiːa?"
    assert latin.to_ipa("Ave — Maria") == "ˈaːve — marˈiːa"
    assert latin.to_ipa("Amen...") == "ˈaːmen…"
    assert latin.to_ipa("Amen / Amen") == "ˈaːmen, ˈaːmen"
    assert latin.to_ipa("Psalmus 22: Dominus") == "psˈalmus: dˈɔːminus"
    assert latin.to_ipa("(Kyrie) eleison;") == "kˈiːrie elˈɛːizon;"
    assert latin.to_ipa("") == ""
    assert latin.to_respelling("Ave, Maria!") == "Ave, Maria!"


def test_every_output_symbol_is_in_kokoro_vocab():
    text = " ".join(GOLDEN) + " Æterne Rex altissime, Redemptor et fidelium, exsurge, Xyste!"
    for stress in ("vowel", "syllable"):
        for length in (True, False):
            assert latin.check_vocab(latin.to_ipa(text, stress=stress, length=length)) == set()


def test_check_vocab_flags_foreign_symbols():
    assert latin.check_vocab("ɡrˈatʦia") == set()
    tie = chr(0x361)  # the tie bar of t͡s, which Kokoro does not know
    assert latin.check_vocab("t" + tie + "s") == {tie}
    assert latin.check_vocab("a.b") == set()
    assert latin.check_vocab("g") == {"g"}  # ASCII g is not Kokoro's ɡ


def test_kokoro_vocab_is_complete():
    assert len(latin.KOKORO_VOCAB) == 114
    for sym in "ʧʤʦʣɡɲŋʃɛɔˈˌː—…“” ,.;:!?":
        assert sym in latin.KOKORO_VOCAB


def test_bad_options():
    with pytest.raises(ValueError):
        latin.to_ipa("Amen", stress="onset")
    with pytest.raises(ValueError):
        latin.to_respelling("Amen", accents="some")
    with pytest.raises(TypeError):
        latin.to_ipa_report("Amen", colour="red")


def test_chunk_ipa():
    long_ipa = latin.to_ipa(" ".join([PATER, AVE, GLORIA]))
    chunks = latin.chunk_ipa(long_ipa, limit=200)
    assert all(0 < len(c) <= 200 for c in chunks)
    assert " ".join(chunks).replace("  ", " ") == long_ipa
    assert latin.chunk_ipa("") == []
    assert latin.chunk_ipa("ˈaːmen.") == ["ˈaːmen."]


# --------------------------------------------------------------------------------------
# Guesses: reported, logged once, and written to the unknown-word log
# --------------------------------------------------------------------------------------


def test_guesses_are_reported_logged_and_written(tmp_path, monkeypatch, caplog):
    log_file = tmp_path / "unknown.tsv"
    monkeypatch.setenv("VOICE_ENGINE_LATIN_UNKNOWN_LOG", str(log_file))
    word = "Brobotanumile"  # not Latin: open penult of unknown length
    with caplog.at_level(logging.WARNING, logger="voice_engine.latin"):
        ipa, guessed = latin.to_ipa_report(f"{word} et {word}.")
    assert guessed == [word]
    assert latin.check_vocab(ipa) == set()
    assert sum(word in r.getMessage() for r in caplog.records) == 1
    lines = log_file.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1 and lines[0].startswith("brobotanumile\t")
    # a second sighting is not logged again
    caplog.clear()
    with caplog.at_level(logging.WARNING, logger="voice_engine.latin"):
        latin.to_ipa_report(word)
    assert not any(word in r.getMessage() for r in caplog.records)


def test_lexicon_and_accents_are_not_guesses():
    _ipa, guessed = latin.to_ipa_report("Dómine, Paraclitus, Dominum, misericors, quaesumus.")
    assert guessed == []


# --------------------------------------------------------------------------------------
# The lexicon file
# --------------------------------------------------------------------------------------


def _lexicon_lines():
    for line in latin.LEXICON_PATH.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#"):
            yield line.split("\t")


def test_lexicon_is_well_formed():
    keys = set()
    for cols in _lexicon_lines():
        assert len(cols) == 4, cols
        key, form, source, note = cols
        assert key not in keys, key
        keys.add(key)
        assert latin._key(latin._spell(form).chars) == key, (key, form)
        assert source in ("own", "accent"), cols
        assert set(note.split()) <= {"?", "name"}, cols
        an = latin.analyse(form)
        assert an.syllables, form
        assert latin.check_vocab(latin.word_ipa(form)) == set(), form
    assert len(keys) > 1500


def test_lexicon_covers_the_common_prayers():
    common = (
        "Credo in unum Deum, Patrem omnipotentem, factorem caeli et terrae. Salve, Regina, "
        "Mater misericordiae, vita, dulcedo, et spes nostra. Veni, Creator Spiritus, mentes "
        "tuorum visita. Qui diceris Paraclitus, altissimi donum Dei. Tantum ergo Sacramentum "
        "veneremur cernui. Sancte Michael Archangele, defende nos in proelio. Te Deum "
        "laudamus: te Dominum confitemur. Tibi Cherubim et Seraphim incessabili voce "
        "proclamant. Anima Christi, sanctifica me. Angele Dei, qui custos es mei. Requiem "
        "aeternam dona eis, Domine. Memorare, O piissima Virgo Maria. Sub tuum praesidium "
        "confugimus, sancta Dei Genetrix. Ave verum corpus, natum de Maria Virgine."
    )
    ipa, guessed = latin.to_ipa_report(common)
    assert guessed == []
    assert latin.check_vocab(ipa) == set()


# --------------------------------------------------------------------------------------
# The site's whole Latin corpus (skipped when the scratch copy is gone)
# --------------------------------------------------------------------------------------


@pytest.mark.skipif(not SCRATCH.exists(), reason="the scratch copy of the Latin corpus is gone")
def test_corpus_yields_only_kokoro_symbols():
    texts = [line.partition("\t")[2] for line in SCRATCH.read_text(encoding="utf-8").splitlines()]
    assert len(texts) > 200
    words = 0
    for text in texts:
        for stress in ("vowel", "syllable"):
            ipa = latin.to_ipa(text, stress=stress)
            assert latin.check_vocab(ipa) == set(), (text[:60], latin.check_vocab(ipa))
        words += len(text.split())
        for kind, word in latin._tokens(latin.to_respelling(text)):
            if kind == "w":
                assert set(word) <= ITALIAN_LETTERS, word
    assert words > 15000


@pytest.mark.skipif(not SCRATCH.exists(), reason="the scratch copy of the Latin corpus is gone")
def test_corpus_has_almost_no_guesses():
    guessed: set[str] = set()
    for line in SCRATCH.read_text(encoding="utf-8").splitlines():
        guessed.update(w.lower() for w in latin.to_ipa_report(line.partition("\t")[2])[1])
    # the only guesses left are English rubric words that slipped into two texts
    assert guessed <= {"barbaras", "recited", "trinity", "following", "repeated", "antiphon"}
