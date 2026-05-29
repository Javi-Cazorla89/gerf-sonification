import type { Clip as ClipModel, TrackId } from "../types/audio";

interface ClipProps {
  clip: ClipModel;
  index: number;
  trackId: TrackId;
  progress: number;
  onRemove: (clipId: string) => void;
}

const stateLabel: Record<ClipModel["state"], string> = {
  ready: "Ready",
  playing: "Playing",
  finished: "Finished",
  missing: "Missing file",
};

const Clip = ({ clip, index, trackId, progress, onRemove }: ClipProps) => {
  const isPlaying = clip.state === "playing";
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <article
      className={`clip-card clip-card--${trackId} clip-card--${clip.state} ${
        isPlaying ? "is-playing" : ""
      }`}
    >
      <span className="clip-card__index">{index + 1}</span>
      <div className="clip-card__main">
        <h4 className="clip-card__title">{clip.name}</h4>
        <span className="clip-card__state">{stateLabel[clip.state]}</span>
        <div className="clip-card__progress" aria-hidden>
          <div className="clip-card__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {isPlaying && (
        <div className="clip-card__pulse" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
      <button
        className="clip-card__remove"
        type="button"
        aria-label="Remove clip"
        onClick={() => onRemove(clip.id)}
      >
        ×
      </button>
    </article>
  );
};

export default Clip;
