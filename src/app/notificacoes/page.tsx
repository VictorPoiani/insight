'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  PostBlock,
  PostBlockType,
  FontStyleType,
  ImageWidthType,
} from '@/types/database';
import {
  Megaphone,
  Lock,
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  Heart,
  Share2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Quote,
  Sparkles,
  Code,
  List,
  Image as ImageIcon,
  Music,
  Minus,
  Check,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Type,
  GripVertical,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';

interface FlexibleUpdateBlock extends Omit<Partial<PostBlock>, 'type'> {
  id?: string;
  type: PostBlockType | 'heading' | 'list';
  text?: string;
  items?: string[];
  url?: string | null;
  caption?: string;
}

interface UpdateRow {
  id: string;
  profile_id: string;
  title: string | null;
  blocks: FlexibleUpdateBlock[];
  likes_count: number;
  created_at: string;
}

const DEFAULT_PROFILE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || '96d271a9-9102-49b1-b593-9279c5dfe3f4';

const HIGHLIGHT_COLORS = [
  { name: 'Azul Metálico', color: 'rgba(37, 99, 235, 0.42)' },
  { name: 'Amarelo', color: 'rgba(250, 204, 21, 0.35)' },
  { name: 'Verde', color: 'rgba(29, 185, 84, 0.35)' },
  { name: 'Roxo', color: 'rgba(168, 85, 247, 0.40)' },
  { name: 'Vermelho', color: 'rgba(239, 68, 68, 0.38)' },
];

const BLOCK_MENU_ITEMS: {
  type: PostBlockType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: 'paragraph', label: 'Texto', desc: 'Parágrafo livre', icon: AlignLeft },
  { type: 'h1', label: 'Título Grande', desc: 'Cabeçalho principal (H1)', icon: Heading1 },
  { type: 'h2', label: 'Subtítulo', desc: 'Cabeçalho de seção (H2)', icon: Heading2 },
  { type: 'quote', label: 'Citação', desc: 'Destaque com barra lateral', icon: Quote },
  { type: 'callout', label: 'Callout / Nota', desc: 'Caixa de destaque estilo Notion', icon: Sparkles },
  { type: 'bullet', label: 'Item de Lista', desc: 'Tópico com marcador', icon: List },
  { type: 'code', label: 'Bloco de Código', desc: 'Fonte monoespaçada técnica', icon: Code },
  { type: 'image', label: 'Imagem Responsiva', desc: 'Upload com controle de largura', icon: ImageIcon },
  { type: 'spotify', label: 'Música do Spotify', desc: 'Player incorporado no bloco', icon: Music },
  { type: 'divider', label: 'Divisória', desc: 'Linha horizontal separadora', icon: Minus },
];

function extractSpotifyTrackId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (trimmed.includes('open.spotify.com/track/')) {
    return trimmed.split('track/')[1]?.split('?')[0] || null;
  }
  if (trimmed.includes('spotify:track:')) {
    return trimmed.split('spotify:track:')[1] || null;
  }
  return /^[A-Za-z0-9]{10,30}$/.test(trimmed) ? trimmed : null;
}

function createNewBlock(type: PostBlockType = 'paragraph'): PostBlock {
  return {
    id: `upd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    html: '',
    fontStyle: type === 'code' ? 'mono' : 'sans',
    align: 'left',
    calloutIcon: '🚀',
    imageUrl: null,
    imageCaption: '',
    imageWidth: '100%',
    spotifyTrackId: null,
  };
}

function normalizeLegacyBlock(b: FlexibleUpdateBlock, idx: number): PostBlock {
  const id = b.id || `upd-${idx}-${Date.now()}`;
  if (b.type === 'heading') {
    return {
      ...createNewBlock('h2'),
      id,
      type: 'h2',
      html: b.html || b.text || '',
    };
  }
  if (b.type === 'list') {
    const joined = Array.isArray(b.items) ? b.items.join('<br>') : '';
    return {
      ...createNewBlock('bullet'),
      id,
      type: 'bullet',
      html: b.html || joined,
    };
  }
  return {
    id,
    type: (b.type as PostBlockType) || 'paragraph',
    html: b.html ?? b.text ?? '',
    fontStyle: b.fontStyle || (b.type === 'code' ? 'mono' : 'sans'),
    align: b.align || 'left',
    calloutIcon: b.calloutIcon || '🚀',
    imageUrl: b.imageUrl ?? b.url ?? null,
    imageCaption: b.imageCaption ?? b.caption ?? '',
    imageWidth: b.imageWidth || '100%',
    spotifyTrackId: b.spotifyTrackId || null,
  };
}

interface RichBlockEditableProps {
  block: PostBlock;
  placeholder: string;
  className: string;
  onFocus: () => void;
  onChangeHtml: (html: string) => void;
  onSlashTriggered: () => void;
  onEnterPressed: () => void;
  onBackspaceEmpty: () => void;
}

function RichBlockEditable({
  block,
  placeholder,
  className,
  onFocus,
  onChangeHtml,
  onSlashTriggered,
  onEnterPressed,
  onBackspaceEmpty,
}: RichBlockEditableProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement !== ref.current && ref.current.innerHTML !== (block.html || '')) {
      ref.current.innerHTML = block.html || '';
    }
  }, [block.html, block.type]);

  function handleInput(e: React.FormEvent<HTMLDivElement>) {
    const html = e.currentTarget.innerHTML;
    const plain = e.currentTarget.innerText.trim();

    if (plain === '/') {
      e.currentTarget.innerHTML = '';
      onChangeHtml('');
      onSlashTriggered();
      return;
    }

    onChangeHtml(html === '<br>' ? '' : html);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      onEnterPressed();
    } else if (e.key === 'Backspace') {
      const plain = e.currentTarget.innerText.replace(/\n/g, '').trim();
      if (plain.length === 0) {
        e.preventDefault();
        onBackspaceEmpty();
      }
    }
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={onFocus}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{ textAlign: block.align || 'left' }}
      className={`notion-editable w-full focus:outline-none break-words ${className}`}
    />
  );
}

export default function NotificacoesPage() {
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<PostBlock[]>(() => [createNewBlock('paragraph')]);
  const [activeBlockId, setActiveBlockId] = useState<string>('');
  const [menuOpenForBlockId, setMenuOpenForBlockId] = useState<string | null>(null);
  const [showHighlighterMenu, setShowHighlighterMenu] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabase = createClient();
  const activeBlock = blocks.find((b) => b.id === activeBlockId) || blocks[0];

  const loadUpdates = useCallback(async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    setIsAdmin(Boolean(session?.user));
    if (session?.user?.id) {
      setProfileId(session.user.id);
    }

    const { data } = await supabase
      .from('updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setUpdates(data as UpdateRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  function applyInlineFormat(command: string, value?: string) {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
  }

  function applyHighlightColor(color: string | null) {
    document.execCommand('styleWithCSS', false, 'true');
    if (!color) {
      document.execCommand('hiliteColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    setShowHighlighterMenu(false);
  }

  function updateBlock(id: string, patch: Partial<PostBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertBlockAfter(targetId: string, type: PostBlockType = 'paragraph') {
    const newBlk = createNewBlock(type);
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === targetId);
      if (idx === -1) return [...prev, newBlk];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newBlk);
      return copy;
    });
    setActiveBlockId(newBlk.id);
    setMenuOpenForBlockId(null);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => {
      if (prev.length <= 1) return [createNewBlock('paragraph')];
      return prev.filter((b) => b.id !== id);
    });
  }

  function moveBlockStep(id: string, direction: 'up' | 'down') {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedBlockId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (draggedBlockId && draggedBlockId !== targetId) {
      setDragOverBlockId(targetId);
    }
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverBlockId(null);
    if (!draggedBlockId || draggedBlockId === targetId) return;

    setBlocks((prev) => {
      const fromIndex = prev.findIndex((b) => b.id === draggedBlockId);
      const toIndex = prev.findIndex((b) => b.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDraggedBlockId(null);
  }

  async function handleBlockImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem válido.');
      return;
    }

    setUploadingBlockId(blockId);
    const ext = file.name.split('.').pop();
    const fileName = `${profileId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

    let targetBucket = 'updates';
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(fileName, file);

    if (uploadError) {
      targetBucket = 'posts';
      const { error: fallbackError } = await supabase.storage
        .from(targetBucket)
        .upload(fileName, file);

      if (fallbackError) {
        setUploadingBlockId(null);
        alert('Erro ao enviar imagem: ' + fallbackError.message);
        return;
      }
    }

    setUploadingBlockId(null);
    const { data: pubData } = supabase.storage.from(targetBucket).getPublicUrl(fileName);
    updateBlock(blockId, { imageUrl: pubData.publicUrl });
  }

  function resetEditor() {
    setEditingId(null);
    setTitle('');
    setBlocks([createNewBlock('paragraph')]);
    setMenuOpenForBlockId(null);
  }

  function startEdit(update: UpdateRow) {
    setEditingId(update.id);
    setTitle(update.title || '');
    setBlocks(
      Array.isArray(update.blocks) && update.blocks.length > 0
        ? update.blocks.map((b, idx) => normalizeLegacyBlock(b, idx))
        : [createNewBlock('paragraph')]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handlePublish() {
    const validBlocks = blocks.filter((b) => {
      if (b.type === 'divider') return true;
      if (b.type === 'image') return Boolean(b.imageUrl);
      if (b.type === 'spotify') return Boolean(b.spotifyTrackId);
      const plain = (b.html || '').replace(/<[^>]*>/g, '').trim();
      return plain.length > 0;
    });

    if (validBlocks.length === 0) return;

    setSubmitting(true);
    const payload = {
      profile_id: profileId,
      title: title.trim() || null,
      blocks: validBlocks,
    };

    const query = editingId
      ? supabase.from('updates').update(payload).eq('id', editingId)
      : supabase.from('updates').insert(payload);

    const { error } = await query;
    setSubmitting(false);

    if (error) {
      alert('Erro ao salvar atualização: ' + error.message);
      return;
    }

    if (!editingId) {
      const summaryText = validBlocks
        .map((b) => (b.html || '').replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
        .join('\n\n');

      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'official_update',
          postTitle: title.trim() || 'Nova Atualização Oficial',
          postContent: summaryText,
          postBlocks: validBlocks,
        }),
      }).catch(() => {});
    }

    resetEditor();
    loadUpdates();
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta atualização? Essa ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('updates').delete().eq('id', id);
    if (!error) {
      setUpdates((prev) => prev.filter((u) => u.id !== id));
      if (editingId === id) resetEditor();
    }
  }

  async function handleLike(update: UpdateRow) {
    const nextLikes = (update.likes_count || 0) + 1;
    setUpdates((prev) =>
      prev.map((u) => (u.id === update.id ? { ...u, likes_count: nextLikes } : u))
    );
    await supabase.from('updates').update({ likes_count: nextLikes }).eq('id', update.id);
  }

  function handleShare(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/notificacoes#${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getFontClass(font?: FontStyleType) {
    if (font === 'serif') return 'font-serif tracking-normal';
    if (font === 'mono') return 'font-mono text-[0.92em]';
    return 'font-sans';
  }

  function getBlockTypographyClass(type: PostBlockType) {
    switch (type) {
      case 'h1':
        return 'text-2xl font-extrabold text-primary leading-tight';
      case 'h2':
        return 'text-lg font-bold text-primary leading-snug';
      case 'quote':
        return 'border-l-4 border-accent pl-4 italic text-secondary text-base';
      case 'code':
        return 'p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary whitespace-pre-wrap';
      default:
        return 'text-sm sm:text-base text-primary leading-relaxed';
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1.5 border-b border-border pb-5">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-accent uppercase tracking-wider">
          <Megaphone className="w-4 h-4" />
          <span>Mural de atualizações</span>
        </div>
        <h1 className="text-2xl font-extrabold text-primary">Notificações</h1>
        <p className="text-xs sm:text-sm text-secondary">
          Tudo o que muda no Insight, direto de quem constrói: novidades, correções e bastidores.
        </p>
      </header>

      {!isAdmin ? (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-surface border border-border text-xs text-secondary">
          <Lock className="w-4 h-4 text-accent shrink-0" />
          <span>Somente o criador do Insight pode publicar atualizações neste mural.</span>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              {editingId ? 'Editando atualização' : 'Modo criador — Editor Notion'}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={resetEditor}
                className="text-xs text-muted hover:text-primary"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Título da atualização (ex: Patch v1.1 — Novo Editor de Blocos)"
            className="w-full bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-primary placeholder:text-muted focus:outline-none focus:border-accent"
          />

          {/* BARRA DE FERRAMENTAS ESTILO NOTION */}
          <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-elevated/95 backdrop-blur border border-border shadow-lg">
            <div className="flex items-center gap-1 pr-2 border-r border-border">
              <Type className="w-3.5 h-3.5 text-accent ml-1 mr-0.5" />
              {(
                [
                  { key: 'sans', label: 'Sans' },
                  { key: 'serif', label: 'Serif' },
                  { key: 'mono', label: 'Mono' },
                ] as { key: FontStyleType; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (activeBlock) updateBlock(activeBlock.id, { fontStyle: f.key });
                  }}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    (activeBlock?.fontStyle || 'sans') === f.key
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 pr-2 border-r border-border relative">
              <button
                type="button"
                title="Negrito (Ctrl+B)"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('bold');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                type="button"
                title="Itálico (Ctrl+I)"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('italic');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                type="button"
                title="Sublinhar (Ctrl+U)"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('underline');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Underline className="w-4 h-4" />
              </button>

              <button
                type="button"
                title="Tachado"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('strikeThrough');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Strikethrough className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  title="Grifar texto selecionado"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowHighlighterMenu((prev) => !prev);
                  }}
                  className={`p-1.5 rounded-md flex items-center gap-1 transition-colors ${
                    showHighlighterMenu
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                >
                  <Highlighter className="w-4 h-4" />
                </button>

                {showHighlighterMenu && (
                  <div className="absolute left-0 top-full mt-2 p-2 rounded-xl bg-surface border border-border shadow-xl flex items-center gap-1.5 z-30">
                    {HIGHLIGHT_COLORS.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        title={`Grifar: ${item.name}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyHighlightColor(item.color);
                        }}
                        style={{ backgroundColor: item.color }}
                        className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                      />
                    ))}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyHighlightColor(null);
                      }}
                      className="px-2 py-1 rounded bg-elevated text-[10px] text-secondary hover:text-primary"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { align: 'left', icon: AlignLeft, title: 'Alinhar à esquerda' },
                  { align: 'center', icon: AlignCenter, title: 'Centralizar' },
                  { align: 'right', icon: AlignRight, title: 'Alinhar à direita' },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.align}
                    type="button"
                    title={item.title}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (activeBlock) updateBlock(activeBlock.id, { align: item.align });
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      (activeBlock?.align || 'left') === item.align
                        ? 'text-accent bg-surface'
                        : 'text-secondary hover:text-primary hover:bg-surface'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* LISTA DE BLOCOS ARRASTÁVEIS */}
          <div className="space-y-2.5 min-h-[120px]">
            {blocks.map((block, index) => {
              const isDragOver = dragOverBlockId === block.id;

              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, block.id)}
                  onDragOver={(e) => handleDragOver(e, block.id)}
                  onDragLeave={() => setDragOverBlockId(null)}
                  onDrop={(e) => handleDrop(e, block.id)}
                  className={`group relative flex items-start gap-2 rounded-xl p-1.5 transition-all ${
                    isDragOver ? 'border-t-2 border-accent bg-accent/5' : 'hover:bg-elevated/40'
                  }`}
                >
                  <div className="flex items-center gap-0.5 pt-1 opacity-40 group-hover:opacity-100 transition-opacity select-none shrink-0">
                    <button
                      type="button"
                      title="Adicionar ou trocar tipo de bloco"
                      onClick={() =>
                        setMenuOpenForBlockId(
                          menuOpenForBlockId === block.id ? null : block.id
                        )
                      }
                      className="p-1 rounded hover:bg-elevated text-secondary hover:text-accent"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <div
                      title="Arraste para mover este bloco"
                      className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-elevated text-secondary hover:text-primary"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {(block.type === 'paragraph' ||
                      block.type === 'h1' ||
                      block.type === 'h2' ||
                      block.type === 'quote' ||
                      block.type === 'code') && (
                      <RichBlockEditable
                        block={block}
                        placeholder={
                          index === 0 && block.type === 'paragraph'
                            ? "Descreva a atualização... (Digite '/' para comandos ou selecione o texto para grifar)"
                            : block.type === 'h1'
                            ? 'Título principal...'
                            : block.type === 'h2'
                            ? 'Subtítulo...'
                            : block.type === 'quote'
                            ? 'Citação ou nota...'
                            : block.type === 'code'
                            ? '// Código ou changelog técnico...'
                            : "Digite '/' para comandos ou continue escrevendo..."
                        }
                        className={`${getFontClass(block.fontStyle)} ${getBlockTypographyClass(
                          block.type
                        )}`}
                        onFocus={() => setActiveBlockId(block.id)}
                        onChangeHtml={(html) => updateBlock(block.id, { html })}
                        onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                        onEnterPressed={() => insertBlockAfter(block.id, 'paragraph')}
                        onBackspaceEmpty={() => removeBlock(block.id)}
                      />
                    )}

                    {block.type === 'bullet' && (
                      <div className="flex items-start gap-2.5">
                        <span className="text-accent font-bold mt-1">•</span>
                        <RichBlockEditable
                          block={block}
                          placeholder="Item da atualização..."
                          className={`${getFontClass(
                            block.fontStyle
                          )} text-sm sm:text-base text-primary leading-relaxed`}
                          onFocus={() => setActiveBlockId(block.id)}
                          onChangeHtml={(html) => updateBlock(block.id, { html })}
                          onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                          onEnterPressed={() => insertBlockAfter(block.id, 'bullet')}
                          onBackspaceEmpty={() => removeBlock(block.id)}
                        />
                      </div>
                    )}

                    {block.type === 'callout' && (
                      <div className="p-3.5 rounded-xl bg-elevated border border-accent/40 flex items-start gap-3">
                        <input
                          type="text"
                          value={block.calloutIcon || '🚀'}
                          onChange={(e) =>
                            updateBlock(block.id, { calloutIcon: e.target.value })
                          }
                          maxLength={2}
                          className="w-7 text-center bg-transparent text-lg focus:outline-none shrink-0"
                        />
                        <RichBlockEditable
                          block={block}
                          placeholder="Destaque importante da versão..."
                          className={`${getFontClass(
                            block.fontStyle
                          )} text-sm text-primary leading-relaxed`}
                          onFocus={() => setActiveBlockId(block.id)}
                          onChangeHtml={(html) => updateBlock(block.id, { html })}
                          onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                          onEnterPressed={() => insertBlockAfter(block.id, 'paragraph')}
                          onBackspaceEmpty={() => removeBlock(block.id)}
                        />
                      </div>
                    )}

                    {block.type === 'divider' && (
                      <div className="py-3">
                        <hr className="border-border" />
                      </div>
                    )}

                    {block.type === 'image' && (
                      <div className="p-3 rounded-xl bg-elevated border border-border space-y-3">
                        {!block.imageUrl ? (
                          <label className="flex flex-col items-center justify-center py-6 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors">
                            <ImageIcon className="w-6 h-6 text-accent mb-1.5" />
                            <span className="text-xs font-semibold text-primary">
                              {uploadingBlockId === block.id
                                ? 'Enviando imagem...'
                                : 'Clique para enviar uma captura de tela ou imagem'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleBlockImageUpload(e, block.id)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted mr-1">Largura:</span>
                                {(['50%', '75%', '100%'] as ImageWidthType[]).map((w) => (
                                  <button
                                    key={w}
                                    type="button"
                                    onClick={() => updateBlock(block.id, { imageWidth: w })}
                                    className={`px-2 py-0.5 rounded font-bold text-[11px] transition-colors ${
                                      (block.imageWidth || '100%') === w
                                        ? 'bg-accent text-white'
                                        : 'bg-surface text-secondary hover:text-primary'
                                    }`}
                                  >
                                    {w}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => updateBlock(block.id, { imageUrl: null })}
                                className="text-xs text-muted hover:text-danger flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Trocar imagem</span>
                              </button>
                            </div>

                            <div
                              style={{ width: block.imageWidth || '100%' }}
                              className="mx-auto transition-all duration-200"
                            >
                              <img
                                src={block.imageUrl}
                                alt={block.imageCaption || 'Imagem da atualização'}
                                className="w-full h-auto rounded-xl border border-border object-cover"
                              />
                            </div>

                            <input
                              type="text"
                              value={block.imageCaption || ''}
                              onChange={(e) =>
                                updateBlock(block.id, { imageCaption: e.target.value })
                              }
                              placeholder="Adicionar legenda para a imagem (opcional)..."
                              className="w-full bg-transparent text-center text-xs text-secondary placeholder:text-muted focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'spotify' && (
                      <div className="p-3 rounded-xl bg-elevated border border-border space-y-2">
                        {!block.spotifyTrackId ? (
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-[#1DB954] shrink-0" />
                            <input
                              type="text"
                              placeholder="Cole o link da música do Spotify e aperte Enter"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const id = extractSpotifyTrackId(e.currentTarget.value);
                                  if (id) updateBlock(block.id, { spotifyTrackId: id });
                                }
                              }}
                              onBlur={(e) => {
                                const id = extractSpotifyTrackId(e.currentTarget.value);
                                if (id) updateBlock(block.id, { spotifyTrackId: id });
                              }}
                              className="flex-1 bg-transparent text-xs text-primary placeholder:text-muted focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <iframe
                              src={`https://open.spotify.com/embed/track/${block.spotifyTrackId}?utm_source=generator&theme=0`}
                              width="100%"
                              height="80"
                              frameBorder="0"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                              className="rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => updateBlock(block.id, { spotifyTrackId: null })}
                              className="p-1.5 text-muted hover:text-danger"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {menuOpenForBlockId === block.id && (
                      <div className="mt-2 p-2 rounded-2xl bg-surface border border-border shadow-2xl grid grid-cols-1 sm:grid-cols-2 gap-1.5 z-30">
                        {BLOCK_MENU_ITEMS.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.type}
                              type="button"
                              onClick={() => {
                                const isCurrentEmpty =
                                  !(block.html || '').replace(/<[^>]*>/g, '').trim() &&
                                  !block.imageUrl &&
                                  !block.spotifyTrackId;

                                if (isCurrentEmpty) {
                                  updateBlock(block.id, {
                                    type: item.type,
                                    fontStyle:
                                      item.type === 'code' ? 'mono' : block.fontStyle,
                                  });
                                  setMenuOpenForBlockId(null);
                                } else {
                                  insertBlockAfter(block.id, item.type);
                                }
                              }}
                              className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-elevated text-left transition-colors"
                            >
                              <div className="p-2 rounded-lg bg-elevated border border-border text-accent shrink-0">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-primary">{item.label}</p>
                                <p className="text-[10px] text-muted">{item.desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => moveBlockStep(block.id, 'up')}
                      disabled={index === 0}
                      title="Mover para cima"
                      className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlockStep(block.id, 'down')}
                      disabled={index === blocks.length - 1}
                      title="Mover para baixo"
                      className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      title="Remover bloco"
                      className="p-1 rounded hover:bg-elevated text-muted hover:text-danger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'paragraph')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-primary hover:border-accent"
              >
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>Adicionar bloco</span>
              </button>

              <button
                type="button"
                onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'image')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent"
              >
                <ImageIcon className="w-3.5 h-3.5 text-accent" />
                <span>Imagem</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handlePublish}
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting
                ? 'Salvando...'
                : editingId
                ? 'Salvar edição'
                : 'Publicar atualização'}
            </button>
          </div>
        </div>
      )}

      {/* Linha do Tempo */}
      <div className="flex items-center gap-3 text-xs font-semibold text-secondary">
        <span>Linha do tempo</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {loading ? (
        <p className="text-xs text-muted text-center py-10">Carregando atualizações...</p>
      ) : updates.length === 0 ? (
        <p className="text-xs text-muted text-center py-10">
          Ainda não há atualizações publicadas.
        </p>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => {
            const dateStr = new Date(update.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

            return (
              <article
                key={update.id}
                id={update.id}
                className="p-5 rounded-2xl bg-surface border border-border space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-accent">
                    <Megaphone className="w-3.5 h-3.5" />
                    Atualização oficial
                  </span>
                  <span className="text-muted">Victor Poiani · {dateStr}</span>
                </div>

                {update.title && (
                  <h2 className="text-lg font-extrabold text-primary">{update.title}</h2>
                )}

                <div className="notion-content space-y-3 text-sm text-primary/90 leading-relaxed">
                  {Array.isArray(update.blocks) &&
                    update.blocks.map((rawBlock, i) => {
                      const b = normalizeLegacyBlock(rawBlock, i);
                      const fontCls = getFontClass(b.fontStyle);
                      const alignStyle = { textAlign: b.align || 'left' } as const;

                      if (b.type === 'divider') {
                        return <hr key={i} className="border-border my-3" />;
                      }

                      if (b.type === 'h1') {
                        return (
                          <h3
                            key={i}
                            style={alignStyle}
                            className={`${fontCls} text-xl font-extrabold text-primary pt-1`}
                            dangerouslySetInnerHTML={{ __html: b.html || '' }}
                          />
                        );
                      }

                      if (b.type === 'h2') {
                        return (
                          <h4
                            key={i}
                            style={alignStyle}
                            className={`${fontCls} text-base font-bold text-primary pt-1`}
                            dangerouslySetInnerHTML={{ __html: b.html || '' }}
                          />
                        );
                      }

                      if (b.type === 'quote') {
                        return (
                          <blockquote
                            key={i}
                            style={alignStyle}
                            className={`${fontCls} border-l-4 border-accent pl-4 italic text-secondary`}
                            dangerouslySetInnerHTML={{ __html: b.html || '' }}
                          />
                        );
                      }

                      if (b.type === 'callout') {
                        return (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl bg-elevated border border-accent/40 flex items-start gap-3"
                          >
                            <span className="text-lg shrink-0">{b.calloutIcon || '🚀'}</span>
                            <div
                              style={alignStyle}
                              className={`${fontCls} text-sm text-primary flex-1`}
                              dangerouslySetInnerHTML={{ __html: b.html || '' }}
                            />
                          </div>
                        );
                      }

                      if (b.type === 'code') {
                        return (
                          <pre
                            key={i}
                            className="p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary overflow-x-auto whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: b.html || '' }}
                          />
                        );
                      }

                      if (b.type === 'bullet') {
                        return (
                          <div key={i} className="flex items-start gap-2.5 pl-1">
                            <span className="text-accent font-bold">•</span>
                            <div
                              style={alignStyle}
                              className={`${fontCls} flex-1`}
                              dangerouslySetInnerHTML={{ __html: b.html || '' }}
                            />
                          </div>
                        );
                      }

                      if (b.type === 'image' && b.imageUrl) {
                        return (
                          <figure
                            key={i}
                            style={{ width: b.imageWidth || '100%' }}
                            className="mx-auto space-y-1.5"
                          >
                            <img
                              src={b.imageUrl}
                              alt={b.imageCaption || 'Atualização'}
                              className="rounded-xl border border-border w-full h-auto object-cover"
                              loading="lazy"
                            />
                            {b.imageCaption && (
                              <figcaption className="text-xs text-muted text-center">
                                {b.imageCaption}
                              </figcaption>
                            )}
                          </figure>
                        );
                      }

                      if (b.type === 'spotify' && b.spotifyTrackId) {
                        return (
                          <iframe
                            key={i}
                            src={`https://open.spotify.com/embed/track/${b.spotifyTrackId}?utm_source=generator&theme=0`}
                            width="100%"
                            height="80"
                            frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className="rounded-xl"
                          />
                        );
                      }

                      return (
                        <div
                          key={i}
                          style={alignStyle}
                          className={`${fontCls} leading-relaxed`}
                          dangerouslySetInnerHTML={{ __html: b.html || '' }}
                        />
                      );
                    })}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-secondary">
                  <div className="flex items-center gap-5">
                    <button
                      type="button"
                      onClick={() => handleLike(update)}
                      className="flex items-center gap-1.5 hover:text-accent transition-colors"
                    >
                      <Heart className="w-4 h-4" />
                      <span>{update.likes_count || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShare(update.id)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      {copiedId === update.id ? (
                        <>
                          <Check className="w-4 h-4 text-accent" />
                          <span className="text-accent">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          <span>Compartilhar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(update)}
                        title="Editar atualização"
                        className="p-1.5 rounded-lg hover:bg-elevated text-secondary hover:text-accent"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(update.id)}
                        title="Excluir atualização"
                        className="p-1.5 rounded-lg hover:bg-elevated text-secondary hover:text-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}