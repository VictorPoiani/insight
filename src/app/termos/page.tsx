import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Shield,
  CheckCircle2,
  Scale,
  FileText,
  Lock,
  AlertTriangle,
  Mail,
  Building2,
} from 'lucide-react';

export default function TermosPage() {
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
          <Scale className="w-3.5 h-3.5" /> Instrumento Contratual de Adesão
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          Termos e Condições Gerais de Uso da Plataforma Insight*
        </h1>
        <p className="text-xs sm:text-sm text-muted">
          Contrato de Licença de Uso de Software como Serviço (SaaS), Publicação de Conteúdo e
          Diretrizes de Governança Digital.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-accent" /> Última atualização: Novembro de 2026
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent" /> Versão 2.0 (Corporativa)
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-accent" /> Vigência: Imediata
          </span>
        </div>
      </header>

      {/* Preâmbulo e Aviso de Vinculação Jurídica */}
      <div className="p-5 rounded-xl bg-surface border border-border border-l-4 border-l-accent space-y-2 text-xs sm:text-sm text-secondary">
        <div className="font-bold text-primary flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          PREÂMBULO E AVISO DE VINCULAÇÃO JURÍDICA
        </div>
        <p>
          O presente instrumento particular (&ldquo;<strong>Termos de Uso</strong>&rdquo;) estabelece
          as condições gerais, direitos, obrigações e responsabilidades aplicáveis ao acesso e à
          utilização da plataforma digital <strong className="text-primary">Insight*</strong>{' '}
          (anteriormente denominada <em>Post it</em>), bem como de suas interfaces, APIs, sistemas de
          newsletter e demais funcionalidades correlatas.
        </p>
        <p>
          <strong>Atenção:</strong> O acesso, navegação, cadastro ou utilização de qualquer recurso
          da Plataforma implica a declaração expressa, livre, informada e inequívoca de que o
          Usuário leu, compreendeu e aceitou integralmente todas as cláusulas deste instrumento e da
          nossa{' '}
          <Link href="/privacidade" className="text-accent font-semibold hover:underline">
            Política de Privacidade
          </Link>
          . Caso não concorde com qualquer disposição aqui prevista, o Usuário deverá abster-se de
          utilizar os Serviços imediatamente.
        </p>
      </div>

      {/* Corpo Cláusulas Contratuais */}
      <div className="space-y-8 text-secondary">
        {/* Cláusula 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            1. Das Definições e Interpretação
          </h2>
          <p>
            Para os fins deste contrato e sua adequada interpretação jurídica e técnica, os termos
            abaixo terão os seguintes significados:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-primary">Plataforma (ou &ldquo;Insight*&rdquo;):</strong>{' '}
              Ecossistema web de publicação editorial, microblogging, curadoria de ideias e
              interação em threads, operado sob a filosofia institucional{' '}
              <em>&ldquo;Apenas poste.&rdquo;</em>
            </li>
            <li>
              <strong className="text-primary">Operador / Mantenedor:</strong> Titular e
              administrador legal da Plataforma Insight*, responsável pela gestão tecnológica,
              editorial e operacional do serviço.
            </li>
            <li>
              <strong className="text-primary">Usuário:</strong> Qualquer pessoa física ou jurídica,
              cadastrada ou visitante, que acesse, navegue, consuma conteúdo, assine boletins
              informativos ou interaja na Plataforma.
            </li>
            <li>
              <strong className="text-primary">Conteúdo do Usuário (UGC):</strong> Todo e qualquer
              texto, artigo, comentário, resposta (reply), imagem, código-fonte, arquivo multimídia,
              tag ou link submetido ou publicado na Plataforma.
            </li>
            <li>
              <strong className="text-primary">Assinante (Subscriber):</strong> Usuário que cadastra
              voluntariamente seu endereço de correio eletrônico para o recebimento automatizado de
              publicações, destaques e comunicados do Mural Oficial.
            </li>
          </ul>
        </section>

        {/* Cláusula 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            2. Do Objeto Contratual
          </h2>
          <p>
            <strong>2.1.</strong> Constitui objeto destes Termos o licenciamento de uso, em caráter
            não exclusivo, intransferível, revogável e gratuito (salvo funcionalidades ou planos
            comerciais específicos), da Plataforma <strong className="text-primary">Insight*</strong>
            , destinada ao compartilhamento estruturado de conhecimento, projetos, reflexões, mídias
            e distribuição de boletins informativos via correio eletrônico.
          </p>
          <p>
            <strong>2.2.</strong> O Operador reserva-se a prerrogativa de, a qualquer tempo e
            independentemente de aviso prévio, aprimorar, modificar, adicionar, restringir ou
            descontinuar funcionalidades, layouts ou integrações técnicas, visando à evolução
            contínua e à segurança cibernética do ecossistema.
          </p>
        </section>

        {/* Cláusula 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            3. Da Elegibilidade, Cadastro e Segurança de Credenciais
          </h2>
          <p>
            <strong>3.1. Capacidade Civil e Idade Mínima:</strong> Os Serviços são destinados a
            indivíduos com idade igual ou superior a <strong>13 (treze) anos</strong>. Para usuários
            entre 13 (treze) e 18 (dezoito) anos incompletos, a utilização da Plataforma pressupõe a
            ciência, supervisão e autorização expressa de seus pais ou representantes legais, que
            responderão solidariamente pelos atos praticados, nos termos do Código Civil Brasileiro.
          </p>
          <p>
            <strong>3.2. Veracidade e Atualização Cadastral:</strong> O Usuário compromete-se a
            fornecer dados cadastrais fidedignos, exatos e atualizados, respondendo civil e
            criminalmente pela veracidade das informações prestadas, sendo expressamente vedada a
            utilização de identidades falsas ou de terceiros sem representação legítima.
          </p>
          <p>
            <strong>3.3. Guarda de Credenciais:</strong> As credenciais de autenticação (e-mail,
            senhas e tokens de sessão) são de uso pessoal e intransferível. O Usuário é o único e
            exclusivo responsável por manter o sigilo de seu acesso e por todas as operações
            realizadas por meio de sua conta, devendo notificar imediatamente o Operador em caso de
            suspeita de comprometimento ou acesso não autorizado.
          </p>
        </section>

        {/* Cláusula 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            4. Da Propriedade Intelectual e Licenciamento de Conteúdo
          </h2>

          <div className="p-4 rounded-xl bg-surface border border-accent/30 space-y-2">
            <h3 className="text-xs sm:text-sm font-bold text-accent flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              4.1. Titularidade Autoral do Usuário e Licença Operacional
            </h3>
            <p className="text-xs sm:text-sm text-secondary">
              O autor retém a titularidade integral de todos os direitos morais e patrimoniais sobre
              os textos, blocos editoriais, códigos, imagens e comentários de sua autoria publicados
              na Plataforma. Contudo, ao submeter conteúdos públicos no{' '}
              <strong className="text-primary">Insight*</strong>, o autor concede à Plataforma uma
              licença mundial, gratuita, não exclusiva e isenta de <em>royalties</em> para hospedar,
              armazenar em banco de dados, indexar, reproduzir no feed público e distribuir tais
              publicações aos Assinantes cadastrados no sistema de Newsletter, enquanto o conteúdo
              permanecer ativo na Plataforma.
            </p>
          </div>

          <p>
            <strong>4.2. Propriedade Exclusiva da Plataforma:</strong> Todos os direitos relativos à
            arquitetura de software, código-fonte, algoritmos, banco de dados, identidade visual,
            design de interface (UI/UX), logotipos, insígnias e à marca{' '}
            <strong className="text-primary">Insight*</strong> pertencem com exclusividade ao
            Operador, encontrando-se protegidos pela Lei de Direitos Autorais (Lei nº 9.610/1998),
            pela Lei do Software (Lei nº 9.609/1998) e pelos tratados internacionais de propriedade
            intelectual.
          </p>
          <p>
            <strong>4.3. Vedação de Exploração Comercial Indevida:</strong> Nenhuma disposição destes
            Termos transfere ao Usuário qualquer direito de propriedade sobre a Plataforma, sendo
            terminantemente proibida a cópia, reprodução total ou parcial, engenharia reversa,
            descompilação ou criação de obras derivadas da infraestrutura do sistema sem autorização
            prévia e por escrito do Operador.
          </p>
        </section>

        {/* Cláusula 5 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            5. Das Diretrizes de Governança, Segurança e Uso Aceitável (AUP)
          </h2>
          <p>
            Como condição essencial para a utilização dos Serviços, o Usuário obriga-se a pautar sua
            conduta pela boa-fé objetiva, pela ética e pelo estrito cumprimento da legislação
            vigente, sendo expressamente <strong>PROIBIDO</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Ilícitos e Violação de Direitos:</strong> Publicar, transmitir ou difundir
              conteúdo difamatório, calunioso, injurioso, discriminatório, que incite discurso de
              ódio, violência, assédio, fraude ou qualquer conduta tipificada como ilícito civil ou
              penal no ordenamento jurídico brasileiro;
            </li>
            <li>
              <strong>Infração de Propriedade Intelectual:</strong> Plagiar, reproduzir ou
              distribuir materiais protegidos por direitos autorais, segredos comerciais ou marcas de
              terceiros sem a devida licença ou citação legal;
            </li>
            <li>
              <strong>Ataques Cibernéticos e Intrusão:</strong> Executar testes de intrusão não
              autorizados, explorar vulnerabilidades, injetar códigos maliciosos (como{' '}
              <em>SQL Injection</em>, <em>Cross-Site Scripting - XSS</em>, <em>CSRF</em> ou{' '}
              <em>malwares</em>) ou promover ataques de negação de serviço (<em>DoS / DDoS</em>)
              contra a infraestrutura da Plataforma;
            </li>
            <li>
              <strong>Automação Abusiva e Extração de Dados:</strong> Utilizar robôs,{' '}
              <em>spiders</em>, <em>scrapers</em> ou scripts automatizados para coleta massiva de
              dados (<em>web scraping</em>), sobrecarga de requisições nas rotas de API ou envio de{' '}
              <em>spam</em>.
            </li>
          </ul>
        </section>

        {/* Cláusula 6 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            6. Do Sistema de Newsletter e Comunicações Eletrônicas
          </h2>
          <p>
            <strong>6.1. Adesão Voluntária (Opt-in):</strong> Ao inscrever seu endereço de e-mail no
            sistema de Newsletter do <strong className="text-primary">Insight*</strong>, o Assinante
            autoriza expressamente o envio automatizado de mensagens de boas-vindas, notificações de
            novas publicações (conforme os filtros de preferência selecionados: <em>Todas</em>,{' '}
            <em>Destaques Fixados</em> ou <em>Tags específicas</em>) e comunicados do Mural Oficial.
          </p>
          <p>
            <strong>6.2. Gestão de Preferências e Cancelamento (Opt-out):</strong> O Assinante poderá,
            a qualquer momento, personalizar seus filtros de recebimento através do painel de{' '}
            <Link href="/config" className="text-accent font-semibold hover:underline">
              Configurações
            </Link>{' '}
            ou solicitar a exclusão definitiva de seu endereço da base de disparos mediante
            solicitação ao canal oficial de atendimento.
          </p>
        </section>

        {/* Cláusula 7 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            7. Do Apoio Financeiro, Monetização e Sustentabilidade Comercial
          </h2>
          <p>
            <strong>7.1. Contribuições Voluntárias:</strong> A Plataforma disponibiliza uma seção
            dedicada (<Link href="/apoie" className="text-accent font-semibold hover:underline">Apoie o Projeto</Link>) para que Usuários e entusiastas possam realizar contribuições financeiras espontâneas (via PIX ou outros meios de pagamento disponibilizados) com a finalidade de custear servidores, domínios, bancos de dados e incentivar o desenvolvimento contínuo do ecossistema.
          </p>
          <p>
            <strong>7.2. Natureza Jurídica do Apoio:</strong> Salvo quando expressamente vinculado à
            contratação de um produto digital ou plano de assinatura específico, o apoio financeiro
            possui natureza de liberalidade voluntária de incentivo tecnológico e cultural, não
            conferindo ao apoiador participação societária, direitos de propriedade intelectual,
            poder de veto editorial ou garantia de nível de serviço (SLA) diferenciado, sendo os
            valores irretratáveis e não reembolsáveis, exceto em hipótese de erro operacional
            comprovado.
          </p>
        </section>

        {/* Cláusula 8 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            8. Da Moderação, Suspensão e Regime de Responsabilidade Civil
          </h2>
          <p>
            <strong>8.1. Poder de Moderação:</strong> O Operador reserva-se o direito de, a seu
            exclusivo critério técnico e jurídico, ocultar, remover ou restringir o acesso a
            qualquer publicação, comentário ou conta de Usuário que viole estes Termos, comprometa
            a estabilidade da Plataforma ou infrinja a legislação vigente, sem prejuízo das medidas
            judiciais cabíveis.
          </p>
          <p>
            <strong>8.2. Responsabilidade por Conteúdo de Terceiros:</strong> Em estrita observância
            ao <strong>Artigo 19 do Marco Civil da Internet (Lei nº 12.965/2014)</strong>, as
            opiniões, comentários e conteúdos publicados por Usuários e terceiros nas threads de
            discussão são de responsabilidade exclusiva de seus respectivos autores, não refletindo
            necessariamente o posicionamento oficial da Plataforma.
          </p>
        </section>

        {/* Cláusula 9 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            9. Da Infraestrutura de Terceiros, Disponibilidade e Limitação de Responsabilidade
          </h2>
          <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
            <h3 className="text-xs sm:text-sm font-bold text-primary flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-accent shrink-0" />
              Fornecimento no Estado em que se Encontra (&ldquo;AS IS&rdquo; e &ldquo;AS AVAILABLE&rdquo;)
            </h3>
            <p className="text-xs sm:text-sm text-secondary">
              A Plataforma é disponibilizada em regime de melhores esforços técnicos. O Operador não
              garante que o serviço operará de forma absolutamente ininterrupta ou livre de falhas
              externas, especialmente aquelas decorrentes de manutenções programadas, casos fortuitos
              ou de força maior.
            </p>
          </div>
          <p>
            <strong>9.1. Serviços e APIs de Terceiros:</strong> O funcionamento pleno do{' '}
            <strong className="text-primary">Insight*</strong> integra soluções tecnológicas de
            provedores líderes de mercado, incluindo, mas não se limitando a:{' '}
            <strong className="text-primary">Supabase</strong> (banco de dados PostgreSQL,
            autenticação e armazenamento), <strong className="text-primary">Vercel</strong>{' '}
            (hospedagem em nuvem e rede de borda), <strong className="text-primary">Resend / Google SMTP</strong>{' '}
            (disparo transacional de e-mails) e <strong className="text-primary">Spotify API</strong>{' '}
            (incorporação de mídia de áudio). O Operador não se responsabiliza por instabilidades,
            interrupções ou alterações políticas originadas exclusivamente nos servidores desses
            provedores externos.
          </p>
          <p>
            <strong>9.2. Exclusão de Danos Indiretos:</strong> Na extensão máxima permitida pela
            legislação aplicável, em nenhuma hipótese o Operador será responsável por danos
            indiretos, incidentais, lucros cessantes, perda de dados decorrente de mau uso pelo
            próprio Usuário ou falhas de conexão de internet do dispositivo do Usuário.
          </p>
        </section>

        {/* Cláusula 10 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            10. Da Privacidade e Proteção de Dados Pessoais (LGPD)
          </h2>
          <p>
            O tratamento de dados pessoais realizado no âmbito da Plataforma observa rigorosamente os
            princípios e bases legais da{' '}
            <strong className="text-primary">
              Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)
            </strong>
            . As regras detalhadas sobre coleta, finalidade, retenção, segurança da informação,
            cookies e exercício dos direitos do titular encontram-se descritas em nossa{' '}
            <Link href="/privacidade" className="text-accent font-semibold hover:underline">
              Política de Privacidade
            </Link>
            , que integra o presente contrato para todos os fins de direito.
          </p>
        </section>

        {/* Cláusula 11 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            11. Das Alterações Contratuais e Disposições Gerais
          </h2>
          <p>
            <strong>11.1. Atualizações dos Termos:</strong> Este instrumento poderá ser revisto e
            atualizado periodicamente para refletir melhorias operacionais, novos recursos comerciais
            ou alterações legislativas. As revisões entrarão em vigor imediatamente após sua
            publicação nesta página e divulgação no{' '}
            <Link href="/notificacoes" className="text-accent font-semibold hover:underline">
              Mural Oficial
            </Link>{' '}
            da Plataforma. A continuidade do uso dos Serviços após a atualização constituirá
            concordância tácita com os novos termos.
          </p>
          <p>
            <strong>11.2. Independência das Cláusulas e Não Novação:</strong> Caso qualquer
            disposição destes Termos seja considerada nula, inválida ou inexequível por autoridade
            competente, as demais cláusulas permanecerão em pleno vigor e efeito. A eventual
            tolerância quanto ao descumprimento de qualquer obrigação não importará em renúncia de
            direito, novação ou alteração tácita do contrato.
          </p>
        </section>

        {/* Cláusula 12 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-primary border-b border-border/60 pb-1.5">
            12. Da Legislação Aplicável, Foro e Canal de Notificações
          </h2>
          <p>
            <strong>12.1. Regência Legal:</strong> Estes Termos são regidos e interpretados
            exclusivamente em conformidade com as leis da{' '}
            <strong className="text-primary">República Federativa do Brasil</strong>, em especial o
            Código Civil (Lei nº 10.406/2002), o Marco Civil da Internet (Lei nº 12.965/2014) e a
            LGPD (Lei nº 13.709/2018).
          </p>
          <p>
            <strong>12.2. Eleição de Foro:</strong> Para dirimir quaisquer controvérsias, dúvidas ou
            litígios oriundos deste instrumento que não possam ser solucionados de forma amigável, as
            partes elegem o foro da{' '}
            <strong className="text-primary">
              Comarca de Rio Paranaíba, Estado de Minas Gerais
            </strong>
            , com renúncia expressa a qualquer outro, por mais privilegiado que seja, ressalvadas as
            hipóteses de competência legal absoluta.
          </p>

          {/* Card de Contato Oficial */}
          <div className="mt-4 p-4 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-accent" /> Canal Oficial de Jurídico, Compliance e
                Suporte
              </div>
              <p className="text-xs text-muted">
                Para dúvidas contratuais, notificações extrajudiciais ou solicitações relativas a
                direitos autorais e dados pessoais:
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