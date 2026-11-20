# Insight Nitro — Especificação técnica e de produto

> Status: **beta fechada em produção — acesso só para `role = 'admin'`** · Stack: Next.js 15 (App Router), TypeScript, Tailwind, Supabase, Cloudflare R2

> **O que está no ar (20/11/2026)** — a estratégia de Preview da §1 foi substituída, a pedido, por uma beta fechada em produção:
> - Gate por papel: só `profiles.role = 'admin'` acessa `/nitro`, a aba "Perfil & Nitro" e **enxerga** cosméticos. Demais usuários veem o item "Insight Nitro" com cadeado na barra lateral e uma tela "Em breve".
> - Interruptor geral: `NEXT_PUBLIC_INSIGHT_NITRO=off` na Vercel desliga tudo (inclusive para admin).
> - Banco: só `profiles.cosmetics` (snapshot) + trigger de proteção + RPC `set_my_cosmetics` (exige admin). Migração: `supabase/migrations/20261120000000_insight_nitro_admin_beta.sql`. As tabelas de catálogo/assinatura da §3 ficam para o lançamento.
> - Catálogo: os 48 itens da §2 em `src/lib/nitro/catalog.ts`, renderizados 100% em CSS/SVG (`src/components/nitro/nitro.css`); assets na R2 (§3.5) ainda não são necessários.
> - Propagação: perfil, posts, página de discussão (árvore, carrossel e composer) e barra lateral. Notificações e Explore ainda não.

O Insight Nitro é uma galeria de personalização de perfil com assinatura mensal e coleções temáticas.
O usuário equipa quatro tipos de item:

| Tipo | O que muda |
|---|---|
| **Estilo de título** | Acabamento do nome de exibição (gradiente, brilho, animação) |
| **Tag especial** | Selo ao lado do `@username` |
| **Moldura** | Anel/ornamento em volta do avatar |
| **Animação de abertura** | Efeito de entrada ao abrir a página `/u/[username]` |

Além disso, o sistema de patentes (`src/lib/contributorLevels.ts`) passa a conceder **molduras de nível para todos os níveis (0–5)** e uma **animação de patente exclusiva para os níveis 4 (Imperador) e 5 (Grão-Mestre)**.

---

## Sumário

1. [Feature flag e isolamento em Preview](#1-feature-flag-e-isolamento-em-preview)
2. [Catálogo inicial](#2-catálogo-inicial)
3. [Modelagem de dados](#3-modelagem-de-dados)
4. [Fluxo de UI/UX](#4-fluxo-de-uiux)
5. [Plano de entrega](#5-plano-de-entrega)

---

## 1. Feature flag e isolamento em Preview

### 1.1 Regra de ativação

O Nitro só existe quando **as duas condições** são verdadeiras:

```
VERCEL_ENV === 'preview'  &&  NEXT_PUBLIC_ENABLE_INSIGHT_NITRO === 'true'
```

A checagem de ambiente é proposital: mesmo que alguém defina a flag por engano no target *Production*, o Nitro continua desligado. Para o lançamento público, a condição de ambiente é removida num PR explícito (ver [Fase 5](#5-plano-de-entrega)).

**Configuração na Vercel (Project → Settings → Environment Variables):**

| Variável | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_ENABLE_INSIGHT_NITRO` | — (não definir) | `true` | `true` (opcional) |
| `NEXT_PUBLIC_VERCEL_ENV` | automático | automático | — |

`NEXT_PUBLIC_VERCEL_ENV` é exposta automaticamente quando a opção *Automatically expose System Environment Variables* está ligada (padrão). Em `next dev` ela não existe; por isso o helper aceita `NEXT_PUBLIC_NITRO_DEV_OVERRIDE=true` **apenas** quando `NODE_ENV === 'development'`.

### 1.2 Helper único

`src/lib/nitro/flags.ts`

```ts
/**
 * Fonte única da verdade para o Insight Nitro.
 * NEXT_PUBLIC_* é embutido no bundle no build, então funciona em
 * Server e Client Components — e é avaliado por deploy (Preview ≠ Production).
 */
export function isNitroEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_INSIGHT_NITRO === 'true';
  if (!flag) return false;

  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (env === 'preview') return true;

  return (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_NITRO_DEV_OVERRIDE === 'true'
  );
}
```

### 1.3 Camadas de bloqueio

Cada camada funciona sozinha; juntas, nada do Nitro aparece nem responde em produção.

| Camada | Onde | Comportamento em produção |
|---|---|---|
| **Rotas** | `src/app/nitro/layout.tsx` (Server Component) | `if (!isNitroEnabled()) notFound()` → 404 para `/nitro` e qualquer sub-rota |
| **API** | `src/app/api/nitro/**/route.ts` | Primeira linha: `if (!isNitroEnabled()) return new NextResponse(null, { status: 404 })` |
| **Navegação** | `LeftSidebar`, `MobileBottomNav`, `ProfileHeader`, `config/page.tsx` | Links, botões, banners e a aba "Perfil & Nitro" só renderizam se `isNitroEnabled()` |
| **Renderização global** | `<UserIdentity>` e derivados ([§4.5](#45-propagação-global)) | Em produção, ignora `profiles.cosmetics` e renderiza o avatar/nome padrão |
| **Dados** | Supabase | Ver [§1.4](#14-banco-de-dados-em-preview) |

A camada de **renderização global** é a mais importante e a mais fácil de esquecer: se Preview e Production usam o mesmo Supabase, um testador que equipa uma moldura em Preview grava em `profiles.cosmetics`. Sem o gate no componente, a moldura apareceria para todo mundo em produção.

> ⚠️ **Middleware inativo.** O arquivo atual é `src/middleare.ts` (falta o "w"). O Next.js só executa `middleware.ts`, então ele **nunca roda hoje**. Não use middleware como bloqueio do Nitro. Renomear ativaria o refresh de sessão do Supabase em todas as rotas — mudança útil, mas deve ir num PR separado e testado à parte.

### 1.4 Banco de dados em Preview

- **Recomendado:** usar um **Supabase Branch** (ou projeto de staging) para Preview, configurando `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` apenas no target *Preview*. Assim os dados de teste nunca tocam produção.
- **Se o banco for compartilhado:** as migrações abaixo são **aditivas** (só criam tabelas/colunas, nada é removido), e o gate de renderização ([§1.3](#13-camadas-de-bloqueio)) impede vazamento visual. As RPCs de escrita também podem checar uma allowlist (`nitro_testers`) durante o Preview.

### 1.5 Estrutura de pastas

```
src/
├── app/
│   ├── nitro/
│   │   ├── layout.tsx              # gate (notFound) + shell da galeria
│   │   ├── page.tsx                # galeria: coleções + categorias + preview ao vivo
│   │   └── [collection]/page.tsx   # página de uma coleção (ex.: /nitro/infernal)
│   ├── api/nitro/
│   │   ├── equip/route.ts          # POST → RPC set_profile_cosmetics
│   │   └── subscription/route.ts   # status / (fase 5) checkout
│   └── config/page.tsx             # + aba 'nitro' ("Perfil & Nitro")
├── components/nitro/
│   ├── UserIdentity.tsx            # avatar + nome + tag + patente (usado em todo lugar)
│   ├── CosmeticAvatar.tsx          # avatar com moldura (static | animated)
│   ├── CosmeticName.tsx            # nome com estilo de título
│   ├── CosmeticTag.tsx             # tag especial
│   ├── ProfileIntro.tsx            # animação de abertura (uma vez por sessão)
│   ├── NitroCustomizeSheet.tsx     # editor rápido (aberto pelo perfil)
│   ├── NitroItemCard.tsx           # card da galeria (estado: equipado/bloqueado)
│   └── effects/                    # CSS/SVG de cada moldura, título e abertura
│       ├── frames.css
│       ├── titles.css
│       └── intros.css
└── lib/nitro/
    ├── flags.ts                    # isNitroEnabled()
    ├── catalog.ts                  # catálogo tipado (espelho da tabela nitro_items)
    ├── entitlements.ts             # canUseItem(item, profile, subscription)
    ├── assets.ts                   # nitroAssetUrl(key) + fallback
    └── useCosmetics.ts             # hook com Supabase Realtime
supabase/migrations/
└── 2026XXXX_insight_nitro.sql
```

---

## 2. Catálogo inicial

### 2.1 Coleções

| ID | Coleção | Paleta | Disponibilidade |
|---|---|---|---|
| `natal` | **Natal** | vermelho `#c1121f`, verde `#2d6a4f`, neve `#e0f2fe` | Sazonal (dez–jan), depois permanece para quem desbloqueou |
| `infernal` | **Infernal** | brasa `#f97316`, magma `#7f1d1d`, carvão `#0c0a09` | Permanente |
| `imperial` | **Imperial** | ouro `#d4a72c`, púrpura `#4c1d95` | Permanente |
| `celestial` | **Celestial** | aurora `#5eead4` → `#a78bfa`, estelar `#fef9c3` | Permanente |
| `anime` | **Anime** | sakura `#f9a8d4`, tinta `#111827` | Permanente |
| `princess` | **Princess** | rosé `#fbcfe8`, pérola `#fdf2f8`, cristal `#c4b5fd` | Permanente |
| `cyber` | **Cyber** | néon `#22d3ee`, magenta `#e11d48`, cromo `#94a3b8` | Permanente |
| `cosmico` | **Cósmico** | nebulosa `#6d28d9` → `#ec4899`, espectro rainbow | Permanente |
| `patentes` | **Patentes** | cores de `CONTRIBUTOR_TIERS` | Conquistada por nível, **não** faz parte da assinatura |

**Raridade** (só visual na galeria): `comum`, `rara`, `épica`, `lendária`.

**Requisito de desbloqueio** (`requirement`):

- `nitro`: assinatura ativa.
- `level`: patente mínima (`min_level`).
- `event`: concedido por evento/campanha (fica em `nitro_unlocks`).

### 2.2 Estilos de título (10)

Técnica base: `background-clip: text` com gradiente e `background-position` animado. **Fallback:** cor sólida `fallbackColor` quando a animação está desligada, sob `prefers-reduced-motion` ou em navegadores sem suporte.

| # | ID | Nome | Coleção | Raridade | Efeito | Fallback |
|---|---|---|---|---|---|---|
| 1 | `title-gold-brushed` | **Ouro Escovado** | Imperial | rara | Gradiente ouro em 4 paradas com faixa de brilho que atravessa o texto a cada 4 s | `#d4a72c` |
| 2 | `title-celestial-aurora` | **Celestial Aurora** | Celestial | épica | Gradiente verde-água → violeta ondulando lentamente (8 s), leve `drop-shadow` | `#5eead4` |
| 3 | `title-rainbow-prism` | **Rainbow Prismático** | Cósmico | lendária | Espectro completo deslizando em loop (6 s); com animação desligada vira gradiente estático | `#a78bfa` |
| 4 | `title-infernal-embers` | **Brasas Infernais** | Infernal | épica | Laranja → vermelho com cintilação irregular (`steps`) simulando brasa | `#f97316` |
| 5 | `title-christmas-frost` | **Gelo Natalino** | Natal | rara | Azul-gelo com cristais (`text-shadow` branco) e brilho intermitente | `#7dd3fc` |
| 6 | `title-imperial-crown` | **Coroa Imperial** | Imperial | lendária | Ouro sobre púrpura; ícone de coroa (`Crown`) antes do nome | `#d4a72c` |
| 7 | `title-sakura` | **Sakura Anime** | Anime | rara | Rosa → branco com pétala SVG que cai sobre o nome a cada 10 s | `#f9a8d4` |
| 8 | `title-royal-princess` | **Real Princess** | Princess | rara | Rosé perolado com faíscas (`✦`) pulsando nas extremidades | `#f472b6` |
| 9 | `title-cyber-chrome` | **Cromo Cyberpunk** | Cyber | épica | Cromo metálico com *glitch* RGB de 120 ms a cada 7 s | `#94a3b8` |
| 10 | `title-cosmic-neon` | **Néon Cósmico** | Cósmico | épica | Magenta/ciano com `text-shadow` néon pulsando (respiração 3 s) | `#e879f9` |

> O campo atual `profiles.nickname_color` continua existindo: é a cor do apelido. O estilo de título se aplica ao **nome de exibição** e tem precedência visual; sem estilo equipado, nada muda.

### 2.3 Tags especiais (10)

Renderizadas como pílula compacta (altura 18 px) depois do `@username`. Ícones do `lucide-react`, já instalado.

| # | ID | Texto | Coleção | Ícone | Estilo |
|---|---|---|---|---|---|
| 1 | `tag-nitro-founder` | **Fundador Nitro** | Cósmico | `Zap` | Gradiente rainbow sutil; exclusiva de quem testou durante o Preview (`event`) |
| 2 | `tag-honorary-santa` | **Noel Honorário** | Natal | `Gift` | Vermelho com borda verde e pontos de neve |
| 3 | `tag-frost-guardian` | **Guardião do Gelo** | Natal | `Snowflake` | Azul-gelo translúcido |
| 4 | `tag-infernal-pact` | **Pacto Infernal** | Infernal | `Flame` | Fundo carvão, texto brasa com brilho |
| 5 | `tag-royal-blood` | **Sangue Real** | Imperial | `Crown` | Púrpura com filete dourado |
| 6 | `tag-star-born` | **Filho das Estrelas** | Celestial | `Star` | Azul-noite com estrela cintilante |
| 7 | `tag-senpai` | **Senpai 先輩** | Anime | `Sparkles` | Branco com contorno tinta, estilo mangá |
| 8 | `tag-highness` | **Alteza** | Princess | `Gem` | Rosé perolado |
| 9 | `tag-netrunner` | **Netrunner** | Cyber | `Cpu` | Fundo preto, texto ciano monoespaçado, borda néon |
| 10 | `tag-cosmic-voyager` | **Viajante Cósmico** | Cósmico | `Orbit` | Gradiente nebulosa |

### 2.4 Molduras animadas (10 Nitro)

Duas técnicas, escolhidas por moldura:

- **CSS/SVG puro** (padrão): anel com `conic-gradient` + máscara radial, ornamentos em SVG inline. Zero download, escala com o tamanho do avatar.
- **Overlay em R2** (só quando há partículas complexas): WebP animado em `nitro/v1/frames/<id>/anim.webp` + pôster estático `static.webp`. O anel CSS sempre aparece por baixo, então se o asset falhar a moldura continua reconhecível.

| # | ID | Nome | Coleção | Técnica | Animação | Modo estático |
|---|---|---|---|---|---|---|
| 1 | `frame-xmas-wreath` | **Guirlanda Natalina** | Natal | SVG + R2 (neve) | Flocos caindo pela borda; bolinhas piscando | Guirlanda sem neve |
| 2 | `frame-royal-snowflake` | **Floco de Neve Real** | Natal | CSS/SVG | Seis cristais girando devagar (40 s/volta) | Cristais parados |
| 3 | `frame-flame-crown` | **Coroa de Chamas** | Infernal | CSS + R2 (fogo) | Chamas subindo pela metade superior do anel | Anel brasa com gradiente |
| 4 | `frame-abyss-horns` | **Chifres do Abismo** | Infernal | SVG | Chifres no topo; brilho vermelho "respirando" | Chifres sem brilho |
| 5 | `frame-imperial-laurel` | **Laurel Imperial** | Imperial | SVG | Ramos de louro dourados com faixa de reflexo percorrendo as folhas | Louro dourado fosco |
| 6 | `frame-aurora-halo` | **Halo Aurora** | Celestial | CSS | `conic-gradient` aurora girando (12 s) com desfoque suave | Gradiente parado |
| 7 | `frame-sakura-petals` | **Pétalas de Sakura** | Anime | CSS + R2 (pétalas) | Pétalas orbitando e caindo | Anel rosa com 3 flores fixas |
| 8 | `frame-crystal-tiara` | **Tiara de Cristal** | Princess | SVG | Tiara no topo; faíscas surgindo nas pedras | Tiara sem faíscas |
| 9 | `frame-neon-circuit` | **Circuito Néon** | Cyber | SVG | Trilhas de circuito com pulso de luz percorrendo o `stroke-dashoffset` | Trilhas acesas sem pulso |
| 10 | `frame-saturn-ring` | **Anel de Saturno** | Cósmico | SVG | Anel elíptico inclinado com lua orbitando (avatar como planeta) | Anel sem lua |

### 2.5 Molduras de patente (6, coleção Patentes)

Concedidas automaticamente pela patente: não exigem assinatura e não contam entre as 10 do Nitro. Cores e efeitos derivam de `CONTRIBUTOR_TIERS` e `TierEffectKey`, mantendo a identidade dos selos existentes.

| Nível | Patente | ID | Moldura | Animação |
|---|---|---|---|---|
| 0 | Observador | `frame-tier-0` | Anel ardósia fino (`#64748b`) | Estática |
| 1 | Recruta | `frame-tier-1` | Anel cobre com 3 faíscas fixas (`ember`) | Estática |
| 2 | Escudeiro | `frame-tier-2` | Anel metálico com reflexo prismático (`prism`) | Estática |
| 3 | Cavaleiro | `frame-tier-3` | Ouro escovado com rebites (`gold`) | Estática |
| 4 | Imperador | `frame-tier-4` | Safira com grade técnica (`sapphire`) | **Animada:** pulso luminoso percorrendo a grade |
| 5 | Grão-Mestre | `frame-tier-5` | Espectro prismático (`singularity`) | **Animada:** rotação do espectro + partículas |

Cada usuário vê na galeria **todas as molduras de patente até o seu nível** (um Cavaleiro pode usar as dos níveis 0–3). As superiores aparecem bloqueadas, com "Disponível no nível X" e link para `/apoie`.

> **Interpretação adotada:** "animação exclusiva dos níveis 4 e 5" foi lida como (a) as molduras de patente 4 e 5 são as únicas animadas da coleção Patentes e (b) esses níveis ganham uma **animação de abertura de patente** própria ([§2.7](#27-animações-de-abertura-de-patente-níveis-4-e-5)). Ambas respeitam o toggle `level_animation_enabled`.

### 2.6 Animações de abertura (10 Nitro)

Tocam ao abrir `/u/[username]`. Regras comuns:

- Duração ≤ **1,2 s**; o conteúdo do perfil fica visível por baixo desde o início (sem bloquear leitura).
- Pula com clique/tecla.
- Toca **uma vez por perfil por sessão** (`sessionStorage`).
- Implementadas com CSS (keyframes + `clip-path`/`mask`) em uma camada `position: fixed; pointer-events: none`. Assets de partículas no R2 quando necessário.

| # | ID | Nome | Coleção | Efeito |
|---|---|---|---|---|
| 1 | `intro-blizzard` | **Nevasca** | Natal | Rajada de neve atravessa a tela e "assenta" na capa |
| 2 | `intro-gift-unwrap` | **Presente Aberto** | Natal | Fita vermelha se desfaz e revela o perfil do centro para fora |
| 3 | `intro-hell-portal` | **Portal Infernal** | Infernal | Fenda de fogo abre no avatar e expande em círculo (`clip-path: circle`) |
| 4 | `intro-imperial-decree` | **Decreto Imperial** | Imperial | Estandarte púrpura desce e se recolhe deixando poeira dourada |
| 5 | `intro-star-shower` | **Chuva de Estrelas** | Celestial | Estrelas cadentes cruzam a capa; a última acende o avatar |
| 6 | `intro-eclipse` | **Eclipse** | Celestial | Disco escuro passa sobre o avatar e revela uma coroa de luz |
| 7 | `intro-speedlines` | **Linhas de Ação** | Anime | Speedlines radiais + "flash" branco, estilo corte de anime |
| 8 | `intro-fairy-tale` | **Conto de Fadas** | Princess | Rastro de varinha desenha uma espiral de brilho até o nome |
| 9 | `intro-glitch-boot` | **Boot Glitch** | Cyber | Tela "inicializa" com scanlines e glitch RGB antes de estabilizar |
| 10 | `intro-hyperspace` | **Hiperespaço** | Cósmico | Estrelas esticam em linhas (salto) e o perfil "chega" |

### 2.7 Animações de abertura de patente (níveis 4 e 5)

Independentes das 10 do Nitro: o usuário pode ter as duas, mas **só uma toca** (prioridade: patente, se ligada; senão, a do Nitro).

| Nível | ID | Nome | Efeito |
|---|---|---|---|
| 4 | `intro-tier-4` | **Ascensão Safira** | Grade técnica azul se monta sobre a capa e converge no selo Safira |
| 5 | `intro-tier-5` | **Singularidade Prismática** | Ponto de luz no avatar explode no espectro do Grão-Mestre |

---

## 3. Modelagem de dados

### 3.1 Visão geral

```
nitro_collections 1─* nitro_items
profiles 1─1 nitro_subscriptions        (assinatura)
profiles 1─* nitro_unlocks *─1 nitro_items   (desbloqueios permanentes: evento, compra avulsa futura)
profiles 1─1 profile_cosmetics *─1 nitro_items  (o que está equipado + toggles)
profiles.cosmetics (jsonb)               ← snapshot gerado por trigger, lido por toda a UI
```

**Por que um snapshot em `profiles.cosmetics`?** Feed, Explore, notificações e perfil já carregam linhas de `profiles` (`select('*')`). Com o snapshot, os cosméticos chegam a todas essas telas **sem joins novos** e sem consultar o catálogo. A fonte da verdade continua sendo `profile_cosmetics`; o snapshot só pode ser escrito pela RPC.

### 3.2 Migração SQL

`supabase/migrations/2026XXXX_insight_nitro.sql`

```sql
-- =========================================================================
-- INSIGHT NITRO — catálogo, assinaturas, desbloqueios e itens equipados
-- Migração aditiva e idempotente.
-- =========================================================================

-- ---------- Tipos ----------
do $$ begin
  create type nitro_item_kind as enum ('title_style', 'tag', 'frame', 'intro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type nitro_requirement as enum ('nitro', 'level', 'event');
exception when duplicate_object then null; end $$;

do $$ begin
  create type nitro_sub_status as enum ('trialing', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

-- ---------- Catálogo ----------
create table if not exists public.nitro_collections (
  id          text primary key,              -- 'natal', 'infernal', ...
  name        text not null,
  description text,
  accent      text not null,                 -- cor principal (hex)
  starts_at   timestamptz,                   -- coleções sazonais
  ends_at     timestamptz,
  sort        integer not null default 0
);

create table if not exists public.nitro_items (
  id               text primary key,         -- 'frame-aurora-halo'
  kind             nitro_item_kind not null,
  collection_id    text not null references public.nitro_collections(id),
  name             text not null,
  description      text,
  rarity           text not null default 'comum'
                   check (rarity in ('comum', 'rara', 'épica', 'lendária')),
  requirement      nitro_requirement not null default 'nitro',
  min_level        integer check (min_level between 0 and 5),
  config           jsonb not null default '{}'::jsonb,  -- cores, ícone, fallbackColor, cssClass...
  asset_key        text,                     -- chave R2 animada (opcional)
  static_asset_key text,                     -- pôster estático (opcional)
  is_active        boolean not null default true,
  sort             integer not null default 0,
  check (requirement <> 'level' or min_level is not null)
);

create index if not exists nitro_items_kind_idx on public.nitro_items(kind, collection_id);

-- ---------- Assinatura ----------
create table if not exists public.nitro_subscriptions (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  status             nitro_sub_status not null,
  current_period_end timestamptz not null,
  provider           text not null default 'manual',  -- 'manual' (Preview) | 'mercadopago'
  provider_ref       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- Desbloqueios permanentes ----------
create table if not exists public.nitro_unlocks (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id    text not null references public.nitro_items(id) on delete cascade,
  source     text not null default 'event',   -- 'event' | 'grant' | 'purchase'
  granted_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);

-- ---------- Itens equipados + toggles ----------
create table if not exists public.profile_cosmetics (
  profile_id               uuid primary key references public.profiles(id) on delete cascade,
  title_style_id           text references public.nitro_items(id) on delete set null,
  tag_id                   text references public.nitro_items(id) on delete set null,
  frame_id                 text references public.nitro_items(id) on delete set null,
  intro_id                 text references public.nitro_items(id) on delete set null,
  frame_enabled            boolean not null default true,  -- false = remove a moldura
  frame_animated           boolean not null default true,  -- false = moldura estática
  intro_enabled            boolean not null default true,  -- abertura do Nitro
  level_animation_enabled  boolean not null default true,  -- moldura animada + abertura de patente (níveis 4/5)
  updated_at               timestamptz not null default now()
);

-- Snapshot lido por toda a UI
alter table public.profiles
  add column if not exists cosmetics jsonb;

-- Allowlist de testadores durante o Preview (opcional)
create table if not exists public.nitro_testers (
  profile_id uuid primary key references public.profiles(id) on delete cascade
);

-- ---------- RLS ----------
alter table public.nitro_collections   enable row level security;
alter table public.nitro_items         enable row level security;
alter table public.nitro_subscriptions enable row level security;
alter table public.nitro_unlocks       enable row level security;
alter table public.profile_cosmetics   enable row level security;
alter table public.nitro_testers       enable row level security;

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() or id = auth.uid() limit 1
$$;

drop policy if exists "nitro_collections_read" on public.nitro_collections;
create policy "nitro_collections_read" on public.nitro_collections for select using (true);

drop policy if exists "nitro_items_read" on public.nitro_items;
create policy "nitro_items_read" on public.nitro_items for select using (is_active);

drop policy if exists "nitro_subs_read_own" on public.nitro_subscriptions;
create policy "nitro_subs_read_own" on public.nitro_subscriptions
  for select using (profile_id = public.current_profile_id());

drop policy if exists "nitro_unlocks_read_own" on public.nitro_unlocks;
create policy "nitro_unlocks_read_own" on public.nitro_unlocks
  for select using (profile_id = public.current_profile_id());

drop policy if exists "profile_cosmetics_read_own" on public.profile_cosmetics;
create policy "profile_cosmetics_read_own" on public.profile_cosmetics
  for select using (profile_id = public.current_profile_id());
-- Sem policies de INSERT/UPDATE/DELETE: toda escrita passa pelas RPCs abaixo.

-- ---------- Proteção do snapshot ----------
-- O usuário consegue dar UPDATE na própria linha de profiles (editar bio etc.).
-- Este trigger impede que ele escreva cosmetics diretamente.
create or replace function public.protect_profile_cosmetics()
returns trigger language plpgsql as $$
begin
  if new.cosmetics is distinct from old.cosmetics
     and coalesce(current_setting('insight.cosmetics_writer', true), '') <> 'on' then
    new.cosmetics := old.cosmetics;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_cosmetics on public.profiles;
create trigger profiles_protect_cosmetics
  before update on public.profiles
  for each row execute function public.protect_profile_cosmetics();

-- ---------- Direito de uso ----------
create or replace function public.nitro_can_use(p_profile uuid, p_item text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  it public.nitro_items;
  lvl integer;
begin
  select * into it from public.nitro_items where id = p_item and is_active;
  if not found then return false; end if;

  if exists (select 1 from public.nitro_unlocks where profile_id = p_profile and item_id = p_item) then
    return true;
  end if;

  if it.requirement = 'level' then
    select coalesce(contributor_level, 0) into lvl from public.profiles where id = p_profile;
    return lvl >= it.min_level;
  end if;

  if it.requirement = 'nitro' then
    return exists (
      select 1 from public.nitro_subscriptions
      where profile_id = p_profile
        and status in ('trialing', 'active')
        and current_period_end > now()
    );
  end if;

  return false; -- 'event' só via nitro_unlocks
end $$;

-- ---------- Snapshot ----------
create or replace function public.rebuild_profile_cosmetics(p_profile uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  pc  public.profile_cosmetics;
  lvl integer;
  sub_until timestamptz;
  snap jsonb;
begin
  select * into pc from public.profile_cosmetics where profile_id = p_profile;
  select coalesce(contributor_level, 0) into lvl from public.profiles where id = p_profile;
  select current_period_end into sub_until from public.nitro_subscriptions
    where profile_id = p_profile and status in ('trialing', 'active');

  snap := jsonb_strip_nulls(jsonb_build_object(
    'v', 1,
    'title', (select jsonb_build_object('id', i.id, 'config', i.config, 'req', i.requirement)
              from public.nitro_items i where i.id = pc.title_style_id),
    'tag',   (select jsonb_build_object('id', i.id, 'name', i.name, 'config', i.config, 'req', i.requirement)
              from public.nitro_items i where i.id = pc.tag_id),
    'frame', (select jsonb_build_object('id', i.id, 'config', i.config, 'req', i.requirement,
                                        'asset', i.asset_key, 'static', i.static_asset_key)
              from public.nitro_items i where i.id = pc.frame_id and pc.frame_enabled),
    'intro', (select jsonb_build_object('id', i.id, 'req', i.requirement)
              from public.nitro_items i where i.id = pc.intro_id and pc.intro_enabled),
    'frameAnimated', coalesce(pc.frame_animated, true),
    'levelAnimation', case when lvl >= 4 then coalesce(pc.level_animation_enabled, true) end,
    'nitroUntil', sub_until
  ));

  perform set_config('insight.cosmetics_writer', 'on', true);
  update public.profiles set cosmetics = snap where id = p_profile;
  perform set_config('insight.cosmetics_writer', 'off', true);
end $$;

-- ---------- RPC de equipar / configurar ----------
-- Parâmetros nulos = "não alterar". Para desequipar um slot, passe '' (string vazia).
create or replace function public.set_profile_cosmetics(
  p_title_style_id text default null,
  p_tag_id         text default null,
  p_frame_id       text default null,
  p_intro_id       text default null,
  p_frame_enabled  boolean default null,
  p_frame_animated boolean default null,
  p_intro_enabled  boolean default null,
  p_level_animation_enabled boolean default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_profile_id();
  slot record;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  -- Durante o Preview: só testadores (remover na Fase 5)
  if not exists (select 1 from public.nitro_testers where profile_id = me) then
    raise exception 'nitro_preview_only';
  end if;

  -- Valida tipo e direito de uso de cada slot informado
  for slot in
    select * from (values
      ('title_style'::nitro_item_kind, p_title_style_id),
      ('tag'::nitro_item_kind,         p_tag_id),
      ('frame'::nitro_item_kind,       p_frame_id),
      ('intro'::nitro_item_kind,       p_intro_id)
    ) as s(kind, item_id)
    where item_id is not null and item_id <> ''
  loop
    if not exists (select 1 from public.nitro_items where id = slot.item_id and kind = slot.kind) then
      raise exception 'invalid_item %', slot.item_id;
    end if;
    if not public.nitro_can_use(me, slot.item_id) then
      raise exception 'locked_item %', slot.item_id;
    end if;
  end loop;

  insert into public.profile_cosmetics (profile_id) values (me)
  on conflict (profile_id) do nothing;

  update public.profile_cosmetics set
    title_style_id = case when p_title_style_id is null then title_style_id else nullif(p_title_style_id, '') end,
    tag_id         = case when p_tag_id         is null then tag_id         else nullif(p_tag_id, '') end,
    frame_id       = case when p_frame_id       is null then frame_id       else nullif(p_frame_id, '') end,
    intro_id       = case when p_intro_id       is null then intro_id       else nullif(p_intro_id, '') end,
    frame_enabled  = coalesce(p_frame_enabled,  frame_enabled),
    frame_animated = coalesce(p_frame_animated, frame_animated),
    intro_enabled  = coalesce(p_intro_enabled,  intro_enabled),
    level_animation_enabled = coalesce(p_level_animation_enabled, level_animation_enabled),
    updated_at = now()
  where profile_id = me;

  perform public.rebuild_profile_cosmetics(me);
  return (select cosmetics from public.profiles where id = me);
end $$;

grant execute on function public.set_profile_cosmetics(text, text, text, text, boolean, boolean, boolean, boolean)
  to authenticated;

-- ---------- Expiração ----------
-- Remove itens 'nitro' de quem perdeu a assinatura (rodar diariamente via pg_cron).
-- A UI também esconde itens 'nitro' quando nitroUntil < agora, então não há janela visível.
create or replace function public.nitro_expire_cosmetics()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select pc.profile_id from public.profile_cosmetics pc
    where not exists (
      select 1 from public.nitro_subscriptions s
      where s.profile_id = pc.profile_id and s.status in ('trialing', 'active')
        and s.current_period_end > now()
    )
  loop
    update public.profile_cosmetics pc set
      title_style_id = case when public.nitro_can_use(r.profile_id, title_style_id) then title_style_id end,
      tag_id         = case when public.nitro_can_use(r.profile_id, tag_id)         then tag_id end,
      frame_id       = case when public.nitro_can_use(r.profile_id, frame_id)       then frame_id end,
      intro_id       = case when public.nitro_can_use(r.profile_id, intro_id)       then intro_id end
    where pc.profile_id = r.profile_id;
    perform public.rebuild_profile_cosmetics(r.profile_id);
  end loop;
end $$;
-- select cron.schedule('nitro-expire', '17 4 * * *', 'select public.nitro_expire_cosmetics()');

-- ---------- Realtime ----------
-- profiles já deve estar na publicação; caso não esteja:
-- alter publication supabase_realtime add table public.profiles;
```

**Seed do catálogo:** um arquivo `supabase/seed/nitro_catalog.sql` com `insert ... on conflict (id) do update` para as 9 coleções e os 48 itens das seções 2.2–2.7 (10 títulos + 10 tags + 10 molduras + 6 molduras de patente + 10 aberturas + 2 aberturas de patente). O mesmo conteúdo vive em `src/lib/nitro/catalog.ts`, que é a origem; um script (`npm run nitro:seed-sql`) gera o SQL a partir dele, evitando divergência.

### 3.3 Tipos TypeScript

`src/types/database.ts` (acréscimos)

```ts
export type NitroItemKind = 'title_style' | 'tag' | 'frame' | 'intro';
export type NitroRequirement = 'nitro' | 'level' | 'event';
export type NitroRarity = 'comum' | 'rara' | 'épica' | 'lendária';
export type NitroCollectionId =
  | 'natal' | 'infernal' | 'imperial' | 'celestial'
  | 'anime' | 'princess' | 'cyber' | 'cosmico' | 'patentes';

export interface NitroItemConfig {
  cssClass?: string;          // classe em effects/*.css
  fallbackColor?: string;     // títulos: cor sólida sem animação
  colors?: string[];          // paradas de gradiente
  icon?: string;              // nome do ícone lucide (tags/títulos)
  technique?: 'css' | 'svg' | 'r2';
  durationMs?: number;        // aberturas (≤ 1200)
}

export interface NitroItem {
  id: string;
  kind: NitroItemKind;
  collection_id: NitroCollectionId;
  name: string;
  description?: string | null;
  rarity: NitroRarity;
  requirement: NitroRequirement;
  min_level?: number | null;
  config: NitroItemConfig;
  asset_key?: string | null;
  static_asset_key?: string | null;
  is_active: boolean;
  sort: number;
}

export interface NitroSubscription {
  profile_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  current_period_end: string;
  provider: 'manual' | 'mercadopago';
}

export interface ProfileCosmeticsSettings {
  profile_id: string;
  title_style_id: string | null;
  tag_id: string | null;
  frame_id: string | null;
  intro_id: string | null;
  frame_enabled: boolean;
  frame_animated: boolean;
  intro_enabled: boolean;
  level_animation_enabled: boolean;
}

/** Snapshot em profiles.cosmetics — o que a UI lê em todo lugar. */
interface CosmeticRef {
  id: string;
  req: NitroRequirement;
  config?: NitroItemConfig;
}

export interface ProfileCosmeticsSnapshot {
  v: 1;
  title?: CosmeticRef;
  tag?: CosmeticRef & { name: string };
  frame?: CosmeticRef & { asset?: string; static?: string };
  intro?: CosmeticRef;
  frameAnimated: boolean;
  /** Presente só para níveis 4 e 5. */
  levelAnimation?: boolean;
  /** Fim do período pago; itens 'nitro' somem da UI depois disso. */
  nitroUntil?: string;
}

// Em Profile:
//   cosmetics?: ProfileCosmeticsSnapshot | null;
```

### 3.4 Regras de resolução (cliente)

`src/lib/nitro/entitlements.ts` decide **o que renderizar** a partir do snapshot, sem nenhuma consulta:

```ts
export function resolveFrame(profile: Profile): ResolvedFrame | null {
  if (!isNitroEnabled()) return null;                  // gate de produção
  const c = profile.cosmetics;
  const level = profile.contributor_level ?? 0;

  // 1. Moldura equipada (se ainda válida)
  if (c?.frame && isStillEntitled(c.frame, c)) {
    return { id: c.frame.id, animated: c.frameAnimated, ...c.frame };
  }
  // 2. Sem moldura equipada → nenhuma (a de patente é escolha explícita na galeria)
  return null;
}

function isStillEntitled(ref: CosmeticRef, c: ProfileCosmeticsSnapshot) {
  if (ref.req !== 'nitro') return true;               // patente/evento não expiram
  return Boolean(c.nitroUntil && new Date(c.nitroUntil) > new Date());
}
```

Uma animação só roda se **todas** forem verdadeiras:

1. O dono deixou ligada (`frameAnimated`, `intro_enabled`, `levelAnimation`).
2. O visitante não desligou (preferência local `playOthersAnimations`, padrão `true`).
3. Não há `prefers-reduced-motion: reduce` nem `data-reduce-motion="true"` (preferência já existente em `/config`).
4. O tamanho do avatar é ≥ `md` ou o item está em foco/hover ([§4.5](#45-propagação-global)).

### 3.5 Assets na Cloudflare R2

- **Estrutura de chaves**, versionada e imutável:
  `nitro/v1/frames/<id>/anim.webp`, `nitro/v1/frames/<id>/static.webp`, `nitro/v1/intros/<id>/particles.webp`
- **Upload:** script de staff (`scripts/nitro-upload-assets.ts`) com as credenciais R2 já usadas por `/api/upload/r2`, enviando `Cache-Control: public, max-age=31536000, immutable`. Não reutilizar o endpoint de upload de usuários, que gera chaves aleatórias.
- **Nova versão de arte** = nova pasta (`v2`) + atualização de `asset_key` no catálogo. Nunca sobrescrever uma chave publicada, para não ficar com cache antigo na CDN.
- **URL e fallback:**

```ts
// src/lib/nitro/assets.ts
export function nitroAssetUrl(key?: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (!key || !base) return null;
  return `${base}/${key}`;
}
```

  `<CosmeticAvatar>` sempre renderiza o anel CSS/SVG primeiro. O overlay do R2 é um `<img loading="lazy" decoding="async">` que, em `onError`, se remove. Com R2 indisponível, a moldura continua aparecendo na versão CSS.

- **Orçamento de peso:** overlay animado ≤ 150 KB, pôster ≤ 20 KB, dimensão 256×256 (renderizado em até 128 px no perfil).

---

## 4. Fluxo de UI/UX

### 4.1 Botão ao lado de "Seguir" (`ProfileHeader.tsx`)

A área de ações hoje mostra **Seguir/Seguindo** para visitantes e, no próprio perfil, o botão de editar (ícone `Bolt`). O Nitro acrescenta, quando `isNitroEnabled()`:

| Quem vê | Botão | Ação |
|---|---|---|
| **Dono do perfil** | `Palette` + "Personalizar" (mesmo estilo pílula do Seguir) | Abre `NitroCustomizeSheet` na aba **Moldura** ("Editar moldura") |
| **Dono do perfil**, hover no avatar | Selo com lápis "Editar moldura" no canto do avatar | Mesmo sheet, aba Moldura |
| **Visitante** | Chip discreto abaixo do nome: "Moldura *Halo Aurora* · Celestial" (só se houver item equipado) | Abre `/nitro/celestial` com o item em destaque |

O chip do visitante é a principal via de descoberta: quem gosta de uma moldura chega à galeria em um clique.

### 4.2 Editor rápido (`NitroCustomizeSheet`)

Bottom sheet no mobile e painel lateral (420 px) no desktop.

```
┌────────────────────────────────────────────┐
│  Personalizar perfil                     ✕ │
│  ┌──────────────────────────────────────┐  │
│  │      [avatar com moldura ao vivo]    │  │  ← preview com o avatar e nome reais
│  │      Nome com estilo · @user [TAG]   │  │
│  └──────────────────────────────────────┘  │
│  [Moldura] [Título] [Tag] [Abertura]       │  ← abas
│  Coleção: (Todas) Natal Infernal ...       │  ← chips de filtro
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │ ◎  │ │ ◎  │ │ 🔒 │ │ ◎  │  ...          │  ← grade; bloqueado mostra o requisito
│  └────┘ └────┘ └────┘ └────┘               │
│  ☑ Animar moldura   ☐ Sem moldura          │
│                 [Cancelar] [Salvar]        │
└────────────────────────────────────────────┘
```

- Clicar num item **só altera o preview**. Salvar chama `POST /api/nitro/equip`, que chama a RPC `set_profile_cosmetics`.
- Itens bloqueados ficam visíveis e podem ser pré-visualizados, com o requisito no rodapé do card ("Nitro", "Nível 4 · Imperador", "Evento"). Salvar um item bloqueado abre o CTA correspondente (assinar ou `/apoie`).
- A aba **Abertura** tem botão "▶ Testar" que toca a animação sobre o preview.
- A aba **Moldura** começa com a seção "Suas patentes" (molduras de nível desbloqueadas) e depois as coleções Nitro.

### 4.3 Galeria `/nitro`

1. **Hero:** nome, preço mensal, status da assinatura do usuário e preview com o avatar dele.
2. **Coleções:** carrossel horizontal de cards (mesmo padrão do carrossel de respostas), cada um com a paleta da coleção e contagem de itens.
3. **Categorias:** abas Títulos · Tags · Molduras · Aberturas, com filtro por coleção e por "Disponíveis para mim".
4. **Card do item:** preview ao vivo, nome, coleção, raridade, requisito e botão **Equipar** / **Equipado ✓** / **Desbloquear**.
5. **Painel de preview** fixo à direita no desktop: mostra como o perfil fica com a combinação escolhida.

`/nitro/[collection]` reaproveita a mesma página com o filtro de coleção aplicado e um cabeçalho temático.

### 4.4 Aba de configurações (`/config` → "Perfil & Nitro")

Nova aba no `ConfigTabId` (`'appearance' | 'account' | 'notifications' | 'nitro' | 'staff'`), visível só com `isNitroEnabled()`. É a central de controle.

**Bloco 1 — Assinatura**
- Status (Ativa até 19/12 · Teste · Inativa) e botão Gerenciar/Assinar.

**Bloco 2 — Itens equipados**
- Quatro linhas (Título, Tag, Moldura, Abertura), cada uma com miniatura, nome, botão **Trocar** (abre o sheet na aba certa) e **Remover**.

**Bloco 3 — Animações do meu perfil** (gravadas no Supabase, valem para todos os visitantes)

| Toggle | Coluna | Efeito quando desligado |
|---|---|---|
| Exibir moldura | `frame_enabled` | Remove a moldura; avatar volta ao padrão |
| Animar moldura | `frame_animated` | Moldura fica estática (pôster/CSS parado) |
| Animação de abertura | `intro_enabled` | Nenhuma abertura do Nitro toca no meu perfil |
| Animação de patente | `level_animation_enabled` | Moldura de patente 4/5 fica estática e a abertura de patente não toca. **Só aparece para níveis 4 e 5**; para os demais, mostra "Disponível a partir do nível 4 · Imperador" desabilitado |

**Bloco 4 — Animações de outros perfis** (preferência local, junto de `insight-preferences`)
- **Reproduzir aberturas ao visitar perfis** (padrão: ligado)
- **Animar molduras em listas e no feed** (padrão: ligado)
- Nota: "Reduzir movimento", na aba Aparência, desliga tudo isso automaticamente.

Toda alteração é otimista: o toggle muda na hora e, se a RPC falhar, volta ao estado anterior com aviso.

### 4.5 Propagação global

Um único componente, `<UserIdentity>`, substitui o par avatar + nome espalhado pelo app:

```tsx
<UserIdentity
  profile={profile}          // precisa de: avatar_url, display_name, username, contributor_level, cosmetics
  size="xs" | "sm" | "md" | "lg"
  show={{ name: true, handle: true, tag: true, tier: true }}
  href                       // link para /u/[username] (padrão: sim)
/>
```

Ele compõe `CosmeticAvatar`, `CosmeticName`, `CosmeticTag` e o `ContributorLevelPill` existente. **Política de animação por tamanho**, para não pesar no feed:

| Tamanho | Onde | Moldura | Título |
|---|---|---|---|
| `lg` (112–128 px) | Cabeçalho do perfil | Animada (se permitido) | Animado |
| `md` (40 px) | Card de post, Explore | Estática; anima no hover ou quando o card está em foco | Animado |
| `sm` (28–32 px) | Respostas, notificações, carrosséis | Estática; anima no hover | Estático (gradiente parado) |
| `xs` (≤ 24 px) | Sidebar, menções, listas densas | Só o anel de cor, sem ornamentos | Cor de fallback |

Animações fora da tela pausam com `IntersectionObserver` (`animation-play-state: paused`).

**Pontos de integração**

| Local | Arquivo | Mudança |
|---|---|---|
| Cabeçalho do perfil | `src/components/feed/ProfileHeader.tsx` | `UserIdentity size="lg"` + botão Personalizar + `<ProfileIntro>` |
| Página do perfil | `src/app/u/[username]/page.tsx` | Monta `<ProfileIntro>` na primeira renderização |
| Cabeçalho do post | `src/components/feed/PostCard.tsx` | Avatar/nome do autor → `UserIdentity size="md"` |
| Respostas (árvore) | `src/components/replies/ReplyThread.tsx` | `UserIdentity size="sm"` (requer perfil do autor, ver abaixo) |
| Carrossel de respostas | `src/components/replies/ReplyCarousel.tsx` | `UserIdentity size="sm"` |
| Composer de resposta | `src/components/replies/ReplyComposer.tsx` | Avatar do usuário logado com moldura |
| Notificações | `src/app/notificacoes/page.tsx` | Ator → `UserIdentity size="sm"` (o join `actor` já existe; incluir `cosmetics, contributor_level`) |
| Explore / membros | `src/app/page.tsx` (carrossel e aba Membros) | `UserIdentity size="md"` |
| Barra lateral | `src/components/layout/LeftSidebar.tsx` | Usuário logado `size="xs"` |
| Cartão de compartilhamento | `src/components/feed/SharePostModal.tsx` | Moldura estática no card exportado |

**Respostas precisam do perfil atual.** Hoje `replies` guarda `author_name` e `avatar_url` copiados no momento da criação. Para mostrar cosméticos (e refletir troca de avatar), a página `/post/[id]` deve buscar os perfis dos autores numa consulta só:

```ts
const ids = [...new Set(replies.map((r) => r.profile_id).filter(Boolean))];
const { data } = await supabase
  .from('profiles')
  .select('id, username, display_name, full_name, avatar_url, contributor_level, cosmetics')
  .in('id', ids);
```

e passar um `profilesById` ao `ReplyThread`. Os campos copiados continuam como fallback para respostas de perfis excluídos.

**Sincronização reativa.** `useCosmetics()` assina o Realtime em `profiles` filtrando pelo `id` do usuário logado. Ao salvar em qualquer aba ou dispositivo, o snapshot novo chega e atualiza o próprio avatar na sidebar, composer e perfil sem recarregar. Para perfis de terceiros, o snapshot vem junto com os dados já carregados por cada tela; não há assinatura por usuário exibido.

### 4.6 Animação de abertura (`<ProfileIntro>`)

1. Monta no `u/[username]` depois que o perfil carrega.
2. Escolhe a animação: patente (níveis 4/5, `levelAnimation !== false`) **ou** a do Nitro (`intro` válida); senão, não faz nada.
3. Aborta se: Nitro desligado, visitante desligou aberturas, `prefers-reduced-motion`/`data-reduce-motion`, ou `sessionStorage['nitro-intro-<profileId>']` existe.
4. Renderiza a camada fixa (`pointer-events: none` exceto para o clique de pular), grava a chave na sessão e se desmonta no `animationend` ou após `durationMs + 200 ms`.
5. O dono vê a própria abertura na primeira visita da sessão, para conferir o efeito; o botão "Testar" do editor reproduz de novo quando quiser.

### 4.7 Acessibilidade

- Toda animação respeita `prefers-reduced-motion` e a preferência "Reduzir movimento" já existente.
- Nenhuma animação pisca mais que 3 vezes por segundo (o *glitch* do Cromo Cyberpunk e o *flash* das Linhas de Ação ficam abaixo desse limite).
- Molduras são decorativas (`aria-hidden`); o `alt` do avatar continua sendo o nome.
- Títulos com gradiente mantêm contraste ≥ 4.5:1 na cor de fallback em todos os temas (`light`, `dark`, `night`, `oled`).

---

## 5. Plano de entrega

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0 — Base** | `flags.ts`, migração SQL num Supabase Branch, variáveis de Preview na Vercel | `/nitro` responde 404 num deploy de produção e 200 num Preview |
| **1 — Renderizadores** | `CosmeticAvatar`, `CosmeticName`, `CosmeticTag`, `effects/*.css`, `catalog.ts` com os 48 itens (versão CSS/SVG) | Página interna de QA renderiza todos os itens nos 4 tamanhos, com e sem animação |
| **2 — Galeria e edição** | `/nitro`, `NitroCustomizeSheet`, botão no `ProfileHeader`, aba "Perfil & Nitro", RPC de equipar | Testador equipa, troca e remove itens; toggles persistem e sincronizam entre abas |
| **3 — Assets R2** | Overlays WebP das molduras/aberturas marcadas como `r2`, script de upload | Com R2 bloqueado no DevTools, as molduras continuam aparecendo (fallback CSS) |
| **4 — Propagação** | `UserIdentity` em todos os pontos da tabela 4.5; perfis dos autores nas respostas | Moldura e tag visíveis em feed, post, respostas, notificações, Explore e sidebar; Lighthouse do feed sem regressão > 5 pontos |
| **5 — Lançamento** | Cobrança recorrente (Mercado Pago, mesmo provedor do Pix atual), remoção da allowlist `nitro_testers`, remoção da checagem `VERCEL_ENV` | PR de lançamento revisado; flag definida no target Production |

**Assinatura durante o Preview:** sem cobrança. A staff concede acesso inserindo linhas em `nitro_subscriptions` com `provider = 'manual'` (e em `nitro_testers`), e pode testar expiração ajustando `current_period_end`.

### Checklist de QA (Preview)

- [ ] Deploy de produção: `/nitro`, `/nitro/infernal` e `/api/nitro/equip` retornam 404; nenhum botão/aba/chip do Nitro aparece.
- [ ] Deploy de produção com dados de Nitro no banco: avatares e nomes aparecem sem moldura/título.
- [ ] Usuário fora de `nitro_testers` recebe `nitro_preview_only` ao tentar equipar.
- [ ] Usuário sem assinatura não consegue equipar item `nitro` mesmo chamando a RPC diretamente.
- [ ] `update profiles set cosmetics = ...` feito pelo próprio usuário é ignorado pelo trigger.
- [ ] Assinatura expirada: itens `nitro` somem da UI imediatamente e do banco após o job diário; molduras de patente permanecem.
- [ ] Nível 3 não vê o toggle de animação de patente habilitado; nível 4 vê e ele funciona.
- [ ] "Reduzir movimento" ligado: nenhuma moldura anima, nenhuma abertura toca.
- [ ] Abertura toca uma vez por sessão por perfil e pode ser pulada com clique ou tecla.
- [ ] Trocar a moldura numa aba atualiza a sidebar em outra aba aberta (Realtime).
