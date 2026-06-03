import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  showPeaks?: boolean;
}

// The SVG viewBox is sized to the measured pixel box (see ResizeObserver below)
// so 1 unit == 1px. That keeps the peak dots perfectly circular at any card
// height instead of stretching into ovals. PAD_Y insets the trace top/bottom.
const PAD_Y = 8;
// Fallback size used for the very first paint, before the box is measured.
const DEFAULT_SIZE = { w: 300, h: 110 };

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
  showPeaks = true,
}: SignalPlotProps) => {
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Measure the rendered box so the SVG works in real pixels (1 unit == 1px).
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize((prev) =>
          prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height },
        );
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const { w, h } = size;

  // Geometry in pixel space. Recomputed when the signal OR the box size changes.
  const geom = useMemo(() => {
    if (!signal) return null;
    const pts = signal.points;
    const maxT = pts[pts.length - 1]?.t || signal.durationSec || 1;
    const xOf = (t: number) => (t / maxT) * w;
    const yOf = (y: number) => h - PAD_Y - y * (h - 2 * PAD_Y);

    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(2)} ${yOf(p.y).toFixed(2)}`)
      .join(" ");
    const area = `${line} L${xOf(maxT).toFixed(2)} ${h} L0 ${h} Z`;
    return { xOf, yOf, line, area, maxT };
  }, [signal, w, h]);

  // Missing / not-yet-loaded -> simple placeholder baseline (never "missing file").
  if (!geom || !signal) {
    return (
      <div ref={hostRef} className="signal-plot__host">
        <svg
          className={`signal-plot signal-plot--${trackId} is-placeholder`}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={loaded ? "Signal unavailable" : "Loading signal"}
        >
          <line
            className="signal-plot__placeholder-line"
            x1="0"
            y1={h / 2}
            x2={w}
            y2={h / 2}
          />
        </svg>
      </div>
    );
  }

  const peaks = signal.peaks.map((pk) => ({
    x: geom.xOf(pk.t),
    y: geom.yOf(pk.y),
    label: pk.label,
  }));

  return (
    <div ref={hostRef} className="signal-plot__host">
      <svg
        className={`signal-plot signal-plot--${trackId}`}
        viewBox={`0 0 ${w} ${h}`}
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
            <circle key={i} className="signal-plot__peak" cx={pk.x} cy={pk.y} r={3}>
              <title>{pk.label}</title>
            </circle>
          ))}
      </svg>
    </div>
  );
};

export default SignalPlot;
