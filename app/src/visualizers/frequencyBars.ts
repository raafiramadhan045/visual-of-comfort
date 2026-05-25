import type { AudioFrameData } from '@/types/audio';

// Fewer particles, bigger size
const PARTICLE_DENSITY = 8;

interface AssembleImageParticle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  // Initial random scatter offset (permanent, assigned on creation)
  initScatterX: number;
  initScatterY: number;
  // How much scatter remains (1 = fully scattered, 0 = perfectly assembled)
  assembleAmt: number;
  vx: number;
  vy: number;
  size: number;
  r: number;
  g: number;
  b: number;
  brightness: number;
  normalizedX: number;
  normalizedY: number;
  seed: number;
}

// Independent module state for Mode 3
let m3Particles: AssembleImageParticle[] | null = null;
let m3HasImage = false;
let m3ImgOriginalW = 0;
let m3ImgOriginalH = 0;
let m3AssembleWave = 0;

function getM3ImageOffset(canvasW: number, canvasH: number) {
  const offsetX = (canvasW - m3ImgOriginalW) / 2;
  const offsetY = (canvasH - m3ImgOriginalH) / 2;
  return { offsetX, offsetY };
}

export function loadImageForM3(
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
    m3Particles = buildM3Particles(imageData, w, h);
    m3HasImage = true;
    m3ImgOriginalW = w;
    m3ImgOriginalH = h;
    m3AssembleWave = 0;
    onReady();
  };
  img.src = URL.createObjectURL(file);
}

function buildM3Particles(
  imageData: ImageData,
  srcW: number,
  srcH: number,
): AssembleImageParticle[] {
  const result: AssembleImageParticle[] = [];
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

      // Random initial scatter — particles start dispersed
      const scatterAngle = Math.random() * Math.PI * 2;
      const scatterDist = 40 + Math.random() * 150;

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
        // Bigger particles: 3.0 to 6.0
        size: 3.0 + (brightness / 255) * 3.0,
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

export function renderFrequencyBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audio: AudioFrameData,
  _themeName: string,
  sensitivity: number,
  time: number,
) {
  void _themeName;
  void time;
  const hasAudio = audio.volume > 0.008;

  ctx.save();

  // Clear every frame
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f05423';
  ctx.fillRect(0, 0, width, height);

  // No image uploaded yet
  if (!m3HasImage || !m3Particles) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '500 16px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload an image to begin', width / 2, height / 2);
    ctx.restore();
    return;
  }

  // Compute centering offset at render time
  const { offsetX, offsetY } = getM3ImageOffset(width, height);

  // Assemble wave: diagonal top-right → bottom-left
  const ASSEMBLE_SPEED = 0.0015;
  if (hasAudio && m3AssembleWave < 1.5) {
    m3AssembleWave += ASSEMBLE_SPEED;
  }

  for (let i = 0; i < m3Particles.length; i++) {
    const p = m3Particles[i];

    // Apply centering offset
    const baseX = p.baseX + offsetX;
    const baseY = p.baseY + offsetY;

    // Diagonal assemble wave: bottom-left → top-right
    const waveThreshold = (p.normalizedX - p.normalizedY + 1) / 2;
    if (m3AssembleWave > waveThreshold) {
      // Gradually decrease assemble amount (1 → 0)
      const decayRate = 0.001;
      p.assembleAmt = Math.max(0, p.assembleAmt - decayRate);
    }

    // Diagonal influence factor: 1 = bottom-left, 0 = top-right
    const diagInfluence = (p.normalizedY + (1 - p.normalizedX)) / 2;

    // Pre-assemble: particles near wave front start settling
    let preAssembleOffset = 0;
    if (m3AssembleWave > 0.02 && p.assembleAmt === 1.0) {
      const distToWave = m3AssembleWave - waveThreshold;
      if (distToWave > 0 && distToWave < 0.2) {
        const haloStrength = (1 - distToWave / 0.2);
        preAssembleOffset = haloStrength * 0.3;
      }
    }

    // How scattered is this particle? (1 = fully scattered, 0 = assembled)
    const scatterFactor = p.assembleAmt - preAssembleOffset;

    if (hasAudio) {
      // === TREBLE = random wobble, 9.0 base for scattered particles ===
      // Fully scattered: 9.0 wobble | Assembled: 2.0 wobble
      const trebleInfluence = audio.treble * (2.0 + scatterFactor * 9.0) * diagInfluence * sensitivity;
      p.vx += (Math.random() - 0.5) * trebleInfluence;
      p.vy += (Math.random() - 0.5) * trebleInfluence;

      // === MID = helps pull particles toward base position ===
      const midPull = audio.mid * 0.3 * sensitivity;
      p.vx += (baseX - p.x) * midPull * 0.01;
      p.vy += (baseY - p.y) * midPull * 0.01;

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
    p.x = baseX + p.initScatterX * p.assembleAmt + p.vx;
    p.y = baseY + p.initScatterY * p.assembleAmt + p.vy;
  }

  // === COLLISION: particles bounce off each other ===
  const NEIGHBOR_WINDOW = 12;
  const BOUNCE_STRENGTH = 0.4;
  for (let i = 0; i < m3Particles.length; i++) {
    const p = m3Particles[i];
    for (let j = Math.max(0, i - NEIGHBOR_WINDOW); j < i; j++) {
      const q = m3Particles[j];
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

  // === DRAW: colored circles using image pixel colors ===
  for (let i = 0; i < m3Particles.length; i++) {
    const p = m3Particles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    ctx.fill();
  }

  ctx.restore();
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename || 'visual-of-comfort-image-assemble.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
