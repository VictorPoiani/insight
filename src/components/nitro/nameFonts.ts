/**
 * Fontes dos Estilos de Nome (Insight Nitro). preload: false — o arquivo da
 * fonte só baixa quando algum nome usa o estilo.
 */
import {
  Bangers,
  Bungee,
  Caveat,
  Cinzel,
  Creepster,
  Monoton,
  Orbitron,
  Pacifico,
  Pixelify_Sans,
  Press_Start_2P,
  Rubik_Glitch,
  UnifrakturMaguntia,
} from 'next/font/google';

const pixel = Pixelify_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--nf-blocos' });
const arcade = Press_Start_2P({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-arcade' });
const orbit = Orbitron({ subsets: ['latin'], display: 'swap', preload: false, variable: '--nf-orbit' });
const cursiva = Pacifico({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-cursiva' });
const imperial = Cinzel({ subsets: ['latin'], display: 'swap', preload: false, variable: '--nf-imperial' });
const terror = Creepster({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-terror' });
const rua = Bungee({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-rua' });
const neon = Monoton({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-neon' });
const gibi = Bangers({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-gibi' });
const glitch = Rubik_Glitch({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-glitch' });
const gotica = UnifrakturMaguntia({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--nf-gotica' });
const manuscrito = Caveat({ subsets: ['latin'], display: 'swap', preload: false, variable: '--nf-manuscrito' });

/** Classes com as variáveis CSS das fontes (aplicadas no <html>). */
export const NAME_FONT_VARIABLES = [
  pixel, arcade, orbit, cursiva, imperial, terror, rua, neon, gibi, glitch, gotica, manuscrito,
]
  .map((f) => f.variable)
  .join(' ');
