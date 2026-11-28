'use client';

import Link from 'next/link';
import { InsightAsterisk } from '@/components/brand/InsightAsterisk';

/** Tela de status (404, erro) com a cara do Insight. */
export function StatusPage({
  code,
  title,
  message,
  action,
}: {
  code: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-6 inline-flex w-16 h-16" aria-hidden>
        <InsightAsterisk fill="gradient" className="w-full h-full opacity-90" />
      </span>
      <p className="text-xs font-mono font-semibold tracking-widest text-muted">{code}</p>
      <h1 className="mt-2 text-xl sm:text-2xl font-extrabold text-primary">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-secondary leading-relaxed">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {action}
        <Link href="/" className="px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-bold">
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
