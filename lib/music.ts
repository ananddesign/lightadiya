/**
 * Soft festive score, fully synthesized (no audio files).
 *
 * Raag Bhupali (S R G P D: the D major pentatonic) over the tanpura drone:
 *  - santoor-like hammered arpeggios once the diya is lit
 *  - a bansuri-like flute melody with gentle meend (slides) as lanterns rise
 *  - a few ghungroo-like shimmers between phrases
 * Everything goes through a small echo for space.
 */

const SA = 293.66; // D4
const ratio = (semi: number) => Math.pow(2, semi / 12);
// Bhupali degrees as semitones from Sa
const DEG: Record<string, number> = {
  ".P": -5, ".D": -3, S: 0, R: 2, G: 4, P: 7, D: 9, "S'": 12, "R'": 14, "G'": 16, "P'": 19,
};
const hz = (n: string) => SA * ratio(DEG[n]);

const BPM = 72;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;

// santoor arpeggio bars (eighth notes)
const ARP: string[][] = [
  ["S", "G", "P", "S'", "P", "G", "R", "G"],
  ["S", "R", "G", "P", "D", "P", "G", "R"],
  [".D", "S", "G", "P", "D", "S'", "D", "P"],
  ["G", "P", "D", "S'", "R'", "S'", "D", "P"],
  ["S", "G", "P", "D", "P", "G", "R", "S"],
  ["R", "G", "P", "S'", "D", "P", "G", "P"],
];
// bass root under each bar
const BASS = [-12, -12, -15, -17, -12, -10]; // D3, D3, B2, A2, D3, E3

// bansuri phrases: [note | "-" rest, beats]
const FLUTE: [string, number][][] = [
  [["G'", 2], ["R'", 1], ["S'", 1], ["D", 2], ["P", 2]],
  [["G", 1], ["P", 1], ["D", 2], ["S'", 3], ["-", 1]],
  [["R'", 2], ["G'", 1], ["R'", 1], ["S'", 2], ["D", 2]],
  [["P", 1], ["G", 1], ["R", 2], ["S", 3], ["-", 1]],
  [["S'", 1], ["D", 1], ["S'", 2], ["R'", 1], ["G'", 1], ["P'", 2]],
  [["G'", 2], ["R'", 2], ["S'", 3], ["-", 1]],
  [["D", 1], ["P", 1], ["G", 2], ["P", 1], ["D", 1], ["S'", 2]],
  [["D", 2], ["P", 2], ["G", 3], ["-", 1]],
];

export class Music {
  private ctx: AudioContext;
  private out: GainNode;
  private echoIn: GainNode;
  private timer = 0;
  private nextArp = 0;
  private arpStep = 0;
  private nextFlute = 0;
  private fluteStep = 0;
  private flute = false;
  private noise: AudioBuffer;
  running = false;

  constructor(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);

    // simple echo / space
    this.echoIn = ctx.createGain();
    this.echoIn.gain.value = 0.32;
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = EIGHTH * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    this.echoIn.connect(delay);
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(this.out);
  }

  /** Start the santoor layer `delay` seconds from now. */
  start(delay = 0) {
    if (this.running) return;
    this.running = true;
    const t = this.ctx.currentTime + delay;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(1, t + 3);
    this.nextArp = t;
    this.arpStep = 0;
    this.flute = false;
    this.timer = window.setInterval(this.tick, 60);
    this.tick();
  }

  /** Bring in the flute melody (lanterns rising). */
  rise() {
    if (!this.running || this.flute) return;
    this.flute = true;
    // align to the next bar
    const bar = EIGHTH * 8;
    const now = this.ctx.currentTime;
    const barStart = this.nextArp - (this.arpStep % 8) * EIGHTH;
    const k = Math.ceil((now + 0.2 - barStart) / bar);
    this.nextFlute = barStart + Math.max(1, k) * bar;
    this.fluteStep = 0;
    this.shimmer(this.nextFlute - 0.4);
  }

  stop(fade = 1.2) {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, fade / 3);
  }

  // ----------------------------------------------------------- scheduler

  private tick = () => {
    const horizon = this.ctx.currentTime + 0.25;
    while (this.nextArp < horizon) {
      const bar = Math.floor(this.arpStep / 8) % ARP.length;
      const i = this.arpStep % 8;
      const note = ARP[bar][i];
      const accent = i === 0 ? 1 : i % 2 === 0 ? 0.8 : 0.62;
      // once the flute plays, the santoor steps back
      const level = (this.flute ? 0.034 : 0.05) * accent;
      this.santoor(hz(note), this.nextArp, level);
      if (i === 0) this.santoor(SA * ratio(BASS[bar]), this.nextArp, this.flute ? 0.05 : 0.06, 3.2);
      // occasional tremolo double-strike, a santoor signature
      if (i === 7 && Math.random() < 0.35) this.santoor(hz(note), this.nextArp + EIGHTH * 0.5, level * 0.6);
      this.nextArp += EIGHTH;
      this.arpStep++;
    }
    while (this.flute && this.nextFlute < horizon) {
      const phrase = FLUTE[Math.floor(this.fluteStep / 100) % FLUTE.length];
      const idx = this.fluteStep % 100;
      if (idx >= phrase.length) {
        // breathe between phrases, sometimes a shimmer
        if (Math.random() < 0.4) this.shimmer(this.nextFlute + BEAT * 0.5);
        this.fluteStep = (Math.floor(this.fluteStep / 100) + 1) * 100;
        this.nextFlute += BEAT * 2;
        continue;
      }
      const [n, beats] = phrase[idx];
      const dur = beats * BEAT;
      if (n !== "-") {
        const prev = idx > 0 ? phrase[idx - 1][0] : "-";
        this.bansuri(hz(n), this.nextFlute, dur, prev !== "-" ? hz(prev) : 0);
      }
      this.nextFlute += dur;
      this.fluteStep++;
    }
  };

  // ------------------------------------------------------------- voices

  private send(node: AudioNode, dry = 1) {
    const g = this.ctx.createGain();
    g.gain.value = dry;
    node.connect(g).connect(this.out);
    node.connect(this.echoIn);
  }

  /** Hammered string: bright attack, quick shimmer, long soft tail. */
  private santoor(f: number, t: number, level: number, decay = 1.8) {
    const { ctx } = this;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.004);
    env.gain.exponentialRampToValueAtTime(level * 0.35, t + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    tone.frequency.exponentialRampToValueAtTime(Math.min(4000, f * 3), t + 0.4);
    tone.connect(env);
    for (const [mult, det, type, amp] of [
      [1, 0, "triangle", 1],
      [1, 7, "sine", 0.6], // paired strings, slightly detuned
      [2, -4, "sine", 0.25],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      o.detune.value = det;
      const a = ctx.createGain();
      a.gain.value = amp;
      o.connect(a).connect(tone);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    this.send(env);
  }

  /** Breathy flute with vibrato that blooms, and a small slide into the note. */
  private bansuri(f: number, t: number, dur: number, from: number) {
    const { ctx } = this;
    const level = 0.065;
    const end = t + dur;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + Math.min(0.22, dur * 0.3));
    env.gain.setValueAtTime(level, Math.max(t + 0.23, end - 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);

    const o = ctx.createOscillator();
    o.type = "sine";
    const start = from ? f * Math.pow(from / f, 0.35) : f * 0.985; // meend
    o.frequency.setValueAtTime(start, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.07;

    // vibrato grows over the note
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(dur, 1.2));
    lfo.connect(depth).connect(o.frequency);

    // breath
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f * 2;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.value = 0.18;

    o.connect(env);
    o2.connect(g2).connect(env);
    n.connect(bp).connect(ng).connect(env);
    this.send(env, 0.9);

    for (const s of [o, o2, lfo, n]) {
      s.start(t);
      s.stop(end + 0.3);
    }
  }

  /** Ghungroo-like shimmer: a few tiny high bells. */
  private shimmer(t: number) {
    const { ctx } = this;
    const notes = ["S'", "G'", "P'", "R'"];
    for (let i = 0; i < 5; i++) {
      const tt = t + i * 0.07 + Math.random() * 0.03;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = hz(notes[i % notes.length]) * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.012, tt + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.9);
      o.connect(g);
      this.send(g, 0.8);
      o.start(tt);
      o.stop(tt + 0.95);
    }
  }
}
