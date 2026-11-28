'use client';

import { StatusPage } from '@/components/ui/StatusPage';

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Esta página não existe"
      message="O link pode estar quebrado, ou o conteúdo foi removido pelo autor ou pela moderação."
      action={
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
          className="px-4 py-2 rounded-full border border-border text-sm font-semibold text-secondary hover:text-primary"
        >
          Voltar
        </button>
      }
    />
  );
}
