'use client';

import Link from 'next/link';
import { NotebookPen, Lock } from 'lucide-react';
import { useNitro } from '@/components/nitro/NitroProvider';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

/**
 * Botão "My Notebook" (barra lateral e menu do celular).
 * Beta fechada: só admin entra; os demais veem o botão bloqueado.
 */
export function NotebookNavItem({
  variant,
  collapsed = false,
  isAdmin,
  active = false,
  onNavigate,
}: {
  variant: 'sidebar' | 'menu';
  collapsed?: boolean;
  isAdmin?: boolean;
  active?: boolean;
  onNavigate?: () => void;
}) {
  const { viewer } = useNitro();
  const allowed = isAdmin ?? viewer?.role === 'admin';

  if (variant === 'menu') {
    const cls = 'flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors';
    const inner = (
      <>
        <NotebookPen className="w-4 h-4 text-secondary" />
        <span className="flex-1 text-primary">{NOTEBOOK_NAME}</span>
        {!allowed && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-elevated text-muted border border-border">
            <Lock className="w-2.5 h-2.5" /> Em breve
          </span>
        )}
      </>
    );
    return allowed ? (
      <Link href="/notebook" onClick={onNavigate} className={`${cls} hover:bg-elevated`}>
        {inner}
      </Link>
    ) : (
      <span aria-disabled="true" title={`${NOTEBOOK_NAME} ainda está em testes fechados`} className={`${cls} opacity-60 cursor-not-allowed`}>
        {inner}
      </span>
    );
  }

  const base = `flex items-center rounded-lg text-sm font-semibold transition-colors ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}`;
  const inner = (
    <>
      <span className="relative shrink-0">
        <NotebookPen className="w-5 h-5" />
        {!allowed && collapsed && <Lock className="w-2.5 h-2.5 absolute -bottom-0.5 -right-1 text-muted" />}
      </span>
      {!collapsed && (
        <>
          <span className="truncate flex-1">{NOTEBOOK_NAME}</span>
          {!allowed && (
            <Lock className="w-3.5 h-3.5 shrink-0 text-muted" aria-label="Em breve" />
          )}
        </>
      )}
    </>
  );

  if (!allowed) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title={`${NOTEBOOK_NAME} — em breve (testes fechados)`}
        className={`${base} text-secondary opacity-60 cursor-not-allowed select-none`}
      >
        {inner}
      </span>
    );
  }
  return (
    <Link
      href="/notebook"
      title={collapsed ? NOTEBOOK_NAME : undefined}
      className={`${base} ${active ? 'bg-surface text-accent border border-border' : 'text-secondary hover:bg-surface hover:text-primary'}`}
    >
      {inner}
    </Link>
  );
}
