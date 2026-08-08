"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AnalysisResult } from "@/lib/types";
import Dictamen from "./Dictamen";
import TimelineView from "./TimelineView";
import VolumeChart from "./VolumeChart";
import DiffusionSection from "./DiffusionSection";
import CoordinationSection from "./CoordinationSection";
import AccountsTable from "./AccountsTable";
import ReportButton from "./ReportButton";

const SECTIONS = [
  ["dictamen", "Dictamen"],
  ["cronologia", "Cronología"],
  ["evolucion", "Evolución"],
  ["difusion", "Difusión"],
  ["coordinacion", "Coordinación"],
  ["cuentas", "Cuentas"],
] as const;

export default function RunView({ id }: { id: string }) {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`/api/run/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Error");
        setData(d);
      })
      .catch((e) => setError(String(e instanceof Error ? e.message : e)));
  }, [id]);

  if (error) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="text-red-300">{error}</p>
        <Link href="/" className="btn-ghost mt-4">
          ← Volver
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
        Calculando análisis…
      </div>
    );
  }

  return (
    <div>
      {/* Encabezado de la corrida */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              Corrida <span className="font-mono text-primary">{data.run.id}</span>
            </h1>
            <span className="chip bg-white/[0.06] text-slate-400">
              {data.run.mode === "mock" ? "modo demo" : "datos Apify"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {data.run.keywords.map((k) => (
              <span key={k} className="mr-2 font-medium text-secondary">
                {k}
              </span>
            ))}
            · {new Date(data.totals.date_range.from).toLocaleDateString("es-MX")} —{" "}
            {new Date(data.totals.date_range.to).toLocaleDateString("es-MX")}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/run/${id}/evidence`} className="btn-ghost" download>
            ⬇ Exportar evidencia
          </a>
          <ReportButton data={data} graphContainerRef={graphRef} />
        </div>
      </div>

      {/* Navegación de secciones */}
      <nav className="sticky top-16 z-30 -mx-6 mb-8 border-b border-white/[0.06] bg-ink-950/80 px-6 py-2 backdrop-blur-xl">
        <div className="flex gap-1 overflow-x-auto">
          {SECTIONS.map(([sid, label]) => (
            <a
              key={sid}
              href={`#${sid}`}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-14">
        <section id="dictamen" className="scroll-mt-32">
          <Dictamen data={data} />
        </section>
        <section id="cronologia" className="scroll-mt-32">
          <h2 className="section-title">Cronología de la campaña</h2>
          <p className="mb-4 text-sm text-slate-500">
            Eventos clave detectados automáticamente: paciente cero, picos, clústeres y amplificadores.
          </p>
          <TimelineView events={data.timeline} />
        </section>
        <section id="evolucion" className="scroll-mt-32">
          <h2 className="section-title">Evolución del volumen</h2>
          <p className="mb-4 text-sm text-slate-500">
            Posts por día y por plataforma. El área rosa marca la porción publicada por cuentas
            sospechosas o coordinadas — el volumen artificial de la conversación.
          </p>
          <VolumeChart volume={data.volume} />
        </section>
        <section id="difusion" className="scroll-mt-32">
          <h2 className="section-title">Difusión</h2>
          <p className="mb-4 text-sm text-slate-500">
            Grafo de reposts en X (tamaño = seguidores, color = score de bot). Para las demás
            plataformas: primeras cuentas en publicar y top por engagement.
          </p>
          <DiffusionSection data={data} graphContainerRef={graphRef} />
        </section>
        <section id="coordinacion" className="scroll-mt-32">
          <h2 className="section-title">Señales de coordinación</h2>
          <p className="mb-4 text-sm text-slate-500">
            Clústeres de textos casi idénticos publicados por cuentas distintas, con sus ráfagas.
          </p>
          <CoordinationSection coordination={data.coordination} />
        </section>
        <section id="cuentas" className="scroll-mt-32">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="section-title">Catálogo de cuentas</h2>
              <p className="text-sm text-slate-500">
                Ordenadas por score de bot; cada score muestra sus razones (criterios auditables).
              </p>
            </div>
            <a href={`/api/run/${id}/evidence`} className="btn-ghost" download>
              ⬇ Exportar evidencia
            </a>
          </div>
          <AccountsTable accounts={data.accounts} />
        </section>
      </div>
    </div>
  );
}
