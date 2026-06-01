#!/usr/bin/env python3
"""
Batch-render styled WAVs from the MIDI files in public/audio/original/.

For every `<base>.wav` in public/audio/original/ this looks for a matching
`<base>.mid` and renders three styled versions using the SAME base filename:

    public/audio/strings/<base>.wav      -> string ensemble
    public/audio/electronic/<base>.wav   -> synth / electronic lead
    public/audio/funny/<base>.wav        -> toy marimba / xylophone

If a WAV has no matching MIDI it is skipped and logged (the app keeps falling
back to public/audio/original/ for those, so nothing breaks).

Two renderers are supported, chosen automatically (override with --renderer):

  * fluidsynth  - preferred. Used when the `fluidsynth` binary is on PATH and a
                  SoundFont (.sf2) is available. Each style remaps the MIDI to a
                  General MIDI program (see STYLES) so one GM SoundFont yields
                  all three timbres. Point at a SoundFont with $GERF_SOUNDFONT,
                  or drop one in scripts/soundfonts/ (per-style override allowed
                  via STYLES[...]["soundfont"]).

  * synth       - built-in, dependency-light fallback (numpy only). Synthesises
                  each note with a hand-tuned voice per style. No SoundFont
                  needed, fully reproducible, used automatically when fluidsynth
                  isn't available.

Usage:
    python3 scripts/render_styles.py            # render everything
    python3 scripts/render_styles.py --force     # overwrite existing styled wavs
    python3 scripts/render_styles.py --validate  # just print the counts, render nothing
    python3 scripts/render_styles.py --renderer synth
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

# --- Paths -----------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"
ORIGINAL_DIR = AUDIO_DIR / "original"
SOUNDFONT_DIR = SCRIPT_DIR / "soundfonts"

SR = 44100  # output sample rate

# --- Style configuration ---------------------------------------------------
# `gm_program` is the General MIDI program used by the fluidsynth renderer.
# `voice` selects the built-in synth fallback timbre.
# `soundfont` (optional) overrides the SoundFont for that style (fluidsynth only).
STYLES: dict[str, dict] = {
    "strings": {
        "folder": "strings",
        "gm_program": 48,   # GM 49 "String Ensemble 1" (0-indexed 48)
        "voice": "strings",
        "soundfont": None,
    },
    "electronic": {
        "folder": "electronic",
        "gm_program": 81,   # GM 82 "Lead 2 (sawtooth)"
        "voice": "electronic",
        "soundfont": None,
    },
    "funny": {
        "folder": "funny",
        "gm_program": 12,   # GM 13 "Marimba"
        "voice": "funny",
        "soundfont": None,
    },
}


# --- Discovery -------------------------------------------------------------
def find_pairs() -> list[tuple[str, Path, Path | None]]:
    """Return (base, wav_path, mid_path_or_None) for each wav in original/."""
    pairs: list[tuple[str, Path, Path | None]] = []
    for wav in sorted(ORIGINAL_DIR.glob("*.wav")):
        base = wav.stem
        mid = ORIGINAL_DIR / f"{base}.mid"
        pairs.append((base, wav, mid if mid.exists() else None))
    return pairs


def count_wavs(folder: str) -> int:
    d = AUDIO_DIR / folder
    return len(list(d.glob("*.wav"))) if d.is_dir() else 0


def print_summary() -> None:
    pairs = find_pairs()
    n_wav = len(pairs)
    n_mid = sum(1 for _, _, m in pairs if m is not None)
    print("\n=== Style render summary ===")
    print(f"  original wavs            : {n_wav}")
    print(f"  matching midi files      : {n_mid}")
    print(f"  wavs without midi (skip) : {n_wav - n_mid}")
    for name, cfg in STYLES.items():
        print(f"  {name + ' wavs':<24} : {count_wavs(cfg['folder'])}")
    print("============================")


# --- MIDI parsing ----------------------------------------------------------
def parse_notes(mid_path: Path) -> list[tuple[float, float, int, int]]:
    """Parse a MIDI file into (start_s, end_s, note, velocity) tuples."""
    import mido

    notes: list[tuple[float, float, int, int]] = []
    active: dict[tuple[int, int], tuple[float, int]] = {}
    t = 0.0
    for msg in mido.MidiFile(mid_path):
        t += msg.time
        if msg.type == "note_on" and msg.velocity > 0:
            active[(msg.channel, msg.note)] = (t, msg.velocity)
        elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
            key = (msg.channel, msg.note)
            if key in active:
                start, vel = active.pop(key)
                notes.append((start, t, msg.note, vel))
    # Close any notes left hanging at end of file.
    for (_, note), (start, vel) in active.items():
        notes.append((start, t + 0.5, note, vel))
    return notes


# --- Built-in numpy synth renderer -----------------------------------------
def _adsr(n: int, sr: int, a: float, d: float, s: float, r: float):
    import numpy as np

    env = np.zeros(n, dtype=np.float32)
    ai, di, ri = int(a * sr), int(d * sr), int(r * sr)
    ai = min(ai, n)
    if ai:
        env[:ai] = np.linspace(0.0, 1.0, ai, endpoint=False)
    di = min(di, n - ai)
    if di:
        env[ai:ai + di] = np.linspace(1.0, s, di, endpoint=False)
    sus_end = max(ai + di, n - ri)
    env[ai + di:sus_end] = s
    if ri and sus_end < n:
        env[sus_end:] = np.linspace(env[sus_end - 1] if sus_end > 0 else s, 0.0, n - sus_end)
    return env


def _saw(freq, t, harmonics):
    import numpy as np

    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        out += np.sin(2 * np.pi * freq * k * t) / k
    return out * (2.0 / np.pi)


def render_note_synth(voice: str, freq: float, dur: float, vel: float):
    import numpy as np

    amp = (vel / 127.0)

    if voice == "strings":
        length = dur + 0.35
        n = max(1, int(length * SR))
        t = np.arange(n) / SR
        vib = 1.0 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
        layers = (
            _saw(freq * 0.997, t * vib, 12)
            + _saw(freq * 1.003, t * vib, 12)
            + _saw(freq, t * vib, 12)
        ) / 3.0
        env = _adsr(n, SR, a=0.12, d=0.05, s=0.85, r=0.30)
        return (layers * env * amp * 0.5).astype(np.float32)

    if voice == "electronic":
        length = dur + 0.10
        n = max(1, int(length * SR))
        t = np.arange(n) / SR
        sig = (
            _saw(freq * 0.99, t, 24)
            + _saw(freq * 1.01, t, 24)
            + 0.4 * np.sign(np.sin(2 * np.pi * (freq / 2) * t))  # square sub-osc
        ) / 2.4
        env = _adsr(n, SR, a=0.005, d=0.08, s=0.72, r=0.08)
        return (sig * env * amp * 0.55).astype(np.float32)

    # "funny" -> toy marimba / xylophone: percussive one-shot, ignores note length
    length = 0.55
    n = max(1, int(length * SR))
    t = np.arange(n) / SR
    body = (
        np.sin(2 * np.pi * freq * t)
        + 0.35 * np.sin(2 * np.pi * freq * 3.9 * t)   # marimba bar overtone
        + 0.15 * np.sin(2 * np.pi * freq * 6.8 * t)
    )
    decay = np.exp(-t / 0.16).astype(np.float32)
    click = np.exp(-t / 0.004) * np.sin(2 * np.pi * freq * 8 * t) * 0.3
    return ((body * decay + click) * amp * 0.6).astype(np.float32)


def render_synth(notes, voice: str, out_path: Path) -> bool:
    import numpy as np

    if not notes:
        return False
    tail = 0.6
    total = max(end for _, end, _, _ in notes) + tail
    buf = np.zeros(int(total * SR) + 1, dtype=np.float32)
    for start, end, note, vel in notes:
        freq = 440.0 * 2 ** ((note - 69) / 12.0)
        wave_arr = render_note_synth(voice, freq, max(0.05, end - start), vel)
        i = int(start * SR)
        j = min(len(buf), i + len(wave_arr))
        buf[i:j] += wave_arr[: j - i]
    peak = float(np.max(np.abs(buf))) or 1.0
    buf = np.tanh(buf / peak * 1.1) * 0.92
    write_wav(out_path, buf)
    return True


def write_wav(path: Path, samples) -> None:
    import numpy as np

    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# --- fluidsynth renderer ---------------------------------------------------
def find_soundfont(style_cfg: dict) -> Path | None:
    if style_cfg.get("soundfont"):
        p = Path(style_cfg["soundfont"]).expanduser()
        return p if p.exists() else None
    env = os.environ.get("GERF_SOUNDFONT")
    if env and Path(env).expanduser().exists():
        return Path(env).expanduser()
    if SOUNDFONT_DIR.is_dir():
        for sf in sorted(SOUNDFONT_DIR.glob("*.sf2")):
            return sf
    for guess in (
        "/usr/share/sounds/sf2/FluidR3_GM.sf2",
        "/usr/share/soundfonts/FluidR3_GM.sf2",
        "/opt/homebrew/share/fluid-synth/sf2/FluidR3_GM.sf2",
    ):
        if Path(guess).exists():
            return Path(guess)
    return None


def remap_program(mid, program: int):
    import mido

    out = mido.MidiFile(ticks_per_beat=mid.ticks_per_beat)
    for track in mid.tracks:
        channels = {m.channel for m in track if m.type == "note_on"}
        new = mido.MidiTrack()
        for ch in sorted(channels):
            new.append(mido.Message("program_change", program=program, channel=ch, time=0))
        for m in track:
            if m.type == "program_change":
                continue
            new.append(m.copy())
        out.tracks.append(new)
    return out


def render_fluidsynth(mid_path: Path, style_cfg: dict, out_path: Path) -> bool:
    import mido

    soundfont = find_soundfont(style_cfg)
    if soundfont is None:
        raise RuntimeError(
            "No SoundFont found. Set $GERF_SOUNDFONT to a .sf2 file or drop one "
            "in scripts/soundfonts/ (see README)."
        )
    mid = remap_program(mido.MidiFile(mid_path), style_cfg["gm_program"])
    with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        mid.save(tmp_path)
        cmd = [
            "fluidsynth", "-ni", "-g", "1.0",
            "-F", str(out_path), "-r", str(SR),
            str(soundfont), str(tmp_path),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0 or not out_path.exists():
            sys.stderr.write(res.stderr)
            return False
        return True
    finally:
        tmp_path.unlink(missing_ok=True)


# --- Renderer selection ----------------------------------------------------
def choose_renderer(requested: str) -> str:
    have_fluid = shutil.which("fluidsynth") is not None
    have_sf = any(find_soundfont(cfg) for cfg in STYLES.values())
    if requested == "fluidsynth":
        if not have_fluid:
            sys.exit("ERROR: --renderer fluidsynth but `fluidsynth` is not on PATH.")
        return "fluidsynth"
    if requested == "synth":
        return "synth"
    # auto
    if have_fluid and have_sf:
        return "fluidsynth"
    if have_fluid and not have_sf:
        print("fluidsynth found but no SoundFont — using built-in synth. "
              "Set $GERF_SOUNDFONT for higher-quality output.")
    return "synth"


# --- Main ------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description="Render styled wavs from original MIDI files.")
    ap.add_argument("--renderer", choices=["auto", "fluidsynth", "synth"], default="auto")
    ap.add_argument("--force", action="store_true", help="overwrite existing styled wavs")
    ap.add_argument("--validate", action="store_true", help="print counts only, render nothing")
    args = ap.parse_args()

    if not ORIGINAL_DIR.is_dir():
        sys.exit(f"ERROR: {ORIGINAL_DIR} does not exist.")

    if args.validate:
        print_summary()
        return 0

    for cfg in STYLES.values():
        (AUDIO_DIR / cfg["folder"]).mkdir(parents=True, exist_ok=True)

    renderer = choose_renderer(args.renderer)
    print(f"Renderer: {renderer}")

    pairs = find_pairs()
    rendered = skipped_nomidi = skipped_exists = failed = 0

    for base, _wav, mid in pairs:
        if mid is None:
            print(f"  SKIP  (no midi)  {base}")
            skipped_nomidi += 1
            continue

        notes = parse_notes(mid) if renderer == "synth" else None
        if renderer == "synth" and not notes:
            print(f"  SKIP  (empty midi)  {base}")
            skipped_nomidi += 1
            continue

        for name, cfg in STYLES.items():
            out_path = AUDIO_DIR / cfg["folder"] / f"{base}.wav"
            if out_path.exists() and not args.force:
                skipped_exists += 1
                continue
            try:
                if renderer == "fluidsynth":
                    ok = render_fluidsynth(mid, cfg, out_path)
                else:
                    ok = render_synth(notes, cfg["voice"], out_path)
            except Exception as exc:  # noqa: BLE001
                print(f"  FAIL  {name:<10} {base}: {exc}")
                failed += 1
                continue
            if ok:
                print(f"  OK    {name:<10} {base}.wav")
                rendered += 1
            else:
                print(f"  FAIL  {name:<10} {base}")
                failed += 1

    print(f"\nRendered {rendered}, skipped-no-midi {skipped_nomidi}, "
          f"skipped-existing {skipped_exists}, failed {failed}.")
    print_summary()
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
