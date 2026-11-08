/**
 * Tiny synthesized soundscape — no audio files to download.
 * A tanpura-like drone (Sa + Pa), a match strike, a temple bell and
 * soft pentatonic plinks as the lake lights up.
 */

type Ctx = AudioContext;

import { Music } from "./music";

// Bhupali in the middle register (A3 … E5): warm, not tinkly
const PIANO = [220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.26];

export class SoundScape {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padNodes: OscillatorNode[] = [];
  private noise: AudioBuffer | null = null;
  private lastPlink = 0;
  private pianoIdx = 4;
  private music: Music | null = null;
  muted = false;

  /** Must be called from a user gesture (iOS). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    this.master = master;

    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.music = new Music(ctx, master, buf);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Don't keep playing while the person is off in WhatsApp sharing. */
  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  /** Soft santoor music, starting `delay` seconds after lighting. */
  startMusic(delay = 1.6) {
    this.music?.start(delay);
  }

  /** Flute melody joins as the lanterns rise. */
  riseMusic() {
    this.music?.rise();
  }

  stopMusic() {
    this.music?.stop();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.08);
  }

  strike() {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    const t = ctx.currentTime;
    // scratch
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.2);
    // whoosh of the flame catching
    const src2 = ctx.createBufferSource();
    src2.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t + 0.08);
    lp.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.22, t + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src2.connect(lp).connect(g2).connect(master);
    src2.start(t + 0.08);
    src2.stop(t + 0.62);
  }

  bell(freq = 392, gain = 0.22, delay = 0) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const partials: [number, number, number][] = [
      [1, 1, 4.5],
      [2.0, 0.45, 3],
      [2.76, 0.32, 2.4],
      [4.07, 0.16, 1.6],
      [5.4, 0.09, 1.1],
    ];
    for (const [ratio, amp, dec] of partials) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }

  /**
   * Soft piano note as a diya catches light. Notes walk gently up and down
   * Bhupali (D E F# A B) in the middle register, so a stream of them sounds
   * like someone idly playing, not random blips.
   */
  plink(nearness = 0.5) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    if (now - this.lastPlink < 0.24) return; // a few notes a second at most
    this.lastPlink = now;

    // random walk through the scale, biased to drift back to the middle
    const mid = (PIANO.length - 1) / 2;
    const step = Math.random() < 0.5 + (this.pianoIdx - mid) * 0.06 ? -1 : 1;
    this.pianoIdx = Math.max(0, Math.min(PIANO.length - 1, this.pianoIdx + step));
    const f = PIANO[this.pianoIdx];
    const t = now + Math.random() * 0.04; // tiny human timing
    const v = 0.012 + 0.016 * nearness;

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(2600, t);
    tone.frequency.exponentialRampToValueAtTime(900, t + 1.2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(v, t + 0.014); // soft hammer
    env.gain.exponentialRampToValueAtTime(v * 0.4, t + 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    tone.connect(env);

    // fundamental + gentle overtones that fade faster, like a felt piano
    for (const [mult, amp, dec] of [
      [1, 1, 2.6],
      [2, 0.28, 1.1],
      [3, 0.07, 0.6],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const a = ctx.createGain();
      a.gain.setValueAtTime(amp, t);
      a.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(a).connect(tone);
      o.start(t);
      o.stop(t + dec + 0.05);
    }

    let out: AudioNode = env;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 0.8 - 0.4;
      env.connect(p);
      out = p;
    }
    out.connect(master);
  }


  /** Drone: D (Sa) and A (Pa), slightly detuned, through a lowpass. */
  startPad() {
    const { ctx, master } = this;
    if (!ctx || !master || this.padGain) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 4); // quiet bed under the music
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 380;
    f.Q.value = 0.4;
    f.connect(g).connect(master);
    for (const [fr, det] of [
      [73.4, 0],
      [146.8, 4],
      [220, -3],
      [293.7, 6],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = "triangle"; // softer than sawtooth: less harmonium buzz
      o.frequency.value = fr;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = fr < 100 ? 0.5 : 0.3;
      o.connect(og).connect(f);
      o.start(t);
      this.padNodes.push(o);
    }
    this.padGain = g;
    this.padFilter = f;
  }

  /** Open the drone up as lanterns rise. */
  swell() {
    const { ctx, padFilter } = this;
    if (!ctx || !padFilter) return;
    const t = ctx.currentTime;
    padFilter.frequency.setTargetAtTime(650, t, 2.2);
  }

  stopPad() {
    const { ctx, padGain } = this;
    if (!ctx || !padGain) return;
    const t = ctx.currentTime;
    padGain.gain.cancelScheduledValues(t);
    padGain.gain.setTargetAtTime(0.0001, t, 0.6);
    const nodes = this.padNodes;
    this.padNodes = [];
    this.padGain = null;
    this.padFilter = null;
    for (const o of nodes) o.stop(t + 3);
  }

  dispose() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.music?.stop(0.1);
    this.music = null;
    this.stopPad();
    void this.ctx?.close();
    this.ctx = null;
  }
}
