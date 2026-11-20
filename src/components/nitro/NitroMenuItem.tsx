'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock, Zap } from 'lucide-react';
import { useNitro } from './NitroProvider';

/**
 * Item "Insight Nitro" do menu do topo no celular (onde não há barra lateral).
 * Beta fechada: todos veem que existe; só quem tem acesso entra.
 */
export function NitroMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const { hasAccess } = useNitro();
  const [showHint, setShowHint] = useState(false);

  if (hasAccess) {
    return (
      <Link
        href="/nitro"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-elevated transition-colors"
      >
        <Zap className="w-4 h-4 text-accent" />
        <span className="bg-gradient-to-r from-sky-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
          Insight Nitro
        </span>
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-disabled="true"
        onClick={() => setShowHint((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-muted hover:bg-elevated transition-colors text-left"
      >
        <Zap className="w-4 h-4" />
        <span className="flex-1">Insight Nitro</span>
        <Lock className="w-3.5 h-3.5" />
      </button>
      {showHint && (
        <p role="status" className="px-4 pb-2 text-[11px] text-secondary">
          <span className="font-bold text-primary">Em breve.</span> O Insight Nitro está em beta fechada.
        </p>
      )}
    </div>
  );
}
