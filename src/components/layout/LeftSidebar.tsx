'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Home,
  Bell,
  Info,
  Heart,
  Settings,
  Lock,
  LogOut,
  X,
} from 'lucide-react';

const navItems = [
  { name: 'Início', href: '/', icon: Home },
  { name: 'Notificações', href: '/notificacoes', icon: Bell },
  { name: 'Sobre', href: '/about', icon: Info },
  { name: 'Apoie', href: '/apoie', icon: Heart },
  { name: 'Configurações', href: '/config', icon: Settings },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginBox, setShowLoginBox] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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
    } catch {
      // Mantém o padrão escuro caso não haja preferências salvas
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(Boolean(session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(Boolean(session?.user));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

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

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between h-screen sticky top-0 border-r border-border bg-background px-4 py-6">
      <div className="space-y-8">
        {/* Logo tipográfica Insight* */}
        <Link href="/" className="inline-flex items-center px-3">
          <span className="text-2xl font-extrabold tracking-tight text-primary">
            Insight<span className="text-accent">*</span>
          </span>
        </Link>

        {/* Menu de Navegação */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface text-accent border border-border'
                    : 'text-secondary hover:bg-surface hover:text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Rodapé de Status da Versão de Admin */}
      <div className="space-y-2">
        {showLoginBox && !isAdmin && (
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

        <div className="px-3 py-3 rounded-lg bg-surface border border-border text-xs text-secondary flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-primary">Insight v1.0</p>
              {isAdmin && (
                <span className="text-[10px] font-bold text-[#1DB954]">
                  ● Admin
                </span>
              )}
            </div>
            <p className="mt-0.5 text-muted">Hub autoral — Victor Poiani</p>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={handleAdminLogout}
              title="Sair do modo Admin (Ver como visitante)"
              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-elevated transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginBox(!showLoginBox)}
              title="Acesso de Desenvolvedor"
              className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-elevated transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}