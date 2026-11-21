"""qa.evaluate with words_verified: a joined clip whose every sentence was heard right on its own
is judged on what its audio shows (pace, silences), not on Whisper's words for the whole of it,
which collapse a repeated sentence. No model is loaded: Whisper's answer is given."""

import numpy as np

import qa

SR = 24000
ES_PACE_REF = 0.95  # voices/registry.json, qwen3-tts-1.7b-base:lock:es-female-v1
TEXT = "Señor, ten piedad de nosotros. Señor, ten piedad de nosotros. Cristo, ten piedad de nosotros."
COLLAPSED = "Señor, ten piedad de nosotros. Cristo, ten piedad de nosotros."  # one repeat collapsed


def voice(seconds: float) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    return (0.1 * np.sin(2 * np.pi * 200 * t) * (1 + 0.3 * np.sin(2 * np.pi * 5 * t))).astype(np.float32)


def take(*parts: np.ndarray) -> np.ndarray:
    """40 ms of silence, the parts, 250 ms of silence: a finished take."""
    return np.concatenate([np.zeros(int(0.04 * SR)), *parts, np.zeros(int(0.25 * SR))]).astype(np.float32)


def at_pace(seconds: float = 1.0) -> float:
    """Seconds of sound for TEXT at `seconds` times the voice's own pace."""
    syl = qa.estimate_syllables(TEXT, "es")
    return syl / (qa.NORMAL_RATE["es"] * qa.PRAYER_FACTOR * ES_PACE_REF) / seconds


def judge(monkeypatch, audio: np.ndarray, heard: str, **kw) -> qa.QAResult:
    end = len(audio) / SR
    words = [{"word": w, "start": 0.0, "end": end - 0.3} for w in heard.split()]
    result = {"text": heard, "segments": [{"start": 0.0, "end": end, "text": heard, "words": words}]}
    monkeypatch.setattr(qa, "transcribe", lambda *a, **k: result)
    return qa.evaluate(audio, SR, TEXT, "es", pace_ref=ES_PACE_REF, **kw)


def test_whisper_collapsing_a_repeated_sentence_fails_a_whole_take(monkeypatch):
    q = judge(monkeypatch, take(voice(at_pace())), COLLAPSED)
    assert q.verdict == "fail" and q.words_failed and q.reasons[0].startswith("cer")


def test_the_same_audio_joined_from_passed_sentences_passes(monkeypatch):
    q = judge(monkeypatch, take(voice(at_pace())), COLLAPSED, words_verified=0.01)
    assert q.verdict == "pass" and not q.reasons
    assert q.cer == 0.01 and not q.words_failed and not q.words_marginal
    assert q.tail_gap_s is None and q.extra_start == q.extra_end == 0


def test_a_verified_join_is_still_judged_on_its_silences(monkeypatch):
    half = at_pace() / 2
    q = judge(monkeypatch, take(voice(half), np.zeros(int(3.0 * SR), np.float32), voice(half)), COLLAPSED,
              words_verified=0.0)
    assert q.verdict == "fail" and any(r.startswith("silence") for r in q.reasons)


def test_a_verified_join_is_still_judged_on_its_pace(monkeypatch):
    q = judge(monkeypatch, take(voice(at_pace(0.45))), COLLAPSED, words_verified=0.0)
    assert q.verdict == "fail" and q.reasons[0].startswith("pace")
