import { ImageResponse } from "next/og";

export const alt = "Light a Diya, Spread the Light — a Diwali experience";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export default function OG() {
  const r = rng(11);
  const lanterns = Array.from({ length: 70 }, () => {
    const d = r();
    const s = 4 + d * d * 22;
    return { x: r() * 1200, y: 20 + Math.pow(r(), 1.3) * 300, s, o: 0.45 + d * 0.55 };
  });
  const lights = Array.from({ length: 46 }, () => {
    const d = r();
    return { x: r() * 1200, y: 392 + d * d * 210, s: 3 + d * 16 };
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(180deg,#020814 0%,#07152e 52%,#122c57 62%,#0a1f42 66%,#030b1c 100%)",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 280,
            width: 1200,
            height: 260,
            display: "flex",
            background: "radial-gradient(ellipse at center, rgba(255,150,60,0.32) 0%, rgba(255,120,40,0) 65%)",
          }}
        />
        {lanterns.map((l, i) => (
          <div
            key={`l${i}`}
            style={{
              position: "absolute",
              left: l.x,
              top: l.y,
              width: l.s * 0.8,
              height: l.s,
              borderRadius: l.s * 0.25,
              background: "radial-gradient(circle at 50% 80%, #fff3c8 0%, #ffb347 40%, #e8691a 100%)",
              opacity: l.o,
              boxShadow: `0 0 ${l.s * 1.6}px ${l.s * 0.4}px rgba(255,150,50,0.5)`,
              display: "flex",
            }}
          />
        ))}
        {lights.map((l, i) => (
          <div
            key={`d${i}`}
            style={{
              position: "absolute",
              left: l.x,
              top: l.y,
              width: l.s,
              height: l.s,
              borderRadius: l.s,
              background: "#ffd27a",
              boxShadow: `0 0 ${l.s * 2}px ${l.s * 0.6}px rgba(255,170,60,0.55)`,
              display: "flex",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 60,
          }}
        >
          <div style={{ fontSize: 30, letterSpacing: 10, color: "#f5c26b", display: "flex" }}>DIWALI</div>
          <div style={{ fontSize: 112, color: "#fff1d0", marginTop: 8, display: "flex" }}>Light a Diya</div>
          <div style={{ fontSize: 40, color: "rgba(255,244,224,0.85)", marginTop: 10, fontStyle: "italic", display: "flex" }}>
            One diya can light a thousand more.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
