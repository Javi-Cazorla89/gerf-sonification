import Track from "./Track";
import type { TrackId, TrackModel } from "../types/audio";

interface TrackListProps {
  tracks: TrackModel[];
  progressByClipId: Record<string, number>;
  onDropSound: (trackId: TrackId, soundId: string) => void;
  onRemoveClip: (trackId: TrackId, clipId: string) => void;
  onToggleMute: (trackId: TrackId) => void;
  onOpenLibrary: (trackId: TrackId) => void;
}

const TrackList = ({
  tracks,
  progressByClipId,
  onDropSound,
  onRemoveClip,
  onToggleMute,
  onOpenLibrary,
}: TrackListProps) => {
  return (
    <div className="studio">
      {tracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          progressByClipId={progressByClipId}
          onDropSound={onDropSound}
          onRemoveClip={onRemoveClip}
          onToggleMute={onToggleMute}
          onOpenLibrary={onOpenLibrary}
        />
      ))}
    </div>
  );
};

export default TrackList;
