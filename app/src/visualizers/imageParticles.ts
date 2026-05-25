import type { AudioFrameData } from '@/types/audio';

const PARTICLE_DENSITY = 5;

interface ImageParticle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  maxScatterX: number;
  maxScatterY: number;
  scatterAmt: number;
  vx: number;
  vy: number;
  size: number;
  // Color sampled from image
  r: number;
  g: number;
  b: number;
  brightness: number;
  // Normalized position (0-1) for diagonal scatter wave
  normalizedX: number;
  normalizedY: number;
  seed: number;
}

let particles: ImageParticle[] | null = null;
let hasImage = false;
let imgOriginalW = 0;
let imgOriginalH = 0;
let scatterWave = 0;

// Compute centering offset at render time (handles canvas resize)
function getImageOffset(canvasW: number, canvasH: number) {
  const offsetX = (canvasW - imgOriginalW) / 2;
  const offsetY = (canvasH - imgOriginalH) / 2;
  return { offsetX, offsetY };
}

export function loadImageForParticles(
  file: File,
  canvasWidth: number,
  canvasHeight: number,
  onReady: () => void,
): void {
  const img = new Image();
  img.onload = () => {
    const offscreen = document.createElement('canvas');

    // Fit image to canvas (max 40% of canvas — smaller preview)
    const maxW = canvasWidth * 0.4;
    const maxH = canvasHeight * 0.4;
    let w = img.naturalWidth;
    let h = img.naturalHeight;

    if (w > maxW || h > maxH) {
      const ratio = Math.min(maxW / w, maxH / h);
      w = Math.floor(w * ratio);
      h = Math.floor(h * ratio);
    }

    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.drawImage(img, 0, 0, w, h);

    const imageData = offCtx.getImageData(0, 0, w, h);
    particles = buildParticlesFromImage(imageData, w, h);
    hasImage = true;
    imgOriginalW = w;
    imgOriginalH = h;
    scatterWave = 0;
    onReady();
  };
  img.src = URL.createObjectURL(file);
}

function buildParticlesFromImage(
  imageData: ImageData,
  srcW: number,
  srcH: number,
): ImageParticle[] {
  const result: ImageParticle[] = [];
  const data = imageData.data;

  for (let gy = 0; gy < srcH; gy += PARTICLE_DENSITY) {
    for (let gx = 0; gx < srcW; gx += PARTICLE_DENSITY) {
      const idx = (gy * srcW + gx) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;

      // Skip dark pixels
      if (brightness < 40) continue;

      // Bias toward brighter areas
      if (brightness < 80 && Math.random() > 0.3) continue;

      const normalizedX = gx / srcW;
      const normalizedY = gy / srcH;

      // Store positions relative to image origin — offset applied at render time
      result.push({
        baseX: gx,
        baseY: gy,
        x: gx,
        y: gy,
        maxScatterX: 0,
        maxScatterY: 0,
        scatterAmt: 0,
        vx: 0,
        vy: 0,
        size: 1.5 + (brightness / 255) * 2.5,
        r, g, b,
        brightness: brightness / 255,
        normalizedX,
        normalizedY,
        seed: Math.random() * 1000,
      });
    }
  }

  return result;
}

export function renderImageParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audio: AudioFrameData,
  _themeName: string,
  sensitivity: number,
  time: number,
  _customText: string,
) {
  void _themeName;
  void _customText;
  const hasAudio = audio.volume > 0.008;

  ctx.save();

  // Clear every frame
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f05423';
  ctx.fillRect(0, 0, width, height);

  // No image uploaded yet
  if (!hasImage || !particles) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '500 16px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload an image to begin', width / 2, height / 2);
    ctx.restore();
    return;
  }

  // Compute centering offset at render time
  const { offsetX, offsetY } = getImageOffset(width, height);

  // Scatter wave: diagonal top-right → bottom-left (faster for mode 7)
  const SCATTER_SPEED = 0.0015;
  if (hasAudio && scatterWave < 1.5) {
    scatterWave += SCATTER_SPEED;
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Apply centering offset to base position
    const baseX = p.baseX + offsetX;
    const baseY = p.baseY + offsetY;

    // Diagonal scatter wave: top-right → bottom-left
    const waveThreshold = (p.normalizedY - p.normalizedX + 1) / 2;
    if (scatterWave > waveThreshold) {
      if (p.maxScatterX === 0 && p.maxScatterY === 0) {
        const scatterAngle = Math.random() * Math.PI * 2;
        const scatterDist = 20 + Math.random() * 80;
        p.maxScatterX = Math.cos(scatterAngle) * scatterDist;
        p.maxScatterY = Math.sin(scatterAngle) * scatterDist;
      }
      const growthRate = 0.001;
      p.scatterAmt = Math.min(1, p.scatterAmt + growthRate);
    }

    const diagInfluence = (p.normalizedX + (1 - p.normalizedY)) / 2;

    // Pre-scatter halo
    let preScatterX = 0;
    let preScatterY = 0;
    if (scatterWave > 0.02 && p.scatterAmt === 0) {
      const distToWave = scatterWave - waveThreshold;
      if (distToWave > 0 && distToWave < 0.2) {
        const haloStrength = (1 - distToWave / 0.2);
        preScatterX = ((Math.sin(p.seed * 7.3) * 0.5 + 0.5) * haloStrength * 4) - haloStrength * 2;
        preScatterY = ((Math.cos(p.seed * 13.7) * 0.5 + 0.5) * haloStrength * 4) - haloStrength * 2;
      }
    }

    if (hasAudio) {
      // Treble = wobble on all particles
      const trebleInfluence = audio.treble * (5.0 + p.scatterAmt * 3.0 + (Math.abs(preScatterX) > 0.01 ? 0.5 : 0)) * diagInfluence * sensitivity;
      p.vx += (Math.random() - 0.5) * trebleInfluence;
      p.vy += (Math.random() - 0.5) * trebleInfluence;

      // Base drift
      if (p.scatterAmt > 0) {
        const baseDrift = 0.02 * diagInfluence * p.scatterAmt;
        const driftAngle = p.seed * 0.1 + time * 0.0005;
        p.maxScatterX += Math.cos(driftAngle) * baseDrift;
        p.maxScatterY += Math.sin(driftAngle) * baseDrift;
      }

      // Mid drift
      const midSpeed = 1 + audio.mid * 0.5 * sensitivity;
      if (p.scatterAmt > 0) {
        const driftAngle = p.seed * 0.1 + time * 0.0008;
        const drift = diagInfluence * 0.025 * midSpeed;
        p.maxScatterX += Math.cos(driftAngle) * drift;
        p.maxScatterY += Math.sin(driftAngle) * drift;
      }

      // Beat
      if (audio.isBeat && p.scatterAmt > 0) {
        const beatInfluence = audio.beatIntensity * p.scatterAmt * diagInfluence * sensitivity;
        const angle = Math.random() * Math.PI * 2;
        const force = beatInfluence * 2;
        p.vx += Math.cos(angle) * force;
        p.vy += Math.sin(angle) * force;
      }

      p.vx *= 0.92;
      p.vy *= 0.92;
    } else {
      p.vx = 0;
      p.vy = 0;
    }

    // Position: base (centered) + scatter + wobble
    p.x = baseX + p.maxScatterX * p.scatterAmt + preScatterX + p.vx;
    p.y = baseY + p.maxScatterY * p.scatterAmt + preScatterY + p.vy;
  }

  // Collision
  const NEIGHBOR_WINDOW = 12;
  const BOUNCE_STRENGTH = 0.4;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    for (let j = Math.max(0, i - NEIGHBOR_WINDOW); j < i; j++) {
      const q = particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (p.size + q.size) * 0.7;
      if (dist < minDist && dist > 0.1) {
        const overlap = (minDist - dist) / dist * BOUNCE_STRENGTH;
        const fx = dx * overlap;
        const fy = dy * overlap;
        p.x += fx; p.y += fy;
        q.x -= fx; q.y -= fy;
        p.vx += fx * 0.15;
        p.vy += fy * 0.15;
        q.vx -= fx * 0.15;
        q.vy -= fy * 0.15;
      }
    }
  }

  // Draw: colored circles using image pixel colors
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    ctx.fill();
  }

  ctx.restore();
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename || 'visual-of-comfort-image-particles.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
