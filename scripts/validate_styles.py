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

# Mirrors inferCategory() in src/config/audio.ts (brain, then skin, then gut).
BRAIN_TOKENS = ["brain", "neuron", "neural", "raphe", "stem", "serotonergic"]
SKIN_TOKENS = ["skin", "dermal", "epidermis", "tissue", "skin_organoid", "skin-cell", "skin_cell"]
GUT_TOKENS = ["gut", "organoid", "intestinal", "enterochromaffin", "zb"]


def category(base: str) -> str:
    lower = base.lower()
    if any(tok in lower for tok in BRAIN_TOKENS):
        return "brain"
    if any(tok in lower for tok in SKIN_TOKENS):
        return "skin"
    if any(tok in lower for tok in GUT_TOKENS):
        return "gut"
    return "unassigned"


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

    # Per-category breakdown (Brain / Gut / Skin).
    print("-" * 31)
    print("by category (wav / with-midi):")
    for cat in ("brain", "gut", "skin", "unassigned"):
        cat_bases = [b for b in bases if category(b) == cat]
        if not cat_bases:
            continue
        cat_midi = [b for b in cat_bases if b in with_midi]
        print(f"  {cat:<11}: {len(cat_bases):>2} wav  / {len(cat_midi):>2} with midi")

    print("-" * 31)
    for folder in STYLE_FOLDERS:
        d = AUDIO_DIR / folder
        styled = sorted(d.glob("*.wav")) if d.is_dir() else []
        styled_bases = {w.stem for w in styled}
        covered = sum(1 for b in with_midi if b in styled_bases)
        # Per-category coverage within this style folder.
        by_cat = {}
        for cat in ("brain", "gut", "skin"):
            cat_midi = [b for b in with_midi if category(b) == cat]
            if cat_midi:
                by_cat[cat] = sum(1 for b in cat_midi if b in styled_bases)
        detail = ", ".join(f"{c} {n}/{sum(1 for b in with_midi if category(b) == c)}"
                           for c, n in by_cat.items())
        print(f"{folder:<12} wavs : {len(styled):>2}   "
              f"(covers {covered}/{len(with_midi)} midi-backed; {detail})")
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
