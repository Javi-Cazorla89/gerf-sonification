export type InstrumentId = "original" | "piano" | "violin" | "synthesiser";

export interface InstrumentOption {
  id: InstrumentId;
  name: string;
  enabled: boolean;
  pathPrefix: string;
}

// The playful "Sir Tone plays …" styles shown in the UI. Each style maps to a
// folder under public/audio (strings / electronic / funny). When a styled file
// is missing, playback falls back to public/audio/original.
export type SoundStyleId = "strings" | "electronic" | "funny";

export interface SoundStyleOption {
  id: SoundStyleId;
  name: string;
  icon: string;
  /** Folder under /audio that holds this style's files (same filenames as original). */
  folder: SoundStyleId;
}

export type TrackId = "brain" | "gut" | "skin";
export type DefaultTrackId = TrackId | "unassigned";

export type SoundCategory = "brain" | "gut" | "skin" | "unassigned";

export interface SoundDefinition {
  id: string;
  displayName: string;
  fileName: string;
  filePath: string;
  midiPath?: string;
  defaultTrackId: DefaultTrackId;
  category: SoundCategory;
}

export type ClipState = "ready" | "playing" | "finished" | "missing";

export interface Clip {
  id: string;
  soundId: string;
  trackId: TrackId;
  name: string;
  /** Exact .wav filename from config — playback resolves the style folder from this. */
  fileName: string;
  midiPath?: string;
  duration?: number;
  orderIndex: number;
  state: ClipState;
  instrumentId: InstrumentId;
}

export interface TrackModel {
  id: TrackId;
  name: string;
  clips: Clip[];
  muted?: boolean;
}

export type Status =
  | "Ready"
  | "Playing"
  | "Stopped"
  | "Finished"
  | "Missing file";
