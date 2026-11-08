import { forwardRef } from "react";

interface Props {
  lit: boolean;
  onLight: () => void;
}

/**
 * The diya you light. Positioned every frame by the canvas engine so it
 * bobs on the same water as everything else. Geometry must match
 * HERO_VB / HERO_ANCHOR / HERO_FLAME in lib/engine/engine.ts.
 */
const HeroDiya = forwardRef<HTMLButtonElement, Props>(function HeroDiya({ lit, onLight }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onLight}
      disabled={lit}
      aria-label={lit ? "Your diya is lit" : "Tap to light the diya"}
      className={`hero-diya absolute left-0 top-0 z-10 cursor-pointer select-none outline-none ${lit ? "is-lit" : ""}`}
      style={{ touchAction: "manipulation", willChange: "transform" }}
    >
      <svg viewBox="0 0 120 110" className="block h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="hd-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd77a" />
            <stop offset="0.35" stopColor="#e39a2c" />
            <stop offset="0.75" stopColor="#9a4b0e" />
            <stop offset="1" stopColor="#4a2006" />
          </linearGradient>
          <radialGradient id="hd-flame" cx="0.5" cy="0.82" r="0.75">
            <stop offset="0" stopColor="#fffef4" />
            <stop offset="0.25" stopColor="#ffe9a3" />
            <stop offset="0.6" stopColor="#ffb23e" />
            <stop offset="1" stopColor="#ff6e14" stopOpacity="0.15" />
          </radialGradient>
        </defs>

        {/* pulse hint before lighting */}
        <circle className="hd-hint" cx="60" cy="42" r="16" fill="none" stroke="#ffd59a" strokeWidth="1.2" />
        <circle className="hd-hint hd-hint-2" cx="60" cy="42" r="16" fill="none" stroke="#ffd59a" strokeWidth="1" />

        {/* rim + oil */}
        <ellipse cx="60" cy="52" rx="52" ry="7.5" fill="#8a4210" />
        <ellipse cx="60" cy="52.6" rx="46" ry="5.2" fill="#2b1203" />
        <ellipse cx="54" cy="51.4" rx="26" ry="1.4" fill="#ffc874" opacity="0.45" />

        {/* wick + ember */}
        <path d="M60 52 Q59 46 60 41" stroke="#2a1204" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle className="hd-ember" cx="60" cy="41" r="1.6" fill="#ff7a2a" />

        {/* flame */}
        <g className="hd-flame-on">
          <g className="hd-flicker">
            <path d="M60 2 C66 16 75 28 72.5 37 C70 47 50 47 47.5 37 C45 28 54 16 60 2Z" fill="url(#hd-flame)" />
            <ellipse cx="60" cy="37.5" rx="4.2" ry="7" fill="#fffdf0" />
          </g>
        </g>

        {/* bowl */}
        <path d="M8 52 Q13 92 60 92 Q107 92 112 52 Q60 67 8 52Z" fill="url(#hd-body)" />
        <path d="M14 60 Q60 74 106 60" stroke="#ffe3a0" strokeOpacity="0.35" strokeWidth="1" fill="none" />
        {[22, 34, 47, 60, 73, 86, 98].map((x, i) => (
          <circle key={x} cx={x} cy={70 + Math.sin((i / 6) * Math.PI) * 6} r="1.8" fill="#ffecaa" opacity="0.8" />
        ))}
        <path d="M30 84 Q60 94 90 84" stroke="#2b1203" strokeOpacity="0.4" strokeWidth="2" fill="none" />
      </svg>
    </button>
  );
});

export default HeroDiya;
