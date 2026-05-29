import { useState, type DragEvent } from "react";
import Clip from "./Clip";
import SirToneMascot from "./SirToneMascot";
import type { TrackId, TrackModel } from "../types/audio";

interface TrackProps {
  track: TrackModel;
  progressByClipId: Record<string, number>;
  onDropSound: (trackId: TrackId, soundId: string) => void;
  onRemoveClip: (trackId: TrackId, clipId: string) => void;
  onToggleMute: (trackId: TrackId) => void;
  onOpenLibrary: (trackId: TrackId) => void;
}

const STAGE_INFO: Record<TrackId, { title: string; sub: string; face: string }> = {
  brain: { title: "BRAIN", sub: "thinking signals", face: "🧠" },
  gut: { title: "GUT", sub: "gut feelings", face: "🦠" },
};

const Track = ({
  track,
  progressByClipId,
  onDropSound,
  onRemoveClip,
  onToggleMute,
  onOpenLibrary,
}: TrackProps) => {
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

  const info = STAGE_INFO[track.id];
  const isSinging = track.clips.some((c) => c.state === "playing");
  const muted = track.muted ?? false;

  return (
    <section className={`stage stage--${track.id} ${isSinging ? "is-singing" : ""}`}>
      <div className="stage__head">
        <SirToneMascot cat={track.id} singing={isSinging} size="sm" />
        <div className="stage__head-text">
          <h2 className="stage__name">
            <span className="stage__badge" aria-hidden>{info.face}</span>
            {info.title}
          </h2>
          <div className="stage__sub">{info.sub}</div>
        </div>
        <button
          type="button"
          className={`onoff ${muted ? "is-off" : ""}`}
          onClick={() => onToggleMute(track.id)}
          aria-pressed={muted}
          title={muted ? "Unmute" : "Mute"}
        >
          <span className="onoff__icon" aria-hidden>{muted ? "🔇" : "🔊"}</span>
          {muted ? "OFF" : "ON"}
        </button>
      </div>

      <div className="tray-wrap">
        <div className="tray-label">
          My song
          <span className="tray-label__count">{track.clips.length}</span>
        </div>
        <div
          className={`track-lane ${track.clips.length === 0 ? "is-empty" : ""} ${
            isOver ? "is-over" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {track.clips.length === 0 ? (
            <button
              type="button"
              className="track-placeholder"
              onClick={() => onOpenLibrary(track.id)}
            >
              <span className="track-placeholder__icon" aria-hidden>＋</span>
              Add {track.name} sounds
              <span className="track-placeholder__hint">tap, or drag from the library</span>
            </button>
          ) : (
            <>
              {track.clips.map((clip, index) => (
                <Clip
                  key={clip.id}
                  clip={clip}
                  index={index}
                  trackId={track.id}
                  progress={progressByClipId[clip.id] ?? 0}
                  onRemove={(clipId) => onRemoveClip(track.id, clipId)}
                />
              ))}
              <button
                type="button"
                className="lane-add"
                onClick={() => onOpenLibrary(track.id)}
                aria-label={`Add more ${track.name} sounds`}
                title={`Add more ${track.name} sounds`}
              >
                ＋
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Track;
