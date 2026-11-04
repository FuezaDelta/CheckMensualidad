/**
 * Backend de consulta de membresías.
 *
 * Existe para que la colección `usuarios` nunca sea legible desde el navegador:
 * el cliente envía un teléfono y recibe únicamente el nombre, la fecha de
 * vencimiento y el estado, calculado con el reloj del servidor.
 *
 * Los módulos de `./domain` son una copia de `js/domain` que genera
 * `npm run build`, para que las reglas de negocio no estén escritas dos veces.
 */

import { setGlobalOptions } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { calcularEstado, componerNombre } from "./domain/membresia.js";
import { aDate } from "./domain/fecha.js";
import {
  esTelefonoValido,
  normalizarTelefono,
  variantesTelefono,
} from "./domain/telefono.js";

const COLECCION_USUARIOS = "usuarios";

/** Ventana y cupo del limitador de peticiones por IP. */
const VENTANA_MS = 60_000;
const MAX_PETICIONES_POR_VENTANA = 20;

// Un número bajo de instancias mantiene el limitador en memoria razonablemente
// efectivo y acota el gasto de un pico de tráfico automatizado.
setGlobalOptions({ region: "us-central1", maxInstances: 3 });

initializeApp();
const db = getFirestore();

/** @type {Map<string, {ventana: number, conteo: number}>} */
const peticionesPorIp = new Map();

/**
 * La infraestructura de Google añade la IP real al final de `X-Forwarded-For`,
 * conservando lo que haya enviado el cliente. Tomar la primera entrada, que es
 * lo que hace Express por omisión, dejaría que cualquiera falsee su origen y
 * esquive el limitador cambiando la cabecera en cada petición.
 *
 * @param {import("firebase-functions/https").CallableRequest} peticion
 * @returns {string}
 */
function ipDelCliente(peticion) {
  const reenviadas = peticion.rawRequest?.headers?.["x-forwarded-for"];
  const lista = Array.isArray(reenviadas) ? reenviadas.join(",") : reenviadas;
  const ultima = lista?.split(",").pop()?.trim();
  return ultima || peticion.rawRequest?.socket?.remoteAddress || "desconocida";
}

/**
 * Defensa de mejor esfuerzo contra la enumeración de números. No sustituye a
 * App Check, que es lo que realmente distingue un navegador de un script.
 *
 * @param {string} ip
 * @returns {boolean} true si la petición excede el cupo.
 */
function excedeLimite(ip) {
  const ahora = Date.now();
  const ventanaActual = Math.floor(ahora / VENTANA_MS);
  const registro = peticionesPorIp.get(ip);

  if (!registro || registro.ventana !== ventanaActual) {
    peticionesPorIp.set(ip, { ventana: ventanaActual, conteo: 1 });

    // Poda perezosa para que el Map no crezca sin control.
    if (peticionesPorIp.size > 5_000) {
      for (const [clave, valor] of peticionesPorIp) {
        if (valor.ventana !== ventanaActual) peticionesPorIp.delete(clave);
      }
    }
    return false;
  }

  registro.conteo += 1;
  return registro.conteo > MAX_PETICIONES_POR_VENTANA;
}

/**
 * @param {string} telefono
 * @returns {Promise<FirebaseFirestore.DocumentData|null>}
 */
async function buscarUsuario(telefono) {
  const resultado = await db
    .collection(COLECCION_USUARIOS)
    .where("telefono", "in", variantesTelefono(telefono))
    .limit(1)
    .get();

  return resultado.empty ? null : resultado.docs[0].data();
}

export const consultarMembresia = onCall(
  {
    // Solo los dominios del sitio y los servidores locales de desarrollo pueden
    // invocarla desde un navegador. No detiene a un script fuera del navegador,
    // pero encarece el abuso casual. La expresión va anclada a propósito: sin el
    // `^https://` un dominio como `otro-manejo-65354.web.app` también pasaría.
    cors: [
      /^https:\/\/manejo-65354\.(web\.app|firebaseapp\.com)$/,
      // 5173 es el puerto de `npm run dev`; 5500 el de Live Server de VS Code.
      /^http:\/\/(localhost|127\.0\.0\.1):(5173|5500)$/,
    ],
    // Cambiar a true después de registrar la app en App Check (ver README).
    // Con enforcement activo, un script sin token de navegador no puede llamar.
    enforceAppCheck: false,
  },
  async (peticion) => {
    if (excedeLimite(ipDelCliente(peticion))) {
      throw new HttpsError("resource-exhausted", "Demasiadas consultas. Intenta más tarde.");
    }

    const telefono = normalizarTelefono(peticion.data?.telefono);
    if (!esTelefonoValido(telefono)) {
      throw new HttpsError("invalid-argument", "Número de celular inválido.");
    }

    const usuario = await buscarUsuario(telefono);
    if (!usuario) {
      throw new HttpsError("not-found", "No existe una membresía con ese número.");
    }

    const fechaFin = aDate(usuario.fechaFinMembresia);

    // Solo lo que la pantalla necesita: ningún otro campo del documento sale
    // del servidor.
    return {
      nombreCompleto: componerNombre(usuario.nombre, usuario.apellido),
      fechaFin: fechaFin ? fechaFin.toISOString() : null,
      estado: calcularEstado(fechaFin, usuario.estadoMembresia),
    };
  }
);
