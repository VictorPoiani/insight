'use client';

/**
 * Anel de Saturno com profundidade: a metade de trás do anel e da órbita fica
 * ATRÁS da foto e a metade da frente por cima — a lua dá a volta em torno do
 * avatar e passa por trás dele.
 * Coordenadas do viewBox 0–100 (avatar: círculo 50,50 r 36.8).
 */

const CX = 50;
const CY = 52;
const RX = 54;
const RY = 13;
const TILT = (-16 * Math.PI) / 180;
const PERIOD = '7s';

function pt(t: number) {
  const x = RX * Math.cos(t);
  const y = RY * Math.sin(t);
  return {
    x: CX + x * Math.cos(TILT) - y * Math.sin(TILT),
    y: CY + x * Math.sin(TILT) + y * Math.cos(TILT),
  };
}

function arc(from: number, to: number, steps = 32) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const p = pt(from + ((to - from) * i) / steps);
    d += `${i ? ' L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

// t ∈ (0, π): metade de baixo = frente; t ∈ (π, 2π): metade de cima = atrás
const FRONT_ARC = arc(0, Math.PI);
const BACK_ARC = arc(Math.PI, Math.PI * 2);
// órbita da lua: um pouco mais larga que o anel, começando na frente
const ORBIT = (() => {
  let d = '';
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const x = (RX + 4) * Math.cos(t);
    const y = (RY + 2) * Math.sin(t);
    const px = CX + x * Math.cos(TILT) - y * Math.sin(TILT);
    const py = CY + x * Math.sin(TILT) + y * Math.cos(TILT);
    d += `${i ? ' L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`;
  }
  return d;
})();

function RingBands({ d }: { d: string }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#2a1640" strokeWidth="4.6" strokeOpacity="0.55" />
      <path d={d} stroke="url(#satBand)" strokeWidth="3.4" />
      <path d={d} stroke="#fff7ed" strokeOpacity="0.55" strokeWidth="0.6" />
    </g>
  );
}

function Moon() {
  return (
    <g>
      <circle r="3.6" fill="url(#satMoon)" stroke="#3b2a4a" strokeWidth="0.6" />
      <circle cx="-1" cy="-0.6" r="0.8" fill="#c9b8a8" />
      <circle cx="1.2" cy="1" r="0.55" fill="#c9b8a8" />
      <circle cx="-1.3" cy="-1.4" r="0.7" fill="#ffffff" fillOpacity="0.8" />
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <linearGradient id="satBand" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="35%" stopColor="#f472b6" />
        <stop offset="70%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
      <radialGradient id="satMoon" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#fffbeb" />
        <stop offset="60%" stopColor="#e7d8c5" />
        <stop offset="100%" stopColor="#9c8a78" />
      </radialGradient>
    </defs>
  );
}

function OrbitingMoon({ side, animated }: { side: 'front' | 'back'; animated: boolean }) {
  if (!animated) {
    if (side === 'back') return null;
    const p = pt(Math.PI * 0.3);
    return (
      <g transform={`translate(${p.x} ${p.y})`}>
        <Moon />
      </g>
    );
  }
  return (
    <g opacity={side === 'front' ? 1 : 0}>
      <animate
        attributeName="opacity"
        values={side === 'front' ? '1;0' : '0;1'}
        keyTimes="0;0.5"
        calcMode="discrete"
        dur={PERIOD}
        repeatCount="indefinite"
      />
      <g>
        <animateMotion dur={PERIOD} repeatCount="indefinite" path={ORBIT} />
        <Moon />
      </g>
    </g>
  );
}

export function SaturnBack({ animated }: { animated: boolean }) {
  return (
    <svg aria-hidden className="nx-deco nx-orn nx-back" viewBox="0 0 100 100" overflow="visible">
      <Defs />
      <RingBands d={BACK_ARC} />
      <OrbitingMoon side="back" animated={animated} />
    </svg>
  );
}

export function SaturnFront({ animated }: { animated: boolean }) {
  return (
    <svg aria-hidden className="nx-deco nx-orn" viewBox="0 0 100 100" overflow="visible">
      <Defs />
      <RingBands d={FRONT_ARC} />
      <OrbitingMoon side="front" animated={animated} />
    </svg>
  );
}
