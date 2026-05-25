import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';

interface DownloadDropdownProps {
  onFull: () => void;
  onTransparent: () => void;
  variant?: 'light' | 'dark';
}

export function DownloadDropdown({ onFull, onTransparent, variant = 'light' }: DownloadDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isLight = variant === 'light';

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl border-2 transition-all font-medium ${
          isLight
            ? 'text-white border-white hover:bg-white/10'
            : 'text-[#f05423] bg-white border-white hover:bg-white/90'
        }`}
      >
        <Download size={14} />
        <span>Download PNG</span>
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col gap-1 px-2 py-2 rounded-xl border-2 min-w-[140px]"
          style={{
            background: '#ffffff',
            borderColor: '#ffffff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <button
            onClick={() => {
              onFull();
              setOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#f05423] rounded-lg hover:bg-[#f05423]/10 transition-all text-left font-medium"
          >
            <span className="w-4 h-4 rounded-sm border border-[#f05423]/30 flex items-center justify-center text-[8px]">&#9632;</span>
            Full
          </button>
          <div className="h-px bg-[#f05423]/10 mx-1" />
          <button
            onClick={() => {
              onTransparent();
              setOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#f05423] rounded-lg hover:bg-[#f05423]/10 transition-all text-left font-medium"
          >
            <span className="w-4 h-4 rounded-sm border border-[#f05423]/30 flex items-center justify-center text-[8px]">&#9633;</span>
            Particles Only
          </button>
        </div>
      )}
    </div>
  );
}
