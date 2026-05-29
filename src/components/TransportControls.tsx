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
  const statusClass = status.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="transport">
      <div className="transport__row">
        <button
          className="btn-big btn-clear"
          onClick={onClear}
          disabled={isPlaying || !canClear}
          type="button"
        >
          <span className="btn-big__icon" aria-hidden>↺</span> Start over
        </button>

        <button
          className={`btn-big btn-play ${isPlaying ? "is-playing" : ""}`}
          onClick={onPlay}
          disabled={!canPlay || isPlaying}
          type="button"
        >
          <span className="btn-big__icon" aria-hidden>{isPlaying ? "♪" : "▶"}</span>
          {isPlaying ? "Playing" : "PLAY"}
        </button>

        <button
          className="btn-big btn-stop"
          onClick={onStop}
          disabled={!isPlaying}
          type="button"
        >
          <span className="btn-big__icon" aria-hidden>■</span> Stop
        </button>
      </div>

      <div className={`transport__status status-pill status-pill--${statusClass}`}>
        <span className="transport__status-label">Status</span>
        <strong className="transport__status-value">{status}</strong>
      </div>
    </div>
  );
};

export default TransportControls;
