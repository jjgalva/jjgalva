"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { AnalysisResult } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/types";

export default function Dictamen({ data }: { data: AnalysisResult }) {
  const v = data.coordination.verdict;
  const donut = [
    { name: "Coordinado / automatizado", value: v.coordinated_pct },
    { name: "Orgánico", value: v.organic_pct },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Dictamen</h2>
        <p className="text-xs text-slate-400">
          Actividad ponderada por engagement · confianza{" "}
          <span
            className={
              v.confidence === "alta"
                ? "font-semibold text-emerald-400"
                : v.confidence === "media"
                  ? "font-semibold text-amber-400"
                  : "font-semibold text-red-400"
            }
          >
            {v.confidence}
          </span>
        </p>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[280px_1fr]">
        {/* Donut */}
        <div className="relative mx-auto h-56 w-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donut}
                dataKey="value"
                innerRadius={72}
                outerRadius={100}
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                <Cell fill="#FF66E5" />
                <Cell fill="#7366FE" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold text-secondary">{v.coordinated_pct}%</span>
            <span className="max-w-[120px] text-center text-[11px] leading-tight text-slate-400">
              coordinado / automatizado
            </span>
          </div>
        </div>

        {/* Justificación + stats */}
        <div>
          <div className="mb-4 flex flex-wrap gap-3 text-xs">
            <span className="chip bg-secondary/15 text-secondary">
              ● {v.coordinated_pct}% coordinado
            </span>
            <span className="chip bg-primary/15 text-primary">● {v.organic_pct}% orgánico</span>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-300">{v.justification}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Posts analizados" value={String(data.totals.posts)} />
            <StatCard
              label="Plataformas"
              value={String(data.totals.platforms.length)}
              hint={data.totals.platforms.map((p) => PLATFORM_LABEL[p].split(" ")[0]).join(" · ")}
            />
            <StatCard label="Clústeres de coordinación" value={String(data.totals.clusters)} accent />
            <StatCard
              label="Cuentas probable bot"
              value={String(data.totals.bot_accounts)}
              hint={`+ ${data.totals.suspicious_accounts} sospechosas`}
              accent
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-950/60 p-4">
      <div className={`text-2xl font-extrabold ${accent ? "text-secondary" : "text-white"}`}>
        {value}
      </div>
      <div className="stat-label mt-1">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
