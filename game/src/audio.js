// Solmar Bay's sound: fully synthesized WebAudio, nothing loaded from a
// file. Engine hum, two-tone SBPD sirens, gunfire, pickups — and Radio Solmar,
// an original chiptune station the player toggles with R.

/** The Radio Solmar tune: a sunny 8-bar loop, bass plus lead, in A minor. */
const RADIO_BPM = 112;
const RADIO_BASS = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
const RADIO_LEAD = [
  440, 523.25, 659.25, 523.25, 440, 0, 392, 0,
  440, 523.25, 659.25, 880, 659.25, 523.25, 440, 0,
  440, 523.25, 659.25, 523.25, 587.33, 659.25, 587.33, 523.25,
  493.88, 587.33, 659.25, 587.33, 523.25, 440, 392, 0,
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.radioOn = false;
    this.sirenOn = false;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.radioTimer = null;
    this.radioStep = 0;
    this.muted = false;
  }

  /** Create the context on the first user gesture; safe to call any time. */
  ensure() {
    if (this.ready) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.ready = true;
      this.startEngineHum();
    } catch (err) {
      this.ready = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  startEngineHum() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 28;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    this.engineNodes = { osc, osc2, filter, gain };
  }

  /** The engine follows the car's speed; silent on foot. */
  setEngine(speed01, driving) {
    if (!this.ready || !this.engineNodes) return;
    const t = this.ctx.currentTime;
    const g = driving ? 0.05 + speed01 * 0.06 : 0.0;
    this.engineNodes.gain.gain.setTargetAtTime(g, t, 0.08);
    this.engineNodes.osc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    this.engineNodes.osc2.frequency.setTargetAtTime(28 + speed01 * 65, t, 0.08);
    this.engineNodes.filter.frequency.setTargetAtTime(320 + speed01 * 900, t, 0.1);
  }

  /** The SBPD two-tone siren: 700 Hz and 950 Hz alternating twice a second. */
  setSiren(on) {
    if (!this.ready) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) {
      if (this.sirenNodes) {
        try { this.sirenNodes.osc.stop(); } catch (err) {}
        this.sirenNodes = null;
      }
      return;
    }
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 700;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 125;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0.028;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    lfo.start();
    this.sirenNodes = { osc, lfo };
  }

  /** A short filtered noise burst: one gunshot. */
  shot() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const dur = 0.14;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const gain = ctx.createGain();
    gain.gain.value = 0.22;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  /** A dull thud for a punch. */
  punch() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  }

  /** A two-note chime for a Sun Coin or a pickup. */
  chime() {
    if (!this.ready) return;
    const ctx = this.ctx;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  /** A short rising arpeggio when a mission is completed. */
  missionDone() {
    if (!this.ready) return;
    const ctx = this.ctx;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  /** Toggle Radio Solmar on or off; returns the new state. */
  toggleRadio() {
    this.ensure();
    this.radioOn = !this.radioOn;
    if (this.radioOn) this.startRadio();
    else this.stopRadio();
    return this.radioOn;
  }

  startRadio() {
    if (!this.ready || this.radioTimer) return;
    const stepSeconds = 60 / RADIO_BPM / 2;
    this.radioTimer = setInterval(() => {
      if (!this.ready) return;
      const i = this.radioStep % 16;
      const bass = RADIO_BASS[i];
      const lead = RADIO_LEAD[this.radioStep % 32];
      if (bass) this.blip(bass, stepSeconds * 0.95, 'triangle', 0.12);
      if (lead) this.blip(lead, stepSeconds * 0.9, 'square', 0.045);
      if (this.radioStep % 4 === 2) this.hat();
      this.radioStep += 1;
    }, stepSeconds * 1000);
  }

  stopRadio() {
    if (this.radioTimer) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }

  blip(freq, dur, type, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  hat() {
    const ctx = this.ctx;
    const dur = 0.03;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }
}
