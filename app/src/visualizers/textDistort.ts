import type { AudioFrameData } from '@/types/audio';

const GRID_SIZE = 6;

interface HalftoneDot {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  depth: number;
  letterIndex: number;
}

let offscreen: HTMLCanvasElement | null = null;
let offCtx: CanvasRenderingContext2D | null = null;
let lastText = '';
let lastW = 0;
let lastH = 0;
let dots: HalftoneDot[] | null = null;

function sampleTextDepth(text: string, w: number, h: number): ImageData {
  if (!offscreen || !offCtx) {
    offscreen = document.createElement('canvas');
    offCtx = offscreen.getContext('2d', { willReadFrequently: true })!;
  }
  offscreen.width = w;
  offscreen.height = h;

  offCtx.fillStyle = '#ffffff';
  offCtx.fillRect(0, 0, w, h);

  const fontSize = Math.min(w / (text.length * 0.6), h * 0.35);
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.font = '900 ' + fontSize + 'px Poppins, sans-serif';
  offCtx.fillStyle = '#000000';
  offCtx.fillText(text, w / 2, h / 2);

  offCtx.filter = 'blur(6px)';
  offCtx.globalAlpha = 0.6;
  offCtx.fillText(text, w / 2, h / 2);
  offCtx.filter = 'none';
  offCtx.globalAlpha = 1;

  return offCtx.getImageData(0, 0, w, h);
}

function buildDots(w: number, h: number, img: ImageData, text: string): HalftoneDot[] {
  const result: HalftoneDot[] = [];
  const data = img.data;
  const stride = img.width;
  const letterWidth = w / text.length;

  for (let gy = 0; gy < h; gy += GRID_SIZE) {
    for (let gx = 0; gx < w; gx += GRID_SIZE) {
      const idx = (gy * stride + gx) * 4;
      const r = data[idx];

      if (r < 240) {
        const depth = Math.max(0, Math.min(1, (240 - r) / 200));
        const letterIndex = Math.min(text.length - 1, Math.floor(gx / letterWidth));
        result.push({
          x: gx, y: gy, baseX: gx, baseY: gy,
          depth, letterIndex,
        });
      }
    }
  }

  return result;
}

export function renderTextDistort(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audio: AudioFrameData,
  _themeName: string,
  sensitivity: number,
  _time: number,
  customText: string,
) {
  void _themeName;
  void _time;
  const text = customText || 'comfort';
  const hasAudio = audio.volume > 0.008;
  const freqLen = audio.frequencyData.length;

  const needsRebuild = !dots || text !== lastText || width !== lastW || height !== lastH;
  if (needsRebuild) {
    const img = sampleTextDepth(text, width, height);
    dots = buildDots(width, height, img, text);
    lastText = text;
    lastW = width;
    lastH = height;
  }

  if (!dots) return;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f05423';
  ctx.fillRect(0, 0, width, height);

  const numLetters = text.length;

  for (let i = 0; i < dots.length; i++) {
    const d = dots[i];

    const freqIdx = Math.min(freqLen - 1, Math.floor((d.baseY / height) * freqLen * 0.8));
    const vertFreqVal = audio.frequencyData[freqIdx] / 255;

    // === ACTIVE: Displace dots based on audio ===
    if (hasAudio) {
      // Per-letter independence: each letter responds to a different freq band
      const letterBandStart = Math.floor((d.letterIndex / numLetters) * freqLen * 0.5);
      const letterFreqIdx = letterBandStart + Math.floor((d.baseY / height) * freqLen * 0.15);
      const letterFreqVal = audio.frequencyData[Math.min(freqLen - 1, letterFreqIdx)] / 255;

      // Letter displacement: subtle independent movement per letter
      d.baseX += (letterFreqVal - 0.5) * 0.3 * sensitivity * d.depth;
      d.baseY += Math.sin(d.letterIndex * 2.5) * letterFreqVal * 0.2 * sensitivity;

      // Treble = explosive outward push in RANDOM directions on beats
      if (audio.isBeat && audio.treble > 0.15) {
        const scatterAngle = Math.random() * Math.PI * 2;
        const scatterForce = audio.beatIntensity * audio.treble * 25 * sensitivity * d.depth;
        d.x = (d.x || d.baseX) + Math.cos(scatterAngle) * scatterForce;
        d.y = (d.y || d.baseY) + Math.sin(scatterAngle) * scatterForce;
      }
    }

    // Spring back: dots gradually return toward their displaced base position
    // This runs always (even when silent), so dots stay at last distorted position
    const targetX = d.baseX;
    const targetY = d.baseY;
    d.x = ((d.x || targetX) - targetX) * 0.94 + targetX;
    d.y = ((d.y || targetY) - targetY) * 0.94 + targetY;

    // Dot size: depth-based, with audio boost
    const sizeBoost = hasAudio ? vertFreqVal * 2 * sensitivity : 0;
    const baseR = 1.2 + d.depth * 3.5;
    const r = Math.max(0.3, baseR + sizeBoost);

    // Draw dot
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    const brightness = hasAudio ? 0.7 + d.depth * 0.3 : 0.5 + d.depth * 0.2;
    ctx.fillStyle = 'rgba(255, 255, 255, ' + brightness + ')';
    ctx.fill();
  }

  // Beat flash
  if (audio.isBeat && hasAudio) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (audio.beatIntensity * audio.treble * 0.1) + ')';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename || 'visual-of-comfort.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
