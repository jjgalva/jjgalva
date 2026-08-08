/**
 * Anexo de Evidencia: ZIP con (a) un JSON por post con sus datos crudos,
 * (b) manifest.csv (url, posted_at, collected_at, raw_sha256) y
 * (c) README_evidencia.txt con la metodología de captura.
 * Este anexo es lo que da valor probatorio al análisis.
 */

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getRun, getPosts } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const run = getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Corrida no encontrada" }, { status: 404 });
  }
  const posts = getPosts(params.id);
  const zip = new JSZip();

  // (a) Un JSON por post: metadatos normalizados + raw íntegro.
  const folder = zip.folder("posts")!;
  for (const p of posts) {
    const safeName = p.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    folder.file(
      `${p.platform}/${safeName}.json`,
      JSON.stringify(
        {
          id: p.id,
          platform: p.platform,
          url: p.url,
          author_handle: p.author_handle,
          posted_at: p.posted_at,
          collected_at: p.collected_at,
          raw_sha256: p.raw_sha256,
          matched_terms: p.matched_terms,
          raw: JSON.parse(p.raw_json),
        },
        null,
        2
      )
    );
  }

  // (b) manifest.csv
  const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const manifest = [
    "url,posted_at,collected_at,raw_sha256",
    ...posts.map((p) =>
      [csvEscape(p.url), p.posted_at, p.collected_at, p.raw_sha256].join(",")
    ),
  ].join("\n");
  zip.file("manifest.csv", manifest);

  // (c) README de metodología
  zip.file("README_evidencia.txt", buildReadme(run.id, run.keywords, posts.length, run.mode));

  const blob = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(blob), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="anexo_evidencia_${run.id}.zip"`,
    },
  });
}

function buildReadme(
  runId: string,
  keywords: string[],
  total: number,
  mode: string
): string {
  return `ANEXO DE EVIDENCIA — RADAR FORENSE · APPLAB
=============================================

Folio de la corrida : ${runId}
Términos de búsqueda: ${keywords.join(", ")}
Total de elementos  : ${total}
Modo de recolección : ${mode === "mock" ? "DEMO (datos sintéticos de demostración)" : "Apify (datos públicos reales)"}
Generado            : ${new Date().toISOString()}

METODOLOGÍA DE CAPTURA
----------------------
1. La recolección se realizó mediante actors públicos de la plataforma Apify
   (apidojo/tweet-scraper, apify/instagram-hashtag-scraper,
   clockworks/tiktok-scraper, apify/facebook-search-scraper) sobre contenido
   PÚBLICO que coincidió con los términos de búsqueda indicados.
2. Cada elemento se conservó íntegro tal como lo devolvió la fuente
   (campo "raw" de cada JSON en la carpeta posts/), sin edición posterior.
3. En el momento de la captura se registró:
   - posted_at    : timestamp de publicación reportado por la plataforma (ISO 8601, UTC)
   - collected_at : timestamp de captura del sistema (ISO 8601, UTC)
   - raw_sha256   : hash SHA-256 del JSON crudo, calculado al capturar.
4. VERIFICACIÓN DE INTEGRIDAD: para verificar que un elemento no fue alterado
   después de la captura, serialice el objeto "raw" de su JSON (JSON.stringify
   sin espacios) y calcule su SHA-256; debe coincidir con raw_sha256 y con la
   fila correspondiente de manifest.csv.
5. La deduplicación se realizó por URL; el campo matched_terms indica qué
   términos de búsqueda trajeron cada elemento.

ALCANCE Y LIMITACIONES
----------------------
- Este anexo documenta contenido público en el momento de la captura; los
  posts pueden haber sido editados o eliminados posteriormente.
- El análisis caracteriza el comportamiento de cuentas públicas; no
  identifica personas físicas. No constituye asesoría legal.
${mode === "mock" ? "- ATENCIÓN: esta corrida usó datos SINTÉTICOS de demostración.\n" : ""}
Radar Forense · AppLab · applab.mx · Confidencial
`;
}
