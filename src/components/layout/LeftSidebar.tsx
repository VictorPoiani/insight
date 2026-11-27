'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { InsightLogo } from '@/components/brand/InsightLogo';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  House,
  Bell,
  Heart,
  Settings,
  LogOut,
  LogIn,
  UserCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  User,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { CosmeticAvatar } from '@/components/nitro/Cosmetics';
import type { NitroCosmetics } from '@/lib/nitro/catalog';
import { NotebookNavItem } from '@/components/notebook/NotebookNavItem';

type NavItem = { name: string; href: string; icon: typeof House; showBadge?: boolean; soon?: boolean };

// Ordem: Início, My Notebook, Notificações, Apoie, Configurações, Insight Nitro
// (Tutorial, Atualizações e Sobre ficam na barra direita)
const HOME_ITEM: NavItem = { name: 'Início', href: '/', icon: House };
const MAIN_ITEMS: NavItem[] = [
  { name: 'Notificações', href: '/notificacoes', icon: Bell, showBadge: true },
  { name: 'Apoie', href: '/apoie', icon: Heart },
  { name: 'Configurações', href: '/config', icon: Settings },
];


const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 180;
const MAX_WIDTH = 360;
const SNAP_COLLAPSE_WIDTH = 120;

export function LeftSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    full_name: string;
    display_name?: string | null;
    avatar_url: string | null;
    role?: string;
    cosmetics?: NitroCosmetics | null;
  } | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const sidebarRef = useRef<HTMLElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o popover da conta ao clicar fora
  useEffect(() => {
    if (!accountMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('insight-preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        const root = document.documentElement;
        if (prefs.theme && !root.hasAttribute('data-nitro-theme')) {
          root.setAttribute('data-theme', prefs.theme);
        }
        if (prefs.highContrast) {
          root.setAttribute('data-contrast', 'high');
        } else {
          root.removeAttribute('data-contrast');
        }
        if (prefs.fontSize) {
          root.style.fontSize = `${prefs.fontSize}px`;
        }
      }

      const savedLayout = localStorage.getItem('insight-left-sidebar');
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        if (typeof parsed.width === 'number') setWidth(parsed.width);
        if (typeof parsed.isCollapsed === 'boolean') setIsCollapsed(parsed.isCollapsed);
      }
    } catch {
      // Mantém padrão
    }

    async function loadLoggedProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setCurrentUser(null);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, cosmetics')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();

      if (prof) {
        setCurrentUser(prof);
      } else {
        setCurrentUser(null);
      }
    }

    loadLoggedProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadLoggedProfile();
    });

    // auto = modo foco automático da escrita: lembra o estado anterior para restaurar
    let beforeAuto: boolean | null = null;
    function handleFocusMode(e: Event) {
      const customEvent = e as CustomEvent<{ collapse?: boolean; auto?: boolean }>;
      const d = customEvent.detail;
      if (d?.auto) {
        if (d.collapse) {
          setIsCollapsed((prev) => {
            if (beforeAuto === null) beforeAuto = prev;
            return true;
          });
        } else if (beforeAuto !== null) {
          const restore = beforeAuto;
          beforeAuto = null;
          setIsCollapsed(restore);
        }
        return;
      }
      beforeAuto = null;
      if (typeof d?.collapse === 'boolean') {
        setIsCollapsed(d.collapse);
      } else {
        setIsCollapsed((prev) => !prev);
      }
    }

    window.addEventListener('insight-toggle-focus-mode', handleFocusMode);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('insight-toggle-focus-mode', handleFocusMode);
    };
  }, [supabase]);

  const fetchUnreadCount = useCallback(async () => {
    if (!currentUser?.id) {
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id)
      .eq('is_read', false);

    setUnreadCount(count || 0);
  }, [currentUser?.id, supabase]);

  useEffect(() => {
    fetchUnreadCount();

    window.addEventListener('insight-notifications-updated', fetchUnreadCount);

    if (!currentUser?.id) {
      return () => {
        window.removeEventListener('insight-notifications-updated', fetchUnreadCount);
      };
    }

    const channel = supabase
      .channel(`sidebar-notifs-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${currentUser.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('insight-notifications-updated', fetchUnreadCount);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, pathname, fetchUnreadCount, supabase]);

  function saveSidebarState(nextWidth: number, nextCollapsed: boolean) {
    try {
      localStorage.setItem(
        'insight-left-sidebar',
        JSON.stringify({ width: nextWidth, isCollapsed: nextCollapsed })
      );
    } catch {
      // Ignora erro de quota
    }
  }

  useEffect(() => {
    if (!isResizing) return;

    function handleMouseMove(e: MouseEvent) {
      if (!sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;

      if (newWidth < SNAP_COLLAPSE_WIDTH) {
        setIsCollapsed(true);
        saveSidebarState(width, true);
      } else {
        const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(newWidth)));
        setIsCollapsed(false);
        setWidth(clamped);
        saveSidebarState(clamped, false);
      }
    }

    function handleMouseUp() {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width]);

  async function handleLogout() {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUnreadCount(0);
    router.push('/');
    router.refresh();
  }

  function toggleCollapse() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    saveSidebarState(width, next);
  }

  const myProfileHref = currentUser
    ? `/u/${encodeURIComponent(currentUser.username)}`
    : '/login';

  const isDevUser =
    currentUser?.role === 'admin' ||
    currentUser?.id === '96d271a9-9102-49b1-b593-9279c5dfe3f4';

  function renderNavItem(item: NavItem) {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    const showBadge = Boolean(item.showBadge && unreadCount > 0);
    const layout = isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5';

    if (item.soon) {
      return (
        <span
          key={item.href}
          aria-disabled="true"
          title={`${item.name} — em breve`}
          className={`flex items-center rounded-lg text-sm font-medium text-secondary opacity-60 cursor-not-allowed ${isCollapsed ? layout : 'gap-3 px-3 py-1.5'}`}
        >
          <Icon className="w-5 h-5 shrink-0" />
          {!isCollapsed && (
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block truncate">{item.name}</span>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">Em breve</span>
            </span>
          )}
        </span>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        title={isCollapsed ? item.name : undefined}
        className={`flex items-center rounded-lg text-sm font-medium transition-colors ${layout} ${
          isActive ? 'bg-surface text-accent border border-border' : 'text-secondary hover:bg-surface hover:text-primary'
        }`}
      >
        <div className="relative shrink-0">
          <Icon className="w-5 h-5" />
          {showBadge && isCollapsed && (
            <span className="w-2 h-2 rounded-full bg-accent absolute -top-0.5 -right-0.5 ring-2 ring-background" />
          )}
        </div>
        {!isCollapsed && <span className="truncate flex-1">{item.name}</span>}
        {!isCollapsed && showBadge && (
          <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px] font-mono font-bold shrink-0">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      style={{ width: isCollapsed ? 64 : width }}
      className={`shrink-0 hidden md:flex flex-col justify-between h-screen sticky top-0 bg-background py-5 group/sidebar select-none ${
        isResizing ? '' : 'transition-[width,padding] duration-300 ease-out'
      } ${isCollapsed ? 'px-2 items-center' : 'px-4'}`}
    >
      {/* Alça de Redimensionamento */}
      <div
        title="Arraste para ajustar a largura ou recolher"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 flex items-center justify-center group/handle hover:bg-accent/30 transition-colors"
      >
        <div className="w-[1px] h-10 bg-transparent group-hover/handle:bg-accent rounded-full" />
      </div>

      <div className="space-y-7 w-full">
        {/* Marca Insight* + Botão Recolher */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between px-2'
          }`}
        >
          {!isCollapsed && (
            <Link href="/" className="inline-flex items-center truncate">
              <InsightLogo className="text-2xl" />
            </Link>
          )}

          <button
            type="button"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4 opacity-60 group-hover/sidebar:opacity-100 transition-opacity" />
            )}
          </button>
        </div>

        {/* Navegação Principal */}
        <nav className="space-y-1">
          {renderNavItem(HOME_ITEM)}
          {/* My Notebook — beta fechada: só admin entra; os demais veem bloqueado */}
          <NotebookNavItem variant="sidebar" collapsed={isCollapsed} isAdmin={currentUser?.role === 'admin'} active={pathname.startsWith('/notebook')} />
          {MAIN_ITEMS.map(renderNavItem)}
          {/* Insight Nitro — todos veem catálogo e planos; só admin aplica (beta) */}
          <Link
            href="/nitro"
            title={isCollapsed ? 'Insight Nitro' : undefined}
            className={`flex items-center rounded-lg text-sm font-semibold transition-colors ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
            } ${
              pathname.startsWith('/nitro')
                ? 'bg-surface text-accent border border-border'
                : 'text-secondary hover:bg-surface hover:text-primary'
            }`}
          >
            <Zap className="w-5 h-5 shrink-0 text-accent" />
            {!isCollapsed && (
              <>
                <span className="truncate flex-1 bg-gradient-to-r from-sky-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                  Insight Nitro
                </span>
              </>
            )}
          </Link>

        </nav>
      </div>

      {/* ====================================================================
          RODAPÉ DE CONTA FLUIDO COM POPOVER (SEM LOGOUT ACIDENTAL)
          ==================================================================== */}
      <div ref={accountMenuRef} className="relative w-full">
        {currentUser ? (
          <>
            {/* Menu Popover (abre para cima) */}
            {accountMenuOpen && (
              <div
                className={`absolute bottom-full mb-2 z-50 w-56 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border shadow-2xl py-1.5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                  isCollapsed ? 'left-0' : 'left-0 right-0 w-full'
                }`}
              >
                <div className="px-3.5 py-2 border-b border-border/70">
                  <p className="text-xs font-bold text-primary truncate">
                    {currentUser.display_name || currentUser.full_name}
                  </p>
                  <p className="text-[11px] text-muted truncate">
                    @{currentUser.username}
                  </p>
                </div>

                <div className="py-1">
                  <Link
                    href={myProfileHref}
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated/70 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Ver meu perfil</span>
                  </Link>

                  <Link
                    href="/config"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated/70 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurações</span>
                  </Link>

                  {(currentUser.role === 'admin' || currentUser.role === 'moderator') && (
                    <Link
                      href="/moderacao"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated/70 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Moderação</span>
                    </Link>
                  )}
                </div>

                <div className="pt-1 border-t border-border/70">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="truncate">Sair de @{currentUser.username}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Gatilho Minimalista Fluido */}
            <button
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              title={
                isCollapsed
                  ? `${currentUser.display_name || currentUser.full_name} (@${currentUser.username})`
                  : 'Opções da conta'
              }
              className={`w-full rounded-full flex items-center transition-all duration-150 group/account ${
                isCollapsed
                  ? 'p-1.5 justify-center hover:bg-surface'
                  : 'px-2.5 py-2 justify-between gap-2.5 hover:bg-surface'
              } ${accountMenuOpen ? 'bg-surface' : ''}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <CosmeticAvatar profile={currentUser} size={36}>
                    <img
                      src={currentUser.avatar_url || '/assets/net/default-perfil'}
                      alt={currentUser.full_name}
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-border group-hover/account:ring-accent/60 transition-all"
                    />
                  </CosmeticAvatar>
                  {isDevUser && (
                    <span
                      title="Desenvolvedor Insight"
                      className="w-2.5 h-2.5 rounded-full bg-[#10b981] ring-2 ring-background absolute -bottom-0.5 -right-0.5"
                    />
                  )}
                </div>

                {!isCollapsed && (
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-bold text-primary truncate leading-tight">
                        {currentUser.display_name || currentUser.full_name}
                      </p>
                      {isDevUser && (
                        <span className="px-1.5 py-[1px] rounded-md bg-[#10b981]/15 text-[#10b981] text-[9px] font-mono font-bold tracking-tight shrink-0">
                          DEV
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted truncate leading-tight mt-0.5">
                      @{currentUser.username}
                    </p>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <MoreHorizontal className="w-4 h-4 text-muted group-hover/account:text-primary transition-colors shrink-0 mr-0.5" />
              )}
            </button>
          </>
        ) : (
          <Link
            href="/login"
            title="Entrar ou Criar Conta"
            className={`rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center transition-colors shadow-sm ${
              isCollapsed ? 'p-2.5 justify-center' : 'px-4 py-2.5 justify-center gap-2'
            }`}
          >
            <LogIn className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Entrar / Criar Conta</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}