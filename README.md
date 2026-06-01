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

## Audio styles (folder-based)

Audio lives under `public/audio/`, one folder per style, all using the **same
base filenames**:

```
public/audio/original/    raw recordings (source of truth) + optional .mid
public/audio/strings/     string-orchestra renders
public/audio/electronic/  synth / electronic renders
public/audio/funny/       toy marimba / xylophone renders
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
not piercing; **funny** = playful cartoon synth blip with a gentle pitch bounce
(deliberately *not* xylophone/marimba/bells).

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
  program, so a single GM SoundFont yields all three timbres:
  - strings → GM *String Ensemble 1*
  - electronic → GM *Lead 2 (sawtooth)*
  - funny → GM *Marimba*

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
  hand-tuned voice per style (string ensemble / detuned synth lead / percussive
  marimba). No SoundFont needed; used automatically when fluidsynth is absent.
  This is what runs out of the box.

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
