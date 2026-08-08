/**
 * Orquestador: toma los posts de una corrida y produce el AnalysisResult
 * completo (cuentas + bot score, coordinación + dictamen, cronología,
 * volumen, grafo de difusión y listas por plataforma).
 */

import type {
  Post,
  Account,
  AnalysisResult,
  Platform,
  Run,
  VolumePoint,
} from "./types";
import { computeBotScores } from "./botscore";
import { detectCoordination } from "./coordination";
import { buildTimeline } from "./timeline";
import { buildDiffusionGraph, buildPlatformLists } from "./graph";
import { BOT_CLASSIFICATION } from "./criteria";

export function analyze(run: Run, posts: Post[]): AnalysisResult {
  const botScores = computeBotScores(posts);
  const { result: coordination, clusterByAccount } = detectCoordination(posts, botScores);

  // ---- Cuentas derivadas ----
  const byAccount = new Map<string, Post[]>();
  for (const p of posts) {
    const key = `${p.platform}:${p.author_handle}`;
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key)!.push(p);
  }

  const accounts: Account[] = [];
  for (const [key, ps] of byAccount) {
    const sample = ps[0];
    const score = botScores.get(key);
    const timestamps = ps.map((p) => Date.parse(p.posted_at)).sort((a, b) => a - b);
    const spanHours = Math.max((timestamps[timestamps.length - 1] - timestamps[0]) / 3_600_000, 1);
    const raw = safeParse(sample.raw_json);
    const following = typeof raw?.author_following === "number" ? raw.author_following : null;
    accounts.push({
      handle: sample.author_handle,
      platform: sample.platform,
      followers: sample.author_followers,
      following,
      account_age_days: sample.author_created_at
        ? Math.round(
            (Date.parse(sample.collected_at) - Date.parse(sample.author_created_at)) / 86_400_000
          )
        : null,
      posts_in_dataset: ps.length,
      avg_posts_per_hour: Number((ps.length / spanHours).toFixed(2)),
      bot_score: score?.score ?? 0,
      bot_flags: score?.flags ?? [],
      coordination_cluster_id: clusterByAccount.get(key) ?? null,
    });
  }
  accounts.sort((a, b) => b.bot_score - a.bot_score);

  // ---- Volumen por día ----
  const suspiciousAccounts = new Set(
    accounts
      .filter((a) => a.bot_score > BOT_CLASSIFICATION.human_max || a.coordination_cluster_id !== null)
      .map((a) => `${a.platform}:${a.handle}`)
  );
  const byDay = new Map<string, VolumePoint>();
  const sorted = [...posts].sort((a, b) => Date.parse(a.posted_at) - Date.parse(b.posted_at));
  for (const p of sorted) {
    const d = p.posted_at.slice(0, 10);
    if (!byDay.has(d)) {
      byDay.set(d, { date: d, x: 0, instagram: 0, tiktok: 0, facebook: 0, suspicious: 0, total: 0 });
    }
    const point = byDay.get(d)!;
    point[p.platform]++;
    point.total++;
    if (suspiciousAccounts.has(`${p.platform}:${p.author_handle}`)) point.suspicious++;
  }
  const volume = [...byDay.values()];

  // ---- Cronología, grafo, listas ----
  const timeline = buildTimeline(posts, coordination.clusters);
  const graph = buildDiffusionGraph(posts, botScores);
  const platform_lists = buildPlatformLists(posts);

  const platforms = [...new Set(posts.map((p) => p.platform))] as Platform[];
  const totalEngagement = posts.reduce((a, p) => a + p.likes + p.shares + p.comments, 0);

  return {
    run,
    totals: {
      posts: posts.length,
      platforms,
      accounts: accounts.length,
      bot_accounts: accounts.filter((a) => a.bot_score > BOT_CLASSIFICATION.suspicious_max).length,
      suspicious_accounts: accounts.filter(
        (a) =>
          a.bot_score > BOT_CLASSIFICATION.human_max &&
          a.bot_score <= BOT_CLASSIFICATION.suspicious_max
      ).length,
      clusters: coordination.clusters.length,
      date_range: {
        from: sorted[0]?.posted_at ?? run.started_at,
        to: sorted[sorted.length - 1]?.posted_at ?? run.started_at,
      },
      total_engagement: totalEngagement,
    },
    accounts,
    coordination,
    timeline,
    volume,
    graph,
    platform_lists,
    posts,
  };
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
