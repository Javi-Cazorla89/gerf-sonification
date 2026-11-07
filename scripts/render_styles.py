#!/usr/bin/env python3
"""
Batch-render styled WAVs from the MIDI files in public/audio/original/.

For every `<base>.wav` in public/audio/original/ this looks for a matching
`<base>.mid` and renders three styled versions using the SAME base filename:

    public/audio/strings/<base>.wav      -> string ensemble
    public/audio/electronic/<base>.wav   -> calm yoga/meditation ambient pad
    public/audio/funny/<base>.wav        -> cartoon speaking voice

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

Voices (built-in synth):
    strings    - smooth sustained string pad (no vibrato/detune warble)
    electronic - calm yoga/meditation pad: warm sine/triangle tones with a soft
                 attack, long release, gentle chorus warmth, a very light
                 shimmer and a subtle multi-tap reverb tail. Deliberately NOT a
                 sawtooth lead. Always rendered with the built-in synth (never
                 the GM sawtooth program), regardless of the selected renderer.
    funny      - cartoon speaking voice: formant-shaped "wah/doo/bop/yah"
                 babble that follows the note pitch with a scoop + vibrato
                 (deliberately NOT xylophone/marimba/bells). Always used for
                 the funny style, even under the fluidsynth renderer.

Usage:
    python3 scripts/render_styles.py                       # render everything
    python3 scripts/render_styles.py --force                # overwrite existing wavs
    python3 scripts/render_styles.py --limit 2 --force      # preview first 2 sounds
    python3 scripts/render_styles.py --only brain_diffusion_3peaks_no-drug --force
    python3 scripts/render_styles.py --validate             # print counts, render nothing
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
        # gm_program is unused for this style: electronic ALWAYS renders via the
        # built-in calm-pad synth (see main()). Kept as a warm GM pad for
        # documentation only. GM 89 "Pad 2 (warm)" (0-indexed 88).
        "gm_program": 88,
        "voice": "electronic",
        "soundfont": None,
    },
    "funny": {
        "folder": "funny",
        "gm_program": 12,   # unused: funny always renders via the cartoon vocal synth
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


def _osc(phase, nharm: int, tilt: float, odd_only: bool = False):
    """Band-limited additive oscillator from a phase array.

    `tilt` controls the spectral rolloff: amplitude of harmonic k is 1/k**tilt,
    so a higher tilt = darker/smoother (fewer harsh upper harmonics). `odd_only`
    gives a hollow, square-ish tone; otherwise it's a saw-ish tone.
    """
    import numpy as np

    out = np.zeros_like(phase)
    step = 2 if odd_only else 1
    for k in range(1, nharm + 1, step):
        out += (1.0 / (k ** tilt)) * np.sin(k * phase)
    return out


def _smooth(x, width: int):
    """Cheap, fast lowpass (Hann moving average) to tame harshness — no IIR."""
    import numpy as np

    if width <= 1:
        return x
    k = np.hanning(width)
    k /= k.sum()
    return np.convolve(x, k, mode="same").astype(np.float32)


def _reverb(x, sr: int):
    """Subtle ambient reverb via vectorised multi-tap early reflections.

    A small set of decaying delay taps (feed-forward, so no IIR feedback to go
    unstable) plus a light lowpass gives the soft, spacious "yoga studio" tail
    used by the calm pad voice. The output is longer than the input by the
    longest tap so the tail is not clipped.
    """
    import numpy as np

    taps = [(0.037, 0.50), (0.071, 0.34), (0.113, 0.24), (0.170, 0.16),
            (0.240, 0.11), (0.310, 0.07)]
    extra = int(max(d for d, _ in taps) * sr) + 1
    out = np.zeros(len(x) + extra, dtype=np.float32)
    out[: len(x)] = x
    for delay, gain in taps:
        d = int(delay * sr)
        out[d: d + len(x)] += (gain * x).astype(np.float32)
    return _smooth(out, 9)


# --- Cartoon-voice (funny) formant tables ----------------------------------
# Vowel formants (F1, F2, F3) in Hz. Deliberately broad/cartoonish, not a real
# speaker. The funny voice glides between these to fake spoken syllables.
_VOWELS = {
    "ah": (730.0, 1090.0, 2440.0),   # open  "ah"
    "oo": (300.0, 870.0, 2240.0),    # round "oo"
    "o":  (570.0, 840.0, 2410.0),    # "aw/o"
    "ee": (270.0, 2290.0, 3010.0),   # front "ee" (used for the y-glide)
}

# One entry per cartoon syllable, cycled by note index so a clip babbles
# "wah, doo, bop, yah, wah, …" deterministically. plosive: a short noise burst
# at onset (d = brighter, b = duller); None = a smooth /w/ or /y/ glide.
_SYLLABLES = [
    ("wah", "oo", "ah", None),  # rounded -> open, scoops up
    ("doo", "oo", "oo", "d"),   # d burst -> "oo"
    ("bop", "o",  "o",  "b"),   # b burst -> "o", hard stop at the end
    ("yah", "ee", "ah", None),  # front "ee" -> open "ah"
]


def render_note_synth(voice: str, freq: float, dur: float, vel: float, idx: int = 0):
    import numpy as np

    amp = vel / 127.0

    if voice == "strings":
        # Smooth, sustained string pad. Single static pitch (NO vibrato, NO
        # detuned layers) so there is no warble/beating. Soft attack, long
        # release, gentle spectral rolloff.
        length = dur + 0.7
        n = max(1, int(length * SR))
        t = np.arange(n) / SR
        phase = 2 * np.pi * freq * t
        tone = _osc(phase, nharm=18, tilt=1.35)
        tone += 0.22 * _osc(2 * np.pi * (freq * 0.5) * t, nharm=8, tilt=1.5)  # body octave below
        tone = _smooth(tone, 5)
        env = _adsr(n, SR, a=0.28, d=0.10, s=0.90, r=0.60)
        return (tone * env * amp * 0.4).astype(np.float32)

    if voice == "electronic":
        # Calm yoga/meditation pad. Warm, soft sine/triangle tones built from a
        # few low harmonics with a steep rolloff (dark, never piercing), a gentle
        # sub-octave for body (NOT an aggressive bass), a slowly-detuned twin for
        # chorus warmth, and a very light, slowly fading octave-up shimmer. Soft
        # attack and long release so notes bloom and overlap into a wash. The
        # reverb tail is added at the mix stage (see render_synth). No sawtooth.
        length = dur + 1.4
        n = max(1, int(length * SR))
        t = np.arange(n) / SR
        phase = 2 * np.pi * freq * t
        # Warm body: fundamental + soft 2nd/3rd partials (triangle-ish, smooth).
        tone = np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.08 * np.sin(3 * phase)
        # Gentle sub-octave sine for warmth (kept low so the bass never dominates).
        tone += 0.16 * np.sin(0.5 * phase)
        # Chorus warmth: a slightly detuned twin (~0.5% sharp) gives a slow,
        # soothing beat rather than a static or warbling tone.
        tone += 0.28 * np.sin(2 * np.pi * (freq * 1.005) * t)
        # Very light shimmer: a quiet two-octaves-up sine that fades in slowly.
        shimmer = 0.045 * (1.0 - np.exp(-t / 0.9)) * np.sin(4 * phase)
        tone = _smooth(tone + shimmer, 9)  # extra lowpass smoothing = soft/warm
        env = _adsr(n, SR, a=0.45, d=0.30, s=0.85, r=0.80)
        return (tone * env * amp * 0.32).astype(np.float32)

    # "funny" -> cartoon SPEAKING voice ("wah/doo/bop/yah"), NOT xylophone/
    # marimba. A formant-shaped voiced tone follows the note's pitch with a quick
    # scoop and light vibrato, while the vowel glides start->end to fake a spoken
    # syllable. The syllable is chosen by note index so a clip babbles lively but
    # repeatably.
    name, vstart, vend, plosive = _SYLLABLES[idx % len(_SYLLABLES)]
    v0 = np.array(_VOWELS[vstart])
    v1 = np.array(_VOWELS[vend])

    # Keep every syllable short and snappy no matter how long the MIDI note is —
    # cartoon speech is punchy, not a sustained pad.
    length = min(max(dur, 0.20), 0.40) + 0.06
    n = max(1, int(length * SR))
    t = np.arange(n) / SR

    # Pitch: a quick scoop into the target note (up for open syllables, down for
    # "bop") plus a gentle vibrato that fades in. Small per-index variation keeps
    # repeated syllables from sounding identical.
    start_off = -3.0 if vstart in ("oo", "ee") else 2.0
    glide = start_off * np.exp(-t / 0.045)
    vib_freq = 5.5 + 0.4 * ((idx % 3) - 1)
    vib = 0.25 * np.sin(2 * np.pi * vib_freq * t) * (1.0 - np.exp(-t / 0.06))
    inst_f = freq * 2 ** ((glide + vib) / 12.0)
    phase = 2 * np.pi * np.cumsum(inst_f) / SR

    # Vowel gesture: glide the three formants from the start vowel to the end
    # vowel over the first ~60% of the syllable (front-loaded for a spoken feel).
    gesture = np.clip(t / (0.6 * length), 0.0, 1.0) ** 0.6
    formants = [v0[i] + (v1[i] - v0[i]) * gesture for i in range(3)]
    form_amp = (1.0, 0.7, 0.35)
    form_bw = (90.0, 110.0, 160.0)

    # Additive formant synthesis: harmonics of the (time-varying) fundamental,
    # each weighted by the formant response so the timbre reads as a vowel.
    # Cap the harmonic count to just above F3 to stay cheap and alias-free.
    kmax = int(min(60, max(8, 5000.0 / max(60.0, freq))))
    tone = np.zeros(n, dtype=np.float64)
    for k in range(1, kmax + 1):
        hk = k * inst_f  # this harmonic's instantaneous frequency
        gain = np.zeros(n)
        for fc, fa, bw in zip(formants, form_amp, form_bw):
            gain += fa * np.exp(-((hk - fc) ** 2) / (2.0 * bw * bw))
        tone += (1.0 / k) * gain * np.sin(k * phase)  # 1/k glottal source rolloff

    # Plosive onset: a short filtered-noise burst for d/b (deterministic noise).
    if plosive is not None:
        nb = min(int(0.018 * SR), n)
        rng = np.random.default_rng(1000 + idx)
        burst = _smooth(rng.standard_normal(nb).astype(np.float32),
                        5 if plosive == "d" else 11)
        tone[:nb] += 0.5 * burst * np.linspace(1.0, 0.0, nb)

    # Envelope: short attack + playful decay; "bop" ends abruptly like a /p/.
    if plosive == "b":
        env = _adsr(n, SR, a=0.010, d=0.10, s=0.42, r=0.05)
    else:
        env = _adsr(n, SR, a=0.012, d=0.09, s=0.60, r=0.10)

    tone = _smooth(tone, 3)
    out = tone * env
    peak = float(np.max(np.abs(out))) or 1.0
    return (out / peak * amp * 0.9).astype(np.float32)


def render_synth(notes, voice: str, out_path: Path) -> bool:
    import numpy as np

    if not notes:
        return False
    # The calm pad has a long release, so give it extra room before the tail is
    # truncated; its reverb then extends the buffer further (see below).
    tail = 2.0 if voice == "electronic" else 0.6
    total = max(end for _, end, _, _ in notes) + tail
    buf = np.zeros(int(total * SR) + 1, dtype=np.float32)
    for idx, (start, end, note, vel) in enumerate(notes):
        freq = 440.0 * 2 ** ((note - 69) / 12.0)
        wave_arr = render_note_synth(voice, freq, max(0.05, end - start), vel, idx)
        i = int(start * SR)
        j = min(len(buf), i + len(wave_arr))
        buf[i:j] += wave_arr[: j - i]
    # Calm pad only: a subtle reverb tail for the soft, spacious yoga feel.
    if voice == "electronic":
        buf = _reverb(buf, SR)
    # Clean linear peak-normalisation — no tanh saturation (avoids distortion).
    peak = float(np.max(np.abs(buf))) or 1.0
    buf = buf / peak * 0.9
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
    ap.add_argument("--limit", type=int, default=None,
                    help="preview: render only the first N midi-backed sounds")
    ap.add_argument("--only", action="append", default=None,
                    help="preview: render only this base name (repeatable / comma-separated)")
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

    # Preview filters --------------------------------------------------------
    if args.only:
        wanted = set()
        for item in args.only:
            for name in item.split(","):
                name = name.strip()
                if name:
                    wanted.add(name[:-4] if name.endswith(".wav") else name)
        pairs = [p for p in pairs if p[0] in wanted]
        if not pairs:
            sys.exit(f"No sounds matched --only {sorted(wanted)}")
    if args.limit is not None:
        pairs = [p for p in pairs if p[2] is not None][: args.limit]
    if args.only or args.limit is not None:
        names = ", ".join(p[0] for p in pairs)
        print(f"Preview mode — rendering {len(pairs)} sound(s): {names}")

    rendered = skipped_nomidi = skipped_exists = failed = 0

    for base, _wav, mid in pairs:
        if mid is None:
            print(f"  SKIP  (no midi)  {base}")
            skipped_nomidi += 1
            continue

        # Always parse notes: the funny cartoon voice is synthesised from them
        # even when the fluidsynth renderer handles the other styles.
        notes = parse_notes(mid)
        if not notes:
            print(f"  SKIP  (empty midi)  {base}")
            skipped_nomidi += 1
            continue

        for name, cfg in STYLES.items():
            out_path = AUDIO_DIR / cfg["folder"] / f"{base}.wav"
            if out_path.exists() and not args.force:
                skipped_exists += 1
                continue
            try:
                # Funny ALWAYS uses the built-in cartoon vocal synth, and
                # electronic ALWAYS uses the built-in calm pad — both bypass the
                # GM programs so they sound right regardless of the renderer.
                if name in ("funny", "electronic"):
                    ok = render_synth(notes, cfg["voice"], out_path)
                elif renderer == "fluidsynth":
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
