import { useRef } from 'react';
import {
  Mic,
  MicOff,
  Upload,
  Play,
  Pause,
  Square,
  Volume2,
  Music,
} from 'lucide-react';
import type { VisualizationMode } from '@/types/visualizer';
import type { AudioSource } from '@/types/audio';

interface ControlDockProps {
  mode: VisualizationMode;
  onModeChange: (mode: VisualizationMode) => void;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  source: AudioSource;
  isPlaying: boolean;
  currentFile: string | null;
  onStartMic: () => void;
  onStopMic: () => void;
  onPlayFile: (file: File) => void;
  onStopFile: () => void;
  onTogglePlayback: () => void;
  onPlayDemo: () => void;
}

const MODES: { id: VisualizationMode; num: string; label: string }[] = [
  { id: 'text', num: '1', label: 'Lazy day' },
  { id: 'orb', num: '2', label: 'Healing 1' },
  { id: 'bars', num: '3', label: 'Healing 2' },
  { id: 'spiral', num: '4', label: 'Lazy day 2' },
  { id: 'circle', num: '5', label: 'visualizer' },
  { id: 'image', num: '6', label: 'release' },
  { id: 'pixels', num: '7', label: 'release 2' },
];

export function ControlDock({
  mode,
  onModeChange,
  sensitivity,
  onSensitivityChange,
  source,
  isPlaying,
  currentFile,
  onStartMic,
  onStopMic,
  onPlayFile,
  onStopFile,
  onTogglePlayback,
  onPlayDemo,
}: ControlDockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (source === 'mic') onStopMic();
      onPlayFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      if (source === 'mic') onStopMic();
      onPlayFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="fixed bottom-4 md:bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 rounded-2xl border transition-all duration-300 max-w-[95vw]"
      style={{
        background: '#ffffff',
        border: '2px solid #ffffff',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Source toggle */}
      <div className="flex items-center gap-1">
        <button
          onClick={source === 'mic' ? onStopMic : onStartMic}
          className={`p-2 md:p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f05423]/50 ${
            source === 'mic'
              ? 'bg-[#f05423] text-white'
              : 'text-[#f05423] hover:bg-[#f05423]/10'
          }`}
          title={source === 'mic' ? 'Disable microphone' : 'Enable microphone'}
          aria-label={source === 'mic' ? 'Disable microphone' : 'Enable microphone'}
        >
          {source === 'mic' ? <Mic size={16} className="md:w-[18px] md:h-[18px]" /> : <MicOff size={16} className="md:w-[18px] md:h-[18px]" />}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 md:p-2.5 rounded-xl text-[#f05423] hover:bg-[#f05423]/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f05423]/50"
          title="Upload audio file"
          aria-label="Upload audio file"
        >
          <Upload size={16} className="md:w-[18px] md:h-[18px]" />
        </button>

        <button
          onClick={onPlayDemo}
          className={`p-2 md:p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f05423]/50 ${
            currentFile === 'Demo Audio'
              ? 'bg-[#f05423] text-white'
              : 'text-[#f05423] hover:bg-[#f05423]/10'
          }`}
          title="Play demo audio"
          aria-label="Play demo audio"
        >
          <Music size={16} className="md:w-[18px] md:h-[18px]" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Divider */}
      <div className="hidden md:block w-px h-8 bg-[#f05423]/10" />

      {/* Mode numbers */}
      <div className="flex items-center gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs md:text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f05423]/50 ${
              mode === m.id
                ? 'bg-[#f05423] text-white'
                : 'text-[#f05423] hover:bg-[#f05423]/10'
            }`}
            title={m.label}
            aria-label={m.label}
          >
            {m.num}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="hidden md:block w-px h-8 bg-[#f05423]/10" />

      {/* Sensitivity */}
      <div className="flex items-center gap-2">
        <Volume2 size={12} className="text-[#f05423]/60 md:w-[14px] md:h-[14px]" />
        <input
          type="range"
          min="0.5"
          max="5.0"
          step="0.25"
          value={sensitivity}
          onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
          className="w-16 md:w-24 h-1 rounded-full appearance-none cursor-pointer bg-[#f05423]/20 accent-[#f05423] focus:outline-none"
          aria-label="Sensitivity"
        />
        <span className="text-[#f05423]/60 text-[10px] md:text-xs tabular-nums w-6 md:w-8">{sensitivity.toFixed(1)}x</span>
      </div>

      {/* File controls */}
      {source === 'file' && currentFile && (
        <>
          <div className="hidden md:block w-px h-8 bg-[#f05423]/10" />
          <div className="flex items-center gap-1">
            <button
              onClick={onTogglePlayback}
              className="p-2 md:p-2.5 rounded-xl text-[#f05423] hover:bg-[#f05423]/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f05423]/50"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={16} className="md:w-[18px] md:h-[18px]" /> : <Play size={16} className="md:w-[18px] md:h-[18px]" />}
            </button>
            <button
              onClick={onStopFile}
              className="p-2 md:p-2.5 rounded-xl text-[#f05423] hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              title="Stop"
              aria-label="Stop"
            >
              <Square size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
