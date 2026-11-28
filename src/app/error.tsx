'use client';

import { useEffect } from 'react';
import { StatusPage } from '@/components/ui/StatusPage';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      code={error.digest ? `ERRO · ${error.digest}` : 'ERRO'}
      title="Algo deu errado por aqui"
      message="Não foi culpa sua. Tente de novo; se continuar, avise a gente pela página Sobre."
      action={
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-full border border-border text-sm font-semibold text-secondary hover:text-primary"
        >
          Tentar de novo
        </button>
      }
    />
  );
}
