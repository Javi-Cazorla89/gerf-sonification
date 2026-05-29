interface TransportControlsProps {
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  canPlay: boolean;
  canClear: boolean;
  isPlaying: boolean;
  status: string;
}

const TransportControls = ({
  onPlay,
  onStop,
  onClear,
  canPlay,
  canClear,
  isPlaying,
  status,
}: TransportControlsProps) => {
  return (
    <div className="transport">
      <div className="transport__buttons">
        <button
          className="transport__button transport__button--primary"
          onClick={onPlay}
          disabled={!canPlay || isPlaying}
          type="button"
        >
          <span className="transport__icon" aria-hidden>▶</span>
          Play
        </button>
        <button
          className="transport__button transport__button--stop"
          onClick={onStop}
          disabled={!isPlaying}
          type="button"
        >
          <span className="transport__icon" aria-hidden>■</span>
          Stop
        </button>
        <button
          className="transport__button transport__button--ghost"
          onClick={onClear}
          disabled={isPlaying || !canClear}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="transport__status">
        <span className="transport__status-label">Status</span>
        <strong className={`transport__status-value transport__status-value--${status.toLowerCase().replace(/\s+/g, "-")}`}>
          {status}
        </strong>
      </div>
    </div>
  );
};

export default TransportControls;
