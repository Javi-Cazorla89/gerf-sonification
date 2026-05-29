import SirToneMascot from "./SirToneMascot";

interface HelpPanelProps {
  onClose: () => void;
}

const STEPS = [
  "Open the Sound Library and add sounds to Brain & Gut.",
  "Press the big green PLAY button.",
  "Listen — both tracks sing together! 🎶",
];

const HelpPanel = ({ onClose }: HelpPanelProps) => {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="welcome" role="dialog" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="welcome__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="welcome__hero">
          <SirToneMascot cat="brain" singing size="lg" />
        </div>
        <h2 className="welcome__title">Meet Sir Tone! 🎵</h2>
        <p className="welcome__copy">
          Sir Tone turns real serotonin signals from a <b>brain</b> and a <b>gut</b> into music.
          Help him build a song from both!
        </p>
        <div className="welcome__steps">
          {STEPS.map((step, i) => (
            <div className="welcome__step" key={i}>
              <span className="helper__num">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <button type="button" className="welcome__go" onClick={onClose}>
          Let's go!
        </button>
      </div>
    </div>
  );
};

export default HelpPanel;
