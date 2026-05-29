import { SOUND_STYLES } from "../config/audio";
import type { SoundStyleId } from "../types/audio";

interface InstrumentSelectorProps {
  value: SoundStyleId;
  onChange: (value: SoundStyleId) => void;
}

// Custom pill-style segmented control — replaces the native <select>.
const InstrumentSelector = ({ value, onChange }: InstrumentSelectorProps) => {
  return (
    <div className="style-picker">
      <span className="style-picker__label">Sir Tone plays</span>
      <div className="style-seg" role="group" aria-label="Sound style">
        {SOUND_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            className={`style-opt ${value === style.id ? "is-on" : ""}`}
            aria-pressed={value === style.id}
            onClick={() => onChange(style.id)}
          >
            <span className="style-opt__icon" aria-hidden>{style.icon}</span>
            {style.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InstrumentSelector;
