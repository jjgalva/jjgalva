import { NextRequest, NextResponse } from "next/server";
import { getRun, getPosts } from "@/lib/db";
import { analyze } from "@/lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const run = getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Corrida no encontrada" }, { status: 404 });
  }
  const posts = getPosts(params.id);
  const result = analyze(run, posts);
  return NextResponse.json(result);
}
