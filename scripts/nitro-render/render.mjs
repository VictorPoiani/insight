/**
 * Renderiza os efeitos de moldura do Insight Nitro (frames.glsl) em PNG.
 * Uso: node scripts/nitro-render/render.mjs <saida> [fx1,fx2,...] [quadros] [tamanho]
 * Depois: python3 scripts/nitro-render/assemble.py <saida> public/nitro/frames
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Playwright pode estar instalado globalmente (fora do package.json)
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';

const EFFECTS = {
  fire: 0, aurora: 1, electric: 2, ocean: 3, shadow: 4, spirit: 5,
  nebula: 6, magma: 7, frost: 8, gold: 9, neon: 10, sakura: 11, forest: 12,
  aura: 13, fireworks: 14, sapphire: 15, singularity: 16,
};

const [outDir = 'nitro-render-out', only, framesArg = '60', sizeArg = '1024'] = process.argv.slice(2);
const FRAMES = Number(framesArg);
const SIZE = Number(sizeArg);
const names = only ? only.split(',') : Object.keys(EFFECTS);
// shader: fonte única em src/lib/nitro/fxShader.ts (template literal FX_SHADER)
const tsSrc = fs.readFileSync(new URL('../../src/lib/nitro/fxShader.ts', import.meta.url), 'utf8');
const frag = tsSrc.split('export const FX_SHADER = `')[1].split('`;')[0];

const html = `<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas><script>
const c = document.getElementById('c');
const gl = c.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
  if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\\nin vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }'));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, ${JSON.stringify(frag)}));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const uRes = gl.getUniformLocation(prog, 'uRes'), uT = gl.getUniformLocation(prog, 'uT'), uFx = gl.getUniformLocation(prog, 'uFx');
window.draw = (fx, t) => {
  gl.viewport(0, 0, c.width, c.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uRes, c.width, c.height); gl.uniform1f(uT, t); gl.uniform1i(uFx, fx);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.finish();
  return c.toDataURL('image/png');
};
window.ready = true;
</script>`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => { console.error('ERRO NO SHADER:', e.message); process.exit(1); });
await page.setContent(html);
await page.waitForFunction('window.ready === true');

for (const name of names) {
  const fx = EFFECTS[name];
  if (fx === undefined) throw new Error('efeito desconhecido: ' + name);
  const dir = path.join(outDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < FRAMES; i++) {
    const url = await page.evaluate(([f, t]) => window.draw(f, t), [fx, i / FRAMES]);
    fs.writeFileSync(path.join(dir, String(i).padStart(3, '0') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(`${name}: ${FRAMES} quadros em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close();
