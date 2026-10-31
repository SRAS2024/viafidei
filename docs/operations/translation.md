# Content translation — operator notes

Via Fidei's interface has always been translated by its own dictionaries
(`src/lib/i18n/dictionaries`, twelve locales since the scaffold commit
`12cc0ea`). Published content — prayers, saints, guides, documents — was
shown in English to everyone. The scaffold planned content translation
(`PrayerTranslation`, `SaintTranslation` … tables with a MACHINE /
HUMAN_REVIEWED status, never filled, dropped in `0025_drop_legacy_system`), and
the only Google Translate code the site ever had was the Admin Worker's keyless
`translate.googleapis.com` fallback for Latin and Greek prayer drafts
(`f04b980`), removed with every other external AI/MT dependency in `01b5931`.

`src/lib/translation` is a self-hosted engine, ported from The Augustine
Journal: pinned OPUS-MT (MarianMT) models run on onnxruntime with a TypeScript
SentencePiece tokenizer, ONNX graph builder and beam search, a sentence cache in
Postgres, and background pre-translation that never blocks a page.

## Languages

The ten languages besides English the site has supported since the scaffold:
es, fr, it, de, pt, pl, tl, vi, ko, zh. Latin (the twelfth locale) is liturgical
and never machine-translated; English is the source.

Korean has **no working model**. The only English→Korean OPUS-MT model on
Hugging Face (`Helsinki-NLP/opus-mt-tc-big-en-ko`) was trained with separate
vocabularies and converted with one, so it answers English with unrelated
Korean. Korean readers get the interface in Korean and the content as
published. Pin a working model in `src/lib/translation/engine/models.ts`
(`"en>ko"`) to turn Korean on.

## The rules (`src/lib/translation/rules.ts`)

- **Latin and Greek stay as written.** Latin/Greek prayer texts (payload
  `language` la/el/grc, the `latin`/`greek` fields), universal Latin and Greek
  titles (Salve Regina, Te Deum, Kyrie eleison, Lumen Gentium …), every Latin
  incipit of a Church document, and Latin or Greek passages inside English
  prose. Inside a translated sentence they are masked with placeholders the
  model copies through (`X1`), and a translation that loses one is rejected.
- **Parish names keep their own wording** unless they are written in a script
  other than the reader's (Hangul, Han, kana, Cyrillic, Greek, Arabic, Hebrew,
  Thai …). Those are **transliterated**, always with the original beside it
  ("Myeongdong Daeseongdang (명동대성당)", "Tserkva Sviatoho Mykolaia (Церква
  Святого Миколая)"), when the script has a letter-by-letter system (Cyrillic,
  Greek, Hangul, kana-only Japanese), and shown as written otherwise (Han,
  kanji, Arabic, Hebrew, Thai). Names are **never machine-translated**: the
  rule allows transliteration when a translation is not meaningful, and on
  2026-10-31 the OPUS-MT name models turned a sample of 125 published names
  into mostly wrong and sometimes obscene English (Korean "…동성당" parishes
  came back as "Responsibilities", "The Hooligans" and worse; a Dormition
  church as "the Holy Virgin's Sleep"; an Ascension church as "the Lord's
  Resurrected"), and most church names carry a saint's name, which rule (c)
  keeps from the models. Parish pages, the directory and the near-me API do
  this in memory: no cache lookup, no model. Country names are localized from
  CLDR data.
- **Saints' names are never machine-translated.** A saint's, Doctor's or pope's
  page title comes only from a dictionary key `name.<slug>`. In prose, a saint
  named with a title ("Saint John Vianney", "St. Thérèse") and the page's own
  saint in every form its prose uses ("Saint Aaron of Aleth" is also "Aaron of
  Aleth" and "Aaron") are masked like a Latin title. Saints named bare in other
  pages' prose ("Augustine wrote…") are not recognised and reach the model.
  Popes' regnal names in prose are left to the model.
- Everything else a page shows from a published item is translated. A
  sentence the model garbles in a way a Catholic reader must never see — Our
  Lady as a goddess or "our madam" (measured: the Vietnamese and Chinese
  models do this), the Hail Mary as weather hail (Polish) — is rejected and
  stays English (`distortsCatholicTerms` in `text.ts`). Prayer texts shown in
  the reader's language are labelled with that language, never as "English".
- **A page keeps its layout in every language.** What a page shows, in what
  order, how it lays a field out (a row of chips or a list) and what it leaves
  out is decided on the stored English; only the text is swapped in
  (`displayItem`). The prayers a devotion's instructions or
  a novena's days name are found by their English names, then shown in the
  reader's language with one lookup for the prayers shown (`listedPrayer`,
  `localizePrayers`). The short lines a page writes itself under a title (a
  saint's patronage and feast day, a novena's start, a devotion's length) are
  built from the stored record and stay as they are rather than mix two
  languages in one line, and a composed saint biography loses its closing
  source pointer before it is localized.

## How it runs

```
visitor ──► Railway web (Next.js) ──► ContentTranslation (Postgres) ◄── translator (Mac worker host)
               reads cached text,          migration 0062             npm run translate
               files missing units                                     demand first, then
               as "pending" demand                                      pre-translation
```

- The **web server** never runs a model. For a reader of a supported language
  it plans each item's units (`segments.ts`), reads them in one indexed query
  (400 ms timeout, in-process LRU of 60,000 entries), shows whatever is cached
  and files the rest as demand. Any failure serves the original text.
- The **translator** (`scripts/translate-content.ts`) claims visitor demand
  first, then translates every uncached unit of every published item, nine
  languages in turn, in batches of 16 that yield to new demand. It remembers
  which units are finished, so after the first pass it only asks the database
  about the ones still missing.

### Why not on Railway

Running the models in the web service is possible (The Augustine Journal does)
but a poor fit here:

| Need                     | Measured / derived                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory while translating | 1.9 GB RSS with a transformer-big model loaded (es/fr/it/de/pt), 1.2 GB with a base model (pl/tl/vi/zh) — on top of the web server                                              |
| CPU                      | 4 threads saturated for the whole first pass; ~0.1 s per sentence on Apple silicon with beam 4 (`TRANSLATION_BEAMS=1` is faster, slightly lower quality)                        |
| First full pass          | 31,350 unique units per language (2.8 M characters, measured 2026-10-31) × 9 languages ≈ 8 hours on the Mac; expect 2–3× that on shared Railway vCPUs                           |
| Disk                     | 3.7 GB for the 9 primary models (5.2 GB with the 5 fallbacks); without a volume Railway would re-download them after every deploy                                               |
| Image                    | onnxruntime-node 1.29: 283 MB as installed (all platforms), 43 MB of it the linux-x64 binaries — plus ~600 MB of CUDA libraries on Linux unless `onnxruntime-node-install=skip` |

The Mac worker host already runs around the clock, has the memory and cores,
keeps the models on disk across restarts, and writes to the same database. The
trade-off: translations appear only while the translator runs; when it is off
pages simply stay in English.

## Setup and operation (worker host)

```sh
npm run translate:setup          # once: onnxruntime-node under .cache/translation-runtime
npm run translate -- --status    # cache counts per language and status
npm run translate -- --once      # one pass (demand + up to 400 units), then exit
npm run translate                # run forever (keep alive with launchd or tmux)
npm run translate -- --demand-only
npm run translate -- --langs=es,fr --budget=2000
```

It needs `DATABASE_URL` (the same one the worker uses). Optional:
`TRANSLATION_MODEL_DIR` (default `.cache/translation-models`),
`TRANSLATION_THREADS` (4), `TRANSLATION_BEAMS` (4), `TRANSLATION_RUNTIME_DIR`,
`TRANSLATION_DISABLED=true` (the web server and the translator both stop).

- **Cold start:** each model is downloaded from Hugging Face at a pinned
  revision on first use and verified (SHA-256 / git blob SHA-1); 300–620 MB
  each, about 12 s per 300 MB on the worker host's connection (measured).
  Loading takes 0.5–1.7 s. One model is loaded at a time, except that a pair's
  fallback model is loaded beside it, for one batch, when the first one got
  sentences wrong (derived peak: about 3 GB with a transformer-big model and
  its base fallback, 1.9 + 1.2 GB).
- **Database:** about 282,000 rows when everything is cached (31,350 units ×
  9 languages; parish names never become rows), roughly 180 MB with indexes.
  The table is additive (migration `0062_content_translation`) and not in
  `scripts/validate-db.js`'s required set: without it every page is English.
- **Re-translating:** bump `SEGMENT_FORMAT_VERSION` in `segments.ts` to re-key
  every unit; edited content re-keys itself (the hash is of the English text).
- **Disk full:** the translator deletes the other downloaded models and retries.
