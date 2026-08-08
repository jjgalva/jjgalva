/**
 * Persistencia con SQLite (better-sqlite3), archivo local en data/radar.db.
 * Nota Vercel: el filesystem de las funciones serverless es efímero — en
 * producción real se necesitaría una BD gestionada (siguiente fase, ver README).
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Post, Run, Account, Platform } from "./types";

const DB_PATH =
  process.env.RADAR_DB_PATH ?? path.join(process.cwd(), "data", "radar.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      keywords TEXT NOT NULL,           -- JSON array
      started_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      posts_collected INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'mock'
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT NOT NULL,
      run_id TEXT NOT NULL REFERENCES runs(id),
      platform TEXT NOT NULL,
      author_handle TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT '',
      author_followers INTEGER NOT NULL DEFAULT 0,
      author_created_at TEXT,
      text TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      posted_at TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      views INTEGER,
      parent_post_id TEXT,
      raw_json TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      raw_sha256 TEXT NOT NULL,
      matched_terms TEXT NOT NULL DEFAULT '[]',  -- JSON array
      PRIMARY KEY (run_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_posts_run ON posts(run_id);

    CREATE TABLE IF NOT EXISTS accounts (
      run_id TEXT NOT NULL REFERENCES runs(id),
      handle TEXT NOT NULL,
      platform TEXT NOT NULL,
      followers INTEGER NOT NULL DEFAULT 0,
      following INTEGER,
      account_age_days INTEGER,
      posts_in_dataset INTEGER NOT NULL DEFAULT 0,
      avg_posts_per_hour REAL NOT NULL DEFAULT 0,
      bot_score INTEGER NOT NULL DEFAULT 0,
      bot_flags TEXT NOT NULL DEFAULT '[]',      -- JSON array
      coordination_cluster_id INTEGER,
      PRIMARY KEY (run_id, platform, handle)
    );
  `);
}

// ---------- Runs ----------

export function createRun(id: string, keywords: string[], mode: "mock" | "apify"): Run {
  const run: Run = {
    id,
    keywords,
    started_at: new Date().toISOString(),
    status: "running",
    posts_collected: 0,
    mode,
  };
  db()
    .prepare(
      `INSERT INTO runs (id, keywords, started_at, status, posts_collected, mode)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(run.id, JSON.stringify(run.keywords), run.started_at, run.status, 0, run.mode);
  return run;
}

export function finishRun(id: string, status: "done" | "error", postsCollected: number) {
  db()
    .prepare(`UPDATE runs SET status = ?, posts_collected = ? WHERE id = ?`)
    .run(status, postsCollected, id);
}

export function getRun(id: string): Run | null {
  const row = db().prepare(`SELECT * FROM runs WHERE id = ?`).get(id) as any;
  return row ? rowToRun(row) : null;
}

export function listRuns(): Run[] {
  const rows = db()
    .prepare(`SELECT * FROM runs ORDER BY started_at DESC LIMIT 50`)
    .all() as any[];
  return rows.map(rowToRun);
}

function rowToRun(row: any): Run {
  return {
    id: row.id,
    keywords: JSON.parse(row.keywords),
    started_at: row.started_at,
    status: row.status,
    posts_collected: row.posts_collected,
    mode: row.mode,
  };
}

// ---------- Posts ----------

export function insertPosts(runId: string, posts: Post[]) {
  const stmt = db().prepare(
    `INSERT OR IGNORE INTO posts (
      id, run_id, platform, author_handle, author_name, author_followers,
      author_created_at, text, url, posted_at, likes, shares, comments, views,
      parent_post_id, raw_json, collected_at, raw_sha256, matched_terms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db().transaction((items: Post[]) => {
    for (const p of items) {
      stmt.run(
        p.id, runId, p.platform, p.author_handle, p.author_name, p.author_followers,
        p.author_created_at, p.text, p.url, p.posted_at, p.likes, p.shares,
        p.comments, p.views, p.parent_post_id, p.raw_json, p.collected_at,
        p.raw_sha256, JSON.stringify(p.matched_terms)
      );
    }
  });
  tx(posts);
}

export function getPosts(runId: string): Post[] {
  const rows = db().prepare(`SELECT * FROM posts WHERE run_id = ?`).all(runId) as any[];
  return rows.map((r) => ({
    id: r.id,
    platform: r.platform as Platform,
    author_handle: r.author_handle,
    author_name: r.author_name,
    author_followers: r.author_followers,
    author_created_at: r.author_created_at,
    text: r.text,
    url: r.url,
    posted_at: r.posted_at,
    likes: r.likes,
    shares: r.shares,
    comments: r.comments,
    views: r.views,
    parent_post_id: r.parent_post_id,
    raw_json: r.raw_json,
    collected_at: r.collected_at,
    raw_sha256: r.raw_sha256,
    matched_terms: JSON.parse(r.matched_terms),
  }));
}

// ---------- Accounts ----------

export function saveAccounts(runId: string, accounts: Account[]) {
  const stmt = db().prepare(
    `INSERT OR REPLACE INTO accounts (
      run_id, handle, platform, followers, following, account_age_days,
      posts_in_dataset, avg_posts_per_hour, bot_score, bot_flags, coordination_cluster_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db().transaction((items: Account[]) => {
    for (const a of items) {
      stmt.run(
        runId, a.handle, a.platform, a.followers, a.following, a.account_age_days,
        a.posts_in_dataset, a.avg_posts_per_hour, a.bot_score,
        JSON.stringify(a.bot_flags), a.coordination_cluster_id
      );
    }
  });
  tx(accounts);
}
