// NeuroStemSound — KIDS edition
// Tap-to-add music studio. Sir Tone conducts real serotonin recordings.
// Sounds are chosen from a Sound Library that shows each recording's curve.

const { useState, useRef, useCallback, useEffect } = React;

const WAVEFORMS = window.WAVEFORMS || {};

/* ----------------------------------------------------------------
   Sound styles — Sir Tone "plays" each recording on a different
   instrument. Styled files share the raw file's name with a suffix:
     classical -> _c,  electronic -> _e,  funny -> _f
   e.g. brain_..._no-drug.wav  ->  brain_..._no-drug_c.wav
   Until a styled file exists we fall back to the raw recording.
----------------------------------------------------------------- */
const STYLES = [
  { id: 'classical',  name: 'Classical',  icon: '', suffix: '_c' },
  { id: 'electronic', name: 'Electronic', icon: '', suffix: '_e' },
  { id: 'funny',      name: 'Funny',      icon: '', suffix: '_f' },
];

// build the styled file path for a given base file + style id
const styledFile = (file, styleId) => {
  const s = STYLES.find((x) => x.id === styleId);
  if (!s) return file;
  return file.replace(/\.wav$/i, `${s.suffix}.wav`);
};

/* ----------------------------------------------------------------
   Sound library — friendly names, with the real science as subtitle.
   pattern: number of "peaks" (serotonin bursts) -> rhythm dots, or 'noise' -> wave.
----------------------------------------------------------------- */
const SOUNDS = [
// BRAIN (serotonin neurons, no drug)
{ id: 'brain_very-frequent_1peak_no-drug', cat: 'brain', name: 'Single Ping', pattern: 1, science: 'Brain · very frequent, 1 peak', file: 'audio/brain_very-frequent_1peak_no-drug.wav' },
{ id: 'brain_very-frequent_2peaks_no-drug', cat: 'brain', name: 'Double Bounce', pattern: 2, science: 'Brain · very frequent, 2 peaks', file: 'audio/brain_very-frequent_2peaks_no-drug.wav' },
{ id: 'brain_diffusion_3peaks_no-drug', cat: 'brain', name: 'Triple Sparkle', pattern: 3, science: 'Brain · diffusion, 3 peaks', file: 'audio/brain_diffusion_3peaks_no-drug.wav' },
{ id: 'brain_diffusion_noise_no-drug', cat: 'brain', name: 'Soft Whoosh', pattern: 'noise', science: 'Brain · diffusion, noise', file: 'audio/brain_diffusion_noise_no-drug.wav' },
{ id: 'brain_very-frequent_noise_no-drug', cat: 'brain', name: 'Busy Static', pattern: 'noise', science: 'Brain · very frequent, noise', file: 'audio/brain_very-frequent_noise_no-drug.wav' },
// GUT (organoid / ZB5 cells)
{ id: 'gut_organoid2_1peak_post-drug', cat: 'gut', name: 'Gut Plink', pattern: 1, science: 'Gut · organoid 2, 1 peak', file: 'audio/gut_organoid2_1peak_post-drug.wav' },
{ id: 'gut_organoid3_2peaks_post-drug', cat: 'gut', name: 'Twin Pop', pattern: 2, science: 'Gut · organoid 3, 2 peaks', file: 'audio/gut_organoid3_2peaks_post-drug.wav' },
{ id: 'gut_organoid2_3peaks_post-drug', cat: 'gut', name: 'Bubble Beat', pattern: 3, science: 'Gut · organoid 2, 3 peaks', file: 'audio/gut_organoid2_3peaks_post-drug.wav' },
{ id: 'gut_organoid3_3peaks_post-drug', cat: 'gut', name: 'Triple Gurgle', pattern: 3, science: 'Gut · organoid 3, 3 peaks', file: 'audio/gut_organoid3_3peaks_post-drug.wav' },
{ id: 'gut_organoid2_low-noise_post-drug', cat: 'gut', name: 'Gentle Rumble', pattern: 'noise', science: 'Gut · organoid 2, low noise', file: 'audio/gut_organoid2_low-noise_post-drug.wav' },
{ id: 'gut_organoid3_noise_pre-drug', cat: 'gut', name: 'Quiet Tummy', pattern: 'noise', science: 'Gut · organoid 3, noise (before drug)', file: 'audio/gut_organoid3_noise_pre-drug.wav' },
{ id: 'ZB5_peaks_PSD', cat: 'gut', name: 'Zappy Beats', pattern: 3, science: 'Gut · ZB5 peaks (after drug)', file: 'audio/ZB5_peaks_PSD.wav' },
{ id: 'ZB5_peaks_PRD', cat: 'gut', name: 'Early Beats', pattern: 3, science: 'Gut · ZB5 peaks (before drug)', file: 'audio/ZB5_peaks_PRD.wav' },
{ id: 'ZB5_noise_PSD', cat: 'gut', name: 'Fizzy Hum', pattern: 'noise', science: 'Gut · ZB5 noise (after drug)', file: 'audio/ZB5_noise_PSD.wav' },
{ id: 'ZB5_noise_PRD', cat: 'gut', name: 'Soft Hum', pattern: 'noise', science: 'Gut · ZB5 noise (before drug)', file: 'audio/ZB5_noise_PRD.wav' }];


const STAGE_INFO = {
  brain: { name: 'BRAIN', sub: 'thinking signals', hint: 'Open the library to add brain sounds' },
  gut: { name: 'GUT', sub: 'gut feelings', hint: 'Open the library to add gut sounds' }
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showHelper": true,
  "showScience": false,
  "celebrate": true,
  "accent": "#FFD63D"
} /*EDITMODE-END*/;

/* ------------------------- decorations ------------------------- */
const Note = ({ color = '#F4A33D', stem = '#4F3D9C' }) =>
<svg viewBox="0 0 64 88" aria-hidden="true">
    <path d="M22 4 L22 60 C22 60 14 56 8 64 C 2 72 8 84 18 84 C 28 84 34 76 34 66 L 34 22 L 56 16 L 56 50 C 56 50 50 46 44 54 C 38 62 44 74 54 74 C 64 74 60 56 60 56 L 60 6 Z"
  fill={color} stroke={stem} strokeWidth="3" strokeLinejoin="round" />
  </svg>;

const DecoNotes = () =>
<div className="deco-notes" aria-hidden="true">
    <Note color="#F4A33D" /><Note color="#B9ABEB" /><Note color="#FFD63D" /><Note color="#F582C9" />
  </div>;


/* ------------------------- character (Sir Tone!) ------------------------- */
const Character = ({ cat, singing }) =>
<div className={`character character--${cat} ${singing ? 'is-singing' : ''}`}>
    <span className="character__disc" aria-hidden="true" />
    <img className="character__img" src="sir-tone.png" alt="Sir Tone, the serotonin conductor" />
  </div>;


/* ------------------------- rhythm icon ------------------------- */
const Rhythm = ({ pattern, cat = 'brain' }) =>
<div className={`rhythm rhythm--${cat}`} aria-hidden="true">
    {pattern === 'noise' ?
  <svg className="rhythm__wave" viewBox="0 0 30 18">
        <path d="M1 9 q3 -8 6 0 t6 0 t6 0 t6 0" />
      </svg> :

  Array.from({ length: pattern }).map((_, i) =>
  <span key={i} className="rhythm__dot rhythm__dot--tall" />
  )
  }
  </div>;


/* ------------------------- curve (waveform) ------------------------- */
const Curve = ({ peaks, progress = 0, cat = 'brain', height = 48, idKey = '0' }) => {
  if (!peaks || !peaks.length) {
    return <div className="curve-empty" style={{ height }} aria-hidden="true" />;
  }
  const n = peaks.length;
  const max = n - 1;
  const amp = 44;
  const top = peaks.map((p, i) => `${i} ${50 - p * amp}`);
  const bot = peaks.map((p, i) => `${i} ${50 + p * amp}`).reverse();
  const d = `M ${top.join(' L ')} L ${bot.join(' L ')} Z`;
  const cid = `cv-${idKey}`;
  const px = Math.max(0.0001, progress * max);
  return (
    <svg className={`curve curve--${cat}`} viewBox={`0 0 ${max} 100`} preserveAspectRatio="none"
    style={{ height }} aria-hidden="true">
      <defs><clipPath id={cid}><rect x="0" y="0" width={px} height="100" /></clipPath></defs>
      <line className="curve__mid" x1="0" y1="50" x2={max} y2="50" vectorEffect="non-scaling-stroke" />
      <path className="curve__base" d={d} />
      <path className="curve__played" d={d} clipPath={`url(#${cid})`} />
      {progress > 0.001 && progress < 0.999 &&
      <line className="curve__head" x1={px} y1="3" x2={px} y2="97" vectorEffect="non-scaling-stroke" />
      }
    </svg>);

};

/* ------------------------- sequence chip (with curve) ------------------------- */
const Chip = ({ clip, index, progress, cat, onRemove }) =>
<div className={`chip is-${clip.state}`}>
    <div className="chip__top">
      <span className="chip__order">{index + 1}</span>
      <span className="chip__name">{clip.name}</span>
      <button className="chip__remove" onClick={onRemove} aria-label={`Remove ${clip.name}`}>✕</button>
    </div>
    <Curve peaks={WAVEFORMS[clip.soundId]} progress={progress || 0} cat={cat} height={32} idKey={`c${clip.id}`} />
  </div>;


/* ------------------------- stage ------------------------- */
const Stage = ({ cat, clips, muted, singing, progressByClipId, onOpenLibrary, onRemove, onToggleMute }) => {
  const info = STAGE_INFO[cat];
  return (
    <section className={`stage stage--${cat} ${singing ? 'is-singing' : ''}`}>
      <div className="stage__head">
        <Character cat={cat} singing={singing} />
        <div className="stage__head-text">
          <h2 className="stage__name">{info.name}</h2>
          <div className="stage__sub">{info.sub}</div>
        </div>
        <button className={`onoff ${muted ? 'is-off' : ''}`} onClick={() => onToggleMute(cat)}>
          <span className="onoff__icon">{muted ? '🔇' : '🔊'}</span>
          {muted ? 'OFF' : 'ON'}
        </button>
      </div>

      <div className="tray-wrap">
        <div className="tray-label">
          My song
          <span className="tray-label__count">{clips.length}</span>
        </div>
        <div className={`tray ${clips.length === 0 ? 'is-empty' : ''}`}>
          {clips.length === 0 ?
          <div className="tray__empty">{info.hint}</div> :

          clips.map((c, i) =>
          <Chip key={c.id} clip={c} index={i} cat={cat}
          progress={progressByClipId[c.id]} onRemove={() => onRemove(cat, c.id)} />
          )
          }
        </div>
      </div>

      <button className={`browse-btn browse-btn--${cat}`} onClick={() => onOpenLibrary(cat)}>
        <span className="browse-btn__plus">+</span>
        Add {cat === 'brain' ? 'brain' : 'gut'} sounds
      </button>
    </section>);

};

/* ------------------------- library ------------------------- */
const LibraryCard = ({ sound, showScience, previewing, progress, justAdded, onPreview, onAdd }) =>
<div className={`lib-card lib-card--${sound.cat}`}>
    <div className="lib-card__head">
      <Rhythm pattern={sound.pattern} cat={sound.cat} />
      <div className="lib-card__text">
        <div className="lib-card__name">{sound.name}</div>
        <div className="lib-card__science">{showScience ? sound.science : sound.pattern === 'noise' ? 'wiggly signal' : `${sound.pattern} beat${sound.pattern > 1 ? 's' : ''}`}</div>
      </div>
    </div>
    <Curve peaks={WAVEFORMS[sound.id]} progress={previewing ? progress : 0} cat={sound.cat} height={62} idKey={`l${sound.id}`} />
    <div className="lib-card__actions">
      <button className={`lib-listen ${previewing ? 'is-on' : ''}`} onClick={() => onPreview(sound)}>
        <span aria-hidden>{previewing ? '■' : '▶'}</span> {previewing ? 'Stop' : 'Listen'}
      </button>
      <button className={`lib-add ${justAdded ? 'is-added' : ''}`} onClick={() => onAdd(sound)}>
        {justAdded ? 'Added ✓' : '＋ Add'}
      </button>
    </div>
  </div>;


const LibraryModal = ({ cat, onCat, onClose, showScience, preview, addedId, onPreview, onAdd }) => {
  const sounds = SOUNDS.filter((s) => s.cat === cat);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="library" onClick={(e) => e.stopPropagation()}>
        <div className="library__head">
          <h2 className="library__title">🎵 Sound Library</h2>
          <div className="lib-tabs">
            <button className={cat === 'brain' ? 'is-on' : ''} onClick={() => onCat('brain')}>Brain</button>
            <button className={cat === 'gut' ? 'is-on' : ''} onClick={() => onCat('gut')}>Gut</button>
          </div>
          <button className="library__close" onClick={onClose} aria-label="Close library">✕</button>
        </div>
        <div className="library__hint">
          Tap <b>Listen</b> to hear a sound and watch its curve, then <b>Add</b> it to {cat === 'brain' ? 'Brain' : 'Gut'}.
        </div>
        <div className="lib-grid">
          {sounds.map((s) =>
          <LibraryCard key={s.id} sound={s} showScience={showScience}
          previewing={preview.id === s.id}
          progress={preview.id === s.id ? preview.progress : 0}
          justAdded={addedId === s.id}
          onPreview={onPreview} onAdd={onAdd} />
          )}
        </div>
        <button className="library__done" onClick={onClose}>Done</button>
      </div>
    </div>);

};

/* ------------------------- welcome overlay ------------------------- */
const Welcome = ({ onClose }) =>
<div className="overlay" onClick={onClose}>
    <div className="welcome" onClick={(e) => e.stopPropagation()}>
      <img className="welcome__hero" src="sir-tone.png" alt="Sir Tone" />
      <h2 className="welcome__title">Meet Sir Tone!</h2>
      <p className="welcome__copy">He turns real signals from a <b>brain</b> and a <b>gut</b> into music. Help him build a song!</p>
      <div className="welcome__steps">
        <div className="welcome__step"><span className="helper__num">1</span><span>Open the <b>library</b> and add sounds to Brain &amp; Gut</span></div>
        <div className="welcome__step"><span className="helper__num">2</span><span>Press the big green <b>PLAY</b> button</span></div>
        <div className="welcome__step"><span className="helper__num">3</span><span>Watch Sir Tone conduct them together! 🎶</span></div>
      </div>
      <button className="welcome__go" onClick={onClose}>Let's go!</button>
    </div>
  </div>;


/* ------------------------- confetti ------------------------- */
const Confetti = () => {
  const colors = ['#FFD63D', '#F4A33D', '#F582C9', '#B9ABEB', '#58B97A', '#4F3D9C'];
  const bits = Array.from({ length: 70 }).map((_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 1.2 + Math.random() * 0.9, color: colors[i % colors.length], rot: Math.random() * 360
  }));
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) =>
      <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />
      )}
    </div>);

};

/* ========================= APP ========================= */
const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [clipsByCat, setClipsByCat] = useState({ brain: [], gut: [] });
  const [mutedByCat, setMutedByCat] = useState({ brain: false, gut: false });
  const [status, setStatus] = useState('ready');
  const [isPlaying, setIsPlaying] = useState(false);
  const [singing, setSinging] = useState({ brain: false, gut: false });
  const [showWelcome, setShowWelcome] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [progressByClipId, setProgressByClipId] = useState({});
  const [library, setLibrary] = useState({ open: false, cat: 'brain' });
  const [preview, setPreview] = useState({ id: null, progress: 0 });
  const [addedId, setAddedId] = useState(null);
  const [soundStyle, setSoundStyle] = useState('classical');

  const changeStyle = (s) => setSoundStyle(s);

  const audioRefs = useRef({ brain: null, gut: null });
  const stopReq = useRef(false);
  const rafRef = useRef(null);
  const clipsRef = useRef(clipsByCat);
  useEffect(() => {clipsRef.current = clipsByCat;}, [clipsByCat]);

  const previewRef = useRef(null);
  const previewRaf = useRef(null);
  const addedTimer = useRef(null);

  const totalClips = clipsByCat.brain.length + clipsByCat.gut.length;
  const canPlay = totalClips > 0;

  useEffect(() => {document.documentElement.style.setProperty('--accent', t.accent);}, [t.accent]);

  const setClipState = (cat, clipId, state) =>
  setClipsByCat((cur) => ({ ...cur, [cat]: cur[cat].map((c) => c.id === clipId ? { ...c, state } : c) }));

  const resetStates = () =>
  setClipsByCat((cur) => ({
    brain: cur.brain.map((c) => ({ ...c, state: 'ready' })),
    gut: cur.gut.map((c) => ({ ...c, state: 'ready' }))
  }));

  /* ----- preview (library) ----- */
  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.onended = previewRef.current.onerror = null;
      previewRef.current.pause();
      previewRef.current.src = '';
      previewRef.current = null;
    }
    if (previewRaf.current) {cancelAnimationFrame(previewRaf.current);previewRaf.current = null;}
    setPreview({ id: null, progress: 0 });
  }, []);

  const handlePreview = (sound) => {
    if (preview.id === sound.id) {stopPreview();return;}
    stopPreview();
    const styled = styledFile(sound.file, soundStyle);
    const a = new Audio(styled);
    previewRef.current = a;
    let triedRaw = false;
    setPreview({ id: sound.id, progress: 0 });
    const tick = () => {
      if (a.duration && isFinite(a.duration)) {
        setPreview((p) => p.id === sound.id ? { ...p, progress: a.currentTime / a.duration } : p);
      }
      previewRaf.current = requestAnimationFrame(tick);
    };
    a.onended = () => {
      if (previewRaf.current) {cancelAnimationFrame(previewRaf.current);previewRaf.current = null;}
      previewRef.current = null;
      setPreview({ id: sound.id, progress: 1 });
      setTimeout(() => setPreview((p) => p.id === sound.id ? { id: null, progress: 0 } : p), 450);
    };
    a.onerror = () => {
      if (!triedRaw && styled !== sound.file) { triedRaw = true; a.src = sound.file; a.load(); a.play().catch(() => stopPreview()); }
      else stopPreview();
    };
    a.play().catch(() => a.onerror());
    previewRaf.current = requestAnimationFrame(tick);
  };

  /* ----- main playback ----- */
  const stopAll = useCallback(() => {
    ['brain', 'gut'].forEach((cat) => {
      const a = audioRefs.current[cat];
      if (a) {a.onended = a.onerror = a.onpause = null;a.pause();try {a.currentTime = 0;} catch {}a.src = '';audioRefs.current[cat] = null;}
    });
    if (rafRef.current) {cancelAnimationFrame(rafRef.current);rafRef.current = null;}
  }, []);

  const startProgressLoop = () => {
    const tick = () => {
      const next = {};let any = false;
      ['brain', 'gut'].forEach((cat) => {
        const a = audioRefs.current[cat];
        if (!a) return;
        any = true;
        const playing = clipsRef.current[cat].find((c) => c.state === 'playing');
        if (playing && a.duration && isFinite(a.duration) && a.duration > 0) next[playing.id] = a.currentTime / a.duration;
      });
      setProgressByClipId((p) => ({ ...p, ...next }));
      rafRef.current = any ? requestAnimationFrame(tick) : null;
    };
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  };

  const playLane = (cat, clips, style) =>
  new Promise(async (resolveAll) => {
    for (const clip of clips) {
      if (stopReq.current) break;
      await new Promise((resolve) => {
        const styled = styledFile(clip.file, style);
        const audio = new Audio(styled);
        audioRefs.current[cat] = audio;
        setClipState(cat, clip.id, 'playing');
        setSinging((s) => ({ ...s, [cat]: true }));
        let done = false;
        let triedRaw = false;
        const finish = (next) => {
          if (done) return;done = true;
          audio.onended = audio.onerror = audio.onpause = null;
          setClipState(cat, clip.id, next);
          if (next === 'finished' || next === 'missing') setProgressByClipId((p) => ({ ...p, [clip.id]: 1 }));
          resolve();
        };
        // if the styled file isn't there yet, quietly fall back to the raw recording
        const fail = () => {
          if (!triedRaw && styled !== clip.file) {
            triedRaw = true;
            audio.src = clip.file;
            audio.load();
            audio.play().catch(() => finish('missing'));
          } else finish('missing');
        };
        audio.onended = () => finish('finished');
        audio.onerror = fail;
        audio.onpause = () => {if (stopReq.current) finish('ready');};
        audio.play().catch(fail);
      });
    }
    setSinging((s) => ({ ...s, [cat]: false }));
    resolveAll();
  });

  const handlePlay = async () => {
    if (!canPlay || isPlaying) return;
    stopPreview();
    stopReq.current = false;
    setIsPlaying(true);
    setStatus('playing');
    resetStates();
    setProgressByClipId({});
    const lanes = ['brain', 'gut'].
    filter((cat) => !mutedByCat[cat] && clipsByCat[cat].length > 0).
    map((cat) => playLane(cat, clipsByCat[cat], soundStyle));
    startProgressLoop();
    await Promise.all(lanes);
    stopAll();
    setIsPlaying(false);
    setSinging({ brain: false, gut: false });
    if (stopReq.current) {stopReq.current = false;setStatus('stopped');return;}
    const anyMissing = [...clipsRef.current.brain, ...clipsRef.current.gut].some((c) => c.state === 'missing');
    if (anyMissing) {setStatus('missing');return;}
    setStatus('done');
    if (t.celebrate) {setCelebrating(true);setTimeout(() => setCelebrating(false), 1900);}
  };

  const handleStop = () => {
    stopReq.current = true;
    stopAll();
    setSinging({ brain: false, gut: false });
    setClipsByCat((cur) => ({
      brain: cur.brain.map((c) => c.state === 'playing' ? { ...c, state: 'ready' } : c),
      gut: cur.gut.map((c) => c.state === 'playing' ? { ...c, state: 'ready' } : c)
    }));
    setProgressByClipId({});
    setIsPlaying(false);
    setStatus('stopped');
  };

  const handleClear = () => {
    stopReq.current = true;
    stopAll();
    setSinging({ brain: false, gut: false });
    setClipsByCat({ brain: [], gut: [] });
    setProgressByClipId({});
    setIsPlaying(false);
    setStatus('ready');
  };

  const handleAddSound = (sound) => {
    const cat = sound.cat;
    setClipsByCat((cur) => ({
      ...cur,
      [cat]: [...cur[cat], { id: crypto.randomUUID(), soundId: sound.id, name: sound.name, file: sound.file, state: 'ready' }]
    }));
    if (!isPlaying) setStatus('ready');
    setAddedId(sound.id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedId(null), 800);
  };

  const handleRemove = (cat, clipId) =>
  setClipsByCat((cur) => ({ ...cur, [cat]: cur[cat].filter((c) => c.id !== clipId) }));

  const handleToggleMute = (cat) => setMutedByCat((cur) => ({ ...cur, [cat]: !cur[cat] }));

  const openLibrary = (cat) => {stopPreview();setLibrary({ open: true, cat });};
  const closeLibrary = () => {stopPreview();setLibrary((l) => ({ ...l, open: false }));};

  useEffect(() => () => {stopReq.current = true;stopAll();stopPreview();}, [stopAll, stopPreview]);

  const statusText = {
    ready: 'Ready to play', playing: 'Playing…', done: 'Nice song! 🎉',
    missing: 'Hmm, a sound is missing', stopped: 'Stopped'
  }[status];
  const statusClass = status === 'playing' ? 'is-playing' : status === 'missing' ? 'is-missing' : '';

  return (
    <div className="app-shell">
      <DecoNotes />

      <header className="topbar" style={{ margin: "0px 0px 14px 100px", width: "922px" }}>
        <div className="brand">
          <h1 className="brand__title">Brain & Gut Studio</h1>
          <span className="brand__tag"></span>
        </div>
        <div className="topbar__actions">
          <button className="help-btn help-btn--lib" onClick={() => openLibrary(library.cat)}>
            <span className="help-btn__q">♪</span> Sound Library
          </button>
          <button className="help-btn" onClick={() => setShowWelcome(true)}>
            <span className="help-btn__q">?</span> How to play
          </button>
        </div>
      </header>

      {t.showHelper &&
      <div className="helper">
          <div className="helper__step"><span className="helper__num">1</span><span className="helper__text">Open the <b>library</b> &amp; add sounds</span></div>
          <div className="helper__step"><span className="helper__num">2</span><span className="helper__text">Press the big <b>PLAY</b></span></div>
          <div className="helper__step"><span className="helper__num">3</span><span className="helper__text"><b>Listen</b> — they sing together!</span></div>
        </div>
      }

      <div className="style-picker">
        <span className="style-picker__label">Sir Tone plays</span>
        <div className="style-seg">
          {STYLES.map((s) =>
          <button key={s.id} className={`style-opt ${soundStyle === s.id ? 'is-on' : ''}`} onClick={() => changeStyle(s.id)}>
              {s.icon && <span className="style-opt__icon" aria-hidden>{s.icon}</span>}
              {s.name}
            </button>
          )}
        </div>
      </div>

      <div className="studio">
        <Stage cat="brain" clips={clipsByCat.brain} muted={mutedByCat.brain} singing={singing.brain}
        progressByClipId={progressByClipId} onOpenLibrary={openLibrary} onRemove={handleRemove} onToggleMute={handleToggleMute} />
        <Stage cat="gut" clips={clipsByCat.gut} muted={mutedByCat.gut} singing={singing.gut}
        progressByClipId={progressByClipId} onOpenLibrary={openLibrary} onRemove={handleRemove} onToggleMute={handleToggleMute} />
      </div>

      {status !== 'ready' && <div className={`status-pill ${statusClass}`}>{statusText}</div>}

      <div className="transport">
        <button className="btn-big btn-clear" onClick={handleClear} disabled={!totalClips}>
          <span className="btn-big__icon">↺</span> Start over
        </button>
        <button className={`btn-big btn-play ${isPlaying ? 'is-playing' : ''}`} onClick={handlePlay} disabled={!canPlay || isPlaying}>
          <span className="btn-big__icon">{isPlaying ? '♪' : '▶'}</span> {isPlaying ? 'Playing' : 'PLAY'}
        </button>
        <button className="btn-big btn-stop" onClick={handleStop} disabled={!isPlaying}>
          <span className="btn-big__icon">■</span> Stop
        </button>
      </div>

      {celebrating && <Confetti />}
      {library.open &&
      <LibraryModal cat={library.cat} onCat={(c) => {stopPreview();setLibrary({ open: true, cat: c });}}
      onClose={closeLibrary} showScience={t.showScience} preview={preview} addedId={addedId}
      onPreview={handlePreview} onAdd={handleAddSound} />
      }
      {showWelcome && <Welcome onClose={() => setShowWelcome(false)} />}

      <TweaksPanel>
        <TweakSection label="For grown-ups & teachers" />
        <TweakToggle label="Show how-to steps" value={t.showHelper} onChange={(v) => setTweak('showHelper', v)} />
        <TweakToggle label="Show science names" value={t.showScience} onChange={(v) => setTweak('showScience', v)} />
        <TweakToggle label="Confetti celebration" value={t.celebrate} onChange={(v) => setTweak('celebrate', v)} />
        <TweakSection label="Look" />
        <TweakColor label="Accent colour" value={t.accent}
        options={['#FFD63D', '#F582C9', '#F4A33D', '#58B97A']}
        onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>);

};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);