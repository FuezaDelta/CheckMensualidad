/**
 * Visor de fotos para la galería de la portada.
 *
 * Cada foto es un enlace a la imagen completa, así que sin JavaScript el
 * navegador simplemente la abre. Con JavaScript se muestra en un <dialog>
 * modal, que ya gestiona el foco y la tecla Escape por sí solo.
 */

import { crear, porId } from "../lib/dom.js";

/**
 * @param {string} [idGaleria]
 */
export function crearGaleria(idGaleria = "galeria") {
  const galeria = porId(idGaleria);
  if (!galeria || typeof HTMLDialogElement !== "function") return null;

  const enlaces = /** @type {HTMLAnchorElement[]} */ (
    Array.from(galeria.querySelectorAll("a.galeria-item"))
  );
  if (enlaces.length === 0) return null;

  let actual = 0;

  const foto = /** @type {HTMLImageElement} */ (crear("img", { clase: "visor-foto" }));
  const botonAnterior = crear("button", {
    clase: "visor-boton",
    texto: "‹",
    atributos: { type: "button", "aria-label": "Foto anterior" },
  });
  const botonSiguiente = crear("button", {
    clase: "visor-boton",
    texto: "›",
    atributos: { type: "button", "aria-label": "Foto siguiente" },
  });
  const botonCerrar = crear("button", {
    clase: "visor-boton",
    texto: "×",
    atributos: { type: "button", "aria-label": "Cerrar" },
  });

  const visor = /** @type {HTMLDialogElement} */ (
    crear("dialog", { clase: "visor", atributos: { "aria-label": "Foto ampliada" } }, [
      foto,
      crear("div", { clase: "visor-controles" }, [botonAnterior, botonCerrar, botonSiguiente]),
    ])
  );
  document.body.append(visor);

  /** @param {number} indice */
  function mostrar(indice) {
    actual = (indice + enlaces.length) % enlaces.length;
    const enlace = enlaces[actual];
    foto.src = enlace.href;
    foto.alt = enlace.querySelector("img")?.alt ?? "";
  }

  enlaces.forEach((enlace, indice) => {
    enlace.addEventListener("click", (evento) => {
      if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey) return;
      evento.preventDefault();
      mostrar(indice);
      visor.showModal();
    });
  });

  botonAnterior.addEventListener("click", () => mostrar(actual - 1));
  botonSiguiente.addEventListener("click", () => mostrar(actual + 1));
  botonCerrar.addEventListener("click", () => visor.close());

  // Un clic en el fondo oscuro (fuera de la foto y los botones) cierra el visor.
  visor.addEventListener("click", (evento) => {
    if (evento.target === visor) visor.close();
  });

  visor.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowLeft") mostrar(actual - 1);
    if (evento.key === "ArrowRight") mostrar(actual + 1);
  });

  return { visor };
}
