"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { VolumePoint } from "@/lib/types";

const PLATFORM_COLORS = {
  x: "#E2E8F0",
  instagram: "#FF66E5",
  tiktok: "#22D3EE",
  facebook: "#60A5FA",
} as const;

export default function VolumeChart({ volume }: { volume: VolumePoint[] }) {
  return (
    <div className="card p-4">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={volume} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748B", fontSize: 11 }}
              tickFormatter={(d: string) => d.slice(5)}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#15152A",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "#fff", fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="suspicious"
              name="Cuentas sospechosas/bot"
              fill="rgba(244,63,94,0.25)"
              stroke="#F43F5E"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <Line
              type="monotone"
              dataKey="x"
              name="X (Twitter)"
              stroke={PLATFORM_COLORS.x}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="instagram"
              name="Instagram"
              stroke={PLATFORM_COLORS.instagram}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="tiktok"
              name="TikTok"
              stroke={PLATFORM_COLORS.tiktok}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="facebook"
              name="Facebook"
              stroke={PLATFORM_COLORS.facebook}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
