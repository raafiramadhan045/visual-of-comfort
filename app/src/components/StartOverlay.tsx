import { useState } from 'react';
import { Mic, Music, Upload } from 'lucide-react';

interface StartOverlayProps {
  onStart: (source: 'sample' | 'mic') => void;
  onFileSelect: (file: File) => void;
}

export function StartOverlay({ onStart, onFileSelect }: StartOverlayProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const getContainerStyle = (id: string) => {
    const isHover = hovered === id;
    return {
      background: isHover ? '#ffffff' : '#f05423',
      border: '2px solid #ffffff',
      color: isHover ? '#f05423' : '#ffffff',
      transform: isHover ? 'scale(1.03)' : 'scale(1)',
      transition: 'all 0.2s ease',
    } as React.CSSProperties;
  };

  const getIconCircleStyle = (id: string) => {
    const isHover = hovered === id;
    return {
      background: isHover ? '#f05423' : '#ffffff',
      border: '2px solid',
      borderColor: isHover ? '#ffffff' : '#f05423',
      transition: 'all 0.2s ease',
    } as React.CSSProperties;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{ background: '#f05423' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Logo */}
      <div className="mb-8 md:mb-12">
        <img
          src="./logo.png"
          alt="Visual of Comfort"
          className="h-36 md:h-48 w-auto object-contain"
          draggable={false}
        />
      </div>

      {/* Options - vertical on mobile, horizontal on desktop */}
      <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
        {/* Sample Audio */}
        <button
          onClick={() => onStart('sample')}
          onMouseEnter={() => setHovered('sample')}
          onMouseLeave={() => setHovered(null)}
          className="flex flex-row md:flex-col items-center gap-3 px-6 md:px-8 py-4 md:py-6 rounded-2xl cursor-pointer"
          style={getContainerStyle('sample')}
        >
          <div
            className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0"
            style={getIconCircleStyle('sample')}
          >
            <Music
              size={20}
              style={{ color: hovered === 'sample' ? '#ffffff' : '#f05423' }}
            />
          </div>
          <span className="text-sm font-medium">Demo Audio</span>
        </button>

        {/* Microphone */}
        <button
          onClick={() => onStart('mic')}
          onMouseEnter={() => setHovered('mic')}
          onMouseLeave={() => setHovered(null)}
          className="flex flex-row md:flex-col items-center gap-3 px-6 md:px-8 py-4 md:py-6 rounded-2xl cursor-pointer"
          style={getContainerStyle('mic')}
        >
          <div
            className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0"
            style={getIconCircleStyle('mic')}
          >
            <Mic
              size={20}
              style={{ color: hovered === 'mic' ? '#ffffff' : '#f05423' }}
            />
          </div>
          <span className="text-sm font-medium">Microphone</span>
        </button>

        {/* File Upload */}
        <label
          onMouseEnter={() => setHovered('file')}
          onMouseLeave={() => setHovered(null)}
          className="flex flex-row md:flex-col items-center gap-3 px-6 md:px-8 py-4 md:py-6 rounded-2xl cursor-pointer"
          style={getContainerStyle('file')}
        >
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <div
            className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0"
            style={getIconCircleStyle('file')}
          >
            <Upload
              size={20}
              style={{ color: hovered === 'file' ? '#ffffff' : '#f05423' }}
            />
          </div>
          <span className="text-sm font-medium">Upload File</span>
        </label>
      </div>

      {/* Drag drop hint */}
      <p
        className="mt-8 text-white/50 text-xs text-center"
        style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
      >
        or drag &amp; drop an audio file anywhere
      </p>
    </div>
  );
}
