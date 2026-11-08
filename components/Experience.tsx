"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { SoundScape } from "@/lib/audio";
import { Engine } from "@/lib/engine/engine";
import { buildShareUrl, cleanName, MAX_NAME, ordinal, shareText, whatsappHref } from "@/lib/share";
import HeroDiya from "./HeroDiya";

type Stage = "intro" | "lit" | "message" | "cta";

interface Props {
  from: string;
  chain: number;
}

const ease = [0.22, 1, 0.36, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8, transition: { duration: 0.5 } },
};

const NAME_KEY = "diya:name";

export default function Experience({ from, chain }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const soundRef = useRef<SoundScape | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [muted, setMuted] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const myNumber = chain + 1; // this viewer's place in the chain

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sound = new SoundScape();
    soundRef.current = sound;
    const engine = new Engine(canvas, hero, {
      reducedMotion: reduced,
      onCue: (cue) => setStage(cue),
      onIgnite: (n) => sound.plink(n),
      onRise: () => {
        sound.swell();
        sound.bell(587.3, 0.1);
      },
    });
    engineRef.current = engine;

    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setName(cleanName(saved));
    } catch {}
    setCanShare(typeof navigator.share === "function");

    return () => {
      engine.destroy();
      sound.dispose();
      engineRef.current = null;
      soundRef.current = null;
    };
  }, []);

  const light = useCallback(() => {
    if (stage !== "intro") return;
    const sound = soundRef.current;
    sound?.init();
    sound?.strike();
    sound?.bell(392, 0.2, 0.35);
    sound?.startPad();
    try {
      navigator.vibrate?.(18);
    } catch {}
    engineRef.current?.light();
    setStage("lit");
  }, [stage]);

  const replay = () => {
    soundRef.current?.stopPad();
    engineRef.current?.replay();
    setCopied(false);
    setStage("intro");
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundRef.current?.setMuted(next);
  };

  const onName = (v: string) => {
    const n = v.slice(0, MAX_NAME);
    setName(n);
    try {
      localStorage.setItem(NAME_KEY, cleanName(n));
    } catch {}
  };

  const url = () => buildShareUrl(cleanName(name), myNumber);

  const shareWhatsApp = () => {
    window.open(whatsappHref(cleanName(name), url()), "_blank", "noopener");
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title: "Light a Diya, Spread the Light", text: shareText(cleanName(name)), url: url() });
    } catch {}
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const showFinale = stage === "message" || stage === "cta";

  return (
    <LazyMotion features={domAnimation} strict>
      <main className="fixed inset-0 overflow-hidden bg-night text-cream">
        <canvas ref={canvasRef} className="absolute inset-0 block" aria-hidden="true" />

        <HeroDiya ref={heroRef} lit={stage !== "intro"} onLight={light} />

        {/* soft scrim so the finale text reads over the lanterns */}
        <AnimatePresence>
          {showFinale && (
            <m.div
              key="scrim"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-[15] h-[55vh]"
              style={{ background: "radial-gradient(ellipse 85% 70% at 50% 18%, rgba(4,12,30,0.78) 0%, rgba(4,12,30,0.45) 45%, rgba(4,12,30,0) 75%)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6 }}
            />
          )}
        </AnimatePresence>

        {/* top copy */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-6 pt-[max(9vh,calc(env(safe-area-inset-top)+28px))] text-center">
          <AnimatePresence mode="wait">
            {stage === "intro" && (
              <m.div key="intro" {...fadeUp} transition={{ duration: 1.1, ease, delay: 0.3 }}>
                {from ? (
                  <>
                    <p className="eyebrow">A gift of light from</p>
                    <h1 className="title mt-3 text-[clamp(2.6rem,11vw,4.5rem)]">{from}</h1>
                    <p className="sub mt-4">Now it&rsquo;s your turn to light one.</p>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Diwali · The festival of lights</p>
                    <h1 className="title mt-3 text-[clamp(2.6rem,11vw,4.5rem)]">Light a diya</h1>
                    <p className="sub mt-4">One flame is all it takes.</p>
                  </>
                )}
              </m.div>
            )}

            {showFinale && (
              <m.div key="finale" initial="hidden" animate="show" className="flex flex-col items-center">
                <m.p
                  className="font-deva text-[clamp(1.05rem,4.4vw,1.4rem)] tracking-wide text-gold"
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 1.2, ease }}
                >
                  शुभ दीपावली
                </m.p>
                <m.h2
                  className="title mt-1 text-[clamp(3rem,13vw,5.5rem)]"
                  variants={{ hidden: { opacity: 0, y: 16, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
                  transition={{ duration: 1.6, ease, delay: 0.25 }}
                >
                  Happy Diwali
                </m.h2>
                <m.p
                  className="sub mt-3 italic"
                  variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                  transition={{ duration: 1.4, delay: 1.1 }}
                >
                  One diya can light a thousand more.
                </m.p>
                <m.div
                  className="mt-5 flex flex-col items-center gap-1 text-[0.74rem] tracking-[0.2em] text-cream/70 uppercase"
                  variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                  transition={{ duration: 1.2, delay: 2 }}
                >
                  {from && <span>Passed on by {from}</span>}
                  <span>{chain > 0 ? `You are the ${ordinal(myNumber)} light` : "Yours is the first light"}</span>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* tap hint */}
        <AnimatePresence>
          {stage === "intro" && (
            <m.p
              key="hint"
              className="pointer-events-none absolute inset-x-0 bottom-[max(5vh,calc(env(safe-area-inset-bottom)+18px))] z-20 text-center text-[0.78rem] tracking-[0.24em] text-cream/70 uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 0.85, 0.35] }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
            >
              Tap the diya to light it
            </m.p>
          )}
        </AnimatePresence>

        {/* share panel */}
        <AnimatePresence>
          {stage === "cta" && (
            <m.section
              key="cta"
              className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.9, ease }}
              aria-label="Pass the light"
            >
              <div className="w-full max-w-sm rounded-3xl border border-gold/15 bg-night/75 p-3.5 shadow-[0_-10px_60px_-20px_rgba(255,170,60,0.35)]">
                <label className="sr-only" htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => onName(e.target.value)}
                  maxLength={MAX_NAME}
                  autoComplete="given-name"
                  enterKeyHint="send"
                  onKeyDown={(e) => e.key === "Enter" && shareWhatsApp()}
                  placeholder="Add your name (optional)"
                  className="h-11 w-full rounded-2xl border border-cream/10 bg-white/5 px-4 text-[16px] text-cream placeholder:text-cream/40 focus:border-gold/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={shareWhatsApp}
                  className="cta mt-2.5 flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl text-[1.02rem] font-semibold text-[#2a1203]"
                >
                  <WhatsAppIcon />
                  Pass the light on WhatsApp
                </button>
                <div className="mt-2 flex items-center justify-center gap-1 text-[0.82rem] text-cream/70">
                  {canShare && (
                    <button type="button" onClick={shareNative} className="link">
                      More ways to share
                    </button>
                  )}
                  {canShare && <span className="text-cream/25">·</span>}
                  <button type="button" onClick={copy} className="link" aria-live="polite">
                    {copied ? "Link copied ✓" : "Copy link"}
                  </button>
                  <span className="text-cream/25">·</span>
                  <button type="button" onClick={replay} className="link">
                    Light again
                  </button>
                </div>
              </div>
            </m.section>
          )}
        </AnimatePresence>

        {/* sound toggle */}
        {stage !== "intro" && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
            className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-40 grid h-10 w-10 place-items-center rounded-full text-cream/70 transition-colors hover:text-cream"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              {muted ? (
                <path d="M16 9.5l5 5M21 9.5l-5 5" />
              ) : (
                <>
                  <path d="M15.5 9a4 4 0 0 1 0 6" />
                  <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
                </>
              )}
            </svg>
          </button>
        )}
      </main>
    </LazyMotion>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z" />
    </svg>
  );
}
