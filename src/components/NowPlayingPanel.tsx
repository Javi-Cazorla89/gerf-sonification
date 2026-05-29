import type { Clip, TrackId } from "../types/audio";

interface NowPlayingPanelProps {
  brain: Clip | null;
  gut: Clip | null;
  progressByClipId: Record<string, number>;
}

const Lane = ({
  trackId,
  label,
  clip,
  progress,
}: {
  trackId: TrackId;
  label: string;
  clip: Clip | null;
  progress: number;
}) => {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div className={`np-lane np-lane--${trackId} ${clip ? "is-active" : ""}`}>
      <div className="np-lane__head">
        <span className={`pill pill--${trackId}`}>{label}</span>
        <span className="np-lane__title">{clip ? clip.name : "—"}</span>
      </div>
      <div className="np-lane__visual">
        {clip ? (
          <div className="np-pulse" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : (
          <span className="np-lane__idle">Idle</span>
        )}
      </div>
      <div className="np-lane__bar">
        <div className="np-lane__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const NowPlayingPanel = ({ brain, gut, progressByClipId }: NowPlayingPanelProps) => {
  return (
    <div className="panel now-playing">
      <div className="panel-header">
        <p className="repeat-heading" aria-hidden>
          NOW PLAYING · NOW PLAYING · NOW PLAYING
        </p>
        <p className="eyebrow">Now Playing</p>
        <h2>Live Signal</h2>
      </div>
      <div className="np-lanes">
        <Lane
          trackId="brain"
          label="Brain"
          clip={brain}
          progress={brain ? progressByClipId[brain.id] ?? 0 : 0}
        />
        <Lane
          trackId="gut"
          label="Gut"
          clip={gut}
          progress={gut ? progressByClipId[gut.id] ?? 0 : 0}
        />
      </div>
      {/* TODO: when .mid files are loaded, render note-level events here using midiPath. */}
    </div>
  );
};

export default NowPlayingPanel;
