'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TopicWorkspaceView } from './TopicWorkspaceView';
import {
  CustomTopic,
  PostBlock,
  PostVisibility,
  TopicTemplateType,
  TopicWorkspaceData,
} from '@/types/database';
import {
  Plus,
  X,
  Trash2,
  Hash,
  ImagePlus,
  Check,
  Lock,
  Globe,
  ChevronDown,
  Search,
  FileText,
  Table2,
  ArrowUpRight,
  Shapes,
  Target,
  Activity,
  CheckCircle2,
  Compass,
  Network,
  Apple,
  Calendar,
  ArrowLeft,
  Code2,
  Layers,
  Database,
  BookOpen,
} from 'lucide-react';

const DEFAULT_FOUNDER_PROFILE_ID = '96d271a9-9102-49b1-b593-9279c5dfe3f4';

function sanitizeBlockHtml(dirtyHtml?: string | null): string {
  if (!dirtyHtml) return '';
  return dirtyHtml
    .replace(
      /<(script|iframe|object|embed|applet|meta|link|style|form|input|button|textarea)[^>]*>[\s\S]*?<\/\1>/gi,
      ''
    )
    .replace(
      /<\/?(script|iframe|object|embed|applet|meta|link|style|form|input|button|textarea|svg|math|base)[^>]*>/gi,
      ''
    )
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /(href|src|xlink:href|action)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*')/gi,
      '$1="#"'
    );
}

/**
 * Animação do Asterisco (*) de 8 pontas para as abas e workspaces
 */
function TopicAsteriskSpinner({
  size = 'xs',
  color,
}: {
  size?: 'xs' | 'md';
  color?: string;
}) {
  const armAngles = [0, 45, 90, 135];

  if (size === 'xs') {
    return (
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full animate-spin"
          style={{ color: color || '#3898ec', animationDuration: '1.1s' }}
        >
          <g transform="translate(100, 100)">
            {armAngles.map((angle) => (
              <rect
                key={angle}
                x="-18"
                y="-86"
                width="36"
                height="172"
                rx="7"
                ry="7"
                transform={`rotate(${angle})`}
                fill="currentColor"
              />
            ))}
            <circle r="28" fill="currentColor" />
          </g>
        </svg>
      </span>
    );
  }

  return (
    <div className="w-full py-10 flex flex-col items-center justify-center gap-2.5 select-none">
      <div className="w-8 h-8 animate-spin" style={{ animationDuration: '1.35s' }}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <g transform="translate(100, 100)">
            {armAngles.map((angle) => (
              <rect
                key={angle}
                x="-17"
                y="-86"
                width="34"
                height="172"
                rx="6"
                ry="6"
                transform={`rotate(${angle})`}
                fill={color || '#3898ec'}
              />
            ))}
            <circle r="26" fill={color || '#3898ec'} />
          </g>
        </svg>
      </div>
    </div>
  );
}

export interface FeedTabItem {
  id: string;
  label: string;
  tag: string | null;
  color: string;
  isDefault: boolean;
  icon?: string | null;
  visibility?: PostVisibility;
  templateType?: TopicTemplateType;
  bannerUrl?: string | null;
  bannerR2Key?: string | null;
  descriptionBlocks?: PostBlock[] | null;
  workspaceData?: TopicWorkspaceData | null;
  inDevelopment?: boolean;
}

export const DEFAULT_TABS: FeedTabItem[] = [
  { id: 'principal', label: 'Principal', tag: null, color: '#2563eb', isDefault: true },
  { id: 'professional', label: 'Professional', tag: 'professional', color: '#71717a', isDefault: true, inDevelopment: true },
  { id: 'jardim', label: 'Jardim', tag: 'jardim', color: '#71717a', isDefault: true, inDevelopment: true },
  { id: 'reposts', label: 'Reposts', tag: null, color: '#71717a', isDefault: true, inDevelopment: true },
];

export const GENERIC_USER_DEFAULT_TABS: FeedTabItem[] = [
  { id: 'principal', label: 'Principal', tag: null, color: '#2563eb', isDefault: true },
  { id: 'reposts', label: 'Reposts', tag: null, color: '#71717a', isDefault: true, inDevelopment: true },
];

const TOPIC_COLORS = [
  '#2563eb',
  '#38bdf8',
  '#10b981',
  '#a855f7',
  '#f59e0b',
  '#E63946',
  '#71717a',
];

export type TopicIconKey =
  | 'file'
  | 'target'
  | 'activity'
  | 'check'
  | 'compass'
  | 'network'
  | 'nutrition'
  | 'calendar'
  | 'database'
  | 'code'
  | 'layers'
  | 'book';

const TOPIC_ICON_OPTIONS: {
  key: TopicIconKey;
  label: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  { key: 'file', label: 'Página', Icon: FileText },
  { key: 'target', label: 'Metas', Icon: Target },
  { key: 'activity', label: 'Hábitos', Icon: Activity },
  { key: 'check', label: 'Tarefas', Icon: CheckCircle2 },
  { key: 'compass', label: 'Roadmap', Icon: Compass },
  { key: 'network', label: 'Brainstorm', Icon: Network },
  { key: 'database', label: 'Dados', Icon: Database },
  { key: 'code', label: 'Código', Icon: Code2 },
  { key: 'layers', label: 'Sistema', Icon: Layers },
  { key: 'book', label: 'Estudos', Icon: BookOpen },
  { key: 'nutrition', label: 'Nutrição', Icon: Apple },
  { key: 'calendar', label: 'Agenda', Icon: Calendar },
];

export function renderTopicVectorIcon(
  iconKey?: string | null,
  className = 'w-3.5 h-3.5',
  color?: string
) {
  const found = TOPIC_ICON_OPTIONS.find((item) => item.key === iconKey);
  if (!found) {
    return (
      <span
        style={{ backgroundColor: color || '#2563eb' }}
        className="w-2 h-2 rounded-full shrink-0 inline-block"
      />
    );
  }
  const IconComponent = found.Icon;
  return <IconComponent className={className} style={{ color }} />;
}

export function buildInitialWorkspaceData(template: TopicTemplateType): TopicWorkspaceData {
  const uid = () => Math.random().toString(36).slice(2, 8);

  switch (template) {
    case 'goals':
      return {
        goals: [
          {
            id: `goal-${uid()}`,
            title: 'Definir primeira meta do projeto',
            targetValue: '100% concluído',
            priority: 'high',
            progress: 25,
          },
        ],
      };

    case 'habits':
      return {
        habitColumns: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        habits: [
          { id: `hab-${uid()}`, name: 'Hábito diário', checks: [true, false, false, false, false, false, false] },
        ],
      };

    case 'tasks':
      return {
        tasks: [
          {
            id: `tsk-${uid()}`,
            title: 'Primeira tarefa da lista',
            status: 'in_progress',
            assignee: 'Autor',
            priority: 'medium',
          },
        ],
      };

    case 'diet':
      return {
        waterGlasses: 0,
        dietMeals: [
          {
            id: `meal-${uid()}`,
            time: '08:00 · Refeição 01',
            foods: 'Descreva os alimentos...',
            calories: 350,
            proteinGrams: 20,
            completed: false,
          },
        ],
      };

    case 'agenda':
      return {
        agendaEvents: [
          {
            id: `evt-${uid()}`,
            date: new Date().toISOString().slice(0, 10),
            time: '19:00',
            title: 'Compromisso ou estudo semanal',
            location: 'Local ou link',
            category: 'Geral',
            color: '#38bdf8',
          },
        ],
      };

    case 'roadmap':
      return {
        roadmapSteps: [
          {
            id: `step-${uid()}`,
            phase: 'Fase 01 · Planeamento',
            title: 'Marco Inicial',
            description: 'Definição dos objetivos principais.',
            status: 'planned',
          },
        ],
      };

    case 'mindmap': {
      const centerId = 'node-center';
      return {
        mindMapNodes: [
          {
            id: centerId,
            label: 'Ideia Central',
            note: 'Ponto de partida',
            x: 50,
            y: 45,
            color: '#2563eb',
            icon: '00',
          },
        ],
        mindMapEdges: [],
      };
    }

    case 'blank_db':
      return {
        customTable: [
          ['Item', 'Categoria', 'Status', 'Notas'],
          ['Registo 01', 'Geral', 'Ativo', 'Observação inicial'],
        ],
      };

    default:
      return {};
  }
}

function extractTopicMetadata(ct: CustomTopic): {
  icon: string | null;
  visibility: PostVisibility;
  templateType: TopicTemplateType;
  workspaceData: TopicWorkspaceData;
  ownerProfileId: string;
} {
  const firstBlockMeta = (ct.description_blocks?.[0] as any)?._topicMeta;
  const icon = ct.icon || firstBlockMeta?.icon || 'file';
  const visibility: PostVisibility =
    ct.visibility === 'private' ||
    firstBlockMeta?.visibility === 'private' ||
    ct.description_blocks?.[0]?.postVisibility === 'private'
      ? 'private'
      : 'public';
  const templateType: TopicTemplateType =
    ct.template_type || firstBlockMeta?.template_type || 'blank_page';
  const workspaceData: TopicWorkspaceData =
    ct.workspace_data && Object.keys(ct.workspace_data).length > 0
      ? ct.workspace_data
      : firstBlockMeta?.workspace_data || {};

  const ownerProfileId: string =
    ct.profile_id || firstBlockMeta?.profile_id || DEFAULT_FOUNDER_PROFILE_ID;

  return { icon, visibility, templateType, workspaceData, ownerProfileId };
}

interface TopicTabsManagerProps {
  activeTabId: string;
  onSelectTab: (tab: FeedTabItem) => void;
  isAdmin: boolean;
  profileId?: string;
}

export function TopicTabsManager({
  activeTabId,
  onSelectTab,
  isAdmin,
  profileId,
}: TopicTabsManagerProps) {
  const params = useParams();
  const pathname = usePathname();
  const supabase = createClient();

  const [resolvedProfileId, setResolvedProfileId] = useState<string | null>(
    profileId || (pathname === '/' ? DEFAULT_FOUNDER_PROFILE_ID : null)
  );

  const [customTopics, setCustomTopics] = useState<CustomTopic[]>([]);
  const [switchingTabId, setSwitchingTabId] = useState<string | null>(null);
  const [expandCreate, setExpandCreate] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('private');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<{
    type: TopicTemplateType;
    defaultTitle: string;
    defaultIcon: TopicIconKey;
    defaultColor: string;
    subtitle: string;
  } | null>(null);

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [iconKey, setIconKey] = useState<TopicIconKey>('file');
  const [color, setColor] = useState('#2563eb');
  const [introText, setIntroText] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerR2Key, setBannerR2Key] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function resolveTargetOwner() {
      if (profileId) {
        setResolvedProfileId(profileId);
        return;
      }

      const rawUsername = params?.username;
      if (rawUsername) {
        const cleanUser = decodeURIComponent(
          Array.isArray(rawUsername) ? rawUsername[0] : rawUsername
        );
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', cleanUser)
          .maybeSingle();

        if (prof?.id) {
          setResolvedProfileId(prof.id);
          return;
        }
      }

      if (pathname === '/') {
        setResolvedProfileId(DEFAULT_FOUNDER_PROFILE_ID);
      }
    }

    resolveTargetOwner();
  }, [profileId, params, pathname, supabase]);

  const loadCustomTopics = useCallback(async () => {
    if (!resolvedProfileId) {
      setCustomTopics([]);
      return;
    }

    const { data } = await supabase
      .from('custom_topics')
      .select('*')
      .order('created_at', { ascending: true });

    if (data) {
      const strictlyOwnedTopics = (data as CustomTopic[]).filter((ct) => {
        const meta = extractTopicMetadata(ct);
        return meta.ownerProfileId === resolvedProfileId;
      });
      setCustomTopics(strictlyOwnedTopics);
    }
  }, [resolvedProfileId, supabase]);

  useEffect(() => {
    loadCustomTopics();
  }, [loadCustomTopics]);

  const isFounderProfile = resolvedProfileId === DEFAULT_FOUNDER_PROFILE_ID;
  const baseDefaultTabs = isFounderProfile ? DEFAULT_TABS : GENERIC_USER_DEFAULT_TABS;

  const visibleCustomTopics = customTopics.filter((ct) => {
    const meta = extractTopicMetadata(ct);
    if (!isAdmin && meta.visibility === 'private') return false;
    return true;
  });

  const allTabs: FeedTabItem[] = [
    ...baseDefaultTabs,
    ...visibleCustomTopics.map((ct) => {
      const meta = extractTopicMetadata(ct);
      return {
        id: ct.id,
        label: ct.name,
        tag: ct.tag,
        color: ct.color || '#2563eb',
        isDefault: false,
        icon: meta.icon,
        visibility: meta.visibility,
        templateType: meta.templateType,
        bannerUrl: ct.banner_url,
        bannerR2Key: ct.banner_r2_key,
        descriptionBlocks: ct.description_blocks,
        workspaceData: meta.workspaceData,
      };
    }),
  ];

  const currentTab = allTabs.find((t) => t.id === activeTabId) || baseDefaultTabs[0];

  const templatesCatalog = useMemo(
    () => [
      {
        type: 'goals' as TopicTemplateType,
        section: 'data_sources',
        title: 'Controle de metas',
        subtitle: 'Acompanhe prioridades, indicadores finais e progresso.',
        defaultIcon: 'target' as TopicIconKey,
        defaultColor: '#2563eb',
      },
      {
        type: 'habits' as TopicTemplateType,
        section: 'data_sources',
        title: 'Monitoramento de hábitos',
        subtitle: 'Registo semanal de consistência, estudo e condicionamento.',
        defaultIcon: 'activity' as TopicIconKey,
        defaultColor: '#10b981',
      },
      {
        type: 'tasks' as TopicTemplateType,
        section: 'models',
        title: 'Controle de tarefas',
        subtitle: 'Gestão direta de entregas, status de execução e responsáveis.',
        defaultIcon: 'check' as TopicIconKey,
        defaultColor: '#10b981',
      },
      {
        type: 'roadmap' as TopicTemplateType,
        section: 'models',
        title: 'Projetos & Roadmaps',
        subtitle: 'Planeamento estruturado por fases, marcos técnicos e status.',
        defaultIcon: 'compass' as TopicIconKey,
        defaultColor: '#38bdf8',
      },
      {
        type: 'mindmap' as TopicTemplateType,
        section: 'models',
        title: 'Mapa Mental & Brainstorm',
        subtitle: 'Quadro espacial 2D para arquitetura de ideias, nós e mídias.',
        defaultIcon: 'network' as TopicIconKey,
        defaultColor: '#a855f7',
      },
      {
        type: 'diet' as TopicTemplateType,
        section: 'models',
        title: 'Plano Nutricional',
        subtitle: 'Controlo diário de refeições, macronutrientes e hidratação.',
        defaultIcon: 'nutrition' as TopicIconKey,
        defaultColor: '#f59e0b',
      },
      {
        type: 'agenda' as TopicTemplateType,
        section: 'models',
        title: 'Agenda & Cronograma',
        subtitle: 'Registo cronológico de aulas, reuniões, prazos e eventos.',
        defaultIcon: 'calendar' as TopicIconKey,
        defaultColor: '#E63946',
      },
    ],
    []
  );

  const q = searchQuery.trim().toLowerCase();
  const filteredCatalog = templatesCatalog.filter(
    (item) =>
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
  );

  const dataSourceItems = filteredCatalog.filter((i) => i.section === 'data_sources');
  const modelItems = filteredCatalog.filter((i) => i.section === 'models');

  function handleChooseTemplate(
    type: TopicTemplateType,
    defaultTitle: string,
    defaultIcon: TopicIconKey,
    defaultColor: string,
    subtitle: string
  ) {
    setSelectedTemplate({ type, defaultTitle, defaultIcon, defaultColor, subtitle });
    setName(defaultTitle === 'Página vazia' ? '' : defaultTitle);
    setTag(
      defaultTitle === 'Página vazia'
        ? ''
        : defaultTitle
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 22)
    );
    setIconKey(defaultIcon);
    setColor(defaultColor);
    setIntroText(subtitle);
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    try {
      const presignRes = await fetch('/api/upload/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
          originalSize: file.size,
          compressedSize: file.size,
          isGif: file.type === 'image/gif',
        }),
      });

      const presignData = await presignRes.json();

      if (presignRes.ok && presignData.uploadUrl) {
        const putRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        });

        if (putRes.ok) {
          setBannerUrl(presignData.publicUrl);
          setBannerR2Key(presignData.r2Key || null);
          setUploadingBanner(false);
          return;
        }
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `topics/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      let bucket = 'cover';
      const { error } = await supabase.storage.from(bucket).upload(fileName, file);
      if (error) {
        bucket = 'posts';
        await supabase.storage.from(bucket).upload(fileName, file);
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      setBannerUrl(data.publicUrl);
    } catch {
      alert('Erro ao enviar imagem de capa.');
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate || saving || !resolvedProfileId) return;

    const cleanName = name.trim();
    const cleanTag = (tag.trim() || cleanName)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/^#/, '')
      .replace(/[^a-z0-9]/g, '');

    if (!cleanName || !cleanTag) return;

    setSaving(true);

    const workspaceData = buildInitialWorkspaceData(selectedTemplate.type);

    const descBlocks: PostBlock[] = [
      {
        id: `tblk-meta-${Date.now()}`,
        type: 'callout',
        calloutIcon: iconKey,
        html: introText.trim() || selectedTemplate.subtitle,
        fontStyle: 'sans',
        align: 'left',
        postVisibility: visibility,
        ...({
          _topicMeta: {
            profile_id: resolvedProfileId,
            icon: iconKey,
            visibility,
            template_type: selectedTemplate.type,
            workspace_data: workspaceData,
          },
        } as any),
      },
    ];

    const fullPayload = {
      profile_id: resolvedProfileId,
      name: cleanName,
      tag: cleanTag,
      color,
      icon: iconKey,
      visibility,
      template_type: selectedTemplate.type,
      banner_url: bannerUrl,
      banner_r2_key: bannerR2Key,
      description_blocks: descBlocks,
      workspace_data: workspaceData,
    };

    let { data, error } = await supabase
      .from('custom_topics')
      .insert(fullPayload)
      .select()
      .single();

    if (error) {
      const legacyRetry = await supabase
        .from('custom_topics')
        .insert({
          name: cleanName,
          tag: cleanTag,
          color,
          banner_url: bannerUrl,
          description_blocks: descBlocks,
        })
        .select()
        .single();

      data = legacyRetry.data;
      error = legacyRetry.error;
    }

    setSaving(false);

    if (error || !data) {
      alert('Erro ao criar tópico: ' + (error?.message || 'Erro desconhecido'));
      return;
    }

    const created: CustomTopic = {
      ...(data as CustomTopic),
      profile_id: resolvedProfileId,
      icon: iconKey,
      visibility,
      template_type: selectedTemplate.type,
      workspace_data: workspaceData,
    };

    setCustomTopics((prev) => [...prev, created]);
    setSelectedTemplate(null);
    setName('');
    setTag('');
    setBannerUrl(null);
    setBannerR2Key(null);
    setExpandCreate(false);

    onSelectTab({
      id: created.id,
      label: created.name,
      tag: created.tag,
      color: created.color,
      isDefault: false,
      icon: iconKey,
      visibility,
      templateType: selectedTemplate.type,
      bannerUrl: created.banner_url,
      bannerR2Key: created.banner_r2_key,
      descriptionBlocks: created.description_blocks,
      workspaceData,
    });
  }

  async function handleDeleteTopic(topicToDelete: FeedTabItem) {
    if (topicToDelete.isDefault) return;

    const confirmed = confirm(
      `Excluir a página "${topicToDelete.label}" (#${topicToDelete.tag})? Os posts com essa tag continuarão salvos no feed Principal.`
    );
    if (!confirmed) return;

    if (topicToDelete.bannerR2Key) {
      fetch('/api/upload/r2', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: topicToDelete.bannerR2Key }),
      }).catch(() => {});
    }

    const { error } = await supabase
      .from('custom_topics')
      .delete()
      .eq('id', topicToDelete.id);

    if (!error) {
      setCustomTopics((prev) => prev.filter((t) => t.id !== topicToDelete.id));
      if (activeTabId === topicToDelete.id) {
        onSelectTab(baseDefaultTabs[0]);
      }
    } else {
      alert('Erro ao excluir tópico: ' + error.message);
    }
  }

  return (
    <div className="border-b border-border bg-background">
      {/* 1. Barra de Abas Horizontais com Animação do Asterisco (*) */}
      <div className="flex items-center justify-between px-4 sm:px-6 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-5 sm:gap-7 min-w-max">
          {allTabs.map((tab) => {
            const isActive = tab.id === currentTab.id;
            const isDev = (tab as any).inDevelopment;

            return (
              <div key={tab.id} className="relative flex items-center group">
                <button
                  type="button"
                  onClick={() => {
                    if (isDev) {
                      alert(`A aba "${tab.label}" está atualmente em desenvolvimento.`);
                      return;
                    }
                    if (tab.id !== currentTab.id) {
                      setSwitchingTabId(tab.id);
                      setTimeout(() => setSwitchingTabId(null), 320);
                    }
                    onSelectTab(tab);
                  }}
                  style={{
                    color: isActive ? tab.color : undefined,
                  }}
                  className={`py-3.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    isDev
                      ? 'opacity-60 cursor-not-allowed text-secondary hover:text-secondary'
                      : isActive
                      ? 'text-primary'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {switchingTabId === tab.id ? (
                    <TopicAsteriskSpinner size="xs" color={tab.color} />
                  ) : (
                    !tab.isDefault &&
                    renderTopicVectorIcon(tab.icon, 'w-3.5 h-3.5 shrink-0', tab.color)
                  )}
                  <span>{tab.label}</span>

                  {isDev && (
                    <span className="px-1.5 py-0.2 rounded bg-elevated border border-border text-[9px] font-mono font-medium text-muted">
                      Em breve
                    </span>
                  )}

                  {!tab.isDefault && tab.visibility === 'private' && !isDev && (
                    <span title="Página Particular" className="inline-flex items-center">
                      <Lock className="w-3 h-3 text-muted shrink-0" />
                    </span>
                  )}
                </button>

                {isAdmin && !tab.isDefault && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTopic(tab);
                    }}
                    title={`Excluir página ${tab.label}`}
                    className="ml-1 p-0.5 rounded text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {isActive && !isDev && (
                  <span
                    style={{ backgroundColor: tab.color }}
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  />
                )}
              </div>
            );
          })}

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setSelectedTemplate(null);
                setExpandCreate(true);
              }}
              title="Nova página ou workspace"
              className="w-7 h-7 my-2 rounded-full border bg-elevated border-border text-secondary hover:text-accent hover:border-accent flex items-center justify-center transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal de Criação de Página / Workspace */}
      {isAdmin && expandCreate && (
        <div
          onClick={() => setExpandCreate(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-2xl bg-surface border border-border text-primary shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
              <div className="flex items-center gap-2">
                {selectedTemplate ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Modelos</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setExpandCreate(false)}
                    title="Fechar"
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-elevated text-xs text-secondary transition-colors"
                  >
                    <span className="text-muted">Adicionar a</span>
                    {visibility === 'private' ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                        <Lock className="w-3.5 h-3.5 text-secondary" />
                        Particular
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                        <Globe className="w-3.5 h-3.5 text-accent" />
                        Público
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </button>

                  {showVisibilityMenu && (
                    <div className="absolute left-0 top-full mt-1.5 w-60 p-1.5 rounded-xl bg-surface border border-border shadow-2xl z-30 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setVisibility('private');
                          setShowVisibilityMenu(false);
                        }}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                          visibility === 'private'
                            ? 'bg-elevated'
                            : 'hover:bg-elevated/60'
                        }`}
                      >
                        <Lock className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-primary">
                            Particular
                          </p>
                          <p className="text-[10px] text-muted">
                            Visível exclusivamente na sua sessão de autor.
                          </p>
                        </div>
                        {visibility === 'private' && (
                          <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-1" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setVisibility('public');
                          setShowVisibilityMenu(false);
                        }}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                          visibility === 'public'
                            ? 'bg-elevated'
                            : 'hover:bg-elevated/60'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-primary">
                            Público
                          </p>
                          <p className="text-[10px] text-muted">
                            Disponível na navegação principal do seu perfil.
                          </p>
                        </div>
                        {visibility === 'public' && (
                          <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-1" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!selectedTemplate && (
                <div className="relative w-44 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar modelo..."
                    className="w-full bg-elevated border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              )}

              <div className="w-6 hidden sm:block" />
            </div>

            {/* Corpo da Janela */}
            <div className="p-5 sm:p-8 overflow-y-auto space-y-7 flex-1 bg-background/40">
              {!selectedTemplate ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleChooseTemplate(
                          'blank_page',
                          'Página vazia',
                          'file',
                          '#2563eb',
                          'Tópico livre com editor em grade de 12 colunas e publicações.'
                        )
                      }
                      className="group p-4 rounded-xl bg-elevated/70 hover:bg-elevated border border-border hover:border-accent/60 text-left transition-all flex flex-col justify-between h-24 shadow-sm"
                    >
                      <FileText className="w-5 h-5 text-secondary group-hover:text-accent transition-colors" />
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          Página vazia
                        </p>
                        <p className="text-[11px] text-muted">
                          Feed de publicações com editor em grade
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleChooseTemplate(
                          'blank_db',
                          'Nova base de dados',
                          'database',
                          '#38bdf8',
                          'Tabela estruturada editável com pesquisa e exportação CSV.'
                        )
                      }
                      className="group p-4 rounded-xl bg-elevated/70 hover:bg-elevated border border-border hover:border-accent/60 text-left transition-all flex flex-col justify-between h-24 shadow-sm"
                    >
                      <Table2 className="w-5 h-5 text-secondary group-hover:text-accent transition-colors" />
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          Nova base de dados vazia
                        </p>
                        <p className="text-[11px] text-muted">
                          Tabela dinâmica de página inteira
                        </p>
                      </div>
                    </button>
                  </div>

                  {dataSourceItems.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                        <ArrowUpRight className="w-4 h-4 text-accent" />
                        <span>Fontes de dados existentes</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {dataSourceItems.some((i) => i.type === 'goals') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChooseTemplate(
                                'goals',
                                'Controle de metas',
                                'target',
                                '#2563eb',
                                'Acompanhamento de objetivos, prioridades e progresso.'
                              )
                            }
                            className="group rounded-2xl bg-blue-500/[0.08] hover:bg-blue-500/[0.14] border border-blue-500/25 hover:border-blue-500/60 p-5 text-left transition-all flex flex-col justify-between overflow-hidden h-56 shadow-sm"
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-primary">
                                Controle de metas
                              </h3>
                              <p className="text-[11px] text-secondary mt-0.5">
                                Indicadores de prioridade e barra de conclusão.
                              </p>
                            </div>
                            <div className="mt-3 rounded-xl bg-surface border border-border p-3 space-y-2 shadow-sm">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-500">
                                <Target className="w-3.5 h-3.5" />
                                <span>Controle de metas</span>
                              </div>
                              <div className="grid grid-cols-3 text-[9px] text-muted border-b border-border pb-1">
                                <span>Valor final</span>
                                <span>Prioridade</span>
                                <span>Progresso</span>
                              </div>
                              <div className="space-y-1.5 text-[9px]">
                                <div className="grid grid-cols-3 items-center">
                                  <span className="h-1.5 w-10 rounded bg-border" />
                                  <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 font-semibold w-fit">
                                    Alta
                                  </span>
                                  <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                                    <div className="w-3/4 h-full bg-emerald-500" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 items-center">
                                  <span className="h-1.5 w-12 rounded bg-border" />
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-semibold w-fit">
                                    Média
                                  </span>
                                  <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                                    <div className="w-1/2 h-full bg-emerald-500" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        )}

                        {dataSourceItems.some((i) => i.type === 'habits') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChooseTemplate(
                                'habits',
                                'Monitoramento de hábitos',
                                'activity',
                                '#10b981',
                                'Registo semanal de consistência e disciplina.'
                              )
                            }
                            className="group rounded-2xl bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] border border-emerald-500/25 hover:border-emerald-500/60 p-5 text-left transition-all flex flex-col justify-between overflow-hidden h-56 shadow-sm"
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-primary">
                                Monitoramento de hábitos
                              </h3>
                              <p className="text-[11px] text-secondary mt-0.5">
                                Matriz semanal de rotina e taxa de consistência.
                              </p>
                            </div>
                            <div className="mt-3 rounded-xl bg-surface border border-border p-3 space-y-2 shadow-sm">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                                <Activity className="w-3.5 h-3.5" />
                                <span>Monitoramento de hábitos</span>
                              </div>
                              <div className="grid grid-cols-3 text-[9px] text-muted border-b border-border pb-1">
                                <span>Estudo</span>
                                <span>Alongamento</span>
                                <span>Cardio</span>
                              </div>
                              <div className="space-y-1.5 pt-0.5">
                                {[
                                  [false, false, false],
                                  [true, true, true],
                                ].map((row, rIdx) => (
                                  <div key={rIdx} className="grid grid-cols-3 items-center">
                                    {row.map((checked, cIdx) => (
                                      <span
                                        key={cIdx}
                                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                          checked
                                            ? 'bg-accent border-accent text-white'
                                            : 'border-border bg-elevated'
                                        }`}
                                      >
                                        {checked && <Check className="w-2.5 h-2.5" />}
                                      </span>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {modelItems.length > 0 && (
                    <div className="space-y-3.5 pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                        <Shapes className="w-4 h-4 text-accent" />
                        <span>Modelos</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {modelItems.some((i) => i.type === 'tasks') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChooseTemplate(
                                'tasks',
                                'Controle de tarefas',
                                'check',
                                '#10b981',
                                'Mantenha-se organizado com as tarefas, do seu jeito.'
                              )
                            }
                            className="group rounded-2xl bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] border border-emerald-500/25 hover:border-emerald-500/60 p-5 text-left transition-all flex flex-col justify-between overflow-hidden h-60 shadow-sm"
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-primary">
                                Controle de tarefas
                              </h3>
                              <p className="text-xs text-secondary mt-1">
                                Mantenha-se organizado com as tarefas, do seu jeito.
                              </p>
                            </div>

                            <div className="mt-4 rounded-xl bg-surface border border-border p-3 space-y-2 shadow-sm">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Controle de tarefas</span>
                              </div>
                              <div className="grid grid-cols-3 text-[9px] text-muted border-b border-border pb-1">
                                <span>Tarefa</span>
                                <span>Status</span>
                                <span>Responsável</span>
                              </div>
                              <div className="space-y-1.5 text-[9px]">
                                <div className="grid grid-cols-3 items-center">
                                  <span className="h-1.5 w-12 rounded bg-border" />
                                  <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-semibold w-fit">
                                    Em andamento
                                  </span>
                                  <span className="w-4 h-4 rounded-full bg-elevated border border-border text-primary flex items-center justify-center font-semibold text-[8px]">
                                    AU
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        )}

                        {modelItems.some((i) => i.type === 'roadmap') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChooseTemplate(
                                'roadmap',
                                'Projetos & Roadmap',
                                'compass',
                                '#38bdf8',
                                'Gerencie os projetos do início ao fim.'
                              )
                            }
                            className="group rounded-2xl bg-sky-500/[0.08] hover:bg-sky-500/[0.14] border border-sky-500/25 hover:border-sky-500/60 p-5 text-left transition-all flex flex-col justify-between overflow-hidden h-60 shadow-sm"
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-primary">
                                Projetos & Roadmaps
                              </h3>
                              <p className="text-xs text-secondary mt-1">
                                Gerencie os projetos em Kanban ou Linha do Tempo.
                              </p>
                            </div>

                            <div className="mt-4 rounded-xl bg-surface border border-border p-3 space-y-2.5 shadow-sm">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-500">
                                <Compass className="w-3.5 h-3.5" />
                                <span>Projetos</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px]">
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-semibold">
                                  Em andamento
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                                  Done
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <div className="h-8 rounded bg-elevated border border-border p-1.5">
                                  <div className="h-1.5 w-8 rounded bg-border" />
                                </div>
                                <div className="h-8 rounded bg-elevated border border-border p-1.5">
                                  <div className="h-1.5 w-10 rounded bg-sky-500/70" />
                                </div>
                              </div>
                            </div>
                          </button>
                        )}

                        {modelItems.some((i) => i.type === 'mindmap') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChooseTemplate(
                                'mindmap',
                                'Mapa Mental & Arquitetura',
                                'network',
                                '#a855f7',
                                'Quadro espacial 2D para estruturação de conceitos e conexões.'
                              )
                            }
                            className="group rounded-2xl bg-purple-500/[0.08] hover:bg-purple-500/[0.14] border border-purple-500/25 hover:border-purple-500/60 p-5 text-left transition-all flex flex-col justify-between overflow-hidden h-60 shadow-sm"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-primary">
                                  Mapa Mental & Brainstorm
                                </h3>
                                <span className="px-2 py-0.5 rounded bg-surface border border-border text-secondary text-[9px] font-mono uppercase">
                                  2D Canvas
                                </span>
                              </div>
                              <p className="text-xs text-secondary mt-1">
                                Estruture nós interligados, código, checklists e mídias.
                              </p>
                            </div>

                            <div className="mt-4 rounded-xl bg-surface border border-border p-3 relative h-28 flex items-center justify-center overflow-hidden shadow-sm">
                              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                <line
                                  x1="50%"
                                  y1="50%"
                                  x2="22%"
                                  y2="25%"
                                  stroke="#a855f7"
                                  strokeWidth="1.2"
                                  strokeDasharray="3 3"
                                  opacity="0.6"
                                />
                                <line
                                  x1="50%"
                                  y1="50%"
                                  x2="78%"
                                  y2="28%"
                                  stroke="#38bdf8"
                                  strokeWidth="1.2"
                                  opacity="0.6"
                                />
                              </svg>
                              <span className="relative z-10 px-2.5 py-1 rounded-md bg-elevated border border-purple-500/60 text-primary text-[10px] font-semibold shadow-sm flex items-center gap-1.5">
                                <Network className="w-3 h-3 text-purple-500" /> Núcleo
                              </span>
                              <span className="absolute left-3 top-2.5 px-2 py-0.5 rounded bg-elevated border border-border text-[9px] text-secondary">
                                Código
                              </span>
                              <span className="absolute right-3 top-3 px-2 py-0.5 rounded bg-elevated border border-border text-[9px] text-secondary">
                                Mídia R2
                              </span>
                            </div>
                          </button>
                        )}

                        {modelItems.some((i) => i.type === 'diet') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChooseTemplate(
                                'diet',
                                'Plano Nutricional',
                                'nutrition',
                                '#f59e0b',
                                'Registo diário de refeições, macronutrientes e hidratação.'
                              )
                            }
                            className="group rounded-2xl bg-amber-500/[0.08] hover:bg-amber-500/[0.14] border border-amber-500/25 hover:border-amber-500/60 p-5 text-left transition-all flex flex-col justify-between overflow-hidden h-60 shadow-sm"
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-primary">
                                Plano Nutricional
                              </h3>
                              <p className="text-xs text-secondary mt-1">
                                Controlo diário de refeições, proteínas e meta hídrica.
                              </p>
                            </div>

                            <div className="mt-4 rounded-xl bg-surface border border-border p-3 space-y-2 text-[9px] shadow-sm">
                              <div className="flex items-center justify-between text-amber-500 font-semibold text-[11px]">
                                <span className="flex items-center gap-1.5">
                                  <Apple className="w-3.5 h-3.5" /> Nutrição & Macros
                                </span>
                                <span className="text-[9px] text-muted font-mono">
                                  4/8 copos
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-border text-secondary">
                                <span>08:00 · Refeição 01</span>
                                <span className="text-emerald-500 font-mono font-semibold">
                                  20g P
                                </span>
                              </div>
                            </div>
                          </button>
                        )}

                        {modelItems.some((i) => i.type === 'agenda') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChooseTemplate(
                                'agenda',
                                'Agenda & Cronograma',
                                'calendar',
                                '#E63946',
                                'Registo cronológico de disciplinas, reuniões e prazos.'
                              )
                            }
                            className="group rounded-2xl bg-rose-500/[0.08] hover:bg-rose-500/[0.14] border border-rose-500/25 hover:border-rose-500/60 p-5 text-left transition-all flex flex-col justify-between overflow-hidden h-60 sm:col-span-2 shadow-sm"
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-primary">
                                Agenda & Cronograma
                              </h3>
                              <p className="text-xs text-secondary mt-1">
                                Organize datas académicas, reuniões e eventos com filtros por categoria.
                              </p>
                            </div>

                            <div className="mt-4 rounded-xl bg-surface border border-border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] shadow-sm">
                              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-elevated border border-border">
                                <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
                                <div>
                                  <p className="font-semibold text-primary">
                                    19:00 · Planeamento Semanal
                                  </p>
                                  <p className="text-[9px] text-muted">
                                    Insight · Geral
                                  </p>
                                </div>
                              </div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleCreateTopic} className="space-y-5">
                  <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-elevated border border-border">
                    <div
                      style={{
                        backgroundColor: `${color}15`,
                        borderColor: `${color}40`,
                      }}
                      className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                    >
                      {renderTopicVectorIcon(iconKey, 'w-5 h-5', color)}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Modelo · {selectedTemplate.defaultTitle}
                      </span>
                      <h2 className="text-base font-bold text-primary">
                        Configurar nova página
                      </h2>
                      <p className="text-xs text-secondary">
                        {selectedTemplate.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-primary block">
                      Ícone da página
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {TOPIC_ICON_OPTIONS.map((item) => {
                        const IconComp = item.Icon;
                        const active = iconKey === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            title={item.label}
                            onClick={() => setIconKey(item.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              active
                                ? 'bg-elevated border-accent text-primary shadow-sm'
                                : 'bg-surface border-border text-secondary hover:text-primary'
                            }`}
                          >
                            <IconComp
                              className="w-3.5 h-3.5"
                              style={{ color: active ? color : undefined }}
                            />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-primary block mb-1">
                        Título da Página
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={36}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setTag(
                            e.target.value
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .toLowerCase()
                              .replace(/[^a-z0-9]/g, '')
                              .slice(0, 24)
                          );
                        }}
                        placeholder="Ex: Arquitetura, Estudos, Projetos..."
                        className="w-full bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-primary block mb-1">
                        Identificador (Hashtag)
                      </label>
                      <div className="flex items-center bg-elevated border border-border rounded-xl px-3.5 py-2.5 focus-within:border-accent">
                        <Hash className="w-3.5 h-3.5 text-muted mr-1.5 shrink-0" />
                        <input
                          type="text"
                          required
                          maxLength={24}
                          value={tag}
                          onChange={(e) =>
                            setTag(
                              e.target.value
                                .toLowerCase()
                                .replace(/^#/, '')
                                .replace(/[^a-z0-9]/g, '')
                            )
                          }
                          placeholder="identificador"
                          className="w-full bg-transparent text-xs text-primary font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-primary block mb-1.5">
                        Cor de acento
                      </label>
                      <div className="flex items-center gap-2">
                        {TOPIC_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                              color.toLowerCase() === c.toLowerCase()
                                ? 'border-primary scale-110'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-primary block mb-1">
                        Descrição da página
                      </label>
                      <input
                        type="text"
                        value={introText}
                        onChange={(e) => setIntroText(e.target.value)}
                        placeholder="Objetivo ou diretriz desta página..."
                        className="w-full bg-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1.5">
                      Imagem de capa
                    </label>
                    {!bannerUrl ? (
                      <div
                        onClick={() => bannerInputRef.current?.click()}
                        className="h-24 rounded-xl bg-elevated/60 border border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ImagePlus className="w-4 h-4 text-accent" />
                        <span className="text-xs font-medium text-secondary">
                          {uploadingBanner
                            ? 'A carregar imagem para Cloudflare R2...'
                            : 'Selecionar imagem de capa'}
                        </span>
                        <input
                          ref={bannerInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="relative h-36 rounded-xl overflow-hidden border border-border">
                        <img
                          src={bannerUrl}
                          alt="Capa"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setBannerUrl(null);
                            setBannerR2Key(null);
                          }}
                          className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-medium flex items-center gap-1 hover:bg-black"
                        >
                          <X className="w-3 h-3" />
                          <span>Remover</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(null)}
                      className="px-4 py-2 rounded-xl bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={saving || uploadingBanner}
                      style={{ backgroundColor: color }}
                      className="px-5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow hover:opacity-95 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {saving
                          ? 'A guardar...'
                          : `Criar Página (${
                              visibility === 'private' ? 'Particular' : 'Pública'
                            })`}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Cabeçalho e Painel do Tópico Selecionado (Com transição de Asterisco) */}
      {switchingTabId ? (
        <TopicAsteriskSpinner size="md" color={currentTab.color} />
      ) : (
        <>
          {!currentTab.isDefault && (
            <div className="mx-4 sm:mx-6 my-4 rounded-2xl overflow-hidden border border-border bg-surface">
              {currentTab.bannerUrl && (
                <div className="relative w-full h-36 sm:h-44 bg-elevated overflow-hidden border-b border-border">
                  <img
                    src={currentTab.bannerUrl}
                    alt={currentTab.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-block px-2 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] font-semibold text-zinc-200">
                          #{currentTab.tag}
                        </span>
                        {currentTab.visibility === 'private' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 border border-white/15 text-zinc-300 text-[10px] font-medium">
                            <Lock className="w-2.5 h-2.5" /> Particular
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow flex items-center gap-2">
                        {renderTopicVectorIcon(currentTab.icon, 'w-5 h-5', currentTab.color)}
                        <span>{currentTab.label}</span>
                      </h2>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTopic(currentTab)}
                        className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-danger text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 space-y-2.5">
                {!currentTab.bannerUrl && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderTopicVectorIcon(currentTab.icon, 'w-4 h-4', currentTab.color)}
                      <h2 className="text-base sm:text-lg font-bold text-primary">
                        {currentTab.label}
                      </h2>
                      <span className="text-xs font-mono text-muted">
                        #{currentTab.tag}
                      </span>
                      {currentTab.visibility === 'private' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-elevated border border-border text-secondary text-[10px] font-medium">
                          <Lock className="w-2.5 h-2.5" /> Particular
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTopic(currentTab)}
                        className="px-2.5 py-1 rounded-lg bg-elevated border border-border hover:border-danger text-xs text-secondary hover:text-danger flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                )}

                {Array.isArray(currentTab.descriptionBlocks) &&
                  currentTab.descriptionBlocks.length > 0 && (
                    <div className="notion-content space-y-2 text-xs sm:text-sm text-secondary leading-relaxed">
                      {currentTab.descriptionBlocks.map((b, i) => (
                        <div
                          key={b.id || i}
                          style={{ borderLeftColor: currentTab.color }}
                          className="pl-3 py-0.5 border-l-2"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeBlockHtml(b.html),
                          }}
                        />
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* 4. Painel de Workspace do Tópico */}
          {!currentTab.isDefault &&
            currentTab.templateType &&
            currentTab.templateType !== 'blank_page' && (
              <TopicWorkspaceView
                topicId={currentTab.id}
                topicColor={currentTab.color}
                templateType={currentTab.templateType}
                initialData={currentTab.workspaceData || {}}
                descriptionBlocks={currentTab.descriptionBlocks}
                isAdmin={isAdmin}
                onWorkspaceUpdated={(nextData) => {
                  setCustomTopics((prev) =>
                    prev.map((ct) =>
                      ct.id === currentTab.id
                        ? { ...ct, workspace_data: nextData }
                        : ct
                    )
                  );
                }}
              />
            )}
        </>
      )}
    </div>
  );
}

//teste