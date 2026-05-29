import Track from "./Track";
import type { TrackId, TrackModel } from "../types/audio";

interface TrackListProps {
  tracks: TrackModel[];
  progressByClipId: Record<string, number>;
  onDropSound: (trackId: TrackId, soundId: string) => void;
  onRemoveClip: (trackId: TrackId, clipId: string) => void;
  onToggleMute: (trackId: TrackId) => void;
}

const TrackList = ({
  tracks,
  progressByClipId,
  onDropSound,
  onRemoveClip,
  onToggleMute,
}: TrackListProps) => {
  return (
    <div className="panel workspace">
      <div className="panel-header">
        <p className="repeat-heading" aria-hidden>TRACKS · TRACKS · TRACKS · TRACKS · TRACKS</p>
        <p className="eyebrow">Arrangement</p>
        <h2>Tracks</h2>
      </div>
      <div className="track-list">
        {tracks.map((track) => (
          <Track
            key={track.id}
            track={track}
            progressByClipId={progressByClipId}
            onDropSound={onDropSound}
            onRemoveClip={onRemoveClip}
            onToggleMute={onToggleMute}
          />
        ))}
      </div>
    </div>
  );
};

export default TrackList;
