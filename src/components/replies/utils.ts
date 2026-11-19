import { Reply } from '@/types/database';

export type ReplySort = 'top' | 'recent' | 'oldest';

export interface ReplyNode extends Reply {
  children: ReplyNode[];
  /** Total de descendentes (para "mostrar N respostas"). */
  descendantsCount: number;
}

export function getReplyAuthorHref(handle?: string | null) {
  return handle ? `/u/${encodeURIComponent(handle)}` : '/';
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'agora';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function compareReplies(a: Reply, b: Reply, sort: ReplySort) {
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  if (sort === 'recent') return tb - ta;
  if (sort === 'oldest') return ta - tb;
  const diff = (b.likes_count || 0) - (a.likes_count || 0);
  return diff !== 0 ? diff : ta - tb;
}

/**
 * Monta a árvore de respostas. Respostas cujo pai foi excluído (ou não existe)
 * sobem para o nível raiz, para nunca sumirem da discussão.
 * Respostas aninhadas ficam sempre em ordem cronológica (leitura de conversa);
 * a ordenação escolhida vale para o nível raiz.
 */
export function buildReplyTree(replies: Reply[], sort: ReplySort): ReplyNode[] {
  const byId = new Map<string, ReplyNode>();
  replies.forEach((r) => byId.set(r.id, { ...r, children: [], descendantsCount: 0 }));

  const roots: ReplyNode[] = [];
  byId.forEach((node) => {
    const parent = node.parent_reply_id ? byId.get(node.parent_reply_id) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  });

  const finalize = (node: ReplyNode): number => {
    node.children.sort((a, b) => compareReplies(a, b, 'oldest'));
    node.descendantsCount = node.children.reduce((sum, c) => sum + 1 + finalize(c), 0);
    return node.descendantsCount;
  };
  roots.forEach(finalize);
  roots.sort((a, b) => compareReplies(a, b, sort));
  return roots;
}
