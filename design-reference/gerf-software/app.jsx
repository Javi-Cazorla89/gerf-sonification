// NeuroStemSound — pitch-deck restyle
// Mirrors the original React app structure but in a single file for prototype.

const { useState, useRef, useCallback, useEffect } = React;

const SOUND_LIBRARY = [
  { id: 'brain_diffusion_3peaks_no-drug', name: 'Diffusion · 3 peaks', meta: 'no drug', file: 'audio/brain_diffusion_3peaks_no-drug.wav', cat: 'brain' },
  { id: 'brain_diffusion_noise_no-drug', name: 'Diffusion · Noise', meta: 'no drug', file: 'audio/brain_diffusion_noise_no-drug.wav', cat: 'brain' },
  { id: 'brain_very-frequent_1peak_no-drug', name: 'Very frequent · 1 peak', meta: 'no drug', file: 'audio/brain_very-frequent_1peak_no-drug.wav', cat: 'brain' },
  { id: 'brain_very-frequent_2peaks_no-drug', name: 'Very frequent · 2 peaks', meta: 'no drug', file: 'audio/brain_very-frequent_2peaks_no-drug.wav', cat: 'brain' },
  { id: 'gut_organoid2_1peak_post-drug', name: 'Organoid 2 · 1 peak', meta: 'post-drug', file: 'audio/gut_organoid2_1peak_post-drug.wav', cat: 'gut' },
  { id: 'gut_organoid2_3peaks_post-drug', name: 'Organoid 2 · 3 peaks', meta: 'post-drug', file: 'audio/gut_organoid2_3peaks_post-drug.wav', cat: 'gut' },
  { id: 'gut_organoid2_low-noise_post-drug', name: 'Organoid 2 · Low noise', meta: 'post-drug', file: 'audio/gut_organoid2_low-noise_post-drug.wav', cat: 'gut' },
  { id: 'gut_organoid3_2peaks_post-drug', name: 'Organoid 3 · 2 peaks', meta: 'post-drug', file: 'audio/gut_organoid3_2peaks_post-drug.wav', cat: 'gut' },
];

const INITIAL_TRACKS = [
  { id: 'brain', name: 'Brain', subtitle: 'serotonergic neurons', muted: false, clips: [] },
  { id: 'gut',   name: 'Gut',   subtitle: 'enterochromaffin cells', muted: false, clips: [] },
];

const INSTRUMENTS = [
  { id: 'original', name: 'Original' },
  { id: 'piano', name: 'Piano' },
  { id: 'violin', name: 'Violin' },
  { id: 'synth', name: 'Synthesiser' },
];

/* ------------------------- Decorations ------------------------- */

const Note = ({ color = '#F4A33D', stem = '#4F3D9C', style }) => (
  <svg viewBox="0 0 64 88" style={style} aria-hidden="true">
    <path
      d="M22 4 L22 60 C22 60 14 56 8 64 C 2 72 8 84 18 84 C 28 84 34 76 34 66 L 34 22 L 56 16 L 56 50 C 56 50 50 46 44 54 C 38 62 44 74 54 74 C 64 74 60 56 60 56 L 60 6 Z"
      fill={color}
      stroke={stem}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  </svg>
);

const DecoNotes = () => (
  <div className="deco-notes" aria-hidden="true">
    <Note color="#F4A33D" />
    <Note color="#B9ABEB" />
    <Note color="#FFD63D" />
    <Note color="#F582C9" />
  </div>
);

const TripleTitle = ({ children }) => (
  <h3 className="trio-title">
    <span>{children}</span>
    <span>{children}</span>
    <span>{children}</span>
  </h3>
);

/* ------------------------- Hero ------------------------- */

const Hero = ({ instrumentId, onInstrumentChange }) => (
  <header className="hero">
    <div>
      <div className="eyebrow-trio">
        <span>GERF · SEROTONIN SONIFICATION</span>
        <span>GERF · SEROTONIN SONIFICATION</span>
        <span>GERF · SEROTONIN SONIFICATION</span>
      </div>
      <h1 className="hero__title">NEUROSTEMSOUND</h1>
      <p className="hero__subtitle">
        Drag sounds onto the Brain or Gut track. Press play — both tracks fire at once,
        each plays its clips in sequence, and turns serotonin signals into structured music.
      </p>
    </div>
    <div className="hero__controls">
      <div className="instrument-selector">
        <label htmlFor="instr">INSTRUMENT</label>
        <select id="instr" value={instrumentId} onChange={(e) => onInstrumentChange(e.target.value)}>
          {INSTRUMENTS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>
    </div>
  </header>
);

/* ------------------------- Sound library ------------------------- */

const SoundCard = ({ sound, onDragStart }) => (
  <div
    className={`sound-card sound-card--${sound.cat}`}
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData('text/sound-id', sound.id);
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart && onDragStart(sound);
    }}
  >
    <span className="sound-card__icon">{sound.cat === 'brain' ? '◐' : '◑'}</span>
    <div className="sound-card__body">
      <div className="sound-card__name">{sound.name}</div>
      <div className="sound-card__meta">{sound.meta}</div>
    </div>
  </div>
);

const SoundLibrary = () => {
  const brain = SOUND_LIBRARY.filter((s) => s.cat === 'brain');
  const gut = SOUND_LIBRARY.filter((s) => s.cat === 'gut');
  return (
    <aside className="panel sidebar">
      <div className="panel-header">
        <h2 className="panel-title">SOUNDS</h2>
        <span className="sticker">Drag me</span>
      </div>
      <div className="sound-groups">
        <div className="sound-group">
          <div className="sound-group__head">
            <TripleTitle>BRAIN</TripleTitle>
            <span className="sound-group__count">{brain.length}</span>
          </div>
          <div className="sound-list">
            {brain.map((s) => <SoundCard key={s.id} sound={s} />)}
          </div>
        </div>
        <div className="sound-group">
          <div className="sound-group__head">
            <TripleTitle>GUT</TripleTitle>
            <span className="sound-group__count">{gut.length}</span>
          </div>
          <div className="sound-list">
            {gut.map((s) => <SoundCard key={s.id} sound={s} />)}
          </div>
        </div>
      </div>
    </aside>
  );
};

/* ------------------------- Transport ------------------------- */

const Transport = ({ isPlaying, canPlay, canClear, status, onPlay, onStop, onClear }) => {
  const statusClass =
    status === 'Playing' ? 'transport__status-value--playing' :
    status === 'Missing file' ? 'transport__status-value--missing' : '';
  return (
    <section className="panel transport">
      <div className="transport__buttons">
        <button className={`btn btn--play ${isPlaying ? 'is-playing' : ''}`} onClick={onPlay} disabled={!canPlay || isPlaying}>
          <span aria-hidden>{isPlaying ? '♪' : '▶'}</span>
          <span>{isPlaying ? 'PLAYING' : 'PLAY'}</span>
        </button>
        <button className="btn btn--stop" onClick={onStop} disabled={!isPlaying}>
          <span aria-hidden>■</span>
          <span>STOP</span>
        </button>
        <button className="btn btn--clear" onClick={onClear} disabled={!canClear}>
          <span aria-hidden>✕</span>
          <span>CLEAR</span>
        </button>
      </div>
      <div className="transport__status">
        <div className="transport__status-label">STATUS</div>
        <div className={`transport__status-value ${statusClass}`}>{status}</div>
      </div>
    </section>
  );
};

/* ------------------------- Now playing ------------------------- */

const NowPlayingLane = ({ side, clip, progress }) => (
  <div className={`np-lane np-lane--${side}`}>
    <div className="np-lane__head">
      <span className="np-lane__tag">{side.toUpperCase()}</span>
      <span className="np-lane__title">{clip ? clip.name : '—'}</span>
    </div>
    {clip ? (
      <>
        <div className="np-visual">
          <span /><span /><span /><span /><span /><span />
        </div>
        <div className="np-bar"><div className="np-bar__fill" style={{ width: `${(progress || 0) * 100}%` }} /></div>
      </>
    ) : (
      <div className="np-lane__idle">Idle</div>
    )}
  </div>
);

const NowPlaying = ({ brain, gut, progressByClipId }) => (
  <section className="panel now-playing">
    <div className="panel-header">
      <TripleTitle>NOW PLAYING</TripleTitle>
      <span className="sticker sticker--lavender">Live</span>
    </div>
    <div className="np-lanes">
      <NowPlayingLane side="brain" clip={brain} progress={brain ? progressByClipId[brain.id] : 0} />
      <NowPlayingLane side="gut" clip={gut} progress={gut ? progressByClipId[gut.id] : 0} />
    </div>
  </section>
);

/* ------------------------- Track ------------------------- */

const Clip = ({ clip, index, progress, onRemove }) => {
  const state = clip.state;
  const cls = `clip is-${state}`;
  return (
    <div className={cls}>
      <button className="clip__remove" onClick={onRemove} aria-label="Remove">✕</button>
      <span className="clip__num">{index + 1}</span>
      <div className="clip__body">
        <h4 className="clip__title">{clip.name}</h4>
        <div className="clip__state">{state}</div>
        <div className="clip__progress">
          <div className="clip__progress-fill" style={{ width: `${(progress || 0) * 100}%` }} />
        </div>
      </div>
    </div>
  );
};

const Track = ({ track, index, progressByClipId, onDropSound, onRemoveClip, onToggleMute }) => {
  const [isOver, setIsOver] = useState(false);
  return (
    <div className={`track-row track-row--${track.id}`}>
      <div className="track-label">
        <div className="track-label__top">
          <span className="track-label__num">{index + 1}</span>
          <button className={`mute-btn ${track.muted ? 'is-muted' : ''}`} onClick={() => onToggleMute(track.id)}>
            {track.muted ? 'MUTED' : 'MUTE'}
          </button>
        </div>
        <div>
          <div className="track-label__name">{track.name.toUpperCase()}</div>
          <div className="track-label__meta">{track.subtitle}</div>
        </div>
      </div>
      <div
        className={`track-lane ${isOver ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          const id = e.dataTransfer.getData('text/sound-id');
          if (id) onDropSound(track.id, id);
        }}
      >
        {track.clips.length === 0 ? (
          <div className="track-placeholder">Drop a {track.id} sound here</div>
        ) : (
          track.clips.map((c, i) => (
            <Clip key={c.id} clip={c} index={i} progress={progressByClipId[c.id]} onRemove={() => onRemoveClip(track.id, c.id)} />
          ))
        )}
      </div>
    </div>
  );
};

const TrackList = ({ tracks, progressByClipId, onDropSound, onRemoveClip, onToggleMute }) => (
  <section className="panel">
    <div className="panel-header">
      <TripleTitle>TRACKS</TripleTitle>
      <span className="sticker sticker--cream">2 lanes</span>
    </div>
    <div className="track-list">
      {tracks.map((t, i) => (
        <Track
          key={t.id}
          track={t}
          index={i}
          progressByClipId={progressByClipId}
          onDropSound={onDropSound}
          onRemoveClip={onRemoveClip}
          onToggleMute={onToggleMute}
        />
      ))}
    </div>
  </section>
);

/* ------------------------- App ------------------------- */

const App = () => {
  const [tracks, setTracks] = useState(() => INITIAL_TRACKS.map((t) => ({ ...t, clips: [] })));
  const [instrumentId, setInstrumentId] = useState('original');
  const [status, setStatus] = useState('Ready');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressByClipId, setProgressByClipId] = useState({});

  const audioRefs = useRef({ brain: null, gut: null });
  const stopReq = useRef(false);
  const rafRef = useRef(null);
  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const allClips = tracks.flatMap((t) => t.clips);
  const canPlay = allClips.length > 0;
  const canClear = allClips.length > 0;
  const brainNow = tracks.find((t) => t.id === 'brain')?.clips.find((c) => c.state === 'playing') || null;
  const gutNow = tracks.find((t) => t.id === 'gut')?.clips.find((c) => c.state === 'playing') || null;

  const setClipState = (trackId, clipId, state) =>
    setTracks((cur) => cur.map((t) => t.id !== trackId ? t : {
      ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, state } : c)
    }));

  const resetStates = useCallback(() => {
    setTracks((cur) => cur.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, state: 'ready' })) })));
    setProgressByClipId({});
  }, []);

  const stopAll = useCallback(() => {
    Object.keys(audioRefs.current).forEach((id) => {
      const a = audioRefs.current[id];
      if (a) {
        a.onended = a.onerror = a.onpause = null;
        a.pause();
        try { a.currentTime = 0; } catch {}
        a.src = '';
        audioRefs.current[id] = null;
      }
    });
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const playLane = (trackId, clips) =>
    new Promise(async (resolveAll) => {
      for (const clip of clips) {
        if (stopReq.current) break;
        await new Promise((resolve) => {
          const audio = new Audio(clip.file);
          audioRefs.current[trackId] = audio;
          setClipState(trackId, clip.id, 'playing');
          let done = false;
          const finish = (next) => {
            if (done) return;
            done = true;
            audio.onended = audio.onerror = audio.onpause = null;
            setClipState(trackId, clip.id, next);
            if (next === 'finished' || next === 'missing') {
              setProgressByClipId((p) => ({ ...p, [clip.id]: 1 }));
            }
            resolve();
          };
          audio.onended = () => finish('finished');
          audio.onerror = () => finish('missing');
          audio.onpause = () => { if (stopReq.current) finish('ready'); };
          audio.play().catch(() => finish('missing'));
        });
      }
      resolveAll();
    });

  const startProgressLoop = () => {
    const tick = () => {
      const next = {};
      let any = false;
      Object.keys(audioRefs.current).forEach((trackId) => {
        const a = audioRefs.current[trackId];
        if (!a) return;
        any = true;
        const playing = tracksRef.current.find((t) => t.id === trackId)?.clips.find((c) => c.state === 'playing');
        if (playing && a.duration && isFinite(a.duration) && a.duration > 0) {
          next[playing.id] = a.currentTime / a.duration;
        }
      });
      setProgressByClipId((p) => ({ ...p, ...next }));
      if (any) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  };

  const handlePlay = async () => {
    if (!canPlay || isPlaying) return;
    stopReq.current = false;
    setIsPlaying(true);
    setStatus('Playing');
    resetStates();

    const lanes = tracks
      .filter((t) => !t.muted && t.clips.length > 0)
      .map((t) => playLane(t.id, t.clips));
    startProgressLoop();
    await Promise.all(lanes);
    stopAll();
    setIsPlaying(false);
    if (stopReq.current) { stopReq.current = false; setStatus('Stopped'); }
    else {
      const anyMissing = tracksRef.current.some((t) => t.clips.some((c) => c.state === 'missing'));
      setStatus(anyMissing ? 'Missing file' : 'Finished');
    }
  };

  const handleStop = () => {
    stopReq.current = true;
    stopAll();
    setTracks((cur) => cur.map((t) => ({ ...t, clips: t.clips.map((c) => c.state === 'playing' ? { ...c, state: 'ready' } : c) })));
    setProgressByClipId({});
    setIsPlaying(false);
    setStatus('Stopped');
  };

  const handleClear = () => {
    stopReq.current = true;
    stopAll();
    setTracks((cur) => cur.map((t) => ({ ...t, clips: [] })));
    setProgressByClipId({});
    setIsPlaying(false);
    setStatus('Ready');
  };

  const handleDropSound = (trackId, soundId) => {
    const sound = SOUND_LIBRARY.find((s) => s.id === soundId);
    if (!sound) return;
    setTracks((cur) => cur.map((t) => {
      if (t.id !== trackId) return t;
      const newClip = {
        id: crypto.randomUUID(),
        soundId: sound.id,
        name: sound.name,
        file: sound.file,
        state: 'ready',
      };
      return { ...t, clips: [...t.clips, newClip] };
    }));
    if (status !== 'Playing') setStatus('Ready');
  };

  const handleRemoveClip = (trackId, clipId) => {
    setTracks((cur) => cur.map((t) => t.id !== trackId ? t : { ...t, clips: t.clips.filter((c) => c.id !== clipId) }));
    setProgressByClipId((p) => { const { [clipId]: _x, ...rest } = p; return rest; });
  };

  const handleToggleMute = (trackId) => {
    setTracks((cur) => cur.map((t) => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  useEffect(() => () => { stopReq.current = true; stopAll(); }, [stopAll]);

  return (
    <div className="app-shell">
      <DecoNotes />
      <Hero instrumentId={instrumentId} onInstrumentChange={setInstrumentId} />
      <div className="layout">
        <SoundLibrary />
        <div className="main-column">
          <Transport
            isPlaying={isPlaying}
            canPlay={canPlay}
            canClear={canClear}
            status={status}
            onPlay={handlePlay}
            onStop={handleStop}
            onClear={handleClear}
          />
          <NowPlaying brain={brainNow} gut={gutNow} progressByClipId={progressByClipId} />
          <TrackList
            tracks={tracks}
            progressByClipId={progressByClipId}
            onDropSound={handleDropSound}
            onRemoveClip={handleRemoveClip}
            onToggleMute={handleToggleMute}
          />
        </div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
