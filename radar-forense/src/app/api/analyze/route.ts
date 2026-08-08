import { NextRequest, NextResponse } from "next/server";
import { createRun, finishRun, insertPosts, saveAccounts, getRun, getPosts } from "@/lib/db";
import { ingest } from "@/lib/ingest";
import { DEMO_KEYWORDS } from "@/lib/ingest/mock";
import { analyze } from "@/lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Folio corto legible, p. ej. RF-LX2K9F. */
function makeRunId(): string {
  return "RF-" + Date.now().toString(36).toUpperCase().slice(-6);
}

export async function POST(req: NextRequest) {
  let body: { keywords?: string[]; demo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const demo = Boolean(body.demo);
  const keywords = demo
    ? DEMO_KEYWORDS
    : (body.keywords ?? []).map((k) => k.trim()).filter(Boolean);

  if (keywords.length === 0) {
    return NextResponse.json(
      { error: "Proporciona al menos una keyword, hashtag o mención" },
      { status: 400 }
    );
  }

  const id = makeRunId();
  try {
    const { posts, mode, warnings } = await ingest(keywords, demo);
    const run = createRun(id, keywords, mode);
    insertPosts(id, posts);
    finishRun(id, "done", posts.length);

    // Persistir cuentas derivadas (tabla accounts) con score y clúster.
    const result = analyze({ ...run, status: "done", posts_collected: posts.length }, getPosts(id));
    saveAccounts(id, result.accounts);

    return NextResponse.json({ id, posts: posts.length, mode, warnings });
  } catch (e) {
    try {
      finishRun(id, "error", 0);
    } catch {}
    return NextResponse.json(
      { error: `Fallo en la corrida: ${String(e).slice(0, 300)}` },
      { status: 500 }
    );
  }
}
