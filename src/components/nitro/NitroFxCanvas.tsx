'use client';

import { useEffect, useRef, useState } from 'react';
import { FX_IDS, FX_LOOP_MS, fxShaderFor } from '@/lib/nitro/fxShader';
import { prefersReducedMotion } from './NitroProvider';

type FxName = keyof typeof FX_IDS;

const MAX_RES = 384;  // teto de resolução do canvas (px físicos)
const FPS = 30;

const VERT = '#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';

/**
 * Efeito da moldura renderizado ao vivo (WebGL2), com o mesmo shader dos assets.
 * Usado só em avatares grandes (perfil, prévia). Pausa fora da tela, com a aba
 * oculta e com movimento reduzido. Sem WebGL2 ou se o shader falhar, mostra o
 * quadro parado.
 */
export function NitroFxCanvas({ fx, cssSize }: { fx: FxName; cssSize: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'live' | 'failed'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion()) {
      setState('failed');
      return;
    }

    // celular: resolução e quadros menores; aparelho fraco fica com a imagem estática
    const nav = navigator as Navigator & { deviceMemory?: number };
    const mobile = window.matchMedia('(pointer: coarse)').matches;
    if (mobile && ((nav.deviceMemory ?? 4) <= 2 || (navigator.hardwareConcurrency ?? 4) <= 4)) {
      setState('failed');
      return;
    }
    const fps = mobile ? 24 : FPS;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    const res = Math.min(MAX_RES, Math.round(cssSize * dpr));
    canvas.width = res;
    canvas.height = res;

    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      setState('failed');
      return;
    }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
      return sh;
    };

    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fxShaderFor(fx)));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    } catch {
      setState('failed');
      return;
    }

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uT = gl.getUniformLocation(prog, 'uT');

    let raf = 0;
    let last = 0;
    let visible = true;
    let first = true;

    const draw = (now: number) => {
      // fora da tela ou aba escondida: para o laço (retoma pelo observer)
      if (!visible || document.hidden) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(draw);
      if (now - last < 1000 / fps) return;
      last = now;
      gl.viewport(0, 0, res, res);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, res, res);
      gl.uniform1f(uT, (now % FX_LOOP_MS) / FX_LOOP_MS);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (first) {
        first = false;
        setState('live');
      }
    };
    raf = requestAnimationFrame(draw);

    const resume = () => {
      if (visible && !document.hidden && !raf) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', resume);

    const onLost = (e: Event) => {
      e.preventDefault();
      setState('failed');
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', resume);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [fx, cssSize]);

  return (
    <span aria-hidden className="nx-deco nx-efx">
      {state !== 'live' && (
        <img className="nx-fx-still nx-fx-static-img" src={`/nitro/frames/${fx}-still.webp`} alt="" decoding="async" draggable={false} />
      )}
      <canvas ref={canvasRef} className="nx-fx-canvas" style={{ opacity: state === 'live' ? 1 : 0 }} />
    </span>
  );
}
