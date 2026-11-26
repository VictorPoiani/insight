'use client';

import { useState } from 'react';
import { CheckCircle2, Download, Loader2, X, XCircle } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { exportFormats, exportItem, type ExportFormat, type ImportResult } from '@/lib/notebook/interop';

function Shell({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center p-4 bg-black/55 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] shadow-2xl nb-cs-in">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--nb-hl)]">{kicker}</p>
            <p className="mt-0.5 text-[15px] font-extrabold truncate">{title}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Escolha do formato de exportação de um item. */
export function ExportDialog({ item, api, onClose }: { item: NotebookItem; api: NotebookApi; onClose: () => void }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Shell title={item.title} kicker="Exportar" onClose={onClose}>
      <div className="space-y-1.5">
        {exportFormats(item).map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={!!busy}
            onClick={async () => {
              setBusy(f.id);
              setError(null);
              try {
                await exportItem(item, f.id, api);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Não foi possível exportar.');
              }
              setBusy(null);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--nb-line)] hover:border-[var(--nb-hl)] text-left disabled:opacity-60 transition-colors"
          >
            <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg bg-[var(--nb-pane-2)] text-[var(--nb-ink-2)]">
              {busy === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold">{f.label}</span>
              <span className="block text-[12px] text-[var(--nb-ink-3)] truncate">{f.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}
    </Shell>
  );
}

/** Resumo do que foi importado. */
export function ImportResultDialog({ result, onOpen, onClose }: { result: ImportResult | 'busy'; onOpen: (id: string) => void; onClose: () => void }) {
  if (result === 'busy') {
    return (
      <Shell title="Lendo os arquivos…" kicker="Importar" onClose={() => {}}>
        <div className="flex items-center gap-2 text-[13px] text-[var(--nb-ink-2)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Convertendo para o Notebook. Isso leva alguns segundos.
        </div>
      </Shell>
    );
  }
  return (
    <Shell title={result.created.length ? `${result.created.length} ${result.created.length === 1 ? 'item importado' : 'itens importados'}` : 'Nada foi importado'} kicker="Importar" onClose={onClose}>
      <div className="space-y-1 max-h-80 overflow-y-auto nb-scroll">
        {result.created.map((c, i) => (
          <button
            key={`${c.id}-${i}`}
            type="button"
            onClick={() => (onOpen(c.id), onClose())}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--nb-pane-2)] text-left"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.title}</span>
            <span className="shrink-0 text-[11px] text-[var(--nb-ink-3)]">{c.kind}</span>
          </button>
        ))}
        {result.skipped.map((s, i) => (
          <div key={`s-${i}`} className="flex items-center gap-2.5 p-2 rounded-lg">
            <XCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
            <span className="shrink-0 text-[11px] text-[var(--nb-ink-3)]">{s.reason}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
