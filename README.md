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

## Analytics (Mixpanel)

The project token is built into `lib/analytics.ts`; you can override it with `NEXT_PUBLIC_MIXPANEL_TOKEN`. Nothing is tracked on localhost unless `NEXT_PUBLIC_MIXPANEL_TRACK_LOCAL=1` is set. Events are sent straight to Mixpanel's HTTP API from `lib/analytics.ts`, with no SDK.

| Event | Key properties |
| --- | --- |
| `Page View` | `arrived_via_share`, `chain_position`, `referrer_id`, `in_app_browser`, `has_sender_name` |
| `Diya Lit` | `seconds_to_tap` |
| `Finale Reached` | |
| `Share` | `method` (whatsapp / native / copy_link), `has_name`, `first_share` |
| `Replay` | |

Every share link carries `r` (the sharer's short visitor id) and `c` (chain position). Some useful reports:
- **Funnel:** Page View → Diya Lit → Finale Reached → Share
- **Spread:** unique users with `Page View` where `arrived_via_share = true`, broken down by day
- **K-factor:** unique `Page View` users with a `referrer_id` ÷ unique users who did `Share`
- **Chain depth:** max / distribution of `chain_position`

Typed names are never sent to Mixpanel.

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
