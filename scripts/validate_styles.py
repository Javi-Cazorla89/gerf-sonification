#!/usr/bin/env python3
"""
Quick validation of the folder-based audio styles. No dependencies.

Prints:
  - how many original wavs exist
  - how many have a matching midi
  - how many strings / electronic / funny wavs were generated
  - per-style coverage vs the wavs that have a midi

Usage:
    python3 scripts/validate_styles.py
"""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"
ORIGINAL_DIR = AUDIO_DIR / "original"
STYLE_FOLDERS = ["strings", "electronic", "funny"]


def main() -> int:
    if not ORIGINAL_DIR.is_dir():
        print(f"ERROR: {ORIGINAL_DIR} does not exist.")
        return 1

    originals = sorted(ORIGINAL_DIR.glob("*.wav"))
    bases = [w.stem for w in originals]
    with_midi = [b for b in bases if (ORIGINAL_DIR / f"{b}.mid").exists()]

    print("=== Audio style validation ===")
    print(f"original wavs        : {len(originals)}")
    print(f"matching midi files  : {len(with_midi)}")
    print(f"wavs without midi    : {len(bases) - len(with_midi)}")
    print("-" * 31)

    for folder in STYLE_FOLDERS:
        d = AUDIO_DIR / folder
        styled = sorted(d.glob("*.wav")) if d.is_dir() else []
        styled_bases = {w.stem for w in styled}
        covered = sum(1 for b in with_midi if b in styled_bases)
        print(f"{folder:<12} wavs : {len(styled):>2}   "
              f"(covers {covered}/{len(with_midi)} midi-backed)")
    print("=" * 31)

    missing = [b for b in with_midi
               if not all((AUDIO_DIR / f / f"{b}.wav").exists() for f in STYLE_FOLDERS)]
    if missing:
        print(f"{len(missing)} midi-backed sound(s) not fully rendered:")
        for b in missing:
            print(f"  - {b}")
        print("Run: python3 scripts/render_styles.py")
    else:
        print("All midi-backed sounds are fully rendered in every style.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
