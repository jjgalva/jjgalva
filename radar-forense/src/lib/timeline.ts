/**
 * Cronología de la campaña: eventos clave detectados automáticamente.
 * - Paciente cero por plataforma.
 * - Picos de volumen (día > 2x promedio) con el post que más contribuyó.
 * - Aparición de cada clúster de coordinación.
 * - Entrada de amplificadores grandes (>10K seguidores).
 */

import type { Post, TimelineEvent, CoordinationCluster, Platform } from "./types";
import { PLATFORM_LABEL } from "./types";

const AMPLIFIER_MIN_FOLLOWERS = 10_000;
const PEAK_MULTIPLIER = 2;

const day = (iso: string) => iso.slice(0, 10);

export function buildTimeline(
  posts: Post[],
  clusters: CoordinationCluster[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (posts.length === 0) return events;

  const sorted = [...posts].sort((a, b) => Date.parse(a.posted_at) - Date.parse(b.posted_at));

  // 1) Paciente cero por plataforma.
  const seenPlatform = new Set<Platform>();
  for (const p of sorted) {
    if (seenPlatform.has(p.platform)) continue;
    seenPlatform.add(p.platform);
    const isGlobalFirst = p === sorted[0];
    events.push({
      at: p.posted_at,
      type: "paciente_cero",
      title: isGlobalFirst
        ? `Paciente cero de la campaña (${PLATFORM_LABEL[p.platform]})`
        : `Primer post en ${PLATFORM_LABEL[p.platform]}`,
      description: `${p.author_handle}: “${truncate(p.text, 140)}”`,
      url: p.url,
      platform: p.platform,
    });
  }

  // 2) Picos de volumen.
  const byDay = new Map<string, Post[]>();
  for (const p of sorted) {
    const d = day(p.posted_at);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(p);
  }
  const avg = posts.length / byDay.size;
  for (const [d, dayPosts] of byDay) {
    if (dayPosts.length > PEAK_MULTIPLIER * avg) {
      const top = [...dayPosts].sort(
        (a, b) => b.likes + b.shares + b.comments - (a.likes + a.shares + a.comments)
      )[0];
      events.push({
        at: `${d}T12:00:00.000Z`,
        type: "pico",
        title: `Pico de volumen: ${dayPosts.length} posts (promedio diario: ${avg.toFixed(0)})`,
        description: `Mayor contribución: ${top.author_handle} con ${
          top.likes + top.shares + top.comments
        } interacciones — “${truncate(top.text, 100)}”`,
        url: top.url,
        platform: top.platform,
      });
    }
  }

  // 3) Aparición de clústeres de coordinación.
  for (const c of clusters) {
    const first = c.sample_texts[0];
    events.push({
      at: c.first_post_at,
      type: "cluster",
      title: `Aparece el clúster de coordinación #${c.id} (${c.accounts.length} cuentas)`,
      description: `Primer texto del clúster (${first?.handle ?? "?"}): “${truncate(
        first?.text ?? "",
        120
      )}”${c.bursts.length > 0 ? ` · ${c.bursts.length} ráfaga(s) sincronizada(s)` : ""}`,
      url: first?.url ?? null,
      platform: c.platforms[0] ?? null,
    });
  }

  // 4) Entrada de amplificadores grandes.
  const seenAmplifier = new Set<string>();
  for (const p of sorted) {
    const key = `${p.platform}:${p.author_handle}`;
    if (p.author_followers >= AMPLIFIER_MIN_FOLLOWERS && !seenAmplifier.has(key)) {
      seenAmplifier.add(key);
      events.push({
        at: p.posted_at,
        type: "amplificador",
        title: `Entra amplificador: ${p.author_handle} (${formatFollowers(p.author_followers)} seguidores)`,
        description: p.parent_post_id
          ? `Amplifica contenido existente en ${PLATFORM_LABEL[p.platform]}`
          : `Publica contenido propio: “${truncate(p.text, 100)}”`,
        url: p.url,
        platform: p.platform,
      });
    }
  }

  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
