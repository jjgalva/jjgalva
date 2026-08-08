"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Run } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState<"analyze" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .catch(() => {});
  }, []);

  async function launch(demo: boolean) {
    setError(null);
    const kws = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!demo && kws.length === 0) {
      setError("Escribe al menos una keyword, hashtag o mención.");
      return;
    }
    setLoading(demo ? "demo" : "analyze");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demo ? { demo: true } : { keywords: kws }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      router.push(`/run/${data.id}`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="pt-10 pb-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          ¿La campaña es{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            orgánica
          </span>{" "}
          o{" "}
          <span className="bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
            orquestada
          </span>
          ?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          Recolecta evidencia trazable de X, Instagram, TikTok y Facebook; reconstruye la
          cronología, identifica el origen y emite un dictamen con criterios auditables.
        </p>
      </section>

      <section className="card p-6 shadow-glow">
        <label htmlFor="kw" className="stat-label">
          Keywords, hashtags o menciones (separados por coma)
        </label>
        <textarea
          id="kw"
          rows={2}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="#NoAlDesarrolloAltavista, fraude altavista sur, @AltavistaSurMX"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            className="btn-primary flex-1"
            disabled={loading !== null}
            onClick={() => launch(false)}
          >
            {loading === "analyze" ? <Spinner label="Recolectando evidencia…" /> : "Analizar"}
          </button>
          <button
            className="btn-ghost"
            disabled={loading !== null}
            onClick={() => launch(true)}
            title="Corre el análisis con la campaña sintética pre-cargada (sin API keys)"
          >
            {loading === "demo" ? <Spinner label="Cargando caso…" /> : "Cargar caso demo"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Sin token de Apify el sistema usa automáticamente el modo demo con datos sintéticos.
          La recolección real limita resultados por plataforma para cuidar los créditos gratuitos.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="section-title text-base">Corridas anteriores</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aún no hay corridas. Lanza un análisis o carga el caso demo.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => router.push(`/run/${r.id}`)}
                  className="card flex w-full items-center justify-between px-4 py-3 text-left transition hover:border-primary/40"
                >
                  <div>
                    <span className="font-mono text-sm font-semibold text-primary">{r.id}</span>
                    <span className="ml-3 text-sm text-slate-300">{r.keywords.join(", ")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="chip bg-white/[0.05] text-slate-400">
                      {r.mode === "mock" ? "demo" : "apify"}
                    </span>
                    <span>{r.posts_collected} posts</span>
                    <span>{new Date(r.started_at).toLocaleString("es-MX")}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      {label}
    </span>
  );
}
