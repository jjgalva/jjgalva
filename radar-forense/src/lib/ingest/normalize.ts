/**
 * Normalización de resultados crudos de los actors de Apify al esquema
 * unificado `Post`, preservando la evidencia: raw_json íntegro, timestamp
 * de captura (collected_at) y hash SHA-256 del raw para verificación.
 */

import crypto from "node:crypto";
import type { Post, Platform } from "../types";

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

export function makePost(
  partial: Omit<Post, "raw_json" | "collected_at" | "raw_sha256"> & { raw: unknown }
): Post {
  const raw_json = JSON.stringify(partial.raw);
  const { raw, ...rest } = partial;
  return {
    ...rest,
    raw_json,
    collected_at: new Date().toISOString(),
    raw_sha256: sha256(raw_json),
  };
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** apidojo/tweet-scraper — Tweet Scraper V2. */
export function normalizeTweet(item: any, matched: string[]): Post | null {
  const url = str(item.url ?? item.twitterUrl);
  const id = str(item.id ?? item.id_str) || url;
  if (!id || !url) return null;
  const author = item.author ?? {};
  return makePost({
    id: `x_${id}`,
    platform: "x",
    author_handle: "@" + str(author.userName ?? author.username ?? item.authorUsername).replace(/^@/, ""),
    author_name: str(author.name ?? item.authorName),
    author_followers: num(author.followers ?? author.followersCount),
    author_created_at: str(author.createdAt) ? new Date(author.createdAt).toISOString() : null,
    text: str(item.text ?? item.fullText),
    url,
    posted_at: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
    likes: num(item.likeCount),
    shares: num(item.retweetCount),
    comments: num(item.replyCount),
    views: typeof item.viewCount === "number" ? item.viewCount : null,
    parent_post_id: item.isRetweet && item.retweetedTweet?.id
      ? `x_${item.retweetedTweet.id}`
      : item.isQuote && item.quotedTweet?.id
        ? `x_${item.quotedTweet.id}`
        : null,
    matched_terms: matched,
    raw: item,
  });
}

/** apify/instagram-hashtag-scraper. */
export function normalizeInstagram(item: any, matched: string[]): Post | null {
  const url = str(item.url);
  const id = str(item.id ?? item.shortCode) || url;
  if (!id || !url) return null;
  return makePost({
    id: `ig_${id}`,
    platform: "instagram",
    author_handle: "@" + str(item.ownerUsername).replace(/^@/, ""),
    author_name: str(item.ownerFullName),
    author_followers: num(item.ownerFollowersCount),
    author_created_at: null, // Instagram no expone fecha de creación de la cuenta
    text: str(item.caption),
    url,
    posted_at: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
    likes: num(item.likesCount),
    shares: 0,
    comments: num(item.commentsCount),
    views: typeof item.videoViewCount === "number" ? item.videoViewCount : null,
    parent_post_id: null,
    matched_terms: matched,
    raw: item,
  });
}

/** clockworks/tiktok-scraper. */
export function normalizeTikTok(item: any, matched: string[]): Post | null {
  const url = str(item.webVideoUrl ?? item.url);
  const id = str(item.id) || url;
  if (!id || !url) return null;
  const author = item.authorMeta ?? {};
  return makePost({
    id: `tt_${id}`,
    platform: "tiktok",
    author_handle: "@" + str(author.name ?? author.uniqueId).replace(/^@/, ""),
    author_name: str(author.nickName ?? author.nickname),
    author_followers: num(author.fans ?? author.followers),
    author_created_at: null,
    text: str(item.text ?? item.desc),
    url,
    posted_at: item.createTimeISO
      ? new Date(item.createTimeISO).toISOString()
      : item.createTime
        ? new Date(num(item.createTime) * 1000).toISOString()
        : new Date().toISOString(),
    likes: num(item.diggCount),
    shares: num(item.shareCount),
    comments: num(item.commentCount),
    views: typeof item.playCount === "number" ? item.playCount : null,
    parent_post_id: null,
    matched_terms: matched,
    raw: item,
  });
}

/** apify/facebook-search-scraper (búsqueda pública de posts). */
export function normalizeFacebook(item: any, matched: string[]): Post | null {
  const url = str(item.url ?? item.postUrl ?? item.topLevelUrl);
  if (!url) return null;
  const id = str(item.postId ?? item.id) || url;
  return makePost({
    id: `fb_${id}`,
    platform: "facebook",
    author_handle: str(item.user?.name ?? item.pageName ?? item.authorName) || "desconocido",
    author_name: str(item.user?.name ?? item.pageName ?? item.authorName),
    author_followers: num(item.user?.followers ?? item.pageFollowers ?? item.likes_count_page),
    author_created_at: null,
    text: str(item.text ?? item.message ?? item.postText),
    url,
    posted_at: item.time
      ? new Date(item.time).toISOString()
      : item.timestamp
        ? new Date(num(item.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    likes: num(item.likes ?? item.likesCount ?? item.reactions),
    shares: num(item.shares ?? item.sharesCount),
    comments: num(item.comments ?? item.commentsCount),
    views: null,
    parent_post_id: null,
    matched_terms: matched,
    raw: item,
  });
}
