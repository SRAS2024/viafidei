"""The Kokoro carrier: a short Latin phrase said inside a carrier sentence and cut back out.

No model is loaded. The cuts and the guard are tested on synthetic audio (a tone for
speech, zeros or a hum for the pauses), and the engine's Kokoro path is driven by a fake
Kokoro that records what it was asked to say. The fake's sounds line up exactly with its
durations; real Kokoro speaks 25-75 ms ahead of them, which the quietest-5-ms search absorbs
(measured on real audio, not here). Also here: the softened start of a vowel-initial clip
in the female Latin voice (soften_vowel_onset).
"""

import logging
import sys
import types
from types import SimpleNamespace

import numpy as np
import pytest

import engine
import latin
from engine import (
    KOKORO_CARRIER,
    KOKORO_CUT_DB,
    KOKORO_EDGE_FADE,
    KOKORO_SHORT,
    CarrierCut,
    Engine,
    carrier_sentence,
    fade_edges,
    find_cut,
    kokoro_uses_carrier,
    pauses_around,
    quietest_point,
    soften_vowel_onset,
    symbol_start_frames,
)

SR = 24000
HOP = 600  # samples per Kokoro duration frame at 24 kHz
LATIN_VOICES = {"kokoro-82m:latin-ipa:if_sara", "kokoro-82m:latin-ipa:im_nicola"}


def tone(seconds: float, level: float = 0.3) -> np.ndarray:
    t = np.arange(int(round(seconds * SR))) / SR
    return (level * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(round(seconds * SR)), np.float32)


def layout(before_pause: np.ndarray, after_pause: np.ndarray):
    """Carrier, pause, phrase, pause, carrier: the audio and the two pauses' sample spans."""
    parts = [tone(1.0), before_pause, tone(0.5, 0.25), after_pause, tone(1.0)]
    edge = np.cumsum([0] + [len(p) for p in parts])
    return np.concatenate(parts), (int(edge[1]), int(edge[2])), (int(edge[3]), int(edge[4]))


# --------------------------------------------------------------------------- #
# The carrier and the threshold                                               #
# --------------------------------------------------------------------------- #


def test_the_carrier_is_the_latin_front_end_s_own_pater_noster():
    assert KOKORO_CARRIER == latin.to_ipa("Pater noster, qui es in caelis.")
    assert latin.check_vocab(KOKORO_CARRIER) == set()
    # Voiceless at both ends (p ... s), so the pauses around the phrase stay silent.
    assert KOKORO_CARRIER.startswith("p") and KOKORO_CARRIER.endswith("s.")


def test_the_carrier_is_what_the_latin_voices_are_given():
    eng = Engine()  # reads voices/registry.json; loads no model
    latin_ipa = {v for v, s in eng.registry.items() if s.get("kind") == "kokoro" and s.get("front_end") == "latin-ipa"}
    assert LATIN_VOICES <= latin_ipa
    for voice_id in latin_ipa:
        spoken = eng.spoken_text(eng.spec(voice_id), "Pater noster, qui es in caelis.", "la")
        assert spoken == KOKORO_CARRIER


@pytest.mark.parametrize(
    "text, short",
    [
        ("Amen.", True),  # 7 symbols
        ("Oremus.", True),
        ("Miserere nobis.", True),  # 19
        ("Christe, audi nos.", False),  # 20: said alone, as before
        ("In nomine Patris, et Filii, et Spiritus Sancti. Amen.", False),
    ],
)
def test_only_latin_under_20_symbols_takes_the_carrier(text, short):
    ps = latin.to_ipa(text)
    assert (len(ps) < KOKORO_SHORT) is short
    assert kokoro_uses_carrier("latin-ipa", ps) is short


def test_spaces_do_not_count_and_other_front_ends_never_take_the_carrier():
    assert kokoro_uses_carrier("latin-ipa", "  ˈaːmen.  ")
    assert kokoro_uses_carrier("latin-ipa", " " + "a" * (KOKORO_SHORT - 1) + " ")
    assert not kokoro_uses_carrier("latin-ipa", "a" * KOKORO_SHORT)
    assert not kokoro_uses_carrier("latin-ipa", "")
    assert not kokoro_uses_carrier("latin-ipa", "   ")
    assert not kokoro_uses_carrier("misaki-en", "ˈeɪmˈɛn.")
    assert not kokoro_uses_carrier("text", "ˈaːmen.")


# --------------------------------------------------------------------------- #
# Where the phrase sits                                                       #
# --------------------------------------------------------------------------- #


def test_the_phrase_sits_between_two_carriers():
    text, first, end = carrier_sentence("ˈaːmen.")
    assert text == f"{KOKORO_CARRIER} ˈaːmen. {KOKORO_CARRIER}"
    assert text[first:end] == "ˈaːmen."


def test_symbol_frames_follow_kokoro_s_tokens():
    # Start token 2 frames, "a" 3, "b" 4, end token 5.
    assert symbol_start_frames("ab", [2, 3, 4, 5], {"a", "b"}) == [2, 5, 9]
    # A symbol Kokoro does not know is dropped: it takes no time and no duration.
    assert symbol_start_frames("a✝b", [2, 3, 4, 5], {"a", "b"}) == [2, 5, 5, 9]


def test_the_pauses_are_the_marks_between_the_phrase_and_each_carrier():
    text, first, end = carrier_sentence("ˈaːmen.")
    (a, b), (c, d) = pauses_around(text, first, end)
    assert b == first and text[a:b] == ". "  # the carrier's full stop and the space
    assert c == end - 1 and text[c:d] == ". "  # the phrase's own full stop and the space
    assert text[d] == "p"  # the second carrier starts right after


def test_a_comma_inside_the_phrase_is_never_a_cut():
    for words in ("Kyrie, eleison.", "Christe, eleison."):
        phrase = latin.to_ipa(words)
        assert ", " in phrase
        text, first, end = carrier_sentence(phrase)
        (a, b), (c, d) = pauses_around(text, first, end)
        assert (a, b) == (first - 2, first)
        assert (c, d) == (end - 1, end + 1)


def test_a_phrase_without_a_closing_mark_is_cut_in_the_space_after_it():
    text, first, end = carrier_sentence("ˈaːmen")
    _, (c, d) = pauses_around(text, first, end)
    assert (c, d) == (end, end + 1)


# --------------------------------------------------------------------------- #
# The cuts and the guard, on synthetic audio                                  #
# --------------------------------------------------------------------------- #


def test_the_cut_is_the_middle_of_the_quietest_5_ms():
    hum = tone(0.1, 0.003)
    audio = np.concatenate([tone(0.1), hum, silence(0.005), hum, tone(0.1)])
    gap = int(0.2 * SR)  # where the 5 ms of silence start
    point, level = quietest_point(audio, int(0.1 * SR), int(0.305 * SR))
    assert point == gap + 60
    assert level == pytest.approx(-180.0)  # true silence, at the floor


def test_a_pause_shorter_than_5_ms_is_one_window_and_a_window_past_the_end_is_loud():
    audio = np.zeros(1000, np.float32)
    assert quietest_point(audio, 100, 110) == (160, pytest.approx(-180.0))
    assert quietest_point(audio, 950, 990) == (970, 0.0)


def test_cuts_fall_in_the_silence_on_each_side_and_keep_the_phrase_whole():
    audio, before, after = layout(silence(0.2), silence(0.2))
    cut = find_cut(audio, before, after)
    assert before[0] <= cut.start <= before[1]
    assert after[0] <= cut.end <= after[1]
    assert cut.silent
    # All of the phrase is kept, and besides it only silence: nothing of either carrier.
    assert not np.any(audio[cut.start:before[1]]) and not np.any(audio[after[0]:cut.end])


def test_cuts_fall_in_a_quiet_room_too():
    rng = np.random.default_rng(7)
    room = [rng.normal(0, 1e-4, int(0.2 * SR)).astype(np.float32) for _ in range(2)]  # about -80 dBFS
    cut = find_cut(*layout(*room))
    assert cut.silent
    assert max(cut.start_db, cut.end_db) - cut.loud_db < -50


@pytest.mark.parametrize("humming", ["before", "after", "both"])
def test_falls_back_when_a_pause_never_goes_quiet(humming):
    # A hum 20 dB under the phrase all through a pause: no cut there would be clean.
    hum, quiet = tone(0.2, 0.025), silence(0.2)
    before = hum if humming in ("before", "both") else quiet
    after = hum if humming in ("after", "both") else quiet
    cut = find_cut(*layout(before, after))
    assert not cut.silent
    assert max(cut.start_db, cut.end_db) - cut.loud_db == pytest.approx(-20.0, abs=1.0)


@pytest.mark.parametrize("hum_db, silent", [(-45, True), (-35, True), (-25, False), (-15, False)])
def test_the_guard_wants_both_cuts_30_db_under_the_phrase(hum_db, silent):
    assert KOKORO_CUT_DB == -30.0
    hum = tone(0.2, 0.25 * 10 ** (hum_db / 20))  # the phrase is a 0.25 tone
    assert find_cut(*layout(hum, hum)).silent is silent


def test_cuts_out_of_order_are_never_silent():
    assert not CarrierCut(start=500, end=500, start_db=-180.0, end_db=-180.0, loud_db=-10.0).silent
    assert not CarrierCut(start=500, end=100, start_db=-180.0, end_db=-180.0, loud_db=-10.0).silent
    assert CarrierCut(start=100, end=500, start_db=-180.0, end_db=-180.0, loud_db=-10.0).silent


# --------------------------------------------------------------------------- #
# The engine's Kokoro path, with a fake Kokoro                                #
# --------------------------------------------------------------------------- #

PAUSES = set(".,;:!?…— ")  # what Kokoro says as silence
PACK = np.arange(512)  # a voice pack whose style for index i is i, so the index is seen


class FakeKokoro:
    """Speaks like Kokoro-82M without a model: one duration per token (the start token, each
    symbol it knows, the end token), 600 samples per frame. Letters are a tone; pause marks,
    spaces and the start and end tokens are silence, or a hum at `pause_level` for pauses
    that never go quiet, and the start token sounds at `start_level` (real Kokoro voices its
    last frames). Remembers every call and the last output."""

    LETTER, PAUSE, EDGE = 3, 4, 5  # frames per letter, per pause mark, per start/end token

    def __init__(self, pause_level: float = 0.0, start_level: float = 0.0):
        self.vocab = {ch: i for i, ch in enumerate(sorted(latin.KOKORO_VOCAB), 1)}
        self.pause_level = pause_level
        self.start_level = start_level
        self.calls: list[tuple[str, int, float]] = []
        self.last = None

    def sound(self, ch: str) -> np.ndarray:
        if ch in PAUSES:
            return tone(self.PAUSE * HOP / SR, self.pause_level)
        return tone(self.LETTER * HOP / SR)

    def __call__(self, phonemes, ref_s, speed=1, return_output=False):
        self.calls.append((phonemes, int(ref_s), speed))
        symbols = [ch for ch in phonemes if ch in self.vocab]
        durations = [self.EDGE] + [self.PAUSE if ch in PAUSES else self.LETTER for ch in symbols] + [self.EDGE]
        edge = silence(self.EDGE * HOP / SR)
        start = tone(self.EDGE * HOP / SR, self.start_level)
        audio = np.concatenate([start, *(self.sound(ch) for ch in symbols), edge])
        self.last = SimpleNamespace(audio=audio, pred_dur=np.array(durations, np.int32))
        return self.last


@pytest.fixture
def no_mlx(monkeypatch):
    """Engine._kokoro imports Kokoro's voice-pack loader by name. A stand-in keeps MLX out of
    these tests; it is never called, as the pack is already loaded."""
    stub = types.ModuleType("mlx_audio.tts.models.kokoro.voice")

    def load_voice_tensor(path):
        raise AssertionError("the voice pack is already loaded")

    stub.load_voice_tensor = load_voice_tensor
    monkeypatch.setitem(sys.modules, "mlx_audio.tts.models.kokoro.voice", stub)


def speak(model: FakeKokoro, spoken: str, front_end: str = "latin-ipa", speed: float = 0.85, keep=None):
    holder = SimpleNamespace(model=model, voice_packs={"if_sara": PACK}, path="")
    spec = {"kind": "kokoro", "kokoro_voice": "if_sara", "front_end": front_end}
    if keep is not None:
        spec["vowel_onset_keep_s"] = keep
    return Engine(registry={})._kokoro(holder, spec, spoken, "la", {"speed": speed})


def phrase_sound(model: FakeKokoro, phrase: str) -> int:
    """Samples of sound (not silence) the fake makes for the phrase's letters."""
    return sum(int(np.count_nonzero(model.sound(ch))) for ch in phrase if ch in model.vocab and ch not in PAUSES)


@pytest.mark.parametrize("words", ["Amen.", "Oremus.", "Kyrie, eleison.", "Miserere nobis."])
def test_a_short_latin_phrase_is_said_once_inside_the_carrier_and_cut_out(no_mlx, words):
    ps = latin.to_ipa(words)
    model = FakeKokoro()
    audio, sr = speak(model, ps)
    text, _, _ = carrier_sentence(ps)
    # One call: the carrier sentence with the style for its own length.
    assert model.calls == [(text, len(text) - 1, 0.85)]
    assert sr == 24000
    # Every sound of the phrase (both words of "Kyrie, eleison.") and none of the carriers'.
    assert np.count_nonzero(audio) == phrase_sound(model, ps)
    assert audio[0] == 0 and audio[-1] == 0


def test_a_phrase_with_no_silent_cut_is_said_alone_as_before(no_mlx, caplog):
    ps = latin.to_ipa("Amen.")
    model = FakeKokoro(pause_level=0.03)  # every pause hums about 20 dB under the speech
    caplog.set_level(logging.INFO, logger="voice_engine")
    audio, sr = speak(model, ps)
    text, _, _ = carrier_sentence(ps)
    assert model.calls == [(text, len(text) - 1, 0.85), (ps, len(ps) - 1, 0.85)]
    assert sr == 24000 and np.array_equal(audio, model.last.audio)
    said_alone = [r for r in caplog.records if r.name == "voice_engine" and "said alone" in r.getMessage()]
    # A warning: the worker lets only the engine's warnings into its log.
    assert len(said_alone) == 1 and said_alone[0].levelno == logging.WARNING


@pytest.mark.parametrize("words", ["Christe, audi nos.", "In nomine Patris, et Filii, et Spiritus Sancti. Amen."])
def test_a_clip_of_20_symbols_or_more_is_said_alone_exactly_as_before(no_mlx, words):
    ps = latin.to_ipa(words)
    model = FakeKokoro()
    audio, sr = speak(model, ps)
    assert model.calls == [(ps, len(ps) - 1, 0.85)]
    assert sr == 24000 and np.array_equal(audio, model.last.audio)


def test_kokoro_english_never_takes_the_carrier(no_mlx, monkeypatch):
    monkeypatch.setattr(engine, "misaki_phonemes", lambda text: "ˈeɪmˈɛn.")
    model = FakeKokoro()
    audio, _ = speak(model, "Amen.", front_end="misaki-en")
    assert model.calls == [("ˈeɪmˈɛn.", len("ˈeɪmˈɛn.") - 1, 0.85)]
    assert np.array_equal(audio, model.last.audio)


def test_a_cut_phrase_fades_in_and_out_over_5_ms():
    out = fade_edges(np.ones(2000, np.float32))
    n = KOKORO_EDGE_FADE
    assert n == int(0.005 * SR)
    assert out[0] == 0 and out[-1] == 0
    assert np.all(np.diff(out[:n]) >= 0) and np.all(np.diff(out[-n:]) <= 0)
    assert np.all(out[n:-n] == 1)
    short = fade_edges(np.ones(100, np.float32))  # shorter than two fades: half each
    assert len(short) == 100 and short[0] == 0 and short[-1] == 0


# --------------------------------------------------------------------------- #
# The start of a vowel-initial clip (female Latin voice)                      #
# --------------------------------------------------------------------------- #

KEEP = 0.025  # voices/registry.json: kokoro-82m:latin-ipa:if_sara vowel_onset_keep_s


def test_only_the_female_latin_voice_has_its_vowel_onsets_softened():
    registry = Engine().registry  # loads no model
    assert registry["kokoro-82m:latin-ipa:if_sara"]["vowel_onset_keep_s"] == KEEP
    assert "vowel_onset_keep_s" not in registry["kokoro-82m:latin-ipa:im_nicola"]


def test_the_start_token_is_silenced_but_its_last_25_ms_which_fade_in():
    durations = [10, 4, 4]  # the start token, two symbols
    audio = np.full(sum(durations) * HOP, 0.5, np.float32)
    out = soften_vowel_onset(audio, np.array(durations), KEEP)
    end, keep = 10 * HOP, int(KEEP * SR)
    assert not np.any(out[: end - keep])
    ramp = out[end - keep : end]
    assert ramp[0] == 0 and np.all(np.diff(ramp) >= 0) and ramp[-1] == pytest.approx(0.5)
    assert np.array_equal(out[end:], audio[end:])  # the first symbol on is untouched


@pytest.mark.parametrize(
    "words, softened",
    [
        ("Ora pro nobis, sancta Dei Genetrix.", True),  # heard as "Aura pro nobis" before
        ("Ut digni efficiamur promissionibus Christi.", True),  # unstressed first vowel
        ("Hodie Christus natus est.", True),  # h is silent: the clip starts on a vowel
        ("Gloria Patri, et Filio, et Spiritui Sancto.", False),  # a first consonant keeps its voicing
        ("Iesu, dulcis memoria.", False),  # j is not a vowel
    ],
)
def test_a_vowel_initial_clip_loses_the_start_token_s_early_voicing(no_mlx, words, softened):
    ps = latin.to_ipa(words)
    model = FakeKokoro(start_level=0.2)  # the start token sounds, as real Kokoro's does
    audio, _ = speak(model, ps, keep=KEEP)
    start, keep = FakeKokoro.EDGE * HOP, int(KEEP * SR)
    if softened:
        assert not np.any(audio[: start - keep]) and np.any(audio[start - keep : start])
        assert np.array_equal(audio[start:], model.last.audio[start:])
    else:
        assert np.array_equal(audio, model.last.audio)


def test_a_voice_without_the_setting_keeps_its_start_as_it_was(no_mlx):
    model = FakeKokoro(start_level=0.2)
    audio, _ = speak(model, latin.to_ipa("Ora pro nobis, sancta Dei Genetrix."))
    assert np.array_equal(audio, model.last.audio)


def test_a_phrase_cut_from_the_carrier_is_not_softened_again(no_mlx):
    # Its start token stays with the first carrier, so the setting changes nothing.
    ps = latin.to_ipa("Amen.")
    with_setting, _ = speak(FakeKokoro(start_level=0.2), ps, keep=KEEP)
    without, _ = speak(FakeKokoro(start_level=0.2), ps)
    assert np.array_equal(with_setting, without)
