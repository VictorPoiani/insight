'use client';

/**
 * Buscar e Substituir em todo o Notebook (ou só no projeto atual).
 * Mostra cada ocorrência com o antes e o depois; só as marcadas são trocadas.
 * Antes de aplicar, cada nota afetada ganha um instantâneo no histórico, e a
 * troca inteira pode ser desfeita com um clique.
 *
 * Onde procura: títulos e texto das notas (Markdown), capítulos (só o texto,
 * nunca as tags do HTML), verbetes do Sumário (nome e resumo) e cartões de
 * texto dos canvases. Endereços de links e identificadores ficam de fora.
 */
import { useMemo, useState } from 'react';
import { BookMarked, Check, Loader2, Replace, Undo2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NOTEBOOK_FULL_COLUMNS, type NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import { projectRootOf } from '@/lib/notebook/projects';
import { itemIcon } from '../FileExplorer';

type Field = 'title' | 'content' | 'html' | 'entry-title' | 'entry-summary' | 'card';
interface Occ {
  /** posição no texto (ou no n-ésimo nó de texto, para HTML) */
  node: number;
  start: number;
  end: number;
  before: string;
  match: string;
  after: string;
  on: boolean;
}
interface Doc {
  key: string;
  field: Field;
  id: string;
  /** canvas do cartão */
  canvasId?: string;
  title: string;
  where: string;
  icon: React.ReactNode;
  original: string;
  occ: Occ[];
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** trechos que não podem ser trocados: destino de links, ids de menção e citação */
function protectedRanges(md: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of md.matchAll(/\]\([^)\n]*\)/g)) out.push([m.index!, m.index! + m[0].length]);
  for (const m of md.matchAll(/^---\n[\s\S]*?\n---/g)) void m; // frontmatter pode ser trocado (são campos de texto)
  return out;
}

function findIn(text: string, re: RegExp, node = 0, skip: [number, number][] = []): Occ[] {
  const out: Occ[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0]) {
      re.lastIndex++;
      continue;
    }
    const s = m.index;
    const e = s + m[0].length;
    if (skip.some(([a, b]) => s < b && e > a)) continue;
    out.push({ node, start: s, end: e, before: text.slice(Math.max(0, s - 40), s), match: m[0], after: text.slice(e, e + 40), on: true });
    if (out.length > 2000) break;
  }
  return out;
}

/** Nós de texto de um HTML, na ordem (a mesma usada para achar e para trocar). */
function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walk = (n: Node) => n.childNodes.forEach((c) => (c.nodeType === 3 ? out.push(c as Text) : walk(c)));
  walk(root);
  return out;
}

function applyText(text: string, occ: Occ[], node: number, rep: string) {
  let out = text;
  for (const o of occ.filter((x) => x.on && x.node === node).sort((a, b) => b.start - a.start)) out = out.slice(0, o.start) + rep + out.slice(o.end);
  return out;
}

export function ReplacePanel({ api, entriesApi, projectId, onOpen }: { api: NotebookApi; entriesApi?: EntriesApi; projectId: string | null; onOpen: (id: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [find, setFind] = useState('');
  const [rep, setRep] = useState('');
  const [caseS, setCaseS] = useState(false);
  const [word, setWord] = useState(false);
  const [scope, setScope] = useState<'projeto' | 'tudo'>(projectId ? 'projeto' : 'tudo');
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);

  const regex = () => {
    const body = escRe(find);
    return new RegExp(word ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, `g${caseS ? '' : 'i'}u`);
  };
  const inScope = (itemId: string) => scope === 'tudo' || projectRootOf(api.items, itemId) === projectId || itemId === projectId;

  const search = async () => {
    const term = find.trim() ? find : '';
    if (!term) return;
    setBusy('Procurando…');
    setUndo(null);
    const re = regex();
    const like = `%${find.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const out: Doc[] = [];
    // notas e capítulos (a versão local vence, se houver edição ainda não enviada)
    const { data } = await supabase
      .from('notebook_items')
      .select(NOTEBOOK_FULL_COLUMNS)
      .is('archived_at', null)
      .or(`title.ilike.${like},content.ilike.${like},data->>html.ilike.${like}`)
      .limit(400);
    const rows = ((data || []) as unknown as NotebookItem[]).map((r) => (api.items[r.id]?._full ? api.items[r.id] : r)).filter((r) => inScope(r.id));
    for (const it of rows) {
      const where = projectRootOf(api.items, it.id) ? api.items[projectRootOf(api.items, it.id)!]?.title || '' : '';
      const base = { id: it.id, icon: <span className="text-[13px]">{itemIcon(it)}</span>, where };
      const t = findIn(it.title, re);
      if (t.length) out.push({ ...base, key: `${it.id}:title`, field: 'title', title: it.title, original: it.title, occ: t });
      if (it.template === 'chapter') {
        const html = String(it.data?.html || '');
        const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
        const occ = textNodes(doc.body.firstChild!).flatMap((n, k) => findIn(n.data, re, k));
        if (occ.length) out.push({ ...base, key: `${it.id}:html`, field: 'html', title: it.title, original: html, occ });
      } else if (it.template !== 'canvas' && it.content) {
        const occ = findIn(it.content, re, 0, protectedRanges(it.content));
        if (occ.length) out.push({ ...base, key: `${it.id}:content`, field: 'content', title: it.title, original: it.content, occ });
      }
    }
    // verbetes do Sumário
    for (const e of Object.values(entriesApi?.entries || {})) {
      if (scope === 'projeto' && e.project_id !== projectId) continue;
      const base = { id: e.id, icon: <BookMarked className="w-3.5 h-3.5" />, where: 'Sumário' };
      const t = findIn(e.title, re);
      if (t.length) out.push({ ...base, key: `${e.id}:et`, field: 'entry-title', title: e.title, original: e.title, occ: t });
      const s = findIn(e.summary || '', re);
      if (s.length) out.push({ ...base, key: `${e.id}:es`, field: 'entry-summary', title: e.title, original: e.summary || '', occ: s });
    }
    // cartões de texto dos canvases
    const { data: cards } = await supabase.from('notebook_canvas_nodes').select('canvas_id, id, text').eq('type', 'text').ilike('text', like).limit(400);
    for (const c of (cards || []) as { canvas_id: string; id: string; text: string }[]) {
      if (!inScope(c.canvas_id)) continue;
      const occ = findIn(c.text, re, 0, protectedRanges(c.text));
      const cv = api.items[c.canvas_id];
      if (occ.length) out.push({ key: `${c.canvas_id}:${c.id}`, field: 'card', id: c.id, canvasId: c.canvas_id, title: cv?.title || 'Canvas', where: 'Cartão do canvas', icon: <span className="text-[13px]">{cv ? itemIcon(cv) : null}</span>, original: c.text, occ });
    }
    setDocs(out);
    setBusy(null);
  };

  const total = docs?.reduce((s, d) => s + d.occ.length, 0) || 0;
  const chosen = docs?.reduce((s, d) => s + d.occ.filter((o) => o.on).length, 0) || 0;
  const toggle = (key: string, i?: number) =>
    setDocs((ds) => ds && ds.map((d) => (d.key !== key ? d : { ...d, occ: d.occ.map((o, k) => (i === undefined ? { ...o, on: !d.occ.every((x) => x.on) } : k === i ? { ...o, on: !o.on } : o)) })));

  const apply = async () => {
    if (!docs || !chosen) return;
    if (!confirm(`Trocar ${chosen} ${chosen === 1 ? 'ocorrência' : 'ocorrências'} de “${find}” por “${rep}”? Um instantâneo de cada nota fica no histórico.`)) return;
    setBusy('Substituindo…');
    const restore: (() => Promise<void>)[] = [];
    const snapshot = new Set<string>();
    for (const d of docs) {
      if (!d.occ.some((o) => o.on)) continue;
      if (d.field === 'title' || d.field === 'content' || d.field === 'html') {
        const it = (await api.loadFull(d.id)) || api.items[d.id];
        if (!it) continue;
        if (!snapshot.has(d.id)) {
          snapshot.add(d.id);
          await api.saveRevisionNow(d.id, `Antes de trocar “${find.slice(0, 30)}” por “${rep.slice(0, 30)}”`);
        }
        if (d.field === 'title') {
          const before = it.title;
          api.update(d.id, { title: applyText(before, d.occ, 0, rep).slice(0, 200) });
          restore.push(async () => api.update(d.id, { title: before }));
        } else if (d.field === 'content') {
          const before = it.content;
          api.update(d.id, { content: applyText(before, d.occ, 0, rep) });
          restore.push(async () => api.update(d.id, { content: before }));
        } else {
          const beforeData = it.data;
          const doc = new DOMParser().parseFromString(`<div>${String(it.data?.html || '')}</div>`, 'text/html');
          textNodes(doc.body.firstChild!).forEach((n, k) => (n.data = applyText(n.data, d.occ, k, rep)));
          api.update(d.id, { data: { ...(it.data || {}), html: (doc.body.firstChild as HTMLElement).innerHTML } });
          restore.push(async () => api.update(d.id, { data: beforeData }));
        }
      } else if (d.field === 'entry-title' || d.field === 'entry-summary') {
        const f = d.field === 'entry-title' ? 'title' : 'summary';
        await entriesApi?.update(d.id, { [f]: applyText(d.original, d.occ, 0, rep) });
        restore.push(async () => void (await entriesApi?.update(d.id, { [f]: d.original })));
      } else if (d.field === 'card' && d.canvasId) {
        await supabase.from('notebook_canvas_nodes').update({ text: applyText(d.original, d.occ, 0, rep).slice(0, 20000) }).eq('canvas_id', d.canvasId).eq('id', d.id);
        restore.push(async () => void (await supabase.from('notebook_canvas_nodes').update({ text: d.original }).eq('canvas_id', d.canvasId!).eq('id', d.id)));
      }
    }
    await api.flushAll();
    setUndo({
      label: `${chosen} ${chosen === 1 ? 'troca feita' : 'trocas feitas'}`,
      run: async () => {
        for (const r of restore) await r();
        await api.flushAll();
      },
    });
    setDocs(null);
    setBusy(null);
  };

  const hl = (o: Occ) => (
    <>
      <span className="text-[var(--nb-ink-3)]">{o.before.length >= 40 ? '…' : ''}{o.before}</span>
      <del className="nb-rp-del">{o.match}</del>
      {rep && <ins className="nb-rp-ins">{rep}</ins>}
      <span className="text-[var(--nb-ink-3)]">{o.after}{o.after.length >= 40 ? '…' : ''}</span>
    </>
  );

  return (
    <div className="nb-rp">
      <form
        className="nb-rp-form"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input value={find} onChange={(e) => (setFind(e.target.value.slice(0, 200)), setDocs(null))} placeholder="Procurar" aria-label="Procurar" autoFocus />
        <input value={rep} onChange={(e) => setRep(e.target.value.slice(0, 200))} placeholder="Substituir por" aria-label="Substituir por" />
        <div className="nb-rp-opts">
          <label>
            <input type="checkbox" checked={caseS} onChange={(e) => (setCaseS(e.target.checked), setDocs(null))} /> Maiúsculas
          </label>
          <label>
            <input type="checkbox" checked={word} onChange={(e) => (setWord(e.target.checked), setDocs(null))} /> Palavra inteira
          </label>
          {projectId && (
            <select value={scope} onChange={(e) => (setScope(e.target.value as 'projeto' | 'tudo'), setDocs(null))} aria-label="Onde">
              <option value="projeto">Neste projeto</option>
              <option value="tudo">Em todo o Notebook</option>
            </select>
          )}
        </div>
        <button type="submit" className="nb-rp-btn" disabled={!find || !!busy}>
          {busy === 'Procurando…' ? <Loader2 className="animate-spin" /> : <Replace />} Ver ocorrências
        </button>
      </form>

      {undo && (
        <div className="nb-rp-done">
          <Check /> {undo.label}.
          <button
            type="button"
            onClick={async () => {
              setBusy('Desfazendo…');
              await undo.run();
              setUndo(null);
              setBusy(null);
            }}
          >
            <Undo2 /> Desfazer
          </button>
        </div>
      )}

      {docs && (
        <>
          <div className="nb-rp-sum">
            <span>
              {total ? `${total} ${total === 1 ? 'ocorrência' : 'ocorrências'} em ${docs.length} ${docs.length === 1 ? 'lugar' : 'lugares'}` : 'Nada encontrado.'}
            </span>
            {total > 0 && (
              <button type="button" className="nb-rp-btn nb-rp-apply" disabled={!chosen || !!busy} onClick={() => void apply()}>
                {busy === 'Substituindo…' ? <Loader2 className="animate-spin" /> : null}
                {chosen === total ? 'Substituir tudo' : `Substituir ${chosen}`}
              </button>
            )}
          </div>
          <div className="nb-rp-list nb-scroll">
            {docs.map((d) => (
              <section key={d.key}>
                <header>
                  <input type="checkbox" checked={d.occ.every((o) => o.on)} onChange={() => toggle(d.key)} aria-label={`Todas em ${d.title}`} />
                  <button type="button" onClick={() => onOpen(d.field === 'card' ? d.canvasId! : d.field.startsWith('entry') ? '' : d.id)} disabled={d.field.startsWith('entry')}>
                    {d.icon}
                    <span className="truncate">{d.title}</span>
                  </button>
                  <small>
                    {d.field === 'title' ? 'título' : d.field === 'entry-title' ? 'nome do verbete' : d.field === 'entry-summary' ? 'resumo do verbete' : d.where}
                  </small>
                </header>
                {d.occ.slice(0, 200).map((o, i) => (
                  <label key={i} className="nb-rp-occ" data-off={!o.on || undefined}>
                    <input type="checkbox" checked={o.on} onChange={() => toggle(d.key, i)} />
                    <span>{hl(o)}</span>
                  </label>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
