'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AsteriskLoader } from '@/components/ui/AsteriskLoader';
import { PasswordStrength, validateNewPassword } from '@/components/account/PasswordStrength';

function ResetPassword() {
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<'checking' | 'form' | 'done' | 'invalid'>('checking');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const tokenHash = params.get('token_hash');
    if (!tokenHash || params.get('type') !== 'recovery') {
      setPhase('invalid');
      return;
    }
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      .then(({ error: err }) => setPhase(err ? 'invalid' : 'form'));
  }, [params, supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateNewPassword(pw, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (!err) await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
    setSaving(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('different')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível salvar a senha. Peça um novo link.'
      );
      return;
    }
    setPhase('done');
  }

  if (phase === 'checking') return <AsteriskLoader size="lg" fullHeight label="Validando link..." />;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-surface border border-border space-y-4">
        {phase === 'invalid' && (
          <>
            <h1 className="text-lg font-extrabold text-primary">Link inválido ou expirado</h1>
            <p className="text-sm text-secondary">Os links valem por 1 hora e só funcionam uma vez.</p>
            <Link href="/login?recuperar=1" className="inline-block px-4 py-2 rounded-full bg-accent text-white text-xs font-bold">
              Pedir um novo link
            </Link>
          </>
        )}
        {phase === 'done' && (
          <>
            <ShieldCheck className="w-10 h-10 text-emerald-500" />
            <h1 className="text-lg font-extrabold text-primary">Senha alterada</h1>
            <p className="text-sm text-secondary">Por segurança, encerramos a sessão nos outros aparelhos.</p>
            <Link href="/" className="inline-block px-4 py-2 rounded-full bg-accent text-white text-xs font-bold">
              Ir para o início
            </Link>
          </>
        )}
        {phase === 'form' && (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-accent" />
              <h1 className="text-lg font-extrabold text-primary">Criar nova senha</h1>
            </div>
            <input
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Nova senha"
              className="w-full px-3 py-2.5 rounded-xl bg-elevated border border-border text-sm text-primary focus:outline-none focus:border-accent"
            />
            <PasswordStrength value={pw} />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar nova senha"
              className="w-full px-3 py-2.5 rounded-xl bg-elevated border border-border text-sm text-primary focus:outline-none focus:border-accent"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AsteriskLoader size="lg" fullHeight />}>
      <ResetPassword />
    </Suspense>
  );
}
