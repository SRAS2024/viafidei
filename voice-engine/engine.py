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
              own front end (latin.py -> Kokoro IPA).

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
        """Take k's sampling settings: seeds always vary; temperature/cfg vary a little."""
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
        pieces = latin.chunk_ipa(phonemes, limit=500)
        gap = np.zeros(int(0.16 * 24000), np.float32)
        out: list[np.ndarray] = []
        for i, ps in enumerate(pieces):
            ps = ps.strip()
            if not ps:
                continue
            o = holder.model(ps, pack[len(ps) - 1], speed, return_output=True)
            out.append(np.asarray(o.audio, dtype=np.float32).reshape(-1))
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
