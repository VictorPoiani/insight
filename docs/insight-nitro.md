# Insight Nitro — Especificação v2

> **Status:** v2 em implementação · **Acesso:** beta fechada em produção (vitrine para todos, uso só admin) · **Mobile-first**
> **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Supabase · Cloudflare R2
>
> A v1 (beta fechada só para admin, hoje em produção) está descrita no histórico do git deste arquivo.
> Esta v2 **substitui** aquele modelo. O que já existe no código é reaproveitado; o que muda está marcado com **Δ**.

> **Decisão de 20/11/2026 — modelo de acesso enquanto não há lançamento:**
> - **Todos** veem que o Nitro existe: item "Insight Nitro" com cadeado na barra lateral (desktop) e no menu do topo (celular), e a página `/nitro` mostra "Em breve".
> - **Ninguém além do admin** acessa a galeria, os detalhes ou aplica itens; cosméticos só aparecem para quem tem acesso.
> - O gate de **Preview** da §1 fica como opção para quando houver testadores externos; não está ativo.
>
> **Entregue em 20/11 (4ª rodada) — aberturas em motion design 2D:** as 7 cenas foram refeitas sem linhas atravessando a tela: **Monstro à Espreita** (fumaça volumétrica, olhos, aproximação de câmera e clarão), **Garra de Onça** (olhos na mata, três garras crescentes com halo, explosão de folhas), **Tempestade** (nuvens rolando, relâmpagos que acendem as nuvens por dentro, céu abrindo), **Tsunami Ukiyo-e** (gradientes e espuma suave), **Portal Infernal** (brasas em espiral, núcleo e anel de fogo abrindo), **Corte de Anime** (painéis diagonais, estouro com retícula, sol e carimbo 見参) e **Vórtice Cósmico** (nebulosa em espiral e clarão). Texturas estáticas em `public/nitro/intro` (≈25–125 KB), geradas por `scripts/nitro-render/textures.mjs`. Desempenho: só transform/opacity, sem shader em tela cheia nem máscara/filtro animados. Motor genérico: orbes de bokeh no lugar de emojis.
>
> **Entregue em 20/11 (3ª rodada) — molduras com arte procedural:** 13 efeitos em shader (`src/lib/nitro/fxShader.ts`): fogo, aurora, plasma elétrico, água, sombras com olhos, fogo espiritual, nebulosa, magma, gelo, ouro com louros, néon, sakura e floresta. **Perfil/prévia:** o shader roda ao vivo em WebGL2 (`NitroFxCanvas`, 30 fps, até 384 px, pausa fora da tela). **Listas:** WebP leve de 128 px (≈110–210 KB, só carrega quando anima) e quadro parado de 384 px (≈25–60 KB) em `public/nitro/frames/`. Para regerar: `node scripts/nitro-render/render.mjs <pasta> [efeitos] 60 1024` e `python3 scripts/nitro-render/assemble.py <pasta> public/nitro/frames`. Ornamentos SVG (gorro, orelhas, chifres, nuvem, auréola) refeitos com volume, luz e sombra.
>
> **Entregue em 20/11 (2ª rodada):** motor de **cenas** para aberturas (`components/nitro/intro/`) com **Monstro à Espreita**, **Garra de Onça**, **Tempestade** e **Tsunami Ukiyo-e**; Portal Infernal, Corte de Anime e Salto Hiperespacial refeitos como cenas; as demais aberturas ganharam 3 planos de profundidade, vinheta e brilho. Molduras novas com arte em camadas (`components/nitro/frameArt.tsx`): **Gorro do Noel**, **Floresta Viva**, **Onça-Pintada**, **Raposa Espiritual**, **Olhos na Escuridão**, **Onda de Kanagawa** e **Nuvem de Tempestade**; Coroa de Chamas ganhou chamas atrás do avatar e Halo Aurora uma auréola. Novas coleções: Selva & Natureza, Sombras & Monstros, Oceano.
>
> **Entregue em 20/11 (3ª rodada):** coleção **Bichinhos** — molduras ilustradas em estilo adesivo (`components/nitro/critters.ts`, SVG com camada atrás e na frente da foto, animação só com transform/opacity): **Gatinho de Fita**, **Coelhinho Algodão**, **Raposa do Santuário**, **Soneca do Shiba**, **Abraço Fantasma**, **Ursinho do Mel** e **Sapo Rei**; **Nuvem de Tempestade** redesenhada no mesmo estilo. **Raposa Espiritual** removida. **Anel de Saturno** com a lua orbitando em volta e passando por trás da foto (`components/nitro/saturn.tsx`). **Coroa de Chamas** com shader novo (línguas finas e recortadas, mais altas no topo). As 7 aberturas restantes viraram cenas: **Nevasca**, **Presente Aberto**, **Decreto Imperial**, **Chuva de Estrelas**, **Eclipse**, **Conto de Fadas** e **Boot Glitch**.
>
> **Já entregue da v2:** asterisco e logo unificados (`components/brand/`), **Rainbow** com toggle (§3.3), molduras animando "na tela" com orçamento de 4 em vez de hover, remoção de `filter` animado, atalho "Editar moldura" visível no toque, item do Nitro no menu mobile.

---

## Sumário

0. [O que já existe e o que muda](#0-o-que-já-existe-e-o-que-muda)
1. [Gate de Preview, estrutura de pastas e UX mobile](#1-gate-de-preview-estrutura-de-pastas-e-ux-mobile)
2. [Catálogo inicial](#2-catálogo-inicial)
3. [Regras de liberação, Rainbow e toggles](#3-regras-de-liberação-rainbow-e-toggles)
4. [Supabase, tipos e pontos de integração](#4-supabase-tipos-e-pontos-de-integração)
5. [Plano de entrega e QA](#5-plano-de-entrega-e-qa)

---

## 0. O que já existe e o que muda

| Peça | Hoje (v1, em produção) | v2 |
|---|---|---|
| Acesso | `role = 'admin'` em produção | **Δ** Preview + flag; produção não renderiza nada do Nitro |
| Catálogo | 48 itens em `src/lib/nitro/catalog.ts`, só admin vê | **Δ** catálogo para **todos**; itens Nitro em prévia bloqueada |
| Liberação | admin equipa qualquer item | **Δ** padrão · nível de contribuinte · Nitro · evento |
| Alcunha | `profiles.nickname` + `nickname_color` (paleta fixa) | **Δ** alcunha ganha estilos (padrão, nível, Nitro) |
| Rainbow | — | **Δ** logo e asteriscos de carregamento em rainbow para assinantes |
| Motor visual | CSS/SVG (`nitro.css`), anima `filter`, hover nas listas | **Δ** só `transform`/`opacity`; "em tela" em vez de hover; WAAPI para aberturas |
| Banco | `profiles.cosmetics` + `set_my_cosmetics` (exige admin) | **Δ** catálogo e assinatura no banco; RPC valida direito de uso |
| Segurança | RLS revisada em 20/11/2026 (migrações `2026112001*`–`2026112003*`) | mantida; nada novo é gravável direto pelo cliente |

---

## 1. Gate de Preview, estrutura de pastas e UX mobile

### 1.1 Regra de ativação

```ts
// src/lib/nitro/flags.ts
export function isNitroEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_INSIGHT_NITRO !== 'true') return false;
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (env === 'preview') return true;
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_NITRO_DEV_OVERRIDE === 'true';
}
```

- A checagem de ambiente é proposital: a flag definida por engano em *Production* **não** liga o Nitro.
- **Vercel → Settings → Environment Variables:** `NEXT_PUBLIC_ENABLE_INSIGHT_NITRO=true` **somente** no target *Preview*. `NEXT_PUBLIC_VERCEL_ENV` é exposta automaticamente.
- Δ O interruptor atual `NEXT_PUBLIC_INSIGHT_NITRO=off` continua valendo como desligamento de emergência em qualquer ambiente.

### 1.2 Camadas de bloqueio (produção)

| Camada | Implementação | Em produção |
|---|---|---|
| Rota | `src/app/nitro/layout.tsx` (Server Component): `if (!isNitroEnabled()) notFound()` | `/nitro` → 404 |
| UI | `NitroProvider.enabled = isNitroEnabled()`; todo botão, aba, chip, CTA e banner do Nitro verifica `enabled` | nada renderiza (nem o item com cadeado da barra lateral) |
| Renderização | `CosmeticAvatar`, `CosmeticName`, `CosmeticTag`, `ProfileIntro`, Rainbow retornam o visual padrão se `!enabled` | avatares e nomes normais, mesmo com dados no banco |
| Dados | RPCs funcionam em qualquer ambiente (o banco não sabe qual é), mas nada lido por produção depende delas | sem efeito visível |

> **Banco compartilhado.** Preview e Production usam o mesmo projeto Supabase. Por isso a camada de **renderização** é obrigatória: o que um testador equipa em Preview fica em `profiles.cosmetics`, e produção precisa ignorar. Alternativa mais isolada: Supabase Branch com as variáveis do Supabase apenas no target Preview.

> **Middleware.** `src/middleare.ts` tem erro de digitação e nunca roda; não é usado como bloqueio.

> **Δ Transição:** ao ativar este gate, o Nitro **some de produção para o admin também**. O teste passa a acontecer na URL de Preview.

### 1.3 Estrutura de pastas

```
src/
├── app/
│   ├── nitro/
│   │   ├── layout.tsx                 Δ gate no servidor (notFound)
│   │   └── page.tsx                   galeria (reaproveitada; layout mobile novo)
│   ├── api/nitro/
│   │   └── checkout/route.ts          Fase 5 (Mercado Pago preapproval)
│   └── config/page.tsx                aba "Perfil & Nitro" (já existe; ganha Rainbow e alcunha)
├── components/
│   ├── brand/
│   │   ├── InsightAsterisk.tsx        Δ asterisco único (logo, spinners, loaders)
│   │   └── InsightLogo.tsx            Δ "Insight*" único
│   ├── ui/AsteriskLoader.tsx          passa a usar InsightAsterisk (substitui 6 cópias)
│   └── nitro/
│       ├── NitroProvider.tsx          Δ enabled + entitlements + toggles + Rainbow
│       ├── Cosmetics.tsx              CosmeticAvatar / CosmeticName / CosmeticNickname / CosmeticTag
│       ├── CustomizeSheet.tsx         Δ central de personalização (bottom sheet / drawer)
│       ├── ItemTile.tsx               Δ tile com estados: livre, equipado, bloqueado-nível, bloqueado-Nitro
│       ├── ProfileIntro.tsx           Δ usa IntroPlayer
│       ├── intro/IntroPlayer.tsx      Δ timeline WAAPI (fases, pular, cancelar)
│       ├── intro/scenes/*.tsx         Δ uma cena por abertura
│       ├── frames/*.tsx               Δ camadas SVG por moldura (fundo, frente, partículas)
│       ├── useInViewAnimation.ts      Δ anima só o que está na tela (orçamento)
│       └── nitro.css                  Δ reescrito: só transform/opacity
└── lib/nitro/
    ├── flags.ts                       Δ isNitroEnabled()
    ├── catalog.ts                     Δ catálogo v2 (fonte única; gera o seed SQL)
    ├── entitlements.ts                Δ canUse(item, viewer) — espelho da regra do banco
    └── assets.ts                      URL R2 + fallback
scripts/
├── nitro-seed.ts                      Δ gera supabase/seed/nitro_items.sql a partir de catalog.ts
└── nitro-upload-assets.ts             Δ envia WebP/PNG para R2 com Cache-Control imutável
```

### 1.4 UX mobile

**Central de personalização (`CustomizeSheet`)**

| | Celular (< 768 px) | Desktop |
|---|---|---|
| Contêiner | bottom sheet em tela cheia (`100dvh`), alça de arrastar, fecha com gesto para baixo | drawer lateral de 440 px |
| Prévia | avatar + nome + alcunha + tag fixos no topo; encolhem para uma barra de 56 px ao rolar | coluna fixa à esquerda do drawer |
| Abas | Moldura · Nome & Alcunha · Tag · Abertura, em controle segmentado com rolagem horizontal | mesmas abas |
| Coleções | chips com rolagem horizontal (`overscroll-x: contain`) | mesma linha |
| Grade | 3 colunas a 360 px (tiles de 96 px, alvo de toque ≥ 44 px); 4 colunas ≥ 480 px | 4 colunas |
| Ações | barra fixa no rodapé "Aplicar" / "Assinar Nitro", com `padding-bottom: env(safe-area-inset-bottom)` | rodapé do drawer |

**Toque, sem depender de hover**

- **Tocar** num item aplica a prévia no avatar do topo, inclusive em itens bloqueados.
- **Pressionar e segurar** (450 ms) ou o botão "ⓘ" abre os detalhes: descrição, coleção, requisito e "Testar" para aberturas.
- Item bloqueado na prévia mostra a faixa "Prévia · requer Insight Nitro" ou "Prévia · libera no nível 3 · Cavaleiro"; o botão "Aplicar" vira o CTA correspondente.
- O atalho "Editar moldura" no avatar fica **sempre visível** em `@media (hover: none)`; no desktop continua aparecendo no hover.
- Listas (feed, respostas, notificações): molduras animam **quando estão na tela**, não no hover (ver orçamento abaixo).

**Sem overflow horizontal**

- Molduras e ornamentos ficam em `position: absolute` dentro de um wrapper com `contain: layout paint` e reserva de espaço (`--nx-bleed`), para não empurrar o layout.
- Camadas de abertura usam `position: fixed; inset: 0; overflow: hidden`.
- Carrosséis usam `overscroll-behavior-x: contain` e `scroll-snap`.

**Performance**

| Regra | Como |
|---|---|
| Só propriedades de composição | animar apenas `transform` e `opacity`; brilhos são camadas pré-desfocadas com `opacity` animada (Δ remove `filter` animado do v1) |
| Orçamento de animação | `useInViewAnimation`: no máximo **4** molduras animando ao mesmo tempo no feed (as mais centrais); as demais ficam estáticas |
| Fora da tela | `IntersectionObserver` aplica `animation-play-state: paused` e desmonta partículas |
| Aparelho fraco | `navigator.hardwareConcurrency <= 4`, `deviceMemory <= 4` ou `Save-Data` → "Animar em listas" começa desligado |
| Assets | WebP animado em 2 tamanhos (128 e 256 px), escolhidos pelo tamanho × `devicePixelRatio`; pôster PNG de 1 frame |
| Aberturas | WAAPI (`element.animate`), 60 fps, duração 1,2–1,8 s, pulam com toque/tecla; nunca bloqueiam o scroll depois de 300 ms |
| Movimento reduzido | `prefers-reduced-motion` ou "Reduzir movimento" do Insight → tudo estático, sem aberturas, Rainbow com gradiente parado |

---

## 2. Catálogo inicial

### 2.1 Linguagem visual (padrão "loja Nitro")

Todo item **Nitro** precisa de pelo menos **3 camadas**:

1. **Fundo**, atrás do avatar (aura, chamas, fumaça, folhagem).
2. **Contorno**, o anel com gradiente ou textura.
3. **Frente**, sobrepondo levemente o avatar (chapéu, orelhas, coroa, garras), com **partículas** e uma **varredura de luz** periódica.

Movimento com intenção: antecipação → ação → acomodação (*ease-out* com leve *overshoot*), loops de 4–12 s com variação para não parecer mecânico. Itens **padrão** e de **nível** são deliberadamente mais simples, para o Nitro se destacar.

### 2.2 Coleções

| ID | Coleção | Paleta |
|---|---|---|
| `natal` | Natal | vermelho `#c1121f`, verde `#2d6a4f`, neve `#e0f2fe` |
| `infernal` | Infernal | brasa `#f97316`, magma `#7f1d1d`, carvão `#0c0a09` |
| `imperial` | Imperial | ouro `#d4a72c`, púrpura `#4c1d95` |
| `celestial` | Celestial | aurora `#5eead4` → `#a78bfa`, estelar `#fef9c3` |
| `anime` | Anime | sakura `#f9a8d4`, tinta `#111827` |
| `princess` | Princess | rosé `#fbcfe8`, pérola `#fdf2f8`, cristal `#c4b5fd` |
| `selva` | **Selva/Natureza** | folha `#15803d`, musgo `#3f6212`, âmbar `#f59e0b` |
| `sombras` | **Sombras/Monstros** | breu `#020617`, névoa `#334155`, olho `#a3e635` |
| `cyber` | Cyber | néon `#22d3ee`, magenta `#e11d48` |
| `cosmico` | Cósmico | nebulosa `#6d28d9` → `#ec4899` |
| `oceano` | **Oceano** | abismo `#082f49`, onda `#0ea5e9`, espuma `#f0f9ff` |
| `patentes` | Patentes | cores de `CONTRIBUTOR_TIERS` (conquistadas por nível) |

### 2.3 Estilos de Título & Alcunha — Nitro (10)

Um estilo pode ser aplicado ao **nome de exibição** (título), à **alcunha**, ou aos dois (slots separados). Camadas: gradiente base + varredura de luz + glifo/partícula + brilho (camada de sombra com `opacity` animada).

| # | ID | Nome | Coleção | Efeito |
|---|---|---|---|---|
| 1 | `style-gold-brushed` | **Ouro Escovado** | Imperial | ouro em 4 tons com textura escovada (gradiente repetido fino); faixa de brilho a cada 4 s; centelha no último caractere |
| 2 | `style-celestial-aurora` | **Celestial Aurora** | Celestial | aurora ondulando (8 s) + 3 estrelinhas cintilando acima das letras |
| 3 | `style-rainbow-prism` | **Rainbow Prismático** | Cósmico | espectro completo deslizando + refração branca diagonal; respeita o toggle Rainbow |
| 4 | `style-infernal-embers` | **Brasas Infernais** | Infernal | laranja/vermelho com cintilação por opacidade + brasas subindo das letras |
| 5 | `style-christmas-frost` | **Gelo Natalino** | Natal | azul-gelo com cristais nas bordas das letras e um floco que cai do nome |
| 6 | `style-imperial-crown` | **Coroa Imperial** | Imperial | ouro sobre púrpura; coroa animada (pequeno "pouso" com *overshoot*) antes do nome |
| 7 | `style-sakura` | **Sakura Anime** | Anime | rosa → branco; pétalas cruzam o nome a cada 10 s |
| 8 | `style-royal-princess` | **Real Princess** | Princess | rosé perolado com brilho iridescente e faíscas `✦` nas pontas |
| 9 | `style-cyber-chrome` | **Cromo Cyberpunk** | Cyber | cromo metálico; glitch RGB de 120 ms (3 fatias com `translateX`) a cada 7 s |
| 10 | `style-cosmic-neon` | **Néon Cósmico** | Cósmico | tubo de néon magenta/ciano: contorno + brilho que "liga" ao entrar na tela e respira |

### 2.4 Tags especiais — Nitro (10)

Pílula de 18 px; ícone `lucide-react`; acabamento com borda em gradiente e brilho que atravessa a tag a cada ~5 s.

| # | ID | Texto | Coleção | Ícone | Acabamento |
|---|---|---|---|---|---|
| 1 | `tag-nitro-founder` | **Fundador Nitro** | Cósmico | `Zap` | gradiente rainbow; **evento** (testadores do Preview) |
| 2 | `tag-honorary-santa` | **Noel Honorário** | Natal | `Gift` | vermelho, borda verde, neve |
| 3 | `tag-infernal-pact` | **Pacto Infernal** | Infernal | `Flame` | carvão com texto brasa pulsante |
| 4 | `tag-royal-blood` | **Sangue Real** | Imperial | `Crown` | púrpura com filete dourado |
| 5 | `tag-star-born` | **Filho das Estrelas** | Celestial | `Star` | azul-noite com estrela cintilante |
| 6 | `tag-senpai` | **Senpai 先輩** | Anime | `Sparkles` | branco com contorno de mangá |
| 7 | `tag-highness` | **Alteza** | Princess | `Gem` | rosé perolado iridescente |
| 8 | `tag-jungle-king` | **Rei da Selva** | Selva | `PawPrint` | verde-musgo com pegada âmbar |
| 9 | `tag-shadow-hunter` | **Caçador de Sombras** | Sombras | `Moon` | breu com contorno que "respira" verde-ácido |
| 10 | `tag-netrunner` | **NETRUNNER** | Cyber | `Cpu` | preto, ciano monoespaçado, borda néon |

### 2.5 Molduras animadas — Nitro (10)

Inclui obrigatoriamente **chapéu**, **natureza** e **animais**. Técnica: **SVG em camadas** (preferido) ou **WebP animado na R2** quando há personagem ou partícula complexa, sempre com anel SVG por baixo como fallback.

| # | ID | Nome | Coleção | Camadas (fundo · contorno · frente) | Movimento |
|---|---|---|---|---|---|
| 1 | `frame-santa-hat` | **Gorro do Noel** 🎩 *chapéu* | Natal | brilho quente · anel com pisca-pisca · **gorro inclinado com pompom** | pompom balança como pêndulo (rotate com amortecimento); luzes piscam em sequência; neve cai pela frente |
| 2 | `frame-flame-crown` | **Coroa de Chamas** | Infernal | chamas atrás do avatar (WebP R2) · anel de magma · brasas na frente | chamas sobem em 2 velocidades (paralaxe); brasas soltas; pulso de calor no anel |
| 3 | `frame-imperial-crown` | **Coroa Imperial** | Imperial | aura púrpura · louro dourado · **coroa** no topo | coroa "pousa" ao entrar na tela; varredura de luz pelas folhas a cada 5 s |
| 4 | `frame-celestial-halo` | **Halo Celestial** | Celestial | aurora girando · anel estelar · **auréola** elíptica acima | aurora gira (14 s); 6 estrelas orbitam em elipse; auréola flutua ±3 px |
| 5 | `frame-sakura-branch` | **Galho de Sakura** | Anime | névoa rosa · anel pétala · **galho florido** no canto superior | galho balança; pétalas caem e giram (8 variações de trajetória) |
| 6 | `frame-enchanted-tiara` | **Tiara Encantada** | Princess | brilho perolado · anel cristal · **tiara** + 2 borboletas | borboletas voam em trajetórias em 8; faíscas nas pedras da tiara |
| 7 | `frame-living-forest` | **Floresta Viva** 🌿 *natureza* | Selva | sombra de folhagem · **cipós** que contornam o anel · folhas e flores | cipós "crescem" ao entrar na tela (traçado SVG); folhas balançam; vaga-lumes piscam |
| 8 | `frame-jaguar` | **Onça-Pintada** 🐆 *animal* | Selva | aura âmbar · anel com rosetas de onça · **orelhas** no topo e **cauda** contornando a base | orelhas mexem a cada ~6 s; cauda balança (rotate em 2 segmentos); olhos brilham no reflexo |
| 9 | `frame-spirit-fox` | **Raposa Espiritual** 🦊 *animal* | Celestial | 3 caudas de luz atrás do avatar · anel lunar · **orelhas de raposa** | caudas ondulam em fase alternada; 3 chamas-fantasma (*kitsune-bi*) orbitam |
| 10 | `frame-lurking-eyes` | **Olhos na Escuridão** | Sombras | fumaça escura girando · anel rachado · **olhos** e **tentáculo** espiando | olhos piscam em posições aleatórias; tentáculo surge e recua a cada ~9 s; névoa respira |

**Itens da v1 fora deste conjunto** (Guirlanda Natalina, Floco de Neve Real, Chifres do Abismo, Laurel Imperial, Halo Aurora, Pétalas de Sakura, Tiara de Cristal, Circuito Néon, Anel de Saturno): vão para a coleção **Arquivo Beta**. Ficam disponíveis apenas para quem já os tinha equipado; não contam entre os 10.

### 2.6 Animações de abertura — Nitro (10)

Δ Todas passam a usar o **`IntroPlayer`**, uma timeline em fases com WAAPI:

1. **Antecipação** (0–20%): escurecer, tremor ou sinal.
2. **Impacto** (20–55%): o evento principal.
3. **Revelação** (55–85%): o perfil aparece.
4. **Acomodação** (85–100%): partículas assentam e a camada some.

Inclui leve *camera shake* aplicado **só à camada da animação**, nunca à página. Duração 1,2–1,8 s. Toque ou tecla pula para a acomodação.

| # | ID | Nome | Coleção | Roteiro |
|---|---|---|---|---|
| 1 | `intro-high-tide` | **Maré Alta** 🌊 *ondas* | Oceano | 3 ondas SVG em paralaxe sobem da base cobrindo a tela → a crista quebra com espuma (partículas) → a água recua para baixo revelando o perfil → gotas escorrem do avatar |
| 2 | `intro-jaguar-claw` | **Garra de Onça** 🐾 | Selva | tela escurece e dois olhos âmbar acendem → **3 arranhões** cortam a tela na diagonal (traçado SVG com brilho) → a tela "rasga" nos cortes (`clip-path` em 4 pedaços que se afastam) → folhas caem |
| 3 | `intro-lurking-monster` | **Monstro à Espreita** 👁 | Sombras | vinheta escura com névoa → pares de olhos piscam nos cantos → os olhos avançam (escala) → uma **mandíbula** de silhueta dá o bote de baixo → a escuridão estilhaça em partículas de sombra |
| 4 | `intro-royal-blizzard` | **Nevasca Real** *(melhoria de "Nevasca")* | Natal | 3 camadas de neve em profundidade → geada avança das bordas (máscara radial) → o gelo **racha** a partir do avatar e cai em cacos |
| 5 | `intro-hell-portal` | **Portal Infernal** *(melhoria)* | Infernal | rachaduras incandescentes se desenham no chão → erupção de magma (WebP R2) → o portal abre em íris a partir do avatar com brasas e distorção de calor pré-renderizada |
| 6 | `intro-imperial-decree` | **Decreto Imperial** *(melhoria)* | Imperial | dois estandartes descem desenrolando (escala Y com sombreado de dobra) → o **selo dourado** carimba no centro (impacto + onda de choque) → estandartes sobem deixando poeira de ouro |
| 7 | `intro-total-eclipse` | **Eclipse Total** *(melhoria de "Eclipse")* | Celestial | a lua cruza o sol → coroa solar se expande → efeito **anel de diamante** (flash pontual) → as estrelas florescem e a luz volta |
| 8 | `intro-anime-cut` | **Corte de Anime** *(melhoria de "Linhas de Ação")* | Anime | linhas de velocidade convergem → **quadro de impacto** invertido (2 quadros preto/branco) → carimbo 見参 → o perfil entra com leve *zoom* |
| 9 | `intro-fairy-tale` | **Conto de Fadas** *(melhoria)* | Princess | varinha desenha uma espiral de brilho (traçado SVG) → silhueta de castelo surge e dissolve → pétalas e faíscas assentam sobre o nome |
| 10 | `intro-hyperspace` | **Salto Hiperespacial** *(melhoria de "Hiperespaço")* | Cósmico | estrelas paradas → esticam em linhas (warp) com aceleração → túnel de luz → *flash* e o perfil "chega" com desaceleração |

"Boot Glitch", "Chuva de Estrelas" e "Presente Aberto" (v1) vão para **Arquivo Beta**.

### 2.7 Itens padrão (liberados para todos)

| Categoria | Itens |
|---|---|
| Moldura | Sem moldura · **Anel Clássico** (cor de destaque do usuário) · **Anel Duplo** · **Pontilhado** (todos estáticos) |
| Título/Alcunha | as **8 cores atuais** da alcunha (paleta de `ProfileHeader`) · **Negrito Limpo** (sem cor) |
| Tag | **Membro** · **Leitor(a)** · **Criador(a)** · **Dev** (pílulas neutras) |
| Abertura | Sem abertura · **Revelação Suave** (fade + leve escala, 600 ms) |

### 2.8 Itens de nível de contribuinte (Patentes)

Cumulativos: o nível N libera tudo dos níveis ≤ N. As cores vêm de `CONTRIBUTOR_TIERS`.

| Nível | Patente | Moldura | Estilo de título/alcunha | Tag | Abertura |
|---|---|---|---|---|---|
| 0 | Observador | `frame-tier-0` anel ardósia (estático) | — | — | — |
| 1 | Recruta | `frame-tier-1` cobre com faíscas (estático) | **Cobre Vivo** | **Recruta** | — |
| 2 | Escudeiro | `frame-tier-2` metal prismático (estático) | **Prisma Metálico** | **Escudeiro** | — |
| 3 | Cavaleiro | `frame-tier-3` ouro com rebites e louro (estático) | **Ouro de Cavaleiro** | **Cavaleiro** | — |
| 4 | Imperador | `frame-tier-4` safira com **grade técnica e pulso** (**animada**) | **Safira** | **Imperador** | **Ascensão Safira** (exclusiva) |
| 5 | Grão-Mestre | `frame-tier-5` **espectro em rotação + partículas** (**animada**) | **Espectro do Grão-Mestre** | **Grão-Mestre** | **Singularidade Prismática** (exclusiva) |

Só os níveis **4 e 5** têm animação própria (moldura animada e abertura). Ambas obedecem ao toggle **Animação de patente**.

---

## 3. Regras de liberação, Rainbow e toggles

### 3.1 Quem pode aplicar o quê

| Origem (`unlock`) | Aplica se… | Na galeria, para quem não tem |
|---|---|---|
| `default` | sempre | — |
| `level` | `profiles.contributor_level >= min_level` | prévia com 🔒 + "Libera no nível N · Patente" e link para `/apoie` |
| `nitro` | assinatura `trialing`/`active` com `current_period_end > now()` | prévia com selo **Nitro** + "Assinar Insight Nitro" |
| `event` | linha em `nitro_unlocks` | prévia com "Item de evento" (sem CTA) |
| `archive` | linha em `nitro_unlocks` (quem já usava na v1) | **não aparece** na galeria |

- **Todo** o catálogo (exceto `archive`) aparece para **todos** os usuários em Preview, inclusive deslogados (que veem a prévia com o avatar padrão).
- **Prévia nunca grava**: tocar num item bloqueado muda só a pré-visualização local.
- A regra vale em dois lugares: `entitlements.ts`, para a UI, e o RPC `set_profile_cosmetics`, para o banco. **O banco é a autoridade.**

### 3.2 Expiração

- Itens `nitro` só renderizam enquanto `cosmetics.nitroUntil > agora`. Ao expirar, a UI cai para o padrão imediatamente.
- Um job diário (`pg_cron`) limpa os slots no banco.
- Itens de nível e de evento não expiram.

### 3.3 Rainbow (benefício Nitro)

**O que muda:** a logo **Insight\*** e **todos os asteriscos de carregamento** ganham degradê prismático animado.

**Pré-requisito: unificar o asterisco.** Hoje o desenho está duplicado em 7 arquivos (`app/loading.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/post/[id]/page.tsx`, `app/u/[username]/page.tsx`, `TopicTabsManager.tsx`, `ui/AsteriskLoader.tsx`) e a logo em 3 componentes (`LeftSidebar`, `AppShell`, `SharePostModal`). Todos passam a usar:

```tsx
<InsightAsterisk size={38} spin />      // spinners e loaders
<InsightLogo size="md" />               // "Insight" + <InsightAsterisk />
```

**Técnica (GPU-friendly):**

- O asterisco vira uma **máscara** (`mask-image` com o SVG).
- Sob a máscara fica um `div` com `conic-gradient` do espectro, que gira por `transform: rotate()`. Animação só de composição, sem repintura.
- A palavra "Insight" usa gradiente com `background-clip: text` em deslocamento lento (12 s).

**Ativação:** o `NitroProvider` define `<html data-nitro-rainbow="on">` quando `isNitroEnabled() && assinaturaAtiva && cosmetics.rainbow !== false`. Os componentes de marca leem esse atributo pelo CSS, sem custo de JavaScript.

**Fora do escopo:** o e-mail da newsletter (`api/newsletter`) e a imagem exportada do `SharePostModal` continuam com a logo padrão, pois são gerados fora da sessão do usuário.

**Movimento reduzido:** gradiente estático (sem rotação).

### 3.4 Toggles

**Do dono do perfil** (gravados no Supabase, valem para quem visita):

| Toggle | Campo | Desligado |
|---|---|---|
| Exibir moldura | `frameEnabled` | remove a moldura (o item continua escolhido) |
| Animar moldura | `frameAnimated` | moldura estática (pôster/SVG parado) |
| Animação de abertura | `introEnabled` | nenhuma abertura Nitro no meu perfil |
| Animação de patente | `levelAnimation` | moldura 4/5 estática e sem abertura de patente (só níveis 4 e 5) |
| Animar títulos e alcunha | `nameAnimated` | gradientes ficam parados |
| **Rainbow** | `rainbow` | logo e asteriscos voltam ao azul padrão (só para mim; não afeta outros) |

**Do visitante** (preferência local, `insight-nitro-prefs`):

| Toggle | Padrão |
|---|---|
| Reproduzir aberturas de outros perfis | ligado |
| Animar molduras em listas | ligado (desligado em aparelho fraco ou `Save-Data`) |

"Reduzir movimento" (aba Aparência) e `prefers-reduced-motion` **vencem todos os toggles**.

---

## 4. Supabase, tipos e pontos de integração

### 4.1 Esquema

Migração nova, aditiva: `supabase/migrations/2026XXXX_insight_nitro_v2.sql`.

```sql
-- Catálogo no banco (espelho de catalog.ts, gerado por scripts/nitro-seed.ts)
create table public.nitro_items (
  id          text primary key,
  kind        text not null check (kind in ('frame','name_style','tag','intro')),
  collection  text not null,
  name        text not null,
  rarity      text not null default 'comum',
  unlock      text not null check (unlock in ('default','level','nitro','event','archive')),
  min_level   int  check (min_level between 0 and 5),
  asset_key   text,             -- R2: nitro/v2/<kind>/<id>/anim.webp
  poster_key  text,             -- R2: nitro/v2/<kind>/<id>/poster.png
  is_active   boolean not null default true,
  sort        int not null default 0,
  check (unlock <> 'level' or min_level is not null)
);

create table public.nitro_subscriptions (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  status             text not null check (status in ('trialing','active','past_due','canceled')),
  current_period_end timestamptz not null,
  provider           text not null default 'manual',   -- 'manual' | 'trial' | 'mercadopago'
  provider_ref       text,
  updated_at         timestamptz not null default now()
);

create table public.nitro_unlocks (
  profile_id uuid references public.profiles(id) on delete cascade,
  item_id    text references public.nitro_items(id) on delete cascade,
  source     text not null default 'event',             -- 'event' | 'archive' | 'grant'
  granted_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);

-- Configuração global (ex.: liberar teste grátis no Preview)
create table public.app_config (key text primary key, value jsonb not null);
insert into public.app_config values ('nitro_trials_enabled', 'false') on conflict do nothing;

-- RLS: leitura do catálogo pública; assinatura e unlocks só o próprio usuário lê;
-- nenhuma escrita direta pelo cliente (só RPCs abaixo e service role).
```

**Funções (`SECURITY DEFINER`, `search_path = public`):**

| Função | Quem chama | O que faz |
|---|---|---|
| `nitro_can_use(profile, item)` | interna | aplica a tabela 3.1 |
| `set_profile_cosmetics(p jsonb)` | logado | **substitui `set_my_cosmetics`**: valida tipo de slot e direito de uso de cada item e grava o snapshot. Exceção: um slot que mantém um item já equipado (ex.: `archive`) é aceito. |
| `start_nitro_trial()` | logado | só se `app_config.nitro_trials_enabled = true`; cria `trialing` por 7 dias, 1 vez por perfil. É o botão "Ativar teste" no Preview. |
| `nitro_expire_cosmetics()` | `pg_cron` diário | limpa slots `nitro` vencidos e reconstrói o snapshot |
| `rebuild_profile_cosmetics(profile)` | interna | grava `profiles.cosmetics` (via `insight.cosmetics_writer`, já protegido por trigger) |

O trigger `profiles_protect_cosmetics` e as regras de RLS de 20/11 continuam como estão.

**Assets na R2**

- Chaves versionadas e imutáveis: `nitro/v2/frames/<id>/anim-128.webp`, `anim-256.webp`, `poster.png`; `nitro/v2/intros/<id>/<camada>.webp`.
- Upload por `scripts/nitro-upload-assets.ts` com `Cache-Control: public, max-age=31536000, immutable`, usando as mesmas credenciais de `/api/upload/r2`. Não usar o endpoint de upload de usuário, que gera nomes aleatórios.
- Arte nova = pasta `v3`; nunca sobrescrever uma chave publicada.
- Orçamento: overlay ≤ 150 KB; pôster ≤ 20 KB.
- **Fallback:** se `NEXT_PUBLIC_R2_PUBLIC_URL` faltar ou a imagem falhar, a camada SVG/CSS da moldura continua visível.

### 4.2 Tipos TypeScript

```ts
export type NitroKind = 'frame' | 'name_style' | 'tag' | 'intro';
export type NitroUnlock = 'default' | 'level' | 'nitro' | 'event' | 'archive';

export interface NitroItemBase {
  id: string;
  kind: NitroKind;
  name: string;
  collection: NitroCollectionId;
  rarity: 'comum' | 'rara' | 'épica' | 'lendária';
  unlock: NitroUnlock;
  minLevel?: 0 | 1 | 2 | 3 | 4 | 5;
  description: string;
}

export interface FrameItem extends NitroItemBase {
  kind: 'frame';
  layers: {
    back?: LayerSpec;          // atrás do avatar
    ring: RingSpec;            // contorno (gradiente/textura)
    front?: LayerSpec;         // chapéu, orelhas, coroa…
    particles?: ParticleSpec;
  };
  asset?: { anim: string; poster: string };  // R2 (opcional)
  animated: boolean;           // false para padrão e níveis 0–3
}

export interface NameStyleItem extends NitroItemBase {
  kind: 'name_style';
  gradient: string[];
  effect: 'shine' | 'flow' | 'ember' | 'frost' | 'glitch' | 'neon' | 'solid';
  fallbackColor: string;
  glyph?: 'crown' | 'sparkle' | 'petal' | 'snow' | 'ember';
}

export interface TagItem extends NitroItemBase {
  kind: 'tag';
  label: string;
  icon: string;                // nome do ícone lucide
  bg: string; fg: string; border: string;
  shimmer?: boolean;
}

export interface IntroItem extends NitroItemBase {
  kind: 'intro';
  scene: IntroSceneId;         // componente em intro/scenes
  durationMs: number;          // 1200–1800
  assets?: string[];           // camadas R2 (opcional)
}

/** profiles.cosmetics (snapshot v2) */
export interface ProfileCosmeticsV2 {
  v: 2;
  frame?: string | null;
  nameStyle?: string | null;
  nicknameStyle?: string | null;
  tag?: string | null;
  intro?: string | null;
  frameEnabled: boolean;
  frameAnimated: boolean;
  introEnabled: boolean;
  levelAnimation: boolean;
  nameAnimated: boolean;
  rainbow: boolean;
  nitroUntil?: string | null;  // fim da assinatura (UI esconde itens 'nitro' depois disso)
  updatedAt: string;
}
```

**Migração do snapshot v1 → v2:** `title` → `nameStyle`; IDs `title-*` → `style-*`; itens fora do catálogo v2 → `nitro_unlocks` com `source = 'archive'` para quem os usava.

### 4.3 Pontos de integração na UI

Um componente composto substitui os pares avatar + nome espalhados pelo app:

```tsx
<UserIdentity profile={p} size="xs" | "sm" | "md" | "lg" show={{ nickname, tag, tier }} />
```

| Local | Arquivo | Mudança |
|---|---|---|
| **Perfil** | `components/feed/ProfileHeader.tsx` | `UserIdentity size="lg"`; **botão "Personalizar" ao lado de "Seguir"** (no próprio perfil, ocupa o lugar do Seguir; em perfis alheios, o chip "Moldura X · Coleção" leva à galeria); atalho "Editar moldura" visível no toque; alcunha via `CosmeticNickname` |
| **Abertura de perfil** | `app/u/[username]/page.tsx` | `<ProfileIntro>` → `IntroPlayer` |
| **Posts** | `components/feed/PostCard.tsx` | autor com `UserIdentity size="md"` (já usa `CosmeticAvatar`/`CosmeticName`/`CosmeticTag`) |
| **Respostas e threads** | `components/replies/ReplyThread.tsx`, `ReplyCarousel.tsx`, `ReplyComposer.tsx`, `app/post/[id]/page.tsx` | `UserIdentity size="sm"` (o mapa `authorProfiles` já existe) |
| **Notificações** | `app/notificacoes/page.tsx` | incluir `cosmetics, contributor_level` no join `actor`; `UserIdentity size="sm"` |
| **Explore / membros** | `app/page.tsx` (carrossel "Membros da comunidade" e aba Membros) | `UserIdentity size="md"` |
| **Tópicos** | `components/feed/TopicTabsManager.tsx` | o spinner passa a usar `InsightAsterisk` (Rainbow); o cabeçalho do workspace mostra o dono com `UserIdentity size="xs"` |
| **Barra lateral** | `components/layout/LeftSidebar.tsx` | `InsightLogo`; item "Insight Nitro" **só em Preview** (Δ some o item com cadeado em produção); usuário logado `size="xs"` |
| **Topo mobile** | `components/layout/AppShell.tsx` | `InsightLogo`; atalho Nitro no menu do topo (Preview) |
| **Navegação mobile** | `components/layout/MobileBottomNav.tsx` | sem item novo; acesso pelo perfil e por Configurações |
| **Configurações** | `app/config/page.tsx` → aba **Perfil & Nitro** | status da assinatura (+ "Ativar teste" no Preview), itens equipados e todos os toggles da 3.4 (inclui **Rainbow**) |
| **Loaders** | `app/loading.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/post/[id]/page.tsx`, `app/u/[username]/page.tsx`, `ui/AsteriskLoader.tsx` | trocar cópias por `InsightAsterisk` |

**Política de animação por tamanho**

| Tamanho | Onde | Moldura | Título/alcunha |
|---|---|---|---|
| `lg` (112–128 px) | perfil, central de personalização | animada | animado |
| `md` (40 px) | posts, Explore | animada quando na tela (orçamento de 4) | animado |
| `sm` (28–36 px) | respostas, notificações, carrosséis | animada quando na tela (orçamento) ou estática em aparelho fraco | estático |
| `xs` (≤ 24 px) | barra lateral, menções | só o anel, sem ornamentos | cor sólida |

---

## 5. Plano de entrega e QA

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0 — Gate** | `flags.ts`, `nitro/layout.tsx`, `NitroProvider.enabled`; variáveis no target Preview | produção: `/nitro` dá 404 e nada do Nitro aparece (nem para o admin); Preview: tudo aparece |
| **1 — Marca** | `InsightAsterisk` + `InsightLogo`, substituindo as 7 cópias; Rainbow com toggle | todos os spinners e logos idênticos ao atual sem Nitro; rainbow com Nitro |
| **2 — Banco** | migração v2, seed gerado de `catalog.ts`, `set_profile_cosmetics`, `start_nitro_trial`, migração v1 → v2 | RPC recusa item `nitro` sem assinatura e `level` acima do nível, mesmo chamado direto |
| **3 — Central mobile** | `CustomizeSheet`, `ItemTile`, prévia bloqueada, botão ao lado de Seguir, aba de configurações | fluxo inteiro testado em 360×740 com toque, sem overflow horizontal |
| **4 — Itens** | 10 + 10 + 10 + 10 itens Nitro, padrões, patentes, `IntroPlayer`, assets R2 | página interna de QA mostra cada item em 4 tamanhos e com movimento reduzido |
| **5 — Propagação** | `UserIdentity` em todos os pontos da tabela 4.3; orçamento de animação | feed com 30 posts animados a ≥ 55 fps num Android intermediário |
| **6 — Lançamento** | cobrança (Mercado Pago preapproval), remoção do gate de Preview | decisão explícita de lançar; flag no target Production |

### Checklist de QA

- [ ] **Produção:** sem item, botão, aba, chip, banner ou rota do Nitro; avatares, nomes, logo e asteriscos idênticos ao padrão, mesmo para perfis com `cosmetics` no banco.
- [ ] **Preview, deslogado:** galeria visível com prévias; nada pode ser aplicado.
- [ ] **Preview, nível 0 sem Nitro:** aplica só itens padrão e `frame-tier-0`; itens Nitro e de nível acima mostram cadeado e CTA.
- [ ] **Preview, nível 3 sem Nitro:** aplica padrões e itens de nível 0–3; toggle "Animação de patente" aparece desabilitado.
- [ ] **Preview, nível 4/5:** moldura de patente animada e abertura exclusiva; toggle desliga as duas.
- [ ] **Assinante:** aplica os 40 itens Nitro; Rainbow aparece na logo e em todos os spinners e some com o toggle.
- [ ] **Assinatura expirada:** itens Nitro e Rainbow somem na hora; itens de nível ficam.
- [ ] **RPC direto:** `set_profile_cosmetics` com item bloqueado é recusado.
- [ ] **Mobile 360 px:** sheet sem overflow horizontal; alvos ≥ 44 px; nenhuma ação depende de hover; "Editar moldura" visível.
- [ ] **Movimento reduzido:** nenhuma animação, nenhuma abertura, Rainbow estático.
- [ ] **Desempenho:** no máximo 4 molduras animando no feed; animações pausam fora da tela; nenhuma animação de `filter` ou `box-shadow`.
