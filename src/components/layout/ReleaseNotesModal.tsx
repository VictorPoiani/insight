'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Network,
  Compass,
  Layers,
  Music,
  PanelLeftClose,
  Users,
  Check,
  Terminal,
  Sparkles,
  Globe,
  Database,
} from 'lucide-react';

const RELEASE_STORAGE_KEY = 'insight-release-v1.5-seen';

const V15_FEATURES = [
  {
    icon: Network,
    color: '#a855f7',
    title: 'Estúdio 2D de Brainstorm & Arquitetura',
    description:
      'Quadro espacial de página inteira com Pan & Zoom, conexões em curva Bézier, cartões de código, checklists, notas técnicas, zonas de grupo e mídia R2.',
  },
  {
    icon: Layers,
    color: '#2563eb',
    title: 'Workspaces Modulares Estilo Notion',
    description:
      'Tópicos agora operam como aplicações independentes: Sistema de Metas, Matriz de Hábitos, Gestão de Tarefas, Plano Nutricional, Agenda e Base de Dados CSV.',
  },
  {
    icon: Compass,
    color: '#38bdf8',
    title: 'Projetos & Roadmaps (Kanban + Timeline)',
    description:
      'Acompanhamento completo de fases e entregas com alternância em tempo real entre quadro Kanban e Linha do Tempo sequencial.',
  },
  {
    icon: Music,
    color: '#10b981',
    title: 'Novo Player de Áudio & Links Automáticos',
    description:
      'Player customizado minimalista com pesquisa direta de músicas e prévia de áudio no perfil, além de captura automática de ícones por URL.',
  },
  {
    icon: PanelLeftClose,
    color: '#f59e0b',
    title: 'Modo Foco & Barras Redimensionáveis',
    description:
      'Recolha as barras laterais com um clique ou ajuste a largura arrastando as bordas para expandir a área útil de trabalho.',
  },
  {
    icon: Database,
    color: '#E63946',
    title: 'Infraestrutura Cloudflare R2 & Editor em Grade',
    description:
      'Compressão inteligente de vídeo no navegador, integração com catálogo GIPHY, corretor ortográfico/sintático e células de 12 colunas.',
  },
];

export function ReleaseNotesModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem(RELEASE_STORAGE_KEY);
      if (!hasSeen) {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }

    function handleOpenManual() {
      setIsOpen(true);
    }

    window.addEventListener('insight-open-release-notes', handleOpenManual);
    return () => {
      window.removeEventListener('insight-open-release-notes', handleOpenManual);
    };
  }, []);

  function handleDismiss() {
    try {
      localStorage.setItem(RELEASE_STORAGE_KEY, 'true');
    } catch {
      // Ignora bloqueio de storage
    }
    setIsOpen(false);
  }

  if (!isOpen) return null;

  return (
    <div
      onClick={handleDismiss}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-surface border border-border text-primary shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
      >
        {/* Cabeçalho Técnico do Modal */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-elevated/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md bg-accent text-white font-mono text-[10px] font-bold uppercase tracking-wider">
              Release · v1.5
            </span>
            <span className="text-xs font-mono text-muted">
              Changelog Oficial
            </span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            title="Fechar anúncio"
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo Rolável */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {/* Título e Introdução */}
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-primary">
              A atualização <span className="text-accent">Insight* v1.5</span> chegou.
            </h2>
            <p className="text-xs sm:text-sm text-secondary leading-relaxed">
              Reestruturamos a plataforma para unir a leveza de um microblog autoral à potência de workspaces modulares de engenharia, estudo e organização pessoal.
            </p>
          </div>

          {/* Grelha de Melhorias Implementadas na v1.5 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span>O que há de novo nesta versão</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {V15_FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="p-3.5 rounded-xl bg-elevated/60 border border-border space-y-1.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          style={{
                            backgroundColor: `${feat.color}15`,
                            borderColor: `${feat.color}35`,
                          }}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                        >
                          <Icon
                            className="w-3.5 h-3.5"
                            style={{ color: feat.color }}
                          />
                        </div>
                        <h3 className="text-xs font-bold text-primary leading-snug">
                          {feat.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-secondary leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Destaque Especial: O que está por vir (Criação de Contas Aberta) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-accent/[0.07] border border-accent/40 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-mono text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Próximo Marco · Rumo à v2.0</span>
              </span>
              <span className="text-[10px] font-mono text-muted flex items-center gap-1">
                <Globe className="w-3 h-3 text-accent" /> Comunidade Aberta
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm sm:text-base font-extrabold text-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-accent shrink-0" />
                <span>Em breve: qualquer pessoa poderá criar a sua conta</span>
              </h3>
              <p className="text-xs text-secondary leading-relaxed">
                Estamos a preparar a abertura oficial do <strong>Insight*</strong> para que qualquer utilizador possa criar o seu próprio perfil, montar os seus quadros de Brainstorm, gerir metas e roadmaps, publicar ideias em grade e interagir com outros criadores.
              </p>
            </div>

            <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted">
              <span>• Perfis públicos & particulares</span>
              <span>• Módulos Professional & Jardim</span>
              <span>• Colaboração em tempo real</span>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-5 py-3.5 border-t border-border bg-elevated/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] font-mono text-muted">
            Insight* v1.5 · Desenvolvido por Victor Poiani e Colaboradores.
          </span>

          <button
            type="button"
            onClick={handleDismiss}
            className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold flex items-center gap-1.5 hover:bg-accent-hover transition-colors shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>Explorar o Insight* v1.5</span>
          </button>
        </div>
      </div>
    </div>
  );
}