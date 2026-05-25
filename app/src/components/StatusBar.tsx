import type { VisualizationMode, ColorTheme } from '@/types/visualizer';
import type { AudioSource } from '@/types/audio';

interface StatusBarProps {
  source: AudioSource;
  isPlaying: boolean;
  currentFile: string | null;
  mode: VisualizationMode;
  theme: ColorTheme;
  fps: number;
}

const MODE_LABELS: Record<VisualizationMode, string> = {
  text: 'Lazy day',
  orb: 'Healing 1',
  image: 'release',
  pixels: 'release 2',
  bars: 'Healing 2',
  spiral: 'Lazy day 2',
  circle: 'visualizer',
};

export function StatusBar({ source, isPlaying, currentFile, mode, theme, fps }: StatusBarProps) {
  const isActive = isPlaying;

  return (
    <div
      className="fixed top-4 left-4 z-50 flex items-center gap-4 px-4 py-2 rounded-xl text-xs"
      style={{
        background: '#ffffff',
        border: '2px solid #ffffff',
        fontFamily: 'var(--font-poppins), monospace',
      }}
    >
      {/* Status LED */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isActive ? 'animate-pulse' : ''
          }`}
          style={{
            backgroundColor: isActive
              ? source === 'mic'
                ? '#22c55e'
                : '#f05423'
              : '#ef4444',
          }}
        />
        <span className="text-[#f05423]/70">
          {isActive
            ? source === 'mic'
              ? 'Mic Active'
              : source === 'file'
              ? 'File Playing'
              : 'Sample'
            : 'Idle'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-3 bg-[#f05423]/20" />

      {/* Mode */}
      <span className="text-[#f05423] font-medium">{MODE_LABELS[mode]}</span>

      {/* Theme */}
      <span className="text-[#f05423]/50 capitalize">{theme}</span>

      {/* Filename */}
      {currentFile && (
        <>
          <div className="w-px h-3 bg-[#f05423]/20" />
          <span className="text-[#f05423]/70 truncate max-w-[200px]">{currentFile}</span>
        </>
      )}

      {/* FPS */}
      <div className="w-px h-3 bg-[#f05423]/20" />
      <span className="text-[#f05423]/50 tabular-nums">{fps} fps</span>
    </div>
  );
}
