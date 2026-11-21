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
| `worker.py --replan-daily` | When idle, runs the site's planner (`scripts/pray-along-plan.ts`) in the background once a day, so new prayers and new translations are made before anyone presses play. `scripts/voice/launch.sh engine` turns it on. |
| `worker.py --status` | Counts by status, language and voice, then exits. |

Order of work: listener demand first (newest `requestedAt` first, then lowest
`priority` = earliest in the prayer), then background rows by `priority`. One row at a
time is claimed with `SELECT … FOR UPDATE SKIP LOCKED` (rows claimed in the last 10
minutes are skipped, so a crashed worker's row is retried; after 5 attempts a row is
`failed`; a quality failure a listener asks for again comes back with no claim, so it is
retried at once, except a Kokoro (Latin) one, whose retries are nearly the same takes). The worker reconnects with back-off if the database drops. Timestamps are
written in UTC, as Prisma writes them.

What a row gets: `audio` (AAC-LC in MP4, faststart, mono, 24 kHz, ~48 kbps), `mime`
`audio/mp4`, `durationMs`, `byteLength`, `engine` (`<model repo>@<revision>:<voice>`),
`qaScore` (1 − character error rate of the best take, so 1.0 = word-perfect), `status`:

* `done`: the best of up to 4 takes passed QA (or the clip said a sentence at a time, after
  no take said its words right: step 6 below);
* `done` with `lastError = 'qa:marginal:<cer>:<reasons>'`: usable, but not clean;
* `failed` with `lastError` (`qa:failed:…`, `voice:unknown:…`, `attempts:exhausted:…`):
  no audio is played (a failed remake of a made row keeps its old bytes, unserved).
  A listener's request files a `qa:` failure below 5 attempts as `pending` again
  (website `store.ts`), and whatever engine is running makes it, fixes included.
  Reset by hand only rows out of attempts, or made rows a fix should reach (the key
  does not change, so nothing else remakes them): set `status = 'pending'`,
  `attempts = 0`, `claimedAt = NULL` and `claimedBy = NULL`. A reset that leaves the
  claim waits out the 10 minutes; one that leaves `attempts` at 5 fails at once as
  `attempts:exhausted`. With `attempts = 0` the remake uses the row's first seeds, so it
  helps only after an engine change. A reset made row plays nothing until it is made
  again, and if the remake fails QA it stays failed and its prayer stalls: check the fix
  on those texts with `make_clip` first.

## What happens to one clip

1. `normalize.py`: the exact words, normalised for a voice (numbers, ordinals, popes'
   numerals, symbols) in each of the 13 languages. Words are never changed.
2. Front end: Latin goes through `latin.py` (below); everything else is text.
3. The model speaks it (`engine.py`; one TTS model resident at a time, LRU-unloaded,
   Whisper stays loaded beside it). The clip's seed comes from its key, so a repeated
   prayer's three takes (the site's `take` 0–2) sound different with Qwen3-TTS and
   VoxCPM2; with Kokoro (Latin) the seed changes only the vocoder's noise, so the three
   sound nearly the same.
4. `audio.py`: mono 24 kHz, 40 ms of silence before the first sound and 250 ms after
   the last, loudness −18 LUFS (BS.1770), true peak ≤ −1.5 dBTP.
5. `qa.py`: Whisper large-v3-turbo transcribes the take in the clip's language; the
   character error rate is computed on a fair per-language fold (Greek phonemically,
   Chinese as tonal pinyin, Vietnamese and Polish with their diacritics). Also pace
   (against the voice's own usual pace, recorded in the registry), long silences, an
   untranscribed tail (run-on babble), extra words, duration. A take that has wrong
   words or is broken is re-taken (a new seed and slightly different sampling; for
   Kokoro, which does not sample, a slightly different speed: `engine.py` take_params),
   up to 4. A clip of one to three syllables is allowed its drawn-out last syllable in
   the pace check (`SHORT_CLIP_SYLLABLES`): by syllable rate alone, Spanish "dos", "tres"
   and "seis" were heard right in every take and still failed as slow. English counts
   the Latin words its prayers keep ("Ave", "Domine", "Miserere": `EN_LATIN_FINAL_E`)
   with their final e said; the silent-e rule read "Ave, Ave, Ave, Maria! Ave, Ave, Ave,
   Maria!" as 10 syllables, not 16. A word the text says three times or more running
   ("Ave, Ave, Ave", "Santo, Santo, Santo", "Sanctus") must be heard as many times, at
   any CER (`dropped_repeats`): one Ave dropped from a verse is CER 0.033, under the pass
   line, and two clips were made so. A word said twice is left to the CER, as Whisper
   itself writes one of a doubled word ("but I, I have"). The transcript is lined up
   with the text word by word (`word_alignment`: the fewest edits, then the most words
   lined up; difflib's longest-stretch-first matching paired the bare refrain's first
   half with the transcript's second when Whisper wrote "Mariah" for the first Maria),
   and a copy not lined up is looked for between the nearest words that are: a word
   there that no word of the text accounts for may be a copy Whisper spelled otherwise
   ("Santus", "Jesús" for "Jesu"), and the word may be written inside another
   ("Avemaria", "aveave"); the larger of those two counts is credited, not their sum.
   Letters alone are no copy: the male voice's two drawn-out Aves per half, heard as
   "Eveveve, eveve", once passed for three. Rare false fails (another take, never a clip
   kept with a copy missing): a copy both joined and misspelled ("santussantus"), or one
   misspelled beside one joined.
6. When no take said its words right (each failed on them, `QAResult.words_failed`: a
   character or syllable error over the marginal limit, a word of a run said fewer
   times, or nothing heard; or had them only marginal, `words_marginal`: an error
   between the pass and marginal lines; not pace, silences or a tail alone) and the
   voice is Qwen3-TTS or VoxCPM2, a clip of two or more sentences is said again a
   sentence at a time (`engine.py` say_by_sentence). The sentences are cut where the
   website cut them (`speech-text.ts` splitSentences), never after an abbreviation or a
   number, and only where the voice is given the same words as for the whole clip. Each
   sentence gets up to 4 takes of its own, judged against its own words, with seeds
   drawn from the clip's; a sentence whose best take failed uses the best take that did
   not of another sentence given the very same words (the two halves of the refrain).
   The chosen takes are joined with a 0.45 s pause (the low end of the voices' own
   pause at a sentence end), finished, and judged against the whole text. The joined
   clip is kept only if it judges better than the best whole take and no sentence's
   chosen take failed its own check (a sentence that ran on into an untranscribed tail
   would carry it inside the joined clip, where the joined clip's check does not look);
   when that whole take is usable (marginal), the joined clip must also have a lower
   character (or syllable) error, as the row has a clip to play already. Both steps are
   logged as warnings. A clip that passes on a whole take is made exactly as before.
   The female English voice dropped an "Ave" from that refrain in all 8 whole takes
   measured (always from its second half); said a sentence at a time it passed with all
   six, with the worker's seeds and its retry's, and so did the male voice's row, whose
   4 whole takes each lost two Aves or more. With the worker's first seeds (2026-11-21):
   the two female verses stored with five Aves fail those takes now (CER 0.033 and
   0.032) and pass on a later whole take with six; the male voice's two verses, whose
   every whole take lost an Ave or garbled the refrain ("Eveveve, eveve": four Aves,
   six bursts of sound), pass said a sentence at a time with six, one of them with its
   refrain's first half, failed in 4 takes, using the second half's take; the two
   Spanish rows that say "Jesu" four times pass on their first take ("Jesús" each time),
   and that take with one Jesu cut out of its audio fails ("said 'jesu' 3 times, not
   4"), where it used to pass as marginal. Clips said apart for words only marginal are
   few: of the 8,239 clips made by then, 13 of two sentences or more were kept with a
   best take whose words were only marginal.
7. Encoded with macOS's AudioToolbox AAC encoder (`ffmpeg -c:a aac_at`).

## Latin

No commercially licensed model speaks Latin. `latin.py` turns Ecclesiastical Latin
(Italianate, as the Liber Usualis has it) into Kokoro phonemes with every stress
placed: printed accents first, then `latin_lexicon.tsv` (vowel quantities for the
site's whole Latin corpus and the common prayers), then the stress rules; a guess is
logged (`VOICE_ENGINE_LATIN_UNKNOWN_LOG=path` also appends it to a file). Kokoro's
Italian voices read the phonemes. `latin.to_respelling()` is the challenger route (an
Italian voice reading an Italian respelling). House-style choices are listed in the
module docstring.

Kokoro says a very short input badly: alone, "Amen." failed QA in every take (heard as
"E amen", "Garmin") and "Oremus." came out as "Oremos". So a Latin phrase under 20 IPA
symbols (`KOKORO_SHORT` in `engine.py`) is said in the middle of a carrier sentence,
`Pater noster, qui es in caelis. <phrase> Pater noster, qui es in caelis.`, in one call,
and cut back out at the quietest 5 ms of the pause on each side, with a 5 ms fade at each
edge. The carrier starts on p and ends on s: Kokoro speaks a little ahead of its own
durations, so each pause also holds the edges of its neighbours, but the p's closure and
the end of the s leave a quiet gap, which the search finds. If either cut is less than
30 dB under the phrase, the phrase is said alone, as before (logged as a warning). Clips of 20 symbols or more
are made as before, apart from the female voice's vowel onset (below). Measured with the engine's own seeds on 2026-11-21: "Amen."
passed 40 of 40 takes (none alone), and the seven other short Latin texts measured 106 of
112 (61 alone).

The female Latin voice (`if_sara`) also starts a vowel-initial clip more cleanly. Kokoro
voices the last 75–175 ms of its start token, and before a first vowel that early voicing
was at times heard as another vowel ("Ora pro nobis" as "Aura pro nobis", "Ut digni" as
"O digne"). Its registry entry sets `vowel_onset_keep_s` (0.025): the start token is
silenced except its last 25 ms, which fade in (`soften_vowel_onset` in `engine.py`).
Silencing all of it took short first vowels away ("In nomine" heard as "Nomine"); the
male voice says these onsets right as they are (the same cut cost it 3 of 26 takes), so it
has no such setting. A first consonant keeps its voicing, which belongs to it ("Deo").
Like `tempo` (and the `pace_ref` calibrated with it), this setting is set by hand:
`tools/pick.py` rewrites a voice's registry entry without them, so set them again after a
re-pick.

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
   `pick` writes each entry from the bake-off alone: settings set by hand afterwards
   (`tempo` with the `pace_ref` calibrated with it, `vowel_onset_keep_s`) must be set
   again.
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
`tests/test_qa_pace.py` (the pace check of one- to three-syllable clips; no model is loaded).
`tests/test_kokoro_carrier.py` (the short-phrase carrier: its cuts and guard on synthetic audio,
and the engine's Kokoro path with a fake model; no model is loaded).
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
