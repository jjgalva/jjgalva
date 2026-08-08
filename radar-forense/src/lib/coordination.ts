/**
 * Detección de coordinación ENTRE cuentas (separada del score individual).
 * Señales: clústeres de texto calcado, sincronización temporal (ráfagas),
 * ráfaga de creación de cuentas y cuentas de amplificación pura.
 * Con ellas se calcula el dictamen: % de actividad coordinada vs. orgánica,
 * ponderada por engagement, con redacción conservadora.
 */

import { COORDINATION_CRITERIA as C, BOT_CLASSIFICATION } from "./criteria";
import { findSimilarPairs } from "./similarity";
import type { AccountScore } from "./botscore";
import type {
  Post,
  Platform,
  CoordinationCluster,
  CoordinationResult,
} from "./types";

const acctKey = (p: Post) => `${p.platform}:${p.author_handle}`;

/** Union-Find simple para agrupar posts similares en componentes. */
class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

export function detectCoordination(
  posts: Post[],
  botScores: Map<string, AccountScore>
): { result: CoordinationResult; clusterByAccount: Map<string, number> } {
  // ---------- 1) Clústeres de texto calcado ----------
  // Solo posts originales con texto (los retweets duplican texto por diseño de la plataforma).
  const candidates = posts.filter((p) => !p.parent_post_id && p.text.trim().length > 0);
  const pairs = findSimilarPairs(
    candidates.map((p) => p.text),
    C.TEXT_SIMILARITY_THRESHOLD
  );

  const uf = new UnionFind(candidates.length);
  for (const { i, j } of pairs) {
    if (acctKey(candidates[i]) !== acctKey(candidates[j])) uf.union(i, j);
  }

  const components = new Map<number, number[]>();
  for (const { i, j } of pairs) {
    for (const idx of [i, j]) {
      const root = uf.find(idx);
      if (!components.has(root)) components.set(root, []);
    }
  }
  for (let idx = 0; idx < candidates.length; idx++) {
    const root = uf.find(idx);
    if (components.has(root)) components.get(root)!.push(idx);
  }

  const clusters: CoordinationCluster[] = [];
  const clusterByAccount = new Map<string, number>();
  let clusterId = 0;

  for (const indices of components.values()) {
    const clusterPosts = indices.map((i) => candidates[i]);
    const accounts = [...new Set(clusterPosts.map(acctKey))];
    if (accounts.length < C.MIN_ACCOUNTS_PER_CLUSTER) continue;

    clusterId++;
    for (const a of accounts) clusterByAccount.set(a, clusterId);

    // ---------- 2) Sincronización temporal dentro del clúster ----------
    const sorted = [...clusterPosts].sort(
      (a, b) => Date.parse(a.posted_at) - Date.parse(b.posted_at)
    );
    const bursts: CoordinationCluster["bursts"] = [];
    const windowMs = C.BURST.window_minutes * 60_000;
    let wStart = 0;
    for (let i = 0; i < sorted.length; i++) {
      while (Date.parse(sorted[i].posted_at) - Date.parse(sorted[wStart].posted_at) > windowMs)
        wStart++;
      const count = i - wStart + 1;
      if (count >= C.BURST.min_posts) {
        const start = sorted[wStart].posted_at;
        const end = sorted[i].posted_at;
        const last = bursts[bursts.length - 1];
        if (last && Date.parse(start) <= Date.parse(last.end)) {
          last.end = end;
          last.posts = Math.max(last.posts, count);
          last.minutes = Math.round((Date.parse(last.end) - Date.parse(last.start)) / 60_000);
        } else {
          bursts.push({
            start,
            end,
            posts: count,
            minutes: Math.round((Date.parse(end) - Date.parse(start)) / 60_000),
          });
        }
      }
    }

    clusters.push({
      id: clusterId,
      accounts,
      post_count: clusterPosts.length,
      sample_texts: sorted.slice(0, 4).map((p) => ({
        handle: p.author_handle,
        text: p.text,
        posted_at: p.posted_at,
        url: p.url,
      })),
      bursts,
      first_post_at: sorted[0].posted_at,
      platforms: [...new Set(clusterPosts.map((p) => p.platform))] as Platform[],
    });
  }

  // ---------- 4) Amplificación artificial (solo reposts) ----------
  // Se calcula antes que la ráfaga de creación para incluir estas cuentas
  // en el pool de cuentas señaladas.
  const byAccount = new Map<string, Post[]>();
  for (const p of posts) {
    const k = acctKey(p);
    if (!byAccount.has(k)) byAccount.set(k, []);
    byAccount.get(k)!.push(p);
  }
  const amplificationOnly: string[] = [];
  for (const [key, ps] of byAccount) {
    if (ps.length >= 2 && ps.every((p) => p.parent_post_id)) amplificationOnly.push(key);
  }

  // ---------- 3) Ráfaga de creación de cuentas ----------
  const flaggedAccounts = new Set<string>([...clusterByAccount.keys(), ...amplificationOnly]);
  for (const [key, s] of botScores) {
    if (s.score > BOT_CLASSIFICATION.suspicious_max) flaggedAccounts.add(key);
  }
  const creations: { key: string; at: number }[] = [];
  const seen = new Set<string>();
  for (const p of posts) {
    const key = acctKey(p);
    if (seen.has(key) || !p.author_created_at || !flaggedAccounts.has(key)) continue;
    seen.add(key);
    creations.push({ key, at: Date.parse(p.author_created_at) });
  }
  creations.sort((a, b) => a.at - b.at);

  let burstAccounts: string[] = [];
  let burstWindow: [number, number] | null = null;
  const windowMs = C.ACCOUNT_CREATION_BURST.window_days * 86_400_000;
  for (let i = 0; i < creations.length; i++) {
    const inWindow = creations.filter(
      (c) => c.at >= creations[i].at && c.at <= creations[i].at + windowMs
    );
    if (inWindow.length > burstAccounts.length) {
      burstAccounts = inWindow.map((c) => c.key);
      burstWindow = [creations[i].at, creations[i].at + windowMs];
    }
  }
  const creationBurstDetected =
    burstAccounts.length >= C.ACCOUNT_CREATION_BURST.min_accounts;

  // ---------- Dictamen ----------
  // Cuenta "coordinada/automatizada" = pertenece a un clúster, o score > 60,
  // o es amplificación pura Y forma parte de la ráfaga de creación.
  const coordinatedAccounts = new Set<string>();
  for (const k of clusterByAccount.keys()) coordinatedAccounts.add(k);
  for (const [key, s] of botScores) {
    if (s.score > BOT_CLASSIFICATION.suspicious_max) coordinatedAccounts.add(key);
  }
  if (creationBurstDetected) {
    for (const k of amplificationOnly) {
      if (burstAccounts.includes(k)) coordinatedAccounts.add(k);
    }
  }

  const weight = (p: Post) => 1 + p.likes + p.shares + p.comments;
  let coordinatedWeight = 0;
  let totalWeight = 0;
  for (const p of posts) {
    const w = weight(p);
    totalWeight += w;
    if (coordinatedAccounts.has(acctKey(p))) coordinatedWeight += w;
  }
  const coordinatedPct =
    totalWeight > 0 ? Math.round((coordinatedWeight / totalWeight) * 100) : 0;

  // Confianza conservadora: cuenta señales independientes presentes.
  const signals: string[] = [];
  if (clusters.length > 0)
    signals.push(
      `${clusters.length} clúster(es) de textos casi idénticos publicados por cuentas distintas`
    );
  const totalBursts = clusters.reduce((a, c) => a + c.bursts.length, 0);
  if (totalBursts > 0)
    signals.push(
      `${totalBursts} ráfaga(s) de publicación sincronizada (${C.BURST.min_posts}+ posts casi idénticos en un máximo de ${C.BURST.window_minutes} min)`
    );
  if (creationBurstDetected)
    signals.push(
      `${burstAccounts.length} cuentas participantes creadas dentro de la misma ventana de ${C.ACCOUNT_CREATION_BURST.window_days} días`
    );
  if (amplificationOnly.length >= 3)
    signals.push(
      `${amplificationOnly.length} cuentas cuya única actividad en el dataset es repostear`
    );

  let confidence: "alta" | "media" | "baja";
  if (posts.length < C.VERDICT.min_posts_for_confidence) confidence = "baja";
  else if (signals.length >= C.VERDICT.min_signals_for_high_confidence) confidence = "alta";
  else if (signals.length >= 1) confidence = "media";
  else confidence = "baja";

  const justification = buildJustification(
    coordinatedPct,
    confidence,
    signals,
    clusters,
    coordinatedAccounts.size,
    posts.length
  );

  return {
    result: {
      clusters,
      account_creation_burst: {
        detected: creationBurstDetected,
        window_start: creationBurstDetected && burstWindow ? new Date(burstWindow[0]).toISOString() : null,
        window_end: creationBurstDetected && burstWindow ? new Date(burstWindow[1]).toISOString() : null,
        accounts: creationBurstDetected ? burstAccounts : [],
      },
      amplification_only_accounts: amplificationOnly,
      verdict: {
        coordinated_pct: coordinatedPct,
        organic_pct: 100 - coordinatedPct,
        confidence,
        justification,
      },
    },
    clusterByAccount,
  };
}

function buildJustification(
  pct: number,
  confidence: "alta" | "media" | "baja",
  signals: string[],
  clusters: CoordinationCluster[],
  coordinatedAccounts: number,
  totalPosts: number
): string {
  if (signals.length === 0) {
    return (
      `No se detectaron señales claras de coordinación en los ${totalPosts} posts analizados: ` +
      `no hay clústeres de texto calcado entre cuentas distintas ni ráfagas de publicación sincronizada. ` +
      `Con la evidencia disponible, la actividad observada es consistente con una conversación orgánica. ` +
      `Este dictamen podría cambiar si se amplía la ventana de recolección.`
    );
  }

  const parts: string[] = [];
  parts.push(
    `Se estima que aproximadamente el ${pct}% de la actividad total (posts ponderados por engagement) ` +
      `proviene de ${coordinatedAccounts} cuentas con indicadores de coordinación o automatización.`
  );
  parts.push(`Señales detectadas: ${signals.join("; ")}.`);
  if (clusters.length > 0) {
    const biggest = [...clusters].sort((a, b) => b.accounts.length - a.accounts.length)[0];
    parts.push(
      `El clúster principal agrupa ${biggest.accounts.length} cuentas que publicaron ${biggest.post_count} ` +
        `posts con variaciones mínimas del mismo texto` +
        (biggest.bursts.length > 0
          ? `, incluyendo una ráfaga de ${biggest.bursts[0].posts} posts en ${Math.max(biggest.bursts[0].minutes, 1)} minutos`
          : "") +
      `.`
    );
  }
  if (confidence === "alta") {
    parts.push(
      `La convergencia de señales independientes hace improbable que este patrón sea espontáneo, ` +
        `aunque un porcentaje de la conversación conserva características orgánicas.`
    );
  } else if (confidence === "media") {
    parts.push(
      `La evidencia es indicativa pero no concluyente: se recomienda ampliar la recolección ` +
        `antes de afirmar coordinación con certeza.`
    );
  } else {
    parts.push(
      `ADVERTENCIA: el volumen de datos es reducido y la evidencia es ambigua; ` +
        `este porcentaje debe tratarse como preliminar.`
    );
  }
  return parts.join(" ");
}
