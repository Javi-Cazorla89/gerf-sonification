# GERF Sonification — Brain & Gut Studio

A playful React app for sonifying GERF brain/gut recordings. Add Brain and Gut
sounds, layer them, and play them together. "Sir Tone" can play every sound in
one of three styles.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npx tsc --noEmit # type-check
```

## Offline use on iPad (installable PWA)

The app is a Progressive Web App. **Open it online once**, add it to the Home
Screen, and it then runs **fully offline** — all UI, audio clips, and signal
graphs are served from an on-device cache. A small **"✓ Offline ready"** badge
appears (bottom-left) the first time caching finishes, so you know it's safe to
disconnect.

### 1. Deploy / open once online

Build and host the contents of `dist/` on any HTTPS static host (Vercel,
Netlify, GitHub Pages, …). A service worker requires **HTTPS** (or
`localhost`).

```bash
npm run build      # outputs dist/ (includes the service worker + web manifest)
npm run preview    # local production preview at http://localhost:4173
```

Open the deployed URL on the iPad in **Safari** while online and wait a few
seconds for the **"✓ Offline ready"** badge — that means every audio clip and
signal file has been cached (~34 MB).

### 2. Add to Home Screen (iPad)

1. In **Safari**, tap the **Share** button (square with an upward arrow).
2. Choose **Add to Home Screen**.
3. Confirm the name (**Sir Tone**) and tap **Add**.
4. Launch the app from its Home-Screen icon — it opens full-screen
   (standalone, landscape) with no browser chrome.

### 3. Test in Airplane Mode

1. Make sure you opened the app online at least once and saw the badge.
2. Enable **Airplane Mode** (or turn off Wi-Fi).
3. Launch the app from the Home Screen — it loads instantly from cache.
4. Add Brain / Gut / Skin sounds, switch styles, and press **Play** — audio
   and signal graphs all work with no connection.

> Updating: when you redeploy a new build, the next time the iPad opens the app
> **with a connection** it caches the update in the background and shows a
> **"New version ready → Reload"** pill. Offline, the last cached version keeps
> working.

The PWA is configured in `vite.config.ts` (via `vite-plugin-pwa`): a precache of
all built assets + `public/audio/**` + `public/signals/**`, cache-first for
static files and Google Fonts, and the `manifest.webmanifest` (name, standalone,
landscape, cream/purple theme).

## Audio styles (folder-based)

Audio lives under `public/audio/`, one folder per style, all using the **same
base filenames**:

```
public/audio/original/    raw recordings (source of truth) + optional .mid
public/audio/strings/     string-orchestra renders
public/audio/electronic/  synth / electronic renders
public/audio/funny/       cartoon speaking-voice ("wah/doo/bop/yah") renders
```

The UI style picker offers **String Orchestra**, **Electronic**, and **Funny**
(default **Funny**). At play time the app tries `/audio/<style>/<file>` and
**falls back to `/audio/original/<file>`** when the styled file is missing — so
the app always works, even with empty style folders. Drop styled wavs in and the
picker starts using them immediately; no code change needed.

## Generating styled audio

The style folders are populated by rendering the `.mid` files that sit next to
each original `.wav` (in `public/audio/original/`). Files without a matching MIDI
(e.g. the ZB5 recordings) are skipped and keep falling back to the original.

### 1. Install the Python deps

```bash
python3 -m pip install mido numpy
```

### 2. Render

```bash
python3 scripts/render_styles.py            # render all missing styled wavs
python3 scripts/render_styles.py --force     # re-render / overwrite existing
python3 scripts/render_styles.py --renderer synth   # force the built-in synth
```

**Preview a few first** (handy when tweaking the presets):

```bash
python3 scripts/render_styles.py --limit 2 --force                       # first 2 sounds
python3 scripts/render_styles.py --only brain_diffusion_3peaks_no-drug --force  # one sound
```

The built-in synth voices are: **strings** = smooth sustained string pad (no
vibrato/detune warble); **electronic** = clean band-limited synth, bright but
not piercing; **funny** = cartoon speaking voice that babbles "wah/doo/bop/yah"
following each note's pitch (formant-shaped, deliberately *not*
xylophone/marimba/bells). Funny always uses this built-in vocal synth.

This writes, for every `original/<base>.wav` that has a `original/<base>.mid`:

```
public/audio/strings/<base>.wav
public/audio/electronic/<base>.wav
public/audio/funny/<base>.wav
```

### Renderers

The script picks a renderer automatically (override with `--renderer`):

- **`fluidsynth`** (preferred) — used when the `fluidsynth` binary is on `PATH`
  **and** a SoundFont is available. Each style remaps the MIDI to a General MIDI
  program for the pitched styles:
  - strings → GM *String Ensemble 1*
  - electronic → GM *Lead 2 (sawtooth)*
  - funny → **always** the built-in cartoon vocal synth (never a GM program),
    even under fluidsynth

  Install + point at a SoundFont:

  ```bash
  brew install fluid-synth                 # macOS
  # provide a General MIDI SoundFont (.sf2), then either:
  export GERF_SOUNDFONT=/path/to/FluidR3_GM.sf2
  # ...or drop a .sf2 into scripts/soundfonts/
  python3 scripts/render_styles.py --force
  ```

  Per-style SoundFont overrides live in `STYLES` in `scripts/render_styles.py`.

- **`synth`** (built-in fallback) — a dependency-light `numpy` synth with a
  hand-tuned voice per style (string ensemble / detuned synth lead / cartoon
  vocal babble). No SoundFont needed; used automatically when fluidsynth is
  absent. This is what runs out of the box.

### 3. Validate

```bash
python3 scripts/validate_styles.py
```

Prints how many original wavs exist, how many have a matching MIDI, and how many
`strings` / `electronic` / `funny` wavs were generated (with per-style coverage).

## Project layout

- `src/config/audio.ts` — sound library, style config, path builders
  (`originalPath` / `stylePath`).
- `src/App.tsx` — playback. `resolvePlayablePath` HEAD-probes the styled folder
  then falls back to `original/`.
- `scripts/render_styles.py` — batch MIDI → styled wav renderer.
- `scripts/validate_styles.py` — coverage report.
