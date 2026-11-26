/**
 * Ficha de personagem (Preview).
 * Os dados ficam em item.data.character; o conteúdo em markdown (item.content)
 * é gerado a partir deles para busca, ligações [[ ]], contagem de palavras e publicação.
 */

export type CharacterRole = 'protagonista' | 'antagonista' | 'coadjuvante' | 'mentor' | 'figurante';

export const CHARACTER_ROLES: { id: CharacterRole; label: string }[] = [
  { id: 'protagonista', label: 'Protagonista' },
  { id: 'antagonista', label: 'Antagonista' },
  { id: 'coadjuvante', label: 'Coadjuvante' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'figurante', label: 'Figurante' },
];

export interface DiaryEntry {
  id: string;
  date: string; // AAAA-MM-DD
  text: string;
}

export interface CharacterData {
  v: 1;
  role?: CharacterRole | '';
  age?: string;
  intro?: string;
  quote?: string;
  avatarUrl?: string | null;
  avatarR2Key?: string | null;
  /** caderno do escritor */
  notes?: string;
  /** diário na voz do personagem */
  diary?: DiaryEntry[];
  profiles?: { physical?: string; psychological?: string; mixed?: string };
  backstory?: string;
  arc?: { start?: string; turn?: string; end?: string };
  /** respostas da entrevista: id da pergunta → resposta */
  answers?: Record<string, string>;
  /** perguntas criadas pelo próprio escritor */
  custom?: { id: string; group: string; text: string }[];
}

export interface InterviewGroup {
  id: string;
  title: string;
  hint: string;
  questions: { id: string; text: string }[];
}

/**
 * A entrevista: perguntas feitas ao personagem, respondidas na voz dele.
 * (Perguntas de cunho sexual e sobre matar ficaram de fora de propósito.)
 */
export const INTERVIEW: InterviewGroup[] = [
  {
    id: 'basico',
    title: 'O básico',
    hint: 'Quem ele é hoje, do nome ao que carrega nos bolsos.',
    questions: [
      { id: 'b1', text: 'Qual é o seu nome completo?' },
      { id: 'b2', text: 'Onde e quando você nasceu?' },
      { id: 'b3', text: 'Quem são seus pais? (nomes, profissões, personalidades)' },
      { id: 'b4', text: 'Você tem irmãos? Como eles são, ou eram?' },
      { id: 'b5', text: 'Onde você vive agora, e com quem? Descreva o lugar e a pessoa.' },
      { id: 'b6', text: 'Qual é a sua ocupação ou profissão?' },
      { id: 'b7', text: 'Descreva a si mesmo: altura, peso, cabelo, olhos, estilo de roupa, tatuagens, cicatrizes ou marcas.' },
      { id: 'b8', text: 'A que classe social você pertence?' },
      { id: 'b9', text: 'Tem alguma alergia, doença ou outra fraqueza física?' },
      { id: 'b10', text: 'É destro ou canhoto?' },
      { id: 'b11', text: 'Como é a sua voz? Como ela soa?' },
      { id: 'b12', text: 'Quais palavras ou frases você usa com frequência?' },
      { id: 'b13', text: 'O que você tem nos bolsos?' },
    ],
  },
  {
    id: 'crescendo',
    title: 'Crescendo',
    hint: 'A infância e o caminho até aqui.',
    questions: [
      { id: 'c1', text: 'Como você descreve a sua infância, no geral?' },
      { id: 'c2', text: 'Qual é a sua memória mais antiga?' },
      { id: 'c3', text: 'Qual é o seu grau de escolaridade?' },
      { id: 'c4', text: 'Gosta, ou gostava, da escola?' },
      { id: 'c5', text: 'Onde você aprendeu a maior parte das suas habilidades?' },
      { id: 'c6', text: 'Enquanto crescia, teve algum modelo a seguir? Descreva-o.' },
      { id: 'c7', text: 'Enquanto crescia, como se relacionava com o resto da família?' },
      { id: 'c8', text: 'Quando criança, o que queria ser quando crescesse?' },
      { id: 'c9', text: 'Quando criança, quais eram as suas atividades favoritas?' },
      { id: 'c10', text: 'Quando criança, que traços de personalidade você mostrava?' },
      { id: 'c11', text: 'Quando criança, você era popular? Quem eram seus amigos e como eles eram?' },
      { id: 'c12', text: 'Se você é um ser sobrenatural, conte como se tornou o que é.' },
    ],
  },
  {
    id: 'passado',
    title: 'Influência do passado',
    hint: 'O que ficou marcado e ainda pesa nas escolhas dele.',
    questions: [
      { id: 'p1', text: 'Qual você considera o evento mais importante da sua vida até agora?' },
      { id: 'p2', text: 'Quem teve a maior influência sobre você?' },
      { id: 'p3', text: 'O que você considera a sua maior conquista?' },
      { id: 'p4', text: 'Qual é o seu maior arrependimento?' },
      { id: 'p5', text: 'Qual foi a pior coisa que você já fez?' },
      { id: 'p6', text: 'Você tem registro criminal de qualquer tipo?' },
      { id: 'p7', text: 'Em que momento da vida você sentiu mais medo?' },
      { id: 'p8', text: 'Qual a coisa mais vergonhosa que já aconteceu com você?' },
      { id: 'p9', text: 'Se pudesse mudar algo no seu passado, o que seria, e por quê?' },
      { id: 'p10', text: 'Qual é a sua melhor memória?' },
      { id: 'p11', text: 'Qual é a sua pior memória?' },
    ],
  },
  {
    id: 'crencas',
    title: 'Crenças e opiniões',
    hint: 'O que ele acredita, teme e defende.',
    questions: [
      { id: 'o1', text: 'Você é otimista ou pessimista?' },
      { id: 'o2', text: 'Qual é o seu maior medo?' },
      { id: 'o3', text: 'Qual é a sua relação com a religião?' },
      { id: 'o4', text: 'Qual é a sua visão política?' },
      { id: 'o5', text: 'Na sua opinião, qual é a pior coisa que um ser humano pode fazer?' },
      { id: 'o6', text: 'Você acredita em almas gêmeas ou em amor verdadeiro?' },
      { id: 'o7', text: 'O que, para você, faz uma vida bem-sucedida?' },
      { id: 'o8', text: 'Quão honesto você é sobre o que pensa e sente? Você esconde quem é? De que forma?' },
      { id: 'o9', text: 'Você tem algum preconceito?' },
      { id: 'o10', text: 'Há algo que você se recusa a fazer sob qualquer circunstância? Por quê?' },
      { id: 'o11', text: 'Por quem, ou pelo quê, você iria ao extremo?' },
    ],
  },
];

export function groupQuestions(group: InterviewGroup, data: CharacterData) {
  return [...group.questions, ...(data.custom || []).filter((c) => c.group === group.id).map((c) => ({ id: c.id, text: c.text }))];
}

export function emptyCharacter(): CharacterData {
  return { v: 1, role: 'protagonista', diary: [], profiles: {}, arc: {}, answers: {}, custom: [] };
}

export function isCharacterData(v: unknown): v is CharacterData {
  return !!v && typeof v === 'object' && (v as CharacterData).v === 1;
}

/** Progresso de cada seção (0–1) para o índice. */
export function sectionProgress(d: CharacterData) {
  const filled = (...xs: (string | undefined | null)[]) => xs.filter((x) => (x || '').trim()).length / xs.length;
  const total = INTERVIEW.reduce((n, g) => n + groupQuestions(g, d).length, 0);
  const answered = Object.values(d.answers || {}).filter((a) => a.trim()).length;
  return {
    essencia: filled(d.intro, d.quote, d.age),
    cadernos: filled(d.notes, (d.diary || []).some((e) => e.text.trim()) ? 'x' : ''),
    perfis: filled(d.profiles?.physical, d.profiles?.psychological, d.profiles?.mixed),
    trajetoria: filled(d.backstory, d.arc?.start, d.arc?.turn, d.arc?.end),
    entrevista: total ? Math.min(1, answered / total) : 0,
  };
}

// --------------------------------------------------------------- markdown

/** Markdown da ficha (busca, ligações, contagem de palavras e publicação). */
export function characterToMarkdown(d: CharacterData): string {
  const out: string[] = ['---', `papel: ${d.role || ''}`, `idade: ${d.age || ''}`, 'tags: personagem', '---', ''];
  const sec = (title: string, body?: string) => {
    if (body && body.trim()) out.push(`## ${title}`, '', body.trim(), '');
  };
  if (d.quote?.trim()) out.push(`> ${d.quote.trim()}`, '');
  sec('Introdução', d.intro);
  sec('Notas do escritor', d.notes);
  const diary = (d.diary || []).filter((e) => e.text.trim());
  if (diary.length) {
    out.push('## Diário do personagem', '');
    for (const e of diary) out.push(`**${e.date.split('-').reverse().join('/')}** — ${e.text.trim()}`, '');
  }
  sec('Perfil físico', d.profiles?.physical);
  sec('Perfil psicológico', d.profiles?.psychological);
  sec('Perfil físico-psicológico', d.profiles?.mixed);
  sec('Backstory', d.backstory);
  const arc = [
    d.arc?.start?.trim() && `- Início: ${d.arc.start.trim()}`,
    d.arc?.turn?.trim() && `- Virada: ${d.arc.turn.trim()}`,
    d.arc?.end?.trim() && `- Fim: ${d.arc.end.trim()}`,
  ].filter(Boolean) as string[];
  if (arc.length) out.push('## Arco', '', ...arc, '');
  for (const g of INTERVIEW) {
    const qa = groupQuestions(g, d)
      .map((q) => ({ q, a: (d.answers || {})[q.id]?.trim() }))
      .filter((x) => x.a);
    if (!qa.length) continue;
    out.push(`## Entrevista · ${g.title}`, '');
    for (const { q, a } of qa) out.push(`**${q.text}**`, a!, '');
  }
  return out.join('\n').trimEnd() + '\n';
}

/**
 * Converte a ficha antiga (texto em markdown) para a ficha interativa.
 * Nada se perde: o que não tem campo próprio vai para as notas do escritor.
 */
export function markdownToCharacter(md: string): CharacterData {
  const d = emptyCharacter();
  let body = md || '';
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = body.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^\s*([\wÀ-ú]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      if (k === 'papel' && v) {
        const r = CHARACTER_ROLES.find((x) => x.id === v.toLowerCase());
        d.role = r ? r.id : 'coadjuvante';
        if (!r) d.intro = `Papel: ${v}`;
      } else if (k === 'idade') d.age = v;
    }
  }

  const sections: { title: string; text: string }[] = [];
  let cur = { title: '', text: '' };
  for (const line of body.split('\n')) {
    const h = line.match(/^#{1,3}\s+(.+)$/);
    if (h) {
      sections.push(cur);
      cur = { title: h[1].trim(), text: '' };
    } else cur.text += line + '\n';
  }
  sections.push(cur);

  // tira linhas de modelo vazias ("- Qualidades: ", "- [[ ]] — ", callouts de dica)
  const clean = (t: string) =>
    t
      .split('\n')
      .filter((l) => !/^\s*-\s*[^:]+:\s*$/.test(l) && !/^\s*-\s*\[\[\s*\]\]\s*—\s*$/.test(l) && !/^\s*>\s*\[!ideia\]/i.test(l))
      .join('\n')
      .trim();

  const extra: string[] = [];
  const add = (cur: string | undefined, t: string) => (cur ? `${cur}\n\n${t}` : t);
  for (const s of sections) {
    const t = clean(s.text);
    if (!t) continue;
    const k = s.title.toLowerCase();
    if (!s.title) d.intro = add(d.intro, t);
    else if (/apar[eê]ncia|f[ií]sic/.test(k) && !/psico/.test(k)) d.profiles = { ...d.profiles, physical: add(d.profiles?.physical, t) };
    else if (/personalidade|psicol/.test(k)) d.profiles = { ...d.profiles, psychological: add(d.profiles?.psychological, t) };
    else if (/arco/.test(k)) d.arc = { ...d.arc, start: add(d.arc?.start, t) };
    else if (/passado|backstory|hist[oó]ria/.test(k)) d.backstory = add(d.backstory, t);
    else if (/introdu/.test(k)) d.intro = add(d.intro, t);
    else extra.push(`${s.title}:\n${t}`);
  }
  if (extra.length) d.notes = extra.join('\n\n');
  return d;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
