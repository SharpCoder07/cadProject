import Link from "next/link";
import { Check } from "lucide-react";

/**
 * Partner network map (design concept 07): a hub in the middle, partners around it joined by flowing dashed wires.
 * Teal wires for vendors (software companies), amber wires for resellers. Up to 10 nodes on wide screens, 8 below lg.
 * Nodes pop in when the map comes into view ([data-play] → .is-play, motion.tsx); hovering a node lights its wire.
 */
export type NetworkNode = { name: string; href: string; logo?: string | null; kind: "vendor" | "reseller"; verified?: boolean; sub?: string | null };

// Slot centres in % of the map, filled in pairs (left/right) so a few nodes still look balanced.
const WIDE: [number, number][] = [[14, 20], [86, 21], [17, 81], [84, 82], [12, 51], [88, 52], [36, 12], [64, 89], [64, 12], [36, 89]];
const NARROW: [number, number][] = [[27, 9], [73, 9], [27, 91], [73, 91], [27, 25], [73, 25], [27, 75], [73, 75]];

const wire = (x: number, y: number) => {
  const mx = (x + 50) / 2;
  return `M${x} ${y} C${mx} ${y} ${mx} 50 50 50`;
};

export function PartnerNetwork({ hubTitle, hubSub, nodes, label, verifiedLabel }: { hubTitle: string; hubSub?: string; nodes: NetworkNode[]; label: string; verifiedLabel: string }) {
  const list = nodes.slice(0, WIDE.length);
  return (
    <div data-play role="group" aria-label={label} className="cg-net relative h-[460px] overflow-hidden rounded-[24px] border border-line bg-surface bg-[radial-gradient(rgb(var(--color-ink)/0.07)_1px,transparent_1px)] [background-size:18px_18px] lg:h-[520px]">
      {([["lg:hidden", NARROW], ["hidden lg:block", WIDE]] as const).map(([cls, slots]) => (
        <svg key={cls} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className={`absolute inset-0 h-full w-full ${cls}`}>
          {list.map((n, i) => slots[i] && <path key={i} data-k={i} className={`cg-net-wire ${n.kind === "reseller" ? "is-reseller" : ""}`} style={{ ["--i" as string]: i }} d={wire(slots[i]![0], slots[i]![1])} />)}
        </svg>
      ))}
      <div className="cg-net-hub absolute left-1/2 top-1/2 z-10 flex h-[112px] w-[112px] flex-col items-center justify-center gap-1 rounded-[28px] bg-primary px-2 text-center text-primary-fg [translate:-50%_-50%] lg:h-[150px] lg:w-[150px] lg:rounded-[36px]">
        <span className="line-clamp-2 font-display text-[15px] font-extrabold leading-tight lg:text-[20px]">{hubTitle}</span>
        {hubSub && <span className="text-[10.5px] leading-tight text-primary-fg/80 lg:text-[12px]">{hubSub}</span>}
      </div>
      <ul>
        {list.map((n, i) => {
          const w = WIDE[i]!;
          const s = NARROW[i];
          return (
            <li
              key={n.href}
              data-k={i}
              className={`cg-net-node absolute z-20 left-[var(--nx)] top-[var(--ny)] [translate:-50%_-50%] lg:left-[var(--wx)] lg:top-[var(--wy)] ${s ? "" : "max-lg:hidden"}`}
              style={{ ["--wx" as string]: `${w[0]}%`, ["--wy" as string]: `${w[1]}%`, ["--nx" as string]: `${s?.[0] ?? 50}%`, ["--ny" as string]: `${s?.[1] ?? 50}%`, ["--i" as string]: i }}
            >
              <Link href={n.href} className="flex max-w-[150px] items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3 shadow-[0_14px_28px_-22px_rgb(var(--color-ink)/0.7)] transition hover:border-primary sm:max-w-[190px] lg:max-w-[220px] lg:gap-2.5 lg:pr-3.5">
                {n.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small partner logo
                  <img src={n.logo} alt="" className="h-7 w-7 shrink-0 rounded-full border border-line bg-white object-contain p-0.5 lg:h-8 lg:w-8" />
                ) : (
                  <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold lg:h-8 lg:w-8 lg:text-[12px] ${n.kind === "reseller" ? "bg-accent text-accent-fg" : "bg-primary text-primary-fg"}`}>
                    {n.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-bold text-ink lg:text-[13px]">{n.name}</span>
                  {n.sub && <span className="block truncate text-[10.5px] text-muted">{n.sub}</span>}
                </span>
                {n.verified && (
                  <span className="cg-net-ok grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-fg" title={verifiedLabel}>
                    <Check className="h-2.5 w-2.5" strokeWidth={4} aria-label={verifiedLabel} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
