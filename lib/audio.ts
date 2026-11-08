/**
 * Tiny synthesized soundscape — no audio files to download.
 * A tanpura-like drone (Sa + Pa), a match strike, a temple bell and
 * soft pentatonic plinks as the lake lights up.
 */

type Ctx = AudioContext;

const PENTA = [587.3, 659.3, 740, 880, 987.8, 1174.7, 1318.5, 1480];

export class SoundScape {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padNodes: OscillatorNode[] = [];
  private noise: AudioBuffer | null = null;
  private lastPlink = 0;
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

  plink(nearness = 0.5) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    if (now - this.lastPlink < 0.085) return;
    this.lastPlink = now;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = PENTA[(Math.random() * PENTA.length) | 0];
    const g = ctx.createGain();
    const v = 0.02 + 0.045 * nearness;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(v, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    let out: AudioNode = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      g.connect(p);
      out = p;
    }
    o.connect(g);
    out.connect(master);
    o.start(now);
    o.stop(now + 1.35);
  }

  /** Drone: D (Sa) and A (Pa), slightly detuned, through a lowpass. */
  startPad() {
    const { ctx, master } = this;
    if (!ctx || !master || this.padGain) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085, t + 4);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 520;
    f.Q.value = 0.4;
    f.connect(g).connect(master);
    for (const [fr, det] of [
      [73.4, 0],
      [146.8, 4],
      [220, -3],
      [293.7, 6],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
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
    padFilter.frequency.setTargetAtTime(1300, t, 2.2);
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
    this.stopPad();
    void this.ctx?.close();
    this.ctx = null;
  }
}
