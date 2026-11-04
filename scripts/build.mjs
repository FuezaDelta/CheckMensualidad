#!/usr/bin/env node
/**
 * Genera las páginas HTML de la raíz a partir de `templates/`.
 *
 * El encabezado, el menú lateral y el panel de planes son idénticos en las tres
 * páginas: mantenerlos como parciales evita que se desincronicen al editarlos.
 *
 * También copia `js/domain/` dentro de `functions/`, porque el navegador y la
 * Cloud Function deben aplicar exactamente las mismas reglas de negocio y el
 * despliegue de funciones solo sube el contenido de esa carpeta.
 *
 * Uso:
 *   node scripts/build.mjs           Escribe los archivos generados.
 *   node scripts/build.mjs --check   Falla si algo está desactualizado (CI).
 */

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_PLANTILLAS = join(RAIZ, "templates");
const DIR_PARCIALES = join(DIR_PLANTILLAS, "partials");
const DIR_PAGINAS = join(DIR_PLANTILLAS, "pages");
const DIR_DOMINIO_ORIGEN = join(RAIZ, "js", "domain");
const DIR_DOMINIO_DESTINO = join(RAIZ, "functions", "domain");
const DIR_VENDOR = join(RAIZ, "js", "vendor");

/** Módulos del SDK de Firebase que el sitio carga desde el CDN de Google. */
const MODULOS_FIREBASE = ["app", "app-check", "firestore", "functions"];

const AVISO_GENERADO = "Archivo generado por scripts/build.mjs — no editar a mano.";
const MAX_PROFUNDIDAD_PARCIALES = 5;

const soloComprobar = process.argv.includes("--check");

/**
 * Aplica una indentación a todas las líneas menos la primera, que ya la recibe
 * del marcador que se está sustituyendo.
 */
function indentar(texto, indentacion) {
  if (!indentacion) return texto;
  return texto
    .split("\n")
    .map((linea, indice) => (indice === 0 || linea.trim() === "" ? linea : indentacion + linea))
    .join("\n");
}

function escaparAtributo(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function insertarParciales(html, parciales) {
  let resultado = html;

  for (let profundidad = 0; profundidad < MAX_PROFUNDIDAD_PARCIALES; profundidad += 1) {
    let hubaCambios = false;

    resultado = resultado.replace(
      /^([ \t]*)\{\{>\s*([\w-]+)\s*\}\}[ \t]*\r?$/gm,
      (coincidencia, indentacion, nombre) => {
        const parcial = parciales.get(nombre);
        if (parcial === undefined) {
          throw new Error(`El parcial "${nombre}" no existe en templates/partials/`);
        }
        hubaCambios = true;
        return indentacion + indentar(parcial.trimEnd(), indentacion);
      }
    );

    if (!hubaCambios) return resultado;
  }

  throw new Error("Los parciales se incluyen entre sí de forma circular");
}

function aplicarVariables(html, variables) {
  return html.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (coincidencia, nombre) => {
    // El cuerpo de la página se inserta después, sin escapar, porque es HTML.
    if (nombre === "content") return coincidencia;
    if (!(nombre in variables)) {
      throw new Error(`Falta la variable "${nombre}" en la plantilla`);
    }
    return escaparAtributo(variables[nombre]);
  });
}

function insertarContenido(html, contenido) {
  return html.replace(/^([ \t]*)\{\{\s*content\s*\}\}[ \t]*\r?$/gm, (coincidencia, indentacion) => {
    return indentacion + indentar(contenido.trim(), indentacion);
  });
}

/**
 * Marca el enlace de la página actual en el menú principal y en el lateral.
 */
function marcarNavegacionActiva(html, pagina) {
  let marcados = 0;

  const resultado = html.replace(
    /class="(nav-link|sidebar-link)"([^>]*?)data-nav="([\w-]+)"/g,
    (coincidencia, clase, medio, nombre) => {
      if (nombre !== pagina) return coincidencia;
      marcados += 1;
      return `class="${clase} ${clase}--active" aria-current="page"${medio}data-nav="${nombre}"`;
    }
  );

  if (marcados === 0) {
    console.warn(`Aviso: ningún enlace de navegación corresponde a la página "${pagina}".`);
  }

  return resultado;
}

function extraerMetadatos(fuente, archivo) {
  const coincidencia = fuente.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!coincidencia) {
    throw new Error(`${archivo} no declara su bloque <!--meta ... -->`);
  }

  let metadatos;
  try {
    metadatos = JSON.parse(coincidencia[1]);
  } catch (error) {
    throw new Error(`El bloque meta de ${archivo} no es JSON válido: ${error.message}`);
  }

  for (const campo of ["title", "description", "entry"]) {
    if (typeof metadatos[campo] !== "string" || !metadatos[campo]) {
      throw new Error(`${archivo} debe declarar "${campo}" en su bloque meta`);
    }
  }

  return { metadatos, contenido: fuente.slice(coincidencia[0].length) };
}

/**
 * @param {string} ruta
 * @param {string} contenido
 * @param {{versionado?: boolean}} [opciones] Los archivos que no están en el
 *   repositorio se escriben siempre: no tiene sentido comprobarlos en CI.
 * @returns {Promise<boolean>} true si el archivo en disco ya era el correcto.
 */
async function escribirSiCambia(ruta, contenido, { versionado = true } = {}) {
  let actual = null;
  try {
    actual = await readFile(ruta, "utf8");
  } catch {
    actual = null;
  }

  if (actual === contenido) return true;

  if (soloComprobar && versionado) {
    console.error(`Desactualizado: ${ruta.replace(RAIZ, "").replace(/^[\\/]/, "")}`);
    return false;
  }

  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, contenido, "utf8");
  console.log(`Generado: ${ruta.replace(RAIZ, "").replace(/^[\\/]/, "")}`);
  return true;
}

async function cargarParciales() {
  const archivos = await readdir(DIR_PARCIALES);
  const parciales = new Map();

  for (const archivo of archivos.filter((nombre) => nombre.endsWith(".html"))) {
    const nombre = archivo.replace(/\.html$/, "");
    parciales.set(nombre, await readFile(join(DIR_PARCIALES, archivo), "utf8"));
  }

  return parciales;
}

async function construirPaginas(sitio, parciales) {
  const layout = await readFile(join(DIR_PLANTILLAS, "layout.html"), "utf8");
  const archivos = (await readdir(DIR_PAGINAS)).filter((nombre) => nombre.endsWith(".html"));
  let todoAlDia = true;

  for (const archivo of archivos) {
    const pagina = archivo.replace(/\.html$/, "");
    const fuente = await readFile(join(DIR_PAGINAS, archivo), "utf8");
    const { metadatos, contenido } = extraerMetadatos(fuente, `templates/pages/${archivo}`);

    let html = insertarParciales(layout, parciales);
    html = aplicarVariables(html, {
      ...sitio,
      ...metadatos,
      page: pagina,
      canonical: pagina === "index" ? "" : archivo,
    });
    // Las páginas también pueden incluir parciales (horarios, contacto) para
    // que un mismo bloque aparezca en la portada y en su página propia.
    html = insertarContenido(html, insertarParciales(contenido, parciales));
    html = marcarNavegacionActiva(html, pagina);
    html = html.replace("<!DOCTYPE html>", `<!DOCTYPE html>\n<!-- ${AVISO_GENERADO} -->`);

    todoAlDia = (await escribirSiCambia(join(RAIZ, archivo), html)) && todoAlDia;
  }

  return todoAlDia;
}

/**
 * Genera un módulo por cada parte del SDK de Firebase que reexporta la URL del
 * CDN. Es la alternativa al import map: este iría inline en el HTML y la
 * política de seguridad de contenido (firebase.json) no admite scripts inline.
 * La versión sigue definiéndose en un solo lugar, templates/site.json.
 */
async function generarModulosFirebase(sitio) {
  let todoAlDia = true;

  for (const modulo of MODULOS_FIREBASE) {
    const url = `https://www.gstatic.com/firebasejs/${sitio.firebaseVersion}/firebase-${modulo}.js`;
    const contenido = [
      `// ${AVISO_GENERADO}`,
      "// La versión del SDK se define en templates/site.json.",
      "",
      `export * from "${url}";`,
      "",
    ].join("\n");

    const ruta = join(DIR_VENDOR, `firebase-${modulo}.js`);
    todoAlDia = (await escribirSiCambia(ruta, contenido)) && todoAlDia;
  }

  return todoAlDia;
}

/**
 * El dominio es la única copia de las reglas de negocio; aquí solo se replica
 * para que el paquete de funciones sea autocontenido. La copia no se versiona,
 * así que se regenera siempre, incluso en modo --check.
 */
async function sincronizarDominio() {
  const archivos = (await readdir(DIR_DOMINIO_ORIGEN)).filter((nombre) => nombre.endsWith(".js"));

  for (const archivo of archivos) {
    const fuente = await readFile(join(DIR_DOMINIO_ORIGEN, archivo), "utf8");
    const contenido = `// ${AVISO_GENERADO}\n// Copia de js/domain/${archivo}\n\n${fuente}`;
    await escribirSiCambia(join(DIR_DOMINIO_DESTINO, archivo), contenido, { versionado: false });
  }
}

async function principal() {
  const sitio = JSON.parse(await readFile(join(DIR_PLANTILLAS, "site.json"), "utf8"));
  const parciales = await cargarParciales();

  const paginasAlDia = await construirPaginas(sitio, parciales);
  const vendorAlDia = await generarModulosFirebase(sitio);
  await sincronizarDominio();

  if (soloComprobar && !(paginasAlDia && vendorAlDia)) {
    console.error("\nHay archivos generados desactualizados. Ejecuta: npm run build");
    process.exitCode = 1;
    return;
  }

  console.log(soloComprobar ? "Todo al día." : "Build completo.");
}

principal().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
