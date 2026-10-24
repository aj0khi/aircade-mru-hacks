const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ArcadeAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.bus = null;
    this.muted = false;
    this.voices = new Set();
    this.unlocked = false;
    this.snakeMusicTimer = null;
    this.snakeMusicStep = 0;
    this.bowlingMusicTimer = null;
    this.bowlingMusicStep = 0;
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
    this.stopSnakeMusic();
    this.stopBowlingMusic();
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
    if (game === "snake" && (type === "pause" || type === "die")) {
      this.stopSnakeMusic();
      if (type === "pause") return;
    }
    if (game === "bowling" && type === "pause") {
      this.stopBowlingMusic();
      return;
    }
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      context.resume().then(() => {
        if (this.muted || this.context?.state !== "running") return;
        this.playGame(game, type, detail);
      }).catch(() => {});
      return;
    }
    if (context.state !== "running") return;
    this.playGame(game, type, detail);
  }

  playGame(game, type, detail) {
    if (game === "pong") this.playPong(type, detail);
    if (game === "snake") this.playSnake(type, detail);
    if (game === "bowling") this.playBowling(type, detail);
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

  playSnake(type, detail) {
    const pan = this.panFromDetail(detail);
    if (type === "start") {
      this.startSnakeMusic();
      this.tone({
        frequency: 349,
        duration: 0.12,
        type: "triangle",
        gain: 0.055,
        slide: 180,
        pan: 0,
      });
      return;
    }
    if (type === "resume") {
      this.startSnakeMusic();
      return;
    }
    if (type === "eat") {
      const score = Number(detail.score) || 1;
      const heat = clamp((score - 1) / 12, 0, 1);
      const base = 620 + heat * 220;
      this.tone({
        frequency: base,
        duration: 0.09,
        type: "square",
        gain: 0.1,
        slide: 140,
        pan,
      });
      this.tone({
        frequency: base * 1.5,
        duration: 0.08,
        type: "triangle",
        gain: 0.05,
        delay: 0.05,
        slide: 80,
        pan,
      });
      return;
    }
    if (type === "die") {
      this.stopSnakeMusic();
      this.playSnakeGameOver(pan);
    }
  }

  startSnakeMusic() {
    this.stopSnakeMusic();
    this.snakeMusicStep = 0;
    const bass = [131, 131, 165, 196, 175, 175, 147, 196];
    const lead = [523, 0, 659, 587, 523, 392, 440, 494];
    const tick = () => {
      if (this.muted || !this.context || this.context.state !== "running") return;
      const step = this.snakeMusicStep % bass.length;
      const swingPan = step % 2 === 0 ? -0.35 : 0.35;
      this.tone({
        frequency: bass[step],
        duration: 0.16,
        type: "triangle",
        gain: 0.042,
        pan: -swingPan * 0.6,
      });
      if (lead[step]) {
        this.tone({
          frequency: lead[step],
          duration: 0.11,
          type: "square",
          gain: 0.025,
          delay: 0.02,
          slide: 18,
          pan: swingPan,
        });
      }
      this.snakeMusicStep += 1;
    };
    tick();
    this.snakeMusicTimer = window.setInterval(tick, 220);
  }

  stopSnakeMusic() {
    if (!this.snakeMusicTimer) return;
    window.clearInterval(this.snakeMusicTimer);
    this.snakeMusicTimer = null;
  }

  playSnakeGameOver(pan) {
    this.noise({ duration: 0.18, gain: 0.055, pan });
    this.tone({ frequency: 220, duration: 0.14, type: "square", gain: 0.11, slide: -90, pan });
    this.tone({ frequency: 110, duration: 0.24, type: "sawtooth", gain: 0.09, delay: 0.03, slide: -45, pan: 0 });

    const fall = [659, 622, 587, 554, 523, 466, 392, 311];
    fall.forEach((frequency, index) => {
      const spin = index % 2 === 0 ? -0.75 : 0.75;
      this.tone({
        frequency,
        duration: 0.1,
        type: "square",
        gain: 0.09,
        delay: 0.1 + index * 0.075,
        slide: -42,
        pan: spin,
      });
      this.tone({
        frequency: frequency * 0.5,
        duration: 0.09,
        type: "triangle",
        gain: 0.045,
        delay: 0.11 + index * 0.075,
        pan: -spin * 0.5,
      });
    });

    const thudAt = 0.74;
    [
      [196, 0.085, -0.4],
      [233, 0.08, 0],
      [277, 0.085, 0.4],
    ].forEach(([frequency, gain, chordPan]) => {
      this.tone({
        frequency,
        duration: 0.48,
        type: "sawtooth",
        gain,
        delay: thudAt,
        slide: -36,
        pan: chordPan,
      });
    });
    this.tone({ frequency: 98, duration: 0.55, type: "triangle", gain: 0.1, delay: thudAt, slide: -30, pan: 0 });
    this.noise({ duration: 0.24, gain: 0.03, delay: thudAt + 0.04, pan: 0 });
  }

  playBowling(type, detail) {
    const pan = this.panFromDetail(detail);
    if (type === "start" || type === "resume") {
      this.startBowlingMusic();
      this.tone({
        frequency: 330,
        duration: 0.12,
        type: "triangle",
        gain: 0.055,
        slide: 140,
        pan: 0,
      });
      return;
    }
    if (type === "aim") {
      this.tone({
        frequency: 520,
        duration: 0.035,
        type: "triangle",
        gain: 0.03,
        slide: 40,
        pan,
      });
      return;
    }
    if (type === "throw") {
      const power = clamp(Number(detail.power) || 0.75, 0.25, 1);
      this.noise({ duration: 0.18, gain: 0.035 * power, pan });
      this.tone({
        frequency: 110 + power * 45,
        duration: 0.34,
        type: "triangle",
        gain: 0.075,
        slide: 95,
        pan,
      });
      this.tone({
        frequency: 220 + power * 80,
        duration: 0.18,
        type: "sine",
        gain: 0.04,
        delay: 0.05,
        slide: 120,
        pan,
      });
      return;
    }
    if (type === "pin") {
      const count = clamp(Number(detail.count) || 1, 1, 10);
      const bursts = Math.min(count, 5);
      this.noise({ duration: 0.09 + bursts * 0.02, gain: 0.045 + bursts * 0.006, pan });
      for (let i = 0; i < bursts; i += 1) {
        const hitPan = clamp(pan + (i % 2 === 0 ? -0.22 : 0.22) * (i + 1) * 0.3, -0.9, 0.9);
        const baseFreq = 580 + i * 115 + (count * 18);
        this.tone({
          frequency: baseFreq,
          duration: 0.075,
          type: "square",
          gain: 0.075,
          delay: i * 0.032,
          slide: -160,
          pan: hitPan,
        });
        this.tone({
          frequency: baseFreq * 1.65,
          duration: 0.045,
          type: "triangle",
          gain: 0.04,
          delay: i * 0.032 + 0.01,
          slide: -90,
          pan: -hitPan * 0.6,
        });
      }
      return;
    }
    if (type === "gutter") {
      this.noise({ duration: 0.14, gain: 0.04, pan });
      this.tone({
        frequency: 185,
        duration: 0.18,
        type: "sawtooth",
        gain: 0.075,
        slide: -75,
        pan,
      });
      this.tone({
        frequency: 120,
        duration: 0.22,
        type: "triangle",
        gain: 0.07,
        delay: 0.1,
        slide: -40,
        pan,
      });
      return;
    }
    if (type === "miss") {
      this.tone({ frequency: 247, duration: 0.14, type: "sawtooth", gain: 0.065, slide: -40, pan: -0.25 });
      this.tone({ frequency: 185, duration: 0.22, type: "sawtooth", gain: 0.07, delay: 0.12, slide: -55, pan: 0.25 });
      return;
    }
    if (type === "frame") {
      const count = clamp(Number(detail.count) || 1, 1, 9);
      const base = 392 + count * 22;
      this.tone({ frequency: base, duration: 0.1, type: "square", gain: 0.065, pan: -0.2 });
      this.tone({ frequency: base * 1.25, duration: 0.14, type: "triangle", gain: 0.065, delay: 0.08, slide: 40, pan: 0.2 });
      return;
    }
    if (type === "spare") {
      const notes = [440, 554, 659, 880];
      notes.forEach((frequency, index) => {
        const notePan = index % 2 === 0 ? -0.55 : 0.55;
        this.tone({
          frequency,
          duration: 0.13,
          type: "square",
          gain: 0.085,
          delay: index * 0.085,
          slide: 35,
          pan: notePan,
        });
      });
      this.tone({ frequency: 1109, duration: 0.26, type: "triangle", gain: 0.07, delay: 0.34, slide: 60, pan: 0 });
      return;
    }
    if (type === "strike") {
      this.playBowlingStrike();
      return;
    }
    if (type === "gameover") {
      this.playBowlingGameOver();
    }
  }

  startBowlingMusic() {
    this.stopBowlingMusic();
    this.bowlingMusicStep = 0;
    const bass = [110, 110, 147, 165, 131, 131, 165, 196];
    const chords = [440, 0, 523, 659, 392, 0, 494, 587];
    const tick = () => {
      if (this.muted || !this.context || this.context.state !== "running") return;
      const step = this.bowlingMusicStep % bass.length;
      const groovePan = step % 2 === 0 ? -0.32 : 0.32;
      this.tone({
        frequency: bass[step],
        duration: 0.18,
        type: "triangle",
        gain: 0.04,
        pan: -groovePan * 0.5,
      });
      if (chords[step]) {
        this.tone({
          frequency: chords[step],
          duration: 0.12,
          type: "square",
          gain: 0.022,
          delay: 0.03,
          slide: 14,
          pan: groovePan,
        });
      }
      this.bowlingMusicStep += 1;
    };
    tick();
    this.bowlingMusicTimer = window.setInterval(tick, 250);
  }

  stopBowlingMusic() {
    if (!this.bowlingMusicTimer) return;
    window.clearInterval(this.bowlingMusicTimer);
    this.bowlingMusicTimer = null;
  }

  playBowlingStrike() {
    this.noise({ duration: 0.2, gain: 0.06, pan: 0 });
    const fanfare = [523, 659, 784, 1047, 1319, 1568];
    fanfare.forEach((frequency, index) => {
      const bounce = index % 2 === 0 ? -0.75 : 0.75;
      this.tone({
        frequency,
        duration: 0.12,
        type: "square",
        gain: 0.095,
        delay: 0.05 + index * 0.075,
        slide: 45,
        pan: bounce,
      });
      this.tone({
        frequency: frequency * 1.5,
        duration: 0.07,
        type: "triangle",
        gain: 0.04,
        delay: 0.065 + index * 0.075,
        pan: -bounce * 0.6,
      });
    });
    [523, 659, 784, 1047].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 0.45,
        type: "square",
        gain: 0.07,
        delay: 0.54,
        pan: (index - 1.5) * 0.28,
      });
    });
  }

  playBowlingGameOver() {
    const finale = [523, 659, 784, 659, 784, 1047];
    finale.forEach((frequency, index) => {
      const pan = index % 2 === 0 ? -0.55 : 0.55;
      this.tone({
        frequency,
        duration: 0.14,
        type: "square",
        gain: 0.085,
        delay: index * 0.09,
        slide: 30,
        pan,
      });
    });
    this.tone({ frequency: 523, duration: 0.48, type: "triangle", gain: 0.08, delay: 0.58, pan: -0.25 });
    this.tone({ frequency: 784, duration: 0.48, type: "triangle", gain: 0.08, delay: 0.58, pan: 0.25 });
    this.tone({ frequency: 1047, duration: 0.55, type: "square", gain: 0.09, delay: 0.62, slide: 50, pan: 0 });
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
    if (Number.isFinite(Number(detail.x)) && Number.isFinite(Number(detail.columns)) && detail.columns > 1) {
      return clamp((Number(detail.x) / (Number(detail.columns) - 1)) * 2 - 1, -0.85, 0.85);
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
