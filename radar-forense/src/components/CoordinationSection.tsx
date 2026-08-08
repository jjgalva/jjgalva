"use client";

import type { CoordinationResult } from "@/lib/types";

export default function CoordinationSection({
  coordination,
}: {
  coordination: CoordinationResult;
}) {
  const { clusters, account_creation_burst, amplification_only_accounts } = coordination;

  if (clusters.length === 0) {
    return (
      <div className="card p-6 text-sm text-slate-400">
        No se detectaron clústeres de coordinación con los criterios configurados
        (similitud &gt; 0.85 entre 3+ cuentas distintas).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Señales globales */}
      <div className="grid gap-3 sm:grid-cols-2">
        {account_creation_burst.detected && (
          <div className="card border-secondary/30 p-4">
            <h4 className="stat-label mb-1 text-secondary">Ráfaga de creación de cuentas</h4>
            <p className="text-sm text-slate-300">
              <span className="font-bold text-white">
                {account_creation_burst.accounts.length} cuentas
              </span>{" "}
              participantes fueron creadas entre el{" "}
              {fmtDate(account_creation_burst.window_start)} y el{" "}
              {fmtDate(account_creation_burst.window_end)} — un patrón típico de granjas de
              cuentas.
            </p>
          </div>
        )}
        {amplification_only_accounts.length > 0 && (
          <div className="card p-4">
            <h4 className="stat-label mb-1">Amplificación pura</h4>
            <p className="text-sm text-slate-300">
              <span className="font-bold text-white">
                {amplification_only_accounts.length} cuentas
              </span>{" "}
              solo existen en el dataset para repostear (0 publicaciones originales).
            </p>
          </div>
        )}
      </div>

      {/* Tarjetas por clúster */}
      {clusters.map((c) => (
        <div key={c.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-secondary/[0.06] px-5 py-3">
            <h3 className="font-bold text-white">
              Clúster #{c.id}
              <span className="ml-2 text-sm font-normal text-slate-400">
                {c.accounts.length} cuentas · {c.post_count} posts casi idénticos
              </span>
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {c.bursts.map((b, i) => (
                <span key={i} className="chip bg-red-500/15 text-red-300">
                  ⚡ ráfaga: {b.posts} posts en {Math.max(b.minutes, 1)} min (
                  {fmtDateTime(b.start)})
                </span>
              ))}
              {c.bursts.length === 0 && (
                <span className="chip bg-white/[0.06] text-slate-400">sin ráfaga detectada</span>
              )}
            </div>
          </div>

          {/* Textos calcados lado a lado */}
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {c.sample_texts.map((s, i) => (
              <blockquote
                key={i}
                className="rounded-xl border border-white/[0.06] bg-ink-950/60 p-3 text-[13px] leading-snug"
              >
                <p className="text-slate-300">“{s.text}”</p>
                <footer className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-secondary hover:underline"
                  >
                    {s.handle}
                  </a>
                  <span>{fmtDateTime(s.posted_at)}</span>
                </footer>
              </blockquote>
            ))}
          </div>

          <div className="border-t border-white/[0.06] px-5 py-2.5 text-xs text-slate-500">
            Cuentas: {c.accounts.map((a) => a.split(":")[1]).join(", ")}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "—";
}
function fmtDateTime(iso: string): string {
  return (
    new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}
