// audio.js — procedural sound for Senja Flight, no audio files.
// A sawtooth engine hum tracks the throttle, filtered noise is the wind,
// and short blips mark rings, landings and trouble. Everything starts on
// the player's first gesture, so browsers allow it.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.muted = false;
    this.started = false;
  }

  ensure() {
    if (this.started) {
      if (this.context && this.context.state === 'suspended') this.context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.started = true;

      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      const secondOsc = this.context.createOscillator();
      secondOsc.type = 'sawtooth';
      secondOsc.frequency.value = 93;
      this.engineFilter = this.context.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      secondOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.context.destination);
      this.engineOsc.start();
      secondOsc.start();
      this.secondOsc = secondOsc;

      // Wind: looped white noise through a bandpass.
      const length = this.context.sampleRate * 2;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      this.windSource = this.context.createBufferSource();
      this.windSource.buffer = buffer;
      this.windSource.loop = true;
      this.windFilter = this.context.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 700;
      this.windFilter.Q.value = 0.6;
      this.windGain = this.context.createGain();
      this.windGain.gain.value = 0;
      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.context.destination);
      this.windSource.start();
    } catch (error) {
      this.context = null;
      this.started = false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.context) {
      this.context.resume();
      this.engineGain.gain.value = this.muted ? 0 : this.engineGain.gain.value;
      this.windGain.gain.value = this.muted ? 0 : this.windGain.gain.value;
    }
    return this.muted;
  }

  // Called every frame while flying: engine note follows throttle, wind
  // follows airspeed. Silent when muted or before the first gesture.
  updateFlight(throttle, speed, onGround) {
    if (!this.context || this.muted) return;
    const time = this.context.currentTime;
    const engineLevel = onGround ? 0.015 : 0.02 + throttle * 0.05;
    this.engineGain.gain.setTargetAtTime(engineLevel, time, 0.1);
    const frequency = 52 + throttle * 68 + speed * 0.12;
    this.engineOsc.frequency.setTargetAtTime(frequency, time, 0.08);
    this.secondOsc.frequency.setTargetAtTime(frequency * 1.5, time, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, time, 0.1);
    const windLevel = onGround ? 0 : Math.min(0.11, speed * 0.00045);
    this.windGain.gain.setTargetAtTime(windLevel, time, 0.15);
    this.windFilter.frequency.setTargetAtTime(480 + speed * 3.2, time, 0.15);
  }

  updateIdle() {
    if (!this.context || this.muted) return;
    const time = this.context.currentTime;
    this.engineGain.gain.setTargetAtTime(0.008, time, 0.2);
    this.windGain.gain.setTargetAtTime(0.004, time, 0.2);
  }

  blip(frequency, duration, volume, type) {
    if (!this.context || this.muted) return;
    try {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume || 0.12, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.start();
      osc.stop(this.context.currentTime + duration + 0.02);
    } catch (error) {
      // A missed blip is never worth breaking the game over.
    }
  }

  ringChime() {
    this.blip(880, 0.22, 0.14);
    window.setTimeout(() => this.blip(1318, 0.3, 0.12), 70);
  }

  landingThud() {
    this.blip(120, 0.25, 0.2, 'triangle');
  }

  warningBeep() {
    this.blip(520, 0.12, 0.1, 'square');
  }

  crashNoise() {
    if (!this.context || this.muted) return;
    try {
      const length = this.context.sampleRate * 0.5;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const gain = this.context.createGain();
      gain.gain.value = 0.3;
      source.connect(gain);
      gain.connect(this.context.destination);
      source.start();
    } catch (error) {
      // Silence on failure, as above.
    }
  }
}
