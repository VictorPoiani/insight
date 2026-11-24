'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  AlertTriangle,
  Globe,
  Clock,
  X,
  ArrowRight,
  Layers,
} from '@/components/icons';

const NOTICE_STORAGE_KEY = 'insight-notice-v2-transition-acknowledged';

export function ReleaseNotesModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const acknowledged = localStorage.getItem(NOTICE_STORAGE_KEY);
      if (!acknowledged) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 450);
        return () => clearTimeout(timer);
      }
    } catch {
      setIsOpen(true);
    }
  }, []);

  function handleClose() {
    setIsOpen(false);
    try {
      localStorage.setItem(NOTICE_STORAGE_KEY, 'true');
    } catch {
      // Ignora erro de quota no navegador
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-modal-title"
      onClick={handleClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-surface border border-border text-primary shadow-2xl overflow-hidden my-auto"
      >
        {/* Barra superior de destaque */}
        <div className="h-1.5 w-full bg-gradient-to-r from-accent via-sky-400 to-amber-500" />

        {/* Cabeçalho */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Aviso Importante · Rumo ao Insight 2.0</span>
            </div>

            <h2
              id="release-modal-title"
              className="text-lg sm:text-xl font-extrabold text-primary leading-snug"
            >
              A atualização 2.0 está próxima!
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar aviso"
            className="p-2 -mr-1 -mt-1 rounded-full text-muted hover:text-primary hover:bg-elevated transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Comunicado */}
        <div className="px-5 sm:px-6 py-5 space-y-4 text-xs sm:text-sm text-secondary leading-relaxed">
          <p className="text-primary font-medium">
            Estamos preparando a chegada do <strong className="text-accent">Insight 2.0</strong> e,
            por esse motivo, a plataforma pode apresentar{' '}
            <strong className="text-amber-400">instabilidades temporárias</strong> nos próximos dias.
          </p>

          <div className="space-y-2.5 pt-1">
            <div className="p-3.5 rounded-2xl bg-elevated/75 border border-border flex items-start gap-3">
              <Layers className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-primary">
                  Transição de versão (1.x → 2.0)
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Estamos migrando recursos, banco de dados e preparando a nova experiência da comunidade.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-elevated/75 border border-border flex items-start gap-3">
              <Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-primary">
                  Mudança de domínio em andamento
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Ajustes de DNS, rotas e redirecionamentos podem causar oscilações pontuais de acesso ou sessão.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-primary">
                  Previsão de normalidade: algumas semanas
                </p>
                <p className="text-xs text-secondary mt-0.5">
                  Agradecemos a paciência enquanto concluímos toda a migração para entregar a versão 2.0 estável.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="px-5 sm:px-6 py-4 bg-elevated/40 border-t border-border flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <Link
            href="/atualizacoes"
            onClick={handleClose}
            className="w-full sm:w-auto text-center px-3 py-2 text-xs font-semibold text-secondary hover:text-primary transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Ver Mural de Atualizações</span>
          </Link>

          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <span>Entendi, continuar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}