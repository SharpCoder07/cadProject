"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PRIMARY = "rgb(var(--color-primary))";
const ACCENT = "rgb(var(--color-accent))";
const INK = "rgb(var(--color-ink))";
const LINE = "rgb(var(--color-line))";
const MUTED = "rgb(var(--color-muted))";

const shortDay = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function TrendChart({ data, dataKey, label, color = "primary" }: { data: { day: string; [k: string]: number | string }[]; dataKey: string; label: string; color?: "primary" | "accent" | "ink" }) {
  const stroke = color === "primary" ? PRIMARY : color === "ink" ? INK : ACCENT;
  return (
    <div className="h-56" role="img" aria-label={`${label} per day, last ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={(v) => shortDay(String(v))} formatter={(v: number) => [v, label]} contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12, background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }} />
          <Area type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} fill={`url(#fill-${dataKey})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarChart({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <div style={{ height: Math.max(160, data.length * 34) }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={false} formatter={(v: number) => [v, label]} contentStyle={{ borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12, background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }} />
          {/* Dark mint bars; the bar under the pointer turns amber (the accent colour) so it stands out. */}
          <Bar dataKey="value" fill="rgb(var(--color-mint-ink))" radius={[0, 4, 4, 0]} barSize={18} activeBar={{ fill: "rgb(var(--color-accent))", stroke: "rgb(var(--color-accent))" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
