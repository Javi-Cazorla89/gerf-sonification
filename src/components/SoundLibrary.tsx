import { useState, type DragEvent } from "react";
import type { SoundDefinition, TrackId } from "../types/audio";
import SoundCard from "./SoundCard";

interface SoundLibraryProps {
  sounds: SoundDefinition[];
  open: boolean;
  onClose: () => void;
  onAddSound: (soundId: string) => void;
}

const TABS: { id: TrackId; label: string }[] = [
  { id: "brain", label: "Brain" },
  { id: "gut", label: "Gut" },
];

const SoundLibrary = ({ sounds, open, onClose, onAddSound }: SoundLibraryProps) => {
  const [tab, setTab] = useState<TrackId>("brain");

  const handleDragStart = (event: DragEvent<HTMLElement>, soundId: string) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", soundId);
  };

  // A sound belongs to the active tab if its category matches; unassigned sounds
  // surface under Brain so nothing is hidden.
  const items = sounds.filter((s) =>
    tab === "brain" ? s.category !== "gut" : s.category === "gut",
  );

  return (
    // The overlay is purely visual: pointer-events are disabled so native
    // drag-and-drop from the drawer can still reach the Brain / Gut cards.
    <div className={`library-overlay ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <aside
        className="library-drawer"
        role="dialog"
        aria-label="Sound Library"
        aria-modal="false"
      >
        <div className="library__head">
          <h2 className="library__title">♪ Sound Library</h2>
          <button
            type="button"
            className="library__close"
            onClick={onClose}
            aria-label="Close sound library"
          >
            ✕
          </button>
        </div>

        <div className="lib-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "is-on" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="library__hint">
          <b>Drag</b> a sound onto a card, or tap <b>Add</b> to drop it into{" "}
          {tab === "brain" ? "Brain" : "Gut"}.
        </p>

        <div className="lib-grid">
          {items.map((sound) => (
            <SoundCard
              key={sound.id}
              sound={sound}
              onDragStart={(event) => handleDragStart(event, sound.id)}
              onAdd={() => onAddSound(sound.id)}
            />
          ))}
        </div>

        <button type="button" className="library__done" onClick={onClose}>
          Done
        </button>
      </aside>
    </div>
  );
};

export default SoundLibrary;
