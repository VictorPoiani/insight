'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Home,
  Sparkles,
  Info,
  Heart,
  Settings,
  Lock,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const navItems = [
  { name: 'Início', href: '/', icon: Home },
  { name: 'Atualizações', href: '/notificacoes', icon: Sparkles },
  { name: 'Apoie', href: '/apoie', icon: Heart },
  { name: 'Configurações', href: '/config', icon: Settings },
  { name: 'Sobre', href: '/about', icon: Info },
];

const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 180;
const MAX_WIDTH = 360;
const SNAP_COLLAPSE_WIDTH = 120;

export function LeftSidebar() {
  const pathname = usePathname();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginBox, setShowLoginBox] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Estados de Redimensionamento e Recolhimento
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('insight-preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        const root = document.documentElement;
        if (prefs.theme === 'light' || prefs.theme === 'dark') {
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(Boolean(session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(Boolean(session?.user));
    });

    function handleFocusMode(e: Event) {
      const customEvent = e as CustomEvent<{ collapse?: boolean }>;
      if (typeof customEvent.detail?.collapse === 'boolean') {
        setIsCollapsed(customEvent.detail.collapse);
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

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || authLoading) return;

    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthLoading(false);

    if (error) {
      alert('Acesso negado: ' + error.message);
      return;
    }

    setEmail('');
    setPassword('');
    setShowLoginBox(false);
  }

  async function handleAdminLogout() {
    await supabase.auth.signOut();
    setShowLoginBox(false);
  }

  function toggleCollapse() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    saveSidebarState(width, next);
  }

  return (
    <aside
      ref={sidebarRef}
      style={{ width: isCollapsed ? 64 : width }}
      className={`shrink-0 hidden md:flex flex-col justify-between h-screen sticky top-0 bg-background py-5 group/sidebar select-none ${
        isResizing ? '' : 'transition-[width] duration-150 ease-out'
      } ${isCollapsed ? 'px-2 items-center' : 'px-4'}`}
    >
      {/* Alça Vertical Direita para Redimensionar Arrastando */}
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
        {/* Topo: Logo + Botão Discreto de Recolher/Expandir */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between px-2'
          }`}
        >
          {!isCollapsed && (
            <Link href="/" className="inline-flex items-center truncate">
              <span className="text-2xl font-extrabold tracking-tight text-primary">
                Insight<span className="text-accent">*</span>
              </span>
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

        {/* Menu de Navegação */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                  isCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-surface text-accent border border-border'
                    : 'text-secondary hover:bg-surface hover:text-primary'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Rodapé de Status da Versão de Admin */}
      <div className="space-y-2 w-full">
        {showLoginBox && !isAdmin && !isCollapsed && (
          <form
            onSubmit={handleAdminLogin}
            className="p-3 rounded-xl bg-surface border border-border space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-accent uppercase">
                Acesso de Desenvolvimento
              </span>
              <button
                type="button"
                onClick={() => setShowLoginBox(false)}
                className="text-muted hover:text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail de Acesso"
              className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-primary focus:outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-primary focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold hover:bg-accent-hover disabled:opacity-50"
            >
              {authLoading ? 'Entrando...' : 'Entrar como Admin'}
            </button>
          </form>
        )}

        <div
          className={`rounded-lg bg-surface border border-border text-xs text-secondary flex items-center ${
            isCollapsed ? 'p-2 justify-center' : 'px-3 py-3 justify-between gap-2'
          }`}
        >
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-primary truncate">Insight v1.5</p>
                {isAdmin && (
                  <span className="text-[10px] font-mono font-bold text-[#10b981]">
                    ● Admin
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-muted truncate">Victor Poiani</p>
            </div>
          )}

          {isAdmin ? (
            <button
              type="button"
              onClick={handleAdminLogout}
              title="Sair do modo Admin"
              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-elevated transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isCollapsed) setIsCollapsed(false);
                setShowLoginBox(!showLoginBox);
              }}
              title="Acesso de Desenvolvedor"
              className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-elevated transition-colors shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}