'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CustomTopic,
  PostBlock,
  PostBlockType,
  FontStyleType,
} from '@/types/database';
import {
  Plus,
  X,
  Trash2,
  Hash,
  ImagePlus,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Type,
  Heading2,
  Quote,
  Sparkles,
  Check,
  GripVertical,
} from 'lucide-react';

export interface FeedTabItem {
  id: string;
  label: string;
  tag: string | null; // null para 'Principal' e 'Reposts'
  color: string;
  isDefault: boolean;
  bannerUrl?: string | null;
  descriptionBlocks?: PostBlock[] | null;
}

export const DEFAULT_TABS: FeedTabItem[] = [
  { id: 'principal', label: 'Principal', tag: null, color: '#2563eb', isDefault: true },
  { id: 'artigue', label: 'Artigue', tag: 'artigue', color: '#2563eb', isDefault: true },
  { id: 'professional', label: 'Professional', tag: 'professional', color: '#2563eb', isDefault: true },
  { id: 'reposts', label: 'Reposts', tag: null, color: '#2563eb', isDefault: true },
  { id: 'jardim', label: 'Jardim', tag: 'jardim', color: '#2563eb', isDefault: true },
];

const TOPIC_COLORS = [
  '#2563eb', // Azul Metálico
  '#E63946', // Vermelho Targaryen / Crimson
  '#fbbc05', // Amarelo Vibrante
  '#1DB954', // Verde Esmeralda
  '#a855f7', // Roxo Real
  '#fb923c', // Laranja Fogo
  '#38bdf8', // Azul Gelo
];

const HIGHLIGHT_COLORS = [
  { name: 'Azul', color: 'rgba(37, 99, 235, 0.42)' },
  { name: 'Amarelo', color: 'rgba(250, 204, 21, 0.35)' },
  { name: 'Vermelho', color: 'rgba(239, 68, 68, 0.38)' },
  { name: 'Verde', color: 'rgba(29, 185, 84, 0.35)' },
];

function createDescBlock(type: PostBlockType = 'paragraph'): PostBlock {
  return {
    id: `tblk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    html: '',
    fontStyle: 'sans',
    align: 'left',
    calloutIcon: '🐉',
  };
}

interface MiniNotionBlockProps {
  block: PostBlock;
  onFocus: () => void;
  onChangeHtml: (html: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
}

function MiniNotionEditable({
  block,
  onFocus,
  onChangeHtml,
  onEnter,
  onBackspaceEmpty,
}: MiniNotionBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement !== ref.current && ref.current.innerHTML !== (block.html || '')) {
      ref.current.innerHTML = block.html || '';
    }
  }, [block.html, block.type]);

  const fontCls =
    block.fontStyle === 'serif'
      ? 'font-serif'
      : block.fontStyle === 'mono'
      ? 'font-mono text-xs'
      : 'font-sans';

  const typeCls =
    block.type === 'h2'
      ? 'text-base font-extrabold text-primary'
      : block.type === 'quote'
      ? 'border-l-3 border-accent pl-3 italic text-secondary text-xs sm:text-sm'
      : 'text-xs sm:text-sm text-primary leading-relaxed';

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Escreva a introdução ou regras deste tópico (selecione o texto para grifar ou formatar)..."
      onFocus={onFocus}
      onInput={(e) => {
        const html = e.currentTarget.innerHTML;
        onChangeHtml(html === '<br>' ? '' : html);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onEnter();
        } else if (
          e.key === 'Backspace' &&
          e.currentTarget.innerText.replace(/\n/g, '').trim().length === 0
        ) {
          e.preventDefault();
          onBackspaceEmpty();
        }
      }}
      className={`notion-editable w-full focus:outline-none break-words ${fontCls} ${typeCls}`}
    />
  );
}

interface TopicTabsManagerProps {
  activeTabId: string;
  onSelectTab: (tab: FeedTabItem) => void;
  isAdmin: boolean;
}

export function TopicTabsManager({
  activeTabId,
  onSelectTab,
  isAdmin,
}: TopicTabsManagerProps) {
  const [customTopics, setCustomTopics] = useState<CustomTopic[]>([]);
  const [expandCreate, setExpandCreate] = useState(false);

  // Estados do formulário de Novo Tópico
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [color, setColor] = useState('#E63946');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [descBlocks, setDescBlocks] = useState<PostBlock[]>(() => [
    createDescBlock('paragraph'),
  ]);
  const [activeBlockId, setActiveBlockId] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadCustomTopics();
  }, []);

  async function loadCustomTopics() {
    const { data } = await supabase
      .from('custom_topics')
      .select('*')
      .order('created_at', { ascending: true });

    if (data) {
      setCustomTopics(data as CustomTopic[]);
    }
  }

  const allTabs: FeedTabItem[] = [
    ...DEFAULT_TABS,
    ...customTopics.map((ct) => ({
      id: ct.id,
      label: ct.name,
      tag: ct.tag,
      color: ct.color || '#2563eb',
      isDefault: false,
      bannerUrl: ct.banner_url,
      descriptionBlocks: ct.description_blocks,
    })),
  ];

  const currentTab = allTabs.find((t) => t.id === activeTabId) || DEFAULT_TABS[0];
  const activeBlock =
    descBlocks.find((b) => b.id === activeBlockId) || descBlocks[0];

  function applyInlineFormat(command: string, value?: string) {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
  }

  function updateDescBlock(id: string, patch: Partial<PostBlock>) {
    setDescBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }

  function insertDescBlockAfter(id: string, type: PostBlockType = 'paragraph') {
    const next = createDescBlock(type);
    setDescBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const copy = [...prev];
      copy.splice(idx + 1, 0, next);
      return copy;
    });
    setActiveBlockId(next.id);
  }

  function removeDescBlock(id: string) {
    setDescBlocks((prev) =>
      prev.length <= 1
        ? [createDescBlock('paragraph')]
        : prev.filter((b) => b.id !== id)
    );
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    const ext = file.name.split('.').pop();
    const fileName = `topics/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

    let bucket = 'cover';
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) {
      bucket = 'posts';
      const { error: fallbackErr } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);
      if (fallbackErr) {
        setUploadingBanner(false);
        alert('Erro ao enviar banner: ' + fallbackErr.message);
        return;
      }
    }

    setUploadingBanner(false);
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    setBannerUrl(data.publicUrl);
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanTag = (tag.trim() || cleanName)
      .toLowerCase()
      .replace(/^#/, '')
      .replace(/\s+/g, '');

    if (!cleanName || !cleanTag || saving) return;

    setSaving(true);

    const validBlocks = descBlocks.filter(
      (b) => (b.html || '').replace(/<[^>]*>/g, '').trim().length > 0
    );

    const { data, error } = await supabase
      .from('custom_topics')
      .insert({
        name: cleanName,
        tag: cleanTag,
        color,
        banner_url: bannerUrl,
        description_blocks: validBlocks,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert('Erro ao criar tópico: ' + error.message);
      return;
    }

    if (data) {
      const created = data as CustomTopic;
      setCustomTopics((prev) => [...prev, created]);
      setName('');
      setTag('');
      setBannerUrl(null);
      setDescBlocks([createDescBlock('paragraph')]);
      setExpandCreate(false);

      onSelectTab({
        id: created.id,
        label: created.name,
        tag: created.tag,
        color: created.color,
        isDefault: false,
        bannerUrl: created.banner_url,
        descriptionBlocks: created.description_blocks,
      });
    }
  }

  async function handleDeleteTopic(topicToDelete: FeedTabItem) {
    if (topicToDelete.isDefault) return; // Proteção absoluta para tópicos padrão

    const confirmed = confirm(
      `Excluir o tópico "${topicToDelete.label}" (#${topicToDelete.tag})? Os posts com essa tag continuarão salvos no feed Principal.`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('custom_topics')
      .delete()
      .eq('id', topicToDelete.id);

    if (!error) {
      setCustomTopics((prev) => prev.filter((t) => t.id !== topicToDelete.id));
      if (activeTabId === topicToDelete.id) {
        onSelectTab(DEFAULT_TABS[0]);
      }
    } else {
      alert('Erro ao excluir tópico: ' + error.message);
    }
  }

  return (
    <div className="border-b border-border bg-background">
      {/* 1. Barra de Abas Horizontais Responsiva + Botão '+' */}
      <div className="flex items-center justify-between px-4 sm:px-6 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-5 sm:gap-7 min-w-max">
          {allTabs.map((tab) => {
            const isActive = tab.id === currentTab.id;
            return (
              <div key={tab.id} className="relative flex items-center group">
                <button
                  type="button"
                  onClick={() => onSelectTab(tab)}
                  style={{
                    color: isActive ? tab.color : undefined,
                  }}
                  className={`py-3.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'text-primary'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {!tab.isDefault && (
                    <span
                      style={{ backgroundColor: tab.color }}
                      className="w-2 h-2 rounded-full shrink-0"
                    />
                  )}
                  <span>{tab.label}</span>
                </button>

                {/* Botão rápido de excluir nas abas criadas pelo usuário (exceto padrão) */}
                {isAdmin && !tab.isDefault && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTopic(tab);
                    }}
                    title={`Excluir tópico ${tab.label}`}
                    className="ml-1 p-0.5 rounded text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Indicador inferior colorido ativo */}
                {isActive && (
                  <span
                    style={{ backgroundColor: tab.color }}
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full"
                  />
                )}
              </div>
            );
          })}

          {/* Botão '+' para Criar Novo Tópico (Mesma dinâmica de card expansível) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setExpandCreate(!expandCreate)}
              title="Criar novo tópico personalizado"
              className={`w-7 h-7 my-2 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                expandCreate
                  ? 'bg-accent text-white border-accent'
                  : 'bg-elevated border-border text-secondary hover:text-accent hover:border-accent'
              }`}
            >
              {expandCreate ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Card Expansível Inline: Criar Novo Tópico (Sem Modal) */}
      {isAdmin && expandCreate && (
        <form
          onSubmit={handleCreateTopic}
          className="mx-4 sm:mx-6 my-4 p-4 sm:p-5 rounded-2xl bg-surface border border-border space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-accent uppercase tracking-wider">
              Criar Novo Tópico no Feed
            </span>
            <button
              type="button"
              onClick={() => setExpandCreate(false)}
              className="text-muted hover:text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nome, Hashtag específica e Cor de destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">
                Nome da Aba (ex: Game of Thrones)
              </label>
              <input
                type="text"
                required
                maxLength={32}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!tag) {
                    setTag(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '')
                    );
                  }
                }}
                placeholder="Ex: Game of Thrones"
                className="w-full bg-elevated border border-border rounded-xl px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-[11px] text-muted block mb-1">
                Hashtag vinculada (filtra os posts deste tópico)
              </label>
              <div className="flex items-center bg-elevated border border-border rounded-xl px-3 py-2 focus-within:border-accent">
                <Hash className="w-3.5 h-3.5 text-accent mr-1 shrink-0" />
                <input
                  type="text"
                  required
                  maxLength={28}
                  value={tag}
                  onChange={(e) =>
                    setTag(
                      e.target.value
                        .toLowerCase()
                        .replace(/^#/, '')
                        .replace(/\s+/g, '')
                    )
                  }
                  placeholder="gameofthrones"
                  className="w-full bg-transparent text-xs text-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seletor de Cor de Destaque */}
          <div>
            <label className="text-[11px] text-muted block mb-1.5">
              Cor de destaque do tópico
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              {TOPIC_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color.toLowerCase() === c.toLowerCase()
                      ? 'border-white scale-110'
                      : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Upload de Banner Opcional do Tópico */}
          <div>
            <label className="text-[11px] text-muted block mb-1.5">
              Banner superior do tópico (opcional)
            </label>
            {!bannerUrl ? (
              <div
                onClick={() => bannerInputRef.current?.click()}
                className="h-28 rounded-xl bg-elevated border border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <ImagePlus className="w-5 h-5 text-accent" />
                <span className="text-xs font-semibold text-secondary">
                  {uploadingBanner
                    ? 'Enviando banner...'
                    : 'Clique para adicionar uma imagem de capa ao tópico'}
                </span>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative h-36 rounded-xl overflow-hidden border border-border group">
                <img
                  src={bannerUrl}
                  alt="Preview do banner"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setBannerUrl(null)}
                  className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-black"
                >
                  <X className="w-3 h-3" />
                  <span>Remover capa</span>
                </button>
              </div>
            )}
          </div>

          {/* Mini Editor Estilo Notion para a Descrição do Tópico */}
          <div className="space-y-2">
            <label className="text-[11px] text-muted block">
              Apresentação do Tópico (Editor Estilo Notion — opcional)
            </label>

            <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-elevated border border-border">
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
                    if (activeBlock)
                      updateDescBlock(activeBlock.id, { fontStyle: f.key });
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    (activeBlock?.fontStyle || 'sans') === f.key
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <div className="h-3.5 w-px bg-border mx-1" />

              <button
                type="button"
                title="Negrito"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('bold');
                }}
                className="p-1 rounded text-secondary hover:text-primary"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Itálico"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('italic');
                }}
                className="p-1 rounded text-secondary hover:text-primary"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Sublinhar"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('underline');
                }}
                className="p-1 rounded text-secondary hover:text-primary"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>

              {HIGHLIGHT_COLORS.map((hc) => (
                <button
                  key={hc.name}
                  type="button"
                  title={`Grifar ${hc.name}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyInlineFormat('hiliteColor', hc.color);
                  }}
                  style={{ backgroundColor: hc.color }}
                  className="w-4 h-4 rounded-full border border-white/20 mx-0.5"
                />
              ))}

              <div className="h-3.5 w-px bg-border mx-1" />

              <button
                type="button"
                title="Subtítulo"
                onClick={() =>
                  activeBlock &&
                  updateDescBlock(activeBlock.id, {
                    type: activeBlock.type === 'h2' ? 'paragraph' : 'h2',
                  })
                }
                className="p-1 rounded text-secondary hover:text-accent"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Citação"
                onClick={() =>
                  activeBlock &&
                  updateDescBlock(activeBlock.id, {
                    type: activeBlock.type === 'quote' ? 'paragraph' : 'quote',
                  })
                }
                className="p-1 rounded text-secondary hover:text-accent"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Callout"
                onClick={() =>
                  activeBlock &&
                  updateDescBlock(activeBlock.id, {
                    type:
                      activeBlock.type === 'callout' ? 'paragraph' : 'callout',
                  })
                }
                className="p-1 rounded text-secondary hover:text-accent"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-elevated border border-border space-y-2">
              {descBlocks.map((b, idx) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIdx === null || draggedIdx === idx) return;
                    setDescBlocks((prev) => {
                      const copy = [...prev];
                      const [moved] = copy.splice(draggedIdx, 1);
                      copy.splice(idx, 0, moved);
                      return copy;
                    });
                    setDraggedIdx(null);
                  }}
                  className="flex items-start gap-2 group"
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted mt-1 cursor-grab opacity-40 group-hover:opacity-100 shrink-0" />
                  {b.type === 'callout' ? (
                    <div className="flex-1 p-2.5 rounded-lg bg-surface border border-border flex items-start gap-2">
                      <input
                        type="text"
                        maxLength={2}
                        value={b.calloutIcon || '🐉'}
                        onChange={(e) =>
                          updateDescBlock(b.id, { calloutIcon: e.target.value })
                        }
                        className="w-6 bg-transparent text-center focus:outline-none"
                      />
                      <MiniNotionEditable
                        block={b}
                        onFocus={() => setActiveBlockId(b.id)}
                        onChangeHtml={(html) => updateDescBlock(b.id, { html })}
                        onEnter={() => insertDescBlockAfter(b.id)}
                        onBackspaceEmpty={() => removeDescBlock(b.id)}
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <MiniNotionEditable
                        block={b}
                        onFocus={() => setActiveBlockId(b.id)}
                        onChangeHtml={(html) => updateDescBlock(b.id, { html })}
                        onEnter={() => insertDescBlockAfter(b.id)}
                        onBackspaceEmpty={() => removeDescBlock(b.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setExpandCreate(false)}
              className="px-3.5 py-1.5 rounded-xl bg-elevated text-xs text-secondary hover:text-primary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: color }}
              className="px-4 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:opacity-95 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? 'Criando...' : 'Criar Tópico'}</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. Banner Superior e Apresentação do Tópico Ativo (Apenas para Tópicos Personalizados) */}
      {!currentTab.isDefault && (
        <div className="mx-4 sm:mx-6 my-4 rounded-2xl overflow-hidden border border-border bg-surface">
          {currentTab.bannerUrl && (
            <div className="relative w-full h-36 sm:h-48 bg-elevated overflow-hidden border-b border-border">
              <img
                src={currentTab.bannerUrl}
                alt={currentTab.label}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                <div>
                  <span
                    style={{ backgroundColor: currentTab.color }}
                    className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white uppercase tracking-wider mb-1"
                  >
                    #{currentTab.tag}
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-white drop-shadow">
                    {currentTab.label}
                  </h2>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTopic(currentTab)}
                    className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-danger text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir tópico</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-4 space-y-2.5">
            {!currentTab.bannerUrl && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    style={{ backgroundColor: currentTab.color }}
                    className="w-3 h-3 rounded-full shrink-0"
                  />
                  <h2 className="text-base sm:text-lg font-extrabold text-primary">
                    {currentTab.label}
                  </h2>
                  <span
                    style={{ color: currentTab.color }}
                    className="text-xs font-bold"
                  >
                    #{currentTab.tag}
                  </span>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTopic(currentTab)}
                    className="px-2.5 py-1 rounded-lg bg-elevated border border-border hover:border-danger text-xs text-secondary hover:text-danger flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir tópico</span>
                  </button>
                )}
              </div>
            )}

            {Array.isArray(currentTab.descriptionBlocks) &&
              currentTab.descriptionBlocks.length > 0 && (
                <div className="notion-content space-y-2 text-xs sm:text-sm text-primary/90 leading-relaxed">
                  {currentTab.descriptionBlocks.map((b, i) => {
                    const fontCls =
                      b.fontStyle === 'serif'
                        ? 'font-serif'
                        : b.fontStyle === 'mono'
                        ? 'font-mono text-xs'
                        : 'font-sans';

                    if (b.type === 'h2') {
                      return (
                        <h3
                          key={b.id || i}
                          className={`${fontCls} text-sm sm:text-base font-extrabold text-primary`}
                          dangerouslySetInnerHTML={{ __html: b.html || '' }}
                        />
                      );
                    }
                    if (b.type === 'quote') {
                      return (
                        <blockquote
                          key={b.id || i}
                          style={{ borderColor: currentTab.color }}
                          className={`${fontCls} border-l-3 pl-3 italic text-secondary`}
                          dangerouslySetInnerHTML={{ __html: b.html || '' }}
                        />
                      );
                    }
                    if (b.type === 'callout') {
                      return (
                        <div
                          key={b.id || i}
                          className="p-2.5 rounded-xl bg-elevated border border-border flex items-start gap-2"
                        >
                          <span>{b.calloutIcon || '🐉'}</span>
                          <div
                            className={`${fontCls} flex-1`}
                            dangerouslySetInnerHTML={{ __html: b.html || '' }}
                          />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={b.id || i}
                        className={fontCls}
                        dangerouslySetInnerHTML={{ __html: b.html || '' }}
                      />
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}