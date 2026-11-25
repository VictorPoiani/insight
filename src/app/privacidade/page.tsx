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
            <Calendar className="w-3.5 h-3.5 text-accent" /> Última atualização: 25 de novembro de 2026
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent" /> Versão 3.0
          </span>
          <span className="flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-accent" /> LGPD · Marco Civil · ECA
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
          , ao <strong className="text-primary">Marco Civil da Internet (Lei nº 12.965/2014)</strong>, ao{' '}
          <strong className="text-primary">Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)</strong>, à{' '}
          <strong className="text-primary">Lei nº 15.211/2025 (ECA Digital)</strong> e ao{' '}
          <strong className="text-primary">Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong>.
        </p>
        <p>
          <strong>Em resumo:</strong> não vendemos seus dados, não usamos anúncios nem rastreadores de
          publicidade, o conteúdo passa por uma moderação automática de segurança antes de ser
          publicado e você pode pedir revisão humana de qualquer decisão, além de acessar, corrigir,
          exportar ou excluir seus dados.
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
            <li>
              <strong className="text-primary">Status online e &ldquo;visto por último&rdquo;:</strong>{' '}
              enquanto o site está aberto, registramos a data e hora da sua última atividade e
              informamos, em tempo real, que você está online. Você pode ficar invisível a qualquer
              momento em &ldquo;Mostrar quando estou online&rdquo;, no menu de status do seu perfil; ao
              fazer isso, o horário de última atividade é apagado.
            </li>
            <li>
              <strong className="text-primary">Interações com notícias:</strong> temas que você
              segue e notícias que abre, curte ou oculta. Usamos apenas para ordenar o seu feed de
              notícias; essas informações não são exibidas a outras pessoas.
            </li>
            <li>
              <strong className="text-primary">Áreas de organização pessoal:</strong> dados que você
              registra em abas de tópicos (plano nutricional com refeições, água, peso e notas;
              metas; hábitos; agenda). Eles seguem a visibilidade da aba e do perfil. Dados de saúde
              são sensíveis (Art. 11 da LGPD): só os registre se quiser, e prefira abas privadas.
            </li>
            <li>
              <strong className="text-primary">Dados de moderação:</strong> o texto, as imagens e
              alguns quadros dos vídeos que você publica são analisados automaticamente antes de
              aparecer para outras pessoas (veja a Seção 4-A). Guardamos o resultado (aprovado, +18,
              em análise ou bloqueado), as categorias e notas de risco, um trecho de até 500
              caracteres e os endereços das mídias analisadas, para auditoria e para atender pedidos
              de revisão.
            </li>
            <li>
              <strong className="text-primary">Atividade de uso (&ldquo;Sua atividade&rdquo;):</strong>{' '}
              tempo de tela com o site aberto e em uso, quantidade de Insights vistos e de vídeos
              assistidos, por dia. Esses números só são mostrados para você, no painel &ldquo;Sua
              atividade&rdquo;, e não são usados para publicidade nem para ordenar o feed.
            </li>
            <li>
              <strong className="text-primary">Insights salvos, curtidas e menções:</strong> a lista
              do que você salvou é privada; curtidas, reposts e menções (@) são visíveis conforme a
              visibilidade do Insight. Quem você marca recebe uma notificação.
            </li>
            <li>
              <strong className="text-primary">Apoio financeiro:</strong> nome de exibição do
              apoiador (ou o nome informado na doação), valor, data e situação do pagamento. O nome e a
              pontuação de quem apoia aparecem publicamente no ranking de contribuição, no ranking de
              domingo e na faixa de agradecimento do feed (o valor não aparece na faixa). Se preferir
              apoiar de forma anônima, peça pelo canal da Seção 8.
            </li>
            <li>
              <strong className="text-primary">Data de nascimento e idade:</strong> obrigatória no
              cadastro. Usamos para confirmar a idade mínima de 13 anos, aplicar as proteções para
              adolescentes e liberar conteúdo +18 apenas a maiores de 18 anos (base legal: cumprimento
              de obrigação legal e proteção de menores, ECA e Lei 15.211/2025). No perfil público
              aparecem só o dia e o mês; depois de informada, só o suporte altera a data.
            </li>
            <li>
              <strong className="text-primary">Notificações push:</strong> se você ativar, guardamos o
              endereço técnico de entrega do seu navegador para enviar avisos. Você pode desativar a
              qualquer momento em Configurações.
            </li>
            <li>
              <strong className="text-primary">Mídias enviadas:</strong> imagens, GIFs, vídeos e
              arquivos que você anexa a Insights e respostas. Vídeos e imagens são comprimidos no seu
              próprio aparelho antes do envio; o arquivo original não é enviado aos nossos servidores.
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
                <Shield className="w-3.5 h-3.5 text-accent" /> Segurança e Proteção de Menores (Art. 7º, IX e Art. 14)
              </div>
              <p className="text-xs text-muted">
                Moderação automática de conteúdo, limites de publicação contra abuso e bloqueio de
                conteúdo +18 a menores, no melhor interesse de crianças e adolescentes.
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
            <Link href="/atualizacoes" className="text-accent font-semibold hover:underline">
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
          <p>
            <strong>GIFs e notícias:</strong> a busca de GIFs é feita pelo nosso servidor junto ao
            GIPHY/Tenor (sem enviar seus dados pessoais), e as imagens dos GIFs e das notícias são
            carregadas diretamente dos servidores desses serviços e dos portais de origem.
          </p>
          <p>
            <strong>Preferências guardadas no aparelho:</strong> volume do player de vídeo, modo
            foco automático, rascunhos e preferências de leitura ficam no armazenamento local do seu
            navegador e não são enviados aos nossos servidores.
          </p>
        </section>

        {/* Seção 4-A */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            4-A. Da Moderação Automática e das Decisões Automatizadas (Art. 20 da LGPD)
          </h2>
          <p>
            <strong>4-A.1. Como funciona:</strong> antes de um Insight, resposta, tópico ou alteração
            de perfil aparecer para outras pessoas, o conteúdo passa por regras automáticas e por um
            classificador de segurança (OpenAI Moderation). O resultado pode ser: liberado; liberado com
            aviso +18 (aparece borrado); em análise (oculto até revisão humana); ou bloqueado (fica
            retido e visível só para você).
          </p>
          <p>
            <strong>4-A.2. O que é enviado ao classificador:</strong> o texto do conteúdo e os
            endereços das imagens e dos quadros extraídos dos vídeos. Não enviamos seu e-mail, nome de
            usuário ou outros dados de cadastro. Pelas regras da OpenAI para a API, esses dados não são
            usados para treinar modelos e podem ser guardados por até 30 dias apenas para prevenção de
            abuso.
          </p>
          <p>
            <strong>4-A.3. Seu direito à revisão:</strong> toda decisão automática que retém ou bloqueia
            um conteúdo pode ser revista por uma pessoa da equipe. Use o botão &ldquo;Pedir revisão&rdquo;
            no próprio conteúdo ou o canal da Seção 8. Você também pode pedir informações sobre os
            critérios usados, respeitado o segredo necessário para que a moderação não seja burlada.
          </p>
          <p>
            <strong>4-A.4. Registros de auditoria:</strong> cada decisão gera um registro (data,
            resultado, categorias, trecho e mídias), acessível apenas à equipe de moderação. Quando a
            conta é excluída, esses registros deixam de estar ligados ao seu perfil.
          </p>
        </section>

        {/* Seção 4-B */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            4-B. De Crianças e Adolescentes
          </h2>
          <p>
            O Insight* não é destinado a menores de 13 anos. Contas de adolescentes (13 a 17 anos)
            exigem ciência e autorização dos responsáveis. Para essas contas, o tratamento de dados
            segue o melhor interesse do adolescente (Art. 14 da LGPD): não há publicidade, perfilamento
            para anúncios nem venda de dados, e o conteúdo marcado como +18 fica bloqueado. A data de
            nascimento é pedida no cadastro, e contas com menos de 13 anos não são criadas. Se você souber de uma conta de criança ou de
            conteúdo que envolva menores, denuncie pelo botão de denúncia ou pelo canal da Seção 8.
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
              relacional PostgreSQL, gestão criptografada de autenticação (Supabase Auth), presença
              em tempo real (Realtime) e políticas de isolamento por linha (
              <em>Row Level Security - RLS</em>);
            </li>
            <li>
              <strong className="text-primary">Cloudflare, Inc. (R2):</strong> Armazenamento e
              entrega das imagens, vídeos e arquivos publicados, no domínio media.insight.app.br;
            </li>
            <li>
              <strong className="text-primary">Mercado Pago (Mercado Livre):</strong> Processamento
              dos pagamentos da assinatura Insight Nitro. Os dados do cartão são informados direto ao
              Mercado Pago; guardamos apenas o identificador, a situação e as datas da assinatura;
            </li>
            <li>
              <strong className="text-primary">Vercel Inc.:</strong> Hospedagem da aplicação web,
              processamento de rotas serverless e distribuição global em rede de borda (CDN) sob
              criptografia SSL/TLS;
            </li>
            <li>
              <strong className="text-primary">OpenAI, L.L.C.:</strong> Classificação de segurança do
              texto e das imagens publicadas (moderação automática), sem envio de dados de cadastro;
            </li>
            <li>
              <strong className="text-primary">Apple (iTunes Search) e GIPHY:</strong> Busca de músicas
              e de GIFs. A busca de músicas é feita diretamente do seu navegador, que informa o termo
              pesquisado e o seu endereço IP a esses serviços;
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
            <strong>6.2. Prazos de guarda:</strong> registros de acesso (IP, data e hora): 6 meses, como
            exige o Art. 15 do Marco Civil; conteúdos, perfil, Insights salvos e atividade de uso:
            enquanto a conta existir; registros de moderação e de denúncias: enquanto forem necessários
            para segurança, defesa em processos e cumprimento de ordens de autoridades, desvinculados do
            perfil após a exclusão da conta; dados de pagamento e doações: pelo prazo exigido pela
            legislação fiscal e de defesa do consumidor.
          </p>
          <p>
            <strong>6.3. Retenção e Descarte:</strong> Os dados pessoais são mantidos apenas pelo
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
              <strong>Portabilidade e Informação sobre Compartilhamento:</strong> Receber seus dados em
              formato estruturado e saber com quais operadores eles são compartilhados (Seção 5);
            </li>
            <li>
              <strong>Revisão de Decisões Automatizadas:</strong> Pedir que uma pessoa revise decisões
              tomadas apenas de forma automática, como as da moderação (Art. 20 e Seção 4-A);
            </li>
            <li>
              <strong>Revogação do Consentimento:</strong> Desativar o recebimento de comunicações da
              Newsletter e de notificações push a qualquer momento (opt-out).
            </li>
          </ul>
          <p>
            Respondemos às solicitações em até 15 (quinze) dias. Se não ficar satisfeito, você pode
            reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.
          </p>
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