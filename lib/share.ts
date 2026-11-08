export const MAX_NAME = 24;

/** Letters (any script), spaces, dots, apostrophes and hyphens only. */
export function cleanName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[^\p{L}\p{M}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

export function cleanChain(raw: string | null | undefined): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999999) : 0;
}

export function buildShareUrl(name: string, chain: number): string {
  const u = new URL(window.location.origin + window.location.pathname);
  if (name) u.searchParams.set("from", name);
  u.searchParams.set("c", String(chain));
  return u.toString();
}

export function shareText(name: string): string {
  return name
    ? `🪔 ${name} lit a diya for you this Diwali.\nLight yours and pass the light on ✨`
    : `🪔 I lit a diya for you this Diwali.\nLight yours and pass the light on ✨`;
}

export function whatsappHref(name: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${shareText(name)}\n${url}`)}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
