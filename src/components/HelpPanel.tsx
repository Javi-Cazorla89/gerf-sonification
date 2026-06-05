import SirToneMascot from "./SirToneMascot";

interface HelpPanelProps {
  onClose: () => void;
}

const STEPS = [
  "Open the Sound Library and add sounds to Brain, Gut, and Skin.",
  "Choose how Sir Tone plays: String Orchestra, Electronic, or Funny.",
  "Press the big green PLAY button, then watch the live signal graphs as the tracks sing together.",
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
        <h2 className="welcome__title">Meet Sir Tone!</h2>
        <p className="welcome__copy">
          Sir Tone turns real serotonin signals from the <b>brain</b>, <b>gut</b>, and <b>skin</b> into music.
          Help him build a song from all three!
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
