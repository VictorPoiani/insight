/**
 * Shader dos efeitos de moldura do Insight Nitro (GLSL ES 3.0).
 * Fonte única: usado ao vivo no app (NitroFxCanvas) e offline por
 * scripts/nitro-render/render.mjs para gerar os WebP de listas e o quadro parado.
 */

export const FX_IDS = {
  fire: 0, aurora: 1, electric: 2, ocean: 3, shadow: 4, spirit: 5,
  nebula: 6, magma: 7, frost: 8, gold: 9, neon: 10, sakura: 11, forest: 12,
} as const;

/** Duração do loop (a mesma dos WebP pré-renderizados). */
export const FX_LOOP_MS = 2500;

export const FX_SHADER = `#version 300 es
// ============================================================================
// Insight Nitro — efeitos procedurais das molduras (renderizados offline).
// Canvas = 1.0 de largura; avatar = círculo central de raio R (metade do canvas).
// uT ∈ [0,1): fase do loop. Todo ruído é periódico no ângulo e no tempo, e o
// fluxo radial usa duas fases cruzadas — o último quadro emenda no primeiro.
// Saída em alfa pré-multiplicado.
// ============================================================================
precision highp float;

uniform vec2 uRes;
uniform float uT;
uniform int uFx;
out vec4 outColor;

const float TAU = 6.28318530718;
const float PI = 3.14159265359;
const float R = 0.25;

// ---------------------------------------------------------------- ruído
float h31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float h11(float x) { return h31(vec3(x, x * 1.37 + 3.1, 5.7)); }
vec2 h22(vec2 p) { return vec2(h31(vec3(p, 1.7)), h31(vec3(p, 9.2))); }

// value noise 3D periódico em x (px) e z (pz)
float vn(vec3 x, float px, float pz) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, px), x1 = mod(i.x + 1.0, px);
  float z0 = mod(i.z, pz), z1 = mod(i.z + 1.0, pz);
  float a = h31(vec3(x0, i.y, z0));
  float b = h31(vec3(x1, i.y, z0));
  float c = h31(vec3(x0, i.y + 1.0, z0));
  float d = h31(vec3(x1, i.y + 1.0, z0));
  float e = h31(vec3(x0, i.y, z1));
  float f2 = h31(vec3(x1, i.y, z1));
  float g = h31(vec3(x0, i.y + 1.0, z1));
  float hh = h31(vec3(x1, i.y + 1.0, z1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f2, u.x), mix(g, hh, u.x), u.y), u.z);
}

float fbm(vec3 x, float px, float pz) {
  float v = 0.0, amp = 0.5;
  for (int k = 0; k < 6; k++) {
    v += amp * vn(x, px, pz);
    x *= 2.0; px *= 2.0; pz *= 2.0; amp *= 0.5;
  }
  return v;
}

// Fluxo em duas fases (loop sem emenda): desloca uv por vel ao longo do loop.
float flowFbm(vec2 uv, vec2 vel, float px, float pz) {
  float t0 = fract(uT);
  float t1 = fract(uT + 0.5);
  float n0 = fbm(vec3(uv - vel * t0, uT * pz), px, pz);
  float n1 = fbm(vec3(uv - vel * t1 + vec2(0.0, 17.3), uT * pz), px, pz);
  float w0 = 1.0 - abs(2.0 * t0 - 1.0);
  float n = n0 * w0 + n1 * (1.0 - w0);
  // recupera o contraste perdido na mistura
  return clamp((n - 0.5) * (1.0 + 0.45 * (1.0 - abs(2.0 * w0 - 1.0))) + 0.5, 0.0, 1.0);
}

float gauss(float x, float w) { return exp(-(x * x) / (w * w)); }

// distância angular normalizada (0..0.5)
float angDist(float a, float b) { float d = abs(fract(a - b + 0.5) - 0.5); return d; }

vec4 over(vec4 top, vec4 base) { return top + base * (1.0 - top.a); }

// paleta de calor: preto → c0 → c1 → c2 → c3
vec3 heatRamp(float h, vec3 c0, vec3 c1, vec3 c2, vec3 c3) {
  vec3 col = mix(vec3(0.0), c0, smoothstep(0.0, 0.25, h));
  col = mix(col, c1, smoothstep(0.25, 0.5, h));
  col = mix(col, c2, smoothstep(0.5, 0.75, h));
  col = mix(col, c3, smoothstep(0.78, 1.0, h));
  return col;
}

// partículas que se afastam do anel (brasas, respingos)
float risingSparks(vec2 p, float cells, float reach, float seed, float size) {
  float ang = atan(p.y, p.x) / TAU + 0.5;
  float r = length(p);
  float cell = floor(ang * cells);
  float acc = 0.0;
  for (int k = -1; k <= 1; k++) {
    float c = mod(cell + float(k), cells);
    float rnd = h11(c * 13.1 + seed);
    if (rnd < 0.45) continue;
    float ph = h11(c * 7.7 + seed + 1.0);
    float life = fract(uT * (1.0 + floor(rnd * 2.0)) + ph);
    float a0 = (c + 0.5 + (h11(c + seed + 3.0) - 0.5) * 0.6) / cells;
    float wob = 0.012 * sin(TAU * (life * 2.0 + ph));
    float rr = R + 0.01 + life * reach;
    vec2 sp = vec2(cos((a0 - 0.5) * TAU), sin((a0 - 0.5) * TAU)) * rr;
    sp += vec2(-sp.y, sp.x) * wob / max(rr, 0.001);
    float d = length(p - sp);
    float fade = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life));
    acc += fade * (smoothstep(size, 0.0, d) + 0.35 * gauss(d, size * 3.0));
  }
  return acc;
}

// Folha com ponta afilada, nervura e duas faces. q: coordenadas locais (x ao longo da folha).
vec2 leafShape(vec2 q, float L, float W) {
  float x = q.x / L;
  if (x < 0.0 || x > 1.0) return vec2(0.0);
  float w = W * pow(sin(PI * x), 0.8) * (1.0 - 0.3 * x);
  float m = smoothstep(w + 0.0016, w - 0.0016, abs(q.y));
  float side = q.y > 0.0 ? 1.0 : 0.0;
  float vein = smoothstep(0.0011, 0.0, abs(q.y)) * smoothstep(0.95, 0.2, x);
  return vec2(m, side * 0.6 + 0.4 - vein * 0.55);
}

// Coroa de folhas em volta do avatar: dois ramos que sobem dos dois lados.
// gap > 0 deixa uma abertura no topo (guirlanda de louros).
vec4 leafRing(vec2 p, vec3 dark, vec3 light, vec3 alt, float N, float gap, float sway, float lenK) {
  float ang = atan(p.y, p.x);
  float a = ang / TAU + 0.5;
  vec4 acc = vec4(0.0);
  for (int row = 0; row < 2; row++) {
    float fr = float(row);
    float off = fr * 0.5;
    float ci0 = floor(a * N + off);
    for (int k = -1; k <= 1; k++) {
      float ci = ci0 + float(k);
      float ac = (ci + 0.5 - off) / N;
      float th = (ac - 0.5) * TAU;
      // abertura no topo (th ≈ +π/2)
      if (gap > 0.0 && abs(fract((th - PI * 0.5) / TAU + 0.5) - 0.5) < gap) continue;
      vec2 nrm = vec2(cos(th), sin(th));
      vec2 tng = vec2(-sin(th), cos(th));
      vec2 up = nrm.x >= 0.0 ? tng : -tng; // tangente que aponta para o topo
      float rnd = h11(ci * 3.7 + fr * 11.0);
      float lean = (row == 0 ? 0.62 : -0.5) + (rnd - 0.5) * 0.25;
      lean += sway * sin(TAU * (uT + rnd));
      vec2 dir = normalize(up * cos(lean) + nrm * sin(lean));
      vec2 base = nrm * (R + 0.03 + 0.004 * fr);
      vec2 q = p - base;
      vec2 lq = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
      float L = (0.05 + 0.018 * rnd) * lenK;
      vec2 lf = leafShape(lq, L, L * 0.26);
      if (lf.x <= 0.0) continue;
      vec3 c = mix(dark, light, lf.y);
      c = mix(c, alt, step(0.72, rnd) * 0.6);
      acc = over(vec4(c * lf.x, lf.x), acc);
    }
  }
  return acc;
}

// ============================================================================
// EFEITOS
// ============================================================================

// 0 — Fogo (Coroa de Chamas) / 5 — Fogo Espiritual (paleta fria)
vec4 fxFire(vec2 p, vec3 c0, vec3 c1, vec3 c2, vec3 c3, float strength) {
  float r = length(p);
  float ang = atan(p.y, p.x);
  float a = ang / TAU + 0.5;
  float h = (r - R) / (0.5 - R);
  float top = 0.62 + 0.38 * sin(ang);
  float n = flowFbm(vec2(a * 20.0, h * 4.0), vec2(0.0, 2.6), 20.0, 3.0);
  float n2 = flowFbm(vec2(a * 44.0, h * 9.0), vec2(0.0, 5.0), 44.0, 4.0);
  float f = (n * 0.75 + n2 * 0.35) * 1.35 - h * (1.85 - 0.75 * top) * strength + 0.05;
  float heat = clamp(f * 2.4, 0.0, 1.0);
  heat *= smoothstep(-0.06, 0.02, h);
  float rim = gauss(r - R * 1.005, 0.011);
  heat = max(heat, rim * 0.92);
  vec3 col = heatRamp(heat, c0, c1, c2, c3);
  float alpha = smoothstep(0.04, 0.32, heat);
  vec4 flame = vec4(col * alpha, alpha);
  // brilho de fundo
  float glow = gauss(r - R - 0.03, 0.09) * (0.35 + 0.25 * top);
  vec4 g = vec4(c1 * glow * 0.6, glow * 0.6);
  // brasas
  float sp = risingSparks(p, 46.0, 0.24, 3.0, 0.0045);
  vec4 s = vec4(mix(c2, c3, 0.5) * sp, sp);
  return over(s, over(flame, g));
}

// 0 — Coroa de Chamas: línguas de fogo finas e recortadas, mais altas no topo
float flameTongues(float a, float h, float N, float seed, float hMax, float top) {
  float best = 0.0;
  float u = a * N;
  float ci = floor(u);
  for (int k = -1; k <= 1; k++) {
    float id = mod(ci + float(k), N);
    float rnd = h11(id + seed * 13.1);
    float rnd2 = h11(id * 1.7 + seed * 5.3 + 2.0);
    // altura com cintilação periódica no loop
    float flick = 0.78 + 0.22 * sin(TAU * (uT * 2.0 + rnd2));
    float H = hMax * mix(0.5, 1.0, rnd) * flick * (0.42 + 0.58 * top);
    float x = u - (ci + float(k) + 0.5);
    // a ponta ondula para os lados conforme sobe
    x += 0.22 * h / max(H, 1e-3) * sin(TAU * (uT * 2.0 + rnd) + h * 9.0);
    float t = clamp(h / max(H, 1e-3), 0.0, 1.0);
    float w = 0.5 * pow(1.0 - t, 0.75) * (0.75 + 0.25 * smoothstep(0.0, 0.25, t));
    float d = abs(x) - w;
    float inside = smoothstep(0.06, -0.06, d) * step(h, H);
    float core = 1.0 - smoothstep(0.0, w + 0.02, abs(x)) * 0.55;
    float heat = inside * (0.18 + 0.82 * pow(1.0 - t, 1.3) * core);
    best = max(best, heat);
  }
  return best;
}

vec4 fxCrown(vec2 p) {
  vec3 c0 = vec3(0.6, 0.06, 0.0), c1 = vec3(0.98, 0.33, 0.03), c2 = vec3(1.0, 0.74, 0.16), c3 = vec3(1.0, 0.98, 0.85);
  float r = length(p);
  float ang = atan(p.y, p.x);
  float a = ang / TAU + 0.5;
  float h = (r - R) / (0.5 - R);
  float top = 0.5 + 0.5 * sin(ang);
  top = top * top;
  // turbulência fina que rasga as bordas das línguas
  float n = flowFbm(vec2(a * 36.0, h * 7.0), vec2(0.0, 4.0), 36.0, 3.0);
  float ad = a + (n - 0.5) * 0.012;
  float hd = h + (n - 0.5) * 0.06;
  float big = flameTongues(ad, hd, 22.0, 1.0, 0.62, top);
  float small = flameTongues(ad + 0.5 / 22.0, hd, 22.0, 7.0, 0.36, top) * 0.9;
  float heat = max(big, small);
  heat *= 0.8 + 0.35 * n;
  heat *= smoothstep(-0.02, 0.03, h);
  // aro incandescente fino colado na foto
  float rim = gauss(r - R * 1.01, 0.006);
  heat = max(heat, rim);
  heat = clamp(heat, 0.0, 1.0);
  vec3 col = heatRamp(0.12 + heat * 0.9, c0, c1, c2, c3);
  float alpha = smoothstep(0.02, 0.14, heat);
  vec4 flame = vec4(col * alpha, alpha);
  float glow = gauss(r - R - 0.02, 0.06) * (0.18 + 0.3 * top);
  vec4 g = vec4(c1 * glow * 0.55, glow * 0.55);
  float sp = risingSparks(p, 40.0, 0.22, 3.0, 0.0036) * (0.35 + 0.65 * top);
  vec4 s = vec4(mix(c2, c3, 0.6) * sp, sp);
  return over(s, over(flame, g));
}

// 1 — Aurora
vec4 fxAurora(vec2 p) {
  float r = length(p);
  float ang = atan(p.y, p.x);
  float a = ang / TAU + 0.5;
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float ph = fk * 2.1;
    float rc = R + 0.03 + 0.05 * fk + 0.022 * sin(TAU * (a * 3.0 + uT) + ph) + 0.012 * sin(TAU * (a * 7.0 - 2.0 * uT) + ph * 1.7);
    float d = r - rc;
    float band = exp(-max(d, 0.0) * max(d, 0.0) / pow(0.05 + 0.012 * fk, 2.0)) * smoothstep(-0.012, 0.004, d);
    float streak = fbm(vec3(a * 90.0, fk * 4.0, uT * 3.0), 90.0, 3.0);
    streak = pow(clamp(streak * 1.25, 0.0, 1.0), 2.2) * 1.9;
    float I = band * streak * (0.55 + 0.45 * sin(TAU * (a * 2.0 + uT) + ph));
    vec3 cc = mix(vec3(0.15, 1.0, 0.7), vec3(0.6, 0.35, 1.0), 0.5 + 0.5 * sin(TAU * (a + uT) + ph));
    cc = mix(cc, vec3(1.0, 0.45, 0.85), smoothstep(0.03, 0.09, d) * 0.6);
    col += cc * I;
  }
  float halo = gauss(r - R, 0.02) * 0.7;
  col += vec3(0.6, 1.0, 0.9) * halo;
  float baseGlow = gauss(r - R - 0.035, 0.045) * smoothstep(R * 0.98, R * 1.02, r);
  col += mix(vec3(0.1, 0.8, 0.6), vec3(0.45, 0.3, 0.95), 0.5 + 0.5 * sin(TAU * (a * 2.0 + uT))) * baseGlow * 0.55;
  // estrelas cintilantes
  vec2 cell = floor((p + 0.5) * 34.0);
  vec2 rnd = h22(cell);
  if (rnd.x > 0.82) {
    vec2 sp = (cell + 0.25 + rnd * 0.5) / 34.0 - 0.5;
    float d = length(p - sp);
    float tw = 0.5 + 0.5 * sin(TAU * (uT * 2.0 + rnd.y));
    float ring = smoothstep(R * 0.98, R * 1.08, length(sp));
    col += vec3(1.0, 0.95, 0.85) * (smoothstep(0.004, 0.0, d) + 0.4 * gauss(d, 0.008)) * tw * ring;
  }
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  return vec4(col * (alpha > 0.0 ? 1.0 : 0.0) * min(1.0, alpha) / max(alpha, 1e-4) * alpha, alpha);
}

// 2 — Plasma elétrico (Nuvem de Tempestade)
vec4 fxElectric(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float w = fbm(vec3(a * 18.0, r * 12.0, uT * 6.0), 18.0, 6.0);
  float n = fbm(vec3(a * 26.0 + w * 3.5, r * 20.0 + w * 2.0, uT * 6.0), 26.0, 6.0);
  float ridge = pow(1.0 - abs(n * 2.0 - 1.0), 14.0);
  float env = gauss(r - (R + 0.04), 0.055) * smoothstep(R * 0.96, R * 1.0, r);
  // arcos que saltam para fora em 3 janelas do loop
  float arcs = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float win = gauss(fract(uT - fk / 3.0) - 0.08, 0.05);
    float ac = h11(fk * 5.3 + floor(uT * 3.0)) ;
    float da = angDist(a, ac);
    float jag = (fbm(vec3(r * 40.0, fk * 3.0, uT * 12.0), 64.0, 12.0) - 0.5) * 0.05;
    arcs += win * smoothstep(0.012, 0.0, abs(da - jag)) * smoothstep(0.42, R, r) * step(R, r);
  }
  float flick = 0.8 + 0.2 * h11(floor(uT * 30.0));
  float I = (ridge * env * 2.4 + arcs * 1.6) * flick;
  vec3 core = vec3(0.92, 0.97, 1.0);
  vec3 glowc = vec3(0.45, 0.4, 1.0);
  float plasma = env * (0.25 + 0.2 * fbm(vec3(a * 10.0, r * 6.0, uT * 4.0), 10.0, 4.0));
  vec3 col = core * I + glowc * (plasma + I * 0.5) + vec3(0.3, 0.6, 1.0) * gauss(r - R, 0.012) * 0.9;
  float alpha = clamp(I + plasma * 1.2 + gauss(r - R, 0.012) * 0.9, 0.0, 1.0);
  return vec4(min(col, vec3(1.6)) * min(alpha, 1.0) / max(alpha, 1e-3) * alpha, alpha);
}

// 3 — Água (Onda de Kanagawa)
vec4 fxOcean(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float edgeN = flowFbm(vec2(a * 14.0, 1.0), vec2(2.0, 0.0), 14.0, 2.0);
  float rE = R + 0.06 + 0.035 * edgeN;
  float d = (r - R) / (rE - R);
  if (r < R * 0.97) return vec4(0.0);
  float caus = flowFbm(vec2(a * 34.0, r * 26.0), vec2(4.0, 1.0), 34.0, 3.0);
  float caus2 = flowFbm(vec2(a * 58.0, r * 40.0), vec2(-6.0, 2.0), 58.0, 4.0);
  float lines = pow(1.0 - abs(caus * 2.0 - 1.0), 7.0) + 0.6 * pow(1.0 - abs(caus2 * 2.0 - 1.0), 9.0);
  vec3 deep = vec3(0.03, 0.17, 0.36);
  vec3 mid = vec3(0.08, 0.47, 0.72);
  vec3 col = mix(deep, mid, smoothstep(0.0, 1.0, d));
  col += vec3(0.55, 0.9, 1.0) * lines * 0.65 * smoothstep(0.0, 0.35, d);
  // brilho especular que corre em volta
  float spec = gauss(angDist(a, uT), 0.05) * gauss(d - 0.35, 0.18);
  col += vec3(1.0) * spec * 0.55;
  float body = smoothstep(1.02, 0.96, d) * smoothstep(-0.03, 0.03, r - R);
  // espuma na crista
  float foamN = flowFbm(vec2(a * 70.0, r * 30.0), vec2(6.0, 0.0), 70.0, 4.0);
  float foam = smoothstep(0.1, 0.0, abs(d - 0.97)) * smoothstep(0.35, 0.65, foamN);
  foam += smoothstep(0.06, 0.0, abs(r - R - 0.004)) * 0.6;
  vec4 water = vec4(col * body, body);
  vec4 f = vec4(vec3(0.95, 0.98, 1.0) * foam, clamp(foam, 0.0, 1.0));
  float spray = risingSparks(p, 52.0, 0.17, 11.0, 0.004);
  vec4 s = vec4(vec3(0.85, 0.95, 1.0) * spray, clamp(spray, 0.0, 1.0));
  float glow = gauss(r - rE, 0.035) * 0.35;
  vec4 g = vec4(vec3(0.2, 0.6, 1.0) * glow, glow);
  return over(s, over(f, over(water, g)));
}

// 4 — Sombras com olhos (Olhos na Escuridão)
float eyeShape(vec2 q, float open) {
  vec2 e = q / vec2(0.013, 0.0075 * open + 0.0004);
  return smoothstep(1.0, 0.8, length(e));
}
vec4 fxShadow(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float h = (r - R) / (0.5 - R);
  float n = flowFbm(vec2(a * 16.0, h * 5.0), vec2(0.0, 1.6), 16.0, 3.0);
  float n2 = flowFbm(vec2(a * 34.0, h * 10.0), vec2(0.0, 2.4), 34.0, 4.0);
  float field = n * 0.85 + n2 * 0.3 - h * 1.05 + 0.4;
  float dens = smoothstep(0.32, 0.72, field) * smoothstep(-0.02, 0.03, h);
  float rimL = smoothstep(0.3, 0.42, field) * (1.0 - smoothstep(0.42, 0.62, field)) * smoothstep(-0.02, 0.03, h);
  vec3 smoke = mix(vec3(0.02, 0.0, 0.05), vec3(0.16, 0.04, 0.28), smoothstep(0.4, 0.9, n2) * (1.0 - h));
  smoke += vec3(0.55, 0.2, 1.0) * rimL * 0.9;
  smoke += vec3(0.4, 0.85, 0.1) * gauss(h - 0.015, 0.05) * 0.6;
  float a2 = clamp(dens * 0.97 + rimL * 0.6, 0.0, 1.0);
  vec4 s = vec4(smoke * a2 / max(dens * 0.97 + rimL * 0.6, 1e-3) * a2, a2);
  s.rgb = smoke * a2;
  // olhos
  vec4 eyes = vec4(0.0);
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float ea = h11(fk * 3.7 + 1.0) ;
    float er = R + 0.085 + 0.06 * h11(fk * 9.1);
    vec2 c = vec2(cos((ea - 0.5) * TAU), sin((ea - 0.5) * TAU)) * er;
    float ph = fk / 6.0;
    float life = fract(uT - ph);
    float open = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.42, 0.5, life));
    open *= 1.0 - gauss(life - 0.22, 0.025) * 0.97; // piscada
    if (open <= 0.001) continue;
    float sc = 1.15 + 0.6 * h11(fk * 2.3);
    vec2 q = (p - c) / sc;
    float e1 = eyeShape(q - vec2(-0.017, 0.0), open);
    float e2 = eyeShape(q - vec2(0.017, 0.0), open);
    float eye = max(e1, e2);
    float pupil = max(smoothstep(0.0028, 0.0018, abs(q.x + 0.017)), smoothstep(0.0028, 0.0018, abs(q.x - 0.017))) * eye;
    vec3 ec = mix(vec3(0.75, 1.0, 0.25), vec3(1.0, 1.0, 0.7), gauss(q.y, 0.003));
    vec3 col = ec * eye * (1.0 - pupil * 0.95);
    float glow = (gauss(length(q - vec2(-0.017, 0.0)), 0.016) + gauss(length(q - vec2(0.017, 0.0)), 0.016)) * open * 0.6;
    eyes = over(vec4(col + vec3(0.5, 0.9, 0.1) * glow, clamp(eye + glow, 0.0, 1.0)), eyes);
  }
  return over(eyes, s);
}

// 6 — Nebulosa
vec4 fxNebula(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float h = (r - R) / (0.5 - R);
  float sw = a + h * 0.35;
  float n = flowFbm(vec2(sw * 12.0, h * 6.0), vec2(1.5, 0.0), 12.0, 2.0);
  float n2 = flowFbm(vec2(sw * 30.0, h * 14.0), vec2(3.0, 0.0), 30.0, 3.0);
  float dust = smoothstep(0.45, 0.7, n2);
  float env = gauss(h - 0.18, 0.2) * smoothstep(-0.02, 0.03, h);
  float I = env * (0.4 + 1.2 * n) * (1.0 - dust * 0.55);
  vec3 col = mix(vec3(0.35, 0.1, 0.75), vec3(1.0, 0.3, 0.7), smoothstep(0.3, 0.75, n));
  col = mix(col, vec3(0.3, 0.6, 1.0), smoothstep(0.55, 0.85, n2) * 0.6);
  col *= I;
  col += vec3(1.0, 0.75, 0.95) * gauss(r - R, 0.01) * 0.9;
  vec2 cell = floor((p + 0.5) * 40.0);
  vec2 rnd = h22(cell + 3.0);
  if (rnd.x > 0.8) {
    vec2 sp = (cell + 0.2 + rnd * 0.6) / 40.0 - 0.5;
    float d = length(p - sp);
    float tw = 0.55 + 0.45 * sin(TAU * (uT + rnd.y));
    float m = smoothstep(R * 0.99, R * 1.05, length(sp)) * smoothstep(0.5, 0.36, length(sp));
    col += vec3(1.0) * (smoothstep(0.0035, 0.0, d) + 0.3 * gauss(d, 0.007)) * tw * m;
  }
  float alpha = clamp(max(col.r, max(col.g, col.b)) * 1.1, 0.0, 1.0);
  return vec4(col / max(max(col.r, max(col.g, col.b)), 1e-3) * alpha, alpha);
}

// 7 — Magma
vec2 voronoiPolar(vec2 uv, float px) {
  vec2 i = floor(uv), f = fract(uv);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 id = i + g;
      id.x = mod(id.x, px);
      vec2 o = h22(id);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  return vec2(d1, d2);
}
vec4 fxMagma(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float w = 0.075;
  float d = (r - R) / w;
  if (d < -0.15 || r > 0.5) return vec4(0.0);
  vec2 v = voronoiPolar(vec2(a * 34.0, r * 34.0), 34.0);
  float crack = smoothstep(0.12, 0.0, v.y - v.x);
  float pulse = flowFbm(vec2(a * 10.0, r * 8.0), vec2(1.0, 0.0), 10.0, 2.0);
  float body = smoothstep(1.05, 0.92, d) * smoothstep(-0.1, 0.05, d);
  vec3 rock = mix(vec3(0.07, 0.05, 0.05), vec3(0.2, 0.12, 0.1), h31(vec3(floor(vec2(a * 34.0, r * 34.0)), 1.0)));
  rock *= 0.7 + 0.3 * (1.0 - abs(d - 0.5) * 2.0);
  float heat = crack * (0.55 + 0.6 * pulse);
  vec3 lava = heatRamp(clamp(heat, 0.0, 1.0), vec3(0.6, 0.05, 0.0), vec3(1.0, 0.35, 0.0), vec3(1.0, 0.75, 0.15), vec3(1.0, 0.97, 0.8));
  vec3 col = mix(rock, lava, smoothstep(0.05, 0.5, heat));
  vec4 ring = vec4(col * body, body);
  float hg = gauss(r - (R + w), 0.05) * (0.45 + 0.35 * pulse);
  vec4 haze = vec4(vec3(1.0, 0.3, 0.05) * hg, hg * 0.8);
  float sp = risingSparks(p, 40.0, 0.2, 7.0, 0.004);
  vec4 s = vec4(vec3(1.0, 0.7, 0.3) * sp, clamp(sp, 0.0, 1.0));
  return over(s, over(ring, haze));
}

// 8 — Gelo e neve
vec4 fxFrost(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float N = 40.0;
  float ci = floor(a * N);
  float s = 1.0 - abs(fract(a * N) - 0.5) * 2.0;
  float L = 0.025 + 0.055 * pow(h11(ci * 3.1), 1.6);
  float L2 = 0.015 + 0.03 * h11(ci * 7.7 + 2.0);
  float spike = step(r - R, L * pow(s, 1.6)) + step(r - R, L2 * pow(1.0 - abs(fract(a * N + 0.5) - 0.5) * 2.0, 2.0));
  spike = clamp(spike, 0.0, 1.0) * step(R * 0.985, r);
  float facet = step(0.5, fract(a * N));
  vec3 ice = mix(vec3(0.55, 0.85, 1.0), vec3(0.92, 0.98, 1.0), facet * 0.6 + (r - R) / 0.08 * 0.4);
  float glint = gauss(angDist(a, uT), 0.03) * 1.2;
  ice += vec3(1.0) * glint * spike;
  float band = smoothstep(0.012, 0.0, abs(r - R - 0.006));
  vec3 col = ice * spike + vec3(0.8, 0.95, 1.0) * band;
  float alpha = clamp(spike * 0.92 + band, 0.0, 1.0);
  vec4 frost = vec4(col * (alpha > 0.0 ? 1.0 : 0.0), alpha);
  frost.rgb = min(col, vec3(1.0)) * alpha;
  // neve caindo (loop: desce exatamente 1 célula * k)
  vec4 snow = vec4(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float cs = 0.08 - fl * 0.025;
    vec2 q = p + vec2(0.0, uT * cs * (2.0 + fl));
    vec2 cell = floor(q / cs);
    vec2 rnd = h22(cell + fl * 31.0);
    if (rnd.x < 0.55) continue;
    vec2 c = (cell + 0.2 + 0.6 * rnd) * cs;
    c.x += 0.008 * sin(TAU * (uT + rnd.y));
    float d = length(q - c);
    float sz = 0.004 + 0.004 * rnd.y * (1.0 - fl * 0.4);
    float m = smoothstep(R * 0.98, R * 1.06, length(p)) * smoothstep(0.49, 0.36, length(p));
    float fl2 = smoothstep(sz, sz * 0.3, d) * m * (0.6 + 0.4 * (1.0 - fl));
    snow = over(vec4(vec3(1.0) * fl2, fl2), snow);
  }
  float glow = gauss(r - R - 0.02, 0.05) * 0.3;
  return over(snow, over(frost, vec4(vec3(0.5, 0.8, 1.0) * glow, glow)));
}

// 9 — Ouro imperial com louros
vec4 fxGold(vec2 p) {
  float r = length(p);
  float ang = atan(p.y, p.x);
  float a = ang / TAU + 0.5;
  float w = 0.04;
  float v = (r - R + 0.004) / w;
  vec4 outc = vec4(0.0);
  // coroa de louros (atrás do aro), com reflexo que acompanha o brilho do aro
  vec4 laurel = leafRing(p, vec3(0.42, 0.26, 0.03), vec3(1.0, 0.83, 0.38), vec3(0.85, 0.62, 0.18), 22.0, 0.07, 0.0, 1.0);
  float lhl = gauss(angDist(a, uT), 0.045) + 0.5 * gauss(angDist(a, uT + 0.5), 0.06);
  laurel.rgb += vec3(1.0, 0.95, 0.75) * lhl * laurel.a * 0.7;
  outc = over(laurel, outc);
  // aro de metal com sombreamento cilíndrico
  if (v > 0.0 && v < 1.0) {
    float cyl = sin(v * PI);
    float brushed = fbm(vec3(a * 240.0, v * 3.0, 0.0), 240.0, 1.0);
    vec3 gold = mix(vec3(0.42, 0.24, 0.03), vec3(1.0, 0.84, 0.4), pow(cyl, 0.7));
    gold *= 0.85 + 0.25 * brushed;
    float hl = gauss(angDist(a, uT), 0.035) + 0.5 * gauss(angDist(a, uT + 0.5), 0.05);
    gold += vec3(1.0, 0.97, 0.85) * hl * pow(cyl, 6.0) * 1.1;
    gold += vec3(1.0, 0.9, 0.6) * smoothstep(0.75, 0.95, cyl) * 0.25;
    float edge = smoothstep(0.0, 0.08, v) * smoothstep(1.0, 0.92, v);
    outc = over(vec4(gold * edge, edge), outc);
  }
  // poeira dourada
  float sp = risingSparks(p, 30.0, 0.16, 21.0, 0.0035);
  outc = over(vec4(vec3(1.0, 0.9, 0.55) * sp, clamp(sp, 0.0, 1.0)), outc);
  float glow = gauss(r - R - 0.02, 0.05) * 0.25;
  return over(outc, vec4(vec3(1.0, 0.75, 0.25) * glow, glow));
}

// 10 — Néon / circuito
vec4 fxNeon(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float AN = 64.0;
  float rr = (r - R) / 0.11;
  if (rr < -0.1 || rr > 1.1) return vec4(0.0);
  vec2 g = vec2(a * AN, rr * 6.0);
  vec2 ci = floor(g);
  vec2 f = fract(g);
  float pick = h31(vec3(mod(ci.x, AN), ci.y, 3.0));
  float lineW = 0.15;
  float trace = 0.0;
  if (pick > 0.55) trace = smoothstep(lineW, 0.0, abs(f.y - 0.5));           // ao longo do anel
  else if (pick > 0.3) trace = smoothstep(lineW, 0.0, abs(f.x - 0.5));       // radial
  float node = smoothstep(0.22, 0.12, length(f - 0.5)) * step(0.82, pick);
  float pulsePos = fract(a * 4.0 - uT * 2.0);
  float pulse = gauss(pulsePos - 0.5, 0.06);
  float pulse2 = gauss(fract(a * 3.0 + uT * 3.0) - 0.5, 0.05);
  vec3 cyan = vec3(0.15, 0.9, 1.0);
  vec3 mag = vec3(1.0, 0.15, 0.55);
  vec3 tc = mix(cyan, mag, step(0.75, h31(vec3(mod(ci.x, AN), ci.y, 8.0))));
  float on = (trace + node) * step(0.0, rr) * step(rr, 1.0);
  vec3 col = tc * on * (0.6 + 1.8 * max(pulse, pulse2 * 0.8));
  float core = smoothstep(0.007, 0.0, abs(r - R - 0.004));
  float outer = smoothstep(0.004, 0.0, abs(r - R - 0.112));
  col += cyan * core * (1.1 + 0.6 * pulse) + mag * outer * (0.7 + 0.8 * pulse2);
  float glow = gauss(r - R, 0.035) * 0.6 + on * 0.35 + gauss(r - R - 0.112, 0.02) * 0.35;
  col += tc * glow * 0.5;
  float flick = 0.85 + 0.15 * step(0.5, h11(floor(uT * 20.0)));
  col *= flick;
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  return vec4(col / max(max(col.r, max(col.g, col.b)), 1e-3) * alpha, alpha);
}

// 11 — Pétalas de sakura (12 — vaga-lumes da floresta)
vec4 fxPetals(vec2 p, bool fireflies) {
  vec4 acc = vec4(0.0);
  float r = length(p);
  // névoa / brilho de base
  float mistN = flowFbm(vec2((atan(p.y, p.x) / TAU + 0.5) * 12.0, r * 8.0), vec2(1.0, 0.4), 12.0, 2.0);
  float mist = gauss(r - R - 0.04, 0.07) * (0.35 + 0.5 * mistN) * smoothstep(R * 0.97, R * 1.02, r);
  vec3 mc = fireflies ? vec3(0.25, 0.7, 0.3) : vec3(1.0, 0.6, 0.8);
  acc = vec4(mc * mist * 0.7, mist * 0.7);
  int count = fireflies ? 26 : 30;
  for (int i = 0; i < 30; i++) {
    if (i >= count) break;
    float fi = float(i);
    float ph = h11(fi * 1.93);
    float depth = h11(fi * 4.71);
    vec2 pos;
    if (fireflies) {
      float ang = TAU * h11(fi * 2.2) + 0.25 * sin(TAU * (uT + ph));
      float rad = R + 0.05 + 0.15 * h11(fi * 3.3) + 0.02 * sin(TAU * (uT * 2.0 + ph));
      pos = vec2(cos(ang), sin(ang)) * rad;
    } else {
      float x0 = h11(fi * 7.3) - 0.5;
      float y = 0.55 - fract(uT + ph) * 1.1;
      pos = vec2(x0 * 0.95 + 0.04 * sin(TAU * (uT * 2.0 + ph)), y);
    }
    vec2 q = p - pos;
    float vis = smoothstep(R * 0.92, R * 1.05, length(pos)) * 0.75 + 0.25;
    if (fireflies) {
      float tw = pow(0.5 + 0.5 * sin(TAU * (uT * 2.0 + ph)), 2.0);
      float d = length(q);
      float core = smoothstep(0.0045, 0.0, d);
      float halo = gauss(d, 0.018) * 0.7;
      float I = (core + halo) * tw * vis;
      acc = over(vec4(vec3(0.95, 1.0, 0.45) * I, clamp(I, 0.0, 1.0)), acc);
    } else {
      float rot = TAU * (ph + uT * (h11(fi) > 0.5 ? 1.0 : -1.0));
      vec2 lq = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * q;
      float sz = 0.011 + 0.012 * depth;
      vec2 e = lq / vec2(sz * 0.7, sz);
      float body = smoothstep(1.0, 0.8, length(e));
      float notch = smoothstep(0.25, 0.0, length(vec2(lq.x / sz, lq.y / sz - 1.0))) ;
      float petal = clamp(body - notch, 0.0, 1.0);
      vec3 pc = mix(vec3(1.0, 0.55, 0.72), vec3(1.0, 0.92, 0.95), smoothstep(1.0, 0.0, length(e)) * 0.8);
      pc *= 0.75 + 0.25 * depth;
      float al = petal * (0.55 + 0.45 * depth) * vis;
      acc = over(vec4(pc * al, al), acc);
    }
  }
  float ring = gauss(r - R, 0.01) * 0.8;
  vec3 rc = fireflies ? vec3(0.5, 0.95, 0.4) : vec3(1.0, 0.75, 0.88);
  vec4 base = vec4(rc * ring, ring);
  if (fireflies) {
    // folhagem viva que balança
    vec4 leaves = leafRing(p, vec3(0.04, 0.22, 0.08), vec3(0.35, 0.78, 0.25), vec3(0.62, 0.85, 0.2), 20.0, 0.0, 0.12, 1.05);
    return over(acc, over(leaves, base));
  }
  // flores de cerejeira presas ao anel (5 pétalas)
  vec4 flowers = vec4(0.0);
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float th = TAU * (fk / 7.0 + 0.04 * h11(fk));
    vec2 c0 = vec2(cos(th), sin(th)) * (R + 0.012);
    vec2 q = p - c0;
    float rot = 0.6 * sin(TAU * (uT + fk / 7.0)) + fk;
    float rho = length(q);
    float phi = atan(q.y, q.x) + rot;
    float sz = 0.03 + 0.008 * h11(fk * 5.0);
    float pr = sz * (0.45 + 0.55 * pow(abs(cos(phi * 2.5)), 0.6));
    float fm = smoothstep(pr + 0.0015, pr - 0.0015, rho);
    vec3 fc = mix(vec3(1.0, 0.97, 0.98), vec3(1.0, 0.55, 0.72), smoothstep(0.0, sz, rho));
    fc = mix(fc, vec3(0.95, 0.35, 0.55), smoothstep(sz * 0.85, sz * 0.2, rho) * 0.0 + smoothstep(sz * 0.35, sz * 0.15, rho) * 0.0);
    float center = smoothstep(sz * 0.18, sz * 0.1, rho);
    fc = mix(fc, vec3(1.0, 0.82, 0.3), center);
    flowers = over(vec4(fc * fm, fm), flowers);
  }
  return over(acc, over(flowers, base));
}

void main() {
  vec2 p = (gl_FragCoord.xy / uRes) - 0.5;
  vec4 c = vec4(0.0);
  if (uFx == 0) c = fxCrown(p);
  else if (uFx == 1) c = fxAurora(p);
  else if (uFx == 2) c = fxElectric(p);
  else if (uFx == 3) c = fxOcean(p);
  else if (uFx == 4) c = fxShadow(p);
  else if (uFx == 5) {
    vec4 f = fxFire(p, vec3(0.1, 0.05, 0.45), vec3(0.2, 0.45, 1.0), vec3(0.45, 0.9, 1.0), vec3(0.92, 0.98, 1.0), 1.15);
    // três fogos-fátuos em órbita
    vec4 w = vec4(0.0);
    for (int k = 0; k < 3; k++) {
      for (int j = 0; j < 7; j++) {
        float th = TAU * (uT + float(k) / 3.0) - float(j) * 0.07;
        vec2 c0 = vec2(cos(th), sin(th)) * (R + 0.12 + 0.01 * sin(TAU * uT * 2.0 + float(k)));
        float d = length(p - c0);
        float sz = 0.016 * (1.0 - float(j) / 8.0);
        float I = smoothstep(sz, 0.0, d) * (1.0 - float(j) / 7.0) + gauss(d, sz * 2.5) * 0.35 * (1.0 - float(j) / 7.0);
        w = over(vec4(mix(vec3(0.85, 0.97, 1.0), vec3(0.3, 0.55, 1.0), float(j) / 7.0) * I, clamp(I, 0.0, 1.0)), w);
      }
    }
    c = over(w, f);
  }
  else if (uFx == 6) c = fxNebula(p);
  else if (uFx == 7) c = fxMagma(p);
  else if (uFx == 8) c = fxFrost(p);
  else if (uFx == 9) c = fxGold(p);
  else if (uFx == 10) c = fxNeon(p);
  else if (uFx == 11) c = fxPetals(p, false);
  else if (uFx == 12) c = fxPetals(p, true);
  // nunca pinta o rosto: só uma borda suave sobre a beira do avatar
  float faceMask = smoothstep(R * 0.93, R * 0.99, length(p));
  c *= faceMask;
  outColor = clamp(c, 0.0, 1.0);
}
`;

/** Versão especializada para um efeito: o compilador descarta os outros 12. */
export function fxShaderFor(fx: keyof typeof FX_IDS): string {
  return FX_SHADER.replace('uniform int uFx;', `const int uFx = ${FX_IDS[fx]};`);
}
