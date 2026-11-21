"""A clip asked for again after failing is spoken with new seeds (new takes for Qwen3-TTS and
VoxCPM2; for Kokoro, which does not sample, only new vocoder noise)."""

from worker import MAX_ATTEMPTS, seed_key_for


def test_first_claim_keeps_the_clip_s_own_seeds():
    assert seed_key_for("abc", 0) == "abc"
    assert seed_key_for("abc", 1) == "abc"


def test_each_retry_speaks_with_new_seeds():
    keys = {seed_key_for("abc", n) for n in range(1, MAX_ATTEMPTS + 1)}
    assert len(keys) == MAX_ATTEMPTS
