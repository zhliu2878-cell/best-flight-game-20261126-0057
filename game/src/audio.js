// Aurora Run — audio.js
// Synthesised sound only, via WebAudio: engine hum whose pitch follows the
// throttle, wind noise that grows with speed, a ring chime, a landing thud
// and a crash burst. No audio files, nothing fetched.

export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let windSource = null, windGain = null, windFilter = null;
  let started = false;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  // Build the always-on engine + wind graph. Called on the first user gesture.
  function startEngine() {
    if (started) return;
    const ac = ensureContext();
    if (!ac) return;
    started = true;

    // Engine: two detuned sawtooths through a low-pass filter.
    engineOsc = ac.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 62;
    engineOsc2 = ac.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 31;
    engineFilter = ac.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ac.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ac.destination);
    engineOsc.start();
    engineOsc2.start();

    // Wind: looped white-noise buffer through a band-pass filter.
    const len = ac.sampleRate * 2;
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSource = ac.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter = ac.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ac.createGain();
    windGain.gain.value = 0.0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ac.destination);
    windSource.start();
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Per-frame: engine pitch + volume follow throttle, wind follows speed.
  function update(throttle, speed, airborne) {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const rpm = 55 + throttle * 75;
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
    engineFilter.frequency.setTargetAtTime(220 + throttle * 700, t, 0.1);
    engineGain.gain.setTargetAtTime(airborne ? 0.045 + throttle * 0.075 : 0.02, t, 0.1);
    const wind = Math.min(1, speed / 90);
    windGain.gain.setTargetAtTime(wind * wind * 0.11, t, 0.15);
    windFilter.frequency.setTargetAtTime(400 + speed * 12, t, 0.15);
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function ringChime() {
    blip(880, 0.5, 'sine', 0.22);
    blip(1318, 0.7, 'sine', 0.16, 0.07);
    blip(1760, 0.6, 'sine', 0.08, 0.14);
  }

  function fuelChime() {
    blip(523, 0.35, 'triangle', 0.2);
    blip(784, 0.5, 'triangle', 0.18, 0.09);
  }

  function landingThud() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  function crashBurst() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    blip(70, 0.5, 'sawtooth', 0.25);
  }

  return { startEngine, resume, update, ringChime, fuelChime, landingThud, crashBurst };
}
