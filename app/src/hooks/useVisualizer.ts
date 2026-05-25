import { useRef, useCallback, useEffect } from 'react';
import type { AudioFrameData } from '@/types/audio';
import type { VisualizationMode, ColorTheme } from '@/types/visualizer';
import { renderOrbPulse } from '@/visualizers/orbPulse';
import { renderFrequencyBars } from '@/visualizers/frequencyBars';
import { renderSpectrumSpiral } from '@/visualizers/spectrumSpiral';
import { renderCircleDistort } from '@/visualizers/circleDistort';
import { renderTextDistort } from '@/visualizers/textDistort';
import { renderMandala } from '@/visualizers/mandala';
import { renderImageParticles } from '@/visualizers/imageParticles';

const DPR = Math.min(window.devicePixelRatio || 1, 2);

interface VisualizerOptions {
  mode: VisualizationMode;
  theme: ColorTheme;
  sensitivity: number;
  customText: string;
  imageSrc?: string | null;
  audioDataRef: React.MutableRefObject<AudioFrameData>;
  isRunningRef: React.MutableRefObject<boolean>;
  analyze: () => AudioFrameData;
}

export function useVisualizer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: VisualizerOptions
) {
  const rafRef = useRef<number>(0);
  const fpsRef = useRef(0);
  const lastTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsUpdateTimeRef = useRef(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const renderFrame = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;

    const ctx = ctxRef.current;
    const width = canvas.width / DPR;
    const height = canvas.height / DPR;

    lastTimeRef.current = time;

    // FPS counter
    frameCountRef.current++;
    if (time - fpsUpdateTimeRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      fpsUpdateTimeRef.current = time;
    }

    if (options.isRunningRef.current) {
      // CRITICAL: Analyze audio FIRST to get fresh frequency data
      const audioData = options.analyze();

      // Dispatch to renderer
      switch (options.mode) {
        case 'text':
          renderTextDistort(ctx, width, height, audioData, options.theme, options.sensitivity, time, options.customText);
          break;
        case 'orb':
          renderOrbPulse(ctx, width, height, audioData, options.theme, options.sensitivity, time, options.customText);
          break;
        case 'bars':
          renderFrequencyBars(ctx, width, height, audioData, options.theme, options.sensitivity, time);
          break;
        case 'spiral':
          renderSpectrumSpiral(ctx, width, height, audioData, options.theme, options.sensitivity, time, options.customText);
          break;
        case 'circle':
          renderCircleDistort(ctx, width, height, audioData, options.theme, options.sensitivity, time);
          break;
        case 'image':
          renderMandala(ctx, width, height, audioData, options.theme, options.sensitivity, time, options.customText);
          break;
        case 'pixels':
          renderImageParticles(ctx, width, height, audioData, options.theme, options.sensitivity, time, options.customText);
          break;
      }
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, [canvasRef, options]);

  // Start/stop loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    // Set canvas size
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Start loop
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(renderFrame);

    // Visibility handler
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(renderFrame);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [canvasRef, renderFrame]);

  return { fpsRef };
}
