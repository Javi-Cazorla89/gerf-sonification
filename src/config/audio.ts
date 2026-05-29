import type {
  InstrumentId,
  InstrumentOption,
  SoundCategory,
  SoundDefinition,
  TrackModel,
} from "../types/audio";

export const INSTRUMENTS: InstrumentOption[] = [
  { id: "original", name: "Original", enabled: true, pathPrefix: "/audio" },
  { id: "piano", name: "Piano", enabled: false, pathPrefix: "/audio/piano" },
  { id: "violin", name: "Violin", enabled: false, pathPrefix: "/audio/violin" },
  { id: "synthesiser", name: "Synthesiser", enabled: false, pathPrefix: "/audio/synthesiser" },
];

const BRAIN_TOKENS = ["brain", "neuron", "neural", "raphe", "stem", "serotonergic"];
const GUT_TOKENS = ["gut", "organoid", "intestinal", "enterochromaffin", "zb"];

const inferCategory = (fileName: string): SoundCategory => {
  const lower = fileName.toLowerCase();
  if (BRAIN_TOKENS.some((token) => lower.includes(token))) return "brain";
  if (GUT_TOKENS.some((token) => lower.includes(token))) return "gut";
  return "unassigned";
};

const prettify = (fileName: string): string =>
  fileName
    .replace(/\.(wav|mp3|mid)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bno drug\b/gi, "(no drug)")
    .replace(/\bpre drug\b/gi, "(pre-drug)")
    .replace(/\bpost drug\b/gi, "(post-drug)")
    .replace(/\s+/g, " ")
    .trim();

// Actual audio files in public/audio. Append here when adding more.
const AUDIO_FILES = [
  "ZB5_peaks_PSD.wav",
  "ZB5_peaks_PRD.wav",
  "ZB5_noise_PSD.wav",
  "ZB5_noise_PRD.wav",
  "brain_diffusion_3peaks_no-drug.wav",
  "brain_diffusion_noise_no-drug.wav",
  "brain_very-frequent_1peak_no-drug.wav",
  "brain_very-frequent_2peaks_no-drug.wav",
  "brain_very-frequent_noise_no-drug.wav",
  "gut_organoid2_1peak_post-drug.wav",
  "gut_organoid2_3peaks_post-drug.wav",
  "gut_organoid2_low-noise_post-drug.wav",
  "gut_organoid3_2peaks_post-drug.wav",
  "gut_organoid3_3peaks_post-drug.wav",
  "gut_organoid3_noise_pre-drug.wav",
];

// .mid files paired with wavs (for future MIDI note-level visualisation).
const MIDI_FILES = new Set([
  "brain_diffusion_3peaks_no-drug.mid",
  "brain_diffusion_noise_no-drug.mid",
  "brain_very-frequent_1peak_no-drug.mid",
  "brain_very-frequent_2peaks_no-drug.mid",
  "brain_very-frequent_noise_no-drug.mid",
  "gut_organoid2_1peak_post-drug.mid",
  "gut_organoid2_3peaks_post-drug.mid",
  "gut_organoid2_low-noise_post-drug.mid",
  "gut_organoid3_2peaks_post-drug.mid",
  "gut_organoid3_3peaks_post-drug.mid",
  "gut_organoid3_noise_pre-drug.mid",
]);

export const SOUND_LIBRARY: SoundDefinition[] = AUDIO_FILES.map((fileName) => {
  const category = inferCategory(fileName);
  const id = fileName.replace(/\.(wav|mp3)$/i, "");
  const midiName = `${id}.mid`;
  return {
    id,
    displayName: prettify(fileName),
    fileName,
    filePath: `/audio/${fileName}`,
    midiPath: MIDI_FILES.has(midiName) ? `/audio/${midiName}` : undefined,
    defaultTrackId: category,
    category,
  };
});

export const INITIAL_TRACKS: TrackModel[] = [
  { id: "brain", name: "Brain", clips: [], muted: false },
  { id: "gut", name: "Gut", clips: [], muted: false },
];

export const getAudioPath = (sound: SoundDefinition, instrumentId: InstrumentId): string => {
  const instrument = INSTRUMENTS.find((option) => option.id === instrumentId) ?? INSTRUMENTS[0];
  if (!instrument.enabled || instrument.id === "original") {
    return sound.filePath;
  }
  return `${instrument.pathPrefix}/${sound.fileName}`;
};
