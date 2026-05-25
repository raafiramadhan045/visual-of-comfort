import type { AudioFrameData } from '@/types/audio';

const PARTICLE_DENSITY = 4;

interface TextParticle {
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
  depth: number;
  normalizedX: number;
  normalizedY: number;
  seed: number;
}

let offscreen: HTMLCanvasElement | null = null;
let offCtx: CanvasRenderingContext2D | null = null;
let lastText = '';
let lastW = 0;
let lastH = 0;
let particles: TextParticle[] | null = null;
let scatterWave = 0;

function sampleText(text: string, w: number, h: number): ImageData {
  if (!offscreen || !offCtx) {
    offscreen = document.createElement('canvas');
    offCtx = offscreen.getContext('2d', { willReadFrequently: true })!;
  }
  offscreen.width = w;
  offscreen.height = h;

  offCtx.fillStyle = '#000000';
  offCtx.fillRect(0, 0, w, h);

  const fontSize = Math.min(w / (text.length * 0.6), h * 0.35);
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.font = '900 ' + fontSize + 'px Poppins, sans-serif';
  offCtx.fillStyle = '#ffffff';
  offCtx.fillText(text, w / 2, h / 2);

  return offCtx.getImageData(0, 0, w, h);
}

function buildParticles(w: number, h: number, img: ImageData): TextParticle[] {
  const result: TextParticle[] = [];
  const data = img.data;
  const stride = img.width;

  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let gy = 0; gy < h; gy += 2) {
    for (let gx = 0; gx < w; gx += 2) {
      const idx = (gy * stride + gx) * 4;
      if (data[idx] > 80) {
        minX = Math.min(minX, gx);
        maxX = Math.max(maxX, gx);
        minY = Math.min(minY, gy);
        maxY = Math.max(maxY, gy);
      }
    }
  }
  const textWidth = maxX - minX || w;
  const textHeight = maxY - minY || h;

  for (let gy = 0; gy < h; gy += PARTICLE_DENSITY) {
    for (let gx = 0; gx < w; gx += PARTICLE_DENSITY) {
      const idx = (gy * stride + gx) * 4;
      const brightness = data[idx];

      if (brightness > 80) {
        const depth = Math.min(1, brightness / 255);
        const normalizedX = (gx - minX) / textWidth;
        const normalizedY = (gy - minY) / textHeight;

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
          size: 2.0 + Math.random() * 1.5,
          depth,
          normalizedX: Math.max(0, Math.min(1, normalizedX)),
          normalizedY: Math.max(0, Math.min(1, normalizedY)),
          seed: Math.random() * 1000,
        });
      }
    }
  }

  return result;
}

export function renderMandala(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audio: AudioFrameData,
  _themeName: string,
  sensitivity: number,
  time: number,
  customText: string,
) {
  void _themeName;
  const text = customText || 'comfort';
  const hasAudio = audio.volume > 0.008;

  const needsRebuild = !particles || text !== lastText || width !== lastW || height !== lastH;
  if (needsRebuild) {
    const img = sampleText(text, width, height);
    particles = buildParticles(width, height, img);
    lastText = text;
    lastW = width;
    lastH = height;
    scatterWave = 0;
  }

  if (!particles || particles.length === 0) return;

  ctx.save();

  // Clear every frame
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f05423';
  ctx.fillRect(0, 0, width, height);

  // Scatter wave: diagonal from top-right to bottom-left while audio plays
  // When paused, freezes
  const SCATTER_SPEED = 0.0006;
  if (hasAudio && scatterWave < 1.5) {
    scatterWave += SCATTER_SPEED;
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // === SCATTER WAVE: diagonal top-right → bottom-left ===
    // waveThreshold = 0 for top-right (scatter first), 1 for bottom-left (scatter last)
    const waveThreshold = (p.normalizedY - p.normalizedX + 1) / 2;
    if (scatterWave > waveThreshold) {
      // Assign max scatter direction on first reach
      if (p.maxScatterX === 0 && p.maxScatterY === 0) {
        const scatterAngle = Math.random() * Math.PI * 2;
        const scatterDist = 20 + Math.random() * 80;
        p.maxScatterX = Math.cos(scatterAngle) * scatterDist;
        p.maxScatterY = Math.sin(scatterAngle) * scatterDist;
      }
      // Gradually increase scatter amount — very smooth
      const growthRate = 0.001;
      p.scatterAmt = Math.min(1, p.scatterAmt + growthRate);
    }

    // Diagonal influence factor: 1 = top-right, 0 = bottom-left
    const diagInfluence = (p.normalizedX + (1 - p.normalizedY)) / 2;

    // === PRE-SCATTER: untouched particles near wave front get soft edge ===
    // When wave has touched 2% of word, untouched particles soften at edges
    let preScatterX = 0;
    let preScatterY = 0;
    if (scatterWave > 0.02 && p.scatterAmt === 0) {
      const distToWave = scatterWave - waveThreshold;
      if (distToWave > 0 && distToWave < 0.2) {
        // Within 0.2 of wave front — soft halo with deterministic offset
        const haloStrength = (1 - distToWave / 0.2);
        // Deterministic noise from seed — no flicker
        const offsetX = (Math.sin(p.seed * 7.3) * 0.5 + 0.5) * haloStrength * 4;
        const offsetY = (Math.cos(p.seed * 13.7) * 0.5 + 0.5) * haloStrength * 4;
        preScatterX = offsetX - haloStrength * 2;
        preScatterY = offsetY - haloStrength * 2;
      }
    }

    if (hasAudio) {
      // === TREBLE = random wobble on ALL particles ===
      // Untouched: very strong wobble | Pre-scattered: more | Scattered: full
      const trebleInfluence = audio.treble * (5.0 + p.scatterAmt * 3.0 + (Math.abs(preScatterX) > 0.01 ? 0.5 : 0)) * diagInfluence * sensitivity;
      p.vx += (Math.random() - 0.5) * trebleInfluence;
      p.vy += (Math.random() - 0.5) * trebleInfluence;

      // === BASE DRIFT: scattered particles slowly move away ===
      if (p.scatterAmt > 0) {
        const baseDrift = 0.02 * diagInfluence * p.scatterAmt;
        const driftAngle = p.seed * 0.1 + time * 0.0005;
        p.maxScatterX += Math.cos(driftAngle) * baseDrift;
        p.maxScatterY += Math.sin(driftAngle) * baseDrift;
      }

      // === MID = drift the max scatter target outward ===
      const midSpeed = 1 + audio.mid * 0.5 * sensitivity;
      if (p.scatterAmt > 0) {
        const driftAngle = p.seed * 0.1 + time * 0.0008;
        const drift = diagInfluence * 0.025 * midSpeed;
        p.maxScatterX += Math.cos(driftAngle) * drift;
        p.maxScatterY += Math.sin(driftAngle) * drift;
      }

      // === BEAT = gentle push, proportional to scatter ===
      if (audio.isBeat && p.scatterAmt > 0) {
        const beatInfluence = audio.beatIntensity * p.scatterAmt * diagInfluence * sensitivity;
        const angle = Math.random() * Math.PI * 2;
        const force = beatInfluence * 2;
        p.vx += Math.cos(angle) * force;
        p.vy += Math.sin(angle) * force;
      }

      // Apply velocity with damping
      p.vx *= 0.92;
      p.vy *= 0.92;

    } else {
      // === PAUSED: freeze wobble ===
      p.vx = 0;
      p.vy = 0;
    }

    // === POSITION = base + (maxScatter * scatterAmt) + preScatter + wobble ===
    p.x = p.baseX + p.maxScatterX * p.scatterAmt + preScatterX + p.vx;
    p.y = p.baseY + p.maxScatterY * p.scatterAmt + preScatterY + p.vy;
  }

  // === COLLISION: particles bounce off each other ===
  // Check nearby particles (spatially close since array is in grid order)
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
        // Overlapping — push apart
        const overlap = (minDist - dist) / dist * BOUNCE_STRENGTH;
        const fx = dx * overlap;
        const fy = dy * overlap;
        p.x += fx;
        p.y += fy;
        q.x -= fx;
        q.y -= fy;
        // Add a little bounce velocity
        p.vx += fx * 0.15;
        p.vy += fy * 0.15;
        q.vx -= fx * 0.15;
        q.vy -= fy * 0.15;
      }
    }
  }

  // === DRAW ALL PARTICLES (circles) ===
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename || 'visual-of-comfort-particles.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
