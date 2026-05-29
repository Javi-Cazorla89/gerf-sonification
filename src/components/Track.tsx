import { useState, type DragEvent } from "react";
import Clip from "./Clip";
import type { TrackId, TrackModel } from "../types/audio";

interface TrackProps {
  track: TrackModel;
  progressByClipId: Record<string, number>;
  onDropSound: (trackId: TrackId, soundId: string) => void;
  onRemoveClip: (trackId: TrackId, clipId: string) => void;
  onToggleMute: (trackId: TrackId) => void;
}

const Track = ({ track, progressByClipId, onDropSound, onRemoveClip, onToggleMute }: TrackProps) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsOver(false);
    const soundId = event.dataTransfer.getData("text/plain");
    if (soundId) {
      onDropSound(track.id, soundId);
    }
  };

  const repeatedName = `${track.name.toUpperCase()} · ${track.name.toUpperCase()} · ${track.name.toUpperCase()}`;
  return (
    <section className={`track-row track-row--${track.id}`}>
      <div className={`track-label track-label--${track.id}`}>
        <span className="track-label__repeat" aria-hidden>{repeatedName}</span>
        <div className="track-label__top">
          <span className={`pill pill--${track.id}`}>{track.name}</span>
          <button
            type="button"
            className={`mute-btn ${track.muted ? "is-muted" : ""}`}
            onClick={() => onToggleMute(track.id)}
            aria-pressed={track.muted ?? false}
            title={track.muted ? "Unmute" : "Mute"}
          >
            {track.muted ? "Muted" : "M"}
          </button>
        </div>
        <span className="track-label__subtitle">
          {track.clips.length} {track.clips.length === 1 ? "clip" : "clips"}
        </span>
      </div>
      <div
        className={`track-lane ${isOver ? "is-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {track.clips.length === 0 ? (
          <div className="track-placeholder">
            Drop sounds here to build the {track.name} sequence
          </div>
        ) : (
          track.clips.map((clip, index) => (
            <Clip
              key={clip.id}
              clip={clip}
              index={index}
              trackId={track.id}
              progress={progressByClipId[clip.id] ?? 0}
              onRemove={(clipId) => onRemoveClip(track.id, clipId)}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default Track;
