"""
The pray-along voice worker: makes the clips the website files in "PrayerAudioClip".

    .venv/bin/python worker.py                 # run until stopped (SIGTERM finishes the clip in hand)
    .venv/bin/python worker.py --once          # make at most one clip, then exit
    .venv/bin/python worker.py --demand-only   # only clips a listener is waiting for
    .venv/bin/python worker.py --limit 50      # stop after 50 clips
    .venv/bin/python worker.py --lang la el    # only these languages
    .venv/bin/python worker.py --lang en --voice female   # bulk pre-making, one model loaded
    .venv/bin/python worker.py --status        # counts, then exit
    .venv/bin/python worker.py --replan-daily  # also run the site's planner once a day when idle

Reads DATABASE_URL (postgresql://user:pass@host:port/db[?sslmode=require]).

Order of work: clips a listener asked for first (requestedAt set: newest request
first, then the lowest priority = earliest in the prayer), then background rows by
priority. One row at a time is claimed with SELECT ... FOR UPDATE SKIP LOCKED, skipping
rows another worker claimed in the last 10 minutes; a claim sets claimedAt/claimedBy
and counts an attempt. Each clip is spoken in up to 4 takes, each checked by qa.py;
the best take is stored as AAC (.m4a). A pass is 'done'; a marginal best take is
'done' with lastError 'qa:marginal:<cer>:...'; a clearly broken one is 'failed'. A
listener asking again for a clip that failed on quality files it as pending once more
(the website's store.ts, while attempts < MAX_ATTEMPTS), with its last claim cleared so
the retry can start at once, except for Kokoro (Latin). The retry uses new seeds
(seed_key_for): new takes from Qwen3-TTS and VoxCPM2; Kokoro does not sample, so its
retry is nearly the same four takes, and its claim keeps the 10-minute pace.
"""

from __future__ import annotations

import argparse
import logging
import os
import signal
import socket
import ssl
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ.setdefault("HF_HUB_OFFLINE", os.environ.get("VOICE_ENGINE_OFFLINE", "1"))

log = logging.getLogger("voice_engine.worker")

CLAIM_STALE_MIN = 10
MAX_ATTEMPTS = 5
IDLE_POLL_S = 4.0
TABLE = '"PrayerAudioClip"'
REPLAN_EVERY_S = 24 * 3600
PROJECT_DIR = Path(__file__).resolve().parent.parent


# --------------------------------------------------------------------------- #
# Database                                                                    #
# --------------------------------------------------------------------------- #


class DB:
    """A pg8000 connection that reconnects (with backoff) when the database drops."""

    def __init__(self, url: str):
        self.url = url
        self.conn = None

    def _connect(self):
        import pg8000.native

        u = urlparse(self.url)
        q = parse_qs(u.query)
        ctx: Any = None
        mode = (q.get("sslmode") or [""])[0]
        if mode in ("require", "verify-ca", "verify-full"):
            ctx = ssl.create_default_context()
            if mode == "require":
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
        conn = pg8000.native.Connection(
            user=unquote(u.username or ""),
            password=unquote(u.password or "") or None,
            host=u.hostname or "localhost",
            port=u.port or 5432,
            database=(u.path or "/").lstrip("/") or None,
            ssl_context=ctx,
            timeout=60,
            application_name="via-fidei-voice-engine",
        )
        conn.run("SET TIME ZONE 'UTC'")
        return conn

    def run(self, sql: str, **params):
        delay = 1.0
        while True:
            try:
                if self.conn is None:
                    self.conn = self._connect()
                return self.conn.run(sql, **params)
            except Exception as e:  # connection trouble: reconnect and retry
                if not _is_connection_error(e):
                    raise
                log.warning("database: %s; reconnecting in %.0fs", str(e)[:200], delay)
                self.close()
                if STOP.hard:
                    raise
                time.sleep(delay)
                delay = min(delay * 2, 60.0)

    def close(self) -> None:
        try:
            if self.conn is not None:
                self.conn.close()
        except Exception:
            pass
        self.conn = None


def _is_connection_error(e: Exception) -> bool:
    import pg8000.exceptions as pe

    if isinstance(e, (pe.InterfaceError, OSError, ConnectionError, socket.timeout)):
        return True
    msg = str(e).lower()
    return any(s in msg for s in ("connection", "network", "broken pipe", "server closed", "57p01", "08006", "08003"))


# --------------------------------------------------------------------------- #
# Stopping                                                                    #
# --------------------------------------------------------------------------- #


class Stop:
    soft = False  # finish the clip in hand, then exit
    hard = False  # abandon it (release the claim) and exit


STOP = Stop()


def _on_signal(signum, _frame) -> None:
    if STOP.soft:
        STOP.hard = True
        raise KeyboardInterrupt
    STOP.soft = True
    log.info("signal %s: finishing the clip in hand, then stopping (again to stop now)", signum)


# --------------------------------------------------------------------------- #
# Claim, write, release                                                       #
# --------------------------------------------------------------------------- #


def claim(db: DB, me: str, demand_only: bool, langs: Optional[list[str]], voices: list[str],
          gender: Optional[str] = None) -> Optional[dict]:
    """Claims the next row this engine can speak. Rows for a voiceId it does not have (a
    voice retired from voices.json, or one newer than this engine) are left pending."""
    where = [
        "status = 'pending'",
        f"(\"claimedAt\" IS NULL OR \"claimedAt\" < LOCALTIMESTAMP - interval '{CLAIM_STALE_MIN} minutes')",
        '"voiceId" = ANY(:voices)',
    ]
    if demand_only:
        where.append('"requestedAt" IS NOT NULL')
    params: dict[str, Any] = {"me": me, "voices": voices}
    if langs:
        where.append("lang = ANY(:langs)")
        params["langs"] = langs
    if gender:
        where.append("voice = :gender")
        params["gender"] = gender
    rows = db.run(
        f"""
        WITH c AS (
          SELECT id FROM {TABLE}
          WHERE {' AND '.join(where)}
          ORDER BY ("requestedAt" IS NULL), "requestedAt" DESC, priority ASC, "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE {TABLE} p
           SET "claimedAt" = LOCALTIMESTAMP, "claimedBy" = :me,
               attempts = p.attempts + 1, "updatedAt" = LOCALTIMESTAMP
          FROM c WHERE p.id = c.id
        RETURNING p.id, p.key, p.lang, p.voice, p."voiceId", p.text, p.attempts, p."requestedAt"
        """,
        **params,
    )
    if not rows:
        return None
    r = rows[0]
    return dict(id=r[0], key=r[1], lang=r[2], voice=r[3], voiceId=r[4], text=r[5], attempts=r[6], requestedAt=r[7])


def write_done(db: DB, me: str, row: dict, *, audio: bytes, duration_ms: int, engine: str, qa_score: float,
               last_error: Optional[str]) -> bool:
    rows = db.run(
        f"""
        UPDATE {TABLE}
           SET audio = :audio, mime = 'audio/mp4', "durationMs" = :dur, "byteLength" = :len,
               engine = :engine, "qaScore" = :qa, status = 'done', "lastError" = :err,
               "updatedAt" = LOCALTIMESTAMP
         WHERE id = :id AND "claimedBy" = :me AND status = 'pending'
        RETURNING id
        """,
        audio=audio, dur=duration_ms, len=len(audio), engine=engine, qa=qa_score, err=last_error, id=row["id"], me=me,
    )
    return bool(rows)


def write_failed(db: DB, me: str, row: dict, error: str, *, engine: Optional[str] = None,
                 qa_score: Optional[float] = None) -> None:
    db.run(
        f"""
        UPDATE {TABLE}
           SET status = 'failed', "lastError" = :err, engine = COALESCE(:engine, engine),
               "qaScore" = COALESCE(:qa, "qaScore"), "updatedAt" = LOCALTIMESTAMP
         WHERE id = :id AND "claimedBy" = :me AND status = 'pending'
        """,
        err=error[:1000], engine=engine, qa=qa_score, id=row["id"], me=me,
    )


def release(db: DB, me: str, row: dict, error: Optional[str] = None) -> None:
    """Gives a claimed row back (an interrupted or crashed attempt does not count)."""
    db.run(
        f"""
        UPDATE {TABLE}
           SET "claimedAt" = NULL, "claimedBy" = NULL, attempts = GREATEST(attempts - 1, 0),
               "lastError" = COALESCE(:err, "lastError"), "updatedAt" = LOCALTIMESTAMP
         WHERE id = :id AND "claimedBy" = :me AND status = 'pending'
        """,
        err=error, id=row["id"], me=me,
    )


def note_error(db: DB, me: str, row: dict, error: str) -> None:
    """Keeps the claim's attempt but records why (retried after the claim goes stale)."""
    db.run(
        f"""UPDATE {TABLE} SET "lastError" = :err, "updatedAt" = LOCALTIMESTAMP
             WHERE id = :id AND "claimedBy" = :me AND status = 'pending'""",
        err=error[:1000], id=row["id"], me=me,
    )


# --------------------------------------------------------------------------- #
# Status                                                                      #
# --------------------------------------------------------------------------- #


def status(db: DB, voices: Optional[list[str]] = None) -> None:
    rows = db.run(f'SELECT status, count(*), count("requestedAt") FROM {TABLE} GROUP BY status ORDER BY status')
    print("status     clips   requested")
    for s, n, req in rows:
        print(f"{s:9s} {n:6d}   {req:6d}")
    rows = db.run(
        f"""SELECT lang, voice, count(*) FILTER (WHERE status='pending'), count(*) FILTER (WHERE status='done'),
                   count(*) FILTER (WHERE status='failed'), count(*) FILTER (WHERE "lastError" LIKE 'qa:marginal%')
              FROM {TABLE} GROUP BY lang, voice ORDER BY lang, voice"""
    )
    if rows:
        print("\nlang voice    pending   done  failed  marginal")
        for lang, voice, p, d, f, m in rows:
            print(f"{lang:4s} {voice:7s} {p:8d} {d:6d} {f:7d} {m:9d}")
    rows = db.run(
        f"""SELECT min("requestedAt"), max("updatedAt") FILTER (WHERE status='done'),
                   count(*) FILTER (WHERE status='pending' AND "claimedAt" > LOCALTIMESTAMP - interval '{CLAIM_STALE_MIN} minutes')
              FROM {TABLE} WHERE status IN ('pending','done')"""
    )
    if rows:
        print(f"\noldest waiting request: {rows[0][0]}  last clip made: {rows[0][1]}  in progress: {rows[0][2]}")
    if voices is not None:
        rows = db.run(f"""SELECT "voiceId", count(*) FROM {TABLE} WHERE status = 'pending' AND NOT ("voiceId" = ANY(:v))
                          GROUP BY "voiceId" ORDER BY 2 DESC""", v=voices)
        for vid, n in rows:
            print(f"pending for a voice this engine does not have: {vid} ({n})")


# --------------------------------------------------------------------------- #
# Main loop                                                                   #
# --------------------------------------------------------------------------- #


def seed_key_for(key: str, attempts: int) -> str:
    """The seeds a claim speaks with: the clip's own on its first claim, new ones on each
    retry, so Qwen3-TTS and VoxCPM2 speak different takes. Kokoro does not sample: a new
    seed changes only its vocoder's noise (its takes keep engine.py take_params' speeds)."""
    return key if attempts <= 1 else f"{key}:retry{attempts}"


def make_one(db: DB, eng, me: str, row: dict) -> str:
    """Makes and stores one claimed clip. Returns the row's new status."""
    from engine import engine_label

    if row["attempts"] > MAX_ATTEMPTS:
        write_failed(db, me, row, f"attempts:exhausted:{row['attempts'] - 1}")
        return "failed"
    try:
        spec = eng.spec(row["voiceId"])
    except KeyError:
        write_failed(db, me, row, f"voice:unknown:{row['voiceId']}")
        return "failed"
    if spec.get("lang") != row["lang"]:
        write_failed(db, me, row, f"voice:lang-mismatch:{row['voiceId']} speaks {spec.get('lang')}, row is {row['lang']}")
        return "failed"
    if not (row["text"] or "").strip():
        write_failed(db, me, row, "text:empty")
        return "failed"
    t0 = time.time()
    try:
        clip = eng.make_clip(
            row["voiceId"], row["text"], row["lang"], seed_key=seed_key_for(row["key"], row["attempts"])
        )
    except KeyboardInterrupt:
        raise
    except Exception as e:
        log.exception("clip %s failed in the engine", row["key"])
        note_error(db, me, row, f"engine:{type(e).__name__}:{e}")
        return "error"
    q = clip.qa
    if clip.status == "failed":
        write_failed(db, me, row, clip.last_error or "qa:failed", engine=engine_label(spec), qa_score=clip.qa_score)
    else:
        ok = write_done(
            db, me, row,
            audio=clip.m4a,
            duration_ms=int(round(clip.best.finished.duration_s * 1000)),
            engine=clip.engine_label,
            qa_score=clip.qa_score,
            last_error=clip.last_error,
        )
        if not ok:
            log.warning("clip %s: the row changed hands while it was being made; result dropped", row["key"])
            return "lost"
    log.info(
        "%s %s/%s %s cer=%.3f pace=%.2f takes=%d %.1fs audio in %.1fs (%s)",
        row["key"][:10], row["lang"], row["voice"], clip.status, q.cer, q.pace_ratio, len(clip.takes),
        clip.best.finished.duration_s, time.time() - t0, row["voiceId"],
    )
    return clip.status


# --------------------------------------------------------------------------- #
# Planning again                                                              #
# --------------------------------------------------------------------------- #


def replan_due(last: Optional[float], now: float, every_s: float = REPLAN_EVERY_S) -> bool:
    """True when this run has not planned yet, or last planned a day ago or more."""
    return last is None or now - last >= every_s


def start_replan() -> Optional[subprocess.Popen]:
    """Starts the website's own planner (scripts/pray-along-plan.ts) in the background,
    so prayers published and pages translated since the last plan are made before anyone
    presses play. It writes to this worker's log; listeners' clips go on being made while
    it runs."""
    tsx = PROJECT_DIR / "node_modules" / ".bin" / "tsx"
    plan = PROJECT_DIR / "scripts" / "pray-along-plan.ts"
    if not (tsx.exists() and plan.exists()):
        log.warning("cannot plan again: %s or %s is missing", tsx, plan)
        return None
    try:
        proc = subprocess.Popen([str(tsx), str(plan)], cwd=str(PROJECT_DIR), stdin=subprocess.DEVNULL)
    except OSError as e:
        log.warning("cannot plan again: %s", e)
        return None
    log.info("planning the site's clips again (pid %d)", proc.pid)
    return proc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--once", action="store_true", help="make at most one clip, then exit")
    ap.add_argument("--demand-only", action="store_true", help="only clips a listener asked for")
    ap.add_argument("--limit", type=int, default=0, help="stop after N clips")
    ap.add_argument("--lang", nargs="*", help="only these languages")
    ap.add_argument("--voice", choices=["female", "male"], help="only this voice (bulk runs: no model switching)")
    ap.add_argument("--status", action="store_true", help="print counts and exit")
    ap.add_argument("--exit-when-idle", action="store_true", help="exit when nothing is pending")
    ap.add_argument(
        "--replan-daily",
        action="store_true",
        help="when idle, run the site's planner (new prayers, new translations) once a day",
    )
    ap.add_argument("--worker-id", default=f"{socket.gethostname()}:{os.getpid()}")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    for noisy in ("httpx", "huggingface_hub", "urllib3", "voice_engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    logging.getLogger("voice_engine.worker").setLevel(logging.INFO)

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 2
    db = DB(url)
    if args.status:
        from engine import load_registry

        status(db, list(load_registry().keys()))
        db.close()
        return 0

    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)

    from engine import Engine

    eng = Engine()
    if not eng.registry:
        print("voices/registry.json has no voices", file=sys.stderr)
        return 2
    me = args.worker_id
    voice_ids = list(eng.registry.keys())
    made = 0
    last_plan: Optional[float] = None
    planner: Optional[subprocess.Popen] = None
    log.info("voice worker %s started (%d voices)", me, len(eng.registry))
    try:
        while not STOP.soft:
            if planner is not None and planner.poll() is not None:
                log.info("planning finished (exit %d)", planner.returncode)
                planner = None
            row = claim(db, me, args.demand_only, args.lang, voice_ids, args.voice)
            if row is None:
                if args.once or args.exit_when_idle:
                    break
                if args.replan_daily and planner is None and replan_due(last_plan, time.monotonic()):
                    last_plan = time.monotonic()
                    planner = start_replan()
                time.sleep(IDLE_POLL_S)
                continue
            try:
                result = make_one(db, eng, me, row)
            except KeyboardInterrupt:
                release(db, me, row, "interrupted")
                raise
            if result in ("done", "failed"):
                made += 1
            if args.once or (args.limit and made >= args.limit):
                break
    except KeyboardInterrupt:
        log.info("stopped")
    finally:
        if planner is not None and planner.poll() is None:
            planner.terminate()
        db.close()
        eng.cache.clear()
    log.info("voice worker %s finished: %d clips", me, made)
    return 0


if __name__ == "__main__":
    sys.exit(main())
