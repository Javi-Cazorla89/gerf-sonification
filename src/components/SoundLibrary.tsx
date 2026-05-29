import type { DragEvent } from "react";
import type { SoundCategory, SoundDefinition } from "../types/audio";
import SoundCard from "./SoundCard";

interface SoundLibraryProps {
  sounds: SoundDefinition[];
}

const GROUPS: { id: SoundCategory; label: string; accent: string }[] = [
  { id: "brain", label: "Brain", accent: "brain" },
  { id: "gut", label: "Gut", accent: "gut" },
  { id: "unassigned", label: "Unassigned", accent: "neutral" },
];

const SoundLibrary = ({ sounds }: SoundLibraryProps) => {
  const handleDragStart = (event: DragEvent<HTMLElement>, soundId: string) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", soundId);
  };

  return (
    <aside className="panel sidebar">
      <div className="panel-header">
        <p className="repeat-heading" aria-hidden>
          SOUNDS · SOUNDS · SOUNDS · SOUNDS
        </p>
        <p className="eyebrow">Library</p>
        <h2>Sounds</h2>
      </div>

      <div className="sound-groups">
        {GROUPS.map((group) => {
          const items = sounds.filter((sound) => sound.category === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className={`sound-group sound-group--${group.accent}`}>
              <div className="sound-group__title">
                <span className={`pill pill--${group.accent}`}>{group.label}</span>
                <span className="sound-group__count">{items.length}</span>
              </div>
              <div className="sound-list">
                {items.map((sound) => (
                  <SoundCard
                    key={sound.id}
                    sound={sound}
                    onDragStart={(event) => handleDragStart(event, sound.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default SoundLibrary;
