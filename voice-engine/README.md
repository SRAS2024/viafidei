# Via Fidei voice engine (pray-along audio)

The website never runs a speech model. Prayer pages file the clips they need in the
`PrayerAudioClip` table (migration `prisma/migrations/0087_pray_along_audio`); this
engine, a long-running process on the Mac (like `scripts/translate-content.ts`), speaks
them with open models, checks every take with a speech recogniser, and writes the
audio back as AAC (`audio/mp4`).

Everything runs locally on Apple silicon through [MLX](https://github.com/ml-explore/mlx).
No paid service, no network at run time.

## Run it

```bash
cd voice-engine
./setup.sh                                  # once: .venv with pinned versions + the models (~16 GB)
export DATABASE_URL=postgresql://viafidei:viafidei@localhost:5432/viafidei   # or the production URL
.venv/bin/python worker.py                  # run until stopped
```

| Command | What it does |
|---|---|
| `worker.py` | Makes clips until stopped. SIGTERM / Ctrl-C finishes the clip in hand; a second one stops at once and gives the claim back. |
| `worker.py --once` | Makes at most one clip, then exits. |
| `worker.py --demand-only` | Only clips a listener is waiting for (`requestedAt` set). |
| `worker.py --limit N` | Stops after N clips. |
| `worker.py --lang la el` | Only these languages. |
| `worker.py --voice female` | Only this voice (bulk runs keep one model loaded). |
| `worker.py --exit-when-idle` | Exits when nothing is pending (batch runs). |
| `worker.py --status` | Counts by status, language and voice, then exits. |

Order of work: listener demand first (newest `requestedAt` first, then lowest
`priority` = earliest in the prayer), then background rows by `priority`. One row at a
time is claimed with `SELECT … FOR UPDATE SKIP LOCKED` (rows claimed in the last 10
minutes are skipped, so a crashed worker's row is retried; after 5 attempts a row is
`failed`). The worker reconnects with back-off if the database drops. Timestamps are
written in UTC, as Prisma writes them.

What a row gets: `audio` (AAC-LC in MP4, faststart, mono, 24 kHz, ~48 kbps), `mime`
`audio/mp4`, `durationMs`, `byteLength`, `engine` (`<model repo>@<revision>:<voice>`),
`qaScore` (1 − character error rate of the best take, so 1.0 = word-perfect), `status`:

* `done`: the best of up to 4 takes passed QA;
* `done` with `lastError = 'qa:marginal:<cer>:<reasons>'`: usable, but not clean;
* `failed` with `lastError` (`qa:failed:…`, `voice:unknown:…`, `attempts:exhausted:…`):
  no audio is stored; reset the row to `pending` to try again.

## What happens to one clip

1. `normalize.py`: the exact words, normalised for a voice (numbers, ordinals, popes'
   numerals, symbols) in each of the 13 languages. Words are never changed.
2. Front end: Latin goes through `latin.py` (below); everything else is text.
3. The model speaks it (`engine.py`; one TTS model resident at a time, LRU-unloaded,
   Whisper stays loaded beside it). The clip's seed comes from its key, so a repeated
   prayer's three takes (the site's `take` 0–2) sound different.
4. `audio.py`: mono 24 kHz, 40 ms of silence before the first sound and 250 ms after
   the last, loudness −18 LUFS (BS.1770), true peak ≤ −1.5 dBTP.
5. `qa.py`: Whisper large-v3-turbo transcribes the take in the clip's language; the
   character error rate is computed on a fair per-language fold (Greek phonemically,
   Chinese as tonal pinyin, Vietnamese and Polish with their diacritics). Also pace
   (against the voice's own usual pace, recorded in the registry), long silences, an
   untranscribed tail (run-on babble), extra words, duration. A take that has wrong
   words or is broken is re-taken (new seed, slightly different sampling), up to 4.
6. Encoded with macOS's AudioToolbox AAC encoder (`ffmpeg -c:a aac_at`).

## Latin

No commercially licensed model speaks Latin. `latin.py` turns Ecclesiastical Latin
(Italianate, as the Liber Usualis has it) into Kokoro phonemes with every stress
placed: printed accents first, then `latin_lexicon.tsv` (vowel quantities for the
site's whole Latin corpus and the common prayers), then the stress rules; a guess is
logged (`VOICE_ENGINE_LATIN_UNKNOWN_LOG=path` also appends it to a file). Kokoro's
Italian voices read the phonemes. `latin.to_respelling()` is the challenger route (an
Italian voice reading an Italian respelling). House-style choices are listed in the
module docstring.

## Voices

`voices/registry.json` maps each voiceId (the strings in
`src/lib/pray-along/voices.json`) to its model, pinned revision and settings. A
designed voice lives in `voices/<lang>-<gender>-v<N>/`: `ref.flac` (the locked
reference clip), `ref.txt` (its exact words) and `design.json` (the description that
designed it, the model, the seed and its QA). See `VOICES` below for the current set
and the bake-off report for why each was chosen.

### Change or add a voice

1. Run the bake-off for the cell (it designs candidates, locks them, speaks the test
   set, scores every take): e.g.
   `.venv/bin/python tools/bakeoff.py qwen-design --cells es-female`, then
   `qwen-lock --cells es-female` (or `voxcpm --cells pl-male`), then `pick`.
   Working files and the report go to `../.cache/pray-along-work/voice/` (`$VOICE_WORK`).
2. `pick` installs the winners: `voices/<slug>/`, `voices/registry.json` and the
   website's `voices.json`. Bump the folder's `-vN` for a new voice rather than
   overwriting one: a new voiceId re-keys that language's clips on the website, so
   the engine makes them again in the new voice, while old clips stay valid until then.
3. Listen to `samples/<lang>-<gender>.m4a`, run the tests, commit `voices/` and
   `voices.json` together.

Never use a recording of a real person as a reference: every designed voice is made
from a text description by the model itself.

### VOICES (bake-off of 2026-11-20)

| Lang | Female | Male |
|---|---|---|
| en | `qwen3-tts-1.7b-base:lock:en-female-v1` | `qwen3-tts-1.7b-customvoice:Aiden` (stock) |
| es | `qwen3-tts-1.7b-base:lock:es-female-v1` | `qwen3-tts-1.7b-base:lock:es-male-v1` |
| fr | `qwen3-tts-1.7b-base:lock:fr-female-v1` | `qwen3-tts-1.7b-base:lock:fr-male-v1` |
| it | `qwen3-tts-1.7b-base:lock:it-female-v1` | `qwen3-tts-1.7b-base:lock:it-male-v1` |
| de | `qwen3-tts-1.7b-base:lock:de-female-v1` | `qwen3-tts-1.7b-base:lock:de-male-v1` |
| pt (Brazil) | `qwen3-tts-1.7b-base:lock:pt-female-v1` | `qwen3-tts-1.7b-base:lock:pt-male-v1` |
| pl | `voxcpm2:lock:pl-female-v1` | `voxcpm2:lock:pl-male-v1` |
| la | `kokoro-82m:latin-ipa:if_sara` (speed 0.85) | `kokoro-82m:latin-ipa:im_nicola` (speed 0.85) |
| tl | `voxcpm2:lock:tl-female-v1` | `voxcpm2:lock:tl-male-v1` |
| vi | `voxcpm2:lock:vi-female-v1` | `voxcpm2:lock:vi-male-v1` |
| ko | `qwen3-tts-1.7b-customvoice:Sohee` (stock) | `qwen3-tts-1.7b-base:lock:ko-male-v1` |
| zh | `qwen3-tts-1.7b-base:lock:zh-female-v1` | `qwen3-tts-1.7b-base:lock:zh-male-v1` |
| el | `voxcpm2:lock:el-female-v1` | `voxcpm2:lock:el-male-v1` |

Installed but not used by the site: `qwen3-tts-1.7b-base:latin-respell:la-female-respell-v1` and
`…:la-male-respell-v1`, the Latin challenger route (an Italian voice reading an Italian respelling);
put one in `voices.json` to switch Latin to it.

The bake-off's report (every candidate's numbers, the reason for each pick, the Latin check's
validation, speed, speaker consistency) and listening samples are written to
`../.cache/pray-along-work/voice/` (`report.md`, `report.json`, `samples/<lang>-<gender>.m4a`,
`samples/candidates/`).

## Speed (Apple M5 Pro, 24 GB)

Real-time factor of generation (seconds of compute per second of speech): Qwen3-TTS ≈ 0.5,
VoxCPM2 ≈ 0.5, Kokoro ≈ 0.05; the Whisper check adds ≈ 0.06–0.13. Takes per clip ≈ 1.05–1.2.
The local end-to-end run made 50 clips (8.5 min of speech in 13 languages and 26 voices,
switching models nearly every clip) in 4 min 56 s. Pre-making all English prayers (≈ 1.1 M
characters, ≈ 19–22 h of speech per voice) takes roughly 12–15 h per voice; run one voice at a
time so only one model is loaded: `worker.py --lang en --voice female`, then `--voice male`.

## Tests

```bash
.venv/bin/python -m pytest tests -q
```

`tests/test_latin.py` (the 40 test words, Signum Crucis, Pater Noster, Ave Maria,
Gloria Patri, every word of the site's Latin corpus in Kokoro's vocabulary) and
`tests/test_normalize.py` (numbers, ordinals and numerals in all 13 languages).
`tests/test_qa_fold.py` (the QA's fair folds, trimming and loudness).
`tools/e2e_local.py` is the end-to-end proof against a local database (it refuses any other host):
`insert`, then `worker.py --once` / `--exit-when-idle`, then `verify` (status, bytes, ffprobe,
macOS's own decoder, a full decode to non-silent audio).

## Licences

| Component | Licence |
|---|---|
| Qwen3-TTS 12Hz 1.7B CustomVoice / VoiceDesign / Base (Alibaba Qwen), MLX builds by mlx-community | Apache-2.0 |
| VoxCPM2 (OpenBMB), MLX build by mlx-community | Apache-2.0 |
| Kokoro-82M (hexgrad) and its voice packs, MLX build by mlx-community | Apache-2.0 |
| Whisper large-v3-turbo (OpenAI), MLX build by mlx-community (QA only, never in the audio) | MIT |
| mlx, mlx-audio, mlx-whisper | MIT |
| pypinyin (QA of Chinese) | MIT |
| pyloudnorm | MIT |
| pg8000 | BSD-3-Clause |
| numpy, scipy, soundfile | BSD-3-Clause |
| ffmpeg (system, encoding with Apple's AudioToolbox) | LGPL-2.1+ (build-dependent) |
| latin.py, latin_lexicon.tsv, normalize.py, everything else here | the site's own code |

The stock speakers (Qwen3 CustomVoice) and Kokoro voice packs ship inside their
Apache-2.0 model repositories; every other voice was designed from a written
description by Qwen3-TTS VoiceDesign or VoxCPM2 and locked by cloning that synthetic
clip, so no real person's voice is reproduced.
