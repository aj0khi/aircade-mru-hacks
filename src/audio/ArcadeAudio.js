const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ArcadeAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.bus = null;
    this.muted = false;
    this.voices = new Set();
    this.unlocked = false;
  }

  ensureContext() {
    if (this.context) return this.context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const context = new AudioContextClass();
    const master = context.createGain();
    const bus = context.createGain();
    bus.gain.value = 1;
    master.gain.value = this.muted ? 0 : 0.22;
    bus.connect(master);
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.bus = bus;
    return context;
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) return false;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }
    this.unlocked = context.state === "running";
    return this.unlocked;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.master || !this.context) return this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.22, this.context.currentTime, 0.02);
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  silence() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        // Already stopped.
      }
    }
    this.voices.clear();
    if (!this.bus || !this.context) return;
    const now = this.context.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(0, now);
    this.bus.gain.setValueAtTime(1, now + 0.04);
  }

  play(game, type, detail = {}) {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      context.resume().then(() => {
        if (this.muted || this.context?.state !== "running") return;
        if (game === "pong") this.playPong(type, detail);
      }).catch(() => {});
      return;
    }
    if (context.state !== "running") return;
    if (game === "pong") this.playPong(type, detail);
  }

  playPong(type, detail) {
    const pan = this.panFromDetail(detail);
    if (type === "paddle") {
      const speed = Number(detail.speed) || 390;
      const heat = clamp((speed - 390) / 370, 0, 1);
      this.tone({
        frequency: 520 + heat * 260,
        duration: 0.09,
        type: "square",
        gain: 0.11,
        slide: 90 + heat * 80,
        pan,
      });
      this.tone({
        frequency: 1040 + heat * 220,
        duration: 0.045,
        type: "square",
        gain: 0.04,
        delay: 0.012,
        pan,
      });
      return;
    }
    if (type === "wall") {
      this.tone({
        frequency: 240,
        duration: 0.055,
        type: "square",
        gain: 0.07,
        slide: -40,
        pan,
      });
      this.tone({
        frequency: 720,
        duration: 0.03,
        type: "triangle",
        gain: 0.035,
        pan,
      });
      return;
    }
    if (type === "score") {
      this.tone({ frequency: 440, duration: 0.12, type: "square", gain: 0.1, slide: 40, pan });
      this.tone({ frequency: 660, duration: 0.16, type: "square", gain: 0.09, delay: 0.09, slide: 70, pan });
      this.noise({ duration: 0.08, gain: 0.03, pan });
      return;
    }
    if (type === "win") {
      this.playPongWin(pan);
      return;
    }
    if (type === "start" || type === "serve") {
      this.tone({
        frequency: type === "start" ? 330 : 370,
        duration: 0.11,
        type: "triangle",
        gain: 0.055,
        slide: 160,
        pan: 0,
      });
    }
  }

  playPongWin(pan) {
    this.noise({ duration: 0.16, gain: 0.05, pan });
    this.tone({ frequency: 147, duration: 0.2, type: "square", gain: 0.1, slide: 50, pan });
    this.tone({ frequency: 196, duration: 0.16, type: "square", gain: 0.06, delay: 0.02, pan });

    const climb = [523, 659, 784, 988, 1175, 1397];
    climb.forEach((frequency, index) => {
      const bounce = index % 2 === 0 ? -0.78 : 0.78;
      this.tone({
        frequency,
        duration: 0.11,
        type: "square",
        gain: 0.1,
        delay: 0.08 + index * 0.09,
        slide: 36,
        pan: bounce,
      });
      this.tone({
        frequency: frequency * 2,
        duration: 0.055,
        type: "triangle",
        gain: 0.032,
        delay: 0.09 + index * 0.09,
        pan: bounce * 0.7,
      });
    });

    const resolveAt = 0.66;
    [
      [262, 0.075, 0.48, -0.35],
      [330, 0.07, 0.5, -0.12],
      [392, 0.08, 0.54, 0.12],
      [523, 0.1, 0.58, 0.35],
    ].forEach(([frequency, gain, duration, chordPan]) => {
      this.tone({
        frequency,
        duration,
        type: "square",
        gain,
        delay: resolveAt,
        pan: chordPan,
      });
    });

    this.tone({ frequency: 784, duration: 0.2, type: "square", gain: 0.1, delay: 0.98, slide: 70, pan: -0.2 });
    this.tone({ frequency: 1047, duration: 0.32, type: "square", gain: 0.11, delay: 1.1, slide: 90, pan: 0 });
    this.tone({ frequency: 1568, duration: 0.2, type: "triangle", gain: 0.05, delay: 1.16, pan: -0.55 });
    this.tone({ frequency: 2093, duration: 0.18, type: "triangle", gain: 0.04, delay: 1.24, pan: 0.55 });
    this.tone({ frequency: 2637, duration: 0.14, type: "triangle", gain: 0.025, delay: 1.32, pan: 0 });
    this.noise({ duration: 0.22, gain: 0.028, delay: 1.08, pan: 0 });
  }

  panFromDetail(detail) {
    if (Number.isFinite(Number(detail.pan))) return clamp(Number(detail.pan), -0.9, 0.9);
    if (Number.isFinite(Number(detail.x)) && Number.isFinite(Number(detail.width)) && detail.width > 0) {
      return clamp((Number(detail.x) / Number(detail.width)) * 2 - 1, -0.85, 0.85);
    }
    if (detail.playerId === 1) return -0.7;
    if (detail.playerId === 2) return 0.7;
    return 0;
  }

  tone({
    frequency,
    duration,
    type = "square",
    gain = 0.08,
    slide = 0,
    pan = 0,
    delay = 0,
  }) {
    const context = this.context;
    if (!context || !this.bus) return;
    const startAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(40, frequency), startAt);
    if (slide) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, frequency + slide),
        startAt + duration,
      );
    }
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(gain, startAt + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    panner.pan.setValueAtTime(clamp(pan, -1, 1), startAt);
    oscillator.connect(envelope);
    envelope.connect(panner);
    panner.connect(this.bus);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
    this.track(oscillator);
  }

  noise({ duration, gain = 0.02, pan = 0, delay = 0 }) {
    const context = this.context;
    if (!context || !this.bus) return;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }
    const source = context.createBufferSource();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();
    const startAt = context.currentTime + delay;
    source.buffer = buffer;
    envelope.gain.setValueAtTime(gain, startAt);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    panner.pan.setValueAtTime(clamp(pan, -1, 1), startAt);
    source.connect(envelope);
    envelope.connect(panner);
    panner.connect(this.bus);
    source.start(startAt);
    source.stop(startAt + duration + 0.02);
    this.track(source);
  }

  track(voice) {
    this.voices.add(voice);
    voice.addEventListener("ended", () => this.voices.delete(voice));
  }
}
