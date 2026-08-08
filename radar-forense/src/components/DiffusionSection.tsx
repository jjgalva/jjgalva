"use client";

import dynamic from "next/dynamic";
import { useMemo, type RefObject } from "react";
import type { AnalysisResult } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/types";
import { formatFollowers } from "@/lib/timeline";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
      Cargando grafo…
    </div>
  ),
});

/** Verde (humano) → rojo (bot). */
function scoreColor(score: number): string {
  const t = Math.min(score, 100) / 100;
  const r = Math.round(52 + t * (244 - 52));
  const g = Math.round(211 - t * (211 - 63));
  const b = Math.round(153 - t * (153 - 94));
  return `rgb(${r},${g},${b})`;
}

export default function DiffusionSection({
  data,
  graphContainerRef,
}: {
  data: AnalysisResult;
  graphContainerRef: RefObject<HTMLDivElement>;
}) {
  const graphData = useMemo(
    () => ({
      nodes: data.graph.nodes.map((n) => ({ ...n })),
      links: data.graph.edges.map((e) => ({ source: e.source, target: e.target })),
    }),
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Grafo interactivo de X */}
        <div ref={graphContainerRef} className="card relative overflow-hidden">
          {data.graph.nodes.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
              No hay posts de X en esta corrida.
            </div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              width={780}
              height={420}
              backgroundColor="#0E0E1C"
              nodeVal={(n: any) => n.val}
              nodeLabel={(n: any) =>
                `${n.handle} · ${formatFollowers(n.followers)} seguidores · bot score ${n.bot_score}`
              }
              nodeColor={(n: any) => scoreColor(n.bot_score)}
              linkColor={() => "rgba(115,102,254,0.35)"}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              cooldownTicks={120}
            />
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-ink-950/80 px-3 py-2 text-[11px] text-slate-400">
            tamaño = seguidores (log) · color:{" "}
            <span style={{ color: scoreColor(5) }}>humano</span> →{" "}
            <span style={{ color: scoreColor(90) }}>bot</span>
          </div>
        </div>

        {/* Panel lateral: origen + amplificadores */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="stat-label mb-2">Nodo origen (X)</h3>
            {data.graph.origin ? (
              <div>
                <p className="font-semibold text-amber-300">{data.graph.origin.handle}</p>
                <p className="text-xs text-slate-500">
                  {new Date(data.graph.origin.posted_at).toLocaleString("es-MX", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </p>
                <p className="mt-2 line-clamp-4 text-sm text-slate-300">
                  “{data.graph.origin.text}”
                </p>
                <a
                  href={data.graph.origin.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Ver post ↗
                </a>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin datos de X.</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="stat-label mb-2">Top amplificadores (in-degree)</h3>
            <ol className="space-y-1.5">
              {data.graph.top_amplifiers.map((a, i) => (
                <li key={a.handle} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <span className="mr-1.5 text-xs text-slate-600">{i + 1}.</span>
                    <span className="text-slate-200">{a.handle}</span>
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-slate-500">
                    {a.in_degree} reposts · {formatFollowers(a.followers)}
                  </span>
                </li>
              ))}
              {data.graph.top_amplifiers.length === 0 && (
                <p className="text-sm text-slate-500">Sin reposts detectados.</p>
              )}
            </ol>
          </div>
        </div>
      </div>

      {/* Otras plataformas: primeras cuentas y top engagement */}
      {data.platform_lists.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.platform_lists.map((pl) => (
            <div key={pl.platform} className="card p-4">
              <h3 className="mb-3 font-semibold text-white">{PLATFORM_LABEL[pl.platform]}</h3>
              <h4 className="stat-label mb-1.5">Primeras 10 cuentas en publicar</h4>
              <ol className="mb-4 space-y-1">
                {pl.first_posters.map((f, i) => (
                  <li key={i} className="flex justify-between text-xs">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-slate-300 hover:text-primary"
                    >
                      {i + 1}. {f.handle}
                    </a>
                    <span className="ml-2 shrink-0 text-slate-600">
                      {new Date(f.posted_at).toLocaleDateString("es-MX", { timeZone: "UTC" })}
                    </span>
                  </li>
                ))}
              </ol>
              <h4 className="stat-label mb-1.5">Top 10 por engagement</h4>
              <ol className="space-y-1">
                {pl.top_engagement.map((t, i) => (
                  <li key={i} className="flex justify-between text-xs">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-slate-300 hover:text-primary"
                      title={t.text}
                    >
                      {i + 1}. {t.handle}
                    </a>
                    <span className="ml-2 shrink-0 text-slate-600">
                      {t.engagement.toLocaleString("es-MX")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
