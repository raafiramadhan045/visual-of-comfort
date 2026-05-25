export interface AudioFrameData {
  frequencyData: Uint8Array;
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  isBeat: boolean;
  beatIntensity: number;
}

export type AudioSource = 'mic' | 'file' | 'sample';

export interface AudioState {
  source: AudioSource;
  isPlaying: boolean;
  currentFile: string | null;
  hasPermission: boolean;
  error: string | null;
}
