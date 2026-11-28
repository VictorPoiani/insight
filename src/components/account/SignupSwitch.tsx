'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ask, notify } from '@/lib/ui/feedback';
import { TURNSTILE_SITE_KEY } from './Turnstile';

/** Configurações → Equipe: abre/fecha o cadastro sem novo deploy (vale no app e no banco). */
export function SignupSwitch() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void createClient()
      .rpc('signup_invite_required')
      .then(({ data }) => setOpen(typeof data === 'boolean' ? !data : null));
  }, []);

  async function toggle() {
    if (open === null || busy) return;
    const next = !open;
    const ok = await ask({
      title: next ? 'Abrir o cadastro ao público?' : 'Voltar a exigir convite?',
      message: next
        ? `Qualquer pessoa poderá criar conta, sem código de convite.${TURNSTILE_SITE_KEY ? '' : '\n\nAtenção: o CAPTCHA ainda não está configurado (NEXT_PUBLIC_TURNSTILE_SITE_KEY).'}`
        : 'Novas contas voltarão a precisar de código de convite. Quem já tem conta não é afetado.',
      confirmLabel: next ? 'Abrir cadastro' : 'Exigir convite',
      danger: !next,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await createClient().rpc('set_signup_open', { p_open: next });
    setBusy(false);
    if (error) {
      notify('Não foi possível mudar agora (só administradores podem).', 'error');
      return;
    }
    setOpen(next);
    notify(next ? 'Cadastro aberto ao público.' : 'Cadastro voltou a exigir convite.', 'success');
  }

  return (
    <div className="px-6 py-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-primary">Cadastro {open ? 'aberto ao público' : 'com convite'}</h2>
        <p className="mt-1 text-xs text-secondary leading-relaxed max-w-md">
          {open
            ? 'Qualquer pessoa pode criar conta. Proteção anti-robô: ' + (TURNSTILE_SITE_KEY ? 'ativa (Turnstile).' : 'não configurada.')
            : 'Novas contas precisam de código de convite. Ligue no lançamento: vale na hora, sem novo deploy.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(open)}
        disabled={open === null || busy}
        onClick={() => void toggle()}
        className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${open ? 'bg-emerald-500' : 'bg-elevated border border-border'}`}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${open ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}
