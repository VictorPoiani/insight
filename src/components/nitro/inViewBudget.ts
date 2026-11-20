/**
 * Orçamento de animação para molduras em listas (feed, respostas, notificações).
 * Funciona no toque (sem hover): anima só as molduras visíveis e, dentre elas,
 * no máximo MAX_LIVE — as mais próximas do centro da tela. As demais ficam
 * estáticas. Um único IntersectionObserver para a página inteira.
 */

const MAX_LIVE = 4;
const ON_CLASS = 'nx-on';

const visible = new Set<Element>();
const live = new Set<Element>();
let observer: IntersectionObserver | null = null;
let scheduled = false;

function recompute() {
  scheduled = false;
  const center = window.innerHeight / 2;
  const next = new Set(
    [...visible]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, distance: Math.abs(r.top + r.height / 2 - center) };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_LIVE)
      .map((x) => x.el)
  );

  live.forEach((el) => {
    if (!next.has(el)) el.classList.remove(ON_CLASS);
  });
  next.forEach((el) => el.classList.add(ON_CLASS));
  live.clear();
  next.forEach((el) => live.add(el));
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(recompute);
}

function ensureObserver() {
  if (observer || typeof window === 'undefined') return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.add(entry.target);
        } else {
          visible.delete(entry.target);
          live.delete(entry.target);
          entry.target.classList.remove(ON_CLASS);
        }
      }
      schedule();
    },
    { threshold: [0, 0.6] }
  );
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

/** Registra uma moldura; devolve a função de limpeza. */
export function observeFrame(el: Element): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  ensureObserver();
  observer!.observe(el);
  return () => {
    observer?.unobserve(el);
    visible.delete(el);
    live.delete(el);
    el.classList.remove(ON_CLASS);
    schedule();
  };
}
