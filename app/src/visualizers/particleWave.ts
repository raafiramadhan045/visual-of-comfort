import type { AudioFrameData } from '@/types/audio';
import type { ColorTheme, ThemeConfig } from '@/types/visualizer';
import { THEMES } from '@/types/visualizer';

const CIRCLE_COUNT = 48;

interface PackedCircle {
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  targetRadius: number;
  freqBand: number; // which frequency band drives this circle
  hue: number;
  alpha: number;
  pulsePhase: number;
  outlineWidth: number;
}

let circles: PackedCircle[] | null = null;

function getTheme(themeName: ColorTheme, time: number): ThemeConfig {
  const t = THEMES[themeName];
  if (themeName === 'rainbow') {
    return { ...t, baseHue: (time * 0.06) % 360 };
  }
  return t;
}

function initCircles(width: number, height: number): PackedCircle[] {
  const pts: PackedCircle[] = [];
  const centerX = width / 2;
  const centerY = height / 2;

  // Seed: place one large central circle
  pts.push({
    x: centerX,
    y: centerY,
    baseRadius: Math.min(width, height) * 0.18,
    radius: Math.min(width, height) * 0.18,
    targetRadius: Math.min(width, height) * 0.18,
    freqBand: 0,
    hue: 0,
    alpha: 0.6,
    pulsePhase: 0,
    outlineWidth: 1.5,
  });

  // Place additional circles using simple packing around existing ones
  const maxDim = Math.max(width, height);
  const sizes = [
    0.14, 0.12, 0.10, 0.10, 0.08, 0.08, 0.08,
    0.06, 0.06, 0.06, 0.06, 0.05, 0.05, 0.05, 0.05,
    0.04, 0.04, 0.04, 0.04, 0.04, 0.04,
    0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03,
    0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025,
    0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
  ];

  for (let i = 0; i < Math.min(sizes.length, CIRCLE_COUNT - 1); i++) {
    const baseR = sizes[i] * maxDim;
    // Place in a spiral-like pattern around center
    const angle = i * 2.4; // golden angle-ish for organic spread
    const dist = Math.sqrt(i + 1) * maxDim * 0.06;
    const x = centerX + Math.cos(angle) * dist;
    const y = centerY + Math.sin(angle) * dist;

    pts.push({
      x,
      y,
      baseRadius: baseR,
      radius: baseR,
      targetRadius: baseR,
      freqBand: (i % 8) / 8, // distribute across 8 frequency bands
      hue: (i / CIRCLE_COUNT) * 360,
      alpha: 0.4 + (baseR / (maxDim * 0.14)) * 0.4,
      pulsePhase: i * 0.7,
      outlineWidth: 1 + (baseR / (maxDim * 0.1)),
    });
  }

  return pts;
}

export function renderParticleWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audio: AudioFrameData,
  themeName: ColorTheme,
  sensitivity: number,
  time: number,
) {
  if (!circles || circles.length === 0) {
    circles = initCircles(width, height);
  }

  const theme = getTheme(themeName, time);
  const freqLen = audio.frequencyData.length;
  const hasAudio = audio.volume > 0.008;
  const baseHue = theme.baseHue;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f05423';
  ctx.fillRect(0, 0, width, height);

  if (!hasAudio) {
    // Dormant: draw static circle packing with dim outlines
    for (const c of circles) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,0.3)`;
      ctx.lineWidth = Math.max(0.5, c.outlineWidth * 0.6);
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // ---- AUDIO IS PLAYING ----

  // Short trail
  ctx.fillStyle = 'rgba(240, 84, 35, 0.35)';
  ctx.fillRect(0, 0, width, height);

  // Bloom on bass
  if (audio.bass > 0.3) {
    ctx.globalCompositeOperation = 'lighter';
    const bloomGrad = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.min(width, height) * 0.6
    );
    bloomGrad.addColorStop(0, `rgba(255, 255, 255, ${audio.bass * 0.12 * sensitivity})`);
    bloomGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bloomGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Sort circles by size: draw larger ones first (behind), smaller on top
  const sorted = [...circles].sort((a, b) => b.radius - a.radius);

  for (const c of sorted) {
    // Sample frequency at this circle's assigned band
    const freqIdx = Math.floor(c.freqBand * freqLen * 0.7);
    const freqVal = freqIdx < freqLen ? audio.frequencyData[freqIdx] / 255 : 0;
    const punchVal = Math.pow(freqVal, 0.6);

    // Target radius: base + audio expansion
    const audioExpansion = punchVal * c.baseRadius * 1.8 * sensitivity;
    const bassPulse = audio.bass * c.baseRadius * 0.6 * sensitivity;
    c.targetRadius = c.baseRadius + audioExpansion + bassPulse;

    // Smooth radius transition (springy)
    const dr = c.targetRadius - c.radius;
    c.radius += dr * 0.12;

    // Pulse phase advances with audio
    c.pulsePhase += 0.02 + audio.mid * 0.08;

    // Solid #f05423 orange with white outline — no hue shifting

    // Draw fill: solid #f05423 orange
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + punchVal * 0.35})`;
    ctx.fill();

    // Draw white outline
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + punchVal * 0.4})`;
    ctx.lineWidth = Math.max(1, c.outlineWidth * 0.7 * (1 + punchVal * 0.5));
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Draw thin inner circle for depth (like the image)
    if (c.radius > 15) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + punchVal * 0.25})`;
      ctx.lineWidth = 0.5;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }

    // On beat: add a bright flash ring
    if (audio.isBeat && c.radius > c.baseRadius * 1.2) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${audio.beatIntensity * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = `hsl(${baseHue}, 80%, 60%)`;
      ctx.stroke();
    }
  }

  // Draw connecting lines between tangent/overlapping circles
  // (mimics the web-like structure in the image)
  ctx.lineWidth = 0.5;
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i];
      const b = circles[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const touchDist = a.radius + b.radius;

      // Only draw if circles are close (overlapping or nearly touching)
      if (dist < touchDist * 1.3 && dist > touchDist * 0.3) {
        const overlap = Math.max(0, touchDist - dist) / touchDist;
        const freqValA = Math.min(1, (audio.frequencyData[Math.floor(a.freqBand * freqLen * 0.7)] || 0) / 255);
        const freqValB = Math.min(1, (audio.frequencyData[Math.floor(b.freqBand * freqLen * 0.7)] || 0) / 255);
        const avgFreq = (freqValA + freqValB) / 2;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${overlap * 0.15 + avgFreq * 0.1})`;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
    }
  }

  // Center glow point
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 3 + audio.volume * 6 * sensitivity, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + audio.volume * 0.4})`;
  ctx.shadowBlur = 0;
  ctx.fill();

  ctx.restore();
}
