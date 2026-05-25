import { X, Keyboard } from 'lucide-react';

interface HelpPanelProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', description: 'Play / Pause file playback' },
  { key: '1', description: 'Switch to Text Distort' },
  { key: '2', description: 'Switch to Assemble' },
  { key: '3', description: 'Switch to Frequency Bars' },
  { key: '4', description: 'Switch to Spectrum Spiral' },
  { key: '5', description: 'Switch to Circle Distort' },
  { key: '6', description: 'Switch to Text Particles' },
  { key: '7', description: 'Switch to Image Particles' },
  { key: 'M', description: 'Toggle microphone' },
  { key: 'F', description: 'Toggle fullscreen' },
  { key: 'H', description: 'Toggle this help panel' },
];

export function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        background: 'rgba(240, 84, 35, 0.85)',
      }}
      onClick={onClose}
    >
      <div
        className="relative p-6 rounded-2xl border-2 max-w-md w-full mx-4"
        style={{
          background: '#ffffff',
          borderColor: '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[#f05423]" />
            <h2
              className="text-lg font-semibold text-[#f05423]"
              style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#f05423] hover:bg-[#f05423]/10 transition-all focus:outline-none focus:ring-2 focus:ring-[#f05423]/50"
            aria-label="Close help"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: 'rgba(240, 84, 35, 0.06)' }}
            >
              <span className="text-[#f05423]/80 text-sm">{shortcut.description}</span>
              <kbd
                className="px-2 py-1 rounded text-xs border-2 border-[#f05423] text-[#f05423] font-medium"
                style={{
                  fontFamily: 'var(--font-poppins), monospace',
                }}
              >
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <p className="mt-4 text-xs text-[#f05423]/50 text-center">
          You can also drag & drop audio files directly onto the canvas
        </p>
      </div>
    </div>
  );
}
