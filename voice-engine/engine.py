"""
The voice engine: which model speaks a voiceId, and making one finished, checked clip.

    from engine import Engine
    eng = Engine()                       # reads voices/registry.json
    clip = eng.make_clip("qwen3-tts-1.7b-customvoice:Serena", "因父、及子、及圣神之名。阿们。", "zh",
                         seed_key="any stable string, e.g. the row key")
    clip.m4a, clip.qa.verdict, clip.engine_label

Models (all run locally on Apple silicon through mlx-audio; see README for licences):
  - "qwen3"   Qwen3-TTS 12Hz 1.7B: CustomVoice (stock speaker + style instruct),
              VoiceDesign (voice from a description; used to DESIGN voices only),
              Base (clones a locked reference clip: our designed voices);
  - "voxcpm2" VoxCPM2: design from a description, or clone a locked reference clip
              (reference audio + prompt continuation);
  - "kokoro"  Kokoro-82M: stock voice packs fed raw phonemes. Latin goes through our
              own front end (latin.py -> Kokoro IPA); a short Latin phrase is said
              inside a carrier sentence and cut back out (KOKORO_SHORT).

Only `capacity` models stay resident (default 1): asking for another unloads the
least recently used one and frees its memory first, so two TTS models never sit in
memory or run at once. Whisper (for QA) stays loaded beside it.
"""

from __future__ import annotations

import gc
import hashlib
import json
import logging
import os
import time
from collections import OrderedDict
from collections.abc import Container, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

import audio as A
import latin
import qa as QA
from normalize import normalize_for_voice

HERE = Path(__file__).resolve().parent
REGISTRY_PATH = HERE / "voices" / "registry.json"

log = logging.getLogger("voice_engine")

QWEN_LANG = {
    "en": "english", "es": "spanish", "fr": "french", "it": "italian", "de": "german",
    "pt": "portuguese", "ko": "korean", "zh": "chinese", "la": "italian",
}


# --------------------------------------------------------------------------- #
# Voice specs                                                                 #
# --------------------------------------------------------------------------- #


def load_registry(path: Path = REGISTRY_PATH) -> dict[str, dict]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {k: v for k, v in data.get("voices", {}).items()}


def resolve_path(p: Optional[str]) -> Optional[str]:
    if not p:
        return None
    q = Path(p)
    return str(q if q.is_absolute() else (HERE / q))


def ref_text_of(spec: dict) -> Optional[str]:
    if spec.get("ref_text"):
        return spec["ref_text"]
    f = resolve_path(spec.get("ref_text_file"))
    return Path(f).read_text(encoding="utf-8").strip() if f else None


def engine_label(spec: dict) -> str:
    """"<model repo>@<revision>:<voice>", stored in PrayerAudioClip.engine."""
    rev = (spec.get("revision") or "main")[:12]
    voice = spec.get("speaker") or spec.get("kokoro_voice") or spec.get("lock") or spec.get("voiceId", "?")
    front = spec.get("front_end")
    if front and front not in ("text",):
        voice = f"{voice}+{front}"
    return f"{spec['repo']}@{rev}:{voice}"


def qwen_token_budget(spoken: str, lang: str) -> int:
    """Codec frames (12.5 per second) a clip may take: room for a slow 1.5 syllables/s
    plus 12 s, and never less than by characters. Chinese and Korean need the syllable
    count: one character is a whole syllable there (a character budget cut prayers short)."""
    syl = QA.estimate_syllables(spoken, "it" if lang == "la" else lang)
    return max(240, int(len(spoken) * 3.2) + 120, int(12.5 * syl / 1.5) + 150)


def stable_seed(*parts: str) -> int:
    h = hashlib.sha256("\u0000".join(parts).encode("utf-8")).hexdigest()
    return int(h[:8], 16) % (2**31 - 1)


# --------------------------------------------------------------------------- #
# Model holders                                                               #
# --------------------------------------------------------------------------- #


def snapshot(repo: str, revision: Optional[str]) -> str:
    """Local path of a cached model at a pinned revision (downloads only if missing)."""
    from huggingface_hub import constants, snapshot_download

    base = Path(constants.HF_HUB_CACHE) / ("models--" + repo.replace("/", "--"))
    rev = revision
    if rev is None and (base / "refs" / "main").exists():
        rev = (base / "refs" / "main").read_text().strip()
    if rev and (base / "snapshots" / rev).is_dir():
        return str(base / "snapshots" / rev)
    return snapshot_download(repo, revision=revision)


MODEL_TYPE = {"qwen3": "qwen3_tts", "voxcpm2": "voxcpm2", "kokoro": "kokoro"}


class Loaded:
    def __init__(self, repo: str, revision: Optional[str], kind: str):
        from mlx_audio.tts.utils import load_model

        t0 = time.time()
        self.repo = repo
        self.revision = revision
        self.path = snapshot(repo, revision)
        # The snapshot folder's name is a commit hash, so name the model type.
        self.model = load_model(self.path, model_type=MODEL_TYPE[kind])
        self.load_s = time.time() - t0
        self.voice_packs: dict[str, Any] = {}
        log.info("loaded %s@%s in %.1fs", repo, (revision or "main")[:8], self.load_s)


class ModelCache:
    """LRU of loaded models; capacity 1 means one TTS model in memory at a time."""

    def __init__(self, capacity: int = 1):
        self.capacity = max(1, capacity)
        self.items: "OrderedDict[tuple[str, Optional[str]], Loaded]" = OrderedDict()

    def get(self, repo: str, revision: Optional[str], kind: str) -> Loaded:
        key = (repo, revision)
        if key in self.items:
            self.items.move_to_end(key)
            return self.items[key]
        while len(self.items) >= self.capacity:
            self._evict()
        item = Loaded(repo, revision, kind)
        self.items[key] = item
        return item

    def _evict(self) -> None:
        import mlx.core as mx

        key, item = self.items.popitem(last=False)
        log.info("unloading %s", key[0])
        del item
        gc.collect()
        try:
            mx.clear_cache()
        except Exception:
            pass

    def clear(self) -> None:
        while self.items:
            self._evict()


# --------------------------------------------------------------------------- #
# Synthesis                                                                   #
# --------------------------------------------------------------------------- #


@dataclass
class Take:
    index: int
    seed: int
    params: dict
    raw_sr: int
    gen_s: float
    finished: A.Finished
    qa: QA.QAResult
    qa_s: float = 0.0

    @property
    def rtf(self) -> float:
        return self.gen_s / max(1e-6, self.finished.duration_s)


@dataclass
class Clip:
    voice_id: str
    lang: str
    text: str
    spoken_text: str
    best: Take
    takes: list[Take] = field(default_factory=list)
    engine_label: str = ""
    m4a: bytes = b""

    @property
    def qa(self) -> QA.QAResult:
        return self.best.qa

    @property
    def status(self) -> str:
        return "failed" if self.best.qa.verdict == "fail" else "done"

    @property
    def last_error(self) -> Optional[str]:
        q = self.best.qa
        if q.verdict == "pass":
            return None
        e = q.ser if q.ser is not None else q.cer
        if q.verdict == "marginal":
            return f"qa:marginal:{e:.3f}:" + "; ".join(q.reasons)[:400]
        return f"qa:failed:{e:.3f}:" + "; ".join(q.reasons)[:400]

    @property
    def qa_score(self) -> float:
        """Stored in PrayerAudioClip.qaScore: 1 - the error rate the take was judged by (CER on
        the fair fold; syllable error rate for Vietnamese and Chinese). 1.0 = word-perfect."""
        q = self.best.qa
        return round(max(0.0, 1.0 - (q.ser if q.ser is not None else q.cer)), 4)


def _mx_seed(seed: int) -> None:
    import mlx.core as mx

    mx.random.seed(seed)
    np.random.seed(seed % (2**32 - 1))


def _collect(results) -> tuple[np.ndarray, int]:
    chunks, sr = [], None
    for r in results:
        chunks.append(np.asarray(r.audio, dtype=np.float32).reshape(-1))
        sr = r.sample_rate
    if not chunks:
        return np.zeros(1, np.float32), 24000
    return np.concatenate(chunks), int(sr)


# Kokoro starts to voice a first vowel in the last 75-175 ms of its start token, as loud as the
# vowel itself. In the female Latin voice that early voicing is at times heard as another vowel:
# "Ora pro nobis" as "Aura pro nobis", "Ut digni" as "O digne". Silencing all of it took a short
# first vowel away ("In nomine" was heard as "Nomine", "Attende" as "Tende"), so a voice whose
# registry entry sets vowel_onset_keep_s keeps only that much of it, faded in. Measured through
# make_clip with the worker's seeds (2026-11-21), female voice, 19 vowel-initial prayers: the
# first word was heard right in 18 with 25 ms kept, 16 as before, and none was lost. The male
# voice says these words right as they are (and the same cut cost it 3 of 26 takes), so it has
# no such setting. A first consonant keeps its voicing: that is part of the consonant ("Deo").
LATIN_IPA_VOWELS = frozenset("aeiouɛɔ")  # every vowel latin.to_ipa writes (y is i; ae, oe are e)


def soften_vowel_onset(audio: np.ndarray, pred_dur, keep_s: float) -> np.ndarray:
    """Kokoro's output (24 kHz) with its start token's frames (pred_dur[0]) silenced, except the
    last `keep_s` seconds, which fade in to where the first symbol's frames begin."""
    dur = [int(d) for d in np.asarray(pred_dur).tolist()]
    hop = len(audio) // max(1, sum(dur))  # samples per duration frame (600 at 24 kHz)
    end = min(len(audio), dur[0] * hop)
    start = max(0, end - int(keep_s * 24000))
    out = audio.copy()
    out[:start] = 0.0
    out[start:end] *= np.sin(np.linspace(0, np.pi / 2, end - start, dtype=np.float32)) ** 2
    return out


class Engine:
    def __init__(self, registry: Optional[dict] = None, capacity: int = 1):
        self.registry = registry if registry is not None else load_registry()
        self.cache = ModelCache(capacity)

    # -- specs -------------------------------------------------------------- #

    def spec(self, voice_id: str) -> dict:
        if voice_id not in self.registry:
            raise KeyError(f"voice:unknown:{voice_id}")
        s = dict(self.registry[voice_id])
        s.setdefault("voiceId", voice_id)
        return s

    # -- text front ends ------------------------------------------------------ #

    def spoken_text(self, spec: dict, text: str, lang: str) -> str:
        """The words as this voice is given them (never different words)."""
        front = spec.get("front_end", "text")
        if lang == "la":
            if front == "latin-respell":
                return latin.to_respelling(text, accents=spec.get("respell_accents", "italian"))
            if front == "latin-ipa":
                return latin.to_ipa(
                    text,
                    stress=spec.get("stress_style", "vowel"),
                    length=spec.get("length_marks", True),
                )
        t = normalize_for_voice(text, lang)
        if lang == "el" and spec.get("greek_monosyllable_accents") is False:
            t = strip_greek_monosyllable_accents(t)
        return t

    # -- one raw take --------------------------------------------------------- #

    def take_params(self, spec: dict, k: int) -> dict:
        """Take k's settings: temperature (Qwen3), cfg (VoxCPM2) or speed (Kokoro) varies a
        little. Seeds always vary too, but Kokoro does not sample: its seed reaches only the
        vocoder's noise, so its takes differ by this speed ladder alone."""
        p = dict(spec.get("params", {}))
        kind = spec["kind"]
        if kind == "qwen3":
            base_t = p.get("temperature", 0.9)
            p["temperature"] = [base_t, base_t, max(0.5, base_t - 0.15), max(0.45, base_t - 0.3)][k % 4]
        elif kind == "voxcpm2":
            base_c = p.get("cfg_value", 2.0)
            p["cfg_value"] = [base_c, base_c, base_c + 0.5, base_c + 1.0][k % 4]
        elif kind == "kokoro":
            base_s = p.get("speed", 1.0)
            p["speed"] = [base_s, base_s * 0.97, base_s * 1.03, base_s * 0.94][k % 4]
        return p

    def synthesize(self, spec: dict, spoken: str, lang: str, seed: int, params: dict) -> tuple[np.ndarray, int]:
        kind = spec["kind"]
        holder = self.cache.get(spec["repo"], spec.get("revision"), kind)
        model = holder.model
        _mx_seed(seed)
        if kind == "qwen3":
            kw: dict[str, Any] = dict(
                text=spoken,
                lang_code=spec.get("language") or QWEN_LANG.get(lang, "auto"),
                temperature=params.get("temperature"),
                top_k=params.get("top_k"),
                top_p=params.get("top_p"),
                repetition_penalty=params.get("repetition_penalty"),
                max_tokens=params.get("max_tokens") or qwen_token_budget(spoken, lang),
                split_pattern=" ",  # never split a clip
                verbose=False,
            )
            if spec.get("speaker"):
                kw["voice"] = spec["speaker"]
            if spec.get("instruct"):
                kw["instruct"] = spec["instruct"]
            if spec.get("ref_audio"):
                kw["ref_audio"] = resolve_path(spec["ref_audio"])
                kw["ref_text"] = ref_text_of(spec)
            return _collect(model.generate(**kw))
        if kind == "voxcpm2":
            kw = dict(
                text=spoken,
                inference_timesteps=params.get("inference_timesteps", 10),
                cfg_value=params.get("cfg_value", 2.0),
                max_tokens=params.get("max_tokens") or max(200, int(len(spoken) * 2.4) + 120),
            )
            if spec.get("instruct"):
                # VoxCPM2 reads "(description)text": a parenthesis inside the description
                # would end it early and the rest would be SPOKEN.
                kw["instruct"] = spec["instruct"].replace("(", ", ").replace(")", ",")
            if spec.get("ref_audio"):
                ref = resolve_path(spec["ref_audio"])
                kw["ref_audio"] = ref
                if spec.get("prompt_continuation", True):
                    kw["prompt_audio"] = ref
                    kw["prompt_text"] = (ref_text_of(spec) or "").strip() + " "
            return _collect(model.generate(**kw))
        if kind == "kokoro":
            return self._kokoro(holder, spec, spoken, lang, params)
        raise ValueError(f"unknown model kind {kind!r}")

    def _kokoro(self, holder: Loaded, spec: dict, spoken: str, lang: str, params: dict) -> tuple[np.ndarray, int]:
        from mlx_audio.tts.models.kokoro.voice import load_voice_tensor

        name = spec["kokoro_voice"]
        if name not in holder.voice_packs:
            holder.voice_packs[name] = load_voice_tensor(os.path.join(holder.path, "voices", f"{name}.safetensors"))
        pack = holder.voice_packs[name]
        front = spec.get("front_end", "text")
        if front == "latin-ipa":
            phonemes = spoken
        elif front == "misaki-en":
            phonemes = misaki_phonemes(spoken)
        else:
            raise ValueError(f"kokoro needs phonemes; front_end {front!r} not supported")
        speed = float(params.get("speed", 1.0))
        if kokoro_uses_carrier(front, phonemes):
            phrase = kokoro_in_carrier(holder.model, pack, phonemes.strip(), speed)
            if phrase is not None:
                return phrase, 24000
            # No silent cut: the phrase is said alone below, as before. Kokoro's decoder noise
            # comes from the seed and the carrier call drew on it first, so the take is not
            # bit for bit the one this seed gave before.
        pieces = latin.chunk_ipa(phonemes, limit=500)
        gap = np.zeros(int(0.16 * 24000), np.float32)
        out: list[np.ndarray] = []
        for i, ps in enumerate(pieces):
            ps = ps.strip()
            if not ps:
                continue
            o = holder.model(ps, pack[len(ps) - 1], speed, return_output=True)
            piece = np.asarray(o.audio, dtype=np.float32).reshape(-1)
            keep = spec.get("vowel_onset_keep_s")
            if keep is not None and front == "latin-ipa" and ps.lstrip(latin.STRESS)[:1] in LATIN_IPA_VOWELS:
                piece = soften_vowel_onset(piece, o.pred_dur, float(keep))
            out.append(piece)
            if i < len(pieces) - 1:
                out.append(gap)
        return (np.concatenate(out) if out else np.zeros(1, np.float32)), 24000

    # -- a checked clip ------------------------------------------------------- #

    def make_clip(
        self,
        voice_id: str,
        text: str,
        lang: str,
        *,
        seed_key: str = "",
        takes: int = 4,
        spec: Optional[dict] = None,
        stop_on_pass: bool = True,
        encode: bool = True,
    ) -> Clip:
        spec = spec or self.spec(voice_id)
        if spec.get("lang") and spec["lang"] != lang:
            raise ValueError(f"voice {voice_id} speaks {spec['lang']}, not {lang}")
        spoken = self.spoken_text(spec, text, lang)
        base_seed = stable_seed(voice_id, text, seed_key)
        all_takes: list[Take] = []
        best: Optional[Take] = None
        for k in range(max(1, takes)):
            params = self.take_params(spec, k)
            seed = base_seed + 7919 * k
            t0 = time.time()
            raw, sr = self.synthesize(spec, spoken, lang, seed, params)
            gen_s = time.time() - t0
            fin = A.finish(raw, sr, tempo=float(spec.get("tempo", 1.0)))
            t1 = time.time()
            result = QA.evaluate(fin.audio, fin.sr, text, lang, pace_ref=spec.get("pace_ref"))
            take = Take(index=k, seed=seed, params=params, raw_sr=sr, gen_s=gen_s, finished=fin, qa=result,
                        qa_s=time.time() - t1)
            all_takes.append(take)
            log.info(
                "take %d %s %s cer=%.3f pace=%.2f score=%.1f %s",
                k, voice_id, lang, result.cer, result.pace_ratio, result.score, result.verdict,
            )
            if best is None or take.qa.score < best.qa.score:
                best = take
            if stop_on_pass and not result.retake:
                break
        assert best is not None
        clip = Clip(
            voice_id=voice_id,
            lang=lang,
            text=text,
            spoken_text=spoken,
            best=best,
            takes=all_takes,
            engine_label=engine_label(spec),
        )
        if encode:
            clip.m4a = A.encode_m4a(best.finished.audio, best.finished.sr)
        return clip


# --------------------------------------------------------------------------- #
# Kokoro: a short Latin phrase is said inside a carrier sentence              #
# --------------------------------------------------------------------------- #

# Kokoro-82M learnt from whole sentences and says a very short input badly. Alone, a Latin
# "Amen." failed QA in every take ("E amen", "Lame lindri", "Garmin") and "Oremus." was
# heard as "Oremos". Two weaknesses meet there: the voice pack holds one style per input
# length, and the styles for the shortest inputs sound little like the voice; and Kokoro
# voices the last frames of its start token, which before a first vowel is heard as an
# extra vowel. So a short phrase is said in the middle of a carrier sentence, in ONE call
# with the style for the whole string's length (the rule every clip follows), and cut back
# out at the quietest 5 ms of the pause on each side; the start token stays behind with the
# first carrier. Measured through make_clip with the engine's own seeds (2026-11-21):
# "Amen." passed 40 of 40 takes in the two voices (none alone); the other short Latin texts
# measured (Oremus, Alleluia, Deo gratias, Ora pro nobis, Kyrie and Christe eleison,
# Miserere nobis) passed 106 of 112 takes (61 alone) and failed none (13 alone).

# Under 20 IPA symbols ("ˈaːmen." is 7, "mizerˈɛːre nˈɔːbis." 19) is the range measured: inside
# the carrier every text in it passed at least as often as alone, and no take failed. Clips of
# 20 symbols or more ("Christe, audi nos." and every prayer) were not measured inside the
# carrier, so they are said alone as before (the female voice's vowel onset aside).
KOKORO_SHORT = 20

# latin.to_ipa("Pater noster, qui es in caelis."), said before and after the phrase, so the
# phrase is neither the first nor the last thing Kokoro says. It starts on p and ends on s,
# both voiceless. Kokoro speaks a little ahead of its own predicted durations (25-75 ms on
# real audio), so each pause span also holds the edges of its neighbours (the next carrier's
# p burst, even the start of its vowel); but the p's closure and the end of the s leave a
# quiet gap, the quietest-5-ms search finds it, and the guard below checks it. A carrier that
# ends on a voiced sound ("Per Christum Dominum nostrum.", ending on m) left no quiet gap
# before a voiced first sound ("Deo"). And it is short (36 symbols): inside an 81-symbol
# carrier ("Per Christum Dominum nostrum, Filium tuum, qui tecum vivit et regnat.") the style
# for the longer string slowed the phrase and lowered its pitch, and no take of "Amen." passed.
KOKORO_CARRIER = "pˈaːter nˈɔster, kwi ˈɛs in ʧˈɛːlis."

# Each cut must be at least this far under the phrase's loud frames (the 95th percentile of
# its 20 ms frame levels). A louder cut would chop a sound off the phrase or keep one of the
# carrier's, so the phrase is then said alone, as before: one take in the 152 measured
# ("Deo gratias.", male voice, a cut 29 dB under).
KOKORO_CUT_DB = -30.0

KOKORO_CUT_WINDOW = 120  # samples searched for the quietest point: 5 ms at Kokoro's 24 kHz

# The cut phrase fades in and out over this many samples (5 ms, raised cosine). The cuts sit
# 40-77 dB under the phrase, but the male voice's pauses are not quite silent (30-36 dB under
# it) and his cut can fall a few ms after his last sound, so without a fade the clip would stop
# on a hard edge where every clip said alone fades out.
KOKORO_EDGE_FADE = 120

# What Kokoro says as a pause: punctuation and the space between words.
_PAUSE_MARKS = frozenset(".,;:!?…— ")


def kokoro_uses_carrier(front_end: str, phonemes: str) -> bool:
    """Whether a Kokoro clip is said inside the carrier: Latin IPA of fewer than KOKORO_SHORT
    symbols (spaces around it not counted). Every other clip takes the path it always took."""
    return front_end == "latin-ipa" and 0 < len(phonemes.strip()) < KOKORO_SHORT


def carrier_sentence(phrase: str) -> tuple[str, int, int]:
    """What Kokoro is given for `phrase`, and where the phrase sits in it: (text, index of
    the phrase's first symbol, index just past its last)."""
    first = len(KOKORO_CARRIER) + 1
    return f"{KOKORO_CARRIER} {phrase} {KOKORO_CARRIER}", first, first + len(phrase)


def symbol_start_frames(text: str, durations: Sequence[int], vocab: Container[str]) -> list[int]:
    """The duration frame at which each symbol of `text` starts, then the frame at which the
    end token starts. Kokoro predicts one duration per token: its start token, each symbol
    it knows (it drops the others, so they take no time), then its end token."""
    starts, frame, token = [], durations[0], 1
    for ch in text:
        starts.append(frame)
        if ch in vocab:
            frame += durations[token]
            token += 1
    starts.append(frame)
    return starts


def pauses_around(text: str, first: int, end: int) -> tuple[tuple[int, int], tuple[int, int]]:
    """Symbol spans [start, stop) of the pause before the phrase text[first:end] and of the
    pause after it: the marks and spaces between the phrase and each carrier. A comma inside
    the phrase ("kˈiːrie, elˈɛːizon.") belongs to the phrase and is never a place to cut."""
    before = first
    while before > 0 and text[before - 1] in _PAUSE_MARKS:
        before -= 1
    closing = end  # the phrase's own closing marks are part of the pause after it
    while closing > first and text[closing - 1] in _PAUSE_MARKS:
        closing -= 1
    after = end
    while after < len(text) and text[after] in _PAUSE_MARKS:
        after += 1
    return (before, first), (closing, after)


def quietest_point(audio: np.ndarray, a: int, b: int, win: int = KOKORO_CUT_WINDOW) -> tuple[int, float]:
    """The sample at the middle of the quietest `win` samples in audio[a:b], and their level
    in dBFS. A span shorter than the window is searched as the one window starting at `a`;
    when the audio ends less than a window after `a`, the point counts as loud (0 dBFS), so
    no cut is made there."""
    seg = audio[a:max(b, a + win)].astype(np.float64)
    if len(seg) < win:
        return (a + b) // 2, 0.0
    power = np.convolve(seg**2, np.ones(win) / win, mode="valid")
    i = int(np.argmin(power))
    return a + i + win // 2, float(10 * np.log10(power[i] + 1e-18))


@dataclass(frozen=True)
class CarrierCut:
    """Where a phrase is cut out of its carrier sentence's audio (sample indices), and how
    quiet the audio is at each cut."""

    start: int
    end: int
    start_db: float  # dBFS of the quietest 5 ms at each cut
    end_db: float
    loud_db: float  # the phrase's loud frames: 95th percentile of its 20 ms frame levels

    @property
    def silent(self) -> bool:
        """The guard: the cuts in order, each at least 30 dB (KOKORO_CUT_DB) under the
        phrase's loud frames."""
        return self.end > self.start and max(self.start_db, self.end_db) <= self.loud_db + KOKORO_CUT_DB


def find_cut(audio: np.ndarray, before: tuple[int, int], after: tuple[int, int], sr: int = 24000) -> CarrierCut:
    """The phrase's cut points: the quietest 5 ms of the pause before it and of the pause
    after it (both pauses given as sample spans)."""
    start, start_db = quietest_point(audio, *before)
    end, end_db = quietest_point(audio, *after)
    loud = float(np.percentile(A.frame_db(audio[start:end], sr), 95)) if end > start else 0.0
    return CarrierCut(start, end, start_db, end_db, loud)


def kokoro_in_carrier(model, pack, phrase: str, speed: float) -> Optional[np.ndarray]:
    """`phrase` said between two copies of KOKORO_CARRIER in one Kokoro call and cut back out
    (24 kHz), or None when a cut would not fall in silence (the caller then says the phrase
    alone, as before)."""
    text, first, end = carrier_sentence(phrase)
    out = model(text, pack[len(text) - 1], speed, return_output=True)
    audio = np.asarray(out.audio, dtype=np.float32).reshape(-1)
    durations = [int(d) for d in np.asarray(out.pred_dur).tolist()]
    hop = len(audio) // max(1, sum(durations))  # samples per duration frame (600 at 24 kHz)
    frames = symbol_start_frames(text, durations, model.vocab)
    (a, b), (c, d) = pauses_around(text, first, end)
    cut = find_cut(audio, (frames[a] * hop, frames[b] * hop), (frames[c] * hop, frames[d] * hop))
    if not cut.silent:
        # A warning, so it reaches the engine's log (the worker shows only warnings from the
        # engine): a short Latin clip said alone is the one Kokoro garbles.
        log.warning(
            "kokoro carrier: no silent cut for %r (%.0f and %.0f dB against the phrase, %.0f needed); said alone",
            phrase, cut.start_db - cut.loud_db, cut.end_db - cut.loud_db, KOKORO_CUT_DB,
        )
        return None
    return fade_edges(audio[cut.start:cut.end])


def fade_edges(audio: np.ndarray, n: int = KOKORO_EDGE_FADE) -> np.ndarray:
    """A copy of `audio` that fades in over its first `n` samples and out over its last `n`
    (raised cosine; a clip shorter than 2n fades over half its length)."""
    out = np.array(audio, dtype=np.float32, copy=True)
    n = min(n, len(out) // 2)
    if n > 0:
        ramp = (0.5 - 0.5 * np.cos(np.linspace(0.0, np.pi, n))).astype(np.float32)
        out[:n] *= ramp
        out[-n:] *= ramp[::-1]
    return out


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #

_GREEK_KEEP_ACCENT = {"ή", "πού", "πώς", "τί"}


def strip_greek_monosyllable_accents(text: str) -> str:
    """Modern monotonic spelling: monosyllables carry no accent (τού -> του, καί -> και)."""
    import re
    import unicodedata

    def fix(m: "re.Match[str]") -> str:
        w = m.group(0)
        if w.lower() in _GREEK_KEEP_ACCENT:
            return w
        bare = "".join(c for c in unicodedata.normalize("NFD", w) if not unicodedata.combining(c))
        vowels = re.findall(r"(ου|αι|ει|οι|υι|αυ|ευ|ηυ|[αεηιουω])", bare.lower())
        if len(vowels) == 1:
            return unicodedata.normalize("NFC", bare)
        return w

    return re.sub(r"[Ͱ-Ͽἀ-῿]+", fix, text)


_MISAKI = None


def misaki_phonemes(text: str) -> str:
    """English text -> Kokoro phonemes with misaki's G2P (no eSpeak fallback)."""
    global _MISAKI
    if _MISAKI is None:
        from misaki import en  # optional dependency, only for Kokoro English voices

        _MISAKI = en.G2P(trf=False, british=False, fallback=None, unk="❓")
    ps, _tokens = _MISAKI(text)
    if "❓" in ps:
        raise ValueError("misaki: out-of-vocabulary word")
    return ps
