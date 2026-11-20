"""
Bake-off, last step: choose a voice per language x gender from the measured results,
install the winners (voices/<slug>/ + voices/registry.json + the website's voices.json),
write listening samples and the report.

    python tools/bakeoff.py pick
"""

from __future__ import annotations

import json
import math
import re
import shutil
from pathlib import Path

import numpy as np

import audio as A

HERE = Path(__file__).resolve().parent.parent
VOICES_DIR = HERE / "voices"
REGISTRY = VOICES_DIR / "registry.json"
SITE_VOICES = HERE.parent / "src" / "lib" / "pray-along" / "voices.json"

LANGS = ["en", "es", "fr", "it", "de", "pt", "pl", "la", "tl", "vi", "ko", "zh", "el"]
GENDERS = ["female", "male"]

LICENCE = {
    "qwen3": "Qwen3-TTS 12Hz 1.7B (Alibaba Qwen team), Apache-2.0; MLX conversion by mlx-community, Apache-2.0",
    "voxcpm2": "VoxCPM2 (OpenBMB), Apache-2.0; MLX conversion by mlx-community, Apache-2.0",
    "kokoro": "Kokoro-82M (hexgrad), Apache-2.0, with its Apache-2.0 voice packs; MLX conversion by mlx-community",
}

# Measured reasons a candidate may not ship whatever its scores.
DISQUALIFY = {
    "kokoro-82m:en:af_heart": (
        "not robust for the site's English: without eSpeak (GPL) Kokoro's English front end (misaki) "
        "drops out-of-vocabulary words silently, and 25.9% of the site's English prayer clips "
        "(1,249 of 4,831 measured on the local database) contain one (St., knowest, reignest, "
        "Latin words, saints' names)"
    ),
}


def slug_of(cand: dict) -> str:
    return re.sub(r"[^a-z0-9]+", "-", cand["candidate"].lower()).strip("-")


def kind_of(cand: dict) -> str:
    m = cand["meta"].get("kind", "")
    return {"stock": "stock speaker", "design-lock": "designed + locked", "kokoro-latin": "Latin IPA front end",
            "latin-respell": "Latin respelled as Italian", "stock-kokoro": "stock voice"}.get(m, m)


def choose(cell: str, cands: list[dict]) -> tuple[dict | None, list[str]]:
    notes: list[str] = []
    ok = [c for c in cands if c["spec"]["voiceId"] not in DISQUALIFY]
    for c in cands:
        if c["spec"]["voiceId"] in DISQUALIFY:
            notes.append(f"{c['spec']['voiceId']} excluded: {DISQUALIFY[c['spec']['voiceId']]}")
    if not ok:
        return None, notes
    ok.sort(key=lambda c: c["aggregate"]["rank_score"])
    best = ok[0]
    if cell.startswith("la-") and best["meta"].get("kind") == "latin-respell":
        ipa = [c for c in ok if c["meta"].get("kind") == "kokoro-latin"]
        if ipa:
            k = ipa[0]
            if k["aggregate"]["fails"] == 0 and k["aggregate"]["cer"] <= best["aggregate"]["cer"] + 0.03:
                notes.append(
                    "Latin: the Kokoro IPA route is kept although the respelling route scored a little better, "
                    "because only the IPA route lets us place every stress (Whisper cannot hear stress)"
                )
                best = k
    return best, notes


def concat_clips(clip_dir: Path, names: list[str], gap_s: float = 0.9) -> np.ndarray | None:
    parts = []
    gap = np.zeros(int(gap_s * A.TARGET_SR), np.float32)
    for n in names:
        f = clip_dir / f"{n}.flac"
        if not f.exists():
            continue
        x, sr = A.read_audio(str(f))
        parts += [A.resample(x, sr, A.TARGET_SR), gap]
    if not parts:
        return None
    return np.concatenate(parts[:-1])


def install(cell: str, cand: dict, version: int = 1, slug: str | None = None) -> tuple[str, dict]:
    """Copies the winner's reference into voices/<slug>/ and returns (voiceId, registry spec)."""
    lang, gender = cell.split("-")
    s = dict(cand["spec"])
    agg = cand["aggregate"]
    spec = {k: v for k, v in s.items() if k not in ("voiceId",)}
    spec["lang"] = lang
    spec["gender"] = gender
    spec["pace_ref"] = round(agg["pace_ratio"], 3)
    kind = cand["meta"].get("kind")
    if kind in ("design-lock", "latin-respell"):
        d = cand["meta"]["design"]
        slug = slug or f"{cell}-v{version}"
        folder = VOICES_DIR / slug
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(d["flac"], folder / "ref.flac")
        (folder / "ref.txt").write_text(d["ref_text"] + "\n", encoding="utf-8")
        design = {k: d[k] for k in ("model", "revision", "description", "seed", "ref_text", "design")}
        design["design_qa"] = {k: d["qa"][k] for k in ("cer", "transcript", "pace_ratio", "f0_median_hz", "f0_spread_st")}
        design["source_cell"] = d["cell"]
        design["bakeoff_candidate"] = cand["candidate"]
        (folder / "design.json").write_text(json.dumps(design, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        spec["ref_audio"] = f"voices/{slug}/ref.flac"
        spec["ref_text_file"] = f"voices/{slug}/ref.txt"
        spec.pop("ref_text", None)
        spec["lock"] = slug
        if kind == "latin-respell":
            vid = f"qwen3-tts-1.7b-base:latin-respell:{slug}"
        elif s["kind"] == "qwen3":
            vid = f"qwen3-tts-1.7b-base:lock:{slug}"
        else:
            vid = f"voxcpm2:lock:{slug}"
    elif s["kind"] == "kokoro":
        vid = f"kokoro-82m:latin-ipa:{s['kokoro_voice']}" if s.get("front_end") == "latin-ipa" else f"kokoro-82m:{s['kokoro_voice']}"
    else:
        vid = s["voiceId"]
    spec["voiceId"] = vid
    spec["licence"] = LICENCE[s["kind"]]
    return vid, spec


def rescore(result: dict) -> dict:
    """Recomputes every take's CER from its stored transcript with the current fair fold
    (qa.py may have learnt a fairer fold since the take was made), then the aggregate."""
    import qa
    from bakeoff import aggregate

    lang = result["cell"].split("-")[0]
    for c in result["clips"]:
        for t in c["takes"] + [c["best"]]:
            fl = lang
            if lang == "la":
                fl = "la" if t["reference"] == c["text"] else "it"
            new = qa.cer(qa.fold(t["reference"], fl), qa.fold(t["transcript"], fl))
            t.setdefault("cer_recorded", t["cer"])
            t["cer"] = round(new, 4)
            err = new
            ok, marg = qa.PASS_CER.get(lang, qa.DEFAULT_PASS), qa.MARGINAL_CER.get(lang, qa.DEFAULT_MARGINAL)
            if lang in qa.SYLLABLE_LANGS:
                t["ser"] = err = round(qa.ser(t["reference"], t["transcript"], lang), 4)
                ok, marg = qa.PASS_SER[lang], qa.MARGINAL_SER[lang]
            only_err = all(r.startswith(("cer", "ser")) for r in t["reasons"])
            if only_err:
                t["verdict"] = "pass" if err <= ok else ("marginal" if err <= marg else "fail")
                t["reasons"] = [] if err <= ok else [f"{'ser' if lang in qa.SYLLABLE_LANGS else 'cer'} {err:.3f}"]
    result["aggregate"] = aggregate(result["clips"], result["cell"].split("-")[1])
    return result


def main(work: Path) -> None:
    results = [rescore(json.loads(p.read_text(encoding="utf-8"))) for p in sorted((work / "results").glob("*.json"))]
    by_cell: dict[str, list[dict]] = {}
    for r in results:
        by_cell.setdefault(r["cell"], []).append(r)

    registry = json.loads(REGISTRY.read_text(encoding="utf-8")) if REGISTRY.exists() else {"voices": {}}
    registry.setdefault("voices", {})
    site = json.loads(SITE_VOICES.read_text(encoding="utf-8"))
    report: dict = {"cells": {}, "latin_check": None, "speed": {}}
    samples = work / "samples"
    (samples / "candidates").mkdir(parents=True, exist_ok=True)

    for lang in LANGS:
        for gender in GENDERS:
            cell = f"{lang}-{gender}"
            cands = by_cell.get(cell, [])
            best, notes = choose(cell, cands)
            entry: dict = {"candidates": [], "notes": notes}
            for c in sorted(cands, key=lambda c: c["aggregate"]["rank_score"]):
                names = [r["clip"] for r in c["clips"]]
                audio = concat_clips(work / "clips" / Path(
                    re.sub(r"[:/]", "_", c["candidate"])), names)
                sample_path = samples / "candidates" / cell / f"{slug_of(c)}.m4a"
                if audio is not None:
                    A.encode_m4a(audio, A.TARGET_SR, str(sample_path))
                entry["candidates"].append(
                    {
                        "candidate": c["candidate"],
                        "voiceId_tested": c["spec"]["voiceId"],
                        "kind": kind_of(c),
                        "model": c["spec"]["repo"],
                        "description": (c["meta"].get("design") or {}).get("description") or c["spec"].get("instruct"),
                        "aggregate": c["aggregate"],
                        "sample": str(sample_path),
                        "clips": [
                            {
                                "clip": r["clip"],
                                "verdict": r["best"]["verdict"],
                                "cer": r["best"]["cer"],
                                "cer_strict": r["best"]["cer_strict"],
                                "pace_ratio": r["best"]["pace_ratio"],
                                "syl_per_s": r["best"]["syl_per_s"],
                                "takes_used": r["takes_used"],
                                "transcript": r["best"]["transcript"],
                                "diff": r["best"]["diff"],
                                "reasons": r["best"]["reasons"],
                            }
                            for r in c["clips"]
                        ],
                    }
                )
            if best is not None:
                vid, spec = install(cell, best)
                registry["voices"][vid] = spec
                site["voices"].setdefault(lang, {})[gender] = vid
                entry["chosen"] = {"voiceId": vid, "candidate": best["candidate"], "aggregate": best["aggregate"]}
                names = [r["clip"] for r in best["clips"]]
                audio = concat_clips(work / "clips" / Path(re.sub(r"[:/]", "_", best["candidate"])), names)
                if audio is not None:
                    A.encode_m4a(audio, A.TARGET_SR, str(samples / f"{cell}.m4a"))
                    entry["chosen"]["sample"] = str(samples / f"{cell}.m4a")
            # Latin: keep the best voice of the other route installed as an alternate, so
            # the owner can switch routes by editing voices.json alone.
            if lang == "la" and best is not None:
                other = [c for c in sorted(cands, key=lambda c: c["aggregate"]["rank_score"])
                         if c["meta"].get("kind") != best["meta"].get("kind") and c["spec"]["voiceId"] not in DISQUALIFY]
                if other:
                    alt = other[0]
                    avid, aspec = install(cell, alt, slug=f"{cell}-respell-v1" if alt["meta"].get("kind") == "latin-respell" else None)
                    aspec["alternate"] = True
                    registry["voices"][avid] = aspec
                    entry["alternate"] = {"voiceId": avid, "candidate": alt["candidate"], "aggregate": alt["aggregate"]}
            report["cells"][cell] = entry

    # Only voices still named by the site stay in the registry.
    used = {v for g in site["voices"].values() for v in g.values()}
    registry["voices"] = {k: v for k, v in registry["voices"].items() if k in used or v.get("alternate")}
    registry["$comment"] = (
        "voiceId -> model, revision and settings the engine speaks it with. Written by tools/bakeoff.py pick; "
        "see README.md. Paths are relative to voice-engine/."
    )
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_site_voices(site)

    lc = work / "latin_check" / "validation.json"
    if lc.exists():
        report["latin_check"] = json.loads(lc.read_text(encoding="utf-8"))
    report["speed"] = speed_table(results)
    cj = work / "consistency.json"
    if cj.exists():
        report["consistency"] = json.loads(cj.read_text(encoding="utf-8"))
    report["english_estimate"] = english_estimate(report, results)
    (work / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1, default=float) + "\n", encoding="utf-8")
    notes = (work / "report_notes.md").read_text(encoding="utf-8") if (work / "report_notes.md").exists() else ""
    write_markdown(report, work / "report.md", notes)
    print(json.dumps({c: (e.get("chosen") or {}).get("voiceId") for c, e in report["cells"].items()}, indent=0))


def write_site_voices(site: dict) -> None:
    """voices.json in the website's own layout: one line per language."""
    lines = ["{", f'  "$comment": {json.dumps(site["$comment"], ensure_ascii=False)},',
             f'  "formatVersion": {site["formatVersion"]},', '  "voices": {']
    langs = [l for l in LANGS if l in site["voices"]]
    for i, lang in enumerate(langs):
        v = site["voices"][lang]
        comma = "," if i < len(langs) - 1 else ""
        lines.append(f'    "{lang}": {{ "female": {json.dumps(v["female"])}, "male": {json.dumps(v["male"])} }}{comma}')
    lines += ["  }", "}"]
    SITE_VOICES.write_text("\n".join(lines) + "\n", encoding="utf-8")


def english_estimate(report: dict, results: list[dict], chars: int = 1_100_000) -> list[dict]:
    """Time to pre-make ~1.1 M characters of English per voice, from the chosen voices' runs."""
    out = []
    for g in GENDERS:
        ch = (report["cells"].get(f"en-{g}") or {}).get("chosen")
        if not ch:
            continue
        r = next(x for x in results if x["candidate"] == ch["candidate"])
        n = sum(c["chars"] for c in r["clips"])
        audio = sum(c["best"]["duration_s"] for c in r["clips"])
        takes = [t for c in r["clips"] for t in c["takes"]]
        t_audio = sum(t["duration_s"] for t in takes)
        rtf = sum(t["gen_s"] for t in takes) / t_audio
        qa_rtf = sum(t.get("qa_s", 0.0) for t in takes) / t_audio
        speed = report["speed"].get(f"{r['spec']['kind']}:{r['spec']['repo']}", {})
        qa_rtf = qa_rtf or speed.get("qa_rtf", 0.06)
        tpc = speed.get("takes_per_clip", len(takes) / len(r["clips"]))
        cps = n / audio
        audio_s = chars / cps
        out.append({"voiceId": ch["voiceId"], "chars_per_audio_s": round(cps, 2), "audio_h": round(audio_s / 3600, 1),
                    "rtf": round(rtf, 3), "qa_rtf": round(qa_rtf, 3), "takes": round(tpc, 2),
                    "machine_h": round(audio_s * (rtf + qa_rtf) * tpc / 3600, 1)})
    return out


def speed_table(results: list[dict]) -> dict:
    """Real-time factor per model family over every take of the bake-off."""
    rows: dict[str, dict] = {}
    for r in results:
        key = f"{r['spec']['kind']}:{r['spec']['repo']}"
        e = rows.setdefault(key, {"gen_s": 0.0, "qa_s": 0.0, "audio_s": 0.0, "chars": 0, "clips": 0, "takes": 0})
        for c in r["clips"]:
            e["clips"] += 1
            e["chars"] += c["chars"]
            for t in c["takes"]:
                e["takes"] += 1
                e["gen_s"] += t["gen_s"]
                e["qa_s"] += t.get("qa_s", 0.0)
                e["audio_s"] += t["duration_s"]
    for e in rows.values():
        e["rtf"] = round(e["gen_s"] / max(e["audio_s"], 1e-6), 3)
        e["qa_rtf"] = round(e["qa_s"] / max(e["audio_s"], 1e-6), 3)
        e["takes_per_clip"] = round(e["takes"] / max(e["clips"], 1), 2)
    return rows


def fmt(v, nd=3):
    return "–" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) else str(v))


def write_markdown(report: dict, path: Path, notes_md: str = "") -> None:
    """report.md: the chosen voices, every candidate's numbers, the Latin check, speed."""
    L = ["# Pray-along voices: bake-off report", ""]
    L += ["Every candidate spoke the same test set (Sign of the Cross, Our Father, Hail Mary; Latin: Signum Crucis, "
          "Pater Noster, Ave Maria, Gloria Patri), cut into clips as the website cuts them, up to 4 takes per clip. "
          "CER = character error rate of Whisper large-v3-turbo's transcript against the text on the fair fold "
          "(qa.py), weighted by clip length; worst = the worst clip. Pace = syllables per second against the "
          "language's normal read-speech rate x 0.70 (1.00 = a natural prayer pace).", ""]
    if notes_md:
        L += [notes_md, ""]
    L += ["## Chosen voices", "",
          "| Cell | voiceId | CER | worst | pace | syl/s | F0 Hz | 1st-take pass | clips pass/marg/fail |",
          "|---|---|---|---|---|---|---|---|---|"]
    for cell, e in report["cells"].items():
        ch = e.get("chosen")
        if not ch:
            L.append(f"| {cell} | **none** | | | | | | | |")
            continue
        a = ch["aggregate"]
        L.append(f"| {cell} | `{ch['voiceId']}` | {a['cer']:.3f} | {a['cer_max']:.3f} | {a['pace_ratio']:.2f} | "
                 f"{a['syl_per_s']:.2f} | {fmt(a['f0_median_hz'], 0)} | {a['first_take_pass']:.2f} | "
                 f"{a['passes']}/{a['marginal']}/{a['fails']} |")
    L += ["", "## Every candidate", ""]
    for cell, e in report["cells"].items():
        L += [f"### {cell}", ""]
        for n in e.get("notes", []):
            L.append(f"- {n}")
        L += ["", "| Candidate | kind | rank | CER | worst | pace | F0 | spread st | takes | p/m/f |", "|---|---|---|---|---|---|---|---|---|---|"]
        chosen = (e.get("chosen") or {}).get("candidate")
        if chosen and len(e["candidates"]) > 1:
            ranked = [c for c in e["candidates"] if c["voiceId_tested"] not in DISQUALIFY]
            win = next(c for c in e["candidates"] if c["candidate"] == chosen)
            run = next((c for c in ranked if c["candidate"] != chosen), None)
            if run:
                wa, ra = win["aggregate"], run["aggregate"]
                m = "ser" if wa.get("ser") is not None else "cer"
                L.append(f"- Why: rank {wa['rank_score']:.2f} vs {ra['rank_score']:.2f} for `{run['voiceId_tested']}` "
                         f"({m} {wa[m]:.3f} vs {ra[m]:.3f}, worst clip {wa[m + '_max']:.3f} vs {ra[m + '_max']:.3f}, "
                         f"pace {wa['pace_ratio']:.2f} vs {ra['pace_ratio']:.2f}, F0 {fmt(wa['f0_median_hz'], 0)} vs "
                         f"{fmt(ra['f0_median_hz'], 0)} Hz). Rank: tools/bakeoff.py rank_score (1% error = 3 points; "
                         "pace, re-takes, flat pitch and an untypical pitch for the gender add).")
        for c in e["candidates"]:
            a = c["aggregate"]
            mark = " **(chosen)**" if c["candidate"] == chosen else ""
            L.append(f"| `{c['voiceId_tested']}`{mark} | {c['kind']} | {a['rank_score']:.1f} | {a['cer']:.3f} | "
                     f"{a['cer_max']:.3f} | {a['pace_ratio']:.2f} | {fmt(a['f0_median_hz'], 0)} | "
                     f"{fmt(a['f0_spread_st'], 2)} | {a['takes_mean']:.2f} | {a['passes']}/{a['marginal']}/{a['fails']} |")
        for c in e["candidates"]:
            if c["candidate"] != chosen:
                continue
            errs = [k for k in c["clips"] if k["cer"] > 0]
            if errs:
                L += ["", "Chosen voice, clips Whisper did not hear word-perfectly:"]
                for k in errs:
                    L.append(f"- {k['clip']}: CER {k['cer']:.3f}, heard \"{k['transcript']}\"; diff {k['diff']}")
        L.append("")
    lc = report.get("latin_check")
    if lc:
        L += ["## Latin check validation", "",
              "Mean CER of Kokoro if_sara Latin (good) and of known-bad renderings under each check:", "",
              "| Rendering | Whisper Latin vs Latin | Whisper Italian vs respelling |", "|---|---|---|"]
        for k, v in lc.items():
            if k == "separation":
                continue
            L.append(f"| {k} | {v['la']['mean_cer']:.3f} | {v['it']['mean_cer']:.3f} |")
        L += ["", f"Separation: {json.dumps(lc.get('separation'))}", ""]
    sp = report.get("speed")
    if sp:
        L += ["## Speed on this Mac (Apple M5 Pro, 24 GB)", "",
              "| Model | real-time factor (generation) | QA (Whisper) RTF | takes per clip | clips |", "|---|---|---|---|---|"]
        for k, v in sp.items():
            L.append(f"| {k} | {v['rtf']:.3f} | {v['qa_rtf']:.3f} | {v['takes_per_clip']:.2f} | {v['clips']} |")
        L.append("")
    cons = report.get("consistency")
    if cons:
        L += ["## Speaker consistency", "",
              "Cosine similarity of Qwen3 Base speaker embeddings: each test clip against the locked reference "
              "(stock voices: clip against clip).", "",
              "| Cell | basis | min | mean |", "|---|---|---|---|"]
        for cell, v in cons.items():
            if cell.startswith("_"):
                continue
            L.append(f"| {cell} | {v['basis']} | {v['min']:.3f} | {v['mean']:.3f} |")
        b = cons.get("_different_voices_baseline")
        if b:
            L += ["", f"Baseline between two different chosen voices of the same gender: {json.dumps(b)}", ""]
    est = report.get("english_estimate")
    if est:
        L += ["## Pre-making all English prayers (about 1.1 million characters per voice)", ""]
        for v in est:
            L.append(f"- {v['voiceId']}: {v['chars_per_audio_s']:.1f} characters per second of speech -> "
                     f"{v['audio_h']:.1f} h of audio; generation RTF {v['rtf']:.3f} + QA {v['qa_rtf']:.3f}, "
                     f"{v['takes']:.2f} takes per clip -> about {v['machine_h']:.1f} h on this Mac")
        L.append("")
    path.write_text("\n".join(L) + "\n", encoding="utf-8")
