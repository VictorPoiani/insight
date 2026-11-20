'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { AsteriskLoader } from '@/components/ui/AsteriskLoader';

function VerifyEmail() {
  const params = useSearchParams();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('token') || '';
    fetch('/api/account/verify-email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.verified) setState('ok');
        else {
          setState('error');
          setMessage(d.error || 'Não foi possível verificar.');
        }
      })
      .catch(() => {
        setState('error');
        setMessage('Falha de conexão. Tente abrir o link de novo.');
      });
  }, [params]);

  if (state === 'loading') return <AsteriskLoader size="lg" fullHeight label="Verificando seu e-mail..." />;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-surface border border-border text-center space-y-3">
        {state === 'ok' ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h1 className="text-lg font-extrabold text-primary">E-mail verificado!</h1>
            <p className="text-sm text-secondary">Sua conta agora tem o selo de verificação.</p>
          </>
        ) : (
          <>
            <MailWarning className="w-10 h-10 text-amber-500 mx-auto" />
            <h1 className="text-lg font-extrabold text-primary">Link inválido</h1>
            <p className="text-sm text-secondary">{message}</p>
          </>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <Link href="/config" className="px-4 py-2 rounded-full bg-accent text-white text-xs font-bold">
            Configurações
          </Link>
          <Link href="/" className="px-4 py-2 rounded-full border border-border text-xs font-semibold text-secondary">
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AsteriskLoader size="lg" fullHeight />}>
      <VerifyEmail />
    </Suspense>
  );
}
