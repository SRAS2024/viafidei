"""
The voice bake-off: design candidate voices, lock them, speak the same test set with
every candidate, score each take, and pick a voice per language x gender.

Phases (run one at a time, one model per process, in this order):
    python tools/bakeoff.py qwen-design      # Qwen3 VoiceDesign: candidate designs
    python tools/bakeoff.py qwen-stock       # Qwen3 CustomVoice stock speakers (+ Latin control)
    python tools/bakeoff.py qwen-lock        # Qwen3 Base: locked designs + Latin respelling
    python tools/bakeoff.py voxcpm           # VoxCPM2: design + lock pl/el/tl/vi
    python tools/bakeoff.py kokoro           # Kokoro: Latin IPA voices, af_heart, Latin QA check
    python tools/bakeoff.py pick             # choose, install voices, write the report

Working files go to $VOICE_WORK (default: <repo>/.cache/pray-along-work/voice).
Every phase is resumable: a candidate whose results exist is skipped (--force redoes).
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "tools"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import numpy as np  # noqa: E402

import audio as A  # noqa: E402
import engine as E  # noqa: E402
import latin  # noqa: E402
import qa as QA  # noqa: E402
import texts as T  # noqa: E402

WORK = Path(os.environ.get("VOICE_WORK", HERE.parent / ".cache" / "pray-along-work" / "voice"))
DESIGNS = WORK / "designs"
CLIPS = WORK / "clips"
RESULTS = WORK / "results"
log = logging.getLogger("bakeoff")

REPO = {
    "design": ("mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16", "7d3824abff87e49756bb0f83fb5411de75d160c4"),
    "custom": ("mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16", "52f4770fd9726457eae3d3b6aa92047a25a10776"),
    "base": ("mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16", "a6eb4f68e4b056f1215157bb696209bc82a6db48"),
    "voxcpm": ("mlx-community/VoxCPM2-bf16", "a7fb80d9056983135a54ca3f71fcc5a637ccddf5"),
    "kokoro": ("mlx-community/Kokoro-82M-bf16", "a71e4d38b236d968966a2002c4c895dbd12b1c3c"),
}

LANG_NAME = {
    "en": ("English", "General American"), "es": ("Spanish", "neutral Latin American (Mexican)"),
    "fr": ("French", "standard Parisian French"), "it": ("Italian", "standard Italian"),
    "de": ("German", "standard High German"), "pt": ("Brazilian Portuguese", "Brazilian (São Paulo)"),
    "ko": ("Korean", "standard Seoul Korean"), "zh": ("Mandarin Chinese", "standard Putonghua"),
    "pl": ("Polish", "standard Polish"), "el": ("Greek", "standard Athenian Greek"),
    "tl": ("Filipino", "Manila Tagalog"), "vi": ("Vietnamese", "Northern Hanoi Vietnamese"),
}

DESC = {
    "female": [
        "A warm, gentle woman in her forties with a soft, clear, mid-pitched voice. She is a native {L} speaker with a natural {A} accent. She prays aloud calmly and sincerely at a natural, unhurried conversational pace, with gentle natural intonation, reverent but not slow and not theatrical.",
        "A kind, motherly woman in her fifties with a warm, slightly low, smooth voice, speaking {L} as her native language with a {A} accent. Calm, peaceful and heartfelt, like leading a prayer in a quiet church, with natural human rhythm and phrasing at a normal speaking speed.",
        "A woman around thirty with a bright yet soft and warm voice, a native {L} speaker with {A} pronunciation and clear diction. Gentle, devout and natural, speaking at an ordinary relaxed pace with natural pitch movement.",
        "A warm, friendly woman in her thirties or forties with a clear, natural, mid-pitched voice, a native {L} speaker with a {A} accent. She says a short prayer aloud the way people say it together in church every day: fluent and flowing, at a normal conversational speed, warm and sincere, without dragging and without dramatic pauses.",
        "A native {L} speaker: a calm adult woman with a pleasant, warm voice and {A} pronunciation. Natural, fluent everyday speech at a normal speed, gentle and kind, with clear diction and no theatrical emphasis.",
    ],
    "male": [
        "A warm, calm man in his forties with a gentle, resonant baritone voice. He is a native {L} speaker with a natural {A} accent. He prays aloud sincerely at a natural, unhurried conversational pace, with natural intonation, reverent but not slow and not theatrical.",
        "A kind, fatherly man in his fifties with a deep, soft, smooth voice, speaking {L} as his native language with a {A} accent. Peaceful and heartfelt, like a priest leading a quiet prayer, with natural human rhythm at a normal speaking speed.",
        "A man around thirty-five with a clear, warm, mid-low voice, a native {L} speaker with {A} pronunciation and clear diction. Gentle and devout, speaking at an ordinary relaxed pace with natural pitch movement.",
        "A warm, friendly man in his thirties or forties with a clear, natural baritone voice, a native {L} speaker with a {A} accent. He says a short prayer aloud the way people say it together in church every day: fluent and flowing, at a normal conversational speed, warm and sincere, without dragging and without dramatic pauses.",
        "A native {L} speaker: a calm adult man with a pleasant, warm, low-mid voice and {A} pronunciation. Natural, fluent everyday speech at a normal speed, gentle and kind, with clear diction and no theatrical emphasis.",
    ],
}

QWEN_DESIGN_CELLS = [
    "en-female", "es-female", "es-male", "fr-female", "fr-male", "it-female", "it-male",
    "de-female", "de-male", "pt-female", "pt-male", "ko-female", "ko-male", "zh-male", "zh-female",
]
VOX_CELLS = ["pl-female", "pl-male", "el-female", "el-male", "tl-female", "tl-male", "vi-female", "vi-male"]

STYLE_EN = "Speak in a warm, calm, gentle and prayerful tone, sincere and natural, at a normal unhurried speaking pace."
STYLE_ZH = "用温暖、平静、真诚的语气祈祷，语速自然，不要太慢，不要夸张。"
STOCK = {
    "zh-female": [("Serena", STYLE_ZH), ("Vivian", STYLE_ZH), ("Serena", None), ("Vivian", None)],
    "zh-male": [("Uncle_Fu", STYLE_ZH)],
    "ko-female": [("Sohee", STYLE_EN)],
    "en-male": [("Aiden", STYLE_EN), ("Ryan", STYLE_EN)],
}


# --------------------------------------------------------------------------- #
# Small helpers                                                               #
# --------------------------------------------------------------------------- #


def cell_parts(cell: str) -> tuple[str, str]:
    lang, gender = cell.split("-")
    return lang, gender


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    tmp.replace(path)


def load_json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def gender_ok(gender: str, f0) -> bool:
    if f0 is None:
        return False
    return f0 >= 150 if gender == "female" else f0 <= 165


def take_summary(t: E.Take) -> dict:
    d = t.qa.to_dict()
    d.update(take=t.index, seed=t.seed, gen_s=round(t.gen_s, 2), qa_s=round(t.qa_s, 2), rtf=round(t.rtf, 3), params=t.params)
    return d


def run_candidate(eng: E.Engine, cand_id: str, cell: str, spec: dict, meta: dict, force: bool) -> dict:
    """Speaks the cell's test set with one candidate; saves the best take of each clip."""
    out_path = RESULTS / f"{cand_id.replace(':', '_').replace('/', '_')}.json"
    if out_path.exists() and not force:
        return load_json(out_path)
    lang, gender = cell_parts(cell)
    clip_dir = CLIPS / out_path.stem
    rows = []
    for name, text in T.test_set(lang):
        clip = eng.make_clip(spec["voiceId"], text, lang, spec=spec, takes=4, seed_key=name, encode=False)
        A.write_flac(clip.best.finished.audio, clip.best.finished.sr, str(clip_dir / f"{name}.flac"))
        rows.append(
            dict(
                clip=name,
                text=text,
                chars=len(text),
                spoken=clip.spoken_text,
                takes_used=len(clip.takes),
                best=take_summary(clip.best),
                takes=[take_summary(t) for t in clip.takes],
            )
        )
        b = clip.best.qa
        log.info("%s %s %s cer=%.3f pace=%.2f f0=%s takes=%d", cand_id, name, b.verdict, b.cer, b.pace_ratio, b.f0_median_hz, len(clip.takes))
    result = dict(candidate=cand_id, cell=cell, spec=spec, meta=meta, clips=rows, aggregate=aggregate(rows, gender))
    save_json(out_path, result)
    return result


def aggregate(rows: list[dict], gender: str | None = None) -> dict:
    chars = sum(r["chars"] for r in rows) or 1
    cer_w = sum(r["best"]["cer"] * r["chars"] for r in rows) / chars
    verdicts = [r["best"]["verdict"] for r in rows]
    gen = sum(t["gen_s"] for r in rows for t in r["takes"])
    dur = sum(t["duration_s"] for r in rows for t in r["takes"])
    f0 = [r["best"]["f0_median_hz"] for r in rows if r["best"]["f0_median_hz"]]
    spread = [r["best"]["f0_spread_st"] for r in rows if r["best"]["f0_spread_st"]]
    pace = [r["best"]["pace_ratio"] for r in rows]
    syl = [r["best"]["syl_per_s"] for r in rows]
    takes = [r["takes_used"] for r in rows]
    first_pass = sum(1 for r in rows if r["takes"][0]["verdict"] == "pass") / len(rows)
    sers = [r["best"].get("ser") for r in rows]
    has_ser = all(x is not None for x in sers)
    ser_w = sum(r["best"]["ser"] * r["chars"] for r in rows) / chars if has_ser else None
    agg = dict(
        cer=round(cer_w, 4),
        cer_max=round(max(r["best"]["cer"] for r in rows), 4),
        ser=round(ser_w, 4) if has_ser else None,
        ser_max=round(max(sers), 4) if has_ser else None,
        passes=verdicts.count("pass"),
        marginal=verdicts.count("marginal"),
        fails=verdicts.count("fail"),
        clips=len(rows),
        pace_ratio=round(float(np.mean(pace)), 3),
        syl_per_s=round(float(np.mean(syl)), 2),
        f0_median_hz=round(float(np.median(f0)), 1) if f0 else None,
        f0_spread_st=round(float(np.mean(spread)), 2) if spread else None,
        max_silence_s=round(max(r["best"]["max_silence_s"] for r in rows), 2),
        takes_mean=round(float(np.mean(takes)), 2),
        first_take_pass=round(first_pass, 2),
        rtf=round(gen / max(dur, 1e-6), 3),
        lufs=round(float(np.mean([r["best"]["lufs"] for r in rows])), 2),
    )
    agg["rank_score"] = rank_score(agg, gender)
    return agg


def rank_score(a: dict, gender: str | None = None) -> float:
    """Lower is better. Pronunciation first (1% CER, about one wrong syllable in a prayer,
    costs 3 points), then pace (a clip 20% off the natural pace costs about 1.5),
    robustness (re-takes) and liveliness (a flat, robotic pitch line)."""
    if a.get("ser") is not None:  # Vietnamese, Chinese: whole syllables (tones) count
        s = 300 * a["ser"] + 50 * a["ser_max"]
    else:
        s = 300 * a["cer"] + 50 * a["cer_max"]
    s += 8 * abs(math.log(max(a["pace_ratio"], 1e-3)))
    s += 15 * a["fails"] + 2 * a["marginal"]
    s += 1.5 * (a["takes_mean"] - 1)
    sp = a.get("f0_spread_st") or 0
    if sp < 1.6:  # flat, robotic reading
        s += 3 * (1.6 - sp)
    f0 = a.get("f0_median_hz")
    if f0 and gender == "male" and f0 > 140:  # members chose a man's voice: a clearly male pitch
        s += 0.1 * (f0 - 140)
    if f0 and gender == "female" and f0 < 170:
        s += 0.1 * (170 - f0)
    return round(s, 3)


# --------------------------------------------------------------------------- #
# Designs                                                                     #
# --------------------------------------------------------------------------- #


def design_cell(eng: E.Engine, cell: str, kind: str, force: bool, extra_seeds: int = 0) -> list[dict]:
    lang, gender = cell_parts(cell)
    L, acc = LANG_NAME[lang]
    out = []
    repo, rev = REPO["design"] if kind == "qwen3" else REPO["voxcpm"]
    for di, desc_t in enumerate(DESC[gender]):
        for s in range(1 + extra_seeds):
            did = f"d{di + 1}s{s + 1}"
            meta_path = DESIGNS / cell / f"{did}.json"
            if meta_path.exists() and not force:
                out.append(load_json(meta_path))
                continue
            desc = desc_t.format(L=L, A=acc)
            spec = dict(voiceId=f"design:{cell}:{did}", lang=lang, kind=kind, repo=repo, revision=rev, instruct=desc)
            if kind == "qwen3":
                spec["language"] = E.QWEN_LANG[lang]
            seed = E.stable_seed(cell, did)
            t0 = time.time()
            raw, sr = eng.synthesize(spec, E.normalize_for_voice(T.REFERENCE[lang], lang), lang, seed, eng.take_params(spec, 0))
            gen = time.time() - t0
            fin = A.finish(raw, sr)
            q = QA.evaluate(fin.audio, fin.sr, T.REFERENCE[lang], lang)
            flac = DESIGNS / cell / f"{did}.flac"
            A.write_flac(fin.audio, fin.sr, str(flac))
            meta = dict(
                cell=cell, design=did, model=repo, revision=rev, description=desc, seed=seed,
                ref_text=T.REFERENCE[lang], flac=str(flac), gen_s=round(gen, 2),
                rtf=round(gen / fin.duration_s, 3), qa=q.to_dict(), gender_ok=gender_ok(gender, q.f0_median_hz),
            )
            save_json(meta_path, meta)
            log.info("design %s %s %s cer=%.3f pace=%.2f f0=%s", cell, did, q.verdict, q.cer, q.pace_ratio, q.f0_median_hz)
            out.append(meta)
    return out


def best_designs(cell: str, n: int = 2) -> list[dict]:
    metas = [load_json(p) for p in sorted((DESIGNS / cell).glob("d*.json"))]
    good = [m for m in metas if m["qa"]["verdict"] != "fail" and m["gender_ok"]]
    def key(m):
        sp = m["qa"].get("f0_spread_st") or 0.0
        return (m["qa"]["verdict"] != "pass", m["qa"]["score"] + 3 * max(0.0, 1.6 - sp))

    good.sort(key=key)
    picked, seen = [], set()
    for m in good:  # prefer different descriptions
        d = m["design"][:2]
        if d in seen:
            continue
        picked.append(m)
        seen.add(d)
        if len(picked) == n:
            return picked
    for m in good:
        if m not in picked and len(picked) < n:
            picked.append(m)
    return picked


def lock_spec(cell: str, design: dict, kind: str) -> dict:
    lang, _ = cell_parts(cell)
    if kind == "qwen3":
        repo, rev = REPO["base"]
        vid = f"qwen3-tts-1.7b-base:lock:{cell}-{design['design']}"
        return dict(voiceId=vid, lang=lang, kind="qwen3", repo=repo, revision=rev, language=E.QWEN_LANG[lang],
                    ref_audio=design["flac"], ref_text=design["ref_text"], lock=f"{cell}-{design['design']}")
    repo, rev = REPO["voxcpm"]
    vid = f"voxcpm2:lock:{cell}-{design['design']}"
    return dict(voiceId=vid, lang=lang, kind="voxcpm2", repo=repo, revision=rev, ref_audio=design["flac"],
                ref_text=design["ref_text"], prompt_continuation=True, lock=f"{cell}-{design['design']}")


# --------------------------------------------------------------------------- #
# Phases                                                                      #
# --------------------------------------------------------------------------- #


def phase_qwen_design(args) -> None:
    eng = E.Engine(registry={})
    for cell in args.cells or QWEN_DESIGN_CELLS:
        metas = design_cell(eng, cell, "qwen3", args.force)
        if len(best_designs(cell)) < 2:
            log.info("design %s: fewer than 2 usable designs, trying more seeds", cell)
            design_cell(eng, cell, "qwen3", False, extra_seeds=1)


def phase_qwen_stock(args) -> None:
    eng = E.Engine(registry={})
    repo, rev = REPO["custom"]
    for cell, speakers in STOCK.items():
        if args.cells and cell not in args.cells:
            continue
        lang, _ = cell_parts(cell)
        for spk, style in speakers:
            spec = dict(voiceId=f"qwen3-tts-1.7b-customvoice:{spk}", lang=lang, kind="qwen3", repo=repo, revision=rev,
                        speaker=spk, instruct=style, language=E.QWEN_LANG[lang])
            cid = f"{cell}:{spec['voiceId']}" + ("" if style else "+plain")
            run_candidate(eng, cid, cell, spec, dict(kind="stock", speaker=spk, instruct=style), args.force)
    # Latin QA control: an English voice reading the Latin as English (known-bad Latin).
    ctrl = WORK / "latin_check" / "english_reading"
    if not (ctrl / "done").exists() or args.force:
        spec = dict(voiceId="ctrl:aiden-en", lang="la", kind="qwen3", repo=repo, revision=rev, speaker="Aiden", language="english")
        for name, text in T.test_set("la"):
            raw, sr = eng.synthesize(spec, text, "la", 11, eng.take_params(spec, 0))
            fin = A.finish(raw, sr)
            A.write_flac(fin.audio, fin.sr, str(ctrl / f"{name}.flac"))
        (ctrl / "done").write_text("ok")


def phase_qwen_lock(args) -> None:
    eng = E.Engine(registry={})
    for cell in args.cells or QWEN_DESIGN_CELLS:
        for d in best_designs(cell):
            spec = lock_spec(cell, d, "qwen3")
            run_candidate(eng, f"{cell}:{spec['voiceId']}", cell, spec, dict(kind="design-lock", design=d), args.force)
    # Latin, the challenger route: Italian respelling read by the Italian locks.
    for g in ("female", "male"):
        for d in best_designs(f"it-{g}"):
            spec = lock_spec(f"it-{g}", d, "qwen3")
            spec.update(lang="la", front_end="latin-respell", voiceId=f"qwen3-tts-1.7b-base:latin-respell:it-{g}-{d['design']}")
            run_candidate(eng, f"la-{g}:{spec['voiceId']}", f"la-{g}", spec, dict(kind="latin-respell", design=d), args.force)


def phase_voxcpm(args) -> None:
    eng = E.Engine(registry={})
    for cell in args.cells or VOX_CELLS:
        design_cell(eng, cell, "voxcpm2", args.force)
        if len(best_designs(cell)) < 2:
            design_cell(eng, cell, "voxcpm2", False, extra_seeds=1)
        for d in best_designs(cell):
            spec = lock_spec(cell, d, "voxcpm2")
            run_candidate(eng, f"{cell}:{spec['voiceId']}", cell, spec, dict(kind="design-lock", design=d), args.force)


def kokoro_spec(voice: str, lang: str, front: str, **extra) -> dict:
    repo, rev = REPO["kokoro"]
    vid = f"kokoro-82m:{'latin-ipa' if front == 'latin-ipa' else 'en'}:{voice}"
    s = dict(voiceId=vid, lang=lang, kind="kokoro", repo=repo, revision=rev, kokoro_voice=voice, front_end=front)
    s.update(extra)
    return s


def phase_kokoro(args) -> None:
    eng = E.Engine(registry={})
    for g, voice in (("female", "if_sara"), ("male", "im_nicola")):
        cell = f"la-{g}"
        variants = {
            "": dict(),
            "-speed0.9": dict(params={"speed": 0.9}),
            "-speed0.8": dict(params={"speed": 0.8}),
            "-speed0.85": dict(params={"speed": 0.85}),
            "-nolength": dict(length_marks=False),
        }
        for suffix, extra in variants.items():
            spec = kokoro_spec(voice, "la", "latin-ipa", **extra)
            spec["voiceId"] += suffix
            run_candidate(eng, f"{cell}:{spec['voiceId']}", cell, spec, dict(kind="kokoro-latin", variant=suffix or "default"), args.force)
    spec = kokoro_spec("af_heart", "en", "misaki-en")
    run_candidate(eng, f"en-female:{spec['voiceId']}", "en-female", spec, dict(kind="stock-kokoro"), args.force)
    if not (WORK / "latin_check" / "validation.json").exists() or args.force:
        validate_latin_check(eng)


def validate_latin_check(eng: E.Engine) -> None:
    """Which Latin check separates good Ecclesiastical Latin from known-bad renderings?"""
    out = WORK / "latin_check" / "validation.json"
    spec = kokoro_spec("if_sara", "la", "latin-ipa")
    sets = {}
    good = {}
    bad_classical = {}
    bad_stress = {}
    for name, text in T.test_set("la"):
        ipa = latin.to_ipa(text)
        good[name] = ipa
        bad_classical[name] = (
            ipa.replace("ʧ", "k").replace("ʤ", "ɡ").replace("ʦ", "t").replace("ɲɲ", "ŋn").replace("v", "w").replace("z", "s")
        )
        words = []
        for w in ipa.split(" "):
            core = w.replace("ˈ", "").replace("ː", "")
            vs = [i for i, c in enumerate(core) if c in "aeiouɛɔ"]
            words.append(core[: vs[-1]] + "ˈ" + core[vs[-1]:] if len(vs) > 1 else w)
        bad_stress[name] = " ".join(words)
    for label, table in (("good", good), ("classical", bad_classical), ("final_stress", bad_stress)):
        for name, text in T.test_set("la"):
            raw, sr = eng._kokoro(eng.cache.get(spec["repo"], spec["revision"], "kokoro"), spec, table[name], "la", {"speed": 1.0})
            fin = A.finish(raw, sr)
            sets.setdefault(label, {})[name] = (fin.audio, text)
    ctrl = WORK / "latin_check" / "english_reading"
    if (ctrl / "done").exists():
        for name, text in T.test_set("la"):
            a, sr = A.read_audio(str(ctrl / f"{name}.flac"))
            sets.setdefault("english_reading", {})[name] = (a, text)
    report = {}
    for label, items in sets.items():
        for chk in ("la", "it"):
            cers = []
            for name, (audio_, text) in items.items():
                r = QA.evaluate(audio_, 24000, text, "la", check=chk)
                cers.append(dict(clip=name, cer=round(r.cer, 4), transcript=r.transcript))
            report.setdefault(label, {})[chk] = dict(mean_cer=round(float(np.mean([c["cer"] for c in cers])), 4), clips=cers)
    for chk in ("la", "it"):
        g = report["good"][chk]["mean_cer"]
        bads = [report[k][chk]["mean_cer"] for k in report if k not in ("good", "separation")]
        report.setdefault("separation", {})[chk] = dict(good=g, worst_bad=max(bads), best_bad=min(bads), margin=round(min(bads) - g, 4))
    save_json(out, report)
    log.info("latin check separation: %s", report["separation"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("phase", choices=["qwen-design", "qwen-stock", "qwen-lock", "voxcpm", "kokoro", "pick"])
    ap.add_argument("--cells", nargs="*")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    (WORK / "logs").mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(message)s",
        handlers=[logging.FileHandler(WORK / "logs" / f"{args.phase}.log"), logging.StreamHandler()],
    )
    for noisy in ("httpx", "huggingface_hub", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    if args.phase == "pick":
        import pick

        pick.main(WORK)
        return
    {
        "qwen-design": phase_qwen_design,
        "qwen-stock": phase_qwen_stock,
        "qwen-lock": phase_qwen_lock,
        "voxcpm": phase_voxcpm,
        "kokoro": phase_kokoro,
    }[args.phase](args)


if __name__ == "__main__":
    main()
