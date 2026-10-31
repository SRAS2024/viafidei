# Content translation — operator notes

Via Fidei's interface has always been translated by its own dictionaries
(`src/lib/i18n/dictionaries`, twelve locales since the scaffold commit
`12cc0ea`). Published content — prayers, saints, guides, documents — was
shown in English to everyone. The only Google Translate code the site ever had
was the Admin Worker's keyless `translate.googleapis.com` fallback for Latin and
Greek prayer drafts (`f04b980`), removed with every other external AI/MT
dependency in `01b5931`.

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
Korean. Korean readers get the interface in Korean, content as published, and
parish names in other scripts rendered into English. Pin a working model in
`src/lib/translation/engine/models.ts` (`"en>ko"`) to turn Korean on.

## The rules (`src/lib/translation/rules.ts`)

- **Latin and Greek stay as written.** Latin/Greek prayer texts (payload
  `language` la/el/grc, the `latin`/`greek` fields), universal Latin and Greek
  titles (Salve Regina, Te Deum, Kyrie eleison, Lumen Gentium …), every Latin
  incipit of a Church document, and Latin or Greek passages inside English
  prose. Inside a translated sentence they are masked with placeholders the
  model copies through (`X1`), and a translation that loses one is rejected.
- **Parish names keep their own wording** unless they are written in a script
  other than the reader's (Hangul, Han, kana, Cyrillic, Greek, Arabic, Hebrew,
  Thai …). Those are translated into the reader's language through English and
  always shown with the original: `Myeongdong Cathedral (명동대성당)`. Until the
  translator has done one, a Cyrillic, Greek, Hangul or kana name is shown
  transliterated. Country names are localized from CLDR data.
- **Saints' names are never machine-translated.** A saint's, Doctor's or pope's
  page title comes only from a dictionary key `name.<slug>`; a saint named in
  prose ("Saint John Vianney", the page's own saint) is masked like a Latin
  title. Popes' regnal names in prose are left to the model.
- Everything else a page shows from a published item is translated.

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
  languages in turn, in batches of 16 that yield to new demand.

### Why not on Railway

Running the models in the web service is possible (The Augustine Journal does)
but a poor fit here:

| Need                     | Measured / derived                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory while translating | 1.9 GB RSS with a transformer-big model loaded (es/fr/it/de/pt), 1.2 GB with a base model (pl/tl/vi/zh, name models) — on top of the web server                                 |
| CPU                      | 4 threads saturated for the whole first pass; ~0.1 s per sentence on Apple silicon with beam 4 (`TRANSLATION_BEAMS=1` is faster, slightly lower quality)                        |
| First full pass          | 31,292 unique units per language (2.8 M characters, measured 2026-10-31) × 9 languages ≈ 8 hours on the Mac; expect 2–3× that on shared Railway vCPUs                           |
| Disk                     | 6.5 GB for the 17 primary models (8.3 GB with fallbacks); without a volume Railway would re-download them after every deploy                                                    |
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
  each, about 12 s per 300 MB on the worker host's connection (measured). Loading takes 0.5–1.7 s. One
  model is loaded at a time; a fallback model is loaded only for sentences the
  first one got wrong.
- **Database:** about 320,000 rows when everything is cached (≈281,600
  content rows — 31,292 units × 9 languages — and ≈38,000 parish-name rows for
  the 3,863 published names in a non-Latin script), roughly 200 MB with
  indexes. The table is additive (migration `0062_content_translation`) and
  not in `scripts/validate-db.js`'s required set: without it every page is
  English.
- **Re-translating:** bump `SEGMENT_FORMAT_VERSION` in `segments.ts` to re-key
  every unit; edited content re-keys itself (the hash is of the English text).
- **Disk full:** the translator deletes the other downloaded models and retries.
