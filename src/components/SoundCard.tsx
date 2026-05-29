import { useEffect, useRef, useState, type DragEvent } from "react";
import type { SoundDefinition } from "../types/audio";

interface SoundCardProps {
  sound: SoundDefinition;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onAdd: () => void;
}

// Derive a friendly rhythm from the recording id: number of serotonin "peaks",
// or a wiggly "noise" signal — mirrors the prototype's rhythm icons.
type Pattern = number | "noise";
const getPattern = (id: string): Pattern => {
  const m = id.match(/(\d)\s*peak/i);
  if (m) return Number(m[1]);
  if (/noise/i.test(id)) return "noise";
  if (/peak/i.test(id)) return 3;
  return "noise";
};

const patternLabel = (p: Pattern): string =>
  p === "noise" ? "wiggly signal" : `${p} beat${p > 1 ? "s" : ""}`;

const Rhythm = ({ pattern, category }: { pattern: Pattern; category: string }) => (
  <span className={`rhythm rhythm--${category}`} aria-hidden>
    {pattern === "noise" ? (
      <svg className="rhythm__wave" viewBox="0 0 30 18">
        <path d="M1 9 q3 -8 6 0 t6 0 t6 0 t6 0" />
      </svg>
    ) : (
      Array.from({ length: pattern }).map((_, i) => (
        <span key={i} className="rhythm__dot" />
      ))
    )}
  </span>
);

const SoundCard = ({ sound, onDragStart, onAdd }: SoundCardProps) => {
  const [justAdded, setJustAdded] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleAdd = () => {
    onAdd();
    setJustAdded(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setJustAdded(false), 800);
  };

  const pattern = getPattern(sound.id);

  return (
    <div
      className={`sound-card sound-card--${sound.category}`}
      draggable
      onDragStart={onDragStart}
      title={sound.fileName}
    >
      <Rhythm pattern={pattern} category={sound.category} />
      <div className="sound-card__body">
        <span className="sound-card__name">{sound.displayName}</span>
        <span className="sound-card__meta">{patternLabel(pattern)}</span>
      </div>
      <button
        type="button"
        className={`sound-card__add ${justAdded ? "is-added" : ""}`}
        onClick={handleAdd}
        aria-label={`Add ${sound.displayName}`}
      >
        {justAdded ? "Added ✓" : "＋ Add"}
      </button>
    </div>
  );
};

export default SoundCard;
