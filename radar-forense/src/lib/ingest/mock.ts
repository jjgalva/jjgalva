/**
 * Modo mock / demo: carga la campaña sintética pre-generada desde
 * data/mock/*.json. Los archivos ya vienen en el esquema unificado `Post`
 * (generados por scripts/generate-mock.mjs con PRNG sembrado — deterministas).
 * El demo ante cliente NUNCA depende de red ni de API keys.
 */

import fs from "node:fs";
import path from "node:path";
import type { Post, Platform } from "../types";
import { sha256 } from "./normalize";

const MOCK_DIR = path.join(process.cwd(), "data", "mock");
const FILES: Record<Platform, string> = {
  x: "x.json",
  instagram: "instagram.json",
  tiktok: "tiktok.json",
  facebook: "facebook.json",
};

export function loadMockPosts(keywords: string[]): Post[] {
  const collected_at = new Date().toISOString();
  const posts: Post[] = [];
  for (const [platform, file] of Object.entries(FILES)) {
    const full = path.join(MOCK_DIR, file);
    if (!fs.existsSync(full)) continue;
    const items: any[] = JSON.parse(fs.readFileSync(full, "utf8"));
    for (const item of items) {
      const raw_json = JSON.stringify(item.raw ?? item);
      posts.push({
        ...item,
        platform: platform as Platform,
        collected_at,
        raw_json,
        raw_sha256: sha256(raw_json),
        matched_terms: item.matched_terms?.length ? item.matched_terms : keywords,
      });
    }
  }
  return posts;
}

/** Keywords del caso demo (campaña contra el desarrollo ficticio). */
export const DEMO_KEYWORDS = [
  "#NoAlDesarrolloAltavista",
  "fraude altavista sur",
  "@AltavistaSurMX",
];
