/**
 * Cliente mínimo de Apify (API v2, sin SDK — cero dependencias extra).
 * Usa el endpoint run-sync-get-dataset-items: ejecuta el actor y devuelve
 * los items del dataset en una sola llamada (espera hasta ~5 min).
 *
 * Actors utilizados (verificados en apify.com en agosto 2026):
 *  - X/Twitter:  apidojo/tweet-scraper          (Tweet Scraper V2)
 *  - Instagram:  apify/instagram-hashtag-scraper (oficial)
 *  - TikTok:     clockworks/tiktok-scraper       (oficial de Clockworks)
 *  - Facebook:   apify/facebook-search-scraper   (oficial, búsqueda pública)
 *
 * Los límites de resultados son agresivos a propósito para no quemar los
 * $5 USD/mes del plan gratuito.
 */

import type { Post } from "../types";
import {
  normalizeTweet,
  normalizeInstagram,
  normalizeTikTok,
  normalizeFacebook,
} from "./normalize";

const APIFY_BASE = "https://api.apify.com/v2";

// Límites por corrida (por plataforma, no por término).
export const LIMITS = {
  x: 200,
  instagram: 100,
  tiktok: 100,
  facebook: 50,
} as const;

async function runActor(actorId: string, input: unknown, token: string): Promise<any[]> {
  const url = `${APIFY_BASE}/acts/${actorId.replace("/", "~")}/run-sync-get-dataset-items?token=${token}&timeout=300`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    // Las corridas de actors pueden tardar minutos.
    signal: AbortSignal.timeout(310_000),
  });
  if (!res.ok) {
    throw new Error(`Apify ${actorId} → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const asHashtag = (term: string) => term.replace(/^[#@]/, "").trim();

export async function fetchX(keywords: string[], token: string): Promise<Post[]> {
  const items = await runActor(
    "apidojo/tweet-scraper",
    {
      searchTerms: keywords,
      maxItems: LIMITS.x,
      sort: "Latest",
      includeSearchTerms: true,
    },
    token
  );
  return items
    .map((it) => normalizeTweet(it, it.searchTerms ?? keywords))
    .filter((p): p is Post => p !== null);
}

export async function fetchInstagram(keywords: string[], token: string): Promise<Post[]> {
  const hashtags = keywords.filter((k) => !k.startsWith("@")).map(asHashtag);
  if (hashtags.length === 0) return [];
  const items = await runActor(
    "apify/instagram-hashtag-scraper",
    {
      hashtags,
      resultsLimit: Math.floor(LIMITS.instagram / hashtags.length) || 1,
    },
    token
  );
  return items
    .map((it) => normalizeInstagram(it, keywords))
    .filter((p): p is Post => p !== null);
}

export async function fetchTikTok(keywords: string[], token: string): Promise<Post[]> {
  const hashtags = keywords.filter((k) => !k.startsWith("@")).map(asHashtag);
  if (hashtags.length === 0) return [];
  const items = await runActor(
    "clockworks/tiktok-scraper",
    {
      hashtags,
      resultsPerPage: Math.floor(LIMITS.tiktok / hashtags.length) || 1,
    },
    token
  );
  return items
    .map((it) => normalizeTikTok(it, keywords))
    .filter((p): p is Post => p !== null);
}

export async function fetchFacebook(keywords: string[], token: string): Promise<Post[]> {
  const items = await runActor(
    "apify/facebook-search-scraper",
    {
      searchQueries: keywords.map(asHashtag),
      maxPosts: LIMITS.facebook,
      searchType: "posts",
    },
    token
  );
  return items
    .map((it) => normalizeFacebook(it, keywords))
    .filter((p): p is Post => p !== null);
}
