// audio.js — every sound in Solmar Bay is synthesized live with WebAudio:
// no audio files, no network, nothing to download. The engine hum follows
// the car's speed, the siren swings two tones, gunfire is a burst of
// filtered noise, and Radio Solmar plays an original chiptune loop the
// moment the player presses R. The context only starts after a real
// key or click, so browsers never block it.

const RADIO_NOTES = [
  // An original 16-step chiptune line, A minor, bright and a little cocky.
  220.0, 261.63, 329.63, 440.0, 329.63, 261.63, 196.0, 246.94,
  220.0, 261.63, 329.63, 523.25, 440.0, 329.63, 261.63, 196.0,
];
const RADIO_BASS = [110.0, 110.0, 130.81, 164.81, 110.0, 130.81, 98.0, 123.47];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let sirenHigh = false;
  let radioOn = false;
  let radioTimer = null;
  let radioStep = 0;
  let radioGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 660;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.05;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenTimer = window.setInterval(() => {
      if (!sirenOsc) return;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.setTargetAtTime(sirenHigh ? 880 : 660, ctx.currentTime, 0.02);
    }, 320);
  }

  function stopSiren() {
    if (sirenTimer) window.clearInterval(sirenTimer);
    sirenTimer = null;
    if (sirenOsc) {
      try { sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc.disconnect();
      sirenOsc = null;
    }
    if (sirenGain) {
      sirenGain.disconnect();
      sirenGain = null;
    }
  }

  function playRadioStep() {
    if (!ctx || !radioOn) return;
    const t = ctx.currentTime;
    const note = RADIO_NOTES[radioStep % RADIO_NOTES.length];
    const bass = RADIO_BASS[Math.floor(radioStep / 2) % RADIO_BASS.length];
    const lead = ctx.createOscillator();
    lead.type = 'square';
    lead.frequency.value = note;
    const leadGain = ctx.createGain();
    leadGain.gain.setValueAtTime(0.06, t);
    leadGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    lead.connect(leadGain);
    leadGain.connect(radioGain);
    lead.start(t);
    lead.stop(t + 0.24);
    const low = ctx.createOscillator();
    low.type = 'triangle';
    low.frequency.value = bass;
    const lowGain = ctx.createGain();
    lowGain.gain.setValueAtTime(0.09, t);
    lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    low.connect(lowGain);
    lowGain.connect(radioGain);
    low.start(t);
    low.stop(t + 0.42);
    radioStep++;
  }

  return {
    get radioOn() {
      return radioOn;
    },
    // Call on the first key or click; safe to call every frame.
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      startEngine();
    },
    // speed01 is 0..1 of the car's top speed; 0 and not driving silences it.
    engine(speed01, driving) {
      if (!ctx || !engineGain) return;
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ensure()) return;
      if (on) startSiren();
      else stopSiren();
    },
    shot() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const dur = 0.14;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    },
    punch() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.13);
    },
    coin() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [880, 1318.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        const start = t + i * 0.09;
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.26);
      });
    },
    missionDone() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        const start = t + i * 0.11;
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    },
    toggleRadio() {
      if (!ensure()) return false;
      radioOn = !radioOn;
      if (radioOn) {
        if (!radioGain) {
          radioGain = ctx.createGain();
          radioGain.gain.value = 0.9;
          radioGain.connect(master);
        }
        radioStep = 0;
        playRadioStep();
        radioTimer = window.setInterval(playRadioStep, 240);
      } else if (radioTimer) {
        window.clearInterval(radioTimer);
        radioTimer = null;
      }
      return radioOn;
    },
  };
}
