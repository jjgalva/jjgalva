/**
 * Score de bot heurístico (0-100), sin ML.
 * Cada señal suma los puntos definidos en lib/criteria.ts y deja un flag
 * legible — el score siempre se reporta acompañado de sus razones.
 */

import { BOT_CRITERIA, BOT_CLASSIFICATION } from "./criteria";
import { findSimilarPairs } from "./similarity";
import type { Post, BotVerdict } from "./types";

export interface AccountScore {
  handle: string;
  platform: string;
  score: number;
  flags: string[];
}

export function classify(score: number): BotVerdict {
  if (score <= BOT_CLASSIFICATION.human_max) return "probablemente humano";
  if (score <= BOT_CLASSIFICATION.suspicious_max) return "sospechoso";
  return "probable bot";
}

const GENERIC_HANDLE_RE = new RegExp(`\\d{${BOT_CRITERIA.GENERIC_HANDLE.digit_count},}$`);

function accountKey(p: Post): string {
  return `${p.platform}:${p.author_handle}`;
}

/**
 * Calcula el score de bot para cada cuenta del dataset.
 * Recibe todos los posts de la corrida (todas las plataformas).
 */
export function computeBotScores(posts: Post[]): Map<string, AccountScore> {
  // 1) Pre-cálculo global: pares de posts con texto casi idéntico entre cuentas
  // distintas. Se excluyen retweets/reposts: duplican texto por diseño de la
  // plataforma y marcarían como bot a retuiteadores orgánicos.
  const originals = posts.filter((p) => !p.parent_post_id && p.text.trim().length > 0);
  const pairs = findSimilarPairs(
    originals.map((p) => p.text),
    BOT_CRITERIA.DUPLICATE_TEXT.similarity_threshold
  );
  const hasDuplicateText = new Set<string>();
  for (const { i, j } of pairs) {
    if (accountKey(originals[i]) !== accountKey(originals[j])) {
      hasDuplicateText.add(accountKey(originals[i]));
      hasDuplicateText.add(accountKey(originals[j]));
    }
  }

  // 2) Agrupar posts por cuenta.
  const byAccount = new Map<string, Post[]>();
  for (const p of posts) {
    const key = accountKey(p);
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key)!.push(p);
  }

  const scores = new Map<string, AccountScore>();

  for (const [key, accountPosts] of byAccount) {
    const flags: string[] = [];
    let score = 0;
    const sample = accountPosts[0];

    // Señal: antigüedad de la cuenta.
    if (sample.author_created_at) {
      const ageDays =
        (Date.parse(sample.collected_at) - Date.parse(sample.author_created_at)) / 86_400_000;
      if (ageDays >= 0 && ageDays < BOT_CRITERIA.ACCOUNT_AGE.threshold_days) {
        score += BOT_CRITERIA.ACCOUNT_AGE.points;
        flags.push(`${BOT_CRITERIA.ACCOUNT_AGE.label} (${Math.round(ageDays)} días)`);
      }
    }

    // Señal: ratio seguidores/seguidos (si el raw trae "following").
    const raw = safeParse(sample.raw_json);
    const following: number | null =
      typeof raw?.author_following === "number" ? raw.author_following : null;
    if (following !== null && following > 0) {
      const ratio = sample.author_followers / following;
      if (ratio < BOT_CRITERIA.FOLLOWER_RATIO.threshold) {
        score += BOT_CRITERIA.FOLLOWER_RATIO.points;
        flags.push(`${BOT_CRITERIA.FOLLOWER_RATIO.label} (${ratio.toFixed(2)})`);
      }
    }

    // Señal: frecuencia de posteo dentro del dataset.
    const timestamps = accountPosts.map((p) => Date.parse(p.posted_at)).sort((a, b) => a - b);
    const spanHours = Math.max(
      (timestamps[timestamps.length - 1] - timestamps[0]) / 3_600_000,
      1
    );
    const postsPerHour = accountPosts.length / spanHours;
    if (
      accountPosts.length >= 3 &&
      postsPerHour > BOT_CRITERIA.POSTING_FREQUENCY.threshold_posts_per_hour
    ) {
      score += BOT_CRITERIA.POSTING_FREQUENCY.points;
      flags.push(
        `${BOT_CRITERIA.POSTING_FREQUENCY.label} (${postsPerHour.toFixed(1)}/h)`
      );
    }

    // Señal: texto calcado con otra cuenta.
    if (hasDuplicateText.has(key)) {
      score += BOT_CRITERIA.DUPLICATE_TEXT.points;
      flags.push(BOT_CRITERIA.DUPLICATE_TEXT.label);
    }

    // Señal: handle genérico (nombre + 6+ dígitos).
    if (GENERIC_HANDLE_RE.test(sample.author_handle.replace(/^@/, ""))) {
      score += BOT_CRITERIA.GENERIC_HANDLE.points;
      flags.push(`${BOT_CRITERIA.GENERIC_HANDLE.label}: ${sample.author_handle}`);
    }

    // Señal: actividad uniforme en las 24 horas.
    const u = BOT_CRITERIA.UNIFORM_ACTIVITY;
    if (accountPosts.length >= u.min_posts) {
      const buckets = new Array(24).fill(0);
      for (const t of timestamps) buckets[new Date(t).getUTCHours()]++;
      const active = buckets.filter((b) => b > 0);
      if (active.length >= u.min_active_hours) {
        const mean = active.reduce((a, b) => a + b, 0) / active.length;
        const variance =
          active.reduce((acc, b) => acc + (b - mean) ** 2, 0) / active.length;
        const cv = Math.sqrt(variance) / mean;
        if (cv < u.max_coefficient_of_variation) {
          score += u.points;
          flags.push(`${u.label} (${active.length} horas activas, CV ${cv.toFixed(2)})`);
        }
      }
    }

    scores.set(key, {
      handle: sample.author_handle,
      platform: sample.platform,
      score: Math.min(score, 100),
      flags,
    });
  }

  return scores;
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
