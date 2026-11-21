"""The dropped-repeat check (qa.dropped_repeats): a word the text says three times running must be
heard three times, whatever the CER. Through the real qa.evaluate, with Whisper's answer given (no
model is loaded); the transcripts written like Whisper's are Whisper's own where noted (the stored
clips judged on 2026-11-21)."""

import numpy as np
import pytest

import qa

SR = 24000
PACE_REF = {"en": 0.986, "es": 0.95, "la": 0.95, "el": 0.981, "zh": 1.092, "ko": 0.918}  # voices/registry.json

REFRAIN = "Ave, Ave, Ave, Maria! Ave, Ave, Ave, Maria!"
VERSE = ("Immaculate Mary, your praises we sing, Who reigns now with Christ, our Redeemer and King. "
         "Ave, Ave, Ave, Maria! Ave, Ave, Ave, Maria!")
LINE = "Immaculate Mary, your praises we sing, who reigns now with Christ, our Redeemer and King. "
# Whisper on the stored clip 722f8eb83a, made with five Aves (its CER is 0.033, under the pass line).
FIVE_AVES = LINE + "Ave, ave, ave, Maria, ave, ave, Maria."


def take(speech_s: float) -> np.ndarray:
    """A finished take: 40 ms of silence, `speech_s` of voice, 250 ms of silence."""
    t = np.arange(int(speech_s * SR)) / SR
    voice = 0.1 * np.sin(2 * np.pi * 200 * t) * (1 + 0.3 * np.sin(2 * np.pi * 5 * t))
    return np.concatenate([np.zeros(int(0.04 * SR)), voice, np.zeros(int(0.25 * SR))]).astype(np.float32)


def judge(monkeypatch, text: str, heard: str, lang: str = "en") -> qa.QAResult:
    """qa.evaluate of a take of `text` at the voice's own pace, Whisper having heard `heard`."""
    pace_ref = PACE_REF[lang]
    speech_s = qa.estimate_syllables(text, lang) / (qa.NORMAL_RATE[lang] * qa.PRAYER_FACTOR * pace_ref)
    words = [{"word": heard, "start": 0.0, "end": 0.04 + speech_s}]
    result = {"text": heard, "segments": [{"start": 0.0, "end": 0.04 + speech_s, "text": heard, "words": words}]}
    monkeypatch.setattr(qa, "transcribe", lambda *a, **k: result)
    return qa.evaluate(take(speech_s), SR, text, lang, pace_ref=pace_ref)


def without_check(monkeypatch, text: str, heard: str, lang: str = "en") -> qa.QAResult:
    with monkeypatch.context() as m:
        m.setattr(qa, "dropped_repeats", lambda *a, **k: [])
        return judge(m, text, heard, lang)


# --------------------------------------------------------------------------- #
# The verse the voice made with five Aves                                     #
# --------------------------------------------------------------------------- #


def test_the_verse_heard_with_five_aves_fails(monkeypatch):
    q = judge(monkeypatch, VERSE, FIVE_AVES)
    assert q.cer < qa.DEFAULT_PASS  # the CER alone passed it: 0.033
    assert without_check(monkeypatch, VERSE, FIVE_AVES).verdict == "pass"
    assert q.verdict == "fail" and q.retake and q.words_failed
    assert q.reasons == [f"cer {q.cer:.3f}: said 'ave' 2 times, not 3"]
    assert q.reasons == ["cer 0.033: said 'ave' 2 times, not 3"]


def test_the_verse_heard_right_passes(monkeypatch):
    q = judge(monkeypatch, VERSE, LINE + "Ave, ave, ave, Maria, ave, ave, ave, Maria.")
    assert q.verdict == "pass" and not q.reasons and not q.retake and not q.words_failed


@pytest.mark.parametrize(
    "heard",
    [
        LINE + "Ave, Ave, Ave-Maria! Ave, Ave, Ave-Maria!",  # hyphenated to the next word
        LINE + "Ave, Ave, Avemaria! Ave, Ave, Avemaria!",  # joined to it
        LINE + "AVE, ave, Ave, MARIA! ave ave ave maria",  # case
        LINE + "Ave Ave Ave Maria. Ave. Ave. Ave. Maria.",  # punctuation, sentence ends inside the run
        LINE + "Avé, Avé, Avé, María! Avé, Avé, Avé, María!",  # accents
        LINE + "Ave, aveave, Maria, ave, ave, ave, Maria.",  # two copies written as one word
    ],
)
def test_whisper_s_writing_is_no_copy_lost(monkeypatch, heard):
    q = judge(monkeypatch, VERSE, heard)
    assert q.verdict == "pass" and not q.reasons and not q.words_failed


def test_a_copy_heard_as_another_word_is_left_to_the_cer(monkeypatch):
    # As many words as the text, though "oh" (read "o") has too few letters to be an "ave".
    heard = LINE + "Ave, ave, ave, Maria, ave, oh, ave, Maria."
    q = judge(monkeypatch, VERSE, heard)
    assert q.reasons == without_check(monkeypatch, VERSE, heard).reasons
    assert not any("said" in r for r in q.reasons)


def test_a_copy_lost_beside_a_word_heard_otherwise(monkeypatch):
    # Whisper's words for "ave Maria" are one word, "Mariah": the letters left are Maria's, not an Ave's.
    q = judge(monkeypatch, VERSE, LINE + "Ave, ave, ave, Maria, ave, ave, Mariah.")
    assert q.verdict == "fail" and q.reasons[-1] == f"cer {q.cer:.3f}: said 'ave' 2 times, not 3"


HEAVEN = ("In heaven the blessed your glory proclaim, On earth we, your children, invoke your fair name. "
          "Ave, Ave, Ave, Maria! Ave, Ave, Ave, Maria!")
# Whisper on take 1 of the pending row 66c27eddda (the male English voice, the worker's seeds; judged
# 2026-11-21): the voice said two drawn-out Aves in each half.
GARBLED = ("In heaven the blessed your glory proclaim. On earth we, your children, invoke your fair name. "
           "Eveveve, eveve, Maria, eveve, eveve, Maria.")


def test_letters_are_no_copy(monkeypatch):
    # Twelve letters where each half's three Aves were: two words, neither of them an Ave. Counted by
    # its letters, each half held three copies, and the take was a marginal clip with four Aves.
    q = judge(monkeypatch, HEAVEN, GARBLED)
    assert qa.DEFAULT_PASS < q.cer < qa.DEFAULT_MARGINAL
    assert without_check(monkeypatch, HEAVEN, GARBLED).verdict == "marginal"
    assert q.verdict == "fail" and q.words_failed and q.words_marginal
    said = f"cer {q.cer:.3f}: said 'ave' 2 times, not 3"
    assert q.reasons == [f"cer {q.cer:.3f} > 0.035", said, said]
    assert q.reasons[0] == "cer 0.096 > 0.035"


ES_JESU = ("¡Oh, muy gentil Jesu! Jesu, Jesu, Jesu, déjame entrar en el número de tus elegidos. Oh Jesús, "
           "salvación de los que creen en Ti; Jesús, consuelo de los que vuelan a Ti.")
# Whisper on take 0 of the pending row 4de2182e60 (the female Spanish voice, the worker's seeds;
# judged 2026-11-21): "Jesús" for each of the four "Jesu".
ES_JESU_HEARD = ("Oh, muy gentil Jesús, Jesús, Jesús, Jesús, déjame entrar en el número de tus elegidos. Oh Jesús, "
                 "salvación de los que creen en ti. Jesús, consuelo de los que vuelan a ti.")


def test_a_copy_spelled_longer_is_still_counted_once(monkeypatch):
    # "Jesús" holds "jesu": each is one copy, so the four are four, and three are three. By letters,
    # three Jesús (15) made four copies of a four-letter word, and a copy cut from the audio of a real
    # take was not missed.
    assert judge(monkeypatch, ES_JESU, ES_JESU_HEARD, "es").verdict == "pass"
    three = ES_JESU_HEARD.replace("Jesús, Jesús, Jesús, Jesús,", "Jesús, Jesús, Jesús,")
    q = judge(monkeypatch, ES_JESU, three, "es")
    assert without_check(monkeypatch, ES_JESU, three, "es").verdict == "marginal"
    assert q.verdict == "fail" and q.reasons[-1] == f"cer {q.cer:.3f}: said 'jesu' 3 times, not 4"


@pytest.mark.parametrize(
    "heard",
    [
        "Ave, ave, ave, Mariah. Ave, ave, ave, Maria.",  # the first half's last word written otherwise
        "Ave, ave, Avemaria. Ave, ave, ave, Maria.",  # its last Ave joined to it
    ],
)
def test_the_bare_refrain_heard_otherwise_in_its_first_half_only(monkeypatch, heard):
    # Lined up longest stretch first, the text's first half went with the transcript's second, and
    # the whole second half was lost ("said 'ave' 0 times, not 3").
    q = judge(monkeypatch, REFRAIN, heard)
    assert not any("said" in r for r in q.reasons) and q.reasons == without_check(monkeypatch, REFRAIN, heard).reasons
    # A copy lost from the second half is still lost.
    short = heard.replace("Ave, ave, ave, Maria.", "Ave, ave, Maria.")
    assert qa.dropped_repeats(REFRAIN, short, "en") == [("ave", 2, 3)]


def test_the_words_line_up_in_order_with_a_lost_copy_last():
    words = "ave ave ave maria ave ave ave maria".split()
    assert qa.word_alignment(words, "ave ave ave mariah ave ave ave maria".split()) == {
        0: 0, 1: 1, 2: 2, 4: 4, 5: 5, 6: 6, 7: 7}
    # A copy fewer: the one lost is the run's last, beside what follows.
    assert qa.word_alignment("ave ave ave maria".split(), "ave ave maria".split()) == {0: 0, 1: 1, 3: 2}
    # A copy heard as another word is one word changed, not one put in and another left out.
    assert qa.word_alignment("ave ave ave maria".split(), "ave eve ave maria".split()) == {0: 0, 2: 2, 3: 3}
    assert qa.word_alignment([], ["ave"]) == {} and qa.word_alignment(["ave"], []) == {}


def test_every_short_run_is_named(monkeypatch):
    # The male voice's takes lost two Aves or more: one from each half, or two from one.
    q = judge(monkeypatch, VERSE, LINE + "Ave, ave, Maria, ave, ave, Maria.")
    assert q.verdict == "fail" and q.reasons[-2:] == [
        f"cer {q.cer:.3f}: said 'ave' 2 times, not 3", f"cer {q.cer:.3f}: said 'ave' 2 times, not 3"]
    q = judge(monkeypatch, VERSE, LINE + "Ave, Maria, ave, ave, ave, Maria.")
    assert q.verdict == "fail" and q.reasons[-1] == f"cer {q.cer:.3f}: said 'ave' 1 time, not 3"


@pytest.mark.parametrize(
    "dropped, verdict",
    [("now ", "pass"), ("Christ, ", "marginal"), ("your praises we sing, ", "fail")],
)
def test_a_word_not_repeated_is_judged_by_the_cer_as_before(monkeypatch, dropped, verdict):
    heard = (LINE + "Ave, ave, ave, Maria, ave, ave, ave, Maria.").replace(dropped, "")
    q = judge(monkeypatch, VERSE, heard)
    before = without_check(monkeypatch, VERSE, heard)
    assert (q.verdict, q.reasons, q.score) == (verdict, before.reasons, before.score)
    assert q.words_failed == (verdict == "fail")


def test_a_word_said_twice_is_no_run(monkeypatch):
    # Whisper writes one of a word said twice running as if the voice had stumbled: it wrote "but I
    # have used it" for a stored clip whose voice says "but I, I have used it" (a shorter cut of
    # the same audio has both). A word said twice is judged by the CER alone.
    text = ("Thou didst give it to me to praise Thee, but I, I have used it to injure Thee and cause "
            "others to offend Thee. I am sorry for my sins.")
    heard = ("Thou didst give it to me to praise thee, but I have used it to injure thee and cause "
             "others to offend thee. I am sorry for my sins.")
    assert qa.REPEAT_MIN == 3
    assert judge(monkeypatch, text, heard).verdict == "pass"


def test_only_the_same_word_makes_a_run(monkeypatch):
    # The strict fold keeps the accent that tells "sí" (yes) from "si" (if); the fair fold, which
    # the transcript is lined up in, reads all three alike.
    text = "Sí, sí, si tú lo quieres, Señor, hágase en mí según tu palabra. Amén."
    assert qa.dropped_repeats(text, "Sí, si tú lo quieres, Señor, hágase en mí según tu palabra. Amén.", "es") == []
    assert qa.repeat_runs(qa.fold_words(text, "es")) == [(0, 3)]  # a run in the fair fold only


# --------------------------------------------------------------------------- #
# Other languages                                                             #
# --------------------------------------------------------------------------- #

SANTO = ("¡Santo, Santo, Santo es el Señor Dios del universo! Llenos están el cielo y la tierra de tu gloria. "
         "Hosanna en el cielo. Bendito el que viene en nombre del Señor. Hosanna en el cielo.")


def test_spanish_santo_santo_santo(monkeypatch):
    heard = SANTO.replace("Santo, Santo, Santo", "Santo, santo")
    q = judge(monkeypatch, SANTO, heard, "es")
    assert q.cer < qa.DEFAULT_MARGINAL and q.verdict == "fail" and q.words_failed
    assert q.reasons[-1] == f"cer {q.cer:.3f}: said 'santo' 2 times, not 3"
    # As Whisper wrote it on a stored clip: the case, the exclamation marks.
    right = "Santo, santo, santo es el Señor Dios del universo. " + SANTO.split("! ", 1)[1]
    assert judge(monkeypatch, SANTO, right, "es").verdict == "pass"


SANCTUS = ("Sanctus, Sanctus, Sanctus, Dominus Deus Sabaoth. Pleni sunt caeli et terra gloria tua. "
           "Hosanna in excelsis. Benedictus qui venit in nomine Domini. Hosanna in excelsis.")
# Whisper's Latin on the stored clip d9f669d782 (Kokoro, female): every Sanctus heard.
SANCTUS_HEARD = ("Sanctus, sanctus, sanctus, Dominus Deus sabaut, pleni sunt celi et terra gloria tua, "
                 "osanna in excelsis, benedictus qui venit in nomine Domini, osanna in excelsis.")


def test_latin_sanctus_sanctus_sanctus(monkeypatch):
    assert judge(monkeypatch, SANCTUS, SANCTUS_HEARD, "la").verdict == "pass"
    short = SANCTUS_HEARD.replace("Sanctus, sanctus, sanctus,", "Sanctus, sanctus,")
    q = judge(monkeypatch, SANCTUS, short, "la")
    assert q.cer < qa.PASS_CER["la"]  # under Latin's pass line
    assert q.verdict == "fail" and q.reasons == [f"cer {q.cer:.3f}: said 'sanctus' 2 times, not 3"]


def test_a_word_spelled_otherwise_every_time_is_still_counted(monkeypatch):
    heard = SANCTUS_HEARD.replace("Sanctus, sanctus, sanctus,", "Sanctus, santus, sanktus,")
    q = judge(monkeypatch, SANCTUS, heard, "la")
    assert not any("said" in r for r in q.reasons)


def test_two_copies_joined_in_latin(monkeypatch):
    # The Latin fold writes a doubled consonant once: "sanctussanctus" folds to "sanctusanctus",
    # which holds two copies all the same.
    heard = SANCTUS_HEARD.replace("Sanctus, sanctus, sanctus,", "Sanctus, sanctussanctus,")
    assert qa.fold_words(heard, "la")[1] == "sanctusanctus"
    assert qa.dropped_repeats(SANCTUS, heard, "la") == []


def test_a_copy_both_joined_and_spelled_otherwise_reads_as_lost():
    # The one false fail of counting copies by their word: two written as one word, and that word
    # not the text's. Another take is made; no clip is kept with a copy missing.
    heard = SANCTUS_HEARD.replace("Sanctus, sanctus, sanctus,", "Sanctus, santussantus,")
    assert qa.dropped_repeats(SANCTUS, heard, "la") == [("sanctus", 2, 3)]


def test_copies_are_counted_inside_one_word():
    assert qa.copies_in("avemaria", "ave") == 1 and qa.copies_in("aveave", "ave") == 2
    assert qa.copies_in("sanctusanctus", "sanctus") == 2 and qa.copies_in("eveveve", "ave") == 0
    assert qa.copies_in("ave", "") == 0
    # Never across two words: where the transcript has fewer words than the text's other words
    # around a run, "a very" might be the Ave lost or two other words; the take is failed.
    text = "Ave, Ave, Ave, Maria, mother, full of grace."
    assert qa.dropped_repeats(text, "Ave, ave, a very full of grace.", "en") == [("ave", 2, 3)]


def test_greek_hagios(monkeypatch):
    text = "Ἅγιος, ἅγιος, ἅγιος Κύριος Σαβαώθ, πλήρης ὁ οὐρανὸς καὶ ἡ γῆ τῆς δόξης σου. Ὡσαννὰ ἐν τοῖς ὑψίστοις."
    heard = "Άγιος, Άγιος, Άγιος Κύριος Σαβαώθ, πλήρης ο ουρανός και η γη της δόξης σου. Ωσαννά εν τοις υψίστοις."
    assert judge(monkeypatch, text, heard, "el").verdict == "pass"
    q = judge(monkeypatch, text, heard.replace("Άγιος, Άγιος, Άγιος", "Άγιος, Άγιος"), "el")
    assert q.verdict == "fail" and q.reasons[-1].endswith(": said 'αγιος' 2 times, not 3")


def test_greek_is_lined_up_by_its_sounds():
    # Whisper spells a Greek word as its modern homophone: "άγειος" for "ἅγιος" (ει and ι are both
    # i). In the fold the transcript is lined up in, that is the same word; as Whisper wrote it, it
    # would be another, and with "Κύριος" lost beside it, a copy lost.
    text = "Ἅγιος, ἅγιος, ἅγιος Κύριος Σαβαώθ, πλήρης ὁ οὐρανὸς καὶ ἡ γῆ τῆς δόξης σου."
    heard = "Άγιος, άγιος, άγειος Σαβαώθ, πλήρης ο ουρανός και η γη της δόξης σου."
    assert qa.fold_words(heard, "el")[:3] == ["aqios"] * 3
    assert qa.dropped_repeats(text, heard, "el") == []


def test_greek_with_a_word_in_latin_letters(monkeypatch):
    # Two Greek clips write a word in Latin letters ("O σώσιμο θύμα"). The phonemic fold the
    # transcript is lined up in drops it, so the strict fold has one word more before the run:
    # the run is the one of the fold lined up, or it would point one word on, at "Κύριος".
    text = "O Θεέ, Ἅγιος, ἅγιος, ἅγιος Κύριος Σαβαώθ, πλήρης ὁ οὐρανὸς καὶ ἡ γῆ τῆς δόξης σου."
    assert len(qa.fold_words(text, "el", strict=True)) == len(qa.fold_words(text, "el")) + 1
    # Every Ἅγιος heard ("Ω" for the Latin O), "Κύριος" lost: no copy of the run lost.
    heard = "Ω Θεέ, Άγιος, Άγιος, Άγιος Σαβαώθ, πλήρης ο ουρανός και η γη της δόξης σου."
    assert qa.dropped_repeats(text, heard, "el") == []
    # One Ἅγιος lost; the Ω Whisper wrote for the O is no copy of it.
    heard = "Ω Θεέ, Άγιος, Άγιος Κύριος Σαβαώθ, πλήρης ο ουρανός και η γη της δόξης σου."
    assert [(n, of) for _, n, of in qa.dropped_repeats(text, heard, "el")] == [(2, 3)]


def test_chinese_is_lined_up_by_character_not_by_its_pinyin():
    # Pinyin reads a character by the word it stands in: 重 is chong2 in 重新 (anew), zhong4 alone.
    # Every 重 was heard and the 新 after them lost, which leaves the last 重 alone: in Pinyin it
    # would no longer line up with the text's, and with the 新 gone it would count as lost.
    text = "主啊，求你重、重、重新坚固我们。"
    heard = "主啊，求你重、重、重坚固我们。"
    assert qa._pinyin(text).split()[4:8] == ["chong2", "chong2", "chong2", "xin1"]
    assert qa._pinyin(heard).split()[4:7] == ["chong2", "chong2", "zhong4"]
    assert qa.dropped_repeats(text, heard, "zh") == []
    assert qa.dropped_repeats(text, "主啊，求你重、重新坚固我们。", "zh") == [("重", 2, 3)]


ZH = "圣、圣、圣，上主、万有的天主，你的光荣充满天地。欢呼之声响彻云霄。奉上主名而来的，当受赞美。欢呼之声响彻云霄。"


def test_chinese_is_counted_by_character(monkeypatch):
    # Whisper may write traditional characters: the same syllables, so no copy is lost.
    trad = "聖、聖、聖，上主、萬有的天主，你的光榮充滿天地。歡呼之聲響徹雲霄。奉上主名而來的，當受讚美。歡呼之聲響徹雲霄。"
    assert judge(monkeypatch, ZH, trad, "zh").verdict == "pass"
    q = judge(monkeypatch, ZH, ZH.replace("圣、圣、圣", "圣、圣"), "zh")
    assert q.ser < qa.PASS_SER["zh"] and q.verdict == "fail"
    assert q.reasons == [f"ser {q.ser:.3f}: said '圣' 2 times, not 3"]


def test_korean_is_counted_by_word(monkeypatch):
    text = "거룩하시도다, 거룩하시도다, 거룩하시도다, 온 누리의 주 하느님. 하늘과 땅에 가득 찬 그 영광. 높은 데서 호산나."
    joined = "거룩하시도다 거룩하시도다거룩하시도다 온누리의 주 하느님 하늘과 땅에 가득찬 그 영광 높은데서 호산나"
    assert judge(monkeypatch, text, joined, "ko").verdict == "pass"  # Whisper's spacing
    q = judge(monkeypatch, text, "거룩하시도다, 거룩하시도다, 온 누리의 주 하느님. 하늘과 땅에 가득 찬 그 영광. 높은 데서 호산나.", "ko")
    assert q.verdict == "fail" and q.reasons[-1].endswith(": said '거룩하시도다' 2 times, not 3")


def test_a_run_across_sentence_ends(monkeypatch):
    text = "Alleluia! Alleluia! Alleluia! The Lord is risen, as He said. Let us rejoice and be glad."
    assert judge(monkeypatch, text, "Alleluia, alleluia, alleluia. The Lord is risen as he said. "
                                    "Let us rejoice and be glad.").verdict == "pass"
    q = judge(monkeypatch, text, "Alleluia, alleluia. The Lord is risen as he said. Let us rejoice and be glad.")
    assert q.verdict == "fail" and q.reasons[-1].endswith(": said 'alleluia' 2 times, not 3")


def test_nothing_heard_is_failed_once():
    assert qa.dropped_repeats(VERSE, "", "en") == [("ave", 0, 3), ("ave", 0, 3)]


def test_no_speech_is_not_also_a_dropped_repeat(monkeypatch):
    q = judge(monkeypatch, VERSE, "")
    assert q.reasons[0] == "no speech recognised" and not any("said" in r for r in q.reasons)
    assert q.words_failed


# --------------------------------------------------------------------------- #
# The words a run is found in                                                 #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "text, lang",
    [
        ("Ἅγιος, ἅγιος, ἅγιος Κύριος Σαβαώθ.", "el"),
        ("Sanctus, Sanctus, Sanctus Dominus Deus Sabaoth.", "la"),
        ("Banal, banal, banal na Panginoon ng mga hukbo.", "tl"),
        ("圣、圣、圣，上主万军的天主。", "zh"),
        ("Thánh, Thánh, Thánh, Chúa là Thiên Chúa các đạo binh.", "vi"),
    ],
)
def test_the_words_join_to_the_fold(text, lang):
    for strict in (False, True):
        words = qa.fold_words(text, lang, strict=strict)
        sep = "" if lang in qa.NO_SPACES else " "
        assert sep.join(words) == qa.fold(text, lang, strict=strict)
        assert len(qa.repeat_runs(words)) == 1


def test_korean_words_are_its_hangul_between_spaces():
    text = "거룩하시도다, 거룩하시도다, 거룩하시도다. 아멘."
    assert qa.fold_words(text, "ko") == ["거룩하시도다"] * 3 + ["아멘"]
    assert "".join(qa.fold_words(text, "ko", strict=True)) == qa.fold(text, "ko", strict=True)


def test_runs():
    assert qa.repeat_runs("a a a b a a c c c c".split()) == [(0, 3), (6, 10)]
    assert qa.repeat_runs("a a b".split()) == []
    assert qa.repeat_runs("a a b".split(), least=2) == [(0, 2)]
