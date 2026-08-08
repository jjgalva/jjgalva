/**
 * Orquestación de ingesta: si hay APIFY_TOKEN corre los 4 actors en paralelo;
 * si no hay token, falla la red o RADAR_MOCK=1, cae al modo mock. Los
 * resultados se deduplican por URL (varios términos pueden traer el mismo post,
 * fusionando sus matched_terms).
 */

import type { Post } from "../types";
import { fetchX, fetchInstagram, fetchTikTok, fetchFacebook } from "./apify";
import { loadMockPosts } from "./mock";

export interface IngestResult {
  posts: Post[];
  mode: "mock" | "apify";
  warnings: string[];
}

export async function ingest(keywords: string[], forceMock = false): Promise<IngestResult> {
  const token = process.env.APIFY_TOKEN;
  const mockForced = forceMock || process.env.RADAR_MOCK === "1" || !token;

  if (mockForced) {
    return { posts: dedupeByUrl(loadMockPosts(keywords)), mode: "mock", warnings: [] };
  }

  const warnings: string[] = [];
  const settled = await Promise.allSettled([
    fetchX(keywords, token!),
    fetchInstagram(keywords, token!),
    fetchTikTok(keywords, token!),
    fetchFacebook(keywords, token!),
  ]);

  const posts: Post[] = [];
  const names = ["X", "Instagram", "TikTok", "Facebook"];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") posts.push(...s.value);
    else warnings.push(`${names[i]}: ${String(s.reason).slice(0, 200)}`);
  });

  // Si TODO falló, el demo no debe morir: usar mock.
  if (posts.length === 0) {
    warnings.push("Todas las llamadas a Apify fallaron o no trajeron datos; se usó el modo mock.");
    return { posts: dedupeByUrl(loadMockPosts(keywords)), mode: "mock", warnings };
  }

  return { posts: dedupeByUrl(posts), mode: "apify", warnings };
}

/** Dedup por URL fusionando matched_terms. */
export function dedupeByUrl(posts: Post[]): Post[] {
  const byUrl = new Map<string, Post>();
  for (const p of posts) {
    const existing = byUrl.get(p.url);
    if (!existing) {
      byUrl.set(p.url, p);
    } else {
      existing.matched_terms = [...new Set([...existing.matched_terms, ...p.matched_terms])];
    }
  }
  return [...byUrl.values()];
}
