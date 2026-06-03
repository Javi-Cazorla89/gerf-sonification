#!/usr/bin/env python3
"""
Generate deterministic, synthetic FSCV-like signal traces for every audio clip.

These are NOT real lab recordings. They are precomputed, reproducible time
series derived from each clip's MIDI/WAV metadata so the Now Playing panel can
draw a realistic-looking biological signal instead of fake equalizer bars.

For every `<base>.wav` in public/audio/original/ this:
  1. Finds the matching `<base>.mid` (if present) and parses note start times,
     pitches, velocities and durations.
  2. Infers biological modifiers from filename tokens
     (brain/gut/skin, peaks, noise, frequent, no-/pre-/post-drug).
  3. Builds an FSCV-like trace from rise-decay peaks (one per MIDI note, or
     synthesised from tokens when no MIDI exists), slow baseline drift and a
     little smoothed noise.
  4. Downsamples to ~250 points and writes compact JSON to
        public/signals/original/<base>.json
  5. Writes a matching (style-tinted, still deterministic) JSON for each of
     strings / electronic / funny so every style folder has a signal file.

Determinism: every trace is seeded from a stable hash of "<base>|<style>", so
re-running always reproduces byte-identical output. No wall-clock / no os RNG.

Usage:
    python3 scripts/generate_synthetic_signals.py            # skip existing
    python3 scripts/generate_synthetic_signals.py --force    # overwrite
    python3 scripts/generate_synthetic_signals.py --only brain_diffusion_noise_no-drug
    python3 scripts/generate_synthetic_signals.py --limit 3 --force
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

# --- Paths -----------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"
ORIGINAL_DIR = AUDIO_DIR / "original"
SIGNALS_DIR = REPO_ROOT / "public" / "signals"

STYLES = ["original", "strings", "electronic", "funny"]

# Internal sampling resolution before downsampling to the export grid.
SAMPLE_RATE = 200.0          # samples/sec used while building the trace
TARGET_POINTS = 250          # exported points (req: ~200-300)
MIN_DURATION = 6.0           # seconds, used when no MIDI is available
MAX_DURATION = 40.0          # clamp pathological MIDI lengths


# --- Determinism -----------------------------------------------------------
def stable_seed(*parts: str) -> int:
    """A process-independent 32-bit seed from the given strings."""
    h = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return int(h[:8], 16)


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
    for (_, note), (start, vel) in active.items():
        notes.append((start, t + 0.4, note, vel))
    notes.sort(key=lambda n: n[0])
    return notes


# --- Filename -> biological modifiers --------------------------------------
def infer_modifiers(base: str) -> dict:
    """Infer FSCV-shaping modifiers from filename tokens. Pure + documented so
    the values land in the JSON `generation` block for traceability."""
    lower = base.lower()

    if "brain" in lower:
        tissue = "brain"
    elif "gut" in lower:
        tissue = "gut"
    elif "skin" in lower:
        tissue = "skin"
    else:
        tissue = "unknown"

    if "post-drug" in lower:
        drug = "post-drug"
    elif "pre-drug" in lower:
        drug = "pre-drug"
    elif "no-drug" in lower:
        drug = "no-drug"
    else:
        drug = "none"

    # Per-tissue baseline character. Brain = sharp serotonergic transients,
    # gut = slower enterochromaffin releases, skin = low, smooth activity.
    tissue_cfg = {
        "brain":   dict(tau_rise=0.06, tau_decay=0.55, baseline=0.12, amp=1.00),
        "gut":     dict(tau_rise=0.12, tau_decay=1.10, baseline=0.16, amp=0.85),
        "skin":    dict(tau_rise=0.18, tau_decay=1.60, baseline=0.20, amp=0.55),
        "unknown": dict(tau_rise=0.10, tau_decay=0.80, baseline=0.15, amp=0.80),
    }[tissue]

    noisy = "noise" in lower
    frequent = "frequent" in lower

    # Drug state nudges baseline + amplitude (post-drug = stronger evoked release).
    drug_amp = {"post-drug": 1.20, "pre-drug": 0.85, "no-drug": 1.0, "none": 1.0}[drug]
    drug_baseline = {"post-drug": 0.05, "pre-drug": -0.02, "no-drug": 0.0, "none": 0.0}[drug]

    return {
        "tissue": tissue,
        "drug": drug,
        "noisy": noisy,
        "frequent": frequent,
        "tau_rise": tissue_cfg["tau_rise"],
        "tau_decay": tissue_cfg["tau_decay"],
        "baseline": round(tissue_cfg["baseline"] + drug_baseline, 4),
        "peak_amp": round(tissue_cfg["amp"] * drug_amp, 4),
        "noise_level": 0.045 if noisy else 0.018,
    }


# --- Synthetic events when there is no MIDI --------------------------------
def synth_events(base: str, mods: dict, rng: np.random.Generator) -> list[tuple[float, float, float]]:
    """Fabricate (start_s, amp01, decay_scale) events from filename tokens when
    no MIDI is available. Peak count is read from a `<n>peak(s)` token, else a
    sensible default driven by `frequent`."""
    lower = base.lower()
    n_peaks = 2
    for token in lower.replace("-", "_").split("_"):
        if token.endswith("peak") or token.endswith("peaks"):
            digits = "".join(ch for ch in token if ch.isdigit())
            if digits:
                n_peaks = int(digits)
    if mods["frequent"]:
        n_peaks = max(n_peaks, 6)
    if mods["noisy"]:
        n_peaks = max(n_peaks, 4)

    duration = max(MIN_DURATION, n_peaks * 1.6)
    events: list[tuple[float, float, float]] = []
    for i in range(n_peaks):
        # Even spacing with a small deterministic jitter.
        center = (i + 0.5) / n_peaks * duration
        center += float(rng.normal(0.0, 0.15))
        amp = float(np.clip(rng.normal(0.8, 0.15), 0.35, 1.0))
        decay_scale = float(np.clip(rng.normal(1.0, 0.2), 0.5, 1.8))
        events.append((max(0.0, center), amp, decay_scale))
    return events


def events_from_notes(
    notes: list[tuple[float, float, int, int]]
) -> tuple[list[tuple[float, float, float]], float]:
    """Map MIDI notes -> (start_s, amp01, decay_scale) events + duration."""
    if not notes:
        return [], 0.0
    end = max(n[1] for n in notes)
    duration = float(np.clip(end + 0.6, MIN_DURATION, MAX_DURATION))
    events: list[tuple[float, float, float]] = []
    for start, note_end, _pitch, vel in notes:
        amp = float(np.clip(vel / 127.0, 0.2, 1.0))
        note_len = max(0.05, note_end - start)
        # Longer notes -> slower decay (a more sustained release).
        decay_scale = float(np.clip(0.6 + note_len * 0.6, 0.5, 2.2))
        events.append((float(start), amp, decay_scale))
    return events, duration


# --- Trace synthesis -------------------------------------------------------
def smooth(x: np.ndarray, win: int) -> np.ndarray:
    """Simple odd-window moving average (edge-padded)."""
    if win < 2:
        return x
    if win % 2 == 0:
        win += 1
    pad = win // 2
    padded = np.pad(x, pad, mode="edge")
    kernel = np.ones(win, dtype=np.float64) / win
    return np.convolve(padded, kernel, mode="valid")


def build_trace(
    events: list[tuple[float, float, float]],
    duration: float,
    mods: dict,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    """Return (t, y). y is normalised to ~[0,1]."""
    n = max(2, int(duration * SAMPLE_RATE))
    t = np.linspace(0.0, duration, n)
    y = np.full(n, mods["baseline"], dtype=np.float64)

    tau_rise = mods["tau_rise"]
    tau_decay = mods["tau_decay"]

    for start, amp01, decay_scale in events:
        local_decay = tau_decay * decay_scale
        dt = t - start
        mask = dt >= 0
        # Rise-decay kernel: fast rise, exponential tail (classic FSCV transient).
        kernel = np.zeros(n, dtype=np.float64)
        kernel[mask] = (1.0 - np.exp(-dt[mask] / tau_rise)) * np.exp(-dt[mask] / local_decay)
        if kernel.max() > 0:
            kernel /= kernel.max()
        y += mods["peak_amp"] * amp01 * kernel

    # Slow baseline drift: sum of a couple of low-frequency sines with random phase.
    drift = np.zeros(n, dtype=np.float64)
    for freq, weight in ((0.05, 0.06), (0.12, 0.03)):
        phase = float(rng.uniform(0, 2 * np.pi))
        drift += weight * np.sin(2 * np.pi * freq * t + phase)
    y += drift

    # Small smoothed measurement noise.
    noise = rng.normal(0.0, mods["noise_level"], n)
    noise = smooth(noise, int(SAMPLE_RATE * 0.05))  # ~50 ms correlation
    y += noise

    # Normalise to a stable [0,1]-ish range for the SVG plot (pad the extremes).
    lo, hi = float(y.min()), float(y.max())
    if hi - lo < 1e-6:
        y = np.full(n, 0.5)
    else:
        y = (y - lo) / (hi - lo)
        y = 0.04 + y * 0.92
    return t, y


def downsample(t: np.ndarray, y: np.ndarray, target: int) -> tuple[np.ndarray, np.ndarray]:
    if len(t) <= target:
        return t, y
    idx = np.linspace(0, len(t) - 1, target).round().astype(int)
    idx = np.unique(idx)
    return t[idx], y[idx]


def select_peaks(t: np.ndarray, y: np.ndarray, drug: str, max_peaks: int = 8) -> list[dict]:
    """Pick the most prominent transients (local maxima) for the peaks[] export.
    Computed on the already-downsampled arrays so the t/y match the points[]."""
    n = len(t)
    peaks: list[dict] = []
    for i in range(1, n - 1):
        if y[i] >= y[i - 1] and y[i] > y[i + 1] and y[i] > 0.45:
            peaks.append({"t": round(float(t[i]), 3), "y": round(float(y[i]), 4)})
    peaks.sort(key=lambda p: p["y"], reverse=True)
    peaks = peaks[:max_peaks]
    peaks.sort(key=lambda p: p["t"])
    label = {"post-drug": "post-drug", "pre-drug": "pre-drug", "no-drug": "peak"}.get(
        drug, "peak"
    )
    for k, p in enumerate(peaks):
        p["label"] = f"{label} {k + 1}" if len(peaks) > 1 else label
    return peaks


# --- Per-file generation ---------------------------------------------------
def style_modifiers(mods: dict, style: str) -> dict:
    """Apply a subtle, deterministic per-style tint so each style folder gets a
    distinct-but-related trace. The biology is the same; the musical style only
    nudges noise/amp slightly."""
    out = dict(mods)
    tint = {
        "original":   dict(amp=1.00, noise=1.00),
        "strings":    dict(amp=1.04, noise=0.85),
        "electronic": dict(amp=1.10, noise=1.20),
        "funny":      dict(amp=0.96, noise=1.10),
    }[style]
    out["peak_amp"] = round(mods["peak_amp"] * tint["amp"], 4)
    out["noise_level"] = round(mods["noise_level"] * tint["noise"], 4)
    out["style"] = style
    return out


def generate_one(base: str, style: str, notes: list, has_midi: bool) -> dict:
    mods = infer_modifiers(base)
    mods = style_modifiers(mods, style)
    rng = np.random.default_rng(stable_seed(base, style))

    if has_midi and notes:
        events, duration = events_from_notes(notes)
        source = f"{base}.mid"
    else:
        events = synth_events(base, mods, rng)
        duration = max(MIN_DURATION, (max((e[0] for e in events), default=MIN_DURATION)) + 1.5)
        source = f"{base}.wav"

    t, y = build_trace(events, duration, mods, rng)
    t_ds, y_ds = downsample(t, y, TARGET_POINTS)
    peaks = select_peaks(t_ds, y_ds, mods["drug"])

    points = [{"t": round(float(ti), 3), "y": round(float(yi), 4)} for ti, yi in zip(t_ds, y_ds)]

    return {
        "synthetic": True,
        "sourceFile": source,
        "style": style,
        "durationSec": round(float(duration), 3),
        "pointCount": len(points),
        "points": points,
        "peaks": peaks,
        "generation": {
            "seed": stable_seed(base, style),
            "sampleRate": SAMPLE_RATE,
            "targetPoints": TARGET_POINTS,
            "eventSource": "midi" if (has_midi and notes) else "filename-tokens",
            "eventCount": len(events),
            "modifiers": mods,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="overwrite existing JSON")
    parser.add_argument("--only", help="base name (no extension) to generate just one")
    parser.add_argument("--limit", type=int, help="process at most N wavs")
    args = parser.parse_args()

    if not ORIGINAL_DIR.is_dir():
        print(f"ERROR: {ORIGINAL_DIR} not found", file=sys.stderr)
        return 1

    wavs = sorted(ORIGINAL_DIR.glob("*.wav"))
    if args.only:
        wavs = [w for w in wavs if w.stem == args.only]
    if args.limit:
        wavs = wavs[: args.limit]

    if not wavs:
        print("No matching wavs.", file=sys.stderr)
        return 1

    written = skipped = 0
    for wav in wavs:
        base = wav.stem
        mid = ORIGINAL_DIR / f"{base}.mid"
        has_midi = mid.is_file()
        notes = parse_notes(mid) if has_midi else []
        src = "midi" if has_midi else "filename-tokens"
        print(f"• {base}  ({len(notes)} notes, source={src})")

        for style in STYLES:
            out_dir = SIGNALS_DIR / style
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{base}.json"
            if out_path.exists() and not args.force:
                skipped += 1
                continue
            data = generate_one(base, style, notes, has_midi)
            out_path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
            written += 1

    print(f"\nDone. wrote={written} skipped={skipped} (styles={', '.join(STYLES)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
