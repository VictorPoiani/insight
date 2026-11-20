'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Lock, Play, Sparkles, Zap } from 'lucide-react';
import {
  IntroItem,
  KIND_LABELS,
  NITRO_COLLECTIONS,
  NITRO_ITEMS,
  NitroCollectionId,
  NitroCosmetics,
  NitroItem,
  NitroKind,
  describeRequirement,
  getCollection,
} from '@/lib/nitro/catalog';
import { useNitro } from '@/components/nitro/NitroProvider';
import {
  CosmeticAvatar,
  CosmeticName,
  CosmeticTag,
  FramePreview,
  TagPill,
  TitleText,
} from '@/components/nitro/Cosmetics';
import { IntroOverlay } from '@/components/nitro/ProfileIntro';
import { NitroSettingsPanel } from '@/components/nitro/NitroSettingsPanel';
import { AsteriskLoader } from '@/components/ui/AsteriskLoader';

const KIND_ORDER: NitroKind[] = ['frame', 'title', 'tag', 'intro'];
const KIND_PARAM: Record<string, NitroKind> = {
  frame: 'frame',
  moldura: 'frame',
  title: 'title',
  titulo: 'title',
  tag: 'tag',
  intro: 'intro',
  abertura: 'intro',
};

const RARITY_CLASS: Record<string, string> = {
  comum: 'text-zinc-400',
  rara: 'text-sky-400',
  épica: 'text-fuchsia-400',
  lendária: 'text-amber-400',
};

function LockedScreen() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 gap-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/25 blur-2xl" />
        <div className="relative w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
          <Lock className="w-7 h-7 text-accent" />
        </div>
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-extrabold text-primary">
          Insight <span className="text-accent">Nitro</span>
        </h1>
        <p className="text-sm text-secondary max-w-sm">
          Molduras animadas, títulos especiais, tags e animações de abertura para o seu perfil.
        </p>
        <p className="text-xs text-muted">Em breve · acesso restrito durante a beta fechada.</p>
      </div>
      <Link href="/" className="text-xs font-semibold text-accent hover:underline">
        Voltar para o início
      </Link>
    </div>
  );
}

function slotOf(kind: NitroKind): keyof NitroCosmetics {
  return kind;
}

function NitroGallery() {
  const { ready, viewer, hasAccess, saveCosmetics } = useNitro();
  const searchParams = useSearchParams();

  const [kind, setKind] = useState<NitroKind>(
    () => KIND_PARAM[searchParams.get('tab') || ''] || 'frame'
  );
  const [collection, setCollection] = useState<NitroCollectionId | 'all'>('all');
  const [draft, setDraft] = useState<NitroCosmetics>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [testingIntro, setTestingIntro] = useState<IntroItem | null>(null);

  const savedCosmetics = viewer?.cosmetics || {};

  useEffect(() => {
    if (viewer) setDraft(viewer.cosmetics || {});
    // Inicializa o rascunho quando o perfil carrega
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer?.id]);

  const dirty = useMemo(() => {
    const keys: (keyof NitroCosmetics)[] = [
      'frame', 'title', 'tag', 'intro', 'frameEnabled', 'frameAnimated', 'introEnabled', 'levelAnimation',
    ];
    const norm = (v: unknown, k: keyof NitroCosmetics) =>
      v === undefined || v === null ? (k.endsWith('Enabled') || k.endsWith('Animated') || k === 'levelAnimation' ? true : null) : v;
    return keys.some((k) => norm(draft[k], k) !== norm(savedCosmetics[k], k));
  }, [draft, savedCosmetics]);

  const items = useMemo(
    () =>
      NITRO_ITEMS.filter(
        (i) =>
          i.kind === kind &&
          (collection === 'all' || i.collection === collection) &&
          // Aberturas de patente tocam automaticamente pelo nível; não são equipáveis
          !(i.kind === 'intro' && i.collection === 'patentes')
      ),
    [kind, collection]
  );

  const tierIntros = useMemo(
    () => NITRO_ITEMS.filter((i): i is IntroItem => i.kind === 'intro' && i.collection === 'patentes'),
    []
  );

  if (!ready) return <AsteriskLoader size="lg" fullHeight label="Carregando Nitro..." />;
  if (!hasAccess || !viewer) return <LockedScreen />;

  const level = viewer.contributor_level ?? 0;
  const displayName = viewer.display_name || viewer.full_name || viewer.username;
  const avatar = viewer.avatar_url || '/assets/net/default-perfil';

  function toggleItem(item: NitroItem) {
    const slot = slotOf(item.kind);
    setDraft((prev) => ({ ...prev, [slot]: prev[slot] === item.id ? null : item.id }));
    setStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveCosmetics(draft);
    setSaving(false);
    setStatus(res.ok ? 'Salvo! Seu perfil já está atualizado.' : `Erro ao salvar: ${res.error}`);
  }

  return (
    <div className="w-full pb-24 md:pb-10">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-3 sm:px-5 h-14 flex items-center gap-3">
        <Link href="/" aria-label="Voltar" className="p-2 rounded-full hover:bg-surface text-primary">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-extrabold text-primary flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-accent" /> Insight Nitro
          </h1>
          <p className="text-[11px] text-muted">Galeria de personalização de perfil</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
          <Lock className="w-3 h-3" /> Beta fechada · admin
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-0 xl:gap-5">
        {/* Coluna da galeria */}
        <div className="min-w-0">
          {/* Prévia (mobile e telas médias) */}
          <div className="xl:hidden px-4 sm:px-6 pt-5">
            <PreviewCard
              draft={draft}
              viewer={viewer}
              displayName={displayName}
              avatar={avatar}
              dirty={dirty}
              saving={saving}
              status={status}
              onSave={handleSave}
              onTestIntro={() => {
                const it = NITRO_ITEMS.find((i) => i.id === draft.intro && i.kind === 'intro') as IntroItem | undefined;
                if (it) setTestingIntro(it);
              }}
            />
          </div>

          {/* Coleções */}
          <div className="px-4 sm:px-6 pt-5">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCollection('all')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  collection === 'all' ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-secondary hover:text-primary'
                }`}
              >
                Todas
              </button>
              {NITRO_COLLECTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCollection(c.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    collection === c.id ? 'text-white border-transparent' : 'bg-surface border-border text-secondary hover:text-primary'
                  }`}
                  style={
                    collection === c.id
                      ? { background: `linear-gradient(90deg, ${c.colors[0]}, ${c.colors[1]})` }
                      : undefined
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${c.colors[0]}, ${c.colors[1]})` }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Categorias */}
          <div className="px-4 sm:px-6 pt-3 border-b border-border">
            <div className="flex gap-1">
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                    kind === k ? 'border-accent text-primary' : 'border-transparent text-muted hover:text-primary'
                  }`}
                >
                  {KIND_LABELS[k].plural}
                </button>
              ))}
            </div>
          </div>

          {kind === 'frame' && (collection === 'all' || collection === 'patentes') && (
            <p className="px-4 sm:px-6 pt-3 text-[11px] text-muted">
              Molduras de <strong className="text-secondary">Patentes</strong> acompanham os níveis de contribuinte; só as dos níveis 4 e 5 são animadas.
            </p>
          )}

          {/* Grade de itens */}
          <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                equipped={draft[slotOf(item.kind)] === item.id}
                avatar={avatar}
                displayName={displayName}
                onToggle={() => toggleItem(item)}
                onTest={item.kind === 'intro' ? () => setTestingIntro(item as IntroItem) : undefined}
              />
            ))}
            {items.length === 0 && (
              <p className="col-span-full py-10 text-center text-xs text-muted">
                Nenhum item desta categoria nesta coleção.
              </p>
            )}
          </div>

          {kind === 'intro' && (
            <div className="px-4 sm:px-6 pb-6">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                Aberturas de patente (automáticas nos níveis 4 e 5)
              </h3>
              <div className="flex flex-wrap gap-2">
                {tierIntros.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTestingIntro(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface text-xs text-secondary hover:text-primary"
                  >
                    <Play className="w-3 h-3" /> {t.name} · {describeRequirement(t.requirement)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="xl:hidden px-4 sm:px-6 pb-8">
            <div className="p-4 rounded-2xl bg-surface border border-border">
              <NitroSettingsPanel value={draft} onChange={setDraft} level={level} showEquipped />
            </div>
          </div>
        </div>

        {/* Coluna lateral (desktop largo) */}
        <aside className="hidden xl:block pr-5 pt-5">
          <div className="sticky top-20 space-y-4">
            <PreviewCard
              draft={draft}
              viewer={viewer}
              displayName={displayName}
              avatar={avatar}
              dirty={dirty}
              saving={saving}
              status={status}
              onSave={handleSave}
              onTestIntro={() => {
                const it = NITRO_ITEMS.find((i) => i.id === draft.intro && i.kind === 'intro') as IntroItem | undefined;
                if (it) setTestingIntro(it);
              }}
            />
            <div className="p-4 rounded-2xl bg-surface border border-border">
              <NitroSettingsPanel value={draft} onChange={setDraft} level={level} showEquipped />
            </div>
          </div>
        </aside>
      </div>

      {testingIntro && <IntroOverlay intro={testingIntro} onDone={() => setTestingIntro(null)} />}
    </div>
  );
}

function PreviewCard({
  draft,
  viewer,
  displayName,
  avatar,
  dirty,
  saving,
  status,
  onSave,
  onTestIntro,
}: {
  draft: NitroCosmetics;
  viewer: { id: string; username: string };
  displayName: string;
  avatar: string;
  dirty: boolean;
  saving: boolean;
  status: string | null;
  onSave: () => void;
  onTestIntro: () => void;
}) {
  return (
    <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
      <div className="flex flex-col items-center text-center gap-3 pt-3">
        <CosmeticAvatar profile={viewer} size={96} preview={draft} live>
          <img src={avatar} alt={displayName} className="w-24 h-24 rounded-full object-cover bg-elevated" />
        </CosmeticAvatar>
        <div className="min-w-0 max-w-full">
          <p className="text-lg font-extrabold text-primary truncate">
            <CosmeticName profile={viewer} preview={draft}>
              {displayName}
            </CosmeticName>
          </p>
          <p className="text-xs text-muted flex items-center justify-center gap-1.5 flex-wrap">
            <span>@{viewer.username}</span>
            <CosmeticTag profile={viewer} preview={draft} />
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onTestIntro}
          disabled={!draft.intro}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold text-secondary hover:text-primary disabled:opacity-40"
        >
          <Play className="w-3.5 h-3.5" /> Abertura
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold disabled:opacity-40"
        >
          <Check className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      {dirty && !saving && <p className="text-[11px] text-amber-400 text-center">Alterações não salvas</p>}
      {status && <p className="text-[11px] text-center text-secondary">{status}</p>}
    </div>
  );
}

function ItemCard({
  item,
  equipped,
  avatar,
  displayName,
  onToggle,
  onTest,
}: {
  item: NitroItem;
  equipped: boolean;
  avatar: string;
  displayName: string;
  onToggle: () => void;
  onTest?: () => void;
}) {
  const coll = getCollection(item.collection);

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border bg-surface overflow-hidden transition-colors ${
        equipped ? 'border-accent ring-1 ring-accent/50' : 'border-border hover:border-accent/50'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="relative h-32 flex items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${coll.colors[0]}33, transparent 70%), linear-gradient(160deg, ${coll.colors[1]}22, transparent)`,
        }}
        aria-label={`${equipped ? 'Remover' : 'Equipar'} ${item.name}`}
      >
        {item.kind === 'frame' && (
          <FramePreview frameId={item.id} size={60} live>
            <img src={avatar} alt="" className="w-[60px] h-[60px] rounded-full object-cover bg-elevated" />
          </FramePreview>
        )}
        {item.kind === 'title' && (
          <span className="px-2 text-lg font-extrabold max-w-full truncate">
            <TitleText title={item}>{displayName}</TitleText>
          </span>
        )}
        {item.kind === 'tag' && <TagPill tagId={item.id} className="scale-125" />}
        {item.kind === 'intro' && (
          <span className="flex flex-col items-center gap-1.5 text-secondary">
            <Sparkles className="w-7 h-7" style={{ color: coll.colors[0] }} />
            <span className="text-[10px] font-mono">{(item.durationMs / 1000).toFixed(1)}s</span>
          </span>
        )}
        {equipped && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
            <Check className="w-3 h-3" />
          </span>
        )}
      </button>

      <div className="p-3 flex-1 flex flex-col gap-1.5 border-t border-border">
        <p className="text-xs font-bold text-primary leading-tight">{item.name}</p>
        <p className="text-[10px] text-muted leading-snug line-clamp-2">{item.description}</p>
        <div className="mt-auto pt-1 flex items-center justify-between gap-1 text-[10px]">
          <span className="text-secondary truncate">
            {coll.name} · <span className={RARITY_CLASS[item.rarity]}>{item.rarity}</span>
          </span>
          <span className="shrink-0 px-1.5 py-0.5 rounded bg-elevated border border-border text-muted">
            {describeRequirement(item.requirement)}
          </span>
        </div>
        <div className="flex gap-1.5 pt-1">
          {onTest && (
            <button
              type="button"
              onClick={onTest}
              className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full border border-border text-[11px] text-secondary hover:text-primary"
            >
              <Play className="w-3 h-3" /> Testar
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className={`flex-1 px-2 py-1 rounded-full text-[11px] font-bold transition-colors ${
              equipped ? 'bg-elevated border border-border text-secondary hover:text-danger' : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {equipped ? 'Remover' : 'Equipar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NitroPage() {
  return (
    <Suspense fallback={<AsteriskLoader size="lg" fullHeight />}>
      <NitroGallery />
    </Suspense>
  );
}
