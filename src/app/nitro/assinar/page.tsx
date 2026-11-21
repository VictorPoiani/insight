'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  FontItem,
  FrameItem,
  IntroItem,
  NITRO_BUNDLES,
  NITRO_ITEMS,
  getNitroItem,
  TagItem,
  ThemeItem,
  TitleItem,
} from '@/lib/nitro/catalog';
import { ThemeMiniature } from '@/components/nitro/ThemeMiniature';
import { useNitro } from '@/components/nitro/NitroProvider';
import { FramePreview, NameFont, NitroBadge, TagPill, TitleText } from '@/components/nitro/Cosmetics';
import { IntroOverlay } from '@/components/nitro/ProfileIntro';
import { InsightAsterisk } from '@/components/brand/InsightAsterisk';
import { NITRO_PRICE_BRL, describeNitroSource } from '@/lib/nitro/entitlement';
import './assinar.css';

const PRICE = NITRO_PRICE_BRL.toFixed(2).replace('.', ',');

const nitroOnly = <T extends { requirement: { type: string } }>(i: T) => i.requirement.type === 'nitro';
const FRAMES = NITRO_ITEMS.filter((i): i is FrameItem => i.kind === 'frame' && nitroOnly(i));
const TITLES = NITRO_ITEMS.filter((i): i is TitleItem => i.kind === 'title' && nitroOnly(i));
const TAGS = NITRO_ITEMS.filter((i): i is TagItem => i.kind === 'tag' && nitroOnly(i));
const INTROS = NITRO_ITEMS.filter((i): i is IntroItem => i.kind === 'intro' && nitroOnly(i));
const THEMES = NITRO_ITEMS.filter((i): i is ThemeItem => i.kind === 'theme');
const FONTS = NITRO_ITEMS.filter((i): i is FontItem => i.kind === 'font');

/** Troca o índice a cada `ms` (pausado com movimento reduzido). */
function useCycle(length: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % length), ms);
    return () => clearInterval(t);
  }, [length, ms]);
  return i;
}

/** Revela o bloco ao entrar na tela. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    // threshold 0: blocos largos/altos (ou maiores que a tela) também aparecem
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    // garantia: nada fica invisível se o observador não disparar
    const t = setTimeout(() => setShown(true), 2500);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return (
    <div ref={ref} className={`na-reveal ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Perk({
  title,
  text,
  stat,
  preview,
  wide,
  soon,
}: {
  title: string;
  text: string;
  stat?: string;
  preview: ReactNode;
  wide?: boolean;
  soon?: boolean;
}) {
  return (
    <div className={`na-perk ${wide ? 'na-perk--wide' : ''}`}>
      <div className="na-perk-stage">{preview}</div>
      <div className="na-perk-body">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="na-perk-title">{title}</h3>
          {stat && <span className="na-chip">{stat}</span>}
          {soon && <span className="na-chip na-chip--soon">Em breve</span>}
        </div>
        <p className="na-perk-text">{text}</p>
      </div>
    </div>
  );
}

const AVATAR = '/assets/net/default-perfil';

export default function NitroCheckoutPage() {
  const { viewer, hasAccess, entitlement } = useNitro();
  const [testing, setTesting] = useState<IntroItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const frameI = useCycle(FRAMES.length, 2200);
  const titleI = useCycle(TITLES.length, 1800);
  const introI = useCycle(INTROS.length, 2600);
  const themeI = useCycle(THEMES.length, 2400);
  const fontI = useCycle(FONTS.length, 1700);
  const avatar = viewer?.avatar_url || AVATAR;
  const name = viewer?.display_name || viewer?.full_name || viewer?.username || 'Seu nome';

  const tagRows = useMemo(() => {
    const half = Math.ceil(TAGS.length / 2);
    return [TAGS.slice(0, half), TAGS.slice(half)];
  }, []);

  const frame = FRAMES[frameI];
  const title = TITLES[titleI];
  const intro = INTROS[introI];

  return (
    <div className="na-page">
      {/* Fundo: gradiente vivo (só transform/opacity) */}
      <div aria-hidden className="na-bg">
        <span className="na-blob na-blob--a" />
        <span className="na-blob na-blob--b" />
        <span className="na-blob na-blob--c" />
        <span className="na-grain" />
      </div>

      {/* Faixa "Em breve" */}
      <div className="na-soon" role="status">
        <span className="na-soon-track">
          {Array.from({ length: 2 }, (_, k) => (
            <span key={k} className="na-soon-run">
              {['Em breve', 'Seu perfil está prestes a ganhar superpoderes', 'Em breve', 'O próximo nível do Insight* está carregando'].map(
                (t, i) => (
                  <span key={i} className="na-soon-item">
                    <span className="na-soon-star">✦</span> {t}
                  </span>
                )
              )}
            </span>
          ))}
        </span>
      </div>

      <div className="na-wrap">
        <Link href="/nitro" className="na-back">
          <ArrowLeft className="w-4 h-4" /> Galeria
        </Link>

        {/* HERO */}
        <section className="na-hero">
          <div className="na-hero-copy">
            <p className="na-eyebrow">
              <NitroBadge size={18} /> Insight Nitro
            </p>
            <h1 className="na-h1">
              <span className="na-nowrap">Destaque-se.</span>
              <br />
              <span className="na-h1-grad na-nowrap">Seja inesquecível.</span>
            </h1>
            <p className="na-lead">
              Molduras animadas, aberturas de perfil cinematográficas, temas para o app inteiro, estilos de nome,
              tags ilustradas e o Insight* em Rainbow. Tudo isso por menos que um café.
            </p>

            <div className="na-price">
              <span className="na-price-cur">R$</span>
              <span className="na-price-val">{PRICE}</span>
              <span className="na-price-per">/mês</span>
            </div>
            <p className="na-price-note">Cancele quando quiser · grátis para sempre no Nível 5 (Grão-Mestre)</p>

            <div className="na-ctas">
              {hasAccess ? (
                <Link href="/nitro" className="na-btn na-btn--primary">
                  Abrir minha galeria
                </Link>
              ) : (
                <button
                  type="button"
                  className="na-btn na-btn--primary"
                  aria-disabled="true"
                  onClick={() => setNotice('A assinatura abre em breve. Enquanto isso, experimente tudo no provador!')}
                >
                  <span className="na-btn-glint" aria-hidden />
                  Assinar Nitro · em breve
                </button>
              )}
              <Link href="/nitro" className="na-btn na-btn--ghost">
                Experimentar no provador
              </Link>
            </div>
            {notice && <p className="na-notice">{notice}</p>}
            {hasAccess && <p className="na-notice">Seu acesso: {describeNitroSource(entitlement)}</p>}
          </div>

          {/* Cartão de perfil vivo */}
          <div className="na-hero-card">
            <div className="na-card-glow" aria-hidden />
            <div className="na-card">
              <div className="na-card-banner" />
              <div className="na-card-avatar">
                {frame && (
                  <FramePreview key={frame.id} frameId={frame.id} size={96} live>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar} alt="" className="w-24 h-24 rounded-full object-cover bg-neutral-800" />
                  </FramePreview>
                )}
              </div>
              <div className="na-card-body">
                <p className="na-card-name">
                  {title ? <TitleText key={title.id} title={title}>{name}</TitleText> : name}
                </p>
                <div className="na-card-tags">
                  <NitroBadge />
                  {TAGS[titleI % TAGS.length] && <TagPill key={TAGS[titleI % TAGS.length].id} tagId={TAGS[titleI % TAGS.length].id} />}
                </div>
                <p className="na-card-caption">
                  Moldura: <strong>{frame?.name}</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* BENEFÍCIOS */}
        <section className="na-section">
          <Reveal>
            <h2 className="na-h2">Tudo o que vem no Nitro</h2>
            <p className="na-sub">Só cosméticos e comunidade — sem pagar por espaço. Limites de upload continuam vindo do seu nível.</p>
          </Reveal>

          <div className="na-grid">
            <Reveal delay={0} className="na-span-2">
              <Perk
                wide
                title="Molduras animadas"
                stat={`${FRAMES.length} molduras`}
                text="Fogo, aurora, oceano, bichinhos ilustrados, Saturno com a lua orbitando… animadas no perfil e nas listas."
                preview={
                  <div className="na-frame-row">
                    {[0, 1, 2].map((k) => {
                      const f = FRAMES[(frameI + k * 3) % FRAMES.length];
                      return (
                        <FramePreview key={`${k}-${f.id}`} frameId={f.id} size={k === 1 ? 72 : 56} live>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatar}
                            alt=""
                            className="rounded-full object-cover bg-neutral-800"
                            style={{ width: k === 1 ? 72 : 56, height: k === 1 ? 72 : 56 }}
                          />
                        </FramePreview>
                      );
                    })}
                  </div>
                }
              />
            </Reveal>

            <Reveal delay={40} className="na-span-2">
              <Perk
                wide
                title="Temas de app"
                stat={`${THEMES.length} temas`}
                text="Mude as cores do Insight inteiro: Laranja Elétrico, Infernal, Mundo de Blocos, Café, Espacial, Soft Blue Clean e mais. Só você vê."
                preview={
                  <div className="na-theme-row">
                    {[0, 1, 2].map((k) => {
                      const t = THEMES[(themeI + k) % THEMES.length];
                      return (
                        <div key={`${k}-${t.id}`} className={`na-theme-card ${k === 1 ? 'is-main' : ''}`}>
                          <ThemeMiniature themeId={t.id} name={name} large={k === 1} />
                          <span className="na-theme-name">{t.name}</span>
                        </div>
                      );
                    })}
                  </div>
                }
              />
            </Reveal>

            <Reveal delay={60}>
              <Perk
                title="Estilos de nome"
                stat={`${FONTS.length} estilos`}
                text="Fonte em blocos de pixel, arcade 8-bit, neon retrô, gótica, gibi… e combina com o seu Título."
                preview={
                  <span className="na-font-demo">
                    {FONTS[fontI] && (
                      <NameFont key={FONTS[fontI].id} font={FONTS[fontI]}>
                        {name}
                      </NameFont>
                    )}
                    <small>{FONTS[fontI]?.name}</small>
                  </span>
                }
              />
            </Reveal>

            <Reveal delay={80}>
              <Perk
                title="Aberturas de perfil"
                stat={`${INTROS.length} cenas`}
                text="Monstro à espreita, garra de onça, tsunami ukiyo-e, eclipse… toca quando alguém visita seu perfil."
                preview={
                  <button type="button" className="na-intro-btn" onClick={() => intro && setTesting(intro)}>
                    <span className="na-play" aria-hidden />
                    <span key={intro?.id} className="na-fade-in">
                      {intro?.name}
                    </span>
                  </button>
                }
              />
            </Reveal>

            <Reveal delay={120}>
              <Perk
                title="Títulos que brilham"
                stat={`${TITLES.length} efeitos`}
                text="Seu nome com brilho, fluxo, glitch ou chama em posts, respostas e perfil."
                preview={
                  <span className="na-title-demo">
                    {title && (
                      <TitleText key={title.id} title={title}>
                        {name}
                      </TitleText>
                    )}
                  </span>
                }
              />
            </Reveal>

            <Reveal delay={160} className="na-span-2">
              <Perk
                wide
                title="Tags ilustradas"
                stat={`${TAGS.length} tags`}
                text="Memes BR, K-Pop, filmes e música — cada tag com ícone desenhado e cenário animado."
                preview={
                  <div className="na-marquee">
                    {tagRows.map((row, r) => (
                      <div key={r} className={`na-marquee-row ${r ? 'na-marquee-row--rev' : ''}`}>
                        {[...row, ...row].map((t, i) => (
                          <TagPill key={`${t.id}-${i}`} tagId={t.id} />
                        ))}
                      </div>
                    ))}
                  </div>
                }
              />
            </Reveal>

            <Reveal delay={200}>
              <Perk
                title="Insight* em Rainbow"
                text="A logo e todos os asteriscos de carregamento em espectro. Liga e desliga nas configurações."
                preview={
                  <span className="ia-force-rainbow na-asterisk">
                    <InsightAsterisk />
                  </span>
                }
              />
            </Reveal>

            <Reveal delay={240}>
              <Perk
                title="Selo Nitro"
                text="Ao lado do seu nome em posts, respostas, notificações e no perfil."
                preview={
                  <span className="na-badge-demo">
                    <strong>{name}</strong> <NitroBadge size={20} />
                  </span>
                }
              />
            </Reveal>

            <Reveal delay={280}>
              <Perk
                title="Grupo VIP"
                text="Comunidade exclusiva no WhatsApp com quem apoia o Insight* de perto."
                preview={<span className="na-vip" aria-hidden>VIP</span>}
              />
            </Reveal>

            <Reveal delay={320}>
              <Perk
                title="Mais IA"
                soon
                text="Limites maiores nos recursos de IA quando eles chegarem."
                preview={<span className="na-ai" aria-hidden />}
              />
            </Reveal>
          </div>
        </section>

        {/* SUPER PACOTE */}
        {(() => {
          const b = NITRO_BUNDLES.find((x) => x.featured)!;
          const frameB = getNitroItem(b.items.frame, 'frame');
          const titleB = getNitroItem(b.items.title, 'title');
          const fontB = getNitroItem(b.items.font, 'font');
          const themeB = getNitroItem(b.items.theme, 'theme');
          const rows: [string, string | undefined][] = [
            ['Moldura', frameB?.name],
            ['Título exclusivo', titleB?.name],
            ['Tag exclusiva', getNitroItem(b.items.tag, 'tag')?.name],
            ['Abertura', getNitroItem(b.items.intro, 'intro')?.name],
            ['Estilo de nome', fontB?.name],
            ['Tema do app', themeB?.name],
          ];
          const nm = titleB ? <TitleText title={titleB}>{name}</TitleText> : name;
          return (
            <section className="na-section">
              <Reveal>
                <div className="na-bundle">
                  <div className="na-bundle-art">
                    {frameB && (
                      <FramePreview frameId={frameB.id} size={120} live>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatar} alt="" className="rounded-full object-cover bg-neutral-800" style={{ width: 120, height: 120 }} />
                      </FramePreview>
                    )}
                  </div>
                  <div className="na-bundle-copy">
                    <p className="na-eyebrow">Super Pacote de boas-vindas</p>
                    <h2 className="na-h2">Um de cada, assim que liberar o Nitro</h2>
                    <p className="na-sub">{b.tagline}</p>
                    <div className="na-bundle-name">
                      {fontB ? <NameFont font={fontB}>{nm}</NameFont> : nm}
                      <TagPill tagId={b.items.tag} />
                    </div>
                    <ul className="na-bundle-list">
                      {rows.map(([k, v]) => (
                        <li key={k}>
                          <span>{k}</span>
                          <strong>{v}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {themeB && (
                    <div className="na-bundle-theme">
                      <ThemeMiniature themeId={themeB.id} name={name} large />
                    </div>
                  )}
                </div>
              </Reveal>
            </section>
          );
        })()}

        {/* COMPARATIVO */}
        <section className="na-section">
          <Reveal>
            <h2 className="na-h2">Escolha como chegar lá</h2>
          </Reveal>
          <div className="na-plans">
            <Reveal className="na-plan">
              <p className="na-plan-name">Gratuito</p>
              <p className="na-plan-price">R$ 0</p>
              <ul>
                <li>Galeria e provador liberados</li>
                <li>Molduras de patente do seu nível</li>
                <li className="is-off">Itens Nitro no perfil</li>
                <li className="is-off">Selo, Rainbow e grupo VIP</li>
              </ul>
            </Reveal>
            <Reveal delay={80} className="na-plan na-plan--hot">
              <span className="na-plan-flag">Mais popular</span>
              <p className="na-plan-name">
                <NitroBadge size={16} /> Nitro
              </p>
              <p className="na-plan-price">
                R$ {PRICE}
                <small>/mês</small>
              </p>
              <ul>
                <li>Galeria completa de cosméticos</li>
                <li>Super Pacote com título e tag exclusivos</li>
                <li>{THEMES.length} temas de app e {FONTS.length} estilos de nome</li>
                <li>Selo Nitro e Rainbow</li>
                <li>Grupo VIP no WhatsApp</li>
                <li>Mais IA (em breve)</li>
              </ul>
              <span className="na-plan-soon">Em breve</span>
            </Reveal>
            <Reveal delay={160} className="na-plan na-plan--gold">
              <p className="na-plan-name">Nível 5 · Grão-Mestre</p>
              <p className="na-plan-price">
                Vitalício<small> · grátis</small>
              </p>
              <ul>
                <li>Tudo do Nitro, para sempre</li>
                <li>2 GB de anexos por post</li>
                <li>Moldura singularity e abertura de patente</li>
              </ul>
              <Link href="/apoie" className="na-plan-link">
                Ver níveis de contribuinte →
              </Link>
            </Reveal>
          </div>
        </section>

        <p className="na-foot">
          O Nitro é só cosmético: limites de upload, criação de tópicos e comunidades vêm dos Níveis de Contribuinte.
        </p>
      </div>

      {testing && <IntroOverlay intro={testing} onDone={() => setTesting(null)} />}
    </div>
  );
}
