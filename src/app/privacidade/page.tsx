import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacidadePage() {
  return (
    <div className="p-6 space-y-6 text-sm leading-relaxed">
      <Link
        href="/config"
        className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar às Configurações</span>
      </Link>

      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-primary">Política de Privacidade</h1>
        <p className="text-xs text-muted mt-1">Última atualização: Agosto de 2026</p>
      </header>

      <div className="space-y-5 text-secondary">
        <p>
          Esta Política de Privacidade descreve como o{' '}
          <strong className="text-primary">Insight (Post it)</strong> coleta, usa e protege as
          informações pessoais dos usuários ao utilizar nossa plataforma.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">1. Informações Coletadas</h2>
          <p>
            Para proporcionar uma experiência completa de rede comunitária, podemos coletar os
            seguintes dados:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-primary">Dados de Perfil:</strong> Nome de exibição,
              alcunha/apelido, biografia, localização, data de aniversário, imagem de avatar e
              capa.
            </li>
            <li>
              <strong className="text-primary">Conteúdo Publicado:</strong> Textos, postagens,
              respostas e anexos enviados espontaneamente pelo usuário.
            </li>
            <li>
              <strong className="text-primary">Preferências do Usuário:</strong> Configurações de
              tema (claro/escuro), tamanho de fonte e preferências de acessibilidade armazenadas
              localmente ou salvas na conta.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">
            2. Finalidade do Tratamento dos Dados
          </h2>
          <p>Os dados coletados são utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Exibir seu perfil e suas publicações na comunidade.</li>
            <li>Personalizar a interface de acordo com suas preferências salvas.</li>
            <li>Garantir a segurança da plataforma e prevenir abusos ou fraudes.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">
            3. Compartilhamento e Armazenamento
          </h2>
          <p>
            Seus dados são armazenados de forma segura utilizando infraestrutura moderna de banco
            de dados (Supabase). Não vendemos nem compartilhamos seus dados pessoais com terceiros
            para fins comerciais ou publicitários.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">4. Seus Direitos (LGPD)</h2>
          <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem o direito de:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Acessar e atualizar seus dados a qualquer momento através da seção de edição de
              perfil.
            </li>
            <li>
              Solicitar a exclusão permanente da sua conta e de todos os seus dados associados de
              nossos servidores.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">5. Contato</h2>
          <p>
            Para dúvidas sobre estes termos ou solicitações relativas aos seus dados pessoais,
            entre em contato com a administração pelo perfil oficial da plataforma.
          </p>
        </section>
      </div>
    </div>
  );
}