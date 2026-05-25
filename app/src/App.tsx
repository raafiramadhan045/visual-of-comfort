import { useState, useRef, useCallback, useEffect } from 'react';
import type { VisualizationMode, ColorTheme } from '@/types/visualizer';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { useVisualizer } from '@/hooks/useVisualizer';
import { downloadCanvasAsPng } from '@/visualizers/textDistort';
import { loadImageForM3, downloadCanvasAsPng as downloadM3 } from '@/visualizers/frequencyBars';
import { loadImageForParticles, downloadCanvasAsPng as downloadImageParticles } from '@/visualizers/imageParticles';
import { downloadTransparentPng } from '@/utils/downloadTransparent';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { ControlDock } from '@/components/ControlDock';
import { StartOverlay } from '@/components/StartOverlay';
import { StatusBar } from '@/components/StatusBar';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizationMode>('text');
  const [theme] = useState<ColorTheme>('violet');
  const [sensitivity, setSensitivity] = useState(2.0);
  const [showStart, setShowStart] = useState(true);
  const [customText, setCustomText] = useState('comfort');
  const [showTextInput, setShowTextInput] = useState(false);
  const isRunningRef = useRef(false);

  const {
    audioDataRef,
    audioState,
    startMic,
    stopMic,
    playFile,
    stopFile,
    togglePlayback,
    playDemo,
    analyze,
    resumeContext,
  } = useAudioAnalyzer();

  // Mirror state in refs for the visualizer
  const modeRef = useRef(mode);
  const themeRef = useRef(theme);
  const sensitivityRef = useRef(sensitivity);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { themeRef.current = theme; }, [sensitivity]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);

  // Start visualizer
  const { fpsRef } = useVisualizer(canvasRef, {
    mode,
    theme,
    sensitivity,
    customText,
    audioDataRef,
    isRunningRef,
    analyze,
  });

  // FPS display state
  const [fps, setFps] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(fpsRef.current);
    }, 500);
    return () => clearInterval(interval);
  }, [fpsRef]);

  // Handle start from overlay
  const handleStart = useCallback(async (source: 'sample' | 'mic') => {
    await resumeContext();
    setShowStart(false);
    isRunningRef.current = true;

    if (source === 'mic') {
      await startMic();
    } else {
      playDemo();
    }
  }, [resumeContext, startMic, playDemo]);

  // Handle file from overlay or dock
  const handleFile = useCallback(async (file: File) => {
    await resumeContext();
    setShowStart(false);
    isRunningRef.current = true;
    await playFile(file);
  }, [resumeContext, playFile]);

  // Handle mode change
  const handleModeChange = useCallback((newMode: VisualizationMode) => {
    setMode(newMode);
    // Show appropriate UI per mode
    if (newMode === 'text' || newMode === 'orb' || newMode === 'spiral' || newMode === 'circle' || newMode === 'image') {
      setShowTextInput(true);
    } else {
      // bars, pixels: no text input
      setShowTextInput(false);
    }
    // bars and pixels modes get image upload UI (handled via mode check in JSX)
  }, []);

  // Handle text change — lowercase supported
  const handleTextChange = useCallback((newText: string) => {
    setCustomText(newText || 'comfort');
  }, []);



  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showStart) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayback();
          break;
        case '1':
          setMode('text');
          setShowTextInput(true);
          break;
        case '2':
          setMode('orb');
          setShowTextInput(true);
          break;
        case '3':
          setMode('bars');
          setShowTextInput(false);
          break;
        case '4':
          setMode('spiral');
          setShowTextInput(true);
          break;
        case '5':
          setMode('circle');
          setShowTextInput(false);
          break;
        case '6':
          setMode('image');
          setShowTextInput(true);
          break;
        case '7':
          setMode('pixels');
          setShowTextInput(false);
          break;
        case 'm':
        case 'M':
          if (audioState.source === 'mic') {
            stopMic();
          } else {
            startMic();
          }
          break;
        case 'f':
        case 'F':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showStart, togglePlayback, audioState.source, startMic, stopMic]);

  // Drag & drop on canvas
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('audio/')) {
        handleFile(file);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [handleFile]);

  // Double-click for fullscreen
  useEffect(() => {
    const handleDblClick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    };
    window.addEventListener('dblclick', handleDblClick);
    return () => window.removeEventListener('dblclick', handleDblClick);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#f05423' }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        role="img"
        aria-label={`Audio visualization in ${mode} mode`}
        style={{ cursor: 'crosshair' }}
      />

      {/* Text Input Overlay */}
      {showTextInput && !showStart && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]">
          <div className="flex flex-col items-center gap-3">
            <input
              type="text"
              value={customText}
              onChange={(e) => handleTextChange(e.target.value)}
              maxLength={15}
              placeholder="TYPE A WORD"
              className="text-center px-6 py-3 text-2xl font-extrabold text-white bg-transparent border-2 border-white rounded-xl outline-none placeholder-white/30"
              style={{
                fontFamily: 'var(--font-poppins), sans-serif',
                letterSpacing: '0.02em',
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTextInput(false)}
                className="px-4 py-1.5 text-xs text-white/60 border border-white/30 rounded-lg hover:bg-white/10 transition-all"
              >
                Done
              </button>
              <DownloadDropdown
                variant="dark"
                onFull={() => {
                  if (canvasRef.current) {
                    downloadCanvasAsPng(canvasRef.current, `voc-${customText}.png`);
                  }
                }}
                onTransparent={() => {
                  if (canvasRef.current) {
                    downloadTransparentPng(canvasRef.current, `voc-${customText}-transparent.png`);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Image Assemble — Upload + Download */}
      {mode === 'bars' && !showStart && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-4 py-2 text-xs text-[#f05423] bg-white border-2 border-white rounded-xl cursor-pointer hover:bg-white/90 transition-all font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Upload Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && canvasRef.current) {
                    const canvas = canvasRef.current;
                    loadImageForM3(file, canvas.width / Math.min(window.devicePixelRatio || 1, 2), canvas.height / Math.min(window.devicePixelRatio || 1, 2), () => {});
                  }
                }}
              />
            </label>
            <DownloadDropdown
              variant="light"
              onFull={() => {
                if (canvasRef.current) {
                  downloadM3(canvasRef.current, 'voc-image-assemble.png');
                }
              }}
              onTransparent={() => {
                if (canvasRef.current) {
                  downloadTransparentPng(canvasRef.current, 'voc-image-assemble-transparent.png');
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Mode 7: Image Upload + Download */}
      {mode === 'pixels' && !showStart && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-4 py-2 text-xs text-[#f05423] bg-white border-2 border-white rounded-xl cursor-pointer hover:bg-white/90 transition-all font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Upload Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && canvasRef.current) {
                    const canvas = canvasRef.current;
                    loadImageForParticles(file, canvas.width / Math.min(window.devicePixelRatio || 1, 2), canvas.height / Math.min(window.devicePixelRatio || 1, 2), () => {});
                  }
                }}
              />
            </label>
            <DownloadDropdown
              variant="light"
              onFull={() => {
                if (canvasRef.current) {
                  downloadImageParticles(canvasRef.current, 'voc-image-particles.png');
                }
              }}
              onTransparent={() => {
                if (canvasRef.current) {
                  downloadTransparentPng(canvasRef.current, 'voc-image-particles-transparent.png');
                }
              }}
            />
          </div>
        </div>
      )}



      {/* Mode 2: Download */}
      {mode === 'orb' && !showStart && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[60]">
          <DownloadDropdown
            variant="light"
            onFull={() => {
              if (canvasRef.current) {
                downloadCanvasAsPng(canvasRef.current, 'voc-healing1.png');
              }
            }}
            onTransparent={() => {
              if (canvasRef.current) {
                downloadTransparentPng(canvasRef.current, 'voc-healing1-transparent.png');
              }
            }}
          />
        </div>
      )}

      {/* Mode 4: Download */}
      {mode === 'spiral' && !showStart && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[60]">
          <DownloadDropdown
            variant="light"
            onFull={() => {
              if (canvasRef.current) {
                downloadCanvasAsPng(canvasRef.current, 'voc-lazyday2.png');
              }
            }}
            onTransparent={() => {
              if (canvasRef.current) {
                downloadTransparentPng(canvasRef.current, 'voc-lazyday2-transparent.png');
              }
            }}
          />
        </div>
      )}

      {/* Mode 5: Download */}
      {mode === 'circle' && !showStart && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[60]">
          <DownloadDropdown
            variant="light"
            onFull={() => {
              if (canvasRef.current) {
                downloadCanvasAsPng(canvasRef.current, 'voc-visualizer.png');
              }
            }}
            onTransparent={() => {
              if (canvasRef.current) {
                downloadTransparentPng(canvasRef.current, 'voc-visualizer-transparent.png');
              }
            }}
          />
        </div>
      )}

      {/* Mode 6: Download */}
      {mode === 'image' && !showStart && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[60]">
          <DownloadDropdown
            variant="light"
            onFull={() => {
              if (canvasRef.current) {
                downloadCanvasAsPng(canvasRef.current, 'voc-release.png');
              }
            }}
            onTransparent={() => {
              if (canvasRef.current) {
                downloadTransparentPng(canvasRef.current, 'voc-release-transparent.png');
              }
            }}
          />
        </div>
      )}

      {/* Start Overlay */}
      {showStart && (
        <StartOverlay
          onStart={handleStart}
          onFileSelect={handleFile}
        />
      )}

      {/* Status Bar */}
      {!showStart && (
        <StatusBar
          source={audioState.source}
          isPlaying={audioState.isPlaying}
          currentFile={audioState.currentFile}
          mode={mode}
          theme={theme}
          fps={fps}
        />
      )}

      {/* Control Dock */}
      {!showStart && (
        <ControlDock
          mode={mode}
          onModeChange={handleModeChange}
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
          source={audioState.source}
          isPlaying={audioState.isPlaying}
          currentFile={audioState.currentFile}
          onStartMic={startMic}
          onStopMic={stopMic}
          onPlayFile={playFile}
          onStopFile={stopFile}
          onTogglePlayback={togglePlayback}
          onPlayDemo={playDemo}
        />
      )}
    </div>
  );
}

export default App;
