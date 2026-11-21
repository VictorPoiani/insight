import type { NewsTopicId } from './topics';

export interface NewsSource {
  id: string;
  name: string;
  /** página principal (ícone e crédito) */
  home: string;
  url: string;
  kind: 'rss' | 'tabnews' | 'gnews';
  topics: NewsTopicId[];
  /** peso de confiança/qualidade da fonte no ranking (0.8–1.2) */
  weight?: number;
  lang?: 'pt' | 'en';
}

/** Busca do Google News (agrega os grandes portais) para temas sem feed próprio bom. */
const gnews = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

export const NEWS_SOURCES: NewsSource[] = [
  // ---- portais gerais
  { id: 'g1-tecnologia', name: 'g1', home: 'https://g1.globo.com', url: 'https://g1.globo.com/rss/g1/tecnologia/', kind: 'rss', topics: ['tecnologia'], weight: 1.15 },
  { id: 'g1-ciencia', name: 'g1', home: 'https://g1.globo.com', url: 'https://g1.globo.com/rss/g1/ciencia-e-saude/', kind: 'rss', topics: ['ciencia'], weight: 1.15 },
  { id: 'g1-economia', name: 'g1', home: 'https://g1.globo.com', url: 'https://g1.globo.com/rss/g1/economia/', kind: 'rss', topics: ['economia'], weight: 1.1 },
  { id: 'g1-mundo', name: 'g1', home: 'https://g1.globo.com', url: 'https://g1.globo.com/rss/g1/mundo/', kind: 'rss', topics: ['mundo'], weight: 1.1 },
  { id: 'g1-politica', name: 'g1', home: 'https://g1.globo.com', url: 'https://g1.globo.com/rss/g1/politica/', kind: 'rss', topics: ['politica', 'brasil'], weight: 1.05 },
  { id: 'g1-pop', name: 'g1', home: 'https://g1.globo.com', url: 'https://g1.globo.com/rss/g1/pop-arte/', kind: 'rss', topics: ['cultura-pop'], weight: 1.05 },
  { id: 'ge', name: 'ge', home: 'https://ge.globo.com', url: 'https://ge.globo.com/rss/ge/', kind: 'rss', topics: ['esportes'], weight: 1.1 },
  { id: 'bbc-brasil', name: 'BBC News Brasil', home: 'https://www.bbc.com/portuguese', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml', kind: 'rss', topics: ['mundo'], weight: 1.15 },
  { id: 'folha', name: 'Folha de S.Paulo', home: 'https://www.folha.uol.com.br', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', kind: 'rss', topics: ['brasil'], weight: 1.1 },
  { id: 'cnn-brasil', name: 'CNN Brasil', home: 'https://www.cnnbrasil.com.br', url: 'https://www.cnnbrasil.com.br/feed/', kind: 'rss', topics: ['brasil'], weight: 1.0 },
  // ---- tecnologia
  { id: 'tecnoblog', name: 'Tecnoblog', home: 'https://tecnoblog.net', url: 'https://tecnoblog.net/feed/', kind: 'rss', topics: ['tecnologia'], weight: 1.1 },
  { id: 'canaltech', name: 'Canaltech', home: 'https://canaltech.com.br', url: 'https://canaltech.com.br/rss/', kind: 'rss', topics: ['tecnologia'], weight: 1.0 },
  { id: 'olhar-digital', name: 'Olhar Digital', home: 'https://olhardigital.com.br', url: 'https://olhardigital.com.br/feed/', kind: 'rss', topics: ['tecnologia'], weight: 1.0 },
  { id: 'tecmundo', name: 'TecMundo', home: 'https://www.tecmundo.com.br', url: 'https://rss.tecmundo.com.br/feed', kind: 'rss', topics: ['tecnologia'], weight: 1.0 },
  { id: 'the-verge', name: 'The Verge', home: 'https://www.theverge.com', url: 'https://www.theverge.com/rss/index.xml', kind: 'rss', topics: ['tecnologia'], weight: 0.95, lang: 'en' },
  { id: 'tabnews', name: 'TabNews', home: 'https://www.tabnews.com.br', url: 'https://www.tabnews.com.br/api/v1/contents?page=1&per_page=20&strategy=relevant', kind: 'tabnews', topics: ['dev', 'tecnologia'], weight: 1.0 },
  // ---- economia, games, cultura
  { id: 'infomoney', name: 'InfoMoney', home: 'https://www.infomoney.com.br', url: 'https://www.infomoney.com.br/feed/', kind: 'rss', topics: ['economia'], weight: 1.05 },
  { id: 'ign-brasil', name: 'IGN Brasil', home: 'https://br.ign.com', url: 'https://br.ign.com/feed.xml', kind: 'rss', topics: ['games'], weight: 1.05 },
  { id: 'jovem-nerd', name: 'Jovem Nerd', home: 'https://jovemnerd.com.br', url: 'https://jovemnerd.com.br/feed/', kind: 'rss', topics: ['cultura-pop'], weight: 1.0 },
  // ---- Google News por tema (os melhores portais para temas de nicho)
  { id: 'gn-ia', name: 'Google News', home: 'https://news.google.com', url: gnews('inteligência artificial'), kind: 'gnews', topics: ['ia'], weight: 0.95 },
  { id: 'gn-espaco', name: 'Google News', home: 'https://news.google.com', url: gnews('NASA OR SpaceX OR astronomia'), kind: 'gnews', topics: ['espaco'], weight: 0.95 },
  { id: 'gn-cripto', name: 'Google News', home: 'https://news.google.com', url: gnews('bitcoin OR criptomoedas'), kind: 'gnews', topics: ['cripto'], weight: 0.9 },
  { id: 'gn-seguranca', name: 'Google News', home: 'https://news.google.com', url: gnews('ataque hacker OR vazamento de dados OR cibersegurança'), kind: 'gnews', topics: ['seguranca'], weight: 0.9 },
  { id: 'gn-musica', name: 'Google News', home: 'https://news.google.com', url: gnews('música lançamento álbum show'), kind: 'gnews', topics: ['musica'], weight: 0.9 },
  { id: 'gn-cinema', name: 'Google News', home: 'https://news.google.com', url: gnews('filme série estreia Netflix'), kind: 'gnews', topics: ['cinema'], weight: 0.9 },
  { id: 'gn-futebol', name: 'Google News', home: 'https://news.google.com', url: gnews('futebol brasileirão'), kind: 'gnews', topics: ['futebol'], weight: 0.9 },
  { id: 'gn-games', name: 'Google News', home: 'https://news.google.com', url: gnews('games lançamento PlayStation Xbox Nintendo'), kind: 'gnews', topics: ['games'], weight: 0.9 },
  { id: 'gn-saude', name: 'Google News', home: 'https://news.google.com', url: gnews('saúde pesquisa medicina'), kind: 'gnews', topics: ['saude'], weight: 0.9 },
];
