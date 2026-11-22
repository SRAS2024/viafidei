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
import re
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
    # A take joined from one take per sentence (make_clip's per-sentence fallback): the take
    # of each sentence that was used, in order (one take twice when a sentence used the take of
    # another with the same words: params["borrowed"]). Empty for a take of the whole clip.
    sentences: list["Take"] = field(default_factory=list)

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
    takes: list[Take] = field(default_factory=list)  # the takes of the whole clip
    engine_label: str = ""
    m4a: bytes = b""
    # The per-sentence fallback, when it ran: every take of each sentence, and the clip joined
    # from the best of each (best is that joined take when it judged better than every take of
    # the whole clip, none of those sentence takes failed, and, when the best whole take was
    # usable (marginal), its words judged better too; see Engine.say_by_sentence).
    sentence_takes: list[list[Take]] = field(default_factory=list)
    joined: Optional[Take] = None

    @property
    def qa(self) -> QA.QAResult:
        return self.best.qa

    @property
    def per_sentence(self) -> bool:
        """Whether the clip kept is the one said a sentence at a time."""
        return bool(self.best.sentences)

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


def best_take(takes: Sequence[Take]) -> Take:
    """The take QA scores best (lowest score); the first of equals."""
    return min(takes, key=lambda t: t.qa.score)


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
        """The clip in up to `takes` takes of the whole text, each checked by qa.py, the best kept
        (stopping at the first that needs no other). When no take is right (each failed on its
        words, had them only marginal: words_wrong, or failed outright, on pace, a silence or a
        tail) and the voice is Qwen3-TTS or VoxCPM2, the clip is said again a sentence at a time,
        and that is kept if it judges better and no sentence of it failed its own check, with
        better words too when the best whole take was usable (say_by_sentence)."""
        spec = spec or self.spec(voice_id)
        if spec.get("lang") and spec["lang"] != lang:
            raise ValueError(f"voice {voice_id} speaks {spec['lang']}, not {lang}")
        spoken = self.spoken_text(spec, text, lang)
        base_seed = stable_seed(voice_id, text, seed_key)
        all_takes = self.takes_of(spec, voice_id, text, spoken, lang, base_seed, takes, stop_on_pass)
        clip = Clip(
            voice_id=voice_id,
            lang=lang,
            text=text,
            spoken_text=spoken,
            best=best_take(all_takes),
            takes=all_takes,
            engine_label=engine_label(spec),
        )
        # Said a sentence at a time when no whole take is right: its words wrong, or failed outright
        # for any reason. The male English voice read an eight-line litany opening ("Lord, have
        # mercy on us. Lord, have mercy on us. Christ, …") word-perfect but at 0.43-0.45 of its own
        # pace in 4 of 4 takes, its pauses swelling to 0.4-2.3 s (2026-11-22); said a sentence at a
        # time, every sentence passed and the join, with the voice's own sentence pause, was usable.
        if spec["kind"] in SENTENCE_FALLBACK_KINDS and all(
            words_wrong(t.qa) or t.qa.verdict == "fail" for t in all_takes
        ):
            sentences = self.sentences(spec, text, lang)
            if len(sentences) >= 2:
                self.say_by_sentence(clip, spec, sentences, base_seed, takes, stop_on_pass)
        if encode:
            clip.m4a = A.encode_m4a(clip.best.finished.audio, clip.best.finished.sr)
        return clip

    def takes_of(
        self,
        spec: dict,
        voice_id: str,
        text: str,
        spoken: str,
        lang: str,
        base_seed: int,
        takes: int,
        stop_on_pass: bool,
        what: str = "take",
    ) -> list[Take]:
        """Up to `takes` takes of `spoken`, each finished at the voice's tempo and checked against
        `text`; it stops at the first take that needs no other when `stop_on_pass`."""
        out: list[Take] = []
        for k in range(max(1, takes)):
            params = self.take_params(spec, k)
            seed = base_seed + 7919 * k
            t0 = time.time()
            raw, sr = self.synthesize(spec, spoken, lang, seed, params)
            gen_s = time.time() - t0
            fin = A.finish(raw, sr, tempo=float(spec.get("tempo", 1.0)))
            t1 = time.time()
            result = QA.evaluate(fin.audio, fin.sr, text, lang, pace_ref=spec.get("pace_ref"))
            out.append(Take(index=k, seed=seed, params=params, raw_sr=sr, gen_s=gen_s, finished=fin, qa=result,
                            qa_s=time.time() - t1))
            log.info(
                "%s %d %s %s cer=%.3f pace=%.2f score=%.1f %s",
                what, k, voice_id, lang, result.cer, result.pace_ratio, result.score, result.verdict,
            )
            if stop_on_pass and not result.retake:
                break
        return out

    # -- the per-sentence fallback -------------------------------------------- #

    def sentences(self, spec: dict, text: str, lang: str) -> list[tuple[str, str]]:
        """The clip's sentences (split_sentences), each with the words this voice is given for it,
        or [] for a clip of one sentence. Said one after another they must give the voice exactly
        the words the whole clip gives it: where two sentences said apart would be read otherwise
        than said together (normalize.py reads a number by the word after it), they stay one. A
        sentence with no letter in it (a stray mark) joins the one before it, or the first the
        one after it."""
        spans = sentence_spans(text, lang)
        if len(spans) < 2:
            # One long sentence: its clauses. The female Spanish voice dropped the same clause of
            # "…; rezo por todos los enfermos, …; rezo por todos los prisioneros; rezo por todos
            # los malhechores." in 4 of 4 takes (2026-11-21), a repeated phrase skipped as a
            # repeated word is; said a clause at a time, each clause is heard on its own.
            spans = sentence_spans(text, lang, clauses=True)
        if len(spans) < 2:
            return []

        def words(a: int, b: int) -> str:  # the text of sentences a..b-1
            return text[spans[a][0]:spans[b - 1][1]]

        def said(a: int, b: int) -> str:  # the voice's words for them, spaces aside
            return re.sub(r"\s+", "", self.spoken_text(spec, words(a, b), lang))

        n = len(spans)
        whole = said(0, n)
        cuts = [j for j in range(1, n) if said(0, j) + said(j, n) == whole]
        groups: list[list[int]] = []
        for a, b in zip([0] + cuts, cuts + [n]):
            if groups and not (_has_letter(words(a, b)) and _has_letter(words(*groups[-1]))):
                groups[-1][1] = b
            else:
                groups.append([a, b])
        if len(groups) < 2 or "".join(said(a, b) for a, b in groups) != whole:
            return []
        return [(words(a, b), self.spoken_text(spec, words(a, b), lang)) for a, b in groups]

    def say_by_sentence(
        self,
        clip: Clip,
        spec: dict,
        sentences: Sequence[tuple[str, str]],
        base_seed: int,
        takes: int,
        stop_on_pass: bool,
    ) -> None:
        """Says the clip a sentence at a time, after no take of the whole clip said its words right
        (words_wrong: wrong or missing words, a word said fewer times running than the text says,
        nothing heard, or words only marginal). A sampling model can drop a word from a whole take
        that a shorter take keeps: the refrain "Ave, Ave, Ave, Maria! Ave, Ave, Ave, Maria!" lost
        one Ave in each of 8 whole takes in the female English voice, always in its second half,
        and said alone that half keeps all three Aves in one half to two thirds of its takes. Said
        apart one take each and joined, one of the two halves still lost an Ave in each of 8 tries;
        so each sentence gets up to `takes` takes of its own, judged by QA against its own words,
        and the best of each is kept. A sentence whose best take failed takes the best take that
        did not fail of another sentence the voice is given the very same words for (the two
        halves of that refrain): the male English voice's first half failed in 4 takes of a verse
        where its second half, the same words, passed in one. Those are joined with a sentence's
        pause (join_sentences), finished like any take and judged against the whole text. The
        joined take becomes the clip's best take only when it judges better than the best take of
        the whole clip AND none of the sentence takes it is made of failed its own check
        (clip.per_sentence then says so): the joined clip's check does not see everything a
        sentence's check saw, such as a sentence that runs on into sound Whisper does not write
        down, a tail at that sentence's end but no tail of the joined clip, which goes on after
        it. When that whole take is usable (marginal: its words only a little off), the joined
        take must also have fewer wrong words (a lower character or syllable error): the row has
        a clip to play already, and the clip is said apart for its words, not for its pace. Both
        steps are logged as warnings, so they reach the worker's log (it shows only the engine's
        warnings)."""
        whole = clip.best
        log.warning(
            "per sentence: %s %s %r: no take of the whole clip said its words right (best: %s; heard %r); "
            "saying its %d sentences one by one",
            clip.voice_id, clip.lang, clip.text[:60], "; ".join(whole.qa.reasons), whole.qa.transcript[:120],
            len(sentences),
        )
        t0 = time.time()
        tried: list[list[Take]] = []
        for i, (sentence, spoken) in enumerate(sentences):
            tried.append(self.takes_of(spec, clip.voice_id, sentence, spoken, clip.lang, sentence_seed(base_seed, i),
                                       takes, stop_on_pass, what=f"sentence {i} take"))
        own = [best_take(ts) for ts in tried]
        lent = borrowed_takes(sentences, own)
        parts = [own[lent[i]] if i in lent else p for i, p in enumerate(own)]
        fin = A.finish(join_sentences([p.finished.audio for p in parts], A.TARGET_SR), A.TARGET_SR)
        t1 = time.time()
        result = QA.evaluate(fin.audio, fin.sr, clip.text, clip.lang, pace_ref=spec.get("pace_ref"),
                             words_verified=verified_words(sentences, parts))
        params: dict[str, Any] = {"sentences": len(parts), "pause_s": SENTENCE_PAUSE_S}
        if lent:
            params["borrowed"] = dict(lent)
        joined = Take(
            index=len(clip.takes),
            seed=parts[0].seed,
            params=params,
            raw_sr=parts[0].raw_sr,
            gen_s=sum(t.gen_s for ts in tried for t in ts),
            finished=fin,
            qa=result,
            qa_s=sum(t.qa_s for ts in tried for t in ts) + time.time() - t1,
            sentences=parts,
        )
        clip.sentence_takes = tried
        clip.joined = joined
        failed = [(sentence, p) for (sentence, _), p in zip(sentences, parts) if p.qa.verdict == "fail"]
        better = result.score < whole.qa.score
        fewer_wrong = whole.qa.verdict == "fail" or word_error(result) < word_error(whole.qa)
        if better and fewer_wrong and not failed:
            clip.best = joined
            outcome = "kept"
        elif failed:
            outcome = "not kept, as the best take of {} {} its own check".format(
                " and of ".join(f"{s[:40]!r} ({'; '.join(p.qa.reasons)})" for s, p in failed),
                "failed" if len(failed) == 1 else "each failed",
            )
        elif not better:
            outcome = "not kept, as it judges no better"
        else:
            outcome = "not kept, as its words are no better ({} {:.3f}, the whole clip's {:.3f})".format(
                "ser" if result.ser is not None else "cer", word_error(result), word_error(whole.qa))
        log.warning(
            "per sentence: %s %s %r: sentences %s; joined %s cer=%.3f pace=%.2f score=%.1f, heard %r; %s "
            "(best take of the whole clip: %s, score %.1f) in %.1fs",
            clip.voice_id, clip.lang, clip.text[:60],
            ", ".join(
                f"{p.qa.verdict} in {len(ts)}" + (f", so sentence {lent[i]}'s take (the same words)" if i in lent else "")
                for i, (p, ts) in enumerate(zip(own, tried))
            ),
            result.verdict, result.cer, result.pace_ratio, result.score, result.transcript[:120],
            outcome, whole.qa.verdict, whole.qa.score, time.time() - t0,
        )


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
# Saying a clip a sentence at a time (make_clip's per-sentence fallback)      #
# --------------------------------------------------------------------------- #

# The models that sample, whose short takes can say words their whole take dropped. Kokoro does
# not sample (its takes differ by speed alone) and already says a long clip in pieces.
SENTENCE_FALLBACK_KINDS = frozenset({"qwen3", "voxcpm2"})

# The pause between two sentences said apart: from the last sound of one (audio.speech_bounds)
# to the first of the next. The voices' own pause at a sentence end, measured on 2026-11-21 at
# 58 sentence ends of normal takes made as make_clip makes them (the Hail Mary, Glory Be and Act
# of Contrition in English, the Hail Mary in Spanish, the Hail Mary and Glory Be in Polish),
# counting a breath as part of the pause: median 0.47 s for the female English voice, 0.60 for
# the male one, 0.56-0.57 for the Spanish voices and 0.44-0.45 for the Polish ones (VoxCPM2); up
# to 0.79 s, and none at all once (the female English voice ran on into "Amen"). The low end of
# the medians is taken: a longer pause would slow the joined clip's pace.
SENTENCE_PAUSE_S = 0.45

# Each sentence keeps this much of its own quiet on either side of its sound, faded to nothing,
# so no cut clicks; silence fills the rest of the pause.
SENTENCE_EDGE_S = 0.020

# A full stop after one of these is an abbreviation's, not a sentence's end: the website's own
# list (src/lib/pray-along/speech-text.ts, ABBREVIATION_BEFORE_DOT), which cut the prayer into
# the sentences a clip is packed from, with the French plural qa.py also reads as a word (Stes),
# and the Polish św. (święty, saint) and bł. (błogosławiony, blessed) and the German hl. (heilig,
# saint), which the website does not list and which stand before a capital ("św. Józefie",
# "hl. Josef").
SENTENCE_ABBREVIATIONS = frozenset({
    "St", "Sts", "SS", "Ste", "Stes", "Sta", "Sto", "Bl", "Ven", "Mt", "Mr", "Mrs", "Dr", "Fr", "Rev", "Br",
    "Sr", "No", "Nos", "vs", "cf", "Cf", "viz", "ibid", "Ps", "Pss", "ch", "vol", "p", "pp",
    "św", "Św", "bł", "Bł", "hl", "Hl",
})

_SENTENCE_MARK = re.compile(r"[.!?;…。！？；·\u0387][\"'”’»)\]]*")  # a mark, with the quotes or brackets it closes
_CJK_ENDS = frozenset("。！？")  # end a sentence wherever they stand
# Where a clause ends inside one long sentence: the semicolon (in Greek the raised dot, its own
# semicolon, as its ";" is a question mark), and the full-width one of Chinese.
_CLAUSE_MARKS = {"el": frozenset("·\u0387")}
_CLAUSE_MARKS_DEFAULT = frozenset(";；")
_OPENERS = re.compile(r"^[\"'“‘«(\[*‖\s]+")  # what may stand before a sentence's first letter
_LAST_WORD = re.compile(r"[^\s(\"“‘'\[]*$")  # the word just before a mark
# A Roman numeral as normalize.py reads one (I to XXXIX): "II. We offer", "Pius XII.".
_ROMAN_NUMERAL = re.compile(r"(?=[IVX])X{0,3}(?:IX|IV|V?I{0,3})")


def _has_letter(s: str) -> bool:
    return any(ch.isalpha() for ch in s)


def _ends_no_sentence(before: str) -> bool:
    """A full stop after `before` (the sentence so far) that does not end it: after an
    abbreviation, a single capital ("R.", "V.", "B. V. M."), a number ("1. Todas las cosas",
    "am 8. Dezember") or a Roman numeral. normalize.py reads a number by the word after it
    (a German "8." before a month is "achten"), so a number is never cut from what follows."""
    word = _LAST_WORD.search(before).group(0)
    if word in SENTENCE_ABBREVIATIONS:
        return True
    if len(word) == 1 and word.isalpha() and word.isupper():
        return True
    return word[-1:].isdigit() or bool(_ROMAN_NUMERAL.fullmatch(word))


def sentence_spans(text: str, lang: str, clauses: bool = False) -> list[tuple[int, int]]:
    """Where each sentence of `text` starts and ends ([start, end) in `text`, spaces outside).
    The cuts are the website's (speech-text.ts splitSentences), which packed whole sentences
    into the clip: after . ! ? … (and ; in Greek, its question mark) where a new sentence opens,
    that is before anything but a small letter ("O Mary! which you exhibited" is one sentence),
    never after an abbreviation; and after 。！？ wherever they stand. Unlike the website's, a full
    stop after a number, a Roman numeral or a single capital of any alphabet ("Ρ.") never cuts,
    nor one after the Polish and German abbreviations (_ends_no_sentence). With `clauses`, a
    clause's end cuts too (_CLAUSE_MARKS), before a small letter as well: the semicolons of one
    long sentence."""
    spans: list[tuple[int, int]] = []
    start = 0

    def add(a: int, b: int) -> None:
        piece = text[a:b]
        if piece.strip():
            lead = len(piece) - len(piece.lstrip())
            spans.append((a + lead, a + len(piece.rstrip())))

    clause_marks = _CLAUSE_MARKS.get(lang, _CLAUSE_MARKS_DEFAULT)
    for m in _SENTENCE_MARK.finditer(text):
        mark, at, end = m.group(0)[0], m.start(), m.end()
        if mark in clause_marks or mark in "；·\u0387":
            # A clause's end: a cut only when clauses are asked for, and where a space follows
            # (none after the full-width semicolon); the clause after it may open small.
            if not clauses or mark not in clause_marks or (mark != "；" and text[end:end + 1] not in ("", " ", "\n")):
                continue
            add(start, end)
            start = end
            continue
        if mark not in _CJK_ENDS:
            rest = text[end:]
            if mark == ";" and lang != "el":
                continue
            if rest and not rest[0].isspace():
                continue
            first = _OPENERS.sub("", rest)[:1]
            if first and first.islower():
                continue
            if mark == "." and _ends_no_sentence(text[start:at]):
                continue
        add(start, end)
        start = end
    add(start, len(text))
    return spans


def split_sentences(text: str, lang: str) -> list[str]:
    """The sentences of `text` (sentence_spans), as written."""
    return [text[a:b] for a, b in sentence_spans(text, lang)]


def sentence_seed(base_seed: int, index: int) -> int:
    """The seed of sentence `index`'s first take: drawn from the clip's own seed, so a clip says
    its sentences the same way each time and a retry (new seed key) says them anew. Its takes
    add 7919 per take, as the whole clip's do."""
    return stable_seed(str(base_seed), "sentence", str(index))


def failed_on_words(q: QA.QAResult) -> bool:
    """A take that failed QA on its words (QAResult.words_failed: the model dropped or garbled
    words), not only on its pace, a silence, a tail or extra words at an end."""
    return q.verdict == "fail" and q.words_failed


def words_wrong(q: QA.QAResult) -> bool:
    """A take that did not say its words right: it failed on them (failed_on_words) or had them
    only marginal (QAResult.words_marginal), whatever else it did. A Spanish litany missing a
    whole sentence was kept at CER 0.099, a marginal take: its words, not its pace, were wrong,
    and a sentence said alone can bring the missing one back. A take whose words are right does
    not count, whatever else it failed on: its pace, a silence or a tail. (Extra words at an end
    add to its error, so a take that failed on them has its words at least a little off.)"""
    return failed_on_words(q) or q.words_marginal


def verified_words(sentences: Sequence[tuple[str, str]], parts: Sequence[Take]) -> Optional[float]:
    """The joined take's word error when every sentence's take PASSED its own check (each sentence's
    error weighted by its length), else None. Whisper on the whole joined clip collapses a repeated
    sentence, so it would judge again, and wrongly, words already heard right one by one."""
    if not parts or any(p.qa.verdict != "pass" for p in parts):
        return None
    sizes = [max(1, len(sentence)) for sentence, _ in sentences]
    return sum(word_error(p.qa) * n for p, n in zip(parts, sizes)) / sum(sizes)


def word_error(q: QA.QAResult) -> float:
    """The error QA judged a take's words by: syllables for Vietnamese and Chinese, characters
    elsewhere (as Clip.qa_score)."""
    return q.ser if q.ser is not None else q.cer


def borrowed_takes(sentences: Sequence[tuple[str, str]], best: Sequence[Take]) -> dict[int, int]:
    """{sentence: the sentence whose take it uses instead of its own}: each sentence whose best
    take (`best`, one per sentence) failed its check takes the best one that did not of another
    sentence the voice is given the very same words for (the spoken text of `sentences`, character
    for character: then the take says this sentence's words). The lowest score wins, the first of
    equals; a sentence with no such twin keeps its own."""
    lent: dict[int, int] = {}
    for i, (_, spoken) in enumerate(sentences):
        if best[i].qa.verdict != "fail":
            continue
        twins = [k for k, (_, other) in enumerate(sentences)
                 if k != i and other == spoken and best[k].qa.verdict != "fail"]
        if twins:
            lent[i] = min(twins, key=lambda k: best[k].qa.score)
    return lent


def _ramp(n: int) -> np.ndarray:
    return (np.sin(np.linspace(0, np.pi / 2, n, dtype=np.float32)) ** 2).astype(np.float32)


def join_sentences(parts: Sequence[np.ndarray], sr: int = A.TARGET_SR, pause_s: float = SENTENCE_PAUSE_S) -> np.ndarray:
    """Finished takes of a clip's sentences as one take: each cut to its sound (audio.speech_bounds)
    with SENTENCE_EDGE_S of its own quiet on either side, faded to nothing, and `pause_s` from the
    last sound of one to the first sound of the next. A part with no sound adds nothing. The result
    is finished again (trim, loudness) like any take."""
    edge = int(round(SENTENCE_EDGE_S * sr))
    pause = int(round(pause_s * sr))
    out: list[np.ndarray] = []
    tail = 0  # quiet kept after the last part's sound
    for x in parts:
        x = np.asarray(x, dtype=np.float32)
        s, e = A.speech_bounds(x, sr)
        if e <= s:
            continue
        a, b = max(0, s - edge), min(len(x), e + edge)
        seg = x[a:b].copy()
        if s > a:
            seg[: s - a] *= _ramp(s - a)
        if b > e:
            seg[len(seg) - (b - e):] *= _ramp(b - e)[::-1]
        if out:
            out.append(np.zeros(max(0, pause - tail - (s - a)), np.float32))
        out.append(seg)
        tail = b - e
    return np.concatenate(out) if out else np.zeros(1, np.float32)


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
