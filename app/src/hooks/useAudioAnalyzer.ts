import { useRef, useCallback, useState, useEffect } from 'react';
import type { AudioFrameData, AudioSource, AudioState } from '@/types/audio';

const FFT_SIZE = 2048;
const SMOOTHING = 0.6;
const BEAT_HISTORY_SIZE = 30;
const BEAT_THRESHOLD = 1.3;
const BEAT_MIN_BASS = 0.3;

export function useAudioAnalyzer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const bassHistoryRef = useRef<number[]>([]);
  const audioDataRef = useRef<AudioFrameData>({
    frequencyData: new Uint8Array(FFT_SIZE / 2),
    bass: 0,
    mid: 0,
    treble: 0,
    volume: 0,
    isBeat: false,
    beatIntensity: 0,
  });

  const [audioState, setAudioState] = useState<AudioState>({
    source: 'sample',
    isPlaying: false,
    currentFile: null,
    hasPermission: false,
    error: null,
  });

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    return audioContextRef.current;
  }, []);

  const getAnalyser = useCallback(() => {
    if (!analyserRef.current) {
      const ctx = getAudioContext();
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = SMOOTHING;
    }
    return analyserRef.current;
  }, [getAudioContext]);

  const stopCurrentSource = useCallback(() => {
    if (sourceNodeRef.current) {
      if ('stop' in sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch { /* already stopped */ }
      }
      if ('disconnect' in sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch { /* already disconnected */ }
      }
      sourceNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    bassHistoryRef.current = [];
  }, []);

  const resumeContext = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }, [getAudioContext]);

  const startMic = useCallback(async () => {
    try {
      await resumeContext();
      stopCurrentSource();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const ctx = getAudioContext();
      const analyser = getAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceNodeRef.current = source;

      setAudioState(prev => ({
        ...prev,
        source: 'mic' as AudioSource,
        isPlaying: true,
        hasPermission: true,
        error: null,
      }));
    } catch (err) {
      setAudioState(prev => ({
        ...prev,
        hasPermission: false,
        error: err instanceof Error ? err.message : 'Microphone access denied',
      }));
    }
  }, [resumeContext, stopCurrentSource, getAnalyser, getAudioContext]);

  const stopMic = useCallback(() => {
    stopCurrentSource();
    setAudioState(prev => ({
      ...prev,
      source: 'sample' as AudioSource,
      isPlaying: false,
    }));
  }, [stopCurrentSource]);

  const playFile = useCallback(async (file: File) => {
    try {
      await resumeContext();
      stopCurrentSource();

      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = buffer;

      const analyser = getAnalyser();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      source.start(0);
      sourceNodeRef.current = source;

      setAudioState(prev => ({
        ...prev,
        source: 'file' as AudioSource,
        isPlaying: true,
        currentFile: file.name,
        error: null,
      }));
    } catch (err) {
      setAudioState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to decode audio file',
      }));
    }
  }, [resumeContext, stopCurrentSource, getAnalyser, getAudioContext]);

  const stopFile = useCallback(() => {
    stopCurrentSource();
    setAudioState(prev => ({
      ...prev,
      source: 'sample' as AudioSource,
      isPlaying: false,
      currentFile: null,
    }));
  }, [stopCurrentSource]);

  const startSample = useCallback(() => {
    stopCurrentSource();
    const ctx = getAudioContext();
    const analyser = getAnalyser();

    // Create ambient drone
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    const freqs = [55, 110, 165, 220, 330];
    const types: OscillatorType[] = ['sine', 'triangle', 'sine', 'sine', 'triangle'];
    const oscillators: OscillatorNode[] = [];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = types[i];
      osc.frequency.value = f;
      gain.gain.value = 1.0 / freqs.length;
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      oscillators.push(osc);
    });

    // LFO for movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillators[1].frequency);
    lfo.start();

    // Store for cleanup - use a single merged source node for tracking
    const dummyGain = ctx.createGain();
    dummyGain.gain.value = 0;
    masterGain.connect(dummyGain);
    // Store oscillators on the dummy gain for cleanup
    (dummyGain as unknown as { _oscillators: OscillatorNode[] })._oscillators = [...oscillators, lfo];
    sourceNodeRef.current = dummyGain as unknown as MediaStreamAudioSourceNode;

    setAudioState(prev => ({
      ...prev,
      source: 'sample' as AudioSource,
      isPlaying: true,
      error: null,
    }));
  }, [stopCurrentSource, getAudioContext, getAnalyser]);

  const playDemo = useCallback(async () => {
    try {
      await resumeContext();
      stopCurrentSource();

      const response = await fetch('/demo-audio.mp3');
      if (!response.ok) {
        throw new Error('Demo audio not found');
      }
      const arrayBuffer = await response.arrayBuffer();
      const ctx = getAudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = buffer;

      const analyser = getAnalyser();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      source.start(0);
      sourceNodeRef.current = source;

      setAudioState(prev => ({
        ...prev,
        source: 'file' as AudioSource,
        isPlaying: true,
        currentFile: 'Demo Audio',
        error: null,
      }));
    } catch (err) {
      // Fallback to synthetic sample
      startSample();
    }
  }, [resumeContext, stopCurrentSource, getAudioContext, getAnalyser, startSample]);

  const togglePlayback = useCallback(() => {
    if (audioState.source === 'file' && audioBufferRef.current) {
      if (audioState.isPlaying) {
        stopCurrentSource();
        setAudioState(prev => ({ ...prev, isPlaying: false }));
      } else {
        const ctx = getAudioContext();
        const analyser = getAnalyser();
        const source = ctx.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.loop = true;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        source.start(0);
        sourceNodeRef.current = source;
        setAudioState(prev => ({ ...prev, isPlaying: true }));
      }
    }
  }, [audioState.source, audioState.isPlaying, stopCurrentSource, getAnalyser, getAudioContext]);

  const analyze = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return audioDataRef.current;

    const freqCount = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(freqCount);
    analyser.getByteFrequencyData(frequencyData);

    // Bass: bins 1-10 (~20-200Hz)
    let bassSum = 0;
    for (let i = 1; i <= 10 && i < freqCount; i++) bassSum += frequencyData[i];
    const bass = bassSum / Math.min(10, freqCount - 1) / 255;

    // Mid: bins 11-100 (~200-2000Hz)
    let midSum = 0;
    const midEnd = Math.min(100, freqCount);
    for (let i = 11; i < midEnd; i++) midSum += frequencyData[i];
    const mid = midSum / Math.max(1, midEnd - 11) / 255;

    // Treble: bins 101-400 (~2000-8000Hz)
    let trebleSum = 0;
    const trebleEnd = Math.min(400, freqCount);
    for (let i = 101; i < trebleEnd; i++) trebleSum += frequencyData[i];
    const treble = trebleSum / Math.max(1, trebleEnd - 101) / 255;

    // Overall volume
    let volSum = 0;
    for (let i = 0; i < freqCount; i++) volSum += frequencyData[i];
    const volume = volSum / freqCount / 255;

    // Beat detection
    const history = bassHistoryRef.current;
    history.push(bass);
    if (history.length > BEAT_HISTORY_SIZE) history.shift();

    const avgBass = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;
    const isBeat = bass > avgBass * BEAT_THRESHOLD && bass > BEAT_MIN_BASS && history.length >= 10;
    const beatIntensity = isBeat ? Math.min(1, (bass - avgBass) / avgBass) : 0;

    audioDataRef.current = {
      frequencyData,
      bass: Math.min(1, bass),
      mid: Math.min(1, mid),
      treble: Math.min(1, treble),
      volume: Math.min(1, volume),
      isBeat,
      beatIntensity,
    };

    return audioDataRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentSource();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopCurrentSource]);

  return {
    audioDataRef,
    audioState,
    startMic,
    stopMic,
    startSample,
    playFile,
    stopFile,
    togglePlayback,
    playDemo,
    analyze,
    resumeContext,
  };
}
