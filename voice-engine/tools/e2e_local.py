"""
End-to-end proof against a LOCAL database only: files the Sign of the Cross and the
Hail Mary in every language for both voices as pending rows (half as listener
demand, half as background work), lets worker.py make them, then checks every stored
clip: status, bytes, ffprobe (AAC-LC, mono), macOS's own decoder (afinfo) and a
full decode to non-silent audio.

    DATABASE_URL=postgresql://viafidei:viafidei@localhost:5432/viafidei python tools/e2e_local.py insert
    DATABASE_URL=... python worker.py --once        # repeat, or --exit-when-idle
    DATABASE_URL=... python tools/e2e_local.py verify

Refuses any database that is not on localhost.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "tools"))

import numpy as np  # noqa: E402

import audio as A  # noqa: E402
import texts as T  # noqa: E402
from worker import DB  # noqa: E402

SITE_VOICES = HERE.parent / "src" / "lib" / "pray-along" / "voices.json"
TAG = "e2e-voice-engine-2026-11"


def local_db() -> DB:
    url = os.environ.get("DATABASE_URL", "")
    host = urlparse(url).hostname
    if host not in ("localhost", "127.0.0.1", "::1"):
        sys.exit(f"refusing: DATABASE_URL host is {host!r}, not localhost")
    return DB(url)


def rows_to_file() -> list[dict]:
    voices = json.loads(SITE_VOICES.read_text(encoding="utf-8"))["voices"]
    rows = []
    i = 0
    for lang in ["en", "es", "fr", "it", "de", "pt", "pl", "la", "tl", "vi", "ko", "zh", "el"]:
        for voice in ("female", "male"):
            for name, text in (("sign", T.SIGN[lang]), ("hail_mary", T.HAIL_MARY[lang])):
                key = hashlib.sha256(f"{TAG}|{lang}|{voice}|{name}".encode()).hexdigest()[:40]
                rows.append(dict(key=key, lang=lang, voice=voice, voiceId=voices[lang][voice], text=text,
                                 priority=0 if name == "sign" else 1, demand=(i % 2 == 0), name=name))
                i += 1
    return rows


def insert(db: DB) -> None:
    for r in rows_to_file():
        db.run(
            """
            INSERT INTO "PrayerAudioClip" (id, key, lang, voice, "voiceId", text, status, priority, "requestedAt", "createdAt", "updatedAt")
            VALUES (:id, :key, :lang, :voice, :vid, :text, 'pending', :prio,
                    CASE WHEN :demand THEN LOCALTIMESTAMP ELSE NULL END, LOCALTIMESTAMP, LOCALTIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET
              status = 'pending', audio = NULL, mime = NULL, "durationMs" = NULL, "byteLength" = NULL,
              engine = NULL, "qaScore" = NULL, attempts = 0, "lastError" = NULL, "claimedAt" = NULL,
              "claimedBy" = NULL, "voiceId" = EXCLUDED."voiceId", text = EXCLUDED.text,
              "requestedAt" = EXCLUDED."requestedAt", "updatedAt" = LOCALTIMESTAMP
            """,
            id=f"pac_{r['key']}", key=r["key"], lang=r["lang"], voice=r["voice"], vid=r["voiceId"], text=r["text"],
            prio=r["priority"], demand=r["demand"],
        )
    print(f"filed {len(rows_to_file())} pending rows")


def afinfo_ok(data: bytes) -> bool:
    with tempfile.NamedTemporaryFile(suffix=".m4a") as f:
        f.write(data)
        f.flush()
        p = subprocess.run(["/usr/bin/afinfo", f.name], capture_output=True, text=True)
        return p.returncode == 0 and "aac" in p.stdout.lower()


def verify(db: DB) -> int:
    keys = [r["key"] for r in rows_to_file()]
    rows = db.run(
        """SELECT key, lang, voice, status, mime, "durationMs", "byteLength", engine, "qaScore", attempts,
                  "lastError", audio FROM "PrayerAudioClip" WHERE key = ANY(:keys) ORDER BY lang, voice, priority""",
        keys=keys,
    )
    bad = 0
    out = []
    for key, lang, voice, status, mime, dur, blen, engine, qa, attempts, err, audio in rows:
        info = {"key": key[:10], "lang": lang, "voice": voice, "status": status, "qaScore": qa, "attempts": attempts,
                "lastError": err, "engine": engine}
        if status == "done" and audio:
            data = bytes(audio)
            pr = A.probe(data)
            pcm = A.decode(data)
            rms = float(np.sqrt(np.mean(pcm**2))) if len(pcm) else 0.0
            ok = (
                mime == "audio/mp4" and blen == len(data) and pr["codec"] == "aac" and pr["profile"] == "LC"
                and pr["channels"] == 1 and abs(pr["duration_s"] * 1000 - dur) < 120 and rms > 0.01
                and afinfo_ok(data)
            )
            info.update(durationMs=dur, bytes=blen, codec=f"{pr['codec']}/{pr['profile']}", sr=pr["sample_rate"],
                        kbps=round(pr["bit_rate"] / 1000, 1), rms=round(rms, 3), afinfo=ok, decodes=ok)
            bad += 0 if ok else 1
        else:
            bad += 1
        out.append(info)
    for o in out:
        print(json.dumps(o, ensure_ascii=False))
    done = sum(1 for o in out if o["status"] == "done")
    print(f"\n{done}/{len(keys)} done; {bad} with a problem")
    return 0 if bad == 0 and done == len(keys) else 1


if __name__ == "__main__":
    db = local_db()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "verify"
    if cmd == "insert":
        insert(db)
    else:
        sys.exit(verify(db))
