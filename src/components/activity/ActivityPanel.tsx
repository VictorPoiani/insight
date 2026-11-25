'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock, Eye, Film, Heart, MessageCircle, Repeat2, FileText, HeartHandshake, X, Loader2, Bookmark, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useNitro } from '@/components/nitro/NitroProvider';
import { ActivityPostList, type ActivityListKind } from './ActivityPostList';

export type ActivityTab = 'summary' | ActivityListKind;
const TABS: { id: ActivityTab; label: string }[] = [
  { id: 'summary', label: 'Resumo' },
  { id: 'saved', label: 'Salvos' },
  { id: 'liked', label: 'Curtidos' },
  { id: 'posted', label: 'Publicados' },
];

interface DayRow {
  day: string;
  screen_seconds: number;
  post_views: number;
  video_plays: number;
  likes: number;
  replies: number;
  reposts: number;
  posts: number;
}
interface Activity {
  days: DayRow[];
  likes_received: number;
}

export function formatDuration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 1) return sec > 0 ? '<1 min' : '0 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

const weekday = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const dayMonth = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Botão "gráfico" + painel com a atividade de quem está logado. */
export function ActivityPanel({ open, onClose, initialTab = 'summary' }: { open: boolean; onClose: () => void; initialTab?: ActivityTab }) {
  const { viewer } = useNitro();
  const [tab, setTab] = useState<ActivityTab>(initialTab);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
  // total de salvos (todas as datas) para o bloco do resumo
  useEffect(() => {
    if (!open || !viewer?.id) return;
    const load = () =>
      createClient()
        .from('post_saves')
        .select('post_id', { count: 'exact', head: true })
        .eq('profile_id', viewer.id)
        .then(({ count }) => setSavedCount(count ?? 0));
    load();
    window.addEventListener('insight-saves-changed', load);
    return () => window.removeEventListener('insight-saves-changed', load);
  }, [open, viewer?.id]);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [data, setData] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: s }) => {
      if (!s.session) {
        if (alive) {
          setNeedsLogin(true);
          setLoading(false);
        }
        return;
      }
      const { data: res } = await supabase.rpc('my_activity', { p_days: period });
      if (!alive) return;
      setNeedsLogin(false);
      setData((res as Activity) || null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [open, period]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const totals = useMemo(() => {
    const t = { screen: 0, views: 0, videos: 0, likes: 0, replies: 0, reposts: 0, posts: 0 };
    for (const d of data?.days || []) {
      t.screen += d.screen_seconds;
      t.views += d.post_views;
      t.videos += d.video_plays;
      t.likes += d.likes;
      t.replies += d.replies;
      t.reposts += d.reposts;
      t.posts += d.posts;
    }
    return t;
  }, [data]);

  if (!open) return null;
  const days = data?.days || [];
  const max = Math.max(60, ...days.map((d) => d.screen_seconds));
  const avg = days.length ? totals.screen / days.length : 0;

  const tiles: { icon: typeof Eye; label: string; value: number | string; to?: ActivityListKind }[] = [
    { icon: Eye, label: 'Posts vistos', value: totals.views },
    { icon: Heart, label: 'Curtidas dadas', value: totals.likes, to: 'liked' },
    { icon: MessageCircle, label: 'Comentários', value: totals.replies },
    { icon: Film, label: 'Vídeos assistidos', value: totals.videos },
    { icon: Repeat2, label: 'Reposts', value: totals.reposts },
    { icon: FileText, label: 'Insights publicados', value: totals.posts, to: 'posted' },
    { icon: HeartHandshake, label: 'Curtidas recebidas', value: data?.likes_received ?? 0 },
    { icon: Bookmark, label: 'Salvos', value: savedCount ?? '–', to: 'saved' },
  ];

  return (
    <div className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sua atividade"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-border shadow-2xl p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-primary">
            <BarChart3 className="w-4 h-4 text-accent" /> Sua atividade
          </h2>
          <div className="flex items-center gap-2">
            <div className={`flex rounded-full border border-border p-0.5 text-[11px] font-bold ${tab === 'summary' ? '' : 'invisible'}`}>
              {([7, 30] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  className={`px-2.5 py-1 rounded-full ${period === p ? 'bg-accent text-white' : 'text-secondary hover:text-primary'}`}
                >
                  {p} dias
                </button>
              ))}
            </div>
            <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-md text-muted hover:text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!needsLogin && (
          <div role="tablist" aria-label="Seções da atividade" className="mt-4 flex gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-3 py-2 text-xs font-bold transition-colors ${tab === t.id ? 'text-primary' : 'text-muted hover:text-secondary'}`}
              >
                {t.label}
                {tab === t.id && <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        )}

        {needsLogin ? (
          <p className="py-12 text-center text-xs text-muted">Entre na sua conta para ver sua atividade.</p>
        ) : tab !== 'summary' ? (
          viewer?.id ? (
            <ActivityPostList kind={tab} profileId={viewer.id} onNavigate={onClose} />
          ) : (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
            </div>
          )
        ) : loading && !data ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* Tempo de tela */}
            <div className="mt-5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                <Clock className="w-3.5 h-3.5" /> Tempo de tela
              </p>
              <p className="mt-1 text-2xl font-extrabold text-primary">{formatDuration(totals.screen)}</p>
              <p className="text-xs text-muted">Média de {formatDuration(avg)} por dia</p>

              <div className="mt-4 relative">
                {hover != null && days[hover] && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-lg bg-background border border-border shadow-lg text-[11px] text-primary whitespace-nowrap z-10">
                    <span className="font-bold">{dayMonth(days[hover].day)}</span> · {formatDuration(days[hover].screen_seconds)} ·{' '}
                    {days[hover].post_views} posts vistos
                  </div>
                )}
                <div className="h-32 flex items-end gap-[2px] border-b border-border" role="img" aria-label="Tempo de tela por dia">
                  {days.map((d, i) => (
                    <div
                      key={d.day}
                      className="flex-1 h-full flex items-end cursor-default"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      tabIndex={0}
                      aria-label={`${dayMonth(d.day)}: ${formatDuration(d.screen_seconds)}`}
                    >
                      <div
                        style={{ height: `${Math.max(d.screen_seconds ? 3 : 0, (d.screen_seconds / max) * 100)}%` }}
                        className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-accent' : 'bg-accent opacity-70'}`}
                      />
                    </div>
                  ))}
                </div>
                {period === 7 && (
                  <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
                    {days.map((d) => (
                      <span key={d.day} className="flex-1 text-center capitalize">
                        {weekday(d.day)}
                      </span>
                    ))}
                  </div>
                )}
                {period === 30 && days.length > 0 && (
                  <div className="mt-1 flex justify-between text-[10px] text-muted">
                    <span>{dayMonth(days[0].day)}</span>
                    <span>hoje</span>
                  </div>
                )}
              </div>
            </div>

            {/* Interações */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tiles.map(({ icon: Icon, label, value, to }) => {
                const inner = (
                  <>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted">
                      <Icon className="w-3.5 h-3.5" /> {label}
                      {to && <ChevronRight className="w-3 h-3 ml-auto opacity-60 group-hover:opacity-100 group-hover:text-accent" />}
                    </p>
                    <p className="mt-0.5 text-lg font-extrabold text-primary">{value}</p>
                  </>
                );
                return to ? (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setTab(to)}
                    title={`Ver lista: ${label.toLowerCase()}`}
                    className="group text-left rounded-xl border border-border bg-elevated/40 px-3 py-2.5 hover:border-accent transition-colors"
                  >
                    {inner}
                  </button>
                ) : (
                  <div key={label} className="rounded-xl border border-border bg-elevated/40 px-3 py-2.5">
                    {inner}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[10px] text-muted leading-relaxed">
              Tempo de tela conta só com o Insight aberto e em uso. Começou a ser medido em 25/11/2026; os números são só seus.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export const OPEN_ACTIVITY_EVENT = 'insight-open-activity';
export const openActivityPanel = (tab: ActivityTab = 'summary') =>
  window.dispatchEvent(new CustomEvent(OPEN_ACTIVITY_EVENT, { detail: typeof tab === 'string' ? tab : 'summary' }));

/** Fica montado no AppShell; qualquer botão abre o painel com openActivityPanel(). */
export function ActivityPanelHost() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ActivityTab>('summary');
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<ActivityTab>).detail;
      setTab(d === 'saved' || d === 'liked' || d === 'posted' ? d : 'summary');
      setOpen(true);
    };
    window.addEventListener(OPEN_ACTIVITY_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ACTIVITY_EVENT, onOpen);
  }, []);
  return <ActivityPanel open={open} initialTab={tab} onClose={() => setOpen(false)} />;
}
