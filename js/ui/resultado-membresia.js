/**
 * Tarjeta animada con el resultado de una consulta de membresía.
 *
 * Tres variantes, según el estado y los días que quedan:
 *   - activa:     sello con check, estallido de chevrones y cuenta de días.
 *   - por vencer: activa con 5 días o menos; aviso en ámbar y botón para
 *                 renovar por WhatsApp.
 *   - vencida:    sacudida corta, sello en rojo, días desde que venció y
 *                 botón para renovar por WhatsApp.
 *
 * Las animaciones son CSS; aquí solo se arma la estructura y se anima el
 * contador. Con "reducir movimiento" el CSS global deja cada animación en su
 * estado final y el contador muestra directamente el número.
 *
 * Todo el texto dinámico (el nombre viene de la base de datos) se inserta con
 * textContent, nunca como HTML.
 */

import {
  DIAS_AVISO_VENCIMIENTO,
  EstadoMembresia,
  diasRestantes,
} from "../domain/membresia.js";
import { crear } from "../lib/dom.js";
import { formatearFecha } from "../lib/format.js";
import { enlaceWhatsapp } from "../lib/whatsapp.js";

const SVG = "http://www.w3.org/2000/svg";
const DURACION_CONTADOR_MS = 900;
/** Días que representan una barra llena: la duración de un plan mensual. */
const DIAS_BARRA_LLENA = 30;
const CHEVRONES = 18;

/** @typedef {"activa"|"por-vencer"|"vencida"} Variante */

const prefiereMenosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "ADRIANA LUCIA SEGURA" → "Adriana Lucia Segura", para el mensaje de WhatsApp.
 *
 * @param {string} nombre
 * @returns {string}
 */
function capitalizar(nombre) {
  return nombre
    .toLocaleLowerCase("es-CO")
    .replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toLocaleUpperCase("es-CO"));
}

/**
 * @param {number} cantidad
 * @returns {string}
 */
const dias = (cantidad) => `${cantidad} ${cantidad === 1 ? "día" : "días"}`;

/**
 * @param {string} tipo "check" | "reloj" | "equis"
 * @returns {SVGSVGElement}
 */
function crearIcono(tipo) {
  const trazos = {
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    reloj: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4.5l3 2"],
    equis: ["M7 7l10 10", "M17 7L7 17"],
  }[tipo];

  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "sello-icono");
  for (const d of trazos) {
    const trazo = document.createElementNS(SVG, "path");
    trazo.setAttribute("d", d);
    trazo.setAttribute("pathLength", "1");
    svg.append(trazo);
  }
  return svg;
}

/**
 * El nombre letra por letra para la animación; los lectores de pantalla leen
 * la versión completa y no las letras sueltas.
 *
 * @param {string} nombre
 * @returns {HTMLElement}
 */
function crearNombre(nombre) {
  // Las letras se agrupan por palabra para que un nombre largo pueda partirse
  // en dos líneas entre palabras, nunca a mitad de una.
  let indice = 0;
  /** @type {Array<Node|string>} */
  const partes = [];
  nombre.split(/\s+/).filter(Boolean).forEach((palabra, posicion) => {
    if (posicion > 0) partes.push(" ");
    const letras = Array.from(palabra).map((letra) => {
      const span = crear("span", { clase: "resultado-letra", texto: letra });
      span.style.setProperty("--i", String(indice++));
      return span;
    });
    partes.push(crear("span", { clase: "resultado-palabra" }, letras));
  });

  return crear("div", { clase: "resultado-nombre" }, [
    crear("span", { clase: "solo-lectores", texto: nombre }),
    crear("span", { atributos: { "aria-hidden": "true" } }, partes),
  ]);
}

/** @returns {HTMLElement} */
function crearEstallido() {
  const chevrones = Array.from({ length: CHEVRONES }, (_, indice) => {
    const chevron = crear("span", { clase: "estallido-chevron" });
    const angulo = (360 / CHEVRONES) * indice + (Math.random() * 16 - 8);
    chevron.style.setProperty("--angulo", `${angulo}deg`);
    chevron.style.setProperty("--distancia", `${70 + Math.random() * 60}px`);
    chevron.style.setProperty("--retraso", `${Math.random() * 0.12}s`);
    return chevron;
  });
  return crear("span", { clase: "estallido", atributos: { "aria-hidden": "true" } }, chevrones);
}

/**
 * @param {HTMLElement} elemento
 * @param {number} hasta
 */
function animarContador(elemento, hasta) {
  if (prefiereMenosMovimiento() || hasta <= 0) {
    elemento.textContent = String(hasta);
    return;
  }

  const inicio = performance.now();
  const paso = (ahora) => {
    const avance = Math.min((ahora - inicio) / DURACION_CONTADOR_MS, 1);
    // Desacelera al final, como una aguja que se asienta.
    const suavizado = 1 - (1 - avance) ** 3;
    elemento.textContent = String(Math.round(hasta * suavizado));
    if (avance < 1 && elemento.isConnected) window.requestAnimationFrame(paso);
  };
  elemento.textContent = "0";
  window.requestAnimationFrame(paso);
}

/**
 * @param {Variante} variante
 * @param {number|null} restantes
 * @returns {{previo: string, numero: number, posterior: string, lectura: string}|null}
 */
function textoDias(variante, restantes) {
  if (restantes == null) return null;

  if (variante === "vencida") {
    const hace = -restantes;
    if (hace === 1) return { previo: "Venció ayer", numero: -1, posterior: "", lectura: "Venció ayer" };
    return {
      previo: "Venció hace",
      numero: hace,
      posterior: hace === 1 ? "día" : "días",
      lectura: `Venció hace ${dias(hace)}`,
    };
  }

  if (restantes === 0) return { previo: "Vence hoy", numero: -1, posterior: "", lectura: "Vence hoy" };
  if (restantes === 1) {
    return { previo: "Vence mañana", numero: -1, posterior: "", lectura: "Vence mañana" };
  }
  return {
    previo: "Te quedan",
    numero: restantes,
    posterior: "días",
    lectura: `Te quedan ${dias(restantes)}`,
  };
}

/**
 * @param {Variante} variante
 * @param {number|null} restantes
 * @returns {HTMLElement|null}
 */
function crearDias(variante, restantes) {
  const texto = textoDias(variante, restantes);
  if (!texto || restantes == null) return null;

  const visible = [crear("span", { texto: texto.previo })];
  /** @type {HTMLElement|null} */
  let contador = null;
  if (texto.numero >= 0) {
    contador = crear("strong", { clase: "resultado-contador", texto: String(texto.numero) });
    visible.push(" ", contador, " ", crear("span", { texto: texto.posterior }));
  }

  // Vencida: la barra arranca llena y se vacía. Activa: se llena hasta la
  // proporción de días que quedan sobre un mes.
  const proporcion = variante === "vencida" ? 0 : Math.min(restantes / DIAS_BARRA_LLENA, 1);
  const relleno = crear("span", { clase: "resultado-barra-relleno" });
  relleno.style.setProperty("--proporcion", String(Math.max(proporcion, 0.04)));

  const bloque = crear("div", { clase: "resultado-dias" }, [
    crear("p", { clase: "resultado-dias-texto" }, [
      crear("span", { clase: "solo-lectores", texto: texto.lectura }),
      crear("span", { atributos: { "aria-hidden": "true" } }, visible),
    ]),
    crear("span", { clase: "resultado-barra", atributos: { "aria-hidden": "true" } }, [relleno]),
  ]);

  if (contador) {
    const objetivo = contador;
    // Arranca cuando la tarjeta ya entró, no mientras aparece.
    window.setTimeout(() => animarContador(objetivo, texto.numero), prefiereMenosMovimiento() ? 0 : 450);
  }
  return bloque;
}

/**
 * @param {Variante} variante
 * @param {import("../domain/membresia.js").Membresia} membresia
 * @returns {HTMLElement[]}
 */
function crearLlamado(variante, membresia) {
  const nombre = capitalizar(membresia.nombreCompleto);

  const contenido = {
    activa: {
      mensaje: "¡Sigue así! Nos vemos en el box 💪",
      whatsapp: null,
    },
    "por-vencer": {
      mensaje: "Renueva a tiempo y no pierdas el ritmo.",
      whatsapp: membresia.fechaFin
        ? `Hola, soy ${nombre}. Mi membresía vence el ${formatearFecha(membresia.fechaFin)} y quiero renovarla 💪`
        : `Hola, soy ${nombre}. Quiero renovar mi membresía 💪`,
    },
    vencida: {
      mensaje: "¡Te extrañamos en el box! Renueva y vuelve a entrenar 💪",
      whatsapp: `Hola, soy ${nombre}. Quiero renovar mi membresía en Fuerza Delta 💪`,
    },
  }[variante];

  const elementos = [crear("p", { clase: "resultado-mensaje", texto: contenido.mensaje })];

  if (contenido.whatsapp) {
    elementos.push(
      crear("a", {
        clase: "btn resultado-whatsapp",
        texto: "Renovar por WhatsApp",
        atributos: {
          href: enlaceWhatsapp(contenido.whatsapp),
          target: "_blank",
          rel: "noopener noreferrer",
        },
      })
    );
  }
  return elementos;
}

/**
 * @param {import("../domain/membresia.js").Membresia} membresia
 * @param {Date} [ahora]
 * @returns {Variante}
 */
export function varianteDe(membresia, ahora = new Date()) {
  if (membresia.estado === EstadoMembresia.VENCIDA) return "vencida";
  const restantes = diasRestantes(membresia.fechaFin, ahora);
  return restantes != null && restantes <= DIAS_AVISO_VENCIMIENTO ? "por-vencer" : "activa";
}

const SELLOS = Object.freeze({
  activa: { texto: "Activa", icono: "check" },
  "por-vencer": { texto: "Por vencer", icono: "reloj" },
  vencida: { texto: "Vencida", icono: "equis" },
});

/**
 * Llena el contenedor con la tarjeta y le pone la clase de su variante, que
 * es la que dispara las animaciones.
 *
 * @param {HTMLElement} contenedor
 * @param {import("../domain/membresia.js").Membresia} membresia
 */
export function pintarResultado(contenedor, membresia) {
  const ahora = new Date();
  const variante = varianteDe(membresia, ahora);
  const restantes = diasRestantes(membresia.fechaFin, ahora);
  const sello = SELLOS[variante];

  const insignia = crear("span", { clase: "sello" }, [
    crearIcono(sello.icono),
    crear("span", { texto: sello.texto }),
  ]);
  if (variante === "activa") insignia.append(crearEstallido());

  const hijos = [
    crear("div", { clase: "resultado-header" }, [crearNombre(membresia.nombreCompleto), insignia]),
    crear("p", { clase: "resultado-item" }, [
      crear("strong", { texto: "Fecha de vencimiento:" }),
      ` ${formatearFecha(membresia.fechaFin)}`,
    ]),
    crearDias(variante, restantes),
    ...crearLlamado(variante, membresia),
  ].filter(Boolean);

  contenedor.className = `resultado visible resultado--${variante}`;
  contenedor.replaceChildren(.../** @type {Node[]} */ (hijos));
}
