"""The pace check of very short clips (no model is loaded: Whisper's answer is given)."""

import numpy as np
import pytest

import qa

SR = 24000
ES_FEMALE_PACE_REF = 0.95  # voices/registry.json, qwen3-tts-1.7b-base:lock:es-female-v1


def take(speech_s: float) -> np.ndarray:
    """A finished take: 40 ms of silence, `speech_s` of voice, 250 ms of silence."""
    t = np.arange(int(speech_s * SR)) / SR
    voice = 0.1 * np.sin(2 * np.pi * 200 * t) * (1 + 0.3 * np.sin(2 * np.pi * 5 * t))
    return np.concatenate([np.zeros(int(0.04 * SR)), voice, np.zeros(int(0.25 * SR))]).astype(np.float32)


def judge(monkeypatch, text: str, heard: str, speech_s: float, lang: str = "es") -> qa.QAResult:
    words = [{"word": heard, "start": 0.0, "end": 0.04 + speech_s}]
    result = {"text": heard, "segments": [{"start": 0.0, "end": 0.04 + speech_s, "text": heard, "words": words}]}
    monkeypatch.setattr(qa, "transcribe", lambda *a, **k: result)
    return qa.evaluate(take(speech_s), SR, text, lang, pace_ref=ES_FEMALE_PACE_REF)


def test_a_one_syllable_clip_is_allowed_its_drawn_out_last_syllable(monkeypatch):
    # "tres" over 0.47 s of speech, as the Spanish voices say it (0.38-0.51 s): by syllable
    # rate alone that is 0.41x the voice's pace, a fail.
    q = judge(monkeypatch, "3.", "Tres.", 0.45)
    assert q.verdict == "pass" and not q.reasons


def test_a_stretched_short_clip_still_fails(monkeypatch):
    q = judge(monkeypatch, "3.", "Tres.", 0.9)
    assert q.verdict == "fail" and q.reasons[0].startswith("pace")


def test_a_wrong_word_still_fails_at_any_pace(monkeypatch):
    q = judge(monkeypatch, "3.", "Dos.", 0.45)
    assert q.verdict == "fail" and q.reasons[0].startswith("cer")


@pytest.mark.parametrize("text, speech_s", [("2.", 0.09), ("Vamos a orar.", 1.6)])
def test_fast_short_takes_and_longer_clips_are_judged_as_before(monkeypatch, text, speech_s):
    q = judge(monkeypatch, text, text, speech_s)
    expected = q.pace_ratio / ES_FEMALE_PACE_REF  # the syllable rate alone
    assert q.reasons == [f"pace {expected:.2f}x the voice's own pace"]


def test_a_quick_short_take_is_capped_at_the_voice_s_pace(monkeypatch):
    # 0.2 s of "tres" is 0.96x by syllable rate: with its last syllable counted twice it
    # would read as 1.92x, too fast, so the allowance stops at the voice's own pace.
    q = judge(monkeypatch, "3.", "Tres.", 0.2)
    assert q.verdict == "pass" and not q.reasons


def test_a_two_syllable_clip_is_allowed_half_again(monkeypatch):
    q = judge(monkeypatch, "Amén.", "Amén.", 0.95)  # 2 syllables, slow
    raw = q.pace_ratio / ES_FEMALE_PACE_REF
    assert q.verdict == "marginal" and q.reasons == [f"pace {raw * 3 / 2:.2f}x the voice's own pace"]


def test_a_four_syllable_clip_is_judged_by_its_syllable_rate_alone(monkeypatch):
    q = judge(monkeypatch, "1. Amén.", "1. Amén.", 1.4)  # "uno. Amén.": 4 syllables
    raw = q.pace_ratio / ES_FEMALE_PACE_REF
    assert q.verdict == "fail" and q.reasons == [f"pace {raw:.2f}x the voice's own pace"]


def test_a_short_take_with_an_untranscribed_tail_gets_no_allowance(monkeypatch):
    # The word ends at 0.24 s but sound goes on to 0.59 s: a murmur Whisper did not write
    # down (0.35 s, under the 0.9 s tail limit). Pace is the only check that sees it.
    words = [{"word": "Tres.", "start": 0.0, "end": 0.24}]
    result = {"text": "Tres.", "segments": [{"start": 0.0, "end": 0.24, "text": "Tres.", "words": words}]}
    monkeypatch.setattr(qa, "transcribe", lambda *a, **k: result)
    q = qa.evaluate(take(0.55), SR, "3.", "es", pace_ref=ES_FEMALE_PACE_REF)
    raw = q.pace_ratio / ES_FEMALE_PACE_REF
    assert q.tail_gap_s > qa.SHORT_CLIP_TAIL_S
    assert q.verdict == "fail" and q.reasons == [f"pace {raw:.2f}x the voice's own pace"]
