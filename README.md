<div align="center">

# Insight<span style="color: #2563eb;">*</span>

### *"Apenas poste."*

Plataforma full-stack de publicação autoral, microblogging e curadoria de ideias com editor de blocos ricos, threads interativas e motor inteligente de Newsletter.

[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## 📌 Sobre o Projeto

O **Insight\*** (anteriormente *Post it*) é um ecossistema web moderno construído sob a filosofia central **"Apenas poste."** — projetado para unir a agilidade do microblogging em threads com a profundidade de artigos estruturados em blocos editoriais.

A plataforma conta com autenticação integrada, personalização de feed e filtros, reprodução de áudio via **Spotify API**, linha do tempo no **Mural Oficial** e um sistema automatizado de **Newsletter** que dispara publicações formatadas em HTML direto para a caixa de entrada dos assinantes de acordo com suas preferências de leitura.

---

## ✨ Principais Funcionalidades

### 📝 1. Editor de Blocos Ricos & Feed Interativo
- **Composição Modular (`PostBlock`):** Suporte nativo a títulos (`H1`, `H2`), citações (`quote`), caixas de destaque (`callout` com ícones customizáveis), blocos de código (`code`), listas (`bullet`), divisores (`divider`) e imagens com legenda.
- **Publicações Fixadas & Hashtags:** Destaque de publicações importantes no topo do feed (`is_pinned`) e categorização dinâmica por `#tags`.
- **Threads & Interações:** Sistema de respostas e expansão fluida de cards para discussões na comunidade.
- **Integração Musical:** Suporte a players incorporados via **Spotify API**.

### 📬 2. Motor Inteligente de Newsletter (`/api/newsletter`)
- **Arquitetura Híbrida de Disparo:** Suporte automático a **Gmail SMTP (Nodemailer)** (permitindo envios gratuitos para qualquer destinatário sem restrição de domínio) com fallback integrado para a **Resend API**.
- **Filtros Personalizados por Assinante (`notify_mode`):**
  - `all`: Recebe todas as novas publicações do feed + Atualizações Oficiais.
  - `pinned`: Recebe apenas publicações fixadas (Destaques) + Atualizações Oficiais.
  - `tags`: Recebe apenas publicações que contenham as `#hashtags` escolhidas pelo assinante + Atualizações Oficiais.
  - `official_only`: Recebe exclusivamente comunicados da plataforma.
- **Gatilhos Automatizados:**
  - `welcome`: E-mail imediato de boas-vindas com resumo do filtro ativo e card do último Insight em destaque.
  - `new_post`: Renderização completa dos blocos do post em um template HTML Dark Mode responsivo enviado aos assinantes compatíveis.
  - `official_update`: Disparo de comunicados do **Mural Oficial** para toda a base de inscritos.
- **Rota de Diagnóstico (`GET /api/newsletter`):** Endpoint em tempo real para verificação de status do provedor de e-mail ativo em produção.

### 🔔 3. Ecossistema & Governança
- **Mural Oficial (`/notificacoes`):** Linha do tempo dedicada às notas de lançamento, novidades técnicas e avisos oficiais da plataforma.
- **Apoie o Projeto (`/apoie`):** Página responsiva dedicada à sustentabilidade financeira e incentivo ao projeto.
- **Painel de Configurações (`/config`):** Gerenciamento de perfil, preferências de leitura e filtros de notificação.
- **Conformidade Legal (`/termos` e `/privacidade`):** Documentação jurídica corporativa completa alinhada ao **Marco Civil da Internet (Lei nº 12.965/2014)** e à **LGPD (Lei nº 13.709/2018)**.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias Utilizadas |
| :--- | :--- |
| **Front-end & Framework** | Next.js 15 (App Router), React, TypeScript |
| **Estilização & UI** | Tailwind CSS, Design System Dark Mode (`#050507` / `#09090b` / `#2563eb`), Lucide React |
| **Back-end & Banco de Dados** | Next.js Serverless API Routes, Supabase (PostgreSQL, Auth, Storage, RLS) |
| **Mensageria & E-mail** | Nodemailer (Gmail SMTP) & Resend API |
| **Integrações Externas** | Spotify Embed API |
| **Deploy & CI/CD** | GitHub + Vercel |

---

## ⚙️ Variáveis de Ambiente

Para rodar o projeto localmente ou em produção na **Vercel**, crie um arquivo `.env.local` na raiz do projeto com as seguintes chaves:

```env
# Supabase (Banco de Dados e Autenticação)
NEXT_PUBLIC_SUPABASE_URL=[https://seu-projeto.supabase.co](https://seu-projeto.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_publica

# URL Base da Aplicação (Opcional na Vercel, usada nos links da Newsletter)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Provedor Principal de E-mail — Gmail SMTP (Envio liberado para qualquer destinatário)
GMAIL_USER=contato.insightproject@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Provedor Alternativo de E-mail — Resend API (Fallback)
RESEND_API_KEY=re_sua_chave_resend
RESEND_FROM_EMAIL="Insight* <onboarding@resend.dev>"
