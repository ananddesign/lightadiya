/**
 * Pre-rendered sprites. Everything glowy is drawn ONCE into small offscreen
 * canvases and then stamped with drawImage + additive blending each frame —
 * no shadowBlur or filters in the hot loop.
 */

export interface Sprites {
  glow: HTMLCanvasElement; // warm radial glow
  haze: HTMLCanvasElement; // wide, soft, low-intensity glow
  flame: HTMLCanvasElement;
  diya: HTMLCanvasElement;
  lotus: HTMLCanvasElement;
  lantern: HTMLCanvasElement;
}

/** Where the flame sits on each body sprite, as a fraction of its size. */
export const DIYA_FLAME = { x: 0.8, y: 0.2 };
export const LOTUS_FLAME = { x: 0.5, y: 0.34 };

function make(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function radial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const [c, g] = make(size, size);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function drawFlame(): HTMLCanvasElement {
  const [c, g] = make(32, 64);
  const body = new Path2D();
  body.moveTo(16, 1);
  body.bezierCurveTo(23, 20, 30, 36, 28, 48);
  body.bezierCurveTo(26, 60, 6, 60, 4, 48);
  body.bezierCurveTo(2, 36, 9, 20, 16, 1);
  const grad = g.createRadialGradient(16, 48, 1, 16, 40, 34);
  grad.addColorStop(0, "#fffef4");
  grad.addColorStop(0.25, "#ffe9a3");
  grad.addColorStop(0.55, "#ffb23e");
  grad.addColorStop(1, "rgba(255,110,20,0.15)");
  g.fillStyle = grad;
  g.fill(body);
  // bright core
  g.fillStyle = "rgba(255,255,245,0.9)";
  g.beginPath();
  g.ellipse(16, 47, 4.5, 8, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

function drawDiya(): HTMLCanvasElement {
  const W = 96;
  const H = 48;
  const [c, g] = make(W, H);
  // bowl
  const bowl = new Path2D();
  bowl.moveTo(6, 16);
  bowl.quadraticCurveTo(10, 44, 44, 45);
  bowl.quadraticCurveTo(74, 45, 84, 22);
  bowl.lineTo(90, 10);
  bowl.quadraticCurveTo(72, 14, 60, 13);
  bowl.quadraticCurveTo(26, 9, 6, 16);
  bowl.closePath();
  const grad = g.createLinearGradient(0, 8, 0, 46);
  grad.addColorStop(0, "#ffd77a");
  grad.addColorStop(0.35, "#e39a2c");
  grad.addColorStop(0.75, "#9a4b0e");
  grad.addColorStop(1, "#4a2006");
  g.fillStyle = grad;
  g.fill(bowl);
  // oil surface
  g.fillStyle = "#3b1a06";
  g.beginPath();
  g.ellipse(42, 15, 32, 4.2, -0.02, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,200,110,0.55)";
  g.beginPath();
  g.ellipse(44, 14.4, 22, 1.4, -0.02, 0, Math.PI * 2);
  g.fill();
  // decorative dots
  g.fillStyle = "rgba(255,236,170,0.8)";
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = 18 + t * 52;
    const y = 30 + Math.sin(t * Math.PI) * 6;
    g.beginPath();
    g.arc(x, y, 1.5, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function drawLotus(): HTMLCanvasElement {
  const W = 96;
  const H = 56;
  const [c, g] = make(W, H);
  const cx = W / 2;
  const base = 46;
  const petal = (angle: number, len: number, wid: number, light: boolean) => {
    g.save();
    g.translate(cx, base);
    g.rotate(angle);
    const p = new Path2D();
    p.moveTo(0, 0);
    p.quadraticCurveTo(wid, -len * 0.45, 0, -len);
    p.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, light ? "#ffd27a" : "#c4507a");
    grad.addColorStop(0.6, light ? "#ff9bb8" : "#e0709a");
    grad.addColorStop(1, light ? "#ffe3ec" : "#ffb0c8");
    g.fillStyle = grad;
    g.fill(p);
    g.restore();
  };
  // pad
  g.fillStyle = "#0f3a2e";
  g.beginPath();
  g.ellipse(cx, base + 3, 44, 7, 0, 0, Math.PI * 2);
  g.fill();
  // back petals
  for (let i = -3; i <= 3; i++) petal(i * 0.42, 34, 11, false);
  // front petals
  for (let i = -2; i <= 2; i++) petal(i * 0.5, 28, 10, true);
  // small brass cup holding the flame
  g.fillStyle = "#e6a53a";
  g.beginPath();
  g.ellipse(cx, 22, 7, 3, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

function drawLantern(): HTMLCanvasElement {
  const W = 40;
  const H = 56;
  const [c, g] = make(W, H);
  const body = new Path2D();
  body.moveTo(4, 6);
  body.quadraticCurveTo(20, 1, 36, 6);
  body.lineTo(31, 50);
  body.quadraticCurveTo(20, 54, 9, 50);
  body.closePath();
  const grad = g.createRadialGradient(20, 46, 2, 20, 30, 30);
  grad.addColorStop(0, "#fff6d6");
  grad.addColorStop(0.3, "#ffc35c");
  grad.addColorStop(0.7, "#ec6d1a");
  grad.addColorStop(1, "#7a2405");
  g.fillStyle = grad;
  g.fill(body);
  // paper ribs
  g.strokeStyle = "rgba(120,40,8,0.22)";
  g.lineWidth = 1;
  for (const x of [13, 20, 27]) {
    g.beginPath();
    g.moveTo(x + (x - 20) * 0.3, 5);
    g.lineTo(x, 50);
    g.stroke();
  }
  // bright opening
  g.fillStyle = "rgba(255,250,225,0.95)";
  g.beginPath();
  g.ellipse(20, 50, 9, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

export function createSprites(): Sprites {
  return {
    glow: radial(128, [
      [0, "rgba(255,226,160,1)"],
      [0.12, "rgba(255,190,90,0.75)"],
      [0.35, "rgba(255,140,40,0.28)"],
      [0.7, "rgba(255,110,30,0.07)"],
      [1, "rgba(255,100,20,0)"],
    ]),
    haze: radial(128, [
      [0, "rgba(255,160,70,0.5)"],
      [0.5, "rgba(255,120,50,0.16)"],
      [1, "rgba(255,90,40,0)"],
    ]),
    flame: drawFlame(),
    diya: drawDiya(),
    lotus: drawLotus(),
    lantern: drawLantern(),
  };
}
