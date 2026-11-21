"""make_clip's per-sentence fallback: a clip none of whose takes said its words right is said again a
sentence at a time, and kept when that judges better.

No model is loaded. A fake engine speaks a tone as long as the words it is given, and qa.evaluate
is replaced by a script of verdicts, so each test decides how every take is judged; what starts
the fallback (words_wrong) is also tied to the real qa.evaluate, with Whisper's answer given.
Also here: where a clip's sentences end (sentence_spans), how they are joined (join_sentences),
and the English syllable count of the Latin words English prayers keep (qa.EN_LATIN_FINAL_E).
"""

import logging
from typing import Optional

import numpy as np
import pytest

import audio as A
import engine
import qa
from engine import (
    SENTENCE_FALLBACK_KINDS,
    SENTENCE_PAUSE_S,
    Engine,
    Take,
    best_take,
    borrowed_takes,
    failed_on_words,
    join_sentences,
    sentence_seed,
    split_sentences,
    stable_seed,
    word_error,
    words_wrong,
)

SR = 24000
REFRAIN = "Ave, Ave, Ave, Maria! Ave, Ave, Ave, Maria!"
HALF = "Ave, Ave, Ave, Maria!"
TWO = "Hail Mary, full of grace. The Lord is with thee."
KEY = "b5517f70c4bc5979c2697209bc5a5dcceab1ff60"
# The verse of pending row 769bb1318d: a line, then the refrain's two halves, the same words.
LINE_S = "Immaculate Mary, your praises we sing, Who reigns now with Christ, our Redeemer and King."
VERSE = f"{LINE_S} {REFRAIN}"


# --------------------------------------------------------------------------- #
# Where sentences end                                                         #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "text, lang, sentences",
    [
        (REFRAIN, "en", [HALF, HALF]),
        (TWO, "en", ["Hail Mary, full of grace.", "The Lord is with thee."]),
        ("¡Ave María! ¿Quién como Dios?", "es", ["¡Ave María!", "¿Quién como Dios?"]),
        ("“Lord, I am not worthy.” Say but the word.", "en", ["“Lord, I am not worthy.”", "Say but the word."]),
        ("Glory to God… And peace on earth.", "en", ["Glory to God…", "And peace on earth."]),
        ("因父、及子、及圣神之名。阿们。", "zh", ["因父、及子、及圣神之名。", "阿们。"]),
        ("성부와 성자와 성령의 이름으로. 아멘.", "ko", ["성부와 성자와 성령의 이름으로.", "아멘."]),
        # A semicolon ends a sentence in Greek only, where it is the question mark.
        ("Πού είσαι; Ελέησόν με.", "el", ["Πού είσαι;", "Ελέησόν με."]),
        ("Lord, hear us; Christ, graciously hear us.", "en", ["Lord, hear us; Christ, graciously hear us."]),
    ],
)
def test_sentences_end_where_the_website_ended_them(text, lang, sentences):
    assert split_sentences(text, lang) == sentences


@pytest.mark.parametrize(
    "text, lang",
    [
        ("Hail Mary, full of grace, the Lord is with thee", "en"),  # no closing mark
        ("O Mary! which you exhibited at the foot of the cross.", "en"),  # a small letter goes on
        ("Pray for us, O holy Mother of God.", "en"),
        ("Ave Maria, gratia plena, Dominus tecum.", "la"),
    ],
)
def test_one_sentence_is_not_split(text, lang):
    assert split_sentences(text, lang) == [text]


@pytest.mark.parametrize(
    "text, lang, sentences",
    [
        ("Pray for us, St. Anne, mother of Mary.", "en", None),
        ("Ruega por nosotros, oh Santo St. Teresa, Para que seamos dignos.", "es", None),
        ("Pray for us, Mt. Carmel's Queen. Amen.", "en", ["Pray for us, Mt. Carmel's Queen.", "Amen."]),
        ("Hail, B. V. M. Pray for us.", "en", ["Hail, B. V. M. Pray for us."]),  # initials
        ("Ten piedad de nosotros. R. Ten piedad de nosotros.", "es",
         ["Ten piedad de nosotros.", "R. Ten piedad de nosotros."]),
        ("Módl się za nami. Św. Józefie, módl się za nami.", "pl",
         ["Módl się za nami.", "Św. Józefie, módl się za nami."]),
        ("Bitte für uns, hl. Josef. Amen.", "de", ["Bitte für uns, hl. Josef.", "Amen."]),
    ],
)
def test_never_after_an_abbreviation(text, lang, sentences):
    assert split_sentences(text, lang) == (sentences or [text])


@pytest.mark.parametrize(
    "text, lang, sentences",
    [
        # A number is read by the word after it: "am achten Dezember", never "am acht. Dezember".
        ("Wir feiern am 8. Dezember das Fest. Amen.", "de", ["Wir feiern am 8. Dezember das Fest.", "Amen."]),
        ("1. Todas las cosas cambian aquí. Dios no se muda.", "es",
         ["1. Todas las cosas cambian aquí.", "Dios no se muda."]),
        ("In the year 1917. Then the war ended.", "en", ["In the year 1917. Then the war ended."]),
        ("II. We offer unto Thee, O eternal Father. Amen.", "en",
         ["II. We offer unto Thee, O eternal Father.", "Amen."]),
        ("Da Juan Pablo II. Amén.", "es", ["Da Juan Pablo II. Amén."]),
        ("It weighs 3.5 pounds. Amen.", "en", ["It weighs 3.5 pounds.", "Amen."]),
    ],
)
def test_never_inside_a_number(text, lang, sentences):
    assert split_sentences(text, lang) == sentences


def test_the_spans_point_at_the_sentences_as_written():
    text = "  Hail Mary.   Amen.  "
    spans = engine.sentence_spans(text, "en")
    assert [text[a:b] for a, b in spans] == ["Hail Mary.", "Amen."]


EN_FEMALE = "qwen3-tts-1.7b-base:lock:en-female-v1"


@pytest.mark.parametrize(
    "voice, text, lang",
    [
        (EN_FEMALE, REFRAIN, "en"),
        (EN_FEMALE, "Saint Joseph, pray for us 3 times. Pope John Paul II prayed it. Amen.", "en"),
        ("qwen3-tts-1.7b-base:lock:de-female-v1", "Am 8. Dezember beten wir. Johannes Paul II. Amen.", "de"),
        ("qwen3-tts-1.7b-base:lock:es-female-v1", "Rezamos 21 avemarías. ¡Ave María! Amén.", "es"),
        ("qwen3-tts-1.7b-base:lock:zh-female-v1", "因父、及子、及圣神之名。阿们。", "zh"),
        ("voxcpm2:lock:el-male-v1", "Πού είσαι; Ελέησόν με.", "el"),
    ],
)
def test_the_sentences_give_the_voice_the_whole_clip_s_words(voice, text, lang):
    eng = Engine()  # reads voices/registry.json; loads no model
    spec = eng.spec(voice)
    sentences = eng.sentences(spec, text, lang)
    assert len(sentences) >= 2
    assert [s for s, _ in sentences] == split_sentences(text, lang)
    for sentence, spoken in sentences:
        assert spoken == eng.spoken_text(spec, sentence, lang)
    joined = "".join(spoken for _, spoken in sentences)
    assert joined.replace(" ", "") == eng.spoken_text(spec, text, lang).replace(" ", "")


def test_sentences_read_otherwise_apart_stay_together(monkeypatch):
    # Were a full stop after a number ever a cut, normalize.py would read "am 8." alone as
    # "am acht." where the clip says "am achten Dezember": those two stay one sentence.
    monkeypatch.setattr(engine, "_ends_no_sentence", lambda before: False)
    text = "Wir feiern am 8. Dezember das Fest. Amen."
    assert split_sentences(text, "de") == ["Wir feiern am 8.", "Dezember das Fest.", "Amen."]
    eng = Engine()
    spec = eng.spec("qwen3-tts-1.7b-base:lock:de-female-v1")
    assert eng.sentences(spec, text, "de") == [
        ("Wir feiern am 8. Dezember das Fest.", "Wir feiern am achten Dezember das Fest."),
        ("Amen.", "Amen."),
    ]


def test_a_sentence_without_a_letter_stays_with_the_one_before():
    eng = Engine()
    spec = eng.spec(EN_FEMALE)
    assert split_sentences("Gloria! ! Amen.", "en") == ["Gloria!", "!", "Amen."]
    assert [s for s, _ in eng.sentences(spec, "Gloria! ! Amen.", "en")] == ["Gloria! !", "Amen."]
    assert eng.sentences(spec, "Amen. !", "en") == []  # one sentence with letters: nothing to split
    # Two Spanish clips end on a stray list number like this one ("... eternidad. 10.").
    es = eng.spec("qwen3-tts-1.7b-base:lock:es-female-v1")
    text = "Como Él te ama siempre. Y con ese amor te ama. 10."
    assert split_sentences(text, "es") == ["Como Él te ama siempre.", "Y con ese amor te ama.", "10."]
    assert [s for s, _ in eng.sentences(es, text, "es")] == ["Como Él te ama siempre.", "Y con ese amor te ama. 10."]


def test_a_single_sentence_clip_has_no_sentences_to_say_apart():
    eng = Engine()
    spec = eng.spec(EN_FEMALE)
    assert eng.sentences(spec, "Ave, Ave, Ave, Maria!", "en") == []


# --------------------------------------------------------------------------- #
# A fake engine and a scripted QA                                             #
# --------------------------------------------------------------------------- #

REGISTRY = {
    "qwen": {"kind": "qwen3", "lang": "en", "repo": "fake/qwen3", "speaker": "Fake", "pace_ref": 0.986},
    "voxcpm": {"kind": "voxcpm2", "lang": "pl", "repo": "fake/voxcpm2", "lock": "pl-fake", "pace_ref": 1.03},
    "kokoro": {"kind": "kokoro", "lang": "la", "repo": "fake/kokoro", "kokoro_voice": "if_sara",
               "front_end": "latin-ipa", "params": {"speed": 0.85}},
}


class FakeEngine(Engine):
    """Speaks without a model: a tone 60 ms long per character it is given, so a sentence said
    alone is shorter than the clip. Remembers every call: (words, seed, params)."""

    def __init__(self, registry=None):
        super().__init__(registry=registry or REGISTRY)
        self.calls: list[tuple[str, int, dict]] = []

    def synthesize(self, spec, spoken, lang, seed, params):
        self.calls.append((spoken, seed, dict(params)))
        t = np.arange(int(0.06 * SR * len(spoken))) / SR
        return (0.2 * np.sin(2 * np.pi * 200 * t)).astype(np.float32), SR


def verdict(kind: str, score: float, cer: Optional[float] = None) -> qa.QAResult:
    """A QA result: 'pass', 'words' (failed on its words), 'repeat' (a word of a run lost, at a
    CER under the pass line), 'ser' (failed on whole syllables), 'pace' (failed on pace alone),
    'tail' (failed on an untranscribed tail alone), 'marginal-pace' (pace a little off, words
    right), 'marginal-words' (words a little off) or 'marginal-words+pace' (words a little off,
    failed on pace). `cer` sets the character error the words were judged by."""
    c = cer if cer is not None else {"words": 0.114, "repeat": 0.033, "marginal-words": 0.05,
                                     "marginal-words+pace": 0.05}.get(kind, 0.0)
    reasons, v, words_failed, words_marginal = {
        "pass": ([], "pass", False, False),
        "words": ([f"cer {c:.3f} > 0.1"], "fail", True, False),
        "repeat": ([f"cer {c:.3f}: said 'ave' 2 times, not 3"], "fail", True, False),
        "ser": (["ser 0.200 > 0.15"], "fail", True, False),
        "pace": (["pace 0.55x the voice's own pace"], "fail", False, False),
        "tail": (["untranscribed tail 1.2s"], "fail", False, False),
        "marginal-pace": (["pace 0.70x the voice's own pace"], "marginal", False, False),
        "marginal-words": ([f"cer {c:.3f} > 0.035"], "marginal", False, True),
        "marginal-words+pace": ([f"cer {c:.3f} > 0.035", "pace 0.55x the voice's own pace"], "fail", False, True),
    }[kind]
    return qa.QAResult(
        lang="en", verdict=v, score=score, cer=c, cer_strict=c, ser=None, transcript=kind,
        reference="", diff=[], duration_s=1.0, speech_s=1.0, syllables=8, syl_per_s=4.0,
        pace_ratio=1.0, max_silence_s=0.0, tail_gap_s=0.1, extra_start=0, extra_end=0, lufs=-18.0,
        true_peak=-3.0, f0_median_hz=200.0, f0_spread_st=2.0, reasons=reasons, retake=v != "pass",
        words_failed=words_failed, words_marginal=words_marginal,
    )


class Judge:
    """Stands in for qa.evaluate: each text judged gets the next verdict of its own list, in the
    order asked (the last repeats), each (kind, score) or (kind, score, cer) as verdict() takes
    them. Remembers what it judged, (text, seconds of audio), and the pace_ref each call was
    given."""

    def __init__(self, script: dict[str, list[tuple]]):
        self.script = {t: list(v) for t, v in script.items()}
        self.judged: list[tuple[str, float]] = []
        self.pace_refs: list[Optional[float]] = []

    def __call__(self, audio, sr, text, lang, *, check=None, pace_ref=None):
        self.judged.append((text, len(audio) / sr))
        self.pace_refs.append(pace_ref)
        queue = self.script[text]
        return verdict(*(queue.pop(0) if len(queue) > 1 else queue[0]))


WORDS4 = [("words", 112.0), ("words", 113.0), ("words", 114.0), ("words", 115.0)]


def run(monkeypatch, script, text=TWO, voice="qwen", lang="en", seed_key=KEY, **kw):
    judge = Judge(script)
    monkeypatch.setattr(qa, "evaluate", judge)
    eng = FakeEngine()
    clip = eng.make_clip(voice, text, lang, seed_key=seed_key, encode=False, **kw)
    return clip, eng, judge


# --------------------------------------------------------------------------- #
# When the fallback runs                                                      #
# --------------------------------------------------------------------------- #


def test_the_fallback_is_for_qwen3_and_voxcpm2_only():
    assert SENTENCE_FALLBACK_KINDS == {"qwen3", "voxcpm2"}


def test_failed_on_words_reads_the_qa_s_own_word():
    assert failed_on_words(verdict("words", 112.0))
    assert failed_on_words(verdict("repeat", 103.0))
    assert failed_on_words(verdict("ser", 110.0))
    assert not failed_on_words(verdict("pace", 105.0))
    assert not failed_on_words(verdict("tail", 105.0))
    assert not failed_on_words(verdict("marginal-words", 15.0))
    # Words a little off and a take that fails on pace: it did not fail on its words.
    assert not failed_on_words(verdict("marginal-words+pace", 112.0))
    assert not failed_on_words(verdict("pass", 1.0))


@pytest.mark.parametrize(
    "kind, wrong",
    [("words", True), ("repeat", True), ("ser", True), ("marginal-words", True), ("marginal-words+pace", True),
     ("pace", False), ("tail", False), ("marginal-pace", False), ("pass", False)],
)
def test_words_wrong_is_words_failed_or_only_marginal(kind, wrong):
    q = verdict(kind, 50.0)
    assert words_wrong(q) is wrong is (failed_on_words(q) or q.words_marginal)


# The real qa.evaluate, Whisper's answer given.
HM_TEXT = "Hail Mary, full of grace, the Lord is with thee. Blessed art thou among women."
QUIET = np.zeros(int(0.04 * SR), np.float32)  # a finished take's quiet before its first sound
AFTER = np.zeros(int(0.25 * SR), np.float32)  # and after its last


def voice_for(seconds: float) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    return (0.1 * np.sin(2 * np.pi * 200 * t) * (1 + 0.3 * np.sin(2 * np.pi * 5 * t))).astype(np.float32)


def judged_as(monkeypatch, audio: np.ndarray, heard: str, last_word_end: float, text: str = HM_TEXT,
              lang: str = "en", pace_ref: Optional[float] = REGISTRY["qwen"]["pace_ref"]) -> qa.QAResult:
    """The real qa.evaluate of `audio` against `text`, Whisper having heard `heard`, its last word
    ending at `last_word_end` seconds."""
    result = {"text": heard, "segments": [{"start": 0.0, "end": last_word_end, "text": heard,
                                           "words": [{"word": heard, "end": last_word_end}]}]}
    monkeypatch.setattr(qa, "transcribe", lambda *a, **k: result)
    return qa.evaluate(audio, SR, text, lang, pace_ref=pace_ref)


def real_qa(monkeypatch, heard: str, speech_s: float, text: str = HM_TEXT) -> qa.QAResult:
    """A take of `text` whose sound lasts `speech_s`, every bit of it written down."""
    return judged_as(monkeypatch, np.concatenate([QUIET, voice_for(speech_s), AFTER]), heard, 0.04 + speech_s, text=text)


def at_pace(text: str = HM_TEXT, pace: float = 1.0) -> float:
    """Seconds of sound for `text` at `pace` times the voice's own pace."""
    return qa.estimate_syllables(text, "en") / (qa.NORMAL_RATE["en"] * qa.PRAYER_FACTOR * REGISTRY["qwen"]["pace_ref"] * pace)


@pytest.mark.parametrize(
    "heard, pace, failed, marginal",
    [
        ("Hail Mary, full of grace. Blessed art thou among women.", 1.0, True, False),  # words missing: cer > 0.1
        ("", 1.0, True, False),  # nothing heard
        (HM_TEXT, 0.5, False, False),  # every word, too slow: a fail on pace alone
        ("Hail Mary, full of grace, the Lord is with thee. Blessed art thou among.", 0.5, False, True),  # marginal words, pace failed
        ("Hail Mary, full of grace, the Lord is with thee. Blessed art thou among.", 1.0, False, True),  # marginal words alone
        (HM_TEXT, 0.65, False, False),  # every word, a little slow: marginal on pace alone
    ],
)
def test_failed_on_words_through_the_real_check(monkeypatch, heard, pace, failed, marginal):
    q = real_qa(monkeypatch, heard, at_pace(pace=pace))
    assert q.verdict == ("fail" if failed or pace < 0.58 else "marginal")
    assert failed_on_words(q) is failed and q.words_failed is failed
    assert q.words_marginal is marginal and words_wrong(q) is (failed or marginal)
    assert q.words_marginal is any(r.startswith("cer ") and " > 0.035" in r for r in q.reasons)


def with_tail(monkeypatch) -> qa.QAResult:
    """Every word heard, and the voice ran on 1.2 s after the last, into sound Whisper did not
    write down."""
    speech_s = at_pace()
    audio = np.concatenate([QUIET, voice_for(speech_s), AFTER])
    return judged_as(monkeypatch, audio, HM_TEXT, 0.04 + speech_s - 1.2)


def with_silence(monkeypatch) -> qa.QAResult:
    """Every word heard, with a silence of 2.6 s inside: the take at the voice's pace all the same."""
    speech_s = at_pace()
    half = voice_for((speech_s - 2.6) / 2)
    audio = np.concatenate([QUIET, half, np.zeros(int(2.6 * SR), np.float32), half, AFTER])
    return judged_as(monkeypatch, audio, HM_TEXT, 0.04 + speech_s)


@pytest.mark.parametrize("make, reason", [(with_tail, "untranscribed tail 1.2s"), (with_silence, "silence 2.6s inside")])
def test_a_take_failed_on_a_tail_or_a_silence_alone_did_not_get_its_words_wrong(monkeypatch, make, reason):
    q = make(monkeypatch)
    assert q.verdict == "fail" and q.reasons == [reason] and q.retake
    assert not q.words_failed and not q.words_marginal and not words_wrong(q)
    # Four such takes: the clip is not said again a sentence at a time.
    monkeypatch.setattr(qa, "evaluate", lambda *a, **k: q)
    eng = FakeEngine()
    clip = eng.make_clip("qwen", TWO, "en", seed_key=KEY, encode=False)
    assert len(eng.calls) == 4 and clip.joined is None and clip.status == "failed"


EL_TEXT = ("Ἅγιος ὁ Θεός, ἅγιος ἰσχυρός, ἅγιος ἀθάνατος, ἐλέησον ἡμᾶς. Δόξα Πατρὶ καὶ Υἱῷ καὶ Ἁγίῳ Πνεύματι, "
           "καὶ νῦν καὶ ἀεὶ καὶ εἰς τοὺς αἰῶνας τῶν αἰώνων. Ἀμήν.")


def test_extra_words_count_against_the_words_by_the_error_they_add(monkeypatch):
    # The words at an end past the limit (12% of the text's letters, 8 at least) fail a take, but
    # not on its words: only the error they add to its characters says how far off its words are.
    # Every pass line is under 12%, so such a take always has its words at least a little off.
    # Here, in Greek, where up to 18% is marginal: every word, then "Κύριε ἐλέησον, Κύριε".
    heard = EL_TEXT + " Κύριε ἐλέησον, Κύριε."
    speech_s = qa.estimate_syllables(heard, "el") / (qa.NORMAL_RATE["el"] * qa.PRAYER_FACTOR * 0.981)
    audio = np.concatenate([QUIET, voice_for(speech_s), AFTER])
    q = judged_as(monkeypatch, audio, heard, 0.04 + speech_s, text=EL_TEXT, lang="el", pace_ref=0.981)
    assert q.verdict == "fail" and q.reasons == [f"cer {q.cer:.3f} > 0.08", "extra words (start 0, end 17 chars)"]
    assert qa.PASS_CER["el"] < q.cer < qa.MARGINAL_CER["el"]
    assert not q.words_failed and q.words_marginal and words_wrong(q)


def test_a_take_without_sound_failed_on_its_words_whatever_whisper_wrote(monkeypatch):
    # Whisper can write a prayer's words over silence (it has heard prayers before): no sound is
    # no words said, and another take or the sentences said apart may give them.
    q = real_qa(monkeypatch, HM_TEXT, 0.0)
    assert q.cer == 0.0 and q.reasons[0] == "no speech recognised"
    assert q.verdict == "fail" and failed_on_words(q)


def test_a_word_lost_from_a_run_fails_on_words_through_the_real_check(monkeypatch):
    text = "Holy, holy, holy Lord God of hosts. Heaven and earth are full of your glory. Hosanna in the highest."
    q = real_qa(monkeypatch, "Holy, holy Lord God of hosts. Heaven and earth are full of your glory. Hosanna in the highest.",
                at_pace(text), text=text)
    assert q.verdict == "fail" and failed_on_words(q)
    assert q.reasons[-1] == f"cer {q.cer:.3f}: said 'holy' 2 times, not 3"


def test_a_clip_that_passes_on_a_whole_take_is_made_exactly_as_before(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger="voice_engine")
    monkeypatch.setattr(Engine, "sentences", lambda *a: pytest.fail("no sentence work for a clip that passed"))
    clip, eng, judge = run(monkeypatch, {TWO: [("words", 112.0), ("pass", 1.0)]})
    base = stable_seed("qwen", TWO, KEY)
    spoken = eng.spoken_text(eng.spec("qwen"), TWO, "en")
    assert [(s, seed) for s, seed, _ in eng.calls] == [(spoken, base), (spoken, base + 7919)]
    assert [t for t, _ in judge.judged] == [TWO, TWO]
    assert clip.best is clip.takes[1] and len(clip.takes) == 2
    assert clip.joined is None and clip.sentence_takes == [] and not clip.per_sentence
    assert not [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert [r.getMessage().split()[0] for r in caplog.records if r.name == "voice_engine"] == ["take", "take"]


def test_runs_after_every_whole_take_failed_on_its_words(monkeypatch):
    clip, eng, judge = run(monkeypatch, {TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
                                         "The Lord is with thee.": [("pass", 1.0)]})
    assert len(clip.takes) == 4
    assert [t for t, _ in judge.judged] == [TWO] * 4 + ["Hail Mary, full of grace.", "The Lord is with thee.", TWO]
    assert [s for s, _, _ in eng.calls[4:]] == ["Hail Mary, full of grace.", "The Lord is with thee."]
    assert clip.joined is not None and [len(ts) for ts in clip.sentence_takes] == [1, 1]


def test_runs_for_voxcpm2_too(monkeypatch):
    text = "Zdrowaś Maryjo, łaski pełna. Amen."
    clip, _, _ = run(monkeypatch, {text: WORDS4 + [("pass", 2.0)], "Zdrowaś Maryjo, łaski pełna.": [("pass", 1.0)],
                                   "Amen.": [("pass", 1.0)]}, text=text, voice="voxcpm", lang="pl")
    assert clip.per_sentence and clip.status == "done"


def test_a_failure_on_syllables_counts_as_one_on_words(monkeypatch):
    script = {TWO: [("ser", 110.0)] * 4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("pass", 1.0)]}
    clip, _, _ = run(monkeypatch, script)
    assert clip.per_sentence


@pytest.mark.parametrize(
    "whole",
    [
        [("words", 112.0), ("pace", 105.0), ("words", 113.0), ("words", 114.0)],  # one failed on pace alone
        [("marginal-words", 15.0), ("marginal-pace", 12.0), ("marginal-words", 16.0), ("marginal-words", 17.0)],
        [("pace", 105.0)] * 4,
        [("marginal-pace", 12.0)] * 4,  # usable takes, their words right
    ],
)
def test_not_unless_no_whole_take_said_its_words_right(monkeypatch, whole):
    clip, eng, _ = run(monkeypatch, {TWO: whole})
    assert len(eng.calls) == 4 and clip.joined is None and not clip.per_sentence


@pytest.mark.parametrize(
    "whole",
    [
        [("marginal-words", 15.0)] * 4,  # usable takes, their words a little off: a sentence missing
        [("marginal-words+pace", 112.0)] * 4,  # words a little off, each failed on its pace too
        [("words", 112.0), ("marginal-words", 15.0), ("repeat", 103.0), ("marginal-words+pace", 112.0)],
    ],
)
def test_runs_when_the_whole_takes_had_their_words_only_marginal(monkeypatch, whole):
    script = {TWO: whole + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("pass", 1.0)]}
    clip, eng, judge = run(monkeypatch, script)
    assert len(clip.takes) == 4 and [len(ts) for ts in clip.sentence_takes] == [1, 1]
    assert clip.per_sentence and clip.status == "done" and clip.last_error is None


def test_not_for_a_clip_of_one_sentence(monkeypatch):
    clip, eng, _ = run(monkeypatch, {HALF: WORDS4}, text=HALF)
    assert len(eng.calls) == 4 and clip.joined is None


def test_not_for_kokoro(monkeypatch):
    text = "Ave Maria, gratia plena. Dominus tecum."
    clip, eng, _ = run(monkeypatch, {text: WORDS4}, text=text, voice="kokoro", lang="la")
    assert len(eng.calls) == 4 and clip.joined is None and clip.status == "failed"


# --------------------------------------------------------------------------- #
# Each sentence's takes                                                       #
# --------------------------------------------------------------------------- #


def test_each_sentence_is_judged_against_its_own_words_and_stops_on_pass(monkeypatch):
    script = {
        REFRAIN: WORDS4 + [("pass", 2.0)],
        # Both halves are the same words: the first is judged first, in two takes; then the second.
        HALF: [("words", 120.0), ("pass", 1.5), ("pass", 1.0)],
    }
    clip, eng, judge = run(monkeypatch, script, text=REFRAIN)
    assert [t for t, _ in judge.judged] == [REFRAIN] * 4 + [HALF, HALF, HALF, REFRAIN]
    assert [len(ts) for ts in clip.sentence_takes] == [2, 1]
    assert clip.best.sentences == [clip.sentence_takes[0][1], clip.sentence_takes[1][0]]
    # A sentence's audio is that sentence alone: shorter than the whole clip's.
    whole_s = judge.judged[0][1]
    assert all(seconds < 0.6 * whole_s for _, seconds in judge.judged[4:7])


def test_a_sentence_keeps_its_best_take_when_none_passes(monkeypatch):
    script = {
        TWO: WORDS4 + [("words", 111.0)],
        "Hail Mary, full of grace.": [("words", 130.0), ("words", 101.0), ("words", 140.0), ("words", 150.0)],
        "The Lord is with thee.": [("pass", 1.0)],
    }
    clip, _, _ = run(monkeypatch, script)
    assert [len(ts) for ts in clip.sentence_takes] == [4, 1]
    assert clip.joined.sentences[0] is clip.sentence_takes[0][1]  # 101, the best of its four


def test_sentence_seeds_come_from_the_clip_s_seed(monkeypatch):
    script = {TWO: WORDS4 + [("words", 120.0)], "Hail Mary, full of grace.": [("words", 130.0)],
              "The Lord is with thee.": [("words", 130.0)]}
    _, eng, _ = run(monkeypatch, script)
    base = stable_seed("qwen", TWO, KEY)
    seeds = [seed for _, seed, _ in eng.calls]
    assert seeds[:4] == [base + 7919 * k for k in range(4)]
    assert seeds[4:8] == [sentence_seed(base, 0) + 7919 * k for k in range(4)]
    assert seeds[8:] == [sentence_seed(base, 1) + 7919 * k for k in range(4)]
    assert len(set(seeds)) == 12  # distinct per sentence and take, and from the whole clip's
    # The same clip says its sentences the same way again; a retry says them anew.
    _, again, _ = run(monkeypatch, script)
    assert [seed for _, seed, _ in again.calls] == seeds
    _, retry, _ = run(monkeypatch, script, seed_key=f"{KEY}:retry2")
    assert not set(seed for _, seed, _ in retry.calls) & set(seeds)


def test_sentence_takes_vary_like_whole_takes(monkeypatch):
    script = {TWO: WORDS4 + [("words", 120.0)], "Hail Mary, full of grace.": [("words", 130.0)],
              "The Lord is with thee.": [("words", 130.0)]}
    _, eng, _ = run(monkeypatch, script)
    temps = [p["temperature"] for _, _, p in eng.calls]
    assert temps[4:8] == temps[:4] and temps[8:] == temps[:4]


def test_the_voice_s_tempo_is_applied_to_each_sentence_once(monkeypatch):
    seen: list[float] = []

    def change_tempo(audio, sr, tempo):
        seen.append(round(float(tempo), 3))
        return audio

    monkeypatch.setattr(A, "change_tempo", change_tempo)
    registry = {"qwen": dict(REGISTRY["qwen"], tempo=1.182)}
    judge = Judge({TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
                   "The Lord is with thee.": [("pass", 1.0)]})
    monkeypatch.setattr(qa, "evaluate", judge)
    FakeEngine(registry).make_clip("qwen", TWO, "en", seed_key=KEY, encode=False)
    # Every take of the whole clip and of each sentence as make_clip finishes a take; the join
    # is finished at 1.0, as its sentences already have the voice's tempo.
    assert seen == [1.182] * 4 + [1.182, 1.182] + [1.0]


# --------------------------------------------------------------------------- #
# The joined clip                                                             #
# --------------------------------------------------------------------------- #


def tone(seconds: float, level: float = 0.2) -> np.ndarray:
    t = np.arange(int(round(seconds * SR))) / SR
    return (level * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def finished(seconds: float) -> np.ndarray:
    return A.finish(tone(seconds), SR).audio


def test_sentences_are_joined_with_a_sentence_s_pause():
    assert 0.3 <= SENTENCE_PAUSE_S <= 0.45
    parts = [finished(1.0), finished(0.6)]
    out = join_sentences(parts, SR)
    s, e = A.speech_bounds(out, SR)
    sil = A.silences(out, SR)
    assert len(sil) == 1 and sil[0][1] == pytest.approx(SENTENCE_PAUSE_S, abs=0.02)
    # Both sentences whole: all their sound, nothing cut from it.
    sound = sum(A.speech_bounds(p, SR)[1] - A.speech_bounds(p, SR)[0] for p in parts)
    assert (e - s) == pytest.approx(sound + SENTENCE_PAUSE_S * SR, abs=0.02 * SR)
    # The cuts fade to nothing, and the pause between them is silence.
    assert out[0] == 0 and out[-1] == 0
    mid = int(sil[0][0] * SR)
    assert not np.any(out[mid + int(0.03 * SR): mid + int(0.4 * SR)])


def test_a_part_without_sound_adds_nothing():
    one = finished(0.8)
    alone = join_sentences([one], SR)
    assert np.array_equal(join_sentences([np.zeros(SR, np.float32), one], SR), alone)
    assert not A.silences(alone, SR)


def with_floor(seconds: float, seed: int, floor: float = 5e-4) -> np.ndarray:
    """A take whose quiet is not silence, as a voice's never is (breath, the model's own noise): a
    tone between 0.3 s of quiet, all of it over a noise floor about 66 dB under full scale (under
    the speech threshold: audio.speech_bounds finds the tone alone)."""
    x = np.concatenate([np.zeros(int(0.3 * SR), np.float32), tone(seconds), np.zeros(int(0.3 * SR), np.float32)])
    return (x + floor * np.random.default_rng(seed).standard_normal(len(x))).astype(np.float32)


def test_each_cut_fades_to_nothing_over_the_sentence_s_own_quiet():
    parts = [with_floor(1.0, 1), with_floor(0.6, 2)]
    s0, e0 = A.speech_bounds(parts[0], SR)
    s1, e1 = A.speech_bounds(parts[1], SR)
    assert s0 > 0 and e0 < len(parts[0])  # quiet on either side of each sentence's sound
    out = join_sentences(parts, SR)
    edge = int(round(engine.SENTENCE_EDGE_S * SR))
    ms = SR // 1000
    zeros = np.flatnonzero(out == 0)
    gap = zeros[(zeros > edge) & (zeros < len(out) - edge)]  # the silence put between the sentences
    first, last = int(gap[0]), int(gap[-1])
    assert np.all(out[first:last + 1] == 0)
    # Each sentence keeps SENTENCE_EDGE_S of its own quiet beside its sound ...
    assert first == (e0 - s0) + 2 * edge - 1  # its last sample faded to zero, then the pause
    assert len(out) - last - 1 == (e1 - s1) + 2 * edge - 1
    # ... faded to nothing at every cut: no step from the noise floor to silence.
    for cut in (out[:ms], out[first - ms:first], out[last + 1:last + 1 + ms], out[-ms:]):
        assert np.max(np.abs(cut)) < 5e-5
    # The noise floor itself is still there a little way in (it is the sentence's own sound).
    assert np.max(np.abs(out[edge // 2: edge])) > 5e-5


def test_the_joined_clip_is_finished_and_judged_against_the_whole_text(monkeypatch):
    script = {TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("pass", 1.0)]}
    clip, _, judge = run(monkeypatch, script)
    fin = clip.joined.finished
    assert judge.judged[-1] == (TWO, pytest.approx(fin.duration_s))
    assert fin.lufs == pytest.approx(A.TARGET_LUFS, abs=0.5) and fin.true_peak <= A.TRUE_PEAK_DBTP + 0.1
    sil = A.silences(fin.audio, SR)
    assert len(sil) == 1 and sil[0][1] == pytest.approx(SENTENCE_PAUSE_S, abs=0.02)


def test_a_joined_clip_that_judges_better_becomes_the_best_take(monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="voice_engine")
    script = {TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("words", 125.0), ("pass", 1.0)]}
    clip, _, _ = run(monkeypatch, script)
    assert clip.best is clip.joined and clip.per_sentence
    assert clip.best.sentences == [clip.sentence_takes[0][0], clip.sentence_takes[1][1]]
    assert clip.status == "done" and clip.last_error is None and clip.qa_score == 1.0
    # clip.takes stays the whole clip's four takes; the joined one comes after them.
    assert clip.best.index == 4 and len(clip.takes) == 4 and all(t is not clip.best for t in clip.takes)
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 2
    assert "no take of the whole clip said its words right (best: cer 0.114 > 0.1; heard 'words')" in warnings[0]
    assert "sentences pass in 1, pass in 2;" in warnings[1]
    assert "; kept (best take of the whole clip: fail, score 112.0)" in warnings[1]


@pytest.mark.parametrize("joined_score", [130.0, 112.0])  # worse, and only as good
def test_a_joined_clip_that_judges_no_better_is_not_kept(monkeypatch, caplog, joined_score):
    caplog.set_level(logging.WARNING, logger="voice_engine")
    script = {TWO: WORDS4 + [("words", joined_score)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("pass", 1.0)]}
    clip, _, _ = run(monkeypatch, script)
    assert clip.best is clip.takes[0] and not clip.per_sentence
    assert clip.joined is not None and clip.joined.qa.score == joined_score  # recorded all the same
    assert clip.status == "failed"
    assert "; not kept, as it judges no better (best take of the whole clip: fail, score 112.0)" in caplog.records[-1].getMessage()


def test_a_joined_clip_with_a_failed_sentence_is_not_kept(monkeypatch, caplog):
    # Each take of the second sentence ran on into sound Whisper did not write down (an untranscribed
    # tail, a FAIL). Joined, that sound sits before the pause, inside the clip, where the joined
    # clip's own check does not look for a tail; so the join is not kept, though it judges better.
    caplog.set_level(logging.WARNING, logger="voice_engine")
    script = {TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("tail", 105.0)] * 4}
    clip, _, _ = run(monkeypatch, script)
    assert [len(ts) for ts in clip.sentence_takes] == [1, 4]
    assert clip.joined.qa.score == 2.0 < clip.takes[0].qa.score
    assert clip.best is clip.takes[0] and not clip.per_sentence and clip.status == "failed"
    message = caplog.records[-1].getMessage()
    assert "sentences pass in 1, fail in 4;" in message
    assert ("; not kept, as the best take of 'The Lord is with thee.' (untranscribed tail 1.2s) failed its own "
            "check (best take of the whole clip: fail, score 112.0)") in message


def test_every_failed_sentence_is_named(monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="voice_engine")
    script = {TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("repeat", 103.0)] * 4,
              "The Lord is with thee.": [("pace", 105.0)] * 4}
    clip, _, _ = run(monkeypatch, script)
    assert not clip.per_sentence
    assert ("not kept, as the best take of 'Hail Mary, full of grace.' (cer 0.033: said 'ave' 2 times, not 3) and of "
            "'The Lord is with thee.' (pace 0.55x the voice's own pace) each failed its own check") in caplog.records[-1].getMessage()


def test_a_marginal_sentence_does_not_keep_the_join_out(monkeypatch):
    script = {TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("marginal-words", 15.0)] * 4}
    clip, _, _ = run(monkeypatch, script)
    assert clip.per_sentence and clip.best.sentences[1].qa.verdict == "marginal"


# --------------------------------------------------------------------------- #
# A clip whose whole takes had their words only marginal                      #
# --------------------------------------------------------------------------- #

# Four usable takes of the whole clip, their words a little off (each its own character error).
MARGINAL4 = [("marginal-words", 15.0, 0.05), ("marginal-words", 16.0, 0.06), ("marginal-words", 17.0, 0.07),
             ("marginal-words", 18.0, 0.08)]
SENTENCES_PASS = {"Hail Mary, full of grace.": [("pass", 1.0)], "The Lord is with thee.": [("pass", 1.0)]}


@pytest.mark.parametrize(
    "joined, kept, outcome",
    [
        (("pass", 2.0, 0.0), True, "kept"),  # every word: better words and a better score
        (("marginal-words", 14.0, 0.049), True, "kept"),  # a little better in both
        (("marginal-words", 14.0, 0.05), False, "not kept, as its words are no better (cer 0.050, the whole clip's 0.050)"),
        (("marginal-words", 14.0, 0.06), False, "not kept, as its words are no better (cer 0.060, the whole clip's 0.050)"),
        (("marginal-words", 16.0, 0.04), False, "not kept, as it judges no better"),
    ],
)
def test_a_usable_whole_take_gives_way_only_to_better_words(monkeypatch, caplog, joined, kept, outcome):
    # The best whole take (15.0, CER 0.05) is a clip to give already: a join that judges better on
    # its pace but says its words no better is not worth the cuts between its sentences.
    caplog.set_level(logging.WARNING, logger="voice_engine")
    clip, _, _ = run(monkeypatch, {TWO: MARGINAL4 + [joined], **SENTENCES_PASS})
    assert clip.joined is not None and clip.per_sentence is kept
    assert clip.best is (clip.joined if kept else clip.takes[0])
    assert clip.status == "done"
    assert f"; {outcome} (best take of the whole clip: marginal, score 15.0)" in caplog.records[-1].getMessage()


def test_a_usable_whole_take_stays_against_a_join_with_a_failed_sentence(monkeypatch):
    script = {TWO: MARGINAL4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
              "The Lord is with thee.": [("tail", 105.0)] * 4}
    clip, _, _ = run(monkeypatch, script)
    assert clip.joined.qa.verdict == "pass" and not clip.per_sentence and clip.best is clip.takes[0]


@pytest.mark.parametrize(
    "whole, joined, last_error",
    [
        # Every whole take lost an Ave at a CER of 0.033; the join says all six and Whisper spelled
        # a name otherwise (0.034): a higher character error, words not worse.
        ([("repeat", 103.0, 0.033)] * 4, ("pass", 3.4, 0.034), None),
        # Words a little off and each take failed on its pace: no take to give. The join's words
        # are a little more off, and it is a usable clip.
        ([("marginal-words+pace", 112.0, 0.05)] * 4, ("marginal-words", 16.0, 0.06), "qa:marginal:0.060:cer 0.060 > 0.035"),
    ],
)
def test_with_no_usable_whole_take_a_join_that_judges_better_is_kept(monkeypatch, whole, joined, last_error):
    clip, _, _ = run(monkeypatch, {TWO: whole + [joined], **SENTENCES_PASS})
    assert word_error(clip.joined.qa) > word_error(clip.takes[0].qa)
    assert clip.per_sentence and clip.status == "done" and clip.last_error == last_error


def test_word_error_is_the_syllables_where_qa_judged_by_them():
    q = verdict("pass", 1.0, cer=0.02)
    assert word_error(q) == 0.02
    q.ser = 0.04
    assert word_error(q) == 0.04


# --------------------------------------------------------------------------- #
# Sentences the voice is given the same words for                             #
# --------------------------------------------------------------------------- #


def test_a_failed_sentence_takes_the_passing_take_of_one_with_the_same_words(monkeypatch, caplog):
    # Pending row 769bb1318d, the male English voice (2026-11-21): the refrain's first half failed
    # in 4 takes, its second half, the very same words, passed in 1; the join was not kept for the
    # failed half and the row would have been stored failed.
    caplog.set_level(logging.WARNING, logger="voice_engine")
    script = {VERSE: WORDS4 + [("pass", 2.0)], LINE_S: [("pass", 1.0)], HALF: [("repeat", 103.0)] * 4 + [("pass", 1.0)]}
    clip, _, judge = run(monkeypatch, script, text=VERSE)
    assert [t for t, _ in judge.judged] == [VERSE] * 4 + [LINE_S] + [HALF] * 5 + [VERSE]
    assert [len(ts) for ts in clip.sentence_takes] == [1, 4, 1]
    second = clip.sentence_takes[2][0]
    assert clip.joined.sentences == [clip.sentence_takes[0][0], second, second]
    assert clip.joined.params["borrowed"] == {1: 2}
    assert clip.per_sentence and clip.status == "done"
    message = caplog.records[-1].getMessage()
    assert "sentences pass in 1, fail in 4, so sentence 2's take (the same words), pass in 1; joined pass" in message
    assert "; kept (best take of the whole clip: fail, score 112.0)" in message


def take_judged(kind: str, score: float) -> Take:
    return Take(index=0, seed=0, params={}, raw_sr=SR, gen_s=0.0, finished=None, qa=verdict(kind, score))


def test_only_the_very_same_words_are_borrowed():
    said = [("A.", "Ave, Ave, Ave, Maria!"), ("B.", "Ave, Ave, Ave, Maria."), ("C.", "Ave, ave, Ave, Maria!"),
            ("D.", "Ave, Ave, Ave, Maria!")]
    # The first's twin is the fourth alone: a full stop or a small letter is other words to the voice.
    best = [take_judged("repeat", 103.0), take_judged("pass", 1.0), take_judged("pass", 1.0), take_judged("pass", 2.0)]
    assert borrowed_takes(said, best) == {0: 3}
    # A twin that failed too lends nothing, and a sentence never takes its own take.
    best[3] = take_judged("words", 112.0)
    assert borrowed_takes(said, best) == {}
    assert borrowed_takes(said[:1], best[:1]) == {}
    # The words the voice is given decide, not their writing: a number is given as its words.
    eng = Engine()
    spec = eng.spec(EN_FEMALE)
    said = [(t, eng.spoken_text(spec, t, "en")) for t in ("Glory be, 3 times.", "Glory be, three times.")]
    assert said[0][1] == said[1][1] == "Glory be, three times."
    assert borrowed_takes(said, [take_judged("words", 112.0), take_judged("pass", 1.0)]) == {0: 1}


def test_the_best_twin_lends_its_take_and_only_to_a_failed_sentence():
    said = [("A.", "Ave, Ave, Ave, Maria!")] * 4
    best = [take_judged("repeat", 103.0), take_judged("marginal-words", 15.0), take_judged("pass", 2.0),
            take_judged("pass", 2.0)]
    # The lowest score, the first of equals; the marginal sentence keeps its own take.
    assert borrowed_takes(said, best) == {0: 2}


def test_a_failed_sentence_with_no_twin_keeps_the_join_out(monkeypatch):
    # Both halves as the website wrote this refrain: one ends on "!", the other on ".": the voice is
    # given other words for them, so the second's passing take is not the first's.
    text = "Ave, Ave, Ave, Maria! Ave, Ave, Ave, Maria."
    script = {text: WORDS4 + [("pass", 2.0)], HALF: [("repeat", 103.0)] * 4, "Ave, Ave, Ave, Maria.": [("pass", 1.0)]}
    clip, _, _ = run(monkeypatch, script, text=text)
    assert [len(ts) for ts in clip.sentence_takes] == [4, 1]
    assert "borrowed" not in clip.joined.params and not clip.per_sentence and clip.status == "failed"


def test_every_take_is_judged_against_the_voice_s_own_pace(monkeypatch):
    script = {TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("words", 120.0), ("pass", 1.0)],
              "The Lord is with thee.": [("pass", 1.0)]}
    _, _, judge = run(monkeypatch, script)
    assert len(judge.judged) == 4 + 3 + 1  # the whole clip's takes, the sentences', the joined clip
    assert judge.pace_refs == [REGISTRY["qwen"]["pace_ref"]] * len(judge.judged)


def take_scored(index: int, score: float) -> Take:
    return Take(index=index, seed=index, params={}, raw_sr=SR, gen_s=0.0, finished=None, qa=verdict("words", score))


def test_the_best_take_is_the_lowest_score_and_the_first_of_equals():
    takes = [take_scored(0, 112.0), take_scored(1, 105.0), take_scored(2, 105.0), take_scored(3, 130.0)]
    assert best_take(takes) is takes[1]
    assert best_take(takes[2:]) is takes[2]


def test_the_m4a_is_the_kept_take(monkeypatch):
    encoded = []
    monkeypatch.setattr(A, "encode_m4a", lambda audio, sr: encoded.append(audio) or b"m4a")
    judge = Judge({TWO: WORDS4 + [("pass", 2.0)], "Hail Mary, full of grace.": [("pass", 1.0)],
                   "The Lord is with thee.": [("pass", 1.0)]})
    monkeypatch.setattr(qa, "evaluate", judge)
    clip = FakeEngine().make_clip("qwen", TWO, "en", seed_key=KEY)
    assert clip.m4a == b"m4a" and len(encoded) == 1 and encoded[0] is clip.joined.finished.audio


# --------------------------------------------------------------------------- #
# English syllables of the Latin words English prayers keep                   #
# --------------------------------------------------------------------------- #


def without_exception(monkeypatch, text: str, lang: str = "en") -> int:
    with monkeypatch.context() as m:
        m.setattr(qa, "EN_LATIN_FINAL_E", frozenset())
        return qa.estimate_syllables(text, lang)


def test_the_refrain_counts_its_aves_whole(monkeypatch):
    assert without_exception(monkeypatch, REFRAIN) == 10  # every "Ave" read as one syllable, like "have"
    assert qa.estimate_syllables(REFRAIN, "en") == 16  # A-ve x 6, Ma-ria x 2 (as English reads "ia")


@pytest.mark.parametrize("word", sorted(qa.EN_LATIN_FINAL_E))
def test_each_latin_word_keeps_its_final_e_and_nothing_else_changes(monkeypatch, word):
    # Each is a word the silent-e rule shortened (2+ vowel groups, a final e not in le/ee/ye) ...
    assert word.endswith("e") and not word.endswith(("le", "ee", "ye"))
    assert qa.estimate_syllables(word, "en") == without_exception(monkeypatch, word) + 1
    # ... capitalised as a prayer writes it too.
    assert qa.estimate_syllables(word.capitalize() + ",", "en") == qa.estimate_syllables(word, "en")


@pytest.mark.parametrize(
    "word, syllables",
    [("love", 1), ("divine", 2), ("have", 1), ("grace", 1), ("salve", 1), ("pace", 1), ("ore", 1),
     ("fine", 1), ("mane", 1), ("name", 1), ("sublime", 2), ("Maria", 2)],
)
def test_english_words_keep_their_count(monkeypatch, word, syllables):
    assert qa.estimate_syllables(word, "en") == syllables == without_exception(monkeypatch, word)


def test_only_english_is_counted_otherwise(monkeypatch):
    for lang, text in [("es", "Ave María, llena eres de gracia."), ("it", "Ave Maria, piena di grazia."),
                       ("la", "Ave Maria, gratia plena. Miserere nobis, Domine.")]:
        assert qa.estimate_syllables(text, lang) == without_exception(monkeypatch, text, lang)


def test_french_keeps_its_own_final_e_rule(monkeypatch):
    # French drops a final e of its own (Marie, pleine: one syllable less each); a French prayer's
    # "Ave" is counted by that rule too, not by English's list.
    text = "Je vous salue Marie, pleine de grâce. Ave Maria."
    assert qa.estimate_syllables(text, "fr") == without_exception(monkeypatch, text, "fr")
    assert qa.estimate_syllables("Ave", "fr") == 1


def test_a_mixed_english_clip_gains_one_syllable_per_latin_word(monkeypatch):
    text = "Holy God, holy Mighty One, Miserere, judge of all, parce mihi, Domine. Ave!"
    assert qa.estimate_syllables(text, "en") == without_exception(monkeypatch, text) + 4
