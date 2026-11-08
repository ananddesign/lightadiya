import type { Metadata } from "next";
import Experience from "@/components/Experience";
import { cleanChain, cleanName } from "@/lib/share";

type SP = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const from = cleanName(first((await searchParams).from));
  if (!from) return {};
  const title = `${from} lit a diya for you 🪔`;
  const description = "Tap to light yours — and pass the light on this Diwali.";
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <Experience from={cleanName(first(sp.from))} chain={cleanChain(first(sp.c))} />;
}
