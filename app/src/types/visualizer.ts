export type VisualizationMode = 'text' | 'orb' | 'bars' | 'spiral' | 'circle' | 'image' | 'pixels';

export type ColorTheme = 'violet' | 'cyan' | 'rose' | 'rainbow';

export interface ThemeConfig {
  name: ColorTheme;
  baseHue: number;
  hueRange: number;
  primary: string;
  secondary: string;
  accent: string;
}

export interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  energy: number;
  hue: number;
}

export interface VisualizerState {
  mode: VisualizationMode;
  theme: ColorTheme;
  sensitivity: number;
  isRunning: boolean;
  fps: number;
}

export const THEMES: Record<ColorTheme, ThemeConfig> = {
  violet: {
    name: 'violet',
    baseHue: 15,
    hueRange: 40,
    primary: '#f05423',
    secondary: '#ff7a4d',
    accent: '#ffaa8a',
  },
  cyan: {
    name: 'cyan',
    baseHue: 185,
    hueRange: 60,
    primary: '#06B6D4',
    secondary: '#22D3EE',
    accent: '#67E8F9',
  },
  rose: {
    name: 'rose',
    baseHue: 340,
    hueRange: 50,
    primary: '#F43F5E',
    secondary: '#FB7185',
    accent: '#FDA4AF',
  },
  rainbow: {
    name: 'rainbow',
    baseHue: 0,
    hueRange: 360,
    primary: '#f05423',
    secondary: '#06B6D4',
    accent: '#F43F5E',
  },
};
