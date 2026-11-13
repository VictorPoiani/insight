import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Shield,
  Lock,
  Database,
  Eye,
  Server,
  UserCheck,
  Mail,
  FileCheck,
  Cookie,
} from 'lucide-react';

export default function PrivacidadePage() {
  return (
    <div className="p-6 sm:p-8 space-y-8 text-sm leading-relaxed max-w-4xl mx-auto">
      {/* Navegação de Retorno */}
      <Link
        href="/config"
        className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Configurações</span>
      </Link>

      {/* Cabeçalho Institucional */}
      <header className="border-b border-border pb-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-[11px] font-bold uppercase tracking-wider text-accent">
          <Lock className="w-3.5 h-3.5" /> Governança e Proteção de Dados (LGPD)
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          Política de Privacidade e Proteção de Dados Pessoais
        </h1>
        <p className="text-xs sm:text-sm text-muted">
          Diretrizes de transparência, coleta, tratamento, segurança da informação e direitos dos
          titulares na Plataforma Insight*.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-accent" /> Última atualização: Novembro de 2026
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent" /> Versão 2.0 (Corporativa)
          </span>
          <span className="flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-accent" /> Conformidade: Lei nº 13.709/2018
          </span>
        </div>
      </header>

      {/* Declaração de Compromisso */}
      <div className="p-5 rounded-xl bg-surface border border-border border-l-4 border-l-accent space-y-2 text-xs sm:text-sm text-secondary">
        <div className="font-bold text-primary flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent" />
          COMPROMISSO DE TRANSPARÊNCIA E PRIVACIDADE
        </div>
        <p>
          A presente <strong>Política de Privacidade</strong> descreve de forma clara, objetiva e
          transparente como a plataforma <strong className="text-primary">Insight*</strong>{' '}
          (anteriormente denominada <em>Post it</em>), na qualidade de{' '}
          <strong>Controladora de Dados</strong>, realiza a coleta, o armazenamento, o processamento
          e a proteção dos dados pessoais de seus Usuários, Visitantes e Assinantes.
        </p>
        <p>
          Este documento é parte integrante e indissociável dos nossos{' '}
          <Link href="/termos" className="text-accent font-semibold hover:underline">
            Termos e Condições de Uso
          </Link>{' '}
          e foi elaborado em estrita observância à{' '}
          <strong className="text-primary">
            Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)
          </strong>{' '}
          e ao <strong className="text-primary">Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
        </p>
      </div>

      {/* Seções da Política */}
      <div className="space-y-8 text-secondary">
        {/* Seção 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            1. Das Categorias de Dados Coletados e Suas Finalidades
          </h2>
          <p>
            Coletamos estritamente os dados mínimos necessários (princípio da minimização) para
            viabilizar a operação técnica, a segurança e a experiência interativa na Plataforma:
          </p>
          <ul className="list-disc pl-5 space-y-2.5">
            <li>
              <strong className="text-primary">Dados de Cadastro e Perfil Público:</strong> Nome de
              exibição, nome de usuário (<code>@username</code>), apelido, endereço de e-mail,
              fotografia de perfil (avatar), biografia e links externos fornecidos voluntariamente
              para identificação do autor em postagens e respostas (replies).
            </li>
            <li>
              <strong className="text-primary">Dados de Assinatura da Newsletter:</strong> Endereço
              de correio eletrônico, modalidade de filtro escolhida (todas as publicações, apenas
              destaques fixados, temas específicos por <em>#hashtags</em> ou apenas comunicados
              oficiais) e data de inscrição.
            </li>
            <li>
              <strong className="text-primary">Conteúdo Gerado pelo Usuário (UGC):</strong> Textos,
              blocos editoriais, comentários, curtidas, reações e imagens publicados voluntariamente
              nas threads da Plataforma.
            </li>
            <li>
              <strong className="text-primary">Registros Técnicos e Logs de Acesso:</strong> Endereço
              IP, data e hora de acesso (com fuso horário), tipo de navegador (User-Agent) e dados
              de sessão, coletados de forma automatizada para prevenção a fraudes, segurança da
              informação e cumprimento do dever legal previsto no Art. 15 do Marco Civil da Internet.
            </li>
          </ul>
        </section>

        {/* Seção 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            2. Das Bases Legais para o Tratamento de Dados (Art. 7º da LGPD)
          </h2>
          <p>
            Toda operação de tratamento de dados pessoais no <strong className="text-primary">Insight*</strong>{' '}
            fundamenta-se em hipóteses legais expressamente previstas na legislação brasileira:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-accent" /> Execução de Contrato (Art. 7º, V)
              </div>
              <p className="text-xs text-muted">
                Autenticação de conta, exibição do perfil do autor, publicação de insights, respostas
                em threads e personalização das configurações da plataforma.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-accent" /> Consentimento Livre (Art. 7º, I)
              </div>
              <p className="text-xs text-muted">
                Envio de e-mails de boas-vindas, notificações de novos posts e boletins do Mural
                Oficial mediante inscrição voluntária (opt-in) na Newsletter.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-accent" /> Legítimo Interesse (Art. 7º, IX)
              </div>
              <p className="text-xs text-muted">
                Monitoramento de desempenho, prevenção a ataques cibernéticos (spam, DDoS, injeções),
                melhoria contínua de usabilidade e métricas agregadas.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-accent" /> Obrigação Legal (Art. 7º, II)
              </div>
              <p className="text-xs text-muted">
                Guarda de registros de acesso à aplicação de internet pelo prazo legal de 6 (seis)
                meses, em cumprimento ao Marco Civil da Internet.
              </p>
            </div>
          </div>
        </section>

        {/* Seção 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            3. Da Governança da Newsletter e Comunicações Transacionais
          </h2>
          <p>
            <strong>3.1. Finalidade Exclusiva:</strong> Os endereços de e-mail cadastrados na base
            de Assinantes (tabela <code>subscribers</code>) são utilizados exclusivamente para o
            disparo de conteúdos editoriais do <strong className="text-primary">Insight*</strong> e
            comunicados institucionais do{' '}
            <Link href="/notificacoes" className="text-accent font-semibold hover:underline">
              Mural Oficial
            </Link>
            . Sob nenhuma circunstância comercializamos, alugamos ou cedemos listas de e-mail a
            terceiros para fins publicitários.
          </p>
          <p>
            <strong>3.2. Controle de Filtros e Cancelamento (Opt-out):</strong> O Assinante possui
            autonomia integral para alterar suas preferências de recebimento (filtrando apenas temas
            de seu interesse ou publicações fixadas) diretamente na página de{' '}
            <Link href="/config" className="text-accent font-semibold hover:underline">
              Configurações
            </Link>{' '}
            ou solicitar a remoção imediata de seu e-mail através do nosso canal oficial de suporte.
          </p>
        </section>

        {/* Seção 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            4. De Cookies, Armazenamento Local e Mídias Incorporadas
          </h2>
          <div className="p-4 rounded-xl bg-surface border border-accent/30 space-y-2">
            <h3 className="text-xs sm:text-sm font-bold text-accent flex items-center gap-1.5">
              <Cookie className="w-4 h-4 shrink-0" />
              Uso Estritamente Funcional e Ausência de Rastreadores Invasivos
            </h3>
            <p className="text-xs sm:text-sm text-secondary">
              O <strong className="text-primary">Insight*</strong> não utiliza cookies de
              rastreamento comportamental de terceiros para leilão de anúncios (AdTech). Utilizamos
              apenas cookies técnicos de autenticação e recursos de armazenamento local (
              <code>localStorage</code>) essenciais para manter sua sessão ativa com segurança,
              salvar suas preferências de leitura e registrar interações locais.
            </p>
          </div>
          <p>
            <strong>Mídias de Terceiros (Spotify Embed):</strong> Algumas publicações podem conter
            reprodutores de áudio incorporados via <strong className="text-primary">Spotify API</strong>.
            Ao interagir diretamente com o player incorporado, o serviço terceiro poderá aplicar suas
            próprias políticas de sessão e cookies técnicos para reprodução da faixa.
          </p>
        </section>

        {/* Seção 5 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            5. Do Compartilhamento com Operadores e Transferência Internacional
          </h2>
          <p>
            Para garantir alta disponibilidade, escalabilidade e segurança, a Plataforma utiliza
            provedores de infraestrutura tecnológica de padrão global, que atuam como{' '}
            <strong>Operadores de Dados</strong> sob rigorosos padrões de conformidade (SOC 2, ISO
            27001 e GDPR/LGPD):
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-primary">Supabase Inc.:</strong> Hospedagem de banco de dados
              relacional PostgreSQL, gestão criptografada de autenticação (Supabase Auth) e
              armazenamento de arquivos de mídia (Storage) com políticas de isolamento por linha (
              <em>Row Level Security - RLS</em>);
            </li>
            <li>
              <strong className="text-primary">Vercel Inc.:</strong> Hospedagem da aplicação web,
              processamento de rotas serverless e distribuição global em rede de borda (CDN) sob
              criptografia SSL/TLS;
            </li>
            <li>
              <strong className="text-primary">Resend Inc. & Google LLC (Gmail SMTP):</strong>{' '}
              Infraestrutura de transporte e entrega autenticada de e-mails transacionais e boletins
              da Newsletter.
            </li>
          </ul>
          <p className="text-xs text-muted">
            Nota: Como alguns servidores de nuvem desses operadores estão localizados nos Estados
            Unidos ou na União Europeia, o tratamento envolve transferência internacional de dados,
            realizada em conformidade com o Art. 33 da LGPD mediante cláusulas-padrão e certificações
            internacionais de segurança.
          </p>
        </section>

        {/* Seção 6 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            6. Da Segurança da Informação e Prazo de Retenção
          </h2>
          <p>
            <strong>6.1. Medidas Técnicas de Proteção:</strong> Adotamos práticas modernas de
            engenharia de segurança, incluindo tráfego integralmente criptografado via protocolo{' '}
            <code>HTTPS/TLS</code>, senhas armazenadas exclusivamente mediante algoritmos de{' '}
            <em>hashing</em> criptográfico (<code>bcrypt</code>), controle de acesso restrito por
            políticas <em>Row Level Security (RLS)</em> no banco de dados e proteção de variáveis
            sensíveis em ambiente isolado de produção.
          </p>
          <p>
            <strong>6.2. Retenção e Descarte:</strong> Os dados pessoais são mantidos apenas pelo
            período necessário ao cumprimento das finalidades para as quais foram coletados. Caso o
            Usuário solicite a exclusão de sua conta ou o cancelamento de sua inscrição na
            Newsletter, seus dados serão eliminados ou anonimizados, ressalvada a conservação
            estritamente necessária para cumprimento de obrigação legal ou regulatória (Art. 16 da
            LGPD).
          </p>
        </section>

        {/* Seção 7 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            7. Dos Direitos do Titular de Dados (Art. 18 da LGPD)
          </h2>
          <p>
            O Usuário titular de dados pessoais pode exercer, a qualquer momento e de forma gratuita,
            os seguintes direitos garantidos pela LGPD:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Confirmação e Acesso:</strong> Saber se tratamos seus dados pessoais e obter
              cópia das informações associadas ao seu perfil ou e-mail;
            </li>
            <li>
              <strong>Correção e Atualização:</strong> Retificar dados incompletos, inexatos ou
              desatualizados diretamente no painel de perfil ou mediante solicitação;
            </li>
            <li>
              <strong>Anonimização, Bloqueio ou Eliminação:</strong> Solicitar a exclusão definitiva
              de dados desnecessários ou tratados mediante consentimento;
            </li>
            <li>
              <strong>Revogação do Consentimento:</strong> Desativar o recebimento de comunicações da
              Newsletter a qualquer momento (opt-out).
            </li>
          </ul>
        </section>

        {/* Seção 8 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            8. Do Encarregado de Dados (DPO) e Canal de Atendimento
          </h2>
          <p>
            Para exercer seus direitos previstos na LGPD, esclarecer dúvidas sobre esta Política de
            Privacidade ou solicitar a remoção de dados pessoais, entre em contato diretamente com o
            nosso canal responsável pela Governança e Proteção de Dados:
          </p>

          {/* Card de Contato DPO */}
          <div className="mt-4 p-4 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-accent" /> Encarregado pelo Tratamento de Dados
                Pessoais (Canal LGPD / DPO)
              </div>
              <p className="text-xs text-muted">
                Responsável: Victor Poiani · Atendimento a titulares, privacidade e conformidade
                legal (Rio Paranaíba, MG)
              </p>
            </div>
            <a
              href="mailto:contato.insightproject@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-bold hover:bg-accent/20 transition-colors shrink-0"
            >
              <Mail className="w-4 h-4" />
              contato.insightproject@gmail.com
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}