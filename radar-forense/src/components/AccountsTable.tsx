"use client";

import { useMemo, useState } from "react";
import type { Account, Platform } from "@/lib/types";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/types";
import { classify } from "@/lib/botscore";
import { formatFollowers } from "@/lib/timeline";

export default function AccountsTable({ accounts }: { accounts: Account[] }) {
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () => (platform === "all" ? accounts : accounts.filter((a) => a.platform === platform)),
    [accounts, platform]
  );

  return (
    <div className="card overflow-hidden">
      {/* Filtro por plataforma */}
      <div className="flex gap-1 border-b border-white/[0.06] px-4 py-3">
        {(["all", ...PLATFORMS] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
              platform === p
                ? "bg-primary text-white"
                : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {p === "all" ? "Todas" : PLATFORM_LABEL[p]}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-slate-500">
          {filtered.length} cuentas
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5">Cuenta</th>
              <th className="px-4 py-2.5">Plataforma</th>
              <th className="px-4 py-2.5 text-right">Seguidores</th>
              <th className="px-4 py-2.5 text-right">Antigüedad</th>
              <th className="px-4 py-2.5 text-right">Posts</th>
              <th className="px-4 py-2.5">Score de bot</th>
              <th className="px-4 py-2.5">Clúster</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const key = `${a.platform}:${a.handle}`;
              const verdict = classify(a.bot_score);
              return (
                <FragmentRow
                  key={key}
                  a={a}
                  verdict={verdict}
                  expanded={expanded === key}
                  onToggle={() => setExpanded(expanded === key ? null : key)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  a,
  verdict,
  expanded,
  onToggle,
}: {
  a: Account;
  verdict: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const scoreColor =
    a.bot_score > 60 ? "bg-red-500" : a.bot_score > 30 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.02]"
      >
        <td className="px-4 py-2.5 font-medium text-white">{a.handle}</td>
        <td className="px-4 py-2.5 text-slate-400">{PLATFORM_LABEL[a.platform]}</td>
        <td className="px-4 py-2.5 text-right text-slate-300">
          {formatFollowers(a.followers)}
        </td>
        <td className="px-4 py-2.5 text-right text-slate-400">
          {a.account_age_days !== null ? `${a.account_age_days} d` : "—"}
        </td>
        <td className="px-4 py-2.5 text-right text-slate-300">{a.posts_in_dataset}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]">
              <div className={`h-full ${scoreColor}`} style={{ width: `${a.bot_score}%` }} />
            </div>
            <span className="w-7 text-right font-mono text-xs text-white">{a.bot_score}</span>
            <span
              className={`chip ${
                a.bot_score > 60
                  ? "bg-red-500/15 text-red-300"
                  : a.bot_score > 30
                    ? "bg-amber-400/15 text-amber-300"
                    : "bg-emerald-400/15 text-emerald-300"
              }`}
            >
              {verdict}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          {a.coordination_cluster_id !== null ? (
            <span className="chip bg-secondary/15 text-secondary">
              #{a.coordination_cluster_id}
            </span>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/[0.04] bg-ink-950/60">
          <td colSpan={7} className="px-6 py-3">
            {a.bot_flags.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
                {a.bot_flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">
                Sin señales de automatización con los criterios configurados.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
