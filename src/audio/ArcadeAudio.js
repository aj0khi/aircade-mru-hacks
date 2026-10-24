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
    this.breakoutMusicTimer = null;
    this.breakoutMusicStep = 0;
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
    this.stopBreakoutMusic();
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
    if (game === "breakout" && (type === "pause" || type === "lose-life" || type === "die" || type === "win")) {
      this.stopBreakoutMusic();
      if (type === "pause") return;
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
    if (game === "breakout") this.playBreakout(type, detail);
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
    if (type === "impact") {
      this.noise({ duration: 0.16, gain: 0.085, pan });
      this.tone({
        frequency: 155,
        duration: 0.16,
        type: "sawtooth",
        gain: 0.13,
        slide: -95,
        pan,
      });
      this.tone({
        frequency: 920,
        duration: 0.06,
        type: "square",
        gain: 0.095,
        slide: -420,
        pan,
      });
      this.tone({
        frequency: 1480,
        duration: 0.045,
        type: "triangle",
        gain: 0.06,
        delay: 0.015,
        slide: -500,
        pan: -pan * 0.5,
      });
      return;
    }
    if (type === "pin") {
      const count = clamp(Number(detail.count) || 1, 1, 10);
      const bursts = Math.min(count + 1, 7);
      this.noise({ duration: 0.12 + bursts * 0.022, gain: 0.06 + bursts * 0.007, pan });
      this.tone({
        frequency: 190 + count * 12,
        duration: 0.12,
        type: "triangle",
        gain: 0.09,
        slide: -80,
        pan,
      });
      for (let i = 0; i < bursts; i += 1) {
        const hitPan = clamp(pan + (i % 2 === 0 ? -0.32 : 0.32) * ((i % 3) + 1) * 0.3, -0.9, 0.9);
        const baseFreq = 640 + (i * 135) + (count * 22);
        this.tone({
          frequency: baseFreq,
          duration: 0.08,
          type: "square",
          gain: 0.09,
          delay: i * 0.028,
          slide: -210,
          pan: hitPan,
        });
        this.tone({
          frequency: baseFreq * 1.72,
          duration: 0.05,
          type: "triangle",
          gain: 0.055,
          delay: i * 0.028 + 0.01,
          slide: -140,
          pan: -hitPan * 0.65,
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
    this.noise({ duration: 0.28, gain: 0.085, pan: 0 });
    this.tone({ frequency: 131, duration: 0.24, type: "sawtooth", gain: 0.11, slide: 65, pan: 0 });
    this.tone({ frequency: 262, duration: 0.2, type: "square", gain: 0.09, delay: 0.03, slide: 90, pan: 0 });

    const fanfare = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    fanfare.forEach((frequency, index) => {
      const bounce = index % 2 === 0 ? -0.78 : 0.78;
      this.tone({
        frequency,
        duration: 0.13,
        type: "square",
        gain: 0.105,
        delay: 0.08 + index * 0.075,
        slide: 48,
        pan: bounce,
      });
      this.tone({
        frequency: frequency * 1.5,
        duration: 0.075,
        type: "triangle",
        gain: 0.048,
        delay: 0.095 + index * 0.075,
        pan: -bounce * 0.65,
      });
    });

    const chordDelay = 0.7;
    [523, 659, 784, 1047, 1319].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 0.55,
        type: "square",
        gain: 0.08,
        delay: chordDelay,
        slide: 25,
        pan: (index - 2) * 0.32,
      });
    });
    this.tone({ frequency: 1568, duration: 0.24, type: "triangle", gain: 0.06, delay: 0.95, slide: 120, pan: -0.5 });
    this.tone({ frequency: 2093, duration: 0.28, type: "triangle", gain: 0.055, delay: 1.06, slide: 140, pan: 0.5 });
    this.noise({ duration: 0.24, gain: 0.04, delay: 0.96, pan: 0 });
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

  playBreakout(type, detail) {
    const pan = this.panFromDetail(detail);
    if (type === "start") {
      this.startBreakoutMusic();
      this.tone({
        frequency: 370,
        duration: 0.12,
        type: "triangle",
        gain: 0.06,
        slide: 190,
        pan: 0,
      });
      return;
    }
    if (type === "resume") {
      this.startBreakoutMusic();
      return;
    }
    if (type === "wall") {
      this.tone({
        frequency: 280,
        duration: 0.05,
        type: "square",
        gain: 0.065,
        slide: -45,
        pan,
      });
      this.tone({
        frequency: 760,
        duration: 0.03,
        type: "triangle",
        gain: 0.035,
        pan,
      });
      return;
    }
    if (type === "paddle") {
      const edge = Math.abs(Number(detail.hit) || 0);
      const base = 460 + edge * 160;
      this.tone({
        frequency: base,
        duration: 0.085,
        type: "square",
        gain: 0.1,
        slide: 110,
        pan,
      });
      this.tone({
        frequency: base * 2,
        duration: 0.045,
        type: "triangle",
        gain: 0.045,
        delay: 0.012,
        pan,
      });
      return;
    }
    if (type === "brick") {
      const row = clamp(Number(detail.row) || 0, 0, 4);
      const rowScale = [880, 784, 659, 587, 523];
      const base = rowScale[row] || 659;
      this.noise({ duration: 0.045, gain: 0.032, pan });
      this.tone({
        frequency: base,
        duration: 0.09,
        type: "square",
        gain: 0.095,
        slide: 120,
        pan,
      });
      this.tone({
        frequency: base * 1.5,
        duration: 0.07,
        type: "triangle",
        gain: 0.05,
        delay: 0.035,
        slide: 90,
        pan: -pan * 0.5,
      });
      return;
    }
    if (type === "lose-life") {
      this.playSillyEwww(pan, false);
      return;
    }
    if (type === "die") {
      this.playBreakoutLose(pan);
      return;
    }
    if (type === "win") {
      this.playPongWin(pan);
    }
  }

  startBreakoutMusic() {
    this.stopBreakoutMusic();
    this.breakoutMusicStep = 0;
    const pad = [262, 294, 330, 294, 247, 262, 294, 220];
    const chime = [523, 0, 659, 0, 587, 0, 494, 0];
    const tick = () => {
      if (this.muted || !this.context || this.context.state !== "running") return;
      const step = this.breakoutMusicStep % pad.length;
      const stepPan = step % 2 === 0 ? -0.25 : 0.25;
      this.tone({
        frequency: pad[step],
        duration: 0.32,
        type: "sine",
        gain: 0.024,
        pan: -stepPan * 0.5,
      });
      if (chime[step]) {
        this.tone({
          frequency: chime[step],
          duration: 0.26,
          type: "triangle",
          gain: 0.015,
          delay: 0.04,
          pan: stepPan,
        });
      }
      this.breakoutMusicStep += 1;
    };
    tick();
    this.breakoutMusicTimer = window.setInterval(tick, 360);
  }

  stopBreakoutMusic() {
    if (!this.breakoutMusicTimer) return;
    window.clearInterval(this.breakoutMusicTimer);
    this.breakoutMusicTimer = null;
  }

  playSillyEwww(pan = 0, full = false) {
    const context = this.context;
    if (!context || !this.bus) return;
    const now = context.currentTime;
    const duration = full ? 0.68 : 0.48;

    // Formant-filtered sawtooth vocal synth: morphs from nasal "Ehhh" (/i/ /e/) -> "uuuuw" (/u/)
    const carrier = context.createOscillator();
    const sub = context.createOscillator();
    const vibrato = context.createOscillator();
    const vibratoGain = context.createGain();
    const f1 = context.createBiquadFilter();
    const f2 = context.createBiquadFilter();
    const voiceGain = context.createGain();
    const panner = context.createStereoPanner();

    carrier.type = "sawtooth";
    sub.type = "square";
    // Nasal cartoon pitch: starts high "Eeee", bends down into "uuuuw"
    carrier.frequency.setValueAtTime(340, now);
    carrier.frequency.linearRampToValueAtTime(395, now + 0.07);
    carrier.frequency.exponentialRampToValueAtTime(185, now + duration);

    sub.frequency.setValueAtTime(170, now);
    sub.frequency.linearRampToValueAtTime(197.5, now + 0.07);
    sub.frequency.exponentialRampToValueAtTime(92.5, now + duration);

    // Goofy wobble vibrato
    vibrato.frequency.setValueAtTime(9.5, now);
    vibratoGain.gain.setValueAtTime(14, now);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(carrier.frequency);

    // Formant 1: 420 Hz -> 290 Hz
    f1.type = "bandpass";
    f1.Q.setValueAtTime(7, now);
    f1.frequency.setValueAtTime(430, now);
    f1.frequency.exponentialRampToValueAtTime(280, now + duration);

    // Formant 2: 2250 Hz ("eee") -> 780 Hz ("uuu")
    f2.type = "bandpass";
    f2.Q.setValueAtTime(9, now);
    f2.frequency.setValueAtTime(2250, now);
    f2.frequency.exponentialRampToValueAtTime(760, now + duration * 0.78);

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(0.24, now + 0.025);
    voiceGain.gain.setValueAtTime(0.22, now + duration * 0.65);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    panner.pan.setValueAtTime(clamp(pan, -0.8, 0.8), now);

    carrier.connect(f1);
    carrier.connect(f2);
    sub.connect(f1);
    f1.connect(voiceGain);
    f2.connect(voiceGain);
    voiceGain.connect(panner);
    panner.connect(this.bus);

    carrier.start(now);
    sub.start(now);
    vibrato.start(now);
    carrier.stop(now + duration + 0.03);
    sub.stop(now + duration + 0.03);
    vibrato.stop(now + duration + 0.03);
    this.track(carrier);
    this.track(sub);
    this.track(vibrato);

    // Quick cartoon nose-pinch "nyeh" harmonic on top
    this.tone({
      frequency: 1180,
      duration: duration * 0.7,
      type: "triangle",
      gain: 0.045,
      slide: -620,
      pan: -pan * 0.5,
    });
  }

  playRaspberrySplat(delay = 0, duration = 0.36, pan = 0) {
    const context = this.context;
    if (!context || !this.bus) return;
    const startAt = context.currentTime + delay;

    // Sputtering low sawtooth + flutter LFO ("pbbbbt!" raspberry/fart splat)
    const osc = context.createOscillator();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    const filter = context.createBiquadFilter();
    const env = context.createGain();
    const panner = context.createStereoPanner();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(92, startAt);
    osc.frequency.exponentialRampToValueAtTime(46, startAt + duration);

    lfo.type = "square";
    lfo.frequency.setValueAtTime(28, startAt);
    lfo.frequency.exponentialRampToValueAtTime(15, startAt + duration);
    lfoGain.gain.setValueAtTime(320, startAt);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, startAt);
    filter.Q.setValueAtTime(5, startAt);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    env.gain.setValueAtTime(0.0001, startAt);
    env.gain.exponentialRampToValueAtTime(0.14, startAt + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    panner.pan.setValueAtTime(clamp(pan, -0.8, 0.8), startAt);

    osc.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(this.bus);

    osc.start(startAt);
    lfo.start(startAt);
    osc.stop(startAt + duration + 0.02);
    lfo.stop(startAt + duration + 0.02);
    this.track(osc);
    this.track(lfo);

    this.noise({ duration: duration * 0.75, gain: 0.045, delay, pan });
  }

  playBreakoutLose(pan) {
    // 1. Nasal cartoon "Ewwwww!" groan
    this.playSillyEwww(pan, true);

    // 2. Wet sputtering raspberry / fart splat ("pbbbbt!")
    this.playRaspberrySplat(0.62, 0.42, -pan * 0.6);

    // 3. Goofy "wah-wah-waaaah" sad horn + spring boing
    const wahNotes = [
      { freq: 370, slide: -35, delay: 1.06, dur: 0.19, pan: -0.5 },
      { freq: 349, slide: -35, delay: 1.26, dur: 0.19, pan: 0.5 },
      { freq: 311, slide: -145, delay: 1.46, dur: 0.48, pan: 0 },
    ];
    wahNotes.forEach(({ freq, slide, delay, dur, pan: notePan }) => {
      this.tone({
        frequency: freq,
        duration: dur,
        type: "sawtooth",
        gain: 0.08,
        delay,
        slide,
        pan: notePan,
      });
      this.tone({
        frequency: freq * 0.5,
        duration: dur,
        type: "triangle",
        gain: 0.055,
        delay,
        slide: slide * 0.5,
        pan: -notePan * 0.5,
      });
    });

    // 4. Final silly cartoon boing-oing
    this.tone({ frequency: 180, duration: 0.13, type: "sine", gain: 0.085, delay: 1.96, slide: 420, pan: -0.35 });
    this.tone({ frequency: 600, duration: 0.15, type: "sine", gain: 0.075, delay: 2.07, slide: -360, pan: 0.35 });
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
