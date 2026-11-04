#!/usr/bin/env node
/**
 * Migración única: convierte el identificador de cada documento de `usuarios`
 * en el teléfono normalizado del cliente.
 *
 * Hace falta porque `firestore.rules` permite `get` y prohíbe `list`: el
 * navegador solo puede leer un documento cuyo identificador ya conozca, y el
 * único dato que el cliente escribe es su celular. Firestore no sabe renombrar
 * documentos, así que la única vía es copiarlos con el nombre nuevo y borrar los
 * originales.
 *
 * Uso:
 *   node scripts/migrar-telefonos.mjs                 Solo informa; no escribe.
 *   node scripts/migrar-telefonos.mjs --aplicar       Ejecuta la migración.
 *   node scripts/migrar-telefonos.mjs --clave=RUTA    Clave en otra ubicación.
 *
 * Usa el Admin SDK con una clave de cuenta de servicio, que no pasa por las
 * reglas de seguridad. Por defecto busca `clave-servicio.json` en la raíz.
 *
 * El informe enmascara los números para no dejar datos de clientes en el
 * historial de la terminal.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { esTelefonoValido, normalizarTelefono } from "../js/domain/telefono.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COLECCION_USUARIOS = "usuarios";
const COLECCION_PAGOS = "pagos";

/** Firestore admite 500 operaciones por lote; se deja margen. */
const OPERACIONES_POR_LOTE = 400;

const aplicar = process.argv.includes("--aplicar");
const rutaClave = resolve(
  RAIZ,
  process.argv.find((argumento) => argumento.startsWith("--clave="))?.slice("--clave=".length) ||
    "clave-servicio.json"
);

/**
 * Deja visibles los extremos para poder identificar un registro en la consola
 * de Firebase sin escribir el número completo en pantalla.
 *
 * @param {string} valor
 * @returns {string}
 */
function enmascarar(valor) {
  if (valor.length <= 5) return valor;
  return `${valor.slice(0, 3)}${"*".repeat(valor.length - 5)}${valor.slice(-2)}`;
}

async function conectar() {
  let clave;
  try {
    clave = JSON.parse(await readFile(rutaClave, "utf8"));
  } catch (error) {
    throw new Error(
      `No se pudo leer la clave de cuenta de servicio en ${rutaClave}\n` +
        `(${error.message})\n\n` +
        "Genérala en la consola de Firebase: Configuración del proyecto →\n" +
        "Cuentas de servicio → Generar nueva clave privada, y guarda el archivo\n" +
        "como clave-servicio.json en la raíz del proyecto."
    );
  }

  initializeApp({ credential: cert(clave) });
  return getFirestore();
}

/**
 * Decide el identificador que debe tener cada documento y separa los casos que
 * impiden migrar. Se prefiere el campo `telefono`; si no sirve, se intenta con
 * el identificador actual, porque puede que ya sea el número.
 *
 * @param {import("firebase-admin/firestore").QuerySnapshot} usuarios
 */
function planificar(usuarios) {
  /** @type {{id: string, objetivo: string, datos: Record<string, unknown>}[]} */
  const aMigrar = [];
  /** @type {string[]} */
  const yaCorrectos = [];
  /** @type {string[]} */
  const sinTelefono = [];
  /** @type {Map<string, string[]>} */
  const porObjetivo = new Map();

  for (const documento of usuarios.docs) {
    const datos = documento.data();
    const desdeCampo = normalizarTelefono(datos.telefono);
    const desdeId = normalizarTelefono(documento.id);

    let objetivo = "";
    if (esTelefonoValido(desdeCampo)) objetivo = desdeCampo;
    else if (esTelefonoValido(desdeId)) objetivo = desdeId;

    if (!objetivo) {
      sinTelefono.push(documento.id);
      continue;
    }

    porObjetivo.set(objetivo, [...(porObjetivo.get(objetivo) ?? []), documento.id]);

    // El campo `telefono` se reescribe normalizado incluso cuando el
    // identificador ya es correcto, para que la base quede en un solo formato.
    if (documento.id === objetivo && datos.telefono === objetivo) {
      yaCorrectos.push(documento.id);
    } else {
      aMigrar.push({ id: documento.id, objetivo, datos });
    }
  }

  const colisiones = [...porObjetivo.entries()].filter(([, ids]) => ids.length > 1);

  return { aMigrar, yaCorrectos, sinTelefono, colisiones };
}

/**
 * Busca campos de `pagos` cuyo valor sea el identificador de un usuario. Si los
 * hay, renombrar los documentos rompería el vínculo y hay que actualizarlos.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Map<string, string>} nuevoIdPorAntiguo
 */
async function analizarPagos(db, nuevoIdPorAntiguo) {
  const pagos = await db.collection(COLECCION_PAGOS).get();
  const campos = new Set();
  /** @type {{id: string, campo: string, antiguo: string}[]} */
  const referencias = [];

  for (const documento of pagos.docs) {
    const datos = documento.data();
    for (const [campo, valor] of Object.entries(datos)) {
      campos.add(campo);
      if (typeof valor === "string" && nuevoIdPorAntiguo.has(valor)) {
        referencias.push({ id: documento.id, campo, antiguo: valor });
      }
    }
  }

  return { total: pagos.size, campos: [...campos].sort(), referencias };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {((lote: import("firebase-admin/firestore").WriteBatch) => void)[]} operaciones
 */
async function ejecutarEnLotes(db, operaciones) {
  for (let inicio = 0; inicio < operaciones.length; inicio += OPERACIONES_POR_LOTE) {
    const lote = db.batch();
    for (const operacion of operaciones.slice(inicio, inicio + OPERACIONES_POR_LOTE)) {
      operacion(lote);
    }
    await lote.commit();
  }
}

async function principal() {
  const db = await conectar();
  const usuarios = await db.collection(COLECCION_USUARIOS).get();

  console.log(`Colección "${COLECCION_USUARIOS}": ${usuarios.size} documentos.\n`);

  const { aMigrar, yaCorrectos, sinTelefono, colisiones } = planificar(usuarios);
  const nuevoIdPorAntiguo = new Map(aMigrar.map(({ id, objetivo }) => [id, objetivo]));
  const pagos = await analizarPagos(db, nuevoIdPorAntiguo);

  console.log(`Ya tienen el identificador correcto: ${yaCorrectos.length}`);
  console.log(`Se renombrarían: ${aMigrar.length}`);
  for (const { id, objetivo } of aMigrar) {
    console.log(`  ${enmascarar(id)} → ${enmascarar(objetivo)}`);
  }

  if (sinTelefono.length) {
    console.log(`\nSin teléfono válido (habría que corregirlos a mano): ${sinTelefono.length}`);
    for (const id of sinTelefono) console.log(`  ${enmascarar(id)}`);
  }

  if (colisiones.length) {
    console.log(`\nNúmeros repetidos en varios documentos: ${colisiones.length}`);
    for (const [objetivo, ids] of colisiones) {
      console.log(`  ${enmascarar(objetivo)}: ${ids.map(enmascarar).join(", ")}`);
    }
  }

  console.log(`\nColección "${COLECCION_PAGOS}": ${pagos.total} documentos.`);
  console.log(`  Campos presentes: ${pagos.campos.join(", ") || "(ninguno)"}`);
  console.log(`  Referencias a actualizar (campo usuarioId): ${pagos.referencias.length}`);
  for (const { id, antiguo } of pagos.referencias) {
    console.log(`  ${enmascarar(id)}: ${enmascarar(antiguo)} → ${enmascarar(nuevoIdPorAntiguo.get(antiguo))}`);
  }

  const bloqueantes = [];
  if (colisiones.length) {
    bloqueantes.push(
      "Hay números repetidos: dos documentos no pueden compartir identificador.\n" +
        "  Unifica o corrige esos registros en la consola antes de migrar."
    );
  }

  if (bloqueantes.length) {
    console.log("\nNo se puede migrar todavía:");
    for (const motivo of bloqueantes) console.log(`- ${motivo}`);
    process.exitCode = 1;
    return;
  }

  if (!aplicar) {
    console.log(
      aMigrar.length
        ? "\nRevisión completa, no se escribió nada.\n" +
            "Para ejecutar: node scripts/migrar-telefonos.mjs --aplicar"
        : "\nNo hay nada que migrar."
    );
    return;
  }

  if (!aMigrar.length) {
    console.log("\nNo hay nada que migrar.");
    return;
  }

  // Se crean todos los documentos nuevos antes de borrar ninguno: si algo
  // falla a mitad quedan duplicados, que son recuperables, en lugar de huecos.
  await ejecutarEnLotes(
    db,
    aMigrar.map(({ objetivo, datos }) => (lote) => {
      lote.set(db.collection(COLECCION_USUARIOS).doc(objetivo), {
        ...datos,
        telefono: objetivo,
      });
    })
  );
  console.log(`\nCreados ${aMigrar.length} documentos con el nuevo identificador.`);

  if (pagos.referencias.length) {
    await ejecutarEnLotes(
      db,
      pagos.referencias.map(({ id, campo, antiguo }) => (lote) => {
        lote.update(db.collection(COLECCION_PAGOS).doc(id), {
          [campo]: nuevoIdPorAntiguo.get(antiguo),
        });
      })
    );
    console.log(`Actualizadas ${pagos.referencias.length} referencias en "${COLECCION_PAGOS}".`);
  }

  const aBorrar = aMigrar.filter(({ id, objetivo }) => id !== objetivo);
  await ejecutarEnLotes(
    db,
    aBorrar.map(({ id }) => (lote) => {
      lote.delete(db.collection(COLECCION_USUARIOS).doc(id));
    })
  );
  console.log(`Borrados ${aBorrar.length} documentos antiguos.`);

  const final = await db.collection(COLECCION_USUARIOS).get();
  console.log(`\nMigración terminada. La colección tiene ${final.size} documentos.`);
}

principal().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
