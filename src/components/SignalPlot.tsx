import { useEffect, useMemo, useState } from "react";
import type { SoundStyleId, TrackId } from "../types/audio";

// Shape of the precomputed JSON written by scripts/generate_synthetic_signals.py.
interface SignalPoint {
  t: number;
  y: number;
}
interface SignalPeak {
  t: number;
  y: number;
  label: string;
}
interface SignalData {
  synthetic: boolean;
  sourceFile: string;
  durationSec: number;
  points: SignalPoint[];
  peaks: SignalPeak[];
}

interface SignalPlotProps {
  /** Exact .wav filename from the clip (used to derive the JSON base name). */
  fileName: string;
  styleId: SoundStyleId;
  trackId: TrackId;
  /** Clip progress 0..1 (audio.currentTime / audio.duration). Drives the playhead. */
  progress: number;
  showPeaks?: boolean;
}

// SVG canvas units. Scaled to fill the lane via width/height 100% + non-uniform
// preserveAspectRatio, so the trace always spans the full visual box.
const W = 300;
const H = 80;
const PAD_Y = 6;

// Module-level cache so each signal JSON is fetched at most once per session.
// Keyed by the resolved URL. Value is a promise to dedupe concurrent lanes.
const cache = new Map<string, Promise<SignalData | null>>();

async function fetchJson(url: string): Promise<SignalData | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // Vite answers a missing path with index.html (200) — reject HTML so the
    // original/ fallback (and ultimately the placeholder) kicks in.
    if (type.includes("text/html")) return null;
    const data = (await res.json()) as SignalData;
    if (!Array.isArray(data.points) || data.points.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

// Resolve the styled signal first, then fall back to original/ — mirrors the
// audio path resolution so a missing styled file never blanks the plot.
function loadSignal(fileName: string, styleId: SoundStyleId): Promise<SignalData | null> {
  const base = fileName.replace(/\.wav$/i, "");
  const styled = `/signals/${styleId}/${base}.json`;
  const original = `/signals/original/${base}.json`;

  const key = `${styleId}:${base}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = fetchJson(styled).then((d) => d ?? fetchJson(original));
  cache.set(key, promise);
  return promise;
}

const SignalPlot = ({
  fileName,
  styleId,
  trackId,
  progress,
  showPeaks = true,
}: SignalPlotProps) => {
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setSignal(null);
    loadSignal(fileName, styleId).then((data) => {
      if (!alive) return;
      setSignal(data);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [fileName, styleId]);

  // Precompute the SVG geometry once per signal (points don't change at runtime).
  const geom = useMemo(() => {
    if (!signal) return null;
    const pts = signal.points;
    const maxT = pts[pts.length - 1]?.t || signal.durationSec || 1;
    const xOf = (t: number) => (t / maxT) * W;
    const yOf = (y: number) => H - PAD_Y - y * (H - 2 * PAD_Y);

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(2)} ${yOf(p.y).toFixed(2)}`).join(" ");
    const area = `${line} L${W} ${H} L0 ${H} Z`;
    return { xOf, yOf, line, area, maxT };
  }, [signal]);

  const clampProgress = Math.max(0, Math.min(1, progress));

  // Playhead position. points are uniform in time, so the index that matches the
  // current progress is simply progress * (n-1); we interpolate y between samples.
  const playhead = useMemo(() => {
    if (!signal || !geom) return null;
    const pts = signal.points;
    const n = pts.length;
    const fpos = clampProgress * (n - 1);
    const i = Math.floor(fpos);
    const frac = fpos - i;
    const a = pts[i];
    const b = pts[Math.min(n - 1, i + 1)];
    const y = a.y + (b.y - a.y) * frac;
    return { x: clampProgress * W, y: geom.yOf(y) };
  }, [signal, geom, clampProgress]);

  // Missing / not-yet-loaded -> simple placeholder baseline (never "missing file").
  if (!geom || !signal) {
    return (
      <svg
        className={`signal-plot signal-plot--${trackId} is-placeholder`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={loaded ? "Signal unavailable" : "Loading signal"}
      >
        <line
          className="signal-plot__placeholder-line"
          x1="0"
          y1={H / 2}
          x2={W}
          y2={H / 2}
        />
      </svg>
    );
  }

  const peaks = signal.peaks.map((pk) => ({
    x: geom.xOf(pk.t),
    y: geom.yOf(pk.y),
    label: pk.label,
  }));

  return (
    <svg
      className={`signal-plot signal-plot--${trackId}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Synthetic ${trackId} signal`}
    >
      {/* soft fill under the trace */}
      <path className="signal-plot__area" d={geom.area} />
      {/* the signal trace itself */}
      <path className="signal-plot__line" d={geom.line} />

      {/* optional peak markers */}
      {showPeaks &&
        peaks.map((pk, i) => (
          <circle
            key={i}
            className="signal-plot__peak"
            cx={pk.x}
            cy={pk.y}
            r={3}
          >
            <title>{pk.label}</title>
          </circle>
        ))}

      {/* moving playhead synced to clip progress */}
      {playhead && (
        <g className="signal-plot__playhead">
          <line x1={playhead.x} y1="0" x2={playhead.x} y2={H} />
          <circle cx={playhead.x} cy={playhead.y} r={4} />
        </g>
      )}
    </svg>
  );
};

export default SignalPlot;
