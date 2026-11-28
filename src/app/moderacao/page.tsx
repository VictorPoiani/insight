'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2, Check, EyeOff, Ban, Trash2, ArrowUpRight, RefreshCw, Lock } from 'lucide-react';
import { useNitro } from '@/components/nitro/NitroProvider';

type Tab = 'appeals' | 'review' | 'blocked' | 'log';
const TABS: { id: Tab; label: string }[] = [
  { id: 'appeals', label: 'Pedidos de revisão' },
  { id: 'review', label: 'Em análise' },
  { id: 'blocked', label: 'Bloqueados' },
  { id: 'log', label: 'Auditoria' },
];

const REASON: Record<string, string> = {
  'sexual/minors': 'Exploração de menores',
  'self-harm': 'Automutilação',
  'violence/threat': 'Ameaça / incitação',
  'violence/graphic': 'Violência gráfica',
  hate: 'Discurso de ódio',
  harassment: 'Assédio',
  terrorism: 'Terrorismo',
  illicit: 'Atividade ilegal',
  sexual: 'Sexual (+18)',
  media_unverified: 'Mídia não verificada',
};
const KIND: Record<string, string> = { post: 'Insight', reply: 'Resposta', topic: 'Tópico', profile: 'Perfil' };

interface Item {
  kind: 'post' | 'reply' | 'topic';
  id: string;
  status: string;
  isNsfw: boolean;
  reason: string | null;
  postId: string | null;
  text: string;
  images: string[];
  videos: string[];
  author: { username?: string; display_name?: string; avatar_url?: string } | null;
  appeal?: { message: string | null; created_at: string };
  lastLog?: { verdict: string; provider: string; scores?: Record<string, number>; created_at: string } | null;
}
interface LogRow {
  id: number;
  entity_type: string;
  entity_id: string;
  verdict: string;
  action: string;
  reason: string | null;
  provider: string | null;
  excerpt: string | null;
  created_at: string;
}

const VERDICT_STYLE: Record<string, string> = {
  BLOCK: 'bg-danger/15 text-danger',
  REVIEW: 'bg-amber-500/15 text-amber-500',
  NSFW: 'bg-fuchsia-500/15 text-fuchsia-400',
  ALLOW: 'bg-emerald-500/15 text-emerald-400',
};

/** Painel de Trust & Safety (só equipe). */
export default function ModerationPage() {
  const { viewer } = useNitro();
  const isStaff = viewer?.role === 'admin' || viewer?.role === 'moderator';
  const [tab, setTab] = useState<Tab>('appeals');
  const [items, setItems] = useState<Item[] | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setItems(null);
    setLog(null);
    const res = await fetch(`/api/moderation/queue?tab=${tab}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (tab === 'log') setLog(data.log || []);
    else setItems(data.items || []);
  }, [tab]);

  useEffect(() => {
    if (isStaff) void load();
  }, [isStaff, load]);

  async function decide(it: Item, decision: 'approve' | 'approve_nsfw' | 'block' | 'delete') {
    if (decision === 'delete' && !window.confirm('Excluir definitivamente este conteúdo?')) return;
    setBusy(`${it.kind}:${it.id}`);
    await fetch('/api/moderation/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: it.kind, id: it.id, decision, note: notes[it.id] || '' }),
    });
    setBusy(null);
    setItems((prev) => (prev ? prev.filter((x) => !(x.kind === it.kind && x.id === it.id)) : prev));
  }

  async function sweep() {
    setBusy('sweep');
    await fetch('/api/moderation/sweep', { cache: 'no-store' });
    setBusy(null);
    void load();
  }

  if (!viewer) {
    return <div className="py-24 text-center text-xs text-muted">Carregando…</div>;
  }
  if (!isStaff) {
    return (
      <div className="py-24 text-center space-y-2">
        <Lock className="w-6 h-6 mx-auto text-muted" />
        <p className="text-sm text-secondary">Área restrita à equipe de moderação.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-primary">
            <ShieldCheck className="w-5 h-5 text-accent" /> Moderação
          </h1>
          <p className="text-xs text-muted">Trust &amp; Safety: decisões automáticas, pedidos de revisão e auditoria.</p>
        </div>
        <button
          type="button"
          onClick={sweep}
          disabled={busy === 'sweep'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-bold text-secondary hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy === 'sweep' ? 'animate-spin' : ''}`} /> Processar fila agora
        </button>
      </header>

      <div role="tablist" className="mt-5 flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-xs font-bold whitespace-nowrap ${tab === t.id ? 'text-primary' : 'text-muted hover:text-secondary'}`}
          >
            {t.label}
            {tab === t.id && <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        !log ? (
          <Spinner />
        ) : (
          <div className="mt-4 rounded-xl border border-border overflow-hidden divide-y divide-border">
            {log.map((l) => (
              <div key={l.id} className="px-3 py-2.5 text-xs grid grid-cols-[auto_1fr_auto] gap-3 items-start">
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${VERDICT_STYLE[l.verdict] || ''}`}>{l.verdict}</span>
                <span className="min-w-0">
                  <span className="text-primary font-semibold">{KIND[l.entity_type] || l.entity_type}</span>
                  <span className="text-muted"> · {l.action}{l.reason ? ` · ${REASON[l.reason] || l.reason}` : ''} · {l.provider || '—'}</span>
                  {l.excerpt && <span className="block text-secondary truncate">{l.excerpt}</span>}
                </span>
                <span className="text-muted whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            ))}
            {log.length === 0 && <p className="py-10 text-center text-xs text-muted">Sem registros ainda.</p>}
          </div>
        )
      ) : !items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-xs text-muted">Nada por aqui.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((it) => {
            const key = `${it.kind}:${it.id}`;
            const topScores = Object.entries(it.lastLog?.scores || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return (
              <li key={key} className="rounded-2xl border border-border bg-surface/50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.author?.avatar_url || '/assets/net/default-perfil'} alt="" className="w-6 h-6 rounded-full object-cover border border-border" />
                  <span className="font-bold text-primary">{it.author?.display_name || it.author?.username || 'Membro'}</span>
                  {it.author?.username && <span className="text-muted">@{it.author.username}</span>}
                  <span className="px-2 py-0.5 rounded-full bg-elevated text-secondary font-semibold">{KIND[it.kind]}</span>
                  {it.reason && <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger font-semibold">{REASON[it.reason] || it.reason}</span>}
                  {it.postId && (
                    <Link href={`/post/${it.postId}`} className="ml-auto inline-flex items-center gap-1 text-accent font-bold hover:underline">
                      Abrir <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {it.appeal && (
                  <p className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-primary">
                    <strong>Pedido do autor:</strong> {it.appeal.message || '(sem mensagem)'}
                  </p>
                )}

                {it.text && <p className="mt-3 text-sm text-secondary whitespace-pre-line line-clamp-[10] break-words">{it.text}</p>}

                {(it.images.length > 0 || it.videos.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {it.images.map((src) => (
                      // mídia pode ser sensível: borrada até passar o mouse
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" className="w-28 h-28 rounded-lg object-cover border border-border blur-md hover:blur-none transition" />
                    ))}
                    {it.videos.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="w-28 h-28 rounded-lg border border-border grid place-items-center text-[10px] text-muted text-center p-2">
                        Vídeo sem quadros (abrir)
                      </a>
                    ))}
                  </div>
                )}

                {topScores.length > 0 && (
                  <p className="mt-3 text-[10px] font-mono text-muted">
                    {it.lastLog?.provider} · {topScores.map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[it.id] || ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [it.id]: e.target.value.slice(0, 500) }))}
                    placeholder="Nota para o autor (opcional)"
                    className="flex-1 min-w-[180px] rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                  <Action onClick={() => decide(it, 'approve')} disabled={busy === key} icon={Check} label="Aprovar" cls="bg-emerald-500/15 text-emerald-400" />
                  <Action onClick={() => decide(it, 'approve_nsfw')} disabled={busy === key} icon={EyeOff} label="Aprovar +18" cls="bg-fuchsia-500/15 text-fuchsia-400" />
                  <Action onClick={() => decide(it, 'block')} disabled={busy === key} icon={Ban} label="Manter bloqueado" cls="bg-danger/15 text-danger" />
                  <Action onClick={() => decide(it, 'delete')} disabled={busy === key} icon={Trash2} label="Excluir" cls="bg-elevated text-secondary" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="py-16 flex justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-accent" />
    </div>
  );
}

function Action({ onClick, disabled, icon: Icon, label, cls }: { onClick: () => void; disabled: boolean; icon: typeof Check; label: string; cls: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
