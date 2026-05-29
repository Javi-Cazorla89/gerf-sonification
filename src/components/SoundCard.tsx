import type { DragEvent } from "react";
import type { SoundDefinition } from "../types/audio";

interface SoundCardProps {
  sound: SoundDefinition;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
}

const SoundCard = ({ sound, onDragStart }: SoundCardProps) => {
  return (
    <div
      className={`sound-card sound-card--${sound.category}`}
      draggable
      onDragStart={onDragStart}
      title={sound.fileName}
    >
      <span className="sound-card__dot" aria-hidden />
      <div className="sound-card__body">
        <span className="sound-card__name">{sound.displayName}</span>
        <span className="sound-card__meta">
          {sound.midiPath ? "wav + mid" : "wav"}
        </span>
      </div>
    </div>
  );
};

export default SoundCard;
