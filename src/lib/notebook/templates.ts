import type { TopicTemplateType } from '@/types/database';
import { buildInitialWorkspaceData } from '@/components/feed/TopicTabsManager';
import type { NotebookItemData, NotebookTemplate } from './types';
import { characterToMarkdown, emptyCharacter } from './character';
import type { GlyphName } from './glyphs';
import { newArticleData } from './article';

export type TemplateSection = 'escrita' | 'livro' | 'textos' | 'workspaces';

export interface NotebookTemplateDef {
  id: NotebookTemplate;
  section: TemplateSection;
  name: string;
  description: string;
  /** emoji usado como ícone padrão do item */
  icon: GlyphName;
  color: string;
  kind: 'folder' | 'note';
  /** título inicial */
  title: (date: Date) => string;
  /** conteúdo markdown inicial */
  content?: (date: Date) => string;
  data?: () => NotebookItemData;
  /** modelo de workspace dos tópicos reaproveitado */
  workspace?: TopicTemplateType;
  /** não aparece em "Novo a partir de modelo" (criado por outra tela) */
  hidden?: boolean;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const SECTION_LABELS: Record<TemplateSection, string> = {
  escrita: 'Escrita livre',
  livro: 'Modo escritor',
  textos: 'Modelos de texto',
  workspaces: 'Workspaces dos Tópicos',
};

export const NOTEBOOK_TEMPLATES: NotebookTemplateDef[] = [
  // ------------------------------------------------------------ escrita livre
  {
    id: 'markdown',
    section: 'escrita',
    name: 'Nota livre',
    description: 'Markdown com [[links]] entre notas, #tags, callouts e tarefas — como no Obsidian.',
    icon: 'note',
    color: '#64748b',
    kind: 'note',
    title: () => 'Nova nota',
    content: () => '',
  },
  {
    id: 'canvas',
    section: 'escrita',
    name: 'Canvas',
    description: 'Quadro infinito com cartões, notas, imagens, grupos e ligações — como o Canvas do Obsidian.',
    icon: 'canvas',
    color: '#94a3b8',
    kind: 'note',
    title: () => 'Novo canvas',
    content: () => '',
    data: () => ({ canvas: { nodes: [], edges: [] } }),
  },
  {
    id: 'blocks',
    section: 'escrita',
    name: 'Página em blocos',
    description: 'O editor de blocos do Insight: grade, imagens, vídeos, tabelas, gráficos e enquetes.',
    icon: 'blocks',
    color: '#2563eb',
    kind: 'note',
    title: () => 'Página em blocos',
  },
  {
    id: 'folder',
    section: 'escrita',
    name: 'Projeto',
    description: 'Reúna livros, fichas e notas de um mesmo trabalho. Dentro de um projeto, vira uma seção.',
    icon: 'folder',
    color: '#a1a1aa',
    kind: 'folder',
    title: () => 'Nova pasta',
  },

  // ------------------------------------------------------------ modo escritor
  {
    id: 'book',
    section: 'livro',
    name: 'Livro autoral',
    description: 'Capa, sinopse, metas de palavras, capítulos com status e publicação no Insight.',
    icon: 'book',
    color: '#b45309',
    kind: 'folder',
    title: () => 'Meu livro',
    data: () => ({ synopsis: '', genre: '', wordGoal: 50000, dailyGoal: 500, bookStatus: 'planejando', history: {} }),
  },
  {
    id: 'chapter',
    section: 'livro',
    name: 'Capítulo',
    description: 'Página de livro sem distrações: modo foco, máquina de escrever e meta por sessão.',
    icon: 'chapter',
    color: '#d97706',
    kind: 'note',
    title: () => 'Capítulo 1',
    data: () => ({ status: 'rascunho' as const, html: '', authorNote: '' }),
  },
  {
    id: 'character',
    section: 'livro',
    name: 'Ficha de personagem',
    description: 'Essência, cadernos, três perfis, trajetória e entrevista guiada.',
    icon: 'character',
    color: '#db2777',
    kind: 'note',
    title: () => 'Novo personagem',
    data: () => ({ character: emptyCharacter() }),
    content: () => characterToMarkdown(emptyCharacter()),
  },
  {
    id: 'world',
    section: 'livro',
    name: 'Worldbuilding',
    description: 'Lugares, regras do mundo, linha do tempo e glossário.',
    icon: 'world',
    color: '#0d9488',
    kind: 'note',
    title: () => 'Mundo',
    content: () =>
      [
        '# Mundo',
        '',
        '## Lugares',
        '- **Cidade principal** — ',
        '',
        '## Regras',
        '> [!atencao] O que nunca pode acontecer neste mundo',
        '',
        '## Linha do tempo',
        '| Ano | Evento |',
        '| --- | --- |',
        '|  |  |',
        '',
        '## Glossário',
        '',
        '#worldbuilding',
      ].join('\n'),
  },

  {
    id: 'codex',
    section: 'livro',
    name: 'Verbete do Codex',
    description: 'Um verbete do mundo, com Infobox e aparições.',
    icon: 'codex',
    color: '#94a3b8',
    kind: 'note',
    title: () => 'Novo verbete',
    content: () => '',
    hidden: true,
  },

  // ------------------------------------------------------------ modelos de texto
  {
    id: 'journal',
    section: 'textos',
    name: 'Diário',
    description: 'Nota do dia com humor, gratidão e tarefas.',
    icon: 'journal',
    color: '#7c3aed',
    kind: 'note',
    title: (d) => isoDate(d),
    content: (d) =>
      [
        `# ${fmtDate(d)}`,
        '',
        '**Humor:** ',
        '',
        '## O que aconteceu',
        '',
        '## Gratidão',
        '- Uma coisa boa de hoje',
        '',
        '## Amanhã',
        '- [ ] Primeira tarefa',
        '',
        '#diario',
      ].join('\n'),
  },
  {
    id: 'screenplay',
    section: 'textos',
    name: 'Roteiro',
    description: 'Cenas com cabeçalho, ação e diálogo no formato de roteiro.',
    icon: 'screenplay',
    color: '#dc2626',
    kind: 'note',
    title: () => 'Roteiro',
    content: () =>
      [
        '# Título do roteiro',
        '',
        '## CENA 1 — INT. CASA — NOITE',
        '',
        'Ação: descreva o que vemos.',
        '',
        '**PERSONAGEM**',
        '> (baixinho) Fala do personagem.',
        '',
        '---',
        '',
        '## CENA 2 — EXT. RUA — DIA',
        '',
        '#roteiro',
      ].join('\n'),
  },
  {
    id: 'study',
    section: 'textos',
    name: 'Resumo de estudo',
    description: 'Método Cornell: perguntas, anotações e resumo final.',
    icon: 'study',
    color: '#0284c7',
    kind: 'note',
    title: () => 'Resumo',
    content: (d) =>
      [
        '---',
        'materia: ',
        `data: ${isoDate(d)}`,
        'tags: estudo',
        '---',
        '',
        '## Perguntas-chave',
        '- ',
        '',
        '## Anotações',
        '',
        '## Resumo',
        '> [!dica] Explique com suas palavras em 3 frases',
        '',
        '## Revisar',
        '- [ ] Revisão em 1 dia',
        '- [ ] Revisão em 7 dias',
      ].join('\n'),
  },
  {
    id: 'meeting',
    section: 'textos',
    name: 'Ata de reunião',
    description: 'Pauta, decisões e próximos passos.',
    icon: 'meeting',
    color: '#475569',
    kind: 'note',
    title: (d) => `Reunião ${isoDate(d)}`,
    content: (d) =>
      [
        `# Reunião — ${fmtDate(d)}`,
        '',
        '**Participantes:** ',
        '',
        '## Pauta',
        '1. ',
        '',
        '## Decisões',
        '- ',
        '',
        '## Próximos passos',
        '- [ ] ',
      ].join('\n'),
  },
  {
    id: 'idea',
    section: 'textos',
    name: 'Ideia rápida',
    description: 'Capture uma ideia antes que ela fuja.',
    icon: 'idea',
    color: '#ca8a04',
    kind: 'note',
    title: () => 'Ideia',
    content: () => ['> [!ideia] A ideia em uma frase', '> ', '', '## Por que importa', '', '## Próximo passo', '- [ ] ', '', '#ideia'].join('\n'),
  },
  {
    id: 'map',
    section: 'livro',
    name: 'Mapa (cartografia)',
    description: 'Mapa do seu mundo com marcadores, rotas e regiões ligados às menções.',
    icon: 'map',
    color: '#0d9488',
    kind: 'note',
    title: () => 'Mapa do mundo',
    data: () => ({ map: { image: null, w: 1600, h: 1000, markers: [], routes: [], regions: [] } }),
  },
  {
    id: 'calendar',
    section: 'livro',
    name: 'Calendário do mundo',
    description: 'Meses, semanas e luas do seu mundo, com eventos ligados às menções.',
    icon: 'moon',
    color: '#7c3aed',
    kind: 'note',
    title: () => 'Calendário do mundo',
  },
  {
    id: 'timeline',
    section: 'livro',
    name: 'Cronos (linha do tempo)',
    description: 'A história do seu mundo numa linha: eras, marcos e eventos.',
    icon: 'timeline',
    color: '#0891b2',
    kind: 'note',
    title: () => 'Cronos',
  },
  {
    id: 'poem',
    section: 'textos',
    name: 'Poema',
    description: 'Versos e estrofes, com espaço para forma, métrica e notas.',
    icon: 'feather',
    color: '#db2777',
    kind: 'note',
    title: () => 'Poema sem título',
    content: () =>
      [
        '---',
        'forma: verso livre',
        'tags: poesia',
        '---',
        '',
        'Primeiro verso,  ',
        'segundo verso.',
        '',
        'Uma nova estrofe começa',
        'depois de uma linha em branco.',
        '',
        '> [!nota] Notas do poema',
        '> Imagens, rimas e o que este poema quer dizer.',
      ].join('\n'),
  },
  {
    id: 'article',
    section: 'textos',
    name: 'Artigo',
    description: 'Artigo profissional: ABNT, APA ou editorial, com resumo, seções numeradas, fontes e referências automáticas.',
    icon: 'pen',
    color: '#2563eb',
    kind: 'note',
    title: () => 'Novo artigo',
    content: () => ['## Introdução', '', '', '## Desenvolvimento', '', '', '## Conclusão', ''].join('\n'),
    data: () => newArticleData() as unknown as NotebookItemData,
  },

  // ------------------------------------------------------------ workspaces dos tópicos
  ...(
    [
      ['goals', 'Controle de metas', 'Prioridades, indicadores e progresso.', 'goals', '#2563eb'],
      ['habits', 'Monitoramento de hábitos', 'Registro semanal de consistência.', 'habits', '#10b981'],
      ['tasks', 'Controle de tarefas', 'Entregas, status e responsáveis.', 'tasks', '#10b981'],
      ['roadmap', 'Projetos & Roadmaps', 'Fases e marcos em kanban ou linha do tempo.', 'roadmap', '#38bdf8'],
      ['mindmap', 'Mapa mental', 'Quadro 2D de ideias conectadas — ótimo para tramas.', 'mindmap', '#a855f7'],
      ['diet', 'Plano nutricional', 'Refeições, macros e hidratação.', 'diet', '#f59e0b'],
      ['agenda', 'Agenda & Cronograma', 'Aulas, prazos e eventos.', 'agenda', '#E63946'],
    ] as const
  ).map(
    ([id, name, description, icon, color]): NotebookTemplateDef => ({
      id,
      section: 'workspaces',
      name,
      description,
      icon,
      color,
      kind: 'note',
      title: () => name,
      workspace: id,
      data: () => buildInitialWorkspaceData(id) as NotebookItemData,
    })
  ),
];

export function getTemplate(id: string | null | undefined): NotebookTemplateDef {
  return NOTEBOOK_TEMPLATES.find((t) => t.id === id) || NOTEBOOK_TEMPLATES[0];
}

export const WORKSPACE_TEMPLATES = new Set<NotebookTemplate>(['goals', 'habits', 'tasks', 'roadmap', 'mindmap', 'diet', 'agenda']);
