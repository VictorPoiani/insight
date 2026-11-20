/**
 * Texturas estáticas das aberturas de perfil (fumaça, nuvens) + quadros grandes
 * de efeitos de moldura reaproveitados (anel de fogo do portal, vórtice).
 * Uso: node scripts/nitro-render/textures.mjs public/nitro/intro
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const outDir = process.argv[2] || 'public/nitro/intro';
fs.mkdirSync(outDir, { recursive: true });

const TEX = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform int uKind; uniform float uSeed;
out vec4 o;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 x){ vec2 i = floor(x), f = fract(x); vec2 u = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 x){ float v = 0., a = .5; for (int k = 0; k < 6; k++){ v += a*vn(x); x = x*2.03 + 1.7; a *= .5; } return v; }
void main(){
  vec2 p = gl_FragCoord.xy / uRes * 2. - 1.;
  vec2 s = vec2(uSeed * 7.1, uSeed * 3.3);
  float d = length(p * vec2(1., uKind == 0 ? 1. : 1.35));
  float w = fbm(p * 1.6 + s);
  float n = fbm(p * 2.6 + w * 1.2 + s);
  float dens = smoothstep(0.08, 0.62, n * 1.35 - d * 0.62 + 0.3) * smoothstep(1.0, 0.7, d);
  vec3 col; float a = dens;
  if (uKind == 0) {            // fumaça: violeta-escuro, volume suave (sem veias)
    float soft = smoothstep(0.0, 0.9, n * 1.2 - d * 0.75 + 0.35) * smoothstep(1.0, 0.65, d);
    dens = soft;
    a = soft * 0.92;
    col = mix(vec3(0.01, 0.0, 0.025), vec3(0.14, 0.04, 0.24), smoothstep(0.35, 0.8, n) * (1. - d * 0.6));
    col += vec3(0.3, 0.1, 0.55) * smoothstep(0.55, 0.85, w) * soft * 0.25;
  } else if (uKind == 1) {     // nuvem de tempestade: base escura, topo mais claro
    float top = clamp(p.y * 0.5 + 0.5, 0., 1.);
    col = mix(vec3(0.09, 0.11, 0.16), vec3(0.42, 0.47, 0.58), top * smoothstep(0.25, 0.85, n) + 0.15);
  } else {                     // nuvem iluminada por dentro (relâmpago)
    float core = smoothstep(0.9, 0.0, d) * smoothstep(0.2, 0.7, dens);
    col = mix(vec3(0.25, 0.3, 0.45), vec3(0.85, 0.92, 1.0), core);
    col += vec3(0.6, 0.75, 1.0) * core * core * 0.6;
    a = max(dens, core * 0.9);
  }
  o = vec4(col * a, a);
}`;

const html = `<canvas id="c" width="512" height="512"></canvas><script>
const c = document.getElementById('c');
const gl = c.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true });
function sh(t, s){ const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\\nin vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }'));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, ${JSON.stringify(TEX)}));
gl.linkProgram(prog); gl.useProgram(prog);
const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
const l = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
window.draw = (kind, seed) => { gl.viewport(0,0,512,512); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(gl.getUniformLocation(prog,'uRes'),512,512); gl.uniform1i(gl.getUniformLocation(prog,'uKind'),kind);
  gl.uniform1f(gl.getUniformLocation(prog,'uSeed'),seed); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); gl.finish(); return c.toDataURL('image/png'); };
</script>`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
await page.setContent(html);
const jobs = [
  ['smoke-a', 0, 1.0], ['smoke-b', 0, 4.2],
  ['cloud-a', 1, 2.0], ['cloud-b', 1, 6.5],
  ['cloud-lit-a', 2, 2.0], ['cloud-lit-b', 2, 6.5],
];
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'nitro-tex-'));
for (const [name, kind, seed] of jobs) {
  const url = await page.evaluate(([k, s]) => window.draw(k, s), [kind, seed]);
  const png = path.join(tmp, name + '.png');
  fs.writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync('python3', ['-c', `from PIL import Image; Image.open(${JSON.stringify(png)}).save(${JSON.stringify(path.join(outDir, name + '.webp'))}, quality=78, method=6, alpha_quality=80)`]);
  console.log(name, Math.round(fs.statSync(path.join(outDir, name + '.webp')).size / 1024) + ' KB');
}
await browser.close();
