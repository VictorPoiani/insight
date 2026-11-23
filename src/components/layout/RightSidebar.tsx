'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Hash,
  Github,
  ArrowUpRight,
  Check,
  Headset,
  Mail,
  MessageCircle,
  ChevronDown,
  Copy,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

const SUPPORT_EMAIL = 'contato.insightproject@gmail.com';
const SUPPORT_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5517996131181';

const DEFAULT_TOPICS = [
  'dev',
  'ia',
  'projetos',
  'rock',
  'musica',
  'artigue',
];

const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const SNAP_COLLAPSE_WIDTH = 130;

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showSupportOptions, setShowSupportOptions] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const router = useRouter();


  // Estados de Redimensionamento e Recolhimento
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem('insight-right-sidebar');
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        if (typeof parsed.width === 'number') setWidth(parsed.width);
        if (typeof parsed.isCollapsed === 'boolean') setIsCollapsed(parsed.isCollapsed);
      }
    } catch {
      // Mantém padrão
    }

    // auto = modo foco automático da escrita: lembra o estado anterior para restaurar
    let beforeAuto: boolean | null = null;
    function handleFocusMode(e: Event) {
      const customEvent = e as CustomEvent<{ collapse?: boolean; auto?: boolean }>;
      const d = customEvent.detail;
      if (d?.auto) {
        if (d.collapse) {
          setIsCollapsed((prev) => {
            if (beforeAuto === null) beforeAuto = prev;
            return true;
          });
        } else if (beforeAuto !== null) {
          const restore = beforeAuto;
          beforeAuto = null;
          setIsCollapsed(restore);
        }
        return;
      }
      beforeAuto = null;
      if (typeof d?.collapse === 'boolean') {
        setIsCollapsed(d.collapse);
      } else {
        setIsCollapsed((prev) => !prev);
      }
    }

    window.addEventListener('insight-toggle-focus-mode', handleFocusMode);
    return () => {
      window.removeEventListener('insight-toggle-focus-mode', handleFocusMode);
    };
  }, []);

  function saveSidebarState(nextWidth: number, nextCollapsed: boolean) {
    try {
      localStorage.setItem(
        'insight-right-sidebar',
        JSON.stringify({ width: nextWidth, isCollapsed: nextCollapsed })
      );
    } catch {
      // Ignora erro
    }
  }

  useEffect(() => {
    if (!isResizing) return;

    function handleMouseMove(e: MouseEvent) {
      if (!sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;

      if (newWidth < SNAP_COLLAPSE_WIDTH) {
        setIsCollapsed(true);
        saveSidebarState(width, true);
      } else {
        const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(newWidth)));
        setIsCollapsed(false);
        setWidth(clamped);
        saveSidebarState(clamped, false);
      }
    }

    function handleMouseUp() {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width]);


  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/');
    }
  }

  function handleCopySupportEmail(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  function toggleCollapse() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    saveSidebarState(width, next);
  }

  const displayedTopics = showAllTopics
    ? [...DEFAULT_TOPICS, 'python', 'nextjs']
    : DEFAULT_TOPICS;


  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Olá! Vim pelo Insight* e gostaria de falar com o suporte/DEV.'
  )}`;
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${encodeURIComponent(
    'Suporte Oficial — Plataforma Insight*'
  )}`;

  return (
    <aside
      ref={sidebarRef}
      style={{ width: isCollapsed ? 52 : width }}
      className={`shrink-0 hidden lg:flex flex-col justify-between h-screen sticky top-0 bg-background py-5 select-none group/rsidebar ${
        isResizing ? '' : 'transition-[width,padding] duration-300 ease-out'
      } ${isCollapsed ? 'px-2 items-center' : 'px-3.5'}`}
    >
      {/* Alça Vertical Esquerda para Redimensionar Arrastando */}
      <div
        title="Arraste para ajustar a largura ou recolher"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 flex items-center justify-center group/handle hover:bg-accent/30 transition-colors"
      >
        <div className="w-[1px] h-10 bg-transparent group-hover/handle:bg-accent rounded-full" />
      </div>

      {isCollapsed ? (
        /* MODO RECOLHIDO DISCRETO */
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            type="button"
            onClick={toggleCollapse}
            title="Expandir painel direito"
            className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleCollapse}
            title="Buscar no Insight"
            className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-surface transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>


          <a
            href="https://github.com/VictorPoiani"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub @VictorPoiani"
            className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-surface transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <>
          <div className="space-y-3 overflow-y-auto no-scrollbar pr-0.5">
            {/*  Botão Discreto de Recolher */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleCollapse}
                title="Recolher painel direito"
                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface border border-transparent hover:border-border transition-colors shrink-0"
              >
                <PanelRightClose className="w-4 h-4 opacity-60 group-hover/rsidebar:opacity-100 transition-opacity" />
              </button>

              <form onSubmit={handleSearch} className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar no Insight..."
                  className="w-full bg-surface border border-border rounded-full pl-8 pr-3 py-1.5 text-[11px] text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </form>
            </div>

            {/* 2. Card de Tópicos Compacto */}
            <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-extrabold text-primary uppercase tracking-wider">
                  <Hash className="w-3 h-3 text-accent" />
                  <span>Tópicos</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllTopics(!showAllTopics)}
                  className="text-[10px] text-muted hover:text-accent transition-colors"
                >
                  {showAllTopics ? 'Menos' : 'Ver todos'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1">
                {displayedTopics.map((topic) => (
                  <Link
                    key={topic}
                    href={`/?tag=${topic}`}
                    className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[11px] text-secondary hover:text-primary hover:border-accent transition-colors"
                  >
                    #{topic}
                  </Link>
                ))}
              </div>
            </div>

            {/* 4. Botão Discreto do GitHub */}
            <a
              href="https://github.com/VictorPoiani"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between px-3 py-2 rounded-xl bg-surface border border-border hover:border-accent transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-elevated border border-border flex items-center justify-center text-secondary group-hover:text-accent group-hover:border-accent/40 transition-colors shrink-0">
                  <Github className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="text-[11px] font-bold text-primary leading-tight truncate">
                    @VictorPoiani
                  </p>
                  <p className="text-[10px] text-muted truncate">
                    GitHub · Projetos
                  </p>
                </div>
              </div>

              <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 ml-1.5" />
            </a>

            {/* 5. Botão de Suporte Oficial */}
            <div className="rounded-xl bg-surface border border-border overflow-hidden transition-all hover:border-accent/60">
              <button
                type="button"
                onClick={() => setShowSupportOptions(!showSupportOptions)}
                className="w-full group flex items-center justify-between px-3 py-2 text-left transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                      showSupportOptions
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-elevated border-border text-secondary group-hover:text-accent group-hover:border-accent/40'
                    }`}
                  >
                    <Headset className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-primary leading-tight truncate">
                      Suporte Oficial
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      Gmail ou WhatsApp
                    </p>
                  </div>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted group-hover:text-accent transition-transform duration-200 shrink-0 ml-1.5 ${
                    showSupportOptions ? 'rotate-180 text-accent' : ''
                  }`}
                />
              </button>

              {showSupportOptions && (
                <div className="px-2.5 pb-2.5 pt-1.5 border-t border-border space-y-1.5 bg-elevated/30">
                  <div className="flex items-center gap-1">
                    <a
                      href={gmailComposeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Enviar e-mail para ${SUPPORT_EMAIL}`}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface border border-border hover:border-accent transition-colors min-w-0 group"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#EA4335] shrink-0" />
                      <div className="truncate">
                        <p className="text-[10px] font-bold text-primary group-hover:text-accent truncate">
                          Gmail Oficial
                        </p>
                        <p className="text-[9px] text-muted truncate">
                          {SUPPORT_EMAIL}
                        </p>
                      </div>
                    </a>

                    <button
                      type="button"
                      onClick={handleCopySupportEmail}
                      title="Copiar endereço de e-mail"
                      className="p-2 rounded-lg bg-surface border border-border text-muted hover:text-accent hover:border-accent transition-colors shrink-0"
                    >
                      {copiedEmail ? (
                        <Check className="w-3.5 h-3.5 text-[#1DB954]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface border border-border hover:border-[#25D366] transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageCircle className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                      <div className="truncate">
                        <p className="text-[10px] font-bold text-primary group-hover:text-[#25D366] truncate">
                          Falar com um desenvolvedor
                        </p>
                        <p className="text-[9px] text-muted truncate">
                          Atendimento via WhatsApp
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-muted group-hover:text-[#25D366] shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 6. Rodapé  Compacto */}
          <footer className="px-1 pt-2 space-y-1 text-[10px] text-muted leading-tight shrink-0">
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
              <Link href="/privacidade" className="hover:text-secondary transition-colors">
                Privacidade (LGPD)
              </Link>
              <Link href="/termos" className="hover:text-secondary transition-colors">
                Termos de Uso
              </Link>
              <Link href="/about" className="hover:text-secondary transition-colors">
                Sobre o Projeto
              </Link>
            </div>
            <p>© 2026 Insighter — Victor Poiani</p>
          </footer>
        </>
      )}
    </aside>
  );
}