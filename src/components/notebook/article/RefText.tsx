import type { Seg } from '@/lib/notebook/sources';

/** Referência formatada (negrito/itálico conforme a norma). */
export function RefText({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) => (s.b ? <strong key={i}>{s.t}</strong> : s.i ? <em key={i}>{s.t}</em> : <span key={i}>{s.t}</span>))}
    </>
  );
}
