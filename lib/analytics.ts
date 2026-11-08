/**
 * Minimal Mixpanel client (~1 KB) talking to the HTTP ingestion API directly,
 * instead of the ~25 KB mixpanel-browser bundle.
 *
 * Virality model: every visitor gets a random id. Share links carry the
 * sharer's short id as `r`, so in Mixpanel you can count, per sharer, how many
 * new people arrived through their link (the K-factor), and how deep chains go (`c`).
 *
 * Names typed by users are never sent, only whether one was added.
 */

// Project tokens are public by design (they ship in client JS), so a default is fine.
const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "a4624958593767863c60979eb94e0ae8";
// Keep local testing out of the real numbers unless explicitly enabled.
const TRACK_LOCAL = process.env.NEXT_PUBLIC_MIXPANEL_TRACK_LOCAL === "1";
const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(location.hostname);
const ENDPOINT = "https://api-js.mixpanel.com/track/?ip=1";
const ID_KEY = "diya:id";

let distinctId = "";
let superProps: Record<string, unknown> = {};

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
}

/** Short, link-friendly form of the visitor id used in share links. */
export function shortId(): string {
  return distinctId.replace(/-/g, "").slice(0, 10);
}

function platform(ua: string) {
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac OS X" : /Windows/.test(ua) ? "Windows" : "Other";
  const inApp = /WhatsApp/i.test(ua) ? "WhatsApp" : /Instagram/.test(ua) ? "Instagram" : /FBAN|FBAV/.test(ua) ? "Facebook" : /Snapchat/.test(ua) ? "Snapchat" : "none";
  return { os, inApp };
}

export function initAnalytics(params: URLSearchParams) {
  try {
    distinctId = localStorage.getItem(ID_KEY) || "";
    if (!distinctId) {
      distinctId = uuid();
      localStorage.setItem(ID_KEY, distinctId);
    }
  } catch {
    distinctId = distinctId || uuid();
  }
  const ua = navigator.userAgent;
  const { os, inApp } = platform(ua);
  const chain = parseInt(params.get("c") || "0", 10) || 0;
  superProps = {
    $os: os,
    in_app_browser: inApp,
    $screen_width: screen.width,
    $screen_height: screen.height,
    arrived_via_share: params.has("c") || params.has("r"),
    chain_position: chain + 1,
    referrer_id: params.get("r") || undefined,
    utm_source: params.get("utm_source") || undefined,
    utm_medium: params.get("utm_medium") || undefined,
    utm_campaign: params.get("utm_campaign") || undefined,
    lang: navigator.language,
  };
}

export function track(event: string, props: Record<string, unknown> = {}) {
  if (!TOKEN || !distinctId) return;
  if (!TRACK_LOCAL && isLocal()) return;
  const payload = [
    {
      event,
      properties: {
        token: TOKEN,
        distinct_id: distinctId,
        $device_id: distinctId,
        $insert_id: uuid().replace(/-/g, "").slice(0, 32),
        time: Date.now(),
        $current_url: location.href.split("#")[0],
        $referrer: document.referrer || "$direct",
        mp_lib: "diya-lite",
        ...superProps,
        ...props,
      },
    },
  ];
  const body = "data=" + encodeURIComponent(JSON.stringify(payload));
  try {
    const blob = new Blob([body], { type: "application/x-www-form-urlencoded" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  } catch {}
  void fetch(ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).catch(() => {});
}
