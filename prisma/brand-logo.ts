/**
 * Original logos for the demo brands (they are invented companies, so there is no real logo to use).
 * Each brand gets a geometric mark in its own colour plus a two-tone wordmark, picked
 * deterministically from the brand slug so re-running the seed gives the same logo.
 */

const PALETTE = ["#047857", "#0F766E", "#BE123C", "#EA580C", "#4D7C0F", "#16A34A", "#DB2777", "#B45309", "#B45309", "#0D9488", "#9D174D", "#DC2626"];
const INK = "#111827";

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Marks drawn in a 100×100 box. `c` is the brand colour. */
const MARKS: ((c: string) => string)[] = [
  // Overlapping rings on a tile
  (c) => `<rect width="100" height="100" rx="24" fill="${c}"/><circle cx="40" cy="50" r="20" fill="none" stroke="#fff" stroke-width="9"/><circle cx="60" cy="50" r="20" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="9"/>`,
  // Rising bars
  (c) => `<rect width="100" height="100" rx="24" fill="${c}"/><rect x="24" y="52" width="13" height="26" rx="4" fill="#fff" fill-opacity="0.6"/><rect x="44" y="38" width="13" height="40" rx="4" fill="#fff" fill-opacity="0.8"/><rect x="64" y="22" width="13" height="56" rx="4" fill="#fff"/>`,
  // Hexagon with inner hexagon
  (c) => `<path d="M50 4 90 27v46L50 96 10 73V27z" fill="${c}"/><path d="M50 28 69 39v22L50 72 31 61V39z" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>`,
  // Four petals
  (c) => `<path d="M48 48H12A36 36 0 0 1 48 12z" fill="${c}"/><path d="M52 48V12a36 36 0 0 1 36 36z" fill="${c}" fill-opacity="0.75"/><path d="M52 52h36a36 36 0 0 1-36 36z" fill="${c}"/><path d="M48 52v36a36 36 0 0 1-36-36z" fill="${c}" fill-opacity="0.55"/>`,
  // Diamond with dot
  (c) => `<rect x="17" y="17" width="66" height="66" rx="14" transform="rotate(45 50 50)" fill="${c}"/><circle cx="50" cy="50" r="13" fill="#fff"/>`,
  // Chevron in a circle
  (c) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M36 30 58 50 36 70" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M56 30 78 50 56 70" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Stacked layers
  (c) => `<path d="M50 14 88 34 50 54 12 34z" fill="${c}"/><path d="M12 50 50 70 88 50" fill="none" stroke="${c}" stroke-opacity="0.7" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 66 50 86 88 66" fill="none" stroke="${c}" stroke-opacity="0.45" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>`,
  // Initial in a squircle with a corner notch
  (c) => `<rect width="100" height="100" rx="30" fill="${c}"/><circle cx="78" cy="22" r="10" fill="#fff" fill-opacity="0.85"/>`,
];

/** Returns an SVG wordmark logo (transparent background) and its pixel size. */
/** Hand-assigned [mark, colour] for the demo brands so no two look alike; others fall back to a hash. */
const ASSIGNED: Record<string, [number, number]> = {
  ledgerline: [2, 0], kanakku: [0, 1], peoplefirst: [1, 2], "saarthi-cloud": [5, 3], "udyog-systems": [6, 4], "dukaan-byte": [3, 6],
  "tarang-digital": [4, 7], "arogya-informatics": [7, 5], "vidyaa-tech": [1, 8], "kavach-secure": [2, 11], "sangam-workspace": [3, 10], "godown-pro": [7, 9],
  "vectrix-systems": [5, 0], "planora-technologies": [6, 1], "axiom-cad-labs": [4, 2], "opensketch-foundation": [0, 3], "formwise-software": [7, 6],
};

export function brandLogoSvg(name: string, slug: string) {
  const h = hash(slug);
  const [m, p] = ASSIGNED[slug.replace(/^vendor-/, "")] ?? [(h >>> 4) % MARKS.length, h % PALETTE.length];
  const colour = PALETTE[p % PALETTE.length]!;
  const markIndex = m % MARKS.length;
  let mark = MARKS[markIndex]!(colour);
  if (markIndex === MARKS.length - 1) {
    const initial = esc(name.trim().charAt(0).toUpperCase());
    mark += `<text x="45" y="53" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="58" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central">${initial}</text>`;
  }

  // Two-tone wordmark: first word in ink, the rest in the brand colour.
  const words = name.trim().split(/\s+/);
  const first = esc(words[0] ?? name);
  const rest = esc(words.slice(1).join(" "));
  const fontSize = 46;
  const chars = name.length;
  const textWidth = Math.ceil(chars * fontSize * 0.56);
  const width = 120 + 24 + textWidth + 16;
  const height = 120;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g transform="translate(10 10)">${mark}</g>
  <text x="${120 + 14}" y="${height / 2}" dominant-baseline="central" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${fontSize}" letter-spacing="-0.5">
    <tspan font-weight="800" fill="${INK}">${first}</tspan>${rest ? `<tspan dx="12" font-weight="500" fill="${colour}">${rest}</tspan>` : ""}
  </text>
</svg>`;
  return { svg, width, height };
}
