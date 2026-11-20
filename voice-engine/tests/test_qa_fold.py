"""The QA's fair folds: what counts as the same words (no model is loaded)."""

import numpy as np

import audio as A
import qa


def test_greek_homophones_fold_alike():
    # Koine spelling vs the modern homophones Whisper writes.
    assert qa.fold("Πάτερ ημών ο εν τοίς ουρανοίς", "el") == qa.fold("Πάτερ ημών ο εν της ουρανής", "el")
    assert qa.fold("καί τού Υιού", "el") == qa.fold("και του Υιού", "el")
    # A real difference stays a difference.
    assert qa.fold("Πατρός", "el") != qa.fold("Πατρούς", "el")


def test_greek_digraph_split_by_diaeresis():
    assert qa.greek_phonemes("αϊ") == "ai"
    assert qa.greek_phonemes("και") == "ke"


def test_chinese_homophone_characters_fold_alike_but_tones_count():
    assert qa.fold("万福玛利亚", "zh") == qa.fold("万福玛丽亚", "zh")
    assert qa.fold("圣神", "zh") != qa.fold("圣身", "zh")  # shén vs shēn


def test_latin_fold_merges_ecclesiastical_sounds():
    assert qa.fold("caelis", "la") == qa.fold("celis", "la")
    assert qa.fold("Jesu", "la") == qa.fold("Iesu", "la")


def test_vietnamese_keeps_tones_spanish_folds_accents():
    assert qa.fold("Lạy Cha", "vi") != qa.fold("Lay Cha", "vi")
    assert qa.fold("Espíritu Santo. Amén.", "es") == qa.fold("Espiritu santo amen", "es")


def test_numbers_compare_as_words():
    assert qa.fold("10 times", "en") == qa.fold("ten times", "en")


def test_cer_and_end_insertions():
    assert qa.cer("abc", "abc") == 0.0
    assert abs(qa.cer("abcd", "abed") - 0.25) < 1e-9
    lead, tail = qa.end_insertions("amen", "amen blah blah")
    assert lead == 0 and tail >= 9


def test_trim_and_loudness():
    sr = 24000
    t = np.arange(int(1.0 * sr)) / sr
    tone = (0.1 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    x = np.concatenate([np.zeros(sr, np.float32), tone, np.zeros(2 * sr, np.float32)])
    y = A.trim(x, sr)
    assert abs(len(y) / sr - (1.0 + A.LEAD_S + A.TAIL_S)) < 0.05
    z = A.normalize_loudness(y, sr)
    assert abs(A.loudness(z, sr) - A.TARGET_LUFS) < 0.5
    assert A.true_peak_db(z, sr) <= A.TRUE_PEAK_DBTP + 0.1


def test_korean_liaison_and_chinese_amen():
    assert qa.fold("잘못한 이를", "ko") == qa.fold("잘못한 일을", "ko")
    assert qa.fold("좋아", "ko") == qa.fold("조아", "ko")
    assert qa.fold("阿们", "zh") == qa.fold("阿门", "zh")


def test_northern_vietnamese_homophones_fold_alike_but_tones_count():
    assert qa.fold("sa chước cám dỗ, sự dữ", "vi") == qa.fold("xa trước cám rỗ, sự giữ", "vi")
    assert qa.fold("Lạy Cha", "vi") != qa.fold("Lấy Cha", "vi")


def test_tagalog_spelling_variants_fold_alike():
    assert qa.fold("dito sa lupa para nang sa langit", "tl") == qa.fold("dito sa lupa para ng salangit", "tl")
    assert qa.fold("anak na si Hesus, sumasaiyo", "tl") == qa.fold("anak na si Jesus, sumasa iyo", "tl")
