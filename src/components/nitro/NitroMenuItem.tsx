'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { useNitro } from './NitroProvider';

/**
 * Item "Insight Nitro" do menu do topo no celular (onde não há barra lateral).
 * Todos entram na galeria e nos planos; só quem tem acesso aplica.
 */
export function NitroMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const { hasAccess } = useNitro();
  return (
    <Link
      href="/nitro"
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-elevated transition-colors"
    >
      <Zap className="w-4 h-4 text-accent" />
      <span className="flex-1 bg-gradient-to-r from-sky-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
        Insight Nitro
      </span>
      {!hasAccess && (
        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-400">
          Novo
        </span>
      )}
    </Link>
  );
}
