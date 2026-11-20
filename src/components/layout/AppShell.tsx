'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { InsightLogo } from '@/components/brand/InsightLogo';
import { usePathname } from 'next/navigation';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { NitroProvider } from '@/components/nitro/NitroProvider';
import { NitroMenuItem } from '@/components/nitro/NitroMenuItem';
import { Menu, X, Heart, Info, FileText, Shield } from 'lucide-react';

const FULLSCREEN_ROUTES = ['/login'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isFullscreen = FULLSCREEN_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  if (isFullscreen) {
    return (
      <NitroProvider>
        <main className="w-full min-h-screen">{children}</main>
      </NitroProvider>
    );
  }

  return (
    <NitroProvider>
    <>
      {/* Barra superior compacta exclusiva do mobile (acesso a Apoie, Sobre e Termos) */}
      <div className="md:hidden w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between relative z-40">
        <Link href="/" className="inline-flex items-center">
          <InsightLogo className="text-xl" />
        </Link>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
            className="p-2 -mr-1 rounded-full text-secondary hover:text-primary hover:bg-surface transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <NitroMenuItem onNavigate={() => setMenuOpen(false)} />
              <div className="my-1 border-t border-border/70" />
              <Link
                href="/apoie"
                className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-elevated transition-colors"
              >
                <Heart className="w-4 h-4 text-accent" />
                <span>Apoie o Insight</span>
              </Link>
              <Link
                href="/about"
                className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-elevated transition-colors"
              >
                <Info className="w-4 h-4 text-accent" />
                <span>Sobre o Projeto</span>
              </Link>
              <div className="my-1 border-t border-border/70" />
              <Link
                href="/termos"
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-secondary hover:text-primary hover:bg-elevated transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Termos de Uso</span>
              </Link>
              <Link
                href="/privacidade"
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-secondary hover:text-primary hover:bg-elevated transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Privacidade</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto flex min-h-screen justify-center pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <LeftSidebar />

        <main className="flex-1 min-w-0 min-h-screen md:border-x border-border">
          {children}
        </main>

        <RightSidebar />
      </div>

      <MobileBottomNav />
    </>
    </NitroProvider>
  );
}