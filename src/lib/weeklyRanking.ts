/** Ranking semanal de contribuição: textos automáticos do card de domingo. */

export interface RankRow {
  key: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  points: number;
  rank: number;
  prev_rank: number | null;
}
export interface Leader {
  week: number;
  key: string;
  name: string;
}
export interface WeeklyRanking {
  top: RankRow[];
  leaders: Leader[];
}

export const TZ = 'America/Sao_Paulo';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Hoje é domingo no horário de Brasília? */
export function isSundayInBrazil(now = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now) === 'Sun';
}

/** Manchete do topo: sequência, hegemonia quebrada, pódio recuperado. */
export function headline(data: WeeklyRanking): string | null {
  const byWeek = new Map(data.leaders.map((l) => [l.week, l]));
  const cur = byWeek.get(0);
  if (!cur) return null;
  const leaderName = first(cur.name);

  let streak = 0;
  while (byWeek.get(streak)?.key === cur.key) streak++;

  const prev = byWeek.get(1);
  if (!prev) return `${leaderName} inaugura o ranking de contribuição no topo!`;

  if (streak >= 2) {
    if (streak === 2) return `${leaderName} segura o topo pela segunda semana seguida!`;
    return `${leaderName} está há ${streak} semanas no topo do ranking!`;
  }

  // troca de líder nesta semana
  let prevStreak = 0;
  while (byWeek.get(1 + prevStreak)?.key === prev.key) prevStreak++;
  const prevName = first(prev.name);
  const ledBefore = data.leaders.some((l) => l.week > 1 && l.key === cur.key);

  if (ledBefore) {
    return prevStreak >= 2
      ? `${leaderName} recuperou o pódio e encerrou ${plural(prevStreak, 'semana', 'semanas')} de reinado de ${prevName}!`
      : `${leaderName} recuperou o pódio!`;
  }
  return prevStreak >= 2
    ? `${leaderName} quebrou a hegemonia de ${plural(prevStreak, 'semana', 'semanas')} de ${prevName}!`
    : `${leaderName} tomou o topo de ${prevName}!`;
}

/** Frase curta de movimento para cada posição. */
export function movement(r: RankRow): { text: string; dir: 'up' | 'down' | 'same' | 'new' } {
  if (r.prev_rank == null) return { text: 'estreou no ranking', dir: 'new' };
  const d = r.prev_rank - r.rank;
  if (d > 0) return { text: `subiu ${plural(d, 'posição', 'posições')}`, dir: 'up' };
  if (d < 0) return { text: `caiu ${plural(-d, 'posição', 'posições')}`, dir: 'down' };
  return { text: r.rank === 1 ? 'mantém a coroa' : `segue firme em ${r.rank}º`, dir: 'same' };
}

