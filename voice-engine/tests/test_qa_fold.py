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


def test_whisper_abbreviations_read_as_the_words_said():
    # The take that failed the Litany of the Saints said every word; Whisper wrote "St.".
    said = (
        "Saint Peter, pray for us. Saint Paul, pray for us. Saint Andrew, pray for us. "
        "Saint James, pray for us. Saint John, pray for us. Saint Thomas, pray for us. "
        "Saint James, pray for us. Saint Philip, pray for us. Saint Bartholomew, pray for us. "
        "Saint Matthew, pray for us. Saint Simon, pray for us. Saint Jude, pray for us. "
        "Saint Matthias, pray for us."
    )
    heard = (
        "St. Peter, pray for us. St. Paul, pray for us. St. Andrew, pray for us. "
        "St. James, pray for us. St. John, pray for us. St. Thomas, pray for us. "
        "St. James, pray for us. St. Philip, pray for us. St. Bartholomew, pray for us. "
        "St. Matthew, pray for us. St. Simon, pray for us. St. Jude, pray for us. "
        "St. Matthias, pray for us."
    )
    assert qa.cer(qa.fold(said, "en"), qa.fold(heard, "en")) == 0.0
    assert qa.fold("Sts. Peter and Paul", "en") == qa.fold("Saints Peter and Paul", "en")
    assert qa.fold("St Joseph", "en") == qa.fold("Saint Joseph", "en")
    assert qa.fold("Our Lady of Mt. Carmel", "en") == qa.fold("Our Lady of Mount Carmel", "en")
    assert qa.fold("Ste Marie, St-Esprit", "fr") == qa.fold("Sainte Marie, Saint-Esprit", "fr")
    assert qa.fold("St. Michael", "de") == qa.fold("Sankt Michael", "de")
    assert qa.fold("Sta. María", "es") == qa.fold("Santa María", "es")
    assert qa.fold("Sto. Niño", "tl") == qa.fold("Santo Niño", "tl")


def test_abbreviation_reading_leaves_other_words_alone():
    assert qa.fold("the first stone, the last step", "en") == "the first stone the last step"
    assert qa.fold("Stand fast", "en") == "stand fast"
    # A real difference stays a difference: a saint left out is still missed.
    assert qa.fold("Saint Peter, pray for us.", "en") != qa.fold("Peter, pray for us.", "en")


def test_english_spellings_of_the_same_sound_read_alike():
    assert qa.fold("O Lord, hear my prayer.", "en") == qa.fold("Oh Lord, hear my prayer.", "en")
    assert qa.fold("for ever and ever", "en") == qa.fold("forever and ever", "en")
    assert qa.fold("Vessel of honour, our Saviour", "en") == qa.fold("Vessel of honor, our Savior", "en")
    # Short words keep their "our": four, hour, your, our.
    assert qa.fold("four hours of your time, our Lord", "en") == "four hours of your time our lord"
    # A different word is still different.
    assert qa.fold("Seat of wisdom", "en") != qa.fold("Seed of wisdom", "en")
