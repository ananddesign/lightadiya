import { createSprites, DIYA_FLAME, LOTUS_FLAME, type Sprites } from "./sprites";

/**
 * One canvas, one requestAnimationFrame loop.
 *
 * World model (cheap pinhole projection, camera 1 unit above the lake):
 *   X  sideways, Z distance from camera (>0), Y height above water.
 *   screenX = cx + X * A / Z
 *   screenY = horizon + A * (1 - Y) / Z
 * where A = distance (px) from horizon to the bottom of the screen.
 */

export type Cue = "message" | "cta";

export interface EngineOptions {
  reducedMotion?: boolean;
  onCue?: (cue: Cue) => void;
  onIgnite?: (nearness: number) => void;
  onRise?: () => void;
}

// ---- timeline (seconds after the tap) ----
const T_SPREAD0 = 1.1;
const T_SPREAD1 = 6.4;
const T_RISE0 = 5.2;
const T_RISE1 = 12;
const T_MESSAGE = 11.8;
const T_CTA = 14.6;

// ---- hero diya (DOM SVG, positioned by the engine) ----
export const HERO_VB = { w: 120, h: 110 };
export const HERO_ANCHOR = { x: 60, y: 88 }; // water line in SVG units
export const HERO_FLAME = { x: 60, y: 34 }; // flame centre in SVG units
const HERO_Z = 1.9;
const HERO_SIZE = 0.62; // world units

type Tier = "low" | "mid" | "high";
const COUNTS: Record<Tier, { diyas: number; lanterns: number; stars: number }> = {
  low: { diyas: 90, lanterns: 130, stars: 90 },
  mid: { diyas: 160, lanterns: 230, stars: 140 },
  high: { diyas: 240, lanterns: 340, stars: 180 },
};

interface Floater {
  X: number;
  Z: number;
  ignite: number;
  lotus: boolean;
  ph: number;
  rank: number;
  sounded: boolean;
}
interface Lantern {
  X: number;
  Z: number;
  Y: number;
  vy: number;
  launch: number;
  sway: number;
  swayF: number;
  ph: number;
  size: number;
  rank: number;
}
interface Star {
  x: number; // 0..1 of width
  h: number; // px above horizon
  r: number;
  ph: number;
  sp: number;
}
interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  r: number;
}
interface Ring {
  start: number;
  X: number;
  Z: number;
  speed: number;
  life: number;
  strength: number;
}
interface Streak {
  X: number;
  Z: number;
  len: number;
  ph: number;
}
interface Village {
  X: number;
  Z: number;
  ph: number;
  r: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const logRand = (a: number, b: number) => a * Math.pow(b / a, Math.random());

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 4 || mem <= 2) return "low";
  if (cores <= 6 || mem <= 4) return "mid";
  return "high";
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hero: HTMLElement;
  private opts: EngineOptions;
  private sprites: Sprites;
  private backdrop: HTMLCanvasElement | null = null;

  private W = 0;
  private H = 0;
  private dpr = 1;
  private A = 0;
  private baseHorizon = 0;
  private bdHorizon = 0; // horizon y inside the backdrop canvas
  private panUp = 0;
  private panDown = 0;

  private raf = 0;
  private last = 0;
  private running = false;
  private time = 0; // scene clock (pauses with tab)
  private tl = -1; // time since the diya was lit, -1 = not yet
  private cues = new Set<Cue>();
  private rose = false;

  private tier: Tier;
  private budget = 1; // adaptive fraction of particles drawn
  private ema = 16;
  private sinceCheck = 0;

  private floaters: Floater[] = [];
  private lanterns: Lantern[] = [];
  private stars: Star[] = [];
  private embers: Ember[] = [];
  private rings: Ring[] = [];
  private streaks: Streak[] = [];
  private village: Village[] = [];
  private emberTimer = 0;

  constructor(canvas: HTMLCanvasElement, hero: HTMLElement, opts: EngineOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.hero = hero;
    this.opts = opts;
    this.sprites = createSprites();
    this.tier = detectTier();
    if (opts.reducedMotion && this.tier === "high") this.tier = "mid";

    this.resize();
    this.buildScene();

    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.start();
  }

  // ------------------------------------------------------------------ public

  light() {
    if (this.tl >= 0) return;
    this.tl = 0;
    const f = this.heroFlame();
    for (let i = 0; i < 46; i++) this.spawnEmber(f.x, f.y, true);
    for (let i = 0; i < 3; i++)
      this.rings.push({ start: 0.05 + i * 0.45, X: 0, Z: HERO_Z, speed: 1.4, life: 2.6, strength: 1 - i * 0.25 });
  }

  replay() {
    this.tl = -1;
    this.cues.clear();
    this.rose = false;
    this.embers.length = 0;
    this.rings.length = 0;
    this.buildScene();
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  // --------------------------------------------------------------- lifecycle

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private resize = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const widthChanged = Math.abs(W - this.W) > 40;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + "px";
    this.canvas.style.height = H + "px";

    const landscape = W > H;
    this.baseHorizon = H * (landscape ? 0.6 : 0.56);
    this.A = H - this.baseHorizon;
    this.panUp = this.opts.reducedMotion ? 0 : H * 0.24;
    this.panDown = this.opts.reducedMotion ? 0 : -H * 0.05;

    const heroW = HERO_SIZE * (this.A / HERO_Z);
    this.hero.style.width = heroW + "px";

    this.buildBackdrop();
    // Re-scatter the lake only before the moment starts (e.g. rotation).
    if (widthChanged && this.tl < 0 && this.floaters.length) this.buildScene();
    if (!this.running) this.draw(0);
  };

  private frame = (now: number) => {
    if (!this.running) return;
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(rawDt, 0.05);
    this.adapt(rawDt);
    this.time += dt;
    if (this.tl >= 0) this.tl += dt;
    this.update(dt);
    this.draw(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Lower the share of drawn particles if frames get slow. */
  private adapt(rawDt: number) {
    if (rawDt > 0.25) return; // tab switch / hiccup
    this.ema += (rawDt * 1000 - this.ema) * 0.05;
    this.sinceCheck += rawDt;
    if (this.sinceCheck < 1) return;
    this.sinceCheck = 0;
    if (this.ema > 24 && this.budget > 0.35) this.budget -= 0.15;
    else if (this.ema < 15 && this.budget < 1) this.budget = Math.min(1, this.budget + 0.05);
  }

  // ------------------------------------------------------------ scene setup

  private xLimit(Z: number) {
    return ((this.W / 2) * 1.08 * Z) / this.A;
  }

  private buildScene() {
    const c = COUNTS[this.tier];
    const aspect = clamp(this.W / this.H / 0.55, 1, 1.8);

    // Floating diyas & lotus lights
    const n = Math.round(c.diyas * aspect);
    const floaters: Floater[] = [];
    let maxD = 0;
    for (let i = 0; i < n; i++) {
      const Z = logRand(1.35, 42);
      const X = rand(-1, 1) * this.xLimit(Z);
      const dx = X;
      const dz = Z - HERO_Z;
      if (Z < 3.2 && Math.abs(dx) < 0.75 && Math.abs(dz) < 1) continue; // keep hero clear
      const d = Math.sqrt(dx * dx + dz * dz * 0.35);
      maxD = Math.max(maxD, d);
      floaters.push({ X, Z, ignite: d, lotus: Math.random() < 0.28, ph: rand(0, 6.28), rank: Math.random(), sounded: false });
    }
    for (const f of floaters) {
      const u = f.ignite / maxD;
      f.ignite = T_SPREAD0 + (T_SPREAD1 - T_SPREAD0) * Math.pow(u, 0.75) + rand(-0.12, 0.12);
    }
    floaters.sort((a, b) => b.Z - a.Z);
    this.floaters = floaters;

    // Sky lanterns
    const ln = Math.round(c.lanterns * Math.sqrt(aspect));
    const lanterns: Lantern[] = [];
    for (let i = 0; i < ln; i++) {
      const L = this.newLantern(T_RISE0 + (T_RISE1 - T_RISE0) * Math.pow(Math.random(), 0.85));
      lanterns.push(L);
    }
    lanterns.sort((a, b) => b.Z - a.Z);
    this.lanterns = lanterns;

    // Stars
    this.stars = Array.from({ length: c.stars }, () => ({
      x: Math.random(),
      h: Math.pow(Math.random(), 0.8) * (this.baseHorizon + this.panUp) + 6,
      r: Math.random() < 0.08 ? rand(1.2, 1.8) : rand(0.5, 1.1),
      ph: rand(0, 6.28),
      sp: rand(0.6, 2.2),
    }));

    // Water shimmer
    this.streaks = Array.from({ length: 70 }, () => {
      const Z = logRand(1.2, 50);
      return { X: rand(-1, 1) * this.xLimit(Z), Z, len: rand(0.15, 0.5), ph: rand(0, 6.28) };
    });

    // Far shore village lights (visible before the tap — a sense of scale)
    this.village = Array.from({ length: 22 }, () => {
      const Z = rand(45, 80);
      return { X: rand(-1, 1) * this.xLimit(Z), Z, ph: rand(0, 6.28), r: rand(0.6, 1.3) };
    });
  }

  private newLantern(launch: number, keepZ?: number): Lantern {
    const Z = keepZ ?? logRand(2.3, 55);
    let X = rand(-0.95, 0.95) * this.xLimit(Z);
    // don't launch right in front of the hero diya
    if (Z < 4.5 && Math.abs(X) < 0.9) X = (X < 0 ? -1 : 1) * rand(0.9, Math.max(1, this.xLimit(Z)));
    return {
      X,
      Z,
      Y: 0,
      vy: rand(0.32, 0.62) * Math.pow(Z, 0.78),
      launch,
      sway: rand(0.02, 0.06) * Z,
      swayF: rand(0.25, 0.6),
      ph: rand(0, 6.28),
      size: rand(0.8, 1.2),
      rank: Math.random(),
    };
  }

  private buildBackdrop() {
    const { W, H, dpr } = this;
    const hb = this.baseHorizon + this.panUp; // room above for the camera tilt
    const below = H - (this.baseHorizon + this.panDown) + 4;
    const bh = hb + below;
    this.bdHorizon = hb;
    const c = this.backdrop ?? document.createElement("canvas");
    c.width = Math.round(W * dpr);
    c.height = Math.round(bh * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // sky
    const sky = g.createLinearGradient(0, 0, 0, hb);
    sky.addColorStop(0, "#020814");
    sky.addColorStop(0.45, "#05112a");
    sky.addColorStop(0.8, "#07152e");
    sky.addColorStop(1, "#122c57");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, hb);

    // faint high haze, adds depth to the navy
    const nb = g.createRadialGradient(W * 0.7, hb * 0.35, 0, W * 0.7, hb * 0.35, Math.max(W, H) * 0.6);
    nb.addColorStop(0, "rgba(60,90,160,0.10)");
    nb.addColorStop(1, "rgba(60,90,160,0)");
    g.fillStyle = nb;
    g.fillRect(0, 0, W, hb);

    // water
    const water = g.createLinearGradient(0, hb, 0, bh);
    water.addColorStop(0, "#0e2850");
    water.addColorStop(0.18, "#0a1f42");
    water.addColorStop(0.6, "#06152f");
    water.addColorStop(1, "#030b1c");
    g.fillStyle = water;
    g.fillRect(0, hb, W, below);

    // mountains + their mirrored reflection
    const rnd = mulberry(7);
    const layers = [
      { amp: 0.085, base: 0.018, col: "#0c1f40", refl: "rgba(14,36,72,0.55)", seeds: [rnd(), rnd(), rnd()] },
      { amp: 0.05, base: 0.006, col: "#081731", refl: "rgba(8,23,49,0.7)", seeds: [rnd(), rnd(), rnd()] },
    ];
    const scale = Math.min(H, W * 1.6);
    for (const L of layers) {
      const ridge: number[] = [];
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const x = i / steps;
        const v =
          0.55 * Math.sin(x * 5.1 + L.seeds[0] * 6) +
          0.3 * Math.sin(x * 11.7 + L.seeds[1] * 6) +
          0.15 * Math.sin(x * 27.3 + L.seeds[2] * 6);
        ridge.push(scale * (L.base + L.amp * (0.5 + 0.5 * v) * (0.55 + 0.45 * Math.sin(x * 2.3 + L.seeds[0] * 3))));
      }
      for (const dir of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, hb);
        ridge.forEach((h, i) => g.lineTo((i / steps) * W, hb + dir * h * (dir > 0 ? 0.8 : 1)));
        g.lineTo(W, hb);
        g.closePath();
        g.fillStyle = dir < 0 ? L.col : L.refl;
        g.fill();
      }
    }
    // soft horizon line
    const hl = g.createLinearGradient(0, hb - 2, 0, hb + 3);
    hl.addColorStop(0, "rgba(120,150,210,0)");
    hl.addColorStop(0.5, "rgba(120,150,210,0.18)");
    hl.addColorStop(1, "rgba(120,150,210,0)");
    g.fillStyle = hl;
    g.fillRect(0, hb - 2, W, 5);

    this.backdrop = c;
  }

  // ----------------------------------------------------------------- update

  private pan() {
    if (this.tl < 0) return 0;
    const up = smooth(T_RISE0 + 0.4, T_RISE0 + 5.4, this.tl);
    const down = smooth(T_RISE1 - 0.6, T_CTA + 0.8, this.tl);
    return up * this.panUp * (1 - down) + down * this.panDown;
  }

  private horizon() {
    return this.baseHorizon + this.pan();
  }

  private heroPos() {
    const s = this.A / HERO_Z;
    const bob = Math.sin(this.time * 1.3) * 0.012;
    return { x: this.W / 2, y: this.horizon() + this.A * (1 + bob) / HERO_Z, s };
  }

  private heroFlame() {
    const p = this.heroPos();
    const k = (HERO_SIZE * p.s) / HERO_VB.w;
    return { x: p.x + (HERO_FLAME.x - HERO_ANCHOR.x) * k, y: p.y + (HERO_FLAME.y - HERO_ANCHOR.y) * k, k };
  }

  private spawnEmber(x: number, y: number, burst: boolean) {
    if (this.embers.length > 140) return;
    const a = burst ? rand(-Math.PI, 0) : rand(-2, -1.1);
    const sp = burst ? rand(40, 190) : rand(15, 40);
    this.embers.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - (burst ? 40 : 10),
      life: burst ? rand(0.9, 2.1) : rand(1.4, 2.4),
      age: 0,
      r: burst ? rand(0.8, 2.2) : rand(0.6, 1.3),
    });
  }

  private update(dt: number) {
    const tl = this.tl;

    // cues for the UI
    if (tl >= T_MESSAGE && !this.cues.has("message")) {
      this.cues.add("message");
      this.opts.onCue?.("message");
    }
    if (tl >= T_CTA && !this.cues.has("cta")) {
      this.cues.add("cta");
      this.opts.onCue?.("cta");
    }
    if (tl >= T_RISE0 && !this.rose) {
      this.rose = true;
      this.opts.onRise?.();
    }

    // ignition sounds for diyas near the camera
    if (tl >= 0) {
      for (const f of this.floaters) {
        if (!f.sounded && tl >= f.ignite) {
          f.sounded = true;
          if (f.Z < 9) this.opts.onIgnite?.(1 - f.Z / 9);
          if (f.Z < 4 && f.rank < 0.5)
            this.rings.push({ start: tl, X: f.X, Z: f.Z, speed: 0.6, life: 1.6, strength: 0.4 });
        }
      }
    }

    // lanterns
    if (tl >= 0) {
      const top = -this.H * 0.1;
      for (const L of this.lanterns) {
        const age = tl - L.launch;
        if (age <= 0) continue;
        L.Y += L.vy * Math.min(1, age * 0.8) * dt;
        const sy = this.horizon() + (this.A * (1 - L.Y)) / L.Z;
        if (sy < top && tl > T_RISE1 - 1) {
          // recycle: keep the sky alive forever after the reveal
          // same Z keeps the far→near draw order valid
          Object.assign(L, this.newLantern(tl + rand(0, 2.5), L.Z));
        }
      }
    }

    // embers
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.age += dt;
      if (e.age >= e.life) {
        this.embers.splice(i, 1);
        continue;
      }
      e.vy -= 18 * dt;
      e.vx *= 1 - 1.2 * dt;
      e.x += e.vx * dt + Math.sin(this.time * 3 + e.life * 9) * 6 * dt;
      e.y += e.vy * dt;
    }
    if (tl > 0) {
      this.emberTimer -= dt;
      if (this.emberTimer <= 0) {
        this.emberTimer = rand(0.18, 0.4);
        const f = this.heroFlame();
        this.spawnEmber(f.x + rand(-3, 3), f.y - 10, false);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      if (tl - this.rings[i].start > this.rings[i].life) this.rings.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------- draw

  private draw(_dt: number) {
    const { ctx, W, H, A, sprites: S, time, tl, budget } = this;
    const hz = this.horizon();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (this.backdrop) ctx.drawImage(this.backdrop, 0, hz - this.bdHorizon, W, this.backdrop.height / this.dpr);
    const cx = W / 2;
    const warmth = tl < 0 ? 0 : smooth(0.6, T_SPREAD1, tl);

    // stars
    ctx.fillStyle = "#dfe8ff";
    const starDim = 1 - warmth * 0.45;
    for (const s of this.stars) {
      const y = hz - s.h;
      if (y < -2 || y > hz - 3) continue;
      ctx.globalAlpha = starDim * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.sp + s.ph))) * (s.r > 1.1 ? 1 : 0.7);
      ctx.fillRect(s.x * W, y, s.r, s.r);
    }

    ctx.globalCompositeOperation = "lighter";

    // warm horizon haze grows as the lake fills
    if (warmth > 0) {
      ctx.globalAlpha = warmth * 0.55;
      ctx.drawImage(S.haze, cx - W * 0.9, hz - H * 0.16, W * 1.8, H * 0.3);
      ctx.globalAlpha = warmth * 0.25;
      ctx.drawImage(S.haze, cx - W * 0.7, hz - H * 0.05, W * 1.4, A * 0.9);
    }

    // far shore village lights
    for (const v of this.village) {
      const s = A / v.Z;
      const x = cx + v.X * s;
      const y = hz - 0.04 * s;
      ctx.globalAlpha = (0.35 + 0.25 * Math.sin(time * 1.7 + v.ph)) * (1 - warmth * 0.5);
      const r = 5 * v.r;
      ctx.drawImage(S.glow, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha *= 0.5;
      ctx.drawImage(S.glow, x - r * 0.4, y + 1, r * 0.8, r * 2.4);
    }

    // water shimmer
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1;
    const sr = Math.round(140 + 115 * warmth);
    const sg = Math.round(170 + 30 * warmth);
    const sb = Math.round(220 - 120 * warmth);
    ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
    ctx.beginPath();
    for (const st of this.streaks) {
      const s = A / st.Z;
      const x = cx + (st.X + Math.sin(time * 0.2 + st.ph) * 0.1) * s;
      const y = hz + s + Math.sin(time * 0.9 + st.ph) * 0.5;
      const l = st.len * s * (0.6 + 0.4 * Math.sin(time * 0.7 + st.ph));
      ctx.moveTo(x - l / 2, y);
      ctx.lineTo(x + l / 2, y);
    }
    ctx.globalAlpha = 0.08 + warmth * 0.1;
    ctx.stroke();

    // ripple rings
    if (this.rings.length) {
      for (const r of this.rings) {
        const age = tl - r.start;
        if (age < 0) continue;
        const s = A / r.Z;
        const rad = age * r.speed * s * 0.5;
        const x = cx + r.X * s;
        const y = hz + s * (1 + 0.04);
        ctx.globalAlpha = r.strength * 0.45 * (1 - age / r.life) * smooth(0, 0.15, age);
        ctx.strokeStyle = "#ffcf7a";
        ctx.lineWidth = Math.max(0.6, 1.4 * (1 - age / r.life));
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = "lighter";

    // lantern reflections (on water, beneath everything floating)
    if (tl >= T_RISE0 - 0.5) {
      for (const L of this.lanterns) {
        if (L.rank > budget || tl < L.launch || L.Y > 5) continue;
        const s = A / L.Z;
        const ry = hz + (A * (1 + L.Y)) / L.Z;
        if (ry > H + 20) continue;
        const x = cx + (L.X + Math.sin(time * L.swayF + L.ph) * L.sway) * s;
        const w = 0.2 * s * L.size;
        const a = 0.28 * Math.exp(-L.Y * 0.45) * smooth(0, 0.8, tl - L.launch);
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        const wob = Math.sin(time * 2.1 + L.ph + ry * 0.05) * w * 0.25;
        ctx.drawImage(S.glow, x - w + wob, ry - w * 0.6, w * 2, w * 3.2);
      }
    }

    // floating diyas & lotus lights (sorted far → near)
    this.drawFloaters(hz, warmth);

    // hero glow + reflection (body is the DOM SVG above the canvas)
    this.drawHero(hz);

    // lanterns in the sky (sorted far → near)
    if (tl >= T_RISE0 - 0.5) {
      for (const L of this.lanterns) {
        if (L.rank > budget || tl < L.launch) continue;
        const s = A / L.Z;
        const x = cx + (L.X + Math.sin(time * L.swayF + L.ph) * L.sway) * s;
        const y = hz + (A * (1 - L.Y)) / L.Z;
        if (y < -60 || y > H + 60) continue;
        const w = 0.2 * s * L.size;
        const fade = smooth(0, 0.8, tl - L.launch);
        const flick = 0.85 + 0.15 * Math.sin(time * 7 + L.ph * 3);
        const r = w * 2.4;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.45 * flick;
        ctx.drawImage(S.glow, x - r, y - r * 0.9, r * 2, r * 2);
        if (w > 2.6) {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = fade;
          const h = w * 1.4;
          ctx.drawImage(S.lantern, x - w / 2, y - h * 0.7, w, h);
        } else {
          ctx.globalAlpha = fade * flick;
          const d = Math.max(1, w * 0.9);
          ctx.drawImage(S.glow, x - d, y - d, d * 2, d * 2);
        }
      }
    }

    // embers
    ctx.globalCompositeOperation = "lighter";
    for (const e of this.embers) {
      const k = 1 - e.age / e.life;
      ctx.globalAlpha = k * k;
      const r = e.r * 4;
      ctx.drawImage(S.glow, e.x - r, e.y - r, r * 2, r * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawFloaters(hz: number, warmth: number) {
    const { ctx, A, W, H, sprites: S, time, tl, budget } = this;
    if (tl < 0) return;
    const cx = W / 2;
    for (const f of this.floaters) {
      if (f.rank > budget) continue;
      const lit = tl - f.ignite;
      if (lit < 0) continue;
      const s = A / f.Z;
      const drift = Math.sin(time * 0.15 + f.ph) * 0.06;
      const x = cx + (f.X + drift) * s;
      const y = hz + s * (1 + Math.sin(time * 1.1 + f.ph) * 0.01);
      if (y > H + 40) continue;
      const fade = smooth(0, 0.5, lit);
      const flash = 1 + 1.6 * Math.exp(-lit * 3.5);
      const flick = 0.82 + 0.1 * Math.sin(time * 9 + f.ph * 5) + 0.08 * Math.sin(time * 23 + f.ph);
      const bw = (f.lotus ? 0.4 : 0.36) * s;
      const anchor = f.lotus ? LOTUS_FLAME : DIYA_FLAME;
      const sprite = f.lotus ? S.lotus : S.diya;
      const bh = (bw * sprite.height) / sprite.width;
      const bx = x - bw / 2;
      const by = y - bh * 0.78;
      const fx = bx + bw * anchor.x;
      const fy = by + bh * anchor.y;

      // reflection: stretched glow under the light
      ctx.globalCompositeOperation = "lighter";
      const rw = bw * 0.55;
      const wob = Math.sin(time * 1.8 + f.ph + y * 0.04) * rw * 0.18;
      ctx.globalAlpha = fade * 0.32 * flick;
      ctx.drawImage(S.glow, fx - rw / 2 + wob, y - bh * 0.1, rw, rw * 3.4);

      // halo
      const gr = bw * 1.2 * flash;
      ctx.globalAlpha = fade * (f.Z > 12 ? 0.3 : 0.42) * flick;
      ctx.drawImage(S.glow, fx - gr, fy - gr * 1.1, gr * 2, gr * 2);

      if (bw > 4) {
        // body
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = fade * (0.55 + 0.45 * warmth);
        ctx.drawImage(sprite, bx, by, bw, bh);
        // flame
        ctx.globalCompositeOperation = "lighter";
        const fh = bw * 0.36 * flick * Math.min(1, flash);
        const fw = fh * 0.5;
        ctx.globalAlpha = fade;
        ctx.drawImage(S.flame, fx - fw / 2, fy - fh * 0.92, fw, fh);
      } else {
        ctx.globalAlpha = fade * flick;
        const d = Math.max(0.8, bw * 0.35);
        ctx.drawImage(S.glow, fx - d * 2, fy - d * 2, d * 4, d * 4);
      }
    }
  }

  private drawHero(hz: number) {
    const { ctx, sprites: S, time, tl } = this;
    const p = this.heroPos();
    const k = (HERO_SIZE * p.s) / HERO_VB.w;
    const left = p.x - HERO_ANCHOR.x * k;
    const top = p.y - HERO_ANCHOR.y * k;
    this.hero.style.transform = `translate3d(${left.toFixed(1)}px,${top.toFixed(1)}px,0)`;
    void hz;

    if (tl < 0) return;
    const f = this.heroFlame();
    const on = smooth(0, 0.9, tl);
    const flash = 1 + 2.2 * Math.exp(-tl * 2.2);
    const flick = 0.85 + 0.1 * Math.sin(time * 8.3) + 0.05 * Math.sin(time * 21);
    const w = HERO_SIZE * p.s;

    ctx.globalCompositeOperation = "lighter";
    // big soft halo
    let r = w * 1.9 * flash;
    ctx.globalAlpha = on * 0.6 * flick;
    ctx.drawImage(S.glow, f.x - r, f.y - r, r * 2, r * 2);
    // tight bright core
    r = w * 0.55;
    ctx.globalAlpha = on * 0.8 * flick;
    ctx.drawImage(S.glow, f.x - r, f.y - r * 1.15, r * 2, r * 2);
    // reflection column on the water
    const rw = w * 0.5;
    for (let i = 0; i < 3; i++) {
      const yy = p.y + w * 0.06 + i * rw * 0.9;
      const wob = Math.sin(time * 1.9 + i * 1.7) * rw * 0.2;
      ctx.globalAlpha = on * (0.42 - i * 0.12) * flick;
      ctx.drawImage(S.glow, f.x - rw / 2 + wob, yy, rw, rw * 1.6);
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
