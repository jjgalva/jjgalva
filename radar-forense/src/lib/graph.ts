/**
 * Grafo de difusión (solo X): aristas de retweet/quote hacia el autor original.
 * Nodo origen = raíz con timestamp más antiguo; top amplificadores por in-degree.
 */

import type { Post, DiffusionGraph, GraphNode, GraphEdge, PlatformLists, Platform } from "./types";
import type { AccountScore } from "./botscore";

export function buildDiffusionGraph(
  posts: Post[],
  botScores: Map<string, AccountScore>
): DiffusionGraph {
  const xPosts = posts.filter((p) => p.platform === "x");
  const postById = new Map(xPosts.map((p) => [p.id, p]));

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const inDegree = new Map<string, number>();

  const ensureNode = (p: Post) => {
    if (!nodes.has(p.author_handle)) {
      const score = botScores.get(`x:${p.author_handle}`)?.score ?? 0;
      nodes.set(p.author_handle, {
        id: p.author_handle,
        handle: p.author_handle,
        followers: p.author_followers,
        bot_score: score,
        posts: 0,
        // Tamaño en escala log de seguidores.
        val: Math.max(1, Math.log10(p.author_followers + 10) * 2),
      });
    }
    nodes.get(p.author_handle)!.posts++;
  };

  for (const p of xPosts) ensureNode(p);

  for (const p of xPosts) {
    if (!p.parent_post_id) continue;
    const parent = postById.get(p.parent_post_id);
    if (!parent || parent.author_handle === p.author_handle) continue;
    // Arista: quien repostea → autor original.
    edges.push({ source: p.author_handle, target: parent.author_handle });
    inDegree.set(parent.author_handle, (inDegree.get(parent.author_handle) ?? 0) + 1);
  }

  // Nodo origen: post raíz (sin parent) con timestamp más antiguo.
  const roots = xPosts
    .filter((p) => !p.parent_post_id)
    .sort((a, b) => Date.parse(a.posted_at) - Date.parse(b.posted_at));
  const origin = roots[0]
    ? {
        handle: roots[0].author_handle,
        url: roots[0].url,
        posted_at: roots[0].posted_at,
        text: roots[0].text,
      }
    : null;

  const top_amplifiers = [...inDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([handle, deg]) => ({
      handle,
      in_degree: deg,
      followers: nodes.get(handle)?.followers ?? 0,
      bot_score: nodes.get(handle)?.bot_score ?? 0,
    }));

  return { nodes: [...nodes.values()], edges, origin, top_amplifiers };
}

/** Para IG/TikTok/FB: primeras 10 cuentas en publicar y top 10 por engagement. */
export function buildPlatformLists(posts: Post[]): PlatformLists[] {
  const platforms: Platform[] = ["instagram", "tiktok", "facebook"];
  const out: PlatformLists[] = [];

  for (const platform of platforms) {
    const pp = posts.filter((p) => p.platform === platform);
    if (pp.length === 0) continue;

    const sorted = [...pp].sort((a, b) => Date.parse(a.posted_at) - Date.parse(b.posted_at));
    const seen = new Set<string>();
    const first_posters: PlatformLists["first_posters"] = [];
    for (const p of sorted) {
      if (seen.has(p.author_handle)) continue;
      seen.add(p.author_handle);
      first_posters.push({
        handle: p.author_handle,
        posted_at: p.posted_at,
        url: p.url,
        followers: p.author_followers,
      });
      if (first_posters.length >= 10) break;
    }

    const top_engagement = [...pp]
      .sort(
        (a, b) => b.likes + b.shares + b.comments - (a.likes + a.shares + a.comments)
      )
      .slice(0, 10)
      .map((p) => ({
        handle: p.author_handle,
        url: p.url,
        engagement: p.likes + p.shares + p.comments,
        text: p.text.length > 90 ? p.text.slice(0, 89) + "…" : p.text,
      }));

    out.push({ platform, first_posters, top_engagement });
  }
  return out;
}
