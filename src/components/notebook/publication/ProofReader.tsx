'use client';

/**
 * Modo Prova Final: esconde 100% da interface e mostra o texto exatamente como
 * o leitor vai ver — montado pelo servidor com as mesmas regras da publicação
 * (sem segredos do autor, só verbetes públicos nos balões).
 */
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { PublicationOutput } from '@/lib/notebook/publication';
import { NbPortal } from '../history/VersionHistory';
import { PublicEntryView, PublicationView } from './PublicationView';

export function ProofReader({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [pub, setPub] = useState<PublicationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch('/api/notebook/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, mode: 'preview' }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setError(d?.error || 'Não foi possível montar a prova.');
        else setPub(d as PublicationOutput);
      })
      .catch(() => alive && setError('Sem conexão: a prova final é montada no servidor.'));
    return () => {
      alive = false;
    };
  }, [itemId]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (entry ? setEntry(null) : onClose());
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [entry, onClose]);

  return (
    <NbPortal>
      <div className="fixed inset-0 z-[150] overflow-y-auto bg-[#0e0e10]" role="dialog" aria-label="Prova final">
        <button type="button" onClick={onClose} className="nb-proof-close" aria-label="Sair da prova final (Esc)" title="Sair da prova final (Esc)">
          <X className="w-4 h-4" />
        </button>
        {!pub && !error && (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {error && <p className="mx-auto max-w-md px-6 pt-32 text-center text-[14px] text-zinc-400">{error}</p>}
        {pub && !entry && <PublicationView title={pub.title} html={pub.html} entries={pub.entries} onReadMore={setEntry} byline={<span>Prova final · assim o leitor verá</span>} />}
        {pub && entry && pub.entries[entry] && <PublicEntryView entry={pub.entries[entry]} onBack={() => setEntry(null)} />}
      </div>
    </NbPortal>
  );
}
