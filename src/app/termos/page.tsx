import Link from 'next/link';
import { ArrowLeft, Calendar, Shield, CheckCircle2 } from 'lucide-react';

export default function TermosPage() {
  return (
    <div className="p-6 space-y-6 text-sm leading-relaxed">
      <Link
        href="/config"
        className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Configurações</span>
      </Link>

      <header className="border-b border-border pb-4 space-y-2">
        <h1 className="text-2xl font-extrabold text-primary">Termos e Condições de Uso</h1>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Última atualização: Agosto de 2026
          </span>
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Versão 1.0
          </span>
        </div>
      </header>

      <div className="p-4 rounded-r-xl bg-surface border-l-4 border-accent text-xs sm:text-sm text-secondary">
        Bem-vindo ao <strong className="text-primary">Insight (Post it)</strong>! Ao acessar ou
        utilizar nossa plataforma, você concorda expressa e integralmente com estes Termos de Uso.
        Recomendamos a leitura atenta deste documento, pois ele estabelece os direitos e obrigações
        entre você (usuário) e o mantenedor da plataforma.
      </div>

      <div className="space-y-6 text-secondary">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">1. Aceitação e Objeto</h2>
          <p>
            Estes Termos e Condições de Uso regulam o acesso e a utilização da plataforma web{' '}
            <strong className="text-primary">Insight (Post it)</strong>, voltada ao
            compartilhamento de conhecimentos, pensamentos, mídias e interações sob a filosofia
            central de <em>&ldquo;apenas poste&rdquo;</em>.
          </p>
          <p>
            Ao navegar, publicar ou interagir na plataforma, você declara ter lido, compreendido e
            aceito estes Termos, bem como a nossa{' '}
            <Link href="/privacidade" className="text-accent font-semibold hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">
            2. Elegibilidade e Cadastro de Conta
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-primary">Idade Mínima:</strong> O serviço é destinado a
              pessoas com idade igual ou superior a 13 (treze) anos.
            </li>
            <li>
              <strong className="text-primary">Veracidade dos Dados:</strong> Você se compromete a
              fornecer informações verdadeiras, exatas e atualizadas em seu perfil.
            </li>
            <li>
              <strong className="text-primary">Segurança da Conta:</strong> O usuário é responsável
              pela confidencialidade de suas credenciais de acesso.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">
            3. Diretrizes de Conduta e Uso Aceitável
          </h2>
          <p>
            Ao utilizar a plataforma, você concorda expressamente em{' '}
            <strong className="text-primary">NÃO</strong> praticar discurso de ódio, discriminação,
            assédio, envio de conteúdo ilícito, violação de direitos autorais, spam/automação não
            autorizada, ataques técnicos (como SQLi, XSS ou DDoS) ou falsidade ideológica.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-primary">
            4. Propriedade Intelectual e Licenciamento
          </h2>
          <div className="p-4 rounded-xl bg-surface border border-accent/30 space-y-1">
            <h3 className="text-xs font-bold text-accent flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Titularidade do Usuário
            </h3>
            <p className="text-xs text-secondary">
              Você retém a propriedade integral de todos os direitos autorais e intelectuais sobre
              as postagens, textos, comentários e imagens que publica na plataforma.
            </p>
          </div>
          <p>
            O código-fonte, marcas, logotipos, layout e elementos gráficos são de propriedade
            exclusiva do mantenedor do projeto e protegidos pela legislação de propriedade
            intelectual.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">
            5. Moderação de Conteúdo e Encerramento
          </h2>
          <p>
            A plataforma reserva-se o direito de remover ou restringir o acesso a qualquer
            postagem ou conta que viole estes Termos ou a legislação vigente.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">
            6. Integrações e Serviços de Terceiros
          </h2>
          <p>
            A plataforma utiliza serviços de terceiros para seu pleno funcionamento, incluindo
            infraestrutura de banco de dados e autenticação via{' '}
            <strong className="text-primary">Supabase</strong> e reprodutores de áudio integrados
            via <strong className="text-primary">Spotify API</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">7. Limitação de Responsabilidade</h2>
          <p>
            A plataforma é disponibilizada no estado em que se encontra (<em>&ldquo;AS IS&rdquo;</em>
            ), atuando nos termos do{' '}
            <strong className="text-primary">Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">8. Alterações destes Termos</h2>
          <p>
            Estes Termos podem ser atualizados periodicamente, sendo as revisões comunicadas no
            Mural de Atualizações da plataforma.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-primary">9. Legislação Aplicável e Foro</h2>
          <p>
            Estes Termos são regidos pelas leis da{' '}
            <strong className="text-primary">República Federativa do Brasil</strong>, em especial o
            Código Civil, o Marco Civil da Internet e a LGPD (Lei nº 13.709/2018).
          </p>
        </section>
      </div>
    </div>
  );
}