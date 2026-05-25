# WaveForm — Technical Specification

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM renderer |
| lucide-react | ^0.460.0 | Icons for control dock (Mic, Upload, Play, Pause, Settings, Help, etc.) |
| tailwindcss | ^3.4.19 | Utility CSS (UI chrome only) |
| typescript | ^5.6.0 | Type safety |
| vite | ^5.4.0 | Build tool |

No external animation libraries — all animation via `requestAnimationFrame`. No Three.js — pure Canvas 2D.

## Component Inventory

### Layout

No shared layout components. The app is a single full-viewport canvas with floating overlays.

### Sections

**`VisualizerCanvas`** — Full-viewport `<canvas>` element. Contains the entire rendering pipeline: audio analysis, 4 visualization modes, shared post-processing. This is the core of the app.

### Reusable Components

**`ControlDock`** — Floating glassmorphic toolbar at viewport bottom. Contains all user controls: source toggle, mode selector, theme selector, sensitivity slider, playback controls.

**`StartOverlay`** — Centered overlay shown before audio context is activated. Handles the browser-required user gesture to start AudioContext. Two states: "Tap to Start" (sample audio) and "Enable Microphone".

**`StatusBar`** — Top-left floating indicator showing: audio input status (LED dot + label), current FPS, filename (if file playback), current mode name.

**`HelpPanel`** — Modal/panel showing keyboard shortcuts. Triggered by `?` key or help button.

### Hooks

**`useAudioAnalyzer`** — Manages the entire Web Audio API lifecycle:
- `AudioContext` creation and resumption
- `AnalyserNode` setup (`fftSize = 2048`, `smoothingTimeConstant = 0.85`)
- Microphone input via `getUserMedia`
- File input via `decodeAudioData` + `AudioBufferSourceNode`
- Frequency data extraction (bass/mid/treble/volume bands)
- Beat detection algorithm
- Returns: `audioDataRef` (current frame data), `startMic()`, `stopMic()`, `playFile()`, `stopFile()`, `isMicActive`, `isPlaying`

**`useVisualizer`** — Animation loop manager:
- `requestAnimationFrame` loop with delta-time
- Canvas resize handling (DPR-aware)
- Mode dispatch to the correct renderer
- Shared post-processing (vignette, bloom)
- FPS counter
- Visibility-aware pause/resume

## Animation Implementation

| Animation | Library | Implementation Approach | Complexity |
|-----------|---------|------------------------|------------|
| Particle Wave (Mode 1) | Canvas 2D + RAF | 800-particle system with spring physics, audio force, glow trails. Custom renderer function. | 🔒 High |
| Orb Pulse (Mode 2) | Canvas 2D + RAF | Multi-layer radial gradients, 12 concentric ring animations, 60 orbiting particles with scatter-on-beat | 🔒 High |
| Frequency Bars (Mode 3) | Canvas 2D + RAF | 128 bars with glow, rounded rects, reflection layer, beat flash | Medium |
| Spectrum Spiral (Mode 4) | Canvas 2D + RAF | 64-point spiral with connecting lines, 5-position glow trails, beat breathing | 🔒 High |
| Trail/motion blur | Canvas 2D | Semi-transparent overlay fill (`rgba(5,5,8,0.15-0.3)`) each frame | Low |
| Vignette | Canvas 2D | Radial gradient from transparent center to dark edges | Low |
| Bloom on beat | Canvas 2D | `lighter` composite operation + radial gradient, alpha driven by bass | Low |
| UI dock appearance | CSS | `opacity` + `translateY` transition on mount, backdrop-filter | Low |
| LED status dot | CSS | `@keyframes` pulse animation for active state | Low |
| Start overlay pulse | CSS | `@keyframes` scale pulse on CTA button | Low |

## State & Logic Plan

### Audio Context Lifecycle (critical)

Browsers require a user gesture to start an AudioContext. The flow:
1. Page loads — AudioContext created in `suspended` state
2. `StartOverlay` visible with "Tap to Start" CTA
3. User clicks → `audioContext.resume()` → overlay hides → visualizer starts
4. For mic: separate "Enable Microphone" button calls `getUserMedia`
5. For file: drag-drop or file input triggers `decodeAudioData`

State machine: `idle → samplePlaying → micActive → filePlaying` with transitions managed in `useAudioAnalyzer`.

### Data Flow (non-React)

The animation runs entirely outside React's render cycle for performance:
- `useAudioAnalyzer` stores audio data in a `useRef` (never triggers re-render)
- `useVisualizer` reads the ref each frame and draws to canvas
- React state (`mode`, `theme`, `sensitivity`) is read from refs that mirror state values
- This decouples 60fps rendering from React's reconciliation

### Visualization Mode Architecture

Each mode is a pure function with signature:
```typescript
type VisualizerRenderer = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audioData: AudioFrameData,
  theme: ColorTheme,
  sensitivity: number,
  time: number,
  particles: Particle[], // mutable, persistent array
) => void;
```

Four renderer modules in `src/visualizers/`:
- `particleWave.ts` — particle system state + renderer
- `orbPulse.ts` — orb layers + orbital particles + rings
- `frequencyBars.ts` — bar heights + reflection + beat flash
- `spectrumSpiral.ts` — spiral geometry + trails + beat breathing

Each module maintains its own persistent state (particle arrays, ring positions, etc.) via module-level variables or a shared state object passed each frame.

### Beat Detection → Visual Reaction

The beat detection output (`isBeat: boolean`, `beatIntensity: number`) triggers:
- Particle burst: radial outward force on all particles (Mode 1)
- Orb ring spawn: new concentric ring created at orb center (Mode 2)
- Flash overlay: fullscreen radial gradient at low alpha (Mode 3)
- Spiral breathe: temporary radius expansion factor (Mode 4)

### Mobile Adaptation

- Detect mobile: `window.innerWidth < 768`
- Reduce particle count: 800 → 400
- Reduce FFT size: 2048 → 1024
- Increase touch targets: 44px minimum
- Show landscape recommendation icon

## Other Key Decisions

### No GSAP / Framer Motion
All animation is frame-by-frame Canvas 2D. UI transitions (dock fade-in, overlay) use simple CSS transitions. This keeps the bundle small and gives full control over the 60fps render loop.

### Sample Audio Strategy
Embed a short ambient loop as a base64 data URI (~5-10 seconds, < 200KB). This gives immediate visual feedback without requiring mic permission or file upload. The "Tap to Start" overlay is the user gesture that both resumes AudioContext and starts playback.

### File Structure
```
src/
  App.tsx
  main.tsx
  index.css
  components/
    ControlDock.tsx
    StartOverlay.tsx
    StatusBar.tsx
    HelpPanel.tsx
  visualizers/
    particleWave.ts
    orbPulse.ts
    frequencyBars.ts
    spectrumSpiral.ts
  hooks/
    useAudioAnalyzer.ts
    useVisualizer.ts
  types/
    audio.ts
    visualizer.ts
```
