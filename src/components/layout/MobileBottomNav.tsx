'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Compass, Sparkles, Settings, UserCircle2, LogIn } from 'lucide-react';



export function MobileBottomNav() {

  const pathname = usePathname();
  const supabase = createClient();

  const [profileHref, setProfileHref] = useState<string | null>(null);

  useEffect(() => {
    async function checkMobileSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setProfileHref(null);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();

      if (prof?.username) {
        setProfileHref(`/u/${encodeURIComponent(prof.username)}`);
      } else {
        setProfileHref(null);
      }
    }

    checkMobileSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkMobileSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const items = [
    { label: 'Explorar', href: '/', icon: Compass },
    { label: 'Novidades', href: '/atualizacoes', icon: Sparkles },
    { label: 'Ajustes', href: '/config', icon: Settings },
    {
      label: profileHref ? 'Meu Perfil' : 'Entrar',
      href: profileHref || '/login',
      icon: profileHref ? UserCircle2 : LogIn,
    },
  ];


  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] flex items-center justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-colors ${isActive ? 'text-accent' : 'text-secondary hover:text-primary'
              }`}
          >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}