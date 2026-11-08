# Light a Diya, Spread the Light 🪔

A 15–20 second interactive Diwali moment, built for WhatsApp links. Tap the diya, watch the lake fill with light and lanterns rise, then pass the link on.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Deploy

Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://diya.example.com`) so WhatsApp link previews get absolute Open Graph URLs. On Vercel, `VERCEL_PROJECT_PRODUCTION_URL` is picked up automatically.

## Share links

`/?from=Anand&c=3`: the opening screen says "A gift of light from Anand", the WhatsApp preview title becomes "Anand lit a diya for you 🪔", and the viewer is shown as the 4th light in the chain. Names are limited to letters, spaces, `.`, `'` and `-`, 24 characters max.

## Structure

- `lib/engine/engine.ts`: the single Canvas 2D engine (one rAF loop, perspective lake, diyas, lotus lights, lanterns, embers, ripples, adaptive quality, pauses when the tab is hidden, DPR capped at 1.5)
- `lib/engine/sprites.ts`: glows and shapes pre-rendered once to offscreen canvases (no shadowBlur or filters per frame)
- `lib/audio.ts`: Web Audio synthesis (tanpura-style drone, match strike, temple bell, pentatonic plinks). No audio files.
- `components/HeroDiya.tsx`: the SVG diya with a CSS flame, positioned by the engine each frame
- `components/Experience.tsx`: stage flow, copy, share panel (Framer Motion via `LazyMotion`)
- `app/opengraph-image.tsx`: link-preview image generated at build time

The timeline lives at the top of `engine.ts` (`T_SPREAD0`, `T_RISE0`, `T_MESSAGE`, `T_CTA`, …). Particle counts per device tier are in `COUNTS`.
