import type { AudioFrameData } from '@/types/audio';

const POINT_COUNT = 360;
const TRAIL_COUNT = 6;

interface CircleTrail {
  points: { angle: number; radius: number; alpha: number }[];
  age: number;
}

interface FrozenPoint {
  x: number;
  y: number;
}

let trails: CircleTrail[] = [];
let smoothedVolume = 0;
let frozenAngle = 0;
let frozenPoints: FrozenPoint[] | null = null;
let frozenSecondaryRadius: number[] | null = null;
let frozenTertiaryRadius: number[] | null = null;

export function renderCircleDistort(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audio: AudioFrameData,
  _themeName: string,
  sensitivity: number,
  time: number,
) {
  void _themeName;
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * 0.22;
  const freqLen = audio.frequencyData.length;
  const hasAudio = audio.volume > 0.008;

  smoothedVolume = smoothedVolume * 0.88 + audio.volume * 0.12;

  ctx.save();

  if (!hasAudio) {
    // ---- FROZEN STATE: draw last distorted frame ----
    if (frozenPoints && frozenPoints.length > 0) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#f05423';
      ctx.fillRect(0, 0, width, height);

      const lineAlpha = 0.75 + smoothedVolume * 0.25;

      // Draw frozen main circle
      ctx.beginPath();
      for (let i = 0; i <= POINT_COUNT; i++) {
        const idx = i % POINT_COUNT;
        if (idx === 0 && i > 0) {
          ctx.closePath();
          break;
        }
        const fp = frozenPoints[idx];
        if (i === 0) ctx.moveTo(fp.x, fp.y);
        else ctx.lineTo(fp.x, fp.y);
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Draw frozen secondary echo
      if (frozenSecondaryRadius) {
        ctx.beginPath();
        for (let i = 0; i <= POINT_COUNT; i++) {
          const idx = i % POINT_COUNT;
          const angle = (idx / POINT_COUNT) * Math.PI * 2 + frozenAngle + 0.08;
          const r = frozenSecondaryRadius[idx];
          if (r) {
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(255, 255, 255, 0.35)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw frozen tertiary echo
      if (frozenTertiaryRadius) {
        ctx.beginPath();
        for (let i = 0; i <= POINT_COUNT; i++) {
          const idx = i % POINT_COUNT;
          const angle = (idx / POINT_COUNT) * Math.PI * 2 + frozenAngle - 0.05;
          const r = frozenTertiaryRadius[idx];
          if (r) {
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Center dot at frozen size
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();

      // Draw frozen trails (fading)
      trails = trails.filter(t => t.age < TRAIL_COUNT);
      for (const trail of trails) {
        trail.age++;
        const trailAlpha = (1 - trail.age / TRAIL_COUNT) * 0.12;
        if (trailAlpha <= 0) continue;

        ctx.beginPath();
        for (let i = 0; i <= POINT_COUNT; i++) {
          const idx = i % POINT_COUNT;
          const pt = trail.points[idx];
          if (!pt) continue;
          const x = centerX + Math.cos(pt.angle) * pt.radius;
          const y = centerY + Math.sin(pt.angle) * pt.radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${trailAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      // No frozen state yet: draw simple dormant circle
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#f05423';
      ctx.fillRect(0, 0, width, height);

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }

    ctx.restore();
    return;
  }

  // ---- AUDIO IS PLAYING ----

  const rotationAngle = time * 0.003 + audio.mid * 0.015 * sensitivity;
  frozenAngle = rotationAngle; // store for freeze

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f05423';
  ctx.fillRect(0, 0, width, height);

  // Trail fade
  ctx.fillStyle = `rgba(240, 84, 35, ${0.3 + smoothedVolume * 0.15})`;
  ctx.fillRect(0, 0, width, height);

  // Beat flash
  if (audio.isBeat) {
    const flashGrad = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, baseRadius * 3
    );
    flashGrad.addColorStop(0, `rgba(255, 255, 255, ${audio.beatIntensity * 0.35 * 0.8})`);
    flashGrad.addColorStop(0.3, `rgba(255, 200, 180, ${audio.beatIntensity * 0.35 * 0.3})`);
    flashGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flashGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Build main circle points
  const points: FrozenPoint[] = [];
  const secondaryRadius: number[] = [];
  const tertiaryRadius: number[] = [];

  for (let i = 0; i < POINT_COUNT; i++) {
    const angle = (i / POINT_COUNT) * Math.PI * 2 + rotationAngle;
    const freqIdx1 = Math.floor((Math.abs(Math.sin(angle * 3)) * 0.4 + Math.abs(Math.cos(angle * 7)) * 0.3) * freqLen * 0.6) % freqLen;
    const freqIdx2 = Math.floor((Math.abs(Math.cos(angle * 2)) * 0.5) * freqLen * 0.5) % freqLen;
    const freqVal1 = freqIdx1 < freqLen ? audio.frequencyData[freqIdx1] / 255 : 0;
    const freqVal2 = freqIdx2 < freqLen ? audio.frequencyData[freqIdx2] / 255 : 0;
    const freqVal = Math.max(freqVal1, freqVal2);

    const bassDistortion = Math.sin(angle * 2 + time * 0.008) * audio.bass * 120 * sensitivity;
    const midDistortion = Math.sin(angle * 7 + time * 0.018) * audio.mid * 80 * sensitivity;
    const trebleDistortion = Math.sin(angle * 18 + time * 0.03) * audio.treble * 50 * sensitivity;
    const freqDistortion = freqVal * 90 * sensitivity;
    const noiseDistortion = (Math.random() - 0.5) * audio.volume * 20 * sensitivity;

    const breathe = 1 + audio.bass * 0.6 * sensitivity;
    const r = (baseRadius + bassDistortion + midDistortion + trebleDistortion + freqDistortion + noiseDistortion) * breathe;

    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    points.push({ x, y });

    // Secondary echo radius
    const angle2 = angle + 0.08;
    const fIdxS = Math.floor((Math.abs(Math.sin(angle2 * 4)) * 0.5) * freqLen * 0.6) % freqLen;
    const fValS = fIdxS < freqLen ? audio.frequencyData[fIdxS] / 255 : 0;
    secondaryRadius.push(baseRadius * 0.65 + fValS * 50 * sensitivity + Math.sin(angle2 * 12 + time * 0.015) * audio.treble * 30);

    // Tertiary echo radius
    const angle3 = angle - 0.05;
    const fIdxT = Math.floor((Math.abs(Math.cos(angle3 * 3)) * 0.4) * freqLen * 0.6) % freqLen;
    const fValT = fIdxT < freqLen ? audio.frequencyData[fIdxT] / 255 : 0;
    tertiaryRadius.push(baseRadius * 1.3 + fValT * 35 * sensitivity + Math.sin(angle3 * 5 + time * 0.012) * audio.bass * 35);
  }

  // Store frozen state
  frozenPoints = points.map(p => ({ x: p.x, y: p.y }));
  frozenSecondaryRadius = [...secondaryRadius];
  frozenTertiaryRadius = [...tertiaryRadius];

  // Store trail
  trails.push({
    points: points.map((_, i) => ({
      angle: (i / POINT_COUNT) * Math.PI * 2 + rotationAngle,
      radius: Math.hypot(points[i].x - centerX, points[i].y - centerY),
      alpha: 1,
    })),
    age: 0,
  });

  // Draw trails
  trails = trails.filter(t => t.age < TRAIL_COUNT);
  for (let t = 0; t < trails.length - 1; t++) {
    const trail = trails[t];
    trail.age++;
    const trailAlpha = (1 - trail.age / TRAIL_COUNT) * 0.12;

    ctx.beginPath();
    for (let i = 0; i <= POINT_COUNT; i++) {
      const idx = i % POINT_COUNT;
      const pt = trail.points[idx];
      if (!pt) continue;
      const x = centerX + Math.cos(pt.angle) * pt.radius;
      const y = centerY + Math.sin(pt.angle) * pt.radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${trailAlpha})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }

  // Secondary echo
  ctx.beginPath();
  for (let i = 0; i <= POINT_COUNT; i++) {
    const idx = i % POINT_COUNT;
    const a = (idx / POINT_COUNT) * Math.PI * 2 + rotationAngle + 0.08;
    const r = secondaryRadius[idx];
    const x = centerX + Math.cos(a) * r;
    const y = centerY + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + smoothedVolume * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tertiary echo
  ctx.beginPath();
  for (let i = 0; i <= POINT_COUNT; i++) {
    const idx = i % POINT_COUNT;
    const a = (idx / POINT_COUNT) * Math.PI * 2 + rotationAngle - 0.05;
    const r = tertiaryRadius[idx];
    const x = centerX + Math.cos(a) * r;
    const y = centerY + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + audio.bass * 0.2})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // MAIN circle
  ctx.beginPath();
  for (let i = 0; i <= POINT_COUNT; i++) {
    const idx = i % POINT_COUNT;
    if (idx === 0 && i > 0) {
      ctx.closePath();
      break;
    }
    const { x, y } = points[idx];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  const lineAlpha = 0.75 + smoothedVolume * 0.25;
  ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
  ctx.lineWidth = 2.5 + audio.volume * 4 * sensitivity;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowBlur = 0;
  ctx.stroke();

  // Center dot
  const centerSize = 2 + audio.bass * 12 * sensitivity;
  ctx.beginPath();
  ctx.arc(centerX, centerY, centerSize, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + audio.volume * 0.2})`;
  ctx.fill();

  // Beat burst ring
  if (audio.isBeat) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * audio.beatIntensity * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${audio.beatIntensity * 0.5})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Spectrum dots
  const dotCount = 80;
  for (let i = 0; i < dotCount; i++) {
    const ptIdx = Math.floor((i / dotCount) * POINT_COUNT);
    const { x, y } = points[ptIdx];
    const fIdx = Math.floor((i / dotCount) * freqLen * 0.6);
    const fVal = fIdx < freqLen ? audio.frequencyData[fIdx] / 255 : 0;
    if (fVal < 0.08) continue;

    const dotSize = 1.5 + fVal * 5;
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${fVal * 0.9})`;
    ctx.fill();
  }

  // Beat ring into trails
  if (audio.isBeat) {
    trails.push({
      points: points.map((_, i) => ({
        angle: (i / POINT_COUNT) * Math.PI * 2 + rotationAngle,
        radius: Math.hypot(points[i].x - centerX, points[i].y - centerY),
        alpha: audio.beatIntensity,
      })),
      age: 0,
    });
  }

  ctx.restore();
}
