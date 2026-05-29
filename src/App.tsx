import { useCallback, useEffect, useRef, useState } from "react";
import InstrumentSelector from "./components/InstrumentSelector";
import SoundLibrary from "./components/SoundLibrary";
import TrackList from "./components/TrackList";
import TransportControls from "./components/TransportControls";
import NowPlayingPanel from "./components/NowPlayingPanel";
import { getAudioPath, INITIAL_TRACKS, SOUND_LIBRARY } from "./config/audio";
import type { Clip, InstrumentId, Status, TrackId, TrackModel } from "./types/audio";

const App = () => {
  const [tracks, setTracks] = useState<TrackModel[]>(INITIAL_TRACKS);
  const [instrumentId, setInstrumentId] = useState<InstrumentId>("original");
  const [status, setStatus] = useState<Status>("Ready");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressByClipId, setProgressByClipId] = useState<Record<string, number>>({});

  // Per-track audio elements and stop signaling. Refs avoid re-render churn while playing.
  const trackAudioRefs = useRef<Record<TrackId, HTMLAudioElement | null>>({
    brain: null,
    gut: null,
  });
  const stopRequestedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const allClips = tracks.flatMap((t) => t.clips);
  const canPlay = allClips.length > 0;
  const canClear = allClips.length > 0;
  const brainNowPlaying =
    tracks.find((t) => t.id === "brain")?.clips.find((c) => c.state === "playing") ?? null;
  const gutNowPlaying =
    tracks.find((t) => t.id === "gut")?.clips.find((c) => c.state === "playing") ?? null;

  const updateClipState = (trackId: TrackId, clipId: string, state: Clip["state"]) => {
    setTracks((current) =>
      current.map((t) =>
        t.id !== trackId
          ? t
          : { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, state } : c)) },
      ),
    );
  };

  const resetAllClipStates = useCallback(() => {
    setTracks((current) =>
      current.map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({ ...c, state: "ready" as const })),
      })),
    );
    setProgressByClipId({});
  }, []);

  const stopAllAudio = useCallback(() => {
    (Object.keys(trackAudioRefs.current) as TrackId[]).forEach((id) => {
      const a = trackAudioRefs.current[id];
      if (a) {
        a.onended = null;
        a.onerror = null;
        a.onpause = null;
        a.pause();
        try {
          a.currentTime = 0;
        } catch {
          // ignore — element may have errored before metadata
        }
        a.src = "";
        trackAudioRefs.current[id] = null;
      }
    });
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const playTrackSequence = (trackId: TrackId, clips: Clip[]): Promise<void> => {
    return new Promise(async (resolveAll) => {
      for (const clip of clips) {
        if (stopRequestedRef.current) break;

        await new Promise<void>((resolve) => {
          const audio = new Audio(clip.filePath);
          trackAudioRefs.current[trackId] = audio;
          updateClipState(trackId, clip.id, "playing");

          let settled = false;
          const finish = (next: Clip["state"]) => {
            if (settled) return;
            settled = true;
            audio.onended = null;
            audio.onerror = null;
            audio.onpause = null;
            updateClipState(trackId, clip.id, next);
            if (next === "finished" || next === "missing") {
              setProgressByClipId((p) => ({ ...p, [clip.id]: 1 }));
            }
            resolve();
          };

          audio.onended = () => finish("finished");
          audio.onerror = () => finish("missing");
          audio.onpause = () => {
            if (stopRequestedRef.current) finish("ready");
          };

          void audio.play().catch(() => finish("missing"));
        });
      }
      resolveAll();
    });
  };

  // Animation loop: poll audio elements and write progress percentages.
  const startProgressLoop = () => {
    const tick = () => {
      const next: Record<string, number> = {};
      let anyActive = false;

      (Object.keys(trackAudioRefs.current) as TrackId[]).forEach((trackId) => {
        const a = trackAudioRefs.current[trackId];
        if (!a) return;
        anyActive = true;
        const playingClip = tracksRef.current
          .find((t) => t.id === trackId)
          ?.clips.find((c) => c.state === "playing");
        if (playingClip && a.duration && isFinite(a.duration) && a.duration > 0) {
          next[playingClip.id] = a.currentTime / a.duration;
        }
      });

      setProgressByClipId((prev) => ({ ...prev, ...next }));

      if (anyActive) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const handlePlay = async () => {
    if (!canPlay || isPlaying) return;
    stopRequestedRef.current = false;
    setIsPlaying(true);
    setStatus("Playing");
    resetAllClipStates();

    const lanes = tracks
      .filter((t) => !t.muted && t.clips.length > 0)
      .map((t) => playTrackSequence(t.id, t.clips));

    startProgressLoop();

    await Promise.all(lanes);

    stopAllAudio();
    setIsPlaying(false);
    if (stopRequestedRef.current) {
      stopRequestedRef.current = false;
      setStatus("Stopped");
    } else {
      // detect missing
      const anyMissing = tracksRef.current.some((t) => t.clips.some((c) => c.state === "missing"));
      setStatus(anyMissing ? "Missing file" : "Finished");
    }
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    stopAllAudio();
    setTracks((current) =>
      current.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.state === "playing" ? { ...c, state: "ready" } : c)),
      })),
    );
    setProgressByClipId({});
    setIsPlaying(false);
    setStatus("Stopped");
  };

  const handleClear = () => {
    stopRequestedRef.current = true;
    stopAllAudio();
    setTracks((current) => current.map((t) => ({ ...t, clips: [] })));
    setProgressByClipId({});
    setIsPlaying(false);
    setStatus("Ready");
  };

  const handleDropSound = (trackId: TrackId, soundId: string) => {
    const sound = SOUND_LIBRARY.find((s) => s.id === soundId);
    if (!sound) return;

    const filePath = getAudioPath(sound, instrumentId);
    setTracks((current) =>
      current.map((t) => {
        if (t.id !== trackId) return t;
        const orderIndex = t.clips.length;
        const newClip: Clip = {
          id: crypto.randomUUID(),
          soundId: sound.id,
          trackId,
          name: sound.displayName,
          filePath,
          midiPath: sound.midiPath,
          orderIndex,
          state: "ready",
          instrumentId,
        };
        return { ...t, clips: [...t.clips, newClip] };
      }),
    );
    if (status !== "Playing") setStatus("Ready");
  };

  const handleRemoveClip = (trackId: TrackId, clipId: string) => {
    setTracks((current) =>
      current.map((t) =>
        t.id !== trackId ? t : { ...t, clips: t.clips.filter((c) => c.id !== clipId) },
      ),
    );
    setProgressByClipId((p) => {
      const { [clipId]: _omit, ...rest } = p;
      return rest;
    });
  };

  const handleToggleMute = (trackId: TrackId) => {
    setTracks((current) =>
      current.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
    );
  };

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      stopAllAudio();
    };
  }, [stopAllAudio]);

  return (
    <div className="app-shell">
      <span className="note-deco note-deco--1" aria-hidden>♪</span>
      <span className="note-deco note-deco--2" aria-hidden>♬</span>
      <span className="note-deco note-deco--3" aria-hidden>♩</span>
      <span className="note-deco note-deco--4" aria-hidden>♫</span>

      <header className="hero">
        <div className="hero__title">
          <p className="hero__repeat" aria-hidden>
            NEUROSTEMSOUND · NEUROSTEMSOUND · NEUROSTEMSOUND
          </p>
          <p className="eyebrow">GERF · Serotonin Sonification</p>
          <h1>Brain &amp; Gut Studio</h1>
          <p className="hero__copy">
            Drag sounds onto the Brain or Gut track. Press Play — both tracks fire at once and each
            plays its clips in sequence.
          </p>
        </div>
        <div className="hero__controls">
          <InstrumentSelector value={instrumentId} onChange={setInstrumentId} />
        </div>
      </header>

      <main className="layout">
        <SoundLibrary sounds={SOUND_LIBRARY} />

        <section className="main-column">
          <TransportControls
            canPlay={canPlay}
            canClear={canClear}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onStop={handleStop}
            onClear={handleClear}
            status={status}
          />
          <NowPlayingPanel
            brain={brainNowPlaying ?? null}
            gut={gutNowPlaying ?? null}
            progressByClipId={progressByClipId}
          />
          <TrackList
            tracks={tracks}
            progressByClipId={progressByClipId}
            onDropSound={handleDropSound}
            onRemoveClip={handleRemoveClip}
            onToggleMute={handleToggleMute}
          />
        </section>
      </main>
    </div>
  );
};

export default App;
