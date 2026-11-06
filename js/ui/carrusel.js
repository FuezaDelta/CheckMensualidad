/**
 * Carrusel de fotos (sección de competencias).
 *
 * La base es una pista horizontal con scroll-snap: sin JavaScript las fotos se
 * pasan deslizando con el dedo o con el trackpad. Este módulo añade flechas,
 * puntos, avance automático y, en pantallas anchas, la foto anterior y la
 * siguiente asomando a los lados.
 *
 * Las fotos se muestran en orden aleatorio, distinto en cada visita, y cambian
 * cada 2 segundos. El avance automático se detiene mientras el puntero o el
 * foco están sobre el carrusel, cuando no está en pantalla y cuando el usuario
 * prefiere menos movimiento. El botón de pausa permite detenerlo del todo
 * (WCAG 2.2.2).
 */

import { crear, porId } from "../lib/dom.js";

const INTERVALO_MS = 2000;

/**
 * Fisher-Yates: cada orden posible tiene la misma probabilidad.
 *
 * @template T
 * @param {T[]} elementos
 * @returns {T[]} Un arreglo nuevo; no muta la entrada.
 */
function barajar(elementos) {
  const resultado = [...elementos];
  for (let i = resultado.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }
  return resultado;
}

const prefiereMenosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {string} clase
 * @param {string} texto
 * @param {string} etiqueta
 * @returns {HTMLButtonElement}
 */
function crearBoton(clase, texto, etiqueta) {
  return /** @type {HTMLButtonElement} */ (
    crear("button", {
      clase,
      texto,
      atributos: { type: "button", "aria-label": etiqueta },
    })
  );
}

/**
 * @param {string} [idCarrusel]
 */
export function crearCarrusel(idCarrusel = "carrusel-competencias") {
  const carrusel = porId(idCarrusel);
  const pista = /** @type {HTMLElement|null} */ (carrusel?.querySelector(".carrusel-pista"));
  if (!carrusel || !pista) return null;

  // Se reordenan en el DOM y no solo al avanzar: así los puntos, el deslizado
  // con el dedo y el avance automático siguen el mismo orden, y cada visita
  // recorre todas las fotos sin repetir ninguna.
  const fotos = barajar(
    /** @type {HTMLElement[]} */ (Array.from(pista.querySelectorAll(".carrusel-foto")))
  );
  if (fotos.length < 2) return null;

  pista.append(...fotos);
  fotos.forEach((foto, indice) => {
    foto.setAttribute("aria-label", `${indice + 1} de ${fotos.length}`);
  });

  let actual = 0;
  /** @type {number|undefined} */
  let temporizador;
  let pausado = prefiereMenosMovimiento();
  let enPantalla = false;
  let enUso = false;
  let scrollPendiente = false;

  const botonAnterior = crearBoton("carrusel-flecha carrusel-flecha--anterior", "‹", "Foto anterior");
  const botonSiguiente = crearBoton("carrusel-flecha carrusel-flecha--siguiente", "›", "Foto siguiente");
  const botonPausa = crearBoton("carrusel-pausa", "", "");
  const puntos = fotos.map((_, indice) =>
    crearBoton("carrusel-punto", "", `Ver foto ${indice + 1} de ${fotos.length}`)
  );

  // Asoman detrás de la foto principal para anticipar la anterior y la
  // siguiente. Son un atajo visual de las flechas, que ya cubren el teclado y
  // los lectores de pantalla; por eso quedan fuera del orden de tabulación y
  // del árbol de accesibilidad.
  const crearVecina = (lado) => {
    const imagen = /** @type {HTMLImageElement} */ (crear("img", { atributos: { alt: "", decoding: "async" } }));
    const vecina = crear(
      "button",
      {
        clase: `carrusel-vecina carrusel-vecina--${lado}`,
        atributos: { type: "button", tabindex: "-1", "aria-hidden": "true" },
      },
      [imagen]
    );
    return { vecina, imagen };
  };
  const anterior = crearVecina("anterior");
  const siguiente = crearVecina("siguiente");

  /** @type {number|undefined} */
  let temporizadorVecinas;

  // Durante un desplazamiento largo el índice pasa por las fotos intermedias;
  // las vecinas se actualizan cuando se detiene para no parpadear.
  function actualizarVecinas() {
    window.clearTimeout(temporizadorVecinas);
    temporizadorVecinas = window.setTimeout(() => {
      const total = fotos.length;
      for (const [{ vecina, imagen }, indice] of [
        [anterior, (actual - 1 + total) % total],
        [siguiente, (actual + 1) % total],
      ]) {
        const origen = /** @type {HTMLImageElement|null} */ (fotos[indice].querySelector("img"));
        if (!origen || imagen.getAttribute("src") === origen.getAttribute("src")) continue;
        imagen.src = origen.getAttribute("src") ?? "";
        // Reinicia el fundido de entrada en cada cambio.
        vecina.classList.remove("carrusel-vecina--entrando");
        void vecina.offsetWidth;
        vecina.classList.add("carrusel-vecina--entrando");
      }
    }, 150);
  }

  anterior.vecina.addEventListener("click", () => mover(-1));
  siguiente.vecina.addEventListener("click", () => mover(1));

  // Antes de la pista, para que esta se pinte encima.
  carrusel.prepend(anterior.vecina, siguiente.vecina);

  carrusel.append(
    botonAnterior,
    botonSiguiente,
    crear("div", { clase: "carrusel-controles" }, [
      crear("div", { clase: "carrusel-puntos" }, puntos),
      botonPausa,
    ])
  );

  function detener() {
    window.clearTimeout(temporizador);
    temporizador = undefined;
  }

  function programar() {
    detener();
    if (pausado || enUso || !enPantalla || document.hidden) return;
    temporizador = window.setTimeout(() => mover(1), INTERVALO_MS);
  }

  /*
   * Tira circular. `fotos` guarda el orden lógico (el de los puntos y el
   * "N de 9"); el orden en el DOM se va rotando para que la foto visible quede
   * siempre en el medio de la pista. Así siempre hay fotos a ambos lados: de
   * la última se pasa a la primera avanzando una sola foto, en lugar de
   * recorrer todas hacia atrás, y lo mismo al deslizar con el dedo.
   */
  const CENTRO = Math.floor(fotos.length / 2);
  let tocando = false;

  const anchoFoto = () => Math.max(pista.clientWidth, 1);
  const indiceEnPista = () =>
    Math.min(Math.max(Math.round(pista.scrollLeft / anchoFoto()), 0), fotos.length - 1);
  const fotoVisible = () => /** @type {HTMLElement} */ (pista.children[indiceEnPista()]);

  /** Rota el DOM sin mover lo que se ve, hasta dejar la foto visible al centro. */
  function recentrar() {
    if (tocando) return;
    const desfase = indiceEnPista() - CENTRO;
    if (desfase === 0) return;

    for (let i = 0; i < Math.abs(desfase); i += 1) {
      if (desfase > 0) pista.append(/** @type {Node} */ (pista.firstElementChild));
      else pista.prepend(/** @type {Node} */ (pista.lastElementChild));
    }
    pista.scrollLeft = CENTRO * anchoFoto();
  }

  /** @param {number} posicion Índice dentro de la pista. */
  function desplazarA(posicion) {
    const destino = /** @type {HTMLElement|undefined} */ (pista.children[posicion]);
    if (!destino) return;
    pista.scrollTo({
      left: destino.offsetLeft,
      behavior: prefiereMenosMovimiento() ? "auto" : "smooth",
    });
    // Si la pista no se mueve (ya estaba ahí), no habrá evento de scroll que
    // vuelva a programar el avance.
    marcarActual(fotos.indexOf(destino));
    programar();
  }

  /** Avanza o retrocede por la tira: nunca llega a un extremo. */
  function mover(pasos) {
    recentrar();
    desplazarA(indiceEnPista() + pasos);
  }

  /** @param {number} indice Foto en el orden lógico (el de los puntos). */
  function irA(indice) {
    recentrar();
    desplazarA(Array.prototype.indexOf.call(pista.children, fotos[indice]));
  }

  /** @param {number} indice */
  function marcarActual(indice) {
    actual = indice;
    puntos.forEach((punto, i) => {
      if (i === indice) punto.setAttribute("aria-current", "true");
      else punto.removeAttribute("aria-current");
    });
    actualizarVecinas();
  }

  function actualizarPausa() {
    botonPausa.textContent = pausado ? "►" : "❚❚";
    botonPausa.setAttribute(
      "aria-label",
      pausado ? "Reanudar el paso automático de fotos" : "Pausar el paso automático de fotos"
    );
  }

  // La foto actual se deduce de la posición del scroll, así que también se
  // actualiza cuando el usuario desliza con el dedo.
  pista.addEventListener(
    "scroll",
    () => {
      if (scrollPendiente) return;
      scrollPendiente = true;
      window.requestAnimationFrame(() => {
        scrollPendiente = false;
        marcarActual(fotos.indexOf(fotoVisible()));
        programar();
      });
    },
    { passive: true }
  );

  // Se recentra cuando el desplazamiento termina, nunca a mitad: mover el DOM
  // durante una animación o con el dedo encima haría saltar la imagen.
  /** @type {number|undefined} */
  let temporizadorFin;
  const alTerminar = () => {
    window.clearTimeout(temporizadorFin);
    temporizadorFin = window.setTimeout(recentrar, 60);
  };
  if ("onscrollend" in window) {
    pista.addEventListener("scrollend", alTerminar);
  } else {
    pista.addEventListener("scroll", () => {
      window.clearTimeout(temporizadorFin);
      temporizadorFin = window.setTimeout(recentrar, 250);
    }, { passive: true });
  }
  pista.addEventListener("touchstart", () => { tocando = true; }, { passive: true });
  pista.addEventListener("touchend", () => { tocando = false; alTerminar(); }, { passive: true });
  pista.addEventListener("touchcancel", () => { tocando = false; alTerminar(); }, { passive: true });

  botonAnterior.addEventListener("click", () => mover(-1));
  botonSiguiente.addEventListener("click", () => mover(1));
  puntos.forEach((punto, indice) => punto.addEventListener("click", () => irA(indice)));

  botonPausa.addEventListener("click", () => {
    pausado = !pausado;
    actualizarPausa();
    programar();
  });

  carrusel.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowLeft") mover(-1);
    else if (evento.key === "ArrowRight") mover(1);
    else return;
    evento.preventDefault();
  });

  const usar = () => {
    enUso = true;
    detener();
  };
  const soltar = () => {
    enUso = false;
    programar();
  };

  carrusel.addEventListener("pointerenter", (evento) => {
    if (evento.pointerType === "mouse") usar();
  });
  carrusel.addEventListener("pointerleave", (evento) => {
    if (evento.pointerType === "mouse") soltar();
  });
  carrusel.addEventListener("focusin", usar);
  carrusel.addEventListener("focusout", (evento) => {
    if (!carrusel.contains(/** @type {Node|null} */ (evento.relatedTarget))) soltar();
  });

  document.addEventListener("visibilitychange", programar);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entrada]) => {
        enPantalla = entrada.isIntersecting;
        programar();
      },
      { threshold: 0.5 }
    ).observe(carrusel);
  }

  // Arranca con la primera foto en el medio de la pista.
  for (let i = 0; i < CENTRO; i += 1) pista.prepend(/** @type {Node} */ (pista.lastElementChild));
  pista.scrollLeft = CENTRO * anchoFoto();

  marcarActual(0);
  actualizarPausa();

  return { irA, carrusel };
}
