import { useCallback, useEffect, useRef, useState } from "react";
import InstrumentSelector from "./components/InstrumentSelector";
import SoundLibrary from "./components/SoundLibrary";
import HelpPanel from "./components/HelpPanel";
import TrackList from "./components/TrackList";
import TransportControls from "./components/TransportControls";
import NowPlayingPanel from "./components/NowPlayingPanel";
import {
  DEFAULT_STYLE_ID,
  INITIAL_TRACKS,
  SOUND_LIBRARY,
  originalPath,
  stylePath,
} from "./config/audio";
import type { Clip, SoundStyleId, Status, TrackId, TrackModel } from "./types/audio";

// Is this audio URL already in the service worker's Cache Storage? This is the
// authoritative offline check: the SW caches audio with a GET, and
// `caches.match` (ignoreSearch, so it ignores any ?__WB_REVISION__) finds it
// even with no network. We NEVER use HEAD for this — HEAD can fail offline and
// does not match a cached GET response.
async function cachedAudio(path: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    return !!(await caches.match(path, { ignoreSearch: true }));
  } catch {
    return false;
  }
}

// Network existence probe — ONLY used when online. Vite/dev answers a missing
// path with index.html + 200, so we reject any text/html response so the
// original/ fallback still kicks in.
async function networkExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    return !type.includes("text/html");
  } catch {
    return false;
  }
}

// Pick the path to actually play. Resolution order (cache FIRST so offline never
// marks a clip missing): cached styled → cached original → (online only) network
// styled → network original. Paths are built from the exact fileName — never a
// displayName.
async function resolvePlayablePath(
  fileName: string,
  styleId: SoundStyleId,
): Promise<string | null> {
  const styled = stylePath(styleId, fileName);
  const original = originalPath(fileName);
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  console.log("[audio] style:", styleId, "| fileName:", fileName, "| online:", online);

  // 1) Cache Storage first — works fully offline.
  console.log("[audio] checking styled (cache):", styled);
  if (await cachedAudio(styled)) {
    console.log("[audio] cache HIT styled → resolved:", styled);
    return styled;
  }
  console.log("[audio] cache MISS styled → fallback to original");

  console.log("[audio] checking original (cache):", original);
  if (await cachedAudio(original)) {
    console.log("[audio] cache HIT original → resolved:", original);
    return original;
  }
  console.log("[audio] cache MISS original");

  // 2) Online only — fall back to a network HEAD probe (styled, then original).
  if (online) {
    if (await networkExists(styled)) {
      console.log("[audio] network OK styled → resolved:", styled);
      return styled;
    }
    console.log("[audio] network miss styled → trying original");
    if (await networkExists(original)) {
      console.log("[audio] network OK original → resolved:", original);
      return original;
    }
    console.log("[audio] network miss original");
  }

  console.error("[audio] UNRESOLVED — marking missing:", { styled, original });
  return null;
}

const App = () => {
  const [tracks, setTracks] = useState<TrackModel[]>(INITIAL_TRACKS);
  const [styleId, setStyleId] = useState<SoundStyleId>(DEFAULT_STYLE_ID);
  const [status, setStatus] = useState<Status>("Ready");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressByClipId, setProgressByClipId] = useState<Record<string, number>>({});
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<TrackId>("brain");
  // Open the How to play modal on first load (it's closable with "Let's go!").
  const [helpOpen, setHelpOpen] = useState(true);

  // Per-track audio elements and stop signaling. Refs avoid re-render churn while playing.
  const trackAudioRefs = useRef<Record<TrackId, HTMLAudioElement | null>>({
    brain: null,
    gut: null,
    skin: null,
  });
  const stopRequestedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  // The selected style is read at play time so changing it affects the next play.
  const styleRef = useRef(styleId);
  useEffect(() => {
    styleRef.current = styleId;
  }, [styleId]);

  const allClips = tracks.flatMap((t) => t.clips);
  const canPlay = allClips.length > 0;
  const canClear = allClips.length > 0;
  const brainNowPlaying =
    tracks.find((t) => t.id === "brain")?.clips.find((c) => c.state === "playing") ?? null;
  const gutNowPlaying =
    tracks.find((t) => t.id === "gut")?.clips.find((c) => c.state === "playing") ?? null;
  const skinNowPlaying =
    tracks.find((t) => t.id === "skin")?.clips.find((c) => c.state === "playing") ?? null;

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

        // Resolve which file to play BEFORE touching the Audio API. This probes
        // the styled folder, then original/, and only returns null if neither
        // exists — so an empty styled folder never causes a false "Missing file".
        console.log("Selected style:", styleRef.current, "| clip.fileName:", clip.fileName);
        const resolved = await resolvePlayablePath(clip.fileName, styleRef.current);
        if (stopRequestedRef.current) break;
        if (!resolved) {
          updateClipState(trackId, clip.id, "missing");
          setProgressByClipId((p) => ({ ...p, [clip.id]: 1 }));
          continue;
        }
        console.log("Resolved path:", resolved);

        await new Promise<void>((resolve) => {
          const audio = new Audio(resolved);
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
          audio.onerror = () => {
            console.error("Missing audio:", resolved);
            finish("missing");
          };
          audio.onpause = () => {
            if (stopRequestedRef.current) finish("ready");
          };

          void audio.play().catch((err) => {
            console.error("Playback failed:", resolved, err);
            finish("missing");
          });
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

    setTracks((current) =>
      current.map((t) => {
        if (t.id !== trackId) return t;
        const orderIndex = t.clips.length;
        const newClip: Clip = {
          id: crypto.randomUUID(),
          soundId: sound.id,
          trackId,
          name: sound.displayName,
          // Store the exact fileName from config. Playback resolves the style
          // folder (with original/ fallback) at play time from this.
          fileName: sound.fileName,
          midiPath: sound.midiPath,
          orderIndex,
          state: "ready",
          instrumentId: "original",
        };
        return { ...t, clips: [...t.clips, newClip] };
      }),
    );
    if (status !== "Playing") setStatus("Ready");
  };

  // Click-to-add from the Sound Library: route the sound to the active library
  // tab (set by the top button or a track's "+"), so adding always lands on the
  // track the user is browsing.
  const handleAddSoundToTrack = (soundId: string) => {
    handleDropSound(libraryTab, soundId);
  };

  // Open the library scoped to a track (called by the Brain/Gut "+" buttons).
  const openLibraryForTrack = (trackId: TrackId) => {
    setLibraryTab(trackId);
    setLibraryOpen(true);
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
          <h1>Sir Tone&apos;s Music Studio by the Hashemi Lab</h1>
        </div>
        <div className="hero__controls">
          <InstrumentSelector value={styleId} onChange={setStyleId} />
          <div className="hero__actions">
            <button
              type="button"
              className={`pill-btn pill-btn--library ${libraryOpen ? "is-on" : ""}`}
              onClick={() => setLibraryOpen((v) => !v)}
            >
              <span className="pill-btn__icon" aria-hidden>♪</span> Sound Library
            </button>
            <button
              type="button"
              className="pill-btn"
              onClick={() => setHelpOpen(true)}
            >
              <span className="pill-btn__icon" aria-hidden>?</span> How to play
            </button>
          </div>
        </div>
      </header>

      <main className="studio-wrap">
        <TrackList
          tracks={tracks}
          progressByClipId={progressByClipId}
          onDropSound={handleDropSound}
          onRemoveClip={handleRemoveClip}
          onToggleMute={handleToggleMute}
          onOpenLibrary={openLibraryForTrack}
        />

        <NowPlayingPanel
          brain={brainNowPlaying ?? null}
          gut={gutNowPlaying ?? null}
          skin={skinNowPlaying ?? null}
          progressByClipId={progressByClipId}
          styleId={styleId}
        />
      </main>

      <TransportControls
        canPlay={canPlay}
        canClear={canClear}
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        onClear={handleClear}
        status={status}
      />

      <SoundLibrary
        sounds={SOUND_LIBRARY}
        open={libraryOpen}
        tab={libraryTab}
        onTabChange={setLibraryTab}
        onClose={() => setLibraryOpen(false)}
        onAddSound={handleAddSoundToTrack}
      />

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

export default App;
