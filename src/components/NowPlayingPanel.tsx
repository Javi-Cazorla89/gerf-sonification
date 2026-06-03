import type { Clip, SoundStyleId, TrackId } from "../types/audio";
import SignalPlot from "./SignalPlot";

interface NowPlayingPanelProps {
  brain: Clip | null;
  gut: Clip | null;
  skin: Clip | null;
  progressByClipId: Record<string, number>;
  styleId: SoundStyleId;
}

const Lane = ({
  trackId,
  label,
  clip,
  progress,
  styleId,
}: {
  trackId: TrackId;
  label: string;
  clip: Clip | null;
  progress: number;
  styleId: SoundStyleId;
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
          <SignalPlot fileName={clip.fileName} styleId={styleId} trackId={trackId} />
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

const NowPlayingPanel = ({ brain, gut, skin, progressByClipId, styleId }: NowPlayingPanelProps) => {
  // Resolve each lane's progress from the PLAYING clip instance id (clip.id) —
  // the same key App writes in its progress loop. Never sound/library id.
  const brainProgress = brain ? progressByClipId[brain.id] ?? 0 : 0;
  const gutProgress = gut ? progressByClipId[gut.id] ?? 0 : 0;
  const skinProgress = skin ? progressByClipId[skin.id] ?? 0 : 0;

  return (
    <div className="panel now-playing">
      <div className="panel-header">
        <p className="repeat-heading" aria-hidden>
          NOW PLAYING
        </p>
        <p className="eyebrow">Now Playing</p>
        <h2>Live Signal</h2>
      </div>
      <div className="np-lanes">
        <Lane
          trackId="brain"
          label="Brain"
          clip={brain}
          progress={brainProgress}
          styleId={styleId}
        />
        <Lane
          trackId="gut"
          label="Gut"
          clip={gut}
          progress={gutProgress}
          styleId={styleId}
        />
        <Lane
          trackId="skin"
          label="Skin"
          clip={skin}
          progress={skinProgress}
          styleId={styleId}
        />
      </div>
      {/* TODO: when .mid files are loaded, render note-level events here using midiPath. */}
    </div>
  );
};

export default NowPlayingPanel;
