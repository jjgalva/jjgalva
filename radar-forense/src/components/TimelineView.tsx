"use client";

import type { TimelineEvent } from "@/lib/types";

const TYPE_STYLE: Record<
  TimelineEvent["type"],
  { color: string; bg: string; label: string; icon: string }
> = {
  paciente_cero: { color: "text-amber-300", bg: "bg-amber-400", label: "Paciente cero", icon: "◉" },
  pico: { color: "text-primary", bg: "bg-primary", label: "Pico de volumen", icon: "▲" },
  cluster: { color: "text-secondary", bg: "bg-secondary", label: "Clúster", icon: "⬢" },
  amplificador: { color: "text-cyan-300", bg: "bg-cyan-400", label: "Amplificador", icon: "◈" },
};

export default function TimelineView({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No se detectaron eventos.</p>;
  }
  return (
    <ol className="relative ml-3 space-y-6 border-l border-white/10 pl-8">
      {events.map((e, i) => {
        const s = TYPE_STYLE[e.type];
        return (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[41px] top-1 flex h-6 w-6 items-center justify-center rounded-full ${s.bg} text-[11px] text-ink-950 shadow-lg`}
            >
              {s.icon}
            </span>
            <div className="card px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`font-semibold uppercase tracking-wider ${s.color}`}>
                  {s.label}
                </span>
                <span className="text-slate-500">
                  {new Date(e.at).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </span>
              </div>
              <p className="mt-1 font-medium text-white">{e.title}</p>
              <p className="mt-0.5 text-sm text-slate-400">{e.description}</p>
              {e.url && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  Ver post de referencia ↗
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
