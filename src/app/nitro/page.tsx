'use client';

import { ask as confirmDialog } from '@/lib/ui/feedback';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  getNitroItem,
  NITRO_BUNDLES,
  type NitroBundle,
} from '@/lib/nitro/catalog';
import { useNitro } from '@/components/nitro/NitroProvider';
import {
  CosmeticAvatar,
  CosmeticName,
  CosmeticTag,
  FramePreview,
  NameFont,
  NitroBadge,
  TagPill,
  TitleText,
} from '@/components/nitro/Cosmetics';
import { IntroOverlay } from '@/components/nitro/ProfileIntro';
import { NitroSettingsPanel } from '@/components/nitro/NitroSettingsPanel';
import { AsteriskLoader } from '@/components/ui/AsteriskLoader';
import { ThemeMiniature } from '@/components/nitro/ThemeMiniature';
import { createClient } from '@/lib/supabase/client';
import { NITRO_PUBLIC, describeNitroSource } from '@/lib/nitro/entitlement';
import type { LockReason } from '@/lib/nitro/access';
import { useNitroBilling } from '@/lib/nitro/useNitroBilling';


/** Status do Nitro + convite do grupo VIP (só vem do banco para quem tem acesso). */
function NitroStatusCard() {
  const { entitlement, viewer } = useNitro();
  const [vip, setVip] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const subscribed =
    entitlement.source === 'subscription' && (viewer?.nitro_status === 'active' || viewer?.nitro_status === 'past_due');

  async function cancel() {
    if (!(await confirmDialog({ message: 'Cancelar a assinatura do Nitro? Você continua com tudo até o fim do período já pago.', danger: true }))) return;
    setCanceling(true);
    const res = await fetch('/api/nitro/cancel', { method: 'POST' }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setCanceling(false);
    setCancelMsg(
      res?.ok
        ? `Assinatura cancelada. O Nitro segue ativo${entitlement.expiresAt ? ` até ${entitlement.expiresAt.toLocaleDateString('pt-BR')}` : ' até o fim do período pago'}.`
        : data.error || 'Não foi possível cancelar agora.'
    );
    if (res?.ok) setTimeout(() => window.location.reload(), 1800);
  }

  useEffect(() => {
    let active = true;
    createClient()
      .rpc('get_nitro_vip_invite')
      .then(({ data }) => {
        if (active && typeof data === 'string' && /^https:\/\/chat\.whatsapp\.com\//.test(data)) setVip(data);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[180px]">
        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-accent" /> Seu Nitro
        </p>
        <p className="text-[11px] text-muted">{describeNitroSource(entitlement)}</p>
        <p className="text-[10px] text-muted mt-0.5">
          Só cosméticos e comunidade VIP. Limites de upload, tópicos e comunidades vêm do seu Nível de Contribuinte.
        </p>
        {cancelMsg && <p className="text-[11px] text-amber-400 mt-1">{cancelMsg}</p>}
      </div>
      {subscribed && (
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={canceling}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-secondary hover:text-danger hover:border-danger/50 disabled:opacity-50"
        >
          {canceling ? 'Cancelando…' : 'Cancelar assinatura'}
        </button>
      )}
      {vip && (
        <a
          href={vip}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors"
        >
          Grupo VIP no WhatsApp
        </a>
      )}
    </div>
  );
}

const KIND_ORDER: NitroKind[] = ['frame', 'theme', 'title', 'font', 'tag', 'intro'];
const KIND_PARAM: Record<string, NitroKind> = {
  frame: 'frame',
  moldura: 'frame',
  title: 'title',
  titulo: 'title',
  tag: 'tag',
  intro: 'intro',
  abertura: 'intro',
  theme: 'theme',
  tema: 'theme',
  temas: 'theme',
  font: 'font',
  fonte: 'font',
  nome: 'font',
};

const RARITY_CLASS: Record<string, string> = {
  comum: 'text-zinc-400',
  rara: 'text-sky-400',
  épica: 'text-fuchsia-400',
  lendária: 'text-amber-400',
};

function slotOf(kind: NitroKind): keyof NitroCosmetics {
  return kind;
}

function NitroGallery() {
  const { ready, viewer, hasAccess, saveCosmetics, setPreviewTheme, lockReason } = useNitro();
  const billing = useNitroBilling();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [kind, setKind] = useState<NitroKind>(
    () => KIND_PARAM[searchParams.get('tab') || ''] || 'frame'
  );
  const [collection, setCollection] = useState<NitroCollectionId | 'all'>('all');
  const [draft, setDraft] = useState<NitroCosmetics>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [testingIntro, setTestingIntro] = useState<IntroItem | null>(null);

  const savedCosmetics = viewer?.cosmetics || {};

  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (viewer) setDraft(viewer.cosmetics || {});
    setDraftReady(true);
    // Inicializa o rascunho quando o perfil carrega
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, viewer?.id]);

  // Provador: o tema escolhido aparece no app inteiro enquanto você está aqui
  useEffect(() => {
    if (draftReady) setPreviewTheme(draft.theme ?? 'none');
  }, [draftReady, draft.theme, setPreviewTheme]);
  useEffect(() => () => setPreviewTheme(null), [setPreviewTheme]);

  const dirty = useMemo(() => {
    const keys: (keyof NitroCosmetics)[] = [
      'frame', 'title', 'tag', 'intro', 'font', 'theme', 'frameEnabled', 'frameAnimated', 'introEnabled', 'levelAnimation', 'rainbow',
    ];
    const norm = (v: unknown, k: keyof NitroCosmetics) =>
      v === undefined || v === null ? (k.endsWith('Enabled') || k.endsWith('Animated') || k === 'levelAnimation' || k === 'rainbow' ? true : null) : v;
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
  // Todos navegam e experimentam; cada um salva só o que pode usar:
  // itens de patente pelo nível (exclusivos) e o resto com o Nitro.
  const previewOnly = !viewer;
  const lockedInDraft = (['frame', 'title', 'tag', 'intro', 'font', 'theme'] as const)
    .map((slot) => (draft[slot] ? NITRO_ITEMS.find((i) => i.id === draft[slot] && i.kind === slot) : null))
    .filter((i): i is NitroItem => !!i && lockReason(i) !== null);
  const me = viewer
    ? { id: viewer.id, username: viewer.username, cosmetics: viewer.cosmetics }
    : { id: 'nitro-preview', username: 'voce', cosmetics: null };
  const level = viewer?.contributor_level ?? 0;
  const displayName = viewer?.display_name || viewer?.full_name || viewer?.username || 'Seu nome';
  const avatar = viewer?.avatar_url || '/assets/net/default-perfil';

  function toggleItem(item: NitroItem) {
    const slot = slotOf(item.kind);
    setDraft((prev) => ({ ...prev, [slot]: prev[slot] === item.id ? null : item.id }));
    setStatus(null);
  }

  async function handleSave() {
    if (previewOnly) {
      router.push('/login');
      return;
    }
    setSaving(true);
    const res = await saveCosmetics(draft);
    setSaving(false);
    setStatus(
      !res.ok
        ? `Erro ao salvar: ${res.error}`
        : lockedInDraft.length
          ? `Salvo! ${lockedInDraft.map((i) => i.name).join(', ')} ${lockedInDraft.length > 1 ? 'ficaram' : 'ficou'} só no provador (cadeado).`
          : 'Salvo! Seu perfil já está atualizado.'
    );
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
        {(!NITRO_PUBLIC || !billing.enabled) && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
            <Lock className="w-3 h-3" /> {!NITRO_PUBLIC ? (hasAccess ? 'Beta fechada · admin' : 'Em breve') : 'Assinatura em breve'}
          </span>
        )}
        <Link
          href="/nitro/assinar"
          className="nx-cta-mini inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-xs font-bold"
        >
          <Zap className="w-3.5 h-3.5" /> {hasAccess ? 'Planos' : 'Assinar'}
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-0 xl:gap-5">
        {/* Coluna da galeria */}
        <div className="min-w-0">
          <div className="px-4 sm:px-6 pt-5">
            {!hasAccess ? (
              <Link
                href="/nitro/assinar"
                className="nx-cta-banner block rounded-2xl p-4 text-white"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                  {billing.enabled ? 'Insight Nitro' : 'Assinatura em breve'}
                </p>
                <p className="text-base font-extrabold">Seu perfil, em outro nível.</p>
                <p className="text-xs opacity-90">
                  {viewer && level > 0
                    ? `A moldura e a tag do Nível ${level}${level >= 4 ? ' (com abertura animada)' : ''} já são suas. `
                    : ''}
                  Experimente qualquer item no provador — os com cadeado são do Nitro{billing.enabled ? '' : ', que abre em breve'}. Grátis para sempre no Nível 5.
                </p>
              </Link>
            ) : (
              <NitroStatusCard />
            )}
          </div>

          {/* Prévia (mobile e telas médias) */}
          <div className="xl:hidden px-4 sm:px-6 pt-5">
            <PreviewCard
              draft={draft}
              viewer={me}
              displayName={displayName}
              avatar={avatar}
              dirty={dirty}
              saving={saving}
              status={status}
              onSave={handleSave}
              locked={previewOnly}
              lockedItems={lockedInDraft}
              onTestIntro={() => {
                const it = NITRO_ITEMS.find((i) => i.id === draft.intro && i.kind === 'intro') as IntroItem | undefined;
                if (it) setTestingIntro(it);
              }}
            />
          </div>

          {/* Pacotes */}
          <div className="px-4 sm:px-6 pt-5">
            <BundleShelf
              avatar={avatar}
              displayName={displayName}
              locked={previewOnly}
              equippedIds={draft}
              onApply={(b) => {
                setDraft((prev) => ({ ...prev, ...b.items }));
                setStatus(previewOnly ? `Experimentando o ${b.name}.` : `${b.name} equipado — toque em Salvar.`);
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
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
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
                locked={lockReason(item) !== null}
                lock={lockReason(item)}
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
              viewer={me}
              displayName={displayName}
              avatar={avatar}
              dirty={dirty}
              saving={saving}
              status={status}
              onSave={handleSave}
              locked={previewOnly}
              lockedItems={lockedInDraft}
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
  locked = false,
  lockedItems = [],
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
  locked?: boolean;
  lockedItems?: NitroItem[];
}) {
  const needsNitro = lockedItems.some((i) => i.requirement.type === 'nitro');
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
            <NitroBadge />
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
          disabled={!locked && (!dirty || saving)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold disabled:opacity-40"
        >
          {locked ? (
            <>
              <Zap className="w-3.5 h-3.5" /> Entrar para salvar
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
            </>
          )}
        </button>
      </div>
      {locked && (
        <p className="text-[11px] text-muted text-center">Você está no provador: experimente à vontade, nada é salvo.</p>
      )}
      {!locked && lockedItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-300 text-center space-y-1.5">
          <p className="flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> {lockedItems.map((i) => i.name).join(', ')} {lockedItems.length > 1 ? 'ficam' : 'fica'} só no provador.
          </p>
          {needsNitro && (
            <Link href="/nitro/assinar" className="inline-flex items-center gap-1 font-bold text-white underline-offset-2 hover:underline">
              <Zap className="w-3 h-3" /> Liberar com o Nitro
            </Link>
          )}
        </div>
      )}
      {!locked && dirty && !saving && <p className="text-[11px] text-amber-400 text-center">Alterações não salvas</p>}
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
  locked = false,
  lock = null,
}: {
  item: NitroItem;
  equipped: boolean;
  avatar: string;
  displayName: string;
  onToggle: () => void;
  onTest?: () => void;
  locked?: boolean;
  lock?: LockReason;
}) {
  const lockLabel =
    lock === 'nitro' ? 'Nitro' : lock === 'level' && item.requirement.type === 'level' ? `Nível ${item.requirement.min}` : lock === 'event' ? 'Evento' : null;
  const coll = getCollection(item.collection);
  const category = item.kind === 'tag' && item.category ? item.category : coll.name;

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
        {item.kind === 'tag' && <TagPill tagId={item.id} className="max-w-[92%]" />}
        {item.kind === 'font' && (
          <span className="px-2 text-lg text-primary max-w-full text-center leading-snug line-clamp-2 break-words">
            <NameFont font={item}>{displayName}</NameFont>
          </span>
        )}
        {item.kind === 'theme' && <ThemeMiniature themeId={item.id} name={displayName} />}
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
        {lockLabel && (
          <span
            className={`absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur ${
              lock === 'nitro' ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/40' : 'bg-black/50 text-amber-300 border border-amber-400/40'
            }`}
            title={lock === 'level' ? 'Exclusivo de quem alcança este nível — o Nitro não libera' : lock === 'nitro' ? 'Liberado com o Insight Nitro' : 'Item de evento'}
          >
            <Lock className="w-2.5 h-2.5" /> {lockLabel}
          </span>
        )}
        {!lock && item.requirement.type === 'level' && item.requirement.min > 0 && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-400/40">
            <Check className="w-2.5 h-2.5" /> Seu nível
          </span>
        )}
      </button>

      <div className="p-3 flex-1 flex flex-col gap-1.5 border-t border-border">
        <p className="text-xs font-bold text-primary leading-tight">{item.name}</p>
        <p className="text-[10px] text-muted leading-snug line-clamp-2">{item.description}</p>
        <div className="mt-auto pt-1 flex items-center justify-between gap-1 text-[10px]">
          <span className="text-secondary truncate">
            {category} · <span className={RARITY_CLASS[item.rarity]}>{item.rarity}</span>
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
            {equipped ? 'Remover' : locked ? 'Experimentar' : 'Equipar'}
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


/** Pacotes prontos (um cosmético de cada tipo). */
function BundleShelf({
  avatar,
  displayName,
  locked,
  equippedIds,
  onApply,
}: {
  avatar: string;
  displayName: string;
  locked: boolean;
  equippedIds: NitroCosmetics;
  onApply: (b: NitroBundle) => void;
}) {
  return (
    <div className="space-y-3">
      {/* por enquanto só o Super Pacote; novos pacotes em destaque virão depois */}
      {NITRO_BUNDLES.filter((b) => b.featured).map((b) => {
        const frame = getNitroItem(b.items.frame, 'frame');
        const title = getNitroItem(b.items.title, 'title');
        const font = getNitroItem(b.items.font, 'font');
        const theme = getNitroItem(b.items.theme, 'theme');
        const parts: [string, string | undefined][] = [
          ['Moldura', frame?.name],
          ['Título', title?.name],
          ['Tag', getNitroItem(b.items.tag, 'tag')?.name],
          ['Abertura', getNitroItem(b.items.intro, 'intro')?.name],
          ['Estilo de nome', font?.name],
          ['Tema', theme?.name],
        ];
        const applied = (Object.keys(b.items) as (keyof NitroBundle['items'])[]).every((k) => equippedIds[k] === b.items[k]);
        const nameEl = title ? <TitleText title={title}>{displayName}</TitleText> : displayName;
        return (
          <div
            key={b.id}
            className={`relative overflow-hidden rounded-2xl border ${
              b.featured ? 'border-fuchsia-500/50 p-4 sm:p-5' : 'border-border p-3'
            } bg-surface`}
          >
            {b.featured && (
              <div aria-hidden className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_10%_0%,#7c3aed,transparent_55%),radial-gradient(circle_at_100%_100%,#db2777,transparent_55%)]" />
            )}
            <div className="relative flex flex-wrap items-center gap-4">
              {frame && (
                <FramePreview frameId={frame.id} size={b.featured ? 76 : 52} live={b.featured}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt=""
                    className="rounded-full object-cover bg-elevated"
                    style={{ width: b.featured ? 76 : 52, height: b.featured ? 76 : 52 }}
                  />
                </FramePreview>
              )}
              <div className="flex-1 min-w-[180px]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-400">
                  {b.featured ? 'Super Pacote · exclusivo' : 'Pacote'}
                </p>
                <p className={`${b.featured ? 'text-lg' : 'text-sm'} font-extrabold text-primary`}>{b.name}</p>
                <p className="text-[11px] text-muted">{b.tagline}</p>
                {b.featured && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold">{font ? <NameFont font={font}>{nameEl}</NameFont> : nameEl}</span>
                    <TagPill tagId={b.items.tag} />
                  </div>
                )}
              </div>
              {b.featured && theme && (
                <div className="hidden sm:block w-40">
                  <ThemeMiniature themeId={theme.id} name={displayName} />
                </div>
              )}
              <button
                type="button"
                onClick={() => onApply(b)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  applied
                    ? 'bg-elevated border border-border text-secondary'
                    : b.featured
                      ? 'text-white bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500'
                      : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {applied ? 'Equipado' : locked ? 'Experimentar pacote' : 'Equipar pacote'}
              </button>
            </div>
            {b.featured && (
              <ul className="relative mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                {parts.map(([k, v]) => (
                  <li key={k} className="text-muted truncate">
                    {k}: <span className="text-secondary font-semibold">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
