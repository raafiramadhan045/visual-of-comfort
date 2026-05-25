import type { AudioFrameData } from '@/types/audio';

const PARTICLE_COUNT = 4000;

interface ImageParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  brightness: number;
  size: number;
  life: number;
  maxLife: number;
  // Where this particle samples color from (fixed to image coords)
  sampleX: number;
  sampleY: number;
}

let particles: ImageParticle[] | null = null;
let imgW = 0;
let imgH = 0;
let sourceImageData: ImageData | null = null;

// Simplex-like noise for flow field
function noise(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 0.01 + t * 0.5) * Math.cos(y * 0.01 + t * 0.3) * 0.5 +
    Math.sin(x * 0.02 - t * 0.4) * Math.cos(y * 0.015 + t * 0.6) * 0.3 +
    Math.sin((x + y) * 0.008 + t * 0.2) * 0.2
  );
}

function noise2(x: number, y: number, t: number): number {
  return (
    Math.cos(x * 0.012 + t * 0.4) * Math.sin(y * 0.008 - t * 0.5) * 0.5 +
    Math.cos(x * 0.018 + t * 0.3) * Math.sin(y * 0.022 + t * 0.7) * 0.3 +
    Math.cos((x - y) * 0.01 + t * 0.35) * 0.2
  );
}

function sampleImageToParticles(
  imageData: ImageData,
  canvasW: number,
  canvasH: number,
): ImageParticle[] {
  const result: ImageParticle[] = [];
  const data = imageData.data;
  const srcW = imageData.width;
  const srcH = imageData.height;

  // Center offset
  const offX = (canvasW - srcW) / 2;
  const offY = (canvasH - srcH) / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Random position within image bounds
    const sx = Math.floor(Math.random() * srcW);
    const sy = Math.floor(Math.random() * srcH);
    const idx = (sy * srcW + sx) * 4;

    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const brightness = (r + g + b) / 3;

    // Bias toward brighter areas (more particles in bright regions)
    if (brightness < 30 && Math.random() > 0.1) continue;

    const x = offX + sx;
    const y = offY + sy;

    result.push({
      x, y,
      vx: 0, vy: 0,
      r, g, b,
      brightness,
      size: 1.5 + (brightness / 255) * 3,
      life: Math.random() * 200,
      maxLife: 150 + Math.random() * 200,
      sampleX: sx,
      sampleY: sy,
    });
  }

  return result;
}

export function renderImagePixel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audio: AudioFrameData,
  _themeName: string,
  sensitivity: number,
  time: number,
  imageSrc: string | null,
) {
  void _themeName;
  const hasAudio = audio.volume > 0.008;

  // No image yet
  if (!imageSrc || !particles) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f05423';
    ctx.fillRect(0, 0, width, height);

    if (!imageSrc) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '500 16px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Upload an image to begin', width / 2, height / 2);
    }
    ctx.restore();
    return;
  }

  const freqLen = audio.frequencyData.length;

  // Short trails for motion blur
  ctx.save();
  ctx.fillStyle = 'rgba(240, 84, 35, 0.15)';
  ctx.fillRect(0, 0, width, height);

  // Draw particles
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // === FLOW FIELD: noise-based vector field ===
    const n1 = noise(p.x, p.y, time * 0.001);
    const n2 = noise2(p.x, p.y, time * 0.001);
    let flowVx = n1 * 2;
    let flowVy = n2 * 2;

    if (hasAudio) {
      // === BASS: vertical wave turbulence ===
      const bassWave = Math.sin(p.x * 0.005 + time * 0.008) * audio.bass * 8 * sensitivity;
      flowVy += bassWave;

      // === MID: horizontal flow surge ===
      const midFlow = Math.cos(p.y * 0.006 + time * 0.006) * audio.mid * 6 * sensitivity;
      flowVx += midFlow;

      // === TREBLE: chaotic scatter ===
      if (audio.treble > 0.2) {
        const trebleSeed = i * 7.31 + time * 0.01;
        flowVx += (Math.sin(trebleSeed) * audio.treble * 12 * sensitivity);
        flowVy += (Math.cos(trebleSeed * 1.3) * audio.treble * 12 * sensitivity);
      }

      // === BEAT: explosive radial burst ===
      if (audio.isBeat) {
        const dx = p.x - width / 2;
        const dy = p.y - height / 2;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const burstForce = audio.beatIntensity * 20 * sensitivity * (1 - dist / (Math.max(width, height) * 0.7));
        if (burstForce > 0) {
          flowVx += (dx / dist) * burstForce;
          flowVy += (dy / dist) * burstForce;
        }
      }

      // Frequency at particle's row drives size pulsing
      const freqIdx = Math.min(freqLen - 1, Math.floor((p.y / height) * freqLen * 0.7));
      const freqVal = audio.frequencyData[freqIdx] / 255;
      p.size = Math.max(0.5, (1.5 + (p.brightness / 255) * 3) * (1 + freqVal * 0.5));
    }

    // Apply velocity with damping
    p.vx = (p.vx + flowVx) * 0.92;
    p.vy = (p.vy + flowVy) * 0.92;

    // Update position
    p.x += p.vx;
    p.y += p.vy;

    // Wrap around edges (infinite canvas feel)
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    // Life cycle: respawn near original sample position
    p.life++;
    if (p.life > p.maxLife) {
      p.life = 0;
      // Respawn near the original image color sample
      if (sourceImageData) {
        const offX = (width - imgW) / 2;
        const offY = (height - imgH) / 2;
        // Add some randomness so it's not identical
        p.x = offX + p.sampleX + (Math.random() - 0.5) * 20;
        p.y = offY + p.sampleY + (Math.random() - 0.5) * 20;
        p.vx = 0;
        p.vy = 0;
      }
    }

    // Fade in/out based on life
    const lifeRatio = p.life / p.maxLife;
    const alpha = lifeRatio < 0.1
      ? lifeRatio / 0.1
      : lifeRatio > 0.8
      ? (1 - lifeRatio) / 0.2
      : 1;

    // Draw particle
    ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + (alpha * 0.85) + ')';
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }

  // Beat flash overlay
  if (audio.isBeat && hasAudio) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (audio.beatIntensity * 0.06) + ')';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

// Called from App.tsx when image is uploaded
export function loadImageForVisualizer(
  file: File,
  canvasWidth: number,
  canvasHeight: number,
  onReady: () => void,
): void {
  const img = new Image();
  img.onload = () => {
    // Resize to fit canvas
    const maxW = canvasWidth * 0.75;
    const maxH = canvasHeight * 0.75;
    let w = img.naturalWidth;
    let h = img.naturalHeight;

    if (w > maxW || h > maxH) {
      const ratio = Math.min(maxW / w, maxH / h);
      w = Math.floor(w * ratio);
      h = Math.floor(h * ratio);
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.drawImage(img, 0, 0, w, h);

    sourceImageData = offCtx.getImageData(0, 0, w, h);
    particles = sampleImageToParticles(sourceImageData, canvasWidth, canvasHeight);
    imgW = w;
    imgH = h;
    onReady();
  };
  img.src = URL.createObjectURL(file);
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename || 'visual-of-comfort.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
