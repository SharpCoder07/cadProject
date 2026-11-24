"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader } from "@/components/ui/misc";

type Day = { day: string; leads: number; views: number };

const RED = "rgb(var(--color-primary))";
const LINE = "rgb(var(--color-line))";
const MUTED = "rgb(var(--color-muted))";
const nf = new Intl.NumberFormat("en-IN");
const short = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const long = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function RangeSwitch<T extends number>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-bg p-0.5 ring-1 ring-line" role="group" aria-label="Date range">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={cn("rounded-md px-2.5 py-1 text-xs font-semibold transition-colors", o === value ? "bg-surface text-ink shadow-[0_1px_2px_rgb(16_24_40/0.12)]" : "text-muted hover:text-ink")}
        >
          {o}d
        </button>
      ))}
    </div>
  );
}

function Change({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", up ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
      {up ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function TipCard({ title, value, label }: { title: string; value: number; label: string }) {
  return (
    <div className="rounded-xl bg-action px-3 py-2 text-action-fg shadow-lg">
      <p className="text-[11px] opacity-60">{title}</p>
      <p className="text-sm font-semibold">
        {nf.format(value)} {label}
      </p>
    </div>
  );
}

function Headline({ value, label, change }: { value: number; label: string; change?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-2xl font-bold leading-none tabular-nums text-ink">{nf.format(value)}</span>
      <span className="text-sm text-muted">{label}</span>
      {change}
    </div>
  );
}

/** Leads per day: dark-mint bars with hover tooltips; the hovered bar turns amber (as in Lead reports). */
export function LeadsChart({ trend }: { trend: Day[] }) {
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [hover, setHover] = useState<number | null>(null);
  const data = trend.slice(-range);
  const prev = trend.slice(-range * 2, -range);
  const total = data.reduce((n, d) => n + d.leads, 0);
  const prevTotal = prev.length === range ? prev.reduce((n, d) => n + d.leads, 0) : 0;
  return (
    <Panel>
      <PanelHeader title="Leads per day" description="Spam excluded" actions={<RangeSwitch value={range} options={[7, 14, 30]} onChange={setRange} />} />
      <div className="p-5">
        <Headline value={total} label={`leads in the last ${range} days`} change={<Change now={total} before={prevTotal} />} />
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} onMouseMove={(s) => setHover(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)} onMouseLeave={() => setHover(null)}>
              <CartesianGrid stroke={LINE} vertical={false} strokeDasharray="3 4" />
              <XAxis dataKey="day" tickFormatter={short} tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgb(var(--color-ink) / 0.04)", radius: 6 }} content={({ active, payload }) => (active && payload?.[0] ? <TipCard title={long(String(payload[0].payload.day))} value={Number(payload[0].value)} label="leads" /> : null)} />
              <Bar dataKey="leads" radius={[6, 6, 0, 0]} maxBarSize={28} animationDuration={500}>
                {data.map((d, i) => (
                  <Cell key={d.day} fill={hover === i ? "rgb(var(--color-accent))" : "rgb(var(--color-mint-ink))"} fillOpacity={hover === null || hover === i ? 1 : 0.4} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  );
}

/** Product page views: smooth red area with a tooltip that follows the cursor. */
export function ViewsChart({ trend }: { trend: Day[] }) {
  const [range, setRange] = useState<7 | 30>(30);
  const data = trend.slice(-range);
  const prev = trend.slice(-range * 2, -range);
  const total = data.reduce((n, d) => n + d.views, 0);
  const prevTotal = prev.length === range ? prev.reduce((n, d) => n + d.views, 0) : 0;
  return (
    <Panel>
      <PanelHeader title="Product page views" description="How often product pages were opened" actions={<RangeSwitch value={range} options={[7, 30]} onChange={setRange} />} />
      <div className="p-5">
        <Headline value={total} label={`views in the last ${range} days`} change={<Change now={total} before={prevTotal} />} />
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="views-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={LINE} vertical={false} strokeDasharray="3 4" />
              <XAxis dataKey="day" tickFormatter={short} tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ stroke: RED, strokeWidth: 1, strokeDasharray: "4 4" }} content={({ active, payload }) => (active && payload?.[0] ? <TipCard title={long(String(payload[0].payload.day))} value={Number(payload[0].value)} label="views" /> : null)} />
              <Area type="monotone" dataKey="views" stroke={RED} strokeWidth={2.5} fill="url(#views-fill)" activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: RED }} animationDuration={500} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  );
}

const SLICE = [RED, "#2DD4BF", "#F59E0B", "#059669", "#E35D7F", "#9CA3AF"];

/** Most enquired products: donut + legend. Hovering either highlights the product and shows its numbers in the centre. */
export function EnquiriesDonut({ items }: { items: { id: string; name: string; enquiryCount: number; viewCount: number }[] }) {
  const data = useMemo(() => items.filter((i) => i.enquiryCount > 0), [items]);
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((n, d) => n + d.enquiryCount, 0);
  const current = active !== null ? data[active] : undefined;
  return (
    <Panel>
      <PanelHeader title="Most enquired products" description="Share of product enquiries (1 lead counts once per product it asks about)" />
      {data.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">No product enquiries yet.</p>
      ) : (
        <div className="p-5">
          <div className="relative mx-auto h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="enquiryCount" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} cornerRadius={4} stroke="none" onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)} animationDuration={500}>
                  {data.map((d, i) => (
                    <Cell key={d.id} fill={SLICE[i % SLICE.length]} fillOpacity={active === null || active === i ? 1 : 0.25} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-2xl font-bold tabular-nums text-ink">{nf.format(current ? current.enquiryCount : total)}</p>
                <p className="max-w-[7rem] truncate text-xs text-muted">{current ? current.name : "enquiries"}</p>
              </div>
            </div>
          </div>
          <ul className="mt-5 space-y-1">
            {data.map((d, i) => (
              <li key={d.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors", active === i ? "bg-bg" : "hover:bg-bg")}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLICE[i % SLICE.length] }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
                  <span className="text-xs text-muted">{Math.round((d.enquiryCount / total) * 100)}%</span>
                  <span className="w-8 text-right font-semibold tabular-nums">{nf.format(d.enquiryCount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
