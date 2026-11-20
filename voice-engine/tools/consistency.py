"""
Does each chosen voice stay the same voice from prayer to prayer?

Speaker embeddings from Qwen3-TTS Base's own speaker encoder (Apache-2.0): cosine
similarity of every test clip with the voice's locked reference (designed voices), or
with the voice's other clips (stock voices). Writes consistency.json next to the report.

    python tools/consistency.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import mlx.core as mx  # noqa: E402
import numpy as np  # noqa: E402

import audio as A  # noqa: E402
from engine import ModelCache  # noqa: E402

WORK = Path(os.environ.get("VOICE_WORK", HERE.parent / ".cache" / "pray-along-work" / "voice"))
BASE = ("mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16", "a6eb4f68e4b056f1215157bb696209bc82a6db48")


def main() -> None:
    report = json.loads((WORK / "report.json").read_text(encoding="utf-8"))
    registry = json.loads((HERE / "voices" / "registry.json").read_text(encoding="utf-8"))["voices"]
    model = ModelCache(1).get(BASE[0], BASE[1], "qwen3").model

    def emb(x: np.ndarray) -> np.ndarray:
        e = np.asarray(model.extract_speaker_embedding(mx.array(x.astype(np.float32)), 24000)).reshape(-1)
        return e / (np.linalg.norm(e) + 1e-9)

    out = {}
    for cell, entry in report["cells"].items():
        ch = entry.get("chosen")
        if not ch:
            continue
        clip_dir = WORK / "clips" / re.sub(r"[:/]", "_", ch["candidate"])
        clips = sorted(clip_dir.glob("*.flac"))
        es = []
        for f in clips:
            x, sr = A.read_audio(str(f))
            es.append(emb(A.resample(x, sr, 24000)))
        spec = registry.get(ch["voiceId"], {})
        ref = spec.get("ref_audio")
        if ref:
            r, sr = A.read_audio(str(HERE / ref))
            e_ref = emb(A.resample(r, sr, 24000))
            sims = [float(e @ e_ref) for e in es]
            basis = "clip vs locked reference"
        else:
            sims = [float(es[i] @ es[j]) for i in range(len(es)) for j in range(i + 1, len(es))]
            basis = "clip vs clip"
        out[cell] = {"voiceId": ch["voiceId"], "basis": basis, "min": round(min(sims), 3),
                     "mean": round(float(np.mean(sims)), 3), "n": len(sims)}
        print(cell, out[cell])
    # Baseline: the same measure between two DIFFERENT chosen voices (same gender, other
    # languages), so the numbers above can be read against it.
    firsts = {}
    for cell, entry in report["cells"].items():
        ch = entry.get("chosen")
        if ch:
            f = sorted((WORK / "clips" / re.sub(r"[:/]", "_", ch["candidate"])).glob("*.flac"))[0]
            x, sr = A.read_audio(str(f))
            firsts[cell] = emb(A.resample(x, sr, 24000))
    cross = {}
    for g in ("female", "male"):
        cells = [c for c in firsts if c.endswith("-" + g)]
        sims = [float(firsts[a] @ firsts[b]) for i, a in enumerate(cells) for b in cells[i + 1:]]
        cross[g] = {"min": round(min(sims), 3), "mean": round(float(np.mean(sims)), 3), "max": round(max(sims), 3)}
    out["_different_voices_baseline"] = cross
    print("different voices:", cross)
    (WORK / "consistency.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
