export type InstrumentId = "original" | "piano" | "violin" | "synthesiser";

export interface InstrumentOption {
  id: InstrumentId;
  name: string;
  enabled: boolean;
  pathPrefix: string;
}

// The playful "Sir Tone plays …" styles shown in the UI. These currently all
// map to the original recordings (no styled audio files exist yet) but drive
// the segmented-control selector.
export type SoundStyleId = "classical" | "electronic" | "funny";

export interface SoundStyleOption {
  id: SoundStyleId;
  name: string;
  icon: string;
  /** The instrument bank this style maps to until styled audio exists. */
  instrumentId: InstrumentId;
}

export type TrackId = "brain" | "gut";
export type DefaultTrackId = TrackId | "unassigned";

export type SoundCategory = "brain" | "gut" | "unassigned";

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
  filePath: string;
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
