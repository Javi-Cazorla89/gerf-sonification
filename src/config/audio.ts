import type {
  InstrumentOption,
  SoundCategory,
  SoundDefinition,
  SoundStyleId,
  SoundStyleOption,
  TrackModel,
} from "../types/audio";

export const INSTRUMENTS: InstrumentOption[] = [
  { id: "original", name: "Original", enabled: true, pathPrefix: "/audio" },
  { id: "piano", name: "Piano", enabled: false, pathPrefix: "/audio/piano" },
  { id: "violin", name: "Violin", enabled: false, pathPrefix: "/audio/violin" },
  { id: "synthesiser", name: "Synthesiser", enabled: false, pathPrefix: "/audio/synthesiser" },
];

// "Sir Tone plays …" segmented-control options. Each style is a FOLDER under
// public/audio holding the same filenames as original/. When a styled file is
// missing, playback falls back to original/ (see stylePath / originalPath).
export const SOUND_STYLES: SoundStyleOption[] = [
  { id: "strings", name: "String Orchestra", folder: "strings" },
  { id: "electronic", name: "Electronic", folder: "electronic" },
  { id: "funny", name: "Funny", folder: "funny" },
];

// The default style selected on load.
export const DEFAULT_STYLE_ID: SoundStyleId = "funny";

// Path builders — the ONLY place audio URLs are assembled. Both take the exact
// fileName from config (never a displayName) and pick a folder.
export const originalPath = (fileName: string): string => `/audio/original/${fileName}`;
export const stylePath = (style: SoundStyleId, fileName: string): string =>
  `/audio/${style}/${fileName}`;

const BRAIN_TOKENS = ["brain", "neuron", "neural", "raphe", "stem", "serotonergic"];
const SKIN_TOKENS = ["skin", "dermal", "epidermis", "tissue", "skin_organoid", "skin-cell", "skin_cell"];
const GUT_TOKENS = ["gut", "organoid", "intestinal", "enterochromaffin", "zb"];

const inferCategory = (fileName: string): SoundCategory => {
  const lower = fileName.toLowerCase();
  // Skin is checked before Gut so a hypothetical "skin_organoid" lands on Skin.
  if (BRAIN_TOKENS.some((token) => lower.includes(token))) return "brain";
  if (SKIN_TOKENS.some((token) => lower.includes(token))) return "skin";
  if (GUT_TOKENS.some((token) => lower.includes(token))) return "gut";
  return "unassigned";
};

// Friendly label for the UI only — NEVER used to build a file path.
// Strips the drug-state token; that is surfaced separately as an uppercase tag.
const prettify = (fileName: string): string =>
  fileName
    .replace(/\.wav$/i, "")
    .replace(/_?(no|pre|post)-drug/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Pre/post/no-drug surfaced as a clearly apparent uppercase tag.
const drugTag = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.includes("post-drug")) return "[POST-DRUG]";
  if (lower.includes("pre-drug")) return "[PRE-DRUG]";
  if (lower.includes("no-drug")) return "[NO-DRUG]";
  return "";
};

// Gut lineage pulled straight from the filename, e.g. "organoid2" -> "organoid 2".
const gutLineage = (fileName: string): string => {
  const match = fileName.toLowerCase().match(/organoid\s*([0-9]+)/);
  return match ? `organoid ${match[1]}` : "organoid";
};

// Minimal distinguisher for gut clips that share a lineage — the activity
// descriptor between the organoid token and the drug state, e.g. "1peak".
const gutVariant = (fileName: string): string => {
  const match = fileName
    .toLowerCase()
    .match(/organoid[0-9]+_(.+?)_(?:no|pre|post)-drug/);
  return match ? match[1].replace(/[_-]+/g, " ") : "";
};

// UI label per category:
//  - brain: flagged as a female lineage, descriptive detail kept.
//  - gut: labeled ONLY by lineage (organoid number), peaks/noise detail dropped.
//  - skin/other: prettified filename.
// Every label ends with the drug-state tag when present.
const labelFor = (fileName: string, category: SoundCategory): string => {
  const tag = drugTag(fileName);
  const base =
    category === "brain"
      ? `Female ${prettify(fileName)}`
      : category === "gut"
        ? `Gut ${gutLineage(fileName)}${gutVariant(fileName) ? ` · ${gutVariant(fileName)}` : ""}`
        : prettify(fileName);
  return [base, tag].filter(Boolean).join(" ");
};

/**
 * SOURCE OF TRUTH — the real playable files in public/audio.
 *
 * Rules enforced here:
 *  - `wav` is the EXACT .wav filename on disk (the only playable format). The
 *    same filename exists in every style folder (original/strings/electronic/funny).
 *  - `midi` is an optional EXACT .mid filename that lives alongside the original
 *    wav; it is attached as metadata only and is never played.
 *  - filePath is always originalPath(wav) — no reconstruction from names/ids.
 *
 * Verified against `find public/audio/original -maxdepth 1 -type f` (14 wavs):
 *  brain ×5, gut ×6, skin ×3. Every entry has a paired .mid on disk.
 */
const AUDIO_ENTRIES: { wav: string; midi?: string }[] = [
  // --- Brain ---
  { wav: "brain_diffusion_3peaks_no-drug.wav", midi: "brain_diffusion_3peaks_no-drug.mid" },
  { wav: "brain_diffusion_noise_no-drug.wav", midi: "brain_diffusion_noise_no-drug.mid" },
  { wav: "brain_very-frequent_1peak_no-drug.wav", midi: "brain_very-frequent_1peak_no-drug.mid" },
  { wav: "brain_very-frequent_2peaks_no-drug.wav", midi: "brain_very-frequent_2peaks_no-drug.mid" },
  { wav: "brain_very-frequent_noise_no-drug.wav", midi: "brain_very-frequent_noise_no-drug.mid" },
  // --- Gut ---
  { wav: "gut_organoid2_1peak_post-drug.wav", midi: "gut_organoid2_1peak_post-drug.mid" },
  { wav: "gut_organoid2_3peaks_post-drug.wav", midi: "gut_organoid2_3peaks_post-drug.mid" },
  { wav: "gut_organoid2_low-noise_post-drug.wav", midi: "gut_organoid2_low-noise_post-drug.mid" },
  { wav: "gut_organoid3_2peaks_post-drug.wav", midi: "gut_organoid3_2peaks_post-drug.mid" },
  { wav: "gut_organoid3_3peaks_post-drug.wav", midi: "gut_organoid3_3peaks_post-drug.mid" },
  { wav: "gut_organoid3_noise_pre-drug.wav", midi: "gut_organoid3_noise_pre-drug.mid" },
  // --- Skin ---
  { wav: "skin_HSKC.wav", midi: "skin_HSKC.mid" },
  { wav: "skin_ORSKC.wav", midi: "skin_ORSKC.mid" },
  { wav: "skin_OSKC.wav", midi: "skin_OSKC.mid" },
];

export const SOUND_LIBRARY: SoundDefinition[] = AUDIO_ENTRIES.map(({ wav, midi }) => {
  const category = inferCategory(wav);
  return {
    id: wav.replace(/\.wav$/i, ""),
    displayName: labelFor(wav, category),
    fileName: wav,
    filePath: originalPath(wav),
    midiPath: midi ? originalPath(midi) : undefined,
    defaultTrackId: category,
    category,
  };
});

export const INITIAL_TRACKS: TrackModel[] = [
  { id: "brain", name: "Brain", clips: [], muted: false },
  { id: "gut", name: "Gut", clips: [], muted: false },
  { id: "skin", name: "Skin", clips: [], muted: false },
];
