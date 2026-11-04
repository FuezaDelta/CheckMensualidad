import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PAGINAS = [
  { archivo: "index.html", nombre: "index", entrada: "inicio" },
  { archivo: "horarios.html", nombre: "horarios", entrada: "estatica" },
  { archivo: "contactenos.html", nombre: "contactenos", entrada: "estatica" },
];

const leerPagina = (archivo) => readFile(join(RAIZ, archivo), "utf8");

const contar = (html, patron) => html.match(patron)?.length ?? 0;

describe("páginas generadas", () => {
  for (const { archivo, nombre, entrada } of PAGINAS) {
    describe(archivo, () => {
      it("no deja marcadores de plantilla sin resolver", async () => {
        assert.doesNotMatch(await leerPagina(archivo), /\{\{/);
      });

      it("incluye el encabezado, el menú lateral y el panel de planes", async () => {
        const html = await leerPagina(archivo);
        assert.match(html, /id="btn-hamburger"/);
        assert.match(html, /id="sidebar"/);
        assert.match(html, /id="panel-planes"/);
      });

      it("marca como activo un único enlace en cada menú", async () => {
        const html = await leerPagina(archivo);
        assert.equal(contar(html, /nav-link--active/g), 1);
        assert.equal(contar(html, /sidebar-link--active/g), 1);
        assert.equal(contar(html, /aria-current="page"/g), 2);
        assert.match(html, new RegExp(`nav-link--active"[^>]*data-nav="${nombre}"`));
      });

      it("carga el punto de entrada que le corresponde", async () => {
        const html = await leerPagina(archivo);
        assert.match(html, new RegExp(`src="\\./js/pages/${entrada}\\.js"`));
        assert.equal(contar(html, /<script type="module"/g), 1);
      });

      it("no usa scripts ni estilos inline, que la CSP de firebase.json bloquea", async () => {
        const html = await leerPagina(archivo);
        assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
        assert.doesNotMatch(html, /\sstyle="/);
      });

      it("referencia solo imágenes que existen en assets/", async () => {
        const html = await leerPagina(archivo);
        for (const [, ruta] of html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)) {
          await assert.doesNotReject(readFile(join(RAIZ, ruta)), `no existe ${ruta}`);
        }
      });

      it("mantiene los elementos ocultos fuera del orden de tabulación", async () => {
        const html = await leerPagina(archivo);
        assert.match(html, /id="sidebar"[^>]*inert/);
        assert.match(html, /id="panel-planes"[^>]*inert/);
      });
    });
  }

  it("index.html conserva el formulario de consulta que usa js/ui/consulta.js", async () => {
    const html = await leerPagina("index.html");
    for (const id of ["consulta-form", "telefono", "btn-consultar", "status", "resultado"]) {
      assert.equal(contar(html, new RegExp(`id="${id}"`, "g")), 1, `falta o se repite #${id}`);
    }
  });
});
