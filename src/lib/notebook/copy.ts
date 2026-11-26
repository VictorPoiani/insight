/**
 * Nome e textos de marca do Notebook num lugar só.
 * O nome ainda pode mudar: troque aqui e todo o site acompanha.
 */
export const NOTEBOOK_NAME = 'My Notebook';
/** forma curta (botões, trilhas) */
export const NOTEBOOK_SHORT = 'Notebook';

/**
 * Recursos do Notebook que ainda estão em Preview (só aparecem para quem já
 * acessa o Notebook, hoje a equipe). Desligar aqui volta ao comportamento antigo.
 */
export const NOTEBOOK_FEATURES = {
  /** ficha de personagem interativa (perfis, trajetória e entrevista) */
  characterSheet: true,
} as const;
