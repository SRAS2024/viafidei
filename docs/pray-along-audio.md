# Pray along: the audio that prays a prayer aloud

A small megaphone button on prayer pages (litanies included), on each novena day (beside
the day's title once it is open), on the Rosary's mysteries (top right, following the set
shown) and on prayer guides. Pressing it prays the prayer aloud: the Sign of the Cross,
the prayer prayed in full, the Sign of the Cross. Nothing plays until it is pressed.

## What it says

`src/lib/pray-along` builds the words, from the same published records and in the same
reader's language as the page (never from words a request supplies):

- `speech-text.ts` reads a prayer with the page's own parser (`parsePrayerText`): spoken,
  versicle and response lines are said without their markers; headings, notes, citations
  ("(St Thomas of Villanova)", "(Lk 1:28)"), name placeholders ("N.") and printed crosses
  are left out. An instruction that names prayers is prayed, not read: "Our Father, Hail
  Mary, Glory Be." prays those three, "Ave Maria." or "Ave." at the end of a petition
  prays a Hail Mary, "three Hail Marys" three of them, and "(Thrice.)" says its line three
  times. A translated text keeps its English line for line, so each line is judged by its
  English and said in the reader's words; a line not translated yet is said in English.
- `script.ts` assembles a press: `prayerScript`, `novenaDayScript` (a day that only says
  how to pray the Divine Mercy chaplet prays the chaplet), `rosaryScript` (the Rosary as
  the site's guide prays it: Creed, Our Father, three Hail Marys, Glory Be, five announced
  decades with the Fatima Prayer, the Hail, Holy Queen with its versicle, the closing
  prayer), `planScript` (a guide's checked plan, `guide-plans.json`) and `sequenceScript`.
  A prayer said many times in a row rotates three recordings, so a decade does not echo.
- `sign-of-the-cross.ts` and `rosary-texts.ts` hold the words the audio adds itself, in
  each language's official form, checked against the Holy See's Compendium, Vatican News,
  Rosarium Virginis Mariae and the bishops' conferences (Korean: CBCK; Chinese: 信德;
  Vietnamese: Mân Côi; Greek: ΙΣΚΙΕ).

Language: the language the page shows the prayer in; the Latin or Greek the reader
chose on the prayer-language chips when the prayer has it; Latin wherever a reader of the
Latin site has not chosen otherwise. One press never mixes languages except a line the
translator has not reached yet.

Voice: a member's choice under Settings → Audio (female or male, `Profile.audioVoice`);
signed-out visitors and members who never chose hear the female voice.

## Where the audio comes from

The web server never runs a model. Every clip is identified by a hash of the voice, the
language and the exact words (`voices.ts`), stored in `PrayerAudioClip` (migration 0087)
and served by `/api/pray-along/clip/<key>` (byte ranges for Safari, cached for good).

1. A press asks `/api/pray-along` for the playlist. Clips not made yet are filed
   `pending` with the time of the request and their place in the prayer.
2. The voice engine (`voice-engine/`, on the worker host, like the content translator)
   makes listeners' clips first, newest request first, then the planned ones by
   priority. It checks every take with a speech recogniser against the words, keeps the
   best of several, and stores AAC audio.
3. The player waits for a clip being made (with silence playing, so a locked phone keeps
   going) and asks again every few seconds.

`npm run voice:plan` files every clip the site will need so the engine makes them before
anyone presses play (the Sign of the Cross and the Rosary's prayers first, then prayers in
display order, novena days, guides; English, then Latin and Greek, then translated pages;
every language's female voice, which every visitor hears unless a member chose the male
one, before the male voice).

## Running the engine on the Mac

```bash
bash voice-engine/setup.sh                 # once: the engine's own Python environment
npm run voice:status                       # what is made, by language
npm run voice:plan                         # file every clip the site needs
npm run voice                              # make clips (Ctrl-C stops it)
bash scripts/voice/install-launch-agent.sh            # keep it running at login
bash scripts/voice/install-launch-agent.sh --remove   # stop it for good
```

`scripts/voice/launch.sh` reads the production database address from the linked Railway
project into memory only (as the Admin Worker launcher does) and refuses a local database
unless `VIAFIDEI_ALLOW_LOCAL_DB=1`. Logs: `~/Library/Logs/ViaFidei/voice-engine.log`.

## Voices

`src/lib/pray-along/voices.json` names the open model and voice that speak each language
for each of the two voices; the engine's README lists each model's licence and how each
voice was made. Changing a voice there re-keys that language's clips, so the engine makes
them again. All models are open and commercially licensed, run locally, and no voice
imitates a real person.

## Accessibility

A real button named for what it will do ("Pray along: Hail Mary", then "Pause praying
along: …", "Resume praying along: …"), a Stop button beside it while a prayer is under
way, every change said in a polite status region ("Preparing the audio…", "Paused.",
"Finished."), focus returned to the megaphone when Stop goes, never `disabled`, keyboard
operable, lock-screen and headphone controls through the Media Session API, and a small
level meter that moves only for readers who have not asked for reduced motion. A prayer
whose button leaves the page (the reader navigates away or folds its day) stops.
