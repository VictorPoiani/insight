'use client';

import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { ask as confirmDialog } from '@/lib/ui/feedback';
import { NitroBadge } from '@/components/nitro/Cosmetics';
import { displaysNitro } from '@/lib/nitro/entitlement';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Repeat2,
  FileText,
  Sparkles,
  CheckCheck,
  ArrowUpRight,
  LogIn,
  ShieldCheck,
  Trash2,
  Settings2,
  BarChart3,
  AtSign,
  ListChecks,
  Square,
  CheckSquare,
  X,
} from 'lucide-react';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';

type MainBoxTab = 'inbox' | 'official';
type InteractionFilter = 'all' | 'like' | 'reply' | 'mention' | 'poll_vote' | 'follow' | 'repost' | 'new_post';

interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  content_preview: string | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile | null;
}

interface OfficialUpdateRow {
  id: string;
  title: string;
  content: string;
  version?: string | null;
  created_at: string;
}

function formatRelativeTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

export default function NotificationsPage() {
  const supabase = createClient();

  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [mainTab, setMainTab] = useState<MainBoxTab>('inbox');
  const [typeFilter, setTypeFilter] = useState<InteractionFilter>('all');
  const [showSettings, setShowSettings] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [officialUpdates, setOfficialUpdates] = useState<OfficialUpdateRow[]>([]);
  const [lastReadOfficialAt, setLastReadOfficialAt] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadAllNotifications = useCallback(async () => {
    setLoading(true);

    // Carrega timestamp local da última leitura de avisos oficiais
    try {
      const savedTs = localStorage.getItem('insight-official-last-read');
      if (savedTs) setLastReadOfficialAt(Number(savedTs) || 0);
    } catch {
      // Ignora
    }

    // 1. Busca avisos oficiais (tabela updates) para a aba Oficial
    const { data: updatesData } = await supabase
      .from('updates')
      .select('id, title, content, version, created_at')
      .order('created_at', { ascending: false })
      .limit(25);

    if (updatesData) {
      setOfficialUpdates(updatesData as OfficialUpdateRow[]);
    }

    // 2. Busca sessão do usuário para carregar Minha Caixa
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setMyProfile(null);
      setNotifications([]);
      setAuthChecked(true);
      setLoading(false);
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
      .maybeSingle();

    if (!prof) {
      setMyProfile(null);
      setAuthChecked(true);
      setLoading(false);
      return;
    }

    const typedProf = prof as Profile;
    setMyProfile(typedProf);
    setAuthChecked(true);

    const { data: notifRows } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', typedProf.id)
      .order('created_at', { ascending: false })
      .limit(80);

    if (notifRows && notifRows.length > 0) {
      const actorIds = Array.from(
        new Set(
          notifRows
            .map((n: any) => n.actor_id)
            .filter((id: string | null): id is string => Boolean(id))
        )
      );

      let actorsMap: Record<string, Profile> = {};
      if (actorIds.length > 0) {
        const { data: actorsData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', actorIds);

        if (actorsData) {
          (actorsData as Profile[]).forEach((a) => {
            actorsMap[a.id] = a;
          });
        }
      }

      const enriched: NotificationItem[] = notifRows.map((n: any) => ({
        ...n,
        actor: n.actor_id ? actorsMap[n.actor_id] || null : null,
      }));

      setNotifications(enriched);
    } else {
      setNotifications([]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadAllNotifications();
  }, [loadAllNotifications]);

  // novas notificações: confere a cada minuto com a aba visível (sem canal de tempo real)
  useVisiblePolling(() => void loadAllNotifications(), 60_000, Boolean(myProfile));

  async function handleMarkAllRead() {
    if (mainTab === 'official') {
      const now = Date.now();
      setLastReadOfficialAt(now);
      localStorage.setItem('insight-official-last-read', String(now));
      window.dispatchEvent(new Event('insight-notifications-updated'));
      return;
    }

    if (!myProfile) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', myProfile.id)
      .eq('is_read', false);

    window.dispatchEvent(new Event('insight-notifications-updated'));
  }

  async function handleMarkSingleRead(notifId: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);

    window.dispatchEvent(new Event('insight-notifications-updated'));
  }

  async function handleClearReadNotifications() {
    if (!myProfile) return;
    setNotifications((prev) => prev.filter((n) => !n.is_read));
    await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', myProfile.id)
      .eq('is_read', true);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function handleDeleteSelected() {
    if (!myProfile || selected.size === 0) return;
    const ids = Array.from(selected);
    const label = ids.length === 1 ? 'esta notificação' : `estas ${ids.length} notificações`;
    if (!(await confirmDialog({ message: `Apagar ${label}?`, danger: true }))) return;
    setNotifications((prev) => prev.filter((n) => !selected.has(n.id)));
    exitSelectMode();
    for (let i = 0; i < ids.length; i += 100) {
      await supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', myProfile.id)
        .in('id', ids.slice(i, i + 100));
    }
    window.dispatchEvent(new Event('insight-notifications-updated'));
  }

  const unreadInboxCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const unreadOfficialCount = useMemo(
    () =>
      officialUpdates.filter(
        (u) => new Date(u.created_at).getTime() > lastReadOfficialAt
      ).length,
    [officialUpdates, lastReadOfficialAt]
  );

  const filteredInbox = useMemo(() => {
    if (typeFilter === 'all') return notifications;
    return notifications.filter((n) => n.type === typeFilter);
  }, [notifications, typeFilter]);

  // Agrupa avisos parecidos: "Ana e mais 3 curtiram seu Insight" em vez de 4 linhas.
  // Curtidas, reposts e votos agrupam por post; novos seguidores, por dia.
  const groupedInbox = useMemo(() => {
    const GROUPABLE = new Set(['like', 'repost', 'poll_vote', 'follow']);
    const groups: { lead: NotificationItem; items: NotificationItem[] }[] = [];
    const byKey = new Map<string, { lead: NotificationItem; items: NotificationItem[] }>();
    for (const n of filteredInbox) {
      if (!GROUPABLE.has(n.type)) {
        groups.push({ lead: n, items: [n] });
        continue;
      }
      const key = n.type === 'follow' ? `follow:${n.created_at.slice(0, 10)}` : `${n.type}:${n.post_id || ''}`;
      const g = byKey.get(key);
      if (g) {
        // entra no grupo (para marcar como lida); a mesma pessoa repetida conta uma vez só na contagem
        g.items.push(n);
      } else {
        const ng = { lead: n, items: [n] };
        byKey.set(key, ng);
        groups.push(ng);
      }
    }
    return groups;
  }, [filteredInbox]);

  function getNotificationMeta(n: NotificationItem) {
    switch (n.type) {
      case 'like':
        return {
          icon: Heart,
          iconClass: 'text-rose-500 fill-rose-500',
          actionText: 'curtiu seu Insight',
          actionPlural: 'curtiram seu Insight',
        };
      case 'reply':
        return {
          icon: MessageCircle,
          iconClass: 'text-accent',
          actionText: 'respondeu ao seu insight',
        };
      case 'mention':
        return {
          icon: AtSign,
          iconClass: 'text-violet-400',
          actionText: 'mencionou você',
        };
      case 'poll_vote':
        return {
          icon: BarChart3,
          iconClass: 'text-amber-400',
          actionText: 'votou na sua enquete',
          actionPlural: 'votaram na sua enquete',
        };
      case 'follow':
        return {
          icon: UserPlus,
          iconClass: 'text-emerald-400',
          actionText: 'começou a seguir você',
          actionPlural: 'começaram a seguir você',
        };
      case 'repost':
        return {
          icon: Repeat2,
          iconClass: 'text-[#1DB954]',
          actionText: 'repostou seu Insight',
          actionPlural: 'repostaram seu Insight',
        };
      case 'new_post':
        return {
          icon: FileText,
          iconClass: 'text-sky-400',
          actionText: 'publicou um novo insight',
        };
      default:
        return {
          icon: Bell,
          iconClass: 'text-accent',
          actionText: 'interagiu com você',
        };
    }
  }

  const FILTER_CHIPS: { id: InteractionFilter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'like', label: 'Curtidas' },
    { id: 'reply', label: 'Respostas' },
    { id: 'mention', label: 'Menções' },
    { id: 'poll_vote', label: 'Enquetes' },
    { id: 'follow', label: 'Seguidores' },
    { id: 'repost', label: 'Reposts' },
    { id: 'new_post', label: 'Novas Postagens' },
  ];

  return (
    <div className="w-full min-h-screen bg-background">
      {/* 1. CABEÇALHO FIXO MINIMALISTA */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-primary">
              Notificações
            </h1>
            <p className="text-xs text-muted">
              Interações da comunidade e avisos oficiais do Insight*
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(mainTab === 'inbox' ? unreadInboxCount > 0 : unreadOfficialCount > 0) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 rounded-full bg-surface border border-border hover:border-accent text-xs font-bold text-primary inline-flex items-center gap-1.5 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5 text-accent" />
                <span className="hidden sm:inline">Marcar todas como lidas</span>
                <span className="sm:hidden">Ler tudo</span>
              </button>
            )}

            {myProfile && (
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                title="Escolher o que aparece aqui"
                aria-label="Configurar notificações"
                aria-pressed={showSettings}
                className={`p-2 rounded-full transition-colors ${
                  showSettings ? 'text-accent bg-surface' : 'text-muted hover:text-primary hover:bg-surface'
                }`}
              >
                <Settings2 className="w-4 h-4" />
              </button>
            )}

            {mainTab === 'inbox' && myProfile && notifications.length > 0 && (
              <button
                type="button"
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                title={selectMode ? 'Cancelar seleção' : 'Selecionar notificações para apagar'}
                aria-label={selectMode ? 'Cancelar seleção' : 'Selecionar notificações'}
                aria-pressed={selectMode}
                className={`p-2 rounded-full transition-colors ${
                  selectMode ? 'text-accent bg-surface' : 'text-muted hover:text-primary hover:bg-surface'
                }`}
              >
                {selectMode ? <X className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
              </button>
            )}

            {mainTab === 'inbox' && !selectMode && notifications.some((n) => n.is_read) && (
              <button
                type="button"
                onClick={handleClearReadNotifications}
                title="Limpar notificações já lidas"
                className="p-2 rounded-full text-muted hover:text-danger hover:bg-surface transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Abas Principais: Minha Caixa vs. Oficial */}
        <div className="grid grid-cols-2 text-xs sm:text-sm font-bold text-center">
          <button
            type="button"
            onClick={() => setMainTab('inbox')}
            className={`py-3 relative transition-colors hover:bg-surface/40 flex items-center justify-center gap-2 ${
              mainTab === 'inbox' ? 'text-primary' : 'text-secondary'
            }`}
          >
            <span>Minha Caixa</span>
            {unreadInboxCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px] font-mono font-bold">
                {unreadInboxCount}
              </span>
            )}
            {mainTab === 'inbox' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2.5px] rounded-full bg-accent" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab('official')}
            className={`py-3 relative transition-colors hover:bg-surface/40 flex items-center justify-center gap-2 ${
              mainTab === 'official' ? 'text-primary' : 'text-secondary'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Oficial</span>
            {unreadOfficialCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px] font-mono font-bold">
                {unreadOfficialCount}
              </span>
            )}
            {mainTab === 'official' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2.5px] rounded-full bg-accent" />
            )}
          </button>
        </div>
      </header>

      {showSettings && myProfile && <NotificationSettings profileId={myProfile.id} />}

      {/* 2. BARRA DE FILTROS POR TIPO (Apenas em Minha Caixa) */}
      {mainTab === 'inbox' && myProfile && (
        <div
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="px-4 sm:px-6 py-2.5 border-b border-border flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          {FILTER_CHIPS.map((chip) => {
            const active = typeFilter === chip.id;
            const count =
              chip.id === 'all'
                ? notifications.length
                : notifications.filter((n) => n.type === chip.id).length;

            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setTypeFilter(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  active
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent border-border text-secondary hover:text-primary'
                }`}
              >
                <span>{chip.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] font-mono ${
                      active ? 'text-white/80' : 'text-muted'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. CONTEÚDO DAS NOTIFICAÇÕES */}
      {loading ? (
        <div className="py-16 text-center text-xs text-muted">
          Sincronizando notificações...
        </div>
      ) : mainTab === 'official' ? (
        /* ====================================================================
           ABA OFICIAL: AVISOS DE NOVAS ATUALIZAÇÕES DA PLATAFORMA
           ==================================================================== */
        <div className="divide-y divide-border">
          <div className="px-4 sm:px-6 py-3 bg-surface/20 flex items-center justify-between text-xs">
            <span className="text-secondary">
              Notas de lançamento, recursos novos e comunicados do Insight*.
            </span>
            <Link
              href="/atualizacoes"
              className="text-accent font-bold hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>Abrir Mural Completo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {officialUpdates.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted">
              Nenhuma atualização oficial registrada ainda.
            </div>
          ) : (
            officialUpdates.map((upd) => {
              const isNew =
                new Date(upd.created_at).getTime() > lastReadOfficialAt;

              return (
                <Link
                  key={upd.id}
                  href="/atualizacoes"
                  onClick={() => {
                    const now = Date.now();
                    setLastReadOfficialAt(now);
                    localStorage.setItem('insight-official-last-read', String(now));
                  }}
                  className={`px-4 sm:px-6 py-4 flex items-start gap-3.5 transition-colors hover:bg-surface/40 ${
                    isNew ? 'bg-accent/[0.06]' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-extrabold text-primary truncate">
                          {upd.title}
                        </span>
                        {upd.version && (
                          <span className="px-2 py-0.5 rounded bg-elevated border border-border text-[10px] font-mono text-accent shrink-0">
                            {upd.version}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted shrink-0">
                        {formatRelativeTime(upd.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
                      {upd.content}
                    </p>
                  </div>

                  {isNew && (
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
                  )}
                </Link>
              );
            })
          )}
        </div>
      ) : !authChecked || !myProfile ? (
        /* VISITANTE DESLOGADO */
        <div className="py-16 px-6 text-center space-y-3">
          <Bell className="w-7 h-7 text-accent mx-auto" />
          <h2 className="text-sm font-bold text-primary">
            Entre para ver suas notificações
          </h2>
          <p className="text-xs text-secondary max-w-sm mx-auto">
            Acompanhe curtidas, novos seguidores, reposts e publicações de quem você segue em tempo real.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Entrar / Criar Conta</span>
          </Link>
        </div>
      ) : filteredInbox.length === 0 ? (
        /* MINHA CAIXA VAZIA */
        <div className="py-16 px-6 text-center space-y-1.5">
          <p className="text-sm font-bold text-primary">
            Nenhuma notificação por aqui
          </p>
          <p className="text-xs text-muted">
            {typeFilter === 'all'
              ? 'Quando alguém curtir, responder, repostar ou seguir você, aparecerá aqui.'
              : 'Nenhuma interação encontrada para este filtro.'}
          </p>
        </div>
      ) : (
        /* LISTA DE INTERAÇÕES EM MINHA CAIXA */
        <div className="divide-y divide-border">
          {selectMode && (() => {
            const allSelected = filteredInbox.length > 0 && filteredInbox.every((n) => selected.has(n.id));
            return (
              <div className="sticky top-[118px] z-20 px-4 sm:px-6 py-2.5 bg-surface/95 backdrop-blur border-b border-border flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setSelected(allSelected ? new Set() : new Set(filteredInbox.map((n) => n.id)))
                  }
                  className="inline-flex items-center gap-2 font-bold text-primary"
                >
                  {allSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4 text-muted" />}
                  {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
                <span className="text-muted">{selected.size} selecionada{selected.size === 1 ? '' : 's'}</span>
                <button
                  type="button"
                  disabled={selected.size === 0}
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-danger/10 text-danger font-bold disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Apagar
                </button>
              </div>
            );
          })()}
          {(selectMode ? filteredInbox.map((n) => ({ lead: n, items: [n] })) : groupedInbox).map((group) => {
            const notif = group.lead;
            const groupItems = group.items;
            // pessoas distintas do grupo (para avatares e "e mais N")
            const people = groupItems.filter((x, i, arr) => x.actor_id && arr.findIndex((y) => y.actor_id === x.actor_id) === i);
            const others = Math.max(0, people.length - 1);
            const groupUnread = groupItems.some((x) => !x.is_read);
            const meta = getNotificationMeta(notif);
            const Icon = meta.icon;
            const actorName =
              notif.actor?.display_name ||
              notif.actor?.full_name ||
              notif.actor?.username ||
              'Membro do Insight';
            const actorHandle = notif.actor?.username || 'membro';

            const targetHref =
              notif.type === 'follow'
                ? `/u/${encodeURIComponent(actorHandle)}`
                : notif.post_id
                ? `/post/${notif.post_id}`
                : `/u/${encodeURIComponent(actorHandle)}`;

            const isSelected = selected.has(notif.id);
            const rowClass = `px-4 sm:px-6 py-4 flex items-start gap-3.5 transition-colors hover:bg-surface/40 ${
              isSelected ? 'bg-accent-soft' : groupUnread ? 'bg-accent/[0.06]' : ''
            }`;
            const renderRow = (children: React.ReactNode) =>
              selectMode ? (
                <button
                  key={notif.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggleSelected(notif.id)}
                  className={`w-full text-left ${rowClass}`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-accent shrink-0 mt-2.5" />
                  ) : (
                    <Square className="w-5 h-5 text-muted shrink-0 mt-2.5" />
                  )}
                  {children}
                </button>
              ) : (
                <Link
                  key={notif.id}
                  href={targetHref}
                  onClick={() => {
                    for (const x of groupItems) if (!x.is_read) handleMarkSingleRead(x.id);
                  }}
                  className={rowClass}
                >
                  {children}
                </Link>
              );

            return renderRow(
              <>
                {/* Avatar com selo do tipo de interação */}
                <div className="relative shrink-0">
                  {others > 0 ? (
                    <span className="relative block w-10 h-10" aria-hidden="true">
                      {people.slice(0, 2).map((x, i) => (
                        <img
                          key={x.id}
                          src={x.actor?.avatar_url || '/assets/net/default-perfil'}
                          alt=""
                          className={`absolute w-7 h-7 rounded-full object-cover ring-2 ring-background bg-elevated ${i === 0 ? 'top-0 left-0 z-10' : 'bottom-0 right-0'}`}
                        />
                      ))}
                    </span>
                  ) : (
                  <img
                    src={notif.actor?.avatar_url || '/assets/net/default-perfil'}
                    alt={actorName}
                    className="w-10 h-10 rounded-full object-cover border border-border bg-elevated"
                  />
                  )}
                  <span className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center absolute -bottom-1 -right-1 shadow-sm">
                    <Icon className={`w-3 h-3 ${meta.iconClass}`} />
                  </span>
                </div>

                {/* Texto da Interação */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm text-primary leading-snug">
                      <span className="font-extrabold">{actorName}</span>
                      {notif.actor && displaysNitro(notif.actor) === true && <NitroBadge className="mx-0.5" size={13} />}{' '}
                      <ShieldCheck className="w-3.5 h-3.5 text-[#00ccff] inline-block align-text-bottom mr-1" />
                      {others > 0 && (
                        <span className="text-secondary">
                          e mais <span className="font-bold text-primary">{others}</span>{' '}
                        </span>
                      )}
                      <span className="text-secondary">{others > 0 && 'actionPlural' in meta && meta.actionPlural ? meta.actionPlural : meta.actionText}</span>
                    </p>
                    <span className="text-[11px] text-muted shrink-0">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>

                  {notif.content_preview && notif.type !== 'follow' && (
                    <p className="text-xs text-muted line-clamp-2 pl-2.5 border-l-2 border-border">
                      {notif.content_preview}
                    </p>
                  )}
                </div>

                {groupUnread && (
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
                )}
              </>
            );
          })}
        </div>
      )}
    </div>
  );
}