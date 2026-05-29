import type { TrackId } from "../types/audio";

interface SirToneMascotProps {
  /** Tints the disc behind Sir Tone to match the Brain (purple) or Gut (orange) card. */
  cat?: TrackId;
  /** When true, Sir Tone "conducts" (bobs/rotates) — used while a track is playing. */
  singing?: boolean;
  /** Visual size: small badge for cards, large for the hero/modal. */
  size?: "sm" | "lg";
}

// Sir Tone — the serotonin conductor mascot (asset: public/sir-tone.png).
const SirToneMascot = ({ cat = "brain", singing = false, size = "sm" }: SirToneMascotProps) => {
  return (
    <div
      className={`mascot mascot--${cat} mascot--${size} ${singing ? "is-singing" : ""}`}
      aria-hidden
    >
      <span className="mascot__disc" />
      <img className="mascot__img" src="/sir-tone.png" alt="" />
    </div>
  );
};

export default SirToneMascot;
