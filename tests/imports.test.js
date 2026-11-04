/**
 * Sin empaquetador, un import mal escrito solo se descubre cuando el navegador
 * lo pide. Esta comprobación lo detecta antes.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Especificadores no relativos que el proyecto puede usar. */
const EXTERNOS_PERMITIDOS = new Set([
  // Dependencias de functions/package.json.
  "firebase-functions",
  "firebase-functions/https",
  "firebase-admin/app",
  "firebase-admin/firestore",
]);

/** Solo los módulos generados en js/vendor/ apuntan al CDN. */
const CDN_FIREBASE = "https://www.gstatic.com/firebasejs/";

const PATRON_IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function archivosJs(directorio) {
  return readdirSync(join(RAIZ, directorio)).flatMap((entrada) => {
    const relativa = join(directorio, entrada);
    if (entrada === "node_modules") return [];
    if (statSync(join(RAIZ, relativa)).isDirectory()) return archivosJs(relativa);
    return relativa.endsWith(".js") ? [relativa] : [];
  });
}

describe("imports del proyecto", () => {
  const archivos = [...archivosJs("js"), ...archivosJs("functions")];

  it("encuentra los módulos del navegador y de la función", () => {
    assert.ok(archivos.length > 10, "se esperaban más archivos que revisar");
  });

  for (const archivo of archivos) {
    it(`${archivo.replaceAll("\\", "/")} resuelve sus imports`, () => {
      const fuente = readFileSync(join(RAIZ, archivo), "utf8");

      for (const [, especificador] of fuente.matchAll(PATRON_IMPORT)) {
        if (especificador.startsWith(".")) {
          const destino = resolve(dirname(join(RAIZ, archivo)), especificador);
          assert.ok(existsSync(destino), `no existe el archivo importado "${especificador}"`);
        } else if (especificador.startsWith(CDN_FIREBASE)) {
          assert.ok(
            archivo.includes("vendor"),
            `solo js/vendor/ debe apuntar al CDN, no ${archivo}`
          );
        } else {
          assert.ok(
            EXTERNOS_PERMITIDOS.has(especificador),
            `"${especificador}" no es una ruta relativa ni una dependencia declarada`
          );
        }
      }
    });
  }

  it("carga una única versión del SDK de Firebase", () => {
    const versiones = new Set(
      archivos
        .filter((archivo) => archivo.includes("vendor"))
        .flatMap((archivo) => [
          ...readFileSync(join(RAIZ, archivo), "utf8").matchAll(/firebasejs\/([\d.]+)\//g),
        ])
        .map(([, version]) => version)
    );

    assert.equal(versiones.size, 1, `se encontraron varias versiones: ${[...versiones]}`);
  });
});
