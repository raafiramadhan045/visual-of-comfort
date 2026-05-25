import type { AudioFrameData } from '@/types/audio';

const PARTICLE_DENSITY = 4;

interface AssembleParticle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  // Initial random scatter offset (permanent, assigned on creation)
  initScatterX: number;
  initScatterY: number;
  // How much scatter remains (1 = fully scattered, 0 = perfectly assembled)
  assembleAmt: number;
  // Velocity for audio wobble
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
let particles: AssembleParticle[] | null = null;
let assembleWave = 0;

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

function buildParticles(w: number, h: number, img: ImageData): AssembleParticle[] {
  const result: AssembleParticle[] = [];
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

        // Random initial scatter — particles start dispersed
        const scatterAngle = Math.random() * Math.PI * 2;
        const scatterDist = 30 + Math.random() * 120;

        result.push({
          baseX: gx,
          baseY: gy,
          // Start at scattered position
          x: gx + Math.cos(scatterAngle) * scatterDist,
          y: gy + Math.sin(scatterAngle) * scatterDist,
          initScatterX: Math.cos(scatterAngle) * scatterDist,
          initScatterY: Math.sin(scatterAngle) * scatterDist,
          assembleAmt: 1.0, // fully scattered
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

export function renderOrbPulse(
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
  void time;
  const text = customText || 'comfort';
  const hasAudio = audio.volume > 0.008;

  const needsRebuild = !particles || text !== lastText || width !== lastW || height !== lastH;
  if (needsRebuild) {
    const img = sampleText(text, width, height);
    particles = buildParticles(width, height, img);
    lastText = text;
    lastW = width;
    lastH = height;
    assembleWave = 0;
  }

  if (!particles || particles.length === 0) return;

  ctx.save();

  // Clear every frame
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f05423';
  ctx.fillRect(0, 0, width, height);

  // Assemble wave: diagonal top-right → bottom-left
  // When paused, freezes
  const ASSEMBLE_SPEED = 0.0006;
  if (hasAudio && assembleWave < 1.5) {
    assembleWave += ASSEMBLE_SPEED;
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // === ASSEMBLE WAVE: diagonal top-right → bottom-left ===
    // waveThreshold = 0 for top-right (assemble first), 1 for bottom-left (assemble last)
    const waveThreshold = (p.normalizedY - p.normalizedX + 1) / 2;
    if (assembleWave > waveThreshold) {
      // Gradually decrease assemble amount (1 → 0)
      const decayRate = 0.001;
      p.assembleAmt = Math.max(0, p.assembleAmt - decayRate);
    }

    // Diagonal influence factor: 1 = top-right, 0 = bottom-left
    const diagInfluence = (p.normalizedX + (1 - p.normalizedY)) / 2;

    // === PRE-ASSEMBLE: particles near wave front start settling ===
    let preAssembleOffset = 0;
    if (assembleWave > 0.02 && p.assembleAmt === 1.0) {
      const distToWave = assembleWave - waveThreshold;
      if (distToWave > 0 && distToWave < 0.2) {
        const haloStrength = (1 - distToWave / 0.2);
        preAssembleOffset = haloStrength * 0.3;
      }
    }

    // How scattered is this particle? (1 = fully scattered, 0 = assembled)
    const scatterFactor = p.assembleAmt - preAssembleOffset;

    if (hasAudio) {
      // === TREBLE = random wobble, stronger when still scattered ===
      // Fully scattered: strong wobble | Assembled: gentle wobble
      const trebleInfluence = audio.treble * (2.0 + scatterFactor * 5.0) * diagInfluence * sensitivity;
      p.vx += (Math.random() - 0.5) * trebleInfluence;
      p.vy += (Math.random() - 0.5) * trebleInfluence;

      // === MID = helps pull particles toward base ===
      const midPull = audio.mid * 0.3 * sensitivity;
      p.vx += (p.baseX - p.x) * midPull * 0.01;
      p.vy += (p.baseY - p.y) * midPull * 0.01;

      // === BEAT = gentle shake, stronger when scattered ===
      if (audio.isBeat && scatterFactor > 0.1) {
        const beatInfluence = audio.beatIntensity * scatterFactor * diagInfluence * sensitivity;
        const angle = Math.random() * Math.PI * 2;
        const force = beatInfluence * 1.5;
        p.vx += Math.cos(angle) * force;
        p.vy += Math.sin(angle) * force;
      }

      // Apply velocity with damping
      p.vx *= 0.92;
      p.vy *= 0.92;

    } else {
      // === PAUSED: freeze ===
      p.vx = 0;
      p.vy = 0;
    }

    // === POSITION = base + (initScatter * assembleAmt) + wobble ===
    // assembleAmt = 1: at scattered position | assembleAmt = 0: at exact base
    p.x = p.baseX + p.initScatterX * p.assembleAmt + p.vx;
    p.y = p.baseY + p.initScatterY * p.assembleAmt + p.vy;
  }

  // === COLLISION: particles bounce off each other ===
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
  link.download = filename || 'visual-of-comfort-assemble.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
