import type { PropertyType } from '@jpt/shared';

/**
 * Deterministic architectural illustrations for DEMO listings.
 * They are drawings, not photographs, so nobody mistakes a fictional listing
 * for a real building. The single vermilion element marks "your share".
 */

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const INK = '#17181c';
const LINE = '#c9c5bc';
const WASHI = '#f5f4f1';
const PAPER = '#ffffff';
const SHU = '#bc2c31';
const SKY = '#ebe9e4';

type Variant = 'elevation' | 'plan' | 'area';

interface Props {
  slug: string;
  type: PropertyType;
  variant?: Variant;
  className?: string;
  title: string;
}

export function PropertyArt({ slug, type, variant = 'elevation', className, title }: Props) {
  const r = rng(`${slug}:${variant}`);
  return (
    <svg viewBox="0 0 400 260" className={className} role="img" aria-label={title} preserveAspectRatio="xMidYMid slice">
      <title>{title}</title>
      <rect width="400" height="260" fill={WASHI} />
      {variant === 'elevation' && <Elevation type={type} r={r} />}
      {variant === 'plan' && <Plan r={r} type={type} />}
      {variant === 'area' && <Area r={r} />}
    </svg>
  );
}

function Neighbours({ r }: { r: () => number }) {
  const items = [];
  let x = -10;
  while (x < 410) {
    const w = 40 + r() * 50;
    const h = 60 + r() * 90;
    items.push(<rect key={x} x={x} y={220 - h} width={w} height={h} fill={SKY} />);
    x += w + 6;
  }
  return <g>{items}</g>;
}

function Elevation({ type, r }: { type: PropertyType; r: () => number }) {
  const ground = <line x1="0" y1="220.5" x2="400" y2="220.5" stroke={INK} strokeWidth="1" />;
  if (type === 'APARTMENT' || type === 'RESIDENTIAL_BUILDING') {
    const floors = type === 'APARTMENT' ? 9 + Math.floor(r() * 5) : 4 + Math.floor(r() * 3);
    const cols = type === 'APARTMENT' ? 4 : 3;
    const floorH = Math.min(18, 170 / floors);
    const w = cols * 34 + 16;
    const x0 = 200 - w / 2;
    const top = 220 - floors * floorH - 8;
    const mineFloor = Math.floor(r() * (floors - 2)) + 1;
    const mineCol = Math.floor(r() * cols);
    const cells = [];
    for (let f = 0; f < floors; f++) {
      const y = 220 - (f + 1) * floorH;
      cells.push(<line key={`s${f}`} x1={x0} y1={y + floorH - 0.5} x2={x0 + w} y2={y + floorH - 0.5} stroke={LINE} strokeWidth="1" />);
      for (let c = 0; c < cols; c++) {
        const mine = f === mineFloor && c === mineCol && type === 'APARTMENT';
        cells.push(
          <rect key={`${f}-${c}`} x={x0 + 10 + c * 34} y={y + 3} width={26} height={floorH - 7}
            fill={mine ? SHU : PAPER} stroke={mine ? SHU : INK} strokeWidth="0.75" />,
        );
      }
    }
    return (
      <g>
        <Neighbours r={r} />
        <rect x={x0} y={top} width={w} height={220 - top} fill={PAPER} stroke={INK} strokeWidth="1.25" />
        <rect x={x0 - 4} y={top - 4} width={w + 8} height={6} fill={INK} />
        {cells}
        {type === 'RESIDENTIAL_BUILDING' && (
          <rect x={x0 + w / 2 - 9} y={206} width={18} height={14} fill={SHU} />
        )}
        {ground}
      </g>
    );
  }
  if (type === 'COMMERCIAL') {
    const floors = 5;
    const fh = 26;
    const w = 190;
    const x0 = 105;
    const top = 220 - floors * fh;
    const rows = [];
    for (let f = 1; f < floors; f++) {
      const y = 220 - (f + 1) * fh;
      rows.push(<rect key={f} x={x0 + 10} y={y + 5} width={w - 20} height={fh - 10} fill={PAPER} stroke={INK} strokeWidth="0.75" />);
      for (let m = 1; m < 6; m++) rows.push(<line key={`${f}m${m}`} x1={x0 + 10 + m * 28.3} y1={y + 5} x2={x0 + 10 + m * 28.3} y2={y + fh - 5} stroke={LINE} />);
    }
    return (
      <g>
        <Neighbours r={r} />
        <rect x={x0} y={top} width={w} height={220 - top} fill={PAPER} stroke={INK} strokeWidth="1.25" />
        {rows}
        <rect x={x0 + 6} y={220 - fh + 4} width={w - 12} height={fh - 4} fill={INK} />
        <rect x={x0 + 14} y={220 - fh + 9} width={60} height={fh - 9} fill={SHU} />
        <rect x={x0 + w - 18} y={top + 16} width={10} height={70} fill={SHU} />
        {ground}
      </g>
    );
  }
  // Houses, machiya, nagaya, akiya: gabled roof with tile courses and lattice.
  const w = type === 'VACATION_HOME' ? 230 : 180;
  const x0 = 200 - w / 2;
  const wall = 74 + r() * 10;
  const eave = 220 - wall;
  const ridge = eave - 46;
  const tiles = [];
  for (let i = 1; i < 6; i++) {
    const y = ridge + ((eave - ridge) * i) / 6;
    const inset = ((eave - y) / (eave - ridge)) * (w / 2 - 10);
    tiles.push(<line key={i} x1={x0 - 10 + inset} y1={y} x2={x0 + w + 10 - inset} y2={y} stroke={INK} strokeWidth="0.6" opacity={type === 'AKIYA' && i === 3 ? 0.15 : 0.55} />);
  }
  const lattice = [];
  for (let i = 0; i < 16; i++) {
    lattice.push(<line key={i} x1={x0 + 24 + i * 5} y1={eave + 18} x2={x0 + 24 + i * 5} y2={eave + 58} stroke={INK} strokeWidth="1" />);
  }
  return (
    <g>
      <Neighbours r={r} />
      <path d={`M${x0 - 12} ${eave} L200 ${ridge} L${x0 + w + 12} ${eave} Z`} fill={PAPER} stroke={INK} strokeWidth="1.25" />
      {tiles}
      <rect x={x0} y={eave} width={w} height={wall} fill={PAPER} stroke={INK} strokeWidth="1.25" />
      <rect x={x0 + 20} y={eave + 14} width={86} height={48} fill="none" stroke={INK} strokeWidth="1" />
      {lattice}
      {/* noren curtain at the entrance: the accent */}
      <rect x={x0 + w - 70} y={eave + 14} width={44} height={wall - 14} fill={PAPER} stroke={INK} strokeWidth="1" />
      <path d={`M${x0 + w - 70} ${eave + 14} h44 v22 h-22 v-6 h0 v6 h-22 z`} fill={SHU} />
      {type === 'AKIYA' && (
        <g stroke={INK} strokeWidth="0.75" opacity="0.5">
          <path d={`M${x0 + 140} ${eave + 30} l8 10 l-4 8`} fill="none" />
          <line x1={x0 + 26} y1={eave - 4} x2={x0 + 60} y2={eave - 14} />
        </g>
      )}
      {ground}
    </g>
  );
}

function Plan({ r, type }: { r: () => number; type: PropertyType }) {
  const split = 150 + r() * 60;
  const rooms = type === 'APARTMENT' ? 2 : 3;
  return (
    <g fill="none" stroke={INK}>
      <rect x="60" y="40" width="280" height="180" fill={PAPER} strokeWidth="3" />
      <line x1={split} y1="40" x2={split} y2="220" strokeWidth="1.5" />
      {Array.from({ length: rooms - 1 }, (_, i) => (
        <line key={i} x1={split} y1={40 + (180 / rooms) * (i + 1)} x2="340" y2={40 + (180 / rooms) * (i + 1)} strokeWidth="1.5" />
      ))}
      <path d={`M${split - 30} 220 a30 30 0 0 1 30 -30`} strokeWidth="1" stroke={LINE} />
      <rect x="72" y="52" width="36" height="20" stroke={LINE} />
      {/* tatami pattern in the first room */}
      <g stroke={LINE}>
        <rect x={split + 14} y="54" width="40" height="20" />
        <rect x={split + 54} y="54" width="20" height="40" />
      </g>
      <rect x={split + 8} y={200} width={28} height={10} fill={SHU} stroke="none" />
    </g>
  );
}

function Area({ r }: { r: () => number }) {
  const streets = [];
  for (let i = 0; i < 7; i++) {
    const y = 20 + i * 38 + r() * 10;
    streets.push(<line key={`h${i}`} x1="0" y1={y} x2="400" y2={y + (r() - 0.5) * 30} stroke={PAPER} strokeWidth={i === 3 ? 9 : 4} />);
  }
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 48 + r() * 10;
    streets.push(<line key={`v${i}`} x1={x} y1="0" x2={x + (r() - 0.5) * 40} y2="260" stroke={PAPER} strokeWidth={i === 4 ? 8 : 4} />);
  }
  return (
    <g>
      <rect width="400" height="260" fill={SKY} />
      {streets}
      <path d="M0 200 C 120 170, 220 240, 400 190" stroke="#c9d3e3" strokeWidth="14" fill="none" />
      <line x1="0" y1="60" x2="400" y2="110" stroke={INK} strokeWidth="3" strokeDasharray="10 6" />
      <circle cx="200" cy="130" r="62" fill={SHU} fillOpacity="0.08" stroke={SHU} strokeDasharray="4 4" />
      <circle cx="200" cy="130" r="5" fill={SHU} />
      <rect x={120 + r() * 40} y="74" width="16" height="10" fill={INK} />
    </g>
  );
}
