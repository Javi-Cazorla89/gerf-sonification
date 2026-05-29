export type InstrumentId = "original" | "piano" | "violin" | "synthesiser";

export interface InstrumentOption {
  id: InstrumentId;
  name: string;
  enabled: boolean;
  pathPrefix: string;
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
