import { INSTRUMENTS } from "../config/audio";
import type { InstrumentId } from "../types/audio";

interface InstrumentSelectorProps {
  value: InstrumentId;
  onChange: (value: InstrumentId) => void;
}

const InstrumentSelector = ({ value, onChange }: InstrumentSelectorProps) => {
  return (
    <label className="instrument-selector">
      <span>Instrument</span>
      <select value={value} onChange={(event) => onChange(event.target.value as InstrumentId)}>
        {INSTRUMENTS.map((instrument) => (
          <option key={instrument.id} value={instrument.id} disabled={!instrument.enabled}>
            {instrument.enabled ? instrument.name : `${instrument.name} (coming soon)`}
          </option>
        ))}
      </select>
    </label>
  );
};

export default InstrumentSelector;
