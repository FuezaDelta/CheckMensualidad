/**
 * Efectos visuales que dependen del scroll: la cabecera se vuelve sólida al
 * bajar y los bloques marcados con `data-revelar` aparecen al entrar en
 * pantalla.
 *
 * Todo es una mejora progresiva: el CSS solo oculta los bloques cuando este
 * módulo añade la clase `js-revelar` al documento, así que si el JavaScript
 * falla el contenido se ve completo desde el principio.
 */

const CLASE_DOCUMENTO = "js-revelar";
const CLASE_REVELADO = "revelado";
const CLASE_HEADER_SOLIDO = "site-header--solido";
const UMBRAL_HEADER_PX = 40;
const PASO_RETRASO_S = 0.08;
const MAX_RETRASO_S = 0.32;

const prefiereMenosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function activarCabeceraSolida() {
  const cabecera = document.getElementById("site-header");
  if (!cabecera) return;

  let pendiente = false;

  const actualizar = () => {
    pendiente = false;
    cabecera.classList.toggle(CLASE_HEADER_SOLIDO, window.scrollY > UMBRAL_HEADER_PX);
  };

  window.addEventListener(
    "scroll",
    () => {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(actualizar);
    },
    { passive: true }
  );

  actualizar();
}

function activarRevelado() {
  const elementos = Array.from(document.querySelectorAll("[data-revelar]"));
  if (elementos.length === 0) return;
  if (prefiereMenosMovimiento() || !("IntersectionObserver" in window)) return;

  // Los hermanos que entran juntos aparecen en cascada, no todos a la vez.
  for (const elemento of elementos) {
    const hermanos = Array.from(elemento.parentElement?.children ?? []).filter((nodo) =>
      nodo.hasAttribute("data-revelar")
    );
    const indice = hermanos.indexOf(elemento);
    if (indice > 0) {
      const retraso = Math.min(indice * PASO_RETRASO_S, MAX_RETRASO_S);
      elemento.style.setProperty("--retraso", `${retraso}s`);
    }
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        entrada.target.classList.add(CLASE_REVELADO);
        observador.unobserve(entrada.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  document.documentElement.classList.add(CLASE_DOCUMENTO);
  for (const elemento of elementos) observador.observe(elemento);
}

export function activarAnimaciones() {
  activarCabeceraSolida();
  activarRevelado();
}
