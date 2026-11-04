/**
 * Acceso a los planes de membresía.
 *
 * Los planes son información pública y cambian poco, así que se leen una sola
 * vez por sesión: abrir y cerrar el panel no debe generar lecturas repetidas.
 */

import { collection, getDocs, limit, query, where } from "../vendor/firebase-firestore.js";
import { crearPlan, ordenarPlanes } from "../domain/plan.js";
import { obtenerFirestore } from "../lib/firebase.js";
import { comoErrorServicio } from "./errores.js";

const COLECCION_PLANES = "planes";
const LIMITE_PLANES = 50;

/** @type {Promise<import("../domain/plan.js").Plan[]>|null} */
let planesEnCache = null;

/**
 * @param {{refrescar?: boolean}} [opciones]
 * @returns {Promise<import("../domain/plan.js").Plan[]>}
 */
export function obtenerPlanesActivos({ refrescar = false } = {}) {
  if (refrescar) planesEnCache = null;

  if (!planesEnCache) {
    planesEnCache = cargarPlanes().catch((error) => {
      // Un fallo no debe quedar cacheado: el siguiente intento vuelve a la red.
      planesEnCache = null;
      throw comoErrorServicio(error);
    });
  }

  return planesEnCache;
}

async function cargarPlanes() {
  const db = await obtenerFirestore();
  const consulta = query(
    collection(db, COLECCION_PLANES),
    where("activo", "==", true),
    limit(LIMITE_PLANES)
  );

  const resultado = await getDocs(consulta);
  return ordenarPlanes(resultado.docs.map((documento) => crearPlan(documento.id, documento.data())));
}
