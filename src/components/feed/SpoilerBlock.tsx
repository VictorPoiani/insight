'use client';

import { useState } from 'react';
import { EyeOff, Eye } from 'lucide-react';

/**
 * Bloco marcado pelo autor como "Contém spoiler": fica desfocado até a pessoa
 * tocar em "Mostrar". Dá para esconder de novo.
 */
export function SpoilerBlock({ style, children }: { style?: React.CSSProperties; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={style} className="relative min-w-0">
      <div
        aria-hidden={!shown}
        className={`transition-[filter] duration-300 ${shown ? '' : 'blur-xl select-none pointer-events-none'}`}
      >
        {children}
      </div>
      {!shown ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShown(true);
          }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-black/25 hover:bg-black/15 transition-colors text-white"
        >
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur text-xs font-bold shadow-lg">
            <EyeOff className="w-3.5 h-3.5" /> Contém spoiler
          </span>
          <span className="text-[11px] font-semibold drop-shadow">Toque para mostrar</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShown(false);
          }}
          title="Esconder spoiler"
          aria-label="Esconder spoiler"
          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-black/60 text-white/80 hover:text-white"
        >
          <Eye className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
